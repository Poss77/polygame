-- ============================================================
-- POLYGAME UNIFIED PLAYER ID MIGRATION & FULL RPC REPAIR SCRIPT (v1.4.233)
-- Run this script in your Supabase SQL Editor to migrate database schema 
-- and repair all server-side RPC functions (Staking, Mini-Games, Faucet, Quests)
-- ============================================================

-- Step 1: Drop old foreign key constraint FIRST to prevent constraint violations during migration
ALTER TABLE user_stakes DROP CONSTRAINT IF EXISTS user_stakes_wallet_address_fkey;
ALTER TABLE user_stakes DROP CONSTRAINT IF EXISTS user_stakes_player_id_fkey;

-- Step 2: Ensure player_id and linked_wallet_address columns exist on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS player_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS linked_wallet_address TEXT;

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

-- 4. FAUCET: claim_faucet
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

-- 5. DAILY QUESTS: claim_daily_quest
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

-- 6. MINI-GAMES: Roshambo RPC
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

-- 7. MINI-GAMES: Lucky Spinner RPC
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

-- 8. MINI-GAMES: Cyber Invaders Score Submit RPC
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
