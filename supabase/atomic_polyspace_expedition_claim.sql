-- ==============================================================================
-- POLYGAME: ATOMIC POLYSPACE EXPEDITION CLAIM & ANTI-CHEAT SENTINEL
-- ==============================================================================
-- 1. Creates claim_polyspace_expedition RPC with row locking (FOR UPDATE).
--    - Eliminates multi-window double PGT claims (serializes execution).
--    - Calculates Iron, Tit, Quant, PGT, and PGT Ore server-side using player's real levels.
--    - Validates expedition completion time against server NOW().
--    - Expands single-transaction PGT ceiling to 3,500 PGT to fully support high Laser Levels
--      and 3x Critical Odyssey returns.
-- 2. Hardens credit_arcade_payout to block unauthorized scripted mining payouts,
--    and enforces strict 1/day date checks for Allied Pokes and Outpost Raids.
-- ==============================================================================

BEGIN;

-- 1. DROP EXISTING SIGNATURE IF PRESENT
DROP FUNCTION IF EXISTS public.claim_polyspace_expedition(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.claim_polyspace_expedition(TEXT) CASCADE;

-- 2. CREATE CANONICAL ATOMIC EXPEDITION CLAIM PROCEDURE
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
      -- Check if expedition is finished
      IF v_now_ms >= v_exp_end THEN
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

GRANT EXECUTE ON FUNCTION public.claim_polyspace_expedition(TEXT, TEXT) TO anon, authenticated, service_role;


-- ==============================================================================
-- 3. HARDEN credit_arcade_payout: BLOCK UNVERIFIED DIRECT MINING CLAIMS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.credit_arcade_payout(
  p_player_id TEXT,
  p_amount NUMERIC,
  p_game_name TEXT DEFAULT 'PolySpace Mining'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_clamped_amt NUMERIC;
  v_new_balance NUMERIC;
  v_user RECORD;
  v_clean_game TEXT;
  v_today_str TEXT := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(p_player_id)); 
  END IF;

  IF v_pid IS NULL OR v_pid = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player identity required');
  END IF;

  v_clean_game := LOWER(TRIM(COALESCE(p_game_name, '')));

  -- BLOCK UNVERIFIED MINING/EXPEDITION PAYOUTS: Must use claim_polyspace_expedition
  IF v_clean_game LIKE '%mining%' OR v_clean_game LIKE '%expedition%' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Direct PolySpace Mining payouts are restricted. Use claim_polyspace_expedition.'
    );
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  -- Lock player row
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

  -- Strict Daily Cooldown Enforcement for Allied Pokes and Raids
  IF v_clean_game LIKE '%outpost%' OR v_clean_game LIKE '%poke%' THEN
    -- Maximum 25 PGT for Poke
    v_clamped_amt := LEAST(25.0, p_amount);
    IF (v_user.space_state->>'lastPokeDate') = v_today_str THEN
      RETURN jsonb_build_object('success', false, 'error', 'Allied Outpost already poked today');
    END IF;
    -- Mark today's poke date
    v_user.space_state := jsonb_set(COALESCE(v_user.space_state, '{}'::jsonb), '{lastPokeDate}', to_jsonb(v_today_str));
    UPDATE public.users SET space_state = v_user.space_state WHERE player_id = v_user.player_id;

  ELSIF v_clean_game LIKE '%raid%' THEN
    -- Maximum 35 PGT for Raid
    v_clamped_amt := LEAST(35.0, p_amount);
    IF (v_user.space_state->>'lastRaidDate') = v_today_str THEN
      RETURN jsonb_build_object('success', false, 'error', 'Outpost Raid already launched today');
    END IF;
    -- Mark today's raid date
    v_user.space_state := jsonb_set(COALESCE(v_user.space_state, '{}'::jsonb), '{lastRaidDate}', to_jsonb(v_today_str));
    UPDATE public.users SET space_state = v_user.space_state WHERE player_id = v_user.player_id;

  ELSE
    -- Generic safe clamp
    v_clamped_amt := LEAST(50.0, p_amount);
  END IF;

  v_clamped_amt := ROUND(v_clamped_amt::numeric, 2);

  -- Atomic balance credit
  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_clamped_amt,
      total_earned = COALESCE(total_earned, 0) + v_clamped_amt,
      updated_at = NOW()
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  -- Process referral commissions
  IF v_clamped_amt > 0 AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_referral_commissions') THEN
    BEGIN
      PERFORM process_referral_commissions(v_user.player_id, v_clamped_amt, COALESCE(p_game_name, 'PolySpace Fleet'));
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payout_pgt', v_clamped_amt,
    'new_balance', v_new_balance,
    'game_name', p_game_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_arcade_payout(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;

-- Force PostgREST schema cache reload immediately
NOTIFY pgrst, 'reload schema';

COMMIT;
