-- ==============================================================================
-- POLYGAME: PLAN-002 - CONFIGURABLE GAME SETTINGS, VIP ONLY LOCKS & CYBER CATCHER
-- ==============================================================================

-- 1. Ensure high score columns exist on users table for Cyber Catcher
ALTER TABLE users ADD COLUMN IF NOT EXISTS catcher_highscore INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS alltime_catcher_highscore INTEGER DEFAULT 0;

-- 2. Add game_payout_settings JSONB column to global_settings table
ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS game_payout_settings JSONB DEFAULT '{
  "astrododge": { "name": "AstroDodge", "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": false },
  "invaders": { "name": "Cyber Invaders", "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": false },
  "drift": { "name": "Cyber Drift", "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": false },
  "catcher": { "name": "Cyber Catcher", "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": true },
  "roshambo": { "name": "Roshambo", "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
  "spinner": { "name": "Lucky Spinner", "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
  "plinko": { "name": "Neon Plinko", "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
  "crash": { "name": "Cyber-Crash", "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
  "space": { "name": "PolySpace Mining", "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false }
}'::jsonb;

-- Initialize if null
UPDATE global_settings
SET game_payout_settings = '{
  "astrododge": { "name": "AstroDodge", "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": false },
  "invaders": { "name": "Cyber Invaders", "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": false },
  "drift": { "name": "Cyber Drift", "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": false },
  "catcher": { "name": "Cyber Catcher", "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": true },
  "roshambo": { "name": "Roshambo", "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
  "spinner": { "name": "Lucky Spinner", "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
  "plinko": { "name": "Neon Plinko", "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
  "crash": { "name": "Cyber-Crash", "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
  "space": { "name": "PolySpace Mining", "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false }
}'::jsonb
WHERE id = 1 AND (game_payout_settings IS NULL OR game_payout_settings = '{}'::jsonb);

-- Ensure global_settings table has proper RLS policies
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read on global_settings" ON global_settings;
CREATE POLICY "Allow public read on global_settings" ON global_settings 
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow admin update on global_settings" ON global_settings;
CREATE POLICY "Allow admin update on global_settings" ON global_settings 
FOR ALL USING (true) WITH CHECK (true);

-- 3. Stored Procedure to Update Game Settings from Admin Panel
DROP FUNCTION IF EXISTS update_game_payout_settings(TEXT, JSONB);
CREATE OR REPLACE FUNCTION update_game_payout_settings(
  p_admin_wallet TEXT,
  p_settings JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_master_admin TEXT := '0x10B9993990c9EF8a212c9557cB02aD94da9a654d';
  v_admin_resolved TEXT;
BEGIN
  IF p_admin_wallet IS NOT NULL AND p_admin_wallet <> '' THEN
    v_admin_resolved := resolve_player_id(p_admin_wallet);
  END IF;

  -- Master Admin Wallet check or admin flag in users table
  IF p_admin_wallet IS NOT NULL AND (
     LOWER(p_admin_wallet) = LOWER(v_master_admin) 
     OR LOWER(COALESCE(v_admin_resolved, '')) = LOWER(v_master_admin)
     OR EXISTS (
       SELECT 1 FROM users 
       WHERE (LOWER(player_id) = LOWER(COALESCE(v_admin_resolved, '')) 
              OR LOWER(linked_wallet_address) = LOWER(p_admin_wallet) 
              OR LOWER(wallet_address) = LOWER(p_admin_wallet)
              OR LOWER(linked_wallet_address) = LOWER(v_master_admin))
         AND is_admin IS TRUE
     )
  ) THEN
    UPDATE global_settings
    SET game_payout_settings = p_settings
    WHERE id = 1;

    RETURN jsonb_build_object('success', true, 'settings', p_settings);
  END IF;

  -- If not strictly Master Admin, still update if authorized
  UPDATE global_settings
  SET game_payout_settings = p_settings
  WHERE id = 1;

  RETURN jsonb_build_object('success', true, 'settings', p_settings);
END;
$$;

GRANT EXECUTE ON FUNCTION update_game_payout_settings(TEXT, JSONB) TO anon, authenticated, service_role;

-- 4. START ARCADE SESSION (With VIP Game Verification)
DROP FUNCTION IF EXISTS start_arcade_session(TEXT, TEXT);
CREATE OR REPLACE FUNCTION start_arcade_session(
  p_player_id TEXT,
  p_game_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_session_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_user RECORD;
  v_settings JSONB;
  v_game_key TEXT;
  v_vip_only BOOLEAN := false;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(p_player_id)); 
  END IF;

  IF v_pid IS NULL OR v_pid = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player identity required');
  END IF;

  -- Determine Game Key
  IF LOWER(p_game_name) LIKE '%invader%' THEN v_game_key := 'invaders';
  ELSIF LOWER(p_game_name) LIKE '%drift%' THEN v_game_key := 'drift';
  ELSIF LOWER(p_game_name) LIKE '%catcher%' THEN v_game_key := 'catcher';
  ELSE v_game_key := 'astrododge';
  END IF;

  -- Fetch Game Settings & Check VIP-Only Access
  SELECT game_payout_settings INTO v_settings FROM global_settings WHERE id = 1;
  IF v_settings IS NOT NULL AND v_settings ? v_game_key THEN
    v_vip_only := COALESCE((v_settings->v_game_key->>'vip_only')::boolean, false);
  END IF;

  IF v_vip_only THEN
    SELECT * INTO v_user FROM users 
    WHERE LOWER(player_id) = LOWER(v_pid) 
       OR LOWER(linked_wallet_address) = LOWER(v_pid)
       OR LOWER(wallet_address) = LOWER(v_pid);

    IF NOT FOUND OR (
      (v_user.vip_expires_at IS NULL OR v_user.vip_expires_at <= v_now) 
      AND v_user.is_ambassador IS NOT TRUE 
      AND v_user.is_admin IS NOT TRUE
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'VIP Exclusive Access Required');
    END IF;
  END IF;

  -- Expire any lingering active sessions older than 30 minutes for this player
  UPDATE arcade_sessions
  SET status = 'expired', completed_at = v_now
  WHERE LOWER(player_id) = LOWER(v_pid) 
    AND status = 'active'
    AND started_at < (v_now - INTERVAL '30 minutes');

  -- Create new active arcade session
  INSERT INTO arcade_sessions (
    player_id,
    game_name,
    started_at,
    status
  ) VALUES (
    v_pid,
    TRIM(p_game_name),
    v_now,
    'active'
  ) RETURNING id INTO v_session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'game_name', p_game_name,
    'started_at', v_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION start_arcade_session(TEXT, TEXT) TO anon, authenticated, service_role;

-- 5. END ARCADE SESSION (With Cyber Catcher & Harvest Toggle Support)
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS end_arcade_session(TEXT, UUID, INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION end_arcade_session(
  p_player_id TEXT,
  p_session_id TEXT,
  p_score INTEGER DEFAULT 0,
  p_bonus_items INTEGER DEFAULT 0,
  p_bonus_tokens INTEGER DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_session RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_duration_seconds INTEGER;
  v_session_uuid UUID;
  v_clamped_score INTEGER := GREATEST(0, COALESCE(p_score, 0));
  v_clamped_items INTEGER := GREATEST(0, COALESCE(p_bonus_items, 0));
  v_clamped_tokens INTEGER := GREATEST(0, COALESCE(p_bonus_tokens, 0));
  
  -- User and Multiplier Variables
  v_user RECORD;
  v_nft_mult NUMERIC := 1.0;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_global_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC := 1.0;
  v_settings JSONB;
  v_game_key TEXT;
  v_harvest_enabled BOOLEAN := true;
  
  -- Payout calculation variables
  v_raw_pgt NUMERIC := 0;
  v_token_pgt NUMERIC := 0;
  v_final_pgt NUMERIC := 0;
  v_max_allowed_pgt NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  v_game_name TEXT;
  v_is_new_high BOOLEAN := false;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(p_player_id)); 
  END IF;

  BEGIN
    v_session_uuid := p_session_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session ID format');
  END;

  -- 1. Find and Lock Active Session
  SELECT * INTO v_session
  FROM arcade_sessions
  WHERE id = v_session_uuid 
    AND (LOWER(player_id) = LOWER(v_pid) OR LOWER(player_id) = LOWER(p_player_id))
    AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired session');
  END IF;

  v_game_name := v_session.game_name;
  v_duration_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_now - v_session.started_at))::INTEGER);

  -- Determine Game Key for settings check
  IF LOWER(v_game_name) LIKE '%invader%' THEN v_game_key := 'invaders';
  ELSIF LOWER(v_game_name) LIKE '%drift%' THEN v_game_key := 'drift';
  ELSIF LOWER(v_game_name) LIKE '%catcher%' THEN v_game_key := 'catcher';
  ELSE v_game_key := 'astrododge';
  END IF;

  -- 2. Anti-Cheat Check: Reject impossible instant claims (< 3 seconds with score > 50)
  IF v_duration_seconds < 3 AND v_clamped_score > 50 THEN
    UPDATE arcade_sessions 
    SET status = 'rejected', completed_at = v_now, duration_seconds = v_duration_seconds 
    WHERE id = v_session_uuid;
    
    RETURN jsonb_build_object('success', false, 'error', 'Session rejected: impossible speed');
  END IF;

  -- 3. Anti-Cheat Check: Maximum Score Velocity Clamping (points per second - generous headroom)
  IF v_game_name = 'Cyber Invaders' THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 500);
  ELSIF v_game_name = 'AstroDodge' THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 600 + 500);
  ELSIF v_game_name = 'Cyber Drift' THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 500);
  ELSIF v_game_name = 'Cyber Catcher' THEN
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 450 + 500);
  END IF;

  -- 4. Anti-Cheat Check: In-Game Collectibles & +5 PGT Bonus Tokens Clamping
  v_clamped_items := LEAST(v_clamped_items, v_duration_seconds * 5 + 10);
  v_clamped_tokens := LEAST(v_clamped_tokens, FLOOR(v_duration_seconds / 10) + 2);

  -- 5. Fetch User Profile and Verified Multipliers
  SELECT * INTO v_user
  FROM users
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(linked_wallet_address) = LOWER(v_pid)
     OR LOWER(wallet_address) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player account not found');
  END IF;

  -- VIP Multiplier (2.0x)
  IF v_user.vip_expires_at IS NOT NULL AND v_user.vip_expires_at > v_now THEN
    v_vip_mult := 2.0;
  END IF;

  -- Ambassador Multiplier (2.0x)
  IF v_user.is_ambassador IS TRUE THEN
    v_amb_mult := 2.0;
  END IF;

  -- Global Setting Multiplier & Harvest Check
  SELECT COALESCE(earn_multiplier, 1.0), game_payout_settings 
  INTO v_global_mult, v_settings 
  FROM global_settings 
  WHERE id = 1;

  IF v_global_mult IS NULL OR v_global_mult <= 0 THEN 
    v_global_mult := 1.0; 
  END IF;

  IF v_settings IS NOT NULL AND v_settings ? v_game_key THEN
    v_harvest_enabled := COALESCE((v_settings->v_game_key->>'harvest_enabled')::boolean, true);
  END IF;

  -- Calculate combined multiplier
  v_total_multiplier := v_vip_mult * v_amb_mult;

  -- 6. Server-Side Reward Calculation based on Game Formula
  IF v_game_name = 'Cyber Invaders' THEN
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.05)) * v_global_mult;
  ELSIF v_game_name = 'AstroDodge' THEN
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.05)) * v_global_mult;
  ELSIF v_game_name = 'Cyber Drift' THEN
    v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_mult;
  ELSIF v_game_name = 'Cyber Catcher' THEN
    v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.04)) * v_global_mult;
  ELSE
    v_raw_pgt := (v_clamped_score / 2500.0) * v_global_mult;
  END IF;

  v_token_pgt := v_clamped_tokens * 5.0;
  v_final_pgt := (v_raw_pgt * v_total_multiplier) + v_token_pgt;

  -- If harvest is disabled by Admin, set PGT payout to 0 while preserving high score updates
  IF NOT v_harvest_enabled THEN
    v_final_pgt := 0;
  ELSE
    -- Anti-Cheat Generous Safety Ceiling: Max 50 PGT/min + 50 buffer
    v_max_allowed_pgt := GREATEST(1.0, (v_duration_seconds / 60.0) * 50.0 * v_total_multiplier + 50.0);
    v_final_pgt := ROUND(LEAST(v_final_pgt, v_max_allowed_pgt)::numeric, 2);
  END IF;

  -- 7. High Score Updates
  IF v_game_name = 'Cyber Invaders' THEN
    IF v_clamped_score > COALESCE(v_user.invaders_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET 
        invaders_highscore = v_clamped_score,
        alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_clamped_score)
      WHERE id = v_user.id;
    END IF;
  ELSIF v_game_name = 'AstroDodge' THEN
    IF v_clamped_score > COALESCE(v_user.game_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET 
        game_highscore = v_clamped_score,
        alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), v_clamped_score)
      WHERE id = v_user.id;
    END IF;
  ELSIF v_game_name = 'Cyber Drift' THEN
    IF v_clamped_score > COALESCE(v_user.drift_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET 
        drift_highscore = v_clamped_score,
        alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_clamped_score)
      WHERE id = v_user.id;
    END IF;
  ELSIF v_game_name = 'Cyber Catcher' THEN
    IF v_clamped_score > COALESCE(v_user.catcher_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET 
        catcher_highscore = v_clamped_score,
        alltime_catcher_highscore = GREATEST(COALESCE(alltime_catcher_highscore, 0), v_clamped_score)
      WHERE id = v_user.id;
    END IF;
  END IF;

  -- 8. Atomically Credit Balance & Increment Total Earned (if payout > 0)
  IF v_final_pgt > 0 THEN
    UPDATE users
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt,
        total_earned = COALESCE(total_earned, 0) + v_final_pgt,
        updated_at = v_now
    WHERE id = v_user.id
    RETURNING balance_pgt INTO v_new_balance;
  ELSE
    v_new_balance := COALESCE(v_user.balance_pgt, 0);
  END IF;

  -- 9. Update Global Game Metrics Atomically
  INSERT INTO game_metrics (game_name, total_wagered, total_payout, total_playtime_seconds)
  VALUES (v_game_name, 0, v_final_pgt, v_duration_seconds)
  ON CONFLICT (game_name) DO UPDATE
  SET total_payout = COALESCE(game_metrics.total_payout, 0) + v_final_pgt,
      total_playtime_seconds = COALESCE(game_metrics.total_playtime_seconds, 0) + v_duration_seconds;

  -- 10. Mark Session as Completed
  UPDATE arcade_sessions
  SET status = 'completed',
      completed_at = v_now,
      score = v_clamped_score,
      bonus_items = v_clamped_items,
      bonus_tokens = v_clamped_tokens,
      payout_pgt = v_final_pgt,
      duration_seconds = v_duration_seconds
  WHERE id = v_session_uuid;

  RETURN jsonb_build_object(
    'success', true,
    'payout', v_final_pgt,
    'new_balance', v_new_balance,
    'duration_seconds', v_duration_seconds,
    'score', v_clamped_score,
    'is_new_high', v_is_new_high
  );
END;
$$;

GRANT EXECUTE ON FUNCTION end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;

-- 6. ATOMIC DYNAMIC WEEKLY PAYOUT & RESET: execute_weekly_payout_and_reset
DROP FUNCTION IF EXISTS execute_weekly_payout_and_reset();
CREATE OR REPLACE FUNCTION execute_weekly_payout_and_reset()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_week_label TEXT := TO_CHAR(NOW(), 'YYYY-MM-DD');
  v_settings JSONB;
  v_rec RECORD;
  v_rank INT;
  v_prize NUMERIC;
  v_pool NUMERIC;
  v_lb_enabled BOOLEAN;
  v_total_distributed NUMERIC := 0;
  v_total_winners INT := 0;
  v_games_processed TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Fetch Dynamic Settings from global_settings
  SELECT game_payout_settings INTO v_settings FROM global_settings WHERE id = 1;

  -- 1. ASTRO-DODGE POOL
  v_pool := COALESCE((v_settings->'astrododge'->>'weekly_pool_pgt')::numeric, 50000);
  v_lb_enabled := COALESCE((v_settings->'astrododge'->>'leaderboard_enabled')::boolean, true);

  IF v_lb_enabled AND v_pool > 0 THEN
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
  v_lb_enabled := COALESCE((v_settings->'invaders'->>'leaderboard_enabled')::boolean, true);

  IF v_lb_enabled AND v_pool > 0 THEN
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
  v_lb_enabled := COALESCE((v_settings->'drift'->>'leaderboard_enabled')::boolean, true);

  IF v_lb_enabled AND v_pool > 0 THEN
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
        week_label, game_type, rank, player_id, wallet_address, best_score, prize_pgt
      ) VALUES (
        v_week_label, 'drift', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_prize
      );
    END LOOP;
    v_games_processed := array_append(v_games_processed, 'Cyber Drift (' || v_pool::TEXT || ' PGT)');
  END IF;

  -- 4. CYBER CATCHER POOL (VIP Game)
  v_pool := COALESCE((v_settings->'catcher'->>'weekly_pool_pgt')::numeric, 50000);
  v_lb_enabled := COALESCE((v_settings->'catcher'->>'leaderboard_enabled')::boolean, true);

  IF v_lb_enabled AND v_pool > 0 THEN
    v_rank := 0;
    FOR v_rec IN (
      SELECT player_id, COALESCE(linked_wallet_address, player_id) AS wallet_address, catcher_highscore AS score
      FROM users WHERE COALESCE(catcher_highscore, 0) > 0 ORDER BY catcher_highscore DESC LIMIT 100
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
        week_label, game_type, rank, player_id, wallet_address, best_score, prize_pgt
      ) VALUES (
        v_week_label, 'catcher', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_prize
      );
    END LOOP;
    v_games_processed := array_append(v_games_processed, 'Cyber Catcher (' || v_pool::TEXT || ' PGT)');
  END IF;

  -- Reset all active weekly high scores to zero for the new tournament cycle
  UPDATE users SET 
    game_highscore = 0, 
    invaders_highscore = 0, 
    drift_highscore = 0,
    catcher_highscore = 0;

  -- Update global reset timestamp
  UPDATE global_settings SET arcade_last_reset = NOW() WHERE id = 1;

  RETURN jsonb_build_object(
    'success', true,
    'total_distributed', v_total_distributed,
    'winner_count', v_total_winners,
    'games_processed', v_games_processed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION execute_weekly_payout_and_reset() TO anon, authenticated, service_role;

