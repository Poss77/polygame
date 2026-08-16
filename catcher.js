/**
 * ============================================================================
 * POLYGAME: CYBER CATCHER (VIP EXCLUSIVE ARCADE COLLECTOR)
 * ============================================================================
 * - 60 FPS HTML5 Canvas Neon Arcade Action
 * - Controls: Mouse, Keyboard (A/D, Arrows), Touch Drag & Tap on Mobile
 * - Mechanics: Catch Data Chips, Combo Crystals, Magnets, Shields & +5 PGT Tokens
 * - Hazards: Dodge Glitch Bombs & EMP Spikes (3 Lives)
 * - Security: Integrated with Server-Side Session Handshake (start/end_arcade_session)
 * ============================================================================
 */

class CyberCatcherGame {
  constructor() {
    this.canvas = document.getElementById('catcher-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.container = document.getElementById('container-catcher');

    this.width = 800;
    this.height = 600;
    this.isPlaying = false;
    this.animationId = null;
    this.lastTime = 0;

    // Player Drone State
    this.player = {
      x: 400,
      y: 520,
      w: 80,
      h: 24,
      targetX: 400,
      speed: 12,
      tilt: 0,
      glowPulse: 0
    };

    // Game Metrics & State
    this.score = 0;
    this.lives = 3;
    this.chipsCollected = 0;
    this.bonusTokensCollected = 0;
    this.combo = 1.0;
    this.comboTimer = 0;
    this.gameTime = 0; // in frame ticks (60fps)
    this.sessionId = null;

    // Active Powerups
    this.shieldActive = false;
    this.magnetTimer = 0; // frames remaining

    // Spawning and Item Arrays
    this.items = [];
    this.particles = [];
    this.floatingTexts = [];
    this.keys = {};

    this.touchStartX = null;
    this.touchCurrentX = null;
    this.isMobile = false;

    this.init();
  }

  init() {
    if (!this.canvas) return;

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Input Listeners: Keyboard
    window.addEventListener('keydown', (e) => {
      this.keys[e.key] = true;
      if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key) && this.isPlaying) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
    });

    // Input Listeners: Mouse
    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.isPlaying) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.width / rect.width;
      this.player.targetX = (e.clientX - rect.left) * scaleX;
    });

    // Input Listeners: Touch Dragging
    this.canvas.addEventListener('touchstart', (e) => {
      if (!this.isPlaying) return;
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.width / rect.width;
      this.player.targetX = (touch.clientX - rect.left) * scaleX;
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (!this.isPlaying) return;
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.width / rect.width;
      this.player.targetX = (touch.clientX - rect.left) * scaleX;
    }, { passive: true });

    // Buttons
    const btnStart = document.getElementById('btn-catcher-start');
    if (btnStart) {
      btnStart.addEventListener('click', () => this.start());
    }

    const btnRestart = document.getElementById('btn-catcher-restart');
    if (btnRestart) {
      btnRestart.addEventListener('click', () => this.start());
    }
  }

  resize() {
    if (!this.canvas || !this.container) return;
    const rect = this.container.getBoundingClientRect();
    const w = Math.min(800, Math.max(320, rect.width || window.innerWidth));
    const h = Math.min(600, Math.max(480, window.innerHeight * 0.70));

    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.isMobile = w <= 600;

    this.player.y = this.height - (this.isMobile ? 55 : 45);
    this.player.w = this.isMobile ? 70 : 85;
  }

  resetGame() {
    this.resize();
    this.score = 0;
    this.lives = 3;
    this.chipsCollected = 0;
    this.bonusTokensCollected = 0;
    this.combo = 1.0;
    this.comboTimer = 0;
    this.gameTime = 0;
    this.shieldActive = false;
    this.magnetTimer = 0;
    this.items = [];
    this.particles = [];
    this.floatingTexts = [];

    this.player.x = this.width / 2;
    this.player.targetX = this.width / 2;

    this.updateHUD();
  }

  async start() {
    // Check VIP Access
    const isVip = window.appState && typeof window.appState.isVipActive === 'function' && window.appState.isVipActive();
    const isAmb = window.appState && window.appState.state && window.appState.state.isAmbassador;
    const isAdmin = window.appState && window.appState.state && window.appState.state.isAdmin;

    // Check if game is VIP only from global settings
    const settings = (window.appState && window.appState.state && window.appState.state.gamePayoutSettings) || {};
    const vipOnly = settings.catcher ? settings.catcher.vip_only : true;

    if (vipOnly && !isVip && !isAmb && !isAdmin) {
      if (window.showVipLockModal) {
        window.showVipLockModal('Cyber Catcher');
      } else if (window.triggerToast) {
        window.triggerToast("👑 VIP Exclusive Game! Upgrade to VIP Pass to play.", "warning");
      }
      return;
    }

    this.resetGame();
    this.isPlaying = true;

    const startScreen = document.getElementById('catcher-start-screen');
    const gameOverScreen = document.getElementById('catcher-gameover-screen');
    if (startScreen) startScreen.style.display = 'none';
    if (gameOverScreen) gameOverScreen.style.display = 'none';

    // Start Server-Side Anti-Cheat Session Handshake
    this.sessionId = null;
    if (window.startArcadeSession) {
      try {
        this.sessionId = await window.startArcadeSession('Cyber Catcher');
      } catch (err) {
        console.warn("[CyberCatcher] Session start error:", err);
      }
    }

    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.lastTime = performance.now();
    this.loop();
  }

  loop() {
    if (!this.isPlaying) return;

    this.update();
    this.render();

    this.animationId = requestAnimationFrame(() => this.loop());
  }

  update() {
    this.gameTime++;

    // 1. Player Movement & Keyboard Controls
    if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
      this.player.targetX -= this.player.speed;
    }
    if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
      this.player.targetX += this.player.speed;
    }

    // Clamp Target X
    const halfW = this.player.w / 2;
    this.player.targetX = Math.max(halfW, Math.min(this.width - halfW, this.player.targetX));

    // Smooth Lerp to Target X
    const dx = this.player.targetX - this.player.x;
    this.player.x += dx * 0.22;
    this.player.tilt = Math.max(-0.25, Math.min(0.25, dx * 0.015));
    this.player.glowPulse = Math.sin(this.gameTime * 0.1) * 4;

    // 2. Powerup Timers
    if (this.magnetTimer > 0) this.magnetTimer--;
    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer <= 0) {
        this.combo = 1.0;
        this.updateHUD();
      }
    }

    // 3. Spawning System (Scales dynamically with survival time)
    const baseSpawnRate = Math.max(20, Math.floor(45 - (this.gameTime / 300)));
    if (this.gameTime % baseSpawnRate === 0) {
      this.spawnItem();
    }

    // 4. Update Items
    const fallSpeedBase = 3.0 + Math.min(5.0, this.gameTime / 500);

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.y += item.vy * (fallSpeedBase / 3.0);
      item.rot += item.rotSpeed;

      // Magnetic Attraction
      if (this.magnetTimer > 0 && item.type !== 'bomb') {
        const toPlayerX = this.player.x - item.x;
        const toPlayerY = this.player.y - item.y;
        const dist = Math.hypot(toPlayerX, toPlayerY);
        if (dist < 260 && dist > 1) {
          item.x += (toPlayerX / dist) * 7.5;
          item.y += (toPlayerY / dist) * 7.5;
        }
      }

      // Catch Collision (AABB + Drone Catch Zone)
      const catchDistX = Math.abs(item.x - this.player.x);
      const catchDistY = Math.abs(item.y - this.player.y);

      if (catchDistX < (this.player.w / 2 + item.radius) && catchDistY < (this.player.h / 2 + item.radius)) {
        this.handleCatch(item, i);
        continue;
      }

      // Fell off screen
      if (item.y > this.height + 40) {
        this.items.splice(i, 1);
      }
    }

    // 5. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }

    // 6. Update Floating Text Popups
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.y += t.vy;
      t.alpha -= 0.02;
      if (t.alpha <= 0) this.floatingTexts.splice(i, 1);
    }

    // 7. Periodic HUD Refresh
    if (this.gameTime % 15 === 0) {
      this.updateLiveEarnDisplay();
    }
  }

  spawnItem() {
    const margin = 40;
    const spawnX = margin + Math.random() * (this.width - margin * 2);
    const rand = Math.random();

    let type = 'chip';
    let radius = 14;
    let color = '#00f0ff';
    let vy = 3.0 + Math.random() * 1.5;

    if (rand < 0.48) {
      // 🪙 48% Data Chip (+50 pts)
      type = 'chip';
      color = '#00f0ff';
      radius = 12;
    } else if (rand < 0.70) {
      // 💎 22% Quantum Gem (+150 pts + Combo)
      type = 'gem';
      color = '#ff00ff';
      radius = 14;
    } else if (rand < 0.88) {
      // 💣 18% Glitch EMP Bomb (Hazard!)
      type = 'bomb';
      color = '#ff3366';
      radius = 16;
      vy += 0.5;
    } else if (rand < 0.93) {
      // 🧲 5% Magnetic Pulse
      type = 'magnet';
      color = '#ffee00';
      radius = 16;
    } else if (rand < 0.97) {
      // 🛡️ 4% Shield Cell
      type = 'shield';
      color = '#00ff88';
      radius = 16;
    } else {
      // 🪙 3% Golden +5 PGT Bonus Token!
      type = 'bonus_pgt';
      color = '#ffd700';
      radius = 18;
    }

    this.items.push({
      type,
      x: spawnX,
      y: -20,
      radius,
      color,
      vy,
      rot: 0,
      rotSpeed: (Math.random() - 0.5) * 0.1
    });
  }

  handleCatch(item, index) {
    this.items.splice(index, 1);

    if (item.type === 'bomb') {
      if (this.shieldActive) {
        // Shield absorbs blast
        this.shieldActive = false;
        this.addSparks(item.x, item.y, '#00ff88', 25);
        this.addPopup("🛡️ SHIELD BROKEN!", "#00ff88");
        if (window.sfx && window.sfx.playPowerUp) window.sfx.playPowerUp();
        if (window.triggerToast) window.triggerToast("🛡️ Hazard Shield Absorbed Bomb Blast!", "warning");
      } else {
        // Lose life
        this.lives--;
        this.combo = 1.0;
        this.comboTimer = 0;
        this.addSparks(item.x, item.y, '#ff3366', 35);
        this.addPopup("💥 -1 LIFE!", "#ff3366");
        if (window.sfx && window.sfx.playExplosion) window.sfx.playExplosion();

        this.updateHUD();

        if (this.lives <= 0) {
          this.gameOver();
          return;
        }
      }
    } else if (item.type === 'chip') {
      const pts = Math.floor(50 * this.combo);
      this.score += pts;
      this.chipsCollected++;
      this.addSparks(item.x, item.y, '#00f0ff', 10);
      this.addPopup(`+${pts}`, '#00f0ff');
      if (window.sfx && window.sfx.playCoin) window.sfx.playCoin();
    } else if (item.type === 'gem') {
      this.combo = Math.min(5.0, parseFloat((this.combo + 0.5).toFixed(1)));
      this.comboTimer = 240; // 4 seconds combo window
      const pts = Math.floor(150 * this.combo);
      this.score += pts;
      this.chipsCollected += 2;
      this.addSparks(item.x, item.y, '#ff00ff', 18);
      this.addPopup(`💎 +${pts} (${this.combo}x COMBO)`, '#ff00ff');
      if (window.sfx && window.sfx.playCoin) window.sfx.playCoin();
    } else if (item.type === 'magnet') {
      this.magnetTimer = 360; // 6 seconds magnet
      this.score += 100;
      this.addSparks(item.x, item.y, '#ffee00', 25);
      this.addPopup("🧲 MAGNET OVERCHARGE!", "#ffee00");
      if (window.sfx && window.sfx.playPowerUp) window.sfx.playPowerUp();
      if (window.triggerToast) window.triggerToast("🧲 Magnetic Field Online (6s)!", "success");
    } else if (item.type === 'shield') {
      this.shieldActive = true;
      this.score += 100;
      this.addSparks(item.x, item.y, '#00ff88', 25);
      this.addPopup("🛡️ SHIELD ONLINE!", "#00ff88");
      if (window.sfx && window.sfx.playPowerUp) window.sfx.playPowerUp();
      if (window.triggerToast) window.triggerToast("🛡️ Kinetic Shield Deployed!", "success");
    } else if (item.type === 'bonus_pgt') {
      this.bonusTokensCollected++;
      this.score += 300;
      this.addSparks(item.x, item.y, '#ffd700', 30);
      this.addPopup("🪙 +5 PGT BONUS TOKEN!", "#ffd700");
      if (window.sfx && window.sfx.playCoin) window.sfx.playCoin();
      if (window.triggerToast) window.triggerToast("🪙 +5 PGT Bonus Token Collected!", "warning");
    }

    this.updateHUD();
  }

  addSparks(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 2.0 + Math.random() * 4.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color,
        size: 2 + Math.random() * 3,
        alpha: 1.0,
        decay: 0.02 + Math.random() * 0.03
      });
    }
  }

  addPopup(text, color) {
    this.floatingTexts.push({
      text,
      x: this.player.x + (Math.random() - 0.5) * 40,
      y: this.player.y - 25,
      color,
      alpha: 1.0,
      vy: -1.4
    });
  }

  updateHUD() {
    const scoreEl = document.getElementById('catcher-live-score');
    if (scoreEl) scoreEl.innerText = this.score;

    const livesEl = document.getElementById('catcher-live-lives');
    if (livesEl) {
      let hearts = '';
      for (let i = 0; i < this.lives; i++) hearts += '❤️';
      livesEl.innerText = hearts || '💀';
    }

    const comboEl = document.getElementById('catcher-live-combo');
    if (comboEl) {
      comboEl.innerText = `${this.combo.toFixed(1)}x`;
      comboEl.style.color = this.combo > 1.0 ? 'var(--color-secondary)' : '#ffffff';
    }
  }

  updateLiveEarnDisplay() {
    const earnedEl = document.getElementById('catcher-live-earned');
    if (!earnedEl) return;

    const multis = window.appState ? window.appState.getMultipliers() : { nftGameMultiplier: 0 };
    const nftMult = 1 + ((multis.nftGameMultiplier || 0) / 100);
    const vipMult = (window.appState && window.appState.isVipActive()) ? 2.0 : 1.0;
    const ambMult = (window.appState && window.appState.state && window.appState.state.isAmbassador) ? 2.0 : 1.0;
    const totalMult = nftMult * vipMult * ambMult;

    const basePgt = (this.score / 2000.0) + (this.chipsCollected * 0.04);
    const estPgt = (basePgt * totalMult) + (this.bonusTokensCollected * 5.0);

    earnedEl.innerText = estPgt.toFixed(2);
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    // Dark Cyber Grid Background
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, this.width, this.height);

    // Neon Ambient Grid Lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < this.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // Render Magnetic Aura
    if (this.magnetTimer > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 238, 0, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, 140 + Math.sin(this.gameTime * 0.2) * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Render Falling Items
    for (const item of this.items) {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.rot);
      ctx.shadowBlur = 12;
      ctx.shadowColor = item.color;
      ctx.fillStyle = item.color;

      if (item.type === 'chip') {
        // Neon Hex Chip
        ctx.beginPath();
        const sides = 6;
        for (let s = 0; s < sides; s++) {
          const a = (s * Math.PI * 2) / sides;
          const px = Math.cos(a) * item.radius;
          const py = Math.sin(a) * item.radius;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      } else if (item.type === 'gem') {
        // Quantum Prism
        ctx.beginPath();
        ctx.moveTo(0, -item.radius * 1.2);
        ctx.lineTo(item.radius, 0);
        ctx.lineTo(0, item.radius * 1.2);
        ctx.lineTo(-item.radius, 0);
        ctx.closePath();
        ctx.fill();
      } else if (item.type === 'bomb') {
        // Glitch Hazard Spike
        ctx.fillStyle = '#ff3366';
        ctx.beginPath();
        ctx.arc(0, 0, item.radius * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (item.type === 'magnet') {
        ctx.font = `${item.radius * 1.6}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧲', 0, 0);
      } else if (item.type === 'shield') {
        ctx.font = `${item.radius * 1.6}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🛡️', 0, 0);
      } else if (item.type === 'bonus_pgt') {
        ctx.font = `${item.radius * 1.6}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🪙', 0, 0);
      }

      ctx.restore();
    }

    // Render Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Player Neon Drone Platform
    ctx.save();
    ctx.translate(this.player.x, this.player.y);
    ctx.rotate(this.player.tilt);

    // Thruster Particle Flare
    ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(-this.player.w * 0.35, 14, 4, 8 + Math.sin(this.gameTime * 0.4) * 3, 0, 0, Math.PI * 2);
    ctx.ellipse(this.player.w * 0.35, 14, 4, 8 + Math.sin(this.gameTime * 0.4) * 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Drone Hull
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00f0ff';
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.roundRect(-this.player.w / 2, -this.player.h / 2, this.player.w, this.player.h, 6);
    ctx.fill();
    ctx.stroke();

    // Energy Core Center
    ctx.fillStyle = '#ff00ff';
    ctx.shadowColor = '#ff00ff';
    ctx.beginPath();
    ctx.arc(0, 0, 6 + this.player.glowPulse * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Shield Bubble Visual
    if (this.shieldActive) {
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, this.player.w * 0.65, this.player.h * 1.5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Render Floating Text Popups
    for (const t of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = t.alpha;
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = t.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = t.color;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }

  async gameOver() {
    this.isPlaying = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);

    const multis = window.appState ? window.appState.getMultipliers() : null;
    const nftPct = multis ? (multis.nftGameMultiplier || 0) : 0;
    const nftMult = 1 + (nftPct / 100);
    const isVip = window.appState && typeof window.appState.isVipActive === 'function' && window.appState.isVipActive();
    const vipMult = isVip ? 2.0 : 1.0;
    const isAmb = window.appState && window.appState.state && window.appState.state.isAmbassador;
    const ambMult = isAmb ? 2.0 : 1.0;
    const globalMult = (window.appState && window.appState.state) ? (window.appState.state.globalEarnMultiplier || 1.0) : 1.0;
    const visibleMult = nftMult * vipMult * ambMult;

    const cleanScore = Math.floor(this.score || 0);
    const basePgt = ((cleanScore / 2000) + (this.chipsCollected * 0.04)) * globalMult;
    const calculatedPgt = parseFloat((basePgt * visibleMult).toFixed(2));
    const tokenPgt = this.bonusTokensCollected * 5.0;
    const finalPgt = cleanScore > 0 ? parseFloat((calculatedPgt + tokenPgt).toFixed(2)) : 0;

    let verifiedPgt = finalPgt;
    let isNewHigh = (window.appState && cleanScore > (window.appState.state.catcherHighScore || 0));

    // Submit Session End through Secure Server Handshake
    if (window.endArcadeSession && this.sessionId) {
      try {
        const res = await window.endArcadeSession(this.sessionId, cleanScore, this.chipsCollected, this.bonusTokensCollected);
        if (res && res.payout !== undefined) {
          verifiedPgt = parseFloat(res.payout);
          if (res.is_new_high) isNewHigh = true;
        } else if (window.creditArcadePayout && finalPgt > 0) {
          await window.creditArcadePayout(finalPgt);
        }
      } catch (err) {
        console.warn("[CyberCatcher] endArcadeSession fallback:", err);
        if (window.creditArcadePayout && finalPgt > 0) {
          await window.creditArcadePayout(finalPgt);
        }
      }
    } else if (window.creditArcadePayout && finalPgt > 0) {
      await window.creditArcadePayout(finalPgt);
    }

    if (isNewHigh && window.appState) {
      window.appState.update({ catcherHighScore: cleanScore });
    }

    // Render Game Over UI
    const gameOverScreen = document.getElementById('catcher-gameover-screen');
    const finalScoreEl = document.getElementById('catcher-final-score');
    const finalPgtEl = document.getElementById('catcher-final-pgt');
    const multBreakdownEl = document.getElementById('catcher-mult-breakdown');
    const highscoreText = document.getElementById('catcher-highscore-text');

    if (finalScoreEl) finalScoreEl.innerText = cleanScore;
    if (finalPgtEl) finalPgtEl.innerText = `+${verifiedPgt.toFixed(2)} PGT`;
    const vipBadgeStr = (isVip ? ' 🔥 <span style="color:var(--color-warning); font-size:0.8rem;">(VIP 2.0x)</span>' : '') + (isAmb ? ' 🎖️ <span style="color:var(--color-warning); font-size:0.8rem;">(Ambassador 2.0x)</span>' : '');
    if (multBreakdownEl) {
      multBreakdownEl.innerHTML = `Base: ${basePgt.toFixed(2)} PGT • Multiplier: <strong style="color:var(--color-secondary);">${visibleMult.toFixed(1)}x</strong> (${nftPct}% NFT${vipBadgeStr})`;
    }

    if (highscoreText) {
      highscoreText.style.display = isNewHigh ? 'block' : 'none';
    }

    if (window.submitHighScoreToDB && cleanScore > 0) {
      window.submitHighScoreToDB('catcher', cleanScore);
    }

    if (typeof window.sendDiscordEarnAnnouncement === 'function') {
      window.sendDiscordEarnAnnouncement('Cyber Catcher', cleanScore, verifiedPgt);
    } else if (typeof window.sendDiscordHighScore === 'function') {
      window.sendDiscordHighScore('Cyber Catcher', cleanScore, verifiedPgt);
    }

    if (window.appState && window.appState.addActivity) {
      window.appState.addActivity('You', `caught ${this.chipsCollected} chips in Cyber Catcher`, `+${verifiedPgt.toFixed(2)} PGT`);
    }

    if (gameOverScreen) gameOverScreen.style.display = 'flex';
  }
}

// Global instance initialization
window.cyberCatcher = new CyberCatcherGame();
