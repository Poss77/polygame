# Implementation Plan: Periodic Cloudflare Turnstile Verification for Arcade Mini-Games (PLAN-010)

Define the architecture and rollout strategy for periodic **Cloudflare Turnstile Human Verification** across Polygon Gaming's arcade games (Astro-Dodge, Cyber Invaders, Cyber Drift, Cyber Stacker), stopping automated farming macros and headless bots while preserving smooth human UX.

## User Review Required

> [!NOTE]
> This plan is saved for future implementation per your instruction. No changes will be made to active game code until you approve execution.

- **Proposed Frequency**: Every **3 arcade games** by default (configurable via Admin settings to 1, 3, 5, or disabled).
- **VIP Policy**: VIP pilots do NOT bypass verification for now (all accounts, Free and VIP, are verified equally every 3 games for comprehensive anti-bot protection).
- **Verification Mode**: Cloudflare Managed Mode (silent, invisible ~0.5s check for humans; interactive challenge for bot scripts).
- **Zero PGT & Zero Points Rule**: If human verification is missed, failed, expired, or bypassed by an automated script:
  - **PGT Payout**: Strictly **0.0 PGT**.
  - **Session Score**: Strictly **0 points** (high scores are never updated).
  - **Bot Warning**: Recorded immediately in `public.users.bot_warning` and `public.bot_security_logs`, with a high-priority alert dispatched to Discord.
  - **Session State**: Session is marked completed/burned to prevent retries.

---

## Proposed Changes

### Arcade Security Module & State Controller

#### [NEW] [`src/js/features/arcade-security.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/src/js/features/arcade-security.js)
- Track in-memory and `sessionStorage` counter: `playsSinceTurnstile`.
- Export `checkArcadeTurnstileRequired()`:
  - (VIP bypass disabled for now: all pilots follow the standard counter).
  - If `playsSinceTurnstile < 3`: increment and return `false`.
  - If `playsSinceTurnstile >= 3`: return `true` (trigger challenge).
- Render Turnstile widget dynamically into `#turnstile-arcade-widget` using existing `TURNSTILE_SITE_KEY`.
- On success: capture token, reset counter, auto-dismiss modal, and proceed with game launch.
- On dismiss / timeout / failure: Lock launch, invalidate session token, ensure game cannot start or submit scores.

---

### UI Overlay & Challenge Modal

#### [MODIFY] [`index.html`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/index.html)
- Add `#modal-turnstile-arcade`:
  - Sleek cyberpunk glass modal with neon border.
  - Title: `🛡️ Pilot Security Sentinel`.
  - Explanatory subtitle: *"Quick human verification check before launching starship."*
  - Container: `#turnstile-arcade-widget`.
  - Warning note: *"Unverified runs will not earn PGT or register high scores."*
  - Auto-launch trigger on token resolution.

---

### Arcade Engines Integration

#### [MODIFY] [`game.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/game.js), [`drift.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/drift.js), [`invaders.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/invaders.js), [`stacker.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/stacker.js)
- Wrap game launch handlers with `checkArcadeTurnstileRequired()`:
  - If challenge required, pause game launch until Turnstile resolves.
  - Pass the verified `turnstileToken` to `start_arcade_session`.
  - If player starts or forces game without completing verification, arcade loop awards 0 points and 0 PGT upon game over.

---

### Backend Token Enforcement & Payout Safety

#### [MODIFY] Edge Gateway / `start_arcade_session` & `end_arcade_session`
- For sessions where verification was required, validate the token against Cloudflare's API:
  `https://challenges.cloudflare.com/turnstile/v0/siteverify` using `TURNSTILE_SECRET_KEY`.
- **Enforcement on Missing / Failed Verification**:
  - If token is missing, expired, or invalid:
    - Burn the session immediately.
    - Award **0.0 PGT** and clamp score to **0 points**.
    - Trigger `record_bot_warning(v_pid, 'turnstile_verification_missed', ...)` on the user record.
    - Return `{ success: false, error: 'Human verification missed. 0 PGT and 0 points awarded.', bot_warning: true }`.

---

## Verification Plan

### Automated / API Verification
- Test `siteverify` request with valid and mock invalid tokens to verify edge rejection.

### Manual Verification
1. **Normal Player Flow**: Play 2 games of Astro-Dodge (instant start). On game 3, verify modal appears, Turnstile passes, and game launches seamlessly.
2. **VIP Account Check**: Connect with VIP wallet, verify that the 3-game Turnstile challenge applies equally without bypass.
3. **Bot Simulation**: Attempt to call `start_arcade_session` on game 3 without Turnstile token and verify rejection, 0 PGT payout, 0 score, and bot warning logged.
