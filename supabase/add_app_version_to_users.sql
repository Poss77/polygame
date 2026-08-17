-- ==============================================================================
-- POLYGAME: ADD APP_VERSION TRACKING TO USERS TABLE
-- ==============================================================================

-- 1. Add app_version column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS app_version TEXT DEFAULT 'v1.5.015';

-- 2. Index for filtering and sorting players by version in Admin Dashboard
CREATE INDEX IF NOT EXISTS idx_users_app_version ON public.users (app_version);
