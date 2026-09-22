-- ==============================================================================
-- POLYGON GAMING: RESTORE CLIENT TABLE WRITE PRIVILEGES & RLS POLICIES
-- FILE: supabase/fix_restore_client_tables_permissions.sql
-- PURPOSE:
--   Fixes POST 401 (Unauthorized) errors when logging in or playing games:
--   1. user_ips: checkMultiAccountIP() upserts player IP on login.
--   2. bet_wins: client logs verified casino & arcade wins for the public feed.
--   3. pgt_supply_history: client supply tracking fallback on leaderboard load.
-- ==============================================================================

-- 1. TABLE: user_ips (Multi-account detection on login)
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_ips TO anon, authenticated, service_role;
ALTER TABLE public.user_ips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read user_ips" ON public.user_ips;
CREATE POLICY "Allow public read user_ips" ON public.user_ips 
  FOR SELECT TO anon, authenticated, service_role 
  USING (true);

DROP POLICY IF EXISTS "Allow public insert user_ips" ON public.user_ips;
CREATE POLICY "Allow public insert user_ips" ON public.user_ips 
  FOR INSERT TO anon, authenticated, service_role 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update user_ips" ON public.user_ips;
CREATE POLICY "Allow public update user_ips" ON public.user_ips 
  FOR UPDATE TO anon, authenticated, service_role 
  USING (true) 
  WITH CHECK (true);

-- 2. TABLE: bet_wins (Public feed of casino & mini-game wins)
GRANT SELECT, INSERT ON TABLE public.bet_wins TO anon, authenticated, service_role;
ALTER TABLE public.bet_wins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read bet_wins" ON public.bet_wins;
CREATE POLICY "Allow public read bet_wins" ON public.bet_wins 
  FOR SELECT TO anon, authenticated, service_role 
  USING (true);

DROP POLICY IF EXISTS "Allow public insert bet_wins" ON public.bet_wins;
CREATE POLICY "Allow public insert bet_wins" ON public.bet_wins 
  FOR INSERT TO anon, authenticated, service_role 
  WITH CHECK (true);

-- 3. TABLE: pgt_supply_history (Treasury & total supply tracker)
GRANT SELECT, INSERT ON TABLE public.pgt_supply_history TO anon, authenticated, service_role;
ALTER TABLE public.pgt_supply_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read pgt_supply_history" ON public.pgt_supply_history;
CREATE POLICY "Allow public read pgt_supply_history" ON public.pgt_supply_history 
  FOR SELECT TO anon, authenticated, service_role 
  USING (true);

DROP POLICY IF EXISTS "Allow public insert pgt_supply_history" ON public.pgt_supply_history;
CREATE POLICY "Allow public insert pgt_supply_history" ON public.pgt_supply_history 
  FOR INSERT TO anon, authenticated, service_role 
  WITH CHECK (true);

-- 4. Reload PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
