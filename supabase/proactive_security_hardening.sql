-- ==============================================================================
-- POLYGON GAMING — PROACTIVE SECURITY HARDENING MIGRATION (v1.5.453)
-- ==============================================================================
-- Purpose:
--   Proactively seal 4 remaining high-risk attack vectors before public discovery:
--
--   1. process_referral_commissions:
--      - Revoke execution from PUBLIC, anon, and authenticated.
--      - Restrict execution strictly to service_role (internal engine only).
--      - Guard harvest_referral_rewards with assert_caller_player_id and revoke from anon.
--
--   2. refund_failed_withdrawal:
--      - Revoke execution from PUBLIC, anon, and authenticated.
--      - Restrict execution strictly to service_role. Prevents bearer voucher double-spending
--        where a player refunds in-game balance and then submits the signed voucher to Polygon.
--
--   3. link_wallet_to_account:
--      - Enforce strict 42-character regex (^0x[a-f0-9]{40}$) on p_wallet.
--      - Prevent synthetic player ID (0xpgt...) absorption.
--      - Verify caller auth.uid() matches target p_user_id.
--      - Revoke execution from PUBLIC and anon (authenticated only).
--
--   4. sync_user_dex_liquidity:
--      - Restrict execution strictly to verified service_role or admin passkey.
--      - Prevent untrusted clients from setting arbitrary LP balances to spoof +30% VIP faucet yields.
--      - Revoke execution from PUBLIC, anon, and authenticated.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SECURE REFERRAL ENGINE (process_referral_commissions & harvest_referral_rewards)
-- ------------------------------------------------------------------------------
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
  v_pid TEXT := public.resolve_player_id(claiming_wallet);
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
  FROM public.users WHERE player_id = v_pid;

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
    v_upline_pid := public.resolve_player_id(v_upline_keys[v_tier]);
    IF v_upline_pid IS NOT NULL AND v_upline_pid <> '' AND v_upline_pid <> v_pid THEN
      v_mult := public.get_user_referral_multiplier(v_upline_pid);
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

        UPDATE public.users
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
          INSERT INTO public.referral_commissions (upline_player_id, downline_player_id, tier, commission_pgt, action_type, downline_username)
          VALUES (v_upline_pid, v_pid, v_tier, v_commission, v_action_str, v_downline_name);
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.process_referral_commissions(TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_referral_commissions(TEXT, NUMERIC, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.harvest_referral_rewards(user_wallet TEXT) 
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
  FROM public.users WHERE LOWER(player_id) = LOWER(v_pid);

  IF unclaimed_amt IS NULL OR unclaimed_amt <= 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.users SET
    balance_pgt = COALESCE(balance_pgt, 0) + unclaimed_amt,
    unclaimed_referral_pgt = 0
  WHERE LOWER(player_id) = LOWER(v_pid);

  RETURN unclaimed_amt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.harvest_referral_rewards(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.harvest_referral_rewards(TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. PREVENT WITHDRAWAL VOUCHER DOUBLE-SPENDING (refund_failed_withdrawal)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_failed_withdrawal(
  p_player_id TEXT,
  p_nonce NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_rec RECORD;
  v_new_balance NUMERIC;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- 1. Find the unconsumed withdrawal record matching the nonce and player
  SELECT * INTO v_rec 
  FROM public.withdrawals_history 
  WHERE nonce = p_nonce 
    AND (LOWER(player_id) = LOWER(v_pid) OR LOWER(wallet_address) = LOWER(v_pid))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal voucher not found or does not belong to this account.');
  END IF;

  -- 2. Refund balance to user
  UPDATE public.users
  SET balance_pgt = balance_pgt + v_rec.amount,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_rec.player_id)
  RETURNING balance_pgt INTO v_new_balance;

  -- 3. Delete the unconsumed withdrawal history record
  DELETE FROM public.withdrawals_history WHERE id = v_rec.id;

  RETURN jsonb_build_object(
    'success', true,
    'refunded_amount', v_rec.amount,
    'new_balance', v_new_balance,
    'player_id', v_rec.player_id,
    'nonce', p_nonce
  );
END;
$$;

REVOKE ALL ON FUNCTION public.refund_failed_withdrawal(TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_failed_withdrawal(TEXT, NUMERIC) TO service_role;

-- ------------------------------------------------------------------------------
-- 3. SECURE WALLET LINKING & PREVENT ACCOUNT HIJACKING (link_wallet_to_account)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_wallet_to_account(
  p_wallet TEXT,
  p_user_id UUID
)
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
  FROM public.users 
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
  FROM public.users
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
    DELETE FROM public.users 
    WHERE LOWER(linked_wallet_address) = p_wallet
      AND user_id IS NULL;
  END IF;

  -- 3. Merge balance, highscores, stakes, referrals, relics, NFTs, VIP status, and link wallet directly to the Google account row
  UPDATE public.users 
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

REVOKE ALL ON FUNCTION public.link_wallet_to_account(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_wallet_to_account(TEXT, UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. PREVENT DEX LP MULTIPLIER SPOOFING (sync_user_dex_liquidity)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_user_dex_liquidity(
  p_player_id TEXT,
  p_lp_usd NUMERIC,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_canonical_id TEXT;
  v_clean_usd NUMERIC;
  v_is_admin BOOLEAN := false;
  v_caller TEXT := LOWER(COALESCE(CURRENT_USER, ''));
BEGIN
  -- Admin passkey allows manual adjustment from admin panel, or service_role allows verified backend sync
  IF v_caller = 'service_role' THEN
    v_is_admin := true;
  ELSIF p_admin_passkey IS NOT NULL THEN
    v_is_admin := public.verify_admin_passkey(p_admin_passkey);
  END IF;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only admin or verified service role can update DEX liquidity.');
  END IF;

  v_canonical_id := public.resolve_player_id(p_player_id);
  IF v_canonical_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  v_clean_usd := ROUND(LEAST(GREATEST(COALESCE(p_lp_usd, 0.0), 0.0), 10000.0), 2);

  UPDATE public.users
  SET 
    dex_liquidity_usd = v_clean_usd,
    updated_at = NOW()
  WHERE player_id = v_canonical_id;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_canonical_id,
    'dex_liquidity_usd', v_clean_usd,
    'is_admin_override', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sync_user_dex_liquidity(TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_dex_liquidity(TEXT, NUMERIC, TEXT) TO service_role;
