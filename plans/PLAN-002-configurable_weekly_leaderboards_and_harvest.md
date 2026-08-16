# Plan PLAN-002: Configurable Weekly Leaderboards, Harvest Toggles, VIP Game Permissions & New VIP Cyber Slots

## Overview
This plan introduces full admin control over **weekly leaderboard payouts**, **in-game PGT harvest permissions**, and **VIP-exclusive access locks** across all PolyGame mini-games, plus the addition of a brand new, fast-paced **VIP Cyber Slots** game.

Admin will be able to:
1. **Toggle Weekly Payouts**: Enable or disable weekly leaderboard payouts individually per game.
2. **Configure Weekly Prize Pools**: Custom PGT prize pool amounts per game (e.g., 50,000 PGT, 100,000 PGT, 25,000 PGT).
3. **Toggle In-Game PGT Harvesting**: Enable or disable whether players earn/harvest PGT rewards in every specific game.
4. **Toggle VIP-Only Access**: Lock any mini-game exclusively to active VIP Pass holders (`vip_only: true/false`).
5. **New VIP Exclusive Game - VIP Cyber Slots**: A sleek 3-reel neon cyber slot machine with high multipliers and server-side atomic RNG.

---

## User Review Required

> [!IMPORTANT]
> - **Default Presets**: Existing weekly prize pools will remain initialized to **50,000 PGT** for Astro-Dodge, Cyber Invaders, and Cyber Drift, with in-game PGT harvesting enabled (`true`) and standard games set to `vip_only: false`.
> - **New VIP Game**: **VIP Cyber Slots** will be added to the Casino / Bet section with default setting `vip_only: true`.
> - **VIP Permission Guard**: If a non-VIP accesses a `vip_only` game, a sleek neon "👑 VIP EXCLUSIVE PASS REQUIRED" overlay is shown with a 1-click VIP Upgrade button, and server-side RPCs reject unauthorized bets.

---

## Proposed Changes

### 1. Supabase Database Schema & Stored Procedures

#### [NEW] [`supabase/add_game_payout_settings_and_vip_slots.sql`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/supabase/add_game_payout_settings_and_vip_slots.sql)
- Add `game_payout_settings` `JSONB` column to `global_settings`:
  ```json
  {
    "astrododge": { "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": false },
    "invaders": { "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": false },
    "drift": { "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": false },
    "roshambo": { "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
    "spinner": { "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
    "plinko": { "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
    "crash": { "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
    "space": { "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
    "vip_slots": { "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": true }
  }
  ```
- **`play_vip_slots(p_player_id TEXT, p_bet NUMERIC)` RPC**:
  - Validates active VIP status (`vip_expires_at > NOW()`).
  - Deducts `p_bet` from `users.balance_pgt` with atomic row lock.
  - Server rolls 3 reels `[reel1, reel2, reel3]` with cyber symbols (`777` = 50x, `DIAMOND` = 25x, `CYBER SKULL` = 10x, `NEON STAR` = 5x, `POLY ORB` = 2.5x, `ANY MATCH` = 1.5x).
  - Evaluates progressive jackpot roll (1 in 25,000).
  - Credits payout to `users.balance_pgt` and records metrics in `game_metrics`.
- **`execute_weekly_payout_and_reset()` RPC**:
  - Dynamically reads `weekly_pool_pgt` and `leaderboard_enabled` for each game.
- **`end_arcade_session()` RPC**:
  - Checks `harvest_enabled` flag from `global_settings.game_payout_settings` (if false, records score but sets payout to 0).

---

### 2. Admin Panel UI & Settings Controls

#### [MODIFY] [`index.html`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/index.html)
- Add **🎮 Game Rules, VIP Access & Leaderboard Settings** management section in Admin Panel (`#view-admin`).
- Interactive controls per game:
  - 👑 **VIP Only** (`checkbox`)
  - 🟢 **Enable Weekly Leaderboard** (`checkbox`)
  - 💰 **Weekly PGT Prize Pool** (`number input`)
  - 🌾 **Enable In-Game PGT Harvest / Payout** (`checkbox`)
- Add **VIP Cyber Slots** game card in `#view-games` (Casino tab) and full game view container.

#### [MODIFY] [`src/js/features/admin.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/src/js/features/admin.js)
- Add `loadGamePayoutSettings()` and `saveGamePayoutSettings()`.
- Bind UI toggles to update `global_settings.game_payout_settings`.

---

### 3. VIP Cyber Slots Feature & VIP Lock Guard

#### [NEW] [`src/js/features/slots.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/src/js/features/slots.js)
- 3-Reel animated spinning neon slot machine.
- Interactive bet selector (10, 25, 50, 100, 250, 500 PGT).
- Real-time spin animations with audio effects (`sfx.playSpin`, `sfx.playSuccess`).
- Live paytable modal / display.
- Invokes `supabase.rpc('play_vip_slots', { p_player_id, p_bet })`.

#### [MODIFY] [`src/js/core/ui.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/src/js/core/ui.js) & [`src/js/app.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/src/js/app.js)
- Add `checkGameVipAccess(gameKey)` guard when clicking/switching to any game tab.
- If `vip_only` is true and player is not VIP, render VIP Exclusive Pass overlay with upgrade CTA.

---

## Verification Plan

### Automated Verification
- Verify `play_vip_slots` rejects non-VIP calls and approves active VIP calls.
- Verify JSONB settings persist and load in Admin Panel.

### Manual Verification
1. Open Admin Panel with Admin Wallet `0x10B9993990c9EF8a212c9557cB02aD94da9a654d`.
2. Toggle `vip_only` on Astro-Dodge and verify non-VIP accounts see the VIP Pass lock screen.
3. Test **VIP Cyber Slots** with VIP account: spin reels, verify payouts and balance updates.
4. Verify weekly prize pool customization reflects on leaderboard headers.
