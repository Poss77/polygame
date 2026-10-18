// ============================================================
// POLYGAME: ARCADE GAMES VIEW & TAB NAVIGATION ROUTER
// Manages tab switching, fullscreen mode, and game panel routing
// ============================================================

import { supabase } from '../core/config.js';
import { escapeHtml, openModal, closeModal } from '../core/ui.js';
import { getWeeklyPrizeForRank } from './profile.js';

export function isAnyArcadeGamePlaying() {
  if (typeof window === 'undefined') return false;
  return !!(
    (window.dodgeGame && window.dodgeGame.isPlaying) ||
    (window.invadersGame && window.invadersGame.isPlaying) ||
    (window.cyberDrift && window.cyberDrift.isRunning) ||
    (window.cyberStacker && window.cyberStacker.isPlaying) ||
    (window.skeetEngine && window.skeetEngine.isPlaying) ||
    (window.defenseEngine && window.defenseEngine.isPlaying) ||
    (window.cyberRunner && window.cyberRunner.isRunning) ||
    (window.cyber2048 && window.cyber2048.isPlaying) ||
    (window.cyberTetrisGame && window.cyberTetrisGame.isPlaying)
  );
}
if (typeof window !== 'undefined') {
  window.isAnyArcadeGamePlaying = isAnyArcadeGamePlaying;
}

export function switchGameCategory(category) {
  const tabEarn = document.getElementById('tab-category-earn');
  const tabBet = document.getElementById('tab-category-bet');

  const gridEarn = document.getElementById('grid-category-earn');
  const gridBet = document.getElementById('grid-category-bet');

  if (tabEarn) tabEarn.classList.remove('active');
  if (tabBet) tabBet.classList.remove('active');

  if (gridEarn) { gridEarn.style.display = 'none'; gridEarn.classList.remove('grid-category-hidden'); }
  if (gridBet) { gridBet.style.display = 'none'; gridBet.classList.remove('grid-category-hidden'); }

  if (category === 'earn' && tabEarn && gridEarn) {
    tabEarn.classList.add('active');
    gridEarn.style.display = 'grid';
    if (typeof loadTopWeeklyArcadePlayers === 'function') {
      loadTopWeeklyArcadePlayers();
    }
  } else if (category === 'bet' && tabBet && gridBet) {
    tabBet.classList.add('active');
    gridBet.style.display = 'block';
  }

  // Ensure game view is closed and all active panels hidden when switching category
  closeGameView();
}

export function closeGameView() {
  try {
    document.body.classList.remove('game-fullscreen-open');
    const sidebarEl = document.querySelector('.sidebar');
    if (sidebarEl) sidebarEl.style.display = '';

    if (typeof window.exitGameFullscreen === 'function') {
      window.exitGameFullscreen();
    }

    // Stop active game loops cleanly
    try { if (window.dodgeGame && typeof window.dodgeGame.stop === 'function') window.dodgeGame.stop(); else if (window.dodgeGame) window.dodgeGame.isPlaying = false; } catch (e) {}
    try { if (window.invadersGame && typeof window.invadersGame.stop === 'function') window.invadersGame.stop(); else if (window.invadersGame) window.invadersGame.isPlaying = false; } catch (e) {}
    try { if (window.cyberDrift && typeof window.cyberDrift.stop === 'function') window.cyberDrift.stop(); else if (window.cyberDrift) window.cyberDrift.isRunning = false; } catch (e) {}
    try { if (window.cyberStacker && typeof window.cyberStacker.stop === 'function') window.cyberStacker.stop(); else if (window.cyberStacker) window.cyberStacker.isPlaying = false; } catch (e) {}
    try { if (window.skeetEngine && typeof window.skeetEngine.stop === 'function') window.skeetEngine.stop(); } catch (e) {}
    try { if (window.defenseEngine && typeof window.defenseEngine.stop === 'function') window.defenseEngine.stop(); } catch (e) {}
    try { if (window.cyberRunner && typeof window.cyberRunner.stop === 'function') window.cyberRunner.stop(); else if (window.cyberRunner) window.cyberRunner.isRunning = false; } catch (e) {}
    try { if (window.cyber2048 && typeof window.cyber2048.stop === 'function') window.cyber2048.stop(); else if (window.cyber2048) window.cyber2048.isPlaying = false; } catch (e) {}
    try { if (window.cyberTetrisGame && typeof window.cyberTetrisGame.stop === 'function') window.cyberTetrisGame.stop(); else if (window.cyberTetrisGame) window.cyberTetrisGame.isPlaying = false; } catch (e) {}
    try { if (typeof window.stopPlinkoLoop === 'function') window.stopPlinkoLoop(); } catch (e) {}

    // Restore start screen UI overlays so game is ready when player returns
    const overlayArcade = document.getElementById('game-ui-overlay');
    const overlayInvaders = document.getElementById('invaders-ui-overlay');
    const startDrift = document.getElementById('drift-start-screen');
    const gameoverDrift = document.getElementById('drift-gameover-screen');
    const controlsDrift = document.getElementById('drift-controls-hud');
    const startStacker = document.getElementById('stacker-start-screen');
    const gameoverStacker = document.getElementById('stacker-gameover-screen');
    const startSkeet = document.getElementById('skeet-overlay-start');
    const gameoverSkeet = document.getElementById('skeet-overlay-gameover');
    const startDefense = document.getElementById('defense-overlay-start');
    const gameoverDefense = document.getElementById('defense-overlay-gameover');
    const turretBarDefense = document.getElementById('defense-turret-bar');
    const startRunner = document.getElementById('runner-start-screen');
    const gameoverRunner = document.getElementById('runner-gameover-screen');
    const startQ2048 = document.getElementById('q2048-start-screen');
    const gameoverQ2048 = document.getElementById('q2048-gameover-screen');
    const startTetris = document.getElementById('tetris-start-screen');
    const gameoverTetris = document.getElementById('tetris-gameover-screen');
    const pauseTetris = document.getElementById('tetris-pause-screen');

    if (overlayArcade) overlayArcade.classList.remove('hidden');
    if (overlayInvaders) overlayInvaders.style.display = 'flex';
    if (startDrift) startDrift.style.display = 'flex';
    if (gameoverDrift) gameoverDrift.style.display = 'none';
    if (controlsDrift) controlsDrift.style.display = 'none';
    if (startStacker) startStacker.style.display = 'flex';
    if (gameoverStacker) gameoverStacker.style.display = 'none';
    if (startSkeet) startSkeet.style.display = 'none';
    if (gameoverSkeet) gameoverSkeet.style.display = 'none';
    if (startDefense) startDefense.style.display = 'flex';
    if (gameoverDefense) gameoverDefense.style.display = 'none';
    if (turretBarDefense) turretBarDefense.style.display = 'none';
    if (startRunner) startRunner.style.display = 'flex';
    if (gameoverRunner) gameoverRunner.style.display = 'none';
    if (startQ2048) startQ2048.style.display = 'flex';
    if (gameoverQ2048) gameoverQ2048.style.display = 'none';
    if (startTetris) startTetris.style.display = 'flex';
    if (gameoverTetris) gameoverTetris.style.display = 'none';
    if (pauseTetris) pauseTetris.style.display = 'none';

    const gameWindowContainer = document.getElementById('game-window-container');
    if (gameWindowContainer) gameWindowContainer.classList.remove('fullscreen-active');
    if (document.body) document.body.classList.remove('game-fullscreen-open');

    const activeContainer = document.getElementById('active-game-container');
    const tabsContainer = document.getElementById('games-category-tabs');
    
    if (activeContainer) {
      activeContainer.classList.remove('active-game');
      activeContainer.classList.add('hidden-game');
      activeContainer.style.setProperty('display', 'none', 'important');
    }
    if (tabsContainer) tabsContainer.style.display = 'flex';

    // Hide all individual game panels
    const panelIds = [
      'panel-game-arcade', 'panel-game-invaders', 'panel-game-drift', 'panel-game-stacker', 'panel-game-skeet', 'panel-game-defense',
      'panel-game-runner', 'panel-game-q2048', 'panel-game-tetris',
      'panel-game-roshambo', 'panel-game-spinner', 'panel-game-crash', 'panel-game-plinko', 'panel-game-mines'
    ];
    panelIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.removeProperty('display');
        el.style.display = 'none';
        el.classList.remove('game-panel-hidden');
      }
    });

    const skeetHud = document.getElementById('skeet-hud');
    if (skeetHud) { skeetHud.style.removeProperty('display'); skeetHud.style.display = 'none'; }
    const skeetTouchpad = document.getElementById('skeet-touchpad');
    if (skeetTouchpad) { skeetTouchpad.style.removeProperty('display'); skeetTouchpad.style.display = 'none'; }
    const skeetStart = document.getElementById('skeet-overlay-start');
    if (skeetStart) { skeetStart.style.removeProperty('display'); skeetStart.style.display = 'none'; }
    const skeetGameover = document.getElementById('skeet-overlay-gameover');
    if (skeetGameover) { skeetGameover.style.removeProperty('display'); skeetGameover.style.display = 'none'; }
    if (window.cyberSkeetEngine && typeof window.cyberSkeetEngine.stop === 'function') {
      try { window.cyberSkeetEngine.stop(); } catch (e) {}
    }

    // Hide all game-specific leaderboard columns
    const lbIds = ['leaderboard-col-arcade', 'leaderboard-col-invaders', 'leaderboard-col-drift', 'leaderboard-col-stacker', 'leaderboard-col-skeet', 'leaderboard-col-defense', 'leaderboard-col-runner', 'leaderboard-col-q2048', 'leaderboard-col-tetris'];
    lbIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    const gridEarn = document.getElementById('grid-category-earn');
    const gridBet = document.getElementById('grid-category-bet');

    if (gridEarn) gridEarn.classList.remove('grid-category-hidden');
    if (gridBet) gridBet.classList.remove('grid-category-hidden');

    // Reactivate the correct grid based on active tab
    const activeTab = document.querySelector('#games-category-tabs .nft-tab.active');
    if (activeTab) {
      const id = activeTab.id;
      if (id === 'tab-category-earn' && gridEarn) gridEarn.style.display = 'grid';
      if (id === 'tab-category-bet' && gridBet) gridBet.style.display = 'block';
    }
  } catch (err) {
    console.error("[closeGameView] Exception caught:", err);
  }
}

export function isWhitelistedGameTester() {
  if (!window.appState) return false;

  // 1. Any logged-in Admin or Official Ambassador is automatically a whitelisted tester
  if (window.appState.state && (window.appState.state.isAdmin || window.appState.state.isAmbassador)) return true;

  // 2. Extract all identifiers across state and local storage
  const playerId = (window.appState.getPlayerId?.() || window.appState.state?.playerId || '').toLowerCase();
  const wallet = (window.appState.state?.walletAddress || '').toLowerCase();
  const linked = (window.appState.state?.linkedWalletAddress || '').toLowerCase();
  const localPid = (typeof localStorage !== 'undefined' ? (localStorage.getItem('polygame_player_id') || '') : '').toLowerCase();

  const WHITELISTED_IDS = [
    '0x10b9993990c9ef8a212c9557cb02ad94da9a654d', // Master Admin Wallet
    '0xpgt85c8416473bd6a8c45ada81ac85aeabb',       // Master Admin Player ID
    '0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5', // Poss Wallet
    '0xpgt8312e02d37185b5983e6922d1dae1cce',       // Poss Player ID
    '0x5416216beb51f3327c37a5303f69280e51de9918', // Troubs Wallet
    '0xpgt1315acc40000000000000000000000000000'   // Troubs Player ID
  ];

  return WHITELISTED_IDS.includes(playerId) ||
         WHITELISTED_IDS.includes(wallet) ||
         WHITELISTED_IDS.includes(linked) ||
         WHITELISTED_IDS.includes(localPid);
}
window.isWhitelistedGameTester = isWhitelistedGameTester;

export function updateGameTileBadges(settings) {
  if (!settings && window.appState && window.appState.state) {
    settings = window.appState.state.gamePayoutSettings;
  }
  const defaultFallback = {
    stacker: { vip_only: true, test_mode: false, harvest_enabled: true },
    defense: { vip_only: false, test_mode: true, harvest_enabled: true }
  };
  const activeSettings = Object.assign({}, defaultFallback, settings || {});

  const isWhitelistedTester = isWhitelistedGameTester();

  const cards = document.querySelectorAll('.nft-card[data-game-key], .profile-game-card[data-game-key]');
  cards.forEach(card => {
    const key = card.getAttribute('data-game-key');
    const conf = activeSettings[key] || {};
    let badgeContainer = card.querySelector('.game-tile-badges');
    if (!badgeContainer && !card.classList.contains('profile-game-card')) {
      badgeContainer = document.createElement('div');
      badgeContainer.className = 'game-tile-badges';
      badgeContainer.style.cssText = 'position: absolute; top: 12px; right: 12px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; z-index: 5;';
      card.style.position = 'relative';
      card.prepend(badgeContainer);
    }

    let badgesHtml = '';

    // 0. Test Mode Check (Hidden from public; only visible to Admin, Ambassadors, and Whitelisted Testers)
    if (conf.test_mode) {
      if (!isWhitelistedTester) {
        card.style.display = 'none';
        return;
      } else {
        card.style.display = '';
        badgesHtml += `
          <div class="badge-test-mode" style="background: linear-gradient(135deg, #00f0ff, #7000ff); color: #fff; font-size: 0.65rem; font-weight: 900; padding: 0.2rem 0.55rem; border-radius: 12px; letter-spacing: 0.5px; box-shadow: 0 0 10px rgba(0, 240, 255, 0.4); text-shadow: 0 1px 2px rgba(0,0,0,0.5);">🧪 TEST MODE</div>
        `;
      }
    } else {
      card.style.display = '';
    }


    // 1. VIP Only Badge (Reusing Cyber Stacker's exact pill styling)
    if (conf.vip_only) {
      badgesHtml += `
        <div class="badge-vip-only" style="background: linear-gradient(135deg, #ffaa00, #ff5500); color: #000; font-size: 0.65rem; font-weight: 900; padding: 0.2rem 0.55rem; border-radius: 12px; letter-spacing: 0.5px; box-shadow: 0 0 10px rgba(255, 170, 0, 0.35);">👑 VIP ONLY</div>
      `;
    }

    // 2. No PGT Earned (In-Game Harvest disabled) Badge
    if (conf.harvest_enabled === false && key !== 'boss' && key !== 'space' && key !== 'roshambo' && key !== 'spinner' && key !== 'crash' && key !== 'plinko' && key !== 'mines') {
      badgesHtml += `
        <div class="badge-no-harvest" style="background: rgba(255, 0, 85, 0.2); color: #ff0055; border: 1px solid #ff0055; font-size: 0.65rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 12px; letter-spacing: 0.5px; box-shadow: 0 0 10px rgba(255, 0, 85, 0.25);">🚫 NO PGT EARNED</div>
      `;
    }

    if (badgeContainer) {
      badgeContainer.innerHTML = badgesHtml;
    }
  });
}
window.updateGameTileBadges = updateGameTileBadges;

export function switchGameModeView(mode) {
  // VIP Access Guard check
  const isVip = window.appState && typeof window.appState.isVipActive === 'function' && window.appState.isVipActive();
  const isAmb = window.appState && window.appState.state && window.appState.state.isAmbassador;
  const isAdmin = window.appState && window.appState.state && window.appState.state.isAdmin;

  const settings = (window.appState && window.appState.state && window.appState.state.gamePayoutSettings) || {};
  const gameKeyMap = { 'arcade': 'astrododge', 'invaders': 'invaders', 'drift': 'drift', 'catcher': 'stacker', 'stacker': 'stacker', 'skeet': 'skeet', 'defense': 'defense', 'runner': 'runner', 'q2048': 'q2048', 'tetris': 'tetris', 'roshambo': 'roshambo', 'spinner': 'spinner', 'plinko': 'plinko', 'crash': 'crash', 'mines': 'mines' };
  const gKey = gameKeyMap[mode] || mode;

  // Test Mode Whitelist Guard (Blocks non-testers from launching test_mode games)
  const isTestMode = (settings[gKey] && settings[gKey].test_mode !== undefined)
    ? Boolean(settings[gKey].test_mode)
    : (gKey === 'defense');

  if (isTestMode) {
    if (!isWhitelistedGameTester()) {
      if (window.triggerToast) window.triggerToast("🧪 This game is currently in private test mode.", "warning");
      return;
    }
  }

  const isVipOnly = settings[gKey] ? Boolean(settings[gKey].vip_only) : (gKey === 'stacker');

  if (isVipOnly && !isVip && !isAdmin) {
    if (window.showVipLockModal) {
      window.showVipLockModal(settings[gKey]?.name || mode);
    } else if (window.triggerToast) {
      window.triggerToast("👑 VIP Exclusive Game! Upgrade to VIP Pass to play.", "warning");
    }
    return;
  }

  const activeContainer = document.getElementById('active-game-container');
  const tabsContainer = document.getElementById('games-category-tabs');
  
  const gridEarn = document.getElementById('grid-category-earn');
  const gridBet = document.getElementById('grid-category-bet');

  if (activeContainer) {
    activeContainer.classList.remove('hidden-game');
    activeContainer.classList.add('active-game');
    activeContainer.style.setProperty('display', 'grid', 'important');
  }
  if (tabsContainer) tabsContainer.style.display = 'flex';
  
  if (gridEarn) { gridEarn.style.display = 'none'; gridEarn.classList.add('grid-category-hidden'); }
  if (gridBet) { gridBet.style.display = 'none'; gridBet.classList.add('grid-category-hidden'); }

  const panelArcade = document.getElementById('panel-game-arcade');
  const panelInvaders = document.getElementById('panel-game-invaders');
  const panelDrift = document.getElementById('panel-game-drift');
  const panelStacker = document.getElementById('panel-game-stacker') || document.getElementById('panel-game-catcher');
  const panelSkeet = document.getElementById('panel-game-skeet');
  const panelDefense = document.getElementById('panel-game-defense');
  const panelRunner = document.getElementById('panel-game-runner');
  const panelQ2048 = document.getElementById('panel-game-q2048');
  const panelTetris = document.getElementById('panel-game-tetris');
  const panelRoshambo = document.getElementById('panel-game-roshambo');
  const panelSpinner = document.getElementById('panel-game-spinner');
  const panelCrash = document.getElementById('panel-game-crash');
  const panelPlinko = document.getElementById('panel-game-plinko');
  const panelMines = document.getElementById('panel-game-mines');

  const lbArcade = document.getElementById('leaderboard-col-arcade');
  const lbInvaders = document.getElementById('leaderboard-col-invaders');
  const lbDrift = document.getElementById('leaderboard-col-drift');
  const lbStacker = document.getElementById('leaderboard-col-stacker') || document.getElementById('leaderboard-col-catcher');
  const lbSkeet = document.getElementById('leaderboard-col-skeet');
  const lbDefense = document.getElementById('leaderboard-col-defense');
  const lbRunner = document.getElementById('leaderboard-col-runner');
  const lbQ2048 = document.getElementById('leaderboard-col-q2048');
  const lbTetris = document.getElementById('leaderboard-col-tetris');

  const allPanels = [
    { el: panelArcade, key: 'arcade' },
    { el: panelInvaders, key: 'invaders' },
    { el: panelDrift, key: 'drift' },
    { el: panelStacker, key: 'stacker' },
    { el: panelSkeet, key: 'skeet' },
    { el: panelDefense, key: 'defense' },
    { el: panelRunner, key: 'runner' },
    { el: panelQ2048, key: 'q2048' },
    { el: panelTetris, key: 'tetris' },
    { el: panelRoshambo, key: 'roshambo' },
    { el: panelSpinner, key: 'spinner' },
    { el: panelCrash, key: 'crash' },
    { el: panelPlinko, key: 'plinko' },
    { el: panelMines, key: 'mines' }
  ];

  allPanels.forEach(({ el }) => {
    if (el) {
      el.style.removeProperty('display');
      el.style.display = 'none';
      el.classList.remove('game-panel-hidden');
    }
  });

  // Skeet-specific element isolation
  const skeetHud = document.getElementById('skeet-hud');
  const skeetTouchpad = document.getElementById('skeet-touchpad');
  const skeetStart = document.getElementById('skeet-overlay-start');
  const skeetGameover = document.getElementById('skeet-overlay-gameover');

  if (mode !== 'skeet') {
    if (skeetHud) { skeetHud.style.removeProperty('display'); skeetHud.style.display = 'none'; }
    if (skeetTouchpad) { skeetTouchpad.style.removeProperty('display'); skeetTouchpad.style.display = 'none'; }
    if (skeetStart) { skeetStart.style.removeProperty('display'); skeetStart.style.display = 'none'; }
    if (skeetGameover) { skeetGameover.style.removeProperty('display'); skeetGameover.style.display = 'none'; }
    if (window.cyberSkeetEngine && typeof window.cyberSkeetEngine.stop === 'function') {
      try { window.cyberSkeetEngine.stop(); } catch (e) {}
    }
  }
  if (mode !== 'plinko') {
    if (typeof window.stopPlinkoLoop === 'function') {
      try { window.stopPlinkoLoop(); } catch (e) {}
    }
  }

  if (lbArcade) lbArcade.style.display = 'none';
  if (lbInvaders) lbInvaders.style.display = 'none';
  if (lbDrift) lbDrift.style.display = 'none';
  if (lbStacker) lbStacker.style.display = 'none';
  if (lbSkeet) lbSkeet.style.display = 'none';
  if (lbDefense) lbDefense.style.display = 'none';
  if (lbRunner) lbRunner.style.display = 'none';
  if (lbQ2048) lbQ2048.style.display = 'none';
  if (lbTetris) lbTetris.style.display = 'none';

  if (mode === 'arcade') {
    if (panelArcade) {
      panelArcade.style.removeProperty('display');
      panelArcade.style.display = 'flex';
    }
    if (lbArcade) lbArcade.style.display = 'block';
    const overlay = document.getElementById('game-ui-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      overlay.style.removeProperty('display');
      overlay.style.display = 'flex';
    }
    if (window.sfx && typeof window.sfx.updateBgmSelectorUI === 'function') {
      window.sfx.updateBgmSelectorUI();
    }
  } else if (mode === 'invaders') {
    if (panelInvaders) {
      panelInvaders.style.removeProperty('display');
      panelInvaders.style.display = 'flex';
    }
    if (lbInvaders) lbInvaders.style.display = 'block';
    const overlay = document.getElementById('invaders-ui-overlay');
    if (overlay) {
      overlay.style.removeProperty('display');
      overlay.style.display = 'flex';
    }
  } else if (mode === 'drift') {
    if (panelDrift) {
      panelDrift.style.removeProperty('display');
      panelDrift.style.display = 'flex';
    }
    if (lbDrift) lbDrift.style.display = 'block';
    const overlay = document.getElementById('drift-ui-overlay');
    if (overlay) {
      overlay.style.removeProperty('display');
      overlay.style.display = 'flex';
    }
    if (window.cyberDrift && typeof window.cyberDrift.resize === 'function') {
      window.cyberDrift.resize();
    }
    if (typeof window.loadDriftLeaderboard === 'function') window.loadDriftLeaderboard();
  } else if (mode === 'stacker' || mode === 'catcher') {
    if (panelStacker) {
      panelStacker.style.removeProperty('display');
      panelStacker.style.display = 'flex';
    }
    if (lbStacker) lbStacker.style.display = 'block';
    const startScreen = document.getElementById('stacker-start-screen') || document.getElementById('catcher-start-screen');
    if (startScreen) {
      startScreen.style.removeProperty('display');
      startScreen.style.display = 'flex';
    }
    if (window.cyberStacker) {
      if (typeof window.cyberStacker.ensureCanvas === 'function') window.cyberStacker.ensureCanvas();
      if (typeof window.cyberStacker.resize === 'function') window.cyberStacker.resize();
    }
    if (typeof window.loadStackerLeaderboard === 'function') window.loadStackerLeaderboard();
    else if (typeof window.loadCatcherLeaderboard === 'function') window.loadCatcherLeaderboard();
  } else if (mode === 'skeet') {
    if (panelSkeet) {
      panelSkeet.style.removeProperty('display');
      panelSkeet.style.display = 'flex';
    }
    if (lbSkeet) lbSkeet.style.display = 'block';
    if (skeetHud) { skeetHud.style.removeProperty('display'); skeetHud.style.display = 'flex'; }
    if (skeetTouchpad) { skeetTouchpad.style.removeProperty('display'); skeetTouchpad.style.display = 'flex'; }
    if (skeetStart) {
      skeetStart.style.removeProperty('display');
      skeetStart.classList.remove('hidden');
      skeetStart.style.display = 'flex';
    }
    if (typeof window.initCyberSkeet === 'function') {
      const engine = window.initCyberSkeet();
      if (engine && typeof engine.resizeCanvas === 'function') engine.resizeCanvas();
    }
    if (typeof window.loadSkeetLeaderboard === 'function') window.loadSkeetLeaderboard();
  } else if (mode === 'defense') {
    if (panelDefense) {
      panelDefense.style.removeProperty('display');
      panelDefense.style.display = 'flex';
    }
    if (lbDefense) lbDefense.style.display = 'block';
    const startScreen = document.getElementById('defense-overlay-start');
    if (startScreen) {
      startScreen.style.removeProperty('display');
      startScreen.style.display = 'flex';
    }
    const turretBar = document.getElementById('defense-turret-bar');
    if (turretBar) turretBar.style.display = 'none';
    if (typeof window.initCyberDefense === 'function') window.initCyberDefense();
    if (typeof window.loadDefenseLeaderboard === 'function') window.loadDefenseLeaderboard();
    else if (typeof window.loadGameLeaderboard === 'function') window.loadGameLeaderboard('defense');
  } else if (mode === 'runner') {
    if (panelRunner) {
      panelRunner.style.removeProperty('display');
      panelRunner.style.display = 'flex';
    }
    if (lbRunner) lbRunner.style.display = 'block';
    const startScreen = document.getElementById('runner-start-screen');
    if (startScreen) {
      startScreen.style.removeProperty('display');
      startScreen.style.display = 'flex';
    }
    if (window.cyberRunner && typeof window.cyberRunner.resize === 'function') {
      window.cyberRunner.resize();
    }
    if (typeof window.loadRunnerLeaderboard === 'function') window.loadRunnerLeaderboard();
    else if (typeof window.loadGameLeaderboard === 'function') window.loadGameLeaderboard('runner');
  } else if (mode === 'q2048') {
    if (panelQ2048) {
      panelQ2048.style.removeProperty('display');
      panelQ2048.style.display = 'flex';
    }
    if (lbQ2048) lbQ2048.style.display = 'block';
    const startScreen = document.getElementById('q2048-start-screen');
    if (startScreen) {
      startScreen.style.removeProperty('display');
      startScreen.style.display = 'flex';
    }
    if (window.cyber2048 && typeof window.cyber2048.init === 'function') {
      window.cyber2048.init();
    }
    if (typeof window.loadQ2048Leaderboard === 'function') window.loadQ2048Leaderboard();
    else if (typeof window.loadGameLeaderboard === 'function') window.loadGameLeaderboard('q2048');
  } else if (mode === 'tetris') {
    if (panelTetris) {
      panelTetris.style.removeProperty('display');
      panelTetris.style.display = 'flex';
    }
    if (lbTetris) lbTetris.style.display = 'block';
    const startScreen = document.getElementById('tetris-start-screen');
    if (startScreen) {
      startScreen.style.removeProperty('display');
      startScreen.style.display = 'flex';
    }
    const overScreen = document.getElementById('tetris-gameover-screen');
    if (overScreen) overScreen.style.display = 'none';
    const pauseScreen = document.getElementById('tetris-pause-screen');
    if (pauseScreen) pauseScreen.style.display = 'none';

    // Update best score display
    const highscore = (window.PolyState?.state?.user?.tetris_highscore) || (window.appState?.state?.tetrisHighScore) || 0;
    const bestEl = document.getElementById('tetris-best-val');
    if (bestEl) bestEl.innerText = highscore.toLocaleString();

    if (window.cyberTetrisGame) {
      if (typeof window.cyberTetrisGame.initCanvases === 'function') window.cyberTetrisGame.initCanvases();
      if (typeof window.cyberTetrisGame.render === 'function') window.cyberTetrisGame.render();
    }
    if (typeof window.loadTetrisLeaderboard === 'function') window.loadTetrisLeaderboard();
    else if (typeof window.loadGameLeaderboard === 'function') window.loadGameLeaderboard('tetris');
  } else if (mode === 'roshambo') {
    if (panelRoshambo) {
      panelRoshambo.style.removeProperty('display');
      panelRoshambo.style.display = 'block';
    }
    if (typeof window.updateRoshamboWagerLabels === 'function') window.updateRoshamboWagerLabels();
  } else if (mode === 'spinner') {
    if (panelSpinner) {
      panelSpinner.style.removeProperty('display');
      panelSpinner.style.display = 'block';
    }
    if (typeof window.updateSpinnerWagerLabels === 'function') window.updateSpinnerWagerLabels();
  } else if (mode === 'crash') {
    if (panelCrash) {
      panelCrash.style.removeProperty('display');
      panelCrash.style.display = 'block';
    }
    if (window.updateCrashWagerLabels) window.updateCrashWagerLabels();
  } else if (mode === 'plinko') {
    if (panelPlinko) {
      panelPlinko.style.removeProperty('display');
      panelPlinko.style.display = 'block';
    }
    if (window.updatePlinkoWagerLabels) window.updatePlinkoWagerLabels();
    if (typeof window.startPlinkoLoop === 'function') {
      try { window.startPlinkoLoop(); } catch (e) {}
    }
  } else if (mode === 'mines') {
    if (panelMines) {
      panelMines.style.removeProperty('display');
      panelMines.style.display = 'block';
    }
    if (window.updateMinesWagerLabels) window.updateMinesWagerLabels();
    if (window.renderMinesBoard) window.renderMinesBoard();
  }

  // Automatically trigger full screen mode on mobile screens (≤768px width or landscape mobile ≤500px height)
  if (window.innerWidth <= 768 || window.innerHeight <= 500) {
    if (typeof window.openMobileGameFullscreen === 'function') {
      window.openMobileGameFullscreen();
    }
  }
}

if (typeof window !== 'undefined') {
  window.switchGameCategory = switchGameCategory;
  window.closeGameView = closeGameView;
  window.switchGameModeView = switchGameModeView;
}

// ============================================================
// TOP 3 BEST WEEKLY PLAYERS (ARCADE GRAND PRIX SHOWCASE)
// Points: 1st=5pts, 2nd=4pts, 3rd=3pts, 4th=2pts, 5th-10th=1pt
// Strict Guard: Never counts games in test mode
// ============================================================

export const ARCADE_GAMES = [
  { key: 'astrododge', scoreField: 'game_highscore', stateScoreKey: 'gameHighScore', title: 'Astro-Dodge', shortTitle: 'Astro', icon: '🚀', defaultPool: 50000, settingKey: 'astrododge', modeView: 'arcade' },
  { key: 'invaders', scoreField: 'invaders_highscore', stateScoreKey: 'invadersHighScore', title: 'Cyber Invaders', shortTitle: 'Invaders', icon: '👾', defaultPool: 50000, settingKey: 'invaders', modeView: 'invaders' },
  { key: 'drift', scoreField: 'drift_highscore', stateScoreKey: 'driftHighScore', title: 'Cyber Drift', shortTitle: 'Drift', icon: '🏎️', defaultPool: 50000, settingKey: 'drift', modeView: 'drift' },
  { key: 'stacker', scoreField: 'stacker_highscore', stateScoreKey: 'stackerHighScore', title: 'Cyber Stacker', shortTitle: 'Stacker', icon: '🧱', defaultPool: 50000, settingKey: 'stacker', modeView: 'stacker' },
  { key: 'skeet', scoreField: 'skeet_highscore', stateScoreKey: 'skeetHighScore', title: 'Cyber Skeet', shortTitle: 'Skeet', icon: '🎯', defaultPool: 25000, settingKey: 'skeet', modeView: 'skeet' },
  { key: 'defense', scoreField: 'defense_highscore', stateScoreKey: 'defenseHighScore', title: 'Cyber Defense', shortTitle: 'Defense', icon: '🛡️', defaultPool: 25000, settingKey: 'defense', modeView: 'defense' },
  { key: 'runner', scoreField: 'runner_highscore', stateScoreKey: 'runnerHighScore', title: 'Cyber Runner', shortTitle: 'Runner', icon: '⚡', defaultPool: 50000, settingKey: 'runner', modeView: 'runner' },
  { key: 'q2048', scoreField: 'q2048_highscore', stateScoreKey: 'q2048HighScore', title: 'Cyber 2048', shortTitle: '2048', icon: '🧩', defaultPool: 50000, settingKey: 'q2048', modeView: 'q2048' },
  { key: 'tetris', scoreField: 'tetris_highscore', stateScoreKey: 'tetrisHighScore', title: 'Cyber Tetris', shortTitle: 'Tetris', icon: '🧱', defaultPool: 50000, settingKey: 'tetris', modeView: 'tetris' }
];

export const GRAND_PRIX_POINTS_LOOKUP = [5, 4, 3, 2, 1, 1, 1, 1, 1, 1];

export function checkIsCurrentUser(player) {
  if (!player) return false;
  if (!window.appState || !window.appState.state || !window.appState.isPlayerConnected()) return false;
  const currentPid = (window.appState.getPlayerId?.() || window.appState.state.playerId || '').toLowerCase();
  const currentPrimary = (window.appState.state.walletAddress || '').toLowerCase();
  const currentLinked = (window.appState.state.linkedWalletAddress || '').toLowerCase();

  const pPid = (player.playerId || player.player_id || '').toLowerCase();
  const pLinked = (player.linkedWallet || player.linked_wallet_address || '').toLowerCase();

  if (currentPid && (currentPid === pPid || currentPid === pLinked)) return true;
  if (currentPrimary && (currentPrimary === pPid || currentPrimary === pLinked)) return true;
  if (currentLinked && (currentLinked === pPid || currentLinked === pLinked)) return true;
  return false;
}

export async function loadTopWeeklyArcadePlayers() {
  const container = document.getElementById('weekly-champions-podium');
  if (!container) return;

  const client = (typeof supabase !== 'undefined' && supabase) ? supabase : (typeof window !== 'undefined' ? window.supabaseClient : null);
  if (!client) {
    container.innerHTML = '<div class="podium-empty-slot" style="grid-column: 1 / -1;">Database connecting...</div>';
    return;
  }

  // 1. Determine eligible arcade games, STRICTLY EXCLUDING any games in test mode
  const settings = (window.appState && window.appState.state && window.appState.state.gamePayoutSettings) || {};
  
  const eligibleGames = ARCADE_GAMES.filter(g => {
    const conf = settings[g.settingKey] || (g.settingKey === 'stacker' ? settings.catcher : null);
    // Strict Guard: Exclude if test_mode is enabled in global settings
    return !conf || conf.test_mode !== true;
  });

  try {
    const POINTS_LOOKUP = GRAND_PRIX_POINTS_LOOKUP; // 1st: 5pts, 2nd: 4pts, 3rd: 3pts, 4th: 2pts, 5th-10th: 1pt

    // Fetch top 10 for all eligible games concurrently
    const gameResults = await Promise.all(eligibleGames.map(async (g) => {
      try {
        const { data, error } = await client.from('users')
          .select(`player_id, linked_wallet_address, ${g.scoreField}, username`)
          .gt(g.scoreField, 0)
          .order(g.scoreField, { ascending: false })
          .limit(10);
        if (error) {
          console.warn(`[loadTopWeeklyArcadePlayers] Query error for ${g.key}:`, error);
          return { game: g, rows: [] };
        }
        return { game: g, rows: data || [] };
      } catch (err) {
        console.warn(`[loadTopWeeklyArcadePlayers] Fetch failed for ${g.key}:`, err);
        return { game: g, rows: [] };
      }
    }));

    // Aggregate points by unique player
    const playerScores = {};

    gameResults.forEach(({ game, rows }) => {
      rows.forEach((row, idx) => {
        const rank = idx + 1;
        const pts = POINTS_LOOKUP[idx] || 1;
        const uniqueKey = (row.linked_wallet_address || row.player_id || '').toLowerCase();
        if (!uniqueKey) return;

        if (!playerScores[uniqueKey]) {
          playerScores[uniqueKey] = {
            playerId: row.player_id,
            linkedWallet: row.linked_wallet_address,
            username: row.username,
            totalPoints: 0,
            goldCount: 0,
            silverCount: 0,
            bronzeCount: 0,
            placements: []
          };
        }

        playerScores[uniqueKey].totalPoints += pts;
        if (rank === 1) playerScores[uniqueKey].goldCount++;
        else if (rank === 2) playerScores[uniqueKey].silverCount++;
        else if (rank === 3) playerScores[uniqueKey].bronzeCount++;

        playerScores[uniqueKey].placements.push({
          gameKey: game.key,
          title: game.shortTitle,
          icon: game.icon,
          rank: rank,
          pts: pts
        });
      });
    });

    // Sort players: Total points DESC, then gold count DESC, then silver count DESC, then bronze count DESC
    const sortedPlayers = Object.values(playerScores).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.goldCount !== a.goldCount) return b.goldCount - a.goldCount;
      if (b.silverCount !== a.silverCount) return b.silverCount - a.silverCount;
      return b.bronzeCount - a.bronzeCount;
    });

    // Top 3 for the podium
    const top3 = sortedPlayers.slice(0, 3);

    if (top3.length === 0) {
      container.innerHTML = `
        <div class="podium-empty-row">
          <span>🎮 No arcade scores recorded yet this week!</span>
          <span style="color: var(--text-dim);">0 pts</span>
        </div>
      `;
      return;
    }

    const podiumRanks = [
      { rank: 1, medal: '🥇', class: 'rank-1' },
      { rank: 2, medal: '🥈', class: 'rank-2' },
      { rank: 3, medal: '🥉', class: 'rank-3' }
    ];

    let html = '';

    for (let i = 0; i < 3; i++) {
      const pConf = podiumRanks[i];
      const player = top3[i];

      if (!player) {
        html += `
          <div class="podium-empty-row">
            <div class="podium-row-left">
              <span class="podium-rank-icon">${pConf.medal}</span>
              <span style="color: var(--text-dim);">Awaiting Challenger...</span>
            </div>
            <span style="color: var(--text-dim); font-size: 0.75rem;">-- pts</span>
          </div>
        `;
        continue;
      }

      const isUser = checkIsCurrentUser(player);
      const targetAddr = player.linkedWallet || player.playerId || '';
      const isInternalAddr = (addr) => !addr || addr.toLowerCase().startsWith('0xpgt') || addr.toLowerCase().startsWith('0xg');
      let shortAddr = targetAddr;
      if (shortAddr.length >= 12) {
        shortAddr = `${shortAddr.substring(0, 6)}...${shortAddr.substring(shortAddr.length - 4)}`;
      }
      let displayName = player.username;
      if (isUser && window.appState && window.appState.state && window.appState.state.username) {
        displayName = window.appState.state.username;
      }
      if (!displayName || displayName.trim() === '') {
        displayName = isInternalAddr(targetAddr) ? 'Player_' + targetAddr.substring(targetAddr.length - 4) : shortAddr;
      }

      const safeDisplayName = typeof escapeHtml === 'function' ? escapeHtml(displayName) : (displayName || '');
      const safeTargetAddr = encodeURIComponent(targetAddr);

      html += `
        <div class="podium-row ${pConf.class}" onclick="if(window.openPublicProfile) window.openPublicProfile('${safeTargetAddr}')" title="Click to view profile">
          <div class="podium-row-left">
            <span class="podium-rank-icon">${pConf.medal}</span>
            <span class="podium-player-name">${safeDisplayName}</span>
            ${isUser ? '<span style="background: rgba(0, 255, 135, 0.2); color: #00ff87; border: 1px solid #00ff87; font-size: 0.62rem; font-weight: 800; padding: 0.05rem 0.35rem; border-radius: 6px;">(You)</span>' : ''}
          </div>
          <div class="podium-row-pts">
            ${player.totalPoints} pts
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  } catch (err) {
    console.error("[loadTopWeeklyArcadePlayers] Unexpected error:", err);
    container.innerHTML = '<div class="podium-empty-row" style="color: var(--color-danger);">Error loading weekly champions.</div>';
  }
}

// ============================================================
// MY WEEKLY STANDING & PAYOUT MODAL
// Aggregates user's rank, high score, Grand Prix points, and 
// estimated Sunday weekly PGT prize across all arcade games
// ============================================================

export async function openMyWeeklyStandingModal() {
  if (typeof openModal === 'function') {
    openModal('my-weekly-standing');
  } else if (typeof window.openModal === 'function') {
    window.openModal('my-weekly-standing');
  }

  const bodyEl = document.getElementById('my-weekly-standing-body');
  if (!bodyEl) return;

  // Render initial loading skeleton
  bodyEl.innerHTML = `
    <div style="text-align: center; padding: 2.2rem 1rem;">
      <div style="font-size: 2.5rem; animation: pulse-live 1.5s infinite ease-in-out; margin-bottom: 0.75rem;">📊</div>
      <div style="color: var(--color-primary); font-weight: 800; font-size: 1rem; margin-bottom: 0.35rem;">Fetching Tournament Leaderboards...</div>
      <div style="color: var(--text-dim); font-size: 0.8rem;">Calculating your weekly rankings, Grand Prix points, and projected PGT pool rewards.</div>
    </div>
  `;

  const isConnected = !!(window.appState && typeof window.appState.isPlayerConnected === 'function' && window.appState.isPlayerConnected());
  if (!isConnected) {
    bodyEl.innerHTML = `
      <div style="text-align: center; padding: 2rem 1.5rem; background: rgba(0, 240, 255, 0.04); border: 1px solid rgba(0, 240, 255, 0.2); border-radius: 12px;">
        <span style="font-size: 2.5rem; display: block; margin-bottom: 0.75rem;">🔒</span>
        <h4 style="color: #fff; font-size: 1.1rem; font-weight: 800; margin: 0 0 0.4rem 0;">Account Not Connected</h4>
        <p style="color: var(--text-muted); font-size: 0.82rem; line-height: 1.5; margin: 0 auto 1.25rem auto; max-width: 400px;">
          Connect your Web3 wallet or guest account to view your live weekly rankings, championship Grand Prix points, and projected Sunday PGT payouts.
        </p>
        <button class="btn btn-primary" onclick="closeModal('my-weekly-standing'); if(window.openModal) window.openModal('wallet');" style="background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)); color: #000; font-weight: 800; font-size: 0.85rem; padding: 0.65rem 1.5rem; border-radius: 8px; border: none; cursor: pointer;">
          🔗 Connect Wallet / Account
        </button>
      </div>
    `;
    return;
  }

  const client = (typeof supabase !== 'undefined' && supabase) ? supabase : (typeof window !== 'undefined' ? window.supabaseClient : null);
  if (!client) {
    bodyEl.innerHTML = '<div style="text-align: center; color: var(--color-danger); padding: 2rem;">Database connecting... Please retry in a moment.</div>';
    return;
  }

  const settings = (window.appState && window.appState.state && window.appState.state.gamePayoutSettings) || {};
  const eligibleGames = ARCADE_GAMES.filter(g => {
    const conf = settings[g.settingKey] || (g.settingKey === 'stacker' ? settings.catcher : null);
    return !conf || conf.test_mode !== true;
  });

  const multis = (window.appState && typeof window.appState.getMultipliers === 'function') ? window.appState.getMultipliers() : {};
  const playerMult = multis.totalLeaderboardMultiplier || 1.0;
  const playerMultStr = playerMult % 1 === 0 ? playerMult.toFixed(0) : playerMult.toFixed(2).replace(/0$/, '');
  const isVip = !!multis.isVip;
  const vipLvl = multis.vipLevel;

  try {
    const POINTS_LOOKUP = GRAND_PRIX_POINTS_LOOKUP;

    // Fetch top 100 for all eligible games concurrently
    const gameResults = await Promise.all(eligibleGames.map(async (g) => {
      try {
        const { data, error } = await client.from('users')
          .select(`player_id, linked_wallet_address, ${g.scoreField}, username`)
          .gt(g.scoreField, 0)
          .order(g.scoreField, { ascending: false })
          .limit(100);
        if (error) {
          console.warn(`[openMyWeeklyStandingModal] Query error for ${g.key}:`, error);
          return { game: g, rows: [] };
        }
        return { game: g, rows: data || [] };
      } catch (err) {
        console.warn(`[openMyWeeklyStandingModal] Fetch failed for ${g.key}:`, err);
        return { game: g, rows: [] };
      }
    }));

    // 1. Calculate Grand Prix points across all players using top 10 rows
    const playerScores = {};
    gameResults.forEach(({ game, rows }) => {
      const top10 = rows.slice(0, 10);
      top10.forEach((row, idx) => {
        const rank = idx + 1;
        const pts = POINTS_LOOKUP[idx] || 1;
        const uniqueKey = (row.linked_wallet_address || row.player_id || '').toLowerCase();
        if (!uniqueKey) return;

        if (!playerScores[uniqueKey]) {
          playerScores[uniqueKey] = {
            playerId: row.player_id,
            linkedWallet: row.linked_wallet_address,
            username: row.username,
            totalPoints: 0,
            goldCount: 0,
            silverCount: 0,
            bronzeCount: 0
          };
        }

        playerScores[uniqueKey].totalPoints += pts;
        if (rank === 1) playerScores[uniqueKey].goldCount++;
        else if (rank === 2) playerScores[uniqueKey].silverCount++;
        else if (rank === 3) playerScores[uniqueKey].bronzeCount++;
      });
    });

    const sortedPlayers = Object.values(playerScores).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.goldCount !== a.goldCount) return b.goldCount - a.goldCount;
      if (b.silverCount !== a.silverCount) return b.silverCount - a.silverCount;
      return b.bronzeCount - a.bronzeCount;
    });

    let userGpRank = null;
    let userGpPoints = 0;
    const gpUserIdx = sortedPlayers.findIndex(p => checkIsCurrentUser(p));
    if (gpUserIdx >= 0) {
      userGpRank = gpUserIdx + 1;
      userGpPoints = sortedPlayers[gpUserIdx].totalPoints;
    }

    // 2. Calculate game-by-game stats
    let totalEstWeeklyPgt = 0;
    let gamesRankedInTop100 = 0;

    const gameRowsHtml = gameResults.map(({ game, rows }) => {
      const uIdx = rows.findIndex(r => checkIsCurrentUser(r));
      let rank = null;
      let score = 0;
      let gpPts = 0;
      let basePrize = 0;
      let finalPrize = 0;

      const conf = settings[game.settingKey] || (game.settingKey === 'stacker' ? settings.catcher : null) || {};
      const pool = (conf.weekly_pool_pgt !== undefined && conf.weekly_pool_pgt !== null) ? Number(conf.weekly_pool_pgt) : game.defaultPool;

      if (uIdx >= 0) {
        rank = uIdx + 1;
        score = rows[uIdx][game.scoreField] || 0;
        gpPts = (rank <= 10) ? (POINTS_LOOKUP[uIdx] || 1) : 0;
        basePrize = getWeeklyPrizeForRank(rank, pool);
        finalPrize = Math.round(basePrize * playerMult);
        totalEstWeeklyPgt += finalPrize;
        gamesRankedInTop100++;
      } else {
        let localScore = 0;
        if (window.appState && window.appState.state) {
          localScore = parseInt(window.appState.state[game.stateScoreKey] || 0, 10);
          if (game.key === 'astrododge' && !localScore) {
            localScore = parseInt(window.appState.state.highScore || 0, 10);
          }
        }
        score = localScore;
        rank = localScore > 0 ? 101 : null; // 101 represents 100+
      }

      let rankBadgeHtml = '';
      if (rank === 1) {
        rankBadgeHtml = '<span style="background: rgba(255, 170, 0, 0.2); color: #ffaa00; border: 1px solid rgba(255, 170, 0, 0.45); font-weight: 800; font-size: 0.68rem; padding: 0.1rem 0.35rem; border-radius: 6px; white-space: nowrap;">🥇 1st</span>';
      } else if (rank === 2) {
        rankBadgeHtml = '<span style="background: rgba(0, 240, 255, 0.2); color: #00f0ff; border: 1px solid rgba(0, 240, 255, 0.45); font-weight: 800; font-size: 0.68rem; padding: 0.1rem 0.35rem; border-radius: 6px; white-space: nowrap;">🥈 2nd</span>';
      } else if (rank === 3) {
        rankBadgeHtml = '<span style="background: rgba(255, 119, 0, 0.2); color: #ff7700; border: 1px solid rgba(255, 119, 0, 0.45); font-weight: 800; font-size: 0.68rem; padding: 0.1rem 0.35rem; border-radius: 6px; white-space: nowrap;">🥉 3rd</span>';
      } else if (rank && rank <= 10) {
        rankBadgeHtml = `<span style="background: rgba(0, 255, 135, 0.15); color: #00ff87; border: 1px solid rgba(0, 255, 135, 0.4); font-weight: 800; font-size: 0.68rem; padding: 0.1rem 0.35rem; border-radius: 6px; white-space: nowrap;">#${rank}</span>`;
      } else if (rank && rank <= 100) {
        rankBadgeHtml = `<span style="background: rgba(255, 255, 255, 0.08); color: #fff; border: 1px solid var(--border-glass); font-weight: 700; font-size: 0.68rem; padding: 0.1rem 0.35rem; border-radius: 6px; white-space: nowrap;">#${rank}</span>`;
      } else if (rank === 101) {
        rankBadgeHtml = '<span style="color: var(--text-dim); font-size: 0.68rem; font-weight: 600; white-space: nowrap;">100+</span>';
      } else {
        rankBadgeHtml = '<span style="color: var(--text-dim); font-size: 0.68rem; opacity: 0.6; white-space: nowrap;">Unranked</span>';
      }

      const isRankedInPool = rank && rank <= 100;

      return `
        <div class="standing-breakdown-row ${isRankedInPool ? 'is-ranked' : ''}" onclick="closeModal('my-weekly-standing'); if(window.switchTab) window.switchTab('games'); if(window.switchGameModeView) window.switchGameModeView('${game.modeView}');" title="Click to play ${game.title}">
          <div class="standing-col-game">
            <span class="standing-game-icon">${game.icon}</span>
            <div class="standing-game-meta">
              <div class="standing-game-title">${game.title}</div>
              <div class="standing-game-pool">Pool: ${pool.toLocaleString()} PGT</div>
            </div>
          </div>
          
          <div class="standing-col-rank">
            ${rankBadgeHtml}
            <span class="standing-score-val">${score > 0 ? score.toLocaleString() : '--'}</span>
          </div>

          <div class="standing-col-payout">
            ${finalPrize > 0 ? `
              <div class="standing-payout-val">+${finalPrize.toLocaleString()} PGT</div>
              <div class="standing-sub-payout">${gpPts > 0 ? `+${gpPts} GP` : ''} ${playerMult > 1.0 ? `<span style="color:#ffd700;">(${playerMultStr}x)</span>` : ''}</div>
            ` : (gpPts > 0 ? `
              <div class="standing-gp-only">+${gpPts} GP pts</div>
              <div class="standing-sub-payout">0 PGT</div>
            ` : `
              <div class="standing-payout-zero">0 PGT</div>
              <div class="standing-sub-payout">0 GP</div>
            `)}
          </div>
        </div>
      `;
    }).join('');

    const summaryCardsHtml = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.5rem; margin-bottom: 0.35rem;">
        <!-- Grand Prix Overall -->
        <div style="background: rgba(0, 240, 255, 0.06); border: 1px solid rgba(0, 240, 255, 0.25); border-radius: 12px; padding: 0.75rem; text-align: center;">
          <div style="font-size: 0.68rem; font-weight: 800; color: var(--color-primary); letter-spacing: 0.5px; text-transform: uppercase;">Grand Prix Rank</div>
          <div style="font-size: 1.35rem; font-weight: 900; color: #fff; margin: 0.2rem 0;">
            ${userGpRank ? (userGpRank === 1 ? '🥇 #1' : (userGpRank === 2 ? '🥈 #2' : (userGpRank === 3 ? '🥉 #3' : `#${userGpRank}`))) : '--'}
          </div>
          <div style="font-size: 0.72rem; color: #ffaa00; font-weight: 700;">
            ${userGpPoints} Total PTS
          </div>
        </div>

        <!-- Multiplier -->
        <div style="background: rgba(255, 234, 0, 0.06); border: 1px solid rgba(255, 234, 0, 0.25); border-radius: 12px; padding: 0.75rem; text-align: center;">
          <div style="font-size: 0.68rem; font-weight: 800; color: #ffea00; letter-spacing: 0.5px; text-transform: uppercase;">Active Multiplier</div>
          <div style="font-size: 1.35rem; font-weight: 900; color: #ffea00; margin: 0.2rem 0;">
            ⚡ ${playerMultStr}x
          </div>
          <div style="font-size: 0.72rem; color: var(--text-dim);">
            ${isVip ? (vipLvl >= 2 ? 'VIP Gold' : 'VIP Silver') : 'Standard Tier'}
          </div>
        </div>

        <!-- Est. Weekly Reward -->
        <div style="background: rgba(0, 255, 135, 0.06); border: 1px solid rgba(0, 255, 135, 0.25); border-radius: 12px; padding: 0.75rem; text-align: center;">
          <div style="font-size: 0.68rem; font-weight: 800; color: #00ff87; letter-spacing: 0.5px; text-transform: uppercase;">Est. Sunday Payout</div>
          <div style="font-size: 1.35rem; font-weight: 900; color: #00ff87; margin: 0.2rem 0; text-shadow: 0 0 10px rgba(0, 255, 135, 0.3);">
            ${totalEstWeeklyPgt.toLocaleString()} <span style="font-size: 0.8rem;">PGT</span>
          </div>
          <div style="font-size: 0.72rem; color: var(--text-dim);">
            Across ${gamesRankedInTop100} Ranked ${gamesRankedInTop100 === 1 ? 'Game' : 'Games'}
          </div>
        </div>
      </div>
    `;

    bodyEl.innerHTML = `
      ${summaryCardsHtml}

      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.4rem; padding: 0 0.1rem;">
        <span style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">
          🎮 Game Leaderboards Breakdown
        </span>
        <span style="font-size: 0.68rem; color: var(--text-dim);">
          Resets Sunday 00:00 UTC
        </span>
      </div>

      <div class="standing-rows-container">
        ${gameRowsHtml}
      </div>

      <div style="background: rgba(0, 240, 255, 0.04); border: 1px dashed rgba(0, 240, 255, 0.2); border-radius: 10px; padding: 0.65rem 0.85rem; font-size: 0.72rem; color: var(--text-dim); line-height: 1.4;">
        💡 <strong>Tournament Rules:</strong> Top 100 on every individual game leaderboard receive a direct weekly PGT pool payout. Top 10 also earn Grand Prix championship points toward the showcase podium.
      </div>

      <div style="display: flex; gap: 0.5rem; margin-top: 0.3rem;">
        <button class="btn btn-primary" onclick="closeModal('my-weekly-standing'); if(window.switchTab) window.switchTab('games');" style="flex: 1; background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)); color: #000; font-weight: 800; font-size: 0.85rem; padding: 0.65rem; border-radius: 8px; border: none; cursor: pointer;">
          🚀 Play Games to Boost Rank
        </button>
        <button class="btn btn-secondary" onclick="closeModal('my-weekly-standing');" style="background: rgba(255, 255, 255, 0.08); color: #fff; font-weight: 700; font-size: 0.85rem; padding: 0.65rem 1.25rem; border-radius: 8px; border: 1px solid var(--border-glass); cursor: pointer;">
          Close
        </button>
      </div>
    `;

  } catch (err) {
    console.error("[openMyWeeklyStandingModal] Error computing weekly standings:", err);
    bodyEl.innerHTML = '<div style="text-align: center; color: var(--color-danger); padding: 2rem;">Error calculating weekly standings. Please try again.</div>';
  }
}

if (typeof window !== 'undefined') {
  window.loadTopWeeklyArcadePlayers = loadTopWeeklyArcadePlayers;
  window.openMyWeeklyStandingModal = openMyWeeklyStandingModal;
}

