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
    this.energy = 250;
    this.score = 0;
    this.creepsKilled = 0;
    this.wave = 1;
    this.maxWaves = 20;
    this.gameSpeed = 1; // 1x or 2x

    // Wave Spawning
    this.waveActive = false;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.spawnInterval = 0.9;
    this.autoWave = true;
    this.waveDelayTimer = 0;

    // Turret Selection & Pads
    this.selectedTurretType = 'laser'; // laser, plasma, emp, railgun
    this.selectedActiveTurret = null;  // For inspection/upgrade

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

  // --- Turret Specifications ---
  getTurretConfig(type, level = 1) {
    const configs = {
      laser: {
        name: 'Laser Turret',
        color: '#00f0ff',
        cost: level === 1 ? 100 : (level === 2 ? 150 : 250),
        range: level === 1 ? 120 : (level === 2 ? 145 : 175),
        damage: level === 1 ? 16 : (level === 2 ? 30 : 54),
        rate: 0.22,
        desc: 'Fast single-target beam'
      },
      plasma: {
        name: 'Plasma Mortar',
        color: '#ff00aa',
        cost: level === 1 ? 150 : (level === 2 ? 220 : 350),
        range: level === 1 ? 140 : (level === 2 ? 170 : 205),
        damage: level === 1 ? 55 : (level === 2 ? 100 : 170),
        splash: level === 1 ? 55 : (level === 2 ? 70 : 90),
        rate: 1.15,
        desc: 'Explosive AoE splash damage'
      },
      emp: {
        name: 'EMP Frost Pylon',
        color: '#00ffaa',
        cost: level === 1 ? 120 : (level === 2 ? 180 : 300),
        range: level === 1 ? 115 : (level === 2 ? 135 : 160),
        damage: level === 1 ? 8 : (level === 2 ? 16 : 28),
        slow: 0.5, // 50% slow
        slowDuration: 2.8,
        rate: 1.0,
        desc: 'Radial pulse slows creeps'
      },
      railgun: {
        name: 'Railgun Sniper',
        color: '#ffaa00',
        cost: level === 1 ? 200 : (level === 2 ? 300 : 450),
        range: level === 1 ? 220 : (level === 2 ? 260 : 310),
        damage: level === 1 ? 130 : (level === 2 ? 260 : 480),
        rate: 2.1,
        desc: 'Long range armor piercer'
      }
    };
    return configs[type] || configs.laser;
  }

  // --- Click & Selection Dispatch ---
  handleClick(x, y) {
    // 1. Check if clicked on an active turret inspection UI button (Upgrade or Sell)
    if (this.selectedActiveTurret) {
      const t = this.selectedActiveTurret;
      // Upgrade button hit area (above turret)
      const upBtnX = t.x - 45;
      const upBtnY = t.y - 48;
      if (x >= upBtnX && x <= upBtnX + 90 && y >= upBtnY && y <= upBtnY + 22) {
        this.upgradeTurret(t);
        return;
      }
      // Sell button hit area (below turret)
      const sellBtnX = t.x - 35;
      const sellBtnY = t.y + 26;
      if (x >= sellBtnX && x <= sellBtnX + 70 && y >= sellBtnY && y <= sellBtnY + 20) {
        this.sellTurret(t);
        return;
      }
    }

    // 2. Check if clicked on a Turret Pad
    for (const pad of this.pads) {
      const dist = Math.hypot(x - pad.x, y - pad.y);
      if (dist <= 26) {
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
      rotation: 0
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
      this.addFloatingText('Max Level!', turret.x, turret.y - 20, '#00f0ff');
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
    this.spawnSparks(turret.x, turret.y, '#00ff66', 20);
    this.addFloatingText(`LVL ${turret.level}! (-${nextConf.cost}⚡)`, turret.x, turret.y - 25, '#00ff66');
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

    this.spawnSparks(turret.x, turret.y, '#ffaa00', 12);
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
    this.energy = 250;
    this.score = 0;
    this.creepsKilled = 0;
    this.wave = 1;
    this.gameSpeed = 1;
    this.waveActive = false;
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
    this.queueWave(this.wave);

    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.loop(this.lastTime);
  }

  // --- Wave Generation ---
  queueWave(waveNum) {
    this.wave = waveNum;
    this.waveActive = true;
    this.spawnQueue = [];
    this.spawnTimer = 0;

    const isBossWave = (waveNum % 5 === 0);
    const count = 8 + waveNum * 2;
    const hpMult = 1 + (waveNum - 1) * 0.28;

    for (let i = 0; i < count; i++) {
      let type = 'drone';
      if (waveNum >= 3 && i % 3 === 0) type = 'trojan';
      if (waveNum >= 4 && i % 4 === 0) type = 'swarm';

      this.spawnQueue.push({
        type: type,
        hp: Math.round((type === 'trojan' ? 140 : (type === 'swarm' ? 45 : 70)) * hpMult),
        speed: (type === 'swarm' ? 2.1 : (type === 'trojan' ? 0.95 : 1.45))
      });
    }

    // Boss Wave every 5th wave
    if (isBossWave) {
      this.spawnQueue.push({
        type: 'boss',
        hp: Math.round(950 * hpMult),
        speed: 0.65
      });
      this.addFloatingText(`⚠️ BOSS DETECTED: WAVE ${waveNum}!`, 400, 180, '#ff0055');
    } else {
      this.addFloatingText(`⚡ WAVE ${waveNum} INCOMING!`, 400, 180, '#00f0ff');
    }

    if (sfx && typeof sfx.playLaser === 'function') sfx.playLaser();
    this.updateHUD();
  }

  // --- Spawn Single Creep ---
  spawnCreep(spec) {
    const creep = {
      id: Date.now() + Math.random(),
      type: spec.type,
      hp: spec.hp,
      maxHp: spec.hp,
      baseSpeed: spec.speed,
      speed: spec.speed,
      slowTimer: 0,
      x: this.waypoints[0].x,
      y: this.waypoints[0].y,
      waypointIndex: 1,
      size: spec.type === 'boss' ? 26 : (spec.type === 'trojan' ? 18 : 13),
      color: spec.type === 'boss' ? '#ff0055' : (spec.type === 'trojan' ? '#ff00ff' : (spec.type === 'swarm' ? '#ffaa00' : '#00f0ff')),
      bounty: spec.type === 'boss' ? 180 : (spec.type === 'trojan' ? 24 : 14)
    };
    this.creeps.push(creep);
  }

  // --- Main Game Loop ---
  loop(timestamp) {
    if (this.state !== 'PLAYING') return;

    const rawDt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;
    const dt = rawDt * this.gameSpeed;

    this.update(dt);
    this.draw();

    this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  // --- Game State Update ---
  update(dt) {
    // 1. Spawning
    if (this.waveActive && this.spawnQueue.length > 0) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.spawnInterval) {
        this.spawnTimer = 0;
        this.spawnCreep(this.spawnQueue.shift());
      }
    } else if (this.waveActive && this.spawnQueue.length === 0 && this.creeps.length === 0) {
      // Wave Cleared!
      this.waveActive = false;
      this.score += this.wave * 120;
      const waveBonus = 50 + this.wave * 15;
      this.energy += waveBonus;
      this.addFloatingText(`+${waveBonus}⚡ Wave Bonus!`, 400, 200, '#00ff66');
      if (sfx && typeof sfx.playSuccess === 'function') sfx.playSuccess();

      if (this.wave >= this.maxWaves) {
        this.endSession(true); // Victory!
        return;
      }

      this.waveDelayTimer = 3.5;
    }

    // Auto Next Wave Countdown
    if (!this.waveActive && this.waveDelayTimer > 0) {
      this.waveDelayTimer -= dt;
      if (this.waveDelayTimer <= 0) {
        this.queueWave(this.wave + 1);
      }
    }

    // 2. Creeps Movement along Circuit Waypoints
    for (let i = this.creeps.length - 1; i >= 0; i--) {
      const c = this.creeps[i];

      // Handle Slow Debuff
      if (c.slowTimer > 0) {
        c.slowTimer -= dt;
        c.speed = c.baseSpeed * 0.5;
      } else {
        c.speed = c.baseSpeed;
      }

      const targetWP = this.waypoints[c.waypointIndex];
      if (targetWP) {
        const dx = targetWP.x - c.x;
        const dy = targetWP.y - c.y;
        const dist = Math.hypot(dx, dy);
        const step = c.speed * 85 * dt;

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
          this.endSession(false); // Core Destroyed
          return;
        }
      }
    }

    // 3. Turrets Targeting & Firing
    for (const t of this.turrets) {
      const conf = this.getTurretConfig(t.type, t.level);
      if (t.cooldown > 0) t.cooldown -= dt;

      // Find best target (furthest along path in range)
      let bestCreep = null;
      let maxWP = -1;

      for (const c of this.creeps) {
        const dist = Math.hypot(c.x - t.x, c.y - t.y);
        if (dist <= conf.range) {
          if (c.waypointIndex > maxWP) {
            maxWP = c.waypointIndex;
            bestCreep = c;
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

    // 4. Projectiles Update
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;

      if (p.type === 'plasma') {
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.hypot(dx, dy);
        const speed = 400 * dt;

        if (dist <= speed || p.life <= 0) {
          // Explode!
          this.screenShake = 4;
          this.spawnSparks(p.x, p.y, '#ff00aa', 25);
          for (const c of this.creeps) {
            const hitDist = Math.hypot(c.x - p.x, c.y - p.y);
            if (hitDist <= p.splash) {
              this.damageCreep(c, p.damage);
            }
          }
          this.projectiles.splice(i, 1);
        } else {
          p.x += (dx / dist) * speed;
          p.y += (dy / dist) * speed;
        }
      } else if (p.type === 'beam') {
        // Laser / Railgun instant visual decay
        if (p.life <= 0) this.projectiles.splice(i, 1);
      }
    }

    // 5. Particles & Screen Shake
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
    if (t.type === 'laser') {
      // Instant beam + hit
      this.projectiles.push({
        type: 'beam',
        x1: t.x, y1: t.y,
        x2: target.x, y2: target.y,
        color: conf.color,
        width: t.level * 2,
        life: 0.12
      });
      this.damageCreep(target, conf.damage);
      this.spawnSparks(target.x, target.y, conf.color, 4);
      if (sfx && typeof sfx.playLaser === 'function') sfx.playLaser();

    } else if (t.type === 'plasma') {
      // Arcing plasma ball
      this.projectiles.push({
        type: 'plasma',
        x: t.x, y: t.y,
        targetX: target.x, targetY: target.y,
        damage: conf.damage,
        splash: conf.splash,
        color: conf.color,
        life: 1.5
      });
      if (sfx && typeof sfx.playLaser === 'function') sfx.playLaser();

    } else if (t.type === 'emp') {
      // Radial shockwave
      this.screenShake = 3;
      this.spawnRing(t.x, t.y, conf.range, conf.color);
      for (const c of this.creeps) {
        const dist = Math.hypot(c.x - t.x, c.y - t.y);
        if (dist <= conf.range) {
          c.slowTimer = conf.slowDuration;
          this.damageCreep(c, conf.damage);
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
        width: 4 + t.level,
        life: 0.2
      });
      this.damageCreep(target, conf.damage);
      this.spawnSparks(target.x, target.y, '#ffffff', 12);
      if (sfx && typeof sfx.playLaser === 'function') sfx.playLaser();
    }
  }

  // --- Damage & Death ---
  damageCreep(creep, amount) {
    creep.hp -= amount;
    if (creep.hp <= 0) {
      const idx = this.creeps.indexOf(creep);
      if (idx !== -1) {
        this.creeps.splice(idx, 1);
        this.creepsKilled++;
        this.energy += creep.bounty;
        this.score += creep.bounty * 10;
        this.spawnSparks(creep.x, creep.y, creep.color, 18);
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

    // 5. Creeps
    for (const c of this.creeps) {
      ctx.fillStyle = c.color;
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 10;

      if (c.type === 'boss') {
        this.drawPolygon(ctx, c.x, c.y, c.size, 8);
        ctx.fill();
      } else if (c.type === 'trojan') {
        this.drawPolygon(ctx, c.x, c.y, c.size, 6);
        ctx.fill();
      } else if (c.type === 'swarm') {
        this.drawPolygon(ctx, c.x, c.y, c.size, 3);
        ctx.fill();
      } else {
        this.drawPolygon(ctx, c.x, c.y, c.size, 4);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Health Bar
      const barW = c.size * 2;
      const barH = 4;
      const hpPct = Math.max(0, c.hp / c.maxHp);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(c.x - barW / 2, c.y - c.size - 8, barW, barH);
      ctx.fillStyle = hpPct > 0.5 ? '#00ff66' : (hpPct > 0.25 ? '#ffaa00' : '#ff0055');
      ctx.fillRect(c.x - barW / 2, c.y - c.size - 8, barW * hpPct, barH);
    }

    // 6. Turrets & Attack Range
    for (const t of this.turrets) {
      const conf = this.getTurretConfig(t.type, t.level);

      // Selected Turret Range Circle
      if (this.selectedActiveTurret === t) {
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
        ctx.fillStyle = 'rgba(0, 240, 255, 0.05)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(t.x, t.y, conf.range, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Turret Base
      ctx.fillStyle = '#0a1020';
      ctx.strokeStyle = conf.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Rotating Barrel / Core
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rotation);

      ctx.fillStyle = conf.color;
      if (t.type === 'laser') {
        ctx.fillRect(0, -3, 16, 6);
      } else if (t.type === 'plasma') {
        ctx.fillRect(0, -6, 14, 12);
        ctx.beginPath(); ctx.arc(14, 0, 4, 0, Math.PI * 2); ctx.fill();
      } else if (t.type === 'emp') {
        this.drawPolygon(ctx, 0, 0, 10, 6);
        ctx.fill();
      } else if (t.type === 'railgun') {
        ctx.fillRect(-4, -2, 22, 4);
      }
      ctx.restore();

      // Turret Level Badge
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`L${t.level}`, t.x, t.y + 4);
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
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    // 8. Particles
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
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.shadowBlur = 0;
    }

    // 10. Active Turret Inspector Overlay (Upgrade & Sell Buttons)
    if (this.selectedActiveTurret) {
      this.drawInspectorOverlay(ctx, this.selectedActiveTurret);
    }

    ctx.restore();
  }

  // --- Draw Floating Upgrade / Sell Buttons above Turret ---
  drawInspectorOverlay(ctx, t) {
    const nextConf = this.getTurretConfig(t.type, t.level + 1);
    const canUpgrade = (t.level < 3 && this.energy >= nextConf.cost);

    // 1. Upgrade Button Pill (Above)
    const upText = (t.level >= 3) ? '⭐ MAX' : `⬆️ LVL ${t.level + 1} (${nextConf.cost}⚡)`;
    ctx.fillStyle = canUpgrade ? 'rgba(0, 255, 102, 0.9)' : 'rgba(40, 40, 50, 0.85)';
    ctx.strokeStyle = canUpgrade ? '#00ff66' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(t.x - 45, t.y - 48, 90, 22, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = canUpgrade ? '#000' : '#888';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(upText, t.x, t.y - 33);

    // 2. Sell Button Pill (Below)
    let totalInvested = 0;
    for (let l = 1; l <= t.level; l++) {
      totalInvested += this.getTurretConfig(t.type, l).cost;
    }
    const refund = Math.round(totalInvested * 0.70);

    ctx.fillStyle = 'rgba(255, 0, 85, 0.85)';
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(t.x - 35, t.y + 26, 70, 20, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`💰 SELL (+${refund}⚡)`, t.x, t.y + 40);
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

    if (elHp) elHp.innerText = `${this.coreHp} / ${this.maxCoreHp}`;
    if (elEnergy) elEnergy.innerText = `⚡ ${this.energy}`;
    if (elWave) elWave.innerText = `${this.wave} / ${this.maxWaves}`;
    if (elScore) elScore.innerText = this.score.toLocaleString();
    if (elSpeed) elSpeed.innerText = `⏩ ${this.gameSpeed}x`;
  }

  toggleSpeed() {
    this.gameSpeed = (this.gameSpeed === 1) ? 2 : 1;
    this.updateHUD();
    if (sfx && typeof sfx.playCoin === 'function') sfx.playCoin();
  }

  triggerNextWave() {
    if (this.state !== 'PLAYING') return;
    if (!this.waveActive) {
      this.queueWave(this.wave + 1);
    } else {
      this.addFloatingText('Wave in progress!', 400, 200, '#ffaa00');
    }
  }

  selectTurretType(type) {
    this.selectedTurretType = type;
    document.querySelectorAll('.turret-select-btn').forEach(btn => {
      if (btn.getAttribute('data-turret-type') === type) {
        btn.style.background = 'rgba(0, 240, 255, 0.4)';
        btn.style.borderColor = 'var(--color-primary)';
      } else {
        btn.style.background = 'rgba(255, 255, 255, 0.05)';
        btn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      }
    });
    if (sfx && typeof sfx.playCoin === 'function') sfx.playCoin();
  }

  // --- End Session & PGT Payout Handshake ---
  async endSession(victory = false) {
    this.state = victory ? 'VICTORY' : 'GAMEOVER';
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

    const cleanScore = Math.max(0, Math.floor(this.score + (victory ? 2000 : 0)));
    const isNewHigh = (cleanScore > (window.appState?.state?.defenseHighScore || 0));

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
  }

  stop() {
    this.state = 'IDLE';
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
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
  window.triggerNextDefenseWave = triggerNextDefenseWave;
  window.selectDefenseTurretType = selectDefenseTurretType;
}
