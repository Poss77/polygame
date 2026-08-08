-- ============================================================
-- POLYGAME DYNAMIC WITHDRAWAL LIMITS SQL SCRIPT
-- Run this in Supabase SQL Editor to add min_withdraw_pgt and
-- max_withdraw_pgt columns to the global_settings table!
-- ============================================================

ALTER TABLE global_settings 
ADD COLUMN IF NOT EXISTS min_withdraw_pgt NUMERIC DEFAULT 10.0,
ADD COLUMN IF NOT EXISTS max_withdraw_pgt NUMERIC DEFAULT 20000.0;

-- Set initial default values if row exists
UPDATE global_settings 
SET min_withdraw_pgt = COALESCE(min_withdraw_pgt, 10.0),
    max_withdraw_pgt = COALESCE(max_withdraw_pgt, 20000.0)
WHERE id = 1;
