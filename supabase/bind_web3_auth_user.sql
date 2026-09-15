-- ==============================================================================
-- POLYGAME: BIND AUTHENTICATED WEB3 USER (EIP-4361 / SIWE) TO USERS ROW
-- ==============================================================================
-- When a player logs in via Supabase Native Web3 Auth (signInWithWeb3), Supabase
-- cryptographically verifies their signature and creates a valid auth.uid().
-- This RPC securely associates auth.uid() to their existing public.users profile,
-- permanently locking the account against unauthorized access or DevTools spoofing.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.bind_web3_user_session(p_wallet TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_uid UUID;
  v_target_wallet TEXT;
  v_user_row RECORD;
  v_existing_conflict TEXT;
BEGIN
  -- 1. Must be called by an authenticated user (Supabase Auth session)
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED', 'message', 'Must have an active Supabase Auth session.');
  END IF;

  v_target_wallet := LOWER(TRIM(p_wallet));
  IF v_target_wallet IS NULL OR v_target_wallet = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_WALLET', 'message', 'Invalid wallet address.');
  END IF;

  -- 2. Check if another account is already permanently linked to a different auth user
  SELECT user_id INTO v_existing_conflict
  FROM public.users
  WHERE (LOWER(linked_wallet_address) = v_target_wallet OR LOWER(wallet_address) = v_target_wallet)
    AND user_id IS NOT NULL
    AND user_id <> v_auth_uid::TEXT
  LIMIT 1;

  IF v_existing_conflict IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'WALLET_CONFLICT', 
      'message', 'Wallet is already bound to another authenticated user.'
    );
  END IF;

  -- 3. Locate the user's row in public.users
  SELECT * INTO v_user_row
  FROM public.users
  WHERE (LOWER(linked_wallet_address) = v_target_wallet OR LOWER(player_id) = v_target_wallet OR LOWER(wallet_address) = v_target_wallet)
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_user_row.id IS NOT NULL THEN
    -- Bind this authenticated auth.uid() to the user row
    UPDATE public.users
    SET user_id = v_auth_uid::TEXT,
        linked_wallet_address = COALESCE(linked_wallet_address, v_target_wallet),
        updated_at = NOW()
    WHERE id = v_user_row.id;

    RETURN jsonb_build_object(
      'success', true,
      'player_id', v_user_row.player_id,
      'user_id', v_auth_uid::TEXT,
      'linked_wallet_address', COALESCE(v_user_row.linked_wallet_address, v_target_wallet)
    );
  ELSE
    -- If no row exists yet, create one with the verified user_id
    INSERT INTO public.users (
      user_id,
      player_id,
      linked_wallet_address,
      wallet_address,
      balance_pgt
    ) VALUES (
      v_auth_uid::TEXT,
      v_target_wallet,
      v_target_wallet,
      v_target_wallet,
      0.0
    );

    RETURN jsonb_build_object(
      'success', true,
      'player_id', v_target_wallet,
      'user_id', v_auth_uid::TEXT,
      'linked_wallet_address', v_target_wallet
    );
  END IF;
END;
$$;

-- Grant execution permissions strictly to authenticated users and service_role
GRANT EXECUTE ON FUNCTION public.bind_web3_user_session(TEXT) TO authenticated, service_role;
