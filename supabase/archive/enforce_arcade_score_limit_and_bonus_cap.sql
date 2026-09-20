-- ==============================================================================
-- POLYGAME: ENFORCE ARCADE SCORE HARD LIMIT (500,000 PTS) & BONUS TOKEN CAP (100 PGT)
-- Migration File: supabase/enforce_arcade_score_limit_and_bonus_cap.sql
-- Description:
-- 1. end_arcade_session: Rejects any score > 500,000, awards 0 PGT, skips high scores,
--    and records an atomic Bot Warning via public.record_bot_warning.
-- 2. end_arcade_session: Caps bonus token payout to maximum 100.00 PGT (max 20 tokens).
-- 3. submit_arcade_highscore: Enforces 500,000 score limit and records bot warning.
-- 4. prevent_direct_balance_mutation: Strictly SECURITY INVOKER. Blocks direct REST
--    score inflation above 500,000.
-- 5. One-Time Database Cleanup: Resets all existing scores > 500,000 to 0.
-- ==============================================================================

-- 1. UPDATE end_arcade_session
-- ------------------------------------------------------------------------------
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
  v_pid := resolve_player_id(p_player_id);
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(COALESCE(p_player_id, ''))); 
  END IF;

  v_now := NOW();
  v_clamped_score := GREATEST(0, COALESCE(p_score, 0));
  v_clamped_items := GREATEST(0, COALESCE(p_bonus_items, 0));
  -- Cap bonus tokens to maximum 20 (equivalent to 100 PGT max bonus)
  v_clamped_tokens := GREATEST(0, LEAST(COALESCE(p_bonus_tokens, 0), 20));
  v_clamped_nft_mult := GREATEST(1.0, LEAST(COALESCE(p_nft_multiplier, 1.0), 10.0));
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

  -- 1.5x Apex Relics multiplier evaluated from user relics or parameter
  IF is_season1_apex_unlocked(v_user.relics) OR COALESCE(p_relic_multiplier, 1.0) >= 1.5 THEN
    v_relic_mult := 1.5;
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

GRANT EXECUTE ON FUNCTION public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC) TO anon, authenticated, service_role;


-- 2. UPDATE submit_arcade_highscore
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION submit_arcade_highscore(
  p_player_id TEXT,
  p_game_highscore INTEGER DEFAULT NULL,
  p_invaders_highscore INTEGER DEFAULT NULL,
  p_drift_highscore INTEGER DEFAULT NULL,
  p_stacker_highscore INTEGER DEFAULT NULL,
  p_catcher_highscore INTEGER DEFAULT NULL,
  p_skeet_highscore INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_stacker_val INTEGER := COALESCE(p_stacker_highscore, p_catcher_highscore);
  v_max_score INTEGER := 0;
BEGIN
  IF v_pid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  v_max_score := GREATEST(
    COALESCE(p_game_highscore, 0),
    COALESCE(p_invaders_highscore, 0),
    COALESCE(p_drift_highscore, 0),
    COALESCE(v_stacker_val, 0),
    COALESCE(p_skeet_highscore, 0)
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
    alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), COALESCE(game_highscore, 0), LEAST(COALESCE(p_game_highscore, 0), 500000)),
    alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0), LEAST(COALESCE(p_invaders_highscore, 0), 500000)),
    alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0), LEAST(COALESCE(p_drift_highscore, 0), 500000)),
    alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), COALESCE(stacker_highscore, 0), LEAST(COALESCE(v_stacker_val, 0), 500000)),
    alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), COALESCE(skeet_highscore, 0), LEAST(COALESCE(p_skeet_highscore, 0), 500000)),
    updated_at = NOW()
  WHERE player_id = v_pid;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;


-- 3. UPDATE prevent_direct_balance_mutation TRIGGER
-- (CRITICAL: MUST REMAIN STRICTLY SECURITY INVOKER - NO SECURITY DEFINER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_r_key TEXT;
  v_old_unm INT;
  v_new_unm INT;
  v_merged_r JSONB;
BEGIN
  -- Restrict direct PostgREST client queries (anon & authenticated roles)
  -- Legitimate SECURITY DEFINER procedures run as 'postgres' and bypass this check.
  IF LOWER(CURRENT_USER) IN ('anon', 'authenticated') THEN

    IF TG_OP = 'INSERT' THEN
      -- Sanitize newly inserted accounts against elevated balances & privileges
      NEW.balance_pgt := 0.0;
      NEW.created_at := NOW();
      NEW.is_admin := false;
      NEW.is_ambassador := false;
      NEW.dex_liquidity_usd := 0.0;
      NEW.is_banned := false;
      NEW.bot_warning := 0;
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
      NEW.owned_nfts := '[]'::jsonb;
      NEW.crate_nfts := '[]'::jsonb;
      NEW.relics := '{}'::jsonb;

      -- Clamp starting minerals
      IF NEW.space_state IS NOT NULL THEN
        NEW.space_state := jsonb_set(NEW.space_state, '{warpLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{laserLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{cargoLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{shieldLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{turretLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{fleetPower}', '380'::jsonb);
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

      -- 2. Immutable balances (PGT mutations MUST go through SECURITY DEFINER RPCs)
      IF NEW.balance_pgt IS DISTINCT FROM OLD.balance_pgt THEN
        NEW.balance_pgt := OLD.balance_pgt;
      END IF;

      -- 3. Immutable roles, LP status, and VIP / ban status
      IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
        NEW.is_admin := OLD.is_admin;
      END IF;
      IF NEW.is_ambassador IS DISTINCT FROM OLD.is_ambassador THEN
        NEW.is_ambassador := OLD.is_ambassador;
      END IF;
      IF NEW.dex_liquidity_usd IS DISTINCT FROM OLD.dex_liquidity_usd THEN
        NEW.dex_liquidity_usd := OLD.dex_liquidity_usd;
      END IF;
      IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
        NEW.is_banned := OLD.is_banned;
      END IF;
      IF NEW.bot_warning < OLD.bot_warning THEN
        NEW.bot_warning := OLD.bot_warning;
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

      -- 7. High score ceiling (max 500,000 pts) & rollback prevention
      IF NEW.game_highscore > 500000 THEN
        NEW.game_highscore := OLD.game_highscore;
      ELSIF NEW.game_highscore < OLD.game_highscore THEN
        NEW.game_highscore := OLD.game_highscore;
      END IF;

      IF NEW.invaders_highscore > 500000 THEN
        NEW.invaders_highscore := OLD.invaders_highscore;
      ELSIF NEW.invaders_highscore < OLD.invaders_highscore THEN
        NEW.invaders_highscore := OLD.invaders_highscore;
      END IF;

      IF NEW.drift_highscore > 500000 THEN
        NEW.drift_highscore := OLD.drift_highscore;
      ELSIF NEW.drift_highscore < OLD.drift_highscore THEN
        NEW.drift_highscore := OLD.drift_highscore;
      END IF;

      IF NEW.stacker_highscore > 500000 THEN
        NEW.stacker_highscore := OLD.stacker_highscore;
      ELSIF NEW.stacker_highscore < OLD.stacker_highscore THEN
        NEW.stacker_highscore := OLD.stacker_highscore;
      END IF;

      IF NEW.skeet_highscore > 500000 THEN
        NEW.skeet_highscore := OLD.skeet_highscore;
      ELSIF NEW.skeet_highscore < OLD.skeet_highscore THEN
        NEW.skeet_highscore := OLD.skeet_highscore;
      END IF;

      IF NEW.defense_highscore > 500000 THEN
        NEW.defense_highscore := OLD.defense_highscore;
      ELSIF NEW.defense_highscore < OLD.defense_highscore THEN
        NEW.defense_highscore := OLD.defense_highscore;
      END IF;

      -- Also clamp all-time score equivalents if client attempts direct update
      IF NEW.alltime_game_highscore > 500000 THEN NEW.alltime_game_highscore := OLD.alltime_game_highscore; END IF;
      IF NEW.alltime_invaders_highscore > 500000 THEN NEW.alltime_invaders_highscore := OLD.alltime_invaders_highscore; END IF;
      IF NEW.alltime_drift_highscore > 500000 THEN NEW.alltime_drift_highscore := OLD.alltime_drift_highscore; END IF;
      IF NEW.alltime_stacker_highscore > 500000 THEN NEW.alltime_stacker_highscore := OLD.alltime_stacker_highscore; END IF;
      IF NEW.alltime_skeet_highscore > 500000 THEN NEW.alltime_skeet_highscore := OLD.alltime_skeet_highscore; END IF;
      IF NEW.defense_alltime_best > 500000 THEN NEW.defense_alltime_best := OLD.defense_alltime_best; END IF;

      -- 8. Immutable referral commissions & VIP POL yields
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

      -- 9. Immutable Inventory: owned_nfts & crate_nfts
      IF NEW.owned_nfts IS DISTINCT FROM OLD.owned_nfts THEN
        NEW.owned_nfts := OLD.owned_nfts;
      END IF;
      IF NEW.crate_nfts IS DISTINCT FROM OLD.crate_nfts THEN
        NEW.crate_nfts := OLD.crate_nfts;
      END IF;

      -- 10. Relics Inventory Protection
      IF NEW.relics IS DISTINCT FROM OLD.relics THEN
        IF OLD.relics IS NULL OR OLD.relics = '{}'::jsonb THEN
          NEW.relics := OLD.relics;
        ELSE
          v_merged_r := OLD.relics;
          FOR v_r_key IN SELECT jsonb_object_keys(OLD.relics)
          LOOP
            v_old_unm := COALESCE((OLD.relics->v_r_key->>'unminted')::int, 0);
            v_new_unm := COALESCE((NEW.relics->v_r_key->>'unminted')::int, 0);
            IF v_new_unm > v_old_unm THEN
              NEW.relics := OLD.relics;
              EXIT;
            END IF;
          END LOOP;
        END IF;
      END IF;

      -- 11. PolySpace Fleet Upgrades & Mineral Protections
      IF NEW.space_state IS NOT NULL AND OLD.space_state IS NOT NULL THEN
        IF COALESCE((NEW.space_state->>'warpLevel')::int, 1) < COALESCE((OLD.space_state->>'warpLevel')::int, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{warpLevel}', to_jsonb(COALESCE((OLD.space_state->>'warpLevel')::int, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'laserLevel')::int, 1) < COALESCE((OLD.space_state->>'laserLevel')::int, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{laserLevel}', to_jsonb(COALESCE((OLD.space_state->>'laserLevel')::int, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'cargoLevel')::int, 1) < COALESCE((OLD.space_state->>'cargoLevel')::int, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{cargoLevel}', to_jsonb(COALESCE((OLD.space_state->>'cargoLevel')::int, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'shieldLevel')::int, 1) < COALESCE((OLD.space_state->>'shieldLevel')::int, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{shieldLevel}', to_jsonb(COALESCE((OLD.space_state->>'shieldLevel')::int, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'turretLevel')::int, 1) < COALESCE((OLD.space_state->>'turretLevel')::int, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{turretLevel}', to_jsonb(COALESCE((OLD.space_state->>'turretLevel')::int, 1)));
        END IF;

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

    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- 4. ONE-TIME DATABASE CLEANUP: RESET SCORES > 500,000 PTS TO 0
-- ------------------------------------------------------------------------------
UPDATE public.users
SET 
  game_highscore = CASE WHEN game_highscore > 500000 THEN 0 ELSE game_highscore END,
  alltime_game_highscore = CASE WHEN alltime_game_highscore > 500000 THEN 0 ELSE alltime_game_highscore END,
  invaders_highscore = CASE WHEN invaders_highscore > 500000 THEN 0 ELSE invaders_highscore END,
  alltime_invaders_highscore = CASE WHEN alltime_invaders_highscore > 500000 THEN 0 ELSE alltime_invaders_highscore END,
  drift_highscore = CASE WHEN drift_highscore > 500000 THEN 0 ELSE drift_highscore END,
  alltime_drift_highscore = CASE WHEN alltime_drift_highscore > 500000 THEN 0 ELSE alltime_drift_highscore END,
  stacker_highscore = CASE WHEN stacker_highscore > 500000 THEN 0 ELSE stacker_highscore END,
  alltime_stacker_highscore = CASE WHEN alltime_stacker_highscore > 500000 THEN 0 ELSE alltime_stacker_highscore END,
  skeet_highscore = CASE WHEN skeet_highscore > 500000 THEN 0 ELSE skeet_highscore END,
  alltime_skeet_highscore = CASE WHEN alltime_skeet_highscore > 500000 THEN 0 ELSE alltime_skeet_highscore END,
  defense_highscore = CASE WHEN defense_highscore > 500000 THEN 0 ELSE defense_highscore END,
  defense_alltime_best = CASE WHEN defense_alltime_best > 500000 THEN 0 ELSE defense_alltime_best END
WHERE 
  game_highscore > 500000 OR alltime_game_highscore > 500000 OR
  invaders_highscore > 500000 OR alltime_invaders_highscore > 500000 OR
  drift_highscore > 500000 OR alltime_drift_highscore > 500000 OR
  stacker_highscore > 500000 OR alltime_stacker_highscore > 500000 OR
  skeet_highscore > 500000 OR alltime_skeet_highscore > 500000 OR
  defense_highscore > 500000 OR defense_alltime_best > 500000;
