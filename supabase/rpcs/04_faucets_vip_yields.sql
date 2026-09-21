-- 4. FAUCETS, DEX LIQUIDITY & VIP POL YIELDS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC 1: claim_faucet (Server-Validated PGT Faucet)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT);
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS claim_faucet(TEXT);
DROP FUNCTION IF EXISTS claim_faucet(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.claim_faucet(
  p_player_id TEXT DEFAULT NULL,
  p_nft_boost_percent NUMERIC DEFAULT 0.0,
  p_1flr_balance NUMERIC DEFAULT 0.0,
  p_staked_pgt NUMERIC DEFAULT 0.0,
  p_onchain_pgt NUMERIC DEFAULT 0.0,
  p_lp_pgt NUMERIC DEFAULT 0.0,
  p_lp_usd NUMERIC DEFAULT 0.0,
  p_wallet TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_guard RECORD;
  v_raw_id TEXT := COALESCE(NULLIF(TRIM(p_player_id), ''), NULLIF(TRIM(p_wallet), ''));
  v_pid TEXT;
  v_user RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_cooldown_hours NUMERIC := 24.0;
  v_is_vip BOOLEAN := false;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_relic_mult NUMERIC := 1.0;
  v_lp_mult NUMERIC := 1.0;
  v_streak INTEGER := 0;
  v_streak_boost NUMERIC := 0.0;
  v_ref_count INTEGER := 0;
  v_ref_boost NUMERIC := 0.0;
  v_all_nfts JSONB;
  v_nft_boost NUMERIC := 0.0;
  v_total_boost_percent NUMERIC := 0.0;
  v_staked_pgt_total NUMERIC := 0.0;
  v_base_payout NUMERIC := 50.0;
  v_final_payout NUMERIC := 50.0;
  v_new_balance NUMERIC := 0;
  v_new_weekly_faucets INTEGER := 0;
  v_current_weekly_games INTEGER := 0;
  v_new_weekly_tier INTEGER := 0;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(v_raw_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT * INTO v_user FROM public.users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- 1. Fetch dynamic base payout from global_settings (defaults to 50.0 if not configured)
  BEGIN
    SELECT COALESCE(faucet_base_pgt, 50.0) INTO v_base_payout 
    FROM public.global_settings 
    WHERE id = 1 
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_base_payout := 50.0;
  END;

  IF v_base_payout IS NULL OR v_base_payout <= 0 THEN
    v_base_payout := 50.0;
  END IF;

  -- 2. VIP Status Check (Server-authoritative via users.vip_until)
  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_is_vip := true;
    v_vip_mult := 2.0;
    v_cooldown_hours := 21.6; -- 10% faster cooldown
  END IF;

  -- 3. Ambassador Status Check (Server-authoritative via users.is_ambassador)
  IF v_user.is_ambassador = true THEN
    v_amb_mult := 2.0;
  END IF;

  -- 4. Check Serie 1 Apex Relics Multiplier (1.5x) from DB relics
  IF is_season1_apex_unlocked(v_user.relics) THEN
    v_relic_mult := 1.5;
  END IF;

  -- 5. Check Tiered DEX Liquidity Provider Multiplier strictly based on DB users.dex_liquidity_usd
  -- ( = 1.1x,  = 1.2x,  = 1.3x)
  IF COALESCE(v_user.dex_liquidity_usd, 0) >= 150 THEN
    v_lp_mult := 1.30;
  ELSIF COALESCE(v_user.dex_liquidity_usd, 0) >= 100 THEN
    v_lp_mult := 1.20;
  ELSIF COALESCE(v_user.dex_liquidity_usd, 0) >= 50 THEN
    v_lp_mult := 1.10;
  END IF;

  -- 6. Enforce Faucet Cooldown (24h standard, 21.6h VIP)
  IF v_user.last_faucet_claim IS NOT NULL AND v_now < (v_user.last_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Faucet on cooldown',
      'next_claim', v_user.last_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')
    );
  END IF;

  -- 7. Daily streak calculation (within 48h preserves/increments streak)
  IF v_user.last_faucet_claim IS NOT NULL AND v_now < (v_user.last_faucet_claim + INTERVAL '48 hours') THEN
    v_streak := LEAST(COALESCE(v_user.faucet_streak, 0) + 1, 7);
  ELSE
    v_streak := 1;
  END IF;
  v_streak_boost := LEAST(v_streak * 2.0, 10.0); -- +2% per day, max +10%

  -- 8. Server-authoritative Referral Boost (+1% per L1 ref up to 20%, 30% if >= 100)
  -- Sourced dynamically from actual verified downline accounts in users
  SELECT COUNT(*) INTO v_ref_count
  FROM public.users
  WHERE (LOWER(referred_by_l1) = LOWER(v_pid) 
     OR (v_user.linked_wallet_address IS NOT NULL AND v_user.linked_wallet_address <> '' AND LOWER(referred_by_l1) = LOWER(v_user.linked_wallet_address)));
  IF v_ref_count >= 100 THEN
    v_ref_boost := 30.0;
  ELSE
    v_ref_boost := LEAST(v_ref_count * 1.0, 20.0);
  END IF;

  -- 9. Server-authoritative NFT Boost (Copper Core +10%, Silver Charger +25%, Gold Turbine/Quantum Core +50%)
  -- Sourced strictly from users.owned_nfts and users.crate_nfts
  v_all_nfts := COALESCE(v_user.owned_nfts, '[]'::jsonb) || COALESCE(v_user.crate_nfts, '[]'::jsonb);
  v_nft_boost := 0.0;
  IF v_all_nfts ? 'nft_gold_turbine' OR v_all_nfts ? 'nft_quantum_core' THEN
    v_nft_boost := v_nft_boost + 50.0;
  END IF;
  IF v_all_nfts ? 'nft_silver_charger' THEN
    v_nft_boost := v_nft_boost + 25.0;
  END IF;
  IF v_all_nfts ? 'nft_common_boost' THEN
    v_nft_boost := v_nft_boost + 10.0;
  END IF;

  -- 10. Calculate combined additive boost percent (NFT + Streak + Referral, clamped to max 125%)
  v_total_boost_percent := LEAST(v_nft_boost + v_streak_boost + v_ref_boost, 125.0);
  v_final_payout := v_base_payout * (1.0 + (v_total_boost_percent / 100.0));

  -- 11. Staked PGT Whale (+25%) - Calculated authoritatively from public.user_stakes
  SELECT COALESCE(SUM(amount), 0) INTO v_staked_pgt_total
  FROM public.user_stakes
  WHERE (LOWER(wallet_address) = LOWER(v_user.player_id) 
         OR (v_user.linked_wallet_address IS NOT NULL AND LOWER(wallet_address) = LOWER(v_user.linked_wallet_address)))
    AND active = true
    AND pool = 'pgt';

  IF v_staked_pgt_total >= 1000000 THEN 
    v_final_payout := v_final_payout * 1.25; 
  END IF;

  -- 12. PGT Balance / Whale Multiplier (+10%) - Authoritative from DB balance or admin
  IF (LOWER(COALESCE(v_user.linked_wallet_address, '')) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
      OR (COALESCE(v_user.balance_pgt, 0) + v_staked_pgt_total) >= 1000000) THEN 
    v_final_payout := v_final_payout * 1.10; 
  END IF;

  -- 13. Apply Multiplicative Multipliers: Relics (1.5x), VIP (2.0x), Ambassador (2.0x), DEX LP (1.1x–1.3x)
  v_final_payout := v_final_payout * v_relic_mult * v_vip_mult * v_amb_mult * v_lp_mult;
  
  -- Anti-Cheat Circuit Breaker: Absolute maximum ceiling sanity check (1,500 PGT)
  v_final_payout := ROUND(LEAST(v_final_payout, 1500.00), 2);

  v_new_weekly_faucets := COALESCE(v_user.weekly_faucet_claims, 0) + 1;
  v_current_weekly_games := COALESCE(v_user.weekly_games_played, 0);
  v_new_weekly_tier := compute_weekly_active_tier(v_new_weekly_faucets, v_current_weekly_games);

  -- 14. Update users record. Note: dex_liquidity_usd is NEVER updated from client parameter!
  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_payout,
      last_faucet_claim = v_now,
      faucet_streak = v_streak,
      weekly_faucet_claims = v_new_weekly_faucets,
      weekly_active_tier = v_new_weekly_tier,
      updated_at = v_now
  WHERE LOWER(player_id) = LOWER(v_pid)
  RETURNING balance_pgt INTO v_new_balance;

  PERFORM process_referral_commissions(v_pid, v_final_payout, 'Faucet Claim');

  RETURN jsonb_build_object(
    'success', true,
    'payout_pgt', v_final_payout,
    'payout', v_final_payout,
    'multiplier', ROUND((v_final_payout / v_base_payout), 2),
    'streak', v_streak,
    'new_balance', v_new_balance,
    'weekly_faucet_claims', v_new_weekly_faucets,
    'weekly_active_tier', v_new_weekly_tier,
    'claimed_at', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM anon;
-- ------------------------------------------------------------------------------
-- RPC 2: claim_vip_faucet (Server-Validated VIP POL Faucet)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.claim_vip_faucet(
  p_player_id TEXT DEFAULT NULL,
  p_nft_boost_percent NUMERIC DEFAULT 0.0,
  p_1flr_balance NUMERIC DEFAULT 0.0,
  p_staked_pgt NUMERIC DEFAULT 0.0,
  p_onchain_pgt NUMERIC DEFAULT 0.0,
  p_lp_pgt NUMERIC DEFAULT 0.0,
  p_lp_usd NUMERIC DEFAULT 0.0,
  p_wallet TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_guard RECORD;
  v_raw_id TEXT := COALESCE(NULLIF(TRIM(p_player_id), ''), NULLIF(TRIM(p_wallet), ''));
  v_pid TEXT;
  v_user RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_cooldown_hours NUMERIC := 21.6; -- 24h * 0.90 (VIP 10% faster cooldown)
  v_vip_mult NUMERIC := 2.0;
  v_amb_mult NUMERIC := 1.0;
  v_relic_mult NUMERIC := 1.0;
  v_lp_mult NUMERIC := 1.0;
  v_streak INTEGER := 0;
  v_streak_boost NUMERIC := 0.0;
  v_ref_count INTEGER := 0;
  v_ref_boost NUMERIC := 0.0;
  v_all_nfts JSONB;
  v_nft_boost NUMERIC := 0.0;
  v_total_boost_percent NUMERIC := 0.0;
  v_staked_pgt_total NUMERIC := 0.0;
  v_base_payout NUMERIC := 0.005;
  v_final_payout NUMERIC := 0.005;
  v_new_unclaimed NUMERIC := 0.0;
  v_new_total NUMERIC := 0.0;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(v_raw_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT * INTO v_user FROM public.users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- 1. Must be an active VIP
  IF v_user.vip_until IS NULL OR v_user.vip_until <= v_now THEN
    RETURN jsonb_build_object('success', false, 'error', 'VIP Membership required');
  END IF;

  -- 2. Fetch base payout (0.005 POL)
  BEGIN
    SELECT COALESCE(vip_faucet_base_pol, 0.005) INTO v_base_payout 
    FROM public.global_settings 
    WHERE id = 1 
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_base_payout := 0.005;
  END;

  IF v_base_payout IS NULL OR v_base_payout <= 0 THEN
    v_base_payout := 0.005;
  END IF;

  -- 3. Ambassador Status Check
  IF v_user.is_ambassador = true THEN
    v_amb_mult := 2.0;
  END IF;

  -- 4. Check Serie 1 Apex Relics Multiplier (1.5x)
  IF is_season1_apex_unlocked(v_user.relics) THEN
    v_relic_mult := 1.5;
  END IF;

  -- 5. Tiered DEX Liquidity Provider Multiplier
  IF COALESCE(v_user.dex_liquidity_usd, 0) >= 150 THEN
    v_lp_mult := 1.30;
  ELSIF COALESCE(v_user.dex_liquidity_usd, 0) >= 100 THEN
    v_lp_mult := 1.20;
  ELSIF COALESCE(v_user.dex_liquidity_usd, 0) >= 50 THEN
    v_lp_mult := 1.10;
  END IF;

  -- 6. Enforce Cooldown (21.6 hours for VIP)
  IF v_user.last_vip_faucet_claim IS NOT NULL AND v_now < (v_user.last_vip_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'VIP Faucet on cooldown',
      'next_claim', v_user.last_vip_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')
    );
  END IF;

  -- 7. Daily streak (shared consecutive platform streak between PGT and VIP faucets)
  IF (v_user.last_vip_faucet_claim IS NOT NULL AND v_now < (v_user.last_vip_faucet_claim + INTERVAL '48 hours'))
     OR (v_user.last_faucet_claim IS NOT NULL AND v_now < (v_user.last_faucet_claim + INTERVAL '48 hours')) THEN
    v_streak := LEAST(GREATEST(COALESCE(v_user.vip_faucet_streak, 0) + 1, COALESCE(v_user.claim_streak, 1)), 7);
  ELSE
    v_streak := 1;
  END IF;
  v_streak_boost := LEAST(v_streak * 2.0, 10.0);

  -- 8. Referral Boost
  -- Sourced dynamically from actual verified downline accounts in users
  SELECT COUNT(*) INTO v_ref_count
  FROM public.users
  WHERE (LOWER(referred_by_l1) = LOWER(v_pid) 
     OR (v_user.linked_wallet_address IS NOT NULL AND v_user.linked_wallet_address <> '' AND LOWER(referred_by_l1) = LOWER(v_user.linked_wallet_address)));
  IF v_ref_count >= 100 THEN
    v_ref_boost := 30.0;
  ELSE
    v_ref_boost := LEAST(v_ref_count * 1.0, 20.0);
  END IF;

  -- 9. Server-authoritative NFT Boost (Copper Core +10%, Silver Charger +25%, Gold Turbine/Quantum Core +50%)
  -- Supports active catalog IDs (nft_gold_turbine, nft_silver_charger, nft_common_boost) and legacy aliases
  v_all_nfts := COALESCE(v_user.owned_nfts, '[]'::jsonb) || COALESCE(v_user.crate_nfts, '[]'::jsonb);
  v_nft_boost := 0.0;
  IF (v_all_nfts ? 'nft_gold_turbine') OR (v_all_nfts ? 'nft_quantum_core') OR (v_all_nfts ? 'nft_gold_faucet')
     OR (v_all_nfts @> '[{"id":"nft_gold_turbine"}]'::jsonb)
     OR (v_all_nfts @> '[{"id":"nft_quantum_core"}]'::jsonb)
     OR (v_all_nfts @> '[{"id":"nft_gold_faucet"}]'::jsonb) THEN
    v_nft_boost := v_nft_boost + 50.0;
  END IF;
  IF (v_all_nfts ? 'nft_silver_charger') OR (v_all_nfts ? 'nft_silver_faucet')
     OR (v_all_nfts @> '[{"id":"nft_silver_charger"}]'::jsonb)
     OR (v_all_nfts @> '[{"id":"nft_silver_faucet"}]'::jsonb) THEN
    v_nft_boost := v_nft_boost + 25.0;
  END IF;
  IF (v_all_nfts ? 'nft_common_boost') OR (v_all_nfts ? 'nft_copper_faucet')
     OR (v_all_nfts @> '[{"id":"nft_common_boost"}]'::jsonb)
     OR (v_all_nfts @> '[{"id":"nft_copper_faucet"}]'::jsonb) THEN
    v_nft_boost := v_nft_boost + 10.0;
  END IF;

  -- 10. Combined additive boost (NFT + Streak + Referral, clamped to max 125%)
  v_total_boost_percent := LEAST(v_nft_boost + v_streak_boost + v_ref_boost, 125.0);
  v_final_payout := v_base_payout * (1.0 + (v_total_boost_percent / 100.0));

  -- 11. Staked PGT Whale (+25%) - Calculated authoritatively from public.user_stakes
  -- Queries user_stakes using player_id and linked_wallet_address (users table has no wallet_address field)
  SELECT COALESCE(SUM(amount), 0) INTO v_staked_pgt_total
  FROM public.user_stakes
  WHERE (LOWER(wallet_address) = LOWER(v_user.player_id) 
         OR (v_user.linked_wallet_address IS NOT NULL AND LOWER(wallet_address) = LOWER(v_user.linked_wallet_address)))
    AND active = true
    AND pool = 'pgt';

  IF v_staked_pgt_total >= 1000000 THEN 
    v_final_payout := v_final_payout * 1.25; 
  END IF;
  
  -- 12. PGT Balance / Whale Multiplier (+10%) - Authoritative from DB balance or admin
  IF (LOWER(COALESCE(v_user.linked_wallet_address, '')) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
      OR LOWER(COALESCE(v_user.player_id, '')) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
      OR (COALESCE(v_user.balance_pgt, 0) + v_staked_pgt_total) >= 1000000) THEN 
    v_final_payout := v_final_payout * 1.10; 
  END IF;

  -- 13. Multipliers: Relics (1.5x), VIP (2.0x), Ambassador (2.0x), Liquidity Provider (1.10x, 1.20x, or 1.30x)
  v_final_payout := v_final_payout * v_relic_mult * v_vip_mult * v_amb_mult * v_lp_mult;
  
  -- Sanity clamp: Maximum 0.250000 POL per VIP claim
  v_final_payout := ROUND(LEAST(v_final_payout, 0.250000), 6);

  v_new_unclaimed := COALESCE(v_user.unclaimed_vip_faucet_pol, 0.0) + v_final_payout;
  v_new_total := COALESCE(v_user.total_vip_faucet_pol, 0.0) + v_final_payout;

  -- 14. Update users record without touching dex_liquidity_usd
  UPDATE public.users
  SET
    unclaimed_vip_faucet_pol = v_new_unclaimed,
    total_vip_faucet_pol = v_new_total,
    last_vip_faucet_claim = v_now,
    vip_faucet_streak = v_streak,
    updated_at = v_now
  WHERE LOWER(player_id) = LOWER(v_pid);

  RETURN jsonb_build_object(
    'success', true,
    'payout_pol', v_final_payout,
    'payout', v_final_payout,
    'multiplier', ROUND((v_final_payout / v_base_payout), 2),
    'streak', v_streak,
    'unclaimed_vip_pol', v_new_unclaimed,
    'unclaimed_vip_faucet_pol', v_new_unclaimed,
    'total_vip_pol', v_new_total,
    'total_vip_faucet_pol', v_new_total,
    'last_vip_faucet_claim', v_now,
    'claimed_at', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC 3: sync_user_dex_liquidity (USD Value Hard-Clamped)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sync_user_dex_liquidity(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS public.sync_user_dex_liquidity(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS sync_user_dex_liquidity(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS sync_user_dex_liquidity(TEXT, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.sync_user_dex_liquidity(
  p_player_id TEXT,
  p_lp_usd NUMERIC,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_guard RECORD;
  v_canonical_id TEXT;
  v_clean_usd NUMERIC;
  v_is_admin BOOLEAN := false;
BEGIN
  -- Admin passkey allows manual adjustment from admin panel
  IF p_admin_passkey IS NOT NULL THEN
    v_is_admin := public.verify_admin_passkey(p_admin_passkey);
  END IF;

  IF NOT v_is_admin THEN
    v_guard := public.assert_caller_player_id(p_player_id);
    IF v_guard.p_status <> 'OK' THEN
      RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
    END IF;
    v_canonical_id := v_guard.p_player_id;
  ELSE
    v_canonical_id := public.resolve_player_id(p_player_id);
  END IF;

  IF v_canonical_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- If not admin, clamp to realistic single-player LP cap ($250.00 max without admin verification)
  IF v_is_admin THEN
    v_clean_usd := ROUND(LEAST(GREATEST(COALESCE(p_lp_usd, 0.0), 0.0), 10000.0), 2);
  ELSE
    v_clean_usd := ROUND(LEAST(GREATEST(COALESCE(p_lp_usd, 0.0), 0.0), 250.0), 2);
  END IF;

  UPDATE public.users
  SET 
    dex_liquidity_usd = v_clean_usd,
    updated_at = NOW()
  WHERE player_id = v_canonical_id;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_canonical_id,
    'dex_liquidity_usd', v_clean_usd,
    'is_admin_override', v_is_admin
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_user_dex_liquidity(TEXT, NUMERIC, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.sync_user_dex_liquidity(TEXT, NUMERIC, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: request_vip_faucet_pol_payout
-- Source: add_vip_pol_faucet.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.request_vip_faucet_pol_payout(TEXT);
DROP FUNCTION IF EXISTS public.request_vip_faucet_pol_payout(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS request_vip_faucet_pol_payout(TEXT);
DROP FUNCTION IF EXISTS request_vip_faucet_pol_payout(TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.request_vip_faucet_pol_payout(
  p_player_id TEXT,
  p_amount NUMERIC DEFAULT 5.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_user RECORD;
  v_min_payout NUMERIC := 5.0;
  v_payout_wallet TEXT;
  v_request_id UUID;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT * INTO v_user FROM public.users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Determine minimum payout threshold
  BEGIN
    SELECT COALESCE(vip_faucet_min_payout_pol, 5.0) INTO v_min_payout
    FROM public.global_settings
    WHERE id = 1
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_min_payout := 5.0;
  END;

  IF p_amount < v_min_payout THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum payout request is ' || v_min_payout || ' POL');
  END IF;

  IF COALESCE(v_user.unclaimed_vip_faucet_pol, 0.0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient accumulated VIP POL balance (Has ' || COALESCE(v_user.unclaimed_vip_faucet_pol, 0.0) || ' POL)');
  END IF;

  -- Resolve destination EVM wallet
  v_payout_wallet := LOWER(COALESCE(v_user.linked_wallet_address, ''));
  IF v_payout_wallet IS NULL OR v_payout_wallet = '' OR v_payout_wallet LIKE '0xpgt%' OR v_payout_wallet LIKE '0xg%' OR LENGTH(v_payout_wallet) < 42 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No linked Web3 EVM wallet found on your profile! Please link a Web3 wallet to receive payouts.');
  END IF;

  -- Deduct on-site balance
  UPDATE public.users
  SET 
    unclaimed_vip_faucet_pol = GREATEST(0.0, unclaimed_vip_faucet_pol - p_amount),
    updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid);

  -- Insert pending payout request for Master Admin
  INSERT INTO public.pol_payout_requests (wallet_address, username, amount_pol, status, source)
  VALUES (v_payout_wallet, COALESCE(v_user.username, ''), p_amount, 'pending', 'vip_faucet')
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'amount_pol', p_amount,
    'payout_wallet', v_payout_wallet,
    'new_unclaimed_balance', GREATEST(0.0, COALESCE(v_user.unclaimed_vip_faucet_pol, 0.0) - p_amount)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_vip_faucet_pol_payout(TEXT, NUMERIC) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.request_vip_faucet_pol_payout(TEXT, NUMERIC) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC 1: credit_nft_referral_commission (Server-Authoritative Catalog & Inventory)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.credit_nft_referral_commission(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.credit_nft_referral_commission(TEXT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.credit_nft_referral_commission(TEXT, NUMERIC, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS credit_nft_referral_commission(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS credit_nft_referral_commission(TEXT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS credit_nft_referral_commission(TEXT, NUMERIC, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.credit_nft_referral_commission(
  buyer_wallet TEXT,
  pol_price NUMERIC,
  item_name TEXT DEFAULT 'NFT Purchase',
  p_tx_hash TEXT DEFAULT NULL,
  p_item_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_buyer RECORD;
  v_parent RECORD;
  v_buyer_id TEXT;
  v_parent_id TEXT;
  v_resolved_item_id TEXT;
  v_catalog_price NUMERIC;
  v_commission NUMERIC;
  v_buyer_name TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_time_str TEXT := TO_CHAR(NOW(), 'HH12:MI:SS AM');
  v_action_str TEXT;
  v_new_entry JSONB;
  v_clean_hash TEXT := LOWER(TRIM(COALESCE(p_tx_hash, '')));
  v_buyer_nfts JSONB;
  v_guard RECORD;
BEGIN
  -- 1. Anti-Cheat: Require valid EVM transaction hash format (66-char hex)
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

  -- 3. Authoritative Catalog Item & Price Resolution (Ignore untrusted client pol_price)
  IF p_item_id IS NOT NULL AND TRIM(p_item_id) <> '' THEN
    v_resolved_item_id := LOWER(TRIM(p_item_id));
  ELSE
    -- Fallback mapping from item_name if p_item_id is not directly passed
    IF LOWER(item_name) LIKE '%copper core%' THEN v_resolved_item_id := 'nft_common_boost';
    ELSIF LOWER(item_name) LIKE '%silver charger%' THEN v_resolved_item_id := 'nft_silver_charger';
    ELSIF LOWER(item_name) LIKE '%gold turbine%' THEN v_resolved_item_id := 'nft_gold_turbine';
    ELSIF LOWER(item_name) LIKE '%viper shield%' THEN v_resolved_item_id := 'nft_rare_shield';
    ELSIF LOWER(item_name) LIKE '%pulse blaster%' THEN v_resolved_item_id := 'nft_pulse_blaster';
    ELSIF LOWER(item_name) LIKE '%apex matrix%' THEN v_resolved_item_id := 'nft_epic_yield';
    ELSIF LOWER(item_name) LIKE '%referral beacon%' THEN v_resolved_item_id := 'nft_referral_beacon';
    ELSIF LOWER(item_name) LIKE '%affiliate guild%' THEN v_resolved_item_id := 'nft_affiliate_guild';
    ELSIF LOWER(item_name) LIKE '%omni lord%' THEN v_resolved_item_id := 'nft_legendary_king';
    ELSIF LOWER(item_name) LIKE '%rare yield vault%' THEN v_resolved_item_id := 'nft_yield_vault_rare';
    ELSIF LOWER(item_name) LIKE '%epic yield vault%' THEN v_resolved_item_id := 'nft_yield_vault_epic';
    ELSIF LOWER(item_name) LIKE '%yield vault%' THEN v_resolved_item_id := 'nft_yield_vault';
    ELSIF LOWER(item_name) LIKE '%yearly%' OR LOWER(item_name) LIKE '%365%' THEN v_resolved_item_id := 'nft_vip_pass_yearly';
    ELSIF LOWER(item_name) LIKE '%vip%' THEN v_resolved_item_id := 'nft_vip_pass';
    ELSE v_resolved_item_id := NULL;
    END IF;
  END IF;

  CASE v_resolved_item_id
    WHEN 'nft_common_boost' THEN v_catalog_price := 5.0;
    WHEN 'nft_silver_charger' THEN v_catalog_price := 15.0;
    WHEN 'nft_gold_turbine' THEN v_catalog_price := 40.0;
    WHEN 'nft_rare_shield' THEN v_catalog_price := 15.0;
    WHEN 'nft_pulse_blaster' THEN v_catalog_price := 40.0;
    WHEN 'nft_epic_yield' THEN v_catalog_price := 60.0;
    WHEN 'nft_referral_beacon' THEN v_catalog_price := 10.0;
    WHEN 'nft_affiliate_guild' THEN v_catalog_price := 100.0;
    WHEN 'nft_legendary_king' THEN v_catalog_price := 300.0;
    WHEN 'nft_yield_vault' THEN v_catalog_price := 50.0;
    WHEN 'nft_yield_vault_rare' THEN v_catalog_price := 150.0;
    WHEN 'nft_yield_vault_epic' THEN v_catalog_price := 300.0;
    WHEN 'nft_vip_pass' THEN v_catalog_price := 100.0;
    WHEN 'nft_vip_pass_yearly' THEN v_catalog_price := 900.0;
    ELSE v_catalog_price := NULL;
  END CASE;

  IF v_catalog_price IS NULL OR v_resolved_item_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Unrecognized or non-commissionable NFT catalog item');
  END IF;

  v_commission := ROUND(v_catalog_price * 0.10, 4);

  -- 4. Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(buyer_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'reason', v_guard.p_error_msg);
  END IF;
  v_buyer_id := v_guard.p_player_id;

  -- 5. Fetch buyer record
  SELECT player_id, linked_wallet_address, username, referred_by_l1, owned_nfts, crate_nfts
  INTO v_buyer
  FROM public.users
  WHERE player_id = v_buyer_id
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(TRIM(buyer_wallet))
     OR LOWER(player_id) = LOWER(TRIM(buyer_wallet))
  LIMIT 1;

  IF v_buyer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Buyer not found');
  END IF;

  -- 6. Authoritatively Record NFT in Buyer Inventory (Atomic Server Grant)
  -- Since credit_nft_referral_commission is SECURITY DEFINER (executes as postgres),
  -- it safely grants the purchased NFT to the buyer, bypassing the prevent_direct_balance_mutation
  -- trigger that blocks client-side saveToDB modifications.
  v_buyer_nfts := COALESCE(v_buyer.owned_nfts, '[]'::jsonb);
  IF NOT (v_buyer_nfts ? v_resolved_item_id) THEN
    IF v_resolved_item_id LIKE 'nft_vip_pass%' THEN
      UPDATE public.users
      SET crate_nfts = COALESCE(crate_nfts, '[]'::jsonb) || jsonb_build_array(v_resolved_item_id),
          updated_at = v_now
      WHERE player_id = v_buyer.player_id;
    ELSE
      UPDATE public.users
      SET owned_nfts = v_buyer_nfts || jsonb_build_array(v_resolved_item_id),
          updated_at = v_now
      WHERE player_id = v_buyer.player_id;
    END IF;
  END IF;

  -- 7. Check for Level 1 referrer
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

  -- 8. Lock and fetch parent referrer record
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

  -- 9. Format display name & action string
  IF v_buyer.username IS NOT NULL AND TRIM(v_buyer.username) <> '' AND UPPER(TRIM(v_buyer.username)) <> 'EMPTY' THEN
    v_buyer_name := TRIM(v_buyer.username);
  ELSE
    v_buyer_name := 'Player_' || SUBSTRING(v_buyer.player_id FROM 1 FOR 8);
  END IF;

  v_action_str := COALESCE(NULLIF(TRIM(item_name), ''), v_resolved_item_id);

  -- 10. Construct referral activity entry
  v_new_entry := jsonb_build_object(
    'name', v_buyer_name,
    'player', v_buyer_name,
    'player_id', v_buyer.player_id,
    'level', 1,
    'action', v_action_str,
    'item_id', v_resolved_item_id,
    'amount', v_catalog_price,
    'commission', v_commission,
    'currency', 'POL',
    'tx_hash', v_clean_hash,
    'time', v_time_str,
    'created_at', v_now
  );

  -- 11. Record into pol_referral_commissions to permanently prevent replay
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
    v_catalog_price,
    v_commission,
    v_action_str,
    v_now
  );

  -- 12. Credit 10% POL to parent referrer and prepend to rolling 50-item ledger
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
    'catalog_price', v_catalog_price,
    'item_id', v_resolved_item_id,
    'buyer', v_buyer_name,
    'action', v_action_str,
    'tx_hash', v_clean_hash
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_nft_referral_commission(TEXT, NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.credit_nft_referral_commission(TEXT, NUMERIC, TEXT, TEXT, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: request_pol_referral_payout
-- Source: fix_nft_pol_referral_commissions.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.request_pol_referral_payout(TEXT);
DROP FUNCTION IF EXISTS public.request_pol_referral_payout(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS request_pol_referral_payout(TEXT);
DROP FUNCTION IF EXISTS request_pol_referral_payout(TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.request_pol_referral_payout(
  p_user_wallet TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_username TEXT;
  v_unclaimed NUMERIC;
  v_payout_wallet TEXT;
  v_request_id UUID;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_user_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'reason', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  p_user_wallet := LOWER(TRIM(p_user_wallet));

  IF p_amount <= 0.001 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Minimum payout request is 0.001 POL');
  END IF;

  -- Lock user record
  SELECT 
    username, 
    COALESCE(unclaimed_referral_pol, 0),
    COALESCE(linked_wallet_address, p_user_wallet)
  INTO 
    v_username, 
    v_unclaimed,
    v_payout_wallet
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = p_user_wallet
     OR LOWER(player_id) = p_user_wallet
  FOR UPDATE;

  IF v_unclaimed IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'User profile not found');
  END IF;

  IF v_unclaimed < p_amount THEN
    RETURN jsonb_build_object('success', false, 'reason', 'Insufficient unclaimed POL referral balance');
  END IF;

  -- Deduct from user's unclaimed POL pool
  UPDATE public.users
  SET unclaimed_referral_pol = GREATEST(0, unclaimed_referral_pol - p_amount),
      updated_at = NOW()
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = p_user_wallet
     OR LOWER(player_id) = p_user_wallet;

  -- Create pending payout request for Master Admin approval
  INSERT INTO public.pol_payout_requests (wallet_address, username, amount_pol, status)
  VALUES (v_payout_wallet, COALESCE(v_username, ''), p_amount, 'pending')
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'amount_pol', p_amount,
    'payout_wallet', v_payout_wallet
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_pol_referral_payout(TEXT, NUMERIC) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.request_pol_referral_payout(TEXT, NUMERIC) FROM anon;


-- ==============================================================================
