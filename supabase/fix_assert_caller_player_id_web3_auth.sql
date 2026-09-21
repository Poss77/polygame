-- ==============================================================================
-- Migration: fix_assert_caller_player_id_web3_auth.sql
-- Description: Updates public.assert_caller_player_id to restore arcade gaming,
--              minigame, faucet, and staking access for Web3 EVM wallet and guest
--              players connecting via anon PostgREST client, while maintaining
--              strict anti-framing protection for Google Auth (Supabase Auth) users.
-- ==============================================================================

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
  v_target_is_banned BOOLEAN;
BEGIN
  -- 1. Service role or internal server execution without JWT:
  IF v_role = 'service_role' OR (v_role IS NULL AND v_auth_uid IS NULL) THEN
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

  SELECT user_id, COALESCE(is_banned, false)
  INTO v_target_auth_uid, v_target_is_banned
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

  -- Prevent unauthenticated anon callers from acting on Google OAuth accounts
  IF v_target_auth_uid IS NOT NULL THEN
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
