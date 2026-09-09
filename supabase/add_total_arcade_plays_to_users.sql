-- ==============================================================================
-- POLYGON GAMING: PRUNE-PROOF CAREER ARCADE PLAYS ARCHITECTURE
-- ==============================================================================
-- 1. Adds total_arcade_plays to public.users table.
-- 2. Backfills all-time historical plays per player from arcade_sessions.
-- 3. Updates start_arcade_session RPC to atomically increment total_arcade_plays.
-- 4. Extends anti-cheat trigger (prevent_direct_balance_mutation) to protect total_arcade_plays.
-- ==============================================================================

-- 1. ADD COLUMN TO USERS TABLE
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS total_arcade_plays INTEGER DEFAULT 0 NOT NULL;

-- 2. BACKFILL ALL-TIME HISTORICAL PLAYS FROM ARCADE_SESSIONS
UPDATE public.users u
SET total_arcade_plays = COALESCE((
  SELECT COUNT(*)
  FROM public.arcade_sessions s
  WHERE s.player_id = u.player_id
     OR (u.linked_wallet_address IS NOT NULL AND LOWER(s.player_id) = LOWER(u.linked_wallet_address))
), 0);

-- 3. UPDATE START_ARCADE_SESSION STORED PROCEDURE
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
  v_max_daily_plays INTEGER := 35;
  v_daily_completed_count INTEGER := 0;
  v_clean_game TEXT;
  v_game_key TEXT;
  v_game_settings JSONB := '{}'::jsonb;
  v_vip_only BOOLEAN := false;
  v_test_mode BOOLEAN := false;
  v_user RECORD;
BEGIN
  -- Resolve canonical Player ID
  v_pid := public.resolve_player_id(COALESCE(p_player_id, auth.jwt() ->> 'sub', ''));
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_player_id, '')));
  END IF;

  IF v_pid IS NULL OR v_pid = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unable to resolve player ID');
  END IF;

  SELECT * INTO v_user FROM public.users WHERE player_id = v_pid;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found in database');
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
  ELSIF v_clean_game LIKE '%defense%' THEN
    v_game_key := 'defense';
  ELSE
    v_game_key := v_clean_game;
  END IF;

  -- Read Global Settings
  BEGIN
    SELECT COALESCE(max_daily_plays_per_game, 35), COALESCE(game_payout_settings, '{}'::jsonb)
    INTO v_max_daily_plays, v_game_settings
    FROM public.global_settings WHERE id = 1 LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_max_daily_plays := 35;
    v_game_settings := '{}'::jsonb;
  END;

  -- 1. Test Mode Access Enforcement: Test mode games are accessible to Admins and Ambassadors
  v_test_mode := COALESCE((v_game_settings->v_game_key->>'test_mode')::boolean, (v_game_key = 'defense'));
  IF v_test_mode THEN
    IF NOT COALESCE(v_user.is_admin, false) AND NOT COALESCE(v_user.is_ambassador, false) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'This game is currently in test mode',
        'test_mode', true
      );
    END IF;
  END IF;

  -- 2. VIP Access Enforcement: VIP-only games require an active VIP pass (or Admin)
  v_vip_only := COALESCE((v_game_settings->v_game_key->>'vip_only')::boolean, (v_game_key = 'stacker'));
  IF v_vip_only THEN
    IF (v_user.vip_until IS NULL OR v_user.vip_until <= NOW())
       AND NOT COALESCE(v_user.is_admin, false) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'VIP pass required to play this game',
        'vip_required', true
      );
    END IF;
  END IF;

  -- Query Completed Sessions in Last 24 Hours
  SELECT COUNT(*) INTO v_daily_completed_count
  FROM public.arcade_sessions
  WHERE player_id = v_pid
    AND (game_name = v_game_key OR LOWER(game_name) = v_clean_game)
    AND status = 'completed'
    AND created_at >= (NOW() - INTERVAL '24 hours');

  -- Daily Play Limit Check (Enforced for ALL players)
  IF v_daily_completed_count >= v_max_daily_plays THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily play limit reached (' || v_daily_completed_count || '/' || v_max_daily_plays || '). Try again tomorrow!',
      'daily_limit_reached', true,
      'completed_today', v_daily_completed_count,
      'max_daily_plays', v_max_daily_plays
    );
  END IF;

  v_session_id := gen_random_uuid();

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

  -- Atomically increment career total_arcade_plays on user profile
  UPDATE public.users
  SET total_arcade_plays = COALESCE(total_arcade_plays, 0) + 1
  WHERE player_id = v_pid;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'completed_today', v_daily_completed_count,
    'max_daily_plays', v_max_daily_plays
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_arcade_session(TEXT, TEXT) TO anon, authenticated, service_role;


-- 4. UPDATE ANTI-CHEAT TRIGGER (PREVENT_DIRECT_BALANCE_MUTATION)
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  IF CURRENT_USER IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.balance_pgt := 0.0;
      NEW.created_at := NOW();
      NEW.is_admin := false;
      NEW.is_ambassador := false;
      NEW.vip_until := NULL;
      NEW.total_arcade_plays := 0;
      NEW.weekly_faucet_claims := 0;
      NEW.weekly_games_played := 0;
      NEW.weekly_active_tier := 0;
      NEW.last_weekly_active_tier := 0;
    ELSIF TG_OP = 'UPDATE' THEN
      -- 1. Immutable registration timestamp
      IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        NEW.created_at := OLD.created_at;
      END IF;
      -- 2. Immutable balances
      IF NEW.balance_pgt IS DISTINCT FROM OLD.balance_pgt THEN
        NEW.balance_pgt := OLD.balance_pgt;
      END IF;
      -- 3. Immutable roles and VIP status
      IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
        NEW.is_admin := OLD.is_admin;
      END IF;
      IF NEW.is_ambassador IS DISTINCT FROM OLD.is_ambassador THEN
        NEW.is_ambassador := OLD.is_ambassador;
      END IF;
      IF NEW.vip_until IS DISTINCT FROM OLD.vip_until THEN
        NEW.vip_until := OLD.vip_until;
      END IF;
      -- 4. Immutable career total_arcade_plays (server RPC controlled only)
      IF NEW.total_arcade_plays IS DISTINCT FROM OLD.total_arcade_plays THEN
        NEW.total_arcade_plays := OLD.total_arcade_plays;
      END IF;
      -- 5. Immutable weekly activity counters (prevents stale browser saveToDB overwrites)
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
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_balance_mutation ON public.users;
CREATE TRIGGER trg_prevent_direct_balance_mutation
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_balance_mutation();
