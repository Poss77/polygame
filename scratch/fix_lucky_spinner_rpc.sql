-- ============================================================
-- POLYGAME LUCKY SPINNER RPC (Aligned 100% with Wheel Segments)
-- Multipliers: 0x, 2.5x, 0.5x, 3.0x, 0x, 1.5x
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION play_spinner(
  p_wallet TEXT,
  p_bet NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance NUMERIC;
  v_rand NUMERIC;
  v_multiplier NUMERIC;
  v_payout NUMERIC;
  v_new_balance NUMERIC;
  v_segment INT;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));

  IF p_bet <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid bet amount');
  END IF;

  SELECT balance_pgt INTO v_balance
  FROM users
  WHERE LOWER(wallet_address) = p_wallet OR LOWER(linked_wallet_address) = p_wallet
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_balance < p_bet THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance');
  END IF;

  v_rand := random();
  
  -- Probability & Segment Distribution aligned 100% with physical SVG Wheel
  IF v_rand < 0.30 THEN 
    v_multiplier := 0; v_segment := 0; -- Segment 0: 0x Loss
  ELSIF v_rand < 0.45 THEN 
    v_multiplier := 2.5; v_segment := 1; -- Segment 1: 2.5x Win
  ELSIF v_rand < 0.65 THEN 
    v_multiplier := 0.5; v_segment := 2; -- Segment 2: 0.5x Partial
  ELSIF v_rand < 0.75 THEN 
    v_multiplier := 3.0; v_segment := 3; -- Segment 3: 3.0x Win
  ELSIF v_rand < 0.90 THEN 
    v_multiplier := 0; v_segment := 4; -- Segment 4: 0x Loss
  ELSE 
    v_multiplier := 1.5; v_segment := 5; -- Segment 5: 1.5x Win
  END IF;

  v_payout := p_bet * v_multiplier;

  UPDATE users
  SET balance_pgt = balance_pgt - p_bet + v_payout,
      updated_at = NOW()
  WHERE LOWER(wallet_address) = p_wallet OR LOWER(linked_wallet_address) = p_wallet
  RETURNING balance_pgt INTO v_new_balance;

  RETURN jsonb_build_object(
    'success', true,
    'multiplier', v_multiplier,
    'segment', v_segment,
    'payout', v_payout,
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION play_spinner(TEXT, NUMERIC) TO anon, authenticated, service_role;
