-- ==============================================================================
-- MIGRATION: Fix Outpost Infinite Claims & Shield Cooldown Timestamps
-- Version: v1.5.409
-- Purpose:
--   1. Hardens `public.poke_allied_outpost`:
--      - Enforces strict (>= v_today_str) UTC cooldown check.
--      - Clamps warpLevel strictly to [1..50] (max level 50) to prevent inflated mineral drops.
--   2. Hardens `public.launch_outpost_raid`:
--      - Enforces strict (>= v_today_str) UTC cooldown check.
--   3. Hardens `public.prevent_direct_balance_mutation`:
--      - Prevents client-side PostgREST updates from wiping, nullifying, or rolling back
--        `lastPokeDate`, `lastRaidDate`, or `lastAnomalyScanTime` in `users.space_state`.
--      - CRITICAL: Declared WITHOUT `SECURITY DEFINER` (Security Invoker) to preserve
--        CURRENT_USER role detection for anon/authenticated callers.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDEN poke_allied_outpost (STRICT UTC COOLDOWN & WARP LEVEL CLAMP)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.poke_allied_outpost(
  p_player_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_user RECORD;
  v_today_str TEXT := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_warp_level INTEGER;
  v_bonus_iron INTEGER;
  v_bonus_pgt NUMERIC := 20.00;
  v_new_balance NUMERIC;
  v_state JSONB;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(p_player_id)); 
  END IF;

  SELECT * INTO v_user 
  FROM public.users 
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account suspended');
  END IF;

  v_state := COALESCE(v_user.space_state, '{}'::jsonb);

  -- Enforce 1/day UTC cooldown
  IF (v_state->>'lastPokeDate') IS NOT NULL AND (v_state->>'lastPokeDate') >= v_today_str THEN
    RETURN jsonb_build_object('success', false, 'error', 'Allied Outpost already poked today (1/day limit)! Resets at midnight UTC.');
  END IF;

  -- Clamp warp level strictly between 1 and 50 (prevents memory-injected levels like 999)
  v_warp_level := LEAST(GREATEST(1, COALESCE((v_state->>'warpLevel')::integer, 1)), 50);
  v_bonus_iron := 20 * v_warp_level;

  -- Update space state minerals and cooldown
  v_state := jsonb_set(v_state, '{lastPokeDate}', to_jsonb(v_today_str));
  v_state := jsonb_set(v_state, '{iron}', to_jsonb(COALESCE((v_state->>'iron')::numeric, 0) + v_bonus_iron));
  v_state := jsonb_set(v_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((v_state->>'mineralsMinedTotal')::numeric, 0) + v_bonus_iron));
  v_state := jsonb_set(v_state, '{pgtMinedTotal}', to_jsonb(ROUND(COALESCE((v_state->>'pgtMinedTotal')::numeric, 0) + v_bonus_pgt, 2)));

  -- Atomically credit PGT balance and update state
  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_bonus_pgt,
      total_earned = COALESCE(total_earned, 0) + v_bonus_pgt,
      space_state = v_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  -- Process referral commissions (20 PGT base)
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_referral_commissions') THEN
    BEGIN
      PERFORM process_referral_commissions(v_user.player_id, v_bonus_pgt, 'PolySpace Outpost Poke');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'bonus_iron', v_bonus_iron,
    'bonus_pgt', v_bonus_pgt,
    'new_balance', v_new_balance,
    'space_state', v_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.poke_allied_outpost(TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 2. HARDEN launch_outpost_raid (STRICT UTC COOLDOWN & ATOMIC FUEL CHECK)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.launch_outpost_raid(
  p_player_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_user RECORD;
  v_today_str TEXT := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_fleet_power INTEGER;
  v_enemy_power INTEGER;
  v_iron NUMERIC;
  v_stolen_pgt NUMERIC;
  v_stolen_iron INTEGER;
  v_stolen_titanium INTEGER;
  v_new_balance NUMERIC;
  v_state JSONB;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(p_player_id)); 
  END IF;

  SELECT * INTO v_user 
  FROM public.users 
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account suspended');
  END IF;

  v_state := COALESCE(v_user.space_state, '{}'::jsonb);

  -- Enforce 1/day UTC cooldown
  IF (v_state->>'lastRaidDate') IS NOT NULL AND (v_state->>'lastRaidDate') >= v_today_str THEN
    RETURN jsonb_build_object('success', false, 'error', 'Outpost Raid already launched today (1/day limit)! Resets at midnight UTC.');
  END IF;

  -- Require 15 Iron fuel
  v_iron := COALESCE((v_state->>'iron')::numeric, 0);
  IF v_iron < 15 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Raid requires 15 Iron for Fuel!');
  END IF;

  v_fleet_power := COALESCE((v_state->>'fleetPower')::integer, 50);
  v_enemy_power := FLOOR(80 + RANDOM() * (v_fleet_power * 1.2));

  -- Deduct iron fuel and set raid date
  v_state := jsonb_set(v_state, '{lastRaidDate}', to_jsonb(v_today_str));
  v_state := jsonb_set(v_state, '{iron}', to_jsonb(v_iron - 15));

  IF v_fleet_power < v_enemy_power THEN
    -- Defeat: record updated state with cooldown and fuel consumed
    UPDATE public.users SET space_state = v_state, updated_at = NOW() WHERE player_id = v_user.player_id;
    RETURN jsonb_build_object(
      'success', true,
      'victory', false,
      'enemy_power', v_enemy_power,
      'fleet_power', v_fleet_power,
      'message', format('Raid Defeated! Enemy Outpost defense (%s Power) was too strong.', v_enemy_power),
      'space_state', v_state
    );
  END IF;

  -- Victory: calculate reward securely server-side (16 to 24 PGT)
  v_stolen_pgt := ROUND((16.0 + RANDOM() * 8.0)::numeric, 2);
  v_stolen_iron := FLOOR(25 + RANDOM() * 25);
  v_stolen_titanium := FLOOR(5 + RANDOM() * 5);

  v_state := jsonb_set(v_state, '{raidsWon}', to_jsonb(COALESCE((v_state->>'raidsWon')::integer, 0) + 1));
  v_state := jsonb_set(v_state, '{iron}', to_jsonb(COALESCE((v_state->>'iron')::numeric, 0) + v_stolen_iron));
  v_state := jsonb_set(v_state, '{titanium}', to_jsonb(COALESCE((v_state->>'titanium')::numeric, 0) + v_stolen_titanium));
  v_state := jsonb_set(v_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((v_state->>'mineralsMinedTotal')::numeric, 0) + v_stolen_iron + v_stolen_titanium));
  v_state := jsonb_set(v_state, '{pgtMinedTotal}', to_jsonb(ROUND(COALESCE((v_state->>'pgtMinedTotal')::numeric, 0) + v_stolen_pgt, 2)));

  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_stolen_pgt,
      total_earned = COALESCE(total_earned, 0) + v_stolen_pgt,
      space_state = v_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_referral_commissions') THEN
    BEGIN
      PERFORM process_referral_commissions(v_user.player_id, v_stolen_pgt, 'PolySpace Outpost Raid');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'victory', true,
    'enemy_power', v_enemy_power,
    'fleet_power', v_fleet_power,
    'stolen_pgt', v_stolen_pgt,
    'stolen_iron', v_stolen_iron,
    'stolen_titanium', v_stolen_titanium,
    'new_balance', v_new_balance,
    'space_state', v_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.launch_outpost_raid(TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 3. HARDEN prevent_direct_balance_mutation (PROTECT OUTPOST & ANOMALY COOLDOWNS)
-- NOTE: NEVER DECLARE WITH SECURITY DEFINER (MUST REMAIN SECURITY INVOKER)!
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
  v_today TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
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
      NEW.bot_warning := 0;
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

      -- Prevent setting fake referrals on account creation
      NEW.referrals_count := 0;
      NEW.referrals_l1 := 0;
      NEW.referrals_l2 := 0;
      NEW.referrals_l3 := 0;
      NEW.referrals_l4 := 0;
      NEW.referrals_list := '[]'::jsonb;

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

      -- Immutable referral tree statistics & referral list on direct client UPDATE
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
        -- Direct PostgREST client updates cannot increase module levels!
        IF COALESCE((NEW.space_state->>'warpLevel')::integer, 1) > COALESCE((OLD.space_state->>'warpLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{warpLevel}', to_jsonb(COALESCE((OLD.space_state->>'warpLevel')::integer, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'laserLevel')::integer, 1) > COALESCE((OLD.space_state->>'laserLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{laserLevel}', to_jsonb(COALESCE((OLD.space_state->>'laserLevel')::integer, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'cargoLevel')::integer, 1) > COALESCE((OLD.space_state->>'cargoLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{cargoLevel}', to_jsonb(COALESCE((OLD.space_state->>'cargoLevel')::integer, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'shieldLevel')::integer, 1) > COALESCE((OLD.space_state->>'shieldLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{shieldLevel}', to_jsonb(COALESCE((OLD.space_state->>'shieldLevel')::integer, 1)));
        END IF;
        IF COALESCE((NEW.space_state->>'turretLevel')::integer, 1) > COALESCE((OLD.space_state->>'turretLevel')::integer, 1) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{turretLevel}', to_jsonb(COALESCE((OLD.space_state->>'turretLevel')::integer, 1)));
        END IF;

        -- 11b. Space Minerals (Can only be earned via expeditions, smelting, anomalies, or boss)
        -- Direct PostgREST client updates cannot inflate mineral balances!
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

        -- 11c. Fleet Power (Deterministic calculation from validated module levels)
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

        -- 11d. Protect Outpost & Deep-Space Cooldowns from Client Rollback/Wiping
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
        END IF;

      END IF;

      -- 12. Daily Quests Anti-Tamper & Anti-Replay Shield
      -- Direct client updates (anon/authenticated) can never unclaim quest rewards!
      IF NEW.daily_quests IS NOT NULL AND jsonb_typeof(NEW.daily_quests) = 'object' THEN
        IF OLD.daily_quests IS NOT NULL AND jsonb_typeof(OLD.daily_quests) = 'object' THEN
          -- If the existing record is for today, preserve any claimed flags
          IF COALESCE(OLD.daily_quests->>'date', '') = v_today THEN
            IF COALESCE((OLD.daily_quests->>'games_claimed')::boolean, false) THEN
              NEW.daily_quests := jsonb_set(NEW.daily_quests, '{games_claimed}', 'true'::jsonb);
            END IF;
            IF COALESCE((OLD.daily_quests->>'mining_claimed')::boolean, false) THEN
              NEW.daily_quests := jsonb_set(NEW.daily_quests, '{mining_claimed}', 'true'::jsonb);
            END IF;
            IF COALESCE((OLD.daily_quests->>'wins_claimed')::boolean, false) THEN
              NEW.daily_quests := jsonb_set(NEW.daily_quests, '{wins_claimed}', 'true'::jsonb);
            END IF;
            IF COALESCE((OLD.daily_quests->>'master_claimed')::boolean, false) THEN
              NEW.daily_quests := jsonb_set(NEW.daily_quests, '{master_claimed}', 'true'::jsonb);
            END IF;
            -- Streak days can only be maintained or advanced
            IF COALESCE((NEW.daily_quests->>'streak_days')::int, 0) < COALESCE((OLD.daily_quests->>'streak_days')::int, 0) THEN
              NEW.daily_quests := jsonb_set(NEW.daily_quests, '{streak_days}', to_jsonb(COALESCE((OLD.daily_quests->>'streak_days')::int, 0)));
            END IF;
          END IF;
        END IF;
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_direct_balance_mutation ON public.users;
CREATE TRIGGER trigger_prevent_direct_balance_mutation
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_balance_mutation();
