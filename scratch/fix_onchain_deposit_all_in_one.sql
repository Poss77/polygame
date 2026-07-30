-- ============================================================
-- POLYGAME COMPLETE ON-CHAIN DEPOSIT & REPLAY PROTECTION SYSTEM (V4)
-- Includes processed_deposits table to prevent double-claiming transaction hashes
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create global_burn_metrics table if not exists
CREATE TABLE IF NOT EXISTS global_burn_metrics (
  id INT PRIMARY KEY DEFAULT 1,
  total_burned_pgt NUMERIC DEFAULT 0,
  total_treasury_pgt NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE global_burn_metrics ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'global_burn_metrics' AND policyname = 'Allow public read-only access to burn metrics'
  ) THEN
    CREATE POLICY "Allow public read-only access to burn metrics" 
    ON global_burn_metrics FOR SELECT 
    USING (true);
  END IF;
END $$;

INSERT INTO global_burn_metrics (id, total_burned_pgt, total_treasury_pgt)
VALUES (1, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- 2. Create processed_deposits table for Replay Protection
CREATE TABLE IF NOT EXISTS processed_deposits (
  tx_hash TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE processed_deposits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'processed_deposits' AND policyname = 'Allow public read-only access to deposits'
  ) THEN
    CREATE POLICY "Allow public read-only access to deposits" 
    ON processed_deposits FOR SELECT 
    USING (true);
  END IF;
END $$;

-- 3. Create hardened deposit_pgt_onchain RPC with Replay Protection
CREATE OR REPLACE FUNCTION deposit_pgt_onchain(
  p_wallet TEXT,
  p_amount NUMERIC,
  p_tx_hash_burn TEXT DEFAULT '',
  p_tx_hash_treasury TEXT DEFAULT ''
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance NUMERIC;
  v_burn NUMERIC;
  v_treasury NUMERIC;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));
  p_tx_hash_burn := LOWER(TRIM(COALESCE(p_tx_hash_burn, '')));
  p_tx_hash_treasury := LOWER(TRIM(COALESCE(p_tx_hash_treasury, '')));

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid deposit amount');
  END IF;

  -- Replay Protection Check: Ensure tx_hash has not already been claimed
  IF p_tx_hash_burn <> '' THEN
    IF EXISTS (SELECT 1 FROM processed_deposits WHERE tx_hash = p_tx_hash_burn) THEN
      RETURN jsonb_build_object('success', false, 'message', 'This transaction hash has already been processed!');
    END IF;
  END IF;

  IF p_tx_hash_treasury <> '' THEN
    IF EXISTS (SELECT 1 FROM processed_deposits WHERE tx_hash = p_tx_hash_treasury) THEN
      RETURN jsonb_build_object('success', false, 'message', 'This transaction hash has already been processed!');
    END IF;
  END IF;

  -- 1. Atomically update user PGT balance in DB
  UPDATE users
  SET balance_pgt = balance_pgt + p_amount,
      updated_at = NOW()
  WHERE LOWER(wallet_address) = p_wallet 
     OR LOWER(COALESCE(linked_wallet_address, '')) = p_wallet 
     OR LOWER(COALESCE(user_id::text, '')) = p_wallet
  RETURNING balance_pgt INTO v_new_balance;

  -- Fallback substring search if exact match returned null
  IF v_new_balance IS NULL THEN
    UPDATE users
    SET balance_pgt = balance_pgt + p_amount,
        updated_at = NOW()
    WHERE id = (
      SELECT id FROM users 
      WHERE LOWER(wallet_address) LIKE '%' || p_wallet || '%' 
         OR LOWER(COALESCE(linked_wallet_address, '')) LIKE '%' || p_wallet || '%'
      ORDER BY updated_at DESC LIMIT 1
    )
    RETURNING balance_pgt INTO v_new_balance;
  END IF;

  IF v_new_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User wallet not found in DB');
  END IF;

  -- 2. Record transaction hashes to prevent replay claims
  IF p_tx_hash_burn <> '' THEN
    INSERT INTO processed_deposits (tx_hash, wallet_address, amount)
    VALUES (p_tx_hash_burn, p_wallet, p_amount * 0.50)
    ON CONFLICT (tx_hash) DO NOTHING;
  END IF;

  IF p_tx_hash_treasury <> '' THEN
    INSERT INTO processed_deposits (tx_hash, wallet_address, amount)
    VALUES (p_tx_hash_treasury, p_wallet, p_amount * 0.50)
    ON CONFLICT (tx_hash) DO NOTHING;
  END IF;

  -- 3. Record 50% Burn & 50% Treasury metrics
  v_burn := p_amount * 0.50;
  v_treasury := p_amount * 0.50;

  UPDATE global_burn_metrics
  SET total_burned_pgt = total_burned_pgt + v_burn,
      total_treasury_pgt = total_treasury_pgt + v_treasury,
      updated_at = NOW()
  WHERE id = 1;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance_pgt', v_new_balance,
    'deposited', p_amount,
    'burned', v_burn,
    'treasury', v_treasury,
    'message', 'On-chain PGT deposit credited successfully!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION deposit_pgt_onchain(TEXT, NUMERIC, TEXT, TEXT) TO anon, authenticated, service_role;
