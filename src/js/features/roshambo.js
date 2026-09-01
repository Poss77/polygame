// ============================================================
// POLYGAME: ROSHAMBO (ROCK-PAPER-SCISSORS) CASINO GAME
// Dedicated module for managing Roshambo bets, rounds, and logs
// ============================================================

import { supabase } from '../core/config.js';
import { sfx } from '../core/audio.js';
import { appState } from '../core/state.js';
import { triggerToast } from '../core/ui.js';
import { recordGameMetrics, logBetWin } from '../core/db-sync.js';

function getActiveState() {
  if (appState && appState.state) return appState.state;
  if (typeof window !== 'undefined' && window.appState && window.appState.state) return window.appState.state;
  return null;
}

export function setRoshamboWager(type) {
  const input = document.getElementById('roshambo-bet-input');
  if (!input) return;

  const st = getActiveState();
  const maxBal = st ? st.balancePgt : 0;
  let val = Math.floor(parseFloat(input.value)) || 10;

  if (type === 'min') {
    val = 10;
  } else if (type === 'half') {
    val = Math.floor(val / 2);
  } else if (type === 'double') {
    val = val * 2;
  } else if (type === 'max') {
    val = Math.floor(maxBal);
  }

  if (val < 10) val = 10;
  if (val > maxBal) val = Math.floor(maxBal);

  input.value = val;
}

export function updateRoshamboWagerLabels() {
  const label = document.getElementById('roshambo-wallet-balance-label');
  const st = getActiveState();
  if (label && st) {
    label.innerText = `${parseFloat(st.balancePgt || 0).toFixed(2)} PGT`;
  }
}

export let roshamboIsPlaying = false;

function getRoshamboIcon(choice) {
  if (choice === 'rock') return '✊';
  if (choice === 'paper') return '🖐️';
  if (choice === 'scissors') return '✌️';
  return '❓';
}

export async function playRoshamboRound(playerChoice) {
  if (roshamboIsPlaying) return;

  const input = document.getElementById('roshambo-bet-input');
  const ann = document.getElementById('roshambo-announcement');
  const playerDisp = document.getElementById('roshambo-hand-player') || document.getElementById('roshambo-player-display');
  const cpuDisp = document.getElementById('roshambo-hand-cpu') || document.getElementById('roshambo-cpu-display');

  if (!input || !ann || !playerDisp || !cpuDisp) {
    console.error("[Roshambo] Missing DOM element:", { input: !!input, ann: !!ann, playerDisp: !!playerDisp, cpuDisp: !!cpuDisp });
    return;
  }

  const bet = Math.floor(parseFloat(input.value)) || 0;
  const st = getActiveState();
  const balance = st ? st.balancePgt : 0;

  if (bet < 10) {
    triggerToast("Minimum wager is 10 PGT!", "error");
    return;
  }
  if (bet > balance) {
    triggerToast("Insufficient PGT token balance!", "error");
    return;
  }

  roshamboIsPlaying = true;

  try {
    if (sfx && typeof sfx.init === 'function') sfx.init();

    // Set player choice icon & reset CPU to mystery
    playerDisp.innerText = getRoshamboIcon(playerChoice);
    cpuDisp.innerText = '❓';

    // Deduct bet immediately locally
    if (appState && st) {
      appState.update({
        balancePgt: st.balancePgt - bet
      });
    }
    updateRoshamboWagerLabels();

    // Process jackpot win chance (1% jackpot contribution)
    if (window.processBetJackpot) {
      window.processBetJackpot(bet, 'Roshambo');
    }

    ann.innerText = "✊ ROCK... ✋ PAPER... ✌️ SCISSORS...";
    ann.style.color = "var(--color-primary)";

    // Play countdown audio & animation
    let countdown = 0;
    const countdownInterval = setInterval(() => {
      countdown++;
      if (sfx && typeof sfx.playRoshamboDrum === 'function') sfx.playRoshamboDrum();
      if (countdown >= 3) {
        clearInterval(countdownInterval);
      }
    }, 400);

    const canonicalUser = ((appState && typeof appState.getPlayerId === 'function' ? appState.getPlayerId() : null) || st?.playerId || st?.linkedWalletAddress || st?.walletAddress || '').toLowerCase();

    let serverResult = null;
    let rpcFailed = false;
    let rpcErrMsg = null;

    if (supabase && canonicalUser) {
      const res = await supabase.rpc('play_roshambo', {
        p_wallet: canonicalUser,
        p_bet: bet,
        p_choice: playerChoice
      });
      if (res.error) {
        console.error("RPC Error:", res.error);
        rpcErrMsg = res.error.message || res.error.details || "Database RPC call failed";
        rpcFailed = true;
      } else {
        serverResult = Array.isArray(res.data) ? res.data[0] : res.data;
      }
    } else {
      rpcFailed = true;
      rpcErrMsg = !canonicalUser ? "Please connect your wallet first!" : "Supabase connection unavailable";
    }

    setTimeout(() => {
      roshamboIsPlaying = false;
      const currentSt = getActiveState();

      if (rpcFailed || !serverResult || serverResult.error || serverResult.success === false) {
        const errDetail = serverResult?.error || rpcErrMsg || "Server validation failed!";
        triggerToast(errDetail, "error");
        ann.innerText = "ERROR - TRY AGAIN";
        ann.style.color = 'var(--color-danger)';
        if (appState && currentSt) appState.update({ balancePgt: currentSt.balancePgt + bet });
        updateRoshamboWagerLabels();
        return;
      }

      const cpuChoice = serverResult.cpu_choice;
      const rawResult = (serverResult.result || serverResult.outcome || 'lose').toLowerCase();
      const result = (rawResult === 'draw' || rawResult === 'tie') ? 'tie' : rawResult;
      const payout = parseFloat(serverResult.payout || 0);
      const mult = parseFloat(serverResult.multiplier || (result === 'win' ? 2.0 : (result === 'tie' ? 1.0 : 0)));

      cpuDisp.innerText = getRoshamboIcon(cpuChoice);

      if (appState && currentSt) {
        appState.update({
          balancePgt: currentSt.balancePgt + payout
        });
      }
      updateRoshamboWagerLabels();

      if (serverResult.jackpot_amount) {
        const counterEl = document.getElementById('progressive-jackpot-counter');
        if (counterEl) counterEl.innerText = `${parseFloat(serverResult.jackpot_amount).toFixed(2)} PGT`;
      }
      if (window.handleServerJackpotWin) window.handleServerJackpotWin(serverResult, 'Roshambo');

      recordGameMetrics('Roshambo', bet, payout);

      if (result === 'win') {
        if (sfx && typeof sfx.playSuccess === 'function') sfx.playSuccess();
        ann.innerText = `🎉 YOU WIN! Payout +${payout} PGT (2.0x)!`;
        ann.style.color = "var(--color-accent)";
        if (appState) appState.addActivity('You', `won Roshambo round (2.0x)`, `+${payout} PGT`);
        if (window.trackQuestProgress) window.trackQuestProgress('wins', 1);
        logBetWin('Roshambo', bet, payout, 2.0);
      } else if (result === 'tie') {
        if (sfx && typeof sfx.playCoin === 'function') sfx.playCoin();
        ann.innerText = `🤝 TIE! Bet returned (+${payout} PGT).`;
        ann.style.color = "var(--color-warning)";
        if (appState) appState.addActivity('You', `tied Roshambo round`, `+0 PGT`);
      } else {
        if (sfx && typeof sfx.playError === 'function') sfx.playError();
        ann.innerText = `❌ CPU WINS! Lost ${bet} PGT.`;
        ann.style.color = "var(--color-danger)";
        if (appState) appState.addActivity('You', `lost Roshambo round`, `-${bet} PGT`);
      }

      addRoshamboLog(result, playerChoice, cpuChoice, bet, payout);
    }, 1400);

  } catch (err) {
    console.error("Fatal Roshambo error:", err);
    roshamboIsPlaying = false;
    triggerToast("Game error occurred!", "error");
    const errSt = getActiveState();
    if (appState && errSt) appState.update({ balancePgt: errSt.balancePgt + bet });
    updateRoshamboWagerLabels();
  }
}

export function addRoshamboLog(result, player, cpu, bet, payout) {
  const feed = document.getElementById('roshambo-history-feed');
  if (!feed) return;

  const item = document.createElement('div');
  item.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); border-radius: 6px; padding: 0.4rem 0.8rem; font-size: 0.82rem;";
  
  const icon = result === 'win' ? '🎉' : (result === 'tie' ? '🤝' : '❌');
  const color = result === 'win' ? 'var(--color-accent)' : (result === 'tie' ? 'var(--color-warning)' : 'var(--color-danger)');

  const playerIcon = getRoshamboIcon(player);
  const cpuIcon = getRoshamboIcon(cpu);

  item.innerHTML = `
    <span>${icon} You (${playerIcon}) vs CPU (${cpuIcon})</span>
    <strong style="color: ${color};">${result === 'win' ? `+${payout} PGT` : (result === 'tie' ? '0 PGT' : `-${bet} PGT`)}</strong>
  `;

  feed.insertBefore(item, feed.firstChild);
  if (feed.children.length > 5) {
    feed.lastChild.remove();
  }
}

if (typeof window !== 'undefined') {
  window.setRoshamboWager = setRoshamboWager;
  window.updateRoshamboWagerLabels = updateRoshamboWagerLabels;
  window.playRoshamboRound = playRoshamboRound;
}
