-- ==============================================================================
-- POLYGAME: CLEAN USER_IPS MIGRATION (wallet_address -> player_id)
-- ==============================================================================

DO $$
BEGIN
  -- If wallet_address column exists, rename it to player_id
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_seen TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- Drop linked_wallet_address if it was ever added
ALTER TABLE public.user_ips DROP COLUMN IF EXISTS linked_wallet_address;
ALTER TABLE public.user_ips ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();

-- Enable RLS and Grant permissions
ALTER TABLE public.user_ips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read user_ips" ON public.user_ips;
DROP POLICY IF EXISTS "Allow public insert user_ips" ON public.user_ips;
DROP POLICY IF EXISTS "Allow public update user_ips" ON public.user_ips;
DROP POLICY IF EXISTS "Allow public upsert user_ips" ON public.user_ips;

CREATE POLICY "Allow public read user_ips" ON public.user_ips FOR SELECT USING (true);
CREATE POLICY "Allow public insert user_ips" ON public.user_ips FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update user_ips" ON public.user_ips FOR UPDATE USING (true);

GRANT ALL ON public.user_ips TO anon, authenticated, service_role;

-- Fast Indexes
CREATE INDEX IF NOT EXISTS idx_user_ips_ip ON public.user_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_ips_player_id ON public.user_ips(lower(player_id));
