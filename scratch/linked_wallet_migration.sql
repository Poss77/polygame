-- ============================================================
-- POLYGAME SEPARATE LINKED WALLET MIGRATION
-- Adds linked_wallet_address to users table to prevent PK/FK state corruption
-- Run this script in your Supabase SQL Editor
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS linked_wallet_address TEXT;

-- Index for fast lookup when linking/verifying Web3 wallets
CREATE INDEX IF NOT EXISTS idx_users_linked_wallet ON users (LOWER(linked_wallet_address));

-- Updated RPC to link Web3 wallet to a separate linked_wallet_address column
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
      'message', 'This wallet is already linked to another account.'
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

GRANT EXECUTE ON FUNCTION link_wallet_to_account(TEXT, UUID) TO anon, authenticated, service_role;
