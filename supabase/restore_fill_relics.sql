-- ==============================================================================
-- RESTORE FILL'S QUANTUM RELICS (Mythic Singularity Core & Harmonic Keystone)
-- ==============================================================================
-- Context: Fill (pascaldufour@gmail.com / 0xg0761cd80ab9048fb97cc1b43a80e9f7b0000000)
-- had 1x Mythic Quantum Singularity Core and 1x Epic Harmonic Keystone
-- which were wiped during a Google sign-in before the v1.5.162 multi-device fix.
-- ==============================================================================

UPDATE public.users
SET 
  relics = '{
    "relic_apex_singularity": {
      "total": 1,
      "onchain": 0,
      "unminted": 1,
      "token_ids": []
    },
    "relic_stacker_keystone": {
      "total": 1,
      "onchain": 0,
      "unminted": 1,
      "token_ids": []
    }
  }'::jsonb,
  updated_at = NOW()
WHERE 
  player_id = '0xg0761cd80ab9048fb97cc1b43a80e9f7b0000000'
  OR user_id = '0761cd80-ab90-48fb-97cc-1b43a80e9f7b'
  OR email = 'pascaldufour@gmail.com';

-- Verification Query
SELECT player_id, username, email, linked_wallet_address, relics, updated_at
FROM public.users
WHERE email = 'pascaldufour@gmail.com' OR username = 'Fill';
