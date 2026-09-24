-- ==============================================================================
-- POLYGON GAMING EMERGENCY REPAIR: UNBAN THEO & RESTORE POLYSPACE EXPEDITIONS
-- Issues Resolved:
--   1. An over-aggressive 8-day age clamp in claim_polyspace_expedition erroneously
--      flagged Theo's legitimate 14-day-old completed Odyssey missions as forged,
--      logging 5 false-positive bot warnings and auto-suspending his account.
--   2. Deprecating save_polyspace_state caused space.js to fall back to a direct
--      PostgREST update on public.users, throwing a 403 Forbidden error.
--
-- Actions:
--   1. Instantly unban Theo (0xpgt461a068f0bd48378c8f93a4eadb77152) and reset bot_warning to 0.
--   2. Clean up false-positive forged_backdated_expedition logs.
--   3. Upgrade claim_polyspace_expedition: Remove false-positive 8-day clamp,
--      allowing legitimate long/completed Odyssey missions to be claimed.
--   4. Upgrade save_polyspace_state: Strip client-injected expeditions/minerals
--      while returning success: true so space.js never throws 403 Forbidden.
--   5. Maintain Dobby's permanent ban & zeroed balance.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: Unban Theo & Clear False-Positive Security Incident Logs
-- ------------------------------------------------------------------------------
UPDATE public.users
SET 
  is_banned = false,
  bot_warning = 0,
  updated_at = NOW()
WHERE player_id = '0xpgt461a068f0bd48378c8f93a4eadb77152'
   OR LOWER(COALESCE(linked_wallet_address, '')) = '0x3c9722d2026ac1d2db9598898adcc48c056dfa9e';

DELETE FROM public.bot_security_logs
WHERE player_id = '0xpgt461a068f0bd48378c8f93a4eadb77152'
  AND reason = 'forged_backdated_expedition';

-- ------------------------------------------------------------------------------
-- STEP 2: Upgrade claim_polyspace_expedition (Fixes False-Positive 8-Day Age Clamp)
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

  v_now_ms := (EXTRACT(EPOCH FROM v_now) * 1000)::bigint;

  -- Pessimistic Row Lock
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found in database');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended');
  END IF;

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

  -- Process Eligible Expeditions
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
        CONTINUE;
      END IF;

      -- Check if expedition is finished
      IF v_now_ms >= v_exp_end THEN
        -- Anti-Cheat: Validate minimum elapsed flight duration against forged timestamps
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
          v_remaining_expeditions := v_remaining_expeditions || jsonb_build_array(v_exp);
          CONTINUE;
        END IF;

        -- Anti-Cheat: Cryptographic Server Signature Verification
        IF v_exp->>'serverSig' IS NOT NULL THEN
          IF v_exp->>'serverSig' <> MD5('poly_exp_' || v_pid || '_' || (v_exp->>'startTime') || '_' || (v_exp->>'endTime') || '_' || v_exp_type || '_pgt_secret_fleet_v1') THEN
            PERFORM public.record_bot_warning(
              v_pid,
              'forged_expedition_signature',
              'PolySpace Fleet Sentinel',
              jsonb_build_object('exp_id', v_exp_id, 'details', 'HMAC signature mismatch')
            );
            CONTINUE;
          END IF;
        ELSE
          -- Legacy / Non-signed: Must not precede user account registration
          IF v_exp_start < (EXTRACT(EPOCH FROM v_user.created_at) * 1000) THEN
            PERFORM public.record_bot_warning(
              v_pid,
              'forged_backdated_expedition',
              'PolySpace Fleet Sentinel',
              jsonb_build_object('exp_id', v_exp_id, 'startTime', v_exp_start, 'now', v_now_ms)
            );
            CONTINUE;
          END IF;
        END IF;

        -- Cap maximum concurrent claims to user's fleet slot capacity (3 to 5)
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
          v_pgt_ore_chance := 0.15;
        ELSIF v_exp_type = 'deepspace' THEN
          v_base_iron := 1500 * v_cargo_mult;
          v_base_tit := 550 * v_cargo_mult;
          v_base_quant := 140 * v_cargo_mult;
          v_base_pgt := 18.5;
          v_relic_chance := 0.055;
          v_pgt_ore_chance := 0.25;
        ELSIF v_exp_type = 'odyssey' THEN
          v_base_iron := 3300 * v_cargo_mult;
          v_base_tit := 1300 * v_cargo_mult;
          v_base_quant := 400 * v_cargo_mult;
          v_base_pgt := 45.0;
          v_relic_chance := 0.10;
          v_pgt_ore_chance := 0.45;
        ELSE
          v_base_iron := 30 * v_cargo_mult;
          v_base_tit := 0;
          v_base_quant := 0;
          v_base_pgt := 0.5;
          v_relic_chance := 0.005;
          v_pgt_ore_chance := 0.01;
        END IF;

        -- Critical Expedition Chance (Laser drill precision: 5% base + 1% per laser level)
        v_is_critical := (random() < (0.05 + (v_laser_level * 0.01)));
        IF v_is_critical THEN
          v_last_was_critical := true;
        END IF;

        -- Yield Variance (+/- 15%)
        v_variance := 0.85 + (random() * 0.30);
        v_item_iron := ROUND(v_base_iron * v_variance * CASE WHEN v_is_critical THEN 1.5 ELSE 1.0 END);
        v_item_tit := ROUND(v_base_tit * v_variance * CASE WHEN v_is_critical THEN 1.5 ELSE 1.0 END);
        v_item_quant := ROUND(v_base_quant * v_variance * CASE WHEN v_is_critical THEN 1.5 ELSE 1.0 END);
        v_item_pgt := ROUND((v_base_pgt * v_laser_mult * v_variance * CASE WHEN v_is_critical THEN 1.5 ELSE 1.0 END)::numeric, 2);

        -- Rare PGT Ore Drop Roll
        IF random() < (v_pgt_ore_chance * CASE WHEN v_is_critical THEN 1.5 ELSE 1.0 END) THEN
          v_item_pgt_ore := 1;
        ELSE
          v_item_pgt_ore := 0;
        END IF;

        -- Relic Discovery Roll
        IF v_discovered_relic IS NULL AND random() < v_relic_chance THEN
          v_relic_rand := random();
          IF v_relic_rand < 0.40 THEN
            v_relic_id := 'quantum_core';
          ELSIF v_relic_rand < 0.70 THEN
            v_relic_id := 'void_crystal';
          ELSIF v_relic_rand < 0.90 THEN
            v_relic_id := 'ancient_starmap';
          ELSIF v_relic_rand < 0.98 THEN
            v_relic_id := 'chronos_gear';
          ELSE
            v_relic_id := 'hyperdrive_matrix';
          END IF;
          v_discovered_relic := jsonb_build_object(
            'id', v_relic_id,
            'name', REPLACE(INITCAP(REPLACE(v_relic_id, '_', ' ')), 'Pgt', 'PGT'),
            'discovered_at', to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          );
        END IF;

        -- Accumulate
        v_tot_iron := v_tot_iron + v_item_iron;
        v_tot_tit := v_tot_tit + v_item_tit;
        v_tot_quant := v_tot_quant + v_item_quant;
        v_tot_pgt := v_tot_pgt + v_item_pgt;
        v_tot_pgt_ore := v_tot_pgt_ore + v_item_pgt_ore;

      ELSE
        -- Expedition still flying
        v_remaining_expeditions := v_remaining_expeditions || jsonb_build_array(v_exp);
      END IF;
    ELSE
      -- Target did not match; retain
      v_remaining_expeditions := v_remaining_expeditions || jsonb_build_array(v_exp);
    END IF;
  END LOOP;

  IF v_claimed_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No expeditions are ready to claim yet');
  END IF;

  -- Apply VIP Bonus Multiplier (2.0x)
  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_final_pgt := ROUND((v_tot_pgt * 2.0)::numeric, 2);
  ELSE
    v_final_pgt := v_tot_pgt;
  END IF;

  -- Update Space Minerals & Expeditions
  v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(COALESCE((v_space_state->>'iron')::numeric, 0) + v_tot_iron));
  v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(COALESCE((v_space_state->>'titanium')::numeric, 0) + v_tot_tit));
  v_space_state := jsonb_set(v_space_state, '{quantum}', to_jsonb(COALESCE((v_space_state->>'quantum')::numeric, 0) + v_tot_quant));
  v_space_state := jsonb_set(v_space_state, '{pgtOre}', to_jsonb(COALESCE((v_space_state->>'pgtOre')::integer, 0) + v_tot_pgt_ore));
  v_space_state := jsonb_set(v_space_state, '{pgtMinedTotal}', to_jsonb(COALESCE((v_space_state->>'pgtMinedTotal')::numeric, 0) + v_final_pgt));
  v_space_state := jsonb_set(v_space_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((v_space_state->>'mineralsMinedTotal')::numeric, 0) + v_tot_iron + v_tot_tit + v_tot_quant));
  v_space_state := jsonb_set(v_space_state, '{expeditions}', v_remaining_expeditions);

  -- Append to Mission Logs
  v_logs := COALESCE(v_space_state->'missionLogs', '[]'::jsonb);
  v_new_log := jsonb_build_object(
    'title', 'Expedition Returned',
    'time', to_char(v_now AT TIME ZONE 'UTC', 'HH24:MI "UTC"'),
    'timestamp', v_now_ms,
    'desc', v_last_exp_name || ' safely docked. Harvested resources added to station vault.',
    'earnedPgt', v_final_pgt,
    'earnedIron', v_tot_iron,
    'earnedTitanium', v_tot_tit,
    'earnedQuantum', v_tot_quant,
    'critical', v_last_was_critical
  );
  v_logs := jsonb_build_array(v_new_log) || v_logs;
  IF jsonb_array_length(v_logs) > 20 THEN
    SELECT jsonb_agg(elem) INTO v_logs
    FROM (
      SELECT elem FROM jsonb_array_elements(v_logs) WITH ORDINALITY arr(elem, idx)
      WHERE idx <= 20
    ) sub;
  END IF;
  v_space_state := jsonb_set(v_space_state, '{missionLogs}', v_logs);

  -- Credit PGT Balance
  v_new_balance := COALESCE(v_user.balance_pgt, 0) + v_final_pgt;

  UPDATE public.users
  SET balance_pgt = v_new_balance,
      total_earned = COALESCE(total_earned, 0) + v_final_pgt,
      space_state = v_space_state,
      updated_at = v_now
  WHERE player_id = v_user.player_id;

  -- Add Discovered Relic to Inventory
  IF v_discovered_relic IS NOT NULL THEN
    BEGIN
      PERFORM public.add_discovered_relic(v_user.player_id, v_discovered_relic->>'id', v_discovered_relic->>'name');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'claimed_count', v_claimed_count,
    'earned_iron', v_tot_iron,
    'earned_titanium', v_tot_tit,
    'earned_quantum', v_tot_quant,
    'earned_pgt_ore', v_tot_pgt_ore,
    'earned_pgt', v_final_pgt,
    'discovered_relic', v_discovered_relic,
    'new_balance', v_new_balance,
    'new_space_state', v_space_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_polyspace_expedition(TEXT, TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- STEP 3: Upgrade save_polyspace_state (Preserves Expeditions, Never 403s)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.save_polyspace_state(TEXT, JSONB);
DROP FUNCTION IF EXISTS save_polyspace_state(TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.save_polyspace_state(
  p_player_id TEXT,
  p_space_state JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_current_state JSONB;
  v_merged_state JSONB;
  v_guard RECORD;
BEGIN
  -- 1. Caller authentication & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  IF p_space_state IS NULL OR jsonb_typeof(p_space_state) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid space_state object.');
  END IF;

  -- 2. Lock & Load User Profile
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

  v_current_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_merged_state := v_current_state || p_space_state;

  -- CRITICAL ANTI-CHEAT: Never allow client to overwrite or inject expeditions!
  -- Expeditions must strictly be managed via start_polyspace_expedition & claim_polyspace_expedition
  v_merged_state := jsonb_set(v_merged_state, '{expeditions}', COALESCE(v_current_state->'expeditions', '[]'::jsonb));

  -- Anti-tamper clamps: Module levels cannot increase without upgrade_polyspace_module RPC
  v_merged_state := jsonb_set(v_merged_state, '{warpLevel}', to_jsonb(COALESCE((v_current_state->>'warpLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{laserLevel}', to_jsonb(COALESCE((v_current_state->>'laserLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{cargoLevel}', to_jsonb(COALESCE((v_current_state->>'cargoLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{shieldLevel}', to_jsonb(COALESCE((v_current_state->>'shieldLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{turretLevel}', to_jsonb(COALESCE((v_current_state->>'turretLevel')::integer, 1)));

  -- Space Minerals cannot increase without server claims
  v_merged_state := jsonb_set(v_merged_state, '{iron}', to_jsonb(LEAST(COALESCE((v_merged_state->>'iron')::numeric, 0), COALESCE((v_current_state->>'iron')::numeric, 0))));
  v_merged_state := jsonb_set(v_merged_state, '{titanium}', to_jsonb(LEAST(COALESCE((v_merged_state->>'titanium')::numeric, 0), COALESCE((v_current_state->>'titanium')::numeric, 0))));
  v_merged_state := jsonb_set(v_merged_state, '{quantum}', to_jsonb(LEAST(COALESCE((v_merged_state->>'quantum')::numeric, 0), COALESCE((v_current_state->>'quantum')::numeric, 0))));
  v_merged_state := jsonb_set(v_merged_state, '{pgtOre}', to_jsonb(LEAST(COALESCE((v_merged_state->>'pgtOre')::numeric, 0), COALESCE((v_current_state->>'pgtOre')::numeric, 0))));
  v_merged_state := jsonb_set(v_merged_state, '{pgtMinedTotal}', to_jsonb(COALESCE((v_current_state->>'pgtMinedTotal')::numeric, 0)));

  -- Fleet Power recalculation
  v_merged_state := jsonb_set(
    v_merged_state,
    '{fleetPower}',
    to_jsonb(
      (GREATEST(1, COALESCE((v_merged_state->>'warpLevel')::integer, 1)) * 100) +
      (GREATEST(1, COALESCE((v_merged_state->>'laserLevel')::integer, 1)) * 80) +
      (GREATEST(1, COALESCE((v_merged_state->>'cargoLevel')::integer, 1)) * 50) +
      (GREATEST(1, COALESCE((v_merged_state->>'shieldLevel')::integer, 1)) * 60) +
      (GREATEST(1, COALESCE((v_merged_state->>'turretLevel')::integer, 1)) * 90)
    )
  );

  UPDATE public.users
  SET space_state = v_merged_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object('success', true, 'space_state', v_merged_state);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_polyspace_state(TEXT, JSONB) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- STEP 4: Confirm Unban and Expedition Readiness
-- ------------------------------------------------------------------------------
SELECT player_id, username, is_banned, bot_warning, balance_pgt, space_state->'expeditions' as expeditions
FROM public.users
WHERE player_id = '0xpgt461a068f0bd48378c8f93a4eadb77152';
