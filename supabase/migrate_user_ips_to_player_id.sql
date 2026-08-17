-- ==============================================================================
-- POLYGAME: MIGRATE USER_IPS TABLE FROM WALLET_ADDRESS TO PLAYER_ID
-- ==============================================================================

-- 1. Safely migrate user_ips schema to use player_id as primary key
DO $$
BEGIN
  -- If table exists with old wallet_address column, rename to player_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_ips' AND column_name = 'wallet_address'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'user_ips' AND column_name = 'player_id'
    ) THEN
      ALTER TABLE public.user_ips RENAME COLUMN wallet_address TO player_id;
    END IF;
  ELSE
    CREATE TABLE IF NOT EXISTS public.user_ips (
      player_id TEXT PRIMARY KEY,
      ip_address TEXT NOT NULL,
      linked_wallet_address TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_seen TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- 2. Ensure linked_wallet_address and last_seen columns exist
ALTER TABLE public.user_ips ADD COLUMN IF NOT EXISTS linked_wallet_address TEXT;
ALTER TABLE public.user_ips ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();

-- 3. Update RLS policies on user_ips
ALTER TABLE public.user_ips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read user_ips" ON public.user_ips;
DROP POLICY IF EXISTS "Allow public insert user_ips" ON public.user_ips;
DROP POLICY IF EXISTS "Allow public update user_ips" ON public.user_ips;
DROP POLICY IF EXISTS "Allow public upsert user_ips" ON public.user_ips;

CREATE POLICY "Allow public read user_ips" ON public.user_ips FOR SELECT USING (true);
CREATE POLICY "Allow public insert user_ips" ON public.user_ips FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update user_ips" ON public.user_ips FOR UPDATE USING (true);

GRANT ALL ON public.user_ips TO anon, authenticated, service_role;

-- 4. Fast Indexes for IP clustering queries
CREATE INDEX IF NOT EXISTS idx_user_ips_ip ON public.user_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_ips_player_id ON public.user_ips(lower(player_id));
CREATE INDEX IF NOT EXISTS idx_user_ips_linked_wallet ON public.user_ips(lower(linked_wallet_address));
