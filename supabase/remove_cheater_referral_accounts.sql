-- ==============================================================================
-- POLYGAME CLEANUP: PURGE CHEATER ACCOUNTS & RESET REFERRAL LEADERBOARD STATS
-- 1. DELETE 0x8855...2ef8 AND ITS BOT DOWNLINE (NO LEGITIMATE SESSIONS/PROGRESS)
-- 2. ZERO-OUT ALL ILLICIT REFERRAL COMMISSIONS ON BANNED NOWER ACCOUNTS
-- ==============================================================================

-- 1. Completely delete bot farm accounts 0x8855...2ef8 and 0xa798...
DELETE FROM public.users
WHERE LOWER(player_id) IN ('0xpgt8855620be7f7', '0xpgta798a6a03c48')
   OR LOWER(COALESCE(linked_wallet_address, '')) IN (
     '0x8855620be7f71e69abf2221c0c2f19b1b9f62ef8',
     '0xa798a6a03c4814f053fcda7ecbdc4a7e32e8c5ee'
   );

-- 2. Zero-out referral commission stats and ensure banned status on all Nower accounts
UPDATE public.users
SET total_referral_commission = 0.0,
    unclaimed_referral_pgt = 0.0,
    balance_pgt = 0.0,
    is_banned = true,
    updated_at = NOW()
WHERE LOWER(player_id) IN (
  '0xpgt31ab923c',      -- Nower referrer account on leaderboard
  '0xpgtf542078cfef7',  -- Nower main exploiter account
  '0xpgt6f58ef3c',      -- Nower legacy alt
  '0xpgta65275de',      -- Nower legacy alt
  '0xpgt7db6e89a',      -- Nower legacy alt
  '0xpgttestestra1',    -- Nower linked test account
  '0xpgt0b3393db3ee8',  -- Sybil bot
  '0xpgt002a11071fa8',  -- Sybil bot
  '0xpgt1695ffd2b03c',  -- Sybil bot
  '0xpgt169c1562e10c'   -- Sybil bot
)
OR LOWER(COALESCE(linked_wallet_address, '')) IN (
  '0x909e9a5c84bd638b5b4c292b7f7fde4ccbec2864',
  '0xf542078cfef76127c325e8e7833187fc5eda3279',
  '0x529ec3e1dcbee54e0e5a0a6f46222793fe0405df',
  '0x0000000f65d503603782d94e78e30c6d05955741',
  '0x38f7896c32bb9b9c336be7c3c6b56e8453dbf70d',
  '0x0b3393db3ee84ae9b93093642ef67073cd8d3fe8',
  '0x002a11071fa8d23f15e8c6b4d3dac0ffc36efc7b',
  '0x1695ffd2b03cabbc002cab4cfbf8c880ac7188fd',
  '0x169c1562e10ceae81ac5269763ef224a61b4b99c'
);

-- 3. Force PostgREST schema and cache refresh
NOTIFY pgrst, 'reload schema';
