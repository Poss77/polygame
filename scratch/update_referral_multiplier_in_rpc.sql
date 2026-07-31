-- ====================================================================
-- POLYGAME: FULL REFERRAL & AMBASSADOR MULTIPLIER INTEGRATION IN RPC
-- ====================================================================

-- 1. Drop existing process_referral_commissions function signatures to prevent 42P13 parameter conflict
DROP FUNCTION IF EXISTS process_referral_commissions(text, numeric, text);
DROP FUNCTION IF EXISTS process_referral_commissions(text, numeric);
DROP FUNCTION IF EXISTS process_referral_commissions(text);

-- 2. Create helper function to compute user's combined Referral Multiplier (NFTs + Ambassador)
CREATE OR REPLACE FUNCTION get_user_referral_multiplier(p_wallet TEXT) 
RETURNS NUMERIC AS $$
DECLARE
  v_is_ambassador BOOLEAN := false;
  v_nfts JSONB := '[]'::jsonb;
  v_mult NUMERIC := 1.0;
  v_nft_id TEXT;
BEGIN
  IF p_wallet IS NULL OR p_wallet = '' THEN
    RETURN 1.0;
  END IF;

  SELECT 
    COALESCE(is_ambassador, false), 
    COALESCE(owned_nfts, '[]'::jsonb) || COALESCE(crate_nfts, '[]'::jsonb)
  INTO 
    v_is_ambassador, 
    v_nfts
  FROM users WHERE lower(wallet_address) = lower(p_wallet);

  -- Ambassador status grants 1.5x (+50%) Referral Bonus
  IF v_is_ambassador THEN
    v_mult := v_mult * 1.5;
  END IF;

  -- Multiply by Referral Utility NFTs
  IF v_nfts IS NOT NULL AND jsonb_typeof(v_nfts) = 'array' THEN
    FOR v_nft_id IN SELECT jsonb_array_elements_text(v_nfts) LOOP
      IF v_nft_id = 'nft_referral_beacon' THEN
        v_mult := v_mult * 1.1;
      ELSIF v_nft_id = 'nft_affiliate_guild' THEN
        v_mult := v_mult * 1.5;
      ELSIF v_nft_id = 'nft_legendary_king' THEN
        v_mult := v_mult * 2.0;
      END IF;
    END LOOP;
  END IF;

  RETURN v_mult;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create updated process_referral_commissions RPC incorporating VIP (2x) & NFT/Ambassador Multipliers
CREATE OR REPLACE FUNCTION process_referral_commissions(
  claiming_wallet TEXT,
  claim_amount NUMERIC,
  claim_action TEXT DEFAULT 'Referral Commission'
) RETURNS void AS $$
DECLARE
  ref_l1 TEXT;
  ref_l2 TEXT;
  ref_l3 TEXT;
  ref_l4 TEXT;
  vip_expiry TIMESTAMPTZ;
  vip_mult NUMERIC;
  ref_mult NUMERIC;
  comm_amount NUMERIC;
  player_name TEXT;
  time_str TEXT;
  action_str TEXT;
  new_entry JSONB;
BEGIN
  -- Normalize wallet address
  claiming_wallet := lower(claiming_wallet);

  -- Prevent zero or negative amounts
  IF claim_amount IS NULL OR claim_amount <= 0 THEN
    RETURN;
  END IF;

  -- Fetch the 4-tier downline structure of the claiming user
  SELECT 
    lower(referred_by_l1),
    lower(referred_by_l2),
    lower(referred_by_l3),
    lower(referred_by_l4)
  INTO
    ref_l1,
    ref_l2,
    ref_l3,
    ref_l4
  FROM users WHERE lower(wallet_address) = claiming_wallet;

  player_name := 'Player_' || substring(claiming_wallet from 3 for 6);
  time_str := to_char(now(), 'HH12:MI:SS AM');
  action_str := COALESCE(claim_action, 'Referral Commission');

  -- Level 1 (10% base, 20% if VIP, multiplied by NFT/Ambassador multiplier)
  IF ref_l1 IS NOT NULL AND ref_l1 <> '' AND ref_l1 <> claiming_wallet THEN
    vip_mult := 1.0;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(wallet_address) = ref_l1;
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN
        vip_mult := 2.0;
    END IF;
    
    ref_mult := get_user_referral_multiplier(ref_l1);
    comm_amount := claim_amount * 0.10 * vip_mult * ref_mult;

    new_entry := jsonb_build_object(
      'name', player_name,
      'level', 1,
      'action', action_str,
      'commission', comm_amount,
      'time', time_str
    );
    UPDATE users SET 
      unclaimed_referral_pgt = COALESCE(unclaimed_referral_pgt, 0) + comm_amount,
      total_referral_commission = COALESCE(total_referral_commission, 0) + comm_amount,
      referrals_list = (
        SELECT jsonb_agg(elem)
        FROM (
          SELECT elem
          FROM jsonb_array_elements(jsonb_build_array(new_entry) || COALESCE(referrals_list, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
          ORDER BY ord ASC
          LIMIT 50
        ) sub
      )
    WHERE lower(wallet_address) = ref_l1;
  END IF;

  -- Level 2 (5% base, 10% if VIP, multiplied by NFT/Ambassador multiplier)
  IF ref_l2 IS NOT NULL AND ref_l2 <> '' AND ref_l2 <> claiming_wallet THEN
    vip_mult := 1.0;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(wallet_address) = ref_l2;
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN
        vip_mult := 2.0;
    END IF;
    
    ref_mult := get_user_referral_multiplier(ref_l2);
    comm_amount := claim_amount * 0.05 * vip_mult * ref_mult;

    new_entry := jsonb_build_object(
      'name', player_name,
      'level', 2,
      'action', action_str,
      'commission', comm_amount,
      'time', time_str
    );
    UPDATE users SET 
      unclaimed_referral_pgt = COALESCE(unclaimed_referral_pgt, 0) + comm_amount,
      total_referral_commission = COALESCE(total_referral_commission, 0) + comm_amount,
      referrals_list = (
        SELECT jsonb_agg(elem)
        FROM (
          SELECT elem
          FROM jsonb_array_elements(jsonb_build_array(new_entry) || COALESCE(referrals_list, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
          ORDER BY ord ASC
          LIMIT 50
        ) sub
      )
    WHERE lower(wallet_address) = ref_l2;
  END IF;

  -- Level 3 (2% base, 4% if VIP, multiplied by NFT/Ambassador multiplier)
  IF ref_l3 IS NOT NULL AND ref_l3 <> '' AND ref_l3 <> claiming_wallet THEN
    vip_mult := 1.0;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(wallet_address) = ref_l3;
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN
        vip_mult := 2.0;
    END IF;
    
    ref_mult := get_user_referral_multiplier(ref_l3);
    comm_amount := claim_amount * 0.02 * vip_mult * ref_mult;

    new_entry := jsonb_build_object(
      'name', player_name,
      'level', 3,
      'action', action_str,
      'commission', comm_amount,
      'time', time_str
    );
    UPDATE users SET 
      unclaimed_referral_pgt = COALESCE(unclaimed_referral_pgt, 0) + comm_amount,
      total_referral_commission = COALESCE(total_referral_commission, 0) + comm_amount,
      referrals_list = (
        SELECT jsonb_agg(elem)
        FROM (
          SELECT elem
          FROM jsonb_array_elements(jsonb_build_array(new_entry) || COALESCE(referrals_list, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
          ORDER BY ord ASC
          LIMIT 50
        ) sub
      )
    WHERE lower(wallet_address) = ref_l3;
  END IF;

  -- Level 4 (1% base, 2% if VIP, multiplied by NFT/Ambassador multiplier)
  IF ref_l4 IS NOT NULL AND ref_l4 <> '' AND ref_l4 <> claiming_wallet THEN
    vip_mult := 1.0;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(wallet_address) = ref_l4;
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN
        vip_mult := 2.0;
    END IF;
    
    ref_mult := get_user_referral_multiplier(ref_l4);
    comm_amount := claim_amount * 0.01 * vip_mult * ref_mult;

    new_entry := jsonb_build_object(
      'name', player_name,
      'level', 4,
      'action', action_str,
      'commission', comm_amount,
      'time', time_str
    );
    UPDATE users SET 
      unclaimed_referral_pgt = COALESCE(unclaimed_referral_pgt, 0) + comm_amount,
      total_referral_commission = COALESCE(total_referral_commission, 0) + comm_amount,
      referrals_list = (
        SELECT jsonb_agg(elem)
        FROM (
          SELECT elem
          FROM jsonb_array_elements(jsonb_build_array(new_entry) || COALESCE(referrals_list, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
          ORDER BY ord ASC
          LIMIT 50
        ) sub
      )
    WHERE lower(wallet_address) = ref_l4;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
