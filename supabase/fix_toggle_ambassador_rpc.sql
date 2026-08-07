-- ============================================================
-- POLYGAME: FIX TOGGLE AMBASSADOR RPC (v1.4.346)
-- Resolves target wallet using resolve_player_id(p_target_wallet)
-- ============================================================

CREATE OR REPLACE FUNCTION toggle_ambassador_status(
  p_target_wallet TEXT,
  p_is_ambassador BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player_id TEXT;
BEGIN
  p_target_wallet := LOWER(TRIM(p_target_wallet));

  -- Resolve target player ID using canonical identity helper
  SELECT resolve_player_id(p_target_wallet) INTO v_player_id;

  IF v_player_id IS NULL THEN
    -- Fallback lookup if resolve_player_id did not find a match
    SELECT player_id INTO v_player_id
    FROM users
    WHERE LOWER(player_id) = p_target_wallet 
       OR LOWER(linked_wallet_address) = p_target_wallet
    LIMIT 1;
  END IF;

  IF v_player_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Player not found in database'
    );
  END IF;

  UPDATE users
  SET is_ambassador = p_is_ambassador,
      updated_at = NOW()
  WHERE player_id = v_player_id;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_player_id,
    'is_ambassador', p_is_ambassador
  );
END;
$$;
