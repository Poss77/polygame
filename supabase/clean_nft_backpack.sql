-- ==============================================================================
-- POLYGAME SCRIPT: INSPECT & CLEAN NFT BACKPACK FOR USER (0x47... / Fill)
-- ==============================================================================
-- Purpose:
-- 1. Inspects the currently stored `owned_nfts` array in `users` table for 0x47...
-- 2. Optionally clears `owned_nfts` so that the on-chain Polygon scanner repopulates
--    strictly what is held on the blockchain.
-- ==============================================================================

-- 1. Inspect current stored NFTs
SELECT 
  player_id, 
  linked_wallet_address, 
  username, 
  email, 
  owned_nfts, 
  crate_nfts, 
  equipped_nft
FROM users
WHERE 
  LOWER(COALESCE(linked_wallet_address, '')) LIKE '0x47%'
  OR LOWER(COALESCE(player_id, '')) LIKE '0x47%'
  OR LOWER(COALESCE(username, '')) ILIKE 'fill%'
  OR LOWER(COALESCE(username, '')) ILIKE 'phil%';

-- 2. Clear corrupted / accumulated `owned_nfts` for 0x47...
-- (When you connect your wallet, PolyGame will now scan the Polygon blockchain
-- and save ONLY the real on-chain NFTs you actually own).
UPDATE users
SET 
  owned_nfts = '[]'::jsonb,
  equipped_nft = NULL,
  updated_at = NOW()
WHERE 
  LOWER(COALESCE(linked_wallet_address, '')) LIKE '0x47%'
  OR LOWER(COALESCE(player_id, '')) LIKE '0x47%'
  OR LOWER(COALESCE(username, '')) ILIKE 'fill%'
  OR LOWER(COALESCE(username, '')) ILIKE 'phil%';

-- 3. Verification Query
SELECT 
  player_id, 
  linked_wallet_address, 
  username, 
  owned_nfts, 
  crate_nfts
FROM users
WHERE 
  LOWER(COALESCE(linked_wallet_address, '')) LIKE '0x47%'
  OR LOWER(COALESCE(player_id, '')) LIKE '0x47%'
  OR LOWER(COALESCE(username, '')) ILIKE 'fill%'
  OR LOWER(COALESCE(username, '')) ILIKE 'phil%';
