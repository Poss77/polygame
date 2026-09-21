-- 0. SCHEMA INITIALIZATION & COLUMN GUARANTEES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.weekly_leaderboard_history (
    id BIGSERIAL PRIMARY KEY,
    week_label TEXT NOT NULL,
    game_type TEXT DEFAULT 'overall',
    rank INTEGER NOT NULL,
    player_id TEXT,
    wallet_address TEXT,
    astrododge_score INTEGER DEFAULT 0,
    invaders_score INTEGER DEFAULT 0,
    drift_score INTEGER DEFAULT 0,
    stacker_score INTEGER DEFAULT 0,
    skeet_score INTEGER DEFAULT 0,
    defense_score INTEGER DEFAULT 0,
    best_score INTEGER DEFAULT 0,
    prize_pgt NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS game_type TEXT DEFAULT 'overall';
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS player_id TEXT;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS wallet_address TEXT;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS astrododge_score INTEGER DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS invaders_score INTEGER DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS drift_score INTEGER DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS stacker_score INTEGER DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS skeet_score INTEGER DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS defense_score INTEGER DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS best_score INTEGER DEFAULT 0;
ALTER TABLE public.weekly_leaderboard_history ADD COLUMN IF NOT EXISTS prize_pgt NUMERIC DEFAULT 0;

ALTER TABLE public.weekly_leaderboard_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to weekly_leaderboard_history" ON public.weekly_leaderboard_history;
CREATE POLICY "Allow public read access to weekly_leaderboard_history" ON public.weekly_leaderboard_history FOR SELECT TO anon, authenticated, service_role USING (true);
DROP POLICY IF EXISTS "Allow service role insert to weekly_leaderboard_history" ON public.weekly_leaderboard_history;
CREATE POLICY "Allow service role insert to weekly_leaderboard_history" ON public.weekly_leaderboard_history FOR INSERT TO anon, authenticated, service_role WITH CHECK (true);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS linked_wallet_address TEXT;
ALTER TABLE public.users DROP COLUMN IF EXISTS wallet_address;
DROP INDEX IF EXISTS public.idx_users_wallet_address;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS stacker_highscore INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alltime_stacker_highscore INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS skeet_highscore INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS alltime_skeet_highscore INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS defense_highscore INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS defense_alltime_best INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_arcade_plays INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weekly_faucet_claims INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weekly_games_played INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weekly_active_tier INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_weekly_active_tier INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dex_liquidity_usd NUMERIC DEFAULT 0.0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS bot_warning INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.bot_security_logs (
    id BIGSERIAL PRIMARY KEY,
    player_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    game_name TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.bot_security_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access to bot_security_logs" ON public.bot_security_logs;
CREATE POLICY "Allow read access to bot_security_logs" ON public.bot_security_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow insert to bot_security_logs" ON public.bot_security_logs;
CREATE POLICY "Allow insert to bot_security_logs" ON public.bot_security_logs FOR INSERT WITH CHECK (true);


-- Ensure arcade_sessions has duration and relic tracking columns
ALTER TABLE public.arcade_sessions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.arcade_sessions ADD COLUMN IF NOT EXISTS relics_dropped_count INTEGER DEFAULT 0;
ALTER TABLE public.arcade_sessions ADD COLUMN IF NOT EXISTS last_relic_dropped_at TIMESTAMPTZ DEFAULT NULL;


-- ==============================================================================
