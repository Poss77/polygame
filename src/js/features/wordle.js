// ============================================================
// POLYGAME: CYBER WORDLE (PLAN-020)
// 5-Letter Cryptographic Cipher Daily Logic Game
// ============================================================

import { appState } from '../core/state.js';
import { executeAuthenticatedRpc } from '../core/auth-web3.js';
import { triggerToast, openModal, closeModal } from '../core/ui.js';
import { sfx } from '../core/audio.js';
import { triggerConfetti } from '../utils/confetti.js';
import { WORDLE_VALID_WORDS } from './wordle-words.js';
import { refreshDailyGamesHubStatus } from './daily-hub.js';

let currentGuess = '';
let currentRow = 0;
let isGameOver = false;
let isGameWon = false;
let winAttemptCount = 0;
let isSubmitting = false;
let boardGuesses = []; // [{ word, colors }]
let targetWordRevealed = '';
let keyListenersAttached = false;
let pgtWonToday = 0;

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK']
];

/**
 * Initializes or restores Wordle game
 */
export async function initWordleGame() {
  currentGuess = '';
  currentRow = 0;
  isGameOver = false;
  isGameWon = false;
  winAttemptCount = 0;
  isSubmitting = false;
  boardGuesses = [];
  targetWordRevealed = '';
  pgtWonToday = 0;

  renderWordleBoard();
  renderWordleKeyboard();
  hidePostgameCard();
  attachKeyListeners();

  // Restore existing progress or solved state for today
  await syncWordleServerState();
}

/**
 * Renders the initial empty 5x6 grid
 */
function renderWordleBoard() {
  const gridEl = document.getElementById('wordle-grid');
  if (!gridEl) return;

  gridEl.innerHTML = '';
  for (let r = 0; r < 6; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'wordle-row';
    rowEl.id = `wordle-row-${r}`;

    for (let c = 0; c < 5; c++) {
      const tileEl = document.createElement('div');
      tileEl.className = 'wordle-tile';
      tileEl.id = `wordle-tile-${r}-${c}`;
      rowEl.appendChild(tileEl);
    }
    gridEl.appendChild(rowEl);
  }
}

/**
 * Renders the virtual on-screen QWERTY keyboard
 */
function renderWordleKeyboard() {
  const kbEl = document.getElementById('wordle-keyboard');
  if (!kbEl) return;

  kbEl.innerHTML = '';
  KEYBOARD_ROWS.forEach(row => {
    const rowEl = document.createElement('div');
    rowEl.className = 'wordle-kb-row';

    row.forEach(key => {
      const keyBtn = document.createElement('button');
      keyBtn.type = 'button';
      keyBtn.className = 'wordle-key';
      keyBtn.id = `wordle-key-${key}`;

      if (key === 'ENTER') {
        keyBtn.classList.add('wide');
        keyBtn.innerText = 'ENTER';
        keyBtn.onclick = () => submitCurrentGuess();
      } else if (key === 'BACK') {
        keyBtn.classList.add('wide');
        keyBtn.innerText = '⌫';
        keyBtn.onclick = () => handleBackspace();
      } else {
        keyBtn.innerText = key;
        keyBtn.onclick = () => handleLetterInput(key);
      }
      rowEl.appendChild(keyBtn);
    });
    kbEl.appendChild(rowEl);
  });
}

/**
 * Attaches physical keyboard listener
 */
function attachKeyListeners() {
  if (keyListenersAttached) return;
  keyListenersAttached = true;

  window.addEventListener('keydown', e => {
    const wordlePanel = document.getElementById('panel-game-wordle');
    if (!wordlePanel || wordlePanel.style.display === 'none') return;

    if (e.key === 'Enter') {
      e.preventDefault();
      submitCurrentGuess();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      handleLetterInput(e.key.toUpperCase());
    }
  });
}

function handleLetterInput(letter) {
  if (isGameOver || isSubmitting) return;
  if (currentGuess.length >= 5) return;

  currentGuess += letter;
  updateCurrentRowTiles();
}

function handleBackspace() {
  if (isGameOver || isSubmitting) return;
  if (currentGuess.length === 0) return;

  currentGuess = currentGuess.slice(0, -1);
  updateCurrentRowTiles();
}

function updateCurrentRowTiles() {
  for (let c = 0; c < 5; c++) {
    const tile = document.getElementById(`wordle-tile-${currentRow}-${c}`);
    if (tile) {
      const char = currentGuess[c] || '';
      tile.innerText = char;
      if (char) {
        tile.classList.add('pop');
        setTimeout(() => tile.classList.remove('pop'), 120);
      }
    }
  }
}

/**
 * Validates and submits the 5-letter guess
 */
async function submitCurrentGuess() {
  if (isGameOver || isSubmitting) return;

  if (currentGuess.length < 5) {
    if (triggerToast) triggerToast('Enter a 5-letter word!', 'warning');
    shakeCurrentRow();
    return;
  }

  const guessUpper = currentGuess.toUpperCase();

  // Local dictionary validation for fast feedback
  if (!WORDLE_VALID_WORDS.has(guessUpper)) {
    if (triggerToast) triggerToast(`"${guessUpper}" is not in the valid word list!`, 'warning');
    shakeCurrentRow();
    return;
  }

  const pid = (appState && typeof appState.getPlayerId === 'function' && appState.getPlayerId()) ||
              (appState && appState.state && appState.state.playerId) || '';

  if (!pid) {
    if (triggerToast) triggerToast('Please connect your account to play!', 'error');
    return;
  }

  isSubmitting = true;

  try {
    const { data: res, error } = await executeAuthenticatedRpc('submit_wordle_guess', {
      p_player_id: pid,
      p_guess: guessUpper
    });

    if (error || !res || !res.success) {
      if (triggerToast) triggerToast(res?.message || error?.message || 'Error submitting guess', 'error');
      shakeCurrentRow();
      isSubmitting = false;
      return;
    }

    const colors = res.colors || ['gray', 'gray', 'gray', 'gray', 'gray'];
    boardGuesses.push({ word: guessUpper, colors });

    // Animate row tile colors
    await animateRowEvaluation(currentRow, colors);
    updateKeyboardColors(guessUpper, colors);

    if (res.solved) {
      // Victory!
      isGameOver = true;
      isGameWon = true;
      winAttemptCount = boardGuesses.length;
      targetWordRevealed = res.target_word || guessUpper;
      pgtWonToday = res.pgt_awarded || 0;

      if (res.new_balance !== undefined && appState) {
        appState.update({ balancePgt: parseFloat(res.new_balance) });
        if (typeof appState.syncUI === 'function') appState.syncUI();
      }

      if (sfx && typeof sfx.playPowerUp === 'function') sfx.playPowerUp();
      triggerConfetti();

      showPostgameCard(true, pgtWonToday, targetWordRevealed);
      if (triggerToast) triggerToast(`🎉 Decrypted in ${currentRow + 1} ${currentRow === 0 ? 'try' : 'tries'}! +${pgtWonToday} PGT won!`, 'success');
      if (typeof window.trackQuestProgress === 'function') window.trackQuestProgress('games', 1);
      refreshDailyGamesHubStatus(true);

    } else if (res.failed || res.guesses_count >= 6) {
      // Defeat!
      isGameOver = true;
      isGameWon = false;
      winAttemptCount = 0;
      targetWordRevealed = res.target_word || '';
      showPostgameCard(false, 0, targetWordRevealed);
      if (triggerToast) triggerToast(`Cipher lock engaged. Secret was: ${targetWordRevealed}`, 'error');
      refreshDailyGamesHubStatus(true);

    } else {
      // Advance to next row
      currentRow++;
      currentGuess = '';
      updateAttemptBadge(currentRow + 1);
    }
  } catch (err) {
    console.error('[Wordle] Submission exception:', err);
    if (triggerToast) triggerToast('Network exception while submitting guess.', 'error');
  } finally {
    isSubmitting = false;
  }
}

/**
 * Animates tiles flipping row by row with colors
 */
function animateRowEvaluation(rowIdx, colors) {
  return new Promise(resolve => {
    colors.forEach((color, colIdx) => {
      setTimeout(() => {
        const tile = document.getElementById(`wordle-tile-${rowIdx}-${colIdx}`);
        if (tile) {
          tile.classList.add(color);
        }
        if (colIdx === 4) {
          setTimeout(resolve, 350);
        }
      }, colIdx * 150);
    });
  });
}

function updateKeyboardColors(word, colors) {
  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    const color = colors[i];
    const keyBtn = document.getElementById(`wordle-key-${char}`);
    if (!keyBtn) continue;

    if (color === 'green') {
      keyBtn.classList.remove('yellow', 'gray');
      keyBtn.classList.add('green');
    } else if (color === 'yellow' && !keyBtn.classList.contains('green')) {
      keyBtn.classList.remove('gray');
      keyBtn.classList.add('yellow');
    } else if (color === 'gray' && !keyBtn.classList.contains('green') && !keyBtn.classList.contains('yellow')) {
      keyBtn.classList.add('gray');
    }
  }
}

function shakeCurrentRow() {
  const row = document.getElementById(`wordle-row-${currentRow}`);
  if (row) {
    row.style.animation = 'shakeCell 0.3s ease';
    setTimeout(() => { row.style.animation = ''; }, 350);
  }
}

function updateAttemptBadge(row) {
  const badge = document.getElementById('wordle-attempt-badge');
  if (badge) {
    badge.innerText = `Row ${Math.min(6, row)} / 6`;
  }
}

/**
 * Synchronizes with Supabase on page load or return
 */
async function syncWordleServerState() {
  const pid = (appState && typeof appState.getPlayerId === 'function' && appState.getPlayerId()) ||
              (appState && appState.state && appState.state.playerId) || '';
  if (!pid) return;

  try {
    const { data: res, error } = await executeAuthenticatedRpc('get_daily_games_hub_status', {
      p_player_id: pid
    });

    if (error || !res || !res.success || !res.wordle) return;

    const w = res.wordle;
    if (w.guesses && Array.isArray(w.guesses) && w.guesses.length > 0) {
      boardGuesses = [];
      w.guesses.forEach((g, r) => {
        boardGuesses.push(g);
        for (let c = 0; c < 5; c++) {
          const tile = document.getElementById(`wordle-tile-${r}-${c}`);
          if (tile) {
            tile.innerText = g.word[c] || '';
            tile.classList.add(g.colors[c]);
          }
        }
        updateKeyboardColors(g.word, g.colors);
      });

      currentRow = w.guesses.length;
      updateAttemptBadge(currentRow + 1);
    }

    if (w.is_solved || w.claimed) {
      isGameOver = true;
      isGameWon = true;
      winAttemptCount = (w.guesses && w.guesses.length) || (w.guesses_count) || 1;
      pgtWonToday = w.pgt_awarded || 0;
      showPostgameCard(true, pgtWonToday, '');
    } else if (w.is_failed) {
      isGameOver = true;
      isGameWon = false;
      winAttemptCount = 0;
      showPostgameCard(false, 0, '');
    }
  } catch (err) {
    console.warn('[Wordle] Server sync error:', err);
  }
}

function showPostgameCard(isWin, pgt, secretWord) {
  const card = document.getElementById('wordle-postgame-card');
  const title = document.getElementById('wordle-postgame-title');
  const payout = document.getElementById('wordle-postgame-payout');
  const wordEl = document.getElementById('wordle-postgame-word');
  if (!card) return;

  card.style.display = 'block';
  if (isWin) {
    card.style.borderColor = 'var(--color-success)';
    if (title) title.innerHTML = '🎉 CIPHER DECRYPTED!';
    if (payout) payout.innerText = `+${pgt} PGT Awarded to Balance`;
    if (wordEl) wordEl.innerText = secretWord ? `Secret Target: ${secretWord}` : 'Daily challenge completed for today.';
  } else {
    card.style.borderColor = 'var(--color-danger)';
    if (title) title.innerHTML = '❌ CIPHER LOCKED';
    if (payout) payout.innerText = '0 PGT Earned (Better luck tomorrow!)';
    if (wordEl) wordEl.innerText = secretWord ? `The secret word was: ${secretWord}` : '';
  }
}

function hidePostgameCard() {
  const card = document.getElementById('wordle-postgame-card');
  if (card) card.style.display = 'none';
}

/**
 * Opens Wordle Statistics Modal
 */
export async function openWordleStatsModal() {
  openModal('wordle-stats');

  const pid = (appState && typeof appState.getPlayerId === 'function' && appState.getPlayerId()) ||
              (appState && appState.state && appState.state.playerId) || '';
  if (!pid) return;

  try {
    const { data: res } = await executeAuthenticatedRpc('get_daily_games_hub_status', { p_player_id: pid });
    if (!res || !res.wordle || !res.wordle.stats) return;

    const s = res.wordle.stats;
    const played = s.played || 0;
    const wins = s.wins || 0;
    const winPct = played > 0 ? Math.round((wins / played) * 100) : 0;

    const elPlayed = document.getElementById('wordle-stat-played');
    const elWinPct = document.getElementById('wordle-stat-winpct');
    const elStreak = document.getElementById('wordle-stat-streak');
    const elMaxStreak = document.getElementById('wordle-stat-maxstreak');

    if (elPlayed) elPlayed.innerText = played;
    if (elWinPct) elWinPct.innerText = `${winPct}%`;
    if (elStreak) elStreak.innerText = s.streak || 0;
    if (elMaxStreak) elMaxStreak.innerText = s.max_streak || 0;

    // Render Histogram
    const distContainer = document.getElementById('wordle-dist-container');
    if (distContainer && Array.isArray(s.dist)) {
      const maxCount = Math.max(1, ...s.dist);
      distContainer.innerHTML = '';

      // Highlight winning attempt if the puzzle was solved today
      const currentWinningAttempt = (isGameOver && isGameWon) ? (winAttemptCount || boardGuesses.length) : null;

      s.dist.forEach((count, idx) => {
        const rowNum = idx + 1;
        const pct = count > 0 ? Math.max(8, Math.round((count / maxCount) * 100)) : 8;
        const isCurrentWinRow = (currentWinningAttempt === rowNum);

        let barBg;
        let textColor;
        if (count > 0) {
          if (isCurrentWinRow) {
            barBg = 'var(--color-success, #00ff66)';
            textColor = '#000';
          } else {
            barBg = 'var(--color-primary, #00f0ff)';
            textColor = '#000';
          }
        } else {
          barBg = 'rgba(255, 255, 255, 0.08)';
          textColor = 'var(--text-dim, #94a3b8)';
        }

        const rowDiv = document.createElement('div');
        rowDiv.style.display = 'flex';
        rowDiv.style.alignItems = 'center';
        rowDiv.style.gap = '8px';
        rowDiv.style.fontSize = '0.85rem';

        rowDiv.innerHTML = `
          <span style="width: 14px; font-weight: 800; color: var(--text-dim);">${rowNum}</span>
          <div style="flex: 1; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; height: 22px;">
            <div style="width: ${pct}%; height: 100%; background: ${barBg}; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; font-weight: 800; font-size: 0.75rem; color: ${textColor}; border-radius: 4px; transition: width 0.3s ease;">
              ${count}
            </div>
          </div>
        `;
        distContainer.appendChild(rowDiv);
      });
    }
  } catch (err) {
    console.warn('[WordleStats] Error fetching stats:', err);
  }
}

/**
 * Generates spoiler-free emoji share text
 */
export function shareWordleResult(platform = 'twitter') {
  if (boardGuesses.length === 0) {
    if (triggerToast) triggerToast('Complete a Wordle puzzle first!', 'info');
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const isWon = isGameOver && boardGuesses[boardGuesses.length - 1].colors.every(c => c === 'green');
  const rowCount = isWon ? `${boardGuesses.length}/6` : 'X/6';

  let emojiGrid = '';
  boardGuesses.forEach(g => {
    g.colors.forEach(c => {
      if (c === 'green') emojiGrid += '🟩';
      else if (c === 'yellow') emojiGrid += '🟨';
      else emojiGrid += '⬛';
    });
    emojiGrid += '\n';
  });

  const refCode = (appState && appState.state && appState.state.referralCode) ||
                  (window.PolyState && window.PolyState.state && window.PolyState.state.referralCode) ||
                  (appState && appState.state && appState.state.user && appState.state.user.referral_code) ||
                  '';
  const refInput = document.getElementById('ref-invite-link');
  let playUrl = 'https://polygongaming.io/';
  if (refInput && refInput.value && refInput.value.includes('?ref=')) {
    playUrl = refInput.value.trim();
  } else if (refCode && refCode !== 'EMPTY') {
    playUrl = `https://polygongaming.io/?ref=${encodeURIComponent(refCode.trim())}`;
  }

  const earnNote = pgtWonToday > 0 ? `+${pgtWonToday} $PGT Won! ⚡` : 'Daily Cyber Cipher';
  const shareText = `PolyGame Cyber Wordle (${todayStr})\nRow ${rowCount} • ${earnNote}\n\n${emojiGrid}\nPlay free & earn: ${playUrl}\n#CyberWordle #PolygonGaming #Web3`;

  if (platform === 'twitter') {
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(tweetUrl, 'Share Wordle on X', 'width=560,height=440,scrollbars=yes,resizable=yes');
  } else if (platform === 'telegram') {
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(playUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(tgUrl, 'Share Wordle on Telegram', 'width=560,height=440,scrollbars=yes,resizable=yes');
  } else {
    navigator.clipboard.writeText(shareText).then(() => {
      if (triggerToast) triggerToast('📋 Results copied to clipboard with referral link!', 'success');
    }).catch(() => {
      if (triggerToast) triggerToast('Unable to copy to clipboard', 'error');
    });
  }
}

// Window globals
if (typeof window !== 'undefined') {
  window.initWordleGame = initWordleGame;
  window.openWordleStatsModal = openWordleStatsModal;
  window.shareWordleResult = shareWordleResult;
}
