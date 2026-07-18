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

**Implemented Features**:
- "Guest Mode" for players without web3 wallets. State merges to the wallet upon connecting.
- Stealth Admin panel for the Master Wallet to view global metrics (TVL, active players, global token supply) and a full player database ledger.
- Live real-time Supabase Leaderboards for Arcade High Scores, Top Referrers, and Top Token Holders.

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
