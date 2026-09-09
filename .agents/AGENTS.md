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
1. **Version Increment & Release Protocol**: Current version is **`APP_VERSION = "1.5.332"`** in `src/js/core/config.js`. PolyGame uses 3-digit patch versioning (`1.4.001` -> `1.4.002` -> `1.4.999`) to allow 1,000 patch updates per minor version cycle before advancing to `1.5.000`. Whenever deploying a new site update or feature, increment `APP_VERSION`. This automatically triggers the **⚡ NEW UPDATE** badge for 5 seconds on players' first login/visit after that update, and syncs the permanent bottom-center version tag (`v1.5.332`).
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
