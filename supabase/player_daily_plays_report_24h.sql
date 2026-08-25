-- ==============================================================================
-- POLYGAME - 24-HOUR PLAYER ARCADE ACTIVITY & DAILY LIMITS REPORT
-- ==============================================================================
-- Run these queries in your Supabase SQL Editor to monitor player sessions,
-- game breakdown, remaining daily quotas, and PGT payouts over the last 24 hours.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 👥 QUERY 1: ALL PLAYERS 24-HOUR ACTIVITY & REMAINING LIMITS TABLE
-- Shows all active players in the rolling 24-hour window with individual game counts
-- ------------------------------------------------------------------------------
WITH settings AS (
  SELECT COALESCE(max_daily_plays_per_game, 35) AS max_limit
  FROM public.global_settings
  WHERE id = 1
),
user_sessions AS (
  SELECT
    s.id,
    COALESCE(u.player_id, s.player_id) AS player_id,
    COALESCE(u.username, s.player_id) AS username,
    u.linked_wallet_address,
    u.balance_pgt,
    u.is_ambassador,
    u.vip_until,
    s.game_name,
    s.status,
    s.payout_pgt,
    s.score,
    s.started_at,
    s.completed_at
  FROM public.arcade_sessions s
  LEFT JOIN public.users u
    ON LOWER(u.player_id) = LOWER(s.player_id)
    OR LOWER(COALESCE(u.linked_wallet_address, '')) = LOWER(s.player_id)
  WHERE s.started_at >= (NOW() - INTERVAL '24 hours')
)
SELECT
  us.username AS player_name,
  us.player_id,
  COALESCE(us.linked_wallet_address, 'Not Linked') AS linked_wallet,
  ROUND(COALESCE(us.balance_pgt, 0)::numeric, 2) AS current_balance_pgt,
  
  -- Total 24h Completed Plays
  COUNT(*) FILTER (WHERE us.status = 'completed') AS total_completed_24h,
  
  -- Individual Game Completed Counts / Max Limit
  COUNT(*) FILTER (WHERE us.status = 'completed' AND (LOWER(us.game_name) LIKE '%astro%' OR LOWER(us.game_name) LIKE '%dodge%')) 
    || ' / ' || (SELECT max_limit FROM settings) AS astrododge_plays,
    
  COUNT(*) FILTER (WHERE us.status = 'completed' AND LOWER(us.game_name) LIKE '%invader%') 
    || ' / ' || (SELECT max_limit FROM settings) AS invaders_plays,
    
  COUNT(*) FILTER (WHERE us.status = 'completed' AND LOWER(us.game_name) LIKE '%drift%') 
    || ' / ' || (SELECT max_limit FROM settings) AS drift_plays,
    
  COUNT(*) FILTER (WHERE us.status = 'completed' AND (LOWER(us.game_name) LIKE '%stacker%' OR LOWER(us.game_name) LIKE '%catcher%')) 
    || ' / ' || (SELECT max_limit FROM settings) AS stacker_plays,
    
  -- Total PGT Earned from Arcade in 24h
  ROUND(COALESCE(SUM(us.payout_pgt) FILTER (WHERE us.status = 'completed'), 0)::numeric, 2) AS pgt_earned_24h,
  
  -- Overall Status
  CASE
    WHEN COUNT(*) FILTER (WHERE us.status = 'completed' AND (LOWER(us.game_name) LIKE '%stacker%' OR LOWER(us.game_name) LIKE '%catcher%')) >= (SELECT max_limit FROM settings)
      OR COUNT(*) FILTER (WHERE us.status = 'completed' AND LOWER(us.game_name) LIKE '%drift%') >= (SELECT max_limit FROM settings)
      OR COUNT(*) FILTER (WHERE us.status = 'completed' AND LOWER(us.game_name) LIKE '%invader%') >= (SELECT max_limit FROM settings)
      OR COUNT(*) FILTER (WHERE us.status = 'completed' AND (LOWER(us.game_name) LIKE '%astro%' OR LOWER(us.game_name) LIKE '%dodge%')) >= (SELECT max_limit FROM settings)
    THEN '🔴 LIMIT HIT ON >=1 GAME'
    WHEN COUNT(*) FILTER (WHERE us.status = 'completed' AND (LOWER(us.game_name) LIKE '%stacker%' OR LOWER(us.game_name) LIKE '%catcher%')) >= (SELECT max_limit - 5 FROM settings)
      OR COUNT(*) FILTER (WHERE us.status = 'completed' AND LOWER(us.game_name) LIKE '%drift%') >= (SELECT max_limit - 5 FROM settings)
      OR COUNT(*) FILTER (WHERE us.status = 'completed' AND LOWER(us.game_name) LIKE '%invader%') >= (SELECT max_limit - 5 FROM settings)
      OR COUNT(*) FILTER (WHERE us.status = 'completed' AND (LOWER(us.game_name) LIKE '%astro%' OR LOWER(us.game_name) LIKE '%dodge%')) >= (SELECT max_limit - 5 FROM settings)
    THEN '🟡 NEAR LIMIT (<=5 Left)'
    ELSE '🟢 ACTIVE'
  END AS daily_status,
  
  MAX(us.started_at) AS last_played_at
FROM user_sessions us
GROUP BY us.player_id, us.username, us.linked_wallet_address, us.balance_pgt
ORDER BY total_completed_24h DESC;


-- ------------------------------------------------------------------------------
-- 🎯 QUERY 2: SPECIFIC PLAYER DRILL-DOWN (REPLACE 'Poss' WITH ANY USERNAME / WALLET)
-- ------------------------------------------------------------------------------
-- Change 'Poss' to any username, player_id, or wallet address to inspect:
WITH target AS (
  SELECT 'Poss'::TEXT AS search_input
),
settings AS (
  SELECT COALESCE(max_daily_plays_per_game, 35) AS max_limit
  FROM public.global_settings
  WHERE id = 1
),
resolved_user AS (
  SELECT 
    u.*,
    COALESCE(u.player_id, t.search_input) AS canonical_id,
    s.max_limit
  FROM target t
  CROSS JOIN settings s
  LEFT JOIN public.users u 
    ON LOWER(u.player_id) = LOWER(t.search_input) 
    OR LOWER(COALESCE(u.linked_wallet_address, '')) = LOWER(t.search_input)
    OR LOWER(COALESCE(u.username, '')) = LOWER(t.search_input)
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
    ru.max_limit,
    ru.canonical_id,
    ru.username,
    ru.linked_wallet_address,
    ru.balance_pgt,

    -- High Scores
    CASE 
      WHEN gl.game_name = 'AstroDodge' THEN COALESCE(ru.game_highscore, 0)
      WHEN gl.game_name = 'Cyber Invaders' THEN COALESCE(ru.invaders_highscore, 0)
      WHEN gl.game_name = 'Cyber Drift' THEN COALESCE(ru.drift_highscore, 0)
      WHEN gl.game_name = 'Cyber Stacker' THEN COALESCE(ru.stacker_highscore, 0)
    END AS high_score,

    -- Completed Plays in rolling 24 Hours
    COUNT(s.id) FILTER (
      WHERE s.completed_at >= (NOW() - INTERVAL '24 hours') 
        AND s.status = 'completed'
    ) AS completed_plays_24h,

    -- Total Plays in rolling 7 Days
    COUNT(s.id) FILTER (
      WHERE s.started_at >= (NOW() - INTERVAL '7 days')
        AND s.status = 'completed'
    ) AS completed_plays_7d,

    -- PGT Earned in 24h & 7d
    COALESCE(SUM(s.payout_pgt) FILTER (WHERE s.completed_at >= (NOW() - INTERVAL '24 hours') AND s.status = 'completed'), 0) AS pgt_earned_24h,
    COALESCE(SUM(s.payout_pgt) FILTER (WHERE s.started_at >= (NOW() - INTERVAL '7 days') AND s.status = 'completed'), 0) AS pgt_earned_7d,

    -- Last played timestamp
    MAX(s.started_at) AS last_played_at
  FROM resolved_user ru
  CROSS JOIN game_list gl
  LEFT JOIN public.arcade_sessions s 
    ON (LOWER(s.player_id) = LOWER(ru.canonical_id) OR LOWER(s.player_id) = LOWER(COALESCE(ru.linked_wallet_address, '')))
    AND (
      LOWER(s.game_name) = LOWER(gl.game_name)
      OR (gl.game_name = 'Cyber Stacker' AND LOWER(s.game_name) LIKE '%catcher%')
      OR (gl.game_name = 'AstroDodge' AND LOWER(s.game_name) LIKE '%dodge%')
    )
  GROUP BY gl.display_name, gl.game_name, ru.max_limit, ru.canonical_id, ru.username, ru.linked_wallet_address, ru.balance_pgt, ru.game_highscore, ru.invaders_highscore, ru.drift_highscore, ru.stacker_highscore
)
SELECT
  display_name AS game_title,
  completed_plays_24h || ' / ' || max_limit AS plays_last_24h,
  GREATEST(0, max_limit - completed_plays_24h) AS plays_remaining_24h,
  CASE 
    WHEN completed_plays_24h >= max_limit THEN '🔴 LIMIT REACHED (Rewards Paused)'
    WHEN completed_plays_24h >= (max_limit - 5) THEN '🟡 ALMOST FULL (' || (max_limit - completed_plays_24h) || ' left)'
    ELSE '🟢 ACTIVE (' || (max_limit - completed_plays_24h) || ' left)'
  END AS quota_status,
  ROUND(pgt_earned_24h::numeric, 2) AS pgt_earned_24h,
  completed_plays_7d AS plays_last_7d,
  ROUND(pgt_earned_7d::numeric, 2) AS pgt_earned_7d,
  high_score,
  last_played_at
FROM game_stats

UNION ALL

-- Summary Totals Row
SELECT
  '⭐ TOTAL (ALL GAMES)' AS game_title,
  SUM(completed_plays_24h) || ' / ' || SUM(max_limit) AS plays_last_24h,
  SUM(GREATEST(0, max_limit - completed_plays_24h)) AS plays_remaining_24h,
  CASE 
    WHEN SUM(completed_plays_24h) >= SUM(max_limit) THEN '🔴 ALL LIMITS REACHED'
    ELSE '🟢 ' || SUM(GREATEST(0, max_limit - completed_plays_24h)) || ' total plays remaining'
  END AS quota_status,
  ROUND(SUM(pgt_earned_24h)::numeric, 2) AS pgt_earned_24h,
  SUM(completed_plays_7d) AS plays_last_7d,
  ROUND(SUM(pgt_earned_7d)::numeric, 2) AS pgt_earned_7d,
  NULL AS high_score,
  MAX(last_played_at) AS last_played_at
FROM game_stats;


-- ------------------------------------------------------------------------------
-- 📜 QUERY 3: MOST RECENT 50 ARCADE RUNS LIVE LOG
-- ------------------------------------------------------------------------------
SELECT
  s.id AS session_id,
  COALESCE(u.username, s.player_id) AS player_name,
  s.game_name,
  s.status,
  s.score,
  COALESCE(s.bonus_items, 0) AS bonus_items,
  COALESCE(s.bonus_tokens, 0) AS bonus_tokens,
  ROUND(COALESCE(s.payout_pgt, 0)::numeric, 2) AS payout_pgt,
  COALESCE(s.duration_seconds, EXTRACT(EPOCH FROM (COALESCE(s.completed_at, NOW()) - s.started_at))::integer) AS duration_secs,
  s.started_at,
  s.completed_at
FROM public.arcade_sessions s
LEFT JOIN public.users u 
  ON LOWER(u.player_id) = LOWER(s.player_id)
  OR LOWER(COALESCE(u.linked_wallet_address, '')) = LOWER(s.player_id)
ORDER BY s.started_at DESC
LIMIT 50;
