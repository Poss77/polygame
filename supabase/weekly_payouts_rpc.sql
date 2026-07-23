-- ====================================================================
-- SUPABASE RPC: Automated & Manual Weekly Prize Distribution System
-- ====================================================================

CREATE OR REPLACE FUNCTION distribute_weekly_prizes()
RETURNS JSONB AS $$
DECLARE
  rec RECORD;
  idx INT := 0;
  prize NUMERIC;
  w1_addr TEXT := NULL;
  w2_addr TEXT := NULL;
  w3_addr TEXT := NULL;
  w1_prize NUMERIC := 250.0;
  w2_prize NUMERIC := 150.0;
  w3_prize NUMERIC := 100.0;
  summary JSONB;
BEGIN
  -- Iterate through Top 3 distinct winners over the past 7 days
  FOR rec IN (
    SELECT DISTINCT ON (lower(wallet_address)) 
      lower(wallet_address) AS wallet_address, 
      payout, 
      game 
    FROM bet_wins 
    WHERE created_at >= NOW() - INTERVAL '7 days' AND payout > 0 
    ORDER BY lower(wallet_address), payout DESC 
    LIMIT 3
  ) LOOP
    idx := idx + 1;
    IF idx = 1 THEN
      w1_addr := rec.wallet_address;
      prize := w1_prize;
    ELSIF idx = 2 THEN
      w2_addr := rec.wallet_address;
      prize := w2_prize;
    ELSIF idx = 3 THEN
      w3_addr := rec.wallet_address;
      prize := w3_prize;
    END IF;

    -- Credit winner's balance
    UPDATE users SET balance_pgt = balance_pgt + prize WHERE lower(wallet_address) = rec.wallet_address;
  END LOOP;

  summary := jsonb_build_object(
    'success', true,
    'rank1', w1_addr,
    'rank1_prize', w1_prize,
    'rank2', w2_addr,
    'rank2_prize', w2_prize,
    'rank3', w3_addr,
    'rank3_prize', w3_prize
  );

  RETURN summary;
END;
$$ LANGUAGE plpgsql;
