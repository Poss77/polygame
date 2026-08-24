-- ==============================================================================
-- POLYGAME - HARDEN CREDIT ARCADE PAYOUT & ANTI-CHEAT SHIELD
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.credit_arcade_payout(
  p_player_id TEXT,
  p_amount NUMERIC DEFAULT 0.0,
  p_game_name TEXT DEFAULT 'PolySpace Mining'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_payout NUMERIC;
  v_new_balance NUMERIC;
  v_user RECORD;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_player_id));
  END IF;

  -- 1. Check user exists
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- 2. Anti-cheat ceiling: Allows max 7-day Odyssey + 3x Critical + VIP/NFT boosts (~1,500 PGT) while blocking macro injection
  v_payout := LEAST(2500.0, GREATEST(0.0, COALESCE(p_amount, 0.0)));

  -- 3. Atomic credit
  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_payout,
      total_earned = COALESCE(total_earned, 0) + v_payout,
      updated_at = NOW()
  WHERE player_id = v_pid
  RETURNING balance_pgt INTO v_new_balance;

  -- 4. Process referral commissions
  IF v_payout > 0 THEN
    PERFORM process_referral_commissions(v_pid, v_payout, COALESCE(p_game_name, 'PolySpace Mining'));
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payout_pgt', v_payout,
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_arcade_payout(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;
