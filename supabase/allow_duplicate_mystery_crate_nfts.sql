-- ==============================================================================
-- POLYGON GAMING: MYSTERY CRATE DUPLICATE NFT ACCUMULATION
-- Migration: allow_duplicate_mystery_crate_nfts.sql
-- ==============================================================================
-- 1. Permits unboxing multiple copies of the same Utility Core NFT from the
--    PGT Cyber Mystery Crate and POL Quantum Crate.
-- 2. Appends unboxed items directly to `crate_nfts` JSONB array (e.g. x2, x3).
-- 3. Returns the updated `crate_nfts` array to the client for immediate UI sync.
-- 4. Preserves unique-core multiplier behavior (clean non-inflationary boost model).
-- ==============================================================================

-- 1. PGT Cyber Mystery Crate (1,000 PGT)
DROP FUNCTION IF EXISTS public.open_pgt_mystery_box(TEXT);
DROP FUNCTION IF EXISTS open_pgt_mystery_box(TEXT);

CREATE OR REPLACE FUNCTION public.open_pgt_mystery_box(p_wallet TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_balance NUMERIC;
  v_cost NUMERIC := 1000.0;
  v_rand INT;
  v_reward_pgt NUMERIC := 0;
  v_nft_id TEXT := NULL;
  v_nft_name TEXT := NULL;
  v_crate_nfts JSONB;
  v_nft_pool TEXT[] := ARRAY['nft_rare_shield', 'nft_pulse_blaster', 'nft_gold_turbine', 'nft_epic_yield', 'nft_silver_charger'];
  v_nft_names TEXT[] := ARRAY['Viper Shield', 'Pulse Blaster', 'Gold Turbine', 'Apex Matrix', 'Silver Charger'];
  v_chosen_idx INT;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN json_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT balance_pgt, COALESCE(crate_nfts, '[]'::jsonb)
  INTO v_balance, v_crate_nfts
  FROM public.users
  WHERE player_id = v_pid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Player profile not found');
  END IF;

  IF v_balance < v_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient PGT balance (1,000 PGT required)');
  END IF;

  -- Deduct PGT cost (1,000 PGT) atomically
  UPDATE public.users
  SET balance_pgt = balance_pgt - v_cost,
      updated_at = NOW()
  WHERE player_id = v_pid;

  -- Roll reward (1..100)
  v_rand := floor(random() * 100 + 1)::INT;

  IF v_rand <= 99 THEN
    -- 99% chance: PGT Token Return (200 to 1,500 PGT, Average = 850 PGT / 85% return)
    v_reward_pgt := round((200 + (random() * 1300))::numeric, 2);
    
    UPDATE public.users
    SET balance_pgt = balance_pgt + v_reward_pgt,
        updated_at = NOW()
    WHERE player_id = v_pid;

    RETURN json_build_object(
      'success', true,
      'reward_type', 'pgt',
      'reward_pgt', v_reward_pgt,
      'new_balance', v_balance - v_cost + v_reward_pgt,
      'crate_nfts', v_crate_nfts
    );
  ELSE
    -- 1% chance: Ultra-Rare Utility Core NFT Reward
    v_chosen_idx := floor(random() * array_length(v_nft_pool, 1) + 1)::INT;
    v_nft_id := v_nft_pool[v_chosen_idx];
    v_nft_name := v_nft_names[v_chosen_idx];

    -- Append unboxed NFT to player's crate_nfts (allows duplicates: x2, x3, etc.)
    v_crate_nfts := v_crate_nfts || jsonb_build_array(v_nft_id);

    UPDATE public.users
    SET crate_nfts = v_crate_nfts,
        updated_at = NOW()
    WHERE player_id = v_pid;

    RETURN json_build_object(
      'success', true,
      'reward_type', 'nft',
      'nft_id', v_nft_id,
      'nft_name', v_nft_name,
      'new_balance', v_balance - v_cost,
      'crate_nfts', v_crate_nfts
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.open_pgt_mystery_box(TEXT) TO anon, authenticated, service_role;


-- 2. POL Quantum Mystery Crate (50 POL)
DROP FUNCTION IF EXISTS public.open_pol_mystery_box(TEXT, TEXT);
DROP FUNCTION IF EXISTS open_pol_mystery_box(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.open_pol_mystery_box(p_wallet TEXT, p_tx_hash TEXT DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_guard RECORD;
  v_pid TEXT;
  v_balance NUMERIC;
  v_rand INT;
  v_reward_pgt NUMERIC := 0;
  v_nft_id TEXT := NULL;
  v_nft_name TEXT := NULL;
  v_crate_nfts JSONB;
  v_nft_pool TEXT[] := ARRAY['nft_epic_yield', 'nft_gold_turbine', 'nft_pulse_blaster'];
  v_nft_names TEXT[] := ARRAY['Apex Matrix', 'Gold Turbine', 'Pulse Blaster'];
  v_chosen_idx INT;
BEGIN
  -- Authenticate caller & anti-framing guard
  v_guard := public.assert_caller_player_id(p_wallet);
  IF v_guard.p_status <> 'OK' THEN
    RETURN json_build_object('success', false, 'error', v_guard.p_error_msg);
  END IF;
  v_pid := v_guard.p_player_id;

  SELECT balance_pgt, COALESCE(crate_nfts, '[]'::jsonb)
  INTO v_balance, v_crate_nfts
  FROM public.users
  WHERE player_id = v_pid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Player profile not found');
  END IF;

  v_rand := floor(random() * 100 + 1)::INT;

  IF v_rand <= 50 THEN
    -- 50% chance: Large PGT Bonus (2,000 to 10,000 PGT)
    v_reward_pgt := round((2000 + (random() * 8000))::numeric, 2);
    
    UPDATE public.users
    SET balance_pgt = balance_pgt + v_reward_pgt,
        updated_at = NOW()
    WHERE player_id = v_pid;

    RETURN json_build_object(
      'success', true,
      'reward_type', 'pgt',
      'reward_pgt', v_reward_pgt,
      'new_balance', v_balance + v_reward_pgt,
      'crate_nfts', v_crate_nfts
    );
  ELSE
    -- 50% chance: Epic/Legendary NFT Reward
    v_chosen_idx := floor(random() * array_length(v_nft_pool, 1) + 1)::INT;
    v_nft_id := v_nft_pool[v_chosen_idx];
    v_nft_name := v_nft_names[v_chosen_idx];

    -- Append unboxed NFT to player's crate_nfts (allows duplicates: x2, x3, etc.)
    v_crate_nfts := v_crate_nfts || jsonb_build_array(v_nft_id);

    UPDATE public.users
    SET crate_nfts = v_crate_nfts,
        updated_at = NOW()
    WHERE player_id = v_pid;

    RETURN json_build_object(
      'success', true,
      'reward_type', 'nft',
      'nft_id', v_nft_id,
      'nft_name', v_nft_name,
      'new_balance', v_balance,
      'crate_nfts', v_crate_nfts
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.open_pol_mystery_box(TEXT, TEXT) TO anon, authenticated, service_role;
