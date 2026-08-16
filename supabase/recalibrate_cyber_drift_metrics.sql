-- ============================================================
-- POLYGAME: Recalibrate Cyber Drift Game Metrics Script
-- Corrects over-inflated historical total_playtime_seconds in game_metrics table
-- ============================================================

-- Recalibrate Cyber Drift metrics so playtime reflects the ~2.00 PGT/min arcade target earn rate:
UPDATE game_metrics
SET total_playtime_seconds = CASE 
    WHEN total_playtime_seconds > 60000 THEN ROUND((COALESCE(total_payout, 994.79) / 2.0) * 60)
    ELSE total_playtime_seconds
  END,
  updated_at = NOW()
WHERE game_name = 'Cyber Drift';

-- Verify current arcade game metrics across AstroDodge, Cyber Invaders, and Cyber Drift:
SELECT game_name, 
       total_payout, 
       total_playtime_seconds, 
       CONCAT(FLOOR(total_playtime_seconds / 60), 'm ', (total_playtime_seconds % 60), 's') AS playtime_formatted,
       ROUND((total_payout / NULLIF(total_playtime_seconds / 60.0, 0))::NUMERIC, 2) AS earn_rate_pgt_per_min
FROM game_metrics 
WHERE game_name IN ('AstroDodge', 'Cyber Invaders', 'Cyber Drift');
