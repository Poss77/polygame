-- ============================================================
-- POLYGAME REFERRAL TREE & COUNTERS PERFECT REPAIR
-- 1. Sets Poss (0xpgt8312e02d...) referred_by_l1 = Master Admin (0xpgt85c84164...)
-- 2. Sets Master Admin (0xpgt85c84164...) referred_by_l1 = NULL (Root)
-- 3. Converts all raw EVM wallet addresses (0x922... & 0x10b...) to player_ids
-- 4. Re-links L2 downlines: Poss's referrals get referred_by_l2 = Master Admin (0xpgt85c84164...)
-- 5. Recalculates 4-tier referral counts checking BOTH player_id AND linked_wallet_address
-- ============================================================

-- 1. Explicitly set Poss (0xpgt8312e02d...) referred_by_l1 = Master Admin (0xpgt85c8416473bd6a8c45ada81ac85aeabb)
UPDATE users
SET referred_by_l1 = '0xpgt85c8416473bd6a8c45ada81ac85aeabb',
    referred_by_l2 = NULL,
    referred_by_l3 = NULL,
    referred_by_l4 = NULL
WHERE LOWER(player_id) = '0xpgt8312e02d37185b5983e6922d1dae1cce'
   OR LOWER(COALESCE(linked_wallet_address, '')) = '0x92206284cae2b1be18c8bcc9042ee';

-- 2. Explicitly set Master Admin (0xpgt85c84164...) referred_by_l1 = NULL (Root Founder)
UPDATE users
SET referred_by_l1 = NULL,
    referred_by_l2 = NULL,
    referred_by_l3 = NULL,
    referred_by_l4 = NULL
WHERE LOWER(player_id) = '0xpgt85c8416473bd6a8c45ada81ac85aeabb'
   OR LOWER(COALESCE(linked_wallet_address, '')) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d';

-- 3. Replace any raw EVM wallet addresses in referred_by columns with resolved player_ids
DO $$
DECLARE
  r RECORD;
  v_res1 TEXT;
  v_res2 TEXT;
  v_res3 TEXT;
  v_res4 TEXT;
BEGIN
  FOR r IN SELECT player_id, referred_by_l1, referred_by_l2, referred_by_l3, referred_by_l4 FROM users LOOP
    v_res1 := CASE 
      WHEN LOWER(r.referred_by_l1) = '0x92206284cae2b1be18c8bcc9042ee' THEN '0xpgt8312e02d37185b5983e6922d1dae1cce'
      WHEN LOWER(r.referred_by_l1) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d' THEN '0xpgt85c8416473bd6a8c45ada81ac85aeabb'
      ELSE resolve_player_id(r.referred_by_l1)
    END;

    v_res2 := CASE 
      WHEN LOWER(r.referred_by_l2) = '0x92206284cae2b1be18c8bcc9042ee' THEN '0xpgt8312e02d37185b5983e6922d1dae1cce'
      WHEN LOWER(r.referred_by_l2) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d' THEN '0xpgt85c8416473bd6a8c45ada81ac85aeabb'
      ELSE resolve_player_id(r.referred_by_l2)
    END;

    v_res3 := CASE 
      WHEN LOWER(r.referred_by_l3) = '0x92206284cae2b1be18c8bcc9042ee' THEN '0xpgt8312e02d37185b5983e6922d1dae1cce'
      WHEN LOWER(r.referred_by_l3) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d' THEN '0xpgt85c8416473bd6a8c45ada81ac85aeabb'
      ELSE resolve_player_id(r.referred_by_l3)
    END;

    v_res4 := CASE 
      WHEN LOWER(r.referred_by_l4) = '0x92206284cae2b1be18c8bcc9042ee' THEN '0xpgt8312e02d37185b5983e6922d1dae1cce'
      WHEN LOWER(r.referred_by_l4) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d' THEN '0xpgt85c8416473bd6a8c45ada81ac85aeabb'
      ELSE resolve_player_id(r.referred_by_l4)
    END;

    UPDATE users
    SET referred_by_l1 = NULLIF(v_res1, ''),
        referred_by_l2 = NULLIF(v_res2, ''),
        referred_by_l3 = NULLIF(v_res3, ''),
        referred_by_l4 = NULLIF(v_res4, '')
    WHERE player_id = r.player_id;
  END LOOP;
END $$;

-- 4. Re-link L2, L3, L4 downlines strictly based on parent's true referred_by chain
DO $$
DECLARE
  r RECORD;
  v_parent RECORD;
BEGIN
  FOR r IN SELECT player_id, referred_by_l1 FROM users WHERE referred_by_l1 IS NOT NULL AND referred_by_l1 <> '' AND referred_by_l1 <> 'EMPTY' LOOP
    SELECT referred_by_l1, referred_by_l2, referred_by_l3 INTO v_parent
    FROM users WHERE LOWER(player_id) = LOWER(r.referred_by_l1) OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(r.referred_by_l1);

    IF FOUND THEN
      UPDATE users
      SET referred_by_l2 = NULLIF(v_parent.referred_by_l1, ''),
          referred_by_l3 = NULLIF(v_parent.referred_by_l2, ''),
          referred_by_l4 = NULLIF(v_parent.referred_by_l3, '')
      WHERE player_id = r.player_id;
    END IF;
  END LOOP;
END $$;

-- 5. Recalculate 4-Tier referral counts for all users checking BOTH player_id AND linked_wallet_address
UPDATE users u SET
  referrals_l1 = (
    SELECT COUNT(*) FROM users 
    WHERE LOWER(referred_by_l1) = LOWER(u.player_id) 
       OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(referred_by_l1) = LOWER(u.linked_wallet_address))
  ),
  referrals_l2 = (
    SELECT COUNT(*) FROM users 
    WHERE LOWER(referred_by_l2) = LOWER(u.player_id) 
       OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(referred_by_l2) = LOWER(u.linked_wallet_address))
  ),
  referrals_l3 = (
    SELECT COUNT(*) FROM users 
    WHERE LOWER(referred_by_l3) = LOWER(u.player_id) 
       OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(referred_by_l3) = LOWER(u.linked_wallet_address))
  ),
  referrals_l4 = (
    SELECT COUNT(*) FROM users 
    WHERE LOWER(referred_by_l4) = LOWER(u.player_id) 
       OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(referred_by_l4) = LOWER(u.linked_wallet_address))
  );

UPDATE users SET
  referrals_count = COALESCE(referrals_l1, 0) + COALESCE(referrals_l2, 0) + COALESCE(referrals_l3, 0) + COALESCE(referrals_l4, 0);

-- 6. Hardened bind_referral_code RPC (Guarantees player_id is always stored)
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

  UPDATE users
  SET referred_by_l1 = v_ref_user.player_id,
      referred_by_l2 = NULLIF(v_ref_user.referred_by_l1, ''),
      referred_by_l3 = NULLIF(v_ref_user.referred_by_l2, ''),
      referred_by_l4 = NULLIF(v_ref_user.referred_by_l3, ''),
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid);

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
