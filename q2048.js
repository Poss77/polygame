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
    this.coinCell = null; // { r, c, movesLeft }
    this.movesSinceCoin = 0;

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

  playSfx(type, param) {
    if (typeof window !== 'undefined' && window.sfx && window.sfx.enabled === false) return;
    if (!this.audioCtx) return;
    try {
      const now = this.audioCtx.currentTime;

      if (type === 'move') {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.linearRampToValueAtTime(300, now + 0.04);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'merge') {
        // Harmonic pitch scaling by tile value
        const val = param || 4;
        const noteFrequencies = {
          4: 261.63,   // C4
          8: 293.66,   // D4
          16: 329.63,  // E4
          32: 392.00,  // G4
          64: 440.00,  // A4
          128: 523.25, // C5
          256: 587.33, // D5
          512: 659.25, // E5
          1024: 783.99,// G5
          2048: 880.00 // A5
        };
        const baseFreq = noteFrequencies[val] || (val > 2048 ? 1046.50 : 330.0);

        if (val >= 1024) {
          // Triumphant 3-note cyber arpeggio for high-tier merges
          const notes = [baseFreq * 0.75, baseFreq, baseFreq * 1.33];
          notes.forEach((freq, idx) => {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.type = 'sine';
            const startTime = now + (idx * 0.06);
            osc.frequency.setValueAtTime(freq, startTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.5, startTime + 0.15);
            gain.gain.setValueAtTime(0.12, startTime);
            gain.gain.linearRampToValueAtTime(0.001, startTime + 0.22);
            osc.start(startTime);
            osc.stop(startTime + 0.22);
          });
        } else {
          // Resonant harmonic dual-oscillator bell chime
          const osc1 = this.audioCtx.createOscillator();
          const osc2 = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(baseFreq, now);
          osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.1);

          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(baseFreq * 2, now); // Octave overtone
          osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2.1, now + 0.08);

          gain.gain.setValueAtTime(0.12, now);
          gain.gain.linearRampToValueAtTime(0.001, now + 0.16);
          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 0.16);
          osc2.stop(now + 0.16);
        }
      } else if (type === 'combo') {
        const count = Math.min(param || 2, 5);
        const baseChirp = 480 + (count * 70);
        for (let i = 0; i < count; i++) {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.type = 'sine';
          const startTime = now + (i * 0.045);
          const f = baseChirp + (i * 90);
          osc.frequency.setValueAtTime(f, startTime);
          osc.frequency.exponentialRampToValueAtTime(f * 1.3, startTime + 0.08);
          gain.gain.setValueAtTime(0.1, startTime);
          gain.gain.linearRampToValueAtTime(0.001, startTime + 0.09);
          osc.start(startTime);
          osc.stop(startTime + 0.09);
        }
      } else if (type === 'milestone') {
        // Glorious quantum chord fanfare
        const chordNotes = [523.25, 659.25, 783.99, 1046.50]; // C5 major
        chordNotes.forEach((f, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.type = 'sine';
          const startTime = now + (idx * 0.07);
          osc.frequency.setValueAtTime(f, startTime);
          osc.frequency.exponentialRampToValueAtTime(f * 1.05, startTime + 0.4);
          gain.gain.setValueAtTime(0.14, startTime);
          gain.gain.linearRampToValueAtTime(0.001, startTime + 0.45);
          osc.start(startTime);
          osc.stop(startTime + 0.45);
        });
      } else if (type === 'coin') {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, now); // B5
        osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'coin_spawn') {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'gameover') {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
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
      const code = e.code || '';
      const key = e.key || '';
      if (code === 'ArrowUp' || key === 'ArrowUp' || code === 'KeyW' || key.toLowerCase() === 'w') {
        e.preventDefault();
        this.move(0);
      } else if (code === 'ArrowRight' || key === 'ArrowRight' || code === 'KeyD' || key.toLowerCase() === 'd') {
        e.preventDefault();
        this.move(1);
      } else if (code === 'ArrowDown' || key === 'ArrowDown' || code === 'KeyS' || key.toLowerCase() === 's') {
        e.preventDefault();
        this.move(2);
      } else if (code === 'ArrowLeft' || key === 'ArrowLeft' || code === 'KeyA' || key.toLowerCase() === 'a') {
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
    if (this.isStarting) return;
    this.isStarting = true;

    this.initAudio();

    // Check Turnstile & Request Server Session
    let sessId = null;
    try {
      if (typeof window.startArcadeSession === 'function') {
        sessId = await window.startArcadeSession('q2048');
      }
    } catch (e) {
      console.warn("[Cyber2048] startArcadeSession error:", e);
    } finally {
      this.isStarting = false;
    }
    this.sessionId = sessId;

    // Reset State
    this.board = Array(this.size).fill(null).map(() => Array(this.size).fill(0));
    this.score = 0;
    this.maxTile = 2;
    this.bonusTokens = 0;
    this.milestonesAwarded.clear();
    this.coinCell = null;
    this.movesSinceCoin = 0;
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
        // Prefer empty cells that are not holding the rare coin
        if (this.board[r][c] === 0 && !(this.coinCell && this.coinCell.r === r && this.coinCell.c === c)) {
          emptyCells.push({ r, c });
        }
      }
    }
    // Fallback if all other cells are full
    if (emptyCells.length === 0) {
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (this.board[r][c] === 0) emptyCells.push({ r, c });
        }
      }
    }
    if (emptyCells.length === 0) return null;
    const choice = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const val = Math.random() < 0.9 ? 2 : 4;
    this.board[choice.r][choice.c] = val;
    return choice;
  }

  slideAndMergeRow(row) {
    let filtered = row.filter(val => val !== 0);
    let points = 0;
    let mergesInRow = 0;
    let maxMergedVal = 0;
    let mergedIndices = [];

    for (let i = 0; i < filtered.length - 1; i++) {
      if (filtered[i] === filtered[i + 1]) {
        filtered[i] *= 2;
        points += filtered[i];
        mergesInRow++;
        maxMergedVal = Math.max(maxMergedVal, filtered[i]);
        mergedIndices.push(i);
        this.checkMilestone(filtered[i]);
        filtered.splice(i + 1, 1);
      }
    }

    while (filtered.length < this.size) {
      filtered.push(0);
    }

    return { newRow: filtered, points, mergesInRow, maxMergedVal, mergedIndices };
  }

  // Direction: 0: Up, 1: Right, 2: Down, 3: Left
  move(direction) {
    if (!this.isPlaying) return;

    let moved = false;
    let turnPoints = 0;
    let totalMerges = 0;
    let maxMergedVal = 0;
    const mergedPositions = new Set();

    if (direction === 0) {
      // UP: slide each column towards top (row 0)
      for (let c = 0; c < this.size; c++) {
        const col = [];
        for (let r = 0; r < this.size; r++) col.push(this.board[r][c]);
        const originalCol = [...col];
        const { newRow, points, mergesInRow, maxMergedVal: mmv, mergedIndices } = this.slideAndMergeRow(col);
        for (let r = 0; r < this.size; r++) {
          this.board[r][c] = newRow[r];
        }
        if (points > 0) {
          turnPoints += points;
          totalMerges += mergesInRow;
          maxMergedVal = Math.max(maxMergedVal, mmv);
          mergedIndices.forEach(idx => mergedPositions.add(`${idx},${c}`));
        }
        if (!this.arraysEqual(originalCol, newRow)) moved = true;
      }
    } else if (direction === 1) {
      // RIGHT: slide each row towards right (col 3)
      for (let r = 0; r < this.size; r++) {
        const originalRow = [...this.board[r]];
        const reversedRow = [...this.board[r]].reverse();
        const { newRow, points, mergesInRow, maxMergedVal: mmv, mergedIndices } = this.slideAndMergeRow(reversedRow);
        const unreversedRow = newRow.reverse();
        this.board[r] = unreversedRow;
        if (points > 0) {
          turnPoints += points;
          totalMerges += mergesInRow;
          maxMergedVal = Math.max(maxMergedVal, mmv);
          mergedIndices.forEach(idx => mergedPositions.add(`${r},${3 - idx}`));
        }
        if (!this.arraysEqual(originalRow, unreversedRow)) moved = true;
      }
    } else if (direction === 2) {
      // DOWN: slide each column towards bottom (row 3)
      for (let c = 0; c < this.size; c++) {
        const col = [];
        for (let r = 0; r < this.size; r++) col.push(this.board[r][c]);
        const originalCol = [...col];
        const reversedCol = [...col].reverse();
        const { newRow, points, mergesInRow, maxMergedVal: mmv, mergedIndices } = this.slideAndMergeRow(reversedCol);
        const unreversedCol = newRow.reverse();
        for (let r = 0; r < this.size; r++) {
          this.board[r][c] = unreversedCol[r];
        }
        if (points > 0) {
          turnPoints += points;
          totalMerges += mergesInRow;
          maxMergedVal = Math.max(maxMergedVal, mmv);
          mergedIndices.forEach(idx => mergedPositions.add(`${3 - idx},${c}`));
        }
        if (!this.arraysEqual(originalCol, unreversedCol)) moved = true;
      }
    } else if (direction === 3) {
      // LEFT: slide each row towards left (col 0)
      for (let r = 0; r < this.size; r++) {
        const originalRow = [...this.board[r]];
        const { newRow, points, mergesInRow, maxMergedVal: mmv, mergedIndices } = this.slideAndMergeRow(this.board[r]);
        this.board[r] = newRow;
        if (points > 0) {
          turnPoints += points;
          totalMerges += mergesInRow;
          maxMergedVal = Math.max(maxMergedVal, mmv);
          mergedIndices.forEach(idx => mergedPositions.add(`${r},${idx}`));
        }
        if (!this.arraysEqual(originalRow, newRow)) moved = true;
      }
    }

    if (moved) {
      // Check if player slid a tile into the active rare coin cell
      let coinClaimed = false;
      if (this.coinCell) {
        if (this.board[this.coinCell.r][this.coinCell.c] > 0) {
          // Tile moved into coin cell!
          coinClaimed = true;
          this.bonusTokens = Math.min(8, this.bonusTokens + 1);
          this.score += 500;
          this.playSfx('coin');
          this.triggerCoinBadge();
          if (typeof window.triggerToast === 'function') {
            window.triggerToast('🪙 Rare Harvest: Claimed 5 PGT Bonus Coin!', 'success');
          }
          this.coinCell = null;
          this.movesSinceCoin = 0;
        } else {
          this.coinCell.movesLeft--;
          if (this.coinCell.movesLeft <= 0) {
            this.coinCell = null;
            this.movesSinceCoin = 0;
          }
        }
      }

      // Cascade Combos: >= 2 merges in a single move trigger multiplier bonus & badges
      if (totalMerges >= 2) {
        const comboBonus = (totalMerges - 1) * 150;
        this.score += (turnPoints + comboBonus);
        this.playSfx('combo', totalMerges);
        this.triggerComboBadge(totalMerges, comboBonus);
      } else {
        this.score += turnPoints;
        if (totalMerges === 1) {
          this.playSfx('merge', maxMergedVal);
        } else if (!coinClaimed) {
          this.playSfx('move');
        }
      }

      const newCoord = this.addRandomTile();

      // Rare 5 PGT Bonus Coin Spawn Mechanic: every 85-110 moves (3x less frequent)
      if (!this.coinCell) {
        this.movesSinceCoin = (this.movesSinceCoin || 0) + 1;
        if (this.movesSinceCoin >= 85 && Math.random() < 0.4) {
          const emptyCells = [];
          for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
              if (this.board[r][c] === 0) emptyCells.push({ r, c });
            }
          }
          if (emptyCells.length > 0) {
            const pick = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            this.coinCell = { r: pick.r, c: pick.c, movesLeft: 8 };
            this.movesSinceCoin = 0;
            this.playSfx('coin_spawn');
            this.triggerFloatingNotice('🪙 5 PGT COIN SPAWNED!');
          }
        }
      }

      this.updateMaxTile();
      this.render(direction, mergedPositions, newCoord);

      // Check for Game Over
      if (!this.canMove()) {
        this.gameOver();
      }
    } else {
      if (!this.canMove()) {
        this.gameOver();
      } else {
        // Blocked move shake
        const boardEl = document.getElementById('container-q2048');
        if (boardEl) {
          boardEl.classList.remove('q2048-shake');
          void boardEl.offsetWidth; // Force reflow
          boardEl.classList.add('q2048-shake');
        }
      }
    }
  }

  triggerCoinBadge() {
    const boardEl = document.getElementById('container-q2048');
    if (!boardEl) return;
    const badge = document.createElement('div');
    badge.className = 'q2048-combo-badge';
    badge.style.color = '#ffd700';
    badge.style.borderColor = '#ffd700';
    badge.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.7)';
    badge.innerText = '🪙 +5 PGT BONUS COIN CLAIMED!';
    boardEl.appendChild(badge);
    setTimeout(() => {
      if (badge.parentNode) badge.parentNode.removeChild(badge);
    }, 1100);
  }

  triggerFloatingNotice(text) {
    const boardEl = document.getElementById('container-q2048');
    if (!boardEl) return;
    const badge = document.createElement('div');
    badge.className = 'q2048-combo-badge';
    badge.style.color = '#ffd700';
    badge.style.borderColor = '#ffd700';
    badge.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.5)';
    badge.innerText = text;
    boardEl.appendChild(badge);
    setTimeout(() => {
      if (badge.parentNode) badge.parentNode.removeChild(badge);
    }, 1000);
  }

  triggerComboBadge(combos, bonus) {
    const boardEl = document.getElementById('container-q2048');
    if (!boardEl) return;
    const badge = document.createElement('div');
    badge.className = 'q2048-combo-badge';
    badge.innerText = `🔥 COMBO x${combos}! +${bonus} PTS`;
    boardEl.appendChild(badge);
    setTimeout(() => {
      if (badge.parentNode) badge.parentNode.removeChild(badge);
    }, 850);
  }

  triggerMilestoneCelebration(val) {
    const boardEl = document.getElementById('container-q2048');
    if (!boardEl) return;

    // Flash glow on the board
    boardEl.classList.remove('q2048-milestone-flash');
    void boardEl.offsetWidth;
    boardEl.classList.add('q2048-milestone-flash');

    // Spawn 32 celebratory quantum neon particles radiating outwards
    const particleColors = ['#00f0ff', '#ff007f', '#ffd700', '#00ff88', '#ffffff', '#c084fc'];
    for (let i = 0; i < 32; i++) {
      const p = document.createElement('div');
      p.className = 'q2048-particle';
      const angle = (Math.PI * 2 * i) / 32 + (Math.random() * 0.3 - 0.15);
      const dist = 70 + Math.random() * 110;
      const size = 5 + Math.random() * 5;
      const color = particleColors[Math.floor(Math.random() * particleColors.length)];

      p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      p.style.setProperty('--size', `${size}px`);
      p.style.setProperty('--color', color);

      boardEl.appendChild(p);
      setTimeout(() => {
        if (p.parentNode) p.parentNode.removeChild(p);
      }, 750);
    }
  }

  checkMilestone(val) {
    if ([256, 512, 1024, 2048, 4096].includes(val) && !this.milestonesAwarded.has(val)) {
      this.milestonesAwarded.add(val);
      // Milestone rewards scaled down ~3x (11 total to 2048 -> 4 total)
      const tokenRewards = { 256: 0, 512: 1, 1024: 1, 2048: 2, 4096: 3 };
      const gain = tokenRewards[val] || 0;
      if (gain > 0) {
        this.bonusTokens = Math.min(8, this.bonusTokens + gain);
      }
      this.playSfx('milestone', val);
      if (typeof window.triggerToast === 'function') {
        const rewardText = gain > 0 ? ` +${gain} Bonus PGT Token(s)` : '';
        window.triggerToast(`🎉 Quantum Merge: Created ${val} Tile!${rewardText}`, 'success');
      }
      this.triggerMilestoneCelebration(val);
    }
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
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] === 0) return true;
        if (c < this.size - 1 && this.board[r][c] === this.board[r][c + 1]) return true;
        if (r < this.size - 1 && this.board[r][c] === this.board[r + 1][c]) return true;
      }
    }
    return false;
  }

  // --- Rendering ---
  render(direction, mergedPositions, newCoord) {
    const gridEl = document.getElementById('q2048-grid');
    const scoreEl = document.getElementById('q2048-score-val');
    const bestEl = document.getElementById('q2048-best-val');
    const maxTileEl = document.getElementById('q2048-maxtile-val');
    const bonusTokensEl = document.getElementById('q2048-tokens-val');

    if (scoreEl) scoreEl.innerText = this.score.toLocaleString();
    if (maxTileEl) maxTileEl.innerText = this.maxTile.toString();
    if (bonusTokensEl) bonusTokensEl.innerText = `🪙 ${this.bonusTokens} (${this.bonusTokens * 5} PGT)`;

    const high = (window.appState && window.appState.state) ? (window.appState.state.q2048HighScore || 0) : 0;
    if (bestEl) bestEl.innerText = Math.max(this.score, high).toLocaleString();

    if (!gridEl) return;
    gridEl.innerHTML = '';

    const shiftClasses = {
      0: 'q2048-shift-up',
      1: 'q2048-shift-right',
      2: 'q2048-shift-down',
      3: 'q2048-shift-left'
    };
    const shiftClass = direction !== undefined ? shiftClasses[direction] : '';

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const val = this.board[r][c];
        const cell = document.createElement('div');
        const posKey = `${r},${c}`;
        const isMerged = mergedPositions && mergedPositions.has(posKey);
        const isNew = newCoord && newCoord.r === r && newCoord.c === c;
        const isCoin = this.coinCell && this.coinCell.r === r && this.coinCell.c === c && val === 0;

        let extraClass = '';
        if (isMerged) {
          extraClass = ' q2048-tile-merged';
        } else if (isNew) {
          extraClass = ' q2048-tile-new';
        } else if (shiftClass && val > 0) {
          extraClass = ` ${shiftClass}`;
        }

        if (isCoin) {
          cell.className = 'q2048-tile q2048-coin-cell';
          cell.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; pointer-events:none;">
              <span style="font-size:1.6rem; line-height:1; filter:drop-shadow(0 0 8px #ffd700);">🪙</span>
              <span style="font-size:0.75rem; font-weight:900; color:#ffd700; text-shadow:0 0 6px #000; margin-top:2px;">5 PGT</span>
              <span style="font-size:0.6rem; color:#fff; opacity:0.85;">${this.coinCell.movesLeft} moves</span>
            </div>
          `;
        } else {
          cell.className = `q2048-tile ${val > 0 ? `q2048-tile-${val}` : 'q2048-tile-empty'}${extraClass}`;
          if (val > 0) {
            cell.innerText = val.toString();
            this.styleTileFont(cell, val);
          }
        }
        gridEl.appendChild(cell);
      }
    }
  }

  styleTileFont(el, val) {
    if (val >= 16384) {
      el.style.fontSize = '1.15rem';
    } else if (val >= 1024) {
      el.style.fontSize = '1.35rem';
    } else if (val >= 128) {
      el.style.fontSize = '1.65rem';
    } else {
      el.style.fontSize = '1.85rem';
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
    const finalTokens = Math.min(8, this.bonusTokens);

    // Multipliers
    const isPlayerConnected = window.appState && typeof window.appState.isPlayerConnected === 'function' && window.appState.isPlayerConnected();
    const multis = (window.appState && typeof window.appState.getMultipliers === 'function') ? window.appState.getMultipliers() : {};
    const nftPct = multis ? (multis.nftGameMultiplier || 0) : 0;
    const nftMult = Math.max(1.0, Math.min(10.0, 1 + (nftPct / 100)));
    const isApex = !!(multis && (multis.isApexUnlocked || multis.isSeason1ApexUnlocked));
    const relicMult = isApex ? 1.5 : 1.0;
    const isVip = window.appState && typeof window.appState.isVipActive === 'function' && window.appState.isVipActive();
    const vipMult = isVip ? 2.0 : 1.0;
    const isAmb = !!(window.appState && window.appState.state && window.appState.state.isAmbassador);
    const ambMult = isAmb ? 2.0 : 1.0;
    const playerMult = nftMult * relicMult * vipMult * ambMult;

    const globalEarnMult = (window.appState && window.appState.state && (window.appState.state.globalEarnMultiplier !== undefined || window.appState.state.globalArcadeEarnMultiplier !== undefined))
      ? Number(window.appState.state.globalEarnMultiplier !== undefined ? window.appState.state.globalEarnMultiplier : window.appState.state.globalArcadeEarnMultiplier)
      : 1.0;

    // Strict 75.00 PGT Base Cap (2.5x Earn - 2x reduction from 5x)
    const rawBase = Math.min(75.0, (((cleanScore / 2500.0) + (finalTokens * 0.5)) * 2.5) * globalEarnMult);
    const tokenPgt = finalTokens * 5.0;
    const calculatedPgt = parseFloat((rawBase * playerMult).toFixed(2));
    const finalPgt = cleanScore > 0 ? Math.min(1000.0, Math.max(0.01, parseFloat((calculatedPgt + tokenPgt).toFixed(2)))) : 0;

    // Local Highscore check
    const prevHigh = (window.appState && window.appState.state) ? (window.appState.state.q2048HighScore || 0) : 0;
    const isNewHigh = cleanScore > prevHigh;

    if (window.appState && window.appState.state) {
      window.appState.state.q2048HighScore = Math.max(cleanScore, prevHigh);
      window.appState.state.alltimeQ2048HighScore = Math.max(cleanScore, window.appState.state.alltimeQ2048HighScore || 0);
      window.appState.save();
    }

    // Authoritative Server Session Settlement via Supabase RPC
    let verifiedPgt = this.sessionId ? finalPgt : (isPlayerConnected ? 0.0 : finalPgt);
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
    const finalTokensEl = document.getElementById('q2048-final-tokens');
    const finalPgtEl = document.getElementById('q2048-final-pgt');
    const multBreakdownEl = document.getElementById('q2048-mult-breakdown');
    const highscoreText = document.getElementById('q2048-highscore-text');
    const limitWarning = document.getElementById('q2048-limit-warning');

    if (finalScoreEl) finalScoreEl.innerText = cleanScore.toLocaleString();
    if (finalTileEl) finalTileEl.innerText = this.maxTile.toString();
    if (finalTokensEl) finalTokensEl.innerText = `${finalTokens} (${finalTokens * 5} PGT)`;

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

    const vipBadgeStr = (isVip ? ' 🔥 <span style="color:var(--color-warning); font-size:0.8rem;">(VIP 2.0x)</span>' : '') + 
      (isAmb ? ' 🎖️ <span style="color:var(--color-warning); font-size:0.8rem;">(Amb 2.0x)</span>' : '') +
      (isApex ? ' 🏺 <span style="color:#ffd700; font-size:0.8rem;">(Relics 1.5x)</span>' : '');

    if (multBreakdownEl) {
      const globalLabel = (globalEarnMult !== 1.0) ? ` <span style="color:var(--color-accent); font-size:0.75rem;">(${globalEarnMult}x Global)</span>` : '';
      multBreakdownEl.innerHTML = `Base: <strong style="color:#fff;">${verifiedBase.toFixed(2)} PGT</strong>${globalLabel} • Multiplier: <strong style="color:var(--color-secondary);">${playerMult.toFixed(1)}x</strong> (${nftPct}% NFT${vipBadgeStr})`;
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
