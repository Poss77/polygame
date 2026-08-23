-- ====================================================================
-- SUPABASE RPC: reconcile_referral_trees
-- Self-healing maintenance procedure to audit, repair, and synchronize:
-- 1. 4-tier upstream referral chains (referred_by_l2, l3, l4 from l1)
-- 2. Downline counters (referrals_l1, l2, l3, l4, referrals_count)
-- ====================================================================

CREATE OR REPLACE FUNCTION reconcile_referral_trees()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
  v_changed BOOLEAN;
BEGIN
  -- 1. Audit and repair all upstream referral chains (L2, L3, L4 from L1 root)
  FOR r IN 
    SELECT player_id, linked_wallet_address, referred_by_l1, referred_by_l2, referred_by_l3, referred_by_l4
    FROM users 
    WHERE referred_by_l1 IS NOT NULL AND referred_by_l1 <> '' AND referred_by_l1 <> 'EMPTY'
  LOOP
    v_scanned_count := v_scanned_count + 1;
    v_changed := false;

    -- Fetch parent's upstream chain
    SELECT referred_by_l1, referred_by_l2, referred_by_l3
    INTO v_parent
    FROM users
    WHERE LOWER(player_id) = LOWER(r.referred_by_l1)
       OR (linked_wallet_address IS NOT NULL AND linked_wallet_address <> '' AND LOWER(linked_wallet_address) = LOWER(r.referred_by_l1))
    LIMIT 1;

    IF FOUND THEN
      v_expected_l2 := NULLIF(v_parent.referred_by_l1, '');
      v_expected_l3 := NULLIF(v_parent.referred_by_l2, '');
      v_expected_l4 := NULLIF(v_parent.referred_by_l3, '');

      -- Prevent self-loops
      IF v_expected_l2 = r.player_id OR v_expected_l2 = r.linked_wallet_address THEN v_expected_l2 := NULL; END IF;
      IF v_expected_l3 = r.player_id OR v_expected_l3 = r.linked_wallet_address THEN v_expected_l3 := NULL; END IF;
      IF v_expected_l4 = r.player_id OR v_expected_l4 = r.linked_wallet_address THEN v_expected_l4 := NULL; END IF;

      IF COALESCE(r.referred_by_l2, '') <> COALESCE(v_expected_l2, '') OR
         COALESCE(r.referred_by_l3, '') <> COALESCE(v_expected_l3, '') OR
         COALESCE(r.referred_by_l4, '') <> COALESCE(v_expected_l4, '') THEN
        
        UPDATE users
        SET referred_by_l2 = v_expected_l2,
            referred_by_l3 = v_expected_l3,
            referred_by_l4 = v_expected_l4
        WHERE player_id = r.player_id;

        v_repaired_chains := v_repaired_chains + 1;
      END IF;
    END IF;
  END LOOP;

  -- 2. Recalculate downline counters across all users
  UPDATE users u
  SET 
    referrals_l1 = (
      SELECT COUNT(*) FROM users 
      WHERE (LOWER(referred_by_l1) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(referred_by_l1) = LOWER(u.linked_wallet_address)))
    ),
    referrals_l2 = (
      SELECT COUNT(*) FROM users 
      WHERE (LOWER(referred_by_l2) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(referred_by_l2) = LOWER(u.linked_wallet_address)))
    ),
    referrals_l3 = (
      SELECT COUNT(*) FROM users 
      WHERE (LOWER(referred_by_l3) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(referred_by_l3) = LOWER(u.linked_wallet_address)))
    ),
    referrals_l4 = (
      SELECT COUNT(*) FROM users 
      WHERE (LOWER(referred_by_l4) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(referred_by_l4) = LOWER(u.linked_wallet_address)))
    );

  -- 3. Synchronize referrals_count total
  UPDATE users
  SET referrals_count = COALESCE(referrals_l1, 0) + COALESCE(referrals_l2, 0) + COALESCE(referrals_l3, 0) + COALESCE(referrals_l4, 0);

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

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION reconcile_referral_trees() TO authenticated, anon, service_role;
