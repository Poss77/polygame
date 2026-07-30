-- ============================================================
-- POLYGAME: AMBASSADOR PROGRAM SCHEMA & ADMIN PROMOTION RPC
-- ============================================================

-- 1. Add is_ambassador column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_ambassador BOOLEAN DEFAULT FALSE;

-- 2. Create RPC for Admin to promote/demote Ambassador status
CREATE OR REPLACE FUNCTION toggle_ambassador_status(
  p_target_wallet TEXT,
  p_is_ambassador BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  p_target_wallet := LOWER(TRIM(p_target_wallet));

  UPDATE users
  SET is_ambassador = p_is_ambassador
  WHERE LOWER(wallet_address) = p_target_wallet;

  RETURN jsonb_build_object(
    'success', true,
    'target_wallet', p_target_wallet,
    'is_ambassador', p_is_ambassador
  );
END;
$$;
