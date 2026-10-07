// ==============================================================================
// CYBER TETRIS - NEON FALLING-BLOCK MATRIX PUZZLE
// ==============================================================================
// Features:
//   - Authentic 10x20 visible matrix (+2 hidden buffer rows)
//   - Standard 7 Tetrominoes with 7-Bag Randomizer & SRS Wall Kicks
//   - Clean playfield (ghost piece projection removed)
//   - Hold piece queue & Next 3 pieces preview
//   - Exponential Gravity Acceleration Curve (800ms down to instant 20G at 3m)
//   - Line clear particle effects, floating arcade badges & combo multipliers
//   - Self-contained Web Audio API retro synthesizer chimes & chords
//   - Keyboard (WASD/Arrows/Space/C) + Mobile On-Screen Virtual Buttons & Touch
//   - Authoritative Supabase arcade session & Turnstile integration
// ==============================================================================

class CyberTetrisGame {
  constructor() {
    this.cols = 10;
    this.rows = 20;
    this.hiddenRows = 2; // spawn rows above visible matrix
    this.totalRows = this.rows + this.hiddenRows;
    this.board = Array.from({ length: this.totalRows }, () => Array(this.cols).fill(null));

    // Score & Gameplay State
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.bestScore = 0;
    this.combo = -1;
    this.isPlaying = false;
    this.isPaused = false;
    this.isGameOver = false;
    this.lastClearWasTetris = false;
    this.bonusTokensCollected = 0; // Rare 5 PGT bonus coins
    this.piecesUntilCoin = 16;
    this.coinCells = new Set(); // Coordinates of locked golden coins: "r,c"

    // Active Pieces
    this.currentPiece = null;
    this.currentX = 0;
    this.currentY = 0;
    this.holdPieceType = null;
    this.canHold = true;
    this.bag = [];
    this.nextQueue = [];

    // Timing & Gravity Physics
    this.dropCounter = 0;
    this.dropInterval = 800; // ms per row drop
    this.lockDelay = 500; // ms before locking at bottom
    this.lockTimer = 0;
    this.isLocking = false;
    this.lockMoveResets = 0;
    this.maxLockResets = 15;
    this.lastTime = 0;
    this.startTime = 0;
    this.elapsedSeconds = 0;
    this.animationId = null;

    // Session & Anti-Cheat
    this.sessionId = null;

    // Canvases
    this.mainCanvas = null;
    this.mainCtx = null;
    this.holdCanvas = null;
    this.holdCtx = null;
    this.nextCanvas = null;
    this.nextCtx = null;
    this.cellSize = 26;

    // Line Clear Animation
    this.clearingLines = [];
    this.clearAnimationTimer = 0;

    // Audio
    this.audioCtx = null;

    // Keys & DAS (Delayed Auto Shift)
    this.keys = {};
    this.dasTimer = 0;
    this.dasDelay = 160; // ms before repeating
    this.dasRepeat = 40; // ms repeat rate
    this.dasDirection = 0;

    // Tetromino Color Palette (Neon Cyberpunk)
    this.colors = {
      I: '#00f0ff', // Cyan
      J: '#2979ff', // Blue
      L: '#ff9100', // Orange
      O: '#ffd600', // Yellow
      S: '#00e676', // Emerald
      T: '#d500f9', // Purple
      Z: '#ff1744'  // Neon Red
    };

    // Tetromino Shape Definitions
    this.shapes = {
      I: [
        [0,0,0,0],
        [1,1,1,1],
        [0,0,0,0],
        [0,0,0,0]
      ],
      J: [
        [1,0,0],
        [1,1,1],
        [0,0,0]
      ],
      L: [
        [0,0,1],
        [1,1,1],
        [0,0,0]
      ],
      O: [
        [1,1],
        [1,1]
      ],
      S: [
        [0,1,1],
        [1,1,0],
        [0,0,0]
      ],
      T: [
        [0,1,0],
        [1,1,1],
        [0,0,0]
      ],
      Z: [
        [1,1,0],
        [0,1,1],
        [0,0,0]
      ]
    };

    this.bindInputs();
  }

  // --- Neon Matrix Atmospheric Level Themes ---
  getLevelTheme(lvl = 1) {
    const level = lvl || 1;
    if (level < 4) {
      return {
        name: 'CYAN NEBULA',
        bg: '#050a16',
        grid: 'rgba(0, 240, 255, 0.08)',
        borderGlow: '0 0 25px rgba(0, 240, 255, 0.35)',
        accent: '#00f0ff',
        phaseTitle: 'CYAN NEBULA'
      };
    } else if (level < 7) {
      return {
        name: 'SYNTH VIOLET',
        bg: '#0c051a',
        grid: 'rgba(189, 0, 255, 0.10)',
        borderGlow: '0 0 28px rgba(189, 0, 255, 0.40)',
        accent: '#bd00ff',
        phaseTitle: 'SYNTH VIOLET'
      };
    } else if (level < 10) {
      return {
        name: 'LASER MAGENTA',
        bg: '#140412',
        grid: 'rgba(255, 0, 127, 0.12)',
        borderGlow: '0 0 30px rgba(255, 0, 127, 0.45)',
        accent: '#ff007f',
        phaseTitle: 'LASER MAGENTA'
      };
    } else if (level < 14) {
      return {
        name: 'CYBER AMBER',
        bg: '#180a03',
        grid: 'rgba(255, 170, 0, 0.14)',
        borderGlow: '0 0 32px rgba(255, 170, 0, 0.50)',
        accent: '#ffaa00',
        phaseTitle: 'CYBER AMBER'
      };
    } else {
      return {
        name: 'QUANTUM OVERDRIVE',
        bg: '#03140a',
        grid: 'rgba(0, 255, 136, 0.16)',
        borderGlow: '0 0 36px rgba(0, 255, 136, 0.60)',
        accent: '#00ff88',
        phaseTitle: 'QUANTUM OVERDRIVE'
      };
    }
  }

  // --- Audio Synthesis Engine ---
  initAudio() {
    if (!this.audioCtx) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) this.audioCtx = new AudioContextClass();
      } catch (e) {}
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  playSfx(type) {
    if (typeof window !== 'undefined' && window.sfx && window.sfx.enabled === false) return;
    if (!this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'move') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(480, now + 0.04);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'rotate') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.06);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
      } else if (type === 'soft_drop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.03);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.start(now);
        osc.stop(now + 0.03);
      } else if (type === 'hard_drop') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'hold') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'clear') {
        // Line clear chime
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.12); // G5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'tetris') {
        // Triumphant 4-note Tetris fanfare
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(523.25, now);        // C5
        osc.frequency.setValueAtTime(659.25, now + 0.07); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.14); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.21); // C6
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc.start(now);
        osc.stop(now + 0.38);
      } else if (type === 'combo') {
        const comboPitch = Math.min(950, 440 + ((this.combo > 0 ? this.combo : 1) * 65));
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(comboPitch, now);
        osc.frequency.exponentialRampToValueAtTime(comboPitch * 1.35, now + 0.09);
        gain.gain.setValueAtTime(0.14, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc.start(now);
        osc.stop(now + 0.09);
      } else if (type === 'perfect_clear') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);        // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
        osc.frequency.setValueAtTime(1318.51, now + 0.32); // E6
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
        osc.start(now);
        osc.stop(now + 0.48);
      } else if (type === 'coin') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1320, now + 0.08);
        osc.frequency.setValueAtTime(1760, now + 0.16);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'level_up') {
        // Muted per player request
        return;
      } else if (type === 'gameover') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.exponentialRampToValueAtTime(65, now + 0.55);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.start(now);
        osc.stop(now + 0.55);
      }
    } catch (e) {}
  }

  // --- Initial Mount & Canvases Setup ---
  initCanvases() {
    this.mainCanvas = document.getElementById('tetris-canvas');
    if (this.mainCanvas) {
      this.mainCtx = this.mainCanvas.getContext('2d');
    }

    this.holdCanvas = document.getElementById('tetris-hold-canvas');
    if (this.holdCanvas) {
      this.holdCtx = this.holdCanvas.getContext('2d');
    }

    this.nextCanvas = document.getElementById('tetris-next-canvas');
    if (this.nextCanvas) {
      this.nextCtx = this.nextCanvas.getContext('2d');
    }

    this.resizeCanvases();
  }

  resizeCanvases() {
    if (!this.mainCanvas) return;

    const isMobile = window.innerWidth <= 768 || window.innerHeight <= 500;
    const sidebarWidth = isMobile ? 76 : 84;
    const gap = isMobile ? 8 : 10;
    const padding = isMobile ? 16 : 24;

    // Available width for board canvas
    const availWidth = Math.max(160, window.innerWidth - sidebarWidth - gap - padding);
    const maxCellByWidth = Math.floor(availWidth / this.cols);

    // Available height for board canvas (account for top HUD ~50px and bottom touch controls ~65px)
    const reservedHeight = isMobile ? 150 : 160;
    const availHeight = Math.max(320, Math.min(window.innerHeight - reservedHeight, 540));
    const maxCellByHeight = Math.floor(availHeight / this.rows);

    // Pick cell size guaranteeing zero clipping both horizontally and vertically
    this.cellSize = Math.max(16, Math.min(26, maxCellByWidth, maxCellByHeight));

    const boardW = this.cols * this.cellSize;
    const boardH = this.rows * this.cellSize;

    this.mainCanvas.width = boardW;
    this.mainCanvas.height = boardH;
    this.mainCanvas.style.width = `${boardW}px`;
    this.mainCanvas.style.height = `${boardH}px`;

    const container = document.getElementById('tetris-board-wrapper');
    if (container) {
      container.style.width = `${boardW}px`;
      container.style.height = `${boardH}px`;
      container.style.flexShrink = '0';
      container.style.flexGrow = '0';
    }

    this.renderSideQueues();
  }

  // --- 7-Bag Randomizer ---
  fillBag() {
    const types = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }
    this.bag.push(...types);
  }

  getNextPieceType() {
    while (this.bag.length < 7) {
      this.fillBag();
    }
    return this.bag.shift();
  }

  // --- Start Session & Launch ---
  async start() {
    this.initAudio();
    this.initCanvases();

    // Reset Board Matrix (22 rows x 10 cols: rows 0-1 are hidden buffer)
    this.board = Array.from({ length: this.totalRows }, () => Array(this.cols).fill(null));
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.elapsedSeconds = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.lastClearWasTetris = false;
    this.combo = -1;
    this.bonusTokensCollected = 0;
    this.piecesUntilCoin = Math.floor(16 + Math.random() * 8);
    this.coinCells = new Set();
    const wrapper = document.getElementById('tetris-board-wrapper');
    if (wrapper) wrapper.style.boxShadow = '0 0 25px rgba(0, 240, 255, 0.35)';
    this.clearingLines = [];
    this.holdPieceType = null;
    this.canHold = true;
    this.bag = [];
    this.nextQueue = [];

    // Fill next queue with 3 upcoming pieces
    for (let i = 0; i < 3; i++) {
      this.nextQueue.push(this.getNextPieceType());
    }

    // Best Score sync
    const highscore = window.PolyState?.state?.user?.tetris_highscore || window.appState?.state?.tetrisHighScore || 0;
    this.bestScore = highscore;

    // Test Mode Guard
    const conf = window.appState?.state?.gamePayoutSettings?.tetris;
    if (conf && conf.test_mode === true) {
      const isTester = (typeof window.isWhitelistedGameTester === 'function') ? window.isWhitelistedGameTester() : false;
      if (!isTester) {
        if (typeof window.triggerToast === 'function') {
          window.triggerToast("🧪 Cyber Tetris is currently in private test mode.", "warning");
        }
        return;
      }
    }

    if (this.isStarting) return;
    this.isStarting = true;

    // Check Turnstile & Request Server Session
    let sessId = null;
    try {
      if (typeof window.startArcadeSession === 'function') {
        sessId = await window.startArcadeSession('tetris');
      }
    } catch (e) {
      console.warn("[CyberTetris] startArcadeSession error:", e);
    } finally {
      this.isStarting = false;
    }

    if (!sessId && window.appState?.isPlayerConnected?.()) {
      return; // Server rejected session creation (e.g. test_mode locked or Turnstile pending)
    }

    this.sessionId = sessId;
    this.startTime = Date.now();
    this.lastTime = performance.now();
    this.isPlaying = true;

    // UI Updates
    this.updateHUD();
    const startScreen = document.getElementById('tetris-start-screen');
    const overScreen = document.getElementById('tetris-gameover-screen');
    const pauseScreen = document.getElementById('tetris-pause-screen');
    if (startScreen) startScreen.style.display = 'none';
    if (overScreen) overScreen.style.display = 'none';
    if (pauseScreen) pauseScreen.style.display = 'none';

    // Spawn first piece
    this.spawnPiece();

    // Start game loop
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.animationId = requestAnimationFrame(this.loop.bind(this));
  }

  // --- Piece Spawning ---
  spawnPiece() {
    const type = this.nextQueue.shift();
    this.nextQueue.push(this.getNextPieceType());

    const shape = this.shapes[type].map(row => [...row]);

    // Rare 5 PGT Coin generation on tetromino mino
    this.piecesUntilCoin = (this.piecesUntilCoin || 16) - 1;
    let hasCoin = false;
    if (this.piecesUntilCoin <= 0) {
      this.piecesUntilCoin = Math.floor(18 + Math.random() * 12);
      const filledCoords = [];
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c] !== 0) filledCoords.push({ r, c });
        }
      }
      if (filledCoords.length > 0) {
        const pick = filledCoords[Math.floor(Math.random() * filledCoords.length)];
        shape[pick.r][pick.c] = 2; // 2 denotes a golden 5 PGT Coin mino
        hasCoin = true;
        this.triggerFloatingBadge('🪙 5 PGT COIN PIECE!', 'coin', 'CLEAR LINE TO CLAIM');
        this.playSfx('coin');
      }
    }

    this.currentPiece = {
      type,
      shape,
      color: this.colors[type],
      rotation: 0,
      hasCoin
    };

    // Center piece horizontally at spawn row (rows 0-1)
    this.currentX = Math.floor((this.cols - shape[0].length) / 2);
    this.currentY = 0; // Spawn in top hidden buffer rows

    this.isLocking = false;
    this.lockTimer = 0;
    this.lockMoveResets = 0;
    this.canHold = true;

    // Instant Top-Out Game Over Check
    if (this.checkCollision(this.currentX, this.currentY, this.currentPiece.shape)) {
      this.gameOver();
      return;
    }

    // In 20G Hyperdrive (Level 25+): Drop immediately to floor upon spawn
    if (this.dropInterval === 0) {
      this.currentY = this.getGhostY();
      this.isLocking = true;
    }

    this.renderSideQueues();
  }

  // --- Dynamic Gravity Acceleration Curve ---
  updateGravity() {
    this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);

    // Level scales with BOTH lines cleared AND elapsed time (calibrated twice slower for longer sessions)
    // Progresses every 20 lines (was 10) and every 15 seconds (was 7)
    const linesLevel = Math.floor(this.lines / 20) + 1;
    const timeLevel = Math.floor(this.elapsedSeconds / 15) + 1; // +1 level every 15 seconds (twice slower)
    const newLevel = Math.max(linesLevel, timeLevel);

    if (newLevel !== this.level) {
      const prevTheme = this.getLevelTheme(this.level);
      const newTheme = this.getLevelTheme(newLevel);
      this.level = newLevel;

      if (newTheme.name !== prevTheme.name) {
        this.triggerFloatingBadge(`⚡ ${newTheme.phaseTitle}!`, 'level', `PHASE SHIFT`);
        const wrapper = document.getElementById('tetris-board-wrapper');
        if (wrapper) wrapper.style.boxShadow = newTheme.borderGlow;
      }
    }

    // Drop Interval Scaling (Twice slower ramp: lasts ~5-6 minutes):
    // Level 1: 800ms
    // Level 5 (1:00m): ~400ms
    // Level 10 (2:15m): ~180ms
    // Level 15 (3:30m): ~80ms
    // Level 20 (4:45m): ~35ms
    // Level 25+ (6:00m+): 0ms (Instant 20G Fall)
    if (this.level >= 25) {
      this.dropInterval = 0; // 20G Mode
    } else {
      this.dropInterval = Math.max(25, Math.floor(800 * Math.pow(0.86, this.level - 1)));
    }

    // Lock Delay Decays twice slower from 500ms down to 180ms
    this.lockDelay = Math.max(180, 500 - (this.level * 6));

    this.updateHUD();
  }

  // --- Collision Detection ---
  checkCollision(x, y, shape) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] !== 0) {
          const newX = x + c;
          const newY = y + r;

          // Wall & Floor Boundaries
          if (newX < 0 || newX >= this.cols || newY >= this.totalRows) {
            return true;
          }

          // Existing Stack collision
          if (newY >= 0 && this.board[newY] && this.board[newY][newX] !== null) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // --- Ghost Piece Projection ---
  getGhostY() {
    if (!this.currentPiece) return this.currentY;
    let ghostY = this.currentY;
    while (!this.checkCollision(this.currentX, ghostY + 1, this.currentPiece.shape)) {
      ghostY++;
    }
    return ghostY;
  }

  // --- Piece Movement ---
  moveLeft() {
    if (!this.isPlaying || this.isPaused || !this.currentPiece) return;
    if (!this.checkCollision(this.currentX - 1, this.currentY, this.currentPiece.shape)) {
      this.currentX--;
      this.handlePieceShift();
      this.playSfx('move');
    }
  }

  moveRight() {
    if (!this.isPlaying || this.isPaused || !this.currentPiece) return;
    if (!this.checkCollision(this.currentX + 1, this.currentY, this.currentPiece.shape)) {
      this.currentX++;
      this.handlePieceShift();
      this.playSfx('move');
    }
  }

  softDrop() {
    if (!this.isPlaying || this.isPaused || !this.currentPiece) return;
    if (!this.checkCollision(this.currentX, this.currentY + 1, this.currentPiece.shape)) {
      this.currentY++;
      this.score += 1; // +1 point for soft drop cell
      this.dropCounter = 0;
      this.playSfx('soft_drop');
      this.updateHUD();
    } else {
      this.isLocking = true;
    }
  }

  hardDrop() {
    if (!this.isPlaying || this.isPaused || !this.currentPiece) return;
    const ghostY = this.getGhostY();
    const droppedRows = ghostY - this.currentY;
    this.score += droppedRows * 2; // +2 points per hard drop cell
    this.currentY = ghostY;
    this.playSfx('hard_drop');
    this.lockPiece();
    this.updateHUD();
  }

  rotate(clockwise = true) {
    if (!this.isPlaying || this.isPaused || !this.currentPiece) return;
    const currentShape = this.currentPiece.shape;
    const n = currentShape.length;
    const rotated = Array.from({ length: n }, () => Array(n).fill(0));

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (clockwise) {
          rotated[c][n - 1 - r] = currentShape[r][c];
        } else {
          rotated[n - 1 - c][r] = currentShape[r][c];
        }
      }
    }

    // Super Rotation System (SRS) Wall Kicks: Test basic offsets [0, -1, +1, -2, +2, up -1]
    const kicks = [0, -1, 1, -2, 2];
    let kicked = false;

    for (const offset of kicks) {
      if (!this.checkCollision(this.currentX + offset, this.currentY, rotated)) {
        this.currentX += offset;
        this.currentPiece.shape = rotated;
        kicked = true;
        break;
      }
    }

    // Try vertical kick up by 1 if resting on floor
    if (!kicked && !this.checkCollision(this.currentX, this.currentY - 1, rotated)) {
      this.currentY -= 1;
      this.currentPiece.shape = rotated;
      kicked = true;
    }

    if (kicked) {
      this.handlePieceShift();
      this.playSfx('rotate');
    }
  }

  handlePieceShift() {
    // If piece was touching bottom, allow reset lock timer up to maxLockResets
    if (this.isLocking && this.lockMoveResets < this.maxLockResets) {
      this.lockTimer = 0;
      this.lockMoveResets++;
    }
  }

  // --- Hold Queue ---
  hold() {
    if (!this.isPlaying || this.isPaused || !this.currentPiece || !this.canHold) return;

    this.playSfx('hold');
    const currentType = this.currentPiece.type;

    if (this.holdPieceType === null) {
      this.holdPieceType = currentType;
      this.spawnPiece();
    } else {
      const prevHold = this.holdPieceType;
      this.holdPieceType = currentType;

      const shape = this.shapes[prevHold].map(row => [...row]);
      this.currentPiece = {
        type: prevHold,
        shape,
        color: this.colors[prevHold],
        rotation: 0
      };
      this.currentX = Math.floor((this.cols - shape[0].length) / 2);
      this.currentY = 0;
      this.isLocking = false;
      this.lockTimer = 0;
      this.lockMoveResets = 0;
    }

    this.canHold = false;
    this.renderSideQueues();
  }

  // --- Lock Piece to Board ---
  lockPiece() {
    if (!this.currentPiece) return;
    const shape = this.currentPiece.shape;

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] !== 0) {
          const boardY = this.currentY + r;
          const boardX = this.currentX + c;

          // If locked completely above visible area (rows 0-1), trigger top-out
          if (boardY < this.hiddenRows) {
            this.gameOver();
            return;
          }

          if (boardY < this.totalRows && boardX >= 0 && boardX < this.cols) {
            if (shape[r][c] === 2) {
              this.board[boardY][boardX] = '#ffd700'; // Golden 5 PGT Coin mino
              this.coinCells.add(`${boardY},${boardX}`);
            } else {
              this.board[boardY][boardX] = this.currentPiece.color;
            }
          }
        }
      }
    }

    this.currentPiece = null;
    this.checkLines();
  }

  // --- Floating Neon Arcade Badges ---
  triggerFloatingBadge(text, type = 'single', subtext = '') {
    const wrapper = document.getElementById('tetris-board-wrapper');
    if (!wrapper) return;

    const badge = document.createElement('div');
    badge.className = `tetris-floating-badge tetris-badge-${type}`;
    if (subtext) {
      badge.innerHTML = `<div>${text}</div><div style="font-size:0.72rem; opacity:0.88; margin-top:2px; font-weight:700;">${subtext}</div>`;
    } else {
      badge.textContent = text;
    }

    wrapper.appendChild(badge);

    setTimeout(() => {
      if (badge.parentNode) badge.parentNode.removeChild(badge);
    }, 850);
  }

  // --- Line Clearing, Combos & Scoring ---
  checkLines() {
    const fullLines = [];
    for (let r = this.hiddenRows; r < this.totalRows; r++) {
      if (this.board[r].every(cell => cell !== null)) {
        fullLines.push(r);
      }
    }

    if (fullLines.length > 0) {
      this.clearingLines = fullLines;
      this.clearAnimationTimer = 160; // ms line flash animation

      // Combo Tracking: increment streak
      this.combo = (this.combo < 0) ? 0 : this.combo + 1;

      // Standard Tetris Guideline Scoring
      let basePoints = 0;
      const count = fullLines.length;
      let badgeType = 'single';
      let badgeText = 'SINGLE';

      if (count === 1) {
        basePoints = 100 * this.level;
        this.lastClearWasTetris = false;
        badgeType = 'single';
        badgeText = 'SINGLE';
        this.playSfx('clear');
      } else if (count === 2) {
        basePoints = 300 * this.level;
        this.lastClearWasTetris = false;
        badgeType = 'double';
        badgeText = 'DOUBLE';
        this.playSfx('clear');
      } else if (count === 3) {
        basePoints = 500 * this.level;
        this.lastClearWasTetris = false;
        badgeType = 'triple';
        badgeText = 'TRIPLE';
        this.playSfx('clear');
      } else if (count === 4) {
        // Back-to-Back Tetris Bonus
        const isB2B = this.lastClearWasTetris;
        basePoints = (isB2B ? 1200 : 800) * this.level;
        this.lastClearWasTetris = true;
        badgeType = isB2B ? 'b2b' : 'tetris';
        badgeText = isB2B ? '🔥 BACK-TO-BACK TETRIS!' : '⚡ TETRIS!';
        this.playSfx('tetris');
      }

      // Combo bonus: 50 * combo * level points
      let comboBonus = 0;
      if (this.combo > 0) {
        comboBonus = 50 * this.combo * this.level;
        basePoints += comboBonus;
      }

      this.score += basePoints;
      this.lines += count;

      // Check if any cleared line contains a golden 5 PGT coin!
      let coinsHarvested = 0;
      for (const rowIdx of fullLines) {
        for (let c = 0; c < this.cols; c++) {
          const key = `${rowIdx},${c}`;
          if (this.coinCells && this.coinCells.has(key)) {
            this.coinCells.delete(key);
            coinsHarvested++;
          }
        }
      }

      if (coinsHarvested > 0) {
        this.bonusTokensCollected = (this.bonusTokensCollected || 0) + coinsHarvested;
        this.score += 500 * coinsHarvested;
        this.playSfx('coin');
        this.triggerFloatingBadge(coinsHarvested > 1 ? `🪙 +${coinsHarvested * 5} PGT COINS!` : '🪙 +5 PGT COIN!', 'coin', 'RARE HARVEST');
        if (typeof window.triggerToast === 'function') {
          window.triggerToast(`🪙 Rare Harvest: Claimed ${coinsHarvested * 5} PGT Coin(s)!`, 'success');
        }
        this.updateHUD();
      }

      // Trigger floating badge for line clear
      this.triggerFloatingBadge(badgeText, badgeType, `+${basePoints} PTS`);

      // If combo streak >= 2, trigger combo callout badge
      if (this.combo > 0) {
        const comboCount = this.combo + 1; // 2nd consecutive piece = Combo 2
        setTimeout(() => {
          this.triggerFloatingBadge(`🔥 COMBO x${comboCount}!`, 'combo', `+${comboBonus} PTS`);
          this.playSfx('combo');
        }, 220);
      }

      // Trigger line clear particle flash on canvas
      this.render();

      setTimeout(() => {
        // Remove full lines safely and maintain exact totalRows
        const remainingRows = this.board.filter((row, idx) => !fullLines.includes(idx));
        const newEmptyRows = Array.from({ length: fullLines.length }, () => Array(this.cols).fill(null));
        this.board = [...newEmptyRows, ...remainingRows];
        this.clearingLines = [];

        // Rebuild coinCells set after rows shift down
        const newCoinCells = new Set();
        for (let r = 0; r < this.totalRows; r++) {
          for (let c = 0; c < this.cols; c++) {
            if (this.board[r] && this.board[r][c] === '#ffd700') {
              newCoinCells.add(`${r},${c}`);
            }
          }
        }
        this.coinCells = newCoinCells;

        // Check Perfect Clear (Board Completely Empty)
        let isPerfectClear = true;
        for (let r = this.hiddenRows; r < this.totalRows; r++) {
          for (let c = 0; c < this.cols; c++) {
            if (this.board[r] && this.board[r][c] !== null) {
              isPerfectClear = false;
              break;
            }
          }
          if (!isPerfectClear) break;
        }

        if (isPerfectClear) {
          const pcBonus = 2000 * this.level;
          this.score += pcBonus;
          this.triggerFloatingBadge('✨ PERFECT CLEAR!', 'perfect', `+${pcBonus} PTS`);
          this.playSfx('perfect_clear');
        }

        this.updateGravity();
        this.spawnPiece();
      }, 140);
    } else {
      // Piece locked without clearing lines: reset combo
      this.combo = -1;
      this.spawnPiece();
    }
  }

  // --- Main Animation Loop ---
  loop(time) {
    if (!this.isPlaying) return;

    const delta = time - this.lastTime;
    this.lastTime = time;

    if (!this.isPaused && this.clearingLines.length === 0) {
      // Gravity step
      this.dropCounter += delta;

      if (this.dropInterval === 0) {
        // 20G Instant Drop: piece stays at ghost position
        this.currentY = this.getGhostY();
        this.isLocking = true;
      } else if (this.dropCounter >= this.dropInterval) {
        this.dropCounter = 0;
        if (!this.checkCollision(this.currentX, this.currentY + 1, this.currentPiece.shape)) {
          this.currentY++;
          this.isLocking = false;
        } else {
          this.isLocking = true;
        }
      }

      // Lock Delay Handler
      if (this.isLocking) {
        this.lockTimer += delta;
        if (this.lockTimer >= this.lockDelay) {
          this.lockPiece();
        }
      }

      // Elapsed Time & Gravity update every second
      this.updateGravity();
    }

    this.render();
    this.animationId = requestAnimationFrame(this.loop.bind(this));
  }

  // --- Canvas Rendering ---
  render() {
    if (!this.mainCtx || !this.mainCanvas) return;
    const ctx = this.mainCtx;
    const size = this.cellSize;
    const theme = this.getLevelTheme(this.level);

    // Clear background with active level theme
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

    // Subtle neon grid lines styled to active level atmosphere
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    for (let c = 0; c <= this.cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * size, 0);
      ctx.lineTo(c * size, this.rows * size);
      ctx.stroke();
    }
    for (let r = 0; r <= this.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * size);
      ctx.lineTo(this.cols * size, r * size);
      ctx.stroke();
    }

    // Render locked stack (visible rows: hiddenRows to totalRows)
    for (let r = this.hiddenRows; r < this.totalRows; r++) {
      const renderY = (r - this.hiddenRows) * size;
      const isClearing = this.clearingLines.includes(r);
      const row = this.board && this.board[r];
      if (!row) continue;

      for (let c = 0; c < this.cols; c++) {
        const color = row[c];
        if (color) {
          if (isClearing) {
            // White neon line clear flash
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 15;
            ctx.fillRect(c * size + 1, renderY + 1, size - 2, size - 2);
            ctx.shadowBlur = 0;
          } else {
            const isCoin = this.coinCells && this.coinCells.has(`${r},${c}`);
            this.drawBlock(ctx, c * size, renderY, size, color, isCoin);
          }
        }
      }
    }

    // Render Active Piece
    if (this.currentPiece && this.clearingLines.length === 0) {
      const shape = this.currentPiece.shape;
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c] !== 0) {
            const boardY = this.currentY + r;
            if (boardY >= this.hiddenRows) {
              const renderX = (this.currentX + c) * size;
              const renderY = (boardY - this.hiddenRows) * size;
              const isCoinMino = shape[r][c] === 2;
              this.drawBlock(ctx, renderX, renderY, size, isCoinMino ? '#ffd700' : this.currentPiece.color, isCoinMino);
            }
          }
        }
      }
    }
  }

  // --- Render Neon Block Cell ---
  drawBlock(ctx, x, y, size, color, isCoin = false) {
    ctx.save();
    if (isCoin) {
      // Radiant Gold Metallic Gradient
      const goldGrad = ctx.createLinearGradient(x, y, x + size, y + size);
      goldGrad.addColorStop(0, '#fff6a6');
      goldGrad.addColorStop(0.35, '#ffd700');
      goldGrad.addColorStop(0.7, '#ff9900');
      goldGrad.addColorStop(1, '#b8860b');
      ctx.fillStyle = goldGrad;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 12;
      ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

      // Inner Coin Rim
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);

      // Center Coin Emblem 5
      ctx.font = `900 ${Math.floor(size * 0.55)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#3a2000';
      ctx.fillText('5', x + size / 2, y + size / 2 + 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('5', x + size / 2, y + size / 2);
    } else {
      // Cell Body
      ctx.fillStyle = color;
      ctx.fillRect(x + 1, y + 1, size - 2, size - 2);

      // Inner Bevel Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(x + 2, y + 2, size - 4, 3);
      ctx.fillRect(x + 2, y + 2, 3, size - 4);

      // Inner Bevel Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(x + 2, y + size - 5, size - 4, 3);
      ctx.fillRect(x + size - 5, y + 2, 3, size - 4);

      // Outer Glow Border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    }
    ctx.restore();
  }

  // --- Render Hold & Next Queues ---
  renderSideQueues() {
    // Hold Canvas
    if (this.holdCtx && this.holdCanvas) {
      const ctx = this.holdCtx;
      ctx.clearRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
      ctx.fillStyle = '#060a17';
      ctx.fillRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);

      if (this.holdPieceType) {
        const shape = this.shapes[this.holdPieceType];
        const color = this.canHold ? this.colors[this.holdPieceType] : '#55607a';
        this.drawCenteredPiece(ctx, shape, color, this.holdCanvas.width, this.holdCanvas.height, 15);
      }
    }

    // Next Canvas (Previews next 3 pieces)
    if (this.nextCtx && this.nextCanvas) {
      const ctx = this.nextCtx;
      ctx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
      ctx.fillStyle = '#060a17';
      ctx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);

      const previewHeight = this.nextCanvas.height / 3;
      this.nextQueue.slice(0, 3).forEach((type, idx) => {
        const shape = this.shapes[type];
        const color = this.colors[type];
        ctx.save();
        ctx.translate(0, idx * previewHeight);
        this.drawCenteredPiece(ctx, shape, color, this.nextCanvas.width, previewHeight, 14);
        ctx.restore();
      });
    }
  }

  drawCenteredPiece(ctx, shape, color, width, height, cellSize) {
    const pieceWidth = shape[0].length * cellSize;
    const pieceHeight = shape.length * cellSize;
    const startX = Math.floor((width - pieceWidth) / 2);
    const startY = Math.floor((height - pieceHeight) / 2);

    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c] !== 0) {
          this.drawBlock(ctx, startX + (c * cellSize), startY + (r * cellSize), cellSize, color);
        }
      }
    }
  }

  // --- HUD & Metric Display ---
  updateHUD() {
    const scoreEl = document.getElementById('tetris-score-val');
    const linesEl = document.getElementById('tetris-lines-val');
    const levelEl = document.getElementById('tetris-level-val');
    const timeEl = document.getElementById('tetris-time-val');
    const coinsEl = document.getElementById('tetris-coins-val');

    if (scoreEl) scoreEl.innerText = this.score.toLocaleString();
    if (linesEl) linesEl.innerText = this.lines.toString();
    if (levelEl) {
      levelEl.innerText = this.level >= 25 ? '20G MAX' : this.level.toString();
      const theme = this.getLevelTheme(this.level);
      if (theme && theme.accent) {
        levelEl.style.color = theme.accent;
        levelEl.style.textShadow = `0 0 10px ${theme.accent}`;
      }
    }
    if (coinsEl) {
      coinsEl.innerText = (this.bonusTokensCollected || 0).toString();
    }
    if (timeEl) {
      const mins = Math.floor(this.elapsedSeconds / 60);
      const secs = this.elapsedSeconds % 60;
      timeEl.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
  }

  // --- Game Over & Authoritative Settlement ---
  async gameOver() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.isGameOver = true;
    if (this.animationId) cancelAnimationFrame(this.animationId);

    this.playSfx('gameover');

    const bonusCoins = Math.min(20, this.bonusTokensCollected || 0);
    const cleanScore = Math.floor(this.score);
    const cleanLines = Math.floor(this.lines);

    // Multipliers calculation
    const isPlayerConnected = window.appState && typeof window.appState.isPlayerConnected === 'function' && window.appState.isPlayerConnected();
    const multis = (window.appState && typeof window.appState.getMultipliers === 'function') ? window.appState.getMultipliers() : {};
    const nftPct = multis ? (multis.nftGameMultiplier || 0) : 0;
    const nftMult = Math.max(1.0, Math.min(10.0, 1 + (nftPct / 100)));
    const isApex = !!(multis && (multis.isApexUnlocked || multis.isSeason1ApexUnlocked));
    const relicMult = isApex ? 1.5 : 1.0;
    const isVip = window.appState && typeof window.appState.isVipActive === 'function' && window.appState.isVipActive();
    const vipLevel = (window.appState && typeof window.appState.getVipLevel === 'function') ? window.appState.getVipLevel() : (isVip ? 2 : 0);
    const vipMult = isVip ? (vipLevel >= 2 ? 2.0 : 1.5) : 1.0;
    const isAmb = !!(window.appState && window.appState.state && window.appState.state.isAmbassador);
    const ambMult = isAmb ? 2.0 : 1.0;
    const playerMult = nftMult * relicMult * vipMult * ambMult;

    const globalEarnMult = (window.appState && window.appState.state && (window.appState.state.globalEarnMultiplier !== undefined || window.appState.state.globalArcadeEarnMultiplier !== undefined))
      ? Number(window.appState.state.globalEarnMultiplier !== undefined ? window.appState.state.globalEarnMultiplier : window.appState.state.globalArcadeEarnMultiplier)
      : 1.0;

    // Strict 150.00 PGT Base Cap (3x Boosted Earn)
    const rawBase = Math.min(150.0, (((cleanScore / 2000.0) + (cleanLines * 0.05)) * 3.0) * globalEarnMult);
    const tokenPgt = bonusCoins * 5.0;
    const calculatedPgt = parseFloat((rawBase * playerMult).toFixed(2));
    const finalPgt = cleanScore > 0 ? Math.min(1000.0, Math.max(0.01, parseFloat((calculatedPgt + tokenPgt).toFixed(2)))) : 0;

    // Local Highscore Check
    const prevHigh = (window.appState && window.appState.state) ? (window.appState.state.tetrisHighScore || 0) : 0;
    const isNewHigh = cleanScore > prevHigh;
    if (window.appState && window.appState.state) {
      window.appState.state.tetrisHighScore = Math.max(cleanScore, prevHigh);
      window.appState.state.alltimeTetrisHighScore = Math.max(cleanScore, window.appState.state.alltimeTetrisHighScore || 0);
      window.appState.save();
    }

    // Display Game Over Overlay initially
    const overScreen = document.getElementById('tetris-gameover-screen');
    const finalScoreEl = document.getElementById('tetris-final-score');
    const finalLinesEl = document.getElementById('tetris-final-lines');
    const finalCoinsEl = document.getElementById('tetris-final-coins');
    const finalPgtEl = document.getElementById('tetris-final-pgt');
    const highscoreText = document.getElementById('tetris-highscore-text');
    const multBreakdown = document.getElementById('tetris-mult-breakdown');
    const limitWarning = document.getElementById('tetris-limit-warning');

    if (finalScoreEl) finalScoreEl.innerText = cleanScore.toLocaleString();
    if (finalLinesEl) finalLinesEl.innerText = cleanLines.toString();
    if (finalCoinsEl) finalCoinsEl.innerText = `${bonusCoins} (${(bonusCoins * 5).toFixed(2)} PGT)`;

    const vipBadgeStr = (isVip ? (vipLevel >= 2 ? ' 🔥 <span style="color:var(--color-warning); font-size:0.8rem;">(Gold VIP 2.0x)</span>' : ' 🥈 <span style="color:#c0c0c0; font-size:0.8rem;">(Silver VIP 1.5x)</span>') : '') + 
      (isAmb ? ' 🎖️ <span style="color:var(--color-warning); font-size:0.8rem;">(Amb 2.0x)</span>' : '') +
      (isApex ? ' 🏺 <span style="color:#ffd700; font-size:0.8rem;">(Apex 1.5x)</span>' : '');
    if (multBreakdown) {
      multBreakdown.innerHTML = `Base: <strong style="color:#fff;">${rawBase.toFixed(2)} PGT</strong> • Multiplier: <strong style="color:var(--color-secondary);">${playerMult.toFixed(1)}x</strong> (${nftPct}% NFT${vipBadgeStr})`;
    }
    if (finalPgtEl) finalPgtEl.innerText = 'Settling...';
    if (highscoreText) highscoreText.style.display = 'none';
    if (limitWarning) limitWarning.style.display = 'none';
    if (overScreen) {
      overScreen.style.removeProperty('display');
      overScreen.style.display = 'flex';
    }

    let verifiedPgt = this.sessionId ? finalPgt : (isPlayerConnected ? 0.0 : finalPgt);
    let isHarvestDisabled = false;
    let isDailyLimitReached = false;

    if (this.sessionId && typeof window.endArcadeSession === 'function') {
      try {
        const result = await window.endArcadeSession(
          this.sessionId,
          cleanScore,
          cleanLines, // bonus_items = cleared lines
          bonusCoins, // bonus_tokens: each awards 5.0 PGT server-side
          nftMult
        );

        if (result && (result.success || result.payout !== undefined || result.payout_pgt !== undefined)) {
          verifiedPgt = result.payout_pgt !== undefined ? parseFloat(result.payout_pgt) : (result.payout !== undefined ? parseFloat(result.payout) : 0.0);
          if (result.harvest_enabled === false) isHarvestDisabled = true;
          if (result.daily_limit_reached) isDailyLimitReached = true;
        } else {
          verifiedPgt = 0.0;
        }
      } catch (err) {
        console.error('[CyberTetris] Settlement error:', err);
        verifiedPgt = 0.0;
      }
    }

    const gamePgt = Math.max(0, verifiedPgt - tokenPgt);
    const verifiedBase = (playerMult > 0 && verifiedPgt > 0) ? (gamePgt / playerMult) : rawBase;
    const maxPlays = (window.appState && window.appState.state && window.appState.state.maxDailyPlaysPerGame) ? window.appState.state.maxDailyPlaysPerGame : 25;

    let payoutDisplay = `+${verifiedPgt.toFixed(2)} PGT`;
    if (isHarvestDisabled) {
      payoutDisplay = `+0.00 PGT <span style="display:block; color:var(--color-danger); font-size:0.75rem; margin-top:2px;">🚫 In-Game Harvest Paused by Admin</span>`;
    } else if (isDailyLimitReached) {
      payoutDisplay = `+0.00 PGT <span style="display:block; color:var(--color-warning); font-size:0.75rem; margin-top:2px;">⚠️ Daily Limit (${maxPlays}/${maxPlays} plays) • Rewards Paused</span>`;
    } else if (isPlayerConnected && !this.sessionId && cleanScore > 0) {
      payoutDisplay = `+0.00 PGT <span style="display:block; color:var(--color-warning); font-size:0.75rem; margin-top:2px;">⚠️ Session Not Verified • Rewards Paused</span>`;
    } else if (!isPlayerConnected) {
      payoutDisplay = `<span style="color:var(--text-dim); font-size:1.1rem;">Connect Wallet to Earn PGT</span>`;
    } else if (tokenPgt > 0 && verifiedPgt > 0) {
      payoutDisplay = `+${gamePgt.toFixed(2)} PGT <span style="color:var(--color-warning); font-size:0.9em; font-weight:700;">+ ${tokenPgt.toFixed(0)} PGT Bonus</span>`;
    }

    if (finalPgtEl) {
      finalPgtEl.innerHTML = payoutDisplay;
    }

    if (multBreakdown) {
      multBreakdown.innerHTML = `Base: <strong style="color:#fff;">${verifiedBase.toFixed(2)} PGT</strong> • Multiplier: <strong style="color:var(--color-secondary);">${playerMult.toFixed(1)}x</strong> (${nftPct}% NFT${vipBadgeStr})`;
    }

    if (highscoreText) {
      highscoreText.style.display = isNewHigh && cleanScore > 0 ? 'block' : 'none';
    }

    if (limitWarning) {
      if (isDailyLimitReached) {
        limitWarning.innerText = "⚠️ Daily arcade plays reached. Highscore recorded!";
        limitWarning.style.display = 'block';
      } else {
        limitWarning.style.display = 'none';
      }
    }

    // Daily Quest & Highscore & Profile Sync
    if (typeof window.trackQuestProgress === 'function') {
      window.trackQuestProgress('arcade', 1);
    }
    if (typeof window.syncGameHighScore === 'function') {
      window.syncGameHighScore('tetris', cleanScore);
    }
    if (typeof window.loadTetrisLeaderboard === 'function') {
      window.loadTetrisLeaderboard();
    }
    if (typeof window.syncProfileView === 'function') {
      window.syncProfileView();
    }

    if (isPlayerConnected && typeof window.sendDiscordEarnAnnouncement === 'function' && verifiedPgt > 0) {
      window.sendDiscordEarnAnnouncement('Cyber Tetris', cleanScore, verifiedPgt);
    } else if (isPlayerConnected && typeof window.sendDiscordHighScore === 'function' && verifiedPgt > 0) {
      window.sendDiscordHighScore('Cyber Tetris', cleanScore, verifiedPgt);
    }

    if (window.appState && typeof window.appState.addActivity === 'function' && verifiedPgt > 0) {
      window.appState.addActivity('You', `cleared ${cleanLines} neon matrix lines in Cyber Tetris (${cleanScore.toLocaleString()} pts)`, `+${verifiedPgt.toFixed(2)} PGT`);
    }
  }

  // --- Input Bindings (Keyboard & Mobile Touch) ---
  bindInputs() {
    window.addEventListener('keydown', (e) => {
      const panel = document.getElementById('panel-game-tetris');
      if (!panel || panel.style.display === 'none') return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        this.moveLeft();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        this.moveRight();
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        this.softDrop();
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyX') {
        this.rotate(true);
      } else if (e.code === 'KeyZ' || e.code === 'ControlLeft') {
        this.rotate(false);
      } else if (e.code === 'Space') {
        this.hardDrop();
      } else if (e.code === 'KeyC' || e.code === 'ShiftLeft') {
        this.hold();
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        this.togglePause();
      }
    });

    // Fullscreen Mobile Touch Gestures (Responsive Anywhere on Screen)
    let touchStartX = 0;
    let touchStartY = 0;
    let lastStepX = 0;
    let lastStepY = 0;
    let touchStartTime = 0;
    let movedHoriz = false;
    let movedVert = false;

    const isTetrisActive = () => {
      const panel = document.getElementById('panel-game-tetris');
      return Boolean(this.isPlaying && !this.isPaused && !this.isGameOver && panel && panel.style.display !== 'none' && !panel.classList.contains('game-panel-hidden'));
    };

    const isInteractiveTarget = (target) => {
      return Boolean(target && target.closest && target.closest('button, a, .btn-secondary, .btn-play-game, #tetris-controls-hud, .tetris-side-col, .game-overlay'));
    };

    window.addEventListener('touchstart', (e) => {
      if (!isTetrisActive() || !e.touches || e.touches.length === 0) return;
      if (isInteractiveTarget(e.target)) return;

      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      lastStepX = touch.clientX;
      lastStepY = touch.clientY;
      touchStartTime = Date.now();
      movedHoriz = false;
      movedVert = false;
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!isTetrisActive() || !e.touches || e.touches.length === 0) return;
      if (isInteractiveTarget(e.target)) return;

      const touch = e.touches[0];
      const dx = touch.clientX - lastStepX;
      const dy = touch.clientY - lastStepY;

      // Horizontal column shifting (~24px per column step)
      const stepX = 24;
      if (Math.abs(dx) >= stepX) {
        if (e.cancelable) e.preventDefault();
        const steps = Math.floor(Math.abs(dx) / stepX);
        for (let i = 0; i < steps; i++) {
          if (dx > 0) this.moveRight();
          else this.moveLeft();
        }
        lastStepX += (dx > 0 ? 1 : -1) * steps * stepX;
        movedHoriz = true;
      }

      // Downward soft drop stepping (~28px per row drop)
      const stepY = 28;
      if (dy >= stepY) {
        if (e.cancelable) e.preventDefault();
        const steps = Math.floor(dy / stepY);
        for (let i = 0; i < steps; i++) {
          this.softDrop();
        }
        lastStepY += steps * stepY;
        movedVert = true;
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      if (!isTetrisActive() || !e.changedTouches || e.changedTouches.length === 0) return;
      if (isInteractiveTarget(e.target)) return;

      const touch = e.changedTouches[0];
      const totalDx = touch.clientX - touchStartX;
      const totalDy = touch.clientY - touchStartY;
      const dt = Date.now() - touchStartTime;

      // Upward Flick / Swipe: Hard Drop
      if (totalDy < -35 && Math.abs(totalDy) > Math.abs(totalDx)) {
        this.hardDrop();
        return;
      }

      // Fast downward flick: Hard Drop
      if (totalDy > 75 && dt < 220 && Math.abs(totalDy) > Math.abs(totalDx)) {
        this.hardDrop();
        return;
      }

      // Quick tap anywhere outside interactive controls: Rotate Clockwise
      if (!movedHoriz && !movedVert && Math.abs(totalDx) < 18 && Math.abs(totalDy) < 18 && dt < 280) {
        this.rotate(true);
        return;
      }

      // If finger flick was swift and didn't trigger touchmove step
      if (!movedHoriz && !movedVert) {
        if (Math.abs(totalDx) > Math.abs(totalDy) && Math.abs(totalDx) >= 20) {
          if (totalDx > 0) this.moveRight();
          else this.moveLeft();
        } else if (totalDy >= 25) {
          this.softDrop();
        }
      }
    }, { passive: true });

    window.addEventListener('resize', () => {
      this.resizeCanvases();
      if (this.isPlaying) this.render();
    });
  }

  togglePause() {
    if (!this.isPlaying || this.isGameOver) return;
    this.isPaused = !this.isPaused;
    const pauseScreen = document.getElementById('tetris-pause-screen');
    if (pauseScreen) {
      pauseScreen.style.display = this.isPaused ? 'flex' : 'none';
    }
    if (!this.isPaused) {
      this.lastTime = performance.now();
    }
  }

  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}

// Global Single Instance
window.cyberTetrisGame = new CyberTetrisGame();

// Launcher functions for games.js & HTML buttons
window.startCyberTetris = function() {
  if (window.cyberTetrisGame) {
    window.cyberTetrisGame.start();
  }
};

window.launchCyberTetris = function() {
  if (typeof window.switchTab === 'function') {
    window.switchTab('games');
  }
  if (typeof window.switchGameModeView === 'function') {
    window.switchGameModeView('tetris');
  }
};
