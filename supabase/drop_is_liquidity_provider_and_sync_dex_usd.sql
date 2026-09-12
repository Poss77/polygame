-- ============================================================================
-- POLYGON GAMING: DROP is_liquidity_provider & REAL-TIME DEX LIQUIDITY SYNC
-- Version: v1.5.356
--
-- Description:
-- 1. Updates prevent_direct_balance_mutation trigger function to safely remove
--    all references to NEW.is_liquidity_provider (MUST be done before dropping column).
-- 2. Drops the retired is_liquidity_provider column from public.users.
-- 3. Seeds authentic live on-chain DEX LP dollar valuations for Admin ($159.11) and Poss ($39.53).
-- 4. Creates sync_user_dex_liquidity RPC so player wallet connections and Admin
--    re-syncs immediately persist live LP balances to Supabase without waiting 24h.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: UPDATE ANTI-CHEAT TRIGGER TO REMOVE is_liquidity_provider
-- CRITICAL: MUST REMAIN SECURITY INVOKER (NO SECURITY DEFINER)
-- ----------------------------------------------------------------------------
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
      NEW.dex_liquidity_usd := 0.0;
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
      IF NEW.dex_liquidity_usd IS DISTINCT FROM OLD.dex_liquidity_usd THEN
        NEW.dex_liquidity_usd := OLD.dex_liquidity_usd;
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

-- ----------------------------------------------------------------------------
-- STEP 2: DROP RETIRED COLUMN is_liquidity_provider
-- ----------------------------------------------------------------------------
ALTER TABLE public.users
DROP COLUMN IF EXISTS is_liquidity_provider;

-- ----------------------------------------------------------------------------
-- STEP 3: SEED AUTHENTIC LIVE ON-CHAIN LIQUIDITY VALUES
-- ----------------------------------------------------------------------------
-- Master Admin (Origin): $159.11 USD (Position #194434 on QuickSwap V3, ~8.09e22 liq = 80.1% of pool)
UPDATE public.users
SET dex_liquidity_usd = 159.11
WHERE linked_wallet_address ILIKE '%10B9993990c9EF8a212c9557cB02aD94da9a654d%'
   OR player_id ILIKE '%0xpgt85c8416473bd6a8c45ada81ac85aeabb%';

-- Poss: $39.53 USD (Position #195662 on QuickSwap V3, ~2.01e22 liq = 19.9% of pool)
UPDATE public.users
SET dex_liquidity_usd = 39.53
WHERE linked_wallet_address ILIKE '%92206284cAe2b1Be18c8bCC9042EE5cd3cFcD7A5%'
   OR player_id ILIKE '%0xpgt8312e02d37185b5983e6922d1dae1cce%';

-- ----------------------------------------------------------------------------
-- STEP 4: RPC PROCEDURE TO PERSIST LIVE SCANNED DEX LIQUIDITY IN REAL TIME
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_dex_liquidity(
  p_player_id TEXT,
  p_lp_usd NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_canonical_id TEXT;
  v_clean_usd NUMERIC;
BEGIN
  v_canonical_id := public.resolve_player_id(p_player_id);
  IF v_canonical_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  v_clean_usd := ROUND(GREATEST(COALESCE(p_lp_usd, 0.0), 0.0), 2);

  UPDATE public.users
  SET 
    dex_liquidity_usd = v_clean_usd,
    updated_at = NOW()
  WHERE player_id = v_canonical_id;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_canonical_id,
    'dex_liquidity_usd', v_clean_usd
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_user_dex_liquidity(TEXT, NUMERIC) TO anon, authenticated, service_role;
