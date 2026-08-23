-- ============================================================================
-- POLYGAME - POLYSPACE STATE & ARCADE PAYOUT SQL MIGRATION
-- Run this script in your Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- ============================================================================

-- 1. Ensure `space_state` JSONB column exists in the `users` table
ALTER TABLE users ADD COLUMN IF NOT EXISTS space_state JSONB DEFAULT '{}'::jsonb;

-- 2. Ensure `credit_arcade_payout` RPC function exists and is executable
CREATE OR REPLACE FUNCTION credit_arcade_payout(p_wallet TEXT, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid amount');
  END IF;

  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + p_amount,
      updated_at = NOW()
  WHERE LOWER(wallet_address) = LOWER(p_wallet)
  RETURNING balance_pgt INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User wallet not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION credit_arcade_payout(TEXT, NUMERIC) TO anon, authenticated, service_role;
