-- ==============================================================================
-- POLYGON GAMING: FIX WEEKLY WORLD BOSS PRIZE DISTRIBUTION & DIGEST RESOLUTION
-- Migration: fix_distribute_weekly_boss_prizes_digest.sql
-- Version: v1.5.365
-- ==============================================================================
--
-- PROBLEM SUMMARY:
-- Step 2 of the weekly reset ("Distribute PolySpace Boss Hunters Pool") failed with:
--   42883: function digest(text, unknown) does not exist
--
-- ROOT CAUSE:
-- 1. `distribute_weekly_boss_prizes` had `SET search_path = public`.
-- 2. When it called `verify_admin_passkey`, PostgreSQL executed with `search_path = public`.
-- 3. In Supabase, the `pgcrypto` extension is installed in schema `extensions`.
-- 4. Calling unqualified `digest(...)` failed because `extensions` was excluded from search_path.
-- 5. In addition, an outdated `INSERT INTO boss_reset_history` referenced nonexistent columns.
--
-- FIX APPLIED:
-- 1. Updated `verify_admin_passkey` with `SET search_path = public, extensions` and
--    explicitly qualifies `extensions.digest(...)`.
-- 2. Updated `distribute_weekly_boss_prizes` with `SET search_path = public, extensions`
--    and the canonical Level-4+ boss distribution and history archival schema.
-- 3. Updated `grant_relic_drop` with `SET search_path = public, extensions`.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. HARDEN verify_admin_passkey WITH EXPLICIT EXTENSIONS SEARCH PATH & DIGEST
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_admin_passkey(p_passkey TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_salt TEXT;
  v_computed TEXT;
BEGIN
  IF p_passkey IS NULL OR TRIM(p_passkey) = '' THEN
    RETURN FALSE;
  END IF;

  SELECT admin_key_hash, salt INTO v_hash, v_salt
  FROM public.admin_security_config
  WHERE id = 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  v_computed := encode(extensions.digest(TRIM(p_passkey) || v_salt, 'sha256'::text), 'hex');
  RETURN (v_computed = v_hash);
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. FIX distribute_weekly_boss_prizes
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

GRANT EXECUTE ON FUNCTION public.distribute_weekly_boss_prizes(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. HARDEN grant_relic_drop SEARCH PATH
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_relic_drop(
    p_player_id TEXT,
    p_relic_id TEXT,
    p_amount INT DEFAULT 1,
    p_session_id TEXT DEFAULT NULL,
    p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_actual_player_id TEXT := resolve_player_id(p_player_id);
    v_current_relics JSONB;
    v_relic_obj JSONB;
    v_total INT;
    v_unminted INT;
    v_onchain INT;
    v_token_ids JSONB;
    v_updated_relics JSONB;
    v_clean_relic_id TEXT := LOWER(TRIM(COALESCE(p_relic_id, '')));
    v_session RECORD;
    v_session_uuid UUID;
    v_is_internal BOOLEAN := (LOWER(CURRENT_USER) = 'postgres');
    v_is_admin BOOLEAN := false;
BEGIN
    IF v_actual_player_id IS NULL OR v_actual_player_id = '' THEN
        v_actual_player_id := LOWER(TRIM(COALESCE(p_player_id, '')));
    END IF;

    -- Admin bypass verification if passkey is provided
    IF p_admin_passkey IS NOT NULL AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'verify_admin_passkey') THEN
        v_is_admin := verify_admin_passkey(p_admin_passkey);
    END IF;

    -- Anti-Cheat Protection 1: Reject bulk drop amounts (strictly 1 relic per drop event)
    IF p_amount IS NOT NULL AND p_amount > 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid drop amount: client drops are strictly limited to 1 relic per event');
    END IF;

    -- Anti-Cheat Protection 2: Bound drops directly to active arcade session or verified caller
    IF NOT v_is_internal AND NOT v_is_admin THEN
        IF p_session_id IS NULL OR TRIM(p_session_id) = '' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed: No active arcade session associated with this discovery');
        END IF;

        BEGIN
            v_session_uuid := p_session_id::UUID;
        EXCEPTION WHEN OTHERS THEN
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed: Malformed arcade session identifier');
        END;

        SELECT * INTO v_session
        FROM public.arcade_sessions
        WHERE id = v_session_uuid
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed: Arcade session not found');
        END IF;

        IF v_session.player_id <> v_actual_player_id THEN
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed: Arcade session belongs to another player profile');
        END IF;

        IF v_session.status <> 'in_progress' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed: Arcade session is already concluded or invalid');
        END IF;

        IF EXTRACT(EPOCH FROM (NOW() - v_session.started_at)) < 15 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed: Insufficient session survival duration (<15s)');
        END IF;

        IF v_session.last_relic_dropped_at IS NOT NULL AND EXTRACT(EPOCH FROM (NOW() - v_session.last_relic_dropped_at)) < 45 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed: Discovery frequency rate limit exceeded (cooldown active)');
        END IF;

        IF COALESCE(v_session.relics_dropped_count, 0) >= 3 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed: Maximum relic drop capacity reached for this run');
        END IF;

        UPDATE public.arcade_sessions
        SET relics_dropped_count = COALESCE(relics_dropped_count, 0) + 1,
            last_relic_dropped_at = NOW()
        WHERE id = v_session_uuid;
    END IF;

    -- Fetch current player's relics ledger
    SELECT relics INTO v_current_relics
    FROM public.users
    WHERE player_id = v_actual_player_id
    FOR UPDATE;

    IF v_current_relics IS NULL THEN
        v_current_relics := '{}'::jsonb;
    END IF;

    IF v_current_relics ? v_clean_relic_id THEN
        v_relic_obj := v_current_relics -> v_clean_relic_id;
        v_total := COALESCE((v_relic_obj ->> 'total')::INT, 0) + COALESCE(p_amount, 1);
        v_unminted := COALESCE((v_relic_obj ->> 'unminted')::INT, 0) + COALESCE(p_amount, 1);
        v_onchain := COALESCE((v_relic_obj ->> 'onchain')::INT, 0);
        v_token_ids := COALESCE(v_relic_obj -> 'token_ids', '[]'::jsonb);
    ELSE
        v_total := COALESCE(p_amount, 1);
        v_unminted := COALESCE(p_amount, 1);
        v_onchain := 0;
        v_token_ids := '[]'::jsonb;
    END IF;

    v_updated_relics := jsonb_set(
        v_current_relics,
        ARRAY[v_clean_relic_id],
        jsonb_build_object(
            'total', v_total,
            'unminted', v_unminted,
            'onchain', v_onchain,
            'token_ids', v_token_ids
        )
    );

    UPDATE public.users
    SET relics = v_updated_relics,
        updated_at = NOW()
    WHERE player_id = v_actual_player_id;

    RETURN jsonb_build_object(
        'success', true,
        'relic_id', v_clean_relic_id,
        'added', COALESCE(p_amount, 1),
        'new_total', v_total,
        'relics', v_updated_relics
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_relic_drop(TEXT, TEXT, INT, TEXT, TEXT) TO anon, authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
