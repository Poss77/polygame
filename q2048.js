// ==============================================================================
// CYBER 2048 - QUANTUM MATRIX TILE MERGE PUZZLE (PLAN-013)
// ==============================================================================
// Features:
//   - 4x4 Quantum neon grid with smooth CSS sliding & scale animations
//   - Cyberpunk palette: neon cyan, purple, hot pink, gold, emerald, rainbow 2048
//   - Milestone PGT Token drops on 256, 512, 1024, and 2048 merges
//   - Keyboard (Arrow/WASD) and touch swipe gesture navigation
//   - Authoritative Supabase session settlement & Turnstile integration
//   - Web Audio API retro synthesizer chimes & merge sounds
// ==============================================================================

class Cyber2048Game {
  constructor() {
    this.size = 4;
    this.board = [];
    this.score = 0;
    this.bestScore = 0;
    this.isPlaying = false;
    this.maxTile = 2;
    this.bonusTokens = 0;
    this.milestonesAwarded = new Set();

    // Session & Anti-Cheat
    this.sessionId = null;
    this.startTime = 0;

    // Audio
    this.audioCtx = null;

    // Touch gesture tracking
    this.touchStartX = 0;
    this.touchStartY = 0;

    this.bindInputs();
  }

  // --- Audio Synthesis ---
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
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.linearRampToValueAtTime(320, now + 0.05);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
      } else if (type === 'merge') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      } else if (type === 'milestone') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.08);   // A5
        osc.frequency.setValueAtTime(1174.66, now + 0.16); // D6
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'gameover') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.linearRampToValueAtTime(90, now + 0.4);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch (e) {}
  }

  // --- Input Bindings ---
  bindInputs() {
    window.addEventListener('keydown', (e) => {
      if (!this.isPlaying) return;
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        this.move(0);
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault();
        this.move(1);
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault();
        this.move(2);
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault();
        this.move(3);
      }
    });

    // Touch Swipe Handling on the 2048 container
    const boardEl = document.getElementById('panel-game-q2048') || window;
    boardEl.addEventListener('touchstart', (e) => {
      if (!this.isPlaying || !e.touches || e.touches.length === 0) return;
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    }, { passive: true });

    boardEl.addEventListener('touchend', (e) => {
      if (!this.isPlaying || !e.changedTouches || e.changedTouches.length === 0) return;
      const dx = e.changedTouches[0].clientX - this.touchStartX;
      const dy = e.changedTouches[0].clientY - this.touchStartY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (Math.max(absX, absY) < 30) return; // Ignore small taps

      if (absX > absY) {
        if (dx > 0) this.move(1); // Right
        else this.move(3);        // Left
      } else {
        if (dy > 0) this.move(2); // Down
        else this.move(0);        // Up
      }
    }, { passive: true });
  }

  // --- Game Lifecycle ---
  async start() {
    this.initAudio();

    // Check Turnstile & Request Server Session
    let sessId = null;
    if (typeof window.startArcadeSession === 'function') {
      sessId = await window.startArcadeSession('q2048');
      if (!sessId && window.appState && window.appState.isPlayerConnected && window.appState.isPlayerConnected()) {
        return;
      }
    }
    this.sessionId = sessId;

    // Reset State
    this.board = Array(this.size).fill(null).map(() => Array(this.size).fill(0));
    this.score = 0;
    this.maxTile = 2;
    this.bonusTokens = 0;
    this.milestonesAwarded.clear();
    this.startTime = Date.now();
    this.isPlaying = true;

    // Add initial 2 tiles
    this.addRandomTile();
    this.addRandomTile();

    // UI Updates
    const startScreen = document.getElementById('q2048-start-screen');
    const gameoverScreen = document.getElementById('q2048-gameover-screen');
    if (startScreen) startScreen.style.display = 'none';
    if (gameoverScreen) gameoverScreen.style.display = 'none';

    this.render();
  }

  stop() {
    this.isPlaying = false;
  }

  // --- Board Mechanics ---
  addRandomTile() {
    const emptyCells = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] === 0) {
          emptyCells.push({ r, c });
        }
      }
    }
    if (emptyCells.length === 0) return false;
    const choice = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    // 90% chance of 2, 10% chance of 4
    this.board[choice.r][choice.c] = Math.random() < 0.9 ? 2 : 4;
    return true;
  }

  // Direction: 0: Up, 1: Right, 2: Down, 3: Left
  move(direction) {
    if (!this.isPlaying) return;

    let moved = false;
    let mergedSomething = false;

    // Rotate board to simplify logic into sliding left
    // 0: rotate 3 times (up -> left)
    // 1: rotate 2 times (right -> left)
    // 2: rotate 1 time  (down -> left)
    // 3: rotate 0 times (left is already left)
    const rotations = (4 - direction) % 4;
    for (let i = 0; i < rotations; i++) {
      this.board = this.rotateMatrix(this.board);
    }

    // Slide and merge rows left
    for (let r = 0; r < this.size; r++) {
      const originalRow = [...this.board[r]];
      const { newRow, points, merged } = this.slideAndMergeRow(this.board[r]);
      this.board[r] = newRow;
      if (points > 0) {
        this.score += points;
        mergedSomething = true;
      }
      if (!this.arraysEqual(originalRow, newRow)) {
        moved = true;
      }
    }

    // Rotate back to original orientation
    const reverseRotations = (4 - rotations) % 4;
    for (let i = 0; i < reverseRotations; i++) {
      this.board = this.rotateMatrix(this.board);
    }

    if (moved) {
      if (mergedSomething) {
        this.playSfx('merge');
      } else {
        this.playSfx('move');
      }

      this.addRandomTile();
      this.updateMaxTile();
      this.render();

      // Check for Game Over
      if (!this.canMove()) {
        this.gameOver();
      }
    }
  }

  slideAndMergeRow(row) {
    // 1. Filter out zeros
    let filtered = row.filter(val => val !== 0);
    let points = 0;
    let merged = false;

    // 2. Merge adjacent equal values
    for (let i = 0; i < filtered.length - 1; i++) {
      if (filtered[i] === filtered[i + 1]) {
        filtered[i] *= 2;
        points += filtered[i];
        filtered.splice(i + 1, 1);
        merged = true;
        this.checkMilestone(filtered[i]);
      }
    }

    // 3. Pad back with zeros to size 4
    while (filtered.length < this.size) {
      filtered.push(0);
    }

    return { newRow: filtered, points, merged };
  }

  checkMilestone(val) {
    if ([256, 512, 1024, 2048, 4096].includes(val) && !this.milestonesAwarded.has(val)) {
      this.milestonesAwarded.add(val);
      const tokenRewards = { 256: 1, 512: 2, 1024: 3, 2048: 5, 4096: 10 };
      const gain = tokenRewards[val] || 1;
      this.bonusTokens = Math.min(25, this.bonusTokens + gain);
      this.playSfx('milestone');
      if (typeof window.triggerToast === 'function') {
        window.triggerToast(`🎉 Quantum Merge: Created ${val} Tile! +${gain} Bonus PGT Token(s)`, 'success');
      }
    }
  }

  rotateMatrix(matrix) {
    const res = Array(this.size).fill(null).map(() => Array(this.size).fill(0));
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        res[c][this.size - 1 - r] = matrix[r][c];
      }
    }
    return res;
  }

  arraysEqual(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  updateMaxTile() {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] > this.maxTile) {
          this.maxTile = this.board[r][c];
        }
      }
    }
  }

  canMove() {
    // Check if any empty cell exists
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] === 0) return true;
        // Check horizontal match
        if (c < this.size - 1 && this.board[r][c] === this.board[r][c + 1]) return true;
        // Check vertical match
        if (r < this.size - 1 && this.board[r][c] === this.board[r + 1][c]) return true;
      }
    }
    return false;
  }

  // --- Rendering ---
  render() {
    const gridEl = document.getElementById('q2048-grid');
    const scoreEl = document.getElementById('q2048-score-val');
    const bestEl = document.getElementById('q2048-best-val');
    const maxTileEl = document.getElementById('q2048-maxtile-val');
    const bonusTokensEl = document.getElementById('q2048-tokens-val');

    if (scoreEl) scoreEl.innerText = this.score.toLocaleString();
    if (maxTileEl) maxTileEl.innerText = this.maxTile.toString();
    if (bonusTokensEl) bonusTokensEl.innerText = `🪙 ${this.bonusTokens}`;

    const high = (window.appState && window.appState.state) ? (window.appState.state.q2048HighScore || 0) : 0;
    if (bestEl) bestEl.innerText = Math.max(this.score, high).toLocaleString();

    if (!gridEl) return;
    gridEl.innerHTML = '';

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const val = this.board[r][c];
        const cell = document.createElement('div');
        cell.className = `q2048-tile ${val > 0 ? `q2048-tile-${val}` : 'q2048-tile-empty'}`;
        if (val > 0) {
          cell.innerText = val.toString();
          // Font scaling for large numbers
          if (val >= 1024) {
            cell.style.fontSize = '1.35rem';
          } else if (val >= 128) {
            cell.style.fontSize = '1.65rem';
          }
        }
        gridEl.appendChild(cell);
      }
    }
  }

  // --- Game Over & Settlement ---
  async gameOver() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.playSfx('gameover');

    // Daily Quest increment ("Play 3 Arcade Games")
    if (typeof window.trackQuestProgress === 'function') {
      window.trackQuestProgress('arcade', 1);
    }

    const cleanScore = Math.floor(this.score);
    const finalTokens = Math.min(25, this.bonusTokens);

    // Multipliers
    const isPlayerConnected = window.appState && typeof window.appState.isPlayerConnected === 'function' && window.appState.isPlayerConnected();
    const multis = (window.appState && typeof window.appState.getMultipliers === 'function') ? window.appState.getMultipliers() : {};
    const nftMult = Math.max(1.0, Math.min(10.0, 1 + ((multis.nftGameMultiplier || 0) / 100)));
    const relicMult = (multis && (multis.isApexUnlocked || multis.isSeason1ApexUnlocked)) ? 1.5 : 1.0;
    const isVip = window.appState && typeof window.appState.isVipActive === 'function' && window.appState.isVipActive();
    const vipMult = isVip ? 2.0 : 1.0;

    // Local Highscore check
    const prevHigh = (window.appState && window.appState.state) ? (window.appState.state.q2048HighScore || 0) : 0;
    const isNewHigh = cleanScore > prevHigh;

    if (window.appState && window.appState.state) {
      window.appState.state.q2048HighScore = Math.max(cleanScore, prevHigh);
      window.appState.state.alltimeQ2048HighScore = Math.max(cleanScore, window.appState.state.alltimeQ2048HighScore || 0);
      window.appState.save();
    }

    // Authoritative Server Session Settlement via Supabase RPC
    let verifiedPgt = 0.0;
    let isHarvestDisabled = false;
    let isDailyLimitReached = false;

    if (window.endArcadeSession && this.sessionId) {
      try {
        const res = await window.endArcadeSession(this.sessionId, cleanScore, 0, finalTokens, nftMult);
        if (res && (res.payout !== undefined || res.payout_pgt !== undefined || res.success)) {
          verifiedPgt = parseFloat(res.payout !== undefined ? res.payout : (res.payout_pgt !== undefined ? res.payout_pgt : 0));
          if (res.harvest_enabled === false) isHarvestDisabled = true;
          if (res.daily_limit_reached) isDailyLimitReached = true;
        }
      } catch (err) {
        console.warn("[Cyber2048] endArcadeSession failed:", err);
      }
    }

    // Refresh Leaderboard & Profile Scorecards
    if (typeof window.loadQ2048Leaderboard === 'function') {
      window.loadQ2048Leaderboard();
    }
    if (typeof window.syncProfileView === 'function') {
      window.syncProfileView();
    }

    // Render Game Over Overlay
    const gameoverScreen = document.getElementById('q2048-gameover-screen');
    const finalScoreEl = document.getElementById('q2048-final-score');
    const finalTileEl = document.getElementById('q2048-final-tile');
    const finalPgtEl = document.getElementById('q2048-final-pgt');
    const multBreakdownEl = document.getElementById('q2048-mult-breakdown');
    const highscoreText = document.getElementById('q2048-highscore-text');
    const limitWarning = document.getElementById('q2048-limit-warning');

    if (finalScoreEl) finalScoreEl.innerText = cleanScore.toLocaleString();
    if (finalTileEl) finalTileEl.innerText = this.maxTile.toString();

    if (finalPgtEl) {
      if (isHarvestDisabled) {
        finalPgtEl.innerHTML = `<span style="color:var(--text-dim);">Harvest Paused (Admin Setting)</span>`;
      } else if (!isPlayerConnected) {
        finalPgtEl.innerHTML = `<span style="color:var(--text-dim); font-size:1.1rem;">Connect Wallet to Earn PGT</span>`;
      } else {
        finalPgtEl.innerText = `+${verifiedPgt.toFixed(2)} PGT`;
      }
    }

    if (multBreakdownEl) {
      const activeMult = (nftMult * relicMult * vipMult).toFixed(2);
      multBreakdownEl.innerText = `NFT: ${nftMult.toFixed(2)}x • Relics: ${relicMult.toFixed(2)}x • VIP: ${vipMult.toFixed(1)}x (Total: ${activeMult}x)`;
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

    if (gameoverScreen) {
      gameoverScreen.style.removeProperty('display');
      gameoverScreen.style.display = 'flex';
    }
  }
}

// Global Single Instance
window.cyber2048 = new Cyber2048Game();
window.startCyber2048 = () => {
  if (window.cyber2048) window.cyber2048.start();
};
