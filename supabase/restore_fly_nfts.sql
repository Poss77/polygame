-- ==============================================================================
-- POLYGAME - RESTORE FLY\'S ON-CHAIN VERIFIED NFTS
-- ==============================================================================
-- Player: Fly
-- Wallet: 0x95562f2562bafe39920e5065ca39ff10513eafcb
-- Player ID: 0xpgt5e64957dabcde8ba47239a359f61b6f1
-- On-Chain Tokens on Polygon (0x45D80Ea3a24978350ccC6A61A2d89B031435eCB8):
--   - Token #17: nft_common_boost
--   - Token #42: nft_rare_shield (Viper Shield)
--   - Token #43: nft_pulse_blaster (Pulse Blaster)
--   - Token #44: nft_epic_yield (Apex Matrix)
--   - Token #45: nft_yield_vault_epic (Epic Yield Vault Core)
--   - Token #46: nft_yield_vault_rare (Rare Yield Vault Core)
--   - Token #47: nft_yield_vault (Yield Vault Core)
-- ==============================================================================

UPDATE public.users
SET 
  owned_nfts = ARRAY[
    \'nft_common_boost\',
    \'nft_rare_shield\',
    \'nft_pulse_blaster\',
    \'nft_epic_yield\',
    \'nft_yield_vault_epic\',
    \'nft_yield_vault_rare\',
    \'nft_yield_vault\'
  ],
  updated_at = NOW()
WHERE 
  player_id ILIKE \'0xpgt5e64957dabcde8ba47239a359f61b6f1\'
  OR linked_wallet_address ILIKE \'0x95562f2562bafe39920e5065ca39ff10513eafcb\';

SELECT player_id, username, linked_wallet_address, owned_nfts
FROM public.users
WHERE linked_wallet_address ILIKE \'0x95562f2562bafe39920e5065ca39ff10513eafcb\';
