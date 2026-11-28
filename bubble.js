/**
 * Cyber Bubble Mini-Game Engine (HTML5 Canvas)
 * Classic Pang / Bubble Trouble arcade action featuring:
 * - 5 Ball Sizes (Size 5 Giant -> Size 4 -> Size 3 -> Size 2 -> Size 1 Tiny)
 * - Splitting physics: every hit splits balls > Size 1 into two smaller bouncing spheres
 * - Vertical laser-chain harpoon arrow (destroys any ball touching tip or tether)
 * - Rotating wave arena energy platforms (balls bounce off shelves; harpoons pierce cleanly)
 * - Escalating waves & ceiling portal drops with vertical drop warning beams
 * - Power-ups: Double Harpoon, Sticky Wire (3s ceiling lock), Cyber EMP, Bubble Shield, Time Freeze, Extra Life & Bonus PGT Coin
 * - Tactical Cyber Dash (Shift / C / Double-tap / HUD button) with afterimage trail
 * - Visible Combo Gauge + Fever Speed Boost (8+ combo)
 * - Offscreen-cached backdrop & pre-rendered 3D ball sprites for locked 60 FPS performance
 */

class BubbleTroubleGame {
  constructor(canvasId, overlayId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.overlay = document.getElementById(overlayId);

    this.width = this.canvas.width;   // 640
    this.height = this.canvas.height; // 400
    this.floorY = this.height - 28;
    this.ceilingY = 18;

    this.isPlaying = false;
    this.isPaused = false;
    this.sessionRelicsDroppedCount = 0;
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.elapsedSec = 0;
    this.ballsPopped = 0;
    this.bonusTokensCollected = 0;
    this.sessionId = null;

    // Combo & VFX
    this.combo = 0;
    this.comboTimer = 0;
    this.screenShake = 0;
    this.flashAlpha = 0;
    this.flashColor = '255, 42, 133';
    this.waveBannerTimer = 0;
    this.portalSpawnTimer = 18;

    // Power-ups & Dash
    this.doubleArrowTimer = 0;
    this.stickyWireTimer = 0;
    this.freezeTimer = 0;
    this.hasShield = false;
    this.invincibleTimer = 0;
    this.dashCooldown = 0;
    this.dashMaxCooldown = 3.0;
    this.dashTimer = 0;
    this.dashDir = 1;
    this.dashGhosts = [];

    // Cached HUD DOM nodes & payout multipliers
    this._scoreEl = null;
    this._waveEl = null;
    this._livesEl = null;
    this._earnedEl = null;
    this._boostLabelEl = null;
    this._lastScoreStr = null;
    this._lastWaveStr = null;
    this._lastLivesStr = null;
    this._lastEarnedStr = null;
    this._cachedPlayerMult = 1.0;
    this._cachedGlobalEarnMult = 1.0;

    // Controls
    this.keys = { a: false, d: false, ArrowLeft: false, ArrowRight: false };
    this.touchActive = false;
    this.touchPointerId = null;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchLastX = 0;
    this.touchMoved = false;
    this.touchMoveTimer = 0;
    this.secondaryTouchPointers = new Map();
    this._lastTapTime = 0;
    this._lastTapX = 0;

    // Entities
    this.player = { x: this.width / 2, y: this.floorY, w: 28, h: 42, speed: 300, facing: 1, walkPhase: 0, shootAnim: 0 };
    this.arrows = [];
    this.balls = [];
    this.platforms = [];
    this.particles = [];
    this.floatingTexts = [];
    this.powerups = [];
    this.portals = [];

    // Background stars & skyline
    this.stars = Array.from({ length: 48 }, () => ({
      x: Math.round(Math.random() * this.width),
      y: Math.round(this.ceilingY + Math.random() * (this.floorY - this.ceilingY - 80)),
      size: Math.random() > 0.65 ? 2 : 1,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 1.8
    }));
    this.skyline = this.buildSkyline();

    // 5 Ball Size Specs (5 = Giant -> 1 = Tiny)
    this.ballSpecs = {
      5: { r: 44, bounceVy: 525, vx: 98,  pts: 25,  c1: '#ff9ec4', c2: '#ff1e6e', c3: '#5e0028', glow: 'rgba(255, 30, 110, 0.32)' },
      4: { r: 33, bounceVy: 485, vx: 118, pts: 50,  c1: '#ffd09b', c2: '#ff6a00', c3: '#5c1f00', glow: 'rgba(255, 106, 0, 0.32)' },
      3: { r: 24, bounceVy: 440, vx: 138, pts: 75,  c1: '#fff3a1', c2: '#ffd000', c3: '#614a00', glow: 'rgba(255, 208, 0, 0.30)' },
      2: { r: 16, bounceVy: 385, vx: 162, pts: 112, c1: '#b8fbff', c2: '#00e5ff', c3: '#00485c', glow: 'rgba(0, 229, 255, 0.32)' },
      1: { r: 10, bounceVy: 330, vx: 190, pts: 175, c1: '#f1c4ff', c2: '#b84dff', c3: '#3c0066', glow: 'rgba(184, 77, 255, 0.36)' }
    };

    // Pre-render static backdrop & 3D ball sprites for locked 60 FPS
    this._bgCanvas = null;
    this._ballSprites = {};
    this._buildStaticBackdrop();
    this._buildBallSprites();

    this.gravity = 560;
    this.animFrameId = null;
    this.lastTimestamp = 0;

    this.initEvents();
  }

  buildSkyline() {
    const towers = [];
    let x = 0;
    while (x < this.width) {
      const w = 22 + Math.floor(Math.random() * 32);
      const h = 40 + Math.floor(Math.random() * 95);
      towers.push({ x, w, h, lit: Math.random() > 0.35 });
      x += w + 4;
    }
    return towers;
  }

  _buildStaticBackdrop() {
    if (typeof document === 'undefined') return;
    const off = document.createElement('canvas');
    off.width = this.width;
    off.height = this.height;
    const ctx = off.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Deep cyber-sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, this.floorY);
    sky.addColorStop(0, '#070618');
    sky.addColorStop(0.55, '#120b2e');
    sky.addColorStop(1, '#220b38');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.width, this.height);

    // Nebula glow
    const neb = ctx.createRadialGradient(this.width * 0.72, 110, 10, this.width * 0.72, 110, 220);
    neb.addColorStop(0, 'rgba(255, 42, 133, 0.22)');
    neb.addColorStop(0.5, 'rgba(0, 240, 255, 0.10)');
    neb.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, this.width, this.floorY);

    // Distant synthwave horizon sun/moon
    const sunGrad = ctx.createLinearGradient(0, 120, 0, 250);
    sunGrad.addColorStop(0, 'rgba(255, 210, 80, 0.26)');
    sunGrad.addColorStop(1, 'rgba(255, 42, 133, 0.04)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(this.width * 0.5, 220, 74, 0, Math.PI * 2);
    ctx.fill();

    // Neon skyline silhouettes
    for (let i = 0; i < this.skyline.length; i++) {
      const t = this.skyline[i];
      ctx.fillStyle = 'rgba(11, 10, 28, 0.85)';
      ctx.fillRect(t.x, this.floorY - t.h, t.w, t.h);
      if (t.lit) {
        ctx.fillStyle = 'rgba(0, 240, 255, 0.12)';
        ctx.fillRect(t.x + 4, this.floorY - t.h + 8, 3, t.h - 14);
      }
    }

    // Arena floor with perspective grid (batched into 1 stroke)
    const floorGrad = ctx.createLinearGradient(0, this.floorY, 0, this.height);
    floorGrad.addColorStop(0, '#1a1140');
    floorGrad.addColorStop(1, '#090616');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, this.floorY, this.width, this.height - this.floorY);

    ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = 0; gx <= this.width; gx += 40) {
      ctx.moveTo(gx, this.floorY);
      ctx.lineTo(this.width / 2 + (gx - this.width / 2) * 1.35, this.height);
    }
    ctx.stroke();

    // Glowing floor line & ceiling laser rail
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.floorY);
    ctx.lineTo(this.width, this.floorY);
    ctx.stroke();

    // Ceiling rail
    ctx.fillStyle = '#120c2c';
    ctx.fillRect(0, 0, this.width, this.ceilingY);
    ctx.strokeStyle = '#ff2a85';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.ceilingY);
    ctx.lineTo(this.width, this.ceilingY);
    ctx.stroke();

    // Side pillars
    ctx.fillStyle = '#141033';
    ctx.fillRect(0, this.ceilingY, 10, this.floorY - this.ceilingY);
    ctx.fillRect(this.width - 10, this.ceilingY, 10, this.floorY - this.ceilingY);

    this._bgCanvas = off;
  }

  _buildBallSprites() {
    if (typeof document === 'undefined') return;
    const sizes = [1, 2, 3, 4, 5];
    for (let i = 0; i < sizes.length; i++) {
      const sz = sizes[i];
      const spec = this.ballSpecs[sz];
      const pad = 10;
      const dim = (spec.r + pad) * 2;
      const off = document.createElement('canvas');
      off.width = dim;
      off.height = dim;
      const ctx = off.getContext('2d');
      if (!ctx) continue;

      const cx = dim / 2;
      const cy = dim / 2;

      // Soft outer neon halo (layered alpha circle, zero runtime shadowBlur)
      ctx.fillStyle = spec.glow;
      ctx.beginPath();
      ctx.arc(cx, cy, spec.r + 5, 0, Math.PI * 2);
      ctx.fill();

      // 3D glossy radial sphere gradient
      const grad = ctx.createRadialGradient(
        cx - spec.r * 0.32,
        cy - spec.r * 0.32,
        spec.r * 0.08,
        cx,
        cy,
        spec.r
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.22, spec.c1);
      grad.addColorStop(0.72, spec.c2);
      grad.addColorStop(1, spec.c3);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, spec.r, 0, Math.PI * 2);
      ctx.fill();

      // Subtle rim highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Crisp specular shine dot
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.beginPath();
      ctx.ellipse(-spec.r * 0.34, -spec.r * 0.34, spec.r * 0.18, spec.r * 0.1, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      this._ballSprites[sz] = { canvas: off, half: dim / 2 };
    }
  }

  initEvents() {
    window.addEventListener('keydown', (e) => {
      if (!this.isPlaying || this.isPaused) return;
      if (!e || e.isTrusted !== true) {
        if (window.antiBot) window.antiBot.reportSuspiciousActivity('Cyber Bubble', 'untrusted_keyboard_input');
        return;
      }
      if (e.repeat) {
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Shift') {
          e.preventDefault();
        }
        return;
      }
      if (Object.prototype.hasOwnProperty.call(this.keys, e.key)) {
        this.keys[e.key] = true;
      }
      if (e.key === 'Shift' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        this.triggerDash();
        return;
      }
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        this.shootArrow();
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (Object.prototype.hasOwnProperty.call(this.keys, e.key)) {
        this.keys[e.key] = false;
      }
    });

    let cachedRect = null;
    let lastRectTs = 0;
    const getCanvasPos = (clientX, clientY) => {
      const now = performance.now();
      if (!cachedRect || now - lastRectTs > 250) {
        cachedRect = this.canvas.getBoundingClientRect();
        lastRectTs = now;
      }
      const rect = cachedRect;
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        return { x: this.width / 2, y: this.height / 2 };
      }
      return {
        x: ((clientX - rect.left) / rect.width) * this.width,
        y: ((clientY - rect.top) / rect.height) * this.height
      };
    };
    window.addEventListener('resize', () => { cachedRect = null; });
    window.addEventListener('scroll', () => { cachedRect = null; }, { passive: true });

    const TAP_SLOP_PX = 7;

    window.addEventListener('pointerdown', (e) => {
      if (!this.isPlaying || this.isPaused) return;
      if (e.isTrusted !== true) return;
      if (e.pointerType !== 'touch') {
        if (e.target === this.canvas) {
          const pos = getCanvasPos(e.clientX, e.clientY);
          // Check bottom-right canvas Dash button click
          if (pos.x >= this.width - 102 && pos.x <= this.width - 12 && pos.y >= this.floorY - 34 && pos.y <= this.floorY - 4) {
            this.triggerDash();
            return;
          }
          this.shootArrow();
        }
        return;
      }

      if (!this.canvas || this.canvas.offsetParent === null) return;
      const targetEl = e.target && e.target.closest ? e.target : null;
      if (targetEl && targetEl.closest('button, a, input, select, textarea, [role="button"], .game-overlay, .modal, .nav-item, .tab-btn')) {
        return;
      }

      cachedRect = null;
      const pos = getCanvasPos(e.clientX, e.clientY);
      // Check bottom-right canvas Dash button tap
      if (pos.x >= this.width - 106 && pos.x <= this.width - 8 && pos.y >= this.floorY - 38 && pos.y <= this.floorY) {
        this.triggerDash();
        return;
      }

      if (this.touchPointerId === null || this.touchPointerId === undefined) {
        this.touchPointerId = e.pointerId;
        this.touchStartX = pos.x;
        this.touchStartY = pos.y;
        this.touchLastX = pos.x;
        this.touchMoved = false;
        this.touchActive = false;
        this.shootArrow();
      } else if (e.pointerId !== this.touchPointerId) {
        this.secondaryTouchPointers.set(e.pointerId, {
          startX: pos.x,
          startY: pos.y,
          moved: false
        });
        this.shootArrow();
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isPlaying || this.isPaused) return;
      if (e.pointerType !== 'touch') return;

      const pos = getCanvasPos(e.clientX, e.clientY);
      if (e.pointerId === this.touchPointerId) {
        if (!this.touchMoved) {
          if (Math.hypot(pos.x - this.touchStartX, pos.y - this.touchStartY) > TAP_SLOP_PX) {
            this.touchMoved = true;
            this.touchLastX = pos.x;
          }
          return;
        }
        const rawDx = pos.x - this.touchLastX;
        const dx = Math.max(-36, Math.min(36, rawDx));
        if (Math.abs(dx) > 0.25) {
          const halfW = this.player.w / 2;
          this.player.x = Math.max(halfW + 10, Math.min(this.width - halfW - 10, this.player.x + dx));
          this.player.facing = dx > 0 ? 1 : -1;
          this.player.walkPhase += Math.abs(dx) * 0.25;
          this.touchActive = true;
          this.touchMoveTimer = 0.08;
        }
        this.touchLastX = pos.x;
      } else if (this.secondaryTouchPointers.has(e.pointerId)) {
        const sec = this.secondaryTouchPointers.get(e.pointerId);
        if (!sec.moved && Math.hypot(pos.x - sec.startX, pos.y - sec.startY) > TAP_SLOP_PX) {
          sec.moved = true;
        }
      }
    });

    const endTouch = (e) => {
      if (!e || e.pointerType !== 'touch') return;
      if (e.pointerId === this.touchPointerId) {
        this.touchPointerId = null;
        this.touchActive = false;
        this.touchMoved = false;
        this.touchMoveTimer = 0;
      } else if (this.secondaryTouchPointers.has(e.pointerId)) {
        this.secondaryTouchPointers.delete(e.pointerId);
      }
    };
    window.addEventListener('pointerup', (e) => endTouch(e));
    window.addEventListener('pointercancel', (e) => endTouch(e));

    // Prevent browser scroll/pan from firing pointercancel when swiping outside the canvas on mobile
    window.addEventListener('touchmove', (e) => {
      if (!this.isPlaying || this.isPaused) return;
      if (!this.canvas || this.canvas.offsetParent === null) return;
      const targetEl = e.target && e.target.closest ? e.target : null;
      if (targetEl && targetEl.closest('button, a, input, select, textarea, [role="button"], .game-overlay, .modal, .nav-item, .tab-btn')) {
        return;
      }
      e.preventDefault();
    }, { passive: false });
  }

  triggerDash(explicitDir = null) {
    if (!this.isPlaying || this.isPaused) return;
    if (this.dashCooldown > 0 || this.dashTimer > 0) return;

    let dir = explicitDir;
    if (!dir) {
      if (this.keys.a || this.keys.ArrowLeft) dir = -1;
      else if (this.keys.d || this.keys.ArrowRight) dir = 1;
      else dir = this.player.facing || 1;
    }

    this.dashDir = dir;
    this.player.facing = dir;
    this.dashTimer = 0.17;
    this.dashCooldown = this.dashMaxCooldown;
    this.invincibleTimer = Math.max(this.invincibleTimer, 0.24);
    this.dashGhosts = [];
    this.playTone(340, 760, 0.10, 'triangle', 0.09);
  }

  async startGame() {
    if (this._isStarting) return;
    this._isStarting = true;

    let sessId = null;
    try {
      if (window.startArcadeSession) {
        sessId = await window.startArcadeSession('Cyber Bubble');
      }
    } catch (e) {
      console.warn('[CyberBubble] startArcadeSession error:', e);
    } finally {
      this._isStarting = false;
    }

    if (!sessId && window.appState && typeof window.appState.isPlayerConnected === 'function' && window.appState.isPlayerConnected()) {
      return;
    }

    if (window.sfx && typeof window.sfx.init === 'function') window.sfx.init();

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this.sessionId = sessId;
    this.sessionRelicsDroppedCount = 0;
    this.setGlobalTouchLock(true);
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.elapsedSec = 0;
    this.ballsPopped = 0;
    this.bonusTokensCollected = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.screenShake = 0;
    this.flashAlpha = 0;
    this.flashColor = '255, 42, 133';
    this.doubleArrowTimer = 0;
    this.stickyWireTimer = 0;
    this.freezeTimer = 0;
    this.hasShield = false;
    this.invincibleTimer = 1.5;
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.dashGhosts = [];
    this.portalSpawnTimer = 22;

    this.keys = { a: false, d: false, ArrowLeft: false, ArrowRight: false };
    this.touchActive = false;
    this.touchPointerId = null;
    this.touchMoved = false;
    this.touchMoveTimer = 0;
    if (this.secondaryTouchPointers) this.secondaryTouchPointers.clear();

    this.player = { x: this.width / 2, y: this.floorY, w: 28, h: 42, speed: 310, facing: 1, walkPhase: 0, shootAnim: 0 };
    this.arrows = [];
    this.balls = [];
    this.platforms = [];
    this.particles = [];
    this.floatingTexts = [];
    this.powerups = [];
    this.portals = [];

    if (this.overlay) this.overlay.style.display = 'none';

    // Cache HUD DOM elements & static multipliers once at run start
    this._scoreEl = document.getElementById('bubble-live-score');
    this._waveEl = document.getElementById('bubble-live-wave');
    this._livesEl = document.getElementById('bubble-live-lives');
    this._earnedEl = document.getElementById('bubble-live-earned');
    this._boostLabelEl = document.getElementById('bubble-nft-boost-label');
    this._lastScoreStr = null;
    this._lastWaveStr = null;
    this._lastLivesStr = null;
    this._lastEarnedStr = null;

    const multis = window.appState ? window.appState.getMultipliers() : { nftGameMultiplier: 0 };
    const nftMult = 1 + ((multis.nftGameMultiplier || 0) / 100);
    const isVip = window.appState && typeof window.appState.isVipActive === 'function' && window.appState.isVipActive();
    const vipLevel = (window.appState && typeof window.appState.getVipLevel === 'function') ? window.appState.getVipLevel() : (isVip ? 2 : 0);
    const vipMult = isVip ? (vipLevel >= 2 ? 2.0 : 1.5) : 1.0;
    const ambMult = (window.appState && window.appState.state && window.appState.state.isAmbassador) ? 2.0 : 1.0;
    const relicMult = (multis && multis.isApexUnlocked) ? 1.5 : 1.0;
    this._cachedPlayerMult = nftMult * vipMult * ambMult * relicMult;
    this._cachedGlobalEarnMult = (window.appState && window.appState.state && window.appState.state.globalEarnMultiplier !== undefined)
      ? Number(window.appState.state.globalEarnMultiplier)
      : 1.0;
    if (this._boostLabelEl) this._boostLabelEl.textContent = `${parseFloat(this._cachedPlayerMult || 1).toFixed(1)}x`;

    this.spawnWave(1);
    this.updateLiveHud();

    this.lastTimestamp = 0;
    this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
  }

  setGlobalTouchLock(locked) {
    if (typeof document === 'undefined') return;
    const val = locked ? 'none' : '';
    if (document.documentElement) {
      document.documentElement.style.touchAction = val;
      document.documentElement.classList.toggle('bubble-touch-lock', !!locked);
    }
    if (document.body) {
      document.body.style.touchAction = val;
      document.body.classList.toggle('bubble-touch-lock', !!locked);
    }
  }

  stop() {
    this.isPlaying = false;
    this.setGlobalTouchLock(false);
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  buildWavePlatforms(waveNum) {
    // 5 rotating cyber energy shelf layouts (balls bounce off shelves; harpoons pierce cleanly)
    const layoutIdx = (waveNum - 1) % 5;
    if (layoutIdx === 0) return [];
    if (layoutIdx === 1) {
      // Center High Shelf
      return [{ x: 240, y: 210, w: 160, h: 10, color: '#00f0ff' }];
    }
    if (layoutIdx === 2) {
      // Twin Side Ledges
      return [
        { x: 64, y: 225, w: 130, h: 10, color: '#ff2a85' },
        { x: 446, y: 225, w: 130, h: 10, color: '#ff2a85' }
      ];
    }
    if (layoutIdx === 3) {
      // Staggered Steps
      return [
        { x: 105, y: 248, w: 135, h: 10, color: '#a855f7' },
        { x: 400, y: 185, w: 135, h: 10, color: '#00f0ff' }
      ];
    }
    // Twin Mid-Arena Shelves
    return [
      { x: 165, y: 195, w: 105, h: 10, color: '#ffd700' },
      { x: 370, y: 195, w: 105, h: 10, color: '#ffd700' }
    ];
  }

  spawnWave(waveNum) {
    this.waveBannerTimer = 2.0;
    this.platforms = this.buildWavePlatforms(waveNum);
    const speedMult = 1 + Math.min(0.65, (waveNum - 1) * 0.06);

    const configs = {
      1: [{ size: 5, x: 180, dir: 1 }],
      2: [{ size: 5, x: 160, dir: 1 }, { size: 4, x: 480, dir: -1 }],
      3: [{ size: 5, x: 150, dir: 1 }, { size: 5, x: 490, dir: -1 }],
      4: [{ size: 5, x: 140, dir: 1 }, { size: 4, x: 320, dir: 1 }, { size: 4, x: 500, dir: -1 }]
    };

    const list = configs[waveNum];
    if (list) {
      list.forEach((cfg) => this.createBall(cfg.size, cfg.x, this.ceilingY + 55, cfg.dir * speedMult));
    } else {
      const giantCount = Math.min(4, 2 + Math.floor((waveNum - 3) / 2));
      const extraMed = Math.min(3, waveNum - 3);
      for (let i = 0; i < giantCount; i++) {
        const bx = 95 + ((this.width - 190) * (i / Math.max(1, giantCount - 1)));
        this.createBall(5, bx, this.ceilingY + 55, (i % 2 === 0 ? 1 : -1) * speedMult);
      }
      for (let j = 0; j < extraMed; j++) {
        const bx = 130 + ((this.width - 260) * ((j + 0.5) / Math.max(1, extraMed)));
        this.createBall(j % 2 === 0 ? 4 : 3, bx, this.ceilingY + 85, (j % 2 === 0 ? -1 : 1) * speedMult);
      }
    }
  }

  createBall(size, x, y, dirMult = 1, vy = -120) {
    const spec = this.ballSpecs[size] || this.ballSpecs[1];
    const safeX = Math.max(spec.r + 12, Math.min(this.width - spec.r - 12, x));
    const safeY = Math.max(this.ceilingY + spec.r + 4, Math.min(this.floorY - spec.r - 4, y));
    this.balls.push({
      size,
      r: spec.r,
      x: safeX,
      y: safeY,
      vx: spec.vx * dirMult,
      vy,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() > 0.5 ? 1 : -1) * (1.2 + (6 - size) * 0.45),
      pulse: Math.random() * Math.PI * 2
    });
  }

  shootArrow() {
    const maxArrows = this.doubleArrowTimer > 0 ? 2 : 1;
    if (this.arrows.length >= maxArrows) return;

    const isFever = this.combo >= 8 && this.comboTimer > 0;
    const isSticky = this.stickyWireTimer > 0;
    this.arrows.push({
      originX: this.player.x,
      x: this.player.x,
      topY: this.player.y - 24,
      speed: isFever ? 550 : 460,
      waveAmp: isSticky ? 3.0 : 4.5,
      waveFreq: 0.14,
      phase: (this.elapsedSec || 0) * 6,
      sticky: isSticky,
      active: true
    });
    this.player.shootAnim = 0.16;
    this.playTone(isSticky ? 680 : 540, isSticky ? 320 : 220, 0.09, 'triangle', 0.08);
  }

  getArrowXAtY(arr, y) {
    const distFromFloor = Math.max(0, (this.floorY - 24) - y);
    const taper = Math.min(1, distFromFloor / 36);
    const x = arr.originX + Math.sin(distFromFloor * arr.waveFreq + arr.phase) * arr.waveAmp * taper;
    return Math.max(10, Math.min(this.width - 10, x));
  }

  playTone(freqStart, freqEnd, duration, type = 'sine', vol = 0.08) {
    // Respect global Arcade Host mute toggle (RetroSynth uses sfx.enabled === false)
    if (window.sfx && (window.sfx.enabled === false || window.sfx.muted)) return;
    try {
      const ctx = (window.sfx && window.sfx.ctx) ? window.sfx.ctx : this._audioCtx;
      let audioCtx = ctx;
      if (!audioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this._audioCtx = new AudioCtx();
        audioCtx = this._audioCtx;
      }
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch (_) {}
  }

  loop(timestamp) {
    if (!this.isPlaying) return;
    if (!this.lastTimestamp) this.lastTimestamp = timestamp;
    const rawDt = (timestamp - this.lastTimestamp) / 1000;
    this.lastTimestamp = timestamp;
    const dt = Math.min(0.033, Math.max(0.001, rawDt));

    if (!this.isPaused) {
      this.update(dt);
    }
    this.draw();

    if (this.isPlaying) {
      this.animFrameId = requestAnimationFrame((ts) => this.loop(ts));
    }
  }

  update(dt) {
    this.elapsedSec += dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 26);
    if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.5);
    if (this.waveBannerTimer > 0) this.waveBannerTimer = Math.max(0, this.waveBannerTimer - dt);
    if (this.freezeTimer > 0) this.freezeTimer = Math.max(0, this.freezeTimer - dt);
    if (this.invincibleTimer > 0) this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
    if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (this.player.shootAnim > 0) this.player.shootAnim = Math.max(0, this.player.shootAnim - dt);

    if (this.touchMoveTimer > 0) {
      this.touchMoveTimer = Math.max(0, this.touchMoveTimer - dt);
      if (this.touchMoveTimer === 0) this.touchActive = false;
    }

    // 1. Player Movement (Cyber Dash burst or Keyboard; touch swipe is applied 1:1 in pointermove)
    const isFever = this.combo >= 8 && this.comboTimer > 0;
    const halfW = this.player.w / 2;
    if (this.dashTimer > 0) {
      this.dashTimer = Math.max(0, this.dashTimer - dt);
      this.dashGhosts.push({ x: this.player.x, y: this.player.y, alpha: 0.55 });
      if (this.dashGhosts.length > 6) this.dashGhosts.shift();
      this.player.x += this.dashDir * 820 * dt;
      this.player.walkPhase += dt * 32;
    } else {
      let moveDir = 0;
      if (this.keys.a || this.keys.ArrowLeft) moveDir -= 1;
      if (this.keys.d || this.keys.ArrowRight) moveDir += 1;

      if (moveDir !== 0) {
        const moveSpeed = isFever ? this.player.speed * 1.18 : this.player.speed;
        this.player.x += moveDir * moveSpeed * dt;
        this.player.facing = moveDir;
        this.player.walkPhase += dt * 15;
      }
    }
    this.player.x = Math.max(halfW + 10, Math.min(this.width - halfW - 10, this.player.x));

    // Decay dash afterimages
    let ghostWrite = 0;
    for (let i = 0; i < this.dashGhosts.length; i++) {
      const g = this.dashGhosts[i];
      g.alpha -= dt * 3.2;
      if (g.alpha > 0) this.dashGhosts[ghostWrite++] = g;
    }
    this.dashGhosts.length = ghostWrite;

    // 2. Escalating Ceiling Portal Drops (keeps pressure climbing after ~40s)
    if (this.elapsedSec > 40) {
      this.portalSpawnTimer -= dt;
      if (this.portalSpawnTimer <= 0) {
        const interval = Math.max(7.5, 21 - Math.floor(this.elapsedSec / 10));
        this.portalSpawnTimer = interval;
        const dropSize = this.elapsedSec > 115 ? 5 : (this.elapsedSec > 75 ? 4 : 3);
        const dropX = 70 + Math.random() * (this.width - 140);
        this.portals.push({ x: dropX, y: this.ceilingY + 12, timer: 1.35, maxTimer: 1.35, size: dropSize, spawned: false });
      }
    }

    for (let i = this.portals.length - 1; i >= 0; i--) {
      const pt = this.portals[i];
      pt.timer -= dt;
      if (!pt.spawned && pt.timer <= 0.45) {
        pt.spawned = true;
        const dirMult = (Math.random() > 0.5 ? 1 : -1) * (1 + Math.min(0.65, (this.wave - 1) * 0.06));
        this.createBall(pt.size, pt.x, pt.y + 34, dirMult, 40);
        this.playTone(260, 480, 0.14, 'sine', 0.07);
      }
      if (pt.timer <= 0) this.portals.splice(i, 1);
    }

    // 3. Arrows Update & Ball Collision
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const arr = this.arrows[i];
      if (arr.stickTimer !== undefined) {
        arr.stickTimer -= dt;
        if (arr.stickTimer <= 0) {
          this.arrows.splice(i, 1);
          continue;
        }
      } else {
        arr.topY -= arr.speed * dt;
        if (arr.topY <= this.ceilingY) {
          arr.topY = this.ceilingY;
          arr.stickTimer = arr.sticky ? 3.0 : 0.5;
        }
      }
      arr.x = this.getArrowXAtY(arr, arr.topY);

      // Check collision with any ball along the wavy vertical harpoon segment (arr.topY .. floorY)
      let hitIndex = -1;
      for (let b = 0; b < this.balls.length; b++) {
        const ball = this.balls[b];
        const closestY = Math.max(arr.topY, Math.min(this.floorY, ball.y));
        const waveX = this.getArrowXAtY(arr, closestY);
        const dx = ball.x - waveX;
        const dy = ball.y - closestY;
        if (dx * dx + dy * dy <= (ball.r + 3) * (ball.r + 3)) {
          hitIndex = b;
          break;
        }
      }

      if (hitIndex !== -1) {
        this.arrows.splice(i, 1);
        this.popBall(hitIndex);
      }
    }

    // 4. Balls Physics, Platform Bounces & Player Collision
    // Start 30% slower on Wave 1 (0.70x pace) and ramp smoothly to full 1.0x pace by Wave 5
    const wavePace = Math.min(1.0, 0.70 + Math.max(0, this.wave - 1) * 0.075);
    const timeScale = this.freezeTimer > 0 ? 0.35 : wavePace;
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      const spec = this.ballSpecs[ball.size];
      const prevY = ball.y;
      ball.vy += this.gravity * timeScale * dt;
      ball.x += ball.vx * timeScale * dt;
      ball.y += ball.vy * timeScale * dt;
      ball.rot += ball.rotSpeed * timeScale * dt;
      ball.pulse += dt * 4;

      // Wall bounce
      if (ball.x - ball.r < 10) {
        ball.x = 10 + ball.r;
        ball.vx = Math.abs(ball.vx);
      } else if (ball.x + ball.r > this.width - 10) {
        ball.x = this.width - 10 - ball.r;
        ball.vx = -Math.abs(ball.vx);
      }

      // Ceiling clamp
      if (ball.y - ball.r < this.ceilingY) {
        ball.y = this.ceilingY + ball.r;
        ball.vy = Math.abs(ball.vy) * 0.6;
      }

      // Floor bounce (consistent fair bounce height per size)
      if (ball.y + ball.r >= this.floorY) {
        ball.y = this.floorY - ball.r;
        ball.vy = -spec.bounceVy;
      }

      // Arena energy platform bounces (balls rebound cleanly off top/bottom/sides)
      for (let pIdx = 0; pIdx < this.platforms.length; pIdx++) {
        const pf = this.platforms[pIdx];
        const nearX = Math.max(pf.x, Math.min(pf.x + pf.w, ball.x));
        const nearY = Math.max(pf.y, Math.min(pf.y + pf.h, ball.y));
        const dx = ball.x - nearX;
        const dy = ball.y - nearY;
        if (dx * dx + dy * dy < ball.r * ball.r) {
          if (prevY <= pf.y && ball.vy > 0) {
            ball.y = pf.y - ball.r;
            ball.vy = -Math.max(240, spec.bounceVy * 0.78);
          } else if (prevY >= pf.y + pf.h && ball.vy < 0) {
            ball.y = pf.y + pf.h + ball.r;
            ball.vy = Math.abs(ball.vy) * 0.75;
          } else if (ball.x < pf.x) {
            ball.x = pf.x - ball.r;
            ball.vx = -Math.abs(ball.vx);
          } else {
            ball.x = pf.x + pf.w + ball.r;
            ball.vx = Math.abs(ball.vx);
          }
        }
      }

      // Player collision (forgiving core torso hitbox so visual grazes don't count as hits)
      if (this.invincibleTimer <= 0) {
        const px1 = this.player.x - 6;
        const px2 = this.player.x + 6;
        const py1 = this.player.y - 29;
        const py2 = this.player.y - 5;
        const cx = Math.max(px1, Math.min(px2, ball.x));
        const cy = Math.max(py1, Math.min(py2, ball.y));
        const dx = ball.x - cx;
        const dy = ball.y - cy;
        const hitR = Math.max(4, ball.r * 0.84 - 2);
        if (dx * dx + dy * dy <= hitR * hitR) {
          this.handlePlayerHit();
          break;
        }
      }
    }

    // 5. Power-ups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      if (!p.landed) {
        p.vy += 320 * dt;
        p.y += p.vy * dt;
        if (p.y >= this.floorY - 12) {
          p.y = this.floorY - 12;
          p.landed = true;
        }
      }
      p.life -= dt;
      if (p.life <= 0) {
        this.powerups.splice(i, 1);
        continue;
      }
      if (Math.abs(p.x - this.player.x) < 24 && Math.abs(p.y - (this.player.y - 18)) < 26) {
        this.collectPowerup(p);
        this.powerups.splice(i, 1);
      }
    }

    // 6. Particles & Floating Text (O(N) in-place compaction)
    let pWrite = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += (pt.gravity || 0) * dt;
      pt.life -= dt;
      if (pt.life > 0) this.particles[pWrite++] = pt;
    }
    this.particles.length = pWrite;

    let ftWrite = 0;
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const ft = this.floatingTexts[i];
      ft.y -= 36 * dt;
      ft.life -= dt;
      if (ft.life > 0) this.floatingTexts[ftWrite++] = ft;
    }
    this.floatingTexts.length = ftWrite;

    // 7. Wave Clear Progression
    if (this.balls.length === 0 && this.portals.length === 0) {
      this.wave += 1;
      const waveBonus = this.wave * 100;
      this.score += waveBonus;
      this.floatingTexts.push({ x: this.width / 2, y: this.height / 2 - 20, text: `WAVE ${this.wave}! +${waveBonus}`, color: '#00ff88', life: 1.4, maxLife: 1.4 });
      this.playTone(440, 880, 0.22, 'triangle', 0.09);
      this.spawnWave(this.wave);
      this.updateLiveHud();
    }
  }

  popBall(index, fromEmp = false) {
    const ball = this.balls[index];
    if (!ball) return;
    const spec = this.ballSpecs[ball.size];
    this.balls.splice(index, 1);

    this.ballsPopped += 1;
    this.combo += 1;
    this.comboTimer = 1.8;

    const comboMult = Math.min(4, 1 + Math.floor((this.combo - 1) / 3) * 0.5);
    const pts = Math.round(spec.pts * comboMult);
    this.score += pts;

    // Season 2 Quantum Relic Drop Check (1 per session)
    if ((this.sessionRelicsDroppedCount || 0) < 1) {
      const relicMult = (typeof window.getRelicSpawnMultiplier === 'function') ? window.getRelicSpawnMultiplier() : 1.0;
      if (Math.random() < 0.004 * relicMult) {
        this.sessionRelicsDroppedCount = 1;
        if (typeof window.triggerRelicCelebration === 'function') {
          window.triggerRelicCelebration({
            id: 'relic_bubble_orb',
            name: 'Bubble Orb',
            rarity: 'rare',
            season: 2,
            gameName: 'Cyber Bubble',
            image: 'metadata/images/relics/relic_bubble_orb.jpg',
            sessionId: this.sessionId
          });
        }
      }
    }

    // Pop audio pitched higher for smaller balls & rising combo streaks
    if (!fromEmp) {
      const baseFreq = (210 + (6 - ball.size) * 75) * Math.pow(1.05, Math.min(10, this.combo - 1));
      this.playTone(baseFreq, Math.min(1800, baseFreq * 1.65), 0.10, 'sine', 0.095);
    }
    this.screenShake = Math.max(this.screenShake, ball.size * 1.4);

    // Burst particles + shockwave ring (capped cleanly at 80 total particles)
    if (this.particles.length < 80) {
      this.particles.push({ kind: 'ring', x: ball.x, y: ball.y, vx: 0, vy: 0, r: ball.r * 0.6, maxR: ball.r * 2.1, color: spec.c2, life: 0.28, maxLife: 0.28 });
    }
    const maxCanAdd = Math.max(0, 80 - this.particles.length);
    const count = Math.min(fromEmp ? 6 : (8 + ball.size * 2), maxCanAdd);
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / Math.max(1, count) + Math.random() * 0.4;
      const spd = 60 + Math.random() * 190;
      this.particles.push({
        x: ball.x,
        y: ball.y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 40,
        gravity: 260,
        r: 2 + Math.random() * 2.5,
        color: i % 2 === 0 ? spec.c1 : spec.c2,
        life: 0.42 + Math.random() * 0.22,
        maxLife: 0.65
      });
    }

    const label = comboMult > 1 ? `+${pts} (${comboMult}x)` : `+${pts}`;
    this.floatingTexts.push({ x: ball.x, y: ball.y - 8, text: label, color: spec.c1, life: 0.85, maxLife: 0.85 });

    // Split into 2 smaller balls if size > 1
    if (ball.size > 1) {
      const nextSize = ball.size - 1;
      const nextSpec = this.ballSpecs[nextSize];
      const speedMult = 1 + Math.min(0.65, (this.wave - 1) * 0.06);
      const splitVy = -Math.min(340, nextSpec.bounceVy * 0.68);
      this.balls.push({
        size: nextSize,
        r: nextSpec.r,
        x: Math.max(nextSpec.r + 12, ball.x - nextSpec.r * 0.55),
        y: ball.y,
        vx: -nextSpec.vx * speedMult,
        vy: splitVy,
        rot: 0,
        rotSpeed: -2.2,
        pulse: 0
      });
      this.balls.push({
        size: nextSize,
        r: nextSpec.r,
        x: Math.min(this.width - nextSpec.r - 12, ball.x + nextSpec.r * 0.55),
        y: ball.y,
        vx: nextSpec.vx * speedMult,
        vy: splitVy,
        rot: 0,
        rotSpeed: 2.2,
        pulse: Math.PI
      });
    }

    // Power-up drop roll (~14% chance, skip during EMP mass-split to prevent spam)
    if (!fromEmp && Math.random() < 0.14) {
      const roll = Math.random();
      let type = 'double';
      if (this.lives < 3 && this.wave >= 3 && roll < 0.08) {
        type = 'life';
      } else if (roll < 0.28) {
        type = 'double';
      } else if (roll < 0.46) {
        type = 'sticky';
      } else if (roll < 0.64) {
        type = 'shield';
      } else if (roll < 0.78) {
        type = 'freeze';
      } else if (roll < 0.88) {
        type = 'emp';
      } else {
        type = 'coin';
      }
      this.powerups.push({ x: ball.x, y: ball.y, vy: -80, type, landed: false, life: 8.5 });
    }

    this.updateLiveHud();
  }

  triggerEmpBlast() {
    this.playTone(900, 110, 0.32, 'sawtooth', 0.11);
    this.screenShake = 11;
    this.flashColor = '0, 240, 255';
    this.flashAlpha = 0.38;
    // Snapshot current balls: clear all Size-1 balls immediately, split up to 4 larger balls down 1 tier
    const snapshot = this.balls.slice();
    let splitsDone = 0;
    for (let i = 0; i < snapshot.length; i++) {
      const target = snapshot[i];
      const idx = this.balls.indexOf(target);
      if (idx === -1) continue;
      if (target.size === 1) {
        this.popBall(idx, true);
      } else if (splitsDone < 4) {
        this.popBall(idx, true);
        splitsDone++;
      }
    }
  }

  collectPowerup(p) {
    this.playTone(520, 960, 0.15, 'triangle', 0.1);
    if (p.type === 'double') {
      this.doubleArrowTimer = 1;
      this.floatingTexts.push({ x: p.x, y: p.y - 16, text: '⚡ DOUBLE HARPOON!', color: '#00f0ff', life: 1.1, maxLife: 1.1 });
    } else if (p.type === 'sticky') {
      this.stickyWireTimer = 1;
      this.floatingTexts.push({ x: p.x, y: p.y - 16, text: '🪝 STICKY WIRE!', color: '#ffd700', life: 1.1, maxLife: 1.1 });
    } else if (p.type === 'emp') {
      this.floatingTexts.push({ x: p.x, y: p.y - 16, text: '💣 CYBER EMP BLAST!', color: '#00f0ff', life: 1.2, maxLife: 1.2 });
      this.triggerEmpBlast();
    } else if (p.type === 'life') {
      this.lives = Math.min(3, this.lives + 1);
      this.floatingTexts.push({ x: p.x, y: p.y - 16, text: '❤️ +1 EXTRA LIFE!', color: '#ff4d88', life: 1.2, maxLife: 1.2 });
      this.updateLiveHud();
    } else if (p.type === 'shield') {
      this.hasShield = true;
      this.floatingTexts.push({ x: p.x, y: p.y - 16, text: '🛡️ SHIELD UP!', color: '#00ff88', life: 1.1, maxLife: 1.1 });
    } else if (p.type === 'freeze') {
      this.freezeTimer = 4.5;
      this.floatingTexts.push({ x: p.x, y: p.y - 16, text: '❄️ TIME SLOW!', color: '#99e6ff', life: 1.1, maxLife: 1.1 });
    } else if (p.type === 'coin') {
      this.bonusTokensCollected = Math.min(20, this.bonusTokensCollected + 1);
      this.score += 200;
      this.floatingTexts.push({ x: p.x, y: p.y - 16, text: '🪙 +1.25 PGT COIN!', color: '#ffd700', life: 1.2, maxLife: 1.2 });
      this.updateLiveHud();
    }
  }

  handlePlayerHit() {
    this.playTone(180, 55, 0.25, 'sawtooth', 0.12);
    this.screenShake = 10;
    this.flashColor = '255, 42, 133';
    this.flashAlpha = 0.45;

    if (this.hasShield) {
      this.hasShield = false;
      this.invincibleTimer = 2.0;
      this.floatingTexts.push({ x: this.player.x, y: this.player.y - 46, text: '🛡️ SHIELD SAVED!', color: '#00ff88', life: 1.1, maxLife: 1.1 });
      // Knock nearby balls upward
      this.balls.forEach((b) => {
        if (Math.hypot(b.x - this.player.x, b.y - this.player.y) < 120) {
          b.vy = -420;
        }
      });
      return;
    }

    this.lives -= 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.doubleArrowTimer = 0;
    this.stickyWireTimer = 0;
    this.updateLiveHud();

    if (this.lives <= 0) {
      this.gameOver();
    } else {
      this.invincibleTimer = 2.2;
      // Push balls away from player so they don't instantly get trapped
      this.balls.forEach((b) => {
        if (Math.hypot(b.x - this.player.x, b.y - this.player.y) < 130) {
          b.vy = -450;
          b.vx = (b.x >= this.player.x ? 1 : -1) * Math.abs(b.vx);
        }
      });
    }
  }

  updateLiveHud() {
    if (!this._scoreEl) this._scoreEl = document.getElementById('bubble-live-score');
    if (!this._waveEl) this._waveEl = document.getElementById('bubble-live-wave');
    if (!this._livesEl) this._livesEl = document.getElementById('bubble-live-lives');
    if (!this._earnedEl) this._earnedEl = document.getElementById('bubble-live-earned');

    const scoreStr = Math.floor(this.score).toLocaleString();
    if (this._scoreEl && this._lastScoreStr !== scoreStr) {
      this._lastScoreStr = scoreStr;
      this._scoreEl.textContent = scoreStr;
    }

    const waveStr = String(this.wave);
    if (this._waveEl && this._lastWaveStr !== waveStr) {
      this._lastWaveStr = waveStr;
      this._waveEl.textContent = waveStr;
    }

    const livesStr = String(Math.max(0, this.lives));
    if (this._livesEl && this._lastLivesStr !== livesStr) {
      this._lastLivesStr = livesStr;
      this._livesEl.textContent = livesStr;
    }

    if (this._earnedEl) {
      const playerMult = this._cachedPlayerMult || 1.0;
      const globalEarnMult = this._cachedGlobalEarnMult !== undefined ? this._cachedGlobalEarnMult : 1.0;
      const estBase = Math.min(18.75, (((this.score / 2400.0) + ((this.ballsPopped || 0) * 0.04)) * 0.50) * globalEarnMult);
      const estToken = Math.min((this.bonusTokensCollected || 0) * 1.25, 25.0);
      const estTotal = this.score > 0 ? Math.min(1500.0, (estBase * playerMult) + estToken) : 0;
      const earnedStr = estTotal.toFixed(2);
      if (this._lastEarnedStr !== earnedStr) {
        this._lastEarnedStr = earnedStr;
        this._earnedEl.textContent = earnedStr;
      }
    }
  }

  async gameOver() {
    if (!this.isPlaying) return;
    if (window.trackQuestProgress) window.trackQuestProgress('games', 1);
    this.stop();

    const multis = window.appState ? window.appState.getMultipliers() : { nftGameMultiplier: 0 };
    const nftMult = 1 + ((multis.nftGameMultiplier || 0) / 100);
    const isVip = window.appState && window.appState.isVipActive();
    const vipLevel = (window.appState && typeof window.appState.getVipLevel === 'function') ? window.appState.getVipLevel() : (isVip ? 2 : 0);
    const vipMult = isVip ? (vipLevel >= 2 ? 2.0 : 1.5) : 1.0;
    const isAmb = !!(window.appState && window.appState.state && window.appState.state.isAmbassador);
    const ambMult = isAmb ? 2.0 : 1.0;
    const relicMult = (multis && multis.isApexUnlocked) ? 1.5 : 1.0;
    const playerMult = nftMult * vipMult * ambMult * relicMult;
    const vipBadgeStr = (isVip ? (vipLevel >= 2 ? ' 🔥 <span style="color:var(--color-warning); font-size:0.8rem;">(Gold VIP 2.0x)</span>' : ' 🥈 <span style="color:#c0c0c0; font-size:0.8rem;">(Silver VIP 1.5x)</span>') : '') +
      (isAmb ? ' 🎖️ <span style="color:var(--color-warning); font-size:0.8rem;">(Ambassador 2.0x)</span>' : '') +
      (multis && multis.isApexUnlocked ? ' 🏺 <span style="color:#ffd700; font-size:0.8rem;">(Relics 1.5x)</span>' : '');

    const cleanScore = Math.floor(this.score || 0);
    const globalEarnMult = (window.appState && window.appState.state && window.appState.state.globalEarnMultiplier !== undefined)
      ? Number(window.appState.state.globalEarnMultiplier) : 1.0;
    const rawBase = Math.min(18.75, (((cleanScore / 2400.0) + ((this.ballsPopped || 0) * 0.04)) * 0.50) * globalEarnMult);
    const tokenPgt = Math.min((this.bonusTokensCollected || 0) * 1.25, 25.0);
    let finalPgt = cleanScore > 0 ? Math.min(1500.0, parseFloat(((rawBase * playerMult) + tokenPgt).toFixed(2))) : 0;

    const currentHigh = (window.appState && window.appState.state) ? (window.appState.state.bubbleHighScore || 0) : 0;
    const isNewHigh = cleanScore > currentHigh;
    if (isNewHigh && window.appState) {
      window.appState.update({ bubbleHighScore: cleanScore });
    }
    if (window.submitHighScoreToDB && cleanScore > 0) {
      try {
        await window.submitHighScoreToDB('bubble', cleanScore);
      } catch (e) {
        console.warn('Bubble high score submit error:', e);
      }
    }

    const isPlayerConnected = window.appState && typeof window.appState.isPlayerConnected === 'function' ? window.appState.isPlayerConnected() : false;
    let verifiedPgt = this.sessionId ? finalPgt : (isPlayerConnected ? 0.0 : finalPgt);
    let isDailyLimitReached = false;
    let isHarvestDisabled = false;

    if (window.endArcadeSession && this.sessionId) {
      const res = await window.endArcadeSession(this.sessionId, cleanScore, this.ballsPopped || 0, Math.min(this.bonusTokensCollected || 0, 20), nftMult);
      if (res && (res.payout !== undefined || res.payout_pgt !== undefined || res.success)) {
        verifiedPgt = parseFloat(res.payout !== undefined ? res.payout : (res.payout_pgt !== undefined ? res.payout_pgt : 0));
        if (res.harvest_enabled === false) isHarvestDisabled = true;
        if (res.daily_limit_reached) isDailyLimitReached = true;
      } else if (res && (res.daily_limit_reached || (res.error && res.error.includes('limit')))) {
        verifiedPgt = 0.0;
        isDailyLimitReached = true;
      }
    }

    const liveEarnedEl = this._earnedEl || document.getElementById('bubble-live-earned');
    if (liveEarnedEl) liveEarnedEl.textContent = verifiedPgt.toFixed(2);
    if (typeof window.loadBubbleLeaderboard === 'function') {
      window.loadBubbleLeaderboard(true);
    }
    if (typeof window.sendDiscordEarnAnnouncement === 'function' && verifiedPgt > 0 && isPlayerConnected) {
      window.sendDiscordEarnAnnouncement('Cyber Bubble', cleanScore, verifiedPgt);
    }

    if (this.overlay) {
      const mins = Math.floor(this.elapsedSec / 60);
      const secs = Math.floor(this.elapsedSec % 60);
      const timeStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      const gamePgt = Math.max(0, verifiedPgt - tokenPgt);
      let payoutDisplay = `+${verifiedPgt.toFixed(2)} PGT`;
      if (isHarvestDisabled) {
        payoutDisplay = `+0.00 PGT <span style="display:block; color:var(--color-danger); font-size:0.75rem; margin-top:2px;">🚫 In-Game Harvest Paused by Admin</span>`;
      } else if (isDailyLimitReached) {
        payoutDisplay = `+0.00 PGT <span style="display:block; color:var(--color-warning); font-size:0.75rem; margin-top:2px;">⚠️ Daily Limit Reached • Rewards Paused</span>`;
      } else if (isPlayerConnected && !this.sessionId && cleanScore > 0) {
        payoutDisplay = `+0.00 PGT <span style="display:block; color:var(--color-warning); font-size:0.75rem; margin-top:2px;">⚠️ Session Not Verified • Rewards Paused</span>`;
      } else if (!isPlayerConnected) {
        payoutDisplay = `Demo (+${verifiedPgt.toFixed(2)} PGT unsaved)`;
      } else if (tokenPgt > 0 && verifiedPgt > 0) {
        payoutDisplay = `+${gamePgt.toFixed(2)} PGT <span style="color:var(--color-warning); font-size:0.9em; font-weight:700;">+ ${tokenPgt.toFixed(2)} PGT Bonus</span>`;
      }
      const guestBannerHtml = (!isPlayerConnected && window.getGuestBannerCtaHtml)
        ? window.getGuestBannerCtaHtml(verifiedPgt)
        : '';

      this.overlay.innerHTML = `
        <div style="background: rgba(8, 12, 26, 0.94); border: 2px solid #ff2a85; border-radius: 12px; padding: 1.15rem; text-align: center; max-width: 440px; width: 92%; box-shadow: 0 0 28px rgba(255, 42, 133, 0.35);">
          <div class="game-title" style="color: #ff2a85; font-size: 1.4rem; margin-bottom: 0.35rem;">🫧 Run Complete!</div>
          ${isNewHigh ? '<div style="color: #ffd700; font-weight: 800; font-size: 0.85rem; margin-bottom: 0.35rem;">🏆 NEW PERSONAL BEST!</div>' : ''}
          <div style="font-size: 1rem; color: #e2e8f0; margin-bottom: 0.25rem;">Score: <strong style="color: #00f0ff;">${cleanScore.toLocaleString()}</strong> | Popped: <strong style="color: var(--color-accent);">${this.ballsPopped}</strong> • ${timeStr}</div>
          <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.45rem; line-height: 1.4;">Base: ${rawBase.toFixed(2)} PGT • Multiplier: <strong style="color: var(--color-secondary);">${playerMult.toFixed(1)}x</strong> (${multis.nftGameMultiplier || 0}% NFT${vipBadgeStr})</div>
          <div style="font-size: 1.1rem; font-weight: 800; color: var(--color-success); display: inline-flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px; margin-bottom: 0.75rem;">
            <span>Final Payout: ${payoutDisplay}</span>
            <span style="display: inline-flex; align-items: center; gap: 4px; margin-left: 4px;">
              <button type="button" onclick="if(window.shareCurrentGameScore)window.shareCurrentGameScore('Cyber Bubble', ${cleanScore}, ${verifiedPgt})" title="Share score on 𝕏" style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.3); border-radius: 6px; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; padding: 0;">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </button>
              <button type="button" onclick="if(window.shareCurrentGameScoreTg)window.shareCurrentGameScoreTg('Cyber Bubble', ${cleanScore}, ${verifiedPgt})" title="Share score on Telegram" style="background: rgba(0,136,204,0.18); border: 1px solid rgba(0,136,204,0.45); border-radius: 6px; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: #00b0ff; padding: 0; font-size: 0.75rem;">
                ✈️
              </button>
            </span>
          </div>
          ${guestBannerHtml}
          <button class="btn-play-game" id="btn-restart-bubble" disabled style="width:100%; opacity:0.6;">Play Again</button>
        </div>
      `;
      this.overlay.style.display = 'flex';
      const btn = document.getElementById('btn-restart-bubble');
      if (btn) {
        setTimeout(() => {
          btn.disabled = false;
          btn.style.opacity = '1';
        }, 900);
        btn.onclick = () => {
          if (btn.disabled) return;
          this.startGame();
        };
      }
    }
  }

  // --- Rendering (Offscreen cached backdrop & sprites, zero runtime shadowBlur) ---
  draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowBlur = 0;
    if (this.screenShake > 0.2) {
      ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
    }

    this.drawBackground(ctx);
    this.drawPlatforms(ctx);
    this.drawPortals(ctx);
    this.drawArrows(ctx);
    this.drawPowerups(ctx);
    this.drawBalls(ctx);
    this.drawPlayer(ctx);
    this.drawParticles(ctx);
    this.drawFloatingTexts(ctx);
    this.drawTopOverlayHud(ctx);

    if (this.flashAlpha > 0) {
      ctx.fillStyle = `rgba(${this.flashColor || '255, 42, 133'}, ${this.flashAlpha})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
    ctx.restore();
  }

  drawBackground(ctx) {
    if (this._bgCanvas) {
      ctx.drawImage(this._bgCanvas, 0, 0);
    } else {
      ctx.fillStyle = '#070618';
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // Batched twinkling stars (fast fillRect, zero arc overhead)
    ctx.fillStyle = '#dcefff';
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      ctx.globalAlpha = 0.35 + 0.55 * Math.sin(this.elapsedSec * s.speed + s.twinkle);
      ctx.fillRect(s.x, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1.0;

    // Freeze tint if active
    if (this.freezeTimer > 0) {
      ctx.fillStyle = 'rgba(110, 225, 255, 0.08)';
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  drawPlatforms(ctx) {
    if (!this.platforms || this.platforms.length === 0) return;
    ctx.save();
    for (let i = 0; i < this.platforms.length; i++) {
      const pf = this.platforms[i];
      // Outer soft glow halo
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = pf.color;
      ctx.fillRect(pf.x - 3, pf.y - 3, pf.w + 6, pf.h + 6);
      ctx.globalAlpha = 1.0;

      // Energy lattice body (balls bounce, harpoons pierce)
      ctx.fillStyle = 'rgba(12, 18, 42, 0.88)';
      ctx.fillRect(pf.x, pf.y, pf.w, pf.h);
      ctx.strokeStyle = pf.color;
      ctx.lineWidth = 1.8;
      ctx.strokeRect(pf.x, pf.y, pf.w, pf.h);

      // Center energy rail line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pf.x + 6, pf.y + pf.h / 2);
      ctx.lineTo(pf.x + pf.w - 6, pf.y + pf.h / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawPortals(ctx) {
    if (this.portals.length === 0) return;
    ctx.save();
    for (let i = 0; i < this.portals.length; i++) {
      const pt = this.portals[i];
      const pulse = 10 + Math.sin(this.elapsedSec * 16) * 4;

      // Vertical drop warning guide beam while charging
      if (!pt.spawned) {
        const warnAlpha = 0.16 + 0.14 * Math.sin(this.elapsedSec * 22);
        ctx.strokeStyle = `rgba(255, 42, 133, ${warnAlpha})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y + 8);
        ctx.lineTo(pt.x, this.floorY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Layered alpha portal bloom (zero per-frame radial gradient allocation)
      ctx.fillStyle = 'rgba(255, 42, 133, 0.25)';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pulse * 2.0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ff2a85';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pulse * 0.9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pulse * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawArrows(ctx) {
    for (let i = 0; i < this.arrows.length; i++) {
      const arr = this.arrows[i];
      const tipX = this.getArrowXAtY(arr, arr.topY);
      const startY = this.floorY;
      const endY = arr.topY + 10;
      const steps = Math.max(6, Math.ceil((startY - endY) / 10));
      const isSticky = !!arr.sticky;
      const outerGlow = isSticky ? 'rgba(255, 215, 0, 0.28)' : 'rgba(0, 240, 255, 0.26)';
      const mainColor = isSticky ? '#ffd700' : '#00f0ff';

      ctx.save();
      // Build wavy path once and stroke glow + core (zero shadowBlur)
      ctx.beginPath();
      ctx.moveTo(this.getArrowXAtY(arr, startY), startY);
      for (let s = 1; s <= steps; s++) {
        const y = startY - ((startY - endY) * s) / steps;
        ctx.lineTo(this.getArrowXAtY(arr, y), y);
      }

      ctx.strokeStyle = outerGlow;
      ctx.lineWidth = 7;
      ctx.stroke();

      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 2.6;
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Sharp harpoon arrowhead angled with wave tangent
      const nextX = this.getArrowXAtY(arr, arr.topY + 12);
      const angle = Math.atan2(tipX - nextX, 12);
      ctx.translate(tipX, arr.topY);
      ctx.rotate(angle);
      ctx.fillStyle = isSticky ? '#ffd700' : '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-6, 12);
      ctx.lineTo(6, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  drawBalls(ctx) {
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      // Floor shadow under ball for depth perception
      const heightRatio = 1 - Math.min(1, (this.floorY - ball.y) / 320);
      const shadowW = ball.r * (0.45 + 0.55 * heightRatio);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.18 + 0.35 * heightRatio})`;
      ctx.beginPath();
      ctx.ellipse(ball.x, this.floorY + 3, shadowW, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Blit pre-rendered 3D shaded neon sphere sprite
      const sprite = this._ballSprites[ball.size];
      if (sprite) {
        ctx.drawImage(sprite.canvas, ball.x - sprite.half, ball.y - sprite.half);
      }

      // Rotating internal plasma ring
      ctx.save();
      ctx.translate(ball.x, ball.y);
      ctx.rotate(ball.rot);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, ball.r * 0.72, ball.r * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawPlayer(ctx) {
    // Draw dash afterimage silhouettes
    if (this.dashGhosts.length > 0) {
      ctx.save();
      for (let i = 0; i < this.dashGhosts.length; i++) {
        const g = this.dashGhosts[i];
        ctx.globalAlpha = Math.max(0, g.alpha * 0.45);
        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.roundRect(g.x - 10, g.y - 38, 20, 34, 6);
        ctx.fill();
      }
      ctx.restore();
    }

    if (this.invincibleTimer > 0 && this.dashTimer <= 0 && Math.floor(this.elapsedSec * 14) % 2 === 0) {
      return;
    }
    const px = this.player.x;
    const py = this.player.y;
    const moving = (this.keys.a || this.keys.ArrowLeft || this.keys.d || this.keys.ArrowRight || this.touchActive || this.dashTimer > 0);
    const stride = moving ? Math.sin(this.player.walkPhase) * 5.5 : 0;
    const bob = moving ? Math.abs(Math.cos(this.player.walkPhase)) * 1.8 : Math.sin((this.elapsedSec || 0) * 3.5) * 0.8;
    const recoil = this.player.shootAnim > 0 ? (this.player.shootAnim / 0.16) * 3 : 0;
    const dir = this.player.facing || 1;
    const isFever = this.combo >= 8 && this.comboTimer > 0;

    ctx.save();

    // Ground contact shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(px, py + 1, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fever aura if 8+ combo
    if (isFever) {
      ctx.fillStyle = 'rgba(255, 215, 0, 0.16)';
      ctx.beginPath();
      ctx.arc(px, py - 21, 25 + Math.sin(this.elapsedSec * 12) * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shield bubble aura (layered alpha, zero shadowBlur)
    if (this.hasShield) {
      const pulse = 27 + Math.sin((this.elapsedSec || 0) * 6) * 1.5;
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(px, py - 21, pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#00ff88';
      ctx.fillStyle = 'rgba(0, 255, 136, 0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py - 21, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Back-pack / Neon thruster pack
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(px - dir * 11 - 3, py - 29 - bob, 6, 13, 2);
    ctx.fill();
    ctx.stroke();

    // Articulated legs & cyber boots
    const leftFootX = px - 5 - stride;
    const rightFootX = px + 5 + stride;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px - 4, py - 14 - bob);
    ctx.lineTo(leftFootX, py - 3);
    ctx.moveTo(px + 4, py - 14 - bob);
    ctx.lineTo(rightFootX, py - 3);
    ctx.stroke();

    // Neon boot soles
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(leftFootX - 4, py - 4, 8, 4.5, 2);
    ctx.roundRect(rightFootX - 4, py - 4, 8, 4.5, 2);
    ctx.fill();
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(leftFootX - 3, py - 1, 6, 1.5);
    ctx.fillRect(rightFootX - 3, py - 1, 6, 1.5);

    // Cyber jacket / armored torso
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect(px - 10, py - 30 - bob, 20, 17, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Chest armor plate + glowing reactor core
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.roundRect(px - 6, py - 27 - bob, 12, 10, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 42, 133, 0.35)';
    ctx.beginPath();
    ctx.arc(px, py - 22 - bob, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff2a85';
    ctx.beginPath();
    ctx.arc(px, py - 22 - bob, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Shoulder pads
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(px - 9.5, py - 27 - bob, 3.5, 0, Math.PI * 2);
    ctx.arc(px + 9.5, py - 27 - bob, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Twin-prong Neon Harpoon Launcher held upward
    const gunY = py - 38 - bob + recoil;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px + dir * 7, py - 23 - bob);
    ctx.lineTo(px + dir * 3, py - 31 - bob);
    ctx.lineTo(px, gunY + 4);
    ctx.stroke();

    // Launcher barrel & glowing emitter tip
    ctx.fillStyle = this.player.shootAnim > 0 ? '#ffd700' : '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(px - 3, gunY - 4, 6, 10, 2);
    ctx.fill();
    ctx.fillStyle = this.player.shootAnim > 0 ? 'rgba(255, 215, 0, 0.35)' : 'rgba(0, 240, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(px, gunY - 5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.player.shootAnim > 0 ? '#ffffff' : '#00f0ff';
    ctx.beginPath();
    ctx.arc(px, gunY - 5, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Expressive Cyber Helmet & Visor
    const headY = py - 38 - bob;
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(px, headY, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(px - 2.5, headY - 3, 4, 0, Math.PI * 2);
    ctx.fill();

    // Helmet fin / neon crest
    ctx.fillStyle = '#ff2a85';
    ctx.beginPath();
    ctx.moveTo(px - 2, headY - 9);
    ctx.lineTo(px + 1, headY - 14);
    ctx.lineTo(px + 3, headY - 8.5);
    ctx.closePath();
    ctx.fill();

    // Dark wraparound visor + glowing cyber eyes
    ctx.fillStyle = '#090d1a';
    ctx.beginPath();
    ctx.roundRect(px + (dir > 0 ? -3 : -8), headY - 3.5, 11, 5.5, 2.5);
    ctx.fill();
    ctx.fillStyle = '#00f0ff';
    const eyeOffset = dir > 0 ? 0 : -4;
    ctx.fillRect(px + eyeOffset, headY - 2, 2.6, 2.4);
    ctx.fillRect(px + eyeOffset + 4.2, headY - 2, 2.6, 2.4);

    ctx.restore();
  }

  drawPowerups(ctx) {
    if (this.powerups.length === 0) return;
    const labels = { double: '⚡', sticky: '🪝', emp: '💣', life: '❤️', shield: '🛡️', freeze: '❄️', coin: '🪙' };
    const colors = { double: '#00f0ff', sticky: '#ffd700', emp: '#ff2a85', life: '#ff4d88', shield: '#00ff88', freeze: '#99e6ff', coin: '#ffd700' };
    ctx.save();
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < this.powerups.length; i++) {
      const p = this.powerups[i];
      if (p.life < 2 && Math.floor(p.life * 8) % 2 === 0) continue;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = colors[p.type] || '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillText(labels[p.type] || '★', Math.round(p.x), Math.round(p.y + 1));
    }
    ctx.restore();
  }

  drawParticles(ctx) {
    if (this.particles.length === 0) return;
    ctx.save();
    for (let i = 0; i < this.particles.length; i++) {
      const pt = this.particles[i];
      const a = Math.max(0, pt.life / pt.maxLife);
      ctx.globalAlpha = a;
      if (pt.kind === 'ring') {
        const curR = pt.r + (pt.maxR - pt.r) * (1 - a);
        ctx.strokeStyle = pt.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, curR, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.r, pt.y - pt.r, pt.r * 2, pt.r * 2);
      }
    }
    ctx.restore();
  }

  drawFloatingTexts(ctx) {
    if (this.floatingTexts.length === 0) return;
    ctx.save();
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const ft = this.floatingTexts[i];
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, Math.round(ft.x), Math.round(ft.y));
    }
    ctx.restore();
  }

  drawTopOverlayHud(ctx) {
    if (this.waveBannerTimer > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.waveBannerTimer);
      ctx.font = '900 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(255, 42, 133, 0.85)';
      ctx.lineWidth = 4;
      ctx.strokeText(`WAVE ${this.wave}`, this.width / 2, 72);
      ctx.fillStyle = '#00f0ff';
      ctx.fillText(`WAVE ${this.wave}`, this.width / 2, 72);
      ctx.restore();
    }

    // Active Power-Up Timers (Top Left)
    let hudY = 34;
    ctx.save();
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    if (this.doubleArrowTimer > 0) {
      ctx.fillStyle = '#00f0ff';
      ctx.fillText('⚡ 2x HARPOON ACTIVE', 16, hudY);
      hudY += 15;
    }
    if (this.stickyWireTimer > 0) {
      ctx.fillStyle = '#ffd700';
      ctx.fillText('🪝 STICKY WIRE ACTIVE', 16, hudY);
      hudY += 15;
    }
    if (this.freezeTimer > 0) {
      ctx.fillStyle = '#99e6ff';
      ctx.fillText(`❄️ FREEZE ${this.freezeTimer.toFixed(1)}s`, 16, hudY);
    }
    ctx.restore();

    // Live Combo Meter + Fever Indicator (Top Right)
    if (this.combo >= 2 && this.comboTimer > 0) {
      const comboMult = Math.min(4, 1 + Math.floor((this.combo - 1) / 3) * 0.5);
      const isFever = this.combo >= 8;
      const comboColor = isFever ? '#ffd700' : (this.combo >= 5 ? '#ff2a85' : '#00f0ff');
      const boxW = 124;
      const boxH = 26;
      const boxX = this.width - boxW - 14;
      const boxY = 24;
      const pct = Math.max(0, Math.min(1, this.comboTimer / 1.8));

      ctx.save();
      ctx.fillStyle = 'rgba(7, 10, 26, 0.88)';
      ctx.strokeStyle = comboColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = comboColor;
      ctx.fillRect(boxX + 3, boxY + boxH - 4, (boxW - 6) * pct, 2.5);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isFever ? `🔥 FEVER x${this.combo} (${comboMult}x)` : `🔥 x${this.combo} COMBO (${comboMult}x)`, boxX + boxW / 2, boxY + 11);
      ctx.restore();
    }

    // Bottom-Right Tactical Dash Gauge & Touch Button
    const btnW = 90;
    const btnH = 26;
    const btnX = this.width - btnW - 14;
    const btnY = this.floorY - btnH - 6;
    const isReady = this.dashCooldown <= 0;
    const coolPct = isReady ? 1.0 : Math.max(0, 1 - (this.dashCooldown / this.dashMaxCooldown));

    ctx.save();
    ctx.fillStyle = isReady ? 'rgba(0, 240, 255, 0.2)' : 'rgba(12, 18, 36, 0.78)';
    ctx.strokeStyle = isReady ? '#00f0ff' : 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = isReady ? 1.5 : 1;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 6);
    ctx.fill();
    ctx.stroke();

    if (!isReady) {
      ctx.fillStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.fillRect(btnX + 2, btnY + btnH - 4, (btnW - 4) * coolPct, 2.5);
    }

    ctx.fillStyle = isReady ? '#ffffff' : 'rgba(255, 255, 255, 0.65)';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isReady ? '🌀 DASH [SHIFT]' : `⏳ ${this.dashCooldown.toFixed(1)}s`, btnX + btnW / 2, btnY + btnH / 2);
    ctx.restore();
  }
}

let bubbleEngine = null;

function runBubbleGame() {
  const canvas = document.getElementById('bubble-canvas');
  const overlay = document.getElementById('bubble-ui-overlay');
  if (!canvas || !overlay) return;

  if (!bubbleEngine) {
    bubbleEngine = new BubbleTroubleGame('bubble-canvas', 'bubble-ui-overlay');
    window.bubbleGame = bubbleEngine;
  } else {
    bubbleEngine.canvas = canvas;
    bubbleEngine.ctx = canvas.getContext('2d', { alpha: false });
    bubbleEngine.overlay = overlay;
  }
  bubbleEngine.startGame();
}

window.startBubbleGame = runBubbleGame;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('btn-start-bubble');
    if (startBtn) startBtn.onclick = runBubbleGame;
  });
} else {
  const startBtn = document.getElementById('btn-start-bubble');
  if (startBtn) startBtn.onclick = runBubbleGame;
}
