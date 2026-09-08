-- ==============================================================================
-- POLYGON GAMING: ATOMIC ON-CHAIN WITHDRAWAL VOUCHER SECURITY & HISTORY FIX
-- ==============================================================================
--
-- VULNERABILITY DIAGNOSED (2026-09-08):
-- 1. Table withdrawals_history lacked the ip_address column.
-- 2. In Edge Function withdraw-pgt, supabase.from('withdrawals_history').insert({...})
--    failed on every call because column ip_address did not exist.
-- 3. Because the insert failed silently, withdrawals_history was never populated.
-- 4. Consequently, the 7-day rolling withdrawal counter (recentCount) was always 0.
-- 5. Attacker Nower exploited this by requesting 195 separate 25,000 PGT vouchers
--    in rapid succession and minting 4,875,000 PGT on-chain.
-- 6. When claiming tokens on Polygon, Nower paid 0.5 POL per claim in contract fees.
--    The PGT Token Contract (0x701100D19b1a93672cfe7291EA455b4220631209) now holds
--    95.0 POL from these transactions, available to be swept by the Master Admin!
--
-- THIS SCRIPT PERMANENTLY RESOLVES THE WITHDRAWAL SYSTEM:
-- 1. Ensures withdrawals_history table has ip_address, nonce, and amount columns.
-- 2. Implements request_withdrawal_voucher: an atomic SECURITY DEFINER procedure
--    that uses FOR UPDATE row locking, validates bans, checks 7-day quarantine,
--    enforces rolling 7-day quota (across player_id, wallet, and IP), verifies balance,
--    deducts balance, and writes to withdrawals_history in a SINGLE ATOMIC TRANSACTION.
-- 3. Implements cancel_withdrawal_voucher for safe rollback if voucher signing fails.
-- 4. Ensures strict RLS so client apps cannot tamper with withdrawal records.
--
-- ==============================================================================

BEGIN;

-- 1. Ensure all necessary columns exist on public.withdrawals_history
ALTER TABLE public.withdrawals_history ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.withdrawals_history ADD COLUMN IF NOT EXISTS nonce NUMERIC;
ALTER TABLE public.withdrawals_history ADD COLUMN IF NOT EXISTS amount NUMERIC;

-- Create high-performance indexes for rate limit checks
CREATE INDEX IF NOT EXISTS idx_withdrawals_history_player ON public.withdrawals_history(LOWER(player_id), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_history_wallet ON public.withdrawals_history(LOWER(wallet_address), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_history_ip ON public.withdrawals_history(ip_address, created_at DESC) WHERE ip_address IS NOT NULL AND ip_address != 'unknown';
CREATE INDEX IF NOT EXISTS idx_withdrawals_history_nonce ON public.withdrawals_history(nonce);

-- 2. Atomic Stored Procedure: request_withdrawal_voucher
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
    END IF;
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

-- 3. Rollback Procedure: cancel_withdrawal_voucher
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

-- 4. Secure RLS policies on withdrawals_history
ALTER TABLE public.withdrawals_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read withdrawals_history" ON public.withdrawals_history;
DROP POLICY IF EXISTS "Public Can Only View History" ON public.withdrawals_history;
DROP POLICY IF EXISTS public_read_withdrawals_history ON public.withdrawals_history;
CREATE POLICY public_read_withdrawals_history 
  ON public.withdrawals_history FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Service Role Only Writes History" ON public.withdrawals_history;
DROP POLICY IF EXISTS "Service role full access on withdrawals_history" ON public.withdrawals_history;
DROP POLICY IF EXISTS service_role_all_withdrawals_history ON public.withdrawals_history;
CREATE POLICY service_role_all_withdrawals_history 
  ON public.withdrawals_history FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

REVOKE INSERT, UPDATE, DELETE ON public.withdrawals_history FROM anon, authenticated;
GRANT SELECT ON public.withdrawals_history TO anon, authenticated;
GRANT ALL ON public.withdrawals_history TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
