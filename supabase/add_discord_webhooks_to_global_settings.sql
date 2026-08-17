-- ==============================================================================
-- POLYGAME: ADD DISCORD WEBHOOK URLS TO GLOBAL_SETTINGS TABLE
-- Moves secret webhook URLs out of public frontend git repository into DB
-- ==============================================================================

-- 1. Ensure columns exist on global_settings
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS discord_admin_webhook_url TEXT;
ALTER TABLE public.global_settings ADD COLUMN IF NOT EXISTS discord_announcements_webhook_url TEXT;

-- 2. Populate default webhook URLs into row id = 1
UPDATE public.global_settings
SET 
  discord_webhook_url = COALESCE(discord_webhook_url, 'https://discord.com/api/webhooks/1529336801523667094/0xXmAKqi0DbsvLxDBxlnDeb5qGdiFKpsE5kSvNq5iqxeQiNun5ZPmlxZvaxgJwkQfOB5'),
  discord_admin_webhook_url = COALESCE(discord_admin_webhook_url, 'https://discord.com/api/webhooks/1529701591303717005/INswRx3IpcbDKRXu95Foi2WSyi4LhWu09fwuQPEr3QKtt8tO5gnc0b2_pf2bcrYuyZtZ'),
  discord_announcements_webhook_url = COALESCE(discord_announcements_webhook_url, 'https://discord.com/api/webhooks/1538643364931702847/K4gJrFehXPHjTbj26a2tBGcbDj_dtu1DAR447qOCeCtpNAA7FwWP9vmBnL6aFtUNELLc')
WHERE id = 1;
