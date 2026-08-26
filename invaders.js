/**
 * Cyber Invaders Mini-Game Engine (HTML5 Canvas)
 * An enhanced retro-arcade space shooter featuring:
 * - Run-based Weapon Progression (Lv1 to Lv4 + Homing Micro-Missiles)
 * - Hyper Overdrive Beam Gauge with screen-clearing power
 * - Galaga-Style Curved Wave Flight Entrances with Intercept Bonuses
 * - 4 Destructible Quantum Energy Bunkers
 * - 4 New Alien Classes: Splitters, Shield Drones, Snipers & Stealth Cloakers
 * - Multi-Phase Boss Battles with Destructible Wing Cannons & Enraged Phases
 */

class CyberInvaders {
  constructor(canvasId, overlayId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.overlay = document.getElementById(overlayId);

    this.width = this.canvas.width;
    this.height = this.canvas.height;

    this.isPlaying = false;
    this.isPaused = false;
    this.isDying = false;
    this.deathTimer = 0;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.gameTime = 0;

    // Control keys
    this.keys = {
      a: false, d: false, ArrowLeft: false, ArrowRight: false, " ": false
    };

    // Entities & Systems
    this.player = null;
    this.bullets = [];
    this.missiles = [];
    this.enemyBullets = [];
    this.invaders = [];
    this.particles = [];
    this.powerups = [];
    this.ufos = [];
    this.boss = null;
    this.bunkers = [];

    // Weapon & Overdrive System
    this.weaponLevel = 1;      // Lv1: Single, Lv2: Dual, Lv3: Triple Spread, Lv4: Quad + Homing
    this.overdrive = 0;        // 0 to 100%
    this.overdriveTimer = 0;   // Active Hyper Beam timer (frames)
    this.screenShake = 0;      // Dynamic screen shake intensity
    this.combo = 0;            // Rapid kill counter
    this.comboTimer = 0;       // Combo decay timer

    this.waveEntering = false; // Galaga-style flight entrance phase
    this.waveEntranceProgress = 0;

    this.lastShotTime = -100;
    this.shieldCount = 0;      // 0, 1 (Single Shield), 2 (Double Shield)
    this.aliensKilled = 0;
    this.hasSpread = false;
    this.beamTimer = 0;
    this.freezeTimer = 0;
    this.invincibleTimer = 0;

    this.initEvents();
  }

  initEvents() {
    window.addEventListener('keydown', (e) => {
      if (this.keys.hasOwnProperty(e.key)) {
        this.keys[e.key] = true;
        if (e.key === " " && this.isPlaying) {
          e.preventDefault();
          if (this.overdrive >= 100) this.triggerOverdrive();
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
      if (this.overdrive >= 100) this.triggerOverdrive();
      this.keys[" "] = true; // Auto-fire while touching
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
  }

  startGame() {
    if (this._isStarting) return;
    this._isStarting = true;
    setTimeout(() => { this._isStarting = false; }, 600);

    if (window.sfx && window.sfx.init) window.sfx.init();

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.isDying = false;
    this.deathTimer = 0;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.gameTime = 0;
    this.lastShotTime = -100;
    this.keys = { a: false, d: false, ArrowLeft: false, ArrowRight: false, " ": false };

    this.bullets = [];
    this.missiles = [];
    this.enemyBullets = [];
    this.particles = [];
    this.invaders = [];
    this.powerups = [];
    this.ufos = [];
    this.boss = null;
    this.shieldCount = 0;
    this.aliensKilled = 0;
    this.hasSpread = false;
    this.beamTimer = 0;
    this.freezeTimer = 0;
    this.invincibleTimer = 120; // 2 seconds spawn invincibility

    this.weaponLevel = 1;
    this.overdrive = 0;
    this.overdriveTimer = 0;
    this.screenShake = 0;
    this.combo = 0;
    this.comboTimer = 0;

    // Build 4 Quantum Energy Bunkers
    this.initBunkers();

    // Hide menu overlay
    this.overlay.style.display = 'none';

    // Player Ship config
    this.player = {
      x: this.width / 2 - 18,
      y: this.height - 60,
      w: 36,
      h: 18,
      speed: 5.0
    };

    this.spawnWave();

    // Reset scores & HUD
    this.updateLiveScore();
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

  // --- Quantum Energy Bunkers (4 Barricades) ---
  initBunkers() {
    this.bunkers = [];
    const count = 4;
    const bunkerWidth = 46;
    const bunkerHeight = 22;
    const bunkerY = this.height - 118;
    const spacing = (this.width - 60) / (count - 1);

    for (let i = 0; i < count; i++) {
      const bx = 30 + i * spacing - (bunkerWidth / 2);
      // Each bunker is composed of 4 destructible energy segments
      const segments = [
        { offsetX: 0, offsetY: 0, w: 22, h: 10, hp: 4, maxHp: 4 },
        { offsetX: 24, offsetY: 0, w: 22, h: 10, hp: 4, maxHp: 4 },
        { offsetX: 0, offsetY: 12, w: 18, h: 10, hp: 4, maxHp: 4 },
        { offsetX: 28, offsetY: 12, w: 18, h: 10, hp: 4, maxHp: 4 }
      ];
      this.bunkers.push({
        x: bx,
        y: bunkerY,
        w: bunkerWidth,
        h: bunkerHeight,
        segments: segments
      });
    }
  }

  spawnWave() {
    this.invaders = [];
    this.boss = null;
    this.waveEntering = true;
    this.waveEntranceProgress = 0;

    const lvlEl = document.getElementById('invaders-live-level');
    if (lvlEl) lvlEl.innerText = this.level;

    if (this.level % 5 === 0) {
      // --- MULTI-PHASE BOSS BATTLE ---
      const bossTier = Math.floor(this.level / 5);
      const bossNames = ['Dreadnought Alpha', 'Neon Leviathan', 'Quantum Overlord', 'Omega Singularity'];
      const bossName = bossNames[(bossTier - 1) % bossNames.length];

      const wingHp = 18 + (this.level * 3);
      const coreHp = 35 + (this.level * 6);

      this.boss = {
        name: bossName,
        x: this.width / 2 - 65,
        y: 40,
        w: 130,
        h: 65,
        vx: 1.5 + (this.level * 0.12),
        leftWingHp: wingHp,
        maxLeftWingHp: wingHp,
        rightWingHp: wingHp,
        maxRightWingHp: wingHp,
        coreHp: coreHp,
        maxCoreHp: coreHp,
        hp: (wingHp * 2) + coreHp,
        maxHp: (wingHp * 2) + coreHp,
        isEnraged: false,
        lastSpecialShot: 0,
        color: '#ff0055'
      };

      if (window.triggerToast) window.triggerToast(`🚨 BOSS APPROACHING: ${bossName.toUpperCase()}!`, "error");
    } else {
      // --- DYNAMIC ALIEN SWARM (With 4 New Alien Classes & Flight Entrances) ---
      const cols = 8;
      const rows = 3;
      const invWidth = 30;
      const invHeight = 16;
      const spacingX = 20;
      const spacingY = 16;
      const startX = (this.width - (cols * (invWidth + spacingX) - spacingX)) / 2;
      const startY = 45;
      const baseSpeedX = 0.75 + ((this.level - 1) * 0.22);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const targetX = startX + c * (invWidth + spacingX);
          const targetY = startY + r * (invHeight + spacingY);

          let type = 'normal';
          let hp = 1;
          let color = '#00f0ff';

          if (r === 0) {
            // Top Row: Heavy Tanks & Shield Escorts
            if (c === 2 || c === 5) {
              type = 'shield_drone'; // Shields nearby allies
              hp = 4;
              color = '#38bdf8';
            } else {
              type = 'tank';
              hp = 3;
              color = '#ffaa00';
            }
          } else if (r === 1) {
            // Middle Row: Splitters & Snipers
            if (c % 3 === 0) {
              type = 'splitter'; // Splits on death
              hp = 2;
              color = '#f97316';
            } else if (c === 3 || c === 4) {
              type = 'sniper'; // Targeted lasers
              hp = 2;
              color = '#bd00ff';
            } else {
              type = 'normal';
              hp = 1;
              color = '#bd00ff';
            }
          } else {
            // Bottom Row: Stealth Cloakers & Fast Kamikazes
            if (Math.random() < 0.25) {
              type = 'stealth';
              hp = 1;
              color = '#10b981';
            } else if (Math.random() < 0.30) {
              type = 'kamikaze';
              hp = 1;
              color = '#ffd700';
            }
          }

          // Swooping Galaga Entry Coordinates
          const isLeftOrigin = (c % 2 === 0);
          const originX = isLeftOrigin ? -40 - (c * 30) : this.width + 40 + (c * 30);
          const originY = -50 - (r * 40);

          this.invaders.push({
            x: originX,
            y: originY,
            targetX: targetX,
            targetY: targetY,
            originX: originX,
            originY: originY,
            w: invWidth,
            h: invHeight,
            vx: baseSpeedX,
            type: type,
            hp: hp,
            maxHp: hp,
            color: color,
            diving: false,
            diveAngle: 0,
            sniperCharge: 0,
            stealthAlpha: 1.0,
            hasShield: false
          });
        }
      }
    }
  }

  loop(timestamp) {
    if (!this.isPlaying) return;

    if (this.isPaused) {
      if (timestamp) this.lastFrameTimestamp = timestamp;
      if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
      this.animFrameId = requestAnimationFrame((t) => this.loop(t));
      return;
    }

    if (timestamp) {
      if (!this.lastFrameTimestamp) this.lastFrameTimestamp = timestamp;
      const elapsed = timestamp - this.lastFrameTimestamp;
      const targetFpsMs = 1000 / 60; // 60 FPS cap

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
    if (this.invincibleTimer > 0) return;

    if (this.shieldCount > 0) {
      this.shieldCount--;
      this.invincibleTimer = 40; // 0.6s grace period
      if (this.shieldCount === 1) {
        this.particles.push({ text: '🛡️ 1 SHIELD REMAINING!', color: '#00f0ff', x: this.player ? this.player.x - 15 : 100, y: this.player ? this.player.y - 20 : 200, vy: -1.5, life: 1.2 });
      } else {
        this.particles.push({ text: '🛡️ SHIELD BROKE!', color: '#ff5500', x: this.player ? this.player.x : 100, y: this.player ? this.player.y - 20 : 200, vy: -1.5, life: 1.2 });
      }
      if (window.sfx && window.sfx.playExplosion) window.sfx.playExplosion();
      return;
    }

    this.lives--;
    this.screenShake = 16;
    const livesEl = document.getElementById('invaders-live-lives');
    if (livesEl) livesEl.innerText = this.lives;

    // Full weapon reset to Level 1 when losing a heart/life
    this.weaponLevel = 1;
    this.particles.push({ text: '⚠️ WEAPON RESET TO LVL 1!', color: '#ff0055', x: this.player ? this.player.x - 20 : 100, y: this.player ? this.player.y - 25 : 200, vy: -1.6, life: 1.5 });

    if (this.lives <= 0) {
      this.isDying = true;
      this.deathTimer = 120;
      this.spawnExplosionParticles(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, '#ff0055', 14);
      if (window.sfx && window.sfx.playExplosion) window.sfx.playExplosion();
    } else {
      this.invincibleTimer = 120; // 2 seconds invincibility
      this.spawnExplosionParticles(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, '#ff0055', 8);
      if (window.sfx && window.sfx.playExplosion) window.sfx.playExplosion();
    }
  }

  triggerOverdrive() {
    this.overdrive = 0;
    this.overdriveTimer = 270; // 4.5 seconds (270 frames)
    this.screenShake = 18;
    this.enemyBullets = []; // Vaporize all enemy bullets

    this.particles.push({
      text: '⚡ HYPER OVERDRIVE ACTIVATED! ⚡',
      color: '#00f0ff',
      x: this.player ? this.player.x - 40 : 100,
      y: this.player ? this.player.y - 40 : 200,
      vy: -2.2,
      life: 2.0
    });

    if (window.sfx && typeof window.sfx.playLaser === 'function') window.sfx.playLaser();
    if (window.triggerToast) window.triggerToast("⚡ HYPER OVERDRIVE BEAM READY!", "success");
  }

  update() {
    this.gameTime++;

    // Screen Shake Decay
    if (this.screenShake > 0) this.screenShake *= 0.88;

    // Combo Timer Decay
    if (this.comboTimer > 0) {
      this.comboTimer--;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // Update Death Animation Timer
    if (this.isDying) {
      this.deathTimer--;
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
      return;
    }

    if (this.invincibleTimer > 0) this.invincibleTimer--;

    // 1. Move Player
    const dx = (this.keys.a || this.keys.ArrowLeft ? -1 : 0) + (this.keys.d || this.keys.ArrowRight ? 1 : 0);
    if (this.player) {
      this.player.x += dx * this.player.speed;
      if (this.player.x < 10) this.player.x = 10;
      if (this.player.x > this.width - this.player.w - 10) this.player.x = this.width - this.player.w - 10;
    }

    // Active powerup timers
    if (this.overdriveTimer > 0) this.overdriveTimer--;
    if (this.beamTimer > 0) this.beamTimer--;
    if (this.freezeTimer > 0) this.freezeTimer--;

    // 2. Fire Cannons (Weapon Levels 1-4 & Hyper Beam)
    const isHyperActive = (this.overdriveTimer > 0 || this.beamTimer > 0);
    const fireRate = isHyperActive ? 6 : (this.weaponLevel >= 3 ? 14 : 20);

    if (this.keys[" "] && this.gameTime - this.lastShotTime > fireRate) {
      const px = this.player.x;
      const py = this.player.y;
      const pw = this.player.w;

      if (isHyperActive) {
        // Hyper-Beam Piercing Mega Lasers
        this.bullets.push({ x: px + pw / 2 - 5, y: py - 18, w: 10, h: 22, vy: -12.0, vx: 0, isBeam: true });
      } else if (this.weaponLevel === 1) {
        // Lv1: Single Precision Laser
        this.bullets.push({ x: px + pw / 2 - 2, y: py - 10, w: 4, h: 10, vy: -7.5, vx: 0 });
      } else if (this.weaponLevel === 2) {
        // Lv2: Twin Dual Blasters
        this.bullets.push({ x: px + 6, y: py - 10, w: 4, h: 10, vy: -8.0, vx: 0 });
        this.bullets.push({ x: px + pw - 10, y: py - 10, w: 4, h: 10, vy: -8.0, vx: 0 });
      } else if (this.weaponLevel === 3) {
        // Lv3: Triple Pulse Spread
        this.bullets.push({ x: px + pw / 2 - 2, y: py - 10, w: 4, h: 11, vy: -8.5, vx: 0 });
        this.bullets.push({ x: px + 4, y: py - 10, w: 4, h: 10, vy: -8.0, vx: -1.8 });
        this.bullets.push({ x: px + pw - 8, y: py - 10, w: 4, h: 10, vy: -8.0, vx: 1.8 });
      } else if (this.weaponLevel >= 4) {
        // Lv4: Quad Heavy Plasma + Homing Micro-Missiles
        this.bullets.push({ x: px + 3, y: py - 10, w: 4, h: 11, vy: -9.0, vx: -1.2 });
        this.bullets.push({ x: px + 12, y: py - 10, w: 4, h: 12, vy: -9.0, vx: 0 });
        this.bullets.push({ x: px + pw - 16, y: py - 10, w: 4, h: 12, vy: -9.0, vx: 0 });
        this.bullets.push({ x: px + pw - 7, y: py - 10, w: 4, h: 11, vy: -9.0, vx: 1.2 });

        // Launch Homing Micro-Missiles every alternate shot
        if (Math.floor(this.gameTime / fireRate) % 2 === 0) {
          this.missiles.push({ x: px + 2, y: py, vx: -2.0, vy: -3.0, speed: 6.5, target: null });
          this.missiles.push({ x: px + pw - 4, y: py, vx: 2.0, vy: -3.0, speed: 6.5, target: null });
        }
      }

      this.lastShotTime = this.gameTime;
      if (window.sfx && window.sfx.playRoshamboDrum) window.sfx.playRoshamboDrum();
    }

    // 3. Update Player Bullets & Homing Missiles
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y += b.vy;
      b.x += b.vx;
      if (b.y < 0 || b.x < 0 || b.x > this.width) {
        this.bullets.splice(i, 1);
      }
    }

    // Update Homing Missiles
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      // Target acquisition (closest living invader, boss or UFO)
      let closestTarget = this.boss || (this.ufos[0] || null);
      let minDist = 9999;
      if (!closestTarget) {
        for (const inv of this.invaders) {
          const dist = Math.hypot(inv.x - m.x, inv.y - m.y);
          if (dist < minDist) {
            minDist = dist;
            closestTarget = inv;
          }
        }
      }

      if (closestTarget) {
        const angle = Math.atan2(closestTarget.y + (closestTarget.h / 2) - m.y, closestTarget.x + (closestTarget.w / 2) - m.x);
        m.vx += Math.cos(angle) * 0.55;
        m.vy += Math.sin(angle) * 0.55;
        const curSpeed = Math.hypot(m.vx, m.vy);
        if (curSpeed > m.speed) {
          m.vx = (m.vx / curSpeed) * m.speed;
          m.vy = (m.vy / curSpeed) * m.speed;
        }
      }

      m.x += m.vx;
      m.y += m.vy;

      // Exhaust smoke particle
      if (this.gameTime % 2 === 0) {
        this.particles.push({
          x: m.x, y: m.y, vx: (Math.random() - 0.5) * 0.5, vy: 0.8, color: '#00f0ff', alpha: 0.6, size: 2
        });
      }

      if (m.y < 0 || m.x < 0 || m.x > this.width || m.y > this.height) {
        this.missiles.splice(i, 1);
      }
    }

    // 4. Update Enemy Bullets & Bunker Collisions
    const bulletSpeedMult = this.freezeTimer > 0 ? 0.25 : 1.0;
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.y += (b.vy * bulletSpeedMult);

      // Bunker absorption check
      let absorbedByBunker = false;
      for (const bunker of this.bunkers) {
        for (const seg of bunker.segments) {
          if (seg.hp > 0) {
            const sx = bunker.x + seg.offsetX;
            const sy = bunker.y + seg.offsetY;
            if (b.x < sx + seg.w && b.x + b.w > sx && b.y < sy + seg.h && b.y + b.h > sy) {
              seg.hp--;
              absorbedByBunker = true;
              this.spawnExplosionParticles(b.x, b.y, '#00f0ff', 2);
              break;
            }
          }
        }
        if (absorbedByBunker) break;
      }

      if (absorbedByBunker) {
        this.enemyBullets.splice(i, 1);
        continue;
      }

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

    // 5. Update Powerups & Pickups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.y += 1.8;

      if (
        this.player &&
        p.x < this.player.x + this.player.w &&
        p.x + p.w > this.player.x &&
        p.y < this.player.y + this.player.h &&
        p.y + p.h > this.player.y
      ) {
        // Collect Powerup
        if (p.type === 'quantum_relic') {
          if (typeof window.triggerRelicCelebration === 'function') {
            window.triggerRelicCelebration({
              id: p.relicId,
              name: p.relicName,
              rarity: p.relicRarity,
              gameName: 'Cyber Invaders',
              image: `metadata/images/relics/${p.relicId}.jpg`
            });
          } else {
            if (window.triggerToast) {
              window.triggerToast(`🏺 QUANTUM RELIC HARVESTED! ${p.relicName} (+1 In-Game Relic)`, "success");
            }
            if (window.appState && window.appState.state) {
              const currentRelics = { ...(window.appState.state.relics || {}) };
              const prev = currentRelics[p.relicId] || { unminted: 0, onchain: 0, total: 0, token_ids: [] };
              currentRelics[p.relicId] = {
                ...prev,
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
                  p_relic_id: p.relicId,
                  p_amount: 1
                }).catch(err => console.warn("[invaders.js] grant_relic_drop error:", err));
              }
            }
          }
        } else if (p.type === 'weapon_upgrade') {
          this.weaponLevel = Math.min(4, this.weaponLevel + 1);
          this.particles.push({ text: `⚡ WEAPON LEVEL ${this.weaponLevel}!`, color: '#00f0ff', x: this.player.x - 10, y: this.player.y - 25, vy: -1.8, life: 1.5 });
        } else if (p.type === 'shield') {
          this.shieldCount = Math.min(2, (this.shieldCount || 0) + 1);
          if (this.shieldCount === 2) {
            this.particles.push({ text: '🛡️🛡️ DOUBLE SHIELD ONLINE!', color: '#bd00ff', x: this.player.x - 25, y: this.player.y - 25, vy: -1.6, life: 1.5 });
          } else {
            this.particles.push({ text: '🛡️ QUANTUM SHIELD!', color: '#00ffff', x: this.player.x - 15, y: this.player.y - 20, vy: -1.5, life: 1.2 });
          }
        } else if (p.type === 'beam') {
          this.beamTimer = 360;
          this.particles.push({ text: '⚡ HYPER BEAM READY!', color: '#ffee00', x: this.player.x, y: this.player.y - 20, vy: -1.5, life: 1.2 });
        } else if (p.type === 'freeze') {
          this.freezeTimer = 300;
          this.particles.push({ text: '❄️ CHRONO FREEZE!', color: '#38bdf8', x: this.player.x, y: this.player.y - 20, vy: -1.5, life: 1.2 });
        } else if (p.type === 'emp') {
          this.triggerEMP();
        } else if (p.type === 'life') {
          this.lives++;
          const livesEl = document.getElementById('invaders-live-lives');
          if (livesEl) livesEl.innerText = this.lives;
          this.particles.push({ text: '❤️ EXTRA LIFE +1!', color: '#ff0055', x: this.player.x, y: this.player.y - 20, vy: -1.5, life: 1.2 });
        } else if (p.type === 'pgt_box') {
          this.bonusTokensCollected = (this.bonusTokensCollected || 0) + 1;
          this.particles.push({ text: '🪙 +5 PGT VAULT!', color: '#ffd700', x: this.player.x, y: this.player.y - 20, vy: -1.5, life: 1.2 });
        }

        this.powerups.splice(i, 1);
        if (window.sfx && window.sfx.playPowerup) window.sfx.playPowerup();
      } else if (p.y > this.height) {
        this.powerups.splice(i, 1);
      }
    }

    // 6. Update UFOs
    if (this.boss === null && this.ufos.length === 0 && Math.random() < 0.003) {
      const isGolden = Math.random() < 0.20;
      this.ufos.push({
        x: Math.random() > 0.5 ? -40 : this.width + 40,
        y: 15,
        w: 42,
        h: 18,
        vx: isGolden ? 3.6 : 2.6,
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

    // 7. Update Boss Flagship & Multi-Phase Combat
    if (this.boss) {
      this.boss.x += this.boss.vx;
      if (this.boss.x < 10 || this.boss.x > this.width - this.boss.w - 10) {
        this.boss.vx *= -1;
      }

      // Check Enraged Overdrive Phase (Core HP < 25%)
      if (!this.boss.isEnraged && this.boss.coreHp <= (this.boss.maxCoreHp * 0.25)) {
        this.boss.isEnraged = true;
        this.boss.vx *= 1.4;
        this.screenShake = 12;
        this.particles.push({ text: '⚠️ BOSS ENRAGED!', color: '#ff0000', x: this.boss.x + 20, y: this.boss.y - 20, vy: -1.8, life: 1.5 });
      }

      // Boss Weapon Attacks
      const attackRate = this.boss.isEnraged ? 0.08 : 0.045;
      if (Math.random() < attackRate) {
        // Left Wing Turret
        if (this.boss.leftWingHp > 0) {
          this.enemyBullets.push({ x: this.boss.x + 15, y: this.boss.y + this.boss.h - 5, w: 5, h: 12, vy: 3.2 });
        }
        // Right Wing Turret
        if (this.boss.rightWingHp > 0) {
          this.enemyBullets.push({ x: this.boss.x + this.boss.w - 20, y: this.boss.y + this.boss.h - 5, w: 5, h: 12, vy: 3.2 });
        }
        // Exposed Core Attack (Spiral burst when wings destroyed)
        if (this.boss.leftWingHp <= 0 && this.boss.rightWingHp <= 0) {
          const cx = this.boss.x + this.boss.w / 2;
          const cy = this.boss.y + this.boss.h / 2;
          for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
            this.enemyBullets.push({
              x: cx, y: cy, w: 5, h: 5,
              vx: Math.cos(angle + (this.gameTime * 0.05)) * 2.8,
              vy: Math.sin(angle + (this.gameTime * 0.05)) * 2.8 + 1.2
            });
          }
        }
      }
    }

    // 8. Update Invaders Swarm (Galaga Entrance, Alien Behaviors & Bunker Crushing)
    if (this.invaders.length > 0) {
      let shiftDown = false;
      let invDirection = 0;

      // Handle Galaga Flight Entrance progress
      if (this.waveEntering) {
        this.waveEntranceProgress += 0.025;
        let allDocked = true;
        for (const inv of this.invaders) {
          inv.x += (inv.targetX - inv.x) * 0.12;
          inv.y += (inv.targetY - inv.y) * 0.12;
          if (Math.hypot(inv.targetX - inv.x, inv.targetY - inv.y) > 3) {
            allDocked = false;
          }
        }
        if (allDocked || this.waveEntranceProgress >= 1.0) {
          this.waveEntering = false;
          for (const inv of this.invaders) {
            inv.x = inv.targetX;
            inv.y = inv.targetY;
          }
        }
      }

      // Shield Drone Aura Distribution
      const shieldDrones = this.invaders.filter(i => i.type === 'shield_drone');
      for (const inv of this.invaders) {
        inv.hasShield = false;
        if (inv.type !== 'shield_drone') {
          for (const sd of shieldDrones) {
            if (Math.hypot(inv.x - sd.x, inv.y - sd.y) < 55) {
              inv.hasShield = true;
              break;
            }
          }
        }
      }

      for (let i = this.invaders.length - 1; i >= 0; i--) {
        const inv = this.invaders[i];

        if (!this.waveEntering) {
          if (!inv.diving) {
            inv.x += inv.vx;
            if (inv.x < 10 || inv.x > this.width - inv.w - 10) {
              shiftDown = true;
              invDirection = -inv.vx;
            }
          } else {
            inv.y += 4.0;
            if (inv.y > this.height) {
              this.invaders.splice(i, 1);
              continue;
            }
          }
        }

        // Alien Special Behaviors
        if (inv.type === 'sniper' && !this.waveEntering) {
          inv.sniperCharge++;
          if (inv.sniperCharge >= 180) { // Fires sniper dart every 3s
            inv.sniperCharge = 0;
            const angle = Math.atan2(this.player.y - inv.y, this.player.x - inv.x);
            this.enemyBullets.push({
              x: inv.x + inv.w / 2, y: inv.y + inv.h,
              w: 6, h: 16,
              vx: Math.cos(angle) * 5.0,
              vy: Math.sin(angle) * 5.0
            });
          }
        } else if (inv.type === 'stealth') {
          inv.stealthAlpha = 0.2 + (Math.sin(this.gameTime * 0.08) + 1) * 0.4;
        }

        // Random Kamikaze Dive
        if (inv.type === 'kamikaze' && !inv.diving && !this.waveEntering && Math.random() < 0.0025) {
          inv.diving = true;
        }

        // Random General Shooting
        if (!inv.diving && !this.waveEntering && Math.random() < 0.0012 + (this.level * 0.0004)) {
          this.enemyBullets.push({
            x: inv.x + inv.w / 2,
            y: inv.y + inv.h,
            w: 5,
            h: 12,
            vy: 2.6 + (this.level * 0.12)
          });
        }

        // Collision with Player
        if (
          this.player &&
          inv.x < this.player.x + this.player.w &&
          inv.x + inv.w > this.player.x &&
          inv.y < this.player.y + this.player.h &&
          inv.y + inv.h > this.player.y
        ) {
          this.spawnExplosionParticles(inv.x + inv.w / 2, inv.y + inv.h / 2, inv.color, 4);
          this.invaders.splice(i, 1);
          this.loseLife();
          if (this.isDying) return;
        }
      }

      if (shiftDown && !this.waveEntering) {
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

    // 9. Next Wave & Boss Defeat Progression
    if (!this.boss && this.invaders.length === 0) {
      this.level++;
      this.spawnWave();
    }
    if (this.boss && this.boss.coreHp <= 0) {
      this.spawnExplosionParticles(this.boss.x + this.boss.w / 2, this.boss.y + this.boss.h / 2, '#ff0055', 16);
      this.score += 350;
      this.screenShake = 22;
      this.updateLiveScore();

      this.dropPowerup(this.boss.x + this.boss.w / 2, this.boss.y + this.boss.h / 2, true, false);

      this.boss = null;
      this.level++;
      this.spawnWave();
    }

    // 10. Collision Detection (Player Bullets & Missiles vs Invaders, Bunkers & Boss)
    this.handleProjectileCollisions();
  }

  handleProjectileCollisions() {
    const allProjectiles = [
      ...this.bullets.map((b, idx) => ({ p: b, type: 'bullet', idx, isBeam: b.isBeam })),
      ...this.missiles.map((m, idx) => ({ p: m, type: 'missile', idx, isBeam: false }))
    ];

    for (const proj of allProjectiles) {
      const b = proj.p;
      let hitTarget = false;

      // 1. Boss Sub-System Hit Detection
      if (this.boss) {
        const bx = this.boss.x;
        const by = this.boss.y;
        const bw = this.boss.w;
        const bh = this.boss.h;

        if (b.x < bx + bw && b.x + (b.w || 6) > bx && b.y < by + bh && b.y + (b.h || 6) > by) {
          // Check Left Wing Turret
          if (this.boss.leftWingHp > 0 && b.x < bx + 35) {
            this.boss.leftWingHp--;
            if (this.boss.leftWingHp <= 0) {
              this.spawnExplosionParticles(bx + 18, by + 30, '#ffaa00', 6);
              this.particles.push({ text: '💥 LEFT TURRET DESTROYED!', color: '#ffd700', x: bx, y: by - 15, vy: -1.5, life: 1.2 });
            }
          }
          // Check Right Wing Turret
          else if (this.boss.rightWingHp > 0 && b.x > bx + bw - 35) {
            this.boss.rightWingHp--;
            if (this.boss.rightWingHp <= 0) {
              this.spawnExplosionParticles(bx + bw - 18, by + 30, '#ffaa00', 6);
              this.particles.push({ text: '💥 RIGHT TURRET DESTROYED!', color: '#ffd700', x: bx + bw - 40, y: by - 15, vy: -1.5, life: 1.2 });
            }
          }
          // Exposed Core Hit
          else {
            this.boss.coreHp--;
          }

          this.boss.hp = Math.max(0, this.boss.leftWingHp + this.boss.rightWingHp + this.boss.coreHp);
          this.spawnExplosionParticles(b.x, b.y, '#ffffff', 2);
          this.overdrive = Math.min(100, this.overdrive + 3);

          if (!b.isBeam) {
            if (proj.type === 'bullet') this.bullets.splice(proj.idx, 1);
            else if (proj.type === 'missile') this.missiles.splice(proj.idx, 1);
          }
          continue;
        }
      }

      // 2. UFO Hit Detection
      for (let uIdx = this.ufos.length - 1; uIdx >= 0; uIdx--) {
        const u = this.ufos[uIdx];
        if (b.x < u.x + u.w && b.x + (b.w || 6) > u.x && b.y < u.y + u.h && b.y + (b.h || 6) > u.y) {
          this.spawnExplosionParticles(u.x + u.w / 2, u.y + u.h / 2, u.color, 5);
          this.score += u.isGolden ? 250 : 75;
          this.overdrive = Math.min(100, this.overdrive + 12);
          this.updateLiveScore();

          this.dropPowerup(u.x + u.w / 2, u.y + u.h / 2, true, u.isGolden);
          this.ufos.splice(uIdx, 1);

          if (!b.isBeam) {
            if (proj.type === 'bullet') this.bullets.splice(proj.idx, 1);
            else if (proj.type === 'missile') this.missiles.splice(proj.idx, 1);
          }
          hitTarget = true;
          break;
        }
      }
      if (hitTarget) continue;

      // 3. Invader Swarm Hit Detection
      for (let invIdx = this.invaders.length - 1; invIdx >= 0; invIdx--) {
        const inv = this.invaders[invIdx];

        if (b.x < inv.x + inv.w && b.x + (b.w || 6) > inv.x && b.y < inv.y + inv.h && b.y + (b.h || 6) > inv.y) {
          // Shield Drone Protection check
          if (inv.hasShield) {
            this.spawnExplosionParticles(b.x, b.y, '#00f0ff', 2);
            if (!b.isBeam) {
              if (proj.type === 'bullet') this.bullets.splice(proj.idx, 1);
              else if (proj.type === 'missile') this.missiles.splice(proj.idx, 1);
            }
            hitTarget = true;
            break;
          }

          inv.hp--;
          this.spawnExplosionParticles(b.x, b.y, inv.color, 2);

          if (inv.hp <= 0) {
            this.spawnExplosionParticles(inv.x + inv.w / 2, inv.y + inv.h / 2, inv.color, 4);
            
            // Score + Combo Multiplier
            this.combo++;
            this.comboTimer = 100;
            const comboBonus = Math.min(5, this.combo);
            let pts = (inv.type === 'tank' ? 30 : (inv.type === 'splitter' ? 25 : 15)) * comboBonus;
            
            // Intercept mid-flight bonus
            if (this.waveEntering) {
              pts += 100;
              this.particles.push({ text: '🎯 INTERCEPT! +100', color: '#ffd700', x: inv.x, y: inv.y - 12, vy: -1.6, life: 1.2 });
            }

            this.score += pts;
            this.aliensKilled = (this.aliensKilled || 0) + 1;
            this.overdrive = Math.min(100, this.overdrive + (inv.type === 'tank' ? 4.5 : 2.8));
            this.updateLiveScore();

            // Splitter Alien Spawns 2 Mini-Drones
            if (inv.type === 'splitter') {
              this.invaders.push({
                x: inv.x - 6, y: inv.y, targetX: inv.x - 10, targetY: inv.y + 15,
                w: 16, h: 10, vx: -1.8, hp: 1, maxHp: 1, color: '#f97316', diving: true
              });
              this.invaders.push({
                x: inv.x + 12, y: inv.y, targetX: inv.x + 16, targetY: inv.y + 15,
                w: 16, h: 10, vx: 1.8, hp: 1, maxHp: 1, color: '#f97316', diving: true
              });
            }

            this.dropPowerup(inv.x + inv.w / 2, inv.y + inv.h / 2, false, false);
            this.invaders.splice(invIdx, 1);
          }

          if (!b.isBeam) {
            if (proj.type === 'bullet') this.bullets.splice(proj.idx, 1);
            else if (proj.type === 'missile') this.missiles.splice(proj.idx, 1);
          }
          hitTarget = true;
          break;
        }
      }
    }
  }

  dropPowerup(x, y, isBossOrUfo = false, isGoldenUfo = false) {
    const now = Date.now();
    const lastPgtBoxTime = parseInt(localStorage.getItem('polygame_last_pgt_box_time') || '0', 10);
    const lastLifeTime = parseInt(localStorage.getItem('polygame_last_life_time') || '0', 10);

    const pgtBoxCooldownMs = 20 * 60 * 1000;
    const lifeCooldownMs = 5 * 60 * 1000;

    // 0. Quantum Relic Drop check (~0.10% from standard aliens, 1% Boss, 2% Golden UFO)
    const relicChance = isGoldenUfo ? 0.02 : (isBossOrUfo ? 0.01 : 0.0010);
    if (Math.random() < relicChance) {
      const relicRand = Math.random();
      let pickedRelic = { id: 'relic_invaders_core', name: 'Pulsar Core', rarity: 'rare', color: '#00f0ff' };
      if (relicRand < 0.02) {
        pickedRelic = Math.random() < 0.5
          ? { id: 'relic_apex_singularity', name: 'Quantum Singularity Core', rarity: 'mythic', color: '#ff0055' }
          : { id: 'relic_apex_genesis', name: 'Genesis Matrix', rarity: 'mythic', color: '#ff0055' };
      } else if (relicRand < 0.15) {
        pickedRelic = { id: 'relic_invaders_transmitter', name: 'Quantum Transmitter', rarity: 'legendary', color: '#ffd700' };
      } else if (relicRand < 0.50) {
        pickedRelic = { id: 'relic_invaders_dynamo', name: 'Warp Dynamo', rarity: 'epic', color: '#bd00ff' };
      }

      this.powerups.push({
        x: x - 13, y: y, w: 26, h: 26,
        type: 'quantum_relic',
        relicId: pickedRelic.id,
        relicName: pickedRelic.name,
        relicColor: pickedRelic.color,
        relicRarity: pickedRelic.rarity
      });
      return;
    }

    // 1. Weapon Upgrade Chip (~5% chance from aliens, 100% from Boss/UFO)
    const weaponUpgradeChance = isBossOrUfo ? 0.85 : 0.045;
    if (this.weaponLevel < 4 && Math.random() < weaponUpgradeChance) {
      this.powerups.push({ x: x - 14, y: y, w: 28, h: 28, type: 'weapon_upgrade' });
      return;
    }

    // 2. Rare PGT Box
    const pgtBoxChance = isGoldenUfo ? 0.25 : (isBossOrUfo ? 0.04 : 0.005);
    if ((lastPgtBoxTime === 0 || now - lastPgtBoxTime >= pgtBoxCooldownMs) && Math.random() < pgtBoxChance) {
      localStorage.setItem('polygame_last_pgt_box_time', now.toString());
      this.powerups.push({ x: x - 11, y: y, w: 22, h: 22, type: 'pgt_box' });
      return;
    }

    // 3. Rare Extra Life
    const lifeChance = isGoldenUfo ? 0.40 : (isBossOrUfo ? 0.12 : 0.01);
    if ((lastLifeTime === 0 || now - lastLifeTime >= lifeCooldownMs) && Math.random() < lifeChance) {
      localStorage.setItem('polygame_last_life_time', now.toString());
      this.powerups.push({ x: x - 11, y: y, w: 22, h: 22, type: 'life' });
      return;
    }

    // 4. Standard Powerups (Shield, EMP, Beam, Freeze)
    if (Math.random() < (isBossOrUfo ? 0.60 : 0.06)) {
      const types = ['shield', 'emp', 'beam', 'freeze'];
      const selected = types[Math.floor(Math.random() * types.length)];
      this.powerups.push({ x: x - 11, y: y, w: 22, h: 22, type: selected });
    }
  }

  triggerEMP() {
    this.particles.push({ text: '💣 EMP BLAST WAVE!', color: '#ff5500', x: this.player ? this.player.x - 20 : 100, y: this.player ? this.player.y - 30 : 200, vy: -2, life: 1.5 });
    if (window.sfx && window.sfx.playExplosion) window.sfx.playExplosion();
    this.screenShake = 15;
    this.enemyBullets = [];

    for (let i = this.invaders.length - 1; i >= 0; i--) {
      const inv = this.invaders[i];
      inv.hp -= 2;
      this.spawnExplosionParticles(inv.x + inv.w / 2, inv.y + inv.h / 2, inv.color, 3);
      if (inv.hp <= 0) {
        this.score += 15;
        this.aliensKilled = (this.aliensKilled || 0) + 1;
        this.invaders.splice(i, 1);
      }
    }
    this.updateLiveScore();
  }

  updateLiveScore() {
    const scoreEl = document.getElementById('invaders-live-score');
    if (scoreEl) scoreEl.innerText = this.score;

    const multis = window.appState ? window.appState.getMultipliers() : {nftGameMultiplier: 0};
    const nftMult = 1 + ((multis.nftGameMultiplier || 0) / 100);
    const vipMult = (window.appState && window.appState.isVipActive()) ? 2.0 : 1.0;
    const ambMult = (window.appState && window.appState.state && window.appState.state.isAmbassador) ? 2.0 : 1.0;
    const relicMult = (multis && multis.isApexUnlocked) ? 1.5 : 1.0;
    const playerMult = nftMult * vipMult * ambMult * relicMult;

    const cleanScore = Math.floor(this.score || 0);
    const rawPgt = (cleanScore / 2000.0) + ((this.aliensKilled || 0) * 0.04);
    const finalPgt = (rawPgt * playerMult) + ((this.bonusTokensCollected || 0) * 5.0);
    const earnedEl = document.getElementById('invaders-live-earned');
    if (earnedEl) earnedEl.innerText = finalPgt.toFixed(2);

    const boostLabelEl = document.getElementById('invaders-nft-boost-label');
    if (boostLabelEl) boostLabelEl.innerText = `${playerMult.toFixed(1)}x`;
  }

  stop() {
    this.isPlaying = false;
    this.isDying = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.bullets = [];
    this.missiles = [];
    this.enemyBullets = [];
    this.particles = [];
    this.invaders = [];
    this.powerups = [];
    this.ufos = [];
    this.boss = null;
  }

  spawnExplosionParticles(x, y, color, count = 4) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.6 + Math.random() * 2.0;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color,
        alpha: 1.0,
        size: 2
      });
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

    const multis = window.appState ? window.appState.getMultipliers() : {nftGameMultiplier: 0};
    const nftMult = 1 + ((multis.nftGameMultiplier || 0) / 100);
    const vipMult = (window.appState && window.appState.isVipActive()) ? 2.0 : 1.0;
    const ambMult = (window.appState && window.appState.state && window.appState.state.isAmbassador) ? 2.0 : 1.0;
    const relicMult = (multis && multis.isApexUnlocked) ? 1.5 : 1.0;
    const playerMult = nftMult * vipMult * ambMult * relicMult;

    const cleanScore = Math.floor(this.score || 0);
    const rawBase = (cleanScore / 2000.0) + ((this.aliensKilled || 0) * 0.04);
    const tokenPgt = (this.bonusTokensCollected || 0) * 5.0;
    let finalPgt = parseFloat(((rawBase * playerMult) + tokenPgt).toFixed(2));

    const currentHigh = (window.appState && window.appState.state) ? (window.appState.state.invadersHighScore || 0) : 0;
    const isNewHigh = cleanScore > currentHigh;

    if (isNewHigh && window.appState) {
      window.appState.update({ invadersHighScore: cleanScore });
    }

    if (window.submitHighScoreToDB && cleanScore > 0) {
      window.submitHighScoreToDB('invaders', cleanScore);
    }

    const isPlayerConnected = (window.appState && typeof window.appState.isPlayerConnected === 'function') ? window.appState.isPlayerConnected() : false;
    let verifiedPgt = this.sessionId ? finalPgt : (isPlayerConnected ? 0.0 : finalPgt);
    if (window.endArcadeSession && this.sessionId) {
      const res = await window.endArcadeSession(this.sessionId, cleanScore, this.aliensKilled || 0, this.bonusTokensCollected || 0, nftMult);
      if (res && (res.payout !== undefined || res.payout_pgt !== undefined || res.success)) {
        verifiedPgt = parseFloat(res.payout !== undefined ? res.payout : (res.payout_pgt !== undefined ? res.payout_pgt : 0));
      }
    }

    if (typeof window.sendDiscordEarnAnnouncement === 'function' && verifiedPgt > 0 && isPlayerConnected) {
      window.sendDiscordEarnAnnouncement('Cyber Invaders', cleanScore, verifiedPgt);
    }

    const gamePgt = Math.max(0, verifiedPgt - tokenPgt);
    const maxPlays = (window.appState && window.appState.state && window.appState.state.maxDailyPlaysPerGame) ? window.appState.state.maxDailyPlaysPerGame : 35;
    let payoutDisplay = `+${verifiedPgt.toFixed(2)} PGT`;
    if (isPlayerConnected && !this.sessionId && cleanScore > 0) {
      payoutDisplay = `+0.00 PGT <span style="display:block; color:var(--color-warning); font-size:0.75rem; margin-top:2px;">⚠️ Daily Limit (${maxPlays}/${maxPlays} plays) • Rewards Paused</span>`;
    } else if (tokenPgt > 0 && verifiedPgt > 0) {
      payoutDisplay = `+${gamePgt.toFixed(2)} PGT <span style="color:var(--color-warning); font-size:0.9em; font-weight:700;">+ ${tokenPgt.toFixed(0)} PGT Bonus</span>`;
    }

    const nftPct = (multis && multis.nftGameMultiplier !== undefined) ? multis.nftGameMultiplier : 0;
    const isVip = (window.appState && typeof window.appState.isVipActive === 'function') ? window.appState.isVipActive() : false;
    const isAmb = (window.appState && window.appState.state) ? window.appState.state.isAmbassador : false;
    const vipBadgeStr = (isVip ? ' 🔥 <span style="color:var(--color-warning); font-size:0.75rem;">(VIP 2.0x)</span>' : '') + 
      (isAmb ? ' 🎖️ <span style="color:var(--color-warning); font-size:0.75rem;">(Ambassador 2.0x)</span>' : '') +
      (multis && multis.isApexUnlocked ? ' 🏺 <span style="color:#ffd700; font-size:0.75rem;">(Relics 1.5x)</span>' : '');

    // Render Game Over Overlay
    const overlay = document.getElementById('invaders-ui-overlay');
    if (overlay) {
      overlay.style.padding = '0.5rem';
      overlay.innerHTML = `
        <div style="background: rgba(10, 15, 30, 0.96); border: 2px solid var(--color-primary); border-radius: 10px; padding: 0.75rem 1.2rem; text-align: center; max-width: 380px; width: 92%; box-shadow: 0 0 25px rgba(0, 240, 255, 0.25); box-sizing: border-box;">
          <h2 style="color: var(--color-danger); font-size: 1.25rem; font-weight: 900; margin: 0 0 0.15rem 0; text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 0 10px rgba(255,0,85,0.4);">Mothership Destroyed</h2>
          <p style="color: var(--text-muted); font-size: 0.75rem; margin: 0 0 0.45rem 0;">Alien invasion overwhelming! Final defense stats:</p>
          
          <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-glass); border-radius: 6px; padding: 0.45rem 0.75rem; margin-bottom: 0.5rem; text-align: left;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.2rem 0.75rem; margin-bottom: 0.35rem; font-size: 0.78rem;">
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Score:</span>
                <strong style="color: #fff;">${cleanScore} pts</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Aliens:</span>
                <strong style="color: var(--color-accent);">${this.aliensKilled || 0}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Wave:</span>
                <strong style="color: var(--color-primary);">Sector ${this.level}</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-muted);">Weapon:</span>
                <strong style="color: #00f0ff;">Lvl ${this.weaponLevel} / 4</strong>
              </div>
            </div>
            <div style="margin-bottom: 0.35rem; padding: 0.25rem 0.5rem; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; font-size: 0.72rem; color: var(--text-muted); text-align: center;">
              Base: <strong style="color:#fff;">${rawBase.toFixed(2)} PGT</strong> • Multiplier: <strong style="color:var(--color-secondary);">${playerMult.toFixed(1)}x</strong> <span style="font-size:0.68rem;">(${nftPct}% NFT${vipBadgeStr})</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 0.25rem; font-size: 0.88rem;">
              <span style="color: var(--color-warning); font-weight: 700;">Earned:</span>
              <strong style="color: var(--color-warning); font-size: 1rem;">${payoutDisplay}</strong>
            </div>
          </div>

          <button id="btn-restart-invaders" class="btn-primary" style="width: 100%; padding: 0.5rem; font-weight: 800; font-size: 0.9rem; text-transform: uppercase; cursor: pointer; border-radius: 6px;">
            🚀 Defend Again
          </button>
        </div>
      `;
      overlay.style.display = 'flex';
      const rBtn = document.getElementById('btn-restart-invaders');
      if (rBtn) rBtn.onclick = () => this.startGame();
    }
  }

  draw() {
    this.ctx.save();

    // Dynamic Screen Shake Offset
    if (this.screenShake > 0.5) {
      const sx = (Math.random() - 0.5) * this.screenShake;
      const sy = (Math.random() - 0.5) * this.screenShake;
      this.ctx.translate(sx, sy);
    }

    this.ctx.fillStyle = '#06080c';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Dynamic Cyber Grid Background
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.025)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 40) {
      this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.height); this.ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 40) {
      this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(this.width, y); this.ctx.stroke();
    }

    // Draw Quantum Energy Bunkers
    for (const b of this.bunkers) {
      for (const seg of b.segments) {
        if (seg.hp > 0) {
          const sx = b.x + seg.offsetX;
          const sy = b.y + seg.offsetY;
          const hpPct = seg.hp / seg.maxHp;

          this.ctx.save();
          this.ctx.fillStyle = `rgba(0, 240, 255, ${0.35 + hpPct * 0.55})`;
          this.ctx.strokeStyle = '#00f0ff';
          this.ctx.lineWidth = 1.5;
          this.ctx.shadowColor = '#00f0ff';
          this.ctx.shadowBlur = 8 * hpPct;

          this.ctx.fillRect(sx, sy, seg.w, seg.h);
          this.ctx.strokeRect(sx, sy, seg.w, seg.h);

          // Energy Shield Scanline
          this.ctx.fillStyle = '#ffffff';
          this.ctx.fillRect(sx + 2, sy + 2, seg.w - 4, 1.5);
          this.ctx.restore();
        }
      }
    }

    // Draw Player Shields (Single Cyan Ring or Double Magenta/Cyan Rings)
    if (this.player && this.shieldCount > 0 && !this.isDying) {
      const pcx = this.player.x + this.player.w / 2;
      const pcy = this.player.y + this.player.h / 2;

      this.ctx.save();
      // Primary Inner Shield (Cyan)
      this.ctx.strokeStyle = '#00ffff';
      this.ctx.lineWidth = 2.2;
      this.ctx.shadowColor = '#00ffff';
      this.ctx.shadowBlur = 12;
      this.ctx.beginPath();
      this.ctx.arc(pcx, pcy, 24, 0, Math.PI * 2);
      this.ctx.stroke();

      // Secondary Outer Shield (Double Shield - Rotating Magenta Aura)
      if (this.shieldCount >= 2) {
        this.ctx.strokeStyle = '#bd00ff';
        this.ctx.lineWidth = 2.4;
        this.ctx.shadowColor = '#bd00ff';
        this.ctx.shadowBlur = 16;
        this.ctx.setLineDash([8, 6]);
        this.ctx.lineDashOffset = -this.gameTime * 0.8;
        this.ctx.beginPath();
        this.ctx.arc(pcx, pcy, 31, 0, Math.PI * 2);
        this.ctx.stroke();
      }
      this.ctx.restore();
    }

    // Draw Player Ship
    if (this.player && !this.isDying) {
      if (this.invincibleTimer > 0 && Math.floor(this.gameTime / 6) % 2 === 0) {
        this.ctx.globalAlpha = 0.3;
      }
      this.ctx.shadowColor = '#00ffff';
      this.ctx.shadowBlur = 20;
      this.ctx.fillStyle = '#00ffff';
      this.ctx.fillRect(this.player.x, this.player.y + 5, this.player.w, this.player.h - 5);
      this.ctx.fillRect(this.player.x + this.player.w / 2 - 4, this.player.y - 8, 8, 12);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = '#ffffff';
      this.ctx.shadowBlur = 12;
      this.ctx.fillRect(this.player.x + 4, this.player.y + 7, this.player.w - 8, 5);
      this.ctx.fillRect(this.player.x + this.player.w / 2 - 2, this.player.y - 10, 4, 10);
      this.ctx.fillStyle = '#ff0055';
      this.ctx.shadowColor = '#ff0055';
      this.ctx.shadowBlur = 10;
      this.ctx.fillRect(this.player.x + 8, this.player.y + this.player.h, 4, 6);
      this.ctx.fillRect(this.player.x + this.player.w - 12, this.player.y + this.player.h, 4, 6);
      this.ctx.globalAlpha = 1.0;
    }

    // Draw Hyper-Beam Overdrive Laser Blast
    if (this.overdriveTimer > 0 && this.player) {
      const beamX = this.player.x + this.player.w / 2 - 16;
      this.ctx.save();
      this.ctx.fillStyle = 'rgba(0, 240, 255, 0.45)';
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 25;
      this.ctx.fillRect(beamX, 0, 32, this.player.y);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(beamX + 8, 0, 16, this.player.y);
      this.ctx.restore();
    }

    // Draw Player Bullets
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 8;
    for (const b of this.bullets) {
      this.ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    // Draw Homing Micro-Missiles
    for (const m of this.missiles) {
      this.ctx.save();
      this.ctx.fillStyle = '#ffaa00';
      this.ctx.shadowColor = '#ffaa00';
      this.ctx.shadowBlur = 10;
      this.ctx.beginPath();
      this.ctx.arc(m.x, m.y, 3.5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // Draw Enemy Bullets (Vibrant High-Contrast Solar Plasma Bolts)
    this.ctx.save();
    for (const b of this.enemyBullets) {
      const bw = (b.w || 5);
      const bh = (b.h || 12);
      const bx = b.x - (bw / 2);
      const by = b.y;

      // 1. Radiant Amber Outer Glow & Body
      this.ctx.shadowColor = '#ff6a00';
      this.ctx.shadowBlur = 14;
      this.ctx.fillStyle = '#ffaa00';
      this.ctx.beginPath();
      if (this.ctx.roundRect) {
        this.ctx.roundRect(bx, by, bw, bh, 3);
      } else {
        this.ctx.rect(bx, by, bw, bh);
      }
      this.ctx.fill();

      // 2. Pure White Super-Hot Laser Core (Cuts cleanly through all space backgrounds)
      this.ctx.shadowColor = '#ffffff';
      this.ctx.shadowBlur = 4;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      const coreW = Math.max(1.5, bw - 2.4);
      const coreH = Math.max(3, bh - 3);
      if (this.ctx.roundRect) {
        this.ctx.roundRect(bx + (bw - coreW) / 2, by + 1.5, coreW, coreH, 1.5);
      } else {
        this.ctx.rect(bx + (bw - coreW) / 2, by + 1.5, coreW, coreH);
      }
      this.ctx.fill();
    }
    this.ctx.restore();

    // Draw Powerups (High-Def Vector Emblems)
    for (const p of this.powerups) {
      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      const r = p.w / 2;
      this.ctx.save();
      let mainColor = '#00ff00';
      if (p.type === 'quantum_relic') mainColor = p.relicColor || '#ffd700';
      else if (p.type === 'weapon_upgrade') mainColor = '#ffd700'; // Radiant Gold
      else if (p.type === 'shield') mainColor = '#00f0ff';
      else if (p.type === 'life') mainColor = '#ff0055';
      else if (p.type === 'pgt_box') mainColor = '#ffaa00';
      else if (p.type === 'emp') mainColor = '#ff5500';
      else if (p.type === 'beam') mainColor = '#ffee00';
      else if (p.type === 'freeze') mainColor = '#38bdf8';

      this.ctx.beginPath();
      this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
      this.ctx.fillStyle = p.type === 'weapon_upgrade' ? 'rgba(5, 25, 45, 0.95)' : 'rgba(10, 15, 30, 0.90)';
      this.ctx.strokeStyle = mainColor;
      this.ctx.lineWidth = p.type === 'weapon_upgrade' ? 2.5 : 2.0;
      this.ctx.shadowColor = mainColor;
      this.ctx.shadowBlur = p.type === 'weapon_upgrade' ? 18 : 12;
      this.ctx.fill();
      this.ctx.stroke();

      if (p.type === 'quantum_relic') {
        this.ctx.font = 'bold 13px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🏺', cx, cy);
      } else if (p.type === 'weapon_upgrade') {
        // High-Visibility Blazing Golden/Cyan Weapon Chip
        this.ctx.fillStyle = 'rgba(0, 240, 255, 0.30)';
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
        this.ctx.fill();

        // Twin Golden Ascending Chevrons ▲▲
        this.ctx.fillStyle = '#ffd700';
        this.ctx.shadowColor = '#ffd700';
        this.ctx.shadowBlur = 10;
        
        // Top Chevron
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy - 8);
        this.ctx.lineTo(cx + 6, cy - 2);
        this.ctx.lineTo(cx + 3, cy - 2);
        this.ctx.lineTo(cx, cy - 5);
        this.ctx.lineTo(cx - 3, cy - 2);
        this.ctx.lineTo(cx - 6, cy - 2);
        this.ctx.closePath();
        this.ctx.fill();

        // Bottom Chevron
        this.ctx.beginPath();
        this.ctx.moveTo(cx, cy - 2);
        this.ctx.lineTo(cx + 6, cy + 4);
        this.ctx.lineTo(cx + 3, cy + 4);
        this.ctx.lineTo(cx, cy + 1);
        this.ctx.lineTo(cx - 3, cy + 4);
        this.ctx.lineTo(cx - 6, cy + 4);
        this.ctx.closePath();
        this.ctx.fill();

        // Bold white label text below
        this.ctx.font = '900 8px monospace';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.shadowColor = '#00f0ff';
        this.ctx.shadowBlur = 6;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('GUN UP', cx, cy + 8);
      } else if (p.type === 'shield') {
        this.ctx.fillStyle = '#00f0ff';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🛡️', cx, cy);
      } else if (p.type === 'life') {
        this.ctx.fillStyle = '#ff0055';
        this.ctx.font = 'bold 11px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('❤️', cx, cy);
      } else if (p.type === 'pgt_box') {
        this.ctx.fillStyle = '#ffaa00';
        this.ctx.font = 'bold 11px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🪙', cx, cy);
      } else if (p.type === 'emp') {
        this.ctx.fillStyle = '#ff5500';
        this.ctx.font = 'bold 11px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('💣', cx, cy);
      } else if (p.type === 'beam') {
        this.ctx.fillStyle = '#ffee00';
        this.ctx.font = 'bold 11px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('⚡', cx, cy);
      } else if (p.type === 'freeze') {
        this.ctx.fillStyle = '#38bdf8';
        this.ctx.font = 'bold 11px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('❄️', cx, cy);
      }
      this.ctx.restore();
    }

    // Draw Invaders Swarm
    for (const inv of this.invaders) {
      this.ctx.save();
      if (inv.type === 'stealth') {
        this.ctx.globalAlpha = inv.stealthAlpha || 0.8;
      }

      this.ctx.fillStyle = inv.color;
      this.ctx.shadowColor = inv.color;
      this.ctx.shadowBlur = 8;
      this.ctx.fillRect(inv.x, inv.y, inv.w, inv.h);

      // Alien Type Visual Decals
      this.ctx.fillStyle = '#fff';
      if (inv.type === 'tank') {
        const w = (inv.w - 8) / 3;
        for (let i = 0; i < inv.hp; i++) {
          this.ctx.fillRect(inv.x + 4 + (i * w), inv.y + 4, w - 1, inv.h - 8);
        }
      } else if (inv.type === 'splitter') {
        this.ctx.fillRect(inv.x + 6, inv.y + 4, inv.w - 12, inv.h - 8);
      } else if (inv.type === 'shield_drone') {
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 1.5;
        this.ctx.strokeRect(inv.x - 2, inv.y - 2, inv.w + 4, inv.h + 4);
      } else if (inv.type === 'sniper') {
        this.ctx.fillStyle = '#ff0055';
        this.ctx.fillRect(inv.x + inv.w / 2 - 2, inv.y + inv.h - 4, 4, 6);
      }

      // Shield Aura Bubble
      if (inv.hasShield) {
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(inv.x + inv.w / 2, inv.y + inv.h / 2, 20, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.restore();
    }

    // Draw UFOs
    for (const u of this.ufos) {
      this.ctx.fillStyle = u.color;
      this.ctx.shadowColor = u.color;
      this.ctx.shadowBlur = 15;
      this.ctx.beginPath();
      this.ctx.ellipse(u.x + u.w / 2, u.y + u.h / 2, u.w / 2, u.h / 2, 0, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = '#fff';
      this.ctx.beginPath();
      this.ctx.arc(u.x + u.w / 2, u.y + u.h / 2 - 4, u.w / 4, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Draw Multi-Phase Boss Flagship
    if (this.boss) {
      const bx = this.boss.x;
      const by = this.boss.y;
      const bw = this.boss.w;
      const bh = this.boss.h;

      this.ctx.save();
      if (this.boss.isEnraged) {
        this.ctx.shadowColor = '#ff0000';
        this.ctx.shadowBlur = 25;
      }

      // Main Boss Hull
      this.ctx.fillStyle = this.boss.isEnraged ? '#ff1144' : '#bd00ff';
      this.ctx.fillRect(bx + 30, by + 10, bw - 60, bh - 15);

      // Left Wing Cannon (Destructible)
      if (this.boss.leftWingHp > 0) {
        this.ctx.fillStyle = '#ffaa00';
        this.ctx.fillRect(bx, by + 20, 30, bh - 25);
        this.ctx.fillStyle = '#ff0055';
        this.ctx.fillRect(bx + 12, by + bh - 8, 6, 12);
      }

      // Right Wing Cannon (Destructible)
      if (this.boss.rightWingHp > 0) {
        this.ctx.fillStyle = '#ffaa00';
        this.ctx.fillRect(bx + bw - 30, by + 20, 30, bh - 25);
        this.ctx.fillStyle = '#ff0055';
        this.ctx.fillRect(bx + bw - 18, by + bh - 8, 6, 12);
      }

      // Exposed Core Center
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = '#00f0ff';
      this.ctx.shadowBlur = 15;
      this.ctx.beginPath();
      this.ctx.arc(bx + bw / 2, by + bh / 2, 12, 0, Math.PI * 2);
      this.ctx.fill();

      // Boss Health Bar with Segmented Hull Display
      this.ctx.fillStyle = 'rgba(0,0,0,0.75)';
      this.ctx.fillRect(bx, by - 16, bw, 8);
      this.ctx.fillStyle = this.boss.isEnraged ? '#ff0000' : '#00f0ff';
      const hpPct = Math.max(0, this.boss.hp / this.boss.maxHp);
      this.ctx.fillRect(bx, by - 16, bw * hpPct, 8);
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(bx, by - 16, bw, 8);

      this.ctx.restore();
    }

    // Draw Particles & Floating Text
    this.ctx.shadowBlur = 4;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += (p.vx || 0);
      p.y += (p.vy || 0);
      p.alpha = (p.alpha !== undefined) ? p.alpha - (p.text ? 0.02 : 0.045) : 1.0;

      if (p.text) {
        this.ctx.font = 'bold 12px monospace';
        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = Math.max(0, p.alpha);
        this.ctx.fillText(p.text, p.x, p.y);
      } else {
        this.ctx.fillStyle = p.color;
        this.ctx.shadowColor = p.color;
        this.ctx.globalAlpha = Math.max(0, p.alpha);
        const sz = p.size || 2;
        this.ctx.fillRect(p.x, p.y, sz, sz);
      }

      if (p.alpha <= 0) this.particles.splice(i, 1);
    }
    this.ctx.globalAlpha = 1.0;
    this.ctx.shadowBlur = 0;

    // Draw Overdrive Meter HUD (Bottom Screen)
    this.drawOverdriveHud();

    this.ctx.restore();
  }

  drawOverdriveHud() {
    const barWidth = 140;
    const barHeight = 8;
    const barX = this.width - barWidth - 14;
    const barY = this.height - 18;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
    this.ctx.fillRect(barX, barY, barWidth, barHeight);

    // Overdrive Fill
    const fillPct = Math.min(1.0, this.overdrive / 100);
    const isFull = this.overdrive >= 100;
    this.ctx.fillStyle = isFull ? (Math.floor(this.gameTime / 4) % 2 === 0 ? '#ffd700' : '#00f0ff') : '#00f0ff';
    this.ctx.shadowColor = isFull ? '#ffd700' : '#00f0ff';
    this.ctx.shadowBlur = isFull ? 12 : 6;
    this.ctx.fillRect(barX, barY, barWidth * fillPct, barHeight);

    this.ctx.strokeStyle = isFull ? '#ffd700' : 'rgba(0, 240, 255, 0.4)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(barX, barY, barWidth, barHeight);

    this.ctx.font = 'bold 9px monospace';
    this.ctx.fillStyle = isFull ? '#ffd700' : '#00f0ff';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(isFull ? '⚡ OVERDRIVE READY (100%)' : `⚡ HYPER ${Math.floor(this.overdrive)}%`, barX + barWidth, barY - 4);
    this.ctx.restore();
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
