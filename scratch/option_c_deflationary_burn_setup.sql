-- ============================================================
-- POLYGAME OPTION C: 50% DEFLATIONARY BURN / 50% TREASURY SYSTEM
-- Configures 50% Token Burn (0x0000...dEaD) & 50% Treasury Pool
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Create global_burn_metrics table if not exists
CREATE TABLE IF NOT EXISTS global_burn_metrics (
  id INT PRIMARY KEY DEFAULT 1,
  total_burned_pgt NUMERIC DEFAULT 0,
  total_treasury_pgt NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO global_burn_metrics (id, total_burned_pgt, total_treasury_pgt)
VALUES (1, 0, 0)
ON CONFLICT (id) DO NOTHING;

-- RPC to record PGT burn & treasury allocation
CREATE OR REPLACE FUNCTION record_pgt_burn(
  p_amount NUMERIC,
  p_source TEXT DEFAULT 'deposit'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_burn NUMERIC;
  v_treasury NUMERIC;
  v_new_total_burn NUMERIC;
  v_new_total_treasury NUMERIC;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Invalid amount');
  END IF;

  v_burn := p_amount * 0.50;
  v_treasury := p_amount * 0.50;

  UPDATE global_burn_metrics
  SET total_burned_pgt = total_burned_pgt + v_burn,
      total_treasury_pgt = total_treasury_pgt + v_treasury,
      updated_at = NOW()
  WHERE id = 1
  RETURNING total_burned_pgt, total_treasury_pgt INTO v_new_total_burn, v_new_total_treasury;

  RETURN jsonb_build_object(
    'success', true,
    'burned', v_burn,
    'treasury', v_treasury,
    'total_burned', v_new_total_burn,
    'total_treasury', v_new_total_treasury,
    'burn_address', '0x000000000000000000000000000000000000dEaD',
    'treasury_address', '0x14791697260E4c9A71f18484C9f997B308e59325'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION record_pgt_burn(NUMERIC, TEXT) TO anon, authenticated, service_role;
