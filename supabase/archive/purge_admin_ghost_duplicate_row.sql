-- ============================================================================
-- POLYGON GAMING: PURGE ADMIN GHOST DUPLICATE ROW & ENFORCE UNIQUENESS
-- ============================================================================
-- Version: v1.5.345
-- Purpose:
--   1. Deletes the empty ghost duplicate user row created today with 
--      player_id = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d' (balance 0, no username),
--      which caused PostgREST PGRST116 multiple-row coercion errors on profile lookup.
--   2. Verifies and preserves the authentic Origin Admin account
--      (player_id = '0xpgt85c8416473bd6a8c45ada81ac85aeabb', balance ~119,344 PGT).
-- ============================================================================

DO $$
DECLARE
  v_ghost_count INTEGER := 0;
  v_origin_count INTEGER := 0;
BEGIN
  -- 1. Check authentic Origin account exists
  SELECT COUNT(*) INTO v_origin_count 
  FROM public.users 
  WHERE player_id = '0xpgt85c8416473bd6a8c45ada81ac85aeabb';

  IF v_origin_count = 0 THEN
    RAISE EXCEPTION 'Safety check failed: Origin account not found! Aborting purge.';
  END IF;

  -- 2. Safely purge empty duplicate ghost row
  DELETE FROM public.users 
  WHERE player_id = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
    AND (username IS NULL OR username = '')
    AND (balance_pgt = 0 OR balance_pgt IS NULL);

  GET DIAGNOSTICS v_ghost_count = ROW_COUNT;
  RAISE NOTICE 'Successfully purged % ghost duplicate user row(s). Authentic Origin account preserved.', v_ghost_count;
END;
$$;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
