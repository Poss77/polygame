-- ====================================================================
-- POLYGAME: DEDICATED NFT SALES & TREASURY POL REVENUE TABLE
-- ====================================================================

CREATE TABLE IF NOT EXISTS nft_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_wallet TEXT NOT NULL,
  player_id TEXT,
  item_type TEXT NOT NULL, -- 'utility_nft', 'pol_crate', 'relic_mint', 'vip_pass'
  item_name TEXT NOT NULL,
  price_pol NUMERIC NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE nft_sales ENABLE ROW LEVEL SECURITY;

-- Allow public read and client insert
DROP POLICY IF EXISTS "Allow public read on nft_sales" ON nft_sales;
CREATE POLICY "Allow public read on nft_sales" ON nft_sales FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow anon insert on nft_sales" ON nft_sales;
CREATE POLICY "Allow anon insert on nft_sales" ON nft_sales FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated insert on nft_sales" ON nft_sales;
CREATE POLICY "Allow authenticated insert on nft_sales" ON nft_sales FOR INSERT WITH CHECK (true);

-- Index for fast time-series queries
CREATE INDEX IF NOT EXISTS idx_nft_sales_created_at ON nft_sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nft_sales_buyer ON nft_sales(buyer_wallet);

-- Atomic RPC Logger
CREATE OR REPLACE FUNCTION log_nft_sale(
  p_buyer_wallet TEXT,
  p_item_type TEXT,
  p_item_name TEXT,
  p_price_pol NUMERIC,
  p_tx_hash TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_buyer_wallet);
BEGIN
  IF p_price_pol IS NULL OR p_price_pol <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO nft_sales (
    buyer_wallet,
    player_id,
    item_type,
    item_name,
    price_pol,
    tx_hash,
    created_at
  ) VALUES (
    LOWER(p_buyer_wallet),
    v_pid,
    COALESCE(p_item_type, 'utility_nft'),
    COALESCE(p_item_name, 'Utility NFT'),
    p_price_pol,
    p_tx_hash,
    now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION log_nft_sale(TEXT, TEXT, TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;
