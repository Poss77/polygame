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
1. **Version Increment & Release Protocol**: Current version is **`APP_VERSION = "1.5.342"`** in `src/js/core/config.js`. PolyGame uses 3-digit patch versioning (`1.4.001` -> `1.4.002` -> `1.4.999`) to allow 1,000 patch updates per minor version cycle before advancing to `1.5.000`. Whenever deploying a new site update or feature, increment `APP_VERSION`. This automatically triggers the **⚡ NEW UPDATE** badge for 5 seconds on players' first login/visit after that update, and syncs the permanent bottom-center version tag (`v1.5.342`).
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

- **Arcade Session Column Alignment & Stored Procedure Overload Purge (`v1.5.342`)**:
  - **🛡️ Resolved PostgreSQL 42703 `catcher_highscore` Undefined Column Error (`end_arcade_session`)**:
    - Identified and eliminated run-time exception `record "v_user" has no field "catcher_highscore"` that blocked arcade sessions from completing and awarding PGT.
    - Aligned Cyber Stacker high score recording strictly with verified schema columns `stacker_highscore` and `alltime_stacker_highscore`.
  - **⚡ PostgreSQL Overload Collision Purge & Single Canonical RPC (`end_arcade_session`)**:
    - Dropped all legacy overloaded signatures of `end_arcade_session` and established a single canonical 7-parameter procedure with default arguments, permanently eliminating `PGRST203: Could not choose the best candidate function between...` collisions.
    - Deduplicated `compute_weekly_active_tier` to a single `(BIGINT, BIGINT)` signature.
  - **🔍 Descriptive RPC Error Reporting (`db-sync.js`)**:
    - Enhanced error logging in `endArcadeSession` to output `error.message` and `error.code` directly for rapid debugging.

- **Standalone Admin Portal Auth Fix & Cross-View DOM Safety Guards (`v1.5.341`)**:
  - **⚡ Admin Portal Uncaught Module Exception Resolution (`admin.html`)**:
    - Fixed issue where `admin.html` remained indefinitely on "Checking Wallet..." caused by uncaught module initialization exceptions.
    - Added instant synchronous detection for `window.ethereum.selectedAddress` and sanitized fallback address resolution to ignore guest sessions (`0xguest...`).
  - **🛡️ Cross-View DOM Isolation & Null Safety (`state.js`, `referrals.js`, `staking.js`)**:
    - Guarded `PolyState.syncUI()` to early-exit when running outside the main game portal (`!document.getElementById('view-dashboard')`), preventing DOM lookup crashes on standalone pages (`admin.html`, `contact.html`).
    - Added null checks on `document.getElementById('btn-copy-ref-link')` in `referrals.js` and `staking-wallet-max` / `staking-fill-half` in `staking.js`.
    - Protected `getAppState()` in `db-sync.js` against ES module Temporal Dead Zone (TDZ) reference errors during circular imports.

- **Dedicated Standalone Master Admin Portal & Arcade Velocity Anti-Cheat (`v1.5.340`)**:
  - **🏛️ Dedicated Standalone Operations Portal (`admin.html`)**:
    - Decoupled the ~713-line Master Admin Control Panel from `index.html` into a dedicated, isolated `admin.html` page.
    - Reduced `index.html` size by 65 KB and eliminated the ~162 KB `admin.js` bundle from the main player application payload, significantly boosting initial page load speeds on mobile and desktop.
    - Obfuscates administrative operational tools, treasury management, prize distributions, and Discord webhook configurations from public client inspection.
    - Implemented cryptographic Web3 barrier in `admin.html` requiring active wallet connection matching the immutable Master Admin address (`0x10B9993990c9EF8a212c9557cB02aD94da9a654d`).
    - Added one-click launch from the player Profile Admin Card (`profile-admin-card`) and global navigation fallback routing.
  - **🛡️ Arcade Bonus Items & Velocity Clamping Anti-Cheat Seal (`end_arcade_session`)**:
    - Sealed exploit vector identified by QA bot security audit where malicious clients could submit arbitrary `p_bonus_items` counts during ultra-fast sessions (e.g. 500 items in 0.3s awarding unearned 56.97 PGT).
    - Hardened PostgreSQL `end_arcade_session` stored procedure (`supabase/seal_arcade_bonus_items_and_velocity_clamp.sql`):
      - Clamps `p_bonus_items` relative to elapsed session duration: `LEAST(v_clamped_items, (v_duration_seconds * 1) + 2)`.
      - Clamps `p_bonus_tokens` relative to session duration: `LEAST(5, v_duration_seconds / 30)`.
      - Enforces strict cap on ultra-fast sessions (< 3 seconds) to a maximum payout of 1.00 PGT regardless of submitted scores.
      - Enforces a sitewide maximum velocity ceiling of 0.35 PGT/sec (up to the standard 50.00 PGT maximum).

- **Universal Supabase Client Global & QA Bot Test Engine Hardening (`v1.5.339`)**:
  - **⚡ Universal `window.supabase` Active Client Exposer (`config.js`)**:
    - Bound `window.supabase = supabase` upon client initialization in `src/js/core/config.js`.
    - Guarantees that whether code references `window.supabaseClient` or `window.supabase` (such as in browser console, external extensions, or test runners), it always accesses the active client instance equipped with `.from()` and `.rpc()`, resolving any `window.supabase.from is not a function` collisions with the Supabase CDN constructor.
  - **🤖 Complete Multi-Game & Wager QA Bot Automation**:
    - Hardened test runner and suites (`suite_03_faucet.py`, `suite_04_arcade_games.py`, `suite_05_casino_wagers.py`, `suite_06_polyspace_boss.py`, `suite_07_staking_vault.py`, `suite_09_referrals.py`, `suite_11_anticheat_defenses.py`) with universal fallback resolution `window.supabaseClient || window.supabase`.
    - Fixed initial test account balance synchronization (resolving the 0.00 PGT state by clearing fake `authUserId` query mismatch).
    - Integrated automated in-game captcha solver for non-VIP faucet testing, 3 arcade game runs (Astro-Dodge, Cyber Invaders, Cyber Drift) with database balance ledger verification, daily quest claim (+10 PGT), and 2 live casino wagers (Roshambo and Lucky Spinner) with 100% database delta validation.

- **Quantum Relics & NFT Backpack Master Anti-Cheat Seal (`v1.5.338`)**:
  - **🛡️ Full Immutability on Relics, NFTs & Crate Passes (`prevent_direct_balance_mutation`)**:
    - Hardened master anti-cheat trigger so direct PostgREST client queries (`anon` and `authenticated`) can never modify, wipe, or inject into `users.relics`, `users.owned_nfts`, or `users.crate_nfts`.
    - Completely eliminates client-side tampering where fabricated utility NFTs, VIP passes, or unminted relics could be inserted directly via browser DevTools or automated scripts.
  - **⚡ Canonical On-Chain NFT Sync Procedure (`sync_onchain_nfts`)**:
    - Deployed `SECURITY DEFINER` stored procedure `sync_onchain_nfts(p_player_id, p_chain_nfts)` that executes authoritatively as `postgres`, mirroring `sync_onchain_relics`.
    - Updated `src/js/core/db-sync.js` to route on-chain NFT syncs from Polygon through the atomic RPC with guarded fallback.
  - **🧹 QA Bot Account Ledger Reset**:
    - Sanitized `0xqa_test_bot_001` in `supabase/seal_master_anti_cheat_trigger.sql` and `tools/qa-bot/setup_qa_account.sql`, completely purging pre-existing fake relics (`relic_apex_genesis`), test NFTs (`nft_legendary_king`), and passes (`nft_vip_pass_yearly`).
    - Upgraded Suite 11 probes with dynamic baseline delta and canary assertions (`afterGenesis > beforeGenesis`, canary token check) to ensure 100% exploit detection with zero false positives.

- **Referral, Staking & POL Commission Anti-Cheat Seal (`v1.5.337`)**:
  - **🛡️ Public Revocation on `process_referral_commissions` (Fix #1)**:
    - Revoked all public and anonymous `EXECUTE` privileges on `public.process_referral_commissions`.
    - Function is restricted exclusively to `service_role` and trusted internal `SECURITY DEFINER` procedures (`end_arcade_session`, `claim_faucet`, `claim_polyspace_expedition`, `unstake_position`, `harvest_yield`, `unstake_all_matured`).
    - Completely prevents malicious scripts from crafting fake referral payouts to mint unearned PGT into upline accounts.
    - Cleaned up redundant client-side JavaScript dispatches in `src/js/features/staking.js` and `src/js/core/db-sync.js`.
  - **⚡ Canonical Secure Staking RPCs (Fix #2)**:
    - **Position Theft Seal (`unstake_position`)**: Enforced strict caller ownership validation against `users.player_id` and `linked_wallet_address`. Siphoning other players' deposits and yields by guessing or querying public `user_stakes` IDs is permanently blocked.
    - **Authoritative Server-Side APYs & Lock Timers (`deposit_stake`)**: Eliminates client-supplied APY parameters. Server authoritatively calculates APYs (`day` 1.0%, `month` 2.0%, `year` 3.0%), checks verified VIP (2.0x), Ambassador (1.10x), and Staking Vault Core NFTs (+15%, +50%, +100%) directly from database rows, enforcing a hard 50.0% APY ceiling and authentic lock periods (`INTERVAL '1 day'`, `'30 days'`, `'365 days'`).
    - **Lock Expiration Enforcement**: `unstake_position` strictly rejects early unstaking before `lock_until`.
    - **Atomic Harvest & Internal Commission Dispatch**: Re-deployed `harvest_yield`, `unstake_all_matured`, and `harvest_all_yield` with caller ownership checks, accurate elapsed yield math, and automatic internal referral commission processing.
    - **Admin-Only Fast Forward**: Restricted `fast_forward_staking_locks` exclusively to Master Admin (`0x10B9993990c9EF8a212c9557cB02aD94da9a654d`).
  - **💎 Verifiable On-Chain POL Referral Commissions (Fix #3)**:
    - Deployed `public.pol_referral_commissions` table with `tx_hash PRIMARY KEY` to guarantee 100% replay protection for NFT referral commissions.
    - Hardened `credit_nft_referral_commission` to validate 66-character EVM transaction hashes (`^0x[a-f0-9]{64}$`), clamp POL prices to legitimate NFT catalog limits (0.1–500 POL), verify upline assignees, and prevent self-referrals.
    - Recorded transaction hashes in referrers' `referrals_list` for direct verification on Polygonscan before manual payouts.
    - Updated `src/js/features/nft.js` to pass `p_tx_hash: tx.hash`.

- **World Boss Deterministic Combat & Space Minerals Anti-Cheat Sentinel (`v1.5.336`)**:
  - **🛡️ Server-Side Deterministic World Boss Strikes (`strike_world_boss`)**:
    - Eliminated client-supplied damage vulnerability in the Cosmic World Boss raid. Replaced unverified `p_damage` parameter with 100% deterministic server-side combat calculations in PostgreSQL.
    - Server reads the attacker's verified `fleetPower` and `laserLevel`, calculating strike damage `(fleetPower * 12) * (0.90 + random() * 0.35)` and critical strikes (`1.85x` multiplier, `10% + laserLevel * 2.5%` chance, max 50%) inside the atomic stored procedure.
    - Employs pessimistic row locking (`FOR UPDATE`) on `public.users` to prevent concurrent multi-window crystal spending.
    - Returns authoritative damage, critical hit counts, crystal deductions, and global boss HP in the JSON response.
  - **🛡️ Space Minerals Anti-Cheat Trigger Shield (`prevent_direct_balance_mutation`)**:
    - Upgraded master database trigger to monitor direct PostgREST client updates (`anon` and `authenticated`) to `users.space_state`.
    - Automatically blocks and reverts any client attempt to increase raw mineral balances (`iron`, `titanium`, `quantum`, `pgtOre`) beyond existing database values.
    - Clamps starting minerals for new account registration to baseline defaults (50 Iron, 10 Titanium, 0 Quantum, 0 PgtOre).
  - **⚡ Canonical Atomic Ore Refinery RPC (`smelt_space_ore`)**:
    - Deployed `SECURITY DEFINER` stored procedure for the Planetary Ore Refinery.
    - Atomically verifies mineral balances, deducts raw inputs, and credits refined outputs server-side across all recipes (1,000 Titanium -> 300 Quantum, 10,000 Titanium -> 3,000 Quantum, 1,500 Iron -> 400 Titanium, 15,000 Iron -> 4,000 Titanium, 5,000 Quantum -> 2 Rare PGT Ore).
  - **⚡ Canonical Atomic Deep Space Anomaly Scanner RPC (`scan_polyspace_anomaly`)**:
    - Deployed `SECURITY DEFINER` stored procedure to enforce the 6-hour anomaly cooldown strictly on the database.
    - Deterministically rolls anomaly rewards (Temporal Wormhole expedition time reductions, ghost ship salvages, cosmic resource showers) on PostgreSQL.
  - **⚡ Server-Side Outpost Poke & Raid Mineral Crediting (`credit_arcade_payout`)**:
    - Updated `credit_arcade_payout` to award Allied Outpost Poke iron bonuses (`20 * warpLevel`) and Outpost Raid stolen minerals (+25-50 iron, +5-10 titanium) directly on PostgreSQL within existing 1/day cooldown limits.
  - **🚀 PolySpace Engine & State Integration (`space.js` & `db-sync.js`)**:
    - Updated `attackWorldBoss()` to trigger instant laser SFX, invoke `strike_world_boss`, and display authoritative damage numbers and critical hits returned from the database.
    - Updated `smeltOre()`, `scanAnomaly()`, `pokeFriendlyBase()`, and `launchRaid()` to interface seamlessly with the new server-side RPCs.
    - Updated `creditArcadePayout()` in `db-sync.js` to automatically sync returned `space_state` into the global application state.

- **PolySpace Module Anti-Cheat Shield & Atomic Upgrade RPC (`v1.5.335`)**:
  - **🛡️ Master Anti-Cheat Trigger Shield on PolySpace Modules (`prevent_direct_balance_mutation`)**:
    - Hardened the database trigger to monitor direct client PostgREST updates to `users.space_state`.
    - Automatically blocks and reverts any client attempt (`anon` or `authenticated`) to increase `warpLevel`, `laserLevel`, `cargoLevel`, `shieldLevel`, or `turretLevel` above existing values in the database.
    - Locks `fleetPower` to deterministic server-side calculation: `(warp * 100) + (laser * 80) + (cargo * 50) + (shield * 60) + (turret * 90)`.
  - **⚡ Canonical Atomic Module Upgrade RPC (`upgrade_polyspace_module`)**:
    - Transitions module upgrades to an atomic `SECURITY DEFINER` stored procedure with `FOR UPDATE` pessimistic row locking.
    - Validates module upgrade costs server-side based on canonical formulas (`costIron = FLOOR(40 * 1.22^(lvl-1))`, `costTit = FLOOR(10 * 1.22^(lvl-1))`, `costPgt = FLOOR(50 * 1.22^(lvl-1))`).
    - Atomically verifies and deducts Iron, Titanium, and PGT balance in one transaction before incrementing the level.
  - **👑 Calibrated CRiMiNeL Fleet Power**:
    - Synchronized CRiMiNeL's Fleet Power to **2,780** (Warp 12, Laser 11, Cargo 11) to accurately match upgraded levels on the Fleet Power leaderboard.

- **Atomic PolySpace Mission Claim & Anti-Cheat Sentinel (`v1.5.334`)**:
  - **🛡️ Atomic Server-Side PolySpace Claim RPC (`claim_polyspace_expedition`)**:
    - Eliminated race conditions and double-claim exploits across multiple open browser windows by transitioning expedition claims to an atomic PostgreSQL `SECURITY DEFINER` procedure (`claim_polyspace_expedition`).
    - Uses pessimistic row locking (`FOR UPDATE`) on `public.users` to serialize all concurrent claim attempts; any secondary window attempting to claim the same mission is rejected.
    - Validates expedition completion timestamps against server `NOW()`, blocking malicious scripts from claiming in-progress or spoofed missions.
    - Computes mineral rewards, Rare PGT Ore, and PGT payouts deterministically on the server based on verified `cargoLevel` and `laserLevel`.
  - **⚡ Expanded Mining PGT Economy Limit (Up to 3,500 PGT)**:
    - Expanded single-transaction mining claim limit from 150 PGT to **3,500 PGT** to support late-game progression (Laser Lvl 25–100), 7-Day Odyssey missions with 3x Critical Success (~469–866+ PGT), and "Claim All" multi-ship fleet batch payouts (1,000–2,500+ PGT).
  - **🔒 Hardened `credit_arcade_payout` RPC**:
    - Blocked direct client-side `credit_arcade_payout` calls with `'PolySpace Mining'`, routing all mining earnings through the atomic procedure.
    - Enforced strict server-side calendar day cooldowns for Allied Outpost Pokes (max 25 PGT, 1/day) and Outpost Raids (max 35 PGT, 1/day).

- **Cyber Stacker Mobile Fullscreen Tap-to-Drop Anywhere (`v1.5.332`)**:
  - **📱 Fullscreen Viewport Tap-to-Drop**:
    - Resolved mobile ergonomic constraint in Cyber Stacker: players can now tap anywhere outside the 4:3 canvas (letterbox margins, side black bars, bottom screen space) to release blocks during active gameplay in fullscreen mode.
    - Added safeguards preventing drops when tapping overlay screens, the top stats HUD, or buttons (such as the Fullscreen Exit button).
    - Added `cursor: pointer;` and `-webkit-tap-highlight-color: transparent;` on `#panel-game-stacker` in `games.css`.

- **Main Sidebar Navigation Streamlining (`v1.5.331`)**:
  - **🧹 Clean Primary Menu Presentation**:
    - Removed redundant Contact item from sidebar `<nav class="nav-menu">`, keeping desktop sidebar clean and focused strictly on core Web3 gaming & account progression hubs.
    - Full contact and official support access preserved permanently via the Global Footer link (`📬 Contact & Support`), ecosystem directory (`#view-links`), and static landing page ([`contact.html`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/contact.html)).

- **Prune-Proof Career Arcade Plays Architecture (`v1.5.330`)**:
  - **🎮 Permanent `users.total_arcade_plays` Architecture**:
    - Added `total_arcade_plays` column to `public.users` with automatic historical backfill from `arcade_sessions`.
    - Pruning old completed/expired game sessions from `arcade_sessions` can now be safely executed anytime without reducing or altering the Sitewide Arcade Plays counter on the dashboard banner.
  - **⚡ Server-Side Atomic Increment & Optimistic UI**:
    - Updated `start_arcade_session` PostgreSQL RPC to increment `users.total_arcade_plays` on every game run.
    - Updated `db-sync.js` to optimistically increment the local state on start session for instant 0ms latency.
  - **🛡️ PostgreSQL Anti-Cheat Immutability**:
    - Extended `prevent_direct_balance_mutation` trigger so `total_arcade_plays` cannot be tampered with or overwritten by client-side `saveToDB()` calls.
  - **📊 Profile & Dashboard Integration**:
    - Added Career Arcade Plays badge (`#profile-total-arcade-plays`) to the Arcade & Career Operations Hub on the player profile.
    - Updated `loadSitewideStats()` to read from `users.total_arcade_plays` with graceful fallback to `arcade_sessions` row count.

- **Official Contact & Support Hub Page (`v1.5.329`)**:
  - **📬 Integrated Virtual Contact Page (`#view-contact`)**:
    - Deployed dedicated Contact & Support Hub (`#view-contact`) with direct Discord Community (`https://discord.gg/kuyUXNWf3`) and founder email (`pascaldufour@gmail.com`) channels.
    - Added one-click copy actions with instant toast feedback and self-service documentation shortcuts.
  - **🌐 Global Navigation & Standalone Access**:
    - Added Contact item in desktop sidebar, permanent Global Footer link, and standalone [`contact.html`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/contact.html) page.

- **Direct Level-1 (L1) Faucet Referral Bonus Calibration (`v1.5.328`)**:
  - **👥 Strict Level 1 Referral Bonus Scoping**:
    - Calibrated the daily Faucet Referral Bonus in `PolyState.calculateMultipliers()` (`src/js/core/state.js`) to strictly evaluate direct Level 1 referrals (`this.state.referralsL1`) instead of total multi-tier downlines (`this.state.referralsCount`).
    - Maintains the established +1% per referral scaling up to 20% (+1%/L1 ref up to 20 L1 referrals) and the +30% master milestone at 100 direct L1 referrals.
  - **📊 Faucet UI & Progress Bar Precision**:
    - Updated Faucet progress bar tracker (`#faucet-ref-progress-fill`) and count/milestone badges to display `X / 20 L1 Referrals`, `X / 100 L1 Referrals`, and `X L1 Referrals`.
    - Updated multiplier label in `index.html` to `👥 L1 Referral Bonus` for explicit clarity and transparency across the interface.

- **Quantum Relics Recovery & Anti-Wipe Sentinel Shield (`v1.5.327`)**:
  - **💎 Poss Quantum Relics Full Inventory Restoration**:
    - Reconstructed and restored test account Poss's (`0xpgt8312e02d37185b5983e6922d1dae1cce`) full inventory of **110 on-site (unminted) Quantum Relics** across all **17 Serie 1 types**, unlocking the permanent 1.5x Apex Multiplier.
    - Verified all 5 on-chain minted NFTs on Polygon (tokens `#2`, `#37`, `#38`, `#40`, `#41`) for a total inventory of **115 Quantum Relics**.
  - **🛡️ PostgreSQL Anti-Wipe Trigger Shield (`prevent_direct_balance_mutation`)**:
    - Upgraded the master anti-cheat database trigger to inspect direct PostgREST client updates to `users.relics`.
    - Automatically rejects and reverts any client attempt (`anon` or `authenticated`) to delete keys or decrease `unminted` relic quantities below what is already recorded in the database.
  - **⚡ Atomic On-Chain Relic Sync Stored Procedure (`sync_onchain_relics`)**:
    - Deployed `SECURITY DEFINER` procedure that accepts verified on-chain tokens from Polygon and acquires a row lock `FOR UPDATE`.
    - Strictly preserves 100% of unminted in-game relics while accurately updating on-chain token counts and token IDs.
  - **🔧 Frontend Deep-Merge Hardening (`db-sync.js`)**:
    - Hardened background on-chain scan in `src/js/core/db-sync.js` to deep-merge existing database relics with local `appState.state.relics`.
    - Routes cloud updates through `sync_onchain_relics` RPC with guarded fallback, ensuring temporary account glitches or background refreshes can never drop unminted relics.

- **Cloudflare Turnstile Anti-Bot Withdrawal Sentinel (`v1.5.321`)**:
  - **🛡️ Integrated Cloudflare Turnstile Human Verification on On-Chain Withdrawals**:
    - Added Cloudflare Turnstile anti-bot verification directly into `#modal-withdraw` and the `withdraw-pgt` Supabase Edge Function.
    - Automated bots, headless curl/python scripts, and multi-account sybil swarms are immediately rejected at the Edge gateway if they attempt to request smart contract vouchers without solving the Turnstile challenge.
  - **⚡ Front-to-Back Turnstile Lifecycle Protection**:
    - Dynamic rendering and token validation in `src/js/features/withdraw.js`: widgets automatically render upon opening `#modal-withdraw` and reset immediately after claim attempts to prevent token replay attacks.
    - Server-side verification: `withdraw-pgt` validates tokens directly with Cloudflare's `siteverify` endpoint using `TURNSTILE_SECRET_KEY`.
    - Configured default universal test keys (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`) for instant testing, easily customizable with production Cloudflare credentials in `config.js` and Supabase secrets.

- **Atomic On-Chain Withdrawal Quota Sentinel & History Schema Seal (`v1.5.320`)**:
  - **🛡️ Diagnosed & Sealed Withdrawal Rate Limit Bypass**:
    - Identified that while `withdraw-pgt` enforced a 5-withdrawals-per-week quota, the `withdrawals_history` table was missing the `ip_address` column.
    - Every background insert call `supabase.from('withdrawals_history').insert({...})` failed with PostgreSQL error `42703 (column ip_address does not exist)`.
    - Because the failed insert was unhandled in the Edge Function, `withdrawals_history` remained empty, causing subsequent queries for `recentCount` to return `0`, completely circumventing the weekly withdrawal cap.
    - User Nower was able to request 195 vouchers of 25,000 PGT each and mint 4,875,000 PGT on Polygon before swapping 3.7M PGT on QuickSwap for 142.8 POL.
  - **⚡ Implemented Atomic `request_withdrawal_voucher` Database Stored Procedure**:
    - Replaced multi-step disconnected Edge Function database operations with a single atomic PostgreSQL `SECURITY DEFINER` transaction (`request_withdrawal_voucher`).
    - Uses `FOR UPDATE` pessimistic row locking on the player profile, preventing concurrent race attacks.
    - Evaluates ban status, 7-day account age quarantine, and rolling 7-day quota across `player_id`, `wallet_address`, and `ip_address`.
    - Atomically verifies and deducts `balance_pgt`, writes the audit record to `withdrawals_history`, and logs to `user_ips` in a single transaction.
    - Provided `cancel_withdrawal_voucher` procedure for automatic balance refund if voucher signing or network errors occur.
  - **💰 Protocol Fee Capture from Attacker Claims**:
    - Confirmed that each of the 195 on-chain `claimTokens` calls deposited 0.5 POL directly into the PGT Token Contract (`0x701100D19b1a93672cfe7291EA455b4220631209`).
    - The contract has collected **95.0 POL** from Nower's claims, which the Master Admin can sweep directly to the admin treasury wallet using `withdrawTokenTreasury()`.
  - **📜 Prepared Database Hardening Script**:
    - Delivered `supabase/fix_and_harden_withdrawals_atomic.sql` adding `ip_address`, `nonce`, and `amount` columns to `withdrawals_history`, creating optimized quota indexes, deploying the atomic procedures, and configuring strict RLS policies.

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
