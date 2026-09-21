-- ==============================================================================
-- POLYGON GAMING MIGRATION: FIX HYBRID AUTH & RESTORE POLYSPACE RPC PERMISSIONS
-- ==============================================================================
-- Target: Supabase SQL Editor
-- Purpose:
-- 1. Fix public.assert_caller_player_id to allow hybrid accounts (users with both
--    Google Auth and a linked Web3 wallet) to play games, claim faucets, and run
--    fleet operations when connected via their Web3 wallet (anon PostgREST role).
--    Only pure Google accounts (with no linked wallet) are prompted to sign in with Google.
-- 2. Explicitly GRANT EXECUTE on claim_polyspace_expedition, upgrade_polyspace_module,
--    smelt_space_ore, scan_polyspace_anomaly, and arcade sessions to anon, authenticated,
--    and service_role so Web3 wallet and guest players are never blocked.
-- ==============================================================================

-- 1. Hardened assert_caller_player_id with Hybrid Account Compatibility
DROP FUNCTION IF EXISTS public.assert_caller_player_id(TEXT);
DROP FUNCTION IF EXISTS assert_caller_player_id(TEXT);

CREATE OR REPLACE FUNCTION public.assert_caller_player_id(
  p_target_id TEXT,
  OUT p_status TEXT,       -- 'OK', 'UNAUTHENTICATED', 'PROFILE_NOT_FOUND', 'MISMATCH', 'ACCOUNT_BANNED'
  OUT p_player_id TEXT,    -- The verified player_id of the caller
  OUT p_error_msg TEXT     -- User-facing error message
)
RETURNS RECORD
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role TEXT := auth.role();
  v_auth_uid UUID := auth.uid();
  v_caller_pid TEXT;
  v_resolved_target TEXT;
  v_target_auth_uid UUID;
  v_target_wallet TEXT;
  v_target_is_banned BOOLEAN;
BEGIN
  -- 1. Service role or internal server execution without JWT:
  IF v_role = 'service_role' OR (v_role IS NULL AND v_auth_uid IS NULL AND (p_target_id IS NULL OR TRIM(p_target_id) = '')) THEN
    p_status := 'OK';
    p_player_id := public.resolve_player_id(p_target_id);
    p_error_msg := NULL;
    RETURN;
  END IF;

  -- 2. Authenticated user with active Supabase Auth session (Google OAuth):
  IF v_auth_uid IS NOT NULL THEN
    SELECT player_id INTO v_caller_pid
    FROM public.users
    WHERE user_id = v_auth_uid
    LIMIT 1;

    IF v_caller_pid IS NULL THEN
      p_status := 'PROFILE_NOT_FOUND';
      p_player_id := NULL;
      p_error_msg := 'PROFILE_NOT_FOUND: User profile does not exist for this session.';
      RETURN;
    END IF;

    -- Anti-Framing Assertion:
    -- If target ID was passed by client, it MUST resolve to the caller's own player_id.
    IF p_target_id IS NOT NULL AND TRIM(p_target_id) <> '' THEN
      v_resolved_target := public.resolve_player_id(p_target_id);
      IF v_resolved_target IS NOT NULL AND LOWER(v_resolved_target) <> LOWER(v_caller_pid) THEN
        -- Framing / impersonation attempt:
        PERFORM public.record_bot_warning(
          v_caller_pid,
          'identity_impersonation_attempt',
          'Security Sentinel',
          jsonb_build_object('attempted_target', p_target_id, 'resolved_target', v_resolved_target)
        );
        p_status := 'MISMATCH';
        p_player_id := v_caller_pid;
        p_error_msg := 'SECURITY_VIOLATION: You cannot perform actions on behalf of another player.';
        RETURN;
      END IF;
    END IF;

    p_status := 'OK';
    p_player_id := v_caller_pid;
    p_error_msg := NULL;
    RETURN;
  END IF;

  -- 3. Anonymous Web3 Wallet / Guest Caller (v_auth_uid IS NULL):
  -- For Web3 wallets and guest players accessing via anon PostgREST key,
  -- p_target_id must be provided and resolve to a valid, unbanned account.
  IF p_target_id IS NULL OR TRIM(p_target_id) = '' THEN
    p_status := 'UNAUTHENTICATED';
    p_player_id := NULL;
    p_error_msg := 'AUTHENTICATION_REQUIRED: Please sign in with Google or connect your wallet.';
    RETURN;
  END IF;

  v_resolved_target := public.resolve_player_id(p_target_id);

  IF v_resolved_target IS NULL THEN
    p_status := 'PROFILE_NOT_FOUND';
    p_player_id := NULL;
    p_error_msg := 'PROFILE_NOT_FOUND: User profile does not exist.';
    RETURN;
  END IF;

  SELECT user_id, linked_wallet_address, COALESCE(is_banned, false)
  INTO v_target_auth_uid, v_target_wallet, v_target_is_banned
  FROM public.users
  WHERE player_id = v_resolved_target
  LIMIT 1;

  IF NOT FOUND THEN
    p_status := 'PROFILE_NOT_FOUND';
    p_player_id := NULL;
    p_error_msg := 'PROFILE_NOT_FOUND: User profile does not exist.';
    RETURN;
  END IF;

  IF v_target_is_banned THEN
    p_status := 'ACCOUNT_BANNED';
    p_player_id := v_resolved_target;
    p_error_msg := 'SECURITY_VIOLATION: Account is suspended.';
    RETURN;
  END IF;

  -- Prevent unauthenticated anon callers from acting on pure Google OAuth accounts (accounts without a linked Web3 wallet)
  -- Hybrid accounts with a linked Web3 wallet are legitimately accessible via wallet connection.
  IF v_target_auth_uid IS NOT NULL AND (v_target_wallet IS NULL OR TRIM(v_target_wallet) = '') THEN
    p_status := 'UNAUTHENTICATED';
    p_player_id := NULL;
    p_error_msg := 'AUTHENTICATION_REQUIRED: This account is linked to Google Auth. Please sign in with Google to continue.';
    RETURN;
  END IF;

  p_status := 'OK';
  p_player_id := v_resolved_target;
  p_error_msg := NULL;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_caller_player_id(TEXT) TO authenticated, service_role, anon;

-- 2. PolySpace RPC Permissions: Ensure Web3 and Guest callers can execute
GRANT EXECUTE ON FUNCTION public.claim_polyspace_expedition(TEXT, TEXT) TO authenticated, service_role, anon;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'claim_polyspace_expedition' AND pronargs = 1
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.claim_polyspace_expedition(TEXT) TO authenticated, service_role, anon;';
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.cancel_polyspace_expeditions(TEXT, TEXT) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.upgrade_polyspace_module(TEXT, TEXT) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.smelt_space_ore(TEXT, TEXT) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.scan_polyspace_anomaly(TEXT) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.poke_allied_outpost(TEXT) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.launch_outpost_raid(TEXT) TO authenticated, service_role, anon;

-- 3. Arcade Session RPC Permissions: Ensure Web3 and Guest callers can execute
GRANT EXECUTE ON FUNCTION public.start_arcade_session(TEXT, TEXT, TEXT) TO authenticated, service_role, anon;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'end_arcade_session' AND pronargs = 7
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC) TO authenticated, service_role, anon;';
  END IF;
END $$;
