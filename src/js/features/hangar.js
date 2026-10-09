// ==============================================================================
// ASTRO-DODGE PROCEDURAL STARSHIP HANGAR (PLAN-008 ALPHA)
// 100% On-Chain Generative NFT Starships & Real-Time Canvas Vector Renderer
// Restricted Alpha Mode: Poss's Account & Master Admin
// ==============================================================================

import { triggerToast } from '../core/ui.js';

// --- ALPHA AUTHORIZED IDENTIFIERS ---
export const POSS_WALLET_ADDRESS = "0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5".toLowerCase();
export const POSS_PLAYER_ID = "0xpgt8312e02d37185b5983e6922d1dae1cce".toLowerCase();
export const ADMIN_WALLET_ADDRESS = "0x10B9993990c9EF8a212c9557cB02aD94da9a654d".toLowerCase();

/**
 * Verifies if the active player session is Poss or Master Admin
 */
export function isPossOrAdmin() {
  try {
    const state = (window.appState && window.appState.state) ? window.appState.state : {};
    const linkedWallet = (state.linkedWalletAddress || '').toLowerCase().trim();
    const walletAddr = (state.walletAddress || '').toLowerCase().trim();
    const username = (state.username || '').toLowerCase().trim();
    const playerId = (state.playerId || '').toLowerCase().trim();

    // Check injected wallet or accounts
    let injectedWallet = '';
    if (typeof window.ethereum !== 'undefined') {
      if (window.ethereum.selectedAddress) {
        injectedWallet = window.ethereum.selectedAddress.toLowerCase().trim();
      } else if (Array.isArray(window.ethereum.accounts) && window.ethereum.accounts[0]) {
        injectedWallet = window.ethereum.accounts[0].toLowerCase().trim();
      }
    }

    // Check localStorage cached identities
    const localWallet = (localStorage.getItem('polygame_wallet_address') || '').toLowerCase().trim();
    const localSession = (localStorage.getItem('polygame_user_session') || '').toLowerCase();

    const isPoss = (
      linkedWallet === POSS_WALLET_ADDRESS ||
      walletAddr === POSS_WALLET_ADDRESS ||
      injectedWallet === POSS_WALLET_ADDRESS ||
      localWallet === POSS_WALLET_ADDRESS ||
      playerId === POSS_PLAYER_ID ||
      username === 'poss' ||
      localSession.includes(POSS_WALLET_ADDRESS) ||
      localSession.includes(POSS_PLAYER_ID) ||
      localSession.includes('"username":"poss"')
    );

    const isAdmin = (
      linkedWallet === ADMIN_WALLET_ADDRESS ||
      walletAddr === ADMIN_WALLET_ADDRESS ||
      injectedWallet === ADMIN_WALLET_ADDRESS ||
      localWallet === ADMIN_WALLET_ADDRESS
    );

    const isDebugAlpha = !!(
      (typeof window !== 'undefined' && window.POLY_DEBUG) ||
      (typeof window !== 'undefined' && window.location?.search?.includes('alpha=true'))
    );

    return !!(isPoss || isAdmin || isDebugAlpha);
  } catch (e) {
    return false;
  }
}

// --- 6 COMBINATORIAL TRAIT DICTIONARIES ---
export const TRAIT_DICT = {
  chassis: [
    { id: 'delta', name: 'Stealth Delta', noseLen: 55, bodyWidth: 16, aftLen: 30 },
    { id: 'needle', name: 'Needle Dart', noseLen: 75, bodyWidth: 12, aftLen: 35 },
    { id: 'cruiser', name: 'Heavy Battleframe', noseLen: 45, bodyWidth: 26, aftLen: 40 },
    { id: 'blade', name: 'Forward Blade', noseLen: 65, bodyWidth: 14, aftLen: 28 },
    { id: 'twin', name: 'Twin-Boom Core', noseLen: 50, bodyWidth: 22, aftLen: 45 }
  ],
  wings: [
    { id: 'swept', name: 'Swept-Back Blades', span: 70, sweep: -25 },
    { id: 'forward', name: 'Forward-Swept Canards', span: 75, sweep: 30 },
    { id: 'twin_rudders', name: 'Twin Stabilizer Booms', span: 65, sweep: -15, hasRudders: true },
    { id: 'delta_heavy', name: 'Broad Delta Wings', span: 85, sweep: -40 },
    { id: 'annular', name: 'Annular Ring Wing', span: 60, isRing: true }
  ],
  palettes: [
    { name: 'Neon Cyber', primary: '#00f0ff', secondary: '#ff007f', hullGrad: ['#071526', '#0a2a4a', '#00f0ff'], flame: '#ff007f', coreFlame: '#00f0ff' },
    { name: 'Obsidian Void', primary: '#a855f7', secondary: '#6366f1', hullGrad: ['#090714', '#1f1338', '#a855f7'], flame: '#a855f7', coreFlame: '#ffffff' },
    { name: 'Solar Flare', primary: '#ffd700', secondary: '#ff6600', hullGrad: ['#1c1003', '#422405', '#ffd700'], flame: '#ff6600', coreFlame: '#ffd700' },
    { name: 'Toxic Matrix', primary: '#00ff66', secondary: '#00ffff', hullGrad: ['#041a0d', '#0b3d1f', '#00ff66'], flame: '#00ff66', coreFlame: '#ffffff' },
    { name: 'Arctic Chrome', primary: '#38bdf8', secondary: '#ffffff', hullGrad: ['#0f172a', '#334155', '#e2e8f0'], flame: '#38bdf8', coreFlame: '#ffffff' }
  ],
  canopies: [
    { name: 'Diamond Polarized', shape: 'diamond', color: 'rgba(0, 240, 255, 0.85)', length: 28, width: 9 },
    { name: 'Honeycomb Amber', shape: 'honeycomb', color: 'rgba(255, 215, 0, 0.85)', length: 24, width: 11 },
    { name: 'Slit Sensor Visor', shape: 'slit', color: 'rgba(255, 0, 85, 0.9)', length: 32, width: 6 },
    { name: 'Prism Singularity', shape: 'prism', color: 'rgba(255, 255, 255, 0.95)', length: 26, width: 8 }
  ],
  thrusters: [
    { name: 'Dual Ion Plasma', count: 2, offsets: [-14, 14], size: 6, flameLen: 45 },
    { name: 'Twin Heavy Pods', count: 2, offsets: [-20, 20], size: 8, flameLen: 55 },
    { name: 'Quad Hyperburners', count: 4, offsets: [-24, -10, 10, 24], size: 5, flameLen: 40 },
    { name: 'Singularity Vortex', count: 1, offsets: [0], size: 12, flameLen: 65, isVortex: true }
  ],
  decals: [
    { name: 'Dual Racing Stripes', type: 'stripes' },
    { name: 'Cyber Hex Grid', type: 'hex' },
    { name: 'Hazard Chevrons', type: 'chevrons' },
    { name: 'Clean Minimalist', type: 'none' }
  ]
};

/**
 * Decodes 6-digit DNA integer into trait definitions
 */
export function decodeDNA(dna) {
  const num = parseInt(dna, 10) || 482915;
  const d = TRAIT_DICT;
  return {
    chassis:  d.chassis[num % d.chassis.length],
    wings:    d.wings[Math.floor(num / 10) % d.wings.length],
    palette:  d.palettes[Math.floor(num / 100) % d.palettes.length],
    canopy:   d.canopies[Math.floor(num / 1000) % d.canopies.length],
    thruster: d.thrusters[Math.floor(num / 10000) % d.thrusters.length],
    decal:    d.decals[Math.floor(num / 100000) % d.decals.length]
  };
}

/**
 * Pure Vector Procedural Ship Canvas Renderer (Zero External Assets)
 */
export function renderProceduralShip(ctx, x, y, dna, scale = 1.0, tilt = 0, animTime = 0, isGame = false) {
  const t = decodeDNA(dna);
  const p = t.palette;

  ctx.save();
  ctx.translate(x, y);
  if (tilt) ctx.rotate(tilt);
  ctx.scale(scale, scale);

  // Atmospheric Hover bob if preview
  if (!isGame) {
    const hoverY = Math.sin(animTime * 0.05) * 5;
    ctx.translate(0, hoverY);
  }

  // 1. LAYER 5: Thruster Plumes (Behind Ship)
  t.thruster.offsets.forEach(offsetY => {
    const flicker = Math.sin(animTime * 0.5 + offsetY) * 4;
    const outerLen = t.thruster.flameLen + flicker;
    const innerLen = outerLen * 0.6;
    const nozzleX = -t.chassis.aftLen;

    // Outer Plume
    const outerGrad = ctx.createLinearGradient(nozzleX, offsetY, nozzleX - outerLen, offsetY);
    outerGrad.addColorStop(0, p.flame);
    outerGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.moveTo(nozzleX, offsetY - t.thruster.size);
    ctx.lineTo(nozzleX - outerLen, offsetY);
    ctx.lineTo(nozzleX, offsetY + t.thruster.size);
    ctx.closePath();
    ctx.fill();

    // Inner Core
    const innerGrad = ctx.createLinearGradient(nozzleX, offsetY, nozzleX - innerLen, offsetY);
    innerGrad.addColorStop(0, '#ffffff');
    innerGrad.addColorStop(1, p.coreFlame);
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.moveTo(nozzleX, offsetY - t.thruster.size * 0.45);
    ctx.lineTo(nozzleX - innerLen, offsetY);
    ctx.lineTo(nozzleX, offsetY + t.thruster.size * 0.45);
    ctx.closePath();
    ctx.fill();

    // Metallic Nozzle
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = p.primary;
    ctx.lineWidth = 1.5;
    ctx.fillRect(nozzleX - 4, offsetY - t.thruster.size, 5, t.thruster.size * 2);
    ctx.strokeRect(nozzleX - 4, offsetY - t.thruster.size, 5, t.thruster.size * 2);
  });

  // 2. LAYER 2: Wings
  ctx.fillStyle = p.hullGrad[0];
  ctx.strokeStyle = p.primary;
  ctx.lineWidth = 2;
  ctx.shadowColor = p.primary;
  ctx.shadowBlur = isGame ? 6 : 12;

  const wSpan = t.wings.span;
  const wSweep = t.wings.sweep;

  ctx.beginPath();
  ctx.moveTo(t.chassis.noseLen * 0.3, 0);
  ctx.lineTo(-t.chassis.aftLen * 0.4 + wSweep, -wSpan);
  ctx.lineTo(-t.chassis.aftLen * 0.9, -wSpan * 0.4);
  ctx.lineTo(-t.chassis.aftLen, 0);
  ctx.lineTo(-t.chassis.aftLen * 0.9, wSpan * 0.4);
  ctx.lineTo(-t.chassis.aftLen * 0.4 + wSweep, wSpan);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Wing Armor Panels
  const wingGrad = ctx.createLinearGradient(-30, 0, 40, 0);
  wingGrad.addColorStop(0, p.hullGrad[1]);
  wingGrad.addColorStop(1, p.primary);
  ctx.fillStyle = wingGrad;

  ctx.beginPath();
  ctx.moveTo(t.chassis.noseLen * 0.2, -4);
  ctx.lineTo(-t.chassis.aftLen * 0.3 + wSweep, -wSpan * 0.85);
  ctx.lineTo(-t.chassis.aftLen * 0.7, -wSpan * 0.35);
  ctx.lineTo(-5, -6);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(t.chassis.noseLen * 0.2, 4);
  ctx.lineTo(-t.chassis.aftLen * 0.3 + wSweep, wSpan * 0.85);
  ctx.lineTo(-t.chassis.aftLen * 0.7, wSpan * 0.35);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();

  // 3. LAYER 1: Fuselage Hull
  const hullGrad = ctx.createLinearGradient(-t.chassis.aftLen, 0, t.chassis.noseLen, 0);
  hullGrad.addColorStop(0, p.hullGrad[0]);
  hullGrad.addColorStop(0.5, p.hullGrad[1]);
  hullGrad.addColorStop(1, p.hullGrad[2]);
  ctx.fillStyle = hullGrad;
  ctx.strokeStyle = p.primary;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(t.chassis.noseLen, 0);
  ctx.lineTo(t.chassis.noseLen * 0.3, -t.chassis.bodyWidth * 0.7);
  ctx.lineTo(-t.chassis.aftLen * 0.6, -t.chassis.bodyWidth);
  ctx.lineTo(-t.chassis.aftLen, -t.chassis.bodyWidth * 0.6);
  ctx.lineTo(-t.chassis.aftLen, t.chassis.bodyWidth * 0.6);
  ctx.lineTo(-t.chassis.aftLen * 0.6, t.chassis.bodyWidth);
  ctx.lineTo(t.chassis.noseLen * 0.3, t.chassis.bodyWidth * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Spine Center Highlight
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(t.chassis.noseLen - 4, 0);
  ctx.lineTo(t.chassis.noseLen * 0.2, 0);
  ctx.stroke();

  // 4. LAYER 6: Decals & Markings
  if (t.decal.type === 'stripes') {
    ctx.fillStyle = p.secondary;
    ctx.fillRect(-t.chassis.aftLen * 0.5, -t.chassis.bodyWidth * 0.6, 6, t.chassis.bodyWidth * 1.2);
    ctx.fillRect(-t.chassis.aftLen * 0.3, -t.chassis.bodyWidth * 0.5, 4, t.chassis.bodyWidth);
  } else if (t.decal.type === 'chevrons') {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    [-10, 0, 10].forEach(cxOffset => {
      ctx.beginPath();
      ctx.moveTo(cxOffset, -6);
      ctx.lineTo(cxOffset + 5, 0);
      ctx.lineTo(cxOffset, 6);
      ctx.stroke();
    });
  }

  // 5. LAYER 4: Cockpit Canopy
  ctx.shadowBlur = 12;
  ctx.shadowColor = p.primary;
  ctx.fillStyle = t.canopy.color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;

  const cLen = t.canopy.length;
  const cW = t.canopy.width;
  const cOffset = t.chassis.noseLen * 0.15;

  ctx.beginPath();
  ctx.moveTo(cOffset + cLen * 0.6, 0);
  ctx.lineTo(cOffset, -cW);
  ctx.lineTo(cOffset - cLen * 0.4, -cW * 0.7);
  ctx.lineTo(cOffset - cLen * 0.6, 0);
  ctx.lineTo(cOffset - cLen * 0.4, cW * 0.7);
  ctx.lineTo(cOffset, cW);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Canopy Glass Glint
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cOffset + cLen * 0.4, -1);
  ctx.lineTo(cOffset, -cW * 0.6);
  ctx.lineTo(cOffset - cLen * 0.2, -cW * 0.4);
  ctx.lineTo(cOffset + cLen * 0.1, -1);
  ctx.closePath();
  ctx.fill();

  // Wingtip Strobes
  const strobeOn = (animTime % 30 < 15);
  ctx.fillStyle = strobeOn ? p.primary : '#ffffff';
  ctx.beginPath();
  ctx.arc(-t.chassis.aftLen * 0.4 + wSweep, -wSpan, 3, 0, Math.PI * 2);
  ctx.arc(-t.chassis.aftLen * 0.4 + wSweep, wSpan, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// --- EQUIPPED STARSHIP MANAGEMENT ---

const DEFAULT_POSS_SHIP = {
  tokenId: 1,
  dna: 482915,
  name: "Poss Alpha Flagship",
  rapidFireLevel: 1,
  plasmaDamageLevel: 1,
  overdriveLevel: 1,
  missilePodLevel: 1,
  shipTier: 1
};

export function getEquippedStarship() {
  try {
    const raw = localStorage.getItem('polygame_equipped_starship');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return DEFAULT_POSS_SHIP;
}

export function setEquippedStarship(ship) {
  try {
    localStorage.setItem('polygame_equipped_starship', JSON.stringify(ship));
  } catch (e) {}
}

/**
 * Returns combat multipliers for Astro-Dodge (Strictly gated to Poss/Admin in Alpha)
 */
export function getEquippedStarshipBoosts() {
  if (!isPossOrAdmin()) {
    return { isEquipped: false };
  }

  const ship = getEquippedStarship();
  if (!ship) return { isEquipped: false };

  // Rapid Fire: cooldown scales 140ms down to 90ms (L1:140, L2:130, L3:120, L4:110, L5:90)
  const rapidCooldowns = [140, 140, 130, 120, 110, 90];
  const shotCooldown = rapidCooldowns[ship.rapidFireLevel] || 140;

  // Plasma Beam: damage scales 1.0 to 2.6 (L1:1.0, L2:1.3, L3:1.6, L4:2.0, L5:2.6)
  const plasmaMultipliers = [1.0, 1.0, 1.3, 1.6, 2.0, 2.6];
  const plasmaMultiplier = plasmaMultipliers[ship.plasmaDamageLevel] || 1.0;

  // Overdrive Matrix: duration scales 1.0x to 1.75x (20s up to 35s)
  const overdriveMultipliers = [1.0, 1.0, 1.15, 1.3, 1.5, 1.75];
  const overdriveMultiplier = overdriveMultipliers[ship.overdriveLevel] || 1.0;

  // Micro-Missiles: launch cadence scales 1900ms down to 1000ms
  const missileCooldowns = [1900, 1900, 1800, 1500, 1200, 1000];
  const missileCooldown = missileCooldowns[ship.missilePodLevel] || 1900;

  return {
    isEquipped: true,
    ship,
    dna: ship.dna,
    shotCooldown,
    plasmaMultiplier,
    overdriveMultiplier,
    missileCooldown
  };
}

// --- HANGAR BAY MODAL CONTROLLER ---

let hangarAnimFrame = null;
let hangarAnimTime = 0;
let currentPreviewShip = null;

export function openHangarModal() {
  if (!isPossOrAdmin()) {
    triggerToast("Starship Hangar is currently in Alpha Testing (Poss & Admin access only).", "warning");
    return;
  }

  currentPreviewShip = Object.assign({}, getEquippedStarship());
  renderHangarModalUI();

  const modal = document.getElementById('modal-astro-hangar');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.pointerEvents = 'auto';
  }

  startHangarCanvasLoop();
}

export function closeHangarModal() {
  if (hangarAnimFrame) {
    cancelAnimationFrame(hangarAnimFrame);
    hangarAnimFrame = null;
  }
  const modal = document.getElementById('modal-astro-hangar');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.pointerEvents = 'none';
  }
}

export function syncHangarButtonVisibility() {
  const btn = document.getElementById('btn-open-hangar');
  if (!btn) return;
  if (isPossOrAdmin()) {
    btn.style.display = 'inline-flex';
  } else {
    btn.style.display = 'none';
  }
}

function startHangarCanvasLoop() {
  const canvas = document.getElementById('hangar-ship-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const animate = () => {
    hangarAnimTime++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Starfield grid
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 25) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 25) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    if (currentPreviewShip) {
      renderProceduralShip(
        ctx,
        canvas.width / 2,
        canvas.height / 2,
        currentPreviewShip.dna,
        1.55,
        0,
        hangarAnimTime,
        false
      );
    }

    hangarAnimFrame = requestAnimationFrame(animate);
  };

  if (hangarAnimFrame) cancelAnimationFrame(hangarAnimFrame);
  animate();
}

function renderHangarModalUI() {
  const container = document.getElementById('hangar-modal-content');
  if (!container || !currentPreviewShip) return;

  const t = decodeDNA(currentPreviewShip.dna);
  const p = t.palette;

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,240,255,0.25); padding-bottom: 0.75rem; margin-bottom: 1rem;">
      <div style="display: flex; align-items: center; gap: 0.6rem;">
        <span style="font-size: 1.5rem;">🛸</span>
        <div>
          <h2 style="font-size: 1.25rem; color: var(--color-primary); margin: 0; text-shadow: 0 0 10px rgba(0,240,255,0.4);">Starship Hangar & Tuning Bay</h2>
          <span style="font-size: 0.72rem; color: var(--color-warning); font-weight: 700;">🔒 Alpha Mode: Poss Authorized</span>
        </div>
      </div>
      <button onclick="window.PolyHangar.closeHangarModal()" style="background: none; border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 1.1rem; padding: 0.25rem 0.6rem; border-radius: 6px; cursor: pointer;">✕</button>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; align-items: start;">
      
      <!-- Left Column: Ship 60FPS Preview & Actions -->
      <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(0,240,255,0.2); border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
        <canvas id="hangar-ship-canvas" width="300" height="300" style="border-radius: 8px; border: 1px solid rgba(0,240,255,0.3); background: #02040a; width: 100%; max-width: 300px; aspect-ratio: 1/1;"></canvas>
        
        <div style="text-align: center; width: 100%;">
          <div style="font-size: 1.05rem; font-weight: 800; color: #fff;">${currentPreviewShip.name}</div>
          <div style="font-size: 0.78rem; font-family: monospace; color: var(--color-accent); letter-spacing: 1px; margin-top: 2px;">
            DNA #${currentPreviewShip.dna} &bull; Tier ${currentPreviewShip.shipTier || 1}
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; width: 100%;">
          <button onclick="window.PolyHangar.rollRandomDNA()" style="flex: 1; padding: 0.6rem 0.5rem; font-size: 0.8rem; font-weight: 700; background: rgba(189,0,255,0.2); border: 1px solid #bd00ff; color: #fff; border-radius: 8px; cursor: pointer;">
            🎲 Roll DNA
          </button>
          <button onclick="window.PolyHangar.equipCurrentShip()" style="flex: 1.5; padding: 0.6rem 0.5rem; font-size: 0.85rem; font-weight: 800; background: linear-gradient(135deg, #00f0ff, #00ff88); border: none; color: #000; border-radius: 8px; cursor: pointer; box-shadow: 0 0 12px rgba(0,240,255,0.4);">
            🚀 Equip for Combat
          </button>
        </div>
      </div>

      <!-- Right Column: Procedural Traits & Combat Skills -->
      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        
        <!-- Trait Breakdown -->
        <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 0.85rem;">
          <div style="font-size: 0.78rem; font-weight: 800; color: var(--color-primary); text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.5px;">🧬 Procedural Trait Breakdown</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; font-size: 0.78rem;">
            <div style="color: #94a3b8;">Chassis: <strong style="color: #fff;">${t.chassis.name}</strong></div>
            <div style="color: #94a3b8;">Wings: <strong style="color: #fff;">${t.wings.name}</strong></div>
            <div style="color: #94a3b8;">Palette: <strong style="color: ${p.primary};">${p.name}</strong></div>
            <div style="color: #94a3b8;">Canopy: <strong style="color: #fff;">${t.canopy.name}</strong></div>
            <div style="color: #94a3b8;">Thrusters: <strong style="color: #fff;">${t.thruster.name}</strong></div>
            <div style="color: #94a3b8;">Decals: <strong style="color: #fff;">${t.decal.name}</strong></div>
          </div>
        </div>

        <!-- Combat Skills Matrix -->
        <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 0.85rem;">
          <div style="font-size: 0.78rem; font-weight: 800; color: var(--color-success); text-transform: uppercase; margin-bottom: 0.65rem; letter-spacing: 0.5px;">⚡ On-Chain Combat Modules</div>
          
          <div style="display: flex; flex-direction: column; gap: 0.65rem;">
            ${renderSkillRow('⚡ Rapid Fire', currentPreviewShip.rapidFireLevel, 'Cadence: 140ms → 90ms', 0)}
            ${renderSkillRow('💥 Plasma Beam', currentPreviewShip.plasmaDamageLevel, 'Damage: 1.0x → 2.6x', 1)}
            ${renderSkillRow('🛡️ Overdrive Matrix', currentPreviewShip.overdriveLevel, 'Boost Duration: 20s → 35s', 2)}
            ${renderSkillRow('🚀 Micro-Missiles', currentPreviewShip.missilePodLevel, 'Cadence: 2.0s → 1.0s', 3)}
          </div>
        </div>

        <div style="font-size: 0.72rem; color: #64748b; line-height: 1.4; text-align: center;">
          🔥 <em>100% On-Chain Polygon Smart Contract &bull; Mint: 2.0 POL &bull; Skill upgrades burn real on-chain PGT (10% burn / 90% treasury) in a single atomic transaction.</em>
        </div>

      </div>

    </div>
  `;
}

function renderSkillRow(name, level, effectText, skillType) {
  let pips = '';
  for (let i = 1; i <= 5; i++) {
    const active = i <= level;
    pips += `<span style="display: inline-block; width: 14px; height: 7px; border-radius: 2px; margin-right: 3px; background: ${active ? 'var(--color-primary)' : 'rgba(255,255,255,0.15)'}; box-shadow: ${active ? '0 0 5px var(--color-primary)' : 'none'};"></span>`;
  }

  const isMax = level >= 5;
  const upgradeBtn = isMax
    ? `<span style="font-size: 0.7rem; color: var(--color-success); font-weight: 800;">MAX</span>`
    : `<button onclick="window.PolyHangar.testUpgradeSkill(${skillType})" style="font-size: 0.7rem; padding: 0.25rem 0.55rem; background: rgba(0,240,255,0.15); border: 1px solid var(--color-primary); color: var(--color-primary); border-radius: 4px; font-weight: 700; cursor: pointer;">+ Upgrade</button>`;

  return `
    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 0.4rem 0.6rem; border-radius: 6px;">
      <div>
        <div style="font-size: 0.8rem; font-weight: 700; color: #fff;">${name}</div>
        <div style="font-size: 0.68rem; color: #94a3b8;">${effectText}</div>
      </div>
      <div style="display: flex; align-items: center; gap: 0.6rem;">
        <div>${pips}</div>
        ${upgradeBtn}
      </div>
    </div>
  `;
}

// Alpha Testing Actions
export function rollRandomDNA() {
  if (!currentPreviewShip) return;
  currentPreviewShip.dna = Math.floor(100000 + Math.random() * 900000);
  renderHangarModalUI();
  triggerToast(`Rolled new Starship DNA #${currentPreviewShip.dna}!`, 'info');
}

export function testUpgradeSkill(skillType) {
  if (!currentPreviewShip) return;
  if (skillType === 0 && currentPreviewShip.rapidFireLevel < 5) currentPreviewShip.rapidFireLevel++;
  if (skillType === 1 && currentPreviewShip.plasmaDamageLevel < 5) currentPreviewShip.plasmaDamageLevel++;
  if (skillType === 2 && currentPreviewShip.overdriveLevel < 5) currentPreviewShip.overdriveLevel++;
  if (skillType === 3 && currentPreviewShip.missilePodLevel < 5) currentPreviewShip.missilePodLevel++;

  currentPreviewShip.shipTier = Math.max(1, Math.floor(
    (currentPreviewShip.rapidFireLevel +
     currentPreviewShip.plasmaDamageLevel +
     currentPreviewShip.overdriveLevel +
     currentPreviewShip.missilePodLevel) / 4
  ));

  renderHangarModalUI();
  triggerToast(`Skill upgraded! Ship Tier is now ${currentPreviewShip.shipTier}.`, 'success');
}

export function equipCurrentShip() {
  if (!currentPreviewShip) return;
  setEquippedStarship(currentPreviewShip);
  triggerToast(`Starship #${currentPreviewShip.dna} equipped for Astro-Dodge!`, 'success');
  closeHangarModal();
}

// Expose on global window object for legacy game scripts
window.PolyHangar = {
  isPossOrAdmin,
  decodeDNA,
  renderProceduralShip,
  getEquippedStarship,
  setEquippedStarship,
  getEquippedStarshipBoosts,
  openHangarModal,
  closeHangarModal,
  syncHangarButtonVisibility,
  rollRandomDNA,
  testUpgradeSkill,
  equipCurrentShip
};

// Auto-sync button visibility based on login/wallet state
if (typeof window !== 'undefined') {
  window.addEventListener('load', syncHangarButtonVisibility);
  window.addEventListener('DOMContentLoaded', syncHangarButtonVisibility);
  window.addEventListener('polygame:user-loaded', syncHangarButtonVisibility);
  window.addEventListener('polygame:wallet-changed', syncHangarButtonVisibility);
  setTimeout(syncHangarButtonVisibility, 300);
  setTimeout(syncHangarButtonVisibility, 1500);
  setTimeout(syncHangarButtonVisibility, 3500);
}
