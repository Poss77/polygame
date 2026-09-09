# PLAN-007: High-Value Withdrawal Admin Approval & Per-Player Quota Override

**Plan ID**: `PLAN-007`  
**Status**: Saved for Future Implementation  
**Created**: 2026-09-08  

---

## Executive Summary

This specification defines the architecture for allowing PolyGame players to withdraw amounts exceeding standard single-transaction limits (e.g. > 25,000 PGT) or weekly quotas (e.g. > 5 claims per week). 

It provides two distinct, complementary workflows:
1. **In-App Over-Limit Request Queue**: Players input an over-limit amount in `#modal-withdraw`, which automatically switches into a "Request Admin Approval" mode. Funds are held in escrow, an alert is dispatched to the Admin Discord channel, and the Master Admin can approve (issue smart contract voucher) or reject (refund balance) from the Admin Panel.
2. **Direct Per-Player Limit Override**: Admin can set custom single-withdrawal caps (e.g. 100,000 PGT) or weekly quotas (e.g. 10 claims) directly on any player's profile in the Player Ledger, allowing verified players to withdraw immediately through the standard flow.

---

## Technical & Business Rules

1. **Smart Contract Compatibility**:
   - The PGT Token Contract (`0x701100D19b1a93672cfe7291EA455b4220631209`) `claimTokens(amount, nonce, signature)` already natively supports any amount as long as it is signed by `ADMIN_PRIVATE_KEY` and passes the standard 0.5 POL fee check.
   - All limits are enforced at the backend / PostgreSQL / Edge Function layers.
2. **Escrow Security**:
   - When a player submits an over-limit request, tokens are atomically moved from `balance_pgt` to `escrow_pgt` so they cannot double-spend or lose them in arcade games while waiting.
   - If rejected or cancelled, funds are restored back to `balance_pgt`.
3. **Private Key Protection**:
   - The `ADMIN_PRIVATE_KEY` never touches client browsers; vouchers are signed in the Supabase Edge Function gateway upon Master Admin authentication.

---

## Database Architecture (`supabase/add_withdrawal_approval_system.sql`)

### 1. Column Extensions on `public.users`:
```sql
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_max_withdraw_pgt NUMERIC DEFAULT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_max_weekly_withdrawals INTEGER DEFAULT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS custom_withdraw_expires_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS escrow_pgt NUMERIC DEFAULT 0.0;
```

### 2. Table: `public.withdrawal_requests`
```sql
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'claimed', 'rejected', 'cancelled'
  nonce NUMERIC,
  voucher_signature TEXT,
  admin_notes TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  claimed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_player ON public.withdrawal_requests(LOWER(player_id), status);
```

---

## Stored Procedures

1. `submit_withdrawal_request(p_player_id, p_wallet_address, p_amount, p_ip_address)`:
   - Locks row `FOR UPDATE`, checks quarantine and ban status.
   - Moves `amount` from `balance_pgt` to `escrow_pgt`.
   - Inserts record into `withdrawal_requests`.

2. `cancel_pending_withdrawal_request(p_request_id, p_player_id)`:
   - Player cancels their own pending request and restores escrowed funds back to `balance_pgt`.

3. `reject_withdrawal_request(p_request_id, p_admin_notes)`:
   - Admin procedure: sets status `'rejected'`, restores escrow to `balance_pgt`.

4. `set_player_custom_withdrawal_limit(p_target_player_id, p_max_single, p_max_weekly, p_expires_hours)`:
   - Admin procedure: sets custom limit overrides on `public.users`.
