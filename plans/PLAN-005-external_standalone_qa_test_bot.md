# PLAN-005: External Standalone QA Automation & Testing Bot

## Status: PROPOSED / SAVED FOR LATER

---

## 1. Executive Summary & Objective

Build an **independent, external QA Test Automation Bot** that runs completely outside the Polygon Gaming website repository on the administrator's local machine.

When launched (via a 1-click Windows batch script `run_bot.bat` or command line `py test_bot.py`), the bot will:
1. Open a real browser (Google Chrome or Microsoft Edge) in either **Visual Mode** (watch it click and play live) or **Headless Fast Mode** (runs silently in the background).
2. Navigate through all 11 views of the platform and verify UI health.
3. Play and test all arcade and wager game engines.
4. Verify that game sessions are legally signed and that **PGT payouts are accurately credited to player balance in real time**.
5. Output a color-coded diagnostic report with balance deltas, latencies, and pass/fail metrics.

---

## 2. Privacy & Security Architecture

- **100% External**: The bot code is stored in a standalone directory (e.g. `C:\Users\pasca\PolyGame-QA-Bot` or a local tools folder) and is **NEVER committed or pushed to GitHub**.
- **Zero Website Code Pollution**: No test suites, mocks, or headless drivers exist in the public web bundle.
- **Real Player Emulation**: Interacts with the live deployed frontend (`https://polygongaming.io`) using actual DOM events, Web Audio state, and Supabase RPC calls.

---

## 3. Technology Stack

- **Runtime**: Python 3.14 (already installed and verified on system)
- **Browser Automation**: `playwright` (Python) or `selenium` using installed Chrome/Edge binaries
- **Launcher**: `run_bot.bat` (Windows 1-click desktop batch script)

---

## 4. Test Suite Specification

### Suite 1: Page & Navigation Health (11 Views)
- Loops through all views via navigation links and `window.switchTab`:
  - `dashboard`, `faucet`, `games`, `space`, `nft`, `vault`, `staking`, `referrals`, `profile`, `holders`, `links`.
- Verifies DOM containers, ensures no unexpected 404s, script crashes, or stuck modals.

### Suite 2: Arcade Session & PGT Earnings Verification
- For each arcade title:
  - **AstroDodge** (`game.js`)
  - **Cyber Invaders** (`invaders.js`)
  - **Cyber Drift** (`drift.js`)
  - **Cyber Stacker** (`stacker.js`)
  - **Cyber Skeet** (`skeet.js`)
- Test workflow:
  1. Record starting PGT balance from DOM and state.
  2. Call / trigger game start (`start_arcade_session` RPC UUID generation).
  3. Simulate brief game activity / score submission.
  4. Finalize game over (`end_arcade_session` RPC).
  5. Audit response: ensure `success: true`, inspect `payout` PGT, and verify that `new_balance == old_balance + payout`.

### Suite 3: Wager Games Integrity
- Tests wager titles with minimum bet:
  - **Cyber Crash**: place test bet, cash out at multiplier, check payout credit.
  - **Neon Plinko**: drop test ball, inspect landing slot multiplier, check balance update.
  - **Cyber Mines**: start round, uncover safe gem, cash out, verify payout.
  - **Lucky Spinner & Roshambo**: execute round, audit win/loss balance sync.

### Suite 4: PolySpace & Cosmic World Boss
- Switch to PolySpace view (`space.js`).
- Verify fleet modules and outpost status.
- Query Cosmic World Boss HP and test strike API handshake.

### Suite 5: Daily Quests & Progression Sync
- Verify Quest 1 (Arcade Games), Quest 2 (Mining), and Quest 3 (Wager Wins) counters advance appropriately following game actions.
- Verify Profile page counters match Dashboard counters.

---

## 5. Execution & Reporting

- **1-Click Execution**: Double-click `run_bot.bat` on Windows.
- **Terminal Diagnostic Report**:
  ```text
  =============================================================
             POLYGON GAMING AUTOMATED QA TEST REPORT
  =============================================================
  Target URL: https://polygongaming.io
  Player Account: 0x10b9...654d
  Initial PGT Balance: 72,054.00 PGT
  -------------------------------------------------------------
  [PASS] Page Navigation: 11/11 views verified (420ms avg)
  [PASS] AstroDodge Arcade: Session OK (+4.50 PGT credited)
  [PASS] Cyber Invaders: Session OK (+3.20 PGT credited)
  [PASS] Cyber Drift: Session OK (+2.80 PGT credited)
  [PASS] Cyber Stacker: Session OK (+5.00 PGT credited)
  [PASS] Cyber Skeet: Session OK (+3.00 PGT credited)
  [PASS] Cyber Crash: Bet OK, Cashout @ 1.45x (+0.45 PGT)
  [PASS] Neon Plinko: Ball drop OK, Multiplier verified
  [PASS] Cyber Mines: Gem reveal OK, Cashout verified
  [PASS] Cosmic World Boss: Strike OK, HP updated
  [PASS] Daily Quests Tracker: 3/3 milestones synced
  -------------------------------------------------------------
  Final PGT Balance: 72,072.95 PGT (+18.95 PGT net gain)
  Total Test Duration: 24.8s
  ALL 11 TEST SUITES PASSED (0 FAILURES)
  =============================================================
  ```

---

## 6. How to Resume This Plan
When ready to implement, tell the agent:
> *"Let's build PLAN-005 (External Standalone QA Test Bot)"*
