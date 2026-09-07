-- ==============================================================================
-- POLYGAME: VIP-EXCLUSIVE POL FAUCET & 5.0 POL PAYOUT SYSTEM
-- Base: 0.005 POL (in global_settings), same multipliers as PGT, on-site accumulation
-- ==============================================================================

-- 1. Ensure global_settings has VIP faucet columns
ALTER TABLE public.global_settings 
ADD COLUMN IF NOT EXISTS vip_faucet_base_pol NUMERIC DEFAULT 0.005,
ADD COLUMN IF NOT EXISTS vip_faucet_min_payout_pol NUMERIC DEFAULT 5.0;

UPDATE public.global_settings 
SET 
  vip_faucet_base_pol = COALESCE(vip_faucet_base_pol, 0.005),
  vip_faucet_min_payout_pol = COALESCE(vip_faucet_min_payout_pol, 5.0)
WHERE id = 1;

-- 2. Ensure users table has VIP faucet tracking columns
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS unclaimed_vip_faucet_pol NUMERIC DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS total_vip_faucet_pol NUMERIC DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS last_vip_faucet_claim TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS vip_faucet_streak INTEGER DEFAULT 0;

-- 3. Ensure pol_payout_requests has source column
ALTER TABLE public.pol_payout_requests
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'referral';

-- 4. Create claim_vip_faucet RPC
CREATE OR REPLACE FUNCTION public.claim_vip_faucet(
  p_player_id TEXT,
  p_nft_boost_percent NUMERIC DEFAULT 0.0,
  p_1flr_balance NUMERIC DEFAULT 0.0,
  p_staked_pgt NUMERIC DEFAULT 0.0,
  p_onchain_pgt NUMERIC DEFAULT 0.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_user RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_cooldown_hours NUMERIC := 21.6; -- 24h * 0.90 (VIP 10% faster cooldown)
  v_vip_mult NUMERIC := 2.0;
  v_amb_mult NUMERIC := 1.0;
  v_relic_mult NUMERIC := 1.0;
  v_streak INTEGER := 0;
  v_base_payout NUMERIC := 0.005;
  v_final_payout NUMERIC := 0.005;
  v_new_unclaimed NUMERIC := 0.0;
  v_new_total NUMERIC := 0.0;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_player_id));
  END IF;

  SELECT * INTO v_user FROM public.users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Verify active VIP status
  IF v_user.vip_until IS NULL OR v_user.vip_until <= v_now THEN
    RETURN jsonb_build_object('success', false, 'error', 'VIP membership required to claim this faucet');
  END IF;

  -- Fetch dynamic base POL payout from global_settings
  BEGIN
    SELECT COALESCE(vip_faucet_base_pol, 0.005) INTO v_base_payout 
    FROM public.global_settings 
    WHERE id = 1 
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_base_payout := 0.005;
  END;

  IF v_base_payout IS NULL OR v_base_payout <= 0 THEN
    v_base_payout := 0.005;
  END IF;

  -- Check cooldown (21.6 hours)
  IF v_user.last_vip_faucet_claim IS NOT NULL AND v_now < (v_user.last_vip_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'VIP Faucet on cooldown',
      'next_claim', v_user.last_vip_faucet_claim + (v_cooldown_hours * INTERVAL '1 hour')
    );
  END IF;

  -- Check Ambassador status
  IF v_user.is_ambassador = true THEN
    v_amb_mult := 2.0;
  END IF;

  -- Check Serie 1 Apex Relics Multiplier (1.5x)
  IF is_season1_apex_unlocked(v_user.relics) THEN
    v_relic_mult := 1.5;
  END IF;

  -- Shared consecutive day streak from PGT faucet
  v_streak := LEAST(GREATEST(COALESCE(v_user.claim_streak, 1), 1), 7);

  -- Base with combined boosts (NFT + streak + referral bonus)
  v_final_payout := v_base_payout * (1.0 + (GREATEST(0.0, LEAST(COALESCE(p_nft_boost_percent, 0.0), 300.0)) / 100.0));

  -- 1FLR Whale (+15%)
  IF COALESCE(p_1flr_balance, 0) >= 5000000 THEN 
    v_final_payout := v_final_payout * 1.15; 
  END IF;
  
  -- 1M Staked PGT Whale (+25%)
  IF COALESCE(p_staked_pgt, 0) >= 1000000 THEN 
    v_final_payout := v_final_payout * 1.25; 
  END IF;
  
  -- 1M Onchain PGT Whale (+10%)
  IF COALESCE(p_onchain_pgt, 0) >= 1000000 THEN 
    v_final_payout := v_final_payout * 1.10; 
  END IF;

  -- Multiply by VIP (2x), Ambassador (2x), Relics (1.5x)
  v_final_payout := v_final_payout * v_relic_mult * v_vip_mult * v_amb_mult;
  v_final_payout := ROUND(v_final_payout, 6);

  v_new_unclaimed := COALESCE(v_user.unclaimed_vip_faucet_pol, 0.0) + v_final_payout;
  v_new_total := COALESCE(v_user.total_vip_faucet_pol, 0.0) + v_final_payout;

  UPDATE public.users
  SET
    unclaimed_vip_faucet_pol = v_new_unclaimed,
    total_vip_faucet_pol = v_new_total,
    last_vip_faucet_claim = v_now,
    vip_faucet_streak = v_streak,
    updated_at = v_now
  WHERE LOWER(player_id) = LOWER(v_pid);

  RETURN jsonb_build_object(
    'success', true,
    'payout_pol', v_final_payout,
    'unclaimed_vip_faucet_pol', v_new_unclaimed,
    'total_vip_faucet_pol', v_new_total,
    'last_vip_faucet_claim', v_now,
    'streak', v_streak,
    'cooldown_hours', v_cooldown_hours
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_vip_faucet(TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO anon, authenticated, service_role;

-- 5. Create request_vip_faucet_pol_payout RPC
CREATE OR REPLACE FUNCTION public.request_vip_faucet_pol_payout(
  p_player_id TEXT,
  p_amount NUMERIC DEFAULT 5.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_user RECORD;
  v_min_payout NUMERIC := 5.0;
  v_payout_wallet TEXT;
  v_request_id UUID;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_player_id));
  END IF;

  SELECT * INTO v_user FROM public.users WHERE LOWER(player_id) = LOWER(v_pid) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  -- Determine minimum payout threshold
  BEGIN
    SELECT COALESCE(vip_faucet_min_payout_pol, 5.0) INTO v_min_payout
    FROM public.global_settings
    WHERE id = 1
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_min_payout := 5.0;
  END;

  IF p_amount < v_min_payout THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum payout request is ' || v_min_payout || ' POL');
  END IF;

  IF COALESCE(v_user.unclaimed_vip_faucet_pol, 0.0) < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient accumulated VIP POL balance (Has ' || COALESCE(v_user.unclaimed_vip_faucet_pol, 0.0) || ' POL)');
  END IF;

  -- Resolve destination EVM wallet
  v_payout_wallet := LOWER(COALESCE(v_user.linked_wallet_address, ''));
  IF v_payout_wallet IS NULL OR v_payout_wallet = '' OR v_payout_wallet LIKE '0xpgt%' OR v_payout_wallet LIKE '0xg%' OR LENGTH(v_payout_wallet) < 42 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No linked Web3 EVM wallet found on your profile! Please link a Web3 wallet to receive payouts.');
  END IF;

  -- Deduct on-site balance
  UPDATE public.users
  SET 
    unclaimed_vip_faucet_pol = GREATEST(0.0, unclaimed_vip_faucet_pol - p_amount),
    updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid);

  -- Insert pending payout request for Master Admin
  INSERT INTO public.pol_payout_requests (wallet_address, username, amount_pol, status, source)
  VALUES (v_payout_wallet, COALESCE(v_user.username, ''), p_amount, 'pending', 'vip_faucet')
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'amount_pol', p_amount,
    'payout_wallet', v_payout_wallet,
    'new_unclaimed_balance', GREATEST(0.0, COALESCE(v_user.unclaimed_vip_faucet_pol, 0.0) - p_amount)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_vip_faucet_pol_payout(TEXT, NUMERIC) TO anon, authenticated, service_role;

-- 6. Update admin_update_global_settings to handle vip_faucet_base_pol and vip_faucet_min_payout_pol
CREATE OR REPLACE FUNCTION public.admin_update_global_settings(
  p_admin_wallet TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_addr TEXT := '0x10b9993990c9ef8a212c9557cb02ad94da9a654d';
  v_sender_wallet TEXT;
BEGIN
  -- Resolve input admin wallet / player ID
  IF p_admin_wallet IS NOT NULL AND p_admin_wallet <> '' THEN
    SELECT LOWER(COALESCE(linked_wallet_address, player_id)) INTO v_sender_wallet
    FROM users
    WHERE player_id = p_admin_wallet OR LOWER(linked_wallet_address) = LOWER(p_admin_wallet)
    LIMIT 1;
  END IF;

  IF v_sender_wallet IS NULL THEN
    v_sender_wallet := LOWER(p_admin_wallet);
  END IF;

  IF v_sender_wallet <> v_admin_addr THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Master Admin wallet required');
  END IF;

  -- Update global_settings dynamically
  UPDATE public.global_settings
  SET
    earn_multiplier = COALESCE((p_payload->>'earn_multiplier')::numeric, earn_multiplier),
    faucet_base_pgt = COALESCE((p_payload->>'faucet_base_pgt')::numeric, faucet_base_pgt),
    vip_faucet_base_pol = COALESCE((p_payload->>'vip_faucet_base_pol')::numeric, vip_faucet_base_pol),
    vip_faucet_min_payout_pol = COALESCE((p_payload->>'vip_faucet_min_payout_pol')::numeric, vip_faucet_min_payout_pol),
    site_message = COALESCE(p_payload->>'site_message', site_message),
    min_withdraw_pgt = COALESCE((p_payload->>'min_withdraw_pgt')::numeric, min_withdraw_pgt),
    max_withdraw_pgt = COALESCE((p_payload->>'max_withdraw_pgt')::numeric, max_withdraw_pgt),
    max_weekly_withdrawals = COALESCE((p_payload->>'max_weekly_withdrawals')::int, max_weekly_withdrawals),
    max_daily_plays_per_game = COALESCE((p_payload->>'max_daily_plays_per_game')::int, max_daily_plays_per_game),
    account_quarantine_days = COALESCE((p_payload->>'account_quarantine_days')::int, account_quarantine_days),
    discord_webhook_url = COALESCE(p_payload->>'discord_webhook_url', discord_webhook_url),
    discord_admin_webhook_url = COALESCE(p_payload->>'discord_admin_webhook_url', discord_admin_webhook_url),
    discord_announcements_webhook_url = COALESCE(p_payload->>'discord_announcements_webhook_url', discord_announcements_webhook_url),
    game_payout_settings = CASE 
      WHEN p_payload ? 'game_payout_settings' THEN p_payload->'game_payout_settings'
      ELSE game_payout_settings
    END
  WHERE id = 1;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_global_settings(TEXT, JSONB) TO anon, authenticated, service_role;

