# Polygon Gaming — Historical Changelog (v1.4.298 to v1.4.499)

Archived historical release notes for v1.4 releases.
Active changelog is maintained in [CHANGELOG.md](../../CHANGELOG.md).

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

