-- ====================================================================
-- POLYGAME: GUEST VISITOR ANALYTICS & METRICS
-- ====================================================================

-- Add guest_visitors column to global_settings table
ALTER TABLE global_settings ADD COLUMN IF NOT EXISTS guest_visitors BIGINT DEFAULT 0;

-- Create RPC to atomically increment unauthenticated guest visitor counter
CREATE OR REPLACE FUNCTION record_guest_visit()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count BIGINT;
BEGIN
  UPDATE global_settings 
  SET guest_visitors = COALESCE(guest_visitors, 0) + 1 
  WHERE id = 1
  RETURNING guest_visitors INTO v_count;

  IF v_count IS NULL THEN
    INSERT INTO global_settings (id, guest_visitors) VALUES (1, 1)
    ON CONFLICT (id) DO UPDATE SET guest_visitors = COALESCE(global_settings.guest_visitors, 0) + 1
    RETURNING guest_visitors INTO v_count;
  END IF;

  RETURN json_build_object('success', true, 'guest_visitors', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION record_guest_visit() TO anon, authenticated, service_role;
