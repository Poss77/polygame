-- 8. WITHDRAWALS & ON-SITE STORE
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC: request_withdrawal_voucher
-- Source: fix_and_harden_withdrawals_atomic.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.request_withdrawal_voucher(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.request_withdrawal_voucher(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS request_withdrawal_voucher(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS request_withdrawal_voucher(TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION public.request_withdrawal_voucher(
  p_player_id TEXT,
  p_wallet_address TEXT,
  p_amount NUMERIC,
  p_ip_address TEXT,
  p_nonce NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_norm_wallet TEXT := LOWER(TRIM(COALESCE(p_wallet_address, '')));
  v_user RECORD;
  v_gs RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_seven_days_ago TIMESTAMPTZ := v_now - INTERVAL '7 days';
  v_min_limit NUMERIC := 10.0;
  v_max_limit NUMERIC := 25000.0;
  v_max_weekly INTEGER := 5;
  v_quarantine_days INTEGER := 7;
  v_recent_count INTEGER := 0;
  v_new_balance NUMERIC := 0.0;
  v_account_age_days NUMERIC := 0.0;
  v_clean_ip TEXT := TRIM(COALESCE(p_ip_address, 'unknown'));
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_player_id));
  END IF;

  IF v_norm_wallet = '' AND v_pid ~ '^0x[a-f0-9]{40}$' THEN
    v_norm_wallet := v_pid;
  END IF;

  -- 1. Lock user row FOR UPDATE to prevent parallel race conditions
  SELECT * INTO v_user FROM public.users 
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR (v_norm_wallet != '' AND LOWER(linked_wallet_address) = v_norm_wallet)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found in database.');
  END IF;

  -- 2. Banned player check
  IF COALESCE(v_user.is_banned, false) = true THEN
    RETURN jsonb_build_object('success', false, 'error', 'Security Alert: Account has been permanently suspended.');
  END IF;

  -- 3. Dynamic limits from global_settings
  BEGIN
    SELECT * INTO v_gs FROM public.global_settings WHERE id = 1 LIMIT 1;
    IF FOUND THEN
      v_min_limit := COALESCE(v_gs.min_withdraw_pgt, 10.0);
      v_max_limit := COALESCE(v_gs.max_withdraw_pgt, 25000.0);
      v_max_weekly := COALESCE(v_gs.max_weekly_withdrawals, 5);
      v_quarantine_days := COALESCE(v_gs.account_quarantine_days, 7);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_min_limit := 10.0;
    v_max_limit := 25000.0;
    v_max_weekly := 5;
    v_quarantine_days := 7;
  END;

  -- 4. Amount limits validation
  IF p_amount IS NULL OR p_amount < v_min_limit THEN
    RETURN jsonb_build_object('success', false, 'error', format('Minimum single withdrawal limit is %s PGT per transaction.', v_min_limit));
  END IF;

  IF p_amount > v_max_limit THEN
    RETURN jsonb_build_object('success', false, 'error', format('Security Limit: Maximum single withdrawal limit is %s PGT per transaction.', v_max_limit));
  END IF;

  -- 5. Account age quarantine validation
  IF v_quarantine_days > 0 THEN
    IF v_user.created_at IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', format('Account Security Quarantine: Account creation timestamp missing. You must wait %s day(s) before making on-chain withdrawals.', v_quarantine_days));
    END IF;

    v_account_age_days := EXTRACT(EPOCH FROM (v_now - v_user.created_at)) / 86400.0;
    IF v_account_age_days < v_quarantine_days THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', format('Account Security Quarantine: New accounts must be at least %s days old before making on-chain withdrawals (%s day(s) remaining).', v_quarantine_days, CEIL(v_quarantine_days - v_account_age_days))
      );
    END IF;
  END IF;

  -- 6. Off-chain balance check
  IF COALESCE(v_user.balance_pgt, 0.0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient off-chain PGT balance.');
  END IF;

  -- 7. Rolling 7-day quota enforcement (across player_id, linked wallet, and IP)
  SELECT COUNT(*) INTO v_recent_count
  FROM public.withdrawals_history
  WHERE created_at >= v_seven_days_ago
    AND (
      LOWER(player_id) = LOWER(v_user.player_id)
      OR (v_norm_wallet != '' AND LOWER(wallet_address) = v_norm_wallet)
      OR (v_clean_ip != 'unknown' AND ip_address = v_clean_ip)
    );

  IF v_recent_count >= v_max_weekly THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Weekly Limit Reached: Maximum %s withdrawals allowed per 7-day period (%s/%s used). Please wait for previous withdrawals to mature out of the 7-day window.', v_max_weekly, v_recent_count, v_max_weekly)
    );
  END IF;

  -- 8. Deduct balance atomically
  UPDATE public.users
  SET balance_pgt = balance_pgt - p_amount,
      updated_at = v_now
  WHERE LOWER(player_id) = LOWER(v_user.player_id)
  RETURNING balance_pgt INTO v_new_balance;

  -- 9. Insert into withdrawals_history with IP tracking
  INSERT INTO public.withdrawals_history (
    player_id,
    wallet_address,
    amount,
    nonce,
    ip_address,
    created_at
  ) VALUES (
    v_user.player_id,
    COALESCE(NULLIF(v_norm_wallet, ''), LOWER(COALESCE(v_user.linked_wallet_address, v_user.player_id))),
    p_amount,
    p_nonce,
    v_clean_ip,
    v_now
  );

  -- 10. Update user_ips sentinel
  IF v_clean_ip != 'unknown' THEN
    BEGIN
      INSERT INTO public.user_ips (player_id, ip_address, last_seen)
      VALUES (v_user.player_id, v_clean_ip, v_now)
      ON CONFLICT (player_id) 
      DO UPDATE SET ip_address = EXCLUDED.ip_address, last_seen = EXCLUDED.last_seen;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_user.player_id,
    'wallet_address', COALESCE(NULLIF(v_norm_wallet, ''), LOWER(COALESCE(v_user.linked_wallet_address, v_user.player_id))),
    'amount', p_amount,
    'nonce', p_nonce,
    'new_balance', v_new_balance,
    'weekly_used', v_recent_count + 1,
    'weekly_limit', v_max_weekly
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_withdrawal_voucher(TEXT, TEXT, NUMERIC, TEXT, NUMERIC) TO service_role;

-- ------------------------------------------------------------------------------
-- RPC: cancel_withdrawal_voucher
-- Source: fix_and_harden_withdrawals_atomic.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.cancel_withdrawal_voucher(TEXT, UUID);
DROP FUNCTION IF EXISTS cancel_withdrawal_voucher(TEXT, UUID);
CREATE OR REPLACE FUNCTION public.cancel_withdrawal_voucher(
  p_nonce NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  -- Find the withdrawal record by nonce
  SELECT * INTO v_rec FROM public.withdrawals_history WHERE nonce = p_nonce LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal record not found for nonce.');
  END IF;

  -- Refund balance to user
  UPDATE public.users
  SET balance_pgt = balance_pgt + v_rec.amount,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_rec.player_id);

  -- Remove unconsumed withdrawal history record
  DELETE FROM public.withdrawals_history WHERE id = v_rec.id;

  RETURN jsonb_build_object('success', true, 'refunded_amount', v_rec.amount, 'player_id', v_rec.player_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_withdrawal_voucher(NUMERIC) TO service_role;

-- ------------------------------------------------------------------------------
-- RPC: refund_failed_withdrawal
-- Allows a player to rollback their own unconsumed withdrawal voucher if
-- the on-chain MetaMask transaction fails, reverts, or is rejected.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.refund_failed_withdrawal(UUID);
DROP FUNCTION IF EXISTS refund_failed_withdrawal(UUID);
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
-- RPC: buy_onsite_nft
-- Source: add_buy_onsite_nft_rpc.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.buy_onsite_nft(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.buy_onsite_nft(TEXT, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS buy_onsite_nft(TEXT, TEXT);
DROP FUNCTION IF EXISTS buy_onsite_nft(TEXT, TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION buy_onsite_nft(p_wallet TEXT, p_nft_id TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_balance NUMERIC;
  v_cost NUMERIC;
  v_existing_nfts JSONB;
  v_crate_nfts JSONB;
  v_nft_name TEXT;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN json_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  IF p_nft_id = 'nft_relic_seeker' THEN
    v_cost := 1000000.0;
    v_nft_name := 'Quantum Relic Seeker';
  ELSE
    RETURN json_build_object('success', false, 'error', 'Unknown on-site NFT identifier');
  END IF;

  SELECT balance_pgt, COALESCE(owned_nfts, '[]'::jsonb), COALESCE(crate_nfts, '[]'::jsonb)
  INTO v_balance, v_existing_nfts, v_crate_nfts
  FROM users
  WHERE LOWER(player_id) = LOWER(v_pid)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Player profile not found');
  END IF;

  -- Check if already owned in owned_nfts or crate_nfts
  IF (v_existing_nfts @> jsonb_build_array(p_nft_id)) OR (v_crate_nfts @> jsonb_build_array(p_nft_id)) THEN
    RETURN json_build_object('success', false, 'error', 'You already own this NFT!');
  END IF;

  IF v_balance < v_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient PGT balance (Requires 1,000,000 PGT)');
  END IF;

  -- Append to crate_nfts
  v_crate_nfts := v_crate_nfts || jsonb_build_array(p_nft_id);

  UPDATE users
  SET balance_pgt = balance_pgt - v_cost,
      crate_nfts = v_crate_nfts,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);

  RETURN json_build_object(
    'success', true,
    'nft_id', p_nft_id,
    'nft_name', v_nft_name,
    'new_balance', v_balance - v_cost,
    'crate_nfts', v_crate_nfts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION buy_onsite_nft(TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION buy_onsite_nft(TEXT, TEXT) FROM anon;

-- ------------------------------------------------------------------------------
-- RPC: sync_onchain_nfts
-- Source: seal_nft_sync_exploit_and_sanitize_dobby.sql
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
    v_is_admin BOOLEAN := FALSE;
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

    v_is_admin := COALESCE(v_user.is_admin, FALSE) OR 
                  (v_user.linked_wallet_address IS NOT NULL AND LOWER(v_user.linked_wallet_address) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d') OR
                  LOWER(v_user.player_id) = '0x10b9993990c9ef8a212c9557cb02ad94da9a654d';

    -- Security Guard 1: Must have a valid linked Web3 wallet to claim any on-chain NFTs
    IF v_user.linked_wallet_address IS NULL OR TRIM(v_user.linked_wallet_address) = '' OR NOT (LOWER(v_user.linked_wallet_address) ~ '^0x[a-f0-9]{40}$') THEN
        IF p_chain_nfts IS NOT NULL AND jsonb_typeof(p_chain_nfts) = 'array' AND jsonb_array_length(p_chain_nfts) > 0 THEN
            PERFORM public.record_bot_warning(
                v_user.player_id,
                'nft_sync_no_wallet',
                'Exploit attempt: sync_onchain_nfts called with non-empty NFTs on an account without linked Web3 wallet.',
                jsonb_build_object('payload', p_chain_nfts)
            );
        END IF;
        -- Return unmodified current inventory
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

-- ------------------------------------------------------------------------------
-- RPC: activate_vip_pass
-- Source: seal_vip_pass_activation_exploit.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.activate_vip_pass(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.activate_vip_pass(TEXT, NUMERIC);
DROP FUNCTION IF EXISTS activate_vip_pass(TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS activate_vip_pass(TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION public.activate_vip_pass(
  p_player_id TEXT,
  p_pass_type TEXT DEFAULT 'nft_vip_pass'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_days INTEGER := 30;
  v_user RECORD;
  v_base_time TIMESTAMPTZ;
  v_new_vip TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
  v_crate_nfts JSONB;
  v_owned_nfts JSONB;
  v_consumed BOOLEAN := false;
  v_activities JSONB;
  v_new_activity JSONB;
  v_time_str TEXT;
  v_clean_pass TEXT := LOWER(TRIM(COALESCE(p_pass_type, '')));
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- 1. Validate Pass Type Whitelist
  IF v_clean_pass = 'nft_vip_pass_yearly' THEN
    v_days := 365;
  ELSIF v_clean_pass = 'nft_vip_pass' THEN
    v_days := 30;
  ELSE
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Invalid VIP pass type. Must be nft_vip_pass (30 days) or nft_vip_pass_yearly (365 days).'
    );
  END IF;

  -- 3. Row-Lock User Record FOR UPDATE
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player profile not found');
  END IF;

  -- 4. Check Suspended Status
  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended');
  END IF;

  v_crate_nfts := COALESCE(v_user.crate_nfts, '[]'::jsonb);
  v_owned_nfts := COALESCE(v_user.owned_nfts, '[]'::jsonb);

  -- 5. Mandatory Consumption Check (Prioritize off-chain crate pass first, then on-chain)
  IF v_crate_nfts @> jsonb_build_array(v_clean_pass) THEN
    -- Remove the first occurrence of this pass from crate_nfts array
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) INTO v_crate_nfts
    FROM (
      SELECT elem, row_number() OVER () AS rn
      FROM jsonb_array_elements_text(v_crate_nfts) AS elem
    ) sub
    WHERE NOT (elem = v_clean_pass AND rn = (
      SELECT min(rn) FROM (
        SELECT elem, row_number() OVER () AS rn
        FROM jsonb_array_elements_text(COALESCE(v_user.crate_nfts, '[]'::jsonb)) AS elem
      ) t WHERE t.elem = v_clean_pass
    ));
    v_consumed := true;

  ELSIF v_owned_nfts @> jsonb_build_array(v_clean_pass) THEN
    -- Remove the first occurrence of this pass from owned_nfts array
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) INTO v_owned_nfts
    FROM (
      SELECT elem, row_number() OVER () AS rn
      FROM jsonb_array_elements_text(v_owned_nfts) AS elem
    ) sub
    WHERE NOT (elem = v_clean_pass AND rn = (
      SELECT min(rn) FROM (
        SELECT elem, row_number() OVER () AS rn
        FROM jsonb_array_elements_text(COALESCE(v_user.owned_nfts, '[]'::jsonb)) AS elem
      ) t WHERE t.elem = v_clean_pass
    ));
    v_consumed := true;
  END IF;

  -- CRITICAL ANTI-CHEAT GATE: ABORT IF NO PASS WAS CONSUMED
  IF NOT v_consumed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Activation failed: No valid VIP pass (' || v_clean_pass || ') found in backpack or crate inventory'
    );
  END IF;

  -- 6. Calculate New VIP Expiration (extends existing VIP if currently active)
  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > v_now THEN
    v_base_time := v_user.vip_until;
  ELSE
    v_base_time := v_now;
  END IF;

  v_new_vip := v_base_time + (v_days || ' days')::INTERVAL;

  -- 7. Record In-Game Activity
  v_time_str := to_char(v_now AT TIME ZONE 'UTC', 'HH24:MI:SS');
  v_new_activity := jsonb_build_object(
    'user', 'You',
    'action', 'activated VIP Pass',
    'reward', '+' || v_days || ' Days VIP',
    'time', v_time_str
  );
  v_activities := jsonb_build_array(v_new_activity) || COALESCE(v_user.activities, '[]'::jsonb);
  IF jsonb_array_length(v_activities) > 20 THEN
    SELECT jsonb_agg(elem) INTO v_activities
    FROM (
      SELECT elem FROM jsonb_array_elements(v_activities) WITH ORDINALITY AS t(elem, ord)
      WHERE ord <= 20
    ) s;
  END IF;

  -- 8. Persist Updates Atomically
  UPDATE public.users
  SET 
    vip_until = v_new_vip,
    crate_nfts = v_crate_nfts,
    owned_nfts = v_owned_nfts,
    activities = v_activities,
    updated_at = v_now
  WHERE player_id = v_pid;

  RETURN jsonb_build_object(
    'success', true,
    'vip_until', v_new_vip,
    'days_added', v_days,
    'crate_nfts', v_crate_nfts,
    'owned_nfts', v_owned_nfts
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.activate_vip_pass(TEXT, TEXT) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.activate_vip_pass(TEXT, TEXT) FROM anon;


-- ==============================================================================
