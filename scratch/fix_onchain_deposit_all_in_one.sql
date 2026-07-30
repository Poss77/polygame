-- ============================================================
-- POLYGAME COMPLETE ON-CHAIN DEPOSIT & BURN SYSTEM
-- Run this in your Supabase SQL Editor to make deposits work 100%!
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

-- 2. Create deposit_pgt_onchain RPC
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
  v_user RECORD;
  v_new_balance NUMERIC;
  v_burn NUMERIC;
  v_treasury NUMERIC;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid deposit amount');
  END IF;

  -- Atomically update user PGT balance in DB
  UPDATE users
  SET balance_pgt = balance_pgt + p_amount,
      updated_at = NOW()
  WHERE LOWER(wallet_address) = p_wallet OR LOWER(linked_wallet_address) = p_wallet
  RETURNING balance_pgt INTO v_new_balance;

  IF v_new_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'User wallet not found in DB');
  END IF;

  -- Record 50% Burn & 50% Treasury metrics
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

-- 3. Retroactively credit your wallet for the 500 PGT deposited in transactions 0x29a75... & 0x6e8a6...
UPDATE users
SET balance_pgt = balance_pgt + 500,
    updated_at = NOW()
WHERE LOWER(wallet_address) LIKE '0x92206284%' 
   OR LOWER(linked_wallet_address) LIKE '0x92206284%';
