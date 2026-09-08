-- ==============================================================================
-- POLYGON GAMING: RESTORE WEEKLY ACTIVITY TIERS & FIX IDEMPOTENT RESET
-- ==============================================================================
-- 1. Restores all 11 active players' official earned past-week standing
-- 2. Makes snapshot_weekly_activity_tiers() 100% idempotent (preserves tiers on repeated runs)
-- 3. Shields weekly counters in the anti-cheat trigger against stale client overwrites
-- ==============================================================================

-- STEP 1: Restore Official Earned Past-Week Tiers (last_weekly_active_tier)
UPDATE public.users 
SET last_weekly_active_tier = 5, updated_at = NOW()
WHERE player_id IN (
  '0xpgt8312e02d37185b5983e6922d1dae1cce', -- Poss (8 Faucets, 148 Games -> Apex Legend L5)
  '0xpgt1340d9e6',                          -- Vezuvius King (7 Faucets, 258 Games -> Apex Legend L5)
  '0xpgt3a44cee7'                           -- Paul V (6 Faucets, 51 Games -> Apex Legend L5)
);

UPDATE public.users 
SET last_weekly_active_tier = 4, updated_at = NOW()
WHERE player_id IN (
  '0xpgtd6c88ba475c04696b0d78d2da526ae9800000' -- Jack S (5 Faucets, 34 Games -> Diamond L4)
);

UPDATE public.users 
SET last_weekly_active_tier = 3, updated_at = NOW()
WHERE player_id IN (
  '0xpgt5e64957dabcde8ba47239a359f61b6f1' -- Fly (5 Faucets, 16 Games -> Gold L3)
);

UPDATE public.users 
SET last_weekly_active_tier = 2, updated_at = NOW()
WHERE player_id IN (
  '0xpgt85c8416473bd6a8c45ada81ac85aeabb', -- Origin / Admin (1 Faucet, 45 Games -> Silver L2)
  '0xpgt25c12fd2',                          -- CRiMiNeL (1 Faucet, 103 Games -> Silver L2)
  '0xpgt08891829df91813056bbd8d6e838cdc4', -- Bass (1 Faucet, 13 Games -> Silver L2)
  '0xpgtccc84ccd'                           -- Anonymous (1 Faucet, 12 Games -> Silver L2)
);

UPDATE public.users 
SET last_weekly_active_tier = 1, updated_at = NOW()
WHERE player_id IN (
  '0xpgt1315acc40000000000000000000000000000', -- troubs (1 Faucet, 15 Games -> Scout L1)
  '0xpgt33682426'                               -- patesz (1 Faucet, 1 Game -> Scout L1)
);


-- STEP 2: Make snapshot_weekly_activity_tiers() Idempotent
-- (If run multiple times, it NEVER wipes last_weekly_active_tier down to 0)
CREATE OR REPLACE FUNCTION public.snapshot_weekly_activity_tiers()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INT := 0;
BEGIN
  WITH updated AS (
    UPDATE public.users
    SET 
      last_weekly_active_tier = CASE 
        WHEN COALESCE(weekly_active_tier, 0) > 0 THEN weekly_active_tier 
        ELSE COALESCE(last_weekly_active_tier, 0) 
      END,
      weekly_faucet_claims = 0,
      weekly_games_played = 0,
      weekly_active_tier = 0,
      updated_at = NOW()
    WHERE 
      COALESCE(weekly_faucet_claims, 0) > 0 OR 
      COALESCE(weekly_games_played, 0) > 0 OR 
      COALESCE(weekly_active_tier, 0) > 0
    RETURNING player_id
  )
  SELECT COUNT(*) INTO v_updated_count FROM updated;

  RETURN jsonb_build_object(
    'success', true,
    'accounts_snapshotted', v_updated_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.snapshot_weekly_activity_tiers() TO anon, authenticated, service_role;


-- STEP 3: Anti-Cheat Trigger Update
-- Revert direct client attempts (anon/authenticated) to modify weekly activity columns.
-- Only SECURITY DEFINER RPCs (snapshot_weekly_activity_tiers, claim_faucet, end_arcade_session)
-- running as postgres can modify weekly activity counters.
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  IF CURRENT_USER IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.balance_pgt := 0.0;
      NEW.balance_1flr := 0.0;
      NEW.created_at := NOW();
      NEW.is_admin := false;
      NEW.is_ambassador := false;
      NEW.vip_until := NULL;
      NEW.weekly_faucet_claims := 0;
      NEW.weekly_games_played := 0;
      NEW.weekly_active_tier := 0;
      NEW.last_weekly_active_tier := 0;
    ELSIF TG_OP = 'UPDATE' THEN
      -- 1. Immutable registration timestamp
      IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        NEW.created_at := OLD.created_at;
      END IF;
      -- 2. Immutable balances
      IF NEW.balance_pgt IS DISTINCT FROM OLD.balance_pgt THEN
        NEW.balance_pgt := OLD.balance_pgt;
      END IF;
      IF NEW.balance_1flr IS DISTINCT FROM OLD.balance_1flr THEN
        NEW.balance_1flr := OLD.balance_1flr;
      END IF;
      -- 3. Immutable roles and VIP status
      IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
        NEW.is_admin := OLD.is_admin;
      END IF;
      IF NEW.is_ambassador IS DISTINCT FROM OLD.is_ambassador THEN
        NEW.is_ambassador := OLD.is_ambassador;
      END IF;
      IF NEW.vip_until IS DISTINCT FROM OLD.vip_until THEN
        NEW.vip_until := OLD.vip_until;
      END IF;
      -- 4. Immutable weekly activity counters (prevents stale browser saveToDB overwrites)
      IF NEW.weekly_faucet_claims IS DISTINCT FROM OLD.weekly_faucet_claims THEN
        NEW.weekly_faucet_claims := OLD.weekly_faucet_claims;
      END IF;
      IF NEW.weekly_games_played IS DISTINCT FROM OLD.weekly_games_played THEN
        NEW.weekly_games_played := OLD.weekly_games_played;
      END IF;
      IF NEW.weekly_active_tier IS DISTINCT FROM OLD.weekly_active_tier THEN
        NEW.weekly_active_tier := OLD.weekly_active_tier;
      END IF;
      IF NEW.last_weekly_active_tier IS DISTINCT FROM OLD.last_weekly_active_tier THEN
        NEW.last_weekly_active_tier := OLD.last_weekly_active_tier;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_balance_mutation ON public.users;
CREATE TRIGGER trg_prevent_direct_balance_mutation
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_direct_balance_mutation();
