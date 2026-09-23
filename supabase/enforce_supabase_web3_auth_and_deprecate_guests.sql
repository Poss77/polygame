-- ==============================================================================
-- Migration: Enforce Supabase Web3 Auth & Deprecate Unauthenticated Guest Accounts
-- Version: v1.5.455
-- Description:
--   1. Revokes direct INSERT/UPDATE privileges on public.users from anon/public.
--   2. Enforces that all user database records MUST have an active Supabase Auth session
--      (Google OAuth or Supabase Native Web3 Auth via EIP-4361).
--   3. Restricts RLS policies on public.users to auth.uid() = user_id.
--   4. Grants execute on bind_web3_user_session to authenticated and service_role.
-- ==============================================================================

-- 1. Ensure Absolute Schema Invariants
ALTER TABLE public.users DROP COLUMN IF EXISTS wallet_address;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS linked_wallet_address TEXT;
CREATE INDEX IF NOT EXISTS idx_users_linked_wallet ON public.users (LOWER(linked_wallet_address));
CREATE INDEX IF NOT EXISTS idx_users_user_id ON public.users (user_id);

-- 2. Revoke Anon / Public Write Privileges on public.users
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.users FROM anon, public;
GRANT SELECT ON TABLE public.users TO anon, authenticated, service_role;
GRANT INSERT, UPDATE ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role, postgres;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 3. Replace RLS Policies to Enforce Authenticated-Only User Management
DROP POLICY IF EXISTS "Allow public read users" ON public.users;
CREATE POLICY "Allow public read users" ON public.users 
  FOR SELECT TO anon, authenticated, service_role 
  USING (true);

DROP POLICY IF EXISTS "Allow public insert users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated insert users" ON public.users;
CREATE POLICY "Allow authenticated insert users" ON public.users 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Allow public update users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated update users" ON public.users;
CREATE POLICY "Allow authenticated update users" ON public.users 
  FOR UPDATE TO authenticated 
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid()) 
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- 4. Stored Procedure: bind_web3_user_session
-- Binds the authenticated EIP-4361 Web3 session (auth.uid()) to the player's database record.
DROP FUNCTION IF EXISTS public.bind_web3_user_session(TEXT);
DROP FUNCTION IF EXISTS bind_web3_user_session(TEXT);

CREATE OR REPLACE FUNCTION public.bind_web3_user_session(p_wallet TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_uid UUID;
  v_target_wallet TEXT;
  v_user_row RECORD;
  v_placeholder_row RECORD;
  v_existing_conflict UUID;
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
  WHERE LOWER(linked_wallet_address) = v_target_wallet
    AND user_id IS NOT NULL
    AND user_id <> v_auth_uid
  LIMIT 1;

  IF v_existing_conflict IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'WALLET_CONFLICT', 
      'message', 'Wallet is already bound to another authenticated user.'
    );
  END IF;

  -- 3. Check if a dummy placeholder row was created for this auth.uid()
  SELECT * INTO v_placeholder_row
  FROM public.users
  WHERE user_id = v_auth_uid
  ORDER BY created_at DESC
  LIMIT 1;

  -- 4. Locate the user's real row in public.users
  SELECT * INTO v_user_row
  FROM public.users
  WHERE (LOWER(linked_wallet_address) = v_target_wallet OR LOWER(player_id) = v_target_wallet)
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_user_row.player_id IS NOT NULL THEN
    -- Delete empty placeholder if a separate one was auto-created during auth event
    IF v_placeholder_row.player_id IS NOT NULL AND v_placeholder_row.player_id <> v_user_row.player_id THEN
      DELETE FROM public.users WHERE player_id = v_placeholder_row.player_id;
    END IF;

    -- Bind this authenticated auth.uid() to the real user row
    UPDATE public.users
    SET user_id = v_auth_uid,
        linked_wallet_address = COALESCE(linked_wallet_address, v_target_wallet),
        updated_at = NOW()
    WHERE player_id = v_user_row.player_id;

    RETURN jsonb_build_object(
      'success', true,
      'player_id', v_user_row.player_id,
      'user_id', v_auth_uid::TEXT,
      'linked_wallet_address', COALESCE(v_user_row.linked_wallet_address, v_target_wallet)
    );
  ELSE
    IF v_placeholder_row.player_id IS NOT NULL THEN
      UPDATE public.users
      SET linked_wallet_address = v_target_wallet,
          updated_at = NOW()
      WHERE player_id = v_placeholder_row.player_id;

      RETURN jsonb_build_object(
        'success', true,
        'player_id', v_placeholder_row.player_id,
        'user_id', v_auth_uid::TEXT,
        'linked_wallet_address', v_target_wallet
      );
    ELSE
      -- If no row exists yet, create one with the verified user_id
      INSERT INTO public.users (
        user_id,
        player_id,
        linked_wallet_address,
        balance_pgt
      ) VALUES (
        v_auth_uid,
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
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bind_web3_user_session(TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.bind_web3_user_session IS 'Securely binds authenticated Supabase Web3 session (auth.uid()) to public.users row';
