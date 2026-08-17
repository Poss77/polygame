-- ==============================================================================
-- POLYGAME ARCADE REWARD & HIGHSCORE RPC FIX (ALL GAMES)
-- 1. Unifies formulas across all 4 games:
--    - AstroDodge: (score / 2500.0) + (shards * 0.05)
--    - Cyber Drift: (score / 2500.0) + (orbs * 0.04)
--    - Cyber Invaders: (score * 0.015) + (gems * 0.05)
--    - Cyber Stacker: (floors * 0.45) + (score / 1500.0)
-- 2. Multiplier: (NFT * VIP * Ambassador)
-- 3. Bonus Tokens: (+5 PGT per collectible token)
-- ==============================================================================

-- 1. Ensure all columns exist on users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alltime_game_highscore INT DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alltime_highscore INT DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alltime_invaders_highscore INT DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alltime_drift_highscore INT DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alltime_catcher_highscore INT DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alltime_stacker_highscore INT DEFAULT 0;

-- 2. Update end_arcade_session
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, UUID, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC);

CREATE OR REPLACE FUNCTION end_arcade_session(
  p_player_id TEXT,
  p_session_id TEXT,
  p_score INTEGER DEFAULT 0,
  p_bonus_items INTEGER DEFAULT 0,
  p_bonus_tokens INTEGER DEFAULT 0,
  p_nft_multiplier NUMERIC DEFAULT 1.0
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
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
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN v_pid := LOWER(TRIM(p_player_id)); END IF;
  BEGIN v_session_uuid := p_session_id::UUID; EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid session ID'); END;

  SELECT * INTO v_session FROM arcade_sessions WHERE id = v_session_uuid AND status = 'active' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired session'); END IF;

  v_game_name := v_session.game_name;
  v_duration_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_now - v_session.started_at))::INTEGER);

  IF v_duration_seconds < 2 AND v_clamped_score > 50 THEN
    UPDATE arcade_sessions SET status = 'rejected', completed_at = v_now, duration_seconds = v_duration_seconds WHERE id = v_session_uuid;
    RETURN jsonb_build_object('success', false, 'error', 'Session rejected');
  END IF;

  IF v_game_name = 'Cyber Invaders' THEN v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 500);
  ELSIF v_game_name = 'AstroDodge' THEN v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 600 + 500);
  ELSIF v_game_name = 'Cyber Drift' THEN v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 500);
  ELSE v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 450 + 500);
  END IF;

  SELECT * INTO v_user FROM users WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User not found'); END IF;

  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN v_vip_mult := 2.0; END IF;
  IF v_user.is_ambassador IS TRUE THEN v_amb_mult := 2.0; END IF;

  -- True total multiplier: NFT * VIP * Ambassador
  v_total_multiplier := v_clamped_nft_mult * v_vip_mult * v_amb_mult;

  -- Unified Raw Base Formulas (un-multiplied)
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

  -- Update High Scores keyed by player_id
  IF v_game_name = 'Cyber Invaders' AND v_clamped_score > COALESCE(v_user.invaders_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE users SET invaders_highscore = v_clamped_score, alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_clamped_score) WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF v_game_name = 'AstroDodge' AND v_clamped_score > COALESCE(v_user.game_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE users SET game_highscore = v_clamped_score, alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), v_clamped_score), alltime_highscore = GREATEST(COALESCE(alltime_highscore, 0), v_clamped_score) WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF v_game_name = 'Cyber Drift' AND v_clamped_score > COALESCE(v_user.drift_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE users SET drift_highscore = v_clamped_score, alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_clamped_score) WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF (v_game_name = 'Cyber Stacker' OR v_game_name = 'Cyber Catcher') AND v_clamped_score > COALESCE(v_user.catcher_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE users SET catcher_highscore = v_clamped_score, stacker_highscore = v_clamped_score, alltime_catcher_highscore = GREATEST(COALESCE(alltime_catcher_highscore, 0), v_clamped_score), alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), v_clamped_score) WHERE LOWER(player_id) = LOWER(v_user.player_id);
  END IF;

  -- Credit balance
  IF v_final_pgt > 0 THEN
    UPDATE users SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt, total_earned = COALESCE(total_earned, 0) + v_final_pgt, updated_at = v_now WHERE LOWER(player_id) = LOWER(v_user.player_id) RETURNING balance_pgt INTO v_new_balance;
  ELSE
    v_new_balance := COALESCE(v_user.balance_pgt, 0);
  END IF;

  UPDATE arcade_sessions SET status = 'completed', completed_at = v_now, score = v_clamped_score, payout_pgt = v_final_pgt, duration_seconds = v_duration_seconds WHERE id = v_session_uuid;

  RETURN jsonb_build_object('success', true, 'payout', v_final_pgt, 'new_balance', v_new_balance, 'duration_seconds', v_duration_seconds, 'score', v_clamped_score, 'is_new_high', v_is_new_high);
END;
$$;

-- Overload for legacy 5-param signature
CREATE OR REPLACE FUNCTION end_arcade_session(
  p_player_id TEXT,
  p_session_id TEXT,
  p_score INTEGER DEFAULT 0,
  p_bonus_items INTEGER DEFAULT 0,
  p_bonus_tokens INTEGER DEFAULT 0
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN end_arcade_session(p_player_id, p_session_id, p_score, p_bonus_items, p_bonus_tokens, 1.0);
END;
$$;

GRANT EXECUTE ON FUNCTION end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;

-- 3. MODERN SUBMIT ARCADE HIGHSCORES
DROP FUNCTION IF EXISTS submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION submit_arcade_highscore(
  p_player_id TEXT DEFAULT NULL,
  p_game_highscore INTEGER DEFAULT NULL,
  p_invaders_highscore INTEGER DEFAULT NULL,
  p_drift_highscore INTEGER DEFAULT NULL,
  p_stacker_highscore INTEGER DEFAULT NULL,
  p_catcher_highscore INTEGER DEFAULT NULL,
  p_wallet TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_raw_id TEXT := COALESCE(p_player_id, p_wallet);
  v_pid TEXT;
  v_stacker_val INTEGER := COALESCE(p_stacker_highscore, p_catcher_highscore);
BEGIN
  IF v_raw_id IS NULL OR v_raw_id = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player identity required');
  END IF;

  v_pid := resolve_player_id(v_raw_id);
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(v_raw_id));
  END IF;

  UPDATE users
  SET game_highscore = GREATEST(COALESCE(game_highscore, 0), COALESCE(p_game_highscore, 0)),
      invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), COALESCE(p_invaders_highscore, 0)),
      drift_highscore = GREATEST(COALESCE(drift_highscore, 0), COALESCE(p_drift_highscore, 0)),
      catcher_highscore = GREATEST(COALESCE(catcher_highscore, 0), COALESCE(v_stacker_val, 0)),
      stacker_highscore = GREATEST(COALESCE(stacker_highscore, 0), COALESCE(v_stacker_val, 0)),
      alltime_highscore = GREATEST(COALESCE(alltime_highscore, 0), COALESCE(game_highscore, 0), COALESCE(p_game_highscore, 0)),
      alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), COALESCE(game_highscore, 0), COALESCE(p_game_highscore, 0)),
      alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0), COALESCE(p_invaders_highscore, 0)),
      alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0), COALESCE(p_drift_highscore, 0)),
      alltime_catcher_highscore = GREATEST(COALESCE(alltime_catcher_highscore, 0), COALESCE(catcher_highscore, 0), COALESCE(v_stacker_val, 0)),
      alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), COALESCE(stacker_highscore, 0), COALESCE(v_stacker_val, 0)),
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Overload for legacy 5-param signature
CREATE OR REPLACE FUNCTION submit_arcade_highscore(
  p_wallet TEXT,
  p_game_highscore INTEGER DEFAULT NULL,
  p_invaders_highscore INTEGER DEFAULT NULL,
  p_drift_highscore INTEGER DEFAULT NULL,
  p_catcher_highscore INTEGER DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN submit_arcade_highscore(
    p_player_id => p_wallet,
    p_game_highscore => p_game_highscore,
    p_invaders_highscore => p_invaders_highscore,
    p_drift_highscore => p_drift_highscore,
    p_stacker_highscore => p_catcher_highscore,
    p_catcher_highscore => p_catcher_highscore
  );
END;
$$;

GRANT EXECUTE ON FUNCTION submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;
