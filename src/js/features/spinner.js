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
    val = Math.max(10, Math.floor(val / 2));
  } else if (type === 'double') {
    val = Math.min(5000, val * 2);
  } else if (type === 'max') {
    val = Math.min(5000, Math.floor(maxBal));
  }

  if (val < 10) val = 10;
  if (val > 5000) val = 5000;
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
  if (bet > 5000) {
    triggerToast("Maximum wager is 5,000 PGT!", "error");
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

    ann.innerText = "🌀 Spinning... Best of luck!";
    ann.style.color = "var(--color-primary)";

    const canonicalUser = ((appState && typeof appState.getPlayerId === 'function' ? appState.getPlayerId() : null) || appState?.state?.playerId || appState?.state?.linkedWalletAddress || appState?.state?.walletAddress || '').toLowerCase();

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
    
    // Strict 1-to-1 Mapping to 6-Segment SVG Wheel:
    // Segment 0: 0x   (Angle 0° - 60°)
    // Segment 1: 1.2x (Angle 60° - 120°)
    // Segment 2: 0.5x (Angle 120° - 180°)
    // Segment 3: 2.0x (Angle 180° - 240°)
    // Segment 4: 5.0x (Angle 240° - 300°)
    // Segment 5: 10x  (Angle 300° - 360°)
    let winIdx = 0;
    if (multiplier === 1.2) winIdx = 1;
    else if (multiplier === 0.5) winIdx = 2;
    else if (multiplier === 2.0) winIdx = 3;
    else if (multiplier === 5.0) winIdx = 4;
    else if (multiplier === 10.0) winIdx = 5;
    else if (multiplier === 0) winIdx = 0;
    else if (typeof serverResult.segment === 'number' && serverResult.segment >= 0 && serverResult.segment <= 5) {
      winIdx = serverResult.segment;
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
      if (window.handleServerJackpotWin) window.handleServerJackpotWin(serverResult, 'Lucky Spinner');

      recordGameMetrics('Lucky Spinner', bet, payout);
      if (multiplier > 1.0 && window.trackQuestProgress) {
        window.trackQuestProgress('wins', 1);
      }
      logBetWin('Lucky Spinner', bet, payout, multiplier);
      
      updateSpinnerWagerLabels();

      if (serverResult.jackpot_won) {
        if (multiplier > 1.0 && window.trackQuestProgress) {
          window.trackQuestProgress('wins', 1);
        }
        ann.innerText = `👑 GLOBAL JACKPOT HIT! +${parseFloat(serverResult.jackpot_payout).toFixed(2)} PGT!`;
        ann.style.color = "var(--color-accent)";
        if (multiplier > 0) {
          appState.addActivity('You', `won spinner bet (${multiplier}x)`, `+${payout} PGT`);
        }
      } else if (multiplier > 1.0) {
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
