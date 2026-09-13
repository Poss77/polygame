-- ==============================================================================
-- POLYGAME: STRICT IMMUTABILITY SHIELD FOR CREATED_AT & PRIVILEGED FIELDS
-- Prevents clients from setting fake created_at timestamps on INSERT or UPDATE.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  -- When invoked directly from the public PostgREST API (anon or authenticated role)
  IF CURRENT_USER IN ('anon', 'authenticated') THEN
    -- On INSERT: Force starting values and real-time timestamp
    IF TG_OP = 'INSERT' THEN
      NEW.balance_pgt := 0.0;
      NEW.balance_1flr := 0.0;
      NEW.created_at := NOW();
      NEW.is_admin := false;
      NEW.is_ambassador := false;
      NEW.vip_until := NULL;
    -- On UPDATE: Revert any unauthorized field mutations
    ELSIF TG_OP = 'UPDATE' THEN
      -- 1. Immutable registration timestamp
      IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        NEW.created_at := OLD.created_at;
      END IF;
      -- 2. Immutable balances
      IF NEW.balance_pgt IS DISTINCT FROM OLD.balance_pgt THEN
        NEW.balance_pgt := OLD.balance_pgt;
      END IF;
      IF NEW.balance_1flr IS DISTINCT FROM OLD.balance_1flr THEN
        NEW.balance_1flr := OLD.balance_1flr;
      END IF;
      -- 3. Immutable roles and VIP status
      IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
        NEW.is_admin := OLD.is_admin;
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
