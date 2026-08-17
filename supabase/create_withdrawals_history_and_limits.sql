-- ====================================================================
-- POLYGAME: ON-CHAIN WITHDRAWAL LIMITS & 5-PER-WEEK RATE LIMITING
-- 1. Creates withdrawals_history table for auditing and quota tracking
-- 2. Ensures min_withdraw_pgt and max_withdraw_pgt exist in global_settings
-- 3. Sets max_withdraw_pgt default to 100,000 PGT
-- ====================================================================

-- 1. Create withdrawals_history table
CREATE TABLE IF NOT EXISTS public.withdrawals_history (
  id BIGSERIAL PRIMARY KEY,
  player_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  nonce BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Performance Indexes for fast 7-day rolling quota queries
CREATE INDEX IF NOT EXISTS idx_withdrawals_history_player ON public.withdrawals_history(lower(player_id), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_history_wallet ON public.withdrawals_history(lower(wallet_address), created_at DESC);

-- 3. RLS Security Policies
ALTER TABLE public.withdrawals_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on withdrawals_history" ON public.withdrawals_history;
CREATE POLICY "Allow public read access on withdrawals_history" 
  ON public.withdrawals_history FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Service role full access on withdrawals_history" ON public.withdrawals_history;
CREATE POLICY "Service role full access on withdrawals_history" 
  ON public.withdrawals_history FOR ALL 
  USING (true)
  WITH CHECK (true);

GRANT ALL ON public.withdrawals_history TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.withdrawals_history_id_seq TO anon, authenticated, service_role;

-- 4. Ensure global_settings table has withdrawal limit columns
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS min_withdraw_pgt NUMERIC DEFAULT 10;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS max_withdraw_pgt NUMERIC DEFAULT 100000;

-- 5. Set default settings row (id = 1)
INSERT INTO public.global_settings (id, min_withdraw_pgt, max_withdraw_pgt)
VALUES (1, 10, 100000)
ON CONFLICT (id) DO UPDATE SET 
  min_withdraw_pgt = COALESCE(global_settings.min_withdraw_pgt, 10),
  max_withdraw_pgt = COALESCE(global_settings.max_withdraw_pgt, 100000);
