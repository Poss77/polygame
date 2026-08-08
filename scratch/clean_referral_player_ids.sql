-- ============================================================
-- POLYGAME REFERRAL TREE CLEANUP & PLAYER_ID NORMALIZATION
-- Converts raw EVM wallet addresses in referred_by_l1..l4 into player_ids
-- Re-links ancestor chains (L1 -> L2 -> L3 -> L4)
-- Recalculates 4-tier referral counters for all users
-- ============================================================

-- 1. Ensure bind_referral_code RPC ALWAYS uses player_id
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

  -- Match against referral_code, player_id, or linked_wallet_address
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

  -- Crucial: ALWAYS store player_id in referred_by_l1..l4
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

-- 2. Clean existing EVM wallet addresses in referred_by columns by resolving to player_id
DO $$
DECLARE
  r RECORD;
  v_resolved TEXT;
BEGIN
  -- Replace referred_by_l1 EVM addresses with synthetic player_id
  FOR r IN SELECT player_id, referred_by_l1 FROM users WHERE referred_by_l1 IS NOT NULL AND referred_by_l1 <> '' LOOP
    v_resolved := resolve_player_id(r.referred_by_l1);
    IF v_resolved IS NOT NULL AND v_resolved <> r.referred_by_l1 THEN
      UPDATE users SET referred_by_l1 = v_resolved WHERE player_id = r.player_id;
    END IF;
  END LOOP;

  -- Replace referred_by_l2 EVM addresses with synthetic player_id
  FOR r IN SELECT player_id, referred_by_l2 FROM users WHERE referred_by_l2 IS NOT NULL AND referred_by_l2 <> '' LOOP
    v_resolved := resolve_player_id(r.referred_by_l2);
    IF v_resolved IS NOT NULL AND v_resolved <> r.referred_by_l2 THEN
      UPDATE users SET referred_by_l2 = v_resolved WHERE player_id = r.player_id;
    END IF;
  END LOOP;

  -- Replace referred_by_l3 EVM addresses with synthetic player_id
  FOR r IN SELECT player_id, referred_by_l3 FROM users WHERE referred_by_l3 IS NOT NULL AND referred_by_l3 <> '' LOOP
    v_resolved := resolve_player_id(r.referred_by_l3);
    IF v_resolved IS NOT NULL AND v_resolved <> r.referred_by_l3 THEN
      UPDATE users SET referred_by_l3 = v_resolved WHERE player_id = r.player_id;
    END IF;
  END LOOP;

  -- Replace referred_by_l4 EVM addresses with synthetic player_id
  FOR r IN SELECT player_id, referred_by_l4 FROM users WHERE referred_by_l4 IS NOT NULL AND referred_by_l4 <> '' LOOP
    v_resolved := resolve_player_id(r.referred_by_l4);
    IF v_resolved IS NOT NULL AND v_resolved <> r.referred_by_l4 THEN
      UPDATE users SET referred_by_l4 = v_resolved WHERE player_id = r.player_id;
    END IF;
  END LOOP;
END $$;

-- 3. Explicitly update Master Admin (0x10b...) row to show referred_by_l1 = Poss (0xpgt8312e02d37185b5983e6922d1dae1cce) if missing
UPDATE users
SET referred_by_l1 = '0xpgt8312e02d37185b5983e6922d1dae1cce'
WHERE (LOWER(player_id) = '0xpgt85c8416473bd6a8c45ada81ac85aeabb' OR LOWER(linked_wallet_address) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d')
  AND (referred_by_l1 IS NULL OR referred_by_l1 = '' OR referred_by_l1 = 'EMPTY');

-- 4. Re-link 4-Tier downlines (L2, L3, L4) for ALL users based on resolved player_id tree
DO $$
DECLARE
  r RECORD;
  v_l2 TEXT;
  v_l3 TEXT;
  v_l4 TEXT;
BEGIN
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

  -- 5. Recalculate 4-tier downline referral counters for all users
  UPDATE users u SET
    referrals_l1 = (SELECT COUNT(*) FROM users WHERE LOWER(referred_by_l1) = LOWER(u.player_id)),
    referrals_l2 = (SELECT COUNT(*) FROM users WHERE LOWER(referred_by_l2) = LOWER(u.player_id)),
    referrals_l3 = (SELECT COUNT(*) FROM users WHERE LOWER(referred_by_l3) = LOWER(u.player_id)),
    referrals_l4 = (SELECT COUNT(*) FROM users WHERE LOWER(referred_by_l4) = LOWER(u.player_id));

  UPDATE users SET
    referrals_count = COALESCE(referrals_l1, 0) + COALESCE(referrals_l2, 0) + COALESCE(referrals_l3, 0) + COALESCE(referrals_l4, 0);
END $$;
