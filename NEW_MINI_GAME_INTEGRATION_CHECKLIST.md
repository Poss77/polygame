# 🎮 Polygon Gaming — Master Blueprint for Adding a New Arcade Mini-Game (Earn)

This document serves as the **definitive, step-by-step master checklist** whenever designing, implementing, and deploying a new Play-to-Earn Arcade Mini-Game on the Polygon Gaming platform.

---

## 📋 High-Level Architecture Overview

Every Arcade Mini-Game in Polygon Gaming touches **9 core subsystems**:
```
┌─────────────────────────────────────────────────────────────┐
│                 NEW ARCADE GAME ARCHITECTURE                │
├─────────────────────────────────────────────────────────────┤
│ 1. Game Engine & Canvas (60 FPS, Delta-Time, Mobile Touch)   │
│ 2. UI, Virtual Routing & View Panels (Sidebar, Dashboard)   │
│ 3. State Management & PolyState (High Scores, Quests, Tiers)│
│ 4. Database Schema in Supabase (Users Table, Indexing)      │
│ 5. Global Settings & Weekly Prize Pool (game_payout_settings)│
│ 6. Supabase Stored Procedures (end_arcade_session, Reset)   │
│ 7. Quantum Relics & Drop Engine (Rare, Epic, Legendary)     │
│ 8. Leaderboards & Weekly Reset Engine (10-Item Paging, Podium)│
│ 9. Anti-Cheat, PWA Cache & Deployment (Service Worker Bump) │
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
- [ ] **Add Index for High-Speed Leaderboard Queries**:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_users_newgame_highscore 
  ON public.users (newgame_highscore DESC NULLS LAST);
  ```

---

### 5. ⚙️ Global Settings & Weekly Prize Pool Configuration (`global_settings` & `admin.js`)
- [ ] **Configure `global_settings.game_payout_settings`**:
  - Add default weekly prize pool (e.g. 50,000 PGT) and leaderboard enabled flag into `global_settings`:
    ```sql
    UPDATE public.global_settings
    SET game_payout_settings = COALESCE(game_payout_settings, '{}'::jsonb) || jsonb_build_object(
      'newgame', jsonb_build_object('weekly_pool_pgt', 50000, 'leaderboard_enabled', true)
    )
    WHERE id = 1 AND (game_payout_settings->'newgame') IS NULL;
    ```
- [ ] **Admin Panel Configuration Controls (`src/js/features/admin.js`)**:
  - Add input field in Admin Panel Settings tab to dynamically inspect and change `weekly_pool_pgt` and toggle leaderboard active status for the new game without needing code redeployment.

---

### 6. ⚡ Supabase Stored Procedures / RPCs (`supabase/master_rpcs.sql`)

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

- [ ] **Update `submit_arcade_highscore` RPC**:
  - Add `p_newgame_highscore INTEGER DEFAULT NULL` parameter.
  - Update `newgame_highscore = GREATEST(COALESCE(newgame_highscore, 0), COALESCE(p_newgame_highscore, 0))`.

- [ ] **Update `execute_weekly_payout_and_reset` RPC (Weekly Tournament Engine)**:
  - **Dynamic Pool Resolution**: Fetch `v_pool := COALESCE((v_settings->'newgame'->>'weekly_pool_pgt')::numeric, 50000)`.
  - **Leaderboard Active Check**: Fetch `v_lb_enabled := COALESCE((v_settings->'newgame'->>'leaderboard_enabled')::boolean, true)`.
  - **Tiered Prize Distribution Loop**:
    ```sql
    IF v_lb_enabled AND v_pool > 0 THEN
      v_rank := 0;
      FOR v_rec IN (
        SELECT player_id, COALESCE(linked_wallet_address, player_id) AS wallet_address, newgame_highscore AS score
        FROM users WHERE COALESCE(newgame_highscore, 0) > 0 ORDER BY newgame_highscore DESC LIMIT 100
      ) LOOP
        v_rank := v_rank + 1;
        IF v_rank = 1 THEN v_prize := ROUND(v_pool * 0.30);
        ELSIF v_rank = 2 THEN v_prize := ROUND(v_pool * 0.16);
        ELSIF v_rank = 3 THEN v_prize := ROUND(v_pool * 0.08);
        ELSIF v_rank BETWEEN 4 AND 10 THEN v_prize := ROUND(v_pool * 0.02);
        ELSIF v_rank BETWEEN 11 AND 25 THEN v_prize := ROUND(v_pool * 0.008);
        ELSIF v_rank BETWEEN 26 AND 50 THEN v_prize := ROUND(v_pool * 0.004);
        ELSIF v_rank BETWEEN 51 AND 100 THEN v_prize := ROUND(v_pool * 0.002);
        ELSE v_prize := 0;
        END IF;

        IF v_prize > 0 THEN
          UPDATE users SET balance_pgt = balance_pgt + v_prize, total_earned = COALESCE(total_earned, 0) + v_prize, updated_at = NOW() WHERE player_id = v_rec.player_id;
          v_total_distributed := v_total_distributed + v_prize;
          v_total_winners := v_total_winners + 1;
        END IF;

        INSERT INTO weekly_leaderboard_history (
          week_label, game_type, rank, player_id, wallet_address, best_score, prize_pgt
        ) VALUES (
          v_week_label, 'newgame', v_rank, v_rec.player_id, LOWER(v_rec.wallet_address), v_rec.score, v_prize
        );
      END LOOP;
      v_games_processed := array_append(v_games_processed, 'NewGame (' || v_pool::TEXT || ' PGT)');
    END IF;
    ```
  - **Weekly High Score Reset**:
    ```sql
    UPDATE users SET newgame_highscore = 0 WHERE newgame_highscore > 0;
    ```

---

### 7. 🏺 Quantum Relics Set Integration (`src/js/features/relics.js`)
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

### 8. 🏆 Paginated Leaderboards & Player Standing (`src/js/features/profile.js`)
- [ ] **Leaderboard Component**:
  - Add leaderboard table below the game canvas with 10 items per page.
  - Support `◀ PREV` `PAGE X / Y` `NEXT ▶` navigation.
  - Glow effects for podium ranks (🥇 Gold, 🥈 Silver, 🥉 Bronze).
- [ ] **⚡ Pinned "You" Row**:
  - Display player's current rank (`#14`, `100+`, or `--`), score, and projected prize tier anchored below the leaderboard table.
- [ ] **Archive & History**:
  - Connect game to Past Weekly Winners Archive dropdown (`loadPastWeeklyArchive()`).

---

### 9. 🛡️ Anti-Cheat, Cache Busting & Production Deployment
- [ ] **Server-Side Anti-Cheat Bounds**:
  - Verify impossible score rates (e.g. score delta cannot exceed max theoretical points per millisecond).
  - Enforce minimum game duration check before allowing token payout.
- [ ] **PWA & Cache Invalidation**:
  - Add `<script src="newgame.js?v=X.X.XXX"></script>` to `index.html`.
  - Bump `APP_VERSION = "X.X.XXX"` in `src/js/core/config.js`.
  - Bump `CACHE_NAME = 'polygame-pwa-vX.X.XXX'` in `sw.js`.
- [ ] **Admin Panel Tools**:
  - Verify game appears in Admin Panel highscore reset tools and manual player inspector.
