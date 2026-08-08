// ============================================================
// POLYGAME: ROSHAMBO (ROCK-PAPER-SCISSORS) CASINO GAME
// Dedicated module for managing Roshambo bets, rounds, and logs
// ============================================================

import { supabase } from '../core/config.js';
import { sfx } from '../core/audio.js';
import { appState } from '../core/state.js';
import { triggerToast } from '../core/ui.js';
import { recordGameMetrics, logBetWin } from '../core/db-sync.js';

export function setRoshamboWager(type) {
  const input = document.getElementById('roshambo-bet-input');
  if (!input) return;

  const maxBal = appState.state ? appState.state.balancePgt : 0;
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
  if (label && appState.state) {
    label.innerText = `${parseFloat(appState.state.balancePgt || 0).toFixed(2)} PGT`;
  }
}

export let roshamboIsPlaying = false;

export async function playRoshamboRound(playerChoice) {
  if (roshamboIsPlaying) return;

  const input = document.getElementById('roshambo-bet-input');
  const ann = document.getElementById('roshambo-announcement');
  const playerDisp = document.getElementById('roshambo-player-display');
  const cpuDisp = document.getElementById('roshambo-cpu-display');

  if (!input || !ann || !playerDisp || !cpuDisp) return;

  const bet = Math.floor(parseFloat(input.value)) || 0;
  const balance = appState.state.balancePgt;

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

    // Reset displays
    playerDisp.innerHTML = getRoshamboSvg(playerChoice);
    cpuDisp.innerHTML = getRoshamboSvg('rock');

    // Deduct bet immediately locally
    appState.update({
      balancePgt: balance - bet
    });
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

    const canonicalUser = (appState.getPlayerId() || appState.state.playerId || appState.state.linkedWalletAddress || appState.state.walletAddress || '').toLowerCase();

    let serverResult = null;
    let rpcFailed = false;

    if (supabase && canonicalUser) {
      const res = await supabase.rpc('play_roshambo', {
        p_wallet: canonicalUser,
        p_bet: bet,
        p_choice: playerChoice
      });
      if (res.error) {
        console.error("RPC Error:", res.error);
        rpcFailed = true;
      } else {
        serverResult = Array.isArray(res.data) ? res.data[0] : res.data;
      }
    } else {
      rpcFailed = true;
    }

    setTimeout(() => {
      roshamboIsPlaying = false;

      if (rpcFailed || !serverResult || serverResult.error) {
        triggerToast(serverResult?.error || "Server validation failed!", "error");
        ann.innerText = "ERROR - TRY AGAIN";
        ann.style.color = 'var(--color-danger)';
        appState.update({ balancePgt: appState.state.balancePgt + bet });
        updateRoshamboWagerLabels();
        return;
      }

      const cpuChoice = serverResult.cpu_choice;
      const result = serverResult.result; // 'win', 'lose', 'tie'
      const payout = parseFloat(serverResult.payout || 0);

      cpuDisp.innerHTML = getRoshamboSvg(cpuChoice);

      appState.update({
        balancePgt: appState.state.balancePgt + payout
      });
      updateRoshamboWagerLabels();

      recordGameMetrics('Roshambo', bet, payout);
      if (window.trackQuestProgress) window.trackQuestProgress('games', 1);

      if (result === 'win') {
        if (sfx && typeof sfx.playSuccess === 'function') sfx.playSuccess();
        ann.innerText = `🎉 YOU WIN! Payout +${payout} PGT!`;
        ann.style.color = "var(--color-accent)";
        appState.addActivity('You', `won Roshambo round (2.0x)`, `+${payout} PGT`);
        if (window.trackQuestProgress) window.trackQuestProgress('wins', 1);
        logBetWin('Roshambo', bet, payout, 2.0);
      } else if (result === 'tie') {
        if (sfx && typeof sfx.playCoin === 'function') sfx.playCoin();
        ann.innerText = `🤝 TIE! Bet returned (+${payout} PGT).`;
        ann.style.color = "var(--color-warning)";
        appState.addActivity('You', `tied Roshambo round`, `+0 PGT`);
      } else {
        if (sfx && typeof sfx.playError === 'function') sfx.playError();
        ann.innerText = `❌ CPU WINS! Lost ${bet} PGT.`;
        ann.style.color = "var(--color-danger)";
        appState.addActivity('You', `lost Roshambo round`, `-${bet} PGT`);
      }

      addRoshamboLog(result, playerChoice, cpuChoice, bet, payout);
    }, 1400);

  } catch (err) {
    console.error("Fatal Roshambo error:", err);
    roshamboIsPlaying = false;
    triggerToast("Game error occurred!", "error");
    appState.update({ balancePgt: appState.state.balancePgt + bet });
    updateRoshamboWagerLabels();
  }
}

function getRoshamboSvg(choice) {
  if (choice === 'rock') {
    return `<svg viewBox="0 0 100 100" style="width: 60px; height: 60px;"><circle cx="50" cy="50" r="35" fill="none" stroke="var(--color-primary)" stroke-width="6"/><rect x="35" y="35" width="30" height="30" rx="8" fill="var(--color-primary)" /></svg>`;
  } else if (choice === 'paper') {
    return `<svg viewBox="0 0 100 100" style="width: 60px; height: 60px;"><rect x="25" y="20" width="50" height="60" rx="6" fill="none" stroke="var(--color-accent)" stroke-width="6"/><line x1="35" y1="35" x2="65" y2="35" stroke="var(--color-accent)" stroke-width="4"/><line x1="35" y1="50" x2="65" y2="50" stroke="var(--color-accent)" stroke-width="4"/><line x1="35" y1="65" x2="55" y2="65" stroke="var(--color-accent)" stroke-width="4"/></svg>`;
  } else {
    return `<svg viewBox="0 0 100 100" style="width: 60px; height: 60px;"><circle cx="35" cy="70" r="12" fill="none" stroke="var(--color-warning)" stroke-width="5"/><circle cx="65" cy="70" r="12" fill="none" stroke="var(--color-warning)" stroke-width="5"/><line x1="42" y1="62" x2="70" y2="25" stroke="var(--color-warning)" stroke-width="6"/><line x1="58" y1="62" x2="30" y2="25" stroke="var(--color-warning)" stroke-width="6"/></svg>`;
  }
}

export function addRoshamboLog(result, player, cpu, bet, payout) {
  const feed = document.getElementById('roshambo-history-feed');
  if (!feed) return;

  const item = document.createElement('div');
  item.style.cssText = "display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); border-radius: 6px; padding: 0.4rem 0.8rem; font-size: 0.82rem;";
  
  const icon = result === 'win' ? '🎉' : (result === 'tie' ? '🤝' : '❌');
  const color = result === 'win' ? 'var(--color-accent)' : (result === 'tie' ? 'var(--color-warning)' : 'var(--color-danger)');

  item.innerHTML = `
    <span>${icon} You (${player}) vs CPU (${cpu})</span>
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
