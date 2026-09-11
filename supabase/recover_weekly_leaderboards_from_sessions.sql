-- ==============================================================================
-- POLYGON GAMING: AUTHORITATIVE WEEKLY LEADERBOARD RECOVERY SCRIPT
-- ==============================================================================
-- Purpose:
-- Recalculates every player's weekly tournament scores directly from the authoritative
-- `arcade_sessions` ledger table for all sessions completed since Monday Sept 7, 2026.
-- Also restores weekly activity counters (faucet claims, games played, active tiers).
--
-- Safety Guarantees:
-- 1. All scores are derived from genuine completed arcade sessions in `arcade_sessions`.
-- 2. Uses GREATEST() so all-time records and existing scores are NEVER downgraded.
-- 3. Automatically updates all 6 arcade tournament leaderboards:
--    - Astro-Dodge (game_highscore)
--    - Cyber Invaders (invaders_highscore)
--    - Cyber Drift (drift_highscore)
--    - Cyber Stacker (stacker_highscore)
--    - Cyber Skeet (skeet_highscore)
--    - Cyber Defense (defense_highscore)
-- 4. Recomputes weekly_active_tier for all active players.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. RECOVER TOURNAMENT SCORES & GAMES PLAYED DIRECTLY FROM ARCADE_SESSIONS
-- ------------------------------------------------------------------------------
WITH weekly_session_scores AS (
  SELECT 
    LOWER(player_id) AS pid,
    MAX(CASE WHEN LOWER(game_name) IN ('astrododge', 'game') THEN score ELSE 0 END) AS astrododge_high,
    MAX(CASE WHEN LOWER(game_name) = 'invaders' THEN score ELSE 0 END) AS invaders_high,
    MAX(CASE WHEN LOWER(game_name) = 'drift' THEN score ELSE 0 END) AS drift_high,
    MAX(CASE WHEN LOWER(game_name) IN ('stacker', 'catcher') THEN score ELSE 0 END) AS stacker_high,
    MAX(CASE WHEN LOWER(game_name) = 'skeet' THEN score ELSE 0 END) AS skeet_high,
    MAX(CASE WHEN LOWER(game_name) = 'defense' THEN score ELSE 0 END) AS defense_high,
    COUNT(*) AS games_played_count
  FROM public.arcade_sessions
  WHERE completed_at >= '2026-09-07 00:46:11+00'
    AND status = 'completed'
  GROUP BY LOWER(player_id)
)
UPDATE public.users u
SET 
  game_highscore = GREATEST(COALESCE(u.game_highscore, 0), w.astrododge_high),
  invaders_highscore = GREATEST(COALESCE(u.invaders_highscore, 0), w.invaders_high),
  drift_highscore = GREATEST(COALESCE(u.drift_highscore, 0), w.drift_high),
  stacker_highscore = GREATEST(COALESCE(u.stacker_highscore, 0), w.stacker_high),
  skeet_highscore = GREATEST(COALESCE(u.skeet_highscore, 0), w.skeet_high),
  defense_highscore = GREATEST(COALESCE(u.defense_highscore, 0), w.defense_high),
  alltime_game_highscore = GREATEST(COALESCE(u.alltime_game_highscore, 0), w.astrododge_high),
  alltime_invaders_highscore = GREATEST(COALESCE(u.alltime_invaders_highscore, 0), w.invaders_high),
  alltime_drift_highscore = GREATEST(COALESCE(u.alltime_drift_highscore, 0), w.drift_high),
  alltime_stacker_highscore = GREATEST(COALESCE(u.alltime_stacker_highscore, 0), w.stacker_high),
  alltime_skeet_highscore = GREATEST(COALESCE(u.alltime_skeet_highscore, 0), w.skeet_high),
  defense_alltime_best = GREATEST(COALESCE(u.defense_alltime_best, 0), w.defense_high),
  weekly_games_played = GREATEST(COALESCE(u.weekly_games_played, 0), w.games_played_count),
  updated_at = NOW()
FROM weekly_session_scores w
WHERE LOWER(u.player_id) = w.pid;

-- ------------------------------------------------------------------------------
-- 2. RESTORE WEEKLY FAUCET CLAIMS FROM VERIFIED LEDGER & BACKUP
-- ------------------------------------------------------------------------------
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 4) WHERE LOWER(player_id) = LOWER('0xpgt8312e02d37185b5983e6922d1dae1cce'); -- Poss
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 4) WHERE LOWER(player_id) = LOWER('0xpgt85c8416473bd6a8c45ada81ac85aeabb'); -- Origin
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 4) WHERE LOWER(player_id) = LOWER('0xpgtf6a9a748636544a9a83d80cef9a8a40900000'); -- MSD crypto
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 4) WHERE LOWER(player_id) = LOWER('0xpgt58f5eb8c'); -- Cybermix
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 4) WHERE LOWER(player_id) = LOWER('0xpgt25c12fd2'); -- CRiMiNeL
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 4) WHERE LOWER(player_id) = LOWER('0xpgt3a44cee7'); -- Paul V
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 4) WHERE LOWER(player_id) = LOWER('0xpgt80153522'); -- Heldstuc💯
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 4) WHERE LOWER(player_id) = LOWER('0xpgtae31c8f5'); -- Michał Dyka
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 4) WHERE LOWER(player_id) = LOWER('0xpgt1340d9e6'); -- Vezuvius King
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 4) WHERE LOWER(player_id) = LOWER('0xpgt1315acc40000000000000000000000000000'); -- troubs
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 4) WHERE LOWER(player_id) = LOWER('0xpgtd6c88ba475c04696b0d78d2da526ae9800000'); -- Jack S
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 4) WHERE LOWER(player_id) = LOWER('0xpgt5e64957dabcde8ba47239a359f61b6f1'); -- Fly
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 4) WHERE LOWER(player_id) = LOWER('0xg0761cd80ab9048fb97cc1b43a80e9f7b0000000'); -- Fill
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 3) WHERE LOWER(player_id) = LOWER('0xpgt2aa64159'); -- SuperRonald🎖️
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 3) WHERE LOWER(player_id) = LOWER('0xpgt6c30c08c'); -- Ninja
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 3) WHERE LOWER(player_id) = LOWER('0xpgt9ddc0ca3'); -- TopTop
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 3) WHERE LOWER(player_id) = LOWER('0xpgtd398f15c'); -- ShadowSTrk1
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 3) WHERE LOWER(player_id) = LOWER('0xpgtb115ab5b'); -- L'aléatoire
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 3) WHERE LOWER(player_id) = LOWER('0xpgt572e1a30'); -- The Matrix™️
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 3) WHERE LOWER(player_id) = LOWER('0xpgtfa22fc0c'); -- SpaceJaw
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 3) WHERE LOWER(player_id) = LOWER('0xpgt33682426'); -- patesz
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 2) WHERE LOWER(player_id) = LOWER('0xpgt08891829df91813056bbd8d6e838cdc4'); -- Bass
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 2) WHERE LOWER(player_id) = LOWER('0xpgt461a068f0bd48378c8f93a4eadb77152'); -- Theo
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 2) WHERE LOWER(player_id) = LOWER('0xpgt305d0f00'); -- Bram Gen-Z
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 2) WHERE LOWER(player_id) = LOWER('0xpgt21f04f30'); -- Biodun
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 2) WHERE LOWER(player_id) = LOWER('0xpgt236e9b8e'); -- SIMOMOKBAU
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 1) WHERE LOWER(player_id) = LOWER('0xpgtaad27334'); -- Ahmad Nouhaili
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 1) WHERE LOWER(player_id) = LOWER('0xpgt74ee2577');
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 1) WHERE LOWER(player_id) = LOWER('0xpgtb0e10b10');
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 1) WHERE LOWER(player_id) = LOWER('0xpgt9c72e9d2');
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 1) WHERE LOWER(player_id) = LOWER('0xpgt3606a936');
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 1) WHERE LOWER(player_id) = LOWER('0xpgteb2bbbb1');
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 1) WHERE LOWER(player_id) = LOWER('0xpgt2857463f');
UPDATE public.users SET weekly_faucet_claims = GREATEST(COALESCE(weekly_faucet_claims, 0), 1) WHERE LOWER(player_id) = LOWER('0xpgt0b064be4');

-- ------------------------------------------------------------------------------
-- 3. RECOMPUTE ACCURATE WEEKLY_ACTIVE_TIER FOR ALL PARTICIPATING PLAYERS
-- ------------------------------------------------------------------------------
UPDATE public.users
SET weekly_active_tier = public.compute_weekly_active_tier(weekly_faucet_claims, weekly_games_played)
WHERE weekly_faucet_claims > 0 OR weekly_games_played > 0;

COMMIT;

NOTIFY pgrst, 'reload schema';
