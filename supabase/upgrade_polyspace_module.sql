-- ============================================================
-- POLYGAME POLYSPACE SHIP MODULE UPGRADE RPC
-- Deducts PGT balance server-side and saves updated space_state atomically
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION upgrade_polyspace_module(
  p_wallet TEXT,
  p_cost_pgt NUMERIC,
  p_new_space_state JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));
  
  SELECT * INTO v_user
  FROM users
  WHERE LOWER(wallet_address) = p_wallet 
     OR LOWER(COALESCE(linked_wallet_address, '')) = p_wallet
     OR LOWER(COALESCE(user_id::text, '')) = p_wallet
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  v_balance := COALESCE(v_user.balance_pgt, 0);

  IF p_cost_pgt > 0 AND v_balance < p_cost_pgt THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient PGT balance');
  END IF;

  v_new_balance := v_balance - p_cost_pgt;

  UPDATE users
  SET balance_pgt = v_new_balance,
      space_state = p_new_space_state,
      updated_at = NOW()
  WHERE wallet_address = v_user.wallet_address;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'space_state', p_new_space_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION upgrade_polyspace_module(TEXT, NUMERIC, JSONB) TO anon, authenticated, service_role;
