-- ==============================================================================
-- POLYGON GAMING: FIX VIP FAUCET CLAIM RETURN KEYS
-- File: supabase/fix_vip_faucet_claim_return_fields.sql
-- 
-- Fixes key name discrepancy where claim_vip_faucet returned 'unclaimed_vip_pol'
-- and 'total_vip_pol' while frontend previously parsed 'unclaimed_vip_faucet_pol'.
-- Both naming conventions and timestamps are now returned for complete
-- backward and forward compatibility across all client versions.
-- ==============================================================================

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
AS 
DECLARE
  v_raw_id TEXT := COALESCE(NULLIF(TRIM(p_player_id), ''), NULLIF(TRIM(p_wallet), ''));
  v_pid TEXT := resolve_player_id(COALESCE(NULLIF(TRIM(p_player_id), ''), NULLIF(TRIM(p_wallet), '')));
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
  IF v_raw_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player identity missing');
  END IF;

  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(v_raw_id));
  END IF;

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

  -- 7. Daily streak
  IF v_user.last_vip_faucet_claim IS NOT NULL AND v_now < (v_user.last_vip_faucet_claim + INTERVAL '48 hours') THEN
    v_streak := LEAST(COALESCE(v_user.vip_faucet_streak, 0) + 1, 7);
  ELSE
    v_streak := 1;
  END IF;
  v_streak_boost := LEAST(v_streak * 2.0, 10.0);

  -- 8. Referral Boost
  v_ref_count := GREATEST(COALESCE(v_user.referrals_l1, v_user.referrals_count, 0), 0);
  IF v_ref_count >= 100 THEN
    v_ref_boost := 30.0;
  ELSE
    v_ref_boost := LEAST(v_ref_count * 1.0, 20.0);
  END IF;

  -- 9. Server-authoritative NFT Boost
  v_all_nfts := COALESCE(v_user.owned_nfts, '[]'::jsonb) || COALESCE(v_user.crate_nfts, '[]'::jsonb);
  IF (v_all_nfts @> '[{"id":"nft_quantum_core"}]'::jsonb) OR (v_all_nfts ? 'nft_quantum_core')
     OR (v_all_nfts @> '[{"id":"nft_gold_faucet"}]'::jsonb) OR (v_all_nfts ? 'nft_gold_faucet') THEN
    v_nft_boost := v_nft_boost + 50.0;
  END IF;
  IF (v_all_nfts @> '[{"id":"nft_silver_faucet"}]'::jsonb) OR (v_all_nfts ? 'nft_silver_faucet') THEN
    v_nft_boost := v_nft_boost + 25.0;
  END IF;
  IF (v_all_nfts @> '[{"id":"nft_copper_faucet"}]'::jsonb) OR (v_all_nfts ? 'nft_copper_faucet') THEN
    v_nft_boost := v_nft_boost + 10.0;
  END IF;
  IF v_all_nfts ? 'nft_common_boost' THEN
    v_nft_boost := v_nft_boost + 10.0;
  END IF;

  -- 10. Combined additive boost
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
;

GRANT EXECUTE ON FUNCTION public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO anon, authenticated, service_role;
