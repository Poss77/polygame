import { renderDailyQuestsUI, trackQuestProgress } from './features/quests.js';
import { sfx } from './core/audio.js';
import { renderNftMarketplace, renderNftInventory } from './features/nft.js';
import { checkFaucetCooldown } from './features/faucet.js';
import { appState } from './core/state.js';
import { loadAdminData } from './features/admin.js';
import { openModal } from './core/ui.js';
import { initStakingCycle, calculateStakingReward } from './features/staking.js';
import { syncProfileView, loadReferralLeaderboard, loadAstroDodgeLeaderboard, loadInvadersLeaderboard, autoConnectWeb3, loadHoldersLeaderboard, loadWeeklyWinsLeaderboard } from './features/profile.js';
import { triggerToast } from './core/ui.js';
import { syncJackpotData, recordGameMetrics, syncGlobalSettings } from './core/db-sync.js';
import { APP_VERSION, ADMIN_WALLET_ADDRESS, supabase } from './core/config.js';

import { initPWA } from './utils/pwa.js';

// Import new games and utilities
import './utils/discord.js';
import './features/games.js';
import './features/spinner.js';
import './features/roshambo.js';
import './features/crash.js';
import './features/plinko.js';
import './features/mines.js';
import './features/withdraw.js';
import './features/relics.js';
import './utils/confetti.js';
import '../../skeet.js';
import '../../defense.js';

// Expose critical state and UI functions globally for legacy non-module scripts (game.js, invaders.js)
window.appState = appState;
window.triggerToast = triggerToast;
window.recordGameMetrics = recordGameMetrics;
window.launchPolySpace = launchPolySpace;
window.supabaseClient = supabase;

// --- Master View Switcher (Router) ---

export function launchPolySpace() {
  switchTab('space');
}
window.launchPolySpace = launchPolySpace;

export function switchTab(tabId) {
  // Always remove fullscreen lock on tab switch so bottom nav is guaranteed visible
  document.body.classList.remove('game-fullscreen-open');
  const sidebarEl = document.querySelector('.sidebar');
  if (sidebarEl) sidebarEl.style.display = '';

  const VALID_TABS = ['dashboard', 'faucet', 'games', 'space', 'nft', 'vault', 'staking', 'referrals', 'profile', 'holders', 'links', 'admin'];
  
  let cleanTab = (typeof tabId === 'string' ? tabId.replace(/^#/, '').toLowerCase().trim() : '');
  if (cleanTab === 'vault') cleanTab = 'staking';
  if (!cleanTab || cleanTab.includes('=') || cleanTab.includes('&') || !VALID_TABS.includes(cleanTab)) {
    cleanTab = 'dashboard';
  }
  tabId = cleanTab;

  const expectedAdmin = (ADMIN_WALLET_ADDRESS || "0x10b9993990c9ef8a212c9557cb02ad94da9a654d").toLowerCase();
  const primary = (typeof appState.state.walletAddress === 'string' ? appState.state.walletAddress : '').toLowerCase();
  const linked = (typeof appState.state.linkedWalletAddress === 'string' ? appState.state.linkedWalletAddress : '').toLowerCase();
  const pid = (typeof appState.state.playerId === 'string' ? appState.state.playerId : '').toLowerCase();
  const injected = (typeof window !== 'undefined' && window.ethereum && typeof window.ethereum.selectedAddress === 'string' ? window.ethereum.selectedAddress : '').toLowerCase();

  const isAdmin = (
    (primary && primary === expectedAdmin) ||
    (linked && linked === expectedAdmin) ||
    (pid && pid === expectedAdmin) ||
    (injected && injected === expectedAdmin)
  );

  const adminPanelEl = document.getElementById('view-admin');

  if (tabId === 'admin') {
    if (!isAdmin) {
      triggerToast("Access Denied: Master Admin wallet required.", "error");
      if (adminPanelEl) {
        adminPanelEl.classList.remove('active');
        adminPanelEl.classList.remove('admin-authorized');
        adminPanelEl.style.setProperty('display', 'none', 'important');
      }
      tabId = 'dashboard';
    } else {
      if (adminPanelEl) {
        adminPanelEl.classList.add('admin-authorized');
        adminPanelEl.style.display = '';
      }
    }
  } else {
    if (adminPanelEl) {
      adminPanelEl.classList.remove('active');
      adminPanelEl.style.setProperty('display', 'none', 'important');
    }
  }

  if (tabId !== 'games' && typeof window.closeGameView === 'function') {
    window.closeGameView();
  }

  // Initialize audio only if user has interacted, complying with browser Autoplay policy
  try {
    if (window._userHasInteracted && sfx && typeof sfx.init === 'function') sfx.init();
  } catch (e) {}
  
  // Deactivate current tabs
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
  });
  document.querySelectorAll('.view-panel').forEach(panel => {
    if (panel.id !== 'view-admin' || !isAdmin || tabId !== 'admin') {
      panel.classList.remove('active');
    }
  });

  // Activate target panel with guaranteed fallback to view-dashboard
  let targetPanel = document.getElementById(`view-${tabId}`);
  let targetLink = document.querySelector(`.nav-link[data-tab="${tabId}"]`);

  if (!targetPanel) {
    tabId = 'dashboard';
    targetPanel = document.getElementById('view-dashboard');
    targetLink = document.querySelector('.nav-link[data-tab="dashboard"]');
  }

  if (targetLink) targetLink.classList.add('active');
  if (targetPanel) {
    targetPanel.classList.add('active');
    if (tabId === 'admin' && isAdmin) {
      targetPanel.style.display = '';
    }
  }

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
    },
    links: {
      title: "Official Ecosystem Links, Smart Contracts & QuickSwap DEX - Polygon Gaming",
      desc: "Verified Polygon smart contracts for PGT token, QuickSwap DEX swap, OpenSea NFT collections, Quantum Relics, and official community links."
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
  if (tabId === 'space') {
    if (window.polySpaceEngine) {
      setTimeout(() => window.polySpaceEngine.init(), 50);
    } else if (window.initPolySpace) {
      window.initPolySpace();
    }
    if (window.polySpace && typeof window.polySpace.syncCloudSpaceState === 'function') {
      window.polySpace.syncCloudSpaceState(true);
    }
  }
  if (tabId === 'games' || tabId === 'dashboard') {
    loadAstroDodgeLeaderboard();
    loadInvadersLeaderboard();
    loadWeeklyWinsLeaderboard();
    if (typeof window.loadSkeetLeaderboard === 'function') window.loadSkeetLeaderboard();
    if (typeof window.loadDefenseLeaderboard === 'function') window.loadDefenseLeaderboard();
    if (window.initPolySpace) window.initPolySpace();
    if (typeof window.updateGameTileBadges === 'function') window.updateGameTileBadges();
  }
  if (tabId === 'referrals') {
    if (typeof window.loadTopReferrersLeaderboard === 'function') window.loadTopReferrersLeaderboard();
    if (typeof window.updateReferralUiStats === 'function') window.updateReferralUiStats();
    if (typeof window.loadMyDownlineNetwork === 'function') window.loadMyDownlineNetwork();
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

export function navigateToQuests() {
  switchTab('dashboard');
  setTimeout(() => {
    const card = document.getElementById('dashboard-quests-card');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.transition = 'box-shadow 0.4s ease';
      card.style.boxShadow = '0 0 30px rgba(0, 240, 255, 0.6)';
      setTimeout(() => {
        card.style.boxShadow = '';
      }, 2000);
    }
  }, 100);
}
window.navigateToQuests = navigateToQuests;

// --- Initialization / Routing binds ---

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    const tab = link.getAttribute('data-tab');
    if (tab) switchTab(tab);
  });
});

window.addEventListener('hashchange', () => {
  if (window.location.hash) {
    const rawHash = window.location.hash.replace(/^#/, '').toLowerCase().trim();
    const VALID_TABS = ['dashboard', 'faucet', 'games', 'space', 'nft', 'vault', 'staking', 'referrals', 'profile', 'holders', 'links', 'admin'];
    if (rawHash && VALID_TABS.includes(rawHash)) {
      switchTab(rawHash);
    }
  }
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

export async function forcePurgeAppCache() {
  triggerToast("Updating app to latest version...", "info");
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let reg of registrations) {
        await reg.unregister();
      }
    }
  } catch (e) {
    console.warn("[PWA] Cache purge notice:", e);
  }
  localStorage.setItem('polygame_last_seen_version', APP_VERSION);
  window.location.reload(true);
}
window.forcePurgeAppCache = forcePurgeAppCache;

export function checkNewUpdateBadge() {
  const versionDisplay = document.getElementById('app-version-display');
  if (versionDisplay) {
    versionDisplay.innerHTML = `v${APP_VERSION} 🔄`;
  }

  const lastSeenVersion = localStorage.getItem('polygame_last_seen_version');
  if (lastSeenVersion !== APP_VERSION) {
    // Automatically purge old cache versions on mobile WebViews & PWA
    if ('caches' in window) {
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(() => {});
    }

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
  // Enforce strict initial Admin Panel DOM lockdown
  const expectedAdmin = (ADMIN_WALLET_ADDRESS || "0x10b9993990c9ef8a212c9557cb02ad94da9a654d").toLowerCase();
  const primary = (typeof appState.state.walletAddress === 'string' ? appState.state.walletAddress : '').toLowerCase();
  const linked = (typeof appState.state.linkedWalletAddress === 'string' ? appState.state.linkedWalletAddress : '').toLowerCase();
  const pid = (typeof appState.state.playerId === 'string' ? appState.state.playerId : '').toLowerCase();
  const injected = (typeof window !== 'undefined' && window.ethereum && typeof window.ethereum.selectedAddress === 'string' ? window.ethereum.selectedAddress : '').toLowerCase();
  const isAdmin = (
    (primary && primary === expectedAdmin) ||
    (linked && linked === expectedAdmin) ||
    (pid && pid === expectedAdmin) ||
    (injected && injected === expectedAdmin)
  );

  const adminPanelEl = document.getElementById('view-admin');
  const adminNavEl = document.getElementById('nav-item-admin');
  const adminCardEl = document.getElementById('profile-admin-card');

  if (!isAdmin) {
    if (adminPanelEl) {
      adminPanelEl.classList.remove('active');
      adminPanelEl.classList.remove('admin-authorized');
      adminPanelEl.style.setProperty('display', 'none', 'important');
    }
    if (adminNavEl) {
      adminNavEl.classList.remove('admin-unlocked');
      adminNavEl.style.setProperty('display', 'none', 'important');
    }
    if (adminCardEl) {
      adminCardEl.style.setProperty('display', 'none', 'important');
    }
  }

  // Handle OAuth error return gracefully (e.g. ?error=invalid_request&error_code=bad_oauth_state)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('error') || urlParams.has('error_code') || urlParams.has('error_description')) {
    const errCode = urlParams.get('error_code') || urlParams.get('error') || '';
    const errDesc = urlParams.get('error_description') || '';
    console.warn("[OAuth Auth Callback Warning]", errCode, errDesc);
    if (errCode.includes('bad_oauth_state') || errDesc.includes('OAuth state not found') || errCode.includes('invalid_request')) {
      setTimeout(() => {
        if (typeof window.triggerToast === 'function') {
          window.triggerToast("⚠️ Google Sign-In session expired or was cancelled. Please try again.", "warning");
        }
      }, 500);
    }
    // Clean URL query parameters so messy error strings don't persist
    try {
      const cleanUrl = window.location.origin + window.location.pathname + (window.location.hash || '');
      window.history.replaceState({}, document.title, cleanUrl);
    } catch (e) {}
  }

  // Ensure all inactive modals are completely hidden and cannot intercept clicks
  document.querySelectorAll('.modal-overlay:not(.active)').forEach(el => {
    el.style.display = 'none';
    el.style.pointerEvents = 'none';
  });

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

  startLeaderboardResetTimer();

  // Handle URL hash navigation on load (e.g. #admin, #faucet, #space, #nft)
  if (window.location.hash) {
    const rawHash = window.location.hash.replace(/^#/, '').toLowerCase().trim();
    const VALID_TABS = ['dashboard', 'faucet', 'games', 'space', 'nft', 'vault', 'staking', 'referrals', 'profile', 'holders', 'links', 'admin'];
    
    // Check if hash is an OAuth token fragment (e.g. #access_token=...&refresh_token=...)
    if (rawHash.includes('access_token') || rawHash.includes('refresh_token') || rawHash.includes('token_type') || rawHash.includes('error=')) {
      try {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (e) {}
      setTimeout(() => switchTab('dashboard'), 100);
    } else if (VALID_TABS.includes(rawHash)) {
      setTimeout(() => switchTab(rawHash), 100);
    } else {
      setTimeout(() => switchTab('dashboard'), 100);
    }
  } else {
    setTimeout(() => switchTab('dashboard'), 50);
  }
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

  // Trigger game resize handlers immediately and after transition
  const triggerResizes = () => {
    if (window.cyberStacker && typeof window.cyberStacker.resize === 'function') window.cyberStacker.resize();
    if (window.skeetEngine && typeof window.skeetEngine.resizeCanvas === 'function') window.skeetEngine.resizeCanvas();
    if (window.cyberDrift && typeof window.cyberDrift.resize === 'function') window.cyberDrift.resize();
    window.dispatchEvent(new Event('resize'));
  };

  triggerResizes();
  setTimeout(triggerResizes, 100);
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

      if (window.cyberStacker && typeof window.cyberStacker.resize === 'function') window.cyberStacker.resize();
      if (window.skeetEngine && typeof window.skeetEngine.resizeCanvas === 'function') window.skeetEngine.resizeCanvas();
      if (window.cyberDrift && typeof window.cyberDrift.resize === 'function') window.cyberDrift.resize();
      setTimeout(() => window.dispatchEvent(new Event('resize')), 80);
    }
  });
});

// --- Global Security & Runtime Anomaly Monitor ---
window.addEventListener('error', (e) => {
  if (typeof window.sendAdminAlert === 'function' && e.message) {
    const filename = (e.filename || '').toLowerCase();
    const msg = (e.message || '').toLowerCase();
    
    // Filter out third-party browser extension noise, mobile browser injections (e.g. Chrome iOS __gCrWeb), & cancelled OAuth states
    if (
      filename.includes('inject') || 
      filename.includes('extension') || 
      filename.includes('contentscript') ||
      filename.includes('core.mjs') ||
      msg.includes('__gcrweb') ||
      msg.includes('gcrweb') ||
      msg.includes('bad_oauth_state') ||
      msg.includes('oauth state not found') ||
      msg.includes('user rejected') ||
      msg.includes('user denied') ||
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

// --- Unhandled Promise Rejection Sentinel ---
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const reasonStr = (typeof reason === 'object' && reason !== null)
    ? (reason.message || reason.details || reason.stack || JSON.stringify(reason) || '')
    : String(reason || '');
  const lowerMsg = reasonStr.toLowerCase();

  // 1. Suppress browser extension message channel / port disconnect noise (MetaMask, Coinbase, Phantom, etc.)
  // e.g. "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received"
  if (
    lowerMsg.includes('message channel closed') ||
    lowerMsg.includes('listener indicated an asynchronous response') ||
    lowerMsg.includes('message port closed') ||
    lowerMsg.includes('could not establish connection') ||
    lowerMsg.includes('user rejected') ||
    lowerMsg.includes('user denied') ||
    lowerMsg.includes('chrome-extension://') ||
    lowerMsg.includes('moz-extension://')
  ) {
    event.preventDefault(); // Prevents "Uncaught (in promise)" in browser console
    return;
  }

  // 2. Suppress transient network connectivity / connection timeouts
  if (
    lowerMsg.includes('err_connection_timed_out') ||
    lowerMsg.includes('connection timed out') ||
    lowerMsg.includes('failed to fetch') ||
    lowerMsg.includes('network request failed') ||
    lowerMsg.includes('networkerror') ||
    lowerMsg.includes('load failed')
  ) {
    event.preventDefault();
    console.warn('[PolyGame Network Notice] Handled background network timeout gracefully:', reasonStr.substring(0, 150));
    return;
  }
});

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

