# PolyGame Context and Knowledge

**Tech Stack**:
- Vanilla HTML, CSS, JavaScript.
- Backend: Supabase (REST API). The project uses a `users` table to track player progression.
- Hosting: Designed for GitHub Pages (runs fully in-browser with a DB connection, no Node.js backend server).

**Architecture / State**:
- Frontend source of truth: `PolyState` class in `app.js` and `state.js`.
- **Account & Player ID Architecture**:
  - EVERY player in PolyGame (Web3 wallet, Google Auth, or Guest) has a **generated synthetic `player_id`** starting with `0xpgt...`, `0xg...`, or `0xguest...` (e.g. `0xpgt8312e02d...`, `0xg0761cd...`, `0xguest5382...`).
  - Web3 EVM wallet addresses are **ALWAYS** stored in **`linked_wallet_address`** across ALL login types (Google, Guest, or Web3 Wallet).
  - **CRITICAL**: Never assume `player_id` equals an EVM wallet address. All database RPCs and lookups must use `resolve_player_id(p_input)` to resolve input addresses to the row's `player_id`.
- Automatic Sync: When state mutates locally, `saveToDB()` is automatically called to `upsert` the data into Supabase (throttled by a 2-second batching timer).
- The UI contains many separate virtual "views" routed via `switchTab()` in `app.js`.

**Important Addresses & Credentials**:
- **Master Admin Wallet**: `0x10B9993990c9EF8a212c9557cB02aD94da9a654d` (connecting with this wallet unlocks a hidden Admin Panel).
- **Supabase URL**: `https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/`
- **NFT Contract (Polygon)**: `0x45D80Ea3a24978350ccC6A61A2d89B031435eCB8`
- **Official Discord Community**: `https://discord.gg/NgnxB3s9b`
- **Discord Webhooks**:
  - Main Game Announcer: `https://discord.com/api/webhooks/1529336801523667094/...`
  - Admin Security Sentinel: `https://discord.com/api/webhooks/1529701591303717005/...`
  - Official Announcements Channel: `https://discord.com/api/webhooks/1538643364931702847/K4gJrFehXPHjTbj26a2tBGcbDj_dtu1DAR447qOCeCtpNAA7FwWP9vmBnL6aFtUNELLc`

**Implemented Features & Hardening**:
- **Mobile Fullscreen HUD, Close Button & Aspect Ratio Realignment (`v1.5.013`)**:
  - Padded `.game-canvas-wrapper` in fullscreen mode (`padding-top: 68px`, `padding-bottom: 56px`) with `env(safe-area-inset)` to lower game views below the HUD and raise base platforms above bottom exit toasts and home navigation bars.
  - Re-anchored `.game-stats-hud` with dynamic right clearance (`right: calc(54px + safe-area)`) so the HUD never collides with or overlaps the red `✕` close button.
  - Updated Cyber Stacker canvas resize logic to preserve optimal 4:3 aspect ratio and dynamically adjust base foundation clearance.
- **Hardened Single Withdrawal Execution & Direct HTML Onclick Handler (`v1.5.012`)**:
  - Bound `#btn-execute-withdraw` directly to HTML `onclick="executeWithdrawPGT()"` and removed all redundant module import duplicates and `DOMContentLoaded` event listeners.
  - Upgraded re-entrancy lock to a global `window._isWithdrawExecuting` flag with complete `try...finally` lifecycle coverage to strictly enforce single execution.
- **Withdrawal Execution Deduplication & Re-entrancy Guard (`v1.5.011`)**:
  - Removed duplicate `addEventListener('click')` on `btn-execute-withdraw` across `app.js` and `withdraw.js`.
  - Added an atomic `isWithdrawInProgress` re-entrancy lock in `withdraw.js` to ensure single toast emission and prevent rapid double-clicks.
- **Withdrawal Module Import Fix (`v1.5.010`)**:
  - Corrected `supabase` client import in `src/js/features/withdraw.js` to source from `../core/config.js`.
- **Configurable `max_weekly_withdrawals` in Global Settings & Admin Panel (`v1.5.009`)**:
  - Added `max_weekly_withdrawals` (default 5) column to `global_settings` table in Supabase.
  - Added real-time control input in Master Admin Panel to adjust weekly withdrawal quota dynamically without code changes.
  - Synced `withdraw-pgt` edge function and client modals to respect dynamic `max_weekly_withdrawals`.
- **Dynamic 100k Withdrawal Limits & 5-Per-Week Rate Limiter (`v1.5.008`)**:
  - Removed hardcoded 20,000 PGT limit in `withdraw-pgt` Edge Function and bound single transaction limits directly to `global_settings.max_withdraw_pgt` (100,000 PGT).
  - Created `withdrawals_history` table and implemented a rolling 7-day rate limiter enforcing a maximum of 5 on-chain withdrawals per player across 7-day windows.
  - Added dynamic weekly quota badges and single transaction limit indicators to the Withdrawal Claim Modal (`src/js/features/withdraw.js`, `index.html`).
- **Profile Multiplier Scope Cleanup (`v1.5.007`)**:
  - Removed duplicate `isVip` / `isAmbassador` variable declaration in `src/js/features/profile.js`.
- **Profile Multiplier Synchronization & Whale Tier Integration (`v1.5.006`)**:
  - Fixed Profile Staking APY Boost to include VIP 2.0x multiplier (`3.62x NFT * 1.1x Ambassador * 2.0x VIP = 7.97x`).
  - Synced Profile Faucet Multiplier to incorporate the full Faucet Engine (`(1 + 110% [NFT + Streak + Referral]) * 1.15 [1FLR Whale] * 1.25 [PGT Staked Whale] * 1.10 [Onchain Whale] * 2.0 VIP * 2.0 Ambassador = 13.28x ~ 13.3x`).
- **Full 4.95x Referral Multiplier Engine & Profile Display Sync (`v1.5.005`)**:
  - Fixed Profile "Equipped Utility NFT Core" total active multiplier calculation in `src/js/features/profile.js` to correctly incorporate passive NFT referral multipliers (`1.65x * 2.0x VIP * 1.5x Ambassador = 4.95x`).
  - Added full server-side referral multiplier derivation (`get_user_referral_multiplier`) in `supabase/fix_referral_multipliers_and_ambassador.sql` so backend commission payouts multiply by the complete 4.95x bonus instead of just the 2x VIP check.
- **Unified Action Terminology & Ledger Normalization (`v1.5.004`)**:
  - Unified all Staking Vault yield payouts and harvest commissions to standard **`Staking Yield`** (eliminating the duplicate/confusing `Vault Yield` label).
- **Referral Ledger Username Resolution & Action Classifiers (`v1.5.003`)**:
  - Dynamically resolved custom usernames (when non-empty) for downline referral commission entries in `src/js/features/referrals.js` and `supabase/update_referral_commissions_usernames.sql`.
  - Added smart action classification (differentiating Faucet Claim from Staking Yield micro-harvests).
- **Referred Downline Activity & Earnings Stream (`v1.5.002`)**:
  - Upgraded Referred Downline Activity Ledger in `src/js/features/referrals.js` to stream live PGT commissions earned from 4-tier downlines (`L1..L4 (10%/5%/2%/1%)`, Player Name, Action e.g. Faucet Claim/Staking/Arcade, Timestamp, and `+PGT` payout).
  - Added dual-mode tab switcher (`💸 Earned Commissions` / `👥 Downline Members`) to view both real-time commission streams and full downline registration lists.
  - Made Past Weekly Winners Archive fully dynamic by removing hardcoded 50,000 PGT labels and calculating exact distributed pool totals per game and snapshot.
  - Removed legacy Cyber Catcher row from Admin Game Rules & Settings table.
- **Weekly Tournament Prize Distribution & Admin Score Reset Fix (`v1.5.001`)**:
  - Fixed an issue where the logged-in admin's weekly scores (e.g. Astro-Dodge 2,125) persisted in local memory and were re-saved to Supabase after weekly prize distribution.
  - Implemented `finalizeLeaderboardReset()` in `src/js/features/admin.js` to immediately clear pending `_dbSaveTimer` batches, reset local state weekly scores (`gameHighScore`, `invadersHighScore`, `driftHighScore`, `stackerHighScore`, `catcherHighScore`) to 0, zero out all high scores in Supabase, and refresh all 4 arcade leaderboards.
  - Added dedicated **🔄 Reset Leaderboards to 0 Now** manual button in the Admin Control Panel for instant zeroing of weekly leaderboards at any time.
- **Live Leaderboard Instant Monotonic Sync Engine (`v1.5.000`)**:
  - Re-engineered `submitHighScoreToDB()` in `src/js/core/db-sync.js` and arcade dispatchers (`stacker.js`, `drift.js`, `game.js`, `invaders.js`).
  - Resolved an issue where pre-updating local state prevented subsequent DB submissions from recognizing personal bests.
  - Implemented monotonic DB updates (`id`-keyed fallback matching + `GREATEST` server RPCs) and guaranteed real-time DOM leaderboard refresh across all arcade games.
- **Arcade High Score Monotonic Integrity Guard (`v1.4.499`)**:
  - Fixed an issue where Cyber Stacker and arcade games could submit lower run scores to Supabase and overwrite previous high scores.
  - Hardened `submitHighScoreToDB()` in `src/js/core/db-sync.js` and `stacker.js` to strictly enforce personal-best verification before invoking database updates.
  - Updated `submit_arcade_highscore` RPC in `supabase/highscore_rpc.sql` and `end_arcade_session` in `supabase/arcade_anti_cheat_sessions.sql` to include `catcher_highscore` / `stacker_highscore` wrapped in SQL `GREATEST(...)` so database leaderboard scores can never be downgraded.
- **Admin Referral Tree Self-Healing & Reconciliation Tool (`v1.4.498`)**:
  - Implemented `runReferralReconciliation()` in `src/js/features/admin.js` and PostgreSQL RPC `reconcile_referral_trees()` in `supabase/reconcile_referral_trees.sql`.
  - Audits all registered user rows with active `referred_by_l1` links, re-derives and heals broken upstream `referred_by_l2..l4` chains from parent data, and recalculates exact downline counters (`referrals_l1..l4`, `referrals_count`) for 100% data integrity.
  - Added dedicated **🛠️ Database Integrity & Referral Tree Self-Healing** card in the Master Admin Control Panel with atomic server-side RPC execution and resilient client-side batch fallback.
- **Player Profile Overhaul (`v1.4.497`)**:
  - Implemented 4-game Career & Arcade Scorecard Hub (Astro-Dodge, Cyber Invaders, Cyber Drift, Cyber Stacker) with weekly & all-time high scores.
  - Added PolySpace Fleet Operations stats (Fleet Power, Module Upgrades, Minerals Mined) and Daily Operations (Claims, Streak, Quests).
  - Integrated Web3 Wallet & Network Control Hub with 1-click Address Copy, PolygonScan Explorer link, and MetaMask token/NFT asset importers.
  - Implemented Equipped Utility NFT Booster Showcase with combined multiplier breakdown (Faucet, Arcade, Staking, Referrals) and direct Backpack navigation.
- **Cyber Stacker Physics Neon Tower (`v1.4.493` - `v1.4.496`)**:
  - Replaced Cyber Catcher with **Cyber Stacker** (`stacker.js`).
  - Features oscillating quantum crane, momentum inertia on release, multi-geometric blocks (wide titanium slabs, standard quantum cubes, narrow high-altitude pillars, asymmetric wedges, and golden quantum cores +5 PGT).
  - Realistic center-of-mass balance calculation, harmonic spring wobble & damping, over-tilt toppling mechanics, and structural collapse on critical tilt stress.
  - Ascending camera system through 3 visual atmospheres (Ground Cityscape -> Clouds & Lightning -> Cyberspace Orbit).
  - Canvas container hardened to `aspect-ratio: 4/3` and `min-height: 440px` with dynamic foundation platform anchoring at `y = height - 40px` for clear base visibility in inline and fullscreen modes.
- **Discord Announcements Integration (`v1.4.494`)**:
  - Added `sendDiscordAnnouncement()` in `src/js/utils/discord.js`.
  - Admin weekly tournament prize payouts broadcast directly to the dedicated **#announcements** webhook with per-game pool breakdowns and winner counts.
- **Dashboard UX Refinement (`v1.4.496`)**:
  - Positioned **🏆 Top Token Holders & Wealth Leaderboard** card right below the Welcome Hero Banner and above Daily Quests for direct 1-click access.
- **NFT Backpack Synchronization & Safety (`v1.4.301` - `v1.4.302`)**:
  - `db-sync.js` safely merges DB-stored in-game PGT NFTs with verified on-chain Polygon NFTs (`chainNfts`). In-game NFTs are never wiped on login or wallet connect.
  - On-chain scanner `getOwnedNftsFromChain()` in `roshambo.js` scans tokens 1–150 using `continue` exception handling so gaps or revert errors do not abort the scan.
  - `logoutUser()` explicitly cancels pending DB save timers (`clearTimeout(_dbSaveTimer)`) and sets `isSyncingWithDB = true` to block sending empty state payloads (`owned_nfts: []`) to Supabase during logout.
- **Cyber Drift Gameplay Overhaul (`v1.4.298` - `v1.4.299`)**:
  - Touch steering enabled in both inline and fullscreen canvas modes.
  - Mobile initial speed starts at smooth `5.0`. Speed accelerates continuously over time (`+1.2 KM/H` per 10s of survival, uncapped).
  - Live KM/H speedometer HUD indicator and `🔥 NEAR MISS! +50` floating bonus popups.
  - Mobile stats HUD overlay (`.game-stats-hud`) positioned at `top: 10px` so it never obstructs the player car at the bottom of the screen.
- **PolySpace Leaderboard Deduplication (`v1.4.303`)**:
  - `checkIsUserRow()` in `profile.js` compares `appState.state.playerId` against `row.player_id` and `row.linked_wallet_address` to accurately identify active user rows.
  - Fleet power leaderboard in `space.js` queries full user identity fields and deduplicates mapped records by identity to prevent duplicate rows.
- **8-Character Hex Referral Codes**:
  - Referral codes use 8-character hex strings (e.g. `ref_a8f92c1b`). Auto-generated on login if missing or `EMPTY`.
- **Staking System Overhaul & Race Condition Guard**: Implemented re-entrancy button locking on frontend staking controls, instant local state updates without flickering, and PostgreSQL atomic `FOR UPDATE` row locking + `SECURITY DEFINER` across all staking RPCs (`deposit_stake`, `unstake_position`, `unstake_all_matured`). Adjusted anti-cheat trigger `prevent_direct_balance_mutation()` to allow balance deductions while blocking balance inflation.
- **Mobile Bottom Navigation**: GPU hardware acceleration (`transform: translateZ(0)`), `z-index: 99999`, and safe-area inset padding (`env(safe-area-inset-bottom)`).
- "Guest Mode" for players without web3 wallets. State merges to the wallet upon connecting.
- Stealth Admin panel for the Master Wallet to view global metrics (TVL, active players, global token supply) and a full player database ledger.
- Live real-time Supabase Leaderboards for Arcade High Scores, Top Referrers, Top Token Holders, and PolySpace Fleet Power.

**Master Guidelines for AI Agents**:
1. **Version Increment & Release Protocol**: Current version is **`APP_VERSION = "1.5.001"`** in `src/js/core/config.js`. PolyGame uses 3-digit patch versioning (`1.4.001` -> `1.4.002` -> `1.4.999`) to allow 1,000 patch updates per minor version cycle before advancing to `1.5.000`. Whenever deploying a new site update or feature, increment `APP_VERSION`. This automatically triggers the **⚡ NEW UPDATE** badge for 5 seconds on players' first login/visit after that update, and syncs the permanent bottom-center version tag (`v1.5.001`).
2. **Database Script Notifications**: If any change requires running an RPC or SQL script in Supabase, notify the user explicitly at the start of your turn.
3. **Anti-Cheat Integrity**: Never include `balance_pgt` in client `saveToDB()` payloads; all balance mutations must go through `SECURITY DEFINER` database RPCs.

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
