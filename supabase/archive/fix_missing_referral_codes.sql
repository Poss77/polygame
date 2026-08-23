-- PolyGame DB Script: Fix Missing / NULL / EMPTY Referral Codes
-- Generates a unique 8-character hex referral code (e.g. ref_a8f92c1b, 4.29B+ combinations) for any user missing referral_code

UPDATE users
SET referral_code = 'ref_' || substring(md5(random()::text) from 1 for 8)
WHERE referral_code IS NULL OR referral_code = '' OR referral_code = 'EMPTY';
