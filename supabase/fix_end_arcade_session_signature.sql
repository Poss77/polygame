-- ==============================================================================
-- POLYGAME: FIX END_ARCADE_SESSION PARAMETER SIGNATURE & SCHEMA CACHE
-- Matches the exact JSON payload sent by db-sync.js:
-- { p_player_id, p_session_id, p_score, p_bonus_items, p_bonus_tokens, p_nft_multiplier }
-- ==============================================================================

-- 1. Cleanly drop all overloaded versions
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, UUID, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session CASCADE;

-- 2. Create Canonical end_arcade_session matching frontend RPC call
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
  v_user RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_duration_seconds INTEGER;
  v_session_uuid UUID;
  v_clamped_score INTEGER := GREATEST(0, COALESCE(p_score, 0));
  v_clamped_items INTEGER := GREATEST(0, COALESCE(p_bonus_items, 0));
  v_clamped_tokens INTEGER := GREATEST(0, COALESCE(p_bonus_tokens, 0));
  v_clamped_nft_mult NUMERIC := GREATEST(1.0, LEAST(COALESCE(p_nft_multiplier, 1.0), 5.0));
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_global_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC := 1.0;
  v_base_pgt NUMERIC := 0.0;
  v_final_pgt NUMERIC := 0.0;
  v_new_balance NUMERIC := 0.0;
  v_game_name TEXT;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(p_player_id)); 
  END IF;

  IF p_session_id IS NULL OR TRIM(p_session_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session ID is required');
  END IF;

  IF NOT (p_session_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session ID format');
  END IF;

  v_session_uuid := p_session_id::UUID;

  -- 1. Fetch & lock active arcade session
  SELECT * INTO v_session 
  FROM arcade_sessions 
  WHERE id = v_session_uuid AND status = 'active' 
  FOR UPDATE;

  IF NOT FOUND THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired session'); 
  END IF;

  v_game_name := v_session.game_name;
  v_duration_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_now - v_session.created_at))::INTEGER);

  -- 2. Anti-Cheat: Validate impossible speeds/durations
  IF v_duration_seconds < 3 AND v_clamped_score > 100 THEN
    UPDATE arcade_sessions 
    SET status = 'rejected', completed_at = v_now, duration_seconds = v_duration_seconds 
    WHERE id = v_session_uuid;
    RETURN jsonb_build_object('success', false, 'error', 'Session velocity anomaly rejected');
  END IF;

  -- 3. Fetch user record
  SELECT * INTO v_user 
  FROM users 
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid) 
  FOR UPDATE;

  IF NOT FOUND THEN 
    RETURN jsonb_build_object('success', false, 'error', 'User not found'); 
  END IF;

  -- 4. Multipliers
  SELECT COALESCE(earn_multiplier, 1.0) INTO v_global_mult FROM global_settings WHERE id = 1;
  IF v_global_mult IS NULL OR v_global_mult <= 0 THEN v_global_mult := 1.0; END IF;

  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_vip_mult := 2.0;
  END IF;

  IF COALESCE(v_user.is_ambassador, false) = true THEN
    v_amb_mult := 2.0;
  END IF;

  v_total_multiplier := v_clamped_nft_mult * v_vip_mult * v_amb_mult * v_global_mult;

  -- 5. Game-Specific Formula
  IF v_game_name = 'AstroDodge' THEN
    v_base_pgt := (v_clamped_score / 2500.0) + (v_clamped_items * 0.05);
  ELSIF v_game_name = 'Cyber Drift' THEN
    v_base_pgt := (v_clamped_score / 2500.0) + (v_clamped_items * 0.04);
  ELSIF v_game_name = 'Cyber Invaders' THEN
    v_base_pgt := (v_clamped_score * 0.015) + (v_clamped_items * 0.05);
  ELSIF v_game_name = 'Cyber Stacker' OR v_game_name = 'Cyber Catcher' THEN
    v_base_pgt := (v_clamped_items * 0.45) + (v_clamped_score / 1500.0);
  ELSE
    v_base_pgt := (v_clamped_score / 2500.0) + (v_clamped_items * 0.05);
  END IF;

  v_base_pgt := GREATEST(0.0, v_base_pgt);
  v_final_pgt := (v_base_pgt * v_total_multiplier) + (v_clamped_tokens * 5.0);
  v_final_pgt := ROUND(LEAST(v_final_pgt, 250.0), 2);

  -- 6. Credit User Balance
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

  -- 7. Complete Session
  UPDATE arcade_sessions 
  SET status = 'completed', 
      completed_at = v_now, 
      score = v_clamped_score, 
      payout_pgt = v_final_pgt, 
      duration_seconds = v_duration_seconds 
  WHERE id = v_session_uuid;

  -- 8. Update Game Metrics
  INSERT INTO game_metrics (game_name, total_wagered, total_payout, total_playtime_seconds)
  VALUES (v_game_name, 0, v_final_pgt, v_duration_seconds)
  ON CONFLICT (game_name) DO UPDATE
  SET total_payout = COALESCE(game_metrics.total_payout, 0) + EXCLUDED.total_payout,
      total_playtime_seconds = COALESCE(game_metrics.total_playtime_seconds, 0) + EXCLUDED.total_playtime_seconds;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'game_name', v_game_name,
    'score', v_clamped_score,
    'payout_pgt', v_final_pgt,
    'new_balance', v_new_balance,
    'multiplier', v_total_multiplier
  );
END;
$$;

GRANT EXECUTE ON FUNCTION end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC) TO anon, authenticated, service_role;
