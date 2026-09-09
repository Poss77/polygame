-- ==============================================================================
-- POLYGAME MASTER SECURITY & STATE RESTORATION SCRIPT
-- 1. Restore Poss Account (0xpgt8312e02d37185b5983e6922d1dae1cce) Quantum Relics:
--    - 110 On-Site (Unminted) Relics across ALL 17 Serie 1 Types
--    - 5 On-Chain Minted Relics verified on Polygon (Tokens #2, #37, #38, #40, #41)
--    - Total Relics: 115 (Unlocks 1.5x Apex Multiplier)
-- 2. Deploy Atomic On-Chain Relic Sync Procedure: sync_onchain_relics()
-- 3. Upgrade Anti-Cheat Trigger: prevent_direct_balance_mutation() to Shield Relics
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- STEP 1: RESTORE POSS QUANTUM RELICS (110 ON-SITE + 5 ON-CHAIN = 115 TOTAL)
-- ==============================================================================
UPDATE public.users
SET relics = '{
  "relic_astrododge_prism": {
    "total": 7,
    "unminted": 7,
    "onchain": 0,
    "token_ids": []
  },
  "relic_astrododge_deflector": {
    "total": 7,
    "unminted": 6,
    "onchain": 1,
    "token_ids": [38]
  },
  "relic_astrododge_compass": {
    "total": 7,
    "unminted": 6,
    "onchain": 1,
    "token_ids": [2]
  },
  "relic_invaders_core": {
    "total": 15,
    "unminted": 14,
    "onchain": 1,
    "token_ids": [37]
  },
  "relic_invaders_dynamo": {
    "total": 10,
    "unminted": 10,
    "onchain": 0,
    "token_ids": []
  },
  "relic_invaders_transmitter": {
    "total": 6,
    "unminted": 5,
    "onchain": 1,
    "token_ids": [40]
  },
  "relic_drift_chronometer": {
    "total": 12,
    "unminted": 12,
    "onchain": 0,
    "token_ids": []
  },
  "relic_drift_capacitor": {
    "total": 10,
    "unminted": 10,
    "onchain": 0,
    "token_ids": []
  },
  "relic_drift_overdrive": {
    "total": 6,
    "unminted": 6,
    "onchain": 0,
    "token_ids": []
  },
  "relic_stacker_foundation": {
    "total": 8,
    "unminted": 8,
    "onchain": 0,
    "token_ids": []
  },
  "relic_stacker_keystone": {
    "total": 6,
    "unminted": 6,
    "onchain": 0,
    "token_ids": []
  },
  "relic_stacker_monolith": {
    "total": 4,
    "unminted": 4,
    "onchain": 0,
    "token_ids": []
  },
  "relic_space_darkmatter": {
    "total": 4,
    "unminted": 4,
    "onchain": 0,
    "token_ids": []
  },
  "relic_space_warpcoil": {
    "total": 4,
    "unminted": 4,
    "onchain": 0,
    "token_ids": []
  },
  "relic_space_plasma": {
    "total": 3,
    "unminted": 3,
    "onchain": 0,
    "token_ids": []
  },
  "relic_apex_singularity": {
    "total": 3,
    "unminted": 3,
    "onchain": 0,
    "token_ids": []
  },
  "relic_apex_genesis": {
    "total": 3,
    "unminted": 2,
    "onchain": 1,
    "token_ids": [41]
  }
}'::jsonb,
    updated_at = NOW()
WHERE player_id = '0xpgt8312e02d37185b5983e6922d1dae1cce'
   OR LOWER(linked_wallet_address) = '0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5';

-- ==============================================================================
-- STEP 2: CREATE ATOMIC ON-CHAIN RELIC SYNC PROCEDURE (sync_onchain_relics)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.sync_onchain_relics(
    p_player_id TEXT,
    p_chain_relics JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actual_player_id TEXT := resolve_player_id(p_player_id);
    v_current_relics JSONB;
    v_updated_relics JSONB := '{}'::jsonb;
    v_key TEXT;
    v_item JSONB;
    v_unminted INT;
    v_onchain INT;
    v_token_ids JSONB;
    v_total INT;
BEGIN
    IF v_actual_player_id IS NULL OR v_actual_player_id = '' THEN
        v_actual_player_id := LOWER(TRIM(COALESCE(p_player_id, '')));
    END IF;

    SELECT COALESCE(relics, '{}'::jsonb) INTO v_current_relics
    FROM public.users
    WHERE player_id = v_actual_player_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player not found');
    END IF;

    -- 1. Initialize result with all existing relics from DB, strictly preserving unminted counts
    FOR v_key IN SELECT jsonb_object_keys(v_current_relics) LOOP
        v_item := v_current_relics->v_key;
        v_unminted := COALESCE((v_item->>'unminted')::int, 0);
        v_updated_relics := jsonb_set(
            v_updated_relics,
            ARRAY[v_key],
            jsonb_build_object(
                'unminted', v_unminted,
                'onchain', 0,
                'total', v_unminted,
                'token_ids', '[]'::jsonb
            ),
            true
        );
    END LOOP;

    -- 2. Overlay verified on-chain counts & token IDs from p_chain_relics
    IF p_chain_relics IS NOT NULL AND jsonb_typeof(p_chain_relics) = 'object' THEN
        FOR v_key IN SELECT jsonb_object_keys(p_chain_relics) LOOP
            v_onchain := COALESCE((p_chain_relics->v_key->>'onchain')::int, 0);
            v_token_ids := COALESCE(p_chain_relics->v_key->'token_ids', '[]'::jsonb);
            
            IF v_updated_relics ? v_key THEN
                v_unminted := COALESCE((v_updated_relics->v_key->>'unminted')::int, 0);
            ELSE
                v_unminted := 0;
            END IF;

            v_total := v_unminted + v_onchain;

            v_updated_relics := jsonb_set(
                v_updated_relics,
                ARRAY[v_key],
                jsonb_build_object(
                    'unminted', v_unminted,
                    'onchain', v_onchain,
                    'total', v_total,
                    'token_ids', v_token_ids
                ),
                true
            );
        END LOOP;
    END IF;

    UPDATE public.users
    SET relics = v_updated_relics,
        updated_at = NOW()
    WHERE player_id = v_actual_player_id;

    RETURN v_updated_relics;
END;
$$;
GRANT EXECUTE ON FUNCTION public.sync_onchain_relics(TEXT, JSONB) TO anon, authenticated, service_role;

-- ==============================================================================
-- STEP 3: UPGRADE ANTI-CHEAT TRIGGER TO PREVENT RELIC WIPING
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  IF CURRENT_USER IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      -- Strict initial account state for public registrations
      NEW.balance_pgt := 0.0;
      NEW.created_at := NOW();
      NEW.is_admin := false;
      NEW.is_ambassador := false;
      NEW.is_banned := false;
      NEW.vip_until := NULL;
      NEW.last_faucet_claim := NULL;
      NEW.faucet_streak := 0;
      NEW.last_vip_faucet_claim := NULL;
      NEW.vip_faucet_streak := 0;
      NEW.weekly_faucet_claims := 0;
      NEW.weekly_games_played := 0;
      NEW.weekly_active_tier := 0;
      NEW.last_weekly_active_tier := 0;
      NEW.total_earned := 0.0;
      NEW.unclaimed_referral_pgt := 0.0;
      NEW.unclaimed_referral_pol := 0.0;
      NEW.total_referral_commission := 0.0;
      NEW.total_referral_pol := 0.0;
      NEW.unclaimed_vip_faucet_pol := 0.0;
      NEW.total_vip_faucet_pol := 0.0;

    ELSIF TG_OP = 'UPDATE' THEN
      -- 1. Immutable registration timestamp
      IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        NEW.created_at := OLD.created_at;
      END IF;

      -- 2. Immutable balances (PGT balance mutations MUST go through SECURITY DEFINER RPCs)
      IF NEW.balance_pgt IS DISTINCT FROM OLD.balance_pgt THEN
        NEW.balance_pgt := OLD.balance_pgt;
      END IF;

      -- 3. Immutable roles and VIP / ban status
      IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
        NEW.is_admin := OLD.is_admin;
      END IF;
      IF NEW.is_ambassador IS DISTINCT FROM OLD.is_ambassador THEN
        NEW.is_ambassador := OLD.is_ambassador;
      END IF;
      IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
        NEW.is_banned := OLD.is_banned;
      END IF;
      IF NEW.vip_until IS DISTINCT FROM OLD.vip_until THEN
        NEW.vip_until := OLD.vip_until;
      END IF;

      -- 4. Immutable faucet timestamps and streaks
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

      -- 5. Immutable weekly activity counters
      IF NEW.weekly_faucet_claims IS DISTINCT FROM OLD.weekly_faucet_claims THEN
        NEW.weekly_faucet_claims := OLD.weekly_faucet_claims;
      END IF;
      IF NEW.weekly_games_played IS DISTINCT FROM OLD.weekly_games_played THEN
        NEW.weekly_games_played := OLD.weekly_games_played;
      END IF;
      IF NEW.weekly_active_tier IS DISTINCT FROM OLD.weekly_active_tier THEN
        NEW.weekly_active_tier := OLD.weekly_active_tier;
      END IF;
      IF NEW.last_weekly_active_tier IS DISTINCT FROM OLD.last_weekly_active_tier THEN
        NEW.last_weekly_active_tier := OLD.last_weekly_active_tier;
      END IF;

      -- 6. Immutable career earnings & referral balances
      IF NEW.total_earned IS DISTINCT FROM OLD.total_earned THEN
        NEW.total_earned := OLD.total_earned;
      END IF;
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

      -- 7. Immutable weekly tournament scores
      IF NEW.game_highscore IS DISTINCT FROM OLD.game_highscore THEN
        NEW.game_highscore := OLD.game_highscore;
      END IF;
      IF NEW.invaders_highscore IS DISTINCT FROM OLD.invaders_highscore THEN
        NEW.invaders_highscore := OLD.invaders_highscore;
      END IF;
      IF NEW.drift_highscore IS DISTINCT FROM OLD.drift_highscore THEN
        NEW.drift_highscore := OLD.drift_highscore;
      END IF;
      IF NEW.stacker_highscore IS DISTINCT FROM OLD.stacker_highscore THEN
        NEW.stacker_highscore := OLD.stacker_highscore;
      END IF;
      IF NEW.skeet_highscore IS DISTINCT FROM OLD.skeet_highscore THEN
        NEW.skeet_highscore := OLD.skeet_highscore;
      END IF;
      IF NEW.defense_highscore IS DISTINCT FROM OLD.defense_highscore THEN
        NEW.defense_highscore := OLD.defense_highscore;
      END IF;

      -- 8. Immutable boss metrics
      IF NEW.boss_weekly_damage IS DISTINCT FROM OLD.boss_weekly_damage THEN
        NEW.boss_weekly_damage := OLD.boss_weekly_damage;
      END IF;
      IF NEW.alltime_boss_damage IS DISTINCT FROM OLD.alltime_boss_damage THEN
        NEW.alltime_boss_damage := OLD.alltime_boss_damage;
      END IF;
      IF NEW.boss_attacks_count IS DISTINCT FROM OLD.boss_attacks_count THEN
        NEW.boss_attacks_count := OLD.boss_attacks_count;
      END IF;

      -- 9. RELICS PRESERVATION: Never allow direct client updates to wipe or decrease unminted relics
      IF OLD.relics IS NOT NULL AND OLD.relics <> '{}'::jsonb THEN
        IF NEW.relics IS NULL OR NEW.relics = '{}'::jsonb THEN
          NEW.relics := OLD.relics;
        ELSE
          DECLARE
            v_r_key TEXT;
            v_old_unm INT;
            v_new_unm INT;
            v_merged_r JSONB;
          BEGIN
            FOR v_r_key IN SELECT jsonb_object_keys(OLD.relics) LOOP
              v_old_unm := COALESCE((OLD.relics->v_r_key->>'unminted')::int, 0);
              IF v_old_unm > 0 THEN
                IF NOT (NEW.relics ? v_r_key) THEN
                  -- Restore dropped relic from OLD
                  NEW.relics := jsonb_set(NEW.relics, ARRAY[v_r_key], OLD.relics->v_r_key, true);
                ELSE
                  v_new_unm := COALESCE((NEW.relics->v_r_key->>'unminted')::int, 0);
                  IF v_new_unm < v_old_unm THEN
                    -- Prevent decreasing unminted relics from direct client updates
                    v_merged_r := NEW.relics->v_r_key;
                    v_merged_r := jsonb_set(v_merged_r, '{unminted}', to_jsonb(v_old_unm));
                    v_merged_r := jsonb_set(v_merged_r, '{total}', to_jsonb(v_old_unm + COALESCE((v_merged_r->>'onchain')::int, 0)));
                    NEW.relics := jsonb_set(NEW.relics, ARRAY[v_r_key], v_merged_r);
                  END IF;
                END IF;
              END IF;
            END LOOP;
          END;
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

COMMIT;
