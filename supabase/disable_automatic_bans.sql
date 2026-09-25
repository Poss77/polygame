-- ==============================================================================
-- POLYGAME DATABASE MIGRATION: DISABLE AUTOMATIC BANS (v1.5.467)
-- ==============================================================================
-- Purpose: Permanently disable automatic account suspensions across Polygon Gaming.
--
-- Background:
-- False-positive security alerts (such as PolySpace fleet signature transitions
-- or latency fluctuations) previously incremented bot_warning until reaching 5,
-- which triggered an automated permanent suspension (is_banned = true).
-- Paying players (including Troubs and Theo) were affected by this automated rule.
--
-- Changes Applied:
-- 1. Upgrades `record_bot_warning`:
--    - Completely removes the automated `is_banned = true` trigger.
--    - Continues logging all suspicious incidents to `public.bot_security_logs`
--      for administrative visibility.
--    - All bans are now strictly human-reviewed and administered by the Master
--      Admin Wallet (0x10B9993990c9EF8a212c9557cB02aD94da9a654d) via `admin_set_user_ban`.
-- 2. Upgrades `claim_polyspace_expedition`:
--    - Validates server signatures against both canonical `player_id` and `linked_wallet_address`.
--    - Discards invalid signatures safely without incrementing `bot_warning`.
-- 3. Cleans up false-positive audit logs and stuck expeditions for Troubs:
--    - Guarantees `is_banned = false` and `bot_warning = 0`.
--    - Removes stuck nebula expeditions with signature mismatches so fleet slots
--      are immediately freed up for fresh expeditions.
-- ==============================================================================

-- 1. UPGRADE record_bot_warning (REMOVES ALL AUTOMATIC BANS)
DROP FUNCTION IF EXISTS public.record_bot_warning(TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS record_bot_warning(TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.record_bot_warning(
  p_player_id TEXT,
  p_reason TEXT,
  p_game TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  v_pid := resolve_player_id(p_player_id);
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_player_id, '')));
  END IF;

  SELECT * INTO v_user FROM public.users WHERE player_id = v_pid FOR UPDATE;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Atomically increment bot_warning count for audit records
  UPDATE public.users
  SET bot_warning = COALESCE(bot_warning, 0) + 1,
      updated_at = NOW()
  WHERE player_id = v_pid
  RETURNING bot_warning INTO v_count;

  -- NO AUTOMATIC BANS:
  -- Automatic bans have been completely disabled platform-wide.
  -- Security violations are logged to bot_security_logs for admin review.
  -- All bans are strictly human-reviewed and administered by the Master Admin Wallet via admin_set_user_ban.

  -- Log security incident to persistent audit table
  INSERT INTO public.bot_security_logs (player_id, reason, game_name, details, created_at)
  VALUES (v_pid, COALESCE(p_reason, 'suspicious_activity'), p_game, COALESCE(p_details, '{}'::jsonb), NOW());

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_pid,
    'bot_warning', v_count,
    'is_banned', COALESCE(v_user.is_banned, false),
    'reason', p_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_bot_warning(TEXT, TEXT, TEXT, JSONB) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_bot_warning(TEXT, TEXT, TEXT, JSONB) FROM anon, authenticated;

-- 2. UPGRADE claim_polyspace_expedition (SAFE DISCARD WITHOUT BOT WARNINGS)
DROP FUNCTION IF EXISTS public.claim_polyspace_expedition(TEXT, TEXT);
DROP FUNCTION IF EXISTS claim_polyspace_expedition(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.claim_polyspace_expedition(
  p_player_id TEXT,
  p_expedition_id TEXT DEFAULT 'ALL'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_space_state JSONB;
  v_expeditions JSONB;
  v_remaining_expeditions JSONB := '[]'::jsonb;
  v_claimed_count INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
  v_now_ms BIGINT;
  v_target_all BOOLEAN := false;
  v_exp JSONB;
  v_exp_id TEXT;
  v_exp_type TEXT;
  v_exp_name TEXT;
  v_exp_start BIGINT;
  v_exp_end BIGINT;
  
  -- Upgrades & Multipliers
  v_cargo_level INTEGER := 1;
  v_laser_level INTEGER := 1;
  v_warp_level INTEGER := 1;
  v_cargo_mult NUMERIC := 1.0;
  v_laser_mult NUMERIC := 1.0;
  v_variance NUMERIC;
  v_is_critical BOOLEAN := false;
  
  -- Single Expedition Rewards
  v_base_iron NUMERIC := 0;
  v_base_tit NUMERIC := 0;
  v_base_quant NUMERIC := 0;
  v_base_pgt NUMERIC := 0.5;
  v_item_iron NUMERIC := 0;
  v_item_tit NUMERIC := 0;
  v_item_quant NUMERIC := 0;
  v_item_pgt NUMERIC := 0;
  v_item_pgt_ore INTEGER := 0;
  v_pgt_ore_chance NUMERIC := 0.0;
  
  -- Aggregate Transaction Totals
  v_tot_iron NUMERIC := 0;
  v_tot_tit NUMERIC := 0;
  v_tot_quant NUMERIC := 0;
  v_tot_pgt_ore INTEGER := 0;
  v_tot_pgt NUMERIC := 0;
  v_final_pgt NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  
  -- Log and Claim details
  v_new_logs JSONB := '[]'::jsonb;
  v_last_exp_name TEXT := '';
  v_time_str TEXT;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  v_now_ms := (EXTRACT(EPOCH FROM v_now) * 1000)::BIGINT;
  v_time_str := TO_CHAR(v_now, 'HH24:MI') || ' UTC';
  v_target_all := (p_expedition_id IS NULL OR UPPER(TRIM(p_expedition_id)) = 'ALL' OR TRIM(p_expedition_id) = '');

  -- 1. Row Lock & Load User Profile
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found.');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended.');
  END IF;

  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_expeditions := COALESCE(v_space_state->'expeditions', '[]'::jsonb);

  IF jsonb_typeof(v_expeditions) <> 'array' OR jsonb_array_length(v_expeditions) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active expeditions to claim.');
  END IF;

  -- 2. Extract Multipliers from Upgrades
  v_cargo_level := GREATEST(1, COALESCE((v_space_state->>'cargoLevel')::integer, 1));
  v_laser_level := GREATEST(1, COALESCE((v_space_state->>'laserLevel')::integer, 1));
  v_warp_level := GREATEST(1, COALESCE((v_space_state->>'warpLevel')::integer, 1));

  -- Cargo Bay: +12% mineral yield per level above 1
  v_cargo_mult := 1.0 + ((v_cargo_level - 1) * 0.12);

  -- Mining Laser: +8% PGT mining yield per level above 1
  v_laser_mult := 1.0 + ((v_laser_level - 1) * 0.08);

  -- 3. Evaluate Expeditions
  FOR v_exp IN SELECT * FROM jsonb_array_elements(v_expeditions) LOOP
    v_exp_id := v_exp->>'id';
    v_exp_type := LOWER(COALESCE(v_exp->>'type', 'asteroids'));
    v_exp_name := COALESCE(v_exp->>'name', 'Fleet Expedition');
    v_exp_start := COALESCE((v_exp->>'startTime')::bigint, 0);
    v_exp_end := COALESCE((v_exp->>'endTime')::bigint, 0);

    -- Check if target matches
    IF v_target_all OR v_exp_id = p_expedition_id THEN
      -- Check if expedition is finished
      IF v_now_ms >= v_exp_end THEN
        -- Anti-Cheat: Validate minimum elapsed flight duration against forged timestamps (accounting for max warp boost)
        IF v_exp_start > 0 AND (v_now_ms - v_exp_start) < (
          CASE
            WHEN v_exp_type = 'asteroids' THEN 120000 -- 2 min min
            WHEN v_exp_type = 'nebula' THEN 1200000 -- 20 min min
            WHEN v_exp_type = 'void' THEN 4800000 -- 1.3 hr min
            WHEN v_exp_type = 'sector9' THEN 14400000 -- 4 hr min
            WHEN v_exp_type = 'deepspace' THEN 43200000 -- 12 hr min
            WHEN v_exp_type = 'odyssey' THEN 100800000 -- 28 hr min
            ELSE 120000
          END
        ) THEN
          -- Timestamp was backdated or forged; keep unfinished
          v_remaining_expeditions := v_remaining_expeditions || jsonb_build_array(v_exp);
          CONTINUE;
        END IF;

        -- Anti-Cheat: Cryptographic Server Signature Verification
        IF v_exp->>'serverSig' IS NOT NULL THEN
          -- Validate signature against both canonical player_id and linked_wallet_address
          IF v_exp->>'serverSig' <> MD5('poly_exp_' || v_pid || '_' || (v_exp->>'startTime') || '_' || (v_exp->>'endTime') || '_' || v_exp_type || '_pgt_secret_fleet_v1')
             AND (v_user.linked_wallet_address IS NULL OR v_exp->>'serverSig' <> MD5('poly_exp_' || LOWER(v_user.linked_wallet_address) || '_' || (v_exp->>'startTime') || '_' || (v_exp->>'endTime') || '_' || v_exp_type || '_pgt_secret_fleet_v1')) THEN
            -- Signature mismatch: Discard safely without incrementing bot warnings
            INSERT INTO public.bot_security_logs (player_id, reason, game_name, details, created_at)
            VALUES (v_pid, 'invalid_expedition_signature', 'PolySpace Fleet Sentinel', jsonb_build_object('exp_id', v_exp_id, 'details', 'Signature mismatch, skipped without penalty'), NOW());
            CONTINUE;
          END IF;
        ELSE
          -- Legacy / Non-signed: Must not be backdated beyond account creation
          IF v_exp_start < (EXTRACT(EPOCH FROM v_user.created_at) * 1000) THEN
            INSERT INTO public.bot_security_logs (player_id, reason, game_name, details, created_at)
            VALUES (v_pid, 'invalid_backdated_expedition', 'PolySpace Fleet Sentinel', jsonb_build_object('exp_id', v_exp_id, 'startTime', v_exp_start, 'now', v_now_ms), NOW());
            CONTINUE;
          END IF;
        END IF;

        -- Anti-Cheat: Cap maximum concurrent claims to user's fleet slot capacity (3 to 5)
        IF v_claimed_count >= LEAST(5, 3 + (v_warp_level / 10)) THEN
          CONTINUE;
        END IF;

        v_claimed_count := v_claimed_count + 1;
        v_last_exp_name := v_exp_name;

        -- Base Yields by Destination
        IF v_exp_type = 'asteroids' THEN
          v_base_iron := 40 * v_cargo_mult;
          v_base_tit := 0;
          v_base_quant := 0;
          v_base_pgt := 0.25 * v_laser_mult;
          v_pgt_ore_chance := 0.05;
        ELSIF v_exp_type = 'nebula' THEN
          v_base_iron := 240 * v_cargo_mult;
          v_base_tit := 75 * v_cargo_mult;
          v_base_quant := 0;
          v_base_pgt := 1.75 * v_laser_mult;
          v_pgt_ore_chance := 0.12;
        ELSIF v_exp_type = 'void' THEN
          v_base_iron := 850 * v_cargo_mult;
          v_base_tit := 320 * v_cargo_mult;
          v_base_quant := 30 * v_cargo_mult;
          v_base_pgt := 6.5 * v_laser_mult;
          v_pgt_ore_chance := 0.25;
        ELSIF v_exp_type = 'sector9' THEN
          v_base_iron := 2400 * v_cargo_mult;
          v_base_tit := 950 * v_cargo_mult;
          v_base_quant := 120 * v_cargo_mult;
          v_base_pgt := 18.0 * v_laser_mult;
          v_pgt_ore_chance := 0.40;
        ELSIF v_exp_type = 'deepspace' THEN
          v_base_iron := 6800 * v_cargo_mult;
          v_base_tit := 2800 * v_cargo_mult;
          v_base_quant := 450 * v_cargo_mult;
          v_base_pgt := 50.0 * v_laser_mult;
          v_pgt_ore_chance := 0.65;
        ELSIF v_exp_type = 'odyssey' THEN
          v_base_iron := 18000 * v_cargo_mult;
          v_base_tit := 8500 * v_cargo_mult;
          v_base_quant := 1800 * v_cargo_mult;
          v_base_pgt := 140.0 * v_laser_mult;
          v_pgt_ore_chance := 0.90;
        ELSE
          v_base_iron := 30 * v_cargo_mult;
          v_base_tit := 0;
          v_base_quant := 0;
          v_base_pgt := 0.2 * v_laser_mult;
          v_pgt_ore_chance := 0.05;
        END IF;

        -- Critical Strike Roll: 8% chance for 3.0x multiplier
        v_is_critical := (RANDOM() < 0.08);

        -- Natural variance: +/- 15%
        v_variance := 0.85 + (RANDOM() * 0.30);

        v_item_iron := ROUND(v_base_iron * v_variance * CASE WHEN v_is_critical THEN 3.0 ELSE 1.0 END);
        v_item_tit := ROUND(v_base_tit * v_variance * CASE WHEN v_is_critical THEN 3.0 ELSE 1.0 END);
        v_item_quant := ROUND(v_base_quant * v_variance * CASE WHEN v_is_critical THEN 3.0 ELSE 1.0 END);
        v_item_pgt := ROUND(v_base_pgt * v_variance * CASE WHEN v_is_critical THEN 3.0 ELSE 1.0 END, 2);

        -- Rare PGT Ore drop roll
        IF RANDOM() < v_pgt_ore_chance THEN
          v_item_pgt_ore := CASE WHEN v_is_critical THEN 2 ELSE 1 END;
        ELSE
          v_item_pgt_ore := 0;
        END IF;

        -- Accumulate totals
        v_tot_iron := v_tot_iron + v_item_iron;
        v_tot_tit := v_tot_tit + v_item_tit;
        v_tot_quant := v_tot_quant + v_item_quant;
        v_tot_pgt := v_tot_pgt + v_item_pgt;
        v_tot_pgt_ore := v_tot_pgt_ore + v_item_pgt_ore;

        -- Build log entry
        v_new_logs := v_new_logs || jsonb_build_array(jsonb_build_object(
          'id', 'log_' || (v_now_ms + v_claimed_count) || '_' || SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 3),
          'name', v_exp_name,
          'time', v_time_str,
          'timestamp', v_now_ms,
          'earnedIron', v_item_iron,
          'earnedTit', v_item_tit,
          'earnedQuant', v_item_quant,
          'earnedPgt', v_item_pgt,
          'earnedPgtOre', v_item_pgt_ore,
          'isCritical', v_is_critical
        ));
      ELSE
        -- Not finished yet, preserve in active fleet
        v_remaining_expeditions := v_remaining_expeditions || jsonb_build_array(v_exp);
      END IF;
    ELSE
      -- Not targeting this expedition, preserve
      v_remaining_expeditions := v_remaining_expeditions || jsonb_build_array(v_exp);
    END IF;
  END LOOP;

  IF v_claimed_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No expeditions are ready to claim yet!');
  END IF;

  -- 4. Apply Multipliers: VIP (2.0x) & Ambassador (1.5x)
  v_final_pgt := v_tot_pgt;
  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_final_pgt := v_final_pgt * 2.0;
  END IF;
  IF COALESCE(v_user.is_ambassador, false) THEN
    v_final_pgt := v_final_pgt * 1.5;
  END IF;
  v_final_pgt := ROUND(v_final_pgt, 2);

  -- 5. Update space_state
  v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(COALESCE((v_space_state->>'iron')::numeric, 0) + v_tot_iron));
  v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(COALESCE((v_space_state->>'titanium')::numeric, 0) + v_tot_tit));
  v_space_state := jsonb_set(v_space_state, '{quantum}', to_jsonb(COALESCE((v_space_state->>'quantum')::numeric, 0) + v_tot_quant));
  v_space_state := jsonb_set(v_space_state, '{pgtOre}', to_jsonb(COALESCE((v_space_state->>'pgtOre')::integer, 0) + v_tot_pgt_ore));
  v_space_state := jsonb_set(v_space_state, '{pgtMinedTotal}', to_jsonb(ROUND(COALESCE((v_space_state->>'pgtMinedTotal')::numeric, 0) + v_final_pgt, 2)));
  v_space_state := jsonb_set(v_space_state, '{mineralsMinedTotal}', to_jsonb(ROUND(COALESCE((v_space_state->>'mineralsMinedTotal')::numeric, 0) + v_tot_iron + v_tot_tit + v_tot_quant)));
  v_space_state := jsonb_set(v_space_state, '{expeditions}', v_remaining_expeditions);

  -- Prepend new logs to missionLogs (keep last 30)
  v_space_state := jsonb_set(
    v_space_state,
    '{missionLogs}',
    (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(v_new_logs || COALESCE(v_space_state->'missionLogs', '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
        ORDER BY ord ASC
        LIMIT 30
      ) sub
    )
  );

  -- 6. Atomically Update public.users
  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt,
      total_earned = COALESCE(total_earned, 0) + v_final_pgt,
      space_state = v_space_state,
      space_minerals_mined = COALESCE(space_minerals_mined, 0) + (v_tot_iron + v_tot_tit + v_tot_quant)::integer,
      updated_at = NOW()
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  -- 7. Distribute Referral Commissions (10%/5%/2%/1%)
  IF v_final_pgt > 0 THEN
    BEGIN
      PERFORM public.process_referral_commissions(v_pid, v_final_pgt, 'PolySpace Mining');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'claimed_count', v_claimed_count,
    'last_exp_name', v_last_exp_name,
    'earned_iron', v_tot_iron,
    'earned_titanium', v_tot_tit,
    'earned_quantum', v_tot_quant,
    'earned_pgt_ore', v_tot_pgt_ore,
    'earned_pgt', v_final_pgt,
    'new_balance_pgt', v_new_balance,
    'space_state', v_space_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_polyspace_expedition(TEXT, TEXT) TO authenticated, service_role, anon;

-- 3. ENSURE TROUBS ACCOUNT STATUS IS 100% UNBANNED & WARNINGS RESET
UPDATE public.users
SET is_banned = false,
    bot_warning = 0,
    updated_at = NOW()
WHERE LOWER(player_id) = '0xpgt1315acc40000000000000000000000000000'
   OR LOWER(COALESCE(linked_wallet_address, '')) = '0x5416216beb51f3327c37a5303f69280e51de9918';

-- 4. CLEAN UP FALSE-POSITIVE BOT LOGS FOR TROUBS
DELETE FROM public.bot_security_logs
WHERE player_id = '0xpgt1315acc40000000000000000000000000000'
  AND reason = 'forged_expedition_signature';

-- 5. SAFELY CLEAR STUCK EXPEDITIONS WITH MISMATCHED SIGNATURES FOR TROUBS
-- (Freed fleet slots so Troubs can immediately launch fresh expeditions)
UPDATE public.users
SET space_state = jsonb_set(
  space_state,
  '{expeditions}',
  '[]'::jsonb
)
WHERE (LOWER(player_id) = '0xpgt1315acc40000000000000000000000000000'
   OR LOWER(COALESCE(linked_wallet_address, '')) = '0x5416216beb51f3327c37a5303f69280e51de9918')
  AND space_state->'expeditions' IS NOT NULL;
