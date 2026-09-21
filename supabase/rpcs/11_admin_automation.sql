-- 11. ADMINISTRATION & AUTOMATION CYCLES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: verify_admin_passkey
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_admin_passkey(p_passkey TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

  v_computed := encode(extensions.digest(TRIM(p_passkey) || v_salt, 'sha256'::text), 'hex');
  RETURN (v_computed = v_hash);
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC: admin_update_global_settings
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
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
    END,
    turnstile_arcade_enabled = CASE
      WHEN p_payload ? 'turnstile_arcade_enabled' THEN (p_payload->>'turnstile_arcade_enabled')::boolean
      ELSE turnstile_arcade_enabled
    END,
    turnstile_arcade_frequency = CASE
      WHEN p_payload ? 'turnstile_arcade_frequency' THEN (p_payload->>'turnstile_arcade_frequency')::int
      ELSE turnstile_arcade_frequency
    END,
    turnstile_arcade_vip_bypass = CASE
      WHEN p_payload ? 'turnstile_arcade_vip_bypass' THEN (p_payload->>'turnstile_arcade_vip_bypass')::boolean
      ELSE turnstile_arcade_vip_bypass
    END
  WHERE id = 1;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.admin_update_global_settings(JSONB, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_update_global_settings(JSONB, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: update_game_payout_settings
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
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
GRANT EXECUTE ON FUNCTION public.update_game_payout_settings(JSONB, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_game_payout_settings(JSONB, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: reset_arcade_leaderboard_scores
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
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
GRANT EXECUTE ON FUNCTION public.reset_arcade_leaderboard_scores(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reset_arcade_leaderboard_scores(TEXT) FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- RPC: distribute_weekly_arcade_prizes
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
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
GRANT EXECUTE ON FUNCTION public.distribute_weekly_arcade_prizes(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.distribute_weekly_arcade_prizes(TEXT) FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- RPC: snapshot_weekly_activity_tiers
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
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
GRANT EXECUTE ON FUNCTION public.snapshot_weekly_activity_tiers(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.snapshot_weekly_activity_tiers(TEXT) FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- RPC: execute_weekly_payout_and_reset
-- Source: fix_weekly_reset_activity_counters.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.execute_weekly_payout_and_reset();
DROP FUNCTION IF EXISTS public.execute_weekly_payout_and_reset(TEXT);
CREATE OR REPLACE FUNCTION public.execute_weekly_payout_and_reset(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_arcade_res JSONB;
  v_boss_res JSONB;
  v_activity_res JSONB;
  v_scores_res JSONB;
BEGIN
  -- Strict Master Admin Passkey Verification
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Master Admin Passkey');
  END IF;

  -- 1. Distribute Arcade Leaderboard Prizes (Step 1)
  v_arcade_res := public.distribute_weekly_arcade_prizes(p_admin_passkey);

  -- 2. Distribute World Boss Bounty Loot (Step 2)
  BEGIN
    v_boss_res := public.distribute_weekly_boss_prizes(p_admin_passkey);
  EXCEPTION WHEN OTHERS THEN
    v_boss_res := jsonb_build_object('success', false, 'error', SQLERRM);
  END;

  -- 3. Snapshot Activity Tiers & Reset Active Counters (Step 3)
  v_activity_res := public.snapshot_weekly_activity_tiers(p_admin_passkey);

  -- 4. Reset Weekly Arcade Scores to 0 (Step 4)
  v_scores_res := public.reset_arcade_leaderboard_scores(p_admin_passkey);

  -- 5. Extra Safeguard: Zero out active weekly faucet/gameplay counters
  UPDATE public.users 
  SET weekly_faucet_claims = 0,
      weekly_games_played = 0,
      weekly_active_tier = 0
  WHERE COALESCE(weekly_faucet_claims, 0) > 0 
     OR COALESCE(weekly_games_played, 0) > 0 
     OR COALESCE(weekly_active_tier, 0) > 0;

  RETURN jsonb_build_object(
    'success', true,
    'total_distributed', COALESCE((v_arcade_res->>'total_distributed')::numeric, 0),
    'winner_count', COALESCE((v_arcade_res->>'winner_count')::int, 0),
    'games_processed', v_arcade_res->'games_processed',
    'week_label', v_arcade_res->>'week_label',
    'arcade_payout', v_arcade_res,
    'boss_payout', v_boss_res,
    'activity_snapshot', v_activity_res,
    'scores_reset', v_scores_res
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_weekly_payout_and_reset(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.execute_weekly_payout_and_reset(TEXT) FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- RPC: complete_pol_payout_request
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
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
GRANT EXECUTE ON FUNCTION public.complete_pol_payout_request(UUID, TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.complete_pol_payout_request(UUID, TEXT, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC 2: reject_pol_payout_request (Master Admin Fraud Payout Rejection)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.reject_pol_payout_request(UUID, TEXT);
DROP FUNCTION IF EXISTS public.reject_pol_payout_request(UUID);
DROP FUNCTION IF EXISTS public.reject_pol_payout_request(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.reject_pol_payout_request(
  p_request_id UUID,
  p_reason TEXT DEFAULT 'Fraudulent or unverified transaction',
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  UPDATE public.pol_payout_requests
  SET status = 'rejected',
      processed_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'request_id', p_request_id, 'status', 'rejected', 'reason', p_reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_pol_payout_request(UUID, TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.reject_pol_payout_request(UUID, TEXT, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: toggle_ambassador_status
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
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
GRANT EXECUTE ON FUNCTION public.toggle_ambassador_status(TEXT, BOOLEAN, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.toggle_ambassador_status(TEXT, BOOLEAN, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: prune_old_arcade_sessions
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
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
GRANT EXECUTE ON FUNCTION public.prune_old_arcade_sessions(INTEGER, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.prune_old_arcade_sessions(INTEGER, TEXT) FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- RPC: prune_old_bet_wins
-- Source: add_bet_losses_and_pruning.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.prune_old_bet_wins(INTEGER);
DROP FUNCTION IF EXISTS public.prune_old_bet_wins(INTEGER, TEXT);
CREATE OR REPLACE FUNCTION public.prune_old_bet_wins(
  p_days INTEGER DEFAULT 30,
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

  DELETE FROM public.bet_wins
  WHERE created_at < (NOW() - (p_days || ' days')::INTERVAL);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'deleted_count', v_deleted, 'purged_count', v_deleted);
END;
$$;
GRANT EXECUTE ON FUNCTION public.prune_old_bet_wins(INTEGER, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.prune_old_bet_wins(INTEGER, TEXT) FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- RPC: reset_arcade_game_metrics
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
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
GRANT EXECUTE ON FUNCTION public.reset_arcade_game_metrics(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reset_arcade_game_metrics(TEXT) FROM anon, authenticated;

-- ------------------------------------------------------------------------------
-- RPC: sanitize_user_email_protection
-- Source: harden_admin_security_and_revoke_public_reset.sql
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sanitize_user_email_protection()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.email := NULL;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC: toggle_user_ban
-- Source: add_anti_bot_detection_and_warning_system.sql
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.toggle_user_ban(
  p_target_wallet TEXT,
  p_is_banned BOOLEAN,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

  v_pid := resolve_player_id(p_target_wallet);
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_target_wallet, '')));
  END IF;

  UPDATE public.users
  SET is_banned = p_is_banned,
      updated_at = NOW()
  WHERE player_id = v_pid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'player_id', v_pid, 'is_banned', p_is_banned);
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_user_ban(TEXT, BOOLEAN, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.toggle_user_ban(TEXT, BOOLEAN, TEXT) FROM anon;



-- ==============================================================================
