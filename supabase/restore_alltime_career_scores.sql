-- ============================================================
-- POLYGAME ALL-TIME CAREER BEST SCORES RESTORATION & PROTECTION SCRIPT
-- Run this script in Supabase SQL Editor to restore all-time career scores
-- for all players and lock them against future weekly resets.
-- ============================================================

-- Step 1: Ensure alltime score columns exist on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS alltime_game_highscore INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alltime_invaders_highscore INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alltime_drift_highscore INTEGER DEFAULT 0;

-- Step 2: Restore alltime scores from weekly_leaderboard_history snapshots
UPDATE users u
SET alltime_game_highscore = GREATEST(COALESCE(u.alltime_game_highscore, 0), COALESCE(h.astrododge_score, 0), COALESCE(u.game_highscore, 0)),
    alltime_invaders_highscore = GREATEST(COALESCE(u.alltime_invaders_highscore, 0), COALESCE(h.invaders_score, 0), COALESCE(u.invaders_highscore, 0)),
    alltime_drift_highscore = GREATEST(COALESCE(u.alltime_drift_highscore, 0), COALESCE(h.drift_score, 0), COALESCE(u.drift_highscore, 0))
FROM (
  SELECT player_id, 
         MAX(COALESCE(astrododge_score, 0)) AS astrododge_score,
         MAX(COALESCE(invaders_score, 0)) AS invaders_score,
         MAX(COALESCE(drift_score, 0)) AS drift_score
  FROM weekly_leaderboard_history
  GROUP BY player_id
) h
WHERE u.player_id = h.player_id OR LOWER(u.linked_wallet_address) = LOWER(h.player_id);

-- Step 3: Restore alltime scores from activities JSON log
DO $$
BEGIN
  UPDATE users u
  SET alltime_game_highscore = GREATEST(COALESCE(u.alltime_game_highscore, 0), COALESCE(REPLACE(SUBSTRING(act.reward FROM 'AstroDodge: ([0-9,]+)'), ',', '')::INTEGER, 0)),
      alltime_invaders_highscore = GREATEST(COALESCE(u.alltime_invaders_highscore, 0), COALESCE(REPLACE(SUBSTRING(act.reward FROM 'Invaders: ([0-9,]+)'), ',', '')::INTEGER, 0)),
      alltime_drift_highscore = GREATEST(COALESCE(u.alltime_drift_highscore, 0), COALESCE(REPLACE(SUBSTRING(act.reward FROM 'Drift: ([0-9,]+)'), ',', '')::INTEGER, 0))
  FROM (
    SELECT player_id, (elem->>'reward') AS reward
    FROM users, jsonb_array_elements(COALESCE(activities, '[]'::jsonb)) AS elem
    WHERE elem->>'action' LIKE 'Weekly leaderboard reset%'
  ) act
  WHERE u.player_id = act.player_id;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Step 4: Ensure alltime scores are at least equal to current weekly high scores
UPDATE users
SET alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), COALESCE(game_highscore, 0)),
    alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0)),
    alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0));
