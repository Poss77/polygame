# PLAN-005: Comprehensive QA Automation & Platform Testing Bot

## Status: IN PROGRESS / EXPANDED FULL COVERAGE

---

## 1. Executive Summary & Objective

Build an **all-inclusive automated QA Testing Bot** in `tools/qa-bot/` that systematically verifies every single system, game engine, database RPC, balance calculation, multiplier, and security defense across the Polygon Gaming platform.

The bot operates in two modes:
1. **Visual Mode**: Opens Google Chrome or Microsoft Edge so you can visually watch the bot navigate, click, play games, roll dice, and claim rewards in real time.
2. **Headless Fast Mode**: Runs silently in the background at high speed, completing all test suites and outputting a comprehensive terminal diagnostic report in ~25–30 seconds.

---

## 2. Privacy, Safety & Clean Architecture

- **Isolated Workspace**: Stored in `tools/qa-bot/` within this repository.
- **Git Hygiene**: Local test session tokens, temporary screenshots, and diagnostic reports are placed in `tools/qa-bot/reports/` and excluded via `.gitignore`.
- **Dual Target Capability**: Can test either the live production site (`https://polygongaming.io`) or a local development server (`http://localhost:8080`).

---

## 3. Technology Stack

- **Runtime**: Python 3.14
- **Automation Driver**: `playwright` (Python) connecting directly to installed Chrome/Edge binaries
- **Formatting**: `colorama` for clean ANSI color-coded terminal reports
- **1-Click Launcher**: `tools/qa-bot/run_bot.bat` (and root `run_qa.bat` shortcut)

---

## 4. Master Test Matrix (11 Comprehensive Suites)

### 🖥️ Suite 1: Navigation, Routing & Global Viewport Health
- Tests programmatic and click navigation across all 11 virtual views:
  `#view-dashboard`, `#view-faucet`, `#view-games`, `#view-space`, `#view-nft`, `#view-vault`, `#view-staking`, `#view-referrals`, `#view-profile`, `#view-holders`, `#view-links`, `#view-contact`.
- Audits top stats HUD, live circulating PGT supply ticker, sidebar state, audio toggle, and footer links.
- Tests open/close lifecycle on `#modal-withdraw`, `#modal-vip-pass`, and `#modal-profile-edit`.

### 👤 Suite 2: Authentication, Profile & Identity Architecture
- Tests Guest session creation and synthetic `player_id` generation (`0xpgt...`, `0xg...`, `0xguest...`).
- Verifies separation between `player_id` and Web3 EVM `linked_wallet_address`.
- Audits Profile page progression metrics (Career Arcade Plays, Highscores, Ambassador Badge, Staked Balance).

### 🚰 Suite 3: Daily PGT & VIP Faucet Claim Engine
- Audits multiplier calculation formulas:
  - Faucet Streak bonus (+2%/day up to 10%)
  - L1 Referral bonus (+1%/L1 ref up to 20%, +30% at 100 L1 refs)
  - 1FLR holding tier (+15% at 5M 1FLR)
  - Staked PGT tier (+25% at 1M staked)
  - Onchain PGT tier (+10% at 1M onchain)
  - Serie 1 Apex Relics (+50%)
  - VIP Status (2.0x) & Ambassador (2.0x)
- Executes claim via `claim_faucet`, verifies balance increase, streak increment, and 24h countdown.
- Validates immediate duplicate claim rejection ("Faucet on cooldown").

### 🕹️ Suite 4: Complete Arcade Games Engine & PGT Payout Math (All 6 Titles)
- Runs real automated sessions across all 6 arcade titles:
  1. **AstroDodge**: Session lifecycle, movement, score submission, HUD formula verification `((score / 2500) + (shards * 0.05)) * mult`.
  2. **Cyber Invaders**: Alien waves, laser fire, payout formula verification `((score / 2000) + (aliens * 0.04)) * mult`.
  3. **Cyber Drift**: Neon track progression, orb pickups, speed score calculation.
  4. **Cyber Stacker**: Block releases, tower height, payout formula verification `((floors * 0.45) + (score / 1500)) * mult`.
  5. **Cyber Skeet**: Clay target shooting, reaction accuracy, score math.
  6. **Cyber Defense**: Base defense waves, turret fire, score math.
- **Strict PGT Payout Delta Audit**: Asserts `new_balance == old_balance + payout_pgt` across all sessions.

### 🎲 Suite 5: Casino & Wagering Integrity Engine (All 5 Titles)
- Minimum-bet rounds across all 5 betting titles:
  1. **Cyber-Crash**: Place bet, monitor multiplier curve, execute cashout, verify payout credit.
  2. **Neon Plinko**: Ball drop physics, destination pin multiplier, balance update.
  3. **Lucky Spinner**: Wheel spin, slice prize odds, balance update.
  4. **Roshambo**: RPS choice selection, AI reveal, win/draw/loss payout logic.
  5. **Cyber Mines**: Grid configuration, diamond reveal, cashout payout formula.
- **Underflow Guard**: Verifies wagers exceeding current balance are rejected.

### 🚀 Suite 6: PolySpace Fleet Operations, Refinery & Cosmic World Boss
- **Fleet Modules**: Validates Warp, Laser, Cargo, Shield, and Turret levels; audits `fleetPower` formula `(warp*100) + (laser*80) + (cargo*50) + (shield*60) + (turret*90)`.
- **Module Upgrades**: Audits server-side cost calculation and balance deduction via `upgrade_polyspace_module`.
- **Planetary Ore Refinery**: Executes smelting recipe (Iron -> Titanium / Titanium -> Quantum), verifies atomic deduction and output.
- **Expeditions**: Verifies destinations, launches expedition, and audits loot claim via `claim_polyspace_expedition`.
- **Cosmic World Boss Raid**: Executes laser strike via `strike_world_boss`, verifies crystal deduction, deterministic damage calculation, and boss HP decrement.

### 🏦 Suite 7: Staking Vault & Yield Accumulation Cycle
- **Pools & Tiers**: Tests deposits in PGT and 1FLR across `day` (1.0%), `month` (2.0%), and `year` (3.0%) tiers.
- **Server APYs**: Asserts server calculates authoritative APYs factoring in VIP, Ambassador, and Vault Core NFTs.
- **Lock Timers**: Asserts lock countdown functions correctly; verifies early unstake attempt is rejected ("Stake position is still locked").
- **Yield Accrual**: Verifies live yield ticker increments continuously from `last_harvest`.
- **Harvest & Unstake**: Tests `harvest_yield` and `unstake_position` on matured stakes.

### 💎 Suite 8: NFT Marketplace, Inventory & Quantum Relics
- **Catalog Registry**: Inspects utility NFTs (prices, supply, multipliers).
- **Serie 1 Relics**: Checks all 17 relic slots; validates permanent 1.5x Apex Multiplier unlocked when all 17 types are owned.
- **Mystery Loot Crates**: Tests crate opening, drop chances, and inventory crediting.

### 👥 Suite 9: 4-Tier Referral Architecture & POL Commissions
- **4-Tier Tree**: Verifies Level 1 (10%), Level 2 (5%), Level 3 (2%), and Level 4 (1%) downline tracking.
- **POL Commissions**: Audits `credit_nft_referral_commission` with transaction hash, validates insertion into `pol_referral_commissions`, and verifies replay prevention.
- **Payout Requests**: Audits `claim_referral_pol` pending request creation for admin review.

### 🏆 Suite 10: Daily Quests Tracker & Sitewide Leaderboards
- **Daily Quests**: Audits 3 daily quest milestones (Arcade, Mining, Wagers) and Master Quest completion.
- **Leaderboards**: Validates Weekly Arcade Leaderboard, All-Time Highscores, and Fleet Power rankings.

### 🛡️ Suite 11: Security & Anti-Cheat Sentinel Health Checks
- **Trigger Immutability**: Probes direct client updates to `balance_pgt`, `last_faucet_claim`, and `space_state.minerals`; asserts automatic rollback by database triggers.
- **Revoked RPCs**: Confirms calling `process_referral_commissions` directly returns permission denied (`42501`).
- **Position Siphoning Guard**: Confirms calling `unstake_position` with an unowned `stake_id` returns unauthorized.

---

## 5. Sample Diagnostic Report Output

```text
=============================================================================
                  POLYGON GAMING QA AUTOMATION TEST REPORT
=============================================================================
Target: https://polygongaming.io | Mode: Full Platform Audit
Player: 0x10b9...654d (Admin / VIP 2.0x / Ambassador)
Initial Balance: 72,054.00 PGT | 150.00 POL
-----------------------------------------------------------------------------
[PASS] Suite 01: Navigation & Routing (11/11 views rendered cleanly)
[PASS] Suite 02: Auth & Account State (Synthetic ID & Linked EVM verified)
[PASS] Suite 03: 24h PGT & VIP Faucet (Claim OK, Multipliers verified, Cooldown set)
[PASS] Suite 04: Arcade Engine Payouts (6/6 games tested, +18.50 PGT audited)
[PASS] Suite 05: Casino Wagers (5/5 games tested, +3.20 PGT net, Math OK)
[PASS] Suite 06: PolySpace Fleet & Boss (Modules OK, Refinery OK, Strike -10 HP)
[PASS] Suite 07: Staking Vault Cycles (APY 2.00% verified, Early unstake blocked)
[PASS] Suite 08: NFTs & Quantum Relics (17/17 Serie 1 Relics, 1.5x Apex active)
[PASS] Suite 09: 4-Tier Referrals (L1-L4 verified, POL replay protection active)
[PASS] Suite 10: Quests & Leaderboards (Quests synced, Leaderboard queried)
[PASS] Suite 11: Anti-Cheat Sentinels (Trigger shield OK, Public RPC blocked)
-----------------------------------------------------------------------------
Final Balance: 72,075.70 PGT (+21.70 PGT net gain)
Execution Time: 28.4s | 11/11 Suites Passed (0 Failures, 0 Warnings)
=============================================================================
```
