-- ==============================================================================
-- POLYGAME: PRUNE OLD ARCADE SESSIONS RPC
-- ==============================================================================
-- Prunes completed, expired, and rejected sessions older than p_days (default: 7)
-- Preserves permanent user career stats and game metrics
-- ==============================================================================

DROP FUNCTION IF EXISTS prune_old_arcade_sessions(INTEGER);

CREATE OR REPLACE FUNCTION prune_old_arcade_sessions(p_days INTEGER DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_days INTEGER := GREATEST(1, COALESCE(p_days, 7));
  v_deleted_count INTEGER := 0;
BEGIN
  DELETE FROM arcade_sessions
  WHERE started_at < (NOW() - (v_days || ' days')::INTERVAL)
    AND status IN ('completed', 'expired', 'rejected');

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'purged_count', v_deleted_count,
    'days_threshold', v_days,
    'timestamp', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION prune_old_arcade_sessions(INTEGER) TO anon, authenticated, service_role;
