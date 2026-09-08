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
1. **Version Increment & Release Protocol**: Current version is **`APP_VERSION = "1.5.319"`** in `src/js/core/config.js`. PolyGame uses 3-digit patch versioning (`1.4.001` -> `1.4.002` -> `1.4.999`) to allow 1,000 patch updates per minor version cycle before advancing to `1.5.000`. Whenever deploying a new site update or feature, increment `APP_VERSION`. This automatically triggers the **⚡ NEW UPDATE** badge for 5 seconds on players' first login/visit after that update, and syncs the permanent bottom-center version tag (`v1.5.319`).
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

- **Faucet Cooldown Exploit Seal & Master Anti-Cheat Trigger Shield (`v1.5.319`)**:
  - **🛡️ Diagnosed & Sealed Faucet Cooldown Wiping Vulnerability**:
    - Identified that user `Nower` (`0xpgt31ab923c`) and sybil accounts from IP `160.19.227.122` executed 21,196 automated faucet claims by exploiting a gap in `prevent_direct_balance_mutation`: while `balance_pgt` was protected, `last_faucet_claim` was omitted from the immutability trigger list.
    - Attackers sent `UPDATE users SET last_faucet_claim = NULL` directly via PostgREST to wipe their cooldown, immediately followed by calling `claim_faucet()`, minting 2.6M+ PGT across two accounts (`0xpgt31ab923c` and `0xpgtab1cb35b97cc`).
    - Upgraded `prevent_direct_balance_mutation` to make `last_faucet_claim`, `last_vip_faucet_claim`, `faucet_streak`, `vip_faucet_streak`, `total_earned`, referral claims, and tournament scores 100% immutable to direct client updates.
    - Added multi-layer safety rails inside `claim_faucet()` and `claim_vip_faucet()` enforcing a strict hard limit of 10 claims per rolling week and banning suspended accounts.
    - Prepared canonical SQL sanitization script `supabase/seal_faucet_cooldown_exploit_and_sanitize_nower.sql` to zero out attacker balances, ban associated sybil accounts, and update database security triggers.
    - Hardened `withdraw-pgt` Edge Function and client faucet handlers to immediately block suspended (`is_banned`) accounts.

- **NFT Market Staking Yield Core Rarity Tier Fix (`v1.5.318`)**:
  - **🏷️ Resolved Inverted Rarity Badge on Staking Yield Cores**:
    - Identified that `nft_yield_vault` (50 POL, +15% APY) was mistakenly registered with `rarity: 'epic'` instead of `rarity: 'common'` in `src/js/features/nft.js`.
    - Because `nft_yield_vault_rare` (150 POL, +50% APY) had `rarity: 'rare'` and `nft_yield_vault_epic` (300 POL, +100% APY) had `rarity: 'epic'`, the marketplace displayed an inverted hierarchy where the 150 POL Rare core appeared more expensive than the 50 POL core labeled Epic.
    - Updated `nft_yield_vault` to `rarity: 'common'`, aligning the visual badges with on-chain metadata (`metadata/nft_yield_vault.json` Tier: "Common"), smart contract pricing (50 POL -> 150 POL -> 300 POL), and naming conventions ("Yield Vault Core" -> "Rare Yield Vault Core" -> "Epic Yield Vault Core").

- **Universal Daily Play Limit Enforcement (`v1.5.317`)**:
  - **🕹️ Strict Daily Play Limits for All Accounts**:
    - Removed the Admin and Ambassador daily play limit bypass (`IF NOT COALESCE(v_user.is_admin, false) AND NOT COALESCE(v_user.is_ambassador, false) THEN`) from database procedures `start_arcade_session` and `end_arcade_session`.
    - Every player, regardless of role (Admin, Ambassador, VIP, or standard user), is now strictly capped at `max_daily_plays_per_game` (default: 35 plays per game per 24-hour rolling window).
    - Once the 35-play limit is reached, further games show the standard warning badge (`⚠️ Daily Limit • Rewards Paused`) with 0 PGT rewards while still allowing players to practice and compete for high scores.

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
