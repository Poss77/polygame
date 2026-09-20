-- 3. QUANTUM RELICS SYSTEM (SESSION-BOUND & ON-CHAIN SYNC)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: grant_relic_drop
-- Source: bind_relic_drops_to_arcade_session.sql
-- ------------------------------------------------------------------------------
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

    -- Security Guard: Check if player account is suspended
    IF EXISTS (SELECT 1 FROM public.users WHERE player_id = v_actual_player_id AND is_banned = true) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player account suspended for security violations');
    END IF;

    -- Admin bypass verification if passkey is provided
    IF p_admin_passkey IS NOT NULL AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'verify_admin_passkey') THEN
        v_is_admin := verify_admin_passkey(p_admin_passkey);
    END IF;

    -- Anti-Cheat Protection 1: Reject bulk drop amounts (strictly 1 relic per drop event)
    IF p_amount IS NOT NULL AND p_amount > 1 THEN
        IF NOT v_is_internal AND NOT v_is_admin THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_bulk_amount',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'amount', p_amount, 'source', 'direct_rpc_probe')
            );
        END IF;
        RETURN jsonb_build_object('success', false, 'error', 'Invalid drop amount: client drops are strictly limited to 1 relic per event');
    END IF;

    -- Anti-Cheat Protection 2: Bound drops directly to active arcade session or verified internal caller
    IF NOT v_is_internal AND NOT v_is_admin THEN
        -- Case A: Missing Session ID (Direct browser console or headless script attack)
        IF p_session_id IS NULL OR TRIM(p_session_id) = '' THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_missing_session',
                'Relics System',
                jsonb_build_object(
                    'relic_id', v_clean_relic_id,
                    'amount', p_amount,
                    'source', 'direct_rpc_probe'
                )
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed: No active arcade session associated with this discovery');
        END IF;

        -- Case B: Malformed UUID
        BEGIN
            v_session_uuid := p_session_id::UUID;
        EXCEPTION WHEN OTHERS THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_malformed_session_uuid',
                'Relics System',
                jsonb_build_object(
                    'relic_id', v_clean_relic_id,
                    'session_id', p_session_id,
                    'source', 'direct_rpc_probe'
                )
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed: Malformed arcade session identifier');
        END;

        -- Case C: Session lookup & ownership validation
        SELECT * INTO v_session
        FROM public.arcade_sessions
        WHERE id = v_session_uuid
        FOR UPDATE;

        IF NOT FOUND THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_session_not_found',
                'Relics System',
                jsonb_build_object(
                    'relic_id', v_clean_relic_id,
                    'session_id', p_session_id,
                    'source', 'direct_rpc_probe'
                )
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed: Arcade session not found');
        END IF;

        -- Case D: Session belonging to another player (Identity spoofing)
        IF LOWER(v_session.player_id) <> LOWER(v_actual_player_id) THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_stolen_session',
                'Relics System',
                jsonb_build_object(
                    'relic_id', v_clean_relic_id,
                    'session_id', p_session_id,
                    'session_owner', v_session.player_id,
                    'source', 'direct_rpc_probe'
                )
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed: Arcade session belongs to another player profile');
        END IF;

        -- Case E: Session already finalized or abandoned
        IF v_session.status <> 'in_progress' THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_inactive_session',
                'Relics System',
                jsonb_build_object(
                    'relic_id', v_clean_relic_id,
                    'session_id', p_session_id,
                    'session_status', v_session.status,
                    'source', 'direct_rpc_probe'
                )
            );
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed: Arcade session is already concluded or invalid');
        END IF;

        -- Case F: Premature discovery check (< 15 seconds)
        IF EXTRACT(EPOCH FROM (NOW() - COALESCE(v_session.started_at, v_session.created_at))) < 15 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed: Insufficient session survival duration (<15s)');
        END IF;

        -- Case G: Rate limit cooldown (< 45 seconds between consecutive relics)
        IF v_session.last_relic_dropped_at IS NOT NULL AND EXTRACT(EPOCH FROM (NOW() - v_session.last_relic_dropped_at)) < 45 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed: Discovery frequency rate limit exceeded (cooldown active)');
        END IF;

        -- Case H: Session capacity check (max 3 relics per session)
        IF COALESCE(v_session.relics_dropped_count, 0) >= 3 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Relic resonance check failed: Maximum relic drop capacity reached for this run');
        END IF;

        -- Update session relic counters
        UPDATE public.arcade_sessions
        SET relics_dropped_count = COALESCE(relics_dropped_count, 0) + 1,
            last_relic_dropped_at = NOW()
        WHERE id = v_session_uuid;
    END IF;

    -- Whitelist validation of registered Season 1 & Expansion Relics
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
        -- Universal Apex (Serie 1)
        'relic_apex_singularity', 'relic_apex_genesis',
        -- Serie 2 Expansions
        'relic_exp1_a', 'relic_exp1_b', 'relic_exp1_c',
        'relic_exp2_a', 'relic_exp2_b', 'relic_exp2_c',
        'relic_exp3_a', 'relic_exp3_b', 'relic_exp3_c'
    ) THEN
        IF NOT v_is_internal AND NOT v_is_admin THEN
            PERFORM public.record_bot_warning(
                v_actual_player_id,
                'unauthorized_relic_probe_invalid_id',
                'Relics System',
                jsonb_build_object('relic_id', v_clean_relic_id, 'source', 'direct_rpc_probe')
            );
        END IF;
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or unregistered relic ID');
    END IF;

    -- Mythic Apex Relics restricted to PolySpace Deep Void (Internal Postgres) or Admin
    IF v_clean_relic_id IN ('relic_apex_singularity', 'relic_apex_genesis') AND NOT v_is_internal AND NOT v_is_admin THEN
        PERFORM public.record_bot_warning(
            v_actual_player_id,
            'unauthorized_apex_relic_probe',
            'Relics System',
            jsonb_build_object('relic_id', v_clean_relic_id, 'source', 'direct_rpc_probe')
        );
        RETURN jsonb_build_object('success', false, 'error', 'Universal Apex Relics can only be discovered via Deep Space Expeditions');
    END IF;

    -- Fetch and row-lock current player's relics ledger
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

GRANT EXECUTE ON FUNCTION public.grant_relic_drop(TEXT, TEXT, INT, TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: sync_onchain_relics
-- Source: restore_poss_relics_and_shield_all_users.sql
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_onchain_relics(
    p_player_id TEXT,
    p_chain_relics JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actual_player_id TEXT := resolve_player_id(p_player_id);
    v_current_relics JSONB;
    v_updated_relics JSONB := '{}'::jsonb;
    v_key TEXT;
    v_item JSONB;
    v_unminted INT;
    v_onchain INT;
    v_token_ids JSONB;
    v_total INT;
BEGIN
    IF v_actual_player_id IS NULL OR v_actual_player_id = '' THEN
        v_actual_player_id := LOWER(TRIM(COALESCE(p_player_id, '')));
    END IF;

    SELECT COALESCE(relics, '{}'::jsonb) INTO v_current_relics
    FROM public.users
    WHERE player_id = v_actual_player_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player not found');
    END IF;

    -- 1. Initialize result with all existing relics from DB, strictly preserving unminted counts
    FOR v_key IN SELECT jsonb_object_keys(v_current_relics) LOOP
        v_item := v_current_relics->v_key;
        v_unminted := COALESCE((v_item->>'unminted')::int, 0);
        v_updated_relics := jsonb_set(
            v_updated_relics,
            ARRAY[v_key],
            jsonb_build_object(
                'unminted', v_unminted,
                'onchain', 0,
                'total', v_unminted,
                'token_ids', '[]'::jsonb
            ),
            true
        );
    END LOOP;

    -- 2. Overlay verified on-chain counts & token IDs from p_chain_relics
    IF p_chain_relics IS NOT NULL AND jsonb_typeof(p_chain_relics) = 'object' THEN
        FOR v_key IN SELECT jsonb_object_keys(p_chain_relics) LOOP
            v_onchain := COALESCE((p_chain_relics->v_key->>'onchain')::int, 0);
            v_token_ids := COALESCE(p_chain_relics->v_key->'token_ids', '[]'::jsonb);
            
            IF v_updated_relics ? v_key THEN
                v_unminted := COALESCE((v_updated_relics->v_key->>'unminted')::int, 0);
            ELSE
                v_unminted := 0;
            END IF;

            v_total := v_unminted + v_onchain;

            v_updated_relics := jsonb_set(
                v_updated_relics,
                ARRAY[v_key],
                jsonb_build_object(
                    'unminted', v_unminted,
                    'onchain', v_onchain,
                    'total', v_total,
                    'token_ids', v_token_ids
                ),
                true
            );
        END LOOP;
    END IF;

    UPDATE public.users
    SET relics = v_updated_relics,
        updated_at = NOW()
    WHERE player_id = v_actual_player_id;

    RETURN v_updated_relics;
END;
$$;
GRANT EXECUTE ON FUNCTION public.sync_onchain_relics(TEXT, JSONB) TO anon, authenticated, service_role;


-- ==============================================================================
