-- ==============================================================================
-- POLYGON GAMING: RESTORE POSS ACCOUNT STATUS & LEADERBOARD VISIBILITY
-- Target: Poss (0xpgt8312e02d37185b5983e6922d1dae1cce)
-- Reason: Clear spoofed bot warnings and restore unbanned status after framing attack
-- ==============================================================================

-- 1. Unban Poss and reset bot warnings to 0
UPDATE public.users
SET is_banned = false,
    bot_warning = 0
WHERE player_id = '0xpgt8312e02d37185b5983e6922d1dae1cce';

-- 2. Clean up spoofed bot security logs generated during Dobby's attack
DELETE FROM public.bot_security_logs
WHERE player_id = '0xpgt8312e02d37185b5983e6922d1dae1cce'
  AND reason = 'nft_sync_invalid_item';
