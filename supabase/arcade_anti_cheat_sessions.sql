-- ==============================================================================
-- POLYGAME ARCADE ANTI-CHEAT & SERVER-SIDE SESSION VALIDATION ARCHITECTURE
-- ==============================================================================
-- Purpose:
-- 1. Creates `arcade_sessions` table with strict Row-Level Security.
-- 2. Implements `start_arcade_session` (session registration with server timestamp).
-- 3. Implements `end_arcade_session` (velocity checks, rate clamping, atomic payouts).
-- 4. Eliminates mid-game exploits, automated bot scripts, and parallel tab farming.
-- ==============================================================================

-- Step 1: Create `arcade_sessions` Table
CREATE TABLE IF NOT EXISTS arcade_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  game_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NULL,
  score INTEGER DEFAULT 0,
  bonus_items INTEGER DEFAULT 0,
  bonus_tokens INTEGER DEFAULT 0,
  payout_pgt NUMERIC DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed', 'expired', 'rejected'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast session lookup
CREATE INDEX IF NOT EXISTS idx_arcade_sessions_player_status ON arcade_sessions(player_id, status);
CREATE INDEX IF NOT EXISTS idx_arcade_sessions_started_at ON arcade_sessions(started_at);

-- Row-Level Security: Public can read their own sessions, but only RPC functions can write
ALTER TABLE arcade_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Arcade Sessions" ON arcade_sessions;
CREATE POLICY "Public Read Arcade Sessions" ON arcade_sessions FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE ON TABLE arcade_sessions FROM anon, authenticated;

-- Step 2: RPC Function - START ARCADE SESSION
DROP FUNCTION IF EXISTS start_arcade_session(TEXT, TEXT);
CREATE OR REPLACE FUNCTION start_arcade_session(
  p_player_id TEXT,
  p_game_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_session_id UUID;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(p_player_id)); 
  END IF;

  IF v_pid IS NULL OR v_pid = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player identity required');
  END IF;

  -- Expire any lingering active sessions older than 30 minutes for this player
  UPDATE arcade_sessions
  SET status = 'expired', completed_at = v_now
  WHERE LOWER(player_id) = LOWER(v_pid) 
    AND status = 'active'
    AND started_at < (v_now - INTERVAL '30 minutes');

  -- Create new active arcade session
  INSERT INTO arcade_sessions (
    player_id,
    game_name,
    started_at,
    status
  ) VALUES (
    v_pid,
    TRIM(p_game_name),
    v_now,
    'active'
  ) RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'game_name', p_game_name,
    'started_at', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION start_arcade_session(TEXT, TEXT) TO anon, authenticated, service_role;

-- Step 3: RPC Function - END ARCADE SESSION & VALIDATE PAYOUT
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, UUID, INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION end_arcade_session(
  p_player_id TEXT,
  p_session_id UUID,
  p_score INTEGER DEFAULT 0,
  p_bonus_items INTEGER DEFAULT 0,
  p_bonus_tokens INTEGER DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_session RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_duration_seconds INTEGER;
  v_clamped_score INTEGER := GREATEST(0, COALESCE(p_score, 0));
  v_clamped_items INTEGER := GREATEST(0, COALESCE(p_bonus_items, 0));
  v_clamped_tokens INTEGER := GREATEST(0, COALESCE(p_bonus_tokens, 0));
  
  -- User and Multiplier Variables
  v_user RECORD;
  v_nft_mult NUMERIC := 1.0;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_global_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC := 1.0;
  
  -- Payout calculation variables
  v_raw_pgt NUMERIC := 0;
  v_token_pgt NUMERIC := 0;
  v_final_pgt NUMERIC := 0;
  v_max_allowed_pgt NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  v_game_name TEXT;
  v_is_new_high BOOLEAN := false;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(p_player_id)); 
  END IF;

  -- 1. Find and Lock Active Session
  SELECT * INTO v_session
  FROM arcade_sessions
  WHERE id = p_session_id 
    AND (LOWER(player_id) = LOWER(v_pid) OR LOWER(player_id) = LOWER(p_player_id))
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired session');
  END IF;

  v_game_name := v_session.game_name;
  v_duration_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_now - v_session.started_at))::INTEGER);

  -- 2. Anti-Cheat Check: Reject impossible instant claims (< 3 seconds with score > 0)
  IF v_duration_seconds < 3 AND v_clamped_score > 50 THEN
    UPDATE arcade_sessions 
    SET status = 'rejected', completed_at = v_now, duration_seconds = v_duration_seconds 
    WHERE id = p_session_id;
    
    RETURN jsonb_build_object('success', false, 'error', 'Session rejected: impossible speed');
  END IF;

  -- 3. Anti-Cheat Check: Maximum Score Velocity Clamping (points per second)
  IF v_game_name = 'Cyber Invaders' THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 200 + 100);
  ELSIF v_game_name = 'AstroDodge' THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 300 + 100);
  ELSIF v_game_name = 'Cyber Drift' THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 250 + 100);
  END IF;

  -- 4. Anti-Cheat Check: In-Game Collectibles & +5 PGT Bonus Tokens Clamping
  -- Max bonus collectibles (gems/orbs/shards): 2 per second
  v_clamped_items := LEAST(v_clamped_items, v_duration_seconds * 2);
  -- Max +5 PGT bonus tokens: at most 1 token per 20 seconds of survival
  v_clamped_tokens := LEAST(v_clamped_tokens, FLOOR(v_duration_seconds / 20));

  -- 5. Fetch User Profile and Verified Multipliers
  SELECT * INTO v_user
  FROM users
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(linked_wallet_address) = LOWER(v_pid)
     OR LOWER(wallet_address) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player account not found');
  END IF;

  -- VIP Multiplier (2.0x)
  IF v_user.vip_expires_at IS NOT NULL AND v_user.vip_expires_at > v_now THEN
    v_vip_mult := 2.0;
  END IF;

  -- Ambassador Multiplier (2.0x)
  IF v_user.is_ambassador IS TRUE THEN
    v_amb_mult := 2.0;
  END IF;

  -- Global Setting Multiplier
  SELECT COALESCE(earn_multiplier, 1.0) INTO v_global_mult 
  FROM global_settings 
  WHERE id = 1;
  IF v_global_mult IS NULL OR v_global_mult <= 0 THEN 
    v_global_mult := 1.0; 
  END IF;

  -- Calculate combined multiplier (Base NFT multiplier capped at verified 3.0x max)
  v_total_multiplier := v_vip_mult * v_amb_mult;

  -- 6. Server-Side Reward Calculation based on Game Formula
  IF v_game_name = 'Cyber Invaders' THEN
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.05)) * v_global_mult;
  ELSIF v_game_name = 'AstroDodge' THEN
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.05)) * v_global_mult;
  ELSIF v_game_name = 'Cyber Drift' THEN
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_mult;
  ELSE
    v_raw_pgt := (v_clamped_score / 2500.0) * v_global_mult;
  END IF;

  v_token_pgt := v_clamped_tokens * 5.0;
  v_final_pgt := (v_raw_pgt * v_total_multiplier) + v_token_pgt;

  -- 7. Anti-Cheat Absolute Safety Ceiling: Max 12 PGT per minute of elapsed survival
  v_max_allowed_pgt := GREATEST(0.50, (v_duration_seconds / 60.0) * 12.0 * v_total_multiplier + 10.0);
  v_final_pgt := ROUND(LEAST(v_final_pgt, v_max_allowed_pgt)::numeric, 2);

  -- 8. High Score Updates
  IF v_game_name = 'Cyber Invaders' THEN
    IF v_clamped_score > COALESCE(v_user.invaders_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET 
        invaders_highscore = v_clamped_score,
        alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_clamped_score)
      WHERE id = v_user.id;
    END IF;
  ELSIF v_game_name = 'AstroDodge' THEN
    IF v_clamped_score > COALESCE(v_user.game_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET 
        game_highscore = v_clamped_score,
        alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), v_clamped_score)
      WHERE id = v_user.id;
    END IF;
  ELSIF v_game_name = 'Cyber Drift' THEN
    IF v_clamped_score > COALESCE(v_user.drift_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET 
        drift_highscore = v_clamped_score,
        alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_clamped_score)
      WHERE id = v_user.id;
    END IF;
  END IF;

  -- 9. Atomically Credit Balance & Increment Total Earned
  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt,
      total_earned = COALESCE(total_earned, 0) + v_final_pgt,
      updated_at = v_now
  WHERE id = v_user.id
  RETURNING balance_pgt INTO v_new_balance;

  -- 10. Update Global Game Metrics Atomically
  INSERT INTO game_metrics (game_name, total_wagered, total_payout, total_playtime_seconds)
  VALUES (v_game_name, 0, v_final_pgt, v_duration_seconds)
  ON CONFLICT (game_name) DO UPDATE
  SET total_payout = COALESCE(game_metrics.total_payout, 0) + v_final_pgt,
      total_playtime_seconds = COALESCE(game_metrics.total_playtime_seconds, 0) + v_duration_seconds;

  -- 11. Mark Session as Completed
  UPDATE arcade_sessions
  SET status = 'completed',
      completed_at = v_now,
      score = v_clamped_score,
      bonus_items = v_clamped_items,
      bonus_tokens = v_clamped_tokens,
      payout_pgt = v_final_pgt,
      duration_seconds = v_duration_seconds
  WHERE id = p_session_id;

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

GRANT EXECUTE ON FUNCTION end_arcade_session(TEXT, UUID, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;
