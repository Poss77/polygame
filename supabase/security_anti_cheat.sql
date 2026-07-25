-- ============================================================================
-- POLYGAME SECURITY & ANTI-CHEAT SHIELD (UPDATED)
-- Prevents direct client-side (DevTools / REST API) tampering of balance_pgt.
-- All balance mutations MUST go through SECURITY DEFINER RPCs.
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_direct_balance_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  -- If updated directly by client REST API (anon or authenticated role),
  -- ALWAYS force NEW.balance_pgt to keep OLD.balance_pgt!
  -- This prevents upsert/update from zeroing out or altering balance_pgt directly.
  IF current_user IN ('anon', 'authenticated') THEN
    NEW.balance_pgt := OLD.balance_pgt;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_balance_update ON users;

CREATE TRIGGER trg_prevent_direct_balance_update
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_direct_balance_mutation();
