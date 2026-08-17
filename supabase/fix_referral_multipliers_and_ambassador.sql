-- ====================================================================
-- POLYGAME: FULL 4.95x REFERRAL COMMISSION MULTIPLIER RPC ENGINE
-- Incorporates:
-- 1. VIP 2.0x Multiplier
-- 2. Official Ambassador 1.5x Multiplier
-- 3. Utility NFT Passive Multipliers (Beacon 1.1x * Affiliate Guild 1.5x = 1.65x, Omni Lord 2.0x)
-- Total Combined Referral Boost = 2.0 * 1.5 * 1.65 = 4.95x!
-- ====================================================================

-- 1. Helper function: Compute user's combined Referral Multiplier (NFTs + Ambassador)
CREATE OR REPLACE FUNCTION get_user_referral_multiplier(p_wallet TEXT) 
RETURNS NUMERIC 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_is_ambassador BOOLEAN := false;
  v_nfts JSONB := '[]'::jsonb;
  v_crates JSONB := '[]'::jsonb;
  v_mult NUMERIC := 1.0;
  v_nft_id TEXT;
  v_seen TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF p_wallet IS NULL OR p_wallet = '' THEN
    RETURN 1.0;
  END IF;

  SELECT 
    COALESCE(is_ambassador, false), 
    COALESCE(owned_nfts, '[]'::jsonb),
    COALESCE(crate_nfts, '[]'::jsonb)
  INTO 
    v_is_ambassador, 
    v_nfts,
    v_crates
  FROM users 
  WHERE lower(player_id) = lower(v_pid)
     OR lower(COALESCE(linked_wallet_address, '')) = lower(v_pid)
  LIMIT 1;

  -- Ambassador status grants 1.5x (+50%) Referral Bonus
  IF v_is_ambassador THEN
    v_mult := v_mult * 1.5;
  END IF;

  -- Multiply by Referral Utility NFTs (applied once per unique core type)
  IF v_nfts IS NOT NULL AND jsonb_typeof(v_nfts) = 'array' THEN
    FOR v_nft_id IN SELECT jsonb_array_elements_text(v_nfts) LOOP
      IF NOT (v_seen @> ARRAY[v_nft_id]) THEN
        v_seen := array_append(v_seen, v_nft_id);
        IF v_nft_id = 'nft_referral_beacon' THEN
          v_mult := v_mult * 1.10;
        ELSIF v_nft_id = 'nft_affiliate_guild' THEN
          v_mult := v_mult * 1.50;
        ELSIF v_nft_id = 'nft_legendary_king' THEN
          v_mult := v_mult * 2.00;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF v_crates IS NOT NULL AND jsonb_typeof(v_crates) = 'array' THEN
    FOR v_nft_id IN SELECT jsonb_array_elements_text(v_crates) LOOP
      IF NOT (v_seen @> ARRAY[v_nft_id]) THEN
        v_seen := array_append(v_seen, v_nft_id);
        IF v_nft_id = 'nft_referral_beacon' THEN
          v_mult := v_mult * 1.10;
        ELSIF v_nft_id = 'nft_affiliate_guild' THEN
          v_mult := v_mult * 1.50;
        ELSIF v_nft_id = 'nft_legendary_king' THEN
          v_mult := v_mult * 2.00;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN v_mult;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_referral_multiplier(TEXT) TO anon, authenticated, service_role;


-- 2. Drop existing function signatures to prevent 42P13 parameter mismatch
DROP FUNCTION IF EXISTS process_referral_commissions(text, numeric, text);
DROP FUNCTION IF EXISTS process_referral_commissions(text, numeric);
DROP FUNCTION IF EXISTS process_referral_commissions(text);

-- 3. Full process_referral_commissions RPC
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
  vip_mult NUMERIC;
  ref_bonus_mult NUMERIC;
  total_mult NUMERIC;
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

  -- Fetch the claiming user's username and 4-tier upline
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

  -- ====================================================================
  -- LEVEL 1 (10% Base x VIP x NFT/Ambassador Multipliers)
  -- ====================================================================
  IF ref_l1 IS NOT NULL AND ref_l1 <> '' AND ref_l1 <> lower(v_pid) THEN
    vip_mult := 1.0;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(player_id) = resolve_player_id(ref_l1);
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN vip_mult := 2.0; END IF;

    ref_bonus_mult := get_user_referral_multiplier(ref_l1);
    total_mult := vip_mult * ref_bonus_mult;

    comm_amount := ROUND(claim_amount * 0.10 * total_mult, 4);

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

  -- ====================================================================
  -- LEVEL 2 (5% Base x VIP x NFT/Ambassador Multipliers)
  -- ====================================================================
  IF ref_l2 IS NOT NULL AND ref_l2 <> '' AND ref_l2 <> lower(v_pid) THEN
    vip_mult := 1.0;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(player_id) = resolve_player_id(ref_l2);
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN vip_mult := 2.0; END IF;

    ref_bonus_mult := get_user_referral_multiplier(ref_l2);
    total_mult := vip_mult * ref_bonus_mult;

    comm_amount := ROUND(claim_amount * 0.05 * total_mult, 4);

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

  -- ====================================================================
  -- LEVEL 3 (2% Base x VIP x NFT/Ambassador Multipliers)
  -- ====================================================================
  IF ref_l3 IS NOT NULL AND ref_l3 <> '' AND ref_l3 <> lower(v_pid) THEN
    vip_mult := 1.0;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(player_id) = resolve_player_id(ref_l3);
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN vip_mult := 2.0; END IF;

    ref_bonus_mult := get_user_referral_multiplier(ref_l3);
    total_mult := vip_mult * ref_bonus_mult;

    comm_amount := ROUND(claim_amount * 0.02 * total_mult, 4);

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

  -- ====================================================================
  -- LEVEL 4 (1% Base x VIP x NFT/Ambassador Multipliers)
  -- ====================================================================
  IF ref_l4 IS NOT NULL AND ref_l4 <> '' AND ref_l4 <> lower(v_pid) THEN
    vip_mult := 1.0;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(player_id) = resolve_player_id(ref_l4);
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN vip_mult := 2.0; END IF;

    ref_bonus_mult := get_user_referral_multiplier(ref_l4);
    total_mult := vip_mult * ref_bonus_mult;

    comm_amount := ROUND(claim_amount * 0.01 * total_mult, 4);

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
