-- ====================================================================
-- POLYGAME - PLAYER ACTIVITY & DAILY LIMIT REPORT
-- Run these queries in Supabase SQL Editor to monitor player activity,
-- game breakdown, and daily play limits.
-- ====================================================================


-- --------------------------------------------------------------------
-- 🎯 QUERY 1: CHECK A SPECIFIC PLAYER'S DAILY LIMITS (CHANGE INPUT BELOW)
-- --------------------------------------------------------------------
-- Simply change '0x10b9993990c9ef8a212c9557cb02ad94da9a654d' to any
-- player_id, wallet address, or username to inspect:
WITH target AS (
  SELECT '0x10b9993990c9ef8a212c9557cb02ad94da9a654d'::TEXT AS search_input
),
resolved_user AS (
  SELECT 
    u.*,
    COALESCE(u.player_id, t.search_input) AS canonical_id,
    COALESCE(g.max_daily_plays_per_game, 25) AS max_daily_plays
  FROM target t
  LEFT JOIN users u 
    ON LOWER(u.player_id) = LOWER(t.search_input) 
    OR LOWER(COALESCE(u.linked_wallet_address, '')) = LOWER(t.search_input)
    OR LOWER(COALESCE(u.username, '')) = LOWER(t.search_input)
  CROSS JOIN (SELECT COALESCE(max_daily_plays_per_game, 25) AS max_daily_plays_per_game FROM global_settings WHERE id = 1) g
  LIMIT 1
),
game_list AS (
  SELECT 'AstroDodge' AS game_name, 'Astro-Dodge' AS display_name
  UNION ALL SELECT 'Cyber Invaders', 'Cyber Invaders'
  UNION ALL SELECT 'Cyber Drift', 'Cyber Drift'
  UNION ALL SELECT 'Cyber Stacker', 'Cyber Stacker'
),
game_stats AS (
  SELECT
    gl.display_name,
    gl.game_name,
    ru.max_daily_plays,
    ru.canonical_id,
    ru.username,
    ru.linked_wallet_address,
    ru.balance_pgt,
    ru.vip_until,
    ru.is_ambassador,

    -- High Scores
    CASE 
      WHEN gl.game_name = 'AstroDodge' THEN COALESCE(ru.game_highscore, 0)
      WHEN gl.game_name = 'Cyber Invaders' THEN COALESCE(ru.invaders_highscore, 0)
      WHEN gl.game_name = 'Cyber Drift' THEN COALESCE(ru.drift_highscore, 0)
      WHEN gl.game_name = 'Cyber Stacker' THEN COALESCE(ru.stacker_highscore, COALESCE(ru.catcher_highscore, 0))
    END AS player_highscore,

    -- Completed Plays in rolling 24 Hours
    COUNT(s.id) FILTER (
      WHERE s.completed_at >= (NOW() - INTERVAL '24 hours') 
        AND s.status = 'completed'
    ) AS completed_plays_24h,

    -- Total Plays in 7 Days
    COUNT(s.id) FILTER (
      WHERE s.started_at >= (NOW() - INTERVAL '7 days')
    ) AS total_plays_7d,

    -- Total PGT Earned in 24h & 7d
    COALESCE(SUM(s.payout_pgt) FILTER (WHERE s.completed_at >= (NOW() - INTERVAL '24 hours') AND s.status = 'completed'), 0) AS pgt_earned_24h,
    COALESCE(SUM(s.payout_pgt) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '7 days') AND s.status = 'completed'), 0) AS pgt_earned_7d,

    -- Last played session timestamp
    MAX(s.started_at) AS last_played_at
  FROM resolved_user ru
  CROSS JOIN game_list gl
  LEFT JOIN arcade_sessions s 
    ON (LOWER(s.player_id) = LOWER(ru.canonical_id) OR LOWER(s.player_id) = LOWER(COALESCE(ru.linked_wallet_address, '')))
    AND LOWER(s.game_name) = LOWER(gl.game_name)
  GROUP BY gl.display_name, gl.game_name, ru.max_daily_plays, ru.canonical_id, ru.username, ru.linked_wallet_address, ru.balance_pgt, ru.vip_until, ru.is_ambassador, ru.game_highscore, ru.invaders_highscore, ru.drift_highscore, ru.stacker_highscore, ru.catcher_highscore
)
SELECT
  display_name AS game,
  completed_plays_24h || ' / ' || max_daily_plays AS plays_today,
  GREATEST(0, max_daily_plays - completed_plays_24h) AS plays_remaining,
  CASE 
    WHEN completed_plays_24h >= max_daily_plays THEN '🔴 LIMIT REACHED (Rewards Paused)'
    WHEN completed_plays_24h >= (max_daily_plays - 3) THEN '🟡 ALMOST FULL (' || (max_daily_plays - completed_plays_24h) || ' left)'
    ELSE '🟢 ACTIVE (' || (max_daily_plays - completed_plays_24h) || ' left)'
  END AS daily_quota_status,
  ROUND(pgt_earned_24h::numeric, 2) AS pgt_earned_24h,
  total_plays_7d AS plays_last_7d,
  ROUND(pgt_earned_7d::numeric, 2) AS pgt_earned_7d,
  player_highscore AS high_score,
  last_played_at
FROM game_stats

UNION ALL

-- Summary Totals Row across all games
SELECT
  '⭐ TOTAL (ALL GAMES)' AS game,
  SUM(completed_plays_24h) || ' / ' || SUM(max_daily_plays) AS plays_today,
  SUM(GREATEST(0, max_daily_plays - completed_plays_24h)) AS plays_remaining,
  CASE 
    WHEN SUM(completed_plays_24h) >= SUM(max_daily_plays) THEN '🔴 ALL LIMITS REACHED'
    ELSE '🟢 ' || SUM(GREATEST(0, max_daily_plays - completed_plays_24h)) || ' total plays remaining'
  END AS daily_quota_status,
  ROUND(SUM(pgt_earned_24h)::numeric, 2) AS pgt_earned_24h,
  SUM(total_plays_7d) AS plays_last_7d,
  ROUND(SUM(pgt_earned_7d)::numeric, 2) AS pgt_earned_7d,
  NULL AS high_score,
  MAX(last_played_at) AS last_played_at
FROM game_stats;


-- --------------------------------------------------------------------
-- 👥 QUERY 2: ALL PLAYERS ACTIVITY & LIMIT PROXIMITY LEADERBOARD
-- --------------------------------------------------------------------
WITH session_counts AS (
  SELECT
    COALESCE(u.player_id, s.player_id) AS canonical_player_id,
    u.username,
    u.linked_wallet_address,
    u.balance_pgt,
    COALESCE(g.max_daily_plays_per_game, 25) AS max_daily_plays,
    
    -- Total Plays (24h & 7d)
    COUNT(*) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '24 hours')) AS total_plays_24h,
    COUNT(*) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '7 days')) AS total_plays_7d,

    -- Astro-Dodge (24h)
    COUNT(*) FILTER (WHERE s.completed_at >= (NOW() - INTERVAL '24 hours') AND s.status = 'completed' AND LOWER(s.game_name) LIKE '%astro%') AS astrododge_24h,

    -- Cyber Invaders (24h)
    COUNT(*) FILTER (WHERE s.completed_at >= (NOW() - INTERVAL '24 hours') AND s.status = 'completed' AND LOWER(s.game_name) LIKE '%invader%') AS invaders_24h,

    -- Cyber Drift (24h)
    COUNT(*) FILTER (WHERE s.completed_at >= (NOW() - INTERVAL '24 hours') AND s.status = 'completed' AND LOWER(s.game_name) LIKE '%drift%') AS drift_24h,

    -- Cyber Stacker (24h)
    COUNT(*) FILTER (WHERE s.completed_at >= (NOW() - INTERVAL '24 hours') AND s.status = 'completed' AND (LOWER(s.game_name) LIKE '%stacker%' OR LOWER(s.game_name) LIKE '%catcher%')) AS stacker_24h,

    -- PGT Earned
    COALESCE(SUM(s.payout_pgt) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '24 hours') AND s.status = 'completed'), 0) AS pgt_earned_24h,
    COALESCE(SUM(s.payout_pgt) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '7 days') AND s.status = 'completed'), 0) AS pgt_earned_7d,

    -- Last Played Timestamp
    MAX(s.started_at) AS last_played_at
  FROM arcade_sessions s
  LEFT JOIN users u 
    ON LOWER(u.player_id) = LOWER(s.player_id) 
    OR LOWER(COALESCE(u.linked_wallet_address, '')) = LOWER(s.player_id)
  CROSS JOIN (SELECT COALESCE(max_daily_plays_per_game, 25) AS max_daily_plays_per_game FROM global_settings WHERE id = 1) g
  WHERE s.started_at >= (NOW() - INTERVAL '7 days')
  GROUP BY COALESCE(u.player_id, s.player_id), u.username, u.linked_wallet_address, u.balance_pgt, g.max_daily_plays_per_game
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
  ) AS player,
  canonical_player_id AS player_id,
  total_plays_24h || ' / ' || (max_daily_plays * 4) AS total_plays_today,
  astrododge_24h || '/' || max_daily_plays AS astrododge,
  invaders_24h || '/' || max_daily_plays AS invaders,
  drift_24h || '/' || max_daily_plays AS drift,
  stacker_24h || '/' || max_daily_plays AS stacker,
  ROUND(pgt_earned_24h::numeric, 2) AS pgt_24h,
  total_plays_7d AS plays_7d,
  ROUND(pgt_earned_7d::numeric, 2) AS pgt_7d,
  ROUND(COALESCE(balance_pgt, 0)::numeric, 2) AS balance_pgt,
  last_played_at
FROM session_counts
ORDER BY total_plays_24h DESC, total_plays_7d DESC;


-- --------------------------------------------------------------------
-- 🕹️ QUERY 3: PLATFORM-WIDE GAME TOTALS (24h & 7d)
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
