CREATE TABLE IF NOT EXISTS user_stakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT REFERENCES users(wallet_address) ON DELETE CASCADE,
  pool TEXT NOT NULL, 
  amount NUMERIC NOT NULL,
  tier TEXT NOT NULL, 
  apy NUMERIC NOT NULL,
  staked_at TIMESTAMPTZ DEFAULT now(),
  lock_until TIMESTAMPTZ NOT NULL,
  last_harvest TIMESTAMPTZ DEFAULT now(),
  active BOOLEAN DEFAULT true
);

CREATE OR REPLACE FUNCTION get_user_stakes(
  p_wallet TEXT
) RETURNS json AS $$
DECLARE
  v_stakes json;
BEGIN
  SELECT json_agg(row_to_json(s)) INTO v_stakes
  FROM (
    SELECT id, pool, amount, tier, apy, 
           (EXTRACT(EPOCH FROM staked_at) * 1000) as "stakedAt",
           (EXTRACT(EPOCH FROM lock_until) * 1000) as "lockUntil",
           (EXTRACT(EPOCH FROM last_harvest) * 1000) as "lastHarvest",
           active
    FROM user_stakes
    WHERE wallet_address = p_wallet AND active = true
  ) s;
  
  RETURN json_build_object('success', true, 'stakes', COALESCE(v_stakes, '[]'::json));
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION deposit_stake(
  p_wallet TEXT,
  p_pool TEXT,
  p_amount NUMERIC,
  p_tier TEXT,
  p_apy NUMERIC,
  p_duration_ms BIGINT
) RETURNS json AS $$
DECLARE
  v_balance NUMERIC;
  v_now TIMESTAMPTZ := now();
  v_lock_until TIMESTAMPTZ;
  v_stake_id UUID;
BEGIN
  IF p_pool = 'pgt' THEN
    SELECT balance_pgt INTO v_balance FROM users WHERE wallet_address = p_wallet;
  ELSE
    SELECT balance_1flr INTO v_balance FROM users WHERE wallet_address = p_wallet;
  END IF;

  IF v_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  IF p_pool = 'pgt' THEN
    UPDATE users SET balance_pgt = balance_pgt - p_amount WHERE wallet_address = p_wallet;
  ELSE
    UPDATE users SET balance_1flr = balance_1flr - p_amount WHERE wallet_address = p_wallet;
  END IF;

  v_lock_until := v_now + (p_duration_ms || ' milliseconds')::interval;

  INSERT INTO user_stakes (wallet_address, pool, amount, tier, apy, staked_at, lock_until, last_harvest, active)
  VALUES (p_wallet, p_pool, p_amount, p_tier, p_apy, v_now, v_lock_until, v_now, true)
  RETURNING id INTO v_stake_id;

  RETURN json_build_object('success', true, 'stake_id', v_stake_id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION harvest_yield(
  p_wallet TEXT,
  p_stake_id UUID
) RETURNS json AS $$
DECLARE
  v_stake user_stakes%ROWTYPE;
  v_yield NUMERIC;
  v_now TIMESTAMPTZ := now();
  v_seconds NUMERIC;
BEGIN
  SELECT * INTO v_stake FROM user_stakes WHERE id = p_stake_id AND wallet_address = p_wallet AND active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Stake not found or inactive');
  END IF;

  v_seconds := EXTRACT(EPOCH FROM (v_now - v_stake.last_harvest));
  v_yield := v_stake.amount * (v_stake.apy / 100.0) * (v_seconds / (365 * 24 * 3600.0));

  IF v_yield < 0 THEN
    v_yield := 0;
  END IF;

  IF v_stake.pool = 'pgt' THEN
    UPDATE users SET balance_pgt = balance_pgt + v_yield WHERE wallet_address = p_wallet;
  ELSE
    UPDATE users SET balance_1flr = balance_1flr + v_yield WHERE wallet_address = p_wallet;
  END IF;

  UPDATE user_stakes SET last_harvest = v_now WHERE id = p_stake_id;

  RETURN json_build_object('success', true, 'yield', v_yield);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION harvest_all_yield(
  p_wallet TEXT,
  p_pool TEXT
) RETURNS json AS $$
DECLARE
  v_stake user_stakes%ROWTYPE;
  v_yield NUMERIC;
  v_total_yield NUMERIC := 0;
  v_now TIMESTAMPTZ := now();
  v_seconds NUMERIC;
BEGIN
  FOR v_stake IN SELECT * FROM user_stakes WHERE wallet_address = p_wallet AND pool = p_pool AND active = true LOOP
    v_seconds := EXTRACT(EPOCH FROM (v_now - v_stake.last_harvest));
    v_yield := v_stake.amount * (v_stake.apy / 100.0) * (v_seconds / (365 * 24 * 3600.0));
    
    IF v_yield > 0 THEN
      v_total_yield := v_total_yield + v_yield;
      UPDATE user_stakes SET last_harvest = v_now WHERE id = v_stake.id;
    END IF;
  END LOOP;

  IF v_total_yield > 0 THEN
    IF p_pool = 'pgt' THEN
      UPDATE users SET balance_pgt = balance_pgt + v_total_yield WHERE wallet_address = p_wallet;
    ELSE
      UPDATE users SET balance_1flr = balance_1flr + v_total_yield WHERE wallet_address = p_wallet;
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'total_yield', v_total_yield);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION unstake_position(
  p_wallet TEXT,
  p_stake_id UUID
) RETURNS json AS $$
DECLARE
  v_stake user_stakes%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_seconds NUMERIC;
  v_yield NUMERIC;
  v_total_payback NUMERIC;
BEGIN
  SELECT * INTO v_stake FROM user_stakes WHERE id = p_stake_id AND wallet_address = p_wallet AND active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Stake not found or already inactive');
  END IF;

  IF v_now < v_stake.lock_until THEN
    RETURN json_build_object('success', false, 'error', 'Stake is locked');
  END IF;

  v_seconds := EXTRACT(EPOCH FROM (v_now - v_stake.last_harvest));
  v_yield := v_stake.amount * (v_stake.apy / 100.0) * (v_seconds / (365 * 24 * 3600.0));
  
  IF v_yield < 0 THEN v_yield := 0; END IF;

  v_total_payback := v_stake.amount + v_yield;

  IF v_stake.pool = 'pgt' THEN
    UPDATE users SET balance_pgt = balance_pgt + v_total_payback WHERE wallet_address = p_wallet;
  ELSE
    UPDATE users SET balance_1flr = balance_1flr + v_total_payback WHERE wallet_address = p_wallet;
  END IF;

  UPDATE user_stakes SET active = false, last_harvest = v_now WHERE id = p_stake_id;

  RETURN json_build_object('success', true, 'payback', v_total_payback, 'yield', v_yield);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION unstake_all_matured(
  p_wallet TEXT,
  p_pool TEXT
) RETURNS json AS $$
DECLARE
  v_stake user_stakes%ROWTYPE;
  v_yield NUMERIC;
  v_total_payback NUMERIC := 0;
  v_now TIMESTAMPTZ := now();
  v_seconds NUMERIC;
  v_count INTEGER := 0;
BEGIN
  FOR v_stake IN SELECT * FROM user_stakes WHERE wallet_address = p_wallet AND pool = p_pool AND active = true AND lock_until <= v_now LOOP
    v_seconds := EXTRACT(EPOCH FROM (v_now - v_stake.last_harvest));
    v_yield := v_stake.amount * (v_stake.apy / 100.0) * (v_seconds / (365 * 24 * 3600.0));
    IF v_yield < 0 THEN v_yield := 0; END IF;
    
    v_total_payback := v_total_payback + v_stake.amount + v_yield;
    UPDATE user_stakes SET active = false, last_harvest = v_now WHERE id = v_stake.id;
    v_count := v_count + 1;
  END LOOP;

  IF v_total_payback > 0 THEN
    IF p_pool = 'pgt' THEN
      UPDATE users SET balance_pgt = balance_pgt + v_total_payback WHERE wallet_address = p_wallet;
    ELSE
      UPDATE users SET balance_1flr = balance_1flr + v_total_payback WHERE wallet_address = p_wallet;
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'count', v_count, 'payback', v_total_payback);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fast_forward_staking_locks(
  p_wallet TEXT,
  p_pool TEXT
) RETURNS json AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  UPDATE user_stakes 
  SET lock_until = v_now + INTERVAL '60 seconds'
  WHERE wallet_address = p_wallet AND pool = p_pool AND active = true;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
