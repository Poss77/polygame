-- ==============================================================================
-- ADD CHRONO COMPASS RELIC TO A PLAYER
-- ==============================================================================
-- Relic ID: relic_astrododge_compass (Legendary AstroDodge Relic)
-- ==============================================================================

-- METHOD 1: Using the built-in grant_relic_drop RPC (Recommended)
-- You can pass player_id, email, or linked EVM wallet address:
SELECT public.grant_relic_drop(
    'TARGET_PLAYER_ID_OR_EMAIL_OR_WALLET', -- e.g. 'pascaldufour@gmail.com' or '0xpgt...'
    'relic_astrododge_compass', 
    1 -- quantity to add
);

-- ==============================================================================
-- METHOD 2: Direct SQL JSONB Update (Alternative)
-- ==============================================================================
/*
UPDATE public.users
SET 
  relics = jsonb_set(
    COALESCE(relics, '{}'::jsonb),
    '{relic_astrododge_compass}',
    jsonb_build_object(
      'total', COALESCE((relics->'relic_astrododge_compass'->>'total')::int, 0) + 1,
      'unminted', COALESCE((relics->'relic_astrododge_compass'->>'unminted')::int, 0) + 1,
      'onchain', COALESCE((relics->'relic_astrododge_compass'->>'onchain')::int, 0),
      'token_ids', COALESCE(relics->'relic_astrododge_compass'->'token_ids', '[]'::jsonb)
    ),
    true
  ),
  updated_at = NOW()
WHERE 
  email = 'TARGET_EMAIL' 
  OR player_id = 'TARGET_PLAYER_ID';
*/
