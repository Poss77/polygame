-- ============================================================
-- POLYGAME BALANCE SECURITY AUDIT & RESET SCRIPT
-- Run this script in your Supabase SQL Editor to:
-- 1. Inspect and reset user accounts with inflated balances (> 1,000,000 PGT)
-- 2. Re-enforce the PostgreSQL Anti-Cheat Trigger to block client-side balance updates
-- ============================================================

-- Step 1: Inspect suspicious accounts holding over 1,000,000 PGT
SELECT player_id, linked_wallet_address, username, balance_pgt, updated_at
FROM users
WHERE balance_pgt > 1000000
ORDER BY balance_pgt DESC;

-- Step 2: Reset user accounts with balance > 1,000,000 PGT back to 100.00 PGT
UPDATE users
SET balance_pgt = 100.00,
    updated_at = NOW()
WHERE balance_pgt > 1000000;

-- Step 3: Enforce Anti-Cheat Trigger (Blocks client REST API updates from altering balance_pgt)
CREATE OR REPLACE FUNCTION prevent_direct_balance_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  -- If updated directly by client-side REST API (anon or authenticated role),
  -- ALWAYS force NEW.balance_pgt to keep OLD.balance_pgt!
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
