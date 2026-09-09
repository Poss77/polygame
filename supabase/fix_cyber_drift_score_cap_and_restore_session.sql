-- ==============================================================================
-- POLYGON GAMING: FIX CYBER DRIFT SCORE VELOCITY CAP & RESTORE 70K SESSION
-- ==============================================================================
-- Problem:
-- Cyber Drift generates ~800 to 1,500 points/second at high speeds (due to 60fps
-- distance * 10 + orbs), but end_arcade_session had an outdated anti-cheat clamp
-- of `v_duration_seconds * 500 + 500`.
-- A 79-second game was capped at: 79 * 500 + 500 = 40,000 pts.
--
-- Fix:
-- 1. Updates end_arcade_session to allow up to `v_duration_seconds * 2500 + 5000`.
-- 2. Restores Poss's session `6cb754ee-c8f4-4027-99ca-6235043c04b2` to 70,000 pts.
-- 3. Sets Poss's active weekly drift_highscore to 70,000 pts.
-- 4. Credits the missing PGT payout (+126.36 PGT) to Poss's balance.
-- ==============================================================================

BEGIN;

-- 1. Correct Poss's affected Cyber Drift session
UPDATE public.arcade_sessions
SET 
  score = 70000,
  payout_pgt = 344.91
WHERE id = '6cb754ee-c8f4-4027-99ca-6235043c04b2'
  AND score = 40000;

-- 2. Update Poss's weekly high score and credit missing PGT payout (+126.36 PGT)
UPDATE public.users
SET 
  drift_highscore = GREATEST(COALESCE(drift_highscore, 0), 70000),
  alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), 70000),
  balance_pgt = COALESCE(balance_pgt, 0) + 126.36,
  total_earned = COALESCE(total_earned, 0) + 126.36,
  updated_at = NOW()
WHERE player_id = '0xpgt8312e02d37185b5983e6922d1dae1cce';

-- 3. Update end_arcade_session RPC with calibrated Cyber Drift velocity limits
CREATE OR REPLACE FUNCTION public.end_arcade_session(
  p_session_id TEXT,
  p_score INTEGER,
  p_bonus_items INTEGER DEFAULT 0,
  p_bonus_tokens INTEGER DEFAULT 0,
  p_nft_multiplier NUMERIC DEFAULT 1.0,
  p_player_id TEXT DEFAULT NULL,
  p_relic_multiplier NUMERIC DEFAULT 1.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_session_uuid UUID;
  v_session RECORD;
  v_user RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_duration_seconds INTEGER;
  v_clamped_score INTEGER;
  v_clamped_items INTEGER;
  v_clamped_tokens INTEGER;
  v_clamped_nft_mult NUMERIC;
  v_relic_mult NUMERIC := 1.0;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC := 1.0;
  v_raw_pgt NUMERIC := 0.0;
  v_token_pgt NUMERIC := 0.0;
  v_final_payout NUMERIC := 0.0;
  v_new_balance NUMERIC;
  v_is_new_high BOOLEAN := false;
  v_game_name TEXT;
  v_game_clean TEXT;
  v_game_key TEXT;
  v_global_earn_mult NUMERIC := 1.0;
  v_game_settings JSONB := '{}'::jsonb;
  v_max_daily_plays INTEGER := 35;
  v_daily_completed_count INTEGER := 0;
  v_harvest_enabled BOOLEAN := true;
  v_new_weekly_games INTEGER := 0;
  v_current_weekly_faucets INTEGER := 0;
  v_new_weekly_tier INTEGER := 0;
BEGIN
  -- Resolve Player ID
  v_pid := public.resolve_player_id(COALESCE(p_player_id, auth.jwt() ->> 'sub', ''));
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_player_id, '')));
  END IF;

  IF v_pid IS NULL OR v_pid = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unable to resolve player ID');
  END IF;

  -- Validate Session UUID
  BEGIN
    v_session_uuid := p_session_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session UUID');
  END;

  -- Fetch Active Arcade Session
  SELECT * INTO v_session
  FROM arcade_sessions
  WHERE id = v_session_uuid AND player_id = v_pid
  FOR UPDATE;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found or belongs to another player');
  END IF;

  IF v_session.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session has already been completed');
  END IF;

  -- Load User Row early for permissions and multipliers
  SELECT * INTO v_user FROM users WHERE player_id = v_pid FOR UPDATE;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found in database');
  END IF;

  v_game_name := v_session.game_name;
  v_game_clean := LOWER(TRIM(COALESCE(v_game_name, '')));
  v_duration_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_now - COALESCE(v_session.started_at, v_session.created_at)))::INTEGER);

  -- Fetch Game Settings & Global Earn Multiplier (earn_multiplier column)
  BEGIN
    SELECT 
      COALESCE(earn_multiplier, 1.0),
      COALESCE(game_payout_settings, '{}'::jsonb),
      COALESCE(max_daily_plays_per_game, 35)
    INTO 
      v_global_earn_mult,
      v_game_settings,
      v_max_daily_plays
    FROM global_settings 
    WHERE id = 1;
  EXCEPTION WHEN OTHERS THEN
    v_global_earn_mult := 1.0;
    v_game_settings := '{}'::jsonb;
    v_max_daily_plays := 35;
  END;

  IF v_game_clean LIKE '%astro%' THEN v_game_key := 'astrododge';
  ELSIF v_game_clean LIKE '%invader%' THEN v_game_key := 'invaders';
  ELSIF v_game_clean LIKE '%drift%' THEN v_game_key := 'drift';
  ELSIF v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%' THEN v_game_key := 'stacker';
  ELSIF v_game_clean LIKE '%skeet%' THEN v_game_key := 'skeet';
  ELSIF v_game_clean LIKE '%defense%' THEN v_game_key := 'defense';
  ELSE v_game_key := v_game_clean;
  END IF;

  IF v_game_settings ? v_game_key THEN
    IF (v_game_settings->v_game_key->>'harvest_enabled') IS NOT NULL THEN
      v_harvest_enabled := (v_game_settings->v_game_key->>'harvest_enabled')::BOOLEAN;
    END IF;
  END IF;

  -- Anti-Cheat Velocity Rate Checks per Game
  IF v_game_clean LIKE '%astro%' THEN
    v_clamped_score := LEAST(GREATEST(0, p_score), v_duration_seconds * 600 + 500);
    v_clamped_items := LEAST(GREATEST(0, p_bonus_items), v_duration_seconds * 5 + 50);
  ELSIF v_game_clean LIKE '%invader%' THEN
    v_clamped_score := LEAST(GREATEST(0, p_score), v_duration_seconds * 500 + 500);
    v_clamped_items := LEAST(GREATEST(0, p_bonus_items), v_duration_seconds * 4 + 40);
  ELSIF v_game_clean LIKE '%drift%' THEN
    -- Cyber Drift distance*10 accrues at speed*60 pts/sec (~1,000 - 1,500 pts/sec + orbs)
    v_clamped_score := LEAST(GREATEST(0, p_score), v_duration_seconds * 2500 + 5000);
    v_clamped_items := LEAST(GREATEST(0, p_bonus_items), v_duration_seconds * 5 + 50);
  ELSIF v_game_clean LIKE '%skeet%' THEN
    v_clamped_score := LEAST(GREATEST(0, p_score), v_duration_seconds * 600 + 500);
    v_clamped_items := LEAST(GREATEST(0, p_bonus_items), v_duration_seconds * 5 + 50);
  ELSIF v_game_clean LIKE '%defense%' THEN
    v_clamped_score := LEAST(GREATEST(0, p_score), v_duration_seconds * 500 + 5000);
    v_clamped_items := LEAST(GREATEST(0, p_bonus_items), v_duration_seconds * 6 + 100);
  ELSE
    v_clamped_score := LEAST(GREATEST(0, p_score), v_duration_seconds * 450 + 500);
    v_clamped_items := LEAST(GREATEST(0, p_bonus_items), v_duration_seconds * 4 + 40);
  END IF;

  v_clamped_tokens := LEAST(GREATEST(0, p_bonus_tokens), 10);
  v_clamped_nft_mult := GREATEST(1.0, LEAST(COALESCE(p_nft_multiplier, 1.0), 10.0));

  -- Daily Play Limit Check (Enforced for ALL players, including Admins and Ambassadors)
  SELECT COUNT(*) INTO v_daily_completed_count
  FROM arcade_sessions
  WHERE player_id = v_pid
    AND (LOWER(game_name) = v_game_clean OR LOWER(game_name) = v_game_key)
    AND completed_at >= (v_now - INTERVAL '24 hours')
    AND status = 'completed';

  IF v_daily_completed_count >= v_max_daily_plays THEN
    UPDATE arcade_sessions
    SET status = 'completed', score = v_clamped_score, completed_at = v_now, duration_seconds = v_duration_seconds
    WHERE id = v_session_uuid;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily play limit reached (' || v_daily_completed_count || '/' || v_max_daily_plays || ')',
      'daily_limit_reached', true,
      'completed_today', v_daily_completed_count,
      'max_daily_plays', v_max_daily_plays,
      'payout_pgt', 0
    );
  END IF;

  -- Multipliers (VIP, Ambassador, Relics)
  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_vip_mult := 2.0;
  END IF;

  IF v_user.is_ambassador = true THEN
    v_amb_mult := 2.0;
  END IF;

  IF is_season1_apex_unlocked(v_user.relics) OR COALESCE(p_relic_multiplier, 1.0) >= 1.5 THEN
    v_relic_mult := 1.5;
  END IF;

  v_total_multiplier := v_clamped_nft_mult * v_relic_mult * v_vip_mult * v_amb_mult;

  -- Calculate Game-Specific Base PGT and Update Highscores
  IF v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge' THEN
    v_game_name := 'AstroDodge';
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.05)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.game_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET game_highscore = v_clamped_score, 
          alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%invader%' THEN
    v_game_name := 'Cyber Invaders';
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.invaders_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET invaders_highscore = v_clamped_score, 
          alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%drift%' THEN
    v_game_name := 'Cyber Drift';
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.drift_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET drift_highscore = v_clamped_score, 
          alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_clamped_score) 
      WHERE player_id = v_pid;
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
    v_raw_pgt := ((v_clamped_score / 1500.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.defense_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET defense_highscore = v_clamped_score, 
          defense_alltime_best = GREATEST(COALESCE(defense_alltime_best, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;

  ELSE
    v_game_name := 'Arcade Game';
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
  END IF;

  IF NOT v_harvest_enabled THEN
    v_raw_pgt := 0.0;
  END IF;

  v_token_pgt := v_clamped_tokens * 5.0;

  IF v_clamped_score > 0 AND v_harvest_enabled THEN
    v_final_payout := ROUND((v_raw_pgt * v_total_multiplier) + v_token_pgt, 2);
    v_final_payout := GREATEST(0.01, v_final_payout);
  ELSIF v_token_pgt > 0 THEN
    v_final_payout := v_token_pgt;
  ELSE
    v_final_payout := 0.0;
  END IF;

  -- Increment Weekly Activity Counters and calculate dynamic Tier
  v_new_weekly_games := COALESCE(v_user.weekly_games_played, 0) + 1;
  v_current_weekly_faucets := COALESCE(v_user.weekly_faucet_claims, 0);

  IF v_current_weekly_faucets >= 7 AND v_new_weekly_games >= 150 THEN
    v_new_weekly_tier := 5;
  ELSIF v_current_weekly_faucets >= 5 AND v_new_weekly_games >= 75 THEN
    v_new_weekly_tier := 4;
  ELSIF v_current_weekly_faucets >= 3 AND v_new_weekly_games >= 35 THEN
    v_new_weekly_tier := 3;
  ELSIF v_current_weekly_faucets >= 2 AND v_new_weekly_games >= 15 THEN
    v_new_weekly_tier := 2;
  ELSIF v_current_weekly_faucets >= 1 AND v_new_weekly_games >= 5 THEN
    v_new_weekly_tier := 1;
  ELSE
    v_new_weekly_tier := 0;
  END IF;

  -- Update User Balance, Total Earned & Weekly Activity
  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_payout,
      total_earned = COALESCE(total_earned, 0) + v_final_payout,
      weekly_games_played = v_new_weekly_games,
      weekly_active_tier = GREATEST(COALESCE(weekly_active_tier, 0), v_new_weekly_tier),
      updated_at = v_now
  WHERE player_id = v_pid
  RETURNING balance_pgt INTO v_new_balance;

  -- Update Arcade Session Record
  UPDATE arcade_sessions
  SET status = 'completed',
      score = v_clamped_score,
      bonus_items = v_clamped_items,
      bonus_tokens = v_clamped_tokens,
      duration_seconds = v_duration_seconds,
      payout_pgt = v_final_payout,
      completed_at = v_now
  WHERE id = v_session_uuid;

  -- Update Global Game Metrics
  BEGIN
    INSERT INTO game_metrics (game_name, total_plays, total_payout, total_playtime_seconds, last_played_at)
    VALUES (v_game_name, 1, v_final_payout, v_duration_seconds, v_now)
    ON CONFLICT (game_name) DO UPDATE 
    SET total_plays = game_metrics.total_plays + 1,
        total_payout = game_metrics.total_payout + EXCLUDED.total_payout,
        total_playtime_seconds = game_metrics.total_playtime_seconds + EXCLUDED.total_playtime_seconds,
        last_played_at = EXCLUDED.last_played_at;
  EXCEPTION WHEN OTHERS THEN
    -- Non-fatal metric update
  END;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_uuid,
    'game_name', v_game_name,
    'score', v_clamped_score,
    'payout_pgt', v_final_payout,
    'new_balance', v_new_balance,
    'is_new_high', v_is_new_high,
    'duration_seconds', v_duration_seconds,
    'weekly_games_played', v_new_weekly_games,
    'weekly_active_tier', GREATEST(COALESCE(v_user.weekly_active_tier, 0), v_new_weekly_tier),
    'daily_limit_reached', false,
    'harvest_enabled', v_harvest_enabled
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_arcade_session(TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, TEXT, NUMERIC) TO anon, authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
