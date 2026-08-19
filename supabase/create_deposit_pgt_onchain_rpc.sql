-- ==============================================================================
-- POLYGAME ON-CHAIN DEPOSIT SYSTEM & RPC (SCHEMA HEALED)
-- 1. Creates/heals deposits_history audit table with RLS & indexes
-- 2. Ensures linked_wallet_address column exists on deposits_history
-- 3. Creates SECURITY DEFINER deposit_pgt_onchain RPC function
-- 4. Reimburses the recent 1,000 PGT on-chain deposit for 0xpgt8312e02d37185b5983e6922d1dae1cce
-- ==============================================================================

-- 1. Create or heal deposits_history table
CREATE TABLE IF NOT EXISTS public.deposits_history (
  id BIGSERIAL PRIMARY KEY,
  player_id TEXT NOT NULL,
  linked_wallet_address TEXT,
  amount NUMERIC NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure linked_wallet_address column is added if table was created in earlier run
ALTER TABLE public.deposits_history ADD COLUMN IF NOT EXISTS linked_wallet_address TEXT;

CREATE INDEX IF NOT EXISTS idx_deposits_history_player ON public.deposits_history(lower(player_id), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_history_tx ON public.deposits_history(lower(tx_hash));

-- Enable RLS
ALTER TABLE public.deposits_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on deposits_history" ON public.deposits_history;
CREATE POLICY "Allow public read access on deposits_history" 
  ON public.deposits_history FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Service role full access on deposits_history" ON public.deposits_history;
CREATE POLICY "Service role full access on deposits_history" 
  ON public.deposits_history FOR ALL 
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.deposits_history TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.deposits_history_id_seq TO anon, authenticated, service_role;

-- 2. Create the deposit_pgt_onchain RPC function
DROP FUNCTION IF EXISTS deposit_pgt_onchain(TEXT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS deposit_pgt_onchain(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS deposit_pgt_onchain(TEXT, NUMERIC);

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
  v_pid TEXT;
  v_user RECORD;
  v_new_balance NUMERIC;
  v_effective_tx TEXT;
BEGIN
  p_wallet := LOWER(TRIM(COALESCE(p_wallet, '')));

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid deposit amount');
  END IF;

  -- 1. Resolve player ID
  v_pid := resolve_player_id(p_wallet);
  
  IF v_pid IS NULL OR v_pid = '' THEN
    SELECT player_id INTO v_pid 
    FROM users 
    WHERE LOWER(player_id) = p_wallet 
       OR LOWER(COALESCE(linked_wallet_address, '')) = p_wallet
    LIMIT 1;
  END IF;

  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := p_wallet;
  END IF;

  -- 2. Lock user record FOR UPDATE
  SELECT * INTO v_user
  FROM users
  WHERE LOWER(player_id) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT * INTO v_user
    FROM users
    WHERE LOWER(COALESCE(linked_wallet_address, '')) = p_wallet
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;
  END IF;

  -- 3. Replay Protection on Tx Hash (if provided)
  v_effective_tx := LOWER(TRIM(COALESCE(p_tx_hash_treasury, p_tx_hash_burn, '')));
  IF v_effective_tx != '' AND v_effective_tx != 'undefined' AND v_effective_tx != 'null' THEN
    IF EXISTS (SELECT 1 FROM deposits_history WHERE LOWER(tx_hash) = v_effective_tx) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Transaction hash has already been processed');
    END IF;
  END IF;

  -- 4. Atomically credit user balance_pgt
  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + p_amount,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_user.player_id)
  RETURNING balance_pgt INTO v_new_balance;

  -- 5. Record deposit audit history
  INSERT INTO deposits_history (player_id, linked_wallet_address, amount, tx_hash, created_at)
  VALUES (
    v_user.player_id,
    COALESCE(v_user.linked_wallet_address, p_wallet),
    p_amount,
    v_effective_tx,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance_pgt', v_new_balance,
    'deposited', p_amount,
    'message', 'On-chain PGT deposit credited successfully!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION deposit_pgt_onchain(TEXT, NUMERIC, TEXT, TEXT) TO anon, authenticated, service_role;

-- ==============================================================================
-- 🌟 3. IMMEDIATE REIMBURSEMENT FOR YOUR TEST (1,000 PGT)
-- Adds 1,000 PGT to your player account right away
-- ==============================================================================
UPDATE users
SET balance_pgt = COALESCE(balance_pgt, 0) + 1000,
    updated_at = NOW()
WHERE LOWER(player_id) = '0xpgt8312e02d37185b5983e6922d1dae1cce'
   OR LOWER(COALESCE(linked_wallet_address, '')) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d';
