-- ==============================================================================
-- POLYGAME: ACTIVATE LEVEL 2 QUANTUM LEVIATHAN (7,500,000 HP • 12,000 PGT POOL)
-- ==============================================================================
-- 1. Sets the active Quantum Leviathan to LEVEL 2 for the current week.
-- 2. Configures Max HP to 7,500,000 HP (+50%) and Weekly Prize Pool to 12,000 PGT (+20%).
-- 3. Sets Current HP to 7,500,000 HP.
-- 4. Updates distribute_weekly_boss_prizes() RPC with the new scaling multipliers.
-- ==============================================================================

DO $$
DECLARE
  v_settings JSONB;
BEGIN
  -- 1. Fetch and update game_payout_settings in global_settings for Level 2 (12,000 PGT Pool)
  SELECT game_payout_settings INTO v_settings FROM public.global_settings WHERE id = 1 LIMIT 1;
  IF v_settings IS NULL THEN v_settings := '{}'::jsonb; END IF;
  IF v_settings->'boss' IS NULL THEN
    v_settings := jsonb_set(v_settings, '{boss}', '{"name": "👾 Cosmic World Boss (Quantum Leviathan)", "leaderboard_enabled": true, "vip_only": false}'::jsonb);
  END IF;
  v_settings := jsonb_set(v_settings, '{boss,weekly_pool_pgt}', to_jsonb(12000));

  -- 2. Activate LEVEL 2 in global_settings: 7,500,000 HP and 12,000 PGT Pool
  UPDATE public.global_settings
  SET 
    boss_level = 2,
    boss_max_hp = 7500000,
    boss_current_hp = 7500000,
    game_payout_settings = v_settings,
    updated_at = NOW()
  WHERE id = 1;

  RAISE NOTICE 'SUCCESS: Quantum Leviathan activated at LEVEL 2 (7,500,000 HP • 12,000 PGT Pool).';
END $$;

-- 3. Recreate distribute_weekly_boss_prizes RPC for automated weekly resets
CREATE OR REPLACE FUNCTION distribute_weekly_boss_prizes()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
BEGIN
  -- 1. Fetch current World Boss state
  SELECT 
    COALESCE(boss_level, 1),
    COALESCE(boss_current_hp, 5000000),
    COALESCE(boss_max_hp, 5000000),
    COALESCE((game_payout_settings->'boss'->>'weekly_pool_pgt')::NUMERIC, 10000),
    game_payout_settings
  INTO 
    v_boss_level,
    v_boss_current_hp,
    v_boss_max_hp,
    v_boss_pool,
    v_game_settings
  FROM global_settings
  WHERE id = 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Global settings row not found');
  END IF;

  v_is_slain := (v_boss_current_hp <= 0);

  -- 2. Calculate total weekly damage dealt by players
  SELECT COALESCE(SUM(boss_weekly_damage), 0) INTO v_total_damage
  FROM users
  WHERE boss_weekly_damage > 0;

  -- 3. If Boss was Slain (HP <= 0): Distribute pool & Level Up (+50% HP, +20% Pool)
  IF v_is_slain = true AND v_total_damage > 0 THEN
    FOR v_winner IN
      SELECT 
        player_id,
        COALESCE(username, SUBSTRING(player_id FROM 1 FOR 10)) as username,
        boss_weekly_damage
      FROM users
      WHERE boss_weekly_damage > 0
      ORDER BY boss_weekly_damage DESC
    LOOP
      v_payout := ROUND((v_winner.boss_weekly_damage / v_total_damage) * v_boss_pool, 2);

      IF v_payout_count < 5 THEN
        v_top_hunters := v_top_hunters || jsonb_build_object(
          'name', v_winner.username,
          'damage', v_winner.boss_weekly_damage,
          'payout_pgt', v_payout
        );
      END IF;

      IF v_payout > 0 THEN
        UPDATE users
        SET 
          balance_pgt = COALESCE(balance_pgt, 0) + v_payout,
          total_earned = COALESCE(total_earned, 0) + v_payout,
          updated_at = NOW()
        WHERE player_id = v_winner.player_id;

        v_payout_count := v_payout_count + 1;
        v_distributed_total := v_distributed_total + v_payout;
      END IF;
    END LOOP;

    -- Scale to Next Level: +50% HP, +20% Pool
    v_new_level := v_boss_level + 1;
    v_new_max_hp := ROUND(5000000.0 * POWER(1.50, v_new_level - 1));
    v_new_pool := ROUND(10000.0 * POWER(1.20, v_new_level - 1));

    IF v_game_settings IS NULL THEN v_game_settings := '{}'::jsonb; END IF;
    IF v_game_settings->'boss' IS NULL THEN
      v_game_settings := jsonb_set(v_game_settings, '{boss}', '{"name": "👾 Cosmic World Boss (Quantum Leviathan)", "leaderboard_enabled": true, "vip_only": false}'::jsonb);
    END IF;
    v_game_settings := jsonb_set(v_game_settings, '{boss,weekly_pool_pgt}', to_jsonb(v_new_pool));

    UPDATE global_settings
    SET 
      boss_level = v_new_level,
      boss_max_hp = v_new_max_hp,
      boss_current_hp = v_new_max_hp,
      game_payout_settings = v_game_settings,
      updated_at = NOW()
    WHERE id = 1;

    UPDATE users
    SET boss_weekly_damage = 0
    WHERE boss_weekly_damage > 0;

    RETURN jsonb_build_object(
      'success', true,
      'victory', true,
      'distributed', true,
      'message', 'Quantum Leviathan was slain! Weekly prize pool distributed and Boss ascended to Level ' || v_new_level::TEXT || '!',
      'defeated_level', v_boss_level,
      'next_level', v_new_level,
      'winner_count', v_payout_count,
      'total_damage_dealt', v_total_damage,
      'pool_pgt', v_boss_pool,
      'distributed_total_pgt', v_distributed_total,
      'next_max_hp', v_new_max_hp,
      'next_pool_pgt', v_new_pool,
      'top_hunters', v_top_hunters
    );

  ELSE
    -- Boss survived: Reset to Level 1, withhold pool
    v_new_level := 1;
    v_new_max_hp := 5000000;
    v_new_pool := 10000;

    IF v_game_settings IS NULL THEN v_game_settings := '{}'::jsonb; END IF;
    IF v_game_settings->'boss' IS NULL THEN
      v_game_settings := jsonb_set(v_game_settings, '{boss}', '{"name": "👾 Cosmic World Boss (Quantum Leviathan)", "leaderboard_enabled": true, "vip_only": false}'::jsonb);
    END IF;
    v_game_settings := jsonb_set(v_game_settings, '{boss,weekly_pool_pgt}', to_jsonb(v_new_pool));

    UPDATE global_settings
    SET 
      boss_level = 1,
      boss_max_hp = 5000000,
      boss_current_hp = 5000000,
      game_payout_settings = v_game_settings,
      updated_at = NOW()
    WHERE id = 1;

    UPDATE users
    SET boss_weekly_damage = 0
    WHERE boss_weekly_damage > 0;

    RETURN jsonb_build_object(
      'success', true,
      'victory', false,
      'distributed', false,
      'message', 'Quantum Leviathan was NOT defeated before reset. Prize pool withheld and Boss reset to Level 1.',
      'survived_level', v_boss_level,
      'survived_hp', v_boss_current_hp,
      'next_level', 1,
      'winner_count', 0,
      'total_damage_dealt', v_total_damage,
      'pool_pgt', v_boss_pool,
      'distributed_total_pgt', 0,
      'next_max_hp', 5000000,
      'next_pool_pgt', 10000,
      'top_hunters', '[]'::jsonb
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION distribute_weekly_boss_prizes() TO anon, authenticated, service_role;
