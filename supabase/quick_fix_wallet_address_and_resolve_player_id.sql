-- ==============================================================================
-- POLYGON GAMING: IMMEDIATE HOTFIX FOR resolve_player_id & users.wallet_address
-- ==============================================================================
-- Fixes PostgreSQL Error 42703: column "wallet_address" does not exist
-- 1. Adds missing column guarantees to public.users
-- 2. Re-creates resolve_player_id cleanly without referencing phantom columns
-- ==============================================================================

-- 1. Ensure columns exist on public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS linked_wallet_address TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS wallet_address TEXT;

-- 2. Drop and re-create canonical resolve_player_id
DROP FUNCTION IF EXISTS public.resolve_player_id(TEXT);
DROP FUNCTION IF EXISTS resolve_player_id(TEXT);

CREATE OR REPLACE FUNCTION resolve_player_id(p_wallet TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_clean TEXT := LOWER(TRIM(COALESCE(p_wallet, '')));
BEGIN
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  SELECT player_id INTO v_pid
  FROM users
  WHERE LOWER(player_id) = v_clean
     OR LOWER(COALESCE(linked_wallet_address, '')) = v_clean
     OR LOWER(COALESCE(user_id::TEXT, '')) = v_clean
  LIMIT 1;

  IF v_pid IS NOT NULL THEN
    RETURN v_pid;
  END IF;

  RETURN v_clean;
END;
$$;

GRANT EXECUTE ON FUNCTION resolve_player_id(TEXT) TO anon, authenticated, service_role;
