-- ============================================================
-- POLYGAME GLOBAL JACKPOT CLAIM RPC & RETROACTIVE CREDIT FIX
-- Fixes jackpot claim balance credit so won PGT is saved in DB
-- ============================================================

-- 1. Create atomic claim_jackpot RPC with direct balance credit in DB
CREATE OR REPLACE FUNCTION claim_jackpot(
  p_wallet TEXT
) RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_amount NUMERIC := 0;
  v_target_wallet TEXT;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));

  -- Find matching user
  SELECT wallet_address INTO v_target_wallet
  FROM users
  WHERE LOWER(wallet_address) = p_wallet 
     OR LOWER(COALESCE(linked_wallet_address, '')) = p_wallet
     OR LOWER(COALESCE(user_id::text, '')) = p_wallet
  LIMIT 1;

  IF v_target_wallet IS NULL THEN
    v_target_wallet := p_wallet;
  END IF;

  -- Lock and read current jackpot pool
  SELECT current_amount INTO v_amount 
  FROM global_jackpot 
  WHERE id = 1 
  FOR UPDATE;

  IF v_amount IS NULL OR v_amount <= 0 THEN
    v_amount := 1000;
  END IF;

  -- Reset pool to seed amount (500 PGT)
  UPDATE global_jackpot 
  SET current_amount = 500, 
      updated_at = NOW() 
  WHERE id = 1;

  -- Record in winner history
  INSERT INTO jackpot_winners (wallet_address, amount, won_at)
  VALUES (v_target_wallet, v_amount, NOW());

  -- Atomically credit user balance in Supabase DB
  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_amount,
      updated_at = NOW()
  WHERE LOWER(wallet_address) = LOWER(v_target_wallet)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_target_wallet);

  RETURN v_amount;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_jackpot(TEXT) TO anon, authenticated, service_role;

-- 2. Retroactively credit missing 13,951.09 PGT Jackpot to account 0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5
UPDATE users
SET balance_pgt = COALESCE(balance_pgt, 0) + 13951.09,
    updated_at = NOW()
WHERE LOWER(wallet_address) = '0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5'
   OR LOWER(COALESCE(linked_wallet_address, '')) = '0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5';
