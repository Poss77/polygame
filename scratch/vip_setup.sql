-- 1. Add the vip_until column to the users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_until TIMESTAMPTZ;

-- 2. Update the process_referral_commissions RPC to check for VIP status
CREATE OR REPLACE FUNCTION process_referral_commissions(
  claiming_wallet TEXT,
  claim_amount NUMERIC
) RETURNS void AS $$
DECLARE
  ref_l1 TEXT;
  ref_l2 TEXT;
  ref_l3 TEXT;
  ref_l4 TEXT;
  vip_expiry TIMESTAMPTZ;
  multiplier NUMERIC;
BEGIN
  -- Fetch the downline structure of the claiming user
  SELECT 
    referred_by_l1,
    referred_by_l2,
    referred_by_l3,
    referred_by_l4
  INTO
    ref_l1,
    ref_l2,
    ref_l3,
    ref_l4
  FROM users WHERE wallet_address = claiming_wallet;

  -- Level 1 (10%)
  IF ref_l1 IS NOT NULL THEN
    multiplier := 1;
    SELECT vip_until INTO vip_expiry FROM users WHERE wallet_address = ref_l1;
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN
        multiplier := 2;
    END IF;
    UPDATE users SET balance_pgt = balance_pgt + (claim_amount * 0.10 * multiplier) WHERE wallet_address = ref_l1;
  END IF;

  -- Level 2 (5%)
  IF ref_l2 IS NOT NULL THEN
    multiplier := 1;
    SELECT vip_until INTO vip_expiry FROM users WHERE wallet_address = ref_l2;
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN
        multiplier := 2;
    END IF;
    UPDATE users SET balance_pgt = balance_pgt + (claim_amount * 0.05 * multiplier) WHERE wallet_address = ref_l2;
  END IF;

  -- Level 3 (2%)
  IF ref_l3 IS NOT NULL THEN
    multiplier := 1;
    SELECT vip_until INTO vip_expiry FROM users WHERE wallet_address = ref_l3;
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN
        multiplier := 2;
    END IF;
    UPDATE users SET balance_pgt = balance_pgt + (claim_amount * 0.02 * multiplier) WHERE wallet_address = ref_l3;
  END IF;

  -- Level 4 (1%)
  IF ref_l4 IS NOT NULL THEN
    multiplier := 1;
    SELECT vip_until INTO vip_expiry FROM users WHERE wallet_address = ref_l4;
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN
        multiplier := 2;
    END IF;
    UPDATE users SET balance_pgt = balance_pgt + (claim_amount * 0.01 * multiplier) WHERE wallet_address = ref_l4;
  END IF;

END;
$$ LANGUAGE plpgsql;
