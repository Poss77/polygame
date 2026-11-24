-- 6. POLYSPACE FLEET OPERATIONS (MINING, MODULES & OUTPOSTS)
-- ==============================================================================

-- ------------------------------------------------------------------------------

-- HELPER: get_starship_rarity

-- Calculates deterministic Starship Rarity tier from 6-digit DNA

-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_starship_rarity(p_dna bigint)

RETURNS text

LANGUAGE plpgsql

IMMUTABLE
AS $$

DECLARE

  v_dna bigint := COALESCE(p_dna, 482915);

  v_chassis integer[]  := ARRAY[10, 10, 14, 14, 18];

  v_wings integer[]    := ARRAY[10, 10, 14, 14, 18];

  v_pal integer[]      := ARRAY[10, 14, 18, 14, 10];

  v_canopy integer[]   := ARRAY[14, 10, 10, 18];

  v_thruster integer[] := ARRAY[10, 10, 14, 18];

  v_decal integer[]    := ARRAY[10, 18, 14, 10];

  v_c integer;

  v_w integer;

  v_p integer;

  v_cn integer;

  v_th integer;

  v_dc integer;

  v_pts integer;

  v_s text;

  v_has_triple boolean;

  v_is_pal boolean;

  v_leg_cnt integer;

  v_score integer;

BEGIN

  v_c  := v_chassis[(v_dna % 5) + 1];

  v_w  := v_wings[((v_dna / 10) % 5) + 1];

  v_p  := v_pal[((v_dna / 100) % 5) + 1];

  v_cn := v_canopy[((v_dna / 1000) % 4) + 1];

  v_th := v_thruster[((v_dna / 10000) % 4) + 1];

  v_dc := v_decal[((v_dna / 100000) % 4) + 1];



  v_pts := v_c + v_w + v_p + v_cn + v_th + v_dc;

  v_s := v_dna::text;



  v_has_triple := (

    (SUBSTRING(v_s, 1, 1) = SUBSTRING(v_s, 2, 1) AND SUBSTRING(v_s, 2, 1) = SUBSTRING(v_s, 3, 1)) OR

    (SUBSTRING(v_s, 2, 1) = SUBSTRING(v_s, 3, 1) AND SUBSTRING(v_s, 3, 1) = SUBSTRING(v_s, 4, 1)) OR

    (SUBSTRING(v_s, 3, 1) = SUBSTRING(v_s, 4, 1) AND SUBSTRING(v_s, 4, 1) = SUBSTRING(v_s, 5, 1)) OR

    (SUBSTRING(v_s, 4, 1) = SUBSTRING(v_s, 5, 1) AND SUBSTRING(v_s, 5, 1) = SUBSTRING(v_s, 6, 1))

  );

  v_is_pal := (v_s = REVERSE(v_s));



  v_leg_cnt := (CASE WHEN v_c=18 THEN 1 ELSE 0 END +

                CASE WHEN v_w=18 THEN 1 ELSE 0 END +

                CASE WHEN v_p=18 THEN 1 ELSE 0 END +

                CASE WHEN v_cn=18 THEN 1 ELSE 0 END +

                CASE WHEN v_th=18 THEN 1 ELSE 0 END +

                CASE WHEN v_dc=18 THEN 1 ELSE 0 END);



  IF v_has_triple THEN v_pts := v_pts + 6; END IF;

  IF v_is_pal THEN v_pts := v_pts + 8; END IF;



  v_score := GREATEST(50, LEAST(100, ROUND(50.0 + ((v_pts - 60)::numeric / 48.0) * 50.0)::integer));



  IF v_score >= 90 OR (v_leg_cnt = 3 AND (v_has_triple OR v_is_pal)) THEN

    RETURN 'Mythic';

  ELSIF v_score >= 82 OR v_leg_cnt >= 3 THEN

    RETURN 'Legendary';

  ELSIF v_score >= 72 OR v_leg_cnt >= 2 THEN

    RETURN 'Epic';

  ELSE

    RETURN 'Rare';

  END IF;

END;
$$;

GRANT EXECUTE ON FUNCTION public.get_starship_rarity(bigint) TO authenticated, service_role, anon;



-- ------------------------------------------------------------------------------
-- RPC: claim_polyspace_expedition
-- Source: atomic_polyspace_expedition_claim.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_polyspace_expedition(TEXT);
DROP FUNCTION IF EXISTS public.claim_polyspace_expedition(TEXT, TEXT);
DROP FUNCTION IF EXISTS claim_polyspace_expedition(TEXT);
DROP FUNCTION IF EXISTS claim_polyspace_expedition(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.claim_polyspace_expedition(
  p_player_id TEXT,
  p_expedition_id TEXT DEFAULT 'ALL'
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
  v_expeditions JSONB;
  v_remaining_expeditions JSONB := '[]'::jsonb;
  v_claimed_count INTEGER := 0;
  v_prev_missions INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
  v_now_ms BIGINT;
  v_target_all BOOLEAN := false;
  v_exp JSONB;
  v_exp_id TEXT;
  v_exp_type TEXT;
  v_exp_name TEXT;
  v_exp_start BIGINT;
  v_exp_end BIGINT;
  
  -- Upgrades & Multipliers
  v_cargo_level INTEGER := 1;
  v_laser_level INTEGER := 1;
  v_warp_level INTEGER := 1;
  v_cargo_mult NUMERIC := 1.0;
  v_laser_mult NUMERIC := 1.0;
  v_warp_speed_mult NUMERIC := 1.0;
  v_base_flight_ms BIGINT := 900000;
  v_min_allowed_duration BIGINT := 120000;
  v_equipped_ship JSONB := NULL;
  v_ship_rarity TEXT := NULL;
  v_starship_mult NUMERIC := 1.0;
  v_s2_relic_mult NUMERIC := 1.0;
  v_variance NUMERIC;
  v_is_critical BOOLEAN := false;
  
  -- Single Expedition Rewards
  v_base_iron NUMERIC := 0;
  v_base_tit NUMERIC := 0;
  v_base_quant NUMERIC := 0;
  v_base_pgt NUMERIC := 0.5;
  v_item_iron NUMERIC := 0;
  v_item_tit NUMERIC := 0;
  v_item_quant NUMERIC := 0;
  v_item_pgt NUMERIC := 0;
  v_item_pgt_ore INTEGER := 0;
  v_pgt_ore_chance NUMERIC := 0.0;
  
  -- Aggregate Transaction Totals
  v_tot_iron NUMERIC := 0;
  v_tot_tit NUMERIC := 0;
  v_tot_quant NUMERIC := 0;
  v_tot_pgt_ore INTEGER := 0;
  v_tot_pgt NUMERIC := 0;
  v_final_pgt NUMERIC := 0;
  v_new_balance NUMERIC := 0;
  
  -- Relic Drops
  v_relic_chance NUMERIC := 0.0;
  v_discovered_relic JSONB := NULL;
  v_relic_rand NUMERIC;
  v_relic_id TEXT;
  
  -- Mission Logs
  v_logs JSONB;
  v_new_log JSONB;
  v_last_exp_name TEXT := 'PolySpace Fleet';
  v_last_was_critical BOOLEAN := false;
  v_guard RECORD;

  -- Cadence & Robotic Timing Guard
  v_turnstile_enabled BOOLEAN := true;
  v_ready_target_count INTEGER := 0;
  v_last_claim_ms BIGINT := 0;
  v_delta_ms BIGINT := 0;
  v_recent_intervals JSONB := '[]'::jsonb;
  v_new_intervals JSONB := '[]'::jsonb;
  v_check_window NUMERIC[];
  v_min_gap NUMERIC;
  v_max_gap NUMERIC;
  v_cadence_reason TEXT := NULL;
  v_cadence_suspicious BOOLEAN := false;
  v_midnight_utc TIMESTAMPTZ;
  v_unverified_attempts INTEGER := 0;
  v_unverified_today INTEGER := 0;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- Convert server NOW() to millisecond epoch
  v_now_ms := (EXTRACT(EPOCH FROM v_now) * 1000)::bigint;

  -- 2. Pessimistic Row Lock (Serializes concurrent requests across multiple browser windows)
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found in database');
  END IF;

  -- 3. Security Checks
  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended');
  END IF;

  -- 4. Inspect space_state
  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_expeditions := COALESCE(v_space_state->'expeditions', '[]'::jsonb);
  v_prev_missions := GREATEST(
    COALESCE((v_space_state->>'missionsCompleted')::integer, 0),
    jsonb_array_length(COALESCE(v_space_state->'missionLogs', '[]'::jsonb))
  );

  IF jsonb_array_length(v_expeditions) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active expeditions found');
  END IF;

  v_target_all := (p_expedition_id IS NULL OR UPPER(TRIM(p_expedition_id)) = 'ALL' OR TRIM(p_expedition_id) = '');

  -- 4b. Pre-Flight Check: Count eligible finished expeditions before cadence/Turnstile gate
  SELECT COUNT(*)
  INTO v_ready_target_count
  FROM jsonb_array_elements(v_expeditions) AS elem
  WHERE (v_target_all OR elem->>'id' = p_expedition_id)
    AND v_now_ms >= COALESCE((elem->>'endTime')::bigint, 0);

  IF v_ready_target_count = 0 THEN
    -- Return accurate feedback if caller targeted a specific still-in-progress expedition
    IF NOT v_target_all THEN
      SELECT COALESCE((elem->>'endTime')::bigint, 0) INTO v_exp_end
      FROM jsonb_array_elements(v_expeditions) AS elem
      WHERE elem->>'id' = p_expedition_id
      LIMIT 1;
      IF FOUND AND v_exp_end > v_now_ms THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Expedition is still in progress',
          'remaining_seconds', GREATEST(0, (v_exp_end - v_now_ms) / 1000)
        );
      END IF;
    END IF;
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No completed expeditions ready to claim or expedition not found'
    );
  END IF;

  -- 4c. Cadence Detector (Anti-Clicker / Macro Shield)
  -- Triggers warning message + (+1 bot_warning) ONLY after 5 consecutive mission cycles with robotic ("perfect") timing.
  SELECT COALESCE(turnstile_arcade_enabled, true)
  INTO v_turnstile_enabled
  FROM public.global_settings
  WHERE id = 1
  LIMIT 1;
  v_turnstile_enabled := COALESCE(v_turnstile_enabled, true);

  v_last_claim_ms := COALESCE((v_space_state->>'lastClaimTimestampMs')::bigint, 0);
  v_recent_intervals := CASE
    WHEN v_space_state->'recentClaimIntervals' IS NOT NULL AND jsonb_typeof(v_space_state->'recentClaimIntervals') = 'array'
    THEN v_space_state->'recentClaimIntervals'
    ELSE '[]'::jsonb
  END;

  -- Reset cadence window if user passed Turnstile after their previous claim OR took a >4h break
  IF (v_user.last_turnstile_at IS NOT NULL AND (v_last_claim_ms = 0 OR (EXTRACT(EPOCH FROM v_user.last_turnstile_at) * 1000)::bigint >= v_last_claim_ms))
     OR (v_last_claim_ms > 0 AND (v_now_ms - v_last_claim_ms) > 14400000) THEN
    v_recent_intervals := '[]'::jsonb;
  END IF;

  -- Measure active inter-claim cadence (between 2 minutes and 40 minutes)
  IF v_last_claim_ms > 0 THEN
    v_delta_ms := v_now_ms - v_last_claim_ms;
  END IF;

  -- Detector A: 5 consecutive multi-minute claim cycles within <= 1.0s spread (fixed-timer clicker)
  IF v_delta_ms BETWEEN 120000 AND 2400000 THEN
    IF jsonb_array_length(v_recent_intervals) >= 4 THEN
      SELECT ARRAY[v_delta_ms::numeric] || ARRAY(
        SELECT (val::text)::numeric
        FROM jsonb_array_elements(v_recent_intervals) WITH ORDINALITY t(val, idx)
        WHERE idx <= 4
      ) INTO v_check_window;

      SELECT MIN(x), MAX(x) INTO v_min_gap, v_max_gap FROM UNNEST(v_check_window) AS x;
      IF v_min_gap IS NOT NULL AND (v_max_gap - v_min_gap) <= 1000 THEN
        v_cadence_suspicious := true;
        v_cadence_reason := 'polyspace_perfect_timing_macro';
      END IF;
    END IF;
  END IF;

  IF v_cadence_suspicious AND NOT COALESCE(v_user.is_admin, false) THEN
    v_midnight_utc := DATE_TRUNC('day', v_now AT TIME ZONE 'UTC');
    IF v_user.turnstile_unverified_reset_at IS NULL OR v_user.turnstile_unverified_reset_at < v_midnight_utc THEN
      v_unverified_today := 0;
    ELSE
      v_unverified_today := COALESCE(v_user.turnstile_unverified_today, 0);
    END IF;

    IF v_user.last_unverified_attempt_at IS NULL OR v_user.last_unverified_attempt_at < (v_now - INTERVAL '10 minutes') THEN
      v_unverified_attempts := 0;
    ELSIF v_user.last_unverified_attempt_at > (v_now - INTERVAL '5 seconds') THEN
      v_unverified_attempts := COALESCE(v_user.turnstile_unverified_attempts, 0);
    ELSE
      v_unverified_attempts := COALESCE(v_user.turnstile_unverified_attempts, 0) + 1;
      v_unverified_today := v_unverified_today + 1;
    END IF;

    UPDATE public.users
    SET turnstile_unverified_attempts = v_unverified_attempts,
        turnstile_unverified_today = v_unverified_today,
        turnstile_unverified_reset_at = v_now,
        last_unverified_attempt_at = v_now,
        updated_at = v_now
    WHERE player_id = v_user.player_id;

    -- Issue +1 bot_warning and send Fair-Play warning message immediately after 5 missions with perfect timing
    IF v_unverified_attempts = 0 OR v_unverified_attempts >= 3 THEN
      PERFORM public.record_bot_warning(
        v_user.player_id,
        COALESCE(v_cadence_reason, 'polyspace_perfect_timing_macro'),
        'PolySpace Fleet',
        jsonb_build_object(
          'spread_ms', COALESCE(v_max_gap - v_min_gap, 0),
          'window_ms', v_check_window,
          'consecutive_cycles', 5,
          'unverified_attempts', v_unverified_attempts
        )
      );
    END IF;

    IF v_unverified_attempts >= 10 OR v_unverified_today >= 15 THEN
      UPDATE public.users
      SET is_banned = true,
          updated_at = v_now
      WHERE player_id = v_user.player_id;

      PERFORM public.record_bot_warning(
        v_user.player_id,
        'polyspace_macro_autoban',
        'PolySpace Fleet',
        jsonb_build_object(
          'consecutive_attempts', v_unverified_attempts,
          'daily_unverified', v_unverified_today,
          'action', 'auto_ban'
        )
      );

      RETURN jsonb_build_object(
        'success', false,
        'is_banned', true,
        'error', 'Account suspended due to automated PolySpace claim spam without human verification.'
      );
    END IF;

    IF v_turnstile_enabled THEN
      RETURN jsonb_build_object(
        'success', false,
        'turnstile_required', true,
        'cadence_flagged', true,
        'bot_warning', true,
        'unverified_attempts', v_unverified_attempts,
        'error', 'Automated timing pattern detected across 5 missions (+1 Fair-Play Warning). Complete human verification to continue.'
      );
    END IF;
    -- Fallback if Turnstile is disabled globally: reset cadence history after recording warning so claim can finish once
    v_recent_intervals := '[]'::jsonb;
  END IF;

  -- Extract Ship Upgrades
  v_cargo_level := GREATEST(1, COALESCE((v_space_state->>'cargoLevel')::integer, 1));
  v_laser_level := GREATEST(1, COALESCE((v_space_state->>'laserLevel')::integer, 1));
  v_warp_level  := GREATEST(1, COALESCE((v_space_state->>'warpLevel')::integer, 1));

  v_cargo_mult := 1.0 + ((v_cargo_level - 1) * 0.25);
  IF v_laser_level <= 20 THEN
    v_laser_mult := 1.0 + ((v_laser_level - 1) * 0.18);
  ELSE
    v_laser_mult := 4.42 + ((v_laser_level - 20) * 0.25);
  END IF;
  v_warp_speed_mult := 1.0 + ((v_warp_level - 1) * 0.05);

  -- Extract On-Chain Equipped Starship & Rarity Multiplier

  -- User Rule: PolySpace PGT mining yield matches Starship base rarity multipliers (Rare 1.10x, Epic 1.20x, Legendary 1.30x, Mythic 1.50x; no Tier 3+ module boost)

  v_equipped_ship := COALESCE(v_user.equipped_starship, v_space_state->'equippedStarship');

  v_starship_mult := 1.0;

  IF v_equipped_ship IS NOT NULL AND jsonb_typeof(v_equipped_ship) = 'object' AND v_equipped_ship <> '{}'::jsonb THEN

    -- Anti-Cheat: Validate that the equipped ship is a valid on-chain NFT (positive tokenId, non-demo)

    IF COALESCE((v_equipped_ship->>'tokenId')::bigint, 0) > 0 AND

       COALESCE((v_equipped_ship->>'isDemo')::boolean, false) = false AND

       LOWER(COALESCE(v_equipped_ship->>'name', '')) NOT LIKE '%demo%' THEN



      -- 1. Check explicit rarity attribute if already present (string or nested object)

      IF v_equipped_ship ? 'rarity' THEN

        IF jsonb_typeof(v_equipped_ship->'rarity') = 'object' THEN

          v_ship_rarity := LOWER(COALESCE(v_equipped_ship->'rarity'->>'tier', ''));

        ELSE

          v_ship_rarity := LOWER(COALESCE(v_equipped_ship->>'rarity', ''));

        END IF;

      END IF;



      -- 2. Fallback: authoritatively decode 6-digit DNA to determine rarity tier

      IF (v_ship_rarity IS NULL OR v_ship_rarity = '') AND (v_equipped_ship ? 'dna') THEN

        IF (v_equipped_ship->>'dna') ~ '^[0-9]+$' THEN

          v_ship_rarity := LOWER(public.get_starship_rarity((v_equipped_ship->>'dna')::bigint));

        END IF;

      END IF;



      IF v_ship_rarity = 'mythic' THEN

        v_starship_mult := 1.50;

      ELSIF v_ship_rarity = 'legendary' THEN

        v_starship_mult := 1.30;

      ELSIF v_ship_rarity = 'epic' THEN

        v_starship_mult := 1.20;

      ELSE

        v_starship_mult := 1.10;

      END IF;

    END IF;

  END IF;

  -- 5. Iterate & Process Eligible Expeditions
  FOR v_exp IN SELECT * FROM jsonb_array_elements(v_expeditions)
  LOOP
    v_exp_id   := v_exp->>'id';
    v_exp_type := LOWER(COALESCE(v_exp->>'type', 'asteroids'));
    v_exp_name := COALESCE(v_exp->>'name', 'Exploration Fleet');
    v_exp_end  := COALESCE((v_exp->>'endTime')::bigint, 0);

    -- Check if target matches
    IF (v_target_all OR v_exp_id = p_expedition_id) THEN
      v_exp_start := COALESCE((v_exp->>'startTime')::bigint, 0);

      -- Anti-Cheat: Validate Warp Drive level requirement for destination
      IF (v_exp_type = 'nebula' AND v_warp_level < 2) OR
         (v_exp_type = 'void' AND v_warp_level < 3) OR
         (v_exp_type = 'sector9' AND v_warp_level < 4) OR
         (v_exp_type = 'deepspace' AND v_warp_level < 5) OR
         (v_exp_type = 'odyssey' AND v_warp_level < 6) THEN
        -- Destination requires higher warp level than player has; discard illegitimate mission
        CONTINUE;
      END IF;

      -- Check if expedition is finished
      IF v_now_ms >= v_exp_end THEN
        -- Anti-Cheat: Validate minimum elapsed flight duration against forged timestamps (accounting for warp speed & stacked boosts)
        v_base_flight_ms := CASE
          WHEN v_exp_type = 'asteroids' THEN 900000       -- 15 mins base
          WHEN v_exp_type = 'nebula'    THEN 7200000      -- 2 hours base
          WHEN v_exp_type = 'void'      THEN 28800000     -- 8 hours base
          WHEN v_exp_type = 'sector9'   THEN 86400000     -- 24 hours base
          WHEN v_exp_type = 'deepspace' THEN 259200000    -- 72 hours base
          WHEN v_exp_type = 'odyssey'   THEN 604800000    -- 168 hours base
          ELSE 900000
        END;

        -- Dynamically compute minimum legitimate elapsed flight time
        -- Accounts for player's Warp Drive level + Hyperdrive boost + Anomaly Temporal Wormholes (down to ~30% of base warp duration)
        v_min_allowed_duration := GREATEST(60000, ((v_base_flight_ms::NUMERIC / GREATEST(1.0, v_warp_speed_mult)) * 0.30)::BIGINT);

        IF v_exp_start > 0 AND (v_now_ms - v_exp_start) < v_min_allowed_duration THEN
          -- Timestamp was backdated or forged; keep unfinished
          v_remaining_expeditions := v_remaining_expeditions || jsonb_build_array(v_exp);
          CONTINUE;
        END IF;

        -- Anti-Cheat: Validate start time does not precede account registration (with 1h clock skew allowance)
        IF v_exp_start > 0 AND v_exp_start < ((EXTRACT(EPOCH FROM v_user.created_at) * 1000) - 3600000) THEN
          INSERT INTO public.bot_security_logs (player_id, reason, game_name, details, created_at)
          VALUES (v_pid, 'invalid_backdated_expedition', 'PolySpace Fleet Sentinel', jsonb_build_object('exp_id', v_exp_id, 'startTime', v_exp_start, 'created_at', v_user.created_at), NOW());
          CONTINUE;
        END IF;

        -- Anti-Cheat: Cap maximum concurrent claims to user's fleet slot capacity (3 to 5)
        IF v_claimed_count >= LEAST(5, 3 + (v_warp_level / 10)) THEN
          CONTINUE;
        END IF;

        v_claimed_count := v_claimed_count + 1;
        v_last_exp_name := v_exp_name;

        -- Base Yields by Destination
        IF v_exp_type = 'asteroids' THEN
          v_base_iron := 40 * v_cargo_mult;
          v_base_tit := 0;
          v_base_quant := 0;
          v_base_pgt := 0.5;
          v_relic_chance := 0.008;
          v_pgt_ore_chance := 0.02;
        ELSIF v_exp_type = 'nebula' THEN
          v_base_iron := 110 * v_cargo_mult;
          v_base_tit := 35 * v_cargo_mult;
          v_base_quant := 0;
          v_base_pgt := 1.7;
          v_relic_chance := 0.016;
          v_pgt_ore_chance := 0.05;
        ELSIF v_exp_type = 'void' THEN
          v_base_iron := 240 * v_cargo_mult;
          v_base_tit := 80 * v_cargo_mult;
          v_base_quant := 20 * v_cargo_mult;
          v_base_pgt := 3.8;
          v_relic_chance := 0.024;
          v_pgt_ore_chance := 0.10;
        ELSIF v_exp_type = 'sector9' THEN
          v_base_iron := 550 * v_cargo_mult;
          v_base_tit := 180 * v_cargo_mult;
          v_base_quant := 45 * v_cargo_mult;
          v_base_pgt := 7.2;
          v_relic_chance := 0.036;
          v_pgt_ore_chance := 0.18;
        ELSIF v_exp_type = 'deepspace' THEN
          v_base_iron := 1100 * v_cargo_mult;
          v_base_tit := 380 * v_cargo_mult;
          v_base_quant := 100 * v_cargo_mult;
          v_base_pgt := 17.125;
          v_relic_chance := 0.056;
          v_pgt_ore_chance := 0.30;
        ELSIF v_exp_type = 'odyssey' THEN
          v_base_iron := 2200 * v_cargo_mult;
          v_base_tit := 850 * v_cargo_mult;
          v_base_quant := 250 * v_cargo_mult;
          v_base_pgt := 30.625;
          v_relic_chance := 0.080;
          v_pgt_ore_chance := 0.50;
        ELSE
          v_base_iron := 40 * v_cargo_mult;
          v_base_tit := 0;
          v_base_quant := 0;
          v_base_pgt := 0.5;
          v_relic_chance := 0.008;
          v_pgt_ore_chance := 0.02;
        END IF;

        -- Apply Laser Multiplier, Starship Rarity Multiplier, and ±20% Exploration Variance (0.80 to 1.20)
        v_variance := 0.80 + (random() * 0.40);
        v_item_pgt := ROUND((v_base_pgt * v_laser_mult * v_starship_mult * v_variance)::numeric, 2);
        v_item_iron := FLOOR(v_base_iron);
        v_item_tit := FLOOR(v_base_tit);
        v_item_quant := FLOOR(v_base_quant);
        v_item_pgt_ore := 0;

        -- 10% Critical Success Roll (3x Mega Payout)
        v_is_critical := (random() < 0.10);
        IF v_is_critical THEN
          v_item_iron := v_item_iron * 3;
          v_item_tit := v_item_tit * 3;
          v_item_quant := v_item_quant * 3;
          v_item_pgt := ROUND((v_item_pgt * 3.0)::numeric, 2);
          v_relic_chance := LEAST(1.0, v_relic_chance * 1.5);
          v_last_was_critical := true;
        END IF;

        -- Season 2 Apex Relic Set Multiplier (1.5x Ore + PGT on PolySpace Missions)
        v_s2_relic_mult := CASE WHEN public.is_season2_apex_unlocked(v_user.relics) THEN 1.50 ELSE 1.00 END;
        IF v_s2_relic_mult > 1.0 THEN
          v_item_iron := FLOOR(v_item_iron * v_s2_relic_mult);
          v_item_tit := FLOOR(v_item_tit * v_s2_relic_mult);
          v_item_quant := FLOOR(v_item_quant * v_s2_relic_mult);
          v_item_pgt := ROUND((v_item_pgt * v_s2_relic_mult)::numeric, 2);
        END IF;

        -- Rare PGT Ore Roll (Requires Laser Level >= 35)
        IF v_laser_level >= 35 AND random() < v_pgt_ore_chance THEN
          v_item_pgt_ore := 1;
          IF (v_exp_type = 'deepspace' AND random() < 0.15) OR (v_exp_type = 'odyssey' AND random() < 0.30) THEN
            v_item_pgt_ore := 2;
          END IF;
          IF v_is_critical THEN
            v_item_pgt_ore := v_item_pgt_ore + 1;
          END IF;
        END IF;

        -- In-Game Quantum Relic Drop Roll
        IF random() < v_relic_chance THEN
          v_relic_rand := random();
          IF (v_exp_type IN ('odyssey', 'deepspace')) AND v_relic_rand < 0.10 THEN
            v_relic_id := CASE WHEN random() < 0.5 THEN 'relic_apex_singularity' ELSE 'relic_apex_genesis' END;
          ELSIF v_relic_rand < 0.20 THEN
            v_relic_id := 'relic_space_plasma';
          ELSIF v_relic_rand < 0.55 THEN
            v_relic_id := 'relic_space_warpcoil';
          ELSE
            v_relic_id := 'relic_space_darkmatter';
          END IF;

          -- Grant In-Game Relic via canonical procedure
          IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_relic_drop') THEN
            BEGIN
              PERFORM public.grant_relic_drop(v_user.player_id, v_relic_id, 1);
              v_discovered_relic := jsonb_build_object('id', v_relic_id, 'amount', 1);
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          END IF;
        END IF;

        -- Accumulate Totals
        v_tot_iron := v_tot_iron + v_item_iron;
        v_tot_tit := v_tot_tit + v_item_tit;
        v_tot_quant := v_tot_quant + v_item_quant;
        v_tot_pgt_ore := v_tot_pgt_ore + v_item_pgt_ore;
        v_tot_pgt := v_tot_pgt + v_item_pgt;

        -- Create Mission Log Entry
        v_new_log := jsonb_build_object(
          'id', 'log_' || (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint || '_' || FLOOR(random() * 1000)::text,
          'name', v_exp_name,
          'time', to_char(v_now AT TIME ZONE 'UTC', 'HH24:MI UTC'),
          'timestamp', v_now_ms,
          'earnedIron', v_item_iron,
          'earnedTit', v_item_tit,
          'earnedQuant', v_item_quant,
          'earnedPgtOre', v_item_pgt_ore,
          'earnedPgt', v_item_pgt,
          'isCritical', v_is_critical,
          'starshipMult', v_starship_mult,
          'starshipRarity', NULLIF(v_ship_rarity, ''),
          's2RelicMult', v_s2_relic_mult
        );

        v_logs := COALESCE(v_space_state->'missionLogs', '[]'::jsonb);
        v_logs := jsonb_build_array(v_new_log) || v_logs;
        -- Keep last 20 logs
        IF jsonb_array_length(v_logs) > 20 THEN
          SELECT jsonb_agg(elem) INTO v_logs
          FROM (SELECT elem FROM jsonb_array_elements(v_logs) WITH ORDINALITY arr(elem, idx) WHERE idx <= 20) sub;
        END IF;
        v_space_state := jsonb_set(v_space_state, '{missionLogs}', v_logs);

      ELSE
        -- Single target was found but has not finished yet
        IF NOT v_target_all THEN
          RETURN jsonb_build_object(
            'success', false,
            'error', 'Expedition is still in progress',
            'remaining_seconds', GREATEST(0, (v_exp_end - v_now_ms) / 1000)
          );
        END IF;
        -- Keep unfinished expedition
        v_remaining_expeditions := v_remaining_expeditions || jsonb_build_array(v_exp);
      END IF;
    ELSE
      -- Keep non-matching expedition
      v_remaining_expeditions := v_remaining_expeditions || jsonb_build_array(v_exp);
    END IF;
  END LOOP;

  -- 6. Guard: Check if anything was claimed
  IF v_claimed_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No completed expeditions ready to claim or expedition not found'
    );
  END IF;

  -- 7. High-Laser Multiplier Safety Cap: Generous 3,500 PGT ceiling per transaction
  v_final_pgt := ROUND(LEAST(3500.0, GREATEST(0.0, v_tot_pgt))::numeric, 2);

  -- 8. Mutate Space State
  v_space_state := jsonb_set(v_space_state, '{expeditions}', v_remaining_expeditions);
  v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(COALESCE((v_space_state->>'iron')::numeric, 0) + v_tot_iron));
  v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(COALESCE((v_space_state->>'titanium')::numeric, 0) + v_tot_tit));
  v_space_state := jsonb_set(v_space_state, '{quantum}', to_jsonb(COALESCE((v_space_state->>'quantum')::numeric, 0) + v_tot_quant));
  v_space_state := jsonb_set(v_space_state, '{pgtOre}', to_jsonb(COALESCE((v_space_state->>'pgtOre')::integer, 0) + v_tot_pgt_ore));
  v_space_state := jsonb_set(v_space_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((v_space_state->>'mineralsMinedTotal')::numeric, 0) + v_tot_iron + v_tot_tit + v_tot_quant + v_tot_pgt_ore));
  v_space_state := jsonb_set(v_space_state, '{pgtMinedTotal}', to_jsonb(ROUND((COALESCE((v_space_state->>'pgtMinedTotal')::numeric, 0) + v_final_pgt)::numeric, 2)));
  v_space_state := jsonb_set(v_space_state, '{missionsCompleted}', to_jsonb(v_prev_missions + v_claimed_count));

  -- Update server-controlled cadence tracking metadata
  v_space_state := jsonb_set(v_space_state, '{lastClaimTimestampMs}', to_jsonb(v_now_ms));
  IF v_delta_ms BETWEEN 120000 AND 2400000 THEN
    v_new_intervals := jsonb_build_array(v_delta_ms) || v_recent_intervals;
    IF jsonb_array_length(v_new_intervals) > 6 THEN
      SELECT jsonb_agg(elem) INTO v_new_intervals
      FROM (SELECT elem FROM jsonb_array_elements(v_new_intervals) WITH ORDINALITY arr(elem, idx) WHERE idx <= 6) sub;
    END IF;
    v_space_state := jsonb_set(v_space_state, '{recentClaimIntervals}', COALESCE(v_new_intervals, '[]'::jsonb));
  ELSE
    v_space_state := jsonb_set(v_space_state, '{recentClaimIntervals}', COALESCE(v_recent_intervals, '[]'::jsonb));
  END IF;
  v_space_state := v_space_state - 'recentClaimLags';

  -- 9. Atomic Balance Mutation on Users Table
  UPDATE public.users
  SET balance_pgt = ROUND(COALESCE(balance_pgt, 0) + v_final_pgt, 2),
      total_earned = ROUND(COALESCE(total_earned, 0) + v_final_pgt, 2),
      space_state = v_space_state,
      updated_at = v_now
  WHERE player_id = v_user.player_id
  RETURNING balance_pgt INTO v_new_balance;

  -- 10. Process 4-Tier Referral Commissions
  IF v_final_pgt > 0 THEN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_referral_commissions') THEN
      BEGIN
        PERFORM public.process_referral_commissions(
          v_user.player_id,
          v_final_pgt,
          'PolySpace Fleet (' || v_claimed_count || ' Expedition' || (CASE WHEN v_claimed_count > 1 THEN 's' ELSE '' END) || ')'
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;

  -- 11. Return Authoritative Response
  RETURN jsonb_build_object(
    'success', true,
    'claimed_count', v_claimed_count,
    'earned_iron', v_tot_iron,
    'earned_tit', v_tot_tit,
    'earned_quant', v_tot_quant,
    'earned_pgt_ore', v_tot_pgt_ore,
    'earned_pgt', v_final_pgt,
    'starship_mult', v_starship_mult,
    'is_critical', v_last_was_critical,
    'discovered_relic', v_discovered_relic,
    'exp_name', v_last_exp_name,
    'new_balance', v_new_balance,
    'new_space_state', v_space_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_polyspace_expedition(TEXT, TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: cancel_polyspace_expeditions
-- Source: add_cancel_polyspace_expeditions_rpc.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.cancel_polyspace_expeditions(TEXT, TEXT);
DROP FUNCTION IF EXISTS cancel_polyspace_expeditions(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.cancel_polyspace_expeditions(
  p_player_id TEXT,
  p_expedition_id TEXT DEFAULT 'ALL'
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
  v_expeditions JSONB;
  v_remaining_expeditions JSONB := '[]'::jsonb;
  v_cancelled_count INTEGER := 0;
  v_target_all BOOLEAN := false;
  v_exp JSONB;
  v_exp_id TEXT;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- 2. Pessimistic Row Lock (Prevents race conditions with active claims)
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player not found');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account suspended');
  END IF;

  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_expeditions := COALESCE(v_space_state->'expeditions', '[]'::jsonb);

  IF jsonb_array_length(v_expeditions) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active expeditions to cancel');
  END IF;

  v_target_all := (p_expedition_id IS NULL OR UPPER(TRIM(p_expedition_id)) = 'ALL' OR TRIM(p_expedition_id) = '');

  IF v_target_all THEN
    v_cancelled_count := jsonb_array_length(v_expeditions);
    v_remaining_expeditions := '[]'::jsonb;
  ELSE
    FOR v_exp IN SELECT * FROM jsonb_array_elements(v_expeditions)
    LOOP
      v_exp_id := v_exp->>'id';
      IF v_exp_id = p_expedition_id THEN
        v_cancelled_count := v_cancelled_count + 1;
      ELSE
        v_remaining_expeditions := v_remaining_expeditions || jsonb_build_array(v_exp);
      END IF;
    END LOOP;
  END IF;

  IF v_cancelled_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Expedition not found or already ended');
  END IF;

  -- Update space_state: clears/filters expeditions, strictly leaves balances, minerals, and modules unchanged
  v_space_state := jsonb_set(v_space_state, '{expeditions}', v_remaining_expeditions);

  UPDATE public.users
  SET space_state = v_space_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'cancelled_count', v_cancelled_count,
    'new_space_state', v_space_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_polyspace_expeditions(TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- RPC: upgrade_polyspace_module
-- Source: seal_polyspace_module_levels_anti_cheat.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.upgrade_polyspace_module(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.upgrade_polyspace_module(TEXT, NUMERIC, JSONB);
DROP FUNCTION IF EXISTS upgrade_polyspace_module(TEXT, TEXT);
DROP FUNCTION IF EXISTS upgrade_polyspace_module(TEXT, NUMERIC, JSONB);
CREATE OR REPLACE FUNCTION public.upgrade_polyspace_module(
  p_player_id TEXT,
  p_module_type TEXT
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
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'message', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

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

  -- 4. Calculate Canonical Upgrade Costs (Option 1: Base 80 Iron / 30 Tit / 50 PGT, L1-35: 1.22^lvl; L36-50: 1.18 taper for minerals, 1.15 taper for PGT):
  IF v_cur_lvl <= 35 THEN
    v_cost_iron := FLOOR(80 * POW(1.22, v_cur_lvl - 1));
    v_cost_tit  := FLOOR(30 * POW(1.22, v_cur_lvl - 1));
    v_cost_pgt  := FLOOR(50 * POW(1.22, v_cur_lvl - 1));
  ELSE
    v_cost_iron := FLOOR((80 * POW(1.22, 34)) * POW(1.18, v_cur_lvl - 35));
    v_cost_tit  := FLOOR((30 * POW(1.22, 34)) * POW(1.18, v_cur_lvl - 35));
    v_cost_pgt  := FLOOR((50 * POW(1.22, 34)) * POW(1.15, v_cur_lvl - 35));
  END IF;

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

GRANT EXECUTE ON FUNCTION public.upgrade_polyspace_module(TEXT, TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: smelt_space_ore
-- Source: seal_world_boss_and_minerals_anti_cheat.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.smelt_space_ore(TEXT, TEXT, NUMERIC);
DROP FUNCTION IF EXISTS smelt_space_ore(TEXT, TEXT, NUMERIC);
CREATE OR REPLACE FUNCTION public.smelt_space_ore(
  p_player_id TEXT,
  p_recipe TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_space_state JSONB;
  v_recipe TEXT;
  
  v_cur_iron NUMERIC := 0;
  v_cur_tit NUMERIC := 0;
  v_cur_quantum NUMERIC := 0;
  v_cur_pgt_ore NUMERIC := 0;
  
  v_cost_iron NUMERIC := 0;
  v_cost_tit NUMERIC := 0;
  v_cost_quantum NUMERIC := 0;
  
  v_gain_tit NUMERIC := 0;
  v_gain_quantum NUMERIC := 0;
  v_gain_pgt_ore NUMERIC := 0;
  
  v_recipe_name TEXT := '';
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'message', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  v_recipe := LOWER(TRIM(COALESCE(p_recipe, '')));

  -- 2. Validate Recipe Parameters
  IF v_recipe = 'quantum_10x' THEN
    v_cost_tit := 1000;
    v_gain_quantum := 300;
    v_recipe_name := '1,000 Titanium Ore ➔ +300 Quantum Ore';
  ELSIF v_recipe IN ('quantum_100x', 'quantum_10000') THEN
    v_cost_tit := 10000;
    v_gain_quantum := 3000;
    v_recipe_name := '10,000 Titanium Ore ➔ +3,000 Quantum Ore (10x Refinery)';
  ELSIF v_recipe = 'titanium_10x' THEN
    v_cost_iron := 1500;
    v_gain_tit := 400;
    v_recipe_name := '1,500 Iron Ore ➔ +400 Titanium Ore';
  ELSIF v_recipe IN ('titanium_100x', 'titanium_15000') THEN
    v_cost_iron := 15000;
    v_gain_tit := 4000;
    v_recipe_name := '15,000 Iron Ore ➔ +4,000 Titanium Ore (10x Refinery)';
  ELSIF v_recipe IN ('pgt_ore', 'pgtore', 'pgt_ore_bulk', 'pgtore_bulk') THEN
    v_cost_quantum := 5000;
    v_gain_pgt_ore := 2;
    v_recipe_name := '5,000 Quantum Crystals ➔ +2 Rare PGT Ore';
  ELSIF v_recipe = 'quantum' THEN
    v_cost_tit := 100;
    v_gain_quantum := 30;
    v_recipe_name := '100 Titanium Ore ➔ +30 Quantum Ore';
  ELSIF v_recipe = 'titanium' THEN
    v_cost_iron := 150;
    v_gain_tit := 40;
    v_recipe_name := '150 Iron Ore ➔ +40 Titanium Ore';
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Unknown refinery recipe: ' || p_recipe);
  END IF;

  -- 3. Row Locking
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player account not found.');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Account suspended.');
  END IF;

  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_cur_iron     := COALESCE((v_space_state->>'iron')::NUMERIC, 0);
  v_cur_tit      := COALESCE((v_space_state->>'titanium')::NUMERIC, 0);
  v_cur_quantum  := COALESCE((v_space_state->>'quantum')::NUMERIC, 0);
  v_cur_pgt_ore  := COALESCE((v_space_state->>'pgtOre')::NUMERIC, 0);

  -- 4. Verify Mineral Resources
  IF v_cost_iron > 0 AND v_cur_iron < v_cost_iron THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Requires ' || v_cost_iron::TEXT || ' Iron Ore! You have ' || FLOOR(v_cur_iron)::TEXT
    );
  END IF;

  IF v_cost_tit > 0 AND v_cur_tit < v_cost_tit THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Requires ' || v_cost_tit::TEXT || ' Titanium Ore! You have ' || FLOOR(v_cur_tit)::TEXT
    );
  END IF;

  IF v_cost_quantum > 0 AND v_cur_quantum < v_cost_quantum THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Requires ' || v_cost_quantum::TEXT || ' Quantum Crystals! You have ' || FLOOR(v_cur_quantum)::TEXT
    );
  END IF;

  -- 5. Deduct Inputs & Add Outputs
  v_cur_iron     := GREATEST(0, v_cur_iron - v_cost_iron);
  v_cur_tit      := GREATEST(0, v_cur_tit - v_cost_tit) + v_gain_tit;
  v_cur_quantum  := GREATEST(0, v_cur_quantum - v_cost_quantum) + v_gain_quantum;
  v_cur_pgt_ore  := v_cur_pgt_ore + v_gain_pgt_ore;

  v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(v_cur_iron));
  v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(v_cur_tit));
  v_space_state := jsonb_set(v_space_state, '{quantum}', to_jsonb(v_cur_quantum));
  v_space_state := jsonb_set(v_space_state, '{pgtOre}', to_jsonb(v_cur_pgt_ore));

  -- 6. Update Database
  UPDATE public.users
  SET space_state = v_space_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'recipe', v_recipe,
    'recipe_name', v_recipe_name,
    'message', '🏭 REFINERY SMELTED: ' || v_recipe_name,
    'space_state', v_space_state,
    'new_iron', v_cur_iron,
    'new_titanium', v_cur_tit,
    'new_quantum', v_cur_quantum,
    'new_pgt_ore', v_cur_pgt_ore
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.smelt_space_ore(TEXT, TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: scan_polyspace_anomaly
-- Source: seal_world_boss_and_minerals_anti_cheat.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.scan_polyspace_anomaly(TEXT);
DROP FUNCTION IF EXISTS scan_polyspace_anomaly(TEXT);
CREATE OR REPLACE FUNCTION public.scan_polyspace_anomaly(
  p_player_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_space_state JSONB;
  v_now_ms BIGINT;
  v_last_scan_ms BIGINT;
  v_cooldown_ms BIGINT := 21600000; -- 6 hours in milliseconds
  v_roll NUMERIC;
  v_reward_type TEXT;
  v_msg TEXT;
  v_cur_iron NUMERIC := 0;
  v_cur_tit NUMERIC := 0;
  v_cur_quant NUMERIC := 0;
  v_expeditions JSONB;
  v_has_active_exp BOOLEAN := false;
  v_exp JSONB;
  v_new_exps JSONB := '[]'::jsonb;
  v_remaining_ms BIGINT;
  v_hrs_left NUMERIC;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'message', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  -- 2. Row Locking
  SELECT * INTO v_user
  FROM public.users
  WHERE player_id = v_pid
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player account not found.');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Account suspended.');
  END IF;

  v_space_state := COALESCE(v_user.space_state, '{}'::jsonb);
  v_now_ms := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
  v_last_scan_ms := COALESCE((v_space_state->>'lastAnomalyScanTime')::BIGINT, 0);

  -- 3. Strict 6-Hour Cooldown Verification
  IF (v_now_ms - v_last_scan_ms) < v_cooldown_ms THEN
    v_hrs_left := ROUND(((v_cooldown_ms - (v_now_ms - v_last_scan_ms)) / 3600000.0)::NUMERIC, 1);
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Scanner recharging! Available in ' || v_hrs_left::TEXT || ' hours.'
    );
  END IF;

  v_cur_iron  := COALESCE((v_space_state->>'iron')::NUMERIC, 0);
  v_cur_tit   := COALESCE((v_space_state->>'titanium')::NUMERIC, 0);
  v_cur_quant := COALESCE((v_space_state->>'quantum')::NUMERIC, 0);
  v_expeditions := COALESCE(v_space_state->'expeditions', '[]'::jsonb);

  -- 4. Roll Deterministic Anomaly Outcome
  v_roll := random();

  IF v_roll < 0.35 THEN
    -- Check if player has active expeditions
    IF jsonb_array_length(v_expeditions) > 0 THEN
      FOR v_exp IN SELECT * FROM jsonb_array_elements(v_expeditions) LOOP
        v_remaining_ms := COALESCE((v_exp->>'endTime')::BIGINT, 0) - v_now_ms;
        IF v_remaining_ms > 0 THEN
          v_has_active_exp := true;
          v_exp := jsonb_set(v_exp, '{endTime}', to_jsonb(v_now_ms + ROUND(v_remaining_ms * 0.75)::BIGINT));
        END IF;
        v_new_exps := v_new_exps || jsonb_build_array(v_exp);
      END LOOP;
    END IF;

    IF v_has_active_exp THEN
      v_reward_type := 'wormhole';
      v_msg := '🌀 ANOMALY DISCOVERED: Temporal Wormhole! Active expedition timers cut by 25%!';
      v_space_state := jsonb_set(v_space_state, '{expeditions}', v_new_exps);
    ELSE
      v_reward_type := 'magnetic_surge';
      v_cur_iron := v_cur_iron + 80;
      v_msg := '🌀 ANOMALY DISCOVERED: Magnetic Field Surge! +80 Iron recovered!';
      v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(v_cur_iron));
    END IF;

  ELSIF v_roll < 0.65 THEN
    -- Ghost ship salvage
    v_reward_type := 'ghost_ship';
    v_cur_iron := v_cur_iron + 100;
    v_cur_tit := v_cur_tit + 40;
    v_cur_quant := v_cur_quant + 15;
    v_msg := '🛸 ANOMALY DISCOVERED: Derelict Ghost Ship Salvaged! +100 Iron, +40 Tit, & +15 Quant Ore!';
    v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(v_cur_iron));
    v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(v_cur_tit));
    v_space_state := jsonb_set(v_space_state, '{quantum}', to_jsonb(v_cur_quant));

  ELSE
    -- Cosmic Resource Shower
    v_reward_type := 'resource_shower';
    v_cur_iron := v_cur_iron + 140;
    v_cur_tit := v_cur_tit + 50;
    v_msg := '🌌 ANOMALY DISCOVERED: Cosmic Resource Shower! +140 Iron & +50 Titanium!';
    v_space_state := jsonb_set(v_space_state, '{iron}', to_jsonb(v_cur_iron));
    v_space_state := jsonb_set(v_space_state, '{titanium}', to_jsonb(v_cur_tit));
  END IF;

  -- 5. Stamp Cooldown & Save State
  v_space_state := jsonb_set(v_space_state, '{lastAnomalyScanTime}', to_jsonb(v_now_ms));

  UPDATE public.users
  SET space_state = v_space_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object(
    'success', true,
    'reward_type', v_reward_type,
    'message', v_msg,
    'space_state', v_space_state
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.scan_polyspace_anomaly(TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: poke_allied_outpost
-- Source: emergency_patch_drop_credit_arcade_payout_and_ban_nower.sql
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.poke_allied_outpost(TEXT, TEXT);
DROP FUNCTION IF EXISTS poke_allied_outpost(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.poke_allied_outpost(
  p_player_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_today_str TEXT := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_warp_level INTEGER;
  v_bonus_iron INTEGER;
  v_bonus_pgt NUMERIC := 20.00;
  v_new_balance NUMERIC;
  v_state JSONB;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

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
  IF (v_state->>'lastPokeDate') IS NOT NULL AND (v_state->>'lastPokeDate') >= v_today_str THEN
    RETURN jsonb_build_object('success', false, 'error', 'Allied Outpost already poked today (1/day limit)! Resets at midnight UTC.');
  END IF;

  -- Clamp warp level strictly between 1 and 50 (prevents memory-injected levels like 999)
  v_warp_level := LEAST(GREATEST(1, COALESCE((v_state->>'warpLevel')::integer, 1)), 50);
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

GRANT EXECUTE ON FUNCTION public.poke_allied_outpost(TEXT) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: launch_outpost_raid
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.launch_outpost_raid(TEXT, TEXT);
DROP FUNCTION IF EXISTS launch_outpost_raid(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.launch_outpost_raid(TEXT);
DROP FUNCTION IF EXISTS launch_outpost_raid(TEXT);
DROP FUNCTION IF EXISTS public.launch_outpost_raid(TEXT, INTEGER);
DROP FUNCTION IF EXISTS launch_outpost_raid(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.launch_outpost_raid(
  p_player_id TEXT,
  p_target INTEGER DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pid TEXT;
  v_user RECORD;
  v_today_str TEXT := to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  v_target INTEGER := COALESCE(p_target, 0);
  v_fleet_power INTEGER;
  v_enemy_power INTEGER;
  v_iron NUMERIC;
  v_stolen_pgt NUMERIC := 0.0;
  v_stolen_iron INTEGER := 0;
  v_stolen_titanium INTEGER := 0;
  v_stolen_quantum INTEGER := 0;
  v_stolen_pgt_ore INTEGER := 0;
  v_new_balance NUMERIC;
  v_state JSONB;
  v_guard RECORD;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

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
  IF (v_state->>'lastRaidDate') IS NOT NULL AND (v_state->>'lastRaidDate') >= v_today_str THEN
    RETURN jsonb_build_object('success', false, 'error', 'Outpost Raid already launched today (1/day limit)! Resets at midnight UTC.');
  END IF;

  -- Require 15 Iron fuel
  v_iron := COALESCE((v_state->>'iron')::numeric, 0);
  IF v_iron < 15 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Raid requires 15 Iron for Fuel!');
  END IF;

  v_fleet_power := GREATEST(10, COALESCE((v_state->>'fleetPower')::integer, 50));

  -- Risk & Enemy Power calculation per target
  IF v_target = 0 THEN
    -- Target 0: Drone Depot (Low Risk • 85% Win • +Iron & Titanium)
    v_enemy_power := FLOOR(v_fleet_power * (0.35 + RANDOM() * 0.55));
  ELSIF v_target = 1 THEN
    -- Target 1: Refinery Silo (Med Risk • 65% Win • +Quantum Crystals)
    v_enemy_power := FLOOR(v_fleet_power * (0.55 + RANDOM() * 0.70));
  ELSE
    -- Target 2: Rogue Dread (High Risk • 40% Win • +PGT Ore & Relics)
    v_enemy_power := FLOOR(v_fleet_power * (0.80 + RANDOM() * 0.80));
  END IF;

  -- Deduct iron fuel and set raid date
  v_state := jsonb_set(v_state, '{lastRaidDate}', to_jsonb(v_today_str));
  v_state := jsonb_set(v_state, '{iron}', to_jsonb(v_iron - 15));

  IF v_fleet_power < v_enemy_power THEN
    -- Defeat: record updated state with cooldown and fuel consumed
    UPDATE public.users SET space_state = v_state, updated_at = NOW() WHERE player_id = v_user.player_id;
    RETURN jsonb_build_object(
      'success', true,
      'victory', false,
      'target', v_target,
      'enemy_power', v_enemy_power,
      'fleet_power', v_fleet_power,
      'message', format('Raid Defeated! Enemy Outpost defense (%s Power) was too strong.', v_enemy_power),
      'space_state', v_state
    );
  END IF;

  -- Victory: calculate reward securely server-side based on target
  IF v_target = 0 THEN
    -- Drone Depot: Generous Iron & Titanium, ZERO PGT
    v_stolen_pgt := 0.0;
    v_stolen_iron := FLOOR(60 + RANDOM() * 60);
    v_stolen_titanium := FLOOR(15 + RANDOM() * 15);
    v_stolen_quantum := 0;
    v_stolen_pgt_ore := 0;
  ELSIF v_target = 1 THEN
    -- Refinery Silo: Quantum Crystals + moderate Iron/Titanium, ZERO PGT
    v_stolen_pgt := 0.0;
    v_stolen_iron := FLOOR(30 + RANDOM() * 30);
    v_stolen_titanium := FLOOR(10 + RANDOM() * 10);
    v_stolen_quantum := FLOOR(200 + RANDOM() * 300);
    v_stolen_pgt_ore := 0;
  ELSE
    -- Rogue Dread: PGT + PGT Ore chance + Iron/Titanium
    v_stolen_pgt := ROUND((18.0 + RANDOM() * 12.0)::numeric, 2);
    v_stolen_iron := FLOOR(25 + RANDOM() * 25);
    v_stolen_titanium := FLOOR(10 + RANDOM() * 10);
    v_stolen_quantum := 0;
    v_stolen_pgt_ore := CASE WHEN RANDOM() < 0.35 THEN 1 ELSE 0 END;
  END IF;

  v_state := jsonb_set(v_state, '{raidsWon}', to_jsonb(COALESCE((v_state->>'raidsWon')::integer, 0) + 1));
  v_state := jsonb_set(v_state, '{iron}', to_jsonb(COALESCE((v_state->>'iron')::numeric, 0) + v_stolen_iron));
  v_state := jsonb_set(v_state, '{titanium}', to_jsonb(COALESCE((v_state->>'titanium')::numeric, 0) + v_stolen_titanium));
  IF v_stolen_quantum > 0 THEN
    v_state := jsonb_set(v_state, '{quantum}', to_jsonb(COALESCE((v_state->>'quantum')::numeric, 0) + v_stolen_quantum));
  END IF;
  IF v_stolen_pgt_ore > 0 THEN
    v_state := jsonb_set(v_state, '{pgtOre}', to_jsonb(COALESCE((v_state->>'pgtOre')::numeric, 0) + v_stolen_pgt_ore));
  END IF;
  v_state := jsonb_set(v_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((v_state->>'mineralsMinedTotal')::numeric, 0) + v_stolen_iron + v_stolen_titanium + v_stolen_quantum + v_stolen_pgt_ore));

  IF v_stolen_pgt > 0 THEN
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
  ELSE
    UPDATE public.users
    SET space_state = v_state,
        updated_at = NOW()
    WHERE player_id = v_user.player_id
    RETURNING balance_pgt INTO v_new_balance;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'victory', true,
    'target', v_target,
    'enemy_power', v_enemy_power,
    'fleet_power', v_fleet_power,
    'stolen_pgt', v_stolen_pgt,
    'stolen_iron', v_stolen_iron,
    'stolen_titanium', v_stolen_titanium,
    'stolen_quantum', v_stolen_quantum,
    'stolen_pgt_ore', v_stolen_pgt_ore,
    'new_balance', v_new_balance,
    'space_state', v_state
  );
END;
$$;

-- Backward-compatibility 1-arg wrapper
CREATE OR REPLACE FUNCTION public.launch_outpost_raid(
  p_player_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN public.launch_outpost_raid(p_player_id, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.launch_outpost_raid(TEXT, INTEGER) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.launch_outpost_raid(TEXT) TO authenticated, service_role, anon;


-- ------------------------------------------------------------------------------
-- RPC: start_polyspace_expedition
-- Source: fix_polyspace_expedition_launch_rpc.sql
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
  -- Deterministic flight duration preserves predictable player countdowns and ensures
  -- fixed-period auto-clickers stay phase-locked instead of skipping cycles and hiding their cadence.
  v_duration_ms := GREATEST(60000, ROUND(v_base_duration_ms / (1.0 + ((v_warp_level - 1) * 0.05)))::BIGINT);
  v_start_ms := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
  v_end_ms := v_start_ms + v_duration_ms;

  -- 6. Generate and Append Expedition Objects
  FOR i IN 0..(v_launch_count - 1) LOOP
    v_new_exp := jsonb_build_object(
      'id', 'exp_' || (v_start_ms + i) || '_' || SUBSTRING(MD5(RANDOM()::TEXT || i::TEXT) FROM 1 FOR 5),
      'type', LOWER(p_destination),
      'name', v_dest_name || CASE WHEN v_launch_count > 1 THEN ' #' || (i + 1) ELSE '' END,
      'startTime', v_start_ms,
      'endTime', v_end_ms,
      'serverSig', 'server_verified'
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
-- RPC: save_polyspace_state (SEALED AGAINST EXPEDITION & MINERAL INJECTION)
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

  -- 2. Lock & Load User Profile
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

  -- Anti-tamper probe detection: if caller attempts to wipe or backdate server cooldowns
  IF v_current_state->>'lastPokeDate' IS NOT NULL AND 
     (p_space_state->>'lastPokeDate' IS NULL OR p_space_state->>'lastPokeDate' < v_current_state->>'lastPokeDate') THEN
    PERFORM public.record_bot_warning(
      v_pid,
      'cooldown_wipe_attempt',
      'PolySpace Fleet Sentinel',
      jsonb_build_object('field', 'lastPokeDate', 'attempted', p_space_state->>'lastPokeDate')
    );
  END IF;

  v_merged_state := v_current_state || p_space_state;

  -- CRITICAL ANTI-CHEAT: Never allow client to overwrite or inject expeditions!
  -- Expeditions must strictly be managed via start_polyspace_expedition & claim_polyspace_expedition
  v_merged_state := jsonb_set(v_merged_state, '{expeditions}', COALESCE(v_current_state->'expeditions', '[]'::jsonb));

  -- CRITICAL ANTI-CHEAT: Never allow client to tamper with or reset server claim cadence telemetry!
  IF v_current_state ? 'lastClaimTimestampMs' THEN
    v_merged_state := jsonb_set(v_merged_state, '{lastClaimTimestampMs}', v_current_state->'lastClaimTimestampMs');
  ELSE
    v_merged_state := v_merged_state - 'lastClaimTimestampMs';
  END IF;

  IF v_current_state ? 'recentClaimIntervals' THEN
    v_merged_state := jsonb_set(v_merged_state, '{recentClaimIntervals}', v_current_state->'recentClaimIntervals');
  ELSE
    v_merged_state := v_merged_state - 'recentClaimIntervals';
  END IF;

  IF v_current_state ? 'recentClaimLags' THEN
    v_merged_state := jsonb_set(v_merged_state, '{recentClaimLags}', v_current_state->'recentClaimLags');
  ELSE
    v_merged_state := v_merged_state - 'recentClaimLags';
  END IF;

  -- CRITICAL COOLDOWN PRESERVATION: Client can NEVER wipe, modify, or roll back server daily cooldowns!
  IF v_current_state->>'lastPokeDate' IS NOT NULL THEN
    v_merged_state := jsonb_set(v_merged_state, '{lastPokeDate}', to_jsonb(v_current_state->>'lastPokeDate'));
  ELSE
    v_merged_state := v_merged_state - 'lastPokeDate';
  END IF;

  IF v_current_state->>'lastRaidDate' IS NOT NULL THEN
    v_merged_state := jsonb_set(v_merged_state, '{lastRaidDate}', to_jsonb(v_current_state->>'lastRaidDate'));
  ELSE
    v_merged_state := v_merged_state - 'lastRaidDate';
  END IF;

  IF v_current_state->>'lastAnomalyScanTime' IS NOT NULL THEN
    v_merged_state := jsonb_set(v_merged_state, '{lastAnomalyScanTime}', to_jsonb((v_current_state->>'lastAnomalyScanTime')::bigint));
  END IF;

  IF v_current_state->>'lastOpDate' IS NOT NULL THEN
    v_merged_state := jsonb_set(v_merged_state, '{lastOpDate}', to_jsonb(v_current_state->>'lastOpDate'));
  ELSE
    v_merged_state := v_merged_state - 'lastOpDate';
  END IF;

  v_merged_state := jsonb_set(v_merged_state, '{raidsWon}', to_jsonb(COALESCE((v_current_state->>'raidsWon')::integer, 0)));
  v_merged_state := jsonb_set(v_merged_state, '{mineralsMinedTotal}', to_jsonb(COALESCE((v_current_state->>'mineralsMinedTotal')::numeric, 0)));

  -- Anti-tamper clamps: Module levels cannot increase without upgrade_polyspace_module RPC
  v_merged_state := jsonb_set(v_merged_state, '{warpLevel}', to_jsonb(COALESCE((v_current_state->>'warpLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{laserLevel}', to_jsonb(COALESCE((v_current_state->>'laserLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{cargoLevel}', to_jsonb(COALESCE((v_current_state->>'cargoLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{shieldLevel}', to_jsonb(COALESCE((v_current_state->>'shieldLevel')::integer, 1)));
  v_merged_state := jsonb_set(v_merged_state, '{turretLevel}', to_jsonb(COALESCE((v_current_state->>'turretLevel')::integer, 1)));

  -- Space Minerals are strictly server-authoritative (managed via claim_polyspace_expedition, upgrade_polyspace_module, smelt_space_ore, launch_outpost_raid, scan_polyspace_anomaly, strike_world_boss)
  -- save_polyspace_state can NEVER inflate OR roll back mineral balances!
  v_merged_state := jsonb_set(v_merged_state, '{iron}', to_jsonb(COALESCE((v_current_state->>'iron')::numeric, 0)));
  v_merged_state := jsonb_set(v_merged_state, '{titanium}', to_jsonb(COALESCE((v_current_state->>'titanium')::numeric, 0)));
  v_merged_state := jsonb_set(v_merged_state, '{quantum}', to_jsonb(COALESCE((v_current_state->>'quantum')::numeric, 0)));
  v_merged_state := jsonb_set(v_merged_state, '{pgtOre}', to_jsonb(COALESCE((v_current_state->>'pgtOre')::numeric, 0)));
  v_merged_state := jsonb_set(v_merged_state, '{pgtMinedTotal}', to_jsonb(COALESCE((v_current_state->>'pgtMinedTotal')::numeric, 0)));

  -- Preserve server missionLogs unless caller explicitly requested clearMissionLogs (empty array with _clearMissionLogs flag)
  IF COALESCE((p_space_state->>'_clearMissionLogs')::boolean, false) THEN
    v_merged_state := (v_merged_state - '_clearMissionLogs');
    v_merged_state := jsonb_set(v_merged_state, '{missionLogs}', '[]'::jsonb);
  ELSIF v_current_state ? 'missionLogs' THEN
    v_merged_state := jsonb_set(v_merged_state, '{missionLogs}', COALESCE(v_current_state->'missionLogs', '[]'::jsonb));
  END IF;

  IF v_current_state ? 'missionsCompleted' THEN
    v_merged_state := jsonb_set(v_merged_state, '{missionsCompleted}', v_current_state->'missionsCompleted');
  END IF;

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

  UPDATE public.users
  SET space_state = v_merged_state,
      updated_at = NOW()
  WHERE player_id = v_user.player_id;

  RETURN jsonb_build_object('success', true, 'space_state', v_merged_state);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_polyspace_state(TEXT, JSONB) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: start_hyperdrive_boost & complete_hyperdrive_boost
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.start_hyperdrive_boost(TEXT, TEXT);
DROP FUNCTION IF EXISTS start_hyperdrive_boost(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.start_hyperdrive_boost(
    p_player_id TEXT,
    p_expedition_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_guard RECORD;
    v_pid TEXT;
    v_space JSONB;
    v_expeditions JSONB;
    v_found BOOLEAN := false;
    v_seed TEXT;
    v_now_epoch BIGINT := (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint;
    v_exp JSONB;
    v_updated JSONB := '[]'::jsonb;
BEGIN
    v_guard := public.assert_caller_player_id(p_player_id);
    IF v_guard.p_status <> 'OK' THEN
        RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
    END IF;
    v_pid := v_guard.p_player_id;

    SELECT space_state INTO v_space 
    FROM public.users 
    WHERE LOWER(player_id) = LOWER(v_pid)
       OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player not found');
    END IF;

    v_expeditions := COALESCE(v_space->'expeditions', '[]'::jsonb);

    FOR v_exp IN SELECT * FROM jsonb_array_elements(v_expeditions) LOOP
        IF v_exp->>'id' = p_expedition_id THEN
            v_found := true;
            IF COALESCE((v_exp->>'hasBoosted')::boolean, false) = true THEN
                RETURN jsonb_build_object('success', false, 'error', 'Hyperdrive boost already claimed for this expedition.');
            END IF;

            IF v_now_epoch >= (v_exp->>'endTime')::bigint THEN
                RETURN jsonb_build_object('success', false, 'error', 'Expedition has already reached its destination.');
            END IF;

            v_seed := md5(RANDOM()::text || v_now_epoch::text);
            v_exp := jsonb_set(v_exp, '{activeChallenge}', jsonb_build_object('seed', v_seed, 'issuedAt', v_now_epoch));
        END IF;
        v_updated := v_updated || jsonb_build_array(v_exp);
    END LOOP;

    IF NOT v_found THEN
        RETURN jsonb_build_object('success', false, 'error', 'Expedition not found');
    END IF;

    v_space := jsonb_set(v_space, '{expeditions}', v_updated);

    UPDATE public.users 
    SET space_state = v_space, updated_at = NOW() 
    WHERE LOWER(player_id) = LOWER(v_pid)
       OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);

    RETURN jsonb_build_object('success', true, 'seed', v_seed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_hyperdrive_boost(TEXT, TEXT) TO authenticated, service_role, anon;

DROP FUNCTION IF EXISTS public.complete_hyperdrive_boost(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.complete_hyperdrive_boost(TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS complete_hyperdrive_boost(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS complete_hyperdrive_boost(TEXT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.complete_hyperdrive_boost(
    p_player_id TEXT,
    p_expedition_id TEXT,
    p_seed TEXT,
    p_telemetry JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_guard RECORD;
    v_pid TEXT;
    v_space JSONB;
    v_expeditions JSONB;
    v_updated JSONB := '[]'::jsonb;
    v_exp JSONB;
    v_now_epoch BIGINT := (EXTRACT(EPOCH FROM NOW()) * 1000)::bigint;
    v_issued_at BIGINT;
    v_elapsed BIGINT;
    v_start_time BIGINT;
    v_end_time BIGINT;
    v_total_dur BIGINT;
    v_boost_pct INT;
    v_reduction BIGINT;
    v_new_end BIGINT;
    v_found BOOLEAN := false;
BEGIN
    v_guard := public.assert_caller_player_id(p_player_id);
    IF v_guard.p_status <> 'OK' THEN
        RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
    END IF;
    v_pid := v_guard.p_player_id;

    SELECT space_state INTO v_space 
    FROM public.users 
    WHERE LOWER(player_id) = LOWER(v_pid)
       OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player not found');
    END IF;

    v_expeditions := COALESCE(v_space->'expeditions', '[]'::jsonb);

    FOR v_exp IN SELECT * FROM jsonb_array_elements(v_expeditions) LOOP
        IF v_exp->>'id' = p_expedition_id THEN
            v_found := true;
            IF COALESCE((v_exp->>'hasBoosted')::boolean, false) = true THEN
                RETURN jsonb_build_object('success', false, 'error', 'Hyperdrive boost already completed for this mission.');
            END IF;

            IF v_exp->'activeChallenge' IS NULL OR v_exp->'activeChallenge'->>'seed' <> p_seed THEN
                RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired challenge nonce.');
            END IF;

            v_issued_at := (v_exp->'activeChallenge'->>'issuedAt')::bigint;
            v_elapsed := v_now_epoch - v_issued_at;

            IF v_elapsed < 1000 OR v_elapsed > 18000 THEN
                RETURN jsonb_build_object('success', false, 'error', 'Timing calibration anomaly detected. Boost rejected.');
            END IF;

            v_start_time := (v_exp->>'startTime')::bigint;
            v_end_time := (v_exp->>'endTime')::bigint;
            v_total_dur := GREATEST(1000, v_end_time - v_start_time);

            -- Cheat-Proof Server RNG: Random speed boost between 10% and 35% inclusive
            v_boost_pct := 10 + FLOOR(RANDOM() * 26)::int;
            v_reduction := ROUND(v_total_dur * (v_boost_pct::numeric / 100.0))::bigint;
            v_new_end := GREATEST(v_start_time + 1000, v_end_time - v_reduction);

            v_exp := jsonb_set(v_exp, '{endTime}', to_jsonb(v_new_end));
            v_exp := jsonb_set(v_exp, '{hasBoosted}', 'true'::jsonb);
            v_exp := jsonb_set(v_exp, '{boostPct}', to_jsonb(v_boost_pct));
            v_exp := v_exp - 'activeChallenge';
        END IF;
        v_updated := v_updated || jsonb_build_array(v_exp);
    END LOOP;

    IF NOT v_found THEN
        RETURN jsonb_build_object('success', false, 'error', 'Expedition not found');
    END IF;

    v_space := jsonb_set(v_space, '{expeditions}', v_updated);

    UPDATE public.users 
    SET space_state = v_space, updated_at = NOW() 
    WHERE LOWER(player_id) = LOWER(v_pid)
       OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);

    RETURN jsonb_build_object(
        'success', true,
        'boost_pct', v_boost_pct,
        'new_end_time', v_new_end,
        'reduction_ms', v_reduction,
        'space_state', v_space
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_hyperdrive_boost(TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- RPC: fail_hyperdrive_boost (records missed attempt so it cannot be retried)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fail_hyperdrive_boost(TEXT, TEXT);
DROP FUNCTION IF EXISTS fail_hyperdrive_boost(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.fail_hyperdrive_boost(
    p_player_id TEXT,
    p_expedition_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_guard RECORD;
    v_pid TEXT;
    v_space JSONB;
    v_expeditions JSONB;
    v_updated JSONB := '[]'::jsonb;
    v_exp JSONB;
    v_found BOOLEAN := false;
BEGIN
    v_guard := public.assert_caller_player_id(p_player_id);
    IF v_guard.p_status <> 'OK' THEN
        RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
    END IF;
    v_pid := v_guard.p_player_id;

    SELECT space_state INTO v_space 
    FROM public.users 
    WHERE LOWER(player_id) = LOWER(v_pid)
       OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Player not found');
    END IF;

    v_expeditions := COALESCE(v_space->'expeditions', '[]'::jsonb);

    FOR v_exp IN SELECT * FROM jsonb_array_elements(v_expeditions) LOOP
        IF v_exp->>'id' = p_expedition_id THEN
            v_found := true;
            -- Mark as attempted & missed so no retries are allowed for this expedition
            v_exp := jsonb_set(v_exp, '{hasBoosted}', 'true'::jsonb);
            v_exp := jsonb_set(v_exp, '{boostMissed}', 'true'::jsonb);
            v_exp := v_exp - 'activeChallenge';
        END IF;
        v_updated := v_updated || jsonb_build_array(v_exp);
    END LOOP;

    IF NOT v_found THEN
        RETURN jsonb_build_object('success', false, 'error', 'Expedition not found');
    END IF;

    v_space := jsonb_set(v_space, '{expeditions}', v_updated);

    UPDATE public.users 
    SET space_state = v_space, updated_at = NOW() 
    WHERE LOWER(player_id) = LOWER(v_pid)
       OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);

    RETURN jsonb_build_object('success', true, 'space_state', v_space);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fail_hyperdrive_boost(TEXT, TEXT) TO authenticated, service_role, anon;




-- ------------------------------------------------------------------------------
-- POLYSPACE RADAR PGT HARVEST SENTINEL (PLAN-RADAR-PGT)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.polyspace_radar_harvests (
  id BIGSERIAL PRIMARY KEY,
  player_id TEXT NOT NULL,
  claim_date DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::DATE,
  amount_pgt NUMERIC(10, 2) NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.polyspace_radar_harvests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_radar_harvests_pid_date ON public.polyspace_radar_harvests(player_id, claim_date);
CREATE INDEX IF NOT EXISTS idx_radar_harvests_pid_claimed ON public.polyspace_radar_harvests(player_id, claimed_at DESC);

-- ==============================================================================
-- POLYSPACE RADAR PGT ANOMALY: MINING LASER MULTIPLIER & 45% DOUBLE GAMBLE
-- Version: 1.5.803
-- Invariant: Anti-cheat trigger remains SECURITY INVOKER. Balance credits handled server-side.
-- ==============================================================================

-- 1. Extend polyspace_radar_harvests with telemetry for auditability
ALTER TABLE public.polyspace_radar_harvests 
ADD COLUMN IF NOT EXISTS is_gamble_double BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS gamble_won BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS laser_multiplier NUMERIC DEFAULT 1.0;

-- 2. Drop legacy function signatures
DROP FUNCTION IF EXISTS public.claim_polyspace_radar_harvest(TEXT);
DROP FUNCTION IF EXISTS public.claim_polyspace_radar_harvest(TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.get_polyspace_radar_harvest_status(TEXT);

-- 3. Updated Status RPC: Returns daily claim status + player's Mining Laser level & multiplier
CREATE OR REPLACE FUNCTION public.get_polyspace_radar_harvest_status(
  p_player_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_today DATE;
  v_claims_today INTEGER := 0;
  v_last_claim_time TIMESTAMPTZ;
  v_user RECORD;
  v_laser_level INTEGER := 1;
  v_laser_mult NUMERIC := 1.0;
  v_is_vip BOOLEAN := false;
  v_max_daily INTEGER := 10;
BEGIN
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::DATE;

  SELECT COUNT(*), MAX(claimed_at) INTO v_claims_today, v_last_claim_time
  FROM public.polyspace_radar_harvests
  WHERE (player_id = v_pid OR LOWER(player_id) = LOWER(v_pid))
    AND claim_date = v_today;

  SELECT * INTO v_user FROM public.users WHERE LOWER(player_id) = LOWER(v_pid);
  IF FOUND THEN
    IF v_user.vip_until IS NOT NULL AND v_user.vip_until > NOW() THEN
      v_is_vip := true;
      v_max_daily := 20;
    END IF;

    IF v_user.space_state IS NOT NULL THEN
      v_laser_level := GREATEST(1, COALESCE((v_user.space_state->>'laserLevel')::integer, 1));
    ELSE
      v_laser_level := 1;
    END IF;
  ELSE
    v_laser_level := 1;
  END IF;

  IF v_laser_level <= 20 THEN
    v_laser_mult := 1.0 + ((v_laser_level - 1) * 0.18);
  ELSE
    v_laser_mult := 4.42 + ((v_laser_level - 20) * 0.25);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'claims_today', COALESCE(v_claims_today, 0),
    'claims_remaining', GREATEST(0, v_max_daily - COALESCE(v_claims_today, 0)),
    'max_daily', v_max_daily,
    'is_vip', v_is_vip,
    'last_claim_at', v_last_claim_time,
    'laser_level', v_laser_level,
    'laser_multiplier', v_laser_mult
  );
END;
$$;

-- 4. Updated Claim RPC: Applies Mining Laser multiplier & optional 45% Double Gamble
CREATE OR REPLACE FUNCTION public.claim_polyspace_radar_harvest(
  p_player_id TEXT,
  p_gamble_double BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_today DATE;
  v_claims_today INTEGER := 0;
  v_last_claim_time TIMESTAMPTZ;
  v_roll NUMERIC;
  v_base_reward NUMERIC;
  v_laser_reward NUMERIC;
  v_reward_pgt NUMERIC;
  v_new_balance NUMERIC;
  v_user RECORD;
  v_laser_level INTEGER := 1;
  v_laser_mult NUMERIC := 1.0;
  v_gamble_roll NUMERIC;
  v_gamble_won BOOLEAN := NULL;
  v_is_vip BOOLEAN := false;
  v_max_daily INTEGER := 10;
BEGIN
  v_guard := public.assert_caller_player_id(p_player_id);
  IF v_guard.p_status <> 'OK' THEN
    RETURN jsonb_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  v_today := (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::DATE;

  SELECT * INTO v_user FROM public.users WHERE player_id = v_pid FOR UPDATE;
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Player profile not found in database');
  END IF;

  IF COALESCE(v_user.is_banned, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended');
  END IF;

  IF v_user.vip_until IS NOT NULL AND v_user.vip_until > NOW() THEN
    v_is_vip := true;
    v_max_daily := 20;
  END IF;

  SELECT COUNT(*), MAX(claimed_at) INTO v_claims_today, v_last_claim_time
  FROM public.polyspace_radar_harvests
  WHERE (player_id = v_pid OR LOWER(player_id) = LOWER(v_pid))
    AND claim_date = v_today;

  IF v_claims_today >= v_max_daily THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily limit of ' || v_max_daily || ' radar PGT harvests reached for today. Resets at 00:00 UTC.',
      'claims_today', v_claims_today,
      'claims_remaining', 0,
      'max_daily', v_max_daily,
      'is_vip', v_is_vip
    );
  END IF;

  IF v_last_claim_time IS NOT NULL AND (NOW() - v_last_claim_time) < INTERVAL '5 seconds' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Harvest cooldown active. Please wait a few seconds between harvests.',
      'claims_today', v_claims_today,
      'claims_remaining', GREATEST(0, v_max_daily - v_claims_today),
      'max_daily', v_max_daily,
      'is_vip', v_is_vip
    );
  END IF;

  -- Mining Laser Multiplier Calculation
  IF v_user.space_state IS NOT NULL THEN
    v_laser_level := GREATEST(1, COALESCE((v_user.space_state->>'laserLevel')::integer, 1));
  ELSE
    v_laser_level := 1;
  END IF;

  IF v_laser_level <= 20 THEN
    v_laser_mult := 1.0 + ((v_laser_level - 1) * 0.18);
  ELSE
    v_laser_mult := 4.42 + ((v_laser_level - 20) * 0.25);
  END IF;

  -- Cosmic Anomaly Base Roll
  v_roll := random();
  IF v_roll < 0.75 THEN
    v_base_reward := ROUND((0.50 + random() * 0.25)::NUMERIC, 2);
  ELSIF v_roll < 0.93 THEN
    v_base_reward := ROUND((0.75 + random() * 0.75)::NUMERIC, 2);
  ELSIF v_roll < 0.98 THEN
    v_base_reward := ROUND((1.50 + random() * 2.50)::NUMERIC, 2);
  ELSE
    v_base_reward := ROUND((4.00 + random() * 6.00)::NUMERIC, 2);
  END IF;

  -- Multiply base reward by Mining Laser yield
  v_laser_reward := ROUND((v_base_reward * v_laser_mult)::NUMERIC, 2);

  -- Double PGT Gamble (45% chance of winning 2x, 55% chance of overload/0)
  IF COALESCE(p_gamble_double, false) THEN
    v_gamble_roll := random();
    IF v_gamble_roll < 0.45 THEN
      v_reward_pgt := ROUND((v_laser_reward * 2.0)::NUMERIC, 2);
      v_gamble_won := true;
    ELSE
      v_reward_pgt := 0.00;
      v_gamble_won := false;
    END IF;
  ELSE
    v_reward_pgt := v_laser_reward;
    v_gamble_won := NULL;
  END IF;

  -- Record authoritative harvest audit
  INSERT INTO public.polyspace_radar_harvests (
    player_id, claim_date, amount_pgt, claimed_at, 
    is_gamble_double, gamble_won, laser_multiplier
  )
  VALUES (
    v_pid, v_today, v_reward_pgt, NOW(),
    COALESCE(p_gamble_double, false), v_gamble_won, v_laser_mult
  );

  -- Credit PGT balance if reward > 0
  IF v_reward_pgt > 0 THEN
    v_new_balance := ROUND((COALESCE(v_user.balance_pgt, 0) + v_reward_pgt)::NUMERIC, 2);

    UPDATE public.users
    SET balance_pgt = v_new_balance,
        total_earned = ROUND((COALESCE(total_earned, 0) + v_reward_pgt)::NUMERIC, 2),
        updated_at = NOW()
    WHERE player_id = v_pid;
  ELSE
    v_new_balance := COALESCE(v_user.balance_pgt, 0);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'base_reward', v_base_reward,
    'laser_level', v_laser_level,
    'laser_mult', v_laser_mult,
    'laser_reward', v_laser_reward,
    'double_gamble', COALESCE(p_gamble_double, false),
    'gamble_won', v_gamble_won,
    'reward_pgt', v_reward_pgt,
    'new_balance', v_new_balance,
    'claims_today', v_claims_today + 1,
    'claims_remaining', GREATEST(0, v_max_daily - (v_claims_today + 1)),
    'max_daily', v_max_daily,
    'is_vip', v_is_vip,
    'is_jackpot', (v_reward_pgt >= 15.0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_polyspace_radar_harvest_status(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_polyspace_radar_harvest(TEXT, BOOLEAN) TO authenticated, anon;

-- ------------------------------------------------------------------------------
-- RPC: get_global_space_missions_count
-- Authoritative ecosystem counter for total completed PolySpace missions, raids,
-- world boss attacks, and radar harvests (replaces 20-entry missionLogs cap).
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_global_space_missions_count();
CREATE OR REPLACE FUNCTION public.get_global_space_missions_count()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_fleet_expeditions BIGINT := 0;
  v_raids_won BIGINT := 0;
  v_boss_attacks BIGINT := 0;
  v_radar_harvests BIGINT := 0;
BEGIN
  WITH ref_ops AS (
    SELECT
      downline_player_id,
      SUM(
        CASE
          WHEN action_type ~ '\((\d+)\s+Expedition' THEN (regexp_match(action_type, '\((\d+)\s+Expedition'))[1]::bigint
          ELSE 1
        END
      ) AS exp_count
    FROM (
      SELECT DISTINCT downline_player_id, action_type, created_at
      FROM public.referral_commissions
      WHERE action_type ILIKE 'PolySpace Fleet%'
    ) uniq
    GROUP BY downline_player_id
  )
  SELECT
    COALESCE(SUM(GREATEST(
      COALESCE((u.space_state->>'missionsCompleted')::bigint, 0),
      jsonb_array_length(COALESCE(u.space_state->'missionLogs', '[]'::jsonb)),
      COALESCE(ro.exp_count, 0)
    )), 0),
    COALESCE(SUM(COALESCE((u.space_state->>'raidsWon')::bigint, 0)), 0),
    COALESCE(SUM(COALESCE((u.space_state->>'bossAttacksCount')::bigint, 0)), 0)
  INTO v_fleet_expeditions, v_raids_won, v_boss_attacks
  FROM public.users u
  LEFT JOIN ref_ops ro ON LOWER(ro.downline_player_id) = LOWER(u.player_id)
  WHERE u.space_state IS NOT NULL
    AND COALESCE(u.is_banned, false) = false;

  SELECT COUNT(*) INTO v_radar_harvests FROM public.polyspace_radar_harvests;

  RETURN jsonb_build_object(
    'total_missions', (v_fleet_expeditions + v_raids_won + v_boss_attacks + v_radar_harvests),
    'fleet_expeditions', v_fleet_expeditions,
    'raids_won', v_raids_won,
    'boss_attacks', v_boss_attacks,
    'radar_harvests', v_radar_harvests
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_global_space_missions_count() TO authenticated, anon;
