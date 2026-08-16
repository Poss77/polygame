# Plan PLAN-002: Configurable Weekly Leaderboards, Harvest Toggles, VIP Access & New VIP Arcade Game (Cyber Catcher)

## Overview
This plan introduces full admin control over **weekly leaderboard payouts**, **in-game PGT harvest permissions**, and **VIP-exclusive access locks** across all PolyGame mini-games, plus the addition of a brand new, high-yield VIP Arcade (Earn) game: **Cyber Catcher (Neon Drop)**.

Admin will be able to:
1. **Toggle Weekly Payouts**: Enable or disable weekly leaderboard payouts individually per game.
2. **Configure Weekly Prize Pools**: Custom PGT prize pool amounts per game (e.g., 50,000 PGT, 100,000 PGT, 25,000 PGT).
3. **Toggle In-Game PGT Harvesting**: Enable or disable whether players earn/harvest PGT rewards in every specific game.
4. **Toggle VIP-Only Access**: Lock any mini-game exclusively to active VIP Pass holders (`vip_only: true/false`).
5. **New VIP Exclusive Arcade (Earn) Game - Cyber Catcher (Neon Drop)**: A fast, fun, simple arcade game where players steer a neon collector drone to catch falling crypto data chips, multiplier gems, and golden tokens while dodging hazard EMP spikes.

---

## Game Design: Cyber Catcher (VIP Arcade Earn)

- **Genre**: Arcade Skill / Action Collector (Earn)
- **Controls**: Mouse, Left/Right Arrow Keys, Touch Drag / Swipe on mobile.
- **Gameplay**:
  - Steer the Cyber Drone at the bottom of the screen.
  - **Catch**:
    - 🪙 **Data Chips**: +50 pts (Base earn score)
    - 💎 **Quantum Gems**: +150 pts + Combo Multiplier (Up to 5x)
    - ⚡ **Magnet Powerup**: Pulls nearby chips automatically for 6s
    - 🛡️ **Shield Bubble**: Protects against 1 hazard bomb
    - 🪙 **Golden +5 PGT Tokens**: Bonus payout tokens added at game over
  - **Avoid**:
    - 💣 **EMP Spikes / Glitch Bombs**: Loses 1 of 3 Lives (or triggers game over)
- **Economy & Payout**:
  - Uses the **Arcade Anti-Cheat Session Handshake** (`start_arcade_session` & `end_arcade_session`).
  - High baseline yield for VIPs with 2.0x VIP multiplier + NFT boosts.

---

## Proposed Changes

### 1. Supabase Database Schema & Settings
- Add `game_payout_settings` `JSONB` column to `global_settings`:
  ```json
  {
    "astrododge": { "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": false },
    "invaders": { "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": false },
    "drift": { "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": false },
    "catcher": { "leaderboard_enabled": true, "weekly_pool_pgt": 50000, "harvest_enabled": true, "vip_only": true },
    "roshambo": { "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
    "spinner": { "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
    "plinko": { "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
    "crash": { "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false },
    "space": { "leaderboard_enabled": false, "weekly_pool_pgt": 0, "harvest_enabled": true, "vip_only": false }
  }
  ```
- Update `end_arcade_session()` to support `Cyber Catcher` score calculations and check `harvest_enabled` & `vip_only`.

---

### 2. Admin Panel UI & Settings Controls
- Add **🎮 Game Rules, VIP Access & Leaderboard Settings** management table in `#view-admin`:
  - 👑 **VIP Only** toggle
  - 🟢 **Enable Weekly Leaderboard** toggle
  - 💰 **Weekly PGT Prize Pool** numeric input
  - 🌾 **Enable In-Game PGT Harvest** toggle

---

### 3. New Game Implementation: `catcher.js` & VIP Access Lock
- **[NEW] `catcher.js`**:
  - Full HTML5 60FPS Canvas game loop.
  - Mobile touch support + desktop smooth lerp movement.
  - Interactive HUD (Score, Combo, Lives, Live PGT Earned).
  - High score submission & anti-cheat session handshake integration.
- **[MODIFY] `index.html`**:
  - Add Cyber Catcher game card in the Arcade (Earn) list with **👑 VIP EXCLUSIVE** badge.
  - Add game canvas and game-over modal containers.
  - Add VIP lock overlay component.

---

## Verification Plan

### Automated Verification
- Verify `start_arcade_session` and `end_arcade_session` handle `Cyber Catcher` scores and reject unauthorized non-VIP calls when `vip_only` is true.

### Manual Verification
1. Open Admin Panel with Admin Wallet `0x10B9993990c9EF8a212c9557cB02aD94da9a654d`.
2. Verify all game toggles (VIP Only, Harvest Enabled, Weekly Pool) save and persist.
3. Test **Cyber Catcher**: catch chips, trigger magnet powerups, lose lives on hazard bombs, and verify verified PGT payout upon game over.
4. Test with a non-VIP account to verify the VIP Lock screen appears when accessing `Cyber Catcher`.
