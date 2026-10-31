// ============================================================
// POLYGAME: DAILY CYBER GAMES HUB MANAGER (PLAN-020)
// Manages UTC countdown, logic streaks, and hub dashboard badges
// ============================================================

import { appState } from '../core/state.js';
import { executeAuthenticatedRpc } from '../core/auth-web3.js';

let countdownInterval = null;
let cachedHubStatus = null;

/**
 * Starts the live 00:00 UTC countdown timer
 */
export function startDailyHubCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  function updateTimer() {
    // Pause during background tab or active gameplay to eliminate reflow lag
    if (typeof document !== 'undefined' && document.hidden) return;
    if (typeof window !== 'undefined' && typeof window.isAnyArcadeGamePlaying === 'function' && window.isAnyArcadeGamePlaying()) return;

    const el = document.getElementById('daily-hub-countdown');
    if (!el) return;

    const now = new Date();
    const utcYear = now.getUTCFullYear();
    const utcMonth = now.getUTCMonth();
    const utcDate = now.getUTCDate();

    // Next 00:00 UTC
    const nextUtc = new Date(Date.UTC(utcYear, utcMonth, utcDate + 1, 0, 0, 0, 0));
    const diffMs = Math.max(0, nextUtc.getTime() - now.getTime());

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diffMs % (1000 * 60)) / 1000);

    const pad = n => String(n).padStart(2, '0');
    el.innerText = `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  }

  updateTimer();
  countdownInterval = setInterval(updateTimer, 1000);
}

let lastHubFetchTime = 0;
const DAILY_HUB_CACHE_TTL_MS = 3 * 60 * 1000; // 3-minute client TTL to reduce Supabase edge log ingestion

export function invalidateDailyHubCache() {
  cachedHubStatus = null;
  lastHubFetchTime = 0;
}
window.invalidateDailyHubCache = invalidateDailyHubCache;

/**
 * Fetches authoritatively from Supabase and updates all hub dashboard badges
 */
export async function refreshDailyGamesHubStatus(forceRefresh = false) {
  startDailyHubCountdown();

  const isConn = (appState && typeof appState.isPlayerConnected === 'function') ? appState.isPlayerConnected() : false;
  const pid = (appState && typeof appState.getPlayerId === 'function' && appState.getPlayerId()) ||
              (appState && appState.state && appState.state.playerId) || '';

  // Local guests do not have a Supabase profile row: render clean default state immediately with zero network overhead
  if (!isConn || !pid || pid.startsWith('0xguest') || pid.startsWith('0xg_')) {
    updateHubUIFromStatus({
      logic_streak: { current: 0 },
      wordle: { is_solved: false, claimed: false, guesses_count: 0 },
      sudoku: { is_completed: false }
    });
    return;
  }

  const now = Date.now();
  if (!forceRefresh && cachedHubStatus && (now - lastHubFetchTime < DAILY_HUB_CACHE_TTL_MS)) {
    updateHubUIFromStatus(cachedHubStatus);
    return cachedHubStatus;
  }

  try {
    const { data: res, error } = await executeAuthenticatedRpc('get_daily_games_hub_status', {
      p_player_id: pid
    });

    if (error || !res || !res.success) {
      console.warn('[DailyHub] Status fetch error:', error || res);
      return;
    }

    cachedHubStatus = res;
    lastHubFetchTime = now;
    updateHubUIFromStatus(res);
  } catch (err) {
    console.warn('[DailyHub] Exception during status sync:', err);
  }
}

export function getCachedHubStatus() {
  return cachedHubStatus;
}

/**
 * Updates DOM elements on the Daily Hub dashboard
 */
export function updateHubUIFromStatus(status) {
  if (!status) return;

  // 1. Daily Logic Streak
  const streakEl = document.getElementById('daily-logic-streak-badge');
  if (streakEl && status.logic_streak) {
    const cur = status.logic_streak.current || 0;
    streakEl.innerText = `🔥 ${cur} ${cur === 1 ? 'Day' : 'Days'}`;
  }

  // 2. Matrix Progress (Wordle + Sudoku)
  const matrixEl = document.getElementById('daily-matrix-progress-badge');
  let completed = 0;
  if (status.wordle && (status.wordle.is_solved || status.wordle.claimed)) completed++;
  if (status.sudoku && status.sudoku.is_completed) completed++;

  if (matrixEl) {
    if (completed === 2) {
      matrixEl.innerHTML = `⭐ 2 / 2 <span style="font-size:0.7rem; color:#ffd700;">(Double Mastery!)</span>`;
    } else {
      matrixEl.innerText = `${completed} / 2 Done`;
    }
  }

  // 3. Wordle Tile Badge
  const wordleBadge = document.getElementById('badge-daily-wordle-status');
  if (wordleBadge) {
    if (status.wordle && (status.wordle.is_solved || status.wordle.claimed)) {
      wordleBadge.innerText = 'COMPLETED ✓';
      wordleBadge.style.background = 'rgba(0, 230, 118, 0.2)';
      wordleBadge.style.color = 'var(--color-success)';
      wordleBadge.style.borderColor = 'var(--color-success)';
    } else if (status.wordle && status.wordle.is_failed) {
      wordleBadge.innerText = 'FAILED (0/1)';
      wordleBadge.style.background = 'rgba(255, 0, 85, 0.2)';
      wordleBadge.style.color = 'var(--color-danger)';
      wordleBadge.style.borderColor = 'var(--color-danger)';
    } else if (status.wordle && status.wordle.guesses_count > 0) {
      wordleBadge.innerText = `IN PROGRESS (${status.wordle.guesses_count}/6)`;
      wordleBadge.style.background = 'rgba(255, 170, 0, 0.2)';
      wordleBadge.style.color = '#ffb700';
      wordleBadge.style.borderColor = '#ffb700';
    } else {
      wordleBadge.innerText = 'AVAILABLE';
      wordleBadge.style.background = 'rgba(0, 240, 255, 0.2)';
      wordleBadge.style.color = 'var(--color-primary)';
      wordleBadge.style.borderColor = 'var(--color-primary)';
    }
  }

  // 4. Sudoku Tile Badge
  const sudokuBadge = document.getElementById('badge-daily-sudoku-status');
  if (sudokuBadge) {
    if (status.sudoku && status.sudoku.is_completed) {
      sudokuBadge.innerText = 'COMPLETED ✓';
      sudokuBadge.style.background = 'rgba(0, 230, 118, 0.2)';
      sudokuBadge.style.color = 'var(--color-success)';
      sudokuBadge.style.borderColor = 'var(--color-success)';
    } else if (status.sudoku && status.sudoku.difficulty) {
      sudokuBadge.innerText = `IN PROGRESS (${status.sudoku.difficulty.toUpperCase()})`;
      sudokuBadge.style.background = 'rgba(255, 170, 0, 0.2)';
      sudokuBadge.style.color = '#ffb700';
      sudokuBadge.style.borderColor = '#ffb700';
    } else {
      sudokuBadge.innerText = 'AVAILABLE';
      sudokuBadge.style.background = 'rgba(255, 170, 0, 0.2)';
      sudokuBadge.style.color = '#ffb700';
      sudokuBadge.style.borderColor = '#ffb700';
    }
  }
}

// Window globals
if (typeof window !== 'undefined') {
  window.refreshDailyGamesHubStatus = refreshDailyGamesHubStatus;
  window.startDailyHubCountdown = startDailyHubCountdown;
}
