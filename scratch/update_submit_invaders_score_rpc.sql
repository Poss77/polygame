-- ============================================================
-- POLYGAME: FIX SUBMIT_INVADERS_SCORE RPC AMBASSADOR 2X MULTIPLIER
-- ============================================================

CREATE OR REPLACE FUNCTION submit_invaders_score(
  p_wallet TEXT,
  p_score INT,
  p_nft_game_multiplier NUMERIC DEFAULT 0,
  p_global_earn_multiplier NUMERIC DEFAULT 1.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet TEXT;
  v_user RECORD;
  v_raw_pgt NUMERIC;
  v_nft_mult NUMERIC;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_total_mult NUMERIC;
  v_payout NUMERIC;
  v_new_balance NUMERIC;
  v_is_new_high BOOLEAN := FALSE;
BEGIN
  v_wallet := LOWER(TRIM(p_wallet));

  SELECT * INTO v_user FROM users WHERE LOWER(wallet_address) = v_wallet FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  v_raw_pgt := p_score * 0.015 * COALESCE(p_global_earn_multiplier, 1.0);
  v_nft_mult := 1.0 + (COALESCE(p_nft_game_multiplier, 0) / 100.0);

  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > NOW() THEN
    v_vip_mult := 2.0;
  END IF;

  IF v_user.is_ambassador IS TRUE THEN
    v_amb_mult := 2.0;
  END IF;

  v_total_mult := v_nft_mult * v_vip_mult * v_amb_mult;
  v_payout := ROUND((v_raw_pgt * v_total_mult)::numeric, 2);

  v_new_balance := COALESCE(v_user.balance_pgt, 0) + v_payout;

  IF p_score > COALESCE(v_user.invaders_highscore, 0) THEN
    v_is_new_high := TRUE;
  END IF;

  UPDATE users SET
    balance_pgt = v_new_balance,
    invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), p_score),
    alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0), p_score),
    updated_at = NOW()
  WHERE LOWER(wallet_address) = v_wallet;

  RETURN jsonb_build_object(
    'success', true,
    'payout', v_payout,
    'new_balance', v_new_balance,
    'new_high_score', v_is_new_high,
    'score', p_score
  );
END;
$$;
