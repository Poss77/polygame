-- ==============================================================================
-- ADD ONSITE NFT PURCHASE RPC: buy_onsite_nft
-- Allows purchasing on-site utility NFTs (e.g. nft_relic_seeker) with PGT balance
-- ==============================================================================

CREATE OR REPLACE FUNCTION buy_onsite_nft(p_wallet TEXT, p_nft_id TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pid TEXT := resolve_player_id(p_wallet);
  v_balance NUMERIC;
  v_cost NUMERIC;
  v_existing_nfts JSONB;
  v_crate_nfts JSONB;
  v_nft_name TEXT;
BEGIN
  IF p_nft_id = 'nft_relic_seeker' THEN
    v_cost := 1000000.0;
    v_nft_name := 'Quantum Relic Seeker';
  ELSE
    RETURN json_build_object('success', false, 'error', 'Unknown on-site NFT identifier');
  END IF;

  SELECT balance_pgt, COALESCE(owned_nfts, '[]'::jsonb), COALESCE(crate_nfts, '[]'::jsonb)
  INTO v_balance, v_existing_nfts, v_crate_nfts
  FROM users
  WHERE LOWER(player_id) = LOWER(v_pid)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Player profile not found');
  END IF;

  -- Check if already owned in owned_nfts or crate_nfts
  IF (v_existing_nfts @> jsonb_build_array(p_nft_id)) OR (v_crate_nfts @> jsonb_build_array(p_nft_id)) THEN
    RETURN json_build_object('success', false, 'error', 'You already own this NFT!');
  END IF;

  IF v_balance < v_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient PGT balance (Requires 1,000,000 PGT)');
  END IF;

  -- Append to crate_nfts
  v_crate_nfts := v_crate_nfts || jsonb_build_array(p_nft_id);

  UPDATE users
  SET balance_pgt = balance_pgt - v_cost,
      crate_nfts = v_crate_nfts,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid)
     OR LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_pid);

  RETURN json_build_object(
    'success', true,
    'nft_id', p_nft_id,
    'nft_name', v_nft_name,
    'new_balance', v_balance - v_cost,
    'crate_nfts', v_crate_nfts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION buy_onsite_nft(TEXT, TEXT) TO anon, authenticated, service_role;

