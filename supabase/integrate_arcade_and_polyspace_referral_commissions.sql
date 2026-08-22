-- ==============================================================================
-- POLYGAME: INTEGRATE 4-TIER REFERRAL COMMISSIONS INTO ARCADE & POLYSPACE
-- ==============================================================================
-- 1. Updates `end_arcade_session` so downline arcade wins (AstroDodge, Cyber Invaders,
--    Cyber Drift, Cyber Stacker) distribute 4-tier PGT commissions to uplines.
-- 2. Updates `credit_arcade_payout` so PolySpace mining & expedition loot claims
--    distribute 4-tier PGT commissions to uplines.
-- 3. Ensures `process_referral_commissions` handles accurate game labels & usernames.
-- ==============================================================================

-- 1. DROP OLD OVERLOADS OF end_arcade_session
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, UUID, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session CASCADE;

-- 2. RECREATE CANONICAL end_arcade_session WITH REFERRAL COMMISSIONS
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

  -- 2. Anti-Cheat Velocity Clamping (points per second)
  IF v_game_name = 'Cyber Invaders' THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 500);
  ELSIF v_game_name = 'AstroDodge' THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 600 + 500);
  ELSIF v_game_name = 'Cyber Drift' THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 500);
  ELSE
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 450 + 500);
  END IF;

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
      v_raw_pgt := (v_clamped_score * 0.015 + v_clamped_items * 0.05);
    ELSIF v_game_name = 'AstroDodge' THEN 
      v_raw_pgt := ((v_clamped_score / 2500.0) + v_clamped_items * 0.05);
    ELSIF v_game_name = 'Cyber Drift' THEN 
      v_raw_pgt := ((v_clamped_score / 2500.0) + v_clamped_items * 0.04);
    ELSIF (v_game_name = 'Cyber Stacker' OR v_game_name = 'Cyber Catcher') THEN
      v_raw_pgt := ((v_clamped_items * 0.45) + (v_clamped_score / 1500.0));
    ELSE 
      v_raw_pgt := (v_clamped_score / 2500.0);
    END IF;

    v_final_pgt := ROUND(((v_raw_pgt * v_total_multiplier) + (v_clamped_tokens * 5.0))::numeric, 2);
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
      -- Graceful fallback to avoid blocking arcade gameplay if referral RPC has a transient issue
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
    'new_balance', v_new_balance, 
    'duration_seconds', v_duration_seconds, 
    'score', v_clamped_score, 
    'is_new_high', v_is_new_high
  );
END;
$$;

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
$$;

-- 3. RECREATE CANONICAL credit_arcade_payout WITH REFERRAL COMMISSIONS (PolySpace)
DROP FUNCTION IF EXISTS credit_arcade_payout(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS credit_arcade_payout(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS credit_arcade_payout(NUMERIC, TEXT);
DROP FUNCTION IF EXISTS credit_arcade_payout CASCADE;

CREATE OR REPLACE FUNCTION credit_arcade_payout(
  p_player_id TEXT,
  p_amount NUMERIC,
  p_game_name TEXT DEFAULT 'PolySpace Mining'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_clamped_amt NUMERIC;
  v_new_balance NUMERIC;
  v_user RECORD;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(p_player_id)); 
  END IF;

  IF v_pid IS NULL OR v_pid = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player identity required');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  -- Security Clamp: Max 150 PGT per payout call
  v_clamped_amt := ROUND(LEAST(COALESCE(p_amount, 0), 150.0)::numeric, 2);

  SELECT * INTO v_user 
  FROM users 
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_clamped_amt,
      total_earned = COALESCE(total_earned, 0) + v_clamped_amt,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_user.player_id)
  RETURNING balance_pgt INTO v_new_balance;

  -- Process 4-tier referral commissions for uplines
  BEGIN
    PERFORM process_referral_commissions(v_user.player_id, v_clamped_amt, COALESCE(p_game_name, 'PolySpace Fleet'));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true, 
    'payout', v_clamped_amt, 
    'new_balance', v_new_balance
  );
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION credit_arcade_payout(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;
