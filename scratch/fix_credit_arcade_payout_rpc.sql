-- ============================================================
-- POLYGAME: FIX CREDIT_ARCADE_PAYOUT RPC (BOTH PARAMETER SIGNATURES)
-- Resolves PostgREST 404 (PGRST202) schema cache errors
-- ============================================================

-- 1. Primary Function (p_player_id TEXT, p_amount NUMERIC)
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

  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + p_amount,
      total_earned = COALESCE(total_earned, 0) + p_amount,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid)
  RETURNING balance_pgt INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User player_id not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;
GRANT EXECUTE ON FUNCTION credit_arcade_payout(TEXT, NUMERIC) TO anon, authenticated, service_role;

-- 2. Alias Overload (p_wallet TEXT, p_amount NUMERIC) for backwards compatibility
CREATE OR REPLACE FUNCTION credit_arcade_payout(
  p_wallet TEXT,
  p_amount NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN credit_arcade_payout(p_player_id := p_wallet, p_amount := p_amount);
END;
$$;
GRANT EXECUTE ON FUNCTION credit_arcade_payout(TEXT, NUMERIC) TO anon, authenticated, service_role;
