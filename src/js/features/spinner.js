// ============================================================
// POLYGAME: LUCKY NEON SPINNER CASINO GAME
// Dedicated module for managing Lucky Spinner wagers and spin animations
// ============================================================

import { appState } from '../core/state.js';
import { triggerToast } from '../core/ui.js';
import { sfx } from '../core/audio.js';
import { supabase } from '../core/config.js';
import { recordGameMetrics, logBetWin } from '../core/db-sync.js';

export function setSpinnerWager(type) {
  const input = document.getElementById('spinner-bet-input');
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

export function updateSpinnerWagerLabels() {
  const label = document.getElementById('spinner-wallet-balance-label');
  if (label && appState.state) {
    label.innerText = `${parseFloat(appState.state.balancePgt || 0).toFixed(2)} PGT`;
  }
}

export let spinnerIsSpinning = false;
export let currentSpinnerRotation = 0;

export async function spinLuckyWheel() {
  if (spinnerIsSpinning) return;

  const input = document.getElementById('spinner-bet-input');
  const wheel = document.getElementById('wheel-svg');
  const ann = document.getElementById('spinner-announcement');
  if (!input || !wheel || !ann) return;

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

  spinnerIsSpinning = true;

  try {
    if (sfx && typeof sfx.init === 'function') sfx.init();

    // Deduct bet from balance immediately
    appState.update({
      balancePgt: balance - bet
    });
    updateSpinnerWagerLabels();

    // Increment global jackpot (1% of bet) & process jackpot win chance
    if (window.processBetJackpot) {
      window.processBetJackpot(bet, 'Lucky Spinner');
    }

    const canonicalUser = (appState.getPlayerId() || appState.state.playerId || appState.state.linkedWalletAddress || appState.state.walletAddress || '').toLowerCase();

    // 1 in 10,000 chance to hit the jackpot
    const isJackpot = Math.random() < 0.0001;
    
    if (isJackpot && supabase && canonicalUser) {
      ann.innerText = "🔥 PROGRESSIVE JACKPOT HIT!!! 🔥 Claiming...";
      ann.style.color = "var(--color-warning)";
      
      try {
        const { data: jackpotAmount, error } = await supabase.rpc('claim_jackpot', { p_wallet: canonicalUser });
        
        if (!error && jackpotAmount) {
          appState.update({
            balancePgt: appState.state.balancePgt + jackpotAmount
          });
          updateSpinnerWagerLabels();
          
          if (sfx && typeof sfx.playSuccess === 'function') sfx.playSuccess();
          ann.innerText = `🏆 MEGA WIN! You won the ${parseFloat(jackpotAmount).toFixed(2)} PGT Jackpot!`;
          ann.style.color = "var(--color-accent)";
          appState.addActivity('You', `won the global jackpot`, `+${parseFloat(jackpotAmount).toFixed(2)} PGT`);
          
          spinnerIsSpinning = false;
          return;
        }
      } catch (e) {
        console.error(e);
      }
    }

    ann.innerText = "🌀 Spinning... Best of luck!";
    ann.style.color = "var(--color-primary)";

    let serverResult = null;
    let rpcFailed = false;

    if (supabase && canonicalUser) {
      const res = await supabase.rpc('play_spinner', {
        p_wallet: canonicalUser,
        p_bet: bet
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

    if (rpcFailed || !serverResult || serverResult.error) {
      triggerToast(serverResult?.error || "Server validation failed!", "error");
      ann.innerText = "ERROR - TRY AGAIN";
      ann.style.color = 'var(--color-danger)';
      spinnerIsSpinning = false;
      appState.update({ balancePgt: appState.state.balancePgt + bet });
      updateSpinnerWagerLabels();
      return;
    }

    const multiplier = parseFloat(serverResult.multiplier || 0);
    const payout = parseFloat(serverResult.payout || 0);
    let winIdx = serverResult.segment;

    if (winIdx === undefined || winIdx === null) {
      if (multiplier === 0) winIdx = 0;
      else if (multiplier === 1.2) winIdx = 1;
      else if (multiplier === 0.5) winIdx = 2;
      else if (multiplier === 2.0 || multiplier === 2.5) winIdx = 3;
      else if (multiplier === 5.0 || multiplier === 3.0) winIdx = 4;
      else if (multiplier === 10.0 || multiplier === 1.5) winIdx = 5;
      else winIdx = 0;
    }

    const spins = 6;
    const targetAngle = 360 - (winIdx * 60 + 30);
    const currentOffset = currentSpinnerRotation % 360;
    currentSpinnerRotation = currentSpinnerRotation + (spins * 360) - currentOffset + targetAngle;

    wheel.style.transform = `rotate(${currentSpinnerRotation}deg)`;

    let tickCount = 0;
    const tickInterval = setInterval(() => {
      if (tickCount < 18) {
        if (sfx && typeof sfx.playRoshamboDrum === 'function') sfx.playRoshamboDrum();
        tickCount++;
      } else {
        clearInterval(tickInterval);
      }
    }, 200);

    setTimeout(() => {
      spinnerIsSpinning = false;
      
      appState.update({
        balancePgt: appState.state.balancePgt + payout
      });
      
      if (serverResult.jackpot_amount) {
        const counterEl = document.getElementById('progressive-jackpot-counter');
        if (counterEl) counterEl.innerText = `${parseFloat(serverResult.jackpot_amount).toFixed(2)} PGT`;
      }

      recordGameMetrics('Lucky Spinner', bet, payout);
      if (window.trackQuestProgress) window.trackQuestProgress('games', 1);
      if (payout > 0) {
        if (window.trackQuestProgress) window.trackQuestProgress('wins', 1);
        logBetWin('Lucky Spinner', bet, payout, multiplier);
      }
      
      updateSpinnerWagerLabels();

      if (multiplier > 1.0) {
        if (sfx && typeof sfx.playSuccess === 'function') sfx.playSuccess();
        ann.innerText = `🎉 WON! Segments aligned at ${multiplier}x multiplier. Payout +${payout} PGT!`;
        ann.style.color = "var(--color-accent)";
        appState.addActivity('You', `won spinner bet (${multiplier}x)`, `+${payout} PGT`);
      } else if (multiplier === 0.5) {
        if (sfx && typeof sfx.playCoin === 'function') sfx.playCoin();
        ann.innerText = `⚠️ Partial return! Returned 0.5x wager (+${payout} PGT).`;
        ann.style.color = "var(--color-warning)";
        appState.addActivity('You', `partially hit spinner bet (0.5x)`, `-${bet - payout} PGT`);
      } else {
        if (sfx && typeof sfx.playError === 'function') sfx.playError();
        ann.innerText = `❌ Segment missed! Landed on 0x. Better luck next time!`;
        ann.style.color = "var(--color-danger)";
        appState.addActivity('You', `lost spinner bet (0x)`, `-${bet} PGT`);
      }
    }, 4100);

  } catch (err) {
    console.error("Fatal Spinner error:", err);
    spinnerIsSpinning = false;
    triggerToast("Spinner error occurred!", "error");
    appState.update({ balancePgt: appState.state.balancePgt + bet });
    updateSpinnerWagerLabels();
  }
}

if (typeof window !== 'undefined') {
  window.spinLuckyWheel = spinLuckyWheel;
  window.setSpinnerWager = setSpinnerWager;
  window.updateSpinnerWagerLabels = updateSpinnerWagerLabels;

  const btn = document.getElementById('btn-spin-wheel');
  if (btn) {
    btn.addEventListener('click', spinLuckyWheel);
  }
}
