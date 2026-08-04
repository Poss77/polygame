-- ============================================================
-- POLYGAME: FIX CREDIT_ARCADE_PAYOUT RPC & TOTAL_EARNED COLUMN
-- Resolves PostgreSQL Error 42703 (column "total_earned" does not exist)
-- and PostgREST 404/400 Arcade Payout RPC errors
-- ============================================================

-- 1. Ensure total_earned column exists in users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_earned NUMERIC DEFAULT 0;

-- 2. Drop existing function signatures to cleanly replace
DROP FUNCTION IF EXISTS credit_arcade_payout(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS credit_arcade_payout(NUMERIC, TEXT);

-- 3. Primary Function Signature: credit_arcade_payout(p_player_id TEXT, p_amount NUMERIC)
CREATE OR REPLACE FUNCTION credit_arcade_payout(
  p_player_id TEXT,
  p_amount NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_new_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid amount');
  END IF;

  -- Attempt update using resolved canonical player_id
  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + p_amount,
      total_earned = COALESCE(total_earned, 0) + p_amount,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid)
  RETURNING balance_pgt INTO v_new_balance;

  -- Fallback lookup if resolve_player_id didn't match player_id column
  IF NOT FOUND THEN
    UPDATE users
    SET balance_pgt = COALESCE(balance_pgt, 0) + p_amount,
        total_earned = COALESCE(total_earned, 0) + p_amount,
        updated_at = NOW()
    WHERE LOWER(linked_wallet_address) = LOWER(p_player_id) 
       OR LOWER(player_id) = LOWER(p_player_id)
       OR LOWER(wallet_address) = LOWER(p_player_id)
    RETURNING balance_pgt INTO v_new_balance;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User player_id not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION credit_arcade_payout(TEXT, NUMERIC) TO anon, authenticated, service_role;

-- 4. Parameter Alias Overload: credit_arcade_payout(p_wallet TEXT, p_amount NUMERIC)
CREATE OR REPLACE FUNCTION credit_arcade_payout(
  p_wallet TEXT,
  p_amount NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN credit_arcade_payout(p_player_id := p_wallet, p_amount := p_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION credit_arcade_payout(TEXT, NUMERIC) TO anon, authenticated, service_role;
