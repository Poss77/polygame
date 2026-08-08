-- PolyGame Admin Metrics Playtime Fix Script
-- Fixes historical game_metrics where AstroDodge and Cyber Invaders logged minutes instead of seconds,
-- ensuring that Admin Panel Earn Rates (PGT/min) and Total Playtimes reflect true gameplay.

UPDATE game_metrics 
SET total_playtime_seconds = total_playtime_seconds * 60 
WHERE game_name IN ('AstroDodge', 'Cyber Invaders') 
  AND total_playtime_seconds > 0 
  AND total_playtime_seconds < 100000;
