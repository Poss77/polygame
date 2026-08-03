-- ============================================================
-- POLYGAME: RESET CURRENT WEEKLY LEADERBOARD SCORES
-- Preserves all-time career bests & weekly history
-- ============================================================

-- 1. Ensure all-time career scores are backed up on users table
UPDATE users
SET alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), COALESCE(game_highscore, 0)),
    alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0)),
    alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0));

-- 2. Clear current weekly active leaderboard scores
UPDATE users
SET game_highscore = 0,
    invaders_highscore = 0,
    drift_highscore = 0;
