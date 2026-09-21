-- ==============================================================================
-- FORWARD MIGRATION: FIX DISCORD WEBHOOK SECRETS & PASSKEY VERIFICATION
-- Version: v1.5.428
-- 
-- Description:
-- 1. Updates `public.get_admin_discord_webhooks` and `public.update_admin_discord_webhooks`
--    to verify the Master Admin Passkey via `public.verify_admin_passkey(p_admin_passkey)`
--    (which uses salted SHA-256 in `public.admin_security_config`) instead of the
--    obsolete/nullified `global_settings.admin_passkey` column.
-- 2. Ensures row 1 exists in `public.admin_discord_secrets`.
-- 3. Grants execute permissions to anon, authenticated, and service_role.
-- ==============================================================================

-- Ensure base row exists in admin_discord_secrets
INSERT INTO public.admin_discord_secrets (id, updated_at)
VALUES (1, NOW())
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- RPC: get_admin_discord_webhooks
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_discord_webhooks(p_admin_passkey TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_row RECORD;
BEGIN
  -- Verify Master Admin passkey via canonical salted verifier
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid Master Admin Passkey');
  END IF;

  SELECT * INTO v_row FROM public.admin_discord_secrets WHERE id = 1;

  RETURN jsonb_build_object(
    'success', true,
    'main', COALESCE(v_row.discord_webhook_url, ''),
    'admin', COALESCE(v_row.discord_admin_webhook_url, ''),
    'announcements', COALESCE(v_row.discord_announcements_webhook_url, '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_discord_webhooks(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: update_admin_discord_webhooks
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_admin_discord_webhooks(
  p_admin_passkey TEXT,
  p_main TEXT DEFAULT NULL,
  p_admin TEXT DEFAULT NULL,
  p_announcements TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- Verify Master Admin passkey via canonical salted verifier
  IF NOT public.verify_admin_passkey(p_admin_passkey) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Invalid Master Admin Passkey');
  END IF;

  INSERT INTO public.admin_discord_secrets (id, discord_webhook_url, discord_admin_webhook_url, discord_announcements_webhook_url, updated_at)
  VALUES (1, p_main, p_admin, p_announcements, NOW())
  ON CONFLICT (id) DO UPDATE
  SET discord_webhook_url = COALESCE(p_main, admin_discord_secrets.discord_webhook_url),
      discord_admin_webhook_url = COALESCE(p_admin, admin_discord_secrets.discord_admin_webhook_url),
      discord_announcements_webhook_url = COALESCE(p_announcements, admin_discord_secrets.discord_announcements_webhook_url),
      updated_at = NOW();

  -- Guarantee global_settings columns remain completely sanitized
  UPDATE public.global_settings
  SET discord_webhook_url = NULL,
      discord_admin_webhook_url = NULL,
      discord_announcements_webhook_url = NULL
  WHERE id = 1;

  RETURN jsonb_build_object('success', true, 'message', 'Discord Webhook secrets updated securely');
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_admin_discord_webhooks(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
