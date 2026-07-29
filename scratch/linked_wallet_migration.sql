-- ============================================================
-- POLYGAME UNIFIED SINGLE ACCOUNT MIGRATION
-- Ensures exactly ONE user account exists per player
-- Purges duplicate empty unlinked rows when connecting Web3 wallets
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS linked_wallet_address TEXT;

CREATE INDEX IF NOT EXISTS idx_users_linked_wallet ON users (LOWER(linked_wallet_address));

CREATE OR REPLACE FUNCTION link_wallet_to_account(p_wallet TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_owner UUID;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));

  IF p_wallet IS NULL OR p_wallet = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid wallet address');
  END IF;

  -- 1. Prevent stealing a wallet already linked to ANOTHER Google user
  SELECT user_id INTO v_existing_owner 
  FROM users 
  WHERE (LOWER(linked_wallet_address) = p_wallet OR LOWER(wallet_address) = p_wallet)
    AND user_id IS NOT NULL 
    AND user_id <> p_user_id;

  IF v_existing_owner IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'This wallet is already linked to another Google account.'
    );
  END IF;

  -- 2. Purge any duplicate empty unauthenticated row created for p_wallet
  DELETE FROM users 
  WHERE (LOWER(wallet_address) = p_wallet OR LOWER(linked_wallet_address) = p_wallet)
    AND (user_id IS NULL OR user_id <> p_user_id);

  -- 3. Link wallet directly to the Google account row
  UPDATE users 
  SET linked_wallet_address = p_wallet,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Wallet linked successfully!', 'wallet', p_wallet);
END;
$$;

GRANT EXECUTE ON FUNCTION link_wallet_to_account(TEXT, UUID) TO anon, authenticated, service_role;
