# Quantum Relics System & Dedicated Profile Tab (Saved Plan)

**Status**: SAVED FOR LATER EXECUTION

## Overview
A server-verified In-Game Rare Relic Spawning System featuring:
1. **Dedicated Tab in "My Profile" (`#view-profile`)**: `[ 👤 Account Overview & Career ]` vs `[ 🏺 Quantum Relics Vault (X/17) ]`.
2. **Dedicated Relic Smart Contract (`PolyGameRelicsNFT.sol`)**: Preserves the original Utility NFT contract (`0x45D80Ea3a24978350ccC6A61A2d89B031435eCB8`) completely untouched.
3. **Multi-Quantity Ownership (On-Site & On-Chain)**:
   - Players can own multiple copies of each relic (e.g., $3\times$ Quantum Prisms, $2\times$ Hyper Cores).
   - Tracks total count, in-game unminted count, and on-chain minted count per relic.
   - Each unminted copy can be individually minted to Polygon for 1.0 POL.
4. **Automatic On-Chain Scanner on Wallet Connect**:
   - On wallet connection or account switch, the game scans `PolyGameRelicsNFT` on Polygon for all tokens owned by the player's address.
   - Accurately syncs tokens bought on OpenSea or minted on other devices into the player's profile and database automatically.
5. **26 Pre-Registered Relics**:
   - **17 Active Relics (Season 1)**: AstroDodge (3), Cyber Invaders (3), Cyber Drift (3), Cyber Stacker (3), PolySpace (3), and Universal Apex (2).
   - **9 Expansion Relics (Season 2)**: 3 future games (3 relics each).
6. **1.0 POL (MATIC) Self-Minting**: Direct on-chain minting forwarding 100% of proceeds to Treasury (`0x10B9993990c9EF8a212c9557cB02aD94da9a654d`).
7. **1.5x Season 1 Multiplier**: Owning $\ge 1$ of all 17 Season 1 Relic types unlocks the permanent **1.5x Arcade Earn + 1.5x Faucet Multiplier**.

### Complete 26-Relic Catalog:
- **AstroDodge (3)**: 🔮 `relic_astrododge_prism`, 🛡️ `relic_astrododge_deflector`, 🌌 `relic_astrododge_compass`
- **Cyber Invaders (3)**: ⚡ `relic_invaders_core`, 🔫 `relic_invaders_dynamo`, 🛸 `relic_invaders_transmitter`
- **Cyber Drift (3)**: 🏎️ `relic_drift_chronometer`, 🔥 `relic_drift_capacitor`, 🏁 `relic_drift_overdrive`
- **Cyber Stacker (3)**: 🏗️ `relic_stacker_foundation`, 🧱 `relic_stacker_keystone`, 🏛️ `relic_stacker_monolith`
- **PolySpace Fleet Mining (3)**: 🪐 `relic_space_darkmatter`, 🛰️ `relic_space_transceiver`, 👑 `relic_space_starforge`
- **Universal Apex (2)**: 🌌 `relic_universal_pulsar`, 👑 `relic_universal_genesis`
- **Future Expansion Games (9)**: `relic_exp1_a..c` (Game A), `relic_exp2_a..c` (Game B), `relic_exp3_a..c` (Game C).
