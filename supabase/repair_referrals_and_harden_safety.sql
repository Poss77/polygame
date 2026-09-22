-- ==============================================================================
-- POLYGON GAMING: INCIDENT REMEDIATION & REFERRAL SECURITY HARDENING
-- Target Incident: Dobby automated retroactive referral hijacking on 33 accounts
-- Attacker: Dobby TheDEV (0xpgt003e7625 / 0x602BEc371e2A99f679C73A5930a590CeBf8e7696)
-- Date: 2026-09-22
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: Revert all 33 hijacked accounts back to their organic NULL referral state
-- (Verified against official backup: supabase/backups/backup_2026_09_21_210002)
-- ------------------------------------------------------------------------------
UPDATE public.users
SET referred_by_l1 = NULL,
    referred_by_l2 = NULL,
    referred_by_l3 = NULL,
    referred_by_l4 = NULL,
    updated_at = NOW()
WHERE player_id IN (
  '0xpgt20b2e5c4925f3b650119e65846a9a0e6',
  '0xpgt338257cae0ff',
  '0xpgt5e64957dabcde8ba47239a359f61b6f1',
  '0xpgta9fe5522',
  '0xpgt5a80f59316d0',
  '0xpgtc5215c1d80db2220',
  '0xpgta7c8ba2f076d6e6fc839fcd4814c25f2',
  '0xpgte2fbd5292fd682f14cd58bc6b07cca8e',
  '0xpgteab47ba5',
  '0xpgtff25ca4fc17b2ffc210760a7bb6903ed',
  '0xpgtbd97919e10da',
  '0xpgtf0e36f2e2347',
  '0xpgtc15b9c7f',
  '0xpgtff6fda35a3de20f030a067a7b5740e6c',
  '0xpgt9509073841a7af5e085a3163070db83a',
  '0xpgt2a698d81',
  '0xpgtdb4748d3',
  '0xpgt7a37da9f',
  '0xpgt10bf5152',
  '0xpgtac5b435f0000000000000000000000000000',
  '0xpgt67c421543c92743b4a53886d2d95c6b4',
  '0xpgt6732ac3f9a69',
  '0xpgt6e47d6b1441b89685def5ab69052b53a',
  '0xpgt7865f5db8190af2ea08d3aea71d7802e',
  '0xpgt461a068f0bd48378c8f93a4eadb77152',
  '0xpgt978d167e7a2cb6daa264a2d172f58ecb',
  '0xpgteff03e330000000000000000000000000000',
  '0xpgtddeff05e',
  '0xpgt7aa30a10',
  '0xpgt19564445',
  '0xpgt9822a86a2fd62434f2204a9e19b7c86c',
  '0xpgt4b2fbd2c530a',
  '0xpgt14bb92276d60bbe3'
);

-- ------------------------------------------------------------------------------
-- STEP 2: Purge 28 fraudulent referral commissions generated from hijacked downlines today
-- ------------------------------------------------------------------------------
DELETE FROM public.referral_commissions
WHERE created_at >= '2026-09-22T00:00:00Z'
  AND downline_player_id = '0xpgt5e64957dabcde8ba47239a359f61b6f1';

-- ------------------------------------------------------------------------------
-- STEP 3: Reconcile Upline Balances & Restore Referral Counters to Backup State
-- ------------------------------------------------------------------------------

-- 1. Attacker (Dobby): Ban account, wipe out stolen commissions & referral count
UPDATE public.users
SET referrals_count = 0,
    referrals_l1 = 0,
    referrals_l2 = 0,
    referrals_l3 = 0,
    referrals_l4 = 0,
    referrals_list = '[]'::jsonb,
    unclaimed_referral_pgt = 0.0,
    total_referral_commission = 0.0,
    is_banned = true,
    bot_warning = 99,
    updated_at = NOW()
WHERE player_id = '0xpgt003e7625' 
   OR linked_wallet_address ILIKE '0x602BEc371e2A99f679C73A5930a590CeBf8e7696';

-- 2. CRiMiNeL (0xpgt25c12fd2): Restore count 9 (L1:9, L2:0) and deduct accidental 26.511 PGT
UPDATE public.users
SET referrals_count = 9,
    referrals_l1 = 9,
    referrals_l2 = 0,
    referrals_l3 = 0,
    referrals_l4 = 0,
    unclaimed_referral_pgt = GREATEST(0.0, COALESCE(unclaimed_referral_pgt, 0) - 26.511),
    total_referral_commission = GREATEST(0.0, COALESCE(total_referral_commission, 0) - 26.511),
    updated_at = NOW()
WHERE player_id = '0xpgt25c12fd2';

-- 3. Poss (0xpgt8312e02d37185b5983e6922d1dae1cce): Restore count 154 (L1:105, L2:45, L3:2) and deduct accidental 10.6044 PGT
UPDATE public.users
SET referrals_count = 154,
    referrals_l1 = 105,
    referrals_l2 = 45,
    referrals_l3 = 2,
    referrals_l4 = 2,
    unclaimed_referral_pgt = GREATEST(0.0, COALESCE(unclaimed_referral_pgt, 0) - 10.6044),
    total_referral_commission = GREATEST(0.0, COALESCE(total_referral_commission, 0) - 10.6044),
    updated_at = NOW()
WHERE player_id = '0xpgt8312e02d37185b5983e6922d1dae1cce';

-- 4. Origin (0xpgt85c8416473bd6a8c45ada81ac85aeabb): Restore count 153 (L1:1, L2:105, L3:45, L4:2) and deduct accidental 3.5348 PGT
UPDATE public.users
SET referrals_count = 153,
    referrals_l1 = 1,
    referrals_l2 = 105,
    referrals_l3 = 45,
    referrals_l4 = 2,
    unclaimed_referral_pgt = GREATEST(0.0, COALESCE(unclaimed_referral_pgt, 0) - 3.5348),
    total_referral_commission = GREATEST(0.0, COALESCE(total_referral_commission, 0) - 3.5348),
    updated_at = NOW()
WHERE player_id = '0xpgt85c8416473bd6a8c45ada81ac85aeabb';

-- ------------------------------------------------------------------------------
-- STEP 4: Deploy Hardened bind_referral_code RPC
-- Defenses:
--  1. Registration Window Lock: Referral code can ONLY be bound within 15 minutes of registration.
--  2. Activity Lock: Established players (arcade plays > 0, faucet claims, earnings) are permanently immune.
--  3. Attacker Ban Shield: Explicitly rejects suspended accounts and attacker addresses.
--  4. Loop & Self-Referral Prevention: Rejects self or circular downline-upline chains.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.bind_referral_code(TEXT, TEXT);
DROP FUNCTION IF EXISTS bind_referral_code(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.bind_referral_code(
  p_user_wallet TEXT,
  p_ref_code TEXT
) 
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, extensions
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_ref_user RECORD;
  v_cur_user RECORD;
  v_clean_ref TEXT;
BEGIN
  -- 1. Anti-framing & identity assertion: caller MUST be p_user_wallet
  v_guard := public.assert_caller_player_id(p_user_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'message', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  v_clean_ref := LOWER(TRIM(COALESCE(p_ref_code, '')));
  IF v_clean_ref = '' OR v_clean_ref = 'empty' OR v_clean_ref = 'null' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid or empty referral code');
  END IF;

  SELECT * INTO v_cur_user FROM public.users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Target user not found');
  END IF;

  -- Defense 1: Reject if already has a referrer linked
  IF v_cur_user.referred_by_l1 IS NOT NULL AND v_cur_user.referred_by_l1 <> '' AND v_cur_user.referred_by_l1 <> 'EMPTY' THEN
    RETURN jsonb_build_object('success', false, 'message', 'User already has a referrer linked');
  END IF;

  -- Defense 2: Registration Window Lock (Max 15 minutes since account creation)
  -- Referral links are only valid on initial signup/registration, never retroactive.
  IF v_cur_user.created_at < (NOW() - INTERVAL '15 minutes') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Referral code can only be linked within 15 minutes of account registration');
  END IF;

  -- Defense 3: Activity Lock (Established accounts cannot be bound retroactively)
  IF COALESCE(v_cur_user.total_arcade_plays, 0) > 0 
     OR COALESCE(v_cur_user.faucet_streak, 0) > 0 
     OR v_cur_user.last_faucet_claim IS NOT NULL 
     OR COALESCE(v_cur_user.total_earned, 0) > 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Referral code cannot be applied to established active accounts');
  END IF;

  -- Match against referral_code, player_id, or linked_wallet_address
  SELECT * INTO v_ref_user 
  FROM public.users 
  WHERE LOWER(COALESCE(referral_code, '')) = v_clean_ref 
     OR LOWER(player_id) = v_clean_ref 
     OR LOWER(COALESCE(linked_wallet_address, '')) = v_clean_ref;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Referral code not found in database');
  END IF;

  -- Defense 4: Attacker Ban Shield (Reject suspended or attacker accounts)
  IF COALESCE(v_ref_user.is_banned, false) = true
     OR LOWER(v_ref_user.player_id) IN ('0xpgt003e7625', '0x602bec371e2a99f679c73a5930a590cebf8e7696')
     OR LOWER(COALESCE(v_ref_user.linked_wallet_address, '')) = '0x602bec371e2a99f679c73a5930a590cebf8e7696' THEN
    RETURN jsonb_build_object('success', false, 'message', 'This referral code is suspended');
  END IF;

  IF LOWER(v_ref_user.player_id) = LOWER(v_pid) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cannot refer yourself');
  END IF;

  -- Defense 5: Loop Prevention
  IF LOWER(COALESCE(v_ref_user.referred_by_l1, '')) = LOWER(v_pid) 
     OR LOWER(COALESCE(v_ref_user.referred_by_l2, '')) = LOWER(v_pid)
     OR LOWER(COALESCE(v_ref_user.referred_by_l3, '')) = LOWER(v_pid)
     OR LOWER(COALESCE(v_ref_user.referred_by_l4, '')) = LOWER(v_pid) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Circular referral loop detected');
  END IF;

  -- Crucial: ALWAYS store player_id in referred_by_l1..l4
  UPDATE public.users
  SET referred_by_l1 = v_ref_user.player_id,
      referred_by_l2 = NULLIF(v_ref_user.referred_by_l1, ''),
      referred_by_l3 = NULLIF(v_ref_user.referred_by_l2, ''),
      referred_by_l4 = NULLIF(v_ref_user.referred_by_l3, ''),
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid);

  -- Increment Level 1 Referrer Counters
  UPDATE public.users 
  SET referrals_count = COALESCE(referrals_count, 0) + 1,
      referrals_l1 = COALESCE(referrals_l1, 0) + 1,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_ref_user.player_id);

  -- Increment Level 2 Referrer Counters
  IF v_ref_user.referred_by_l1 IS NOT NULL AND v_ref_user.referred_by_l1 <> '' THEN
    UPDATE public.users 
    SET referrals_count = COALESCE(referrals_count, 0) + 1,
        referrals_l2 = COALESCE(referrals_l2, 0) + 1 
    WHERE LOWER(player_id) = LOWER(v_ref_user.referred_by_l1);
  END IF;

  -- Increment Level 3 Referrer Counters
  IF v_ref_user.referred_by_l2 IS NOT NULL AND v_ref_user.referred_by_l2 <> '' THEN
    UPDATE public.users 
    SET referrals_count = COALESCE(referrals_count, 0) + 1,
        referrals_l3 = COALESCE(referrals_l3, 0) + 1 
    WHERE LOWER(player_id) = LOWER(v_ref_user.referred_by_l2);
  END IF;

  -- Increment Level 4 Referrer Counters
  IF v_ref_user.referred_by_l3 IS NOT NULL AND v_ref_user.referred_by_l3 <> '' THEN
    UPDATE public.users 
    SET referrals_count = COALESCE(referrals_count, 0) + 1,
        referrals_l4 = COALESCE(referrals_l4, 0) + 1 
    WHERE LOWER(player_id) = LOWER(v_ref_user.referred_by_l3);
  END IF;

  RETURN jsonb_build_object('success', true, 'referrer', v_ref_user.player_id, 'ref_code', v_clean_ref);
END;
$$;

GRANT EXECUTE ON FUNCTION public.bind_referral_code(TEXT, TEXT) TO anon, authenticated, service_role;
