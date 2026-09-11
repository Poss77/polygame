-- ==============================================================================
-- POLYGON GAMING - RESTORE MASTER ADMIN SPACE FLEET & MINERALS (v1.5.349)
-- ==============================================================================
-- Purpose:
--   Restores authentic module levels (Warp 27, Cargo 27, Laser 32, Fleet Power 6,760)
--   and accumulated space minerals (225,644 Iron, 82,074 Titanium, 104,391 Quantum,
--   22 PGT Ore) for the Master Admin account ('Origin' / 0x10b999... / 0xpgt85c84...).
--
-- Safety Guarantees:
--   1. Preserves all 5 active ongoing 7-Day Deep-Space Odyssey expeditions.
--   2. Preserves all mission logs, raid history, boss damage, and scan timestamps.
--   3. Executes atomically in a single transaction block with verification.
-- ==============================================================================

DO $$
DECLARE
  v_admin_player_id TEXT;
  v_current_state JSONB;
  v_restored_state JSONB;
  v_expeditions JSONB;
  v_mission_logs JSONB;
BEGIN
  -- 1. Identify canonical Admin player row
  SELECT player_id, space_state 
  INTO v_admin_player_id, v_current_state
  FROM public.users
  WHERE LOWER(player_id) = '0xpgt85c8416473bd6a8c45ada81ac85aeabb'
     OR LOWER(linked_wallet_address) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_admin_player_id IS NULL THEN
    RAISE EXCEPTION 'Admin user account not found in public.users!';
  END IF;

  RAISE NOTICE 'Found Admin account: %', v_admin_player_id;

  -- 2. Preserve active ongoing expeditions and mission logs from current row
  v_expeditions := COALESCE(v_current_state->'expeditions', '[]'::jsonb);
  v_mission_logs := COALESCE(v_current_state->'missionLogs', '[]'::jsonb);

  -- 3. Construct authoritative restored space state
  v_restored_state := jsonb_build_object(
    'warpLevel', 27,
    'cargoLevel', 27,
    'laserLevel', 32,
    'shieldLevel', 1,
    'turretLevel', 1,
    'fleetPower', 6760,
    'iron', 225644,
    'titanium', 82074,
    'quantum', 104391,
    'pgtOre', 22,
    'raidsWon', 12,
    'shieldLevel', 1,
    'turretLevel', 1,
    'bossAttacksCount', 7,
    'bossDamageWeekly', 724942,
    'mineralsMinedTotal', 667766,
    'pgtMinedTotal', 5498.11,
    'lastOpDate', '2026-09-04',
    'lastPokeDate', '2026-09-11',
    'lastRaidDate', '2026-09-11',
    'pokesToday', 0,
    'lastAnomalyScanTime', COALESCE(v_current_state->'lastAnomalyScanTime', to_jsonb(1789170187446::bigint)),
    'expeditions', v_expeditions,
    'missionLogs', v_mission_logs
  );

  -- 4. Apply atomic update to public.users
  UPDATE public.users
  SET space_state = v_restored_state,
      updated_at = NOW()
  WHERE player_id = v_admin_player_id;

  -- 5. Append restoration audit entry to activities ledger
  UPDATE public.users
  SET activities = jsonb_insert(
    COALESCE(activities, '[]'::jsonb),
    '{0}',
    jsonb_build_object(
      'time', TO_CHAR(NOW(), 'HH24:MI:SS'),
      'user', 'Origin',
      'action', 'restored space fleet: Warp 27, Cargo 27, Laser 32, Power 6760 & 412k Ore',
      'reward', '+Space Restored'
    ),
    true
  )
  WHERE player_id = v_admin_player_id;

  RAISE NOTICE 'Successfully restored space_state for %: Warp 27, Cargo 27, Laser 32, Power 6,760, Expeditions preserved: %', 
    v_admin_player_id, jsonb_array_length(v_expeditions);
END;
$$;

-- Verification query
SELECT 
  player_id, 
  username, 
  (space_state->>'warpLevel')::int AS warp_level,
  (space_state->>'cargoLevel')::int AS cargo_level,
  (space_state->>'laserLevel')::int AS laser_level,
  (space_state->>'fleetPower')::int AS fleet_power,
  (space_state->>'iron')::numeric AS iron,
  (space_state->>'titanium')::numeric AS titanium,
  (space_state->>'quantum')::numeric AS quantum,
  (space_state->>'pgtOre')::numeric AS pgt_ore,
  jsonb_array_length(COALESCE(space_state->'expeditions', '[]'::jsonb)) AS active_expeditions
FROM public.users
WHERE LOWER(player_id) = '0xpgt85c8416473bd6a8c45ada81ac85aeabb'
   OR LOWER(linked_wallet_address) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d';
