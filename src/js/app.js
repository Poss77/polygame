import { renderDailyQuestsUI, trackQuestProgress } from './features/quests.js';
import { sfx } from './core/audio.js';
import { renderNftMarketplace, renderNftInventory } from './features/nft.js';
import { checkFaucetCooldown } from './features/faucet.js';
import { appState } from './core/state.js';
import { loadAdminData } from './features/admin.js';
import { openModal } from './core/ui.js';
import { initStakingCycle, calculateStakingReward } from './features/staking.js';
import { syncProfileView, loadReferralLeaderboard, loadAstroDodgeLeaderboard, loadInvadersLeaderboard, autoConnectWeb3, loadHoldersLeaderboard, loadWeeklyWinsLeaderboard } from './features/profile.js';
import { executeWithdrawPGT } from './features/roshambo.js';
import { triggerToast } from './core/ui.js';
import { syncJackpotData, recordGameMetrics, syncGlobalSettings } from './core/db-sync.js';
import { APP_VERSION } from './core/config.js';

import { initPWA } from './utils/pwa.js';

// Import new games and utilities
import './utils/discord.js';
import './features/crash.js';
import './features/plinko.js';

// Expose critical state and UI functions globally for legacy non-module scripts (game.js, invaders.js)
window.appState = appState;
window.triggerToast = triggerToast;
window.recordGameMetrics = recordGameMetrics;

// --- Master View Switcher (Router) ---

export function launchPolySpace() {
  switchTab('games');
  if (typeof window.switchGameCategory === 'function') {
    window.switchGameCategory('adventure');
  }
}
window.launchPolySpace = launchPolySpace;

export function switchTab(tabId) {
  if (tabId === 'space') {
    launchPolySpace();
    return;
  }


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

  // Update document title & meta description dynamically for SEO
  const seoMetadata = {
    dashboard: {
      title: "Polygon Gaming | #1 Web3 Arcade, PolySpace Mining & PGT Faucet",
      desc: "Polygon Gaming (polygongaming.io) is the ultimate Web3 Play-to-Earn gaming portal on Polygon. Play 60 FPS arcade games, command PolySpace space mining fleets, claim free hourly PGT faucets, stake tokens, and earn 4-tier referral commissions."
    },
    faucet: {
      title: "Free Crypto Faucet | Claim Hourly PGT Tokens - Polygon Gaming",
      desc: "Claim free Polygon Gaming Tokens (PGT) every hour on Polygon network. Upgrade with VIP Supporter Subscription for 2x payouts and 10% faster 21.6h cooldowns."
    },
    games: {
      title: "Web3 Arcade Games | Play Astro-Dodge & Win PGT - Polygon Gaming",
      desc: "Play 60 FPS retro Web3 arcade games on Polygon including Astro-Dodge, Cyber Invaders, and Cyber Drift. Convert high scores into PGT token rewards."
    },
    space: {
      title: "PolySpace Space Mining Operations | Passive PGT Yield - Polygon Gaming",
      desc: "Command your Starship fleet in PolySpace. Upgrade plasma mining drills, launch space expeditions across distant exoplanets, and harvest raw PGT loot."
    },
    nft: {
      title: "Utility NFT Marketplace | Passive PGT Multipliers & VIP Pass - Polygon Gaming",
      desc: "Collect Utility NFTs on Polygon to unlock permanent passive multipliers on Faucet claims, Arcade payouts, and 4-tier referral commissions."
    },
    vault: {
      title: "PGT Staking Vault | High Yield APY Staking Pools - Polygon Gaming",
      desc: "Stake your Polygon Gaming Tokens (PGT) in high-yield vault pools. Earn passive APY interest with flexible and locked staking options."
    },
    referrals: {
      title: "4-Tier Referral Program | Earn Downline PGT Commissions - Polygon Gaming",
      desc: "Invite friends to Polygon Gaming and earn up to 20% downline commissions across 4 tiers on all faucet claims, arcade earnings, and staking harvests."
    },
    holders: {
      title: "Top PGT Token Holders & Leaderboard - Polygon Gaming",
      desc: "View top PGT token holders, arcade high score leaderboards, and top referral earners on Polygon Gaming."
    },
    profile: {
      title: "Player Profile & Account Stats - Polygon Gaming",
      desc: "Manage your Web3 wallet address, track PGT balance, view owned Utility NFTs, and review activity history on Polygon Gaming."
    }
  };

  const currentSeo = seoMetadata[tabId] || seoMetadata.dashboard;
  document.title = currentSeo.title;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', currentSeo.desc);

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
    if (typeof window.loadPolPayoutRequests === 'function') window.loadPolPayoutRequests();
    if (window.syncReferralData) window.syncReferralData();
  }
  if (tabId === 'games' || tabId === 'dashboard') {
    loadAstroDodgeLeaderboard();
    loadInvadersLeaderboard();
    loadWeeklyWinsLeaderboard();
    if (window.initPolySpace) window.initPolySpace();
  }
  if (tabId === 'referrals') {
    if (typeof window.loadTopReferrersLeaderboard === 'function') window.loadTopReferrersLeaderboard();
    if (typeof window.updateReferralUiStats === 'function') window.updateReferralUiStats();
    if (window.syncReferralData) window.syncReferralData();
  }
  if (tabId === 'profile') {
    if (typeof window.syncAmbassadorProfileBadge === 'function') window.syncAmbassadorProfileBadge();
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
    if (tab) switchTab(tab);
  });
});

// Sound toggler
const soundBtn = document.getElementById('sound-toggle-btn');
if (soundBtn) {
  soundBtn.addEventListener('click', () => {
    sfx.toggle();
  });
}

// Header Wallet buttons
const walletBtn = document.getElementById('btn-wallet-connect');
if (walletBtn) {
  walletBtn.addEventListener('click', () => {
    openModal('wallet');
  });
}

const walletDisp = document.getElementById('wallet-address-display');
if (walletDisp) {
  walletDisp.addEventListener('click', () => {
    openModal('wallet');
  });
}

export function checkNewUpdateBadge() {
  const versionDisplay = document.getElementById('app-version-display');
  if (versionDisplay) {
    versionDisplay.innerText = `v${APP_VERSION}`;
  }

  const lastSeenVersion = localStorage.getItem('polygame_last_seen_version');
  if (lastSeenVersion !== APP_VERSION) {
    const badgeDesktop = document.getElementById('new-update-badge');
    const badgeMobile = document.getElementById('new-update-badge-mobile');

    [badgeDesktop, badgeMobile].forEach(badge => {
      if (badge) {
        badge.style.display = 'block';
        setTimeout(() => {
          badge.style.opacity = '1';
        }, 50);

        // Auto fade out after 5 seconds (5000 ms)
        setTimeout(() => {
          badge.style.opacity = '0';
          setTimeout(() => {
            badge.style.display = 'none';
          }, 500); // 500ms smooth fade out transition
        }, 5000);
      }
    });

    // Save current version in localStorage so it only appears on first login/visit after update
    localStorage.setItem('polygame_last_seen_version', APP_VERSION);
  }
}

// Window startup
export function initializeApp() {
  appState.syncUI();
  checkFaucetCooldown();
  initStakingCycle();
  calculateStakingReward();
  checkNewUpdateBadge();
  initPWA();
  
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

  startLeaderboardResetTimer();
}

function startLeaderboardResetTimer() {
  function updateTimers() {
    const now = new Date();
    const nextSunday = new Date(now.getTime());
    const daysUntilSunday = (7 - now.getUTCDay()) % 7;
    
    nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
    nextSunday.setUTCHours(23, 59, 59, 999);

    const diff = nextSunday.getTime() - now.getTime();
    if (diff > 0) {
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const mins = Math.floor((diff / 1000 / 60) % 60);

      const dStr = days + 'd';
      const hStr = hours.toString().padStart(2, '0') + 'h';
      const mStr = mins.toString().padStart(2, '0') + 'm';
      const timeStr = `Resets: ${dStr} ${hStr} ${mStr}`;
      
      document.querySelectorAll('.leaderboard-reset-timer').forEach(el => {
        el.innerText = timeStr;
      });
    }
  }

  updateTimers();
  setInterval(updateTimers, 60000);
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
    const filename = (e.filename || '').toLowerCase();
    const msg = (e.message || '').toLowerCase();
    
    // Filter out third-party browser extension noise & external Web3 worker teardown glitches
    if (
      filename.includes('inject') || 
      filename.includes('extension') || 
      filename.includes('contentscript') ||
      filename.includes('core.mjs') ||
      msg.includes('terminate is not a function') ||
      msg.includes('invalid or unexpected token')
    ) {
      return;
    }

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

