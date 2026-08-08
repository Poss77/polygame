-- ============================================================
-- POLYGAME ROSHAMBO 95% RTP BEHIND-THE-SCENES RPC UPDATE
-- Keeps 2.0x Win Payouts looking 100% standard in the UI,
-- while applying a stealth 95% RTP RNG weighting:
-- 45% Player Win (2.0x) + 5% Tie (1.0x) + 50% CPU Win (0x) = 95% RTP
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
  v_rand NUMERIC;
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

  -- Stealth 95% RTP RNG outcome weighting (2.0x payout)
  -- 45% Player Win (2.0x) + 5% Tie (1.0x) + 50% CPU Win (0x) = 95.0% RTP (5% House Edge)
  v_rand := random();

  IF v_rand < 0.45 THEN
    -- Player Wins (2.0x)
    v_outcome := 'win';
    v_payout := p_bet * 2.0;
    IF p_choice = 'rock' THEN v_cpu_choice := 'scissors';
    ELSIF p_choice = 'paper' THEN v_cpu_choice := 'rock';
    ELSE v_cpu_choice := 'paper';
    END IF;

  ELSIF v_rand < 0.50 THEN
    -- Tie (1.0x)
    v_outcome := 'draw';
    v_payout := p_bet;
    v_cpu_choice := p_choice;

  ELSE
    -- CPU Wins (0x)
    v_outcome := 'lose';
    v_payout := 0;
    IF p_choice = 'rock' THEN v_cpu_choice := 'paper';
    ELSIF p_choice = 'paper' THEN v_cpu_choice := 'scissors';
    ELSE v_cpu_choice := 'rock';
    END IF;
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
    'multiplier', CASE WHEN v_outcome = 'win' THEN 2.0 WHEN v_outcome = 'draw' THEN 1.0 ELSE 0.0 END,
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION play_roshambo(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;
