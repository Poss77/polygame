-- ============================================================
-- POLYGAME ON-CHAIN DEPOSIT RPC (WITH ATOMIC BALANCE UPDATE)
-- 1. Updates user's balance_pgt atomically in Supabase DB
-- 2. Records burn & treasury metrics in global_burn_metrics
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION deposit_pgt_onchain(
  p_wallet TEXT,
  p_amount NUMERIC,
  p_tx_hash_burn TEXT DEFAULT '',
  p_tx_hash_treasury TEXT DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_new_balance NUMERIC;
  v_burn NUMERIC;
  v_treasury NUMERIC;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid deposit amount');
  END IF;

  SELECT * INTO v_user
  FROM users
  WHERE LOWER(wallet_address) = p_wallet OR LOWER(linked_wallet_address) = p_wallet
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  -- 1. Atomically update user PGT balance in DB
  UPDATE users
  SET balance_pgt = balance_pgt + p_amount,
      updated_at = NOW()
  WHERE LOWER(wallet_address) = LOWER(v_user.wallet_address)
  RETURNING balance_pgt INTO v_new_balance;

  -- 2. Record 50% Burn & 50% Treasury metrics
  v_burn := p_amount * 0.50;
  v_treasury := p_amount * 0.50;

  UPDATE global_burn_metrics
  SET total_burned_pgt = total_burned_pgt + v_burn,
      total_treasury_pgt = total_treasury_pgt + v_treasury,
      updated_at = NOW()
  WHERE id = 1;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance_pgt', v_new_balance,
    'deposited', p_amount,
    'burned', v_burn,
    'treasury', v_treasury,
    'message', 'On-chain PGT deposit credited successfully!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION deposit_pgt_onchain(TEXT, NUMERIC, TEXT, TEXT) TO anon, authenticated, service_role;
