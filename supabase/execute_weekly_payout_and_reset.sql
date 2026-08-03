-- ============================================================
-- POLYGAME ATOMIC WEEKLY LEADERBOARD PAYOUT & RESET SCRIPT (v1.4.265)
-- Distributes 50,000 PGT for EACH of the 3 Arcade Games (Total 150,000 PGT Pool):
-- 1. Astro-Dodge (50,000 PGT Pool)
-- 2. Cyber Invaders (50,000 PGT Pool)
-- 3. Cyber Drift (50,000 PGT Pool)
-- Archives standings to weekly_leaderboard_history and resets high scores.
-- ============================================================

-- Step 1: Ensure weekly_leaderboard_history table & columns exist
CREATE TABLE IF NOT EXISTS weekly_leaderboard_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_label TEXT NOT NULL,
    game_type TEXT DEFAULT 'overall',
    rank INTEGER NOT NULL,
    player_id TEXT,
    wallet_address TEXT,
    astrododge_score INTEGER DEFAULT 0,
    invaders_score INTEGER DEFAULT 0,
    drift_score INTEGER DEFAULT 0,
    best_score INTEGER DEFAULT 0,
    prize_pgt NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE weekly_leaderboard_history ADD COLUMN IF NOT EXISTS game_type TEXT DEFAULT 'overall';
ALTER TABLE weekly_leaderboard_history ADD COLUMN IF NOT EXISTS player_id TEXT;
ALTER TABLE weekly_leaderboard_history ADD COLUMN IF NOT EXISTS wallet_address TEXT;
ALTER TABLE weekly_leaderboard_history ADD COLUMN IF NOT EXISTS astrododge_score INTEGER DEFAULT 0;
ALTER TABLE weekly_leaderboard_history ADD COLUMN IF NOT EXISTS invaders_score INTEGER DEFAULT 0;
ALTER TABLE weekly_leaderboard_history ADD COLUMN IF NOT EXISTS drift_score INTEGER DEFAULT 0;
ALTER TABLE weekly_leaderboard_history ADD COLUMN IF NOT EXISTS best_score INTEGER DEFAULT 0;
ALTER TABLE weekly_leaderboard_history ADD COLUMN IF NOT EXISTS prize_pgt NUMERIC DEFAULT 0;

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

-- Step 3: Atomic Payout, Archive & Reset Execution across 3 Independent 50,000 PGT Pools
DO $$
DECLARE
  v_week_label TEXT := TO_CHAR(NOW(), 'YYYY-MM-DD');
  v_rec RECORD;
  v_rank INT;
  v_prize NUMERIC;
  v_total_distributed NUMERIC := 0;
  v_total_winners INT := 0;
  v_total_reset INT := 0;
BEGIN
  RAISE NOTICE 'Starting 150,000 PGT Total Weekly Distribution (3 x 50,000 PGT Pools) for %...', v_week_label;

  -- -------------------------------------------------------------
  -- POOL 1: ASTRO-DODGE (50,000 PGT Pool)
  -- -------------------------------------------------------------
  v_rank := 0;
  FOR v_rec IN (
    SELECT player_id, COALESCE(linked_wallet_address, player_id) AS wallet_address, game_highscore AS score
    FROM users
    WHERE COALESCE(game_highscore, 0) > 0
    ORDER BY game_highscore DESC
    LIMIT 100
  ) LOOP
    v_rank := v_rank + 1;

    IF v_rank = 1 THEN v_prize := 15000;
    ELSIF v_rank = 2 THEN v_prize := 8000;
    ELSIF v_rank = 3 THEN v_prize := 4000;
    ELSIF v_rank BETWEEN 4 AND 10 THEN v_prize := 1000;
    ELSIF v_rank BETWEEN 11 AND 25 THEN v_prize := 400;
    ELSIF v_rank BETWEEN 26 AND 50 THEN v_prize := 200;
    ELSIF v_rank BETWEEN 51 AND 100 THEN v_prize := 100;
    ELSE v_prize := 0;
    END IF;

    IF v_prize > 0 THEN
      UPDATE users SET balance_pgt = balance_pgt + v_prize, updated_at = NOW() WHERE player_id = v_rec.player_id;
      v_total_distributed := v_total_distributed + v_prize;
      v_total_winners := v_total_winners + 1;
    END IF;

    INSERT INTO weekly_leaderboard_history (
      week_label, game_type, rank, player_id, wallet_address, astrododge_score, best_score, prize_pgt
    ) VALUES (
      v_week_label, 'astrododge', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_rec.score, v_prize
    );
  END LOOP;

  -- -------------------------------------------------------------
  -- POOL 2: CYBER INVADERS (50,000 PGT Pool)
  -- -------------------------------------------------------------
  v_rank := 0;
  FOR v_rec IN (
    SELECT player_id, COALESCE(linked_wallet_address, player_id) AS wallet_address, invaders_highscore AS score
    FROM users
    WHERE COALESCE(invaders_highscore, 0) > 0
    ORDER BY invaders_highscore DESC
    LIMIT 100
  ) LOOP
    v_rank := v_rank + 1;

    IF v_rank = 1 THEN v_prize := 15000;
    ELSIF v_rank = 2 THEN v_prize := 8000;
    ELSIF v_rank = 3 THEN v_prize := 4000;
    ELSIF v_rank BETWEEN 4 AND 10 THEN v_prize := 1000;
    ELSIF v_rank BETWEEN 11 AND 25 THEN v_prize := 400;
    ELSIF v_rank BETWEEN 26 AND 50 THEN v_prize := 200;
    ELSIF v_rank BETWEEN 51 AND 100 THEN v_prize := 100;
    ELSE v_prize := 0;
    END IF;

    IF v_prize > 0 THEN
      UPDATE users SET balance_pgt = balance_pgt + v_prize, updated_at = NOW() WHERE player_id = v_rec.player_id;
      v_total_distributed := v_total_distributed + v_prize;
      v_total_winners := v_total_winners + 1;
    END IF;

    INSERT INTO weekly_leaderboard_history (
      week_label, game_type, rank, player_id, wallet_address, invaders_score, best_score, prize_pgt
    ) VALUES (
      v_week_label, 'invaders', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_rec.score, v_prize
    );
  END LOOP;

  -- -------------------------------------------------------------
  -- POOL 3: CYBER DRIFT (50,000 PGT Pool)
  -- -------------------------------------------------------------
  v_rank := 0;
  FOR v_rec IN (
    SELECT player_id, COALESCE(linked_wallet_address, player_id) AS wallet_address, drift_highscore AS score
    FROM users
    WHERE COALESCE(drift_highscore, 0) > 0
    ORDER BY drift_highscore DESC
    LIMIT 100
  ) LOOP
    v_rank := v_rank + 1;

    IF v_rank = 1 THEN v_prize := 15000;
    ELSIF v_rank = 2 THEN v_prize := 8000;
    ELSIF v_rank = 3 THEN v_prize := 4000;
    ELSIF v_rank BETWEEN 4 AND 10 THEN v_prize := 1000;
    ELSIF v_rank BETWEEN 11 AND 25 THEN v_prize := 400;
    ELSIF v_rank BETWEEN 26 AND 50 THEN v_prize := 200;
    ELSIF v_rank BETWEEN 51 AND 100 THEN v_prize := 100;
    ELSE v_prize := 0;
    END IF;

    IF v_prize > 0 THEN
      UPDATE users SET balance_pgt = balance_pgt + v_prize, updated_at = NOW() WHERE player_id = v_rec.player_id;
      v_total_distributed := v_total_distributed + v_prize;
      v_total_winners := v_total_winners + 1;
    END IF;

    INSERT INTO weekly_leaderboard_history (
      week_label, game_type, rank, player_id, wallet_address, drift_score, best_score, prize_pgt
    ) VALUES (
      v_week_label, 'drift', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_rec.score, v_prize
    );
  END LOOP;

  -- -------------------------------------------------------------
  -- Step 4: Preserve All-Time Career High Scores & Reset Active Weekly Scores
  -- -------------------------------------------------------------
  UPDATE users
  SET alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), COALESCE(game_highscore, 0)),
      alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0)),
      alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0)),
      game_highscore = 0,
      invaders_highscore = 0,
      drift_highscore = 0,
      updated_at = NOW()
  WHERE COALESCE(game_highscore, 0) > 0 
     OR COALESCE(invaders_highscore, 0) > 0 
     OR COALESCE(drift_highscore, 0) > 0;

  GET DIAGNOSTICS v_total_reset = ROW_COUNT;

  RAISE NOTICE 'SUCCESS: Awarded % PGT across 3 games (% payout entries). Reset % scores.', v_total_distributed, v_total_winners, v_total_reset;
END $$;
