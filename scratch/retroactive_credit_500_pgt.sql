-- Retroactive Credit Script for On-Chain Deposit (500 PGT)
-- Run this in your Supabase SQL Editor to immediately credit your wallet with the 500 PGT!

UPDATE users
SET balance_pgt = balance_pgt + 500,
    updated_at = NOW()
WHERE LOWER(wallet_address) LIKE '0x92206284%' 
   OR LOWER(linked_wallet_address) LIKE '0x92206284%';
