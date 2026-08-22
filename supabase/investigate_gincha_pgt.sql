-- ====================================================================
-- INVESTIGATION QUERY: HOW DID GINCHA SPEND / LOSE PGT?
-- Run this in Supabase SQL Editor to inspect Gincha's full history.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. IDENTIFY GINCHA'S PROFILE, CURRENT BALANCE, STAKED & TOTAL STATS
-- --------------------------------------------------------------------
SELECT 
  player_id,
  username,
  linked_wallet_address,
  balance_pgt,
  total_earned,
  staked_pgt,
  created_at,
  updated_at,
  vip_until,
  is_vip,
  owned_nfts,
  relics
FROM users
WHERE LOWER(username) LIKE '%gincha%' 
   OR LOWER(player_id) LIKE '%gincha%'
   OR LOWER(COALESCE(linked_wallet_address, '')) LIKE '%gincha%';


-- --------------------------------------------------------------------
-- 2. CASINO & BETTING LOSSES / WAGERS (Crash, Spinner, Roshambo, Plinko)
-- --------------------------------------------------------------------
SELECT 
  created_at,
  game,
  wager,
  payout,
  multiplier,
  (payout - wager) AS net_profit_loss
FROM bet_wins
WHERE player_id IN (
  SELECT player_id FROM users 
  WHERE LOWER(username) LIKE '%gincha%' 
     OR LOWER(player_id) LIKE '%gincha%' 
     OR LOWER(COALESCE(linked_wallet_address, '')) LIKE '%gincha%'
)
ORDER BY created_at DESC
LIMIT 50;


-- --------------------------------------------------------------------
-- 3. ACTIVE & HISTORICAL STAKING POSITIONS (PGT Moved to Vault Staking)
-- --------------------------------------------------------------------
SELECT 
  id,
  player_id,
  amount_pgt,
  duration_days,
  apy_percent,
  created_at,
  matures_at,
  status
FROM user_stakes
WHERE player_id IN (
  SELECT player_id FROM users 
  WHERE LOWER(username) LIKE '%gincha%' 
     OR LOWER(player_id) LIKE '%gincha%' 
     OR LOWER(COALESCE(linked_wallet_address, '')) LIKE '%gincha%'
)
ORDER BY created_at DESC;


-- --------------------------------------------------------------------
-- 4. ON-CHAIN WITHDRAWALS (PGT Swept to Web3 Wallet)
-- --------------------------------------------------------------------
SELECT 
  id,
  player_id,
  wallet_address,
  amount_pgt,
  tx_hash,
  status,
  created_at
FROM withdrawals_history
WHERE player_id IN (
  SELECT player_id FROM users 
  WHERE LOWER(username) LIKE '%gincha%' 
     OR LOWER(player_id) LIKE '%gincha%' 
     OR LOWER(COALESCE(linked_wallet_address, '')) LIKE '%gincha%'
)
ORDER BY created_at DESC;


-- --------------------------------------------------------------------
-- 5. NFT & MARKETPLACE PURCHASES (PGT Spent on Utility NFTs)
-- --------------------------------------------------------------------
SELECT 
  id,
  buyer_address,
  nft_id,
  price_pgt,
  created_at
FROM nft_sales
WHERE LOWER(buyer_address) IN (
  SELECT LOWER(player_id) FROM users 
  WHERE LOWER(username) LIKE '%gincha%' 
     OR LOWER(player_id) LIKE '%gincha%' 
     OR LOWER(COALESCE(linked_wallet_address, '')) LIKE '%gincha%'
  UNION
  SELECT LOWER(COALESCE(linked_wallet_address, '')) FROM users 
  WHERE LOWER(username) LIKE '%gincha%' 
     OR LOWER(player_id) LIKE '%gincha%' 
     OR LOWER(COALESCE(linked_wallet_address, '')) LIKE '%gincha%'
)
ORDER BY created_at DESC;


-- --------------------------------------------------------------------
-- 6. ARCADE SESSIONS & EARNINGS (AstroDodge, Invaders, Drift, Stacker)
-- --------------------------------------------------------------------
SELECT 
  game_name,
  status,
  score,
  payout_pgt,
  duration_seconds,
  started_at,
  completed_at
FROM arcade_sessions
WHERE player_id IN (
  SELECT player_id FROM users 
  WHERE LOWER(username) LIKE '%gincha%' 
     OR LOWER(player_id) LIKE '%gincha%' 
     OR LOWER(COALESCE(linked_wallet_address, '')) LIKE '%gincha%'
)
ORDER BY started_at DESC
LIMIT 50;
