-- ============================================================================
-- POLYGON GAMING: HARDEN CYBER-CRASH HOUSE EDGE & LOW-MULTIPLIER PENALTY
-- ============================================================================
-- Version: v1.5.360
-- Purpose:
--   1. Implements an 8.0% instant bust rate at 1.00x for ultra-low targets (< 1.05x),
--      imposing a steep ~7.1% house edge against 1.01x automated grinders.
--   2. Implements a standard 4.0% instant bust rate for targets >= 1.05x (~3.8% house edge).
--   3. Restricts Progressive Jackpot wins to wagers with target >= 1.10x
--      (The 1% bet contribution still fuels the pool, turning 1.01x spammers into donors).
--   4. Calibrates continuous crash distribution allowing multipliers up to 100.00x.
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
  v_instant_bust_chance NUMERIC;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN v_pid := LOWER(TRIM(p_wallet)); END IF;
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

GRANT EXECUTE ON FUNCTION public.play_crash(TEXT, NUMERIC, NUMERIC) TO anon, authenticated, service_role;
