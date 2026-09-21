-- ==============================================================================
-- Migration: upgrade_reconcile_referral_trees.sql
-- Description:
-- 1. Upgrades `public.reconcile_referral_trees(p_admin_passkey TEXT DEFAULT NULL)`
--    to perform full 4-tier tree audits, self-healing parent pointers (L2, L3, L4),
--    AND recalculating authoritative downline counts (referrals_l1..l4) and total
--    referrals_count = (l1 + l2 + l3 + l4) across all players.
-- 2. Automatically executes the reconciliation immediately upon running this script
--    to restore Origin's (and all other players') downline counts.
-- ==============================================================================

DROP FUNCTION IF EXISTS public.reconcile_referral_trees();
DROP FUNCTION IF EXISTS public.reconcile_referral_trees(TEXT);
DROP FUNCTION IF EXISTS reconcile_referral_trees();
DROP FUNCTION IF EXISTS reconcile_referral_trees(TEXT);

CREATE OR REPLACE FUNCTION public.reconcile_referral_trees(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_scanned_count INT := 0;
  v_repaired_chains INT := 0;
  v_updated_counters INT := 0;
  r RECORD;
  v_parent RECORD;
  v_expected_l2 TEXT;
  v_expected_l3 TEXT;
  v_expected_l4 TEXT;
BEGIN
  -- Strict Master Admin Passkey Verification
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Master Admin Passkey');
  END IF;

  -- 1. Audit and repair all upstream referral chains (L2, L3, L4 from L1 root)
  FOR r IN 
    SELECT player_id, linked_wallet_address, referred_by_l1, referred_by_l2, referred_by_l3, referred_by_l4
    FROM public.users 
    WHERE referred_by_l1 IS NOT NULL AND referred_by_l1 <> '' AND referred_by_l1 <> 'EMPTY'
  LOOP
    v_scanned_count := v_scanned_count + 1;

    -- Fetch parent's upstream chain
    SELECT referred_by_l1, referred_by_l2, referred_by_l3
    INTO v_parent
    FROM public.users
    WHERE LOWER(player_id) = LOWER(r.referred_by_l1)
       OR (linked_wallet_address IS NOT NULL AND linked_wallet_address <> '' AND LOWER(linked_wallet_address) = LOWER(r.referred_by_l1))
    LIMIT 1;

    IF FOUND THEN
      v_expected_l2 := NULLIF(v_parent.referred_by_l1, '');
      v_expected_l3 := NULLIF(v_parent.referred_by_l2, '');
      v_expected_l4 := NULLIF(v_parent.referred_by_l3, '');

      -- Prevent self-loops
      IF v_expected_l2 = r.player_id OR (r.linked_wallet_address IS NOT NULL AND v_expected_l2 = r.linked_wallet_address) THEN v_expected_l2 := NULL; END IF;
      IF v_expected_l3 = r.player_id OR (r.linked_wallet_address IS NOT NULL AND v_expected_l3 = r.linked_wallet_address) THEN v_expected_l3 := NULL; END IF;
      IF v_expected_l4 = r.player_id OR (r.linked_wallet_address IS NOT NULL AND v_expected_l4 = r.linked_wallet_address) THEN v_expected_l4 := NULL; END IF;

      IF COALESCE(r.referred_by_l2, '') IS DISTINCT FROM COALESCE(v_expected_l2, '') OR
         COALESCE(r.referred_by_l3, '') IS DISTINCT FROM COALESCE(v_expected_l3, '') OR
         COALESCE(r.referred_by_l4, '') IS DISTINCT FROM COALESCE(v_expected_l4, '') THEN
        
        UPDATE public.users
        SET referred_by_l2 = v_expected_l2,
            referred_by_l3 = v_expected_l3,
            referred_by_l4 = v_expected_l4,
            updated_at = NOW()
        WHERE player_id = r.player_id;

        v_repaired_chains := v_repaired_chains + 1;
      END IF;
    END IF;
  END LOOP;

  -- 2. Recalculate downline counters across all users
  UPDATE public.users u
  SET 
    referrals_l1 = (
      SELECT COUNT(*)::INT FROM public.users d
      WHERE (LOWER(d.referred_by_l1) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(d.referred_by_l1) = LOWER(u.linked_wallet_address)))
    ),
    referrals_l2 = (
      SELECT COUNT(*)::INT FROM public.users d
      WHERE (LOWER(d.referred_by_l2) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(d.referred_by_l2) = LOWER(u.linked_wallet_address)))
    ),
    referrals_l3 = (
      SELECT COUNT(*)::INT FROM public.users d
      WHERE (LOWER(d.referred_by_l3) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(d.referred_by_l3) = LOWER(u.linked_wallet_address)))
    ),
    referrals_l4 = (
      SELECT COUNT(*)::INT FROM public.users d
      WHERE (LOWER(d.referred_by_l4) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(d.referred_by_l4) = LOWER(u.linked_wallet_address)))
    );

  -- 3. Synchronize referrals_count total (L1 + L2 + L3 + L4)
  UPDATE public.users
  SET referrals_count = COALESCE(referrals_l1, 0) + COALESCE(referrals_l2, 0) + COALESCE(referrals_l3, 0) + COALESCE(referrals_l4, 0),
      updated_at = NOW();

  GET DIAGNOSTICS v_updated_counters = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'scanned_accounts', v_scanned_count,
    'repaired_chains', v_repaired_chains,
    'synchronized_users', v_updated_counters,
    'message', format('Referral reconciliation completed successfully: %s accounts scanned, %s chains repaired, %s downline counters synchronized.', v_scanned_count, v_repaired_chains, v_updated_counters)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_referral_trees(TEXT) TO anon, authenticated, service_role;

-- Execute immediate one-time reconciliation during migration
DO $$
DECLARE
  v_scanned_count INT := 0;
  v_repaired_chains INT := 0;
  v_updated_counters INT := 0;
  r RECORD;
  v_parent RECORD;
  v_expected_l2 TEXT;
  v_expected_l3 TEXT;
  v_expected_l4 TEXT;
BEGIN
  -- 1. Audit and repair all upstream referral chains (L2, L3, L4 from L1 root)
  FOR r IN 
    SELECT player_id, linked_wallet_address, referred_by_l1, referred_by_l2, referred_by_l3, referred_by_l4
    FROM public.users 
    WHERE referred_by_l1 IS NOT NULL AND referred_by_l1 <> '' AND referred_by_l1 <> 'EMPTY'
  LOOP
    v_scanned_count := v_scanned_count + 1;

    SELECT referred_by_l1, referred_by_l2, referred_by_l3
    INTO v_parent
    FROM public.users
    WHERE LOWER(player_id) = LOWER(r.referred_by_l1)
       OR (linked_wallet_address IS NOT NULL AND linked_wallet_address <> '' AND LOWER(linked_wallet_address) = LOWER(r.referred_by_l1))
    LIMIT 1;

    IF FOUND THEN
      v_expected_l2 := NULLIF(v_parent.referred_by_l1, '');
      v_expected_l3 := NULLIF(v_parent.referred_by_l2, '');
      v_expected_l4 := NULLIF(v_parent.referred_by_l3, '');

      IF v_expected_l2 = r.player_id OR (r.linked_wallet_address IS NOT NULL AND v_expected_l2 = r.linked_wallet_address) THEN v_expected_l2 := NULL; END IF;
      IF v_expected_l3 = r.player_id OR (r.linked_wallet_address IS NOT NULL AND v_expected_l3 = r.linked_wallet_address) THEN v_expected_l3 := NULL; END IF;
      IF v_expected_l4 = r.player_id OR (r.linked_wallet_address IS NOT NULL AND v_expected_l4 = r.linked_wallet_address) THEN v_expected_l4 := NULL; END IF;

      IF COALESCE(r.referred_by_l2, '') IS DISTINCT FROM COALESCE(v_expected_l2, '') OR
         COALESCE(r.referred_by_l3, '') IS DISTINCT FROM COALESCE(v_expected_l3, '') OR
         COALESCE(r.referred_by_l4, '') IS DISTINCT FROM COALESCE(v_expected_l4, '') THEN
        
        UPDATE public.users
        SET referred_by_l2 = v_expected_l2,
            referred_by_l3 = v_expected_l3,
            referred_by_l4 = v_expected_l4,
            updated_at = NOW()
        WHERE player_id = r.player_id;

        v_repaired_chains := v_repaired_chains + 1;
      END IF;
    END IF;
  END LOOP;

  -- 2. Recalculate downline counters across all users
  UPDATE public.users u
  SET 
    referrals_l1 = (
      SELECT COUNT(*)::INT FROM public.users d
      WHERE (LOWER(d.referred_by_l1) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(d.referred_by_l1) = LOWER(u.linked_wallet_address)))
    ),
    referrals_l2 = (
      SELECT COUNT(*)::INT FROM public.users d
      WHERE (LOWER(d.referred_by_l2) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(d.referred_by_l2) = LOWER(u.linked_wallet_address)))
    ),
    referrals_l3 = (
      SELECT COUNT(*)::INT FROM public.users d
      WHERE (LOWER(d.referred_by_l3) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(d.referred_by_l3) = LOWER(u.linked_wallet_address)))
    ),
    referrals_l4 = (
      SELECT COUNT(*)::INT FROM public.users d
      WHERE (LOWER(d.referred_by_l4) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(d.referred_by_l4) = LOWER(u.linked_wallet_address)))
    );

  -- 3. Synchronize referrals_count total (L1 + L2 + L3 + L4)
  UPDATE public.users
  SET referrals_count = COALESCE(referrals_l1, 0) + COALESCE(referrals_l2, 0) + COALESCE(referrals_l3, 0) + COALESCE(referrals_l4, 0),
      updated_at = NOW();

  GET DIAGNOSTICS v_updated_counters = ROW_COUNT;

  RAISE NOTICE 'Initial migration reconciliation complete: % scanned, % chains repaired, % counters synchronized.', v_scanned_count, v_repaired_chains, v_updated_counters;
END;
$$;

-- Verification: Display restored referral counters for Origin and Poss
SELECT player_id, username, referrals_count AS total_downlines, referrals_l1, referrals_l2, referrals_l3, referrals_l4
FROM public.users
WHERE LOWER(linked_wallet_address) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
   OR LOWER(player_id) = '0xpgt85c8416473bd6a8c45ada81ac85aeabb'
   OR username IN ('Origin', 'Poss');

