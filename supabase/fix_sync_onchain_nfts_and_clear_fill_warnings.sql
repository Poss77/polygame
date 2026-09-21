-- ==============================================================================
-- POLYGON GAMING MIGRATION: FIX SYNC_ONCHAIN_NFTS & RESET FALSE BOT WARNINGS
-- ==============================================================================
-- Target: Supabase SQL Editor
-- Purpose:
-- 1. Fix public.sync_onchain_nfts to safely skip non-multiplier items (such as
--    nft_vip_pass and nft_relic_seeker) WITHOUT firing false positive bot warnings.
-- 2. Clear false positive bot warnings and security logs for user "Fill"
--    (player_id: 0xg0761cd80ab9048fb97cc1b43a80e9f7b0000000) triggered by page refreshes.
-- 3. Grant EXECUTE on sync_onchain_nfts to authenticated, service_role, and anon.
-- ==============================================================================

-- 1. Hardened sync_onchain_nfts RPC
DROP FUNCTION IF EXISTS public.sync_onchain_nfts(TEXT, JSONB);
DROP FUNCTION IF EXISTS sync_onchain_nfts(TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.sync_onchain_nfts(
    p_player_id TEXT,
    p_chain_nfts JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_actual_player_id TEXT;
    v_user RECORD;
    v_sanitized JSONB := '[]'::jsonb;
    v_elem TEXT;
    v_allowed_chain_nfts CONSTANT TEXT[] := ARRAY[
        'nft_common_boost', 'nft_silver_charger', 'nft_gold_turbine',
        'nft_rare_shield', 'nft_pulse_blaster', 'nft_epic_yield',
        'nft_referral_beacon', 'nft_affiliate_guild', 'nft_legendary_king',
        'nft_yield_vault', 'nft_yield_vault_rare', 'nft_yield_vault_epic'
    ];
    v_guard RECORD;
BEGIN
    -- Authenticate caller & anti-framing guard
    v_guard := public.assert_caller_player_id(p_player_id);
    IF v_guard.p_status <> 'OK' THEN
        RETURN '[]'::jsonb;
    END IF;
    v_actual_player_id := v_guard.p_player_id;

    SELECT player_id, linked_wallet_address, is_admin, COALESCE(owned_nfts, '[]'::jsonb) AS owned_nfts
    INTO v_user
    FROM public.users
    WHERE LOWER(player_id) = LOWER(v_actual_player_id)
       OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_actual_player_id)
    LIMIT 1;

    IF v_user IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    -- Security Guard 1: Must have a valid linked Web3 wallet to claim any on-chain NFTs
    IF v_user.linked_wallet_address IS NULL OR TRIM(v_user.linked_wallet_address) = '' OR NOT (LOWER(v_user.linked_wallet_address) ~ '^0x[a-f0-9]{40}$') THEN
        RETURN v_user.owned_nfts;
    END IF;

    -- Security Guard 2: Filter and sanitize verified multiplier NFTs
    IF p_chain_nfts IS NOT NULL AND jsonb_typeof(p_chain_nfts) = 'array' THEN
        FOR v_elem IN SELECT jsonb_array_elements_text(p_chain_nfts) LOOP
            v_elem := LOWER(TRIM(COALESCE(v_elem, '')));
            
            -- Non-multiplier items (e.g. VIP passes, consumable passes, unknown IDs) are silently skipped
            -- Never penalize legitimate players who hold VIP passes or other tokens in their wallet!
            IF v_elem = '' OR v_elem LIKE 'nft_vip_pass%' OR v_elem = 'nft_relic_seeker' OR NOT (v_elem = ANY(v_allowed_chain_nfts)) THEN
                CONTINUE;
            END IF;

            -- Avoid duplicates in v_sanitized
            IF NOT (v_sanitized ? v_elem) THEN
                v_sanitized := v_sanitized || jsonb_build_array(v_elem);
            END IF;
        END LOOP;
    END IF;

    UPDATE public.users
    SET owned_nfts = v_sanitized,
        updated_at = NOW()
    WHERE player_id = v_user.player_id;

    RETURN v_sanitized;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_onchain_nfts(TEXT, JSONB) TO authenticated, service_role, anon;

-- 2. Clear False Positive Bot Warnings for "Fill" (0xg0761cd80ab9048fb97cc1b43a80e9f7b0000000)
DELETE FROM public.bot_security_logs 
WHERE (player_id = '0xg0761cd80ab9048fb97cc1b43a80e9f7b0000000' OR LOWER(player_id) = '0x471f7c66c60806c9d04d07a2fb8838d80d144355')
  AND reason = 'nft_sync_invalid_item';

UPDATE public.users
SET bot_warning = 0,
    updated_at = NOW()
WHERE player_id = '0xg0761cd80ab9048fb97cc1b43a80e9f7b0000000'
   OR LOWER(linked_wallet_address) = '0x471f7c66c60806c9d04d07a2fb8838d80d144355';
