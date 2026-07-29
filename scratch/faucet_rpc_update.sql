-- ============================================================
-- POLYGAME FAUCET RPC UPDATE (V2)
-- Enables Faucet claims for both Web3 Wallets & Google Social Accounts
-- Run this script in the Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION claim_faucet(
  p_wallet TEXT DEFAULT NULL,
  p_nft_boost_percent NUMERIC DEFAULT 0,
  p_1flr_balance NUMERIC DEFAULT 0,
  p_staked_pgt NUMERIC DEFAULT 0,
  p_user_id UUID DEFAULT NULL
) RETURNS json 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_claim TIMESTAMPTZ;
  v_streak INTEGER;
  v_vip_until TIMESTAMPTZ;
  v_balance_pgt NUMERIC;
  v_payout NUMERIC;
  v_base_payout NUMERIC := 50.0;
  v_now TIMESTAMPTZ := now();
  v_hours_since_last NUMERIC;
  v_target_wallet TEXT;
BEGIN
  -- Clean input
  IF p_wallet IS NOT NULL AND p_wallet <> '' THEN
    p_wallet := LOWER(TRIM(p_wallet));
  ELSE
    p_wallet := NULL;
  END IF;

  -- Atomic row lock to prevent parallel double-claim race conditions
  SELECT wallet_address, last_faucet_claim, faucet_streak, vip_until, balance_pgt
  INTO v_target_wallet, v_last_claim, v_streak, v_vip_until, v_balance_pgt
  FROM users
  WHERE (p_wallet IS NOT NULL AND LOWER(wallet_address) = p_wallet)
     OR (p_user_id IS NOT NULL AND user_id = p_user_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_last_claim IS NOT NULL THEN
    IF v_vip_until IS NOT NULL AND v_vip_until > v_now THEN
      -- 10% Faster Cooldown for VIPs (21.6 hours = 21 hrs 36 mins)
      IF v_now < v_last_claim + INTERVAL '21 hours 36 minutes' THEN
        RETURN json_build_object('success', false, 'error', 'Cooldown active');
      END IF;
    ELSE
      -- Standard 24 hours cooldown for non-VIPs
      IF v_now < v_last_claim + INTERVAL '24 hours' THEN
        RETURN json_build_object('success', false, 'error', 'Cooldown active');
      END IF;
    END IF;
  END IF;

  IF v_last_claim IS NOT NULL THEN
    v_hours_since_last := EXTRACT(EPOCH FROM (v_now - v_last_claim)) / 3600;
    IF v_hours_since_last > 48 THEN
      v_streak := 1;
    ELSE
      v_streak := COALESCE(v_streak, 0) + 1;
    END IF;
  ELSE
    v_streak := 1;
  END IF;

  v_payout := v_base_payout * (1 + p_nft_boost_percent / 100.0);

  IF v_balance_pgt >= 1000000 THEN
    v_payout := v_payout * 2;
  END IF;

  IF p_1flr_balance >= 5000000 THEN
    v_payout := v_payout * 1.1;
  END IF;

  IF p_staked_pgt >= 1000000 THEN
    v_payout := v_payout * 1.25;
  END IF;

  IF v_vip_until IS NOT NULL AND v_vip_until > v_now THEN
    v_payout := v_payout * 2;
  END IF;

  UPDATE users
  SET balance_pgt = balance_pgt + v_payout,
      last_faucet_claim = v_now,
      faucet_streak = v_streak
  WHERE (p_wallet IS NOT NULL AND LOWER(wallet_address) = p_wallet)
     OR (p_user_id IS NOT NULL AND user_id = p_user_id);

  IF v_target_wallet IS NOT NULL AND v_target_wallet <> '' THEN
    PERFORM process_referral_commissions(v_target_wallet, v_payout);
  END IF;

  RETURN json_build_object(
    'success', true,
    'payout', v_payout,
    'streak', v_streak,
    'last_claim', v_now
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, UUID) TO anon, authenticated, service_role;
