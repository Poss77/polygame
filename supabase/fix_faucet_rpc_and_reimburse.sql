-- ============================================================
-- POLYGAME FAUCET RPC FIX & PLAYER REIMBURSEMENT SCRIPT
-- 1. Ensures Ambassador (+100%) and NFT boosts are enforced in claim_faucet
-- 2. Credits +504 PGT missing faucet claims for 0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5
-- ============================================================

DROP FUNCTION IF EXISTS claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC);
CREATE OR REPLACE FUNCTION claim_faucet(
  p_wallet TEXT, 
  p_nft_boost_percent NUMERIC DEFAULT 0, 
  p_1flr_balance NUMERIC DEFAULT 0, 
  p_staked_pgt NUMERIC DEFAULT 0
) RETURNS json 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_last_claim TIMESTAMPTZ;
  v_streak INTEGER;
  v_vip_until TIMESTAMPTZ;
  v_balance_pgt NUMERIC;
  v_is_amb BOOLEAN;
  v_payout NUMERIC;
  v_base_payout NUMERIC := 50.0;
  v_now TIMESTAMPTZ := now();
  v_hours_since_last NUMERIC;
  v_effective_boost NUMERIC;
BEGIN
  SELECT last_faucet_claim, faucet_streak, vip_until, balance_pgt, COALESCE(is_ambassador, false)
  INTO v_last_claim, v_streak, v_vip_until, v_balance_pgt, v_is_amb
  FROM users 
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid) 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Cooldown enforcement (21h36m for VIP, 24h for standard)
  IF v_last_claim IS NOT NULL THEN
    IF v_vip_until IS NOT NULL AND v_vip_until > v_now THEN
      IF v_now < v_last_claim + INTERVAL '21 hours 36 minutes' THEN
        RETURN json_build_object('success', false, 'error', 'Cooldown active');
      END IF;
    ELSE
      IF v_now < v_last_claim + INTERVAL '24 hours' THEN
        RETURN json_build_object('success', false, 'error', 'Cooldown active');
      END IF;
    END IF;
  END IF;

  -- Calculate streak
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

  -- Ensure Ambassador (+100%) is automatically added if player is ambassador
  v_effective_boost := COALESCE(p_nft_boost_percent, 0);
  IF v_is_amb THEN
    v_effective_boost := v_effective_boost + 100.0;
  END IF;

  -- Calculate payout
  v_payout := v_base_payout * (1.0 + v_effective_boost / 100.0);

  -- Balance multipliers
  IF v_balance_pgt >= 1000000 THEN v_payout := v_payout * 2; END IF;
  IF p_1flr_balance >= 5000000 THEN v_payout := v_payout * 1.1; END IF;
  IF p_staked_pgt >= 1000000 THEN v_payout := v_payout * 1.25; END IF;

  -- 2.0x VIP Multiplier
  IF v_vip_until IS NOT NULL AND v_vip_until > v_now THEN 
    v_payout := v_payout * 2.0; 
  END IF;

  v_payout := ROUND(v_payout, 2);

  UPDATE users 
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_payout, 
      last_faucet_claim = v_now, 
      faucet_streak = v_streak,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);

  PERFORM process_referral_commissions(v_pid, v_payout);

  RETURN json_build_object(
    'success', true, 
    'payout', v_payout, 
    'streak', v_streak, 
    'last_claim', v_now
  );
END;
$$;
GRANT EXECUTE ON FUNCTION claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

-- Reimburse missing +504 PGT to user 0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5
UPDATE users
SET balance_pgt = COALESCE(balance_pgt, 0) + 504.0,
    updated_at = NOW()
WHERE LOWER(player_id) = '0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5'
   OR LOWER(COALESCE(linked_wallet_address, '')) = '0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5'
   OR LOWER(COALESCE(wallet_address, '')) = '0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5';
