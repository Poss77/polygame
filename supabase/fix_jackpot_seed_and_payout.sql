-- ============================================================
-- POLYGAME GLOBAL JACKPOT SEED & PAYOUT CORRECTION SCRIPT
-- Fixes initial seed to 2000 PGT and corrects 10x jackpot payout typo
-- ============================================================

-- 1. Drop existing functions to allow changing return types cleanly
DROP FUNCTION IF EXISTS increment_jackpot(NUMERIC);
DROP FUNCTION IF EXISTS increment_jackpot();
DROP FUNCTION IF EXISTS claim_jackpot(TEXT);

-- 2. Create or update increment_jackpot RPC with 2000 PGT min seed
CREATE OR REPLACE FUNCTION increment_jackpot(p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_amount NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    p_amount := 0;
  END IF;

  INSERT INTO global_jackpot (id, current_amount, updated_at)
  VALUES (1, 2000 + p_amount, NOW())
  ON CONFLICT (id) DO UPDATE
  SET current_amount = GREATEST(global_jackpot.current_amount, 2000) + EXCLUDED.current_amount - 2000,
      updated_at = NOW()
  RETURNING current_amount INTO v_new_amount;

  RETURN v_new_amount;
END;
$$;
GRANT EXECUTE ON FUNCTION increment_jackpot(NUMERIC) TO anon, authenticated, service_role;

-- 3. Create/Update claim_jackpot RPC resetting pool to 2000 PGT seed
CREATE OR REPLACE FUNCTION claim_jackpot(
  p_wallet TEXT
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_amount NUMERIC := 0;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));

  -- Lock and read current jackpot pool
  SELECT current_amount INTO v_amount 
  FROM global_jackpot 
  WHERE id = 1 
  FOR UPDATE;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    v_amount := 2000;
  END IF;

  -- Reset pool to initial seed amount (2000 PGT)
  UPDATE global_jackpot 
  SET current_amount = 2000, 
      updated_at = NOW() 
  WHERE id = 1;

  -- Record in winner history
  INSERT INTO jackpot_winners (wallet_address, amount, won_at)
  VALUES (v_pid, v_amount, NOW());

  -- Atomically credit user balance in Supabase DB
  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_amount,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);

  RETURN v_amount;
END;
$$;
GRANT EXECUTE ON FUNCTION claim_jackpot(TEXT) TO anon, authenticated, service_role;

-- 4. Set current progressive jackpot pool to at least 2000 PGT
INSERT INTO global_jackpot (id, current_amount, updated_at)
VALUES (1, 2000, NOW())
ON CONFLICT (id) DO UPDATE
SET current_amount = GREATEST(global_jackpot.current_amount, 2000),
    updated_at = NOW();

-- 5. Correct 10x jackpot winner record in jackpot_winners (from 13,951.09 to 1,395.11 PGT)
UPDATE jackpot_winners
SET amount = 1395.11
WHERE amount > 10000;
