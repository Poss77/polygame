-- ============================================================
-- POLYGAME MASTER GAME RPCs LINKED WALLET UPDATE
-- Enables all games (Roshambo, Spinner, Plinko, Crash, Faucet)
-- to recognize users by EITHER primary wallet_address OR linked_wallet_address
-- Run this script in your Supabase SQL Editor
-- ============================================================

-- 1. Roshambo RPC
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
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));
  p_choice := LOWER(TRIM(p_choice));

  IF p_bet <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid bet amount');
  END IF;

  -- Lock user row by wallet_address OR linked_wallet_address
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
    v_payout := p_bet * 2;
  ELSE
    v_outcome := 'lose';
    v_payout := 0;
  END IF;

  -- Atomic balance update
  UPDATE users
  SET balance_pgt = balance_pgt - p_bet + v_payout,
      updated_at = NOW()
  WHERE LOWER(wallet_address) = p_wallet OR LOWER(linked_wallet_address) = p_wallet
  RETURNING balance_pgt INTO v_new_balance;

  RETURN jsonb_build_object(
    'success', true,
    'outcome', v_outcome,
    'cpu_choice', v_cpu_choice,
    'payout', v_payout,
    'new_balance', v_new_balance
  );
END;
$$;

-- 2. Lucky Spinner RPC
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
  IF v_rand < 0.40 THEN v_multiplier := 0;
  ELSIF v_rand < 0.70 THEN v_multiplier := 1.2;
  ELSIF v_rand < 0.90 THEN v_multiplier := 2.0;
  ELSIF v_rand < 0.98 THEN v_multiplier := 5.0;
  ELSE v_multiplier := 10.0;
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
    'segment', CASE 
      WHEN v_multiplier = 0 THEN 0
      WHEN v_multiplier = 1.2 THEN 1
      WHEN v_multiplier = 2.0 THEN 2
      WHEN v_multiplier = 5.0 THEN 4
      ELSE 5
    END,
    'payout', v_payout,
    'new_balance', v_new_balance
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION play_roshambo(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION play_spinner(TEXT, NUMERIC) TO anon, authenticated, service_role;
