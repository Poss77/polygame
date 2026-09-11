-- ==============================================================================
-- POLYGON GAMING - MIGRATION: FIX QUANTUM RELIC DROPS & RESTORE MAVILYON
-- Migration: fix_relic_drops_and_restore_mavilyon.sql
-- Version: v1.5.346
-- ==============================================================================
--
-- CONTEXT:
-- 1. In v1.5.338, execution on grant_relic_drop was revoked from public, anon, and
--    authenticated roles as part of anti-cheat hardening.
-- 2. Because PolyGame runs client-side on GitHub Pages without a Node backend,
--    players discovering relics during arcade gameplay (Astro-Dodge, Cyber Invaders,
--    Cyber Drift, Cyber Stacker) received HTTP 401/403 Permission Denied.
-- 3. Combined with the anti-cheat trigger preventing direct table updates to
--    users.relics from client saveToDB(), newly discovered relics were not persisted.
-- 4. This migration:
--    a) Re-deploys canonical grant_relic_drop with SECURITY DEFINER, strict
--       validation of relic IDs, enforcement of p_amount = 1, and grants
--       execution back to anon, authenticated, and service_role.
--    b) Restores the 4 collected relics to player Mavilyon (0xpgt3d8ee006).
-- ==============================================================================

-- 1. DROP EXISTING OVERLOADS (IF ANY)
DROP FUNCTION IF EXISTS public.grant_relic_drop(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.grant_relic_drop(TEXT, TEXT, INT) CASCADE;

-- 2. RE-DEPLOY SECURE CANONICAL grant_relic_drop RPC
CREATE OR REPLACE FUNCTION public.grant_relic_drop(
    p_player_id TEXT,
    p_relic_id TEXT,
    p_amount INT DEFAULT 1
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
BEGIN
    -- Fallback ID sanitization
    IF v_actual_player_id IS NULL OR v_actual_player_id = '' THEN
        v_actual_player_id := LOWER(TRIM(COALESCE(p_player_id, '')));
    END IF;

    -- Anti-Cheat Protection 1: Reject bulk drop amounts (clients can only drop 1 relic per gameplay discovery event)
    IF p_amount IS NOT NULL AND p_amount > 1 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid drop amount: client drops are strictly limited to 1 relic per event');
    END IF;

    -- Anti-Cheat Protection 2: Whitelist validation of registered Season 1 & Expansion Relics
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
        'relic_exp1_a', 'relic_exp1_b', 'relic_exp2_a', 'relic_exp2_b'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or unregistered relic ID');
    END IF;

    -- Row lock player row
    SELECT COALESCE(relics, '{}'::jsonb)
    INTO v_current_relics
    FROM public.users
    WHERE player_id = v_actual_player_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player not found');
    END IF;

    -- Calculate updated unminted and total counts (+1 exactly)
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

    -- Atomic persistence (SECURITY DEFINER runs as postgres and bypasses client anti-cheat trigger)
    UPDATE public.users
    SET relics = v_updated_relics,
        updated_at = NOW()
    WHERE player_id = v_actual_player_id;

    RETURN v_updated_relics;
END;
$$;

-- Grant execution to all client and service roles
GRANT EXECUTE ON FUNCTION public.grant_relic_drop(TEXT, TEXT, INT) TO anon, authenticated, service_role;

-- ==============================================================================
-- 3. RESTORATION FOR PLAYER MAVILYON (0xpgt3d8ee006)
-- Restores the 4 harvested Quantum Relics:
--   1) relic_astrododge_prism (Quantum Prism)
--   2) relic_astrododge_deflector (Kinetic Deflector)
--   3) relic_invaders_core (Pulsar Core)
--   4) relic_invaders_dynamo (Warp Dynamo)
-- ==============================================================================
DO $$
DECLARE
    v_target_id TEXT := '0xpgt3d8ee006';
    v_current_r JSONB;
    v_restored_r JSONB;
BEGIN
    SELECT COALESCE(relics, '{}'::jsonb) INTO v_current_r
    FROM public.users
    WHERE player_id = v_target_id
       OR linked_wallet_address = '0x62688fdffc7b17f973867b20da99653d2ee9cd99'
    LIMIT 1;

    IF v_current_r IS NOT NULL THEN
        -- Safely merge the 4 relics
        v_restored_r := v_current_r;

        -- 1. Quantum Prism
        v_restored_r := jsonb_set(
            v_restored_r,
            '{relic_astrododge_prism}',
            jsonb_build_object(
                'total', GREATEST(1, COALESCE((v_restored_r->'relic_astrododge_prism'->>'total')::int, 0) + 1),
                'unminted', GREATEST(1, COALESCE((v_restored_r->'relic_astrododge_prism'->>'unminted')::int, 0) + 1),
                'onchain', COALESCE((v_restored_r->'relic_astrododge_prism'->>'onchain')::int, 0),
                'token_ids', COALESCE(v_restored_r->'relic_astrododge_prism'->'token_ids', '[]'::jsonb)
            ),
            true
        );

        -- 2. Kinetic Deflector
        v_restored_r := jsonb_set(
            v_restored_r,
            '{relic_astrododge_deflector}',
            jsonb_build_object(
                'total', GREATEST(1, COALESCE((v_restored_r->'relic_astrododge_deflector'->>'total')::int, 0) + 1),
                'unminted', GREATEST(1, COALESCE((v_restored_r->'relic_astrododge_deflector'->>'unminted')::int, 0) + 1),
                'onchain', COALESCE((v_restored_r->'relic_astrododge_deflector'->>'onchain')::int, 0),
                'token_ids', COALESCE(v_restored_r->'relic_astrododge_deflector'->'token_ids', '[]'::jsonb)
            ),
            true
        );

        -- 3. Pulsar Core
        v_restored_r := jsonb_set(
            v_restored_r,
            '{relic_invaders_core}',
            jsonb_build_object(
                'total', GREATEST(1, COALESCE((v_restored_r->'relic_invaders_core'->>'total')::int, 0) + 1),
                'unminted', GREATEST(1, COALESCE((v_restored_r->'relic_invaders_core'->>'unminted')::int, 0) + 1),
                'onchain', COALESCE((v_restored_r->'relic_invaders_core'->>'onchain')::int, 0),
                'token_ids', COALESCE(v_restored_r->'relic_invaders_core'->'token_ids', '[]'::jsonb)
            ),
            true
        );

        -- 4. Warp Dynamo
        v_restored_r := jsonb_set(
            v_restored_r,
            '{relic_invaders_dynamo}',
            jsonb_build_object(
                'total', GREATEST(1, COALESCE((v_restored_r->'relic_invaders_dynamo'->>'total')::int, 0) + 1),
                'unminted', GREATEST(1, COALESCE((v_restored_r->'relic_invaders_dynamo'->>'unminted')::int, 0) + 1),
                'onchain', COALESCE((v_restored_r->'relic_invaders_dynamo'->>'onchain')::int, 0),
                'token_ids', COALESCE(v_restored_r->'relic_invaders_dynamo'->'token_ids', '[]'::jsonb)
            ),
            true
        );

        UPDATE public.users
        SET relics = v_restored_r,
            activities = jsonb_insert(
                COALESCE(activities, '[]'::jsonb),
                '{0}',
                jsonb_build_object(
                    'time', TO_CHAR(NOW() AT TIME ZONE 'UTC', 'HH24:MI:SS'),
                    'user', 'You',
                    'action', 'restored 4 Quantum Relics harvested during arcade gameplay',
                    'reward', '+4 Relics'
                ),
                true
            ),
            updated_at = NOW()
        WHERE player_id = v_target_id
           OR linked_wallet_address = '0x62688fdffc7b17f973867b20da99653d2ee9cd99';

        RAISE NOTICE 'Successfully restored 4 Quantum Relics for player Mavilyon (%)', v_target_id;
    ELSE
        RAISE WARNING 'Player Mavilyon not found for relic restoration';
    END IF;
END $$;

-- ==============================================================================
-- 4. VERIFICATION QUERY
-- ==============================================================================
SELECT
    player_id,
    username,
    linked_wallet_address,
    relics,
    updated_at
FROM public.users
WHERE player_id = '0xpgt3d8ee006'
   OR linked_wallet_address = '0x62688fdffc7b17f973867b20da99653d2ee9cd99';
