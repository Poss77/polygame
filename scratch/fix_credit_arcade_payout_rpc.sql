-- ============================================================
-- POLYGAME: FIX CREDIT_ARCADE_PAYOUT RPC & TOTAL_EARNED COLUMN
-- Resolves PostgreSQL Error 42703 (column "total_earned" does not exist)
-- and Error 42P13 (cannot change name of input parameter)
-- ============================================================

-- 1. Ensure total_earned column exists in users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_earned NUMERIC DEFAULT 0;

-- 2. Drop all existing function signatures cleanly
DROP FUNCTION IF EXISTS credit_arcade_payout(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS credit_arcade_payout(NUMERIC, TEXT);
DROP FUNCTION IF EXISTS credit_arcade_payout CASCADE;

-- 3. Unified Single Function (Supports both p_player_id AND p_wallet parameter names)
CREATE OR REPLACE FUNCTION credit_arcade_payout(
  p_player_id TEXT DEFAULT NULL,
  p_amount NUMERIC DEFAULT 0,
  p_wallet TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_raw_id TEXT := COALESCE(p_player_id, p_wallet);
  v_pid TEXT;
  v_new_balance NUMERIC;
BEGIN
  IF v_raw_id IS NULL OR v_raw_id = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player ID or wallet required');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid amount');
  END IF;

  v_pid := resolve_player_id(v_raw_id);

  -- Primary update using resolved canonical player_id
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
    WHERE LOWER(linked_wallet_address) = LOWER(v_raw_id) 
       OR LOWER(player_id) = LOWER(v_raw_id)
       OR LOWER(wallet_address) = LOWER(v_raw_id)
    RETURNING balance_pgt INTO v_new_balance;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User player_id not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION credit_arcade_payout(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;
