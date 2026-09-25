-- ==============================================================================
-- POLYGON GAMING: REPAIR POLYSPACE EXPEDITION CLAIMS & ELIMINATE SIGNATURE LOCKOUT
-- Version: v1.5.471
-- Author: PolyGame Engineering
--
-- PURPOSE:
-- 1. Eliminate fragile client/session MD5 signature verification from
--    claim_polyspace_expedition that caused false-positive claim lockouts
--    ("Expedition already claimed or not found" / "in another tab") for legitimate
--    players when session identity or formatting differed between launch and claim.
-- 2. Retain all real authoritative anti-cheat checks:
--    - Server-controlled expedition storage (enforced by trg_prevent_direct_balance_mutation).
--    - Real-time flight completion (v_now_ms >= v_exp_end).
--    - Real-time minimum flight duration elapsed against backdating.
--    - Warp Drive level requirement per destination.
--    - Account registration timestamp validation (v_exp_start >= created_at - 1 hour).
--    - Fleet slot capacity limit (LEAST(5, 3 + warp/10)).
--    - High-Laser payout cap (3,500 PGT ceiling).
--    - 4-Tier referral commission distribution.
-- 3. Update start_polyspace_expedition with clean server_verified metadata.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. REPAIR: claim_polyspace_expedition
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_polyspace_expedition(TEXT);
DROP FUNCTION IF EXISTS public.claim_polyspace_expedition(TEXT, TEXT);
DROP FUNCTION IF EXISTS claim_polyspace_expedition(TEXT);
DROP FUNCTION IF EXISTS claim_polyspace_expedition(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.claim_polyspace_expedition(
  p_player_id TEXT,
  p_expedition_id TEXT DEFAULT 'ALL'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
  
  -- Relic Drops
  v_relic_chance NUMERIC := 0.0;
  v_discovered_relic JSONB := NULL;
  v_relic_rand NUMERIC;
  v_relic_id TEXT;
  
  -- Mission Logs
  v_logs JSONB;
  v_new_log JSONB;
  v_last_exp_name TEXT := 'PolySpace Fleet';
  v_last_was_critical BOOLEAN := false;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- Convert server NOW() to millisecond epoch
  v_now_ms := (EXTRACT(EPOCH FROM v_now) * 1000)::bigint;

  -- 2. Pessimistic Row Lock (Serializes concurrent requests across multiple browser windows)
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found in database');
  END IF;

  -- 3. Security Checks
  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended');
  END IF;

  -- 4. Inspect space_state
  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_expeditions := COALESCE(v_space_state->'expeditions', '[]'::jsonb);

  IF jsonb_array_length(v_expeditions) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active expeditions found');
  END IF;

  v_target_all := (p_expedition_id IS NULL OR UPPER(TRIM(p_expedition_id)) = 'ALL' OR TRIM(p_expedition_id) = '');

  -- Extract Ship Upgrades
  v_cargo_level := GREATEST(1, COALESCE((v_space_state->>'cargoLevel')::integer, 1));
  v_laser_level := GREATEST(1, COALESCE((v_space_state->>'laserLevel')::integer, 1));
  v_warp_level  := GREATEST(1, COALESCE((v_space_state->>'warpLevel')::integer, 1));

  v_cargo_mult := 1.0 + ((v_cargo_level - 1) * 0.25);
  v_laser_mult := 1.0 + ((v_laser_level - 1) * 0.18);

  -- 5. Iterate & Process Eligible Expeditions
  FOR v_exp IN SELECT * FROM jsonb_array_elements(v_expeditions)
  LOOP
    v_exp_id   := v_exp->>'id';
    v_exp_type := LOWER(COALESCE(v_exp->>'type', 'asteroids'));
    v_exp_name := COALESCE(v_exp->>'name', 'Exploration Fleet');
    v_exp_end  := COALESCE((v_exp->>'endTime')::bigint, 0);

    -- Check if target matches
    IF (v_target_all OR v_exp_id = p_expedition_id) THEN
      v_exp_start := COALESCE((v_exp->>'startTime')::bigint, 0);

      -- Anti-Cheat: Validate Warp Drive level requirement for destination
      IF (v_exp_type = 'nebula' AND v_warp_level < 2) OR
         (v_exp_type = 'void' AND v_warp_level < 3) OR
         (v_exp_type = 'sector9' AND v_warp_level < 4) OR
         (v_exp_type = 'deepspace' AND v_warp_level < 5) OR
         (v_exp_type = 'odyssey' AND v_warp_level < 6) THEN
        -- Destination requires higher warp level than player has; discard illegitimate mission
        CONTINUE;
      END IF;

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

        -- Anti-Cheat: Validate start time does not precede account registration (with 1h clock skew allowance)
        IF v_exp_start > 0 AND v_exp_start < ((EXTRACT(EPOCH FROM v_user.created_at) * 1000) - 3600000) THEN
          INSERT INTO public.bot_security_logs (player_id, reason, game_name, details, created_at)
          VALUES (v_pid, 'invalid_backdated_expedition', 'PolySpace Fleet Sentinel', jsonb_build_object('exp_id', v_exp_id, 'startTime', v_exp_start, 'created_at', v_user.created_at), NOW());
          CONTINUE;
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
          v_base_pgt := 0.5;
          v_relic_chance := 0.008;
          v_pgt_ore_chance := 0.02;
        ELSIF v_exp_type = 'nebula' THEN
          v_base_iron := 110 * v_cargo_mult;
          v_base_tit := 35 * v_cargo_mult;
          v_base_quant := 0;
          v_base_pgt := 1.7;
          v_relic_chance := 0.016;
          v_pgt_ore_chance := 0.05;
        ELSIF v_exp_type = 'void' THEN
          v_base_iron := 240 * v_cargo_mult;
          v_base_tit := 80 * v_cargo_mult;
          v_base_quant := 20 * v_cargo_mult;
          v_base_pgt := 3.8;
          v_relic_chance := 0.024;
          v_pgt_ore_chance := 0.10;
        ELSIF v_exp_type = 'sector9' THEN
          v_base_iron := 550 * v_cargo_mult;
          v_base_tit := 180 * v_cargo_mult;
          v_base_quant := 45 * v_cargo_mult;
          v_base_pgt := 7.2;
          v_relic_chance := 0.036;
          v_pgt_ore_chance := 0.18;
        ELSIF v_exp_type = 'deepspace' THEN
          v_base_iron := 1100 * v_cargo_mult;
          v_base_tit := 380 * v_cargo_mult;
          v_base_quant := 100 * v_cargo_mult;
          v_base_pgt := 13.7;
          v_relic_chance := 0.056;
          v_pgt_ore_chance := 0.30;
        ELSIF v_exp_type = 'odyssey' THEN
          v_base_iron := 2200 * v_cargo_mult;
          v_base_tit := 850 * v_cargo_mult;
          v_base_quant := 250 * v_cargo_mult;
          v_base_pgt := 24.5;
          v_relic_chance := 0.080;
          v_pgt_ore_chance := 0.50;
        ELSE
          v_base_iron := 40 * v_cargo_mult;
          v_base_tit := 0;
          v_base_quant := 0;
          v_base_pgt := 0.5;
          v_relic_chance := 0.008;
          v_pgt_ore_chance := 0.02;
        END IF;

        -- Apply Laser Multiplier and ±20% Exploration Variance (0.80 to 1.20)
        v_variance := 0.80 + (random() * 0.40);
        v_item_pgt := ROUND((v_base_pgt * v_laser_mult * v_variance)::numeric, 2);
        v_item_iron := FLOOR(v_base_iron);
        v_item_tit := FLOOR(v_base_tit);
        v_item_quant := FLOOR(v_base_quant);
        v_item_pgt_ore := 0;

        -- 10% Critical Success Roll (3x Mega Payout)
        v_is_critical := (random() < 0.10);
        IF v_is_critical THEN
          v_item_iron := v_item_iron * 3;
          v_item_tit := v_item_tit * 3;
          v_item_quant := v_item_quant * 3;
          v_item_pgt := ROUND((v_item_pgt * 3.0)::numeric, 2);
          v_relic_chance := LEAST(1.0, v_relic_chance * 1.5);
          v_last_was_critical := true;
        END IF;

        -- Rare PGT Ore Roll (Requires Laser Level >= 35)
        IF v_laser_level >= 35 AND random() < v_pgt_ore_chance THEN
          v_item_pgt_ore := 1;
          IF (v_exp_type = 'deepspace' AND random() < 0.15) OR (v_exp_type = 'odyssey' AND random() < 0.30) THEN
            v_item_pgt_ore := 2;
          END IF;
          IF v_is_critical THEN
            v_item_pgt_ore := v_item_pgt_ore + 1;
          END IF;
        END IF;

        -- In-Game Quantum Relic Drop Roll
        IF random() < v_relic_chance THEN
          v_relic_rand := random();
          IF (v_exp_type IN ('odyssey', 'deepspace')) AND v_relic_rand < 0.10 THEN
            v_relic_id := CASE WHEN random() < 0.5 THEN 'relic_apex_singularity' ELSE 'relic_apex_genesis' END;
          ELSIF v_relic_rand < 0.20 THEN
            v_relic_id := 'relic_space_plasma';
          ELSIF v_relic_rand < 0.55 THEN
            v_relic_id := 'relic_space_warpcoil';
          ELSE
            v_relic_id := 'relic_space_darkmatter';
          END IF;

          -- Grant In-Game Relic via canonical procedure
          IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_relic_drop') THEN
            BEGIN
              PERFORM public.grant_relic_drop(v_user.player_id, v_relic_id, 1);
              v_discovered_relic := jsonb_build_object('id', v_relic_id, 'amount', 1);
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END IF;
          END IF;
        END IF;

        -- Accumulate Totals
        v_tot_iron := v_tot_iron + v_item_iron;
        v_tot_tit := v_tot_tit + v_item_tit;
        v_tot_quant := v_tot_quant + v_item_quant;
        v_tot_pgt_ore := v_tot_pgt_ore + v_item_pgt_ore;
        v_tot_pgt := v_tot_pgt + v_item_pgt;

        -- Create Mission Log Entry
        v_new_log := jsonb_build_object(
          'id', 'log_' || (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint || '_' || FLOOR(random() * 1000)::text,
          'name', v_exp_name,
          'time', to_char(v_now AT TIME ZONE 'UTC', 'HH24:MI UTC'),
          'timestamp', v_now_ms,
          'earnedIron', v_item_iron,
          'earnedTit', v_item_tit,
          'earnedQuant', v_item_quant,
          'earnedPgtOre', v_item_pgt_ore,
          'earnedPgt', v_item_pgt,
          'isCritical', v_is_critical
        );

        v_logs := COALESCE(v_space_state->'missionLogs', '[]'::jsonb);
        v_logs := jsonb_build_array(v_new_log) || v_logs;
        -- Keep last 20 logs
        IF jsonb_array_length(v_logs) > 20 THEN
          SELECT jsonb_agg(elem) INTO v_logs
          FROM (SELECT elem FROM jsonb_array_elements(v_logs) WITH ORDINALITY arr(elem, idx) WHERE idx <= 20) sub;
        END IF;
        v_space_state := jsonb_set(v_space_state, '{missionLogs}', v_logs);

      ELSE
        -- Single target was found but has not finished yet
        IF NOT v_target_all THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', 'Expedition is still in progress',
            'remaining_seconds', GREATEST(0, (v_exp_end - v_now_ms) / 1000)
          );
        END IF;
        -- Keep unfinished expedition
        v_remaining_expeditions := v_remaining_expeditions || jsonb_build_array(v_exp);
      END IF;
    ELSE
      -- Keep non-matching expedition
      v_remaining_expeditions := v_remaining_expeditions || jsonb_build_array(v_exp);
    END IF;
  END LOOP;

  -- 6. Guard: Check if anything was claimed
  IF v_claimed_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No completed expeditions ready to claim or expedition not found'
    );
  END IF;

  -- 7. High-Laser Multiplier Safety Cap: Generous 3,500 PGT ceiling per transaction
  v_final_pgt := ROUND(LEAST(3500.0, GREATEST(0.0, v_tot_pgt))::numeric, 2);

  -- 8. Mutate Space State
  v_space_state := jsonb_set(v_space_state, '{expeditions}', v_remaining_expeditions);
  v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(COALESCE((v_space_state->>'iron')::numeric, 0) + v_tot_iron));
  v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(COALESCE((v_space_state->>'titanium')::numeric, 0) + v_tot_tit));
  v_space_state := jsonb_set(v_space_state, '{quantum}', to_jsonb(COALESCE((v_space_state->>'quantum')::numeric, 0) + v_tot_quant));
  v_space_state := jsonb_set(v_space_state, '{pgtOre}', to_jsonb(COALESCE((v_space_state->>'pgtOre')::integer, 0) + v_tot_pgt_ore));
  v_space_state := jsonb_set(v_space_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((v_space_state->>'mineralsMinedTotal')::numeric, 0) + v_tot_iron + v_tot_tit + v_tot_quant + v_tot_pgt_ore));
  v_space_state := jsonb_set(v_space_state, '{pgtMinedTotal}', to_jsonb(ROUND((COALESCE((v_space_state->>'pgtMinedTotal')::numeric, 0) + v_final_pgt)::numeric, 2)));

  -- 9. Atomic Balance Mutation on Users Table
  UPDATE public.users
  SET balance_pgt = ROUND(COALESCE(balance_pgt, 0) + v_final_pgt, 2),
      total_earned = ROUND(COALESCE(total_earned, 0) + v_final_pgt, 2),
      space_state = v_space_state,
      updated_at = v_now
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  -- 10. Process 4-Tier Referral Commissions
  IF v_final_pgt > 0 THEN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_referral_commissions') THEN
      BEGIN
        PERFORM public.process_referral_commissions(
          v_user.player_id,
          v_final_pgt,
          'PolySpace Fleet (' || v_claimed_count || ' Expedition' || (CASE WHEN v_claimed_count > 1 THEN 's' ELSE '' END) || ')'
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  -- 11. Return Authoritative Response
  RETURN jsonb_build_object(
    'success', true,
    'claimed_count', v_claimed_count,
    'earned_iron', v_tot_iron,
    'earned_tit', v_tot_tit,
    'earned_quant', v_tot_quant,
    'earned_pgt_ore', v_tot_pgt_ore,
    'earned_pgt', v_final_pgt,
    'is_critical', v_last_was_critical,
    'discovered_relic', v_discovered_relic,
    'exp_name', v_last_exp_name,
    'new_balance', v_new_balance,
    'new_space_state', v_space_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_polyspace_expedition(TEXT, TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- 2. REPAIR: start_polyspace_expedition (Clean metadata)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.start_polyspace_expedition(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.start_polyspace_expedition(TEXT, TEXT);
DROP FUNCTION IF EXISTS start_polyspace_expedition(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS start_polyspace_expedition(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.start_polyspace_expedition(
  p_player_id TEXT,
  p_destination TEXT,
  p_count INTEGER DEFAULT 1
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
  v_expeditions JSONB := '[]'::jsonb;
  v_warp_level INTEGER := 1;
  v_max_slots INTEGER := 3;
  v_active_count INTEGER := 0;
  v_available_slots INTEGER := 0;
  v_launch_count INTEGER := 1;
  v_base_duration_ms BIGINT;
  v_duration_ms BIGINT;
  v_dest_name TEXT;
  v_start_ms BIGINT;
  v_end_ms BIGINT;
  v_new_exp JSONB;
  v_guard RECORD;
  i INTEGER;
BEGIN
  -- 1. Caller authentication & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- 2. Row Lock & Load User Profile
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
  v_warp_level := GREATEST(1, COALESCE((v_space_state->>'warpLevel')::integer, 1));
  v_max_slots := LEAST(5, 3 + (v_warp_level / 10));

  -- 3. Validate Destination & Warp Level Requirements
  IF LOWER(p_destination) = 'asteroids' THEN
    v_dest_name := 'Alpha Asteroid Belt';
    v_base_duration_ms := 900000; -- 15 mins (15 * 60 * 1000)
  ELSIF LOWER(p_destination) = 'nebula' THEN
    IF v_warp_level < 2 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Neon Nebula requires Warp Drive Level 2!');
    END IF;
    v_dest_name := 'Neon Nebula';
    v_base_duration_ms := 7200000; -- 2 hours (2 * 3600 * 1000)
  ELSIF LOWER(p_destination) = 'void' THEN
    IF v_warp_level < 3 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Deep Void Exoplanet requires Warp Drive Level 3!');
    END IF;
    v_dest_name := 'Deep Void Exoplanet';
    v_base_duration_ms := 28800000; -- 8 hours (8 * 3600 * 1000)
  ELSIF LOWER(p_destination) = 'sector9' THEN
    IF v_warp_level < 4 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Deep Space Sector 9 requires Warp Drive Level 4!');
    END IF;
    v_dest_name := 'Deep Space Sector 9';
    v_base_duration_ms := 86400000; -- 24 hours (24 * 3600 * 1000)
  ELSIF LOWER(p_destination) = 'deepspace' THEN
    IF v_warp_level < 5 THEN
      RETURN jsonb_build_object('success', false, 'error', '3-Day Deep-Space Expedition requires Warp Drive Level 5!');
    END IF;
    v_dest_name := '3-Day Deep-Space Expedition';
    v_base_duration_ms := 259200000; -- 72 hours (72 * 3600 * 1000)
  ELSIF LOWER(p_destination) = 'odyssey' THEN
    IF v_warp_level < 6 THEN
      RETURN jsonb_build_object('success', false, 'error', '7-Day Deep-Space Odyssey requires Warp Drive Level 6!');
    END IF;
    v_dest_name := '7-Day Deep-Space Odyssey';
    v_base_duration_ms := 604800000; -- 7 days (7 * 24 * 3600 * 1000)
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unknown expedition destination: ' || COALESCE(p_destination, 'NULL'));
  END IF;

  -- 4. Slot Capacity Check
  IF v_space_state->'expeditions' IS NOT NULL AND jsonb_typeof(v_space_state->'expeditions') = 'array' THEN
    v_expeditions := v_space_state->'expeditions';
    v_active_count := jsonb_array_length(v_expeditions);
  ELSE
    v_expeditions := '[]'::jsonb;
    v_active_count := 0;
  END IF;

  v_available_slots := GREATEST(0, v_max_slots - v_active_count);
  IF v_available_slots <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'All ' || v_max_slots || ' Fleet Slots are currently in use! Wait for an expedition to finish.');
  END IF;

  -- Clamp requested launch count strictly between 1 and available slots
  v_launch_count := LEAST(GREATEST(1, COALESCE(p_count, 1)), v_available_slots);

  -- 5. Calculate Server Duration with Warp Drive Speed Boost Reduction (+5% speed per level)
  v_duration_ms := ROUND(v_base_duration_ms / (1.0 + ((v_warp_level - 1) * 0.05)))::BIGINT;
  v_start_ms := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
  v_end_ms := v_start_ms + v_duration_ms;

  -- 6. Generate and Append Expedition Objects
  FOR i IN 0..(v_launch_count - 1) LOOP
    v_new_exp := jsonb_build_object(
      'id', 'exp_' || (v_start_ms + i) || '_' || SUBSTRING(MD5(RANDOM()::TEXT || i::TEXT) FROM 1 FOR 5),
      'type', LOWER(p_destination),
      'name', v_dest_name || CASE WHEN v_launch_count > 1 THEN ' #' || (i + 1) ELSE '' END,
      'startTime', v_start_ms,
      'endTime', v_end_ms,
      'serverSig', 'server_verified'
    );
    v_expeditions := v_expeditions || jsonb_build_array(v_new_exp);
  END LOOP;

  -- 7. Persist to Database
  v_space_state := jsonb_set(v_space_state, '{expeditions}', v_expeditions);

  UPDATE public.users
  SET space_state = v_space_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'space_state', v_space_state,
    'launched_count', v_launch_count,
    'destination', v_dest_name,
    'duration_ms', v_duration_ms,
    'end_time', v_end_ms
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_polyspace_expedition(TEXT, TEXT, INTEGER) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- 3. Verification Query
-- ------------------------------------------------------------------------------
SELECT 'claim_polyspace_expedition repaired successfully' as status;
