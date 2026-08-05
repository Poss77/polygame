# PLAN-001: Onsite-to-Onchain NFT Mint Request & Admin Fulfill Architecture

**Plan ID**: `PLAN-001`  
**Status**: Saved for Future Implementation (User Approved with Comments)  
**Created**: 2026-08-05  

---

## Executive Summary

This specification defines the architecture for allowing PolyGame players who own in-game (onsite) NFTs (earned via PGT rewards, crates, or in-game purchases) to request minting those NFTs directly onto the Polygon blockchain. Requests are reviewed and processed by the Master Admin directly from the Stealth Admin Panel using an automated **"⚡ Mint On-Chain"** MetaMask smart contract trigger.

---

## Confirmed Business & Technical Rules (User Feedback Incorporated)

1. **In-Game NFT Deletion (Anti-Duplication)**:
   - Once an on-chain mint request is fulfilled/approved, the in-game NFT is **deleted** from the player's `owned_nfts` array in Supabase.
   - This ensures players cannot request on-chain minting multiple times for the same item.
2. **Fee Structure**:
   - On-chain mint requests are **100% Free** for players (gas paid by Admin wallet during minting).
3. **Wallet Resolution**:
   - Target Polygon recipient address automatically uses the player's verified **`linked_wallet_address`** from the Supabase database.
4. **Admin Execution**:
   - Master Admin uses a direct **"⚡ Mint On-Chain"** button in the Stealth Admin Panel that pops up MetaMask to execute `buyUtilityNFT` or `mintTo(playerAddress, nftTypeId)` on contract `0x45D80Ea3a24978350ccC6A61A2d89B031435eCB8`.

---

## Architectural Breakdown

### 1. Database Schema (`supabase/nft_mint_requests.sql`)

#### Table: `nft_mint_requests`
```sql
CREATE TABLE IF NOT EXISTS nft_mint_requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id TEXT NOT NULL,
  linked_wallet_address TEXT NOT NULL,
  nft_id TEXT NOT NULL,
  nft_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'minted', 'rejected'
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  admin_notes TEXT
);
```

#### Security RPCs (`SECURITY DEFINER`):
- `submit_nft_mint_request(p_nft_id TEXT)`:
  - Resolves player identity (`player_id` & `linked_wallet_address`).
  - Verifies `p_nft_id` is currently owned in player's `owned_nfts`.
  - Inserts row with `status = 'pending'`.
- `fulfill_nft_mint_request(p_request_id BIGINT, p_tx_hash TEXT)`:
  - Restricted to Master Admin (`0x10B9993990c9EF8a212c9557cB02aD94da9a654d`).
  - Updates request `status = 'minted'` and sets `tx_hash`.
  - Removes `nft_id` from the player's in-game `owned_nfts` array to prevent duplicate minting claims.

---

### 2. Frontend Player Backpack UI (`src/js/features/nft.js` & `profile.js`)

- Inspects owned in-game NFTs.
- Adds **"🚀 Request On-Chain Mint"** button on unminted in-game NFT cards.
- Clicking the button calls `submit_nft_mint_request(nftId)`.
- Updates card UI to **"⏳ Mint Pending"** badge while request is under review.

---

### 3. Stealth Admin Panel (`src/js/features/admin.js`)

- Adds a dedicated card: **"🎨 Pending NFT Mint Requests"**.
- Displays table of all pending requests showing:
  - Player Username / ID
  - Linked EVM Wallet Address (`linked_wallet_address`)
  - Requested NFT Name & ID
  - Date Submitted
  - Action Button: **"⚡ Mint On-Chain"**
- Clicking **"⚡ Mint On-Chain"**:
  - Triggers MetaMask transaction to `0x45D80Ea3a24978350ccC6A61A2d89B031435eCB8`.
  - On transaction confirmation (`tx.wait()`), automatically calls `fulfill_nft_mint_request`, saving `tx_hash` and deleting the in-game NFT record.

---

## Quick Reference Summary

| Reference Field | Value |
| :--- | :--- |
| **Plan ID** | `PLAN-001` |
| **File Location** | [`plans/PLAN-001-onsite_to_onchain_nft_minting.md`](file:///c:/Users/pasca/.gemini/antigravity/scratch/PolyGame/plans/PLAN-001-onsite_to_onchain_nft_minting.md) |
| **Target Contract** | `0x45D80Ea3a24978350ccC6A61A2d89B031435eCB8` |
| **Wallet Field** | `linked_wallet_address` |
| **Anti-Duplicate Mechanism** | Auto-delete in-game NFT upon mint fulfillment |
