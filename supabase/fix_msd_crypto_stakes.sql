-- ============================================================
-- POLYGAME UNIFIED PLAYER ID MIGRATION & MSD CRYPTO STAKE RESTORATION (v1.4.227)
-- Run this script in your Supabase SQL Editor to migrate wallet_address -> player_id
-- ============================================================

-- Step 1: Drop old foreign key constraint FIRST to prevent constraint violations during migration
ALTER TABLE user_stakes DROP CONSTRAINT IF EXISTS user_stakes_wallet_address_fkey;
ALTER TABLE user_stakes DROP CONSTRAINT IF EXISTS user_stakes_player_id_fkey;

-- Step 2: Ensure player_id and linked_wallet_address columns exist on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS player_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linked_wallet_address TEXT;

-- Step 3: Populate player_id & linked_wallet_address on users table
UPDATE users
SET player_id = wallet_address
WHERE (wallet_address ILIKE '0xpgt%' OR wallet_address ILIKE '0xg%')
  AND (player_id IS NULL OR player_id = '');

UPDATE users
SET linked_wallet_address = wallet_address,
    player_id = '0xpgt' || SUBSTRING(MD5(wallet_address || RANDOM()::text || CLOCK_TIMESTAMP()::text) FROM 1 FOR 36)
WHERE wallet_address NOT ILIKE '0xpgt%' 
  AND wallet_address NOT ILIKE '0xg%'
  AND (player_id IS NULL OR player_id = '');

UPDATE users
SET player_id = COALESCE(wallet_address, '0xpgt' || SUBSTRING(MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text) FROM 1 FOR 36))
WHERE player_id IS NULL OR player_id = '';

-- Ensure UNIQUE constraint on users(player_id)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_player_id_unique') THEN
    ALTER TABLE users ADD CONSTRAINT users_player_id_unique UNIQUE (player_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_player_id ON users (LOWER(player_id));
CREATE INDEX IF NOT EXISTS idx_users_linked_wallet ON users (LOWER(linked_wallet_address));

-- Step 4: Re-map any user_stakes entries (both EVM addresses and internal IDs) to match users.player_id
UPDATE user_stakes s
SET wallet_address = u.player_id
FROM users u
WHERE LOWER(s.wallet_address) = LOWER(u.linked_wallet_address)
   OR (u.wallet_address IS NOT NULL AND LOWER(s.wallet_address) = LOWER(u.wallet_address));

-- Step 5: MSD Crypto Account Consolidation & 70k PGT Stake Restoration
UPDATE users
SET linked_wallet_address = '0xff340a5c95d18e77677cd6dd3f4691a15433f3cd',
    updated_at = NOW()
WHERE LOWER(player_id) = '0xpgtf6a9a748636544a9a83d80cef9a8a40900000'
   OR LOWER(COALESCE(email, '')) = 'danmtr21@gmail.com';

DO $$
DECLARE
  v_primary_id TEXT := '0xpgtf6a9a748636544a9a83d80cef9a8a40900000';
  v_evm_addr TEXT := '0xff340a5c95d18e77677cd6dd3f4691a15433f3cd';
  v_has_stake BOOLEAN := FALSE;
BEGIN
  UPDATE user_stakes
  SET wallet_address = v_primary_id
  WHERE LOWER(wallet_address) = v_evm_addr;

  SELECT EXISTS (
    SELECT 1 FROM user_stakes 
    WHERE (LOWER(wallet_address) = v_primary_id OR LOWER(wallet_address) = v_evm_addr)
      AND amount >= 70000 
      AND active = true
  ) INTO v_has_stake;

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
      200.0,
      NOW() - INTERVAL '1 day',
      NOW() + INTERVAL '29 days',
      NOW(),
      true
    );

    UPDATE users
    SET staked_balance_pgt = COALESCE(staked_balance_pgt, 0) + 70000,
        updated_at = NOW()
    WHERE LOWER(player_id) = v_primary_id
       OR LOWER(COALESCE(email, '')) = 'danmtr21@gmail.com';
  END IF;
END $$;

-- Step 6: Re-bind new foreign key constraint on user_stakes to users(player_id)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_stakes_player_id_fkey') THEN
    ALTER TABLE user_stakes ADD CONSTRAINT user_stakes_player_id_fkey FOREIGN KEY (wallet_address) REFERENCES users(player_id) ON DELETE CASCADE;
  END IF;

  -- Safely drop legacy wallet_address column from users table
  ALTER TABLE users DROP COLUMN IF EXISTS wallet_address;
END $$;

-- Step 7: Staking RPC Functions
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
