-- ============================================================
-- POLYGAME UNIFIED PLAYER ID MIGRATION & MSD CRYPTO STAKE RESTORATION (v1.4.224)
-- Run this script in your Supabase SQL Editor to migrate wallet_address -> player_id
-- ============================================================

-- 1. Ensure player_id and linked_wallet_address columns exist on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS player_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linked_wallet_address TEXT;

-- 2. Migrate existing wallet_address data to player_id & linked_wallet_address
-- Case A: Internal addresses starting with '0xpgt' or '0xg' become player_id directly
UPDATE users
SET player_id = wallet_address
WHERE (wallet_address ILIKE '0xpgt%' OR wallet_address ILIKE '0xg%')
  AND (player_id IS NULL OR player_id = '');

-- Case B: Legacy accounts with raw EVM wallet_address (0x...)
-- Copy raw EVM address to linked_wallet_address and generate internal player_id (0xpgt...)
UPDATE users
SET linked_wallet_address = wallet_address,
    player_id = '0xpgt' || SUBSTRING(MD5(wallet_address || RANDOM()::text || CLOCK_TIMESTAMP()::text) FROM 1 FOR 36)
WHERE wallet_address NOT ILIKE '0xpgt%' 
  AND wallet_address NOT ILIKE '0xg%'
  AND (player_id IS NULL OR player_id = '');

-- Fill any remaining null player_id values fallback
UPDATE users
SET player_id = COALESCE(wallet_address, '0xpgt' || SUBSTRING(MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text) FROM 1 FOR 36))
WHERE player_id IS NULL OR player_id = '';

-- Create indexes for fast performance
CREATE INDEX IF NOT EXISTS idx_users_player_id ON users (LOWER(player_id));
CREATE INDEX IF NOT EXISTS idx_users_linked_wallet ON users (LOWER(linked_wallet_address));

-- ============================================================
-- 3. MSD CRYPTO ACCOUNT CONSOLIDATION & 70K PGT STAKE RESTORATION
-- MSD Crypto Primary Player ID: '0xpgtf6a9a748636544a9a83d80cef9a8a40900000'
-- MSD Crypto Web3 EVM Address: '0xff340a5c95d18e77677cd6dd3f4691a15433f3cd'
-- ============================================================

-- Ensure primary record has linked_wallet_address set correctly
UPDATE users
SET linked_wallet_address = '0xff340a5c95d18e77677cd6dd3f4691a15433f3cd',
    updated_at = NOW()
WHERE LOWER(player_id) = '0xpgtf6a9a748636544a9a83d80cef9a8a40900000'
   OR LOWER(COALESCE(email, '')) = 'danmtr21@gmail.com';

-- Merge any secondary row that was created under '0xff340a5c95d18e77677cd6dd3f4691a15433f3cd'
DO $$
DECLARE
  v_primary_id TEXT := '0xpgtf6a9a748636544a9a83d80cef9a8a40900000';
  v_evm_addr TEXT := '0xff340a5c95d18e77677cd6dd3f4691a15433f3cd';
  v_has_stake BOOLEAN := FALSE;
BEGIN
  -- Re-point any user_stakes recorded under the EVM address to the primary player_id
  UPDATE user_stakes
  SET wallet_address = v_primary_id
  WHERE LOWER(wallet_address) = v_evm_addr;

  -- Check if 70,000 PGT active stake exists for MSD Crypto
  SELECT EXISTS (
    SELECT 1 FROM user_stakes 
    WHERE (LOWER(wallet_address) = v_primary_id OR LOWER(wallet_address) = v_evm_addr)
      AND amount >= 70000 
      AND active = true
  ) INTO v_has_stake;

  -- If 70k PGT stake is not in user_stakes table, insert it directly for MSD Crypto
  IF NOT v_has_stake THEN
    INSERT INTO user_stakes (
      wallet_address,
      pool,
      amount,
      tier,
      apy,
      staked_at,
      lock_until,
      last_harvest,
      active
    ) VALUES (
      v_primary_id,
      'pgt',
      70000,
      'month',
      200.0, -- 200% APY
      NOW() - INTERVAL '1 day',
      NOW() + INTERVAL '29 days',
      NOW(),
      true
    );

    -- Update staked_balance_pgt in users table
    UPDATE users
    SET staked_balance_pgt = COALESCE(staked_balance_pgt, 0) + 70000,
        updated_at = NOW()
    WHERE LOWER(player_id) = v_primary_id
       OR LOWER(COALESCE(email, '')) = 'danmtr21@gmail.com';
  END IF;
END $$;

-- ============================================================
-- 4. UNIFIED STAKING RPC FUNCTIONS (RESOLVES VIA PLAYER_ID)
-- ============================================================

CREATE OR REPLACE FUNCTION get_user_stakes(
  p_wallet TEXT
) RETURNS json 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player_id TEXT;
  v_stakes json;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));

  SELECT player_id INTO v_player_id
  FROM users
  WHERE LOWER(player_id) = p_wallet 
     OR LOWER(COALESCE(linked_wallet_address, '')) = p_wallet
     OR LOWER(COALESCE(user_id::text, '')) = p_wallet
  LIMIT 1;

  IF v_player_id IS NULL THEN
    v_player_id := p_wallet;
  END IF;

  SELECT json_agg(row_to_json(s)) INTO v_stakes
  FROM (
    SELECT id, pool, amount, tier, apy, 
           (EXTRACT(EPOCH FROM staked_at) * 1000) as "stakedAt",
           (EXTRACT(EPOCH FROM lock_until) * 1000) as "lockUntil",
           (EXTRACT(EPOCH FROM last_harvest) * 1000) as "lastHarvest",
           active
    FROM user_stakes
    WHERE (LOWER(wallet_address) = LOWER(v_player_id) OR LOWER(wallet_address) = p_wallet) 
      AND active = true
  ) s;
  
  RETURN json_build_object('success', true, 'stakes', COALESCE(v_stakes, '[]'::json));
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_stakes(TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION deposit_stake(
  p_wallet TEXT,
  p_pool TEXT,
  p_amount NUMERIC,
  p_tier TEXT,
  p_apy NUMERIC,
  p_duration_ms BIGINT
) RETURNS json 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player_id TEXT;
  v_balance NUMERIC;
  v_now TIMESTAMPTZ := now();
  v_lock_until TIMESTAMPTZ;
  v_stake_id UUID;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid deposit amount');
  END IF;

  SELECT player_id INTO v_player_id
  FROM users
  WHERE LOWER(player_id) = p_wallet 
     OR LOWER(COALESCE(linked_wallet_address, '')) = p_wallet
     OR LOWER(COALESCE(user_id::text, '')) = p_wallet
  LIMIT 1;

  IF v_player_id IS NULL THEN
    v_player_id := p_wallet;
  END IF;

  IF p_pool = 'pgt' THEN
    SELECT balance_pgt INTO v_balance 
    FROM users 
    WHERE LOWER(player_id) = LOWER(v_player_id)
    FOR UPDATE;
  ELSE
    SELECT balance_1flr INTO v_balance 
    FROM users 
    WHERE LOWER(player_id) = LOWER(v_player_id)
    FOR UPDATE;
  END IF;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  IF p_pool = 'pgt' THEN
    UPDATE users 
    SET balance_pgt = balance_pgt - p_amount,
        staked_balance_pgt = COALESCE(staked_balance_pgt, 0) + p_amount,
        updated_at = v_now
    WHERE LOWER(player_id) = LOWER(v_player_id);
  ELSE
    UPDATE users 
    SET balance_1flr = balance_1flr - p_amount,
        staked_balance_1flr = COALESCE(staked_balance_1flr, 0) + p_amount,
        updated_at = v_now
    WHERE LOWER(player_id) = LOWER(v_player_id);
  END IF;

  v_lock_until := v_now + (p_duration_ms || ' milliseconds')::interval;

  INSERT INTO user_stakes (wallet_address, pool, amount, tier, apy, staked_at, lock_until, last_harvest, active)
  VALUES (v_player_id, p_pool, p_amount, p_tier, p_apy, v_now, v_lock_until, v_now, true)
  RETURNING id INTO v_stake_id;

  RETURN json_build_object('success', true, 'stake_id', v_stake_id);
END;
$$;

GRANT EXECUTE ON FUNCTION deposit_stake(TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BIGINT) TO anon, authenticated, service_role;

-- Optional final cleanup step: If you wish to drop the legacy wallet_address column entirely once player_id is populated:
-- ALTER TABLE users DROP COLUMN IF EXISTS wallet_address;
