-- 2. ARCADE SESSIONS & HIGH SCORES (ANTI-CHEAT HARVESTING)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: start_arcade_session
-- Source: bind_relic_drops_to_arcade_session.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.start_arcade_session(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.start_arcade_session(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS start_arcade_session(TEXT, TEXT);
DROP FUNCTION IF EXISTS start_arcade_session(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.start_arcade_session(
  p_player_id TEXT,
  p_game_name TEXT,
  p_turnstile_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard RECORD;
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
  
  -- Turnstile Sentinel variables
  v_turnstile_enabled BOOLEAN := true;
  v_turnstile_freq INTEGER := 3;
  v_turnstile_vip_bypass BOOLEAN := false;
  v_completed_since_turnstile INTEGER := 0;
  v_midnight_utc TIMESTAMPTZ;
  v_effective_check_time TIMESTAMPTZ;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

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

  -- Load Max Daily Plays, Turnstile Settings & VIP Settings from Global Settings
  SELECT 
    COALESCE(max_daily_plays_per_game, 35),
    game_payout_settings,
    COALESCE(turnstile_arcade_enabled, true),
    COALESCE(turnstile_arcade_frequency, 3),
    COALESCE(turnstile_arcade_vip_bypass, false)
  INTO 
    v_max_daily_plays,
    v_game_settings,
    v_turnstile_enabled,
    v_turnstile_freq,
    v_turnstile_vip_bypass
  FROM public.global_settings 
  WHERE id = 1 
  LIMIT 1;

  -- Check VIP requirement for the game
  IF v_game_settings IS NOT NULL AND v_clean_game LIKE '%stacker%' THEN
    v_is_vip_only := COALESCE((v_game_settings->'stacker'->>'vip_only')::boolean, false);
  ELSIF v_game_settings IS NOT NULL AND v_clean_game LIKE '%defense%' THEN
    v_is_vip_only := COALESCE((v_game_settings->'defense'->>'vip_only')::boolean, false);
  END IF;

  -- Load user record
  SELECT * INTO v_user FROM public.users WHERE player_id = v_pid;

  -- Verify player VIP status if game is VIP-only
  IF v_is_vip_only THEN
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

  -- --------------------------------------------------------------------------
  -- 🛡️ CLOUDFLARE TURNSTILE SERVER SENTINEL (PLAN-010 Option A)
  -- --------------------------------------------------------------------------
  IF v_turnstile_enabled THEN
    -- Check VIP bypass & Admin exemption
    IF NOT (v_turnstile_vip_bypass AND v_user.vip_until IS NOT NULL AND v_user.vip_until > NOW()) 
       AND NOT COALESCE(v_user.is_admin, false) THEN
      
      -- Midnight UTC of today (ensures automatic daily reset)
      v_midnight_utc := DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC');
      
      -- The effective check start time is the latest of: last Turnstile check OR midnight UTC
      IF v_user.last_turnstile_at IS NOT NULL AND v_user.last_turnstile_at > v_midnight_utc THEN
        v_effective_check_time := v_user.last_turnstile_at;
      ELSE
        v_effective_check_time := v_midnight_utc;
      END IF;

      -- Count completed arcade games across all games since effective check time
      SELECT COUNT(*) INTO v_completed_since_turnstile
      FROM public.arcade_sessions
      WHERE player_id = v_pid
        AND status = 'completed'
        AND created_at >= v_effective_check_time;

      -- If threshold reached, require Turnstile token
      IF v_completed_since_turnstile >= v_turnstile_freq THEN
        IF p_turnstile_token IS NULL OR TRIM(p_turnstile_token) = '' THEN
          RETURN jsonb_build_object(
            'success', false,
            'turnstile_required', true,
            'completed_since_turnstile', v_completed_since_turnstile,
            'turnstile_frequency', v_turnstile_freq,
            'error', 'Human verification required before starting this session.'
          );
        END IF;

        -- Validate token basic structure (Turnstile tokens are base64/hex strings >= 20 chars)
        IF LENGTH(TRIM(p_turnstile_token)) < 20 THEN
          PERFORM public.record_bot_warning(
            v_pid, 
            'fake_turnstile_token', 
            v_game_key, 
            jsonb_build_object('token_length', LENGTH(TRIM(p_turnstile_token)))
          );
          RETURN jsonb_build_object(
            'success', false,
            'turnstile_required', true,
            'error', 'Invalid security verification token.'
          );
        END IF;

        -- Token accepted: update last_turnstile_at on the user record
        UPDATE public.users
        SET last_turnstile_at = NOW(),
            updated_at = NOW()
        WHERE player_id = v_pid;
      END IF;
    END IF;
  END IF;

  -- Query Completed Sessions for this specific game in Last 24 Hours (Daily PGT reward limit)
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
    'max_daily_plays', v_max_daily_plays,
    'turnstile_verified', (p_turnstile_token IS NOT NULL AND TRIM(p_turnstile_token) <> '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_arcade_session(TEXT, TEXT, TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: end_arcade_session
-- Source: fix_end_arcade_session_weekly_active_tier.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, INTEGER, INTEGER, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, INTEGER, INTEGER, INTEGER, NUMERIC);

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
  v_guard RECORD;
  v_pid TEXT;
  v_session RECORD;
  v_now TIMESTAMPTZ;
  v_duration_seconds INTEGER;
  v_session_uuid UUID;
  v_clamped_score INTEGER;
  v_clamped_items INTEGER;
  v_clamped_tokens INTEGER;
  v_all_nfts JSONB;
  v_server_nft_bonus_pct NUMERIC := 0.0;
  v_authoritative_nft_mult NUMERIC := 1.0;
  v_clamped_nft_mult NUMERIC;
  v_user RECORD;
  v_vip_mult NUMERIC;
  v_amb_mult NUMERIC;
  v_relic_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC;
  v_raw_pgt NUMERIC;
  v_bonus_token_pgt NUMERIC := 0.0;
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
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  v_now := NOW();
  v_clamped_score := GREATEST(0, COALESCE(p_score, 0));
  v_clamped_items := GREATEST(0, COALESCE(p_bonus_items, 0));
  -- Cap bonus tokens to maximum 20 (equivalent to 100 PGT max bonus)
  v_clamped_tokens := GREATEST(0, LEAST(COALESCE(p_bonus_tokens, 0), 20));
  v_vip_mult := 1.0;
  v_amb_mult := 1.0;
  v_total_multiplier := 1.0;
  v_raw_pgt := 0.0;
  v_bonus_token_pgt := 0.0;
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

  SELECT * INTO v_user FROM users WHERE player_id = v_pid FOR UPDATE;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found in database');
  END IF;

  IF COALESCE(v_user.is_banned, false) = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended');
  END IF;

  v_duration_seconds := EXTRACT(EPOCH FROM (v_now - COALESCE(v_session.started_at, v_session.created_at)))::INTEGER;

  -- ----------------------------------------------------------------------------
  -- HARD SCORE LIMIT SENTINEL (500,000 PTS):
  -- Any score > 500,000 triggers an immediate bot warning, awards 0 PGT, burns session,
  -- and rejects submission without updating high scores.
  -- ----------------------------------------------------------------------------
  IF v_clamped_score > 500000 THEN
    PERFORM public.record_bot_warning(
      v_pid,
      'score_limit_500k_exceeded',
      COALESCE(v_session.game_name, 'Arcade'),
      jsonb_build_object(
        'submitted_score', p_score,
        'max_allowed_score', 500000,
        'duration_seconds', v_duration_seconds,
        'bonus_tokens', v_clamped_tokens
      )
    );

    UPDATE arcade_sessions
    SET status = 'completed',
        score = 0,
        bonus_items = 0,
        bonus_tokens = 0,
        payout_pgt = 0.0,
        completed_at = v_now,
        duration_seconds = v_duration_seconds
    WHERE id = v_session_uuid;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Score exceeds 500,000 limit. Submission blocked and bot warning recorded.',
      'bot_warning', true,
      'payout_pgt', 0.0,
      'new_balance', COALESCE(v_user.balance_pgt, 0)
    );
  END IF;

  -- Quick Deaths Handling (< 2s):
  -- Genuine instant deaths (score 0 or minimal) complete cleanly with 0 payout.
  -- Only reject if claiming an impossible score (> 250 pts or > 2 items) in under 2 seconds.
  IF v_duration_seconds < 2 THEN
    IF v_clamped_score > 250 OR v_clamped_items > 2 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Session ended too quickly for submitted score');
    ELSE
      UPDATE arcade_sessions
      SET status = 'completed',
          score = v_clamped_score,
          bonus_items = v_clamped_items,
          bonus_tokens = v_clamped_tokens,
          payout_pgt = 0.0,
          completed_at = v_now,
          duration_seconds = v_duration_seconds
      WHERE id = v_session_uuid;

      RETURN jsonb_build_object(
        'success', true,
        'payout', 0.0,
        'payout_pgt', 0.0,
        'new_balance', COALESCE(v_user.balance_pgt, 0),
        'weekly_games_played', COALESCE(v_user.weekly_games_played, 0),
        'weekly_active_tier', COALESCE(v_user.weekly_active_tier, 0)
      );
    END IF;
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

  -- ----------------------------------------------------------------------------
  -- PHYSICAL ARCADE DURATION RATE-CLAMPS (Calibrated per game mechanics):
  -- 1. Orbs / Items: Road generation max 3 items/sec (+ 5 grace buffer)
  -- 2. Bonus Tokens: Max 1 token per 15 seconds (+ 1 grace buffer)
  -- 3. Realistic Score Velocity: Calibrated to speed and scoring formulas per game
  -- ----------------------------------------------------------------------------
  v_clamped_items := LEAST(v_clamped_items, GREATEST(5, v_duration_seconds * 3));
  v_clamped_tokens := LEAST(v_clamped_tokens, GREATEST(1, v_duration_seconds / 15));

  IF v_game_key = 'drift' THEN
    -- Cyber Drift: 10 pts/m + 150 pts/orb. At 167-200 km/h, velocity is 800-1,200 pts/sec
    v_clamped_score := LEAST(v_clamped_score, GREATEST(1500, v_duration_seconds * 1200));
  ELSIF v_game_key = 'skeet' THEN
    -- Cyber Skeet: Clays yield up to 500 pts * 10x combo = 5,000 pts per hit.
    -- High-intensity arcade runs legitimately reach 3,000 - 4,500 pts/sec.
    v_clamped_score := LEAST(v_clamped_score, GREATEST(3000, v_duration_seconds * 4500));
    v_max_velocity_rate := 1.75;
  ELSIF v_game_key = 'invaders' THEN
    v_clamped_score := LEAST(v_clamped_score, GREATEST(500, v_duration_seconds * 350));
  ELSIF v_game_key = 'astrododge' THEN
    v_clamped_score := LEAST(v_clamped_score, GREATEST(500, v_duration_seconds * 250));
  ELSE
    v_clamped_score := LEAST(v_clamped_score, GREATEST(500, v_duration_seconds * 500));
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

  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_vip_mult := 2.0;
  END IF;

  IF v_user.is_ambassador = true THEN
    v_amb_mult := 2.0;
  END IF;

  -- ----------------------------------------------------------------------------
  -- 🛡️ STRICT SERVER-SIDE NFT MULTIPLIER VALIDATION
  -- Sourced authoritatively from users.owned_nfts and users.crate_nfts.
  -- Completely eliminates client parameter tampering (e.g. nft=10000).
  --   • nft_rare_shield ('Viper Shield'): +15%
  --   • nft_pulse_blaster / nft_hyper_drive ('Pulse Blaster'): +30%
  --   • nft_epic_yield ('Apex Matrix'): +50%
  -- ----------------------------------------------------------------------------
  v_all_nfts := COALESCE(v_user.owned_nfts, '[]'::jsonb) || COALESCE(v_user.crate_nfts, '[]'::jsonb);
  v_server_nft_bonus_pct := 0.0;
  IF v_all_nfts ? 'nft_rare_shield' THEN
    v_server_nft_bonus_pct := v_server_nft_bonus_pct + 15.0;
  END IF;
  IF v_all_nfts ? 'nft_pulse_blaster' OR v_all_nfts ? 'nft_hyper_drive' THEN
    v_server_nft_bonus_pct := v_server_nft_bonus_pct + 30.0;
  END IF;
  IF v_all_nfts ? 'nft_epic_yield' THEN
    v_server_nft_bonus_pct := v_server_nft_bonus_pct + 50.0;
  END IF;

  v_authoritative_nft_mult := 1.0 + (v_server_nft_bonus_pct / 100.0);
  -- Cap client's requested multiplier strictly to what they actually own
  v_clamped_nft_mult := LEAST(GREATEST(1.0, COALESCE(p_nft_multiplier, 1.0)), v_authoritative_nft_mult);

  -- ----------------------------------------------------------------------------
  -- 🛡️ STRICT SERVER-SIDE RELIC MULTIPLIER VALIDATION
  -- Sourced authoritatively from users.relics.
  -- 1.5x Apex Multiplier is granted ONLY if all 17 Serie 1 Relics are unlocked!
  -- Client parameter p_relic_multiplier cannot grant this bonus if relics are missing.
  -- ----------------------------------------------------------------------------
  IF is_season1_apex_unlocked(v_user.relics) THEN
    v_relic_mult := 1.5;
  ELSE
    v_relic_mult := 1.0;
  END IF;

  v_total_multiplier := v_clamped_nft_mult * v_relic_mult * v_vip_mult * v_amb_mult;

  -- Calculate Game-Specific Base PGT Formulas & High Scores (Strictly bounded <= 500,000)
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
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.05)) * v_global_earn_mult;
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

  -- Base Game Earn Ceiling: 125.00 PGT for high-scoring Cyber Skeet, 75.00 PGT standard for other arcades
  IF v_game_key = 'skeet' THEN
    v_raw_pgt := LEAST(v_raw_pgt, 125.00);
  ELSE
    v_raw_pgt := LEAST(v_raw_pgt, 75.00);
  END IF;

  -- Bonus Token / Block / Coin PGT Cap: Maximum 100.00 PGT
  v_bonus_token_pgt := LEAST(v_clamped_tokens * 5.0, 100.00);

  -- Apply multipliers or pause payout if limit reached
  IF v_limit_reached OR NOT v_harvest_enabled THEN
    v_final_pgt := 0.0;
  ELSE
    v_final_pgt := ROUND(((v_raw_pgt * v_total_multiplier) + v_bonus_token_pgt)::numeric, 2);

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

    -- Process 4-Tier Referral Commissions for upline network
    PERFORM process_referral_commissions(v_pid, v_final_pgt, v_game_name || ' Arcade');
  ELSE
    v_new_balance := COALESCE(v_user.balance_pgt, 0);
  END IF;

  -- Update weekly active quest progression with canonical weekly_active_tier
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
    'bonus_token_pgt', v_bonus_token_pgt,
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

GRANT EXECUTE ON FUNCTION public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: submit_arcade_highscore
-- Source: add_cyber_skeet.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION submit_arcade_highscore(
  p_player_id TEXT,
  p_game_highscore INTEGER DEFAULT NULL,
  p_invaders_highscore INTEGER DEFAULT NULL,
  p_drift_highscore INTEGER DEFAULT NULL,
  p_stacker_highscore INTEGER DEFAULT NULL,
  p_catcher_highscore INTEGER DEFAULT NULL,
  p_skeet_highscore INTEGER DEFAULT NULL,
  p_defense_highscore INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_stacker_val INTEGER := COALESCE(p_stacker_highscore, p_catcher_highscore);
  v_max_score INTEGER := 0;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  v_max_score := GREATEST(
    COALESCE(p_game_highscore, 0),
    COALESCE(p_invaders_highscore, 0),
    COALESCE(p_drift_highscore, 0),
    COALESCE(v_stacker_val, 0),
    COALESCE(p_skeet_highscore, 0),
    COALESCE(p_defense_highscore, 0)
  );

  IF v_max_score > 500000 THEN
    PERFORM public.record_bot_warning(
      v_pid,
      'score_limit_500k_exceeded',
      'submit_arcade_highscore',
      jsonb_build_object('submitted_score', v_max_score, 'max_allowed_score', 500000)
    );
    RETURN jsonb_build_object('success', false, 'error', 'Score exceeds 500,000 limit. Bot warning recorded.');
  END IF;

  UPDATE users
  SET 
    game_highscore = GREATEST(COALESCE(game_highscore, 0), LEAST(COALESCE(p_game_highscore, 0), 500000)),
    invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), LEAST(COALESCE(p_invaders_highscore, 0), 500000)),
    drift_highscore = GREATEST(COALESCE(drift_highscore, 0), LEAST(COALESCE(p_drift_highscore, 0), 500000)),
    stacker_highscore = GREATEST(COALESCE(stacker_highscore, 0), LEAST(COALESCE(v_stacker_val, 0), 500000)),
    skeet_highscore = GREATEST(COALESCE(skeet_highscore, 0), LEAST(COALESCE(p_skeet_highscore, 0), 500000)),
    defense_highscore = GREATEST(COALESCE(defense_highscore, 0), LEAST(COALESCE(p_defense_highscore, 0), 500000)),
    alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), COALESCE(game_highscore, 0), LEAST(COALESCE(p_game_highscore, 0), 500000)),
    alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0), LEAST(COALESCE(p_invaders_highscore, 0), 500000)),
    alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0), LEAST(COALESCE(p_drift_highscore, 0), 500000)),
    alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), COALESCE(stacker_highscore, 0), LEAST(COALESCE(v_stacker_val, 0), 500000)),
    alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), COALESCE(skeet_highscore, 0), LEAST(COALESCE(p_skeet_highscore, 0), 500000)),
    defense_alltime_best = GREATEST(COALESCE(defense_alltime_best, 0), COALESCE(defense_highscore, 0), LEAST(COALESCE(p_defense_highscore, 0), 500000)),
    updated_at = NOW()
  WHERE player_id = v_pid;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated, service_role, anon;


-- ==============================================================================
