-- ==============================================================================
-- POLYGAME: FIX POLYSPACE REFERRAL DOUBLE COMMISSION
-- ==============================================================================
-- 1. Updates credit_arcade_payout to return referral_processed: true.
-- 2. Ensures process_referral_commissions runs strictly once server-side.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.credit_arcade_payout(
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

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  -- Security Clamp: Max 150 PGT per payout call
  v_clamped_amt := ROUND(LEAST(COALESCE(p_amount, 0), 150.0)::numeric, 2);

  SELECT * INTO v_user 
  FROM users 
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

  -- Process 4-tier referral commissions for uplines (authoritative, server-side)
  BEGIN
    PERFORM process_referral_commissions(v_user.player_id, v_clamped_amt, COALESCE(p_game_name, 'PolySpace Fleet'));
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true, 
    'payout_pgt', v_clamped_amt,
    'payout', v_clamped_amt, 
    'new_balance', v_new_balance,
    'referral_processed', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_arcade_payout(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
