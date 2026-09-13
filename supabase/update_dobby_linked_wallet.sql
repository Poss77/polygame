-- ==============================================================================
-- UPDATE DOBBY THEDEV LINKED WALLET ADDRESS
-- Replaces old wallet 0x6c88...1882 with new wallet 0x602b...7696
-- ==============================================================================

-- 1. Upgrade lock_linked_wallet_address trigger so it only restricts untrusted
-- client roles ('anon', 'authenticated'), allowing admin SQL updates to succeed.
CREATE OR REPLACE FUNCTION lock_linked_wallet_address()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  IF LOWER(CURRENT_USER) IN ('anon', 'authenticated') THEN
    IF OLD.linked_wallet_address IS NOT NULL AND OLD.linked_wallet_address <> '' THEN
      IF NEW.linked_wallet_address IS DISTINCT FROM OLD.linked_wallet_address AND NEW.linked_wallet_address IS NOT NULL AND NEW.linked_wallet_address <> '' THEN
        NEW.linked_wallet_address := OLD.linked_wallet_address;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Temporarily disable the trigger for this atomic update
ALTER TABLE public.users DISABLE TRIGGER trg_lock_linked_wallet;

-- 3. Perform the wallet address update
UPDATE public.users
SET linked_wallet_address = '0x602BEc371e2A99f679C73A5930a590CeBf8e7696',
    updated_at = NOW()
WHERE LOWER(player_id) = '0xpgt003e7625'
   OR LOWER(username) = 'dobby thedev'
   OR LOWER(linked_wallet_address) = '0x6c88ed97c750843b50c8325721f533f8f4e41882';

-- 4. Re-enable the trigger to keep player anti-hijack protections 100% active
ALTER TABLE public.users ENABLE TRIGGER trg_lock_linked_wallet;

-- 5. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
