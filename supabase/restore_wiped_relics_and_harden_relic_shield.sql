-- ==============================================================================
-- POLYGAME FORWARD-ONLY MIGRATION: RESTORE WIPED RELICS & HARDEN RELIC SHIELD
-- Version: v1.5.374
-- Description:
--   1. Restores the verified Quantum Relic inventories from the authoritative backup
--      (Sept 13, 2026) for players affected by the client unpack bug:
--      - Paul V (212 relics)
--      - Bass (84 relics)
--      - CRiMiNeL (49 relics)
--      - Cybermix (41 relics)
--      - Mavilyon (24 relics, cleaned of RPC status keys)
--   2. Hardens Section 10 of public.prevent_direct_balance_mutation() trigger
--      (STRICTLY SECURITY INVOKER) so direct client saves (anon/authenticated)
--      can NEVER delete, wipe, reduce, or tamper with users.relics. All relic mutations
--      must execute through authoritative SECURITY DEFINER RPCs.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. RESTORE AUTHORITATIVE QUANTUM RELICS FOR AFFECTED PLAYERS
-- ------------------------------------------------------------------------------

-- User: Paul V (0xpgt3a44cee7) - 17 unique types, 212 total relics
UPDATE public.users
SET relics = '{"relic_apex_genesis": {"total": 6, "unminted": 6, "onchain": 0, "token_ids": []}, "relic_apex_singularity": {"total": 7, "unminted": 7, "onchain": 0, "token_ids": []}, "relic_astrododge_compass": {"total": 4, "unminted": 4, "onchain": 0, "token_ids": []}, "relic_astrododge_deflector": {"total": 6, "unminted": 6, "onchain": 0, "token_ids": []}, "relic_astrododge_prism": {"total": 12, "unminted": 12, "onchain": 0, "token_ids": []}, "relic_drift_capacitor": {"total": 34, "unminted": 34, "onchain": 0, "token_ids": []}, "relic_drift_chronometer": {"total": 41, "unminted": 41, "onchain": 0, "token_ids": []}, "relic_drift_overdrive": {"total": 12, "unminted": 12, "onchain": 0, "token_ids": []}, "relic_invaders_core": {"total": 44, "unminted": 44, "onchain": 0, "token_ids": []}, "relic_invaders_dynamo": {"total": 26, "unminted": 26, "onchain": 0, "token_ids": []}, "relic_invaders_transmitter": {"total": 7, "unminted": 7, "onchain": 0, "token_ids": []}, "relic_space_darkmatter": {"total": 5, "unminted": 5, "onchain": 0, "token_ids": []}, "relic_space_plasma": {"total": 1, "unminted": 1, "onchain": 0, "token_ids": []}, "relic_space_warpcoil": {"total": 1, "unminted": 1, "onchain": 0, "token_ids": []}, "relic_stacker_foundation": {"total": 2, "unminted": 2, "onchain": 0, "token_ids": []}, "relic_stacker_keystone": {"total": 2, "unminted": 2, "onchain": 0, "token_ids": []}, "relic_stacker_monolith": {"total": 2, "unminted": 2, "onchain": 0, "token_ids": []}}'::jsonb,
    updated_at = NOW()
WHERE player_id = '0xpgt3a44cee7';

-- User: Bass (0xpgt08891829df91813056bbd8d6e838cdc4) - 15 unique types, 84 total relics
UPDATE public.users
SET relics = '{"relic_apex_singularity": {"total": 2, "unminted": 2, "onchain": 0, "token_ids": []}, "relic_astrododge_compass": {"total": 3, "unminted": 3, "onchain": 0, "token_ids": []}, "relic_astrododge_deflector": {"total": 6, "unminted": 6, "onchain": 0, "token_ids": []}, "relic_astrododge_prism": {"total": 13, "unminted": 13, "onchain": 0, "token_ids": []}, "relic_drift_capacitor": {"total": 4, "unminted": 4, "onchain": 0, "token_ids": []}, "relic_drift_chronometer": {"total": 5, "unminted": 5, "onchain": 0, "token_ids": []}, "relic_drift_overdrive": {"total": 4, "unminted": 4, "onchain": 0, "token_ids": []}, "relic_invaders_core": {"total": 12, "unminted": 12, "onchain": 0, "token_ids": []}, "relic_invaders_dynamo": {"total": 8, "unminted": 8, "onchain": 0, "token_ids": []}, "relic_invaders_transmitter": {"total": 5, "unminted": 5, "onchain": 0, "token_ids": []}, "relic_space_darkmatter": {"total": 3, "unminted": 3, "onchain": 0, "token_ids": []}, "relic_space_plasma": {"total": 1, "unminted": 1, "onchain": 0, "token_ids": []}, "relic_stacker_foundation": {"total": 10, "unminted": 10, "onchain": 0, "token_ids": []}, "relic_stacker_keystone": {"total": 5, "unminted": 5, "onchain": 0, "token_ids": []}, "relic_stacker_monolith": {"total": 3, "unminted": 3, "onchain": 0, "token_ids": []}}'::jsonb,
    updated_at = NOW()
WHERE player_id = '0xpgt08891829df91813056bbd8d6e838cdc4';

-- User: CRiMiNeL (0xpgt25c12fd2) - 15 unique types, 49 total relics
UPDATE public.users
SET relics = '{"relic_apex_genesis": {"total": 1, "unminted": 1, "onchain": 0, "token_ids": []}, "relic_apex_singularity": {"total": 1, "unminted": 1, "onchain": 0, "token_ids": []}, "relic_astrododge_deflector": {"total": 7, "unminted": 7, "onchain": 0, "token_ids": []}, "relic_astrododge_prism": {"total": 11, "unminted": 11, "onchain": 0, "token_ids": []}, "relic_drift_capacitor": {"total": 2, "unminted": 2, "onchain": 0, "token_ids": []}, "relic_drift_chronometer": {"total": 3, "unminted": 3, "onchain": 0, "token_ids": []}, "relic_drift_overdrive": {"total": 1, "unminted": 1, "onchain": 0, "token_ids": []}, "relic_invaders_core": {"total": 4, "unminted": 4, "onchain": 0, "token_ids": []}, "relic_invaders_dynamo": {"total": 4, "unminted": 4, "onchain": 0, "token_ids": []}, "relic_invaders_transmitter": {"total": 1, "unminted": 1, "onchain": 0, "token_ids": []}, "relic_space_darkmatter": {"total": 1, "unminted": 1, "onchain": 0, "token_ids": []}, "relic_space_warpcoil": {"total": 1, "unminted": 1, "onchain": 0, "token_ids": []}, "relic_stacker_foundation": {"total": 6, "unminted": 6, "onchain": 0, "token_ids": []}, "relic_stacker_keystone": {"total": 4, "unminted": 4, "onchain": 0, "token_ids": []}, "relic_stacker_monolith": {"total": 2, "unminted": 2, "onchain": 0, "token_ids": []}}'::jsonb,
    updated_at = NOW()
WHERE player_id = '0xpgt25c12fd2';

-- User: Cybermix (0xpgt58f5eb8c) - 10 unique types, 41 total relics
UPDATE public.users
SET relics = '{"relic_astrododge_compass": {"total": 1, "unminted": 1, "onchain": 0, "token_ids": []}, "relic_astrododge_deflector": {"total": 4, "unminted": 4, "onchain": 0, "token_ids": []}, "relic_astrododge_prism": {"total": 2, "unminted": 2, "onchain": 0, "token_ids": []}, "relic_drift_capacitor": {"total": 8, "unminted": 8, "onchain": 0, "token_ids": []}, "relic_drift_chronometer": {"total": 11, "unminted": 11, "onchain": 0, "token_ids": []}, "relic_drift_overdrive": {"total": 4, "unminted": 4, "onchain": 0, "token_ids": []}, "relic_invaders_core": {"total": 5, "unminted": 5, "onchain": 0, "token_ids": []}, "relic_invaders_dynamo": {"total": 4, "unminted": 4, "onchain": 0, "token_ids": []}, "relic_invaders_transmitter": {"total": 1, "unminted": 1, "onchain": 0, "token_ids": []}, "relic_space_darkmatter": {"total": 1, "unminted": 1, "onchain": 0, "token_ids": []}}'::jsonb,
    updated_at = NOW()
WHERE player_id = '0xpgt58f5eb8c';

-- User: Mavilyon (0xpgt3d8ee006) - 9 unique types, 24 total relics (purged of dummy RPC status keys)
UPDATE public.users
SET relics = '{"relic_astrododge_compass": {"total": 2, "unminted": 2, "onchain": 0, "token_ids": []}, "relic_astrododge_deflector": {"total": 1, "unminted": 1, "onchain": 0, "token_ids": []}, "relic_astrododge_prism": {"total": 3, "unminted": 3, "onchain": 0, "token_ids": []}, "relic_drift_capacitor": {"total": 3, "unminted": 3, "onchain": 0, "token_ids": []}, "relic_drift_chronometer": {"total": 1, "unminted": 1, "onchain": 0, "token_ids": []}, "relic_drift_overdrive": {"total": 1, "unminted": 1, "onchain": 0, "token_ids": []}, "relic_invaders_core": {"total": 6, "unminted": 6, "onchain": 0, "token_ids": []}, "relic_invaders_dynamo": {"total": 6, "unminted": 6, "onchain": 0, "token_ids": []}, "relic_space_darkmatter": {"total": 1, "unminted": 1, "onchain": 0, "token_ids": []}}'::jsonb,
    updated_at = NOW()
WHERE player_id = '0xpgt3d8ee006';


-- ------------------------------------------------------------------------------
-- 2. HARDEN PREVENT_DIRECT_BALANCE_MUTATION TRIGGER
-- STRICTLY SECURITY INVOKER (NEVER DECLARE WITH SECURITY DEFINER!)
-- ------------------------------------------------------------------------------

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
  -- Intercept direct client queries from PostgREST (anon / authenticated)
  IF LOWER(CURRENT_USER) IN ('anon', 'authenticated') THEN

    IF TG_OP = 'INSERT' THEN
      -- Sanitization for new rows
      NEW.balance_pgt := 0.0;
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
      IF NEW.bot_warning < OLD.bot_warning THEN
        NEW.bot_warning := OLD.bot_warning;
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

      -- 7. High score ceiling (max 500,000 pts) & rollback prevention
      IF NEW.game_highscore > 500000 THEN
        NEW.game_highscore := OLD.game_highscore;
      ELSIF NEW.game_highscore < OLD.game_highscore THEN
        NEW.game_highscore := OLD.game_highscore;
      END IF;

      IF NEW.invaders_highscore > 500000 THEN
        NEW.invaders_highscore := OLD.invaders_highscore;
      ELSIF NEW.invaders_highscore < OLD.invaders_highscore THEN
        NEW.invaders_highscore := OLD.invaders_highscore;
      END IF;

      IF NEW.drift_highscore > 500000 THEN
        NEW.drift_highscore := OLD.drift_highscore;
      ELSIF NEW.drift_highscore < OLD.drift_highscore THEN
        NEW.drift_highscore := OLD.drift_highscore;
      END IF;

      IF NEW.stacker_highscore > 500000 THEN
        NEW.stacker_highscore := OLD.stacker_highscore;
      ELSIF NEW.stacker_highscore < OLD.stacker_highscore THEN
        NEW.stacker_highscore := OLD.stacker_highscore;
      END IF;

      IF NEW.skeet_highscore > 500000 THEN
        NEW.skeet_highscore := OLD.skeet_highscore;
      ELSIF NEW.skeet_highscore < OLD.skeet_highscore THEN
        NEW.skeet_highscore := OLD.skeet_highscore;
      END IF;

      IF NEW.defense_highscore > 500000 THEN
        NEW.defense_highscore := OLD.defense_highscore;
      ELSIF NEW.defense_highscore < OLD.defense_highscore THEN
        NEW.defense_highscore := OLD.defense_highscore;
      END IF;

      -- Also clamp all-time score equivalents if client attempts direct update
      IF NEW.alltime_game_highscore > 500000 THEN NEW.alltime_game_highscore := OLD.alltime_game_highscore; END IF;
      IF NEW.alltime_invaders_highscore > 500000 THEN NEW.alltime_invaders_highscore := OLD.alltime_invaders_highscore; END IF;
      IF NEW.alltime_drift_highscore > 500000 THEN NEW.alltime_drift_highscore := OLD.alltime_drift_highscore; END IF;
      IF NEW.alltime_stacker_highscore > 500000 THEN NEW.alltime_stacker_highscore := OLD.alltime_stacker_highscore; END IF;
      IF NEW.alltime_skeet_highscore > 500000 THEN NEW.alltime_skeet_highscore := OLD.alltime_skeet_highscore; END IF;
      IF NEW.defense_alltime_best > 500000 THEN NEW.defense_alltime_best := OLD.defense_alltime_best; END IF;

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

      -- 10. Immutable Relics Inventory (Mutations MUST go through SECURITY DEFINER RPCs)
      -- Direct client saves (anon/authenticated) can NEVER delete, clobber, or alter existing relics
      IF NEW.relics IS DISTINCT FROM OLD.relics THEN
        NEW.relics := OLD.relics;
      END IF;

      -- 11. PolySpace Fleet Upgrades & Mineral Protections
      IF NEW.space_state IS NOT NULL AND OLD.space_state IS NOT NULL THEN
        IF COALESCE((NEW.space_state->>'warpLevel')::int, 1) < COALESCE((OLD.space_state->>'warpLevel')::int, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{warpLevel}', to_jsonb(COALESCE((OLD.space_state->>'warpLevel')::int, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'laserLevel')::int, 1) < COALESCE((OLD.space_state->>'laserLevel')::int, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{laserLevel}', to_jsonb(COALESCE((OLD.space_state->>'laserLevel')::int, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'cargoLevel')::int, 1) < COALESCE((OLD.space_state->>'cargoLevel')::int, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{cargoLevel}', to_jsonb(COALESCE((OLD.space_state->>'cargoLevel')::int, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'shieldLevel')::int, 1) < COALESCE((OLD.space_state->>'shieldLevel')::int, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{shieldLevel}', to_jsonb(COALESCE((OLD.space_state->>'shieldLevel')::int, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'turretLevel')::int, 1) < COALESCE((OLD.space_state->>'turretLevel')::int, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{turretLevel}', to_jsonb(COALESCE((OLD.space_state->>'turretLevel')::int, 1)));
        END IF;

        IF COALESCE((NEW.space_state->>'iron')::numeric, 0) > COALESCE((OLD.space_state->>'iron')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{iron}', to_jsonb(COALESCE((OLD.space_state->>'iron')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'titanium')::numeric, 0) > COALESCE((OLD.space_state->>'titanium')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{titanium}', to_jsonb(COALESCE((OLD.space_state->>'titanium')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'quantum')::numeric, 0) > COALESCE((OLD.space_state->>'quantum')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{quantum}', to_jsonb(COALESCE((OLD.space_state->>'quantum')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'pgtOre')::numeric, 0) > COALESCE((OLD.space_state->>'pgtOre')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{pgtOre}', to_jsonb(COALESCE((OLD.space_state->>'pgtOre')::numeric, 0)));
        END IF;
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;

-- Verification query
SELECT player_id, username, relics
FROM public.users
WHERE player_id IN (
  '0xpgt3a44cee7',
  '0xpgt08891829df91813056bbd8d6e838cdc4',
  '0xpgt25c12fd2',
  '0xpgt58f5eb8c',
  '0xpgt3d8ee006'
);
