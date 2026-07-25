-- ============================================================================
-- POLYGAME - MASTER BALANCE SECURITY & PAYOUT REPAIR SCRIPT
-- Run this in Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- ============================================================================

-- 1. Ensure columns exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS balance_pgt NUMERIC DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS space_state JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS invaders_highscore INTEGER DEFAULT 0;

-- 2. Create / Replace credit_arcade_payout RPC (Atomic balance addition)
CREATE OR REPLACE FUNCTION credit_arcade_payout(p_wallet TEXT, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid amount');
  END IF;

  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + p_amount,
      updated_at = NOW()
  WHERE LOWER(wallet_address) = LOWER(p_wallet)
  RETURNING balance_pgt INTO v_new_balance;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User wallet not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION credit_arcade_payout(TEXT, NUMERIC) TO anon, authenticated, service_role;

-- 3. Create Anti-Cheat Trigger to prevent client REST updates from touching balance_pgt
CREATE OR REPLACE FUNCTION prevent_direct_balance_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  -- If updated by client-side REST API (anon or authenticated role),
  -- ALWAYS force NEW.balance_pgt to keep OLD.balance_pgt!
  -- This prevents upserts/updates from zeroing out or altering balance_pgt directly.
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
