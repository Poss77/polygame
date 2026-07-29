-- ============================================================
-- POLYGAME WEEKLY LEADERBOARD ARCHIVE & HISTORY TABLE
-- Preserves past weekly winners, ranks, scores, and prize payouts
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS weekly_leaderboard_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_label TEXT NOT NULL,
  rank INT NOT NULL,
  wallet_address TEXT NOT NULL,
  username TEXT,
  astrododge_score INT DEFAULT 0,
  invaders_score INT DEFAULT 0,
  drift_score INT DEFAULT 0,
  best_score INT NOT NULL,
  prize_pgt NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast query by week label
CREATE INDEX IF NOT EXISTS idx_weekly_history_week ON weekly_leaderboard_history (week_label);
CREATE INDEX IF NOT EXISTS idx_weekly_history_wallet ON weekly_leaderboard_history (LOWER(wallet_address));

-- Enable Row Level Security (RLS) & Grant Read Access
ALTER TABLE weekly_leaderboard_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to weekly_leaderboard_history"
ON weekly_leaderboard_history FOR SELECT TO anon, authenticated, service_role USING (true);

CREATE POLICY "Allow service role insert to weekly_leaderboard_history"
ON weekly_leaderboard_history FOR INSERT TO anon, authenticated, service_role WITH CHECK (true);
