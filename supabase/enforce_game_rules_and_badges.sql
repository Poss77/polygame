-- ==============================================================================
-- POLYGON GAMING: GAME RULES ENFORCEMENT & SIMPLIFIED POOLS (v1.5.238)
-- - start_arcade_session: Enforces vip_only check server-side
-- - end_arcade_session: Enforces harvest_enabled check (0 PGT if paused)
-- - distribute_weekly_arcade_prizes: Enforces pool > 0 (setting pool to 0 skips payout)
-- - distribute_weekly_boss_prizes: Enforces boss pool > 0
-- ==============================================================================

-- 1. START ARCADE SESSION (WITH SERVER-SIDE VIP ENFORCEMENT)
CREATE OR REPLACE FUNCTION public.start_arcade_session(
  p_player_id TEXT,
  p_game_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_session_id UUID;
  v_max_daily_plays INTEGER := 25;
  v_daily_completed_count INTEGER := 0;
  v_clean_game TEXT;
  v_game_key TEXT;
  v_game_settings JSONB;
  v_vip_only BOOLEAN := false;
  v_user RECORD;
BEGIN
  v_pid := resolve_player_id(p_player_id);
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_player_id, '')));
  END IF;

  v_clean_game := LOWER(REPLACE(COALESCE(p_game_name, 'astrododge'), ' ', ''));

  IF v_clean_game LIKE '%astro%' OR v_clean_game = 'astrododge' THEN
    v_game_key := 'astrododge';
  ELSIF v_clean_game LIKE '%invader%' THEN
    v_game_key := 'invaders';
  ELSIF v_clean_game LIKE '%drift%' THEN
    v_game_key := 'drift';
  ELSIF v_clean_game LIKE '%stacker%' OR v_clean_game LIKE '%catcher%' THEN
    v_game_key := 'stacker';
  ELSIF v_clean_game LIKE '%skeet%' THEN
    v_game_key := 'skeet';
  ELSE
    v_game_key := v_clean_game;
  END IF;

  SELECT COALESCE(max_daily_plays_per_game, 25), game_payout_settings
  INTO v_max_daily_plays, v_game_settings
  FROM global_settings WHERE id = 1 LIMIT 1;

  -- Server-side VIP Access Enforcement
  v_vip_only := COALESCE((v_game_settings->v_game_key->>'vip_only')::boolean, false);
  IF v_vip_only THEN
    SELECT * INTO v_user FROM users WHERE player_id = v_pid;
    IF v_user IS NULL OR (
      (v_user.vip_until IS NULL OR v_user.vip_until <= NOW())
      AND NOT COALESCE(v_user.is_ambassador, false)
      AND LOWER(v_pid) <> '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', '👑 VIP Exclusive Game! Upgrade to VIP Pass to play.',
        'vip_required', true
      );
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_daily_completed_count
  FROM arcade_sessions
  WHERE player_id = v_pid
    AND LOWER(REPLACE(COALESCE(game_name, ''), ' ', '')) = v_clean_game
    AND created_at >= (NOW() - INTERVAL '24 hours')
    AND status = 'completed';

  IF v_daily_completed_count >= v_max_daily_plays THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily play limit reached (' || v_max_daily_plays || '/' || v_max_daily_plays || ' runs in last 24 hours). Please wait for cooldown.',
      'limit_reached', true,
      'daily_completed', v_daily_completed_count,
      'max_plays', v_max_daily_plays
    );
  END IF;

  INSERT INTO arcade_sessions (player_id, game_name, status, created_at, started_at)
  VALUES (v_pid, p_game_name, 'active', NOW(), NOW())
  RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'player_id', v_pid,
    'game_name', p_game_name,
    'plays_today', v_daily_completed_count,
    'max_daily_plays', v_max_daily_plays
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.start_arcade_session(TEXT, TEXT) TO anon, authenticated, service_role;


-- 2. END ARCADE SESSION (WITH SERVER-SIDE HARVEST_ENABLED CHECK)
CREATE OR REPLACE FUNCTION public.end_arcade_session(
  p_player_id TEXT,
  p_session_id TEXT,
  p_score INTEGER DEFAULT 0,
  p_bonus_items INTEGER DEFAULT 0,
  p_bonus_tokens INTEGER DEFAULT 0,
  p_nft_multiplier NUMERIC DEFAULT 1.0
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
  v_clamped_nft_mult NUMERIC;
  v_user RECORD;
  v_vip_mult NUMERIC;
  v_amb_mult NUMERIC;
  v_relic_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC;
  v_raw_pgt NUMERIC;
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
  v_new_weekly_games INTEGER := 0;
  v_current_weekly_faucets INTEGER := 0;
  v_new_weekly_tier INTEGER := 0;
BEGIN
  v_pid := resolve_player_id(p_player_id);
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(COALESCE(p_player_id, ''))); 
  END IF;

  v_now := NOW();
  v_clamped_score := GREATEST(0, COALESCE(p_score, 0));
  v_clamped_items := GREATEST(0, COALESCE(p_bonus_items, 0));
  v_clamped_tokens := GREATEST(0, COALESCE(p_bonus_tokens, 0));
  v_clamped_nft_mult := GREATEST(1.0, LEAST(COALESCE(p_nft_multiplier, 1.0), 10.0));
  v_vip_mult := 1.0;
  v_amb_mult := 1.0;
  v_total_multiplier := 1.0;
  v_raw_pgt := 0.0;
  v_final_pgt := 0.0;
  v_new_balance := 0.0;
  v_is_new_high := false;
  v_max_daily_plays := 25;
  v_daily_completed_count := 0;
  v_global_earn_mult := 1.0;

  BEGIN
    v_session_uuid := p_session_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session ID format');
  END;

  SELECT * INTO v_session
  FROM arcade_sessions
  WHERE id = v_session_uuid AND player_id = v_pid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Arcade session not found');
  END IF;

  IF v_session.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Arcade session already finished or expired');
  END IF;

  v_duration_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_now - v_session.created_at))::INTEGER);

  IF v_duration_seconds > 7200 THEN
    UPDATE arcade_sessions SET status = 'expired', duration_seconds = v_duration_seconds WHERE id = v_session_uuid;
    RETURN jsonb_build_object('success', false, 'error', 'Arcade session expired (max 2 hours)');
  END IF;

  v_game_clean := LOWER(REPLACE(COALESCE(v_session.game_name, ''), ' ', ''));

  SELECT COALESCE(earn_multiplier, 1.0), COALESCE(max_daily_plays_per_game, 25), game_payout_settings
  INTO v_global_earn_mult, v_max_daily_plays, v_game_settings
  FROM global_settings WHERE id = 1 LIMIT 1;

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
  ELSE
    v_game_key := v_game_clean;
  END IF;

  -- Check In-Game Harvest Permission
  v_harvest_enabled := COALESCE((v_game_settings->v_game_key->>'harvest_enabled')::boolean, true);

  SELECT COUNT(*) INTO v_daily_completed_count
  FROM arcade_sessions
  WHERE player_id = v_pid
    AND LOWER(REPLACE(COALESCE(game_name, ''), ' ', '')) = v_game_clean
    AND created_at >= (NOW() - INTERVAL '24 hours')
    AND status = 'completed';

  IF v_daily_completed_count >= v_max_daily_plays THEN
    UPDATE arcade_sessions SET status = 'expired', duration_seconds = v_duration_seconds WHERE id = v_session_uuid;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily play limit exceeded (' || v_max_daily_plays || '/' || v_max_daily_plays || ' runs completed in last 24 hours)',
      'limit_reached', true
    );
  END IF;

  SELECT * INTO v_user FROM users WHERE player_id = v_pid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User record not found');
  END IF;

  -- 2.0x VIP Multiplier
  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_vip_mult := 2.0;
  END IF;

  -- 2.0x Ambassador Multiplier
  IF v_user.is_ambassador = true THEN
    v_amb_mult := 2.0;
  END IF;

  -- 1.5x Serie 1 Apex Relics Multiplier
  IF is_season1_apex_unlocked(v_user.relics) THEN
    v_relic_mult := 1.5;
  END IF;

  v_total_multiplier := v_clamped_nft_mult * v_relic_mult * v_vip_mult * v_amb_mult;

  -- Calculate Game-Specific Base PGT Formulas (HUD Parity)
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
  ELSE
    v_game_name := 'Arcade Game';
    v_raw_pgt := (v_clamped_score / 1000.0) * v_global_earn_mult;
  END IF;

  -- Enforce In-Game Harvest toggle: If harvest is disabled for this game, zero out score & token payout
  IF NOT v_harvest_enabled THEN
    v_raw_pgt := 0.0;
    v_final_pgt := 0.0;
  ELSE
    v_final_pgt := ROUND((v_raw_pgt * v_total_multiplier) + (v_clamped_tokens * 5.0), 2);
  END IF;

  v_new_weekly_games := COALESCE(v_user.weekly_games_played, 0) + 1;
  v_current_weekly_faucets := COALESCE(v_user.weekly_faucet_claims, 0);
  v_new_weekly_tier := compute_weekly_active_tier(v_current_weekly_faucets, v_new_weekly_games);

  -- Credit PGT and update weekly active activity
  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt,
      weekly_games_played = v_new_weekly_games,
      weekly_active_tier = v_new_weekly_tier,
      updated_at = v_now
  WHERE player_id = v_pid
  RETURNING balance_pgt INTO v_new_balance;

  -- Mark session completed
  UPDATE arcade_sessions
  SET status = 'completed',
      score = v_clamped_score,
      bonus_items = v_clamped_items,
      bonus_tokens = v_clamped_tokens,
      payout_pgt = v_final_pgt,
      duration_seconds = v_duration_seconds,
      completed_at = v_now
  WHERE id = v_session_uuid;

  -- Process referral commissions only if payout > 0
  IF v_final_pgt > 0 THEN
    PERFORM process_referral_commissions(v_pid, v_final_pgt, v_game_name);
  END IF;

  -- Update global game_metrics
  UPDATE game_metrics
  SET total_plays = total_plays + 1,
      total_pgt_distributed = total_pgt_distributed + v_final_pgt,
      last_played_at = v_now
  WHERE game_name = v_game_name;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_uuid,
    'player_id', v_pid,
    'game_name', v_game_name,
    'score', v_clamped_score,
    'payout', v_final_pgt,
    'payout_pgt', v_final_pgt,
    'harvest_enabled', v_harvest_enabled,
    'new_balance', v_new_balance,
    'multiplier', v_total_multiplier,
    'is_new_high', COALESCE(v_is_new_high, false),
    'weekly_games_played', v_new_weekly_games,
    'weekly_active_tier', v_new_weekly_tier,
    'duration_seconds', v_duration_seconds
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC) TO anon, authenticated, service_role;


-- 3. DISTRIBUTE WEEKLY ARCADE PRIZES (POOL > 0 ENFORCEMENT)
CREATE OR REPLACE FUNCTION public.distribute_weekly_arcade_prizes()
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
    v_games_processed := array_append(v_games_processed, 'Astro-Dodge (' || v_pool::TEXT || ' PGT)');
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
    v_games_processed := array_append(v_games_processed, 'Cyber Invaders (' || v_pool::TEXT || ' PGT)');
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
    v_games_processed := array_append(v_games_processed, 'Cyber Drift (' || v_pool::TEXT || ' PGT)');
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
    v_games_processed := array_append(v_games_processed, 'Cyber Stacker (' || v_pool::TEXT || ' PGT)');
  END IF;

  -- 5. CYBER SKEET POOL
  v_pool := COALESCE((v_settings->'skeet'->>'weekly_pool_pgt')::numeric, 25000);

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
    v_games_processed := array_append(v_games_processed, 'Cyber Skeet (' || v_pool::TEXT || ' PGT)');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'total_distributed', v_total_distributed,
    'winner_count', v_total_winners,
    'games_processed', v_games_processed,
    'week_label', v_week_label
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.distribute_weekly_arcade_prizes() TO anon, authenticated, service_role;


-- 4. DISTRIBUTE WEEKLY BOSS PRIZES (POOL > 0 ENFORCEMENT)
CREATE OR REPLACE FUNCTION public.distribute_weekly_boss_prizes()
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
  SELECT 
    COALESCE(boss_level, 1),
    COALESCE(boss_current_hp, 5000000),
    COALESCE(boss_max_hp, 5000000),
    game_payout_settings
  INTO v_boss_level, v_boss_current_hp, v_boss_max_hp, v_game_settings
  FROM global_settings
  WHERE id = 1;

  v_boss_pool := ROUND(10000.0 * POWER(1.10, GREATEST(0, v_boss_level - 1)));
  IF v_game_settings IS NOT NULL AND v_game_settings->'boss' IS NOT NULL AND (v_game_settings->'boss'->>'weekly_pool_pgt') IS NOT NULL THEN
    v_boss_pool := COALESCE((v_game_settings->'boss'->>'weekly_pool_pgt')::NUMERIC, v_boss_pool);
  END IF;

  SELECT COALESCE(SUM(boss_weekly_damage), 0)
  INTO v_total_damage
  FROM users
  WHERE boss_weekly_damage > 0;

  v_is_slain := (v_boss_current_hp <= 0);

  -- If pool set to 0, pause prize distribution but reset weekly damage
  IF v_boss_pool <= 0 THEN
    UPDATE users SET boss_weekly_damage = 0 WHERE boss_weekly_damage > 0;
    RETURN jsonb_build_object(
      'success', true,
      'message', 'World Boss weekly pool set to 0 PGT. Prize payout paused.',
      'slain', v_is_slain,
      'distributed_total', 0,
      'payout_count', 0
    );
  END IF;

  IF v_is_slain AND v_total_damage > 0 AND v_boss_pool > 0 THEN
    SELECT jsonb_agg(sub) INTO v_top_hunters
    FROM (
      SELECT 
        COALESCE(NULLIF(username, ''), SUBSTRING(player_id, 1, 8)) AS name,
        boss_weekly_damage AS damage,
        ROUND((boss_weekly_damage / v_total_damage) * v_boss_pool, 2) AS payout_pgt
      FROM users
      WHERE boss_weekly_damage > 0
      ORDER BY boss_weekly_damage DESC
      LIMIT 3
    ) sub;

    FOR v_winner IN
      SELECT player_id, boss_weekly_damage
      FROM users
      WHERE boss_weekly_damage > 0
    LOOP
      v_payout := ROUND((v_winner.boss_weekly_damage / v_total_damage) * v_boss_pool, 4);

      IF v_payout > 0 THEN
        UPDATE users
        SET 
          balance_pgt = COALESCE(balance_pgt, 0) + v_payout,
          updated_at = NOW()
        WHERE player_id = v_winner.player_id;

        v_payout_count := v_payout_count + 1;
        v_distributed_total := v_distributed_total + v_payout;
      END IF;
    END LOOP;

    v_new_level := v_boss_level + 1;
    v_new_max_hp := ROUND(5000000.0 * POWER(1.50, v_new_level - 1));
    v_new_pool := ROUND(10000.0 * POWER(1.20, v_new_level - 1));

    IF v_game_settings IS NULL THEN v_game_settings := '{}'::jsonb; END IF;
    IF v_game_settings->'boss' IS NULL THEN
      v_game_settings := jsonb_set(v_game_settings, '{boss}', '{"name": "👾 Cosmic World Boss (Quantum Leviathan)", "vip_only": false}'::jsonb);
    END IF;
    v_game_settings := jsonb_set(v_game_settings, '{boss,weekly_pool_pgt}', to_jsonb(v_new_pool));

    UPDATE global_settings
    SET 
      boss_level = v_new_level,
      boss_current_hp = v_new_max_hp,
      boss_max_hp = v_new_max_hp,
      game_payout_settings = v_game_settings,
      updated_at = NOW()
    WHERE id = 1;

    INSERT INTO boss_reset_history (
      week_label,
      boss_level,
      total_damage,
      distributed_total,
      hunters_count,
      slain,
      top_hunters,
      created_at
    ) VALUES (
      TO_CHAR(NOW(), 'YYYY-MM-DD'),
      v_boss_level,
      v_total_damage,
      v_distributed_total,
      v_payout_count,
      true,
      v_top_hunters,
      NOW()
    );

    UPDATE users SET boss_weekly_damage = 0 WHERE boss_weekly_damage > 0;

    RETURN jsonb_build_object(
      'success', true,
      'slain', true,
      'distributed_total', v_distributed_total,
      'payout_count', v_payout_count,
      'new_level', v_new_level,
      'new_max_hp', v_new_max_hp,
      'new_pool', v_new_pool
    );
  ELSE
    -- Boss survived: Retain level and HP, reset weekly damage
    UPDATE users SET boss_weekly_damage = 0 WHERE boss_weekly_damage > 0;

    INSERT INTO boss_reset_history (
      week_label,
      boss_level,
      total_damage,
      distributed_total,
      hunters_count,
      slain,
      top_hunters,
      created_at
    ) VALUES (
      TO_CHAR(NOW(), 'YYYY-MM-DD'),
      v_boss_level,
      v_total_damage,
      0,
      0,
      false,
      '[]'::jsonb,
      NOW()
    );

    RETURN jsonb_build_object(
      'success', true,
      'slain', false,
      'message', 'Boss survived. No bounties paid out this week.',
      'boss_level', v_boss_level,
      'boss_current_hp', v_boss_current_hp
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.distribute_weekly_boss_prizes() TO anon, authenticated, service_role;
