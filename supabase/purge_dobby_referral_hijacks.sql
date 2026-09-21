-- ==============================================================================
-- Migration: purge_dobby_referral_hijacks.sql
-- Description: 
-- 1. Deletes the 4 dummy test/bot accounts created by Dobby:
--    ('0xprobad123', '__TEST__', '0xpen_test_bot_999999', '0xpgtbypasslkdc45ed')
-- 2. Restores the 35 real player accounts (including Origin/Master Admin, Fly, 
--    gincha, Theo, Jestag) whose upline was falsely hijacked to '0xpgt003e7625',
--    resetting their referred_by_l1..l4 back to NULL (their original organic state).
-- 3. Resets Dobby's referral metrics (referrals_count, commissions) to 0.
-- 4. Rebuilds accurate referral counts for all legitimate players.
-- ==============================================================================

DO $$
DECLARE
  v_dobby_pid TEXT := '0xpgt003e7625';
  v_dobby_wallet TEXT := '0x602bec371e2a99f679c73a5930a590cebf8e7696';
BEGIN
  -- 1. Delete known test / pen-test bot accounts created by Dobby
  DELETE FROM public.users
  WHERE player_id IN (
    '0xprobad123',
    '__TEST__',
    '0xpen_test_bot_999999',
    '0xpgtbypasslkdc45ed'
  );

  -- 2. Reset hijacked referral uplines back to NULL for legitimate organic players
  UPDATE public.users
  SET referred_by_l1 = NULL,
      referred_by_l2 = NULL,
      referred_by_l3 = NULL,
      referred_by_l4 = NULL
  WHERE LOWER(referred_by_l1) IN (LOWER(v_dobby_pid), LOWER(v_dobby_wallet))
     OR LOWER(referred_by_l1) LIKE '%003e7625%'
     OR LOWER(referred_by_l1) LIKE '%602bec%';

  -- 3. Strip all referral counts, trees, and illicit commissions from Dobby's account
  UPDATE public.users
  SET referrals_count = 0,
      referrals_l1 = 0,
      referrals_l2 = 0,
      referrals_l3 = 0,
      referrals_l4 = 0,
      referrals_list = '[]'::jsonb,
      total_referral_commission = 0.0,
      unclaimed_referral_pgt = 0.0,
      total_referral_pol = 0.0,
      unclaimed_vip_faucet_pol = 0.0,
      is_banned = true,
      bot_warning = 100
  WHERE player_id = v_dobby_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_dobby_wallet);

  -- 4. Recalculate true referrals_count and referrals_l1 for all legitimate players
  UPDATE public.users u
  SET referrals_l1 = sub.l1_count,
      referrals_count = sub.l1_count
  FROM (
    SELECT 
      COALESCE(p.player_id, LOWER(p.linked_wallet_address)) AS parent_id,
      COUNT(*)::INT AS l1_count
    FROM public.users d
    JOIN public.users p ON (
      LOWER(d.referred_by_l1) = LOWER(p.player_id)
      OR (p.linked_wallet_address IS NOT NULL AND LOWER(d.referred_by_l1) = LOWER(p.linked_wallet_address))
    )
    WHERE d.referred_by_l1 IS NOT NULL AND d.referred_by_l1 <> ''
    GROUP BY COALESCE(p.player_id, LOWER(p.linked_wallet_address))
  ) sub
  WHERE u.player_id = sub.parent_id
     OR LOWER(COALESCE(u.linked_wallet_address, '')) = LOWER(sub.parent_id);

  -- Ensure any user with 0 downlines has count 0
  UPDATE public.users
  SET referrals_count = 0,
      referrals_l1 = 0
  WHERE player_id NOT IN (
    SELECT DISTINCT p.player_id
    FROM public.users d
    JOIN public.users p ON (
      LOWER(d.referred_by_l1) = LOWER(p.player_id)
      OR (p.linked_wallet_address IS NOT NULL AND LOWER(d.referred_by_l1) = LOWER(p.linked_wallet_address))
    )
    WHERE d.referred_by_l1 IS NOT NULL AND d.referred_by_l1 <> ''
  );

  RAISE NOTICE 'Dobby fake referral links and test bots successfully purged and cleaned.';
END;
$$;
