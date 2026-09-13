-- ==============================================================================
-- POLYGON GAMING: PRUNE LEGACY UNUSED USERS COLUMNS & REFRESH BALANCE SHIELD
-- ==============================================================================
-- Run this script in the Supabase SQL Editor.

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

-- Refresh Anti-Cheat Balance Shield Trigger (without dropped columns)
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  IF CURRENT_USER IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.balance_pgt := 0.0;
      NEW.created_at := NOW();
      NEW.is_ambassador := false;
      NEW.vip_until := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        NEW.created_at := OLD.created_at;
      END IF;
      IF NEW.balance_pgt IS DISTINCT FROM OLD.balance_pgt THEN
        NEW.balance_pgt := OLD.balance_pgt;
      END IF;
      IF NEW.is_ambassador IS DISTINCT FROM OLD.is_ambassador THEN
        NEW.is_ambassador := OLD.is_ambassador;
      END IF;
      IF NEW.vip_until IS DISTINCT FROM OLD.vip_until THEN
        NEW.vip_until := OLD.vip_until;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_balance_mutation ON public.users;
CREATE TRIGGER trg_prevent_direct_balance_mutation
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_balance_mutation();

