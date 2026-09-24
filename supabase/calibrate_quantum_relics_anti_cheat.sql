-- ==============================================================================
-- POLYGON GAMING: QUANTUM RELICS ANTI-CHEAT CALIBRATION & APEX DROP LIBERALIZATION
-- Migration: calibrate_quantum_relics_anti_cheat.sql
-- ==============================================================================
-- 1. Permits Mythic Apex Relics (Quantum Singularity Core, Genesis Matrix) to drop
--    naturally across all games (Astro-Dodge, Cyber Invaders, Cyber Drift, etc.).
-- 2. Removes the 15-second survival threshold and 45-second drop cooldown which
--    were triggering false-positive bot alarms on legitimate players.
-- 3. Retains rock-solid anti-cheat guards:
--    - Active arcade session binding and caller identity verification.
--    - Session status must be 'in_progress'.
--    - Single-drop enforcement (p_amount > 1 rejected).
--    - Session capacity cap (maximum 3 relics per game session).
--    - Whitelist validation on all relic IDs.
--    - Strictly revoked from anon / public execution.
-- ==============================================================================

DROP FUNCTION IF EXISTS public.grant_relic_drop(TEXT, TEXT, INT);
DROP FUNCTION IF EXISTS public.grant_relic_drop(TEXT, TEXT, INT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.grant_relic_drop(
    p_player_id TEXT,
    p_relic_id TEXT,
    p_amount INT DEFAULT 1,
    p_session_id TEXT DEFAULT NULL,
    p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_guard RECORD;
    v_actual_player_id TEXT;
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
    v_context TEXT;
    v_is_internal BOOLEAN := false;
    v_is_admin BOOLEAN := false;
BEGIN
    -- 1. Verify True Internal Engine Calls via PostgreSQL Call Stack
    GET DIAGNOSTICS v_context = PG_CONTEXT;
    IF v_context LIKE '%claim_polyspace_expedition%' THEN
        v_is_internal := true;
    END IF;

    -- 2. Verify Master Admin Passkey (if provided)
    IF p_admin_passkey IS NOT NULL AND TRIM(p_admin_passkey) <> '' THEN
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'verify_admin_passkey') THEN
            v_is_admin := public.verify_admin_passkey(p_admin_passkey);
        END IF;
    END IF;

    -- Authenticate caller & anti-framing guard
    IF NOT v_is_internal AND NOT v_is_admin THEN
        v_guard := public.assert_caller_player_id(p_player_id);
        IF v_guard.p_status <> 'OK' THEN
            RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
        END IF;
        v_actual_player_id := v_guard.p_player_id;
    ELSE
        v_actual_player_id := resolve_player_id(p_player_id);
        IF v_actual_player_id IS NULL OR v_actual_player_id = '' THEN
            v_actual_player_id := LOWER(TRIM(COALESCE(p_player_id, '')));
        END IF;
    END IF;

    -- Security Guard: Check if player account is suspended
    IF EXISTS (SELECT 1 FROM public.users WHERE player_id = v_actual_player_id AND is_banned = true) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player account suspended for security violations');
    END IF;

    -- 3. Anti-Cheat: Reject bulk drop amounts (strictly 1 relic per event)
    IF p_amount IS NOT NULL AND p_amount > 1 THEN
        IF NOT v_is_internal AND NOT v_is_admin THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_bulk_amount',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'amount', p_amount, 'source', 'direct_rpc_probe')
            );
        END IF;
        RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
    END IF;

    -- 4. Anti-Cheat: Bind client drops directly to an active, validated arcade session
    IF NOT v_is_internal AND NOT v_is_admin THEN
        -- Case A: Missing Session ID
        IF p_session_id IS NULL OR TRIM(p_session_id) = '' THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_missing_session',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'amount', p_amount, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;

        -- Case B: Malformed UUID
        BEGIN
            v_session_uuid := p_session_id::UUID;
        EXCEPTION WHEN OTHERS THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_malformed_session_uuid',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'session_id', p_session_id, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END;

        -- Case C: Session lookup
        SELECT * INTO v_session
        FROM public.arcade_sessions
        WHERE id = v_session_uuid
        FOR UPDATE;

        IF NOT FOUND THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_session_not_found',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'session_id', p_session_id, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;

        -- Case D: Session belonging to another player (Identity spoofing)
        IF LOWER(v_session.player_id) <> LOWER(v_actual_player_id) THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_stolen_session',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'session_id', p_session_id, 'session_owner', v_session.player_id, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;

        -- Case E: Inactive / Finished Session
        IF v_session.status <> 'in_progress' THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_inactive_session',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'session_id', p_session_id, 'session_status', v_session.status, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;

        -- Case F: Max 3 relics per session
        IF COALESCE(v_session.relics_dropped_count, 0) >= 3 THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_capacity_exceeded',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'session_id', p_session_id, 'source', 'direct_rpc_probe')
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;

        -- Update session relic counters
        UPDATE public.arcade_sessions
        SET relics_dropped_count = COALESCE(relics_dropped_count, 0) + 1,
            last_relic_dropped_at = NOW()
        WHERE id = v_session_uuid;
    END IF;

    -- 5. Strict Whitelist Validation (Season 1)
    -- Both arcade games and PolySpace can drop Season 1 relics including Mythic Apex
    IF v_clean_relic_id NOT IN (
        -- AstroDodge (Serie 1)
        'relic_astrododge_prism', 'relic_astrododge_deflector', 'relic_astrododge_compass',
        -- Cyber Invaders (Serie 1)
        'relic_invaders_core', 'relic_invaders_dynamo', 'relic_invaders_transmitter',
        -- Cyber Drift (Serie 1)
        'relic_drift_chronometer', 'relic_drift_capacitor', 'relic_drift_overdrive',
        -- Cyber Stacker (Serie 1)
        'relic_stacker_foundation', 'relic_stacker_keystone', 'relic_stacker_monolith',
        -- PolySpace Fleet (Serie 1)
        'relic_space_darkmatter', 'relic_space_warpcoil', 'relic_space_plasma',
        -- Universal Apex (Serie 1) - Allowed across all games
        'relic_apex_singularity', 'relic_apex_genesis'
    ) THEN
        -- Allow Season 2 ONLY if admin passkey is verified
        IF v_is_admin AND v_clean_relic_id IN (
            'relic_exp1_a', 'relic_exp1_b', 'relic_exp1_c',
            'relic_exp2_a', 'relic_exp2_b', 'relic_exp2_c',
            'relic_exp3_a', 'relic_exp3_b', 'relic_exp3_c'
        ) THEN
            -- Allowed for Admin
            NULL;
        ELSE
            IF NOT v_is_internal AND NOT v_is_admin THEN
                PERFORM public.record_bot_warning(
                    v_actual_player_id,
                    'unauthorized_relic_probe_invalid_id',
                    'Relics System',
                    jsonb_build_object('relic_id', v_clean_relic_id, 'source', 'direct_rpc_probe')
                );
            END IF;
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed');
        END IF;
    END IF;

    -- 6. Persist to Player Ledger
    SELECT relics INTO v_current_relics
    FROM public.users
    WHERE player_id = v_actual_player_id
    FOR UPDATE;

    IF v_current_relics IS NULL THEN
        v_current_relics := '{}'::jsonb;
    END IF;

    IF v_current_relics ? v_clean_relic_id THEN
        v_relic_obj := v_current_relics -> v_clean_relic_id;
        v_total := COALESCE((v_relic_obj ->> 'total')::INT, 0) + COALESCE(p_amount, 1);
        v_unminted := COALESCE((v_relic_obj ->> 'unminted')::INT, 0) + COALESCE(p_amount, 1);
        v_onchain := COALESCE((v_relic_obj ->> 'onchain')::INT, 0);
        v_token_ids := COALESCE(v_relic_obj -> 'token_ids', '[]'::jsonb);
    ELSE
        v_total := COALESCE(p_amount, 1);
        v_unminted := COALESCE(p_amount, 1);
        v_onchain := 0;
        v_token_ids := '[]'::jsonb;
    END IF;

    v_updated_relics := jsonb_set(
        v_current_relics,
        ARRAY[v_clean_relic_id],
        jsonb_build_object(
            'total', v_total,
            'unminted', v_unminted,
            'onchain', v_onchain,
            'token_ids', v_token_ids
        )
    );

    UPDATE public.users
    SET relics = v_updated_relics,
        updated_at = NOW()
    WHERE player_id = v_actual_player_id;

    RETURN jsonb_build_object(
        'success', true,
        'relic_id', v_clean_relic_id,
        'added', COALESCE(p_amount, 1),
        'new_total', v_total,
        'relics', v_updated_relics
    );
END;
$$;

-- Backward-compatible 3-argument wrapper
CREATE OR REPLACE FUNCTION public.grant_relic_drop(
    p_player_id TEXT,
    p_relic_id TEXT,
    p_amount INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.grant_relic_drop(p_player_id, p_relic_id, p_amount, NULL, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_relic_drop(TEXT, TEXT, INT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.grant_relic_drop(TEXT, TEXT, INT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.grant_relic_drop(TEXT, TEXT, INT, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_relic_drop(TEXT, TEXT, INT) FROM anon;
