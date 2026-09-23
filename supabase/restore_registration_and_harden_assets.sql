-- ==============================================================================
-- POLYGON GAMING — RESTORE REGISTRATION & HARDEN ON-CHAIN ASSETS (v1.5.454)
-- ==============================================================================
-- Purpose:
--   1. Restore Open Account Registration for Guest & Web3 Wallets:
--      - Re-enable INSERT and UPDATE on public.users for the anon role so visitors
--        connecting via MetaMask, Coinbase, or playing as Guests can register.
--      - Security is 100% maintained by the master prevent_direct_balance_mutation()
--        trigger (SECURITY INVOKER) which sanitizes all newly inserted rows (zeroing
--        balance, VIP, admin flags, highscores, and relics) and intercepts cheating on updates.
--
--   2. Seal NFT & Quantum Relic Injection Attack Surfaces:
--      - Revoke sync_onchain_nfts from PUBLIC, anon, and authenticated.
--      - Revoke sync_onchain_relics from PUBLIC, anon, and authenticated.
--      - Restrict execution strictly to service_role (called only by the secure
--        sync-assets Edge Function after verifying token ownership on Polygon).
--
--   3. Lockdown submit_arcade_highscore:
--      - Revoke execution from PUBLIC, anon, and authenticated.
--      - Enforces that arcade high scores can only be recorded via legitimate,
--        time-verified gameplay sessions through end_arcade_session.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RESTORE OPEN ACCOUNT REGISTRATION FOR GUESTS & WEB3 WALLETS
-- ------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON TABLE public.users TO anon, authenticated, service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read users" ON public.users;
CREATE POLICY "Allow public read users" ON public.users 
  FOR SELECT TO anon, authenticated, service_role USING (true);

DROP POLICY IF EXISTS "Allow public insert users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated insert users" ON public.users;
CREATE POLICY "Allow public insert users" ON public.users 
  FOR INSERT TO anon, authenticated, service_role WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated update users" ON public.users;
CREATE POLICY "Allow public update users" ON public.users 
  FOR UPDATE TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 2. HARDEN sync_onchain_nfts (SERVICE_ROLE ONLY)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sync_onchain_nfts(TEXT, JSONB);
DROP FUNCTION IF EXISTS sync_onchain_nfts(TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.sync_onchain_nfts(
    p_player_id TEXT,
    p_chain_nfts JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
BEGIN
    v_actual_player_id := public.resolve_player_id(p_player_id);
    IF v_actual_player_id IS NULL THEN
        v_actual_player_id := LOWER(TRIM(p_player_id));
    END IF;

    SELECT player_id, linked_wallet_address, COALESCE(owned_nfts, '[]'::jsonb) AS owned_nfts
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
            IF v_elem = '' OR v_elem LIKE 'nft_vip_pass%' OR v_elem = 'nft_relic_seeker' OR NOT (v_elem = ANY(v_allowed_chain_nfts)) THEN
                CONTINUE;
            END IF;

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

REVOKE ALL ON FUNCTION public.sync_onchain_nfts(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_onchain_nfts(TEXT, JSONB) TO service_role;

-- ------------------------------------------------------------------------------
-- 3. HARDEN sync_onchain_relics (SERVICE_ROLE ONLY)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sync_onchain_relics(TEXT, JSONB);
DROP FUNCTION IF EXISTS sync_onchain_relics(TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.sync_onchain_relics(
    p_player_id TEXT,
    p_chain_relics JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actual_player_id TEXT;
    v_current_relics JSONB;
    v_updated_relics JSONB := '{}'::jsonb;
    v_key TEXT;
    v_item JSONB;
    v_unminted INT;
    v_onchain INT;
    v_token_ids JSONB;
    v_total INT;
BEGIN
    v_actual_player_id := public.resolve_player_id(p_player_id);
    IF v_actual_player_id IS NULL THEN
        v_actual_player_id := LOWER(TRIM(p_player_id));
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

REVOKE ALL ON FUNCTION public.sync_onchain_relics(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_onchain_relics(TEXT, JSONB) TO service_role;

-- ------------------------------------------------------------------------------
-- 4. LOCKDOWN submit_arcade_highscore (SERVICE_ROLE ONLY)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION public.submit_arcade_highscore(
  p_player_id TEXT,
  p_game_highscore INTEGER DEFAULT NULL,
  p_invaders_highscore INTEGER DEFAULT NULL,
  p_drift_highscore INTEGER DEFAULT NULL,
  p_stacker_highscore INTEGER DEFAULT NULL,
  p_catcher_highscore INTEGER DEFAULT NULL,
  p_skeet_highscore INTEGER DEFAULT NULL,
  p_defense_highscore INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := public.resolve_player_id(p_player_id);
  v_stacker_val INTEGER := COALESCE(p_stacker_highscore, p_catcher_highscore);
  v_max_score INTEGER := 0;
BEGIN
  IF v_pid IS NULL THEN
    v_pid := LOWER(TRIM(p_player_id));
  END IF;

  v_max_score := GREATEST(
    COALESCE(p_game_highscore, 0),
    COALESCE(p_invaders_highscore, 0),
    COALESCE(p_drift_highscore, 0),
    COALESCE(v_stacker_val, 0),
    COALESCE(p_skeet_highscore, 0),
    COALESCE(p_defense_highscore, 0)
  );

  IF v_max_score > 500000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Score exceeds 500,000 ceiling.');
  END IF;

  UPDATE public.users
  SET 
    game_highscore = GREATEST(COALESCE(game_highscore, 0), LEAST(COALESCE(p_game_highscore, 0), 500000)),
    invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), LEAST(COALESCE(p_invaders_highscore, 0), 500000)),
    drift_highscore = GREATEST(COALESCE(drift_highscore, 0), LEAST(COALESCE(p_drift_highscore, 0), 500000)),
    stacker_highscore = GREATEST(COALESCE(stacker_highscore, 0), LEAST(COALESCE(v_stacker_val, 0), 500000)),
    skeet_highscore = GREATEST(COALESCE(skeet_highscore, 0), LEAST(COALESCE(p_skeet_highscore, 0), 500000)),
    defense_highscore = GREATEST(COALESCE(defense_highscore, 0), LEAST(COALESCE(p_defense_highscore, 0), 500000)),
    alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), COALESCE(game_highscore, 0), LEAST(COALESCE(p_game_highscore, 0), 500000)),
    alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), COALESCE(invaders_highscore, 0), LEAST(COALESCE(p_invaders_highscore, 0), 500000)),
    alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), COALESCE(drift_highscore, 0), LEAST(COALESCE(p_drift_highscore, 0), 500000)),
    alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), COALESCE(stacker_highscore, 0), LEAST(COALESCE(v_stacker_val, 0), 500000)),
    alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), COALESCE(skeet_highscore, 0), LEAST(COALESCE(p_skeet_highscore, 0), 500000)),
    defense_alltime_best = GREATEST(COALESCE(defense_alltime_best, 0), COALESCE(defense_highscore, 0), LEAST(COALESCE(p_defense_highscore, 0), 500000)),
    updated_at = NOW()
  WHERE player_id = v_pid;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_arcade_highscore(TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO service_role;
