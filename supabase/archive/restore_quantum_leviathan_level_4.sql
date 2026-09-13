-- ==============================================================================
-- POLYGON GAMING: RESTORE QUANTUM LEVIATHAN LEVEL 4 & TOP BOSS HUNTERS
-- ==============================================================================
-- Purpose:
-- Restores the Cosmic World Boss (Quantum Leviathan) to Level 4 (16,875,000 HP,
-- 17,280 PGT Weekly Pool, SLAIN status: 0 HP), and restores all 11 commanders'
-- exact weekly damage records from the verified ledger backup.
-- ==============================================================================

BEGIN;

-- 1. Restore World Boss State in global_settings to Level 4 Slain (0 / 16,875,000 HP)
UPDATE public.global_settings
SET 
  boss_level = 4,
  boss_max_hp = 16875000,
  boss_current_hp = 0,
  game_payout_settings = jsonb_set(
    jsonb_set(
      COALESCE(game_payout_settings, '{}'::jsonb),
      '{boss,weekly_pool_pgt}',
      '17280'::jsonb
    ),
    '{boss,name}',
    '"👾 Cosmic World Boss (Quantum Leviathan) LVL 4"'::jsonb
  ),
  updated_at = NOW()
WHERE id = 1;

-- 2. Restore All 11 Top Boss Hunters' Weekly Damage in public.users
-- Rank 1: Jack S
UPDATE public.users
SET boss_weekly_damage = GREATEST(COALESCE(boss_weekly_damage, 0), 5095835), updated_at = NOW()
WHERE LOWER(player_id) = LOWER('0xpgtd6c88ba475c04696b0d78d2da526ae9800000');

-- Rank 2: Bass
UPDATE public.users
SET boss_weekly_damage = GREATEST(COALESCE(boss_weekly_damage, 0), 4145513), updated_at = NOW()
WHERE LOWER(player_id) = LOWER('0xpgt08891829df91813056bbd8d6e838cdc4');

-- Rank 3: troubs
UPDATE public.users
SET boss_weekly_damage = GREATEST(COALESCE(boss_weekly_damage, 0), 4092074), updated_at = NOW()
WHERE LOWER(player_id) = LOWER('0xpgt1315acc40000000000000000000000000000');

-- Rank 4: Poss
UPDATE public.users
SET boss_weekly_damage = GREATEST(COALESCE(boss_weekly_damage, 0), 3319258), updated_at = NOW()
WHERE LOWER(player_id) = LOWER('0xpgt8312e02d37185b5983e6922d1dae1cce');

-- Rank 5: Origin
UPDATE public.users
SET boss_weekly_damage = GREATEST(COALESCE(boss_weekly_damage, 0), 2683941), updated_at = NOW()
WHERE LOWER(player_id) = LOWER('0xpgt85c8416473bd6a8c45ada81ac85aeabb');

-- Rank 6: Vezuvius King
UPDATE public.users
SET boss_weekly_damage = GREATEST(COALESCE(boss_weekly_damage, 0), 2620328), updated_at = NOW()
WHERE LOWER(player_id) = LOWER('0xpgt1340d9e6');

-- Rank 7: Fly
UPDATE public.users
SET boss_weekly_damage = GREATEST(COALESCE(boss_weekly_damage, 0), 1988033), updated_at = NOW()
WHERE LOWER(player_id) = LOWER('0xpgt5e64957dabcde8ba47239a359f61b6f1');

-- Rank 8: MSD crypto
UPDATE public.users
SET boss_weekly_damage = GREATEST(COALESCE(boss_weekly_damage, 0), 1189939), updated_at = NOW()
WHERE LOWER(player_id) = LOWER('0xpgtf6a9a748636544a9a83d80cef9a8a40900000');

-- Rank 9: Fill
UPDATE public.users
SET boss_weekly_damage = GREATEST(COALESCE(boss_weekly_damage, 0), 170111), updated_at = NOW()
WHERE LOWER(player_id) = LOWER('0xg0761cd80ab9048fb97cc1b43a80e9f7b0000000');

-- Rank 10: patesz
UPDATE public.users
SET boss_weekly_damage = GREATEST(COALESCE(boss_weekly_damage, 0), 48268), updated_at = NOW()
WHERE LOWER(player_id) = LOWER('0xpgt33682426');

-- Rank 11: gincha
UPDATE public.users
SET boss_weekly_damage = GREATEST(COALESCE(boss_weekly_damage, 0), 33951), updated_at = NOW()
WHERE LOWER(player_id) = LOWER('0xguest53824305882bf4b7c0de643ce831fd07e68');

COMMIT;

NOTIFY pgrst, 'reload schema';
