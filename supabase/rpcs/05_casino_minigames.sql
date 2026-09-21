-- 5. CASINO MINI-GAMES & MINES (1 IN 10,000 PROGRESSIVE JACKPOT)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: play_roshambo
-- Source: update_jackpot_probability_to_1_in_10000.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.play_roshambo(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS play_roshambo(TEXT, NUMERIC, TEXT);
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
  v_guard RECORD;
  v_pid TEXT;
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
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  p_choice := LOWER(TRIM(p_choice));
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
GRANT EXECUTE ON FUNCTION public.play_roshambo(TEXT, NUMERIC, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.play_roshambo(TEXT, NUMERIC, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: play_spinner
-- Source: update_jackpot_probability_to_1_in_10000.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.play_spinner(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS play_spinner(TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION public.play_spinner(
  p_wallet TEXT, 
  p_bet NUMERIC
) RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
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
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

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
GRANT EXECUTE ON FUNCTION public.play_spinner(TEXT, NUMERIC) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.play_spinner(TEXT, NUMERIC) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: play_plinko
-- Source: update_jackpot_probability_to_1_in_10000.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.play_plinko(TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS play_plinko(TEXT, NUMERIC, NUMERIC);
CREATE OR REPLACE FUNCTION public.play_plinko(
  p_wallet TEXT, 
  p_bet NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
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
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

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
GRANT EXECUTE ON FUNCTION public.play_plinko(TEXT, NUMERIC) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.play_plinko(TEXT, NUMERIC) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: play_crash
-- Source: harden_crash_house_edge_and_jackpot_rules.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.play_crash(TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS play_crash(TEXT, NUMERIC, NUMERIC);
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
  v_guard RECORD;
  v_pid TEXT;
  v_balance NUMERIC;
  v_crash_point NUMERIC;
  v_won BOOLEAN := false;
  v_payout NUMERIC := 0;
  v_new_balance NUMERIC;
  v_new_jackpot NUMERIC;
  v_jackpot_won BOOLEAN := false;
  v_jackpot_payout NUMERIC := 0;
  v_instant_bust_chance NUMERIC;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  IF p_bet <= 0 OR p_target < 1.01 THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Invalid parameters'); 
  END IF;

  SELECT balance_pgt INTO v_balance FROM users 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  FOR UPDATE;

  IF NOT FOUND THEN 
    RETURN jsonb_build_object('success', false, 'error', 'User row not found'); 
  END IF;
  
  IF v_balance < p_bet THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance'); 
  END IF;

  -- --------------------------------------------------------------------------
  -- 1. CRASH POINT CALCULATION WITH LOW-MULTIPLIER HOUSE EDGE PENALTY
  -- --------------------------------------------------------------------------
  -- If player targets ultra-low multipliers (< 1.05x), bust chance is 8.0% (-7.08% EV)
  -- If player targets standard multipliers (>= 1.05x), bust chance is 4.0% (-3.84% EV)
  IF p_target < 1.05 THEN
    v_instant_bust_chance := 0.080; -- 8.0% instant crash at 1.00x
  ELSE
    v_instant_bust_chance := 0.040; -- 4.0% instant crash at 1.00x
  END IF;

  IF random() < v_instant_bust_chance THEN
    v_crash_point := 1.00;
  ELSE
    -- Inverse uniform crash distribution (RTP = 0.96) up to 100.00x
    v_crash_point := GREATEST(1.01, ROUND((0.96 / (1.0 - (random() * 0.9904)))::numeric, 2));
    IF v_crash_point > 100.0 THEN v_crash_point := 100.0; END IF;
  END IF;

  -- Win / loss determination
  IF v_crash_point >= p_target THEN
    v_won := true;
    v_payout := p_bet * p_target;
  ELSE
    v_won := false;
    v_payout := 0;
  END IF;

  -- --------------------------------------------------------------------------
  -- 2. PROGRESSIVE JACKPOT (1 in 10,000 roll)
  -- --------------------------------------------------------------------------
  -- Qualification Rule: Player must target >= 1.10x to be eligible to win.
  -- 1.01x grinders still feed the 1% contribution, but cannot win the pool.
  IF p_target >= 1.10 AND random() < 0.0001 THEN
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
    -- 1% of every wager fuels the jackpot pool
    UPDATE global_jackpot 
    SET amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        current_amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
        updated_at = NOW()
    WHERE id = 1
    RETURNING COALESCE(current_amount, amount) INTO v_new_jackpot;
  END IF;

  -- --------------------------------------------------------------------------
  -- 3. BALANCE SETTLEMENT
  -- --------------------------------------------------------------------------
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

GRANT EXECUTE ON FUNCTION public.play_crash(TEXT, NUMERIC, NUMERIC) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.play_crash(TEXT, NUMERIC, NUMERIC) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: compute_mines_multiplier
-- Source: mines_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.compute_mines_multiplier(INT, INT, NUMERIC);
DROP FUNCTION IF EXISTS public.compute_mines_multiplier(INT, INT);
DROP FUNCTION IF EXISTS compute_mines_multiplier(INT, INT, NUMERIC);
DROP FUNCTION IF EXISTS compute_mines_multiplier(INT, INT);
CREATE OR REPLACE FUNCTION compute_mines_multiplier(p_mines INT, p_step INT, p_rtp NUMERIC DEFAULT 0.94)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_mult NUMERIC := p_rtp;
  v_total_tiles NUMERIC := 25.0;
  v_safe_tiles NUMERIC := 25.0 - p_mines;
  i INT;
BEGIN
  IF p_step < 1 OR p_step > v_safe_tiles THEN
    RETURN 0;
  END IF;

  FOR i IN 0..(p_step - 1) LOOP
    v_mult := v_mult * ((v_total_tiles - i) / (v_safe_tiles - i));
  END LOOP;

  RETURN ROUND(v_mult, 2);
END;
$$;
GRANT EXECUTE ON FUNCTION compute_mines_multiplier(INT, INT, NUMERIC) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: start_mines_game
-- Source: mines_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.start_mines_game(TEXT, NUMERIC, INT);
DROP FUNCTION IF EXISTS start_mines_game(TEXT, NUMERIC, INT);
CREATE OR REPLACE FUNCTION start_mines_game(
  p_wallet TEXT,
  p_bet NUMERIC,
  p_mines INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_balance NUMERIC;
  v_mines_count INT := GREATEST(1, LEAST(24, COALESCE(p_mines, 3)));
  v_mine_positions INT[] := '{}';
  v_pos INT;
  v_session_id BIGINT;
  v_next_mult NUMERIC;
  v_new_jackpot NUMERIC;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  IF p_bet < 10 THEN RETURN jsonb_build_object('success', false, 'error', 'Minimum bet is 10 PGT'); END IF;

  -- Lock user row and check balance
  SELECT balance_pgt INTO v_balance 
  FROM users 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User row not found'); END IF;
  IF v_balance < p_bet THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance'); END IF;

  -- Deduct bet upfront immediately
  UPDATE users 
  SET balance_pgt = balance_pgt - p_bet, updated_at = NOW() 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid);

  -- 1% of bet contributed to Global Progressive Jackpot
  UPDATE global_jackpot 
  SET amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
      current_amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
      updated_at = NOW()
  WHERE id = 1
  RETURNING COALESCE(current_amount, amount) INTO v_new_jackpot;

  -- Expire any previous unclosed active sessions for this player
  UPDATE mines_sessions
  SET status = 'busted', updated_at = NOW()
  WHERE (LOWER(player_id) = LOWER(v_pid) OR LOWER(wallet_address) = LOWER(v_pid))
    AND status = 'active';

  -- Generate M distinct random mine coordinates (0..24)
  WHILE array_length(v_mine_positions, 1) IS NULL OR array_length(v_mine_positions, 1) < v_mines_count LOOP
    v_pos := FLOOR(random() * 25)::INT;
    IF NOT (v_mine_positions @> ARRAY[v_pos]) THEN
      v_mine_positions := array_append(v_mine_positions, v_pos);
    END IF;
  END LOOP;

  -- Calculate first step multiplier preview (94% RTP with 1,000x cap)
  v_next_mult := compute_mines_multiplier(v_mines_count, 1, 0.94);

  -- Create active session in DB
  INSERT INTO mines_sessions (
    player_id,
    wallet_address,
    bet_amount,
    mines_count,
    mine_positions,
    revealed_tiles,
    current_multiplier,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_pid,
    p_wallet,
    p_bet,
    v_mines_count,
    v_mine_positions,
    '{}',
    1.00,
    'active',
    NOW(),
    NOW()
  ) RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'mines_count', v_mines_count,
    'next_multiplier', v_next_mult,
    'jackpot_amount', v_new_jackpot
  );
END;
$$;
GRANT EXECUTE ON FUNCTION start_mines_game(TEXT, NUMERIC, INT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION start_mines_game(TEXT, NUMERIC, INT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: reveal_mines_tile
-- Source: mines_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.reveal_mines_tile(TEXT, BIGINT, INT);
DROP FUNCTION IF EXISTS public.reveal_mines_tile(TEXT, UUID, INT);
DROP FUNCTION IF EXISTS reveal_mines_tile(TEXT, BIGINT, INT);
DROP FUNCTION IF EXISTS reveal_mines_tile(TEXT, UUID, INT);
CREATE OR REPLACE FUNCTION reveal_mines_tile(
  p_wallet TEXT,
  p_session_id BIGINT,
  p_tile_index INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_session RECORD;
  v_is_mine BOOLEAN;
  v_revealed_count INT;
  v_safe_total INT;
  v_current_mult NUMERIC;
  v_next_mult NUMERIC;
  v_all_cleared BOOLEAN := false;
  v_payout NUMERIC := 0;
  v_new_balance NUMERIC;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  IF p_tile_index < 0 OR p_tile_index > 24 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid tile index');
  END IF;

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

  -- Check if tile was already revealed
  IF v_session.revealed_tiles @> ARRAY[p_tile_index] THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tile already revealed');
  END IF;

  -- Check if tile is a mine
  v_is_mine := (v_session.mine_positions @> ARRAY[p_tile_index]);

  IF v_is_mine THEN
    -- MINE HIT: Round lost!
    UPDATE mines_sessions
    SET status = 'busted',
        payout = 0,
        revealed_tiles = array_append(revealed_tiles, p_tile_index),
        updated_at = NOW()
    WHERE id = p_session_id;

    -- Log Game Metrics (Wager lost, 0 payout)
    BEGIN
      PERFORM log_game_metric('Cyber Mines', v_session.bet_amount, 0, 1);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'mine',
      'tile_hit', p_tile_index,
      'all_mines', v_session.mine_positions,
      'payout', 0
    );
  ELSE
    -- SAFE GEM HIT!
    v_revealed_count := COALESCE(array_length(v_session.revealed_tiles, 1), 0) + 1;
    v_safe_total := 25 - v_session.mines_count;
    v_current_mult := compute_mines_multiplier(v_session.mines_count, v_revealed_count, 0.94);

    -- Check if all safe tiles found OR reached 1,000x max multiplier cap!
    IF v_revealed_count >= v_safe_total OR v_current_mult >= 1000.00 THEN
      v_all_cleared := true;
      v_current_mult := LEAST(v_current_mult, 1000.00);
      v_payout := ROUND(v_session.bet_amount * v_current_mult, 2);

      -- Settle win in users table
      UPDATE users
      SET balance_pgt = balance_pgt + v_payout, updated_at = NOW()
      WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid)
      RETURNING balance_pgt INTO v_new_balance;

      -- Mark session cashed out
      UPDATE mines_sessions
      SET status = 'cashed_out',
          payout = v_payout,
          current_multiplier = v_current_mult,
          revealed_tiles = array_append(revealed_tiles, p_tile_index),
          updated_at = NOW()
      WHERE id = p_session_id;

      -- Log Game Metrics
      BEGIN
        PERFORM log_game_metric('Cyber Mines', v_session.bet_amount, v_payout, 1);
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

      RETURN jsonb_build_object(
        'success', true,
        'status', 'gem',
        'tile', p_tile_index,
        'revealed_count', v_revealed_count,
        'current_multiplier', v_current_mult,
        'next_multiplier', v_current_mult,
        'all_cleared', true,
        'payout', v_payout,
        'new_balance', v_new_balance,
        'all_mines', v_session.mine_positions
      );
    ELSE
      -- Still more safe tiles remaining
      v_next_mult := compute_mines_multiplier(v_session.mines_count, v_revealed_count + 1, 0.94);

      UPDATE mines_sessions
      SET current_multiplier = v_current_mult,
          revealed_tiles = array_append(revealed_tiles, p_tile_index),
          updated_at = NOW()
      WHERE id = p_session_id;

      RETURN jsonb_build_object(
        'success', true,
        'status', 'gem',
        'tile', p_tile_index,
        'revealed_count', v_revealed_count,
        'current_multiplier', v_current_mult,
        'next_multiplier', v_next_mult,
        'all_cleared', false
      );
    END IF;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION reveal_mines_tile(TEXT, BIGINT, INT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION reveal_mines_tile(TEXT, BIGINT, INT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: cashout_mines_game
-- Source: mines_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.cashout_mines_game(TEXT, BIGINT);
DROP FUNCTION IF EXISTS public.cashout_mines_game(TEXT, UUID);
DROP FUNCTION IF EXISTS cashout_mines_game(TEXT, BIGINT);
DROP FUNCTION IF EXISTS cashout_mines_game(TEXT, UUID);
CREATE OR REPLACE FUNCTION cashout_mines_game(
  p_wallet TEXT,
  p_session_id BIGINT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_session RECORD;
  v_multiplier NUMERIC;
  v_payout NUMERIC := 0;
  v_new_balance NUMERIC;
  v_new_jackpot NUMERIC;
  v_jackpot_won BOOLEAN := false;
  v_jackpot_payout NUMERIC := 0;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

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

  -- 1 in 25,000 server-side Progressive Jackpot win roll on cashout
  IF random() < 0.00004 THEN
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
GRANT EXECUTE ON FUNCTION cashout_mines_game(TEXT, BIGINT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION cashout_mines_game(TEXT, BIGINT) FROM anon;


-- ==============================================================================
