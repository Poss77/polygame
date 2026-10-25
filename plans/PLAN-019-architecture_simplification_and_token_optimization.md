# PLAN-019: Architecture Simplification & AI Token Optimization

**Status**: Proposed  
**Created**: 2026-10-25  
**Target Version**: `v1.5.709+`  
**Scope**: Codebase Modularization, Single-Source-of-Truth Registries, Duplicate HTML/JS Elimination, Historical File Archiving, and Automated Release Tooling (`scripts/bump_version.py`).

---

## 1. Executive Summary & Goals

As Polygon Gaming has expanded to 9 Earn Arcade games, 5 Betting games, PolySpace Fleet Operations, 3 NFT collections (Utility, Relics, Procedural Starships), and a full Admin Portal, several core files have grown into large monoliths with duplicated configuration and markup.

This plan targets **two complementary objectives**:
1. **Simplify Future Modifications**: Replace "9-place shotgun edits" (where changing one leaderboard text or adding one game requires editing 6–9 locations across HTML and JS) with a **Single Source of Truth (`ARCADE_GAMES_REGISTRY`)** and shared UI templates.
2. **Save AI Context Tokens**: Slash the number of lines/bytes that need to be searched, read, and edited per turn by archiving historical changelog/SQL files, extracting inline CSS out of `index.html`, splitting multi-domain monoliths (`profile.js`, `db-sync.js`), and automating version bumps.

---

## 2. Current Bottlenecks (Baseline Audit)

| File / Directory | Current Size | Root Cause of Token & Maintenance Overhead |
| :--- | :--- | :--- |
| [`index.html`](../index.html) | **5,317 lines (429.4 KB)** | Contains 370 lines of inline `<style>` in `<head>`, 9 copy-pasted `<div id="leaderboard-col-*">` cards (~250 lines), and repeated scorecard blocks. |
| [`CHANGELOG.md`](../CHANGELOG.md) | **2,707 lines (359.7 KB)** | Retains 258 releases (`v1.5.450`–`v1.5.708`) in the active file, which is read/modified on every single patch. |
| [`supabase/*.sql`](../supabase) | **~35,000 lines (~1.4 MB)** | Over 25 already-merged one-off SQL scripts sit in `supabase/` root alongside `master_rpcs.sql` and `supabase/rpcs/`, flooding grep/search context. |
| [`src/js/features/profile.js`](../src/js/features/profile.js) | **2,652 lines (128.6 KB)** | Combines 4 separate domains: (1) 9 Game Leaderboards, (2) Holders & Supply Chart + Weekly Archive, (3) Web3 Wallet Auth, and (4) Player/Public Profile UI. |
| [`src/js/features/games.js`](../src/js/features/games.js) | **1,184 lines (59.7 KB)** | `switchGameModeView()` and `closeGameView()` use 300+ lines of repetitive `if (mode === '...')` branches instead of a data-driven loop. |
| [`src/js/core/db-sync.js`](../src/js/core/db-sync.js) | **3,224 lines (153.5 KB)** | Mixes OAuth/Web3 session linking, profile hydration, jackpot sync, and arcade metric settlement in one file. |

---

## 3. Phased Implementation Plan

### Phase 1: Immediate Token Savers (Zero Runtime Risk)

#### 1.1 Archive Historical Releases in `CHANGELOG.md`
- **Action**: Move `v1.5.450` through `v1.5.689` (~2,450 lines) from [`CHANGELOG.md`](../CHANGELOG.md) into [`docs/archive/CHANGELOG_v1.5_archive.md`](../docs/archive/CHANGELOG_v1.5_archive.md), keeping `v1.5.690+` in the active [`CHANGELOG.md`](../CHANGELOG.md).
- **Update Reference**: Update header links in `CHANGELOG.md` and `.agents/AGENTS.md` to reflect the updated archive range (`v1.5.000`–`v1.5.689`).
- **Impact**: Shrinks active `CHANGELOG.md` by **~90%** (from 2,707 lines / 360 KB down to ~250 lines / 30 KB).

#### 1.2 Archive One-Off Applied SQL Migrations in `supabase/`
- **Action**: Move one-off historical `.sql` scripts in `supabase/` root into `supabase/archive/`, leaving **only** authoritative live files in `supabase/` root:
  - `supabase/master_schema.sql`
  - `supabase/master_rpcs.sql`
  - `supabase/rpcs/01_*.sql` through `11_*.sql`
- **Impact**: Prevents codebase searches in `supabase/` from scanning 1+ MB of superseded SQL files.

#### 1.3 Automated Version & Cache-Buster Script (`scripts/bump_version.py`)
- **Action**: Create `scripts/bump_version.py`:
  ```bash
  python scripts/bump_version.py 1.5.709 "Short release summary"
  ```
- **Behavior**:
  1. Updates `export const APP_VERSION = "..."` and its inline comment in [`src/js/core/config.js`](../src/js/core/config.js).
  2. Updates `?v=...` cache-buster query strings across `<link>` and `<script>` tags in [`index.html`](../index.html).
  3. Prepends a structured release entry stub at the top of [`CHANGELOG.md`](../CHANGELOG.md).
- **Impact**: Eliminates 3–4 separate file read/edit tool calls on every single release.

---

### Phase 2: `index.html` Diet & Shared Leaderboard Rendering

#### 2.1 Extract Inline `<style>` Block from `index.html`
- **Action**: Move lines 48–374 of [`index.html`](../index.html) (inline `<style>` rules for fullscreen arcade mode, mobile touch controls, and responsive navbar adjustments) into [`src/css/main.css`](../src/css/main.css) (or a dedicated `src/css/mobile-overrides.css` imported by `main.css`).
- **Impact**: Removes **~325 lines** from the top of `index.html` so HTML markup begins immediately after `<head>`.

#### 2.2 Dynamic Shared Leaderboard Card Template
- **Problem**: [`index.html`](../index.html) lines 1947–2172 contain 9 nearly identical `<div id="leaderboard-col-*">` cards (each ~25 lines with identical prize pool breakdown `<details>` tables and weekly reset notices).
- **Action**:
  - Replace the 9 repetitive card inner templates in `index.html` with lightweight mount containers (or generate their inner HTML on boot via a single `initArcadeLeaderboardCards()` function in `src/js/features/leaderboards.js`).
  - Support `data-i18n` attributes out-of-the-box so it integrates seamlessly with [`PLAN-018` (Multi-Language Internationalization)](PLAN-018-multi_language_internationalization_and_localization.md).
- **Impact**: Removes **~220 lines** of duplicated HTML in `index.html` and makes any future leaderboard header/prize-table update a **1-line change in 1 place**.

---

### Phase 3: Unified `ARCADE_GAMES_REGISTRY` (Eliminating "9-Place Edits")

Create a single authoritative configuration module `src/js/core/games-registry.js` exported across the app:

```javascript
export const ARCADE_GAMES_REGISTRY = {
  astrododge: {
    key: 'astrododge',
    modeView: 'arcade',
    panelId: 'panel-game-arcade',
    lbColId: 'leaderboard-col-arcade',
    lbContainerId: 'leaderboard-arcade-container',
    poolElId: 'lb-pool-astrododge',
    startOverlayId: 'game-ui-overlay',
    scoreField: 'game_highscore',
    alltimeField: 'alltime_game_highscore',
    stateScoreKey: 'gameHighScore',
    careerKey: 'alltimeGameHighScore',
    profileScoreElId: 'profile-score-dodge',
    profileWeeklyElId: 'profile-weekly-dodge',
    pubScoreElId: 'pub-profile-score-dodge',
    pubWeeklyElId: 'pub-profile-weekly-dodge',
    windowInstance: 'dodgeGame',
    title: 'Astro-Dodge',
    shortTitle: 'Astro',
    icon: '🚀',
    defaultPool: 50000
  },
  // ... invaders, drift, stacker, skeet, defense, runner, q2048, tetris
};
```

#### Refactor Consumers to Loop Over `ARCADE_GAMES_REGISTRY`:
1. **`src/js/features/games.js`**:
   - `isAnyArcadeGamePlaying()`: Loop over registry `windowInstance`.
   - `closeGameView()`: Loop over registry to stop active engines, reset start/gameover overlays, and hide panels/leaderboards (replaces ~110 lines of repetitive code with ~25 lines).
   - `switchGameModeView(mode)`: Replace the 9 repetitive `else if (mode === ...)` branches with a clean registry lookup + optional per-game `onOpen()` hook.
2. **`src/js/features/profile.js`**:
   - `GAME_LEADERBOARDS_CONFIG` & `gameLeaderboardsState`: Derived automatically from `ARCADE_GAMES_REGISTRY`.
   - `syncProfileView()` & `openPublicProfile()`: Loop over `ARCADE_GAMES_REGISTRY` to populate all Career & Weekly high score DOM elements instead of 36 manual `document.getElementById` calls.
   - `loadPastWeeklyArchive()`: Derive `gameTitles` and score extraction directly from `ARCADE_GAMES_REGISTRY`.

---

### Phase 4: Modularizing `profile.js` (2,652 Lines -> 3 Focused Files)

Split [`src/js/features/profile.js`](../src/js/features/profile.js) into 3 clean ES modules while preserving all `window.*` globals and re-exports in `profile.js` so zero external imports break:

1. **`src/js/features/leaderboards.js` (~500 lines)**:
   - `renderGameLeaderboard`, `fetchAndLoadGameLeaderboard`, `changeGameLeaderboardPage`, `invalidateGameLeaderboardCache`, `loadReferralLeaderboard`, `loadWeeklyWinsLeaderboard`, `getLeaderboardStarshipBadge`, `formatLeaderboardName`.
2. **`src/js/features/holders.js` (~550 lines)**:
   - `loadHoldersLeaderboard`, `renderHoldersPage`, `changeHoldersPage`, `switchHoldersMode`, `renderHoldersSupplyChart`, `recordSupplySnapshotIfNeeded`, `loadPastWeeklyArchive`.
3. **`src/js/features/profile.js` (~1,150 lines)**:
   - `syncProfileView`, `openPublicProfile`, `switchProfileSubTab`, Web3 wallet connect/disconnect & session management (`connectWeb3`, `autoConnectWeb3`, `disconnectWallet`), and re-exports from `leaderboards.js` and `holders.js`.

---

## 4. Verification & Safety Invariants

Every phase must pass:
1. `python scripts/validate_syntax.py` (0 syntax errors across all JS modules).
2. `python scripts/verify_security_invariants.py` (all 4 database/anti-cheat security invariants intact).
3. Full backward compatibility check on all `window.*` global handlers used by `onclick="..."` attributes in `index.html`.
