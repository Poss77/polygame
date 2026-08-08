-- ============================================================
-- POLYGAME REFERRAL SYSTEM COMPLETE BINDING & COUNTING FIX
-- Fixes referral code matching against referral_code column
-- Recalculates 4-tier referral downlines for all existing players
-- Run this script in your Supabase SQL Editor
-- ============================================================

-- 1. Ensure referral columns exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_l1 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_l2 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_l3 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_l4 TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referrals_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referrals_l1 INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referrals_l2 INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referrals_l3 INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referrals_l4 INT DEFAULT 0;

-- 2. Drop legacy function overloads
DROP FUNCTION IF EXISTS bind_referral_code(TEXT, TEXT);

-- 3. Create updated bind_referral_code RPC
CREATE OR REPLACE FUNCTION bind_referral_code(
  p_user_wallet TEXT,
  p_ref_code TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_user_wallet);
  v_ref_user RECORD;
  v_cur_user RECORD;
  v_clean_ref TEXT;
BEGIN
  v_clean_ref := LOWER(TRIM(COALESCE(p_ref_code, '')));
  IF v_clean_ref = '' OR v_clean_ref = 'empty' OR v_clean_ref = 'null' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid or empty referral code');
  END IF;

  SELECT * INTO v_cur_user FROM users WHERE LOWER(player_id) = LOWER(v_pid);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Target user not found');
  END IF;

  IF v_cur_user.referred_by_l1 IS NOT NULL AND v_cur_user.referred_by_l1 <> '' AND v_cur_user.referred_by_l1 <> 'EMPTY' THEN
    RETURN jsonb_build_object('success', false, 'message', 'User already has a referrer linked');
  END IF;

  -- Crucial Fix: Search referral_code column first, then player_id, then linked_wallet_address
  SELECT * INTO v_ref_user 
  FROM users 
  WHERE LOWER(COALESCE(referral_code, '')) = v_clean_ref 
     OR LOWER(player_id) = v_clean_ref 
     OR LOWER(COALESCE(linked_wallet_address, '')) = v_clean_ref;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Referral code not found in database');
  END IF;

  IF LOWER(v_ref_user.player_id) = LOWER(v_pid) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot refer yourself');
  END IF;

  -- Update target user's 4-tier referrer chain
  UPDATE users
  SET referred_by_l1 = v_ref_user.player_id,
      referred_by_l2 = NULLIF(v_ref_user.referred_by_l1, ''),
      referred_by_l3 = NULLIF(v_ref_user.referred_by_l2, ''),
      referred_by_l4 = NULLIF(v_ref_user.referred_by_l3, ''),
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid);

  -- Increment Level 1 Referrer Counters
  UPDATE users 
  SET referrals_count = COALESCE(referrals_count, 0) + 1,
      referrals_l1 = COALESCE(referrals_l1, 0) + 1,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_ref_user.player_id);

  -- Increment Level 2 Referrer Counters
  IF v_ref_user.referred_by_l1 IS NOT NULL AND v_ref_user.referred_by_l1 <> '' THEN
    UPDATE users 
    SET referrals_count = COALESCE(referrals_count, 0) + 1,
        referrals_l2 = COALESCE(referrals_l2, 0) + 1 
    WHERE LOWER(player_id) = LOWER(v_ref_user.referred_by_l1);
  END IF;

  -- Increment Level 3 Referrer Counters
  IF v_ref_user.referred_by_l2 IS NOT NULL AND v_ref_user.referred_by_l2 <> '' THEN
    UPDATE users 
    SET referrals_count = COALESCE(referrals_count, 0) + 1,
        referrals_l3 = COALESCE(referrals_l3, 0) + 1 
    WHERE LOWER(player_id) = LOWER(v_ref_user.referred_by_l2);
  END IF;

  -- Increment Level 4 Referrer Counters
  IF v_ref_user.referred_by_l3 IS NOT NULL AND v_ref_user.referred_by_l3 <> '' THEN
    UPDATE users 
    SET referrals_count = COALESCE(referrals_count, 0) + 1,
        referrals_l4 = COALESCE(referrals_l4, 0) + 1 
    WHERE LOWER(player_id) = LOWER(v_ref_user.referred_by_l3);
  END IF;

  RETURN jsonb_build_object('success', true, 'referrer', v_ref_user.player_id, 'ref_code', v_clean_ref);
END;
$$;

GRANT EXECUTE ON FUNCTION bind_referral_code(TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. Retroactive Repair: Recalculate 4-Tier downline counters for ALL existing database users
DO $$
DECLARE
  r RECORD;
  v_l2 TEXT;
  v_l3 TEXT;
  v_l4 TEXT;
BEGIN
  -- Re-link ancestor chains for all users with an L1 referrer
  FOR r IN SELECT player_id, referred_by_l1 FROM users WHERE referred_by_l1 IS NOT NULL AND referred_by_l1 <> '' AND referred_by_l1 <> 'EMPTY' LOOP
    SELECT referred_by_l1, referred_by_l2, referred_by_l3
    INTO v_l2, v_l3, v_l4
    FROM users WHERE LOWER(player_id) = LOWER(r.referred_by_l1);

    UPDATE users
    SET referred_by_l2 = NULLIF(v_l2, ''),
        referred_by_l3 = NULLIF(v_l3, ''),
        referred_by_l4 = NULLIF(v_l4, '')
    WHERE LOWER(player_id) = LOWER(r.player_id);
  END LOOP;

  -- Recalculate 4-tier referral counts for every user
  UPDATE users u SET
    referrals_l1 = (SELECT COUNT(*) FROM users WHERE LOWER(referred_by_l1) = LOWER(u.player_id)),
    referrals_l2 = (SELECT COUNT(*) FROM users WHERE LOWER(referred_by_l2) = LOWER(u.player_id)),
    referrals_l3 = (SELECT COUNT(*) FROM users WHERE LOWER(referred_by_l3) = LOWER(u.player_id)),
    referrals_l4 = (SELECT COUNT(*) FROM users WHERE LOWER(referred_by_l4) = LOWER(u.player_id));

  UPDATE users SET
    referrals_count = COALESCE(referrals_l1, 0) + COALESCE(referrals_l2, 0) + COALESCE(referrals_l3, 0) + COALESCE(referrals_l4, 0);
END $$;
