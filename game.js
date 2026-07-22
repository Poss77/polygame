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
      ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
    };

    // Game Entities
    this.player = null;
    this.obstacles = [];
    this.collectibles = [];
    this.particles = [];
    this.powerups = [];

    this.initEvents();
  }

  initEvents() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      if (this.keys.hasOwnProperty(e.key)) {
        this.keys[e.key] = true;
        // Prevent scrolling with arrows/space
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key) && this.isPlaying) {
          e.preventDefault();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.keys.hasOwnProperty(e.key)) {
        this.keys[e.key] = false;
      }
    });

    const containerEl = document.getElementById('game-window-container') || this.canvas;
    let touchStartY = 0;
    let touchStartX = 0;

    const isFullscreenActive = () => {
      const container = document.getElementById('game-window-container');
      return container && container.classList.contains('fullscreen-active');
    };

    containerEl.addEventListener('touchstart', (e) => {
      if (!isFullscreenActive() || !this.isPlaying || e.touches.length === 0) return;
      if (e.target.closest('.btn-fullscreen-close') || e.target.closest('button')) return;
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
    }, { passive: true });

    containerEl.addEventListener('touchmove', (e) => {
      if (!isFullscreenActive() || !this.isPlaying || e.touches.length === 0) return;
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

  startGame() {
    sfx.init();
    
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
    this.enemies = [];
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
    const totalBoost = nftMult * vipMult;
    document.getElementById('game-nft-boost-label').innerText = `${parseFloat(totalBoost || 1).toFixed(1)}x`;

    // Trigger game loop
    this.loop();
  }

  gameOver() {
    this.isPlaying = false;
    
    sfx.playExplosion();
    
    // Calculate rewards
    const multis = appState.getMultipliers();
    const multiplier = 1 + (multis.nftGameMultiplier / 100);
    
    const rawPgt = (this.score / 2500) + (this.shardsCollected * 0.05);
    let finalPgt = rawPgt * multiplier * (appState.state.globalEarnMultiplier || 1.0);
    if (appState.isVipActive()) finalPgt *= 2;

    // Check high score
    const currentHigh = appState.state.gameHighScore || 0;
    const isNewHigh = this.score > currentHigh;
    if (isNewHigh) {
      appState.update({ gameHighScore: Math.floor(this.score) });
    }

    const titleEl = document.getElementById('game-overlay-title');
    const descEl = document.getElementById('game-overlay-desc');
    const playBtn = document.getElementById('btn-start-game');

    if (titleEl) {
      titleEl.innerText = "STARSHIP CRASHED";
      titleEl.style.color = "var(--color-danger)";
    }
    
    if (descEl) {
      descEl.innerHTML = `
        ${isNewHigh ? '<strong style="color:var(--color-warning);">🏆 NEW HIGH SCORE!</strong><br>' : ''}
        Score: <strong style="color:var(--color-primary);">${Math.floor(this.score)}</strong> | 
        Shards: <strong style="color:var(--color-accent);">${this.shardsCollected}</strong><br>
        Onsite Payout Credited: <strong style="color:var(--color-accent);">+${finalPgt.toFixed(2)} PGT</strong> 
        <span style="font-size:0.8rem; color:var(--text-dim);">(incl. ${multis.nftGameMultiplier}% NFT boost)</span>
      `;
    }

    if (playBtn) playBtn.innerText = "Relaunch Capsule";

    if (isNewHigh && typeof window.sendDiscordHighScore === 'function') {
      window.sendDiscordHighScore('Astro-Dodge', this.score, finalPgt);
    } else if (finalPgt >= 25 && typeof window.sendDiscordBigWin === 'function') {
      window.sendDiscordBigWin('Astro-Dodge', 0, finalPgt, 1);
    }

    if (window.creditArcadePayout) window.creditArcadePayout(finalPgt);
    if (window.recordGameMetrics) window.recordGameMetrics('AstroDodge', 0, finalPgt, Math.floor(this.gameTime / 60));

    if (window.appState && window.appState.addActivity) {
      window.appState.addActivity('You', `scored ${Math.floor(this.score)} in AstroDodge`, `+${finalPgt.toFixed(2)} PGT`);
    }

    this.overlay.classList.remove('hidden');
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
    
    // Scale difficulty smoothly (every 10 seconds at 60 FPS)
    if (this.gameTime % 600 === 0) {
      this.difficulty += 0.08;
    }

    // Update live PGT earned display
    const multis = appState.getMultipliers();
    const multiplier = 1 + (multis.nftGameMultiplier / 100);
    const liveRawPgt = (this.score / 2500) + (this.shardsCollected * 0.05);
    let liveFinalPgt = liveRawPgt * multiplier * (appState.state.globalEarnMultiplier || 1.0);
    if (appState.isVipActive()) liveFinalPgt *= 2;
    document.getElementById('game-live-earned').innerText = liveFinalPgt.toFixed(2);

    // 0. Update Stars (Parallax Starfield)
    const starSpeedMult = this.slowMo ? 0.4 : 1.0;
    this.stars.forEach(star => {
      star.x -= star.speed * starSpeedMult;
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
        triggerToast("Chronos Warp Expired", "info");
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

      // Auto-fire dual plasma blasters every 9 frames
      if (this.gameTime % 9 === 0) {
        this.bullets.push({ x: this.player.x + 22, y: this.player.y - 5, vx: 12 });
        this.bullets.push({ x: this.player.x + 22, y: this.player.y + 5, vx: 12 });
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

    // 2.5 Spawn Small Enemy Scout Drones (Destroyable!)
    if (this.gameTime % 110 === 0) {
      const speed = (2.2 + Math.random() * 0.8) * (0.9 + this.difficulty * 0.1);
      const startY = 40 + Math.random() * (this.height - 80);
      this.enemies.push({
        x: this.width + 20,
        y: startY,
        baseY: startY,
        radius: 11,
        vx: -speed,
        bobPhase: Math.random() * Math.PI * 2
      });
    }

    // 3. Update Plasma Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx;

      // Bullet hit enemy scout drone?
      let bulletHit = false;
      for (let j = this.enemies.length - 1; j >= 0; j--) {
        const e = this.enemies[j];
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        if (Math.sqrt(dx*dx + dy*dy) < e.radius + 4) {
          // Destroy enemy drone!
          this.createExplosionSparks(e.x, e.y, '#ff4400', 18);
          sfx.playExplosion && sfx.playExplosion();
          this.score += 150;
          this.floatTexts.push({
            text: "💥 DRONE DESTROYED +150",
            x: e.x,
            y: e.y - 12,
            color: "#ff8800",
            alpha: 1.0,
            vy: -0.7
          });
          document.getElementById('game-live-score').innerText = this.score;
          this.enemies.splice(j, 1);
          bulletHit = true;
          break;
        }
      }

      if (bulletHit || b.x > this.width + 20) {
        this.bullets.splice(i, 1);
      }
    }

    // 4. Update Enemy Scout Drones
    const currentSpeedMult = this.slowMo ? 0.5 : 1.0;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.x += e.vx * currentSpeedMult;
      e.y = e.baseY + Math.sin(this.gameTime * 0.08 + e.bobPhase) * 18;

      // Collide with Player?
      if (this.player && this.checkCircleCollision(this.player, e)) {
        if (this.player.shield) {
          this.player.shield = false;
          sfx.playError();
          this.enemies.splice(i, 1);
          triggerToast("Shield Destroyed Drone!", "success");
          this.createExplosionSparks(e.x, e.y, '#ffd700', 15);
          continue;
        } else {
          this.createExplosionSparks(this.player.x, this.player.y, '#ff0055', 40);
          this.gameOver();
          return;
        }
      }

      if (e.x < -20) {
        this.enemies.splice(i, 1);
      }
    }

    // 5. Spawn Collectibles (PGT Energy Shards)
    if (this.gameTime % 90 === 0) {
      this.collectibles.push({
        x: this.width + 20,
        y: 30 + Math.random() * (this.height - 60),
        radius: 10,
        vx: -2.0 - Math.random() * 1.0,
        glowPulse: 0
      });
    }

    // 6. Spawn Power-ups (Shield OR Chronos Slow-Mo)
    if (this.gameTime % 480 === 0) {
      const type = (Math.random() > 0.4 && !this.player.shield) ? 'shield' : 'slow';
      this.powerups.push({
        type: type,
        x: this.width + 20,
        y: 40 + Math.random() * (this.height - 80),
        radius: 10,
        vx: -2.2
      });
    }

    // 7. Update Obstacles (Slow-Mo multiplier applies here!)
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x += obs.vx * currentSpeedMult;
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

    // 6. Update Collectibles
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const col = this.collectibles[i];
      col.x += col.vx * currentSpeedMult;
      col.glowPulse = Math.sin(this.gameTime * 0.2 + i) * 3;

      if (this.player && this.checkCircleCollision(this.player, col)) {
        sfx.playCoin();
        this.shardsCollected++;
        this.score += 100;
        
        document.getElementById('game-live-score').innerText = this.score;
        document.getElementById('game-live-shards').innerText = this.shardsCollected;
        
        this.createExplosionSparks(col.x, col.y, 'var(--color-accent)', 12);
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
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = '#00ffff';
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.roundRect(b.x - 6, b.y - 2.5, 12, 5, 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // 4.8 Draw Small Enemy Scout Drones (Destroyable!)
    this.enemies.forEach(e => {
      this.ctx.save();
      this.ctx.shadowBlur = 14;
      this.ctx.shadowColor = '#ff4400';
      this.ctx.fillStyle = '#ff3300';
      
      // Drone stealth triangle body
      this.ctx.beginPath();
      this.ctx.moveTo(e.x - e.radius - 2, e.y); // Drone nose facing left
      this.ctx.lineTo(e.x + e.radius, e.y - e.radius + 2);
      this.ctx.lineTo(e.x + e.radius - 4, e.y);
      this.ctx.lineTo(e.x + e.radius, e.y + e.radius - 2);
      this.ctx.closePath();
      this.ctx.fill();

      // Drone Glowing Red Eye Visor
      this.ctx.fillStyle = '#ffff00';
      this.ctx.beginPath();
      this.ctx.arc(e.x - 3, e.y, 3, 0, Math.PI * 2);
      this.ctx.fill();

      // Drone Thruster Trail
      this.ctx.fillStyle = '#ff8800';
      this.ctx.beginPath();
      this.ctx.moveTo(e.x + e.radius, e.y - 2);
      this.ctx.lineTo(e.x + e.radius + 6 + (Math.random() * 4), e.y);
      this.ctx.lineTo(e.x + e.radius, e.y + 2);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.restore();
    });

    // 5. Draw Collectibles (Cyan Energy Diamonds)
    this.collectibles.forEach(col => {
      this.ctx.save();
      this.ctx.shadowBlur = 15 + col.glowPulse;
      this.ctx.shadowColor = '#00ffff';
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
      this.ctx.restore();
    });

    // 6. Draw Powerups (Shield Orbs & Chronos Time-Slow Clocks)
    this.powerups.forEach(pup => {
      this.ctx.save();
      this.ctx.shadowBlur = 18;
      
      if (pup.type === 'slow') {
        // Chronos Time-Slow Orb (Cyan/Purple)
        this.ctx.shadowColor = '#00ffff';
        this.ctx.fillStyle = '#00f0ff';
        this.ctx.beginPath();
        this.ctx.arc(pup.x, pup.y, pup.radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.fillStyle = '#050714';
        this.ctx.font = 'bold 11px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('⏱️', pup.x, pup.y);
      } else {
        // Shield Orb (Gold)
        this.ctx.shadowColor = '#ffd700';
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
      
      // Outer Laser Sheath Glow
      this.ctx.shadowBlur = 18 + obs.glowPulse;
      this.ctx.shadowColor = '#ff0055';
      
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

      // Ship Outer Neon Glow
      this.ctx.shadowBlur = 16 + this.player.glowPulse;
      this.ctx.shadowColor = this.player.shield ? '#ffd700' : (this.slowMo ? '#00f0ff' : '#00f0ff');

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
        this.ctx.shadowColor = '#ffd700';
        this.ctx.shadowBlur = 20;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 24, 0, Math.PI * 2);
        this.ctx.stroke();
      }

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
