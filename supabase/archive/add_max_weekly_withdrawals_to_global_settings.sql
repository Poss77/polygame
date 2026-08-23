-- ====================================================================
-- POLYGAME: ADD CONFIGURABLE WEEKLY WITHDRAWAL LIMIT TO GLOBAL_SETTINGS
-- 1. Adds max_weekly_withdrawals column to global_settings table
-- 2. Sets default to 5 weekly withdrawals per player (rolling 7 days)
-- ====================================================================

-- 1. Add max_weekly_withdrawals column if not exists
ALTER TABLE public.global_settings 
ADD COLUMN IF NOT EXISTS max_weekly_withdrawals INTEGER DEFAULT 5;

-- 2. Set default value on settings row
UPDATE public.global_settings 
SET max_weekly_withdrawals = COALESCE(max_weekly_withdrawals, 5)
WHERE id = 1;
