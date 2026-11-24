-- ==============================================================================
-- POLYGAME MIGRATION: Fix PolySpace Mineral & Mission Logs Rollback Guard
-- ==============================================================================
-- Prevents stale in-flight client PATCH /rest/v1/users or save_polyspace_state
-- calls from rolling back server-awarded PolySpace minerals (iron, titanium,
-- quantum, pgtOre), module levels, career totals, or missionLogs.
--
-- IMPORTANT SECURITY INVARIANT:
-- public.prevent_direct_balance_mutation() MUST REMAIN SECURITY INVOKER!
-- ==============================================================================

-- 1. Update prevent_direct_balance_mutation() (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_r_key TEXT;
  v_old_unm INT;
  v_new_unm INT;
  v_merged_r JSONB;
  v_today TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_fleet_warp INT;
  v_allowed_slots INT;
  v_exp_arr JSONB;
BEGIN
  -- Restrict direct PostgREST client queries (anon & authenticated roles)
  -- Legitimate SECURITY DEFINER procedures run as 'postgres' and bypass this check.
  IF LOWER(CURRENT_USER) IN ('anon', 'authenticated') THEN

    IF TG_OP = 'INSERT' THEN
      -- 1. Anti-Bot Registration Guard: Reject automated test fixtures
      IF NEW.auth_provider IS NOT NULL AND (NEW.auth_provider ILIKE '%fixture%' OR NEW.auth_provider ILIKE '%__test%') THEN
        RAISE EXCEPTION 'REGISTRATION_REJECTED: Test fixtures disallowed in production.';
      END IF;

      -- Player ID must start with 0x and be at least 5 characters (supports 0xpgt..., 0xg..., 0xguest..., and 42-char EVM addresses)
      IF NEW.player_id IS NULL 
         OR NEW.player_id ILIKE 'test_%'
         OR NEW.player_id NOT ILIKE '0x%'
         OR LENGTH(NEW.player_id) < 5 THEN
        RAISE EXCEPTION 'REGISTRATION_REJECTED: Invalid player ID format.';
      END IF;

      IF NEW.username IS NOT NULL AND NEW.username ILIKE '%__test__%' THEN
        RAISE EXCEPTION 'REGISTRATION_REJECTED: Test fixtures disallowed in production.';
      END IF;

      -- Username Hardening: Clamped to 30 chars, defanged, and reserved administrative handles blocked
      IF NEW.username IS NOT NULL AND TRIM(NEW.username) <> '' THEN
        NEW.username := TRIM(NEW.username);
        IF LENGTH(NEW.username) > 30 THEN
          NEW.username := SUBSTRING(NEW.username FROM 1 FOR 30);
        END IF;
        NEW.username := REGEXP_REPLACE(NEW.username, '[<>&"''\x00-\x1F\x7F]', '', 'g');
        IF COALESCE(NEW.is_admin, false) = false THEN
          IF LOWER(NEW.username) ~ '^(admin|administrator|polygame_admin|moderator|official|support|system)$' THEN
            NEW.username := 'Player_' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 6);
          END IF;
        END IF;
      END IF;

      IF NEW.linked_wallet_address IS NOT NULL AND NEW.linked_wallet_address <> '' THEN
        IF NEW.linked_wallet_address ~ '00000000000000000000' THEN
          RAISE EXCEPTION 'REGISTRATION_REJECTED: Dummy wallet address rejected.';
        END IF;
      END IF;

      -- 2. Sanitize newly inserted accounts against elevated balances & privileges
      NEW.balance_pgt := 0.0;
      NEW.created_at := NOW();
      NEW.last_active_at := NOW();
      NEW.is_admin := false;
      NEW.is_simulated := false;
      NEW.is_ambassador := false;
      NEW.dex_liquidity_usd := 0.0;
      NEW.is_banned := false;
      NEW.bot_warning := 0;
      NEW.vip_until := NULL;
      NEW.vip_level := 0;
      NEW.total_earned := 0.0;
      NEW.total_arcade_plays := 0;
      NEW.game_highscore := 0;
      NEW.invaders_highscore := 0;
      NEW.drift_highscore := 0;
      NEW.stacker_highscore := 0;
      NEW.skeet_highscore := 0;
      NEW.defense_highscore := 0;
      NEW.runner_highscore := 0;
      NEW.alltime_runner_highscore := 0;
      NEW.q2048_highscore := 0;
      NEW.alltime_q2048_highscore := 0;
      NEW.tetris_highscore := 0;
      NEW.alltime_tetris_highscore := 0;
      NEW.bubble_highscore := 0;
      NEW.alltime_bubble_highscore := 0;
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
      NEW.last_turnstile_at := NULL;
      NEW.last_faucet_turnstile_at := NULL;
      NEW.daily_quests := jsonb_build_object(
        'date', v_today,
        'games', 0, 'mining', 0, 'wins', 0,
        'games_claimed', false, 'mining_claimed', false, 'wins_claimed', false,
        'master_claimed', false, 'streak_days', 0, 'last_streak_date', ''
      );

      -- Prevent setting fake referrals on account creation
      NEW.referrals_count := 0;
      NEW.referrals_l1 := 0;
      NEW.referrals_l2 := 0;
      NEW.referrals_l3 := 0;
      NEW.referrals_l4 := 0;
      NEW.referrals_list := '[]'::jsonb;
      NEW.referred_by_l1 := NULL;
      NEW.referred_by_l2 := NULL;
      NEW.referred_by_l3 := NULL;
      NEW.referred_by_l4 := NULL;

      -- Prevent squatting on existing player IDs or wallet addresses with referral_code on account creation
      IF NEW.referral_code IS NOT NULL AND NEW.referral_code <> '' THEN
        IF EXISTS (
          SELECT 1 FROM public.users 
          WHERE LOWER(player_id) = LOWER(NEW.referral_code) 
             OR (linked_wallet_address IS NOT NULL AND LOWER(linked_wallet_address) = LOWER(NEW.referral_code))
        ) THEN
          NEW.referral_code := 'ref_' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 8);
        END IF;
      END IF;

      -- Clamp starting minerals & space statistics
      IF NEW.space_state IS NOT NULL THEN
        NEW.space_state := jsonb_set(NEW.space_state, '{warpLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{laserLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{cargoLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{shieldLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{turretLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{fleetPower}', '380'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{raidsWon}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{pgtMinedTotal}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{mineralsMinedTotal}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{iron}', to_jsonb(LEAST(COALESCE((NEW.space_state->>'iron')::numeric, 50), 50)));
        NEW.space_state := jsonb_set(NEW.space_state, '{titanium}', to_jsonb(LEAST(COALESCE((NEW.space_state->>'titanium')::numeric, 10), 10)));
        NEW.space_state := jsonb_set(NEW.space_state, '{quantum}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{pgtOre}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{expeditions}', '[]'::jsonb);
      END IF;

    ELSIF TG_OP = 'UPDATE' THEN
      -- Record real player client interaction
      NEW.last_active_at := NOW();

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
      IF NEW.is_simulated IS DISTINCT FROM OLD.is_simulated THEN
        NEW.is_simulated := OLD.is_simulated;
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
      IF NEW.vip_level IS DISTINCT FROM OLD.vip_level THEN
        NEW.vip_level := OLD.vip_level;
      END IF;

      -- 3b. Username Hardening on UPDATE: Clamped to 30 chars, defanged, administrative handles blocked
      IF NEW.username IS NOT NULL AND TRIM(NEW.username) <> '' THEN
        NEW.username := TRIM(NEW.username);
        IF LENGTH(NEW.username) > 30 THEN
          NEW.username := SUBSTRING(NEW.username FROM 1 FOR 30);
        END IF;
        NEW.username := REGEXP_REPLACE(NEW.username, '[<>&"''\x00-\x1F\x7F]', '', 'g');
        IF COALESCE(OLD.is_admin, false) = false THEN
          IF LOWER(NEW.username) ~ '^(admin|administrator|polygame_admin|moderator|official|support|system)$' THEN
            NEW.username := OLD.username;
          END IF;
        END IF;
      END IF;

      -- 4. Immutable career total_arcade_plays (server RPC controlled only)
      IF NEW.total_arcade_plays IS DISTINCT FROM OLD.total_arcade_plays THEN
        NEW.total_arcade_plays := OLD.total_arcade_plays;
      END IF;

      -- 4b. Immutable Turnstile verification timestamp & attempts (server RPC controlled only)
      IF NEW.last_turnstile_at IS DISTINCT FROM OLD.last_turnstile_at THEN
        NEW.last_turnstile_at := OLD.last_turnstile_at;
      END IF;
      IF NEW.last_faucet_turnstile_at IS DISTINCT FROM OLD.last_faucet_turnstile_at THEN
        NEW.last_faucet_turnstile_at := OLD.last_faucet_turnstile_at;
      END IF;
      IF NEW.turnstile_unverified_attempts IS DISTINCT FROM OLD.turnstile_unverified_attempts THEN
        NEW.turnstile_unverified_attempts := OLD.turnstile_unverified_attempts;
      END IF;
      IF NEW.turnstile_unverified_today IS DISTINCT FROM OLD.turnstile_unverified_today THEN
        NEW.turnstile_unverified_today := OLD.turnstile_unverified_today;
      END IF;
      IF NEW.turnstile_unverified_reset_at IS DISTINCT FROM OLD.turnstile_unverified_reset_at THEN
        NEW.turnstile_unverified_reset_at := OLD.turnstile_unverified_reset_at;
      END IF;
      IF NEW.last_unverified_attempt_at IS DISTINCT FROM OLD.last_unverified_attempt_at THEN
        NEW.last_unverified_attempt_at := OLD.last_unverified_attempt_at;
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

      IF NEW.runner_highscore > 500000 THEN
        NEW.runner_highscore := OLD.runner_highscore;
      ELSIF NEW.runner_highscore < OLD.runner_highscore THEN
        NEW.runner_highscore := OLD.runner_highscore;
      END IF;

      IF NEW.q2048_highscore > 500000 THEN
        NEW.q2048_highscore := OLD.q2048_highscore;
      ELSIF NEW.q2048_highscore < OLD.q2048_highscore THEN
        NEW.q2048_highscore := OLD.q2048_highscore;
      END IF;

      IF NEW.tetris_highscore > 500000 THEN
        NEW.tetris_highscore := OLD.tetris_highscore;
      ELSIF NEW.tetris_highscore < OLD.tetris_highscore THEN
        NEW.tetris_highscore := OLD.tetris_highscore;
      END IF;

      IF NEW.bubble_highscore > 500000 THEN
        NEW.bubble_highscore := OLD.bubble_highscore;
      ELSIF NEW.bubble_highscore < OLD.bubble_highscore THEN
        NEW.bubble_highscore := OLD.bubble_highscore;
      END IF;

      -- Also clamp all-time score equivalents if client attempts direct update
      IF NEW.alltime_game_highscore > 500000 THEN NEW.alltime_game_highscore := OLD.alltime_game_highscore; END IF;
      IF NEW.alltime_invaders_highscore > 500000 THEN NEW.alltime_invaders_highscore := OLD.alltime_invaders_highscore; END IF;
      IF NEW.alltime_drift_highscore > 500000 THEN NEW.alltime_drift_highscore := OLD.alltime_drift_highscore; END IF;
      IF NEW.alltime_stacker_highscore > 500000 THEN NEW.alltime_stacker_highscore := OLD.alltime_stacker_highscore; END IF;
      IF NEW.alltime_skeet_highscore > 500000 THEN NEW.alltime_skeet_highscore := OLD.alltime_skeet_highscore; END IF;
      IF NEW.defense_alltime_best > 500000 THEN NEW.defense_alltime_best := OLD.defense_alltime_best; END IF;
      IF NEW.alltime_runner_highscore > 500000 THEN NEW.alltime_runner_highscore := OLD.alltime_runner_highscore; END IF;
      IF NEW.alltime_q2048_highscore > 500000 THEN NEW.alltime_q2048_highscore := OLD.alltime_q2048_highscore; END IF;
      IF NEW.alltime_tetris_highscore > 500000 THEN NEW.alltime_tetris_highscore := OLD.alltime_tetris_highscore; END IF;
      IF NEW.alltime_bubble_highscore > 500000 THEN NEW.alltime_bubble_highscore := OLD.alltime_bubble_highscore; END IF;

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

      -- Immutable referral tree statistics, referral list & upline parent links on direct client UPDATE
      -- Once an upline is established, it can NEVER be stolen, overwritten, or modified by client queries.
      IF NEW.referred_by_l1 IS DISTINCT FROM OLD.referred_by_l1 THEN
        NEW.referred_by_l1 := OLD.referred_by_l1;
      END IF;
      IF NEW.referred_by_l2 IS DISTINCT FROM OLD.referred_by_l2 THEN
        NEW.referred_by_l2 := OLD.referred_by_l2;
      END IF;
      IF NEW.referred_by_l3 IS DISTINCT FROM OLD.referred_by_l3 THEN
        NEW.referred_by_l3 := OLD.referred_by_l3;
      END IF;
      IF NEW.referred_by_l4 IS DISTINCT FROM OLD.referred_by_l4 THEN
        NEW.referred_by_l4 := OLD.referred_by_l4;
      END IF;
      IF NEW.referrals_count IS DISTINCT FROM OLD.referrals_count THEN
        NEW.referrals_count := OLD.referrals_count;
      END IF;
      IF NEW.referrals_l1 IS DISTINCT FROM OLD.referrals_l1 THEN
        NEW.referrals_l1 := OLD.referrals_l1;
      END IF;
      IF NEW.referrals_l2 IS DISTINCT FROM OLD.referrals_l2 THEN
        NEW.referrals_l2 := OLD.referrals_l2;
      END IF;
      IF NEW.referrals_l3 IS DISTINCT FROM OLD.referrals_l3 THEN
        NEW.referrals_l3 := OLD.referrals_l3;
      END IF;
      IF NEW.referrals_l4 IS DISTINCT FROM OLD.referrals_l4 THEN
        NEW.referrals_l4 := OLD.referrals_l4;
      END IF;
      IF NEW.referrals_list IS DISTINCT FROM OLD.referrals_list THEN
        NEW.referrals_list := OLD.referrals_list;
      END IF;

      -- Immutable referral_code: Once assigned, a user can NEVER alter or hijack their referral code
      IF OLD.referral_code IS NOT NULL AND OLD.referral_code <> '' AND OLD.referral_code <> 'EMPTY' THEN
        IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
          NEW.referral_code := OLD.referral_code;
        END IF;
      END IF;

      -- On initial referral_code assignment, prevent squatting on existing player IDs or wallet addresses
      IF NEW.referral_code IS NOT NULL AND NEW.referral_code <> '' THEN
        IF EXISTS (
          SELECT 1 FROM public.users 
          WHERE LOWER(player_id) = LOWER(NEW.referral_code) 
             OR (linked_wallet_address IS NOT NULL AND LOWER(linked_wallet_address) = LOWER(NEW.referral_code))
        ) THEN
          NEW.referral_code := OLD.referral_code;
        END IF;
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
      IF NEW.space_state IS NOT NULL THEN
        -- Preserve existing state fields so partial client updates cannot wipe fleet or minerals
        IF OLD.space_state IS NOT NULL AND jsonb_typeof(OLD.space_state) = 'object' THEN
          NEW.space_state := OLD.space_state || NEW.space_state;
        END IF;

        -- 11a. Module Levels (Module upgrades MUST go through upgrade_polyspace_module RPC)
        -- Direct PostgREST client updates cannot alter module levels (neither inflate nor roll back)!
        IF COALESCE((NEW.space_state->>'warpLevel')::integer, 1) IS DISTINCT FROM COALESCE((OLD.space_state->>'warpLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{warpLevel}', to_jsonb(COALESCE((OLD.space_state->>'warpLevel')::integer, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'laserLevel')::integer, 1) IS DISTINCT FROM COALESCE((OLD.space_state->>'laserLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{laserLevel}', to_jsonb(COALESCE((OLD.space_state->>'laserLevel')::integer, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'cargoLevel')::integer, 1) IS DISTINCT FROM COALESCE((OLD.space_state->>'cargoLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{cargoLevel}', to_jsonb(COALESCE((OLD.space_state->>'cargoLevel')::integer, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'shieldLevel')::integer, 1) IS DISTINCT FROM COALESCE((OLD.space_state->>'shieldLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{shieldLevel}', to_jsonb(COALESCE((OLD.space_state->>'shieldLevel')::integer, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'turretLevel')::integer, 1) IS DISTINCT FROM COALESCE((OLD.space_state->>'turretLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{turretLevel}', to_jsonb(COALESCE((OLD.space_state->>'turretLevel')::integer, 1)));
        END IF;

        -- 11b. Space Minerals (Strictly managed via SECURITY DEFINER RPCs: expeditions, upgrades, smelting, raids, anomalies, boss)
        -- Direct PostgREST client updates can NEVER inflate OR roll back mineral balances!
        IF COALESCE((NEW.space_state->>'iron')::numeric, 0) IS DISTINCT FROM COALESCE((OLD.space_state->>'iron')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{iron}', to_jsonb(COALESCE((OLD.space_state->>'iron')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'titanium')::numeric, 0) IS DISTINCT FROM COALESCE((OLD.space_state->>'titanium')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{titanium}', to_jsonb(COALESCE((OLD.space_state->>'titanium')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'quantum')::numeric, 0) IS DISTINCT FROM COALESCE((OLD.space_state->>'quantum')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{quantum}', to_jsonb(COALESCE((OLD.space_state->>'quantum')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'pgtOre')::numeric, 0) IS DISTINCT FROM COALESCE((OLD.space_state->>'pgtOre')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{pgtOre}', to_jsonb(COALESCE((OLD.space_state->>'pgtOre')::numeric, 0)));
        END IF;

        -- 11c. Space Career Statistics & Milestones (Server RPC controlled only)
        -- Direct PostgREST client updates cannot inflate or roll back raidsWon, pgtMinedTotal, or mineralsMinedTotal!
        IF COALESCE((NEW.space_state->>'raidsWon')::numeric, 0) IS DISTINCT FROM COALESCE((OLD.space_state->>'raidsWon')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{raidsWon}', to_jsonb(COALESCE((OLD.space_state->>'raidsWon')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'pgtMinedTotal')::numeric, 0) IS DISTINCT FROM COALESCE((OLD.space_state->>'pgtMinedTotal')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{pgtMinedTotal}', to_jsonb(COALESCE((OLD.space_state->>'pgtMinedTotal')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'mineralsMinedTotal')::numeric, 0) IS DISTINCT FROM COALESCE((OLD.space_state->>'mineralsMinedTotal')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((OLD.space_state->>'mineralsMinedTotal')::numeric, 0)));
        END IF;
        IF OLD.space_state IS NOT NULL AND OLD.space_state ? 'missionsCompleted' THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{missionsCompleted}', OLD.space_state->'missionsCompleted');
        END IF;
        IF OLD.space_state IS NOT NULL AND OLD.space_state ? 'missionLogs' THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{missionLogs}', OLD.space_state->'missionLogs');
        END IF;

        -- 11d. Fleet Power (Deterministic calculation from validated module levels)
        NEW.space_state := jsonb_set(
          NEW.space_state,
          '{fleetPower}',
          to_jsonb(
            (GREATEST(1, COALESCE((NEW.space_state->>'warpLevel')::integer, 1)) * 100) +
            (GREATEST(1, COALESCE((NEW.space_state->>'laserLevel')::integer, 1)) * 80) +
            (GREATEST(1, COALESCE((NEW.space_state->>'cargoLevel')::integer, 1)) * 50) +
            (GREATEST(1, COALESCE((NEW.space_state->>'shieldLevel')::integer, 1)) * 60) +
            (GREATEST(1, COALESCE((NEW.space_state->>'turretLevel')::integer, 1)) * 90)
          )
        );

        -- 11e. Protect Outpost & Deep-Space Cooldowns from Client Rollback/Wiping
        IF OLD.space_state IS NOT NULL AND jsonb_typeof(OLD.space_state) = 'object' THEN
          -- Never allow client to wipe or backdate lastPokeDate
          IF OLD.space_state->>'lastPokeDate' IS NOT NULL THEN
            IF NEW.space_state->>'lastPokeDate' IS NULL OR NEW.space_state->>'lastPokeDate' < OLD.space_state->>'lastPokeDate' THEN
              NEW.space_state := jsonb_set(NEW.space_state, '{lastPokeDate}', OLD.space_state->'lastPokeDate');
            END IF;
          END IF;

          -- Never allow client to wipe or backdate lastRaidDate
          IF OLD.space_state->>'lastRaidDate' IS NOT NULL THEN
            IF NEW.space_state->>'lastRaidDate' IS NULL OR NEW.space_state->>'lastRaidDate' < OLD.space_state->>'lastRaidDate' THEN
              NEW.space_state := jsonb_set(NEW.space_state, '{lastRaidDate}', OLD.space_state->'lastRaidDate');
            END IF;
          END IF;

          -- Never allow client to roll back anomaly scan timestamp
          IF OLD.space_state->>'lastAnomalyScanTime' IS NOT NULL THEN
            IF COALESCE((NEW.space_state->>'lastAnomalyScanTime')::bigint, 0) < COALESCE((OLD.space_state->>'lastAnomalyScanTime')::bigint, 0) THEN
              NEW.space_state := jsonb_set(NEW.space_state, '{lastAnomalyScanTime}', OLD.space_state->'lastAnomalyScanTime');
            END IF;
          END IF;

          -- 11f. Immutable Fleet Expeditions & Anti-Macro Cadence Metadata (Server RPC Controlled Only)
          -- Direct PostgREST client updates (anon/authenticated) can NEVER alter or inject expeditions or cadence fields!
          -- Expeditions are strictly managed via start_polyspace_expedition, claim_polyspace_expedition, and cancel_polyspace_expedition
          IF OLD.space_state IS NOT NULL AND jsonb_typeof(OLD.space_state) = 'object' THEN
            NEW.space_state := jsonb_set(NEW.space_state, '{expeditions}', COALESCE(OLD.space_state->'expeditions', '[]'::jsonb));
            IF OLD.space_state ? 'lastClaimTimestampMs' THEN
              NEW.space_state := jsonb_set(NEW.space_state, '{lastClaimTimestampMs}', OLD.space_state->'lastClaimTimestampMs');
            END IF;
            IF OLD.space_state ? 'recentClaimIntervals' THEN
              NEW.space_state := jsonb_set(NEW.space_state, '{recentClaimIntervals}', OLD.space_state->'recentClaimIntervals');
            END IF;
            IF OLD.space_state ? 'recentClaimLags' THEN
              NEW.space_state := jsonb_set(NEW.space_state, '{recentClaimLags}', OLD.space_state->'recentClaimLags');
            END IF;
          END IF;
        END IF;
      END IF;

      -- 12. Immutable Daily Quests: Direct client updates (anon/authenticated) can NEVER alter daily_quests
      -- Daily quests are strictly server-authoritative and managed via claim_daily_quest RPC.
      IF NEW.daily_quests IS DISTINCT FROM OLD.daily_quests THEN
        NEW.daily_quests := OLD.daily_quests;
      END IF;

      -- 13. 🛡️ Immutable World Boss statistics (Server RPC controlled only)
      -- Direct client updates (anon/authenticated) can NEVER alter or inject boss damage or attack counts!
      -- Boss strikes are strictly computed and recorded server-side via strike_world_boss RPC.
      IF NEW.boss_weekly_damage IS DISTINCT FROM OLD.boss_weekly_damage THEN
        NEW.boss_weekly_damage := OLD.boss_weekly_damage;
      END IF;
      IF NEW.alltime_boss_damage IS DISTINCT FROM OLD.alltime_boss_damage THEN
        NEW.alltime_boss_damage := OLD.alltime_boss_damage;
      END IF;
      IF NEW.boss_attacks_count IS DISTINCT FROM OLD.boss_attacks_count THEN
        NEW.boss_attacks_count := OLD.boss_attacks_count;
      END IF;

      -- 14. 🛡️ Immutable Financial & Yield Totals
      IF NEW.total_staking_yield IS DISTINCT FROM OLD.total_staking_yield THEN
        NEW.total_staking_yield := OLD.total_staking_yield;
      END IF;
      IF NEW.total_earned IS DISTINCT FROM OLD.total_earned THEN
        NEW.total_earned := OLD.total_earned;
      END IF;
      IF NEW.withdrawals_disabled IS DISTINCT FROM OLD.withdrawals_disabled THEN
        NEW.withdrawals_disabled := OLD.withdrawals_disabled;
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Update save_polyspace_state() (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.save_polyspace_state(
  p_player_id TEXT,
  p_space_state JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_current_state JSONB;
  v_merged_state JSONB;
  v_guard RECORD;
BEGIN
  -- 1. Caller authentication & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  IF p_space_state IS NULL OR jsonb_typeof(p_space_state) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid space_state object.');
  END IF;

  -- 2. Lock & Load User Profile
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found.');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended.');
  END IF;

  v_current_state := COALESCE(v_user.space_state, '{}'::jsonb);

  -- Anti-tamper probe detection: if caller attempts to wipe or backdate server cooldowns
  IF v_current_state->>'lastPokeDate' IS NOT NULL AND 
     (p_space_state->>'lastPokeDate' IS NULL OR p_space_state->>'lastPokeDate' < v_current_state->>'lastPokeDate') THEN
    PERFORM public.record_bot_warning(
      v_pid,
      'cooldown_wipe_attempt',
      'PolySpace Fleet Sentinel',
      jsonb_build_object('field', 'lastPokeDate', 'attempted', p_space_state->>'lastPokeDate')
    );
  END IF;

  v_merged_state := v_current_state || p_space_state;

  -- CRITICAL ANTI-CHEAT: Never allow client to overwrite or inject expeditions!
  -- Expeditions must strictly be managed via start_polyspace_expedition & claim_polyspace_expedition
  v_merged_state := jsonb_set(v_merged_state, '{expeditions}', COALESCE(v_current_state->'expeditions', '[]'::jsonb));

  -- CRITICAL ANTI-CHEAT: Never allow client to tamper with or reset server claim cadence telemetry!
  IF v_current_state ? 'lastClaimTimestampMs' THEN
    v_merged_state := jsonb_set(v_merged_state, '{lastClaimTimestampMs}', v_current_state->'lastClaimTimestampMs');
  ELSE
    v_merged_state := v_merged_state - 'lastClaimTimestampMs';
  END IF;

  IF v_current_state ? 'recentClaimIntervals' THEN
    v_merged_state := jsonb_set(v_merged_state, '{recentClaimIntervals}', v_current_state->'recentClaimIntervals');
  ELSE
    v_merged_state := v_merged_state - 'recentClaimIntervals';
  END IF;

  IF v_current_state ? 'recentClaimLags' THEN
    v_merged_state := jsonb_set(v_merged_state, '{recentClaimLags}', v_current_state->'recentClaimLags');
  ELSE
    v_merged_state := v_merged_state - 'recentClaimLags';
  END IF;

  -- CRITICAL COOLDOWN PRESERVATION: Client can NEVER wipe, modify, or roll back server daily cooldowns!
  IF v_current_state->>'lastPokeDate' IS NOT NULL THEN
    v_merged_state := jsonb_set(v_merged_state, '{lastPokeDate}', to_jsonb(v_current_state->>'lastPokeDate'));
  ELSE
    v_merged_state := v_merged_state - 'lastPokeDate';
  END IF;

  IF v_current_state->>'lastRaidDate' IS NOT NULL THEN
    v_merged_state := jsonb_set(v_merged_state, '{lastRaidDate}', to_jsonb(v_current_state->>'lastRaidDate'));
  ELSE
    v_merged_state := v_merged_state - 'lastRaidDate';
  END IF;

  IF v_current_state->>'lastAnomalyScanTime' IS NOT NULL THEN
    v_merged_state := jsonb_set(v_merged_state, '{lastAnomalyScanTime}', to_jsonb((v_current_state->>'lastAnomalyScanTime')::bigint));
  END IF;

  IF v_current_state->>'lastOpDate' IS NOT NULL THEN
    v_merged_state := jsonb_set(v_merged_state, '{lastOpDate}', to_jsonb(v_current_state->>'lastOpDate'));
  ELSE
    v_merged_state := v_merged_state - 'lastOpDate';
  END IF;

  v_merged_state := jsonb_set(v_merged_state, '{raidsWon}', to_jsonb(COALESCE((v_current_state->>'raidsWon')::integer, 0)));
  v_merged_state := jsonb_set(v_merged_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((v_current_state->>'mineralsMinedTotal')::numeric, 0)));

  -- Anti-tamper clamps: Module levels cannot increase or decrease without upgrade_polyspace_module RPC
  v_merged_state := jsonb_set(v_merged_state, '{warpLevel}', to_jsonb(COALESCE((v_current_state->>'warpLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{laserLevel}', to_jsonb(COALESCE((v_current_state->>'laserLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{cargoLevel}', to_jsonb(COALESCE((v_current_state->>'cargoLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{shieldLevel}', to_jsonb(COALESCE((v_current_state->>'shieldLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{turretLevel}', to_jsonb(COALESCE((v_current_state->>'turretLevel')::integer, 1)));

  -- Space Minerals are strictly server-authoritative (managed via claim_polyspace_expedition, upgrade_polyspace_module, smelt_space_ore, launch_outpost_raid, scan_polyspace_anomaly, strike_world_boss)
  -- save_polyspace_state can NEVER inflate OR roll back mineral balances!
  v_merged_state := jsonb_set(v_merged_state, '{iron}', to_jsonb(COALESCE((v_current_state->>'iron')::numeric, 0)));
  v_merged_state := jsonb_set(v_merged_state, '{titanium}', to_jsonb(COALESCE((v_current_state->>'titanium')::numeric, 0)));
  v_merged_state := jsonb_set(v_merged_state, '{quantum}', to_jsonb(COALESCE((v_current_state->>'quantum')::numeric, 0)));
  v_merged_state := jsonb_set(v_merged_state, '{pgtOre}', to_jsonb(COALESCE((v_current_state->>'pgtOre')::numeric, 0)));
  v_merged_state := jsonb_set(v_merged_state, '{pgtMinedTotal}', to_jsonb(COALESCE((v_current_state->>'pgtMinedTotal')::numeric, 0)));

  -- Preserve server missionLogs unless caller explicitly requested clearMissionLogs (empty array with _clearMissionLogs flag)
  IF COALESCE((p_space_state->>'_clearMissionLogs')::boolean, false) THEN
    v_merged_state := (v_merged_state - '_clearMissionLogs');
    v_merged_state := jsonb_set(v_merged_state, '{missionLogs}', '[]'::jsonb);
  ELSIF v_current_state ? 'missionLogs' THEN
    v_merged_state := jsonb_set(v_merged_state, '{missionLogs}', COALESCE(v_current_state->'missionLogs', '[]'::jsonb));
  END IF;

  IF v_current_state ? 'missionsCompleted' THEN
    v_merged_state := jsonb_set(v_merged_state, '{missionsCompleted}', v_current_state->'missionsCompleted');
  END IF;

  -- Fleet Power recalculation
  v_merged_state := jsonb_set(
    v_merged_state,
    '{fleetPower}',
    to_jsonb(
      (GREATEST(1, COALESCE((v_merged_state->>'warpLevel')::integer, 1)) * 100) +
      (GREATEST(1, COALESCE((v_merged_state->>'laserLevel')::integer, 1)) * 80) +
      (GREATEST(1, COALESCE((v_merged_state->>'cargoLevel')::integer, 1)) * 50) +
      (GREATEST(1, COALESCE((v_merged_state->>'shieldLevel')::integer, 1)) * 60) +
      (GREATEST(1, COALESCE((v_merged_state->>'turretLevel')::integer, 1)) * 90)
    )
  );

  UPDATE public.users
  SET space_state = v_merged_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object('success', true, 'space_state', v_merged_state);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_polyspace_state(TEXT, JSONB) TO authenticated, service_role, anon;
