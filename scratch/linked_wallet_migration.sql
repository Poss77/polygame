-- ============================================================
-- POLYGAME SEPARATE LINKED WALLET MIGRATION (COMPLETE & AUDITED)
-- Adds linked_wallet_address to users table to prevent PK/FK state corruption
-- Run this script in your Supabase SQL Editor
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS linked_wallet_address TEXT;

-- Index for fast lookup when linking/verifying Web3 wallets
CREATE INDEX IF NOT EXISTS idx_users_linked_wallet ON users (LOWER(linked_wallet_address));

-- 1. RPC: Link Web3 Wallet to User Account (without corrupting primary wallet_address)
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
  WHERE (LOWER(linked_wallet_address) = p_wallet OR LOWER(wallet_address) = p_wallet)
    AND user_id IS NOT NULL 
    AND user_id <> p_user_id;

  IF v_existing_owner IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'This wallet is already linked to another account. Please unbind or delete that account first.'
    );
  END IF;

  -- Update linked_wallet_address for user
  UPDATE users 
  SET linked_wallet_address = p_wallet,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Wallet linked successfully!', 'wallet', p_wallet);
END;
$$;

-- 2. RPC: Delete / Unlink User Account (Safe cleanup)
CREATE OR REPLACE FUNCTION delete_user_account(p_user_id UUID DEFAULT NULL, p_wallet TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_wallet IS NOT NULL AND p_wallet <> '' THEN
    p_wallet := LOWER(TRIM(p_wallet));
  ELSE
    p_wallet := NULL;
  END IF;

  IF p_user_id IS NOT NULL THEN
    DELETE FROM users WHERE user_id = p_user_id;
    RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully.');
  ELSIF p_wallet IS NOT NULL THEN
    DELETE FROM users WHERE LOWER(wallet_address) = p_wallet OR LOWER(linked_wallet_address) = p_wallet;
    RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully.');
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Missing user ID or wallet address.');
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION link_wallet_to_account(TEXT, UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION delete_user_account(UUID, TEXT) TO anon, authenticated, service_role;
