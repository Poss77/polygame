-- =========================================================================
-- POLYGAME: WEEKLY COSMIC WORLD BOSS RAID SYSTEM (QUANTUM LEVIATHAN)
-- =========================================================================

-- 1. Ensure columns exist on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS boss_weekly_damage NUMERIC DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alltime_boss_damage NUMERIC DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS boss_attacks_count INTEGER DEFAULT 0;

-- 2. Ensure boss settings columns exist on global_settings
ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS boss_current_hp NUMERIC DEFAULT 5000000;
ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS boss_max_hp NUMERIC DEFAULT 5000000;

-- 3. Atomic RPC: strike_world_boss
-- Records player damage, increases attacks count, and decreases Boss HP
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
  v_new_player_dmg NUMERIC;
  v_alltime_dmg NUMERIC;
  v_attacks INT;
  v_total_server_dmg NUMERIC;
  v_boss_pool NUMERIC := 10000;
  v_boss_hp NUMERIC := 5000000;
  v_boss_max_hp NUMERIC := 5000000;
  v_game_settings JSONB;
BEGIN
  IF p_damage IS NULL OR p_damage <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid damage value.');
  END IF;

  -- Resolve canonical user
  SELECT player_id INTO v_user_id
  FROM users
  WHERE LOWER(player_id) = LOWER(p_player_id)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(p_player_id)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    v_user_id := p_player_id;
  END IF;

  -- Update player weekly and alltime boss stats
  UPDATE users
  SET 
    boss_weekly_damage = COALESCE(boss_weekly_damage, 0) + p_damage,
    alltime_boss_damage = COALESCE(alltime_boss_damage, 0) + p_damage,
    boss_attacks_count = COALESCE(boss_attacks_count, 0) + 1,
    updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_user_id)
  RETURNING boss_weekly_damage, alltime_boss_damage, boss_attacks_count
  INTO v_new_player_dmg, v_alltime_dmg, v_attacks;

  -- Update global boss HP and read pool settings
  SELECT 
    COALESCE(boss_current_hp, 5000000),
    COALESCE(boss_max_hp, 5000000),
    game_payout_settings
  INTO v_boss_hp, v_boss_max_hp, v_game_settings
  FROM global_settings
  WHERE id = 1;

  IF v_game_settings IS NOT NULL AND v_game_settings->'boss' IS NOT NULL THEN
    v_boss_pool := COALESCE((v_game_settings->'boss'->>'weekly_pool_pgt')::NUMERIC, 10000);
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
    'player_weekly_damage', v_new_player_dmg,
    'player_attacks_count', v_attacks,
    'total_server_damage', v_total_server_dmg,
    'boss_current_hp', v_boss_hp,
    'boss_max_hp', v_boss_max_hp,
    'weekly_pool_pgt', v_boss_pool,
    'estimated_share_pct', CASE WHEN v_total_server_dmg > 0 THEN ROUND((v_new_player_dmg / v_total_server_dmg) * 100, 2) ELSE 0 END,
    'estimated_pgt_payout', CASE WHEN v_total_server_dmg > 0 THEN ROUND((v_new_player_dmg / v_total_server_dmg) * v_boss_pool, 2) ELSE 0 END
  );
END;
$$;

-- 4. Atomic RPC: distribute_weekly_boss_prizes
-- Runs at weekly Sunday reset: distributes pool proportionally to attackers & resets stats
CREATE OR REPLACE FUNCTION distribute_weekly_boss_prizes()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_boss_pool NUMERIC := 10000;
  v_total_damage NUMERIC := 0;
  v_game_settings JSONB;
  v_winner RECORD;
  v_payout NUMERIC;
  v_payout_count INT := 0;
  v_distributed_total NUMERIC := 0;
  v_top_hunters JSONB := '[]'::jsonb;
BEGIN
  -- Read configurable boss pool from global_settings
  SELECT game_payout_settings INTO v_game_settings
  FROM global_settings
  WHERE id = 1;

  IF v_game_settings IS NOT NULL AND v_game_settings->'boss' IS NOT NULL THEN
    v_boss_pool := COALESCE((v_game_settings->'boss'->>'weekly_pool_pgt')::NUMERIC, 10000);
  END IF;

  -- Calculate total weekly damage
  SELECT COALESCE(SUM(boss_weekly_damage), 0)
  INTO v_total_damage
  FROM users
  WHERE boss_weekly_damage > 0;

  IF v_total_damage <= 0 OR v_boss_pool <= 0 THEN
    -- Reset Boss HP to Max
    UPDATE global_settings
    SET boss_current_hp = COALESCE(boss_max_hp, 5000000)
    WHERE id = 1;

    RETURN jsonb_build_object(
      'success', true,
      'distributed', false,
      'message', 'No boss damage recorded this week. Boss HP reset.',
      'total_damage', 0,
      'winner_count', 0,
      'pool_pgt', v_boss_pool
    );
  END IF;

  -- Capture Top 3 Boss Hunters for Announcements
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

  -- Reset all players' weekly boss damage to 0
  UPDATE users
  SET boss_weekly_damage = 0
  WHERE boss_weekly_damage > 0;

  -- Restore Boss HP to Max for the new week
  UPDATE global_settings
  SET boss_current_hp = COALESCE(boss_max_hp, 5000000)
  WHERE id = 1;

  RETURN jsonb_build_object(
    'success', true,
    'distributed', true,
    'message', 'Weekly Boss prizes distributed successfully!',
    'winner_count', v_payout_count,
    'total_damage_dealt', v_total_damage,
    'pool_pgt', v_boss_pool,
    'distributed_total_pgt', v_distributed_total,
    'top_hunters', v_top_hunters
  );
END;
$$;
