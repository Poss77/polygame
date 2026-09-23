-- ==============================================================================
-- POLYGON GAMING: PURGE FAKE TEST FIXTURE ACCOUNTS & SHIELD REGISTRATION
-- Target: 221 fake bot accounts injected by Dobby (test_sb09zy_0001..0221)
-- Date: 2026-09-22
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: Purge all 221 fake test fixture accounts injected by Dobby
-- ------------------------------------------------------------------------------
DELETE FROM public.users
WHERE auth_provider = 'admin_test_fixture'
   OR player_id ILIKE 'test_sb09zy_%'
   OR username ILIKE '__TEST__user_%';

-- ------------------------------------------------------------------------------
-- STEP 2: Zero out Dobby's illicit balance and enforce permanent ban
-- ------------------------------------------------------------------------------
UPDATE public.users
SET balance_pgt = 0.0,
    unclaimed_referral_pgt = 0.0,
    total_referral_commission = 0.0,
    referrals_count = 0,
    referrals_l1 = 0,
    referrals_l2 = 0,
    referrals_l3 = 0,
    referrals_l4 = 0,
    referrals_list = '[]'::jsonb,
    is_banned = true,
    bot_warning = 99,
    updated_at = NOW()
WHERE player_id = '0xpgt003e7625'
   OR linked_wallet_address ILIKE '0x602BEc371e2A99f679C73A5930a590CeBf8e7696';

-- ------------------------------------------------------------------------------
-- STEP 3: Hardened Account Creation Shield in prevent_direct_balance_mutation
-- Enforces:
--   1. Strict auth_provider whitelist ('google', 'wallet', 'guest')
--   2. Strict player_id prefix requirement ('0xpgt', '0xg', '0xguest')
--   3. Rejects fake test usernames ('__test__') and test IDs ('test_')
--   4. Rejects dummy burner wallet addresses ('0x00...00')
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_today TEXT := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
BEGIN
  -- Restrict direct PostgREST client queries (anon & authenticated roles)
  IF LOWER(CURRENT_USER) IN ('anon', 'authenticated') THEN

    IF TG_OP = 'INSERT' THEN
      -- 1. Anti-Bot Registration Guard: Reject fake fixtures, bots, and dummy formats
      IF NEW.auth_provider IS NOT NULL AND NEW.auth_provider NOT IN ('google', 'wallet', 'guest') THEN
        RAISE EXCEPTION 'REGISTRATION_REJECTED: Invalid auth provider.';
      END IF;

      IF NEW.player_id IS NULL 
         OR NEW.player_id ILIKE 'test_%'
         OR NEW.player_id NOT SIMILAR TO '(0xpgt|0xg|0xguest)[a-zA-Z0-9_]+' THEN
        RAISE EXCEPTION 'REGISTRATION_REJECTED: Invalid player ID format.';
      END IF;

      IF NEW.username IS NOT NULL AND NEW.username ILIKE '%__test__%' THEN
        RAISE EXCEPTION 'REGISTRATION_REJECTED: Test fixtures disallowed in production.';
      END IF;

      IF NEW.linked_wallet_address IS NOT NULL AND NEW.linked_wallet_address <> '' THEN
        IF NEW.linked_wallet_address ~ '00000000000000000000' THEN
          RAISE EXCEPTION 'REGISTRATION_REJECTED: Dummy wallet address rejected.';
        END IF;
      END IF;

      -- 2. Sanitize newly inserted accounts against elevated balances & privileges
      NEW.balance_pgt := 0.0;
      NEW.created_at := NOW();
      NEW.is_admin := false;
      NEW.is_ambassador := false;
      NEW.dex_liquidity_usd := 0.0;
      NEW.is_banned := false;
      NEW.bot_warning := 0;
      NEW.vip_until := NULL;
      NEW.total_earned := 0.0;
      NEW.total_arcade_plays := 0;
      NEW.game_highscore := 0;
      NEW.invaders_highscore := 0;
      NEW.drift_highscore := 0;
      NEW.stacker_highscore := 0;
      NEW.skeet_highscore := 0;
      NEW.defense_highscore := 0;
      NEW.boss_weekly_damage := 0;
      NEW.alltime_boss_damage := 0;
      NEW.boss_attacks_count := 0;
      NEW.weekly_faucet_claims := 0;
      NEW.weekly_games_played := 0;
      NEW.weekly_active_tier := 0;
      NEW.last_weekly_active_tier := 0;
      NEW.faucet_streak := 0;
      NEW.vip_faucet_streak := 0;
      NEW.unclaimed_referral_pgt := 0.0;
      NEW.unclaimed_referral_pol := 0.0;
      NEW.total_referral_commission := 0.0;
      NEW.total_referral_pol := 0.0;
      NEW.unclaimed_vip_faucet_pol := 0.0;
      NEW.total_vip_faucet_pol := 0.0;
      NEW.owned_nfts := '[]'::jsonb;
      NEW.crate_nfts := '[]'::jsonb;
      NEW.relics := '{}'::jsonb;
      NEW.last_turnstile_at := NULL;

      -- Prevent setting fake referrals on account creation
      NEW.referrals_count := 0;
      NEW.referrals_l1 := 0;
      NEW.referrals_l2 := 0;
      NEW.referrals_l3 := 0;
      NEW.referrals_l4 := 0;
      NEW.referrals_list := '[]'::jsonb;
      NEW.referred_by_l1 := NULL;
      NEW.referred_by_l2 := NULL;
      NEW.referred_by_l3 := NULL;
      NEW.referred_by_l4 := NULL;

      -- Prevent squatting on existing player IDs or wallet addresses with referral_code on account creation
      IF NEW.referral_code IS NOT NULL AND NEW.referral_code <> '' THEN
        IF EXISTS (
          SELECT 1 FROM public.users 
          WHERE LOWER(player_id) = LOWER(NEW.referral_code) 
             OR (linked_wallet_address IS NOT NULL AND LOWER(linked_wallet_address) = LOWER(NEW.referral_code))
        ) THEN
          NEW.referral_code := 'ref_' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 8);
        END IF;
      END IF;

      -- Clamp starting minerals & space statistics
      IF NEW.space_state IS NOT NULL THEN
        NEW.space_state := jsonb_set(NEW.space_state, '{warpLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{laserLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{cargoLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{shieldLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{turretLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{fleetPower}', '380'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{raidsWon}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{pgtMinedTotal}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{mineralsMinedTotal}', '0'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{iron}', to_jsonb(LEAST(COALESCE((NEW.space_state->>'iron')::numeric, 50), 50)));
        NEW.space_state := jsonb_set(NEW.space_state, '{titanium}', to_jsonb(LEAST(COALESCE((NEW.space_state->>'titanium')::numeric, 10), 10)));
        NEW.space_state := jsonb_set(NEW.space_state, '{quantum}', '0'::jsonb);
      END IF;

      RETURN NEW;
    END IF;

    -- ON UPDATE: Preserve all established anti-cheat locks
    IF TG_OP = 'UPDATE' THEN
      IF NEW.balance_pgt IS DISTINCT FROM OLD.balance_pgt THEN
        NEW.balance_pgt := OLD.balance_pgt;
      END IF;

      IF NEW.player_id IS DISTINCT FROM OLD.player_id THEN
        NEW.player_id := OLD.player_id;
      END IF;

      IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
        NEW.is_banned := OLD.is_banned;
      END IF;

      IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
        NEW.is_admin := OLD.is_admin;
      END IF;

      IF NEW.referred_by_l1 IS DISTINCT FROM OLD.referred_by_l1 THEN
        NEW.referred_by_l1 := OLD.referred_by_l1;
      END IF;
      IF NEW.referred_by_l2 IS DISTINCT FROM OLD.referred_by_l2 THEN
        NEW.referred_by_l2 := OLD.referred_by_l2;
      END IF;
      IF NEW.referred_by_l3 IS DISTINCT FROM OLD.referred_by_l3 THEN
        NEW.referred_by_l3 := OLD.referred_by_l3;
      END IF;
      IF NEW.referred_by_l4 IS DISTINCT FROM OLD.referred_by_l4 THEN
        NEW.referred_by_l4 := OLD.referred_by_l4;
      END IF;

      IF NEW.referrals_count IS DISTINCT FROM OLD.referrals_count THEN
        NEW.referrals_count := OLD.referrals_count;
      END IF;
      IF NEW.unclaimed_referral_pgt IS DISTINCT FROM OLD.unclaimed_referral_pgt THEN
        NEW.unclaimed_referral_pgt := OLD.unclaimed_referral_pgt;
      END IF;
      IF NEW.total_referral_commission IS DISTINCT FROM OLD.total_referral_commission THEN
        NEW.total_referral_commission := OLD.total_referral_commission;
      END IF;

      RETURN NEW;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_direct_balance_mutation ON public.users;
CREATE TRIGGER trigger_prevent_direct_balance_mutation
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_balance_mutation();
