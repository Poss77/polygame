-- ============================================================================
-- POLYGAME SECURITY & ANTI-CHEAT SHIELD
-- Prevents direct client-side (DevTools / REST API) tampering of balance_pgt
-- ============================================================================

-- 1. Reset Cheater Wallet Balance to 0
UPDATE users 
SET balance_pgt = 0 
WHERE LOWER(wallet_address) = LOWER('0xC26fb490a633d4753Ce663781aA5FdCa61b10fd9');

-- 2. Drop existing trigger & function to clean up any partial state
DROP TRIGGER IF EXISTS trg_prevent_direct_balance_update ON users;
DROP FUNCTION IF EXISTS prevent_direct_balance_mutation();

-- 3. Create PostgreSQL Trigger Function to Block Direct Client Balance Mutations
CREATE OR REPLACE FUNCTION prevent_direct_balance_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.balance_pgt IS DISTINCT FROM NEW.balance_pgt THEN
    IF current_user IN ('anon', 'authenticated') THEN
      NEW.balance_pgt := OLD.balance_pgt;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Attach Trigger to `users` Table
CREATE TRIGGER trg_prevent_direct_balance_update
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_direct_balance_mutation();
