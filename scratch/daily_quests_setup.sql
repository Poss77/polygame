-- ============================================================
-- POLYGAME DAILY QUESTS & LOGIN STREAK SYSTEM (V2)
-- Quest 1: Play 3 Mini-Games (+15 PGT)
-- Quest 2: Mine 3 Space Ores (+20 PGT)
-- Quest 3: Win 1 Game Round (+25 PGT)
-- Master Bonus: Complete all 3 (+50 PGT)
-- Run this in your Supabase SQL Editor
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_quests JSONB DEFAULT '{
  "date": "",
  "games": 0,
  "mining": 0,
  "wins": 0,
  "games_claimed": false,
  "mining_claimed": false,
  "wins_claimed": false,
  "master_claimed": false,
  "streak_days": 0,
  "last_streak_date": ""
}'::jsonb;

CREATE OR REPLACE FUNCTION claim_daily_quest(
  p_wallet TEXT,
  p_quest_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_quests JSONB;
  v_today TEXT;
  v_reward NUMERIC := 0;
  v_already_claimed BOOLEAN := FALSE;
  v_progress INT := 0;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));
  v_today := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');

  SELECT * INTO v_user
  FROM users
  WHERE LOWER(wallet_address) = p_wallet OR LOWER(linked_wallet_address) = p_wallet
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  v_quests := COALESCE(v_user.daily_quests, '{}'::jsonb);

  -- Reset quests if date mismatch
  IF COALESCE(v_quests->>'date', '') <> v_today THEN
    v_quests := jsonb_build_object(
      'date', v_today,
      'games', 0,
      'mining', 0,
      'wins', 0,
      'games_claimed', false,
      'mining_claimed', false,
      'wins_claimed', false,
      'master_claimed', false,
      'streak_days', COALESCE((v_quests->>'streak_days')::INT, 0),
      'last_streak_date', COALESCE(v_quests->>'last_streak_date', '')
    );
  END IF;

  -- Determine Quest Type
  IF p_quest_type = 'games' THEN
    v_already_claimed := COALESCE((v_quests->>'games_claimed')::BOOLEAN, false);
    v_progress := COALESCE((v_quests->>'games')::INT, 0);
    IF v_progress < 3 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Play at least 3 Mini-Game rounds first!');
    END IF;
    IF v_already_claimed THEN
      RETURN jsonb_build_object('success', false, 'message', 'Arcade quest reward already claimed today');
    END IF;
    v_reward := 15;
    v_quests := jsonb_set(v_quests, '{games_claimed}', 'true'::jsonb);

  ELSIF p_quest_type = 'mining' THEN
    v_already_claimed := COALESCE((v_quests->>'mining_claimed')::BOOLEAN, false);
    v_progress := COALESCE((v_quests->>'mining')::INT, 0);
    IF v_progress < 3 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Mine at least 3 Ores in PolySpace first!');
    END IF;
    IF v_already_claimed THEN
      RETURN jsonb_build_object('success', false, 'message', 'Space Mining quest reward already claimed today');
    END IF;
    v_reward := 20;
    v_quests := jsonb_set(v_quests, '{mining_claimed}', 'true'::jsonb);

  ELSIF p_quest_type = 'wins' THEN
    v_already_claimed := COALESCE((v_quests->>'wins_claimed')::BOOLEAN, false);
    v_progress := COALESCE((v_quests->>'wins')::INT, 0);
    IF v_progress < 3 THEN
      RETURN jsonb_build_object('success', false, 'message', 'Win at least 3 Game rounds first today!');
    END IF;
    IF v_already_claimed THEN
      RETURN jsonb_build_object('success', false, 'message', 'High Roller quest reward already claimed today');
    END IF;
    v_reward := 25;
    v_quests := jsonb_set(v_quests, '{wins_claimed}', 'true'::jsonb);

  ELSIF p_quest_type = 'master' THEN
    IF NOT (COALESCE((v_quests->>'games_claimed')::BOOLEAN, false) 
            AND COALESCE((v_quests->>'mining_claimed')::BOOLEAN, false) 
            AND COALESCE((v_quests->>'wins_claimed')::BOOLEAN, false)) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Complete & claim all 3 daily quests first!');
    END IF;
    IF COALESCE((v_quests->>'master_claimed')::BOOLEAN, false) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Daily Master Bonus already claimed today');
    END IF;
    v_reward := 50;
    v_quests := jsonb_set(v_quests, '{master_claimed}', 'true'::jsonb);
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Invalid quest type');
  END IF;

  -- Apply Reward & Save Quests State
  UPDATE users
  SET balance_pgt = balance_pgt + v_reward,
      daily_quests = v_quests,
      updated_at = NOW()
  WHERE LOWER(wallet_address) = LOWER(v_user.wallet_address);

  RETURN jsonb_build_object(
    'success', true,
    'reward', v_reward,
    'quest_type', p_quest_type,
    'daily_quests', v_quests,
    'message', 'Daily quest reward claimed successfully!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION claim_daily_quest(TEXT, TEXT) TO anon, authenticated, service_role;
