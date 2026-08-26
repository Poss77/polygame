// ==============================================================================
// POLYGAME: CYBER SKEET ARCADE ENGINE
// Infinite Survival Shooting Gallery with 3 Hearts, Gyroscope & Keyboard Aiming,
// 1x-10x Combo Multipliers, Retro Toy Laser SFX, and 3 Shifting Backgrounds.
// ==============================================================================

import { appState } from './src/js/core/state.js';
import { sfx } from './src/js/core/audio.js';
import { triggerConfetti } from './src/js/utils/confetti.js';

export class CyberSkeetEngine {
  constructor() {
    this.canvas = document.getElementById('skeet-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    
    // Core State
    this.state = 'IDLE'; // IDLE, PLAYING, GAMEOVER
    this.sessionId = null;
    this.isStarting = false;
    this.animationFrameId = null;
    this.lastTime = 0;
    
    // Survival & Progression
    this.lives = 3;
    this.maxLives = 3;
    this.score = 0;
    this.claysHit = 0;
    this.shotsFired = 0;
    this.consecutiveHits = 0;
    this.comboMultiplier = 1;
    this.highestCombo = 1;
    this.bonusTokens = 0;
    this.survivalTime = 0; // seconds elapsed
    this.stage = 1; // 1: Sunset, 2: Neo-Tokyo, 3: Cosmic Storm
    
    // Power-Up Timers
    this.slowmoTimer = 0;   // 10s Slow-Mo
    this.scatterTimer = 0;  // 10s Triple Scatter Shot
    
    // Aiming & Crosshair
    this.crosshairX = 400;
    this.crosshairY = 250;
    this.targetCrosshairX = 400;
    this.targetCrosshairY = 250;
    this.crosshairRadius = 18;
    this.crosshairColor = '#00f0ff';
    
    // Keyboard Controls
    this.keys = {
      ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
      KeyW: false, KeyS: false, KeyA: false, KeyD: false,
      Space: false, Enter: false
    };
    
    // Gyroscope / Device Orientation
    this.gyroEnabled = false;
    this.centerGamma = 0; // Left-Right baseline
    this.centerBeta = 45; // Forward-Back baseline
    this.currentGamma = 0;
    this.currentBeta = 45;
    this.gyroSensitivity = 16.0;
    this.hasRequestedGyro = false;
    
    // Game Entities
    this.clays = [];
    this.particles = [];
    this.floatingTexts = [];
    this.muzzleFlashes = [];
    
    // Spawning Mechanics
    this.spawnTimer = 0;
    this.spawnInterval = 2.0; // seconds between spawns
    
    // Screen Effects
    this.screenShake = 0;
    this.damageFlash = 0;

    // Mobile Touch & Swipe Tracking
    this.activeTouches = new Map();
    this.touchSwipeSensitivity = 1.35;
    
    this.initEvents();
  }

  // --- Input & Sensor Event Listeners ---
  initEvents() {
    if (!this.canvas) return;

    // Window Resize / Resolution Adaptation
    window.addEventListener('resize', () => this.resizeCanvas());
    this.resizeCanvas();

    // 1. Mouse Aim & Click
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.state !== 'PLAYING') return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      this.targetCrosshairX = (e.clientX - rect.left) * scaleX;
      this.targetCrosshairY = (e.clientY - rect.top) * scaleY;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.state === 'PLAYING') {
        this.fireShot();
      }
    });

    // 2. Global Touch & Swipe Controls (Works anywhere on screen & outside canvas window)
    window.addEventListener('touchstart', (e) => {
      if (this.state !== 'PLAYING') return;

      // Ignore touches on interactive UI buttons or modal dialogs
      if (e.target && (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('.modal-content') || e.target.closest('#skeet-overlay-gameover'))) {
        return;
      }

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        this.activeTouches.set(touch.identifier, {
          startX: touch.clientX,
          startY: touch.clientY,
          lastX: touch.clientX,
          lastY: touch.clientY,
          startTime: Date.now(),
          totalDist: 0
        });
      }

      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (this.state !== 'PLAYING') return;

      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / (rect.width || 800);
      const scaleY = this.canvas.height / (rect.height || 450);

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const tData = this.activeTouches.get(touch.identifier);
        if (tData) {
          const dx = touch.clientX - tData.lastX;
          const dy = touch.clientY - tData.lastY;
          tData.totalDist += Math.hypot(dx, dy);
          tData.lastX = touch.clientX;
          tData.lastY = touch.clientY;

          if (!this.gyroEnabled) {
            // Smooth relative swipe steering: moves the target crosshair without teleporting
            this.targetCrosshairX = Math.max(15, Math.min(this.canvas.width - 15, this.targetCrosshairX + dx * scaleX * this.touchSwipeSensitivity));
            this.targetCrosshairY = Math.max(15, Math.min(this.canvas.height - 15, this.targetCrosshairY + dy * scaleY * this.touchSwipeSensitivity));
            this.crosshairX = this.targetCrosshairX;
            this.crosshairY = this.targetCrosshairY;
          }
        }
      }

      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      if (this.state !== 'PLAYING') return;

      // Ignore touches on interactive UI buttons
      if (e.target && (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('.modal-content') || e.target.closest('#skeet-overlay-gameover'))) {
        return;
      }

      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const tData = this.activeTouches.get(touch.identifier);
        if (tData) {
          this.activeTouches.delete(touch.identifier);
          // Release to Shoot: Fires blaster directly at the current target crosshair upon finger lift-off!
          this.fireShot();
        }
      }
    });

    window.addEventListener('touchcancel', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        this.activeTouches.delete(e.changedTouches[i].identifier);
      }
    });

    // 3. Keyboard Aim & Fire
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'Enter'].includes(e.code)) {
        if (this.state === 'PLAYING') e.preventDefault();
        this.keys[e.code] = true;
        if ((e.code === 'Space' || e.code === 'Enter') && this.state === 'PLAYING' && !e.repeat) {
          this.fireShot();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.keys.hasOwnProperty(e.code)) {
        this.keys[e.code] = false;
      }
    });

    // 4. Device Orientation / Gyroscope
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => this.handleDeviceOrientation(e));
    }
  }

  resizeCanvas() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (parent) {
      const width = Math.min(960, parent.clientWidth || 800);
      const height = Math.min(540, Math.round(width * 0.58));
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
        if (this.crosshairX > width) this.crosshairX = width / 2;
        if (this.crosshairY > height) this.crosshairY = height / 2;
      }
    }
  }

  // --- Gyroscope Motion Aiming ---
  handleDeviceOrientation(e) {
    if (!this.gyroEnabled || e.gamma === null || e.beta === null) return;
    this.currentGamma = e.gamma;
    this.currentBeta = e.beta;

    const deltaX = (this.currentGamma - this.centerGamma) * this.gyroSensitivity;
    const deltaY = (this.currentBeta - this.centerBeta) * this.gyroSensitivity;

    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    this.targetCrosshairX = Math.max(20, Math.min(this.canvas.width - 20, centerX + deltaX));
    this.targetCrosshairY = Math.max(20, Math.min(this.canvas.height - 20, centerY + deltaY));
  }

  recenterGyro() {
    this.centerGamma = this.currentGamma;
    this.centerBeta = this.currentBeta;
    this.targetCrosshairX = this.canvas.width / 2;
    this.targetCrosshairY = this.canvas.height / 2;
    this.crosshairX = this.targetCrosshairX;
    this.crosshairY = this.targetCrosshairY;
    if (window.triggerToast) window.triggerToast('🎯 Gyroscope Recentered!', 'info');
  }

  async requestGyroPermission() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const response = await DeviceOrientationEvent.requestPermission();
        if (response === 'granted') {
          this.gyroEnabled = true;
          this.recenterGyro();
          this.updateGyroButtonUI();
          return true;
        }
      } catch (err) {
        console.warn('[CyberSkeet] Gyro permission error:', err);
      }
    } else if (window.DeviceOrientationEvent) {
      this.gyroEnabled = true;
      this.recenterGyro();
      this.updateGyroButtonUI();
      return true;
    }
    return false;
  }

  toggleGyro() {
    if (!this.gyroEnabled) {
      this.requestGyroPermission().then(granted => {
        if (!granted && window.triggerToast) {
          window.triggerToast('Motion sensors unavailable on this device', 'warning');
        }
      });
    } else {
      this.gyroEnabled = false;
      this.updateGyroButtonUI();
      if (window.triggerToast) window.triggerToast('Gyroscope aim disabled', 'info');
    }
  }

  updateGyroButtonUI() {
    const btn = document.getElementById('skeet-btn-gyro');
    if (btn) {
      if (this.gyroEnabled) {
        btn.innerHTML = '🎯 Motion Aim: ON';
        btn.style.background = 'var(--color-accent)';
        btn.style.color = '#000';
      } else {
        btn.innerHTML = '📱 Motion Aim: OFF';
        btn.style.background = 'rgba(0, 240, 255, 0.15)';
        btn.style.color = 'var(--color-accent)';
      }
    }
  }

  // --- Start & Session Lifecycle ---
  async startGame() {
    if (this.isStarting) return;
    this.isStarting = true;

    // Reset Game State
    this.lives = 3;
    this.score = 0;
    this.claysHit = 0;
    this.shotsFired = 0;
    this.consecutiveHits = 0;
    this.comboMultiplier = 1;
    this.highestCombo = 1;
    this.bonusTokens = 0;
    this.survivalTime = 0;
    this.stage = 1;
    this.slowmoTimer = 0;
    this.scatterTimer = 0;
    this.clays = [];
    this.particles = [];
    this.floatingTexts = [];
    this.muzzleFlashes = [];
    this.spawnTimer = 0.5;
    this.spawnInterval = 2.0;
    this.screenShake = 0;
    this.damageFlash = 0;

    this.crosshairX = this.canvas.width / 2;
    this.crosshairY = this.canvas.height / 2;
    this.targetCrosshairX = this.crosshairX;
    this.targetCrosshairY = this.crosshairY;

    // Prevent mobile browser gesture scrolling while playing
    try {
      document.body.style.touchAction = 'none';
      document.body.style.userSelect = 'none';
      if (document.documentElement) document.documentElement.style.touchAction = 'none';
    } catch (e) {}

    // UI Updates
    const startOverlay = document.getElementById('skeet-overlay-start');
    const gameOverOverlay = document.getElementById('skeet-overlay-gameover');
    const hudEl = document.getElementById('skeet-hud');
    const touchpadEl = document.getElementById('skeet-touchpad');
    if (startOverlay) startOverlay.style.display = 'none';
    if (gameOverOverlay) gameOverOverlay.style.display = 'none';
    if (hudEl) hudEl.style.display = 'flex';
    if (touchpadEl) touchpadEl.style.display = 'flex';

    this.updateHUD();

    // Authenticated Anti-Cheat Session
    this.sessionId = null;
    if (window.startArcadeSession) {
      try {
        this.sessionId = await window.startArcadeSession('Cyber Skeet');
      } catch (err) {
        console.warn('[CyberSkeet] startArcadeSession error:', err);
      }
    }

    this.state = 'PLAYING';
    this.isStarting = false;
    this.isStarting = false;
    this.lastTime = performance.now();

    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
  }

  // --- Game Loop ---
  gameLoop(timestamp) {
    if (this.state !== 'PLAYING') return;

    const dt = Math.min(0.1, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    this.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
  }

  // --- Update Simulation ---
  update(dt) {
    this.survivalTime += dt;

    // Stage Background Progression
    if (this.survivalTime < 60) {
      this.stage = 1; // Sunset Neon Range
    } else if (this.survivalTime < 120) {
      this.stage = 2; // Midnight Neo-Tokyo
    } else {
      this.stage = 3; // Cosmic Quantum Storm
    }

    // Power-Up Buff Timers
    if (this.slowmoTimer > 0) this.slowmoTimer = Math.max(0, this.slowmoTimer - dt);
    if (this.scatterTimer > 0) this.scatterTimer = Math.max(0, this.scatterTimer - dt);

    // Dynamic Speed & Spawn Interval Ramp
    // Time dilation factor when Slow-Mo is active
    const timeScale = (this.slowmoTimer > 0) ? 0.5 : 1.0;
    const effectiveDt = dt * timeScale;

    // Acceleration multiplier scaling indefinitely with survival time
    const speedMult = (1.0 + (this.survivalTime / 60.0) * 0.45) * timeScale;
    this.spawnInterval = Math.max(0.65, 2.2 - (this.survivalTime * 0.015));

    // Keyboard Aim Movement
    const kbSpeed = 480 * dt;
    if (this.keys.ArrowUp || this.keys.KeyW) this.targetCrosshairY -= kbSpeed;
    if (this.keys.ArrowDown || this.keys.KeyS) this.targetCrosshairY += kbSpeed;
    if (this.keys.ArrowLeft || this.keys.KeyA) this.targetCrosshairX -= kbSpeed;
    if (this.keys.ArrowRight || this.keys.KeyD) this.targetCrosshairX += kbSpeed;

    this.targetCrosshairX = Math.max(15, Math.min(this.canvas.width - 15, this.targetCrosshairX));
    this.targetCrosshairY = Math.max(15, Math.min(this.canvas.height - 15, this.targetCrosshairY));

    // Smooth Crosshair Interpolation
    this.crosshairX += (this.targetCrosshairX - this.crosshairX) * Math.min(1.0, 18.0 * dt);
    this.crosshairY += (this.targetCrosshairY - this.crosshairY) * Math.min(1.0, 18.0 * dt);

    // Spawning Clays
    this.spawnTimer -= effectiveDt;
    if (this.spawnTimer <= 0) {
      this.spawnClayBatch();
      this.spawnTimer = this.spawnInterval;
    }

    // Update Clays with 2x Faster High-Velocity Skeet Trajectories
    const w = this.canvas.width;
    const h = this.canvas.height;
    const gravity = 380; // px / sec^2 scaled for 2x faster ballistic arcs

    for (let i = this.clays.length - 1; i >= 0; i--) {
      const c = this.clays[i];
      c.vy += gravity * effectiveDt;
      c.x += c.vx * speedMult * effectiveDt;
      c.y += c.vy * speedMult * effectiveDt;
      c.rotation += c.rotSpeed * effectiveDt;
      c.age += dt;

      // Check if Clay Escaped (crossed fully to opposite side or fell below lower threshold)
      const hasEscaped = (c.y > h + 35 && c.vy > 0) || 
                         (c.vx > 0 && c.x > w + 35) || 
                         (c.vx < 0 && c.x < -35);
      if (hasEscaped) {
        this.clays.splice(i, 1);
        // If an ordinary target clay escapes unhit -> Lose 1 Heart
        if (c.isTarget && !c.isHazard) {
          this.loseHeart('Target Escaped!');
        }
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt; // gravity
      p.rotation += p.rotSpeed * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // Update Floating Text Indicators
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }

    // Update Muzzle Flashes
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      this.muzzleFlashes[i].life -= dt;
      if (this.muzzleFlashes[i].life <= 0) this.muzzleFlashes.splice(i, 1);
    }

    // Update Screen Shake & Damage Flash
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - 25 * dt);
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - 3 * dt);

    this.updateHUD();
  }

  // --- Spawning Target Clays (2x Initial Speed, Wide Crossing Trajectories) ---
  spawnClayBatch() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    sfx.playSkeetTrapLaunch();

    // Determine Spawn Pattern (Single, Double Cross, or Triple depending on survival time)
    let count = 1;
    if (this.survivalTime > 25 && Math.random() < 0.45) count = 2;
    if (this.survivalTime > 60 && Math.random() < 0.35) count = 3;

    // Primary direction toggle
    const primaryFromLeft = Math.random() > 0.5;

    for (let i = 0; i < count; i++) {
      // Alternate left / right origins for crossing doubles
      const fromLeft = (i === 0) ? primaryFromLeft : (i === 1 ? !primaryFromLeft : (Math.random() > 0.5));
      
      // Start near lower edges
      const startX = fromLeft ? -25 : (w + 25);
      const startY = h * (0.58 + Math.random() * 0.18); // Around Y = 260 - 340
      
      // Target exits on the opposite side across the entire screen
      const endX = fromLeft ? (w + 35) : -35;
      
      // Flight Duration: 1.55 - 1.95s base (2x faster initial speed)
      const flightDuration = 1.55 + Math.random() * 0.40;
      const vx = (endX - startX) / flightDuration;
      
      // Peak apex height: gentle sweeping arc reaching upper third (Y = 90 - 150px)
      const apexY = h * (0.20 + Math.random() * 0.12) + (i * 16);
      const deltaY = Math.max(110, startY - apexY);
      
      // Initial upward vy based on gravity formula: |vy| = sqrt(2 * g * deltaY)
      const gravityVal = 380;
      const vy = - Math.sqrt(2 * gravityVal * deltaY);

      // Clay Type Probability Matrix
      const roll = Math.random();
      let type = 'STANDARD';
      let radius = 28;
      let color = '#00f0ff';
      let points = 100;
      let isHazard = false;
      let isTarget = true;

      if (roll < 0.08) {
        // ❤️ Nano-Med Drone (Restores 1 Heart)
        type = 'HEALTH';
        radius = 24;
        color = '#00ff66';
        points = 150;
      } else if (roll < 0.18) {
        // ⏱️ Chrono Freeze Drone (Slow-Mo 10s)
        type = 'SLOWMO';
        radius = 23;
        color = '#38bdf8';
        points = 200;
      } else if (roll < 0.28) {
        // 💥 Mega Scatter Blaster Core (10s Triple Blast)
        type = 'SCATTER';
        radius = 23;
        color = '#ffaa00';
        points = 200;
      } else if (roll < 0.40) {
        // 🟪 Quantum EMP Clay (Explodes nearby clays)
        type = 'EMP';
        radius = 25;
        color = '#c084fc';
        points = 500;
      } else if (roll < 0.55) {
        // 🟨 Hyper Golden Clay
        type = 'GOLDEN';
        radius = 20;
        color = '#ffd700';
        points = 250;
      } else if (roll < 0.70 && this.survivalTime > 25) {
        // 🟥 Glitch Hazard Drone (Avoid!)
        type = 'HAZARD';
        radius = 24;
        color = '#ff0055';
        points = -150;
        isHazard = true;
      }

      this.clays.push({
        type,
        x: startX,
        y: startY,
        vx,
        vy,
        radius,
        color,
        points,
        isHazard,
        isTarget,
        rotation: 0,
        rotSpeed: (Math.random() - 0.5) * 8.0,
        age: 0
      });
    }
  }

  // --- Firing Blaster ---
  fireShot() {
    if (this.state !== 'PLAYING') return;

    this.shotsFired++;
    sfx.playToyBlasterShot();

    // Muzzle Flash Effect
    this.muzzleFlashes.push({
      x: this.crosshairX,
      y: this.crosshairY,
      radius: this.scatterTimer > 0 ? 32 : 22,
      color: this.scatterTimer > 0 ? '#ffaa00' : '#00f0ff',
      life: 0.08
    });

    let hitAny = false;
    const shotRadius = (this.scatterTimer > 0) ? 48 : 24;

    // Check Shot Hits against Clays
    for (let i = this.clays.length - 1; i >= 0; i--) {
      const c = this.clays[i];
      const dist = Math.hypot(c.x - this.crosshairX, c.y - this.crosshairY);

      if (dist <= c.radius + shotRadius) {
        hitAny = true;
        this.handleClayHit(c, i);
        if (this.scatterTimer <= 0) {
          // Normal shot hits 1 target, scatter can pierce all in radius
          break;
        }
      }
    }

    if (!hitAny) {
      // Missed shot: Reset combo streak
      if (this.consecutiveHits > 0) {
        this.consecutiveHits = 0;
        this.comboMultiplier = 1;
        this.addFloatingText('STREAK LOST!', this.crosshairX, this.crosshairY - 15, '#ff4444');
      }
    }
  }

  // --- Clay Hit Resolution ---
  handleClayHit(clay, index) {
    this.clays.splice(index, 1);
    this.claysHit++;

    // 1. Hazard Drone Hit -> Lose Heart & Penalize
    if (clay.isHazard) {
      this.loseHeart('HAZARD HIT! 💥');
      this.score = Math.max(0, this.score + clay.points);
      this.addFloatingText(`${clay.points} PTS`, clay.x, clay.y - 20, '#ff0055');
      this.createClayDebris(clay, '#ff0055');
      return;
    }

    // 2. Advance Combo Streak (+1x per 3 consecutive hits, up to 10x)
    this.consecutiveHits++;
    const oldMult = this.comboMultiplier;
    this.comboMultiplier = Math.min(10, 1 + Math.floor(this.consecutiveHits / 3));
    if (this.comboMultiplier > this.highestCombo) this.highestCombo = this.comboMultiplier;

    if (this.comboMultiplier > oldMult) {
      sfx.playComboChime(this.comboMultiplier);
      this.addFloatingText(`COMBO ${this.comboMultiplier}x! 🔥`, clay.x, clay.y - 45, '#ffd700', 1.3);
    }

    // 3. Award Points with Multiplier
    const earnedPoints = clay.points * this.comboMultiplier;
    this.score += earnedPoints;
    sfx.playClayShatter(clay.type !== 'STANDARD');

    // 4. Power-Up & Special Clay Effects
    if (clay.type === 'HEALTH') {
      if (this.lives < this.maxLives) {
        this.lives++;
        sfx.playHeartGain();
        this.addFloatingText('❤️ +1 HEART!', clay.x, clay.y - 25, '#00ff66', 1.2);
      } else {
        this.score += 300;
        this.addFloatingText('+300 BONUS!', clay.x, clay.y - 25, '#00ff66');
      }
    } else if (clay.type === 'SLOWMO') {
      this.slowmoTimer = 10.0;
      sfx.playPowerupSlowmo();
      this.addFloatingText('⏱️ CHRONO FREEZE (10s)!', clay.x, clay.y - 25, '#38bdf8', 1.2);
    } else if (clay.type === 'SCATTER') {
      this.scatterTimer = 10.0;
      sfx.playPowerupScatter();
      this.addFloatingText('💥 SCATTER BLASTER (10s)!', clay.x, clay.y - 25, '#ffaa00', 1.2);
    } else if (clay.type === 'EMP') {
      this.triggerEmpExplosion(clay.x, clay.y);
      this.addFloatingText(`+${earnedPoints} EMP SHOCKWAVE!`, clay.x, clay.y - 25, '#c084fc', 1.2);
    } else if (clay.type === 'GOLDEN') {
      if (Math.random() < 0.35) {
        this.bonusTokens++;
        this.addFloatingText('+5 PGT BONUS TOKEN! 🪙', clay.x, clay.y - 40, '#ffd700', 1.2);
      } else {
        this.addFloatingText(`+${earnedPoints}`, clay.x, clay.y - 25, '#ffd700');
      }
    } else {
      this.addFloatingText(`+${earnedPoints}`, clay.x, clay.y - 20, '#00f0ff');
    }

    // 5. Shatter Physics Particle Explosion
    this.createClayDebris(clay, clay.color);
  }

  // --- EMP Chain Reaction ---
  triggerEmpExplosion(x, y) {
    this.screenShake = 12;
    const empRadius = 180;

    // Shockwave particle ring
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * 320,
        vy: Math.sin(angle) * 320,
        radius: 3.5,
        color: '#c084fc',
        life: 0.45,
        maxLife: 0.45,
        rotation: 0,
        rotSpeed: 0
      });
    }

    // Shatter all clays in EMP radius
    for (let i = this.clays.length - 1; i >= 0; i--) {
      const c = this.clays[i];
      const dist = Math.hypot(c.x - x, c.y - y);
      if (dist <= empRadius) {
        this.clays.splice(i, 1);
        this.claysHit++;
        this.score += (c.isHazard ? 50 : c.points) * this.comboMultiplier;
        this.createClayDebris(c, c.color);
      }
    }
  }

  // --- Shatter Particle Debris ---
  createClayDebris(clay, color) {
    const fragmentCount = 18;
    for (let i = 0; i < fragmentCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 220;
      this.particles.push({
        x: clay.x,
        y: clay.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        radius: 2.5 + Math.random() * 4.5,
        color: color,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 12.0
      });
    }
  }

  // --- Heart Loss & Game Over ---
  loseHeart(reason = '') {
    this.lives = Math.max(0, this.lives - 1);
    this.consecutiveHits = 0;
    this.comboMultiplier = 1;
    this.damageFlash = 0.35;
    this.screenShake = 10;
    sfx.playHeartLost();

    if (reason) {
      this.addFloatingText(`💔 ${reason}`, this.canvas.width / 2, this.canvas.height / 2 - 20, '#ff4444', 1.2);
    }

    if (this.lives <= 0) {
      this.gameOver();
    }
  }

  addFloatingText(text, x, y, color = '#fff', scale = 1.0) {
    this.floatingTexts.push({
      text,
      x: Math.max(40, Math.min(this.canvas.width - 40, x)),
      y,
      vy: -55,
      color,
      scale,
      life: 0.9,
      maxLife: 0.9
    });
  }

  // --- Game Over & Payout ---
  async gameOver() {
    this.state = 'GAMEOVER';
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    const multis = (window.appState && typeof window.appState.getMultipliers === 'function') ? window.appState.getMultipliers() : null;
    const nftPct = multis ? (multis.nftGameMultiplier || 0) : 0;
    const nftMult = 1 + (nftPct / 100);
    const isVip = (window.appState && typeof window.appState.isVipActive === 'function') && window.appState.isVipActive();
    const vipMult = isVip ? 2.0 : 1.0;
    const isAmb = (window.appState && window.appState.state && window.appState.state.isAmbassador);
    const ambMult = isAmb ? 2.0 : 1.0;
    const relicMult = (multis && multis.isApexUnlocked) ? 1.5 : 1.0;
    const playerMult = nftMult * vipMult * ambMult * relicMult;

    const cleanScore = Math.floor(this.score);
    const rawBase = (cleanScore / 2500.0) + (this.claysHit * 0.04);
    const tokenPgt = (this.bonusTokens || 0) * 5.0;
    const calculatedPgt = parseFloat((rawBase * playerMult).toFixed(2));
    const finalPgt = cleanScore > 0 ? Math.max(0.01, parseFloat((calculatedPgt + tokenPgt).toFixed(2))) : 0;

    let isNewHigh = (window.appState && cleanScore > (window.appState.state.skeetHighScore || 0));
    const isPlayerConnected = (window.appState && typeof window.appState.isPlayerConnected === 'function') ? window.appState.isPlayerConnected() : false;
    let verifiedPgt = this.sessionId ? finalPgt : (isPlayerConnected ? 0.0 : finalPgt);

    // Complete Server-Verified Session Payout
    let limitReached = false;
    if (window.endArcadeSession && this.sessionId) {
      try {
        const res = await window.endArcadeSession(this.sessionId, cleanScore, this.claysHit, this.bonusTokens, nftMult);
        if (res && (res.payout !== undefined || res.payout_pgt !== undefined || res.success)) {
          verifiedPgt = parseFloat(res.payout !== undefined ? res.payout : (res.payout_pgt !== undefined ? res.payout_pgt : 0));
          if (res.is_new_high) isNewHigh = true;
          if (res.limit_reached) limitReached = true;
        } else if (res && res.limit_reached) {
          limitReached = true;
        }
      } catch (err) {
        console.warn('[CyberSkeet] endArcadeSession exception:', err);
      }
    }

    if (isNewHigh && window.appState) {
      window.appState.update({
        skeetHighScore: cleanScore,
        alltimeSkeetHighScore: Math.max(window.appState.state.alltimeSkeetHighScore || 0, cleanScore)
      });
      if (typeof triggerConfetti === 'function') triggerConfetti();
    }

    // Submit High Score to Database
    if (window.submitArcadeHighScore && cleanScore > 0) {
      window.submitArcadeHighScore('skeet', cleanScore);
    }

    // Render Game Over Overlay
    const startOverlay = document.getElementById('skeet-overlay-start');
    const gameOverOverlay = document.getElementById('skeet-overlay-gameover');
    const finalScoreEl = document.getElementById('skeet-res-score');
    const finalAccEl = document.getElementById('skeet-res-accuracy');
    const finalComboEl = document.getElementById('skeet-res-combo');
    const finalPgtEl = document.getElementById('skeet-res-payout');
    const multBreakdownEl = document.getElementById('skeet-mult-breakdown');
    const highscoreText = document.getElementById('skeet-highscore-text');
    const limitBox = document.getElementById('skeet-limit-warning');

    const accuracy = this.shotsFired > 0 ? Math.round((this.claysHit / this.shotsFired) * 100) : 0;
    const gamePgt = Math.max(0, verifiedPgt - tokenPgt);
    const maxPlays = (window.appState && window.appState.state && window.appState.state.maxDailyPlaysPerGame) ? window.appState.state.maxDailyPlaysPerGame : 35;
    
    let payoutDisplay = `+${verifiedPgt.toFixed(2)} PGT`;
    if (isPlayerConnected && !this.sessionId && cleanScore > 0) {
      payoutDisplay = `+0.00 PGT <span style="display:block; color:var(--color-warning); font-size:0.75rem; margin-top:2px;">⚠️ Daily Limit (${maxPlays}/${maxPlays} plays) • Rewards Paused</span>`;
    } else if (tokenPgt > 0 && verifiedPgt > 0) {
      payoutDisplay = `+${gamePgt.toFixed(2)} PGT <span style="color:var(--color-warning); font-size:0.9em; font-weight:700;">+ ${tokenPgt.toFixed(0)} PGT Bonus</span>`;
    }

    if (finalScoreEl) finalScoreEl.innerText = cleanScore.toLocaleString();
    if (finalAccEl) finalAccEl.innerText = `${accuracy}% (${this.claysHit}/${this.shotsFired})`;
    if (finalComboEl) finalComboEl.innerText = `${this.highestCombo}x Multiplier`;
    if (finalPgtEl) finalPgtEl.innerHTML = payoutDisplay;

    const vipBadgeStr = (isVip ? ' 🔥 <span style="color:var(--color-warning); font-size:0.8rem;">(VIP 2.0x)</span>' : '') +
      (isAmb ? ' 🎖️ <span style="color:var(--color-warning); font-size:0.8rem;">(Ambassador 2.0x)</span>' : '') +
      (multis && multis.isApexUnlocked ? ' 🏺 <span style="color:#ffd700; font-size:0.8rem;">(Relics 1.5x)</span>' : '');
    if (multBreakdownEl) {
      multBreakdownEl.innerHTML = `Base: ${rawBase.toFixed(2)} PGT • Multiplier: <strong style="color:var(--color-secondary);">${playerMult.toFixed(1)}x</strong> (${nftPct}% NFT${vipBadgeStr})`;
    }

    if (highscoreText) {
      highscoreText.style.display = isNewHigh ? 'block' : 'none';
    }

    if (limitBox) {
      if (isPlayerConnected && (limitReached || (!this.sessionId && cleanScore > 0))) {
        limitBox.style.display = 'block';
        limitBox.innerText = `⚠️ Daily Limit (${maxPlays}/${maxPlays} plays) • Rewards Paused`;
      } else {
        limitBox.style.display = 'none';
      }
    }

    if (startOverlay) startOverlay.style.display = 'none';
    if (gameOverOverlay) gameOverOverlay.style.display = 'flex';

    // Restore browser touch & scroll behavior
    try {
      document.body.style.touchAction = '';
      document.body.style.userSelect = '';
      if (document.documentElement) document.documentElement.style.touchAction = '';
    } catch (e) {}

    if (window.appState && window.appState.addActivity) {
      window.appState.addActivity('You', `shattered ${this.claysHit} target clays in Cyber Skeet (${cleanScore.toLocaleString()} pts)`, `+${verifiedPgt.toFixed(2)} PGT`);
    }

    if (typeof window.sendDiscordEarnAnnouncement === 'function') {
      window.sendDiscordEarnAnnouncement('Cyber Skeet', cleanScore, verifiedPgt);
    } else if (typeof window.sendDiscordHighScore === 'function') {
      window.sendDiscordHighScore('Cyber Skeet', cleanScore, verifiedPgt);
    }
  }

  stop() {
    this.state = 'IDLE';
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    const startOverlay = document.getElementById('skeet-overlay-start');
    const gameOverOverlay = document.getElementById('skeet-overlay-gameover');
    const hudEl = document.getElementById('skeet-hud');
    const touchpadEl = document.getElementById('skeet-touchpad');
    if (startOverlay) startOverlay.style.display = 'flex';
    if (gameOverOverlay) gameOverOverlay.style.display = 'none';
    if (hudEl) hudEl.style.display = 'flex';
    if (touchpadEl) touchpadEl.style.display = 'flex';

    // Restore browser touch & scroll behavior
    try {
      document.body.style.touchAction = '';
      document.body.style.userSelect = '';
      if (document.documentElement) document.documentElement.style.touchAction = '';
    } catch (e) {}
  }

  // --- HUD Rendering ---
  updateHUD() {
    // Hearts Display
    const heartsEl = document.getElementById('skeet-hud-hearts');
    if (heartsEl) {
      let heartsStr = '';
      for (let i = 0; i < this.maxLives; i++) {
        heartsStr += (i < this.lives) ? '❤️ ' : '🖤 ';
      }
      heartsEl.innerText = heartsStr.trim();
    }

    // Score & Multiplier
    const scoreEl = document.getElementById('skeet-hud-score');
    if (scoreEl) scoreEl.innerText = Math.floor(this.score).toLocaleString();

    const comboEl = document.getElementById('skeet-hud-combo');
    if (comboEl) {
      comboEl.innerText = `${this.comboMultiplier}x COMBO`;
      comboEl.style.color = this.comboMultiplier >= 7 ? '#ff0055' : (this.comboMultiplier >= 4 ? '#ffaa00' : '#00f0ff');
    }

    // Buff Badges
    const buffEl = document.getElementById('skeet-hud-buffs');
    if (buffEl) {
      let buffs = [];
      if (this.slowmoTimer > 0) buffs.push(`⏱️ SLOW-MO ${Math.ceil(this.slowmoTimer)}s`);
      if (this.scatterTimer > 0) buffs.push(`💥 SCATTER ${Math.ceil(this.scatterTimer)}s`);
      buffEl.innerHTML = buffs.map(b => `<span style="background:rgba(0,240,255,0.2); border:1px solid #00f0ff; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:800; color:#00f0ff;">${b}</span>`).join(' ');
    }
  }

  // --- Canvas Rendering Pipeline ---
  render() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.save();

    // Apply Screen Shake
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    // 1. Draw 3 Dynamic Stage Backgrounds
    this.renderStageBackground(ctx, w, h);

    // 2. Draw Clays
    this.clays.forEach(clay => this.renderClay(ctx, clay));

    // 3. Draw Muzzle Flashes
    this.muzzleFlashes.forEach(mf => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(mf.x, mf.y, mf.radius, 0, Math.PI * 2);
      ctx.fillStyle = mf.color;
      ctx.shadowColor = mf.color;
      ctx.shadowBlur = 20;
      ctx.globalAlpha = mf.life / 0.08;
      ctx.fill();
      ctx.restore();
    });

    // 4. Draw Particles
    this.particles.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillRect(-p.radius, -p.radius, p.radius * 2, p.radius * 2);
      ctx.restore();
    });

    // 5. Draw Crosshair
    this.renderCrosshair(ctx);

    // 6. Draw Floating Text
    this.floatingTexts.forEach(ft => {
      ctx.save();
      ctx.font = `bold ${Math.round(14 * ft.scale)}px 'Space Grotesk', sans-serif`;
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 8;
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });

    // 7. Damage Flash Overlay
    if (this.damageFlash > 0) {
      ctx.fillStyle = `rgba(255, 0, 85, ${Math.min(0.45, this.damageFlash)})`;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  }

  // --- Stage Background Renderer ---
  renderStageBackground(ctx, w, h) {
    if (this.stage === 1) {
      // Stage 1: Sunset Neon Firing Range (Magenta/Purple Horizon)
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#130424');
      grad.addColorStop(0.55, '#4a0e4e');
      grad.addColorStop(0.85, '#8b1e68');
      grad.addColorStop(1, '#ff5500');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Glowing Synthwave Sun
      ctx.save();
      const sunGrad = ctx.createRadialGradient(w/2, h*0.75, 10, w/2, h*0.75, 90);
      sunGrad.addColorStop(0, '#fffb00');
      sunGrad.addColorStop(0.5, '#ff0077');
      sunGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(w/2, h*0.75, 90, Math.PI, 0);
      ctx.fill();
      ctx.restore();

    } else if (this.stage === 2) {
      // Stage 2: Midnight Neo-Tokyo (Deep Electric Blue & Auroras)
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#030712');
      grad.addColorStop(0.5, '#0c1a30');
      grad.addColorStop(0.85, '#023e8a');
      grad.addColorStop(1, '#00f0ff');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Distant Neon Grid Lines
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, h * 0.65);
        ctx.lineTo(x * 1.4 - w * 0.2, h);
        ctx.stroke();
      }
      ctx.restore();

    } else {
      // Stage 3: Cosmic Quantum Storm (Nebula Crimson & Lightning)
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#000000');
      grad.addColorStop(0.4, '#2e0854');
      grad.addColorStop(0.8, '#581c87');
      grad.addColorStop(1, '#be185d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Cosmic Dust Stars
      ctx.save();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 20; i++) {
        const sx = (Math.sin(i * 99 + this.survivalTime * 0.2) * 0.5 + 0.5) * w;
        const sy = (Math.cos(i * 33 + this.survivalTime * 0.3) * 0.5 + 0.5) * (h * 0.7);
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.restore();
    }

    // Holographic Firing Platform Ground Grid
    ctx.save();
    ctx.fillStyle = 'rgba(5, 10, 20, 0.85)';
    ctx.fillRect(0, h * 0.82, w, h * 0.18);
    ctx.strokeStyle = (this.stage === 1) ? '#ff5500' : (this.stage === 2 ? '#00f0ff' : '#ec4899');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.82);
    ctx.lineTo(w, h * 0.82);
    ctx.stroke();
    ctx.restore();
  }

  // --- Target Clay Renderer (Flat Side-View Aerodynamic Saucer) ---
  renderClay(ctx, c) {
    ctx.save();
    ctx.translate(c.x, c.y);

    // Aerodynamic flight tilt: aligns flat disc with ballistic trajectory curve
    const flightAngle = Math.atan2(c.vy * 0.35, c.vx);
    ctx.rotate(flightAngle);

    ctx.shadowColor = c.color;
    ctx.shadowBlur = 14;

    const rx = c.radius;
    const ry = c.radius * 0.22; // Sleek flat side-view profile

    // 1. Under-Rim 3D Shading Depth
    ctx.beginPath();
    ctx.ellipse(0, 2.2, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fill();

    // 2. Main Aerodynamic Saucer Disc Body
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = c.color;
    ctx.fill();

    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // 3. Inner Ridge & Cyber Grooves
    ctx.beginPath();
    ctx.ellipse(0, -0.6, rx * 0.68, ry * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = c.color;
    ctx.stroke();

    // 4. Center Core Glow Dome
    ctx.beginPath();
    ctx.ellipse(0, -1.2, rx * 0.32, ry * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // 5. Icon / Label for Special Clays
    if (c.type === 'HEALTH') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('❤️', 0, -1);
    } else if (c.type === 'SLOWMO') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⏱️', 0, -1);
    } else if (c.type === 'SCATTER') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💥', 0, -1);
    } else if (c.type === 'EMP') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', 0, -1);
    } else if (c.type === 'HAZARD') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☠️', 0, -1);
    }

    ctx.restore();
  }

  // --- Crosshair Renderer ---
  renderCrosshair(ctx) {
    const x = this.crosshairX;
    const y = this.crosshairY;
    const r = (this.scatterTimer > 0) ? 28 : this.crosshairRadius;
    const color = (this.scatterTimer > 0) ? '#ffaa00' : (this.slowmoTimer > 0 ? '#38bdf8' : this.crosshairColor);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;

    // Outer Circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Reticle Cross lines
    const lineLen = 8;
    ctx.beginPath();
    ctx.moveTo(x - r - lineLen, y); ctx.lineTo(x - r + 3, y);
    ctx.moveTo(x + r - 3, y); ctx.lineTo(x + r + lineLen, y);
    ctx.moveTo(x, y - r - lineLen); ctx.lineTo(x, y - r + 3);
    ctx.moveTo(x, y + r - 3); ctx.lineTo(x, y + r + lineLen);
    ctx.stroke();

    // Center Dot
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
  }
}

// Global Singleton Initializer
export let skeetEngine = null;

export function initCyberSkeet() {
  if (!skeetEngine) {
    skeetEngine = new CyberSkeetEngine();
    window.skeetEngine = skeetEngine;
  }
  return skeetEngine;
}

window.startCyberSkeet = function() {
  const engine = initCyberSkeet();
  if (engine) engine.startGame();
};

window.recenterSkeetGyro = function() {
  if (window.skeetEngine) window.skeetEngine.recenterGyro();
};

window.toggleSkeetGyro = function() {
  if (window.skeetEngine) window.skeetEngine.toggleGyro();
};
