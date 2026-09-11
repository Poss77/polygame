# PLAN-009: Session-Bound Arcade Relic Claims & Anti-Cheat Hardening

**Plan ID**: `PLAN-009`  
**Status**: Saved for Future Implementation  
**Created**: 2026-09-11  
**Target Version**: Future Release (`v1.5.350+` or upon user instruction)

---

## Executive Summary

This specification defines the architecture for **binding Quantum Relic drops directly to active arcade game sessions (`session_id`)**, closing the theoretical attack surface where external scripts could invoke `grant_relic_drop` without actively playing an arcade game.

Currently, **PGT arcade rewards** are strictly protected behind a two-phase session flow (`start_arcade_session` ➔ `end_arcade_session`), enforcing a 35-game daily quota and server-stamped duration velocity checks. However, **Quantum Relics** were historically harvested via a standalone procedure (`grant_relic_drop(player_id, relic_id)`) that did not require the active session key.

This plan integrates relics into the existing cryptographic session framework while fully supporting **epic multi-relic runs (up to 3 relics per game)** and **private module scoping** to deter unauthorized console scripts.

---

## Core Principles & Design Rules

1. **Active Session Prerequisite**:
   - In order to harvest an in-game Quantum Relic from arcade gameplay (Astro-Dodge, Cyber Invaders, Cyber Drift, Cyber Stacker, etc.), the client must provide a valid `p_session_id`.
   - The session must exist in `public.arcade_sessions`, belong to the caller, and possess `status = 'in_progress'`.
2. **Multi-Relic Tolerance (The "Spacing + Cap" Rule)**:
   - In extended, high-skill gameplay sessions (e.g. 10–15+ minutes in Astro-Dodge or Cyber Invaders with the Quantum Relic Seeker NFT), players can legitimately encounter **2 or even 3 relics**.
   - Instead of a rigid 1-relic cap, the server allows up to **3 relics per session**, enforcing a **minimum 45-second spacing** between drops in the same session.
   - Spacing Rule: `(NOW() - last_relic_dropped_at) >= INTERVAL '45 seconds'`.
3. **Elapsed Survival Requirement**:
   - A relic cannot be harvested during the first 15 seconds of a run (`(NOW() - started_at) >= INTERVAL '15 seconds'`). This prevents instant bot-spawn drops.
4. **Session Expiration & Single-Use Burning**:
   - When the game ends, `end_arcade_session` marks the session `status = 'completed'`.
   - Once completed, the session key is permanently burned and can never claim additional relics or PGT.
5. **Daily Quota Containment**:
   - Because `start_arcade_session` strictly enforces the **35 daily plays limit**, a bot is physically prevented from generating infinite sessions.
6. **Engine Closure Scoping**:
   - Game engines (`game.js`, `invaders.js`, `drift.js`, `stacker.js`) maintain `this.sessionId` within private closures/module instances, never exposing `sessionId` directly on the global `window` object.
7. **Exemptions & Special Roles**:
   - **PolySpace Expeditions**: Server-side fleet claims execute inside PostgreSQL via `claim_polyspace_expedition` (`SECURITY DEFINER` running as `postgres`). Internal database executions bypass the arcade session requirement.
   - **Master Admin Test Portal**: Test relic grants executed from `admin.html` with a verified admin passkey or Master Admin wallet bypass the arcade session check.

---

## Database Architecture

### 1. Schema Extensions on `public.arcade_sessions`:
```sql
ALTER TABLE public.arcade_sessions 
ADD COLUMN IF NOT EXISTS relics_dropped_count INTEGER DEFAULT 0;

ALTER TABLE public.arcade_sessions 
ADD COLUMN IF NOT EXISTS last_relic_dropped_at TIMESTAMPTZ DEFAULT NULL;
```

### 2. Upgraded Canonical `grant_relic_drop` Procedure:
```sql
CREATE OR REPLACE FUNCTION public.grant_relic_drop(
    p_player_id TEXT,
    p_relic_id TEXT,
    p_session_id TEXT DEFAULT NULL,
    p_amount INT DEFAULT 1,
    p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actual_player_id TEXT := resolve_player_id(p_player_id);
    v_current_relics JSONB;
    v_relic_obj JSONB;
    v_total INT;
    v_unminted INT;
    v_onchain INT;
    v_token_ids JSONB;
    v_updated_relics JSONB;
    v_clean_relic_id TEXT := LOWER(TRIM(COALESCE(p_relic_id, '')));
    v_session RECORD;
    v_session_uuid UUID;
    v_is_internal BOOLEAN := (LOWER(CURRENT_USER) = 'postgres');
    v_is_admin BOOLEAN := false;
BEGIN
    IF v_actual_player_id IS NULL OR v_actual_player_id = '' THEN
        v_actual_player_id := LOWER(TRIM(COALESCE(p_player_id, '')));
    END IF;

    -- Check Admin bypass if passkey provided
    IF p_admin_passkey IS NOT NULL AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'verify_admin_passkey') THEN
        v_is_admin := verify_admin_passkey(p_admin_passkey);
    END IF;

    -- 1. Anti-Cheat: Reject bulk drop amounts
    IF p_amount IS NOT NULL AND p_amount > 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid drop amount: client drops are strictly limited to 1 relic per event');
    END IF;

    -- 2. Anti-Cheat: Mythic Apex Relics restricted to PolySpace Deep Void or Admin
    IF v_clean_relic_id IN ('relic_apex_singularity', 'relic_apex_genesis') AND NOT v_is_internal AND NOT v_is_admin THEN
        RETURN jsonb_build_object('success', false, 'error', 'Universal Apex Relics can only be unlocked via Deep Space Expeditions');
    END IF;

    -- 3. Whitelist validation of registered relics
    IF v_clean_relic_id NOT IN (
        'relic_astrododge_prism', 'relic_astrododge_deflector', 'relic_astrododge_compass',
        'relic_invaders_core', 'relic_invaders_dynamo', 'relic_invaders_transmitter',
        'relic_drift_chronometer', 'relic_drift_capacitor', 'relic_drift_overdrive',
        'relic_stacker_foundation', 'relic_stacker_keystone', 'relic_stacker_monolith',
        'relic_space_darkmatter', 'relic_space_warpcoil', 'relic_space_plasma',
        'relic_apex_singularity', 'relic_apex_genesis',
        'relic_exp1_a', 'relic_exp1_b', 'relic_exp2_a', 'relic_exp2_b'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or unregistered relic ID');
    END IF;

    -- 4. Active Session Verification (Required for client arcade drops)
    IF NOT v_is_internal AND NOT v_is_admin THEN
        IF p_session_id IS NULL OR TRIM(p_session_id) = '' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Active arcade session key required to harvest relics');
        END IF;

        BEGIN
            v_session_uuid := p_session_id::UUID;
        EXCEPTION WHEN OTHERS THEN
            RETURN jsonb_build_object('success', false, 'error', 'Invalid session ID format');
        END;

        SELECT * INTO v_session
        FROM public.arcade_sessions
        WHERE id = v_session_uuid
          AND (LOWER(player_id) = LOWER(v_actual_player_id) OR player_id = v_actual_player_id)
        FOR UPDATE;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('success', false, 'error', 'Arcade session not found or belongs to another player');
        END IF;

        IF v_session.status <> 'in_progress' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Arcade session is not active or already finalized');
        END IF;

        -- Survival check: minimum 15 seconds into game
        IF EXTRACT(EPOCH FROM (NOW() - COALESCE(v_session.started_at, v_session.created_at))) < 15 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Survival duration too short to discover Quantum Relics');
        END IF;

        -- Cap: Max 3 relics per session
        IF COALESCE(v_session.relics_dropped_count, 0) >= 3 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Maximum relic discovery limit reached for this session (3/3)');
        END IF;

        -- Spacing: Minimum 45s between consecutive relic drops in the same session
        IF v_session.last_relic_dropped_at IS NOT NULL AND (NOW() - v_session.last_relic_dropped_at) < INTERVAL '45 seconds' THEN
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance cooling down. Please wait 45s between discoveries');
        END IF;

        -- Update session relic counters
        UPDATE public.arcade_sessions
        SET relics_dropped_count = COALESCE(relics_dropped_count, 0) + 1,
            last_relic_dropped_at = NOW()
        WHERE id = v_session_uuid;
    END IF;

    -- 5. Row Lock Player & Update Relics
    SELECT COALESCE(relics, '{}'::jsonb) INTO v_current_relics
    FROM public.users
    WHERE player_id = v_actual_player_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player not found');
    END IF;

    v_relic_obj := COALESCE(v_current_relics->v_clean_relic_id, '{}'::jsonb);
    v_unminted := COALESCE((v_relic_obj->>'unminted')::int, 0) + 1;
    v_onchain := COALESCE((v_relic_obj->>'onchain')::int, 0);
    v_total := v_unminted + v_onchain;
    v_token_ids := COALESCE(v_relic_obj->'token_ids', '[]'::jsonb);

    v_relic_obj := jsonb_build_object(
        'total', v_total,
        'unminted', v_unminted,
        'onchain', v_onchain,
        'token_ids', v_token_ids
    );

    v_updated_relics := jsonb_set(v_current_relics, ARRAY[v_clean_relic_id], v_relic_obj, true);

    UPDATE public.users
    SET relics = v_updated_relics,
        updated_at = NOW()
    WHERE player_id = v_actual_player_id;

    RETURN v_updated_relics;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_relic_drop(TEXT, TEXT, TEXT, INT, TEXT) TO anon, authenticated, service_role;
```

---

## Frontend Integration Plan

1. **Game Engine Trigger Passing**:
   In `game.js`, `invaders.js`, `drift.js`, and `stacker.js`:
   Pass `sessionId: this.sessionId` inside `window.triggerRelicCelebration`:
   ```javascript
   if (typeof window.triggerRelicCelebration === 'function') {
     window.triggerRelicCelebration({
       id: pickedRelic.id,
       name: pickedRelic.name,
       rarity: pickedRelic.rarity,
       gameName: 'AstroDodge',
       image: `metadata/images/relics/${pickedRelic.id}.jpg`,
       sessionId: this.sessionId // Pass private session key
     });
   }
   ```

2. **`confetti.js` RPC Call**:
   Forward `p_session_id: relicMeta.sessionId` to `grant_relic_drop`:
   ```javascript
   sbClient.rpc('grant_relic_drop', {
     p_player_id: pId,
     p_relic_id: relicMeta.id,
     p_session_id: relicMeta.sessionId || null,
     p_amount: 1
   });
   ```

3. **Admin Test Tool (`src/js/features/admin.js`)**:
   Pass session passkey in `grant_relic_drop` call so Master Admin can continue testing drops freely without needing an arcade session.

---

## Threat Model & Verification

| Threat | Mitigated By |
| :--- | :--- |
| **DevTools Console Loop (`for (1..100) grant_relic_drop`)** | 🛑 **Blocked**: Missing active `p_session_id`. |
| **Reusing Yesterday's Session Key** | 🛑 **Blocked**: Session is marked `completed` or older than 20 min. |
| **Script claiming 10 relics in 1 game** | 🛑 **Blocked**: Capped at max 3 relics per session. |
| **Script claiming 2 relics in 2 seconds** | 🛑 **Blocked**: Enforces minimum 45s interval between drops. |
| **Instant Relic Claim on Game Start** | 🛑 **Blocked**: Enforces minimum 15s survival elapsed time. |
| **Bot farming unlimited sessions** | 🛑 **Blocked**: Bound to 35 plays/day daily limit on `start_arcade_session`. |
| **High-Skill Human Run (15 mins, 2-3 relics)** | ✅ **Allowed**: 45s spacing and 3-relic cap permits authentic multi-relic runs. |
