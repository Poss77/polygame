-- ==============================================================================
-- POLYGON GAMING: ADD CYBER DEFENSE TO ADMIN ARCADE METRICS
-- ==============================================================================

-- 1. Ensure Cyber Defense row exists in public.game_metrics table
INSERT INTO public.game_metrics (game_name, total_wagered, total_payout, total_playtime_seconds)
VALUES ('Cyber Defense', 0, 0, 0)
ON CONFLICT (game_name) DO NOTHING;

-- 2. Update reset_arcade_game_metrics() RPC to include Cyber Defense
CREATE OR REPLACE FUNCTION public.reset_arcade_game_metrics()
RETURNS VOID AS $$
BEGIN
  UPDATE public.game_metrics
  SET total_wagered = 0,
      total_payout = 0,
      total_playtime_seconds = 0
  WHERE game_name IN (
    'AstroDodge', 
    'Cyber Invaders', 
    'Cyber Drift', 
    'Cyber Stacker', 
    'Cyber Catcher', 
    'Cyber Skeet', 
    'Cyber Defense'
  );

  UPDATE public.global_settings
  SET arcade_last_reset = NOW()
  WHERE id = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.reset_arcade_game_metrics() TO anon, authenticated, service_role;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
