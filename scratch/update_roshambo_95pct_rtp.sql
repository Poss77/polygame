-- ============================================================
-- POLYGAME ROSHAMBO 95% RTP (5% HOUSE EDGE) RPC UPDATE
-- Updates play_roshambo RPC to pay 1.85x on wins (1.0x on ties),
-- giving exact 95% Return to Player (5% House Edge)
-- Run this script in your Supabase SQL Editor!
-- ============================================================

CREATE OR REPLACE FUNCTION play_roshambo(
  p_wallet TEXT,
  p_bet NUMERIC,
  p_choice TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance NUMERIC;
  v_cpu_choice TEXT;
  v_outcome TEXT;
  v_payout NUMERIC := 0;
  v_new_balance NUMERIC;
  v_choices TEXT[] := ARRAY['rock', 'paper', 'scissors'];
  v_win_multiplier NUMERIC := 1.85; -- 1.85x win + 1.0x tie = 95% RTP (5% House Edge)
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));
  p_choice := LOWER(TRIM(p_choice));

  IF p_bet <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid bet amount');
  END IF;

  -- Lock user row by wallet_address OR linked_wallet_address OR player_id
  SELECT balance_pgt INTO v_balance
  FROM users
  WHERE LOWER(wallet_address) = p_wallet 
     OR LOWER(linked_wallet_address) = p_wallet 
     OR LOWER(player_id) = p_wallet
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_balance < p_bet THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance');
  END IF;

  -- Random CPU choice
  v_cpu_choice := v_choices[1 + floor(random() * 3)::int];

  -- Outcome determination
  IF p_choice = v_cpu_choice THEN
    v_outcome := 'draw';
    v_payout := p_bet;
  ELSIF (p_choice = 'rock' AND v_cpu_choice = 'scissors') OR
        (p_choice = 'paper' AND v_cpu_choice = 'rock') OR
        (p_choice = 'scissors' AND v_cpu_choice = 'paper') THEN
    v_outcome := 'win';
    v_payout := TRUNC(p_bet * v_win_multiplier, 2);
  ELSE
    v_outcome := 'lose';
    v_payout := 0;
  END IF;

  -- Atomic balance update
  UPDATE users
  SET balance_pgt = balance_pgt - p_bet + v_payout,
      updated_at = NOW()
  WHERE LOWER(wallet_address) = p_wallet 
     OR LOWER(linked_wallet_address) = p_wallet 
     OR LOWER(player_id) = p_wallet
  RETURNING balance_pgt INTO v_new_balance;

  RETURN jsonb_build_object(
    'success', true,
    'outcome', v_outcome,
    'cpu_choice', v_cpu_choice,
    'payout', v_payout,
    'multiplier', CASE WHEN v_outcome = 'win' THEN v_win_multiplier WHEN v_outcome = 'draw' THEN 1.0 ELSE 0.0 END,
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION play_roshambo(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;
