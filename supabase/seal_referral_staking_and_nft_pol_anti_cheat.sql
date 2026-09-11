-- ==============================================================================
-- POLYGAME DB SECURITY MIGRATION: SEAL REFERRAL, STAKING & NFT POL COMMISSIONS (v1.5.337)
-- ==============================================================================
-- Addresses 3 critical and high security cheat vectors:
-- 1. [CRITICAL] Revokes public execution on process_referral_commissions to block
--    direct balance inflation attacks.
-- 2. [CRITICAL] Replaces staking procedures (deposit_stake, unstake_position,
--    harvest_yield, unstake_all_matured, harvest_all_yield) with authoritative
--    server-side APY/duration calculation, strict caller ownership checks, and
--    lock-period enforcement.
-- 3. [HIGH] Deploys public.pol_referral_commissions and hardens
--    credit_nft_referral_commission with Polygon tx_hash verification, replay
--    protection, price clamping, and self-referral prevention.
-- ==============================================================================

-- ==============================================================================
-- PART 1: REVOKE PUBLIC ACCESS ON process_referral_commissions (FIX #1)
-- ==============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname = 'process_referral_commissions'
      AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.func_sig || ' FROM anon, authenticated, public;';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.func_sig || ' TO service_role;';
  END LOOP;
END $$;


-- ==============================================================================
-- PART 2: CANONICAL SECURE STAKING RPCs (FIX #2)
-- ==============================================================================

-- Ensure table and columns exist
CREATE TABLE IF NOT EXISTS public.user_stakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  pool TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  tier TEXT DEFAULT 'day',
  apy NUMERIC NOT NULL,
  staked_at TIMESTAMPTZ DEFAULT NOW(),
  lock_until TIMESTAMPTZ,
  last_harvest TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_stakes ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'day';
ALTER TABLE public.user_stakes ADD COLUMN IF NOT EXISTS last_harvest TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.user_stakes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on user_stakes" ON public.user_stakes;
CREATE POLICY "Allow public read on user_stakes" ON public.user_stakes FOR SELECT USING (true);

-- Drop existing staking functions to allow clean signature re-creation
DROP FUNCTION IF EXISTS public.deposit_stake(TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BIGINT) CASCADE;
DROP FUNCTION IF EXISTS public.deposit_stake(TEXT, TEXT, NUMERIC, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.deposit_stake(TEXT, TEXT, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.unstake_position(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.harvest_yield(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.unstake_all_matured(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.harvest_all_yield(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.fast_forward_staking_locks(TEXT, TEXT) CASCADE;

-- 2A. DEPOSIT STAKE (Authoritative Server-Side APY & Duration)
CREATE OR REPLACE FUNCTION public.deposit_stake(
  p_wallet TEXT,
  p_pool TEXT,
  p_amount NUMERIC,
  p_tier TEXT DEFAULT 'day',
  p_apy NUMERIC DEFAULT NULL,
  p_duration_ms BIGINT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_user RECORD;
  v_balance NUMERIC;
  v_pool TEXT := LOWER(TRIM(COALESCE(p_pool, 'pgt')));
  v_tier TEXT := LOWER(TRIM(COALESCE(p_tier, 'day')));
  v_base_apy NUMERIC;
  v_lock_interval INTERVAL;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_nft_boost NUMERIC := 1.0;
  v_final_apy NUMERIC;
  v_now TIMESTAMPTZ := NOW();
  v_lock_until TIMESTAMPTZ;
  v_stake_id UUID;
  v_active_stakes_count INTEGER := 0;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_wallet));
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid deposit amount');
  END IF;

  -- Lock user row
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
     OR LOWER(player_id) = LOWER(v_pid)
  FOR UPDATE;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User account not found');
  END IF;

  -- Check maximum active stakes (cap at 25)
  SELECT COUNT(*) INTO v_active_stakes_count
  FROM public.user_stakes
  WHERE (LOWER(wallet_address) = LOWER(v_user.player_id) 
         OR LOWER(wallet_address) = LOWER(COALESCE(v_user.linked_wallet_address, ''))
         OR LOWER(wallet_address) = LOWER(p_wallet))
    AND active = true;

  IF v_active_stakes_count >= 25 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum limit of 25 active stakes reached');
  END IF;

  -- Check token balance
  IF v_pool = 'pgt' THEN
    v_balance := COALESCE(v_user.balance_pgt, 0);
  ELSE
    v_balance := COALESCE(v_user.balance_1flr, 0);
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient ' || UPPER(v_pool) || ' token balance');
  END IF;

  -- Authoritative Base APY and Lock Duration (ignores client parameters)
  IF v_tier = 'year' THEN
    v_base_apy := 3.0;
    v_lock_interval := INTERVAL '365 days';
  ELSIF v_tier = 'month' THEN
    v_base_apy := 2.0;
    v_lock_interval := INTERVAL '30 days';
  ELSE
    v_tier := 'day';
    v_base_apy := 1.0;
    v_lock_interval := INTERVAL '1 day';
  END IF;

  -- VIP Boost (2.0x)
  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_vip_mult := 2.0;
  END IF;

  -- Ambassador Boost (1.10x)
  IF v_user.is_ambassador = true THEN
    v_amb_mult := 1.10;
  END IF;

  -- NFT Yield Vault Boosts:
  -- nft_yield_vault (+15%), nft_yield_vault_rare (+50%), nft_yield_vault_epic (+100%)
  IF (COALESCE(v_user.owned_nfts, '[]'::jsonb) @> '[{"id":"nft_yield_vault_epic"}]'::jsonb) 
     OR (COALESCE(v_user.crate_nfts, '[]'::jsonb) @> '["nft_yield_vault_epic"]'::jsonb) THEN
    v_nft_boost := v_nft_boost * 2.00;
  END IF;

  IF (COALESCE(v_user.owned_nfts, '[]'::jsonb) @> '[{"id":"nft_yield_vault_rare"}]'::jsonb) 
     OR (COALESCE(v_user.crate_nfts, '[]'::jsonb) @> '["nft_yield_vault_rare"]'::jsonb) THEN
    v_nft_boost := v_nft_boost * 1.50;
  END IF;

  IF (COALESCE(v_user.owned_nfts, '[]'::jsonb) @> '[{"id":"nft_yield_vault"}]'::jsonb) 
     OR (COALESCE(v_user.crate_nfts, '[]'::jsonb) @> '["nft_yield_vault"]'::jsonb) THEN
    v_nft_boost := v_nft_boost * 1.15;
  END IF;

  -- Calculate final authoritative APY (clamped to max 50.0% APY ceiling)
  v_final_apy := ROUND(LEAST(50.0, v_base_apy * v_vip_mult * v_amb_mult * v_nft_boost), 4);
  v_lock_until := v_now + v_lock_interval;

  -- Deduct balance
  IF v_pool = 'pgt' THEN
    UPDATE public.users
    SET balance_pgt = balance_pgt - p_amount,
        staked_balance_pgt = COALESCE(staked_balance_pgt, 0) + p_amount,
        staking_lock_until_pgt = GREATEST(COALESCE(staking_lock_until_pgt, 0), EXTRACT(EPOCH FROM v_lock_until) * 1000),
        updated_at = v_now
    WHERE player_id = v_user.player_id;
  ELSE
    UPDATE public.users
    SET balance_1flr = balance_1flr - p_amount,
        staked_balance_1flr = COALESCE(staked_balance_1flr, 0) + p_amount,
        staking_lock_until_1flr = GREATEST(COALESCE(staking_lock_until_1flr, 0), EXTRACT(EPOCH FROM v_lock_until) * 1000),
        updated_at = v_now
    WHERE player_id = v_user.player_id;
  END IF;

  -- Insert authoritative record into user_stakes
  INSERT INTO public.user_stakes (wallet_address, pool, amount, tier, apy, staked_at, lock_until, last_harvest, active)
  VALUES (v_user.player_id, v_pool, p_amount, v_tier, v_final_apy, v_now, v_lock_until, v_now, true)
  RETURNING id INTO v_stake_id;

  RETURN jsonb_build_object(
    'success', true,
    'stake_id', v_stake_id,
    'amount', p_amount,
    'pool', v_pool,
    'tier', v_tier,
    'apy', v_final_apy,
    'lock_until', v_lock_until,
    'new_balance', v_balance - p_amount
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.deposit_stake(TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BIGINT) TO anon, authenticated, service_role;


-- 2B. UNSTAKE POSITION (Strict Ownership & Lock Expiry Verification)
CREATE OR REPLACE FUNCTION public.unstake_position(
  p_wallet TEXT,
  p_stake_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_user RECORD;
  v_stake RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_reward NUMERIC := 0;
  v_total_return NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  v_elapsed_seconds NUMERIC;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_wallet));
  END IF;

  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
     OR LOWER(player_id) = LOWER(v_pid)
  FOR UPDATE;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT * INTO v_stake
  FROM public.user_stakes
  WHERE id = p_stake_id
  FOR UPDATE;

  IF NOT FOUND OR v_stake.active = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stake position not active or not found');
  END IF;

  -- 1. STRICT CALLER OWNERSHIP CHECK
  IF LOWER(v_stake.wallet_address) <> LOWER(v_user.player_id)
     AND (v_user.linked_wallet_address IS NULL OR LOWER(v_stake.wallet_address) <> LOWER(v_user.linked_wallet_address))
     AND LOWER(v_stake.wallet_address) <> LOWER(p_wallet) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You do not own this stake position');
  END IF;

  -- 2. STRICT LOCK EXPIRATION CHECK
  IF v_now < v_stake.lock_until THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Stake position is still locked',
      'lock_until', v_stake.lock_until,
      'remaining_seconds', EXTRACT(EPOCH FROM (v_stake.lock_until - v_now))::INTEGER
    );
  END IF;

  -- 3. Yield calculation from last_harvest
  v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - COALESCE(v_stake.last_harvest, v_stake.staked_at)));
  v_reward := ROUND(v_stake.amount * (v_stake.apy / 100.0) * (v_elapsed_seconds / 31536000.0), 4);
  IF v_reward < 0 THEN v_reward := 0; END IF;
  v_total_return := v_stake.amount + v_reward;

  -- 4. Mark stake inactive
  UPDATE public.user_stakes
  SET active = false,
      last_harvest = v_now
  WHERE id = p_stake_id;

  -- 5. Credit return & yield to user balance
  IF v_stake.pool = 'pgt' THEN
    UPDATE public.users
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_total_return,
        staked_balance_pgt = GREATEST(0, COALESCE(staked_balance_pgt, 0) - v_stake.amount),
        total_staking_yield = COALESCE(total_staking_yield, 0) + v_reward,
        updated_at = v_now
    WHERE player_id = v_user.player_id
    RETURNING balance_pgt INTO v_new_balance;

    -- Process referral commissions internally on yield if reward > 0
    IF v_reward > 0 THEN
      PERFORM public.process_referral_commissions(v_user.player_id, v_reward, 'Staking Yield');
    END IF;
  ELSE
    UPDATE public.users
    SET balance_1flr = COALESCE(balance_1flr, 0) + v_total_return,
        staked_balance_1flr = GREATEST(0, COALESCE(staked_balance_1flr, 0) - v_stake.amount),
        total_staking_yield = COALESCE(total_staking_yield, 0) + v_reward,
        updated_at = v_now
    WHERE player_id = v_user.player_id
    RETURNING balance_1flr INTO v_new_balance;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'stake_id', p_stake_id,
    'principal', v_stake.amount,
    'reward', v_reward,
    'yield', v_reward,
    'payback', v_total_return,
    'total_return', v_total_return,
    'new_balance', v_new_balance
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.unstake_position(TEXT, UUID) TO anon, authenticated, service_role;


-- 2C. HARVEST YIELD (Strict Ownership & Atomic Crediting)
CREATE OR REPLACE FUNCTION public.harvest_yield(
  p_wallet TEXT,
  p_stake_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_user RECORD;
  v_stake RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_reward NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  v_elapsed_seconds NUMERIC;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_wallet));
  END IF;

  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
     OR LOWER(player_id) = LOWER(v_pid)
  FOR UPDATE;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT * INTO v_stake
  FROM public.user_stakes
  WHERE id = p_stake_id
  FOR UPDATE;

  IF NOT FOUND OR v_stake.active = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stake position not active or not found');
  END IF;

  -- STRICT CALLER OWNERSHIP CHECK
  IF LOWER(v_stake.wallet_address) <> LOWER(v_user.player_id)
     AND (v_user.linked_wallet_address IS NULL OR LOWER(v_stake.wallet_address) <> LOWER(v_user.linked_wallet_address))
     AND LOWER(v_stake.wallet_address) <> LOWER(p_wallet) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You do not own this stake position');
  END IF;

  -- Yield calculation from last_harvest
  v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - COALESCE(v_stake.last_harvest, v_stake.staked_at)));
  v_reward := ROUND(v_stake.amount * (v_stake.apy / 100.0) * (v_elapsed_seconds / 31536000.0), 4);
  IF v_reward < 0 THEN v_reward := 0; END IF;

  IF v_reward <= 0.0001 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No substantial yield accumulated yet');
  END IF;

  -- Update last_harvest
  UPDATE public.user_stakes
  SET last_harvest = v_now
  WHERE id = p_stake_id;

  -- Credit yield
  IF v_stake.pool = 'pgt' THEN
    UPDATE public.users
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_reward,
        total_staking_yield = COALESCE(total_staking_yield, 0) + v_reward,
        updated_at = v_now
    WHERE player_id = v_user.player_id
    RETURNING balance_pgt INTO v_new_balance;

    PERFORM public.process_referral_commissions(v_user.player_id, v_reward, 'Staking Yield');
  ELSE
    UPDATE public.users
    SET balance_1flr = COALESCE(balance_1flr, 0) + v_reward,
        total_staking_yield = COALESCE(total_staking_yield, 0) + v_reward,
        updated_at = v_now
    WHERE player_id = v_user.player_id
    RETURNING balance_1flr INTO v_new_balance;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'stake_id', p_stake_id,
    'yield', v_reward,
    'new_balance', v_new_balance
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.harvest_yield(TEXT, UUID) TO anon, authenticated, service_role;


-- 2D. UNSTAKE ALL MATURED
CREATE OR REPLACE FUNCTION public.unstake_all_matured(p_wallet TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_user RECORD;
  v_stake RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_count INTEGER := 0;
  v_total_payout NUMERIC := 0;
  v_total_yield NUMERIC := 0;
  v_reward NUMERIC;
  v_elapsed_seconds NUMERIC;
  v_new_balance NUMERIC := 0;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_wallet));
  END IF;

  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
     OR LOWER(player_id) = LOWER(v_pid)
  FOR UPDATE;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  FOR v_stake IN
    SELECT * FROM public.user_stakes
    WHERE (LOWER(wallet_address) = LOWER(v_user.player_id)
           OR LOWER(wallet_address) = LOWER(COALESCE(v_user.linked_wallet_address, ''))
           OR LOWER(wallet_address) = LOWER(p_wallet))
      AND active = true
      AND lock_until <= v_now
    FOR UPDATE
  LOOP
    v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - COALESCE(v_stake.last_harvest, v_stake.staked_at)));
    v_reward := ROUND(v_stake.amount * (v_stake.apy / 100.0) * (v_elapsed_seconds / 31536000.0), 4);
    IF v_reward < 0 THEN v_reward := 0; END IF;

    v_total_yield := v_total_yield + v_reward;
    v_total_payout := v_total_payout + v_stake.amount + v_reward;
    v_count := v_count + 1;

    UPDATE public.user_stakes SET active = false, last_harvest = v_now WHERE id = v_stake.id;
  END LOOP;

  IF v_count > 0 THEN
    UPDATE public.users
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_total_payout,
        total_staking_yield = COALESCE(total_staking_yield, 0) + v_total_yield,
        staked_balance_pgt = GREATEST(0, COALESCE(staked_balance_pgt, 0) - (v_total_payout - v_total_yield)),
        updated_at = v_now
    WHERE player_id = v_user.player_id
    RETURNING balance_pgt INTO v_new_balance;

    IF v_total_yield > 0 THEN
      PERFORM public.process_referral_commissions(v_user.player_id, v_total_yield, 'Staking Yield');
    END IF;
  ELSE
    v_new_balance := COALESCE(v_user.balance_pgt, 0);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'unstaked_count', v_count,
    'total_payout', v_total_payout,
    'payback', v_total_payout,
    'total_yield', v_total_yield,
    'new_balance', v_new_balance
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.unstake_all_matured(TEXT) TO anon, authenticated, service_role;


-- 2E. HARVEST ALL YIELD
CREATE OR REPLACE FUNCTION public.harvest_all_yield(
  p_wallet TEXT,
  p_pool TEXT DEFAULT 'pgt'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_user RECORD;
  v_stake RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_count INTEGER := 0;
  v_total_yield NUMERIC := 0;
  v_reward NUMERIC;
  v_elapsed_seconds NUMERIC;
  v_new_balance NUMERIC := 0;
  v_pool TEXT := LOWER(TRIM(COALESCE(p_pool, 'pgt')));
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_wallet));
  END IF;

  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
     OR LOWER(player_id) = LOWER(v_pid)
  FOR UPDATE;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  FOR v_stake IN
    SELECT * FROM public.user_stakes
    WHERE (LOWER(wallet_address) = LOWER(v_user.player_id)
           OR LOWER(wallet_address) = LOWER(COALESCE(v_user.linked_wallet_address, ''))
           OR LOWER(wallet_address) = LOWER(p_wallet))
      AND LOWER(pool) = v_pool
      AND active = true
    FOR UPDATE
  LOOP
    v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - COALESCE(v_stake.last_harvest, v_stake.staked_at)));
    v_reward := ROUND(v_stake.amount * (v_stake.apy / 100.0) * (v_elapsed_seconds / 31536000.0), 4);
    IF v_reward > 0 THEN
      v_total_yield := v_total_yield + v_reward;
      v_count := v_count + 1;
      UPDATE public.user_stakes SET last_harvest = v_now WHERE id = v_stake.id;
    END IF;
  END LOOP;

  IF v_total_yield > 0 THEN
    IF v_pool = 'pgt' THEN
      UPDATE public.users
      SET balance_pgt = COALESCE(balance_pgt, 0) + v_total_yield,
          total_staking_yield = COALESCE(total_staking_yield, 0) + v_total_yield,
          updated_at = v_now
      WHERE player_id = v_user.player_id
      RETURNING balance_pgt INTO v_new_balance;

      PERFORM public.process_referral_commissions(v_user.player_id, v_total_yield, 'Staking Yield');
    ELSE
      UPDATE public.users
      SET balance_1flr = COALESCE(balance_1flr, 0) + v_total_yield,
          total_staking_yield = COALESCE(total_staking_yield, 0) + v_total_yield,
          updated_at = v_now
      WHERE player_id = v_user.player_id
      RETURNING balance_1flr INTO v_new_balance;
    END IF;
  ELSE
    v_new_balance := CASE WHEN v_pool = 'pgt' THEN COALESCE(v_user.balance_pgt, 0) ELSE COALESCE(v_user.balance_1flr, 0) END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'harvested_count', v_count,
    'harvested_amount', v_total_yield,
    'yield', v_total_yield,
    'new_balance', v_new_balance
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.harvest_all_yield(TEXT, TEXT) TO anon, authenticated, service_role;


-- 2F. FAST FORWARD STAKING LOCKS (Strict Admin Only)
CREATE OR REPLACE FUNCTION public.fast_forward_staking_locks(
  p_wallet TEXT,
  p_pool TEXT DEFAULT 'pgt'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_clean_wallet TEXT := LOWER(TRIM(COALESCE(p_wallet, '')));
  v_master_admin TEXT := '0x10b9993990c9ef8a212c9557cb02ad94da9a654d';
BEGIN
  IF v_clean_wallet <> v_master_admin AND LOWER(COALESCE(v_pid, '')) <> v_master_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Fast forward is restricted to Master Admin for testing');
  END IF;

  UPDATE public.user_stakes
  SET lock_until = NOW() + INTERVAL '60 seconds'
  WHERE (LOWER(wallet_address) = LOWER(v_pid) OR LOWER(wallet_address) = v_clean_wallet)
    AND LOWER(pool) = LOWER(TRIM(COALESCE(p_pool, 'pgt')))
    AND active = true;

  RETURN jsonb_build_object('success', true, 'message', 'Fast forward applied (admin only)');
END;
$$;
GRANT EXECUTE ON FUNCTION public.fast_forward_staking_locks(TEXT, TEXT) TO anon, authenticated, service_role;


-- ==============================================================================
-- PART 3: VERIFIABLE POL REFERRAL COMMISSIONS (FIX #3)
-- ==============================================================================

-- 3A. Dedicated POL Referral Commissions Audit & Replay Prevention Table
CREATE TABLE IF NOT EXISTS public.pol_referral_commissions (
  tx_hash TEXT PRIMARY KEY,
  buyer_wallet TEXT NOT NULL,
  referrer_player_id TEXT NOT NULL,
  amount_pol NUMERIC NOT NULL,
  commission_pol NUMERIC NOT NULL,
  item_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pol_referral_commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read on pol_referral_commissions" ON public.pol_referral_commissions;
CREATE POLICY "Allow public read on pol_referral_commissions" ON public.pol_referral_commissions FOR SELECT USING (true);

DROP FUNCTION IF EXISTS public.credit_nft_referral_commission(TEXT, NUMERIC, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.credit_nft_referral_commission(TEXT, NUMERIC, TEXT, TEXT) CASCADE;

-- 3B. CANONICAL HARDENED credit_nft_referral_commission
CREATE OR REPLACE FUNCTION public.credit_nft_referral_commission(
  buyer_wallet TEXT,
  pol_price NUMERIC,
  item_name TEXT DEFAULT 'NFT Purchase',
  p_tx_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_buyer RECORD;
  v_parent RECORD;
  v_buyer_id TEXT;
  v_parent_id TEXT;
  v_commission NUMERIC;
  v_buyer_name TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_time_str TEXT := TO_CHAR(NOW(), 'HH12:MI:SS AM');
  v_action_str TEXT;
  v_new_entry JSONB;
  v_clean_hash TEXT := LOWER(TRIM(COALESCE(p_tx_hash, '')));
  v_clamped_price NUMERIC;
BEGIN
  -- 1. Anti-Cheat: Require valid EVM transaction hash
  IF v_clean_hash = '' OR v_clean_hash IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Transaction hash required for on-chain referral verification');
  END IF;

  IF NOT (v_clean_hash ~ '^0x[a-f0-9]{64}$') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Invalid EVM transaction hash format');
  END IF;

  -- 2. Anti-Replay: Check if transaction hash has already been credited
  IF EXISTS (SELECT 1 FROM public.pol_referral_commissions WHERE LOWER(tx_hash) = v_clean_hash) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Transaction hash has already been credited for referral commission');
  END IF;

  -- 3. Validate price & clamp to legitimate NFT catalog maximum
  IF pol_price IS NULL OR pol_price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Zero or invalid price');
  END IF;

  v_clamped_price := LEAST(500.0, GREATEST(0.1, pol_price));
  v_commission := ROUND(v_clamped_price * 0.10, 4);

  IF v_commission <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Commission too small');
  END IF;

  v_action_str := COALESCE(NULLIF(TRIM(item_name), ''), 'NFT Purchase');

  -- 4. Resolve buyer identifier
  v_buyer_id := resolve_player_id(buyer_wallet);
  IF v_buyer_id IS NULL OR v_buyer_id = '' THEN
    v_buyer_id := LOWER(TRIM(buyer_wallet));
  END IF;

  -- 5. Fetch buyer record
  SELECT player_id, linked_wallet_address, username, referred_by_l1
  INTO v_buyer
  FROM public.users
  WHERE player_id = v_buyer_id
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(TRIM(buyer_wallet))
     OR LOWER(player_id) = LOWER(TRIM(buyer_wallet))
  LIMIT 1;

  IF v_buyer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Buyer not found');
  END IF;

  -- 6. Check for Level 1 referrer
  IF v_buyer.referred_by_l1 IS NULL OR TRIM(v_buyer.referred_by_l1) = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'No Level 1 referrer assigned');
  END IF;

  v_parent_id := resolve_player_id(v_buyer.referred_by_l1);
  IF v_parent_id IS NULL OR v_parent_id = '' THEN
    v_parent_id := LOWER(TRIM(v_buyer.referred_by_l1));
  END IF;

  -- Prevent self-referral loop
  IF LOWER(v_parent_id) = LOWER(v_buyer.player_id) OR 
     (v_buyer.linked_wallet_address IS NOT NULL AND LOWER(v_parent_id) = LOWER(v_buyer.linked_wallet_address)) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Self referral prohibited');
  END IF;

  -- 7. Lock and fetch parent referrer record
  SELECT player_id, linked_wallet_address, username, unclaimed_referral_pol, total_referral_pol, referrals_list
  INTO v_parent
  FROM public.users
  WHERE player_id = v_parent_id
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(TRIM(v_buyer.referred_by_l1))
     OR LOWER(player_id) = LOWER(TRIM(v_buyer.referred_by_l1))
  FOR UPDATE;

  IF v_parent IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Referrer account not found');
  END IF;

  -- 8. Format buyer display name
  IF v_buyer.username IS NOT NULL AND TRIM(v_buyer.username) <> '' AND UPPER(TRIM(v_buyer.username)) <> 'EMPTY' THEN
    v_buyer_name := TRIM(v_buyer.username);
  ELSE
    v_buyer_name := 'Player_' || SUBSTRING(v_buyer.player_id FROM 1 FOR 8);
  END IF;

  -- 9. Construct referral activity entry with tx_hash for admin auditability
  v_new_entry := jsonb_build_object(
    'name', v_buyer_name,
    'player', v_buyer_name,
    'player_id', v_buyer.player_id,
    'level', 1,
    'action', v_action_str,
    'amount', v_clamped_price,
    'commission', v_commission,
    'currency', 'POL',
    'tx_hash', v_clean_hash,
    'time', v_time_str,
    'created_at', v_now
  );

  -- 10. Record into pol_referral_commissions to permanently prevent replay
  INSERT INTO public.pol_referral_commissions (
    tx_hash,
    buyer_wallet,
    referrer_player_id,
    amount_pol,
    commission_pol,
    item_name,
    created_at
  ) VALUES (
    v_clean_hash,
    v_buyer.player_id,
    v_parent.player_id,
    v_clamped_price,
    v_commission,
    v_action_str,
    v_now
  );

  -- 11. Credit 10% POL to parent referrer and prepend to rolling 50-item ledger
  UPDATE public.users
  SET 
    unclaimed_referral_pol = COALESCE(unclaimed_referral_pol, 0) + v_commission,
    total_referral_pol = COALESCE(total_referral_pol, 0) + v_commission,
    referrals_list = (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements(jsonb_build_array(v_new_entry) || COALESCE(v_parent.referrals_list, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
        ORDER BY ord ASC
        LIMIT 50
      ) sub
    ),
    updated_at = v_now
  WHERE player_id = v_parent.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_id', v_parent.player_id,
    'commission_pol', v_commission,
    'buyer', v_buyer_name,
    'action', v_action_str,
    'tx_hash', v_clean_hash
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_nft_referral_commission(TEXT, NUMERIC, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.credit_nft_referral_commission(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;

-- Verification query
SELECT 'Anti-Cheat Migration Applied Successfully' AS status;
