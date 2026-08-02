-- ============================================================
-- POLYGAME UNIFIED PLAYER ID MIGRATION & MSD CRYPTO STAKE RESTORATION (v1.4.226)
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
-- 4. RE-MAP USER_STAKES RAW EVM ADDRESSES TO PLAYER_IDS
-- ============================================================

UPDATE user_stakes s
SET wallet_address = u.player_id
FROM users u
WHERE LOWER(s.wallet_address) = LOWER(u.linked_wallet_address);

-- ============================================================
-- 5. AUTOMATED SAFE CLEANUP OF LEGACY WALLET_ADDRESS COLUMN
-- ============================================================

DO $$
BEGIN
  -- 1. Ensure UNIQUE constraint on users(player_id)
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_player_id_unique') THEN
    ALTER TABLE users ADD CONSTRAINT users_player_id_unique UNIQUE (player_id);
  END IF;

  -- 2. Drop old foreign key constraints
  ALTER TABLE user_stakes DROP CONSTRAINT IF EXISTS user_stakes_wallet_address_fkey;
  ALTER TABLE user_stakes DROP CONSTRAINT IF EXISTS user_stakes_player_id_fkey;

  -- 3. Re-bind foreign key on user_stakes to users(player_id)
  ALTER TABLE user_stakes ADD CONSTRAINT user_stakes_player_id_fkey FOREIGN KEY (wallet_address) REFERENCES users(player_id) ON DELETE CASCADE;

  -- 4. Drop legacy wallet_address column safely
  ALTER TABLE users DROP COLUMN IF EXISTS wallet_address;
END $$;
