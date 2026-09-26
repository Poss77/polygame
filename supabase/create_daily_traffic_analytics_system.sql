-- ==============================================================================
-- POLYGON GAMING: NATIVE DAILY TRAFFIC & GUEST ANALYTICS SYSTEM
-- ==============================================================================
-- Description:
--   Tracks daily unique guest visitors, registered players, pageviews, and
--   guest gaming activity without third-party cookies or intrusive ad-trackers.
-- ==============================================================================

-- 1. Aggregated Daily Traffic Metrics Table
CREATE TABLE IF NOT EXISTS public.daily_traffic_stats (
  stat_date DATE PRIMARY KEY,
  total_pageviews BIGINT NOT NULL DEFAULT 0,
  unique_guests INT NOT NULL DEFAULT 0,
  unique_registered INT NOT NULL DEFAULT 0,
  guest_game_plays INT NOT NULL DEFAULT 0,
  referrer_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  device_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Daily Uniqueness Ping Ledger (1 row per visitor per day)
CREATE TABLE IF NOT EXISTS public.daily_visitor_pings (
  id BIGSERIAL PRIMARY KEY,
  visit_date DATE NOT NULL,
  visitor_id TEXT NOT NULL,
  is_guest BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_daily_visitor UNIQUE (visit_date, visitor_id)
);
CREATE INDEX IF NOT EXISTS idx_daily_visitor_pings_date_id ON public.daily_visitor_pings (visit_date, visitor_id);

-- 3. RLS Configuration
ALTER TABLE public.daily_traffic_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_visitor_pings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read daily_traffic_stats" ON public.daily_traffic_stats;
CREATE POLICY "Allow public read daily_traffic_stats"
  ON public.daily_traffic_stats
  FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

-- 4. RPC: record_daily_visit
DROP FUNCTION IF EXISTS public.record_daily_visit(TEXT, BOOLEAN, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.record_daily_visit(
  p_visitor_id TEXT,
  p_is_guest BOOLEAN DEFAULT TRUE,
  p_referrer TEXT DEFAULT NULL,
  p_device TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::DATE;
  v_clean_id TEXT;
  v_clean_ref TEXT;
  v_clean_dev TEXT;
  v_current_ref JSONB;
  v_current_dev JSONB;
  v_ref_count INT;
  v_dev_count INT;
  v_pageviews BIGINT;
  v_guests INT;
  v_registered INT;
BEGIN
  -- Basic sanity check on visitor_id
  IF p_visitor_id IS NULL OR TRIM(p_visitor_id) = '' THEN
    v_clean_id := 'anon_' || floor(random() * 1000000)::text;
  ELSE
    v_clean_id := LOWER(SUBSTRING(TRIM(p_visitor_id), 1, 64));
  END IF;

  -- Clean referrer & device
  v_clean_ref := LOWER(SUBSTRING(COALESCE(NULLIF(TRIM(p_referrer), ''), 'direct'), 1, 64));
  IF v_clean_ref LIKE 'http%' THEN
    v_clean_ref := REGEXP_REPLACE(v_clean_ref, '^https?://([^/]+).*$', '\1');
  END IF;

  v_clean_dev := LOWER(SUBSTRING(COALESCE(NULLIF(TRIM(p_device), ''), 'desktop'), 1, 32));
  IF v_clean_dev NOT IN ('mobile', 'tablet', 'desktop') THEN
    v_clean_dev := 'desktop';
  END IF;

  -- 1. Ensure daily row exists & increment pageviews
  INSERT INTO public.daily_traffic_stats (
    stat_date, total_pageviews, unique_guests, unique_registered, referrer_breakdown, device_breakdown
  )
  VALUES (
    v_today, 1, 0, 0,
    jsonb_build_object(v_clean_ref, 1),
    jsonb_build_object(v_clean_dev, 1)
  )
  ON CONFLICT (stat_date) DO UPDATE
  SET total_pageviews = public.daily_traffic_stats.total_pageviews + 1,
      updated_at = NOW();

  -- 2. Check and record uniqueness in daily_visitor_pings
  INSERT INTO public.daily_visitor_pings (visit_date, visitor_id, is_guest)
  VALUES (v_today, v_clean_id, p_is_guest)
  ON CONFLICT (visit_date, visitor_id) DO NOTHING;

  -- If this was a fresh visitor today (INSERT succeeded)
  IF FOUND THEN
    IF p_is_guest THEN
      UPDATE public.daily_traffic_stats
      SET unique_guests = unique_guests + 1
      WHERE stat_date = v_today;
    ELSE
      UPDATE public.daily_traffic_stats
      SET unique_registered = unique_registered + 1
      WHERE stat_date = v_today;
    END IF;

    -- Update referrer & device breakdowns
    SELECT referrer_breakdown, device_breakdown INTO v_current_ref, v_current_dev
    FROM public.daily_traffic_stats WHERE stat_date = v_today;

    v_ref_count := COALESCE((v_current_ref->>v_clean_ref)::INT, 0) + 1;
    v_dev_count := COALESCE((v_current_dev->>v_clean_dev)::INT, 0) + 1;

    UPDATE public.daily_traffic_stats
    SET referrer_breakdown = jsonb_set(COALESCE(v_current_ref, '{}'::jsonb), ARRAY[v_clean_ref], to_jsonb(v_ref_count)),
        device_breakdown = jsonb_set(COALESCE(v_current_dev, '{}'::jsonb), ARRAY[v_clean_dev], to_jsonb(v_dev_count)),
        updated_at = NOW()
    WHERE stat_date = v_today;
  END IF;

  -- Return current numbers for immediate display
  SELECT total_pageviews, unique_guests, unique_registered
  INTO v_pageviews, v_guests, v_registered
  FROM public.daily_traffic_stats WHERE stat_date = v_today;

  RETURN jsonb_build_object(
    'success', true,
    'date', v_today,
    'pageviews', v_pageviews,
    'unique_guests', v_guests,
    'unique_registered', v_registered
  );
END;
$$;

-- 5. RPC: record_guest_game_play
DROP FUNCTION IF EXISTS public.record_guest_game_play();
CREATE OR REPLACE FUNCTION public.record_guest_game_play()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_today DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::DATE;
BEGIN
  INSERT INTO public.daily_traffic_stats (stat_date, guest_game_plays)
  VALUES (v_today, 1)
  ON CONFLICT (stat_date) DO UPDATE
  SET guest_game_plays = public.daily_traffic_stats.guest_game_plays + 1,
      updated_at = NOW();
END;
$$;

-- 6. RPC: get_traffic_analytics
DROP FUNCTION IF EXISTS public.get_traffic_analytics(INT);
CREATE OR REPLACE FUNCTION public.get_traffic_analytics(p_days INT DEFAULT 14)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_limit INT := LEAST(GREATEST(COALESCE(p_days, 14), 1), 90);
  v_days JSONB;
  v_summary JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', stat_date,
      'pageviews', total_pageviews,
      'unique_guests', unique_guests,
      'unique_registered', unique_registered,
      'guest_game_plays', guest_game_plays,
      'referrers', referrer_breakdown,
      'devices', device_breakdown
    ) ORDER BY stat_date DESC
  ) INTO v_days
  FROM (
    SELECT * FROM public.daily_traffic_stats
    ORDER BY stat_date DESC
    LIMIT v_limit
  ) s;

  SELECT jsonb_build_object(
    'total_days', COUNT(*),
    'sum_pageviews', COALESCE(SUM(total_pageviews), 0),
    'sum_unique_guests', COALESCE(SUM(unique_guests), 0),
    'sum_unique_registered', COALESCE(SUM(unique_registered), 0),
    'sum_guest_plays', COALESCE(SUM(guest_game_plays), 0)
  ) INTO v_summary
  FROM (
    SELECT * FROM public.daily_traffic_stats
    ORDER BY stat_date DESC
    LIMIT v_limit
  ) s;

  RETURN jsonb_build_object(
    'success', true,
    'summary', COALESCE(v_summary, '{}'::jsonb),
    'history', COALESCE(v_days, '[]'::jsonb)
  );
END;
$$;

-- 7. Permissions
GRANT EXECUTE ON FUNCTION public.record_daily_visit(TEXT, BOOLEAN, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_guest_game_play() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_traffic_analytics(INT) TO anon, authenticated, service_role;
