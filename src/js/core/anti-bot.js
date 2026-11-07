// ==============================================================================
// POLYGAME: ANTI-BOT & FAIR-PLAY INTEGRITY SENTINEL
// Handles client-side synthetic input detection, event verification,
// reporting to the Supabase record_bot_warning RPC, and warning modal display.
// ==============================================================================

import { supabase } from './config.js';
import { appState } from './state.js';

class AntiBotSentinel {
  constructor() {
    this._isFlagged = false;
    this._lastReportTime = 0;
    this._recentIntervals = [];
    this._lastActionTime = 0;
    this.initHeadlessCheck();
  }

  // --- 1. Event Verification ---
  /**
   * Strictly validates whether a DOM event is trusted (physical human hardware).
   * In modern browsers, e.isTrusted is true ONLY for genuine physical actions.
   * Synthetic events dispatched via dispatchEvent, new MouseEvent, or element.click() have e.isTrusted === false.
   */
  isTrustedEvent(e) {
    if (!e) return false;
    // Standard DOM Level 3 isTrusted check
    if (e.isTrusted !== true) {
      return false;
    }
    return true;
  }

  // --- 2. Headless Automation Check ---
  initHeadlessCheck() {
    try {
      if (typeof navigator !== 'undefined' && navigator.webdriver === true) {
        console.warn("[AntiBot] Headless browser runner detected (navigator.webdriver).");
      }
    } catch (err) {}
  }

  // --- 3. Autoclicker Macro Timing Heuristic ---
  /**
   * Tracks intervals between repetitive actions (shots, jumps).
   * Real humans have natural timing jitter (e.g. 182ms, 215ms, 195ms).
   * Strict scripts using setInterval(action, 100) have std dev ~ 0.
   */
  trackActionTiming(now = Date.now()) {
    if (this._lastActionTime > 0) {
      const delta = now - this._lastActionTime;
      if (delta > 30 && delta < 1200) {
        this._recentIntervals.push(delta);
        if (this._recentIntervals.length > 10) {
          this._recentIntervals.shift();
        }
        if (this._recentIntervals.length >= 8) {
          const mean = this._recentIntervals.reduce((a, b) => a + b, 0) / this._recentIntervals.length;
          const variance = this._recentIntervals.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / this._recentIntervals.length;
          const stdDev = Math.sqrt(variance);
          // If 8+ consecutive inputs occurred with under 4ms standard deviation, it's a fixed-interval macro
          if (stdDev < 4.0) {
            this._recentIntervals = [];
            return false; // Detected autoclicker macro!
          }
        }
      }
    }
    this._lastActionTime = now;
    return true;
  }

  // --- 4. Report Suspicious Activity ---
  async reportSuspiciousActivity(gameName, reason, details = {}) {
    const now = Date.now();
    // Debounce: at most 1 report every 8 seconds per client session
    if (now - this._lastReportTime < 8000) {
      return;
    }
    this._lastReportTime = now;

    console.warn(`[AntiBot] Suspicious activity detected in ${gameName}: ${reason}`, details);

    // Immediately stop active game engines
    this.haltAllActiveGames();

    let warningCount = (appState && appState.state && appState.state.botWarning) ? (appState.state.botWarning + 1) : 1;

    // Call Supabase RPC to persist incident and increment bot_warning
    const wallet = (appState && typeof appState.getPlayerId === 'function') 
      ? appState.getPlayerId() 
      : (appState && appState.state && (appState.state.player_id || appState.state.walletAddress || ''));

    if (wallet && supabase) {
      try {
        const { data, error } = await supabase.rpc('record_bot_warning', {
          p_player_id: wallet,
          p_reason: reason,
          p_game: gameName,
          p_details: details
        });

        if (!error && data && data.success && data.bot_warning !== undefined) {
          warningCount = parseInt(data.bot_warning, 10);
          if (appState && typeof appState.update === 'function') {
            appState.update({ botWarning: warningCount });
          }
        }
      } catch (err) {
        console.warn("[AntiBot] Failed to record bot warning:", err);
      }
    }

    // Play warning sound
    try {
      if (window.sfx && typeof window.sfx.playLaser === 'function') {
        window.sfx.playLaser();
      }
    } catch (e) {}

    // Show warning modal
    this.showBotWarningModal(warningCount, reason, gameName);
  }

  // --- 5. Halt Active Game Loops ---
  haltAllActiveGames() {
    try {
      if (window.skeetEngine && typeof window.skeetEngine.stop === 'function') window.skeetEngine.stop();
      if (window.cyberInvaders && typeof window.cyberInvaders.stop === 'function') window.cyberInvaders.stop();
      if (window.astroDodge && typeof window.astroDodge.stop === 'function') window.astroDodge.stop();
      if (window.cyberDrift && typeof window.cyberDrift.stop === 'function') window.cyberDrift.stop();
      if (window.cyberStacker && typeof window.cyberStacker.stop === 'function') window.cyberStacker.stop();
      if (window.cyberDefense && typeof window.cyberDefense.stop === 'function') window.cyberDefense.stop();
    } catch (e) {}
  }

  // --- 6. Anti-Bot Warning Modal UI ---
  showBotWarningModal(warningCount, reason, gameName) {
    let modalEl = document.getElementById('antibot-warning-modal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'antibot-warning-modal';
      modalEl.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 100000;
        background: rgba(8, 6, 20, 0.88);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        animation: fadeIn 0.25s ease-out;
      `;
      document.body.appendChild(modalEl);
    }

    const readableReason = this.formatReason(reason);

    modalEl.innerHTML = `
      <div style="
        background: linear-gradient(145deg, #0d1526 0%, #11182c 100%);
        border: 2px solid #00f0ff;
        border-radius: 14px;
        box-shadow: 0 0 30px rgba(0, 240, 255, 0.25);
        max-width: 500px;
        width: 100%;
        padding: 1.75rem;
        color: #fff;
        text-align: center;
        font-family: inherit;
        position: relative;
      ">
        <div style="font-size: 2.6rem; margin-bottom: 0.45rem; filter: drop-shadow(0 0 8px rgba(0,240,255,0.5));">
          🛡️ℹ️
        </div>
        <h3 style="
          color: #00f0ff;
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          margin: 0 0 0.45rem 0;
          text-transform: uppercase;
        ">
          Fair-Play Advisory (Warning Only)
        </h3>

        <div style="
          display: inline-block;
          background: rgba(0, 240, 255, 0.12);
          border: 1px solid rgba(0, 240, 255, 0.45);
          color: #7df9ff;
          font-weight: 700;
          font-size: 0.84rem;
          padding: 0.3rem 0.85rem;
          border-radius: 999px;
          margin-bottom: 1.15rem;
        ">
          ℹ️ Advisory Notice #${warningCount} • Just a Warning (Account in Good Standing)
        </div>

        <div style="
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(0, 240, 255, 0.25);
          border-radius: 8px;
          padding: 0.95rem 1rem;
          margin-bottom: 1.1rem;
          text-align: left;
          font-size: 0.85rem;
          line-height: 1.5;
        ">
          <div style="margin-bottom: 0.35rem;">
            <span style="color: var(--text-dim, #94a3b8);">Game:</span>
            <strong style="color: #00f0ff;">${gameName || 'Arcade Game'}</strong>
          </div>
          <div style="margin-bottom: 0.45rem;">
            <span style="color: var(--text-dim, #94a3b8);">Check Triggered:</span>
            <strong style="color: #fbbf24;">${readableReason}</strong>
          </div>
          <p style="color: #e2e8f0; margin: 0.45rem 0 0 0; font-size: 0.82rem;">
            <strong>Don't worry — this is just an automated warning!</strong> Your account is completely safe and in good standing. To ensure your scores count cleanly, please keep the game window active in the foreground while playing.
          </p>
        </div>

        <div style="
          background: rgba(251, 191, 36, 0.08);
          border-left: 3px solid #fbbf24;
          padding: 0.65rem 0.85rem;
          border-radius: 0 6px 6px 0;
          margin-bottom: 1.35rem;
          text-align: left;
          font-size: 0.79rem;
          color: #fde68a;
          line-height: 1.45;
        ">
          <strong>Friendly Reminder:</strong> Occasional warnings can happen if a browser tab briefly loses focus, switches apps, or an extension interferes. Only repeated automated bot scripting leads to restrictions.
        </div>

        <button id="btn-ack-antibot" style="
          background: linear-gradient(135deg, #00c6ff 0%, #0072ff 100%);
          color: #fff;
          font-weight: 800;
          border: none;
          border-radius: 8px;
          padding: 0.75rem 1.75rem;
          font-size: 0.95rem;
          cursor: pointer;
          letter-spacing: 0.03em;
          box-shadow: 0 0 15px rgba(0, 198, 255, 0.35);
          width: 100%;
          transition: transform 0.15s ease;
        ">
          Got It — Continue Playing
        </button>
      </div>
    `;

    modalEl.style.display = 'flex';

    const ackBtn = document.getElementById('btn-ack-antibot');
    if (ackBtn) {
      ackBtn.onclick = () => {
        modalEl.style.display = 'none';
        if (typeof window.switchTab === 'function') {
          window.switchTab('games');
        }
      };
    }
  }

  formatReason(reason) {
    const map = {
      'untrusted_input': 'Non-Standard Input Event',
      'untrusted_mouse_input': 'Non-Standard Mouse Event',
      'untrusted_touch_input': 'Non-Standard Touch Event',
      'untrusted_keyboard_input': 'Non-Standard Keyboard Event',
      'direct_function_call': 'Console Command Detected',
      'score_limit_500k_exceeded': 'Score Ceiling Exceeded (> 500,000 pts)',
      'autoclicker_timing_detected': 'Repetitive Input Timing',
      'automated_webdriver': 'Automated Browser Environment',
      'synthetic_input_detected': 'Automated Script / Extension Input',
      'unfocused_background_session': 'Background Tab / Window Focus Loss',
      'zero_input_anomaly': 'No Active Input Recorded During Run'
    };
    return map[reason] || reason || 'Session Focus / Input Check';
  }

  // Convenient alias matching both naming conventions
  triggerBotWarning(reason, gameName, details = {}) {
    return this.reportSuspiciousActivity(gameName, reason, details);
  }
}

export const antiBot = new AntiBotSentinel();
window.antiBot = antiBot;
window.antiBotSentinel = antiBot;
