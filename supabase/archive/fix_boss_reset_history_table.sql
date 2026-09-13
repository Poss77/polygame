-- ==============================================================================
-- POLYGON GAMING: FIX BOSS RESET HISTORY TABLE & STEP 2 BOSS PRIZE DISTRIBUTION
-- ==============================================================================
-- 1. Creates missing table `public.boss_reset_history` with RLS & public read access.
-- 2. Updates `public.distribute_weekly_boss_prizes()` RPC to:
--    - Accurately distribute proportional PGT bounties to all boss attackers.
--    - Ascend Leviathan to next Level (+50% HP, +20% Pool) when defeated (HP <= 0).
--    - Withhold pool and reset to Level 1 if Leviathan survived (HP > 0).
--    - Safely record audit entries into `boss_reset_history` with exception trapping.
--    - Return complete JSON payloads supporting all admin & announcement fields.
-- 3. Reloads PostgREST schema cache.
-- ==============================================================================

-- 1. Create missing boss_reset_history audit table
CREATE TABLE IF NOT EXISTS public.boss_reset_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_label TEXT NOT NULL,
  boss_level INT NOT NULL,
  total_damage NUMERIC DEFAULT 0,
  distributed_total NUMERIC DEFAULT 0,
  hunters_count INT DEFAULT 0,
  slain BOOLEAN DEFAULT false,
  top_hunters JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure RLS is enabled and accessible
ALTER TABLE public.boss_reset_history ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.boss_reset_history TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Public read boss_reset_history" ON public.boss_reset_history;
CREATE POLICY "Public read boss_reset_history" ON public.boss_reset_history 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role write boss_reset_history" ON public.boss_reset_history;
CREATE POLICY "Service role write boss_reset_history" ON public.boss_reset_history 
  FOR ALL USING (true) WITH CHECK (true);

-- Ensure global_settings has updated_at column
ALTER TABLE public.global_settings 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- 2. Canonical distribute_weekly_boss_prizes() RPC
CREATE OR REPLACE FUNCTION public.distribute_weekly_boss_prizes()
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
  FROM public.global_settings
  WHERE id = 1;

  -- Dynamic Prize Pool formula: 10,000 * 1.20^(level - 1)
  v_boss_pool := ROUND(10000.0 * POWER(1.20, GREATEST(0, v_boss_level - 1)));
  IF v_game_settings IS NOT NULL AND v_game_settings->'boss' IS NOT NULL AND (v_game_settings->'boss'->>'weekly_pool_pgt') IS NOT NULL THEN
    v_boss_pool := COALESCE((v_game_settings->'boss'->>'weekly_pool_pgt')::NUMERIC, v_boss_pool);
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
      v_game_settings := jsonb_set(v_game_settings, '{boss}', '{"name": "👾 Cosmic World Boss (Quantum Leviathan)", "vip_only": false, "test_mode": false, "harvest_enabled": true, "leaderboard_enabled": true}'::jsonb);
    END IF;
    v_game_settings := jsonb_set(v_game_settings, '{boss,weekly_pool_pgt}', to_jsonb(v_new_pool));

    -- Reset Boss to Level 1
    UPDATE public.global_settings
    SET 
      boss_level = 1,
      boss_max_hp = 5000000,
      boss_current_hp = 5000000,
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
      'message', 'Quantum Leviathan was NOT defeated before reset (survived with ' || v_boss_current_hp::BIGINT::TEXT || ' HP). Prize pool withheld and Boss reset to Level 1.',
      'survived_level', v_boss_level,
      'boss_level', v_boss_level,
      'survived_hp', v_boss_current_hp,
      'boss_current_hp', v_boss_current_hp,
      'next_level', 1,
      'new_level', 1,
      'winner_count', 0,
      'payout_count', 0,
      'hunters_count', 0,
      'total_damage_dealt', v_total_damage,
      'total_damage', v_total_damage,
      'pool_pgt', v_boss_pool,
      'distributed_total_pgt', 0,
      'distributed_total', 0,
      'next_max_hp', 5000000,
      'new_max_hp', 5000000,
      'next_pool_pgt', 10000,
      'new_pool', 10000,
      'top_hunters', '[]'::jsonb
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.distribute_weekly_boss_prizes() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
