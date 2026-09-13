-- ==============================================================================
-- POLYGAME: SEAL WORLD BOSS DAMAGE & SPACE MINERALS ANTI-CHEAT SENTINEL
-- Version: 1.5.336
-- ==============================================================================
-- 1. HARDEN `strike_world_boss`:
--    - Eliminates client-supplied damage vulnerability.
--    - Calculates damage deterministically on PostgreSQL from verified fleetPower
--      and laserLevel (crit chance: 10% + laserLevel * 2.5%, max 50%).
--    - Client `p_damage` parameter is completely ignored / discarded.
--    - Atomic row locking prevents concurrent double-spend of Quantum Crystals.
-- 2. DEPLOY `smelt_space_ore`:
--    - Atomic server-side ore refinery RPC.
--    - Validates recipe costs, deducts input minerals, and credits output minerals.
-- 3. DEPLOY `scan_polyspace_anomaly`:
--    - Atomic server-side anomaly scanning RPC.
--    - Enforces 6-hour cooldown strictly on server.
--    - Deterministically rolls rewards (wormhole timer reduction, minerals).
-- 4. UPDATE `credit_arcade_payout`:
--    - Securely awards Allied Outpost Poke iron bonus (20 * warpLevel).
--    - Securely awards Outpost Raid stolen minerals (+25-50 iron, +5-10 tit).
-- 5. UPGRADE `prevent_direct_balance_mutation` TRIGGER:
--    - Rejects and reverts any client attempt ('anon', 'authenticated') to increase
--      `iron`, `titanium`, `quantum`, or `pgtOre` in `users.space_state`.
--    - Enforces baseline starting minerals on new account creation.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- STEP 1: RECREATE CANONICAL ATOMIC strike_world_boss RPC
-- ==============================================================================
DROP FUNCTION IF EXISTS public.strike_world_boss(TEXT, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.strike_world_boss(TEXT, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.strike_world_boss(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.strike_world_boss(
  p_player_id TEXT,
  p_damage NUMERIC DEFAULT NULL,
  p_crystals_cost NUMERIC DEFAULT 1000
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
  v_current_quantum NUMERIC := 0;
  v_new_quantum NUMERIC := 0;
  v_strikes_count INT := 1;
  v_actual_cost NUMERIC := 1000;
  
  -- Fleet power & combat stats computed strictly server-side
  v_warp INT := 1;
  v_laser INT := 1;
  v_cargo INT := 1;
  v_shield INT := 1;
  v_turret INT := 1;
  v_fleet_power INT := 100;
  v_crit_chance NUMERIC := 0.10;
  v_server_strike_dmg NUMERIC := 0;
  v_server_crit_count INT := 0;
  v_single_dmg NUMERIC;
  
  v_new_player_dmg NUMERIC;
  v_alltime_dmg NUMERIC;
  v_attacks INT;
  v_total_server_dmg NUMERIC;
  v_boss_level INT := 1;
  v_boss_pool NUMERIC := 10000;
  v_boss_hp NUMERIC := 5000000;
  v_boss_max_hp NUMERIC := 5000000;
  v_game_settings JSONB;
BEGIN
  -- 1. Identity Resolution
  v_pid := public.resolve_player_id(COALESCE(p_player_id, auth.jwt() ->> 'sub', ''));
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_player_id, '')));
  END IF;

  IF v_pid IS NULL OR v_pid = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player identity required.');
  END IF;

  -- 2. Validate Crystal Cost & Strikes
  IF p_crystals_cost IS NULL OR p_crystals_cost < 1000 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Striking the World Boss requires at least 1,000 Quantum Crystals.');
  END IF;

  v_strikes_count := GREATEST(1, FLOOR(p_crystals_cost / 1000));
  v_actual_cost := v_strikes_count * 1000;

  -- 3. Acquire Pessimistic Row Lock (prevents concurrent crystal spending)
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

  -- 4. Verify Quantum Crystal balance
  v_current_quantum := COALESCE((v_space_state->>'quantum')::NUMERIC, 0);
  IF v_current_quantum < v_actual_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient Quantum Crystals! You have ' || FLOOR(v_current_quantum)::TEXT || ' but need ' || v_actual_cost::TEXT || ' Crystals.'
    );
  END IF;

  -- 5. DETERMINISTIC SERVER-SIDE COMBAT CALCULATION (Client p_damage is 100% IGNORED)
  v_warp   := GREATEST(1, COALESCE((v_space_state->>'warpLevel')::INT, 1));
  v_laser  := GREATEST(1, COALESCE((v_space_state->>'laserLevel')::INT, 1));
  v_cargo  := GREATEST(1, COALESCE((v_space_state->>'cargoLevel')::INT, 1));
  v_shield := GREATEST(1, COALESCE((v_space_state->>'shieldLevel')::INT, 1));
  v_turret := GREATEST(1, COALESCE((v_space_state->>'turretLevel')::INT, 1));

  -- Fleet Power: (warp * 100) + (laser * 80) + (cargo * 50) + (shield * 60) + (turret * 90)
  v_fleet_power := (v_warp * 100) + (v_laser * 80) + (v_cargo * 50) + (v_shield * 60) + (v_turret * 90);
  v_fleet_power := GREATEST(100, v_fleet_power);

  -- Critical strike chance: 10% base + 2.5% per laser level, capped at 50%
  v_crit_chance := LEAST(0.50, 0.10 + (v_laser * 0.025));

  -- Simulate strikes deterministically
  v_server_strike_dmg := 0;
  v_server_crit_count := 0;

  FOR i IN 1..v_strikes_count LOOP
    -- Single strike damage: (fleetPower * 12) * (0.90 + random() * 0.35)
    v_single_dmg := FLOOR((v_fleet_power * 12) * (0.90 + (random() * 0.35)));
    IF random() < v_crit_chance THEN
      v_single_dmg := FLOOR(v_single_dmg * 1.85);
      v_server_crit_count := v_server_crit_count + 1;
    END IF;
    v_server_strike_dmg := v_server_strike_dmg + v_single_dmg;
  END LOOP;

  -- 6. Deduct Crystals & Update Space State
  v_new_quantum := GREATEST(0, v_current_quantum - v_actual_cost);
  v_space_state := jsonb_set(v_space_state, '{quantum}', to_jsonb(v_new_quantum));

  -- 7. Atomically Update Player Boss Damage
  UPDATE public.users
  SET 
    space_state = v_space_state,
    boss_weekly_damage = COALESCE(boss_weekly_damage, 0) + v_server_strike_dmg,
    alltime_boss_damage = COALESCE(alltime_boss_damage, 0) + v_server_strike_dmg,
    boss_attacks_count = COALESCE(boss_attacks_count, 0) + v_strikes_count,
    updated_at = NOW()
  WHERE player_id = v_user.player_id
  RETURNING boss_weekly_damage, alltime_boss_damage, boss_attacks_count
  INTO v_new_player_dmg, v_alltime_dmg, v_attacks;

  -- 8. Update Global Boss Health & Read Level Settings
  SELECT 
    COALESCE(boss_level, 1),
    COALESCE(boss_current_hp, 5000000),
    COALESCE(boss_max_hp, 5000000),
    game_payout_settings
  INTO v_boss_level, v_boss_hp, v_boss_max_hp, v_game_settings
  FROM public.global_settings
  WHERE id = 1;

  -- Calculate dynamically scaled pool based on level (10,000 * 1.10^(level-1))
  v_boss_pool := ROUND(10000.0 * POWER(1.10, GREATEST(0, v_boss_level - 1)));
  IF v_game_settings IS NOT NULL AND v_game_settings->'boss' IS NOT NULL AND (v_game_settings->'boss'->>'weekly_pool_pgt') IS NOT NULL THEN
    v_boss_pool := COALESCE((v_game_settings->'boss'->>'weekly_pool_pgt')::NUMERIC, v_boss_pool);
  END IF;

  v_boss_hp := GREATEST(0, v_boss_hp - v_server_strike_dmg);

  UPDATE public.global_settings
  SET boss_current_hp = v_boss_hp
  WHERE id = 1;

  -- 9. Read Global Weekly Total Damage
  SELECT COALESCE(SUM(boss_weekly_damage), 0)
  INTO v_total_server_dmg
  FROM public.users
  WHERE boss_weekly_damage > 0;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_user.player_id,
    'strike_damage', v_server_strike_dmg,
    'critical_hits', v_server_crit_count,
    'crystals_deducted', v_actual_cost,
    'remaining_quantum', v_new_quantum,
    'player_weekly_damage', v_new_player_dmg,
    'player_attacks_count', v_attacks,
    'total_server_damage', v_total_server_dmg,
    'boss_level', v_boss_level,
    'boss_current_hp', v_boss_hp,
    'boss_max_hp', v_boss_max_hp,
    'boss_is_slain', (v_boss_hp <= 0),
    'weekly_pool_pgt', v_boss_pool,
    'estimated_share_pct', CASE WHEN v_total_server_dmg > 0 THEN ROUND((v_new_player_dmg / v_total_server_dmg) * 100, 2) ELSE 0 END,
    'estimated_pgt_payout', CASE WHEN v_total_server_dmg > 0 THEN ROUND((v_new_player_dmg / v_total_server_dmg) * v_boss_pool, 2) ELSE 0 END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.strike_world_boss(TEXT, NUMERIC, NUMERIC) TO anon, authenticated, service_role;


-- ==============================================================================
-- STEP 2: CREATE CANONICAL ATOMIC smelt_space_ore RPC
-- ==============================================================================
DROP FUNCTION IF EXISTS public.smelt_space_ore(TEXT, TEXT) CASCADE;

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
BEGIN
  -- 1. Identity Resolution
  v_pid := public.resolve_player_id(COALESCE(p_player_id, auth.jwt() ->> 'sub', ''));
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_player_id, '')));
  END IF;

  IF v_pid IS NULL OR v_pid = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player identity required.');
  END IF;

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

GRANT EXECUTE ON FUNCTION public.smelt_space_ore(TEXT, TEXT) TO anon, authenticated, service_role;


-- ==============================================================================
-- STEP 3: CREATE CANONICAL ATOMIC scan_polyspace_anomaly RPC
-- ==============================================================================
DROP FUNCTION IF EXISTS public.scan_polyspace_anomaly(TEXT) CASCADE;

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
BEGIN
  -- 1. Identity Resolution
  v_pid := public.resolve_player_id(COALESCE(p_player_id, auth.jwt() ->> 'sub', ''));
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_player_id, '')));
  END IF;

  IF v_pid IS NULL OR v_pid = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player identity required.');
  END IF;

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

GRANT EXECUTE ON FUNCTION public.scan_polyspace_anomaly(TEXT) TO anon, authenticated, service_role;


-- ==============================================================================
-- STEP 4: UPDATE credit_arcade_payout TO AWARD POKE & RAID MINERALS SERVER-SIDE
-- ==============================================================================
DROP FUNCTION IF EXISTS public.credit_arcade_payout(TEXT, NUMERIC, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.credit_arcade_payout(TEXT, NUMERIC) CASCADE;

CREATE OR REPLACE FUNCTION public.credit_arcade_payout(
  p_player_id TEXT,
  p_amount NUMERIC,
  p_game_name TEXT DEFAULT 'PolySpace Mining'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_clamped_amt NUMERIC;
  v_new_balance NUMERIC;
  v_user RECORD;
  v_clean_game TEXT;
  v_today_str TEXT := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_space_state JSONB;
  
  -- Outpost Poke / Raid mineral additions
  v_warp INT := 1;
  v_bonus_iron NUMERIC := 0;
  v_stolen_iron NUMERIC := 0;
  v_stolen_tit NUMERIC := 0;
  v_cur_iron NUMERIC := 0;
  v_cur_tit NUMERIC := 0;
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

  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);

  -- Strict Daily Cooldown Enforcement for Allied Pokes and Raids
  IF v_clean_game LIKE '%outpost%' OR v_clean_game LIKE '%poke%' THEN
    -- Maximum 25 PGT for Poke
    v_clamped_amt := LEAST(25.0, p_amount);
    IF (v_space_state->>'lastPokeDate') = v_today_str THEN
      RETURN jsonb_build_object('success', false, 'error', 'Allied Outpost already poked today');
    END IF;

    -- Award Poke Iron Bonus server-side: 20 * warpLevel
    v_warp := GREATEST(1, COALESCE((v_space_state->>'warpLevel')::INT, 1));
    v_bonus_iron := 20 * v_warp;
    v_cur_iron := COALESCE((v_space_state->>'iron')::NUMERIC, 0) + v_bonus_iron;
    
    v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(v_cur_iron));
    v_space_state := jsonb_set(v_space_state, '{lastPokeDate}', to_jsonb(v_today_str));

  ELSIF v_clean_game LIKE '%raid%' THEN
    -- Maximum 35 PGT for Raid
    v_clamped_amt := LEAST(35.0, p_amount);
    IF (v_space_state->>'lastRaidDate') = v_today_str THEN
      RETURN jsonb_build_object('success', false, 'error', 'Outpost Raid already launched today');
    END IF;

    -- Award Raid Stolen Minerals server-side: 25-50 iron, 5-10 titanium (minus 15 iron fuel)
    v_cur_iron := COALESCE((v_space_state->>'iron')::NUMERIC, 0);
    v_cur_tit := COALESCE((v_space_state->>'titanium')::NUMERIC, 0);
    v_stolen_iron := FLOOR(25 + random() * 25);
    v_stolen_tit := FLOOR(5 + random() * 10);
    v_cur_iron := GREATEST(0, v_cur_iron - 15) + v_stolen_iron;
    v_cur_tit := v_cur_tit + v_stolen_tit;

    v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(v_cur_iron));
    v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(v_cur_tit));
    v_space_state := jsonb_set(v_space_state, '{lastRaidDate}', to_jsonb(v_today_str));

  ELSE
    -- Generic safe clamp
    v_clamped_amt := LEAST(50.0, p_amount);
  END IF;

  v_clamped_amt := ROUND(v_clamped_amt::numeric, 2);

  -- Atomic balance credit and space state update
  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_clamped_amt,
      total_earned = COALESCE(total_earned, 0) + v_clamped_amt,
      space_state = v_space_state,
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
    'amount', v_clamped_amt,
    'new_balance', v_new_balance,
    'space_state', v_space_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_arcade_payout(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;


-- ==============================================================================
-- STEP 5: UPGRADE prevent_direct_balance_mutation TRIGGER FUNCTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Restrict direct PostgREST client requests (anon & authenticated roles)
  IF CURRENT_USER IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      -- Sanitize newly inserted accounts against elevated balances
      NEW.balance_pgt := 0.0;
      NEW.is_admin := false;
      NEW.is_ambassador := false;
      NEW.is_banned := false;
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

      -- Ensure new accounts start with baseline Level 1 modules and default minerals
      IF NEW.space_state IS NOT NULL THEN
        NEW.space_state := jsonb_set(NEW.space_state, '{warpLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{laserLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{cargoLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{shieldLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{turretLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{fleetPower}', '380'::jsonb);
        -- Clamp initial starting minerals: max 50 iron, 10 titanium, 0 quantum, 0 pgtOre
        NEW.space_state := jsonb_set(NEW.space_state, '{iron}', to_jsonb(LEAST(COALESCE((NEW.space_state->>'iron')::numeric, 50), 50)));
        NEW.space_state := jsonb_set(NEW.space_state, '{titanium}', to_jsonb(LEAST(COALESCE((NEW.space_state->>'titanium')::numeric, 10), 10)));
        NEW.space_state := jsonb_set(NEW.space_state, '{quantum}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{pgtOre}', '0'::jsonb);
      END IF;

    ELSIF TG_OP = 'UPDATE' THEN
      -- 1. Immutable registration timestamp
      IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        NEW.created_at := OLD.created_at;
      END IF;

      -- 2. Immutable balances (PGT balance mutations MUST go through SECURITY DEFINER RPCs)
      IF NEW.balance_pgt IS DISTINCT FROM OLD.balance_pgt THEN
        NEW.balance_pgt := OLD.balance_pgt;
      END IF;

      -- 3. Immutable roles and VIP / ban status
      IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
        NEW.is_admin := OLD.is_admin;
      END IF;
      IF NEW.is_ambassador IS DISTINCT FROM OLD.is_ambassador THEN
        NEW.is_ambassador := OLD.is_ambassador;
      END IF;
      IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
        NEW.is_banned := OLD.is_banned;
      END IF;
      IF NEW.vip_until IS DISTINCT FROM OLD.vip_until THEN
        NEW.vip_until := OLD.vip_until;
      END IF;

      -- 4. Immutable career total_arcade_plays (server RPC controlled only)
      IF NEW.total_arcade_plays IS DISTINCT FROM OLD.total_arcade_plays THEN
        NEW.total_arcade_plays := OLD.total_arcade_plays;
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
      IF NEW.last_weekly_active_tier IS DISTINCT FROM OLD.last_weekly_active_tier THEN
        NEW.last_weekly_active_tier := OLD.last_weekly_active_tier;
      END IF;

      -- 7. Immutable career earnings & referral balances
      IF NEW.total_earned IS DISTINCT FROM OLD.total_earned THEN
        NEW.total_earned := OLD.total_earned;
      END IF;
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

      -- 8. Immutable tournament scores & boss metrics
      IF NEW.game_highscore IS DISTINCT FROM OLD.game_highscore THEN
        NEW.game_highscore := OLD.game_highscore;
      END IF;
      IF NEW.invaders_highscore IS DISTINCT FROM OLD.invaders_highscore THEN
        NEW.invaders_highscore := OLD.invaders_highscore;
      END IF;
      IF NEW.drift_highscore IS DISTINCT FROM OLD.drift_highscore THEN
        NEW.drift_highscore := OLD.drift_highscore;
      END IF;
      IF NEW.stacker_highscore IS DISTINCT FROM OLD.stacker_highscore THEN
        NEW.stacker_highscore := OLD.stacker_highscore;
      END IF;
      IF NEW.skeet_highscore IS DISTINCT FROM OLD.skeet_highscore THEN
        NEW.skeet_highscore := OLD.skeet_highscore;
      END IF;
      IF NEW.defense_highscore IS DISTINCT FROM OLD.defense_highscore THEN
        NEW.defense_highscore := OLD.defense_highscore;
      END IF;
      IF NEW.boss_weekly_damage IS DISTINCT FROM OLD.boss_weekly_damage THEN
        NEW.boss_weekly_damage := OLD.boss_weekly_damage;
      END IF;
      IF NEW.alltime_boss_damage IS DISTINCT FROM OLD.alltime_boss_damage THEN
        NEW.alltime_boss_damage := OLD.alltime_boss_damage;
      END IF;
      IF NEW.boss_attacks_count IS DISTINCT FROM OLD.boss_attacks_count THEN
        NEW.boss_attacks_count := OLD.boss_attacks_count;
      END IF;

      -- 9. IMMUTABLE POLYSPACE MODULE LEVELS & INVENTORY ON DIRECT CLIENT UPDATES
      -- Direct PostgREST client updates cannot increase module levels or mineral balances.
      -- Upgrades and mineral gains MUST occur through authoritative server RPCs:
      -- (upgrade_polyspace_module, claim_polyspace_expedition, smelt_space_ore, scan_polyspace_anomaly, credit_arcade_payout)
      IF NEW.space_state IS NOT NULL THEN
        IF OLD.space_state IS NOT NULL THEN
          -- Revert any client attempt to increase module levels
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

          -- Revert any client attempt to increase raw minerals
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
        END IF;

        -- Enforce deterministic fleetPower calculation strictly from validated module levels
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
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_balance_mutation ON public.users;
CREATE TRIGGER trg_prevent_direct_balance_mutation
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_balance_mutation();

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

COMMIT;
