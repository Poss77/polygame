-- ==============================================================================
-- POLYGON GAMING: FIX STAKING PROCEDURES & REMOVE balance_1flr REFERENCES
-- ==============================================================================
-- Run this migration in the Supabase SQL Editor.
-- Fixes PostgreSQL Error 42703: "column 'balance_1flr' does not exist" and
-- "record 'v_user' has no field 'balance_1flr'" when calling unstake_all,
-- unstake_position, deposit_stake, and harvest_yield.
-- All staking pools in Polygon Gaming run authoritatively on PGT.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: deposit_stake
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.deposit_stake(TEXT, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS public.deposit_stake(TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BIGINT);
DROP FUNCTION IF EXISTS deposit_stake(TEXT, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS deposit_stake(TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BIGINT);

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
  v_pid TEXT;
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
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

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

  -- Check token balance (PGT Staking)
  IF v_pool = 'pgt' THEN
    v_balance := COALESCE(v_user.balance_pgt, 0);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid pool: Only PGT staking is supported');
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT token balance');
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
  UPDATE public.users
  SET balance_pgt = balance_pgt - p_amount,
      staked_balance_pgt = COALESCE(staked_balance_pgt, 0) + p_amount,
      updated_at = v_now
  WHERE player_id = v_user.player_id;

  -- Insert authoritative record into user_stakes
  INSERT INTO public.user_stakes (wallet_address, pool, amount, tier, apy, staked_at, lock_until, last_harvest, active)
  VALUES (v_user.player_id, 'pgt', p_amount, v_tier, v_final_apy, v_now, v_lock_until, v_now, true)
  RETURNING id INTO v_stake_id;

  RETURN jsonb_build_object(
    'success', true,
    'stake_id', v_stake_id,
    'amount', p_amount,
    'pool', 'pgt',
    'tier', v_tier,
    'apy', v_final_apy,
    'lock_until', v_lock_until,
    'new_balance', v_balance - p_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.deposit_stake(TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BIGINT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.deposit_stake(TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BIGINT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: unstake_position
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.unstake_position(TEXT, UUID);
DROP FUNCTION IF EXISTS unstake_position(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.unstake_position(
  p_wallet TEXT,
  p_stake_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_stake RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_reward NUMERIC := 0;
  v_total_return NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  v_elapsed_seconds NUMERIC;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

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

GRANT EXECUTE ON FUNCTION public.unstake_position(TEXT, UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.unstake_position(TEXT, UUID) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: unstake_all
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.unstake_all(TEXT);
DROP FUNCTION IF EXISTS public.unstake_all(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.unstake_all(TEXT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.unstake_all(
  p_wallet TEXT,
  p_pool TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_stake RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_count INTEGER := 0;
  v_total_payout_pgt NUMERIC := 0;
  v_total_yield_pgt NUMERIC := 0;
  v_total_staked_deduct_pgt NUMERIC := 0;
  v_reward NUMERIC;
  v_elapsed_seconds NUMERIC;
  v_clean_pool TEXT := LOWER(TRIM(COALESCE(p_pool, '')));
  v_new_balance NUMERIC := 0;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
     OR LOWER(player_id) = LOWER(v_pid)
  FOR UPDATE;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User account not found');
  END IF;

  -- STRICT GUARD: Only select stakes that have NO TIME LEFT (lock_until <= v_now)
  FOR v_stake IN
    SELECT * FROM public.user_stakes
    WHERE (LOWER(wallet_address) = LOWER(v_user.player_id)
           OR LOWER(wallet_address) = LOWER(COALESCE(v_user.linked_wallet_address, ''))
           OR LOWER(wallet_address) = LOWER(p_wallet))
      AND active = true
      AND (v_clean_pool = '' OR LOWER(pool) = v_clean_pool)
      AND lock_until <= v_now
    FOR UPDATE
  LOOP
    v_elapsed_seconds := EXTRACT(EPOCH FROM (v_now - COALESCE(v_stake.last_harvest, v_stake.staked_at)));
    v_reward := ROUND(v_stake.amount * (v_stake.apy / 100.0) * (v_elapsed_seconds / 31536000.0), 4);
    IF v_reward < 0 THEN v_reward := 0; END IF;

    v_count := v_count + 1;

    v_total_payout_pgt := v_total_payout_pgt + v_stake.amount + v_reward;
    v_total_yield_pgt := v_total_yield_pgt + v_reward;
    v_total_staked_deduct_pgt := v_total_staked_deduct_pgt + v_stake.amount;

    UPDATE public.user_stakes
    SET active = false,
        last_harvest = v_now
    WHERE id = v_stake.id;
  END LOOP;

  IF v_count > 0 THEN
    UPDATE public.users
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_total_payout_pgt,
        staked_balance_pgt = GREATEST(0, COALESCE(staked_balance_pgt, 0) - v_total_staked_deduct_pgt),
        total_staking_yield = COALESCE(total_staking_yield, 0) + v_total_yield_pgt,
        updated_at = v_now
    WHERE player_id = v_user.player_id
    RETURNING balance_pgt INTO v_new_balance;

    IF v_total_yield_pgt > 0 THEN
      PERFORM public.process_referral_commissions(v_user.player_id, v_total_yield_pgt, 'Staking Yield');
    END IF;
  ELSE
    v_new_balance := COALESCE(v_user.balance_pgt, 0);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'count', v_count,
    'unstaked_count', v_count,
    'total_payout', v_total_payout_pgt,
    'payback', v_total_payout_pgt,
    'total_yield', v_total_yield_pgt,
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.unstake_all(TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.unstake_all(TEXT, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: unstake_all_matured (Backward-compatible delegate)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.unstake_all_matured(TEXT);
DROP FUNCTION IF EXISTS public.unstake_all_matured(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.unstake_all_matured(
  p_wallet TEXT,
  p_pool TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN public.unstake_all(p_wallet, p_pool);
END;
$$;

GRANT EXECUTE ON FUNCTION public.unstake_all_matured(TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.unstake_all_matured(TEXT, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: harvest_yield
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.harvest_yield(TEXT, UUID);
DROP FUNCTION IF EXISTS harvest_yield(TEXT, UUID);

CREATE OR REPLACE FUNCTION public.harvest_yield(
  p_wallet TEXT,
  p_stake_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_stake RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_reward NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  v_elapsed_seconds NUMERIC;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

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
  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_reward,
      total_staking_yield = COALESCE(total_staking_yield, 0) + v_reward,
      updated_at = v_now
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  PERFORM public.process_referral_commissions(v_user.player_id, v_reward, 'Staking Yield');

  RETURN jsonb_build_object(
    'success', true,
    'stake_id', p_stake_id,
    'yield', v_reward,
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.harvest_yield(TEXT, UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.harvest_yield(TEXT, UUID) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: harvest_all_yield
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.harvest_all_yield(TEXT);
DROP FUNCTION IF EXISTS public.harvest_all_yield(TEXT, TEXT);
DROP FUNCTION IF EXISTS harvest_all_yield(TEXT);
DROP FUNCTION IF EXISTS harvest_all_yield(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.harvest_all_yield(
  p_wallet TEXT,
  p_pool TEXT DEFAULT 'pgt'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_stake RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_count INTEGER := 0;
  v_total_yield NUMERIC := 0;
  v_reward NUMERIC;
  v_elapsed_seconds NUMERIC;
  v_new_balance NUMERIC := 0;
  v_pool TEXT := LOWER(TRIM(COALESCE(p_pool, 'pgt')));
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

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
    UPDATE public.users
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_total_yield,
        total_staking_yield = COALESCE(total_staking_yield, 0) + v_total_yield,
        updated_at = v_now
    WHERE player_id = v_user.player_id
    RETURNING balance_pgt INTO v_new_balance;

    PERFORM public.process_referral_commissions(v_user.player_id, v_total_yield, 'Staking Yield');
  ELSE
    v_new_balance := COALESCE(v_user.balance_pgt, 0);
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

GRANT EXECUTE ON FUNCTION public.harvest_all_yield(TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.harvest_all_yield(TEXT, TEXT) FROM anon;

-- ==============================================================================
-- END OF MIGRATION
-- ==============================================================================
