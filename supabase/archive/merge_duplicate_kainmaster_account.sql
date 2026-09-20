-- ==============================================================================
-- POLYGAME: PURGE DUPLICATE KAINMASTER42 ACCOUNT & BIND WALLET
-- File: merge_duplicate_kainmaster_account.sql
-- Date: 2026-09-17
-- ==============================================================================
-- 1. Delete the duplicate 61 PGT account (0xpgtc490cf5a)
-- 2. Bind the Web3 wallet to the authentic 153.67 PGT account (0xpgt709b6141)
-- ==============================================================================

-- Step 1: Remove the duplicate account
DELETE FROM public.users 
WHERE player_id = '0xpgtc490cf5a';

-- Step 2: Attach the Web3 wallet to the original account
UPDATE public.users
SET linked_wallet_address = '0x9946f255777eab47d5cca5d30ddbe26b9c82640f',
    updated_at = NOW()
WHERE player_id = '0xpgt709b6141';
