-- ============================================================
-- POLYGAME DAILY QUEST CLAIM RPC FIX
-- Fixes column "id" does not exist error by targeting wallet_address primary key
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION claim_daily_quest(
  p_wallet TEXT,
  p_quest_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_q JSONB;
  v_today TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_reward NUMERIC := 0;
  v_new_balance NUMERIC;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));
  
  SELECT * INTO v_user
  FROM users
  WHERE LOWER(wallet_address) = p_wallet 
     OR LOWER(COALESCE(linked_wallet_address, '')) = p_wallet
     OR LOWER(COALESCE(user_id::text, '')) = p_wallet
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
    IF NOT (COALESCE((v_q->>'games_claimed')::boolean, false) OR COALESCE((v_q->>'games')::int, 0) >= 3)
       OR NOT (COALESCE((v_q->>'mining_claimed')::boolean, false) OR COALESCE((v_q->>'mining')::int, 0) >= 3)
       OR NOT (COALESCE((v_q->>'wins_claimed')::boolean, false) OR COALESCE((v_q->>'wins')::int, 0) >= 3) THEN
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
  WHERE wallet_address = v_user.wallet_address;

  RETURN jsonb_build_object(
    'success', true,
    'reward', v_reward,
    'new_balance', v_new_balance,
    'daily_quests', v_q
  );
END;
$$;

GRANT EXECUTE ON FUNCTION claim_daily_quest(TEXT, TEXT) TO anon, authenticated, service_role;
