-- ==============================================================================
-- FORWARD MIGRATION: POLYSPACE CANCEL EXPEDITIONS & MULTI-MISSION ANTI-CHEAT
-- Version: v1.5.426
-- 
-- Description:
-- 1. Adds public.cancel_polyspace_expeditions(p_player_id, p_expedition_id)
--    - Safely recalls active starships under pessimistic row locking
--    - Allows canceling ALL expeditions or a targeted single expedition
--    - Strictly touches only space_state->'expeditions', zero balance/mineral mutations
-- 2. Hardens public.claim_polyspace_expedition(p_player_id, p_expedition_id)
--    - Adds Warp Drive level gating check on claim
--    - Adds minimum elapsed flight time verification against forge-timed expeditions
--    - Clamps concurrent claims to verified fleet slot capacity
-- 3. Hardens public.prevent_direct_balance_mutation() master anti-cheat trigger
--    - Clamps active expeditions array to verified max slots (3 to 5 based on Warp Level)
--    - Enforces empty expeditions array on account creation
--    - MAINTAINS STRICT SECURITY INVOKER ARCHITECTURE (NO SECURITY DEFINER)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RPC: cancel_polyspace_expeditions
-- ------------------------------------------------------------------------------
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
BEGIN
  -- 1. Identity Resolution
  v_pid := public.resolve_player_id(COALESCE(p_player_id, auth.jwt() ->> 'sub', ''));
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_player_id, '')));
  END IF;

  IF v_pid IS NULL OR v_pid = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player identity required');
  END IF;

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
-- 2. RPC: claim_polyspace_expedition (Hardened Anti-Cheat)
-- ------------------------------------------------------------------------------
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
BEGIN
  -- Convert server NOW() to millisecond epoch
  v_now_ms := (EXTRACT(EPOCH FROM v_now) * 1000)::bigint;

  -- 1. Identity Resolution
  v_pid := public.resolve_player_id(COALESCE(p_player_id, auth.jwt() ->> 'sub', ''));
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_player_id, '')));
  END IF;

  IF v_pid IS NULL OR v_pid = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unable to resolve player identity');
  END IF;

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
          IF v_relic_rand < 0.20 THEN v_relic_id := 'relic_space_plasma';
          ELSIF v_relic_rand < 0.40 THEN v_relic_id := 'relic_space_transceiver';
          ELSIF v_relic_rand < 0.60 THEN v_relic_id := 'relic_space_warpcoil';
          ELSIF v_relic_rand < 0.80 THEN v_relic_id := 'relic_space_darkmatter';
          ELSE v_relic_id := 'relic_space_starforge';
          END IF;

          -- Grant relic server-side if not already owned
          IF v_user.relics IS NULL OR NOT (v_user.relics ? v_relic_id) THEN
            IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_relic_drop') THEN
              BEGIN
                PERFORM public.grant_relic_drop(v_user.player_id, v_relic_id, 'PolySpace Fleet');
                v_discovered_relic := jsonb_build_object('id', v_relic_id);
              EXCEPTION WHEN OTHERS THEN
                NULL;
              END IF;
            END IF;
          END IF;
        END IF;

        -- Accumulate totals
        v_tot_iron := v_tot_iron + v_item_iron;
        v_tot_tit := v_tot_tit + v_item_tit;
        v_tot_quant := v_tot_quant + v_item_quant;
        v_tot_pgt_ore := v_tot_pgt_ore + v_item_pgt_ore;
        v_tot_pgt := v_tot_pgt + v_item_pgt;

        -- Create Mission Log
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

GRANT EXECUTE ON FUNCTION public.claim_polyspace_expedition(TEXT, TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 3. Trigger: prevent_direct_balance_mutation (Hardened Expeditions Clamp)
-- NOTE: MUST REMAIN SECURITY INVOKER (NO SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_r_key TEXT;
  v_old_unm INT;
  v_new_unm INT;
  v_merged_r JSONB;
  v_today TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_fleet_warp INT;
  v_allowed_slots INT;
  v_exp_arr JSONB;
BEGIN
  -- Restrict direct PostgREST client queries (anon & authenticated roles)
  -- Legitimate SECURITY DEFINER procedures run as 'postgres' and bypass this check.
  IF LOWER(CURRENT_USER) IN ('anon', 'authenticated') THEN

    IF TG_OP = 'INSERT' THEN
      -- Sanitize newly inserted accounts against elevated balances & privileges
      NEW.balance_pgt := 0.0;
      NEW.created_at := NOW();
      NEW.is_admin := false;
      NEW.is_ambassador := false;
      NEW.dex_liquidity_usd := 0.0;
      NEW.is_banned := false;
      NEW.bot_warning := 0;
      NEW.vip_until := NULL;
      NEW.total_earned := 0.0;
      NEW.total_arcade_plays := 0;
      NEW.game_highscore := 0;
      NEW.invaders_highscore := 0;
      NEW.drift_highscore := 0;
      NEW.stacker_highscore := 0;
      NEW.skeet_highscore := 0;
      NEW.defense_highscore := 0;
      NEW.boss_weekly_damage := 0;
      NEW.alltime_boss_damage := 0;
      NEW.boss_attacks_count := 0;
      NEW.weekly_faucet_claims := 0;
      NEW.weekly_games_played := 0;
      NEW.weekly_active_tier := 0;
      NEW.last_weekly_active_tier := 0;
      NEW.faucet_streak := 0;
      NEW.vip_faucet_streak := 0;
      NEW.unclaimed_referral_pgt := 0.0;
      NEW.unclaimed_referral_pol := 0.0;
      NEW.total_referral_commission := 0.0;
      NEW.total_referral_pol := 0.0;
      NEW.unclaimed_vip_faucet_pol := 0.0;
      NEW.total_vip_faucet_pol := 0.0;
      NEW.owned_nfts := '[]'::jsonb;
      NEW.crate_nfts := '[]'::jsonb;
      NEW.relics := '{}'::jsonb;
      NEW.last_turnstile_at := NULL;

      -- Prevent setting fake referrals on account creation
      NEW.referrals_count := 0;
      NEW.referrals_l1 := 0;
      NEW.referrals_l2 := 0;
      NEW.referrals_l3 := 0;
      NEW.referrals_l4 := 0;
      NEW.referrals_list := '[]'::jsonb;

      -- Clamp starting minerals & space statistics
      IF NEW.space_state IS NOT NULL THEN
        NEW.space_state := jsonb_set(NEW.space_state, '{warpLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{laserLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{cargoLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{shieldLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{turretLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{fleetPower}', '380'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{raidsWon}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{mineralsMinedTotal}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{pgtMinedTotal}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{iron}', to_jsonb(LEAST(COALESCE((NEW.space_state->>'iron')::numeric, 50), 50)));
        NEW.space_state := jsonb_set(NEW.space_state, '{titanium}', to_jsonb(LEAST(COALESCE((NEW.space_state->>'titanium')::numeric, 10), 10)));
        NEW.space_state := jsonb_set(NEW.space_state, '{quantum}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{pgtOre}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{expeditions}', '[]'::jsonb);
      END IF;

    ELSIF TG_OP = 'UPDATE' THEN
      -- 1. Immutable registration timestamp
      IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        NEW.created_at := OLD.created_at;
      END IF;

      -- 2. Immutable balances (PGT mutations MUST go through SECURITY DEFINER RPCs)
      IF NEW.balance_pgt IS DISTINCT FROM OLD.balance_pgt THEN
        NEW.balance_pgt := OLD.balance_pgt;
      END IF;

      -- 3. Immutable roles, LP status, and VIP / ban status
      IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
        NEW.is_admin := OLD.is_admin;
      END IF;
      IF NEW.is_ambassador IS DISTINCT FROM OLD.is_ambassador THEN
        NEW.is_ambassador := OLD.is_ambassador;
      END IF;
      IF NEW.dex_liquidity_usd IS DISTINCT FROM OLD.dex_liquidity_usd THEN
        NEW.dex_liquidity_usd := OLD.dex_liquidity_usd;
      END IF;
      IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
        NEW.is_banned := OLD.is_banned;
      END IF;
      IF NEW.bot_warning < OLD.bot_warning THEN
        NEW.bot_warning := OLD.bot_warning;
      END IF;
      IF NEW.vip_until IS DISTINCT FROM OLD.vip_until THEN
        NEW.vip_until := OLD.vip_until;
      END IF;

      -- 4. Immutable career total_arcade_plays (server RPC controlled only)
      IF NEW.total_arcade_plays IS DISTINCT FROM OLD.total_arcade_plays THEN
        NEW.total_arcade_plays := OLD.total_arcade_plays;
      END IF;

      -- 4b. Immutable Turnstile verification timestamp (server RPC controlled only)
      IF NEW.last_turnstile_at IS DISTINCT FROM OLD.last_turnstile_at THEN
        NEW.last_turnstile_at := OLD.last_turnstile_at;
      END IF;

      -- 5. Immutable faucet timestamps & streaks (seals cooldown-wiping exploit)
      IF NEW.last_faucet_claim IS DISTINCT FROM OLD.last_faucet_claim THEN
        NEW.last_faucet_claim := OLD.last_faucet_claim;
      END IF;
      IF NEW.faucet_streak IS DISTINCT FROM OLD.faucet_streak THEN
        NEW.faucet_streak := OLD.faucet_streak;
      END IF;
      IF NEW.last_vip_faucet_claim IS DISTINCT FROM OLD.last_vip_faucet_claim THEN
        NEW.last_vip_faucet_claim := OLD.last_vip_faucet_claim;
      END IF;
      IF NEW.vip_faucet_streak IS DISTINCT FROM OLD.vip_faucet_streak THEN
        NEW.vip_faucet_streak := OLD.vip_faucet_streak;
      END IF;

      -- 6. Immutable weekly activity counters
      IF NEW.weekly_faucet_claims IS DISTINCT FROM OLD.weekly_faucet_claims THEN
        NEW.weekly_faucet_claims := OLD.weekly_faucet_claims;
      END IF;
      IF NEW.weekly_games_played IS DISTINCT FROM OLD.weekly_games_played THEN
        NEW.weekly_games_played := OLD.weekly_games_played;
      END IF;
      IF NEW.weekly_active_tier IS DISTINCT FROM OLD.weekly_active_tier THEN
        NEW.weekly_active_tier := OLD.weekly_active_tier;
      END IF;

      -- 7. High score ceiling (max 500,000 pts) & rollback prevention
      IF NEW.game_highscore > 500000 THEN
        NEW.game_highscore := OLD.game_highscore;
      ELSIF NEW.game_highscore < OLD.game_highscore THEN
        NEW.game_highscore := OLD.game_highscore;
      END IF;

      IF NEW.invaders_highscore > 500000 THEN
        NEW.invaders_highscore := OLD.invaders_highscore;
      ELSIF NEW.invaders_highscore < OLD.invaders_highscore THEN
        NEW.invaders_highscore := OLD.invaders_highscore;
      END IF;

      IF NEW.drift_highscore > 500000 THEN
        NEW.drift_highscore := OLD.drift_highscore;
      ELSIF NEW.drift_highscore < OLD.drift_highscore THEN
        NEW.drift_highscore := OLD.drift_highscore;
      END IF;

      IF NEW.stacker_highscore > 500000 THEN
        NEW.stacker_highscore := OLD.stacker_highscore;
      ELSIF NEW.stacker_highscore < OLD.stacker_highscore THEN
        NEW.stacker_highscore := OLD.stacker_highscore;
      END IF;

      IF NEW.skeet_highscore > 500000 THEN
        NEW.skeet_highscore := OLD.skeet_highscore;
      ELSIF NEW.skeet_highscore < OLD.skeet_highscore THEN
        NEW.skeet_highscore := OLD.skeet_highscore;
      END IF;

      IF NEW.defense_highscore > 500000 THEN
        NEW.defense_highscore := OLD.defense_highscore;
      ELSIF NEW.defense_highscore < OLD.defense_highscore THEN
        NEW.defense_highscore := OLD.defense_highscore;
      END IF;

      -- Also clamp all-time score equivalents if client attempts direct update
      IF NEW.alltime_game_highscore > 500000 THEN NEW.alltime_game_highscore := OLD.alltime_game_highscore; END IF;
      IF NEW.alltime_invaders_highscore > 500000 THEN NEW.alltime_invaders_highscore := OLD.alltime_invaders_highscore; END IF;
      IF NEW.alltime_drift_highscore > 500000 THEN NEW.alltime_drift_highscore := OLD.alltime_drift_highscore; END IF;
      IF NEW.alltime_stacker_highscore > 500000 THEN NEW.alltime_stacker_highscore := OLD.alltime_stacker_highscore; END IF;
      IF NEW.alltime_skeet_highscore > 500000 THEN NEW.alltime_skeet_highscore := OLD.alltime_skeet_highscore; END IF;
      IF NEW.defense_alltime_best > 500000 THEN NEW.defense_alltime_best := OLD.defense_alltime_best; END IF;

      -- 8. Immutable referral commissions & VIP POL yields
      IF NEW.unclaimed_referral_pgt IS DISTINCT FROM OLD.unclaimed_referral_pgt THEN
        NEW.unclaimed_referral_pgt := OLD.unclaimed_referral_pgt;
      END IF;
      IF NEW.unclaimed_referral_pol IS DISTINCT FROM OLD.unclaimed_referral_pol THEN
        NEW.unclaimed_referral_pol := OLD.unclaimed_referral_pol;
      END IF;
      IF NEW.total_referral_commission IS DISTINCT FROM OLD.total_referral_commission THEN
        NEW.total_referral_commission := OLD.total_referral_commission;
      END IF;
      IF NEW.total_referral_pol IS DISTINCT FROM OLD.total_referral_pol THEN
        NEW.total_referral_pol := OLD.total_referral_pol;
      END IF;
      IF NEW.unclaimed_vip_faucet_pol IS DISTINCT FROM OLD.unclaimed_vip_faucet_pol THEN
        NEW.unclaimed_vip_faucet_pol := OLD.unclaimed_vip_faucet_pol;
      END IF;
      IF NEW.total_vip_faucet_pol IS DISTINCT FROM OLD.total_vip_faucet_pol THEN
        NEW.total_vip_faucet_pol := OLD.total_vip_faucet_pol;
      END IF;

      -- Immutable referral tree statistics & referral list on direct client UPDATE
      IF NEW.referrals_count IS DISTINCT FROM OLD.referrals_count THEN
        NEW.referrals_count := OLD.referrals_count;
      END IF;
      IF NEW.referrals_l1 IS DISTINCT FROM OLD.referrals_l1 THEN
        NEW.referrals_l1 := OLD.referrals_l1;
      END IF;
      IF NEW.referrals_l2 IS DISTINCT FROM OLD.referrals_l2 THEN
        NEW.referrals_l2 := OLD.referrals_l2;
      END IF;
      IF NEW.referrals_l3 IS DISTINCT FROM OLD.referrals_l3 THEN
        NEW.referrals_l3 := OLD.referrals_l3;
      END IF;
      IF NEW.referrals_l4 IS DISTINCT FROM OLD.referrals_l4 THEN
        NEW.referrals_l4 := OLD.referrals_l4;
      END IF;
      IF NEW.referrals_list IS DISTINCT FROM OLD.referrals_list THEN
        NEW.referrals_list := OLD.referrals_list;
      END IF;

      -- 9. Immutable Inventory: owned_nfts & crate_nfts
      IF NEW.owned_nfts IS DISTINCT FROM OLD.owned_nfts THEN
        NEW.owned_nfts := OLD.owned_nfts;
      END IF;
      IF NEW.crate_nfts IS DISTINCT FROM OLD.crate_nfts THEN
        NEW.crate_nfts := OLD.crate_nfts;
      END IF;

      -- 10. Immutable Relics Inventory (Mutations MUST go through SECURITY DEFINER RPCs)
      -- Direct client saves (anon/authenticated) can NEVER delete, clobber, or alter existing relics
      IF NEW.relics IS DISTINCT FROM OLD.relics THEN
        NEW.relics := OLD.relics;
      END IF;

      -- 11. PolySpace Fleet Upgrades & Mineral Protections
      IF NEW.space_state IS NOT NULL THEN
        -- Preserve existing state fields so partial client updates cannot wipe fleet or minerals
        IF OLD.space_state IS NOT NULL AND jsonb_typeof(OLD.space_state) = 'object' THEN
          NEW.space_state := OLD.space_state || NEW.space_state;
        END IF;

        -- 11a. Module Levels (Module upgrades MUST go through upgrade_polyspace_module RPC)
        -- Direct PostgREST client updates cannot increase module levels!
        IF COALESCE((NEW.space_state->>'warpLevel')::integer, 1) > COALESCE((OLD.space_state->>'warpLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{warpLevel}', to_jsonb(COALESCE((OLD.space_state->>'warpLevel')::integer, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'laserLevel')::integer, 1) > COALESCE((OLD.space_state->>'laserLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{laserLevel}', to_jsonb(COALESCE((OLD.space_state->>'laserLevel')::integer, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'cargoLevel')::integer, 1) > COALESCE((OLD.space_state->>'cargoLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{cargoLevel}', to_jsonb(COALESCE((OLD.space_state->>'cargoLevel')::integer, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'shieldLevel')::integer, 1) > COALESCE((OLD.space_state->>'shieldLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{shieldLevel}', to_jsonb(COALESCE((OLD.space_state->>'shieldLevel')::integer, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'turretLevel')::integer, 1) > COALESCE((OLD.space_state->>'turretLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{turretLevel}', to_jsonb(COALESCE((OLD.space_state->>'turretLevel')::integer, 1)));
        END IF;

        -- 11b. Space Minerals (Can only be earned via expeditions, smelting, anomalies, or boss)
        -- Direct PostgREST client updates cannot inflate mineral balances!
        IF COALESCE((NEW.space_state->>'iron')::numeric, 0) > COALESCE((OLD.space_state->>'iron')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{iron}', to_jsonb(COALESCE((OLD.space_state->>'iron')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'titanium')::numeric, 0) > COALESCE((OLD.space_state->>'titanium')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{titanium}', to_jsonb(COALESCE((OLD.space_state->>'titanium')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'quantum')::numeric, 0) > COALESCE((OLD.space_state->>'quantum')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{quantum}', to_jsonb(COALESCE((OLD.space_state->>'quantum')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'pgtOre')::numeric, 0) > COALESCE((OLD.space_state->>'pgtOre')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{pgtOre}', to_jsonb(COALESCE((OLD.space_state->>'pgtOre')::numeric, 0)));
        END IF;

        -- 11c. Space Career Statistics & Milestones (Server RPC controlled only)
        -- Direct PostgREST client updates cannot inflate raidsWon, pgtMinedTotal, or mineralsMinedTotal!
        IF COALESCE((NEW.space_state->>'raidsWon')::numeric, 0) > COALESCE((OLD.space_state->>'raidsWon')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{raidsWon}', to_jsonb(COALESCE((OLD.space_state->>'raidsWon')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'pgtMinedTotal')::numeric, 0) > COALESCE((OLD.space_state->>'pgtMinedTotal')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{pgtMinedTotal}', to_jsonb(COALESCE((OLD.space_state->>'pgtMinedTotal')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'mineralsMinedTotal')::numeric, 0) > COALESCE((OLD.space_state->>'mineralsMinedTotal')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((OLD.space_state->>'mineralsMinedTotal')::numeric, 0)));
        END IF;

        -- 11d. Fleet Power (Deterministic calculation from validated module levels)
        NEW.space_state := jsonb_set(
          NEW.space_state,
          '{fleetPower}',
          to_jsonb(
            (GREATEST(1, COALESCE((NEW.space_state->>'warpLevel')::integer, 1)) * 100) +
            (GREATEST(1, COALESCE((NEW.space_state->>'laserLevel')::integer, 1)) * 80) +
            (GREATEST(1, COALESCE((NEW.space_state->>'cargoLevel')::integer, 1)) * 50) +
            (GREATEST(1, COALESCE((NEW.space_state->>'shieldLevel')::integer, 1)) * 60) +
            (GREATEST(1, COALESCE((NEW.space_state->>'turretLevel')::integer, 1)) * 90)
          )
        );

        -- 11e. Protect Outpost & Deep-Space Cooldowns from Client Rollback/Wiping
        IF OLD.space_state IS NOT NULL AND jsonb_typeof(OLD.space_state) = 'object' THEN
          -- Never allow client to wipe or backdate lastPokeDate
          IF OLD.space_state->>'lastPokeDate' IS NOT NULL THEN
            IF NEW.space_state->>'lastPokeDate' IS NULL OR NEW.space_state->>'lastPokeDate' < OLD.space_state->>'lastPokeDate' THEN
              NEW.space_state := jsonb_set(NEW.space_state, '{lastPokeDate}', OLD.space_state->'lastPokeDate');
            END IF;
          END IF;

          -- Never allow client to wipe or backdate lastRaidDate
          IF OLD.space_state->>'lastRaidDate' IS NOT NULL THEN
            IF NEW.space_state->>'lastRaidDate' IS NULL OR NEW.space_state->>'lastRaidDate' < OLD.space_state->>'lastRaidDate' THEN
              NEW.space_state := jsonb_set(NEW.space_state, '{lastRaidDate}', OLD.space_state->'lastRaidDate');
            END IF;
          END IF;

          -- Never allow client to roll back anomaly scan timestamp
          IF OLD.space_state->>'lastAnomalyScanTime' IS NOT NULL THEN
            IF COALESCE((NEW.space_state->>'lastAnomalyScanTime')::bigint, 0) < COALESCE((OLD.space_state->>'lastAnomalyScanTime')::bigint, 0) THEN
              NEW.space_state := jsonb_set(NEW.space_state, '{lastAnomalyScanTime}', OLD.space_state->'lastAnomalyScanTime');
            END IF;
          END IF;

          -- 11f. Clamp Active Expeditions Array to Valid Max Slots (3 to 5 based on verified Warp Level)
          IF NEW.space_state->'expeditions' IS NOT NULL AND jsonb_typeof(NEW.space_state->'expeditions') = 'array' THEN
            v_fleet_warp := GREATEST(1, COALESCE((NEW.space_state->>'warpLevel')::integer, 1));
            v_allowed_slots := LEAST(5, 3 + (v_fleet_warp / 10));
            IF jsonb_array_length(NEW.space_state->'expeditions') > v_allowed_slots THEN
              SELECT jsonb_agg(elem) INTO v_exp_arr
              FROM (
                SELECT elem FROM jsonb_array_elements(NEW.space_state->'expeditions') WITH ORDINALITY arr(elem, idx)
                WHERE idx <= v_allowed_slots
              ) sub;
              NEW.space_state := jsonb_set(NEW.space_state, '{expeditions}', COALESCE(v_exp_arr, '[]'::jsonb));
            END IF;
          END IF;
        END IF;
      END IF;

      -- 12. Daily Quests Anti-Tamper & Anti-Replay Shield
      -- Direct client updates (anon/authenticated) can never unclaim quest rewards!
      IF NEW.daily_quests IS NOT NULL AND jsonb_typeof(NEW.daily_quests) = 'object' THEN
        IF OLD.daily_quests IS NOT NULL AND jsonb_typeof(OLD.daily_quests) = 'object' THEN
          -- If the existing record is for today, preserve any claimed flags
          IF COALESCE(OLD.daily_quests->>'date', '') = v_today THEN
            IF COALESCE((OLD.daily_quests->>'games_claimed')::boolean, false) THEN
              NEW.daily_quests := jsonb_set(NEW.daily_quests, '{games_claimed}', 'true'::jsonb);
            END IF;
            IF COALESCE((OLD.daily_quests->>'mining_claimed')::boolean, false) THEN
              NEW.daily_quests := jsonb_set(NEW.daily_quests, '{mining_claimed}', 'true'::jsonb);
            END IF;
            IF COALESCE((OLD.daily_quests->>'wins_claimed')::boolean, false) THEN
              NEW.daily_quests := jsonb_set(NEW.daily_quests, '{wins_claimed}', 'true'::jsonb);
            END IF;
            IF COALESCE((OLD.daily_quests->>'master_claimed')::boolean, false) THEN
              NEW.daily_quests := jsonb_set(NEW.daily_quests, '{master_claimed}', 'true'::jsonb);
            END IF;
            -- Streak days can only be maintained or advanced
            IF COALESCE((NEW.daily_quests->>'streak_days')::int, 0) < COALESCE((OLD.daily_quests->>'streak_days')::int, 0) THEN
              NEW.daily_quests := jsonb_set(NEW.daily_quests, '{streak_days}', to_jsonb(COALESCE((OLD.daily_quests->>'streak_days')::int, 0)));
            END IF;
          END IF;
        END IF;
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$;
