-- ====================================================================
-- POLYGAME: REFERRAL COMMISSION SOURCE ACTIONS & DB 50-ITEM ROLLING CAP
-- ====================================================================

-- 1. Drop existing function signatures to prevent PostgreSQL parameter name conflict (42P13)
DROP FUNCTION IF EXISTS process_referral_commissions(text, numeric, text);
DROP FUNCTION IF EXISTS process_referral_commissions(text, numeric);
DROP FUNCTION IF EXISTS process_referral_commissions(text);

-- 2. Create updated process_referral_commissions RPC
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
  multiplier NUMERIC;
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

  -- Level 1 (10% base, 20% if VIP)
  IF ref_l1 IS NOT NULL AND ref_l1 <> '' AND ref_l1 <> claiming_wallet THEN
    multiplier := 1;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(wallet_address) = ref_l1;
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN
        multiplier := 2;
    END IF;
    comm_amount := claim_amount * 0.10 * multiplier;
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

  -- Level 2 (5% base, 10% if VIP)
  IF ref_l2 IS NOT NULL AND ref_l2 <> '' AND ref_l2 <> claiming_wallet THEN
    multiplier := 1;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(wallet_address) = ref_l2;
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN
        multiplier := 2;
    END IF;
    comm_amount := claim_amount * 0.05 * multiplier;
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

  -- Level 3 (2% base, 4% if VIP)
  IF ref_l3 IS NOT NULL AND ref_l3 <> '' AND ref_l3 <> claiming_wallet THEN
    multiplier := 1;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(wallet_address) = ref_l3;
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN
        multiplier := 2;
    END IF;
    comm_amount := claim_amount * 0.02 * multiplier;
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

  -- Level 4 (1% base, 2% if VIP)
  IF ref_l4 IS NOT NULL AND ref_l4 <> '' AND ref_l4 <> claiming_wallet THEN
    multiplier := 1;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(wallet_address) = ref_l4;
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN
        multiplier := 2;
    END IF;
    comm_amount := claim_amount * 0.01 * multiplier;
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
