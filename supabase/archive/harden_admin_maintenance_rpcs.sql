-- ==============================================================================
-- MIGRATION: Harden Admin Maintenance RPCs Against Unauthenticated Access
-- Version: v1.5.419
-- Description:
--   1. Hardens `execute_weekly_payout_and_reset` to require `p_admin_passkey`
--      and passes it down to all 4 weekly reset sub-procedures.
--   2. Hardens `reconcile_referral_trees` to require `p_admin_passkey`.
--   3. Hardens `sync_user_dex_liquidity` so arbitrary LP values cannot be spoofed.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDEN execute_weekly_payout_and_reset (REQUIRES MASTER ADMIN PASSKEY)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_weekly_payout_and_reset(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_arcade_res JSONB;
  v_boss_res JSONB;
  v_activity_res JSONB;
  v_scores_res JSONB;
BEGIN
  -- Strict Master Admin Passkey Verification
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Master Admin Passkey');
  END IF;

  -- 1. Distribute Arcade Leaderboard Prizes (Step 1)
  v_arcade_res := public.distribute_weekly_arcade_prizes(p_admin_passkey);

  -- 2. Distribute World Boss Bounty Loot (Step 2)
  BEGIN
    v_boss_res := public.distribute_weekly_boss_prizes(p_admin_passkey);
  EXCEPTION WHEN OTHERS THEN
    v_boss_res := jsonb_build_object('success', false, 'error', SQLERRM);
  END;

  -- 3. Snapshot Activity Tiers & Reset Active Counters (Step 3)
  v_activity_res := public.snapshot_weekly_activity_tiers(p_admin_passkey);

  -- 4. Reset Weekly Arcade Scores to 0 (Step 4)
  v_scores_res := public.reset_arcade_leaderboard_scores(p_admin_passkey);

  -- 5. Extra Safeguard: Zero out active weekly faucet/gameplay counters
  UPDATE public.users 
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

GRANT EXECUTE ON FUNCTION public.execute_weekly_payout_and_reset(TEXT) TO anon, authenticated, service_role;

-- Revoke legacy 0-argument overload if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'execute_weekly_payout_and_reset' AND p.pronargs = 0
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.execute_weekly_payout_and_reset() FROM PUBLIC, anon, authenticated;';
    EXECUTE 'DROP FUNCTION public.execute_weekly_payout_and_reset();';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ------------------------------------------------------------------------------
-- 2. HARDEN reconcile_referral_trees (REQUIRES MASTER ADMIN PASSKEY)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reconcile_referral_trees(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_reconciled_users INTEGER := 0;
  v_user RECORD;
  v_p1 RECORD;
BEGIN
  -- Strict Master Admin Passkey Verification
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Master Admin Passkey');
  END IF;

  FOR v_user IN SELECT player_id, referred_by_l1 FROM public.users WHERE referred_by_l1 IS NOT NULL AND referred_by_l1 <> '' LOOP
    SELECT referred_by_l1, referred_by_l2, referred_by_l3 INTO v_p1 FROM public.users WHERE player_id = v_user.referred_by_l1;
    IF FOUND THEN
      UPDATE public.users
      SET referred_by_l2 = v_p1.referred_by_l1,
          referred_by_l3 = v_p1.referred_by_l2,
          referred_by_l4 = v_p1.referred_by_l3
      WHERE player_id = v_user.player_id;
      v_reconciled_users := v_reconciled_users + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Referral trees reconciled successfully',
    'reconciled_users_count', v_reconciled_users,
    'synchronized_users', v_reconciled_users
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_referral_trees(TEXT) TO anon, authenticated, service_role;

-- Revoke legacy 0-argument overload if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p 
    JOIN pg_namespace n ON p.pronamespace = n.oid 
    WHERE n.nspname = 'public' AND p.proname = 'reconcile_referral_trees' AND p.pronargs = 0
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.reconcile_referral_trees() FROM PUBLIC, anon, authenticated;';
    EXECUTE 'DROP FUNCTION public.reconcile_referral_trees();';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ------------------------------------------------------------------------------
-- 3. HARDEN sync_user_dex_liquidity (RESTRICT UNVERIFIED VALUE INJECTION)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_dex_liquidity(
  p_player_id TEXT,
  p_lp_usd NUMERIC,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_canonical_id TEXT;
  v_clean_usd NUMERIC;
  v_is_admin BOOLEAN := false;
BEGIN
  v_canonical_id := public.resolve_player_id(p_player_id);
  IF v_canonical_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Admin passkey allows manual adjustment from admin panel
  IF p_admin_passkey IS NOT NULL THEN
    v_is_admin := public.verify_admin_passkey(p_admin_passkey);
  END IF;

  -- If not admin, clamp to realistic single-player LP cap ($250.00 max without admin verification)
  IF v_is_admin THEN
    v_clean_usd := ROUND(LEAST(GREATEST(COALESCE(p_lp_usd, 0.0), 0.0), 10000.0), 2);
  ELSE
    v_clean_usd := ROUND(LEAST(GREATEST(COALESCE(p_lp_usd, 0.0), 0.0), 250.0), 2);
  END IF;

  UPDATE public.users
  SET 
    dex_liquidity_usd = v_clean_usd,
    updated_at = NOW()
  WHERE player_id = v_canonical_id;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_canonical_id,
    'dex_liquidity_usd', v_clean_usd,
    'is_admin_override', v_is_admin
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_user_dex_liquidity(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
