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
  -- If games < 3, check completed arcade sessions today
  IF COALESCE((v_q->>'games')::int, 0) < 3 THEN
    SELECT COUNT(*) INTO v_server_games
    FROM arcade_sessions
    WHERE player_id = v_user.player_id
      AND status = 'completed'
      AND created_at >= (v_today || ' 00:00:00+00')::timestamptz;
    IF v_server_games >= 3 THEN
      v_q := jsonb_set(v_q, '{games}', to_jsonb(GREATEST(COALESCE((v_q->>'games')::int, 0), v_server_games)));
    END IF;
  END IF;

  -- If wager wins < 3, check recorded bet wins today (SAFEGUARD: filter out losses & pushes)
  IF COALESCE((v_q->>'wins')::int, 0) < 3 THEN
    SELECT COUNT(*) INTO v_server_wins
    FROM bet_wins
    WHERE player_id = v_user.player_id
      AND (payout > bet_amount OR COALESCE(outcome, 'win') = 'win')
      AND payout > 0
      AND created_at >= (v_today || ' 00:00:00+00')::timestamptz;
    IF v_server_wins >= 3 THEN
      v_q := jsonb_set(v_q, '{wins}', to_jsonb(GREATEST(COALESCE((v_q->>'wins')::int, 0), v_server_wins)));
    END IF;
  END IF;

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

GRANT EXECUTE ON FUNCTION public.claim_daily_quest(TEXT, TEXT, JSONB) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.claim_daily_quest(TEXT, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_quest(TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.claim_daily_quest(TEXT, TEXT) FROM anon;


-- ==============================================================================
