-- ==============================================================================
-- POLYGAME REMEDIATION: PURGE FAKE VIP PASSES & FAKE POL REFERRAL COMMISSIONS
-- ==============================================================================
-- 1. Cleans Dobby's exploited inventory (removes 11 fake VIP passes & exploited relic seeker)
-- 2. Purges fraudulent POL referral commissions credited to CRiMiNeL
-- 3. Cancels the unearned 990.5 POL pending payout request in pol_payout_requests
-- 4. Restores CRiMiNeL referral totals and filters out fraudulent referral_list entries
-- 5. Hardens credit_nft_referral_commission: eliminates direct inventory grants and
--    restricts execution strictly to service_role (preventing unverified client calls)
-- ==============================================================================

-- 1. PURGE DOBBY'S EXPLOITED CRATE INVENTORY
UPDATE public.users
SET crate_nfts = '[]'::jsonb,
    updated_at = NOW()
WHERE player_id = '0xpgt003e7625'
   OR LOWER(linked_wallet_address) = '0x602bec371e2a99f679c73a5930a590cebf8e7696';

-- 2. PURGE FAKE POL COMMISSIONS IN DATABASE
DELETE FROM public.pol_referral_commissions
WHERE buyer_wallet = '0xpgt003e7625'
   OR LOWER(buyer_wallet) = '0x602bec371e2a99f679c73a5930a590cebf8e7696';

-- 3. CANCEL FRAUDULENT PENDING POL PAYOUT REQUEST
UPDATE public.pol_payout_requests
SET status = 'cancelled',
    processed_at = NOW()
WHERE id = 'a7900d99-6610-403b-b495-b7505525ab6e'
   OR (wallet_address = '0xc5f35a414c14e4c78a5858ad6edb7e049e0edf6c' AND status = 'pending');

-- 4. RESTORE CRIMINEL'S REFERRAL POL BALANCE & RECONCILE ACTIVITY LIST
UPDATE public.users
SET unclaimed_referral_pol = 0.0,
    total_referral_pol = 0.0,
    referrals_list = (
      SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      FROM jsonb_array_elements(referrals_list) AS elem
      WHERE NOT (elem->>'player_id' = '0xpgt003e7625' AND elem->>'currency' = 'POL')
    ),
    updated_at = NOW()
WHERE player_id = '0xpgt25c12fd2'
   OR LOWER(linked_wallet_address) = '0xc5f35a414c14e4c78a5858ad6edb7e049e0edf6c';

-- 5. HARDEN credit_nft_referral_commission RPC: SERVICE ROLE ONLY & NO INVENTORY GRANTS
DROP FUNCTION IF EXISTS public.credit_nft_referral_commission(TEXT, NUMERIC, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS credit_nft_referral_commission(TEXT, NUMERIC, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.credit_nft_referral_commission(
  buyer_wallet TEXT,
  item_name TEXT,
  pol_price NUMERIC,
  p_tx_hash TEXT DEFAULT NULL,
  p_item_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_buyer RECORD;
  v_parent RECORD;
  v_buyer_id TEXT;
  v_parent_id TEXT;
  v_resolved_item_id TEXT;
  v_catalog_price NUMERIC;
  v_commission NUMERIC;
  v_buyer_name TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_time_str TEXT := TO_CHAR(NOW(), 'HH12:MI:SS AM');
  v_action_str TEXT;
  v_new_entry JSONB;
  v_clean_hash TEXT := LOWER(TRIM(COALESCE(p_tx_hash, '')));
  v_guard RECORD;
BEGIN
  -- 1. Anti-Cheat: Require valid EVM transaction hash format (64-char hex with 0x)
  IF v_clean_hash = '' OR v_clean_hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Transaction hash required for on-chain referral verification');
  END IF;

  IF NOT (v_clean_hash ~ '^0x[a-f0-9]{64}$') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Invalid EVM transaction hash format');
  END IF;

  -- 2. Anti-Replay: Check if transaction hash has already been credited
  IF EXISTS (SELECT 1 FROM public.pol_referral_commissions WHERE LOWER(tx_hash) = v_clean_hash) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Transaction hash has already been credited for referral commission');
  END IF;

  -- 3. Authoritative Catalog Item & Price Resolution
  IF p_item_id IS NOT NULL AND TRIM(p_item_id) <> '' THEN
    v_resolved_item_id := LOWER(TRIM(p_item_id));
  ELSE
    IF LOWER(item_name) LIKE '%copper core%' THEN v_resolved_item_id := 'nft_common_boost';
    ELSIF LOWER(item_name) LIKE '%silver charger%' THEN v_resolved_item_id := 'nft_silver_charger';
    ELSIF LOWER(item_name) LIKE '%gold turbine%' THEN v_resolved_item_id := 'nft_gold_turbine';
    ELSIF LOWER(item_name) LIKE '%viper shield%' THEN v_resolved_item_id := 'nft_rare_shield';
    ELSIF LOWER(item_name) LIKE '%pulse blaster%' THEN v_resolved_item_id := 'nft_pulse_blaster';
    ELSIF LOWER(item_name) LIKE '%apex matrix%' THEN v_resolved_item_id := 'nft_epic_yield';
    ELSIF LOWER(item_name) LIKE '%referral beacon%' THEN v_resolved_item_id := 'nft_referral_beacon';
    ELSIF LOWER(item_name) LIKE '%affiliate guild%' THEN v_resolved_item_id := 'nft_affiliate_guild';
    ELSIF LOWER(item_name) LIKE '%omni lord%' THEN v_resolved_item_id := 'nft_legendary_king';
    ELSIF LOWER(item_name) LIKE '%rare yield vault%' THEN v_resolved_item_id := 'nft_yield_vault_rare';
    ELSIF LOWER(item_name) LIKE '%epic yield vault%' THEN v_resolved_item_id := 'nft_yield_vault_epic';
    ELSIF LOWER(item_name) LIKE '%yield vault%' THEN v_resolved_item_id := 'nft_yield_vault';
    ELSIF LOWER(item_name) LIKE '%yearly%' OR LOWER(item_name) LIKE '%365%' THEN v_resolved_item_id := 'nft_vip_pass_yearly';
    ELSIF LOWER(item_name) LIKE '%vip%' THEN v_resolved_item_id := 'nft_vip_pass';
    ELSE v_resolved_item_id := NULL;
    END IF;
  END IF;

  CASE v_resolved_item_id
    WHEN 'nft_common_boost' THEN v_catalog_price := 5.0;
    WHEN 'nft_silver_charger' THEN v_catalog_price := 15.0;
    WHEN 'nft_gold_turbine' THEN v_catalog_price := 40.0;
    WHEN 'nft_rare_shield' THEN v_catalog_price := 15.0;
    WHEN 'nft_pulse_blaster' THEN v_catalog_price := 40.0;
    WHEN 'nft_epic_yield' THEN v_catalog_price := 60.0;
    WHEN 'nft_referral_beacon' THEN v_catalog_price := 10.0;
    WHEN 'nft_affiliate_guild' THEN v_catalog_price := 100.0;
    WHEN 'nft_legendary_king' THEN v_catalog_price := 300.0;
    WHEN 'nft_yield_vault' THEN v_catalog_price := 50.0;
    WHEN 'nft_yield_vault_rare' THEN v_catalog_price := 150.0;
    WHEN 'nft_yield_vault_epic' THEN v_catalog_price := 300.0;
    WHEN 'nft_vip_pass' THEN v_catalog_price := 100.0;
    WHEN 'nft_vip_pass_yearly' THEN v_catalog_price := 900.0;
    ELSE v_catalog_price := NULL;
  END CASE;

  IF v_catalog_price IS NULL OR v_resolved_item_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Unrecognized or non-commissionable NFT catalog item');
  END IF;

  v_commission := ROUND(v_catalog_price * 0.10, 4);

  -- 4. Locate buyer record
  v_buyer_id := resolve_player_id(buyer_wallet);
  IF v_buyer_id IS NULL OR v_buyer_id = '' THEN
    v_buyer_id := LOWER(TRIM(buyer_wallet));
  END IF;

  SELECT player_id, linked_wallet_address, username, referred_by_l1
  INTO v_buyer
  FROM public.users
  WHERE player_id = v_buyer_id
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(TRIM(buyer_wallet))
     OR LOWER(player_id) = LOWER(TRIM(buyer_wallet))
  LIMIT 1;

  IF v_buyer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Buyer not found');
  END IF;

  -- 5. Check for Level 1 referrer
  IF v_buyer.referred_by_l1 IS NULL OR TRIM(v_buyer.referred_by_l1) = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'No Level 1 referrer assigned');
  END IF;

  v_parent_id := resolve_player_id(v_buyer.referred_by_l1);
  IF v_parent_id IS NULL OR v_parent_id = '' THEN
    v_parent_id := LOWER(TRIM(v_buyer.referred_by_l1));
  END IF;

  -- Prevent self-referral loop
  IF LOWER(v_parent_id) = LOWER(v_buyer.player_id) OR 
     (v_buyer.linked_wallet_address IS NOT NULL AND LOWER(v_parent_id) = LOWER(v_buyer.linked_wallet_address)) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Self referral prohibited');
  END IF;

  -- 6. Lock and fetch parent referrer record
  SELECT player_id, linked_wallet_address, username, unclaimed_referral_pol, total_referral_pol, referrals_list
  INTO v_parent
  FROM public.users
  WHERE player_id = v_parent_id
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(TRIM(v_buyer.referred_by_l1))
     OR LOWER(player_id) = LOWER(TRIM(v_buyer.referred_by_l1))
  FOR UPDATE;

  IF v_parent IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Referrer account not found');
  END IF;

  -- 7. Format display name & action string
  IF v_buyer.username IS NOT NULL AND TRIM(v_buyer.username) <> '' AND UPPER(TRIM(v_buyer.username)) <> 'EMPTY' THEN
    v_buyer_name := TRIM(v_buyer.username);
  ELSE
    v_buyer_name := 'Player_' || SUBSTRING(v_buyer.player_id FROM 1 FOR 8);
  END IF;

  v_action_str := COALESCE(NULLIF(TRIM(item_name), ''), v_resolved_item_id);

  -- 8. Atomic replay defense insertion
  INSERT INTO public.pol_referral_commissions (
    tx_hash,
    buyer_wallet,
    referrer_player_id,
    amount_pol,
    commission_pol,
    item_name,
    created_at
  )
  VALUES (
    v_clean_hash,
    v_buyer.player_id,
    v_parent.player_id,
    v_catalog_price,
    v_commission,
    v_action_str,
    v_now
  );

  -- 9. Prepare referrer activity feed log entry
  v_new_entry := jsonb_build_object(
    'name', v_buyer_name,
    'player_id', v_buyer.player_id,
    'level', 1,
    'action', v_action_str,
    'commission', v_commission,
    'currency', 'POL',
    'time', v_time_str,
    'created_at', v_now
  );

  -- 10. Update Referrer POL balances
  UPDATE public.users
  SET 
    unclaimed_referral_pol = COALESCE(unclaimed_referral_pol, 0) + v_commission,
    total_referral_pol = COALESCE(total_referral_pol, 0) + v_commission,
    referrals_list = (
      SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(jsonb_build_array(v_new_entry) || COALESCE(v_parent.referrals_list, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
        ORDER BY ord ASC
        LIMIT 50
      ) sub
    ),
    updated_at = v_now
  WHERE player_id = v_parent.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_parent.player_id,
    'commission_pol', v_commission,
    'catalog_price', v_catalog_price,
    'item_id', v_resolved_item_id,
    'buyer', v_buyer_name,
    'action', v_action_str,
    'tx_hash', v_clean_hash
  );
END;
$$;

-- STRICT ACCESS CONTROL: SERVICE ROLE ONLY
REVOKE ALL ON FUNCTION public.credit_nft_referral_commission(TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_nft_referral_commission(TEXT, TEXT, NUMERIC, TEXT, TEXT) TO service_role;
