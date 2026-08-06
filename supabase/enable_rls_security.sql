-- ============================================================
-- POLYGAME ROW LEVEL SECURITY (RLS) HARDENING SCRIPT
-- Enables RLS on UNRESTRICTED tables (global_settings, pgt_supply_history, user_stakes)
-- Prevents public anon client REST balance/setting tampering
-- ============================================================

-- 1. Hardening global_settings (Public SELECT, No Direct Public Write)
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access on global_settings" ON global_settings;
CREATE POLICY "Allow public read access on global_settings" 
  ON global_settings FOR SELECT 
  USING (true);

-- 2. Hardening pgt_supply_history (Public SELECT, No Direct Public Write)
ALTER TABLE pgt_supply_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access on pgt_supply_history" ON pgt_supply_history;
CREATE POLICY "Allow public read access on pgt_supply_history" 
  ON pgt_supply_history FOR SELECT 
  USING (true);

-- 3. Hardening user_stakes (Public SELECT, Mutations via SECURITY DEFINER RPCs only)
ALTER TABLE user_stakes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access on user_stakes" ON user_stakes;
CREATE POLICY "Allow public read access on user_stakes" 
  ON user_stakes FOR SELECT 
  USING (true);
