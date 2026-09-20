# PLAN-012: Universal Cryptographic Session Auth & Anti-Framing Protection

**Plan ID**: `PLAN-012`  
**Status**: Saved for Future Implementation  
**Created**: 2026-09-20  
**Target Version**: Future Release (`v1.5.430+` or upon user instruction)

---

## 1. Executive Summary

During forensic analysis of live security events on 2026-09-20, an attacker (player "Dobby") abused database stored procedures (`grant_relic_drop`, `sync_onchain_nfts`) by passing innocent players' IDs (including "Poss" and the Master Admin "Origin") in the `p_player_id` parameter. Because the database anti-cheat logic punished `p_player_id` on failed validation rather than verifying the caller's authentic identity, innocent players received bot warnings and faced automated account bans.

This specification outlines the architecture to transition Polygon Gaming from parameter-based player identification to **Universal Cryptographic Session Authentication** across all three player types (Google, Web3 Wallet, and Guest).

---

## 2. Current Architecture & Historical Context

### What Was Previously Implemented:
1. **Web3 Cryptographic Signatures (`auth-web3.js`)**:
   - Implemented in `v1.5.383` (and refined in `v1.5.397`).
   - Generates an EIP-4361 (SIWE) challenge: `createAuthChallenge(address, 7)`.
   - Requests a gas-free signature via `signer.signMessage()`.
   - First attempts native Supabase Web3 sign-in (`client.auth.signInWithWeb3`).
   - If native Supabase Web3 provider is disabled in dashboard or user is linked via Google, falls back to client-side verification (`ethers.verifyMessage`) and caches a 7-day token in `localStorage`.

### Why the Framing Vulnerability Occurred:
1. **Client-Side Fallback vs Database Awareness**:
   - When Web3 auth falls back to client-side verification, Supabase does not issue a server-side JWT session. The browser continues to send PostgREST HTTP requests with the public `anon` key.
2. **Missing Caller Binding in Stored Procedures**:
   - Stored procedures (`grant_relic_drop`, `sync_onchain_nfts`, `record_bot_warning`) accepted `p_player_id TEXT` as a plain argument.
   - When a check failed, the stored procedure executed:
     ```sql
     PERFORM public.record_bot_warning(v_actual_player_id, ...);
     ```
   - If an attacker passed a victim's `player_id`, the victim was penalized. Even if the attacker had a valid Google or Web3 login, the database never compared `auth.uid()` to `v_user.user_id`.

---

## 3. Core Principles & Design Rules

1. **The Anti-Framing Rule**:
   - An unauthenticated caller (`auth.jwt() IS NULL`) can NEVER cause a registered user account to receive a bot warning or ban.
   - Unauthenticated failed probes are logged as anonymous security incidents and rejected immediately.
2. **Caller Accountability**:
   - If an authenticated caller (`auth.jwt() IS NOT NULL`) attempts to submit actions for another player's `player_id`, the **caller's account** (`auth.uid()`) is penalized for identity impersonation.
3. **Universal Session Tokens (No Anonymous PostgREST Mutations)**:
   - Every visitor must possess a cryptographically valid Supabase JWT before invoking state-mutating RPCs.

---

## 4. Architectural Roadmap: 3-Tier Universal Authentication

### Tier 1: Google OAuth (Existing)
- Users sign in via Google OAuth.
- Supabase automatically issues an authentic JWT (`auth.uid()`).
- Database RPCs verify:
  ```sql
  IF v_user.user_id IS NOT NULL AND v_user.user_id <> auth.uid()::TEXT THEN
    RAISE EXCEPTION 'Caller identity does not match player account';
  END IF;
  ```

### Tier 2: Web3 Wallets (Server-Side SIWE Verification)
- When a Web3 wallet connects, the client signs an EIP-4361 message (`createAuthChallenge`).
- Instead of caching purely in `localStorage`, the signature is sent to a Supabase Edge Function (`/verify-web3-auth`) or native `signInWithWeb3`:
  ```typescript
  // Edge Function: verifies signature on server and issues a custom Supabase JWT
  const recovered = ethers.verifyMessage(challenge, signature);
  if (recovered.toLowerCase() === claimedWallet.toLowerCase()) {
    return supabaseAdmin.auth.admin.createSession(userId);
  }
  ```
- The client sets the returned session via `supabase.auth.setSession()`.
- Result: Web3 wallet players now possess a real `auth.jwt()` in all PostgREST calls.

### Tier 3: Guest Players (Supabase Anonymous Sign-Ins)
- Supabase native Anonymous Sign-Ins:
  ```javascript
  if (!supabase.auth.getSession()) {
    await supabase.auth.signInAnonymously();
  }
  ```
- Every guest visitor receives an authentic Supabase `auth.uid()`, preventing script spoofing and binding their guest progression to their device's cryptographic session.

---

## 5. Security Enforcements on PostgreSQL RPCs

Once Universal Session Tokens are deployed:
1. **Revoke `anon` on Mutating RPCs**:
   - Sensitive RPCs (`grant_relic_drop`, `sync_onchain_nfts`, `start_arcade_session`, `claim_polyspace_expedition`) will strictly require `authenticated`:
     ```sql
     REVOKE EXECUTE ON FUNCTION public.grant_relic_drop FROM anon;
     GRANT EXECUTE ON FUNCTION public.grant_relic_drop TO authenticated, service_role;
     ```
2. **Strict Identity Assertion**:
   - Every RPC resolves the caller via `auth.uid()`:
     ```sql
     v_auth_uid := auth.uid();
     IF v_auth_uid IS NULL THEN
       RETURN jsonb_build_object('success', false, 'error', 'AUTHENTICATION_REQUIRED');
     END IF;
     ```

---

## 6. Implementation Checklist (When Ready to Execute)

- [ ] Enable Supabase Anonymous Sign-Ins in Dashboard (Auth -> Providers -> Anonymous).
- [ ] Configure Supabase Web3 / Ethereum Auth provider or deploy `/verify-web3-auth` Edge Function.
- [ ] Update `src/js/core/auth-web3.js` to exchange verified signatures for a Supabase session token.
- [ ] Update `src/js/core/state.js` to initialize anonymous sessions for Guests on boot.
- [ ] Migrate database RPCs to enforce `auth.uid() = user_id`.
- [ ] Revoke `anon` permissions on game reward RPCs.
