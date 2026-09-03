-- ==============================================================================
-- POLYGON GAMING: RECOVER VEZUVIUSKING'S 10,278 PGT STAKING POSITION
-- ==============================================================================
-- Context:
-- During the account merge on 2026-09-02, source account (0xpgt6671633e...) had:
--   staked_balance_pgt: 10,278 PGT (Tier: year, Pool: pgt)
--   total_staking_yield: 0.07449 PGT
--   Staked at: 2026-09-02 16:23:03 UTC, Lock until: 2027-09-02 16:23:03 UTC
--
-- Target Primary Merged Account:
--   player_id: 0xpgt1340d9e6
--   linked_wallet_address: 0xfa437ab5ff649d3dffc687c05e4b3c145d0e836a
--   user_id: 1340d9e6-4ebf-4422-b115-e4da398857e5
--   username: Vezuvius King
-- ==============================================================================

-- 1. If any orphaned user_stakes records exist under the old player_id or EVM wallet, re-link them to the merged primary player_id
UPDATE public.user_stakes
SET wallet_address = '0xpgt1340d9e6',
    active = true
WHERE LOWER(wallet_address) IN (
    '0xpgt6671633e0000000000000000000000000000',
    '0xfa437ab5ff649d3dffc687c05e4b3c145d0e836a'
);

-- 2. If the user_stakes row was removed by cascade during the delete, re-insert the exact 10,278 PGT staking position
INSERT INTO public.user_stakes (
    wallet_address,
    pool,
    amount,
    tier,
    apy,
    staked_at,
    lock_until,
    last_harvest,
    active
)
SELECT 
    '0xpgt1340d9e6',
    'pgt',
    10278.0,
    'year',
    3.0,
    '2026-09-02 16:23:03+00'::timestamptz,
    '2027-09-02 16:23:03+00'::timestamptz,
    '2026-09-02 17:45:54+00'::timestamptz,
    true
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_stakes 
    WHERE LOWER(wallet_address) = '0xpgt1340d9e6' 
      AND pool = 'pgt' 
      AND active = true
);

-- 3. Update the primary user row with the restored staked balance and yield
UPDATE public.users
SET 
    staked_balance_pgt = (
        SELECT COALESCE(SUM(amount), 10278) 
        FROM public.user_stakes 
        WHERE LOWER(wallet_address) = '0xpgt1340d9e6' 
          AND pool = 'pgt' 
          AND active = true
    ),
    total_staking_yield = GREATEST(COALESCE(total_staking_yield, 0), 0.0744936616583362),
    updated_at = NOW()
WHERE LOWER(player_id) = '0xpgt1340d9e6' 
   OR LOWER(linked_wallet_address) = '0xfa437ab5ff649d3dffc687c05e4b3c145d0e836a'
   OR user_id = '1340d9e6-4ebf-4422-b115-e4da398857e5';

-- 4. Verification Check: Confirm the user profile and active stake position
SELECT 
    player_id, 
    username, 
    email, 
    linked_wallet_address, 
    balance_pgt, 
    staked_balance_pgt, 
    total_staking_yield,
    updated_at
FROM public.users
WHERE LOWER(player_id) = '0xpgt1340d9e6' 
   OR LOWER(linked_wallet_address) = '0xfa437ab5ff649d3dffc687c05e4b3c145d0e836a';

SELECT 
    id,
    wallet_address,
    pool,
    amount,
    tier,
    apy,
    staked_at,
    lock_until,
    last_harvest,
    active
FROM public.user_stakes
WHERE LOWER(wallet_address) = '0xpgt1340d9e6';
