-- ============================================================
-- POLYGAME TEST CRATE NFT ADDITION SCRIPT
-- Adds a test crate NFT drop ("nft_gold_turbine") to crate_nfts column for 0x922...
-- ============================================================

UPDATE users
SET crate_nfts = CASE 
      WHEN crate_nfts IS NULL OR jsonb_array_length(crate_nfts) = 0 THEN '["nft_gold_turbine"]'::jsonb
      WHEN NOT (crate_nfts @> '"nft_gold_turbine"'::jsonb) THEN crate_nfts || '["nft_gold_turbine"]'::jsonb
      ELSE crate_nfts
    END,
    updated_at = NOW()
WHERE LOWER(player_id) = '0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5'
   OR LOWER(COALESCE(linked_wallet_address, '')) = '0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5';
