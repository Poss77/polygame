-- ==============================================================================
-- POLYGON GAMING: SYNCHRONIZE ACTIVE WEEKLY LEADERBOARDS WITH TRUE SESSIONS
-- ==============================================================================
-- Purpose:
-- Fixes resurrected scores caused by browser cache syncing prior to the patch.
-- Recalculates every player's active weekly tournament high score using ONLY
-- verified gameplay sessions completed in `arcade_sessions` since the Sept 7th reset.
--
-- Guarantees:
-- 1. All-time career records (alltime_*_highscore) are 100% PRESERVED.
-- 2. Players who have not played a game this week are set to 0 (no ghost rankings).
-- 3. Players who played this week receive their true highest score achieved this week.
-- 4. Pure query: Creates ZERO tables and leaves no temporary objects in your database.
-- ==============================================================================

BEGIN;

-- 1. Preserve any existing high scores into all-time career bests first
UPDATE public.users
SET 
  alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), COALESCE(game_highscore, 0)),
  alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0)),
  alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0)),
  alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), COALESCE(stacker_highscore, 0)),
  alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), COALESCE(skeet_highscore, 0)),
  defense_alltime_best = GREATEST(COALESCE(defense_alltime_best, 0), COALESCE(defense_highscore, 0));

-- 2. Update players who played this week with their TRUE highest session score
WITH true_weekly_scores AS (
  SELECT 
    LOWER(player_id) AS pid,
    MAX(CASE WHEN LOWER(game_name) IN ('astrododge', 'game') THEN score ELSE 0 END) AS astrododge_high,
    MAX(CASE WHEN LOWER(game_name) = 'invaders' THEN score ELSE 0 END) AS invaders_high,
    MAX(CASE WHEN LOWER(game_name) = 'drift' THEN score ELSE 0 END) AS drift_high,
    MAX(CASE WHEN LOWER(game_name) IN ('stacker', 'catcher') THEN score ELSE 0 END) AS stacker_high,
    MAX(CASE WHEN LOWER(game_name) = 'skeet' THEN score ELSE 0 END) AS skeet_high,
    MAX(CASE WHEN LOWER(game_name) = 'defense' THEN score ELSE 0 END) AS defense_high
  FROM public.arcade_sessions
  WHERE completed_at >= '2026-09-07 00:46:11+00'
    AND status = 'completed'
  GROUP BY LOWER(player_id)
)
UPDATE public.users u
SET 
  game_highscore = COALESCE(t.astrododge_high, 0),
  invaders_highscore = COALESCE(t.invaders_high, 0),
  drift_highscore = COALESCE(t.drift_high, 0),
  stacker_highscore = COALESCE(t.stacker_high, 0),
  skeet_highscore = COALESCE(t.skeet_high, 0),
  defense_highscore = COALESCE(t.defense_high, 0),
  updated_at = NOW()
FROM true_weekly_scores t
WHERE LOWER(u.player_id) = t.pid;

-- 3. For players who have not played ANY arcade games this week, zero out active tournament scores
UPDATE public.users u
SET 
  game_highscore = 0,
  invaders_highscore = 0,
  drift_highscore = 0,
  stacker_highscore = 0,
  skeet_highscore = 0,
  defense_highscore = 0,
  updated_at = NOW()
WHERE NOT EXISTS (
    SELECT 1 
    FROM public.arcade_sessions a
    WHERE LOWER(a.player_id) = LOWER(u.player_id)
      AND a.completed_at >= '2026-09-07 00:46:11+00'
      AND a.status = 'completed'
  )
  AND (
    COALESCE(game_highscore, 0) > 0 OR
    COALESCE(invaders_highscore, 0) > 0 OR
    COALESCE(drift_highscore, 0) > 0 OR
    COALESCE(stacker_highscore, 0) > 0 OR
    COALESCE(skeet_highscore, 0) > 0 OR
    COALESCE(defense_highscore, 0) > 0
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
