// ============================================================
// POLYGAME: ARCADE GAMES VIEW & TAB NAVIGATION ROUTER
// Manages tab switching, fullscreen mode, and game panel routing
// ============================================================

export function switchGameCategory(category) {
  const tabEarn = document.getElementById('tab-category-earn');
  const tabBet = document.getElementById('tab-category-bet');
  const tabAdventure = document.getElementById('tab-category-adventure');

  const gridEarn = document.getElementById('grid-category-earn');
  const gridBet = document.getElementById('grid-category-bet');
  const gridAdventure = document.getElementById('grid-category-adventure');

  // Ensure game view is closed when switching category
  closeGameView();

  if (tabEarn) tabEarn.classList.remove('active');
  if (tabBet) tabBet.classList.remove('active');
  if (tabAdventure) tabAdventure.classList.remove('active');

  if (gridEarn) { gridEarn.style.display = 'none'; gridEarn.classList.remove('grid-category-hidden'); }
  if (gridBet) { gridBet.style.display = 'none'; gridBet.classList.remove('grid-category-hidden'); }
  if (gridAdventure) { gridAdventure.style.display = 'none'; gridAdventure.classList.remove('grid-category-hidden'); }

  if (category === 'earn' && tabEarn && gridEarn) {
    tabEarn.classList.add('active');
    gridEarn.style.display = 'grid';
  } else if (category === 'bet' && tabBet && gridBet) {
    tabBet.classList.add('active');
    gridBet.style.display = 'block';
  } else if (category === 'adventure' && tabAdventure && gridAdventure) {
    tabAdventure.classList.add('active');
    gridAdventure.style.display = 'block';
    if (window.polySpaceEngine) {
      setTimeout(() => window.polySpaceEngine.init(), 50);
    }
  }
}

export function closeGameView() {
  document.body.classList.remove('game-fullscreen-open');
  const sidebarEl = document.querySelector('.sidebar');
  if (sidebarEl) sidebarEl.style.display = '';

  if (typeof window.exitGameFullscreen === 'function') {
    window.exitGameFullscreen();
  }

  // Stop active game loops
  if (window.dodgeGame) window.dodgeGame.isPlaying = false;
  if (window.invadersGame) window.invadersGame.isPlaying = false;
  if (window.cyberDrift) window.cyberDrift.isRunning = false;

  // Restore start screen UI overlays so game is ready when player returns
  const overlayArcade = document.getElementById('game-ui-overlay');
  const overlayInvaders = document.getElementById('invaders-ui-overlay');
  const overlayDrift = document.getElementById('drift-ui-overlay');

  if (overlayArcade) overlayArcade.classList.remove('hidden');
  if (overlayInvaders) overlayInvaders.style.display = 'flex';
  if (overlayDrift) overlayDrift.style.display = 'flex';

  const gameWindowContainer = document.getElementById('game-window-container');
  if (gameWindowContainer) gameWindowContainer.classList.remove('fullscreen-active');

  const activeContainer = document.getElementById('active-game-container');
  const tabsContainer = document.getElementById('games-category-tabs');
  
  if (activeContainer) activeContainer.style.display = 'none';
  if (tabsContainer) tabsContainer.style.display = 'flex';

  const gridEarn = document.getElementById('grid-category-earn');
  const gridBet = document.getElementById('grid-category-bet');
  const gridAdventure = document.getElementById('grid-category-adventure');

  if (gridEarn) gridEarn.classList.remove('grid-category-hidden');
  if (gridBet) gridBet.classList.remove('grid-category-hidden');
  if (gridAdventure) gridAdventure.classList.remove('grid-category-hidden');

  // Reactivate the correct grid based on active tab
  const activeTab = document.querySelector('#games-category-tabs .nft-tab.active');
  if (activeTab) {
    const id = activeTab.id;
    if (id === 'tab-category-earn' && gridEarn) gridEarn.style.display = 'grid';
    if (id === 'tab-category-bet' && gridBet) gridBet.style.display = 'block';
    if (id === 'tab-category-adventure' && gridAdventure) gridAdventure.style.display = 'block';
  }
}

export function switchGameModeView(mode) {
  const activeContainer = document.getElementById('active-game-container');
  const tabsContainer = document.getElementById('games-category-tabs');
  
  const gridEarn = document.getElementById('grid-category-earn');
  const gridBet = document.getElementById('grid-category-bet');
  const gridAdventure = document.getElementById('grid-category-adventure');

  if (activeContainer) activeContainer.style.display = 'grid';
  if (tabsContainer) tabsContainer.style.display = 'flex';
  
  if (gridEarn) { gridEarn.style.display = 'none'; gridEarn.classList.add('grid-category-hidden'); }
  if (gridBet) { gridBet.style.display = 'none'; gridBet.classList.add('grid-category-hidden'); }
  if (gridAdventure) { gridAdventure.style.display = 'none'; gridAdventure.classList.add('grid-category-hidden'); }

  const panelArcade = document.getElementById('panel-game-arcade');
  const panelInvaders = document.getElementById('panel-game-invaders');
  const panelDrift = document.getElementById('panel-game-drift');
  const panelRoshambo = document.getElementById('panel-game-roshambo');
  const panelSpinner = document.getElementById('panel-game-spinner');
  const panelCrash = document.getElementById('panel-game-crash');
  const panelPlinko = document.getElementById('panel-game-plinko');

  const lbArcade = document.getElementById('leaderboard-col-arcade');
  const lbInvaders = document.getElementById('leaderboard-col-invaders');
  const lbDrift = document.getElementById('leaderboard-col-drift');

  if (panelArcade) panelArcade.style.display = 'none';
  if (panelInvaders) panelInvaders.style.display = 'none';
  if (panelDrift) panelDrift.style.display = 'none';
  if (panelRoshambo) panelRoshambo.style.display = 'none';
  if (panelSpinner) panelSpinner.style.display = 'none';
  if (panelCrash) panelCrash.style.display = 'none';
  if (panelPlinko) panelPlinko.style.display = 'none';

  if (lbArcade) lbArcade.style.display = 'none';
  if (lbInvaders) lbInvaders.style.display = 'none';
  if (lbDrift) lbDrift.style.display = 'none';

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
