# PolyGame Context and Knowledge

**Tech Stack**:
- Vanilla HTML, CSS, JavaScript.
- Backend: Supabase (REST API). The project uses a `users` table to track player progression.
- Hosting: Designed for GitHub pages (runs fully in-browser with a DB connection, no Node.js backend server).

**Architecture / State**:
- Frontend source of truth: `PolyState` class in `app.js`.
- Automatic Sync: When state mutates locally, `saveToDB()` is automatically called to `upsert` the data into Supabase using the connected wallet address as the primary key.
- The UI contains many separate virtual "views" routed via `switchTab()` in `app.js`.

**Important Addresses & Credentials**:
- **Master Admin Wallet**: `0x10B9993990c9EF8a212c9557cB02aD94da9a654d` (connecting with this wallet unlocks a hidden Admin Panel).
- **Supabase URL**: `https://jgtfnsufemvqkyytscgl.supabase.co/rest/v1/`

**Implemented Features & Security Hardening**:
- **Staking System Overhaul & Race Condition Guard**: Implemented re-entrancy button locking on frontend staking controls (`btnDeposit`, `btnHarvest`, `btnUnstake`), instant local state updates without flickering, and PostgreSQL atomic `FOR UPDATE` row locking + `SECURITY DEFINER` across all staking RPCs (`deposit_stake`, `unstake_position`, `unstake_all_matured`). Adjusted anti-cheat trigger `prevent_direct_balance_mutation()` to allow balance deductions while blocking balance inflation.
- **System Stability & Consoles Cleanups**: Replaced third-party `worldtimeapi.org` with native Supabase HTTP Date header server time sync in `faucet.js`. Fixed `discord.js` by importing `supabase` directly. Purged legacy service worker React chunk 404s via self-destructing `sw.js` and inline error interceptor.
- **Mobile Bottom Navigation**: Fixed mobile bottom bar with GPU hardware acceleration (`transform: translateZ(0)`), `z-index: 99999`, and safe-area inset padding (`env(safe-area-inset-bottom)`).
- **Dashboard Layout**: Combined inline Quick Stats beside the Welcome banner button, added side-by-side Arcade & PolySpace Mining launcher cards, and restored Desktop 2-column Network Activity feed.
- "Guest Mode" for players without web3 wallets. State merges to the wallet upon connecting.
- Stealth Admin panel for the Master Wallet to view global metrics (TVL, active players, global token supply) and a full player database ledger.
- Live real-time Supabase Leaderboards for Arcade High Scores, Top Referrers, and Top Token Holders.

**Master Guidelines for AI Agents**:
1. **Version Increment & Release Protocol**: Current version is `APP_VERSION = "1.4.011"` in `src/js/core/config.js`. PolyGame uses 3-digit patch versioning (`1.4.001` -> `1.4.002` -> `1.4.999`) to allow 1,000 patch updates per minor version cycle before advancing to `1.5.000`. Whenever deploying a new site update or feature, increment `APP_VERSION`. This automatically triggers the **⚡ NEW UPDATE** badge (below My Profile on Desktop / right of Dashboard on Mobile) for 5 seconds on players' first login/visit after that update, and syncs the permanent bottom-center version tag (`v1.4.011`).
2. **Database Script Notifications**: If any change requires running an RPC or SQL script in Supabase, notify the user explicitly at the start of your turn.
3. **Anti-Cheat Integrity**: Never include `balance_pgt` in client `saveToDB()` payloads; all balance mutations must go through `SECURITY DEFINER` database RPCs.

**Deployment / GitHub Actions**:
- The project is deployed via **GitHub Pages**.
- To deploy updates to the live site, changes must be committed and pushed to the `main` branch on GitHub.
- Standard git workflow for updates:
  ```bash
  git add .
  git commit -m "Update message"
  git push origin main
  ```
- Because it relies on GitHub Pages, any push to the `main` branch will automatically trigger the GitHub Pages deployment action. No build step (like `npm run build`) is required since the app uses vanilla HTML/JS/CSS.

**Game Design & Economy**:
- **In-Game Currency**: PGT (PolyGame Token). Used for betting, buying NFTs, and staking.
- **Core Loop**: Players earn PGT through the Faucet, wager it in Mini-Games (like Roshambo), buy multiplier NFTs, and stake their balance in the Vault to earn passive yield.
- **Mini-Games**: Features "Roshambo", "Lucky Spinner", "Neon Plinko", "Cyber-Crash", "Space Invaders", and "PolySpace Mining".
- **Server-Side Game Logic**: Gambling and payout logic is completely processed on the Supabase backend via Secure RPC calls (`play_roshambo`, `play_spinner`, `play_plinko`, `play_crash`, `submit_invaders_score`, `claim_faucet`).
- **NFT Marketplace**: Users can purchase Utility NFTs using PGT. These NFTs act as passive multipliers for the Faucet, Arcade wins, and Referral bonuses.
- **VIP System**: Users can buy VIP status, which doubles their payouts across the board, bypasses captchas, and reduces faucet cooldowns to 21.6 hours. Stored in DB as `vip_until`.
- **Staking Vault**: Players can lock their PGT to earn APY over time.
- **Referral System**: A robust 4-tier downline structure (L1: 10%, L2: 5%, L3: 2%, L4: 1% — doubled to 20%/10%/4%/2% for VIPs). Commissions accumulate in the unclaimed pool.
- **Frontend Views**: The app is structured as a Single Page Application (SPA). `switchTab()` controls navigation between `#view-dashboard`, `#view-games`, `#view-nft`, `#view-vault`, `#view-referrals`, `#view-holders`, `#view-profile`, and `#view-admin`.
- **PolySpace Router**: `launchPolySpace()` routes directly into the `#view-games` `adventure` tab for space mining.
