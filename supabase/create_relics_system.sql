-- ==============================================================================
-- POLYGAME QUANTUM RELICS SYSTEM MIGRATION SCRIPT
-- Adds 'relics' JSONB column and secure atomic helper RPCs to Supabase.
-- ==============================================================================

-- 1. Add 'relics' JSONB column to users table if not present
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'relics'
    ) THEN
        ALTER TABLE public.users ADD COLUMN relics JSONB DEFAULT '{}'::jsonb;
        COMMENT ON COLUMN public.users.relics IS 'Multi-quantity Quantum Relics stash (unminted and on-chain counts)';
    END IF;
END $$;

-- Drop previous versions to avoid parameter name mismatch (42P13)
DROP FUNCTION IF EXISTS public.grant_relic_drop(TEXT, TEXT, INT) CASCADE;
DROP FUNCTION IF EXISTS public.grant_relic_drop(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.mark_relic_minted(TEXT, TEXT, INT) CASCADE;

-- 2. Atomic RPC to grant an in-game unlocked relic drop
CREATE OR REPLACE FUNCTION public.grant_relic_drop(
    p_player_id TEXT,
    p_relic_id TEXT,
    p_amount INT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actual_player_id TEXT;
    v_current_relics JSONB;
    v_relic_obj JSONB;
    v_total INT;
    v_unminted INT;
    v_onchain INT;
    v_token_ids JSONB;
    v_updated_relics JSONB;
BEGIN
    -- Resolve synthetic player_id safely
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'resolve_player_id') THEN
        v_actual_player_id := public.resolve_player_id(p_player_id);
    ELSE
        SELECT player_id INTO v_actual_player_id FROM public.users 
        WHERE player_id = p_player_id OR LOWER(linked_wallet_address) = LOWER(p_player_id) 
        LIMIT 1;
    END IF;

    IF v_actual_player_id IS NULL THEN
        RAISE EXCEPTION 'Player not found: %', p_player_id;
    END IF;

    -- Fetch current relics JSONB with row lock
    SELECT COALESCE(relics, '{}'::jsonb) INTO v_current_relics
    FROM public.users
    WHERE player_id = v_actual_player_id
    FOR UPDATE;

    v_relic_obj := COALESCE(v_current_relics->p_relic_id, '{}'::jsonb);
    v_unminted := COALESCE((v_relic_obj->>'unminted')::int, 0) + p_amount;
    v_onchain := COALESCE((v_relic_obj->>'onchain')::int, 0);
    v_total := v_unminted + v_onchain;
    v_token_ids := COALESCE(v_relic_obj->'token_ids', '[]'::jsonb);

    -- Build updated relic JSON object
    v_relic_obj := jsonb_build_object(
        'total', v_total,
        'unminted', v_unminted,
        'onchain', v_onchain,
        'token_ids', v_token_ids
    );

    v_updated_relics := jsonb_set(v_current_relics, ARRAY[p_relic_id], v_relic_obj, true);

    UPDATE public.users
    SET relics = v_updated_relics,
        updated_at = NOW()
    WHERE player_id = v_actual_player_id;

    RETURN v_updated_relics;
END;
$$;

-- 3. Atomic RPC to mark an unminted relic as minted to Polygon
CREATE OR REPLACE FUNCTION public.mark_relic_minted(
    p_player_id TEXT,
    p_relic_id TEXT,
    p_token_id INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actual_player_id TEXT;
    v_current_relics JSONB;
    v_relic_obj JSONB;
    v_total INT;
    v_unminted INT;
    v_onchain INT;
    v_token_ids JSONB;
    v_updated_relics JSONB;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'resolve_player_id') THEN
        v_actual_player_id := public.resolve_player_id(p_player_id);
    ELSE
        SELECT player_id INTO v_actual_player_id FROM public.users 
        WHERE player_id = p_player_id OR LOWER(linked_wallet_address) = LOWER(p_player_id) 
        LIMIT 1;
    END IF;

    IF v_actual_player_id IS NULL THEN
        RAISE EXCEPTION 'Player not found: %', p_player_id;
    END IF;

    SELECT COALESCE(relics, '{}'::jsonb) INTO v_current_relics
    FROM public.users
    WHERE player_id = v_actual_player_id
    FOR UPDATE;

    v_relic_obj := COALESCE(v_current_relics->p_relic_id, '{}'::jsonb);
    v_unminted := GREATEST(0, COALESCE((v_relic_obj->>'unminted')::int, 0) - 1);
    v_onchain := COALESCE((v_relic_obj->>'onchain')::int, 0) + 1;
    v_total := v_unminted + v_onchain;
    v_token_ids := COALESCE(v_relic_obj->'token_ids', '[]'::jsonb);

    -- Append new token_id if not already present
    IF NOT v_token_ids @> to_jsonb(p_token_id) THEN
        v_token_ids := v_token_ids || to_jsonb(p_token_id);
    END IF;

    v_relic_obj := jsonb_build_object(
        'total', v_total,
        'unminted', v_unminted,
        'onchain', v_onchain,
        'token_ids', v_token_ids
    );

    v_updated_relics := jsonb_set(v_current_relics, ARRAY[p_relic_id], v_relic_obj, true);

    UPDATE public.users
    SET relics = v_updated_relics,
        updated_at = NOW()
    WHERE player_id = v_actual_player_id;

    RETURN v_updated_relics;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.grant_relic_drop(TEXT, TEXT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_relic_minted(TEXT, TEXT, INT) TO anon, authenticated, service_role;

-- 4. Anti-Cheat Trigger to prevent direct client mutation of 'relics'
CREATE OR REPLACE FUNCTION public.prevent_direct_relic_mutation()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow if relics column was not changed
    IF OLD.relics IS NOT DISTINCT FROM NEW.relics THEN
        RETURN NEW;
    END IF;

    -- If updated by direct client REST calls without RPC depth, block mutation
    IF current_user IN ('anon', 'authenticated') AND pg_trigger_depth() = 1 THEN
        RAISE EXCEPTION 'Direct client mutation of relics column is forbidden. Relics must be unlocked via verified gameplay RPCs.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_direct_relic_mutation ON public.users;
CREATE TRIGGER trg_prevent_direct_relic_mutation
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_direct_relic_mutation();
