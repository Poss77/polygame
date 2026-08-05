-- ============================================================
-- POLYGAME PLINKO RPC & 95% RTP HOUSE EDGE OVERHAUL
-- Replaces old play_plinko RPC to return exact bucket (0..8) 
-- and enforces 95% RTP (5% bank house edge)
-- ============================================================

DROP FUNCTION IF EXISTS play_plinko(TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION play_plinko(p_wallet TEXT, p_bet NUMERIC) 
RETURNS JSONB
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
  v_step INT;
BEGIN
  IF p_bet <= 0 THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Invalid bet amount'); 
  END IF;

  SELECT balance_pgt INTO v_balance FROM users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN 
    RETURN jsonb_build_object('success', false, 'error', 'User not found'); 
  END IF;

  IF v_balance < p_bet THEN 
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance'); 
  END IF;

  -- 8-row binomial Plinko simulation (50% left / 50% right at each peg)
  FOR v_step IN 1..8 LOOP
    IF random() >= 0.5 THEN
      v_bucket := v_bucket + 1;
    END IF;
  END LOOP;

  -- Bucket to Multiplier map (~95.8% RTP / 4.2% Bank Edge)
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
  SET balance_pgt = balance_pgt - p_bet + v_payout, 
      updated_at = NOW() 
  WHERE LOWER(player_id) = LOWER(v_pid) 
  RETURNING balance_pgt INTO v_new_balance;

  RETURN jsonb_build_object(
    'success', true, 
    'bucket', v_bucket, 
    'multiplier', v_multiplier, 
    'payout', v_payout, 
    'new_balance', v_new_balance
  );
END;
$$;
GRANT EXECUTE ON FUNCTION play_plinko(TEXT, NUMERIC) TO anon, authenticated, service_role;
