-- ==============================================================================
-- POLYGAME EMERGENCY SECURITY PATCH:
-- 1. DROP VULNERABLE `credit_arcade_payout` RPC & OVERLOADS COMPLETELY
-- 2. CREATE SECURE `poke_allied_outpost` & `launch_outpost_raid` (NO CLIENT AMOUNT PARAMETERS)
-- 3. BAN AND ZERO-OUT ALL NOWER SYBIL BOT ACCOUNTS & ILLICIT COMMISSIONS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- STEP 1: DROP VULNERABLE `credit_arcade_payout` STORED PROCEDURES
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.credit_arcade_payout(TEXT, NUMERIC, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.credit_arcade_payout(TEXT, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.credit_arcade_payout(NUMERIC, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.credit_arcade_payout CASCADE;

-- ------------------------------------------------------------------------------
-- STEP 2: CREATE SECURE SERVER-AUTHORITATIVE OUTPOST PROCEDURES
-- (These procedures compute rewards entirely on Postgres; clients CANNOT pass amounts)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.poke_allied_outpost(
  p_player_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_user RECORD;
  v_today_str TEXT := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_warp_level INTEGER;
  v_bonus_iron INTEGER;
  v_bonus_pgt NUMERIC := 20.00;
  v_new_balance NUMERIC;
  v_state JSONB;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(p_player_id)); 
  END IF;

  SELECT * INTO v_user 
  FROM public.users 
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account suspended');
  END IF;

  v_state := COALESCE(v_user.space_state, '{}'::jsonb);

  -- Enforce 1/day UTC cooldown
  IF (v_state->>'lastPokeDate') = v_today_str THEN
    RETURN jsonb_build_object('success', false, 'error', 'Allied Outpost already poked today (1/day limit)! Resets at midnight UTC.');
  END IF;

  v_warp_level := COALESCE((v_state->>'warpLevel')::integer, 1);
  v_bonus_iron := 20 * v_warp_level;

  -- Update space state minerals and cooldown
  v_state := jsonb_set(v_state, '{lastPokeDate}', to_jsonb(v_today_str));
  v_state := jsonb_set(v_state, '{iron}', to_jsonb(COALESCE((v_state->>'iron')::numeric, 0) + v_bonus_iron));
  v_state := jsonb_set(v_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((v_state->>'mineralsMinedTotal')::numeric, 0) + v_bonus_iron));
  v_state := jsonb_set(v_state, '{pgtMinedTotal}', to_jsonb(ROUND(COALESCE((v_state->>'pgtMinedTotal')::numeric, 0) + v_bonus_pgt, 2)));

  -- Atomically credit PGT balance and update state
  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_bonus_pgt,
      total_earned = COALESCE(total_earned, 0) + v_bonus_pgt,
      space_state = v_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  -- Process referral commissions (20 PGT base)
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_referral_commissions') THEN
    BEGIN
      PERFORM process_referral_commissions(v_user.player_id, v_bonus_pgt, 'PolySpace Outpost Poke');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'bonus_iron', v_bonus_iron,
    'bonus_pgt', v_bonus_pgt,
    'new_balance', v_new_balance,
    'space_state', v_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.poke_allied_outpost(TEXT) TO anon, authenticated, service_role;


CREATE OR REPLACE FUNCTION public.launch_outpost_raid(
  p_player_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_player_id);
  v_user RECORD;
  v_today_str TEXT := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_fleet_power INTEGER;
  v_enemy_power INTEGER;
  v_iron NUMERIC;
  v_stolen_pgt NUMERIC;
  v_stolen_iron INTEGER;
  v_stolen_titanium INTEGER;
  v_new_balance NUMERIC;
  v_state JSONB;
BEGIN
  IF v_pid IS NULL OR v_pid = '' THEN 
    v_pid := LOWER(TRIM(p_player_id)); 
  END IF;

  SELECT * INTO v_user 
  FROM public.users 
  WHERE LOWER(player_id) = LOWER(v_pid) 
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account suspended');
  END IF;

  v_state := COALESCE(v_user.space_state, '{}'::jsonb);

  -- Enforce 1/day UTC cooldown
  IF (v_state->>'lastRaidDate') = v_today_str THEN
    RETURN jsonb_build_object('success', false, 'error', 'Outpost Raid already launched today (1/day limit)! Resets at midnight UTC.');
  END IF;

  -- Require 15 Iron fuel
  v_iron := COALESCE((v_state->>'iron')::numeric, 0);
  IF v_iron < 15 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Raid requires 15 Iron for Fuel!');
  END IF;

  v_fleet_power := COALESCE((v_state->>'fleetPower')::integer, 50);
  v_enemy_power := FLOOR(80 + RANDOM() * (v_fleet_power * 1.2));

  -- Deduct iron fuel and set raid date
  v_state := jsonb_set(v_state, '{lastRaidDate}', to_jsonb(v_today_str));
  v_state := jsonb_set(v_state, '{iron}', to_jsonb(v_iron - 15));

  IF v_fleet_power < v_enemy_power THEN
    -- Defeat: record updated state with cooldown and fuel consumed
    UPDATE public.users SET space_state = v_state, updated_at = NOW() WHERE player_id = v_user.player_id;
    RETURN jsonb_build_object(
      'success', true,
      'victory', false,
      'enemy_power', v_enemy_power,
      'fleet_power', v_fleet_power,
      'message', format('Raid Defeated! Enemy Outpost defense (%s Power) was too strong.', v_enemy_power),
      'space_state', v_state
    );
  END IF;

  -- Victory: calculate reward securely server-side (16 to 24 PGT)
  v_stolen_pgt := ROUND((16.0 + RANDOM() * 8.0)::numeric, 2);
  v_stolen_iron := FLOOR(25 + RANDOM() * 25);
  v_stolen_titanium := FLOOR(5 + RANDOM() * 5);

  v_state := jsonb_set(v_state, '{raidsWon}', to_jsonb(COALESCE((v_state->>'raidsWon')::integer, 0) + 1));
  v_state := jsonb_set(v_state, '{iron}', to_jsonb(COALESCE((v_state->>'iron')::numeric, 0) + v_stolen_iron));
  v_state := jsonb_set(v_state, '{titanium}', to_jsonb(COALESCE((v_state->>'titanium')::numeric, 0) + v_stolen_titanium));
  v_state := jsonb_set(v_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((v_state->>'mineralsMinedTotal')::numeric, 0) + v_stolen_iron + v_stolen_titanium));
  v_state := jsonb_set(v_state, '{pgtMinedTotal}', to_jsonb(ROUND(COALESCE((v_state->>'pgtMinedTotal')::numeric, 0) + v_stolen_pgt, 2)));

  UPDATE public.users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_stolen_pgt,
      total_earned = COALESCE(total_earned, 0) + v_stolen_pgt,
      space_state = v_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_referral_commissions') THEN
    BEGIN
      PERFORM process_referral_commissions(v_user.player_id, v_stolen_pgt, 'PolySpace Outpost Raid');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'victory', true,
    'enemy_power', v_enemy_power,
    'fleet_power', v_fleet_power,
    'stolen_pgt', v_stolen_pgt,
    'stolen_iron', v_stolen_iron,
    'stolen_titanium', v_stolen_titanium,
    'new_balance', v_new_balance,
    'space_state', v_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.launch_outpost_raid(TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- STEP 3: BAN AND ZERO-OUT ALL NOWER BOT/SYBIL ACCOUNTS & ILLICIT COMMISSIONS
-- ------------------------------------------------------------------------------

UPDATE public.users
SET is_banned = true,
    balance_pgt = 0.0,
    unclaimed_referral_pgt = 0.0,
    space_state = NULL,
    updated_at = NOW()
WHERE LOWER(player_id) IN (
  '0xpgtf542078cfef7',  -- Nower main exploiter account
  '0xpgt0b3393db3ee8',  -- Bot alt 1
  '0xpgt002a11071fa8',  -- Bot alt 2
  '0xpgt1695ffd2b03c',  -- Bot alt 3
  '0xpgt169c1562e10c',  -- Bot alt 4
  '0xpgttestestra1',    -- Nower linked test account
  '0xpgt31ab923c'       -- Nower's original banned referrer account holding 13,290.879 PGT commission
)
OR LOWER(COALESCE(linked_wallet_address, '')) IN (
  '0xf542078cfef76127c325e8e7833187fc5eda3279',
  '0x0b3393db3ee84ae9b93093642ef67073cd8d3fe8',
  '0x002a11071fa8d23f15e8c6b4d3dac0ffc36efc7b',
  '0x1695ffd2b03cabbc002cab4cfbf8c880ac7188fd',
  '0x169c1562e10ceae81ac5269763ef224a61b4b99c',
  '0x909e9a5c84bd638b5b4c292b7f7fde4ccbec2864'
);

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
