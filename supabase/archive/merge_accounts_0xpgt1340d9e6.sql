-- ==============================================================================
-- POLYGAME: ATOMIC ACCOUNT MERGE & BACKUP RECORD
-- ==============================================================================
-- Target Primary Account (Google Auth):
--   player_id: 0xpgt1340d9e6
--   user_id: 1340d9e6-4ebf-4422-b115-e4da398857e5
--
-- Source Account (Standalone Wallet):
--   player_id: 0xpgt6671633e0000000000000000000000000000
--   linked_wallet_address: 0xfa437ab5ff649d3dffc687c05e4b3c145d0e836a
-- ==============================================================================

-- 1. Create a persistent DB backup table if not exists and archive both original rows
CREATE TABLE IF NOT EXISTS public.account_merge_backups (
    backup_id BIGSERIAL PRIMARY KEY,
    merged_at TIMESTAMPTZ DEFAULT NOW(),
    primary_player_id TEXT,
    source_player_id TEXT,
    primary_snapshot JSONB,
    source_snapshot JSONB
);

-- Insert exact snapshot before mutation
INSERT INTO public.account_merge_backups (
    primary_player_id,
    source_player_id,
    primary_snapshot,
    source_snapshot
)
SELECT 
    '0xpgt1340d9e6',
    '0xpgt6671633e0000000000000000000000000000',
    (SELECT row_to_json(u1)::jsonb FROM users u1 WHERE LOWER(player_id) = '0xpgt1340d9e6' OR user_id = '1340d9e6-4ebf-4422-b115-e4da398857e5'),
    (SELECT row_to_json(u2)::jsonb FROM users u2 WHERE LOWER(player_id) = '0xpgt6671633e0000000000000000000000000000' OR LOWER(linked_wallet_address) = '0xfa437ab5ff649d3dffc687c05e4b3c145d0e836a');

-- 2. Execute Atomic Merge into the Google Auth Row
UPDATE public.users
SET
    -- Link Web3 EVM Wallet permanently to Google Account
    linked_wallet_address = '0xfa437ab5ff649d3dffc687c05e4b3c145d0e836a',
    
    -- Sum Balances (2658.10 + 0.62449366 = 2658.72449366 PGT)
    balance_pgt = COALESCE(balance_pgt, 0) + 0.6244936616583362,
    
    -- Sum Claims & Activity
    total_claims = COALESCE(total_claims, 0) + 2,
    weekly_active_tier = GREATEST(COALESCE(weekly_active_tier, 0), 1),
    
    -- Preserve Highest Weekly Highscores across all 5 Games
    game_highscore = GREATEST(COALESCE(game_highscore, 0), 92200),
    invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), 54310),
    drift_highscore = GREATEST(COALESCE(drift_highscore, 0), 26855),
    stacker_highscore = GREATEST(COALESCE(stacker_highscore, 0), 0),
    skeet_highscore = GREATEST(COALESCE(skeet_highscore, 0), 16500),
    
    -- Preserve Highest All-Time Highscores across all 5 Games
    alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), 92200),
    alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), 59115),
    alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), 70391),
    alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), 0),
    alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), 16500),
    
    -- Merge NFTs & Equipment
    owned_nfts = '["nft_common_boost"]'::jsonb,
    equipped_nft = 'nft_common_boost',
    
    -- Merge PolySpace Fleet Command (Combine minerals + keep level 9 warp & active expeditions)
    space_state = jsonb_build_object(
        'warpLevel', 9,
        'fleetPower', 1080,
        'cargoLevel', 1,
        'laserLevel', 1,
        'shieldLevel', 1,
        'turretLevel', 1,
        'iron', 694, -- 84 + 610
        'titanium', 110, -- 110 + 0
        'quantum', 0,
        'pgtOre', 0,
        'raidsWon', 0,
        'pokesToday', 0,
        'lastOpDate', '2026-09-02',
        'lastPokeDate', '2026-09-02',
        'pgtMinedTotal', 39.71, -- 32.43 + 7.28
        'mineralsMinedTotal', 1755, -- 1155 + 600
        'lastAnomalyScanTime', 1788340324155,
        'expeditions', '[{"id":"exp_1788338761246_4ubb","name":"7-Day Deep-Space Odyssey","type":"odyssey","endTime":1788822601246,"startTime":1788338761246},{"id":"exp_1788338808866_kh5x","name":"3-Day Deep-Space Expedition","type":"deepspace","endTime":1788546168866,"startTime":1788338808866},{"id":"exp_1788338809898_v5fi","name":"3-Day Deep-Space Expedition","type":"deepspace","endTime":1788546169898,"startTime":1788338809898}]'::jsonb,
        'missionLogs', (SELECT space_state->'missionLogs' FROM users WHERE LOWER(player_id) = '0xpgt6671633e0000000000000000000000000000')
    ),
    
    updated_at = NOW()
WHERE user_id = '1340d9e6-4ebf-4422-b115-e4da398857e5' OR LOWER(player_id) = '0xpgt1340d9e6';

-- 3. Delete or decommission the standalone wallet row to prevent collision
DELETE FROM public.users
WHERE LOWER(player_id) = '0xpgt6671633e0000000000000000000000000000'
  AND (user_id IS NULL OR user_id <> '1340d9e6-4ebf-4422-b115-e4da398857e5');

-- 4. Verification Query: Confirm the merged account details
SELECT 
    player_id, 
    user_id, 
    linked_wallet_address, 
    balance_pgt, 
    game_highscore, 
    invaders_highscore, 
    drift_highscore, 
    skeet_highscore,
    alltime_drift_highscore,
    equipped_nft,
    space_state->'warpLevel' AS fleet_warp_level,
    space_state->'iron' AS iron_balance,
    space_state->'titanium' AS titanium_balance
FROM public.users 
WHERE user_id = '1340d9e6-4ebf-4422-b115-e4da398857e5' OR LOWER(player_id) = '0xpgt1340d9e6';
