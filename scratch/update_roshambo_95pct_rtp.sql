-- ============================================================
-- POLYGAME ROSHAMBO 95% RTP NATURAL DISTRIBUTED RPC UPDATE
-- Applies stealth 95% RTP with natural tie frequencies & full 2.0x wins:
-- 30% Player Win (2.0x) + 35% Tie (1.0x) + 35% CPU Win (0x) = 95.0% RTP
-- Uses resolve_player_id(p_wallet) instead of missing wallet_address column!
-- Run this script in your Supabase SQL Editor!
-- ============================================================

DROP FUNCTION IF EXISTS play_roshambo(TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION play_roshambo(
  p_wallet TEXT,
  p_bet NUMERIC,
  p_choice TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_balance NUMERIC;
  v_cpu_choice TEXT;
  v_outcome TEXT;
  v_payout NUMERIC := 0;
  v_new_balance NUMERIC;
  v_rand NUMERIC;
BEGIN
  p_choice := LOWER(TRIM(p_choice));

  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_wallet));
  END IF;

  IF p_bet <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid bet amount');
  END IF;

  -- Lock user row by player_id OR linked_wallet_address
  SELECT balance_pgt INTO v_balance
  FROM users
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(linked_wallet_address) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User row not found in database');
  END IF;

  IF v_balance < p_bet THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance');
  END IF;

  -- Stealth 95% RTP natural outcome weighting (2.0x payout)
  -- 30% Player Win (2.0x) + 35% Tie (1.0x) + 35% CPU Win (0x) = 95.0% RTP (5% House Edge)
  v_rand := random();

  IF v_rand < 0.30 THEN
    -- Player Wins (2.0x) - 30% Probability
    v_outcome := 'win';
    v_payout := p_bet * 2.0;
    IF p_choice = 'rock' THEN v_cpu_choice := 'scissors';
    ELSIF p_choice = 'paper' THEN v_cpu_choice := 'rock';
    ELSE v_cpu_choice := 'paper';
    END IF;

  ELSIF v_rand < 0.65 THEN
    -- Tie (1.0x) - 35% Probability
    v_outcome := 'draw';
    v_payout := p_bet;
    v_cpu_choice := p_choice;

  ELSE
    -- CPU Wins (0x) - 35% Probability
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
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(linked_wallet_address) = LOWER(v_pid)
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
