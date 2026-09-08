# Polygon Gaming Context and Knowledge

**Platform & Branding**:
- **Official Name**: **Polygon Gaming** (Website, public brand, and marketing).
- **Domain / URLs**: `https://polygongaming.io/` / `https://polygame.fun` / GitHub Pages deployment.
- **Native Token**: **PGT** (PolyGame Token / Polygon Gaming Token).

**Tech Stack**:
- Vanilla HTML, CSS, JavaScript.
- Backend: Supabase (REST API). The project uses a `users` table to track player progression.
- Hosting: Designed for GitHub Pages (runs fully in-browser with a DB connection, no Node.js backend server).

**Architecture / State**:
- Frontend source of truth: `PolyState` class in `app.js` and `state.js`.
- **Account & Player ID Architecture**:
  - EVERY player in Polygon Gaming (Web3 wallet, Google Auth, or Guest) has a **generated synthetic `player_id`** starting with `0xpgt...`, `0xg...`, or `0xguest...` (e.g. `0xpgt8312e02d...`, `0xg0761cd...`, `0xguest5382...`).
  - Web3 EVM wallet addresses are **ALWAYS** stored in **`linked_wallet_address`** across ALL login types (Google, Guest, or Web3 Wallet).
  - **CRITICAL**: Never assume `player_id` equals an EVM wallet address. All database RPCs and lookups must use `resolve_player_id(p_input)` to resolve input addresses to the row's `player_id`.
- Automatic Sync: When state mutates locally, `saveToDB()` is automatically called to `upsert` the data into Supabase (throttled by a 2-second batching timer).
- The UI contains many separate virtual "views" routed via `switchTab()` in `app.js`.

**Important Addresses & Credentials**:
- **Master Admin Wallet**: `0x10B9993990c9EF8a212c9557cB02aD94da9a654d` (connecting with this wallet unlocks a hidden Admin Panel).
- **Supabase URL**: `https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/`
- **NFT Contract (Polygon)**: `0x45D80Ea3a24978350ccC6A61A2d89B031435eCB8`
- **Quantum Relics Contract (Polygon)**: `0xdc7B10e6b765c28A276Cc3E95836217BdF7Da69e`
- **Official Discord Community**: `https://discord.gg/kuyUXNWf3`

- **Full Historical Changelog**: Complete past release notes from v1.4.298 through v1.5.307 are archived in [`CHANGELOG.md`](../CHANGELOG.md).

**Master Guidelines for AI Agents**:
1. **Version Increment & Release Protocol**: Current version is **`APP_VERSION = "1.5.316"`** in `src/js/core/config.js`. PolyGame uses 3-digit patch versioning (`1.4.001` -> `1.4.002` -> `1.4.999`) to allow 1,000 patch updates per minor version cycle before advancing to `1.5.000`. Whenever deploying a new site update or feature, increment `APP_VERSION`. This automatically triggers the **⚡ NEW UPDATE** badge for 5 seconds on players' first login/visit after that update, and syncs the permanent bottom-center version tag (`v1.5.316`).
2. **Database Script Notifications**: If any change requires running an RPC or SQL script in Supabase, notify the user explicitly at the start of your turn.
3. **Anti-Cheat Integrity**: Never include `balance_pgt` in client `saveToDB()` payloads; all balance mutations must go through `SECURITY DEFINER` database RPCs.
4. **No Unprompted Database Modifications**: Never attempt to run automated database mutations, balance resets, or table corrections directly on Supabase data unless explicitly requested by the user. Always provide clean, commented SQL scripts for the user to review and execute manually in the Supabase SQL Editor.

**Deployment / GitHub Actions**:
- Deployed via **GitHub Pages**.
- Standard git workflow for updates:
  ```bash
  git add .
  git commit -m "Update message"
  git push origin main
  ```

**Game Design & Economy**:
- **In-Game Currency**: PGT (PolyGame Token). Used for betting, buying NFTs, and staking.
- **Core Loop**: Faucet -> Wager in Mini-Games -> Buy multiplier NFTs -> Stake yield in Vault.
- **Mini-Game Categories & Categorized Lists**:
  - **Mini-Games (Earn)**:
    - **Astro-Dodge** (Arcade Survival)
    - **Cyber Invaders** (Arcade Shooter)
    - **Cyber Drift** (Arcade Racing)
    - **Cyber Stacker** (Physics Neon Tower Stacking)
    - **PolySpace Mining** (Idle Strategy & Fleet Operations)
    - **24-Hour PGT Faucet** (Daily Claim)
    - *Discord Announcement Rule*: Fires `Big earn on [Game]!` with **Session Score (pts)**, **Earned PGT**, and **Player Display Name** (omits raw `0x...` address for privacy) ONLY when `Earned PGT > 20 PGT` (configurable).
  - **Mini-Games (Bet / Casino)**:
    - **Roshambo** (Rock-Paper-Scissors)
    - **Lucky Spinner** (Wheel Spin)
    - **Neon Plinko** (Galton Board)
    - **Cyber-Crash** (Multiplier Crash)
    - *Discord Announcement Rule*: Fires `Big win on [Game]!` with **Multiplier (x)**, **Win Payout (PGT)**, **Wager (PGT)**, and **Player Display Name** (omits raw `0x...` address for privacy) ONLY when `Win Payout > 100 PGT` (configurable).
- **Server-Side Game Logic**: Gambling and payout logic processed on Supabase backend via Secure RPC calls (`play_roshambo`, `play_spinner`, `play_plinko`, `play_crash`, `submit_invaders_score`, `claim_faucet`).
- **NFT Marketplace**: Utility NFTs purchased with PGT or minted on Polygon. NFTs grant passive multipliers for Faucet, Arcade wins, and Referrals.
- **VIP System**: Buy VIP status for 2.0x payouts across all games, bypass captchas, reduced faucet cooldowns, and exclusive access to Cyber Stacker.
- **PolySpace Router**: `launchPolySpace()` routes directly into `#view-games` `adventure` tab.

---

## Recent Architecture Milestones (Last 6 Releases)

- **Database Trigger Balance Shield Fix & PolySpace Cloud Sync Hardening (`v1.5.316`)**:
  - **🛡️ Resolved PostgreSQL Runtime Crash on `users` Table Updates (`42703`)**:
    - Diagnosed that `prevent_direct_balance_mutation()` referenced `NEW.balance_1flr`, a column previously dropped from `public.users` in `cleanup_legacy_users_columns.sql`.
    - At runtime, every client PostgREST `UPDATE` or `saveToDB()` call failed with code `42703: record "new" has no field "balance_1flr"`.
    - Deployed `supabase/fix_prevent_direct_balance_mutation_trigger.sql` removing the legacy reference while preserving anti-cheat shields on PGT balance, roles, VIP expiration, and weekly activity tiers.
  - **🛰️ Fixed PolySpace Infinite Mission Claiming**:
    - With database updates failing, claiming expeditions removed them locally but never updated Supabase. Starting a new mission or changing tabs triggered `syncCloudSpaceState()`, fetching the un-updated cloud state and resurrecting the completed expedition.
    - Eliminated trigger error `42703` and hardened `space.js` with a 4-second local write timestamp grace period to ensure background cloud sync never overwrites newer local state during rapid claim/launch sequences.
    - Made `claimExpeditionLoot()` and `claimAllExpeditions()` await `this.saveSpaceState()` before completing.

- **Weekly Activity Tier Snapshot Idempotency & Anti-Cheat Trigger Shield (`v1.5.315`)**:
  - **📊 Resolved Weekly Activity Tier Wiping on Multiple Resets**:
    - Identified that `snapshot_weekly_activity_tiers()` in PostgreSQL contained an idempotency flaw: on repeated execution, because `weekly_active_tier` had already been zeroed out (`0`), running the procedure again executed `SET last_weekly_active_tier = COALESCE(weekly_active_tier, 0)`, wiping all players' earned official standings down to `0` (Dormant).
    - Upgraded `snapshot_weekly_activity_tiers()` to conditionally update `last_weekly_active_tier`: `CASE WHEN COALESCE(weekly_active_tier, 0) > 0 THEN weekly_active_tier ELSE COALESCE(last_weekly_active_tier, 0) END`.
    - Executing Step 3 ("Snapshot & Reset Active Tiers") or the Master Pipeline multiple times is now 100% idempotent and can never wipe previously snapshotted tiers.
  - **🛡️ Shielded Weekly Activity Counters in Anti-Cheat Trigger (`prevent_direct_balance_mutation`)**:
    - Extended the PostgreSQL security trigger `prevent_direct_balance_mutation` to reject and revert any direct client mutations (`anon` or `authenticated`) to `weekly_faucet_claims`, `weekly_games_played`, `weekly_active_tier`, and `last_weekly_active_tier`.
    - Guarantees that stale browser sessions or background tabs running older client versions cannot inadvertently resurrect last week's activity numbers via routine `saveToDB()` calls.
  - **⚡ Resilient Frontend State Management in Admin Suite**:
    - Updated `snapshotWeeklyActivityTiers()` and `finalizeLeaderboardReset()` in `src/js/features/admin.js` to preserve `lastWeeklyActiveTier` in memory (`(curLiveTier > 0) ? curLiveTier : lastWeeklyActiveTier`) when `weeklyActiveTier` is already 0.
    - Removed redundant direct table update fallback that failed under Supabase RLS, and surfaced clear error toasts if database RPCs fail.
  - **👑 Restored Official Earned Past-Week Standings**:
    - Prepared canonical SQL restoration script `supabase/fix_and_restore_weekly_activity_tiers.sql` restoring official earned standings for all 11 active players (Poss: Level 5, Vezuvius King: Level 5, Paul V: Level 5, Jack S: Level 4, Fly: Level 3, Origin: Level 2, CRiMiNeL: Level 2, Bass: Level 2, troubs: Level 1, patesz: Level 1).

- **Desktop Fullscreen 16:9 Responsive Scaling for Astro-Dodge & Cyber Invaders (`v1.5.314`)**:
  - **🖥️ Resolved Desktop Fullscreen Canvas Lock at 640x360**:
    - Diagnosed that on desktop Chrome, entering Fullscreen Mode in Astro-Dodge, Cyber Invaders, Cyber Drift, and Cyber Defense left the game canvas rendered as a tiny 640x360 box in the center of the monitor surrounded by large black borders.
    - Root cause: `.game-window-container.fullscreen-active canvas:not(#skeet-canvas)` enforced `width: auto !important; height: auto !important; max-width: 100% !important; max-height: 100% !important;`. In CSS, `width: auto` on a replaced `<canvas>` element causes the browser to compute used dimensions strictly from its intrinsic pixel size (`640x360`), while `max-width: 100%` never upscales elements.
    - Replaced the intrinsic size lock with responsive aspect-ratio locked container bounds: `.game-canvas-wrapper` now calculates `width: min(calc(100vw - 16px), calc((100vh - 140px) * (16 / 9))) !important; height: min(calc((100vw - 16px) * (9 / 16)), calc(100vh - 140px)) !important;` with 16:9 aspect ratio and 140px vertical clearance for HUD and close buttons.
    - On a 1080p desktop monitor, the canvas now smoothly scales from 640x360 up to **1671px x 940px** (~2.6x wider and taller, ~7x pixel surface area) with zero letterboxing distortion and crisp neon aesthetics.
    - Set `width: 100% !important; height: 100% !important; object-fit: fill !important;` across all arcade canvases in fullscreen mode.
  - **🎯 Pixel-Perfect Mouse, Keyboard, and Touch Controls**:
    - Verified that canvas bounding client rect math in `game.js` (`getCanvasCoords`), `invaders.js`, `drift.js`, and `defense.js` scales coordinates dynamically (`this.canvas.width / rect.width`), providing 100% pixel-accurate aiming, laser firing, and steering across scaled fullscreens.
  - **📐 Specific Aspect Ratio Preservation**:
    - Preserved authentic 4:3 aspect ratio for Cyber Stacker (`#container-stacker`) and 16:10 aspect ratio for Cyber Drift (`#container-drift`).
    - Added `id="container-arcade"` to Astro-Dodge wrapper and cleaned up redundant inline `max-width: 640px` styles in `index.html`.
    - Added `box-sizing: border-box` and `overflow-y: auto` to `.game-overlay` ensuring start/gameover overlays fit scaled canvases seamlessly.
    - Added `window.defenseEngine?.resizeCanvas?.()` to `app.js` fullscreen resize triggers.

- **NFT Backpack On-Chain Sync Button & Instant Multicall VIP Activation (`v1.5.313`)**:
  - **🔄 Added "Sync On-Chain NFTs" Button to Backpack Header**:
    - Identified that when players buy, transfer, or burn NFTs (or if MetaMask transactions are rejected/cancelled), players had no way to force a fresh on-chain rescan from Polygon without logging out and back in.
    - Added an `.inventory-actions-bar` header above `#nft-inventory-grid` in `index.html` featuring a prominent **"🔄 Sync On-Chain NFTs"** button with dynamic rotating icon feedback.
    - Implemented `syncNftBackpack()` in `src/js/features/nft.js`, querying Multicall3 on Polygon, saving the verified token list to Supabase (`users.owned_nfts`), updating in-memory state, and immediately refreshing the backpack UI with live counts (`Polygon x2`).
  - **⚡ Instant Multicall3 Token Lookup in `activateVipPass`**:
    - Replaced the legacy 1000-step sequential `ownerOf(i)` loop in `activateVipPass()` with `getOwnedTokensDetailedFromChain()`, resolving the player's exact owned on-chain token IDs and metadata in a single fast Multicall3 roundtrip (<200ms) with 0 RPC rate limiting.
  - **🛡️ Reassuring User Cancellation Handling in MetaMask**:
    - Fixed exception handling when a player cancels/rejects a burn transaction in MetaMask (`err.code === 4001` / `'ACTION_REJECTED'`).
    - Now displays a reassuring toast (`"Transaction cancelled in wallet. Your VIP Pass remains safe in your backpack!"`) and immediately invokes `renderNftInventory()`, guaranteeing that unburned NFTs never disappear from the backpack view.
- **VIP Pass Secure RPC Activation & Arcade Daily Play Limit Admin Bypass (`v1.5.312`)**:
  - **👑 Resolved VIP Pass Activation Not Updating `users.vip_until`**:
    - Identified that `activateVipPass()` in `src/js/features/nft.js` attempted a direct client-side PostgREST update (`supabase.from('users').update({ vip_until: newVipUntil }).or(...)`).
    - PostgreSQL table `users` contains the security trigger `trg_prevent_direct_balance_mutation` (`prevent_direct_balance_mutation()`), which explicitly guards against browser DevTools tampering: when `CURRENT_USER IN ('anon', 'authenticated')`, any update to `vip_until` is silently reverted (`NEW.vip_until := OLD.vip_until`), leaving `vip_until` as `NULL`.
    - Created the `public.activate_vip_pass(p_player_id TEXT, p_pass_type TEXT)` stored procedure with `SECURITY DEFINER` privileges. Because it executes as `postgres`, it safely updates `users.vip_until` (+30 days or +365 days), consumes off-chain or on-chain passes from inventory, logs the activity, and is never blocked by the security trigger.
    - Updated `src/js/features/nft.js` to call `client.rpc('activate_vip_pass', ...)` with robust fallback client resolution, seamlessly updating `appState.state.vipUntil` and refreshing the backpack.
  - **🚀 Resolved AstroDodge Zero-Balance Payout on Desktop for Admin Players**:
    - Identified that in `end_arcade_session`, the function executed `SELECT COALESCE(global_earn_multiplier, 1.0) FROM global_settings`, but the database column is named `earn_multiplier`.
    - The missing column threw an error caught by `EXCEPTION WHEN OTHERS THEN`, resetting `v_max_daily_plays := 10`.
    - Once the admin completed 10 runs today while testing, subsequent sessions were rejected with `'Daily play limit reached (16/10)'` and `payout_pgt = 0`, while working for players on mobile who had only played 2 runs.
    - Fixed column lookup to `COALESCE(earn_multiplier, 1.0)`, defaulted fallback plays to 35, and added an **Admin and Ambassador bypass** (`IF NOT COALESCE(v_user.is_admin, false) AND NOT COALESCE(v_user.is_ambassador, false) THEN ... END IF;`) across both `start_arcade_session` and `end_arcade_session`.
    - Updated `db-sync.js`, `game.js`, `drift.js`, and `invaders.js` to return and handle `data.daily_limit_reached`, accurately showing `⚠️ Daily Limit • Rewards Paused` when the limit is reached instead of misleadingly displaying fake uncredited rewards.

- **Cyber Skeet Mobile 100% Fit & Wrapper Padding Elimination (`v1.5.311`)**:
  - **🛡️ Resolved Skeet Canvas Shrinking Inside Playable Window on Mobile**:
    - Identified that on mobile devices, `#container-skeet` inherits `.game-canvas-wrapper`, which had `.game-window-container.fullscreen-active .game-canvas-wrapper { padding-top: 68px !important; padding-bottom: 74px !important; }` and `.game-window-container.fullscreen-active canvas { width: auto !important; height: auto !important; object-fit: contain !important; }`.
    - These rules squeezed the canvas content box down to ~74px height and letterboxed the 16:9 canvas to a tiny 133px wide slice inside the 337px cyan/white rectangle container, creating massive black borders on all sides.
    - Excluded `#container-skeet` from `.fullscreen-active .game-canvas-wrapper` padding rules and excluded `canvas#skeet-canvas` from `object-fit: contain` and `width: auto` rules in `src/css/features/games.css`.
    - Enforced `padding: 0 !important; overflow: hidden !important; display: block !important;` on `#container-skeet`, and `width: 100% !important; height: 100% !important; object-fit: fill !important; padding: 0 !important; margin: 0 !important;` on `canvas#skeet-canvas`.
    - Updated `skeet.js` `resizeCanvas()` to explicitly enforce `parent.style.setProperty('padding', '0px', 'important')`, `parent.style.setProperty('overflow', 'hidden', 'important')`, and `this.canvas.style.setProperty('object-fit', 'fill', 'important')`. The Cyber Skeet gameplay window now fills 100% of the visible container with zero black margins or distortion.

- **Game Panel Display Restoration & Clean Inline Styling (`v1.5.310`)**:
  - **🛡️ Resolved Black Canvas / Missing Games Display**:
    - Identified that in `v1.5.309`, blanket `.game-panel-hidden * { display: none !important; }` CSS rules and inline `el.style.setProperty('display', 'none', 'important')` prevented active game panels (such as AstroDodge, Cyber Invaders, Cyber Drift, Cyber Stacker, etc.) from displaying their canvases and UI overlays when launched (`panel.style.display = 'flex'` cannot override inline `!important`).
    - Removed blanket `.game-panel-hidden *` rules from `src/css/features/games.css` and removed `class="game-panel-hidden"` from panels in `index.html`.
    - Updated `src/js/features/games.js` (`switchGameModeView` and `closeGameView`) to cleanly execute `el.style.removeProperty('display')` followed by standard `el.style.display = 'flex'` / `'block'`, completely eliminating stuck `!important` flags across all arcade and betting panels.
    - Scoped `#panel-game-skeet` fullscreen CSS rules strictly to `#panel-game-skeet:not([style*="display: none"]):not([style*="display:none"])`, and added `#panel-game-skeet[style*="display: none"] { display: none !important; }` ensuring Cyber Skeet remains 100% hidden when other games are in fullscreen mode without interfering with any other game's layout or elements.
