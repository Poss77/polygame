-- ============================================================
-- POLYSPACE ACCOUNT BUILDING RESET SCRIPT
-- Run this in Supabase SQL Editor to reset the Master Admin wallet
-- (or any target wallet) back to Level 1 default PolySpace buildings!
-- ============================================================

UPDATE users
SET space_state = '{
  "warpLevel": 1,
  "laserLevel": 1,
  "cargoLevel": 1,
  "shieldLevel": 1,
  "turretLevel": 1,
  "fleetPower": 100,
  "iron": 50,
  "titanium": 10,
  "quantum": 0,
  "pgtOre": 0,
  "expeditions": [],
  "missionLogs": [],
  "pokesToday": 0,
  "lastPokeDate": null,
  "lastOpDate": null,
  "raidsWon": 0,
  "mineralsMinedTotal": 0
}'::jsonb
WHERE LOWER(player_id) = LOWER('0x10B9993990c9EF8a212c9557cB02aD94da9a654d')
   OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER('0x10B9993990c9EF8a212c9557cB02aD94da9a654d');
