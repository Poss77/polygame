-- ============================================================
-- POLYGAME 100% AUTOMATIC ACCOUNT MERGE & LINKING RPC
-- Merges PGT balance, Staking Positions, Referrals, NFTs, VIP Status, 
-- and Arcade High Scores when linking MetaMask to Google!
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
  v_merged_1flr NUMERIC := 0;
  v_merged_ref_rewards NUMERIC := 0;
  v_merged_ref_count INT := 0;
  v_merged_dodge INT := 0;
  v_merged_invaders INT := 0;
  v_merged_drift INT := 0;
  v_merged_stakes JSONB := '[]'::jsonb;
  v_merged_nfts JSONB := '[]'::jsonb;
  v_merged_space JSONB := '{}'::jsonb;
  v_merged_vip TIMESTAMPTZ := NULL;
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
  SELECT balance_pgt, balance_1flr, unclaimed_referral_rewards, referrals_count,
         game_highscore, invaders_highscore, drift_highscore,
         stakes, owned_nfts, space_state, vip_until
  INTO v_old_row
  FROM users
  WHERE (LOWER(wallet_address) = p_wallet OR LOWER(linked_wallet_address) = p_wallet)
    AND (user_id IS NULL OR user_id <> p_user_id);

  IF FOUND THEN
    v_merged_pgt := COALESCE(v_old_row.balance_pgt, 0);
    v_merged_1flr := COALESCE(v_old_row.balance_1flr, 0);
    v_merged_ref_rewards := COALESCE(v_old_row.unclaimed_referral_rewards, 0);
    v_merged_ref_count := COALESCE(v_old_row.referrals_count, 0);
    v_merged_dodge := COALESCE(v_old_row.game_highscore, 0);
    v_merged_invaders := COALESCE(v_old_row.invaders_highscore, 0);
    v_merged_drift := COALESCE(v_old_row.drift_highscore, 0);
    v_merged_stakes := COALESCE(v_old_row.stakes, '[]'::jsonb);
    v_merged_nfts := COALESCE(v_old_row.owned_nfts, '[]'::jsonb);
    v_merged_space := COALESCE(v_old_row.space_state, '{}'::jsonb);
    v_merged_vip := v_old_row.vip_until;

    -- Delete the unauthenticated duplicate row after reading metrics
    DELETE FROM users 
    WHERE (LOWER(wallet_address) = p_wallet OR LOWER(linked_wallet_address) = p_wallet)
      AND (user_id IS NULL OR user_id <> p_user_id);
  END IF;

  -- 3. Merge balance, stakes, referrals, NFTs, VIP status, and link wallet directly to the Google account row
  UPDATE users 
  SET linked_wallet_address = p_wallet,
      balance_pgt = COALESCE(balance_pgt, 0) + v_merged_pgt,
      balance_1flr = COALESCE(balance_1flr, 0) + v_merged_1flr,
      unclaimed_referral_rewards = COALESCE(unclaimed_referral_rewards, 0) + v_merged_ref_rewards,
      referrals_count = COALESCE(referrals_count, 0) + v_merged_ref_count,
      game_highscore = GREATEST(COALESCE(game_highscore, 0), v_merged_dodge),
      invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), v_merged_invaders),
      drift_highscore = GREATEST(COALESCE(drift_highscore, 0), v_merged_drift),
      stakes = CASE 
        WHEN jsonb_array_length(v_merged_stakes) > 0 THEN COALESCE(stakes, '[]'::jsonb) || v_merged_stakes 
        ELSE COALESCE(stakes, '[]'::jsonb) 
      END,
      owned_nfts = CASE 
        WHEN jsonb_array_length(v_merged_nfts) > 0 THEN COALESCE(owned_nfts, '[]'::jsonb) || v_merged_nfts 
        ELSE COALESCE(owned_nfts, '[]'::jsonb) 
      END,
      space_state = CASE 
        WHEN v_merged_space <> '{}'::jsonb THEN v_merged_space 
        ELSE COALESCE(space_state, '{}'::jsonb) 
      END,
      vip_until = CASE 
        WHEN v_merged_vip IS NOT NULL AND (vip_until IS NULL OR v_merged_vip > vip_until) THEN v_merged_vip 
        ELSE vip_until 
      END,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Wallet linked & 100% account progress merged successfully!', 
    'wallet', p_wallet,
    'merged_pgt', v_merged_pgt,
    'merged_ref_rewards', v_merged_ref_rewards
  );
END;
$$;

GRANT EXECUTE ON FUNCTION link_wallet_to_account(TEXT, UUID) TO anon, authenticated, service_role;
