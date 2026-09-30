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
    this.laneWidth = 135; // Virtual world units

    this.y = 0; // Vertical offset from ground (jumping)
    this.velocityY = 0;
    this.gravity = -0.80;
    this.jumpForce = 10.2;
    this.isJumping = false;
    this.jumpBufferTimer = 0;

    this.isSliding = false;
    this.slideTimer = 0;
    this.slideDuration = 0.65; // Seconds

    // Synthwave Environment Starfield
    this.stars = [];
    for (let i = 0; i < 70; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random() * 0.35,
        size: 0.8 + Math.random() * 1.8,
        color: ['#ffffff', '#00f0ff', '#ff77aa', '#ffd700'][Math.floor(Math.random() * 4)],
        phase: Math.random() * Math.PI * 2,
        speed: 1.5 + Math.random() * 2.5
      });
    }

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
    const aspect = 9 / 16;

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
    this.laneWidth = Math.min(135, Math.max(70, Math.round(w * 0.21)));
  }

  // --- Input Binding ---
  bindInputs() {
    window.addEventListener('keydown', (e) => {
      if (!this.isRunning) return;
      const code = e.code || '';
      const key = e.key || '';
      if (code === 'ArrowLeft' || key === 'ArrowLeft' || code === 'KeyA' || key.toLowerCase() === 'a') {
        e.preventDefault();
        this.moveLane(-1);
      } else if (code === 'ArrowRight' || key === 'ArrowRight' || code === 'KeyD' || key.toLowerCase() === 'd') {
        e.preventDefault();
        this.moveLane(1);
      } else if (code === 'ArrowUp' || key === 'ArrowUp' || code === 'KeyW' || key.toLowerCase() === 'w' || code === 'Space' || key === ' ') {
        e.preventDefault();
        this.jump();
      } else if (code === 'ArrowDown' || key === 'ArrowDown' || code === 'KeyS' || key.toLowerCase() === 's') {
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
    if (this.isJumping) {
      this.jumpBufferTimer = 0.18;
      return;
    }
    this.isJumping = true;
    this.velocityY = this.jumpForce;
    this.isSliding = false;
    this.playSfx('jump');
    this.createTrailParticles(12, '#ff007f');
  }

  slide() {
    if (this.isJumping) {
      // Fast fall
      this.velocityY = -16;
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
    this.jumpBufferTimer = 0;
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

    // Jump Physics & Input Buffering
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= dt;
    }

    if (this.isJumping) {
      this.y += this.velocityY * dt * 40;
      this.velocityY += this.gravity * dt * 40;
      if (this.y <= 0) {
        this.y = 0;
        this.velocityY = 0;
        this.isJumping = false;
        this.createTrailParticles(6, '#00f0ff');
        if (this.jumpBufferTimer > 0) {
          this.jumpBufferTimer = 0;
          this.jump();
        }
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
    this.groundGridOffset = (this.groundGridOffset + this.speed * dt * 80) % 40;

    // Entity Spawning
    this.updateSpawning(dt);

    // Update Obstacles & Collision Check
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      const prevZ = obs.z;
      obs.z -= this.speed * dt * 60;

      // Obstacle collision check: trigger when obstacle reaches player depth (z ~ 100)
      if (!obs.cleared) {
        // Tight, accurate contact zone at player depth [85, 110] or crossing z = 100
        const inZone = (obs.z <= 110 && obs.z >= 85) || (prevZ >= 100 && obs.z <= 100);
        if (inZone) {
          if (this.checkCollision(obs)) {
            this.gameOver();
            return;
          } else {
            // Obstacle was successfully evaded (jumped, slid, or in different lane)
            // Mark cleared so player landing on ground afterwards never triggers a collision!
            obs.cleared = true;
          }
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
    if (obs.cleared) return false;

    // Singularity Wall covers all lanes and all heights
    if (obs.type === 'singularity_wall') {
      return true;
    }

    const laneDiff = Math.abs(this.laneX - obs.lane);
    if (laneDiff > 0.52) return false; // In a different lane

    if (obs.type === 'lowBarrier') {
      // Must jump over: if player y >= 16, safe!
      return this.y < 16;
    } else if (obs.type === 'highLaser') {
      // Must slide under: if player is sliding and stays low under bottom clearance (y <= 12), safe!
      return !this.isSliding || this.y > 12;
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

    // Perspective depth scale factor: at player depth z = 100, factor = 1.0
    const factor = 100 / Math.max(10, z);
    // Lowered player anchor to foreground lower-third (0.81 height)
    const playerGroundY = h * 0.81;
    const laneWidth = this.laneWidth || 135;

    const screenX = vanishX + (lane * laneWidth) * factor;
    const screenY = vanishY + (playerGroundY - vanishY) * factor - (y * factor);

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
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.42);
    skyGrad.addColorStop(0, '#04010a');
    skyGrad.addColorStop(0.45, '#120522');
    skyGrad.addColorStop(0.8, '#2b073d');
    skyGrad.addColorStop(1, '#4a0e4e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Twinkling Starfield
    if (this.stars && this.stars.length) {
      this.stars.forEach(s => {
        const twinkle = 0.35 + 0.65 * Math.sin(this.gameTime * s.speed + s.phase);
        ctx.save();
        ctx.fillStyle = s.color;
        ctx.globalAlpha = Math.max(0.1, twinkle);
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    // Neon Cyber Sun on Horizon
    const sunX = w / 2;
    const sunY = h * 0.36;
    const sunRad = Math.min(w, h) * 0.22;

    // Atmospheric Halo Bloom around Sun
    const haloGrad = ctx.createRadialGradient(sunX, sunY, sunRad * 0.2, sunX, sunY, sunRad * 1.6);
    haloGrad.addColorStop(0, 'rgba(255, 0, 127, 0.45)');
    haloGrad.addColorStop(0.5, 'rgba(255, 85, 0, 0.2)');
    haloGrad.addColorStop(1, 'rgba(255, 0, 127, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRad * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // Sliced Synthwave Sun Disc
    const sunGrad = ctx.createLinearGradient(sunX, sunY - sunRad, sunX, sunY + sunRad);
    sunGrad.addColorStop(0, '#ff007f');
    sunGrad.addColorStop(0.35, '#ff3300');
    sunGrad.addColorStop(0.7, '#ff9900');
    sunGrad.addColorStop(1, '#ffe066');

    ctx.save();
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRad, Math.PI, 0); // Upper half
    ctx.fillStyle = sunGrad;
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 28;
    ctx.fill();

    // Synthwave Horizontal Scanlines across lower portion of Sun
    ctx.fillStyle = '#04010a';
    const scanlineStart = sunY - sunRad * 0.65;
    let currY = scanlineStart;
    let gap = 5;
    let lineH = 1.2;
    while (currY < sunY) {
      ctx.fillRect(sunX - sunRad - 6, currY, (sunRad + 6) * 2, lineH);
      currY += gap + lineH;
      gap += 1.4;
      lineH += 0.55;
    }
    ctx.restore();

    // Distant Synthwave Mountain Silhouettes (Framing Sun)
    ctx.save();
    ctx.fillStyle = '#0b0216';
    ctx.strokeStyle = '#ff007f';
    ctx.lineWidth = 1.4;
    ctx.shadowColor = '#ff007f';
    ctx.shadowBlur = 6;

    // Left mountain range
    ctx.beginPath();
    ctx.moveTo(0, sunY);
    ctx.lineTo(w * 0.07, sunY - 22);
    ctx.lineTo(w * 0.15, sunY - 12);
    ctx.lineTo(w * 0.25, sunY - 32);
    ctx.lineTo(w * 0.35, sunY - 14);
    ctx.lineTo(w * 0.43, sunY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right mountain range
    ctx.beginPath();
    ctx.moveTo(w * 0.57, sunY);
    ctx.lineTo(w * 0.65, sunY - 15);
    ctx.lineTo(w * 0.75, sunY - 34);
    ctx.lineTo(w * 0.85, sunY - 16);
    ctx.lineTo(w * 0.93, sunY - 24);
    ctx.lineTo(w, sunY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cyan mountain wireframe ridges
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Left ridges
    ctx.moveTo(w * 0.25, sunY - 32);
    ctx.lineTo(w * 0.21, sunY);
    ctx.moveTo(w * 0.25, sunY - 32);
    ctx.lineTo(w * 0.30, sunY);
    // Right ridges
    ctx.moveTo(w * 0.75, sunY - 34);
    ctx.lineTo(w * 0.71, sunY);
    ctx.moveTo(w * 0.75, sunY - 34);
    ctx.lineTo(w * 0.80, sunY);
    ctx.stroke();
    ctx.restore();

    // Horizon Neon Bloom & Fog
    const horizonHaze = ctx.createLinearGradient(0, sunY - 16, 0, sunY + 20);
    horizonHaze.addColorStop(0, 'rgba(255, 0, 127, 0)');
    horizonHaze.addColorStop(0.5, 'rgba(255, 0, 127, 0.38)');
    horizonHaze.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = horizonHaze;
    ctx.fillRect(0, sunY - 16, w, 36);

    // 2. 3D Perspective Ground Plane
    const groundY = h * 0.36;
    const floorGrad = ctx.createLinearGradient(0, groundY, 0, h);
    floorGrad.addColorStop(0, '#090214');
    floorGrad.addColorStop(0.3, '#110421');
    floorGrad.addColorStop(1, '#05010a');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, groundY, w, h - groundY);

    // Outer Guardrails / Track Boundaries (lanes -1.55 and +1.55)
    [-1.55, 1.55].forEach(side => {
      const topP = this.getScreenPos(side, 3000, 0);
      const botP = this.getScreenPos(side, 25, 0);
      ctx.save();
      ctx.strokeStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(topP.x, topP.y);
      ctx.lineTo(botP.x, botP.y);
      ctx.stroke();
      ctx.restore();
    });

    // Inner Lane Lines (-0.5, 0.5)
    [-0.5, 0.5].forEach(side => {
      const topP = this.getScreenPos(side, 3000, 0);
      const botP = this.getScreenPos(side, 25, 0);
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 6;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(topP.x, topP.y);
      ctx.lineTo(botP.x, botP.y);
      ctx.stroke();
      ctx.restore();
    });

    // Horizontal Moving Perspective Gridlines
    ctx.save();
    for (let z = 25 + (this.groundGridOffset % 40); z < 1500; z += 40) {
      const left = this.getScreenPos(-1.55, z, 0);
      const right = this.getScreenPos(1.55, z, 0);
      const alpha = Math.min(0.65, Math.max(0.08, 120 / z));
      ctx.strokeStyle = `rgba(255, 0, 127, ${alpha})`;
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 6;
      ctx.lineWidth = Math.max(0.8, Math.min(2.5, 80 / z));
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
    }
    ctx.restore();

    // 3. Render Collectibles (Sorted Far to Near)
    this.collectibles.sort((a, b) => b.z - a.z);
    this.collectibles.forEach(item => {
      const p = this.getScreenPos(item.lane, item.z, item.y);
      const size = 26 * p.factor;
      if (size < 2) return;

      ctx.save();
      ctx.translate(p.x, p.y);

      if (item.type === 'coin') {
        // --- 3D ROTATING GOLD PGT TOKEN ---
        const spinAngle = this.gameTime * 4.5 + item.z * 0.03;
        const cosSpin = Math.cos(spinAngle);
        const scaleX = Math.abs(cosSpin);

        ctx.save();
        // Golden outer corona glow
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 14 * p.factor;

        // 3D Rim / Thickness when viewed at an angle
        if (scaleX > 0.12) {
          const rimOffset = (cosSpin >= 0 ? 1 : -1) * (1 - scaleX) * 3.5 * p.factor;
          ctx.fillStyle = '#b8860b';
          ctx.beginPath();
          ctx.ellipse(rimOffset, 0, Math.max(0.8, size * scaleX), size, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Coin Outer Bevel Ring with Metallic Gradient
        const coinGrad = ctx.createLinearGradient(-size * scaleX, -size, size * scaleX, size);
        coinGrad.addColorStop(0, '#ffe875');
        coinGrad.addColorStop(0.3, '#ffd700');
        coinGrad.addColorStop(0.7, '#ff9900');
        coinGrad.addColorStop(1, '#b8860b');

        ctx.fillStyle = coinGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, Math.max(0.8, size * scaleX), size, 0, 0, Math.PI * 2);
        ctx.fill();

        // Inner Recessed Coin Chamber (Embossed look)
        if (scaleX > 0.22) {
          const innerR = size * 0.78;
          const innerGrad = ctx.createRadialGradient(0, 0, innerR * 0.2, 0, 0, innerR);
          innerGrad.addColorStop(0, '#fff4a3');
          innerGrad.addColorStop(0.55, '#ffd700');
          innerGrad.addColorStop(1, '#d48800');

          ctx.fillStyle = innerGrad;
          ctx.beginPath();
          ctx.ellipse(0, 0, Math.max(0.8, innerR * scaleX), innerR, 0, 0, Math.PI * 2);
          ctx.fill();

          // Stylized Embossed PGT 'P'
          ctx.save();
          ctx.scale(scaleX, 1);
          ctx.font = `900 ${Math.max(8, Math.floor(size * 1.15))}px "Segoe UI", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // Emboss shadow
          ctx.fillStyle = '#5c3700';
          ctx.fillText('P', 0.6 * p.factor, 0.6 * p.factor);
          // Highlight
          ctx.fillStyle = '#ffffff';
          ctx.fillText('P', 0, 0);
          ctx.restore();

          // Specular Glint Spark
          const glintPhase = (this.gameTime * 3 + item.z * 0.05) % (Math.PI * 2);
          if (glintPhase < 0.65) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(-size * 0.35 * scaleX, -size * 0.35, 2.5 * p.factor, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();

      } else {
        // --- FACETED CYAN QUANTUM SHARD ---
        const bob = Math.sin(this.gameTime * 6 + item.z * 0.04) * 3 * p.factor;
        const spin = this.gameTime * 3 + item.z * 0.02;
        const scaleX = Math.abs(Math.sin(spin)) * 0.35 + 0.65;

        ctx.save();
        ctx.translate(0, bob);
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 18 * p.factor;

        const w2 = size * 0.85 * scaleX;
        const h2 = size * 1.35;

        // Top-left facet
        ctx.fillStyle = '#bbfaff';
        ctx.beginPath();
        ctx.moveTo(0, -h2);
        ctx.lineTo(-w2, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();

        // Top-right facet (Bright specular shine)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -h2);
        ctx.lineTo(w2, 0);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();

        // Bottom-left facet
        ctx.fillStyle = '#00c8e6';
        ctx.beginPath();
        ctx.moveTo(-w2, 0);
        ctx.lineTo(0, h2);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();

        // Bottom-right facet (Deep neon cyan)
        ctx.fillStyle = '#008ba3';
        ctx.beginPath();
        ctx.moveTo(w2, 0);
        ctx.lineTo(0, h2);
        ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fill();

        // Core glowing energy axis
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4 * p.factor;
        ctx.beginPath();
        ctx.moveTo(0, -h2);
        ctx.lineTo(0, h2);
        ctx.stroke();

        ctx.restore();
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
        // --- LOW ROAD HURDLE (JUMP OVER) ---
        const bH = 28 * factor;
        ctx.save();
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

        // Top Neon Amber Rail
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 10 * factor;
        ctx.fillRect(-baseW / 2, -bH - 3 * factor, baseW, 3 * factor);

        // Clear Jump Indicator
        ctx.fillStyle = '#ffffff';
        ctx.font = `900 ${Math.max(7, Math.floor(9 * factor))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('▲ JUMP ▲', 0, -bH * 0.5);
        ctx.restore();

      } else if (obs.type === 'highLaser') {
        // --- TOWERING OVERHEAD ELECTRIC LASER GATE (SLIDE UNDER) ---
        // Extends all the way from ground clearance (-24) to high overhead (-140)
        const gateTop = -140 * factor;
        const gateBottom = -24 * factor; // Clear opening for sliding underneath
        const gateH = gateBottom - gateTop;
        const pylonW = 10 * factor;
        const pylonLeft = -baseW * 0.65;
        const pylonRight = baseW * 0.65 - pylonW;
        const spanW = baseW * 1.3;

        ctx.save();

        // 1. Heavy Industrial Side Pylons (Ground y=0 up to gateTop)
        ctx.fillStyle = '#180628';
        ctx.shadowColor = '#d000ff';
        ctx.shadowBlur = 12 * factor;
        ctx.fillRect(pylonLeft, gateTop - 6 * factor, pylonW, -gateTop + 6 * factor);
        ctx.fillRect(pylonRight, gateTop - 6 * factor, pylonW, -gateTop + 6 * factor);

        // Pylon Neon Violet Edge Trim
        ctx.strokeStyle = '#d000ff';
        ctx.lineWidth = 1.5 * factor;
        ctx.strokeRect(pylonLeft, gateTop - 6 * factor, pylonW, -gateTop + 6 * factor);
        ctx.strokeRect(pylonRight, gateTop - 6 * factor, pylonW, -gateTop + 6 * factor);

        // Pylon Pulsing Energy Coils
        for (let py = gateTop + 20 * factor; py < 0; py += 30 * factor) {
          ctx.fillStyle = '#ff00ff';
          ctx.shadowColor = '#ff00ff';
          ctx.shadowBlur = 12 * factor;
          ctx.fillRect(pylonLeft - 2 * factor, py, pylonW + 4 * factor, 6 * factor);
          ctx.fillRect(pylonRight - 2 * factor, py, pylonW + 4 * factor, 6 * factor);
        }

        // 2. High-Voltage Electric Forcefield Barrier (Fills from -24 down to -140)
        const fieldGrad = ctx.createLinearGradient(0, gateTop, 0, gateBottom);
        fieldGrad.addColorStop(0, 'rgba(208, 0, 255, 0.45)');
        fieldGrad.addColorStop(0.5, 'rgba(255, 0, 127, 0.35)');
        fieldGrad.addColorStop(1, 'rgba(208, 0, 255, 0.5)');
        ctx.fillStyle = fieldGrad;
        ctx.fillRect(pylonLeft + pylonW, gateTop, spanW - pylonW * 2, gateH);

        // Electric Hazard Grid Mesh
        ctx.strokeStyle = 'rgba(255, 0, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let gx = pylonLeft + pylonW + 15 * factor; gx < pylonRight; gx += 20 * factor) {
          ctx.moveTo(gx, gateTop);
          ctx.lineTo(gx, gateBottom);
        }
        for (let gy = gateTop + 20 * factor; gy < gateBottom; gy += 20 * factor) {
          ctx.moveTo(pylonLeft + pylonW, gy);
          ctx.lineTo(pylonRight, gy);
        }
        ctx.stroke();

        // 3. Glowing Multi-Tier Horizontal Laser Beams
        [-30, -60, -90, -120].forEach(beamLvl => {
          const by = beamLvl * factor;
          ctx.fillStyle = '#ff00ff';
          ctx.shadowColor = '#ff00ff';
          ctx.shadowBlur = 16 * factor;
          ctx.fillRect(pylonLeft + pylonW, by - 2 * factor, spanW - pylonW * 2, 4 * factor);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(pylonLeft + pylonW, by - 1 * factor, spanW - pylonW * 2, 2 * factor);
        });

        // 4. Overhead Warning Bar & Slide Indicator
        ctx.fillStyle = '#2b0945';
        ctx.fillRect(pylonLeft, gateTop - 14 * factor, spanW, 14 * factor);
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 1.5 * factor;
        ctx.strokeRect(pylonLeft, gateTop - 14 * factor, spanW, 14 * factor);

        // Warning Text: ▼ SLIDE UNDER ▼
        ctx.fillStyle = '#ffd700';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 8 * factor;
        ctx.font = `900 ${Math.max(8, Math.floor(10 * factor))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('▼ SLIDE UNDER ▼', 0, gateTop - 7 * factor);

        // 5. Open Bottom Clearance Arrows (Indicating slide gap)
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8 * factor;
        ctx.font = `bold ${Math.max(7, Math.floor(9 * factor))}px sans-serif`;
        ctx.fillText('▼  ▼  ▼', 0, gateBottom + 10 * factor);

        ctx.restore();
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

  drawRoundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, Math.max(0, r));
    } else {
      ctx.rect(x, y, w, h);
    }
  }

  // --- Render Player Character (Cyberpunk Runner) ---
  renderPlayer(ctx) {
    const p = this.getPlayerScreenPos();
    const factor = p.factor;
    const bodyW = 36 * factor;
    const bodyH = (this.isSliding ? 22 : 48) * factor;

    // Ground position for shadow (stays anchored on track below jumping runner)
    const groundP = this.getScreenPos(this.laneX, 100, 0);
    const shadowScale = Math.max(0.3, 1.0 - (this.y / 90));

    // 1. Dynamic Drop Shadow on Ground
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${0.55 * shadowScale})`;
    ctx.beginPath();
    ctx.ellipse(groundP.x, groundP.y, bodyW * 0.85 * shadowScale, 6 * factor * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Runner Character Model
    ctx.save();
    ctx.translate(p.x, p.y);

    // Dynamic Lateral Banking / Leaning into lane changes
    const tilt = (this.targetLane - this.laneX) * 0.18;
    ctx.rotate(tilt);

    // Stride & Run Cycle
    const runFreq = 14 + this.speed * 0.35;
    const isGrounded = !this.isJumping && !this.isSliding;
    const runBob = isGrounded ? Math.sin(this.gameTime * runFreq * 2) * 2.2 * factor : 0;
    const stride = isGrounded ? Math.sin(this.gameTime * runFreq) : 0;

    ctx.translate(0, runBob);

    if (this.isSliding) {
      // --- SLIDING CYBER RUNNER ---
      const slideW = bodyW * 1.5;
      const slideH = 18 * factor;

      // Friction ground sparks
      ctx.save();
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 8;
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(-slideW * 0.5 + Math.random() * slideW, -2 + Math.random() * 3, 4 * factor, 2);
      }
      ctx.restore();

      // Jet exhaust firing backward
      ctx.save();
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(-slideW * 0.45, -slideH * 0.5);
      ctx.lineTo(-slideW * 0.8, -slideH * 0.5);
      ctx.lineTo(-slideW * 0.45, -slideH * 0.2);
      ctx.fill();
      ctx.restore();

      // Cybernetic Streamlined Body Shell
      ctx.save();
      const slideGrad = ctx.createLinearGradient(-slideW / 2, 0, slideW / 2, 0);
      slideGrad.addColorStop(0, '#101426');
      slideGrad.addColorStop(0.5, '#1d2645');
      slideGrad.addColorStop(1, '#00f0ff');
      ctx.fillStyle = slideGrad;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      this.drawRoundRect(ctx, -slideW / 2, -slideH, slideW, slideH, 6 * factor);
      ctx.fill();

      // Front Energy Wedge Skidplate
      ctx.fillStyle = '#ff007f';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(slideW * 0.35, -slideH);
      ctx.lineTo(slideW * 0.55, -slideH * 0.5);
      ctx.lineTo(slideW * 0.35, 0);
      ctx.closePath();
      ctx.fill();

      // Low Visor Glow
      ctx.fillStyle = '#ff007f';
      ctx.fillRect(-slideW * 0.1, -slideH * 0.75, slideW * 0.4, 4 * factor);
      ctx.restore();

    } else {
      // --- STANDING / RUNNING / JUMPING CYBER RUNNER ---

      // 1. Dual Jet Thrusters (Mounted on Back)
      const thrusterW = 6 * factor;
      const thrusterH = 16 * factor;
      const thrusterY = -bodyH * 0.7;

      // Jet nozzles
      ctx.fillStyle = '#1c2136';
      ctx.fillRect(-bodyW * 0.4, thrusterY, thrusterW, thrusterH);
      ctx.fillRect(bodyW * 0.4 - thrusterW, thrusterY, thrusterW, thrusterH);

      // Jet Flames
      if (this.isJumping) {
        // High-energy jumping rocket boost
        const flameLen = (22 + Math.random() * 12) * factor;
        const flameGrad = ctx.createLinearGradient(0, thrusterY + thrusterH, 0, thrusterY + thrusterH + flameLen);
        flameGrad.addColorStop(0, '#ffffff');
        flameGrad.addColorStop(0.3, '#ff0055');
        flameGrad.addColorStop(0.8, '#ff9900');
        flameGrad.addColorStop(1, 'rgba(255, 0, 85, 0)');

        ctx.save();
        ctx.fillStyle = flameGrad;
        ctx.shadowColor = '#ff0055';
        ctx.shadowBlur = 18;

        // Left flame
        ctx.beginPath();
        ctx.moveTo(-bodyW * 0.4, thrusterY + thrusterH);
        ctx.lineTo(-bodyW * 0.4 + thrusterW / 2, thrusterY + thrusterH + flameLen);
        ctx.lineTo(-bodyW * 0.4 + thrusterW, thrusterY + thrusterH);
        ctx.fill();

        // Right flame
        ctx.beginPath();
        ctx.moveTo(bodyW * 0.4 - thrusterW, thrusterY + thrusterH);
        ctx.lineTo(bodyW * 0.4 - thrusterW / 2, thrusterY + thrusterH + flameLen);
        ctx.lineTo(bodyW * 0.4, thrusterY + thrusterH);
        ctx.fill();
        ctx.restore();
      } else {
        // Subtle plasma trail when sprinting
        const flameLen = (7 + Math.sin(this.gameTime * 25) * 3) * factor;
        ctx.save();
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 10;
        ctx.fillRect(-bodyW * 0.4 + 1, thrusterY + thrusterH, thrusterW - 2, flameLen);
        ctx.fillRect(bodyW * 0.4 - thrusterW + 1, thrusterY + thrusterH, thrusterW - 2, flameLen);
        ctx.restore();
      }

      // 2. Articulated Legs & Boots
      const legW = 6.5 * factor;
      const legH = 17 * factor;
      const hipY = -legH;

      if (this.isJumping) {
        // Airborne jump tuck pose: knees bent backward
        ctx.save();
        ctx.fillStyle = '#161b2e';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 1.2 * factor;

        // Left tucked leg
        ctx.beginPath();
        ctx.moveTo(-bodyW * 0.28, hipY);
        ctx.lineTo(-bodyW * 0.4, hipY + legH * 0.5);
        ctx.lineTo(-bodyW * 0.2, hipY + legH * 0.9);
        ctx.stroke();

        // Right tucked leg
        ctx.beginPath();
        ctx.moveTo(bodyW * 0.28, hipY);
        ctx.lineTo(bodyW * 0.4, hipY + legH * 0.5);
        ctx.lineTo(bodyW * 0.2, hipY + legH * 0.9);
        ctx.stroke();

        // Neon cyber boots
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 8;
        ctx.fillRect(-bodyW * 0.32, hipY + legH * 0.85, 8 * factor, 4 * factor);
        ctx.fillRect(bodyW * 0.15, hipY + legH * 0.85, 8 * factor, 4 * factor);
        ctx.restore();
      } else {
        // Running stride pose
        const leftLegOffset = stride * 7 * factor;
        const rightLegOffset = -stride * 7 * factor;

        // Left Leg
        ctx.save();
        ctx.fillStyle = '#181e33';
        ctx.fillRect(-bodyW * 0.32, hipY, legW, legH + leftLegOffset * 0.4);
        // Left cyber boot with neon sole
        ctx.fillStyle = '#2a3454';
        ctx.fillRect(-bodyW * 0.34, hipY + legH + leftLegOffset * 0.4 - 4 * factor, legW + 3 * factor, 4 * factor);
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 6;
        ctx.fillRect(-bodyW * 0.34, hipY + legH + leftLegOffset * 0.4 - 1.5 * factor, legW + 3 * factor, 2 * factor);
        ctx.restore();

        // Right Leg
        ctx.save();
        ctx.fillStyle = '#181e33';
        ctx.fillRect(bodyW * 0.32 - legW, hipY, legW, legH + rightLegOffset * 0.4);
        // Right cyber boot with neon sole
        ctx.fillStyle = '#2a3454';
        ctx.fillRect(bodyW * 0.32 - legW - 1.5 * factor, hipY + legH + rightLegOffset * 0.4 - 4 * factor, legW + 3 * factor, 4 * factor);
        ctx.fillStyle = '#00f0ff';
        ctx.shadowColor = '#00f0ff';
        ctx.shadowBlur = 6;
        ctx.fillRect(bodyW * 0.32 - legW - 1.5 * factor, hipY + legH + rightLegOffset * 0.4 - 1.5 * factor, legW + 3 * factor, 2 * factor);
        ctx.restore();
      }

      // 3. Torso Armor & Cybernetics
      const torsoY = -bodyH * 0.76;
      const torsoH = bodyH * 0.44;
      const torsoW = bodyW * 0.82;

      ctx.save();
      // Dark carbon armor plate
      const torsoGrad = ctx.createLinearGradient(-torsoW / 2, torsoY, torsoW / 2, torsoY + torsoH);
      torsoGrad.addColorStop(0, '#12182b');
      torsoGrad.addColorStop(0.5, '#1e2845');
      torsoGrad.addColorStop(1, '#0e1424');
      ctx.fillStyle = torsoGrad;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      this.drawRoundRect(ctx, -torsoW / 2, torsoY, torsoW, torsoH, 5 * factor);
      ctx.fill();

      // Neon Armor Trim Lines
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1.2 * factor;
      ctx.stroke();

      // Shoulder Pauldrons
      ctx.fillStyle = '#283659';
      ctx.beginPath();
      this.drawRoundRect(ctx, -bodyW * 0.52, torsoY - 2 * factor, 7 * factor, 10 * factor, 2 * factor);
      this.drawRoundRect(ctx, bodyW * 0.52 - 7 * factor, torsoY - 2 * factor, 7 * factor, 10 * factor, 2 * factor);
      ctx.fill();

      // Central PGT Reactor Core
      const coreY = torsoY + torsoH * 0.48;
      const corePulse = 0.8 + 0.2 * Math.sin(this.gameTime * 8);
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 14 * corePulse;
      ctx.beginPath();
      ctx.arc(0, coreY, 5 * factor * corePulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, coreY, 2.5 * factor, 0, Math.PI * 2);
      ctx.fill();

      // PGT Chest Emblem / Glow Circuit
      ctx.strokeStyle = 'rgba(255, 0, 127, 0.7)';
      ctx.lineWidth = 1 * factor;
      ctx.beginPath();
      ctx.moveTo(-torsoW * 0.35, torsoY + 4 * factor);
      ctx.lineTo(0, coreY);
      ctx.lineTo(torsoW * 0.35, torsoY + 4 * factor);
      ctx.stroke();
      ctx.restore();

      // 4. Cyber Helmet & Visor
      const headY = -bodyH * 0.98;
      const headW = bodyW * 0.62;
      const headH = bodyH * 0.26;

      ctx.save();
      // Helmet Silhouette
      ctx.fillStyle = '#0f1424';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      this.drawRoundRect(ctx, -headW / 2, headY, headW, headH, 5 * factor);
      ctx.fill();

      // Helmet Rear Fin / Crest
      ctx.fillStyle = '#1c243d';
      ctx.beginPath();
      ctx.moveTo(-2 * factor, headY - 3 * factor);
      ctx.lineTo(2 * factor, headY - 3 * factor);
      ctx.lineTo(4 * factor, headY);
      ctx.lineTo(-4 * factor, headY);
      ctx.closePath();
      ctx.fill();

      // Glowing Neon Visor (magenta synthwave visor with specular glint)
      const visorW = headW * 0.85;
      const visorH = headH * 0.42;
      const visorY = headY + headH * 0.32;

      ctx.fillStyle = '#ff007f';
      ctx.shadowColor = '#ff007f';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      this.drawRoundRect(ctx, -visorW / 2, visorY, visorW, visorH, 3 * factor);
      ctx.fill();

      // Visor Specular Reflection Streak
      const glintX = Math.sin(this.gameTime * 3) * (visorW * 0.3);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(glintX - 2 * factor, visorY + 1 * factor, 4 * factor, visorH - 2 * factor);

      ctx.restore();
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
