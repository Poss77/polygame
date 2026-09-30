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
    this.board = []; // 22 x 10 matrix: null or color string

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
      } else if (type === 'level_up') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
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
    // Calculate cell size based on container height
    const container = document.getElementById('tetris-board-wrapper');
    if (container) {
      const availHeight = Math.min(window.innerHeight * 0.65, 540);
      this.cellSize = Math.floor(availHeight / this.rows);
      this.mainCanvas.width = this.cols * this.cellSize;
      this.mainCanvas.height = this.rows * this.cellSize;
    }
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

    // Check Turnstile & Request Server Session
    let sessId = null;
    if (typeof window.startArcadeSession === 'function') {
      sessId = await window.startArcadeSession('tetris');
      if (!sessId && window.appState && window.appState.isPlayerConnected && window.appState.isPlayerConnected()) {
        // Player canceled Turnstile challenge or failed validation
        return;
      }
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
    this.currentPiece = {
      type,
      shape,
      color: this.colors[type],
      rotation: 0
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

    // Level scales with BOTH lines cleared AND elapsed time
    // Ensures games naturally become impossible around 2:30 - 3:00 minutes
    const linesLevel = Math.floor(this.lines / 10) + 1;
    const timeLevel = Math.floor(this.elapsedSeconds / 7) + 1; // +1 level every 7 seconds
    const newLevel = Math.max(linesLevel, timeLevel);

    if (newLevel !== this.level) {
      this.level = newLevel;
      this.playSfx('level_up');
    }

    // Drop Interval Scaling:
    // Level 1: 800ms
    // Level 5 (0:35s): ~400ms
    // Level 10 (1:10m): ~180ms
    // Level 15 (1:45m): ~80ms
    // Level 20 (2:20m): ~35ms
    // Level 25+ (3:00m+): 0ms (Instant 20G Fall)
    if (this.level >= 25) {
      this.dropInterval = 0; // 20G Mode
    } else {
      this.dropInterval = Math.max(25, Math.floor(800 * Math.pow(0.86, this.level - 1)));
    }

    // Lock Delay Decays from 500ms down to 180ms
    this.lockDelay = Math.max(180, 500 - (this.level * 12));

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
          if (newY >= 0 && this.board[newY][newX] !== null) {
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
            this.board[boardY][boardX] = this.currentPiece.color;
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
        // Remove lines from board
        for (const rowIdx of fullLines) {
          this.board.splice(rowIdx, 1);
          this.board.unshift(Array(this.cols).fill(null));
        }
        this.clearingLines = [];

        // Check Perfect Clear (Board Completely Empty)
        let isPerfectClear = true;
        for (let r = this.hiddenRows; r < this.totalRows; r++) {
          for (let c = 0; c < this.cols; c++) {
            if (this.board[r][c] !== null) {
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

    // Clear background
    ctx.fillStyle = '#060a17';
    ctx.fillRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);

    // Subtle neon grid lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
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

      for (let c = 0; c < this.cols; c++) {
        const color = this.board[r][c];
        if (color) {
          if (isClearing) {
            // White neon line clear flash
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 15;
            ctx.fillRect(c * size + 1, renderY + 1, size - 2, size - 2);
            ctx.shadowBlur = 0;
          } else {
            this.drawBlock(ctx, c * size, renderY, size, color);
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
              this.drawBlock(ctx, renderX, renderY, size, this.currentPiece.color);
            }
          }
        }
      }
    }
  }

  // --- Render Neon Block Cell ---
  drawBlock(ctx, x, y, size, color) {
    ctx.save();
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
        this.drawCenteredPiece(ctx, shape, color, this.holdCanvas.width, this.holdCanvas.height, 18);
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
        this.drawCenteredPiece(ctx, shape, color, this.nextCanvas.width, previewHeight, 16);
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

    if (scoreEl) scoreEl.innerText = this.score.toLocaleString();
    if (linesEl) linesEl.innerText = this.lines.toString();
    if (levelEl) levelEl.innerText = this.level >= 25 ? '20G MAX' : this.level.toString();
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

    // Display Game Over Overlay
    const overScreen = document.getElementById('tetris-gameover-screen');
    const finalScoreEl = document.getElementById('tetris-final-score');
    const finalLinesEl = document.getElementById('tetris-final-lines');
    const finalPgtEl = document.getElementById('tetris-final-pgt');
    const highscoreText = document.getElementById('tetris-highscore-text');
    const multBreakdown = document.getElementById('tetris-mult-breakdown');
    const limitWarning = document.getElementById('tetris-limit-warning');

    if (finalScoreEl) finalScoreEl.innerText = this.score.toLocaleString();
    if (finalLinesEl) finalLinesEl.innerText = this.lines.toString();
    if (finalPgtEl) finalPgtEl.innerText = 'Settling...';
    if (highscoreText) highscoreText.style.display = 'none';
    if (limitWarning) limitWarning.style.display = 'none';
    if (overScreen) overScreen.style.display = 'flex';

    // Multipliers calculation
    let nftMult = 1.0;
    let relicMult = 1.0;
    if (window.PolyState && typeof window.PolyState.calculateTotalMultiplier === 'function') {
      const state = window.PolyState.state || {};
      const user = state.user || {};
      const allNfts = [...(user.owned_nfts || []), ...(user.crate_nfts || [])];
      let bonusPct = 0;
      if (allNfts.includes('nft_rare_shield')) bonusPct += 15;
      if (allNfts.includes('nft_pulse_blaster') || allNfts.includes('nft_hyper_drive')) bonusPct += 30;
      if (allNfts.includes('nft_epic_yield')) bonusPct += 50;
      nftMult = 1.0 + (bonusPct / 100);

      if (user.relics && user.relics['relic_s1_apex']) {
        relicMult = 1.5;
      }
    }

    let earnedPgt = 0.0;
    if (this.sessionId && typeof window.endArcadeSession === 'function') {
      try {
        const result = await window.endArcadeSession(
          this.sessionId,
          this.score,
          this.lines, // bonus_items = cleared lines
          0,
          nftMult
        );

        if (result && (result.success || result.payout !== undefined || result.payout_pgt !== undefined)) {
          earnedPgt = result.payout_pgt !== undefined ? parseFloat(result.payout_pgt) : (result.payout !== undefined ? parseFloat(result.payout) : 0.0);
          if (finalPgtEl) finalPgtEl.innerText = `+${earnedPgt.toFixed(2)} PGT`;

          if (result.is_new_high && highscoreText) {
            highscoreText.style.display = 'block';
          }
          if (result.daily_limit_reached && limitWarning) {
            limitWarning.style.display = 'block';
          }
        } else {
          if (finalPgtEl) finalPgtEl.innerText = '+0.00 PGT';
        }
      } catch (err) {
        console.error('[CyberTetris] Settlement error:', err);
        if (finalPgtEl) finalPgtEl.innerText = '+0.00 PGT';
      }
    } else {
      // Offline / guest preview calculation
      const raw = ((this.score / 2000.0) + (this.lines * 0.05));
      earnedPgt = Math.min(raw * nftMult * relicMult, 75.0);
      if (finalPgtEl) finalPgtEl.innerText = `+${earnedPgt.toFixed(2)} PGT`;
    }

    if (multBreakdown) {
      multBreakdown.innerText = `NFT: ${nftMult.toFixed(2)}x | Relic: ${relicMult.toFixed(2)}x`;
    }

    // Daily Quest & Highscore & Profile Sync
    if (typeof window.trackQuestProgress === 'function') {
      window.trackQuestProgress('arcade', 1);
    }
    if (typeof window.syncGameHighScore === 'function') {
      window.syncGameHighScore('tetris', this.score);
    }
    if (typeof window.loadTetrisLeaderboard === 'function') {
      window.loadTetrisLeaderboard();
    }
    if (typeof window.syncProfileView === 'function') {
      window.syncProfileView();
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

    // Touch Swipe Gestures on Main Canvas
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const canvas = document.getElementById('tetris-canvas');
    if (canvas) {
      canvas.addEventListener('touchstart', (e) => {
        if (!this.isPlaying || this.isPaused) return;
        const touch = e.changedTouches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
      }, { passive: true });

      canvas.addEventListener('touchend', (e) => {
        if (!this.isPlaying || this.isPaused) return;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        const dt = Date.now() - touchStartTime;

        // Quick Tap: Rotate
        if (Math.abs(dx) < 18 && Math.abs(dy) < 18 && dt < 260) {
          this.rotate(true);
          return;
        }

        // Horizontal Swipe: Move Left / Right
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 25) {
          if (dx > 0) this.moveRight();
          else this.moveLeft();
          return;
        }

        // Downward Swipe: Soft Drop or Fast Swipe Hard Drop
        if (dy > 30) {
          if (dy > 80 && dt < 220) {
            this.hardDrop();
          } else {
            this.softDrop();
          }
          return;
        }

        // Upward Swipe: Hard Drop
        if (dy < -35) {
          this.hardDrop();
          return;
        }
      }, { passive: true });
    }

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
