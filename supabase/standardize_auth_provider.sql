-- ============================================================================
-- PolyGame: Optional Database Housekeeping - Standardize auth_provider to 'web3'
-- ============================================================================
-- Description:
-- In public.users, older accounts created before Supabase Auth integration
-- have auth_provider = 'wallet' (the old column default). Newer Web3 sign-ins
-- use auth_provider = 'web3'.
--
-- This script harmonizes all 'wallet' entries to 'web3' and updates the
-- default value for future rows. This is purely cosmetic / housekeeping
-- and does not affect gameplay or security.
-- ============================================================================

-- 1. Standardize existing 'wallet' rows to 'web3'
UPDATE public.users
SET auth_provider = 'web3'
WHERE auth_provider = 'wallet';

-- 2. Update column default to 'web3'
ALTER TABLE public.users
ALTER COLUMN auth_provider SET DEFAULT 'web3';
