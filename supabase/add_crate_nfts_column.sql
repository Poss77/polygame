-- ============================================================
-- POLYGAME DB MIGRATION: ADD CRATE_NFTS COLUMN TO USERS TABLE
-- Adds missing crate_nfts column so mystery crate NFT drops are logged
-- ============================================================

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS crate_nfts JSONB DEFAULT '[]'::jsonb;
