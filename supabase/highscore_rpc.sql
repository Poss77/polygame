-- ============================================================================
-- POLYGAME - ARCADE HIGH SCORES & INVADERS RPC REPAIR SCRIPT
-- Run this in Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- ============================================================================

-- 1. Ensure high score columns exist on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS game_highscore INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invaders_highscore INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS drift_highscore INTEGER DEFAULT 0;

-- 2. Master Arcade High Score Update RPC
CREATE OR REPLACE FUNCTION submit_arcade_highscore(
  p_wallet TEXT,
  p_game_highscore INTEGER DEFAULT NULL,
  p_invaders_highscore INTEGER DEFAULT NULL,
  p_drift_highscore INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE users
  SET game_highscore = GREATEST(COALESCE(game_highscore, 0), COALESCE(p_game_highscore, 0)),
      invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), COALESCE(p_invaders_highscore, 0)),
      drift_highscore = GREATEST(COALESCE(drift_highscore, 0), COALESCE(p_drift_highscore, 0)),
      updated_at = NOW()
  WHERE LOWER(wallet_address) = LOWER(p_wallet);

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;

-- 3. Update submit_invaders_score RPC to use correct column name (invaders_highscore)
DROP FUNCTION IF EXISTS submit_invaders_score(text, integer, numeric, numeric);

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
  v_new_balance NUMERIC;
BEGIN
  IF p_score > 5000 THEN
    p_score := 5000;
  END IF;

  SELECT vip_until, invaders_highscore
  INTO v_vip_until, v_current_high_score
  FROM users
  WHERE LOWER(wallet_address) = LOWER(p_wallet);

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  v_raw_pgt := p_score * 0.015;
  v_final_pgt := v_raw_pgt * (1 + p_nft_game_multiplier / 100.0) * p_global_earn_multiplier;
  
  IF v_vip_until IS NOT NULL AND v_vip_until > v_now THEN
    v_final_pgt := v_final_pgt * 2;
  END IF;

  IF p_score > COALESCE(v_current_high_score, 0) THEN
    UPDATE users
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt,
        invaders_highscore = p_score
    WHERE LOWER(wallet_address) = LOWER(p_wallet)
    RETURNING balance_pgt INTO v_new_balance;
  ELSE
    UPDATE users
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt
    WHERE LOWER(wallet_address) = LOWER(p_wallet)
    RETURNING balance_pgt INTO v_new_balance;
  END IF;

  RETURN json_build_object(
    'success', true,
    'payout', v_final_pgt,
    'new_balance', v_new_balance,
    'new_high_score', (p_score > COALESCE(v_current_high_score, 0)),
    'score', p_score
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION submit_invaders_score(TEXT, INTEGER, NUMERIC, NUMERIC) TO anon, authenticated, service_role;
