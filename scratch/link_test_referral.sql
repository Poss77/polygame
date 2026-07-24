-- ====================================================================
-- TEST REFERRAL LINKING SCRIPT
-- Master Admin Wallet: 0x10B9993990c9EF8a212c9557cB02aD94da9a654d
-- ====================================================================

-- 1. Make YOUR ACCOUNT (0x9220...) the referrer for the Admin Wallet
-- (Meaning when Admin claims rewards, YOUR ACCOUNT gets 10% referral commission in unclaimed pool!)
UPDATE users 
SET 
  referred_by_l1 = lower('YOUR_FULL_WALLET_ADDRESS_HERE'), -- Replace with your full 0x9220... address
  updated_at = now()
WHERE lower(wallet_address) = lower('0x10B9993990c9EF8a212c9557cB02aD94da9a654d');

-- 2. Make sure your referrer stats count is updated
UPDATE users 
SET 
  referrals_count = COALESCE(referrals_count, 0) + 1,
  referrals_l1 = COALESCE(referrals_l1, 0) + 1
WHERE lower(wallet_address) = lower('YOUR_FULL_WALLET_ADDRESS_HERE'); -- Replace with your full 0x9220... address
