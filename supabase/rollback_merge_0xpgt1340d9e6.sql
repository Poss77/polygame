-- ==============================================================================
-- POLYGAME: ROLLBACK SCRIPT FOR 0xpgt1340d9e6 & 0xpgt6671633e... MERGE
-- ==============================================================================
-- Run this script ONLY if you need to restore both accounts to their exact 
-- state prior to the merge.
-- ==============================================================================

-- 1. Restore Google Account (0xpgt1340d9e6) to original state
UPDATE public.users
SET
    linked_wallet_address = NULL,
    balance_pgt = 2658.10,
    total_claims = 1,
    weekly_active_tier = 1,
    game_highscore = 300,
    invaders_highscore = 0,
    drift_highscore = 0,
    stacker_highscore = 0,
    skeet_highscore = 0,
    alltime_game_highscore = 70725,
    alltime_invaders_highscore = 0,
    alltime_drift_highscore = 0,
    alltime_stacker_highscore = 0,
    alltime_skeet_highscore = 0,
    owned_nfts = '["nft_common_boost"]'::jsonb,
    equipped_nft = NULL,
    space_state = '{"iron": 610, "pgtOre": 0, "quantum": 0, "raidsWon": 0, "titanium": 0, "warpLevel": 2, "cargoLevel": 1, "fleetPower": 480, "laserLevel": 1, "lastOpDate": null, "pokesToday": 0, "shieldLevel": 1, "turretLevel": 1, "lastPokeDate": null, "pgtMinedTotal": 7.28, "mineralsMinedTotal": 600, "expeditions": [{"id": "exp_1788101125501_hkqx", "name": "Neon Nebula", "type": "nebula", "endTime": 1788107982644, "startTime": 1788101125501}, {"id": "exp_1788101126886_vtce", "name": "Neon Nebula", "type": "nebula", "endTime": 1788107984029, "startTime": 1788101126886}, {"id": "exp_1788101127765_26cy", "name": "Neon Nebula", "type": "nebula", "endTime": 1788107984908, "startTime": 1788101127765}]}'::jsonb,
    updated_at = NOW()
WHERE user_id = '1340d9e6-4ebf-4422-b115-e4da398857e5' OR LOWER(player_id) = '0xpgt1340d9e6';

-- 2. Re-insert original Standalone Wallet Account (0xpgt6671633e...)
INSERT INTO public.users (
    player_id,
    user_id,
    linked_wallet_address,
    balance_pgt,
    total_claims,
    weekly_active_tier,
    game_highscore,
    invaders_highscore,
    drift_highscore,
    stacker_highscore,
    skeet_highscore,
    alltime_game_highscore,
    alltime_invaders_highscore,
    alltime_drift_highscore,
    alltime_stacker_highscore,
    alltime_skeet_highscore,
    owned_nfts,
    equipped_nft,
    space_state,
    created_at,
    updated_at
) VALUES (
    '0xpgt6671633e0000000000000000000000000000',
    NULL,
    '0xfa437ab5ff649d3dffc687c05e4b3c145d0e836a',
    0.6244936616583362,
    2,
    1,
    92200,
    54310,
    26855,
    0,
    16500,
    92200,
    59115,
    70391,
    0,
    16500,
    '["nft_common_boost"]'::jsonb,
    'nft_common_boost',
    '{"iron": 84, "pgtOre": 0, "quantum": 0, "raidsWon": 0, "titanium": 110, "warpLevel": 9, "cargoLevel": 1, "fleetPower": 1080, "laserLevel": 1, "lastOpDate": "2026-09-02", "pokesToday": 0, "shieldLevel": 1, "turretLevel": 1, "lastPokeDate": "2026-09-02", "pgtMinedTotal": 32.43, "mineralsMinedTotal": 1155, "lastAnomalyScanTime": 1788340324155, "expeditions": [{"id": "exp_1788338761246_4ubb", "name": "7-Day Deep-Space Odyssey", "type": "odyssey", "endTime": 1788822601246, "startTime": 1788338761246}, {"id": "exp_1788338808866_kh5x", "name": "3-Day Deep-Space Expedition", "type": "deepspace", "endTime": 1788546168866, "startTime": 1788338808866}, {"id": "exp_1788338809898_v5fi", "name": "3-Day Deep-Space Expedition", "type": "deepspace", "endTime": 1788546169898, "startTime": 1788338809898}]}'::jsonb,
    '2026-08-04T07:10:33.858582+00:00',
    NOW()
) ON CONFLICT (player_id) DO UPDATE 
SET linked_wallet_address = EXCLUDED.linked_wallet_address,
    balance_pgt = EXCLUDED.balance_pgt,
    space_state = EXCLUDED.space_state;
