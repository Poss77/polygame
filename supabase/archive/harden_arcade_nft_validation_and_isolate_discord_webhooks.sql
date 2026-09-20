-- ==============================================================================
-- POLYGAME SECURITY HARDENING MIGRATION (v1.5.398)
-- 1. Server-Side NFT & Relic Validation in end_arcade_session
--    - Closes client multiplier spoofing (e.g. nft=10000 or relic=100)
--    - Authoritatively calculates NFT multiplier from users.owned_nfts + crate_nfts
--    - Authoritatively calculates Relic multiplier from is_season1_apex_unlocked(users.relics)
-- 2. Discord Webhooks Isolation & Protection
--    - Creates public.admin_discord_secrets with strict Row Level Security (RLS)
--    - Purges Discord Webhook URLs from public.global_settings
--    - Provides secure Master Admin RPCs to get and update webhook configurations
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: Create Secure Table for Discord Webhook Secrets & Migrate Existing URLs
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_discord_secrets (
  id INTEGER PRIMARY KEY DEFAULT 1,
  discord_webhook_url TEXT,
  discord_admin_webhook_url TEXT,
  discord_announcements_webhook_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS: No public SELECT or UPDATE policies are created.
-- PostgREST clients (anon, authenticated) CANNOT query this table directly.
ALTER TABLE public.admin_discord_secrets ENABLE ROW LEVEL SECURITY;

-- Migrate any existing configured webhook URLs from global_settings
INSERT INTO public.admin_discord_secrets (id, discord_webhook_url, discord_admin_webhook_url, discord_announcements_webhook_url, updated_at)
SELECT 1, discord_webhook_url, discord_admin_webhook_url, discord_announcements_webhook_url, NOW()
FROM public.global_settings
WHERE id = 1
ON CONFLICT (id) DO UPDATE
SET discord_webhook_url = COALESCE(EXCLUDED.discord_webhook_url, admin_discord_secrets.discord_webhook_url),
    discord_admin_webhook_url = COALESCE(EXCLUDED.discord_admin_webhook_url, admin_discord_secrets.discord_admin_webhook_url),
    discord_announcements_webhook_url = COALESCE(EXCLUDED.discord_announcements_webhook_url, admin_discord_secrets.discord_announcements_webhook_url),
    updated_at = NOW();

-- Clear public exposure of webhooks from global_settings
UPDATE public.global_settings
SET discord_webhook_url = NULL,
    discord_admin_webhook_url = NULL,
    discord_announcements_webhook_url = NULL
WHERE id = 1;

-- ------------------------------------------------------------------------------
-- STEP 2: Secure Master Admin RPCs to Read & Update Discord Webhook Secrets
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
-- STEP 3: Upgrade end_arcade_session with Authoritative Server-Side NFT & Relic Validation
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.end_arcade_session(
  p_player_id TEXT,
  p_session_id TEXT,
  p_score INTEGER,
  p_bonus_items INTEGER DEFAULT 0,
  p_bonus_tokens INTEGER DEFAULT 0,
  p_nft_multiplier NUMERIC DEFAULT 1.0,
  p_relic_multiplier NUMERIC DEFAULT 1.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_session RECORD;
  v_now TIMESTAMPTZ;
  v_duration_seconds INTEGER;
  v_session_uuid UUID;
  v_clamped_score INTEGER;
  v_clamped_items INTEGER;
  v_clamped_tokens INTEGER;
  v_all_nfts JSONB;
  v_server_nft_bonus_pct NUMERIC := 0.0;
  v_authoritative_nft_mult NUMERIC := 1.0;
  v_clamped_nft_mult NUMERIC;
  v_user RECORD;
  v_vip_mult NUMERIC;
  v_amb_mult NUMERIC;
  v_relic_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC;
  v_raw_pgt NUMERIC;
  v_bonus_token_pgt NUMERIC := 0.0;
  v_final_pgt NUMERIC;
  v_new_balance NUMERIC;
  v_game_name TEXT;
  v_game_clean TEXT;
  v_game_key TEXT;
  v_is_new_high BOOLEAN;
  v_max_daily_plays INTEGER;
  v_daily_completed_count INTEGER;
  v_global_earn_mult NUMERIC := 1.0;
  v_game_settings JSONB;
  v_harvest_enabled BOOLEAN := true;
  v_limit_reached BOOLEAN := false;
  v_new_weekly_games INTEGER := 0;
  v_current_weekly_faucets INTEGER := 0;
  v_new_weekly_tier INTEGER := 0;
  v_max_velocity_rate NUMERIC := 0.75;
  v_velocity_cap NUMERIC := 0.0;
BEGIN
  v_pid := resolve_player_id(p_player_id);
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(COALESCE(p_player_id, ''))); 
  END IF;

  v_now := NOW();
  v_clamped_score := GREATEST(0, COALESCE(p_score, 0));
  v_clamped_items := GREATEST(0, COALESCE(p_bonus_items, 0));
  -- Cap bonus tokens to maximum 20 (equivalent to 100 PGT max bonus)
  v_clamped_tokens := GREATEST(0, LEAST(COALESCE(p_bonus_tokens, 0), 20));
  v_vip_mult := 1.0;
  v_amb_mult := 1.0;
  v_total_multiplier := 1.0;
  v_raw_pgt := 0.0;
  v_bonus_token_pgt := 0.0;
  v_final_pgt := 0.0;
  v_new_balance := 0.0;
  v_is_new_high := false;
  v_max_daily_plays := 35;
  v_daily_completed_count := 0;
  v_global_earn_mult := 1.0;

  BEGIN
    v_session_uuid := p_session_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session ID format');
  END;

  SELECT * INTO v_session
  FROM arcade_sessions
  WHERE id = v_session_uuid AND (player_id = v_pid OR LOWER(player_id) = LOWER(v_pid))
  FOR UPDATE;

  IF v_session IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found or belongs to another player');
  END IF;

  IF v_session.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session has already been finalized and claimed');
  END IF;

  SELECT * INTO v_user FROM users WHERE player_id = v_pid FOR UPDATE;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found in database');
  END IF;

  IF COALESCE(v_user.is_banned, false) = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended');
  END IF;

  v_duration_seconds := EXTRACT(EPOCH FROM (v_now - COALESCE(v_session.started_at, v_session.created_at)))::INTEGER;

  -- ----------------------------------------------------------------------------
  -- HARD SCORE LIMIT SENTINEL (500,000 PTS):
  -- Any score > 500,000 triggers an immediate bot warning, awards 0 PGT, burns session,
  -- and rejects submission without updating high scores.
  -- ----------------------------------------------------------------------------
  IF v_clamped_score > 500000 THEN
    PERFORM public.record_bot_warning(
      v_pid,
      'score_limit_500k_exceeded',
      COALESCE(v_session.game_name, 'Arcade'),
      jsonb_build_object(
        'submitted_score', p_score,
        'max_allowed_score', 500000,
        'duration_seconds', v_duration_seconds,
        'bonus_tokens', v_clamped_tokens
      )
    );

    UPDATE arcade_sessions
    SET status = 'completed',
        score = 0,
        bonus_items = 0,
        bonus_tokens = 0,
        payout_pgt = 0.0,
        completed_at = v_now,
        duration_seconds = v_duration_seconds
    WHERE id = v_session_uuid;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Score exceeds 500,000 limit. Submission blocked and bot warning recorded.',
      'bot_warning', true,
      'payout_pgt', 0.0,
      'new_balance', COALESCE(v_user.balance_pgt, 0)
    );
  END IF;

  -- Quick Deaths Handling (< 2s):
  -- Genuine instant deaths (score 0 or minimal) complete cleanly with 0 payout.
  -- Only reject if claiming an impossible score (> 250 pts or > 2 items) in under 2 seconds.
  IF v_duration_seconds < 2 THEN
    IF v_clamped_score > 250 OR v_clamped_items > 2 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Session ended too quickly for submitted score');
    ELSE
      UPDATE arcade_sessions
      SET status = 'completed',
          score = v_clamped_score,
          bonus_items = v_clamped_items,
          bonus_tokens = v_clamped_tokens,
          payout_pgt = 0.0,
          completed_at = v_now,
          duration_seconds = v_duration_seconds
      WHERE id = v_session_uuid;

      RETURN jsonb_build_object(
        'success', true,
        'payout', 0.0,
        'payout_pgt', 0.0,
        'new_balance', COALESCE(v_user.balance_pgt, 0),
        'weekly_games_played', COALESCE(v_user.weekly_games_played, 0),
        'weekly_active_tier', COALESCE(v_user.weekly_active_tier, 0)
      );
    END IF;
  END IF;

  SELECT COALESCE(earn_multiplier, 1.0), COALESCE(max_daily_plays_per_game, 35), game_payout_settings
  INTO v_global_earn_mult, v_max_daily_plays, v_game_settings
  FROM global_settings WHERE id = 1 LIMIT 1;

  v_game_clean := LOWER(REPLACE(COALESCE(v_session.game_name, 'astrododge'), ' ', ''));

  IF v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge' THEN
    v_game_key := 'astrododge';
  ELSIF v_game_clean LIKE '%invader%' THEN
    v_game_key := 'invaders';
  ELSIF v_game_clean LIKE '%drift%' THEN
    v_game_key := 'drift';
  ELSIF v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%' THEN
    v_game_key := 'stacker';
  ELSIF v_game_clean LIKE '%skeet%' THEN
    v_game_key := 'skeet';
  ELSIF v_game_clean LIKE '%defense%' THEN
    v_game_key := 'defense';
  ELSE
    v_game_key := v_game_clean;
  END IF;

  -- ----------------------------------------------------------------------------
  -- PHYSICAL ARCADE DURATION RATE-CLAMPS (Calibrated per game mechanics):
  -- 1. Orbs / Items: Road generation max 3 items/sec (+ 5 grace buffer)
  -- 2. Bonus Tokens: Max 1 token per 15 seconds (+ 1 grace buffer)
  -- 3. Realistic Score Velocity: Calibrated to speed and scoring formulas per game
  -- ----------------------------------------------------------------------------
  v_clamped_items := LEAST(v_clamped_items, GREATEST(5, v_duration_seconds * 3));
  v_clamped_tokens := LEAST(v_clamped_tokens, GREATEST(1, v_duration_seconds / 15));

  IF v_game_key = 'drift' THEN
    -- Cyber Drift: 10 pts/m + 150 pts/orb. At 167-200 km/h, velocity is 800-1,200 pts/sec
    v_clamped_score := LEAST(v_clamped_score, GREATEST(1500, v_duration_seconds * 1200));
  ELSIF v_game_key = 'invaders' THEN
    v_clamped_score := LEAST(v_clamped_score, GREATEST(500, v_duration_seconds * 350));
  ELSIF v_game_key = 'astrododge' THEN
    v_clamped_score := LEAST(v_clamped_score, GREATEST(500, v_duration_seconds * 250));
  ELSE
    v_clamped_score := LEAST(v_clamped_score, GREATEST(500, v_duration_seconds * 500));
  END IF;

  v_harvest_enabled := COALESCE((v_game_settings->v_game_key->>'harvest_enabled')::boolean, true);

  -- Count Completed Sessions in Last 24 Hours
  SELECT COUNT(*) INTO v_daily_completed_count
  FROM arcade_sessions
  WHERE (player_id = v_pid OR LOWER(player_id) = LOWER(v_pid))
    AND game_name = v_session.game_name
    AND status = 'completed'
    AND created_at >= (NOW() - INTERVAL '24 hours');

  IF v_daily_completed_count >= v_max_daily_plays THEN
    v_limit_reached := true;
  END IF;

  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_vip_mult := 2.0;
  END IF;

  IF v_user.is_ambassador = true THEN
    v_amb_mult := 2.0;
  END IF;

  -- ----------------------------------------------------------------------------
  -- 🛡️ STRICT SERVER-SIDE NFT MULTIPLIER VALIDATION
  -- Sourced authoritatively from users.owned_nfts and users.crate_nfts.
  -- Completely eliminates client parameter tampering (e.g. nft=10000).
  --   • nft_rare_shield ('Viper Shield'): +15%
  --   • nft_pulse_blaster / nft_hyper_drive ('Pulse Blaster'): +30%
  --   • nft_epic_yield ('Apex Matrix'): +50%
  -- ----------------------------------------------------------------------------
  v_all_nfts := COALESCE(v_user.owned_nfts, '[]'::jsonb) || COALESCE(v_user.crate_nfts, '[]'::jsonb);
  v_server_nft_bonus_pct := 0.0;
  IF v_all_nfts ? 'nft_rare_shield' THEN
    v_server_nft_bonus_pct := v_server_nft_bonus_pct + 15.0;
  END IF;
  IF v_all_nfts ? 'nft_pulse_blaster' OR v_all_nfts ? 'nft_hyper_drive' THEN
    v_server_nft_bonus_pct := v_server_nft_bonus_pct + 30.0;
  END IF;
  IF v_all_nfts ? 'nft_epic_yield' THEN
    v_server_nft_bonus_pct := v_server_nft_bonus_pct + 50.0;
  END IF;

  v_authoritative_nft_mult := 1.0 + (v_server_nft_bonus_pct / 100.0);
  -- Cap client's requested multiplier strictly to what they actually own
  v_clamped_nft_mult := LEAST(GREATEST(1.0, COALESCE(p_nft_multiplier, 1.0)), v_authoritative_nft_mult);

  -- ----------------------------------------------------------------------------
  -- 🛡️ STRICT SERVER-SIDE RELIC MULTIPLIER VALIDATION
  -- Sourced authoritatively from users.relics.
  -- 1.5x Apex Multiplier is granted ONLY if all 17 Serie 1 Relics are unlocked!
  -- Client parameter p_relic_multiplier cannot grant this bonus if relics are missing.
  -- ----------------------------------------------------------------------------
  IF is_season1_apex_unlocked(v_user.relics) THEN
    v_relic_mult := 1.5;
  ELSE
    v_relic_mult := 1.0;
  END IF;

  v_total_multiplier := v_clamped_nft_mult * v_relic_mult * v_vip_mult * v_amb_mult;

  -- Calculate Game-Specific Base PGT Formulas & High Scores (Strictly bounded <= 500,000)
  IF v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge' THEN
    v_game_name := 'AstroDodge';
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.05)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.game_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET game_highscore = v_clamped_score, alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%invader%' THEN
    v_game_name := 'Cyber Invaders';
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.invaders_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET invaders_highscore = v_clamped_score, alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%drift%' THEN
    v_game_name := 'Cyber Drift';
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.drift_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET drift_highscore = v_clamped_score, alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%' THEN
    v_game_name := 'Cyber Stacker';
    v_raw_pgt := ((v_clamped_items * 0.45) + (v_clamped_score / 1500.0)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.stacker_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET stacker_highscore = v_clamped_score, 
          alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%skeet%' THEN
    v_game_name := 'Cyber Skeet';
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.skeet_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET skeet_highscore = v_clamped_score, 
          alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%defense%' THEN
    v_game_name := 'Cyber Defense';
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.05)) * v_global_earn_mult;
    IF v_clamped_score > COALESCE(v_user.defense_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET defense_highscore = v_clamped_score, 
          defense_alltime_best = GREATEST(COALESCE(defense_alltime_best, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;

  ELSE
    v_game_name := v_session.game_name;
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
  END IF;

  -- Base Game Earn Ceiling (75.00 PGT): protects against unmultiplied bot exploits
  v_raw_pgt := LEAST(v_raw_pgt, 75.00);

  -- Bonus Token / Block / Coin PGT Cap: Maximum 100.00 PGT
  v_bonus_token_pgt := LEAST(v_clamped_tokens * 5.0, 100.00);

  -- Apply multipliers or pause payout if limit reached
  IF v_limit_reached OR NOT v_harvest_enabled THEN
    v_final_pgt := 0.0;
  ELSE
    v_final_pgt := ROUND(((v_raw_pgt * v_total_multiplier) + v_bonus_token_pgt)::numeric, 2);

    -- Payout Velocity Sentinel: Sessions under 3 seconds cannot earn more than 1.00 PGT
    IF v_duration_seconds < 3 THEN
      v_final_pgt := LEAST(v_final_pgt, 1.00);
    END IF;

    -- Dynamic Velocity Clamping: Calibrated per-game rate * user's verified total multiplier
    v_velocity_cap := GREATEST(2.00, ROUND((v_duration_seconds * v_max_velocity_rate * v_total_multiplier)::numeric, 2));
    v_final_pgt := LEAST(v_final_pgt, v_velocity_cap);

    -- Catastrophe Circuit-Breaker (1,000.00 PGT): protects against theoretical numeric overflows
    v_final_pgt := LEAST(v_final_pgt, 1000.00);
  END IF;

  -- Update Arcade Session as Completed
  UPDATE arcade_sessions
  SET status = 'completed',
      score = v_clamped_score,
      bonus_items = v_clamped_items,
      bonus_tokens = v_clamped_tokens,
      payout_pgt = v_final_pgt,
      completed_at = v_now,
      duration_seconds = v_duration_seconds
  WHERE id = v_session_uuid;

  -- Credit PGT balance if payout > 0
  IF v_final_pgt > 0 THEN
    v_new_balance := ROUND((COALESCE(v_user.balance_pgt, 0) + v_final_pgt)::numeric, 2);

    UPDATE users
    SET balance_pgt = v_new_balance,
        total_earned = ROUND((COALESCE(total_earned, 0) + v_final_pgt)::numeric, 2),
        updated_at = v_now
    WHERE player_id = v_pid;

    -- Process 4-Tier Referral Commissions for upline network
    PERFORM process_referral_commissions(v_pid, v_final_pgt, v_game_name || ' Arcade');
  ELSE
    v_new_balance := COALESCE(v_user.balance_pgt, 0);
  END IF;

  -- Update weekly active quest progression with canonical weekly_active_tier
  v_new_weekly_games := COALESCE(v_user.weekly_games_played, 0) + 1;
  v_current_weekly_faucets := COALESCE(v_user.weekly_faucet_claims, 0);
  v_new_weekly_tier := compute_weekly_active_tier(v_current_weekly_faucets, v_new_weekly_games);

  UPDATE users
  SET weekly_games_played = v_new_weekly_games,
      weekly_active_tier = v_new_weekly_tier,
      updated_at = v_now
  WHERE player_id = v_pid;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_uuid,
    'payout', v_final_pgt,
    'payout_pgt', v_final_pgt,
    'new_balance', v_new_balance,
    'clamped_score', v_clamped_score,
    'is_new_high', v_is_new_high,
    'limit_reached', v_limit_reached,
    'completed_count', v_daily_completed_count + 1,
    'max_daily_plays', v_max_daily_plays,
    'weekly_games_played', v_new_weekly_games,
    'weekly_active_tier', v_new_weekly_tier,
    'nft_multiplier', v_clamped_nft_mult,
    'relic_multiplier', v_relic_mult,
    'vip_multiplier', v_vip_mult,
    'ambassador_multiplier', v_amb_mult,
    'total_multiplier', v_total_multiplier,
    'duration_seconds', v_duration_seconds
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC) TO anon, authenticated, service_role;
