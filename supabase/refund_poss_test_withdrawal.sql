-- ==============================================================================
-- POLYGAME: REFUND UNCLAIMED 5,000 PGT WITHDRAWAL (POSS TEST)
-- ==============================================================================
-- Nonce 93087061 was generated at 2026-09-20 01:14:20 UTC for 5,000 PGT.
-- We verified on Polygon blockchain (via usedNonces) that this transaction
-- was NEVER broadcast or claimed on-chain.
--
-- This script safely calls cancel_withdrawal_voucher(93087061) to restore
-- the 5,000 PGT back to Poss's balance and remove the unconsumed history record.
-- ==============================================================================

SELECT public.cancel_withdrawal_voucher(93087061);
