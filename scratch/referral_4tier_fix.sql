-- ============================================================
-- POLYGAME 4-TIER REFERRAL CHAIN REPAIR & AUTOMATIC BINDING RPC
-- Fixes L2, L3, L4 downline tree propagation and updates counters
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Ensure columns exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_l1 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_l2 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_l3 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_l4 TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS referrals_l1 INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referrals_l2 INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referrals_l3 INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referrals_l4 INT DEFAULT 0;

-- 2. Create bind_referral_code RPC for 4-Tier downline propagation
CREATE OR REPLACE FUNCTION bind_referral_code(
  p_user_wallet TEXT,
  p_ref_code TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_wallet TEXT;
  v_l1 RECORD;
  v_l1_wallet TEXT;
  v_l2_wallet TEXT;
  v_l3_wallet TEXT;
  v_l4_wallet TEXT;
  v_existing_ref TEXT;
BEGIN
  v_user_wallet := LOWER(TRIM(p_user_wallet));
  p_ref_code := UPPER(TRIM(p_ref_code));

  IF v_user_wallet IS NULL OR v_user_wallet = '' OR p_ref_code IS NULL OR p_ref_code = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid wallet or referral code');
  END IF;

  -- Check if user already has an L1 referrer
  SELECT referred_by_l1 INTO v_existing_ref
  FROM users
  WHERE LOWER(wallet_address) = v_user_wallet OR LOWER(linked_wallet_address) = v_user_wallet;

  IF v_existing_ref IS NOT NULL AND v_existing_ref <> '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'User already bound to a referrer');
  END IF;

  -- Find Level 1 Referrer by code
  SELECT wallet_address, referred_by_l1, referred_by_l2, referred_by_l3
  INTO v_l1
  FROM users
  WHERE UPPER(referral_code) = p_ref_code;

  IF NOT FOUND THEN
    -- Try searching by partial referral code / wallet address
    SELECT wallet_address, referred_by_l1, referred_by_l2, referred_by_l3
    INTO v_l1
    FROM users
    WHERE LOWER(wallet_address) = LOWER(p_ref_code) OR LOWER(linked_wallet_address) = LOWER(p_ref_code);
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Referrer not found');
  END IF;

  v_l1_wallet := LOWER(v_l1.wallet_address);

  -- Prevent self-referral
  IF v_l1_wallet = v_user_wallet THEN
    RETURN jsonb_build_object('success', false, 'message', 'Self-referral is not allowed');
  END IF;

  v_l2_wallet := LOWER(COALESCE(v_l1.referred_by_l1, ''));
  v_l3_wallet := LOWER(COALESCE(v_l1.referred_by_l2, ''));
  v_l4_wallet := LOWER(COALESCE(v_l1.referred_by_l3, ''));

  -- Update target user's 4-tier referrer tree
  UPDATE users
  SET referred_by_l1 = v_l1_wallet,
      referred_by_l2 = NULLIF(v_l2_wallet, ''),
      referred_by_l3 = NULLIF(v_l3_wallet, ''),
      referred_by_l4 = NULLIF(v_l4_wallet, ''),
      updated_at = NOW()
  WHERE LOWER(wallet_address) = v_user_wallet OR LOWER(linked_wallet_address) = v_user_wallet;

  -- Increment Level 1 Referrer Counters
  UPDATE users SET 
    referrals_count = COALESCE(referrals_count, 0) + 1,
    referrals_l1 = COALESCE(referrals_l1, 0) + 1
  WHERE LOWER(wallet_address) = v_l1_wallet OR LOWER(linked_wallet_address) = v_l1_wallet;

  -- Increment Level 2 Referrer Counters
  IF v_l2_wallet <> '' AND v_l2_wallet <> v_user_wallet THEN
    UPDATE users SET 
      referrals_count = COALESCE(referrals_count, 0) + 1,
      referrals_l2 = COALESCE(referrals_l2, 0) + 1
    WHERE LOWER(wallet_address) = v_l2_wallet OR LOWER(linked_wallet_address) = v_l2_wallet;
  END IF;

  -- Increment Level 3 Referrer Counters
  IF v_l3_wallet <> '' AND v_l3_wallet <> v_user_wallet THEN
    UPDATE users SET 
      referrals_count = COALESCE(referrals_count, 0) + 1,
      referrals_l3 = COALESCE(referrals_l3, 0) + 1
    WHERE LOWER(wallet_address) = v_l3_wallet OR LOWER(linked_wallet_address) = v_l3_wallet;
  END IF;

  -- Increment Level 4 Referrer Counters
  IF v_l4_wallet <> '' AND v_l4_wallet <> v_user_wallet THEN
    UPDATE users SET 
      referrals_count = COALESCE(referrals_count, 0) + 1,
      referrals_l4 = COALESCE(referrals_l4, 0) + 1
    WHERE LOWER(wallet_address) = v_l4_wallet OR LOWER(linked_wallet_address) = v_l4_wallet;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'message', '4-Tier referral chain linked successfully!',
    'l1', v_l1_wallet,
    'l2', v_l2_wallet
  );
END;
$$;

-- 3. Retroactive Maintenance Function to recalculate all L2/L3/L4 downlines for existing database records
DO $$
DECLARE
  r RECORD;
  v_l2 TEXT;
  v_l3 TEXT;
  v_l4 TEXT;
BEGIN
  -- Re-link ancestor chains for all users with an L1 referrer
  FOR r IN SELECT wallet_address, referred_by_l1 FROM users WHERE referred_by_l1 IS NOT NULL AND referred_by_l1 <> '' LOOP
    SELECT LOWER(referred_by_l1), LOWER(referred_by_l2), LOWER(referred_by_l3)
    INTO v_l2, v_l3, v_l4
    FROM users WHERE LOWER(wallet_address) = LOWER(r.referred_by_l1) OR LOWER(linked_wallet_address) = LOWER(r.referred_by_l1);

    UPDATE users
    SET referred_by_l2 = NULLIF(v_l2, ''),
        referred_by_l3 = NULLIF(v_l3, ''),
        referred_by_l4 = NULLIF(v_l4, '')
    WHERE LOWER(wallet_address) = LOWER(r.wallet_address);
  END LOOP;

  -- Recalculate 4-tier counts for all users
  UPDATE users u SET
    referrals_l1 = (SELECT COUNT(*) FROM users WHERE LOWER(referred_by_l1) = LOWER(u.wallet_address) OR LOWER(referred_by_l1) = LOWER(COALESCE(u.linked_wallet_address, ''))),
    referrals_l2 = (SELECT COUNT(*) FROM users WHERE LOWER(referred_by_l2) = LOWER(u.wallet_address) OR LOWER(referred_by_l2) = LOWER(COALESCE(u.linked_wallet_address, ''))),
    referrals_l3 = (SELECT COUNT(*) FROM users WHERE LOWER(referred_by_l3) = LOWER(u.wallet_address) OR LOWER(referred_by_l3) = LOWER(COALESCE(u.linked_wallet_address, ''))),
    referrals_l4 = (SELECT COUNT(*) FROM users WHERE LOWER(referred_by_l4) = LOWER(u.wallet_address) OR LOWER(referred_by_l4) = LOWER(COALESCE(u.linked_wallet_address, '')));

  UPDATE users u SET
    referrals_count = COALESCE(referrals_l1, 0) + COALESCE(referrals_l2, 0) + COALESCE(referrals_l3, 0) + COALESCE(referrals_l4, 0);
END $$;

GRANT EXECUTE ON FUNCTION bind_referral_code(TEXT, TEXT) TO anon, authenticated, service_role;
