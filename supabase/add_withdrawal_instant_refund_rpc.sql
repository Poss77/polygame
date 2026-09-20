-- ==============================================================================
-- POLYGAME: WITHDRAWAL ATOMIC AUTO-REFUND & REVERT RPC
-- ==============================================================================
-- Description:
-- When a player attempts an on-chain PGT withdrawal, their off-chain balance is
-- held/deducted by request_withdrawal_voucher(). If the MetaMask transaction fails
-- (e.g., user rejected, RPC error, or insufficient POL for the 0.5 POL fee),
-- this function immediately rolls back the hold, restores the PGT back to the
-- player's database balance, and deletes the unconsumed withdrawal history record.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.refund_failed_withdrawal(
  p_player_id TEXT,
  p_nonce NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_rec RECORD;
  v_new_balance NUMERIC;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_player_id, '')));
  END IF;

  -- 1. Find the unconsumed withdrawal record matching the nonce and player
  SELECT * INTO v_rec 
  FROM public.withdrawals_history 
  WHERE nonce = p_nonce 
    AND (LOWER(player_id) = LOWER(v_pid) OR LOWER(wallet_address) = LOWER(v_pid))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal voucher not found or does not belong to this account.');
  END IF;

  -- 2. Refund balance to user
  UPDATE public.users
  SET balance_pgt = balance_pgt + v_rec.amount,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_rec.player_id)
  RETURNING balance_pgt INTO v_new_balance;

  -- 3. Delete the unconsumed withdrawal history record
  DELETE FROM public.withdrawals_history WHERE id = v_rec.id;

  RETURN jsonb_build_object(
    'success', true,
    'refunded_amount', v_rec.amount,
    'new_balance', v_new_balance,
    'player_id', v_rec.player_id,
    'nonce', p_nonce
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_failed_withdrawal(TEXT, NUMERIC) TO anon, authenticated, service_role;
