// ============================================================
// POLYGAME: ARCADE GAMES VIEW & TAB NAVIGATION ROUTER
// Manages tab switching, fullscreen mode, and game panel routing
// ============================================================

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

    if (overlayArcade) overlayArcade.classList.remove('hidden');
    if (overlayInvaders) overlayInvaders.style.display = 'flex';
    if (startDrift) startDrift.style.display = 'flex';
    if (gameoverDrift) gameoverDrift.style.display = 'none';
    if (controlsDrift) controlsDrift.style.display = 'none';
    if (startStacker) startStacker.style.display = 'flex';
    if (gameoverStacker) gameoverStacker.style.display = 'none';
    if (startSkeet) startSkeet.style.display = 'flex';
    if (gameoverSkeet) gameoverSkeet.style.display = 'none';
    if (startDefense) startDefense.style.display = 'flex';
    if (gameoverDefense) gameoverDefense.style.display = 'none';

    const gameWindowContainer = document.getElementById('game-window-container');
    if (gameWindowContainer) gameWindowContainer.classList.remove('fullscreen-active');

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
      'panel-game-roshambo', 'panel-game-spinner', 'panel-game-crash', 'panel-game-plinko'
    ];
    panelIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    // Hide all game-specific leaderboard columns
    const lbIds = ['leaderboard-col-arcade', 'leaderboard-col-invaders', 'leaderboard-col-drift', 'leaderboard-col-stacker', 'leaderboard-col-skeet', 'leaderboard-col-defense'];
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

  // 1. Any logged-in Admin is automatically a whitelisted tester
  if (window.appState.state && window.appState.state.isAdmin) return true;

  // 2. Extract all identifiers across state and local storage
  const playerId = (window.appState.getPlayerId?.() || window.appState.state?.playerId || '').toLowerCase();
  const wallet = (window.appState.state?.walletAddress || '').toLowerCase();
  const linked = (window.appState.state?.linkedWalletAddress || '').toLowerCase();
  const localPid = (typeof localStorage !== 'undefined' ? (localStorage.getItem('polygame_player_id') || '') : '').toLowerCase();

  const WHITELISTED_IDS = [
    '0x10b9993990c9ef8a212c9557cb02ad94da9a654d', // Master Admin Wallet
    '0xpgt85c8416473bd6a8c45ada81ac85aeabb',       // Master Admin Player ID
    '0x92206284cae2b1be18c8bcc9042ee5cd3cfcd7a5', // Poss Wallet
    '0xpgt8312e02d37185b5983e6922d1dae1cce'        // Poss Player ID
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
  if (!settings) return;

  const isWhitelistedTester = isWhitelistedGameTester();

  const cards = document.querySelectorAll('.nft-card[data-game-key]');
  cards.forEach(card => {
    const key = card.getAttribute('data-game-key');
    const conf = settings[key] || {};
    let badgeContainer = card.querySelector('.game-tile-badges');
    if (!badgeContainer) {
      badgeContainer = document.createElement('div');
      badgeContainer.className = 'game-tile-badges';
      badgeContainer.style.cssText = 'position: absolute; top: 12px; right: 12px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; z-index: 5;';
      card.style.position = 'relative';
      card.prepend(badgeContainer);
    }

    let badgesHtml = '';

    // 0. Test Mode Check (Hidden from public; only visible to Admin and Poss)
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

    badgeContainer.innerHTML = badgesHtml;
  });
}
window.updateGameTileBadges = updateGameTileBadges;

export function switchGameModeView(mode) {
  // VIP Access Guard check
  const isVip = window.appState && typeof window.appState.isVipActive === 'function' && window.appState.isVipActive();
  const isAmb = window.appState && window.appState.state && window.appState.state.isAmbassador;
  const isAdmin = window.appState && window.appState.state && window.appState.state.isAdmin;

  const settings = (window.appState && window.appState.state && window.appState.state.gamePayoutSettings) || {};
  const gameKeyMap = { 'arcade': 'astrododge', 'invaders': 'invaders', 'drift': 'drift', 'catcher': 'stacker', 'stacker': 'stacker', 'skeet': 'skeet', 'defense': 'defense', 'roshambo': 'roshambo', 'spinner': 'spinner', 'plinko': 'plinko', 'crash': 'crash', 'mines': 'mines' };
  const gKey = gameKeyMap[mode] || mode;

  // Test Mode Whitelist Guard (Blocks non-testers from launching test_mode games)
  if (settings[gKey] && settings[gKey].test_mode) {
    if (!isWhitelistedGameTester()) {
      if (window.triggerToast) window.triggerToast("🧪 This game is currently in private test mode.", "warning");
      return;
    }
  }

  const isVipOnly = settings[gKey] ? Boolean(settings[gKey].vip_only) : (gKey === 'stacker');

  if (isVipOnly && !isVip && !isAmb && !isAdmin) {
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

  if (panelArcade) panelArcade.style.display = 'none';
  if (panelInvaders) panelInvaders.style.display = 'none';
  if (panelDrift) panelDrift.style.display = 'none';
  if (panelStacker) panelStacker.style.display = 'none';
  if (panelSkeet) panelSkeet.style.display = 'none';
  if (panelDefense) panelDefense.style.display = 'none';
  if (panelRoshambo) panelRoshambo.style.display = 'none';
  if (panelSpinner) panelSpinner.style.display = 'none';
  if (panelCrash) panelCrash.style.display = 'none';
  if (panelPlinko) panelPlinko.style.display = 'none';
  if (panelMines) panelMines.style.display = 'none';

  if (lbArcade) lbArcade.style.display = 'none';
  if (lbInvaders) lbInvaders.style.display = 'none';
  if (lbDrift) lbDrift.style.display = 'none';
  if (lbStacker) lbStacker.style.display = 'none';
  if (lbSkeet) lbSkeet.style.display = 'none';
  if (lbDefense) lbDefense.style.display = 'none';

  if (mode === 'arcade') {
    if (panelArcade) panelArcade.style.display = 'flex';
    if (lbArcade) lbArcade.style.display = 'block';
    const overlay = document.getElementById('game-ui-overlay');
    if (overlay) overlay.classList.remove('hidden');
  } else if (mode === 'invaders') {
    if (panelInvaders) panelInvaders.style.display = 'flex';
    if (lbInvaders) lbInvaders.style.display = 'block';
    const overlay = document.getElementById('invaders-ui-overlay');
    if (overlay) overlay.style.display = 'flex';
  } else if (mode === 'drift') {
    if (panelDrift) panelDrift.style.display = 'flex';
    if (lbDrift) lbDrift.style.display = 'block';
    const overlay = document.getElementById('drift-ui-overlay');
    if (overlay) overlay.style.display = 'flex';
    if (window.cyberDrift && typeof window.cyberDrift.resize === 'function') {
      window.cyberDrift.resize();
    }
    if (typeof window.loadDriftLeaderboard === 'function') window.loadDriftLeaderboard();
  } else if (mode === 'stacker' || mode === 'catcher') {
    if (panelStacker) panelStacker.style.display = 'flex';
    if (lbStacker) lbStacker.style.display = 'block';
    const startScreen = document.getElementById('stacker-start-screen') || document.getElementById('catcher-start-screen');
    if (startScreen) startScreen.style.display = 'flex';
    if (window.cyberStacker) {
      if (typeof window.cyberStacker.ensureCanvas === 'function') window.cyberStacker.ensureCanvas();
      if (typeof window.cyberStacker.resize === 'function') window.cyberStacker.resize();
    }
    if (typeof window.loadStackerLeaderboard === 'function') window.loadStackerLeaderboard();
    else if (typeof window.loadCatcherLeaderboard === 'function') window.loadCatcherLeaderboard();
  } else if (mode === 'skeet') {
    if (panelSkeet) panelSkeet.style.display = 'flex';
    if (lbSkeet) lbSkeet.style.display = 'block';
    const startScreen = document.getElementById('skeet-overlay-start');
    if (startScreen) startScreen.classList.remove('hidden');
    if (typeof window.initCyberSkeet === 'function') window.initCyberSkeet();
    if (typeof window.loadSkeetLeaderboard === 'function') window.loadSkeetLeaderboard();
  } else if (mode === 'defense') {
    if (panelDefense) panelDefense.style.display = 'flex';
    if (lbDefense) lbDefense.style.display = 'block';
    const startScreen = document.getElementById('defense-overlay-start');
    if (startScreen) startScreen.style.display = 'flex';
    if (typeof window.initCyberDefense === 'function') window.initCyberDefense();
    if (typeof window.loadDefenseLeaderboard === 'function') window.loadDefenseLeaderboard();
    else if (typeof window.loadGameLeaderboard === 'function') window.loadGameLeaderboard('defense');
  } else if (mode === 'roshambo') {
    if (panelRoshambo) panelRoshambo.style.display = 'block';
    if (typeof window.updateRoshamboWagerLabels === 'function') window.updateRoshamboWagerLabels();
  } else if (mode === 'spinner') {
    if (panelSpinner) panelSpinner.style.display = 'block';
    if (typeof window.updateSpinnerWagerLabels === 'function') window.updateSpinnerWagerLabels();
  } else if (mode === 'crash') {
    if (panelCrash) panelCrash.style.display = 'block';
    if (window.updateCrashWagerLabels) window.updateCrashWagerLabels();
  } else if (mode === 'plinko') {
    if (panelPlinko) panelPlinko.style.display = 'block';
    if (window.updatePlinkoWagerLabels) window.updatePlinkoWagerLabels();
  } else if (mode === 'mines') {
    if (panelMines) panelMines.style.display = 'block';
    if (window.updateMinesWagerLabels) window.updateMinesWagerLabels();
    if (window.renderMinesBoard) window.renderMinesBoard();
  }

  // Automatically trigger full screen mode on mobile screens (≤768px)
  if (window.innerWidth <= 768) {
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
