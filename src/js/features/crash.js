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

export function cashOutCrash() {
  if (!crashIsPlaying || hasCashedOut) return;
  hasCashedOut = true;
  
  let payout = Math.floor(crashBet * currentMultiplier);
  if (appState.isVipActive() && payout > crashBet) {
    payout = crashBet + ((payout - crashBet) * 2);
  }
  
  appState.update({ balancePgt: appState.state.balancePgt + payout });
  updateCrashWagerLabels();
  
  recordGameMetrics('Cyber-Crash', crashBet, payout);
  logBetWin('CyberCrash', payout, currentMultiplier);
  
  sfx.playSuccess();
  document.getElementById('crash-status-display').innerText = `CASHED OUT AT ${currentMultiplier.toFixed(2)}x (+${payout} PGT)`;
  document.getElementById('crash-status-display').style.color = 'var(--color-accent)';
  document.getElementById('btn-crash-cashout').disabled = true;
  appState.addActivity('You', `cashed out Cyber-Crash at ${currentMultiplier.toFixed(2)}x`, `+${payout} PGT`);
}
window.cashOutCrash = cashOutCrash;

export async function startCrashGame() {
  if (crashIsPlaying) return;
  
  try {
    const input = document.getElementById('crash-bet-input');
    if (!input) return;
    
    crashBet = Math.floor(parseFloat(input.value)) || 0;
    const balance = appState.state.balancePgt;
    
    if (crashBet < 10) {
      triggerToast("Minimum wager is 10 PGT!", "error");
      return;
    }
    if (crashBet > balance) {
      triggerToast("Insufficient PGT!", "error");
      return;
    }
    
    crashIsPlaying = true;
    hasCashedOut = false;
    crashTime = 0;
    currentMultiplier = 1.00;
    
    // Deduct bet
    appState.update({ balancePgt: balance - crashBet });
    updateCrashWagerLabels();
    
    // Increment jackpot
    if (supabase) {
      supabase.rpc('increment_jackpot', { p_amount: crashBet * 0.01 }).then(res => {
        if (res.error) console.error(res.error);
      });
    }

    // 95% RTP math: crash = 0.95 / random(0,1). 
    // If random < 0.95, it goes above 1.0x. If random > 0.95, it crashes instantly.
    let r = Math.random();
    if (r === 0) r = 0.0001; // prevent infinity
    crashPoint = 0.95 / r;
    
    const dispMulti = document.getElementById('crash-multiplier-display');
    const dispStatus = document.getElementById('crash-status-display');
    const btnCashout = document.getElementById('btn-crash-cashout');
    const btnStart = document.getElementById('btn-crash-start');
    
    dispMulti.style.color = '#fff';
    dispStatus.innerText = 'RISING...';
    dispStatus.style.color = '#fff';
    btnCashout.disabled = false;
    btnStart.disabled = true;

    if (crashPoint < 1.00) {
      // Instant crash
      finishCrash();
      return;
    }

    let lastTime = performance.now();
    
    function loop(time) {
      if (!crashIsPlaying) return;
      
      const dt = (time - lastTime) / 1000; // seconds
      lastTime = time;
      
      crashTime += dt * 10; // arbitrary speed factor
      currentMultiplier = Math.pow(Math.E, 0.03 * crashTime); // slower exponent
      
      if (currentMultiplier >= crashPoint) {
        currentMultiplier = crashPoint; // set exact
        finishCrash();
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

function finishCrash() {
  crashIsPlaying = false;
  
  const dispMulti = document.getElementById('crash-multiplier-display');
  const dispStatus = document.getElementById('crash-status-display');
  const btnCashout = document.getElementById('btn-crash-cashout');
  const btnStart = document.getElementById('btn-crash-start');
  
  dispMulti.innerText = currentMultiplier.toFixed(2) + 'x';
  dispMulti.style.color = '#ff3366';
  btnCashout.disabled = true;
  
  drawCrashCanvas(true);
  sfx.playError();
  
  if (!hasCashedOut) {
    dispStatus.innerText = `CRASHED AT ${currentMultiplier.toFixed(2)}x`;
    dispStatus.style.color = '#ff3366';
    appState.addActivity('You', `crashed in Cyber-Crash at ${currentMultiplier.toFixed(2)}x`, `-${crashBet} PGT`);
    recordGameMetrics('Cyber-Crash', crashBet, 0);
  }
  
  setTimeout(() => {
    btnStart.disabled = false;
    btnStart.innerText = 'PLACE BET';
  }, 1000);
}

// Hook up start button
const btnStart = document.getElementById('btn-crash-start');
if (btnStart) {
  btnStart.addEventListener('click', startCrashGame);
}
const btnCashout = document.getElementById('btn-crash-cashout');
if (btnCashout) {
  btnCashout.addEventListener('click', cashOutCrash);
}
