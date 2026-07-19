import { sfx } from './core/audio.js';
import { renderNftMarketplace, renderNftInventory } from './features/nft.js';
import { checkFaucetCooldown } from './features/faucet.js';
import { appState } from './core/state.js';
import { loadAdminData } from './features/admin.js';
import { openModal } from './core/ui.js';
import { initStakingCycle, calculateStakingReward } from './features/staking.js';
import { syncProfileView, loadReferralLeaderboard, loadAstroDodgeLeaderboard, loadInvadersLeaderboard, autoConnectWeb3, loadHoldersLeaderboard } from './features/profile.js';
import { executeWithdrawPGT } from './features/roshambo.js';
import { triggerToast } from './core/ui.js';
import './core/db-sync.js';

// Expose critical state and UI functions globally for legacy non-module scripts (game.js, invaders.js)
window.appState = appState;
window.triggerToast = triggerToast;

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
  }
  if (tabId === 'games' || tabId === 'dashboard') {
    loadAstroDodgeLeaderboard();
    loadInvadersLeaderboard();
  }
  if (tabId === 'referrals') {
    loadReferralLeaderboard();
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

  // Auto connect real wallet on load if already logged in
  autoConnectWeb3();

  // Bind PGT Withdraw executor click
  const executeWithdrawBtn = document.getElementById('btn-execute-withdraw');
  if (executeWithdrawBtn) {
    executeWithdrawBtn.addEventListener('click', executeWithdrawPGT);
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

