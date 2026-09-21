#!/usr/bin/env python3
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER_RPCS_PATH = os.path.join(BASE_DIR, 'supabase', 'master_rpcs.sql')
OUTPUT_PATH = os.path.join(BASE_DIR, 'supabase', 'enforce_authenticated_database_access.sql')

RLS_HEADER = """-- ==============================================================================
-- POLYGON GAMING: PLAN-012 UNIVERSAL SESSION AUTH & ANTI-FRAMING MIGRATION
-- ==============================================================================
-- 1. Tighten Row Level Security (RLS) on public.users
-- Restricts direct PostgREST INSERT and UPDATE operations strictly to
-- authenticated sessions matching their own auth.uid().
-- Public read is preserved for leaderboards and public profile cards.
-- ==============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read users" ON public.users;
CREATE POLICY "Allow public read users" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated insert users" ON public.users;
CREATE POLICY "Allow authenticated insert users" ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid()::text);

DROP POLICY IF EXISTS "Allow public update users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated update users" ON public.users;
CREATE POLICY "Allow authenticated update users" ON public.users FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL AND user_id = auth.uid()::text) WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid()::text);

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
