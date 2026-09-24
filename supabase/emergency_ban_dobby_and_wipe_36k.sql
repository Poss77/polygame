-- ==============================================================================
-- POLYGON GAMING EMERGENCY REMEDIATION: BAN DOBBY & WIPE 36K EXPLOITED BALANCE
-- Target Account:
--   Player ID: 0xpgt003e7625
--   Wallet:    0x602bec371e2a99f679c73a5930a590cebf8e7696
-- Target Actions:
--   1. Reset Dobby's balance (36,416.49 PGT) and staked balance to 0.00 PGT.
--   2. Enforce permanent ban on Dobby's account (is_banned = true, bot_warning = 99).
--   3. Wipe Dobby's exploited space minerals & fake mined PGT (pgtMinedTotal = 0).
--   4. Purge all 488 fraudulent bet_wins and mines_sessions from today.
--   5. Upgrade assert_caller_player_id to enforce ban checks on authenticated sessions.
--   6. Upgrade prevent_direct_balance_mutation (SECURITY INVOKER) to lock space_state->'expeditions'.
--   7. Upgrade start_mines_game with 5,000 PGT cap and ban checks.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: Wipe Dobby's Balance, Staked PGT, Reset Space Minerals, Enforce Ban
-- ------------------------------------------------------------------------------
UPDATE public.users
SET 
  balance_pgt = 0.0,
  staked_balance_pgt = 0.0,
  is_banned = true,
  bot_warning = 99,
  space_state = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              COALESCE(space_state, '{}'::jsonb),
              '{iron}', '50'::jsonb
            ),
            '{titanium}', '10'::jsonb
          ),
          '{quantum}', '0'::jsonb
        ),
        '{pgtOre}', '0'::jsonb
      ),
      '{pgtMinedTotal}', '0'::jsonb
    ),
    '{expeditions}', '[]'::jsonb
  ),
  updated_at = NOW()
WHERE player_id = '0xpgt003e7625'
   OR LOWER(COALESCE(linked_wallet_address, '')) = '0x602bec371e2a99f679c73a5930a590cebf8e7696';

-- Deactivate active stakes for Dobby
UPDATE public.user_stakes
SET active = false
WHERE LOWER(wallet_address) = '0xpgt003e7625'
   OR LOWER(wallet_address) = '0x602bec371e2a99f679c73a5930a590cebf8e7696';

-- ------------------------------------------------------------------------------
-- STEP 2: Purge Fraudulent Bets & Mines Sessions from Today (2026-09-24)
-- ------------------------------------------------------------------------------
DELETE FROM public.bet_wins
WHERE (player_id = '0xpgt003e7625' OR LOWER(wallet_address) = '0xpgt003e7625' OR LOWER(wallet_address) = '0x602bec371e2a99f679c73a5930a590cebf8e7696')
  AND created_at >= '2026-09-24T00:00:00Z';

DELETE FROM public.mines_sessions
WHERE (player_id = '0xpgt003e7625' OR LOWER(wallet_address) = '0xpgt003e7625' OR LOWER(wallet_address) = '0x602bec371e2a99f679c73a5930a590cebf8e7696')
  AND created_at >= '2026-09-24T00:00:00Z';

-- ------------------------------------------------------------------------------
-- STEP 3: Upgrade assert_caller_player_id (Enforces Ban on Authenticated Users)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.assert_caller_player_id(TEXT);
DROP FUNCTION IF EXISTS assert_caller_player_id(TEXT);
CREATE OR REPLACE FUNCTION public.assert_caller_player_id(
  p_target_id TEXT,
  OUT p_status TEXT,       -- 'OK', 'UNAUTHENTICATED', 'PROFILE_NOT_FOUND', 'MISMATCH', 'ACCOUNT_BANNED'
  OUT p_player_id TEXT,    -- The verified player_id of the caller
  OUT p_error_msg TEXT     -- User-facing error message
)
RETURNS RECORD
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role TEXT := auth.role();
  v_auth_uid UUID := auth.uid();
  v_caller_pid TEXT;
  v_resolved_target TEXT;
  v_target_auth_uid UUID;
  v_target_wallet TEXT;
  v_target_is_banned BOOLEAN;
BEGIN
  -- 1. Service role or internal server execution without JWT:
  IF v_role = 'service_role' OR (v_role IS NULL AND v_auth_uid IS NULL) THEN
    p_status := 'OK';
    p_player_id := public.resolve_player_id(p_target_id);
    p_error_msg := NULL;
    RETURN;
  END IF;

  -- 2. Authenticated user with active Supabase Auth session (Google OAuth):
  IF v_auth_uid IS NOT NULL THEN
    SELECT player_id, COALESCE(is_banned, false) INTO v_caller_pid, v_target_is_banned
    FROM public.users
    WHERE user_id = v_auth_uid
    LIMIT 1;

    IF v_caller_pid IS NULL THEN
      p_status := 'PROFILE_NOT_FOUND';
      p_player_id := NULL;
      p_error_msg := 'PROFILE_NOT_FOUND: User profile does not exist for this session.';
      RETURN;
    END IF;

    -- Enforce ban check on authenticated sessions
    IF v_target_is_banned THEN
      p_status := 'ACCOUNT_BANNED';
      p_player_id := v_caller_pid;
      p_error_msg := 'ACCOUNT_BANNED: Your account has been permanently suspended.';
      RETURN;
    END IF;

    -- Anti-Framing Assertion:
    -- If target ID was passed by client, it MUST resolve to the caller's own player_id.
    IF p_target_id IS NOT NULL AND TRIM(p_target_id) <> '' THEN
      v_resolved_target := public.resolve_player_id(p_target_id);
      IF v_resolved_target IS NOT NULL AND LOWER(v_resolved_target) <> LOWER(v_caller_pid) THEN
        -- Framing / impersonation attempt:
        PERFORM public.record_bot_warning(
          v_caller_pid,
          'identity_impersonation_attempt',
          'Security Sentinel',
          jsonb_build_object('attempted_target', p_target_id, 'resolved_target', v_resolved_target)
        );
        p_status := 'MISMATCH';
        p_player_id := v_caller_pid;
        p_error_msg := 'SECURITY_VIOLATION: You cannot perform actions on behalf of another player.';
        RETURN;
      END IF;
    END IF;

    p_status := 'OK';
    p_player_id := v_caller_pid;
    p_error_msg := NULL;
    RETURN;
  END IF;

  -- 3. Anonymous Web3 Wallet / Guest Caller (v_auth_uid IS NULL):
  IF p_target_id IS NULL OR TRIM(p_target_id) = '' THEN
    p_status := 'UNAUTHENTICATED';
    p_player_id := NULL;
    p_error_msg := 'UNAUTHENTICATED: Target player ID is required.';
    RETURN;
  END IF;

  v_resolved_target := public.resolve_player_id(p_target_id);

  IF v_resolved_target IS NULL THEN
    IF LOWER(p_target_id) LIKE '0xguest%' THEN
      p_status := 'OK';
      p_player_id := LOWER(TRIM(p_target_id));
      p_error_msg := NULL;
      RETURN;
    END IF;

    p_status := 'PROFILE_NOT_FOUND';
    p_player_id := NULL;
    p_error_msg := 'PROFILE_NOT_FOUND: Account not found.';
    RETURN;
  END IF;

  SELECT user_id, linked_wallet_address, COALESCE(is_banned, false)
  INTO v_target_auth_uid, v_target_wallet, v_target_is_banned
  FROM public.users
  WHERE player_id = v_resolved_target
  LIMIT 1;

  IF v_target_is_banned THEN
    p_status := 'ACCOUNT_BANNED';
    p_player_id := v_resolved_target;
    p_error_msg := 'ACCOUNT_BANNED: Your account has been permanently suspended.';
    RETURN;
  END IF;

  p_status := 'OK';
  p_player_id := v_resolved_target;
  p_error_msg := NULL;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_caller_player_id(TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- STEP 4: Upgrade start_mines_game (5,000 PGT Max Bet & Ban Check)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.start_mines_game(TEXT, NUMERIC, INT);
DROP FUNCTION IF EXISTS start_mines_game(TEXT, NUMERIC, INT);
CREATE OR REPLACE FUNCTION start_mines_game(
  p_wallet TEXT,
  p_bet NUMERIC,
  p_mines INT DEFAULT 3
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_balance NUMERIC;
  v_is_banned BOOLEAN;
  v_mines_count INT := GREATEST(1, LEAST(24, COALESCE(p_mines, 3)));
  v_mine_positions INT[] := '{}';
  v_pos INT;
  v_session_id BIGINT;
  v_next_mult NUMERIC;
  v_new_jackpot NUMERIC;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  IF p_bet < 10 THEN RETURN jsonb_build_object('success', false, 'error', 'Minimum bet is 10 PGT'); END IF;
  IF p_bet > 5000 THEN RETURN jsonb_build_object('success', false, 'error', 'Maximum bet is 5,000 PGT'); END IF;

  -- Lock user row and check balance & ban status
  SELECT balance_pgt, COALESCE(is_banned, false) INTO v_balance, v_is_banned 
  FROM users 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid) 
  FOR UPDATE;

  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'User row not found'); END IF;
  IF v_is_banned THEN RETURN jsonb_build_object('success', false, 'error', 'Account is suspended'); END IF;
  IF v_balance < p_bet THEN RETURN jsonb_build_object('success', false, 'error', 'Insufficient PGT balance'); END IF;

  -- Deduct bet upfront immediately
  UPDATE users 
  SET balance_pgt = balance_pgt - p_bet, updated_at = NOW() 
  WHERE LOWER(player_id) = LOWER(v_pid) OR LOWER(linked_wallet_address) = LOWER(v_pid);

  -- 1% of bet contributed to Global Progressive Jackpot
  UPDATE global_jackpot 
  SET amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
      current_amount = GREATEST(COALESCE(amount, 0), COALESCE(current_amount, 0), 2000) + (p_bet * 0.01),
      updated_at = NOW()
  WHERE id = 1
  RETURNING COALESCE(current_amount, amount) INTO v_new_jackpot;

  -- Expire any previous unclosed active sessions for this player
  UPDATE mines_sessions
  SET status = 'busted', updated_at = NOW()
  WHERE (LOWER(player_id) = LOWER(v_pid) OR LOWER(wallet_address) = LOWER(v_pid))
    AND status = 'active';

  -- Generate M distinct random mine coordinates (0..24)
  WHILE array_length(v_mine_positions, 1) IS NULL OR array_length(v_mine_positions, 1) < v_mines_count LOOP
    v_pos := FLOOR(random() * 25)::INT;
    IF NOT (v_mine_positions @> ARRAY[v_pos]) THEN
      v_mine_positions := array_append(v_mine_positions, v_pos);
    END IF;
  END LOOP;

  -- Calculate first step multiplier preview (94% RTP with 1,000x cap)
  v_next_mult := compute_mines_multiplier(v_mines_count, 1, 0.94);

  -- Create active session in DB
  INSERT INTO mines_sessions (
    player_id,
    wallet_address,
    bet_amount,
    mines_count,
    mine_positions,
    revealed_tiles,
    current_multiplier,
    status,
    created_at,
    updated_at
  ) VALUES (
    v_pid,
    p_wallet,
    p_bet,
    v_mines_count,
    v_mine_positions,
    '{}',
    1.00,
    'active',
    NOW(),
    NOW()
  ) RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'mines_count', v_mines_count,
    'next_multiplier', v_next_mult,
    'jackpot_amount', v_new_jackpot
  );
END;
$$;

GRANT EXECUTE ON FUNCTION start_mines_game(TEXT, NUMERIC, INT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION start_mines_game(TEXT, NUMERIC, INT) FROM anon;

-- ------------------------------------------------------------------------------
-- STEP 5: Upgrade prevent_direct_balance_mutation (Immutable Expeditions Shield)
-- CRITICAL SECURITY INVARIANT: STRICTLY NO SECURITY DEFINER (Runs as SECURITY INVOKER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT;
  v_today TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
BEGIN
  -- Restrict direct PostgREST client queries (anon & authenticated roles)
  -- Legitimate SECURITY DEFINER procedures run as 'postgres' and bypass this check.
  IF LOWER(CURRENT_USER) IN ('anon', 'authenticated') THEN

    IF TG_OP = 'INSERT' THEN
      -- 1. Anti-Bot Registration Guard: Reject automated test fixtures
      IF NEW.auth_provider IS NOT NULL AND (NEW.auth_provider ILIKE '%fixture%' OR NEW.auth_provider ILIKE '%__test%') THEN
        RAISE EXCEPTION 'REGISTRATION_REJECTED: Test fixtures disallowed in production.';
      END IF;

      -- Player ID must start with 0x and be at least 5 characters
      IF NEW.player_id IS NULL 
         OR NEW.player_id ILIKE 'test_%'
         OR NEW.player_id NOT ILIKE '0x%'
         OR LENGTH(NEW.player_id) < 5 THEN
        RAISE EXCEPTION 'REGISTRATION_REJECTED: Invalid player ID format.';
      END IF;

      IF NEW.username IS NOT NULL AND NEW.username ILIKE '%__test__%' THEN
        RAISE EXCEPTION 'REGISTRATION_REJECTED: Test fixtures disallowed in production.';
      END IF;

      IF NEW.linked_wallet_address IS NOT NULL AND NEW.linked_wallet_address <> '' THEN
        IF NEW.linked_wallet_address ~ '00000000000000000000' THEN
          RAISE EXCEPTION 'REGISTRATION_REJECTED: Dummy wallet address rejected.';
        END IF;
      END IF;

      -- 2. Sanitize newly inserted accounts against elevated balances & privileges
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
      NEW.daily_quests := jsonb_build_object(
        'date', v_today,
        'games', 0, 'mining', 0, 'wins', 0,
        'games_claimed', false, 'mining_claimed', false, 'wins_claimed', false,
        'master_claimed', false, 'streak_days', 0, 'last_streak_date', ''
      );

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

      -- 4. Immutable career total_arcade_plays
      IF NEW.total_arcade_plays IS DISTINCT FROM OLD.total_arcade_plays THEN
        NEW.total_arcade_plays := OLD.total_arcade_plays;
      END IF;

      -- 5. Immutable career total_earned
      IF NEW.total_earned IS DISTINCT FROM OLD.total_earned THEN
        NEW.total_earned := OLD.total_earned;
      END IF;

      -- 6. Immutable Faucet & Weekly active tier counters
      IF NEW.last_faucet_claim IS DISTINCT FROM OLD.last_faucet_claim THEN
        NEW.last_faucet_claim := OLD.last_faucet_claim;
      END IF;
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
      IF NEW.faucet_streak IS DISTINCT FROM OLD.faucet_streak THEN
        NEW.faucet_streak := OLD.faucet_streak;
      END IF;
      IF NEW.vip_faucet_streak IS DISTINCT FROM OLD.vip_faucet_streak THEN
        NEW.vip_faucet_streak := OLD.vip_faucet_streak;
      END IF;
      IF NEW.last_vip_faucet_claim IS DISTINCT FROM OLD.last_vip_faucet_claim THEN
        NEW.last_vip_faucet_claim := OLD.last_vip_faucet_claim;
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

      IF OLD.referral_code IS NOT NULL AND OLD.referral_code <> '' AND OLD.referral_code <> 'EMPTY' THEN
        IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
          NEW.referral_code := OLD.referral_code;
        END IF;
      END IF;

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

      -- 10. Immutable Relics Inventory
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

        -- 11c. Space Career Statistics
        IF COALESCE((NEW.space_state->>'raidsWon')::numeric, 0) > COALESCE((OLD.space_state->>'raidsWon')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{raidsWon}', to_jsonb(COALESCE((OLD.space_state->>'raidsWon')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'pgtMinedTotal')::numeric, 0) > COALESCE((OLD.space_state->>'pgtMinedTotal')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{pgtMinedTotal}', to_jsonb(COALESCE((OLD.space_state->>'pgtMinedTotal')::numeric, 0)));
        END IF;
        IF COALESCE((NEW.space_state->>'mineralsMinedTotal')::numeric, 0) > COALESCE((OLD.space_state->>'mineralsMinedTotal')::numeric, 0) THEN
          NEW.space_state := jsonb_set(NEW.space_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((OLD.space_state->>'mineralsMinedTotal')::numeric, 0)));
        END IF;

        -- 11d. Fleet Power
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

        -- 11e. Protect Outpost & Deep-Space Cooldowns
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

          -- 11f. Immutable Fleet Expeditions (Server RPC Controlled Only)
          IF OLD.space_state IS NOT NULL AND jsonb_typeof(OLD.space_state) = 'object' THEN
            NEW.space_state := jsonb_set(NEW.space_state, '{expeditions}', COALESCE(OLD.space_state->'expeditions', '[]'::jsonb));
          END IF;
        END IF;
      END IF;

      -- 12. Immutable Daily Quests
      IF NEW.daily_quests IS DISTINCT FROM OLD.daily_quests THEN
        NEW.daily_quests := OLD.daily_quests;
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger is bound to public.users
DROP TRIGGER IF EXISTS trg_prevent_direct_balance_mutation ON public.users;
CREATE TRIGGER trg_prevent_direct_balance_mutation
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_balance_mutation();

-- ------------------------------------------------------------------------------
-- STEP 6: Verification Query
-- ------------------------------------------------------------------------------
SELECT player_id, linked_wallet_address, balance_pgt, staked_balance_pgt, is_banned, bot_warning, space_state->'pgtMinedTotal' as pgt_mined
FROM public.users
WHERE player_id = '0xpgt003e7625';
