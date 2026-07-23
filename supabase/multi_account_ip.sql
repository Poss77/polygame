-- ====================================================================
-- SUPABASE MIGRATION: Multi-Account IP Tracking & Security Sentinel
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.user_ips (
    wallet_address TEXT PRIMARY KEY,
    ip_address TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and grant public access for client logging
ALTER TABLE public.user_ips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read user_ips" ON public.user_ips;
DROP POLICY IF EXISTS "Allow public insert user_ips" ON public.user_ips;
DROP POLICY IF EXISTS "Allow public update user_ips" ON public.user_ips;

CREATE POLICY "Allow public read user_ips" ON public.user_ips FOR SELECT USING (true);
CREATE POLICY "Allow public insert user_ips" ON public.user_ips FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update user_ips" ON public.user_ips FOR UPDATE USING (true);

-- Index for fast IP queries
CREATE INDEX IF NOT EXISTS idx_user_ips_ip ON public.user_ips(ip_address);
