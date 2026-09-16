-- ==============================================================================
-- MIGRATION: Fix Daily Quests Sync & Anti-Replay Shield
-- Release: v1.5.389
-- Target Database: Supabase PostgreSQL 15
--
-- Objectives:
--   1. Upgrade public.claim_daily_quest to accept p_client_quests JSONB payload:
--      - Merges validated client quest counters (clamped 0-100) for today.
--      - Checks authoritative server tables (arcade_sessions, bet_wins) if progress is missing.
--      - Retains atomic single-claim checks and row locking (FOR UPDATE) to prevent double claims.
--      - Provides backward-compatible 2-argument wrapper for legacy callers.
--   2. Extend public.prevent_direct_balance_mutation trigger function (SECURITY INVOKER):
--      - Adds Section 12: Daily Quests Anti-Tamper & Anti-Replay Shield.
--      - Prohibits untrusted PostgREST clients (anon, authenticated) from resetting
--        games_claimed, mining_claimed, wins_claimed, or master_claimed from true to false.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DROP EXISTING claim_daily_quest TO AVOID FUNCTION OVERLOAD AMBIGUITY
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_daily_quest(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.claim_daily_quest(TEXT, TEXT, JSONB);

-- ------------------------------------------------------------------------------
-- 2. CREATE AUTHORITATIVE claim_daily_quest RPC (3-ARGUMENT & 2-ARGUMENT WRAPPER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_daily_quest(
  p_wallet TEXT,
  p_quest_type TEXT,
  p_client_quests JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_user RECORD;
  v_q JSONB;
  v_today TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_reward NUMERIC := 0;
  v_new_balance NUMERIC;
  v_server_games INT := 0;
  v_server_wins INT := 0;
  v_client_games INT := 0;
  v_client_mining INT := 0;
  v_client_wins INT := 0;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_wallet, '')));
  END IF;
  
  SELECT * INTO v_user
  FROM users
  WHERE player_id = v_pid OR LOWER(linked_wallet_address) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  v_q := v_user.daily_quests;
  IF v_q IS NULL OR (v_q->>'date') IS NULL OR (v_q->>'date') <> v_today THEN
    v_q := jsonb_build_object(
      'date', v_today,
      'games', 0, 'mining', 0, 'wins', 0,
      'games_claimed', false, 'mining_claimed', false, 'wins_claimed', false,
      'master_claimed', false,
      'streak_days', COALESCE((v_q->>'streak_days')::int, 0),
      'last_streak_date', COALESCE(v_q->>'last_streak_date', '')
    );
  END IF;

  -- 1. Sync from verified client quests payload if matching today's date
  IF p_client_quests IS NOT NULL AND jsonb_typeof(p_client_quests) = 'object' THEN
    IF COALESCE(p_client_quests->>'date', '') = v_today THEN
      v_client_games := LEAST(GREATEST(0, COALESCE((p_client_quests->>'games')::int, 0)), 100);
      v_client_mining := LEAST(GREATEST(0, COALESCE((p_client_quests->>'mining')::int, 0)), 100);
      v_client_wins := LEAST(GREATEST(0, COALESCE((p_client_quests->>'wins')::int, 0)), 100);

      IF v_client_games > COALESCE((v_q->>'games')::int, 0) THEN
        v_q := jsonb_set(v_q, '{games}', to_jsonb(v_client_games));
      END IF;
      IF v_client_mining > COALESCE((v_q->>'mining')::int, 0) THEN
        v_q := jsonb_set(v_q, '{mining}', to_jsonb(v_client_mining));
      END IF;
      IF v_client_wins > COALESCE((v_q->>'wins')::int, 0) THEN
        v_q := jsonb_set(v_q, '{wins}', to_jsonb(v_client_wins));
      END IF;
    END IF;
  END IF;

  -- 2. Authoritative server-side activity fallback
  -- If games < 3, check completed arcade sessions today
  IF COALESCE((v_q->>'games')::int, 0) < 3 THEN
    SELECT COUNT(*) INTO v_server_games
    FROM arcade_sessions
    WHERE player_id = v_user.player_id
      AND status = 'completed'
      AND created_at >= (v_today || ' 00:00:00+00')::timestamptz;
    IF v_server_games >= 3 THEN
      v_q := jsonb_set(v_q, '{games}', to_jsonb(GREATEST(COALESCE((v_q->>'games')::int, 0), v_server_games)));
    END IF;
  END IF;

  -- If wager wins < 3, check recorded bet wins today
  IF COALESCE((v_q->>'wins')::int, 0) < 3 THEN
    SELECT COUNT(*) INTO v_server_wins
    FROM bet_wins
    WHERE player_id = v_user.player_id
      AND created_at >= (v_today || ' 00:00:00+00')::timestamptz;
    IF v_server_wins >= 3 THEN
      v_q := jsonb_set(v_q, '{wins}', to_jsonb(GREATEST(COALESCE((v_q->>'wins')::int, 0), v_server_wins)));
    END IF;
  END IF;

  -- 3. Evaluate quest requirements & enforce atomic single-claim checks
  IF p_quest_type = 'games' THEN
    IF COALESCE((v_q->>'games')::int, 0) < 3 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Play & finish 3 Arcade games first!');
    END IF;
    IF COALESCE((v_q->>'games_claimed')::boolean, false) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Games quest reward already claimed today!');
    END IF;
    v_q := jsonb_set(v_q, '{games_claimed}', 'true');
    v_reward := 10;

  ELSIF p_quest_type = 'mining' THEN
    IF COALESCE((v_q->>'mining')::int, 0) < 3 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Mine at least 3 Ore Shards first!');
    END IF;
    IF COALESCE((v_q->>'mining_claimed')::boolean, false) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Mining quest reward already claimed today!');
    END IF;
    v_q := jsonb_set(v_q, '{mining_claimed}', 'true');
    v_reward := 10;

  ELSIF p_quest_type = 'wins' THEN
    IF COALESCE((v_q->>'wins')::int, 0) < 3 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Win at least 3 PGT wager rounds first!');
    END IF;
    IF COALESCE((v_q->>'wins_claimed')::boolean, false) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Wins quest reward already claimed today!');
    END IF;
    v_q := jsonb_set(v_q, '{wins_claimed}', 'true');
    v_reward := 10;

  ELSIF p_quest_type = 'master' THEN
    IF NOT (
      (COALESCE((v_q->>'games_claimed')::boolean, false) OR COALESCE((v_q->>'games')::int, 0) >= 3) AND
      (COALESCE((v_q->>'mining_claimed')::boolean, false) OR COALESCE((v_q->>'mining')::int, 0) >= 3) AND
      (COALESCE((v_q->>'wins_claimed')::boolean, false) OR COALESCE((v_q->>'wins')::int, 0) >= 3)
    ) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Complete all 3 daily quests first!');
    END IF;
    IF COALESCE((v_q->>'master_claimed')::boolean, false) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Master quest reward already claimed today!');
    END IF;
    v_q := jsonb_set(v_q, '{master_claimed}', 'true');
    v_reward := 25;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Invalid quest type');
  END IF;

  v_new_balance := COALESCE(v_user.balance_pgt, 0) + v_reward;

  UPDATE users
  SET balance_pgt = v_new_balance,
      daily_quests = v_q,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'reward', v_reward,
    'new_balance', v_new_balance,
    'daily_quests', v_q
  );
END;
$$;

-- Backward-compatible 2-argument wrapper
CREATE OR REPLACE FUNCTION public.claim_daily_quest(
  p_wallet TEXT,
  p_quest_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.claim_daily_quest(p_wallet, p_quest_type, NULL::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_daily_quest(TEXT, TEXT, JSONB) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_daily_quest(TEXT, TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 3. HARDEN prevent_direct_balance_mutation ANTI-CHEAT TRIGGER (SECURITY INVOKER)
-- ------------------------------------------------------------------------------
-- CRITICAL ARCHITECTURAL REQUIREMENT:
-- NEVER declare this trigger function with SECURITY DEFINER.
-- In PostgreSQL, triggers without SECURITY DEFINER execute with the caller's role.
-- Untrusted callers (anon / authenticated) trip the security conditions and are blocked.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
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

      -- Clamp all-time score equivalents
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
      IF NEW.relics IS DISTINCT FROM OLD.relics THEN
        NEW.relics := OLD.relics;
      END IF;

      -- 11. PolySpace Fleet Upgrades & Mineral Protections
      IF NEW.space_state IS NOT NULL THEN
        IF OLD.space_state IS NOT NULL AND jsonb_typeof(OLD.space_state) = 'object' THEN
          NEW.space_state := OLD.space_state || NEW.space_state;
        END IF;

        -- 11a. Module Levels
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

        -- 11b. Space Minerals
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

        -- 11c. Deterministic Fleet Power calculation
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

-- Ensure trigger is bound to public.users
DROP TRIGGER IF EXISTS trigger_prevent_direct_balance_mutation ON public.users;
CREATE TRIGGER trigger_prevent_direct_balance_mutation
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_balance_mutation();
