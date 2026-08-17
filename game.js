/**
 * Astro-Dodge Mini-Game Engine (HTML5 Canvas)
 * A retro-neon arcade game where players guide a neon ship,
 * collect energy shards, and dodge obstacle mine gates to earn PGT.
 */

class NeonAstroDodge {
  constructor(canvasId, overlayId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.overlay = document.getElementById(overlayId);
    
    // Canvas dimensions
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // Game state variables
    this.isPlaying = false;
    this.score = 0;
    this.shardsCollected = 0;
    this.difficulty = 1;
    this.gameTime = 0;
    
    // Key binds state
    this.keys = {
      w: false, s: false, a: false, d: false,
      ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false,
      ' ': false, Spacebar: false
    };

    // Game Entities
    this.player = null;
    this.obstacles = [];
    this.collectibles = [];
    this.particles = [];
    this.powerups = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.boss = null;
    this.lastBossSpawnFrame = 0;

    this.initEvents();
  }

  initEvents() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        if (this.isPlaying) {
          e.preventDefault();
          this.keys[' '] = true;
          if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
          }
          this.shootPlasma();
        }
      } else if (this.keys.hasOwnProperty(e.key)) {
        this.keys[e.key] = true;
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && this.isPlaying) {
          e.preventDefault();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        this.keys[' '] = false;
      } else if (this.keys.hasOwnProperty(e.key)) {
        this.keys[e.key] = false;
      }
    });

    const containerEl = document.getElementById('game-window-container') || this.canvas;
    let touchStartY = 0;
    let touchStartX = 0;

    containerEl.addEventListener('touchstart', (e) => {
      if (!this.isPlaying || e.touches.length === 0) return;
      if (e.target.closest('.btn-fullscreen-close') || e.target.closest('button')) return;
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
    }, { passive: true });

    containerEl.addEventListener('touchmove', (e) => {
      if (!this.isPlaying || e.touches.length === 0) return;
      if (e.target.closest('.btn-fullscreen-close') || e.target.closest('button')) return;
      e.preventDefault();
      
      const touchY = e.touches[0].clientY;
      const touchX = e.touches[0].clientX;
      const diffY = touchY - touchStartY;
      const diffX = touchX - touchStartX;
      
      if (this.player) {
        this.player.y += diffY * 0.8;
        this.player.x += diffX * 0.8;
        if (this.player.y < this.player.radius) this.player.y = this.player.radius;
        if (this.player.y > this.height - this.player.radius) this.player.y = this.height - this.player.radius;
        if (this.player.x < this.player.radius) this.player.x = this.player.radius;
        if (this.player.x > this.width - this.player.radius) this.player.x = this.width - this.player.radius;
      }
      
      touchStartY = touchY;
      touchStartX = touchX;
    }, { passive: false });

    // Click handler to launch game
    const startBtn = document.getElementById('btn-start-game');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startGame());
    }
  }

  shootPlasma() {
    if (!this.player || !this.isPlaying) return;
    const now = performance.now();
    if (this.lastShootTime && now - this.lastShootTime < 140) return;
    this.lastShootTime = now;

    if (this.player.tripleGun) {
      this.bullets.push({ x: this.player.x + 22, y: this.player.y - 8, vx: 12, vy: -1.6, isTriple: true });
      this.bullets.push({ x: this.player.x + 25, y: this.player.y, vx: 13, vy: 0, isTriple: true });
      this.bullets.push({ x: this.player.x + 22, y: this.player.y + 8, vx: 12, vy: 1.6, isTriple: true });
    } else {
      this.bullets.push({ x: this.player.x + 22, y: this.player.y - 5, vx: 12, vy: 0 });
      this.bullets.push({ x: this.player.x + 22, y: this.player.y + 5, vx: 12, vy: 0 });
    }
    if (typeof sfx.playLaser === 'function') sfx.playLaser();
  }

  startGame() {
    sfx.init();
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    
    // Reset state
    this.isPlaying = true;
    this.score = 0;
    this.shardsCollected = 0;
    this.difficulty = 1;
    this.gameTime = 0;
    this.lastTime = performance.now();
    this.accumulatedTime = 0;
    this.obstacles = [];
    this.collectibles = [];
    this.particles = [];
    this.powerups = [];
    this.floatTexts = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.boss = null;
    this.lastBossSpawnFrame = 0;
    this.slowMo = false;
    this.slowMoTime = 0;

    // Generate 45 Parallax Starfield particles
    this.stars = [];
    for (let i = 0; i < 45; i++) {
      this.stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.7 + 0.3
      });
    }

    // Initialize Neon Ship
    this.player = {
      x: 80,
      y: this.height / 2,
      radius: 14,
      speed: 5.5,
      shield: false,
      shieldTime: 0,
      tripleGun: false,
      tripleTime: 0,
      glowPulse: 0,
      tilt: 0 // Smooth 3D banking tilt
    };

    // Hide UI Overlay
    this.overlay.classList.add('hidden');
    
    // Draw initial feedback
    document.getElementById('game-live-score').innerText = '0';
    document.getElementById('game-live-shards').innerText = '0';
    document.getElementById('game-live-earned').innerText = '0.00';

    // Hook combined NFT & VIP multiplier display
    const multis = appState.getMultipliers();
    const nftMult = 1 + ((multis.nftGameMultiplier || 0) / 100);
    const vipMult = appState.isVipActive() ? 2.0 : 1.0;
    const ambMult = appState.state.isAmbassador ? 2.0 : 1.0;
    const totalBoost = nftMult * vipMult * ambMult;
    this.bonusTokensCollected = 0;
    this.sessionId = null;
    if (window.startArcadeSession) {
      window.startArcadeSession('AstroDodge').then(sid => {
        this.sessionId = sid;
      }).catch(() => {});
    }

    // Trigger game loop
    this.loop();
  }

  async gameOver() {
    if (window.trackQuestProgress) window.trackQuestProgress('games', 1);
    this.isPlaying = false;
    
    sfx.playExplosion();
    
    // Calculate rewards
    const multis = appState.getMultipliers();
    const nftMult = 1 + ((multis.nftGameMultiplier || 0) / 100);
    const isVip = appState.isVipActive();
    const vipMult = isVip ? 2.0 : 1.0;
    const isAmb = appState.state.isAmbassador;
    const ambMult = isAmb ? 2.0 : 1.0;
    const globalMult = appState.state.globalEarnMultiplier || 1.0;
    const totalMult = nftMult * vipMult * ambMult * globalMult;
    
    const cleanScore = Math.floor(this.score || 0);
    const rawPgt = (cleanScore * 0.01) + (this.shardsCollected * 0.05);
    const tokenPgt = (this.bonusTokensCollected || 0) * 5.0;
    let finalPgt = parseFloat(((rawPgt * totalMult) + tokenPgt).toFixed(2));

    // Check high score
    const currentHigh = appState.state.gameHighScore || 0;
    const isNewHigh = cleanScore > currentHigh;
    if (isNewHigh) {
      appState.update({ gameHighScore: cleanScore });
    }
    if (window.submitHighScoreToDB && cleanScore > 0) {
      window.submitHighScoreToDB('astrododge', cleanScore);
    }

    const titleEl = document.getElementById('game-overlay-title');
    const descEl = document.getElementById('game-overlay-desc');
    const playBtn = document.getElementById('btn-start-game');

    if (titleEl) {
      titleEl.innerText = "STARSHIP CRASHED";
      titleEl.style.color = "var(--color-danger)";
    }
    
    const vipBadgeStr = (isVip ? ' 🔥 <span style="color:var(--color-warning); font-size:0.8rem;">(VIP 2.0x)</span>' : '') + (isAmb ? ' 🎖️ <span style="color:var(--color-warning); font-size:0.8rem;">(Ambassador 2.0x)</span>' : '');

    let verifiedPgt = finalPgt;
    if (window.endArcadeSession && this.sessionId) {
      const res = await window.endArcadeSession(this.sessionId, cleanScore, this.shardsCollected, this.bonusTokensCollected || 0, nftMult);
      if (res && res.payout !== undefined) {
        verifiedPgt = parseFloat(res.payout);
      } else if (window.creditArcadePayout && finalPgt > 0) {
        await window.creditArcadePayout(finalPgt);
      }
    } else if (window.creditArcadePayout && finalPgt > 0) {
      await window.creditArcadePayout(finalPgt);
    }

    if (descEl) {
      descEl.innerHTML = `
        ${isNewHigh ? '<strong style="color:var(--color-warning);">🏆 NEW HIGH SCORE!</strong><br>' : ''}
        Score: <strong style="color:var(--color-primary);">${cleanScore}</strong> | Shards: <strong style="color:var(--color-accent);">${this.shardsCollected}</strong><br>
        <span style="font-size:0.9rem; color:var(--text-muted);">Base: ${rawPgt.toFixed(2)} PGT • Multiplier: <strong style="color:var(--color-secondary);">${totalMult.toFixed(1)}x</strong> (${multis.nftGameMultiplier}% NFT${vipBadgeStr})</span><br>
        <span style="font-size:1.1rem; font-weight:800; color:var(--color-success);">Final Payout: +${verifiedPgt.toFixed(2)} PGT</span>
      `;
    }

    if (playBtn) playBtn.innerText = "Relaunch Capsule";

    if (typeof window.sendDiscordEarnAnnouncement === 'function') {
      window.sendDiscordEarnAnnouncement('Astro-Dodge', this.score, verifiedPgt);
    } else if (typeof window.sendDiscordHighScore === 'function') {
      window.sendDiscordHighScore('Astro-Dodge', this.score, verifiedPgt);
    }

    if (window.appState && window.appState.addActivity) {
      window.appState.addActivity('You', `scored ${Math.floor(this.score)} in AstroDodge`, `+${verifiedPgt.toFixed(2)} PGT`);
    }

    this.overlay.classList.remove('hidden');
  }

  stop() {
    this.isPlaying = false;
    this.keys = {};
    if (this.overlay) {
      this.overlay.classList.remove('hidden');
    }
  }

  // --- Core Game Loop (Fixed 60 FPS delta cap for 90Hz/120Hz/144Hz mobile displays) ---
  loop() {
    if (!this.isPlaying) return;

    const now = performance.now();
    const delta = Math.min(now - (this.lastTime || now), 100);
    this.lastTime = now;

    this.accumulatedTime = (this.accumulatedTime || 0) + delta;
    const step = 1000 / 60; // 16.67ms per frame at 60 FPS

    while (this.accumulatedTime >= step) {
      this.update();
      this.accumulatedTime -= step;
    }

    this.draw();
    requestAnimationFrame(() => this.loop());
  }

  // --- Entity Updates ---
  update() {
    this.gameTime++;
    
    // Smooth continuous difficulty & speed acceleration (+0.015 speed increase per second)
    this.difficulty += 0.00025;
    this.baseSpeedMult = 0.9 + (this.difficulty - 1) * 0.25;

    // Update live PGT earned display
    const multis = appState.getMultipliers();
    const nftMult = 1 + ((multis.nftGameMultiplier || 0) / 100);
    const vipMult = appState.isVipActive() ? 2.0 : 1.0;
    const ambMult = appState.state.isAmbassador ? 2.0 : 1.0;
    const globalMult = appState.state.globalEarnMultiplier || 1.0;
    const totalBoost = nftMult * vipMult * ambMult;
    const liveRawPgt = ((this.score / 2500) + (this.shardsCollected * 0.05)) * globalMult;
    const liveFinalPgt = liveRawPgt * totalBoost;
    document.getElementById('game-live-earned').innerText = liveFinalPgt.toFixed(2);

    // 0. Update Stars (Parallax Starfield accelerates with base speed)
    const starSpeedMult = this.slowMo ? 0.4 : 1.0;
    this.stars.forEach(star => {
      star.x -= star.speed * (this.baseSpeedMult || 1.0) * starSpeedMult;
      if (star.x < 0) {
        star.x = this.width;
        star.y = Math.random() * this.height;
      }
    });

    // Handle Slow-Mo Chronos Timer
    if (this.slowMo) {
      this.slowMoTime--;
      if (this.slowMoTime <= 0) {
        this.slowMo = false;
        triggerToast("Chronos Warp Expired — Speed Restored!", "info");
      }
    }

    // 1. Move Player
    const dy = (this.keys.w || this.keys.ArrowUp ? -1 : 0) + (this.keys.s || this.keys.ArrowDown ? 1 : 0);
    const dx = (this.keys.a || this.keys.ArrowLeft ? -1 : 0) + (this.keys.d || this.keys.ArrowRight ? 1 : 0);
    
    if (this.player) {
      this.player.y += dy * this.player.speed;
      this.player.x += dx * this.player.speed;

      // Smooth 3D Banking Tilt
      const targetTilt = dy * 0.35; // radians (~20 deg)
      this.player.tilt += (targetTilt - this.player.tilt) * 0.2;

      // Keep player inside canvas boundary
      const pad = this.player.radius + 5;
      if (this.player.y < pad) this.player.y = pad;
      if (this.player.y > this.height - pad) this.player.y = this.height - pad;
      if (this.player.x < pad) this.player.x = pad;
      if (this.player.x > this.width / 2) this.player.x = this.width / 2; // Keep in left half

      // Decay shield timer
      if (this.player.shield) {
        this.player.shieldTime--;
        if (this.player.shieldTime <= 0) {
          this.player.shield = false;
          triggerToast("Shield deactivated!", "error");
        }
      }

      // Decay triple laser timer
      if (this.player.tripleGun) {
        this.player.tripleTime--;
        if (this.player.tripleTime <= 0) {
          this.player.tripleGun = false;
          triggerToast("Triple-Laser Overcharge Expired!", "info");
        }
      }

      // Pulse glows
      this.player.glowPulse = Math.sin(this.gameTime * 0.1) * 3;

      // Spawn thrust exhaust particles
      if (this.gameTime % 2 === 0) {
        this.particles.push({
          x: this.player.x - 14,
          y: this.player.y + (Math.random() * 6 - 3),
          vx: -(2.0 + Math.random() * 2.5),
          vy: Math.random() * 1 - 0.5,
          color: Math.random() > 0.5 ? '#00f0ff' : '#ff007f',
          alpha: 0.9,
          size: 2 + Math.random() * 3
        });
      }

      // Auto-fire dual or triple plasma blasters every 9 frames
      if (this.gameTime % 9 === 0) {
        if (this.player.tripleGun) {
          this.bullets.push({ x: this.player.x + 22, y: this.player.y - 8, vx: 12, vy: -1.6, isTriple: true });
          this.bullets.push({ x: this.player.x + 25, y: this.player.y, vx: 13, vy: 0, isTriple: true });
          this.bullets.push({ x: this.player.x + 22, y: this.player.y + 8, vx: 12, vy: 1.6, isTriple: true });
        } else {
          this.bullets.push({ x: this.player.x + 22, y: this.player.y - 5, vx: 12, vy: 0 });
          this.bullets.push({ x: this.player.x + 22, y: this.player.y + 5, vx: 12, vy: 0 });
        }
        if (typeof sfx.playLaser === 'function') sfx.playLaser();
      }
    }

    // 2. Spawn Obstacles (glowing gate beams - reduced frequency for better breathing room!)
    const spawnRate = Math.max(120 - Math.floor(this.difficulty * 6), 70);
    if (this.gameTime % spawnRate === 0) {
      const obstacleWidth = 18;
      const speed = (1.6 + Math.random() * 0.8) * (0.9 + this.difficulty * 0.1);
      
      const obstacleType = Math.random();
      let obstacleHeight = 90 + Math.random() * 100;
      let obstacleY = 0;

      if (obstacleType < 0.33) {
        obstacleY = 0;
      } else if (obstacleType < 0.66) {
        obstacleY = this.height - obstacleHeight;
      } else {
        obstacleHeight = 75 + Math.random() * 50;
        obstacleY = (this.height - obstacleHeight) / 2 + (Math.random() * 80 - 40);
      }

      this.obstacles.push({
        x: this.width + 20,
        y: obstacleY,
        w: obstacleWidth,
        h: obstacleHeight,
        vx: -speed,
        glowPulse: 0,
        nearMissChecked: false
      });
    }

    // 2.5 Spawn Asteroids & Shooter Enemy Ships
    // Spawns tumbling asteroids every ~80 frames (non-shooting)
    if (this.gameTime % 80 === 0) {
      const speed = (2.0 + Math.random() * 1.0) * (0.9 + this.difficulty * 0.1);
      const radius = 12 + Math.random() * 12;
      const startY = radius + 20 + Math.random() * (this.height - radius * 2 - 40);
      
      // Generate jagged rock points
      const points = [];
      const numPts = 7 + Math.floor(Math.random() * 4);
      for (let p = 0; p < numPts; p++) {
        const angle = (p * Math.PI * 2) / numPts;
        const radVar = radius * (0.7 + Math.random() * 0.5);
        points.push({ x: Math.cos(angle) * radVar, y: Math.sin(angle) * radVar });
      }

      this.enemies.push({
        type: 'asteroid',
        x: this.width + 30,
        y: startY,
        baseY: startY,
        radius: radius,
        vx: -speed,
        rotation: 0,
        rotSpeed: (Math.random() - 0.5) * 0.08,
        points: points,
        hp: radius > 18 ? 2 : 1
      });
    }

    // Spawns Enemy Shooter Ships every ~260 frames (Shooter enemies!)
    if (this.gameTime % 260 === 0) {
      const speed = (1.8 + Math.random() * 0.6) * (0.9 + this.difficulty * 0.1);
      const startY = 50 + Math.random() * (this.height - 100);
      this.enemies.push({
        type: 'shooter',
        x: this.width + 30,
        y: startY,
        baseY: startY,
        radius: 14,
        vx: -speed,
        bobPhase: Math.random() * Math.PI * 2,
        shootTimer: 0,
        hp: 2
      });
    }

    // 2.8 Big Boss Encounter (Every 60 Seconds / 3600 frames)
    if (this.gameTime >= 3600 && (this.gameTime - this.lastBossSpawnFrame >= 3600) && !this.boss) {
      this.lastBossSpawnFrame = this.gameTime;
      this.boss = {
        x: this.width + 120,
        targetX: this.width - 120,
        y: this.height / 2,
        w: 95,
        h: 80,
        vy: 2.2,
        hp: 50,
        maxHp: 50,
        shootTimer: 0
      };
      if (window.triggerToast) window.triggerToast("⚠️ WARNING: CYBER DREADNOUGHT BOSS APPROACHING!", "error");
      if (typeof sfx.playExplosion === 'function') sfx.playExplosion();
    }

    // Update Big Boss if active
    if (this.boss) {
      // Enter from right
      if (this.boss.x > this.boss.targetX) {
        this.boss.x -= 2.0;
      } else {
        // Vertical hover movement
        this.boss.y += this.boss.vy;
        if (this.boss.y < 50 || this.boss.y > this.height - 50 - this.boss.h) {
          this.boss.vy *= -1;
        }
      }

      // Boss Twin Plasma Cannons (Shoots every 65 frames)
      this.boss.shootTimer++;
      if (this.boss.shootTimer % 65 === 0) {
        this.enemyBullets.push({ x: this.boss.x - 8, y: this.boss.y + 20, vx: -6.5, vy: 0 });
        this.enemyBullets.push({ x: this.boss.x - 8, y: this.boss.y + this.boss.h - 20, vx: -6.5, vy: 0 });
      }
    }

    // 3. Update Player Plasma Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx;

      let bulletHit = false;

      // Bullet hit Big Boss?
      if (this.boss && b.x > this.boss.x && b.x < this.boss.x + this.boss.w && b.y > this.boss.y && b.y < this.boss.y + this.boss.h) {
        this.boss.hp--;
        this.createExplosionSparks(b.x, b.y, '#ffffff', 4);
        bulletHit = true;

        if (this.boss.hp <= 0) {
          // BOSS DESTROYED! +10 PGT bonus reward at game over
          this.bonusTokensCollected = (this.bonusTokensCollected || 0) + 2;
          this.createExplosionSparks(this.boss.x + this.boss.w / 2, this.boss.y + this.boss.h / 2, '#ff0055', 60);
          if (typeof sfx.playExplosion === 'function') sfx.playExplosion();

          this.score += 1500;
          this.floatTexts.push({
            text: `🏆 BOSS DESTROYED! +10 PGT BONUS!`,
            x: this.boss.x - 40,
            y: this.boss.y - 20,
            color: "#ffaa00",
            alpha: 1.0,
            vy: -1.2
          });
          document.getElementById('game-live-score').innerText = this.score;

          if (window.triggerToast) {
            window.triggerToast(`🏆 CYBER BOSS DESTROYED! +10 PGT Bonus Earned!`, "warning");
          }

          this.boss = null; // Boss eliminated, game continues seamlessly!
        }
      }

      // Bullet hit enemy asteroids or shooter ships?
      if (!bulletHit) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          const dx = b.x - e.x;
          const dy = b.y - e.y;
          if (Math.sqrt(dx*dx + dy*dy) < e.radius + 6) {
            e.hp--;
            this.createExplosionSparks(e.x, e.y, e.type === 'asteroid' ? '#aaaaaa' : '#ff0055', 6);
            bulletHit = true;

            if (e.hp <= 0) {
              const points = e.type === 'shooter' ? 200 : 100;
              this.createExplosionSparks(e.x, e.y, e.type === 'asteroid' ? '#8a8a9a' : '#ff2255', 20);
              if (typeof sfx.playExplosion === 'function') sfx.playExplosion();
              
              this.score += points;
              this.floatTexts.push({
                text: e.type === 'shooter' ? "💥 FIGHTER DOWN +200" : "💥 ASTEROID CRUSHED +100",
                x: e.x,
                y: e.y - 12,
                color: e.type === 'shooter' ? "#ff0055" : "#38bdf8",
                alpha: 1.0,
                vy: -0.7
              });
              document.getElementById('game-live-score').innerText = this.score;
              this.enemies.splice(j, 1);
            }
            break;
          }
        }
      }

      if (bulletHit || b.x > this.width + 20) {
        this.bullets.splice(i, 1);
      }
    }

    // 4. Update Enemy Plasma Bullets (Shooter Enemy & Boss Lasers)
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      eb.x += eb.vx;
      eb.y += (eb.vy || 0);

      // Collide with Player?
      if (this.player && Math.hypot(this.player.x - eb.x, this.player.y - eb.y) < this.player.radius + 6) {
        this.enemyBullets.splice(i, 1);
        if (this.player.shield) {
          this.player.shield = false;
          if (typeof sfx.playError === 'function') sfx.playError();
          triggerToast("Shield Absorbed Laser Hit!", "success");
          this.createExplosionSparks(this.player.x, this.player.y, '#00f0ff', 15);
        } else {
          this.createExplosionSparks(this.player.x, this.player.y, '#ff0055', 40);
          this.gameOver();
          return;
        }
        continue;
      }

      if (eb.x < -20) {
        this.enemyBullets.splice(i, 1);
      }
    }

    // 4.5 Update Enemies (Asteroids & Shooter Ships)
    const currentSpeedMult = this.slowMo ? 0.5 : 1.0;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.x += e.vx * (this.baseSpeedMult || 1.0) * currentSpeedMult;
      
      if (e.type === 'asteroid') {
        e.rotation += e.rotSpeed;
      } else if (e.type === 'shooter') {
        e.y = e.baseY + Math.sin(this.gameTime * 0.06 + e.bobPhase) * 22;
        
        // Shooter enemy fires red laser every ~85 frames
        e.shootTimer++;
        if (e.shootTimer % 85 === 0) {
          this.enemyBullets.push({ x: e.x - 10, y: e.y, vx: -6.0, vy: 0 });
        }
      }

      // Collide with Player Ship?
      if (this.player && this.checkCircleCollision(this.player, e)) {
        if (this.player.shield) {
          this.player.shield = false;
          if (typeof sfx.playError === 'function') sfx.playError();
          this.enemies.splice(i, 1);
          triggerToast("Shield Destroyed Obstacle!", "success");
          this.createExplosionSparks(e.x, e.y, '#ffd700', 15);
          continue;
        } else {
          this.createExplosionSparks(this.player.x, this.player.y, '#ff0055', 40);
          this.gameOver();
          return;
        }
      }

      if (e.x < -40) {
        this.enemies.splice(i, 1);
      }
    }

    // 5. Spawn Collectibles (PGT Energy Shards & Ultra-Rare PGT Crystal)
    if (this.gameTime % 90 === 0) {
      const isRareCrystal = Math.random() < 0.0035; // ~1 in 280 shard spawns (~1 per 15 minutes of gameplay)
      this.collectibles.push({
        type: isRareCrystal ? 'rare_crystal' : 'shard',
        x: this.width + 20,
        y: 30 + Math.random() * (this.height - 60),
        radius: isRareCrystal ? 14 : 10,
        vx: isRareCrystal ? -1.8 : (-2.0 - Math.random() * 1.0),
        glowPulse: 0
      });
    }

    // 6. Spawn Power-ups (Shield, Chronos Slow-Mo, OR Triple Laser)
    if (this.gameTime % 400 === 0) {
      const rand = Math.random();
      let type = 'triple';
      if (rand < 0.35) type = 'shield';
      else if (rand < 0.65) type = 'slow';
      
      this.powerups.push({
        type: type,
        x: this.width + 20,
        y: 40 + Math.random() * (this.height - 80),
        radius: 11,
        vx: -2.2
      });
    }

    // 7. Update Obstacles (Base speed acceleration & Slow-Mo multiplier apply!)
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x += obs.vx * (this.baseSpeedMult || 1.0) * currentSpeedMult;
      obs.glowPulse = Math.sin(this.gameTime * 0.15 + i) * 4;

      // Near Miss Bonus Check (Passing within 28px of player without colliding)
      if (this.player && !obs.nearMissChecked && obs.x < this.player.x) {
        obs.nearMissChecked = true;
        const distY = Math.abs(this.player.y - (obs.y + obs.h / 2));
        if (distY < obs.h / 2 + 35) {
          this.score += 50;
          this.floatTexts.push({
            text: "⚡ NEAR MISS! +50",
            x: this.player.x,
            y: this.player.y - 18,
            color: "var(--color-warning)",
            alpha: 1.0,
            vy: -0.8
          });
          sfx.playCoin();
          document.getElementById('game-live-score').innerText = this.score;
        }
      }

      // Collide with Player
      if (this.player && this.checkCollision(this.player, obs)) {
        if (this.player.shield) {
          this.player.shield = false;
          sfx.playError();
          this.obstacles.splice(i, 1);
          triggerToast("Shield Absorbed Crash!", "success");
          this.createExplosionSparks(obs.x, this.player.y, 'var(--color-warning)', 15);
          continue;
        } else {
          this.createExplosionSparks(this.player.x, this.player.y, 'var(--color-danger)', 40);
          this.gameOver();
          return;
        }
      }

      // Out of bounds cleanup
      if (obs.x + obs.w < -20) {
        this.obstacles.splice(i, 1);
        this.score += 25; // Passive survival score
        document.getElementById('game-live-score').innerText = this.score;
      }
    }

    // 8. Update Collectibles
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const col = this.collectibles[i];
      col.x += col.vx * currentSpeedMult;
      col.glowPulse = Math.sin(this.gameTime * 0.2 + i) * 3;

      if (this.player && this.checkCircleCollision(this.player, col)) {
        if (col.type === 'rare_crystal') {
          if (typeof sfx.playPowerUp === 'function') sfx.playPowerUp();
          this.shardsCollected += 5;
          this.score += 500;
          
          // +10 PGT bonus reward verified and credited at game over!
          this.bonusTokensCollected = (this.bonusTokensCollected || 0) + 2;
          triggerToast("💎 ULTRA-RARE PGT CRYSTAL! (+10 PGT Bonus)", "success");
          
          this.floatTexts.push({
            text: "💎 RARE CRYSTAL! +10 PGT",
            x: col.x,
            y: col.y - 15,
            color: "#ffd700",
            alpha: 1.0,
            vy: -0.8
          });
          this.createExplosionSparks(col.x, col.y, '#ffd700', 25);
        } else {
          sfx.playCoin();
          this.shardsCollected++;
          this.score += 100;
          this.createExplosionSparks(col.x, col.y, '#00ffff', 12);
        }
        
        document.getElementById('game-live-score').innerText = this.score;
        document.getElementById('game-live-shards').innerText = this.shardsCollected;
        this.collectibles.splice(i, 1);
        continue;
      }

      if (col.x < -20) {
        this.collectibles.splice(i, 1);
      }
    }

    // 7. Update Power-ups (Shield & Chronos Slow-Mo)
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pup = this.powerups[i];
      pup.x += pup.vx * currentSpeedMult;

      if (this.player && this.checkCircleCollision(this.player, pup)) {
        sfx.playPowerUp();
        if (pup.type === 'slow') {
          this.slowMo = true;
          this.slowMoTime = 360; // 6 Seconds Chronos Warp
          triggerToast("⌛ Chronos Warp! 50% Speed (6s)", "success");
          this.createExplosionSparks(pup.x, pup.y, 'var(--color-accent)', 18);
        } else if (pup.type === 'triple') {
          this.player.tripleGun = true;
          this.player.tripleTime = 600; // 10 Seconds Triple Laser Overcharge
          triggerToast("🔱 Triple-Laser Overcharge Active (10s)!", "success");
          this.createExplosionSparks(pup.x, pup.y, '#ff00ff', 20);
        } else {
          this.player.shield = true;
          this.player.shieldTime = 420; // 7 seconds
          triggerToast("🛡️ Shield Active (7s)!", "success");
          this.createExplosionSparks(pup.x, pup.y, 'var(--color-warning)', 15);
        }
        
        this.powerups.splice(i, 1);
        continue;
      }

      if (pup.x < -20) {
        this.powerups.splice(i, 1);
      }
    }

    // 8. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.02;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  // --- Collision Detection Helpers ---
  checkCollision(player, rect) {
    // Find the closest point on the rectangle to the circle's center
    const closestX = Math.max(rect.x, Math.min(player.x, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(player.y, rect.y + rect.h));

    // Calculate distance between closest point and circle center
    const distanceX = player.x - closestX;
    const distanceY = player.y - closestY;
    
    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    return distanceSquared < (player.radius * player.radius);
  }

  checkCircleCollision(c1, c2) {
    const dx = c1.x - c2.x;
    const dy = c1.y - c2.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    return dist < (c1.radius + c2.radius);
  }

  createExplosionSparks(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.0;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color,
        alpha: 1.0,
        size: 2 + Math.random() * 3
      });
    }
  }

  // --- Canvas Rendering Draw Loop ---
  draw() {
    // Clear canvas
    this.ctx.fillStyle = '#020308';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 1. Parallax Starfield
    if (this.stars) {
      this.stars.forEach(star => {
        this.ctx.save();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.globalAlpha = star.alpha;
        this.ctx.beginPath();
        this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      });
    }

    // 2. Star grid lines (moving grid illusion)
    this.ctx.strokeStyle = '#0a0d20';
    this.ctx.lineWidth = 1;
    const gridSpacing = 40;
    const offsetX = -(this.gameTime * 1.5) % gridSpacing;
    for (let x = offsetX; x < this.width; x += gridSpacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }

    // 3. Chronos Slow-Mo Matrix Screen Aura
    if (this.slowMo) {
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(0, 240, 255, 0.05)';
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(0, 0, this.width, this.height);
      this.ctx.restore();
    }

    // 4. Draw Exhaust & Explosion Particles
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // 4.5 Draw Player Plasma Bullets
    this.bullets.forEach(b => {
      this.ctx.save();
      this.ctx.fillStyle = '#00ffff';
      this.ctx.shadowColor = '#00ffff';
      this.ctx.shadowBlur = 10;
      this.ctx.fillRect(b.x - 6, b.y - 2, 12, 4);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(b.x - 4, b.y - 1, 8, 2);
      this.ctx.restore();
    });

    // 4.6 Draw High-Visibility Enemy Plasma Bullets
    this.enemyBullets.forEach(eb => {
      this.ctx.save();
      
      // Outer intense neon crimson/magenta glow
      this.ctx.fillStyle = '#ff0055';
      this.ctx.shadowColor = '#ff0055';
      this.ctx.shadowBlur = 24;
      this.ctx.fillRect(eb.x - 9, eb.y - 4, 18, 8);
      
      // Glowing energy border box
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeRect(eb.x - 9, eb.y - 4, 18, 8);

      // White-hot center core pulse
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = '#ffffff';
      this.ctx.shadowBlur = 10;
      this.ctx.fillRect(eb.x - 6, eb.y - 2, 12, 4);

      this.ctx.restore();
    });

    // 4.8 Draw Enemies (Asteroids & Shooter Fighter Ships)
    this.enemies.forEach(e => {
      this.ctx.save();
      this.ctx.translate(e.x, e.y);

      if (e.type === 'asteroid') {
        // 🪨 ASTEROID: Tumbling Rock Polygon
        this.ctx.rotate(e.rotation);
        this.ctx.fillStyle = '#4a5268';
        this.ctx.strokeStyle = '#00f0ff';
        this.ctx.lineWidth = 1.5;
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.shadowBlur = 6;

        this.ctx.beginPath();
        if (e.points && e.points.length > 0) {
          this.ctx.moveTo(e.points[0].x, e.points[0].y);
          for (let p = 1; p < e.points.length; p++) {
            this.ctx.lineTo(e.points[p].x, e.points[p].y);
          }
        } else {
          this.ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Crater shading
        this.ctx.fillStyle = '#2d3345';
        this.ctx.beginPath();
        this.ctx.arc(-e.radius * 0.3, -e.radius * 0.2, e.radius * 0.25, 0, Math.PI * 2);
        this.ctx.fill();

      } else if (e.type === 'shooter') {
        // 🚀 ENEMY SHOOTER SHIP: Stealth Fighter Jet
        this.ctx.fillStyle = '#ff0055';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.shadowColor = '#ff0055';
        this.ctx.shadowBlur = 12;

        // Fighter Body (nose facing left)
        this.ctx.beginPath();
        this.ctx.moveTo(-e.radius - 4, 0); // Nose tip
        this.ctx.lineTo(e.radius, -e.radius + 2);
        this.ctx.lineTo(e.radius - 4, 0);
        this.ctx.lineTo(e.radius, e.radius - 2);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Yellow Visor Eye
        this.ctx.fillStyle = '#ffee00';
        this.ctx.beginPath();
        this.ctx.arc(-3, 0, 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Engine flame trail
        this.ctx.fillStyle = '#ff8800';
        this.ctx.beginPath();
        this.ctx.moveTo(e.radius, -3);
        this.ctx.lineTo(e.radius + 6 + (Math.random() * 4), 0);
        this.ctx.lineTo(e.radius, 3);
        this.ctx.closePath();
        this.ctx.fill();
      }

      this.ctx.restore();
    });

    // 4.9 Draw Cyber Dreadnought Big Boss
    if (this.boss) {
      this.ctx.save();
      const b = this.boss;

      // Dreadnought Hull
      this.ctx.fillStyle = '#1e2238';
      this.ctx.strokeStyle = '#ff0055';
      this.ctx.lineWidth = 2.5;
      this.ctx.shadowColor = '#ff0055';
      this.ctx.shadowBlur = 20;

      // Main Boss Ship Body
      this.ctx.beginPath();
      this.ctx.moveTo(b.x + b.w, b.y);
      this.ctx.lineTo(b.x + 20, b.y + 10);
      this.ctx.lineTo(b.x, b.y + b.h / 2); // Nose tip pointing left
      this.ctx.lineTo(b.x + 20, b.y + b.h - 10);
      this.ctx.lineTo(b.x + b.w, b.y + b.h);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      // Twin Cannon Turrets
      this.ctx.fillStyle = '#ff0055';
      this.ctx.fillRect(b.x - 8, b.y + 18, 16, 5);
      this.ctx.fillRect(b.x - 8, b.y + b.h - 23, 16, 5);

      // Glowing Red Eye Visor Core
      this.ctx.fillStyle = '#ffee00';
      this.ctx.shadowColor = '#ffee00';
      this.ctx.shadowBlur = 15;
      this.ctx.beginPath();
      this.ctx.ellipse(b.x + 35, b.y + b.h / 2, 12, 6, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Boss Top HP Bar
      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      this.ctx.fillRect(b.x, b.y - 16, b.w, 8);
      this.ctx.strokeStyle = '#ff0055';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(b.x, b.y - 16, b.w, 8);

      const hpPct = Math.max(0, b.hp / b.maxHp);
      this.ctx.fillStyle = hpPct > 0.5 ? '#00f0ff' : (hpPct > 0.25 ? '#ffaa00' : '#ff0055');
      this.ctx.fillRect(b.x + 1, b.y - 15, (b.w - 2) * hpPct, 6);

      this.ctx.restore();
    }

    // 5. Draw Collectibles (Cyan Energy Diamonds & Ultra-Rare PGT Crystal)
    this.collectibles.forEach(col => {
      this.ctx.save();
      if (col.type === 'rare_crystal') {
        // Ultra-Rare Golden Star Crystal Core
        this.ctx.fillStyle = '#ffd700';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        const pts = 6;
        for (let i = 0; i < pts * 2; i++) {
          const r = (i % 2 === 0) ? col.radius : col.radius * 0.55;
          const a = (i * Math.PI / pts) + (this.gameTime * 0.05);
          const px = col.x + Math.cos(a) * r;
          const py = col.y + Math.sin(a) * r;
          if (i === 0) this.ctx.moveTo(px, py);
          else this.ctx.lineTo(px, py);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillStyle = '#000000';
        this.ctx.font = 'bold 10px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('💎', col.x, col.y);
      } else {
        // Cyan Energy Diamond
        this.ctx.fillStyle = '#00ffff';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1.5;
        
        this.ctx.beginPath();
        this.ctx.moveTo(col.x, col.y - col.radius);
        this.ctx.lineTo(col.x + col.radius, col.y);
        this.ctx.lineTo(col.x, col.y + col.radius);
        this.ctx.lineTo(col.x - col.radius, col.y);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
      }
      this.ctx.restore();
    });

    // 6. Draw Powerups (Shield Orbs, Chronos Time-Slow Clocks, & Triple Laser Tridents)
    this.powerups.forEach(pup => {
      this.ctx.save();
      this.ctx.shadowColor = pup.type === 'triple' ? '#ff00ff' : (pup.type === 'slow' ? '#00f0ff' : '#ffd700');
      this.ctx.shadowBlur = 12;
      
      if (pup.type === 'slow') {
        // Chronos Time-Slow Orb (Cyan/Purple)
        this.ctx.fillStyle = '#00f0ff';
        this.ctx.beginPath();
        this.ctx.arc(pup.x, pup.y, pup.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#050714';
        this.ctx.font = 'bold 11px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('⏱️', pup.x, pup.y);
      } else if (pup.type === 'triple') {
        // Triple-Laser Trident Badge (Neon Magenta)
        this.ctx.fillStyle = '#ff00ff';
        this.ctx.beginPath();
        this.ctx.arc(pup.x, pup.y, pup.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 11px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🔱', pup.x, pup.y);
      } else {
        // Shield Orb (Gold)
        this.ctx.fillStyle = '#ffd700';
        this.ctx.beginPath();
        this.ctx.arc(pup.x, pup.y, pup.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 10px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🛡️', pup.x, pup.y);
      }
      
      this.ctx.restore();
    });

    // 7. Draw Upgraded Laser Gate Obstacles
    this.obstacles.forEach(obs => {
      this.ctx.save();
      
      // Laser Gate Core Plasma Beam
      this.ctx.fillStyle = '#ff0055';
      this.ctx.beginPath();
      this.ctx.roundRect(obs.x + 2, obs.y + 6, obs.w - 4, obs.h - 12, 3);
      this.ctx.fill();

      // Bright Inner Plasma Line
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.roundRect(obs.x + obs.w/2 - 2, obs.y + 8, 4, obs.h - 16, 2);
      this.ctx.fill();

      // Top Pylon Capacitor
      this.ctx.fillStyle = '#1e2438';
      this.ctx.strokeStyle = '#ff007f';
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.roundRect(obs.x - 3, obs.y, obs.w + 6, 8, 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Bottom Pylon Capacitor
      this.ctx.beginPath();
      this.ctx.roundRect(obs.x - 3, obs.y + obs.h - 8, obs.w + 6, 8, 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Animated Electric Arc Zigzag Sparks inside the Beam
      if (this.gameTime % 3 === 0) {
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        let currY = obs.y + 10;
        let currX = obs.x + obs.w/2;
        this.ctx.moveTo(currX, currY);
        while (currY < obs.y + obs.h - 10) {
          currY += 12;
          currX = obs.x + obs.w/2 + (Math.random() * 8 - 4);
          this.ctx.lineTo(currX, currY);
        }
        this.ctx.stroke();
      }

      this.ctx.restore();
    });

    // 8. Draw Upgraded Sleek 3D Fighter Jet Ship (with banking tilt)
    if (this.player) {
      this.ctx.save();
      this.ctx.translate(this.player.x, this.player.y);
      this.ctx.rotate(this.player.tilt || 0);

      // Main Hull (Sleek Stealth Fighter Jet)
      this.ctx.fillStyle = '#00f0ff';
      this.ctx.beginPath();
      this.ctx.moveTo(22, 0); // Nose cone tip
      this.ctx.lineTo(-8, -14); // Top wing tip
      this.ctx.lineTo(-4, -5);  // Top wing joint
      this.ctx.lineTo(-14, -8); // Top engine nacelle
      this.ctx.lineTo(-12, 0);  // Tail center
      this.ctx.lineTo(-14, 8);  // Bottom engine nacelle
      this.ctx.lineTo(-4, 5);   // Bottom wing joint
      this.ctx.lineTo(-8, 14);  // Bottom wing tip
      this.ctx.closePath();
      this.ctx.fill();

      // Wing-Edge Cyan/Pink Neon Strips
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.moveTo(22, 0);
      this.ctx.lineTo(-8, -14);
      this.ctx.moveTo(22, 0);
      this.ctx.lineTo(-8, 14);
      this.ctx.stroke();

      // Cockpit Canopy Glass (Layered 3D Highlight)
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.ellipse(4, 0, 7, 3.5, 0, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = '#00f0ff';
      this.ctx.beginPath();
      this.ctx.ellipse(3, 0, 4, 2, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Dual Engine Plasma Thruster Plumes
      this.ctx.fillStyle = '#ff007f';
      const flameLen = 10 + Math.random() * 8;
      
      // Top Engine Flame
      this.ctx.beginPath();
      this.ctx.moveTo(-14, -5);
      this.ctx.lineTo(-14 - flameLen, -5);
      this.ctx.lineTo(-12, -3);
      this.ctx.closePath();
      this.ctx.fill();

      // Bottom Engine Flame
      this.ctx.beginPath();
      this.ctx.moveTo(-14, 5);
      this.ctx.lineTo(-14 - flameLen, 5);
      this.ctx.lineTo(-12, 3);
      this.ctx.closePath();
      this.ctx.fill();

      // Active Bubble Forcefield Shield
      if (this.player.shield) {
        this.ctx.strokeStyle = '#ffd700';
        this.ctx.lineWidth = 2.5;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 24, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.restore();
    }

    // 8.8 Boss Incoming Countdown Banner
    if (!this.boss && (this.gameTime - this.lastBossSpawnFrame >= 3000)) {
      const remainingSecs = Math.max(1, Math.ceil((3600 - (this.gameTime - this.lastBossSpawnFrame)) / 60));
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(255, 0, 85, 0.25)';
      this.ctx.strokeStyle = '#ff0055';
      this.ctx.lineWidth = 1.5;
      this.ctx.fillRect(this.width / 2 - 140, 10, 280, 24);
      this.ctx.strokeRect(this.width / 2 - 140, 10, 280, 24);

      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = 'bold 11px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.shadowColor = '#ff0055';
      this.ctx.shadowBlur = 8;
      this.ctx.fillText(`⚠️ CYBER DREADNOUGHT BOSS IN ${remainingSecs}s!`, this.width / 2, 22);
      this.ctx.restore();
    }

    // 9. Floating Text Animations (Near Misses & Bonuses)
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const ft = this.floatTexts[i];
      ft.y += ft.vy;
      ft.alpha -= 0.02;

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, ft.alpha);
      this.ctx.fillStyle = ft.color;
      this.ctx.font = 'bold 12px sans-serif';
      this.ctx.shadowColor = ft.color;
      this.ctx.shadowBlur = 10;
      this.ctx.fillText(ft.text, ft.x, ft.y);
      this.ctx.restore();

      if (ft.alpha <= 0) {
        this.floatTexts.splice(i, 1);
      }
    }
  }
}

// Instantiate game context
let dodgeGame = null;
window.addEventListener('DOMContentLoaded', () => {
  dodgeGame = new NeonAstroDodge('game-canvas', 'game-ui-overlay');
  window.dodgeGame = dodgeGame;
});
