-- ====================================================================
-- SUPABASE RPC: process_referral_commissions (Usernames & Accurate Actions)
-- 1. Resolves real username (if not NULL/EMPTY) instead of raw Player_0x...
-- 2. Accurately stores action, timestamp, level, and commission
-- 3. 50-item rolling limit per user
-- ====================================================================

DROP FUNCTION IF EXISTS process_referral_commissions(text, numeric, text);
DROP FUNCTION IF EXISTS process_referral_commissions(text, numeric);
DROP FUNCTION IF EXISTS process_referral_commissions(text);

CREATE OR REPLACE FUNCTION process_referral_commissions(
  claiming_wallet TEXT,
  claim_amount NUMERIC,
  claim_action TEXT DEFAULT 'General Activity'
) RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(claiming_wallet);
  ref_l1 TEXT;
  ref_l2 TEXT;
  ref_l3 TEXT;
  ref_l4 TEXT;
  vip_expiry TIMESTAMPTZ;
  multiplier NUMERIC;
  comm_amount NUMERIC;
  player_name TEXT;
  user_raw_name TEXT;
  time_str TEXT;
  action_str TEXT;
  new_entry JSONB;
BEGIN
  -- Prevent zero or negative amounts
  IF claim_amount IS NULL OR claim_amount <= 0 THEN
    RETURN;
  END IF;

  -- Fetch the claiming user's username and 4-tier downline upline
  SELECT 
    lower(referred_by_l1),
    lower(referred_by_l2),
    lower(referred_by_l3),
    lower(referred_by_l4),
    username
  INTO
    ref_l1,
    ref_l2,
    ref_l3,
    ref_l4,
    user_raw_name
  FROM users 
  WHERE lower(player_id) = lower(v_pid)
     OR lower(COALESCE(linked_wallet_address, '')) = lower(v_pid)
  LIMIT 1;

  -- Determine display name: use username if valid and not EMPTY
  IF user_raw_name IS NOT NULL AND TRIM(user_raw_name) <> '' AND UPPER(TRIM(user_raw_name)) <> 'EMPTY' THEN
    player_name := TRIM(user_raw_name);
  ELSE
    player_name := 'Player_' || substring(v_pid from 1 for 8);
  END IF;

  time_str := to_char(now(), 'HH12:MI:SS AM');
  action_str := COALESCE(claim_action, 'Referral Commission');

  -- LEVEL 1 (10% base, 20% if VIP)
  IF ref_l1 IS NOT NULL AND ref_l1 <> '' AND ref_l1 <> lower(v_pid) THEN
    multiplier := 1;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(player_id) = resolve_player_id(ref_l1);
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN multiplier := 2; END IF;
    comm_amount := ROUND(claim_amount * 0.10 * multiplier, 4);

    new_entry := jsonb_build_object(
      'name', player_name,
      'player_id', v_pid,
      'level', 1,
      'action', action_str,
      'commission', comm_amount,
      'time', time_str,
      'created_at', now()
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
    WHERE lower(player_id) = resolve_player_id(ref_l1);
  END IF;

  -- LEVEL 2 (5% base, 10% if VIP)
  IF ref_l2 IS NOT NULL AND ref_l2 <> '' AND ref_l2 <> lower(v_pid) THEN
    multiplier := 1;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(player_id) = resolve_player_id(ref_l2);
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN multiplier := 2; END IF;
    comm_amount := ROUND(claim_amount * 0.05 * multiplier, 4);

    new_entry := jsonb_build_object(
      'name', player_name,
      'player_id', v_pid,
      'level', 2,
      'action', action_str,
      'commission', comm_amount,
      'time', time_str,
      'created_at', now()
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
    WHERE lower(player_id) = resolve_player_id(ref_l2);
  END IF;

  -- LEVEL 3 (2% base, 4% if VIP)
  IF ref_l3 IS NOT NULL AND ref_l3 <> '' AND ref_l3 <> lower(v_pid) THEN
    multiplier := 1;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(player_id) = resolve_player_id(ref_l3);
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN multiplier := 2; END IF;
    comm_amount := ROUND(claim_amount * 0.02 * multiplier, 4);

    new_entry := jsonb_build_object(
      'name', player_name,
      'player_id', v_pid,
      'level', 3,
      'action', action_str,
      'commission', comm_amount,
      'time', time_str,
      'created_at', now()
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
    WHERE lower(player_id) = resolve_player_id(ref_l3);
  END IF;

  -- LEVEL 4 (1% base, 2% if VIP)
  IF ref_l4 IS NOT NULL AND ref_l4 <> '' AND ref_l4 <> lower(v_pid) THEN
    multiplier := 1;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(player_id) = resolve_player_id(ref_l4);
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN multiplier := 2; END IF;
    comm_amount := ROUND(claim_amount * 0.01 * multiplier, 4);

    new_entry := jsonb_build_object(
      'name', player_name,
      'player_id', v_pid,
      'level', 4,
      'action', action_str,
      'commission', comm_amount,
      'time', time_str,
      'created_at', now()
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
    WHERE lower(player_id) = resolve_player_id(ref_l4);
  END IF;

END;
$$;

GRANT EXECUTE ON FUNCTION process_referral_commissions(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;
