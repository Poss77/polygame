-- ==============================================================================
-- POLYGAME: QUANTUM LEVIATHAN WEEKLY LEVEL SCALING & KILL-GATED POOL RULES
-- ==============================================================================
-- 1. Adds `boss_level` to global_settings (default 1).
-- 2. Updates `strike_world_boss` to include live boss level and slain status.
-- 3. Updates `distribute_weekly_boss_prizes`:
--    - If Boss is Slain (HP <= 0): Distributes PGT pool proportionally to attackers,
--      levels up Boss (+1 Level), increases Max HP by +20% and Weekly Pool by +10%.
--    - If Boss Survived (HP > 0): Withholds prize pool (0 PGT paid), resets Boss
--      to Level 1 (5,000,000 HP, 10,000 PGT Pool).
-- ==============================================================================

-- 1. Ensure columns exist on global_settings
ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS boss_level INTEGER DEFAULT 1;
ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS boss_current_hp NUMERIC DEFAULT 5000000;
ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS boss_max_hp NUMERIC DEFAULT 5000000;

-- 2. Ensure columns exist on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS boss_weekly_damage NUMERIC DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alltime_boss_damage NUMERIC DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS boss_attacks_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS space_state JSONB DEFAULT '{}'::jsonb;

-- 3. Atomic RPC: strike_world_boss
CREATE OR REPLACE FUNCTION strike_world_boss(
  p_player_id TEXT,
  p_damage NUMERIC,
  p_crystals_cost NUMERIC DEFAULT 1000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id TEXT;
  v_space_state JSONB;
  v_current_quantum NUMERIC := 0;
  v_new_quantum NUMERIC := 0;
  v_strikes_count INT := 1;
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
  -- Basic sanity validation
  IF p_damage IS NULL OR p_damage <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid strike damage value.');
  END IF;

  IF p_crystals_cost IS NULL OR p_crystals_cost < 1000 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Striking the World Boss requires at least 1,000 Quantum Crystals.');
  END IF;

  v_strikes_count := GREATEST(1, FLOOR(p_crystals_cost / 1000));

  -- Resolve canonical user with row lock for atomic crystal deduction
  SELECT player_id, space_state 
  INTO v_user_id, v_space_state
  FROM users
  WHERE LOWER(player_id) = LOWER(p_player_id)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(p_player_id)
  LIMIT 1
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player account not found.');
  END IF;

  -- Read available Quantum Crystals from player space_state
  v_current_quantum := COALESCE((v_space_state->>'quantum')::NUMERIC, 0);

  -- STRICT SECURITY GUARD: Reject if player does not have enough Quantum Crystals
  IF v_current_quantum < p_crystals_cost THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient Quantum Crystals! You have ' || v_current_quantum::INT::TEXT || ' but need ' || p_crystals_cost::INT::TEXT || ' Crystals.'
    );
  END IF;

  -- Deduct Quantum Crystals server-side from space_state
  v_new_quantum := GREATEST(0, v_current_quantum - p_crystals_cost);
  v_space_state := jsonb_set(
    COALESCE(v_space_state, '{}'::jsonb),
    '{quantum}',
    to_jsonb(v_new_quantum)
  );

  -- Update player weekly & alltime boss stats + new space_state
  UPDATE users
  SET 
    space_state = v_space_state,
    boss_weekly_damage = COALESCE(boss_weekly_damage, 0) + p_damage,
    alltime_boss_damage = COALESCE(alltime_boss_damage, 0) + p_damage,
    boss_attacks_count = COALESCE(boss_attacks_count, 0) + v_strikes_count,
    updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_user_id)
  RETURNING boss_weekly_damage, alltime_boss_damage, boss_attacks_count
  INTO v_new_player_dmg, v_alltime_dmg, v_attacks;

  -- Update global boss HP and read level/pool settings
  SELECT 
    COALESCE(boss_level, 1),
    COALESCE(boss_current_hp, 5000000),
    COALESCE(boss_max_hp, 5000000),
    game_payout_settings
  INTO v_boss_level, v_boss_hp, v_boss_max_hp, v_game_settings
  FROM global_settings
  WHERE id = 1;

  -- Calculate dynamically scaled pool based on level (10,000 * 1.10^(level-1))
  v_boss_pool := ROUND(10000.0 * POWER(1.10, GREATEST(0, v_boss_level - 1)));
  IF v_game_settings IS NOT NULL AND v_game_settings->'boss' IS NOT NULL AND (v_game_settings->'boss'->>'weekly_pool_pgt') IS NOT NULL THEN
    v_boss_pool := COALESCE((v_game_settings->'boss'->>'weekly_pool_pgt')::NUMERIC, v_boss_pool);
  END IF;

  v_boss_hp := GREATEST(0, v_boss_hp - p_damage);

  UPDATE global_settings
  SET boss_current_hp = v_boss_hp
  WHERE id = 1;

  -- Get total server weekly damage
  SELECT COALESCE(SUM(boss_weekly_damage), 0)
  INTO v_total_server_dmg
  FROM users
  WHERE boss_weekly_damage > 0;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_user_id,
    'strike_damage', p_damage,
    'crystals_deducted', p_crystals_cost,
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
GRANT EXECUTE ON FUNCTION strike_world_boss(TEXT, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

-- 4. Atomic RPC: distribute_weekly_boss_prizes
-- Runs at weekly Sunday reset:
-- IF HP <= 0 (Slain): Distributes pool proportionally to attackers, +1 Level (+20% HP, +10% Pool).
-- IF HP > 0 (Survived): Withholds pool (0 PGT), resets to Level 1.
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
  -- Read current Boss state from global_settings
  SELECT 
    COALESCE(boss_level, 1),
    COALESCE(boss_current_hp, 5000000),
    COALESCE(boss_max_hp, 5000000),
    game_payout_settings
  INTO v_boss_level, v_boss_current_hp, v_boss_max_hp, v_game_settings
  FROM global_settings
  WHERE id = 1;

  -- Calculate current active pool
  v_boss_pool := ROUND(10000.0 * POWER(1.10, GREATEST(0, v_boss_level - 1)));
  IF v_game_settings IS NOT NULL AND v_game_settings->'boss' IS NOT NULL AND (v_game_settings->'boss'->>'weekly_pool_pgt') IS NOT NULL THEN
    v_boss_pool := COALESCE((v_game_settings->'boss'->>'weekly_pool_pgt')::NUMERIC, v_boss_pool);
  END IF;

  -- Calculate total weekly damage dealt by players
  SELECT COALESCE(SUM(boss_weekly_damage), 0)
  INTO v_total_damage
  FROM users
  WHERE boss_weekly_damage > 0;

  v_is_slain := (v_boss_current_hp <= 0);

  -- =========================================================================
  -- CASE A: BOSS WAS SLAIN (HP <= 0) -> VICTORY!
  -- Distribute Prize Pool + Level Up (+20% HP, +10% Pool)
  -- =========================================================================
  IF v_is_slain AND v_total_damage > 0 AND v_boss_pool > 0 THEN
    -- Capture Top 3 Boss Hunters for Announcement
    SELECT jsonb_agg(sub) INTO v_top_hunters
    FROM (
      SELECT 
        COALESCE(NULLIF(username, ''), SUBSTRING(player_id, 1, 8)) AS name,
        boss_weekly_damage AS damage,
        ROUND((boss_weekly_damage / v_total_damage) * v_boss_pool, 2) AS payout_pgt
      FROM users
      WHERE boss_weekly_damage > 0
      ORDER BY boss_weekly_damage DESC
      LIMIT 3
    ) sub;

    -- Distribute proportional payouts to all attackers
    FOR v_winner IN
      SELECT player_id, boss_weekly_damage
      FROM users
      WHERE boss_weekly_damage > 0
    LOOP
      v_payout := ROUND((v_winner.boss_weekly_damage / v_total_damage) * v_boss_pool, 4);

      IF v_payout > 0 THEN
        UPDATE users
        SET 
          balance_pgt = COALESCE(balance_pgt, 0) + v_payout,
          updated_at = NOW()
        WHERE player_id = v_winner.player_id;

        v_payout_count := v_payout_count + 1;
        v_distributed_total := v_distributed_total + v_payout;
      END IF;
    END LOOP;

    -- Calculate Next Week's Scaled Level, HP (+20%), and Pool (+10%)
    v_new_level := v_boss_level + 1;
    v_new_max_hp := ROUND(5000000.0 * POWER(1.20, v_new_level - 1));
    v_new_pool := ROUND(10000.0 * POWER(1.10, v_new_level - 1));

    -- Update game_payout_settings with new pool
    IF v_game_settings IS NULL THEN v_game_settings := '{}'::jsonb; END IF;
    IF v_game_settings->'boss' IS NULL THEN
      v_game_settings := jsonb_set(v_game_settings, '{boss}', '{"name": "👾 Cosmic World Boss (Quantum Leviathan)", "leaderboard_enabled": true, "vip_only": false}'::jsonb);
    END IF;
    v_game_settings := jsonb_set(v_game_settings, '{boss,weekly_pool_pgt}', to_jsonb(v_new_pool));

    -- Reset Boss to New Scaled Level for the fresh week
    UPDATE global_settings
    SET 
      boss_level = v_new_level,
      boss_max_hp = v_new_max_hp,
      boss_current_hp = v_new_max_hp,
      game_payout_settings = v_game_settings,
      updated_at = NOW()
    WHERE id = 1;

    -- Reset all players' weekly boss damage to 0
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

  -- =========================================================================
  -- CASE B: BOSS SURVIVED (HP > 0) -> DEFEAT / ESCAPED!
  -- Withhold Prize Pool (0 PGT) & Reset to Level 1 (5M HP, 10k PGT)
  -- =========================================================================
  ELSE
    v_new_level := 1;
    v_new_max_hp := 5000000;
    v_new_pool := 10000;

    -- Update game_payout_settings to base pool
    IF v_game_settings IS NULL THEN v_game_settings := '{}'::jsonb; END IF;
    IF v_game_settings->'boss' IS NULL THEN
      v_game_settings := jsonb_set(v_game_settings, '{boss}', '{"name": "👾 Cosmic World Boss (Quantum Leviathan)", "leaderboard_enabled": true, "vip_only": false}'::jsonb);
    END IF;
    v_game_settings := jsonb_set(v_game_settings, '{boss,weekly_pool_pgt}', to_jsonb(v_new_pool));

    -- Reset Boss to Level 1
    UPDATE global_settings
    SET 
      boss_level = 1,
      boss_max_hp = 5000000,
      boss_current_hp = 5000000,
      game_payout_settings = v_game_settings,
      updated_at = NOW()
    WHERE id = 1;

    -- Reset all players' weekly boss damage to 0
    UPDATE users
    SET boss_weekly_damage = 0
    WHERE boss_weekly_damage > 0;

    RETURN jsonb_build_object(
      'success', true,
      'victory', false,
      'distributed', false,
      'message', 'Quantum Leviathan was NOT defeated before reset (survived with ' || v_boss_current_hp::BIGINT::TEXT || ' HP). Prize pool withheld and Boss reset to Level 1.',
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
