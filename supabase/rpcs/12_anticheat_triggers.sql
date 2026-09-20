-- 12. MASTER POSTGREST ANTI-CHEAT TRIGGER (SECURITY INVOKER)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: prevent_direct_balance_mutation
-- Source: drop_is_liquidity_provider_and_sync_dex_usd.sql
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
      NEW.last_turnstile_at := NULL;

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

      -- 4b. Immutable Turnstile verification timestamp (server RPC controlled only)
      IF NEW.last_turnstile_at IS DISTINCT FROM OLD.last_turnstile_at THEN
        NEW.last_turnstile_at := OLD.last_turnstile_at;
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


-- ------------------------------------------------------------------------------
-- Ensure trigger is bound to public.users
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trigger_prevent_direct_balance_mutation ON public.users;
CREATE TRIGGER trigger_prevent_direct_balance_mutation
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_balance_mutation();
-- ------------------------------------------------------------------------------
-- RPC: delete_user_account (Hardened against unauthenticated deletion & Master Admin protected)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_user_account(
  p_user_id UUID DEFAULT NULL,
  p_wallet TEXT DEFAULT NULL
) 
RETURNS JSONB 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public, auth
AS $$
DECLARE
  v_caller TEXT := LOWER(COALESCE(CURRENT_USER, ''));
  v_auth_uid UUID := auth.uid();
  v_clean_wallet TEXT := LOWER(TRIM(COALESCE(p_wallet, '')));
  v_pid TEXT;
  v_deleted_count INT := 0;
  v_admin_wallet TEXT := '0x10b9993990c9ef8a212c9557cb02ad94da9a654d';
BEGIN
  -- 1. HARD SHIELD: Master Admin wallet can NEVER be deleted
  IF v_clean_wallet = v_admin_wallet THEN
    RETURN jsonb_build_object('success', false, 'error', 'Security Violation: Master Admin account cannot be deleted under any circumstance.');
  END IF;

  -- Check if target resolves to Master Admin
  IF v_clean_wallet <> '' THEN
    v_pid := resolve_player_id(v_clean_wallet);
    IF LOWER(COALESCE(v_pid, '')) = v_admin_wallet THEN
      RETURN jsonb_build_object('success', false, 'error', 'Security Violation: Master Admin account cannot be deleted.');
    END IF;
  END IF;

  -- 2. Authenticated Social / Email Deletions (Google / Email)
  IF p_user_id IS NOT NULL THEN
    IF v_caller IN ('anon', 'authenticated') AND (v_auth_uid IS NULL OR v_auth_uid <> p_user_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: You can only delete your own authenticated account.');
    END IF;

    DELETE FROM public.users 
    WHERE user_id = p_user_id 
      AND LOWER(COALESCE(linked_wallet_address, '')) <> v_admin_wallet;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully by authenticated user_id.', 'deleted_rows', v_deleted_count);

  -- 3. Web3 Wallet Deletions
  ELSIF v_clean_wallet <> '' THEN
    IF v_caller IN ('anon', 'authenticated') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Direct wallet deletion is disabled for security. Web3 accounts cannot be deleted via unauthenticated API calls.');
    END IF;

    DELETE FROM public.users 
    WHERE (LOWER(player_id) = v_clean_wallet 
       OR LOWER(player_id) = LOWER(v_pid)
       OR LOWER(COALESCE(linked_wallet_address, '')) = v_clean_wallet)
      AND LOWER(COALESCE(linked_wallet_address, '')) <> v_admin_wallet
      AND LOWER(player_id) <> v_admin_wallet;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully by wallet/player_id.', 'deleted_rows', v_deleted_count);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Missing user ID or wallet address.');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: bind_web3_user_session
-- Source: bind_web3_auth_user.sql
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bind_web3_user_session(p_wallet TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_auth_uid UUID;
  v_target_wallet TEXT;
  v_user_row RECORD;
  v_placeholder_row RECORD;
  v_existing_conflict TEXT;
BEGIN
  -- 1. Must be called by an authenticated user (Supabase Auth session)
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'UNAUTHENTICATED', 'message', 'Must have an active Supabase Auth session.');
  END IF;

  v_target_wallet := LOWER(TRIM(p_wallet));
  IF v_target_wallet IS NULL OR v_target_wallet = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_WALLET', 'message', 'Invalid wallet address.');
  END IF;

  -- 2. Check if another account is already permanently linked to a different auth user
  SELECT user_id INTO v_existing_conflict
  FROM public.users
  WHERE (LOWER(linked_wallet_address) = v_target_wallet OR LOWER(wallet_address) = v_target_wallet)
    AND user_id IS NOT NULL
    AND user_id <> v_auth_uid::TEXT
  LIMIT 1;

  IF v_existing_conflict IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'WALLET_CONFLICT', 
      'message', 'Wallet is already bound to another authenticated user.'
    );
  END IF;

  -- 3. Check if a dummy placeholder row was created for this auth.uid()
  SELECT * INTO v_placeholder_row
  FROM public.users
  WHERE user_id = v_auth_uid::TEXT
  ORDER BY created_at DESC
  LIMIT 1;

  -- 4. Locate the user's real row in public.users
  SELECT * INTO v_user_row
  FROM public.users
  WHERE (LOWER(linked_wallet_address) = v_target_wallet OR LOWER(player_id) = v_target_wallet OR LOWER(wallet_address) = v_target_wallet)
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_user_row.player_id IS NOT NULL THEN
    -- Delete empty placeholder if a separate one was auto-created during auth event
    IF v_placeholder_row.player_id IS NOT NULL AND v_placeholder_row.player_id <> v_user_row.player_id THEN
      DELETE FROM public.users WHERE player_id = v_placeholder_row.player_id;
    END IF;

    -- Bind this authenticated auth.uid() to the real user row
    UPDATE public.users
    SET user_id = v_auth_uid::TEXT,
        linked_wallet_address = COALESCE(linked_wallet_address, v_target_wallet),
        updated_at = NOW()
    WHERE player_id = v_user_row.player_id;

    RETURN jsonb_build_object(
      'success', true,
      'player_id', v_user_row.player_id,
      'user_id', v_auth_uid::TEXT,
      'linked_wallet_address', COALESCE(v_user_row.linked_wallet_address, v_target_wallet)
    );
  ELSE
    IF v_placeholder_row.player_id IS NOT NULL THEN
      UPDATE public.users
      SET linked_wallet_address = v_target_wallet,
          wallet_address = v_target_wallet,
          updated_at = NOW()
      WHERE player_id = v_placeholder_row.player_id;

      RETURN jsonb_build_object(
        'success', true,
        'player_id', v_placeholder_row.player_id,
        'user_id', v_auth_uid::TEXT,
        'linked_wallet_address', v_target_wallet
      );
    ELSE
      -- If no row exists yet, create one with the verified user_id
      INSERT INTO public.users (
        user_id,
        player_id,
        linked_wallet_address,
        wallet_address,
        balance_pgt
      ) VALUES (
        v_auth_uid::TEXT,
        v_target_wallet,
        v_target_wallet,
        v_target_wallet,
        0.0
      );

      RETURN jsonb_build_object(
        'success', true,
        'player_id', v_target_wallet,
        'user_id', v_auth_uid::TEXT,
        'linked_wallet_address', v_target_wallet
      );
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bind_web3_user_session(TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: get_admin_discord_webhooks
-- Sourced from: harden_arcade_nft_validation_and_isolate_discord_webhooks.sql
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_discord_webhooks(p_admin_passkey TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_expected_passkey TEXT;
  v_row RECORD;
BEGIN
  -- Verify Master Admin passkey
  SELECT admin_passkey INTO v_expected_passkey
  FROM public.global_settings
  WHERE id = 1;

  IF p_admin_passkey IS NULL OR p_admin_passkey <> v_expected_passkey THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid Master Admin Passkey');
  END IF;

  SELECT * INTO v_row FROM public.admin_discord_secrets WHERE id = 1;

  RETURN jsonb_build_object(
    'success', true,
    'main', COALESCE(v_row.discord_webhook_url, ''),
    'admin', COALESCE(v_row.discord_admin_webhook_url, ''),
    'announcements', COALESCE(v_row.discord_announcements_webhook_url, '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_discord_webhooks(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: update_admin_discord_webhooks
-- Sourced from: harden_arcade_nft_validation_and_isolate_discord_webhooks.sql
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_admin_discord_webhooks(
  p_admin_passkey TEXT,
  p_main TEXT DEFAULT NULL,
  p_admin TEXT DEFAULT NULL,
  p_announcements TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_expected_passkey TEXT;
BEGIN
  -- Verify Master Admin passkey
  SELECT admin_passkey INTO v_expected_passkey
  FROM public.global_settings
  WHERE id = 1;

  IF p_admin_passkey IS NULL OR p_admin_passkey <> v_expected_passkey THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid Master Admin Passkey');
  END IF;

  INSERT INTO public.admin_discord_secrets (id, discord_webhook_url, discord_admin_webhook_url, discord_announcements_webhook_url, updated_at)
  VALUES (1, p_main, p_admin, p_announcements, NOW())
  ON CONFLICT (id) DO UPDATE
  SET discord_webhook_url = COALESCE(p_main, admin_discord_secrets.discord_webhook_url),
      discord_admin_webhook_url = COALESCE(p_admin, admin_discord_secrets.discord_admin_webhook_url),
      discord_announcements_webhook_url = COALESCE(p_announcements, admin_discord_secrets.discord_announcements_webhook_url),
      updated_at = NOW();

  -- Guarantee global_settings columns remain completely sanitized
  UPDATE public.global_settings
  SET discord_webhook_url = NULL,
      discord_admin_webhook_url = NULL,
      discord_announcements_webhook_url = NULL
  WHERE id = 1;

  RETURN jsonb_build_object('success', true, 'message', 'Discord Webhook secrets updated securely');
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_admin_discord_webhooks(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: record_bot_warning
-- Source: harden_relic_drops_and_auto_ban_probes.sql
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_bot_warning(
  p_player_id TEXT,
  p_reason TEXT,
  p_game TEXT DEFAULT NULL,
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  v_pid := resolve_player_id(p_player_id);
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_player_id, '')));
  END IF;

  SELECT * INTO v_user FROM public.users WHERE player_id = v_pid FOR UPDATE;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Atomically increment bot_warning count
  UPDATE public.users
  SET bot_warning = COALESCE(bot_warning, 0) + 1,
      updated_at = NOW()
  WHERE player_id = v_pid
  RETURNING bot_warning INTO v_count;

  -- Auto-ban policy: If 5 or more security/bot violations are recorded, auto-ban the player
  IF v_count >= 5 AND COALESCE(v_user.is_banned, false) = false THEN
    UPDATE public.users
    SET is_banned = true,
        updated_at = NOW()
    WHERE player_id = v_pid;
  END IF;

  -- Log security incident to persistent audit table
  INSERT INTO public.bot_security_logs (player_id, reason, game_name, details, created_at)
  VALUES (v_pid, COALESCE(p_reason, 'suspicious_activity'), p_game, COALESCE(p_details, '{}'::jsonb), NOW());

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_pid,
    'bot_warning', v_count,
    'is_banned', (v_count >= 5),
    'reason', p_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_bot_warning(TEXT, TEXT, TEXT, JSONB) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: grant_relic_drop (HARDENED WITH ARCADE SESSION BINDING)
-- Source: harden_relic_drops_and_auto_ban_probes.sql
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grant_relic_drop(
    p_player_id TEXT,
    p_relic_id TEXT,
    p_amount INT DEFAULT 1,
    p_session_id TEXT DEFAULT NULL,
    p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_actual_player_id TEXT := resolve_player_id(p_player_id);
    v_current_relics JSONB;
    v_relic_obj JSONB;
    v_total INT;
    v_unminted INT;
    v_onchain INT;
    v_token_ids JSONB;
    v_updated_relics JSONB;
    v_clean_relic_id TEXT := LOWER(TRIM(COALESCE(p_relic_id, '')));
    v_session RECORD;
    v_session_uuid UUID;
    v_context TEXT;
    v_is_internal BOOLEAN := false;
    v_is_admin BOOLEAN := false;
BEGIN
    IF v_actual_player_id IS NULL OR v_actual_player_id = '' THEN
        v_actual_player_id := LOWER(TRIM(COALESCE(p_player_id, '')));
    END IF;

    -- Security Guard: Check if player account is suspended
    IF EXISTS (SELECT 1 FROM public.users WHERE player_id = v_actual_player_id AND is_banned = true) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player account suspended for security violations');
    END IF;

    -- 1. Verify True Internal Engine Calls via PostgreSQL Call Stack (Cannot be spoofed over HTTP)
    GET DIAGNOSTICS v_context = PG_CONTEXT;
    IF v_context LIKE '%claim_polyspace_expedition%' THEN
        v_is_internal := true;
    END IF;

    -- 2. Verify Master Admin Passkey (if provided)
    IF p_admin_passkey IS NOT NULL AND TRIM(p_admin_passkey) <> '' THEN
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'verify_admin_passkey') THEN
            v_is_admin := public.verify_admin_passkey(p_admin_passkey);
        END IF;
    END IF;

    -- 3. Anti-Cheat: Reject bulk drop amounts (strictly 1 relic per event)
    IF p_amount IS NOT NULL AND p_amount > 1 THEN
        IF NOT v_is_internal AND NOT v_is_admin THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_bulk_amount',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'amount', p_amount, 'source', 'direct_rpc_probe')
            );
        END IF;
        RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
    END IF;

    -- 4. Anti-Cheat: Bind client drops directly to an active, validated arcade session
    IF NOT v_is_internal AND NOT v_is_admin THEN
        -- Case A: Missing Session ID
        IF p_session_id IS NULL OR TRIM(p_session_id) = '' THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_missing_session',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'amount', p_amount, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;

        -- Case B: Malformed UUID
        BEGIN
            v_session_uuid := p_session_id::UUID;
        EXCEPTION WHEN OTHERS THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_malformed_session_uuid',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'session_id', p_session_id, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END;

        -- Case C: Session lookup
        SELECT * INTO v_session
        FROM public.arcade_sessions
        WHERE id = v_session_uuid
        FOR UPDATE;

        IF NOT FOUND THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_session_not_found',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'session_id', p_session_id, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;

        -- Case D: Session belonging to another player (Identity spoofing)
        IF LOWER(v_session.player_id) <> LOWER(v_actual_player_id) THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_stolen_session',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'session_id', p_session_id, 'session_owner', v_session.player_id, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;

        -- Case E: Inactive / Finished Session
        IF v_session.status <> 'in_progress' THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_inactive_session',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'session_id', p_session_id, 'session_status', v_session.status, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;

        -- Case F: Minimum survival duration (< 15 seconds)
        IF EXTRACT(EPOCH FROM (NOW() - COALESCE(v_session.started_at, v_session.created_at))) < 15 THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_premature_duration',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'session_id', p_session_id, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;

        -- Case G: Cooldown between drops (< 45 seconds)
        IF v_session.last_relic_dropped_at IS NOT NULL AND EXTRACT(EPOCH FROM (NOW() - v_session.last_relic_dropped_at)) < 45 THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_cooldown_active',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'session_id', p_session_id, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;

        -- Case H: Max 3 relics per session
        IF COALESCE(v_session.relics_dropped_count, 0) >= 3 THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_capacity_exceeded',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'session_id', p_session_id, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;

        -- Update session relic counters
        UPDATE public.arcade_sessions
        SET relics_dropped_count = COALESCE(relics_dropped_count, 0) + 1,
            last_relic_dropped_at = NOW()
        WHERE id = v_session_uuid;
    END IF;

    -- 5. Strict Whitelist Validation (Season 1 Only for Client Arcade Drops)
    -- Season 2 relics require explicit Master Admin passkey
    IF v_clean_relic_id NOT IN (
        -- AstroDodge (Serie 1)
        'relic_astrododge_prism', 'relic_astrododge_deflector', 'relic_astrododge_compass',
        -- Cyber Invaders (Serie 1)
        'relic_invaders_core', 'relic_invaders_dynamo', 'relic_invaders_transmitter',
        -- Cyber Drift (Serie 1)
        'relic_drift_chronometer', 'relic_drift_capacitor', 'relic_drift_overdrive',
        -- Cyber Stacker (Serie 1)
        'relic_stacker_foundation', 'relic_stacker_keystone', 'relic_stacker_monolith',
        -- PolySpace Fleet (Serie 1)
        'relic_space_darkmatter', 'relic_space_warpcoil', 'relic_space_plasma',
        -- Universal Apex (Serie 1)
        'relic_apex_singularity', 'relic_apex_genesis'
    ) THEN
        -- Allow Season 2 ONLY if admin passkey is verified
        IF v_is_admin AND v_clean_relic_id IN (
            'relic_exp1_a', 'relic_exp1_b', 'relic_exp1_c',
            'relic_exp2_a', 'relic_exp2_b', 'relic_exp2_c',
            'relic_exp3_a', 'relic_exp3_b', 'relic_exp3_c'
        ) THEN
            -- Allowed for Admin
            NULL;
        ELSE
            IF NOT v_is_internal AND NOT v_is_admin THEN
                PERFORM public.record_bot_warning(
                    v_actual_player_id,
                    'unauthorized_relic_probe_invalid_id',
                    'Relics System',
                    jsonb_build_object('relic_id', v_clean_relic_id, 'source', 'direct_rpc_probe')
                );
            END IF;
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;
    END IF;

    -- 6. Mythic Apex Relics restricted to PolySpace Deep Void (Internal) or Admin
    IF v_clean_relic_id IN ('relic_apex_singularity', 'relic_apex_genesis') AND NOT v_is_internal AND NOT v_is_admin THEN
        PERFORM public.record_bot_warning(
            v_actual_player_id,
            'unauthorized_apex_relic_probe',
            'Relics System',
            jsonb_build_object('relic_id', v_clean_relic_id, 'source', 'direct_rpc_probe')
        );
        RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
    END IF;

    -- 7. Persist to Player Ledger
    SELECT relics INTO v_current_relics
    FROM public.users
    WHERE player_id = v_actual_player_id
    FOR UPDATE;

    IF v_current_relics IS NULL THEN
        v_current_relics := '{}'::jsonb;
    END IF;

    IF v_current_relics ? v_clean_relic_id THEN
        v_relic_obj := v_current_relics -> v_clean_relic_id;
        v_total := COALESCE((v_relic_obj ->> 'total')::INT, 0) + COALESCE(p_amount, 1);
        v_unminted := COALESCE((v_relic_obj ->> 'unminted')::INT, 0) + COALESCE(p_amount, 1);
        v_onchain := COALESCE((v_relic_obj ->> 'onchain')::INT, 0);
        v_token_ids := COALESCE(v_relic_obj -> 'token_ids', '[]'::jsonb);
    ELSE
        v_total := COALESCE(p_amount, 1);
        v_unminted := COALESCE(p_amount, 1);
        v_onchain := 0;
        v_token_ids := '[]'::jsonb;
    END IF;

    v_updated_relics := jsonb_set(
        v_current_relics,
        ARRAY[v_clean_relic_id],
        jsonb_build_object(
            'total', v_total,
            'unminted', v_unminted,
            'onchain', v_onchain,
            'token_ids', v_token_ids
        )
    );

    UPDATE public.users
    SET relics = v_updated_relics,
        updated_at = NOW()
    WHERE player_id = v_actual_player_id;

    RETURN jsonb_build_object(
        'success', true,
        'relic_id', v_clean_relic_id,
        'added', COALESCE(p_amount, 1),
        'new_total', v_total,
        'relics', v_updated_relics
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_relic_drop(TEXT, TEXT, INT, TEXT, TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

