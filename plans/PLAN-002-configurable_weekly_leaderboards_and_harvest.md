# Plan PLAN-002: Configurable Weekly Leaderboard Payouts & In-Game PGT Harvest Toggles

## Overview
This plan introduces full admin control over **weekly leaderboard payouts** and **in-game PGT harvest permissions** across all PolyGame mini-games (Astro-Dodge, Cyber Invaders, Cyber Drift, Roshambo, Lucky Spinner, Neon Plinko, Cyber-Crash, PolySpace Mining).

Admin will be able to:
1. **Toggle Weekly Payouts**: Enable or disable weekly leaderboard payouts individually per game.
2. **Configure Weekly Prize Pools**: Custom PGT prize pool amounts per game (e.g., 50,000 PGT, 100,000 PGT, 25,000 PGT).
3. **Toggle In-Game PGT Harvesting**: Enable or disable whether players earn/harvest PGT rewards in every specific game.

---

## User Review Required

> [!IMPORTANT]
> - **Default Presets**: By default, existing weekly prize pools will remain initialized to **50,000 PGT** for Astro-Dodge, Cyber Invaders, and Cyber Drift, with in-game PGT harvesting enabled (`true`) across all games.
> - **RPC Dynamic Calculation**: The weekly automated reset RPC `execute_weekly_payout_and_reset()` will dynamically fetch the configured prize pool per game and scale payouts proportionally (1st Place = 30%, 2nd Place = 16%, 3rd Place = 8%, 4th–10th = 2%, etc.).

---

## Open Questions

> [!NOTE]
> 1. Should disabling in-game PGT harvest for a game prevent the player from launching/playing the game, or simply set game win rewards to 0 PGT while keeping score recording active? *(Default recommendation: Keep scores active for leaderboards, but set PGT payout to 0).*

---

## Proposed Changes

### 1. Supabase Database Schema & Migration

#### [NEW] [`supabase/add_game_payout_settings.sql`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/supabase/add_game_payout_settings.sql)
- Add `game_payout_settings` `JSONB` column to `global_settings`:
  ```json
  {
    "astrododge": { "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true },
    "invaders": { "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true },
    "drift": { "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true },
    "roshambo": { "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true },
    "spinner": { "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true },
    "plinko": { "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true },
    "crash": { "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true },
    "space": { "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true }
  }
  ```
- Update `execute_weekly_payout_and_reset()` RPC to dynamically pull `weekly_pool_pgt` and `leaderboard_enabled` flags for each game instead of using hardcoded 50,000 PGT limits.
- Update `credit_arcade_payout` RPC to check `harvest_enabled` flag for that specific game before adding PGT to player balance.

---

### 2. Admin Panel UI & Settings Controls

#### [MODIFY] [`index.html`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/index.html)
- Add a new **🎮 Game Payouts & Leaderboard Settings** management section in the Admin Panel (`#view-admin`).
- Include interactive toggle switches and numeric input boxes for each mini-game:
  - 🟢 **Enable Weekly Leaderboard** (`checkbox`)
  - 💰 **Weekly PGT Prize Pool** (`number input`)
  - 🌾 **Enable In-Game PGT Harvest** (`checkbox`)

#### [MODIFY] [`src/js/features/admin.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/src/js/features/admin.js)
- Add `loadGamePayoutSettings()` and `saveGamePayoutSettings()` functions.
- Wire Admin UI controls to fetch and update `global_settings.game_payout_settings` via Supabase REST API.

---

### 3. Frontend Dynamic Leaderboard & Harvest Guards

#### [MODIFY] [`src/js/core/state.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/src/js/core/state.js)
- Cache `game_payout_settings` in `appState.state.gamePayoutSettings` on boot.
- Expose helper functions:
  - `isHarvestEnabled(gameKey)`
  - `getWeeklyPoolPgt(gameKey)`
  - `isLeaderboardEnabled(gameKey)`

#### [MODIFY] [`src/js/core/db-sync.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/src/js/core/db-sync.js)
- Update leaderboard UI rendering routines (`renderLeaderboards()`) to display live `weekly_pool_pgt` (e.g., `"Weekly Pool: 100,000 PGT"`) or show `"Leaderboard Paused"` if `leaderboard_enabled` is `false`.

---

## Verification Plan

### Automated Verification
- Execute unit tests for `global_settings` JSONB updates.
- Test `execute_weekly_payout_and_reset()` RPC with custom pool values (e.g., 25,000 PGT and 100,000 PGT).

### Manual Verification
1. Log into Admin Panel with Master Admin Wallet `0x10B9993990c9EF8a212c9557cB02aD94da9a654d`.
2. Navigate to **Game Payouts & Leaderboards** section.
3. Toggle `harvest_enabled` off for a game and verify PGT earnings are paused while scores still log.
4. Update Astro-Dodge Weekly Pool to 100,000 PGT and verify the Arcade Leaderboard header updates to **"Weekly Pool: 100,000 PGT"**.
