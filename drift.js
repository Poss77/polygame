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
    this.steeringSpeed = 0.08;

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
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.keys.nitro = true;
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
  }

  triggerNitro() {
    if (this.nitroTimer <= 0) {
      this.nitroTimer = 120; // 2 seconds
      this.isNitro = true;
      if (window.sfx && window.sfx.playPowerUp) window.sfx.playPowerUp();
    }
  }

  resetGame() {
    this.score = 0;
    this.distance = 0;
    this.orbsCollected = 0;
    this.shield = 100;
    this.speed = 6;
    this.playerX = 0;
    this.playerTargetX = 0;
    this.roadOffset = 0;
    this.curveOffset = 0;
    this.targetCurve = 0;
    this.obstacles = [];
    this.orbs = [];
    this.boostPads = [];
    this.particles = [];
    this.nitroTimer = 0;
    this.isNitro = false;
    this.gameTime = 0;
    this.startTime = Date.now();

    this.updateHUD();
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

    // Handle Nitro
    if (this.nitroTimer > 0) {
      this.nitroTimer--;
      this.speed = 22;
      this.isNitro = true;
      // Add exhaust particles
      if (Math.random() < 0.6) {
        this.addParticle(this.width / 2 + this.playerX * (this.width * 0.35), this.height - 40, '#00f0ff');
      }
    } else {
      this.isNitro = false;
      this.speed = this.keys.nitro ? 14 : 10;
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

    // Spawn PGT Orbs
    if (Math.random() < 0.035) {
      this.orbs.push({
        x: (Math.random() - 0.5) * 1.5,
        z: 1.0,
        type: 'orb'
      });
    }

    // Update Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      let obs = this.obstacles[i];
      obs.z -= (this.speed * 0.0012);

      // Check Collision with player (z <= 0.08)
      if (obs.z <= 0.08 && obs.z >= 0.0) {
        const dx = Math.abs(obs.x - this.playerX);
        if (dx < 0.22) {
          if (!this.isNitro) {
            this.shield -= 25;
            if (window.sfx && window.sfx.playError) window.sfx.playError();
            this.addParticleBurst(this.width / 2 + this.playerX * (this.width * 0.35), this.height - 50, '#ff0055');
          } else {
            // Invincible nitro smash!
            if (window.sfx && window.sfx.playCoin) window.sfx.playCoin();
            this.addParticleBurst(this.width / 2 + obs.x * (this.width * 0.35), this.height - 100, '#00f0ff');
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

    // Update PGT Orbs
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      let orb = this.orbs[i];
      orb.z -= (this.speed * 0.0012);

      // Collect Orb
      if (orb.z <= 0.08 && orb.z >= 0.0) {
        const dx = Math.abs(orb.x - this.playerX);
        if (dx < 0.25) {
          this.orbsCollected++;
          if (window.sfx && window.sfx.playCoin) window.sfx.playCoin();
          this.addParticleBurst(this.width / 2 + orb.x * (this.width * 0.35), this.height - 60, '#00f0ff');
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
    if (distEl) distEl.innerText = `${Math.floor(this.distance)}m`;
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

    // 4. Render PGT Orbs
    this.orbs.forEach(orb => {
      const p = 1.0 - orb.z;
      if (p < 0 || p > 1) return;
      const py = horizonY + p * p * (h - horizonY);
      const pw = roadTopWidth + p * (roadBottomWidth - roadTopWidth);
      const px = (roadTopX + p * (roadBottomX - roadTopX)) + orb.x * (pw * 0.45);
      const size = 6 + p * 18;

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(px, py - size, size, 0, Math.PI * 2);
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 15;
      this.ctx.fill();

      // Inner core
      this.ctx.beginPath();
      this.ctx.arc(px, py - size, size * 0.5, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fill();
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

    // 7. Render Player Cyber Car
    const playerPy = h - 35;
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

    this.ctx.restore();
  }

  gameOver() {
    this.isRunning = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);

    const multis = window.appState ? window.appState.getMultipliers() : { arcadeMultiplier: 1 };
    const basePgt = (this.score / 80) + (this.orbsCollected * 1.5);
    const finalPgt = parseFloat((basePgt * multis.arcadeMultiplier).toFixed(2));

    const gameoverScreen = document.getElementById('drift-gameover-screen');
    const finalScoreEl = document.getElementById('drift-final-score');
    const finalPgtEl = document.getElementById('drift-final-pgt');
    const highscoreText = document.getElementById('drift-highscore-text');

    if (finalScoreEl) finalScoreEl.innerText = this.score;
    if (finalPgtEl) finalPgtEl.innerText = `+${finalPgt} PGT`;

    let currentHigh = window.appState.state.driftHighScore || 0;
    if (this.score > currentHigh) {
      window.appState.update({ driftHighScore: this.score });
      if (highscoreText) highscoreText.style.display = 'block';
    } else {
      if (highscoreText) highscoreText.style.display = 'none';
    }

    if (window.creditArcadePayout) window.creditArcadePayout(finalPgt);
    if (window.recordGameMetrics) window.recordGameMetrics('Cyber Drift', 0, finalPgt, Math.floor(this.gameTime));

    if (window.appState && window.appState.addActivity) {
      window.appState.addActivity('You', `drifted ${Math.floor(this.distance)}m in Cyber Drift`, `+${finalPgt.toFixed(2)} PGT`);
    }

    if (gameoverScreen) gameoverScreen.style.display = 'flex';
    document.getElementById('drift-controls-hud').style.display = 'none';
  }
}

// Global instance initialization
window.cyberDrift = new CyberDriftGame();

window.startCyberDrift = function() {
  window.cyberDrift.start();
};
