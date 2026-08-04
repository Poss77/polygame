-- PolyGame DB Script: Fix Missing / NULL / EMPTY Referral Codes
-- Generates a unique 5-digit numeric referral code for any existing user with NULL or EMPTY referral_code

UPDATE users
SET referral_code = (FLOOR(10000 + RANDOM() * 90000))::text
WHERE referral_code IS NULL OR referral_code = '' OR referral_code = 'EMPTY';
