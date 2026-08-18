-- ==============================================================================
-- POLYGAME: CREATE BET_WINS TABLE & RLS POLICIES
-- Enables logging and leaderboard tracking for big casino/bet wins (Crash, Spinner, Plinko, Roshambo)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.bet_wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  player_id TEXT,
  game TEXT NOT NULL,
  bet_amount NUMERIC NOT NULL DEFAULT 0,
  payout NUMERIC NOT NULL DEFAULT 0,
  multiplier NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1. Enable RLS
ALTER TABLE public.bet_wins ENABLE ROW LEVEL SECURITY;

-- 2. Allow public read access (for Big Wins Leaderboards)
DROP POLICY IF EXISTS "Allow public read on bet_wins" ON public.bet_wins;
CREATE POLICY "Allow public read on bet_wins" 
  ON public.bet_wins FOR SELECT 
  USING (true);

-- 3. Allow public insert access (to log gameplay wins)
DROP POLICY IF EXISTS "Allow public insert on bet_wins" ON public.bet_wins;
CREATE POLICY "Allow public insert on bet_wins" 
  ON public.bet_wins FOR INSERT 
  WITH CHECK (true);

-- 4. Grant permissions to anon and authenticated roles
GRANT ALL ON TABLE public.bet_wins TO anon, authenticated, service_role;

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_bet_wins_payout ON public.bet_wins (payout DESC);
CREATE INDEX IF NOT EXISTS idx_bet_wins_created ON public.bet_wins (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bet_wins_wallet ON public.bet_wins (LOWER(wallet_address));
