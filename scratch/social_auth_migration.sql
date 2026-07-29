-- ============================================================
-- POLYGAME SOCIAL AUTH & WALLET LINKING MIGRATION SCRIPT
-- Run this script in the Supabase SQL Editor
-- ============================================================

-- 1. Add user_id column linking to auth.users(id)
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'wallet';
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Create unique index on user_id (excluding NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_id ON users (user_id) WHERE user_id IS NOT NULL;

-- 3. Ensure wallet_address column is unique (excluding NULL)
-- Drop existing constraint if needed and ensure nullable unique index
ALTER TABLE users ALTER COLUMN wallet_address DROP NOT NULL;

-- 4. RPC: Link Wallet to Authenticated User Account
CREATE OR REPLACE FUNCTION link_wallet_to_account(p_wallet TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_owner UUID;
  v_existing_wallet TEXT;
  v_result JSONB;
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

-- 5. RPC: Delete / Unlink User Account
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
