-- ============================================================
-- POLYGAME DROP LEGACY REFERRED_BY COLUMN & CLEANUP
-- Drops the old legacy "referred_by" column from users table
-- ============================================================

-- 1. Drop legacy column
ALTER TABLE users DROP COLUMN IF EXISTS referred_by;

-- 2. Recalculate 4-tier referral counters based on active referred_by_l1..l4 columns
UPDATE users u SET
  referrals_l1 = (
    SELECT COUNT(*) FROM users 
    WHERE LOWER(referred_by_l1) = LOWER(u.player_id) 
       OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(referred_by_l1) = LOWER(u.linked_wallet_address))
  ),
  referrals_l2 = (
    SELECT COUNT(*) FROM users 
    WHERE LOWER(referred_by_l2) = LOWER(u.player_id) 
       OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(referred_by_l2) = LOWER(u.linked_wallet_address))
  ),
  referrals_l3 = (
    SELECT COUNT(*) FROM users 
    WHERE LOWER(referred_by_l3) = LOWER(u.player_id) 
       OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(referred_by_l3) = LOWER(u.linked_wallet_address))
  ),
  referrals_l4 = (
    SELECT COUNT(*) FROM users 
    WHERE LOWER(referred_by_l4) = LOWER(u.player_id) 
       OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(referred_by_l4) = LOWER(u.linked_wallet_address))
  );

UPDATE users SET
  referrals_count = COALESCE(referrals_l1, 0) + COALESCE(referrals_l2, 0) + COALESCE(referrals_l3, 0) + COALESCE(referrals_l4, 0);
