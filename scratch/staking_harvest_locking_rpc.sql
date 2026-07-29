-- ============================================================
-- POLYGAME STAKING HARVEST ATOMIC LOCKING & RE-ENTRANCY GUARD RPC
-- Enforces PostgreSQL atomic FOR UPDATE row locking across harvest_yield
-- and harvest_all_yield so double-harvesting is 100% IMPOSSIBLE!
-- Run this script in your Supabase SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION harvest_yield(p_wallet TEXT, p_stake_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_stakes JSONB;
  v_updated_stakes JSONB := '[]'::jsonb;
  v_elem JSONB;
  v_yield NUMERIC := 0;
  v_target_found BOOLEAN := FALSE;
  v_stake_id TEXT;
  v_last_harvest BIGINT;
  v_amount NUMERIC;
  v_apy NUMERIC;
  v_now_ms BIGINT;
  v_elapsed_sec NUMERIC;
  v_pool TEXT;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));
  v_now_ms := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;

  -- 1. Atomic Row Lock on User Record
  SELECT * INTO v_user
  FROM users
  WHERE LOWER(wallet_address) = p_wallet OR LOWER(linked_wallet_address) = p_wallet
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  v_stakes := COALESCE(v_user.stakes, '[]'::jsonb);

  -- 2. Loop through JSONB stakes array
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_stakes) LOOP
    v_stake_id := COALESCE(v_elem->>'id', '');
    
    IF v_stake_id = p_stake_id THEN
      v_target_found := TRUE;
      v_amount := COALESCE((v_elem->>'amount')::NUMERIC, 0);
      v_apy := COALESCE((v_elem->>'apy')::NUMERIC, 1.0);
      v_last_harvest := COALESCE((v_elem->>'lastHarvest')::BIGINT, (v_elem->>'createdAt')::BIGINT, v_now_ms);
      v_pool := COALESCE(v_elem->>'pool', 'pgt');

      v_elapsed_sec := GREATEST(0, (v_now_ms - v_last_harvest) / 1000.0);
      v_yield := (v_amount * (v_apy / 100.0) * (v_elapsed_sec / 31536000.0));

      IF v_yield > 0.0001 THEN
        -- Reset interest and set lastHarvest to now
        v_elem := jsonb_set(v_elem, '{interest}', '0.0'::jsonb);
        v_elem := jsonb_set(v_elem, '{lastHarvest}', to_jsonb(v_now_ms));
      ELSE
        v_yield := 0;
      END IF;
    END IF;

    v_updated_stakes := v_updated_stakes || jsonb_build_array(v_elem);
  END LOOP;

  IF NOT v_target_found OR v_yield <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No yield to harvest');
  END IF;

  -- 3. Atomic Update User Balance & Stakes
  UPDATE users
  SET balance_pgt = balance_pgt + v_yield,
      stakes = v_updated_stakes,
      updated_at = NOW()
  WHERE LOWER(wallet_address) = LOWER(v_user.wallet_address);

  RETURN jsonb_build_object(
    'success', true, 
    'yield', v_yield, 
    'message', 'Yield harvested successfully'
  );
END;
$$;

CREATE OR REPLACE FUNCTION harvest_all_yield(p_wallet TEXT, p_pool TEXT DEFAULT 'pgt')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_stakes JSONB;
  v_updated_stakes JSONB := '[]'::jsonb;
  v_elem JSONB;
  v_total_yield NUMERIC := 0;
  v_item_yield NUMERIC := 0;
  v_last_harvest BIGINT;
  v_amount NUMERIC;
  v_apy NUMERIC;
  v_now_ms BIGINT;
  v_elapsed_sec NUMERIC;
BEGIN
  p_wallet := LOWER(TRIM(p_wallet));
  v_now_ms := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;

  -- 1. Atomic Row Lock on User Record
  SELECT * INTO v_user
  FROM users
  WHERE LOWER(wallet_address) = p_wallet OR LOWER(linked_wallet_address) = p_wallet
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  v_stakes := COALESCE(v_user.stakes, '[]'::jsonb);

  -- 2. Loop through all JSONB stakes positions
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_stakes) LOOP
    v_amount := COALESCE((v_elem->>'amount')::NUMERIC, 0);
    v_apy := COALESCE((v_elem->>'apy')::NUMERIC, 1.0);
    v_last_harvest := COALESCE((v_elem->>'lastHarvest')::BIGINT, (v_elem->>'createdAt')::BIGINT, v_now_ms);

    v_elapsed_sec := GREATEST(0, (v_now_ms - v_last_harvest) / 1000.0);
    v_item_yield := (v_amount * (v_apy / 100.0) * (v_elapsed_sec / 31536000.0));

    IF v_item_yield > 0.0001 THEN
      v_total_yield := v_total_yield + v_item_yield;
      v_elem := jsonb_set(v_elem, '{interest}', '0.0'::jsonb);
      v_elem := jsonb_set(v_elem, '{lastHarvest}', to_jsonb(v_now_ms));
    END IF;

    v_updated_stakes := v_updated_stakes || jsonb_build_array(v_elem);
  END LOOP;

  IF v_total_yield <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No yield to harvest');
  END IF;

  -- 3. Update User Balance & Reset All Stakes
  UPDATE users
  SET balance_pgt = balance_pgt + v_total_yield,
      stakes = v_updated_stakes,
      updated_at = NOW()
  WHERE LOWER(wallet_address) = LOWER(v_user.wallet_address);

  RETURN jsonb_build_object(
    'success', true, 
    'total_yield', v_total_yield, 
    'message', 'All yield harvested successfully'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION harvest_yield(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION harvest_all_yield(TEXT, TEXT) TO anon, authenticated, service_role;
