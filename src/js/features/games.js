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

    // Stop active game loops
    try { if (window.dodgeGame) window.dodgeGame.isPlaying = false; } catch (e) {}
    try { if (window.invadersGame) window.invadersGame.isPlaying = false; } catch (e) {}
    try { if (window.cyberDrift) window.cyberDrift.isRunning = false; } catch (e) {}
    try { if (window.cyberCatcher) window.cyberCatcher.isPlaying = false; } catch (e) {}

    // Restore start screen UI overlays so game is ready when player returns
    const overlayArcade = document.getElementById('game-ui-overlay');
    const overlayInvaders = document.getElementById('invaders-ui-overlay');
    const overlayDrift = document.getElementById('drift-ui-overlay');
    const startCatcher = document.getElementById('catcher-start-screen');

    if (overlayArcade) overlayArcade.classList.remove('hidden');
    if (overlayInvaders) overlayInvaders.style.display = 'flex';
    if (overlayDrift) overlayDrift.style.display = 'flex';
    if (startCatcher) startCatcher.style.display = 'flex';

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
      'panel-game-arcade', 'panel-game-invaders', 'panel-game-drift', 'panel-game-catcher',
      'panel-game-roshambo', 'panel-game-spinner', 'panel-game-crash', 'panel-game-plinko'
    ];
    panelIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    // Hide all game-specific leaderboard columns
    const lbIds = ['leaderboard-col-arcade', 'leaderboard-col-invaders', 'leaderboard-col-drift', 'leaderboard-col-catcher'];
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

export function switchGameModeView(mode) {
  // VIP Access Guard check
  const isVip = window.appState && typeof window.appState.isVipActive === 'function' && window.appState.isVipActive();
  const isAmb = window.appState && window.appState.state && window.appState.state.isAmbassador;
  const isAdmin = window.appState && window.appState.state && window.appState.state.isAdmin;

  const settings = (window.appState && window.appState.state && window.appState.state.gamePayoutSettings) || {};
  const gameKeyMap = { 'arcade': 'astrododge', 'invaders': 'invaders', 'drift': 'drift', 'catcher': 'catcher', 'roshambo': 'roshambo', 'spinner': 'spinner', 'plinko': 'plinko', 'crash': 'crash' };
  const gKey = gameKeyMap[mode] || mode;
  const isVipOnly = settings[gKey] ? Boolean(settings[gKey].vip_only) : (mode === 'catcher');

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
  const panelRoshambo = document.getElementById('panel-game-roshambo');
  const panelSpinner = document.getElementById('panel-game-spinner');
  const panelCrash = document.getElementById('panel-game-crash');
  const panelPlinko = document.getElementById('panel-game-plinko');

  const lbArcade = document.getElementById('leaderboard-col-arcade');
  const lbInvaders = document.getElementById('leaderboard-col-invaders');
  const lbDrift = document.getElementById('leaderboard-col-drift');
  const lbStacker = document.getElementById('leaderboard-col-stacker') || document.getElementById('leaderboard-col-catcher');

  if (panelArcade) panelArcade.style.display = 'none';
  if (panelInvaders) panelInvaders.style.display = 'none';
  if (panelDrift) panelDrift.style.display = 'none';
  if (panelStacker) panelStacker.style.display = 'none';
  if (panelRoshambo) panelRoshambo.style.display = 'none';
  if (panelSpinner) panelSpinner.style.display = 'none';
  if (panelCrash) panelCrash.style.display = 'none';
  if (panelPlinko) panelPlinko.style.display = 'none';

  if (lbArcade) lbArcade.style.display = 'none';
  if (lbInvaders) lbInvaders.style.display = 'none';
  if (lbDrift) lbDrift.style.display = 'none';
  if (lbStacker) lbStacker.style.display = 'none';

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
