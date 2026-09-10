-- ==============================================================================
-- POLYGAME: SEAL POLYSPACE MODULE LEVELS & ATOMIC UPGRADE RPC (ANTI-CHEAT)
-- ==============================================================================
-- 1. Creates canonical public.upgrade_polyspace_module(p_player_id, p_module_type).
--    - Evaluates module upgrade cost server-side: Iron, Titanium & PGT balance.
--    - Atomically verifies and deducts minerals + PGT before incrementing level.
--    - Recalculates fleetPower deterministically:
--      (warp * 100) + (laser * 80) + (cargo * 50) + (shield * 60) + (turret * 90).
-- 2. Upgrades master anti-cheat trigger (prevent_direct_balance_mutation):
--    - Rejects and reverts any client attempt ('anon' / 'authenticated') to increase
--      warpLevel, laserLevel, cargoLevel, shieldLevel, or turretLevel via direct
--      UPDATE users SET space_state = ...
--    - Recalculates fleetPower strictly from verified module levels.
-- 3. Synchronizes CRiMiNeL's fleetPower to 2,780 (Warp 12, Laser 11, Cargo 11).
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- STEP 1: DROP EXISTING UPGRADE RPC SIGNATURES
-- ==============================================================================
DROP FUNCTION IF EXISTS public.upgrade_polyspace_module(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.upgrade_polyspace_module(TEXT, NUMERIC, JSONB) CASCADE;

-- ==============================================================================
-- STEP 2: CREATE CANONICAL ATOMIC MODULE UPGRADE RPC
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.upgrade_polyspace_module(
  p_player_id TEXT,
  p_module_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_space_state JSONB;
  v_part TEXT;
  v_lvl_key TEXT;
  v_cur_lvl INTEGER := 1;
  v_new_lvl INTEGER;
  v_cost_iron INTEGER;
  v_cost_tit INTEGER;
  v_cost_pgt NUMERIC;
  v_cur_iron NUMERIC;
  v_cur_tit NUMERIC;
  v_cur_pgt NUMERIC;
  v_new_balance NUMERIC;
  v_warp INTEGER;
  v_laser INTEGER;
  v_cargo INTEGER;
  v_shield INTEGER;
  v_turret INTEGER;
  v_fleet_power INTEGER;
BEGIN
  -- 1. Identity Resolution
  v_pid := public.resolve_player_id(COALESCE(p_player_id, auth.jwt() ->> 'sub', ''));
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(COALESCE(p_player_id, '')));
  END IF;

  IF v_pid IS NULL OR v_pid = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player identity required');
  END IF;

  v_part := LOWER(TRIM(COALESCE(p_module_type, '')));
  IF v_part NOT IN ('warp', 'laser', 'cargo', 'shield', 'turret') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid module type. Must be warp, laser, cargo, shield, or turret.');
  END IF;

  v_lvl_key := v_part || 'Level';

  -- 2. Acquire Pessimistic Row Lock (Serializes concurrent upgrades)
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Account suspended');
  END IF;

  -- 3. Extract Current Module Level
  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_cur_lvl := GREATEST(1, COALESCE((v_space_state->>v_lvl_key)::integer, 1));

  IF v_cur_lvl >= 50 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Maximum Level 50 already reached for ' || UPPER(v_part));
  END IF;

  -- 4. Calculate Canonical Upgrade Costs:
  -- costIron = FLOOR(40 * 1.22^(lvl-1))
  -- costTit  = FLOOR(10 * 1.22^(lvl-1))
  -- costPgt  = FLOOR(50 * 1.22^(lvl-1))
  v_cost_iron := FLOOR(40 * POW(1.22, v_cur_lvl - 1));
  v_cost_tit  := FLOOR(10 * POW(1.22, v_cur_lvl - 1));
  v_cost_pgt  := FLOOR(50 * POW(1.22, v_cur_lvl - 1));

  v_cur_iron := COALESCE((v_space_state->>'iron')::numeric, 0);
  v_cur_tit  := COALESCE((v_space_state->>'titanium')::numeric, 0);
  v_cur_pgt  := COALESCE(v_user.balance_pgt, 0);

  -- 5. Strict Balance Verification
  IF v_cur_iron < v_cost_iron THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Insufficient Iron. Required: ' || v_cost_iron || ', Available: ' || FLOOR(v_cur_iron)
    );
  END IF;
  IF v_cur_tit < v_cost_tit THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Insufficient Titanium. Required: ' || v_cost_tit || ', Available: ' || FLOOR(v_cur_tit)
    );
  END IF;
  IF v_cur_pgt < v_cost_pgt THEN
    RETURN jsonb_build_object(
      'success', false, 
      'message', 'Insufficient PGT balance. Required: ' || v_cost_pgt || ' PGT, Available: ' || ROUND(v_cur_pgt, 2) || ' PGT'
    );
  END IF;

  -- 6. Deduct Resources & Increment Level
  v_new_lvl := v_cur_lvl + 1;
  v_space_state := jsonb_set(v_space_state, ('{' || v_lvl_key || '}')::text[], to_jsonb(v_new_lvl));
  v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(ROUND((v_cur_iron - v_cost_iron)::numeric, 2)));
  v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(ROUND((v_cur_tit - v_cost_tit)::numeric, 2)));

  -- 7. Compute Accurate Fleet Power
  v_warp   := GREATEST(1, COALESCE((v_space_state->>'warpLevel')::integer, 1));
  v_laser  := GREATEST(1, COALESCE((v_space_state->>'laserLevel')::integer, 1));
  v_cargo  := GREATEST(1, COALESCE((v_space_state->>'cargoLevel')::integer, 1));
  v_shield := GREATEST(1, COALESCE((v_space_state->>'shieldLevel')::integer, 1));
  v_turret := GREATEST(1, COALESCE((v_space_state->>'turretLevel')::integer, 1));

  v_fleet_power := (v_warp * 100) + (v_laser * 80) + (v_cargo * 50) + (v_shield * 60) + (v_turret * 90);
  v_space_state := jsonb_set(v_space_state, '{fleetPower}', to_jsonb(v_fleet_power));

  -- 8. Atomic Database Mutation
  UPDATE public.users
  SET balance_pgt = ROUND(COALESCE(balance_pgt, 0) - v_cost_pgt, 2),
      space_state = v_space_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  -- 9. Return Response
  RETURN jsonb_build_object(
    'success', true,
    'module', v_part,
    'new_level', v_new_lvl,
    'cost_iron', v_cost_iron,
    'cost_tit', v_cost_tit,
    'cost_pgt', v_cost_pgt,
    'new_balance', v_new_balance,
    'new_space_state', v_space_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.upgrade_polyspace_module(TEXT, TEXT) TO anon, authenticated, service_role;


-- ==============================================================================
-- STEP 3: BACKWARDS COMPATIBILITY OVERLOAD (FOR OLDER CLIENT TABS)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.upgrade_polyspace_module(
  p_wallet TEXT,
  p_cost_pgt NUMERIC,
  p_new_space_state JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_old_space JSONB;
  v_target_part TEXT := NULL;
BEGIN
  v_pid := public.resolve_player_id(p_wallet);
  IF v_pid IS NULL OR v_pid = '' THEN
    v_pid := LOWER(TRIM(p_wallet));
  END IF;

  SELECT * INTO v_user FROM public.users WHERE player_id = v_pid OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player not found');
  END IF;

  v_old_space := COALESCE(v_user.space_state, '{}'::jsonb);

  -- Determine which module increased
  IF COALESCE((p_new_space_state->>'warpLevel')::integer, 1) > COALESCE((v_old_space->>'warpLevel')::integer, 1) THEN
    v_target_part := 'warp';
  ELSIF COALESCE((p_new_space_state->>'laserLevel')::integer, 1) > COALESCE((v_old_space->>'laserLevel')::integer, 1) THEN
    v_target_part := 'laser';
  ELSIF COALESCE((p_new_space_state->>'cargoLevel')::integer, 1) > COALESCE((v_old_space->>'cargoLevel')::integer, 1) THEN
    v_target_part := 'cargo';
  ELSIF COALESCE((p_new_space_state->>'shieldLevel')::integer, 1) > COALESCE((v_old_space->>'shieldLevel')::integer, 1) THEN
    v_target_part := 'shield';
  ELSIF COALESCE((p_new_space_state->>'turretLevel')::integer, 1) > COALESCE((v_old_space->>'turretLevel')::integer, 1) THEN
    v_target_part := 'turret';
  END IF;

  IF v_target_part IS NOT NULL THEN
    RETURN public.upgrade_polyspace_module(v_user.player_id, v_target_part);
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'No valid module upgrade detected');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upgrade_polyspace_module(TEXT, NUMERIC, JSONB) TO anon, authenticated, service_role;


-- ==============================================================================
-- STEP 4: UPGRADE MASTER ANTI-CHEAT TRIGGER (PREVENT_DIRECT_BALANCE_MUTATION)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.prevent_direct_balance_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
  -- Strict security constraints for direct client (anon / authenticated) operations
  IF CURRENT_USER IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.balance_pgt := 0.0;
      NEW.created_at := NOW();
      NEW.is_admin := false;
      NEW.is_ambassador := false;
      NEW.is_banned := false;
      NEW.vip_until := NULL;
      NEW.total_arcade_plays := 0;
      NEW.weekly_faucet_claims := 0;
      NEW.weekly_games_played := 0;
      NEW.weekly_active_tier := 0;
      NEW.last_weekly_active_tier := 0;
      NEW.total_earned := 0.0;
      NEW.unclaimed_referral_pgt := 0.0;
      NEW.unclaimed_referral_pol := 0.0;
      NEW.total_referral_commission := 0.0;
      NEW.total_referral_pol := 0.0;
      NEW.unclaimed_vip_faucet_pol := 0.0;
      NEW.total_vip_faucet_pol := 0.0;

      -- Ensure new accounts start with baseline Level 1 PolySpace modules
      IF NEW.space_state IS NOT NULL THEN
        NEW.space_state := jsonb_set(NEW.space_state, '{warpLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{laserLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{cargoLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{shieldLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{turretLevel}', '1'::jsonb);
        NEW.space_state := jsonb_set(NEW.space_state, '{fleetPower}', '380'::jsonb);
      END IF;

    ELSIF TG_OP = 'UPDATE' THEN
      -- 1. Immutable registration timestamp
      IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        NEW.created_at := OLD.created_at;
      END IF;

      -- 2. Immutable balances (PGT balance mutations MUST go through SECURITY DEFINER RPCs)
      IF NEW.balance_pgt IS DISTINCT FROM OLD.balance_pgt THEN
        NEW.balance_pgt := OLD.balance_pgt;
      END IF;

      -- 3. Immutable roles and VIP / ban status
      IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
        NEW.is_admin := OLD.is_admin;
      END IF;
      IF NEW.is_ambassador IS DISTINCT FROM OLD.is_ambassador THEN
        NEW.is_ambassador := OLD.is_ambassador;
      END IF;
      IF NEW.is_banned IS DISTINCT FROM OLD.is_banned THEN
        NEW.is_banned := OLD.is_banned;
      END IF;
      IF NEW.vip_until IS DISTINCT FROM OLD.vip_until THEN
        NEW.vip_until := OLD.vip_until;
      END IF;

      -- 4. Immutable career total_arcade_plays (server RPC controlled only)
      IF NEW.total_arcade_plays IS DISTINCT FROM OLD.total_arcade_plays THEN
        NEW.total_arcade_plays := OLD.total_arcade_plays;
      END IF;

      -- 5. Immutable faucet timestamps & streaks (seals cooldown-wiping exploit)
      IF NEW.last_faucet_claim IS DISTINCT FROM OLD.last_faucet_claim THEN
        NEW.last_faucet_claim := OLD.last_faucet_claim;
      END IF;
      IF NEW.faucet_streak IS DISTINCT FROM OLD.faucet_streak THEN
        NEW.faucet_streak := OLD.faucet_streak;
      END IF;
      IF NEW.last_vip_faucet_claim IS DISTINCT FROM OLD.last_vip_faucet_claim THEN
        NEW.last_vip_faucet_claim := OLD.last_vip_faucet_claim;
      END IF;
      IF NEW.vip_faucet_streak IS DISTINCT FROM OLD.vip_faucet_streak THEN
        NEW.vip_faucet_streak := OLD.vip_faucet_streak;
      END IF;

      -- 6. Immutable weekly activity counters
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

      -- 7. Immutable career earnings & referral balances
      IF NEW.total_earned IS DISTINCT FROM OLD.total_earned THEN
        NEW.total_earned := OLD.total_earned;
      END IF;
      IF NEW.unclaimed_referral_pgt IS DISTINCT FROM OLD.unclaimed_referral_pgt THEN
        NEW.unclaimed_referral_pgt := OLD.unclaimed_referral_pgt;
      END IF;
      IF NEW.unclaimed_referral_pol IS DISTINCT FROM OLD.unclaimed_referral_pol THEN
        NEW.unclaimed_referral_pol := OLD.unclaimed_referral_pol;
      END IF;
      IF NEW.total_referral_commission IS DISTINCT FROM OLD.total_referral_commission THEN
        NEW.total_referral_commission := OLD.total_referral_commission;
      END IF;
      IF NEW.total_referral_pol IS DISTINCT FROM OLD.total_referral_pol THEN
        NEW.total_referral_pol := OLD.total_referral_pol;
      END IF;
      IF NEW.unclaimed_vip_faucet_pol IS DISTINCT FROM OLD.unclaimed_vip_faucet_pol THEN
        NEW.unclaimed_vip_faucet_pol := OLD.unclaimed_vip_faucet_pol;
      END IF;
      IF NEW.total_vip_faucet_pol IS DISTINCT FROM OLD.total_vip_faucet_pol THEN
        NEW.total_vip_faucet_pol := OLD.total_vip_faucet_pol;
      END IF;

      -- 8. Immutable tournament scores & boss metrics
      IF NEW.game_highscore IS DISTINCT FROM OLD.game_highscore THEN
        NEW.game_highscore := OLD.game_highscore;
      END IF;
      IF NEW.invaders_highscore IS DISTINCT FROM OLD.invaders_highscore THEN
        NEW.invaders_highscore := OLD.invaders_highscore;
      END IF;
      IF NEW.drift_highscore IS DISTINCT FROM OLD.drift_highscore THEN
        NEW.drift_highscore := OLD.drift_highscore;
      END IF;
      IF NEW.stacker_highscore IS DISTINCT FROM OLD.stacker_highscore THEN
        NEW.stacker_highscore := OLD.stacker_highscore;
      END IF;
      IF NEW.skeet_highscore IS DISTINCT FROM OLD.skeet_highscore THEN
        NEW.skeet_highscore := OLD.skeet_highscore;
      END IF;
      IF NEW.defense_highscore IS DISTINCT FROM OLD.defense_highscore THEN
        NEW.defense_highscore := OLD.defense_highscore;
      END IF;
      IF NEW.boss_weekly_damage IS DISTINCT FROM OLD.boss_weekly_damage THEN
        NEW.boss_weekly_damage := OLD.boss_weekly_damage;
      END IF;
      IF NEW.alltime_boss_damage IS DISTINCT FROM OLD.alltime_boss_damage THEN
        NEW.alltime_boss_damage := OLD.alltime_boss_damage;
      END IF;
      IF NEW.boss_attacks_count IS DISTINCT FROM OLD.boss_attacks_count THEN
        NEW.boss_attacks_count := OLD.boss_attacks_count;
      END IF;

      -- 9. IMMUTABLE POLYSPACE MODULE LEVELS ON DIRECT CLIENT UPDATES
      -- Direct PostgREST client updates cannot increase module levels.
      -- Upgrades MUST be authorized through public.upgrade_polyspace_module().
      IF NEW.space_state IS NOT NULL THEN
        IF OLD.space_state IS NOT NULL THEN
          -- Revert any client attempt to increase warpLevel
          IF COALESCE((NEW.space_state->>'warpLevel')::integer, 1) > COALESCE((OLD.space_state->>'warpLevel')::integer, 1) THEN
            NEW.space_state := jsonb_set(NEW.space_state, '{warpLevel}', to_jsonb(COALESCE((OLD.space_state->>'warpLevel')::integer, 1)));
          END IF;
          -- Revert any client attempt to increase laserLevel
          IF COALESCE((NEW.space_state->>'laserLevel')::integer, 1) > COALESCE((OLD.space_state->>'laserLevel')::integer, 1) THEN
            NEW.space_state := jsonb_set(NEW.space_state, '{laserLevel}', to_jsonb(COALESCE((OLD.space_state->>'laserLevel')::integer, 1)));
          END IF;
          -- Revert any client attempt to increase cargoLevel
          IF COALESCE((NEW.space_state->>'cargoLevel')::integer, 1) > COALESCE((OLD.space_state->>'cargoLevel')::integer, 1) THEN
            NEW.space_state := jsonb_set(NEW.space_state, '{cargoLevel}', to_jsonb(COALESCE((OLD.space_state->>'cargoLevel')::integer, 1)));
          END IF;
          -- Revert any client attempt to increase shieldLevel
          IF COALESCE((NEW.space_state->>'shieldLevel')::integer, 1) > COALESCE((OLD.space_state->>'shieldLevel')::integer, 1) THEN
            NEW.space_state := jsonb_set(NEW.space_state, '{shieldLevel}', to_jsonb(COALESCE((OLD.space_state->>'shieldLevel')::integer, 1)));
          END IF;
          -- Revert any client attempt to increase turretLevel
          IF COALESCE((NEW.space_state->>'turretLevel')::integer, 1) > COALESCE((OLD.space_state->>'turretLevel')::integer, 1) THEN
            NEW.space_state := jsonb_set(NEW.space_state, '{turretLevel}', to_jsonb(COALESCE((OLD.space_state->>'turretLevel')::integer, 1)));
          END IF;
        END IF;

        -- Enforce deterministic fleetPower calculation from validated module levels
        NEW.space_state := jsonb_set(
          NEW.space_state,
          '{fleetPower}',
          to_jsonb(
            (GREATEST(1, COALESCE((NEW.space_state->>'warpLevel')::integer, 1)) * 100) +
            (GREATEST(1, COALESCE((NEW.space_state->>'laserLevel')::integer, 1)) * 80) +
            (GREATEST(1, COALESCE((NEW.space_state->>'cargoLevel')::integer, 1)) * 50) +
            (GREATEST(1, COALESCE((NEW.space_state->>'shieldLevel')::integer, 1)) * 60) +
            (GREATEST(1, COALESCE((NEW.space_state->>'turretLevel')::integer, 1)) * 90)
          )
        );
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


-- ==============================================================================
-- STEP 5: SYNCHRONIZE CRIMINEL FLEET POWER TO 2,780
-- ==============================================================================
UPDATE public.users
SET space_state = jsonb_set(space_state, '{fleetPower}', '2780'::jsonb),
    updated_at = NOW()
WHERE LOWER(username) = 'criminel' OR player_id = '0xpgt25c12fd2';

-- Force schema reload
NOTIFY pgrst, 'reload schema';

COMMIT;
