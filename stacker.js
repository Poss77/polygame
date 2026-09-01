/**
 * ============================================================================
 * POLYGAME: CYBER STACKER (PHYSICS NEON TOWER STACKING ARCADE)
 * ============================================================================
 * - 60 FPS HTML5 Canvas Physics-Based Balance & Timing Game
 * - Controls: Mouse Click, Screen Tap, Spacebar, Down Arrow, or Touch Drop Button
 * - Mechanics: Drop varied geometric blocks from a moving quantum crane.
 * - Physics: Center of Mass calculations, tower wobble, tipping instability & collapse.
 * - Precision: Perfect drops (±6px) grant combo multipliers (up to 5.0x) and stabilize tower.
 * - Aesthetics: Ascending camera from neon cyberpunk streets to cyberspace orbit.
 * - Integration: Secure Anti-Cheat session handshake and live weekly leaderboards.
 * ============================================================================
 */

class CyberStackerGame {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.container = null;

    this.width = 640;
    this.height = 600;
    this.isPlaying = false;
    this.animationId = null;
    this.lastTime = 0;

    // Camera & View
    this.cameraY = 0;
    this.targetCameraY = 0;

    // Crane State
    this.crane = {
      x: 320,
      y: 110,
      baseSpeed: 3.5,
      speed: 3.5,
      direction: 1,
      minX: 80,
      maxX: 560
    };

    // Current Dropping Block
    this.activeBlock = null;

    // Tower Stack (Array of placed blocks)
    this.tower = [];
    this.fallingDebris = [];
    this.particles = [];
    this.floatingTexts = [];

    // Game Metrics
    this.score = 0;
    this.floors = 0;
    this.lives = 3;
    this.combo = 1.0;
    this.comboCount = 0;
    this.goldenCoresCollected = 0;
    this.towerWobble = 0;
    this.towerWobbleVel = 0;
    this.gameTime = 0;
    this.sessionId = null;

    this._listenersAttached = false;
    this.init();
  }

  init() {
    this.ensureCanvas();
    window.addEventListener('resize', () => this.resize());

    // Keyboard Listeners
    window.addEventListener('keydown', (e) => {
      if ([' ', 'ArrowDown', 's', 'S', 'Enter'].includes(e.key) && this.isPlaying) {
        e.preventDefault();
        this.dropActiveBlock();
      }
    });

    this.bindDOMButtons();
  }

  ensureCanvas() {
    if (!this.canvas) {
      this.canvas = document.getElementById('stacker-canvas');
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.container = document.getElementById('container-stacker');
    }

    if (this.canvas && !this._listenersAttached) {
      this._listenersAttached = true;

      // Click / Tap on Canvas to drop block
      const handleDropInput = (e) => {
        if (!this.isPlaying) return;
        if (e.target.closest('#stacker-start-screen') || e.target.closest('#stacker-gameover-screen') || e.target.closest('button')) {
          return;
        }
        e.preventDefault();
        this.dropActiveBlock();
      };

      this.canvas.addEventListener('mousedown', handleDropInput);
      this.canvas.addEventListener('touchstart', handleDropInput, { passive: false });
    }

    this.bindDOMButtons();
    this.resize();
  }

  bindDOMButtons() {
    // Touch Drop Button HUD
    const btnDropHud = document.getElementById('stacker-btn-drop');
    if (btnDropHud && !btnDropHud._hasStackerListener) {
      btnDropHud._hasStackerListener = true;
      const onDrop = (e) => {
        e.preventDefault();
        this.dropActiveBlock();
      };
      btnDropHud.addEventListener('touchstart', onDrop, { passive: false });
      btnDropHud.addEventListener('mousedown', onDrop);
    }
  }

  resize() {
    if (!this.canvas) {
      this.canvas = document.getElementById('stacker-canvas');
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.container = document.getElementById('container-stacker');
    }
    if (!this.canvas || !this.container) return;

    const rect = this.container.getBoundingClientRect();
    const isFullscreen = document.body.classList.contains('game-fullscreen-open') || document.getElementById('game-window-container')?.classList.contains('fullscreen-active');

    let w, h;
    if (isFullscreen) {
      const availW = Math.max(320, window.innerWidth - 16);
      const availH = Math.max(360, window.innerHeight - 124);
      w = Math.min(availW, Math.round(availH * (4 / 3)));
      h = Math.min(availH, Math.round(w * (3 / 4)));
    } else {
      w = Math.round(rect.width || 640);
      h = Math.round(rect.height || (w * 0.75) || 480);
    }

    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;

    this.crane.y = Math.round(Math.min(90, Math.max(65, this.height * 0.14)));
    this.crane.minX = 60;
    this.crane.maxX = this.width - 60;

    // Reposition base foundation if initialized
    if (this.tower.length > 0 && this.tower[0].type === 'foundation') {
      const targetBaseY = this.height - 45;
      const deltaY = targetBaseY - this.tower[0].y;
      if (deltaY !== 0) {
        for (const b of this.tower) {
          b.y += deltaY;
        }
      }
    }

    const hudControls = document.getElementById('stacker-controls-hud');
    if (hudControls) {
      hudControls.style.display = (w <= 640) ? 'flex' : 'none';
    }
  }

  // --- Block Shape Generator ---
  generateNextBlock() {
    const floor = this.floors;
    const rand = Math.random();

    let type = 'cube';
    let w = 70;
    let h = 32;
    let color = '#00f0ff';
    let isGold = false;

    if (floor === 0) {
      // First base block: Wide foundation
      type = 'wide';
      w = 140;
      h = 32;
      color = '#00ff88';
    } else if (rand < 0.08) {
      // 8% Golden Quantum Core (+5 PGT bonus)
      type = 'gold';
      w = 60;
      h = 34;
      color = '#ffd700';
      isGold = true;
    } else if (rand < 0.35) {
      // 27% Wide Slab (Stable)
      type = 'wide';
      w = Math.max(80, 120 - Math.floor(floor * 1.5));
      h = 28;
      color = '#00f0ff';
    } else if (rand < 0.65) {
      // 30% Standard Cube
      type = 'cube';
      w = Math.max(55, 75 - Math.floor(floor * 1.2));
      h = 34;
      color = '#a855f7';
    } else if (rand < 0.82) {
      // 17% Narrow Pillar (High height gain, tricky balance)
      type = 'pillar';
      w = Math.max(36, 48 - Math.floor(floor * 0.8));
      h = 50;
      color = '#06b6d4';
    } else {
      // 18% Wedge / Beam Shape
      type = 'wedge';
      w = Math.max(65, 90 - Math.floor(floor * 1.2));
      h = 30;
      color = '#ec4899';
    }

    return {
      type,
      w,
      h,
      color,
      isGold,
      x: this.crane.x,
      y: this.crane.y + 20,
      vy: 0,
      vx: 0,
      rot: 0,
      rotVel: 0,
      state: 'swinging', // 'swinging', 'falling', 'placed', 'toppling'
      floorNumber: floor + 1
    };
  }

  resetGame() {
    this.resize();
    this.score = 0;
    this.floors = 0;
    this.lives = 3;
    this.combo = 1.0;
    this.comboCount = 0;
    this.goldenCoresCollected = 0;
    this.towerWobble = 0;
    this.towerWobbleVel = 0;
    this.gameTime = 0;
    this.cameraY = 0;
    this.targetCameraY = 0;

    this.tower = [];
    this.fallingDebris = [];
    this.particles = [];
    this.floatingTexts = [];

    // Foundation Base Platform at bottom
    const baseFloor = {
      type: 'foundation',
      w: Math.min(220, this.width * 0.42),
      h: 36,
      x: this.width / 2,
      y: this.height - 40,
      color: '#3b82f6',
      isGold: false,
      state: 'placed',
      floorNumber: 0
    };
    this.tower.push(baseFloor);

    // Crane setup
    this.crane.x = this.width / 2;
    this.crane.speed = 3.5;
    this.crane.direction = 1;

    this.activeBlock = this.generateNextBlock();
    this.updateHUD();
  }

  async start() {
    // Check VIP Access Guard
    const isVip = window.appState && typeof window.appState.isVipActive === 'function' && window.appState.isVipActive();
    const isAmb = window.appState && window.appState.state && window.appState.state.isAmbassador;
    const isAdmin = window.appState && window.appState.state && window.appState.state.isAdmin;

    const settings = (window.appState && window.appState.state && window.appState.state.gamePayoutSettings) || {};
    const vipOnly = settings.stacker ? settings.stacker.vip_only : (settings.catcher ? settings.catcher.vip_only : true);

    if (vipOnly && !isVip && !isAmb && !isAdmin) {
      if (window.showVipLockModal) {
        window.showVipLockModal('Cyber Stacker');
      } else if (window.triggerToast) {
        window.triggerToast("👑 VIP Exclusive Game! Upgrade to VIP Pass to play.", "warning");
      }
      return;
    }

    if (this._isStarting) return;
    this._isStarting = true;
    setTimeout(() => { this._isStarting = false; }, 600);

    this.resetGame();
    this.isPlaying = true;

    const startScreen = document.getElementById('stacker-start-screen');
    const gameOverScreen = document.getElementById('stacker-gameover-screen');
    if (startScreen) startScreen.style.display = 'none';
    if (gameOverScreen) gameOverScreen.style.display = 'none';

    // Start Server-Side Anti-Cheat Session Handshake
    this.sessionId = null;
    if (window.startArcadeSession) {
      try {
        this.sessionId = await window.startArcadeSession('Cyber Stacker');
      } catch (err) {
        console.warn("[CyberStacker] Session start error:", err);
      }
    }

    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.lastTime = performance.now();
    this.loop();
  }

  dropActiveBlock() {
    if (!this.isPlaying || !this.activeBlock || this.activeBlock.state !== 'swinging') return;

    this.activeBlock.state = 'falling';
    this.activeBlock.vy = 8.5;
    this.activeBlock.vx = (this.crane.speed * this.crane.direction) * 0.45; // Carry crane momentum

    if (window.sfx && window.sfx.playLaser) window.sfx.playLaser();
  }

  loop() {
    if (!this.isPlaying) return;

    if (this.isPaused) {
      this.animationId = requestAnimationFrame(() => this.loop());
      return;
    }

    this.update();
    this.render();

    this.animationId = requestAnimationFrame(() => this.loop());
  }

  update() {
    this.gameTime++;

    // 1. Update Crane Oscillation
    const speedMultiplier = 1.0 + Math.min(2.2, this.floors * 0.04);
    this.crane.speed = this.crane.baseSpeed * speedMultiplier;
    this.crane.x += this.crane.speed * this.crane.direction;

    if (this.crane.x >= this.crane.maxX) {
      this.crane.x = this.crane.maxX;
      this.crane.direction = -1;
    } else if (this.crane.x <= this.crane.minX) {
      this.crane.x = this.crane.minX;
      this.crane.direction = 1;
    }

    // 2. Update Active Block
    if (this.activeBlock) {
      if (this.activeBlock.state === 'swinging') {
        this.activeBlock.x = this.crane.x;
        this.activeBlock.y = this.crane.y + 20 - this.cameraY;
      } else if (this.activeBlock.state === 'falling') {
        this.activeBlock.y += this.activeBlock.vy;
        this.activeBlock.x += this.activeBlock.vx;
        this.activeBlock.vy += 0.45; // Gravity
        this.activeBlock.rot += this.activeBlock.rotVel;

        // Collision Check with Top of Tower
        const topBlock = this.tower[this.tower.length - 1];
        const landingY = topBlock.y - (this.activeBlock.h / 2) - (topBlock.h / 2);

        if (this.activeBlock.y >= landingY) {
          this.evaluateBlockLanding(this.activeBlock, topBlock);
        }
      }
    }

    // 3. Update Tower Wobble & Physics
    this.towerWobbleVel -= this.towerWobble * 0.08; // Spring restoration
    this.towerWobbleVel *= 0.92; // Damping
    this.towerWobble += this.towerWobbleVel;

    // 4. Update Falling Debris
    for (let i = this.fallingDebris.length - 1; i >= 0; i--) {
      const d = this.fallingDebris[i];
      d.x += d.vx;
      d.y += d.vy;
      d.vy += 0.5;
      d.rot += d.rotVel;
      if (d.y > this.height + this.cameraY + 200) {
        this.fallingDebris.splice(i, 1);
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

    // 7. Smooth Camera Interpolation (Only scroll up when tower reaches the middle of the screen)
    const topBlock = this.tower[this.tower.length - 1];
    if (topBlock) {
      const scrollThresholdY = Math.round(this.crane.y + 160);
      const idealCameraY = Math.max(0, scrollThresholdY - topBlock.y);
      this.targetCameraY = idealCameraY;
      this.cameraY += (this.targetCameraY - this.cameraY) * 0.1;
    }

    // Periodic HUD Refresh
    if (this.gameTime % 15 === 0) {
      this.updateLiveEarnDisplay();
    }
  }

  evaluateBlockLanding(block, topBlock) {
    const landingY = topBlock.y - (block.h / 2) - (topBlock.h / 2);
    block.y = landingY;

    // Calculate Offset from Center of Support Block
    const offset = block.x - topBlock.x;
    const maxAllowedOffset = (topBlock.w / 2) + (block.w / 2) - 8;

    // Case 1: COMPLETE MISS (Fell off side)
    if (Math.abs(offset) > maxAllowedOffset) {
      this.handleMissedDrop(block, offset);
      return;
    }

    // Case 2: CRITICAL OVERHANG / COLLAPSE (Center of mass outside support)
    const overhang = Math.abs(offset);
    const criticalThreshold = (topBlock.w / 2) * 0.88;

    if (overhang > criticalThreshold) {
      // Block topples off
      this.handleToppleDrop(block, offset);
      return;
    }

    // Case 3: SUCCESSFUL PLACEMENT
    block.state = 'placed';
    block.y = landingY;
    block.vy = 0;
    block.vx = 0;
    this.tower.push(block);
    this.floors++;

    const isPerfect = Math.abs(offset) <= 6;

    if (isPerfect) {
      // ✨ PERFECT DROP!
      block.x = topBlock.x; // Magnetically snap to true center
      this.comboCount++;
      this.combo = Math.min(5.0, parseFloat((1.0 + (this.comboCount * 0.5)).toFixed(1)));

      const floorPoints = Math.floor(100 * this.combo);
      this.score += floorPoints;

      // Dampen tower wobble completely
      this.towerWobble *= 0.2;
      this.towerWobbleVel = 0;

      this.addSparks(block.x, block.y, '#00f0ff', 30);
      this.addPopup(`✨ PERFECT! +${floorPoints} (${this.combo.toFixed(1)}x)`, '#00f0ff');
      if (window.sfx && window.sfx.playPowerUp) window.sfx.playPowerUp();
    } else {
      // Standard Landing with Wobble physics
      this.comboCount = 0;
      this.combo = 1.0;

      const accuracyFactor = Math.max(0.3, 1 - (overhang / criticalThreshold));
      const floorPoints = Math.floor(50 * accuracyFactor);
      this.score += floorPoints;

      // Induce wobble in direction of offset
      const wobbleImpulse = (offset / criticalThreshold) * 0.18;
      this.towerWobbleVel += wobbleImpulse;

      this.addSparks(block.x, block.y, block.color, 15);
      this.addPopup(`+${floorPoints}`, '#ffffff');
      if (window.sfx && window.sfx.playCoin) window.sfx.playCoin();
    }

    // Golden Core Bonus
    if (block.isGold) {
      this.goldenCoresCollected++;
      this.score += 250;
      this.addSparks(block.x, block.y, '#ffd700', 40);
      this.addPopup("🪙 +5 PGT GOLD CORE!", "#ffd700");
    }

    // Quantum Relic Drop Check (2% from Golden Core, 0.10% from standard placement)
    const relicChance = block.isGold ? 0.02 : 0.0010;
    if (Math.random() < relicChance) {
      // 2% Mythic (Singularity/Genesis), 13% Legendary (Monolith), 35% Epic (Keystone), 50% Rare (Foundation)
      const relicRand = Math.random();
      let pickedRelic = { id: 'relic_stacker_foundation', name: 'Titanium Bedrock', rarity: 'rare', color: '#00f0ff' };
      if (relicRand < 0.02) {
        pickedRelic = Math.random() < 0.5
          ? { id: 'relic_apex_singularity', name: 'Quantum Singularity Core', rarity: 'mythic', color: '#ff0055' }
          : { id: 'relic_apex_genesis', name: 'Genesis Matrix', rarity: 'mythic', color: '#ff0055' };
      } else if (relicRand < 0.15) {
        pickedRelic = { id: 'relic_stacker_monolith', name: 'Quantum Monolith', rarity: 'legendary', color: '#ffd700' };
      } else if (relicRand < 0.50) {
        pickedRelic = { id: 'relic_stacker_keystone', name: 'Harmonic Keystone', rarity: 'epic', color: '#bd00ff' };
      }

      this.score += 1000;
      this.addSparks(block.x, block.y, pickedRelic.color, 50);
      this.addPopup(`🏺 ${pickedRelic.name.toUpperCase()}!`, pickedRelic.color);
      if (typeof window.triggerRelicCelebration === 'function') {
        window.triggerRelicCelebration({
          id: pickedRelic.id,
          name: pickedRelic.name,
          rarity: pickedRelic.rarity,
          gameName: 'Cyber Stacker',
          image: `metadata/images/relics/${pickedRelic.id}.jpg`
        });
      } else {
        if (window.triggerToast) {
          window.triggerToast(`🏺 QUANTUM RELIC HARVESTED! ${pickedRelic.name} (+1 In-Game Relic)`, "success");
        }
        if (window.appState && window.appState.state) {
          const currentRelics = { ...(window.appState.state.relics || {}) };
          const prev = currentRelics[pickedRelic.id] || { unminted: 0, onchain: 0, total: 0, token_ids: [] };
          currentRelics[pickedRelic.id] = {
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
              p_relic_id: pickedRelic.id,
              p_amount: 1
            }).catch(e => console.warn("[Relic Harvest Sync]", e));
          }
        }
      }
    }

    // Check Cumulative Tower Stability
    this.checkTowerStability();

    this.updateHUD();

    // Spawn Next Block on Crane
    setTimeout(() => {
      if (this.isPlaying) {
        this.activeBlock = this.generateNextBlock();
      }
    }, 250);
  }

  handleMissedDrop(block, offset) {
    block.state = 'toppling';
    block.vx = (offset > 0 ? 4 : -4);
    block.vy = 2;
    block.rotVel = (offset > 0 ? 0.15 : -0.15);
    this.fallingDebris.push(block);

    this.lives--;
    this.combo = 1.0;
    this.comboCount = 0;
    this.addPopup("❌ MISSED DROP! -1 LIFE", "#ff3366");
    if (window.sfx && window.sfx.playExplosion) window.sfx.playExplosion();

    this.updateHUD();

    if (this.lives <= 0) {
      this.gameOver();
      return;
    }

    setTimeout(() => {
      if (this.isPlaying) {
        this.activeBlock = this.generateNextBlock();
      }
    }, 400);
  }

  handleToppleDrop(block, offset) {
    block.state = 'toppling';
    block.vx = (offset > 0 ? 3.5 : -3.5);
    block.vy = -2;
    block.rotVel = (offset > 0 ? 0.12 : -0.12);
    this.fallingDebris.push(block);

    this.lives--;
    this.combo = 1.0;
    this.comboCount = 0;
    this.towerWobbleVel += (offset > 0 ? 0.25 : -0.25);

    this.addPopup("⚠️ OVERHANG TOPPLE! -1 LIFE", "#ffaa00");
    if (window.sfx && window.sfx.playExplosion) window.sfx.playExplosion();

    this.updateHUD();

    if (this.lives <= 0) {
      this.gameOver();
      return;
    }

    setTimeout(() => {
      if (this.isPlaying) {
        this.activeBlock = this.generateNextBlock();
      }
    }, 400);
  }

  checkTowerStability() {
    // If tower has excessive cumulative tilt wobble, topple the top sections!
    if (Math.abs(this.towerWobble) > 0.45 && this.tower.length > 3) {
      const collapseCount = Math.min(3, this.tower.length - 2);
      for (let i = 0; i < collapseCount; i++) {
        const collapsed = this.tower.pop();
        if (collapsed) {
          collapsed.state = 'toppling';
          collapsed.vx = (this.towerWobble > 0 ? 5 : -5) + (Math.random() - 0.5) * 2;
          collapsed.vy = -3 - (i * 2);
          collapsed.rotVel = (this.towerWobble > 0 ? 0.1 : -0.1);
          this.fallingDebris.push(collapsed);
        }
      }
      this.floors = Math.max(0, this.floors - collapseCount);
      this.towerWobble *= 0.3;
      this.addPopup("💥 TOWER SECTION COLLAPSE!", "#ff3366");
      if (window.triggerToast) window.triggerToast("⚠️ Tower instability caused a structural collapse!", "warning");
    }
  }

  addSparks(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 6;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 2 + Math.random() * 3,
        color,
        alpha: 1.0,
        decay: 0.025 + Math.random() * 0.03
      });
    }
  }

  addPopup(text, color = '#fff') {
    const topBlock = this.tower[this.tower.length - 1];
    const px = topBlock ? topBlock.x : this.width / 2;
    const py = topBlock ? topBlock.y - 30 : this.height / 2;

    this.floatingTexts.push({
      text,
      color,
      x: px,
      y: py,
      vy: -1.8,
      alpha: 1.0
    });
  }

  updateHUD() {
    const scoreEl = document.getElementById('stacker-live-score');
    if (scoreEl) scoreEl.innerText = this.score.toLocaleString();

    const floorsEl = document.getElementById('stacker-live-floors');
    if (floorsEl) floorsEl.innerText = `${this.floors}F (${(this.floors * 3.5).toFixed(1)}m)`;

    const comboEl = document.getElementById('stacker-live-combo');
    if (comboEl) {
      comboEl.innerText = `${this.combo.toFixed(1)}x`;
      comboEl.style.color = (this.combo > 1.0) ? 'var(--color-secondary)' : 'var(--text-muted)';
    }

    const livesEl = document.getElementById('stacker-live-lives');
    if (livesEl) {
      let heartStr = '';
      for (let i = 0; i < this.lives; i++) heartStr += '❤️';
      for (let i = this.lives; i < 3; i++) heartStr += '🖤';
      livesEl.innerText = heartStr;
    }

    this.updateLiveEarnDisplay();
  }

  updateLiveEarnDisplay() {
    const earnedEl = document.getElementById('stacker-live-earned');
    if (!earnedEl) return;

    const multis = window.appState ? window.appState.getMultipliers() : { nftGameMultiplier: 0 };
    const nftMult = 1 + ((multis.nftGameMultiplier || 0) / 100);
    const vipMult = (window.appState && window.appState.isVipActive()) ? 2.0 : 1.0;
    const ambMult = (window.appState && window.appState.state && window.appState.state.isAmbassador) ? 2.0 : 1.0;
    const relicMult = (multis && multis.isApexUnlocked) ? 1.5 : 1.0;
    const playerMult = nftMult * vipMult * ambMult * relicMult;

    const globalEarnMult = (window.appState && window.appState.state && window.appState.state.globalEarnMultiplier !== undefined) ? Number(window.appState.state.globalEarnMultiplier) : 1.0;
    const basePgt = ((this.floors * 0.45) + (this.score / 1500.0)) * globalEarnMult;
    const estPgt = (basePgt * playerMult) + (this.goldenCoresCollected * 5.0);

    earnedEl.innerText = estPgt.toFixed(2);
    const boostLabelEl = document.getElementById('stacker-nft-boost-label');
    if (boostLabelEl) boostLabelEl.innerText = `${playerMult.toFixed(1)}x`;
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Dynamic Atmospheric Background (Ascends with tower height)
    const altitude = this.floors;
    let bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);

    if (altitude < 10) {
      // Ground / Cityscape Neon Level
      bgGrad.addColorStop(0, '#0a051b');
      bgGrad.addColorStop(1, '#060a14');
    } else if (altitude < 25) {
      // Cloud / Lightning Layer
      bgGrad.addColorStop(0, '#150a2a');
      bgGrad.addColorStop(1, '#081026');
    } else {
      // Space Orbit Layer
      bgGrad.addColorStop(0, '#020208');
      bgGrad.addColorStop(1, '#0d041e');
    }

    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Neon Cyber Grid Background
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    const gridOffsetY = Math.floor(this.cameraY % gridSize);
    for (let x = 0; x < this.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = gridOffsetY; y < this.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // 2. Quantum Crane & Cable (Fixed at Top of Screen)
    ctx.strokeStyle = 'rgba(255, 170, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(this.crane.minX, this.crane.y);
    ctx.lineTo(this.crane.maxX, this.crane.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Crane Trolley Hook
    ctx.fillStyle = '#ffaa00';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ffaa00';
    ctx.fillRect(this.crane.x - 18, this.crane.y - 8, 36, 16);

    // Cable to Active Block
    if (this.activeBlock && this.activeBlock.state === 'swinging') {
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.crane.x, this.crane.y + 8);
      ctx.lineTo(this.activeBlock.x, this.activeBlock.y - (this.activeBlock.h / 2));
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // --- Apply Camera Offset for World Objects ---
    ctx.save();
    ctx.translate(0, this.cameraY);

    // 3. Render Placed Tower Blocks
    for (let i = 0; i < this.tower.length; i++) {
      const b = this.tower[i];
      ctx.save();

      // Cumulative Wobble Offset as tower gets higher
      const blockWobble = (i / Math.max(1, this.tower.length)) * this.towerWobble * 25;
      ctx.translate(b.x + blockWobble, b.y);

      // Block Glow & Styling
      ctx.shadowBlur = b.isGold ? 18 : 10;
      ctx.shadowColor = b.color;
      ctx.fillStyle = b.isGold ? 'linear-gradient(135deg, #ffd700, #ff8800)' : b.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;

      if (b.type === 'foundation') {
        // Heavy base slab
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#00f0ff';
        ctx.lineWidth = 2;
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
      } else {
        // Geometric Block Body
        ctx.fillStyle = b.color;
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, 4);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
          ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
        }

        // Inner Cyber Line Accent
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-b.w * 0.35, 0);
        ctx.lineTo(b.w * 0.35, 0);
        ctx.stroke();

        // Floor Badge
        if (b.floorNumber > 0 && b.floorNumber % 5 === 0) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${b.floorNumber}F`, 0, 0);
        }
      }

      ctx.restore();
    }

    // 4. Render Falling Debris / Toppled Blocks
    for (const d of this.fallingDebris) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = d.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = d.color;
      ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
      ctx.restore();
    }

    // 5. Render Active Dropping Block
    if (this.activeBlock) {
      const b = this.activeBlock;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);

      ctx.shadowBlur = 15;
      ctx.shadowColor = b.color;
      ctx.fillStyle = b.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, 4);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.strokeRect(-b.w / 2, -b.h / 2, b.w, b.h);
      }

      ctx.restore();
    }

    // 6. Render Particles
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 7. Render Floating Text Popups
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

    ctx.restore(); // Restore Camera
    ctx.restore(); // Restore Canvas
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
    const relicMult = (multis && multis.isApexUnlocked) ? 1.5 : 1.0;
    const playerMult = nftMult * vipMult * ambMult * relicMult;

    const cleanScore = Math.floor(this.score || 0);
    const globalEarnMult = (window.appState && window.appState.state && window.appState.state.globalEarnMultiplier !== undefined) ? Number(window.appState.state.globalEarnMultiplier) : 1.0;
    const rawBase = ((this.floors * 0.45) + (cleanScore / 1500.0)) * globalEarnMult;
    const tokenPgt = this.goldenCoresCollected * 5.0;
    const finalPgt = cleanScore > 0 ? parseFloat(((rawBase * playerMult) + tokenPgt).toFixed(2)) : 0;

    let isNewHigh = (window.appState && cleanScore > (window.appState.state.stackerHighScore || window.appState.state.catcherHighScore || 0));
    const isPlayerConnected = (window.appState && typeof window.appState.isPlayerConnected === 'function') ? window.appState.isPlayerConnected() : false;
    let verifiedPgt = this.sessionId ? finalPgt : (isPlayerConnected ? 0.0 : finalPgt);
    // Submit Session End through Secure Server Handshake
    if (window.endArcadeSession && this.sessionId) {
      try {
        const res = await window.endArcadeSession(this.sessionId, cleanScore, this.floors, this.goldenCoresCollected, nftMult);
        if (res && (res.payout !== undefined || res.payout_pgt !== undefined || res.success)) {
          verifiedPgt = parseFloat(res.payout !== undefined ? res.payout : (res.payout_pgt !== undefined ? res.payout_pgt : 0));
          if (res.is_new_high) isNewHigh = true;
        }
      } catch (err) {
        console.warn("[CyberStacker] endArcadeSession exception:", err);
      }
    }

    if (isNewHigh && window.appState) {
      window.appState.update({ 
        stackerHighScore: cleanScore,
        catcherHighScore: cleanScore
      });
    }

    if (window.trackQuestProgress) {
      window.trackQuestProgress('arcade', 1);
    }

    // Render Game Over UI
    const gameOverScreen = document.getElementById('stacker-gameover-screen');
    const finalScoreEl = document.getElementById('stacker-final-score');
    const finalFloorsEl = document.getElementById('stacker-final-floors');
    const finalPgtEl = document.getElementById('stacker-final-pgt');
    const multBreakdownEl = document.getElementById('stacker-mult-breakdown');
    const highscoreText = document.getElementById('stacker-highscore-text');

    const gamePgt = Math.max(0, verifiedPgt - tokenPgt);
    const maxPlays = (window.appState && window.appState.state && window.appState.state.maxDailyPlaysPerGame) ? window.appState.state.maxDailyPlaysPerGame : 35;
    let payoutDisplay = `+${verifiedPgt.toFixed(2)} PGT`;
    if (isPlayerConnected && !this.sessionId && cleanScore > 0) {
      payoutDisplay = `+0.00 PGT <span style="display:block; color:var(--color-warning); font-size:0.75rem; margin-top:2px;">⚠️ Daily Limit (${maxPlays}/${maxPlays} plays) • Rewards Paused</span>`;
    } else if (tokenPgt > 0 && verifiedPgt > 0) {
      payoutDisplay = `+${gamePgt.toFixed(2)} PGT <span style="color:var(--color-warning); font-size:0.9em; font-weight:700;">+ ${tokenPgt.toFixed(0)} PGT Bonus</span>`;
    }

    if (finalScoreEl) finalScoreEl.innerText = cleanScore.toLocaleString();
    if (finalFloorsEl) finalFloorsEl.innerText = `${this.floors} Floors Stacked (${(this.floors * 3.5).toFixed(1)}m)`;
    if (finalPgtEl) finalPgtEl.innerHTML = payoutDisplay;

    const vipBadgeStr = (isVip ? ' 🔥 <span style="color:var(--color-warning); font-size:0.8rem;">(VIP 2.0x)</span>' : '') +
      (isAmb ? ' 🎖️ <span style="color:var(--color-warning); font-size:0.8rem;">(Ambassador 2.0x)</span>' : '') +
      (multis && multis.isApexUnlocked ? ' 🏺 <span style="color:#ffd700; font-size:0.8rem;">(Relics 1.5x)</span>' : '');
    if (multBreakdownEl) {
      multBreakdownEl.innerHTML = `Base: ${rawBase.toFixed(2)} PGT • Multiplier: <strong style="color:var(--color-secondary);">${playerMult.toFixed(1)}x</strong> (${nftPct}% NFT${vipBadgeStr})`;
    }

    if (highscoreText) {
      highscoreText.style.display = isNewHigh ? 'block' : 'none';
    }

    if (window.submitHighScoreToDB && cleanScore > 0) {
      window.submitHighScoreToDB('stacker', cleanScore);
    }

    if (typeof window.sendDiscordEarnAnnouncement === 'function') {
      window.sendDiscordEarnAnnouncement('Cyber Stacker', cleanScore, verifiedPgt);
    } else if (typeof window.sendDiscordHighScore === 'function') {
      window.sendDiscordHighScore('Cyber Stacker', cleanScore, verifiedPgt);
    }

    if (window.appState && window.appState.addActivity) {
      window.appState.addActivity('You', `built a ${this.floors}-floor neon skyscraper in Cyber Stacker`, `+${verifiedPgt.toFixed(2)} PGT`);
    }

    if (gameOverScreen) gameOverScreen.style.display = 'flex';
  }

  stop() {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    const startScreen = document.getElementById('stacker-start-screen');
    const gameOverScreen = document.getElementById('stacker-gameover-screen');
    if (startScreen) startScreen.style.display = 'flex';
    if (gameOverScreen) gameOverScreen.style.display = 'none';
  }
}

// Global instance initialization & helpers
window.launchCyberStackerGame = function() {
  if (window.cyberStacker) {
    window.cyberStacker.ensureCanvas();
    window.cyberStacker.start();
  }
};

window.cyberStacker = new CyberStackerGame();

document.addEventListener('DOMContentLoaded', () => {
  if (window.cyberStacker) {
    window.cyberStacker.ensureCanvas();
  }
});
