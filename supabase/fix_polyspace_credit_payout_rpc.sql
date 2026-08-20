-- ==============================================================================
-- POLYGAME: SECURE POLYSPACE & ARCADE PAYOUT RPC
-- ==============================================================================
-- Securely credits PolySpace expedition loot & mining rewards
-- Clamped at max 150 PGT per call to prevent unauthorized bot inflation
-- ==============================================================================

DROP FUNCTION IF EXISTS credit_arcade_payout(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS credit_arcade_payout(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS credit_arcade_payout(NUMERIC, TEXT);
DROP FUNCTION IF EXISTS credit_arcade_payout CASCADE;

CREATE OR REPLACE FUNCTION credit_arcade_payout(
  p_player_id TEXT,
  p_amount NUMERIC,
  p_game_name TEXT DEFAULT 'PolySpace Mining'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_clamped_amt NUMERIC;
  v_new_balance NUMERIC;
  v_user RECORD;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(p_player_id)); 
  END IF;

  IF v_pid IS NULL OR v_pid = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player identity required');
  END IF;

  -- Security Clamp: Max 150 PGT per payout call (blocks bot balance injection)
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  v_clamped_amt := ROUND(LEAST(COALESCE(p_amount, 0), 150.0)::numeric, 2);

  -- 1. Lock and update user balance
  SELECT * INTO v_user FROM users 
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_clamped_amt,
      total_earned = COALESCE(total_earned, 0) + v_clamped_amt,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_user.player_id)
  RETURNING balance_pgt INTO v_new_balance;

  RETURN jsonb_build_object(
    'success', true, 
    'credited_pgt', v_clamped_amt, 
    'new_balance', v_new_balance,
    'game_name', p_game_name
  );
END;
$$;

-- Overload for 2-param calls
CREATE OR REPLACE FUNCTION credit_arcade_payout(
  p_player_id TEXT,
  p_amount NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN credit_arcade_payout(p_player_id, p_amount, 'PolySpace Mining');
END;
$$;

GRANT EXECUTE ON FUNCTION credit_arcade_payout(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION credit_arcade_payout(TEXT, NUMERIC) TO anon, authenticated, service_role;
