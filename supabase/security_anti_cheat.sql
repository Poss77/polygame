-- ============================================================================
-- POLYGAME SECURITY & ANTI-CHEAT SHIELD
-- Prevents direct client-side (DevTools / REST API) tampering of balance_pgt
-- ============================================================================

-- 1. Reset Cheater Wallet Balance to 0
UPDATE users 
SET balance_pgt = 0 
WHERE LOWER(wallet_address) = LOWER('0xC26fb490a633d4753Ce663781aA5FdCa61b10fd9');

-- 2. Create PostgreSQL Trigger Function to Block Direct Client Balance Mutations
CREATE OR REPLACE FUNCTION prevent_direct_balance_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allow RPCs / service_role (which bypass RLS or run with SECURITY DEFINER)
  -- to modify balance_pgt. If anon or authenticated user tries to PATCH balance_pgt via REST/client, preserve OLD balance.
  IF (current_user = 'anon' OR current_user = 'authenticated') AND OLD.balance_pgt IS DISTINCT FROM NEW.balance_pgt THEN
    RAISE NOTICE 'Blocked unauthorized client balance_pgt mutation attempt for wallet %', NEW.wallet_address;
    NEW.balance_pgt := OLD.balance_pgt;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach Trigger to `users` Table
DROP TRIGGER IF EXISTS trg_prevent_direct_balance_mutation ON users;
CREATE TRIGGER trg_prevent_direct_balance_update
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_direct_balance_mutation();
