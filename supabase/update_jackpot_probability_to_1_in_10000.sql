-- ============================================================================
-- POLYGON GAMING: CALIBRATE GLOBAL PROGRESSIVE JACKPOT PROBABILITY (1/10,000)
-- ============================================================================
-- Version: v1.5.347
-- Purpose:
--   Updates the server-side win probability for the Global Progressive Jackpot
--   across all casino wagering games from 1 in 25,000 (0.00004) to 1 in 10,000 (0.0001).
--   This aligns backend odds with the advertised frontend portal banner:
--   "1% of all bets fuel the pool. 1/10,000 chance to win on any bet!"
--
-- Games Updated:
--   1. Cyber-Roshambo   (play_roshambo)
--   2. Lucky Spinner     (play_spinner)
--   3. Neon Plinko       (play_plinko)
--   4. Cyber-Crash       (play_crash)
--   5. Cyber Mines       (cashout_mines_game)
-- ============================================================================

-- ============================================================================
-- 1. CYBER-ROSHAMBO (play_roshambo)
-- ============================================================================
DROP FUNCTION IF EXISTS public.play_roshambo(TEXT, NUMERIC, TEXT);
CREATE OR REPLACE FUNCTION public.play_roshambo(
  p_wallet TEXT, 
  p_bet NUMERIC, 
  p_choice TEXT
) RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
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
  v_jackpot_won BOOLEAN := false;
  v_jackpot_payout NUMERIC := 0;
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

  -- 1 in 10,000 server-side Progressive Jackpot win roll (0.0001)
  IF random() < 0.0001 THEN
    SELECT COALESCE(current_amount, amount, 2000) INTO v_jackpot_payout FROM global_jackpot WHERE id = 1 FOR UPDATE;
    IF v_jackpot_payout IS NULL OR v_jackpot_payout < 2000 THEN v_jackpot_payout := 2000; END IF;
    
    v_jackpot_won := true;
    v_payout := v_payout + v_jackpot_payout;
    
    UPDATE global_jackpot 
    SET amount = 2000, current_amount = 2000, updated_at = NOW() 
    WHERE id = 1;
    
    INSERT INTO jackpot_winners (wallet_address, amount, won_at)
    VALUES (COALESCE(v_pid, p_wallet), v_jackpot_payout, NOW());
    
    v_new_jackpot := 2000;
  ELSE
    UPDATE global_jackpot 
    SET amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        current_amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        updated_at = NOW()
    WHERE id = 1
    RETURNING COALESCE(current_amount, amount) INTO v_new_jackpot;
  END IF;

  -- Update user balance atomically
  UPDATE users 
  SET balance_pgt = balance_pgt - p_bet + v_payout, updated_at = NOW() 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  RETURNING balance_pgt INTO v_new_balance;

  RETURN jsonb_build_object(
    'success', true, 
    'outcome', v_outcome, 
    'result', v_outcome,
    'cpu_choice', v_cpu_choice, 
    'payout', v_payout, 
    'new_balance', v_new_balance,
    'jackpot_amount', v_new_jackpot,
    'jackpot_won', v_jackpot_won,
    'jackpot_payout', v_jackpot_payout
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.play_roshambo(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;

-- ============================================================================
-- 2. LUCKY SPINNER (play_spinner)
-- ============================================================================
DROP FUNCTION IF EXISTS public.play_spinner(TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION public.play_spinner(
  p_wallet TEXT, 
  p_bet NUMERIC
) RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
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
  v_jackpot_won BOOLEAN := false;
  v_jackpot_payout NUMERIC := 0;
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

  -- 1 in 10,000 server-side Progressive Jackpot win roll (0.0001)
  IF random() < 0.0001 THEN
    SELECT COALESCE(current_amount, amount, 2000) INTO v_jackpot_payout FROM global_jackpot WHERE id = 1 FOR UPDATE;
    IF v_jackpot_payout IS NULL OR v_jackpot_payout < 2000 THEN v_jackpot_payout := 2000; END IF;
    
    v_jackpot_won := true;
    v_payout := v_payout + v_jackpot_payout;
    
    UPDATE global_jackpot 
    SET amount = 2000, current_amount = 2000, updated_at = NOW() 
    WHERE id = 1;
    
    INSERT INTO jackpot_winners (wallet_address, amount, won_at)
    VALUES (COALESCE(v_pid, p_wallet), v_jackpot_payout, NOW());
    
    v_new_jackpot := 2000;
  ELSE
    UPDATE global_jackpot 
    SET amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        current_amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        updated_at = NOW()
    WHERE id = 1
    RETURNING COALESCE(current_amount, amount) INTO v_new_jackpot;
  END IF;

  UPDATE users 
  SET balance_pgt = balance_pgt - p_bet + v_payout, updated_at = NOW() 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  RETURNING balance_pgt INTO v_new_balance;

  RETURN jsonb_build_object(
    'success', true, 
    'multiplier', v_multiplier, 
    'segment', v_segment, 
    'payout', v_payout, 
    'new_balance', v_new_balance,
    'jackpot_amount', v_new_jackpot,
    'jackpot_won', v_jackpot_won,
    'jackpot_payout', v_jackpot_payout
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.play_spinner(TEXT, NUMERIC) TO anon, authenticated, service_role;

-- ============================================================================
-- 3. NEON PLINKO (play_plinko)
-- ============================================================================
DROP FUNCTION IF EXISTS public.play_plinko(TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION public.play_plinko(
  p_wallet TEXT, 
  p_bet NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_jackpot_won BOOLEAN := false;
  v_jackpot_payout NUMERIC := 0;
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

  -- 1 in 10,000 server-side Progressive Jackpot win roll (0.0001)
  IF random() < 0.0001 THEN
    SELECT COALESCE(current_amount, amount, 2000) INTO v_jackpot_payout FROM global_jackpot WHERE id = 1 FOR UPDATE;
    IF v_jackpot_payout IS NULL OR v_jackpot_payout < 2000 THEN v_jackpot_payout := 2000; END IF;
    
    v_jackpot_won := true;
    v_payout := v_payout + v_jackpot_payout;
    
    UPDATE global_jackpot 
    SET amount = 2000, current_amount = 2000, updated_at = NOW() 
    WHERE id = 1;
    
    INSERT INTO jackpot_winners (wallet_address, amount, won_at)
    VALUES (COALESCE(v_pid, p_wallet), v_jackpot_payout, NOW());
    
    v_new_jackpot := 2000;
  ELSE
    UPDATE global_jackpot 
    SET amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        current_amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        updated_at = NOW()
    WHERE id = 1
    RETURNING COALESCE(current_amount, amount) INTO v_new_jackpot;
  END IF;

  UPDATE users 
  SET balance_pgt = balance_pgt - p_bet + v_payout, updated_at = NOW() 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  RETURNING balance_pgt INTO v_new_balance;

  RETURN jsonb_build_object(
    'success', true, 
    'bucket', v_bucket, 
    'multiplier', v_multiplier, 
    'payout', v_payout, 
    'new_balance', v_new_balance,
    'jackpot_amount', v_new_jackpot,
    'jackpot_won', v_jackpot_won,
    'jackpot_payout', v_jackpot_payout
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.play_plinko(TEXT, NUMERIC) TO anon, authenticated, service_role;

-- ============================================================================
-- 4. CYBER-CRASH (play_crash)
-- ============================================================================
DROP FUNCTION IF EXISTS public.play_crash(TEXT, NUMERIC, NUMERIC);
CREATE OR REPLACE FUNCTION public.play_crash(
  p_wallet TEXT, 
  p_bet NUMERIC, 
  p_target NUMERIC
) RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_balance NUMERIC;
  v_crash_point NUMERIC;
  v_won BOOLEAN := false;
  v_payout NUMERIC := 0;
  v_new_balance NUMERIC;
  v_new_jackpot NUMERIC;
  v_jackpot_won BOOLEAN := false;
  v_jackpot_payout NUMERIC := 0;
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

  -- 1 in 10,000 server-side Progressive Jackpot win roll (0.0001)
  IF random() < 0.0001 THEN
    SELECT COALESCE(current_amount, amount, 2000) INTO v_jackpot_payout FROM global_jackpot WHERE id = 1 FOR UPDATE;
    IF v_jackpot_payout IS NULL OR v_jackpot_payout < 2000 THEN v_jackpot_payout := 2000; END IF;
    
    v_jackpot_won := true;
    v_payout := v_payout + v_jackpot_payout;
    
    UPDATE global_jackpot 
    SET amount = 2000, current_amount = 2000, updated_at = NOW() 
    WHERE id = 1;
    
    INSERT INTO jackpot_winners (wallet_address, amount, won_at)
    VALUES (COALESCE(v_pid, p_wallet), v_jackpot_payout, NOW());
    
    v_new_jackpot := 2000;
  ELSE
    UPDATE global_jackpot 
    SET amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        current_amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        updated_at = NOW()
    WHERE id = 1
    RETURNING COALESCE(current_amount, amount) INTO v_new_jackpot;
  END IF;

  UPDATE users 
  SET balance_pgt = balance_pgt - p_bet + v_payout, updated_at = NOW() 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  RETURNING balance_pgt INTO v_new_balance;

  RETURN jsonb_build_object(
    'success', true, 
    'won', v_won, 
    'crash_point', v_crash_point, 
    'target', p_target, 
    'payout', v_payout, 
    'new_balance', v_new_balance,
    'jackpot_amount', v_new_jackpot,
    'jackpot_won', v_jackpot_won,
    'jackpot_payout', v_jackpot_payout
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.play_crash(TEXT, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

-- ============================================================================
-- 5. CYBER MINES (cashout_mines_game)
-- ============================================================================
DROP FUNCTION IF EXISTS public.cashout_mines_game(TEXT, BIGINT);
CREATE OR REPLACE FUNCTION public.cashout_mines_game(
  p_wallet TEXT,
  p_session_id BIGINT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_session RECORD;
  v_multiplier NUMERIC;
  v_payout NUMERIC := 0;
  v_new_balance NUMERIC;
  v_new_jackpot NUMERIC;
  v_jackpot_won BOOLEAN := false;
  v_jackpot_payout NUMERIC := 0;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN v_pid := LOWER(TRIM(p_wallet)); END IF;

  -- Lock active session
  SELECT * INTO v_session 
  FROM mines_sessions 
  WHERE id = p_session_id 
    AND (LOWER(player_id) = LOWER(v_pid) OR LOWER(wallet_address) = LOWER(v_pid))
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active game session not found');
  END IF;

  IF COALESCE(array_length(v_session.revealed_tiles, 1), 0) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Must reveal at least 1 safe tile to cash out');
  END IF;

  -- Calculate payout based on verified current multiplier (capped at 1,000x)
  v_multiplier := LEAST(COALESCE(v_session.current_multiplier, 1.00), 1000.00);
  v_payout := ROUND(v_session.bet_amount * v_multiplier, 2);

  -- 1 in 10,000 server-side Progressive Jackpot win roll on cashout (0.0001)
  IF random() < 0.0001 THEN
    SELECT COALESCE(current_amount, amount, 2000) INTO v_jackpot_payout 
    FROM global_jackpot WHERE id = 1 FOR UPDATE;
    
    IF v_jackpot_payout IS NULL OR v_jackpot_payout < 2000 THEN 
      v_jackpot_payout := 2000; 
    END IF;
    
    v_jackpot_won := true;
    v_payout := v_payout + v_jackpot_payout;
    
    UPDATE global_jackpot 
    SET amount = 2000, current_amount = 2000, updated_at = NOW() 
    WHERE id = 1;
    
    INSERT INTO jackpot_winners (wallet_address, amount, won_at)
    VALUES (COALESCE(v_pid, p_wallet), v_jackpot_payout, NOW());
    
    v_new_jackpot := 2000;
  ELSE
    SELECT COALESCE(current_amount, amount, 2000) INTO v_new_jackpot 
    FROM global_jackpot WHERE id = 1;
  END IF;

  -- Credit payout to user balance
  UPDATE users
  SET balance_pgt = balance_pgt + v_payout, updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid)
  RETURNING balance_pgt INTO v_new_balance;

  -- Mark session as cashed out
  UPDATE mines_sessions
  SET status = 'cashed_out',
      payout = v_payout,
      current_multiplier = v_multiplier,
      updated_at = NOW()
  WHERE id = p_session_id;

  -- Log game metrics to game_metrics table for Admin Panel House Net Profit tracking
  BEGIN
    PERFORM log_game_metric('Cyber Mines', v_session.bet_amount, v_payout, 1);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'payout', v_payout,
    'multiplier', v_multiplier,
    'new_balance', v_new_balance,
    'all_mines', v_session.mine_positions,
    'jackpot_won', v_jackpot_won,
    'jackpot_payout', v_jackpot_payout,
    'jackpot_amount', v_new_jackpot
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.cashout_mines_game(TEXT, BIGINT) TO anon, authenticated, service_role;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
