-- ==============================================================================
-- POLYGAME: ACCOUNT QUARANTINE DAYS SCHEMA FIX & RESTORATION
-- Adds account_quarantine_days column to global_settings and ensures all users
-- have a valid created_at timestamp so new accounts are strictly locked for the
-- configured quarantine period before being able to withdraw on-chain.
-- ==============================================================================

-- 1. Ensure global_settings has account_quarantine_days column
ALTER TABLE public.global_settings
ADD COLUMN IF NOT EXISTS account_quarantine_days INTEGER DEFAULT 7;

-- 2. Update default row with 7-day quarantine if unset or null
UPDATE public.global_settings
SET account_quarantine_days = COALESCE(account_quarantine_days, 7)
WHERE id = 1;

-- 3. Ensure users table has created_at with default NOW()
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 4. Backfill any user rows missing created_at with NOW()
UPDATE public.users
SET created_at = NOW()
WHERE created_at IS NULL;

-- 5. Output confirmation
SELECT 
  id, 
  min_withdraw_pgt, 
  max_withdraw_pgt, 
  max_weekly_withdrawals, 
  account_quarantine_days 
FROM public.global_settings 
WHERE id = 1;
