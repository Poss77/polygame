-- ==============================================================================
-- POLYGAME: WEEKLY ACTIVE PARAMETER & ACTIVITY TIERS (LEVELS 0 TO 5)
-- ==============================================================================
-- - Adds weekly_faucet_claims, weekly_games_played, weekly_active_tier, last_weekly_active_tier
-- - Implements compute_weekly_active_tier() pure helper
-- - Updates claim_faucet() to increment weekly_faucet_claims and recompute weekly_active_tier
-- - Updates end_arcade_session() to increment weekly_games_played and recompute weekly_active_tier
-- - Updates execute_weekly_payout_and_reset() to snapshot last_weekly_active_tier and zero out active counters
-- ==============================================================================

-- 1. ADD COLUMNS TO USERS TABLE IF NOT PRESENT
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS weekly_faucet_claims INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS weekly_games_played INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS weekly_active_tier INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS last_weekly_active_tier INTEGER DEFAULT 0 NOT NULL;

-- Create performance indexes for querying active tiers
CREATE INDEX IF NOT EXISTS idx_users_weekly_active_tier ON public.users (weekly_active_tier);
CREATE INDEX IF NOT EXISTS idx_users_last_weekly_active_tier ON public.users (last_weekly_active_tier);

-- 2. TIER COMPUTATION HELPER FUNCTION
CREATE OR REPLACE FUNCTION compute_weekly_active_tier(p_faucets INT, p_games INT)
RETURNS INT 
LANGUAGE plpgsql 
IMMUTABLE 
AS \$\$
DECLARE
  v_f INT := GREATEST(0, COALESCE(p_faucets, 0));
  v_g INT := GREATEST(0, COALESCE(p_games, 0));
BEGIN
  IF v_f >= 6 AND v_g >= 50 THEN
    RETURN 5; -- 👑 Level 5: Apex Legend
  ELSIF v_f >= 5 AND v_g >= 25 THEN
    RETURN 4; -- 💎 Level 4: Elite Champion
  ELSIF v_f >= 3 AND v_g >= 5 THEN
    RETURN 3; -- 🥇 Level 3: Veteran
  ELSIF v_f >= 2 AND v_g >= 1 THEN
    RETURN 2; -- 🥈 Level 2: Contender
  ELSIF v_f >= 1 THEN
    RETURN 1; -- 🥉 Level 1: Scout
  ELSE
    RETURN 0; -- ⚪ Level 0: Dormant
  END IF;
END;
\$\$;
GRANT EXECUTE ON FUNCTION compute_weekly_active_tier(INT, INT) TO anon, authenticated, service_role;

-- 3. UPDATE FAUCET RPC (claim_faucet)
CREATE OR REPLACE FUNCTION claim_faucet(
  p_player_id TEXT,
  p_nft_multiplier NUMERIC DEFAULT 1.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS \$\$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_user RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_cooldown_hours NUMERIC := 24.0;
  v_is_vip BOOLEAN := false;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_streak INTEGER := 0;
  v_streak_bonus NUMERIC := 0.0;
  v_base_payout NUMERIC := 10.0;
  v_final_payout NUMERIC := 10.0;
  v_total_multiplier NUMERIC := 1.0;
  v_new_balance NUMERIC := 0;
  v_new_weekly_faucets INTEGER := 0;
  v_current_weekly_games INTEGER := 0;
  v_new_weekly_tier INTEGER := 0;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_player_id));
  END IF;

  SELECT * INTO v_user FROM users WHERE player_id = v_pid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_is_vip := true;
    v_vip_mult := 2.0;
    v_cooldown_hours := 21.6; -- 10% faster cooldown
  END IF;

  IF v_user.is_ambassador = true THEN
    v_amb_mult := 2.0;
  END IF;

  IF v_user.last_faucet_claim IS NOT NULL AND v_now < (v_user.last_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Faucet on cooldown',
      'next_claim', v_user.last_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')
    );
  END IF;

  -- Daily streak calculation (within 48h preserves streak)
  IF v_user.last_faucet_claim IS NOT NULL AND v_now < (v_user.last_faucet_claim + INTERVAL '48 hours') THEN
    v_streak := LEAST(COALESCE(v_user.faucet_streak, 0) + 1, 7);
  ELSE
    v_streak := 1;
  END IF;

  v_streak_bonus := (v_streak - 1) * 0.05; -- +5% per streak day up to +30%
  v_total_multiplier := (GREATEST(1.0, LEAST(COALESCE(p_nft_multiplier, 1.0), 5.0)) + v_streak_bonus) * v_vip_mult * v_amb_mult;
  v_final_payout := ROUND(v_base_payout * v_total_multiplier, 2);

  v_new_weekly_faucets := COALESCE(v_user.weekly_faucet_claims, 0) + 1;
  v_current_weekly_games := COALESCE(v_user.weekly_games_played, 0);
  v_new_weekly_tier := compute_weekly_active_tier(v_new_weekly_faucets, v_current_weekly_games);

  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_payout,
      last_faucet_claim = v_now,
      faucet_streak = v_streak,
      weekly_faucet_claims = v_new_weekly_faucets,
      weekly_active_tier = v_new_weekly_tier,
      updated_at = v_now
  WHERE player_id = v_pid
  RETURNING balance_pgt INTO v_new_balance;

  PERFORM process_referral_commissions(v_pid, v_final_payout, 'Faucet Claim');

  RETURN jsonb_build_object(
    'success', true,
    'payout_pgt', v_final_payout,
    'multiplier', v_total_multiplier,
    'streak', v_streak,
    'new_balance', v_new_balance,
    'weekly_faucet_claims', v_new_weekly_faucets,
    'weekly_active_tier', v_new_weekly_tier,
    'claimed_at', v_now
  );
END;
\$\$;
GRANT EXECUTE ON FUNCTION claim_faucet(TEXT, NUMERIC) TO anon, authenticated, service_role;

-- 4. UPDATE ARCADE SESSION COMPLETION RPC (end_arcade_session)
CREATE OR REPLACE FUNCTION end_arcade_session(
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
AS \$\$
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
  v_total_multiplier NUMERIC;
  v_raw_pgt NUMERIC;
  v_final_pgt NUMERIC;
  v_new_balance NUMERIC;
  v_game_name TEXT;
  v_game_clean TEXT;
  v_is_new_high BOOLEAN;
  v_max_daily_plays INTEGER;
  v_daily_completed_count INTEGER;
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

  SELECT COALESCE(max_daily_plays_per_game, 25) INTO v_max_daily_plays
  FROM global_settings WHERE id = 1 LIMIT 1;

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

  v_total_multiplier := v_clamped_nft_mult * v_vip_mult * v_amb_mult;

  -- Calculate Game-Specific Base PGT Formulas (Exact Match with Client HUDs)
  IF v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge' THEN
    v_game_name := 'AstroDodge';
    v_raw_pgt := (v_clamped_score / 2500.0) + (v_clamped_items * 0.05);
    IF v_clamped_score > COALESCE(v_user.game_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET game_highscore = v_clamped_score, alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%invader%' THEN
    v_game_name := 'Cyber Invaders';
    v_raw_pgt := (v_clamped_score / 2000.0) + (v_clamped_items * 0.04);
    IF v_clamped_score > COALESCE(v_user.invaders_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET invaders_highscore = v_clamped_score, alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%drift%' THEN
    v_game_name := 'Cyber Drift';
    v_raw_pgt := (v_clamped_score / 2500.0) + (v_clamped_items * 0.04);
    IF v_clamped_score > COALESCE(v_user.drift_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET drift_highscore = v_clamped_score, alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%' THEN
    v_game_name := 'Cyber Stacker';
    v_raw_pgt := (v_clamped_items * 0.45) + (v_clamped_score / 1500.0);
    IF v_clamped_score > COALESCE(v_user.stacker_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET stacker_highscore = v_clamped_score, 
          alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%skeet%' THEN
    v_game_name := 'Cyber Skeet';
    v_raw_pgt := (v_clamped_score / 1800.0);
    IF v_clamped_score > COALESCE(v_user.skeet_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET skeet_highscore = v_clamped_score, 
          alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;
  ELSE
    v_game_name := 'Arcade Game';
    v_raw_pgt := (v_clamped_score / 1000.0);
  END IF;

  -- 5 PGT flat bonus per collectible token / canister / golden core
  v_final_pgt := ROUND((v_raw_pgt * v_total_multiplier) + (v_clamped_tokens * 5.0), 2);

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

  -- Update game_metrics for arcade analytics
  BEGIN
    INSERT INTO public.game_metrics (game_name, total_wagered, total_payout, total_playtime_seconds)
    VALUES (v_game_name, 0, v_final_pgt, v_duration_seconds)
    ON CONFLICT (game_name) DO UPDATE
    SET total_payout = COALESCE(public.game_metrics.total_payout, 0) + v_final_pgt,
        total_playtime_seconds = COALESCE(public.game_metrics.total_playtime_seconds, 0) + v_duration_seconds;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  IF v_final_pgt > 0 THEN
    PERFORM process_referral_commissions(v_pid, v_final_pgt, v_game_name);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payout_pgt', v_final_pgt,
    'total_multiplier', v_total_multiplier,
    'new_balance', v_new_balance,
    'is_new_highscore', v_is_new_high,
    'game_name', v_game_name,
    'weekly_games_played', v_new_weekly_games,
    'weekly_active_tier', v_new_weekly_tier,
    'session_id', v_session_uuid
  );
END;
\$\$;
GRANT EXECUTE ON FUNCTION end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC) TO anon, authenticated, service_role;

-- 5. UPDATE WEEKLY RESET RPC (execute_weekly_payout_and_reset)
-- Resets high scores, archives previous week's active tier, and resets weekly counters
CREATE OR REPLACE FUNCTION execute_weekly_payout_and_reset()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS \$\$
DECLARE
  v_pool NUMERIC := 50000;
  v_prizes NUMERIC[] := ARRAY[15000, 10000, 7500, 5000, 3500, 2500, 2000, 1750, 1500, 1250];
  v_rec RECORD;
  v_rank INTEGER;
  v_prize NUMERIC;
  v_total_distributed NUMERIC := 0;
  v_total_winners INTEGER := 0;
  v_week_label TEXT := TO_CHAR(NOW() - INTERVAL '1 day', 'YYYY-MM-DD');
  v_games_processed TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- 1. ASTRO-DODGE POOL
  v_rank := 0;
  FOR v_rec IN 
    SELECT player_id, linked_wallet_address AS wallet_address, game_highscore AS score 
    FROM users 
    WHERE COALESCE(game_highscore, 0) > 0 
    ORDER BY game_highscore DESC 
    LIMIT 10 
  LOOP
    v_rank := v_rank + 1;
    v_prize := v_prizes[v_rank];
    IF v_prize > 0 THEN
      UPDATE users SET balance_pgt = COALESCE(balance_pgt, 0) + v_prize WHERE player_id = v_rec.player_id;
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

  -- 2. CYBER INVADERS POOL
  v_rank := 0;
  FOR v_rec IN 
    SELECT player_id, linked_wallet_address AS wallet_address, invaders_highscore AS score 
    FROM users 
    WHERE COALESCE(invaders_highscore, 0) > 0 
    ORDER BY invaders_highscore DESC 
    LIMIT 10 
  LOOP
    v_rank := v_rank + 1;
    v_prize := v_prizes[v_rank];
    IF v_prize > 0 THEN
      UPDATE users SET balance_pgt = COALESCE(balance_pgt, 0) + v_prize WHERE player_id = v_rec.player_id;
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

  -- 3. CYBER DRIFT POOL
  v_rank := 0;
  FOR v_rec IN 
    SELECT player_id, linked_wallet_address AS wallet_address, drift_highscore AS score 
    FROM users 
    WHERE COALESCE(drift_highscore, 0) > 0 
    ORDER BY drift_highscore DESC 
    LIMIT 10 
  LOOP
    v_rank := v_rank + 1;
    v_prize := v_prizes[v_rank];
    IF v_prize > 0 THEN
      UPDATE users SET balance_pgt = COALESCE(balance_pgt, 0) + v_prize WHERE player_id = v_rec.player_id;
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

  -- 4. CYBER STACKER POOL
  v_rank := 0;
  FOR v_rec IN 
    SELECT player_id, linked_wallet_address AS wallet_address, stacker_highscore AS score 
    FROM users 
    WHERE COALESCE(stacker_highscore, 0) > 0 
    ORDER BY stacker_highscore DESC 
    LIMIT 10 
  LOOP
    v_rank := v_rank + 1;
    v_prize := v_prizes[v_rank];
    IF v_prize > 0 THEN
      UPDATE users SET balance_pgt = COALESCE(balance_pgt, 0) + v_prize WHERE player_id = v_rec.player_id;
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

  -- 5. CYBER SKEET POOL
  v_rank := 0;
  FOR v_rec IN 
    SELECT player_id, linked_wallet_address AS wallet_address, skeet_highscore AS score 
    FROM users 
    WHERE COALESCE(skeet_highscore, 0) > 0 
    ORDER BY skeet_highscore DESC 
    LIMIT 10 
  LOOP
    v_rank := v_rank + 1;
    v_prize := v_prizes[v_rank];
    IF v_prize > 0 THEN
      UPDATE users SET balance_pgt = COALESCE(balance_pgt, 0) + v_prize WHERE player_id = v_rec.player_id;
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

  -- 6. RESET WEEKLY HIGH SCORES & SNAPSHOT WEEKLY ACTIVE TIERS
  UPDATE users
  SET 
    alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), COALESCE(game_highscore, 0)),
    alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0)),
    alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0)),
    alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), COALESCE(stacker_highscore, 0)),
    alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), COALESCE(skeet_highscore, 0)),
    game_highscore = 0,
    invaders_highscore = 0,
    drift_highscore = 0,
    stacker_highscore = 0,
    skeet_highscore = 0,
    last_weekly_active_tier = COALESCE(weekly_active_tier, 0),
    weekly_faucet_claims = 0,
    weekly_games_played = 0,
    weekly_active_tier = 0,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'total_distributed', v_total_distributed,
    'winner_count', v_total_winners,
    'games_processed', v_games_processed,
    'week_label', v_week_label
  );
END;
\$\$;
GRANT EXECUTE ON FUNCTION execute_weekly_payout_and_reset() TO anon, authenticated, service_role;
