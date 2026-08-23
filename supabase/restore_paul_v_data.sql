-- ==============================================================================
-- RESTORE PAUL V (0xadbfeb97a5c178874209254f1240a1117a2095d2)
-- ==============================================================================
-- Restores Paul V's verified lifetime balance, total earned, and high scores.
-- ==============================================================================

UPDATE public.users
SET 
  balance_pgt = 569.41,
  total_earned = 569.41,
  game_highscore = GREATEST(COALESCE(game_highscore, 0), 8850),
  invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), 29605),
  drift_highscore = GREATEST(COALESCE(drift_highscore, 0), 63873),
  alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), 8850),
  alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), 29605),
  alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), 63873),
  updated_at = NOW()
WHERE 
  player_id = '0xpgt3a44cee7'
  OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER('0xadbfeb97a5c178874209254f1240a1117a2095d2');

-- Verification
SELECT 
  player_id, 
  username, 
  email, 
  linked_wallet_address, 
  balance_pgt, 
  total_earned,
  game_highscore,
  invaders_highscore,
  drift_highscore,
  relics
FROM public.users
WHERE LOWER(COALESCE(linked_wallet_address, '')) = LOWER('0xadbfeb97a5c178874209254f1240a1117a2095d2');
