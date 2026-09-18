# PLAN-011: Cyber Defense Multi-Sector Maps & Tactical Special Mod Pads

**Status**: Ready for Implementation  
**Category**: Arcade / Mini-Games (`defense.js`)  
**Target Version**: `v1.5.408`  
**Dependencies**: Vanilla HTML5 Canvas, zero external UI frameworks  

---

## 1. Executive Summary & Objective
Transform **Cyber Defense** from a single static track into a high-replayability tactical tower defense game by introducing:
1. **Option A (4 Handcrafted Cyberpunk Sector Maps)**:
   - Eliminates repetition by rotating between 4 distinct, balanced sectors per run.
   - Each sector features unique path geometries, custom chokepoints, and tailored tactical incentives (e.g. long straights for Railguns, tight bottlenecks for EMP + Plasma).
   - Minimum path distance >= 1250px across all maps guarantees fair survivability and balance.
2. **Option C (Tactical Special Mod Pads)**:
   - Every match randomly rolls **3 unique tactical sockets** across the 12 turret pads:
     - ⚡ **Overclock Pad**: +25% Attack Speed (reduces turret firing cooldown interval by 25%).
     - 🎯 **Spotter Pad**: +30% Targeting Range (enlarges weapon range radius by 30%).
     - 💥 **Amplifier Pad**: +20% Raw Damage (multiplies base projectile damage by 1.2x).
   - Features animated holographic pulsing icons on empty pads and active status badges in the Turret Inspector.

---

## 2. Sector Map Specifications (Canvas: 800 x 450)

### Sector 1: `Sector Alpha // Circuit Highway` (Balanced Baseline)
* **Description**: Classic S-curve gauntlet with alternating chokepoints.
* **Path Distance**: ~1,250px
* **Waypoints**:
```javascript
[
  { x: 0,   y: 150 },
  { x: 180, y: 150 },
  { x: 180, y: 320 },
  { x: 360, y: 320 },
  { x: 360, y: 120 },
  { x: 540, y: 120 },
  { x: 540, y: 260 },
  { x: 740, y: 260 }
]
```
* **Quantum Core Position**: `{ x: 740, y: 260 }`
* **12 Tactical Pads**:
```javascript
[
  { id: 1,  x: 90,  y: 85 },
  { id: 2,  x: 90,  y: 215 },
  { id: 3,  x: 270, y: 220 },
  { id: 4,  x: 270, y: 385 },
  { id: 5,  x: 450, y: 60 },
  { id: 6,  x: 450, y: 220 },
  { id: 7,  x: 450, y: 385 },
  { id: 8,  x: 630, y: 160 },
  { id: 9,  x: 630, y: 340 },
  { id: 10, x: 180, y: 45 },
  { id: 11, x: 360, y: 395 },
  { id: 12, x: 730, y: 160 }
]
```

---

### Sector 2: `Sector Beta // Twin Spiral` (High Multi-Lane Coverage)
* **Description**: Concentric orbital spiral route. Central pads overlap outer and inner lanes simultaneously.
* **Path Distance**: ~1,930px
* **Waypoints**:
```javascript
[
  { x: 0,   y: 90 },
  { x: 680, y: 90 },
  { x: 680, y: 360 },
  { x: 150, y: 360 },
  { x: 150, y: 210 },
  { x: 450, y: 210 }
]
```
* **Quantum Core Position**: `{ x: 450, y: 210 }` (inner vortex center)
* **12 Tactical Pads**:
```javascript
[
  // Central Multi-Lane Command Perches:
  { id: 1,  x: 280, y: 150 },
  { id: 2,  x: 420, y: 150 },
  { id: 3,  x: 560, y: 150 },
  { id: 4,  x: 280, y: 285 },
  { id: 5,  x: 420, y: 285 },
  { id: 6,  x: 560, y: 285 },
  // Outer Flank & Corner Sockets:
  { id: 7,  x: 70,  y: 210 },
  { id: 8,  x: 750, y: 90 },
  { id: 9,  x: 750, y: 240 },
  { id: 10, x: 750, y: 360 },
  { id: 11, x: 150, y: 420 },
  { id: 12, x: 560, y: 390 }
]
```

---

### Sector 3: `Sector Gamma // The Zig-Zag Trench` (Railgun Penetration Haven)
* **Description**: 3 sweeping horizontal trenches spanning the entire canvas. Ideal for line-piercing Railguns.
* **Path Distance**: ~2,230px
* **Waypoints**:
```javascript
[
  { x: 0,   y: 80 },
  { x: 700, y: 80 },
  { x: 700, y: 225 },
  { x: 100, y: 225 },
  { x: 100, y: 370 },
  { x: 740, y: 370 }
]
```
* **Quantum Core Position**: `{ x: 740, y: 370 }`
* **12 Tactical Pads**:
```javascript
[
  // Upper Corridor (Between Trench 1 & 2):
  { id: 1,  x: 200, y: 150 },
  { id: 2,  x: 350, y: 150 },
  { id: 3,  x: 500, y: 150 },
  { id: 4,  x: 650, y: 150 },
  // Lower Corridor (Between Trench 2 & 3):
  { id: 5,  x: 150, y: 300 },
  { id: 6,  x: 300, y: 300 },
  { id: 7,  x: 450, y: 300 },
  { id: 8,  x: 600, y: 300 },
  // Turn Bends & Flank Perches:
  { id: 9,  x: 765, y: 150 },
  { id: 10, x: 35,  y: 300 },
  { id: 11, x: 350, y: 25 },
  { id: 12, x: 450, y: 420 }
]
```

---

### Sector 4: `Sector Delta // Quantum Singularity` (The Hourglass Funnel)
* **Description**: High-speed converge-and-diverge hourglass track with a lethal center chokepoint funnel. Ideal for EMP and Plasma splash.
* **Path Distance**: ~1,432px
* **Waypoints**:
```javascript
[
  { x: 0,   y: 60 },
  { x: 240, y: 60 },
  { x: 380, y: 225 },
  { x: 420, y: 225 },
  { x: 560, y: 60 },
  { x: 720, y: 60 },
  { x: 720, y: 380 },
  { x: 480, y: 380 }
]
```
* **Quantum Core Position**: `{ x: 480, y: 380 }`
* **12 Tactical Pads**:
```javascript
[
  // Center Funnel Cluster (The Killbox):
  { id: 1,  x: 400, y: 145 },
  { id: 2,  x: 400, y: 305 },
  { id: 3,  x: 310, y: 225 },
  { id: 4,  x: 490, y: 225 },
  // Approach & Flank Sockets:
  { id: 5,  x: 120, y: 120 },
  { id: 6,  x: 120, y: 300 },
  { id: 7,  x: 240, y: 140 },
  { id: 8,  x: 560, y: 140 },
  { id: 9,  x: 650, y: 140 },
  { id: 10, x: 650, y: 300 },
  { id: 11, x: 770, y: 220 },
  { id: 12, x: 400, y: 420 }
]
```

---

## 3. Tactical Special Mod Pads Specification

### Random Roll on Match Start:
When `loadSector()` or `reset()` executes:
1. Reset all `pad.modifier = null`.
2. Shuffle pads array copy and assign:
   - `pad1.modifier = 'overclock';`
   - `pad2.modifier = 'spotter';`
   - `pad3.modifier = 'amplifier';`

### Stat Effects Pipeline:
```javascript
getEffectiveTurretConfig(t) {
  const base = this.getTurretConfig(t.type, t.level);
  const mod = t.pad ? t.pad.modifier : null;
  if (!mod) return base;

  const conf = { ...base };
  if (mod === 'overclock') {
    conf.rate = Number((base.rate * 0.75).toFixed(2)); // +25% Attack Speed (faster cooldown)
  } else if (mod === 'spotter') {
    conf.range = Math.round(base.range * 1.30);       // +30% Targeting Range
  } else if (mod === 'amplifier') {
    conf.damage = Math.round(base.damage * 1.20);     // +20% Raw Damage
  }
  return conf;
}
```

### Canvas Rendering for Mod Pads:
* **Empty Mod Pads**:
  * **Overclock**: Glowing `#eab308` (Electric Gold) ring with an animated pulsing `⚡` rune.
  * **Spotter**: Glowing `#06b6d4` (Cyan) targeting ring with an animated `🎯` crosshair rune.
  * **Amplifier**: Glowing `#f43f5e` (Crimson) hazard ring with an animated `💥` blast rune.
* **Occupied Mod Pads**:
  * Turret foundation base inherits the modifier's glowing aura.
  * Military rank badge includes a mod pip.
* **Turret Inspector UI Overlay**:
  * Displays active modifier badge in the header:
    * `⚡ OVERCLOCK ACTIVE (+25% SPEED)`
    * `🎯 SPOTTER ACTIVE (+30% RANGE)`
    * `💥 AMPLIFIER ACTIVE (+20% DMG)`

---

## 4. Quantum Core Dynamic Placement
* In `draw()` and `update()`, replace hardcoded `coreX = 740; coreY = 260;` with:
  ```javascript
  const corePos = this.currentSector.core;
  ```
* Rotating hexagonal shield crystal and damage text will dynamically anchor to `corePos.x`, `corePos.y`.

---

## 5. Implementation Roadmap
1. **Data Structures in `defense.js`**:
   - Add `SECTORS` constant array containing Sectors 1-4.
   - Add `currentSectorIndex = 0; currentSector = SECTORS[0];`.
   - Add `loadSector(index)` method.
2. **Stat Integration**:
   - Replace direct calls to `getTurretConfig` in `update()` and `fireTurret()` with `getEffectiveTurretConfig(t)`.
3. **Canvas Pad & Core Updates**:
   - Render the animated modifier rings and icons in `draw()`.
   - Dynamically position Quantum Core at `this.currentSector.core`.
4. **Sector Announcement Banner**:
   - Render `SECTOR DETECTED: [NAME]` during the preparation phase.
5. **Version Bump**:
   - Bump `APP_VERSION` to `"1.5.408"` in `src/js/core/config.js`.

---

## 6. Verification & Security Checks
- [ ] Creeps follow correct waypoints across all 4 maps without clipping.
- [ ] Quantum Core correctly takes damage and detects loss condition across all 4 terminal locations.
- [ ] Overclock reduces cooldown by 25%, Spotter increases range by 30%, Amplifier increases damage by 20%.
- [ ] PostgREST / Supabase anti-cheat Trigger remains 100% compliant (no balance or trigger mutations).
- [ ] Mobile touch support and desktop clicks verified on all pad locations.
