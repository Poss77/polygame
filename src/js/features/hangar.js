// ==============================================================================
// ASTRO-DODGE PROCEDURAL STARSHIP HANGAR (PLAN-008 ALPHA)
// 100% On-Chain Generative NFT Starships & Real-Time Canvas Vector Renderer
// Features: Minting (2.0 POL), Fleet Switching, Demo Mode, & Combat Skill Upgrades
// ==============================================================================

import { triggerToast, openModal, closeModal } from '../core/ui.js';
import { STARSHIP_CONTRACT_ADDRESS, TOKEN_CONTRACT_ADDRESS, ADMIN_WALLET_ADDRESS } from '../core/config.js';

// --- ALPHA AUTHORIZED IDENTIFIERS ---
export const POSS_WALLET_ADDRESS = "0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5".toLowerCase();
export const POSS_PLAYER_ID = "0xpgt8312e02d37185b5983e6922d1dae1cce".toLowerCase();

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
      linkedWallet === ADMIN_WALLET_ADDRESS.toLowerCase() ||
      walletAddr === ADMIN_WALLET_ADDRESS.toLowerCase() ||
      injectedWallet === ADMIN_WALLET_ADDRESS.toLowerCase() ||
      localWallet === ADMIN_WALLET_ADDRESS.toLowerCase()
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

export function isGoogleSessionActive() {
  try {
    const state = (window.appState && window.appState.state) ? window.appState.state : {};
    return !!(state.authUserEmail || state.authProvider === 'google');
  } catch (e) {
    return false;
  }
}

export function hasWeb3WalletConnected() {
  try {
    const state = (window.appState && window.appState.state) ? window.appState.state : {};
    return !!(state.authProvider === 'web3' || (state.walletConnected && (window.realSigner || window.web3Provider)));
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

// --- STARSHIP RARITY TIERS & FIRE PALETTES ---
export const STARSHIP_RARITY = {
  Rare: {
    tier: 'Rare',
    name: 'Rare',
    badge: 'RARE',
    color: '#00f0ff',
    bg: 'rgba(0, 240, 255, 0.15)',
    border: 'rgba(0, 240, 255, 0.45)',
    flame: '#00f0ff',       // Cyan Plasma Flame
    coreFlame: '#ffffff',   // White Plasma Core
    flameName: 'Cyan Plasma',
    baseEarnMultiplier: 1.1
  },
  Epic: {
    tier: 'Epic',
    name: 'Epic',
    badge: 'EPIC',
    color: '#bd00ff',
    bg: 'rgba(189, 0, 255, 0.18)',
    border: 'rgba(189, 0, 255, 0.5)',
    flame: '#bd00ff',       // Hyper Violet Flame
    coreFlame: '#ff88ff',   // Radiant Orchid Core
    flameName: 'Hyper Violet',
    baseEarnMultiplier: 1.2
  },
  Legendary: {
    tier: 'Legendary',
    name: 'Legendary',
    badge: 'LEGENDARY',
    color: '#ffd700',
    bg: 'rgba(255, 215, 0, 0.18)',
    border: 'rgba(255, 215, 0, 0.55)',
    flame: '#ff8800',       // Molten Solar Gold Flame
    coreFlame: '#fff59d',   // Golden Flare Core
    flameName: 'Solar Flare',
    baseEarnMultiplier: 1.3
  },
  Mythic: {
    tier: 'Mythic',
    name: 'Mythic',
    badge: 'MYTHIC',
    color: '#ff0055',
    bg: 'linear-gradient(135deg, rgba(255, 0, 85, 0.25), rgba(0, 240, 255, 0.2))',
    border: 'rgba(255, 0, 85, 0.7)',
    flame: '#ff0055',       // Cosmic Crimson Flame
    coreFlame: '#00ffff',   // Singularity Cyan Core
    flameName: 'Cosmic Crimson',
    baseEarnMultiplier: 1.5
  }
};

/**
 * Calculates deterministic Starship Rarity from 6-digit DNA
 * Tiers: Rare, Epic, Legendary, Mythic
 */
export function getStarshipRarity(dna) {
  const num = parseInt(dna, 10) || 482915;

  const chassisPts  = [10, 10, 14, 14, 18]; // Stealth(10), Needle(10), Cruiser(14), Blade(14), Twin(18)
  const wingsPts    = [10, 10, 14, 14, 18]; // Swept(10), Forward(10), TwinBooms(14), Delta(14), Annular(18)
  const palPts      = [10, 14, 18, 14, 10]; // Neon(10), Obsidian(14), SolarFlare(18), Toxic(14), Arctic(10)
  const canopyPts   = [14, 10, 10, 18];      // Diamond(14), Honeycomb(10), Slit(10), Prism(18)
  const thrusterPts = [10, 10, 14, 18];      // DualIon(10), TwinHeavy(10), Quad(14), Singularity(18)
  const decalPts    = [10, 18, 14, 10];      // Stripes(10), Hex(18), Chevrons(14), Clean(10)

  const c  = chassisPts[num % 5];
  const w  = wingsPts[Math.floor(num / 10) % 5];
  const p  = palPts[Math.floor(num / 100) % 5];
  const cn = canopyPts[Math.floor(num / 1000) % 4];
  const th = thrusterPts[Math.floor(num / 10000) % 4];
  const dc = decalPts[Math.floor(num / 100000) % 4];

  let pts = c + w + p + cn + th + dc;
  const s = String(num);
  const hasTriple = (s[0] === s[1] && s[1] === s[2]) || (s[1] === s[2] && s[2] === s[3]) || (s[2] === s[3] && s[3] === s[4]) || (s[3] === s[4] && s[4] === s[5]);
  const isPalindrome = (s === s.split('').reverse().join(''));
  const legendaryCount = [c, w, p, cn, th, dc].filter(x => x === 18).length;

  if (hasTriple) pts += 6;
  if (isPalindrome) pts += 8;

  let score = Math.round(50 + ((pts - 60) / 48.0) * 50);
  score = Math.max(50, Math.min(100, score));

  let tierKey = 'Rare';
  if (score >= 90 || (legendaryCount === 3 && (hasTriple || isPalindrome))) {
    tierKey = 'Mythic';
  } else if (score >= 82 || legendaryCount >= 3) {
    tierKey = 'Legendary';
  } else if (score >= 72 || legendaryCount >= 2) {
    tierKey = 'Epic';
  } else {
    tierKey = 'Rare';
  }

  const def = STARSHIP_RARITY[tierKey];
  return {
    ...def,
    score,
    legendaryCount,
    pts
  };
}

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
  const rarity = getStarshipRarity(dna);

  ctx.save();
  ctx.translate(x, y);
  if (tilt) ctx.rotate(tilt);
  ctx.scale(scale, scale);

  // Atmospheric Hover bob if preview
  if (!isGame) {
    const hoverY = Math.sin(animTime * 0.05) * 5;
    ctx.translate(0, hoverY);
  }

  // 1. LAYER 5: Thruster Plumes (Behind Ship) - Fire color driven by Starship Rarity
  t.thruster.offsets.forEach(offsetY => {
    const flicker = Math.sin(animTime * 0.5 + offsetY) * 4;
    const outerLen = t.thruster.flameLen + flicker;
    const innerLen = outerLen * 0.6;
    const nozzleX = -t.chassis.aftLen;

    // Outer Plume (Rarity Fire Color)
    const outerGrad = ctx.createLinearGradient(nozzleX, offsetY, nozzleX - outerLen, offsetY);
    outerGrad.addColorStop(0, rarity.flame);
    outerGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.moveTo(nozzleX, offsetY - t.thruster.size);
    ctx.lineTo(nozzleX - outerLen, offsetY);
    ctx.lineTo(nozzleX, offsetY + t.thruster.size);
    ctx.closePath();
    ctx.fill();

    // Inner Core (Rarity Core Fire Color)
    const innerGrad = ctx.createLinearGradient(nozzleX, offsetY, nozzleX - innerLen, offsetY);
    innerGrad.addColorStop(0, rarity.coreFlame);
    innerGrad.addColorStop(1, 'rgba(0,0,0,0)');
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
  if (!isGame) {
    ctx.shadowColor = p.primary;
    ctx.shadowBlur = 12;
  } else {
    ctx.shadowBlur = 0;
  }

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
  if (!isGame) {
    ctx.shadowBlur = 12;
    ctx.shadowColor = p.primary;
  } else {
    ctx.shadowBlur = 0;
  }
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

export function getActiveWalletAddress() {
  try {
    const state = (window.appState && window.appState.state) ? window.appState.state : {};
    if (state.linkedWalletAddress && !state.linkedWalletAddress.startsWith('0xpgt') && !state.linkedWalletAddress.startsWith('0xg')) {
      return state.linkedWalletAddress.toLowerCase();
    }
    // If user is authenticated via Google and has not linked a Web3 wallet, do not infer unlinked injected ethereum
    const isGoogle = !!(state.authUserEmail || state.authProvider === 'google');
    if (isGoogle) return null;

    if (state.walletConnected && state.walletAddress && !state.walletAddress.startsWith('0xguest')) {
      return state.walletAddress.toLowerCase();
    }
    if (typeof window.ethereum !== 'undefined' && window.ethereum.selectedAddress) {
      return window.ethereum.selectedAddress.toLowerCase();
    }
    const local = localStorage.getItem('polygame_wallet_address');
    if (local && !local.startsWith('0xguest')) return local.toLowerCase();
  } catch (e) {}
  return isPossOrAdmin() ? POSS_WALLET_ADDRESS : null;
}

export function getUserFleet() {
  try {
    const raw = localStorage.getItem('polygame_user_fleet');
    if (raw) {
      const fleet = JSON.parse(raw);
      if (Array.isArray(fleet) && fleet.length > 0) return fleet;
    }
  } catch (e) {}

  return []; // Players without minted ships enter Demo Mode
}

export function saveUserFleet(fleet) {
  try {
    localStorage.setItem('polygame_user_fleet', JSON.stringify(fleet));
  } catch (e) {}
}

export function getEquippedStarship() {
  try {
    const raw = localStorage.getItem('polygame_equipped_starship');
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  const fleet = getUserFleet();
  return fleet.length > 0 ? fleet[0] : null;
}

export function setEquippedStarship(ship) {
  try {
    localStorage.setItem('polygame_equipped_starship', JSON.stringify(ship));
    if (window.appState && window.appState.state) {
      if (!window.appState.state.spaceState) {
        window.appState.state.spaceState = {};
      }
      window.appState.state.spaceState.equippedStarship = ship;
      window.appState._spaceStateDirty = true;
      if (typeof window.appState.saveToDB === 'function') {
        window.appState.saveToDB();
      }
    }
  } catch (e) {}
}

/**
 * Synchronizes user's starship fleet directly from Polygon smart contract
 */
export async function syncFleetFromChain(userAddress = null, showToast = false) {
  if (!STARSHIP_CONTRACT_ADDRESS || typeof window === 'undefined') return;

  const isGoogle = isGoogleSessionActive();
  const hasWeb3 = hasWeb3WalletConnected();

  if (isGoogle && !hasWeb3 && !userAddress) {
    if (showToast) {
      triggerToast("Please sign in or connect your Web3 wallet first.", "warning");
      if (typeof window.openModal === 'function') window.openModal('wallet');
    }
    return;
  }

  const targetAddr = userAddress || getActiveWalletAddress();
  if (!targetAddr) {
    if (showToast) {
      triggerToast("Please sign in or connect your Web3 wallet first.", "warning");
      if (typeof window.openModal === 'function') window.openModal('wallet');
    }
    return;
  }

  try {
    if (showToast) triggerToast("Syncing fleet from Polygon blockchain...", "info");
    
    let provider = null;
    if (typeof window.ethereum !== 'undefined' && window.ethers) {
      provider = new window.ethers.BrowserProvider(window.ethereum);
    }
    
    const abi = [
      "function tokensOfOwner(address owner) external view returns (uint256[])",
      "function getStarshipStats(uint256 tokenId) external view returns (tuple(uint256 dna, uint8 rapidFireLevel, uint8 plasmaDamageLevel, uint8 overdriveLevel, uint8 missilePodLevel, uint8 shipTier, uint256 mintedAt, string name))"
    ];

    let contract = null;
    let tokenIds = null;

    if (provider) {
      try {
        contract = new window.ethers.Contract(STARSHIP_CONTRACT_ADDRESS, abi, provider);
        tokenIds = await contract.tokensOfOwner(targetAddr);
      } catch (_err) {
        contract = null;
        tokenIds = null;
      }
    }

    if (!contract || tokenIds === null) {
      const fallbackRpcs = [
        "https://1rpc.io/matic",
        "https://rpc.ankr.com/polygon",
        "https://polygon-bor-rpc.publicnode.com"
      ];
      for (const rpc of fallbackRpcs) {
        try {
          const rpcProvider = new window.ethers.JsonRpcProvider(rpc);
          contract = new window.ethers.Contract(STARSHIP_CONTRACT_ADDRESS, abi, rpcProvider);
          tokenIds = await contract.tokensOfOwner(targetAddr);
          if (tokenIds !== null) break;
        } catch (_) {
          continue;
        }
      }
    }

    if (tokenIds && tokenIds.length > 0) {
      const chainFleet = [];
      for (let i = 0; i < tokenIds.length; i++) {
        const tokenId = Number(tokenIds[i]);
        const stats = await contract.getStarshipStats(tokenId);
        const rawName = stats.name || `Starship #${tokenId}`;
        let name = rawName.replace(/^Pilot Flagship/i, 'Starship');
        if (tokenId === 1 && (name === 'Starship #4' || !name)) name = 'Starship #1';
        chainFleet.push({
          tokenId,
          dna: Number(stats.dna),
          name,
          rapidFireLevel: Number(stats.rapidFireLevel),
          plasmaDamageLevel: Number(stats.plasmaDamageLevel),
          overdriveLevel: Number(stats.overdriveLevel),
          missilePodLevel: Number(stats.missilePodLevel),
          shipTier: Number(stats.shipTier)
        });
      }
      activeFleet = chainFleet;
      if (selectedFleetIndex >= activeFleet.length) {
        selectedFleetIndex = 0;
      }
      saveUserFleet(chainFleet);

      const equipped = getEquippedStarship();
      if (!equipped || !chainFleet.some(s => s.tokenId === equipped.tokenId)) {
        setEquippedStarship(chainFleet[0]);
      } else {
        const updatedEquipped = chainFleet.find(s => s.tokenId === equipped.tokenId);
        if (updatedEquipped) setEquippedStarship(updatedEquipped);
      }
      renderHangarModalUI();
      if (showToast) triggerToast(`🎉 Fleet synchronized! Found ${chainFleet.length} starship(s) on-chain.`, "success");
    } else {
      // 0 ships owned on-chain (e.g. sold on OpenSea or new address)
      activeFleet = [];
      saveUserFleet([]);
      localStorage.removeItem('polygame_equipped_starship');
      selectedFleetIndex = 0;
      demoShip = {
        isDemo: true,
        tokenId: 0,
        dna: Math.floor(100000 + Math.random() * 900000),
        name: "Demo Starship (Unowned)",
        rapidFireLevel: 1,
        plasmaDamageLevel: 1,
        overdriveLevel: 1,
        missilePodLevel: 1,
        shipTier: 1
      };
      renderHangarModalUI();
      if (showToast) triggerToast("No starships found on Polygon for this address.", "info");
    }
  } catch (err) {
    console.warn("Could not sync fleet from Polygon:", err);
    if (showToast) triggerToast("Failed to query on-chain fleet", "error");
  }
}

/**
 * Returns combat multipliers for Astro-Dodge (Strictly gated to Poss/Admin in Alpha)
 */
export function getEquippedStarshipBoosts() {
  const ship = getEquippedStarship();
  if (!ship || ship.isDemo) return { isEquipped: false };

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

  // Starship Multiplier Perks in Astro-Dodge:
  // Base Perk scales by Rarity: Rare = 1.1x (+10%), Epic = 1.2x (+20%), Legendary = 1.3x (+30%), Mythic = 1.5x (+50%)
  // Tier 3+ Multiplicative Milestone: Multiplies base multiplier by 1.5x when all 4 modules reach Lv3+ (or shipTier >= 3)
  // Yields: Rare = 1.65x (+65%), Epic = 1.80x (+80%), Legendary = 1.95x (+95%), Mythic = 2.25x (+125%)
  const isTier3Plus = (
    (ship.shipTier || 1) >= 3 ||
    (
      (ship.rapidFireLevel || 1) >= 3 &&
      (ship.plasmaDamageLevel || 1) >= 3 &&
      (ship.overdriveLevel || 1) >= 3 &&
      (ship.missilePodLevel || 1) >= 3
    )
  );
  const rarity = getStarshipRarity(ship.dna);
  const baseEarnMultiplier = rarity.baseEarnMultiplier || 1.1;
  const tierEarnMultiplier = isTier3Plus
    ? parseFloat((baseEarnMultiplier * 1.5).toFixed(2))
    : baseEarnMultiplier;

  return {
    isEquipped: true,
    ship,
    dna: ship.dna,
    shotCooldown,
    plasmaMultiplier,
    overdriveMultiplier,
    missileCooldown,
    isTier3Plus,
    baseEarnMultiplier,
    tierEarnMultiplier,
    rarity
  };
}

// --- HANGAR BAY MODAL CONTROLLER ---

let hangarAnimFrame = null;
let hangarAnimTime = 0;
let activeFleet = [];
let selectedFleetIndex = 0;
let demoShip = null;

export function openHangarModal() {
  activeFleet = getUserFleet();
  selectedFleetIndex = 0;

  if (activeFleet.length === 0) {
    // Generate an initial random demo ship for players with 0 ships
    demoShip = {
      isDemo: true,
      tokenId: 0,
      dna: Math.floor(100000 + Math.random() * 900000),
      name: "Demo Starship (Unowned)",
      rapidFireLevel: 1,
      plasmaDamageLevel: 1,
      overdriveLevel: 1,
      missilePodLevel: 1,
      shipTier: 1
    };
  }

  renderHangarModalUI();

  const modal = document.getElementById('modal-astro-hangar');
  if (modal) {
    // Top-layer Fullscreen DOM promotion:
    // When game-window-container is in native HTML5 Fullscreen on PC, promote modal into the
    // active fullscreen container so it renders on top of the fullscreen top-layer canvas.
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
    const targetParent = fsEl || document.body;
    if (modal.parentElement !== targetParent) {
      targetParent.appendChild(modal);
    }

    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.pointerEvents = 'auto';
  }

  startHangarCanvasLoop();

  // Asynchronously query live Polygon contract for pilot's real on-chain fleet
  syncFleetFromChain();
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
    // Restore modal to document.body when closed
    if (modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
  }
}

// Sync modal position if user toggles or exits HTML5 native fullscreen (e.g. presses ESC)
if (typeof document !== 'undefined') {
  const syncHangarModalTopLayer = () => {
    const modal = document.getElementById('modal-astro-hangar');
    if (!modal) return;
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
    if (fsEl) {
      if (modal.classList.contains('active') && modal.parentElement !== fsEl) {
        fsEl.appendChild(modal);
      }
    } else {
      if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
      }
    }
  };

  ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
    document.addEventListener(evt, syncHangarModalTopLayer);
  });
}

export function syncHangarButtonVisibility() {
  const btn = document.getElementById('btn-open-hangar');
  if (!btn) return;
  btn.style.display = 'inline-flex';
}

function getActivePreviewShip() {
  if (activeFleet && activeFleet.length > 0) {
    return activeFleet[selectedFleetIndex] || activeFleet[0];
  }
  return demoShip;
}

function startHangarCanvasLoop() {
  if (hangarAnimFrame) {
    cancelAnimationFrame(hangarAnimFrame);
    hangarAnimFrame = null;
  }

  const animate = () => {
    const canvas = document.getElementById('hangar-ship-canvas');
    if (!canvas) {
      hangarAnimFrame = null;
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      hangarAnimFrame = requestAnimationFrame(animate);
      return;
    }

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

    const ship = getActivePreviewShip();
    if (ship && ship.dna) {
      renderProceduralShip(
        ctx,
        canvas.width / 2,
        canvas.height / 2,
        ship.dna,
        1.55,
        0,
        hangarAnimTime,
        false
      );
    }

    hangarAnimFrame = requestAnimationFrame(animate);
  };

  hangarAnimFrame = requestAnimationFrame(animate);
}

function renderHangarModalUI() {
  const container = document.getElementById('hangar-modal-content');
  const ship = getActivePreviewShip();
  if (!container || !ship) return;

  const t = decodeDNA(ship.dna);
  const p = t.palette;
  const rarity = getStarshipRarity(ship.dna);
  const isDemo = !!ship.isDemo;
  const equippedShip = getEquippedStarship();
  const isCurrentlyEquipped = equippedShip && equippedShip.dna === ship.dna;
  const isTier3Plus = (
    (ship.shipTier || 1) >= 3 ||
    (
      (ship.rapidFireLevel || 1) >= 3 &&
      (ship.plasmaDamageLevel || 1) >= 3 &&
      (ship.overdriveLevel || 1) >= 3 &&
      (ship.missilePodLevel || 1) >= 3
    )
  );
  const t3ModulesCount = [ship.rapidFireLevel, ship.plasmaDamageLevel, ship.overdriveLevel, ship.missilePodLevel].filter(l => (l || 1) >= 3).length;
  const baseEarnMultiplier = rarity.baseEarnMultiplier || 1.1;
  const tierEarnMultiplier = isTier3Plus
    ? parseFloat((baseEarnMultiplier * 1.5).toFixed(2))
    : baseEarnMultiplier;
  const t3PotentialMultiplier = parseFloat((baseEarnMultiplier * 1.5).toFixed(2));

  // Fleet Navigation Tabs / Switcher Pills
  let fleetSelectorHtml = '';
  if (activeFleet.length > 0) {
    fleetSelectorHtml = `
      <div style="display: flex; gap: 0.45rem; flex-wrap: wrap; padding-bottom: 0.5rem; margin-bottom: 0.75rem; border-bottom: 1px dashed rgba(255,255,255,0.1); align-items: center;">
        ${activeFleet.map((s, idx) => {
          const isSelected = idx === selectedFleetIndex;
          const isEq = equippedShip && equippedShip.tokenId === s.tokenId;
          const sRarity = getStarshipRarity(s.dna);
          return `
            <button onclick="window.PolyHangar.selectShip(${idx})" style="padding: 0.42rem 0.8rem; font-size: 0.75rem; font-weight: 800; border-radius: 8px; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.45rem; transition: all 0.2s; background: ${isSelected ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.04)'}; border: 1px solid ${isSelected ? 'var(--color-primary)' : 'rgba(255,255,255,0.15)'}; color: ${isSelected ? '#00f0ff' : '#94a3b8'}; box-shadow: ${isSelected ? '0 0 10px rgba(0,240,255,0.3)' : 'none'};">
              <span>🛸 ${s.name || `Ship #${s.tokenId}`}</span>
              <span style="font-size: 0.62rem; padding: 1px 4px; border-radius: 3px; background: ${sRarity.bg}; color: ${sRarity.color}; border: 1px solid ${sRarity.border}; font-weight: 900;">${sRarity.badge}</span>
              <span style="font-size: 0.65rem; padding: 1px 4px; border-radius: 3px; background: rgba(255,255,255,0.1); color: #ffd700;">T${s.shipTier || 1}</span>
              ${isEq ? `<span style="font-size: 0.65rem; background: var(--color-success); color: #000; padding: 1px 4px; border-radius: 3px; font-weight: 900;">ACTIVE</span>` : ''}
            </button>
          `;
        }).join('')}
      </div>
    `;
  } else {
    fleetSelectorHtml = `
      <div style="background: rgba(255,180,0,0.1); border: 1px solid rgba(255,180,0,0.3); padding: 0.5rem 0.75rem; border-radius: 8px; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <span style="font-size: 0.75rem; color: #ffd700; font-weight: 700;">⚠️ Demo Mode: You do not own a Starship on-chain yet.</span>
        <div style="display: flex; gap: 0.4rem; align-items: center;">
          <button onclick="window.PolyHangar.mintNewStarship()" style="font-size: 0.75rem; font-weight: 800; padding: 0.35rem 0.75rem; background: linear-gradient(135deg, #00f0ff, #00ff88); color: #000; border: none; border-radius: 6px; cursor: pointer; box-shadow: 0 0 10px rgba(0,240,255,0.3);">
            🚀 Mint Starship (2.0 POL)
          </button>
          <button onclick="window.PolyHangar.syncFleetFromChain(null, true)" title="Check Polygon for recently purchased ships" style="font-size: 0.75rem; font-weight: 800; padding: 0.35rem 0.75rem; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 6px; cursor: pointer;">
            🔄 Sync On-Chain
          </button>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <button onclick="window.PolyHangar.closeHangarModal()" class="btn-modal-close" style="position: absolute; top: 0.85rem; right: 0.85rem; background: none; border: none; color: var(--text-dim); font-size: 1.6rem; cursor: pointer; line-height: 1; z-index: 10; padding: 0.2rem 0.5rem; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-dim)'" title="Close Hangar">&times;</button>

    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,240,255,0.25); padding-bottom: 0.75rem; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
      <div style="display: flex; align-items: center; gap: 0.6rem;">
        <span style="font-size: 1.5rem;">🛸</span>
        <div>
          <h2 style="font-size: 1.25rem; color: var(--color-primary); margin: 0; text-shadow: 0 0 10px rgba(0,240,255,0.4);">Starship Hangar & Tuning Bay</h2>
          <span style="font-size: 0.72rem; color: ${isDemo ? 'var(--color-warning)' : 'var(--color-success)'}; font-weight: 700;">
            ${isDemo ? '⭐ Demo Fleet Preview' : `🔒 Fleet: ${activeFleet.length} Active Ship(s)`}
          </span>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 0.45rem; padding-right: 2.2rem;">
        <button onclick="window.PolyHangar.mintNewStarship()" style="padding: 0.38rem 0.8rem; font-size: 0.78rem; font-weight: 800; border-radius: 8px; cursor: pointer; background: linear-gradient(135deg, #00f0ff, #00ff88); color: #000; border: none; box-shadow: 0 0 12px rgba(0,240,255,0.4); display: flex; align-items: center; gap: 0.35rem; transition: transform 0.15s ease;" title="Mint a new procedural starship on Polygon (2.0 POL)">
          <span>🚀 Mint (2.0 POL)</span>
        </button>
        <button onclick="window.PolyHangar.syncFleetFromChain(null, true)" title="Query Polygon blockchain to refresh your fleet (syncs OpenSea buys/sales)" style="padding: 0.38rem 0.65rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px; cursor: pointer; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; display: flex; align-items: center; gap: 0.3rem;">
          <span>🔄 Sync</span>
        </button>
        <a href="https://opensea.io/assets/polygon/0xDa8D9a452Ac8e7f3F29d0980fD1c642AeB036F99" target="_blank" rel="noopener noreferrer" title="View Starship Fleet on OpenSea" style="padding: 0.38rem 0.65rem; font-size: 0.78rem; font-weight: 700; border-radius: 8px; text-decoration: none; background: rgba(32, 129, 226, 0.15); border: 1px solid rgba(32, 129, 226, 0.4); color: #2081e2; display: flex; align-items: center; gap: 0.3rem;">
          <span>⛵ OpenSea ↗</span>
        </a>
      </div>
    </div>

    ${fleetSelectorHtml}

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; align-items: start;">
      
      <!-- Left Column: Ship 60FPS Preview & Actions -->
      <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(0,240,255,0.2); border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
        ${activeFleet.length > 1 ? `
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; max-width: 300px; padding: 0.1rem 0.25rem;">
            <button onclick="window.PolyHangar.prevShip()" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 6px; padding: 0.25rem 0.65rem; font-size: 0.8rem; font-weight: 800; cursor: pointer; transition: all 0.2s;" title="Previous Starship">◀ Prev</button>
            <span style="font-size: 0.75rem; font-weight: 800; color: #00f0ff; font-family: monospace;">Ship ${selectedFleetIndex + 1} of ${activeFleet.length}</span>
            <button onclick="window.PolyHangar.nextShip()" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.2); color: #fff; border-radius: 6px; padding: 0.25rem 0.65rem; font-size: 0.8rem; font-weight: 800; cursor: pointer; transition: all 0.2s;" title="Next Starship">Next ▶</button>
          </div>
        ` : ''}

        <canvas id="hangar-ship-canvas" width="300" height="300" style="border-radius: 8px; border: 1px solid rgba(0,240,255,0.3); background: #02040a; width: 100%; max-width: 300px; aspect-ratio: 1/1;"></canvas>
        
        <div style="text-align: center; width: 100%;">
          <div style="font-size: 1.05rem; font-weight: 800; color: #fff; display: flex; align-items: center; justify-content: center; gap: 0.45rem; flex-wrap: wrap;">
            <span>${ship.name}</span>
            <span style="font-size: 0.68rem; font-weight: 900; padding: 2px 7px; border-radius: 4px; background: ${rarity.bg}; color: ${rarity.color}; border: 1px solid ${rarity.border}; text-transform: uppercase; letter-spacing: 0.5px;">
              ${rarity.badge}
            </span>
          </div>
          <div style="font-size: 0.78rem; font-family: monospace; color: var(--color-accent); letter-spacing: 1px; margin-top: 2px;">
            ${ship.tokenId ? `Token #${ship.tokenId} &bull; ` : ''}DNA #${ship.dna} &bull; Tier ${ship.shipTier || 1} &bull; <span style="color:${rarity.color}; font-weight: 700;">Score: ${rarity.score}/100</span>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.5rem; width: 100%;">
          ${isDemo ? `
            <div style="display: flex; gap: 0.5rem; width: 100%;">
              <button onclick="window.PolyHangar.rollDemoDNA()" style="flex: 1; padding: 0.6rem 0.5rem; font-size: 0.8rem; font-weight: 700; background: rgba(189,0,255,0.2); border: 1px solid #bd00ff; color: #fff; border-radius: 8px; cursor: pointer;">
                🎲 Roll Demo Ship
              </button>
              <button onclick="window.PolyHangar.mintNewStarship()" style="flex: 1.5; padding: 0.6rem 0.5rem; font-size: 0.85rem; font-weight: 800; background: linear-gradient(135deg, #00f0ff, #00ff88); border: none; color: #000; border-radius: 8px; cursor: pointer; box-shadow: 0 0 12px rgba(0,240,255,0.4);">
                🚀 Mint Ship (2.0 POL)
              </button>
            </div>
          ` : `
            <button onclick="window.PolyHangar.equipSelectedShip()" style="width: 100%; padding: 0.65rem 0.5rem; font-size: 0.85rem; font-weight: 800; background: ${isCurrentlyEquipped ? 'rgba(0,255,136,0.2)' : 'linear-gradient(135deg, #00f0ff, #00ff88)'}; border: ${isCurrentlyEquipped ? '1px solid #00ff88' : 'none'}; color: ${isCurrentlyEquipped ? '#00ff88' : '#000'}; border-radius: 8px; cursor: pointer; box-shadow: 0 0 12px rgba(0,240,255,0.3);">
              ${isCurrentlyEquipped ? '✅ Active Starship' : '🚀 Equip for Astro-Dodge'}
            </button>
            <button onclick="window.PolyHangar.mintNewStarship()" style="width: 100%; padding: 0.55rem 0.5rem; font-size: 0.82rem; font-weight: 800; background: rgba(0,255,136,0.12); border: 1px dashed #00ff88; color: #00ff88; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.4rem; transition: all 0.2s;" title="Mint an additional procedural Starship on Polygon for 2.0 POL">
              <span>➕ Mint Another Starship (2.0 POL)</span>
            </button>
          `}
        </div>
      </div>

      <!-- Right Column: Procedural Traits & Combat Skills -->
      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        
        <!-- Trait Breakdown -->
        <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 0.85rem;">
          <div style="font-size: 0.78rem; font-weight: 800; color: var(--color-primary); text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center;">
            <span>🧬 Procedural Trait Breakdown</span>
            <span style="font-size: 0.68rem; padding: 2px 6px; border-radius: 4px; background: ${rarity.bg}; color: ${rarity.color}; border: 1px solid ${rarity.border}; font-weight: 800;">
              🔥 Thruster Fire: ${rarity.flameName}
            </span>
          </div>
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
          <div style="font-size: 0.78rem; font-weight: 800; color: var(--color-success); text-transform: uppercase; margin-bottom: 0.65rem; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center;">
            <span>⚡ On-Chain Combat Modules ${isDemo ? '<span style="color:#ffd700; font-size:0.68rem;">(Preview Only)</span>' : ''}</span>
            <span style="font-size: 0.68rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; ${isTier3Plus ? 'background: rgba(0,255,136,0.2); color: #00ff88; border: 1px solid #00ff88;' : 'background: rgba(0,240,255,0.12); color: #00f0ff; border: 1px solid rgba(0,240,255,0.3);'}">
              Tier ${ship.shipTier || 1} ${isTier3Plus ? `★ ${tierEarnMultiplier}x Boost` : `★ ${baseEarnMultiplier}x Boost`}
            </span>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 0.65rem;">
            ${renderSkillRow('⚡ Rapid Fire', ship.rapidFireLevel, 'Cadence: 140 → 90 ms', 0, isDemo)}
            ${renderSkillRow('💥 Plasma Beam', ship.plasmaDamageLevel, 'Damage: 1.0x → 2.6x', 1, isDemo)}
            ${renderSkillRow('🛡️ Overdrive Matrix', ship.overdriveLevel, 'Duration: 20 → 35s', 2, isDemo)}
            ${renderSkillRow('🚀 Micro-Missiles', ship.missilePodLevel, 'Cadence: 2.0 → 1.0s', 3, isDemo)}
          </div>

          <!-- Tier 3+ Combat Multiplier Milestone Perk -->
          <div style="margin-top: 0.75rem; padding: 0.6rem 0.8rem; border-radius: 8px; font-size: 0.75rem; display: flex; align-items: center; justify-content: space-between; ${isTier3Plus ? 'background: linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,240,255,0.15)); border: 1px solid #00ff88; box-shadow: 0 0 12px rgba(0,255,136,0.25);' : 'background: rgba(0,240,255,0.06); border: 1px solid rgba(0,240,255,0.25);'}">
            <div>
              <div style="font-weight: 800; color: ${isTier3Plus ? '#00ff88' : '#00f0ff'}; display: flex; align-items: center; gap: 0.35rem;">
                <span>${isTier3Plus ? `⚡ Tier 3+ Perk: +${Math.round((tierEarnMultiplier - 1) * 100)}% PGT Earn Boost (${tierEarnMultiplier}x) Active` : `✨ ${rarity.name} Perk: +${Math.round((baseEarnMultiplier - 1) * 100)}% PGT Earn Boost (${baseEarnMultiplier}x) Active`}</span>
              </div>
              <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 2px;">
                ${isTier3Plus ? `${tierEarnMultiplier}x Astro-Dodge payout multiplier active on every arcade flight!` : `${baseEarnMultiplier}x payout boost active! Upgrade all 4 combat modules to Level 3 to unlock permanent ${t3PotentialMultiplier}x PGT earn boost.`}
              </div>
            </div>
            <div style="font-size: 0.82rem; font-weight: 900; color: ${isTier3Plus ? '#ffd700' : '#00f0ff'}; white-space: nowrap; margin-left: 0.5rem;">
              ${isTier3Plus ? `🔥 ${tierEarnMultiplier}x ACTIVE` : `✨ ${baseEarnMultiplier}x (${t3ModulesCount}/4 at Lv3+)`}
            </div>
          </div>
        </div>

        <div style="font-size: 0.72rem; color: #64748b; line-height: 1.4; text-align: center;">
          🔥 <em>100% On-Chain Polygon Smart Contract &bull; Mint: 2.0 POL &bull; Upgrades: 10% Burn / 90% Treasury in a single atomic transaction.</em>
        </div>

      </div>

    </div>
  `;

  // Immediately bind/restart 60FPS animation loop for the newly created canvas in the DOM
  startHangarCanvasLoop();
}

function renderSkillRow(name, level, effectText, skillType, isDemo) {
  let pips = '';
  for (let i = 1; i <= 5; i++) {
    const active = i <= level;
    pips += `<span style="display: block; width: 8px; height: 5px; border-radius: 2px; flex-shrink: 0; background: ${active ? 'var(--color-primary)' : 'rgba(255,255,255,0.15)'}; box-shadow: ${active ? '0 0 5px var(--color-primary)' : 'none'};"></span>`;
  }

  const isMax = level >= 5;
  const costLabels = ['5k PGT', '42.5k PGT', '85k PGT', '150k PGT'];
  const nextCostLabel = costLabels[level - 1] || 'MAX';
  const fullUpgradeCosts = ['5,000 PGT', '42,500 PGT', '85,000 PGT', '150,000 PGT'];
  const nextCostFull = fullUpgradeCosts[level - 1] || 'MAX';

  let actionBtn = '';
  if (isDemo) {
    actionBtn = `<span style="font-size: 0.68rem; color: #94a3b8; font-style: italic; white-space: nowrap; flex-shrink: 0;">Locked</span>`;
  } else if (isMax) {
    actionBtn = `<span style="font-size: 0.7rem; color: var(--color-success); font-weight: 800; white-space: nowrap; flex-shrink: 0;">MAX</span>`;
  } else {
    actionBtn = `<button onclick="window.PolyHangar.upgradeSkill(${skillType})" style="font-size: 0.68rem; padding: 0.2rem 0.42rem; background: rgba(0,240,255,0.15); border: 1px solid var(--color-primary); color: var(--color-primary); border-radius: 4px; font-weight: 700; cursor: pointer; white-space: nowrap; flex-shrink: 0; line-height: 1.2;" title="Cost: ${nextCostFull} (10% Burn / 90% Treasury)">+1lvl (${nextCostLabel})</button>`;
  }

  return `
    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 0.4rem 0.55rem; border-radius: 6px; gap: 0.45rem;">
      <div style="min-width: 0; flex: 1;">
        <div style="font-size: 0.78rem; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</div>
        <div style="font-size: 0.66rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${effectText}</div>
      </div>
      <div style="display: flex; align-items: center; gap: 0.45rem; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 2px; flex-shrink: 0; white-space: nowrap;">${pips}</div>
        ${actionBtn}
      </div>
    </div>
  `;
}

// --- FLEET SWITCHING ACTIONS ---

export function selectShip(index) {
  if (activeFleet && activeFleet[index]) {
    selectedFleetIndex = index;
    renderHangarModalUI();
  }
}

export function prevShip() {
  if (!activeFleet || activeFleet.length <= 1) return;
  selectedFleetIndex = (selectedFleetIndex - 1 + activeFleet.length) % activeFleet.length;
  renderHangarModalUI();
}

export function nextShip() {
  if (!activeFleet || activeFleet.length <= 1) return;
  selectedFleetIndex = (selectedFleetIndex + 1) % activeFleet.length;
  renderHangarModalUI();
}

export function rollDemoDNA() {
  if (!demoShip) return;
  demoShip.dna = Math.floor(100000 + Math.random() * 900000);
  renderHangarModalUI();
}

export function equipSelectedShip() {
  const ship = getActivePreviewShip();
  if (!ship || ship.isDemo) return;
  setEquippedStarship(ship);
  renderHangarModalUI();
  const isT3 = (ship.shipTier || 1) >= 3 || (
    (ship.rapidFireLevel || 1) >= 3 &&
    (ship.plasmaDamageLevel || 1) >= 3 &&
    (ship.overdriveLevel || 1) >= 3 &&
    (ship.missilePodLevel || 1) >= 3
  );
  const rarity = getStarshipRarity(ship.dna);
  const baseEarnMultiplier = rarity.baseEarnMultiplier || 1.1;
  const activeMultiplier = isT3 ? parseFloat((baseEarnMultiplier * 1.5).toFixed(2)) : baseEarnMultiplier;
  const boostMsg = isT3
    ? ` ⚡ ${activeMultiplier}x Tier 3+ PGT Earn Boost Active!`
    : ` ✨ ${activeMultiplier}x ${rarity.name} PGT Earn Boost Active!`;
  triggerToast(`🚀 Starship "${ship.name}" [${rarity.badge}] is now equipped for Astro-Dodge!${boostMsg}`, 'success');
}

// --- MINTING LOGIC (2.0 POL) ---

export async function mintNewStarship() {
  const isGoogle = isGoogleSessionActive();
  const hasWeb3 = hasWeb3WalletConnected();

  // When someone is connected with Google without an active Web3 wallet, do NOT try to connect
  if (isGoogle && !hasWeb3) {
    triggerToast("Please sign in or connect your Web3 wallet first.", "warning");
    if (typeof window.openModal === 'function') window.openModal('wallet');
    return;
  }

  // If not connected to any Web3 wallet at all and not admin testing
  if (!hasWeb3 && (!window.ethereum || !window.appState?.state?.walletConnected) && !isPossOrAdmin()) {
    triggerToast("Please sign in or connect your Web3 wallet first.", "warning");
    if (typeof window.openModal === 'function') window.openModal('wallet');
    return;
  }

  // If smart contract is deployed on Polygon:
  if (STARSHIP_CONTRACT_ADDRESS && window.ethers) {
    try {
      let signer = (typeof window.realSigner !== 'undefined' && window.realSigner) ? window.realSigner : null;
      if (!signer && window.web3Provider && typeof window.web3Provider.getSigner === 'function') {
        signer = await window.web3Provider.getSigner();
      }
      if (!signer && typeof window.ethereum !== 'undefined' && !isGoogle) {
        const provider = new window.ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
      }

      if (!signer) {
        triggerToast("Please sign in or connect your Web3 wallet first.", "warning");
        if (typeof window.openModal === 'function') window.openModal('wallet');
        return;
      }

      const userAddr = await signer.getAddress();
      
      const abi = [
        "function mintStarship(string memory customName) external payable returns (uint256)",
        "function mintFee() external view returns (uint256)",
        "function totalSupply() external view returns (uint256)"
      ];
      const contract = new window.ethers.Contract(STARSHIP_CONTRACT_ADDRESS, abi, signer);

      const currentSupply = await contract.totalSupply().catch(() => BigInt(activeFleet.length));
      const nextShipNum = Number(currentSupply) + 1;

      triggerToast("Connecting to Polygon wallet to mint Starship (2.0 POL)...", "info");
      const feeWei = window.ethers.parseEther("2.0");
      const tx = await contract.mintStarship(`Starship #${nextShipNum}`, { value: feeWei });

      triggerToast("Transaction broadcast! Waiting for Polygon block confirmation...", "info");
      await tx.wait();

      triggerToast("🎉 Starship minted successfully on Polygon!", "success");
      await syncFleetFromChain(userAddr, true);
      return;
    } catch (err) {
      console.error("On-chain starship mint error:", err);
      triggerToast(err.reason || err.message || "Minting failed or rejected", "error");
      return;
    }
  }

  // Alpha Test Fallback Mint (offline / Poss Admin testing only)
  if (isPossOrAdmin()) {
    const newDna = Math.floor(100000 + Math.random() * 900000);
    const newShip = {
      tokenId: activeFleet.length + 1,
      dna: newDna,
      name: `Starship #${activeFleet.length + 1}`,
      rapidFireLevel: 1,
      plasmaDamageLevel: 1,
      overdriveLevel: 1,
      missilePodLevel: 1,
      shipTier: 1
    };
    activeFleet.push(newShip);
    saveUserFleet(activeFleet);
    selectedFleetIndex = activeFleet.length - 1;
    setEquippedStarship(newShip);
    renderHangarModalUI();
    triggerToast(`🎉 Starship #${activeFleet.length} (DNA #${newDna}) minted and added to your fleet!`, 'success');
  }
}

// --- SKILL UPGRADE LOGIC ---

export async function upgradeSkill(skillType) {
  const ship = getActivePreviewShip();
  if (!ship || ship.isDemo) return;

  const currentLevel = (
    skillType === 0 ? ship.rapidFireLevel :
    skillType === 1 ? ship.plasmaDamageLevel :
    skillType === 2 ? ship.overdriveLevel :
    ship.missilePodLevel
  );

  if (currentLevel >= 5) {
    triggerToast("Skill is already at maximum Level 5!", "info");
    return;
  }

  const isGoogle = isGoogleSessionActive();
  const hasWeb3 = hasWeb3WalletConnected();

  // When someone is connected with Google without an active Web3 wallet, do NOT try to connect
  if (isGoogle && !hasWeb3) {
    triggerToast("Please sign in or connect your Web3 wallet first.", "warning");
    if (typeof window.openModal === 'function') window.openModal('wallet');
    return;
  }

  // If not connected to any Web3 wallet at all and not admin testing
  if (!hasWeb3 && (!window.ethereum || !window.appState?.state?.walletConnected) && !isPossOrAdmin()) {
    triggerToast("Please sign in or connect your Web3 wallet first.", "warning");
    if (typeof window.openModal === 'function') window.openModal('wallet');
    return;
  }

  // If on-chain contract is deployed, execute real Web3 upgrade transaction
  if (STARSHIP_CONTRACT_ADDRESS && window.ethers) {
    try {
      let signer = (typeof window.realSigner !== 'undefined' && window.realSigner) ? window.realSigner : null;
      if (!signer && window.web3Provider && typeof window.web3Provider.getSigner === 'function') {
        signer = await window.web3Provider.getSigner();
      }
      if (!signer && typeof window.ethereum !== 'undefined' && !isGoogle) {
        const provider = new window.ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
      }

      if (!signer) {
        triggerToast("Please sign in or connect your Web3 wallet first.", "warning");
        if (typeof window.openModal === 'function') window.openModal('wallet');
        return;
      }

      const userAddr = await signer.getAddress();

      const costRaw = [5000, 42500, 85000, 150000][currentLevel - 1] || 5000;
      const costWei = window.ethers.parseEther(costRaw.toString());

      // Check ERC20 PGT allowance
      const pgtAbi = [
        "function allowance(address owner, address spender) external view returns (uint256)",
        "function approve(address spender, uint256 amount) external returns (bool)"
      ];
      const pgtContract = new window.ethers.Contract(TOKEN_CONTRACT_ADDRESS, pgtAbi, signer);
      const allowance = await pgtContract.allowance(userAddr, STARSHIP_CONTRACT_ADDRESS);

      if (allowance < costWei) {
        triggerToast(`Requesting PGT allowance (${costRaw.toLocaleString()} PGT) in wallet...`, "info");
        const approveTx = await pgtContract.approve(STARSHIP_CONTRACT_ADDRESS, window.ethers.MaxUint256);
        triggerToast("PGT Approval broadcast! Waiting for confirmation...", "info");
        await approveTx.wait();
        triggerToast("PGT approved! Proceeding with combat upgrade...", "success");
      }

      triggerToast("Preparing on-chain PGT upgrade transaction (10% Burn 🔥 / 90% Treasury)...", "info");
      const shipAbi = [
        "function upgradeSkillWithPGT(uint256 tokenId, uint8 skillType) external"
      ];
      const contract = new window.ethers.Contract(STARSHIP_CONTRACT_ADDRESS, shipAbi, signer);
      const tx = await contract.upgradeSkillWithPGT(ship.tokenId || 1, skillType);
      triggerToast("Upgrade transaction sent to Polygon...", "info");
      await tx.wait();
      triggerToast("🎉 Combat skill upgraded on-chain! 10% PGT burned.", "success");

      await syncFleetFromChain(userAddr);
      return;
    } catch (err) {
      console.error("On-chain skill upgrade error:", err);
      triggerToast(err.reason || err.message || "Skill upgrade rejected", "error");
      return;
    }
  }

  // Local fallback (Poss Admin testing only)
  if (isPossOrAdmin()) {
    if (skillType === 0) ship.rapidFireLevel++;
    if (skillType === 1) ship.plasmaDamageLevel++;
    if (skillType === 2) ship.overdriveLevel++;
    if (skillType === 3) ship.missilePodLevel++;

    ship.shipTier = Math.max(1, Math.floor(
      (ship.rapidFireLevel + ship.plasmaDamageLevel + ship.overdriveLevel + ship.missilePodLevel) / 4
    ));

    saveUserFleet(activeFleet);
    const eq = getEquippedStarship();
    if (eq && eq.dna === ship.dna) {
      setEquippedStarship(ship);
    }

    renderHangarModalUI();
    triggerToast(`⚡ Skill upgraded to Level ${currentLevel + 1}! (10% PGT Burned 🔥 & 90% Treasury)`, 'success');
  }
}

// --- OWNER / ADMIN CONTRACT BASE URI CONFIGURATION ---

export async function syncContractBaseURI() {
  if (!STARSHIP_CONTRACT_ADDRESS || typeof window.ethereum === 'undefined' || !window.ethers) {
    triggerToast("Web3 wallet required to call contract admin function", "error");
    return;
  }
  const defaultURI = "https://jgtfnsufemvqkyytscgl.supabase.co/functions/v1/starship-metadata/";
  const newURI = window.prompt(
    "Set Base URI for Starship NFT Contract.\nThis points to the dynamic serverless Edge Function so all newly minted ships load on OpenSea automatically without GitHub commits:",
    defaultURI
  );
  if (!newURI) return;

  try {
    const provider = new window.ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const shipAbi = [
      "function setBaseURI(string memory newBaseURI) external",
      "function baseTokenURI() external view returns (string memory)"
    ];
    const contract = new window.ethers.Contract(STARSHIP_CONTRACT_ADDRESS, shipAbi, signer);

    triggerToast("Please confirm setBaseURI in your wallet...", "info");
    const tx = await contract.setBaseURI(newURI.trim());
    triggerToast("Updating contract baseTokenURI on Polygon...", "info");
    await tx.wait();
    triggerToast("🎉 Contract baseTokenURI updated! OpenSea now streams dynamic SVGs for all players worldwide.", "success");
  } catch (err) {
    console.error("setBaseURI failed:", err);
    triggerToast(err.reason || err.message || "setBaseURI transaction rejected", "error");
  }
}

// Expose on global window object for legacy game scripts
window.PolyHangar = {
  isPossOrAdmin,
  decodeDNA,
  getStarshipRarity,
  STARSHIP_RARITY,
  renderProceduralShip,
  getUserFleet,
  getEquippedStarship,
  setEquippedStarship,
  getEquippedStarshipBoosts,
  syncFleetFromChain,
  openHangarModal,
  closeHangarModal,
  syncHangarButtonVisibility,
  selectShip,
  prevShip,
  nextShip,
  rollDemoDNA,
  equipSelectedShip,
  mintNewStarship,
  upgradeSkill,
  syncContractBaseURI
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
