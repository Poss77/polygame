-- ============================================================
-- POLYGAME: Add arcade_last_reset column to global_settings
-- Tracks the timestamp of the last Arcade Games (Earn) metrics reset
-- ============================================================

-- Add arcade_last_reset column
ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS arcade_last_reset TIMESTAMPTZ DEFAULT NULL;

-- Function to safely reset all arcade game metrics in one atomic transaction
CREATE OR REPLACE FUNCTION reset_arcade_game_metrics()
RETURNS VOID AS $$
BEGIN
  UPDATE game_metrics
  SET total_wagered = 0,
      total_payout = 0,
      total_playtime_seconds = 0,
      updated_at = NOW()
  WHERE game_name IN ('AstroDodge', 'Cyber Invaders', 'Cyber Drift');

  UPDATE global_settings
  SET arcade_last_reset = NOW()
  WHERE id = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to service_role and anon
GRANT EXECUTE ON FUNCTION reset_arcade_game_metrics() TO anon, authenticated, service_role;
