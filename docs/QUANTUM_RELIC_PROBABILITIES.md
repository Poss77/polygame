# 🏺 PolyGame Quantum Relic Drop Probabilities & Scarcity Guide

> **System Architecture & Probability Matrix**  
> *Last Verified: PolyGame v1.5.162*

---

## 🌌 Overview of the Quantum Relic System

Quantum Relics are ultra-rare in-game and on-chain collectibles that grant visual prestige, permanent progression perks, and contribute toward unlocking the **Serie 1 Apex Faucet & Payout Multiplier**.

There are **17 Quantum Relics** in Serie 1 across 4 Rarity Tiers:
- 🔵 **Rare** (50% of game relic drops)
- 🟣 **Epic** (35% of game relic drops)
- 🟡 **Legendary** (13% of game relic drops)
- 🔴 **Mythic (Universal Apex)** (2% of game relic drops • 10% on Deep Space / Odyssey)

---

## 🕹️ 1. Arcade Game Drop Probabilities

### 🛸 A. AstroDodge (`game.js`)
* **Drop Trigger**: Collectible Spawn Check
* **Base Relic Spawn Chance**: **0.10%** (1 in 1,000 collectibles spawned)

| Relic Name | ID | Rarity | Weight When Relic Drops | Effective Total Spawn Rate |
| :--- | :--- | :---: | :---: | :---: |
| 💎 **Quantum Prism** | `relic_astrododge_prism` | **Rare** | 50.0% | `0.050%` (1 in 2,000) |
| 🛡️ **Cosmic Deflector** | `relic_astrododge_deflector` | **Epic** | 35.0% | `0.035%` (1 in 2,857) |
| 🧭 **Chrono Compass** | `relic_astrododge_compass` | **Legendary** | 13.0% | `0.013%` (1 in 7,692) |
| 🌀 **Quantum Singularity Core** | `relic_apex_singularity` | **Mythic** | 1.0% | `0.001%` (1 in 100,000) |
| 👑 **Genesis Matrix** | `relic_apex_genesis` | **Mythic** | 1.0% | `0.001%` (1 in 100,000) |

---

### 👾 B. Cyber Invaders (`invaders.js`)
* **Drop Trigger**: Enemy Destruction
* **Drop Rates by Target**:
  * 🛸 **Standard Alien Invaders**: **0.10%** (1 in 1,000 aliens destroyed)
  * 👾 **Alien Flagship Boss / Standard UFO**: **1.00%** (1 in 100 bosses)
  * 🪙 **Golden Mystery UFO**: **2.00%** (1 in 50 golden UFOs)

| Relic Name | ID | Rarity | Weight When Relic Drops |
| :--- | :--- | :---: | :---: |
| 🔋 **Pulsar Core** | `relic_invaders_core` | **Rare** | 50.0% |
| 🌀 **Warp Dynamo** | `relic_invaders_dynamo` | **Epic** | 35.0% |
| 📡 **Quantum Transmitter** | `relic_invaders_transmitter` | **Legendary** | 13.0% |
| 🌀 **Quantum Singularity Core** | `relic_apex_singularity` | **Mythic** | 1.0% |
| 👑 **Genesis Matrix** | `relic_apex_genesis` | **Mythic** | 1.0% |

---

### 🏎️ C. Cyber Drift (`drift.js`)
* **Drop Trigger**: Highway Pickup Spawns
* **Base Relic Spawn Chance**: **0.10%** (1 in 1,000 highway pickups)

| Relic Name | ID | Rarity | Weight When Relic Drops | Effective Total Spawn Rate |
| :--- | :--- | :---: | :---: | :---: |
| ⏱️ **Neon Tachometer** | `relic_drift_chronometer` | **Rare** | 50.0% | `0.050%` (1 in 2,000) |
| ⚡ **Flux Capacitor** | `relic_drift_capacitor` | **Epic** | 35.0% | `0.035%` (1 in 2,857) |
| 🔥 **Apex Supercharger** | `relic_drift_overdrive` | **Legendary** | 13.0% | `0.013%` (1 in 7,692) |
| 🌀 **Quantum Singularity Core** | `relic_apex_singularity` | **Mythic** | 1.0% | `0.001%` (1 in 100,000) |
| 👑 **Genesis Matrix** | `relic_apex_genesis` | **Mythic** | 1.0% | `0.001%` (1 in 100,000) |

---

### 🧱 D. Cyber Stacker (`stacker.js`)
* **Drop Trigger**: Floor Alignment & Placement Lock
* **Drop Rates by Block Type**:
  * 🏢 **Standard Tower Floor**: **0.10%** (1 in 1,000 placed blocks)
  * 🪙 **Golden Core Bonus Floor**: **2.00%** (1 in 50 golden core blocks)

| Relic Name | ID | Rarity | Weight When Relic Drops |
| :--- | :--- | :---: | :---: |
| 🏗️ **Titanium Bedrock** | `relic_stacker_foundation` | **Rare** | 50.0% |
| 🔮 **Harmonic Keystone** | `relic_stacker_keystone` | **Epic** | 35.0% |
| 🏛️ **Quantum Monolith** | `relic_stacker_monolith` | **Legendary** | 13.0% |
| 🌀 **Quantum Singularity Core** | `relic_apex_singularity` | **Mythic** | 1.0% |
| 👑 **Genesis Matrix** | `relic_apex_genesis` | **Mythic** | 1.0% |

---

## 🚀 2. PolySpace Planetary Expeditions (`space.js`)

* **Drop Trigger**: Expedition Fleet Return & Loot Claim
* **Critical Success Boost**: $+50\%$ Multiplier (1.5x) to all drop chances on critical success.

### Base Relic Discovery Chance by Mission Type:
| Mission Tier | Duration | Base Relic Chance | Critical Success Chance (1.5x) |
| :--- | :---: | :---: | :---: |
| 🪨 **Asteroids Belt** | 15 Minutes | **0.80%** | **1.20%** |
| 🌌 **Nebula Zone** | 2 Hours | **1.60%** | **2.40%** |
| 🕳️ **Void Expanse** | 8 Hours | **2.40%** | **3.60%** |
| 🛰️ **Sector 9** | 24 Hours | **3.60%** | **5.40%** |
| 🚀 **Deep Space** | 3 Days | **5.60%** | **8.40%** |
| 🪐 **Galactic Odyssey** | 7 Days | **8.00%** | **12.00%** |

### PolySpace Relic Rarity Breakdown:
* **Short / Medium Missions (Asteroids, Nebula, Void, Sector 9)**:
  * 🔵 **Dark Matter Capsule** (`relic_space_darkmatter` • Rare): **45.0%**
  * 🟣 **Tachyon Warp Coil** (`relic_space_warpcoil` • Epic): **35.0%**
  * 🟡 **Solar Plasma Harvester** (`relic_space_plasma` • Legendary): **20.0%**
* **High-Tier Long Missions (Deep Space & Galactic Odyssey)**:
  * 🔴 **Universal Apex Mythics (Genesis Matrix & Singularity)**: **10.0%** (5% each)
  * 🟡 **Solar Plasma Harvester** (`relic_space_plasma` • Legendary): **20.0%**
  * 🟣 **Tachyon Warp Coil** (`relic_space_warpcoil` • Epic): **35.0%**
  * 🔵 **Dark Matter Capsule** (`relic_space_darkmatter` • Rare): **35.0%**

---

## 🏆 3. Complete Serie 1 Relic Master Table

| Relic ID | Relic Name | Game Origin | Rarity | Drop Source |
| :--- | :--- | :---: | :---: | :--- |
| `relic_astrododge_prism` | **Quantum Prism** | AstroDodge | 🔵 Rare | Collectible Drops |
| `relic_astrododge_deflector` | **Cosmic Deflector** | AstroDodge | 🟣 Epic | Collectible Drops |
| `relic_astrododge_compass` | **Chrono Compass** | AstroDodge | 🟡 Legendary | Collectible Drops |
| `relic_invaders_core` | **Pulsar Core** | Cyber Invaders | 🔵 Rare | Aliens & UFOs |
| `relic_invaders_dynamo` | **Warp Dynamo** | Cyber Invaders | 🟣 Epic | Aliens & UFOs |
| `relic_invaders_transmitter` | **Quantum Transmitter** | Cyber Invaders | 🟡 Legendary | Aliens & UFOs |
| `relic_drift_chronometer` | **Neon Tachometer** | Cyber Drift | 🔵 Rare | Highway Pickups |
| `relic_drift_capacitor` | **Flux Capacitor** | Cyber Drift | 🟣 Epic | Highway Pickups |
| `relic_drift_overdrive` | **Apex Supercharger** | Cyber Drift | 🟡 Legendary | Highway Pickups |
| `relic_stacker_foundation` | **Titanium Bedrock** | Cyber Stacker | 🔵 Rare | Floor Placements |
| `relic_stacker_keystone` | **Harmonic Keystone** | Cyber Stacker | 🟣 Epic | Floor Placements |
| `relic_stacker_monolith` | **Quantum Monolith** | Cyber Stacker | 🟡 Legendary | Floor Placements |
| `relic_space_darkmatter` | **Dark Matter Capsule** | PolySpace | 🔵 Rare | Planetary Expeditions |
| `relic_space_warpcoil` | **Tachyon Warp Coil** | PolySpace | 🟣 Epic | Planetary Expeditions |
| `relic_space_plasma` | **Solar Plasma Harvester** | PolySpace | 🟡 Legendary | Planetary Expeditions |
| `relic_apex_singularity` | **Quantum Singularity Core** | Universal | 🔴 Mythic | All Arcade Games & Deep Expeditions |
| `relic_apex_genesis` | **Genesis Matrix** | Universal | 🔴 Mythic | All Arcade Games & Deep Expeditions |
