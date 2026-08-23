-- ============================================================
-- POLYGAME TEST NFT ADDITION SCRIPT
-- Adds test in-game NFTs ("nft_rare_shield" & "nft_pulse_blaster") to user 0x922...
-- ============================================================

UPDATE users
SET owned_nfts = CASE 
      WHEN owned_nfts IS NULL OR jsonb_array_length(owned_nfts) = 0 THEN '["nft_rare_shield", "nft_pulse_blaster"]'::jsonb
      WHEN NOT (owned_nfts @> '"nft_rare_shield"'::jsonb) THEN owned_nfts || '["nft_rare_shield", "nft_pulse_blaster"]'::jsonb
      ELSE owned_nfts
    END,
    updated_at = NOW()
WHERE LOWER(player_id) = '0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5'
   OR LOWER(COALESCE(linked_wallet_address, '')) = '0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5';
