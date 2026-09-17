# Implementation Plan: Periodic Cloudflare Turnstile Verification for Arcade Mini-Games (PLAN-010)

Define the architecture and rollout strategy for periodic **Cloudflare Turnstile Human Verification** across Polygon Gaming's arcade games (Astro-Dodge, Cyber Invaders, Cyber Drift, Cyber Stacker), stopping automated farming macros and headless bots while preserving smooth human UX.

## User Review Required

> [!NOTE]
> This plan is saved for future implementation per your instruction. No changes will be made to active game code until you approve execution.

- **Proposed Frequency**: Every **3 arcade games** by default (configurable via Admin settings to 1, 3, 5, or disabled).
- **VIP Perk**: VIP pilots automatically bypass Turnstile verification across all games.
- **Verification Mode**: Cloudflare Managed Mode (silent, invisible ~0.5s check for humans; interactive challenge for bot scripts).

---

## Proposed Changes

### Arcade Security Module & State Controller

#### [NEW] [`src/js/features/arcade-security.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/src/js/features/arcade-security.js)
- Track in-memory and `sessionStorage` counter: `playsSinceTurnstile`.
- Export `checkArcadeTurnstileRequired()`:
  - If `isVip === true`: return `false` (bypass).
  - If `playsSinceTurnstile < 3`: increment and return `false`.
  - If `playsSinceTurnstile >= 3`: return `true` (trigger challenge).
- Render Turnstile widget dynamically into `#turnstile-arcade-widget` using existing `TURNSTILE_SITE_KEY`.
- On success: capture token, reset counter, auto-dismiss modal, and proceed with game launch.

---

### UI Overlay & Challenge Modal

#### [MODIFY] [`index.html`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/index.html)
- Add `#modal-turnstile-arcade`:
  - Sleek cyberpunk glass modal with neon border.
  - Title: `🛡️ Pilot Security Sentinel`.
  - Explanatory subtitle: *"Quick human verification check before launching starship."*
  - Container: `#turnstile-arcade-widget`.
  - Auto-launch trigger on token resolution.

---

### Arcade Engines Integration

#### [MODIFY] [`game.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/game.js), [`drift.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/drift.js), [`invaders.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/invaders.js), [`stacker.js`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/stacker.js)
- Wrap game launch handlers with `checkArcadeTurnstileRequired()`:
  - If challenge required, pause game launch until Turnstile resolves.
  - Pass the verified `turnstileToken` to `start_arcade_session`.

---

### Backend Token Enforcement

#### [MODIFY] Edge Gateway / `start_arcade_session`
- For sessions where verification was required, validate the token against Cloudflare's API:
  `https://challenges.cloudflare.com/turnstile/v0/siteverify` using `TURNSTILE_SECRET_KEY`.
- Reject session creation if token is missing or invalid.

---

## Verification Plan

### Automated / API Verification
- Test `siteverify` request with valid and mock invalid tokens to verify edge rejection.

### Manual Verification
1. **Normal Player Flow**: Play 2 games of Astro-Dodge (instant start). On game 3, verify modal appears, Turnstile passes, and game launches seamlessly.
2. **VIP Bypass**: Connect with VIP wallet, verify zero prompts appear across 5+ consecutive games.
3. **Bot Simulation**: Attempt to call `start_arcade_session` on game 3 without Turnstile token and verify rejection.
