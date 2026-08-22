-- ====================================================================
-- POLYGAME - PLAYER ACTIVITY REPORT (LAST 24 HOURS & LAST 7 DAYS)
-- Run this query in Supabase SQL Editor to see play counts and earnings
-- per player across all games.
-- ====================================================================

-- --------------------------------------------------------------------
-- QUERY 1: PLAYER ACTIVITY BREAKDOWN (24h & 7d with per-game counts)
-- --------------------------------------------------------------------
WITH session_counts AS (
  SELECT
    COALESCE(u.player_id, s.player_id) AS canonical_player_id,
    u.username,
    u.linked_wallet_address,
    u.balance_pgt,
    
    -- Total Plays (24h & 7d)
    COUNT(*) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '24 hours')) AS total_plays_24h,
    COUNT(*) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '7 days')) AS total_plays_7d,
    COUNT(*) AS total_plays_all_time,

    -- Astro-Dodge
    COUNT(*) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '24 hours') AND LOWER(s.game_name) LIKE '%astro%') AS astrododge_24h,
    COUNT(*) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '7 days') AND LOWER(s.game_name) LIKE '%astro%') AS astrododge_7d,

    -- Cyber Invaders
    COUNT(*) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '24 hours') AND LOWER(s.game_name) LIKE '%invader%') AS invaders_24h,
    COUNT(*) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '7 days') AND LOWER(s.game_name) LIKE '%invader%') AS invaders_7d,

    -- Cyber Drift
    COUNT(*) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '24 hours') AND LOWER(s.game_name) LIKE '%drift%') AS drift_24h,
    COUNT(*) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '7 days') AND LOWER(s.game_name) LIKE '%drift%') AS drift_7d,

    -- Cyber Stacker / Catcher
    COUNT(*) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '24 hours') AND (LOWER(s.game_name) LIKE '%stacker%' OR LOWER(s.game_name) LIKE '%catcher%')) AS stacker_24h,
    COUNT(*) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '7 days') AND (LOWER(s.game_name) LIKE '%stacker%' OR LOWER(s.game_name) LIKE '%catcher%')) AS stacker_7d,

    -- PGT Earned
    COALESCE(SUM(s.payout_pgt) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '24 hours') AND s.status = 'completed'), 0) AS pgt_earned_24h,
    COALESCE(SUM(s.payout_pgt) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '7 days') AND s.status = 'completed'), 0) AS pgt_earned_7d,

    -- Last Played Timestamp
    MAX(s.started_at) AS last_played_at
  FROM arcade_sessions s
  LEFT JOIN users u 
    ON LOWER(u.player_id) = LOWER(s.player_id) 
    OR LOWER(COALESCE(u.linked_wallet_address, '')) = LOWER(s.player_id)
  WHERE s.started_at >= (NOW() - INTERVAL '7 days')
  GROUP BY COALESCE(u.player_id, s.player_id), u.username, u.linked_wallet_address, u.balance_pgt
)
SELECT
  COALESCE(
    NULLIF(TRIM(username), ''),
    CASE 
      WHEN linked_wallet_address IS NOT NULL AND linked_wallet_address <> '' THEN 
        SUBSTRING(linked_wallet_address, 1, 6) || '...' || SUBSTRING(linked_wallet_address, 39, 4)
      ELSE 
        SUBSTRING(canonical_player_id, 1, 10) || '...'
    END
  ) AS player_display_name,
  canonical_player_id AS player_id,
  linked_wallet_address,
  total_plays_24h,
  total_plays_7d,
  ROUND(pgt_earned_24h::numeric, 2) AS pgt_earned_24h,
  ROUND(pgt_earned_7d::numeric, 2) AS pgt_earned_7d,
  astrododge_24h || ' / ' || astrododge_7d AS astrododge_24h_7d,
  invaders_24h || ' / ' || invaders_7d AS invaders_24h_7d,
  drift_24h || ' / ' || drift_7d AS drift_24h_7d,
  stacker_24h || ' / ' || stacker_7d AS stacker_24h_7d,
  ROUND(COALESCE(balance_pgt, 0)::numeric, 2) AS current_balance_pgt,
  last_played_at
FROM session_counts
ORDER BY total_plays_24h DESC, total_plays_7d DESC;


-- --------------------------------------------------------------------
-- QUERY 2: PLATFORM-WIDE GAME TOTALS (24h & 7d)
-- (Run this second query to see overall game popularity across PolyGame)
-- --------------------------------------------------------------------
SELECT
  COALESCE(game_name, 'Unknown') AS game_title,
  COUNT(*) FILTER (WHERE started_at >= (NOW() - INTERVAL '24 hours')) AS total_plays_24h,
  COUNT(*) FILTER (WHERE started_at >= (NOW() - INTERVAL '7 days')) AS total_plays_7d,
  COUNT(DISTINCT player_id) FILTER (WHERE started_at >= (NOW() - INTERVAL '24 hours')) AS unique_players_24h,
  COUNT(DISTINCT player_id) FILTER (WHERE started_at >= (NOW() - INTERVAL '7 days')) AS unique_players_7d,
  ROUND(COALESCE(SUM(payout_pgt) FILTER (WHERE started_at >= (NOW() - INTERVAL '24 hours') AND status = 'completed'), 0)::numeric, 2) AS total_pgt_payout_24h,
  ROUND(COALESCE(SUM(payout_pgt) FILTER (WHERE started_at >= (NOW() - INTERVAL '7 days') AND status = 'completed'), 0)::numeric, 2) AS total_pgt_payout_7d
FROM arcade_sessions
WHERE started_at >= (NOW() - INTERVAL '7 days')
GROUP BY game_name
ORDER BY total_plays_24h DESC, total_plays_7d DESC;
