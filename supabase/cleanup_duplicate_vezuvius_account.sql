-- ==============================================================================
-- CLEANUP MIGRATION: Purge Duplicate Empty Web3 Account for Vezuvius King
-- Purpose:
--   Removes the newly created duplicate empty account (0xpgt1b6022d6) created
--   when Vezuvius King signed in via MetaMask while logged out of Google.
--   Preserves his primary authoritative account (0xpgt1340d9e6) with all 11,253.48 PGT,
--   his 4.58 POL commissions, all 17 Quantum Relics, and high scores.
-- ==============================================================================

DO $$
DECLARE
  v_real_user RECORD;
  v_ghost_user RECORD;
BEGIN
  -- 1. Verify primary authoritative account exists
  SELECT * INTO v_real_user 
  FROM public.users 
  WHERE player_id = '0xpgt1340d9e6';

  IF v_real_user IS NULL THEN
    RAISE EXCEPTION 'Safety check failed: Primary account 0xpgt1340d9e6 not found!';
  END IF;

  RAISE NOTICE 'Found primary account: % (Username: %, Balance: % PGT, Relics: %)', 
    v_real_user.player_id, v_real_user.username, v_real_user.balance_pgt, v_real_user.relics;

  -- 2. Check for duplicate ghost account
  SELECT * INTO v_ghost_user 
  FROM public.users 
  WHERE player_id = '0xpgt1b6022d6';

  IF v_ghost_user IS NOT NULL THEN
    -- Safety validation: Only delete if balance is 0 to ensure zero fund loss
    IF COALESCE(v_ghost_user.balance_pgt, 0) > 0 THEN
      RAISE EXCEPTION 'Safety check failed: Ghost account balance is % PGT (greater than 0)', v_ghost_user.balance_pgt;
    END IF;

    -- Delete duplicate row
    DELETE FROM public.users WHERE player_id = '0xpgt1b6022d6';
    RAISE NOTICE 'Successfully purged duplicate empty ghost account 0xpgt1b6022d6';
  ELSE
    RAISE NOTICE 'Duplicate account 0xpgt1b6022d6 already does not exist.';
  END IF;

  -- 3. Confirm linked_wallet_address is strictly bound to primary account
  UPDATE public.users
  SET linked_wallet_address = '0xfa437ab5ff649d3dffc687c05e4b3c145d0e836a',
      updated_at = NOW()
  WHERE player_id = '0xpgt1340d9e6' 
    AND (linked_wallet_address IS NULL OR LOWER(linked_wallet_address) <> '0xfa437ab5ff649d3dffc687c05e4b3c145d0e836a');

END $$;

NOTIFY pgrst, 'reload schema';
