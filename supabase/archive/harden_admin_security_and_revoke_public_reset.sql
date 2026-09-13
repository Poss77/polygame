-- ==============================================================================
-- POLYGAME MASTER SECURITY HARDENING & PENETRATION REMEDIATION (v1.5.343)
-- 1. Creates `admin_security_config` table for SHA-256 Admin Passkey verification.
-- 2. Revokes public/anon execution on `execute_weekly_payout_and_reset`.
-- 3. Hardens `admin_update_global_settings` & `update_game_payout_settings` with passkey check.
-- 4. Hardens weekly tournament distribution & reset RPCs against unauthenticated execution.
-- 5. Hardens ambassador toggle, POL payout completion, and session pruning RPCs.
-- 6. Permanently purges and protects player email addresses from public PII exposure.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADMIN SECURITY CONFIGURATION & PASSKEY VERIFICATION
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_security_config (
  id INT PRIMARY KEY DEFAULT 1,
  admin_key_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row_admin_sec CHECK (id = 1)
);

-- RLS: Only service_role can access or modify
ALTER TABLE public.admin_security_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_security_config FROM anon, authenticated, public;
GRANT SELECT ON TABLE public.admin_security_config TO service_role;

-- Seed Default Passkey: pgt_admin_secure_2026!
-- Salt: polygame_admin_salt_8392
-- (Admin can change this at any time in the Supabase SQL Editor)
INSERT INTO public.admin_security_config (id, admin_key_hash, salt, updated_at)
VALUES (
  1,
  encode(digest('pgt_admin_secure_2026!' || 'polygame_admin_salt_8392', 'sha256'), 'hex'),
  'polygame_admin_salt_8392',
  NOW()
)
ON CONFLICT (id) DO UPDATE
SET admin_key_hash = EXCLUDED.admin_key_hash,
    salt = EXCLUDED.salt,
    updated_at = NOW();

-- Internal Helper: Verify Admin Passkey
CREATE OR REPLACE FUNCTION public.verify_admin_passkey(p_passkey TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_hash TEXT;
  v_salt TEXT;
  v_computed TEXT;
BEGIN
  IF p_passkey IS NULL OR TRIM(p_passkey) = '' THEN
    RETURN FALSE;
  END IF;

  SELECT admin_key_hash, salt INTO v_hash, v_salt
  FROM public.admin_security_config
  WHERE id = 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  v_computed := encode(digest(TRIM(p_passkey) || v_salt, 'sha256'), 'hex');
  RETURN (v_computed = v_hash);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_admin_passkey(TEXT) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.verify_admin_passkey(TEXT) TO service_role;


-- ------------------------------------------------------------------------------
-- 2. REVOKE PUBLIC EXECUTION ON WEEKLY RESET PROCEDURES
-- ------------------------------------------------------------------------------
-- execute_weekly_payout_and_reset should NEVER be callable by public anon or authenticated users.
REVOKE ALL ON FUNCTION public.execute_weekly_payout_and_reset() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.execute_weekly_payout_and_reset() TO service_role;


-- ------------------------------------------------------------------------------
-- 3. HARDEN GLOBAL SETTINGS RPCs: admin_update_global_settings & update_game_payout_settings
-- ------------------------------------------------------------------------------
-- Drop vulnerable legacy signatures
DROP FUNCTION IF EXISTS public.admin_update_global_settings(TEXT, JSONB);
DROP FUNCTION IF EXISTS public.admin_update_global_settings(JSONB, TEXT);
DROP FUNCTION IF EXISTS public.admin_update_global_settings(JSONB);

CREATE OR REPLACE FUNCTION public.admin_update_global_settings(
  p_payload JSONB,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  UPDATE public.global_settings
  SET
    earn_multiplier = COALESCE((p_payload->>'earn_multiplier')::numeric, earn_multiplier),
    faucet_base_pgt = COALESCE((p_payload->>'faucet_base_pgt')::numeric, faucet_base_pgt),
    vip_faucet_base_pol = COALESCE((p_payload->>'vip_faucet_base_pol')::numeric, vip_faucet_base_pol),
    vip_faucet_min_payout_pol = COALESCE((p_payload->>'vip_faucet_min_payout_pol')::numeric, vip_faucet_min_payout_pol),
    site_message = COALESCE(p_payload->>'site_message', site_message),
    min_withdraw_pgt = COALESCE((p_payload->>'min_withdraw_pgt')::numeric, min_withdraw_pgt),
    max_withdraw_pgt = COALESCE((p_payload->>'max_withdraw_pgt')::numeric, max_withdraw_pgt),
    max_weekly_withdrawals = COALESCE((p_payload->>'max_weekly_withdrawals')::int, max_weekly_withdrawals),
    max_daily_plays_per_game = COALESCE((p_payload->>'max_daily_plays_per_game')::int, max_daily_plays_per_game),
    account_quarantine_days = COALESCE((p_payload->>'account_quarantine_days')::int, account_quarantine_days),
    discord_webhook_url = COALESCE(p_payload->>'discord_webhook_url', discord_webhook_url),
    discord_admin_webhook_url = COALESCE(p_payload->>'discord_admin_webhook_url', discord_admin_webhook_url),
    discord_announcements_webhook_url = COALESCE(p_payload->>'discord_announcements_webhook_url', discord_announcements_webhook_url),
    game_payout_settings = CASE 
      WHEN p_payload ? 'game_payout_settings' THEN p_payload->'game_payout_settings'
      ELSE game_payout_settings
    END
  WHERE id = 1;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_global_settings(JSONB, TEXT) TO anon, authenticated, service_role;


-- Drop legacy update_game_payout_settings
DROP FUNCTION IF EXISTS public.update_game_payout_settings(TEXT, JSONB);
DROP FUNCTION IF EXISTS public.update_game_payout_settings(JSONB, TEXT);
DROP FUNCTION IF EXISTS public.update_game_payout_settings(JSONB);

CREATE OR REPLACE FUNCTION public.update_game_payout_settings(
  p_settings JSONB,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  UPDATE public.global_settings
  SET game_payout_settings = p_settings
  WHERE id = 1;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_game_payout_settings(JSONB, TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 4. HARDEN LEADERBOARD RESET & PRIZE DISTRIBUTION RPCs
-- ------------------------------------------------------------------------------
-- 4a. reset_arcade_leaderboard_scores
DROP FUNCTION IF EXISTS public.reset_arcade_leaderboard_scores();
DROP FUNCTION IF EXISTS public.reset_arcade_leaderboard_scores(TEXT);

CREATE OR REPLACE FUNCTION public.reset_arcade_leaderboard_scores(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INT;
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  UPDATE users
  SET
    game_highscore = 0,
    invaders_highscore = 0,
    drift_highscore = 0,
    stacker_highscore = 0,
    skeet_highscore = 0,
    defense_highscore = 0,
    weekly_faucet_claims = 0,
    weekly_games_played = 0,
    weekly_active_tier = 0
  WHERE
    game_highscore > 0
    OR invaders_highscore > 0
    OR drift_highscore > 0
    OR stacker_highscore > 0
    OR skeet_highscore > 0
    OR defense_highscore > 0
    OR weekly_faucet_claims > 0
    OR weekly_games_played > 0
    OR weekly_active_tier > 0;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'accounts_reset', v_updated_count
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.reset_arcade_leaderboard_scores(TEXT) TO anon, authenticated, service_role;


-- 4b. distribute_weekly_arcade_prizes
DROP FUNCTION IF EXISTS public.distribute_weekly_arcade_prizes();
DROP FUNCTION IF EXISTS public.distribute_weekly_arcade_prizes(TEXT);

CREATE OR REPLACE FUNCTION public.distribute_weekly_arcade_prizes(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_week_label TEXT := TO_CHAR(NOW(), 'YYYY-MM-DD');
  v_settings JSONB;
  v_rec RECORD;
  v_rank INT;
  v_prize NUMERIC;
  v_pool NUMERIC;
  v_total_distributed NUMERIC := 0;
  v_total_winners INT := 0;
  v_games_processed TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  -- Fetch Dynamic Settings from global_settings
  SELECT game_payout_settings INTO v_settings FROM global_settings WHERE id = 1;

  -- 1. ASTRO-DODGE POOL
  v_pool := COALESCE((v_settings->'astrododge'->>'weekly_pool_pgt')::numeric, 50000);
  IF v_pool > 0 THEN
    v_rank := 0;
    FOR v_rec IN (
      SELECT player_id, COALESCE(linked_wallet_address, player_id) AS wallet_address, game_highscore AS score
      FROM users WHERE COALESCE(game_highscore, 0) > 0 ORDER BY game_highscore DESC LIMIT 100
    ) LOOP
      v_rank := v_rank + 1;
      IF v_rank = 1 THEN v_prize := ROUND(v_pool * 0.30);
      ELSIF v_rank = 2 THEN v_prize := ROUND(v_pool * 0.16);
      ELSIF v_rank = 3 THEN v_prize := ROUND(v_pool * 0.08);
      ELSIF v_rank BETWEEN 4 AND 10 THEN v_prize := ROUND(v_pool * 0.02);
      ELSIF v_rank BETWEEN 11 AND 25 THEN v_prize := ROUND(v_pool * 0.008);
      ELSIF v_rank BETWEEN 26 AND 50 THEN v_prize := ROUND(v_pool * 0.004);
      ELSIF v_rank BETWEEN 51 AND 100 THEN v_prize := ROUND(v_pool * 0.002);
      ELSE v_prize := 0;
      END IF;

      IF v_prize > 0 THEN
        UPDATE users SET balance_pgt = balance_pgt + v_prize, total_earned = COALESCE(total_earned, 0) + v_prize, updated_at = NOW() WHERE player_id = v_rec.player_id;
        v_total_distributed := v_total_distributed + v_prize;
        v_total_winners := v_total_winners + 1;
      END IF;

      INSERT INTO weekly_leaderboard_history (
        week_label, game_type, rank, player_id, wallet_address, astrododge_score, best_score, prize_pgt
      ) VALUES (
        v_week_label, 'astrododge', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_rec.score, v_prize
      );
    END LOOP;
    v_games_processed := array_append(v_games_processed, 'astrododge');
  END IF;

  -- 2. CYBER INVADERS POOL
  v_pool := COALESCE((v_settings->'invaders'->>'weekly_pool_pgt')::numeric, 50000);
  IF v_pool > 0 THEN
    v_rank := 0;
    FOR v_rec IN (
      SELECT player_id, COALESCE(linked_wallet_address, player_id) AS wallet_address, invaders_highscore AS score
      FROM users WHERE COALESCE(invaders_highscore, 0) > 0 ORDER BY invaders_highscore DESC LIMIT 100
    ) LOOP
      v_rank := v_rank + 1;
      IF v_rank = 1 THEN v_prize := ROUND(v_pool * 0.30);
      ELSIF v_rank = 2 THEN v_prize := ROUND(v_pool * 0.16);
      ELSIF v_rank = 3 THEN v_prize := ROUND(v_pool * 0.08);
      ELSIF v_rank BETWEEN 4 AND 10 THEN v_prize := ROUND(v_pool * 0.02);
      ELSIF v_rank BETWEEN 11 AND 25 THEN v_prize := ROUND(v_pool * 0.008);
      ELSIF v_rank BETWEEN 26 AND 50 THEN v_prize := ROUND(v_pool * 0.004);
      ELSIF v_rank BETWEEN 51 AND 100 THEN v_prize := ROUND(v_pool * 0.002);
      ELSE v_prize := 0;
      END IF;

      IF v_prize > 0 THEN
        UPDATE users SET balance_pgt = balance_pgt + v_prize, total_earned = COALESCE(total_earned, 0) + v_prize, updated_at = NOW() WHERE player_id = v_rec.player_id;
        v_total_distributed := v_total_distributed + v_prize;
        v_total_winners := v_total_winners + 1;
      END IF;

      INSERT INTO weekly_leaderboard_history (
        week_label, game_type, rank, player_id, wallet_address, invaders_score, best_score, prize_pgt
      ) VALUES (
        v_week_label, 'invaders', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_rec.score, v_prize
      );
    END LOOP;
    v_games_processed := array_append(v_games_processed, 'invaders');
  END IF;

  -- 3. CYBER DRIFT POOL
  v_pool := COALESCE((v_settings->'drift'->>'weekly_pool_pgt')::numeric, 50000);
  IF v_pool > 0 THEN
    v_rank := 0;
    FOR v_rec IN (
      SELECT player_id, COALESCE(linked_wallet_address, player_id) AS wallet_address, drift_highscore AS score
      FROM users WHERE COALESCE(drift_highscore, 0) > 0 ORDER BY drift_highscore DESC LIMIT 100
    ) LOOP
      v_rank := v_rank + 1;
      IF v_rank = 1 THEN v_prize := ROUND(v_pool * 0.30);
      ELSIF v_rank = 2 THEN v_prize := ROUND(v_pool * 0.16);
      ELSIF v_rank = 3 THEN v_prize := ROUND(v_pool * 0.08);
      ELSIF v_rank BETWEEN 4 AND 10 THEN v_prize := ROUND(v_pool * 0.02);
      ELSIF v_rank BETWEEN 11 AND 25 THEN v_prize := ROUND(v_pool * 0.008);
      ELSIF v_rank BETWEEN 26 AND 50 THEN v_prize := ROUND(v_pool * 0.004);
      ELSIF v_rank BETWEEN 51 AND 100 THEN v_prize := ROUND(v_pool * 0.002);
      ELSE v_prize := 0;
      END IF;

      IF v_prize > 0 THEN
        UPDATE users SET balance_pgt = balance_pgt + v_prize, total_earned = COALESCE(total_earned, 0) + v_prize, updated_at = NOW() WHERE player_id = v_rec.player_id;
        v_total_distributed := v_total_distributed + v_prize;
        v_total_winners := v_total_winners + 1;
      END IF;

      INSERT INTO weekly_leaderboard_history (
        week_label, game_type, rank, player_id, wallet_address, drift_score, best_score, prize_pgt
      ) VALUES (
        v_week_label, 'drift', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_rec.score, v_prize
      );
    END LOOP;
    v_games_processed := array_append(v_games_processed, 'drift');
  END IF;

  -- 4. CYBER STACKER POOL
  v_pool := COALESCE((v_settings->'stacker'->>'weekly_pool_pgt')::numeric, 50000);
  IF v_pool > 0 THEN
    v_rank := 0;
    FOR v_rec IN (
      SELECT player_id, COALESCE(linked_wallet_address, player_id) AS wallet_address, stacker_highscore AS score
      FROM users WHERE COALESCE(stacker_highscore, 0) > 0 ORDER BY stacker_highscore DESC LIMIT 100
    ) LOOP
      v_rank := v_rank + 1;
      IF v_rank = 1 THEN v_prize := ROUND(v_pool * 0.30);
      ELSIF v_rank = 2 THEN v_prize := ROUND(v_pool * 0.16);
      ELSIF v_rank = 3 THEN v_prize := ROUND(v_pool * 0.08);
      ELSIF v_rank BETWEEN 4 AND 10 THEN v_prize := ROUND(v_pool * 0.02);
      ELSIF v_rank BETWEEN 11 AND 25 THEN v_prize := ROUND(v_pool * 0.008);
      ELSIF v_rank BETWEEN 26 AND 50 THEN v_prize := ROUND(v_pool * 0.004);
      ELSIF v_rank BETWEEN 51 AND 100 THEN v_prize := ROUND(v_pool * 0.002);
      ELSE v_prize := 0;
      END IF;

      IF v_prize > 0 THEN
        UPDATE users SET balance_pgt = balance_pgt + v_prize, total_earned = COALESCE(total_earned, 0) + v_prize, updated_at = NOW() WHERE player_id = v_rec.player_id;
        v_total_distributed := v_total_distributed + v_prize;
        v_total_winners := v_total_winners + 1;
      END IF;

      INSERT INTO weekly_leaderboard_history (
        week_label, game_type, rank, player_id, wallet_address, stacker_score, best_score, prize_pgt
      ) VALUES (
        v_week_label, 'stacker', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_rec.score, v_prize
      );
    END LOOP;
    v_games_processed := array_append(v_games_processed, 'stacker');
  END IF;

  -- 5. CYBER SKEET POOL
  v_pool := COALESCE((v_settings->'skeet'->>'weekly_pool_pgt')::numeric, 50000);
  IF v_pool > 0 THEN
    v_rank := 0;
    FOR v_rec IN (
      SELECT player_id, COALESCE(linked_wallet_address, player_id) AS wallet_address, skeet_highscore AS score
      FROM users WHERE COALESCE(skeet_highscore, 0) > 0 ORDER BY skeet_highscore DESC LIMIT 100
    ) LOOP
      v_rank := v_rank + 1;
      IF v_rank = 1 THEN v_prize := ROUND(v_pool * 0.30);
      ELSIF v_rank = 2 THEN v_prize := ROUND(v_pool * 0.16);
      ELSIF v_rank = 3 THEN v_prize := ROUND(v_pool * 0.08);
      ELSIF v_rank BETWEEN 4 AND 10 THEN v_prize := ROUND(v_pool * 0.02);
      ELSIF v_rank BETWEEN 11 AND 25 THEN v_prize := ROUND(v_pool * 0.008);
      ELSIF v_rank BETWEEN 26 AND 50 THEN v_prize := ROUND(v_pool * 0.004);
      ELSIF v_rank BETWEEN 51 AND 100 THEN v_prize := ROUND(v_pool * 0.002);
      ELSE v_prize := 0;
      END IF;

      IF v_prize > 0 THEN
        UPDATE users SET balance_pgt = balance_pgt + v_prize, total_earned = COALESCE(total_earned, 0) + v_prize, updated_at = NOW() WHERE player_id = v_rec.player_id;
        v_total_distributed := v_total_distributed + v_prize;
        v_total_winners := v_total_winners + 1;
      END IF;

      INSERT INTO weekly_leaderboard_history (
        week_label, game_type, rank, player_id, wallet_address, skeet_score, best_score, prize_pgt
      ) VALUES (
        v_week_label, 'skeet', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_rec.score, v_prize
      );
    END LOOP;
    v_games_processed := array_append(v_games_processed, 'skeet');
  END IF;

  -- 6. CYBER DEFENSE POOL
  v_pool := COALESCE((v_settings->'defense'->>'weekly_pool_pgt')::numeric, 50000);
  IF v_pool > 0 THEN
    v_rank := 0;
    FOR v_rec IN (
      SELECT player_id, COALESCE(linked_wallet_address, player_id) AS wallet_address, defense_highscore AS score
      FROM users WHERE COALESCE(defense_highscore, 0) > 0 ORDER BY defense_highscore DESC LIMIT 100
    ) LOOP
      v_rank := v_rank + 1;
      IF v_rank = 1 THEN v_prize := ROUND(v_pool * 0.30);
      ELSIF v_rank = 2 THEN v_prize := ROUND(v_pool * 0.16);
      ELSIF v_rank = 3 THEN v_prize := ROUND(v_pool * 0.08);
      ELSIF v_rank BETWEEN 4 AND 10 THEN v_prize := ROUND(v_pool * 0.02);
      ELSIF v_rank BETWEEN 11 AND 25 THEN v_prize := ROUND(v_pool * 0.008);
      ELSIF v_rank BETWEEN 26 AND 50 THEN v_prize := ROUND(v_pool * 0.004);
      ELSIF v_rank BETWEEN 51 AND 100 THEN v_prize := ROUND(v_pool * 0.002);
      ELSE v_prize := 0;
      END IF;

      IF v_prize > 0 THEN
        UPDATE users SET balance_pgt = balance_pgt + v_prize, total_earned = COALESCE(total_earned, 0) + v_prize, updated_at = NOW() WHERE player_id = v_rec.player_id;
        v_total_distributed := v_total_distributed + v_prize;
        v_total_winners := v_total_winners + 1;
      END IF;

      INSERT INTO weekly_leaderboard_history (
        week_label, game_type, rank, player_id, wallet_address, defense_score, best_score, prize_pgt
      ) VALUES (
        v_week_label, 'defense', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_rec.score, v_prize
      );
    END LOOP;
    v_games_processed := array_append(v_games_processed, 'defense');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'total_distributed', v_total_distributed,
    'winner_count', v_total_winners,
    'games_processed', v_games_processed
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.distribute_weekly_arcade_prizes(TEXT) TO anon, authenticated, service_role;


-- 4c. distribute_weekly_boss_prizes
DROP FUNCTION IF EXISTS public.distribute_weekly_boss_prizes();
DROP FUNCTION IF EXISTS public.distribute_weekly_boss_prizes(TEXT);

CREATE OR REPLACE FUNCTION public.distribute_weekly_boss_prizes(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_boss_level INT := 1;
  v_boss_current_hp NUMERIC := 5000000;
  v_boss_max_hp NUMERIC := 5000000;
  v_boss_pool NUMERIC := 10000;
  v_total_damage NUMERIC := 0;
  v_game_settings JSONB;
  v_winner RECORD;
  v_payout NUMERIC;
  v_payout_count INT := 0;
  v_distributed_total NUMERIC := 0;
  v_top_hunters JSONB := '[]'::jsonb;
  v_new_level INT := 1;
  v_new_max_hp NUMERIC := 5000000;
  v_new_pool NUMERIC := 10000;
  v_is_slain BOOLEAN := false;
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  -- Read current Boss state from global_settings
  SELECT 
    COALESCE(boss_level, 1),
    COALESCE(boss_current_hp, 5000000),
    COALESCE(boss_max_hp, 5000000),
    game_payout_settings
  INTO v_boss_level, v_boss_current_hp, v_boss_max_hp, v_game_settings
  FROM public.global_settings
  WHERE id = 1;

  -- Dynamic Prize Pool formula: 10,000 * 1.20^(level - 1)
  v_boss_pool := ROUND(10000.0 * POWER(1.20, GREATEST(0, v_boss_level - 1)));
  IF v_game_settings IS NOT NULL AND v_game_settings->'boss' IS NOT NULL AND (v_game_settings->'boss'->>'weekly_pool_pgt') IS NOT NULL THEN
    v_boss_pool := COALESCE((v_game_settings->'boss'->>'weekly_pool_pgt')::NUMERIC, v_boss_pool);
  END IF;

  -- Calculate total weekly damage dealt across all attacking commanders
  SELECT COALESCE(SUM(boss_weekly_damage), 0)
  INTO v_total_damage
  FROM public.users
  WHERE boss_weekly_damage > 0;

  v_is_slain := (v_boss_current_hp <= 0);

  IF v_is_slain AND v_total_damage > 0 AND v_boss_pool > 0 THEN
    FOR v_winner IN
      SELECT 
        player_id, 
        COALESCE(linked_wallet_address, player_id) as wallet_address,
        boss_weekly_damage,
        username
      FROM public.users
      WHERE boss_weekly_damage > 0
      ORDER BY boss_weekly_damage DESC
    LOOP
      v_payout := ROUND((v_winner.boss_weekly_damage::NUMERIC / v_total_damage::NUMERIC) * v_boss_pool::NUMERIC, 2);
      
      IF v_payout > 0 THEN
        UPDATE public.users
        SET balance_pgt = balance_pgt + v_payout,
            total_earned = COALESCE(total_earned, 0) + v_payout,
            updated_at = NOW()
        WHERE player_id = v_winner.player_id;

        v_distributed_total := v_distributed_total + v_payout;
        v_payout_count := v_payout_count + 1;

        IF v_payout_count <= 5 THEN
          v_top_hunters := v_top_hunters || jsonb_build_object(
            'player', COALESCE(v_winner.username, SUBSTRING(v_winner.wallet_address FROM 1 FOR 6) || '...'),
            'damage', v_winner.boss_weekly_damage,
            'payout_pgt', v_payout
          );
        END IF;
      END IF;
    END LOOP;

    v_new_level := v_boss_level + 1;
  ELSE
    v_new_level := GREATEST(1, v_boss_level - 1);
  END IF;

  -- Compute next week stats
  v_new_max_hp := ROUND(5000000.0 * POWER(1.25, v_new_level - 1));
  v_new_pool := ROUND(10000.0 * POWER(1.20, v_new_level - 1));

  -- Archive reset in boss_reset_history
  BEGIN
    INSERT INTO public.boss_reset_history (
      boss_level, boss_max_hp, boss_end_hp, boss_pool_pgt,
      was_slain, total_damage_dealt, total_hunters, distributed_total_pgt,
      next_level, next_max_hp, next_pool_pgt
    ) VALUES (
      v_boss_level, v_boss_max_hp, GREATEST(0, v_boss_current_hp), v_boss_pool,
      v_is_slain, v_total_damage, v_payout_count, v_distributed_total,
      v_new_level, v_new_max_hp, v_new_pool
    );
  EXCEPTION WHEN undefined_table THEN
    -- Fallback if table not created
    NULL;
  END;

  -- Reset Boss State & Wipe Weekly Commander Damage
  UPDATE public.global_settings
  SET boss_level = v_new_level,
      boss_current_hp = v_new_max_hp,
      boss_max_hp = v_new_max_hp,
      updated_at = NOW()
  WHERE id = 1;

  UPDATE public.users
  SET boss_weekly_damage = 0
  WHERE boss_weekly_damage > 0;

  RETURN jsonb_build_object(
    'success', true,
    'slain', v_is_slain,
    'boss_level', v_boss_level,
    'new_level', v_new_level,
    'new_max_hp', v_new_max_hp,
    'new_pool', v_new_pool,
    'winner_count', v_payout_count,
    'distributed_total_pgt', v_distributed_total,
    'top_hunters', v_top_hunters
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.distribute_weekly_boss_prizes(TEXT) TO anon, authenticated, service_role;


-- 4d. snapshot_weekly_activity_tiers
DROP FUNCTION IF EXISTS public.snapshot_weekly_activity_tiers();
DROP FUNCTION IF EXISTS public.snapshot_weekly_activity_tiers(TEXT);

CREATE OR REPLACE FUNCTION public.snapshot_weekly_activity_tiers(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INT;
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  UPDATE public.users
  SET 
    last_weekly_active_tier = CASE 
      WHEN COALESCE(weekly_active_tier, 0) > 0 THEN weekly_active_tier
      ELSE COALESCE(last_weekly_active_tier, 0)
    END,
    weekly_faucet_claims = 0,
    weekly_games_played = 0,
    weekly_active_tier = 0,
    updated_at = NOW()
  WHERE 
    COALESCE(weekly_active_tier, 0) > 0 
    OR COALESCE(weekly_faucet_claims, 0) > 0 
    OR COALESCE(weekly_games_played, 0) > 0;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'accounts_snapshotted', v_updated_count
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.snapshot_weekly_activity_tiers(TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 5. HARDEN OPERATIONS: complete_pol_payout_request, toggle_ambassador_status, prune_old_arcade_sessions, reset_arcade_game_metrics
-- ------------------------------------------------------------------------------
-- 5a. complete_pol_payout_request
DROP FUNCTION IF EXISTS public.complete_pol_payout_request(UUID, TEXT);
DROP FUNCTION IF EXISTS public.complete_pol_payout_request(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.complete_pol_payout_request(
  p_request_id UUID,
  p_tx_hash TEXT,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  UPDATE public.pol_payout_requests
  SET status = 'paid',
      tx_hash = p_tx_hash,
      processed_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.complete_pol_payout_request(UUID, TEXT, TEXT) TO anon, authenticated, service_role;


-- 5b. toggle_ambassador_status
DROP FUNCTION IF EXISTS public.toggle_ambassador_status(TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.toggle_ambassador_status(TEXT, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public.toggle_ambassador_status(
  p_target_wallet TEXT,
  p_is_ambassador BOOLEAN,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player_id TEXT;
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  p_target_wallet := LOWER(TRIM(p_target_wallet));

  SELECT resolve_player_id(p_target_wallet) INTO v_player_id;

  IF v_player_id IS NULL THEN
    SELECT player_id INTO v_player_id
    FROM users
    WHERE LOWER(player_id) = p_target_wallet 
       OR LOWER(linked_wallet_address) = p_target_wallet
    LIMIT 1;
  END IF;

  IF v_player_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found in database');
  END IF;

  UPDATE users
  SET is_ambassador = p_is_ambassador,
      updated_at = NOW()
  WHERE player_id = v_player_id;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_player_id,
    'is_ambassador', p_is_ambassador
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_ambassador_status(TEXT, BOOLEAN, TEXT) TO anon, authenticated, service_role;


-- 5c. prune_old_arcade_sessions
DROP FUNCTION IF EXISTS public.prune_old_arcade_sessions(INTEGER);
DROP FUNCTION IF EXISTS public.prune_old_arcade_sessions(INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.prune_old_arcade_sessions(
  p_days INTEGER DEFAULT 7,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INT;
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  DELETE FROM arcade_sessions
  WHERE created_at < (NOW() - (p_days || ' days')::INTERVAL);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'deleted_count', v_deleted);
END;
$$;
GRANT EXECUTE ON FUNCTION public.prune_old_arcade_sessions(INTEGER, TEXT) TO anon, authenticated, service_role;


-- 5d. reset_arcade_game_metrics
DROP FUNCTION IF EXISTS public.reset_arcade_game_metrics();
DROP FUNCTION IF EXISTS public.reset_arcade_game_metrics(TEXT);

CREATE OR REPLACE FUNCTION public.reset_arcade_game_metrics(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  DELETE FROM arcade_game_metrics;
  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.reset_arcade_game_metrics(TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 6. PII EMAIL EXPOSURE REMEDIATION
-- ------------------------------------------------------------------------------
-- 6a. Blank all existing email entries in public.users to prevent PostgREST harvesting
UPDATE public.users
SET email = NULL
WHERE email IS NOT NULL;

-- 6b. Install trigger to guarantee any future inserts or updates blank out email
CREATE OR REPLACE FUNCTION public.sanitize_user_email_protection()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.email := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_user_email_protection ON public.users;
CREATE TRIGGER trg_sanitize_user_email_protection
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_user_email_protection();
