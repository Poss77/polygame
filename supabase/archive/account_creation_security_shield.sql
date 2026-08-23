-- ==============================================================================
-- POLYGAME SECURITY SHIELD: ZERO-BALANCE ACCOUNT CREATION & BALANCE INTEGRITY
-- ==============================================================================
-- Purpose:
-- 1. Prevents client-side balance injection on user registration (INSERT).
-- 2. Prevents client-side balance tampering on existing users (UPDATE).
-- 3. Enforces that all balance mutations MUST go through SECURITY DEFINER RPCs.
-- 4. Cleans up suspicious/injected balances from initial registration exploits.
-- ==============================================================================

-- Step 1: Upgraded Anti-Cheat Trigger Function (Handles both INSERT and UPDATE)
CREATE OR REPLACE FUNCTION prevent_direct_balance_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Handle INSERT: When a new user account is created via the public REST API
  IF TG_OP = 'INSERT' THEN
    IF current_user IN ('anon', 'authenticated') THEN
      NEW.balance_pgt := 0.0;
      NEW.staked_balance_pgt := 0.0;
      NEW.staked_balance_1flr := 0.0;
      NEW.total_staking_yield := 0.0;
    END IF;
    RETURN NEW;

  -- Handle UPDATE: When an existing user is updated via the public REST API
  ELSIF TG_OP = 'UPDATE' THEN
    IF current_user IN ('anon', 'authenticated') THEN
      -- Force balances to remain unchanged from their verified DB state
      NEW.balance_pgt := OLD.balance_pgt;
      NEW.staked_balance_pgt := OLD.staked_balance_pgt;
      NEW.staked_balance_1flr := OLD.staked_balance_1flr;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Step 2: Bind Trigger to both BEFORE INSERT and BEFORE UPDATE on `users` table
DROP TRIGGER IF EXISTS trg_prevent_direct_balance_update ON users;
DROP TRIGGER IF EXISTS trg_prevent_direct_balance_insert ON users;
DROP TRIGGER IF EXISTS trg_prevent_direct_balance_mutation ON users;

CREATE TRIGGER trg_prevent_direct_balance_mutation
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_direct_balance_mutation();

-- Step 3: Audit & Reset Suspicious Injected Balances
-- Specifically target player 0x38f7896c32bb9b9c336be7c3c6b56e8453dbf70d (or any other newly created anomalous accounts)
UPDATE users 
SET 
  balance_pgt = 0.0,
  staked_balance_pgt = 0.0,
  updated_at = NOW()
WHERE 
  LOWER(player_id) = LOWER('0x38f7896c32bb9b9c336be7c3c6b56e8453dbf70d')
  OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER('0x38f7896c32bb9b9c336be7c3c6b56e8453dbf70d');

-- Step 4: Verification Query (Inspect player status)
SELECT 
  player_id, 
  linked_wallet_address, 
  username, 
  balance_pgt, 
  staked_balance_pgt, 
  created_at, 
  updated_at 
FROM users 
WHERE 
  LOWER(player_id) = LOWER('0x38f7896c32bb9b9c336be7c3c6b56e8453dbf70d')
  OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER('0x38f7896c32bb9b9c336be7c3c6b56e8453dbf70d');
