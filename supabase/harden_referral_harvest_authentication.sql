-- ==============================================================================
-- Migration: harden_referral_harvest_authentication.sql
-- Version: v1.5.458
-- Description:
--   1. Hardens public.harvest_referral_rewards:
--      - Enforces that caller must be authenticated (authenticated role or service_role).
--      - Explicitly revokes execution from anon and public.
--      - Raises descriptive exception if assert_caller_player_id fails (account mismatch or banned).
--      - Atomically claims users.unclaimed_referral_pgt into balance_pgt and resets unclaimed pool to 0.
-- ==============================================================================

DROP FUNCTION IF EXISTS public.harvest_referral_rewards(TEXT);
DROP FUNCTION IF EXISTS harvest_referral_rewards(TEXT);

CREATE OR REPLACE FUNCTION public.harvest_referral_rewards(user_wallet TEXT) 
RETURNS NUMERIC AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  unclaimed_amt NUMERIC;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(user_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RAISE EXCEPTION '%', COALESCE(v_guard.p_error_msg, 'Authentication failed: unauthorized caller.');
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT COALESCE(unclaimed_referral_pgt, 0) INTO unclaimed_amt
  FROM public.users WHERE LOWER(player_id) = LOWER(v_pid);

  IF unclaimed_amt IS NULL OR unclaimed_amt <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.users SET
    balance_pgt = COALESCE(balance_pgt, 0) + unclaimed_amt,
    unclaimed_referral_pgt = 0
  WHERE LOWER(player_id) = LOWER(v_pid);

  RETURN unclaimed_amt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Strictly lock down execution: NO anon or public execution permitted
REVOKE ALL ON FUNCTION public.harvest_referral_rewards(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.harvest_referral_rewards(TEXT) TO authenticated, service_role;
