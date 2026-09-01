-- ==============================================================================
-- POLYGON GAMING: PRUNE LEGACY UNUSED USERS COLUMNS
-- ==============================================================================
-- Run this script in the Supabase SQL Editor to clean up legacy columns.

ALTER TABLE public.users DROP COLUMN IF EXISTS balance_1flr;
ALTER TABLE public.users DROP COLUMN IF EXISTS last_claim_time;
ALTER TABLE public.users DROP COLUMN IF EXISTS claim_streak;
ALTER TABLE public.users DROP COLUMN IF EXISTS total_claims;
ALTER TABLE public.users DROP COLUMN IF EXISTS alltime_highscore;
ALTER TABLE public.users DROP COLUMN IF EXISTS catcher_highscore;
ALTER TABLE public.users DROP COLUMN IF EXISTS alltime_catcher_highscore;
ALTER TABLE public.users DROP COLUMN IF EXISTS activities;
ALTER TABLE public.users DROP COLUMN IF EXISTS referrals_list;
ALTER TABLE public.users DROP COLUMN IF EXISTS unclaimed_referral_pgt;
ALTER TABLE public.users DROP COLUMN IF EXISTS unclaimed_referral_pol;
ALTER TABLE public.users DROP COLUMN IF EXISTS total_referral_pol;
ALTER TABLE public.users DROP COLUMN IF EXISTS is_admin;
