-- ==============================================================================
-- POLYGON GAMING MIGRATION: ATOMIC POLYSPACE EXPEDITION LAUNCH & STATE SYNC RPCS
-- ==============================================================================
-- Target: Supabase SQL Editor
-- Purpose:
-- 1. Create public.start_polyspace_expedition(p_player_id, p_destination, p_count)
--    Enables atomic server-side expedition launch with unforgeable server timestamps,
--    warp level validation, and slot clamping. Solves issue where missions started
--    in PolySpace were lost upon page refresh because anon direct UPDATE on users table
--    is revoked.
-- 2. Create public.save_polyspace_state(p_player_id, p_space_state)
--    Enables secure background synchronization of PolySpace fleet state from both
--    authenticated (Google) and anonymous (Web3 wallet / guest) sessions without
--    violating table RLS or anti-cheat triggers.
-- 3. Grants execute on both functions to authenticated, service_role, and anon.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RPC: start_polyspace_expedition
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.start_polyspace_expedition(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.start_polyspace_expedition(TEXT, TEXT);
DROP FUNCTION IF EXISTS start_polyspace_expedition(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS start_polyspace_expedition(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.start_polyspace_expedition(
  p_player_id TEXT,
  p_destination TEXT,
  p_count INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_space_state JSONB;
  v_expeditions JSONB := '[]'::jsonb;
  v_warp_level INTEGER := 1;
  v_max_slots INTEGER := 3;
  v_active_count INTEGER := 0;
  v_available_slots INTEGER := 0;
  v_launch_count INTEGER := 1;
  v_base_duration_ms BIGINT;
  v_duration_ms BIGINT;
  v_dest_name TEXT;
  v_start_ms BIGINT;
  v_end_ms BIGINT;
  v_new_exp JSONB;
  v_guard RECORD;
  i INTEGER;
BEGIN
  -- 1. Caller authentication & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- 2. Row Lock & Load User Profile
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found.');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended.');
  END IF;

  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_warp_level := GREATEST(1, COALESCE((v_space_state->>'warpLevel')::integer, 1));
  v_max_slots := LEAST(5, 3 + (v_warp_level / 10));

  -- 3. Validate Destination & Warp Level Requirements
  IF LOWER(p_destination) = 'asteroids' THEN
    v_dest_name := 'Alpha Asteroid Belt';
    v_base_duration_ms := 900000; -- 15 mins (15 * 60 * 1000)
  ELSIF LOWER(p_destination) = 'nebula' THEN
    IF v_warp_level < 2 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Neon Nebula requires Warp Drive Level 2!');
    END IF;
    v_dest_name := 'Neon Nebula';
    v_base_duration_ms := 7200000; -- 2 hours (2 * 3600 * 1000)
  ELSIF LOWER(p_destination) = 'void' THEN
    IF v_warp_level < 3 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Deep Void Exoplanet requires Warp Drive Level 3!');
    END IF;
    v_dest_name := 'Deep Void Exoplanet';
    v_base_duration_ms := 28800000; -- 8 hours (8 * 3600 * 1000)
  ELSIF LOWER(p_destination) = 'sector9' THEN
    IF v_warp_level < 4 THEN
      RETURN jsonb_build_object('success', false, 'error', 'Deep Space Sector 9 requires Warp Drive Level 4!');
    END IF;
    v_dest_name := 'Deep Space Sector 9';
    v_base_duration_ms := 86400000; -- 24 hours (24 * 3600 * 1000)
  ELSIF LOWER(p_destination) = 'deepspace' THEN
    IF v_warp_level < 5 THEN
      RETURN jsonb_build_object('success', false, 'error', '3-Day Deep-Space Expedition requires Warp Drive Level 5!');
    END IF;
    v_dest_name := '3-Day Deep-Space Expedition';
    v_base_duration_ms := 259200000; -- 72 hours (72 * 3600 * 1000)
  ELSIF LOWER(p_destination) = 'odyssey' THEN
    IF v_warp_level < 6 THEN
      RETURN jsonb_build_object('success', false, 'error', '7-Day Deep-Space Odyssey requires Warp Drive Level 6!');
    END IF;
    v_dest_name := '7-Day Deep-Space Odyssey';
    v_base_duration_ms := 604800000; -- 7 days (7 * 24 * 3600 * 1000)
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Unknown expedition destination: ' || COALESCE(p_destination, 'NULL'));
  END IF;

  -- 4. Slot Capacity Check
  IF v_space_state->'expeditions' IS NOT NULL AND jsonb_typeof(v_space_state->'expeditions') = 'array' THEN
    v_expeditions := v_space_state->'expeditions';
    v_active_count := jsonb_array_length(v_expeditions);
  ELSE
    v_expeditions := '[]'::jsonb;
    v_active_count := 0;
  END IF;

  v_available_slots := GREATEST(0, v_max_slots - v_active_count);
  IF v_available_slots <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'All ' || v_max_slots || ' Fleet Slots are currently in use! Wait for an expedition to finish.');
  END IF;

  -- Clamp requested launch count strictly between 1 and available slots
  v_launch_count := LEAST(GREATEST(1, COALESCE(p_count, 1)), v_available_slots);

  -- 5. Calculate Server Duration with Warp Drive Speed Boost Reduction (+5% speed per level)
  v_duration_ms := ROUND(v_base_duration_ms / (1.0 + ((v_warp_level - 1) * 0.05)))::BIGINT;
  v_start_ms := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
  v_end_ms := v_start_ms + v_duration_ms;

  -- 6. Generate and Append Expedition Objects
  FOR i IN 0..(v_launch_count - 1) LOOP
    v_new_exp := jsonb_build_object(
      'id', 'exp_' || (v_start_ms + i) || '_' || SUBSTRING(MD5(RANDOM()::TEXT || i::TEXT) FROM 1 FOR 5),
      'type', LOWER(p_destination),
      'name', v_dest_name || CASE WHEN v_launch_count > 1 THEN ' #' || (i + 1) ELSE '' END,
      'startTime', v_start_ms,
      'endTime', v_end_ms
    );
    v_expeditions := v_expeditions || jsonb_build_array(v_new_exp);
  END LOOP;

  -- 7. Persist to Database
  v_space_state := jsonb_set(v_space_state, '{expeditions}', v_expeditions);

  UPDATE public.users
  SET space_state = v_space_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'space_state', v_space_state,
    'launched_count', v_launch_count,
    'destination', v_dest_name,
    'duration_ms', v_duration_ms,
    'end_time', v_end_ms
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_polyspace_expedition(TEXT, TEXT, INTEGER) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- 2. RPC: save_polyspace_state
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.save_polyspace_state(TEXT, JSONB);
DROP FUNCTION IF EXISTS save_polyspace_state(TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.save_polyspace_state(
  p_player_id TEXT,
  p_space_state JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_current_state JSONB;
  v_merged_state JSONB;
  v_fleet_warp INTEGER;
  v_allowed_slots INTEGER;
  v_exp_arr JSONB;
  v_guard RECORD;
BEGIN
  -- 1. Caller authentication & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  IF p_space_state IS NULL OR jsonb_typeof(p_space_state) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid space_state object.');
  END IF;

  -- 2. Row Lock & Load User Profile
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found.');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended.');
  END IF;

  v_current_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_merged_state := v_current_state || p_space_state;

  -- Anti-tamper clamps: Module levels cannot increase without upgrade_polyspace_module RPC
  v_merged_state := jsonb_set(v_merged_state, '{warpLevel}', to_jsonb(COALESCE((v_current_state->>'warpLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{laserLevel}', to_jsonb(COALESCE((v_current_state->>'laserLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{cargoLevel}', to_jsonb(COALESCE((v_current_state->>'cargoLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{shieldLevel}', to_jsonb(COALESCE((v_current_state->>'shieldLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{turretLevel}', to_jsonb(COALESCE((v_current_state->>'turretLevel')::integer, 1)));

  -- Space Minerals cannot increase without server claims
  v_merged_state := jsonb_set(v_merged_state, '{iron}', to_jsonb(LEAST(COALESCE((v_merged_state->>'iron')::numeric, 0), COALESCE((v_current_state->>'iron')::numeric, 0))));
  v_merged_state := jsonb_set(v_merged_state, '{titanium}', to_jsonb(LEAST(COALESCE((v_merged_state->>'titanium')::numeric, 0), COALESCE((v_current_state->>'titanium')::numeric, 0))));
  v_merged_state := jsonb_set(v_merged_state, '{quantum}', to_jsonb(LEAST(COALESCE((v_merged_state->>'quantum')::numeric, 0), COALESCE((v_current_state->>'quantum')::numeric, 0))));
  v_merged_state := jsonb_set(v_merged_state, '{pgtOre}', to_jsonb(LEAST(COALESCE((v_merged_state->>'pgtOre')::numeric, 0), COALESCE((v_current_state->>'pgtOre')::numeric, 0))));

  -- Fleet Power recalculation
  v_merged_state := jsonb_set(
    v_merged_state,
    '{fleetPower}',
    to_jsonb(
      (GREATEST(1, COALESCE((v_merged_state->>'warpLevel')::integer, 1)) * 100) +
      (GREATEST(1, COALESCE((v_merged_state->>'laserLevel')::integer, 1)) * 80) +
      (GREATEST(1, COALESCE((v_merged_state->>'cargoLevel')::integer, 1)) * 50) +
      (GREATEST(1, COALESCE((v_merged_state->>'shieldLevel')::integer, 1)) * 60) +
      (GREATEST(1, COALESCE((v_merged_state->>'turretLevel')::integer, 1)) * 90)
    )
  );

  -- Clamp active expeditions array to valid max slots
  IF v_merged_state->'expeditions' IS NOT NULL AND jsonb_typeof(v_merged_state->'expeditions') = 'array' THEN
    v_fleet_warp := GREATEST(1, COALESCE((v_merged_state->>'warpLevel')::integer, 1));
    v_allowed_slots := LEAST(5, 3 + (v_fleet_warp / 10));
    IF jsonb_array_length(v_merged_state->'expeditions') > v_allowed_slots THEN
      SELECT jsonb_agg(elem) INTO v_exp_arr
      FROM (
        SELECT elem FROM jsonb_array_elements(v_merged_state->'expeditions') WITH ORDINALITY arr(elem, idx)
        WHERE idx <= v_allowed_slots
      ) sub;
      v_merged_state := jsonb_set(v_merged_state, '{expeditions}', COALESCE(v_exp_arr, '[]'::jsonb));
    END IF;
  END IF;

  UPDATE public.users
  SET space_state = v_merged_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object('success', true, 'space_state', v_merged_state);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_polyspace_state(TEXT, JSONB) TO authenticated, service_role, anon;
