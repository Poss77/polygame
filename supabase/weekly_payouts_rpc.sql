-- ====================================================================
-- SUPABASE RPC: 50,000 PGT Weekly Prize Pool Distribution System (Top 100 Non-Zero Players)
-- ====================================================================

CREATE OR REPLACE FUNCTION distribute_weekly_prizes()
RETURNS JSONB AS $$
DECLARE
  rec RECORD;
  idx INT := 0;
  prize NUMERIC;
  total_distributed NUMERIC := 0;
  w1_addr TEXT := NULL;
  w2_addr TEXT := NULL;
  w3_addr TEXT := NULL;
  summary JSONB;
BEGIN
  -- Iterate through Top 100 non-zero score players
  FOR rec IN (
    SELECT lower(wallet_address) AS wallet_address, game_highscore 
    FROM users 
    WHERE game_highscore > 0 OR invaders_highscore > 0
    ORDER BY game_highscore DESC 
    LIMIT 100
  ) LOOP
    idx := idx + 1;
    
    IF idx = 1 THEN
      prize := 15000;
      w1_addr := rec.wallet_address;
    ELSIF idx = 2 THEN
      prize := 8000;
      w2_addr := rec.wallet_address;
    ELSIF idx = 3 THEN
      prize := 4000;
      w3_addr := rec.wallet_address;
    ELSIF idx <= 10 THEN
      prize := 1000;
    ELSIF idx <= 25 THEN
      prize := 400;
    ELSIF idx <= 50 THEN
      prize := 200;
    ELSIF idx <= 100 THEN
      prize := 100;
    ELSE
      prize := 0;
    END IF;

    IF prize > 0 THEN
      UPDATE users SET balance_pgt = balance_pgt + prize WHERE lower(wallet_address) = rec.wallet_address;
      total_distributed := total_distributed + prize;
    END IF;
  END LOOP;

  summary := jsonb_build_object(
    'success', true,
    'total_winners', idx,
    'total_distributed', total_distributed,
    'rank1', w1_addr,
    'rank1_prize', 15000,
    'rank2', w2_addr,
    'rank2_prize', 8000,
    'rank3', w3_addr,
    'rank3_prize', 4000
  );

  RETURN summary;
END;
$$ LANGUAGE plpgsql;
