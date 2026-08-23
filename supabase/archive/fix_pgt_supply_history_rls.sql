-- ============================================================
-- POLYGAME PGT SUPPLY HISTORY RLS & INSERT FIX SCRIPT
-- Grants INSERT policy on pgt_supply_history so supply snapshots can record hourly
-- ============================================================

-- 1. Enable RLS and add both SELECT and INSERT policies for pgt_supply_history
ALTER TABLE pgt_supply_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on pgt_supply_history" ON pgt_supply_history;
CREATE POLICY "Allow public read access on pgt_supply_history" 
  ON pgt_supply_history FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Allow public insert on pgt_supply_history" ON pgt_supply_history;
CREATE POLICY "Allow public insert on pgt_supply_history" 
  ON pgt_supply_history FOR INSERT 
  WITH CHECK (true);

-- 2. Optional SECURITY DEFINER RPC for robust snapshot logging
CREATE OR REPLACE FUNCTION record_supply_snapshot(p_created_at TIMESTAMPTZ, p_total_supply NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pgt_supply_history WHERE created_at >= p_created_at LIMIT 1
  ) THEN
    INSERT INTO pgt_supply_history (created_at, total_supply)
    VALUES (p_created_at, p_total_supply);
    RETURN jsonb_build_object('success', true, 'inserted', true);
  END IF;
  RETURN jsonb_build_object('success', true, 'inserted', false);
END;
$$;
GRANT EXECUTE ON FUNCTION record_supply_snapshot(TIMESTAMPTZ, NUMERIC) TO anon, authenticated, service_role;
