/**
 * Cyber Invaders Mini-Game Engine (HTML5 Canvas)
 * A retro space shooter where players steer a defense ship, shoot laser cannons,
 * and destroy falling block invaders to earn pending PGT rewards.
 */

class CyberInvaders {
  constructor(canvasId, overlayId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.overlay = document.getElementById(overlayId);

    this.width = this.canvas.width;
    this.height = this.canvas.height;

    this.isPlaying = false;
    this.isDying = false;
    this.deathTimer = 0;
    this.score = 0;
    this.lives = 1; // 1 Life (Sudden Death)
    this.level = 1;
    this.gameTime = 0;

    // Control keys
    this.keys = {
      a: false, d: false, ArrowLeft: false, ArrowRight: false, " ": false
    };

    // Entities
    this.player = null;
    this.bullets = [];
    this.enemyBullets = [];
    this.invaders = [];
    this.particles = [];
    this.powerups = [];
    this.ufos = [];
    this.boss = null;
    
    this.lastShotTime = -100;
    this.hasShield = false;
    this.hasSpread = false;
    this.beamTimer = 0;
    this.freezeTimer = 0;
    this.initEvents();
  }

  initEvents() {
    window.addEventListener('keydown', (e) => {
      if (this.keys.hasOwnProperty(e.key)) {
        this.keys[e.key] = true;
        if (e.key === " " && this.isPlaying) {
          e.preventDefault();
          if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.keys.hasOwnProperty(e.key)) {
        this.keys[e.key] = false;
      }
    });

    const containerEl = document.getElementById('game-window-container') || this.canvas;

    let touchStartX = 0;

    containerEl.addEventListener('touchstart', (e) => {
      if (!this.isPlaying || !e.touches || e.touches.length === 0) return;
      if (e.target.closest('.btn-fullscreen-close') || e.target.closest('button')) return;
      
      touchStartX = e.touches[0].clientX;
      this.keys[" "] = true; // Auto-fire while holding touch
    }, { passive: false });

    containerEl.addEventListener('touchmove', (e) => {
      if (!this.isPlaying || !e.touches || e.touches.length === 0) return;
      if (e.target.closest('.btn-fullscreen-close') || e.target.closest('button')) return;
      e.preventDefault();
      
      const currentTouchX = e.touches[0].clientX;
      const diffX = currentTouchX - touchStartX;
      
      const canvasRect = this.canvas.getBoundingClientRect();
      const scaleX = canvasRect.width > 0 ? (this.width / canvasRect.width) : 1.0;

      if (this.player) {
        this.player.x += diffX * scaleX;
        if (this.player.x < 10) this.player.x = 10;
        if (this.player.x > this.width - this.player.w - 10) this.player.x = this.width - this.player.w - 10;
      }
      
      touchStartX = currentTouchX;
      this.keys[" "] = true;
    }, { passive: false });

    containerEl.addEventListener('touchend', () => {
      if (!this.isPlaying) return;
      this.keys[" "] = false;
    });

    const startBtn = document.getElementById('btn-start-invaders');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startGame());
    }
  }

  startGame() {
    if (window.sfx && window.sfx.init) window.sfx.init();

    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.isPlaying = true;
    this.isDying = false;
    this.deathTimer = 0;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.gameTime = 0;
    this.lastShotTime = -100;
    this.keys = { a: false, d: false, ArrowLeft: false, ArrowRight: false, " ": false };

    this.bullets = [];
    this.enemyBullets = [];
    this.particles = [];
    this.invaders = [];
    this.powerups = [];
    this.ufos = [];
    this.boss = null;
    this.hasShield = false;
    this.hasSpread = false;
    this.beamTimer = 0;
    this.freezeTimer = 0;
    this.invincibleTimer = 120; // 2 seconds (120 frames) spawn invincibility

    // Hide menu overlay
    this.overlay.style.display = 'none';

    // Player Ship config
    this.player = {
      x: this.width / 2 - 18,
      y: this.height - 60,
      w: 36,
      h: 18,
      speed: 4.8
    };

    this.spawnWave();

    // Reset scores & HUD
    document.getElementById('invaders-live-score').innerText = '0';
    document.getElementById('invaders-live-lives').innerText = '3';
    document.getElementById('invaders-live-earned').innerText = '0.00';
    const lvlEl = document.getElementById('invaders-live-level');
    if (lvlEl) lvlEl.innerText = '1';

    // Hook combined NFT & VIP multiplier boost
    const multis = window.appState ? window.appState.getMultipliers() : {nftGameMultiplier: 0};
    const nftMult = 1 + ((multis.nftGameMultiplier || 0) / 100);
    const vipMult = (window.appState && window.appState.isVipActive()) ? 2.0 : 1.0;
    const ambMult = (window.appState && window.appState.state && window.appState.state.isAmbassador) ? 2.0 : 1.0;
    const totalBoost = nftMult * vipMult * ambMult;
    const boostLabel = document.getElementById('invaders-nft-boost-label');
    if (boostLabel) boostLabel.innerText = `${parseFloat(totalBoost || 1).toFixed(1)}x`;

    this.bonusTokensCollected = 0;
    this.sessionId = null;
    if (window.startArcadeSession) {
      window.startArcadeSession('Cyber Invaders').then(sid => {
        this.sessionId = sid;
      }).catch(() => {});
    }

    this.lastFrameTimestamp = 0;
    this.loop();
  }

  spawnWave() {
    this.invaders = [];
    this.boss = null;

    const lvlEl = document.getElementById('invaders-live-level');
    if (lvlEl) lvlEl.innerText = this.level;

    if (this.level % 5 === 0) {
      // BOSS WAVE (30% speed reduction)
      this.boss = {
        x: this.width / 2 - 60,
        y: 40,
        w: 120,
        h: 60,
        vx: 1.4 + (this.level * 0.14),
        hp: 40 + (this.level * 5),
        maxHp: 40 + (this.level * 5),
        color: '#ff0000'
      };
      if (window.triggerToast) window.triggerToast("WARNING: CYBER-BOSS APPROACHING!", "error");
    } else {
      // NORMAL WAVE (30% speed reduction)
      const cols = 8;
      const rows = 3;
      const invWidth = 30;
      const invHeight = 15;
      const spacingX = 20;
      const spacingY = 15;
      const startX = (this.width - (cols * (invWidth + spacingX) - spacingX)) / 2;
      const startY = 40;
      
      const speedX = 0.7 + ((this.level - 1) * 0.28);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let type = 'normal';
          let hp = 1;
          let color = r === 1 ? '#bd00ff' : '#00f0ff';
          
          if (r === 0) { // Top row = Tanks
            type = 'tank';
            hp = 3;
            color = '#ffaa00';
          } else if (r === 2 && Math.random() < 0.25) { // Bottom row chance for Kamikaze
            type = 'kamikaze';
            color = '#ffff00';
          }

          this.invaders.push({
            x: startX + c * (invWidth + spacingX),
            y: startY + r * (invHeight + spacingY),
            w: invWidth,
            h: invHeight,
            vx: speedX,
            type: type,
            hp: hp,
            color: color,
            diving: false
          });
        }
      }
    }
  }

  async gameOver() {
    if (window.trackQuestProgress) window.trackQuestProgress('games', 1);
    this.isPlaying = false;
    this.isDying = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (window.sfx && window.sfx.playExplosion) window.sfx.playExplosion();

    const title = document.getElementById('invaders-overlay-title');
    const desc = document.getElementById('invaders-overlay-desc');
    const playBtn = document.getElementById('btn-start-invaders');
    
    title.innerText = "DEFENSE SHIELD FAILURE";
    title.style.color = "var(--color-danger)";
    playBtn.innerText = "Submitting Score...";
    playBtn.disabled = true;
    this.overlay.style.display = 'flex';

    const multis = window.appState ? window.appState.getMultipliers() : {nftGameMultiplier:0};
    const nftMult = 1 + ((multis.nftGameMultiplier || 0) / 100);
    const isVip = window.appState && window.appState.isVipActive();
    const vipMult = isVip ? 2.0 : 1.0;
    const isAmb = window.appState && window.appState.state && window.appState.state.isAmbassador;
    const ambMult = isAmb ? 2.0 : 1.0;
    const playerMult = nftMult * vipMult * ambMult;
    const globalMult = (window.appState && window.appState.state && window.appState.state.globalEarnMultiplier) ? parseFloat(window.appState.state.globalEarnMultiplier) : 1.0;
    const rawBase = (this.score * 0.015) * globalMult;
    const vipBadgeStr = (isVip ? ' 🔥 <span style="color:var(--color-warning); font-size:0.8rem;">(VIP 2.0x)</span>' : '') + (isAmb ? ' 🎖️ <span style="color:var(--color-warning); font-size:0.8rem;">(Ambassador 2.0x)</span>' : '');

    let verifiedPgt = Math.max(0.01, parseFloat(((rawBase * playerMult) + (this.bonusTokensCollected * 5.0)).toFixed(2)));
    const cleanScore = Math.floor(this.score);
    const currentHigh = (window.appState && window.appState.state) ? (window.appState.state.invadersHighScore || 0) : 0;
    let isNewHigh = cleanScore > currentHigh;

    if (isNewHigh && window.appState) {
      window.appState.update({ invadersHighScore: cleanScore });
    }
    if (window.submitHighScoreToDB && cleanScore > 0) {
      window.submitHighScoreToDB('invaders', cleanScore);
    }

    if (window.endArcadeSession && this.sessionId) {
      const res = await window.endArcadeSession(this.sessionId, cleanScore, this.gemsCollected || 0, this.bonusTokensCollected || 0, nftMult);
      if (res && (res.payout !== undefined || res.payout_pgt !== undefined || res.success)) {
        verifiedPgt = parseFloat(res.payout !== undefined ? res.payout : (res.payout_pgt !== undefined ? res.payout_pgt : verifiedPgt));
        if (res.is_new_high) isNewHigh = true;
      } else if (window.creditArcadePayout) {
        await window.creditArcadePayout(verifiedPgt);
      }
    } else if (window.creditArcadePayout) {
      await window.creditArcadePayout(verifiedPgt);
    }

    const newHighScoreStr = isNewHigh ? `<br><strong style="color:var(--color-warning);">NEW HIGH SCORE!</strong>` : "";

    if (window.appState) {
      window.appState.addActivity('You', `blasted ${this.score} pts in Invaders`, `+${verifiedPgt.toFixed(2)} PGT`);
      window.appState.save();
    }

    if (typeof window.sendDiscordEarnAnnouncement === 'function') {
      window.sendDiscordEarnAnnouncement('Cyber Invaders', this.score, verifiedPgt);
    } else if (typeof window.sendDiscordHighScore === 'function') {
      window.sendDiscordHighScore('Cyber Invaders', this.score, verifiedPgt);
    }

    const tokenPgt = (this.bonusTokensCollected || 0) * 5.0;
    const gamePgt = Math.max(0, verifiedPgt - tokenPgt);
    const payoutDisplay = tokenPgt > 0 
      ? `+${gamePgt.toFixed(2)} PGT <span style="color:var(--color-warning); font-size:0.95em; font-weight:700;">+ ${tokenPgt.toFixed(0)} PGT Bonus</span>`
      : `+${verifiedPgt.toFixed(2)} PGT`;

    desc.innerHTML = `
      Score: <strong style="color:var(--color-primary);">${this.score}</strong> (Level ${this.level})${newHighScoreStr}<br>
      <span style="font-size:0.9rem; color:var(--text-muted);">Base: ${rawBase.toFixed(2)} PGT • Multiplier: <strong style="color:var(--color-secondary);">${playerMult.toFixed(1)}x</strong> (${multis.nftGameMultiplier}% NFT${vipBadgeStr})</span><br>
      <span style="font-size:1.1rem; font-weight:800; color:var(--color-success);">Final Payout: ${payoutDisplay}</span>
    `;

    playBtn.innerText = "Reboot Cannons";
    playBtn.disabled = false;
  }

  stop() {
    this.isPlaying = false;
    this.keys = {};
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.overlay) {
      this.overlay.style.display = 'flex';
    }
  }

  loop(timestamp) {
    if (!this.isPlaying) return;

    if (timestamp) {
      if (!this.lastFrameTimestamp) this.lastFrameTimestamp = timestamp;
      const elapsed = timestamp - this.lastFrameTimestamp;
      const targetFpsMs = 1000 / 60; // 16.66ms per frame (60 FPS cap)

      if (elapsed < targetFpsMs - 2) {
        if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
        this.animFrameId = requestAnimationFrame((t) => this.loop(t));
        return;
      }
      this.lastFrameTimestamp = timestamp - (elapsed % targetFpsMs);
    }

    this.update();
    this.draw();
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.animFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  loseLife() {
    if (this.invincibleTimer > 0) return; // Invincible protection

    if (this.hasShield) {
      this.hasShield = false; // Shield absorbs hit
      this.invincibleTimer = 30; // 0.5s grace period when shield breaks
      if (window.sfx && window.sfx.playPowerup) window.sfx.playPowerup();
      return;
    }

    this.lives--;
    this.hasSpread = false; // Power-up resets upon losing a life
    const livesEl = document.getElementById('invaders-live-lives');
    if (livesEl) livesEl.innerText = Math.max(0, this.lives);

    if (this.lives > 0) {
      // Grant 2 seconds of invincibility upon taking a non-fatal hit
      this.invincibleTimer = 120;
      if (window.sfx && window.sfx.playExplosion) window.sfx.playExplosion();
      this.spawnExplosionParticles(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, '#ff0055', 20);
      return;
    }

    // Fatal hit (0 lives remaining) -> Trigger Death Explosion Animation
    this.isDying = true;
      this.deathTimer = 60; // 1 second dramatic death sequence
      if (window.sfx && window.sfx.playExplosion) window.sfx.playExplosion();
      
      // Massive explosion shockwave particles
      const colors = ['#00ffff', '#ff0055', '#ffff00', '#ffffff', '#bd00ff'];
      for (let i = 0; i < 50; i++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.0 + Math.random() * 6.0;
        this.particles.push({
          x: this.player.x + this.player.w / 2,
          y: this.player.y + this.player.h / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: color,
          alpha: 1.0,
          size: 2 + Math.random() * 4
        });
      }
    }

  updateLiveScore() {
    document.getElementById('invaders-live-score').innerText = this.score;
    const multis = window.appState ? window.appState.getMultipliers() : {nftGameMultiplier: 0};
    const nftMult = 1 + ((multis.nftGameMultiplier || 0) / 100);
    const vipMult = (window.appState && window.appState.isVipActive()) ? 2.0 : 1.0;
    const ambMult = (window.appState && window.appState.state && window.appState.state.isAmbassador) ? 2.0 : 1.0;
    const playerMult = nftMult * vipMult * ambMult;
    const globalMult = (window.appState && window.appState.state && window.appState.state.globalEarnMultiplier) ? parseFloat(window.appState.state.globalEarnMultiplier) : 1.0;
    const rawBase = (this.score * 0.015) * globalMult;
    let livePgt = (rawBase * playerMult) + ((this.bonusTokensCollected || 0) * 5.0);
    const earnedEl = document.getElementById('invaders-live-earned');
    if (earnedEl) earnedEl.innerText = livePgt.toFixed(2);
    const boostLabelEl = document.getElementById('invaders-nft-boost-label');
    if (boostLabelEl) boostLabelEl.innerText = `${playerMult.toFixed(1)}x`;
  }

  dropPowerup(x, y, isBossOrUfo = false, isGoldenUfo = false) {
    const now = Date.now();
    const lastPgtBoxTime = parseInt(localStorage.getItem('polygame_last_pgt_box_time') || '0', 10);
    const lastLifeTime = parseInt(localStorage.getItem('polygame_last_life_time') || '0', 10);

    const pgtBoxCooldownMs = 20 * 60 * 1000; // 20 real-world minutes (1,200,000 ms)
    const lifeCooldownMs = 5 * 60 * 1000;    // 5 real-world minutes (300,000 ms)

    // 0. Quantum Relic Drop check (~0.10% from standard aliens, ~6% from Golden UFO / Boss)
    const relicChance = isGoldenUfo ? 0.08 : (isBossOrUfo ? 0.05 : 0.0010);
    if (Math.random() < relicChance) {
      // 50% Rare (Ion Core), 35% Epic (Plasma Dynamo), 15% Legendary (Sub-Space Transmitter)
      const relicRand = Math.random();
      let pickedRelic = { id: 'relic_invaders_core', name: 'Ion Core', rarity: 'rare', color: '#00f0ff' };
      if (relicRand < 0.15) {
        pickedRelic = { id: 'relic_invaders_transmitter', name: 'Sub-Space Transmitter', rarity: 'legendary', color: '#ffd700' };
      } else if (relicRand < 0.50) {
        pickedRelic = { id: 'relic_invaders_dynamo', name: 'Plasma Dynamo', rarity: 'epic', color: '#bd00ff' };
      }

      this.powerups.push({
        x: x - 13,
        y: y,
        w: 26,
        h: 26,
        type: 'quantum_relic',
        relicId: pickedRelic.id,
        relicName: pickedRelic.name,
        relicColor: pickedRelic.color,
        relicRarity: pickedRelic.rarity
      });
      return;
    }

    // 1. Ultra-Rare PGT Box check (20-min real world cooldown + strict drop probability)
    const pgtBoxChance = isGoldenUfo ? 0.25 : (isBossOrUfo ? 0.04 : 0.005);
    if ((lastPgtBoxTime === 0 || now - lastPgtBoxTime >= pgtBoxCooldownMs) && Math.random() < pgtBoxChance) {
      localStorage.setItem('polygame_last_pgt_box_time', now.toString());
      this.powerups.push({ x: x - 11, y: y, w: 22, h: 22, type: 'pgt_box' });
      return;
    }

    // 2. Rare Extra Life check (5-min real world cooldown + strict drop probability)
    const lifeChance = isGoldenUfo ? 0.40 : (isBossOrUfo ? 0.12 : 0.01);
    if ((lastLifeTime === 0 || now - lastLifeTime >= lifeCooldownMs) && Math.random() < lifeChance) {
      localStorage.setItem('polygame_last_life_time', now.toString());
      this.powerups.push({ x: x - 11, y: y, w: 22, h: 22, type: 'life' });
      return;
    }

    // 3. Regular or Golden UFO drops
    const types = ['spread', 'shield', 'emp', 'beam', 'freeze'];
    let selected = types[Math.floor(Math.random() * types.length)];
    if (isGoldenUfo) {
      selected = ['emp', 'beam', 'spread', 'shield'][Math.floor(Math.random() * 4)];
    }

    this.powerups.push({ x: x - 11, y: y, w: 22, h: 22, type: selected });
  }

  triggerEMP() {
    this.particles.push({ text: '💣 EMP BLAST WAVE!', color: '#ff5500', x: this.player ? this.player.x - 20 : 100, y: this.player ? this.player.y - 30 : 200, vy: -2, life: 1.5 });
    if (window.sfx && window.sfx.playExplosion) window.sfx.playExplosion();

    // Destroy all enemy bullets
    this.enemyBullets = [];

    // Destroy all invaders on screen
    for (let inv of this.invaders) {
      this.spawnExplosionParticles(inv.x + inv.w / 2, inv.y + inv.h / 2, inv.color, 12);
      this.score += (inv.type === 'tank' ? 5 : 1);
    }
    this.invaders = [];
    this.updateLiveScore();

    // Damage Boss if active
    if (this.boss) {
      this.boss.hp = Math.max(0, this.boss.hp - 18);
      this.spawnExplosionParticles(this.boss.x + this.boss.w / 2, this.boss.y + this.boss.h / 2, '#ff0000', 30);
    }
  }

  update() {
    this.gameTime++;

    // Update Death Animation Timer
    if (this.isDying) {
      this.deathTimer--;
      // Update explosion particles during death animation
      for (let pIdx = this.particles.length - 1; pIdx >= 0; pIdx--) {
        const p = this.particles[pIdx];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        if (p.alpha <= 0) this.particles.splice(pIdx, 1);
      }
      if (this.deathTimer <= 0) {
        this.gameOver();
      }
      return; // Freeze player and game updates while dying
    }

    // Invincible Timer
    if (this.invincibleTimer > 0) {
      this.invincibleTimer--;
    }

    // 1. Move Player
    const dx = (this.keys.a || this.keys.ArrowLeft ? -1 : 0) + (this.keys.d || this.keys.ArrowRight ? 1 : 0);
    if (this.player) {
      this.player.x += dx * this.player.speed;
      if (this.player.x < 10) this.player.x = 10;
      if (this.player.x > this.width - this.player.w - 10) this.player.x = this.width - this.player.w - 10;
    }

    // Update active powerup timers
    if (this.beamTimer > 0) this.beamTimer--;
    if (this.freezeTimer > 0) this.freezeTimer--;

    // 2. Fire Laser Bullet
    const fireRate = this.beamTimer > 0 ? 8 : (this.hasSpread ? 15 : 25);
    
    if (this.keys[" "] && this.gameTime - this.lastShotTime > fireRate) {
      if (this.beamTimer > 0) {
        // Hyper-Beam Piercing Mega Lasers
        this.bullets.push({ x: this.player.x + this.player.w / 2 - 4, y: this.player.y - 14, w: 8, h: 18, vy: -11.0, vx: 0, isBeam: true });
      } else if (this.hasSpread) {
        this.bullets.push({ x: this.player.x + this.player.w / 2 - 2, y: this.player.y - 10, w: 4, h: 10, vy: -7.0, vx: 0 });
        this.bullets.push({ x: this.player.x + this.player.w / 2 - 2, y: this.player.y - 10, w: 4, h: 10, vy: -6.5, vx: -2.0 });
        this.bullets.push({ x: this.player.x + this.player.w / 2 - 2, y: this.player.y - 10, w: 4, h: 10, vy: -6.5, vx: 2.0 });
      } else {
        this.bullets.push({ x: this.player.x + this.player.w / 2 - 2, y: this.player.y - 10, w: 4, h: 10, vy: -7.0, vx: 0 });
      }
      this.lastShotTime = this.gameTime;
      if (window.sfx && window.sfx.playRoshamboDrum) window.sfx.playRoshamboDrum();
    }

    // 3. Update Player Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y += b.vy;
      b.x += b.vx;
      if (b.y < 0 || b.x < 0 || b.x > this.width) {
        this.bullets.splice(i, 1);
      }
    }

    // Update Enemy Bullets (affected by Chrono Freeze)
    const bulletSpeedMult = this.freezeTimer > 0 ? 0.25 : 1.0;
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.y += (b.vy * bulletSpeedMult);
      
      // Collision with player
      if (
        b.x < this.player.x + this.player.w &&
        b.x + b.w > this.player.x &&
        b.y < this.player.y + this.player.h &&
        b.y + b.h > this.player.y
      ) {
        this.enemyBullets.splice(i, 1);
        this.loseLife();
        if (this.isDying) return;
      } else if (b.y > this.height) {
        this.enemyBullets.splice(i, 1);
      }
    }

    // 4. Update Powerups & Pickups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.y += 1.8;
      if (
        p.x < this.player.x + this.player.w &&
        p.x + p.w > this.player.x &&
        p.y < this.player.y + this.player.h &&
        p.y + p.h > this.player.y
      ) {
        if (p.type === 'quantum_relic') {
          this.score += 1000;
          this.particles.push({ text: `🏺 ${p.relicName.toUpperCase()}!`, color: p.relicColor || '#ffd700', x: this.player.x - 20, y: this.player.y - 30, vy: -2, life: 2.5 });
          if (window.triggerToast) window.triggerToast(`🏺 QUANTUM RELIC HARVESTED! ${p.relicName} (+1 In-Game Relic)`, "success");

          // Optimistic local state update
          if (window.appState && window.appState.state) {
            const currentRelics = { ...(window.appState.state.relics || {}) };
            const prev = currentRelics[p.relicId] || { unminted: 0, onchain: 0, total: 0, token_ids: [] };
            currentRelics[p.relicId] = {
              unminted: (prev.unminted || 0) + 1,
              onchain: prev.onchain || 0,
              total: (prev.unminted || 0) + 1 + (prev.onchain || 0),
              token_ids: prev.token_ids || []
            };
            window.appState.update({ relics: currentRelics });
            if (typeof window.renderRelicsVault === 'function') {
              window.renderRelicsVault();
            }
          }

          // Atomic DB sync
          const sbClient = window.supabaseClient || (window.supabase && typeof window.supabase.rpc === 'function' ? window.supabase : null);
          if (sbClient && window.appState && window.appState.state) {
            const pId = window.appState.state.playerId || window.appState.state.walletAddress;
            if (pId) {
              sbClient.rpc('grant_relic_drop', {
                p_player_id: pId,
                p_relic_id: p.relicId,
                p_amount: 1
              }).then(res => {
                if (res && res.data) {
                  window.appState.update({ relics: res.data });
                  if (typeof window.renderRelicsVault === 'function') {
                    window.renderRelicsVault();
                  }
                }
              }).catch(e => console.warn("[Relic Harvest Sync]", e));
            }
          }
        } else if (p.type === 'spread') {
          this.hasSpread = true; // Spread shot active until losing a life
          this.particles.push({ text: '🔱 TRIPLE SHOOTER!', color: '#ff00ff', x: this.player.x, y: this.player.y - 20, vy: -1.5, life: 1.2 });
        } else if (p.type === 'shield') {
          this.hasShield = true; // Shield bubble active
          this.particles.push({ text: '🛡️ SHIELD ONLINE!', color: '#00f0ff', x: this.player.x, y: this.player.y - 20, vy: -1.5, life: 1.2 });
        } else if (p.type === 'life') {
          this.lives = Math.min(5, this.lives + 1);
          const livesEl = document.getElementById('invaders-live-lives');
          if (livesEl) livesEl.innerText = this.lives;
          this.particles.push({ text: '+1 EXTRA LIFE!', color: '#ff0055', x: this.player.x, y: this.player.y - 20, vy: -1.5, life: 1.5 });
          if (window.triggerToast) window.triggerToast("❤️ EXTRA LIFE RECOVERED! Lives: " + this.lives, "success");
        } else if (p.type === 'pgt_box') {
          // +20 PGT bonus reward verified and credited at game over
          this.bonusTokensCollected = (this.bonusTokensCollected || 0) + 4;
          this.particles.push({ text: '+20 PGT VAULT!', color: '#ffaa00', x: this.player.x - 20, y: this.player.y - 30, vy: -2, life: 2.0 });
          if (window.triggerToast) window.triggerToast("🎁 PGT VAULT CLAIMED! +20 PGT Bonus Earned!", "warning");
        } else if (p.type === 'emp') {
          this.triggerEMP();
        } else if (p.type === 'beam') {
          this.beamTimer = 300; // 5 seconds mega laser
          this.particles.push({ text: '⚡ HYPER BEAM OVERCHARGE!', color: '#ffee00', x: this.player.x - 20, y: this.player.y - 20, vy: -1.5, life: 1.5 });
        } else if (p.type === 'freeze') {
          this.freezeTimer = 360; // 6 seconds chrono freeze
          this.particles.push({ text: '❄️ CHRONO STASIS!', color: '#38bdf8', x: this.player.x - 10, y: this.player.y - 20, vy: -1.5, life: 1.5 });
        }

        this.powerups.splice(i, 1);
        if (window.sfx && window.sfx.playPowerup) window.sfx.playPowerup();
        continue;
      }
      if (p.y > this.height) {
        this.powerups.splice(i, 1);
      }
    }

    // 5. Update UFOs (Random regular UFO or Golden UFO)
    if (this.boss === null && this.ufos.length === 0 && Math.random() < 0.003) {
      const isGolden = Math.random() < 0.18; // 18% chance for Golden Mystery UFO
      this.ufos.push({
        x: Math.random() > 0.5 ? -40 : this.width + 40,
        y: 15,
        w: 42,
        h: 18,
        vx: isGolden ? 3.5 : 2.5,
        isGolden: isGolden,
        color: isGolden ? '#ffcc00' : '#ff0000'
      });
      if (this.ufos[0].x > 0) this.ufos[0].vx *= -1;
    }
    
    for (let i = this.ufos.length - 1; i >= 0; i--) {
      const ufo = this.ufos[i];
      ufo.x += ufo.vx;
      if (ufo.x < -100 || ufo.x > this.width + 100) {
        this.ufos.splice(i, 1);
      }
    }

    // 6. Update Boss
    if (this.boss) {
      this.boss.x += this.boss.vx;
      if (this.boss.x < 10 || this.boss.x > this.width - this.boss.w - 10) {
        this.boss.vx *= -1;
      }
      // Boss Shoot
      if (Math.random() < 0.04 + (this.level * 0.004)) {
        this.enemyBullets.push({
          x: this.boss.x + this.boss.w / 2, y: this.boss.y + this.boss.h, w: 6, h: 12, vy: 3.2
        });
        if (Math.random() < 0.3) {
          this.enemyBullets.push({ x: this.boss.x + 10, y: this.boss.y + this.boss.h, w: 6, h: 12, vy: 2.8 });
          this.enemyBullets.push({ x: this.boss.x + this.boss.w - 10, y: this.boss.y + this.boss.h, w: 6, h: 12, vy: 2.8 });
        }
      }
    }

    // 7. Update Invaders Grid
    if (this.invaders.length > 0) {
      let shiftDown = false;
      let invDirection = 0;

      // Remove off-screen diving invaders first
      for (let i = this.invaders.length - 1; i >= 0; i--) {
        if (this.invaders[i].diving && this.invaders[i].y > this.height) {
          this.invaders.splice(i, 1);
        }
      }

      for (const inv of this.invaders) {
        if (!inv.diving) {
          inv.x += inv.vx;
          if (inv.x < 10 || inv.x > this.width - inv.w - 10) {
            shiftDown = true;
            invDirection = -inv.vx;
          }
        } else {
          inv.y += 3.8; // Dive bomb (30% speed reduction)
        }

        // Random shooting (increases with level)
        if (!inv.diving && Math.random() < 0.001 + (this.level * 0.0004)) {
          this.enemyBullets.push({
            x: inv.x + inv.w / 2 - 2,
            y: inv.y + inv.h,
            w: 4,
            h: 10,
            vy: 2.5 + (this.level * 0.14)
          });
        }
        
        // Random Kamikaze Dive
        if (inv.type === 'kamikaze' && !inv.diving && Math.random() < 0.002) {
          inv.diving = true;
        }
        
        // Collision with player
        if (
          inv.x < this.player.x + this.player.w &&
          inv.x + inv.w > this.player.x &&
          inv.y < this.player.y + this.player.h &&
          inv.y + inv.h > this.player.y
        ) {
          this.spawnExplosionParticles(inv.x + inv.w/2, inv.y + inv.h/2, inv.color, 10);
          inv.y = -100;
          this.loseLife();
          if (this.isDying) return;
        }
      }

      if (shiftDown) {
        for (const inv of this.invaders) {
          if (!inv.diving) {
            inv.y += 12;
            inv.vx = invDirection;
            if (inv.y > this.player.y - 10) {
              this.loseLife();
              if (this.isDying) return;
            }
          }
        }
      }
    }

    // Spawn new waves if all destroyed
    if (!this.boss && this.invaders.length === 0) {
      this.level++;
      this.spawnWave();
    }
    if (this.boss && this.boss.hp <= 0) {
      this.spawnExplosionParticles(this.boss.x + this.boss.w/2, this.boss.y + this.boss.h/2, '#ff0000', 40);
      this.score += 200;
      this.updateLiveScore();
      
      this.dropPowerup(this.boss.x + this.boss.w / 2, this.boss.y + this.boss.h / 2, true, false);
      
      this.boss = null;
      this.level++;
      this.spawnWave();
    }

    // 8. Collisions (Player Bullet vs Enemies)
    for (let bIdx = this.bullets.length - 1; bIdx >= 0; bIdx--) {
      const b = this.bullets[bIdx];
      let hit = false;
      
      // Boss collision
      if (this.boss && b.x < this.boss.x + this.boss.w && b.x + b.w > this.boss.x && b.y < this.boss.y + this.boss.h && b.y + b.h > this.boss.y) {
        this.boss.hp--;
        this.spawnExplosionParticles(b.x, b.y, '#ffffff', 3);
        if (!b.isBeam) this.bullets.splice(bIdx, 1);
        continue;
      }

      // UFO collision
      for (let uIdx = this.ufos.length - 1; uIdx >= 0; uIdx--) {
        const u = this.ufos[uIdx];
        if (b.x < u.x + u.w && b.x + b.w > u.x && b.y < u.y + u.h && b.y + b.h > u.y) {
          this.spawnExplosionParticles(u.x + u.w / 2, u.y + u.h / 2, u.color, 15);
          this.score += u.isGolden ? 200 : 50;
          this.updateLiveScore();
          
          this.dropPowerup(u.x + u.w/2, u.y + u.h/2, true, u.isGolden);
          
          this.ufos.splice(uIdx, 1);
          if (!b.isBeam) this.bullets.splice(bIdx, 1);
          hit = true;
          break;
        }
      }
      if (hit) continue;

      // Invader collision
      for (let invIdx = this.invaders.length - 1; invIdx >= 0; invIdx--) {
        const inv = this.invaders[invIdx];
        if (b.x < inv.x + inv.w && b.x + b.w > inv.x && b.y < inv.y + inv.h && b.y + b.h > inv.y) {
          this.spawnExplosionParticles(b.x, b.y, inv.color, 5);
          inv.hp--;
          if (inv.hp <= 0) {
            this.spawnExplosionParticles(inv.x + inv.w / 2, inv.y + inv.h / 2, inv.color, 10);
            
            if (Math.random() < 0.08) {
              this.dropPowerup(inv.x + inv.w/2, inv.y + inv.h/2, false, false);
            }

            this.invaders.splice(invIdx, 1);
            this.score += (inv.type === 'tank' ? 5 : 1);
            this.updateLiveScore();
          }
          if (!b.isBeam) this.bullets.splice(bIdx, 1);
          break;
        }
      }
    }

    // 9. Update Particles
    for (let pIdx = this.particles.length - 1; pIdx >= 0; pIdx--) {
      const p = this.particles[pIdx];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.03;
      if (p.alpha <= 0) {
        this.particles.splice(pIdx, 1);
      }
    }
  }

  spawnExplosionParticles(x, y, color, count=8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 3.0;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color,
        alpha: 1.0,
        size: 3
      });
    }
  }

  draw() {
    this.ctx.fillStyle = '#06080c';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Screen Shake / Flash on Death
    if (this.isDying) {
      const shakeX = (Math.random() - 0.5) * 10;
      const shakeY = (Math.random() - 0.5) * 10;
      this.ctx.save();
      this.ctx.translate(shakeX, shakeY);

      // Red Screen Flash overlay
      this.ctx.fillStyle = `rgba(255, 0, 85, ${this.deathTimer / 120})`;
      this.ctx.fillRect(-10, -10, this.width + 20, this.height + 20);
    }

    // Grid details
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.02)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 40) {
      this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.height); this.ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 40) {
      this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(this.width, y); this.ctx.stroke();
    }

    // Draw Shield
    if (this.player && this.hasShield && !this.isDying) {
      this.ctx.strokeStyle = '#00ffff';
      this.ctx.lineWidth = 2;
      this.ctx.shadowColor = '#00ffff';
      this.ctx.shadowBlur = 10;
      this.ctx.beginPath();
      this.ctx.arc(this.player.x + this.player.w/2, this.player.y + this.player.h/2, 25, 0, Math.PI*2);
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
    }

    // Draw Spread Gun indicator
    if (this.player && this.hasSpread && !this.isDying) {
      this.ctx.strokeStyle = '#00ff00';
      this.ctx.lineWidth = 1;
      this.ctx.shadowColor = '#00ff00';
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      this.ctx.arc(this.player.x + this.player.w/2, this.player.y + this.player.h/2, 22, 0, Math.PI*2);
      this.ctx.stroke();
      this.ctx.shadowBlur = 0;
    }

    // Draw Ship (only if not dead)
    if (this.player && !this.isDying) {
      if (this.invincibleTimer > 0 && Math.floor(this.gameTime / 6) % 2 === 0) {
        this.ctx.globalAlpha = 0.3;
      }
      this.ctx.shadowColor = '#00ffff';
      this.ctx.shadowBlur = 25;
      this.ctx.fillStyle = '#00ffff';
      this.ctx.fillRect(this.player.x, this.player.y + 5, this.player.w, this.player.h - 5);
      this.ctx.fillRect(this.player.x + this.player.w / 2 - 4, this.player.y - 8, 8, 12);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = '#ffffff';
      this.ctx.shadowBlur = 15;
      this.ctx.fillRect(this.player.x + 4, this.player.y + 7, this.player.w - 8, 5);
      this.ctx.fillRect(this.player.x + this.player.w / 2 - 2, this.player.y - 10, 4, 10);
      this.ctx.fillStyle = '#ff0055';
      this.ctx.shadowColor = '#ff0055';
      this.ctx.shadowBlur = 12;
      this.ctx.fillRect(this.player.x + 8, this.player.y + this.player.h, 4, 6);
      this.ctx.fillRect(this.player.x + this.player.w - 12, this.player.y + this.player.h, 4, 6);
      this.ctx.globalAlpha = 1.0;
    }

    // Draw Bullets (Player)
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 8;
    for (const b of this.bullets) {
      this.ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    // Draw Enemy Bullets (bright magenta-pink for high visibility)
    this.ctx.shadowBlur = 12;
    for (const b of this.enemyBullets) {
      this.ctx.fillStyle = '#ff2266';
      this.ctx.shadowColor = '#ff2266';
      this.ctx.fillRect(b.x - 1, b.y, b.w + 2, b.h);
    }

    // Draw Powerups & Pickups (High-Def Vector Emblems)
    for (const p of this.powerups) {
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      const r = p.w / 2;

      this.ctx.save();

      // Determine color scheme per type
      let mainColor = '#00ff00';
      if (p.type === 'quantum_relic') mainColor = p.relicColor || '#ffd700'; // Quantum Relic Aura
      else if (p.type === 'shield') mainColor = '#00f0ff';       // Cyan Shield
      else if (p.type === 'spread') mainColor = '#ff00ff';   // Magenta Triple Shoot
      else if (p.type === 'life') mainColor = '#ff0055';     // Pink Heart Extra Life
      else if (p.type === 'pgt_box') mainColor = '#ffaa00';  // Golden PGT Vault
      else if (p.type === 'emp') mainColor = '#ff5500';      // Orange EMP Bomb
      else if (p.type === 'beam') mainColor = '#ffee00';     // Yellow Lightning Hyper-Beam
      else if (p.type === 'freeze') mainColor = '#38bdf8';   // Ice Blue Chrono Freeze

      // Outer Glowing Badge Circle
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(10, 15, 30, 0.88)';
      this.ctx.strokeStyle = mainColor;
      this.ctx.lineWidth = 2;
      this.ctx.shadowColor = mainColor;
      this.ctx.shadowBlur = 12;
      this.ctx.fill();
      this.ctx.stroke();

      // Vector Icon Emblems
      if (p.type === 'quantum_relic') {
        this.ctx.font = 'bold 13px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🏺', cx, cy);
      } else if (p.type === 'shield') {
        // 🛡️ SHIELD: Hexagonal Shield Crest
        this.ctx.fillStyle = '#00f0ff';
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy - r + 5);
        this.ctx.lineTo(cx + r - 5, cy - r + 7);
        this.ctx.lineTo(cx + r - 6, cy + 2);
        this.ctx.lineTo(cx, cy + r - 4);
        this.ctx.lineTo(cx - r + 6, cy + 2);
        this.ctx.lineTo(cx - r + 5, cy - r + 7);
        this.ctx.closePath();
        this.ctx.fill();

        // Inner glowing core dot
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(cx, cy - 1, 2.5, 0, Math.PI * 2);
        this.ctx.fill();

      } else if (p.type === 'spread') {
        // 🔱 TRIPLE SHOOT: 3 Upward Spreading Laser Bolts
        this.ctx.strokeStyle = '#ff00ff';
        this.ctx.lineWidth = 2.0;
        
        // Center bolt
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy + 5);
        this.ctx.lineTo(cx, cy - 5);
        this.ctx.stroke();

        // Left angled bolt
        this.ctx.beginPath();
        this.ctx.moveTo(cx - 2, cy + 4);
        this.ctx.lineTo(cx - 6, cy - 4);
        this.ctx.stroke();

        // Right angled bolt
        this.ctx.beginPath();
        this.ctx.moveTo(cx + 2, cy + 4);
        this.ctx.lineTo(cx + 6, cy - 4);
        this.ctx.stroke();

        // Arrow tips
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(cx, cy - 5, 1.5, 0, Math.PI * 2);
        this.ctx.arc(cx - 6, cy - 4, 1.5, 0, Math.PI * 2);
        this.ctx.arc(cx + 6, cy - 4, 1.5, 0, Math.PI * 2);
        this.ctx.fill();

      } else if (p.type === 'life') {
        // ❤️ EXTRA LIFE: Glowing 3D Heart
        this.ctx.fillStyle = '#ff0055';
        this.ctx.beginPath();
        const topY = cy - 3;
        this.ctx.moveTo(cx, topY + 8);
        this.ctx.bezierCurveTo(cx - 8, topY + 1, cx - 8, topY - 6, cx, topY - 1);
        this.ctx.bezierCurveTo(cx + 8, topY - 6, cx + 8, topY + 1, cx, topY + 8);
        this.ctx.fill();

        // White shine highlight
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(cx - 3, topY - 2, 1.2, 0, Math.PI * 2);
        this.ctx.fill();

      } else if (p.type === 'pgt_box') {
        // 🎁 / 🪙 PGT MYSTERY VAULT: Gold Box + Ribbon
        this.ctx.fillStyle = '#ffaa00';
        this.ctx.fillRect(cx - 7, cy - 5, 14, 10);
        this.ctx.fillStyle = '#ffee00';
        this.ctx.fillRect(cx - 8, cy - 7, 16, 4);
        
        // Ribbon / Lock core
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(cx - 1.5, cy - 7, 3, 12);
        this.ctx.fillRect(cx - 7, cy - 2, 14, 3);

      } else if (p.type === 'emp') {
        // 💣 EMP NUKE: Plasma Orb Bomb
        this.ctx.fillStyle = '#ff5500';
        this.ctx.beginPath();
        this.ctx.arc(cx, cy + 2, 5, 0, Math.PI * 2);
        this.ctx.fill();

        // Fuse & Spark
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(cx - 1, cy - 5, 2, 3);
        this.ctx.fillStyle = '#ffff00';
        this.ctx.beginPath();
        this.ctx.arc(cx, cy - 6, 2, 0, Math.PI * 2);
        this.ctx.fill();

      } else if (p.type === 'beam') {
        // ⚡ HYPER BEAM: Lightning Bolt
        this.ctx.fillStyle = '#ffee00';
        this.ctx.beginPath();
        this.ctx.moveTo(cx + 1, cy - 7);
        this.ctx.lineTo(cx - 5, cy + 1);
        this.ctx.lineTo(cx - 1, cy + 1);
        this.ctx.lineTo(cx - 2, cy + 7);
        this.ctx.lineTo(cx + 5, cy - 1);
        this.ctx.lineTo(cx, cy - 1);
        this.ctx.closePath();
        this.ctx.fill();

      } else if (p.type === 'freeze') {
        // ❄️ CHRONO FREEZE: Ice Snowflake Cross
        this.ctx.strokeStyle = '#38bdf8';
        this.ctx.lineWidth = 1.8;
        this.ctx.beginPath();
        this.ctx.moveTo(cx - 6, cy); this.ctx.lineTo(cx + 6, cy);
        this.ctx.moveTo(cx, cy - 6); this.ctx.lineTo(cx, cy + 6);
        this.ctx.moveTo(cx - 4, cy - 4); this.ctx.lineTo(cx + 4, cy + 4);
        this.ctx.moveTo(cx - 4, cy + 4); this.ctx.lineTo(cx + 4, cy - 4);
        this.ctx.stroke();

        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    // Draw Invaders
    for (const inv of this.invaders) {
      this.ctx.fillStyle = inv.color;
      this.ctx.shadowColor = inv.color;
      this.ctx.shadowBlur = 8;
      this.ctx.fillRect(inv.x, inv.y, inv.w, inv.h);
      this.ctx.fillStyle = '#fff';
      if (inv.type === 'tank') {
        const w = (inv.w - 8) / 3;
        for (let i = 0; i < inv.hp; i++) {
          this.ctx.fillRect(inv.x + 4 + (i * w), inv.y + 4, w - 1, inv.h - 8);
        }
      } else {
        this.ctx.fillRect(inv.x + 4, inv.y + 4, inv.w - 8, inv.h - 8);
      }
    }

    // Draw UFOs
    for (const u of this.ufos) {
      this.ctx.fillStyle = u.color;
      this.ctx.shadowColor = u.color;
      this.ctx.shadowBlur = 15;
      this.ctx.beginPath();
      this.ctx.ellipse(u.x + u.w/2, u.y + u.h/2, u.w/2, u.h/2, 0, 0, Math.PI*2);
      this.ctx.fill();
      this.ctx.fillStyle = '#fff';
      this.ctx.beginPath();
      this.ctx.arc(u.x + u.w/2, u.y + u.h/2 - 4, u.w/4, 0, Math.PI*2);
      this.ctx.fill();
    }

    // Draw Boss
    if (this.boss) {
      this.ctx.fillStyle = this.boss.color;
      this.ctx.shadowColor = this.boss.color;
      this.ctx.shadowBlur = 20;
      this.ctx.fillRect(this.boss.x, this.boss.y, this.boss.w, this.boss.h);
      
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(this.boss.x + 10, this.boss.y + 10, 20, 20);
      this.ctx.fillRect(this.boss.x + this.boss.w - 30, this.boss.y + 10, 20, 20);
      
      this.ctx.fillStyle = '#fff';
      this.ctx.shadowColor = '#fff';
      this.ctx.fillRect(this.boss.x + 15, this.boss.y + 15, 10, 10);
      this.ctx.fillRect(this.boss.x + this.boss.w - 25, this.boss.y + 15, 10, 10);

      // Boss Health Bar
      this.ctx.fillStyle = '#444';
      this.ctx.fillRect(this.boss.x, this.boss.y - 15, this.boss.w, 8);
      this.ctx.fillStyle = '#ff0000';
      const hpPct = Math.max(0, this.boss.hp / this.boss.maxHp);
      this.ctx.fillRect(this.boss.x, this.boss.y - 15, this.boss.w * hpPct, 8);
    }

    // Draw Particles
    this.ctx.shadowBlur = 4;
    for (const p of this.particles) {
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      const sz = p.size || 3;
      this.ctx.fillRect(p.x, p.y, sz, sz);
    }
    this.ctx.globalAlpha = 1.0;
    this.ctx.shadowBlur = 0;

    if (this.isDying) {
      this.ctx.restore();
    }
  }
}

let invadersEngine = null;

function runInvadersGame() {
  const canvas = document.getElementById('invaders-canvas');
  const overlay = document.getElementById('invaders-ui-overlay');
  if (!canvas || !overlay) {
    console.warn("Invaders elements not found in DOM");
    return;
  }

  if (!invadersEngine) {
    invadersEngine = new CyberInvaders('invaders-canvas', 'invaders-ui-overlay');
    window.invadersGame = invadersEngine;
  } else {
    invadersEngine.canvas = canvas;
    invadersEngine.ctx = canvas.getContext('2d');
    invadersEngine.overlay = overlay;
  }
  invadersEngine.startGame();
}

window.startInvadersGame = runInvadersGame;
window.startInvaderGame = runInvadersGame;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('btn-start-invaders');
    if (startBtn) startBtn.onclick = runInvadersGame;
  });
} else {
  const startBtn = document.getElementById('btn-start-invaders');
  if (startBtn) startBtn.onclick = runInvadersGame;
}
