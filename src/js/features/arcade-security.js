// ==============================================================================
// POLYGAME ARCADE SECURITY: Cloudflare Turnstile Anti-Bot Sentinel (PLAN-010)
// ==============================================================================
// Enforces periodic Cloudflare Turnstile human verification every N arcade runs
// to protect leaderboards, high scores, and PGT minting from automated macros.
// Features:
//   1. Solid, High-Contrast Modal (no semi-transparency).
//   2. Reliable Visible Widget (`appearance: 'always'`).
//   3. Single-Flight Mutex Execution (prevents multiple runs/loops in console).
//   4. Automatic Bot Warning: Records atomic `bot_warning` in Supabase on fail.
//   5. Master Admin Live Kill-Switch: Immediate disable toggle in Admin Portal.
// ==============================================================================

import { TURNSTILE_SITE_KEY, supabase } from '../core/config.js';
import { appState } from '../core/state.js';

const SESSION_STORAGE_KEY = 'polygame_arcade_plays_since_turnstile';
let turnstileArcadeWidgetId = null;
let activeVerificationResolver = null;
let isChallengeInProgress = false;

/**
 * Get current consecutive arcade runs since last Turnstile verification.
 */
export function getArcadePlayCount() {
  try {
    const val = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch (e) {
    return 0;
  }
}

/**
 * Increment arcade run counter by 1.
 */
export function incrementArcadePlayCount() {
  try {
    const current = getArcadePlayCount() + 1;
    sessionStorage.setItem(SESSION_STORAGE_KEY, current.toString());
    return current;
  } catch (e) {
    return 0;
  }
}

/**
 * Reset arcade run counter back to 0 (called upon successful Turnstile verification).
 */
export function resetArcadePlayCount() {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, '0');
  } catch (e) {}
}

/**
 * Checks if the player is required to complete Turnstile before their next arcade run.
 * Respects the Master Admin Kill-Switch (turnstile_arcade_enabled) and VIP Bypass.
 */
export function requiresVerification() {
  const state = appState?.state || {};

  // 1. Live Master Kill-Switch: If disabled by admin, never prompt
  if (state.turnstileArcadeEnabled === false) {
    return false;
  }

  // 2. VIP Bypass check (if enabled in settings)
  if (state.turnstileArcadeVipBypass === true && typeof appState.isVipActive === 'function' && appState.isVipActive()) {
    return false;
  }

  // 3. Frequency threshold (default: every 3 games)
  const frequency = typeof state.turnstileArcadeFrequency === 'number' && state.turnstileArcadeFrequency > 0
    ? state.turnstileArcadeFrequency
    : 3;

  const currentPlays = getArcadePlayCount();
  return currentPlays >= frequency;
}

/**
 * Record an atomic bot warning in Supabase when Turnstile fails or is bypassed.
 */
export async function recordTurnstileBotWarning(gameName = 'Arcade', reason = 'turnstile_arcade_failed') {
  try {
    const client = supabase || window.supabaseClient || window.supabase;
    if (!client) return;

    const wallet = (appState && typeof appState.getPlayerId === 'function') 
      ? appState.getPlayerId() 
      : (appState && appState.state && (appState.state.playerId || appState.state.walletAddress || ''));
    
    if (!wallet) return;

    console.warn(`[ArcadeSecurity] Recording bot warning for ${wallet} in ${gameName}: ${reason}`);

    const { data, error } = await client.rpc('record_bot_warning', {
      p_player_id: wallet,
      p_reason: reason,
      p_game: gameName,
      p_details: {
        source: 'turnstile_arcade_sentinel',
        timestamp: new Date().toISOString(),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
      }
    });

    if (!error && data && data.success && data.bot_warning !== undefined) {
      const warningCount = parseInt(data.bot_warning, 10);
      if (appState && typeof appState.update === 'function') {
        appState.update({ botWarning: warningCount });
      }
      const badge = document.getElementById('profile-bot-warning-badge');
      if (badge) {
        badge.innerText = `${warningCount} Warnings`;
        badge.style.display = 'inline-block';
      }
    }
  } catch (err) {
    console.warn('[ArcadeSecurity] Failed to record Turnstile bot warning:', err);
  }
}

/**
 * Pause all 6 active arcade game engines to prevent obstacles from hitting the player.
 */
export function pauseAllArcadeGames() {
  if (typeof window === 'undefined') return;
  if (window.dodgeGame && typeof window.dodgeGame === 'object') window.dodgeGame.isPaused = true;
  if (window.invadersGame && typeof window.invadersGame === 'object') window.invadersGame.isPaused = true;
  if (window.cyberDrift && typeof window.cyberDrift === 'object') window.cyberDrift.isPaused = true;
  if (window.cyberStacker && typeof window.cyberStacker === 'object') window.cyberStacker.isPaused = true;
  if (window.skeetEngine && typeof window.skeetEngine === 'object') window.skeetEngine.isPaused = true;
  if (window.defenseEngine && typeof window.defenseEngine === 'object') window.defenseEngine.isPaused = true;
}

/**
 * Resume all 6 arcade game engines after verification completes.
 */
export function resumeAllArcadeGames() {
  if (typeof window === 'undefined') return;
  if (window.dodgeGame && typeof window.dodgeGame === 'object') window.dodgeGame.isPaused = false;
  if (window.invadersGame && typeof window.invadersGame === 'object') window.invadersGame.isPaused = false;
  if (window.cyberDrift && typeof window.cyberDrift === 'object') window.cyberDrift.isPaused = false;
  if (window.cyberStacker && typeof window.cyberStacker === 'object') window.cyberStacker.isPaused = false;
  if (window.skeetEngine && typeof window.skeetEngine === 'object') window.skeetEngine.isPaused = false;
  if (window.defenseEngine && typeof window.defenseEngine === 'object') window.defenseEngine.isPaused = false;
}

/**
 * Prompts the player with the Cloudflare Turnstile modal.
 * Returns a Promise that resolves to true (verified) or false (canceled/failed).
 * Uses a single-flight promise to prevent multiple runs in a row.
 */
export function promptTurnstileChallenge(gameName = 'Arcade') {
  if (isChallengeInProgress && activeVerificationResolver) {
    return activeVerificationResolver.promise;
  }

  // Freeze game physics & obstacles immediately
  pauseAllArcadeGames();

  let resolver, rejecter;
  const promise = new Promise((resolve, reject) => {
    resolver = resolve;
    rejecter = reject;
  });

  activeVerificationResolver = { resolve: resolver, reject: rejecter, promise };
  isChallengeInProgress = true;

  const modal = document.getElementById('modal-turnstile-arcade');
  const widgetContainer = document.getElementById('turnstile-arcade-widget');
  const statusEl = document.getElementById('turnstile-arcade-status');
  const freqHintEl = document.getElementById('turnstile-arcade-frequency-hint');
  const gameNameEl = document.getElementById('turnstile-arcade-game-name');

  if (gameNameEl) {
    gameNameEl.innerText = gameName;
  }

  const frequency = appState?.state?.turnstileArcadeFrequency || 3;
  if (freqHintEl) {
    freqHintEl.innerText = `Periodic security check every ${frequency} games`;
  }

  if (statusEl) {
    statusEl.innerText = 'Please complete the verification check below to start your run.';
    statusEl.style.color = 'var(--text-muted)';
    statusEl.style.display = 'block';
  }

  // Show modal immediately with solid, high-contrast styling
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
    modal.style.pointerEvents = 'auto';
  }

  function renderWidget() {
    if (!widgetContainer) return;

    if (typeof window.turnstile !== 'undefined') {
      // Remove any prior widget completely to avoid duplicate callbacks
      if (turnstileArcadeWidgetId !== null) {
        try {
          window.turnstile.remove(turnstileArcadeWidgetId);
        } catch (e) {}
        turnstileArcadeWidgetId = null;
      }

      widgetContainer.innerHTML = '';
      try {
        turnstileArcadeWidgetId = window.turnstile.render('#turnstile-arcade-widget', {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          appearance: 'always',
          callback: function (token) {
            if (!isChallengeInProgress) return; // Prevent duplicate callback executions

            if (statusEl) {
              statusEl.innerText = '✓ Human Verification Confirmed! Resuming game...';
              statusEl.style.color = 'var(--color-success)';
            }

            // Reset consecutive runs counter
            resetArcadePlayCount();

            // Delay 400ms for visual confirmation, then cleanly close & resume
            setTimeout(() => {
              const res = activeVerificationResolver;
              activeVerificationResolver = null;
              isChallengeInProgress = false;

              cleanupModal();
              resumeAllArcadeGames();

              if (res && typeof res.resolve === 'function') {
                res.resolve(true);
              }
            }, 400);
          },
          'expired-callback': function () {
            if (statusEl) {
              statusEl.innerText = '⚠️ Verification expired. Please click the checkmark again.';
              statusEl.style.color = 'var(--color-warning)';
            }
          },
          'error-callback': function () {
            if (statusEl) {
              statusEl.innerText = '❌ Verification challenge failed. Bot warning recorded.';
              statusEl.style.color = 'var(--color-danger)';
            }

            // Record Bot Warning in Supabase for failed challenge
            recordTurnstileBotWarning(gameName, 'turnstile_arcade_failed');
          }
        });
      } catch (err) {
        console.warn('[ArcadeSecurity] Turnstile render error:', err);
      }
    } else {
      // If SDK script is still loading, retry shortly
      setTimeout(renderWidget, 250);
    }
  }

  renderWidget();
  return promise;
}

/**
 * Aborts / closes the verification challenge if player exits to hub or cancels.
 */
export function abortVerification() {
  const res = activeVerificationResolver;
  activeVerificationResolver = null;
  isChallengeInProgress = false;

  cleanupModal();
  resumeAllArcadeGames();

  if (res && typeof res.resolve === 'function') {
    res.resolve(false);
  }

  if (typeof window.triggerToast === 'function') {
    window.triggerToast('Arcade game launch canceled (verification pending).', 'info');
  }
}

function cleanupModal() {
  const modal = document.getElementById('modal-turnstile-arcade');
  if (modal) {
    modal.classList.remove('active');
    modal.style.pointerEvents = 'none';
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
  }

  // Completely remove the Turnstile widget instance so it never triggers callbacks again in the background
  if (turnstileArcadeWidgetId !== null && typeof window.turnstile !== 'undefined') {
    try {
      window.turnstile.remove(turnstileArcadeWidgetId);
    } catch (e) {}
    turnstileArcadeWidgetId = null;
  }

  const widgetContainer = document.getElementById('turnstile-arcade-widget');
  if (widgetContainer) {
    widgetContainer.innerHTML = '';
  }
}

// Expose on window for global access across games
export const arcadeSecurity = {
  getArcadePlayCount,
  incrementArcadePlayCount,
  resetArcadePlayCount,
  requiresVerification,
  recordTurnstileBotWarning,
  pauseAllArcadeGames,
  resumeAllArcadeGames,
  promptTurnstileChallenge,
  abortVerification
};

if (typeof window !== 'undefined') {
  window.arcadeSecurity = arcadeSecurity;
}

export default arcadeSecurity;
