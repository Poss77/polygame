# PLAN-012: Cryptographic Session Authentication, Guest Demo Mode & Anti-Framing Protection

**Plan ID**: `PLAN-012`  
**Status**: Approved Specification / Ready for Implementation  
**Created**: 2026-09-20  
**Target Version**: `v1.5.430+` or upon user instruction  

---

## 1. Executive Summary

Historically, Polygon Gaming allowed unauthenticated guest visitors to create database profiles (`0xguest...`) and execute database RPCs using the public `anon` API key. While anti-cheat triggers protected token balances and high scores, this architecture created a critical security flaw: an attacker (player "Dobby") was able to invoke database RPCs using other players' IDs (including "Poss" and the Master Admin "Origin"), causing the database to penalize and ban innocent players.

Under this updated architecture:
1. **Guest Database Interaction is Completely Removed**: Guests never create rows in `public.users` and never interact with Supabase. Guests can freely browse the platform and play games in local **Demo Mode** (offline canvas play, zero database calls, no PGT rewards).
2. **Strict Authentication for All Database Operations**: To modify any database table or invoke any state-modifying stored procedure (RPC), a player must be cryptographically authenticated (`role = 'authenticated'`) via **Google OAuth** or **Web3 Wallet (SIWE)**.
3. **Public `anon` Role Locked to Read-Only**: The public `anon` key is strictly restricted to read-only `SELECT` queries (e.g. public leaderboards, store catalog, platform settings). All write/update/delete permissions and RPC executions are revoked from `anon`.
4. **Anti-Framing Guarantee**: Stored procedures strictly bind execution to the caller's authentic identity (`auth.uid()`). It is mathematically impossible for an external script or attacker to cause another player's account to receive a bot warning or ban.

---

## 2. The Guest Experience: Seamless Demo Mode (Zero Supabase Interaction)

Guests can experience the games and explore the entire platform without friction or risk to the backend:

1. **Website Exploration**:
   - Guests can navigate all tabs (`#dashboard`, `#games`, `#space`, `#nft`, `#vault`, `#staking`, `#referrals`, `#holders`, `#links`).
   - Read-only data (weekly leaderboard, game metrics, NFT catalog) loads via public `SELECT` queries.
2. **Game Demo Mode (Try Games Without Login)**:
   - When a guest clicks "Play" on Astro-Dodge, Cyber Invaders, Cyber Drift, or Cyber Stacker, the game launches in **Demo Mode**.
   - The game engine runs fully in the browser canvas without calling `start_arcade_session`.
   - When the game ends, the game-over screen displays the player's run score and a neon prompt:
     > *"Great run! You scored 12,450 pts. Sign in with Google or Connect Wallet to earn PGT rewards, unlock NFT multipliers, and compete on the weekly leaderboard!"*
   - No PGT is minted, no high score is written to DB, and zero database mutations occur.
3. **Action Prompts on Gated Features**:
   - If a guest clicks "Claim Faucet", "Deploy Expedition", "Stake PGT", or "Buy NFT", a friendly modal opens:
     > *"Account Required: Please sign in with Google or connect your Polygon wallet to access this feature."*

---

## 3. Two Authenticated Player Tiers

Only authenticated players have database profiles in `public.users` and can execute RPCs:

### Tier 1: Google OAuth Players
- Users sign in via Google OAuth (`supabase.auth.signInWithOAuth`).
- Supabase automatically issues an authentic JWT (`auth.uid()`, `role = 'authenticated'`).
- The player profile in `public.users` has `user_id = auth.uid()::text`.

### Tier 2: Web3 Wallet Players (SIWE Session Token)
- When a Web3 wallet connects, the player signs a gas-free EIP-4361 challenge via [`auth-web3.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/src/js/core/auth-web3.js).
- The signature is exchanged for an authentic Supabase Auth session token via native `client.auth.signInWithWeb3()` or a dedicated auth exchange endpoint.
- Once authenticated, all PostgREST requests automatically carry the `Authorization: Bearer <access_token>` header with `role = 'authenticated'`.
- The player profile in `public.users` has `user_id = auth.uid()::text` and `linked_wallet_address = <wallet>`.

---

## 4. Database Security Architecture & Lockdown

### 1. Row Level Security (RLS) Lockdown on Tables

All table write access is revoked from `anon`:
```sql
-- 1. Revoke write permissions from public/anon
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon;

-- 2. Strictly bind users table mutations to the authenticated caller
DROP POLICY IF EXISTS "Allow public update users" ON public.users;
DROP POLICY IF EXISTS "Allow public insert users" ON public.users;

CREATE POLICY "Allow authenticated update users" ON public.users
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Allow authenticated insert users" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

-- 3. Public Read remains active for leaderboards, settings & storefront
DROP POLICY IF EXISTS "Allow public read users" ON public.users;
CREATE POLICY "Allow public read users" ON public.users
  FOR SELECT USING (true);
```

### 2. Stored Procedures (RPC) Access Lockdown

Execution on all state-mutating procedures is revoked from `anon` and granted exclusively to `authenticated` and `service_role`:

**Affected RPCs**:
- Arcade Sessions: `start_arcade_session`, `end_arcade_session`
- Faucets: `claim_faucet`, `claim_vip_faucet`
- PolySpace: `claim_polyspace_expedition`, `cancel_polyspace_expeditions`, `upgrade_polyspace_module`, `smelt_space_ore`
- Casino / Mini-Games: `play_crash`, `play_spinner`, `play_roshambo`, `play_plinko`, `mines_start_game`, `mines_cashout`
- Quantum Relics: `grant_relic_drop`
- NFT Store & Inventory: `sync_onchain_nfts`, `credit_nft_referral_commission`
- Staking: `stake_pgt`, `unstake_all`
- Referrals: `bind_referral_code`
- Anti-Cheat: `record_bot_warning` (internal `service_role` only)

**SQL Grant Policy**:
```sql
REVOKE EXECUTE ON FUNCTION public.start_arcade_session(TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_arcade_session(TEXT, TEXT, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.claim_faucet(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_faucet(TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.grant_relic_drop(TEXT, TEXT, INT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.grant_relic_drop(TEXT, TEXT, INT, TEXT, TEXT) TO authenticated, service_role;

-- (Applied across all mutating RPCs)
```

### 3. Server-Side Identity Verification in PL/pgSQL (Derived, Never Declared)

To permanently eliminate framing attacks, stored procedures **never trust client-supplied target IDs**. All authenticated stored procedures derive the player's identity directly from the cryptographic session:
```sql
-- 1. Derive authentic caller identity
v_auth_uid := auth.uid();
IF v_auth_uid IS NULL THEN
  RETURN jsonb_build_object('success', false, 'error', 'AUTHENTICATION_REQUIRED');
END IF;

SELECT player_id INTO v_caller_player_id
FROM public.users
WHERE user_id = v_auth_uid::text;

IF v_caller_player_id IS NULL THEN
  RETURN jsonb_build_object('success', false, 'error', 'PROFILE_NOT_FOUND');
END IF;

-- 2. Anti-Framing Assertion: If legacy client passes p_player_id, verify match
IF p_player_id IS NOT NULL AND resolve_player_id(p_player_id) <> v_caller_player_id THEN
  -- The authenticated caller attempted to tamper with or frame another player!
  -- Penalize the CALLER, never the victim:
  PERFORM public.record_bot_warning(
    v_caller_player_id,
    'identity_impersonation_attempt',
    'Security Sentinel',
    jsonb_build_object('attempted_target', p_player_id)
  );
  RETURN jsonb_build_object(
    'success', false,
    'error', 'UNAUTHORIZED_CALLER_MISMATCH',
    'message', 'Security alert: You cannot perform operations on another player''s account.'
  );
END IF;

-- 3. Execute exclusively against v_caller_player_id
```

---

## 5. Admin Architecture Separation (Web3 On-Chain vs. Database Automation)

To eliminate the browser attack surface and protect Master Admin credentials:

### 1. Database & Economic Automation (Moved 100% Out of PostgREST)
- All database reset and maintenance RPCs are permanently revoked from `anon` and `authenticated`:
  - `execute_weekly_payout_and_reset()`
  - `distribute_weekly_boss_prizes()`
  - `reset_weekly_arcade_scores()`
  - `snapshot_weekly_activity_tiers()`
  - `prune_stale_arcade_sessions()`
- **Execution Channels**:
  - **Option A (Zero Overhead / Manual)**: Saved SQL Editor snippets in the Supabase Dashboard, executed directly as the database owner.
  - **Option B (Fully Autonomous)**: Automated PostgreSQL cron jobs via `pg_cron` executing every Sunday at 00:00 UTC.
- **Security Benefit**: Stored procedures cannot be reached, invoked, or probed over the web API by any user, script, or hacker. No admin passkeys are ever transmitted over HTTP or stored in browser storage.

### 2. Streamlined Web3 Master Console (`tools/admin/`)
- Stripped of all sensitive database reset RPC calls.
- Strictly dedicated to MetaMask on-chain interactions:
  - Minting PGT ERC-20 tokens to the treasury/contracts.
  - Transferring or minting Polygon NFTs / Quantum Relics.
  - Approving and signing on-chain POL payout transactions.
  - Monitoring live Polygon contract balances.

---

## 6. Frontend Implementation Roadmap

### 1. State Management (`src/js/core/state.js`)
- Remove auto-generation of synthetic `0xguest...` profiles that sync to DB.
- If `authUserId` and `walletConnected` are both false:
  - `state.isGuest = true`.
  - Do NOT trigger `saveToDB()`.
  - Maintain an in-memory session for demo gameplay.

### 2. Database Sync Module (`src/js/core/db-sync.js`)
- Bypass `initUserRecord()` and `saveToDB()` when `state.isGuest` is true.
- Only load and persist data when an active Supabase Auth session (`auth.getSession()`) is confirmed.

### 3. Game Engines (`game.js`, `invaders.js`, `drift.js`, `stacker.js`)
- Check `window.appState.state.isGuest`:
  - If guest: Skip `start_arcade_session` and `end_arcade_session`.
  - Run game loop locally.
  - On game over: Show the run score and the "Sign In to Earn PGT" conversion prompt.
  - If logged in: Continue full cryptographic session flow with PGT rewards and high-score saves.

### 4. UI Call-to-Actions
- Replace generic guest indicators in the header with a clean **"Sign In / Connect"** pill.
- Faucet and PolySpace views display an informative preview card for guests with a 1-click login button.

---

## 7. Implementation Checklist

- [ ] **Database Migration (`supabase/enforce_authenticated_database_access.sql`)**:
  - [ ] Revoke `INSERT, UPDATE, DELETE` from `anon` on all public tables.
  - [ ] Update `users` RLS policies to enforce `auth.uid()::text = user_id`.
  - [ ] Revoke `EXECUTE` from `anon` across all gameplay, faucet, and store RPCs.
  - [ ] Revoke `EXECUTE` on database resets/maintenance from `anon` & `authenticated` (restricted to `service_role` and `postgres`).
  - [ ] Add server-side caller identity derivation (`auth.uid()`) and anti-framing caller-penalty assertions inside all RPCs.
  - [ ] Rebuild `supabase/master_rpcs.sql` and `master_schema.sql`.
- [ ] **Admin Console Hardening**:
  - [ ] Streamline `tools/admin/admin.html` into a dedicated Web3 Master Console for MetaMask on-chain interactions.
  - [ ] Provide ready-to-run Saved Snippets for Supabase Dashboard SQL Editor (or `pg_cron` setup).
- [ ] **Frontend Guest Demo & Auth Flow**:
  - [ ] Update `src/js/core/state.js` to flag `isGuest = true` and suppress guest DB persistence.
  - [ ] Update `src/js/core/db-sync.js` to strictly gate `saveToDB()` on active Supabase Auth sessions.
  - [ ] Update game engines (`game.js`, `invaders.js`, `drift.js`, `stacker.js`) with Demo Mode for guests.
  - [ ] Add guest sign-in conversion prompts on faucet, space, and game-over modals.
- [ ] **QA Bot & Security Sentinel Verification**:
  - [ ] Verify guests can browse the site and play games locally without any console errors or failed 401 requests.
  - [ ] Verify authenticated Google/Web3 accounts can play, earn PGT, and save progress.
  - [ ] Run exploit sentinel: confirm raw `anon` curl probes are blocked with `401 Unauthorized` / `AUTHENTICATION_REQUIRED`.
