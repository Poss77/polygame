-- ============================================================
-- POLYGAME BALANCE SECURITY AUDIT & SPECIFIC USER RESET SCRIPT
-- Targets ONLY specific cheated account (Mower / 0x909...)
-- Preserves all legitimate high-balance players!
-- ============================================================

-- Step 1: Inspect user Mower / 0x909... specifically
SELECT player_id, linked_wallet_address, username, balance_pgt, updated_at
FROM users
WHERE LOWER(username) LIKE '%mower%'
   OR LOWER(player_id) LIKE '%0x909%'
   OR LOWER(COALESCE(linked_wallet_address, '')) LIKE '%0x909%';

-- Step 2: Reset ONLY user Mower / 0x909... back to 100.00 PGT
UPDATE users
SET balance_pgt = 100.00,
    updated_at = NOW()
WHERE LOWER(username) LIKE '%mower%'
   OR LOWER(player_id) LIKE '%0x909%'
   OR LOWER(COALESCE(linked_wallet_address, '')) LIKE '%0x909%';

-- Step 3: Enforce Anti-Cheat Trigger (Blocks future client REST API updates without affecting legitimate player balances)
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
