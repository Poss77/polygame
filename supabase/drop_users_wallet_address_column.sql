-- ==============================================================================
-- POLYGON GAMING: DROP users.wallet_address COLUMN & INDEX
-- ==============================================================================
-- Run this migration in the Supabase SQL Editor.
-- Drops the unused, empty users.wallet_address column from public.users.
-- EVM addresses on public.users are strictly stored in linked_wallet_address.
-- ==============================================================================

DROP INDEX IF EXISTS public.idx_users_wallet_address;

ALTER TABLE public.users DROP COLUMN IF EXISTS wallet_address;

-- Reload Supabase Schema Cache
NOTIFY pgrst, 'reload schema';

-- Verification query
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name IN ('wallet_address', 'linked_wallet_address');
