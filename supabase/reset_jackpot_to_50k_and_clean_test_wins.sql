-- ==============================================================================
-- POLYGON GAMING: RESET GLOBAL JACKPOT & CLEAN TEST WINS
-- Target Action: Reset Global Progressive Jackpot to 50,000 PGT and purge test wins
-- ==============================================================================

-- 1. Reset Global Progressive Jackpot pool to 50,000 PGT
UPDATE public.global_jackpot
SET amount = 50000.00,
    current_amount = 50000.00,
    updated_at = NOW()
WHERE id = 1;

-- 2. Clean up test bet wins (>= 1,000,000 PGT) from Dobby's test run in bet_wins
--    so the Top 10 Weekly Wins leaderboard returns to normal player scores
DELETE FROM public.bet_wins
WHERE (wallet_address = '0xpgt003e7625' OR wallet_address = '0x602BEc371e2A99f679C73A5930a590CeBf8e7696')
  AND payout >= 1000000;

-- 3. Confirm new jackpot counter state
SELECT id, amount, current_amount, updated_at
FROM public.global_jackpot
WHERE id = 1;
