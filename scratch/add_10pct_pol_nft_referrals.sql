-- ============================================================
-- POLYGAME: 10% POL NFT REFERRAL COMMISSION & ADMIN PAYOUT QUEUE
-- ============================================================

-- 1. Add POL referral columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS unclaimed_referral_pol NUMERIC DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_referral_pol NUMERIC DEFAULT 0;

-- 2. Create pol_payout_requests table for admin approval queue
CREATE TABLE IF NOT EXISTS pol_payout_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  username TEXT,
  amount_pol NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'rejected'
  tx_hash TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- RLS Policies
ALTER TABLE pol_payout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public select pol_payout_requests" ON pol_payout_requests;
DROP POLICY IF EXISTS "Allow authenticated insert pol_payout_requests" ON pol_payout_requests;
DROP POLICY IF EXISTS "Allow authenticated update pol_payout_requests" ON pol_payout_requests;

CREATE POLICY "Allow public select pol_payout_requests" ON pol_payout_requests FOR SELECT USING (true);
CREATE POLICY "Allow authenticated insert pol_payout_requests" ON pol_payout_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow authenticated update pol_payout_requests" ON pol_payout_requests FOR UPDATE USING (true);


-- 3. RPC to credit 10% POL referral commission on NFT sales
CREATE OR REPLACE FUNCTION credit_nft_referral_commission(
  buyer_wallet TEXT,
  pol_price NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_buyer_id UUID;
  v_parent_id UUID;
  v_parent_wallet TEXT;
  v_commission NUMERIC;
BEGIN
  buyer_wallet := LOWER(TRIM(buyer_wallet));
  v_commission := ROUND(pol_price * 0.10, 4);

  IF v_commission <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Zero commission');
  END IF;

  -- Find buyer user and parent referrer
  SELECT id, referred_by INTO v_buyer_id, v_parent_id
  FROM users
  WHERE LOWER(wallet_address) = buyer_wallet;

  IF v_parent_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'No parent referrer found');
  END IF;

  -- Credit 10% POL commission to parent referrer
  UPDATE users
  SET unclaimed_referral_pol = COALESCE(unclaimed_referral_pol, 0) + v_commission,
      total_referral_pol = COALESCE(total_referral_pol, 0) + v_commission
  WHERE id = v_parent_id
  RETURNING LOWER(wallet_address) INTO v_parent_wallet;

  RETURN jsonb_build_object(
    'success', true,
    'parent_wallet', v_parent_wallet,
    'commission_pol', v_commission
  );
END;
$$;


-- 4. RPC for referrer to submit a POL payout request
CREATE OR REPLACE FUNCTION request_pol_referral_payout(
  p_user_wallet TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_username TEXT;
  v_unclaimed NUMERIC;
  v_request_id UUID;
BEGIN
  p_user_wallet := LOWER(TRIM(p_user_wallet));

  IF p_amount <= 0.001 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Minimum payout request is 0.001 POL');
  END IF;

  SELECT id, username, COALESCE(unclaimed_referral_pol, 0) INTO v_user_id, v_username, v_unclaimed
  FROM users
  WHERE LOWER(wallet_address) = p_user_wallet
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'User profile not found');
  END IF;

  IF v_unclaimed < p_amount THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Insufficient unclaimed POL referral balance');
  END IF;

  -- Deduct from unclaimed pool
  UPDATE users
  SET unclaimed_referral_pol = unclaimed_referral_pol - p_amount
  WHERE id = v_user_id;

  -- Create pending payout request
  INSERT INTO pol_payout_requests (user_id, wallet_address, username, amount_pol, status)
  VALUES (v_user_id, p_user_wallet, COALESCE(v_username, ''), p_amount, 'pending')
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'amount_pol', p_amount
  );
END;
$$;


-- 5. RPC for Admin to complete POL payout request
CREATE OR REPLACE FUNCTION complete_pol_payout_request(
  p_request_id UUID,
  p_tx_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE pol_payout_requests
  SET status = 'paid',
      tx_hash = p_tx_hash,
      processed_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
