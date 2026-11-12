// ============================================================
// POLYGAME: UNIFIED ARCADE HOST & SDK (PLAN-021 LITE)
// Provides:
// 1. PolyGameSDK.getPointer(e, canvas) — Aspect-ratio & CSS-scale coordinate normalization
// 2. PolyGameSDK.getActiveMultiplier(gameKey) — Live multiplier & breakdown calculator
// 3. PolyGameSDK.bindTouchControls(container, preset, handlers, options) — Mobile Auto-Touch Deck
// 4. PolyArcadeHost — Unified Outer Frame, Top HUD Bar, Mute Toggle & Fullscreen Controls
// ============================================================

import { ARCADE_GAMES_REGISTRY } from './games-registry.js';

const EXTRA_GAME_META = {
  roshambo: { key: 'roshambo', title: 'Cyber Roshambo', icon: '✊', category: 'bet', frameMaxWidth: '640px', aspectPreset: 'landscape' },
  spinner:  { key: 'spinner',  title: 'Lucky Spinner',  icon: '🎡', category: 'bet', frameMaxWidth: '640px', aspectPreset: 'landscape' },
  plinko:   { key: 'plinko',   title: 'Neon Plinko',    icon: '🟣', category: 'bet', frameMaxWidth: '640px', aspectPreset: 'classic' },
  crash:    { key: 'crash',    title: 'Cyber-Crash',    icon: '🚀', category: 'bet', frameMaxWidth: '640px', aspectPreset: 'landscape' },
  mines:    { key: 'mines',    title: 'Cyber Mines',    icon: '💣', category: 'bet', frameMaxWidth: '640px', aspectPreset: 'portrait' },
  wordle:   { key: 'wordle',   title: 'Cyber Wordle',   icon: '🔤', category: 'daily', frameMaxWidth: '560px', aspectPreset: 'portrait' },
  sudoku:   { key: 'sudoku',   title: 'Cyber Sudoku',   icon: '🔢', category: 'daily', frameMaxWidth: '560px', aspectPreset: 'portrait' }
};

export const PolyGameSDK = {
  /**
   * Normalizes mouse or touch coordinates to logical canvas resolution,
   * accounting for CSS responsive scaling and object-fit letterboxing.
   */
  getPointer(e, canvas) {
    if (!canvas) {
      return { x: 0, y: 0, normX: 0, normY: 0, inside: false, isTrusted: Boolean(e && e.isTrusted) };
    }
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if (e) {
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
      } else if (typeof e.clientX === 'number') {
        clientX = e.clientX;
        clientY = e.clientY;
      }
    }

    const logicalW = canvas.width || rect.width || 640;
    const logicalH = canvas.height || rect.height || 360;

    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return {
        x: clientX,
        y: clientY,
        normX: 0,
        normY: 0,
        inside: false,
        isTrusted: Boolean(e && e.isTrusted)
      };
    }

    const rawX = (clientX - rect.left) * (logicalW / rect.width);
    const rawY = (clientY - rect.top) * (logicalH / rect.height);
    const inside = rawX >= 0 && rawX <= logicalW && rawY >= 0 && rawY <= logicalH;
    const clampedX = Math.max(0, Math.min(logicalW, rawX));
    const clampedY = Math.max(0, Math.min(logicalH, rawY));

    return {
      x: clampedX,
      y: clampedY,
      rawX,
      rawY,
      normX: logicalW > 0 ? clampedX / logicalW : 0,
      normY: logicalH > 0 ? clampedY / logicalH : 0,
      inside,
      isTrusted: Boolean(e && e.isTrusted)
    };
  },

  /**
   * Computes the player's authoritative active multiplier and breakdown for a game.
   */
  getActiveMultiplier(gameKey = 'astrododge') {
    const normalizedKey = gameKey === 'arcade' ? 'astrododge' : (gameKey === 'catcher' ? 'stacker' : gameKey);
    const appState = typeof window !== 'undefined' ? window.appState : null;
    const multis = (appState && typeof appState.getMultipliers === 'function')
      ? appState.getMultipliers()
      : { nftGameMultiplier: 0, isApexUnlocked: false };

    const nftBonusPct = Number(multis.nftGameMultiplier || 0);
    const nftMult = 1 + (nftBonusPct / 100);

    const isVip = Boolean(appState && typeof appState.isVipActive === 'function' && appState.isVipActive());
    const vipLevel = (appState && typeof appState.getVipLevel === 'function') ? appState.getVipLevel() : (isVip ? 2 : 0);
    const vipMult = isVip ? (vipLevel >= 2 ? 2.0 : 1.5) : 1.0;

    const isAmb = Boolean(appState && appState.state && appState.state.isAmbassador);
    const ambMult = isAmb ? 2.0 : 1.0;

    let relicMult = (multis && multis.isApexUnlocked) ? 1.5 : 1.0;
    if ((normalizedKey === 'wordle' || normalizedKey === 'sudoku') && relicMult === 1.0) {
      const ownedRelics = (appState && appState.state && Array.isArray(appState.state.ownedRelics))
        ? appState.state.ownedRelics
        : [];
      if (ownedRelics.includes('relic_streak_freeze')) {
        relicMult = 1.05;
      }
    }

    let starshipMult = 1.0;
    let shipTierLabel = '';
    if (normalizedKey === 'astrododge' && typeof window !== 'undefined' && window.PolyHangar && typeof window.PolyHangar.getEquippedStarshipBoosts === 'function') {
      const shipBoosts = window.PolyHangar.getEquippedStarshipBoosts();
      if (shipBoosts && shipBoosts.isEquipped && Number(shipBoosts.earnMultiplier) > 1.0) {
        starshipMult = Number(shipBoosts.earnMultiplier);
        shipTierLabel = shipBoosts.rarity?.tier ? `${shipBoosts.rarity.tier} Starship` : 'NFT Starship';
      }
    }

    const total = nftMult * vipMult * ambMult * relicMult * starshipMult;
    const parts = [];
    if (nftMult > 1.0) parts.push(`NFTs ${nftMult.toFixed(2)}x (+${nftBonusPct}%)`);
    if (vipMult > 1.0) parts.push(`${vipLevel >= 2 ? 'Gold' : 'Silver'} VIP ${vipMult.toFixed(1)}x`);
    if (ambMult > 1.0) parts.push(`Ambassador ${ambMult.toFixed(1)}x`);
    if (relicMult > 1.0) parts.push(`Relic ${relicMult.toFixed(2)}x`);
    if (starshipMult > 1.0) parts.push(`${shipTierLabel} ${starshipMult.toFixed(2)}x`);

    const breakdownText = parts.length > 0
      ? `⚡ Active ${total.toFixed(2)}x Multiplier: ${parts.join(' × ')}`
      : `⚡ Base 1.00x Multiplier — Mint Utility NFTs, Relics, or VIP Pass to boost PGT rewards!`;

    return {
      total,
      nftMult,
      vipMult,
      ambMult,
      relicMult,
      starshipMult,
      shipTierLabel,
      parts,
      breakdownText
    };
  },

  /**
   * Binds standardized mobile touch controls (PLAN-021 Section 2.3):
   * Presets: 'left_right_action' | 'dpad_action' | 'swipe' | 'pointer_touch'
   */
  bindTouchControls(containerEl, preset, handlers = {}, options = {}) {
    if (!containerEl) return null;
    const gameTitle = options.gameTitle || 'Arcade Game';
    containerEl.style.touchAction = 'none';
    containerEl.style.userSelect = 'none';
    containerEl.style.webkitUserSelect = 'none';

    const verifyTrusted = (e, typeLabel = 'untrusted_touch_input') => {
      if (!e || e.isTrusted !== true) {
        if (typeof window !== 'undefined' && window.antiBot && typeof window.antiBot.reportSuspiciousActivity === 'function') {
          window.antiBot.reportSuspiciousActivity(gameTitle, typeLabel);
        }
        return false;
      }
      return true;
    };

    if (preset === 'swipe') {
      let startX = 0;
      let startY = 0;
      const threshold = options.threshold || 28;

      const onTouchStart = (e) => {
        if (!e.touches || e.touches.length === 0) return;
        if (!verifyTrusted(e)) return;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      };

      const onTouchEnd = (e) => {
        if (!e.changedTouches || e.changedTouches.length === 0) return;
        if (!verifyTrusted(e)) return;
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) {
          if (typeof handlers.onTap === 'function') handlers.onTap(e);
          return;
        }
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0 && typeof handlers.onSwipeRight === 'function') handlers.onSwipeRight(e);
          else if (dx < 0 && typeof handlers.onSwipeLeft === 'function') handlers.onSwipeLeft(e);
        } else {
          if (dy > 0 && typeof handlers.onSwipeDown === 'function') handlers.onSwipeDown(e);
          else if (dy < 0 && typeof handlers.onSwipeUp === 'function') handlers.onSwipeUp(e);
        }
      };

      containerEl.addEventListener('touchstart', onTouchStart, { passive: true });
      containerEl.addEventListener('touchend', onTouchEnd, { passive: true });
      return () => {
        containerEl.removeEventListener('touchstart', onTouchStart);
        containerEl.removeEventListener('touchend', onTouchEnd);
      };
    }

    if (preset === 'pointer_touch') {
      const canvas = options.canvas || containerEl.querySelector('canvas') || containerEl;
      const onStart = (e) => {
        if (!verifyTrusted(e)) return;
        if (typeof handlers.onDown === 'function') handlers.onDown(this.getPointer(e, canvas), e);
      };
      const onMove = (e) => {
        if (!verifyTrusted(e)) return;
        if (typeof handlers.onMove === 'function') handlers.onMove(this.getPointer(e, canvas), e);
      };
      const onEnd = (e) => {
        if (typeof handlers.onUp === 'function') handlers.onUp(this.getPointer(e, canvas), e);
      };
      containerEl.addEventListener('touchstart', onStart, { passive: false });
      containerEl.addEventListener('touchmove', onMove, { passive: false });
      containerEl.addEventListener('touchend', onEnd, { passive: true });
      return () => {
        containerEl.removeEventListener('touchstart', onStart);
        containerEl.removeEventListener('touchmove', onMove);
        containerEl.removeEventListener('touchend', onEnd);
      };
    }

    return null;
  }
};

export const PolyArcadeHost = {
  activeMode: 'arcade',
  activeGameKey: 'astrododge',

  getGameMeta(modeOrKey) {
    const clean = modeOrKey === 'arcade' ? 'astrododge' : (modeOrKey === 'catcher' ? 'stacker' : modeOrKey);
    if (ARCADE_GAMES_REGISTRY[clean]) {
      return Object.assign({ category: 'earn', frameMaxWidth: '640px', aspectPreset: 'landscape' }, ARCADE_GAMES_REGISTRY[clean]);
    }
    if (EXTRA_GAME_META[clean]) {
      return EXTRA_GAME_META[clean];
    }
    return {
      key: clean || 'astrododge',
      title: 'Arcade Game',
      icon: '🕹️',
      category: 'earn',
      frameMaxWidth: '640px',
      aspectPreset: 'landscape'
    };
  },

  /**
   * Synchronizes the Unified Arcade Top HUD Bar (.game-header-bar),
   * active multiplier pill, audio mute buttons, and outer frame attributes.
   */
  syncHeaderBar(mode = this.activeMode) {
    if (typeof document === 'undefined') return;
    this.activeMode = mode || 'arcade';
    const meta = this.getGameMeta(this.activeMode);
    this.activeGameKey = meta.key;

    const container = document.getElementById('game-window-container');
    if (container) {
      container.setAttribute('data-active-game', meta.key);
      container.setAttribute('data-aspect-preset', meta.aspectPreset || 'landscape');
    }

    const headerBar = document.getElementById('arcade-host-header-bar') || document.querySelector('.game-header-bar');
    if (headerBar) {
      headerBar.style.maxWidth = meta.frameMaxWidth || '640px';
    }

    const badgeEl = document.getElementById('arcade-host-game-badge');
    if (badgeEl) {
      badgeEl.innerHTML = `<span class="arcade-host-badge-icon">${meta.icon || '🕹️'}</span> <span class="arcade-host-badge-title">${meta.title || 'Arcade'}</span>`;
    }

    this.refreshMultiplierPill();
    this.syncMuteUI();
  },

  refreshMultiplierPill() {
    if (typeof document === 'undefined') return;
    const pillEl = document.getElementById('arcade-host-mult-pill');
    if (!pillEl) return;

    const meta = this.getGameMeta(this.activeMode);
    if (meta.category === 'bet') {
      pillEl.style.display = 'inline-flex';
      pillEl.innerHTML = `🎲 <span>Provably Fair</span>`;
      pillEl.title = 'Server-side cryptographic RNG via Supabase RPC';
      pillEl.setAttribute('data-mult-breakdown', '🎲 Provably Fair RNG — Outcomes verified server-side via Supabase RPCs.');
      return;
    }

    const multInfo = PolyGameSDK.getActiveMultiplier(meta.key);
    const formatted = multInfo.total >= 10 ? multInfo.total.toFixed(1) : multInfo.total.toFixed(2).replace(/\.00$/, '.0');
    pillEl.style.display = 'inline-flex';
    pillEl.innerHTML = `⚡ <span>${formatted}x Boost</span>`;
    pillEl.title = multInfo.breakdownText;
    pillEl.setAttribute('data-mult-breakdown', multInfo.breakdownText);
  },

  showMultiplierBreakdownToast() {
    const pillEl = document.getElementById('arcade-host-mult-pill');
    const msg = (pillEl && pillEl.getAttribute('data-mult-breakdown'))
      || PolyGameSDK.getActiveMultiplier(this.activeGameKey).breakdownText;
    if (typeof window !== 'undefined' && typeof window.triggerToast === 'function') {
      window.triggerToast(msg, 'info');
    }
  },

  syncMuteUI() {
    if (typeof document === 'undefined') return;
    const isEnabled = (typeof window !== 'undefined' && window.sfx) ? Boolean(window.sfx.enabled) : true;
    const headerMuteBtn = document.getElementById('arcade-host-mute-btn');
    if (headerMuteBtn) {
      headerMuteBtn.innerHTML = isEnabled ? '🔊' : '🔇';
      headerMuteBtn.title = isEnabled ? 'Mute Game Audio' : 'Unmute Game Audio';
      headerMuteBtn.setAttribute('aria-label', isEnabled ? 'Mute Game Audio' : 'Unmute Game Audio');
      headerMuteBtn.classList.toggle('is-muted', !isEnabled);
    }

    const fsMuteBtn = document.getElementById('btn-fullscreen-mute');
    if (fsMuteBtn) {
      fsMuteBtn.innerHTML = isEnabled ? '🔊' : '🔇';
      fsMuteBtn.title = isEnabled ? 'Mute Game Audio' : 'Unmute Game Audio';
      fsMuteBtn.setAttribute('aria-label', isEnabled ? 'Mute Game Audio' : 'Unmute Game Audio');
      fsMuteBtn.classList.toggle('is-muted', !isEnabled);
    }
  },

  toggleMute() {
    if (typeof window !== 'undefined' && window.sfx && typeof window.sfx.toggle === 'function') {
      const enabled = window.sfx.toggle();
      this.syncMuteUI();
      if (typeof window.triggerToast === 'function') {
        window.triggerToast(enabled ? '🔊 Game Audio Enabled' : '🔇 Game Audio Muted', 'info');
      }
      return enabled;
    }
    return true;
  }
};

export function initArcadeHost() {
  if (typeof window === 'undefined') return;
  window.PolyGameSDK = PolyGameSDK;
  window.PolyArcadeHost = PolyArcadeHost;
  window.toggleArcadeHostMute = () => PolyArcadeHost.toggleMute();
  window.showArcadeMultiplierInfo = () => PolyArcadeHost.showMultiplierBreakdownToast();

  const wrapSwitch = () => {
    if (typeof window.switchGameModeView === 'function' && !window.switchGameModeView._arcadeHostWrapped) {
      const orig = window.switchGameModeView;
      const wrapped = function(mode) {
        const res = orig.apply(this, arguments);
        PolyArcadeHost.syncHeaderBar(mode);
        return res;
      };
      wrapped._arcadeHostWrapped = true;
      window.switchGameModeView = wrapped;
    }
  };

  wrapSwitch();
  PolyArcadeHost.syncMuteUI();
  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      wrapSwitch();
      PolyArcadeHost.syncMuteUI();
    }, { once: true });
  }
}

initArcadeHost();
