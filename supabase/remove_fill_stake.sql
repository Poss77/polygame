-- ==============================================================================
-- POLYGAME SCRIPT: REMOVE STAKE FOR USER 'FILL' / 0x47...
-- ==============================================================================
-- Purpose:
-- 1. Locates the user profile for Fill / 0x47...
-- 2. Deactivates and deletes all active stakes from `user_stakes`.
-- 3. Resets `staked_balance_pgt`, `staked_balance_1flr`, and `stakes` in `users`.
-- 4. Verifies clean 0.0 staked balance.
-- ==============================================================================

DO $$
DECLARE
  v_target_user RECORD;
  v_pid TEXT;
  v_wallet TEXT;
BEGIN
  -- 1. Find user by linked wallet 0x47..., player_id 0x47..., or username 'Fill'/'Phil'
  SELECT player_id, linked_wallet_address, username, email, staked_balance_pgt
  INTO v_target_user
  FROM users
  WHERE 
    LOWER(COALESCE(linked_wallet_address, '')) LIKE '0x47%'
    OR LOWER(COALESCE(player_id, '')) LIKE '0x47%'
    OR LOWER(COALESCE(username, '')) ILIKE 'fill%'
    OR LOWER(COALESCE(username, '')) ILIKE 'phil%'
  LIMIT 1;

  IF v_target_user.player_id IS NOT NULL THEN
    v_pid := v_target_user.player_id;
    v_wallet := COALESCE(v_target_user.linked_wallet_address, '');
    
    RAISE NOTICE 'Target User Identified: player_id=%, wallet=%, username=%, current_staked=%', 
      v_pid, v_wallet, v_target_user.username, v_target_user.staked_balance_pgt;

    -- 2. Delete / Deactivate stakes from user_stakes table
    DELETE FROM user_stakes
    WHERE LOWER(wallet_address) = LOWER(v_pid)
       OR (v_wallet <> '' AND LOWER(wallet_address) = LOWER(v_wallet));

    -- 3. Reset staked balances and JSON stakes array in users table
    UPDATE users
    SET 
      staked_balance_pgt = 0.0,
      staked_balance_1flr = 0.0,
      stakes = '[]'::jsonb,
      updated_at = NOW()
    WHERE 
      LOWER(player_id) = LOWER(v_pid)
      OR (v_wallet <> '' AND LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_wallet));

    RAISE NOTICE 'Successfully removed all stakes and reset staked balance to 0.0.';
  ELSE
    RAISE NOTICE 'No matching user found for 0x47... / Fill. Please check query filters.';
  END IF;
END $$;

-- 4. Verification: Inspect user profile and active stakes
SELECT 
  player_id, 
  linked_wallet_address, 
  username, 
  email,
  balance_pgt, 
  staked_balance_pgt, 
  staked_balance_1flr, 
  stakes,
  updated_at 
FROM users 
WHERE 
  LOWER(COALESCE(linked_wallet_address, '')) LIKE '0x47%'
  OR LOWER(COALESCE(player_id, '')) LIKE '0x47%'
  OR LOWER(COALESCE(username, '')) ILIKE 'fill%'
  OR LOWER(COALESCE(username, '')) ILIKE 'phil%';

-- 5. Verification: Check user_stakes table (should return 0 rows)
SELECT * 
FROM user_stakes 
WHERE 
  LOWER(wallet_address) LIKE '0x47%'
  OR LOWER(wallet_address) IN (
    SELECT LOWER(player_id) FROM users 
    WHERE LOWER(COALESCE(linked_wallet_address, '')) LIKE '0x47%' 
       OR LOWER(COALESCE(username, '')) ILIKE 'fill%'
       OR LOWER(COALESCE(username, '')) ILIKE 'phil%'
  );
