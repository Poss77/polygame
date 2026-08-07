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
    this.steeringSpeed = 0.04;

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

    this.bindEvents();
  }

  init() {
    this.canvas = document.getElementById('drift-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = (rect.width || 600) * dpr;
    this.canvas.height = (rect.height || 400) * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width || 600;
    this.height = rect.height || 400;

    this.resetGame();
  }

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (!this.isRunning) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = true;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        if (!e.repeat) this.triggerNitro();
        this.keys.nitro = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.keys.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.keys.right = false;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.keys.nitro = false;
    });

    // Mobile Touch Controls
    const btnLeft = document.getElementById('drift-btn-left');
    const btnRight = document.getElementById('drift-btn-right');
    const btnNitro = document.getElementById('drift-btn-nitro');

    if (btnLeft) {
      btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys.left = true; });
      btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); this.keys.left = false; });
      btnLeft.addEventListener('mousedown', () => { this.keys.left = true; });
      btnLeft.addEventListener('mouseup', () => { this.keys.left = false; });
    }

    if (btnRight) {
      btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); this.keys.right = true; });
      btnRight.addEventListener('touchend', (e) => { e.preventDefault(); this.keys.right = false; });
      btnRight.addEventListener('mousedown', () => { this.keys.right = true; });
      btnRight.addEventListener('mouseup', () => { this.keys.right = false; });
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
      const screenWidth = window.innerWidth;
      
      if (touchX < screenWidth / 2) {
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
    this.score = 0;
    this.distance = 0;
    this.orbsCollected = 0;
    this.shield = 100;
    this.minBaseSpeed = this.isMobile ? 5.0 : 6.0;
    this.speed = this.minBaseSpeed;
    this.steeringSpeed = this.isMobile ? 0.055 : 0.045;
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
    this.isNitro = false;
    this.gameTime = 0;
    this.startTime = Date.now();

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
    
    document.getElementById('drift-start-screen').style.display = 'none';
    document.getElementById('drift-gameover-screen').style.display = 'none';
    document.getElementById('drift-controls-hud').style.display = 'flex';

    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.loop();
  }

  loop() {
    if (!this.isRunning) return;

    this.update();
    this.render();

    this.animationId = requestAnimationFrame(() => this.loop());
  }

  update() {
    this.gameTime = (Date.now() - this.startTime) / 1000;

    // Handle Steering
    if (this.keys.left) this.playerTargetX -= this.steeringSpeed;
    if (this.keys.right) this.playerTargetX += this.steeringSpeed;

    // Clamp player position
    this.playerTargetX = Math.max(-0.85, Math.min(0.85, this.playerTargetX));
    this.playerX += (this.playerTargetX - this.playerX) * 0.2;

    // Handle Nitro Cooldown
    if (this.nitroCooldown > 0) {
      this.nitroCooldown--;
    }

    // Uncapped Progressive Speed Acceleration Over Time (+1.2 speed every 10s of survival)
    const minBase = this.isMobile ? 5.0 : 6.0;
    const calculatedBase = minBase + (this.gameTime * 0.12);

    // Handle Nitro Boost
    if (this.nitroTimer > 0) {
      this.nitroTimer--;
      this.speed = calculatedBase + 12.0;
      this.isNitro = true;
      // Add exhaust particles
      if (Math.random() < 0.6) {
        const pOffsetY = (this.isMobile || window.innerWidth <= 768) ? 115 : 55;
        this.addParticle(this.width / 2 + this.playerX * (this.width * 0.35), this.height - pOffsetY, '#00f0ff');
      }
    } else {
      this.isNitro = false;
      this.speed = calculatedBase;
    }

    // Update Nitro HUD Button text and cooldown state
    const btnNitro = document.getElementById('drift-btn-nitro');
    if (btnNitro) {
      if (this.nitroCooldown > 0) {
        const secs = Math.ceil(this.nitroCooldown / 60);
        btnNitro.innerText = `NOS (${secs}s)`;
        btnNitro.style.opacity = '0.5';
        btnNitro.style.pointerEvents = 'none';
      } else {
        btnNitro.innerText = `⚡ NITRO (SPACE)`;
        btnNitro.style.opacity = '1.0';
        btnNitro.style.pointerEvents = 'auto';
      }
    }

    // Distance & Score progression
    this.distance += this.speed * 0.1;
    this.score = Math.floor(this.distance * 10 + this.orbsCollected * 150);

    // Road Animation
    this.roadOffset += this.speed * 0.05;
    
    // Curving road algorithm
    if (Math.random() < 0.015) {
      this.targetCurve = (Math.random() - 0.5) * 1.5;
    }
    this.curveOffset += (this.targetCurve - this.curveOffset) * 0.05;

    // Spawn Obstacles (Cyber Cars)
    if (Math.random() < 0.025) {
      this.obstacles.push({
        x: (Math.random() - 0.5) * 1.4,
        z: 1.0, // Distance away (1.0 = horizon, 0.0 = player)
        speed: 0.008 + Math.random() * 0.005,
        type: Math.random() < 0.5 ? 'truck' : 'racer',
        color: Math.random() < 0.5 ? '#ff0055' : '#ff00ff'
      });
    }

    // Spawn Pickups (Score Orbs: 92%, Nitro: 4%, Shield Repair: 3%, PGT Coin: 1%)
    if (Math.random() < 0.025) {
      const rand = Math.random();
      let type = 'orb';
      if (rand < 0.01) type = 'pgt_coin';           // 1% chance (Ultra-rare PGT coin)
      else if (rand < 0.04) type = 'shield_repair';  // 3% chance (Rare Shield Repair)
      else if (rand < 0.08) type = 'nitro_refill';   // 4% chance (Nitro Canister)

      this.orbs.push({
        x: (Math.random() - 0.5) * 1.5,
        z: 1.0,
        type: type
      });
    }

    // Decay Screen Shake
    if (this.screenShake > 0) this.screenShake -= 1;

    // Hitbox depth thresholds (aligned with player car position)
    const hitZMax = (this.isMobile || window.innerWidth <= 768) ? 0.28 : 0.16;
    const hitZMin = (this.isMobile || window.innerWidth <= 768) ? 0.10 : 0.00;

    // Update Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      let obs = this.obstacles[i];
      obs.z -= (this.speed * 0.0012);

      // Check Collision with player
      if (obs.z <= hitZMax && obs.z >= hitZMin) {
        const dx = Math.abs(obs.x - this.playerX);
        if (dx < 0.22) {
          const pOffsetY = (this.isMobile || window.innerWidth <= 768) ? 115 : 55;
          if (!this.isNitro) {
            this.shield -= 25;
            this.screenShake = 14; // Trigger impact screen shake
            if (window.sfx && window.sfx.playError) window.sfx.playError();
            this.addParticleBurst(this.width / 2 + this.playerX * (this.width * 0.35), this.height - pOffsetY, '#ff0055');
          } else {
            // Invincible nitro smash!
            if (window.sfx && window.sfx.playCoin) window.sfx.playCoin();
            this.addParticleBurst(this.width / 2 + obs.x * (this.width * 0.35), this.height - pOffsetY - 30, '#00f0ff');
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
      orb.z -= (this.speed * 0.0012);

      // Collect Pickup
      if (orb.z <= hitZMax && orb.z >= hitZMin) {
        const dx = Math.abs(orb.x - this.playerX);
        if (dx < 0.25) {
          const pOffsetY = (this.isMobile || window.innerWidth <= 768) ? 115 : 55;
          if (orb.type === 'shield_repair') {
            // 🛡️ SHIELD REPAIR CELL (+25 Shield)
            this.shield = Math.min(100, this.shield + 25);
            if (window.sfx && window.sfx.playPowerUp) window.sfx.playPowerUp();
            this.addParticleBurst(this.width / 2 + orb.x * (this.width * 0.35), this.height - pOffsetY, '#00ff66');
            if (window.triggerToast) window.triggerToast("🛡️ SHIELD REPAIRED (+25 HP)!", "success");

          } else if (orb.type === 'pgt_coin') {
            // 🪙 INSTANT PGT COIN (+5 PGT)
            if (window.creditArcadePayout) window.creditArcadePayout(5);
            if (window.sfx && window.sfx.playCoin) window.sfx.playCoin();
            this.addParticleBurst(this.width / 2 + orb.x * (this.width * 0.35), this.height - pOffsetY, '#ffd700');
            if (window.triggerToast) window.triggerToast("🪙 +5 PGT INSTANT PAYOUT!", "warning");

          } else if (orb.type === 'nitro_refill') {
            // ⚡ NITRO REFILL CANISTER - Resets NOS cooldown so Nitro is ready on Spacebar!
            this.nitroCooldown = 0;
            if (window.sfx && window.sfx.playPowerUp) window.sfx.playPowerUp();
            this.addParticleBurst(this.width / 2 + orb.x * (this.width * 0.35), this.height - pOffsetY, '#ffee00');
            this.addPopup("⚡ NOS READY! PRESS SPACE", "#ffee00");
            if (window.triggerToast) window.triggerToast("⚡ NOS RECHARGED! Press SPACEBAR to Boost!", "success");

          } else {
            // Standard Score Orb
            this.orbsCollected++;
            if (window.sfx && window.sfx.playCoin) window.sfx.playCoin();
            this.addParticleBurst(this.width / 2 + orb.x * (this.width * 0.35), this.height - pOffsetY, '#00f0ff');
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
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.03;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }

    this.updateHUD();
  }

  addParticle(x, y, color) {
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
    for (let i = 0; i < 15; i++) {
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
    const scoreEl = document.getElementById('drift-score-val');
    const distEl = document.getElementById('drift-dist-val');
    const orbsEl = document.getElementById('drift-orbs-val');
    const shieldEl = document.getElementById('drift-shield-bar');

    if (scoreEl) scoreEl.innerText = this.score;
    const currentKmh = Math.floor(this.speed * 18);
    if (distEl) distEl.innerText = `${Math.floor(this.distance)}m (${currentKmh} KM/H)`;
    if (orbsEl) orbsEl.innerText = this.orbsCollected;
    if (shieldEl) {
      shieldEl.style.width = `${Math.max(0, this.shield)}%`;
      shieldEl.style.backgroundColor = this.shield < 30 ? 'var(--color-danger)' : 'var(--color-primary)';
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
    const sunRadius = 45;
    const sunX = w / 2 + this.curveOffset * 80;
    const sunY = horizonY - 10;
    const sunGrad = this.ctx.createLinearGradient(0, sunY - sunRadius, 0, sunY + sunRadius);
    sunGrad.addColorStop(0, '#ffea00');
    sunGrad.addColorStop(0.5, '#ff007f');
    sunGrad.addColorStop(1, '#7900ff');

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = sunGrad;
    this.ctx.shadowColor = '#ff007f';
    this.ctx.shadowBlur = 25;
    this.ctx.fill();
    this.ctx.restore();

    // Sun Horizontal Cut Lines
    this.ctx.fillStyle = '#280c48';
    for (let i = 0; i < 5; i++) {
      const lineY = sunY + i * 8;
      this.ctx.fillRect(sunX - sunRadius - 5, lineY, sunRadius * 2 + 10, 2 + i * 0.5);
    }

    // 3. Render 3D Perspective Road
    const roadTopWidth = 60;
    const roadBottomWidth = w * 0.85;

    const roadTopX = w / 2 + this.curveOffset * 100;
    const roadBottomX = w / 2;

    this.ctx.fillStyle = '#0f0921';
    this.ctx.beginPath();
    this.ctx.moveTo(roadTopX - roadTopWidth / 2, horizonY);
    this.ctx.lineTo(roadTopX + roadTopWidth / 2, horizonY);
    this.ctx.lineTo(roadBottomX + roadBottomWidth / 2, h);
    this.ctx.lineTo(roadBottomX - roadBottomWidth / 2, h);
    this.ctx.closePath();
    this.ctx.fill();

    // Road Glowing Neon Edges
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 4;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 10;

    // Left Edge
    this.ctx.beginPath();
    this.ctx.moveTo(roadTopX - roadTopWidth / 2, horizonY);
    this.ctx.lineTo(roadBottomX - roadBottomWidth / 2, h);
    this.ctx.stroke();

    // Right Edge
    this.ctx.beginPath();
    this.ctx.moveTo(roadTopX + roadTopWidth / 2, horizonY);
    this.ctx.lineTo(roadBottomX + roadBottomWidth / 2, h);
    this.ctx.stroke();

    // Perspective Grid Lines
    const numLines = 15;
    this.ctx.strokeStyle = 'rgba(255, 0, 255, 0.4)';
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

    // 4. Render Highway Pickups (Orbs, Shield Repair Cells, PGT Coins, Nitro Canisters)
    this.orbs.forEach(orb => {
      const p = 1.0 - orb.z;
      if (p < 0 || p > 1) return;
      const py = horizonY + p * p * (h - horizonY);
      const pw = roadTopWidth + p * (roadBottomWidth - roadTopWidth);
      const px = (roadTopX + p * (roadBottomX - roadTopX)) + orb.x * (pw * 0.45);
      const size = 6 + p * 18;

      this.ctx.save();
      
      if (orb.type === 'shield_repair') {
        // 🛡️ SHIELD REPAIR CELL (Glowing Green Battery Box)
        this.ctx.fillStyle = '#00ff66';
        this.ctx.shadowColor = '#00ff66';
        this.ctx.shadowBlur = 18;
        
        this.ctx.fillRect(px - size * 0.8, py - size * 1.4, size * 1.6, size * 1.4);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `bold ${Math.max(9, Math.floor(size))}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🛡️', px, py - size * 0.7);

      } else if (orb.type === 'pgt_coin') {
        // 🪙 INSTANT PGT GOLD COIN
        this.ctx.fillStyle = '#ffd700';
        this.ctx.shadowColor = '#ffd700';
        this.ctx.shadowBlur = 20;

        this.ctx.beginPath();
        this.ctx.arc(px, py - size, size * 1.1, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#000000';
        this.ctx.font = `bold ${Math.max(9, Math.floor(size))}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🪙', px, py - size);

      } else if (orb.type === 'nitro_refill') {
        // ⚡ NITRO REFILL CANISTER
        this.ctx.fillStyle = '#ffee00';
        this.ctx.shadowColor = '#ffee00';
        this.ctx.shadowBlur = 18;

        this.ctx.beginPath();
        this.ctx.arc(px, py - size, size, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#000000';
        this.ctx.font = `bold ${Math.max(9, Math.floor(size))}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('⚡', px, py - size);

      } else {
        // Standard Score Orb (Cyan Core)
        this.ctx.beginPath();
        this.ctx.arc(px, py - size, size, 0, Math.PI * 2);
        this.ctx.fillStyle = '#00f0ff';
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.shadowBlur = 15;
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(px, py - size, size * 0.5, 0, Math.PI * 2);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fill();
      }

      this.ctx.restore();
    });

    // 5. Render Obstacle Vehicles
    this.obstacles.forEach(obs => {
      const p = 1.0 - obs.z;
      if (p < 0 || p > 1) return;
      const py = horizonY + p * p * (h - horizonY);
      const pw = roadTopWidth + p * (roadBottomWidth - roadTopWidth);
      const px = (roadTopX + p * (roadBottomX - roadTopX)) + obs.x * (pw * 0.45);
      const carW = 12 + p * 36;
      const carH = 8 + p * 24;

      this.ctx.save();
      this.ctx.fillStyle = obs.color;
      this.ctx.shadowColor = obs.color;
      this.ctx.shadowBlur = 12;
      this.ctx.fillRect(px - carW / 2, py - carH, carW, carH);

      // Tail lights
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(px - carW * 0.4, py - carH * 0.4, carW * 0.2, carH * 0.2);
      this.ctx.fillRect(px + carW * 0.2, py - carH * 0.4, carW * 0.2, carH * 0.2);
      this.ctx.restore();
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

    // 7. Render Player Cyber Car (Elevated on mobile so control buttons never obstruct car)
    const playerOffsetY = (this.isMobile || window.innerWidth <= 768) ? 115 : 55;
    const playerPy = h - playerOffsetY;
    const playerPx = w / 2 + this.playerX * (roadBottomWidth * 0.42);
    const pCarW = 54;
    const pCarH = 28;

    this.ctx.save();
    const carColor = this.isNitro ? '#00f0ff' : '#ff00ff';
    this.ctx.fillStyle = carColor;
    this.ctx.shadowColor = carColor;
    this.ctx.shadowBlur = this.isNitro ? 25 : 15;

    // Chassis polygon
    this.ctx.beginPath();
    this.ctx.moveTo(playerPx - pCarW / 2, playerPy);
    this.ctx.lineTo(playerPx - pCarW * 0.35, playerPy - pCarH);
    this.ctx.lineTo(playerPx + pCarW * 0.35, playerPy - pCarH);
    this.ctx.lineTo(playerPx + pCarW / 2, playerPy);
    this.ctx.closePath();
    this.ctx.fill();

    // Windshield
    this.ctx.fillStyle = '#0a0314';
    this.ctx.fillRect(playerPx - pCarW * 0.25, playerPy - pCarH * 0.8, pCarW * 0.5, pCarH * 0.4);

    // Glowing Neon Tail Strip
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 10;
    this.ctx.fillRect(playerPx - pCarW * 0.4, playerPy - pCarH * 0.2, pCarW * 0.8, 4);

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
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 10;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(p.text, p.x, p.y);
      this.ctx.restore();
    }

    this.ctx.restore(); // Screen shake outer save
  }

  async gameOver() {
    if (window.trackQuestProgress) window.trackQuestProgress('games', 1);
    this.isRunning = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);

    document.body.classList.remove('game-fullscreen-open');
    if (typeof window.exitGameFullscreen === 'function') window.exitGameFullscreen();

    const multis = window.appState ? window.appState.getMultipliers() : null;
    const nftPct = multis ? multis.nftGameMultiplier || 0 : 0;
    const nftMult = 1 + (nftPct / 100);
    const isVip = window.appState && typeof window.appState.isVipActive === 'function' && window.appState.isVipActive();
    const vipMult = isVip ? 2.0 : 1.0;
    const isAmb = window.appState && window.appState.state.isAmbassador;
    const ambMult = isAmb ? 2.0 : 1.0;
    const globalMult = (window.appState && window.appState.state) ? (window.appState.state.globalEarnMultiplier || 1.0) : 1.0;
    const visibleMult = nftMult * vipMult * ambMult;

    const cleanScore = Math.floor(this.score || 0);
    const basePgt = ((cleanScore / 3000) + (this.orbsCollected * 0.025)) * globalMult;
    const calculatedPgt = parseFloat((basePgt * visibleMult).toFixed(2));
    const finalPgt = cleanScore > 0 ? Math.max(0.01, calculatedPgt) : 0;

    const gameoverScreen = document.getElementById('drift-gameover-screen');
    const finalScoreEl = document.getElementById('drift-final-score');
    const finalPgtEl = document.getElementById('drift-final-pgt');
    const multBreakdownEl = document.getElementById('drift-mult-breakdown');
    const highscoreText = document.getElementById('drift-highscore-text');

    if (finalScoreEl) finalScoreEl.innerText = cleanScore;
    if (finalPgtEl) finalPgtEl.innerText = `+${finalPgt.toFixed(2)} PGT`;
    const vipBadgeStr = (isVip ? ' 🔥 <span style="color:var(--color-warning); font-size:0.8rem;">(VIP 2.0x)</span>' : '') + (isAmb ? ' 🎖️ <span style="color:var(--color-warning); font-size:0.8rem;">(Ambassador 2.0x)</span>' : '');
    if (multBreakdownEl) multBreakdownEl.innerHTML = `Base: ${basePgt.toFixed(2)} PGT • Multiplier: <strong style="color:var(--color-secondary);">${visibleMult.toFixed(1)}x</strong> (${nftPct}% NFT${vipBadgeStr})`;

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

    if (typeof window.sendDiscordEarnAnnouncement === 'function') {
      window.sendDiscordEarnAnnouncement('Cyber Drift', this.score, finalPgt);
    } else if (typeof window.sendDiscordHighScore === 'function') {
      window.sendDiscordHighScore('Cyber Drift', this.score, finalPgt);
    }

    if (window.creditArcadePayout && finalPgt > 0) await window.creditArcadePayout(finalPgt);
    if (window.recordGameMetrics) window.recordGameMetrics('Cyber Drift', 0, finalPgt, Math.max(1, Math.floor(this.gameTime)));

    if (window.appState && window.appState.addActivity) {
      window.appState.addActivity('You', `drifted ${Math.floor(this.distance)}m in Cyber Drift`, `+${finalPgt.toFixed(2)} PGT`);
    }

    if (gameoverScreen) gameoverScreen.style.display = 'flex';
    const controlsHud = document.getElementById('drift-controls-hud');
    if (controlsHud) controlsHud.style.display = 'none';
  }
}

// Global instance initialization
window.cyberDrift = new CyberDriftGame();

window.startCyberDrift = function() {
  window.cyberDrift.start();
};
