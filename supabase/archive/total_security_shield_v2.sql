-- ==============================================================================
-- POLYGAME TOTAL SECURITY SHIELD: ZERO-BALANCE REGISTRATION & HARDENED RPCS
-- ==============================================================================

-- Step 1: Hardened Anti-Cheat Trigger (Blocks balance inflation on INSERT & UPDATE)
CREATE OR REPLACE FUNCTION prevent_direct_balance_mutation()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Handle INSERT: When an account is created via REST API, FORCE balance to 0
  IF TG_OP = 'INSERT' THEN
    IF current_user IN ('anon', 'authenticated') THEN
      NEW.balance_pgt := 0.0;
      NEW.staked_balance_pgt := 0.0;
      NEW.staked_balance_1flr := 0.0;
      NEW.total_staking_yield := 0.0;
    END IF;
    RETURN NEW;

  -- Handle UPDATE: When an existing account is edited via REST API, LOCK balance to OLD state
  ELSIF TG_OP = 'UPDATE' THEN
    IF current_user IN ('anon', 'authenticated') THEN
      NEW.balance_pgt := OLD.balance_pgt;
      NEW.staked_balance_pgt := OLD.staked_balance_pgt;
      NEW.staked_balance_1flr := OLD.staked_balance_1flr;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_direct_balance_update ON users;
DROP TRIGGER IF EXISTS trg_prevent_direct_balance_insert ON users;
DROP TRIGGER IF EXISTS trg_prevent_direct_balance_mutation ON users;

CREATE TRIGGER trg_prevent_direct_balance_mutation
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION prevent_direct_balance_mutation();

-- Step 2: Hard-Cap `credit_arcade_payout` to Max 100 PGT per call (Eliminates Billion-PGT RPC injection)
CREATE OR REPLACE FUNCTION credit_arcade_payout(
  p_player_id TEXT DEFAULT NULL,
  p_amount NUMERIC DEFAULT 0,
  p_wallet TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_raw_id TEXT := COALESCE(p_player_id, p_wallet);
  v_pid TEXT;
  v_capped_amount NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  IF v_raw_id IS NULL OR v_raw_id = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Player ID or wallet required');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid amount');
  END IF;

  -- HARD SAFETY CAP: Never allow more than 100 PGT via fallback credit_arcade_payout
  v_capped_amount := LEAST(p_amount, 100.0);
  v_pid := resolve_player_id(v_raw_id);

  UPDATE users
  SET balance_pgt = COALESCE(balance_pgt, 0) + v_capped_amount,
      total_earned = COALESCE(total_earned, 0) + v_capped_amount,
      updated_at = NOW()
  WHERE LOWER(player_id) = LOWER(v_pid)
  RETURNING balance_pgt INTO v_new_balance;

  IF NOT FOUND THEN
    UPDATE users
    SET balance_pgt = COALESCE(balance_pgt, 0) + v_capped_amount,
        total_earned = COALESCE(total_earned, 0) + v_capped_amount,
        updated_at = NOW()
    WHERE LOWER(COALESCE(linked_wallet_address, '')) = LOWER(v_raw_id) 
       OR LOWER(player_id) = LOWER(v_raw_id)
    RETURNING balance_pgt INTO v_new_balance;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

GRANT EXECUTE ON FUNCTION credit_arcade_payout(TEXT, NUMERIC, TEXT) TO anon, authenticated, service_role;

-- Step 3: Reset the cheater's balance and high scores to 0 immediately
UPDATE users 
SET 
  balance_pgt = 0.0,
  staked_balance_pgt = 0.0,
  total_earned = 0.0,
  game_highscore = 0,
  invaders_highscore = 0,
  drift_highscore = 0,
  catcher_highscore = 0,
  updated_at = NOW()
WHERE 
  LOWER(player_id) LIKE LOWER('%0x38f7%')
  OR LOWER(COALESCE(linked_wallet_address, '')) LIKE LOWER('%0x38f7%');
