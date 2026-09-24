-- ==============================================================================
-- POLYGON GAMING MIGRATION: FIX STAKING APY NFT BOOST & RECALCULATE ACTIVE STAKES
-- Issue: deposit_stake checked owned_nfts with @> '[{"id":"..."}]' (object array),
--        but users.owned_nfts is stored as string array '["..."]'.
--        This caused NFT boosts (1.05x, 1.15x, 1.50x, 2.00x) to be ignored on the server,
--        dropping APY from 7.97% to 2.20% on page refresh.
-- Fix:
--   1. Upgrade deposit_stake to support both string array (?) and object array (@>) formats.
--   2. Add missing nft_epic_yield (+5% APY) check.
--   3. Backfill and recalculate apy for all currently active user stakes in public.user_stakes.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Upgrade public.deposit_stake
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
  v_all_nfts JSONB;
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

  -- NFT Staking Boosts (Calculated authoritatively from owned_nfts & crate_nfts)
  -- Supports active catalog string arrays ('["..."]') and legacy object arrays ('[{"id":"..."}]')
  v_all_nfts := COALESCE(v_user.owned_nfts, '[]'::jsonb) || COALESCE(v_user.crate_nfts, '[]'::jsonb);

  -- 1. Epic Yield (+5% APY -> 1.05x)
  IF (v_all_nfts ? 'nft_epic_yield')
     OR (v_all_nfts @> '[{"id":"nft_epic_yield"}]'::jsonb)
     OR (v_all_nfts @> '["nft_epic_yield"]'::jsonb) THEN
    v_nft_boost := v_nft_boost * 1.05;
  END IF;

  -- 2. Yield Vault Common (+15% APY -> 1.15x)
  IF (v_all_nfts ? 'nft_yield_vault')
     OR (v_all_nfts @> '[{"id":"nft_yield_vault"}]'::jsonb)
     OR (v_all_nfts @> '["nft_yield_vault"]'::jsonb) THEN
    v_nft_boost := v_nft_boost * 1.15;
  END IF;

  -- 3. Yield Vault Rare (+50% APY -> 1.50x)
  IF (v_all_nfts ? 'nft_yield_vault_rare')
     OR (v_all_nfts @> '[{"id":"nft_yield_vault_rare"}]'::jsonb)
     OR (v_all_nfts @> '["nft_yield_vault_rare"]'::jsonb) THEN
    v_nft_boost := v_nft_boost * 1.50;
  END IF;

  -- 4. Yield Vault Epic (+100% APY -> 2.00x)
  IF (v_all_nfts ? 'nft_yield_vault_epic')
     OR (v_all_nfts @> '[{"id":"nft_yield_vault_epic"}]'::jsonb)
     OR (v_all_nfts @> '["nft_yield_vault_epic"]'::jsonb) THEN
    v_nft_boost := v_nft_boost * 2.00;
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
-- 2. Backfill: Recalculate APY for all Active Stakes in public.user_stakes
-- ------------------------------------------------------------------------------
UPDATE public.user_stakes us
SET apy = sub.calculated_apy
FROM (
  SELECT 
    s.id,
    ROUND(
      LEAST(
        50.0,
        (CASE WHEN s.tier = 'year' THEN 3.0 WHEN s.tier = 'month' THEN 2.0 ELSE 1.0 END)
        * (CASE WHEN u.vip_until IS NOT NULL AND u.vip_until > NOW() THEN 2.0 ELSE 1.0 END)
        * (CASE WHEN u.is_ambassador = true THEN 1.10 ELSE 1.0 END)
        * (CASE WHEN (COALESCE(u.owned_nfts, '[]'::jsonb) || COALESCE(u.crate_nfts, '[]'::jsonb)) ? 'nft_epic_yield' 
                  OR (COALESCE(u.owned_nfts, '[]'::jsonb) || COALESCE(u.crate_nfts, '[]'::jsonb)) @> '[{"id":"nft_epic_yield"}]'::jsonb 
                THEN 1.05 ELSE 1.0 END)
        * (CASE WHEN (COALESCE(u.owned_nfts, '[]'::jsonb) || COALESCE(u.crate_nfts, '[]'::jsonb)) ? 'nft_yield_vault' 
                  OR (COALESCE(u.owned_nfts, '[]'::jsonb) || COALESCE(u.crate_nfts, '[]'::jsonb)) @> '[{"id":"nft_yield_vault"}]'::jsonb 
                THEN 1.15 ELSE 1.0 END)
        * (CASE WHEN (COALESCE(u.owned_nfts, '[]'::jsonb) || COALESCE(u.crate_nfts, '[]'::jsonb)) ? 'nft_yield_vault_rare' 
                  OR (COALESCE(u.owned_nfts, '[]'::jsonb) || COALESCE(u.crate_nfts, '[]'::jsonb)) @> '[{"id":"nft_yield_vault_rare"}]'::jsonb 
                THEN 1.50 ELSE 1.0 END)
        * (CASE WHEN (COALESCE(u.owned_nfts, '[]'::jsonb) || COALESCE(u.crate_nfts, '[]'::jsonb)) ? 'nft_yield_vault_epic' 
                  OR (COALESCE(u.owned_nfts, '[]'::jsonb) || COALESCE(u.crate_nfts, '[]'::jsonb)) @> '[{"id":"nft_yield_vault_epic"}]'::jsonb 
                THEN 2.00 ELSE 1.0 END)
      ),
      4
    ) AS calculated_apy
  FROM public.user_stakes s
  JOIN public.users u ON (
    LOWER(s.wallet_address) = LOWER(u.player_id)
    OR (u.linked_wallet_address IS NOT NULL AND LOWER(s.wallet_address) = LOWER(u.linked_wallet_address))
  )
  WHERE s.active = true
) sub
WHERE us.id = sub.id;

-- ------------------------------------------------------------------------------
-- 3. Verification Query: Confirm Updated APY on Active Stakes
-- ------------------------------------------------------------------------------
SELECT id, wallet_address, amount, tier, apy, staked_at, active
FROM public.user_stakes
WHERE active = true
ORDER BY staked_at DESC
LIMIT 10;
