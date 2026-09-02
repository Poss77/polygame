import { appState } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { supabase } from '../core/config.js';
import { triggerToast } from '../core/ui.js';
import { recordGameMetrics, logBetWin } from '../core/db-sync.js';
import { triggerConfetti } from '../utils/confetti.js';

let minesIsPlaying = false;
let minesSessionId = null;
let minesBet = 50;
let minesCount = 3;
let revealedCount = 0;
let revealedTiles = new Set();
let currentMultiplier = 1.00;
let nextMultiplier = 1.07;
let isBusy = false;

// Client-side exact mathematical multiplier calculator (94.0% RTP / 6.0% House Edge)
export function calculateMinesMultiplier(mines, step, rtp = 0.94) {
  if (mines < 1 || mines > 24 || step < 1 || step > (25 - mines)) return 1.00;
  let mult = rtp;
  for (let i = 0; i < step; i++) {
    mult *= (25 - i) / (25 - mines - i);
  }
  return Math.round(mult * 100) / 100;
}
window.calculateMinesMultiplier = calculateMinesMultiplier;

export function updateMinesWagerLabels() {
  const label = document.getElementById('mines-wallet-balance-label');
  if (label) {
    label.innerText = `${parseFloat(appState.state.balancePgt || 0).toFixed(2)} PGT`;
  }
}
window.updateMinesWagerLabels = updateMinesWagerLabels;

export function setMinesWager(type) {
  if (minesIsPlaying) return;
  const input = document.getElementById('mines-bet-input');
  if (!input) return;
  const bal = appState.state.balancePgt || 0;
  let val = parseInt(input.value) || 0;

  if (type === 'min') val = 10;
  else if (type === 'half') val = Math.max(10, Math.floor(val / 2));
  else if (type === 'double') val = Math.max(10, val * 2);
  else if (type === 'max') val = Math.max(10, Math.floor(bal));

  if (val < 10) val = 10;
  if (val > bal && bal >= 10) val = Math.floor(bal);

  input.value = val;
  minesBet = val;
  updateMinesHUD();
}
window.setMinesWager = setMinesWager;

export function setMinesCount(count) {
  if (minesIsPlaying) return;
  const parsed = parseInt(count, 10);
  if (isNaN(parsed) || parsed < 1 || parsed > 24) return;
  minesCount = parsed;

  const countInput = document.getElementById('mines-count-input');
  if (countInput) countInput.value = minesCount;

  // Update active pill highlight
  document.querySelectorAll('.mines-pill-btn').forEach(btn => {
    const val = parseInt(btn.getAttribute('data-mines'), 10);
    if (val === minesCount) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  updateMinesHUD();
}
window.setMinesCount = setMinesCount;

function updateMinesHUD() {
  const currentMultEl = document.getElementById('mines-current-mult-display');
  const nextMultEl = document.getElementById('mines-next-mult-display');
  const profitEl = document.getElementById('mines-profit-display');
  const safeLeftEl = document.getElementById('mines-safe-left-display');

  const safeTotal = 25 - minesCount;

  if (currentMultEl) {
    currentMultEl.innerText = `${currentMultiplier.toFixed(2)}x`;
  }
  if (nextMultEl) {
    const nextStep = revealedCount + 1;
    const calcNext = nextStep <= safeTotal ? calculateMinesMultiplier(minesCount, nextStep) : currentMultiplier;
    nextMultEl.innerText = `${calcNext.toFixed(2)}x`;
  }
  if (profitEl) {
    const input = document.getElementById('mines-bet-input');
    const betVal = parseInt(input?.value, 10) || minesBet || 10;
    const currentPayout = Math.round(betVal * currentMultiplier * 100) / 100;
    const profit = Math.max(0, currentPayout - betVal);
    profitEl.innerText = `${profit > 0 ? '+' : ''}${profit.toFixed(2)} PGT`;
  }
  if (safeLeftEl) {
    safeLeftEl.innerText = `${revealedCount} / ${safeTotal} Safe`;
  }
}

export function renderMinesBoard(isInitial = false) {
  const gridContainer = document.getElementById('mines-grid-container');
  if (!gridContainer) return;

  gridContainer.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const tile = document.createElement('button');
    tile.className = 'mines-tile';
    tile.setAttribute('data-index', i);
    tile.id = `mines-tile-${i}`;
    tile.innerHTML = `<span class="tile-icon"></span>`;
    tile.onclick = () => handleMinesTileClick(i);

    if (!minesIsPlaying) {
      tile.classList.add('disabled');
    }
    gridContainer.appendChild(tile);
  }

  if (isInitial) {
    updateMinesHUD();
    updateMinesWagerLabels();
  }
}
window.renderMinesBoard = renderMinesBoard;

export async function startMinesGame() {
  if (minesIsPlaying || isBusy) return;

  const input = document.getElementById('mines-bet-input');
  if (!input) return;
  minesBet = Math.floor(parseFloat(input.value)) || 0;
  const balance = appState.state.balancePgt || 0;

  if (minesBet < 10) {
    triggerToast("Minimum wager is 10 PGT!", "error");
    return;
  }
  if (minesBet > balance) {
    triggerToast("Insufficient PGT balance!", "error");
    return;
  }

  isBusy = true;
  const btnAction = document.getElementById('btn-mines-action');
  if (btnAction) {
    btnAction.disabled = true;
    btnAction.innerText = "INITIALIZING...";
  }

  // Deduct bet locally upfront
  appState.update({ balancePgt: balance - minesBet });
  updateMinesWagerLabels();
  if (window.processBetJackpot) {
    window.processBetJackpot(minesBet, 'Cyber Mines');
  }

  let serverResult = null;
  let rpcFailed = false;
  const targetWallet = (appState.state.walletAddress || appState.state.linkedWalletAddress || appState.getPlayerId() || '').toLowerCase();

  try {
    if (supabase && targetWallet) {
      const res = await supabase.rpc('start_mines_game', {
        p_wallet: targetWallet,
        p_bet: minesBet,
        p_mines: minesCount
      });
      if (res.error) {
        console.error("Start Mines RPC Error:", res.error);
        rpcFailed = true;
      } else {
        serverResult = Array.isArray(res.data) ? res.data[0] : res.data;
      }
    } else {
      rpcFailed = true;
    }
  } catch (err) {
    console.error("Start Mines execution exception:", err);
    rpcFailed = true;
  }

  if (rpcFailed || !serverResult || serverResult.error || !serverResult.success) {
    triggerToast(serverResult?.error || "Server validation failed! Refunding bet.", "error");
    isBusy = false;
    // Refund wager locally
    appState.update({ balancePgt: appState.state.balancePgt + minesBet });
    updateMinesWagerLabels();
    if (btnAction) {
      btnAction.disabled = false;
      btnAction.innerText = "START GAME";
    }
    return;
  }

  // Session initialized successfully
  minesIsPlaying = true;
  minesSessionId = serverResult.session_id;
  revealedCount = 0;
  revealedTiles.clear();
  currentMultiplier = 1.00;
  nextMultiplier = serverResult.next_multiplier || calculateMinesMultiplier(minesCount, 1);
  isBusy = false;

  // Lock configuration inputs while round is active
  if (input) input.disabled = true;
  const countInput = document.getElementById('mines-count-input');
  if (countInput) countInput.disabled = true;
  document.querySelectorAll('.mines-pill-btn').forEach(btn => btn.classList.add('locked'));
  document.querySelectorAll('.mines-wager-mod-btn').forEach(btn => btn.disabled = true);

  // Render fresh clickable grid
  renderMinesBoard();
  document.querySelectorAll('.mines-tile').forEach(t => t.classList.remove('disabled'));

  // Update Action Button to CASHOUT (disabled until first safe gem is found)
  if (btnAction) {
    btnAction.disabled = true;
    btnAction.className = "btn-primary btn-mines-cashout";
    btnAction.innerText = "CASHOUT (0.00 PGT)";
    btnAction.onclick = cashoutMinesGame;
  }

  updateMinesHUD();
  sfx.playPowerUp();
  triggerToast("💣 Board armed! Uncover safe diamonds to climb multipliers.", "info");
}
window.startMinesGame = startMinesGame;

export async function handleMinesTileClick(tileIndex) {
  if (!minesIsPlaying || isBusy || revealedTiles.has(tileIndex)) return;

  const tileEl = document.getElementById(`mines-tile-${tileIndex}`);
  if (!tileEl) return;

  isBusy = true;
  tileEl.classList.add('revealing');

  const targetWallet = (appState.state.walletAddress || appState.state.linkedWalletAddress || appState.getPlayerId() || '').toLowerCase();
  let serverResult = null;
  let rpcFailed = false;

  try {
    if (supabase && targetWallet && minesSessionId) {
      const res = await supabase.rpc('reveal_mines_tile', {
        p_wallet: targetWallet,
        p_session_id: minesSessionId,
        p_tile_index: tileIndex
      });
      if (res.error) {
        console.error("Reveal Tile RPC Error:", res.error);
        rpcFailed = true;
      } else {
        serverResult = Array.isArray(res.data) ? res.data[0] : res.data;
      }
    } else {
      rpcFailed = true;
    }
  } catch (err) {
    console.error("Reveal Tile exception:", err);
    rpcFailed = true;
  }

  tileEl.classList.remove('revealing');

  if (rpcFailed || !serverResult || serverResult.error || !serverResult.success) {
    triggerToast(serverResult?.error || "Error revealing tile. Please try again.", "error");
    isBusy = false;
    return;
  }

  // Handle MINE DETONATION (BUST)
  if (serverResult.status === 'mine') {
    minesIsPlaying = false;
    isBusy = false;

    // Detonate clicked tile
    tileEl.classList.add('tile-mine', 'tile-detonated');
    tileEl.innerHTML = `<span class="tile-icon">💥</span>`;
    sfx.playMineDetonation();

    // Shake board
    const boardEl = document.getElementById('mines-grid-container');
    if (boardEl) {
      boardEl.classList.add('mines-board-shake');
      setTimeout(() => boardEl.classList.remove('mines-board-shake'), 600);
    }

    // Reveal all remaining hidden mines in dimmed red/amber
    const allMines = serverResult.all_mines || [];
    allMines.forEach(mIdx => {
      if (mIdx !== tileIndex) {
        const mEl = document.getElementById(`mines-tile-${mIdx}`);
        if (mEl && !revealedTiles.has(mIdx)) {
          mEl.classList.add('tile-mine', 'tile-dormant-mine');
          mEl.innerHTML = `<span class="tile-icon">💣</span>`;
        }
      }
    });

    // Disable all tiles
    document.querySelectorAll('.mines-tile').forEach(t => t.classList.add('disabled'));

    // Reset controls
    recordGameMetrics('Cyber Mines', minesBet, 0);
    triggerToast(`💥 EMP Mine hit at #${tileIndex + 1}! Round lost.`, "error");
    appState.addActivity('You', `hit an EMP Mine in Cyber Mines`, `-${minesBet} PGT`);

    resetMinesControls();
    return;
  }

  // Handle SAFE GEM FOUND
  if (serverResult.status === 'gem') {
    revealedCount = serverResult.revealed_count || (revealedCount + 1);
    revealedTiles.add(tileIndex);
    currentMultiplier = parseFloat(serverResult.current_multiplier) || calculateMinesMultiplier(minesCount, revealedCount);
    nextMultiplier = parseFloat(serverResult.next_multiplier) || calculateMinesMultiplier(minesCount, revealedCount + 1);

    tileEl.classList.add('tile-gem');
    tileEl.innerHTML = `<span class="tile-icon">💎</span>`;
    sfx.playMineGemPick(revealedCount);

    const currentPayout = Math.round(minesBet * currentMultiplier * 100) / 100;
    const currentProfit = Math.max(0, currentPayout - minesBet);

    // Update Cashout button with live value
    const btnAction = document.getElementById('btn-mines-action');
    if (btnAction) {
      btnAction.disabled = false;
      btnAction.innerText = `CASHOUT ${currentPayout.toFixed(2)} PGT (+${currentProfit.toFixed(2)})`;
    }

    updateMinesHUD();

    // Check if player cleared ALL safe diamonds on the board!
    if (serverResult.all_cleared) {
      minesIsPlaying = false;
      isBusy = false;

      const finalPayout = serverResult.payout || currentPayout;
      appState.update({ balancePgt: serverResult.new_balance || (appState.state.balancePgt + finalPayout) });
      updateMinesWagerLabels();

      sfx.playRelicFanfare();
      triggerConfetti();
      triggerToast(`🏆 ALL DIAMONDS CLEARED! Won ${finalPayout.toFixed(2)} PGT! (${currentMultiplier}x)`, "success");
      appState.addActivity('You', `cleared all diamonds in Cyber Mines (${currentMultiplier}x)`, `+${finalPayout} PGT`);

      recordGameMetrics('Cyber Mines', minesBet, finalPayout);
      logBetWin('Cyber Mines', minesBet, finalPayout, currentMultiplier);

      // Reveal remaining mines
      (serverResult.all_mines || []).forEach(mIdx => {
        const mEl = document.getElementById(`mines-tile-${mIdx}`);
        if (mEl && !revealedTiles.has(mIdx)) {
          mEl.classList.add('tile-mine', 'tile-dormant-mine');
          mEl.innerHTML = `<span class="tile-icon">💣</span>`;
        }
      });

      resetMinesControls();
      return;
    }

    isBusy = false;
  }
}
window.handleMinesTileClick = handleMinesTileClick;

export async function cashoutMinesGame() {
  if (!minesIsPlaying || isBusy || revealedCount < 1) return;

  isBusy = true;
  const btnAction = document.getElementById('btn-mines-action');
  if (btnAction) {
    btnAction.disabled = true;
    btnAction.innerText = "CASHING OUT...";
  }

  const targetWallet = (appState.state.walletAddress || appState.state.linkedWalletAddress || appState.getPlayerId() || '').toLowerCase();
  let serverResult = null;
  let rpcFailed = false;

  try {
    if (supabase && targetWallet && minesSessionId) {
      const res = await supabase.rpc('cashout_mines_game', {
        p_wallet: targetWallet,
        p_session_id: minesSessionId
      });
      if (res.error) {
        console.error("Cashout RPC Error:", res.error);
        rpcFailed = true;
      } else {
        serverResult = Array.isArray(res.data) ? res.data[0] : res.data;
      }
    } else {
      rpcFailed = true;
    }
  } catch (err) {
    console.error("Cashout exception:", err);
    rpcFailed = true;
  }

  if (rpcFailed || !serverResult || serverResult.error || !serverResult.success) {
    triggerToast(serverResult?.error || "Cashout failed! Please retry.", "error");
    isBusy = false;
    if (btnAction) {
      const currentPayout = Math.round(minesBet * currentMultiplier * 100) / 100;
      btnAction.disabled = false;
      btnAction.innerText = `CASHOUT ${currentPayout.toFixed(2)} PGT`;
    }
    return;
  }

  // Cashout settled authoritatively on Supabase
  minesIsPlaying = false;
  isBusy = false;

  const payout = parseFloat(serverResult.payout) || (Math.round(minesBet * currentMultiplier * 100) / 100);
  const finalMult = parseFloat(serverResult.multiplier) || currentMultiplier;

  appState.update({ balancePgt: serverResult.new_balance || (appState.state.balancePgt + payout) });
  updateMinesWagerLabels();

  sfx.playMineCashout();
  triggerToast(`💎 Cashed out ${payout.toFixed(2)} PGT! (${finalMult.toFixed(2)}x)`, "success");
  appState.addActivity('You', `cashed out Cyber Mines (${finalMult.toFixed(2)}x)`, `+${payout.toFixed(2)} PGT`);

  // Progressive Jackpot checks
  if (serverResult.jackpot_amount) {
    const counterEl = document.getElementById('progressive-jackpot-counter');
    if (counterEl) counterEl.innerText = `${parseFloat(serverResult.jackpot_amount).toFixed(2)} PGT`;
  }
  if (serverResult.jackpot_won && window.handleServerJackpotWin) {
    window.handleServerJackpotWin(serverResult, 'Cyber Mines');
  }

  recordGameMetrics('Cyber Mines', minesBet, payout);
  logBetWin('Cyber Mines', minesBet, payout, finalMult);

  // Reveal remaining mines in subdued amber
  (serverResult.all_mines || []).forEach(mIdx => {
    const mEl = document.getElementById(`mines-tile-${mIdx}`);
    if (mEl && !revealedTiles.has(mIdx)) {
      mEl.classList.add('tile-mine', 'tile-dormant-mine');
      mEl.innerHTML = `<span class="tile-icon">💣</span>`;
    }
  });

  resetMinesControls();
}
window.cashoutMinesGame = cashoutMinesGame;

function resetMinesControls() {
  const input = document.getElementById('mines-bet-input');
  if (input) input.disabled = false;
  const countInput = document.getElementById('mines-count-input');
  if (countInput) countInput.disabled = false;

  document.querySelectorAll('.mines-pill-btn').forEach(btn => btn.classList.remove('locked'));
  document.querySelectorAll('.mines-wager-mod-btn').forEach(btn => btn.disabled = false);
  document.querySelectorAll('.mines-tile').forEach(t => t.classList.add('disabled'));

  const btnAction = document.getElementById('btn-mines-action');
  if (btnAction) {
    btnAction.disabled = false;
    btnAction.className = "btn-primary";
    btnAction.innerText = "START GAME";
    btnAction.onclick = startMinesGame;
  }
}

// Auto-initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => renderMinesBoard(true));
} else {
  renderMinesBoard(true);
}
