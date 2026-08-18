-- ==============================================================================
-- POLYGAME: FIX POSTGRES ERROR 42703 (column users.id does not exist)
-- Drops all old overloaded function signatures that referenced obsolete 'users.id'
-- and replaces with canonical 'player_id' queries.
-- ==============================================================================

-- 1. DROP ALL OLD OVERLOADED VERSIONS OF end_arcade_session
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, UUID, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session CASCADE;

-- 2. RECREATE CANONICAL end_arcade_session
CREATE OR REPLACE FUNCTION end_arcade_session(
  p_player_id TEXT,
  p_session_id TEXT,
  p_score INTEGER DEFAULT 0,
  p_collected INTEGER DEFAULT 0,
  p_bonus_tokens INTEGER DEFAULT 0,
  p_catcher_highscore INTEGER DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_session RECORD;
  v_user RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_duration_seconds INTEGER;
  v_base_pgt NUMERIC := 0.0;
  v_multiplier NUMERIC := 1.0;
  v_final_pgt NUMERIC := 0.0;
  v_new_balance NUMERIC := 0.0;
  v_session_uuid UUID;
  v_global_mult NUMERIC := 1.0;
  v_max_score INTEGER := 250000;
  v_clamped_score INTEGER;
  v_nft_bonus NUMERIC := 0.0;
  v_is_vip BOOLEAN := false;
  v_is_ambassador BOOLEAN := false;
BEGIN
  IF p_session_id IS NULL OR TRIM(p_session_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Session ID is required');
  END IF;

  BEGIN
    v_session_uuid := p_session_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid session UUID format');
  END IF;

  SELECT * INTO v_session FROM arcade_sessions WHERE id = v_session_uuid AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Session expired, already completed, or invalid');
  END IF;

  v_duration_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_now - v_session.created_at))::INTEGER);

  IF v_duration_seconds < 3 AND p_score > 100 THEN
    UPDATE arcade_sessions SET status = 'rejected', completed_at = v_now, duration_seconds = v_duration_seconds WHERE id = v_session_uuid;
    RETURN jsonb_build_object('success', false, 'message', 'Anti-Cheat: Impossible session duration detected');
  END IF;

  SELECT * INTO v_user FROM users WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player record not found');
  END IF;

  SELECT COALESCE(earn_multiplier, 1.0) INTO v_global_mult FROM global_settings WHERE id = 1;
  IF v_global_mult IS NULL OR v_global_mult <= 0 THEN v_global_mult := 1.0; END IF;

  v_clamped_score := LEAST(GREATEST(0, p_score), v_max_score);

  IF v_session.game_name = 'AstroDodge' THEN
    v_base_pgt := (v_clamped_score / 2500.0) + (p_collected * 0.05);
  ELSIF v_session.game_name = 'Cyber Drift' THEN
    v_base_pgt := (v_clamped_score / 2500.0) + (p_collected * 0.04);
  ELSIF v_session.game_name = 'Cyber Invaders' THEN
    v_base_pgt := (v_clamped_score * 0.015) + (p_collected * 0.05);
  ELSIF v_session.game_name = 'Cyber Stacker' OR v_session.game_name = 'Cyber Catcher' THEN
    v_base_pgt := (p_collected * 0.45) + (v_clamped_score / 1500.0);
  ELSE
    v_base_pgt := (v_clamped_score / 2500.0) + (p_collected * 0.05);
  END IF;

  v_base_pgt := GREATEST(0.0, v_base_pgt);

  IF v_user.owned_nfts IS NOT NULL AND jsonb_typeof(v_user.owned_nfts) = 'array' THEN
    IF v_user.owned_nfts @> '\"nft_rare_shield\"'::jsonb THEN v_nft_bonus := v_nft_bonus + 0.15; END IF;
    IF v_user.owned_nfts @> '\"nft_pulse_blaster\"'::jsonb THEN v_nft_bonus := v_nft_bonus + 0.30; END IF;
    IF v_user.owned_nfts @> '\"nft_epic_yield\"'::jsonb THEN v_nft_bonus := v_nft_bonus + 0.50; END IF;
  END IF;

  v_multiplier := (1.0 + v_nft_bonus);

  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_multiplier := v_multiplier * 2.0;
    v_is_vip := true;
  END IF;

  IF COALESCE(v_user.is_ambassador, false) = true THEN
    v_multiplier := v_multiplier * 2.0;
    v_is_ambassador := true;
  END IF;

  v_final_pgt := (v_base_pgt * v_multiplier * v_global_mult) + (p_bonus_tokens * 5.0);
  v_final_pgt := LEAST(v_final_pgt, 250.0);

  IF v_final_pgt > 0 THEN
    UPDATE users 
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt, 
        total_earned = COALESCE(total_earned, 0) + v_final_pgt, 
        updated_at = v_now 
    WHERE LOWER(player_id) = LOWER(v_user.player_id) 
    RETURNING balance_pgt INTO v_new_balance;
  ELSE
    v_new_balance := COALESCE(v_user.balance_pgt, 0);
  END IF;

  UPDATE arcade_sessions 
  SET status = 'completed', 
      completed_at = v_now, 
      score = v_clamped_score, 
      payout_pgt = v_final_pgt, 
      duration_seconds = v_duration_seconds 
  WHERE id = v_session_uuid;

  -- Update game metrics
  INSERT INTO game_metrics (game_name, total_wagered, total_payout, total_playtime_seconds, last_updated)
  VALUES (v_session.game_name, 0, v_final_pgt, v_duration_seconds, v_now)
  ON CONFLICT (game_name) DO UPDATE
  SET total_payout = game_metrics.total_payout + EXCLUDED.total_payout,
      total_playtime_seconds = game_metrics.total_playtime_seconds + EXCLUDED.total_playtime_seconds,
      last_updated = EXCLUDED.last_updated;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'game_name', v_session.game_name,
    'score', v_clamped_score,
    'payout_pgt', v_final_pgt,
    'new_balance', v_new_balance,
    'multiplier', v_multiplier
  );
END;
$$;

GRANT EXECUTE ON FUNCTION end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;

-- 3. DROP & RECREATE claim_daily_quest
DROP FUNCTION IF EXISTS claim_daily_quest(TEXT, TEXT);
DROP FUNCTION IF EXISTS claim_daily_quest CASCADE;

CREATE OR REPLACE FUNCTION claim_daily_quest(p_wallet TEXT, p_quest_type TEXT) 
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_user RECORD;
  v_q JSONB;
  v_today TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_reward NUMERIC := 0;
  v_new_balance NUMERIC;
BEGIN
  SELECT * INTO v_user FROM users WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'User not found'); END IF;

  v_q := v_user.daily_quests;
  IF v_q IS NULL OR (v_q->>'date') IS NULL OR (v_q->>'date') <> v_today THEN
    v_q := jsonb_build_object(
      'date', v_today, 'games', 0, 'mining', 0, 'wins', 0,
      'games_claimed', false, 'mining_claimed', false, 'wins_claimed', false,
      'master_claimed', false,
      'streak_days', COALESCE((v_q->>'streak_days')::int, 0),
      'last_streak_date', COALESCE(v_q->>'last_streak_date', '')
    );
  END IF;

  IF p_quest_type = 'games' THEN
    IF COALESCE((v_q->>'games')::int, 0) < 3 THEN RETURN jsonb_build_object('success', false, 'message', 'Play 3 games first!'); END IF;
    IF COALESCE((v_q->>'games_claimed')::boolean, false) THEN RETURN jsonb_build_object('success', false, 'message', 'Already claimed today!'); END IF;
    v_q := jsonb_set(v_q, '{games_claimed}', 'true'); v_reward := 10;
  ELSIF p_quest_type = 'mining' THEN
    IF COALESCE((v_q->>'mining')::int, 0) < 3 THEN RETURN jsonb_build_object('success', false, 'message', 'Mine 3 shards first!'); END IF;
    IF COALESCE((v_q->>'mining_claimed')::boolean, false) THEN RETURN jsonb_build_object('success', false, 'message', 'Already claimed today!'); END IF;
    v_q := jsonb_set(v_q, '{mining_claimed}', 'true'); v_reward := 10;
  ELSIF p_quest_type = 'wins' THEN
    IF COALESCE((v_q->>'wins')::int, 0) < 3 THEN RETURN jsonb_build_object('success', false, 'message', 'Win 3 rounds first!'); END IF;
    IF COALESCE((v_q->>'wins_claimed')::boolean, false) THEN RETURN jsonb_build_object('success', false, 'message', 'Already claimed today!'); END IF;
    v_q := jsonb_set(v_q, '{wins_claimed}', 'true'); v_reward := 10;
  ELSIF p_quest_type = 'master' THEN
    IF NOT (COALESCE((v_q->>'games_claimed')::boolean, false) OR COALESCE((v_q->>'games')::int, 0) >= 3) OR
       NOT (COALESCE((v_q->>'mining_claimed')::boolean, false) OR COALESCE((v_q->>'mining')::int, 0) >= 3) OR
       NOT (COALESCE((v_q->>'wins_claimed')::boolean, false) OR COALESCE((v_q->>'wins')::int, 0) >= 3) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Complete all 3 daily quests first!');
    END IF;
    IF COALESCE((v_q->>'master_claimed')::boolean, false) THEN RETURN jsonb_build_object('success', false, 'message', 'Already claimed today!'); END IF;
    v_q := jsonb_set(v_q, '{master_claimed}', 'true'); v_reward := 25;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Invalid quest type');
  END IF;

  v_new_balance := COALESCE(v_user.balance_pgt, 0) + v_reward;
  UPDATE users SET balance_pgt = v_new_balance, daily_quests = v_q, updated_at = NOW() WHERE LOWER(player_id) = LOWER(v_user.player_id);
  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'new_balance', v_new_balance, 'daily_quests', v_q);
END;
$$;

GRANT EXECUTE ON FUNCTION claim_daily_quest(TEXT, TEXT) TO anon, authenticated, service_role;
