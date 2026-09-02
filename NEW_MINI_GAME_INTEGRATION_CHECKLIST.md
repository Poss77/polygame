# 🎮 Polygon Gaming — Master Blueprint for Adding a New Arcade Mini-Game (Earn)

This document serves as the **definitive, step-by-step master checklist** whenever designing, implementing, and deploying a new Play-to-Earn Arcade Mini-Game on the Polygon Gaming platform.

---

## 📋 High-Level Architecture Overview

Every Arcade Mini-Game in Polygon Gaming touches **8 core subsystems**:
```
┌─────────────────────────────────────────────────────────────┐
│                 NEW ARCADE GAME ARCHITECTURE                │
├─────────────────────────────────────────────────────────────┤
│ 1. Game Engine & Canvas (60 FPS, Delta-Time, Mobile Touch)   │
│ 2. UI, Virtual Routing & View Panels (Sidebar, Dashboard)   │
│ 3. State Management & PolyState (High Scores, Quests, Tiers)│
│ 4. Database Schema in Supabase (Users Table, Indexing)      │
│ 5. Supabase Stored Procedures (end_arcade_session, Reset)   │
│ 6. Quantum Relics & Drop Engine (Rare, Epic, Legendary)     │
│ 7. Leaderboards & Weekly Reset Engine (10-Item Paging, Podium)│
│ 8. Anti-Cheat, PWA Cache & Deployment (Service Worker Bump) │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Step-by-Step Implementation Checklist

### 1. 🕹️ Game Engine & Physics (`src/js/features/newgame.js` or `newgame.js`)
- [ ] **Canvas Element & Sizing**:
  - Bound canvas to `.game-canvas-wrapper` with responsive 100% width and dynamic aspect ratio scaling.
  - Implement dynamic touch bounding-box coordinate translation (`scaleX`, `scaleY`) for 1:1 finger tracking.
- [ ] **Controls Support**:
  - **Desktop**: Keyboard (`WASD`, `Arrow Keys`, `Spacebar`, `Enter`).
  - **Mobile**: Touch drag, swipe impulses, or split screen-half tap controls.
  - Mobile touch isolation: Add `lastTouchTime` guard (suppress synthetic `mousemove`/`mousedown` for 800ms after touch interaction).
- [ ] **Delta-Time & 60 FPS Performance**:
  - Normalize game loop physics using `dt = Math.min((now - lastTime) / 1000, 0.1)`.
  - Use DOM caching (avoid 60fps repeated `document.getElementById` lookups in main render loop).
- [ ] **Audio & SFX Integration**:
  - Connect to `sfx` sound engine in `src/js/core/audio.js` (`sfx.playLaser()`, `sfx.playScore()`, `sfx.playHit()`, `sfx.playGameOver()`).
- [ ] **Game State Lifecycle**:
  - Implement standard methods: `init()`, `start()`, `pause()`, `resume()`, `gameOver()`, `resizeCanvas()`, `reset()`.
  - Support Fullscreen toggle and handle `fullscreenchange` / `exitGameFullscreen()` resize triggers without clipping.

---

### 2. 🖥️ UI, Virtual Routing & View Panels (`index.html` & `src/js/core/ui.js`)
- [ ] **Virtual View Routing**:
  - Add the new view ID (e.g. `'newgame'`) to `VALID_TABS` in `src/js/app.js` and `switchTab(tabName)`.
  - Add navigation item in Desktop Sidebar (`#sidebar-nav`) and Mobile Bottom Nav (`#mobile-bottom-nav`).
- [ ] **Dashboard Hero Card**:
  - Add an animated game card on `#view-dashboard` with highscore badge, weekly prize pool badge (e.g. `50,000 PGT`), and direct "Play Now" button.
- [ ] **Game View Container (`#view-newgame`)**:
  - Header: Game Title, description, back button, sound mute toggle, fullscreen toggle.
  - In-Game HUD: Live Score, Level / Wave, Multiplier, Lives / Health, Session PGT Earned.
  - Bottom Bar / Help Section: How to play, scoring rules, controls guide.
- [ ] **Game Over Screen / Modal**:
  - Final Score display, New High Score banner (if beaten).
  - PGT Tokens Earned breakdown (Base + NFT Multiplier + Serie 1 Apex 1.5x Multiplier).
  - "Play Again" button & "Back to Dashboard" button.
  - Quantum Relic drop celebration modal trigger (if drop rolled).

---

### 3. 💾 Core State Management (`src/js/core/state.js` & `src/js/core/db-sync.js`)
- [ ] **`PolyState` Properties**:
  - Add `newgameHighScore: 0` (current weekly tournament score).
  - Add `alltimeNewgameHighScore: 0` (career all-time record).
- [ ] **`_executeSaveToDB()` Monotonic Protection**:
  - In `src/js/core/state.js`, ensure high scores are **strictly omitted** if `0`:
    ```javascript
    if (this.state.newgameHighScore > 0) dbPayload.newgame_highscore = this.state.newgameHighScore;
    if (this.state.alltimeNewgameHighScore > 0) dbPayload.alltime_newgame_highscore = this.state.alltimeNewgameHighScore;
    ```
- [ ] **Social Auth & Wallet Sync Mapping**:
  - In `syncAuthenticatedUser()` (`db-sync.js`), map DB high scores to `PolyState`:
    ```javascript
    const newHigh = parseInt(userRow.newgame_highscore || 0, 10);
    const alltimeNewHigh = Math.max(parseInt(userRow.alltime_newgame_highscore || 0, 10), newHigh);
    activeAppState.state.newgameHighScore = newHigh;
    activeAppState.state.alltimeNewgameHighScore = alltimeNewHigh;
    ```
- [ ] **Daily Quests & Weekly Active Tier Progression**:
  - On Game Over, trigger arcade quest progress:
    ```javascript
    if (typeof window.trackQuestProgress === 'function') {
      window.trackQuestProgress('arcade', 1);
    }
    ```

---

### 4. 🗄️ Database Schema & Migration (`supabase/master_schema.sql`)
- [ ] **Add Columns to `public.users` Table**:
  ```sql
  ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS newgame_highscore INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alltime_newgame_highscore INTEGER DEFAULT 0;
  ```
- [ ] **Add Index for Leaderboard Performance**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_users_newgame_highscore 
  ON public.users (newgame_highscore DESC NULLS LAST);
  ```

---

### 5. ⚡ Supabase Stored Procedures / RPCs (`supabase/master_rpcs.sql`)

- [ ] **Update `end_arcade_session` RPC**:
  - Add game identifier validation: `'newgame'`.
  - Apply score validation & token payout formula ($base + perks + 1.5\times Apex$).
  - Increment `weekly_games_played = weekly_games_played + 1` and trigger `compute_weekly_active_tier`.
  - Atomically update weekly and career highscores:
    ```sql
    IF p_game = 'newgame' THEN
      v_new_high := GREATEST(COALESCE(v_user.newgame_highscore, 0), p_score);
      v_alltime_high := GREATEST(COALESCE(v_user.alltime_newgame_highscore, 0), p_score);
      UPDATE public.users 
      SET 
        newgame_highscore = v_new_high,
        alltime_newgame_highscore = v_alltime_high,
        balance_pgt = balance_pgt + v_final_payout,
        weekly_games_played = COALESCE(weekly_games_played, 0) + 1,
        updated_at = NOW()
      WHERE player_id = v_resolved_pid;
    END IF;
    ```
- [ ] **Update `execute_weekly_payout_and_reset` RPC**:
  - Add weekly prize pool query (Top 10 / Tiered payout of 50,000 PGT).
  - Snapshot winners into `public.weekly_winners_archive` with `game = 'newgame'`.
  - Reset weekly score `newgame_highscore = 0` (while preserving `alltime_newgame_highscore`).

---

### 6. 🏺 Quantum Relics Set Integration (`src/js/features/relics.js`)
- [ ] **Define 3 Unique Quantum Relics**:
  - 🥉 **Rare Relic** (Drop chance ~1/250 games): e.g. `relic_newgame_core`
  - 🥈 **Epic Relic** (Drop chance ~1/750 games): e.g. `relic_newgame_dynamo`
  - 🥇 **Legendary Relic** (Drop chance ~1/2500 games): e.g. `relic_newgame_apex`
- [ ] **Register in `RELICS_REGISTRY`**:
  - Add IDs, names, icons, lore, drop criteria, and ERC-721 token metadata.
- [ ] **Add to Drop Table in `end_arcade_session`**:
  - Enable server-side cryptographic RNG drop generation.
- [ ] **Update Serie 1 / Serie 2 Apex Multiplier Check**:
  - If part of Serie 1/2, add the relic IDs to `is_season1_apex_unlocked()` in PostgreSQL.

---

### 7. 🏆 Paginated Leaderboards & Player Standing (`src/js/features/profile.js`)
- [ ] **Leaderboard Component**:
  - Add leaderboard table below the game canvas with 10 items per page.
  - Support `◀ PREV` `PAGE X / Y` `NEXT ▶` navigation.
  - Glow effects for podium ranks (🥇 Gold, 🥈 Silver, 🥉 Bronze).
- [ ] **⚡ Pinned "You" Row**:
  - Display player's current rank (`#14`, `100+`, or `--`), score, and projected prize tier anchored below the leaderboard table.
- [ ] **Archive & History**:
  - Connect game to Past Weekly Winners Archive dropdown (`loadPastWeeklyArchive()`).

---

### 8. 🛡️ Anti-Cheat, Cache Busting & Production Deployment
- [ ] **Server-Side Anti-Cheat Bounds**:
  - Verify impossible score rates (e.g. score delta cannot exceed max theoretical points per millisecond).
  - Enforce minimum game duration check before allowing token payout.
- [ ] **PWA & Cache Invalidation**:
  - Add `<script src="newgame.js?v=X.X.XXX"></script>` to `index.html`.
  - Bump `APP_VERSION = "X.X.XXX"` in `src/js/core/config.js`.
  - Bump `CACHE_NAME = 'polygame-pwa-vX.X.XXX'` in `sw.js`.
- [ ] **Admin Panel Tools**:
  - Verify game appears in Admin Panel highscore reset tools and manual player inspector.
