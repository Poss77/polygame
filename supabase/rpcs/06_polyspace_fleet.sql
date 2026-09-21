-- 6. POLYSPACE FLEET OPERATIONS (MINING, MODULES & OUTPOSTS)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: claim_polyspace_expedition
-- Source: atomic_polyspace_expedition_claim.sql
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
            END;
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
      'error', 'Expedition already claimed or not found'
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
-- RPC: cancel_polyspace_expeditions
-- Source: add_cancel_polyspace_expeditions_rpc.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.cancel_polyspace_expeditions(TEXT, TEXT);
DROP FUNCTION IF EXISTS cancel_polyspace_expeditions(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.cancel_polyspace_expeditions(
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
  v_cancelled_count INTEGER := 0;
  v_target_all BOOLEAN := false;
  v_exp JSONB;
  v_exp_id TEXT;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- 2. Pessimistic Row Lock (Prevents race conditions with active claims)
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account suspended');
  END IF;

  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_expeditions := COALESCE(v_space_state->'expeditions', '[]'::jsonb);

  IF jsonb_array_length(v_expeditions) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active expeditions to cancel');
  END IF;

  v_target_all := (p_expedition_id IS NULL OR UPPER(TRIM(p_expedition_id)) = 'ALL' OR TRIM(p_expedition_id) = '');

  IF v_target_all THEN
    v_cancelled_count := jsonb_array_length(v_expeditions);
    v_remaining_expeditions := '[]'::jsonb;
  ELSE
    FOR v_exp IN SELECT * FROM jsonb_array_elements(v_expeditions)
    LOOP
      v_exp_id := v_exp->>'id';
      IF v_exp_id = p_expedition_id THEN
        v_cancelled_count := v_cancelled_count + 1;
      ELSE
        v_remaining_expeditions := v_remaining_expeditions || jsonb_build_array(v_exp);
      END IF;
    END LOOP;
  END IF;

  IF v_cancelled_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Expedition not found or already ended');
  END IF;

  -- Update space_state: clears/filters expeditions, strictly leaves balances, minerals, and modules unchanged
  v_space_state := jsonb_set(v_space_state, '{expeditions}', v_remaining_expeditions);

  UPDATE public.users
  SET space_state = v_space_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'cancelled_count', v_cancelled_count,
    'new_space_state', v_space_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_polyspace_expeditions(TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: upgrade_polyspace_module
-- Source: seal_polyspace_module_levels_anti_cheat.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.upgrade_polyspace_module(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.upgrade_polyspace_module(TEXT, NUMERIC, JSONB);
DROP FUNCTION IF EXISTS upgrade_polyspace_module(TEXT, TEXT);
DROP FUNCTION IF EXISTS upgrade_polyspace_module(TEXT, NUMERIC, JSONB);
CREATE OR REPLACE FUNCTION public.upgrade_polyspace_module(
  p_player_id TEXT,
  p_module_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_space_state JSONB;
  v_part TEXT;
  v_lvl_key TEXT;
  v_cur_lvl INTEGER := 1;
  v_new_lvl INTEGER;
  v_cost_iron INTEGER;
  v_cost_tit INTEGER;
  v_cost_pgt NUMERIC;
  v_cur_iron NUMERIC;
  v_cur_tit NUMERIC;
  v_cur_pgt NUMERIC;
  v_new_balance NUMERIC;
  v_warp INTEGER;
  v_laser INTEGER;
  v_cargo INTEGER;
  v_shield INTEGER;
  v_turret INTEGER;
  v_fleet_power INTEGER;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'message', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  v_part := LOWER(TRIM(COALESCE(p_module_type, '')));
  IF v_part NOT IN ('warp', 'laser', 'cargo', 'shield', 'turret') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid module type. Must be warp, laser, cargo, shield, or turret.');
  END IF;

  v_lvl_key := v_part || 'Level';

  -- 2. Acquire Pessimistic Row Lock (Serializes concurrent upgrades)
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Account suspended');
  END IF;

  -- 3. Extract Current Module Level
  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_cur_lvl := GREATEST(1, COALESCE((v_space_state->>v_lvl_key)::integer, 1));

  IF v_cur_lvl >= 50 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Maximum Level 50 already reached for ' || UPPER(v_part));
  END IF;

  -- 4. Calculate Canonical Upgrade Costs:
  -- costIron = FLOOR(40 * 1.22^(lvl-1))
  -- costTit  = FLOOR(10 * 1.22^(lvl-1))
  -- costPgt  = FLOOR(50 * 1.22^(lvl-1))
  v_cost_iron := FLOOR(40 * POW(1.22, v_cur_lvl - 1));
  v_cost_tit  := FLOOR(10 * POW(1.22, v_cur_lvl - 1));
  v_cost_pgt  := FLOOR(50 * POW(1.22, v_cur_lvl - 1));

  v_cur_iron := COALESCE((v_space_state->>'iron')::numeric, 0);
  v_cur_tit  := COALESCE((v_space_state->>'titanium')::numeric, 0);
  v_cur_pgt  := COALESCE(v_user.balance_pgt, 0);

  -- 5. Strict Balance Verification
  IF v_cur_iron < v_cost_iron THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Insufficient Iron. Required: ' || v_cost_iron || ', Available: ' || FLOOR(v_cur_iron)
    );
  END IF;
  IF v_cur_tit < v_cost_tit THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Insufficient Titanium. Required: ' || v_cost_tit || ', Available: ' || FLOOR(v_cur_tit)
    );
  END IF;
  IF v_cur_pgt < v_cost_pgt THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Insufficient PGT balance. Required: ' || v_cost_pgt || ' PGT, Available: ' || ROUND(v_cur_pgt, 2) || ' PGT'
    );
  END IF;

  -- 6. Deduct Resources & Increment Level
  v_new_lvl := v_cur_lvl + 1;
  v_space_state := jsonb_set(v_space_state, ('{' || v_lvl_key || '}')::text[], to_jsonb(v_new_lvl));
  v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(ROUND((v_cur_iron - v_cost_iron)::numeric, 2)));
  v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(ROUND((v_cur_tit - v_cost_tit)::numeric, 2)));

  -- 7. Compute Accurate Fleet Power
  v_warp   := GREATEST(1, COALESCE((v_space_state->>'warpLevel')::integer, 1));
  v_laser  := GREATEST(1, COALESCE((v_space_state->>'laserLevel')::integer, 1));
  v_cargo  := GREATEST(1, COALESCE((v_space_state->>'cargoLevel')::integer, 1));
  v_shield := GREATEST(1, COALESCE((v_space_state->>'shieldLevel')::integer, 1));
  v_turret := GREATEST(1, COALESCE((v_space_state->>'turretLevel')::integer, 1));

  v_fleet_power := (v_warp * 100) + (v_laser * 80) + (v_cargo * 50) + (v_shield * 60) + (v_turret * 90);
  v_space_state := jsonb_set(v_space_state, '{fleetPower}', to_jsonb(v_fleet_power));

  -- 8. Atomic Database Mutation
  UPDATE public.users
  SET balance_pgt = ROUND(COALESCE(balance_pgt, 0) - v_cost_pgt, 2),
      space_state = v_space_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  -- 9. Return Response
  RETURN jsonb_build_object(
    'success', true,
    'module', v_part,
    'new_level', v_new_lvl,
    'cost_iron', v_cost_iron,
    'cost_tit', v_cost_tit,
    'cost_pgt', v_cost_pgt,
    'new_balance', v_new_balance,
    'new_space_state', v_space_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upgrade_polyspace_module(TEXT, TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: smelt_space_ore
-- Source: seal_world_boss_and_minerals_anti_cheat.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.smelt_space_ore(TEXT, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS smelt_space_ore(TEXT, TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION public.smelt_space_ore(
  p_player_id TEXT,
  p_recipe TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_space_state JSONB;
  v_recipe TEXT;
  
  v_cur_iron NUMERIC := 0;
  v_cur_tit NUMERIC := 0;
  v_cur_quantum NUMERIC := 0;
  v_cur_pgt_ore NUMERIC := 0;
  
  v_cost_iron NUMERIC := 0;
  v_cost_tit NUMERIC := 0;
  v_cost_quantum NUMERIC := 0;
  
  v_gain_tit NUMERIC := 0;
  v_gain_quantum NUMERIC := 0;
  v_gain_pgt_ore NUMERIC := 0;
  
  v_recipe_name TEXT := '';
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'message', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  v_recipe := LOWER(TRIM(COALESCE(p_recipe, '')));

  -- 2. Validate Recipe Parameters
  IF v_recipe = 'quantum_10x' THEN
    v_cost_tit := 1000;
    v_gain_quantum := 300;
    v_recipe_name := '1,000 Titanium Ore ➔ +300 Quantum Ore';
  ELSIF v_recipe IN ('quantum_100x', 'quantum_10000') THEN
    v_cost_tit := 10000;
    v_gain_quantum := 3000;
    v_recipe_name := '10,000 Titanium Ore ➔ +3,000 Quantum Ore (10x Refinery)';
  ELSIF v_recipe = 'titanium_10x' THEN
    v_cost_iron := 1500;
    v_gain_tit := 400;
    v_recipe_name := '1,500 Iron Ore ➔ +400 Titanium Ore';
  ELSIF v_recipe IN ('titanium_100x', 'titanium_15000') THEN
    v_cost_iron := 15000;
    v_gain_tit := 4000;
    v_recipe_name := '15,000 Iron Ore ➔ +4,000 Titanium Ore (10x Refinery)';
  ELSIF v_recipe IN ('pgt_ore', 'pgtore', 'pgt_ore_bulk', 'pgtore_bulk') THEN
    v_cost_quantum := 5000;
    v_gain_pgt_ore := 2;
    v_recipe_name := '5,000 Quantum Crystals ➔ +2 Rare PGT Ore';
  ELSIF v_recipe = 'quantum' THEN
    v_cost_tit := 100;
    v_gain_quantum := 30;
    v_recipe_name := '100 Titanium Ore ➔ +30 Quantum Ore';
  ELSIF v_recipe = 'titanium' THEN
    v_cost_iron := 150;
    v_gain_tit := 40;
    v_recipe_name := '150 Iron Ore ➔ +40 Titanium Ore';
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Unknown refinery recipe: ' || p_recipe);
  END IF;

  -- 3. Row Locking
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player account not found.');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Account suspended.');
  END IF;

  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_cur_iron     := COALESCE((v_space_state->>'iron')::NUMERIC, 0);
  v_cur_tit      := COALESCE((v_space_state->>'titanium')::NUMERIC, 0);
  v_cur_quantum  := COALESCE((v_space_state->>'quantum')::NUMERIC, 0);
  v_cur_pgt_ore  := COALESCE((v_space_state->>'pgtOre')::NUMERIC, 0);

  -- 4. Verify Mineral Resources
  IF v_cost_iron > 0 AND v_cur_iron < v_cost_iron THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Requires ' || v_cost_iron::TEXT || ' Iron Ore! You have ' || FLOOR(v_cur_iron)::TEXT
    );
  END IF;

  IF v_cost_tit > 0 AND v_cur_tit < v_cost_tit THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Requires ' || v_cost_tit::TEXT || ' Titanium Ore! You have ' || FLOOR(v_cur_tit)::TEXT
    );
  END IF;

  IF v_cost_quantum > 0 AND v_cur_quantum < v_cost_quantum THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Requires ' || v_cost_quantum::TEXT || ' Quantum Crystals! You have ' || FLOOR(v_cur_quantum)::TEXT
    );
  END IF;

  -- 5. Deduct Inputs & Add Outputs
  v_cur_iron     := GREATEST(0, v_cur_iron - v_cost_iron);
  v_cur_tit      := GREATEST(0, v_cur_tit - v_cost_tit) + v_gain_tit;
  v_cur_quantum  := GREATEST(0, v_cur_quantum - v_cost_quantum) + v_gain_quantum;
  v_cur_pgt_ore  := v_cur_pgt_ore + v_gain_pgt_ore;

  v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(v_cur_iron));
  v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(v_cur_tit));
  v_space_state := jsonb_set(v_space_state, '{quantum}', to_jsonb(v_cur_quantum));
  v_space_state := jsonb_set(v_space_state, '{pgtOre}', to_jsonb(v_cur_pgt_ore));

  -- 6. Update Database
  UPDATE public.users
  SET space_state = v_space_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'recipe', v_recipe,
    'recipe_name', v_recipe_name,
    'message', '🏭 REFINERY SMELTED: ' || v_recipe_name,
    'space_state', v_space_state,
    'new_iron', v_cur_iron,
    'new_titanium', v_cur_tit,
    'new_quantum', v_cur_quantum,
    'new_pgt_ore', v_cur_pgt_ore
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.smelt_space_ore(TEXT, TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: scan_polyspace_anomaly
-- Source: seal_world_boss_and_minerals_anti_cheat.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.scan_polyspace_anomaly(TEXT);
DROP FUNCTION IF EXISTS scan_polyspace_anomaly(TEXT);
CREATE OR REPLACE FUNCTION public.scan_polyspace_anomaly(
  p_player_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_space_state JSONB;
  v_now_ms BIGINT;
  v_last_scan_ms BIGINT;
  v_cooldown_ms BIGINT := 21600000; -- 6 hours in milliseconds
  v_roll NUMERIC;
  v_reward_type TEXT;
  v_msg TEXT;
  v_cur_iron NUMERIC := 0;
  v_cur_tit NUMERIC := 0;
  v_cur_quant NUMERIC := 0;
  v_expeditions JSONB;
  v_has_active_exp BOOLEAN := false;
  v_exp JSONB;
  v_new_exps JSONB := '[]'::jsonb;
  v_remaining_ms BIGINT;
  v_hrs_left NUMERIC;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'message', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- 2. Row Locking
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player account not found.');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Account suspended.');
  END IF;

  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_now_ms := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
  v_last_scan_ms := COALESCE((v_space_state->>'lastAnomalyScanTime')::BIGINT, 0);

  -- 3. Strict 6-Hour Cooldown Verification
  IF (v_now_ms - v_last_scan_ms) < v_cooldown_ms THEN
    v_hrs_left := ROUND(((v_cooldown_ms - (v_now_ms - v_last_scan_ms)) / 3600000.0)::NUMERIC, 1);
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Scanner recharging! Available in ' || v_hrs_left::TEXT || ' hours.'
    );
  END IF;

  v_cur_iron  := COALESCE((v_space_state->>'iron')::NUMERIC, 0);
  v_cur_tit   := COALESCE((v_space_state->>'titanium')::NUMERIC, 0);
  v_cur_quant := COALESCE((v_space_state->>'quantum')::NUMERIC, 0);
  v_expeditions := COALESCE(v_space_state->'expeditions', '[]'::jsonb);

  -- 4. Roll Deterministic Anomaly Outcome
  v_roll := random();

  IF v_roll < 0.35 THEN
    -- Check if player has active expeditions
    IF jsonb_array_length(v_expeditions) > 0 THEN
      FOR v_exp IN SELECT * FROM jsonb_array_elements(v_expeditions) LOOP
        v_remaining_ms := COALESCE((v_exp->>'endTime')::BIGINT, 0) - v_now_ms;
        IF v_remaining_ms > 0 THEN
          v_has_active_exp := true;
          v_exp := jsonb_set(v_exp, '{endTime}', to_jsonb(v_now_ms + ROUND(v_remaining_ms * 0.75)::BIGINT));
        END IF;
        v_new_exps := v_new_exps || jsonb_build_array(v_exp);
      END LOOP;
    END IF;

    IF v_has_active_exp THEN
      v_reward_type := 'wormhole';
      v_msg := '🌀 ANOMALY DISCOVERED: Temporal Wormhole! Active expedition timers cut by 25%!';
      v_space_state := jsonb_set(v_space_state, '{expeditions}', v_new_exps);
    ELSE
      v_reward_type := 'magnetic_surge';
      v_cur_iron := v_cur_iron + 80;
      v_msg := '🌀 ANOMALY DISCOVERED: Magnetic Field Surge! +80 Iron recovered!';
      v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(v_cur_iron));
    END IF;

  ELSIF v_roll < 0.65 THEN
    -- Ghost ship salvage
    v_reward_type := 'ghost_ship';
    v_cur_iron := v_cur_iron + 100;
    v_cur_tit := v_cur_tit + 40;
    v_cur_quant := v_cur_quant + 15;
    v_msg := '🛸 ANOMALY DISCOVERED: Derelict Ghost Ship Salvaged! +100 Iron, +40 Tit, & +15 Quant Ore!';
    v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(v_cur_iron));
    v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(v_cur_tit));
    v_space_state := jsonb_set(v_space_state, '{quantum}', to_jsonb(v_cur_quant));

  ELSE
    -- Cosmic Resource Shower
    v_reward_type := 'resource_shower';
    v_cur_iron := v_cur_iron + 140;
    v_cur_tit := v_cur_tit + 50;
    v_msg := '🌌 ANOMALY DISCOVERED: Cosmic Resource Shower! +140 Iron & +50 Titanium!';
    v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(v_cur_iron));
    v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(v_cur_tit));
  END IF;

  -- 5. Stamp Cooldown & Save State
  v_space_state := jsonb_set(v_space_state, '{lastAnomalyScanTime}', to_jsonb(v_now_ms));

  UPDATE public.users
  SET space_state = v_space_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'reward_type', v_reward_type,
    'message', v_msg,
    'space_state', v_space_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.scan_polyspace_anomaly(TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: poke_allied_outpost
-- Source: emergency_patch_drop_credit_arcade_payout_and_ban_nower.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.poke_allied_outpost(TEXT, TEXT);
DROP FUNCTION IF EXISTS poke_allied_outpost(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.poke_allied_outpost(
  p_player_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_today_str TEXT := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_warp_level INTEGER;
  v_bonus_iron INTEGER;
  v_bonus_pgt NUMERIC := 20.00;
  v_new_balance NUMERIC;
  v_state JSONB;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT * INTO v_user 
  FROM public.users 
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account suspended');
  END IF;

  v_state := COALESCE(v_user.space_state, '{}'::jsonb);

  -- Enforce 1/day UTC cooldown
  IF (v_state->>'lastPokeDate') IS NOT NULL AND (v_state->>'lastPokeDate') >= v_today_str THEN
    RETURN jsonb_build_object('success', false, 'error', 'Allied Outpost already poked today (1/day limit)! Resets at midnight UTC.');
  END IF;

  -- Clamp warp level strictly between 1 and 50 (prevents memory-injected levels like 999)
  v_warp_level := LEAST(GREATEST(1, COALESCE((v_state->>'warpLevel')::integer, 1)), 50);
  v_bonus_iron := 20 * v_warp_level;

  -- Update space state minerals and cooldown
  v_state := jsonb_set(v_state, '{lastPokeDate}', to_jsonb(v_today_str));
  v_state := jsonb_set(v_state, '{iron}', to_jsonb(COALESCE((v_state->>'iron')::numeric, 0) + v_bonus_iron));
  v_state := jsonb_set(v_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((v_state->>'mineralsMinedTotal')::numeric, 0) + v_bonus_iron));
  v_state := jsonb_set(v_state, '{pgtMinedTotal}', to_jsonb(ROUND(COALESCE((v_state->>'pgtMinedTotal')::numeric, 0) + v_bonus_pgt, 2)));

  -- Atomically credit PGT balance and update state
  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_bonus_pgt,
      total_earned = COALESCE(total_earned, 0) + v_bonus_pgt,
      space_state = v_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  -- Process referral commissions (20 PGT base)
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_referral_commissions') THEN
    BEGIN
      PERFORM process_referral_commissions(v_user.player_id, v_bonus_pgt, 'PolySpace Outpost Poke');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'bonus_iron', v_bonus_iron,
    'bonus_pgt', v_bonus_pgt,
    'new_balance', v_new_balance,
    'space_state', v_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.poke_allied_outpost(TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: launch_outpost_raid
-- Source: emergency_patch_drop_credit_arcade_payout_and_ban_nower.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.launch_outpost_raid(TEXT, TEXT);
DROP FUNCTION IF EXISTS launch_outpost_raid(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.launch_outpost_raid(
  p_player_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_today_str TEXT := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_fleet_power INTEGER;
  v_enemy_power INTEGER;
  v_iron NUMERIC;
  v_stolen_pgt NUMERIC;
  v_stolen_iron INTEGER;
  v_stolen_titanium INTEGER;
  v_new_balance NUMERIC;
  v_state JSONB;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT * INTO v_user 
  FROM public.users 
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account suspended');
  END IF;

  v_state := COALESCE(v_user.space_state, '{}'::jsonb);

  -- Enforce 1/day UTC cooldown
  IF (v_state->>'lastRaidDate') IS NOT NULL AND (v_state->>'lastRaidDate') >= v_today_str THEN
    RETURN jsonb_build_object('success', false, 'error', 'Outpost Raid already launched today (1/day limit)! Resets at midnight UTC.');
  END IF;

  -- Require 15 Iron fuel
  v_iron := COALESCE((v_state->>'iron')::numeric, 0);
  IF v_iron < 15 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Raid requires 15 Iron for Fuel!');
  END IF;

  v_fleet_power := COALESCE((v_state->>'fleetPower')::integer, 50);
  v_enemy_power := FLOOR(80 + RANDOM() * (v_fleet_power * 1.2));

  -- Deduct iron fuel and set raid date
  v_state := jsonb_set(v_state, '{lastRaidDate}', to_jsonb(v_today_str));
  v_state := jsonb_set(v_state, '{iron}', to_jsonb(v_iron - 15));

  IF v_fleet_power < v_enemy_power THEN
    -- Defeat: record updated state with cooldown and fuel consumed
    UPDATE public.users SET space_state = v_state, updated_at = NOW() WHERE player_id = v_user.player_id;
    RETURN jsonb_build_object(
      'success', true,
      'victory', false,
      'enemy_power', v_enemy_power,
      'fleet_power', v_fleet_power,
      'message', format('Raid Defeated! Enemy Outpost defense (%s Power) was too strong.', v_enemy_power),
      'space_state', v_state
    );
  END IF;

  -- Victory: calculate reward securely server-side (16 to 24 PGT)
  v_stolen_pgt := ROUND((16.0 + RANDOM() * 8.0)::numeric, 2);
  v_stolen_iron := FLOOR(25 + RANDOM() * 25);
  v_stolen_titanium := FLOOR(5 + RANDOM() * 5);

  v_state := jsonb_set(v_state, '{raidsWon}', to_jsonb(COALESCE((v_state->>'raidsWon')::integer, 0) + 1));
  v_state := jsonb_set(v_state, '{iron}', to_jsonb(COALESCE((v_state->>'iron')::numeric, 0) + v_stolen_iron));
  v_state := jsonb_set(v_state, '{titanium}', to_jsonb(COALESCE((v_state->>'titanium')::numeric, 0) + v_stolen_titanium));
  v_state := jsonb_set(v_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((v_state->>'mineralsMinedTotal')::numeric, 0) + v_stolen_iron + v_stolen_titanium));
  v_state := jsonb_set(v_state, '{pgtMinedTotal}', to_jsonb(ROUND(COALESCE((v_state->>'pgtMinedTotal')::numeric, 0) + v_stolen_pgt, 2)));

  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_stolen_pgt,
      total_earned = COALESCE(total_earned, 0) + v_stolen_pgt,
      space_state = v_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_referral_commissions') THEN
    BEGIN
      PERFORM process_referral_commissions(v_user.player_id, v_stolen_pgt, 'PolySpace Outpost Raid');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'victory', true,
    'enemy_power', v_enemy_power,
    'fleet_power', v_fleet_power,
    'stolen_pgt', v_stolen_pgt,
    'stolen_iron', v_stolen_iron,
    'stolen_titanium', v_stolen_titanium,
    'new_balance', v_new_balance,
    'space_state', v_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.launch_outpost_raid(TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: start_polyspace_expedition
-- Source: fix_polyspace_expedition_launch_rpc.sql
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
      'endTime', v_end_ms
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
-- RPC: save_polyspace_state
-- Source: fix_polyspace_expedition_launch_rpc.sql
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
  v_fleet_warp INTEGER;
  v_allowed_slots INTEGER;
  v_exp_arr JSONB;
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

  v_current_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_merged_state := v_current_state || p_space_state;

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

  -- Clamp active expeditions array to valid max slots
  IF v_merged_state->'expeditions' IS NOT NULL AND jsonb_typeof(v_merged_state->'expeditions') = 'array' THEN
    v_fleet_warp := GREATEST(1, COALESCE((v_merged_state->>'warpLevel')::integer, 1));
    v_allowed_slots := LEAST(5, 3 + (v_fleet_warp / 10));
    IF jsonb_array_length(v_merged_state->'expeditions') > v_allowed_slots THEN
      SELECT jsonb_agg(elem) INTO v_exp_arr
      FROM (
        SELECT elem FROM jsonb_array_elements(v_merged_state->'expeditions') WITH ORDINALITY arr(elem, idx)
        WHERE idx <= v_allowed_slots
      ) sub;
      v_merged_state := jsonb_set(v_merged_state, '{expeditions}', COALESCE(v_exp_arr, '[]'::jsonb));
    END IF;
  END IF;

  UPDATE public.users
  SET space_state = v_merged_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object('success', true, 'space_state', v_merged_state);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_polyspace_state(TEXT, JSONB) TO authenticated, service_role, anon;

-- ==============================================================================

