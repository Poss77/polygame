-- ==============================================================================
-- POLYGON GAMING: BIND QUANTUM RELIC DROPS TO ACTIVE ARCADE SESSIONS
-- Migration: bind_relic_drops_to_arcade_session.sql
-- Version: v1.5.362
-- ==============================================================================
-- 
-- SUMMARY:
-- 1. Extends `public.arcade_sessions` with `relics_dropped_count` and `last_relic_dropped_at`.
-- 2. Upgrades `public.grant_relic_drop` stored procedure:
--    - Requires active arcade session key (`p_session_id`).
--    - Enforces session `status = 'in_progress'` and ownership check.
--    - Enforces >= 15s survival elapsed time before first relic discovery.
--    - Enforces >= 45s cooldown spacing between consecutive relic drops.
--    - Enforces maximum 3 relics discovery limit per arcade session.
--    - Whitelist validation on 17 Season 1 relics + Serie 2 expansions.
--    - Restricts Mythic Apex Relics to PolySpace Deep Space Void and Admin.
--    - Internal calls (from `claim_polyspace_expedition` running as postgres) bypass arcade session check.
-- 3. Upgrades `public.start_arcade_session` & `public.end_arcade_session`:
--    - When 35 daily games limit is reached, players can STILL receive a valid arcade session key.
--    - Quantum Relics and High Scores CAN still be earned post-limit!
--    - Only PGT token payouts are paused (payout_pgt = 0.0).
-- ==============================================================================

BEGIN;

-- 1. SCHEMA EXTENSIONS ON ARCADE_SESSIONS
ALTER TABLE public.arcade_sessions 
ADD COLUMN IF NOT EXISTS relics_dropped_count INTEGER DEFAULT 0;

ALTER TABLE public.arcade_sessions 
ADD COLUMN IF NOT EXISTS last_relic_dropped_at TIMESTAMPTZ DEFAULT NULL;

-- 2. PURGE ALL OVERLOADED SIGNATURES OF grant_relic_drop (PREVENTS PGRST203)
DROP FUNCTION IF EXISTS public.grant_relic_drop(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.grant_relic_drop(TEXT, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.grant_relic_drop(TEXT, TEXT, TEXT, INT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.grant_relic_drop(TEXT, TEXT, INT, TEXT, TEXT) CASCADE;

-- 3. DEPLOY CANONICAL SESSION-BOUND grant_relic_drop RPC
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
SET search_path = public
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

    -- Anti-Cheat Protection 2: Whitelist validation of registered Season 1 & Expansion Relics
    IF v_clean_relic_id NOT IN (
        -- AstroDodge (Serie 1)
        'relic_astrododge_prism', 'relic_astrododge_deflector', 'relic_astrododge_compass',
        -- Cyber Invaders (Serie 1)
        'relic_invaders_core', 'relic_invaders_dynamo', 'relic_invaders_transmitter',
        -- Cyber Drift (Serie 1)
        'relic_drift_chronometer', 'relic_drift_capacitor', 'relic_drift_overdrive',
        -- Cyber Stacker (Serie 1)
        'relic_stacker_foundation', 'relic_stacker_keystone', 'relic_stacker_monolith',
        -- PolySpace Fleet (Serie 1)
        'relic_space_darkmatter', 'relic_space_warpcoil', 'relic_space_plasma',
        -- Universal Apex (Serie 1)
        'relic_apex_singularity', 'relic_apex_genesis',
        -- Serie 2 Expansions
        'relic_exp1_a', 'relic_exp1_b', 'relic_exp2_a', 'relic_exp2_b'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or unregistered relic ID');
    END IF;

    -- Anti-Cheat Protection 3: Mythic Apex Relics restricted to PolySpace Deep Void or Admin
    IF v_clean_relic_id IN ('relic_apex_singularity', 'relic_apex_genesis') AND NOT v_is_internal AND NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Universal Apex Relics can only be discovered via Deep Space Expeditions');
    END IF;

    -- Anti-Cheat Protection 4: Active Arcade Session Validation (Required for client gameplay)
    IF NOT v_is_internal AND NOT v_is_admin THEN
        IF p_session_id IS NULL OR TRIM(p_session_id) = '' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Active arcade session key required to harvest relics');
        END IF;

        BEGIN
            v_session_uuid := p_session_id::UUID;
        EXCEPTION WHEN OTHERS THEN
            RETURN jsonb_build_object('success', false, 'error', 'Invalid session ID format');
        END;

        SELECT * INTO v_session
        FROM public.arcade_sessions
        WHERE id = v_session_uuid
          AND (LOWER(player_id) = LOWER(v_actual_player_id) OR player_id = v_actual_player_id)
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Arcade session not found or belongs to another player');
        END IF;

        IF v_session.status <> 'in_progress' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Arcade session is not active or already finalized');
        END IF;

        -- Survival duration check: minimum 15 seconds into game
        IF EXTRACT(EPOCH FROM (NOW() - COALESCE(v_session.started_at, v_session.created_at))) < 15 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Survival duration too short to discover Quantum Relics (anti-cheat)');
        END IF;

        -- Cap: Max 3 relics per session
        IF COALESCE(v_session.relics_dropped_count, 0) >= 3 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Maximum relic discovery limit reached for this session (3/3)');
        END IF;

        -- Spacing: Minimum 45s between consecutive relic drops in the same session
        IF v_session.last_relic_dropped_at IS NOT NULL AND (NOW() - v_session.last_relic_dropped_at) < INTERVAL '45 seconds' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance cooling down. Please wait 45s between discoveries');
        END IF;

        -- Update session relic counters
        UPDATE public.arcade_sessions
        SET relics_dropped_count = COALESCE(relics_dropped_count, 0) + 1,
            last_relic_dropped_at = NOW()
        WHERE id = v_session_uuid;
    END IF;

    -- Row lock player row
    SELECT COALESCE(relics, '{}'::jsonb)
    INTO v_current_relics
    FROM public.users
    WHERE player_id = v_actual_player_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player not found');
    END IF;

    -- Calculate updated unminted and total counts (+1 exactly)
    v_relic_obj := COALESCE(v_current_relics->v_clean_relic_id, '{}'::jsonb);
    v_unminted := COALESCE((v_relic_obj->>'unminted')::int, 0) + 1;
    v_onchain := COALESCE((v_relic_obj->>'onchain')::int, 0);
    v_total := v_unminted + v_onchain;
    v_token_ids := COALESCE(v_relic_obj->'token_ids', '[]'::jsonb);

    v_relic_obj := jsonb_build_object(
        'total', v_total,
        'unminted', v_unminted,
        'onchain', v_onchain,
        'token_ids', v_token_ids
    );

    v_updated_relics := jsonb_set(v_current_relics, ARRAY[v_clean_relic_id], v_relic_obj, true);

    -- Update users table with updated relics
    UPDATE public.users
    SET relics = v_updated_relics,
        updated_at = NOW()
    WHERE player_id = v_actual_player_id;

    RETURN v_updated_relics;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_relic_drop(TEXT, TEXT, INT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. UPGRADE start_arcade_session (ALLOW POST-LIMIT GAMEPLAY WITH VALID SESSIONS)
CREATE OR REPLACE FUNCTION public.start_arcade_session(
  p_player_id TEXT,
  p_game_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_session_id UUID;
  v_daily_completed_count INTEGER;
  v_max_daily_plays INTEGER := 35; -- Default fallback to 35 plays/day
  v_clean_game TEXT;
  v_game_key TEXT;
  v_game_settings JSONB;
  v_user RECORD;
  v_is_vip_only BOOLEAN := false;
  v_limit_reached BOOLEAN := false;
BEGIN
  -- Resolve synthetic player_id
  v_pid := resolve_player_id(p_player_id);
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_player_id, '')));
  END IF;

  v_clean_game := LOWER(REPLACE(COALESCE(p_game_name, 'arcade'), ' ', ''));

  IF v_clean_game LIKE '%astro%' OR v_clean_game = 'astrododge' THEN
    v_game_key := 'AstroDodge';
  ELSIF v_clean_game LIKE '%invader%' THEN
    v_game_key := 'Cyber Invaders';
  ELSIF v_clean_game LIKE '%drift%' THEN
    v_game_key := 'Cyber Drift';
  ELSIF v_clean_game LIKE '%stacker%' OR v_clean_game LIKE '%catcher%' THEN
    v_game_key := 'Cyber Stacker';
  ELSIF v_clean_game LIKE '%skeet%' THEN
    v_game_key := 'Cyber Skeet';
  ELSIF v_clean_game LIKE '%defense%' THEN
    v_game_key := 'defense';
  ELSE
    v_game_key := COALESCE(p_game_name, 'arcade');
  END IF;

  -- Load Max Daily Plays & VIP Settings from Global Settings
  SELECT 
    COALESCE(max_daily_plays_per_game, 35),
    game_payout_settings
  INTO 
    v_max_daily_plays,
    v_game_settings
  FROM public.global_settings 
  WHERE id = 1 
  LIMIT 1;

  -- Check VIP requirement for the game
  IF v_game_settings IS NOT NULL AND v_clean_game LIKE '%stacker%' THEN
    v_is_vip_only := COALESCE((v_game_settings->'stacker'->>'vip_only')::boolean, false);
  ELSIF v_game_settings IS NOT NULL AND v_clean_game LIKE '%defense%' THEN
    v_is_vip_only := COALESCE((v_game_settings->'defense'->>'vip_only')::boolean, false);
  END IF;

  -- Verify player VIP status if game is VIP-only
  IF v_is_vip_only THEN
    SELECT * INTO v_user FROM public.users WHERE player_id = v_pid;
    IF v_user IS NULL OR (v_user.vip_until IS NULL OR v_user.vip_until <= NOW()) THEN
      IF NOT COALESCE(v_user.is_admin, false) AND NOT COALESCE(v_user.is_ambassador, false) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'This game is exclusive to VIP Pass holders! Upgrade to VIP to play.',
          'vip_required', true
        );
      END IF;
    END IF;
  END IF;

  -- Query Completed Sessions in Last 24 Hours
  SELECT COUNT(*) INTO v_daily_completed_count
  FROM public.arcade_sessions
  WHERE player_id = v_pid
    AND (game_name = v_game_key OR LOWER(game_name) = v_clean_game)
    AND status = 'completed'
    AND created_at >= (NOW() - INTERVAL '24 hours');

  IF v_daily_completed_count >= v_max_daily_plays THEN
    v_limit_reached := true;
  END IF;

  v_session_id := gen_random_uuid();

  -- Insert session with status = 'in_progress' so player can earn relics & high scores
  INSERT INTO public.arcade_sessions (
    id,
    player_id,
    game_name,
    status,
    created_at,
    started_at
  ) VALUES (
    v_session_id,
    v_pid,
    v_game_key,
    'in_progress',
    NOW(),
    NOW()
  );

  -- Atomically increment career total_arcade_plays
  UPDATE public.users 
  SET total_arcade_plays = COALESCE(total_arcade_plays, 0) + 1,
      updated_at = NOW()
  WHERE player_id = v_pid;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'game_name', v_game_key,
    'started_at', NOW(),
    'daily_limit_reached', v_limit_reached,
    'completed_today', v_daily_completed_count,
    'max_daily_plays', v_max_daily_plays
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_arcade_session(TEXT, TEXT) TO anon, authenticated, service_role;

-- 5. UPGRADE end_arcade_session (ALLOW HIGHSCORES POST-LIMIT, PAUSE PGT PAYOUT)
CREATE OR REPLACE FUNCTION public.end_arcade_session(
  p_player_id TEXT,
  p_session_id TEXT,
  p_score INTEGER,
  p_bonus_items INTEGER DEFAULT 0,
  p_bonus_tokens INTEGER DEFAULT 0,
  p_nft_multiplier NUMERIC DEFAULT 1.0,
  p_relic_multiplier NUMERIC DEFAULT 1.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_session RECORD;
  v_now TIMESTAMPTZ;
  v_duration_seconds INTEGER;
  v_session_uuid UUID;
  v_clamped_score INTEGER;
  v_clamped_items INTEGER;
  v_clamped_tokens INTEGER;
  v_clamped_nft_mult NUMERIC;
  v_user RECORD;
  v_vip_mult NUMERIC;
  v_amb_mult NUMERIC;
  v_relic_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC;
  v_raw_pgt NUMERIC;
  v_final_pgt NUMERIC;
  v_new_balance NUMERIC;
  v_game_name TEXT;
  v_game_clean TEXT;
  v_game_key TEXT;
  v_is_new_high BOOLEAN;
  v_max_daily_plays INTEGER;
  v_daily_completed_count INTEGER;
  v_global_earn_mult NUMERIC := 1.0;
  v_game_settings JSONB;
  v_harvest_enabled BOOLEAN := true;
  v_limit_reached BOOLEAN := false;
  v_new_weekly_games INTEGER := 0;
  v_current_weekly_faucets INTEGER := 0;
  v_new_weekly_tier INTEGER := 0;
  v_max_velocity_rate NUMERIC := 0.75;
  v_velocity_cap NUMERIC := 0.0;
BEGIN
  v_pid := resolve_player_id(p_player_id);
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(COALESCE(p_player_id, ''))); 
  END IF;

  v_now := NOW();
  v_clamped_score := GREATEST(0, COALESCE(p_score, 0));
  v_clamped_items := GREATEST(0, COALESCE(p_bonus_items, 0));
  v_clamped_tokens := GREATEST(0, COALESCE(p_bonus_tokens, 0));
  v_clamped_nft_mult := GREATEST(1.0, LEAST(COALESCE(p_nft_multiplier, 1.0), 10.0));
  v_vip_mult := 1.0;
  v_amb_mult := 1.0;
  v_total_multiplier := 1.0;
  v_raw_pgt := 0.0;
  v_final_pgt := 0.0;
  v_new_balance := 0.0;
  v_is_new_high := false;
  v_max_daily_plays := 35;
  v_daily_completed_count := 0;
  v_global_earn_mult := 1.0;

  BEGIN
    v_session_uuid := p_session_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session ID format');
  END;

  SELECT * INTO v_session
  FROM arcade_sessions
  WHERE id = v_session_uuid AND (player_id = v_pid OR LOWER(player_id) = LOWER(v_pid))
  FOR UPDATE;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found or belongs to another player');
  END IF;

  IF v_session.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session has already been finalized and claimed');
  END IF;

  v_duration_seconds := EXTRACT(EPOCH FROM (v_now - COALESCE(v_session.started_at, v_session.created_at)))::INTEGER;
  IF v_duration_seconds < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session ended too quickly (anti-cheat)');
  END IF;

  SELECT COALESCE(earn_multiplier, 1.0), COALESCE(max_daily_plays_per_game, 35), game_payout_settings
  INTO v_global_earn_mult, v_max_daily_plays, v_game_settings
  FROM global_settings WHERE id = 1 LIMIT 1;

  v_game_clean := LOWER(REPLACE(COALESCE(v_session.game_name, 'astrododge'), ' ', ''));

  IF v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge' THEN
    v_game_key := 'astrododge';
  ELSIF v_game_clean LIKE '%invader%' THEN
    v_game_key := 'invaders';
  ELSIF v_game_clean LIKE '%drift%' THEN
    v_game_key := 'drift';
  ELSIF v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%' THEN
    v_game_key := 'stacker';
  ELSIF v_game_clean LIKE '%skeet%' THEN
    v_game_key := 'skeet';
  ELSIF v_game_clean LIKE '%defense%' THEN
    v_game_key := 'defense';
  ELSE
    v_game_key := v_game_clean;
  END IF;

  v_harvest_enabled := COALESCE((v_game_settings->v_game_key->>'harvest_enabled')::boolean, true);

  -- Count Completed Sessions in Last 24 Hours
  SELECT COUNT(*) INTO v_daily_completed_count
  FROM arcade_sessions
  WHERE (player_id = v_pid OR LOWER(player_id) = LOWER(v_pid))
    AND game_name = v_session.game_name
    AND status = 'completed'
    AND created_at >= (NOW() - INTERVAL '24 hours');

  IF v_daily_completed_count >= v_max_daily_plays THEN
    v_limit_reached := true;
  END IF;

  SELECT * INTO v_user FROM users WHERE player_id = v_pid FOR UPDATE;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found in database');
  END IF;

  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_vip_mult := 2.0;
  END IF;

  IF v_user.is_ambassador = true THEN
    v_amb_mult := 2.0;
  END IF;

  -- 1.5x Apex Relics multiplier evaluated from user relics or parameter
  IF is_season1_apex_unlocked(v_user.relics) OR COALESCE(p_relic_multiplier, 1.0) >= 1.5 THEN
    v_relic_mult := 1.5;
  END IF;

  v_total_multiplier := v_clamped_nft_mult * v_relic_mult * v_vip_mult * v_amb_mult;

  -- Calculate Game-Specific Base PGT Formulas & High Scores
  IF v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge' THEN
    v_game_name := 'AstroDodge';
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.05)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.game_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET game_highscore = v_clamped_score, alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%invader%' THEN
    v_game_name := 'Cyber Invaders';
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.invaders_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET invaders_highscore = v_clamped_score, alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%drift%' THEN
    v_game_name := 'Cyber Drift';
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.drift_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET drift_highscore = v_clamped_score, alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%' THEN
    v_game_name := 'Cyber Stacker';
    v_raw_pgt := ((v_clamped_items * 0.45) + (v_clamped_score / 1500.0)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.stacker_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET stacker_highscore = v_clamped_score, 
          alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%skeet%' THEN
    v_game_name := 'Cyber Skeet';
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.skeet_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET skeet_highscore = v_clamped_score, 
          alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%defense%' THEN
    v_game_name := 'Cyber Defense';
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.05)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.defense_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET defense_highscore = v_clamped_score, 
          defense_alltime_best = GREATEST(COALESCE(defense_alltime_best, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;

  ELSE
    v_game_name := v_session.game_name;
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
  END IF;

  -- Base Game Earn Ceiling (75.00 PGT): protects against unmultiplied bot exploits
  v_raw_pgt := LEAST(v_raw_pgt, 75.00);

  -- Apply multipliers or pause payout if limit reached
  IF v_limit_reached OR NOT v_harvest_enabled THEN
    v_final_pgt := 0.0;
  ELSE
    v_final_pgt := ROUND(((v_raw_pgt * v_total_multiplier) + (v_clamped_tokens * 5.0))::numeric, 2);

    -- Payout Velocity Sentinel: Sessions under 3 seconds cannot earn more than 1.00 PGT
    IF v_duration_seconds < 3 THEN
      v_final_pgt := LEAST(v_final_pgt, 1.00);
    END IF;

    -- Dynamic Velocity Clamping: Calibrated per-game rate * user's verified total multiplier
    v_velocity_cap := GREATEST(2.00, ROUND((v_duration_seconds * v_max_velocity_rate * v_total_multiplier)::numeric, 2));
    v_final_pgt := LEAST(v_final_pgt, v_velocity_cap);

    -- Catastrophe Circuit-Breaker (1,000.00 PGT): protects against theoretical numeric overflows
    v_final_pgt := LEAST(v_final_pgt, 1000.00);
  END IF;

  -- Update Arcade Session as Completed
  UPDATE arcade_sessions
  SET status = 'completed',
      score = v_clamped_score,
      bonus_items = v_clamped_items,
      bonus_tokens = v_clamped_tokens,
      payout_pgt = v_final_pgt,
      completed_at = v_now,
      duration_seconds = v_duration_seconds
  WHERE id = v_session_uuid;

  -- Credit PGT balance if payout > 0
  IF v_final_pgt > 0 THEN
    v_new_balance := ROUND((COALESCE(v_user.balance_pgt, 0) + v_final_pgt)::numeric, 2);

    UPDATE users
    SET balance_pgt = v_new_balance,
        total_earned = ROUND((COALESCE(total_earned, 0) + v_final_pgt)::numeric, 2),
        updated_at = v_now
    WHERE player_id = v_pid;
  ELSE
    v_new_balance := COALESCE(v_user.balance_pgt, 0);
  END IF;

  -- Update weekly active quest progression
  v_new_weekly_games := COALESCE(v_user.weekly_games_played, 0) + 1;
  v_current_weekly_faucets := COALESCE(v_user.weekly_faucet_claims, 0);
  v_new_weekly_tier := compute_weekly_active_tier(v_current_weekly_faucets, v_new_weekly_games);

  UPDATE users
  SET weekly_games_played = v_new_weekly_games,
      weekly_active_tier = v_new_weekly_tier,
      updated_at = v_now
  WHERE player_id = v_pid;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_uuid,
    'game_name', v_game_name,
    'score', v_clamped_score,
    'final_score', v_clamped_score,
    'payout_pgt', v_final_pgt,
    'new_balance', v_new_balance,
    'is_new_high', v_is_new_high,
    'new_high_score', v_is_new_high,
    'daily_limit_reached', v_limit_reached,
    'weekly_games_played', v_new_weekly_games,
    'weekly_active_tier', v_new_weekly_tier,
    'completed_today', v_daily_completed_count + 1,
    'max_daily_plays', v_max_daily_plays
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

COMMIT;
