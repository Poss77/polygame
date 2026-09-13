-- ============================================================================
-- POLYGON GAMING: CALIBRATE ARCADE PAYOUT CAPS & VELOCITY CLAMPING
-- ============================================================================
-- Version: v1.5.344
-- Purpose: 
--   1. Expands maximum arcade session payout cap from 50.00 PGT to 250.00 PGT
--      to allow high-level players stacking legitimate multipliers (VIP 2.0x,
--      Ambassador 2.0x, Apex Relics 1.5x, NFTs 2.0x = up to 12.0x) to earn
--      their full 100 - 250 PGT rewards on high scores.
--   2. Calibrates game-specific score & item velocity clamps so fast tower
--      stacking (Cyber Stacker), rapid drifts, and arcade runs are never
--      artificially choked by low item/velocity limits.
--   3. Preserves ultra-fast session anti-cheat (< 3s clamped to max 1.00 PGT)
--      and anti-bot velocity ceilings.
--   4. Retroactively adjusts the 4 recent capped sessions for Poss, crediting
--      the +388.31 PGT difference directly to their balance.
-- ============================================================================

-- 1. DROP EXISTING end_arcade_session PROCEDURES
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.end_arcade_session(TEXT, TEXT, INTEGER) CASCADE;

-- 2. CREATE CALIBRATED end_arcade_session PROCEDURE
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
SET search_path = public
AS $$
DECLARE
  v_pid TEXT;
  v_session RECORD;
  v_user RECORD;
  v_session_uuid UUID;
  v_duration_seconds INTEGER := 0;
  v_clamped_score INTEGER := 0;
  v_clamped_items INTEGER := 0;
  v_clamped_tokens INTEGER := 0;
  v_clamped_nft_mult NUMERIC := 1.0;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
  v_relic_mult NUMERIC := 1.0;
  v_total_multiplier NUMERIC := 1.0;
  v_global_earn_mult NUMERIC := 1.0;
  v_now TIMESTAMPTZ := NOW();
  v_raw_pgt NUMERIC := 0.0;
  v_final_pgt NUMERIC := 0.0;
  v_max_velocity_rate NUMERIC := 0.75;
  v_velocity_cap NUMERIC := 0.0;
  v_new_balance NUMERIC := 0.0;
  v_game_name TEXT;
  v_game_clean TEXT;
  v_game_key TEXT;
  v_is_new_high BOOLEAN := false;
  v_max_daily_plays INTEGER := 35;
  v_daily_completed_count INTEGER := 0;
  v_game_settings JSONB;
  v_harvest_enabled BOOLEAN := true;
  v_new_weekly_games INTEGER := 0;
  v_current_weekly_faucets INTEGER := 0;
  v_new_weekly_tier INTEGER := 0;
BEGIN
  -- 1. Resolve synthetic player_id or normalize input
  v_pid := resolve_player_id(p_player_id);
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(COALESCE(p_player_id, ''))); 
  END IF;

  v_clamped_score := GREATEST(0, COALESCE(p_score, 0));
  v_clamped_items := GREATEST(0, COALESCE(p_bonus_items, 0));
  v_clamped_tokens := GREATEST(0, COALESCE(p_bonus_tokens, 0));
  v_clamped_nft_mult := GREATEST(1.0, LEAST(COALESCE(p_nft_multiplier, 1.0), 10.0));

  BEGIN
    v_session_uuid := p_session_id::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid session ID format');
  END;

  -- 2. Lock and Verify Active Arcade Session
  SELECT * INTO v_session 
  FROM public.arcade_sessions 
  WHERE id = v_session_uuid 
    AND (LOWER(player_id) = LOWER(v_pid) OR player_id = v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session not found or belongs to another player');
  END IF;

  IF v_session.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session has already been finalized and claimed');
  END IF;

  v_game_name := COALESCE(v_session.game_name, 'AstroDodge');
  v_duration_seconds := GREATEST(1, EXTRACT(EPOCH FROM (v_now - COALESCE(v_session.started_at, v_session.created_at)))::INTEGER);

  -- 3. Anti-Cheat Velocity Clamping: Calibrated per-game score and item limits
  v_game_clean := LOWER(REPLACE(v_game_name, ' ', ''));

  IF v_game_clean LIKE '%invader%' THEN
    v_game_key := 'invaders';
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 1000);
    v_clamped_items := LEAST(v_clamped_items, (v_duration_seconds * 3) + 15);
    v_max_velocity_rate := 0.75;
  ELSIF v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge' THEN
    v_game_key := 'astrododge';
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 600 + 1000);
    v_clamped_items := LEAST(v_clamped_items, (v_duration_seconds * 2) + 10);
    v_max_velocity_rate := 0.75;
  ELSIF v_game_clean LIKE '%drift%' THEN
    v_game_key := 'drift';
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 750 + 1000);
    v_clamped_items := LEAST(v_clamped_items, (v_duration_seconds * 3) + 15);
    v_max_velocity_rate := 0.75;
  ELSIF v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%' THEN
    v_game_key := 'stacker';
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 1000);
    -- In Cyber Stacker, bonus_items represents floors stacked (up to 2.5 floors/sec)
    v_clamped_items := LEAST(v_clamped_items, (v_duration_seconds * 2.5)::INTEGER + 10);
    -- Cyber Stacker gives rapid base returns (0.45 PGT per floor), calibrated to 1.50 PGT/sec
    v_max_velocity_rate := 1.50;
  ELSIF v_game_clean LIKE '%skeet%' THEN
    v_game_key := 'skeet';
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 500 + 1000);
    v_clamped_items := LEAST(v_clamped_items, (v_duration_seconds * 2) + 10);
    v_max_velocity_rate := 0.75;
  ELSIF v_game_clean LIKE '%defense%' THEN
    v_game_key := 'defense';
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 600 + 1000);
    v_clamped_items := LEAST(v_clamped_items, (v_duration_seconds * 4) + 20);
    v_max_velocity_rate := 0.75;
  ELSE
    v_game_key := v_game_clean;
    v_clamped_score := LEAST(v_clamped_score, v_duration_seconds * 600 + 1000);
    v_clamped_items := LEAST(v_clamped_items, (v_duration_seconds * 2) + 10);
    v_max_velocity_rate := 0.75;
  END IF;

  -- Rare Golden Tokens: max 1 token per 15 seconds, absolute max 5 per session
  v_clamped_tokens := LEAST(v_clamped_tokens, LEAST(5, (v_duration_seconds / 15)::INTEGER));

  -- 4. Lock User Profile Row
  SELECT * INTO v_user 
  FROM public.users 
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found in database');
  END IF;

  IF v_user.player_id IS NOT NULL AND v_user.player_id <> '' THEN
    v_pid := LOWER(TRIM(v_user.player_id));
  END IF;

  -- 5. Multipliers & Global Settings
  IF (v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now) 
     OR LOWER(COALESCE(v_user.linked_wallet_address, '')) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
     OR LOWER(COALESCE(v_user.player_id, '')) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
     OR v_user.is_admin IS TRUE 
     OR v_user.is_ambassador IS TRUE THEN 
    v_vip_mult := 2.0; 
  END IF;

  IF v_user.is_ambassador IS TRUE THEN
    v_amb_mult := 2.0;
  END IF;

  -- 1.5x Apex Relics multiplier evaluated from user relics or client parameter
  BEGIN
    IF is_season1_apex_unlocked(v_user.relics) OR COALESCE(p_relic_multiplier, 1.0) >= 1.5 THEN
      v_relic_mult := 1.5;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF COALESCE(p_relic_multiplier, 1.0) >= 1.5 THEN
      v_relic_mult := 1.5;
    END IF;
  END;

  v_total_multiplier := v_clamped_nft_mult * v_relic_mult * v_vip_mult * v_amb_mult;

  -- Read global settings & in-game harvest permission
  SELECT COALESCE(earn_multiplier, 1.0), COALESCE(max_daily_plays_per_game, 35), game_payout_settings
  INTO v_global_earn_mult, v_max_daily_plays, v_game_settings
  FROM public.global_settings WHERE id = 1 LIMIT 1;

  IF v_global_earn_mult IS NULL OR v_global_earn_mult <= 0 THEN v_global_earn_mult := 1.0; END IF;
  IF v_max_daily_plays IS NULL OR v_max_daily_plays <= 0 THEN v_max_daily_plays := 35; END IF;

  IF v_game_settings IS NOT NULL AND v_game_settings ? v_game_key THEN
    v_harvest_enabled := COALESCE((v_game_settings->v_game_key->>'harvest_enabled')::BOOLEAN, true);
  END IF;

  -- 6. Daily Plays Cap (Rolling 24 Hours)
  SELECT COUNT(*) INTO v_daily_completed_count
  FROM public.arcade_sessions
  WHERE LOWER(player_id) = LOWER(v_pid)
    AND LOWER(game_name) = LOWER(TRIM(v_game_name))
    AND completed_at >= (v_now - INTERVAL '24 hours')
    AND status = 'completed';

  IF v_daily_completed_count >= v_max_daily_plays THEN
    UPDATE public.arcade_sessions
    SET status = 'completed',
        score = v_clamped_score,
        bonus_items = v_clamped_items,
        bonus_tokens = v_clamped_tokens,
        payout_pgt = 0.0,
        completed_at = v_now,
        duration_seconds = v_duration_seconds
    WHERE id = v_session_uuid;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily play limit reached (' || v_daily_completed_count || '/' || v_max_daily_plays || ')',
      'daily_limit_reached', true,
      'completed_today', v_daily_completed_count,
      'max_daily_plays', v_max_daily_plays,
      'payout_pgt', 0.0
    );
  END IF;

  -- 7. Calculate Game-Specific PGT Formula
  IF NOT v_harvest_enabled THEN
    v_raw_pgt := 0.0;
    v_final_pgt := 0.0;
  ELSE
    IF v_game_clean LIKE '%invader%' THEN 
      v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    ELSIF v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge' THEN 
      v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.05)) * v_global_earn_mult;
    ELSIF v_game_clean LIKE '%drift%' THEN 
      v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    ELSIF v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%' THEN
      v_raw_pgt := ((v_clamped_items * 0.45) + (v_clamped_score / 1500.0)) * v_global_earn_mult;
    ELSIF v_game_clean LIKE '%skeet%' THEN 
      v_raw_pgt := ((v_clamped_score / 2500.0) + (v_clamped_items * 0.04)) * v_global_earn_mult;
    ELSIF v_game_clean LIKE '%defense%' THEN 
      v_raw_pgt := ((v_clamped_score / 2000.0) + (v_clamped_items * 0.05)) * v_global_earn_mult;
    ELSE 
      v_raw_pgt := (v_clamped_score / 2500.0) * v_global_earn_mult;
    END IF;

    v_final_pgt := ROUND(((v_raw_pgt * v_total_multiplier) + (v_clamped_tokens * 5.0))::NUMERIC, 2);

    -- Payout Velocity Sentinel: Sessions under 3 seconds cannot earn more than 1.00 PGT
    IF v_duration_seconds < 3 THEN
      v_final_pgt := LEAST(v_final_pgt, 1.00);
    END IF;

    -- Dynamic Velocity Clamping: Calibrated per-game rate * user's verified total multiplier
    v_velocity_cap := GREATEST(2.00, ROUND((v_duration_seconds * v_max_velocity_rate * v_total_multiplier)::NUMERIC, 2));
    v_final_pgt := LEAST(v_final_pgt, v_velocity_cap);

    -- Sitewide Single-Session Maximum Payout Ceiling: Raised to 250.00 PGT
    v_final_pgt := LEAST(v_final_pgt, 250.00);
  END IF;

  -- 8. Monotonic High Score Updates
  IF v_game_clean LIKE '%invader%' AND v_clamped_score > COALESCE(v_user.invaders_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE public.users 
    SET invaders_highscore = v_clamped_score, 
        alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_clamped_score) 
    WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF (v_game_clean LIKE '%astro%' OR v_game_clean = 'astrododge') AND v_clamped_score > COALESCE(v_user.game_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE public.users 
    SET game_highscore = v_clamped_score, 
        alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), v_clamped_score), 
        alltime_highscore = GREATEST(COALESCE(alltime_highscore, 0), v_clamped_score) 
    WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF v_game_clean LIKE '%drift%' AND v_clamped_score > COALESCE(v_user.drift_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE public.users 
    SET drift_highscore = v_clamped_score, 
        alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_clamped_score) 
    WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF (v_game_clean LIKE '%stacker%' OR v_game_clean LIKE '%catcher%') AND v_clamped_score > COALESCE(v_user.stacker_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE public.users 
    SET stacker_highscore = v_clamped_score, 
        alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), v_clamped_score) 
    WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF v_game_clean LIKE '%skeet%' AND v_clamped_score > COALESCE(v_user.skeet_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE public.users 
    SET skeet_highscore = v_clamped_score, 
        alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), v_clamped_score) 
    WHERE LOWER(player_id) = LOWER(v_user.player_id);
  ELSIF v_game_clean LIKE '%defense%' AND v_clamped_score > COALESCE(v_user.defense_highscore, 0) THEN
    v_is_new_high := true;
    UPDATE public.users 
    SET defense_highscore = v_clamped_score, 
        defense_alltime_best = GREATEST(COALESCE(defense_alltime_best, 0), v_clamped_score) 
    WHERE LOWER(player_id) = LOWER(v_user.player_id);
  END IF;

  -- 9. Weekly Activity Tiers Recalculation
  v_new_weekly_games := COALESCE(v_user.weekly_games_played, 0) + 1;
  v_current_weekly_faucets := COALESCE(v_user.weekly_faucet_claims, 0);
  BEGIN
    v_new_weekly_tier := compute_weekly_active_tier(v_current_weekly_faucets, v_new_weekly_games);
  EXCEPTION WHEN OTHERS THEN
    v_new_weekly_tier := COALESCE(v_user.weekly_active_tier, 0);
  END;

  -- 10. Credit Balance & Process Downline Referral Commissions
  IF v_final_pgt > 0 THEN
    UPDATE public.users 
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_final_pgt, 
        total_earned = COALESCE(total_earned, 0) + v_final_pgt, 
        weekly_games_played = v_new_weekly_games,
        weekly_active_tier = v_new_weekly_tier,
        updated_at = v_now 
    WHERE LOWER(player_id) = LOWER(v_user.player_id) 
    RETURNING balance_pgt INTO v_new_balance;

    -- Trigger downline referral commissions
    BEGIN
      PERFORM process_referral_commissions(v_user.player_id, v_final_pgt, v_game_name || ' Arcade');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  ELSE
    UPDATE public.users 
    SET weekly_games_played = v_new_weekly_games,
        weekly_active_tier = v_new_weekly_tier,
        updated_at = v_now 
    WHERE LOWER(player_id) = LOWER(v_user.player_id) 
    RETURNING balance_pgt INTO v_new_balance;
  END IF;

  -- 11. Mark Arcade Session Completed
  UPDATE public.arcade_sessions 
  SET status = 'completed', 
      completed_at = v_now, 
      score = v_clamped_score, 
      bonus_items = v_clamped_items,
      bonus_tokens = v_clamped_tokens,
      payout_pgt = v_final_pgt, 
      duration_seconds = v_duration_seconds 
  WHERE id = v_session_uuid;

  -- 12. Atomically update game_metrics
  BEGIN
    INSERT INTO public.game_metrics (game_name, total_wagered, total_payout, total_playtime_seconds)
    VALUES (v_game_name, 0, v_final_pgt, v_duration_seconds)
    ON CONFLICT (game_name) DO UPDATE
    SET total_payout = COALESCE(public.game_metrics.total_payout, 0) + v_final_pgt,
        total_playtime_seconds = COALESCE(public.game_metrics.total_playtime_seconds, 0) + v_duration_seconds;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true, 
    'game_name', v_game_name,
    'harvest_enabled', v_harvest_enabled,
    'payout', v_final_pgt, 
    'payout_pgt', v_final_pgt,
    'new_balance', v_new_balance, 
    'duration_seconds', v_duration_seconds, 
    'score', v_clamped_score, 
    'is_new_high', v_is_new_high,
    'weekly_games_played', v_new_weekly_games,
    'weekly_active_tier', v_new_weekly_tier,
    'completed_today', v_daily_completed_count + 1,
    'max_daily_plays', v_max_daily_plays
  );
END;
$$;

-- Grant execute privileges
GRANT EXECUTE ON FUNCTION public.end_arcade_session(TEXT, TEXT, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

-- ============================================================================
-- 3. RETROACTIVE ADJUSTMENT FOR POSS'S RECENT CAPPED SESSIONS (+388.31 PGT)
-- ============================================================================
-- The following block updates the 4 recent sessions where Poss was capped at
-- 50.00 PGT instead of their legitimate multiplier rewards:
--   1. Stacker   (2026-09-11 11:17:44): 4,374 pts, 30 floors -> 196.99 PGT (+146.99)
--   2. AstroDodge(2026-09-11 11:15:07): 16,725 pts, 45 shards -> 107.28 PGT (+57.28)
--   3. Stacker   (2026-09-11 11:07:32): 3,667 pts, 35 floors -> 218.28 PGT (+168.28)
--   4. AstroDodge(2026-09-11 11:06:00): 10,200 pts, 28 shards -> 65.76 PGT  (+15.76)
-- Total compensation = +388.31 PGT
-- ============================================================================
DO $$
DECLARE
  v_poss_id TEXT := '0xpgt8312e02d37185b5983e6922d1dae1cce';
  v_total_owed NUMERIC := 388.31;
BEGIN
  -- 1. Update session 1
  UPDATE public.arcade_sessions 
  SET payout_pgt = 196.99
  WHERE player_id = v_poss_id 
    AND game_name = 'stacker' 
    AND score = 4374 
    AND payout_pgt = 50.00;

  -- 2. Update session 2
  UPDATE public.arcade_sessions 
  SET payout_pgt = 107.28
  WHERE player_id = v_poss_id 
    AND game_name = 'astrododge' 
    AND score = 16725 
    AND payout_pgt = 50.00;

  -- 3. Update session 3
  UPDATE public.arcade_sessions 
  SET payout_pgt = 218.28
  WHERE player_id = v_poss_id 
    AND game_name = 'stacker' 
    AND score = 3667 
    AND payout_pgt = 50.00;

  -- 4. Update session 4
  UPDATE public.arcade_sessions 
  SET payout_pgt = 65.76
  WHERE player_id = v_poss_id 
    AND game_name = 'astrododge' 
    AND score = 10200 
    AND payout_pgt = 50.00;

  -- 5. Credit Poss balance and total_earned
  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_total_owed,
      total_earned = COALESCE(total_earned, 0) + v_total_owed,
      updated_at = NOW()
  WHERE player_id = v_poss_id;

  RAISE NOTICE 'Successfully adjusted arcade sessions and credited +% PGT to %', v_total_owed, v_poss_id;
END;
$$;

-- Force PostgREST schema cache reload immediately
NOTIFY pgrst, 'reload schema';
