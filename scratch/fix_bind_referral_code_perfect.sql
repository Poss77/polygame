-- POLYGAME: PERFECT BIND REFERRAL CODE RPC (v1.4.449)
-- ============================================================
-- Fixes referral tree binding for all referral link formats (with or without 'ref_' prefix, player_id, or wallet address)
-- and resolves target users by player_id OR linked_wallet_address.

CREATE OR REPLACE FUNCTION bind_referral_code(
  p_user_wallet TEXT,
  p_ref_code TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_input_user TEXT := LOWER(TRIM(COALESCE(p_user_wallet, '')));
  v_pid TEXT := resolve_player_id(p_user_wallet);
  v_ref_user RECORD;
  v_cur_user RECORD;
  v_clean_ref TEXT;
BEGIN
  v_clean_ref := LOWER(TRIM(COALESCE(p_ref_code, '')));
  IF v_clean_ref = '' OR v_clean_ref = 'empty' OR v_clean_ref = 'null' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid or empty referral code');
  END IF;

  -- 1. Resolve Target User by player_id OR linked_wallet_address
  SELECT * INTO v_cur_user 
  FROM users 
  WHERE LOWER(player_id) = v_input_user 
     OR LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(COALESCE(linked_wallet_address, '')) = v_input_user 
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Target user record not found');
  END IF;

  -- 2. Check if already bound
  IF v_cur_user.referred_by_l1 IS NOT NULL AND v_cur_user.referred_by_l1 <> '' AND v_cur_user.referred_by_l1 <> 'EMPTY' THEN
    RETURN jsonb_build_object('success', false, 'message', 'User already has a referrer linked');
  END IF;

  -- 3. Resolve Referrer User flexible matching (referral_code with/without ref_, player_id, or linked_wallet_address)
  SELECT * INTO v_ref_user 
  FROM users 
  WHERE LOWER(COALESCE(referral_code, '')) = v_clean_ref 
     OR LOWER(COALESCE(referral_code, '')) = 'ref_' || v_clean_ref
     OR REPLACE(LOWER(COALESCE(referral_code, '')), 'ref_', '') = REPLACE(v_clean_ref, 'ref_', '')
     OR LOWER(player_id) = v_clean_ref 
     OR LOWER(COALESCE(linked_wallet_address, '')) = v_clean_ref;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Referral code not found in database');
  END IF;

  -- 4. Prevent self-referral
  IF LOWER(v_ref_user.player_id) = LOWER(v_cur_user.player_id) 
     OR (v_ref_user.linked_wallet_address IS NOT NULL AND LOWER(v_ref_user.linked_wallet_address) = LOWER(COALESCE(v_cur_user.linked_wallet_address, ''))) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot refer yourself');
  END IF;

  -- 5. Bind 4-tier referrer tree on target user row
  UPDATE users
  SET referred_by_l1 = v_ref_user.player_id,
      referred_by_l2 = NULLIF(v_ref_user.referred_by_l1, ''),
      referred_by_l3 = NULLIF(v_ref_user.referred_by_l2, ''),
      referred_by_l4 = NULLIF(v_ref_user.referred_by_l3, ''),
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_cur_user.player_id);

  -- 6. Increment Downline Counters (L1..L4)
  UPDATE users 
  SET referrals_count = COALESCE(referrals_count, 0) + 1,
      referrals_l1 = COALESCE(referrals_l1, 0) + 1,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_ref_user.player_id);

  IF v_ref_user.referred_by_l1 IS NOT NULL AND v_ref_user.referred_by_l1 <> '' THEN
    UPDATE users 
    SET referrals_count = COALESCE(referrals_count, 0) + 1,
        referrals_l2 = COALESCE(referrals_l2, 0) + 1 
    WHERE LOWER(player_id) = LOWER(v_ref_user.referred_by_l1);
  END IF;

  IF v_ref_user.referred_by_l2 IS NOT NULL AND v_ref_user.referred_by_l2 <> '' THEN
    UPDATE users 
    SET referrals_count = COALESCE(referrals_count, 0) + 1,
        referrals_l3 = COALESCE(referrals_l3, 0) + 1 
    WHERE LOWER(player_id) = LOWER(v_ref_user.referred_by_l2);
  END IF;

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
