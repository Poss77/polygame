// ==============================================================================
// POLYGAME: CYBER DEFENSE 2D TOWER DEFENSE ARCADE ENGINE
// Tactical Neon Circuit Defense with 4 Upgradeable Turrets, Malware Waves,
// Boss Battles, Responsive Canvas, Audio FX, and Secure PGT Session Payouts.
// ==============================================================================

import { appState } from './src/js/core/state.js';
import { sfx } from './src/js/core/audio.js';
import { triggerConfetti } from './src/js/utils/confetti.js';

// --- Multi-Sector Map Registry (Option A: 4 Handcrafted Cyberpunk Sectors) ---
export const DEFENSE_SECTORS = [
  {
    id: 'alpha',
    number: 1,
    name: 'Sector Alpha // Circuit Highway',
    desc: 'Classic S-curve gauntlet with alternating chokepoints. Balanced baseline.',
    waypoints: [
      { x: 0,   y: 150 },
      { x: 180, y: 150 },
      { x: 180, y: 320 },
      { x: 360, y: 320 },
      { x: 360, y: 120 },
      { x: 540, y: 120 },
      { x: 540, y: 260 },
      { x: 740, y: 260 }
    ],
    core: { x: 740, y: 260 },
    pads: [
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
  },
  {
    id: 'beta',
    number: 2,
    name: 'Sector Beta // Twin Spiral',
    desc: 'Concentric orbital spiral route. Central perches cover multiple lanes.',
    waypoints: [
      { x: 0,   y: 90 },
      { x: 680, y: 90 },
      { x: 680, y: 360 },
      { x: 150, y: 360 },
      { x: 150, y: 210 },
      { x: 450, y: 210 }
    ],
    core: { x: 450, y: 210 },
    pads: [
      { id: 1,  x: 280, y: 150 },
      { id: 2,  x: 420, y: 150 },
      { id: 3,  x: 560, y: 150 },
      { id: 4,  x: 280, y: 285 },
      { id: 5,  x: 420, y: 285 },
      { id: 6,  x: 560, y: 285 },
      { id: 7,  x: 70,  y: 210 },
      { id: 8,  x: 750, y: 90 },
      { id: 9,  x: 750, y: 240 },
      { id: 10, x: 750, y: 360 },
      { id: 11, x: 150, y: 420 },
      { id: 12, x: 560, y: 390 }
    ]
  },
  {
    id: 'gamma',
    number: 3,
    name: 'Sector Gamma // The Zig-Zag Trench',
    desc: 'Three sweeping horizontal corridors. Maximum line penetration for Railguns.',
    waypoints: [
      { x: 0,   y: 80 },
      { x: 700, y: 80 },
      { x: 700, y: 225 },
      { x: 100, y: 225 },
      { x: 100, y: 370 },
      { x: 740, y: 370 }
    ],
    core: { x: 740, y: 370 },
    pads: [
      { id: 1,  x: 200, y: 150 },
      { id: 2,  x: 350, y: 150 },
      { id: 3,  x: 500, y: 150 },
      { id: 4,  x: 650, y: 150 },
      { id: 5,  x: 150, y: 300 },
      { id: 6,  x: 300, y: 300 },
      { id: 7,  x: 450, y: 300 },
      { id: 8,  x: 600, y: 300 },
      { id: 9,  x: 765, y: 150 },
      { id: 10, x: 35,  y: 300 },
      { id: 11, x: 350, y: 25 },
      { id: 12, x: 450, y: 420 }
    ]
  },
  {
    id: 'delta',
    number: 4,
    name: 'Sector Delta // Quantum Singularity',
    desc: 'Hourglass choke funnel. Devastating center killbox for EMP & Plasma mortars.',
    waypoints: [
      { x: 0,   y: 60 },
      { x: 240, y: 60 },
      { x: 380, y: 225 },
      { x: 420, y: 225 },
      { x: 560, y: 60 },
      { x: 720, y: 60 },
      { x: 720, y: 380 },
      { x: 480, y: 380 }
    ],
    core: { x: 480, y: 380 },
    pads: [
      { id: 1,  x: 400, y: 145 },
      { id: 2,  x: 400, y: 305 },
      { id: 3,  x: 310, y: 225 },
      { id: 4,  x: 490, y: 225 },
      { id: 5,  x: 120, y: 120 },
      { id: 6,  x: 120, y: 300 },
      { id: 7,  x: 240, y: 140 },
      { id: 8,  x: 560, y: 140 },
      { id: 9,  x: 650, y: 140 },
      { id: 10, x: 650, y: 300 },
      { id: 11, x: 770, y: 220 },
      { id: 12, x: 400, y: 420 }
    ]
  }
];

export class CyberDefenseEngine {
  constructor() {
    this.canvas = document.getElementById('defense-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.state = 'IDLE'; // IDLE, PLAYING, GAMEOVER, VICTORY
    this.sessionId = null;
    this.isStarting = false;
    this.animationFrameId = null;
    this.lastTime = 0;

    // Game Economy & Core Stats
    this.coreHp = 10;
    this.maxCoreHp = 10;
    this.energy = 250; // Starting energy (calibrated for comfortable early-game foundation)
    this.score = 0;
    this.creepsKilled = 0;
    this.wave = 0;
    this.maxWaves = 25;
    this.speeds = [1, 2, 4];
    this.gameSpeed = 1;

    // Wave Spawning & Tactical Prep Phase
    this.waveActive = false;
    this.isPrepPhase = false;
    this.prepTimer = 0;
    this.prepDuration = 15.0; // 15-second strategic build phase
    this.autoWave = false;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.spawnInterval = 0.85;

    // Turret Selection & Active Sockets
    this.selectedTurretType = 'laser'; // laser, plasma, emp, railgun
    this.selectedActiveTurret = null;  // For inspection/upgrade
    this.globalTick = 0;

    // Entities (Must be initialized before loadSector / draw)
    this.creeps = [];
    this.turrets = [];
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];

    // Screen FX
    this.screenShake = 0;
    this.corePulse = 0;

    // Multi-Sector Map Registry & Tactical Mod Pads
    this.sectors = DEFENSE_SECTORS;
    this.currentSectorIndex = 0;
    this.currentSector = this.sectors[0];
    this.waypoints = [];
    this.pads = [];
    this.loadSector(0);

    this.initEvents();
  }

  // --- Input & Touch Setup ---
  initEvents() {
    if (!this.canvas) return;

    window.addEventListener('resize', () => this.resizeCanvas());
    this.resizeCanvas();

    // Canvas Tap/Click Handler
    const handleAction = (clientX, clientY) => {
      if (this.state !== 'PLAYING') return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;
      this.handleClick(x, y);
    };

    this.canvas.addEventListener('click', (e) => {
      if (!e || e.isTrusted !== true) {
        if (window.antiBot) window.antiBot.reportSuspiciousActivity('Cyber Defense', 'untrusted_input');
        return;
      }
      handleAction(e.clientX, e.clientY);
    });

    // 2. Turret Selection Button Listeners (Robust mobile touch + desktop click)
    this.setupTurretButtons();

    this.updateSectorUI();
    // Render initial preview on canvas if idle
    if (this.ctx && this.state === 'IDLE') {
      this.draw();
    }
  }

  setupTurretButtons() {
    const buttons = document.querySelectorAll('.turret-select-btn');
    buttons.forEach(btn => {
      const type = btn.getAttribute('data-turret-type');
      if (!type) return;

      if (btn._defenseHandler) {
        btn.removeEventListener('pointerdown', btn._defenseHandler);
        btn.removeEventListener('touchstart', btn._defenseHandler);
        btn.removeEventListener('click', btn._defenseHandler);
      }

      const handleSelect = (e) => {
        if (e) {
          if (e.isTrusted !== true) {
            if (window.antiBot) window.antiBot.reportSuspiciousActivity('Cyber Defense', 'untrusted_input');
            return;
          }
          if (e.cancelable && e.type !== 'touchstart') e.preventDefault();
          e.stopPropagation();
        }
        this.selectTurretType(type);
      };

      btn._defenseHandler = handleSelect;
      btn.addEventListener('pointerdown', handleSelect);
      btn.addEventListener('touchstart', handleSelect, { passive: true });
      btn.addEventListener('click', handleSelect);
    });
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const wrapper = document.getElementById('container-defense');
    if (wrapper) {
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
    }
  }

  // --- Turret Specifications (L1, L2, L3) ---
  getTurretConfig(type, level = 1) {
    const configs = {
      laser: {
        name: 'Laser Turret',
        color: '#00f0ff',
        cost: level === 1 ? 100 : (level === 2 ? 140 : 300),
        range: level === 1 ? 120 : (level === 2 ? 145 : 175),
        damage: level === 1 ? 9.0 : (level === 2 ? 19 : 38),
        rate: level === 1 ? 0.20 : (level === 2 ? 0.17 : 0.14),
        desc: 'Rapid precision beam. Point defense specialized against fast swarm units.'
      },
      plasma: {
        name: 'Plasma Mortar',
        color: '#ff00aa',
        cost: level === 1 ? 150 : (level === 2 ? 210 : 420),
        range: level === 1 ? 140 : (level === 2 ? 170 : 205),
        damage: level === 1 ? 120 : (level === 2 ? 240 : 480),
        splash: level === 1 ? 65 : (level === 2 ? 85 : 110),
        rate: level === 1 ? 3.00 : (level === 2 ? 2.60 : 2.20),
        desc: 'Heavy anti-titan siege mortar. Slow fire rate with devastating 2.2x heavy impact against Bosses.'
      },
      emp: {
        name: 'EMP Frost Pylon',
        color: '#00ffaa',
        cost: level === 1 ? 120 : (level === 2 ? 170 : 320),
        range: level === 1 ? 115 : (level === 2 ? 140 : 170),
        damage: level === 1 ? 8 : (level === 2 ? 18 : 34),
        slow: level === 1 ? 0.50 : (level === 2 ? 0.65 : 0.80),
        slowDuration: level === 1 ? 2.5 : (level === 2 ? 3.2 : 4.0),
        rate: level === 1 ? 1.05 : (level === 2 ? 0.92 : 0.80),
        desc: 'Radial cryo pulse. Slows units, shatters shields (3.5x), & chilled targets take +25% damage.'
      },
      railgun: {
        name: 'Railgun Sniper',
        color: '#ffaa00',
        cost: level === 1 ? 200 : (level === 2 ? 280 : 520),
        range: level === 1 ? 220 : (level === 2 ? 265 : 320),
        damage: level === 1 ? 90 : (level === 2 ? 180 : 360),
        rate: level === 1 ? 1.90 : (level === 2 ? 1.70 : 1.50),
        desc: 'Hypervelocity line-piercing sniper. 100% Armor Penetration & 2x damage vs Armored Trojans.'
      }
    };
    return configs[type] || configs.laser;
  }

  // --- Tactical Special Mod Pads Stat Effects Pipeline (Option C) ---
  getEffectiveTurretConfig(t) {
    const base = this.getTurretConfig(t.type, t.level);
    const mod = t.pad ? t.pad.modifier : null;
    if (!mod) return base;

    const conf = { ...base };
    if (mod === 'overclock') {
      conf.rate = Number((base.rate * 0.75).toFixed(2)); // +25% Attack Speed (faster cooldown interval)
    } else if (mod === 'spotter') {
      conf.range = Math.round(base.range * 1.30);       // +30% Targeting Range
    } else if (mod === 'amplifier') {
      conf.damage = Math.round(base.damage * 1.20);     // +20% Raw Projectile Damage
    }
    return conf;
  }

  // --- Sector Management & Tactical Mod Pads Seeding ---
  loadSector(indexOrKey) {
    let index = 0;
    if (typeof indexOrKey === 'number') {
      index = ((indexOrKey % this.sectors.length) + this.sectors.length) % this.sectors.length;
    } else if (typeof indexOrKey === 'string') {
      const foundIdx = this.sectors.findIndex(s => s.id === indexOrKey);
      if (foundIdx !== -1) index = foundIdx;
    }

    this.currentSectorIndex = index;
    this.currentSector = this.sectors[index];

    // Clone waypoints for creep pathfinding
    this.waypoints = this.currentSector.waypoints.map(wp => ({ ...wp }));

    // Initialize 12 tactical turret sockets
    this.pads = this.currentSector.pads.map(p => ({
      id: p.id,
      x: p.x,
      y: p.y,
      turret: null,
      modifier: null
    }));

    // Randomly roll 3 distinct tactical special mod pads across the 12 sockets
    const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    this.pads[indices[0]].modifier = 'overclock'; // ⚡ Overclock: +25% Speed
    this.pads[indices[1]].modifier = 'spotter';   // 🎯 Spotter: +30% Range
    this.pads[indices[2]].modifier = 'amplifier'; // 💥 Amplifier: +20% Damage

    this.updateSectorUI();
    if (this.state === 'IDLE' && this.ctx) {
      this.draw();
    }
  }

  cycleSector(dir = 1) {
    this.loadSector(this.currentSectorIndex + dir);
    if (sfx && typeof sfx.playCoin === 'function') sfx.playCoin();
  }

  updateSectorUI() {
    const titleEl = document.getElementById('defense-sector-title');
    const descEl = document.getElementById('defense-sector-desc');
    if (this.currentSector) {
      if (titleEl) titleEl.innerText = `SECTOR ${this.currentSector.number}: ${this.currentSector.name.toUpperCase()}`;
      if (descEl) descEl.innerText = this.currentSector.desc;
    }
  }

  // --- Click & Selection Dispatch with Substantially Enlarged Hitboxes ---
  handleClick(x, y) {
    // 1. Check if clicked on an active turret inspection UI button (Upgrade or Sell)
    if (this.selectedActiveTurret) {
      const t = this.selectedActiveTurret;

      // Substantially Enlarged Upgrade Button Hitbox (124x34px, comfortable margin)
      const upLeft = t.x - 65;
      const upRight = t.x + 65;
      const upTop = t.y - 62;
      const upBottom = t.y - 20;

      if (x >= upLeft && x <= upRight && y >= upTop && y <= upBottom) {
        this.upgradeTurret(t);
        return;
      }

      // Substantially Enlarged Sell Button Hitbox (104x30px, comfortable margin)
      const sellLeft = t.x - 55;
      const sellRight = t.x + 55;
      const sellTop = t.y + 24;
      const sellBottom = t.y + 60;

      if (x >= sellLeft && x <= sellRight && y >= sellTop && y <= sellBottom) {
        this.sellTurret(t);
        return;
      }
    }

    // 2. Check if clicked on a Turret Pad (Comfortable 28px tap radius)
    for (const pad of this.pads) {
      const dist = Math.hypot(x - pad.x, y - pad.y);
      if (dist <= 28) {
        if (pad.turret) {
          // Select existing turret for upgrade/sell
          this.selectedActiveTurret = (this.selectedActiveTurret === pad.turret) ? null : pad.turret;
          if (this.selectedActiveTurret && sfx && typeof sfx.playCoin === 'function') sfx.playCoin();
        } else {
          // Build chosen turret on empty pad
          this.buildTurret(pad, this.selectedTurretType);
          this.selectedActiveTurret = null;
        }
        return;
      }
    }

    // Clicked elsewhere on the canvas -> deselect active turret
    this.selectedActiveTurret = null;
  }

  // --- Build, Upgrade & Sell Mechanics ---
  buildTurret(pad, type) {
    const conf = this.getTurretConfig(type, 1);
    if (this.energy < conf.cost) {
      this.addFloatingText('⚡ Not enough Energy!', pad.x, pad.y - 15, '#ff0055');
      if (sfx && typeof sfx.playError === 'function') sfx.playError();
      return;
    }

    this.energy -= conf.cost;
    const turret = {
      id: Date.now() + Math.random(),
      pad: pad,
      type: type,
      x: pad.x,
      y: pad.y,
      level: 1,
      cooldown: 0,
      target: null,
      rotation: 0,
      recoil: 0
    };
    pad.turret = turret;
    this.turrets.push(turret);

    this.spawnSparks(pad.x, pad.y, conf.color, 15);
    this.addFloatingText(`-${conf.cost}⚡`, pad.x, pad.y - 20, '#ffaa00');

    if (pad.modifier === 'overclock') {
      this.addFloatingText('⚡ OVERCLOCK (+25% SPEED)!', pad.x, pad.y - 36, '#eab308');
    } else if (pad.modifier === 'spotter') {
      this.addFloatingText('🎯 SPOTTER (+30% RANGE)!', pad.x, pad.y - 36, '#06b6d4');
    } else if (pad.modifier === 'amplifier') {
      this.addFloatingText('💥 AMPLIFIER (+20% DMG)!', pad.x, pad.y - 36, '#f43f5e');
    }

    if (sfx && typeof sfx.playPowerUp === 'function') sfx.playPowerUp();
    this.updateHUD();
  }

  upgradeTurret(turret) {
    if (turret.level >= 3) {
      this.addFloatingText('⭐ MAX LEVEL!', turret.x, turret.y - 20, '#00f0ff');
      return;
    }
    const nextConf = this.getTurretConfig(turret.type, turret.level + 1);
    if (this.energy < nextConf.cost) {
      this.addFloatingText('⚡ Need more Energy!', turret.x, turret.y - 20, '#ff0055');
      if (sfx && typeof sfx.playError === 'function') sfx.playError();
      return;
    }

    this.energy -= nextConf.cost;
    turret.level += 1;
    this.spawnSparks(turret.x, turret.y, '#00ff66', 22);
    this.spawnRing(turret.x, turret.y, 35, '#00ff66');
    this.addFloatingText(`UPGRADED TO L${turret.level}! (-${nextConf.cost}⚡)`, turret.x, turret.y - 25, '#00ff66');
    if (sfx && typeof sfx.playPowerUp === 'function') sfx.playPowerUp();
    this.updateHUD();
  }

  sellTurret(turret) {
    let totalInvested = 0;
    for (let l = 1; l <= turret.level; l++) {
      totalInvested += this.getTurretConfig(turret.type, l).cost;
    }
    const refund = Math.round(totalInvested * 0.70);
    this.energy += refund;

    turret.pad.turret = null;
    this.turrets = this.turrets.filter(t => t !== turret);
    this.selectedActiveTurret = null;

    this.spawnSparks(turret.x, turret.y, '#ffaa00', 14);
    this.addFloatingText(`+${refund}⚡ Sold`, turret.x, turret.y - 20, '#ffaa00');
    if (sfx && typeof sfx.playCoin === 'function') sfx.playCoin();
    this.updateHUD();
  }

  // --- Start Cyber Defense Session ---
  async start() {
    if (this.isStarting) return;
    this.isStarting = true;

    // Reset Game State
    this.state = 'PLAYING';
    this.coreHp = 10;
    this.energy = 250; // Starting energy (calibrated for comfortable early-game foundation)
    this.score = 0;
    this.creepsKilled = 0;
    this.wave = 0;
    this.sessionStartTime = Date.now();
    this.gameSpeed = 1;
    this.waveActive = false;
    this.isPrepPhase = true;
    this.prepTimer = this.prepDuration;
    this.spawnQueue = [];
    this.creeps = [];
    this.turrets = [];
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.selectedActiveTurret = null;

    // Setup / Refresh Sector Pads & Tactical Modifiers for this run
    this.loadSector(this.currentSectorIndex);
    this.addFloatingText(`🗺️ ${this.currentSector.name.toUpperCase()}`, 400, 160, '#00f0ff');

    // Hide Overlays
    const startOverlay = document.getElementById('defense-overlay-start');
    const gameOverOverlay = document.getElementById('defense-overlay-gameover');
    if (startOverlay) startOverlay.style.display = 'none';
    if (gameOverOverlay) gameOverOverlay.style.display = 'none';
    this.updateHUD();

    const turretBar = document.getElementById('defense-turret-bar');
    if (turretBar) turretBar.style.display = 'flex';
    this.setupTurretButtons();
    this.selectTurretType(this.selectedTurretType || 'laser');

    // Server Session Handshake
    try {
      if (typeof window.startArcadeSession === 'function') {
        const sessRes = await window.startArcadeSession('defense');
        this.sessionId = (typeof sessRes === 'string') ? sessRes : (sessRes?.session_id || sessRes || null);
      }
    } catch (e) {
      console.warn('[CyberDefense] Start session notice:', e);
    }

    this.isStarting = false;
    this.lastTime = performance.now();

    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.loop(this.lastTime);
  }

  // --- Wave Generation with 5-Level Security Threat Tier Escalation ---
  queueWave(waveNum) {
    this.wave = waveNum;
    this.waveActive = true;
    this.isPrepPhase = false;
    this.prepTimer = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;

    // Determine Security Threat Tier (1 to 5)
    const tier = Math.min(5, Math.floor((waveNum - 1) / 5) + 1); // Tier 1: 1-5, Tier 2: 6-10, Tier 3: 11-15, Tier 4: 16-20, Tier 5: 21-25
    const waveInTier = (waveNum - 1) % 5; // 0, 1, 2, 3, 4
    const isBossWave = (waveNum % 5 === 0);

    // Progressive Tier Multipliers & Cadence (Accessible early on, escalating into extreme late game)
    const tierConfigs = {
      1: { hpBase: 0.70,  speedMult: 0.90, spawnInterval: 0.95, name: 'Sub-System Infiltration' },
      2: { hpBase: 1.25,  speedMult: 1.05, spawnInterval: 0.75, name: 'Malware Overclock' },
      3: { hpBase: 2.30,  speedMult: 1.20, spawnInterval: 0.58, name: 'Zero-Day Corruption' },
      4: { hpBase: 4.40,  speedMult: 1.40, spawnInterval: 0.42, name: 'Rootkit Apocalypse' },
      5: { hpBase: 8.20,  speedMult: 1.62, spawnInterval: 0.28, name: 'APEX SINGULARITY [NIGHTMARE]' }
    };

    const tierConf = tierConfigs[tier];
    // Intra-tier progressive ramp (+8% per wave within the tier)
    const intraRamp = 1 + (waveInTier * 0.08);
    const hpMult = tierConf.hpBase * intraRamp;
    const speedMult = tierConf.speedMult + (waveInTier * 0.02);
    this.currentTierConf = tierConf;
    this.currentHpMult = hpMult;
    this.currentSpeedMult = speedMult;
    this.spawnInterval = tierConf.spawnInterval;

    // Total creep count scales progressively with wave and tier density
    const count = 5 + Math.floor(waveNum * 1.6) + (tier >= 5 ? 10 : (tier >= 4 ? 6 : (tier >= 3 ? 3 : 0)));

    // Compose Wave Spawns based on Tier & Wave
    for (let i = 0; i < count; i++) {
      let type = 'drone';

      if (tier === 1) {
        // Tier 1 (Waves 1-5): Gentle introduction
        if (waveNum >= 3 && (i % 3 === 0)) type = 'swarm';
        if (waveNum >= 4 && (i % 5 === 2)) type = 'trojan';
      } else if (tier === 2) {
        // Tier 2 (Waves 6-10): Overclocked mix
        if (i % 3 === 0) type = 'swarm';
        else if (i % 4 === 1) type = 'trojan';
        else if (waveNum >= 8 && i % 4 === 2) type = 'specter';
      } else if (tier === 3) {
        // Tier 3 (Waves 11-15): High density shields & speed
        if (i % 3 === 1) type = 'trojan';
        else if (i % 3 === 2) type = 'specter';
        else if (i % 2 === 0) type = 'swarm';
      } else if (tier === 4) {
        // Tier 4 (Waves 16-20): Armored battalions & swift glitchers
        if (i % 4 === 0) type = 'trojan';
        else if (i % 4 === 1) type = 'specter';
        else if (i % 4 === 2) type = 'swarm';
        else type = 'drone';
      } else {
        // Tier 5 (Waves 21-25) [NIGHTMARE ESCALATION]:
        if (waveNum === 21) {
          type = (i % 5 === 0) ? 'trojan' : 'swarm';
        } else if (waveNum === 22) {
          type = (i % 3 === 0) ? 'swarm' : ((i % 3 === 1) ? 'specter' : 'trojan');
        } else if (waveNum === 23) {
          type = (i % 3 === 0) ? 'specter' : ((i % 3 === 1) ? 'trojan' : 'specter');
        } else if (waveNum === 24) {
          const pattern = ['trojan', 'swarm', 'specter', 'swarm', 'trojan'];
          type = pattern[i % pattern.length];
        } else {
          // Wave 25: The Omega Extinction Wave
          const pattern = ['trojan', 'specter', 'swarm', 'trojan', 'swarm'];
          type = pattern[i % pattern.length];
        }
      }

      // Wildcard Mutation: 10% chance for an unpredictable creep variant to break repeating patterns
      if (waveNum >= 2 && Math.random() < 0.10 && !isBossWave) {
        const pool = (tier >= 3) ? ['swarm', 'trojan', 'specter'] : (waveNum >= 4 ? ['swarm', 'trojan'] : ['swarm']);
        type = pool[Math.floor(Math.random() * pool.length)];
      }

      // Base HP and Speed calculations with tier scaling + subtle randomness (+-8%)
      const hpVariance = 0.92 + Math.random() * 0.16;
      let hp = Math.round(52 * hpMult * hpVariance);
      let shield = 0;
      let armor = 0;
      let speed = Number((1.35 * speedMult).toFixed(2));

      if (type === 'swarm') {
        hp = Math.round(30 * hpMult * hpVariance);
        speed = Number((2.20 * speedMult).toFixed(2));
      } else if (type === 'trojan') {
        hp = Math.round(140 * hpMult * hpVariance);
        armor = (tier >= 4) ? 2 : 1; // Tier 4 & 5 Trojans have reinforced composite armor
        speed = Number((0.82 * speedMult).toFixed(2));
      } else if (type === 'specter') {
        hp = Math.round(75 * hpMult * hpVariance);
        shield = Math.round(85 * hpMult * (tier >= 3 ? 1.45 : 1.0) * hpVariance);
        speed = Number((1.32 * speedMult).toFixed(2));
      }

      this.spawnQueue.push({ type, hp, shield, armor, speed });

      // In Wave 25: Insert First Omega Leviathan Titan at 25% of the wave queue!
      if (waveNum === 25 && i === Math.floor(count * 0.25)) {
        const bossHp = Math.round(1800 * hpMult);
        const bossShield = Math.round(650 * hpMult);
        this.spawnQueue.push({
          type: 'boss',
          hp: bossHp,
          shield: bossShield,
          armor: 2,
          speed: Number((0.56 * speedMult).toFixed(2)),
          name: 'Omega Leviathan Alpha'
        });
      }
    }

    // Boss Waves (every 5th wave: 5, 10, 15, 20, 25)
    if (isBossWave) {
      let baseBossHp = 700;
      let baseBossShield = 200;
      if (waveNum === 10) {
        baseBossHp = 1000;
        baseBossShield = 300;
      } else if (waveNum === 15) {
        baseBossHp = 1350;
        baseBossShield = 450;
      } else if (waveNum === 20) {
        baseBossHp = 1700;
        baseBossShield = 600;
      } else if (waveNum === 25) {
        baseBossHp = 2200;
        baseBossShield = 800;
      }

      const bossHp = Math.round(baseBossHp * hpMult);
      const bossShield = Math.round(baseBossShield * hpMult);
      const bossSpeed = Number((0.55 * speedMult).toFixed(2));

      // Append Principal Boss to end of queue
      this.spawnQueue.push({
        type: 'boss',
        hp: bossHp,
        shield: bossShield,
        armor: (tier >= 4) ? 2 : 1,
        speed: bossSpeed,
        name: (waveNum === 25) ? 'Omega Leviathan Prime' : `Leviathan Wave ${waveNum}`
      });

      // Dedicated Boss Escort Convoys calibrated per tier
      if (tier === 2) {
        // +1 Trojan escort (Wave 10)
        this.spawnQueue.push({ type: 'trojan', hp: Math.round(130 * hpMult), shield: 0, armor: 1, speed: Number((0.82 * speedMult).toFixed(2)) });
      } else if (tier === 3) {
        // +2 Trojans + 1 Specter (Wave 15)
        this.spawnQueue.push({ type: 'trojan', hp: Math.round(140 * hpMult), shield: 0, armor: 1, speed: Number((0.82 * speedMult).toFixed(2)) });
        this.spawnQueue.push({ type: 'specter', hp: Math.round(75 * hpMult), shield: Math.round(85 * hpMult * 1.35), armor: 0, speed: Number((1.30 * speedMult).toFixed(2)) });
        this.spawnQueue.push({ type: 'trojan', hp: Math.round(140 * hpMult), shield: 0, armor: 1, speed: Number((0.82 * speedMult).toFixed(2)) });
      } else if (tier >= 4) {
        // Full battle group for late game (Waves 20 & 25)
        for (let k = 0; k < 3; k++) {
          this.spawnQueue.push({ type: 'trojan', hp: Math.round(140 * hpMult), shield: 0, armor: 2, speed: Number((0.82 * speedMult).toFixed(2)) });
          this.spawnQueue.push({ type: 'specter', hp: Math.round(75 * hpMult), shield: Math.round(85 * hpMult * 1.35), armor: 0, speed: Number((1.30 * speedMult).toFixed(2)) });
          this.spawnQueue.push({ type: 'swarm', hp: Math.round(30 * hpMult), shield: 0, armor: 0, speed: Number((2.10 * speedMult).toFixed(2)) });
        }
      }

      if (waveNum === 25) {
        this.addFloatingText('💀 EXTINCTION WAVE 25: DUAL OMEGA LEVIATHANS!', 400, 180, '#ff0055');
        this.screenShake = 20;
      } else {
        this.addFloatingText(`⚠️ LEVIATHAN DETECTED: WAVE ${waveNum}!`, 400, 180, '#ff0055');
        this.screenShake = 10;
      }
    } else {
      // Announce Tier Step-Ups
      if (waveNum === 6) {
        this.addFloatingText('⚠️ TIER 2: MALWARE OVERCLOCK (+SPEED & HP)!', 400, 180, '#ffaa00');
        this.screenShake = 6;
      } else if (waveNum === 11) {
        this.addFloatingText('⚠️ TIER 3: ZERO-DAY CORRUPTION (+DENSE PACKS)!', 400, 180, '#ff7700');
        this.screenShake = 8;
      } else if (waveNum === 16) {
        this.addFloatingText('⚠️ TIER 4: ROOTKIT APOCALYPSE (+HEAVY ARMOR)!', 400, 180, '#ff00aa');
        this.screenShake = 10;
      } else if (waveNum === 21) {
        this.addFloatingText('🚨 TIER 5: APEX SINGULARITY [NIGHTMARE ESCALATION]!', 400, 180, '#ff0055');
        this.screenShake = 15;
      } else {
        this.addFloatingText(`⚡ WAVE ${waveNum} COMMENCING!`, 400, 180, '#00f0ff');
      }
    }

    if (sfx && typeof sfx.playLaser === 'function') sfx.playLaser();
    this.updateHUD();
  }

  // --- Spawn Single Creep Entity ---
  spawnCreep(spec) {
    const tier = Math.min(5, Math.floor((this.wave - 1) / 5) + 1);
    const scoreMult = 1 + (tier - 1) * 0.35;

    // Lean Flat Energy Economy (No exponential tier inflation on energy!)
    let finalBounty = 0;
    if (spec.bounty !== undefined) {
      finalBounty = spec.bounty;
    } else {
      let baseBounty = 1.0; // Standard Drone
      if (spec.type === 'boss') {
        baseBounty = 12 + Math.floor(this.wave * 1.5);
      } else if (spec.type === 'trojan') {
        baseBounty = 2.8;
      } else if (spec.type === 'specter') {
        baseBounty = 2.2;
      } else if (spec.type === 'swarm') {
        baseBounty = 0.8;
      }
      const bountyVariance = 0.85 + Math.random() * 0.30;
      finalBounty = Math.max(1, Math.round(baseBounty * bountyVariance));
    }

    let baseScore = 5;
    if (spec.type === 'boss') baseScore = 80;
    else if (spec.type === 'trojan') baseScore = 14;
    else if (spec.type === 'specter') baseScore = 12;
    else if (spec.type === 'swarm') baseScore = 4;

    // Dynamic speed jitter (+-10%) so creeps don't march in rigid uniform lines
    const speedJitter = 0.90 + Math.random() * 0.20;
    const finalSpeed = Number((spec.speed * speedJitter).toFixed(2));

    const creep = {
      id: Date.now() + Math.random(),
      type: spec.type,
      name: spec.name || null,
      hp: spec.hp,
      maxHp: spec.hp,
      shield: spec.shield || 0,
      maxShield: spec.shield || 0,
      armor: spec.armor || 0,
      baseSpeed: finalSpeed,
      speed: finalSpeed,
      slowTimer: 0,
      slowEffect: 0,
      pulseTimer: spec.type === 'boss' ? 4.5 : 0, // Boss EMP disruption pulse timer
      x: spec.x !== undefined ? spec.x : this.waypoints[0].x,
      y: spec.y !== undefined ? spec.y : this.waypoints[0].y,
      waypointIndex: spec.waypointIndex !== undefined ? spec.waypointIndex : 1,
      angle: 0,
      size: spec.type === 'boss' ? 28 : (spec.type === 'trojan' ? 20 : (spec.type === 'specter' ? 16 : (spec.type === 'swarm' ? 10 : 14))),
      color: spec.type === 'boss' ? '#ff0055' : (spec.type === 'trojan' ? '#ff7700' : (spec.type === 'specter' ? '#00f0ff' : (spec.type === 'swarm' ? '#ffaa00' : '#00e5ff'))),
      bounty: finalBounty,
      scoreValue: Math.round(baseScore * scoreMult) * 10
    };
    this.creeps.push(creep);
  }

  // --- Main Game Loop with Physics Sub-Stepping ---
  loop(timestamp) {
    if (this.state !== 'PLAYING') return;

    const rawDt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;
    this.globalTick += rawDt;

    // Physics sub-stepping prevents tunneling/clipped waypoints at 4x speed
    let simDt = rawDt * this.gameSpeed;
    const maxSubDt = 0.02; // 50 FPS equivalent simulation resolution
    while (simDt > 0) {
      const step = Math.min(simDt, maxSubDt);
      this.update(step);
      simDt -= step;
    }

    this.draw();
    this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  // --- Game State Update ---
  update(dt) {
    // 1. Preparation Phase (No rushing, zero energy lost while waiting)
    if (this.isPrepPhase) {
      this.screenShake = 0; // Strictly no shaking between levels
      if (this.autoWave) {
        this.prepTimer -= dt;
        if (this.prepTimer <= 0) {
          this.queueWave(this.wave + 1);
        }
      }
      this.updateHUD();
      return;
    }

    // 2. Creep Spawning with dynamic burst cadence & tier scaling
    if (this.waveActive && this.spawnQueue.length > 0) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        const nextCreep = this.spawnQueue.shift();
        this.spawnCreep(nextCreep);

        // Dynamic cadence: Swarms spawn in lightning rapid bursts, Bosses get dramatic pacing
        const baseInterval = (this.currentTierConf && this.currentTierConf.spawnInterval) || 0.60;
        const upcoming = this.spawnQueue[0];
        if (upcoming && upcoming.type === 'swarm') {
          this.spawnInterval = 0.16 + Math.random() * 0.08; // High-density Swarm rush!
        } else if (upcoming && upcoming.type === 'boss') {
          this.spawnInterval = 1.15; // Dramatic boss entrance delay
        } else {
          this.spawnInterval = baseInterval * (0.85 + Math.random() * 0.30);
        }
      }
    } else if (this.waveActive && this.spawnQueue.length === 0 && this.creeps.length === 0) {
      // Progressive Wave Clear Economy: Generous early stipends (36⚡ in Wave 1), tapering down to 16⚡ in late-game waves where creep volume is massive
      this.waveActive = false;
      this.screenShake = 0; // Stop any residual shake immediately
      this.score += this.wave * 150;
      const baseWaveBonus = Math.max(16, 36 - Math.floor(this.wave * 0.80));
      const waveVariance = 0.92 + Math.random() * 0.16; // +-8% market flux
      const waveBonus = Math.round(baseWaveBonus * waveVariance);
      this.energy += waveBonus;
      this.addFloatingText(`+${waveBonus}⚡ Wave Bonus!`, 400, 200, '#00ff66');
      if (sfx && typeof sfx.playSuccess === 'function') sfx.playSuccess();

      if (this.wave >= this.maxWaves) {
        this.endSession(true); // Victory!
        return;
      }

      // Enter Tactical Preparation Phase
      this.isPrepPhase = true;
      this.screenShake = 0;
      this.prepTimer = this.prepDuration;
      this.updateHUD();
    }

    // 3. Creeps Movement along Circuit Waypoints
    for (let i = this.creeps.length - 1; i >= 0; i--) {
      const c = this.creeps[i];

      // Boss EMP Jammer: Periodic electronic countermeasure pulse disrupts nearby turrets (Tier 2+ only)
      if (c.type === 'boss' && this.wave >= 10) {
        c.pulseTimer = (c.pulseTimer !== undefined ? c.pulseTimer : 5.0) - dt;
        if (c.pulseTimer <= 0) {
          const isLateTier = this.wave >= 20;
          const isMidTier = this.wave >= 15;
          const jamInterval = isLateTier ? (6.5 + Math.random() * 2.0) : (isMidTier ? (8.0 + Math.random() * 2.5) : (10.0 + Math.random() * 3.0));
          const jamRadius = isLateTier ? 155 : (isMidTier ? 125 : 95);
          const jamDuration = isLateTier ? 2.4 : (isMidTier ? 1.8 : 1.2);

          c.pulseTimer = jamInterval;
          this.spawnRing(c.x, c.y, jamRadius, '#ff0055');
          this.spawnSparks(c.x, c.y, '#ff0055', 20);
          this.screenShake = isLateTier ? 6 : 4;
          this.addFloatingText('⚡ EMP JAMMER!', c.x, c.y - 20, '#ff0055');
          if (sfx && typeof sfx.playError === 'function') sfx.playError();

          // Jam all turrets within radius for jamDuration seconds
          for (const t of this.turrets) {
            const distToTurret = Math.hypot(t.x - c.x, t.y - c.y);
            if (distToTurret <= jamRadius) {
              t.jammedTimer = Math.max(t.jammedTimer || 0, jamDuration);
              this.spawnSparks(t.x, t.y, '#ff0055', 8);
            }
          }
        }
      }

      // Handle Slow Debuff
      if (c.slowTimer > 0) {
        c.slowTimer -= dt;
        c.speed = c.baseSpeed * (1 - (c.slowEffect || 0.5));
      } else {
        c.speed = c.baseSpeed;
      }

      const targetWP = this.waypoints[c.waypointIndex];
      if (targetWP) {
        const dx = targetWP.x - c.x;
        const dy = targetWP.y - c.y;
        const dist = Math.hypot(dx, dy);
        c.angle = Math.atan2(dy, dx);
        const step = c.speed * 82 * dt;

        if (dist <= step) {
          c.x = targetWP.x;
          c.y = targetWP.y;
          c.waypointIndex++;
        } else {
          c.x += (dx / dist) * step;
          c.y += (dy / dist) * step;
        }
      } else {
        // Reached Quantum Core! High stakes: Bosses and Trojans inflict lethal core damage
        const isOmega = c.name && c.name.includes('Omega');
        const dmg = (c.type === 'boss') ? (isOmega ? 10 : (this.wave <= 5 ? 3 : (this.wave <= 10 ? 4 : 6))) : (c.type === 'trojan' ? 2 : 1);
        this.coreHp = Math.max(0, this.coreHp - dmg);
        this.screenShake = 14;
        this.spawnSparks(c.x, c.y, '#ff0055', 30);
        this.addFloatingText(`-${dmg} HP [CRITICAL!]`, c.x, c.y - 15, '#ff0055');
        if (sfx && typeof sfx.playError === 'function') sfx.playError();
        this.creeps.splice(i, 1);
        this.updateHUD();

        if (this.coreHp <= 0) {
          this.endSession(false); // Core Compromised
          return;
        }
      }
    }

    // 4. Turrets Targeting, Rotation & Firing
    for (const t of this.turrets) {
      // Jammed turrets are disabled by Boss EMP pulses
      if (t.jammedTimer > 0) {
        t.jammedTimer -= dt;
        continue;
      }

      const conf = this.getEffectiveTurretConfig(t);
      if (t.cooldown > 0) t.cooldown -= dt;
      if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - 18 * dt);

      // Target Selection:
      let bestCreep = null;
      let maxWP = -1;
      let minTargetDist = Infinity;

      if (t.type === 'plasma') {
        // Plasma Specialized Targeting: Prioritize Dreadnought Boss in range
        let bossCreep = null;
        let minBossDist = Infinity;
        for (const c of this.creeps) {
          if (c.type === 'boss') {
            const dist = Math.hypot(c.x - t.x, c.y - t.y);
            if (dist <= conf.range && dist < minBossDist) {
              bossCreep = c;
              minBossDist = dist;
            }
          }
        }
        if (bossCreep) bestCreep = bossCreep;

      } else if (t.type === 'laser') {
        // Laser Specialized Targeting: Prioritize fast swarm creeps in range furthest along path
        let swarmCreep = null;
        let maxSwarmWP = -1;
        let minSwarmDist = Infinity;
        for (const c of this.creeps) {
          const dist = Math.hypot(c.x - t.x, c.y - t.y);
          if (dist <= conf.range && c.type === 'swarm') {
            if (c.waypointIndex > maxSwarmWP || (c.waypointIndex === maxSwarmWP && dist < minSwarmDist)) {
              maxSwarmWP = c.waypointIndex;
              minSwarmDist = dist;
              swarmCreep = c;
            }
          }
        }
        if (swarmCreep) bestCreep = swarmCreep;

      } else if (t.type === 'railgun') {
        // Railgun Specialized Targeting: Prioritize heavy Armored Trojans in range furthest along path
        let trojanCreep = null;
        let maxTrojanWP = -1;
        let minTrojanDist = Infinity;
        for (const c of this.creeps) {
          const dist = Math.hypot(c.x - t.x, c.y - t.y);
          if (dist <= conf.range && c.type === 'trojan') {
            if (c.waypointIndex > maxTrojanWP || (c.waypointIndex === maxTrojanWP && dist < minTrojanDist)) {
              maxTrojanWP = c.waypointIndex;
              minTrojanDist = dist;
              trojanCreep = c;
            }
          }
        }
        if (trojanCreep) bestCreep = trojanCreep;
      }

      // Default Targeting: Creep furthest along path in range
      if (!bestCreep) {
        for (const c of this.creeps) {
          const dist = Math.hypot(c.x - t.x, c.y - t.y);
          if (dist <= conf.range) {
            if (c.waypointIndex > maxWP) {
              maxWP = c.waypointIndex;
              bestCreep = c;
              minTargetDist = dist;
            } else if (c.waypointIndex === maxWP && dist < minTargetDist) {
              bestCreep = c;
              minTargetDist = dist;
            }
          }
        }
      }

      t.target = bestCreep;
      if (bestCreep) {
        t.rotation = Math.atan2(bestCreep.y - t.y, bestCreep.x - t.x);
        if (t.cooldown <= 0) {
          this.fireTurret(t, bestCreep, conf);
          t.cooldown = conf.rate;
        }
      }
    }

    // 5. Projectiles Update
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;

      if (p.type === 'plasma') {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.hypot(dx, dy);
        const speed = 420 * dt;

        if (dist <= speed || p.life <= 0) {
          // Explode!
          this.spawnSparks(p.x, p.y, '#ff00aa', 28);
          this.spawnRing(p.x, p.y, p.splash, '#ff00aa');
          for (const c of this.creeps) {
            const hitDist = Math.hypot(c.x - p.x, c.y - p.y);
            if (hitDist <= p.splash) {
              this.damageCreep(c, p.damage, 'plasma');
            }
          }
          this.projectiles.splice(i, 1);
        } else {
          p.x += (dx / dist) * speed;
          p.y += (dy / dist) * speed;
        }
      } else if (p.type === 'beam') {
        if (p.life <= 0) this.projectiles.splice(i, 1);
      }
    }

    // 6. Particles & Screen Shake Decay
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const part = this.particles[i];
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.life -= dt;
      if (part.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y -= 25 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - 35 * dt);
    }
  }

  // --- Fire Turret Action ---
  fireTurret(t, target, conf) {
    t.recoil = (t.type === 'railgun') ? 7 : (t.type === 'plasma' ? 5 : 3);

    if (t.type === 'laser') {
      // Instant beam + hit
      this.projectiles.push({
        type: 'beam',
        x1: t.x, y1: t.y,
        x2: target.x, y2: target.y,
        color: conf.color,
        width: 2 + t.level * 1.5,
        life: 0.10
      });
      this.damageCreep(target, conf.damage, 'laser');
      this.spawnSparks(target.x, target.y, conf.color, 4);
      if (sfx && typeof sfx.playLaser === 'function') sfx.playLaser();

    } else if (t.type === 'plasma') {
      // Arcing high-explosive plasma mortar
      this.projectiles.push({
        type: 'plasma',
        x: t.x, y: t.y,
        targetX: target.x, targetY: target.y,
        damage: conf.damage,
        splash: conf.splash,
        color: conf.color,
        life: 1.4
      });
      if (sfx && typeof sfx.playLaser === 'function') sfx.playLaser();

    } else if (t.type === 'emp') {
      // Radial cryogenic pulse
      this.spawnRing(t.x, t.y, conf.range, conf.color);
      for (const c of this.creeps) {
        const dist = Math.hypot(c.x - t.x, c.y - t.y);
        if (dist <= conf.range) {
          // Bosses possess wave-scaled cryogenic resistance and reduced slow duration
          if (c.type === 'boss') {
            const w = this.wave || 5;
            const slowResist = Math.min(0.70, 0.25 + (w - 5) * 0.0225);
            const durationRatio = Math.max(0.40, 0.75 - (w - 5) * 0.0175);
            c.slowTimer = conf.slowDuration * durationRatio;
            c.slowEffect = conf.slow * (1 - slowResist);
          } else {
            c.slowTimer = conf.slowDuration;
            c.slowEffect = conf.slow;
          }
          this.damageCreep(c, conf.damage, 'emp');
          this.spawnSparks(c.x, c.y, '#00ffaa', 5);
        }
      }
      if (sfx && typeof sfx.playCoin === 'function') sfx.playCoin();

    } else if (t.type === 'railgun') {
      // Hypervelocity penetrating beam - Pierces all creeps along vector!
      const angle = Math.atan2(target.y - t.y, target.x - t.x);
      const beamLength = Math.max(conf.range * 1.3, 360);
      const x2 = t.x + Math.cos(angle) * beamLength;
      const y2 = t.y + Math.sin(angle) * beamLength;

      this.projectiles.push({
        type: 'beam',
        x1: t.x, y1: t.y,
        x2: x2,
        y2: y2,
        color: conf.color,
        width: 3.5 + t.level * 2,
        life: 0.18
      });

      let hitCount = 0;
      const hitRadius = 18;
      const candidates = [...this.creeps];
      for (const c of candidates) {
        if (this.distToSegment(c.x, c.y, t.x, t.y, x2, y2) <= hitRadius) {
          this.damageCreep(c, conf.damage, 'railgun');
          this.spawnSparks(c.x, c.y, '#ffffff', 8);
          hitCount++;
        }
      }

      if (hitCount >= 2) {
        this.addFloatingText(`${hitCount}x PIERCE!`, target.x, target.y - 18, '#ffaa00');
      }
      if (sfx && typeof sfx.playLaser === 'function') sfx.playLaser();
    }
  }

  // --- Strategic Creep Damage with Armor & Shields ---
  damageCreep(creep, amount, damageType = 'laser') {
    let dmg = amount;

    // Strategic Turret Role Specialization
    if (damageType === 'laser' && creep.type === 'swarm') {
      dmg *= 1.35; // Laser point-defense bonus vs fast swarm runners
    } else if (damageType === 'plasma' && creep.type === 'boss') {
      dmg *= 2.2; // Plasma heavy siege mortar deals 2.2x heavy impact against Bosses (rebalanced from 5.0x)
    } else if (damageType === 'railgun' && creep.type === 'trojan') {
      dmg *= 2.0; // Railgun hypervelocity slug shreds heavy armored Trojans (2.0x bonus)
    }

    // ❄️ Cryo Vulnerability: Chilled creeps take +25% amplified damage from Laser, Plasma, and Railgun!
    if (creep.slowTimer > 0 && damageType !== 'emp') {
      dmg *= 1.25;
      this.spawnSparks(creep.x, creep.y, '#00f0ff', 3);
    }

    // 1. Energy Shield Mechanics (Specters & Bosses)
    if (creep.shield > 0) {
      if (damageType === 'emp') {
        dmg *= 3.5; // EMP shatters energy shields
        this.spawnSparks(creep.x, creep.y, '#00f0ff', 10);
      }

      if (creep.shield >= dmg) {
        creep.shield -= dmg;
        dmg = 0;
        this.spawnSparks(creep.x, creep.y, '#00f0ff', 4);
      } else {
        dmg -= creep.shield;
        creep.shield = 0;
        this.spawnRing(creep.x, creep.y, 25, '#00f0ff');
        this.addFloatingText('SHIELD BROKEN!', creep.x, creep.y - 12, '#00f0ff');
      }
    }

    // 2. Armor Plating Mechanics (Trojans & Bosses)
    if (dmg > 0) {
      if (creep.armor > 0) {
        if (damageType === 'railgun') {
          // 100% Armor Penetration! Full damage.
        } else if (damageType === 'plasma') {
          dmg *= 1.30; // Plasma melts armored hulls
        } else {
          // Rapid light attacks (Laser/EMP) mitigated by 45% (or 65% for Tier 4/5 reinforced armor)
          const mitigation = (creep.armor >= 2) ? 0.35 : 0.55;
          dmg = Math.max(1.5, dmg * mitigation);
        }
      }
      creep.hp -= dmg;
      if (damageType === 'plasma' && creep.type === 'boss') {
        this.spawnSparks(creep.x, creep.y, '#ff00aa', 8);
      } else if (damageType === 'railgun' && creep.type === 'trojan') {
        this.spawnSparks(creep.x, creep.y, '#ffaa00', 8);
      }
    }

    // 3. Creep Destruction & Bounty
    if (creep.hp <= 0) {
      const idx = this.creeps.indexOf(creep);
      if (idx !== -1) {
        this.creeps.splice(idx, 1);
        this.creepsKilled++;

        // Tier 4+ Trojans deploy dangerous Cluster Mini-Swarms on rupture!
        if (creep.type === 'trojan' && this.wave >= 16) {
          this.addFloatingText('CLUSTER RUPTURE!', creep.x, creep.y - 20, '#ff7700');
          const miniHp = Math.round(30 * (this.currentHpMult || 1));
          const miniSpeed = Number((2.2 * (this.currentSpeedMult || 1)).toFixed(2));
          for (let s = 0; s < 2; s++) {
            this.spawnCreep({
              type: 'swarm',
              hp: miniHp,
              shield: 0,
              armor: 0,
              speed: miniSpeed,
              bounty: 0, // Fragile glitch fragments yield zero energy bounty
              x: creep.x + (s === 0 ? -8 : 8),
              y: creep.y + (s === 0 ? -6 : 6),
              waypointIndex: creep.waypointIndex
            });
          }
        }

        // Random Power Core Surge: Rare 3.5% chance for destroyed units to release a small energy surge (max +2⚡)
        let earnedEnergy = creep.bounty || 0;
        const isSurge = Math.random() < 0.035 && earnedEnergy > 0;
        if (isSurge) {
          const surgeBonus = Math.min(2, Math.max(1, Math.round(earnedEnergy * 0.5)));
          earnedEnergy += surgeBonus;
          this.spawnSparks(creep.x, creep.y, '#00f0ff', 18);
          this.addFloatingText(`⚡ Surge! +${earnedEnergy}⚡`, creep.x, creep.y - 25, '#00f0ff');
        } else if (earnedEnergy > 0) {
          this.addFloatingText(`+${earnedEnergy}⚡`, creep.x, creep.y - 15, '#00ff66');
        }

        this.energy += earnedEnergy;
        this.score += (creep.scoreValue || (creep.bounty * 10));
        this.spawnSparks(creep.x, creep.y, creep.color, (creep.type === 'boss' ? 40 : 18));
        this.updateHUD();
      }
    }
  }

  // --- Visual Effects Generators ---
  spawnSparks(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color,
        size: 2 + Math.random() * 3,
        life: 0.3 + Math.random() * 0.4
      });
    }
  }

  spawnRing(x, y, radius, color) {
    this.particles.push({
      x, y, vx: 0, vy: 0,
      radius: 0,
      targetRadius: radius,
      color: color,
      life: 0.35,
      isRing: true
    });
  }

  addFloatingText(text, x, y, color) {
    this.floatingTexts.push({ text, x, y, color, life: 0.85 });
  }

  // --- Rendering Pipeline ---
  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Apply Screen Shake (Only during active combat, strictly disabled between levels)
    ctx.save();
    if (!this.isPrepPhase && this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    // 1. Background Grid & High-Tech Matrix
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 2. Glowing PCB Circuit Highway (The Path)
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (this.waypoints && this.waypoints.length > 1) {
      // Outer Glow
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.lineWidth = 44;
      ctx.beginPath();
      ctx.moveTo(this.waypoints[0].x, this.waypoints[0].y);
      for (let i = 1; i < this.waypoints.length; i++) {
        ctx.lineTo(this.waypoints[i].x, this.waypoints[i].y);
      }
      ctx.stroke();

      // Circuit Core Track
      ctx.strokeStyle = 'rgba(10, 20, 40, 0.95)';
      ctx.lineWidth = 36;
      ctx.stroke();

      // Neon Center Pulse Line
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 3. Turret Pads
    for (const pad of (this.pads || [])) {
      const isSelected = (this.selectedActiveTurret === pad.turret);
      const mod = pad.modifier;
      let modColor = null;
      if (mod === 'overclock') modColor = '#eab308';
      else if (mod === 'spotter') modColor = '#06b6d4';
      else if (mod === 'amplifier') modColor = '#f43f5e';

      ctx.fillStyle = pad.turret
        ? (modColor ? `${modColor}18` : 'rgba(0, 240, 255, 0.08)')
        : (modColor ? `${modColor}15` : 'rgba(15, 23, 42, 0.7)');
      ctx.strokeStyle = isSelected
        ? '#ffaa00'
        : (pad.turret
          ? (modColor || 'rgba(0, 240, 255, 0.4)')
          : (modColor || 'rgba(0, 240, 255, 0.22)'));
      ctx.lineWidth = isSelected ? 3 : (modColor ? 2 : 1.5);

      // Octagonal Pad
      this.drawPolygon(ctx, pad.x, pad.y, 22, 8);
      ctx.fill();
      ctx.stroke();

      if (!pad.turret) {
        // Futuristic holographic mounting socket on empty pads
        const padPulse = Math.sin(this.globalTick * 3 + pad.x) * 0.5 + 0.5;

        if (mod === 'overclock') {
          // ⚡ Overclock: Glowing Electric Gold Ring + Pulsing ⚡ Rune
          ctx.save();
          ctx.strokeStyle = '#eab308';
          ctx.shadowColor = '#eab308';
          ctx.shadowBlur = 6 + padPulse * 8;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(pad.x, pad.y, 14, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#eab308';
          ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('⚡', pad.x, pad.y);
          ctx.restore();
        } else if (mod === 'spotter') {
          // 🎯 Spotter: Glowing Cyan Targeting Ring + 🎯 Rune
          ctx.save();
          ctx.strokeStyle = '#06b6d4';
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 6 + padPulse * 8;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(pad.x, pad.y, 14, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#06b6d4';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🎯', pad.x, pad.y);
          ctx.restore();
        } else if (mod === 'amplifier') {
          // 💥 Amplifier: Glowing Crimson Hazard Ring + 💥 Rune
          ctx.save();
          ctx.strokeStyle = '#f43f5e';
          ctx.shadowColor = '#f43f5e';
          ctx.shadowBlur = 6 + padPulse * 8;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(pad.x, pad.y, 14, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#f43f5e';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('💥', pad.x, pad.y);
          ctx.restore();
        } else {
          // Inner standard tech ring
          ctx.strokeStyle = `rgba(0, 240, 255, ${0.12 + padPulse * 0.22})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(pad.x, pad.y, 14, 0, Math.PI * 2);
          ctx.stroke();

          // Plus icon for buildable pad (crisp perpendicular crosshair)
          ctx.strokeStyle = `rgba(0, 240, 255, ${0.45 + padPulse * 0.45})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(pad.x - 7, pad.y); ctx.lineTo(pad.x + 7, pad.y);
          ctx.moveTo(pad.x, pad.y - 7); ctx.lineTo(pad.x, pad.y + 7);
          ctx.stroke();
        }
      }
    }

    // 4. Quantum Core (Dynamic Target Base Anchored per Sector)
    const corePos = (this.currentSector && this.currentSector.core) ? this.currentSector.core : { x: 740, y: 260 };
    const coreX = corePos.x;
    const coreY = corePos.y;
    this.corePulse += 0.05;
    const pulseScale = 1 + Math.sin(this.corePulse) * 0.08;

    // Outer rotating energy shield
    ctx.save();
    ctx.translate(coreX, coreY);
    ctx.rotate(this.corePulse * 0.5);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
    ctx.lineWidth = 2;
    this.drawPolygon(ctx, 0, 0, 32 * pulseScale, 6);
    ctx.stroke();
    ctx.restore();

    // Core Crystal
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 15;
    this.drawPolygon(ctx, coreX, coreY, 20, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CORE', coreX, coreY + 4);

    // 5. Creeps (Procedural High-Tech Models with Directional Heading)
    for (const c of (this.creeps || [])) {
      this.drawCreep(ctx, c);
    }

    // 6. Turrets (Procedural Cybernetic Models with Distinct L1, L2, L3 Tiers)
    for (const t of (this.turrets || [])) {
      this.drawTurret(ctx, t);
    }

    // 7. Projectiles & Beams
    for (const p of (this.projectiles || [])) {
      if (p.type === 'beam') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.width;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (p.type === 'plasma') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // 8. Particles & Expanding Rings
    for (const part of (this.particles || [])) {
      if (part.isRing) {
        const radius = part.targetRadius * (1 - part.life / 0.35);
        ctx.strokeStyle = part.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(part.x, part.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = part.color;
        ctx.fillRect(part.x - part.size / 2, part.y - part.size / 2, part.size, part.size);
      }
    }

    // 9. Floating Combat Texts
    for (const ft of (this.floatingTexts || [])) {
      ctx.fillStyle = ft.color;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.shadowBlur = 0;
    }

    // 10. Preparation Phase Cyber Banner
    if (this.isPrepPhase) {
      this.drawPrepBanner(ctx);
    }

    // 11. Active Turret Inspector Overlay (Substantially Enlarged Action Buttons)
    if (this.selectedActiveTurret) {
      this.drawInspectorOverlay(ctx, this.selectedActiveTurret);
    }

    ctx.restore();
  }

  // --- Procedural High-Tech Creep Rendering ---
  drawCreep(ctx, c) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle || 0);

    const isFrozen = (c.slowTimer > 0);
    const tick = this.globalTick;

    // Helper: dynamic thruster flame plume (facing backward in -X relative to ship heading)
    const drawThruster = (tx, ty, baseLen, baseW, colorOuter = '#ff6600', colorInner = '#ffffff') => {
      const flicker = Math.sin(tick * 28 + (tx + ty) * 5) * 0.25 + 0.75;
      const len = baseLen * flicker;
      const w = baseW * (0.85 + flicker * 0.15);

      // Outer exhaust plume
      ctx.fillStyle = isFrozen ? 'rgba(56, 189, 248, 0.65)' : colorOuter;
      ctx.beginPath();
      ctx.moveTo(tx, ty - w / 2);
      ctx.lineTo(tx - len, ty);
      ctx.lineTo(tx, ty + w / 2);
      ctx.closePath();
      ctx.fill();

      // Inner white/bright core
      ctx.fillStyle = isFrozen ? '#ffffff' : colorInner;
      ctx.beginPath();
      ctx.moveTo(tx, ty - w * 0.25);
      ctx.lineTo(tx - len * 0.55, ty);
      ctx.lineTo(tx, ty + w * 0.25);
      ctx.closePath();
      ctx.fill();
    };

    if (c.type === 'boss') {
      // ===== LEVIATHAN DREADNOUGHT BOSS =====
      const isOmega = c.name && c.name.includes('Omega');

      // Omega Annihilation Dimensional Aura
      if (isOmega) {
        ctx.save();
        const auraR = 38 + Math.sin(tick * 5) * 4;
        // Swirling dark matter ring
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.45)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, auraR, 0, Math.PI * 2);
        ctx.stroke();

        // Orbiting dimensional plasma shards
        for (let i = 0; i < 3; i++) {
          const orbitAngle = tick * 3.5 + (i * Math.PI * 2) / 3;
          const sx = Math.cos(orbitAngle) * (auraR + 2);
          const sy = Math.sin(orbitAngle) * (auraR + 2);
          ctx.fillStyle = '#ff007f';
          ctx.shadowColor = '#ff007f';
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        ctx.restore();
      }

      // Triple Roaring Fusion Thrusters
      drawThruster(-28, 0, 20, 10, isOmega ? '#ec4899' : '#ff3b30', '#ffffff');
      drawThruster(-26, -15, 14, 6, isOmega ? '#d946ef' : '#f59e0b', '#fff');
      drawThruster(-26, 15, 14, 6, isOmega ? '#d946ef' : '#f59e0b', '#fff');

      // Heavy Outrigger Wings / Sponsons
      ctx.fillStyle = isFrozen ? '#0284c7' : '#0c0414';
      ctx.strokeStyle = isFrozen ? '#38bdf8' : (isOmega ? '#ff00aa' : '#ff0055');
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      // Forward ram prow
      ctx.moveTo(34, 0);
      ctx.lineTo(16, -14);
      // Lateral outrigger wing
      ctx.lineTo(10, -26);
      ctx.lineTo(-24, -28);
      ctx.lineTo(-20, -18);
      ctx.lineTo(-28, -12);
      ctx.lineTo(-26, -6);
      ctx.lineTo(-30, 0);
      ctx.lineTo(-26, 6);
      ctx.lineTo(-28, 12);
      ctx.lineTo(-20, 18);
      ctx.lineTo(-24, 28);
      ctx.lineTo(10, 26);
      ctx.lineTo(16, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Hull Armor Layer 2 (Raised Spine Deck)
      ctx.fillStyle = isFrozen ? '#38bdf8' : (isOmega ? '#2a0832' : '#1f081e');
      ctx.beginPath();
      ctx.moveTo(22, 0);
      ctx.lineTo(6, -10);
      ctx.lineTo(-18, -10);
      ctx.lineTo(-22, 0);
      ctx.lineTo(-18, 10);
      ctx.lineTo(6, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing Hull Circuit Ribs
      ctx.strokeStyle = isFrozen ? '#e0f2fe' : (isOmega ? 'rgba(255, 0, 200, 0.75)' : 'rgba(255, 0, 85, 0.75)');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // Port circuit
      ctx.moveTo(8, -12); ctx.lineTo(-14, -22);
      // Starboard circuit
      ctx.moveTo(8, 12); ctx.lineTo(-14, 22);
      // Center spine
      ctx.moveTo(18, 0); ctx.lineTo(-18, 0);
      ctx.stroke();

      // Command Bridge Citadel & Red Sensor Visor
      ctx.fillStyle = isFrozen ? '#ffffff' : (isOmega ? '#ff007f' : '#ff0055');
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 8;
      ctx.fillRect(8, -4, 12, 8);
      // Sweeping Bridge visor glow
      const bridgeScan = Math.sin(tick * 5) * 4;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(12 + bridgeScan, -3, 3, 6);
      ctx.shadowBlur = 0;

      // 4 Heavy Point-Defense Turret Sponsons
      ctx.fillStyle = isFrozen ? '#7dd3fc' : '#475569';
      [[-2, -20], [-2, 20], [-16, -14], [-16, 14]].forEach(([px, py]) => {
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });

    } else if (c.type === 'trojan') {
      // ===== ARMORED TROJAN MECH TANK =====
      // Heavy Industrial Twin Diesel/Plasma Exhaust Puffs
      drawThruster(-17, -8, 8, 4, '#ff7700', '#ffcc00');
      drawThruster(-17, 8, 8, 4, '#ff7700', '#ffcc00');

      // Top & Bottom Heavy Caterpillar Tracks
      const treadSpeed = ((c.x + c.y) * 1.5) % 8;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = isFrozen ? '#38bdf8' : '#64748b';
      ctx.lineWidth = 1.5;

      // Top Tread
      ctx.fillRect(-16, -17, 30, 7);
      ctx.strokeRect(-16, -17, 30, 7);
      // Bottom Tread
      ctx.fillRect(-16, 10, 30, 7);
      ctx.strokeRect(-16, 10, 30, 7);

      // Tread Links (Animated Track Motion)
      ctx.strokeStyle = isFrozen ? '#bae6fd' : '#475569';
      ctx.lineWidth = 1.5;
      for (let tx = -14 + treadSpeed; tx < 12; tx += 6) {
        ctx.beginPath();
        ctx.moveTo(tx, -17); ctx.lineTo(tx, -10);
        ctx.moveTo(tx, 10); ctx.lineTo(tx, 17);
        ctx.stroke();
      }

      // Heavy Sloped Armored Chassis
      ctx.fillStyle = isFrozen ? '#0284c7' : '#1c1917';
      ctx.strokeStyle = isFrozen ? '#38bdf8' : '#f97316';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(16, -10);
      ctx.lineTo(12, -14);
      ctx.lineTo(-14, -12);
      ctx.lineTo(-17, 0);
      ctx.lineTo(-14, 12);
      ctx.lineTo(12, 14);
      ctx.lineTo(16, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Front Reinforced Ramming Plow with Hazard Stripes
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(13, -8, 6, 16);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(14, -7); ctx.lineTo(18, -3);
      ctx.moveTo(14, -2); ctx.lineTo(18, 2);
      ctx.moveTo(14, 3); ctx.lineTo(18, 7);
      ctx.stroke();

      // Armored Turret Bunker & Cyclopean Visor
      ctx.fillStyle = isFrozen ? '#38bdf8' : '#292524';
      ctx.fillRect(-4, -6, 14, 12);
      ctx.strokeStyle = isFrozen ? '#bae6fd' : '#ea580c';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-4, -6, 14, 12);

      // Sweeping Cylon Sensor Eye
      const eyeScan = Math.sin(tick * 5) * 3;
      ctx.fillStyle = isFrozen ? '#e0f2fe' : '#ef4444';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 6;
      ctx.fillRect(4, -3 + eyeScan, 4, 3);
      ctx.shadowBlur = 0;

    } else if (c.type === 'specter') {
      // ===== SPECTER QUANTUM VOID CRAFT =====
      // Floating Levitation Bobbing
      const hoverOffset = Math.sin(tick * 6 + c.id * 3) * 1.5;

      // Phase Glitch Ghost Trails (Afterimages)
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 1;
      this.drawPolygon(ctx, -6, hoverOffset * 0.5, c.size - 2, 4);
      ctx.stroke();
      ctx.restore();

      // Void Crystal Core Body
      ctx.fillStyle = isFrozen ? '#0284c7' : '#0f0a21';
      ctx.strokeStyle = isFrozen ? '#38bdf8' : '#8b5cf6';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(2, -13 + hoverOffset);
      ctx.lineTo(-14, 0);
      ctx.lineTo(2, 13 + hoverOffset);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner Pulsing Dimensional Core
      const corePulse = Math.sin(tick * 8) * 2;
      ctx.fillStyle = isFrozen ? '#bae6fd' : '#00f0ff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      this.drawPolygon(ctx, 0, hoverOffset, 5 + corePulse, 4);
      ctx.fill();
      ctx.shadowBlur = 0;

      // 4 Floating Phase Pylons
      ctx.fillStyle = '#c084fc';
      [[-8, -10], [8, -10], [-8, 10], [8, 10]].forEach(([px, py]) => {
        ctx.fillRect(px - 1.5, py + hoverOffset - 1.5, 3, 3);
      });

      // Animated Rotating Energy Forcefield (When Active Shielded)
      if (c.shield > 0) {
        ctx.save();
        ctx.rotate(tick * 2.2);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
        ctx.fillStyle = 'rgba(0, 240, 255, 0.12)';
        ctx.lineWidth = 1.5;
        this.drawPolygon(ctx, 0, 0, c.size + 8, 6);
        ctx.fill();
        ctx.stroke();

        // 6 Shield Nodes on Vertices
        for (let i = 0; i < 6; i++) {
          const sAngle = (i * Math.PI * 2) / 6;
          const nx = Math.cos(sAngle) * (c.size + 8);
          const ny = Math.sin(sAngle) * (c.size + 8);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(nx - 1.5, ny - 1.5, 3, 3);
        }
        ctx.restore();
      }

    } else if (c.type === 'swarm') {
      // ===== SWARM GLITCH INSECTOID MICRO-POD =====
      // High-Frequency Fluttering Cyber-Wings
      const wingFlutter = Math.sin(tick * 38 + c.id * 10) * 0.85;

      ctx.fillStyle = isFrozen ? 'rgba(56, 189, 248, 0.4)' : 'rgba(245, 158, 11, 0.35)';
      ctx.strokeStyle = isFrozen ? '#bae6fd' : '#fbbf24';
      ctx.lineWidth = 1;

      // Top Cyber-Wing
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.lineTo(-4, -13 * wingFlutter);
      ctx.lineTo(6, -11 * wingFlutter);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Bottom Cyber-Wing
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.lineTo(-4, 13 * wingFlutter);
      ctx.lineTo(6, 11 * wingFlutter);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Needle Stinger Thruster
      drawThruster(-8, 0, 9, 3, '#f59e0b', '#fff');

      // Segmented Biomechanical Chitin Body
      ctx.fillStyle = isFrozen ? '#0284c7' : '#181206';
      ctx.strokeStyle = isFrozen ? '#38bdf8' : '#f59e0b';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(14, 0); // Sharp stinger head
      ctx.lineTo(4, -5);
      ctx.lineTo(-4, -4);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-4, 4);
      ctx.lineTo(4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Compound Glowing Sensor Eyes
      ctx.fillStyle = isFrozen ? '#ffffff' : '#ef4444';
      ctx.fillRect(5, -3, 3, 2);
      ctx.fillRect(5, 1, 3, 2);

    } else {
      // ===== CYBER SCOUT / DRONE (DEFAULT) =====
      // Twin Pulsing Ion Jet Engines
      drawThruster(-12, -6, 10, 4, '#00f0ff', '#ffffff');
      drawThruster(-12, 6, 10, 4, '#00f0ff', '#ffffff');

      // Faceted Aerodynamic Delta-Wing Fighter
      ctx.fillStyle = isFrozen ? '#0284c7' : '#0a1424';
      ctx.strokeStyle = isFrozen ? '#38bdf8' : '#00f0ff';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(17, 0);        // Nose
      ctx.lineTo(3, -5);        // Wing root
      ctx.lineTo(-12, -14);     // Port wingtip
      ctx.lineTo(-8, -4);       // Port trailing edge
      ctx.lineTo(-13, 0);       // Engine divider
      ctx.lineTo(-8, 4);        // Starboard trailing edge
      ctx.lineTo(-12, 14);      // Starboard wingtip
      ctx.lineTo(3, 5);         // Wing root
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Wingtip Glowing Navigation LEDs
      const strobe = Math.sin(tick * 10) > 0;
      ctx.fillStyle = strobe ? '#00f0ff' : 'rgba(0, 240, 255, 0.3)';
      ctx.fillRect(-11, -14, 2, 2);
      ctx.fillRect(-11, 12, 2, 2);

      // Elevated Cockpit Armor Canopy
      ctx.fillStyle = isFrozen ? '#38bdf8' : '#1e293b';
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(2, -3);
      ctx.lineTo(-4, 0);
      ctx.lineTo(2, 3);
      ctx.closePath();
      ctx.fill();

      // Cyan Sensor Visor
      ctx.fillStyle = isFrozen ? '#ffffff' : '#00f0ff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 6;
      ctx.fillRect(3, -1.5, 5, 3);
      ctx.shadowBlur = 0;
    }

    // Shimmering Frost Crystal Facets (When Cryo Frozen)
    if (isFrozen) {
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.7)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        const fa = (i * Math.PI) / 2 + tick * 2;
        const fr = c.size * 0.7;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(fa) * fr, Math.sin(fa) * fr);
        ctx.stroke();
      }
    }

    ctx.restore();

    // ===== HEALTH & SHIELD TACTICAL OVERLAY (NON-ROTATED) =====
    const barW = Math.max(26, c.size * 2);
    const barH = 4;
    const hpPct = Math.max(0, c.hp / c.maxHp);
    const barX = c.x - barW / 2;
    const barY = c.y - c.size - 11;

    // HP Bar Pill Container
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(barX, barY, barW, barH, 2); else ctx.rect(barX, barY, barW, barH);
    ctx.fill();
    ctx.stroke();

    // Health Fill with Gradient / Tier Colors
    if (hpPct > 0) {
      const hpColor = hpPct > 0.55 ? '#10b981' : (hpPct > 0.25 ? '#f59e0b' : '#ef4444');
      ctx.fillStyle = hpColor;
      ctx.shadowColor = hpColor;
      ctx.shadowBlur = hpPct < 0.25 ? 6 : 0;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(barX, barY, barW * hpPct, barH, 2); else ctx.rect(barX, barY, barW * hpPct, barH);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Shield Bar (If Unit has Active Shield)
    if (c.maxShield > 0 && c.shield > 0) {
      const shieldPct = Math.max(0, c.shield / c.maxShield);
      const shieldY = barY - 6;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = 'rgba(14, 165, 233, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(barX, shieldY, barW, 3, 2); else ctx.rect(barX, shieldY, barW, 3);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(barX, shieldY, barW * shieldPct, 3, 2); else ctx.rect(barX, shieldY, barW * shieldPct, 3);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Boss Nameplate & Threat Badge
    if (c.type === 'boss') {
      const isOmega = c.name && c.name.includes('Omega');
      const nameY = c.y - c.size - (c.maxShield > 0 && c.shield > 0 ? 22 : 16);

      ctx.fillStyle = isOmega ? '#ff00aa' : '#ff3366';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(`☠ ${c.name || 'LEVIATHAN'} ☠`, c.x, nameY);
      ctx.shadowBlur = 0;
    }
  }

  // --- Procedural Cybernetic Turret Rendering (L1, L2, L3) ---
  drawTurret(ctx, t) {
    const conf = this.getEffectiveTurretConfig(t);
    const tick = this.globalTick;

    // 1. Range Indicator when Selected (Spotter bonus accurately enlarges radius)
    if (this.selectedActiveTurret === t) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.fillStyle = 'rgba(0, 240, 255, 0.05)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(t.x, t.y, conf.range, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Range perimeter rotating tick marks
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const ra = (i * Math.PI * 2) / 8 + tick * 0.5;
        ctx.beginPath();
        ctx.moveTo(t.x + Math.cos(ra) * (conf.range - 4), t.y + Math.sin(ra) * (conf.range - 4));
        ctx.lineTo(t.x + Math.cos(ra) * (conf.range + 4), t.y + Math.sin(ra) * (conf.range + 4));
        ctx.stroke();
      }
    }

    // 2. Heavy Beveled Octagonal Foundation Base (Fixed Orientation)
    const mod = t.pad ? t.pad.modifier : null;
    let modColor = null;
    if (mod === 'overclock') modColor = '#eab308';
    else if (mod === 'spotter') modColor = '#06b6d4';
    else if (mod === 'amplifier') modColor = '#f43f5e';

    // Outer Graphite Hull with Mod Aura if socket is boosted
    ctx.fillStyle = '#0a0f1d';
    ctx.strokeStyle = modColor || '#1e293b';
    ctx.lineWidth = modColor ? 2.5 : 2;
    if (modColor) {
      ctx.shadowColor = modColor;
      ctx.shadowBlur = 8;
    }
    this.drawPolygon(ctx, t.x, t.y, 18, 8);
    ctx.fill();
    ctx.stroke();
    if (modColor) ctx.shadowBlur = 0;

    // 4 Corner Mounting Hex-Bolts
    ctx.fillStyle = '#475569';
    const boltAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
    for (const ba of boltAngles) {
      const bx = t.x + Math.cos(ba) * 14.5;
      const by = t.y + Math.sin(ba) * 14.5;
      ctx.beginPath();
      ctx.arc(bx, by, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Concentric Inner Neon Circuit Ring
    const circuitPulse = Math.sin(tick * 3 + t.x) * 0.15 + 0.55;
    ctx.strokeStyle = conf.color;
    ctx.globalAlpha = circuitPulse;
    ctx.lineWidth = 1.5;
    this.drawPolygon(ctx, t.x, t.y, 13, 8);
    ctx.stroke();
    ctx.globalAlpha = 1.0;

    // Turntable Bearing Ring
    ctx.fillStyle = '#060913';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 6 Radial Bearing Notches
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    for (let i = 0; i < 6; i++) {
      const na = (i * Math.PI * 2) / 6;
      ctx.beginPath();
      ctx.moveTo(t.x + Math.cos(na) * 7.5, t.y + Math.sin(na) * 7.5);
      ctx.lineTo(t.x + Math.cos(na) * 9.5, t.y + Math.sin(na) * 9.5);
      ctx.stroke();
    }

    // 3. Rotating Weapon Turret Assembly with Firing Recoil
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rotation);

    const recoil = t.recoil || 0;

    if (t.type === 'laser') {
      // ===== PULSE / BEAM LASER WEAPON =====
      // Gimbal Mantlet Housing
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-6 - recoil * 0.5, -6, 11, 12);
      ctx.strokeRect(-6 - recoil * 0.5, -6, 11, 12);

      if (t.level === 1) {
        // Level 1: Sleek Heavy Pulse Laser with Optical Rail
        ctx.fillStyle = '#0b1320';
        ctx.strokeStyle = conf.color;
        ctx.lineWidth = 1.5;
        ctx.fillRect(-recoil, -3.5, 18, 7);
        ctx.strokeRect(-recoil, -3.5, 18, 7);

        // Neon Optical Conduit
        ctx.fillStyle = conf.color;
        ctx.fillRect(-recoil, -1, 16, 2);

        // Collimator Muzzle Shroud
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(15 - recoil, -4.5, 4, 9);
        // Optical Lens
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(18 - recoil, -2, 2, 4);

      } else if (t.level === 2) {
        // Level 2: Twin Parallel Phasers with Radiator Fins
        // Twin Barrels
        [-5, 2].forEach(by => {
          ctx.fillStyle = '#0b1320';
          ctx.strokeStyle = conf.color;
          ctx.lineWidth = 1.2;
          ctx.fillRect(-recoil, by, 19, 4);
          ctx.strokeRect(-recoil, by, 19, 4);

          // Optical rail
          ctx.fillStyle = conf.color;
          ctx.fillRect(-recoil, by + 1.2, 17, 1.6);

          // Collimator tips
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(17 - recoil, by + 0.5, 3, 3);
        });

        // Lateral Radiator Cooling Fins
        ctx.fillStyle = '#334155';
        ctx.fillRect(-2 - recoil, -8, 6, 2);
        ctx.fillRect(-2 - recoil, 7, 6, 2);

      } else {
        // Level 3: Tri-Beam Meltdown Matrix with Rotating Cyan Focus Prism
        // Center Super-Collimator
        ctx.fillStyle = '#0b1320';
        ctx.strokeStyle = conf.color;
        ctx.lineWidth = 1.5;
        ctx.fillRect(-recoil, -2.5, 22, 5);
        ctx.strokeRect(-recoil, -2.5, 22, 5);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(20 - recoil, -1.5, 3, 3);

        // Flanking Angled Emitters
        [-7.5, 4.5].forEach(by => {
          ctx.fillStyle = '#0b1320';
          ctx.strokeStyle = conf.color;
          ctx.lineWidth = 1.2;
          ctx.fillRect(-recoil, by, 18, 3.5);
          ctx.strokeRect(-recoil, by, 18, 3.5);
          ctx.fillStyle = conf.color;
          ctx.fillRect(16 - recoil, by + 0.5, 3, 2.5);
        });

        // Breech Matrix Core (Spinning Focus Crystal)
        ctx.save();
        ctx.translate(-recoil * 0.5, 0);
        ctx.rotate(tick * 4);
        ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
        this.drawPolygon(ctx, 0, 0, 5.5, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        this.drawPolygon(ctx, 0, 0, 2.5, 6);
        ctx.fill();
        ctx.restore();
      }

    } else if (t.type === 'plasma') {
      // ===== PLASMA HEAVY EXPLOSIVE MORTAR =====
      // Heavy Swivel Base
      ctx.fillStyle = '#180828';
      ctx.strokeStyle = '#4a044e';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-7 - recoil * 0.5, -7, 12, 14);
      ctx.strokeRect(-7 - recoil * 0.5, -7, 12, 14);

      if (t.level === 1) {
        // Level 1: Reinforced Mortar with Molten Chamber
        ctx.fillStyle = '#2e1065';
        ctx.strokeStyle = conf.color;
        ctx.lineWidth = 1.5;
        ctx.fillRect(-recoil, -5.5, 16, 11);
        ctx.strokeRect(-recoil, -5.5, 16, 11);

        // Molten Plasma Core in Breach
        const plasmaGlow = Math.sin(tick * 8) * 0.2 + 0.8;
        ctx.fillStyle = `rgba(217, 70, 239, ${plasmaGlow})`;
        ctx.beginPath();
        ctx.arc(4 - recoil, 0, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Flared Compression Nozzle
        ctx.fillStyle = '#4a044e';
        ctx.fillRect(14 - recoil, -7, 4, 14);

      } else if (t.level === 2) {
        // Level 2: Dual Magma Accelerator Rails with Containment Field
        // Twin Heavy Rails
        [-7, 2].forEach(by => {
          ctx.fillStyle = '#2e1065';
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 1.5;
          ctx.fillRect(-recoil, by, 18, 5.5);
          ctx.strokeRect(-recoil, by, 18, 5.5);
        });

        // Inter-rail Energy Crackle
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(6 - recoil, -4);
        ctx.lineTo(10 - recoil, 0);
        ctx.lineTo(6 - recoil, 4);
        ctx.stroke();

        // Dual Flared Muzzles
        ctx.fillStyle = '#ff00aa';
        ctx.fillRect(16 - recoil, -8, 4, 7);
        ctx.fillRect(16 - recoil, 1, 4, 7);

      } else {
        // Level 3: Singularity Void Cannon with Event Horizon Core
        ctx.fillStyle = '#1e052d';
        ctx.strokeStyle = '#ff00aa';
        ctx.lineWidth = 2;
        ctx.fillRect(-recoil, -8, 19, 16);
        ctx.strokeRect(-recoil, -8, 19, 16);

        // Quad Magnetic Accelerator Prongs
        ctx.fillStyle = '#4a044e';
        ctx.fillRect(16 - recoil, -9, 6, 4);
        ctx.fillRect(16 - recoil, 5, 6, 4);

        // Pulsing Singularity Vortex Core
        const voidScale = Math.sin(tick * 7) * 1.5 + 6.5;
        ctx.fillStyle = '#701a75';
        ctx.beginPath();
        ctx.arc(4 - recoil, 0, voidScale, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ff007f';
        ctx.beginPath();
        ctx.arc(4 - recoil, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(4 - recoil, 0, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (t.type === 'emp') {
      // ===== CRYOGENIC EMP FIELD GENERATOR =====
      if (t.level === 1) {
        // Level 1: Superconducting Dome with Rotating Gyro Ring
        // Superconducting Dome
        ctx.fillStyle = '#022c22';
        ctx.strokeStyle = conf.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 8.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pulsing Emerald Core
        ctx.fillStyle = conf.color;
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Single Rotating Gyro Ring
        ctx.save();
        ctx.rotate(tick * 2);
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.stroke();
        // 2 Nodes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(12, -1.5, 3, 3);
        ctx.fillRect(-15, -1.5, 3, 3);
        ctx.restore();

      } else if (t.level === 2) {
        // Level 2: Dual Counter-Rotating Cryo-Storm Gyroscope
        // Central Faceted Cryo Crystal
        ctx.fillStyle = '#064e3b';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        this.drawPolygon(ctx, 0, 0, 7.5, 6);
        ctx.fill();
        ctx.stroke();

        // Inner Clockwise Ring
        ctx.save();
        ctx.rotate(tick * 2.5);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 11.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(10.5, -1.5, 3, 3);
        ctx.fillRect(-13.5, -1.5, 3, 3);
        ctx.restore();

        // Outer Counter-Clockwise Ring
        ctx.save();
        ctx.rotate(-tick * 1.8);
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 15.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#00f0ff';
        ctx.fillRect(14.5, -1.5, 3, 3);
        ctx.fillRect(-17.5, -1.5, 3, 3);
        ctx.restore();

      } else {
        // Level 3: Sub-Zero Quantum Array with Triple Nested Gyro Rings & Absolute-Zero Star
        // 3 Nested Spinning Rings
        [
          { r: 10, spd: tick * 3.2, col: '#10b981' },
          { r: 14, spd: -tick * 2.2, col: '#06b6d4' },
          { r: 18, spd: tick * 1.5, col: '#38bdf8' }
        ].forEach(ring => {
          ctx.save();
          ctx.rotate(ring.spd);
          ctx.strokeStyle = ring.col;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(ring.r - 1.5, -1.5, 3, 3);
          ctx.fillRect(-ring.r - 1.5, -1.5, 3, 3);
          ctx.restore();
        });

        // Absolute Zero Quantum Crystal Star
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        this.drawPolygon(ctx, 0, 0, 5, 8);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

    } else if (t.type === 'railgun') {
      // ===== HYPERSONIC RAILGUN / RELATIVISTIC LANCE =====
      // Heavy Breech Counterweight & Recoil Housing
      ctx.fillStyle = '#1c1917';
      ctx.strokeStyle = '#44403c';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-9 - recoil, -5, 8, 10);
      ctx.strokeRect(-9 - recoil, -5, 8, 10);

      if (t.level === 1) {
        // Level 1: Slender Magnetic Accelerator with Copper Induction Coils
        ctx.fillStyle = '#0c0a09';
        ctx.strokeStyle = conf.color;
        ctx.lineWidth = 1.5;
        ctx.fillRect(-4 - recoil, -2.5, 26, 5);
        ctx.strokeRect(-4 - recoil, -2.5, 26, 5);

        // Center Rail Groove
        ctx.fillStyle = conf.color;
        ctx.fillRect(-4 - recoil, -0.7, 24, 1.4);

        // 2 Induction Coils
        ctx.fillStyle = '#d97706';
        ctx.fillRect(4 - recoil, -3.5, 3, 7);
        ctx.fillRect(13 - recoil, -3.5, 3, 7);

      } else if (t.level === 2) {
        // Level 2: Heavy Double-Spine Gauss Rail with Laser Sight
        ctx.fillStyle = '#0c0a09';
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-6 - recoil, -3.5, 30, 7);
        ctx.strokeRect(-6 - recoil, -3.5, 30, 7);

        // 3 Illuminated Capacitor Banks
        ctx.fillStyle = '#f59e0b';
        [1 - recoil, 9 - recoil, 17 - recoil].forEach(cx => {
          ctx.fillRect(cx, -4.5, 3.5, 9);
        });

        // Forward Laser Guide Beam
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(24 - recoil, 0);
        ctx.lineTo(44 - recoil, 0);
        ctx.stroke();

      } else {
        // Level 3: Relativistic Lance with 4-Stage Accelerator & Target Reticle
        ctx.fillStyle = '#0c0a09';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.8;
        ctx.fillRect(-8 - recoil, -4.5, 36, 9);
        ctx.strokeRect(-8 - recoil, -4.5, 36, 9);

        // Quad Sequential Accelerator Coils (Cascading Lighting Animation)
        const activeStage = Math.floor((tick * 16) % 4);
        [0 - recoil, 7 - recoil, 14 - recoil, 21 - recoil].forEach((cx, idx) => {
          ctx.fillStyle = idx === activeStage ? '#ffffff' : '#f97316';
          ctx.fillRect(cx, -5.5, 4, 11);
        });

        // Superconducting Rail Core
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-6 - recoil, -1, 32, 2);

        // Forward Holographic Targeting Reticle
        const retX = 38 - recoil;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(retX + 8, 0, 4, 0, Math.PI * 2);
        ctx.moveTo(retX + 8, -6); ctx.lineTo(retX + 8, 6);
        ctx.moveTo(retX + 2, 0); ctx.lineTo(retX + 14, 0);
        ctx.stroke();
      }
    }

    // Central Turret Core Fusion Reactor
    const coreGlow = Math.sin(tick * 6 + t.x) * 0.2 + 0.8;
    ctx.fillStyle = conf.color;
    ctx.shadowColor = conf.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();

    // 4. Sleek Floating Military Rank Insignia Badge
    const badgeY = t.y + 13;
    const modPip = mod === 'overclock' ? '⚡' : (mod === 'spotter' ? '🎯' : (mod === 'amplifier' ? '💥' : ''));
    const rankText = (t.level === 3 ? '★★★' : (t.level === 2 ? '▲▲' : '◆')) + (modPip ? ' ' + modPip : '');
    const badgeW = (t.level === 3 ? 24 : (t.level === 2 ? 18 : 14)) + (modPip ? 10 : 0);

    // Pill Backing
    ctx.fillStyle = 'rgba(10, 15, 29, 0.92)';
    ctx.strokeStyle = modColor || (t.level === 3 ? '#ff00aa' : (t.level === 2 ? '#f59e0b' : '#00f0ff'));
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(t.x - badgeW / 2, badgeY - 5, badgeW, 10, 3); else ctx.rect(t.x - badgeW / 2, badgeY - 5, badgeW, 10);
    ctx.fill();
    ctx.stroke();

    // Insignia Symbols
    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(rankText, t.x, badgeY + 3);

    // 5. Electronic Disruption Jammed Visual Overlay
    if (t.jammedTimer > 0) {
      ctx.save();
      const jamPulse = Math.sin(tick * 12) * 3;
      ctx.strokeStyle = '#ff0055';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 20 + jamPulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Jammed Warning Pill
      const jw = 56;
      const jy = t.y - 20;
      ctx.fillStyle = 'rgba(255, 0, 85, 0.92)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(t.x - jw / 2, jy - 6, jw, 12, 3); else ctx.rect(t.x - jw / 2, jy - 6, jw, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚡ JAMMED', t.x, jy + 3);
      ctx.restore();
    }
  }

  // --- Preparation Phase Cyber Banner ---
  drawPrepBanner(ctx) {
    const bannerW = 440;
    const bannerH = 44;
    const bannerX = 400 - bannerW / 2;
    const bannerY = 14;

    ctx.save();
    ctx.fillStyle = 'rgba(4, 8, 20, 0.88)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 8);
    else ctx.rect(bannerX, bannerY, bannerW, bannerH);
    ctx.fill();
    ctx.stroke();

    const nextWave = this.wave + 1;
    const nextTier = Math.min(5, Math.floor((nextWave - 1) / 5) + 1);
    const sectorName = this.currentSector ? this.currentSector.name : 'DEFENSE GRID';

    ctx.fillStyle = (nextTier === 5) ? '#ff0055' : (nextTier >= 3 ? '#ffaa00' : '#00f0ff');
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';

    if (this.autoWave) {
      const remainingSecs = Math.max(0, Math.ceil(this.prepTimer));
      ctx.fillText(`⏱️ AUTO IN ${remainingSecs}s • ${sectorName.toUpperCase()}`, 400, bannerY + 18);
    } else {
      ctx.fillText(`🛡️ ${sectorName.toUpperCase()} • WAVE ${nextWave} / ${this.maxWaves}`, 400, bannerY + 18);
    }

    ctx.fillStyle = (nextTier === 5) ? '#ff77aa' : '#00ffaa';
    ctx.font = '10px monospace';
    const subHint = (nextTier === 5)
      ? `⚠️ CRITICAL THREAT: Maximize turrets & cryo synergies to survive!`
      : `Build & upgrade defenses • Tap 'Start Wave' when ready!`;
    ctx.fillText(subHint, 400, bannerY + 34);
    ctx.restore();
  }

  // --- Draw Substantially Enlarged Upgrade / Sell Action Buttons ---
  drawInspectorOverlay(ctx, t) {
    const nextConf = this.getTurretConfig(t.type, t.level + 1);
    const canUpgrade = (t.level < 3 && this.energy >= nextConf.cost);

    // 1. Upgrade Button (124px x 34px - Substantially Enlarged for Mobile & Touch)
    const upW = 124;
    const upH = 34;
    const upX = t.x - upW / 2;
    const upY = t.y - 58;

    // Tactical Special Mod Pad Active Header Badge
    const mod = t.pad ? t.pad.modifier : null;
    if (mod) {
      let modText = '';
      let modColor = '#00f0ff';
      if (mod === 'overclock') {
        modText = '⚡ OVERCLOCK (+25% SPEED)';
        modColor = '#eab308';
      } else if (mod === 'spotter') {
        modText = '🎯 SPOTTER (+30% RANGE)';
        modColor = '#06b6d4';
      } else if (mod === 'amplifier') {
        modText = '💥 AMPLIFIER (+20% DMG)';
        modColor = '#f43f5e';
      }

      const badgeW = 166;
      const badgeH = 18;
      const badgeX = t.x - badgeW / 2;
      const badgeY = (t.y < 75) ? (t.y + 60) : (upY - 22);

      ctx.fillStyle = 'rgba(2, 6, 16, 0.94)';
      ctx.strokeStyle = modColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
      else ctx.rect(badgeX, badgeY, badgeW, badgeH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = modColor;
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(modText, t.x, badgeY + 12);
    }

    const upText = (t.level >= 3) ? '⭐ MAX LEVEL' : `⬆️ UPGRADE L${t.level + 1} (${nextConf.cost}⚡)`;

    // Drop Shadow / Background Plate
    ctx.fillStyle = 'rgba(2, 6, 16, 0.92)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(upX - 2, upY - 2, upW + 4, upH + 4, 8);
    else ctx.rect(upX - 2, upY - 2, upW + 4, upH + 4);
    ctx.fill();

    ctx.fillStyle = (t.level >= 3) ? 'rgba(0, 240, 255, 0.25)' : (canUpgrade ? 'rgba(0, 255, 102, 0.95)' : 'rgba(45, 50, 65, 0.85)');
    ctx.strokeStyle = (t.level >= 3) ? '#00f0ff' : (canUpgrade ? '#00ff66' : 'rgba(255, 255, 255, 0.2)');
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(upX, upY, upW, upH, 6);
    else ctx.rect(upX, upY, upW, upH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = (t.level >= 3) ? '#00f0ff' : (canUpgrade ? '#000' : '#889');
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(upText, t.x, upY + 21);

    // 2. Sell Button (104px x 28px - Substantially Enlarged for Mobile & Touch)
    let totalInvested = 0;
    for (let l = 1; l <= t.level; l++) {
      totalInvested += this.getTurretConfig(t.type, l).cost;
    }
    const refund = Math.round(totalInvested * 0.70);

    const sellW = 104;
    const sellH = 28;
    const sellX = t.x - sellW / 2;
    const sellY = t.y + 28;

    // Drop Shadow Plate
    ctx.fillStyle = 'rgba(2, 6, 16, 0.92)';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(sellX - 2, sellY - 2, sellW + 4, sellH + 4, 7);
    else ctx.rect(sellX - 2, sellY - 2, sellW + 4, sellH + 4);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 0, 85, 0.9)';
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(sellX, sellY, sellW, sellH, 6);
    else ctx.rect(sellX, sellY, sellW, sellH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`💰 SELL (+${refund}⚡)`, t.x, sellY + 18);
  }

  drawPolygon(ctx, x, y, radius, sides) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides;
      const px = x + radius * Math.cos(angle);
      const py = y + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  // --- HUD Updates ---
  updateHUD() {
    const elHp = document.getElementById('defense-hud-hp');
    const elEnergy = document.getElementById('defense-hud-energy');
    const elWave = document.getElementById('defense-hud-wave');
    const elScore = document.getElementById('defense-hud-score');
    const elSpeed = document.getElementById('defense-btn-speed');
    const elAuto = document.getElementById('defense-btn-auto');
    const elNext = document.getElementById('defense-btn-nextwave');

    if (elHp) elHp.innerText = `${this.coreHp} / ${this.maxCoreHp}`;
    if (elEnergy) elEnergy.innerText = `⚡ ${this.energy}`;
    if (elWave) elWave.innerText = `${this.wave} / ${this.maxWaves}`;
    if (elScore) elScore.innerText = this.score.toLocaleString();
    if (elSpeed) elSpeed.innerText = `⏩ ${this.gameSpeed}x`;

    if (elAuto) {
      elAuto.innerText = `🔄 Auto: ${this.autoWave ? 'ON' : 'OFF'}`;
      elAuto.style.borderColor = this.autoWave ? 'var(--color-success)' : 'rgba(255,255,255,0.25)';
      elAuto.style.color = this.autoWave ? 'var(--color-success)' : 'var(--text-muted)';
    }

    if (elNext) {
      if (this.isPrepPhase) {
        elNext.innerText = `▶ Start Wave`;
        elNext.style.borderColor = 'var(--color-success)';
        elNext.style.color = 'var(--color-success)';
      } else if (this.waveActive) {
        elNext.innerText = `▶ In Progress`;
        elNext.style.borderColor = 'var(--text-muted)';
        elNext.style.color = 'var(--text-muted)';
      } else {
        elNext.innerText = `▶ Start Wave`;
        elNext.style.borderColor = 'var(--color-success)';
        elNext.style.color = 'var(--color-success)';
      }
    }
  }

  // --- Speed Controls: 1x, 2x, 4x ---
  toggleSpeed() {
    const nextIdx = (this.speeds.indexOf(this.gameSpeed) + 1) % this.speeds.length;
    this.gameSpeed = this.speeds[nextIdx];
    this.updateHUD();
    if (sfx && typeof sfx.playCoin === 'function') sfx.playCoin();
  }

  // --- Auto-Wave Toggle ---
  toggleAutoWave() {
    this.autoWave = !this.autoWave;
    if (this.autoWave && this.isPrepPhase) {
      this.prepTimer = 5.0; // 5-second countdown when toggled ON during prep
    }
    this.updateHUD();
    if (sfx && typeof sfx.playCoin === 'function') sfx.playCoin();
  }

  // --- Start Next Wave (Zero Energy Penalty For Waiting) ---
  triggerNextWave() {
    if (this.state !== 'PLAYING') return;

    if (this.isPrepPhase) {
      if (sfx && typeof sfx.playPowerUp === 'function') sfx.playPowerUp();
      this.queueWave(this.wave + 1);
    } else if (!this.waveActive) {
      this.queueWave(this.wave + 1);
    } else {
      this.addFloatingText('Wave in progress!', 400, 200, '#ffaa00');
    }
  }

  selectTurretType(type) {
    this.selectedTurretType = type;
    document.querySelectorAll('.turret-select-btn').forEach(btn => {
      const isCurrent = (btn.getAttribute('data-turret-type') === type);
      btn.classList.toggle('active', isCurrent);
      btn.style.background = '';
      btn.style.borderColor = '';
    });
    if (sfx && typeof sfx.playCoin === 'function') sfx.playCoin();
  }

  // --- End Session & PGT Payout Handshake ---
  async endSession(victory = false) {
    this.state = victory ? 'VICTORY' : 'GAMEOVER';
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

    const cleanScore = Math.max(0, Math.floor(this.score + (victory ? 3000 : 0)));

    // Hard 500k pts score ceiling check
    if (cleanScore > 500000) {
      if (window.antiBot && typeof window.antiBot.reportSuspiciousActivity === 'function') {
        window.antiBot.reportSuspiciousActivity('Cyber Defense', 'score_limit_500k_exceeded', { score: cleanScore });
      }
      if (typeof window.endArcadeSession === 'function' && this.sessionId) {
        window.endArcadeSession(this.sessionId, cleanScore, this.creepsKilled, 0, 1.0).catch(() => {});
      }
      const gameOverOverlay = document.getElementById('defense-overlay-gameover');
      const titleEl = document.getElementById('defense-gameover-title');
      const finalScoreEl = document.getElementById('defense-res-score');
      const finalPgtEl = document.getElementById('defense-res-payout');
      const multBreakdownEl = document.getElementById('defense-mult-breakdown');
      const highscoreText = document.getElementById('defense-highscore-text');

      if (titleEl) {
        titleEl.innerText = '⚠️ SCORE CEILING EXCEEDED';
        titleEl.style.color = 'var(--color-danger)';
      }
      if (finalScoreEl) finalScoreEl.innerText = cleanScore.toLocaleString();
      if (finalPgtEl) finalPgtEl.innerHTML = `<span style="color:var(--color-danger);">+0.00 PGT (Limit Exceeded)</span>`;
      if (multBreakdownEl) multBreakdownEl.innerHTML = `<span style="color:var(--color-danger); font-weight:700;">⚠️ Maximum Score Limit (500,000) Exceeded</span>`;
      if (highscoreText) highscoreText.style.display = 'none';
      if (gameOverOverlay) {
        gameOverOverlay.classList.remove('hidden');
        gameOverOverlay.style.display = 'flex';
      }
      return;
    }

    let isNewHigh = (cleanScore > (window.appState?.state?.defenseHighScore || 0));

    // Payout Calculation
    let isHarvestDisabled = false;
    let limitReached = false;
    const isPlayerConnected = window.appState && typeof window.appState.isPlayerConnected === 'function' && window.appState.isPlayerConnected();
    if (!isPlayerConnected && typeof window.recordGuestGamePlay === 'function') {
      window.recordGuestGamePlay();
    }

    const settings = (window.appState && window.appState.state && window.appState.state.gamePayoutSettings) || {};
    const conf = settings.defense || {};
    if (conf.harvest_enabled === false) isHarvestDisabled = true;

    // Compute Multipliers
    const multis = (window.appState && typeof window.appState.getMultipliers === 'function') ? window.appState.getMultipliers() : null;
    const nftPct = multis ? (multis.nftGameMultiplier || 0) : 0;
    const nftMult = 1 + (nftPct / 100);
    const isVip = (window.appState && typeof window.appState.isVipActive === 'function') && window.appState.isVipActive();
    const vipMult = isVip ? 2.0 : 1.0;
    const isAmb = (window.appState && window.appState.state && window.appState.state.isAmbassador);
    const ambMult = isAmb ? 2.0 : 1.0;
    const relicMult = (multis && (multis.isApexUnlocked || multis.isSeason1ApexUnlocked)) ? 1.5 : 1.0;
    const playerMult = parseFloat((nftMult * vipMult * ambMult * relicMult).toFixed(2));

    const globalEarnMult = (window.appState && window.appState.state && window.appState.state.globalEarnMultiplier !== undefined) ? Number(window.appState.state.globalEarnMultiplier) : 1.0;
    // Strict 75.00 PGT Base Cap
    const rawBase = Math.min(75.0, ((cleanScore / 4000.0) + (this.creepsKilled * 0.025)) * globalEarnMult);
    // Strict 1000.00 PGT Catastrophe Cap
    const calculatedPgt = Math.min(1000.0, parseFloat((rawBase * playerMult).toFixed(2)));
    let verifiedPgt = calculatedPgt;

    // Server End Session RPC
    if (typeof window.endArcadeSession === 'function' && this.sessionId && cleanScore > 0) {
      try {
        const res = await window.endArcadeSession(this.sessionId, cleanScore, this.creepsKilled, 0, nftMult);
        if (res && (res.payout !== undefined || res.payout_pgt !== undefined || res.success)) {
          const serverPayout = parseFloat(res.payout_pgt !== undefined ? res.payout_pgt : (res.payout || 0));
          if (res.harvest_enabled === false) {
            isHarvestDisabled = true;
            verifiedPgt = 0.0;
          } else {
            // Defensively cap at calculatedPgt in case server RPC formula update is pending
            verifiedPgt = serverPayout > 0 ? Math.min(serverPayout, calculatedPgt) : calculatedPgt;
          }
          if (res.is_new_high) isNewHigh = true;
          if (res.limit_reached) limitReached = true;
        } else if (res && (res.limit_reached || (res.error && res.error.includes('limit')))) {
          limitReached = true;
          verifiedPgt = 0.0;
        }
      } catch (err) {
        console.warn('[CyberDefense] endArcadeSession error:', err);
      }
    }

    // High Score Persistence
    if (isNewHigh && window.appState) {
      window.appState.update({
        defenseHighScore: cleanScore,
        alltimeDefenseHighScore: Math.max(window.appState.state.alltimeDefenseHighScore || 0, cleanScore)
      });
      if (typeof triggerConfetti === 'function') triggerConfetti();
    }

    if (cleanScore > 0) {
      if (typeof window.submitHighScoreToDB === 'function') {
        window.submitHighScoreToDB('defense', cleanScore);
      } else if (typeof window.submitArcadeHighScore === 'function') {
        window.submitArcadeHighScore('defense', cleanScore);
      }
    }

    if (window.trackQuestProgress) {
      window.trackQuestProgress('arcade', 1);
    }

    if (window.appState && typeof window.appState.addActivity === 'function' && verifiedPgt > 0) {
      window.appState.addActivity('You', `defended ${this.wave} waves in Cyber Defense (${cleanScore.toLocaleString()} pts)`, `+${verifiedPgt.toFixed(2)} PGT`);
    }

    // Atomically log game metrics for Master Admin dashboard
    const durationSeconds = this.sessionStartTime ? Math.max(1, Math.round((Date.now() - this.sessionStartTime) / 1000)) : 30;
    if (typeof window.recordGameMetrics === 'function') {
      window.recordGameMetrics('Cyber Defense', 0, verifiedPgt, durationSeconds);
    }

    // Render Game Over Overlay
    const startOverlay = document.getElementById('defense-overlay-start');
    const gameOverOverlay = document.getElementById('defense-overlay-gameover');
    const titleEl = document.getElementById('defense-gameover-title');
    const finalScoreEl = document.getElementById('defense-res-score');
    const finalWavesEl = document.getElementById('defense-res-waves');
    const finalKillsEl = document.getElementById('defense-res-kills');
    const finalPgtEl = document.getElementById('defense-res-payout');
    const multBreakdownEl = document.getElementById('defense-mult-breakdown');
    const highscoreText = document.getElementById('defense-highscore-text');
    const limitBox = document.getElementById('defense-limit-warning');

    if (titleEl) {
      titleEl.innerText = victory ? '👑 DATA CORE SECURED!' : '💥 CORE COMPROMISED!';
      titleEl.style.color = victory ? 'var(--color-success)' : 'var(--color-danger)';
    }
    const sectorResEl = document.getElementById('defense-res-sector');
    if (sectorResEl && this.currentSector) {
      sectorResEl.innerText = `SECTOR ${this.currentSector.number}: ${this.currentSector.name.toUpperCase()}`;
    }
    if (finalScoreEl) finalScoreEl.innerText = cleanScore.toLocaleString();
    if (finalWavesEl) finalWavesEl.innerText = `${this.wave} / ${this.maxWaves}`;
    if (finalKillsEl) finalKillsEl.innerText = this.creepsKilled.toLocaleString();

    let payoutDisplay = `+${verifiedPgt.toFixed(2)} PGT`;
    if (isHarvestDisabled) {
      payoutDisplay = `+0.00 PGT <span style="display:block; color:var(--color-danger); font-size:0.75rem; margin-top:2px;">🚫 In-Game Harvest Paused by Admin</span>`;
    } else if (limitReached) {
      payoutDisplay = `+0.00 PGT <span style="display:block; color:var(--color-warning); font-size:0.75rem; margin-top:2px;">⚠️ Daily Limit Reached</span>`;
    }
    if (finalPgtEl) finalPgtEl.innerHTML = payoutDisplay;

    if (multBreakdownEl) {
      multBreakdownEl.innerHTML = `Base: ${rawBase.toFixed(2)} PGT • Multiplier: <strong style="color:var(--color-secondary);">${playerMult.toFixed(1)}x</strong>`;
    }
    if (highscoreText) highscoreText.style.display = isNewHigh ? 'block' : 'none';

    if (startOverlay) startOverlay.style.display = 'none';
    if (gameOverOverlay) gameOverOverlay.style.display = 'flex';

    const turretBar = document.getElementById('defense-turret-bar');
    if (turretBar) turretBar.style.display = 'none';

    // Auto-advance to next sector for the subsequent run
    this.currentSectorIndex = (this.currentSectorIndex + 1) % this.sectors.length;
    this.updateSectorUI();
  }

  stop() {
    this.state = 'IDLE';
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    const turretBar = document.getElementById('defense-turret-bar');
    if (turretBar) turretBar.style.display = 'none';
  }
}

// Global Singleton & Helpers
export let defenseEngine = null;

export function initCyberDefense() {
  if (!defenseEngine) {
    defenseEngine = new CyberDefenseEngine();
    window.defenseEngine = defenseEngine;
  }
  return defenseEngine;
}

export function startCyberDefense() {
  const engine = initCyberDefense();
  if (engine) engine.start();
}

export function toggleDefenseSpeed() {
  if (defenseEngine) defenseEngine.toggleSpeed();
}

export function toggleDefenseAutoWave() {
  if (defenseEngine) defenseEngine.toggleAutoWave();
}

export function triggerNextDefenseWave() {
  if (defenseEngine) defenseEngine.triggerNextWave();
}

export function selectDefenseTurretType(type) {
  const engine = defenseEngine || (typeof initCyberDefense === 'function' ? initCyberDefense() : null);
  if (engine) engine.selectTurretType(type);
}

export function cycleDefenseSector(dir = 1) {
  const engine = defenseEngine || (typeof initCyberDefense === 'function' ? initCyberDefense() : null);
  if (engine) engine.cycleSector(dir);
}

export function selectDefenseSector(index) {
  const engine = defenseEngine || (typeof initCyberDefense === 'function' ? initCyberDefense() : null);
  if (engine) engine.loadSector(index);
}

// Attach to window
if (typeof window !== 'undefined') {
  window.initCyberDefense = initCyberDefense;
  window.startCyberDefense = startCyberDefense;
  window.toggleDefenseSpeed = toggleDefenseSpeed;
  window.toggleDefenseAutoWave = toggleDefenseAutoWave;
  window.triggerNextDefenseWave = triggerNextDefenseWave;
  window.selectDefenseTurretType = selectDefenseTurretType;
  window.cycleDefenseSector = cycleDefenseSector;
  window.selectDefenseSector = selectDefenseSector;
}
