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

**Implemented Features & Hardening**:
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
1. **Version Increment & Release Protocol**: Current version is **`APP_VERSION = "1.4.366"`** in `src/js/core/config.js`. PolyGame uses 3-digit patch versioning (`1.4.001` -> `1.4.002` -> `1.4.999`) to allow 1,000 patch updates per minor version cycle before advancing to `1.5.000`. Whenever deploying a new site update or feature, increment `APP_VERSION`. This automatically triggers the **⚡ NEW UPDATE** badge for 5 seconds on players' first login/visit after that update, and syncs the permanent bottom-center version tag (`v1.4.366`).
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
- **VIP System**: Buy VIP status for 2.0x payouts across all games, bypass captchas, and reduced faucet cooldowns.
- **PolySpace Router**: `launchPolySpace()` routes directly into `#view-games` `adventure` tab.
