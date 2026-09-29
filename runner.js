// ==============================================================================
// CYBER RUNNER - HIGH-VELOCITY 3-LANE SYNTHWAVE INFINITE RUNNER (PLAN-013)
// ==============================================================================
// Features:
//   - 3-Lane pseudo-3D perspective canvas engine with smooth lateral interpolation
//   - Jump over low barriers, slide under high laser grids, switch lanes to dodge walls
//   - Collect PGT Tokens and Quantum Shards
//   - Mathematically and physically impossible survival cap (<180s) via escalating
//     cyber-storm terminal velocity and 3-lane singularity firewall
//   - Complete authoritative Supabase Arcade Session & Turnstile sentinel integration
//   - Web Audio API retro synthesizer sound effects
//   - Keyboard & mobile touch swipe gesture controls
// ==============================================================================

class CyberRunnerGame {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.isRunning = false;

    // Session & Anti-Cheat
    this.sessionId = null;
    this.startTime = 0;
    this.gameTime = 0; // In seconds
    this.lastFrameTime = 0;

    // Scoring & Collectibles
    this.score = 0;
    this.distance = 0;
    this.bonusTokensCollected = 0; // PGT Coins
    this.bonusItemsCollected = 0;  // Quantum Shards
    this.speed = 10;
    this.baseSpeed = 10;
    this.maxSpeed = 36; // Terminal velocity reached at 150s

    // Player State
    // Lanes: -1 (Left), 0 (Center), 1 (Right)
    this.currentLane = 0;
    this.targetLane = 0;
    this.laneX = 0; // Current rendered X (-1 to 1)
    this.laneWidth = 140; // Virtual world units

    this.y = 0; // Vertical offset from ground (jumping)
    this.velocityY = 0;
    this.gravity = -0.7;
    this.jumpForce = 13.5;
    this.isJumping = false;

    this.isSliding = false;
    this.slideTimer = 0;
    this.slideDuration = 0.65; // Seconds

    // World Entities
    this.obstacles = [];
    this.collectibles = [];
    this.particles = [];
    this.groundGridOffset = 0;
    this.nextSpawnZ = 800;
    this.spawnInterval = 320;

    // Visual FX
    this.screenShake = 0;
    this.glitchIntensity = 0;

    // Audio Context (Synthesizer)
    this.audioCtx = null;

    // Touch gesture tracking
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;

    this.boundResize = () => this.resize();
    window.addEventListener('resize', this.boundResize);
    this.bindInputs();
  }

  // --- Audio Engine ---
  initAudio() {
    if (!this.audioCtx) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      } catch (e) {}
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  playSfx(type) {
    if (!this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(580, now + 0.18);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'slide') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.linearRampToValueAtTime(140, now + 0.22);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'lane') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(660, now + 0.05);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1320, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'shard') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1100, now);
        osc.frequency.setValueAtTime(1650, now + 0.06);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else if (type === 'crash') {
        // White noise burst
        const bufferSize = this.audioCtx.sampleRate * 0.4;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const whiteNoise = this.audioCtx.createBufferSource();
        whiteNoise.buffer = buffer;
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);
        filter.frequency.linearRampToValueAtTime(80, now + 0.4);
        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        whiteNoise.start(now);
        whiteNoise.stop(now + 0.4);
      }
    } catch (e) {}
  }

  // --- Initialization & Resizing ---
  init() {
    this.canvas = document.getElementById('runner-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
  }

  resize() {
    if (!this.canvas) return;
    const container = this.canvas.parentElement;
    const rect = container ? container.getBoundingClientRect() : this.canvas.getBoundingClientRect();
    const aspect = 400 / 640;

    let w = Math.round(rect.width || 640);
    let h = Math.round(w * aspect);

    const isFullscreen = document.body.classList.contains('game-fullscreen-open') ||
      document.getElementById('game-window-container')?.classList.contains('fullscreen-active');
    if (isFullscreen) {
      const maxH = Math.round(window.innerHeight * 0.82);
      if (h > maxH) {
        h = maxH;
        w = Math.round(h / aspect);
      }
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.renderWidth = w;
    this.renderHeight = h;
  }

  // --- Input Binding ---
  bindInputs() {
    window.addEventListener('keydown', (e) => {
      if (!this.isRunning) return;
      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault();
        this.moveLane(-1);
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        this.moveLane(1);
      } else if (['ArrowUp', 'KeyW', 'Space'].includes(e.code)) {
        e.preventDefault();
        this.jump();
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        this.slide();
      }
    });

    // Touch Swipe Gestures
    const targetEl = document.getElementById('panel-game-runner') || window;
    targetEl.addEventListener('touchstart', (e) => {
      if (!this.isRunning || !e.touches || e.touches.length === 0) return;
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.touchStartTime = Date.now();
    }, { passive: true });

    targetEl.addEventListener('touchend', (e) => {
      if (!this.isRunning || !e.changedTouches || e.changedTouches.length === 0) return;
      const dx = e.changedTouches[0].clientX - this.touchStartX;
      const dy = e.changedTouches[0].clientY - this.touchStartY;
      const elapsed = Date.now() - this.touchStartTime;

      if (elapsed > 500) return; // Not a swipe

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (Math.max(absX, absY) < 25) return; // Too small

      if (absX > absY) {
        if (dx > 0) this.moveLane(1);
        else this.moveLane(-1);
      } else {
        if (dy < 0) this.jump();
        else this.slide();
      }
    }, { passive: true });
  }

  moveLane(dir) {
    const next = Math.max(-1, Math.min(1, this.targetLane + dir));
    if (next !== this.targetLane) {
      this.targetLane = next;
      this.playSfx('lane');
      this.createTrailParticles(8, '#00f0ff');
    }
  }

  jump() {
    if (this.isJumping) return;
    this.isJumping = true;
    this.velocityY = this.jumpForce;
    this.isSliding = false;
    this.playSfx('jump');
    this.createTrailParticles(12, '#ff007f');
  }

  slide() {
    if (this.isJumping) {
      // Fast fall
      this.velocityY = -18;
    }
    this.isSliding = true;
    this.slideTimer = this.slideDuration;
    this.playSfx('slide');
    this.createTrailParticles(10, '#ffd700');
  }

  // --- Game Lifecycle ---
  async start() {
    this.initAudio();
    this.init();

    // Check Turnstile & Request Server Session
    let sessId = null;
    if (typeof window.startArcadeSession === 'function') {
      sessId = await window.startArcadeSession('runner');
      if (!sessId && window.appState && window.appState.isPlayerConnected && window.appState.isPlayerConnected()) {
        // Player canceled Turnstile challenge or failed validation
        return;
      }
    }
    this.sessionId = sessId;

    // Reset State
    this.score = 0;
    this.distance = 0;
    this.bonusTokensCollected = 0;
    this.bonusItemsCollected = 0;
    this.speed = this.baseSpeed;
    this.currentLane = 0;
    this.targetLane = 0;
    this.laneX = 0;
    this.y = 0;
    this.velocityY = 0;
    this.isJumping = false;
    this.isSliding = false;
    this.slideTimer = 0;
    this.obstacles = [];
    this.collectibles = [];
    this.particles = [];
    this.nextSpawnZ = 900;
    this.screenShake = 0;
    this.glitchIntensity = 0;

    this.startTime = Date.now();
    this.gameTime = 0;
    this.lastFrameTime = performance.now();
    this.isRunning = true;

    // UI Updates
    const startScreen = document.getElementById('runner-start-screen');
    const gameoverScreen = document.getElementById('runner-gameover-screen');
    const controlsHud = document.getElementById('runner-controls-hud');
    if (startScreen) startScreen.style.display = 'none';
    if (gameoverScreen) gameoverScreen.style.display = 'none';
    if (controlsHud) controlsHud.style.display = 'flex';

    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.loop(performance.now());
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  // --- Main Game Loop ---
  loop(timestamp) {
    if (!this.isRunning) return;

    const dt = Math.min((timestamp - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = timestamp;

    this.update(dt);
    this.render();

    this.animationId = requestAnimationFrame((t) => this.loop(t));
  }

  // --- Update & Anti-Cheat Survival Curve ---
  update(dt) {
    this.gameTime += dt;
    this.distance += this.speed * dt * 4;
    this.score = Math.floor(this.distance + (this.bonusTokensCollected * 100) + (this.bonusItemsCollected * 50));

    // Dynamic Speed Escalation Curve:
    // 0-40s: 10 -> 14
    // 40-80s: 14 -> 20
    // 80-120s: 20 -> 27
    // 120-150s: 27 -> 34 (Extreme)
    // 150-180s: 34 -> 40 (Terminal Velocity Cyber Storm)
    if (this.gameTime < 40) {
      this.speed = 10 + (this.gameTime / 40) * 4;
    } else if (this.gameTime < 80) {
      this.speed = 14 + ((this.gameTime - 40) / 40) * 6;
    } else if (this.gameTime < 120) {
      this.speed = 20 + ((this.gameTime - 80) / 40) * 7;
    } else if (this.gameTime < 150) {
      this.speed = 27 + ((this.gameTime - 120) / 30) * 7;
    } else {
      this.speed = 34 + Math.min(6, ((this.gameTime - 150) / 30) * 6);
      this.glitchIntensity = Math.min(1.0, (this.gameTime - 150) / 25);
    }

    // 💥 CRITICAL ANTI-CHEAT ENFORCEMENT: Strictly impossible to survive >180s
    // At 175s, an unavoidable 3-lane electromagnetic singularity firewall sweeps down.
    if (this.gameTime >= 175 && !this.obstacles.some(o => o.type === 'singularity_wall')) {
      this.obstacles.push({
        type: 'singularity_wall',
        z: 700,
        lane: 0, // Covers all 3 lanes (-1, 0, 1)
        width: 3.5,
        height: 120,
        color: '#ff0033'
      });
      this.screenShake = 18;
    }

    // Hard engine cutoff: guaranteed death at 179.5s
    if (this.gameTime >= 179.5) {
      this.gameOver();
      return;
    }

    // Smooth lateral movement towards target lane
    this.laneX += (this.targetLane - this.laneX) * Math.min(1, dt * 14);

    // Jump Physics
    if (this.isJumping) {
      this.y += this.velocityY * dt * 40;
      this.velocityY += this.gravity * dt * 40;
      if (this.y <= 0) {
        this.y = 0;
        this.velocityY = 0;
        this.isJumping = false;
        this.createTrailParticles(6, '#00f0ff');
      }
    }

    // Slide Physics
    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
      }
    }

    // Screen Shake decay
    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 25);
    }

    // Ground Grid Animation
    this.groundGridOffset = (this.groundGridOffset + this.speed * dt * 80) % 60;

    // Entity Spawning
    this.updateSpawning(dt);

    // Update Obstacles & Collision Check
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.z -= this.speed * dt * 60;

      // Collision Detection at player Z (approx z = 60 to 140)
      if (obs.z >= 60 && obs.z <= 140) {
        if (this.checkCollision(obs)) {
          this.gameOver();
          return;
        }
      }

      // Remove passed obstacles
      if (obs.z < 20) {
        this.obstacles.splice(i, 1);
      }
    }

    // Update Collectibles
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const item = this.collectibles[i];
      item.z -= this.speed * dt * 60;

      // Pickup Detection
      if (item.z >= 60 && item.z <= 140) {
        const laneDiff = Math.abs(this.laneX - item.lane);
        const yDiff = Math.abs(this.y - item.y);
        if (laneDiff < 0.55 && yDiff < 50) {
          if (item.type === 'coin') {
            this.bonusTokensCollected = Math.min(30, this.bonusTokensCollected + 1);
            this.playSfx('coin');
            this.createExplosionParticles(this.getScreenPos(item.lane, item.z, item.y), '#ffd700', 10);
          } else {
            this.bonusItemsCollected = Math.min(50, this.bonusItemsCollected + 1);
            this.playSfx('shard');
            this.createExplosionParticles(this.getScreenPos(item.lane, item.z, item.y), '#00f0ff', 10);
          }
          this.collectibles.splice(i, 1);
          continue;
        }
      }

      if (item.z < 20) {
        this.collectibles.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Regular runner thruster particles
    if (Math.random() < 0.45) {
      this.createTrailParticles(1, '#00f0ff');
    }

    this.updateHUD();
  }

  // --- Entity Spawning Engine ---
  updateSpawning(dt) {
    this.nextSpawnZ -= this.speed * dt * 60;
    if (this.nextSpawnZ <= 0) {
      this.nextSpawnZ = Math.max(160, 360 - (this.speed * 4));
      this.spawnWave();
    }
  }

  spawnWave() {
    const lanes = [-1, 0, 1];
    const availableLanes = [...lanes];
    const spawnZ = 950;

    // Difficulty pattern based on game time
    if (this.gameTime < 45) {
      // Single lane obstacle, 1 collectible lane
      const obsLane = availableLanes.splice(Math.floor(Math.random() * availableLanes.length), 1)[0];
      const type = Math.random() < 0.6 ? 'lowBarrier' : 'highLaser';
      this.obstacles.push({ type, lane: obsLane, z: spawnZ });

      if (Math.random() < 0.7) {
        const itemLane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
        const itemType = Math.random() < 0.6 ? 'shard' : 'coin';
        this.collectibles.push({ type: itemType, lane: itemLane, z: spawnZ, y: type === 'lowBarrier' ? 10 : 0 });
      }
    } else if (this.gameTime < 95) {
      // 1 or 2 lane obstacles
      const count = Math.random() < 0.5 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        if (availableLanes.length === 0) break;
        const obsLane = availableLanes.splice(Math.floor(Math.random() * availableLanes.length), 1)[0];
        const type = Math.random() < 0.45 ? 'lowBarrier' : (Math.random() < 0.8 ? 'highLaser' : 'fullWall');
        this.obstacles.push({ type, lane: obsLane, z: spawnZ });
      }
      if (availableLanes.length > 0 && Math.random() < 0.6) {
        const itemLane = availableLanes[0];
        this.collectibles.push({ type: 'shard', lane: itemLane, z: spawnZ, y: 15 });
      }
    } else if (this.gameTime < 145) {
      // 2 lane obstacles (must choose the 1 open lane or jump/slide correctly)
      const freeLane = lanes[Math.floor(Math.random() * lanes.length)];
      for (const l of lanes) {
        if (l === freeLane) {
          if (Math.random() < 0.8) {
            this.collectibles.push({ type: Math.random() < 0.5 ? 'coin' : 'shard', lane: l, z: spawnZ, y: 10 });
          }
        } else {
          const type = Math.random() < 0.4 ? 'lowBarrier' : (Math.random() < 0.7 ? 'highLaser' : 'fullWall');
          this.obstacles.push({ type, lane: l, z: spawnZ });
        }
      }
    } else {
      // Overdrive: fast complex patterns
      const freeLane = lanes[Math.floor(Math.random() * lanes.length)];
      for (const l of lanes) {
        if (l === freeLane) {
          // Put high laser in the "free" lane, forcing a slide
          if (Math.random() < 0.65) {
            this.obstacles.push({ type: 'highLaser', lane: l, z: spawnZ });
          }
        } else {
          this.obstacles.push({ type: 'fullWall', lane: l, z: spawnZ });
        }
      }
    }
  }

  // --- Collision Detection ---
  checkCollision(obs) {
    // Singularity Wall covers all lanes and all heights
    if (obs.type === 'singularity_wall') {
      return true;
    }

    const laneDiff = Math.abs(this.laneX - obs.lane);
    if (laneDiff > 0.52) return false; // In a different lane

    if (obs.type === 'lowBarrier') {
      // Must jump over: if player y > 45, safe!
      return this.y < 42;
    } else if (obs.type === 'highLaser') {
      // Must slide under: if player is sliding and not jumping, safe!
      return !this.isSliding || this.y > 15;
    } else if (obs.type === 'fullWall') {
      // Cannot jump or slide through full wall!
      return true;
    }
    return false;
  }

  // --- Particles ---
  createTrailParticles(count, color) {
    const pPos = this.getPlayerScreenPos();
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: pPos.x + (Math.random() - 0.5) * 20,
        y: pPos.y + 10,
        vx: (Math.random() - 0.5) * 40,
        vy: 20 + Math.random() * 40,
        color: color,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
        size: 3 + Math.random() * 4
      });
    }
  }

  createExplosionParticles(pos, color, count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 120;
      this.particles.push({
        x: pos.x,
        y: pos.y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color: color,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        size: 4 + Math.random() * 4
      });
    }
  }

  // --- Perspective Coordinate Projection ---
  getScreenPos(lane, z, y = 0) {
    const w = this.renderWidth;
    const h = this.renderHeight;
    const vanishX = w / 2;
    const vanishY = h * 0.36;

    // Perspective depth scale factor (z ranges 1000 down to 20)
    const factor = Math.max(0.01, 160 / Math.max(10, z));
    const groundY = h * 0.88;

    const screenX = vanishX + (lane * this.laneWidth) * factor * 1.8;
    const screenY = groundY - (groundY - vanishY) * (1 - factor) - (y * factor * 1.6);

    return { x: screenX, y: screenY, factor };
  }

  getPlayerScreenPos() {
    return this.getScreenPos(this.laneX, 100, this.y);
  }

  // --- Rendering Engine ---
  render() {
    const ctx = this.ctx;
    const w = this.renderWidth;
    const h = this.renderHeight;

    ctx.save();

    // Screen Shake Offset
    if (this.screenShake > 0) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(sx, sy);
    }

    // 1. Sky & Cyber Synthwave Backdrop
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGrad.addColorStop(0, '#05020c');
    skyGrad.addColorStop(0.6, '#180728');
    skyGrad.addColorStop(1, '#3b0d4a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Neon Cyber Sun on Horizon
    const sunX = w / 2;
    const sunY = h * 0.35;
    const sunRad = Math.min(w, h) * 0.18;
    const sunGrad = ctx.createLinearGradient(sunX, sunY - sunRad, sunX, sunY + sunRad);
    sunGrad.addColorStop(0, '#ff007f');
    sunGrad.addColorStop(0.5, '#ff5500');
    sunGrad.addColorStop(1, '#ffd700');

    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRad, Math.PI, 0);
    ctx.fillStyle = sunGrad;
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 24;
    ctx.fill();

    // Horizon Sun Scanlines
    ctx.fillStyle = '#05020c';
    for (let y = sunY - sunRad * 0.6; y < sunY; y += 7) {
      const lineH = 1.5 + (y - (sunY - sunRad * 0.6)) * 0.08;
      ctx.fillRect(sunX - sunRad - 5, y, sunRad * 2 + 10, lineH);
    }
    ctx.restore();

    // 2. 3D Perspective Ground Plane
    const groundY = h * 0.36;
    const floorGrad = ctx.createLinearGradient(0, groundY, 0, h);
    floorGrad.addColorStop(0, '#0d041a');
    floorGrad.addColorStop(0.4, '#15062a');
    floorGrad.addColorStop(1, '#05010c');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, groundY, w, h - groundY);

    // Perspective Grid Lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 6;

    // Longitudinal Lane Lines (-1.5, -0.5, 0.5, 1.5)
    const laneDivs = [-1.5, -0.5, 0.5, 1.5];
    laneDivs.forEach(div => {
      const topPos = this.getScreenPos(div, 1000, 0);
      const botPos = this.getScreenPos(div, 30, 0);
      ctx.beginPath();
      ctx.moveTo(topPos.x, topPos.y);
      ctx.lineTo(botPos.x, botPos.y);
      ctx.stroke();
    });

    // Horizontal Moving Gridlines
    ctx.strokeStyle = 'rgba(255, 0, 127, 0.35)';
    ctx.shadowColor = '#ff007f';
    ctx.lineWidth = 1;
    for (let z = 50 + (this.groundGridOffset % 50); z < 1000; z += 50) {
      const left = this.getScreenPos(-1.6, z, 0);
      const right = this.getScreenPos(1.6, z, 0);
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
    }

    // 3. Render Collectibles (Sorted Far to Near)
    this.collectibles.sort((a, b) => b.z - a.z);
    this.collectibles.forEach(item => {
      const p = this.getScreenPos(item.lane, item.z, item.y);
      const size = 26 * p.factor;
      if (size < 2) return;

      ctx.save();
      ctx.translate(p.x, p.y);
      if (item.type === 'coin') {
        // Gold PGT Token
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 12 * p.factor;
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5 * p.factor;
        ctx.stroke();

        ctx.fillStyle = '#000';
        ctx.font = `bold ${Math.max(8, Math.floor(size * 1.1))}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('P', 0, 0);
      } else {
        // Cyan Quantum Shard Diamond
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 14 * p.factor;
        ctx.beginPath();
        ctx.moveTo(0, -size * 1.3);
        ctx.lineTo(size, 0);
        ctx.moveTo(0, size * 1.3);
        ctx.lineTo(-size, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5 * p.factor;
        ctx.stroke();
      }
      ctx.restore();
    });

    // 4. Render Obstacles (Sorted Far to Near)
    this.obstacles.sort((a, b) => b.z - a.z);
    this.obstacles.forEach(obs => {
      if (obs.type === 'singularity_wall') {
        // Unavoidable Terminal Firewall
        const p = this.getScreenPos(0, obs.z, 0);
        const wallW = w * 1.2;
        const wallH = h * 0.9;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 0, 50, 0.85)';
        ctx.shadowColor = '#ff0033';
        ctx.shadowBlur = 35;
        ctx.fillRect((w - wallW) / 2, p.y - wallH, wallW, wallH);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.strokeRect((w - wallW) / 2, p.y - wallH, wallW, wallH);
        ctx.restore();
        return;
      }

      const p = this.getScreenPos(obs.lane, obs.z, 0);
      const factor = p.factor;
      const baseW = 100 * factor;

      ctx.save();
      ctx.translate(p.x, p.y);

      if (obs.type === 'lowBarrier') {
        // Red roadblock: jump over
        const bH = 34 * factor;
        ctx.fillStyle = '#ff2a00';
        ctx.shadowColor = '#ff3300';
        ctx.shadowBlur = 14 * factor;
        ctx.fillRect(-baseW / 2, -bH, baseW, bH);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2 * factor;
        ctx.strokeRect(-baseW / 2, -bH, baseW, bH);

        // Warning Hazard Stripes
        ctx.fillStyle = '#000';
        for (let x = -baseW / 2 + 6 * factor; x < baseW / 2; x += 14 * factor) {
          ctx.fillRect(x, -bH, 5 * factor, bH);
        }
      } else if (obs.type === 'highLaser') {
        // Overhead electric beam: slide under
        const beamY = -85 * factor;
        const bH = 18 * factor;
        ctx.fillStyle = '#ff00ff';
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 20 * factor;
        ctx.fillRect(-baseW * 0.65, beamY, baseW * 1.3, bH);

        // Side support pylons
        ctx.fillStyle = '#330066';
        ctx.fillRect(-baseW * 0.65, beamY, 8 * factor, -beamY);
        ctx.fillRect(baseW * 0.65 - 8 * factor, beamY, 8 * factor, -beamY);
      } else if (obs.type === 'fullWall') {
        // Solid Neon Cyber Wall
        const wallH = 110 * factor;
        ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 22 * factor;
        ctx.fillRect(-baseW * 0.55, -wallH, baseW * 1.1, wallH);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2 * factor;
        ctx.strokeRect(-baseW * 0.55, -wallH, baseW * 1.1, wallH);

        // Skull / Warning symbol
        ctx.fillStyle = '#000';
        ctx.font = `bold ${Math.max(10, Math.floor(18 * factor))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚠️ BLOCKED', 0, -wallH * 0.5);
      }
      ctx.restore();
    });

    // 5. Render Player Character
    this.renderPlayer(ctx);

    // 6. Render Particles
    this.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // 7. Cyber Storm Glitch FX (Phase 5 terminal difficulty)
    if (this.glitchIntensity > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255, 0, 85, ${0.12 * this.glitchIntensity})`;
      for (let i = 0; i < 4; i++) {
        const gh = Math.random() * 20 + 5;
        const gy = Math.random() * h;
        ctx.fillRect(0, gy, w, gh);
      }
      ctx.restore();
    }

    ctx.restore();
  }

  // --- Render Player Character ---
  renderPlayer(ctx) {
    const p = this.getPlayerScreenPos();
    const factor = p.factor;
    const bodyW = 34 * factor;
    const bodyH = (this.isSliding ? 18 : 46) * factor;

    ctx.save();
    ctx.translate(p.x, p.y);

    // Shadow on Ground
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 2, bodyW * 0.8, 6 * factor, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Player Neon Silhouette
    if (this.isSliding) {
      // Sliding: Low crouching neon disc
      ctx.fillStyle = '#ff007f';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.roundRect(-bodyW * 0.8, -bodyH, bodyW * 1.6, bodyH, 6);
      ctx.fill();

      // Visor
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(-bodyW * 0.4, -bodyH * 0.7, bodyW * 0.8, 5 * factor);
    } else {
      // Standing / Jumping Cyber Runner
      // Body
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.roundRect(-bodyW / 2, -bodyH, bodyW, bodyH, 8);
      ctx.fill();

      // Neon Core Heart
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, -bodyH * 0.55, 6 * factor, 0, Math.PI * 2);
      ctx.fill();

      // Visor
      ctx.fillStyle = '#ff007f';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 10;
      ctx.fillRect(-bodyW * 0.35, -bodyH * 0.85, bodyW * 0.7, 7 * factor);

      // Jet Thrusters on back
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
      ctx.fillRect(-bodyW * 0.4, -bodyH * 0.25, 4 * factor, 12 * factor);
      ctx.fillRect(bodyW * 0.4 - 4 * factor, -bodyH * 0.25, 4 * factor, 12 * factor);
    }

    ctx.restore();
  }

  // --- HUD Updates ---
  updateHUD() {
    const scoreEl = document.getElementById('runner-score-val');
    const distEl = document.getElementById('runner-dist-val');
    const timeEl = document.getElementById('runner-time-val');
    const tokensEl = document.getElementById('runner-tokens-val');
    const speedEl = document.getElementById('runner-speed-val');

    if (scoreEl) scoreEl.innerText = this.score.toLocaleString();
    if (distEl) distEl.innerText = `${Math.floor(this.distance)}m`;
    if (tokensEl) tokensEl.innerText = `🪙 ${this.bonusTokensCollected} • ✨ ${this.bonusItemsCollected}`;
    if (speedEl) speedEl.innerText = `${Math.floor(this.speed * 4)} km/h`;

    if (timeEl) {
      const rem = Math.max(0, 180 - Math.floor(this.gameTime));
      const mins = Math.floor(rem / 60);
      const secs = (rem % 60).toString().padStart(2, '0');
      timeEl.innerText = `${mins}:${secs}`;
      if (rem < 30) {
        timeEl.style.color = 'var(--color-danger)';
      } else {
        timeEl.style.color = 'var(--color-accent)';
      }
    }
  }

  // --- Game Over & Session Finalization ---
  async gameOver() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);

    this.playSfx('crash');
    this.createExplosionParticles(this.getPlayerScreenPos(), '#ff0033', 35);
    this.render();

    // Trigger daily quest progression ("Play 3 Arcade Games")
    if (typeof window.trackQuestProgress === 'function') {
      window.trackQuestProgress('arcade', 1);
    }

    const cleanScore = Math.floor(this.score);
    const finalTokens = Math.min(25, this.bonusTokensCollected);
    const finalShards = Math.min(50, this.bonusItemsCollected);

    // Multipliers
    const isPlayerConnected = window.appState && typeof window.appState.isPlayerConnected === 'function' && window.appState.isPlayerConnected();
    const multis = (window.appState && typeof window.appState.getMultipliers === 'function') ? window.appState.getMultipliers() : {};
    const nftMult = Math.max(1.0, Math.min(10.0, 1 + ((multis.nftGameMultiplier || 0) / 100)));
    const relicMult = (multis && (multis.isApexUnlocked || multis.isSeason1ApexUnlocked)) ? 1.5 : 1.0;
    const isVip = window.appState && typeof window.appState.isVipActive === 'function' && window.appState.isVipActive();
    const vipMult = isVip ? 2.0 : 1.0;

    // Local Highscore Check
    const prevHigh = (window.appState && window.appState.state) ? (window.appState.state.runnerHighScore || 0) : 0;
    const isNewHigh = cleanScore > prevHigh;

    if (window.appState && window.appState.state) {
      window.appState.state.runnerHighScore = Math.max(cleanScore, prevHigh);
      window.appState.state.alltimeRunnerHighScore = Math.max(cleanScore, window.appState.state.alltimeRunnerHighScore || 0);
      window.appState.save();
    }

    // Authoritative Server Session Settlement via Supabase RPC
    let verifiedPgt = 0.0;
    let isHarvestDisabled = false;
    let isDailyLimitReached = false;

    if (window.endArcadeSession && this.sessionId) {
      try {
        const res = await window.endArcadeSession(this.sessionId, cleanScore, finalShards, finalTokens, nftMult);
        if (res && (res.payout !== undefined || res.payout_pgt !== undefined || res.success)) {
          verifiedPgt = parseFloat(res.payout !== undefined ? res.payout : (res.payout_pgt !== undefined ? res.payout_pgt : 0));
          if (res.harvest_enabled === false) isHarvestDisabled = true;
          if (res.daily_limit_reached) isDailyLimitReached = true;
        }
      } catch (err) {
        console.warn("[CyberRunner] endArcadeSession failed:", err);
      }
    }

    // Refresh Leaderboard & Profile Scorecards
    if (typeof window.loadRunnerLeaderboard === 'function') {
      window.loadRunnerLeaderboard();
    }
    if (typeof window.syncProfileView === 'function') {
      window.syncProfileView();
    }

    // Render Game Over Screen Overlay
    const gameoverScreen = document.getElementById('runner-gameover-screen');
    const finalScoreEl = document.getElementById('runner-final-score');
    const finalDistEl = document.getElementById('runner-final-dist');
    const finalPgtEl = document.getElementById('runner-final-pgt');
    const multBreakdownEl = document.getElementById('runner-mult-breakdown');
    const highscoreText = document.getElementById('runner-highscore-text');
    const limitWarning = document.getElementById('runner-limit-warning');
    const controlsHud = document.getElementById('runner-controls-hud');

    if (controlsHud) controlsHud.style.display = 'none';
    if (finalScoreEl) finalScoreEl.innerText = cleanScore.toLocaleString();
    if (finalDistEl) finalDistEl.innerText = `${Math.floor(this.distance)}m (${Math.floor(this.gameTime)}s)`;

    if (finalPgtEl) {
      if (isHarvestDisabled) {
        finalPgtEl.innerHTML = `<span style="color:var(--text-dim);">Harvest Paused (Admin Setting)</span>`;
      } else if (!isPlayerConnected) {
        finalPgtEl.innerHTML = `<span style="color:var(--text-dim); font-size:1.1rem;">Connect Wallet to Earn PGT</span>`;
      } else {
        finalPgtEl.innerText = `+${verifiedPgt.toFixed(2)} PGT`;
      }
    }

    if (multBreakdownEl) {
      const activeMult = (nftMult * relicMult * vipMult).toFixed(2);
      multBreakdownEl.innerText = `NFT: ${nftMult.toFixed(2)}x • Relics: ${relicMult.toFixed(2)}x • VIP: ${vipMult.toFixed(1)}x (Total: ${activeMult}x)`;
    }

    if (highscoreText) {
      highscoreText.style.display = isNewHigh && cleanScore > 0 ? 'block' : 'none';
    }

    if (limitWarning) {
      if (isDailyLimitReached) {
        limitWarning.innerText = "⚠️ Daily arcade plays reached. Highscore recorded!";
        limitWarning.style.display = 'block';
      } else {
        limitWarning.style.display = 'none';
      }
    }

    if (gameoverScreen) {
      gameoverScreen.style.removeProperty('display');
      gameoverScreen.style.display = 'flex';
    }
  }
}

// Global Single Instance
window.cyberRunner = new CyberRunnerGame();
window.startCyberRunner = () => {
  if (window.cyberRunner) window.cyberRunner.start();
};
