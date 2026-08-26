-- ==============================================================================
-- POLYGAME: CYBER SKEET ARCADE INTEGRATION & HIGH SCORE SCHEMA MIGRATION
-- Adds skeet_highscore, alltime_skeet_highscore, updates end_arcade_session,
-- submit_arcade_highscore, and execute_weekly_payout_and_reset RPCs.
-- ==============================================================================

-- 1. Add High Score Columns to Users Table & Tournament History Table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS skeet_highscore INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS alltime_skeet_highscore INTEGER DEFAULT 0;

ALTER TABLE public.weekly_leaderboard_history
ADD COLUMN IF NOT EXISTS skeet_score INTEGER DEFAULT 0;

-- 2. Update default game_payout_settings in global_settings to include skeet
UPDATE public.global_settings
SET game_payout_settings = COALESCE(game_payout_settings, '{}'::jsonb) || jsonb_build_object(
  'skeet', jsonb_build_object('weekly_pool_pgt', 25000, 'leaderboard_enabled', true)
)
WHERE id = 1 AND (game_payout_settings->'skeet') IS NULL;

-- 3. Update submit_arcade_highscore RPC
CREATE OR REPLACE FUNCTION submit_arcade_highscore(
  p_player_id TEXT,
  p_game_highscore INTEGER DEFAULT NULL,
  p_invaders_highscore INTEGER DEFAULT NULL,
  p_drift_highscore INTEGER DEFAULT NULL,
  p_stacker_highscore INTEGER DEFAULT NULL,
  p_catcher_highscore INTEGER DEFAULT NULL,
  p_skeet_highscore INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS \$\$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_stacker_val INTEGER := COALESCE(p_stacker_highscore, p_catcher_highscore);
BEGIN
  IF v_pid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  UPDATE users
  SET 
    game_highscore = GREATEST(COALESCE(game_highscore, 0), COALESCE(p_game_highscore, 0)),
    invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), COALESCE(p_invaders_highscore, 0)),
    drift_highscore = GREATEST(COALESCE(drift_highscore, 0), COALESCE(p_drift_highscore, 0)),
    stacker_highscore = GREATEST(COALESCE(stacker_highscore, 0), COALESCE(v_stacker_val, 0)),
    skeet_highscore = GREATEST(COALESCE(skeet_highscore, 0), COALESCE(p_skeet_highscore, 0)),
    alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), COALESCE(game_highscore, 0), COALESCE(p_game_highscore, 0)),
    alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0), COALESCE(p_invaders_highscore, 0)),
    alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0), COALESCE(p_drift_highscore, 0)),
    alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), COALESCE(stacker_highscore, 0), COALESCE(v_stacker_val, 0)),
    alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), COALESCE(skeet_highscore, 0), COALESCE(p_skeet_highscore, 0)),
    updated_at = NOW()
  WHERE player_id = v_pid;

  RETURN jsonb_build_object('success', true);
END;
\$\$;
GRANT EXECUTE ON FUNCTION submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;
