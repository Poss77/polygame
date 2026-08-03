-- ============================================================
-- POLYGAME ATOMIC WEEKLY LEADERBOARD PAYOUT & RESET SCRIPT
-- Run this script in your Supabase SQL Editor to distribute 50,000 PGT prizes,
-- archive standings to weekly_leaderboard_history, and reset all arcade high scores.
-- ============================================================

-- Step 1: Ensure weekly_leaderboard_history table exists
CREATE TABLE IF NOT EXISTS weekly_leaderboard_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_label TEXT NOT NULL,
    rank INTEGER NOT NULL,
    player_id TEXT NOT NULL,
    wallet_address TEXT,
    astrododge_score INTEGER DEFAULT 0,
    invaders_score INTEGER DEFAULT 0,
    drift_score INTEGER DEFAULT 0,
    best_score INTEGER DEFAULT 0,
    prize_pgt NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_history_week ON weekly_leaderboard_history (week_label);
CREATE INDEX IF NOT EXISTS idx_weekly_history_wallet ON weekly_leaderboard_history (LOWER(wallet_address));

ALTER TABLE weekly_leaderboard_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to weekly_leaderboard_history" ON weekly_leaderboard_history;
CREATE POLICY "Allow public read access to weekly_leaderboard_history" ON weekly_leaderboard_history FOR SELECT TO anon, authenticated, service_role USING (true);
DROP POLICY IF EXISTS "Allow service role insert to weekly_leaderboard_history" ON weekly_leaderboard_history;
CREATE POLICY "Allow service role insert to weekly_leaderboard_history" ON weekly_leaderboard_history FOR INSERT TO anon, authenticated, service_role WITH CHECK (true);

-- Step 2: Auto-Restore Scores if UI Zeroed Them Out During Failed Payout
DO $$
BEGIN
  -- If high scores were zeroed out by UI before payout finished, recover scores from activities JSON log
  UPDATE users u
  SET game_highscore = GREATEST(COALESCE(u.game_highscore, 0), COALESCE(REPLACE(SUBSTRING(act.reward FROM 'AstroDodge: ([0-9,]+)'), ',', '')::INTEGER, 0)),
      invaders_highscore = GREATEST(COALESCE(u.invaders_highscore, 0), COALESCE(REPLACE(SUBSTRING(act.reward FROM 'Invaders: ([0-9,]+)'), ',', '')::INTEGER, 0)),
      drift_highscore = GREATEST(COALESCE(u.drift_highscore, 0), COALESCE(REPLACE(SUBSTRING(act.reward FROM 'Drift: ([0-9,]+)'), ',', '')::INTEGER, 0))
  FROM (
    SELECT player_id, (elem->>'reward') AS reward
    FROM users, jsonb_array_elements(COALESCE(activities, '[]'::jsonb)) AS elem
    WHERE elem->>'action' LIKE 'Weekly leaderboard reset%'
  ) act
  WHERE u.player_id = act.player_id;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Score recovery step skipped: %', SQLERRM;
END $$;

-- Step 3: Atomic Payout, Archive & Reset Execution
DO $$
DECLARE
  v_week_label TEXT := TO_CHAR(NOW(), 'YYYY-MM-DD');
  v_rec RECORD;
  v_rank INT := 0;
  v_prize NUMERIC := 0;
  v_total_distributed NUMERIC := 0;
  v_total_winners INT := 0;
  v_total_reset INT := 0;
BEGIN
  RAISE NOTICE 'Starting 50,000 PGT Weekly Distribution for %...', v_week_label;

  -- Loop through top players sorted by highest best_score across AstroDodge, Invaders & Cyber Drift
  FOR v_rec IN (
    SELECT 
      player_id, 
      COALESCE(linked_wallet_address, player_id) AS wallet_address,
      COALESCE(game_highscore, 0) AS astrododge_score,
      COALESCE(invaders_highscore, 0) AS invaders_score,
      COALESCE(drift_highscore, 0) AS drift_score,
      GREATEST(COALESCE(game_highscore, 0), COALESCE(invaders_highscore, 0), COALESCE(drift_highscore, 0)) AS best_score
    FROM users
    WHERE COALESCE(game_highscore, 0) > 0 
       OR COALESCE(invaders_highscore, 0) > 0 
       OR COALESCE(drift_highscore, 0) > 0
    ORDER BY GREATEST(COALESCE(game_highscore, 0), COALESCE(invaders_highscore, 0), COALESCE(drift_highscore, 0)) DESC
    LIMIT 100
  ) LOOP
    v_rank := v_rank + 1;

    -- Calculate PGT Prize by Rank
    IF v_rank = 1 THEN v_prize := 15000;
    ELSIF v_rank = 2 THEN v_prize := 8000;
    ELSIF v_rank = 3 THEN v_prize := 4000;
    ELSIF v_rank BETWEEN 4 AND 10 THEN v_prize := 1000;
    ELSIF v_rank BETWEEN 11 AND 25 THEN v_prize := 400;
    ELSIF v_rank BETWEEN 26 AND 50 THEN v_prize := 200;
    ELSIF v_rank BETWEEN 51 AND 100 THEN v_prize := 100;
    ELSE v_prize := 0;
    END IF;

    -- 1. Credit Prize PGT to Winner Balance
    IF v_prize > 0 THEN
      UPDATE users
      SET balance_pgt = balance_pgt + v_prize,
          total_earned = total_earned + v_prize,
          updated_at = NOW()
      WHERE player_id = v_rec.player_id;

      v_total_distributed := v_total_distributed + v_prize;
      v_total_winners := v_total_winners + 1;
    END IF;

    -- 2. Snapshot into weekly_leaderboard_history
    INSERT INTO weekly_leaderboard_history (
      week_label, rank, player_id, wallet_address, 
      astrododge_score, invaders_score, drift_score, best_score, prize_pgt
    ) VALUES (
      v_week_label, v_rank, v_rec.player_id, LOWER(v_rec.wallet_address),
      v_rec.astrododge_score, v_rec.invaders_score, v_rec.drift_score, v_rec.best_score, v_prize
    );

  END LOOP;

  -- 3. Reset all active high scores to 0
  UPDATE users
  SET game_highscore = 0,
      invaders_highscore = 0,
      drift_highscore = 0,
      updated_at = NOW()
  WHERE COALESCE(game_highscore, 0) > 0 
     OR COALESCE(invaders_highscore, 0) > 0 
     OR COALESCE(drift_highscore, 0) > 0;

  GET DIAGNOSTICS v_total_reset = ROW_COUNT;

  RAISE NOTICE 'SUCCESS: Awarded % PGT across % players. Archived and reset % scores.', v_total_distributed, v_total_winners, v_total_reset;
END $$;
