-- ==============================================================================
-- POLYGON GAMING: 10% POL NFT REFERRAL COMMISSION & ADMIN PAYOUT ENGINE
-- ==============================================================================
-- 1. Fixes credit_nft_referral_commission to resolve buyer and referrer using
--    player_id / linked_wallet_address (eliminating column "referred_by" error).
-- 2. Logs 10% POL commission into upline's referrals_list with currency: 'POL'.
-- 3. Fixes request_pol_referral_payout to correctly resolve player accounts.
-- 4. Ensures pol_payout_requests table exists with proper RLS policies.
-- 5. Backfills Poss (0xpgt8312e02d37185b5983e6922d1dae1cce) with 8.0 POL.
-- ==============================================================================

-- 1. Ensure columns exist on public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS unclaimed_referral_pol NUMERIC DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_referral_pol NUMERIC DEFAULT 0;

-- 2. Ensure pol_payout_requests table exists for Admin queue
CREATE TABLE IF NOT EXISTS public.pol_payout_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  username TEXT,
  amount_pol NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'rejected'
  tx_hash TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.pol_payout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public select pol_payout_requests" ON public.pol_payout_requests;
DROP POLICY IF EXISTS "Allow authenticated insert pol_payout_requests" ON public.pol_payout_requests;
DROP POLICY IF EXISTS "Allow authenticated update pol_payout_requests" ON public.pol_payout_requests;

CREATE POLICY "Allow public select pol_payout_requests" ON public.pol_payout_requests FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert pol_payout_requests" ON public.pol_payout_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update pol_payout_requests" ON public.pol_payout_requests FOR UPDATE USING (true);

GRANT ALL ON TABLE public.pol_payout_requests TO anon, authenticated, service_role;


-- 3. DROP OLD INCOMPATIBLE OVERLOADS
DROP FUNCTION IF EXISTS public.credit_nft_referral_commission(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.credit_nft_referral_commission(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS public.request_pol_referral_payout(TEXT, NUMERIC);


-- 4. RECREATE CANONICAL credit_nft_referral_commission
CREATE OR REPLACE FUNCTION public.credit_nft_referral_commission(
  buyer_wallet TEXT,
  pol_price NUMERIC,
  item_name TEXT DEFAULT 'NFT Purchase'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_buyer RECORD;
  v_parent RECORD;
  v_buyer_id TEXT;
  v_parent_id TEXT;
  v_commission NUMERIC;
  v_buyer_name TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_time_str TEXT := TO_CHAR(NOW(), 'HH12:MI:SS AM');
  v_action_str TEXT;
  v_new_entry JSONB;
BEGIN
  IF pol_price IS NULL OR pol_price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Zero or invalid price');
  END IF;

  v_commission := ROUND(pol_price * 0.10, 4);
  IF v_commission <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Commission too small');
  END IF;

  v_action_str := COALESCE(NULLIF(TRIM(item_name), ''), 'NFT Purchase');

  -- 1. Resolve buyer identifier to synthetic player_id or fallback
  v_buyer_id := resolve_player_id(buyer_wallet);
  IF v_buyer_id IS NULL OR v_buyer_id = '' THEN
    v_buyer_id := LOWER(TRIM(buyer_wallet));
  END IF;

  -- 2. Fetch buyer record
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

  -- 3. Check for Level 1 referrer
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

  -- 4. Lock and fetch parent referrer record
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

  -- 5. Format buyer display name
  IF v_buyer.username IS NOT NULL AND TRIM(v_buyer.username) <> '' AND UPPER(TRIM(v_buyer.username)) <> 'EMPTY' THEN
    v_buyer_name := TRIM(v_buyer.username);
  ELSE
    v_buyer_name := 'Player_' || SUBSTRING(v_buyer.player_id FROM 1 FOR 8);
  END IF;

  -- 6. Construct referral activity entry
  v_new_entry := jsonb_build_object(
    'name', v_buyer_name,
    'player', v_buyer_name,
    'player_id', v_buyer.player_id,
    'level', 1,
    'action', v_action_str,
    'amount', pol_price,
    'commission', v_commission,
    'currency', 'POL',
    'time', v_time_str,
    'created_at', v_now
  );

  -- 7. Credit 10% POL to parent referrer and prepend to rolling 50-item ledger
  UPDATE public.users
  SET 
    unclaimed_referral_pol = COALESCE(unclaimed_referral_pol, 0) + v_commission,
    total_referral_pol = COALESCE(total_referral_pol, 0) + v_commission,
    referrals_list = (
      SELECT jsonb_agg(elem)
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
    'buyer', v_buyer_name,
    'action', v_action_str
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_nft_referral_commission(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;


-- 5. RECREATE CANONICAL request_pol_referral_payout
CREATE OR REPLACE FUNCTION public.request_pol_referral_payout(
  p_user_wallet TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_username TEXT;
  v_unclaimed NUMERIC;
  v_payout_wallet TEXT;
  v_request_id UUID;
BEGIN
  p_user_wallet := LOWER(TRIM(p_user_wallet));

  IF p_amount <= 0.001 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Minimum payout request is 0.001 POL');
  END IF;

  v_pid := resolve_player_id(p_user_wallet);
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := p_user_wallet;
  END IF;

  -- Lock user record
  SELECT 
    username, 
    COALESCE(unclaimed_referral_pol, 0),
    COALESCE(linked_wallet_address, p_user_wallet)
  INTO 
    v_username, 
    v_unclaimed,
    v_payout_wallet
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = p_user_wallet
     OR LOWER(player_id) = p_user_wallet
  FOR UPDATE;

  IF v_unclaimed IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'User profile not found');
  END IF;

  IF v_unclaimed < p_amount THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Insufficient unclaimed POL referral balance');
  END IF;

  -- Deduct from user's unclaimed POL pool
  UPDATE public.users
  SET unclaimed_referral_pol = GREATEST(0, unclaimed_referral_pol - p_amount),
      updated_at = NOW()
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = p_user_wallet
     OR LOWER(player_id) = p_user_wallet;

  -- Create pending payout request for Master Admin approval
  INSERT INTO public.pol_payout_requests (wallet_address, username, amount_pol, status)
  VALUES (v_payout_wallet, COALESCE(v_username, ''), p_amount, 'pending')
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'amount_pol', p_amount,
    'payout_wallet', v_payout_wallet
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_pol_referral_payout(TEXT, NUMERIC) TO anon, authenticated, service_role;


-- 6. RECREATE complete_pol_payout_request
CREATE OR REPLACE FUNCTION public.complete_pol_payout_request(
  p_request_id UUID,
  p_tx_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.pol_payout_requests
  SET status = 'paid',
      tx_hash = p_tx_hash,
      processed_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_pol_payout_request(UUID, TEXT) TO anon, authenticated, service_role;


-- 7. BACKFILL & VERIFY POSS (0xpgt8312e02d37185b5983e6922d1dae1cce)
-- Ensure Poss has at least 8.0000 POL credited for Vezuvius King's 4 NFT purchases
UPDATE public.users
SET 
  unclaimed_referral_pol = GREATEST(COALESCE(unclaimed_referral_pol, 0), 8.0000),
  total_referral_pol = GREATEST(COALESCE(total_referral_pol, 0), 105.0000),
  updated_at = NOW()
WHERE player_id = '0xpgt8312e02d37185b5983e6922d1dae1cce';

-- 8. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
