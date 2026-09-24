-- ==============================================================================
-- POLYGAME DATABASE MIGRATION: FIX HYBRID WEB3 & GOOGLE AUTH LINKING (v1.5.466)
-- ==============================================================================
-- Resolves the issue where hybrid accounts (created with Google OAuth, linked
-- to a MetaMask / Web3 wallet) encountered "⚠️ PROFILE_NOT_FOUND: User profile does
-- not exist for this session." when authenticating via Web3.
--
-- Core Architecture:
-- 1. Adds `web3_auth_id UUID` column and index to `public.users` to maintain
--    dual authentication identities (Google `user_id` + Web3 `web3_auth_id`).
-- 2. Upgrades `bind_web3_user_session` to recognize when a wallet is already
--    linked to an existing account (e.g. Google profile) and bind `web3_auth_id`
--    without clobbering `user_id` or throwing false WALLET_CONFLICT errors.
-- 3. Upgrades `assert_caller_player_id` to authenticate callers matching either
--    `user_id` (Google) OR `web3_auth_id` (Web3), with automatic identity recovery
--    via cryptographically verified wallet identities in JWT / auth.users.
-- 4. Upgrades `get_caller_player_id` and Row-Level Security (RLS) policies on
--    `public.users` to permit updates for both `user_id` and `web3_auth_id`.
-- 5. Automatically binds existing linked wallets to their Web3 auth records.
-- ==============================================================================

-- 1. ADD COLUMN web3_auth_id TO public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS web3_auth_id UUID;
CREATE INDEX IF NOT EXISTS idx_users_web3_auth_id ON public.users(web3_auth_id) WHERE web3_auth_id IS NOT NULL;

-- 2. UPDATE RLS POLICIES FOR public.users (ZERO ANON WRITES INVARIANT PRESERVED)
DROP POLICY IF EXISTS "Allow authenticated insert users" ON public.users;
CREATE POLICY "Allow authenticated insert users" ON public.users 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR web3_auth_id = auth.uid()));

DROP POLICY IF EXISTS "Allow authenticated update users" ON public.users;
CREATE POLICY "Allow authenticated update users" ON public.users 
  FOR UPDATE TO authenticated 
  USING (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR web3_auth_id = auth.uid())) 
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id = auth.uid() OR web3_auth_id = auth.uid()));

-- 3. UPGRADE get_caller_player_id()
DROP FUNCTION IF EXISTS public.get_caller_player_id();
DROP FUNCTION IF EXISTS get_caller_player_id();

CREATE OR REPLACE FUNCTION public.get_caller_player_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_pid TEXT;
BEGIN
  IF v_auth_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT player_id INTO v_pid
  FROM public.users
  WHERE user_id = v_auth_uid OR web3_auth_id = v_auth_uid
  LIMIT 1;

  RETURN v_pid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_caller_player_id() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_caller_player_id() FROM anon;

-- 4. UPGRADE bind_web3_user_session(p_wallet TEXT)
DROP FUNCTION IF EXISTS public.bind_web3_user_session(TEXT);
DROP FUNCTION IF EXISTS bind_web3_user_session(TEXT);

CREATE OR REPLACE FUNCTION public.bind_web3_user_session(p_wallet TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_auth_uid UUID;
  v_target_wallet TEXT;
  v_user_row RECORD;
  v_placeholder_row RECORD;
  v_auth_wallet TEXT;
BEGIN
  -- 1. Must be called by an authenticated user (Supabase Auth session)
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED', 'message', 'Must have an active Supabase Auth session.');
  END IF;

  v_target_wallet := LOWER(TRIM(p_wallet));
  IF v_target_wallet IS NULL OR v_target_wallet !~ '^0x[a-f0-9]{40}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_WALLET', 'message', 'Invalid Web3 EVM wallet address.');
  END IF;

  -- 2. Verify caller authenticity:
  -- If JWT claims or auth.users contain an address, assert that caller owns this wallet!
  v_auth_wallet := LOWER(COALESCE(
    auth.jwt() -> 'user_metadata' ->> 'address',
    auth.jwt() -> 'user_metadata' ->> 'wallet_address',
    CASE WHEN auth.jwt() -> 'user_metadata' ->> 'sub' ~ '^0x[a-fA-F0-9]{40}$' THEN auth.jwt() -> 'user_metadata' ->> 'sub' ELSE NULL END,
    CASE WHEN auth.jwt() ->> 'email' ~ '^0x[a-fA-F0-9]{40}@' THEN SPLIT_PART(auth.jwt() ->> 'email', '@', 1) ELSE NULL END
  ));

  IF v_auth_wallet IS NULL THEN
    BEGIN
      SELECT LOWER(COALESCE(
        raw_user_meta_data ->> 'address',
        raw_user_meta_data ->> 'wallet_address',
        CASE WHEN raw_user_meta_data ->> 'sub' ~ '^0x[a-fA-F0-9]{40}$' THEN raw_user_meta_data ->> 'sub' ELSE NULL END,
        CASE WHEN email ~ '^0x[a-fA-F0-9]{40}@' THEN SPLIT_PART(email, '@', 1) ELSE NULL END
      )) INTO v_auth_wallet
      FROM auth.users
      WHERE id = v_auth_uid;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF v_auth_wallet IS NULL THEN
    BEGIN
      SELECT LOWER(COALESCE(
        identity_data ->> 'address',
        identity_data ->> 'wallet_address',
        CASE WHEN provider_id ~ '^0x[a-fA-F0-9]{40}$' THEN provider_id ELSE NULL END
      )) INTO v_auth_wallet
      FROM auth.identities
      WHERE user_id = v_auth_uid
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- If the authenticated provider explicitly identified the wallet, ensure it matches!
  IF v_auth_wallet IS NOT NULL AND v_auth_wallet <> v_target_wallet THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'UNAUTHORIZED_WALLET',
      'message', 'Authenticated wallet does not match target wallet parameter.'
    );
  END IF;

  -- 3. Check if a dummy placeholder row was created for this auth.uid()
  SELECT * INTO v_placeholder_row
  FROM public.users
  WHERE user_id = v_auth_uid OR web3_auth_id = v_auth_uid
  ORDER BY created_at DESC
  LIMIT 1;

  -- 4. Locate the user's real row in public.users
  SELECT * INTO v_user_row
  FROM public.users
  WHERE LOWER(linked_wallet_address) = v_target_wallet
     OR LOWER(player_id) = v_target_wallet
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_user_row.player_id IS NOT NULL THEN
    -- Delete empty placeholder if a separate one was auto-created during auth event
    IF v_placeholder_row.player_id IS NOT NULL AND v_placeholder_row.player_id <> v_user_row.player_id THEN
      DELETE FROM public.users WHERE player_id = v_placeholder_row.player_id;
    END IF;

    -- Bind authenticated auth.uid() to the real user row:
    -- If user_id is already set to another identity (e.g. Google OAuth UID for Fill),
    -- preserve their Google user_id and store this Web3 session in web3_auth_id!
    IF v_user_row.user_id IS NOT NULL AND v_user_row.user_id <> v_auth_uid THEN
      UPDATE public.users
      SET web3_auth_id = v_auth_uid,
          linked_wallet_address = COALESCE(linked_wallet_address, v_target_wallet),
          updated_at = NOW()
      WHERE player_id = v_user_row.player_id;
    ELSE
      -- Primary binding (pure Web3 user, or unlinked profile)
      UPDATE public.users
      SET user_id = COALESCE(user_id, v_auth_uid),
          web3_auth_id = v_auth_uid,
          linked_wallet_address = COALESCE(linked_wallet_address, v_target_wallet),
          updated_at = NOW()
      WHERE player_id = v_user_row.player_id;
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'player_id', v_user_row.player_id,
      'user_id', COALESCE(v_user_row.user_id, v_auth_uid)::TEXT,
      'web3_auth_id', v_auth_uid::TEXT,
      'linked_wallet_address', COALESCE(v_user_row.linked_wallet_address, v_target_wallet)
    );
  ELSE
    -- No profile row with this wallet found yet:
    IF v_placeholder_row.player_id IS NOT NULL THEN
      UPDATE public.users
      SET linked_wallet_address = v_target_wallet,
          web3_auth_id = v_auth_uid,
          updated_at = NOW()
      WHERE player_id = v_placeholder_row.player_id;

      RETURN jsonb_build_object(
        'success', true,
        'player_id', v_placeholder_row.player_id,
        'user_id', v_auth_uid::TEXT,
        'web3_auth_id', v_auth_uid::TEXT,
        'linked_wallet_address', v_target_wallet
      );
    ELSE
      -- If no row exists yet, create one with the verified user_id and web3_auth_id
      INSERT INTO public.users (
        user_id,
        web3_auth_id,
        player_id,
        linked_wallet_address,
        balance_pgt
      ) VALUES (
        v_auth_uid,
        v_auth_uid,
        v_target_wallet,
        v_target_wallet,
        0.0
      );

      RETURN jsonb_build_object(
        'success', true,
        'player_id', v_target_wallet,
        'user_id', v_auth_uid::TEXT,
        'web3_auth_id', v_auth_uid::TEXT,
        'linked_wallet_address', v_target_wallet
      );
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bind_web3_user_session(TEXT) TO authenticated, service_role;

-- 5. UPGRADE assert_caller_player_id(p_target_id TEXT)
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
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_role TEXT := auth.role();
  v_auth_uid UUID := auth.uid();
  v_caller_pid TEXT;
  v_resolved_target TEXT;
  v_target_auth_uid UUID;
  v_target_web3_auth_uid UUID;
  v_target_wallet TEXT;
  v_target_is_banned BOOLEAN;
  v_caller_wallet TEXT;
BEGIN
  -- 1. Service role or internal server execution without JWT:
  IF v_role = 'service_role' OR (v_role IS NULL AND v_auth_uid IS NULL) THEN
    p_status := 'OK';
    p_player_id := public.resolve_player_id(p_target_id);
    p_error_msg := NULL;
    RETURN;
  END IF;

  -- 2. Authenticated user with active Supabase Auth session (Google OAuth or Web3 SIWE):
  IF v_auth_uid IS NOT NULL THEN
    -- Match by primary Google/Web3 user_id OR secondary web3_auth_id:
    SELECT player_id, COALESCE(is_banned, false) INTO v_caller_pid, v_target_is_banned
    FROM public.users
    WHERE user_id = v_auth_uid OR web3_auth_id = v_auth_uid
    LIMIT 1;

    -- Fallback: If not yet linked via web3_auth_id, resolve caller profile from verified wallet identity
    IF v_caller_pid IS NULL THEN
      -- A) Check JWT claims
      v_caller_wallet := LOWER(COALESCE(
        auth.jwt() -> 'user_metadata' ->> 'address',
        auth.jwt() -> 'user_metadata' ->> 'wallet_address',
        CASE WHEN auth.jwt() -> 'user_metadata' ->> 'sub' ~ '^0x[a-fA-F0-9]{40}$' THEN auth.jwt() -> 'user_metadata' ->> 'sub' ELSE NULL END,
        CASE WHEN auth.jwt() ->> 'email' ~ '^0x[a-fA-F0-9]{40}@' THEN SPLIT_PART(auth.jwt() ->> 'email', '@', 1) ELSE NULL END
      ));

      -- B) Check auth.users table
      IF v_caller_wallet IS NULL THEN
        BEGIN
          SELECT LOWER(COALESCE(
            raw_user_meta_data ->> 'address',
            raw_user_meta_data ->> 'wallet_address',
            CASE WHEN raw_user_meta_data ->> 'sub' ~ '^0x[a-fA-F0-9]{40}$' THEN raw_user_meta_data ->> 'sub' ELSE NULL END,
            CASE WHEN email ~ '^0x[a-fA-F0-9]{40}@' THEN SPLIT_PART(email, '@', 1) ELSE NULL END
          )) INTO v_caller_wallet
          FROM auth.users
          WHERE id = v_auth_uid;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;

      -- C) Check auth.identities table
      IF v_caller_wallet IS NULL THEN
        BEGIN
          SELECT LOWER(COALESCE(
            identity_data ->> 'address',
            identity_data ->> 'wallet_address',
            CASE WHEN provider_id ~ '^0x[a-fA-F0-9]{40}$' THEN provider_id ELSE NULL END
          )) INTO v_caller_wallet
          FROM auth.identities
          WHERE user_id = v_auth_uid
          LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;

      -- D) If caller wallet was verified, resolve profile and auto-heal web3_auth_id
      IF v_caller_wallet IS NOT NULL AND v_caller_wallet ~ '^0x[a-f0-9]{40}$' THEN
        SELECT player_id, COALESCE(is_banned, false) INTO v_caller_pid, v_target_is_banned
        FROM public.users
        WHERE LOWER(linked_wallet_address) = v_caller_wallet OR LOWER(player_id) = v_caller_wallet
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_caller_pid IS NOT NULL THEN
          UPDATE public.users
          SET web3_auth_id = v_auth_uid, updated_at = NOW()
          WHERE player_id = v_caller_pid AND (web3_auth_id IS NULL OR web3_auth_id <> v_auth_uid);
        END IF;
      END IF;
    END IF;

    -- Still no profile found
    IF v_caller_pid IS NULL THEN
      p_status := 'PROFILE_NOT_FOUND';
      p_player_id := NULL;
      p_error_msg := 'PROFILE_NOT_FOUND: User profile does not exist for this session.';
      RETURN;
    END IF;

    -- Enforce ban check on authenticated sessions
    IF v_target_is_banned THEN
      p_status := 'ACCOUNT_BANNED';
      p_player_id := v_caller_pid;
      p_error_msg := 'ACCOUNT_BANNED: Your account has been permanently suspended.';
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

  SELECT user_id, web3_auth_id, linked_wallet_address, COALESCE(is_banned, false)
  INTO v_target_auth_uid, v_target_web3_auth_uid, v_target_wallet, v_target_is_banned
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
  IF (v_target_auth_uid IS NOT NULL OR v_target_web3_auth_uid IS NOT NULL) AND (v_target_wallet IS NULL OR TRIM(v_target_wallet) = '') THEN
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

-- 6. RETROACTIVELY BIND EXISTING WEB3 IDENTITIES FOR LINKED ACCOUNTS (INCLUDING FILL)
DO $$
DECLARE
  r RECORD;
  v_found_uid UUID;
BEGIN
  FOR r IN 
    SELECT player_id, LOWER(linked_wallet_address) AS wallet 
    FROM public.users 
    WHERE linked_wallet_address IS NOT NULL 
      AND linked_wallet_address ~ '^0x[a-fA-F0-9]{40}$'
  LOOP
    v_found_uid := NULL;

    -- Check auth.users metadata & email
    SELECT id INTO v_found_uid
    FROM auth.users
    WHERE LOWER(COALESCE(raw_user_meta_data->>'address', raw_user_meta_data->>'wallet_address', '')) = r.wallet
       OR LOWER(email) LIKE r.wallet || '%'
    ORDER BY created_at DESC
    LIMIT 1;

    -- Check auth.identities
    IF v_found_uid IS NULL THEN
      SELECT user_id INTO v_found_uid
      FROM auth.identities
      WHERE LOWER(COALESCE(identity_data->>'address', identity_data->>'wallet_address', provider_id, '')) = r.wallet
      ORDER BY created_at DESC
      LIMIT 1;
    END IF;

    IF v_found_uid IS NOT NULL THEN
      UPDATE public.users
      SET web3_auth_id = v_found_uid,
          updated_at = NOW()
      WHERE player_id = r.player_id
        AND (web3_auth_id IS NULL OR web3_auth_id <> v_found_uid);
      RAISE NOTICE 'Bound player % (wallet %) to web3_auth_id %', r.player_id, r.wallet, v_found_uid;
    END IF;
  END LOOP;
END $$;

-- 7. CLEAN UP EMPTY ORPHAN PLACEHOLDERS (if any were created during earlier failed attempts)
DELETE FROM public.users p
USING public.users real_u
WHERE real_u.linked_wallet_address IS NOT NULL
  AND real_u.player_id <> p.player_id
  AND (p.user_id = real_u.web3_auth_id OR (p.linked_wallet_address IS NOT NULL AND LOWER(p.linked_wallet_address) = LOWER(real_u.linked_wallet_address)))
  AND COALESCE(p.balance_pgt, 0) = 0
  AND COALESCE(p.total_earned, 0) = 0
  AND COALESCE(p.game_highscore, 0) = 0;
