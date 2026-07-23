import { sfx } from './core/audio.js';
import { renderNftMarketplace, renderNftInventory } from './features/nft.js';
import { checkFaucetCooldown } from './features/faucet.js';
import { appState } from './core/state.js';
import { loadAdminData } from './features/admin.js';
import { openModal } from './core/ui.js?v=8';
import { initStakingCycle, calculateStakingReward } from './features/staking.js';
import { syncProfileView, loadReferralLeaderboard, loadAstroDodgeLeaderboard, loadInvadersLeaderboard, autoConnectWeb3, loadHoldersLeaderboard, loadWeeklyWinsLeaderboard } from './features/profile.js';
import { executeWithdrawPGT } from './features/roshambo.js';
import { triggerToast } from './core/ui.js?v=8';
import { syncJackpotData, recordGameMetrics, syncGlobalSettings } from './core/db-sync.js';

// Import new games and utilities
import './utils/discord.js';
import './features/crash.js';
import './features/plinko.js';

// Expose critical state and UI functions globally for legacy non-module scripts (game.js, invaders.js)
window.appState = appState;
window.triggerToast = triggerToast;
window.recordGameMetrics = recordGameMetrics;

// --- Master View Switcher (Router) ---

export function switchTab(tabId) {
  // Play sound
  sfx.init();
  
  // Deactivate current tabs
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  // Activate new link
  const targetLink = document.querySelector(`.nav-link[data-tab="${tabId}"]`);
  if (targetLink) targetLink.classList.add('active');

  // Activate new panel
  const targetPanel = document.getElementById(`view-${tabId}`);
  if (targetPanel) targetPanel.classList.add('active');

  // Update header text
  const viewTitle = document.getElementById('view-title');
  if (viewTitle) {
    viewTitle.innerText = targetLink ? targetLink.innerText.trim() : 'Dashboard';
  }

  // Custom view initializers
  if (tabId === 'nft') {
    renderNftMarketplace();
    renderNftInventory();
  }
  if (tabId === 'profile') {
    syncProfileView();
  }
  if (tabId === 'admin') {
    loadAdminData();
    if (window.syncReferralData) window.syncReferralData();
  }
  if (tabId === 'games' || tabId === 'dashboard') {
    loadAstroDodgeLeaderboard();
    loadInvadersLeaderboard();
    loadWeeklyWinsLeaderboard();
    if (window.initPolySpace) window.initPolySpace();
  }
  if (tabId === 'referrals') {
    loadReferralLeaderboard();
    if (window.syncReferralData) window.syncReferralData();
  }
  if (tabId === 'holders') {
    loadHoldersLeaderboard();
  }
}
window.switchTab = switchTab;

// --- Initialization / Routing binds ---

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    const tab = link.getAttribute('data-tab');
    switchTab(tab);
  });
});

// Sound toggler
document.getElementById('sound-toggle-btn').addEventListener('click', () => {
  sfx.toggle();
});

// Header Wallet buttons
document.getElementById('btn-wallet-connect').addEventListener('click', () => {
  openModal('wallet');
});
document.getElementById('wallet-address-display').addEventListener('click', () => {
  openModal('wallet');
});

// Window startup
export function initializeApp() {
  appState.syncUI();
  checkFaucetCooldown();
  initStakingCycle();
  calculateStakingReward();
  
  // Set up initial leaderboard data
  loadAstroDodgeLeaderboard();
  loadInvadersLeaderboard();

  // Load initial jackpot data
  syncJackpotData();
  syncGlobalSettings();

  // Auto connect real wallet on load if already logged in
  autoConnectWeb3();

  // Bind PGT Withdraw executor click
  const executeWithdrawBtn = document.getElementById('btn-execute-withdraw');
  if (executeWithdrawBtn) {
    executeWithdrawBtn.addEventListener('click', executeWithdrawPGT);
  }
}

// Fullscreen Mobile Game Canvas Helpers
window.openMobileGameFullscreen = function() {
  const container = document.getElementById('game-window-container');
  if (!container) return;

  container.classList.add('fullscreen-active');
  document.body.classList.add('game-fullscreen-open');

  if (container.requestFullscreen) {
    container.requestFullscreen().catch(() => {});
  } else if (container.webkitRequestFullscreen) {
    container.webkitRequestFullscreen();
  }

  setTimeout(() => window.dispatchEvent(new Event('resize')), 80);
};

window.toggleGameFullscreen = function() {
  const container = document.getElementById('game-window-container');
  if (!container) return;

  const isFullscreen = container.classList.contains('fullscreen-active');
  if (isFullscreen) {
    window.exitGameFullscreen();
  } else {
    window.openMobileGameFullscreen();
  }
};

window.exitGameFullscreen = function() {
  const container = document.getElementById('game-window-container');
  if (container) container.classList.remove('fullscreen-active');
  document.body.classList.remove('game-fullscreen-open');

  document.body.style.overflow = '';
  document.body.style.touchAction = '';

  if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement) {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    }
  }
  setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
};

['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
  document.addEventListener(evt, () => {
    const isFS = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
    if (!isFS) {
      const container = document.getElementById('game-window-container');
      if (container) container.classList.remove('fullscreen-active');
      document.body.classList.remove('game-fullscreen-open');
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
  });
});

// --- Global Security & Runtime Anomaly Monitor ---
window.addEventListener('error', (e) => {
  if (typeof window.sendAdminAlert === 'function' && e.message) {
    if (window._lastLoggedError === e.message) return; // Prevent spamming duplicate errors
    window._lastLoggedError = e.message;
    
    window.sendAdminAlert({
      category: 'RUNTIME ERROR',
      title: '❌ Client-Side Exception Caught',
      description: `\`\`\`js\n${e.message.substring(0, 300)}\n\`\`\``,
      color: 0xFF9900,
      fields: [
        { name: "Source", value: `${(e.filename || 'app.js').split('/').pop()}:${e.lineno}:${e.colno}`, inline: true }
      ]
    });
  }
});

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

