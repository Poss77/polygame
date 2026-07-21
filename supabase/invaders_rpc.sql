ALTER TABLE users ADD COLUMN IF NOT EXISTS invaders_high_score INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION submit_invaders_score(
  p_wallet TEXT,
  p_score INTEGER,
  p_nft_game_multiplier NUMERIC DEFAULT 0,
  p_global_earn_multiplier NUMERIC DEFAULT 1.0
) RETURNS json AS $$
DECLARE
  v_vip_until TIMESTAMPTZ;
  v_current_high_score INTEGER;
  v_raw_pgt NUMERIC;
  v_final_pgt NUMERIC;
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_score > 5000 THEN
    p_score := 5000;
  END IF;

  SELECT vip_until, invaders_high_score
  INTO v_vip_until, v_current_high_score
  FROM users
  WHERE wallet_address = p_wallet;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  v_raw_pgt := p_score * 0.05;
  
  v_final_pgt := v_raw_pgt * (1 + p_nft_game_multiplier / 100.0) * p_global_earn_multiplier;
  
  IF v_vip_until IS NOT NULL AND v_vip_until > v_now THEN
    v_final_pgt := v_final_pgt * 2;
  END IF;

  IF p_score > COALESCE(v_current_high_score, 0) THEN
    UPDATE users
    SET balance_pgt = balance_pgt + v_final_pgt,
        invaders_high_score = p_score
    WHERE wallet_address = p_wallet;
  ELSE
    UPDATE users
    SET balance_pgt = balance_pgt + v_final_pgt
    WHERE wallet_address = p_wallet;
  END IF;

  RETURN json_build_object(
    'success', true,
    'payout', v_final_pgt,
    'new_high_score', (p_score > COALESCE(v_current_high_score, 0)),
    'score', p_score
  );
END;
$$ LANGUAGE plpgsql;
