-- ==============================================================================
-- POLYGAME SERVER-SIDE PROGRESSIVE JACKPOT AUTO-INCREMENT OVERHAUL
-- ==============================================================================
-- Purpose:
-- 1. Automatically increments `global_jackpot` by 1% of every bet wagered 
--    across all Casino mini-games (Roshambo, Spinner, Plinko, Crash).
-- 2. Fully server-side and atomic with SECURITY DEFINER protection (no public REST tampering).
-- 3. Returns live `jackpot_amount` to client in each RPC response.
-- ==============================================================================

-- Step 1: Ensure global_jackpot table exists and is seeded with min 2,000 PGT
CREATE TABLE IF NOT EXISTS global_jackpot (
  id INT PRIMARY KEY,
  amount NUMERIC DEFAULT 2000,
  current_amount NUMERIC DEFAULT 2000,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO global_jackpot (id, amount, current_amount, updated_at)
VALUES (1, 2000, 2000, NOW())
ON CONFLICT (id) DO UPDATE
SET amount = GREATEST(COALESCE(global_jackpot.amount, 0), COALESCE(global_jackpot.current_amount, 0), 2000),
    current_amount = GREATEST(COALESCE(global_jackpot.amount, 0), COALESCE(global_jackpot.current_amount, 0), 2000),
    updated_at = NOW();

-- Step 2: Ensure RLS allows public SELECT but restricts direct client writes
ALTER TABLE global_jackpot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Jackpot" ON global_jackpot;
CREATE POLICY "Public Read Jackpot" ON global_jackpot FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE ON TABLE global_jackpot FROM anon, authenticated;

-- Step 3: MINI-GAME 1 - Roshambo RPC (95% RTP + 1% Jackpot Contribution)
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
  v_new_jackpot NUMERIC;
  v_rand NUMERIC;
  v_choices TEXT[] := ARRAY['rock', 'paper', 'scissors'];
BEGIN
  p_choice := LOWER(TRIM(p_choice));
  IF v_pid IS NULL OR v_pid = '' THEN v_pid := LOWER(TRIM(p_wallet)); END IF;
  IF p_bet <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid bet amount'); END IF;

  SELECT balance_pgt INTO v_balance FROM users WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User row not found'); END IF;
  IF v_balance < p_bet THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance'); END IF;

  -- 95% RTP: 30% Win (2.0x), 35% Tie (1.0x), 35% Lose (0.0x)
  v_rand := random();
  IF v_rand < 0.30 THEN
    v_outcome := 'win';
    v_payout := p_bet * 2.0;
    IF p_choice = 'rock' THEN v_cpu_choice := 'scissors';
    ELSIF p_choice = 'paper' THEN v_cpu_choice := 'rock';
    ELSE v_cpu_choice := 'paper'; END IF;
  ELSIF v_rand < 0.65 THEN
    v_outcome := 'tie';
    v_payout := p_bet * 1.0;
    v_cpu_choice := p_choice;
  ELSE
    v_outcome := 'lose';
    v_payout := 0.0;
    IF p_choice = 'rock' THEN v_cpu_choice := 'paper';
    ELSIF p_choice = 'paper' THEN v_cpu_choice := 'scissors';
    ELSE v_cpu_choice := 'rock'; END IF;
  END IF;

  -- Update user balance
  UPDATE users 
  SET balance_pgt = balance_pgt - p_bet + v_payout, updated_at = NOW() 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  RETURNING balance_pgt INTO v_new_balance;

  -- Auto-increment Progressive Jackpot by 1% of bet
  UPDATE global_jackpot 
  SET amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
      current_amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
      updated_at = NOW()
  WHERE id = 1
  RETURNING COALESCE(current_amount, amount) INTO v_new_jackpot;

  RETURN jsonb_build_object(
    'success', true, 
    'outcome', v_outcome, 
    'result', v_outcome,
    'cpu_choice', v_cpu_choice, 
    'payout', v_payout, 
    'new_balance', v_new_balance,
    'jackpot_amount', v_new_jackpot
  );
END;
$$;
GRANT EXECUTE ON FUNCTION play_roshambo(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;

-- Step 4: MINI-GAME 2 - Lucky Spinner RPC (1% Jackpot Contribution)
DROP FUNCTION IF EXISTS play_spinner(TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION play_spinner(
  p_wallet TEXT, 
  p_bet NUMERIC
) RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_balance NUMERIC;
  v_rand NUMERIC;
  v_multiplier NUMERIC;
  v_payout NUMERIC;
  v_new_balance NUMERIC;
  v_new_jackpot NUMERIC;
  v_segment INT;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN v_pid := LOWER(TRIM(p_wallet)); END IF;
  IF p_bet <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid bet amount'); END IF;

  SELECT balance_pgt INTO v_balance FROM users WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User row not found'); END IF;
  IF v_balance < p_bet THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance'); END IF;

  v_rand := random();
  IF v_rand < 0.45 THEN v_multiplier := 0; v_segment := 0;
  ELSIF v_rand < 0.70 THEN v_multiplier := 1.2; v_segment := 1;
  ELSIF v_rand < 0.86 THEN v_multiplier := 0.5; v_segment := 2;
  ELSIF v_rand < 0.95 THEN v_multiplier := 2.0; v_segment := 3;
  ELSIF v_rand < 0.985 THEN v_multiplier := 5.0; v_segment := 4;
  ELSE v_multiplier := 10.0; v_segment := 5; END IF;

  v_payout := p_bet * v_multiplier;

  UPDATE users 
  SET balance_pgt = balance_pgt - p_bet + v_payout, updated_at = NOW() 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  RETURNING balance_pgt INTO v_new_balance;

  -- Auto-increment Progressive Jackpot by 1% of bet
  UPDATE global_jackpot 
  SET amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
      current_amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
      updated_at = NOW()
  WHERE id = 1
  RETURNING COALESCE(current_amount, amount) INTO v_new_jackpot;

  RETURN jsonb_build_object(
    'success', true, 
    'multiplier', v_multiplier, 
    'segment', v_segment, 
    'payout', v_payout, 
    'new_balance', v_new_balance,
    'jackpot_amount', v_new_jackpot
  );
END;
$$;
GRANT EXECUTE ON FUNCTION play_spinner(TEXT, NUMERIC) TO anon, authenticated, service_role;

-- Step 5: MINI-GAME 3 - Neon Plinko RPC (95.8% RTP + 1% Jackpot Contribution)
DROP FUNCTION IF EXISTS play_plinko(TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION play_plinko(
  p_wallet TEXT, 
  p_bet NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_balance NUMERIC;
  v_bucket INT := 0;
  v_multiplier NUMERIC;
  v_payout NUMERIC;
  v_new_balance NUMERIC;
  v_new_jackpot NUMERIC;
  v_step INT;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN v_pid := LOWER(TRIM(p_wallet)); END IF;
  IF p_bet <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid bet amount'); END IF;

  SELECT balance_pgt INTO v_balance FROM users WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User row not found'); END IF;
  IF v_balance < p_bet THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance'); END IF;

  -- 8-row binomial Plinko simulation (50% left / 50% right)
  FOR v_step IN 1..8 LOOP
    IF random() >= 0.5 THEN
      v_bucket := v_bucket + 1;
    END IF;
  END LOOP;

  -- Bucket to Multiplier map (~95.8% RTP)
  CASE v_bucket
    WHEN 0 THEN v_multiplier := 16.0;
    WHEN 1 THEN v_multiplier := 3.0;
    WHEN 2 THEN v_multiplier := 1.3;
    WHEN 3 THEN v_multiplier := 0.7;
    WHEN 4 THEN v_multiplier := 0.2;
    WHEN 5 THEN v_multiplier := 0.7;
    WHEN 6 THEN v_multiplier := 1.3;
    WHEN 7 THEN v_multiplier := 3.0;
    WHEN 8 THEN v_multiplier := 16.0;
    ELSE v_multiplier := 0.2;
  END CASE;

  v_payout := ROUND(p_bet * v_multiplier, 2);

  UPDATE users 
  SET balance_pgt = balance_pgt - p_bet + v_payout, updated_at = NOW() 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  RETURNING balance_pgt INTO v_new_balance;

  -- Auto-increment Progressive Jackpot by 1% of bet
  UPDATE global_jackpot 
  SET amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
      current_amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
      updated_at = NOW()
  WHERE id = 1
  RETURNING COALESCE(current_amount, amount) INTO v_new_jackpot;

  RETURN jsonb_build_object(
    'success', true, 
    'bucket', v_bucket, 
    'multiplier', v_multiplier, 
    'payout', v_payout, 
    'new_balance', v_new_balance,
    'jackpot_amount', v_new_jackpot
  );
END;
$$;
GRANT EXECUTE ON FUNCTION play_plinko(TEXT, NUMERIC) TO anon, authenticated, service_role;

-- Step 6: MINI-GAME 4 - Cyber Crash RPC (1% Jackpot Contribution)
DROP FUNCTION IF EXISTS play_crash(TEXT, NUMERIC, NUMERIC);
CREATE OR REPLACE FUNCTION play_crash(
  p_wallet TEXT, 
  p_bet NUMERIC, 
  p_target NUMERIC
) RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_balance NUMERIC;
  v_crash_point NUMERIC;
  v_won BOOLEAN := false;
  v_payout NUMERIC := 0;
  v_new_balance NUMERIC;
  v_new_jackpot NUMERIC;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN v_pid := LOWER(TRIM(p_wallet)); END IF;
  IF p_bet <= 0 OR p_target < 1.01 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid parameters'); END IF;

  SELECT balance_pgt INTO v_balance FROM users WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User row not found'); END IF;
  IF v_balance < p_bet THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance'); END IF;

  v_crash_point := GREATEST(1.00, ROUND((1.0 / (1.0 - (random() * 0.96)))::numeric, 2));
  IF v_crash_point > 100.0 THEN v_crash_point := 100.0; END IF;

  IF v_crash_point >= p_target THEN
    v_won := true;
    v_payout := p_bet * p_target;
  ELSE
    v_won := false;
    v_payout := 0;
  END IF;

  UPDATE users 
  SET balance_pgt = balance_pgt - p_bet + v_payout, updated_at = NOW() 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  RETURNING balance_pgt INTO v_new_balance;

  -- Auto-increment Progressive Jackpot by 1% of bet
  UPDATE global_jackpot 
  SET amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
      current_amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
      updated_at = NOW()
  WHERE id = 1
  RETURNING COALESCE(current_amount, amount) INTO v_new_jackpot;

  RETURN jsonb_build_object(
    'success', true, 
    'won', v_won, 
    'crash_point', v_crash_point, 
    'target', p_target, 
    'payout', v_payout, 
    'new_balance', v_new_balance,
    'jackpot_amount', v_new_jackpot
  );
END;
$$;
GRANT EXECUTE ON FUNCTION play_crash(TEXT, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

-- Step 7: Verification Query (Inspect current jackpot pool)
SELECT id, amount, current_amount, updated_at FROM global_jackpot WHERE id = 1;
