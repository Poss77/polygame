-- ==============================================================================
-- CLEAN UP DUPLICATE GHOST ACCOUNTS FOR POSS WALLET
-- ==============================================================================
-- Problem: An initial sync race + PostgREST PGRST116 loop created 4 empty ghost
-- rows for Poss's wallet (0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5) with 0.0 PGT.
-- This script safely removes the 4 ghost rows while preserving the authoritative
-- original account (0xpgt8312e02d37185b5983e6922d1dae1cce) with 12,132.90 PGT,
-- active VIP, and all stats.
-- ==============================================================================

BEGIN;

-- 1. Remove ghost duplicate accounts created on Sept 9, 2026
DELETE FROM public.users
WHERE linked_wallet_address = '0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5'
  AND player_id != '0xpgt8312e02d37185b5983e6922d1dae1cce'
  AND balance_pgt = 0.0;

-- 2. Clean up IP tracking entries for the ghost accounts if present
DELETE FROM public.user_ips
WHERE player_id IN ('0xpgtf85b5e35', '0xpgt1b3039d6', '0xpgt22ba73dc', '0xpgt473db3a1');

-- 3. Verify exactly 1 authoritative record remains for Poss
SELECT player_id, username, linked_wallet_address, balance_pgt, is_ambassador, vip_until, created_at
FROM public.users
WHERE linked_wallet_address = '0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5';

COMMIT;
