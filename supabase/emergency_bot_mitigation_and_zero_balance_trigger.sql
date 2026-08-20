-- ==============================================================================
-- POLYGAME EMERGENCY SECURITY HOTFIX & BOT ACCOUNT ZERO-OUT
-- ==============================================================================
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor) immediately.
-- 
-- WHAT THIS SCRIPT DOES:
-- 1. Permanently installs the BEFORE INSERT and BEFORE UPDATE security trigger on
--    the `users` table. This prevents ANY direct balance injection on account creation
--    or profile saves via the public REST API.
-- 2. Resets all bot-generated accounts created today with inflated balances to 0 PGT.
-- 3. Drops unverified balance crediting RPCs (`credit_arcade_payout`).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: Bulletproof Anti-Cheat Trigger (Blocks all direct INSERT/UPDATE balance mutations)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Handle INSERT (New account creation via public REST API)
  IF TG_OP = 'INSERT' THEN
    IF current_user IN ('anon', 'authenticated') THEN
      NEW.balance_pgt := 0.0;
      NEW.balance_1flr := 0.0;
      NEW.staked_balance_pgt := 0.0;
      NEW.staked_balance_1flr := 0.0;
      NEW.total_staking_yield := 0.0;
      NEW.total_earned := 0.0;
    END IF;
    RETURN NEW;

  -- 2. Handle UPDATE (Direct update via public REST API)
  ELSIF TG_OP = 'UPDATE' THEN
    IF current_user IN ('anon', 'authenticated') THEN
      -- Strict balance immutability: Never allow client to increase balance
      NEW.balance_pgt := OLD.balance_pgt;
      NEW.balance_1flr := OLD.balance_1flr;
      NEW.staked_balance_pgt := OLD.staked_balance_pgt;
      NEW.staked_balance_1flr := OLD.staked_balance_1flr;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Bind trigger to `users` table
DROP TRIGGER IF EXISTS trg_prevent_direct_balance_mutation ON public.users;
DROP TRIGGER IF EXISTS trg_prevent_direct_balance_update ON public.users;
DROP TRIGGER IF EXISTS trg_prevent_direct_balance_insert ON public.users;

CREATE TRIGGER trg_prevent_direct_balance_mutation
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_balance_mutation();

-- ------------------------------------------------------------------------------
-- STEP 2: Drop Unverified Balance-Crediting RPCs
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.credit_arcade_payout(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS public.credit_arcade_payout(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.credit_arcade_payout CASCADE;

-- ------------------------------------------------------------------------------
-- STEP 3: Reset Exploit Bot Accounts (Created in the last 24h with zero gameplay)
-- ------------------------------------------------------------------------------
UPDATE public.users
SET 
  balance_pgt = 0.0,
  staked_balance_pgt = 0.0,
  updated_at = NOW()
WHERE 
  created_at >= (NOW() - INTERVAL '24 hours')
  AND total_claims = 0
  AND COALESCE(game_highscore, 0) = 0
  AND COALESCE(invaders_highscore, 0) = 0
  AND COALESCE(drift_highscore, 0) = 0
  AND COALESCE(stacker_highscore, 0) = 0
  AND balance_pgt > 100;

-- ------------------------------------------------------------------------------
-- STEP 4: Verification Query (Confirm trigger and inspect cleaned accounts)
-- ------------------------------------------------------------------------------
SELECT 
  player_id, 
  linked_wallet_address, 
  balance_pgt, 
  created_at 
FROM public.users
WHERE created_at >= (NOW() - INTERVAL '24 hours')
ORDER BY created_at DESC
LIMIT 30;
