// ==============================================================================
// POLYGAME: CYBER DEFENSE 2D TOWER DEFENSE ARCADE ENGINE
// Tactical Neon Circuit Defense with 4 Upgradeable Turrets, Malware Waves,
// Boss Battles, Responsive Canvas, Audio FX, and Secure PGT Session Payouts.
// ==============================================================================

import { appState } from './src/js/core/state.js';
import { sfx } from './src/js/core/audio.js';
import { triggerConfetti } from './src/js/utils/confetti.js';

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
    this.energy = 200; // Balanced tactical starting energy
    this.score = 0;
    this.creepsKilled = 0;
    this.wave = 0;
    this.maxWaves = 20;
    this.speeds = [1, 2, 4, 8];
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

    // Turret Selection & Pads
    this.selectedTurretType = 'laser'; // laser, plasma, emp, railgun
    this.selectedActiveTurret = null;  // For inspection/upgrade
    this.globalTick = 0;

    // Waypoints for the Circuit Highway (800 x 450 canvas)
    this.waypoints = [
      { x: 0,   y: 150 },
      { x: 180, y: 150 },
      { x: 180, y: 320 },
      { x: 360, y: 320 },
      { x: 360, y: 120 },
      { x: 540, y: 120 },
      { x: 540, y: 260 },
      { x: 740, y: 260 }
    ];

    // 12 Tactical Turret Pads along the circuit chokepoints
    this.pads = [
      { id: 1,  x: 90,  y: 85,  turret: null },
      { id: 2,  x: 90,  y: 215, turret: null },
      { id: 3,  x: 270, y: 220, turret: null },
      { id: 4,  x: 270, y: 385, turret: null },
      { id: 5,  x: 450, y: 60,  turret: null },
      { id: 6,  x: 450, y: 220, turret: null },
      { id: 7,  x: 450, y: 385, turret: null },
      { id: 8,  x: 630, y: 160, turret: null },
      { id: 9,  x: 630, y: 340, turret: null },
      { id: 10, x: 180, y: 45,  turret: null },
      { id: 11, x: 360, y: 395, turret: null },
      { id: 12, x: 730, y: 160, turret: null }
    ];

    // Entities
    this.creeps = [];
    this.turrets = [];
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];

    // Screen FX
    this.screenShake = 0;
    this.corePulse = 0;

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
      handleAction(e.clientX, e.clientY);
    });

    this.canvas.addEventListener('touchend', (e) => {
      if (e.changedTouches && e.changedTouches.length > 0) {
        const t = e.changedTouches[0];
        handleAction(t.clientX, t.clientY);
      }
    }, { passive: true });
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
        cost: level === 1 ? 100 : (level === 2 ? 160 : 280),
        range: level === 1 ? 120 : (level === 2 ? 145 : 175),
        damage: level === 1 ? 18 : (level === 2 ? 38 : 72),
        rate: level === 1 ? 0.20 : (level === 2 ? 0.16 : 0.12),
        desc: 'Fast energy beam. Melts unarmored creeps & shields.'
      },
      plasma: {
        name: 'Plasma Mortar',
        color: '#ff00aa',
        cost: level === 1 ? 150 : (level === 2 ? 220 : 360),
        range: level === 1 ? 140 : (level === 2 ? 170 : 205),
        damage: level === 1 ? 65 : (level === 2 ? 130 : 240),
        splash: level === 1 ? 60 : (level === 2 ? 80 : 105),
        rate: level === 1 ? 1.15 : (level === 2 ? 1.00 : 0.85),
        desc: 'Heavy explosive AoE. Obliterates swarms and burns armor.'
      },
      emp: {
        name: 'EMP Frost Pylon',
        color: '#00ffaa',
        cost: level === 1 ? 120 : (level === 2 ? 180 : 300),
        range: level === 1 ? 115 : (level === 2 ? 140 : 170),
        damage: level === 1 ? 15 : (level === 2 ? 32 : 65),
        slow: level === 1 ? 0.50 : (level === 2 ? 0.65 : 0.80),
        slowDuration: level === 1 ? 2.5 : (level === 2 ? 3.2 : 4.0),
        rate: level === 1 ? 1.10 : (level === 2 ? 0.95 : 0.80),
        desc: 'Radial cryo pulse. Slows fast units & deals 3.5x damage to shields.'
      },
      railgun: {
        name: 'Railgun Sniper',
        color: '#ffaa00',
        cost: level === 1 ? 200 : (level === 2 ? 300 : 480),
        range: level === 1 ? 220 : (level === 2 ? 265 : 320),
        damage: level === 1 ? 160 : (level === 2 ? 330 : 680),
        rate: level === 1 ? 2.00 : (level === 2 ? 1.75 : 1.50),
        desc: 'Long range hypervelocity sniper. 100% Armor Penetration.'
      }
    };
    return configs[type] || configs.laser;
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
    this.energy = 200; // Balanced tactical starting energy
    this.score = 0;
    this.creepsKilled = 0;
    this.wave = 0;
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

    // Clear Turret Pads
    this.pads.forEach(p => p.turret = null);

    // Hide Overlays
    const startOverlay = document.getElementById('defense-overlay-start');
    const gameOverOverlay = document.getElementById('defense-overlay-gameover');
    if (startOverlay) startOverlay.style.display = 'none';
    if (gameOverOverlay) gameOverOverlay.style.display = 'none';
    this.updateHUD();

    const turretBar = document.getElementById('defense-turret-bar');
    if (turretBar) turretBar.style.display = 'flex';
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

  // --- Wave Generation with Strategic Archetypes ---
  queueWave(waveNum) {
    this.wave = waveNum;
    this.waveActive = true;
    this.isPrepPhase = false;
    this.prepTimer = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;

    const isBossWave = (waveNum % 5 === 0);
    const count = 7 + waveNum * 2;
    const hpMult = 1 + (waveNum - 1) * 0.32;

    for (let i = 0; i < count; i++) {
      let type = 'drone';

      // Wave-based creep archetype escalation
      if (waveNum >= 3 && (i % 3 === 0)) {
        type = 'swarm'; // Fast pack runners
      }
      if (waveNum >= 6 && (i % 4 === 1)) {
        type = 'trojan'; // Heavy armored units
      }
      if (waveNum >= 8 && (i % 4 === 2)) {
        type = 'specter'; // Shielded glitchers
      }

      let hp = Math.round(75 * hpMult);
      let shield = 0;
      let armor = 0;
      let speed = 1.4;

      if (type === 'swarm') {
        hp = Math.round(42 * hpMult);
        speed = 2.25;
      } else if (type === 'trojan') {
        hp = Math.round(180 * hpMult);
        armor = 1; // 45% beam mitigation, weak to Railgun & Plasma
        speed = 0.85;
      } else if (type === 'specter') {
        hp = Math.round(90 * hpMult);
        shield = Math.round(90 * hpMult); // Blue energy shield, 3.5x EMP weakness
        speed = 1.35;
      }

      this.spawnQueue.push({ type, hp, shield, armor, speed });
    }

    // Boss Wave every 5th wave (Leviathan Dreadnought)
    if (isBossWave) {
      const bossHp = Math.round(1100 * hpMult);
      const bossShield = Math.round(350 * hpMult);
      this.spawnQueue.push({
        type: 'boss',
        hp: bossHp,
        shield: bossShield,
        armor: 1,
        speed: 0.60
      });
      this.addFloatingText(`⚠️ LEVIATHAN DETECTED: WAVE ${waveNum}!`, 400, 180, '#ff0055');
    } else {
      this.addFloatingText(`⚡ WAVE ${waveNum} COMMENCING!`, 400, 180, '#00f0ff');
    }

    if (sfx && typeof sfx.playLaser === 'function') sfx.playLaser();
    this.updateHUD();
  }

  // --- Spawn Single Creep Entity ---
  spawnCreep(spec) {
    const creep = {
      id: Date.now() + Math.random(),
      type: spec.type,
      hp: spec.hp,
      maxHp: spec.hp,
      shield: spec.shield || 0,
      maxShield: spec.shield || 0,
      armor: spec.armor || 0,
      baseSpeed: spec.speed,
      speed: spec.speed,
      slowTimer: 0,
      slowEffect: 0,
      x: this.waypoints[0].x,
      y: this.waypoints[0].y,
      waypointIndex: 1,
      angle: 0,
      size: spec.type === 'boss' ? 28 : (spec.type === 'trojan' ? 20 : (spec.type === 'specter' ? 16 : (spec.type === 'swarm' ? 10 : 14))),
      color: spec.type === 'boss' ? '#ff0055' : (spec.type === 'trojan' ? '#ff7700' : (spec.type === 'specter' ? '#00f0ff' : (spec.type === 'swarm' ? '#ffaa00' : '#00e5ff'))),
      bounty: spec.type === 'boss' ? 120 : (spec.type === 'trojan' ? 22 : (spec.type === 'specter' ? 20 : (spec.type === 'swarm' ? 6 : 10)))
    };
    this.creeps.push(creep);
  }

  // --- Main Game Loop with Physics Sub-Stepping ---
  loop(timestamp) {
    if (this.state !== 'PLAYING') return;

    const rawDt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;
    this.globalTick += rawDt;

    // Physics sub-stepping prevents tunneling/clipped waypoints at 4x & 8x speed
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
    // 1. Preparation Phase Countdown
    if (this.isPrepPhase) {
      this.prepTimer -= dt;
      if (this.autoWave && this.prepTimer <= 0) {
        this.queueWave(this.wave + 1);
      } else if (this.prepTimer <= 0) {
        this.queueWave(this.wave + 1);
      }
      this.updateHUD();
      return;
    }

    // 2. Creep Spawning
    if (this.waveActive && this.spawnQueue.length > 0) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnCreep(this.spawnQueue.shift());
      }
    } else if (this.waveActive && this.spawnQueue.length === 0 && this.creeps.length === 0) {
      // Wave Cleared!
      this.waveActive = false;
      this.score += this.wave * 150;
      const waveBonus = 40 + this.wave * 12;
      this.energy += waveBonus;
      this.addFloatingText(`+${waveBonus}⚡ Wave Bonus!`, 400, 200, '#00ff66');
      if (sfx && typeof sfx.playSuccess === 'function') sfx.playSuccess();

      if (this.wave >= this.maxWaves) {
        this.endSession(true); // Victory!
        return;
      }

      // Enter Tactical Preparation Phase
      this.isPrepPhase = true;
      this.prepTimer = this.prepDuration;
      this.updateHUD();
    }

    // 3. Creeps Movement along Circuit Waypoints
    for (let i = this.creeps.length - 1; i >= 0; i--) {
      const c = this.creeps[i];

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
        // Reached Quantum Core!
        const dmg = (c.type === 'boss') ? 3 : 1;
        this.coreHp = Math.max(0, this.coreHp - dmg);
        this.screenShake = 12;
        this.spawnSparks(c.x, c.y, '#ff0055', 25);
        this.addFloatingText(`-${dmg} HP`, c.x, c.y - 15, '#ff0055');
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
      const conf = this.getTurretConfig(t.type, t.level);
      if (t.cooldown > 0) t.cooldown -= dt;
      if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - 18 * dt);

      // Target Selection: Creep furthest along path in range
      let bestCreep = null;
      let maxWP = -1;
      let minTargetDist = Infinity;

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
          this.screenShake = 5;
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
      this.screenShake = 3;
      this.spawnRing(t.x, t.y, conf.range, conf.color);
      for (const c of this.creeps) {
        const dist = Math.hypot(c.x - t.x, c.y - t.y);
        if (dist <= conf.range) {
          c.slowTimer = conf.slowDuration;
          c.slowEffect = conf.slow;
          this.damageCreep(c, conf.damage, 'emp');
          this.spawnSparks(c.x, c.y, '#00ffaa', 5);
        }
      }
      if (sfx && typeof sfx.playCoin === 'function') sfx.playCoin();

    } else if (t.type === 'railgun') {
      // Hypervelocity penetrating beam
      this.screenShake = 6;
      this.projectiles.push({
        type: 'beam',
        x1: t.x, y1: t.y,
        x2: target.x + (target.x - t.x) * 1.5,
        y2: target.y + (target.y - t.y) * 1.5,
        color: conf.color,
        width: 3 + t.level * 2,
        life: 0.18
      });
      this.damageCreep(target, conf.damage, 'railgun');
      this.spawnSparks(target.x, target.y, '#ffffff', 12);
      if (sfx && typeof sfx.playLaser === 'function') sfx.playLaser();
    }
  }

  // --- Strategic Creep Damage with Armor & Shields ---
  damageCreep(creep, amount, damageType = 'laser') {
    let dmg = amount;

    // 1. Energy Shield Mechanics (Specters & Bosses)
    if (creep.shield > 0) {
      if (damageType === 'emp') {
        dmg *= 3.5; // EMP shatters energy shields
        this.spawnSparks(creep.x, creep.y, '#00f0ff', 10);
      } else if (damageType === 'laser') {
        dmg *= 1.3; // Laser burns through shields
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
          // Rapid light attacks (Laser/EMP) mitigated by 45%
          dmg = Math.max(2, dmg * 0.55);
        }
      }
      creep.hp -= dmg;
    }

    // 3. Creep Destruction & Bounty
    if (creep.hp <= 0) {
      const idx = this.creeps.indexOf(creep);
      if (idx !== -1) {
        this.creeps.splice(idx, 1);
        this.creepsKilled++;
        this.energy += creep.bounty;
        this.score += creep.bounty * 10;
        this.spawnSparks(creep.x, creep.y, creep.color, (creep.type === 'boss' ? 40 : 18));
        this.addFloatingText(`+${creep.bounty}⚡`, creep.x, creep.y - 15, '#00ff66');
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

    // Apply Screen Shake
    ctx.save();
    if (this.screenShake > 0) {
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

    // 3. Turret Pads
    for (const pad of this.pads) {
      const isSelected = (this.selectedActiveTurret === pad.turret);
      ctx.fillStyle = pad.turret ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)';
      ctx.strokeStyle = isSelected ? '#ffaa00' : (pad.turret ? '#00f0ff' : 'rgba(0, 240, 255, 0.35)');
      ctx.lineWidth = isSelected ? 3 : 2;

      // Octagonal Pad
      this.drawPolygon(ctx, pad.x, pad.y, 22, 8);
      ctx.fill();
      ctx.stroke();

      if (!pad.turret) {
        // Plus icon for buildable pad
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pad.x - 7, pad.y); ctx.lineTo(pad.x + 7, pad.y);
        ctx.moveTo(pad.x, pad.y - 7); ctx.lineTo(pad.x + 7, pad.y + 7);
        ctx.stroke();
      }
    }

    // 4. Quantum Core (Target Base)
    const coreX = 740;
    const coreY = 260;
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
    for (const c of this.creeps) {
      this.drawCreep(ctx, c);
    }

    // 6. Turrets (Procedural Cybernetic Models with Distinct L1, L2, L3 Tiers)
    for (const t of this.turrets) {
      this.drawTurret(ctx, t);
    }

    // 7. Projectiles & Beams
    for (const p of this.projectiles) {
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
    for (const part of this.particles) {
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
    for (const ft of this.floatingTexts) {
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

    if (c.type === 'boss') {
      // Leviathan Dreadnought Boss Model
      ctx.fillStyle = isFrozen ? '#00e5ff' : '#1a0510';
      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = 3;

      // Heavy Hull
      ctx.beginPath();
      ctx.moveTo(26, 0);
      ctx.lineTo(8, -18);
      ctx.lineTo(-22, -22);
      ctx.lineTo(-14, -8);
      ctx.lineTo(-24, 0);
      ctx.lineTo(-14, 8);
      ctx.lineTo(-22, 22);
      ctx.lineTo(8, 18);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Dual Blazing Thrusters
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(-26, -14, 6, 6);
      ctx.fillRect(-26, 8, 6, 6);

      // Red Command Bridge Visor
      ctx.fillStyle = '#ff0055';
      ctx.fillRect(6, -4, 10, 8);

    } else if (c.type === 'trojan') {
      // Armored Trojan Mech Tank
      ctx.fillStyle = isFrozen ? '#00e5ff' : '#140c1c';
      ctx.strokeStyle = '#ff7700';
      ctx.lineWidth = 2.5;

      // Hexagonal Armored Hull
      this.drawPolygon(ctx, 0, 0, c.size, 6);
      ctx.fill();
      ctx.stroke();

      // Front Reinforced Ram Bumper
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(8, -6, 6, 12);

      // Hazard Stripes
      ctx.strokeStyle = '#ff5500';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-6, -8); ctx.lineTo(4, 8);
      ctx.stroke();

    } else if (c.type === 'specter') {
      // Shielded Specter Glitcher
      ctx.fillStyle = isFrozen ? '#00e5ff' : '#081422';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;

      // Dark Levitating Diamond Core
      this.drawPolygon(ctx, 0, 0, c.size, 4);
      ctx.fill();
      ctx.stroke();

      // Rotating Hexagonal Energy Shield
      if (c.shield > 0) {
        ctx.save();
        ctx.rotate(this.globalTick * 2);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.7)';
        ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.lineWidth = 1.5;
        this.drawPolygon(ctx, 0, 0, c.size + 7, 6);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

    } else if (c.type === 'swarm') {
      // Glitch Swarmer Insectoid Micro-Pod
      ctx.fillStyle = isFrozen ? '#00e5ff' : '#ffaa00';
      ctx.strokeStyle = '#ff5500';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-8, -8);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

    } else {
      // Cyber Stealth Drone (Delta Wing Fighter)
      ctx.fillStyle = isFrozen ? '#00e5ff' : '#0a1526';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-12, -12);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-12, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Blue Visor Lens
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(2, -2, 6, 4);
    }

    ctx.restore();

    // Dual-Layer Health & Shield Bar (Non-rotated)
    const barW = Math.max(22, c.size * 2);
    const barH = 4;
    const hpPct = Math.max(0, c.hp / c.maxHp);

    // HP Bar
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(c.x - barW / 2, c.y - c.size - 10, barW, barH);
    ctx.fillStyle = hpPct > 0.5 ? '#00ff66' : (hpPct > 0.25 ? '#ffaa00' : '#ff0055');
    ctx.fillRect(c.x - barW / 2, c.y - c.size - 10, barW * hpPct, barH);

    // Shield Bar (If unit has active shield)
    if (c.maxShield > 0 && c.shield > 0) {
      const shieldPct = Math.max(0, c.shield / c.maxShield);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(c.x - barW / 2, c.y - c.size - 16, barW, 3);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(c.x - barW / 2, c.y - c.size - 16, barW * shieldPct, 3);
    }
  }

  // --- Procedural Cybernetic Turret Rendering (L1, L2, L3) ---
  drawTurret(ctx, t) {
    const conf = this.getTurretConfig(t.type, t.level);

    // Range Indicator when Selected
    if (this.selectedActiveTurret === t) {
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
      ctx.fillStyle = 'rgba(0, 240, 255, 0.05)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(t.x, t.y, conf.range, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Octagonal Turret Base Plate
    ctx.fillStyle = '#0a1020';
    ctx.strokeStyle = conf.color;
    ctx.lineWidth = 2;
    this.drawPolygon(ctx, t.x, t.y, 17, 8);
    ctx.fill();
    ctx.stroke();

    // Rotating Barrel / Core Platform with Firing Recoil
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rotation);

    const recoil = t.recoil || 0;

    if (t.type === 'laser') {
      ctx.fillStyle = conf.color;
      if (t.level === 1) {
        // Single Collimator Emitter
        ctx.fillRect(-recoil, -3, 16, 6);
        ctx.fillStyle = '#fff';
        ctx.fillRect(14 - recoil, -2, 3, 4);
      } else if (t.level === 2) {
        // Dual Parallel Collimators
        ctx.fillRect(-recoil, -6, 17, 4);
        ctx.fillRect(-recoil, 2, 17, 4);
        ctx.fillStyle = '#fff';
        ctx.fillRect(15 - recoil, -5, 3, 2);
        ctx.fillRect(15 - recoil, 3, 3, 2);
      } else {
        // Tri-Beam Meltdown Matrix with Center Crystal
        ctx.fillRect(-recoil, -8, 18, 4);
        ctx.fillRect(-recoil, -2, 20, 4);
        ctx.fillRect(-recoil, 4, 18, 4);
        ctx.fillStyle = '#00ffff';
        this.drawPolygon(ctx, 0, 0, 6, 6);
        ctx.fill();
      }

    } else if (t.type === 'plasma') {
      ctx.fillStyle = conf.color;
      if (t.level === 1) {
        ctx.fillRect(-recoil, -6, 14, 12);
        ctx.beginPath(); ctx.arc(14 - recoil, 0, 5, 0, Math.PI * 2); ctx.fill();
      } else if (t.level === 2) {
        // Dual-Rail Heavy Accelerator
        ctx.fillRect(-recoil, -8, 16, 6);
        ctx.fillRect(-recoil, 2, 16, 6);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(16 - recoil, 0, 6, 0, Math.PI * 2); ctx.fill();
      } else {
        // Quad Orbital Cannon with Pulsing Singularity
        ctx.fillRect(-recoil, -9, 18, 5);
        ctx.fillRect(-recoil, 4, 18, 5);
        ctx.fillStyle = '#ff00aa';
        this.drawPolygon(ctx, 16 - recoil, 0, 8, 6);
        ctx.fill();
      }

    } else if (t.type === 'emp') {
      ctx.fillStyle = conf.color;
      this.drawPolygon(ctx, 0, 0, 9 + t.level * 2, 6);
      ctx.fill();

      // Orbiting Cryo Gyroscope Rings
      ctx.strokeStyle = '#00ffaa';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 13 + t.level * 2, 0, Math.PI * 2);
      ctx.stroke();

    } else if (t.type === 'railgun') {
      ctx.fillStyle = conf.color;
      if (t.level === 1) {
        ctx.fillRect(-4 - recoil, -2.5, 23, 5);
      } else if (t.level === 2) {
        // Extended Heavy Rails with Capacitor Coils
        ctx.fillRect(-6 - recoil, -3.5, 27, 7);
        ctx.fillStyle = '#ff5500';
        ctx.fillRect(2 - recoil, -4.5, 4, 9);
        ctx.fillRect(10 - recoil, -4.5, 4, 9);
      } else {
        // Relativistic Lance with Quad Coils & Laser Sight
        ctx.fillRect(-8 - recoil, -4, 32, 8);
        ctx.fillStyle = '#fff';
        ctx.fillRect(22 - recoil, -1.5, 6, 3);
      }
    }

    ctx.restore();

    // Turret Level Badge
    ctx.fillStyle = t.level === 3 ? '#ff00aa' : (t.level === 2 ? '#ffaa00' : '#00f0ff');
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`L${t.level}`, t.x, t.y + 4);
  }

  // --- Preparation Phase Cyber Banner ---
  drawPrepBanner(ctx) {
    const bannerW = 420;
    const bannerH = 44;
    const bannerX = 400 - bannerW / 2;
    const bannerY = 14;

    ctx.save();
    ctx.fillStyle = 'rgba(4, 8, 20, 0.88)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 8);
    ctx.fill();
    ctx.stroke();

    const remainingSecs = Math.max(0, Math.ceil(this.prepTimer));
    const earlyBonus = Math.max(10, Math.round(this.prepTimer * 2));

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`⏱️ PREP PHASE: ${remainingSecs}s • WAVE ${this.wave + 1} NEXT`, 400, bannerY + 18);

    ctx.fillStyle = '#00ff66';
    ctx.font = '10px monospace';
    ctx.fillText(`Tap 'Start Wave' to launch now for +${earlyBonus}⚡ Early Bonus!`, 400, bannerY + 34);
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

    const upText = (t.level >= 3) ? '⭐ MAX LEVEL' : `⬆️ UPGRADE L${t.level + 1} (${nextConf.cost}⚡)`;

    // Drop Shadow / Background Plate
    ctx.fillStyle = 'rgba(2, 6, 16, 0.92)';
    ctx.beginPath();
    ctx.roundRect(upX - 2, upY - 2, upW + 4, upH + 4, 8);
    ctx.fill();

    ctx.fillStyle = (t.level >= 3) ? 'rgba(0, 240, 255, 0.25)' : (canUpgrade ? 'rgba(0, 255, 102, 0.95)' : 'rgba(45, 50, 65, 0.85)');
    ctx.strokeStyle = (t.level >= 3) ? '#00f0ff' : (canUpgrade ? '#00ff66' : 'rgba(255, 255, 255, 0.2)');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(upX, upY, upW, upH, 6);
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
    ctx.roundRect(sellX - 2, sellY - 2, sellW + 4, sellH + 4, 7);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 0, 85, 0.9)';
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(sellX, sellY, sellW, sellH, 6);
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
        const earlyBonus = Math.max(10, Math.round(this.prepTimer * 2));
        elNext.innerText = `▶ Start Wave (+${earlyBonus}⚡)`;
        elNext.style.borderColor = 'var(--color-success)';
        elNext.style.color = 'var(--color-success)';
      } else if (this.waveActive) {
        elNext.innerText = `▶ In Progress`;
        elNext.style.borderColor = 'var(--text-muted)';
        elNext.style.color = 'var(--text-muted)';
      } else {
        elNext.innerText = `▶ Next Wave`;
      }
    }
  }

  // --- Speed Controls: 1x, 2x, 4x, 8x ---
  toggleSpeed() {
    const nextIdx = (this.speeds.indexOf(this.gameSpeed) + 1) % this.speeds.length;
    this.gameSpeed = this.speeds[nextIdx];
    this.updateHUD();
    if (sfx && typeof sfx.playCoin === 'function') sfx.playCoin();
  }

  // --- Auto-Wave Toggle ---
  toggleAutoWave() {
    this.autoWave = !this.autoWave;
    this.updateHUD();
    if (sfx && typeof sfx.playCoin === 'function') sfx.playCoin();
  }

  // --- Start Next Wave with Early Call Bonus ---
  triggerNextWave() {
    if (this.state !== 'PLAYING') return;

    if (this.isPrepPhase) {
      // Award Early Call Energy Bonus
      const earlyBonus = Math.max(10, Math.round(this.prepTimer * 2));
      this.energy += earlyBonus;
      this.addFloatingText(`⚡ EARLY CALL: +${earlyBonus}⚡`, 400, 200, '#00ff66');
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

    const cleanScore = Math.max(0, Math.floor(this.score + (victory ? 2000 : 0)));
    let isNewHigh = (cleanScore > (window.appState?.state?.defenseHighScore || 0));

    // Payout Calculation
    let isHarvestDisabled = false;
    let limitReached = false;
    const isPlayerConnected = window.appState && typeof window.appState.isPlayerConnected === 'function' && window.appState.isPlayerConnected();

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
    const rawBase = ((cleanScore / 2000.0) + (this.creepsKilled * 0.05)) * globalEarnMult;
    const calculatedPgt = parseFloat((rawBase * playerMult).toFixed(2));
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
            verifiedPgt = serverPayout > 0 ? serverPayout : calculatedPgt;
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
  if (defenseEngine) defenseEngine.selectTurretType(type);
}

// Attach to window
if (typeof window !== 'undefined') {
  window.initCyberDefense = initCyberDefense;
  window.startCyberDefense = startCyberDefense;
  window.toggleDefenseSpeed = toggleDefenseSpeed;
  window.toggleDefenseAutoWave = toggleDefenseAutoWave;
  window.triggerNextDefenseWave = triggerNextDefenseWave;
  window.selectDefenseTurretType = selectDefenseTurretType;
}
