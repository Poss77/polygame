-- ==============================================================================
-- POLYGAME: TIERED DEX LIQUIDITY PROVIDER FAUCET MULTIPLIER ($50=1.1x, $100=1.2x, $150=1.3x) & 1FLR RETIREMENT
-- ==============================================================================
-- Version: v1.5.351
-- Purpose:
-- 1. Adds is_liquidity_provider column to public.users to flag verified LP whales.
-- 2. Retires the legacy 5M 1FLR Holder (+15%) bonus in exchange for the native
--    USD-based Tiered DEX Liquidity Provider bonus:
--    - $50 USD LP  -> 1.1x (+10%)
--    - $100 USD LP -> 1.2x (+20%)
--    - $150 USD LP -> 1.3x (+30%)
-- 3. Drops legacy overloaded signatures of claim_faucet and claim_vip_faucet to
--    prevent PostgREST PGRST203 candidate function collisions.
-- 4. Replaces claim_faucet and claim_vip_faucet with 7-parameter canonical definitions:
--    Accepts p_lp_usd NUMERIC DEFAULT 0.0 and p_lp_pgt NUMERIC DEFAULT 0.0.
-- 5. Updates prevent_direct_balance_mutation anti-cheat trigger (NO SECURITY DEFINER)
--    to prevent anon/authenticated client tampering with is_liquidity_provider.
-- 6. Activates is_liquidity_provider for Master Admin and Poss on deployment.
-- ==============================================================================

-- 1. ADD COLUMN TO USERS
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_liquidity_provider BOOLEAN DEFAULT false;

-- Activate Master Admin and Poss accounts immediately
UPDATE public.users
SET is_liquidity_provider = true
WHERE LOWER(player_id) IN (
  '0xpgt85c8416473bd6a8c45ada81ac85aeabb', -- Master Admin synthetic player_id
  '0xpgt8312e02d37185b5983e6922d1dae1cce'  -- Poss synthetic player_id
)
OR LOWER(linked_wallet_address) IN (
  '0x10b9993990c9ef8a212c9557cb02ad94da9a654d', -- Master Admin EVM
  '0xa4be6e6a13db3838dc2c525f1b5bc75c8fd66b8c'  -- Poss EVM
);

-- ==============================================================================
-- 2. ANTI-CHEAT TRIGGER: PREVENT DIRECT TAMPERING OF is_liquidity_provider
-- ==============================================================================
-- CRITICAL MASTER RULE: Must NOT have SECURITY DEFINER so CURRENT_USER reflects caller!
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_r_key TEXT;
  v_old_unm INT;
  v_new_unm INT;
  v_merged_r JSONB;
BEGIN
  -- Restrict direct PostgREST client queries (anon & authenticated roles)
  -- Legitimate SECURITY DEFINER procedures run as 'postgres' and bypass this check.
  IF LOWER(CURRENT_USER) IN ('anon', 'authenticated') THEN

    IF TG_OP = 'INSERT' THEN
      -- Sanitize newly inserted accounts against elevated balances & privileges
      NEW.balance_pgt := 0.0;
      NEW.created_at := NOW();
      NEW.is_admin := false;
      NEW.is_ambassador := false;
      NEW.is_liquidity_provider := false;
      NEW.is_banned := false;
      NEW.vip_until := NULL;
      NEW.total_earned := 0.0;
      NEW.total_arcade_plays := 0;
      NEW.game_highscore := 0;
      NEW.invaders_highscore := 0;
      NEW.drift_highscore := 0;
      NEW.stacker_highscore := 0;
      NEW.skeet_highscore := 0;
      NEW.defense_highscore := 0;
      NEW.boss_weekly_damage := 0;
      NEW.alltime_boss_damage := 0;
      NEW.boss_attacks_count := 0;
      NEW.weekly_faucet_claims := 0;
      NEW.weekly_games_played := 0;
      NEW.weekly_active_tier := 0;
      NEW.last_weekly_active_tier := 0;
      NEW.faucet_streak := 0;
      NEW.vip_faucet_streak := 0;
      NEW.unclaimed_referral_pgt := 0.0;
      NEW.unclaimed_referral_pol := 0.0;
      NEW.total_referral_commission := 0.0;
      NEW.total_referral_pol := 0.0;
      NEW.unclaimed_vip_faucet_pol := 0.0;
      NEW.total_vip_faucet_pol := 0.0;
      NEW.owned_nfts := '[]'::jsonb;
      NEW.crate_nfts := '[]'::jsonb;
      NEW.relics := '{}'::jsonb;

      -- Clamp starting minerals
      IF NEW.space_state IS NOT NULL THEN
        NEW.space_state := jsonb_set(NEW.space_state, '{warpLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{laserLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{cargoLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{shieldLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{turretLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{fleetPower}', '380'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{iron}', to_jsonb(LEAST(COALESCE((NEW.space_state->>'iron')::numeric, 50), 50)));
        NEW.space_state := jsonb_set(NEW.space_state, '{titanium}', to_jsonb(LEAST(COALESCE((NEW.space_state->>'titanium')::numeric, 10), 10)));
        NEW.space_state := jsonb_set(NEW.space_state, '{quantum}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{pgtOre}', '0'::jsonb);
      END IF;

    ELSIF TG_OP = 'UPDATE' THEN
      -- 1. Immutable registration timestamp
      IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        NEW.created_at := OLD.created_at;
      END IF;

      -- 2. Immutable balances (PGT mutations MUST go through SECURITY DEFINER RPCs)
      IF NEW.balance_pgt IS DISTINCT FROM OLD.balance_pgt THEN
        NEW.balance_pgt := OLD.balance_pgt;
      END IF;

      -- 3. Immutable roles, LP status, and VIP / ban status
      IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
        NEW.is_admin := OLD.is_admin;
      END IF;
      IF NEW.is_ambassador IS DISTINCT FROM OLD.is_ambassador THEN
        NEW.is_ambassador := OLD.is_ambassador;
      END IF;
      IF NEW.is_liquidity_provider IS DISTINCT FROM OLD.is_liquidity_provider THEN
        NEW.is_liquidity_provider := OLD.is_liquidity_provider;
      END IF;
      IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
        NEW.is_banned := OLD.is_banned;
      END IF;
      IF NEW.vip_until IS DISTINCT FROM OLD.vip_until THEN
        NEW.vip_until := OLD.vip_until;
      END IF;

      -- 4. Immutable career total_arcade_plays (server RPC controlled only)
      IF NEW.total_arcade_plays IS DISTINCT FROM OLD.total_arcade_plays THEN
        NEW.total_arcade_plays := OLD.total_arcade_plays;
      END IF;

      -- 5. Immutable faucet timestamps & streaks (seals cooldown-wiping exploit)
      IF NEW.last_faucet_claim IS DISTINCT FROM OLD.last_faucet_claim THEN
        NEW.last_faucet_claim := OLD.last_faucet_claim;
      END IF;
      IF NEW.faucet_streak IS DISTINCT FROM OLD.faucet_streak THEN
        NEW.faucet_streak := OLD.faucet_streak;
      END IF;
      IF NEW.last_vip_faucet_claim IS DISTINCT FROM OLD.last_vip_faucet_claim THEN
        NEW.last_vip_faucet_claim := OLD.last_vip_faucet_claim;
      END IF;
      IF NEW.vip_faucet_streak IS DISTINCT FROM OLD.vip_faucet_streak THEN
        NEW.vip_faucet_streak := OLD.vip_faucet_streak;
      END IF;

      -- 6. Immutable weekly activity counters
      IF NEW.weekly_faucet_claims IS DISTINCT FROM OLD.weekly_faucet_claims THEN
        NEW.weekly_faucet_claims := OLD.weekly_faucet_claims;
      END IF;
      IF NEW.weekly_games_played IS DISTINCT FROM OLD.weekly_games_played THEN
        NEW.weekly_games_played := OLD.weekly_games_played;
      END IF;
      IF NEW.weekly_active_tier IS DISTINCT FROM OLD.weekly_active_tier THEN
        NEW.weekly_active_tier := OLD.weekly_active_tier;
      END IF;

      -- 7. High score rollback & unearned inflation prevention
      IF NEW.game_highscore < OLD.game_highscore THEN
        NEW.game_highscore := OLD.game_highscore;
      END IF;
      IF NEW.invaders_highscore < OLD.invaders_highscore THEN
        NEW.invaders_highscore := OLD.invaders_highscore;
      END IF;
      IF NEW.drift_highscore < OLD.drift_highscore THEN
        NEW.drift_highscore := OLD.drift_highscore;
      END IF;
      IF NEW.stacker_highscore < OLD.stacker_highscore THEN
        NEW.stacker_highscore := OLD.stacker_highscore;
      END IF;
      IF NEW.skeet_highscore < OLD.skeet_highscore THEN
        NEW.skeet_highscore := OLD.skeet_highscore;
      END IF;
      IF NEW.defense_highscore < OLD.defense_highscore THEN
        NEW.defense_highscore := OLD.defense_highscore;
      END IF;

      -- 8. Immutable referral commissions & VIP POL yields
      IF NEW.unclaimed_referral_pgt IS DISTINCT FROM OLD.unclaimed_referral_pgt THEN
        NEW.unclaimed_referral_pgt := OLD.unclaimed_referral_pgt;
      END IF;
      IF NEW.unclaimed_referral_pol IS DISTINCT FROM OLD.unclaimed_referral_pol THEN
        NEW.unclaimed_referral_pol := OLD.unclaimed_referral_pol;
      END IF;
      IF NEW.total_referral_commission IS DISTINCT FROM OLD.total_referral_commission THEN
        NEW.total_referral_commission := OLD.total_referral_commission;
      END IF;
      IF NEW.total_referral_pol IS DISTINCT FROM OLD.total_referral_pol THEN
        NEW.total_referral_pol := OLD.total_referral_pol;
      END IF;
      IF NEW.unclaimed_vip_faucet_pol IS DISTINCT FROM OLD.unclaimed_vip_faucet_pol THEN
        NEW.unclaimed_vip_faucet_pol := OLD.unclaimed_vip_faucet_pol;
      END IF;
      IF NEW.total_vip_faucet_pol IS DISTINCT FROM OLD.total_vip_faucet_pol THEN
        NEW.total_vip_faucet_pol := OLD.total_vip_faucet_pol;
      END IF;

      -- 9. Immutable Inventory: owned_nfts & crate_nfts
      IF NEW.owned_nfts IS DISTINCT FROM OLD.owned_nfts THEN
        NEW.owned_nfts := OLD.owned_nfts;
      END IF;
      IF NEW.crate_nfts IS DISTINCT FROM OLD.crate_nfts THEN
        NEW.crate_nfts := OLD.crate_nfts;
      END IF;

      -- 10. Immutable Relics: unminted counts can NEVER be injected by client
      IF NEW.relics IS DISTINCT FROM OLD.relics THEN
        v_merged_r := COALESCE(OLD.relics, '{}'::jsonb);
        IF NEW.relics IS NOT NULL THEN
          FOR v_r_key IN SELECT jsonb_object_keys(NEW.relics) LOOP
            v_old_unm := COALESCE((v_merged_r->v_r_key->>'unminted')::int, 0);
            v_new_unm := COALESCE((NEW.relics->v_r_key->>'unminted')::int, 0);
            IF v_new_unm < v_old_unm THEN
              v_merged_r := jsonb_set(v_merged_r, ARRAY[v_r_key, 'unminted'], to_jsonb(v_new_unm));
            END IF;
          END LOOP;
        END IF;
        NEW.relics := v_merged_r;
      END IF;

      -- 11. PolySpace Mining Exploit Clamp
      IF NEW.space_state IS NOT NULL AND OLD.space_state IS NOT NULL THEN
        IF COALESCE((NEW.space_state->>'warpLevel')::numeric, 1) > COALESCE((OLD.space_state->>'warpLevel')::numeric, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{warpLevel}', OLD.space_state->'warpLevel');
        END IF;
        IF COALESCE((NEW.space_state->>'laserLevel')::numeric, 1) > COALESCE((OLD.space_state->>'laserLevel')::numeric, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{laserLevel}', OLD.space_state->'laserLevel');
        END IF;
        IF COALESCE((NEW.space_state->>'cargoLevel')::numeric, 1) > COALESCE((OLD.space_state->>'cargoLevel')::numeric, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{cargoLevel}', OLD.space_state->'cargoLevel');
        END IF;
        IF COALESCE((NEW.space_state->>'shieldLevel')::numeric, 1) > COALESCE((OLD.space_state->>'shieldLevel')::numeric, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{shieldLevel}', OLD.space_state->'shieldLevel');
        END IF;
        IF COALESCE((NEW.space_state->>'turretLevel')::numeric, 1) > COALESCE((OLD.space_state->>'turretLevel')::numeric, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{turretLevel}', OLD.space_state->'turretLevel');
        END IF;
        IF COALESCE((NEW.space_state->>'fleetPower')::numeric, 380) > COALESCE((OLD.space_state->>'fleetPower')::numeric, 380) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{fleetPower}', OLD.space_state->'fleetPower');
        END IF;
        IF COALESCE((NEW.space_state->>'pgtOre')::numeric, 0) > COALESCE((OLD.space_state->>'pgtOre')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{pgtOre}', OLD.space_state->'pgtOre');
        END IF;
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_balance_mutation ON public.users;
CREATE TRIGGER trg_prevent_direct_balance_mutation
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_balance_mutation();


-- ==============================================================================
-- 3. DROP LEGACY OVERLOADED FAUCET PROCEDURES
-- ==============================================================================
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_faucet(TEXT) CASCADE;

DROP FUNCTION IF EXISTS public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_vip_faucet(TEXT, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.claim_vip_faucet(TEXT) CASCADE;


-- ==============================================================================
-- 4. CANONICAL claim_faucet (7 PARAMETERS WITH TIERED USD LP BONUS & RETIRED 1FLR)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.claim_faucet(
  p_player_id TEXT,
  p_nft_boost_percent NUMERIC DEFAULT 0.0,
  p_1flr_balance NUMERIC DEFAULT 0.0,
  p_staked_pgt NUMERIC DEFAULT 0.0,
  p_onchain_pgt NUMERIC DEFAULT 0.0,
  p_lp_pgt NUMERIC DEFAULT 0.0,
  p_lp_usd NUMERIC DEFAULT 0.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_user RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_cooldown_hours NUMERIC := 24.0;
  v_is_vip BOOLEAN := false;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_relic_mult NUMERIC := 1.0;
  v_lp_mult NUMERIC := 1.0;
  v_streak INTEGER := 0;
  v_base_payout NUMERIC := 50.0;
  v_final_payout NUMERIC := 50.0;
  v_new_balance NUMERIC := 0;
  v_new_weekly_faucets INTEGER := 0;
  v_current_weekly_games INTEGER := 0;
  v_new_weekly_tier INTEGER := 0;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_player_id));
  END IF;

  SELECT * INTO v_user FROM public.users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Fetch dynamic base payout from global_settings (defaults to 50.0 if not configured)
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

  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_is_vip := true;
    v_vip_mult := 2.0;
    v_cooldown_hours := 21.6; -- 10% faster cooldown
  END IF;

  IF v_user.is_ambassador = true THEN
    v_amb_mult := 2.0;
  END IF;

  -- Check Serie 1 Apex Relics Multiplier (1.5x) from DB relics
  IF is_season1_apex_unlocked(v_user.relics) THEN
    v_relic_mult := 1.5;
  END IF;

  -- Check Tiered DEX Liquidity Provider Multiplier ($50 = 1.1x, $100 = 1.2x, $150 = 1.3x)
  IF COALESCE(p_lp_usd, 0) >= 150 OR COALESCE(p_lp_pgt, 0) >= 500000 OR v_user.is_liquidity_provider IS TRUE THEN
    v_lp_mult := 1.30;
  ELSIF COALESCE(p_lp_usd, 0) >= 100 THEN
    v_lp_mult := 1.20;
  ELSIF COALESCE(p_lp_usd, 0) >= 50 THEN
    v_lp_mult := 1.10;
  END IF;

  IF v_user.last_faucet_claim IS NOT NULL AND v_now < (v_user.last_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Faucet on cooldown',
      'next_claim', v_user.last_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')
    );
  END IF;

  -- Daily streak calculation (within 48h preserves streak)
  IF v_user.last_faucet_claim IS NOT NULL AND v_now < (v_user.last_faucet_claim + INTERVAL '48 hours') THEN
    v_streak := LEAST(COALESCE(v_user.faucet_streak, 0) + 1, 7);
  ELSE
    v_streak := 1;
  END IF;

  -- Calculate payout with combined boosts (NFT + streak)
  v_final_payout := v_base_payout * (1.0 + (GREATEST(0.0, LEAST(COALESCE(p_nft_boost_percent, 0.0), 300.0)) / 100.0));
  
  -- 1M Staked PGT Whale (+25%)
  IF COALESCE(p_staked_pgt, 0) >= 1000000 THEN 
    v_final_payout := v_final_payout * 1.25; 
  END IF;
  
  -- 1M Onchain PGT Whale (+10%)
  IF COALESCE(p_onchain_pgt, 0) >= 1000000 THEN 
    v_final_payout := v_final_payout * 1.10; 
  END IF;

  -- Multipliers: Relics (1.5x), VIP (2.0x), Ambassador (2.0x), Liquidity Provider (1.10x, 1.20x, or 1.30x)
  -- Note: 1FLR bonus is retired.
  v_final_payout := v_final_payout * v_relic_mult * v_vip_mult * v_amb_mult * v_lp_mult;
  v_final_payout := ROUND(v_final_payout, 2);

  v_new_weekly_faucets := COALESCE(v_user.weekly_faucet_claims, 0) + 1;
  v_current_weekly_games := COALESCE(v_user.weekly_games_played, 0);
  v_new_weekly_tier := compute_weekly_active_tier(v_new_weekly_faucets, v_current_weekly_games);

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
    'multiplier', (v_final_payout / v_base_payout),
    'streak', v_streak,
    'new_balance', v_new_balance,
    'weekly_faucet_claims', v_new_weekly_faucets,
    'weekly_active_tier', v_new_weekly_tier,
    'claimed_at', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO anon, authenticated, service_role;


-- ==============================================================================
-- 5. CANONICAL claim_vip_faucet (7 PARAMETERS WITH TIERED USD LP BONUS & RETIRED 1FLR)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.claim_vip_faucet(
  p_player_id TEXT,
  p_nft_boost_percent NUMERIC DEFAULT 0.0,
  p_1flr_balance NUMERIC DEFAULT 0.0,
  p_staked_pgt NUMERIC DEFAULT 0.0,
  p_onchain_pgt NUMERIC DEFAULT 0.0,
  p_lp_pgt NUMERIC DEFAULT 0.0,
  p_lp_usd NUMERIC DEFAULT 0.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_user RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_cooldown_hours NUMERIC := 21.6; -- 24h * 0.90 (VIP 10% faster cooldown)
  v_vip_mult NUMERIC := 2.0;
  v_amb_mult NUMERIC := 1.0;
  v_relic_mult NUMERIC := 1.0;
  v_lp_mult NUMERIC := 1.0;
  v_streak INTEGER := 0;
  v_base_payout NUMERIC := 0.005;
  v_final_payout NUMERIC := 0.005;
  v_new_unclaimed NUMERIC := 0.0;
  v_new_total NUMERIC := 0.0;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_player_id));
  END IF;

  SELECT * INTO v_user FROM public.users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Verify active VIP status
  IF v_user.vip_until IS NULL OR v_user.vip_until <= v_now THEN
    RETURN jsonb_build_object('success', false, 'error', 'VIP membership required to claim this faucet');
  END IF;

  -- Fetch dynamic base POL payout from global_settings
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

  -- Check cooldown (21.6 hours)
  IF v_user.last_vip_faucet_claim IS NOT NULL AND v_now < (v_user.last_vip_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'VIP Faucet on cooldown',
      'next_claim', v_user.last_vip_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')
    );
  END IF;

  -- Check Ambassador status
  IF v_user.is_ambassador = true THEN
    v_amb_mult := 2.0;
  END IF;

  -- Check Serie 1 Apex Relics Multiplier (1.5x)
  IF is_season1_apex_unlocked(v_user.relics) THEN
    v_relic_mult := 1.5;
  END IF;

  -- Check Tiered DEX Liquidity Provider Multiplier ($50 = 1.1x, $100 = 1.2x, $150 = 1.3x)
  IF COALESCE(p_lp_usd, 0) >= 150 OR COALESCE(p_lp_pgt, 0) >= 500000 OR v_user.is_liquidity_provider IS TRUE THEN
    v_lp_mult := 1.30;
  ELSIF COALESCE(p_lp_usd, 0) >= 100 THEN
    v_lp_mult := 1.20;
  ELSIF COALESCE(p_lp_usd, 0) >= 50 THEN
    v_lp_mult := 1.10;
  END IF;

  -- Shared consecutive day streak from PGT faucet
  v_streak := LEAST(GREATEST(COALESCE(v_user.faucet_streak, 1), 1), 7);

  -- Base with combined boosts (NFT + streak)
  v_final_payout := v_base_payout * (1.0 + (GREATEST(0.0, LEAST(COALESCE(p_nft_boost_percent, 0.0), 300.0)) / 100.0));

  -- 1M Staked PGT Whale (+25%)
  IF COALESCE(p_staked_pgt, 0) >= 1000000 THEN 
    v_final_payout := v_final_payout * 1.25; 
  END IF;
  
  -- 1M Onchain PGT Whale (+10%)
  IF COALESCE(p_onchain_pgt, 0) >= 1000000 THEN 
    v_final_payout := v_final_payout * 1.10; 
  END IF;

  -- Multipliers: Relics (1.5x), VIP (2.0x), Ambassador (2.0x), Liquidity Provider (1.10x, 1.20x, or 1.30x)
  -- Note: 1FLR bonus is retired.
  v_final_payout := v_final_payout * v_relic_mult * v_vip_mult * v_amb_mult * v_lp_mult;
  v_final_payout := ROUND(v_final_payout, 6);

  v_new_unclaimed := COALESCE(v_user.unclaimed_vip_faucet_pol, 0.0) + v_final_payout;
  v_new_total := COALESCE(v_user.total_vip_faucet_pol, 0.0) + v_final_payout;

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
    'unclaimed_vip_faucet_pol', v_new_unclaimed,
    'total_vip_faucet_pol', v_new_total,
    'last_vip_faucet_claim', v_now,
    'streak', v_streak,
    'cooldown_hours', v_cooldown_hours
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO anon, authenticated, service_role;
