-- ====================================================================
-- POLYGAME: UNSTAKE ALL MATURED YIELD TRACKING IN SUPABASE RPC
-- ====================================================================

-- Update unstake_all_matured RPC to increment total_staking_yield upon unstaking
CREATE OR REPLACE FUNCTION unstake_all_matured(
  p_wallet TEXT,
  p_pool TEXT
) RETURNS json 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stake user_stakes%ROWTYPE;
  v_yield NUMERIC;
  v_total_payback NUMERIC := 0;
  v_total_principal NUMERIC := 0;
  v_yield_portion NUMERIC := 0;
  v_now TIMESTAMPTZ := now();
  v_seconds NUMERIC;
  v_count INTEGER := 0;
BEGIN
  p_wallet := lower(p_wallet);

  FOR v_stake IN 
    SELECT * FROM user_stakes 
    WHERE lower(wallet_address) = p_wallet 
      AND pool = p_pool 
      AND active = true 
      AND lock_until <= v_now 
    FOR UPDATE 
  LOOP
    v_seconds := EXTRACT(EPOCH FROM (v_now - v_stake.last_harvest));
    v_yield := v_stake.amount * (v_stake.apy / 100.0) * (v_seconds / (365 * 24 * 3600.0));
    IF v_yield < 0 THEN v_yield := 0; END IF;
    
    v_total_payback := v_total_payback + v_stake.amount + v_yield;
    v_total_principal := v_total_principal + v_stake.amount;
    UPDATE user_stakes SET active = false, last_harvest = v_now WHERE id = v_stake.id;
    v_count := v_count + 1;
  END LOOP;

  v_yield_portion := GREATEST(0, v_total_payback - v_total_principal);

  IF v_total_payback > 0 THEN
    IF p_pool = 'pgt' THEN
      UPDATE users 
      SET balance_pgt = COALESCE(balance_pgt, 0) + v_total_payback,
          staked_balance_pgt = GREATEST(0, COALESCE(staked_balance_pgt, 0) - v_total_principal),
          total_staking_yield = COALESCE(total_staking_yield, 0) + v_yield_portion,
          updated_at = NOW()
      WHERE lower(wallet_address) = p_wallet;
    ELSE
      UPDATE users 
      SET balance_1flr = COALESCE(balance_1flr, 0) + v_total_payback,
          staked_balance_1flr = GREATEST(0, COALESCE(staked_balance_1flr, 0) - v_total_principal),
          total_staking_yield = COALESCE(total_staking_yield, 0) + v_yield_portion,
          updated_at = NOW()
      WHERE lower(wallet_address) = p_wallet;
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'count', v_count, 'payback', v_total_payback, 'yield', v_yield_portion);
END;
$$;

GRANT EXECUTE ON FUNCTION unstake_all_matured(TEXT, TEXT) TO anon, authenticated, service_role;
