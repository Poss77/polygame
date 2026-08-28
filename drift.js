// ==========================================
// CYBER DRIFT - SYNTHWAVE RACER MINI-GAME
// ==========================================

class CyberDriftGame {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.isRunning = false;

    this.score = 0;
    this.distance = 0;
    this.orbsCollected = 0;
    this.shield = 100;
    this.speed = 0;
    this.maxSpeed = 16;
    this.gameTime = 0;
    this.startTime = 0;

    // Player Car properties
    this.playerX = 0; // -1 (left) to 1 (right)
    this.playerTargetX = 0;
    this.carTilt = 0;
    this.steeringSpeed = 0.045; // Calibrated 1.7x faster mobile steering
    this.lastFrameTime = 0;

    // Cached DOM Elements (Eliminates 60fps DOM thrashing)
    this.scoreEl = null;
    this.distEl = null;
    this.orbsEl = null;
    this.shieldEl = null;
    this.btnNitro = null;
    this.lastScore = -1;
    this.lastDist = -1;
    this.lastKmh = -1;
    this.lastOrbs = -1;
    this.lastShield = -1;
    this.lastNitroSecs = -1;

    // Game Entities
    this.roadOffset = 0;
    this.curveOffset = 0;
    this.targetCurve = 0;
    this.obstacles = [];
    this.orbs = [];
    this.boostPads = [];
    this.particles = [];

    // Inputs
    this.keys = { left: false, right: false, nitro: false };

    // Nitro Boost
    this.nitroTimer = 0;
    this.isNitro = false;

    this.boundResize = () => this.resize();
    window.addEventListener('resize', this.boundResize);
    this.bindEvents();
  }

  init() {
    this.canvas = document.getElementById('drift-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    
    // Cache DOM HUD references once on init
    this.scoreEl = document.getElementById('drift-score-val');
    this.distEl = document.getElementById('drift-dist-val');
    this.orbsEl = document.getElementById('drift-orbs-val');
    this.shieldEl = document.getElementById('drift-shield-bar');
    this.btnNitro = document.getElementById('drift-btn-nitro');

    this.resize();
    this.resetGame();
  }

  resize() {
    if (!this.canvas) return;
    const container = this.canvas.parentElement;
    const rect = container ? container.getBoundingClientRect() : this.canvas.getBoundingClientRect();
    const arcadeAspect = 400 / 640; // Authentic 16:10 arcade ratio

    let w = Math.round(rect.width || 640);
    let h = Math.round(w * arcadeAspect);

    const isFullscreen = document.body.classList.contains('game-fullscreen-open') || document.getElementById('game-window-container')?.classList.contains('fullscreen-active');
    if (isFullscreen) {
      const maxH = Math.round(window.innerHeight * 0.82);
      if (h > maxH) {
        h = maxH;
        w = Math.round(h / arcadeAspect);
      }
    }

    const dpr = Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.5 : 2.0);
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);
    this.width = w;
    this.height = h;
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (!this.isRunning) return;
      const k = e.key.toLowerCase();
      if ([' ', 'spacebar', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k) || [' ', 'Spacebar'].includes(e.key)) {
        e.preventDefault();
      }
      if (document.activeElement && typeof document.activeElement.blur === 'function' && document.activeElement !== document.body) {
        document.activeElement.blur();
      }
      if (e.key === 'ArrowLeft' || k === 'a') this.keys.left = true;
      if (e.key === 'ArrowRight' || k === 'd') this.keys.right = true;
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp' || k === 'w') {
        if (!e.repeat) this.triggerNitro();
        this.keys.nitro = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if ([' ', 'spacebar', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k) || [' ', 'Spacebar'].includes(e.key)) {
        if (this.isRunning) e.preventDefault();
      }
      if (e.key === 'ArrowLeft' || k === 'a') this.keys.left = false;
      if (e.key === 'ArrowRight' || k === 'd') this.keys.right = false;
      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp' || k === 'w') this.keys.nitro = false;
    });

    // Mobile Touch Controls
    const btnLeft = document.getElementById('drift-btn-left');
    const btnRight = document.getElementById('drift-btn-right');
    const btnNitro = document.getElementById('drift-btn-nitro');

    if (btnLeft) {
      btnLeft.addEventListener('touchstart', (e) => { 
        e.preventDefault(); 
        this.playerTargetX = Math.max(-0.85, this.playerTargetX - 0.22);
        this.keys.left = true; 
      });
      btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); this.keys.left = false; });
      btnLeft.addEventListener('touchcancel', (e) => { e.preventDefault(); this.keys.left = false; });
      btnLeft.addEventListener('mousedown', () => { 
        this.playerTargetX = Math.max(-0.85, this.playerTargetX - 0.22);
        this.keys.left = true; 
      });
      btnLeft.addEventListener('mouseup', () => { this.keys.left = false; });
      btnLeft.addEventListener('mouseleave', () => { this.keys.left = false; });
    }

    if (btnRight) {
      btnRight.addEventListener('touchstart', (e) => { 
        e.preventDefault(); 
        this.playerTargetX = Math.min(0.85, this.playerTargetX + 0.22);
        this.keys.right = true; 
      });
      btnRight.addEventListener('touchend', (e) => { e.preventDefault(); this.keys.right = false; });
      btnRight.addEventListener('touchcancel', (e) => { e.preventDefault(); this.keys.right = false; });
      btnRight.addEventListener('mousedown', () => { 
        this.playerTargetX = Math.min(0.85, this.playerTargetX + 0.22);
        this.keys.right = true; 
      });
      btnRight.addEventListener('mouseup', () => { this.keys.right = false; });
      btnRight.addEventListener('mouseleave', () => { this.keys.right = false; });
    }

    if (btnNitro) {
      btnNitro.addEventListener('touchstart', (e) => { e.preventDefault(); this.triggerNitro(); });
      btnNitro.addEventListener('mousedown', () => { this.triggerNitro(); });
    }

    const containerEl = document.getElementById('game-window-container') || this.canvas;

    const handleDriftTouch = (e) => {
      if (!this.isRunning || !e.touches || e.touches.length === 0) return;
      if (e.target.closest('#drift-controls-hud') || e.target.closest('.btn-fullscreen-close') || e.target.closest('button')) return;
      e.preventDefault();
      
      const touchX = e.touches[0].clientX;
      const rect = this.canvas ? this.canvas.getBoundingClientRect() : containerEl.getBoundingClientRect();
      const canvasWidth = rect.width || window.innerWidth;
      const relX = (touchX - rect.left) / canvasWidth;
      
      // Direct 1:1 finger tracking across perspective road coordinates (-0.85 to +0.85)
      const directTarget = Math.max(-0.85, Math.min(0.85, (relX - 0.5) * 1.85));
      this.playerTargetX = directTarget;
      
      if (relX < 0.5) {
        this.keys.left = true;
        this.keys.right = false;
      } else {
        this.keys.right = true;
        this.keys.left = false;
      }
    };

    containerEl.addEventListener('touchstart', handleDriftTouch, { passive: false });
    containerEl.addEventListener('touchmove', handleDriftTouch, { passive: false });
    containerEl.addEventListener('touchend', (e) => {
      if (!this.isRunning) return;
      if (e.target.closest('#drift-controls-hud')) return;
      this.keys.left = false;
      this.keys.right = false;
    });
    containerEl.addEventListener('touchcancel', (e) => {
      if (!this.isRunning) return;
      this.keys.left = false;
      this.keys.right = false;
    });
  }

  triggerNitro() {
    if (this.nitroCooldown <= 0) {
      this.nitroTimer = 120; // 2 seconds super boost
      this.nitroCooldown = 600; // 10 seconds cooldown (600 frames at 60fps)
      this.isNitro = true;
      if (window.sfx && window.sfx.playPowerUp) window.sfx.playPowerUp();
    }
  }

  resetGame() {
    this.score = 0;
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 768);
    this.distance = 0;
    this.orbsCollected = 0;
    this.shield = 100;
    this.minBaseSpeed = this.isMobile ? 3.5 : 6.0;
    this.speed = this.minBaseSpeed;
    this.steeringSpeed = this.isMobile ? 0.075 : 0.048; // High-response rapid mobile steering
    this.playerX = 0;
    this.playerTargetX = 0;
    this.roadOffset = 0;
    this.curveOffset = 0;
    this.targetCurve = 0;
    this.obstacles = [];
    this.orbs = [];
    this.boostPads = [];
    this.particles = [];
    this.popups = [];
    this.nitroTimer = 0;
    this.nitroCooldown = 0;
    this.invincibleTimer = 0; // 2s post-hit invincibility frames (120 frames at 60fps)
    this.isNitro = false;
    this.gameTime = 0;
    this.startTime = Date.now();
    this.lastFrameTime = performance.now();

    // Reset HUD cache state
    this.lastScore = -1;
    this.lastDist = -1;
    this.lastKmh = -1;
    this.lastOrbs = -1;
    this.lastShield = -1;
    this.lastNitroSecs = -1;

    this.updateHUD();
  }

  addPopup(text, color = '#00f0ff') {
    const w = this.width || 600;
    const h = this.height || 400;
    this.popups.push({
      text: text,
      color: color,
      x: w / 2 + (Math.random() - 0.5) * 60,
      y: h - 110,
      alpha: 1.0
    });
  }

  start() {
    this.init();
    this.resetGame();
    this.isRunning = true;
    
    const startScreen = document.getElementById('drift-start-screen');
    const gameoverScreen = document.getElementById('drift-gameover-screen');
    const controlsHud = document.getElementById('drift-controls-hud');
    if (startScreen) startScreen.style.display = 'none';
    if (gameoverScreen) gameoverScreen.style.display = 'none';
    if (controlsHud) controlsHud.style.display = 'flex';

    this.bonusTokensCollected = 0;
    this.sessionId = null;
    if (window.startArcadeSession) {
      window.startArcadeSession('Cyber Drift').then(sid => {
        this.sessionId = sid;
      }).catch(() => {});
    }

    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.lastFrameTime = performance.now();
    this.animationId = requestAnimationFrame((ts) => this.loop(ts));
  }

  loop(timestamp) {
    if (!this.isRunning) return;

    if (this.isPaused) {
      this.lastFrameTime = timestamp || performance.now();
      this.animationId = requestAnimationFrame((ts) => this.loop(ts));
      return;
    }

    const now = timestamp || performance.now();
    const rawDt = this.lastFrameTime ? (now - this.lastFrameTime) / 16.666 : 1.0;
    this.lastFrameTime = now;
    // Bound dt between 0.5 and 2.0 to prevent jumpy physics spikes
    const dt = Math.min(2.0, Math.max(0.5, rawDt));

    this.update(dt);
    this.render();

    this.animationId = requestAnimationFrame((ts) => this.loop(ts));
  }

  update(dt = 1.0) {
    this.gameTime = (Date.now() - this.startTime) / 1000;

    // Handle Steering (1.7x faster on mobile)
    if (this.keys.left) this.playerTargetX -= this.steeringSpeed * dt;
    if (this.keys.right) this.playerTargetX += this.steeringSpeed * dt;

    // Clamp player position
    this.playerTargetX = Math.max(-0.85, Math.min(0.85, this.playerTargetX));
    const lateralSpeed = this.playerTargetX - this.playerX;
    const lerpRate = this.isMobile ? 0.45 : 0.32;
    this.playerX += lateralSpeed * Math.min(1.0, lerpRate * dt);

    // Dynamic 3D banking tilt based on steering lateral velocity
    const targetTilt = Math.max(-0.16, Math.min(0.16, lateralSpeed * 0.55));
    this.carTilt = (this.carTilt || 0) + (targetTilt - (this.carTilt || 0)) * Math.min(1.0, 0.25 * dt);

    // Handle Nitro Cooldown & Invincibility Timer
    if (this.nitroCooldown > 0) this.nitroCooldown -= dt;
    if (this.invincibleTimer > 0) this.invincibleTimer -= dt;

    // Progressive Speed Acceleration Over Time (+1.56 speed every 10s of survival)
    const minBase = this.isMobile ? 3.5 : 6.0;
    const calculatedBase = minBase + (this.gameTime * 0.156);

    const roadBottomWidth = Math.min(this.width * (this.isMobile ? 0.94 : 0.85), this.height * (this.isMobile ? 1.45 : 1.30));
    const roadTopWidth = roadBottomWidth * 0.12;
    const roadTopX = this.width / 2 + this.curveOffset * (roadBottomWidth * 0.18);
    const roadBottomX = this.width / 2;

    const playerP = 0.82;
    const horizonY = this.height * 0.45;
    const playerPy = horizonY + playerP * playerP * (this.height - horizonY);
    const pw = roadTopWidth + playerP * (roadBottomWidth - roadTopWidth);
    const playerPx = (roadTopX + playerP * (roadBottomX - roadTopX)) + this.playerX * (pw * 0.45);

    // Handle Nitro Boost
    if (this.nitroTimer > 0) {
      this.nitroTimer -= dt;
      this.speed = calculatedBase + 12.0;
      this.isNitro = true;
      if (Math.random() < 0.6) {
        this.addParticle(playerPx, playerPy, '#00f0ff');
      }
    } else {
      this.isNitro = false;
      this.speed = calculatedBase;
      // Shoulder friction/drag penalty when riding the far outer edges
      if (Math.abs(this.playerX) > 0.78) {
        this.speed *= 0.82;
      }
    }

    // Update Nitro HUD Button text (Cached & throttled)
    if (this.btnNitro) {
      if (this.nitroCooldown > 0) {
        const secs = Math.ceil(this.nitroCooldown / 60);
        if (this.lastNitroSecs !== secs) {
          this.btnNitro.innerText = `NOS (${secs}s)`;
          this.btnNitro.style.opacity = '0.5';
          this.btnNitro.style.pointerEvents = 'none';
          this.lastNitroSecs = secs;
        }
      } else if (this.lastNitroSecs !== 0) {
        this.btnNitro.innerText = `⚡ NITRO (SPACE)`;
        this.btnNitro.style.opacity = '1.0';
        this.btnNitro.style.pointerEvents = 'auto';
        this.lastNitroSecs = 0;
      }
    }

    // Distance & Score progression
    this.distance += this.speed * 0.1 * dt;
    this.score = Math.floor(this.distance * 10 + this.orbsCollected * 150);

    // Road Animation
    this.roadOffset += this.speed * 0.05 * dt;
    
    // Curving road algorithm
    if (Math.random() < 0.015 * dt) {
      this.targetCurve = (Math.random() - 0.5) * 1.5;
    }
    this.curveOffset += (this.targetCurve - this.curveOffset) * Math.min(1.0, 0.05 * dt);

    // Dynamic Speed-Scaled Traffic Spawning (Prevents road from emptying at high speeds)
    const speedRatio = Math.max(1.0, this.speed / 4.5);
    const obstacleSpawnChance = Math.min(0.095, 0.022 * speedRatio) * dt;
    const pickupSpawnChance = Math.min(0.08, 0.020 * speedRatio) * dt;

    // Spawn Obstacles (Rival Cyber Supercars & Roadside Hazard Posts)
    if (Math.random() < obstacleSpawnChance) {
      const isPylon = Math.random() < 0.28;
      let spawnX;
      let obsType;
      let obsColor;

      if (isPylon) {
        // Roadside Hazard Posts on outer shoulders
        spawnX = Math.random() < 0.5 ? (-0.76 - Math.random() * 0.10) : (0.76 + Math.random() * 0.10);
        obsType = 'pylon';
        obsColor = '#ffaa00';
      } else {
        // Rival Cyber Supercars across the highway lanes
        spawnX = (Math.random() - 0.5) * 1.48;
        const palette = ['#ff0055', '#ffaa00', '#00ff66', '#bd00ff', '#ff3300', '#ffd700', '#38bdf8', '#e11d48'];
        obsColor = palette[Math.floor(Math.random() * palette.length)];
        obsType = 'racer';
      }

      this.obstacles.push({
        x: spawnX,
        z: 1.0,
        speed: 0.008 + Math.random() * 0.005,
        type: obsType,
        color: obsColor
      });
    }

    // Spawn Pickups (Score Orbs: 92%, Nitro: 4%, Shield Repair: 3%, PGT Coin: 0.9%, Quantum Relic: 0.10%)
    if (Math.random() < pickupSpawnChance) {
      const rand = Math.random();
      let type = 'orb';
      let relicMeta = null;

      if (rand < 0.0010) {
        // Quantum Relic Drop (~0.10% / 1 in 1000 pickups)
        type = 'quantum_relic';
        const relicRand = Math.random();
        relicMeta = { id: 'relic_drift_chronometer', name: 'Chrono Chronometer', rarity: 'rare', color: '#00f0ff' };
        if (relicRand < 0.02) {
          relicMeta = Math.random() < 0.5
            ? { id: 'relic_apex_singularity', name: 'Quantum Singularity Core', rarity: 'mythic', color: '#ff0055' }
            : { id: 'relic_apex_genesis', name: 'Genesis Matrix', rarity: 'mythic', color: '#ff0055' };
        } else if (relicRand < 0.15) {
          relicMeta = { id: 'relic_drift_overdrive', name: 'Quantum Overdrive', rarity: 'legendary', color: '#ffd700' };
        } else if (relicRand < 0.50) {
          relicMeta = { id: 'relic_drift_capacitor', name: 'Flux Capacitor', rarity: 'epic', color: '#bd00ff' };
        }
      } else if (rand < 0.01) {
        type = 'pgt_coin';           // 1% chance (Ultra-rare PGT coin)
      } else if (rand < 0.04) {
        type = 'shield_repair';      // 3% chance (Rare Shield Repair)
      } else if (rand < 0.08) {
        type = 'nitro_refill';       // 4% chance (Nitro Canister)
      }

      this.orbs.push({
        x: (Math.random() - 0.5) * 1.5,
        z: 1.0,
        type: type,
        relicMeta: relicMeta
      });
    }

    // Decay Screen Shake
    if (this.screenShake > 0) this.screenShake -= dt;
    // Hitbox depth thresholds aligned with player position at Z = 0.18 (playerP = 0.82)
    const hitZMax = 0.22;
    const hitZMin = 0.14;

    // Update Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      let obs = this.obstacles[i];
      obs.z -= (this.speed * 0.0012 * dt);

      // Check Collision with player
      if (obs.z <= hitZMax && obs.z >= hitZMin) {
        const dx = Math.abs(obs.x - this.playerX);
        const hitLimit = this.isMobile ? 0.175 : 0.165;
        if (dx < hitLimit) {
          const obsPx = (roadTopX + playerP * (roadBottomX - roadTopX)) + obs.x * (pw * 0.45);
          if (this.isNitro) {
            // Invincible nitro smash!
            if (window.sfx && window.sfx.playCoin) window.sfx.playCoin();
            this.addParticleBurst(obsPx, playerPy - 20, '#00f0ff');
            this.addPopup("💥 SMASH! +100", "#00f0ff");
          } else if (this.invincibleTimer <= 0) {
            // Damage + Trigger 2-second Invincibility (120 frames)
            this.shield -= 25;
            this.invincibleTimer = 120;
            this.screenShake = 14;
            if (window.sfx && window.sfx.playError) window.sfx.playError();
            this.addParticleBurst(playerPx, playerPy, '#ff0055');
            this.addPopup("🛡️ RECOVERY SHIELD (2s)", "#00f0ff");
          } else {
            // Currently invincible: obstacle passes through cleanly
            this.obstacles.splice(i, 1);
            continue;
          }
          this.obstacles.splice(i, 1);
          if (this.shield <= 0) {
            this.gameOver();
            return;
          }
          continue;
        }
      }

      if (obs.z <= -0.1) this.obstacles.splice(i, 1);
    }

    // Update Highway Pickups
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      let orb = this.orbs[i];
      orb.z -= (this.speed * 0.0012 * dt);

      // Collect Pickup
      if (orb.z <= hitZMax && orb.z >= hitZMin) {
        const dx = Math.abs(orb.x - this.playerX);
        const collectLimit = this.isMobile ? 0.28 : 0.25;
        if (dx < collectLimit) {
          const orbPx = (roadTopX + playerP * (roadBottomX - roadTopX)) + orb.x * (pw * 0.45);
          if (orb.type === 'quantum_relic' && orb.relicMeta) {
            // 🏺 QUANTUM RELIC HARVEST (+1 In-Game Relic)
            this.score += 1000;
            if (window.sfx && window.sfx.playPowerUp) window.sfx.playPowerUp();
            this.addParticleBurst(orbPx, playerPy, orb.relicMeta.color || '#ffd700');
            if (typeof window.triggerRelicCelebration === 'function') {
              window.triggerRelicCelebration({
                id: orb.relicMeta.id,
                name: orb.relicMeta.name,
                rarity: orb.relicMeta.rarity,
                gameName: 'Cyber Drift',
                image: `metadata/images/relics/${orb.relicMeta.id}.jpg`
              });
            } else {
              if (window.triggerToast) {
                window.triggerToast(`🏺 QUANTUM RELIC HARVESTED! ${orb.relicMeta.name} (+1 In-Game Relic)`, "success");
              }
              if (window.appState && window.appState.state) {
                const currentRelics = { ...(window.appState.state.relics || {}) };
                const prev = currentRelics[orb.relicMeta.id] || { unminted: 0, onchain: 0, total: 0, token_ids: [] };
                currentRelics[orb.relicMeta.id] = {
                  unminted: (prev.unminted || 0) + 1,
                  onchain: prev.onchain || 0,
                  total: (prev.unminted || 0) + 1 + (prev.onchain || 0),
                  token_ids: prev.token_ids || []
                };
                window.appState.update({ relics: currentRelics });
                if (typeof window.renderRelicsVault === 'function') window.renderRelicsVault();
              }
              const sbClient = window.supabaseClient || (window.supabase && typeof window.supabase.rpc === 'function' ? window.supabase : null);
              if (sbClient && window.appState && window.appState.state) {
                const pId = window.appState.state.playerId || window.appState.state.walletAddress;
                if (pId) {
                  sbClient.rpc('grant_relic_drop', {
                    p_player_id: pId,
                    p_relic_id: orb.relicMeta.id,
                    p_amount: 1
                  }).catch(e => console.warn("[Relic Harvest Sync]", e));
                }
              }
            }

          } else if (orb.type === 'shield_repair') {
            // 🛡️ SHIELD REPAIR CELL (+25 Shield)
            this.shield = Math.min(100, this.shield + 25);
            if (window.sfx && window.sfx.playPowerUp) window.sfx.playPowerUp();
            this.addParticleBurst(orbPx, playerPy, '#00ff66');
            if (window.triggerToast) window.triggerToast("🛡️ SHIELD REPAIRED (+25 HP)!", "success");

          } else if (orb.type === 'pgt_coin') {
            // 🪙 PGT BONUS COIN (+5 PGT at game over)
            this.bonusTokensCollected = (this.bonusTokensCollected || 0) + 1;
            if (window.sfx && window.sfx.playCoin) window.sfx.playCoin();
            this.addParticleBurst(orbPx, playerPy, '#ffd700');
            this.addPopup("🪙 +5 PGT BONUS!", "#ffd700");

          } else if (orb.type === 'nitro_refill') {
            // ⚡ INSTANT NITRO REFILL (Refills tank/cooldown for manual player activation)
            this.nitroCooldown = 0;
            if (window.sfx && window.sfx.playPowerUp) window.sfx.playPowerUp();
            this.addParticleBurst(orbPx, playerPy, '#ffee00');
            this.addPopup("⚡ NITRO REFILLED!", "#ffee00");

          } else {
            // Standard Score Orb (+100 Score)
            this.orbsCollected++;
            this.score += 100;
            if (window.sfx && window.sfx.playCoin) window.sfx.playCoin();
            this.addParticleBurst(orbPx, playerPy, '#00f0ff');
            this.addPopup("+100", "#00f0ff");
          }
          this.orbs.splice(i, 1);
          continue;
        }
      }

      if (orb.z <= -0.1) this.orbs.splice(i, 1);
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= 0.03 * dt;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }

    this.updateHUD();
  }

  addParticle(x, y, color) {
    const maxParticles = this.isMobile ? 35 : 75;
    if (this.particles.length >= maxParticles) {
      this.particles.shift();
    }
    this.particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 3 + 2,
      alpha: 1.0,
      color: color,
      size: Math.random() * 4 + 2
    });
  }

  addParticleBurst(x, y, color) {
    const count = this.isMobile ? 8 : 14;
    const maxParticles = this.isMobile ? 35 : 75;
    while (this.particles.length + count > maxParticles && this.particles.length > 0) {
      this.particles.shift();
    }
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        alpha: 1.0,
        color: color,
        size: Math.random() * 6 + 3
      });
    }
  }

  updateHUD() {
    if (this.scoreEl && this.lastScore !== this.score) {
      this.scoreEl.innerText = this.score;
      this.lastScore = this.score;
    }
    const currentKmh = Math.floor(this.speed * 18);
    const distFloor = Math.floor(this.distance);
    if (this.distEl && (this.lastDist !== distFloor || this.lastKmh !== currentKmh)) {
      this.distEl.innerText = `${distFloor}m (${currentKmh} KM/H)`;
      this.lastDist = distFloor;
      this.lastKmh = currentKmh;
    }
    if (this.orbsEl && this.lastOrbs !== this.orbsCollected) {
      this.orbsEl.innerText = this.orbsCollected;
      this.lastOrbs = this.orbsCollected;
    }
    if (this.shieldEl && this.lastShield !== this.shield) {
      this.shieldEl.style.width = `${Math.max(0, this.shield)}%`;
      this.shieldEl.style.backgroundColor = this.shield < 30 ? 'var(--color-danger)' : 'var(--color-primary)';
      this.lastShield = this.shield;
    }
  }

  render() {
    const w = this.width;
    const h = this.height;
    const horizonY = h * 0.45;

    this.ctx.clearRect(0, 0, w, h);

    this.ctx.save();

    // Apply Camera Screen Shake on Impact
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      this.ctx.translate(shakeX, shakeY);
    }

    // 1. Render Synthwave Sky Gradient
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, '#0a0314');
    skyGrad.addColorStop(0.6, '#280c48');
    skyGrad.addColorStop(1, '#691255');
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, w, horizonY);

    // 2. Render Synthwave Sun
    const sunRadius = Math.round(Math.min(w * (this.isMobile ? 0.16 : 0.12), h * (this.isMobile ? 0.20 : 0.15)));
    const sunX = w / 2 + this.curveOffset * 80;
    const sunY = horizonY - 10;
    const sunGrad = this.ctx.createLinearGradient(0, sunY - sunRadius, 0, sunY + sunRadius);
    sunGrad.addColorStop(0, '#ffea00');
    sunGrad.addColorStop(0.5, '#ff007f');
    sunGrad.addColorStop(1, '#7900ff');

    // Outer corona glow
    this.ctx.fillStyle = 'rgba(255, 0, 127, 0.22)';
    this.ctx.beginPath();
    this.ctx.arc(sunX, sunY, sunRadius * 1.25, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = sunGrad;
    this.ctx.fill();

    // Sun Horizontal Cut Lines
    this.ctx.fillStyle = '#280c48';
    for (let i = 0; i < 5; i++) {
      const lineY = sunY + i * (sunRadius * 0.18);
      this.ctx.fillRect(sunX - sunRadius - 5, lineY, sunRadius * 2 + 10, 2 + i * 0.5);
    }

    // 3. Render 3D Perspective Road (Height-calibrated arcade proportions across fullscreen and windowed)
    const roadBottomWidth = Math.min(w * (this.isMobile ? 0.94 : 0.85), h * (this.isMobile ? 1.45 : 1.30));
    const roadTopWidth = roadBottomWidth * 0.12;

    const roadTopX = w / 2 + this.curveOffset * (roadBottomWidth * 0.18);
    const roadBottomX = w / 2;

    this.ctx.fillStyle = '#0f0921';
    this.ctx.beginPath();
    this.ctx.moveTo(roadTopX - roadTopWidth / 2, horizonY);
    this.ctx.lineTo(roadTopX + roadTopWidth / 2, horizonY);
    this.ctx.lineTo(roadBottomX + roadBottomWidth / 2, h);
    this.ctx.lineTo(roadBottomX - roadBottomWidth / 2, h);
    this.ctx.closePath();
    this.ctx.fill();

    // Road Glowing Neon Edges (Layered Alpha Strokes)
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.28)';
    this.ctx.lineWidth = 8;
    this.ctx.beginPath();
    this.ctx.moveTo(roadTopX - roadTopWidth / 2, horizonY);
    this.ctx.lineTo(roadBottomX - roadBottomWidth / 2, h);
    this.ctx.moveTo(roadTopX + roadTopWidth / 2, horizonY);
    this.ctx.lineTo(roadBottomX + roadBottomWidth / 2, h);
    this.ctx.stroke();

    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(roadTopX - roadTopWidth / 2, horizonY);
    this.ctx.lineTo(roadBottomX - roadBottomWidth / 2, h);
    this.ctx.moveTo(roadTopX + roadTopWidth / 2, horizonY);
    this.ctx.lineTo(roadBottomX + roadBottomWidth / 2, h);
    this.ctx.stroke();

    // Perspective Grid Lines
    const numLines = 15;
    this.ctx.strokeStyle = 'rgba(255, 0, 255, 0.38)';
    this.ctx.lineWidth = 1;

    for (let i = 0; i < numLines; i++) {
      let p = (i + (this.roadOffset % 1)) / numLines;
      let py = horizonY + p * p * (h - horizonY);
      let pw = roadTopWidth + p * (roadBottomWidth - roadTopWidth);
      let px = roadTopX + p * (roadBottomX - roadTopX);

      this.ctx.beginPath();
      this.ctx.moveTo(px - pw / 2, py);
      this.ctx.lineTo(px + pw / 2, py);
      this.ctx.stroke();
    }

    // Scaling factors (Sleek rival traffic for open lanes, clear player presence)
    const rivalScale = this.isMobile ? 0.150 : 0.145;
    const playerScale = this.isMobile ? 0.170 : 0.155;

    // 4. Render Highway Pickups (Orbs, Shield Repair Cells, PGT Coins, Nitro Canisters)
    this.orbs.forEach(orb => {
      const p = 1.0 - orb.z;
      if (p < 0 || p > 1) return;
      const py = horizonY + p * p * (h - horizonY);
      const pw = roadTopWidth + p * (roadBottomWidth - roadTopWidth);
      const px = (roadTopX + p * (roadBottomX - roadTopX)) + orb.x * (pw * 0.45);
      const size = Math.max(this.isMobile ? 12 : 7, pw * (this.isMobile ? 0.058 : 0.042));

      if (orb.type === 'quantum_relic') {
        // 🏺 QUANTUM RELIC ARTIFACT (Pulsing Diamond Aura + 3D Horizon Elevation)
        const relicColor = (orb.relicMeta && orb.relicMeta.color) ? orb.relicMeta.color : '#ffd700';
        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.25)';
        this.ctx.beginPath();
        this.ctx.arc(px, py - size * 1.2, size * 1.6, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = relicColor;
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(px, py - size * 1.2, size * 1.2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillStyle = '#000000';
        this.ctx.font = `bold ${Math.max(this.isMobile ? 14 : 10, Math.floor(size * 1.05))}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🏺', px, py - size * 1.2);

      } else if (orb.type === 'shield_repair') {
        // 🛡️ SHIELD REPAIR CELL (Glowing Green Battery Box)
        this.ctx.fillStyle = 'rgba(0, 255, 102, 0.22)';
        this.ctx.fillRect(px - size * 1.0, py - size * 1.6, size * 2.0, size * 1.8);

        this.ctx.fillStyle = '#00ff66';
        this.ctx.fillRect(px - size * 0.8, py - size * 1.4, size * 1.6, size * 1.4);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold ${Math.max(this.isMobile ? 13 : 9, Math.floor(size))}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🛡️', px, py - size * 0.7);

      } else if (orb.type === 'pgt_coin') {
        // 🪙 INSTANT PGT GOLD COIN
        this.ctx.fillStyle = 'rgba(255, 215, 0, 0.24)';
        this.ctx.beginPath();
        this.ctx.arc(px, py - size, size * 1.4, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#ffd700';
        this.ctx.beginPath();
        this.ctx.arc(px, py - size, size * 1.05, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#000000';
        this.ctx.font = `bold ${Math.max(this.isMobile ? 13 : 9, Math.floor(size))}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🪙', px, py - size);

      } else if (orb.type === 'nitro_refill') {
        // ⚡ NITRO REFILL CANISTER
        this.ctx.fillStyle = 'rgba(255, 238, 0, 0.22)';
        this.ctx.beginPath();
        this.ctx.arc(px, py - size, size * 1.35, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#ffee00';
        this.ctx.beginPath();
        this.ctx.arc(px, py - size, size, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#000000';
        this.ctx.font = `bold ${Math.max(this.isMobile ? 13 : 9, Math.floor(size))}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('⚡', px, py - size);

      } else {
        // Standard Score Orb (Cyan Core with Outer Halo)
        this.ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
        this.ctx.beginPath();
        this.ctx.arc(px, py - size, size * 1.35, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#00f0ff';
        this.ctx.beginPath();
        this.ctx.arc(px, py - size, size, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(px, py - size, size * 0.45, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });

    // 5. Render Obstacles (Rival Cyber Supercars & Roadside Hazard Posts)
    this.obstacles.forEach(obs => {
      const p = 1.0 - obs.z;
      if (p < 0 || p > 1) return;
      const py = horizonY + p * p * (h - horizonY);
      const pw = roadTopWidth + p * (roadBottomWidth - roadTopWidth);
      const px = (roadTopX + p * (roadBottomX - roadTopX)) + obs.x * (pw * 0.45);

      if (obs.type === 'pylon') {
        // High-Tech Roadside Hazard Post / Pylon
        const fW = Math.max(this.isMobile ? 13 : 8, pw * (this.isMobile ? 0.075 : 0.055));
        const fH = fW * 1.35;

        // Ground Contact Shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        this.ctx.beginPath();
        this.ctx.ellipse(px, py + 2, fW * 0.6, 4 * p, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // Support Post Body
        this.ctx.fillStyle = '#ffaa00';
        this.ctx.fillRect(px - fW / 2, py - fH, fW, fH);

        // Warning Hazard Chevrons / Stripes
        this.ctx.fillStyle = '#0f051d';
        this.ctx.fillRect(px - fW / 2, py - fH * 0.72, fW, fH * 0.20);
        this.ctx.fillRect(px - fW / 2, py - fH * 0.32, fW, fH * 0.20);

        // Top Pulsing Hazard Beacon
        const strobePulse = Math.sin(Date.now() * 0.012) > 0;
        this.ctx.fillStyle = strobePulse ? '#ffffff' : '#ff0055';
        this.ctx.fillRect(px - fW * 0.35, py - fH - 4 * p, fW * 0.7, 4 * p);
      } else {
        // Rival Cyber Supercar (Proportional to Road Perspective Width)
        const carW = pw * rivalScale;
        const carH = carW * 0.52;
        this.drawCyberSupercar(px, py, carW, carH, obs.color || '#ffaa00', 0, false);
      }
    });

    // 6. Render Particles
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // 7. Render Player Cyber Supercar (Mathematically locked at 82% depth across all viewports)
    const playerP = 0.82;
    const playerPy = horizonY + playerP * playerP * (h - horizonY);
    const pw = roadTopWidth + playerP * (roadBottomWidth - roadTopWidth);
    const playerPx = (roadTopX + playerP * (roadBottomX - roadTopX)) + this.playerX * (pw * 0.45);
    const pCarW = pw * playerScale;
    const pCarH = pCarW * 0.52;

    this.ctx.save();
    if (this.invincibleTimer > 0) {
      this.ctx.globalAlpha = Math.floor(Date.now() / 60) % 2 === 0 ? 0.35 : 1.0;
    }

    const carThemeColor = this.isNitro ? '#00f0ff' : '#ff007f';
    this.drawCyberSupercar(playerPx, playerPy, pCarW, pCarH, carThemeColor, this.carTilt || 0, this.isNitro);

    // Protective Invincibility Shield Aura Ring (Layered Alpha Ring)
    if (this.invincibleTimer > 0) {
      this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      this.ctx.lineWidth = 6;
      this.ctx.beginPath();
      this.ctx.ellipse(playerPx, playerPy - pCarH * 0.5, pCarW * 0.74, pCarH * 0.88, 0, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.strokeStyle = '#00f0ff';
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.ellipse(playerPx, playerPy - pCarH * 0.5, pCarW * 0.72, pCarH * 0.85, 0, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    this.ctx.restore(); // Player car

    // 8. Render Floating Popups (+50 Near Miss, etc.)
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y -= 1.2;
      p.alpha -= 0.02;
      if (p.alpha <= 0) {
        this.popups.splice(i, 1);
        continue;
      }
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.font = '800 16px Outfit, sans-serif';
      this.ctx.fillStyle = p.color;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(p.text, p.x, p.y);
      this.ctx.restore();
    }

    this.ctx.restore(); // Screen shake outer save
  }

  // Render High-Tech Cyber Supercar (Unified model for player & rival traffic with dynamic palette)
  drawCyberSupercar(x, y, w, h, themeColor, tilt = 0, isNitro = false) {
    this.ctx.save();
    this.ctx.translate(x, y);
    if (tilt) this.ctx.rotate(tilt);

    const underglowColor = isNitro ? 'rgba(0, 240, 255, 0.5)' : themeColor + '60';

    // A. Neon Underglow Ground Kit (Layered Alpha Ellipse)
    this.ctx.fillStyle = underglowColor;
    this.ctx.beginPath();
    this.ctx.ellipse(0, 4, w * 0.65, Math.max(3, h * 0.22), 0, 0, Math.PI * 2);
    this.ctx.fill();

    // B. Left & Right Wide Racing Slicks (Tires)
    this.ctx.fillStyle = '#0a0a0f';
    this.ctx.fillRect(-w * 0.54, -h * 0.45, w * 0.14, h * 0.5);
    this.ctx.fillRect(w * 0.40, -h * 0.45, w * 0.14, h * 0.5);

    // C. Aerodynamic Lower Rear Diffuser
    this.ctx.fillStyle = '#120722';
    this.ctx.beginPath();
    this.ctx.moveTo(-w * 0.46, 0);
    this.ctx.lineTo(-w * 0.38, -h * 0.3);
    this.ctx.lineTo(w * 0.38, -h * 0.3);
    this.ctx.lineTo(w * 0.46, 0);
    this.ctx.closePath();
    this.ctx.fill();

    // D. Main Aerodynamic Chassis (Aggressive Wedge Profile)
    const chassisGrad = this.ctx.createLinearGradient(0, -h, 0, 0);
    if (isNitro) {
      chassisGrad.addColorStop(0, '#00f0ff');
      chassisGrad.addColorStop(0.5, '#0284c7');
      chassisGrad.addColorStop(1, '#082f49');
    } else {
      chassisGrad.addColorStop(0, themeColor);
      chassisGrad.addColorStop(0.5, '#7e22ce');
      chassisGrad.addColorStop(1, '#1e0836');
    }

    this.ctx.fillStyle = chassisGrad;
    this.ctx.beginPath();
    this.ctx.moveTo(-w * 0.48, -h * 0.08); // bottom left bumper
    this.ctx.lineTo(-w * 0.46, -h * 0.5);  // left rear fender
    this.ctx.lineTo(-w * 0.30, -h * 0.95); // left roofline
    this.ctx.lineTo(w * 0.30, -h * 0.95);  // right roofline
    this.ctx.lineTo(w * 0.46, -h * 0.5);   // right rear fender
    this.ctx.lineTo(w * 0.48, -h * 0.08);  // bottom right bumper
    this.ctx.closePath();
    this.ctx.fill();

    // E. Sleek Darkened Fastback Rear Window with Cyber Louvers
    this.ctx.fillStyle = '#05020a';
    this.ctx.beginPath();
    this.ctx.moveTo(-w * 0.26, -h * 0.88);
    this.ctx.lineTo(w * 0.26, -h * 0.88);
    this.ctx.lineTo(w * 0.34, -h * 0.52);
    this.ctx.lineTo(-w * 0.34, -h * 0.52);
    this.ctx.closePath();
    this.ctx.fill();

    // Cyber Window Slats / Louvers
    this.ctx.strokeStyle = isNitro ? 'rgba(0, 240, 255, 0.45)' : 'rgba(255, 255, 255, 0.4)';
    this.ctx.lineWidth = Math.max(1, w * 0.02);
    for (let l = 1; l <= 3; l++) {
      const ly = -h * (0.88 - l * 0.09);
      const lw = w * (0.26 + l * 0.02);
      this.ctx.beginPath();
      this.ctx.moveTo(-lw, ly);
      this.ctx.lineTo(lw, ly);
      this.ctx.stroke();
    }

    // F. Full-Width Cyberpunk LED Lightbar (Layered Neon Tail Glow)
    this.ctx.fillStyle = isNitro ? 'rgba(0, 240, 255, 0.4)' : themeColor + '50';
    this.ctx.fillRect(-w * 0.44, -h * 0.38, w * 0.88, Math.max(2.5, h * 0.16));
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(-w * 0.40, -h * 0.35, w * 0.80, Math.max(1.8, h * 0.10));
    this.ctx.fillStyle = isNitro ? '#38bdf8' : themeColor;
    this.ctx.fillRect(-w * 0.38, -h * 0.34, w * 0.20, Math.max(1.2, h * 0.08));
    this.ctx.fillRect(w * 0.18, -h * 0.34, w * 0.20, Math.max(1.2, h * 0.08));

    // G. Rear GT Wing / Aero Spoiler with Neon Endplates
    this.ctx.fillStyle = '#0f051d';
    this.ctx.strokeStyle = themeColor;
    this.ctx.lineWidth = Math.max(1, w * 0.022);
    this.ctx.fillRect(-w * 0.44, -h * 1.05, w * 0.88, Math.max(1.8, h * 0.12));
    this.ctx.strokeRect(-w * 0.44, -h * 1.05, w * 0.88, Math.max(1.8, h * 0.12));
    this.ctx.fillStyle = '#1a0d33';
    this.ctx.fillRect(-w * 0.22, -h * 1.02, Math.max(2, w * 0.04), h * 0.12);
    this.ctx.fillRect(w * 0.22 - Math.max(2, w * 0.04), -h * 1.02, Math.max(2, w * 0.04), h * 0.12);

    // H. Dual Exhaust Jets with Dynamic Flame Plumes
    const flameBaseY = -h * 0.08;
    const flameLength = isNitro ? (18 + Math.random() * 10) : (4 + Math.random() * 4) * (w / 60);
    const flameColor = isNitro ? '#00f0ff' : '#ffaa00';

    this.ctx.fillStyle = flameColor;
    this.ctx.beginPath();
    this.ctx.moveTo(-w * 0.26, flameBaseY);
    this.ctx.lineTo(-w * 0.21, flameBaseY);
    this.ctx.lineTo(-w * 0.235, flameBaseY + flameLength);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.moveTo(w * 0.21, flameBaseY);
    this.ctx.lineTo(w * 0.26, flameBaseY);
    this.ctx.lineTo(w * 0.235, flameBaseY + flameLength);
    this.ctx.closePath();
    this.ctx.fill();

    if (isNitro) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(-w * 0.25, flameBaseY, Math.max(1.5, w * 0.04), flameLength * 0.6);
      this.ctx.fillRect(w * 0.22, flameBaseY, Math.max(1.5, w * 0.04), flameLength * 0.6);
    }

    this.ctx.restore();
  }

  async gameOver() {
    if (window.trackQuestProgress) window.trackQuestProgress('games', 1);
    this.isRunning = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);

    const multis = window.appState ? window.appState.getMultipliers() : null;
    const nftPct = multis ? (multis.nftGameMultiplier || 0) : 0;
    const nftMult = 1 + (nftPct / 100);
    const isVip = window.appState && typeof window.appState.isVipActive === 'function' && window.appState.isVipActive();
    const vipMult = isVip ? 2.0 : 1.0;
    const isAmb = window.appState && window.appState.state && window.appState.state.isAmbassador;
    const ambMult = isAmb ? 2.0 : 1.0;
    const relicMult = (multis && multis.isApexUnlocked) ? 1.5 : 1.0;
    const playerMult = nftMult * vipMult * ambMult * relicMult;

    const cleanScore = Math.floor(this.score || 0);
    const rawBase = (cleanScore / 2500.0) + (this.orbsCollected * 0.04);
    const calculatedPgt = parseFloat((rawBase * playerMult).toFixed(2));
    const tokenPgt = (this.bonusTokensCollected || 0) * 5.0;
    const finalPgt = cleanScore > 0 ? Math.max(0.01, parseFloat((calculatedPgt + tokenPgt).toFixed(2))) : 0;

    const isPlayerConnected = (window.appState && typeof window.appState.isPlayerConnected === 'function') ? window.appState.isPlayerConnected() : false;
    let verifiedPgt = this.sessionId ? finalPgt : (isPlayerConnected ? 0.0 : finalPgt);
    if (window.endArcadeSession && this.sessionId) {
      const res = await window.endArcadeSession(this.sessionId, cleanScore, this.orbsCollected, this.bonusTokensCollected || 0, nftMult);
      if (res && (res.payout !== undefined || res.payout_pgt !== undefined || res.success)) {
        verifiedPgt = parseFloat(res.payout !== undefined ? res.payout : (res.payout_pgt !== undefined ? res.payout_pgt : 0));
      }
    }

    const gameoverScreen = document.getElementById('drift-gameover-screen');
    const finalScoreEl = document.getElementById('drift-final-score');
    const finalPgtEl = document.getElementById('drift-final-pgt');
    const multBreakdownEl = document.getElementById('drift-mult-breakdown');
    const highscoreText = document.getElementById('drift-highscore-text');

    const gamePgt = Math.max(0, verifiedPgt - tokenPgt);
    const maxPlays = (window.appState && window.appState.state && window.appState.state.maxDailyPlaysPerGame) ? window.appState.state.maxDailyPlaysPerGame : 35;
    let payoutDisplay = `+${verifiedPgt.toFixed(2)} PGT`;
    if (isPlayerConnected && !this.sessionId && cleanScore > 0) {
      payoutDisplay = `+0.00 PGT <span style="display:block; color:var(--color-warning); font-size:0.75rem; margin-top:2px;">⚠️ Daily Limit (${maxPlays}/${maxPlays} plays) • Rewards Paused</span>`;
    } else if (tokenPgt > 0 && verifiedPgt > 0) {
      payoutDisplay = `+${gamePgt.toFixed(2)} PGT <span style="color:var(--color-warning); font-size:0.9em; font-weight:700;">+ ${tokenPgt.toFixed(0)} PGT Bonus</span>`;
    }

    if (finalScoreEl) finalScoreEl.innerText = cleanScore;
    if (finalPgtEl) finalPgtEl.innerHTML = payoutDisplay;
    const vipBadgeStr = (isVip ? ' 🔥 <span style="color:var(--color-warning); font-size:0.8rem;">(VIP 2.0x)</span>' : '') + 
      (isAmb ? ' 🎖️ <span style="color:var(--color-warning); font-size:0.8rem;">(Ambassador 2.0x)</span>' : '') +
      (multis && multis.isApexUnlocked ? ' 🏺 <span style="color:#ffd700; font-size:0.8rem;">(Relics 1.5x)</span>' : '');
    if (multBreakdownEl) multBreakdownEl.innerHTML = `Base: ${rawBase.toFixed(2)} PGT • Multiplier: <strong style="color:var(--color-secondary);">${playerMult.toFixed(1)}x</strong> (${nftPct}% NFT${vipBadgeStr})`;

    let currentHigh = (window.appState && window.appState.state) ? (window.appState.state.driftHighScore || 0) : 0;
    const isNewHigh = cleanScore > currentHigh;
    if (isNewHigh && window.appState) {
      window.appState.update({ driftHighScore: cleanScore });
      if (highscoreText) highscoreText.style.display = 'block';
    } else {
      if (highscoreText) highscoreText.style.display = 'none';
    }

    if (window.submitHighScoreToDB && cleanScore > 0) {
      window.submitHighScoreToDB('drift', cleanScore);
    }

    if (window.appState && window.appState.addActivity) {
      window.appState.addActivity('You', `drifted ${Math.floor(this.distance)}m in Cyber Drift`, `+${verifiedPgt.toFixed(2)} PGT`);
    }

    if (gameoverScreen) gameoverScreen.style.display = 'flex';
    const controlsHud = document.getElementById('drift-controls-hud');
    if (controlsHud) controlsHud.style.display = 'none';
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.resetGame();
    const startScreen = document.getElementById('drift-start-screen');
    const gameoverScreen = document.getElementById('drift-gameover-screen');
    const controlsHud = document.getElementById('drift-controls-hud');
    if (startScreen) startScreen.style.display = 'flex';
    if (gameoverScreen) gameoverScreen.style.display = 'none';
    if (controlsHud) controlsHud.style.display = 'none';
  }
}

// Global instance initialization
window.cyberDrift = new CyberDriftGame();

window.startCyberDrift = function() {
  window.cyberDrift.start();
};

window.stopCyberDrift = function() {
  if (window.cyberDrift) window.cyberDrift.stop();
};
