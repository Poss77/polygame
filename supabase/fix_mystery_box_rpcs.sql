-- ============================================================
-- POLYGAME MYSTERY CRATE RPC FIX SCRIPT
-- Fixes open_pgt_mystery_box and open_pol_mystery_box to use
-- resolve_player_id(p_wallet) instead of missing wallet_address column
-- ============================================================

DROP FUNCTION IF EXISTS open_pgt_mystery_box(TEXT);
CREATE OR REPLACE FUNCTION open_pgt_mystery_box(p_wallet TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_balance NUMERIC;
  v_cost NUMERIC := 1000.0;
  v_rand INT;
  v_reward_pgt NUMERIC := 0;
  v_nft_id TEXT := NULL;
  v_nft_name TEXT := NULL;
  v_existing_nfts JSONB;
  v_crate_nfts JSONB;
  v_nft_pool TEXT[] := ARRAY['nft_rare_shield', 'nft_pulse_blaster', 'nft_gold_turbine', 'nft_quantum_core', 'nft_hyper_drive'];
  v_nft_names TEXT[] := ARRAY['Quantum Aegis Shield', 'Pulse Blaster Core', 'Gold Turbine Engine', 'Quantum Core Reactor', 'Hyper Drive Thruster'];
  v_chosen_idx INT;
BEGIN
  SELECT balance_pgt, COALESCE(owned_nfts, '[]'::jsonb), COALESCE(crate_nfts, '[]'::jsonb)
  INTO v_balance, v_existing_nfts, v_crate_nfts
  FROM users
  WHERE LOWER(player_id) = LOWER(v_pid)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Player profile not found');
  END IF;

  IF v_balance < v_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient PGT balance (1,000 PGT required)');
  END IF;

  -- Deduct PGT cost atomically
  UPDATE users
  SET balance_pgt = balance_pgt - v_cost,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);

  -- Roll reward (1..100)
  v_rand := floor(random() * 100 + 1)::INT;

  IF v_rand <= 65 THEN
    -- 65% chance: PGT Token Reward (250 to 2,500 PGT)
    v_reward_pgt := round((250 + (random() * 2250))::numeric, 2);
    
    UPDATE users
    SET balance_pgt = balance_pgt + v_reward_pgt,
        updated_at = NOW()
    WHERE LOWER(player_id) = LOWER(v_pid)
       OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);

    RETURN json_build_object(
      'success', true,
      'reward_type', 'pgt',
      'reward_pgt', v_reward_pgt,
      'new_balance', v_balance - v_cost + v_reward_pgt
    );
  ELSE
    -- 35% chance: NFT Item Reward
    v_chosen_idx := floor(random() * array_length(v_nft_pool, 1) + 1)::INT;
    v_nft_id := v_nft_pool[v_chosen_idx];
    v_nft_name := v_nft_names[v_chosen_idx];

    -- Append unboxed NFT to player's owned_nfts & crate_nfts
    IF NOT (v_existing_nfts @> jsonb_build_array(v_nft_id)) THEN
      v_existing_nfts := v_existing_nfts || jsonb_build_array(v_nft_id);
    END IF;

    IF NOT (v_crate_nfts @> jsonb_build_array(v_nft_id)) THEN
      v_crate_nfts := v_crate_nfts || jsonb_build_array(v_nft_id);
    END IF;

    UPDATE users
    SET owned_nfts = v_existing_nfts,
        crate_nfts = v_crate_nfts,
        updated_at = NOW()
    WHERE LOWER(player_id) = LOWER(v_pid)
       OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);

    RETURN json_build_object(
      'success', true,
      'reward_type', 'nft',
      'nft_id', v_nft_id,
      'nft_name', v_nft_name,
      'new_balance', v_balance - v_cost
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION open_pgt_mystery_box(TEXT) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS open_pol_mystery_box(TEXT, TEXT);
CREATE OR REPLACE FUNCTION open_pol_mystery_box(p_wallet TEXT, p_tx_hash TEXT DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_balance NUMERIC;
  v_rand INT;
  v_reward_pgt NUMERIC := 0;
  v_nft_id TEXT := NULL;
  v_nft_name TEXT := NULL;
  v_existing_nfts JSONB;
  v_crate_nfts JSONB;
  v_nft_pool TEXT[] := ARRAY['nft_quantum_core', 'nft_hyper_drive', 'nft_gold_turbine'];
  v_nft_names TEXT[] := ARRAY['Quantum Core Reactor', 'Hyper Drive Thruster', 'Gold Turbine Engine'];
  v_chosen_idx INT;
BEGIN
  SELECT balance_pgt, COALESCE(owned_nfts, '[]'::jsonb), COALESCE(crate_nfts, '[]'::jsonb)
  INTO v_balance, v_existing_nfts, v_crate_nfts
  FROM users
  WHERE LOWER(player_id) = LOWER(v_pid)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Player profile not found');
  END IF;

  v_rand := floor(random() * 100 + 1)::INT;

  IF v_rand <= 50 THEN
    -- 50% chance: Large PGT Bonus (2,000 to 10,000 PGT)
    v_reward_pgt := round((2000 + (random() * 8000))::numeric, 2);
    
    UPDATE users
    SET balance_pgt = balance_pgt + v_reward_pgt,
        updated_at = NOW()
    WHERE LOWER(player_id) = LOWER(v_pid)
       OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);

    RETURN json_build_object(
      'success', true,
      'reward_type', 'pgt',
      'reward_pgt', v_reward_pgt,
      'new_balance', v_balance + v_reward_pgt
    );
  ELSE
    -- 50% chance: Epic/Legendary NFT Reward
    v_chosen_idx := floor(random() * array_length(v_nft_pool, 1) + 1)::INT;
    v_nft_id := v_nft_pool[v_chosen_idx];
    v_nft_name := v_nft_names[v_chosen_idx];

    IF NOT (v_existing_nfts @> jsonb_build_array(v_nft_id)) THEN
      v_existing_nfts := v_existing_nfts || jsonb_build_array(v_nft_id);
    END IF;

    IF NOT (v_crate_nfts @> jsonb_build_array(v_nft_id)) THEN
      v_crate_nfts := v_crate_nfts || jsonb_build_array(v_nft_id);
    END IF;

    UPDATE users
    SET owned_nfts = v_existing_nfts,
        crate_nfts = v_crate_nfts,
        updated_at = NOW()
    WHERE LOWER(player_id) = LOWER(v_pid)
       OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);

    RETURN json_build_object(
      'success', true,
      'reward_type', 'nft',
      'nft_id', v_nft_id,
      'nft_name', v_nft_name,
      'new_balance', v_balance
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION open_pol_mystery_box(TEXT, TEXT) TO anon, authenticated, service_role;
