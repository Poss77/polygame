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

- **Full Historical Changelog**: Complete past release notes from v1.4.298 through v1.5.392 are archived in [`CHANGELOG.md`](../CHANGELOG.md).

**Master Guidelines for AI Agents**:
1. **Version Increment & Release Protocol**: Current version is **`APP_VERSION = "1.5.392"`** in `src/js/core/config.js`. PolyGame uses 3-digit patch versioning (`1.4.001` -> `1.4.002` -> `1.4.999`) to allow 1,000 patch updates per minor version cycle before advancing to `1.5.000`. Whenever deploying a new site update or feature, increment `APP_VERSION`. This automatically triggers the **⚡ NEW UPDATE** badge for 5 seconds on players' first login/visit after that update, and syncs the permanent bottom-center version tag (`v1.5.392`).
2. **Database Script Notifications**: If any change requires running an RPC or SQL script in Supabase, notify the user explicitly at the start of your turn.
3. **Anti-Cheat Integrity**: Never include `balance_pgt` in client `saveToDB()` payloads; all balance mutations must go through `SECURITY DEFINER` database RPCs.
4. **No Unprompted Database Modifications**: Never attempt to run automated database mutations, balance resets, or table corrections directly on Supabase data unless explicitly requested by the user. Always provide clean, commented SQL scripts for the user to review and execute manually in the Supabase SQL Editor.
5. **PostgreSQL Trigger Security Architecture (NEVER use `SECURITY DEFINER` on `prevent_direct_balance_mutation`)**:
   - The master anti-cheat trigger function `public.prevent_direct_balance_mutation()` **MUST NEVER BE DECLARED WITH `SECURITY DEFINER`**.
   - **Critical Mechanism**: In PostgreSQL, triggers without `SECURITY DEFINER` execute with the role of the caller (`SECURITY INVOKER`). Direct PostgREST client queries execute as `CURRENT_USER = 'anon'` or `'authenticated'`, which trips `IF LOWER(CURRENT_USER) IN ('anon', 'authenticated')` and intercepts all client-side tampering (balances, high scores, faucet cooldowns, fake relics, fake NFTs, crate passes, space minerals, and module levels).
   - Legitimate stored procedures (`end_arcade_session`, `claim_faucet`, `claim_polyspace_expedition`, `upgrade_polyspace_module`, `smelt_space_ore`) ARE declared `SECURITY DEFINER` (owned by `postgres`), so when they update `public.users`, `CURRENT_USER` is `'postgres'`, allowing legitimate in-game rewards.
   - If `SECURITY DEFINER` is mistakenly added to `prevent_direct_balance_mutation()`, PostgreSQL executes the trigger function itself as `postgres` for EVERY request, causing `CURRENT_USER IN ('anon', 'authenticated')` to evaluate to `FALSE` for untrusted clients — **completely disarming all anti-cheat shields and allowing exploit probes to succeed**!
   - Always define the trigger function strictly as:
     `CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation() RETURNS TRIGGER LANGUAGE plpgsql AS $$` (NO `SECURITY DEFINER`).
6. **Database Migration Protocol & Anti-Clobbering Rules (Never Regress Existing Functions)**:
   - **Full Function Overwrite Reality**: In PostgreSQL, `CREATE OR REPLACE FUNCTION` replaces the entire function body. If an agent copies an older version of a procedure to fix a bug, it will silently **clobber and revert** all newer columns, anti-cheat clamps, and formulas added in subsequent releases!
   - **Live Schema Verification Mandatory**: Before creating or modifying any database RPC or SQL migration, the agent MUST inspect the live table columns (e.g. via REST or schema inspection) and review the most recent migration touching that procedure.
   - **Forward-Only Migrations**: Never modify past historical migration files once executed. Always produce a single, new forward-only migration.
   - **Keep Master Scripts Synchronized**: Update `supabase/master_rpcs.sql` and `supabase/master_schema.sql` whenever stored procedures or table schemas evolve, ensuring a canonical, authoritative source of truth exists for all future agent sessions.

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
