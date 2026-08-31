-- ==============================================================================
-- POLYGAME: RECOMPUTE LAST WEEKLY ACTIVE TIERS FROM ACTIVITY LOGS & SESSIONS
-- ==============================================================================
-- Run this in Supabase SQL Editor to retroactively restore all players' 
-- official active status (last_weekly_active_tier) based on their verified 
-- gameplay sessions and faucet claims over the past 7 days.
-- ==============================================================================

UPDATE public.users u
SET last_weekly_active_tier = compute_weekly_active_tier(
  -- Faucet claims from recent claim streak or activities array
  GREATEST(
    CASE 
      WHEN u.last_faucet_claim >= (NOW() - INTERVAL '7 days') THEN LEAST(GREATEST(COALESCE(u.faucet_streak, 1), 1), 7)
      ELSE 0 
    END,
    COALESCE((
      SELECT COUNT(*) 
      FROM jsonb_array_elements(COALESCE(u.activities, '[]'::jsonb)) AS a 
      WHERE (a->>'type' ILIKE '%faucet%' OR a->>'description' ILIKE '%faucet%')
        AND (a->>'timestamp')::timestamptz >= (NOW() - INTERVAL '7 days')
    ), 0)
  ),
  -- Exact games played count from verified arcade sessions in the past 7 days
  COALESCE((
    SELECT COUNT(*) 
    FROM arcade_sessions s 
    WHERE s.player_id = u.player_id 
      AND s.status = 'completed'
      AND s.completed_at >= (NOW() - INTERVAL '7 days')
  ), 0)
);
