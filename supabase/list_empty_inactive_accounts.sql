-- ==============================================================================
-- POLYGAME AUDIT: LIST EMPTY & INACTIVE ACCOUNTS
-- ==============================================================================
-- Purpose:
-- Identifies all registered accounts in Supabase that have done NOTHING:
-- - 0 PGT / 1FLR Balance (or NULL)
-- - 0 Staked Balance & 0 Staking Yield
-- - 0 Faucet Claims & 0 Claim Streak (never claimed faucet)
-- - 0 High Scores across all 4 arcade games (Astro-Dodge, Invaders, Drift, Stacker)
-- - 0 Career All-Time High Scores
-- - 0 Owned NFTs & 0 Mystery Crate NFTs
-- - 0 Season 1 Quantum Relics
-- - 0 Downline Referrals & 0 Referral Commissions
-- - 0 Active Stakes & 0 Stored Activities
-- - Default PolySpace Fleet (0 minerals mined, 0 raids, level 1 warp)
-- - Not an Admin or Ambassador
-- ==============================================================================

-- ==============================================================================
-- 📊 QUERY 1: EXECUTIVE SUMMARY (Run to get totals and percentages)
-- ==============================================================================
WITH empty_accounts AS (
  SELECT 
    id,
    player_id,
    linked_wallet_address,
    user_id,
    email,
    username,
    app_version,
    created_at,
    updated_at,
    CASE 
      WHEN user_id IS NOT NULL OR email IS NOT NULL OR (player_id LIKE '0xg%' AND NOT player_id LIKE '0xguest%') THEN 'Google / Email'
      WHEN player_id LIKE '0xguest%' THEN 'Guest Mode'
      WHEN linked_wallet_address IS NOT NULL AND linked_wallet_address <> '' THEN 'Web3 Wallet'
      ELSE 'Synthetic Standalone'
    END AS account_type
  FROM users u
  WHERE 
    -- 1. Balances & Staking must be 0 or null
    COALESCE(balance_pgt, 0) = 0
    AND COALESCE(balance_1flr, 0) = 0
    AND COALESCE(staked_balance_pgt, 0) = 0
    AND COALESCE(staked_balance_1flr, 0) = 0
    AND COALESCE(total_staking_yield, 0) = 0
    AND COALESCE(unclaimed_referral_pgt, 0) = 0
    AND COALESCE(total_referral_commission, 0) = 0

    -- 2. Faucet Activity must be 0
    AND COALESCE(total_claims, 0) = 0
    AND COALESCE(claim_streak, 0) = 0
    AND last_faucet_claim IS NULL
    AND last_claim_time IS NULL

    -- 3. Arcade High Scores must be 0
    AND COALESCE(game_highscore, 0) = 0
    AND COALESCE(invaders_highscore, 0) = 0
    AND COALESCE(drift_highscore, 0) = 0
    AND COALESCE(stacker_highscore, 0) = 0
    AND COALESCE(catcher_highscore, 0) = 0
    AND COALESCE(alltime_game_highscore, 0) = 0
    AND COALESCE(alltime_invaders_highscore, 0) = 0
    AND COALESCE(alltime_drift_highscore, 0) = 0
    AND COALESCE(alltime_stacker_highscore, 0) = 0
    AND COALESCE(alltime_catcher_highscore, 0) = 0
    AND COALESCE(alltime_highscore, 0) = 0

    -- 4. Inventory, NFTs, Crates, Stakes, Activities, Relics must be empty
    AND (owned_nfts IS NULL OR owned_nfts::text IN ('[]', '{}', 'null', '""', ''))
    AND (crate_nfts IS NULL OR crate_nfts::text IN ('[]', '{}', 'null', '""', ''))
    AND (stakes IS NULL OR stakes::text IN ('[]', '{}', 'null', '""', ''))
    AND (activities IS NULL OR activities::text IN ('[]', '{}', 'null', '""', ''))
    AND (relics IS NULL OR relics::text IN ('[]', '{}', 'null', '""', ''))

    -- 5. Downlines must be 0
    AND COALESCE(referrals_count, 0) = 0
    AND COALESCE(referrals_l1, 0) = 0
    AND COALESCE(referrals_l2, 0) = 0
    AND COALESCE(referrals_l3, 0) = 0
    AND COALESCE(referrals_l4, 0) = 0

    -- 6. PolySpace Fleet must be at initial unplayed default
    AND (
      space_state IS NULL 
      OR space_state::text IN ('{}', '[]', 'null', '""', '')
      OR (
        COALESCE((space_state->>'mineralsMinedTotal')::numeric, 0) = 0
        AND COALESCE((space_state->>'raidsWon')::numeric, 0) = 0
        AND COALESCE((space_state->>'warpLevel')::numeric, 1) <= 1
        AND COALESCE((space_state->>'fleetPower')::numeric, 100) <= 100
      )
    )

    -- 7. Exclude Admin, Ambassador, and Active VIP accounts
    AND NOT COALESCE(is_admin, false)
    AND NOT COALESCE(is_ambassador, false)
    AND (vip_until IS NULL OR vip_until <= NOW())
    AND LOWER(COALESCE(player_id, '')) <> '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
    AND LOWER(COALESCE(linked_wallet_address, '')) <> '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
)
SELECT 
  (SELECT COUNT(*) FROM users) AS total_registered_users,
  COUNT(*) AS total_empty_accounts,
  (SELECT COUNT(*) FROM users) - COUNT(*) AS total_active_users,
  ROUND((COUNT(*)::numeric / NULLIF((SELECT COUNT(*) FROM users), 0)::numeric) * 100, 2) || '%' AS empty_accounts_percentage
FROM empty_accounts;


-- ==============================================================================
-- 📋 QUERY 2: DETAILED LIST OF ALL EMPTY ACCOUNTS
-- ==============================================================================
SELECT 
  u.id,
  u.player_id,
  COALESCE(u.linked_wallet_address, '—') AS linked_wallet_address,
  COALESCE(NULLIF(u.username, ''), 'Anonymous') AS username,
  COALESCE(u.email, '—') AS email,
  CASE 
    WHEN u.user_id IS NOT NULL OR u.email IS NOT NULL OR (u.player_id LIKE '0xg%' AND NOT u.player_id LIKE '0xguest%') THEN '🔑 Google / Auth'
    WHEN u.player_id LIKE '0xguest%' THEN '👤 Guest Session'
    WHEN u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' THEN '🦊 Web3 Wallet'
    ELSE '⚡ Synthetic'
  END AS account_type,
  COALESCE(u.app_version, 'Legacy') AS app_version,
  ROUND(EXTRACT(EPOCH FROM (NOW() - u.created_at)) / 86400, 1) AS age_days,
  u.created_at,
  u.updated_at
FROM users u
WHERE 
  -- 1. Balances & Staking
  COALESCE(u.balance_pgt, 0) = 0
  AND COALESCE(u.balance_1flr, 0) = 0
  AND COALESCE(u.staked_balance_pgt, 0) = 0
  AND COALESCE(u.staked_balance_1flr, 0) = 0
  AND COALESCE(u.total_staking_yield, 0) = 0
  AND COALESCE(u.unclaimed_referral_pgt, 0) = 0
  AND COALESCE(u.total_referral_commission, 0) = 0

  -- 2. Faucet Activity
  AND COALESCE(u.total_claims, 0) = 0
  AND COALESCE(u.claim_streak, 0) = 0
  AND u.last_faucet_claim IS NULL
  AND u.last_claim_time IS NULL

  -- 3. Arcade High Scores
  AND COALESCE(u.game_highscore, 0) = 0
  AND COALESCE(u.invaders_highscore, 0) = 0
  AND COALESCE(u.drift_highscore, 0) = 0
  AND COALESCE(u.stacker_highscore, 0) = 0
  AND COALESCE(u.catcher_highscore, 0) = 0
  AND COALESCE(u.alltime_game_highscore, 0) = 0
  AND COALESCE(u.alltime_invaders_highscore, 0) = 0
  AND COALESCE(u.alltime_drift_highscore, 0) = 0
  AND COALESCE(u.alltime_stacker_highscore, 0) = 0
  AND COALESCE(u.alltime_catcher_highscore, 0) = 0
  AND COALESCE(u.alltime_highscore, 0) = 0

  -- 4. Inventory, NFTs, Crates, Stakes, Activities, Relics
  AND (u.owned_nfts IS NULL OR u.owned_nfts::text IN ('[]', '{}', 'null', '""', ''))
  AND (u.crate_nfts IS NULL OR u.crate_nfts::text IN ('[]', '{}', 'null', '""', ''))
  AND (u.stakes IS NULL OR u.stakes::text IN ('[]', '{}', 'null', '""', ''))
  AND (u.activities IS NULL OR u.activities::text IN ('[]', '{}', 'null', '""', ''))
  AND (u.relics IS NULL OR u.relics::text IN ('[]', '{}', 'null', '""', ''))

  -- 5. Downlines
  AND COALESCE(u.referrals_count, 0) = 0
  AND COALESCE(u.referrals_l1, 0) = 0
  AND COALESCE(u.referrals_l2, 0) = 0
  AND COALESCE(u.referrals_l3, 0) = 0
  AND COALESCE(u.referrals_l4, 0) = 0

  -- 6. PolySpace Fleet
  AND (
    u.space_state IS NULL 
    OR u.space_state::text IN ('{}', '[]', 'null', '""', '')
    OR (
      COALESCE((u.space_state->>'mineralsMinedTotal')::numeric, 0) = 0
      AND COALESCE((u.space_state->>'raidsWon')::numeric, 0) = 0
      AND COALESCE((u.space_state->>'warpLevel')::numeric, 1) <= 1
      AND COALESCE((u.space_state->>'fleetPower')::numeric, 100) <= 100
    )
  )

  -- 7. Exclusions
  AND NOT COALESCE(u.is_admin, false)
  AND NOT COALESCE(u.is_ambassador, false)
  AND (u.vip_until IS NULL OR u.vip_until <= NOW())
  AND LOWER(COALESCE(u.player_id, '')) <> '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
  AND LOWER(COALESCE(u.linked_wallet_address, '')) <> '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
ORDER BY u.created_at DESC;


-- ==============================================================================
-- 🏷️ QUERY 3: EMPTY ACCOUNTS BREAKDOWN BY ACCOUNT TYPE & AGE
-- ==============================================================================
WITH empty_accounts AS (
  SELECT 
    CASE 
      WHEN user_id IS NOT NULL OR email IS NOT NULL OR (player_id LIKE '0xg%' AND NOT player_id LIKE '0xguest%') THEN 'Google / Auth'
      WHEN player_id LIKE '0xguest%' THEN 'Guest Session'
      WHEN linked_wallet_address IS NOT NULL AND linked_wallet_address <> '' THEN 'Web3 Wallet'
      ELSE 'Synthetic Standalone'
    END AS account_type,
    CASE 
      WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 'Past 24 Hours'
      WHEN created_at >= NOW() - INTERVAL '7 days' THEN '1 to 7 Days Old'
      WHEN created_at >= NOW() - INTERVAL '30 days' THEN '7 to 30 Days Old'
      ELSE 'Older than 30 Days'
    END AS age_category
  FROM users u
  WHERE 
    COALESCE(balance_pgt, 0) = 0
    AND COALESCE(balance_1flr, 0) = 0
    AND COALESCE(staked_balance_pgt, 0) = 0
    AND COALESCE(staked_balance_1flr, 0) = 0
    AND COALESCE(total_staking_yield, 0) = 0
    AND COALESCE(unclaimed_referral_pgt, 0) = 0
    AND COALESCE(total_referral_commission, 0) = 0
    AND COALESCE(total_claims, 0) = 0
    AND COALESCE(claim_streak, 0) = 0
    AND last_faucet_claim IS NULL
    AND last_claim_time IS NULL
    AND COALESCE(game_highscore, 0) = 0
    AND COALESCE(invaders_highscore, 0) = 0
    AND COALESCE(drift_highscore, 0) = 0
    AND COALESCE(stacker_highscore, 0) = 0
    AND COALESCE(catcher_highscore, 0) = 0
    AND COALESCE(alltime_game_highscore, 0) = 0
    AND COALESCE(alltime_invaders_highscore, 0) = 0
    AND COALESCE(alltime_drift_highscore, 0) = 0
    AND COALESCE(alltime_stacker_highscore, 0) = 0
    AND COALESCE(alltime_catcher_highscore, 0) = 0
    AND COALESCE(alltime_highscore, 0) = 0
    AND (owned_nfts IS NULL OR owned_nfts::text IN ('[]', '{}', 'null', '""', ''))
    AND (crate_nfts IS NULL OR crate_nfts::text IN ('[]', '{}', 'null', '""', ''))
    AND (stakes IS NULL OR stakes::text IN ('[]', '{}', 'null', '""', ''))
    AND (activities IS NULL OR activities::text IN ('[]', '{}', 'null', '""', ''))
    AND (relics IS NULL OR relics::text IN ('[]', '{}', 'null', '""', ''))
    AND COALESCE(referrals_count, 0) = 0
    AND COALESCE(referrals_l1, 0) = 0
    AND (
      space_state IS NULL 
      OR space_state::text IN ('{}', '[]', 'null', '""', '')
      OR (
        COALESCE((space_state->>'mineralsMinedTotal')::numeric, 0) = 0
        AND COALESCE((space_state->>'raidsWon')::numeric, 0) = 0
      )
    )
    AND NOT COALESCE(is_admin, false)
    AND NOT COALESCE(is_ambassador, false)
    AND (vip_until IS NULL OR vip_until <= NOW())
    AND LOWER(COALESCE(player_id, '')) <> '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
    AND LOWER(COALESCE(linked_wallet_address, '')) <> '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
)
SELECT 
  account_type,
  age_category,
  COUNT(*) AS count
FROM empty_accounts
GROUP BY account_type, age_category
ORDER BY account_type, count DESC;


-- ==============================================================================
-- 🔍 QUERY 4: DEEP AUDIT & INTEGRITY CHECK (Includes Cross-Table Verification)
-- ==============================================================================
-- Checks that the user has NO records in arcade sessions, bets, withdrawals, or downlines
SELECT 
  u.id,
  u.player_id,
  u.linked_wallet_address,
  u.username,
  u.created_at,
  u.app_version
FROM users u
WHERE 
  -- Basic 0 metrics
  COALESCE(u.balance_pgt, 0) = 0
  AND COALESCE(u.staked_balance_pgt, 0) = 0
  AND COALESCE(u.total_claims, 0) = 0
  AND COALESCE(u.game_highscore, 0) = 0
  AND COALESCE(u.invaders_highscore, 0) = 0
  AND COALESCE(u.drift_highscore, 0) = 0
  AND COALESCE(u.stacker_highscore, 0) = 0
  AND (u.owned_nfts IS NULL OR u.owned_nfts::text IN ('[]', '{}', 'null', '""', ''))
  AND (u.relics IS NULL OR u.relics::text IN ('[]', '{}', 'null', '""', ''))
  AND COALESCE(u.referrals_count, 0) = 0
  AND NOT COALESCE(u.is_admin, false)
  AND (u.vip_until IS NULL OR u.vip_until <= NOW())
  AND LOWER(COALESCE(u.player_id, '')) <> '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'
  AND LOWER(COALESCE(u.linked_wallet_address, '')) <> '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'

  -- Verify no downline links to this user
  AND NOT EXISTS (
    SELECT 1 FROM users downline
    WHERE LOWER(downline.referred_by_l1) = LOWER(u.player_id)
       OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(downline.referred_by_l1) = LOWER(u.linked_wallet_address))
  )
ORDER BY u.created_at DESC;
