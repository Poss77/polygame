-- ============================================================
-- POLYGAME SOCIAL AUTH & WALLET LINKING MIGRATION SCRIPT (V3)
-- Handles Foreign Key dependencies on users(wallet_address)
-- Run this script in the Supabase SQL Editor
-- ============================================================

-- 1. Safely drop Foreign Keys referencing users(wallet_address) & Primary Key
DO $$ 
DECLARE 
  r RECORD;
  pk_name text;
BEGIN
  -- Drop any Foreign Key constraints pointing to users table
  FOR r IN (
    SELECT tc.table_name, tc.constraint_name 
    FROM information_schema.table_constraints AS tc 
    JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
    WHERE ccu.table_name = 'users' AND tc.constraint_type = 'FOREIGN KEY'
  ) LOOP
    EXECUTE 'ALTER TABLE ' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
  END LOOP;

  -- Drop Primary Key constraint on users
  SELECT constraint_name INTO pk_name
  FROM information_schema.table_constraints
  WHERE table_name = 'users' AND constraint_type = 'PRIMARY KEY';

  IF pk_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(pk_name);
  END IF;
END $$;

-- 2. Add user_id, auth_provider, email columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'wallet';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- 3. Make wallet_address nullable so social users can sign up before linking a wallet
ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL;

-- 4. Create unique constraint & indexes
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_wallet_address_unique;
ALTER TABLE users ADD CONSTRAINT users_wallet_address_unique UNIQUE (wallet_address);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_id ON users (user_id) WHERE user_id IS NOT NULL;

-- 5. Re-add Foreign Key constraint on user_stakes if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_stakes') THEN
    ALTER TABLE user_stakes 
      ADD CONSTRAINT user_stakes_wallet_address_fkey 
      FOREIGN KEY (wallet_address) REFERENCES users(wallet_address) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 6. RPC: Link Wallet to Authenticated User Account
CREATE OR REPLACE FUNCTION link_wallet_to_account(p_wallet TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_owner UUID;
BEGIN
  -- Normalize wallet address
  p_wallet := LOWER(TRIM(p_wallet));

  IF p_wallet IS NULL OR p_wallet = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid wallet address');
  END IF;

  -- Check if wallet is already linked to ANOTHER user account
  SELECT user_id INTO v_existing_owner 
  FROM users 
  WHERE LOWER(wallet_address) = p_wallet AND user_id IS NOT NULL AND user_id <> p_user_id;

  IF v_existing_owner IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'This wallet is already linked to another account. Please delete or unlink that account first before linking here.'
    );
  END IF;

  -- Check if user row exists for p_user_id
  IF EXISTS (SELECT 1 FROM users WHERE user_id = p_user_id) THEN
    UPDATE users 
    SET wallet_address = p_wallet,
        updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF EXISTS (SELECT 1 FROM users WHERE LOWER(wallet_address) = p_wallet) THEN
    UPDATE users 
    SET user_id = p_user_id,
        updated_at = NOW()
    WHERE LOWER(wallet_address) = p_wallet;
  ELSE
    -- Insert new user record
    INSERT INTO users (user_id, wallet_address, auth_provider, balance_pgt, created_at, updated_at)
    VALUES (p_user_id, p_wallet, 'google_wallet', 100, NOW(), NOW());
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Wallet linked successfully!', 'wallet', p_wallet);
END;
$$;

-- 7. RPC: Delete / Unlink User Account
CREATE OR REPLACE FUNCTION delete_user_account(p_user_id UUID DEFAULT NULL, p_wallet TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));

  IF p_user_id IS NOT NULL THEN
    -- Clear wallet_address & user_id linkage so wallet can be re-linked
    DELETE FROM users WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully.');
  ELSIF p_wallet IS NOT NULL AND p_wallet <> '' THEN
    DELETE FROM users WHERE LOWER(wallet_address) = p_wallet;
    RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully.');
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Missing user ID or wallet address.');
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION link_wallet_to_account(TEXT, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION delete_user_account(UUID, TEXT) TO anon, authenticated, service_role;
