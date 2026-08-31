-- ==============================================================================
-- POLYGAME: RECOVER SCORES & EXECUTE WEEKLY GAMING PAYOUT
-- ==============================================================================
-- Run this script in the Supabase SQL Editor to:
-- 1. Restore all players' weekly scores from their completed arcade sessions / career bests
-- 2. Execute the official weekly prize payout & archive standings to weekly_leaderboard_history
-- ==============================================================================

-- Step 1: Ensure archive columns exist
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS stacker_score INTEGER DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS skeet_score INTEGER DEFAULT 0;

-- Step 2: Restore weekly high scores from completed sessions in the past 7 days (or all-time bests)
UPDATE public.users u
SET 
  game_highscore = GREATEST(
    COALESCE((
      SELECT MAX(score) FROM arcade_sessions s 
      WHERE s.player_id = u.player_id 
        AND (LOWER(s.game_name) LIKE '%astro%' OR LOWER(s.game_name) = 'astrododge')
        AND s.status = 'completed'
        AND s.completed_at >= (NOW() - INTERVAL '7 days')
    ), 0),
    COALESCE(u.alltime_game_highscore, 0)
  ),
  
  invaders_highscore = GREATEST(
    COALESCE((
      SELECT MAX(score) FROM arcade_sessions s 
      WHERE s.player_id = u.player_id 
        AND LOWER(s.game_name) LIKE '%invader%'
        AND s.status = 'completed'
        AND s.completed_at >= (NOW() - INTERVAL '7 days')
    ), 0),
    COALESCE(u.alltime_invaders_highscore, 0)
  ),
  
  drift_highscore = GREATEST(
    COALESCE((
      SELECT MAX(score) FROM arcade_sessions s 
      WHERE s.player_id = u.player_id 
        AND LOWER(s.game_name) LIKE '%drift%'
        AND s.status = 'completed'
        AND s.completed_at >= (NOW() - INTERVAL '7 days')
    ), 0),
    COALESCE(u.alltime_drift_highscore, 0)
  ),
  
  stacker_highscore = GREATEST(
    COALESCE((
      SELECT MAX(score) FROM arcade_sessions s 
      WHERE s.player_id = u.player_id 
        AND (LOWER(s.game_name) LIKE '%stacker%' OR LOWER(s.game_name) LIKE '%catcher%')
        AND s.status = 'completed'
        AND s.completed_at >= (NOW() - INTERVAL '7 days')
    ), 0),
    COALESCE(u.alltime_stacker_highscore, 0)
  ),
  
  skeet_highscore = GREATEST(
    COALESCE((
      SELECT MAX(score) FROM arcade_sessions s 
      WHERE s.player_id = u.player_id 
        AND LOWER(s.game_name) LIKE '%skeet%'
        AND s.status = 'completed'
        AND s.completed_at >= (NOW() - INTERVAL '7 days')
    ), 0),
    COALESCE(u.alltime_skeet_highscore, 0)
  );

-- Step 3: Run the official payout & archive procedure
SELECT public.execute_weekly_payout_and_reset();
