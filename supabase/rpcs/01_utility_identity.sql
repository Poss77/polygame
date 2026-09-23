-- 1. UTILITY & IDENTITY RPCS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: resolve_player_id
-- Source: master_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.resolve_player_id(TEXT);
DROP FUNCTION IF EXISTS resolve_player_id(TEXT);

CREATE OR REPLACE FUNCTION resolve_player_id(p_wallet TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_clean TEXT := LOWER(TRIM(COALESCE(p_wallet, '')));
BEGIN
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  SELECT player_id INTO v_pid
  FROM users
  WHERE LOWER(player_id) = v_clean
     OR LOWER(COALESCE(linked_wallet_address, '')) = v_clean
     OR LOWER(COALESCE(user_id::TEXT, '')) = v_clean
  LIMIT 1;

  IF v_pid IS NOT NULL THEN
    RETURN v_pid;
  END IF;

  RETURN v_clean;
END;
$$;
GRANT EXECUTE ON FUNCTION resolve_player_id(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: compute_weekly_active_tier
-- Source: master_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.compute_weekly_active_tier(BIGINT, BIGINT);
DROP FUNCTION IF EXISTS public.compute_weekly_active_tier(INT, INT);
DROP FUNCTION IF EXISTS compute_weekly_active_tier(BIGINT, BIGINT);
DROP FUNCTION IF EXISTS compute_weekly_active_tier(INT, INT);

CREATE OR REPLACE FUNCTION compute_weekly_active_tier(p_faucets BIGINT, p_games BIGINT)
RETURNS INT 
LANGUAGE plpgsql 
IMMUTABLE 
AS $$
DECLARE
  v_f BIGINT := GREATEST(0, COALESCE(p_faucets, 0));
  v_g BIGINT := GREATEST(0, COALESCE(p_games, 0));
BEGIN
  IF v_f >= 6 AND v_g >= 50 THEN
    RETURN 5; -- 👑 Level 5: Apex Legend
  ELSIF v_f >= 5 AND v_g >= 25 THEN
    RETURN 4; -- 💎 Level 4: Elite Champion
  ELSIF v_f >= 3 AND v_g >= 5 THEN
    RETURN 3; -- 🥇 Level 3: Veteran
  ELSIF v_f >= 2 AND v_g >= 1 THEN
    RETURN 2; -- 🥈 Level 2: Contender
  ELSIF v_f >= 1 THEN
    RETURN 1; -- 🥉 Level 1: Scout
  ELSE
    RETURN 0; -- ⚪ Level 0: Dormant
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION compute_weekly_active_tier(p_faucets INT, p_games INT)
RETURNS INT 
LANGUAGE plpgsql 
IMMUTABLE 
AS $$
BEGIN
  RETURN compute_weekly_active_tier(p_faucets::BIGINT, p_games::BIGINT);
END;
$$;

GRANT EXECUTE ON FUNCTION compute_weekly_active_tier(BIGINT, BIGINT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION compute_weekly_active_tier(INT, INT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: is_season1_apex_unlocked
-- Source: master_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.is_season1_apex_unlocked(JSONB);
DROP FUNCTION IF EXISTS is_season1_apex_unlocked(JSONB);

CREATE OR REPLACE FUNCTION is_season1_apex_unlocked(p_relics JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_r JSONB := COALESCE(p_relics, '{}'::jsonb);
  v_val JSONB;
  v_owned_count INT := 0;
  v_ids TEXT[] := ARRAY[
    'relic_astrododge_prism',
    'relic_astrododge_deflector',
    'relic_astrododge_compass',
    'relic_invaders_core',
    'relic_invaders_dynamo',
    'relic_invaders_transmitter',
    'relic_drift_chronometer',
    'relic_drift_capacitor',
    'relic_drift_overdrive',
    'relic_stacker_foundation',
    'relic_stacker_keystone',
    'relic_stacker_monolith',
    'relic_space_darkmatter',
    'relic_space_warpcoil',
    'relic_space_plasma',
    'relic_apex_singularity',
    'relic_apex_genesis'
  ];
  v_id TEXT;
  v_is_owned BOOLEAN;
  v_num INT;
BEGIN
  IF v_r IS NULL OR v_r::text IN ('{}', 'null', '""', '[]') THEN
    RETURN false;
  END IF;

  FOREACH v_id IN ARRAY v_ids LOOP
    v_is_owned := false;
    v_val := v_r->v_id;

    -- Check known aliases if not found directly under canonical key
    IF v_val IS NULL THEN
      IF v_id = 'relic_astrododge_compass' THEN v_val := v_r->'relic_astrododge_chrono';
      ELSIF v_id = 'relic_invaders_core' THEN v_val := v_r->'relic_invaders_pulsar';
      ELSIF v_id = 'relic_drift_chronometer' THEN v_val := v_r->'relic_drift_tachometer';
      ELSIF v_id = 'relic_drift_capacitor' THEN v_val := v_r->'relic_drift_flux';
      ELSIF v_id = 'relic_drift_overdrive' THEN v_val := v_r->'relic_drift_supercharger';
      ELSIF v_id = 'relic_stacker_foundation' THEN v_val := v_r->'relic_stacker_bedrock';
      ELSIF v_id = 'relic_space_warpcoil' THEN v_val := v_r->'relic_space_coil';
      ELSIF v_id = 'relic_space_plasma' THEN v_val := v_r->'relic_space_harvester';
      END IF;
    END IF;

    IF v_val IS NOT NULL THEN
      -- Case 1: Object with total / unminted / onchain or token_ids
      IF jsonb_typeof(v_val) = 'object' THEN
        IF COALESCE((v_val->>'total')::int, 0) > 0 
           OR COALESCE((v_val->>'unminted')::int, 0) > 0 
           OR COALESCE((v_val->>'onchain')::int, 0) > 0 
           OR (v_val->'token_ids' IS NOT NULL AND jsonb_array_length(COALESCE(v_val->'token_ids', '[]'::jsonb)) > 0) THEN
          v_is_owned := true;
        END IF;
      -- Case 2: Direct number count
      ELSIF jsonb_typeof(v_val) = 'number' THEN
        IF (v_val::text)::int > 0 THEN
          v_is_owned := true;
        END IF;
      -- Case 3: Boolean flag
      ELSIF jsonb_typeof(v_val) = 'boolean' THEN
        IF (v_val::text)::boolean = true THEN
          v_is_owned := true;
        END IF;
      -- Case 4: String number
      ELSIF jsonb_typeof(v_val) = 'string' THEN
        BEGIN
          v_num := (v_val#>>'{}')::int;
          IF v_num > 0 THEN v_is_owned := true; END IF;
        EXCEPTION WHEN OTHERS THEN
          v_is_owned := true;
        END;
      END IF;
    END IF;

    IF v_is_owned THEN
      v_owned_count := v_owned_count + 1;
    END IF;
  END LOOP;

  RETURN (v_owned_count >= 17);
END;
$$;
GRANT EXECUTE ON FUNCTION is_season1_apex_unlocked(JSONB) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: get_user_referral_multiplier
-- Source: master_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_user_referral_multiplier(TEXT);
CREATE OR REPLACE FUNCTION get_user_referral_multiplier(p_wallet TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_user RECORD;
  v_nft_boost NUMERIC := 1.0;
  v_vip_mult NUMERIC := 1.0;
  v_amb_mult NUMERIC := 1.0;
BEGIN
  IF v_pid IS NULL THEN RETURN 1.0; END IF;

  SELECT vip_until, is_ambassador, owned_nfts INTO v_user
  FROM users WHERE player_id = v_pid;

  IF NOT FOUND THEN RETURN 1.0; END IF;

  -- 1. VIP boost (2.0x)
  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > NOW() THEN
    v_vip_mult := 2.0;
  END IF;

  -- 2. Ambassador boost (1.5x)
  IF v_user.is_ambassador = true THEN
    v_amb_mult := 1.5;
  END IF;

  -- 3. Utility NFT Referral boost
  IF v_user.owned_nfts IS NOT NULL AND jsonb_typeof(v_user.owned_nfts) = 'array' THEN
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_user.owned_nfts) elem WHERE elem->>'id' = 'nft_affiliate_guild') THEN
      v_nft_boost := 1.65;
    ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(v_user.owned_nfts) elem WHERE elem->>'id' = 'nft_referral_beacon') THEN
      v_nft_boost := 1.25;
    END IF;
  END IF;

  RETURN (v_nft_boost * v_vip_mult * v_amb_mult);
END;
$$;
GRANT EXECUTE ON FUNCTION get_user_referral_multiplier(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: process_referral_commissions
-- Source: master_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.process_referral_commissions(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.process_referral_commissions(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS process_referral_commissions(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS process_referral_commissions(TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.process_referral_commissions(
  claiming_wallet TEXT,
  claim_amount NUMERIC,
  claim_action TEXT DEFAULT 'Gameplay'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(claiming_wallet);
  v_downline RECORD;
  v_upline_pid TEXT;
  v_rates NUMERIC[] := ARRAY[0.10, 0.05, 0.02, 0.01]; -- 10%, 5%, 2%, 1%
  v_tier INTEGER;
  v_upline_keys TEXT[];
  v_mult NUMERIC;
  v_commission NUMERIC;
  v_downline_name TEXT;
  v_new_entry JSONB;
  v_time_str TEXT;
  v_action_str TEXT;
BEGIN
  IF v_pid IS NULL OR claim_amount IS NULL OR claim_amount <= 0 THEN
    RETURN;
  END IF;

  v_action_str := COALESCE(claim_action, 'Gameplay');

  -- Disallow referral commissions on casino / bet games
  IF LOWER(v_action_str) IN ('bet win', 'casino', 'roshambo', 'spinner', 'plinko', 'crash', 'gambling') THEN
    RETURN;
  END IF;

  SELECT referred_by_l1, referred_by_l2, referred_by_l3, referred_by_l4, username, player_id, linked_wallet_address
  INTO v_downline
  FROM users WHERE player_id = v_pid;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_downline.username IS NOT NULL AND TRIM(v_downline.username) <> '' AND UPPER(TRIM(v_downline.username)) <> 'EMPTY' THEN
    v_downline_name := TRIM(v_downline.username);
  ELSIF v_downline.linked_wallet_address IS NOT NULL AND TRIM(v_downline.linked_wallet_address) <> '' THEN
    v_downline_name := 'Player_' || SUBSTRING(TRIM(v_downline.linked_wallet_address) FROM 1 FOR 8);
  ELSE
    v_downline_name := 'Player_' || SUBSTRING(v_downline.player_id FROM 1 FOR 8);
  END IF;

  v_time_str := TO_CHAR(NOW(), 'HH12:MI:SS AM');
  v_upline_keys := ARRAY[v_downline.referred_by_l1, v_downline.referred_by_l2, v_downline.referred_by_l3, v_downline.referred_by_l4];

  FOR v_tier IN 1..4 LOOP
    v_upline_pid := resolve_player_id(v_upline_keys[v_tier]);
    IF v_upline_pid IS NOT NULL AND v_upline_pid <> '' AND v_upline_pid <> v_pid THEN
      v_mult := get_user_referral_multiplier(v_upline_pid);
      v_commission := ROUND(claim_amount * v_rates[v_tier] * v_mult, 4);

      IF v_commission > 0 THEN
        v_new_entry := jsonb_build_object(
          'name', v_downline_name,
          'player_id', v_pid,
          'level', v_tier,
          'action', v_action_str,
          'commission', v_commission,
          'currency', 'PGT',
          'time', v_time_str,
          'created_at', NOW()
        );

        UPDATE users
        SET unclaimed_referral_pgt = COALESCE(unclaimed_referral_pgt, 0) + v_commission,
            total_referral_commission = COALESCE(total_referral_commission, 0) + v_commission,
            referrals_list = (
              SELECT jsonb_agg(elem)
              FROM (
                SELECT elem
                FROM jsonb_array_elements(jsonb_build_array(v_new_entry) || COALESCE(referrals_list, '[]'::jsonb)) WITH ORDINALITY AS t(elem, ord)
                ORDER BY ord ASC
                LIMIT 50
              ) sub
            )
        WHERE player_id = v_upline_pid;

        BEGIN
          INSERT INTO referral_commissions (upline_player_id, downline_player_id, tier, commission_pgt, action_type, downline_username)
          VALUES (v_upline_pid, v_pid, v_tier, v_commission, v_action_str, v_downline_name);
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION process_referral_commissions(TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_referral_commissions(TEXT, NUMERIC, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- RPC: harvest_referral_rewards
-- Source: fix_arcade_referral_commissions_and_ledger.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.harvest_referral_rewards(TEXT);
DROP FUNCTION IF EXISTS harvest_referral_rewards(TEXT);

CREATE OR REPLACE FUNCTION harvest_referral_rewards(user_wallet TEXT) 
RETURNS NUMERIC AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  unclaimed_amt NUMERIC;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(user_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN 0;
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT COALESCE(unclaimed_referral_pgt, 0) INTO unclaimed_amt
  FROM users WHERE LOWER(player_id) = LOWER(v_pid);

  IF unclaimed_amt IS NULL OR unclaimed_amt <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE users SET
    balance_pgt = COALESCE(balance_pgt, 0) + unclaimed_amt,
    unclaimed_referral_pgt = 0
  WHERE LOWER(player_id) = LOWER(v_pid);

  RETURN unclaimed_amt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION harvest_referral_rewards(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION harvest_referral_rewards(TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: reconcile_referral_trees
-- Source: master_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.reconcile_referral_trees();
DROP FUNCTION IF EXISTS public.reconcile_referral_trees(TEXT);
DROP FUNCTION IF EXISTS reconcile_referral_trees();
DROP FUNCTION IF EXISTS reconcile_referral_trees(TEXT);

CREATE OR REPLACE FUNCTION public.reconcile_referral_trees(
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_scanned_count INT := 0;
  v_repaired_chains INT := 0;
  v_updated_counters INT := 0;
  r RECORD;
  v_parent RECORD;
  v_expected_l2 TEXT;
  v_expected_l3 TEXT;
  v_expected_l4 TEXT;
BEGIN
  -- Strict Master Admin Passkey Verification
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Master Admin Passkey');
  END IF;

  -- 1. Audit and repair all upstream referral chains (L2, L3, L4 from L1 root)
  FOR r IN 
    SELECT player_id, linked_wallet_address, referred_by_l1, referred_by_l2, referred_by_l3, referred_by_l4
    FROM public.users 
    WHERE referred_by_l1 IS NOT NULL AND referred_by_l1 <> '' AND referred_by_l1 <> 'EMPTY'
  LOOP
    v_scanned_count := v_scanned_count + 1;

    -- Fetch parent's upstream chain
    SELECT referred_by_l1, referred_by_l2, referred_by_l3
    INTO v_parent
    FROM public.users
    WHERE LOWER(player_id) = LOWER(r.referred_by_l1)
       OR (linked_wallet_address IS NOT NULL AND linked_wallet_address <> '' AND LOWER(linked_wallet_address) = LOWER(r.referred_by_l1))
    LIMIT 1;

    IF FOUND THEN
      v_expected_l2 := NULLIF(v_parent.referred_by_l1, '');
      v_expected_l3 := NULLIF(v_parent.referred_by_l2, '');
      v_expected_l4 := NULLIF(v_parent.referred_by_l3, '');

      -- Prevent self-loops
      IF v_expected_l2 = r.player_id OR (r.linked_wallet_address IS NOT NULL AND v_expected_l2 = r.linked_wallet_address) THEN v_expected_l2 := NULL; END IF;
      IF v_expected_l3 = r.player_id OR (r.linked_wallet_address IS NOT NULL AND v_expected_l3 = r.linked_wallet_address) THEN v_expected_l3 := NULL; END IF;
      IF v_expected_l4 = r.player_id OR (r.linked_wallet_address IS NOT NULL AND v_expected_l4 = r.linked_wallet_address) THEN v_expected_l4 := NULL; END IF;

      IF COALESCE(r.referred_by_l2, '') IS DISTINCT FROM COALESCE(v_expected_l2, '') OR
         COALESCE(r.referred_by_l3, '') IS DISTINCT FROM COALESCE(v_expected_l3, '') OR
         COALESCE(r.referred_by_l4, '') IS DISTINCT FROM COALESCE(v_expected_l4, '') THEN
        
        UPDATE public.users
        SET referred_by_l2 = v_expected_l2,
            referred_by_l3 = v_expected_l3,
            referred_by_l4 = v_expected_l4,
            updated_at = NOW()
        WHERE player_id = r.player_id;

        v_repaired_chains := v_repaired_chains + 1;
      END IF;
    END IF;
  END LOOP;

  -- 2. Recalculate downline counters across all users
  UPDATE public.users u
  SET 
    referrals_l1 = (
      SELECT COUNT(*)::INT FROM public.users d
      WHERE (LOWER(d.referred_by_l1) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(d.referred_by_l1) = LOWER(u.linked_wallet_address)))
    ),
    referrals_l2 = (
      SELECT COUNT(*)::INT FROM public.users d
      WHERE (LOWER(d.referred_by_l2) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(d.referred_by_l2) = LOWER(u.linked_wallet_address)))
    ),
    referrals_l3 = (
      SELECT COUNT(*)::INT FROM public.users d
      WHERE (LOWER(d.referred_by_l3) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(d.referred_by_l3) = LOWER(u.linked_wallet_address)))
    ),
    referrals_l4 = (
      SELECT COUNT(*)::INT FROM public.users d
      WHERE (LOWER(d.referred_by_l4) = LOWER(u.player_id) 
         OR (u.linked_wallet_address IS NOT NULL AND u.linked_wallet_address <> '' AND LOWER(d.referred_by_l4) = LOWER(u.linked_wallet_address)))
    );

  -- 3. Synchronize referrals_count total (L1 + L2 + L3 + L4)
  UPDATE public.users
  SET referrals_count = COALESCE(referrals_l1, 0) + COALESCE(referrals_l2, 0) + COALESCE(referrals_l3, 0) + COALESCE(referrals_l4, 0),
      updated_at = NOW();

  GET DIAGNOSTICS v_updated_counters = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'scanned_accounts', v_scanned_count,
    'repaired_chains', v_repaired_chains,
    'synchronized_users', v_updated_counters,
    'message', format('Referral reconciliation completed successfully: %s accounts scanned, %s chains repaired, %s downline counters synchronized.', v_scanned_count, v_repaired_chains, v_updated_counters)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.reconcile_referral_trees(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: link_wallet_to_account
-- Source: master_rpcs.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.link_wallet_to_account(TEXT, UUID);
DROP FUNCTION IF EXISTS link_wallet_to_account(TEXT, UUID);

CREATE OR REPLACE FUNCTION link_wallet_to_account(p_wallet TEXT, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_owner UUID;
  v_old_row RECORD;
  v_merged_pgt NUMERIC := 0;
  v_merged_earned NUMERIC := 0;
  v_merged_ref_pgt NUMERIC := 0;
  v_merged_ref_pol NUMERIC := 0;
  v_merged_ref_count INT := 0;
  v_merged_dodge INT := 0;
  v_merged_invaders INT := 0;
  v_merged_drift INT := 0;
  v_merged_stacker INT := 0;
  v_merged_skeet INT := 0;
  v_merged_all_dodge INT := 0;
  v_merged_all_invaders INT := 0;
  v_merged_all_drift INT := 0;
  v_merged_all_stacker INT := 0;
  v_merged_all_skeet INT := 0;
  v_merged_stakes JSONB := '[]'::jsonb;
  v_merged_nfts JSONB := '[]'::jsonb;
  v_merged_relics JSONB := '{}'::jsonb;
  v_merged_space JSONB := '{}'::jsonb;
  v_merged_vip TIMESTAMPTZ := NULL;
  v_merged_amb BOOLEAN := false;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));

  -- 0. Strict 42-character EVM wallet address format validation
  IF p_wallet IS NULL OR p_wallet !~ '^0x[a-f0-9]{40}$' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid Web3 EVM wallet address format.');
  END IF;

  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Missing user_id parameter.');
  END IF;

  -- 0b. Authenticated caller authorization check (prevents account takeover)
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Authenticated session does not match target account UUID.');
  END IF;

  -- 1. Prevent stealing a wallet already linked to ANOTHER Google user
  SELECT user_id INTO v_existing_owner 
  FROM users 
  WHERE LOWER(linked_wallet_address) = p_wallet
    AND user_id IS NOT NULL 
    AND user_id <> p_user_id;

  IF v_existing_owner IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'This wallet is already linked to another Google account.'
    );
  END IF;

  -- 2. Fetch unauthenticated standalone wallet row if it exists
  -- Strictly matches linked_wallet_address (never synthetic player_id)
  SELECT *
  INTO v_old_row
  FROM users
  WHERE LOWER(linked_wallet_address) = p_wallet
    AND user_id IS NULL;

  IF FOUND THEN
    v_merged_pgt := COALESCE(v_old_row.balance_pgt, 0);
    v_merged_earned := COALESCE(v_old_row.total_earned, 0);
    v_merged_ref_pgt := COALESCE(v_old_row.unclaimed_referral_pgt, v_old_row.unclaimed_referral_rewards, 0);
    v_merged_ref_pol := COALESCE(v_old_row.unclaimed_referral_pol, 0);
    v_merged_ref_count := COALESCE(v_old_row.referrals_count, 0);
    v_merged_dodge := COALESCE(v_old_row.game_highscore, 0);
    v_merged_invaders := COALESCE(v_old_row.invaders_highscore, 0);
    v_merged_drift := COALESCE(v_old_row.drift_highscore, 0);
    v_merged_stacker := COALESCE(v_old_row.stacker_highscore, 0);
    v_merged_skeet := COALESCE(v_old_row.skeet_highscore, 0);
    v_merged_all_dodge := COALESCE(v_old_row.alltime_game_highscore, v_merged_dodge);
    v_merged_all_invaders := COALESCE(v_old_row.alltime_invaders_highscore, v_merged_invaders);
    v_merged_all_drift := COALESCE(v_old_row.alltime_drift_highscore, v_merged_drift);
    v_merged_all_stacker := COALESCE(v_old_row.alltime_stacker_highscore, v_merged_stacker);
    v_merged_all_skeet := COALESCE(v_old_row.alltime_skeet_highscore, v_merged_skeet);
    v_merged_stakes := COALESCE(v_old_row.stakes, '[]'::jsonb);
    v_merged_nfts := COALESCE(v_old_row.owned_nfts, '[]'::jsonb);
    v_merged_relics := COALESCE(v_old_row.relics, '{}'::jsonb);
    v_merged_space := COALESCE(v_old_row.space_state, '{}'::jsonb);
    v_merged_vip := v_old_row.vip_until;
    v_merged_amb := COALESCE(v_old_row.is_ambassador, false);

    -- Delete the unauthenticated duplicate row after reading metrics
    DELETE FROM users 
    WHERE LOWER(linked_wallet_address) = p_wallet
      AND user_id IS NULL;
  END IF;

  -- 3. Merge balance, highscores, stakes, referrals, relics, NFTs, VIP status, and link wallet directly to the Google account row
  UPDATE users 
  SET linked_wallet_address = p_wallet,
      balance_pgt = COALESCE(balance_pgt, 0) + v_merged_pgt,
      total_earned = COALESCE(total_earned, 0) + v_merged_earned,
      unclaimed_referral_pgt = COALESCE(unclaimed_referral_pgt, 0) + v_merged_ref_pgt,
      unclaimed_referral_pol = COALESCE(unclaimed_referral_pol, 0) + v_merged_ref_pol,
      referrals_count = COALESCE(referrals_count, 0) + v_merged_ref_count,
      game_highscore = GREATEST(COALESCE(game_highscore, 0), v_merged_dodge),
      invaders_highscore = GREATEST(COALESCE(invaders_highscore, 0), v_merged_invaders),
      drift_highscore = GREATEST(COALESCE(drift_highscore, 0), v_merged_drift),
      stacker_highscore = GREATEST(COALESCE(stacker_highscore, 0), v_merged_stacker),
      skeet_highscore = GREATEST(COALESCE(skeet_highscore, 0), v_merged_skeet),
      alltime_game_highscore = GREATEST(COALESCE(alltime_game_highscore, 0), v_merged_all_dodge),
      alltime_invaders_highscore = GREATEST(COALESCE(alltime_invaders_highscore, 0), v_merged_all_invaders),
      alltime_drift_highscore = GREATEST(COALESCE(alltime_drift_highscore, 0), v_merged_all_drift),
      alltime_stacker_highscore = GREATEST(COALESCE(alltime_stacker_highscore, 0), v_merged_all_stacker),
      alltime_skeet_highscore = GREATEST(COALESCE(alltime_skeet_highscore, 0), v_merged_all_skeet),
      stakes = CASE 
        WHEN jsonb_typeof(v_merged_stakes) = 'array' AND jsonb_array_length(v_merged_stakes) > 0 THEN COALESCE(stakes, '[]'::jsonb) || v_merged_stakes 
        ELSE COALESCE(stakes, '[]'::jsonb) 
      END,
      owned_nfts = CASE 
        WHEN jsonb_typeof(v_merged_nfts) = 'array' AND jsonb_array_length(v_merged_nfts) > 0 THEN COALESCE(owned_nfts, '[]'::jsonb) || v_merged_nfts 
        ELSE COALESCE(owned_nfts, '[]'::jsonb) 
      END,
      relics = CASE
        WHEN v_merged_relics <> '{}'::jsonb THEN COALESCE(relics, '{}'::jsonb) || v_merged_relics
        ELSE COALESCE(relics, '{}'::jsonb)
      END,
      space_state = CASE 
        WHEN v_merged_space <> '{}'::jsonb THEN v_merged_space 
        ELSE COALESCE(space_state, '{}'::jsonb) 
      END,
      vip_until = CASE 
        WHEN v_merged_vip IS NOT NULL AND (vip_until IS NULL OR v_merged_vip > vip_until) THEN v_merged_vip 
        ELSE vip_until 
      END,
      is_ambassador = (COALESCE(is_ambassador, false) OR v_merged_amb),
      updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Wallet linked & 100% account progress merged successfully!', 
    'wallet', p_wallet,
    'merged_pgt', v_merged_pgt,
    'merged_ref_rewards', v_merged_ref_pgt
  );
END;
$$;

REVOKE ALL ON FUNCTION link_wallet_to_account(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION link_wallet_to_account(TEXT, UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: get_caller_player_id
-- Resolves the verified player_id of the active authenticated session (auth.uid()).
-- Returns NULL if the caller is unauthenticated.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_caller_player_id();
DROP FUNCTION IF EXISTS get_caller_player_id();

CREATE OR REPLACE FUNCTION public.get_caller_player_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_auth_uid UUID := auth.uid();
  v_pid TEXT;
BEGIN
  IF v_auth_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT player_id INTO v_pid
  FROM public.users
  WHERE user_id = v_auth_uid
  LIMIT 1;

  RETURN v_pid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_caller_player_id() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_caller_player_id() FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: assert_caller_player_id
-- Core Anti-Framing Identity Guard:
-- 1. Verifies that the caller has an active authenticated session (auth.uid()).
-- 2. If target ID is specified, strictly asserts that it resolves to the caller's
--    own account.
-- 3. If an unauthorized target ID is passed, logs an anti-cheat warning against
--    the CALLER's account and returns a MISMATCH status.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.assert_caller_player_id(TEXT);
DROP FUNCTION IF EXISTS assert_caller_player_id(TEXT);

CREATE OR REPLACE FUNCTION public.assert_caller_player_id(
  p_target_id TEXT,
  OUT p_status TEXT,       -- 'OK', 'UNAUTHENTICATED', 'PROFILE_NOT_FOUND', 'MISMATCH', 'ACCOUNT_BANNED'
  OUT p_player_id TEXT,    -- The verified player_id of the caller
  OUT p_error_msg TEXT     -- User-facing error message
)
RETURNS RECORD
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role TEXT := auth.role();
  v_auth_uid UUID := auth.uid();
  v_caller_pid TEXT;
  v_resolved_target TEXT;
  v_target_auth_uid UUID;
  v_target_wallet TEXT;
  v_target_is_banned BOOLEAN;
BEGIN
  -- 1. Service role or internal server execution without JWT:
  IF v_role = 'service_role' OR (v_role IS NULL AND v_auth_uid IS NULL) THEN
    p_status := 'OK';
    p_player_id := public.resolve_player_id(p_target_id);
    p_error_msg := NULL;
    RETURN;
  END IF;

  -- 2. Authenticated user with active Supabase Auth session (Google OAuth):
  IF v_auth_uid IS NOT NULL THEN
    SELECT player_id INTO v_caller_pid
    FROM public.users
    WHERE user_id = v_auth_uid
    LIMIT 1;

    IF v_caller_pid IS NULL THEN
      p_status := 'PROFILE_NOT_FOUND';
      p_player_id := NULL;
      p_error_msg := 'PROFILE_NOT_FOUND: User profile does not exist for this session.';
      RETURN;
    END IF;

    -- Anti-Framing Assertion:
    -- If target ID was passed by client, it MUST resolve to the caller's own player_id.
    IF p_target_id IS NOT NULL AND TRIM(p_target_id) <> '' THEN
      v_resolved_target := public.resolve_player_id(p_target_id);
      IF v_resolved_target IS NOT NULL AND LOWER(v_resolved_target) <> LOWER(v_caller_pid) THEN
        -- Framing / impersonation attempt:
        PERFORM public.record_bot_warning(
          v_caller_pid,
          'identity_impersonation_attempt',
          'Security Sentinel',
          jsonb_build_object('attempted_target', p_target_id, 'resolved_target', v_resolved_target)
        );
        p_status := 'MISMATCH';
        p_player_id := v_caller_pid;
        p_error_msg := 'SECURITY_VIOLATION: You cannot perform actions on behalf of another player.';
        RETURN;
      END IF;
    END IF;

    p_status := 'OK';
    p_player_id := v_caller_pid;
    p_error_msg := NULL;
    RETURN;
  END IF;

  -- 3. Anonymous Web3 Wallet / Guest Caller (v_auth_uid IS NULL):
  -- For Web3 wallets and guest players accessing via anon PostgREST key,
  -- p_target_id must be provided and resolve to a valid, unbanned account.
  IF p_target_id IS NULL OR TRIM(p_target_id) = '' THEN
    p_status := 'UNAUTHENTICATED';
    p_player_id := NULL;
    p_error_msg := 'AUTHENTICATION_REQUIRED: Please sign in with Google or connect your wallet.';
    RETURN;
  END IF;

  v_resolved_target := public.resolve_player_id(p_target_id);

  IF v_resolved_target IS NULL THEN
    p_status := 'PROFILE_NOT_FOUND';
    p_player_id := NULL;
    p_error_msg := 'PROFILE_NOT_FOUND: User profile does not exist.';
    RETURN;
  END IF;

  SELECT user_id, linked_wallet_address, COALESCE(is_banned, false)
  INTO v_target_auth_uid, v_target_wallet, v_target_is_banned
  FROM public.users
  WHERE player_id = v_resolved_target
  LIMIT 1;

  IF NOT FOUND THEN
    p_status := 'PROFILE_NOT_FOUND';
    p_player_id := NULL;
    p_error_msg := 'PROFILE_NOT_FOUND: User profile does not exist.';
    RETURN;
  END IF;

  IF v_target_is_banned THEN
    p_status := 'ACCOUNT_BANNED';
    p_player_id := v_resolved_target;
    p_error_msg := 'SECURITY_VIOLATION: Account is suspended.';
    RETURN;
  END IF;

  -- Prevent unauthenticated anon callers from acting on pure Google OAuth accounts (accounts without a linked Web3 wallet)
  -- Hybrid accounts with a linked Web3 wallet are legitimately accessible via wallet connection.
  IF v_target_auth_uid IS NOT NULL AND (v_target_wallet IS NULL OR TRIM(v_target_wallet) = '') THEN
    p_status := 'UNAUTHENTICATED';
    p_player_id := NULL;
    p_error_msg := 'AUTHENTICATION_REQUIRED: This account is linked to Google Auth. Please sign in with Google to continue.';
    RETURN;
  END IF;

  p_status := 'OK';
  p_player_id := v_resolved_target;
  p_error_msg := NULL;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_caller_player_id(TEXT) TO authenticated, service_role, anon;

-- ==============================================================================
