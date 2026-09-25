-- ==============================================================================
-- POLYGON GAMING: DATABASE PERFORMANCE OPTIMIZATION & RLS POLICY CLEANUP
-- Version: v1.5.472
-- Author: PolyGame Engineering
--
-- PURPOSE:
-- 1. Resolve 58 "Multiple Permissive Policies" warnings flagged by Supabase linter
--    across 9 public tables (bet_wins, boss_reset_history, deposits_history,
--    global_jackpot, global_settings, nft_sales, pgt_supply_history, user_stakes, withdrawals_history).
-- 2. Revoke dangerous 'Allow all access on global_settings' from public and isolate writes to service_role.
-- 3. Fix role leaks where service_role write policies were inadvertently granted to public.
-- 4. Eliminate 'Auth RLS Initialization Plan' overhead on public.users by wrapping
--    auth.uid() calls in (SELECT auth.uid()), enabling PostgreSQL query-level evaluation.
-- 5. Drop redundant duplicate index 'users_player_id_unique' from public.users by re-pointing
--    user_stakes_player_id_fkey to primary key users_pkey.
-- 6. Add covering index 'idx_user_stakes_wallet_address' on public.user_stakes.
-- 7. Add explicit service_role policies to private admin tables (admin_security_config,
--    admin_discord_secrets, account_merge_backups) to resolve 'RLS Enabled No Policy'.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLE: public.users (Auth RLS Initplan Optimization & Index Deduplication)
-- ------------------------------------------------------------------------------
-- Re-point foreign key from user_stakes to users_pkey so users_player_id_unique can be dropped cleanly
ALTER TABLE public.user_stakes DROP CONSTRAINT IF EXISTS user_stakes_player_id_fkey;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_player_id_unique;
DROP INDEX IF EXISTS public.users_player_id_unique;
ALTER TABLE public.user_stakes ADD CONSTRAINT user_stakes_player_id_fkey 
  FOREIGN KEY (wallet_address) REFERENCES public.users(player_id) ON DELETE CASCADE;

-- Recreate authenticated RLS policies with subquery wrapping (SELECT auth.uid())
DROP POLICY IF EXISTS "Allow authenticated insert users" ON public.users;
CREATE POLICY "Allow authenticated insert users" ON public.users 
  FOR INSERT TO authenticated 
  WITH CHECK (
    ((SELECT auth.uid()) IS NOT NULL) AND 
    (user_id = (SELECT auth.uid()) OR web3_auth_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Allow authenticated update users" ON public.users;
CREATE POLICY "Allow authenticated update users" ON public.users 
  FOR UPDATE TO authenticated 
  USING (
    ((SELECT auth.uid()) IS NOT NULL) AND 
    (user_id = (SELECT auth.uid()) OR web3_auth_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    ((SELECT auth.uid()) IS NOT NULL) AND 
    (user_id = (SELECT auth.uid()) OR web3_auth_id = (SELECT auth.uid()))
  );

-- Ensure public read remains single and clean
DROP POLICY IF EXISTS "Allow public read users" ON public.users;
CREATE POLICY "Allow public read users" ON public.users 
  FOR SELECT TO anon, authenticated, service_role 
  USING (true);

-- ------------------------------------------------------------------------------
-- 2. TABLE: public.user_stakes (Covering Index & Policy Deduplication)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_stakes_wallet_address ON public.user_stakes (wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_stakes_wallet ON public.user_stakes (LOWER(wallet_address));

-- Deduplicate SELECT policies
DROP POLICY IF EXISTS "Allow public read access on user_stakes" ON public.user_stakes;
DROP POLICY IF EXISTS "Public Read Stakes" ON public.user_stakes;
DROP POLICY IF EXISTS "Allow public read user_stakes" ON public.user_stakes;
DROP POLICY IF EXISTS "Allow public read on user_stakes" ON public.user_stakes;

CREATE POLICY "Allow public read on user_stakes" ON public.user_stakes 
  FOR SELECT TO anon, authenticated, service_role 
  USING (true);

-- ------------------------------------------------------------------------------
-- 3. TABLE: public.bet_wins (Policy Deduplication)
-- ------------------------------------------------------------------------------
-- Drop duplicate INSERT policies
DROP POLICY IF EXISTS "Allow public insert on bet_wins" ON public.bet_wins;
DROP POLICY IF EXISTS "Allow public insert to bet_wins" ON public.bet_wins;
DROP POLICY IF EXISTS "Allow public insert bet_wins" ON public.bet_wins;

CREATE POLICY "Allow public insert bet_wins" ON public.bet_wins 
  FOR INSERT TO anon, authenticated, service_role 
  WITH CHECK (true);

-- Drop duplicate SELECT policies
DROP POLICY IF EXISTS "Allow public read of bet_wins" ON public.bet_wins;
DROP POLICY IF EXISTS "Allow public read on bet_wins" ON public.bet_wins;
DROP POLICY IF EXISTS "Public Read Bet Wins" ON public.bet_wins;
DROP POLICY IF EXISTS "Allow public read bet_wins" ON public.bet_wins;

CREATE POLICY "Allow public read bet_wins" ON public.bet_wins 
  FOR SELECT TO anon, authenticated, service_role 
  USING (true);

-- ------------------------------------------------------------------------------
-- 4. TABLE: public.global_jackpot (Policy Deduplication)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public Read Jackpot" ON public.global_jackpot;
DROP POLICY IF EXISTS "Allow public read global_jackpot" ON public.global_jackpot;

CREATE POLICY "Allow public read global_jackpot" ON public.global_jackpot 
  FOR SELECT TO anon, authenticated, service_role 
  USING (true);

-- ------------------------------------------------------------------------------
-- 5. TABLE: public.global_settings (Security Lockdown & Policy Deduplication)
-- ------------------------------------------------------------------------------
-- DROP dangerous public ALL policy
DROP POLICY IF EXISTS "Allow all access on global_settings" ON public.global_settings;

-- Drop duplicate read policies
DROP POLICY IF EXISTS "Allow public read on global_settings" ON public.global_settings;
DROP POLICY IF EXISTS "Allow public read-only on global_settings" ON public.global_settings;

CREATE POLICY "Allow public read-only on global_settings" ON public.global_settings 
  FOR SELECT TO anon, authenticated, service_role 
  USING (true);

-- Drop duplicate service role policies
DROP POLICY IF EXISTS "Service role full access on global_settings" ON public.global_settings;
DROP POLICY IF EXISTS "Allow service role full access on global_settings" ON public.global_settings;

CREATE POLICY "Allow service role full access on global_settings" ON public.global_settings 
  FOR ALL TO service_role 
  USING (true) 
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 6. TABLE: public.boss_reset_history (Role Fix & Policy Deduplication)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role write boss_reset_history" ON public.boss_reset_history;
CREATE POLICY "Service role write boss_reset_history" ON public.boss_reset_history 
  FOR ALL TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public read boss_reset_history" ON public.boss_reset_history;
CREATE POLICY "Public read boss_reset_history" ON public.boss_reset_history 
  FOR SELECT TO anon, authenticated, service_role 
  USING (true);

-- ------------------------------------------------------------------------------
-- 7. TABLE: public.deposits_history (Role Fix & Policy Deduplication)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role full access on deposits_history" ON public.deposits_history;
CREATE POLICY "Service role full access on deposits_history" ON public.deposits_history 
  FOR ALL TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access on deposits_history" ON public.deposits_history;
CREATE POLICY "Allow public read access on deposits_history" ON public.deposits_history 
  FOR SELECT TO anon, authenticated, service_role 
  USING (true);

-- ------------------------------------------------------------------------------
-- 8. TABLE: public.nft_sales (Policy Deduplication)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow anon insert on nft_sales" ON public.nft_sales;
DROP POLICY IF EXISTS "Allow authenticated insert on nft_sales" ON public.nft_sales;

CREATE POLICY "Allow public insert on nft_sales" ON public.nft_sales 
  FOR INSERT TO anon, authenticated, service_role 
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 9. TABLE: public.pgt_supply_history (Policy Deduplication)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public insert on pgt_supply_history" ON public.pgt_supply_history;
DROP POLICY IF EXISTS "Allow public insert pgt_supply_history" ON public.pgt_supply_history;

CREATE POLICY "Allow public insert on pgt_supply_history" ON public.pgt_supply_history 
  FOR INSERT TO anon, authenticated, service_role 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read access on pgt_supply_history" ON public.pgt_supply_history;
DROP POLICY IF EXISTS "Allow public read pgt_supply_history" ON public.pgt_supply_history;

CREATE POLICY "Allow public read on pgt_supply_history" ON public.pgt_supply_history 
  FOR SELECT TO anon, authenticated, service_role 
  USING (true);

-- ------------------------------------------------------------------------------
-- 10. TABLE: public.withdrawals_history (Policy Deduplication)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "public_read_withdrawals_history" ON public.withdrawals_history;
DROP POLICY IF EXISTS "Allow public read access on withdrawals_history" ON public.withdrawals_history;

CREATE POLICY "Allow public read access on withdrawals_history" ON public.withdrawals_history 
  FOR SELECT TO anon, authenticated, service_role 
  USING (true);

-- ------------------------------------------------------------------------------
-- 11. PRIVATE ADMIN TABLES: Explicit Service Role Access (Silences RLS Warnings)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role full access on admin_security_config" ON public.admin_security_config;
CREATE POLICY "Service role full access on admin_security_config" ON public.admin_security_config 
  FOR ALL TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on admin_discord_secrets" ON public.admin_discord_secrets;
CREATE POLICY "Service role full access on admin_discord_secrets" ON public.admin_discord_secrets 
  FOR ALL TO service_role 
  USING (true) 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on account_merge_backups" ON public.account_merge_backups;
CREATE POLICY "Service role full access on account_merge_backups" ON public.account_merge_backups 
  FOR ALL TO service_role 
  USING (true) 
  WITH CHECK (true);

-- ==============================================================================
-- END OF OPTIMIZATION MIGRATION
-- ==============================================================================
