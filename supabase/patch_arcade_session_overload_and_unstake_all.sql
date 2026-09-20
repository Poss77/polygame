-- ==============================================================================
-- POLYGAME PATCH: ARCADE SESSION OVERLOAD FIX & MATURED UNSTAKE ALL RPC (v1.5.424)
--
-- 1. Drops obsolete 2-argument overload `public.start_arcade_session(TEXT, TEXT)`
--    to eliminate PostgREST function resolution ambiguity ("Could not choose the
--    best candidate function").
-- 2. Ensures canonical `public.start_arcade_session(TEXT, TEXT, TEXT)` is active.
-- 3. Implements `public.unstake_all(p_wallet TEXT, p_pool TEXT)`:
--    - STRICTLY unstakes ONLY positions that have NO TIME LEFT (`lock_until <= NOW()`).
--    - Positions that still have time remaining on their lock remain strictly locked.
--    - Supports both PGT and 1FLR pools (or all pools if pool is null/omitted).
--    - Awards full principal + accrued APY yield for all matured positions.
--    - Returns both `count` and `unstaked_count`, `total_payout`, `payback`, `total_yield`.
-- 4. Updates `public.unstake_all_matured(p_wallet TEXT, p_pool TEXT)` as a delegate.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DROP OBSOLETE ARCADE SESSION OVERLOAD
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.start_arcade_session(TEXT, TEXT);

-- ------------------------------------------------------------------------------
-- 2. DROP OBSOLETE UNSTAKE OVERLOADS
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.unstake_all(TEXT);
DROP FUNCTION IF EXISTS public.unstake_all(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.unstake_all(TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.unstake_all_matured(TEXT);
DROP FUNCTION IF EXISTS public.unstake_all_matured(TEXT, TEXT);

-- ------------------------------------------------------------------------------
-- 3. RPC: unstake_all (ONLY UNSTAKES POSITIONS WITH NO TIME LEFT)
-- ------------------------------------------------------------------------------
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
  v_pid TEXT := resolve_player_id(p_wallet);
  v_user RECORD;
  v_stake RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_count INTEGER := 0;
  v_total_payout_pgt NUMERIC := 0;
  v_total_yield_pgt NUMERIC := 0;
  v_total_staked_deduct_pgt NUMERIC := 0;
  v_total_payout_1flr NUMERIC := 0;
  v_total_yield_1flr NUMERIC := 0;
  v_total_staked_deduct_1flr NUMERIC := 0;
  v_reward NUMERIC;
  v_elapsed_seconds NUMERIC;
  v_clean_pool TEXT := LOWER(TRIM(COALESCE(p_pool, '')));
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

    IF LOWER(v_stake.pool) = 'pgt' THEN
      v_total_payout_pgt := v_total_payout_pgt + v_stake.amount + v_reward;
      v_total_yield_pgt := v_total_yield_pgt + v_reward;
      v_total_staked_deduct_pgt := v_total_staked_deduct_pgt + v_stake.amount;
    ELSE
      v_total_payout_1flr := v_total_payout_1flr + v_stake.amount + v_reward;
      v_total_yield_1flr := v_total_yield_1flr + v_reward;
      v_total_staked_deduct_1flr := v_total_staked_deduct_1flr + v_stake.amount;
    END IF;

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
        balance_1flr = COALESCE(balance_1flr, 0) + v_total_payout_1flr,
        updated_at = v_now
    WHERE player_id = v_user.player_id
    RETURNING (CASE WHEN v_clean_pool = '1flr' THEN balance_1flr ELSE balance_pgt END) INTO v_new_balance;

    IF v_total_yield_pgt > 0 THEN
      PERFORM public.process_referral_commissions(v_user.player_id, v_total_yield_pgt, 'Staking Yield');
    END IF;
  ELSE
    v_new_balance := CASE WHEN v_clean_pool = '1flr' THEN COALESCE(v_user.balance_1flr, 0) ELSE COALESCE(v_user.balance_pgt, 0) END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'count', v_count,
    'unstaked_count', v_count,
    'total_payout', CASE WHEN v_clean_pool = '1flr' THEN v_total_payout_1flr ELSE v_total_payout_pgt END,
    'payback', CASE WHEN v_clean_pool = '1flr' THEN v_total_payout_1flr ELSE v_total_payout_pgt END,
    'total_yield', CASE WHEN v_clean_pool = '1flr' THEN v_total_yield_1flr ELSE v_total_yield_pgt END,
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.unstake_all(TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. RPC: unstake_all_matured (Backward-compatible alias)
-- ------------------------------------------------------------------------------
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

GRANT EXECUTE ON FUNCTION public.unstake_all_matured(TEXT, TEXT) TO anon, authenticated, service_role;
