#!/usr/bin/env python3
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER_RPCS_PATH = os.path.join(BASE_DIR, 'supabase', 'master_rpcs.sql')
OUTPUT_PATH = os.path.join(BASE_DIR, 'supabase', 'enforce_authenticated_database_access.sql')

RLS_HEADER = """-- ==============================================================================
-- POLYGON GAMING: PLAN-012 UNIVERSAL SESSION AUTH & ANTI-FRAMING MIGRATION
-- ==============================================================================
-- 1. Dynamic Policy Purge & Table Lockdown on public.users
-- Purges all legacy permissive policies and restricts table writes exclusively to
-- authenticated sessions matching their own auth.uid().
-- ==============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.users';
    END LOOP;
END $$;

REVOKE ALL ON TABLE public.users FROM anon, public;
GRANT SELECT ON TABLE public.users TO anon, authenticated, service_role;
GRANT INSERT, UPDATE ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role, postgres;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read users" ON public.users FOR SELECT TO anon, authenticated, service_role USING (true);
CREATE POLICY "Allow authenticated insert users" ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
CREATE POLICY "Allow authenticated update users" ON public.users FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL AND user_id = auth.uid()) WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Universal schema protection: Revoke write from anon/public across all tables
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, public;

-- 2. Restrict bot_security_logs to service_role only (Internal engine auditing)
ALTER TABLE public.bot_security_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read access to bot_security_logs" ON public.bot_security_logs;
DROP POLICY IF EXISTS "Allow insert to bot_security_logs" ON public.bot_security_logs;
DROP POLICY IF EXISTS "Service role only bot_security_logs" ON public.bot_security_logs;
CREATE POLICY "Service role only bot_security_logs" ON public.bot_security_logs TO service_role USING (true) WITH CHECK (true);

-- ==============================================================================
-- 3. CANONICAL STORED PROCEDURES (RPCS) WITH CALLER IDENTITY & ANTI-FRAMING
-- ==============================================================================
"""

def generate():
    with open(MASTER_RPCS_PATH, 'r', encoding='utf-8') as f:
        rpcs = f.read()

    full_migration = RLS_HEADER + "\n" + rpcs

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        f.write(full_migration)

    print(f"SUCCESS: Created {OUTPUT_PATH} ({len(full_migration.splitlines())} lines)")

if __name__ == '__main__':
    generate()
