-- 10. QUESTS & PROGRESSION
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: claim_daily_quest
-- Source: master_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_daily_quest(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.claim_daily_quest(TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.claim_daily_quest(
  p_wallet TEXT,
  p_quest_type TEXT,
  p_client_quests JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_user RECORD;
  v_q JSONB;
  v_today TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_reward NUMERIC := 0;
  v_new_balance NUMERIC;
  v_server_games INT := 0;
  v_server_wins INT := 0;
  v_client_games INT := 0;
  v_client_mining INT := 0;
  v_client_wins INT := 0;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'message', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;
  
  SELECT * INTO v_user
  FROM users
  WHERE player_id = v_pid OR LOWER(linked_wallet_address) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) = true THEN
    RETURN jsonb_build_object('success', false, 'message', 'SECURITY_VIOLATION: Account suspended.');
  END IF;

  v_q := v_user.daily_quests;
  IF v_q IS NULL OR (v_q->>'date') IS NULL OR (v_q->>'date') <> v_today THEN
    v_q := jsonb_build_object(
      'date', v_today,
      'games', 0, 'mining', 0, 'wins', 0,
      'games_claimed', false, 'mining_claimed', false, 'wins_claimed', false,
      'master_claimed', false,
      'streak_days', COALESCE((v_q->>'streak_days')::int, 0),
      'last_streak_date', COALESCE(v_q->>'last_streak_date', '')
    );
  END IF;

  -- 1. Sync from verified client quests payload if matching today's date
  IF p_client_quests IS NOT NULL AND jsonb_typeof(p_client_quests) = 'object' THEN
    IF COALESCE(p_client_quests->>'date', '') = v_today THEN
      v_client_games := LEAST(GREATEST(0, COALESCE((p_client_quests->>'games')::int, 0)), 100);
      v_client_mining := LEAST(GREATEST(0, COALESCE((p_client_quests->>'mining')::int, 0)), 100);
      v_client_wins := LEAST(GREATEST(0, COALESCE((p_client_quests->>'wins')::int, 0)), 100);

      IF v_client_games > COALESCE((v_q->>'games')::int, 0) THEN
        v_q := jsonb_set(v_q, '{games}', to_jsonb(v_client_games));
      END IF;
      IF v_client_mining > COALESCE((v_q->>'mining')::int, 0) THEN
        v_q := jsonb_set(v_q, '{mining}', to_jsonb(v_client_mining));
      END IF;
      IF v_client_wins > COALESCE((v_q->>'wins')::int, 0) THEN
        v_q := jsonb_set(v_q, '{wins}', to_jsonb(v_client_wins));
      END IF;
    END IF;
  END IF;

  -- 2. Authoritative server-side activity fallback
  -- Check completed arcade sessions today across all devices
  SELECT COUNT(*) INTO v_server_games
  FROM arcade_sessions
  WHERE (player_id = v_user.player_id OR (v_user.linked_wallet_address IS NOT NULL AND LOWER(player_id) = LOWER(v_user.linked_wallet_address)))
    AND status = 'completed'
    AND created_at >= (v_today || ' 00:00:00+00')::timestamptz;
  v_q := jsonb_set(v_q, '{games}', to_jsonb(GREATEST(COALESCE((v_q->>'games')::int, 0), v_server_games)));

  -- Check recorded bet wins today across all devices (SAFEGUARD: filter out losses & pushes)
  SELECT COUNT(*) INTO v_server_wins
  FROM bet_wins
  WHERE (player_id = v_user.player_id OR wallet_address = v_user.player_id OR (v_user.linked_wallet_address IS NOT NULL AND (LOWER(player_id) = LOWER(v_user.linked_wallet_address) OR LOWER(wallet_address) = LOWER(v_user.linked_wallet_address))))
    AND (payout > bet_amount OR COALESCE(outcome, 'win') = 'win')
    AND payout > 0
    AND created_at >= (v_today || ' 00:00:00+00')::timestamptz;
  v_q := jsonb_set(v_q, '{wins}', to_jsonb(GREATEST(COALESCE((v_q->>'wins')::int, 0), v_server_wins)));

  -- 3. Evaluate quest requirements & enforce atomic single-claim checks
  IF p_quest_type = 'games' THEN
    IF COALESCE((v_q->>'games')::int, 0) < 3 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Play & finish 3 Arcade games first!');
    END IF;
    IF COALESCE((v_q->>'games_claimed')::boolean, false) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Games quest reward already claimed today!');
    END IF;
    v_q := jsonb_set(v_q, '{games_claimed}', 'true');
    v_reward := 10;

  ELSIF p_quest_type = 'mining' THEN
    IF COALESCE((v_q->>'mining')::int, 0) < 3 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Mine at least 3 Ore Shards first!');
    END IF;
    IF COALESCE((v_q->>'mining_claimed')::boolean, false) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Mining quest reward already claimed today!');
    END IF;
    v_q := jsonb_set(v_q, '{mining_claimed}', 'true');
    v_reward := 10;

  ELSIF p_quest_type = 'wins' THEN
    IF COALESCE((v_q->>'wins')::int, 0) < 3 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Win at least 3 PGT wager rounds first!');
    END IF;
    IF COALESCE((v_q->>'wins_claimed')::boolean, false) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Wins quest reward already claimed today!');
    END IF;
    v_q := jsonb_set(v_q, '{wins_claimed}', 'true');
    v_reward := 10;

  ELSIF p_quest_type = 'master' THEN
    IF NOT (
      (COALESCE((v_q->>'games_claimed')::boolean, false) OR COALESCE((v_q->>'games')::int, 0) >= 3) AND
      (COALESCE((v_q->>'mining_claimed')::boolean, false) OR COALESCE((v_q->>'mining')::int, 0) >= 3) AND
      (COALESCE((v_q->>'wins_claimed')::boolean, false) OR COALESCE((v_q->>'wins')::int, 0) >= 3)
    ) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Complete all 3 daily quests first!');
    END IF;
    IF COALESCE((v_q->>'master_claimed')::boolean, false) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Master quest reward already claimed today!');
    END IF;
    v_q := jsonb_set(v_q, '{master_claimed}', 'true');
    v_reward := 25;

    -- Update streak days on master claim
    IF COALESCE(v_q->>'last_streak_date', '') <> v_today THEN
      DECLARE
        v_yesterday TEXT := TO_CHAR((NOW() AT TIME ZONE 'UTC') - INTERVAL '1 day', 'YYYY-MM-DD');
        v_streak INT := COALESCE((v_q->>'streak_days')::int, 0);
      BEGIN
        IF (v_q->>'last_streak_date') = v_yesterday THEN
          v_streak := v_streak + 1;
        ELSE
          v_streak := 1;
        END IF;
        v_q := jsonb_set(v_q, '{streak_days}', to_jsonb(v_streak));
        v_q := jsonb_set(v_q, '{last_streak_date}', to_jsonb(v_today));
      END;
    END IF;
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Invalid quest type');
  END IF;

  v_new_balance := COALESCE(v_user.balance_pgt, 0) + v_reward;

  UPDATE users
  SET balance_pgt = v_new_balance,
      daily_quests = v_q,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'reward', v_reward,
    'new_balance', v_new_balance,
    'daily_quests', v_q
  );
END;
$$;

-- Backward-compatible 2-argument wrapper
CREATE OR REPLACE FUNCTION public.claim_daily_quest(
  p_wallet TEXT,
  p_quest_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.claim_daily_quest(p_wallet, p_quest_type, NULL::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_daily_quest(TEXT, TEXT, JSONB) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_quest(TEXT, TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: sync_daily_quests
-- Multi-device daily quests synchronization (Desktop & Mobile)
-- Authoritatively aggregates completed arcade sessions, wager wins, and client mining.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sync_daily_quests(TEXT);
DROP FUNCTION IF EXISTS public.sync_daily_quests(TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.sync_daily_quests(
  p_wallet TEXT,
  p_client_quests JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_user RECORD;
  v_q JSONB;
  v_today TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_server_games INT := 0;
  v_server_wins INT := 0;
  v_client_games INT := 0;
  v_client_mining INT := 0;
  v_client_wins INT := 0;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'message', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT * INTO v_user
  FROM users
  WHERE player_id = v_pid OR LOWER(linked_wallet_address) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) = true THEN
    RETURN jsonb_build_object('success', false, 'message', 'SECURITY_VIOLATION: Account suspended.');
  END IF;

  v_q := v_user.daily_quests;
  IF v_q IS NULL OR (v_q->>'date') IS NULL OR (v_q->>'date') <> v_today THEN
    v_q := jsonb_build_object(
      'date', v_today,
      'games', 0, 'mining', 0, 'wins', 0,
      'games_claimed', false, 'mining_claimed', false, 'wins_claimed', false,
      'master_claimed', false,
      'streak_days', COALESCE((v_q->>'streak_days')::int, 0),
      'last_streak_date', COALESCE(v_q->>'last_streak_date', '')
    );
  END IF;

  -- 1. Count actual completed arcade games today across all devices
  SELECT COUNT(*) INTO v_server_games
  FROM arcade_sessions
  WHERE (player_id = v_user.player_id OR (v_user.linked_wallet_address IS NOT NULL AND LOWER(player_id) = LOWER(v_user.linked_wallet_address)))
    AND status = 'completed'
    AND created_at >= (v_today || ' 00:00:00+00')::timestamptz;

  -- 2. Count actual wager wins today across all devices
  SELECT COUNT(*) INTO v_server_wins
  FROM bet_wins
  WHERE (player_id = v_user.player_id OR wallet_address = v_user.player_id OR (v_user.linked_wallet_address IS NOT NULL AND (LOWER(player_id) = LOWER(v_user.linked_wallet_address) OR LOWER(wallet_address) = LOWER(v_user.linked_wallet_address))))
    AND (payout > bet_amount OR COALESCE(outcome, 'win') = 'win')
    AND payout > 0
    AND created_at >= (v_today || ' 00:00:00+00')::timestamptz;

  -- 3. Parse client quests payload if matching today's date
  IF p_client_quests IS NOT NULL AND jsonb_typeof(p_client_quests) = 'object' THEN
    IF COALESCE(p_client_quests->>'date', '') = v_today THEN
      v_client_games := LEAST(GREATEST(0, COALESCE((p_client_quests->>'games')::int, 0)), 100);
      v_client_mining := LEAST(GREATEST(0, COALESCE((p_client_quests->>'mining')::int, 0)), 100);
      v_client_wins := LEAST(GREATEST(0, COALESCE((p_client_quests->>'wins')::int, 0)), 100);
    END IF;
  END IF;

  -- 4. Merge highest progress from server tables, existing DB quests, and client
  v_q := jsonb_set(v_q, '{games}', to_jsonb(GREATEST(v_server_games, COALESCE((v_q->>'games')::int, 0), v_client_games)));
  v_q := jsonb_set(v_q, '{wins}', to_jsonb(GREATEST(v_server_wins, COALESCE((v_q->>'wins')::int, 0), v_client_wins)));
  v_q := jsonb_set(v_q, '{mining}', to_jsonb(GREATEST(COALESCE((v_q->>'mining')::int, 0), v_client_mining)));

  -- Update database record with synced progress
  UPDATE users
  SET daily_quests = v_q,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'daily_quests', v_q
  );
END;
$$;

-- Backward-compatible 1-argument wrapper
CREATE OR REPLACE FUNCTION public.sync_daily_quests(
  p_wallet TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.sync_daily_quests(p_wallet, NULL::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_daily_quests(TEXT, JSONB) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.sync_daily_quests(TEXT) TO authenticated, service_role, anon;


-- ==============================================================================
