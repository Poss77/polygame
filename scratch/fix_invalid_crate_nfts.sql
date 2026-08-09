-- ============================================================
-- POLYGAME OBSOLETE CRATE NFT REMAP SCRIPT
-- Run this in Supabase SQL Editor to map any historical
-- 'nft_quantum_core' or 'nft_hyper_drive' unboxed items to valid NFTs!
-- ============================================================

-- 1. Replace nft_quantum_core -> nft_gold_turbine and nft_hyper_drive -> nft_pulse_blaster in owned_nfts
UPDATE users
SET owned_nfts = (
  SELECT COALESCE(
    jsonb_agg(
      CASE 
        WHEN elem = 'nft_quantum_core' THEN 'nft_gold_turbine'
        WHEN elem = 'nft_hyper_drive' THEN 'nft_pulse_blaster'
        ELSE elem
      END
    ), '[]'::jsonb
  )
  FROM jsonb_array_elements_text(owned_nfts) AS elem
)
WHERE owned_nfts @> '["nft_quantum_core"]'::jsonb 
   OR owned_nfts @> '["nft_hyper_drive"]'::jsonb;

-- 2. Replace nft_quantum_core -> nft_gold_turbine and nft_hyper_drive -> nft_pulse_blaster in crate_nfts
UPDATE users
SET crate_nfts = (
  SELECT COALESCE(
    jsonb_agg(
      CASE 
        WHEN elem = 'nft_quantum_core' THEN 'nft_gold_turbine'
        WHEN elem = 'nft_hyper_drive' THEN 'nft_pulse_blaster'
        ELSE elem
      END
    ), '[]'::jsonb
  )
  FROM jsonb_array_elements_text(crate_nfts) AS elem
)
WHERE crate_nfts @> '["nft_quantum_core"]'::jsonb 
   OR crate_nfts @> '["nft_hyper_drive"]'::jsonb;

-- 3. Replace equipped_nft if it was set to an obsolete ID
UPDATE users
SET equipped_nft = 'nft_gold_turbine'
WHERE equipped_nft = 'nft_quantum_core';

UPDATE users
SET equipped_nft = 'nft_pulse_blaster'
WHERE equipped_nft = 'nft_hyper_drive';
