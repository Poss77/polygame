-- PolyGame: Update claim_faucet RPC for 1M PGT On-Chain Holder +10% Bonus
-- Run this script in the Supabase SQL Editor

DROP FUNCTION IF EXISTS claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION claim_faucet(
  p_wallet TEXT,
  p_nft_boost_percent NUMERIC DEFAULT 0,
  p_1flr_balance NUMERIC DEFAULT 0,
  p_staked_pgt NUMERIC DEFAULT 0,
  p_onchain_pgt NUMERIC DEFAULT 0
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_last_claim TIMESTAMPTZ;
  v_streak INTEGER;
  v_vip_until TIMESTAMPTZ;
  v_balance_pgt NUMERIC;
  v_payout NUMERIC;
  v_base_payout NUMERIC := 50.0;
  v_now TIMESTAMPTZ := now();
  v_hours_since_last NUMERIC;
  v_is_ambassador BOOLEAN := false;
BEGIN
  SELECT last_faucet_claim, faucet_streak, vip_until, balance_pgt, is_ambassador
  INTO v_last_claim, v_streak, v_vip_until, v_balance_pgt, v_is_ambassador
  FROM users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

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

  IF v_last_claim IS NOT NULL THEN
    v_hours_since_last := EXTRACT(EPOCH FROM (v_now - v_last_claim)) / 3600;
    IF v_hours_since_last > 48 THEN v_streak := 1; ELSE v_streak := COALESCE(v_streak, 0) + 1; END IF;
  ELSE
    v_streak := 1;
  END IF;

  v_payout := v_base_payout * (1 + p_nft_boost_percent / 100.0);
  IF p_1flr_balance >= 5000000 THEN v_payout := v_payout * 1.15; END IF;
  IF p_staked_pgt >= 1000000 THEN v_payout := v_payout * 1.25; END IF;
  IF p_onchain_pgt >= 1000000 THEN v_payout := v_payout * 1.10; END IF;
  IF v_vip_until IS NOT NULL AND v_vip_until > v_now THEN v_payout := v_payout * 2; END IF;
  IF v_is_ambassador THEN v_payout := v_payout * 2; END IF;

  UPDATE users SET balance_pgt = COALESCE(balance_pgt, 0) + v_payout, last_faucet_claim = v_now, faucet_streak = v_streak WHERE LOWER(player_id) = LOWER(v_pid);
  PERFORM process_referral_commissions(v_pid, v_payout);

  RETURN json_build_object('success', true, 'payout', v_payout, 'streak', v_streak, 'last_claim', v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO anon, authenticated, service_role;
