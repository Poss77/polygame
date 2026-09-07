-- ==============================================================================
-- POLYGAME: STRICT LOCKDOWN SHIELD FOR global_settings TABLE
-- Prevents players or anonymous visitors from modifying global settings.
-- Only Master Admin (via admin_update_global_settings RPC) or system RPCs can modify.
-- ==============================================================================

-- 1. Revoke direct write permissions from public REST API roles
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.global_settings FROM anon, authenticated;
GRANT SELECT ON TABLE public.global_settings TO anon, authenticated;

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Public (anon and authenticated) can only READ
DROP POLICY IF EXISTS "Allow public read-only on global_settings" ON public.global_settings;
CREATE POLICY "Allow public read-only on global_settings"
ON public.global_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- 4. Allow full access for service_role and postgres
DROP POLICY IF EXISTS "Allow service role full access on global_settings" ON public.global_settings;
CREATE POLICY "Allow service role full access on global_settings"
ON public.global_settings
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. Trigger Shield (Defense in Depth): Reject any direct mutation from anon/authenticated
CREATE OR REPLACE FUNCTION public.prevent_direct_global_settings_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF CURRENT_USER IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Unauthorized: Direct modifications to global_settings are prohibited';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_global_settings_mutation ON public.global_settings;
CREATE TRIGGER trg_prevent_direct_global_settings_mutation
BEFORE INSERT OR UPDATE OR DELETE ON public.global_settings
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_global_settings_mutation();

