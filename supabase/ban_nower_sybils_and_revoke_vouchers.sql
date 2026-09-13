-- ==============================================================================
-- POLYGAME SECURITY REMEDIATION: PURGE NOWER SYBIL ACCOUNTS & SANITIZE BALANCES
-- Target: Nower's unbanned sybil network uncovered across subnet 160.19.227.%
-- Date: September 13, 2026
-- ==============================================================================

BEGIN;

-- 1. Sanitize trapped balances on Nower sybil accounts
UPDATE public.users
SET 
    balance_pgt = 0.0,
    is_banned = TRUE,
    updated_at = NOW()
WHERE player_id IN (
    '0xpgtb4d7ffbf80ec', -- Stranded 27,000 PGT (Nower sybil from 160.19.227.159)
    '0xpgt0a3d8fab',     -- 50 PGT (Created Sept 11 from 160.19.227.159)
    '0xpgt0ea191de',     -- Created Sept 13 00:22 UTC from 160.19.227.159
    '0xpgtc25b3224c126', -- Aug 24 batch sybil
    '0xpgtdfaf326c',     -- 50 PGT (160.19.227.153)
    '0xpgt2f3e29fc',     -- 160.19.227.171
    '0xpgtdc5742c2'      -- 160.19.227.171
);

-- 2. Confirm bans across all previously identified Nower accounts (defense in depth)
UPDATE public.users
SET 
    is_banned = TRUE,
    balance_pgt = 0.0,
    updated_at = NOW()
WHERE player_id IN (
    '0xpgtf542078cfef7',
    '0xpgt169c1562e10c',
    '0xpgt1695ffd2b03c',
    '0xpgt002a11071fa8',
    '0xpgt0b3393db3ee8',
    '0xpgt7db6e89a',
    '0xpgt31ab923c',
    '0xpgt9a5c7166',
    '0xpgtd377d74e',
    '0xpgtab1cb35b97cc',
    '0xpgta65275de'
);

-- 3. Delete fraudulent withdrawal records from September 12 sweep
DELETE FROM public.withdrawals_history
WHERE player_id IN (
    '0xpgtb4d7ffbf80ec',
    '0xpgt0b3393db3ee8',
    '0xpgt002a11071fa8',
    '0xpgt1695ffd2b03c',
    '0xpgt169c1562e10c',
    '0xpgtf542078cfef7'
) AND created_at >= '2026-09-12T00:00:00+00:00';

COMMIT;

-- Verification query
SELECT player_id, username, balance_pgt, is_banned, linked_wallet_address, updated_at
FROM public.users
WHERE player_id IN (
    '0xpgtb4d7ffbf80ec',
    '0xpgt0a3d8fab',
    '0xpgt0ea191de',
    '0xpgtc25b3224c126',
    '0xpgtf542078cfef7',
    '0xpgt169c1562e10c',
    '0xpgt1695ffd2b03c',
    '0xpgt002a11071fa8',
    '0xpgt0b3393db3ee8'
);
