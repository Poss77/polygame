-- ==============================================================================
-- POLYGAME: RECOMPUTE LAST WEEKLY ACTIVE TIERS FROM ACTIVITY LOGS & SESSIONS
-- ==============================================================================
-- Run this in Supabase SQL Editor to retroactively restore all players' 
-- official active status (last_weekly_active_tier) based on their verified 
-- gameplay sessions and faucet claims over the past 7 days.
-- ==============================================================================

-- 1. Ensure compute_weekly_active_tier accepts BIGINT/INT arguments
CREATE OR REPLACE FUNCTION public.compute_weekly_active_tier(p_faucets BIGINT, p_games BIGINT)
RETURNS INT 
LANGUAGE plpgsql 
IMMUTABLE 
AS 
DECLARE
  v_f BIGINT := GREATEST(0, COALESCE(p_faucets, 0));
  v_g BIGINT := GREATEST(0, COALESCE(p_games, 0));
BEGIN
  IF v_f >= 6 AND v_g >= 50 THEN
    RETURN 5; -- 👑 Level 5: Apex Legend
  ELSIF v_f >= 5 AND v_g >= 25 THEN
    RETURN 4; -- 💎 Level 4: Elite Champion
  ELSIF v_f >= 3 AND v_g >= 5 THEN
    RETURN 3; -- 🥇 Level 3: Veteran
  ELSIF v_f >= 2 AND v_g >= 1 THEN
    RETURN 2; -- 🥈 Level 2: Contender
  ELSIF v_f >= 1 THEN
    RETURN 1; -- 🥉 Level 1: Scout
  ELSE
    RETURN 0; -- ⚪ Level 0: Dormant
  END IF;
END;
;
GRANT EXECUTE ON FUNCTION public.compute_weekly_active_tier(BIGINT, BIGINT) TO anon, authenticated, service_role;

-- 2. Retroactively update all players' official active status
UPDATE public.users u
SET last_weekly_active_tier = public.compute_weekly_active_tier(
  -- 1. Faucet claims from recent streak or activity logs
  (GREATEST(
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
  ))::bigint,
  -- 2. Exact games played count from verified arcade sessions in the past 7 days
  (COALESCE((
    SELECT COUNT(*) 
    FROM arcade_sessions s 
    WHERE s.player_id = u.player_id 
      AND s.status = 'completed'
      AND s.completed_at >= (NOW() - INTERVAL '7 days')
  ), 0))::bigint
);
