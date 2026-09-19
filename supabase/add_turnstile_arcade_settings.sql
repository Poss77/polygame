-- ==============================================================================
-- MIGRATION: Cloudflare Turnstile Arcade Anti-Bot Shield & Master Controls
-- Version: v1.5.410 (PLAN-010)
-- Purpose:
--   1. Adds configurable anti-bot Turnstile settings to public.global_settings:
--      - turnstile_arcade_enabled (BOOLEAN, default true): Master Kill-Switch
--      - turnstile_arcade_frequency (INTEGER, default 3): Every N arcade games
--      - turnstile_arcade_vip_bypass (BOOLEAN, default false): VIP exemption toggle
--   2. Updates `public.admin_update_global_settings` to allow the Master Admin
--      to adjust or deactivate Turnstile on demand without redeployment.
-- ==============================================================================

-- 1. Add Turnstile Columns to global_settings
ALTER TABLE public.global_settings 
ADD COLUMN IF NOT EXISTS turnstile_arcade_enabled BOOLEAN DEFAULT true;

ALTER TABLE public.global_settings 
ADD COLUMN IF NOT EXISTS turnstile_arcade_frequency INTEGER DEFAULT 3;

ALTER TABLE public.global_settings 
ADD COLUMN IF NOT EXISTS turnstile_arcade_vip_bypass BOOLEAN DEFAULT false;

-- 2. Populate defaults for existing record
UPDATE public.global_settings 
SET 
  turnstile_arcade_enabled = COALESCE(turnstile_arcade_enabled, true),
  turnstile_arcade_frequency = COALESCE(turnstile_arcade_frequency, 3),
  turnstile_arcade_vip_bypass = COALESCE(turnstile_arcade_vip_bypass, false)
WHERE id = 1;

-- 3. Update Master Admin Settings Stored Procedure
CREATE OR REPLACE FUNCTION public.admin_update_global_settings(
  p_payload JSONB,
  p_admin_passkey TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid or missing Admin Passkey');
  END IF;

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
    END,
    turnstile_arcade_enabled = CASE
      WHEN p_payload ? 'turnstile_arcade_enabled' THEN (p_payload->>'turnstile_arcade_enabled')::boolean
      ELSE turnstile_arcade_enabled
    END,
    turnstile_arcade_frequency = CASE
      WHEN p_payload ? 'turnstile_arcade_frequency' THEN (p_payload->>'turnstile_arcade_frequency')::int
      ELSE turnstile_arcade_frequency
    END,
    turnstile_arcade_vip_bypass = CASE
      WHEN p_payload ? 'turnstile_arcade_vip_bypass' THEN (p_payload->>'turnstile_arcade_vip_bypass')::boolean
      ELSE turnstile_arcade_vip_bypass
    END
  WHERE id = 1;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_global_settings(JSONB, TEXT) TO anon, authenticated, service_role;
