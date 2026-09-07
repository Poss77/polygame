-- ==============================================================================
-- POLYGON GAMING: FIX WEEKLY RESET ACTIVITY COUNTERS (STEP 3 & STEP 4)
-- ==============================================================================
-- Ensures weekly_faucet_claims, weekly_games_played, and weekly_active_tier
-- are cleanly and reliably reset to 0 during Step 3 and Master Reset Pipeline.
-- ==============================================================================

-- 1. Canonical Step 3: Snapshot Weekly Activity Tiers (L0–L5) & Reset Active Counters
CREATE OR REPLACE FUNCTION public.snapshot_weekly_activity_tiers()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INT := 0;
BEGIN
  WITH updated AS (
    UPDATE users
    SET 
      last_weekly_active_tier = COALESCE(weekly_active_tier, 0),
      weekly_faucet_claims = 0,
      weekly_games_played = 0,
      weekly_active_tier = 0,
      updated_at = NOW()
    WHERE 
      COALESCE(weekly_faucet_claims, 0) > 0 OR 
      COALESCE(weekly_games_played, 0) > 0 OR 
      COALESCE(weekly_active_tier, 0) > 0 OR
      COALESCE(last_weekly_active_tier, 0) > 0
    RETURNING player_id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'accounts_snapshotted', v_updated_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.snapshot_weekly_activity_tiers() TO anon, authenticated, service_role;


-- 2. Step 4 Safeguard: Ensure reset_arcade_leaderboard_scores also cleans up lingering weekly counters
CREATE OR REPLACE FUNCTION public.reset_arcade_leaderboard_scores()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reset_count INT := 0;
BEGIN
  WITH updated AS (
    UPDATE users
    SET 
      alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), COALESCE(game_highscore, 0)),
      alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0)),
      alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0)),
      alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), COALESCE(stacker_highscore, 0)),
      alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), COALESCE(skeet_highscore, 0)),
      defense_alltime_best = GREATEST(COALESCE(defense_alltime_best, 0), COALESCE(defense_highscore, 0)),
      game_highscore = 0,
      invaders_highscore = 0,
      drift_highscore = 0,
      stacker_highscore = 0,
      skeet_highscore = 0,
      defense_highscore = 0,
      weekly_faucet_claims = 0,
      weekly_games_played = 0,
      weekly_active_tier = 0,
      updated_at = NOW()
    WHERE 
      COALESCE(game_highscore, 0) > 0 OR 
      COALESCE(invaders_highscore, 0) > 0 OR 
      COALESCE(drift_highscore, 0) > 0 OR 
      COALESCE(stacker_highscore, 0) > 0 OR 
      COALESCE(skeet_highscore, 0) > 0 OR
      COALESCE(defense_highscore, 0) > 0 OR
      COALESCE(weekly_faucet_claims, 0) > 0 OR
      COALESCE(weekly_games_played, 0) > 0 OR
      COALESCE(weekly_active_tier, 0) > 0
    RETURNING player_id
  )
  SELECT COUNT(*) INTO v_reset_count FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'accounts_reset', v_reset_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_arcade_leaderboard_scores() TO anon, authenticated, service_role;


-- 3. Canonical All-In-One Weekly Payout & Reset RPC
CREATE OR REPLACE FUNCTION public.execute_weekly_payout_and_reset()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_arcade_res JSONB;
  v_boss_res JSONB;
  v_activity_res JSONB;
  v_scores_res JSONB;
BEGIN
  -- 1. Distribute Arcade Leaderboard Prizes (Step 1)
  v_arcade_res := distribute_weekly_arcade_prizes();

  -- 2. Distribute World Boss Bounty Loot (Step 2)
  BEGIN
    v_boss_res := distribute_weekly_boss_prizes();
  EXCEPTION WHEN OTHERS THEN
    v_boss_res := jsonb_build_object('success', false, 'error', SQLERRM);
  END;

  -- 3. Snapshot Activity Tiers & Reset Active Counters (Step 3)
  v_activity_res := snapshot_weekly_activity_tiers();

  -- 4. Reset Weekly Arcade Scores to 0 (Step 4)
  v_scores_res := reset_arcade_leaderboard_scores();

  -- 5. Extra Safeguard: Zero out active weekly faucet/gameplay counters
  UPDATE users 
  SET weekly_faucet_claims = 0,
      weekly_games_played = 0,
      weekly_active_tier = 0
  WHERE COALESCE(weekly_faucet_claims, 0) > 0 
     OR COALESCE(weekly_games_played, 0) > 0 
     OR COALESCE(weekly_active_tier, 0) > 0;

  RETURN jsonb_build_object(
    'success', true,
    'total_distributed', COALESCE((v_arcade_res->>'total_distributed')::numeric, 0),
    'winner_count', COALESCE((v_arcade_res->>'winner_count')::int, 0),
    'games_processed', v_arcade_res->'games_processed',
    'week_label', v_arcade_res->>'week_label',
    'arcade_payout', v_arcade_res,
    'boss_payout', v_boss_res,
    'activity_snapshot', v_activity_res,
    'scores_reset', v_scores_res
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_weekly_payout_and_reset() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
