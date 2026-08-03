-- ============================================================
-- POLYGAME UNIFIED PLAYER ID MIGRATION & MASTER RPC REPAIR SCRIPT (v1.4.240)
-- Run this script in your Supabase SQL Editor to migrate database schema 
-- and repair all server-side RPC functions (Staking, Mini-Games, Faucet, Quests, Referrals, PolySpace, Jackpot, Deposits, POL Referral Payouts)
-- ============================================================

-- Step 1: Drop old foreign key constraint FIRST to prevent constraint violations during migration
ALTER TABLE user_stakes DROP CONSTRAINT IF EXISTS user_stakes_wallet_address_fkey;
ALTER TABLE user_stakes DROP CONSTRAINT IF EXISTS user_stakes_player_id_fkey;

-- Step 2: Ensure player_id and linked_wallet_address columns exist on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS player_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linked_wallet_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS unclaimed_referral_pgt NUMERIC DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS unclaimed_referral_pol NUMERIC DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS space_state JSONB DEFAULT '{}'::jsonb;

-- Step 3: Safely populate player_id & linked_wallet_address IF legacy wallet_address column still exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'wallet_address'
  ) THEN
    EXECUTE '
      UPDATE users
      SET player_id = wallet_address
      WHERE (wallet_address ILIKE ''0xpgt%'' OR wallet_address ILIKE ''0xg%'')
        AND (player_id IS NULL OR player_id = '''');

      UPDATE users
      SET linked_wallet_address = wallet_address,
          player_id = ''0xpgt'' || SUBSTRING(MD5(wallet_address || RANDOM()::text || CLOCK_TIMESTAMP()::text) FROM 1 FOR 36)
      WHERE wallet_address NOT ILIKE ''0xpgt%'' 
        AND wallet_address NOT ILIKE ''0xg%''
        AND (player_id IS NULL OR player_id = '''');
    ';
  END IF;
END $$;

UPDATE users
SET player_id = '0xpgt' || SUBSTRING(MD5(RANDOM()::text || CLOCK_TIMESTAMP()::text) FROM 1 FOR 36)
WHERE player_id IS NULL OR player_id = '';

-- Ensure PRIMARY KEY or UNIQUE constraint on users(player_id) to enable GUI cell editing in Supabase
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_type = 'PRIMARY KEY' AND table_name = 'users') THEN
    ALTER TABLE users ADD PRIMARY KEY (player_id);
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'users_player_id_unique') THEN
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
   OR LOWER(s.wallet_address) = LOWER(u.player_id);

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

-- Step 5b: Restore and Consolidate Standalone Profile & Stakes for Poss (0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5)
DO $$
DECLARE
  v_main_pid TEXT := '0xpgt8312e02d37185b5983e6922d1da';
  v_evm_addr TEXT := '0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5';
  v_dup_balance NUMERIC := 0;
BEGIN
  -- Check if duplicate 0x922 row exists and fetch its balance
  SELECT COALESCE(balance_pgt, 0) INTO v_dup_balance
  FROM users
  WHERE LOWER(player_id) = LOWER(v_evm_addr);

  -- Delete duplicate 0x922 row if present
  IF v_dup_balance > 0 OR EXISTS (SELECT 1 FROM users WHERE LOWER(player_id) = LOWER(v_evm_addr)) THEN
    DELETE FROM users WHERE LOWER(player_id) = LOWER(v_evm_addr);
  END IF;

  -- Ensure main Poss account (0xpgt8312e02d37185b5983e6922d1da) is linked to 0x922
  UPDATE users
  SET linked_wallet_address = v_evm_addr,
      balance_pgt = balance_pgt + v_dup_balance,
      username = 'Poss',
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_main_pid);

  -- Re-map all stakes tagged under 0x922 to 0xpgt8312e02d37185b5983e6922d1da
  UPDATE user_stakes
  SET wallet_address = v_main_pid
  WHERE LOWER(wallet_address) = LOWER(v_evm_addr) OR LOWER(wallet_address) = LOWER(v_main_pid);

  -- Recalculate staked_balance_pgt on primary Poss profile
  UPDATE users
  SET staked_balance_pgt = (SELECT COALESCE(SUM(amount), 0) FROM user_stakes WHERE LOWER(wallet_address) = LOWER(v_main_pid) AND active = true)
  WHERE LOWER(player_id) = LOWER(v_main_pid);

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

-- Helper Function to Resolve Input Address -> Player ID
DROP FUNCTION IF EXISTS resolve_player_id(TEXT);
CREATE OR REPLACE FUNCTION resolve_player_id(p_wallet TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));
  SELECT player_id INTO v_pid
  FROM users
  WHERE LOWER(player_id) = p_wallet
     OR LOWER(COALESCE(linked_wallet_address, '')) = p_wallet
     OR LOWER(COALESCE(user_id::text, '')) = p_wallet
  LIMIT 1;

  RETURN COALESCE(v_pid, p_wallet);
END;
$$;

-- ============================================================
-- Step 7: REPAIR ALL SERVER-SIDE RPC FUNCTIONS
-- ============================================================

-- 1. STAKING: get_user_stakes
DROP FUNCTION IF EXISTS get_user_stakes(TEXT);
CREATE OR REPLACE FUNCTION get_user_stakes(p_wallet TEXT) 
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_stakes json;
BEGIN
  SELECT json_agg(row_to_json(s)) INTO v_stakes
  FROM (
    SELECT id, pool, amount, tier, apy, 
           (EXTRACT(EPOCH FROM staked_at) * 1000) as "stakedAt",
           (EXTRACT(EPOCH FROM lock_until) * 1000) as "lockUntil",
           (EXTRACT(EPOCH FROM last_harvest) * 1000) as "lastHarvest",
           active
    FROM user_stakes
    WHERE (LOWER(wallet_address) = LOWER(v_pid) OR LOWER(wallet_address) = LOWER(p_wallet)) 
      AND active = true
  ) s;
  
  RETURN json_build_object('success', true, 'stakes', COALESCE(v_stakes, '[]'::json));
END;
$$;
GRANT EXECUTE ON FUNCTION get_user_stakes(TEXT) TO anon, authenticated, service_role;

-- 2. STAKING: deposit_stake
DROP FUNCTION IF EXISTS deposit_stake(TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BIGINT);
CREATE OR REPLACE FUNCTION deposit_stake(
  p_wallet TEXT, p_pool TEXT, p_amount NUMERIC, p_tier TEXT, p_apy NUMERIC, p_duration_ms BIGINT
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_balance NUMERIC;
  v_now TIMESTAMPTZ := now();
  v_lock_until TIMESTAMPTZ;
  v_stake_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid deposit amount');
  END IF;

  IF p_pool = 'pgt' THEN
    SELECT balance_pgt INTO v_balance FROM users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  ELSE
    SELECT balance_1flr INTO v_balance FROM users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  END IF;

  IF v_balance IS NULL OR v_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  IF p_pool = 'pgt' THEN
    UPDATE users SET balance_pgt = balance_pgt - p_amount, staked_balance_pgt = COALESCE(staked_balance_pgt, 0) + p_amount, updated_at = v_now WHERE LOWER(player_id) = LOWER(v_pid);
  ELSE
    UPDATE users SET balance_1flr = balance_1flr - p_amount, staked_balance_1flr = COALESCE(staked_balance_1flr, 0) + p_amount, updated_at = v_now WHERE LOWER(player_id) = LOWER(v_pid);
  END IF;

  v_lock_until := v_now + (p_duration_ms || ' milliseconds')::interval;

  INSERT INTO user_stakes (wallet_address, pool, amount, tier, apy, staked_at, lock_until, last_harvest, active)
  VALUES (v_pid, p_pool, p_amount, p_tier, p_apy, v_now, v_lock_until, v_now, true)
  RETURNING id INTO v_stake_id;

  RETURN json_build_object('success', true, 'stake_id', v_stake_id);
END;
$$;
GRANT EXECUTE ON FUNCTION deposit_stake(TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BIGINT) TO anon, authenticated, service_role;

-- 3. STAKING: harvest_yield
DROP FUNCTION IF EXISTS harvest_yield(TEXT, UUID);
CREATE OR REPLACE FUNCTION harvest_yield(p_wallet TEXT, p_stake_id UUID) 
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_stake user_stakes%ROWTYPE;
  v_yield NUMERIC;
  v_now TIMESTAMPTZ := now();
  v_seconds NUMERIC;
BEGIN
  SELECT * INTO v_stake FROM user_stakes 
  WHERE id = p_stake_id 
    AND (LOWER(wallet_address) = LOWER(v_pid) OR LOWER(wallet_address) = LOWER(p_wallet)) 
    AND active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Stake not found or inactive');
  END IF;

  v_seconds := EXTRACT(EPOCH FROM (v_now - v_stake.last_harvest));
  v_yield := v_stake.amount * (v_stake.apy / 100.0) * (v_seconds / (365 * 24 * 3600.0));
  IF v_yield < 0 THEN v_yield := 0; END IF;

  IF v_stake.pool = 'pgt' THEN
    UPDATE users SET balance_pgt = COALESCE(balance_pgt, 0) + v_yield WHERE LOWER(player_id) = LOWER(v_pid);
  ELSE
    UPDATE users SET balance_1flr = COALESCE(balance_1flr, 0) + v_yield WHERE LOWER(player_id) = LOWER(v_pid);
  END IF;

  UPDATE user_stakes SET last_harvest = v_now WHERE id = p_stake_id;
  RETURN json_build_object('success', true, 'yield', v_yield);
END;
$$;
GRANT EXECUTE ON FUNCTION harvest_yield(TEXT, UUID) TO anon, authenticated, service_role;

-- 4. STAKING: harvest_all_yield
DROP FUNCTION IF EXISTS harvest_all_yield(TEXT, TEXT);
CREATE OR REPLACE FUNCTION harvest_all_yield(p_wallet TEXT, p_pool TEXT) 
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_stake user_stakes%ROWTYPE;
  v_yield NUMERIC;
  v_total_yield NUMERIC := 0;
  v_now TIMESTAMPTZ := now();
  v_seconds NUMERIC;
BEGIN
  FOR v_stake IN SELECT * FROM user_stakes WHERE (LOWER(wallet_address) = LOWER(v_pid) OR LOWER(wallet_address) = LOWER(p_wallet)) AND pool = p_pool AND active = true LOOP
    v_seconds := EXTRACT(EPOCH FROM (v_now - v_stake.last_harvest));
    v_yield := v_stake.amount * (v_stake.apy / 100.0) * (v_seconds / (365 * 24 * 3600.0));
    
    IF v_yield > 0 THEN
      v_total_yield := v_total_yield + v_yield;
      UPDATE user_stakes SET last_harvest = v_now WHERE id = v_stake.id;
    END IF;
  END LOOP;

  IF v_total_yield > 0 THEN
    IF p_pool = 'pgt' THEN
      UPDATE users SET balance_pgt = COALESCE(balance_pgt, 0) + v_total_yield WHERE LOWER(player_id) = LOWER(v_pid);
    ELSE
      UPDATE users SET balance_1flr = COALESCE(balance_1flr, 0) + v_total_yield WHERE LOWER(player_id) = LOWER(v_pid);
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'total_yield', v_total_yield);
END;
$$;
GRANT EXECUTE ON FUNCTION harvest_all_yield(TEXT, TEXT) TO anon, authenticated, service_role;

-- 5. STAKING: unstake_position
DROP FUNCTION IF EXISTS unstake_position(TEXT, UUID);
CREATE OR REPLACE FUNCTION unstake_position(p_wallet TEXT, p_stake_id UUID) 
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_stake user_stakes%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_seconds NUMERIC;
  v_yield NUMERIC;
  v_total_payback NUMERIC;
BEGIN
  SELECT * INTO v_stake 
  FROM user_stakes 
  WHERE id = p_stake_id 
    AND (LOWER(wallet_address) = LOWER(v_pid) OR LOWER(wallet_address) = LOWER(p_wallet)) 
    AND active = true 
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Stake not found or already inactive');
  END IF;

  IF v_now < v_stake.lock_until THEN
    RETURN json_build_object('success', false, 'error', 'Stake is locked');
  END IF;

  v_seconds := EXTRACT(EPOCH FROM (v_now - v_stake.last_harvest));
  v_yield := v_stake.amount * (v_stake.apy / 100.0) * (v_seconds / (365 * 24 * 3600.0));
  IF v_yield < 0 THEN v_yield := 0; END IF;
  v_total_payback := v_stake.amount + v_yield;

  IF v_stake.pool = 'pgt' THEN
    UPDATE users 
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_total_payback,
        staked_balance_pgt = GREATEST(0, COALESCE(staked_balance_pgt, 0) - v_stake.amount)
    WHERE LOWER(player_id) = LOWER(v_pid);
  ELSE
    UPDATE users 
    SET balance_1flr = COALESCE(balance_1flr, 0) + v_total_payback,
        staked_balance_1flr = GREATEST(0, COALESCE(staked_balance_1flr, 0) - v_stake.amount)
    WHERE LOWER(player_id) = LOWER(v_pid);
  END IF;

  UPDATE user_stakes SET active = false, last_harvest = v_now WHERE id = p_stake_id;
  RETURN json_build_object('success', true, 'payback', v_total_payback, 'yield', v_yield);
END;
$$;
GRANT EXECUTE ON FUNCTION unstake_position(TEXT, UUID) TO anon, authenticated, service_role;

-- 6. STAKING: unstake_all_matured
DROP FUNCTION IF EXISTS unstake_all_matured(TEXT, TEXT);
CREATE OR REPLACE FUNCTION unstake_all_matured(p_wallet TEXT, p_pool TEXT) 
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_stake user_stakes%ROWTYPE;
  v_yield NUMERIC;
  v_total_payback NUMERIC := 0;
  v_total_principal NUMERIC := 0;
  v_now TIMESTAMPTZ := now();
  v_seconds NUMERIC;
  v_count INTEGER := 0;
BEGIN
  FOR v_stake IN SELECT * FROM user_stakes WHERE (LOWER(wallet_address) = LOWER(v_pid) OR LOWER(wallet_address) = LOWER(p_wallet)) AND pool = p_pool AND active = true AND lock_until <= v_now FOR UPDATE LOOP
    v_seconds := EXTRACT(EPOCH FROM (v_now - v_stake.last_harvest));
    v_yield := v_stake.amount * (v_stake.apy / 100.0) * (v_seconds / (365 * 24 * 3600.0));
    IF v_yield < 0 THEN v_yield := 0; END IF;
    
    v_total_payback := v_total_payback + v_stake.amount + v_yield;
    v_total_principal := v_total_principal + v_stake.amount;
    UPDATE user_stakes SET active = false, last_harvest = v_now WHERE id = v_stake.id;
    v_count := v_count + 1;
  END LOOP;

  IF v_total_payback > 0 THEN
    IF p_pool = 'pgt' THEN
      UPDATE users 
      SET balance_pgt = COALESCE(balance_pgt, 0) + v_total_payback,
          staked_balance_pgt = GREATEST(0, COALESCE(staked_balance_pgt, 0) - v_total_principal)
      WHERE LOWER(player_id) = LOWER(v_pid);
    ELSE
      UPDATE users 
      SET balance_1flr = COALESCE(balance_1flr, 0) + v_total_payback,
          staked_balance_1flr = GREATEST(0, COALESCE(staked_balance_1flr, 0) - v_total_principal)
      WHERE LOWER(player_id) = LOWER(v_pid);
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'count', v_count, 'payback', v_total_payback);
END;
$$;
GRANT EXECUTE ON FUNCTION unstake_all_matured(TEXT, TEXT) TO anon, authenticated, service_role;

-- 7. FAUCET: claim_faucet
DROP FUNCTION IF EXISTS claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC);
CREATE OR REPLACE FUNCTION claim_faucet(
  p_wallet TEXT, p_nft_boost_percent NUMERIC DEFAULT 0, p_1flr_balance NUMERIC DEFAULT 0, p_staked_pgt NUMERIC DEFAULT 0
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_last_claim TIMESTAMPTZ;
  v_streak INTEGER;
  v_vip_until TIMESTAMPTZ;
  v_balance_pgt NUMERIC;
  v_payout NUMERIC;
  v_base_payout NUMERIC := 50.0;
  v_now TIMESTAMPTZ := now();
  v_hours_since_last NUMERIC;
BEGIN
  SELECT last_faucet_claim, faucet_streak, vip_until, balance_pgt
  INTO v_last_claim, v_streak, v_vip_until, v_balance_pgt
  FROM users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  IF v_last_claim IS NOT NULL THEN
    IF v_vip_until IS NOT NULL AND v_vip_until > v_now THEN
      IF v_now < v_last_claim + INTERVAL '21 hours 36 minutes' THEN
        RETURN json_build_object('success', false, 'error', 'Cooldown active');
      END IF;
    ELSE
      IF v_now < v_last_claim + INTERVAL '24 hours' THEN
        RETURN json_build_object('success', false, 'error', 'Cooldown active');
      END IF;
    END IF;
  END IF;

  IF v_last_claim IS NOT NULL THEN
    v_hours_since_last := EXTRACT(EPOCH FROM (v_now - v_last_claim)) / 3600;
    IF v_hours_since_last > 48 THEN v_streak := 1; ELSE v_streak := COALESCE(v_streak, 0) + 1; END IF;
  ELSE
    v_streak := 1;
  END IF;

  v_payout := v_base_payout * (1 + p_nft_boost_percent / 100.0);
  IF v_balance_pgt >= 1000000 THEN v_payout := v_payout * 2; END IF;
  IF p_1flr_balance >= 5000000 THEN v_payout := v_payout * 1.1; END IF;
  IF p_staked_pgt >= 1000000 THEN v_payout := v_payout * 1.25; END IF;
  IF v_vip_until IS NOT NULL AND v_vip_until > v_now THEN v_payout := v_payout * 2; END IF;

  UPDATE users SET balance_pgt = COALESCE(balance_pgt, 0) + v_payout, last_faucet_claim = v_now, faucet_streak = v_streak WHERE LOWER(player_id) = LOWER(v_pid);
  PERFORM process_referral_commissions(v_pid, v_payout);

  RETURN json_build_object('success', true, 'payout', v_payout, 'streak', v_streak, 'last_claim', v_now);
END;
$$;
GRANT EXECUTE ON FUNCTION claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

-- 8. DAILY QUESTS: claim_daily_quest
DROP FUNCTION IF EXISTS claim_daily_quest(TEXT, TEXT);
CREATE OR REPLACE FUNCTION claim_daily_quest(p_wallet TEXT, p_quest_type TEXT) 
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_user RECORD;
  v_q JSONB;
  v_today TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_reward NUMERIC := 0;
  v_new_balance NUMERIC;
BEGIN
  SELECT * INTO v_user FROM users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'User not found'); END IF;

  v_q := v_user.daily_quests;
  IF v_q IS NULL OR (v_q->>'date') IS NULL OR (v_q->>'date') <> v_today THEN
    v_q := jsonb_build_object(
      'date', v_today, 'games', 0, 'mining', 0, 'wins', 0,
      'games_claimed', false, 'mining_claimed', false, 'wins_claimed', false,
      'master_claimed', false,
      'streak_days', COALESCE((v_q->>'streak_days')::int, 0),
      'last_streak_date', COALESCE(v_q->>'last_streak_date', '')
    );
  END IF;

  IF p_quest_type = 'games' THEN
    IF COALESCE((v_q->>'games')::int, 0) < 3 THEN RETURN jsonb_build_object('success', false, 'message', 'Play 3 games first!'); END IF;
    IF COALESCE((v_q->>'games_claimed')::boolean, false) THEN RETURN jsonb_build_object('success', false, 'message', 'Already claimed today!'); END IF;
    v_q := jsonb_set(v_q, '{games_claimed}', 'true'); v_reward := 10;
  ELSIF p_quest_type = 'mining' THEN
    IF COALESCE((v_q->>'mining')::int, 0) < 3 THEN RETURN jsonb_build_object('success', false, 'message', 'Mine 3 shards first!'); END IF;
    IF COALESCE((v_q->>'mining_claimed')::boolean, false) THEN RETURN jsonb_build_object('success', false, 'message', 'Already claimed today!'); END IF;
    v_q := jsonb_set(v_q, '{mining_claimed}', 'true'); v_reward := 10;
  ELSIF p_quest_type = 'wins' THEN
    IF COALESCE((v_q->>'wins')::int, 0) < 3 THEN RETURN jsonb_build_object('success', false, 'message', 'Win 3 rounds first!'); END IF;
    IF COALESCE((v_q->>'wins_claimed')::boolean, false) THEN RETURN jsonb_build_object('success', false, 'message', 'Already claimed today!'); END IF;
    v_q := jsonb_set(v_q, '{wins_claimed}', 'true'); v_reward := 10;
  ELSIF p_quest_type = 'master' THEN
    IF NOT (COALESCE((v_q->>'games_claimed')::boolean, false) OR COALESCE((v_q->>'games')::int, 0) >= 3) OR
       NOT (COALESCE((v_q->>'mining_claimed')::boolean, false) OR COALESCE((v_q->>'mining')::int, 0) >= 3) OR
       NOT (COALESCE((v_q->>'wins_claimed')::boolean, false) OR COALESCE((v_q->>'wins')::int, 0) >= 3) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Complete all 3 daily quests first!');
    END IF;
    IF COALESCE((v_q->>'master_claimed')::boolean, false) THEN RETURN jsonb_build_object('success', false, 'message', 'Already claimed today!'); END IF;
    v_q := jsonb_set(v_q, '{master_claimed}', 'true'); v_reward := 25;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Invalid quest type');
  END IF;

  v_new_balance := COALESCE(v_user.balance_pgt, 0) + v_reward;
  UPDATE users SET balance_pgt = v_new_balance, daily_quests = v_q, updated_at = NOW() WHERE LOWER(player_id) = LOWER(v_pid);
  RETURN jsonb_build_object('success', true, 'reward', v_reward, 'new_balance', v_new_balance, 'daily_quests', v_q);
END;
$$;
GRANT EXECUTE ON FUNCTION claim_daily_quest(TEXT, TEXT) TO anon, authenticated, service_role;

-- 9. MINI-GAMES: Roshambo RPC
DROP FUNCTION IF EXISTS play_roshambo(TEXT, NUMERIC, TEXT);
CREATE OR REPLACE FUNCTION play_roshambo(p_wallet TEXT, p_bet NUMERIC, p_choice TEXT) 
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_balance NUMERIC;
  v_cpu_choice TEXT;
  v_outcome TEXT;
  v_payout NUMERIC := 0;
  v_new_balance NUMERIC;
  v_choices TEXT[] := ARRAY['rock', 'paper', 'scissors'];
BEGIN
  p_choice := LOWER(TRIM(p_choice));
  IF p_bet <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid bet amount'); END IF;

  SELECT balance_pgt INTO v_balance FROM users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User not found'); END IF;
  IF v_balance < p_bet THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance'); END IF;

  v_cpu_choice := v_choices[1 + floor(random() * 3)::int];
  IF p_choice = v_cpu_choice THEN v_outcome := 'draw'; v_payout := p_bet;
  ELSIF (p_choice = 'rock' AND v_cpu_choice = 'scissors') OR (p_choice = 'paper' AND v_cpu_choice = 'rock') OR (p_choice = 'scissors' AND v_cpu_choice = 'paper') THEN
    v_outcome := 'win'; v_payout := p_bet * 2;
  ELSE v_outcome := 'lose'; v_payout := 0; END IF;

  UPDATE users SET balance_pgt = balance_pgt - p_bet + v_payout, updated_at = NOW() WHERE LOWER(player_id) = LOWER(v_pid) RETURNING balance_pgt INTO v_new_balance;
  RETURN jsonb_build_object('success', true, 'outcome', v_outcome, 'cpu_choice', v_cpu_choice, 'payout', v_payout, 'new_balance', v_new_balance);
END;
$$;
GRANT EXECUTE ON FUNCTION play_roshambo(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;

-- 10. MINI-GAMES: Lucky Spinner RPC
DROP FUNCTION IF EXISTS play_spinner(TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION play_spinner(p_wallet TEXT, p_bet NUMERIC) 
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_balance NUMERIC;
  v_rand NUMERIC;
  v_multiplier NUMERIC;
  v_payout NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  IF p_bet <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid bet amount'); END IF;
  SELECT balance_pgt INTO v_balance FROM users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User not found'); END IF;
  IF v_balance < p_bet THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance'); END IF;

  v_rand := random();
  IF v_rand < 0.40 THEN v_multiplier := 0;
  ELSIF v_rand < 0.70 THEN v_multiplier := 1.2;
  ELSIF v_rand < 0.90 THEN v_multiplier := 2.0;
  ELSIF v_rand < 0.98 THEN v_multiplier := 5.0;
  ELSE v_multiplier := 10.0; END IF;

  v_payout := p_bet * v_multiplier;
  UPDATE users SET balance_pgt = balance_pgt - p_bet + v_payout, updated_at = NOW() WHERE LOWER(player_id) = LOWER(v_pid) RETURNING balance_pgt INTO v_new_balance;
  RETURN jsonb_build_object('success', true, 'multiplier', v_multiplier, 'payout', v_payout, 'new_balance', v_new_balance);
END;
$$;
GRANT EXECUTE ON FUNCTION play_spinner(TEXT, NUMERIC) TO anon, authenticated, service_role;

-- 11. MINI-GAMES: Cyber Invaders Score Submit RPC
DROP FUNCTION IF EXISTS submit_invaders_score(TEXT, INTEGER, NUMERIC, NUMERIC);
CREATE OR REPLACE FUNCTION submit_invaders_score(
  p_wallet TEXT, p_score INTEGER, p_nft_game_multiplier NUMERIC DEFAULT 0, p_global_earn_multiplier NUMERIC DEFAULT 1.0
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_vip_until TIMESTAMPTZ;
  v_current_high_score INTEGER;
  v_raw_pgt NUMERIC;
  v_final_pgt NUMERIC;
  v_now TIMESTAMPTZ := now();
  v_new_balance NUMERIC;
BEGIN
  IF p_score > 5000 THEN p_score := 5000; END IF;
  SELECT vip_until, invaders_highscore INTO v_vip_until, v_current_high_score FROM users WHERE LOWER(player_id) = LOWER(v_pid);
  IF NOT FOUND THEN RETURN json_build_object('success', false, 'error', 'User not found'); END IF;

  v_raw_pgt := p_score * 0.015;
  v_final_pgt := v_raw_pgt * (1 + p_nft_game_multiplier / 100.0) * p_global_earn_multiplier;
  IF v_vip_until IS NOT NULL AND v_vip_until > v_now THEN v_final_pgt := v_final_pgt * 2; END IF;

  IF p_score > COALESCE(v_current_high_score, 0) THEN
    UPDATE users SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt, invaders_highscore = p_score WHERE LOWER(player_id) = LOWER(v_pid) RETURNING balance_pgt INTO v_new_balance;
  ELSE
    UPDATE users SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt WHERE LOWER(player_id) = LOWER(v_pid) RETURNING balance_pgt INTO v_new_balance;
  END IF;

  RETURN json_build_object('success', true, 'payout', v_final_pgt, 'new_balance', v_new_balance, 'score', p_score);
END;
$$;
GRANT EXECUTE ON FUNCTION submit_invaders_score(TEXT, INTEGER, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

-- 12. MINI-GAMES: Plinko RPC
DROP FUNCTION IF EXISTS play_plinko(TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION play_plinko(p_wallet TEXT, p_bet NUMERIC) 
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_balance NUMERIC;
  v_rand NUMERIC;
  v_multiplier NUMERIC;
  v_payout NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  IF p_bet <= 0 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid bet amount'); END IF;
  SELECT balance_pgt INTO v_balance FROM users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User not found'); END IF;
  IF v_balance < p_bet THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance'); END IF;

  v_rand := random();
  IF v_rand < 0.20 THEN v_multiplier := 0.2;
  ELSIF v_rand < 0.55 THEN v_multiplier := 1.0;
  ELSIF v_rand < 0.85 THEN v_multiplier := 1.5;
  ELSIF v_rand < 0.96 THEN v_multiplier := 3.0;
  ELSE v_multiplier := 10.0; END IF;

  v_payout := p_bet * v_multiplier;
  UPDATE users SET balance_pgt = balance_pgt - p_bet + v_payout, updated_at = NOW() WHERE LOWER(player_id) = LOWER(v_pid) RETURNING balance_pgt INTO v_new_balance;
  RETURN jsonb_build_object('success', true, 'multiplier', v_multiplier, 'payout', v_payout, 'new_balance', v_new_balance);
END;
$$;
GRANT EXECUTE ON FUNCTION play_plinko(TEXT, NUMERIC) TO anon, authenticated, service_role;

-- 13. MINI-GAMES: Crash RPC
DROP FUNCTION IF EXISTS play_crash(TEXT, NUMERIC, NUMERIC);
CREATE OR REPLACE FUNCTION play_crash(p_wallet TEXT, p_bet NUMERIC, p_target NUMERIC) 
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_balance NUMERIC;
  v_crash_point NUMERIC;
  v_won BOOLEAN := false;
  v_payout NUMERIC := 0;
  v_new_balance NUMERIC;
BEGIN
  IF p_bet <= 0 OR p_target < 1.01 THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid parameters'); END IF;
  SELECT balance_pgt INTO v_balance FROM users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User not found'); END IF;
  IF v_balance < p_bet THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance'); END IF;

  v_crash_point := GREATEST(1.00, ROUND((1.0 / (1.0 - (random() * 0.96)))::numeric, 2));
  IF v_crash_point > 100.0 THEN v_crash_point := 100.0; END IF;

  IF v_crash_point >= p_target THEN
    v_won := true;
    v_payout := p_bet * p_target;
  ELSE
    v_won := false;
    v_payout := 0;
  END IF;

  UPDATE users SET balance_pgt = balance_pgt - p_bet + v_payout, updated_at = NOW() WHERE LOWER(player_id) = LOWER(v_pid) RETURNING balance_pgt INTO v_new_balance;
  RETURN jsonb_build_object('success', true, 'won', v_won, 'crash_point', v_crash_point, 'target', p_target, 'payout', v_payout, 'new_balance', v_new_balance);
END;
$$;
GRANT EXECUTE ON FUNCTION play_crash(TEXT, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

-- 14. ARCADE PAYOUTS: credit_arcade_payout
DROP FUNCTION IF EXISTS credit_arcade_payout(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS credit_arcade_payout(NUMERIC, TEXT);
CREATE OR REPLACE FUNCTION credit_arcade_payout(p_player_id TEXT, p_amount NUMERIC)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_new_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid amount');
  END IF;

  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + p_amount,
      total_earned = COALESCE(total_earned, 0) + p_amount,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid)
  RETURNING balance_pgt INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User player_id not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;
GRANT EXECUTE ON FUNCTION credit_arcade_payout(TEXT, NUMERIC) TO anon, authenticated, service_role;

-- 15. ARCADE HIGH SCORES: submit_arcade_highscore
DROP FUNCTION IF EXISTS submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION submit_arcade_highscore(
  p_wallet TEXT,
  p_game_highscore INTEGER DEFAULT NULL,
  p_invaders_highscore INTEGER DEFAULT NULL,
  p_drift_highscore INTEGER DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
BEGIN
  -- Anti-Cheat Score Sanity Caps: Cap Astro-Dodge to 50k, Invaders to 5k
  IF p_game_highscore IS NOT NULL AND p_game_highscore > 50000 THEN
    p_game_highscore := 50000;
  END IF;
  IF p_invaders_highscore IS NOT NULL AND p_invaders_highscore > 5000 THEN
    p_invaders_highscore := 5000;
  END IF;

  UPDATE users
  SET game_highscore = GREATEST(COALESCE(game_highscore, 0), COALESCE(p_game_highscore, 0)),
      invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), COALESCE(p_invaders_highscore, 0)),
      drift_highscore = GREATEST(COALESCE(drift_highscore, 0), COALESCE(p_drift_highscore, 0)),
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid);

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;

-- Step 5c: Sanitize any existing exploited arcade high scores in database
UPDATE users SET game_highscore = 50000 WHERE game_highscore > 50000;
UPDATE users SET invaders_highscore = 5000 WHERE invaders_highscore > 5000;

-- 16. REFERRALS: process_referral_commissions
DROP FUNCTION IF EXISTS process_referral_commissions(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS process_referral_commissions(TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION process_referral_commissions(
  claiming_wallet TEXT,
  claim_amount NUMERIC,
  claim_action TEXT DEFAULT 'General'
) RETURNS void AS $$
DECLARE
  v_pid TEXT := resolve_player_id(claiming_wallet);
  ref_l1 TEXT;
  ref_l2 TEXT;
  ref_l3 TEXT;
  ref_l4 TEXT;
  vip_expiry TIMESTAMPTZ;
  multiplier NUMERIC;
  comm_amount NUMERIC;
  player_name TEXT;
  time_str TEXT;
  new_entry JSONB;
BEGIN
  IF claim_amount IS NULL OR claim_amount <= 0 THEN
    RETURN;
  END IF;

  SELECT 
    lower(referred_by_l1),
    lower(referred_by_l2),
    lower(referred_by_l3),
    lower(referred_by_l4)
  INTO
    ref_l1, ref_l2, ref_l3, ref_l4
  FROM users WHERE lower(player_id) = lower(v_pid);

  player_name := 'Player_' || substring(v_pid from 1 for 8);
  time_str := to_char(now(), 'HH12:MI:SS AM');

  -- Level 1 (10% base, 20% if VIP)
  IF ref_l1 IS NOT NULL AND ref_l1 <> '' AND ref_l1 <> lower(v_pid) THEN
    multiplier := 1;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(player_id) = resolve_player_id(ref_l1);
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN multiplier := 2; END IF;
    comm_amount := claim_amount * 0.10 * multiplier;
    new_entry := jsonb_build_object('name', player_name, 'level', 1, 'commission', comm_amount, 'time', time_str);
    UPDATE users SET 
      unclaimed_referral_pgt = COALESCE(unclaimed_referral_pgt, 0) + comm_amount,
      total_referral_commission = COALESCE(total_referral_commission, 0) + comm_amount,
      referrals_list = CASE WHEN referrals_list IS NULL THEN jsonb_build_array(new_entry) ELSE (jsonb_build_array(new_entry) || referrals_list) END
    WHERE lower(player_id) = resolve_player_id(ref_l1);
  END IF;

  -- Level 2 (5% base, 10% if VIP)
  IF ref_l2 IS NOT NULL AND ref_l2 <> '' AND ref_l2 <> lower(v_pid) THEN
    multiplier := 1;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(player_id) = resolve_player_id(ref_l2);
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN multiplier := 2; END IF;
    comm_amount := claim_amount * 0.05 * multiplier;
    new_entry := jsonb_build_object('name', player_name, 'level', 2, 'commission', comm_amount, 'time', time_str);
    UPDATE users SET 
      unclaimed_referral_pgt = COALESCE(unclaimed_referral_pgt, 0) + comm_amount,
      total_referral_commission = COALESCE(total_referral_commission, 0) + comm_amount,
      referrals_list = CASE WHEN referrals_list IS NULL THEN jsonb_build_array(new_entry) ELSE (jsonb_build_array(new_entry) || referrals_list) END
    WHERE lower(player_id) = resolve_player_id(ref_l2);
  END IF;

  -- Level 3 (2% base, 4% if VIP)
  IF ref_l3 IS NOT NULL AND ref_l3 <> '' AND ref_l3 <> lower(v_pid) THEN
    multiplier := 1;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(player_id) = resolve_player_id(ref_l3);
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN multiplier := 2; END IF;
    comm_amount := claim_amount * 0.02 * multiplier;
    new_entry := jsonb_build_object('name', player_name, 'level', 3, 'commission', comm_amount, 'time', time_str);
    UPDATE users SET 
      unclaimed_referral_pgt = COALESCE(unclaimed_referral_pgt, 0) + comm_amount,
      total_referral_commission = COALESCE(total_referral_commission, 0) + comm_amount,
      referrals_list = CASE WHEN referrals_list IS NULL THEN jsonb_build_array(new_entry) ELSE (jsonb_build_array(new_entry) || referrals_list) END
    WHERE lower(player_id) = resolve_player_id(ref_l3);
  END IF;

  -- Level 4 (1% base, 2% if VIP)
  IF ref_l4 IS NOT NULL AND ref_l4 <> '' AND ref_l4 <> lower(v_pid) THEN
    multiplier := 1;
    SELECT vip_until INTO vip_expiry FROM users WHERE lower(player_id) = resolve_player_id(ref_l4);
    IF vip_expiry IS NOT NULL AND vip_expiry > now() THEN multiplier := 2; END IF;
    comm_amount := claim_amount * 0.01 * multiplier;
    new_entry := jsonb_build_object('name', player_name, 'level', 4, 'commission', comm_amount, 'time', time_str);
    UPDATE users SET 
      unclaimed_referral_pgt = COALESCE(unclaimed_referral_pgt, 0) + comm_amount,
      total_referral_commission = COALESCE(total_referral_commission, 0) + comm_amount,
      referrals_list = CASE WHEN referrals_list IS NULL THEN jsonb_build_array(new_entry) ELSE (jsonb_build_array(new_entry) || referrals_list) END
    WHERE lower(player_id) = resolve_player_id(ref_l4);
  END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION process_referral_commissions(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;

-- 17. REFERRALS: harvest_referral_rewards
DROP FUNCTION IF EXISTS harvest_referral_rewards(TEXT);
CREATE OR REPLACE FUNCTION harvest_referral_rewards(user_wallet TEXT) 
RETURNS NUMERIC AS $$
DECLARE
  v_pid TEXT := resolve_player_id(user_wallet);
  unclaimed_amt NUMERIC;
BEGIN
  SELECT COALESCE(unclaimed_referral_pgt, 0) INTO unclaimed_amt
  FROM users WHERE lower(player_id) = lower(v_pid);

  IF unclaimed_amt IS NULL OR unclaimed_amt <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE users SET
    balance_pgt = balance_pgt + unclaimed_amt,
    unclaimed_referral_pgt = 0
  WHERE lower(player_id) = lower(v_pid);

  RETURN unclaimed_amt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION harvest_referral_rewards(TEXT) TO anon, authenticated, service_role;

-- 18. POLYSPACE: upgrade_polyspace_module
DROP FUNCTION IF EXISTS upgrade_polyspace_module(TEXT, NUMERIC, JSONB);
CREATE OR REPLACE FUNCTION upgrade_polyspace_module(
  p_wallet TEXT,
  p_cost_pgt NUMERIC,
  p_new_space_state JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_user RECORD;
  v_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  SELECT * INTO v_user
  FROM users
  WHERE LOWER(player_id) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  v_balance := COALESCE(v_user.balance_pgt, 0);

  IF p_cost_pgt > 0 AND v_balance < p_cost_pgt THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient PGT balance');
  END IF;

  v_new_balance := v_balance - p_cost_pgt;

  UPDATE users
  SET balance_pgt = v_new_balance,
      space_state = p_new_space_state,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid);

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'space_state', p_new_space_state
  );
END;
$$;
GRANT EXECUTE ON FUNCTION upgrade_polyspace_module(TEXT, NUMERIC, JSONB) TO anon, authenticated, service_role;

-- 19. JACKPOT: claim_jackpot
DROP FUNCTION IF EXISTS claim_jackpot(TEXT);
CREATE OR REPLACE FUNCTION claim_jackpot(p_wallet TEXT) 
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_amount NUMERIC := 0;
BEGIN
  SELECT current_amount INTO v_amount FROM global_jackpot WHERE id = 1 FOR UPDATE;
  IF v_amount IS NULL OR v_amount <= 0 THEN v_amount := 1000; END IF;

  UPDATE global_jackpot SET current_amount = 500, updated_at = NOW() WHERE id = 1;

  INSERT INTO jackpot_winners (wallet_address, amount, won_at)
  VALUES (v_pid, v_amount, NOW());

  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_amount,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid);

  RETURN v_amount;
END;
$$;
GRANT EXECUTE ON FUNCTION claim_jackpot(TEXT) TO anon, authenticated, service_role;

-- 20. REFERRALS: bind_referral_code
DROP FUNCTION IF EXISTS bind_referral_code(TEXT, TEXT);
CREATE OR REPLACE FUNCTION bind_referral_code(
  p_user_wallet TEXT,
  p_ref_code TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_user_wallet);
  v_ref_user RECORD;
  v_cur_user RECORD;
BEGIN
  p_ref_code := LOWER(TRIM(p_ref_code));
  SELECT * INTO v_cur_user FROM users WHERE LOWER(player_id) = LOWER(v_pid);
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'User not found'); END IF;
  IF v_cur_user.referred_by_l1 IS NOT NULL AND v_cur_user.referred_by_l1 <> '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Referrer already set');
  END IF;

  SELECT * INTO v_ref_user FROM users WHERE LOWER(player_id) = p_ref_code OR LOWER(COALESCE(linked_wallet_address, '')) = p_ref_code;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Invalid referral code'); END IF;
  IF LOWER(v_ref_user.player_id) = LOWER(v_pid) THEN RETURN jsonb_build_object('success', false, 'message', 'Cannot refer yourself'); END IF;

  UPDATE users
  SET referred_by_l1 = v_ref_user.player_id,
      referred_by_l2 = v_ref_user.referred_by_l1,
      referred_by_l3 = v_ref_user.referred_by_l2,
      referred_by_l4 = v_ref_user.referred_by_l3,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid);

  UPDATE users SET referrals_count = COALESCE(referrals_count, 0) + 1 WHERE LOWER(player_id) = LOWER(v_ref_user.player_id);

  RETURN jsonb_build_object('success', true, 'referrer', v_ref_user.player_id);
END;
$$;
GRANT EXECUTE ON FUNCTION bind_referral_code(TEXT, TEXT) TO anon, authenticated, service_role;

-- 21. DEPOSIT ON-CHAIN: deposit_pgt_onchain
DROP FUNCTION IF EXISTS deposit_pgt_onchain(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS deposit_pgt_onchain(TEXT, NUMERIC, TEXT, TEXT);

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
  v_pid TEXT := resolve_player_id(p_wallet);
  v_new_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid deposit amount');
  END IF;

  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + p_amount,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid)
  RETURNING balance_pgt INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User player_id not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'new_balance_pgt', v_new_balance);
END;
$$;
GRANT EXECUTE ON FUNCTION deposit_pgt_onchain(TEXT, NUMERIC, TEXT, TEXT) TO anon, authenticated, service_role;

-- 22. REFERRALS: request_pol_referral_payout
DROP FUNCTION IF EXISTS request_pol_referral_payout(TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION request_pol_referral_payout(
  p_user_wallet TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_user_wallet);
  v_username TEXT;
  v_linked_evm TEXT;
  v_target_evm TEXT;
  v_unclaimed NUMERIC;
  v_request_id UUID;
BEGIN
  IF p_amount <= 0.001 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Minimum payout request is 0.001 POL');
  END IF;

  SELECT username, linked_wallet_address, COALESCE(unclaimed_referral_pol, 0) 
  INTO v_username, v_linked_evm, v_unclaimed
  FROM users
  WHERE LOWER(player_id) = LOWER(v_pid)
  FOR UPDATE;

  IF v_unclaimed IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'User profile not found');
  END IF;

  IF v_unclaimed < p_amount THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Insufficient unclaimed POL referral balance');
  END IF;

  -- Determine real EVM receiving address
  IF v_linked_evm IS NOT NULL AND v_linked_evm <> '' AND v_linked_evm ILIKE '0x%' AND LENGTH(v_linked_evm) = 42 THEN
    v_target_evm := v_linked_evm;
  ELSIF p_user_wallet ILIKE '0x%' AND LENGTH(p_user_wallet) = 42 AND p_user_wallet NOT ILIKE '0xpgt%' THEN
    v_target_evm := p_user_wallet;
  ELSE
    v_target_evm := v_pid;
  END IF;

  -- Deduct from unclaimed pool
  UPDATE users
  SET unclaimed_referral_pol = GREATEST(0, COALESCE(unclaimed_referral_pol, 0) - p_amount),
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid);

  -- Ensure pol_payout_requests table exists
  CREATE TABLE IF NOT EXISTS pol_payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    username TEXT,
    amount_pol NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending',
    tx_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
  );

  -- Create pending payout request
  INSERT INTO pol_payout_requests (wallet_address, username, amount_pol, status)
  VALUES (v_target_evm, COALESCE(v_username, ''), p_amount, 'pending')
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'amount_pol', p_amount
  );
END;
$$;
GRANT EXECUTE ON FUNCTION request_pol_referral_payout(TEXT, NUMERIC) TO anon, authenticated, service_role;

-- 23. REFERRALS: complete_pol_payout_request
DROP FUNCTION IF EXISTS complete_pol_payout_request(UUID, TEXT);
CREATE OR REPLACE FUNCTION complete_pol_payout_request(
  p_request_id UUID,
  p_tx_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE pol_payout_requests
  SET status = 'paid',
      tx_hash = p_tx_hash,
      processed_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION complete_pol_payout_request(UUID, TEXT) TO anon, authenticated, service_role;

-- 24. ACCOUNT LINKING: link_wallet_to_account (Permanent Wallet Lock)
DROP FUNCTION IF EXISTS link_wallet_to_account(TEXT, UUID);
CREATE OR REPLACE FUNCTION link_wallet_to_account(p_wallet TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cur_linked TEXT;
  v_existing_owner UUID;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));

  IF p_wallet IS NULL OR p_wallet = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid wallet address');
  END IF;

  -- 1. Check if user ALREADY has a permanently locked linked_wallet_address
  SELECT linked_wallet_address INTO v_cur_linked
  FROM users
  WHERE user_id = p_user_id;

  IF v_cur_linked IS NOT NULL AND v_cur_linked <> '' THEN
    IF LOWER(v_cur_linked) <> p_wallet THEN
      RETURN jsonb_build_object(
        'success', false, 
        'message', 'Permanent Wallet Lock: Your account is permanently linked to another wallet and cannot be changed.'
      );
    ELSE
      RETURN jsonb_build_object('success', true, 'message', 'Wallet already linked.', 'wallet', v_cur_linked);
    END IF;
  END IF;

  -- 2. Prevent stealing a wallet address already registered to ANOTHER user
  SELECT user_id INTO v_existing_owner 
  FROM users 
  WHERE (LOWER(linked_wallet_address) = p_wallet OR LOWER(player_id) = p_wallet)
    AND user_id IS NOT NULL 
    AND user_id <> p_user_id;

  IF v_existing_owner IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'This wallet is already registered to another account in database.'
    );
  END IF;

  -- 3. Purge any duplicate unauthenticated guest row created for p_wallet
  DELETE FROM users 
  WHERE (LOWER(player_id) = p_wallet OR LOWER(linked_wallet_address) = p_wallet)
    AND (user_id IS NULL OR user_id <> p_user_id);

  -- 4. Set permanent linked_wallet_address directly on the Google account row
  UPDATE users 
  SET linked_wallet_address = p_wallet,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Wallet linked successfully!', 'wallet', p_wallet);
END;
$$;
GRANT EXECUTE ON FUNCTION link_wallet_to_account(TEXT, UUID) TO anon, authenticated, service_role;

-- Step 8: Database Engine Immutability Trigger for linked_wallet_address
CREATE OR REPLACE FUNCTION lock_linked_wallet_address()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.linked_wallet_address IS NOT NULL AND OLD.linked_wallet_address <> '' THEN
    IF NEW.linked_wallet_address IS DISTINCT FROM OLD.linked_wallet_address AND NEW.linked_wallet_address IS NOT NULL AND NEW.linked_wallet_address <> '' THEN
      NEW.linked_wallet_address := OLD.linked_wallet_address;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_linked_wallet ON users;
CREATE TRIGGER trg_lock_linked_wallet
BEFORE UPDATE ON users
FOR EACH ROW
WHEN (OLD.linked_wallet_address IS NOT NULL AND OLD.linked_wallet_address <> '')
EXECUTE FUNCTION lock_linked_wallet_address();
