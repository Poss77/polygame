-- ==============================================================================
-- POLYGAME MIGRATION: DROP LEGACY CATCHER & STAKES COLUMNS
-- ==============================================================================
-- 1. Ensure stacker_highscore and alltime_stacker_highscore exist
-- 2. Consolidate career all-time high scores across all players
-- 3. Reset active weekly stacker_highscore to 0
-- 4. Safely DROP legacy columns from users table:
--    - alltime_catcher_highscore
--    - catcher_highscore
--    - stakes (all active stakes are in user_stakes table)
-- 5. Update submit_arcade_highscore & end_arcade_session RPCs
-- ==============================================================================

-- 1. Ensure stacker columns exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stacker_highscore INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alltime_stacker_highscore INTEGER DEFAULT 0;

-- 2. Consolidate career best scores into alltime_stacker_highscore (if legacy columns present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'alltime_catcher_highscore'
  ) THEN
    UPDATE public.users 
    SET alltime_stacker_highscore = GREATEST(
      COALESCE(alltime_stacker_highscore, 0), 
      COALESCE(alltime_catcher_highscore, 0), 
      COALESCE(stacker_highscore, 0), 
      COALESCE(catcher_highscore, 0)
    );
  END IF;
END $$;

-- 3. Zero out active weekly high scores for Cyber Stacker
UPDATE public.users 
SET stacker_highscore = 0;

-- 4. Drop legacy columns from users table
ALTER TABLE public.users DROP COLUMN IF EXISTS alltime_catcher_highscore;
ALTER TABLE public.users DROP COLUMN IF EXISTS catcher_highscore;
ALTER TABLE public.users DROP COLUMN IF EXISTS stakes;

-- 5. Recreate submit_arcade_highscore RPC with clean stacker support
CREATE OR REPLACE FUNCTION submit_arcade_highscore(
  p_player_id TEXT,
  p_game_highscore INTEGER DEFAULT NULL,
  p_invaders_highscore INTEGER DEFAULT NULL,
  p_drift_highscore INTEGER DEFAULT NULL,
  p_stacker_highscore INTEGER DEFAULT NULL,
  p_catcher_highscore INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_stacker_val INTEGER := COALESCE(p_stacker_highscore, p_catcher_highscore);
BEGIN
  IF v_pid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  UPDATE users
  SET 
    game_highscore = GREATEST(COALESCE(game_highscore, 0), COALESCE(p_game_highscore, 0)),
    invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), COALESCE(p_invaders_highscore, 0)),
    drift_highscore = GREATEST(COALESCE(drift_highscore, 0), COALESCE(p_drift_highscore, 0)),
    stacker_highscore = GREATEST(COALESCE(stacker_highscore, 0), COALESCE(v_stacker_val, 0)),
    alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), COALESCE(game_highscore, 0), COALESCE(p_game_highscore, 0)),
    alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0), COALESCE(p_invaders_highscore, 0)),
    alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0), COALESCE(p_drift_highscore, 0)),
    alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), COALESCE(stacker_highscore, 0), COALESCE(v_stacker_val, 0)),
    updated_at = NOW()
  WHERE player_id = v_pid;

  RETURN jsonb_build_object('success', true);
END;
$$;
GRANT EXECUTE ON FUNCTION submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO anon, authenticated, service_role;

-- 6. Recreate end_arcade_session RPC with clean stacker support
CREATE OR REPLACE FUNCTION end_arcade_session(
  p_session_id TEXT,
  p_score INTEGER,
  p_bonus_items INTEGER,
  p_bonus_tokens INTEGER,
  p_nft_multiplier NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session RECORD;
  v_user RECORD;
  v_pid TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_session_uuid UUID;
  v_game_name TEXT;
  v_game_clean TEXT;
  v_max_daily_plays INTEGER := 35;
  v_daily_completed_count INTEGER := 0;
  v_duration_seconds INTEGER;
  v_raw_pgt NUMERIC := 0.0;
  v_final_pgt NUMERIC := 0.0;
  v_total_multiplier NUMERIC := 1.0;
  v_clamped_nft_mult NUMERIC;
  v_clamped_score INTEGER;
  v_clamped_items INTEGER;
  v_clamped_tokens INTEGER;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_relic_mult NUMERIC := 1.0;
  v_is_new_high BOOLEAN := false;
  v_new_balance NUMERIC := 0.0;
  v_max_plays INTEGER;
BEGIN
  BEGIN
    v_session_uuid := p_session_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid arcade session UUID format');
  END;

  v_clamped_score := GREATEST(0, LEAST(COALESCE(p_score, 0), 20000000));
  v_clamped_items := GREATEST(0, LEAST(COALESCE(p_bonus_items, 0), 5000));
  v_clamped_tokens := GREATEST(0, LEAST(COALESCE(p_bonus_tokens, 0), 100));
  v_clamped_nft_mult := GREATEST(1.0, LEAST(COALESCE(p_nft_multiplier, 1.0), 30.0));

  SELECT * INTO v_session
  FROM arcade_sessions
  WHERE id = v_session_uuid
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

  v_pid := v_session.player_id;
  v_game_clean := LOWER(REPLACE(COALESCE(v_session.game_name, ''), ' ', ''));

  SELECT COALESCE(max_daily_plays_per_game, 35) INTO v_max_plays
  FROM global_settings WHERE id = 1 LIMIT 1;
  IF v_max_plays IS NOT NULL AND v_max_plays > 0 THEN
    v_max_daily_plays := v_max_plays;
  END IF;

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

  -- 1.5x Apex Relics Multiplier (Owning 17 Season 1 Relics)
  IF (v_user.relics IS NOT NULL AND jsonb_typeof(v_user.relics) = 'object') THEN
    IF (v_user.relics ? 'relic_astrododge_prism') AND (v_user.relics ? 'relic_astrododge_deflector') AND (v_user.relics ? 'relic_astrododge_compass') AND
       (v_user.relics ? 'relic_invaders_core') AND (v_user.relics ? 'relic_invaders_dynamo') AND (v_user.relics ? 'relic_invaders_transmitter') AND
       (v_user.relics ? 'relic_drift_chronometer') AND (v_user.relics ? 'relic_drift_capacitor') AND (v_user.relics ? 'relic_drift_overdrive') AND
       (v_user.relics ? 'relic_stacker_foundation') AND (v_user.relics ? 'relic_stacker_keystone') AND (v_user.relics ? 'relic_stacker_monolith') AND
       (v_user.relics ? 'relic_space_darkmatter') AND (v_user.relics ? 'relic_space_warpcoil') AND (v_user.relics ? 'relic_space_plasma') AND
       (v_user.relics ? 'relic_apex_singularity') AND (v_user.relics ? 'relic_apex_genesis') THEN
      v_relic_mult := 1.5;
    END IF;
  END IF;

  v_total_multiplier := v_clamped_nft_mult * v_vip_mult * v_amb_mult * v_relic_mult;

  -- Calculate Game-Specific Base PGT Formulas (Exact Match with Client HUDs)
  IF v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge' THEN
    v_game_name := 'AstroDodge';
    -- HUD Formula: (score / 2500.0) + (shards * 0.05)
    v_raw_pgt := (v_clamped_score / 2500.0) + (v_clamped_items * 0.05);
    IF v_clamped_score > COALESCE(v_user.game_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET game_highscore = v_clamped_score, alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%invader%' THEN
    v_game_name := 'Cyber Invaders';
    -- HUD Formula: (score / 2000.0) + (aliens * 0.04)
    v_raw_pgt := (v_clamped_score / 2000.0) + (v_clamped_items * 0.04);
    IF v_clamped_score > COALESCE(v_user.invaders_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET invaders_highscore = v_clamped_score, alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%drift%' THEN
    v_game_name := 'Cyber Drift';
    -- HUD Formula: (score / 2500.0) + (orbs * 0.04)
    v_raw_pgt := (v_clamped_score / 2500.0) + (v_clamped_items * 0.04);
    IF v_clamped_score > COALESCE(v_user.drift_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users SET drift_highscore = v_clamped_score, alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_clamped_score) WHERE player_id = v_pid;
    END IF;

  ELSIF v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%' THEN
    v_game_name := 'Cyber Stacker';
    -- HUD Formula: (floors * 0.45) + (score / 1500.0)
    v_raw_pgt := (v_clamped_items * 0.45) + (v_clamped_score / 1500.0);
    IF v_clamped_score > COALESCE(v_user.stacker_highscore, 0) THEN
      v_is_new_high := true;
      UPDATE users 
      SET stacker_highscore = v_clamped_score, 
          alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), v_clamped_score) 
      WHERE player_id = v_pid;
    END IF;
  ELSE
    v_game_name := 'Arcade Game';
    v_raw_pgt := (v_clamped_score / 1000.0);
  END IF;

  -- 5 PGT flat bonus per collectible token / canister / golden core
  v_final_pgt := ROUND((v_raw_pgt * v_total_multiplier) + (v_clamped_tokens * 5.0), 2);

  -- Credit PGT to users table balance
  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt,
      total_earned = COALESCE(total_earned, 0) + v_final_pgt,
      updated_at = v_now
  WHERE player_id = v_pid
  RETURNING balance_pgt INTO v_new_balance;

  -- Mark session completed
  UPDATE arcade_sessions
  SET status = 'completed',
      score = v_clamped_score,
      bonus_items = v_clamped_items,
      bonus_tokens = v_clamped_tokens,
      nft_multiplier = v_clamped_nft_mult,
      vip_multiplier = v_vip_mult,
      payout_pgt = v_final_pgt,
      duration_seconds = v_duration_seconds
  WHERE id = v_session_uuid;

  -- Process 4-Tier Referral Commissions
  IF v_final_pgt > 0 THEN
    PERFORM process_referral_commissions(v_pid, v_final_pgt, 'PGT', v_game_name);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payout_pgt', v_final_pgt,
    'payout', v_final_pgt,
    'new_balance', v_new_balance,
    'is_new_high', v_is_new_high,
    'game_name', v_game_name
  );
END;
$$;
GRANT EXECUTE ON FUNCTION end_arcade_session(TEXT, INTEGER, INTEGER, INTEGER, NUMERIC) TO anon, authenticated, service_role;
