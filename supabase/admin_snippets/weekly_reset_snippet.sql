-- ==============================================================================
-- POLYGAME MASTER ADMIN: 1-CLICK WEEKLY TOURNAMENT RESET & PRIZE DISTRIBUTION
-- Run this in the Supabase SQL Editor every Sunday at 00:00 UTC (or on demand).
-- This stored procedure is REVOKED from the public API and runs 100% server-side.
-- ==============================================================================

-- 1. Execute full weekly payout & tournament score reset:
SELECT public.execute_weekly_payout_and_reset();

-- 2. (Optional) Distribute Cosmic World Boss bounty loot:
-- SELECT public.distribute_weekly_boss_prizes();

-- 3. (Optional) Automated Sunday Scheduling via pg_cron:
-- If you want Supabase to run this automatically every Sunday at 00:00 UTC:
--
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- SELECT cron.schedule(
--   'polygame-weekly-tournament-reset',
--   '0 0 * * 0',
--   $$SELECT public.execute_weekly_payout_and_reset();$$
-- );
