-- POLYGAME: FIX DELETE USER ACCOUNT RPC (v1.4.450)
-- ============================================================
-- Fixes delete_user_account RPC to query player_id & linked_wallet_address (eliminating column "wallet_address" error)

CREATE OR REPLACE FUNCTION delete_user_account(
  p_user_id UUID DEFAULT NULL,
  p_wallet TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_pid TEXT;
  v_clean_wallet TEXT;
  v_deleted_count INT := 0;
BEGIN
  v_clean_wallet := LOWER(TRIM(COALESCE(p_wallet, '')));

  IF p_user_id IS NOT NULL THEN
    DELETE FROM users WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully by user_id.', 'deleted_rows', v_deleted_count);
  ELSIF v_clean_wallet <> '' THEN
    v_pid := resolve_player_id(v_clean_wallet);
    DELETE FROM users 
    WHERE LOWER(player_id) = v_clean_wallet 
       OR LOWER(player_id) = LOWER(v_pid)
       OR LOWER(COALESCE(linked_wallet_address, '')) = v_clean_wallet;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN jsonb_build_object('success', true, 'message', 'Account deleted successfully by wallet/player_id.', 'deleted_rows', v_deleted_count);
  ELSE
    RETURN jsonb_build_object('success', false, 'message', 'Missing user ID or wallet address.');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user_account(UUID, TEXT) TO anon, authenticated, service_role;
