-- ============================================================
-- POLYGAME: ALL-TIME CAREER BEST SCORE SCHEMA & MIGRATION
-- ============================================================

-- 1. Add All-Time High Score columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS alltime_game_highscore INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alltime_invaders_highscore INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alltime_drift_highscore INTEGER DEFAULT 0;

-- 2. Backfill existing high scores into alltime_ columns
UPDATE users SET
  alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), COALESCE(game_highscore, 0)),
  alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0)),
  alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0));

-- 3. Update submit_game_highscore RPC to update both weekly and all-time high scores
CREATE OR REPLACE FUNCTION submit_game_highscore(
  p_wallet_address TEXT,
  p_game_type TEXT,
  p_score INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_is_new_weekly BOOLEAN := FALSE;
  v_is_new_alltime BOOLEAN := FALSE;
BEGIN
  p_wallet_address := LOWER(TRIM(p_wallet_address));

  IF p_game_type = 'invaders' THEN
    UPDATE users SET
      invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), p_score),
      alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0), p_score)
    WHERE LOWER(wallet_address) = p_wallet_address;
  ELSIF p_game_type = 'drift' THEN
    UPDATE users SET
      drift_highscore = GREATEST(COALESCE(drift_highscore, 0), p_score),
      alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0), p_score)
    WHERE LOWER(wallet_address) = p_wallet_address;
  ELSE
    -- Default astrododge
    UPDATE users SET
      game_highscore = GREATEST(COALESCE(game_highscore, 0), p_score),
      alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), COALESCE(game_highscore, 0), p_score)
    WHERE LOWER(wallet_address) = p_wallet_address;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
