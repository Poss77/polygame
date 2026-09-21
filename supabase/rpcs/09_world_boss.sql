-- 9. COSMIC WORLD BOSS (QUANTUM LEVIATHAN)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: strike_world_boss
-- Source: seal_world_boss_and_minerals_anti_cheat.sql
-- ------------------------------------------------------------------------------
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
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'message', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

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

GRANT EXECUTE ON FUNCTION public.strike_world_boss(TEXT, NUMERIC, NUMERIC) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.strike_world_boss(TEXT, NUMERIC, NUMERIC) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: distribute_weekly_boss_prizes
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.distribute_weekly_boss_prizes(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_boss_level INT := 1;
  v_boss_current_hp NUMERIC := 5000000;
  v_boss_max_hp NUMERIC := 5000000;
  v_boss_pool NUMERIC := 10000;
  v_total_damage NUMERIC := 0;
  v_game_settings JSONB;
  v_winner RECORD;
  v_payout NUMERIC;
  v_payout_count INT := 0;
  v_distributed_total NUMERIC := 0;
  v_top_hunters JSONB := '[]'::jsonb;
  v_new_level INT := 1;
  v_new_max_hp NUMERIC := 5000000;
  v_new_pool NUMERIC := 10000;
  v_is_slain BOOLEAN := false;
  v_configured_pool NUMERIC := NULL;
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  -- Read current Boss state from global_settings
  SELECT 
    COALESCE(boss_level, 1),
    COALESCE(boss_current_hp, 5000000),
    COALESCE(boss_max_hp, 5000000),
    game_payout_settings
  INTO v_boss_level, v_boss_current_hp, v_boss_max_hp, v_game_settings
  FROM public.global_settings
  WHERE id = 1;

  -- Dynamic Prize Pool formula: 10,000 * 1.20^(level - 1)
  v_boss_pool := ROUND(10000.0 * POWER(1.20, GREATEST(0, v_boss_level - 1)));

  IF v_game_settings IS NOT NULL AND v_game_settings->'boss' IS NOT NULL AND (v_game_settings->'boss'->>'weekly_pool_pgt') IS NOT NULL THEN
    v_configured_pool := (v_game_settings->'boss'->>'weekly_pool_pgt')::NUMERIC;
    -- If admin explicitly paused the pool (0 PGT), respect 0
    IF v_configured_pool = 0 THEN
      v_boss_pool := 0;
    -- If admin explicitly configured a custom pool larger than dynamic, honor it
    ELSIF v_configured_pool > v_boss_pool THEN
      v_boss_pool := v_configured_pool;
    END IF;
  END IF;

  -- Calculate total weekly damage dealt across all attacking commanders
  SELECT COALESCE(SUM(boss_weekly_damage), 0)
  INTO v_total_damage
  FROM public.users
  WHERE boss_weekly_damage > 0;

  v_is_slain := (v_boss_current_hp <= 0);

  -- Safety: If pool is set to 0, pause prize distribution but reset weekly damage
  IF v_boss_pool <= 0 THEN
    UPDATE public.users SET boss_weekly_damage = 0 WHERE boss_weekly_damage > 0;
    RETURN jsonb_build_object(
      'success', true,
      'victory', v_is_slain,
      'slain', v_is_slain,
      'distributed', false,
      'message', 'World Boss weekly pool set to 0 PGT. Prize payout paused.',
      'boss_level', v_boss_level,
      'defeated_level', v_boss_level,
      'winner_count', 0,
      'payout_count', 0,
      'distributed_total_pgt', 0,
      'distributed_total', 0,
      'pool_pgt', 0
    );
  END IF;

  -- =========================================================================
  -- CASE A: BOSS WAS SLAIN (HP <= 0) -> VICTORY!
  -- Distribute Prize Pool + Level Up (+50% HP, +20% Pool)
  -- =========================================================================
  IF v_is_slain AND v_total_damage > 0 AND v_boss_pool > 0 THEN
    -- Capture Top 5 Boss Hunters for Announcement
    SELECT jsonb_agg(sub) INTO v_top_hunters
    FROM (
      SELECT 
        COALESCE(NULLIF(username, ''), SUBSTRING(player_id, 1, 8)) AS name,
        boss_weekly_damage AS damage,
        ROUND((boss_weekly_damage / v_total_damage) * v_boss_pool, 2) AS payout_pgt
      FROM public.users
      WHERE boss_weekly_damage > 0
      ORDER BY boss_weekly_damage DESC
      LIMIT 5
    ) sub;

    -- Distribute proportional payouts to all attacking commanders
    FOR v_winner IN
      SELECT player_id, boss_weekly_damage
      FROM public.users
      WHERE boss_weekly_damage > 0
    LOOP
      v_payout := ROUND((v_winner.boss_weekly_damage / v_total_damage) * v_boss_pool, 4);

      IF v_payout > 0 THEN
        UPDATE public.users
        SET 
          balance_pgt = COALESCE(balance_pgt, 0) + v_payout,
          total_earned = COALESCE(total_earned, 0) + v_payout,
          updated_at = NOW()
        WHERE player_id = v_winner.player_id;

        v_payout_count := v_payout_count + 1;
        v_distributed_total := v_distributed_total + v_payout;
      END IF;
    END LOOP;

    -- Calculate Next Week's Scaled Level, HP (+50%), and Pool (+20%)
    v_new_level := v_boss_level + 1;
    v_new_max_hp := ROUND(5000000.0 * POWER(1.50, v_new_level - 1));
    v_new_pool := ROUND(10000.0 * POWER(1.20, v_new_level - 1));

    -- Update game_payout_settings with new pool
    IF v_game_settings IS NULL THEN v_game_settings := '{}'::jsonb; END IF;
    IF v_game_settings->'boss' IS NULL THEN
      v_game_settings := jsonb_set(v_game_settings, '{boss}', '{"name": "👾 Cosmic World Boss (Quantum Leviathan)", "vip_only": false, "test_mode": false, "harvest_enabled": true, "leaderboard_enabled": true}'::jsonb);
    END IF;
    v_game_settings := jsonb_set(v_game_settings, '{boss,weekly_pool_pgt}', to_jsonb(v_new_pool));

    -- Reset Boss to New Scaled Level for the fresh week
    UPDATE public.global_settings
    SET 
      boss_level = v_new_level,
      boss_max_hp = v_new_max_hp,
      boss_current_hp = v_new_max_hp,
      game_payout_settings = v_game_settings,
      updated_at = NOW()
    WHERE id = 1;

    -- Record in boss_reset_history (wrapped in exception block to guarantee safety)
    BEGIN
      INSERT INTO public.boss_reset_history (
        week_label,
        boss_level,
        total_damage,
        distributed_total,
        hunters_count,
        slain,
        top_hunters,
        created_at
      ) VALUES (
        TO_CHAR(NOW(), 'YYYY-MM-DD'),
        v_boss_level,
        v_total_damage,
        v_distributed_total,
        v_payout_count,
        true,
        COALESCE(v_top_hunters, '[]'::jsonb),
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- Reset all players' weekly boss damage to 0
    UPDATE public.users
    SET boss_weekly_damage = 0
    WHERE boss_weekly_damage > 0;

    RETURN jsonb_build_object(
      'success', true,
      'victory', true,
      'slain', true,
      'distributed', true,
      'message', 'Quantum Leviathan was slain! Weekly prize pool distributed and Boss ascended to Level ' || v_new_level::TEXT || '!',
      'defeated_level', v_boss_level,
      'boss_level', v_boss_level,
      'next_level', v_new_level,
      'new_level', v_new_level,
      'winner_count', v_payout_count,
      'payout_count', v_payout_count,
      'hunters_count', v_payout_count,
      'total_damage_dealt', v_total_damage,
      'total_damage', v_total_damage,
      'pool_pgt', v_boss_pool,
      'distributed_total_pgt', v_distributed_total,
      'distributed_total', v_distributed_total,
      'next_max_hp', v_new_max_hp,
      'new_max_hp', v_new_max_hp,
      'next_pool_pgt', v_new_pool,
      'new_pool', v_new_pool,
      'top_hunters', COALESCE(v_top_hunters, '[]'::jsonb)
    );

  -- =========================================================================
  -- CASE B: BOSS SURVIVED (HP > 0) -> ESCAPED!
  -- Withhold Prize Pool (0 PGT) & Reset to Level 1 (5M HP, 10k PGT)
  -- =========================================================================
  ELSE
    v_new_level := 1;
    v_new_max_hp := 5000000;
    v_new_pool := 10000;

    -- Update game_payout_settings to base pool
    IF v_game_settings IS NULL THEN v_game_settings := '{}'::jsonb; END IF;
    IF v_game_settings->'boss' IS NULL THEN
      v_game_settings := jsonb_set(v_game_settings, '{boss}', '{"name": "👾 Cosmic World Boss (Quantum Leviathan)", "vip_only": false, "test_mode": false, "harvest_enabled": true, "leaderboard_enabled": true}'::jsonb);
    END IF;
    v_game_settings := jsonb_set(v_game_settings, '{boss,weekly_pool_pgt}', to_jsonb(v_new_pool));

    -- Reset Boss to Level 1 Base Stats
    UPDATE public.global_settings
    SET 
      boss_level = v_new_level,
      boss_max_hp = v_new_max_hp,
      boss_current_hp = v_new_max_hp,
      game_payout_settings = v_game_settings,
      updated_at = NOW()
    WHERE id = 1;

    -- Record in boss_reset_history
    BEGIN
      INSERT INTO public.boss_reset_history (
        week_label,
        boss_level,
        total_damage,
        distributed_total,
        hunters_count,
        slain,
        top_hunters,
        created_at
      ) VALUES (
        TO_CHAR(NOW(), 'YYYY-MM-DD'),
        v_boss_level,
        v_total_damage,
        0,
        0,
        false,
        '[]'::jsonb,
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- Reset all players' weekly boss damage to 0
    UPDATE public.users
    SET boss_weekly_damage = 0
    WHERE boss_weekly_damage > 0;

    RETURN jsonb_build_object(
      'success', true,
      'victory', false,
      'slain', false,
      'distributed', false,
      'message', 'Quantum Leviathan escaped! Level reset to 1 for the fresh week.',
      'boss_level', v_boss_level,
      'defeated_level', v_boss_level,
      'next_level', 1,
      'new_level', 1,
      'winner_count', 0,
      'payout_count', 0,
      'hunters_count', 0,
      'total_damage_dealt', v_total_damage,
      'total_damage', v_total_damage,
      'survived_hp', GREATEST(0, v_boss_current_hp),
      'boss_current_hp', GREATEST(0, v_boss_current_hp),
      'pool_pgt', v_boss_pool,
      'distributed_total_pgt', 0,
      'distributed_total', 0,
      'next_max_hp', v_new_max_hp,
      'new_max_hp', v_new_max_hp,
      'next_pool_pgt', v_new_pool,
      'new_pool', v_new_pool,
      'top_hunters', '[]'::jsonb
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.distribute_weekly_boss_prizes(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.distribute_weekly_boss_prizes(TEXT) FROM anon, authenticated;


-- ==============================================================================
