-- ==============================================================================
-- POLYGAME: MERGE DUPLICATE ACCOUNT FOR KAINMASTER42
-- File: merge_duplicate_kainmaster_account.sql
-- Date: 2026-09-17
-- ==============================================================================
-- Original Account:  0xpgt709b6141 (153.67 PGT, created 2026-09-10, full space state)
-- Duplicate Account: 0xpgtc490cf5a (61.00 PGT, created 2026-09-17, linked wallet 0x9946f255777eab47d5cca5d30ddbe26b9c82640f)
--
-- Merged Total: 153.67 + 61.00 = 214.67 PGT
-- Preserves all space state, stats, daily quests, and permanently binds the Web3 wallet.
-- ==============================================================================

DO $$
DECLARE
  v_orig_balance NUMERIC;
  v_dup_balance NUMERIC;
  v_total_balance NUMERIC;
  v_active_user_id TEXT;
  v_target_wallet TEXT;
BEGIN
  -- 1. Read balances and values from both rows
  SELECT COALESCE(balance_pgt, 0) INTO v_orig_balance
  FROM public.users WHERE player_id = '0xpgt709b6141';

  SELECT COALESCE(balance_pgt, 0), user_id, linked_wallet_address
  INTO v_dup_balance, v_active_user_id, v_target_wallet
  FROM public.users WHERE player_id = '0xpgtc490cf5a';

  IF v_orig_balance IS NULL THEN
    RAISE NOTICE 'Original account 0xpgt709b6141 not found.';
    RETURN;
  END IF;

  v_total_balance := ROUND((v_orig_balance + COALESCE(v_dup_balance, 0))::numeric, 2);

  -- 2. First remove linked_wallet_address and user_id from duplicate row to avoid unique/conflict triggers
  IF v_dup_balance IS NOT NULL THEN
    DELETE FROM public.users WHERE player_id = '0xpgtc490cf5a';
  END IF;

  -- 3. Update original account with combined balance, active user_id, and linked wallet
  UPDATE public.users
  SET balance_pgt = v_total_balance,
      total_earned = ROUND((COALESCE(total_earned, 0) + COALESCE(v_dup_balance, 0))::numeric, 2),
      linked_wallet_address = COALESCE(v_target_wallet, '0x9946f255777eab47d5cca5d30ddbe26b9c82640f'),
      wallet_address = COALESCE(v_target_wallet, '0x9946f255777eab47d5cca5d30ddbe26b9c82640f'),
      -- Assign the active session's user_id so kainmaster42 remains logged in seamlessly
      user_id = COALESCE(v_active_user_id, user_id),
      updated_at = NOW()
  WHERE player_id = '0xpgt709b6141';

  RAISE NOTICE 'Successfully merged kainmaster42: Balance updated to % PGT, wallet bound to %', v_total_balance, v_target_wallet;
END $$;
