-- ==============================================================================
-- POLYGAME: SEAL ARCADE BONUS ITEMS & PAYOUT VELOCITY ANTI-CHEAT SENTINEL
-- ==============================================================================
-- 1. Velocity-clamps bonus items (p_bonus_items) against session duration (max 1 item/sec + 2 buffer).
-- 2. Velocity-clamps bonus golden tokens (p_bonus_tokens) against session duration (1 token/30s, max 5/session).
-- 3. Hard-clamps instant sessions (< 3s duration) to maximum 1.00 PGT.
-- 4. Enforces global payout velocity ceiling (0.35 PGT/sec, max 50.00 PGT ceiling).
-- ==============================================================================

CREATE OR REPLACE FUNCTION end_arcade_session(
  p_player_id TEXT,
  p_session_id TEXT,
  p_score INTEGER DEFAULT 0,
  p_bonus_items INTEGER DEFAULT 0,
  p_bonus_tokens INTEGER DEFAULT 0,
  p_nft_multiplier NUMERIC DEFAULT 1.0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_session RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_duration_seconds INTEGER;
  v_session_uuid UUID;
  v_clamped_score INTEGER := GREATEST(0, COALESCE(p_score, 0));
  v_clamped_items INTEGER := GREATEST(0, COALESCE(p_bonus_items, 0));
  v_clamped_tokens INTEGER := GREATEST(0, COALESCE(p_bonus_tokens, 0));
  v_clamped_nft_mult NUMERIC := GREATEST(1.0, LEAST(COALESCE(p_nft_multiplier, 1.0), 5.0));
  v_user RECORD;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC := 1.0;
  v_raw_pgt NUMERIC := 0;
  v_final_pgt NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  v_game_name TEXT;
  v_is_new_high BOOLEAN := false;
  v_max_daily_plays INTEGER := 25;
  v_daily_completed_count INTEGER := 0;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(p_player_id)); 
  END IF;

  BEGIN
    v_session_uuid := p_session_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session ID format');
  END;

  -- 1. Lock and Verify Active Session
  SELECT * INTO v_session 
  FROM arcade_sessions 
  WHERE id = v_session_uuid AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired arcade session');
  END IF;

  v_game_name := v_session.game_name;
  v_duration_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_now - v_session.started_at))::INTEGER);

  -- 2. Anti-Cheat Velocity Clamping (points and bonus items per second)
  IF v_game_name = 'Cyber Invaders' THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 500);
    v_clamped_items := LEAST(v_clamped_items, (v_duration_seconds * 1) + 2);
  ELSIF v_game_name = 'AstroDodge' THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 600 + 500);
    v_clamped_items := LEAST(v_clamped_items, (v_duration_seconds * 1) + 2);
  ELSIF v_game_name = 'Cyber Drift' THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 500);
    v_clamped_items := LEAST(v_clamped_items, (v_duration_seconds * 1) + 2);
  ELSIF (v_game_name = 'Cyber Stacker' OR v_game_name = 'Cyber Catcher') THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 300 + 300);
    v_clamped_items := LEAST(v_clamped_items, (v_duration_seconds * 1) + 2);
  ELSE
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 450 + 500);
    v_clamped_items := LEAST(v_clamped_items, (v_duration_seconds * 1) + 2);
  END IF;

  -- Rare Golden Tokens Velocity Clamping (at most 1 per 30 seconds survival, max 5 per session)
  v_clamped_tokens := LEAST(v_clamped_tokens, LEAST(5, v_duration_seconds / 30));

  -- 3. Lock User Row by player_id / linked wallet
  SELECT * INTO v_user 
  FROM users 
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_user.player_id IS NOT NULL AND v_user.player_id <> '' THEN
    v_pid := LOWER(TRIM(v_user.player_id));
  END IF;

  -- Derive VIP & Ambassador multipliers
  IF (v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now) 
     OR LOWER(COALESCE(v_user.linked_wallet_address, '')) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
     OR LOWER(COALESCE(v_user.player_id, '')) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
     OR v_user.is_admin IS TRUE 
     OR v_user.is_ambassador IS TRUE THEN 
    v_vip_mult := 2.0; 
  END IF;

  IF v_user.is_ambassador IS TRUE THEN
    v_amb_mult := 2.0;
  END IF;

  v_total_multiplier := v_clamped_nft_mult * v_vip_mult * v_amb_mult;

  -- 4. Check Daily Play Limit (Default 25 plays / 24h per game)
  SELECT COALESCE(max_daily_plays_per_game, 25) INTO v_max_daily_plays FROM global_settings WHERE id = 1;
  IF v_max_daily_plays IS NULL OR v_max_daily_plays <= 0 THEN v_max_daily_plays := 25; END IF;

  SELECT COUNT(*) INTO v_daily_completed_count
  FROM arcade_sessions
  WHERE LOWER(player_id) = LOWER(v_pid)
    AND LOWER(game_name) = LOWER(TRIM(v_game_name))
    AND completed_at >= (v_now - INTERVAL '24 hours')
    AND status = 'completed';

  IF v_daily_completed_count >= v_max_daily_plays THEN
    v_final_pgt := 0.0;
  ELSE
    -- Reward Formulas
    IF v_game_name = 'Cyber Invaders' THEN 
      v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.04));
    ELSIF v_game_name = 'AstroDodge' THEN 
      v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.05));
    ELSIF v_game_name = 'Cyber Drift' THEN 
      v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04));
    ELSIF (v_game_name = 'Cyber Stacker' OR v_game_name = 'Cyber Catcher') THEN
      v_raw_pgt := ((v_clamped_items * 0.45) + (v_clamped_score / 1500.0));
    ELSE 
      v_raw_pgt := (v_clamped_score / 2500.0);
    END IF;

    v_final_pgt := ROUND(((v_raw_pgt * v_total_multiplier) + (v_clamped_tokens * 5.0))::numeric, 2);

    -- Payout velocity limiter: Sessions under 3 seconds cannot earn more than 1.00 PGT
    IF v_duration_seconds < 3 THEN
      v_final_pgt := LEAST(v_final_pgt, 1.00);
    END IF;

    -- Global Payout Velocity Ceiling: Max 0.35 PGT per second played (minimum 1.0 PGT floor, max 50.0 PGT ceiling)
    v_final_pgt := LEAST(v_final_pgt, GREATEST(1.00, ROUND((v_duration_seconds * 0.35 * v_total_multiplier)::numeric, 2)));
    v_final_pgt := LEAST(v_final_pgt, 50.00);
  END IF;

  -- 5. Monotonic High Score Updates
  IF v_game_name = 'Cyber Invaders' AND v_clamped_score > COALESCE(v_user.invaders_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE users 
    SET invaders_highscore = v_clamped_score, 
        alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_clamped_score) 
    WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF v_game_name = 'AstroDodge' AND v_clamped_score > COALESCE(v_user.game_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE users 
    SET game_highscore = v_clamped_score, 
        alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), v_clamped_score), 
        alltime_highscore = GREATEST(COALESCE(alltime_highscore, 0), v_clamped_score) 
    WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF v_game_name = 'Cyber Drift' AND v_clamped_score > COALESCE(v_user.drift_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE users 
    SET drift_highscore = v_clamped_score, 
        alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_clamped_score) 
    WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF (v_game_name = 'Cyber Stacker' OR v_game_name = 'Cyber Catcher') AND v_clamped_score > COALESCE(v_user.catcher_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE users 
    SET catcher_highscore = v_clamped_score, 
        stacker_highscore = v_clamped_score, 
        alltime_catcher_highscore = GREATEST(COALESCE(alltime_catcher_highscore, 0), v_clamped_score), 
        alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), v_clamped_score) 
    WHERE LOWER(player_id) = LOWER(v_user.player_id);
  END IF;

  -- 6. Credit Balance & Process 4-Tier Downline Referral Commissions
  IF v_final_pgt > 0 THEN
    UPDATE users 
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt, 
        total_earned = COALESCE(total_earned, 0) + v_final_pgt, 
        updated_at = v_now 
    WHERE LOWER(player_id) = LOWER(v_user.player_id) 
    RETURNING balance_pgt INTO v_new_balance;

    -- Process 4-tier referral commissions for uplines
    BEGIN
      PERFORM process_referral_commissions(v_user.player_id, v_final_pgt, v_game_name || ' Arcade');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  ELSE
    v_new_balance := COALESCE(v_user.balance_pgt, 0);
  END IF;

  -- 7. Mark Session Completed
  UPDATE arcade_sessions 
  SET status = 'completed', 
      completed_at = v_now, 
      score = v_clamped_score, 
      payout_pgt = v_final_pgt, 
      duration_seconds = v_duration_seconds 
  WHERE id = v_session_uuid;

  RETURN jsonb_build_object(
    'success', true, 
    'payout', v_final_pgt, 
    'payout_pgt', v_final_pgt,
    'new_balance', v_new_balance, 
    'duration_seconds', v_duration_seconds, 
    'score', v_clamped_score, 
    'is_new_high', v_is_new_high
  );
END;
$$
;

-- 5-param overload wrapper
CREATE OR REPLACE FUNCTION end_arcade_session(
  p_player_id TEXT,
  p_session_id TEXT,
  p_score INTEGER DEFAULT 0,
  p_bonus_items INTEGER DEFAULT 0,
  p_bonus_tokens INTEGER DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN end_arcade_session(p_player_id, p_session_id, p_score, p_bonus_items, p_bonus_tokens, 1.0);
END;
$$
;
