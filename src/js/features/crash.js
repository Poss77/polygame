import { appState } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { supabase } from '../core/config.js';
import { triggerToast } from '../core/ui.js';
import { recordGameMetrics, logBetWin } from '../core/db-sync.js';

let crashIsPlaying = false;
let currentMultiplier = 1.00;
let crashPoint = 1.00;
let crashBet = 0;
let crashTime = 0;
let crashReqId = null;
let hasCashedOut = false;

const canvas = document.getElementById('crash-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

export function updateCrashWagerLabels() {
  const label = document.getElementById('crash-wallet-balance-label');
  if (label) {
    label.innerText = `${appState.state.balancePgt.toFixed(2)} PGT`;
  }
}
window.updateCrashWagerLabels = updateCrashWagerLabels;

export function setCrashWager(type) {
  const input = document.getElementById('crash-bet-input');
  if (!input) return;
  const bal = appState.state.balancePgt;
  let val = parseInt(input.value) || 0;
  
  if (type === 'min') val = 10;
  else if (type === 'half') val = Math.floor(val / 2);
  else if (type === 'double') val = val * 2;
  else if (type === 'max') val = Math.floor(bal);
  
  if (val < 10) val = 10;
  if (val > bal) val = Math.floor(bal);
  
  input.value = val;
}
window.setCrashWager = setCrashWager;

function drawCrashCanvas(crashed) {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw grid
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < canvas.width; i += 40) {
    ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height);
  }
  for (let i = 0; i < canvas.height; i += 40) {
    ctx.moveTo(0, i); ctx.lineTo(canvas.width, i);
  }
  ctx.stroke();

  // Draw curve
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  const color = crashed ? '#ff3366' : '#00f0ff';
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  
  // Create shadow/glow
  ctx.shadowBlur = 15;
  ctx.shadowColor = color;

  const points = [];
  for (let t = 0; t <= crashTime; t += 0.5) {
    const x = (t / Math.max(10, crashTime)) * canvas.width;
    const m = Math.pow(Math.E, 0.05 * t);
    const y = canvas.height - (Math.min(m, 100) / Math.max(currentMultiplier, 2)) * canvas.height;
    points.push({x, y});
  }

  if (points.length > 0) {
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }

  // Draw end point
  if (points.length > 0) {
    const last = points[points.length - 1];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.shadowBlur = 0;
}

// cashOutCrash has been removed, handled via RPC now

export async function startCrashGame() {
  if (crashIsPlaying) return;
  
  try {
    const input = document.getElementById('crash-bet-input');
    const targetInput = document.getElementById('crash-target-input');
    if (!input || !targetInput) return;
    
    crashBet = Math.floor(parseFloat(input.value)) || 0;
    const targetMultiplier = parseFloat(targetInput.value) || 2.0;
    const balance = appState.state.balancePgt;
    
    if (crashBet < 10) {
      triggerToast("Minimum wager is 10 PGT!", "error");
      return;
    }
    if (crashBet > balance) {
      triggerToast("Insufficient PGT!", "error");
      return;
    }
    if (targetMultiplier < 1.01) {
      triggerToast("Target must be at least 1.01x!", "error");
      return;
    }
    
    // Call RPC
    let serverResult = null;
    if (supabase) {
      const res = await supabase.rpc('play_crash', {
        p_wallet: appState.state.walletAddress,
        p_bet: crashBet,
        p_target: targetMultiplier
      });
      if (res.error) {
        console.error("RPC Error:", res.error);
        triggerToast("Server validation failed!", "error");
        return;
      }
      serverResult = res.data;
    } else {
      triggerToast("Server offline!", "error");
      return;
    }
    
    crashIsPlaying = true;
    hasCashedOut = false; // We use this flag to only show the success toast once
    crashTime = 0;
    currentMultiplier = 1.00;
    
    // Deduct bet immediately locally (the DB already did it)
    appState.update({ balancePgt: balance - crashBet });
    updateCrashWagerLabels();
    
    // Increment jackpot
    if (supabase) {
      supabase.rpc('increment_jackpot', { p_amount: crashBet * 0.01 }).then(res => {
        if (res.error) console.error(res.error);
      });
    }

    crashPoint = serverResult.crashPoint;
    const payout = serverResult.payout;
    
    const dispMulti = document.getElementById('crash-multiplier-display');
    const dispStatus = document.getElementById('crash-status-display');
    const btnStart = document.getElementById('btn-crash-start');
    
    dispMulti.style.color = '#fff';
    dispStatus.innerText = 'RISING...';
    dispStatus.style.color = '#fff';
    btnStart.disabled = true;

    if (crashPoint < 1.01) {
      // Instant crash
      finishCrash(payout);
      return;
    }

    let lastTime = performance.now();
    
    function loop(time) {
      if (!crashIsPlaying) return;
      
      const dt = (time - lastTime) / 1000; // seconds
      lastTime = time;
      
      crashTime += dt * 10; // arbitrary speed factor
      currentMultiplier = Math.pow(Math.E, 0.03 * crashTime); // slower exponent
      
      // Check if we hit the target
      if (!hasCashedOut && payout > 0 && currentMultiplier >= targetMultiplier) {
        hasCashedOut = true;
        sfx.playSuccess();
        dispStatus.innerText = `CASHED OUT AT ${targetMultiplier.toFixed(2)}x (+${payout} PGT)`;
        dispStatus.style.color = 'var(--color-success)';
      }
      
      // Check if we hit the crash point
      if (currentMultiplier >= crashPoint) {
        currentMultiplier = crashPoint; // set exact
        finishCrash(payout, targetMultiplier);
        return;
      }
      
      dispMulti.innerText = currentMultiplier.toFixed(2) + 'x';
      drawCrashCanvas(false);
      crashReqId = requestAnimationFrame(loop);
    }
    crashReqId = requestAnimationFrame(loop);
  } catch(e) {
    console.error(e);
    triggerToast("Error: " + e.message, "error");
    crashIsPlaying = false;
  }
}


window.startCrashGame = startCrashGame;

function finishCrash(payout, targetMultiplier) {
  crashIsPlaying = false;
  
  const dispMulti = document.getElementById('crash-multiplier-display');
  const dispStatus = document.getElementById('crash-status-display');
  const btnStart = document.getElementById('btn-crash-start');
  
  dispMulti.innerText = currentMultiplier.toFixed(2) + 'x';
  dispMulti.style.color = '#ff3366';
  
  drawCrashCanvas(true);
  
  if (payout > 0) {
    // Win scenario
    appState.update({ balancePgt: appState.state.balancePgt + payout });
    recordGameMetrics('Cyber-Crash', crashBet, payout);
    logBetWin('CyberCrash', crashBet, payout, targetMultiplier);
    appState.addActivity('You', `cashed out Cyber-Crash at ${targetMultiplier}x`, `+${payout} PGT`);
    updateCrashWagerLabels();
  } else {
    // Lose scenario
    sfx.playError();
    dispStatus.innerText = `CRASHED AT ${currentMultiplier.toFixed(2)}x`;
    dispStatus.style.color = '#ff3366';
    appState.addActivity('You', `crashed in Cyber-Crash at ${currentMultiplier.toFixed(2)}x`, `-${crashBet} PGT`);
    recordGameMetrics('Cyber-Crash', crashBet, 0);
  }
  
  setTimeout(() => {
    btnStart.disabled = false;
    btnStart.innerText = 'START LAUNCH';
  }, 1000);
}

// Hook up start button
const btnStart = document.getElementById('btn-crash-start');
if (btnStart) {
  btnStart.addEventListener('click', startCrashGame);
}
