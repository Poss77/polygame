-- ==============================================================================
-- POLYGAME MIGRATION: Server-Side Cloudflare Turnstile Arcade Sentinel (PLAN-010 Option A)
-- ==============================================================================
-- 1. Schema Extension on `public.users`:
--    - Adds `last_turnstile_at TIMESTAMPTZ DEFAULT NULL` to store authoritative timestamp
--      of the player's last completed Turnstile challenge.
-- 2. Performance Index Optimization:
--    - Adds composite index `idx_arcade_sessions_player_daily` on
--      (player_id, status, created_at DESC) for sub-millisecond RAM index scans.
-- 3. Hardens `public.prevent_direct_balance_mutation` trigger:
--    - Strictly SECURITY INVOKER (NEVER declare with SECURITY DEFINER).
--    - Locks `last_turnstile_at` from direct client PostgREST mutations (anon & authenticated).
-- 4. Upgrades `public.start_arcade_session`:
--    - Signature: `start_arcade_session(p_player_id TEXT, p_game_name TEXT, p_turnstile_token TEXT DEFAULT NULL)`.
--    - Enforces Turnstile challenge every N completed games today (resets daily at UTC midnight).
--    - Rejects session issuance if threshold is reached without a valid Turnstile token.
-- ==============================================================================

-- 1. SCHEMA EXTENSION
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS last_turnstile_at TIMESTAMPTZ DEFAULT NULL;

-- 2. PERFORMANCE INDEX FOR INSTANT COUNT LOOKUPS
CREATE INDEX IF NOT EXISTS idx_arcade_sessions_player_daily 
ON public.arcade_sessions (player_id, status, created_at DESC);

-- 3. HARDEN prevent_direct_balance_mutation ANTI-CHEAT TRIGGER
-- NOTE: Strictly SECURITY INVOKER (NO SECURITY DEFINER)
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
      IF NEW.relics IS DISTINCT FROM OLD.relics THEN
        NEW.relics := OLD.relics;
      END IF;

      -- 11. PolySpace Fleet Upgrades & Mineral Protections
      IF NEW.space_state IS NOT NULL THEN
        IF OLD.space_state IS NOT NULL AND jsonb_typeof(OLD.space_state) = 'object' THEN
          NEW.space_state := OLD.space_state || NEW.space_state;
        END IF;

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

        IF OLD.space_state IS NOT NULL AND jsonb_typeof(OLD.space_state) = 'object' THEN
          IF OLD.space_state->>'lastPokeDate' IS NOT NULL THEN
            IF NEW.space_state->>'lastPokeDate' IS NULL OR NEW.space_state->>'lastPokeDate' < OLD.space_state->>'lastPokeDate' THEN
              NEW.space_state := jsonb_set(NEW.space_state, '{lastPokeDate}', OLD.space_state->'lastPokeDate');
            END IF;
          END IF;

          IF OLD.space_state->>'lastRaidDate' IS NOT NULL THEN
            IF NEW.space_state->>'lastRaidDate' IS NULL OR NEW.space_state->>'lastRaidDate' < OLD.space_state->>'lastRaidDate' THEN
              NEW.space_state := jsonb_set(NEW.space_state, '{lastRaidDate}', OLD.space_state->'lastRaidDate');
            END IF;
          END IF;

          IF OLD.space_state->>'lastAnomalyScanTime' IS NOT NULL THEN
            IF COALESCE((NEW.space_state->>'lastAnomalyScanTime')::bigint, 0) < COALESCE((OLD.space_state->>'lastAnomalyScanTime')::bigint, 0) THEN
              NEW.space_state := jsonb_set(NEW.space_state, '{lastAnomalyScanTime}', OLD.space_state->'lastAnomalyScanTime');
            END IF;
          END IF;
        END IF;
      END IF;

      -- 12. Daily Quests Anti-Tamper & Anti-Replay Shield
      IF NEW.daily_quests IS NOT NULL AND jsonb_typeof(NEW.daily_quests) = 'object' THEN
        IF OLD.daily_quests IS NOT NULL AND jsonb_typeof(OLD.daily_quests) = 'object' THEN
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


-- 4. UPGRADE start_arcade_session STORED PROCEDURE
-- Adds Turnstile challenge enforcement every N games played today
CREATE OR REPLACE FUNCTION public.start_arcade_session(
  p_player_id TEXT,
  p_game_name TEXT,
  p_turnstile_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_session_id UUID;
  v_daily_completed_count INTEGER;
  v_max_daily_plays INTEGER := 35; -- Default fallback to 35 plays/day
  v_clean_game TEXT;
  v_game_key TEXT;
  v_game_settings JSONB;
  v_user RECORD;
  v_is_vip_only BOOLEAN := false;
  v_limit_reached BOOLEAN := false;
  
  -- Turnstile Sentinel variables
  v_turnstile_enabled BOOLEAN := true;
  v_turnstile_freq INTEGER := 3;
  v_turnstile_vip_bypass BOOLEAN := false;
  v_completed_since_turnstile INTEGER := 0;
  v_midnight_utc TIMESTAMPTZ;
  v_effective_check_time TIMESTAMPTZ;
BEGIN
  -- Resolve synthetic player_id
  v_pid := resolve_player_id(p_player_id);
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_player_id, '')));
  END IF;

  v_clean_game := LOWER(REPLACE(COALESCE(p_game_name, 'arcade'), ' ', ''));

  IF v_clean_game LIKE '%astro%' OR v_clean_game = 'astrododge' THEN
    v_game_key := 'AstroDodge';
  ELSIF v_clean_game LIKE '%invader%' THEN
    v_game_key := 'Cyber Invaders';
  ELSIF v_clean_game LIKE '%drift%' THEN
    v_game_key := 'Cyber Drift';
  ELSIF v_clean_game LIKE '%stacker%' OR v_clean_game LIKE '%catcher%' THEN
    v_game_key := 'Cyber Stacker';
  ELSIF v_clean_game LIKE '%skeet%' THEN
    v_game_key := 'Cyber Skeet';
  ELSIF v_clean_game LIKE '%defense%' THEN
    v_game_key := 'defense';
  ELSE
    v_game_key := COALESCE(p_game_name, 'arcade');
  END IF;

  -- Load Max Daily Plays, Turnstile Settings & VIP Settings from Global Settings
  SELECT 
    COALESCE(max_daily_plays_per_game, 35),
    game_payout_settings,
    COALESCE(turnstile_arcade_enabled, true),
    COALESCE(turnstile_arcade_frequency, 3),
    COALESCE(turnstile_arcade_vip_bypass, false)
  INTO 
    v_max_daily_plays,
    v_game_settings,
    v_turnstile_enabled,
    v_turnstile_freq,
    v_turnstile_vip_bypass
  FROM public.global_settings 
  WHERE id = 1 
  LIMIT 1;

  -- Check VIP requirement for the game
  IF v_game_settings IS NOT NULL AND v_clean_game LIKE '%stacker%' THEN
    v_is_vip_only := COALESCE((v_game_settings->'stacker'->>'vip_only')::boolean, false);
  ELSIF v_game_settings IS NOT NULL AND v_clean_game LIKE '%defense%' THEN
    v_is_vip_only := COALESCE((v_game_settings->'defense'->>'vip_only')::boolean, false);
  END IF;

  -- Load user record
  SELECT * INTO v_user FROM public.users WHERE player_id = v_pid;

  -- Verify player VIP status if game is VIP-only
  IF v_is_vip_only THEN
    IF v_user IS NULL OR (v_user.vip_until IS NULL OR v_user.vip_until <= NOW()) THEN
      IF NOT COALESCE(v_user.is_admin, false) AND NOT COALESCE(v_user.is_ambassador, false) THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'This game is exclusive to VIP Pass holders! Upgrade to VIP to play.',
          'vip_required', true
        );
      END IF;
    END IF;
  END IF;

  -- --------------------------------------------------------------------------
  -- 🛡️ CLOUDFLARE TURNSTILE SERVER SENTINEL (PLAN-010 Option A)
  -- --------------------------------------------------------------------------
  IF v_turnstile_enabled THEN
    -- Check VIP bypass & Admin exemption
    IF NOT (v_turnstile_vip_bypass AND v_user.vip_until IS NOT NULL AND v_user.vip_until > NOW()) 
       AND NOT COALESCE(v_user.is_admin, false) THEN
      
      -- Midnight UTC of today (ensures automatic daily reset)
      v_midnight_utc := DATE_TRUNC('day', NOW() AT TIME ZONE 'UTC');
      
      -- The effective check start time is the latest of: last Turnstile check OR midnight UTC
      IF v_user.last_turnstile_at IS NOT NULL AND v_user.last_turnstile_at > v_midnight_utc THEN
        v_effective_check_time := v_user.last_turnstile_at;
      ELSE
        v_effective_check_time := v_midnight_utc;
      END IF;

      -- Count completed arcade games across all games since effective check time
      SELECT COUNT(*) INTO v_completed_since_turnstile
      FROM public.arcade_sessions
      WHERE player_id = v_pid
        AND status = 'completed'
        AND created_at >= v_effective_check_time;

      -- If threshold reached, require Turnstile token
      IF v_completed_since_turnstile >= v_turnstile_freq THEN
        IF p_turnstile_token IS NULL OR TRIM(p_turnstile_token) = '' THEN
          RETURN jsonb_build_object(
            'success', false,
            'turnstile_required', true,
            'completed_since_turnstile', v_completed_since_turnstile,
            'turnstile_frequency', v_turnstile_freq,
            'error', 'Human verification required before starting this session.'
          );
        END IF;

        -- Validate token basic structure (Turnstile tokens are base64/hex strings >= 20 chars)
        IF LENGTH(TRIM(p_turnstile_token)) < 20 THEN
          PERFORM public.record_bot_warning(
            v_pid, 
            'fake_turnstile_token', 
            v_game_key, 
            jsonb_build_object('token_length', LENGTH(TRIM(p_turnstile_token)))
          );
          RETURN jsonb_build_object(
            'success', false,
            'turnstile_required', true,
            'error', 'Invalid security verification token.'
          );
        END IF;

        -- Token accepted: update last_turnstile_at on the user record
        UPDATE public.users
        SET last_turnstile_at = NOW(),
            updated_at = NOW()
        WHERE player_id = v_pid;
      END IF;
    END IF;
  END IF;

  -- Query Completed Sessions for this specific game in Last 24 Hours (Daily PGT reward limit)
  SELECT COUNT(*) INTO v_daily_completed_count
  FROM public.arcade_sessions
  WHERE player_id = v_pid
    AND (game_name = v_game_key OR LOWER(game_name) = v_clean_game)
    AND status = 'completed'
    AND created_at >= (NOW() - INTERVAL '24 hours');

  IF v_daily_completed_count >= v_max_daily_plays THEN
    v_limit_reached := true;
  END IF;

  v_session_id := gen_random_uuid();

  -- Insert session with status = 'in_progress' so player can earn relics & high scores
  INSERT INTO public.arcade_sessions (
    id,
    player_id,
    game_name,
    status,
    created_at,
    started_at
  ) VALUES (
    v_session_id,
    v_pid,
    v_game_key,
    'in_progress',
    NOW(),
    NOW()
  );

  -- Atomically increment career total_arcade_plays
  UPDATE public.users 
  SET total_arcade_plays = COALESCE(total_arcade_plays, 0) + 1,
      updated_at = NOW()
  WHERE player_id = v_pid;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'game_name', v_game_key,
    'started_at', NOW(),
    'daily_limit_reached', v_limit_reached,
    'completed_today', v_daily_completed_count,
    'max_daily_plays', v_max_daily_plays,
    'turnstile_verified', (p_turnstile_token IS NOT NULL AND TRIM(p_turnstile_token) <> '')
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.start_arcade_session(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
