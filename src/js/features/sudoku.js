// ============================================================
// POLYGAME: CYBER SUDOKU (PLAN-020)
// 1 Daily Puzzle per 24h Cycle with Difficulty Choice
// ============================================================

import { appState } from '../core/state.js';
import { executeAuthenticatedRpc } from '../core/auth-web3.js';
import { triggerToast, openModal, closeModal } from '../core/ui.js';
import { sfx } from '../core/audio.js';
import { triggerConfetti } from '../utils/confetti.js';
import { refreshDailyGamesHubStatus } from './daily-hub.js';

let activeDifficulty = 'medium';
let cluesMask = ''; // 81 chars ('0'-'9')
let playerBoard = new Array(81).fill(0);
let notesBoard = Array.from({ length: 81 }, () => new Set());
let selectedCellIndex = null;
let isNotesMode = false;
let mistakes = 0;
let timerSeconds = 0;
let timerInterval = null;
let isGameCompleted = false;
let isSubmitting = false;
let moveHistory = []; // [{ index, prevVal, newVal, prevNotes }]
let keyListenersAttached = false;

/**
 * Initializes Sudoku screen when user navigates to the game
 */
export async function initSudokuGame() {
  attachSudokuKeyListeners();
  await checkDailySudokuStatus();
}

/**
 * Checks if the player already started or completed today's Sudoku
 */
async function checkDailySudokuStatus() {
  const pid = (appState && typeof appState.getPlayerId === 'function' && appState.getPlayerId()) ||
              (appState && appState.state && appState.state.playerId) || '';
  if (!pid) return;

  try {
    const { data: res, error } = await executeAuthenticatedRpc('get_daily_games_hub_status', { p_player_id: pid });
    if (error || !res || !res.success || !res.sudoku) return;

    const s = res.sudoku;
    if (s.is_completed) {
      // Show completed board view
      showSudokuPostgameCard(true, s.pgt_awarded || 0, s.difficulty || 'medium');
      showPlayScreen();
    } else if (s.difficulty) {
      // In progress session: resume puzzle
      await startDailySudokuGame(s.difficulty);
    } else {
      // Show difficulty selection screen
      showDifficultyScreen();
    }
  } catch (err) {
    console.warn('[Sudoku] Status check exception:', err);
    showDifficultyScreen();
  }
}

/**
 * Starts or resumes a Sudoku game for the chosen difficulty
 */
export async function startDailySudokuGame(difficulty) {
  const pid = (appState && typeof appState.getPlayerId === 'function' && appState.getPlayerId()) ||
              (appState && appState.state && appState.state.playerId) || '';

  if (!pid) {
    if (triggerToast) triggerToast('Please connect your account to play!', 'error');
    return;
  }

  activeDifficulty = difficulty || 'medium';

  try {
    const { data: res, error } = await executeAuthenticatedRpc('start_daily_sudoku', {
      p_player_id: pid,
      p_difficulty: activeDifficulty
    });

    if (error || !res || !res.success) {
      if (triggerToast) triggerToast(res?.message || error?.message || 'Error starting Sudoku', 'error');
      return;
    }

    cluesMask = res.clues_mask || '';
    mistakes = res.mistakes || 0;
    isGameCompleted = false;
    moveHistory = [];
    selectedCellIndex = null;
    isNotesMode = false;

    // Initialize player board from clues
    playerBoard = new Array(81).fill(0);
    notesBoard = Array.from({ length: 81 }, () => new Set());
    for (let i = 0; i < 81; i++) {
      const char = cluesMask[i] || '0';
      if (char !== '0' && char !== '.') {
        playerBoard[i] = parseInt(char, 10);
      }
    }

    // Try to restore saved draft from localStorage
    restoreLocalDraft();

    showPlayScreen();
    updateSudokuHud();
    renderSudokuGrid();
    startSudokuTimer();

  } catch (err) {
    console.error('[Sudoku] Start exception:', err);
    if (triggerToast) triggerToast('Network exception while starting puzzle', 'error');
  }
}

/**
 * Renders the 9x9 Sudoku Grid DOM
 */
function renderSudokuGrid() {
  const gridEl = document.getElementById('sudoku-grid');
  if (!gridEl) return;

  gridEl.innerHTML = '';

  for (let i = 0; i < 81; i++) {
    const cellEl = document.createElement('div');
    cellEl.className = 'sudoku-cell';
    cellEl.id = `sudoku-cell-${i}`;

    const isClue = (cluesMask[i] !== '0' && cluesMask[i] !== '.' && cluesMask[i] !== undefined);
    const val = playerBoard[i];

    if (isClue) {
      cellEl.classList.add('clue');
      cellEl.innerText = val;
    } else if (val > 0) {
      cellEl.innerText = val;
    } else {
      // Render candidate notes if present
      const notes = notesBoard[i];
      if (notes && notes.size > 0) {
        const notesDiv = document.createElement('div');
        notesDiv.className = 'sudoku-notes';
        for (let n = 1; n <= 9; n++) {
          const numSpan = document.createElement('span');
          numSpan.className = 'sudoku-note-num';
          numSpan.innerText = notes.has(n) ? n : '';
          notesDiv.appendChild(numSpan);
        }
        cellEl.appendChild(notesDiv);
      }
    }

    cellEl.onclick = () => selectSudokuCell(i);
    gridEl.appendChild(cellEl);
  }

  highlightRelatedCells();
}

/**
 * Handles cell selection & crosshair highlight
 */
function selectSudokuCell(index) {
  if (isGameCompleted) return;
  selectedCellIndex = index;
  highlightRelatedCells();
}

function highlightRelatedCells() {
  for (let i = 0; i < 81; i++) {
    const cell = document.getElementById(`sudoku-cell-${i}`);
    if (!cell) continue;

    cell.classList.remove('selected', 'crosshair', 'same-num');

    if (selectedCellIndex === null) continue;

    const selRow = Math.floor(selectedCellIndex / 9);
    const selCol = selectedCellIndex % 9;
    const selBoxRow = Math.floor(selRow / 3) * 3;
    const selBoxCol = Math.floor(selCol / 3) * 3;

    const curRow = Math.floor(i / 9);
    const curCol = i % 9;
    const curBoxRow = Math.floor(curRow / 3) * 3;
    const curBoxCol = Math.floor(curCol / 3) * 3;

    if (i === selectedCellIndex) {
      cell.classList.add('selected');
    } else if (curRow === selRow || curCol === selCol || (curBoxRow === selBoxRow && curBoxCol === selBoxCol)) {
      cell.classList.add('crosshair');
    }

    // Highlight cells with identical number
    const selVal = playerBoard[selectedCellIndex];
    if (selVal > 0 && playerBoard[i] === selVal) {
      cell.classList.add('same-num');
    }
  }
}

/**
 * Inputs a number (1-9) into the currently selected cell
 */
export function inputSudokuNumber(num) {
  if (isGameCompleted || selectedCellIndex === null) return;

  // Cannot modify pre-filled clues
  if (cluesMask[selectedCellIndex] !== '0' && cluesMask[selectedCellIndex] !== '.' && cluesMask[selectedCellIndex] !== undefined) {
    return;
  }

  if (isNotesMode) {
    // Toggle pencil note
    const notes = notesBoard[selectedCellIndex];
    if (notes.has(num)) {
      notes.delete(num);
    } else {
      notes.add(num);
    }
    renderSudokuGrid();
    saveLocalDraft();
    return;
  }

  // Normal mode: check for logical conflict
  const hasConflict = checkCellConflict(selectedCellIndex, num);

  if (hasConflict) {
    mistakes++;
    updateSudokuHud();
    flashCellError(selectedCellIndex);

    if (sfx && typeof sfx.playBuzzer === 'function') sfx.playBuzzer();

    if (mistakes >= 4) {
      // Game over (max 3 mistakes exceeded)
      terminateSudokuGame();
      return;
    }
    if (triggerToast) triggerToast(`Mistake! (${mistakes}/3) Conflicts with row, column, or block.`, 'error');
    return;
  }

  // Record undo state
  moveHistory.push({
    index: selectedCellIndex,
    prevVal: playerBoard[selectedCellIndex],
    newVal: num,
    prevNotes: new Set(notesBoard[selectedCellIndex])
  });

  playerBoard[selectedCellIndex] = num;
  notesBoard[selectedCellIndex].clear(); // Clear notes upon commit

  if (sfx && typeof sfx.playSelect === 'function') sfx.playSelect();

  renderSudokuGrid();
  saveLocalDraft();

  // Check if puzzle is fully solved (all 81 cells non-zero)
  if (playerBoard.every(v => v > 0)) {
    submitSudokuSolution();
  }
}

/**
 * Real-time conflict checker against row, column, and 3x3 block
 */
function checkCellConflict(index, num) {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;

  for (let i = 0; i < 81; i++) {
    if (i === index) continue;
    if (playerBoard[i] !== num) continue;

    const r = Math.floor(i / 9);
    const c = i % 9;
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;

    if (r === row || c === col || (br === boxRow && bc === boxCol)) {
      return true;
    }
  }
  return false;
}

function flashCellError(index) {
  const cell = document.getElementById(`sudoku-cell-${index}`);
  if (cell) {
    cell.classList.add('error');
    setTimeout(() => cell.classList.remove('error'), 400);
  }
}

/**
 * Erases current cell entry or notes
 */
export function eraseSudokuCell() {
  if (isGameCompleted || selectedCellIndex === null) return;
  if (cluesMask[selectedCellIndex] !== '0' && cluesMask[selectedCellIndex] !== '.') return;

  moveHistory.push({
    index: selectedCellIndex,
    prevVal: playerBoard[selectedCellIndex],
    newVal: 0,
    prevNotes: new Set(notesBoard[selectedCellIndex])
  });

  playerBoard[selectedCellIndex] = 0;
  notesBoard[selectedCellIndex].clear();

  renderSudokuGrid();
  saveLocalDraft();
}

/**
 * Undo last player move
 */
export function undoSudokuMove() {
  if (isGameCompleted || moveHistory.length === 0) return;

  const lastMove = moveHistory.pop();
  playerBoard[lastMove.index] = lastMove.prevVal;
  notesBoard[lastMove.index] = new Set(lastMove.prevNotes);
  selectedCellIndex = lastMove.index;

  renderSudokuGrid();
  saveLocalDraft();
}

/**
 * Toggle Pencil Notes mode
 */
export function toggleSudokuNotes() {
  isNotesMode = !isNotesMode;
  const btn = document.getElementById('btn-sudoku-notes');
  const label = document.getElementById('label-sudoku-notes');
  if (btn) btn.classList.toggle('active', isNotesMode);
  if (label) label.innerText = isNotesMode ? 'Notes: ON' : 'Notes: OFF';
}

/**
 * Submits the fully solved Sudoku board to Supabase RPC
 */
async function submitSudokuSolution() {
  if (isSubmitting || isGameCompleted) return;
  isSubmitting = true;
  stopSudokuTimer();

  const pid = (appState && typeof appState.getPlayerId === 'function' && appState.getPlayerId()) ||
              (appState && appState.state && appState.state.playerId) || '';

  const solutionStr = playerBoard.join('');

  try {
    const { data: res, error } = await executeAuthenticatedRpc('claim_daily_sudoku_reward', {
      p_player_id: pid,
      p_difficulty: activeDifficulty,
      p_solution_submission: solutionStr,
      p_time_seconds: timerSeconds,
      p_mistakes: mistakes
    });

    if (error || !res || !res.success) {
      if (triggerToast) triggerToast(res?.message || error?.message || 'Error claiming Sudoku reward', 'error');
      startSudokuTimer();
      isSubmitting = false;
      return;
    }

    isGameCompleted = true;
    localStorage.removeItem('polygame_sudoku_draft');

    if (res.new_balance !== undefined && appState) {
      appState.update({ balancePgt: parseFloat(res.new_balance) });
      if (typeof appState.syncUI === 'function') appState.syncUI();
    }

    if (sfx && typeof sfx.playPowerUp === 'function') sfx.playPowerUp();
    triggerConfetti();

    const pgtWon = res.pgt_awarded || 0;
    const isFlawless = (mistakes === 0);
    const flawlessBonusText = isFlawless ? ' (⚡ Flawless Bonus Included!)' : '';

    showSudokuPostgameCard(true, pgtWon, activeDifficulty);
    if (triggerToast) triggerToast(`🎉 Cyber Sudoku Solved in ${formatTime(timerSeconds)}! +${pgtWon} PGT won!${flawlessBonusText}`, 'success');
    if (typeof window.trackQuestProgress === 'function') window.trackQuestProgress('games', 1);

    refreshDailyGamesHubStatus();

  } catch (err) {
    console.error('[Sudoku] Solution submission exception:', err);
    if (triggerToast) triggerToast('Network exception while claiming reward.', 'error');
  } finally {
    isSubmitting = false;
  }
}

function terminateSudokuGame() {
  isGameCompleted = true;
  stopSudokuTimer();
  localStorage.removeItem('polygame_sudoku_draft');

  const card = document.getElementById('sudoku-postgame-card');
  const title = document.getElementById('sudoku-postgame-title');
  const payout = document.getElementById('sudoku-postgame-payout');
  const timeEl = document.getElementById('sudoku-postgame-time');
  if (card) {
    card.style.display = 'block';
    card.style.borderColor = 'var(--color-danger)';
    if (title) title.innerText = '❌ MAXIMUM MISTAKES EXCEEDED';
    if (payout) payout.innerText = '0 PGT Earned (Challenge locked until 00:00 UTC)';
    if (timeEl) timeEl.innerText = 'Patience and precision are key to decrypting the grid.';
  }
  if (triggerToast) triggerToast('Challenge failed: 4 mistakes exceeded.', 'error');
  refreshDailyGamesHubStatus();
}

/**
 * Timer management
 */
function startSudokuTimer() {
  stopSudokuTimer();
  timerInterval = setInterval(() => {
    timerSeconds++;
    const timerEl = document.getElementById('sudoku-timer-display');
    if (timerEl) timerEl.innerText = formatTime(timerSeconds);
  }, 1000);
}

function stopSudokuTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateSudokuHud() {
  const pill = document.getElementById('sudoku-diff-pill');
  const mistakesEl = document.getElementById('sudoku-mistakes-badge');

  if (pill) {
    pill.innerText = activeDifficulty.toUpperCase();
    if (activeDifficulty === 'easy') pill.style.background = '#00c853';
    else if (activeDifficulty === 'hard') pill.style.background = '#ff0055';
    else pill.style.background = 'var(--color-primary)';
  }

  if (mistakesEl) {
    mistakesEl.innerText = `Mistakes: ${mistakes} / 3`;
  }
}

function showDifficultyScreen() {
  const s1 = document.getElementById('sudoku-difficulty-screen');
  const s2 = document.getElementById('sudoku-play-screen');
  if (s1) s1.style.display = 'flex';
  if (s2) s2.style.display = 'none';
}

function showPlayScreen() {
  const s1 = document.getElementById('sudoku-difficulty-screen');
  const s2 = document.getElementById('sudoku-play-screen');
  if (s1) s1.style.display = 'none';
  if (s2) s2.style.display = 'flex';
}

function showSudokuPostgameCard(isWin, pgt, diff) {
  const card = document.getElementById('sudoku-postgame-card');
  const title = document.getElementById('sudoku-postgame-title');
  const payout = document.getElementById('sudoku-postgame-payout');
  const timeEl = document.getElementById('sudoku-postgame-time');
  if (!card) return;

  card.style.display = 'block';
  if (isWin) {
    card.style.borderColor = 'var(--color-success)';
    if (title) title.innerText = `🎉 ${diff.toUpperCase()} SUDOKU SOLVED!`;
    if (payout) payout.innerText = `+${pgt} PGT Awarded to Balance`;
    if (timeEl) timeEl.innerText = `Completed in ${formatTime(timerSeconds)} with ${mistakes} mistakes.`;
  }
}

/**
 * Local draft saving
 */
function saveLocalDraft() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const draft = {
      date: today,
      difficulty: activeDifficulty,
      board: playerBoard,
      notes: notesBoard.map(s => Array.from(s)),
      timer: timerSeconds,
      mistakes
    };
    localStorage.setItem('polygame_sudoku_draft', JSON.stringify(draft));
  } catch (e) {}
}

function restoreLocalDraft() {
  try {
    const raw = localStorage.getItem('polygame_sudoku_draft');
    if (!raw) return;
    const draft = JSON.parse(raw);
    const today = new Date().toISOString().split('T')[0];

    if (draft.date === today && draft.difficulty === activeDifficulty && Array.isArray(draft.board)) {
      playerBoard = draft.board;
      if (Array.isArray(draft.notes)) {
        notesBoard = draft.notes.map(arr => new Set(arr));
      }
      timerSeconds = draft.timer || 0;
      mistakes = draft.mistakes || 0;
    }
  } catch (e) {}
}

/**
 * Attaches physical keyboard listener
 */
function attachSudokuKeyListeners() {
  if (keyListenersAttached) return;
  keyListenersAttached = true;

  window.addEventListener('keydown', e => {
    const sudokuPanel = document.getElementById('panel-game-sudoku');
    if (!sudokuPanel || sudokuPanel.style.display === 'none') return;

    if (e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      inputSudokuNumber(parseInt(e.key, 10));
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      eraseSudokuCell();
    } else if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      toggleSudokuNotes();
    } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      undoSudokuMove();
    } else if (selectedCellIndex !== null) {
      // Arrow keys navigation
      const row = Math.floor(selectedCellIndex / 9);
      const col = selectedCellIndex % 9;
      if (e.key === 'ArrowUp' && row > 0) { e.preventDefault(); selectSudokuCell((row - 1) * 9 + col); }
      else if (e.key === 'ArrowDown' && row < 8) { e.preventDefault(); selectSudokuCell((row + 1) * 9 + col); }
      else if (e.key === 'ArrowLeft' && col > 0) { e.preventDefault(); selectSudokuCell(row * 9 + (col - 1)); }
      else if (e.key === 'ArrowRight' && col < 8) { e.preventDefault(); selectSudokuCell(row * 9 + (col + 1)); }
    }
  });
}

/**
 * Opens Sudoku Statistics Modal
 */
export async function openSudokuStatsModal() {
  openModal('sudoku-stats');

  const pid = (appState && typeof appState.getPlayerId === 'function' && appState.getPlayerId()) ||
              (appState && appState.state && appState.state.playerId) || '';
  if (!pid) return;

  try {
    const { data: res } = await executeAuthenticatedRpc('get_daily_games_hub_status', { p_player_id: pid });
    if (!res || !res.sudoku || !res.sudoku.stats) return;

    const s = res.sudoku.stats;
    const elPlayed = document.getElementById('sudoku-stat-played');
    const elStreak = document.getElementById('sudoku-stat-streak');
    const elMaxStreak = document.getElementById('sudoku-stat-maxstreak');
    const elFlawless = document.getElementById('sudoku-stat-flawless');

    if (elPlayed) elPlayed.innerText = s.played || 0;
    if (elStreak) elStreak.innerText = s.streak || 0;
    if (elMaxStreak) elMaxStreak.innerText = s.max_streak || 0;
    if (elFlawless) elFlawless.innerText = s.flawless_wins || 0;

    const recEasy = document.getElementById('sudoku-record-easy');
    const recMed = document.getElementById('sudoku-record-med');
    const recHard = document.getElementById('sudoku-record-hard');

    if (recEasy) recEasy.innerText = `${s.easy_wins || 0} wins • Best: ${s.best_easy ? formatTime(s.best_easy) : '--:--'}`;
    if (recMed) recMed.innerText = `${s.med_wins || 0} wins • Best: ${s.best_med ? formatTime(s.best_med) : '--:--'}`;
    if (recHard) recHard.innerText = `${s.hard_wins || 0} wins • Best: ${s.best_hard ? formatTime(s.best_hard) : '--:--'}`;

  } catch (err) {
    console.warn('[SudokuStats] Error fetching stats:', err);
  }
}

/**
 * Copies Sudoku share card with player's referral link to clipboard
 */
export function shareSudokuResult() {
  if (!isGameCompleted) {
    if (triggerToast) triggerToast('Complete today\'s Sudoku first!', 'info');
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];
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

  const diffEmoji = activeDifficulty === 'easy' ? '🟢' : (activeDifficulty === 'hard' ? '🔴' : '🟡');
  const shareText = `PolyGame Cyber Sudoku (${todayStr})\n${diffEmoji} ${activeDifficulty.toUpperCase()} Solved in ${formatTime(timerSeconds)} • ${mistakes} Mistakes\n\nPlay at: ${playUrl}`;

  navigator.clipboard.writeText(shareText).then(() => {
    if (triggerToast) triggerToast('📋 Sudoku result copied to clipboard with your referral link!', 'success');
  }).catch(() => {
    if (triggerToast) triggerToast('Unable to copy to clipboard', 'error');
  });
}

// Window globals
if (typeof window !== 'undefined') {
  window.initSudokuGame = initSudokuGame;
  window.startDailySudokuGame = startDailySudokuGame;
  window.inputSudokuNumber = inputSudokuNumber;
  window.eraseSudokuCell = eraseSudokuCell;
  window.undoSudokuMove = undoSudokuMove;
  window.toggleSudokuNotes = toggleSudokuNotes;
  window.openSudokuStatsModal = openSudokuStatsModal;
  window.shareSudokuResult = shareSudokuResult;
}
