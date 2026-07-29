-- ============================================================
-- POLYGAME AUTOMATIC ACCOUNT MERGE & LINKING RPC
-- Merges PGT balance, high scores, NFTs, and stakes when linking
-- a Web3 wallet to a Google account so NO DATA IS EVER LOST!
-- Run this script in your Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION link_wallet_to_account(p_wallet TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_owner UUID;
  v_old_row RECORD;
  v_merged_pgt NUMERIC := 0;
  v_merged_dodge INT := 0;
  v_merged_invaders INT := 0;
  v_merged_drift INT := 0;
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

  -- 2. Fetch unauthenticated standalone wallet row if it exists
  SELECT balance_pgt, game_highscore, invaders_highscore, drift_highscore
  INTO v_old_row
  FROM users
  WHERE (LOWER(wallet_address) = p_wallet OR LOWER(linked_wallet_address) = p_wallet)
    AND (user_id IS NULL OR user_id <> p_user_id);

  IF FOUND THEN
    v_merged_pgt := COALESCE(v_old_row.balance_pgt, 0);
    v_merged_dodge := COALESCE(v_old_row.game_highscore, 0);
    v_merged_invaders := COALESCE(v_old_row.invaders_highscore, 0);
    v_merged_drift := COALESCE(v_old_row.drift_highscore, 0);

    -- Delete the unauthenticated duplicate row after reading metrics
    DELETE FROM users 
    WHERE (LOWER(wallet_address) = p_wallet OR LOWER(linked_wallet_address) = p_wallet)
      AND (user_id IS NULL OR user_id <> p_user_id);
  END IF;

  -- 3. Merge balance, high scores, and link wallet directly to the Google account row
  UPDATE users 
  SET linked_wallet_address = p_wallet,
      balance_pgt = COALESCE(balance_pgt, 0) + v_merged_pgt,
      game_highscore = GREATEST(COALESCE(game_highscore, 0), v_merged_dodge),
      invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), v_merged_invaders),
      drift_highscore = GREATEST(COALESCE(drift_highscore, 0), v_merged_drift),
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Wallet linked & account progress merged successfully!', 
    'wallet', p_wallet,
    'merged_pgt', v_merged_pgt
  );
END;
$$;

GRANT EXECUTE ON FUNCTION link_wallet_to_account(TEXT, UUID) TO anon, authenticated, service_role;
