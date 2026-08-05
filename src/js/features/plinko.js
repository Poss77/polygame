import { appState } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { supabase } from '../core/config.js';
import { triggerToast } from '../core/ui.js';
import { recordGameMetrics, logBetWin } from '../core/db-sync.js';

let plinkoIsPlaying = false;
let plinkoBet = 0;
let ballPos = null;
let ballTrail = [];
let activeSlotIndex = null;
let plinkoReqId = null;
let idlePulseAngle = 0;

const MULTIPLIERS = [26.6, 4.0, 1.2, 0.4, 0.2, 0.4, 1.2, 4.0, 26.6];

const canvas = document.getElementById('plinko-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

export function updatePlinkoWagerLabels() {
  const label = document.getElementById('plinko-wallet-balance-label');
  if (label) {
    label.innerText = `${parseFloat(appState.state.balancePgt || 0).toFixed(2)} PGT`;
  }
}
window.updatePlinkoWagerLabels = updatePlinkoWagerLabels;

export function setPlinkoWager(type) {
  const input = document.getElementById('plinko-bet-input');
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
window.setPlinkoWager = setPlinkoWager;

function drawRoundedRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle, strokeWidth = 1) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

function drawPlinkoCanvas() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const rows = 8;
  const colSpacing = 40;
  const rowSpacing = 35;
  const startY = 40;
  const centerX = canvas.width / 2;

  // 1. Draw pegs with vibrant neon cyan glow
  for (let r = 0; r < rows; r++) {
    const numPegs = r + 1;
    const startX = centerX - (numPegs - 1) * colSpacing / 2;
    for (let c = 0; c < numPegs; c++) {
      const x = startX + c * colSpacing;
      const y = startY + r * rowSpacing;
      
      // Outer glow
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00f0ff';
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      
      // Specular core dot
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x - 1, y - 1, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2. Draw high-contrast, crystal-clear multiplier buckets (slots)
  const slotsY = startY + rows * rowSpacing + 28;
  const numSlots = 9;
  const slotsStartX = centerX - (numSlots - 1) * colSpacing / 2;
  const slotW = 38;
  const slotH = 30;
  
  for (let i = 0; i < numSlots; i++) {
    const x = slotsStartX + i * colSpacing;
    const m = MULTIPLIERS[i];
    const isWinner = (activeSlotIndex === i);
    
    let bgGradient, borderColor, textColor, glowColor;
    
    if (m >= 10) {
      bgGradient = isWinner ? '#ff00ff' : 'rgba(255, 0, 255, 0.35)';
      borderColor = isWinner ? '#ffffff' : '#ffd700';
      textColor = '#ffffff';
      glowColor = '#ff00ff';
    } else if (m > 1) {
      bgGradient = isWinner ? '#00f0ff' : 'rgba(0, 240, 255, 0.22)';
      borderColor = isWinner ? '#ffffff' : '#00f0ff';
      textColor = isWinner ? '#000000' : '#ffffff';
      glowColor = '#00f0ff';
    } else {
      bgGradient = isWinner ? '#ff3366' : 'rgba(255, 51, 102, 0.2)';
      borderColor = isWinner ? '#ffffff' : '#ff3366';
      textColor = '#ffffff';
      glowColor = '#ff3366';
    }

    ctx.save();
    ctx.shadowBlur = isWinner ? 20 : 10;
    ctx.shadowColor = glowColor;

    // Draw slot pill box
    drawRoundedRect(ctx, x - slotW / 2, slotsY - slotH / 2, slotW, slotH, 6, bgGradient, borderColor, isWinner ? 2.5 : 1.5);
    ctx.restore();

    // Multiplier text formatting
    ctx.save();
    ctx.font = 'bold 13px "Outfit", "Segoe UI", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Text drop-shadow outline for 100% legibility
    ctx.fillStyle = '#000000';
    ctx.fillText(m + 'x', x + 1, slotsY + 1);

    ctx.fillStyle = textColor;
    ctx.fillText(m + 'x', x, slotsY);
    ctx.restore();
  }

  // 3. Draw Motion Trail when ball is dropping
  if (ballTrail.length > 0) {
    for (let i = 0; i < ballTrail.length; i++) {
      const pos = ballTrail[i];
      const alpha = ((i + 1) / ballTrail.length) * 0.45;
      const radius = 5 + ((i + 1) / ballTrail.length) * 5;
      ctx.save();
      ctx.fillStyle = `rgba(255, 0, 255, ${alpha})`;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff00ff';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // 4. Draw Neon Ball (or Idle Preview Ball)
  const drawX = ballPos ? ballPos.x : centerX;
  const drawY = ballPos ? ballPos.y : (startY - 20);

  ctx.save();
  
  // Pulsing glow for idle or bright glow for active
  idlePulseAngle += 0.05;
  const pulseGlow = !ballPos ? 12 + Math.sin(idlePulseAngle) * 5 : 22;

  ctx.shadowBlur = pulseGlow;
  ctx.shadowColor = '#ff00ff';

  const r = 11; // 22px diameter neon orb
  const grad = ctx.createRadialGradient(drawX - 3, drawY - 3, 1, drawX, drawY, r);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.3, '#ff66ff');
  grad.addColorStop(0.75, '#ff00ff');
  grad.addColorStop(1, '#9900ff');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(drawX, drawY, r, 0, Math.PI * 2);
  ctx.fill();

  // Outer neon ring
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(drawX, drawY, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// Continuous render loop for smooth graphics
function renderPlinkoLoop() {
  drawPlinkoCanvas();
  requestAnimationFrame(renderPlinkoLoop);
}
requestAnimationFrame(renderPlinkoLoop);

export async function dropPlinkoBall() {
  if (window.trackQuestProgress) window.trackQuestProgress('games', 1);
  if (plinkoIsPlaying) return;
  
  const input = document.getElementById('plinko-bet-input');
  if (!input) return;
  
  plinkoBet = Math.floor(parseFloat(input.value)) || 0;
  const balance = appState.state.balancePgt || 0;
  
  if (plinkoBet < 10) {
    triggerToast("Minimum wager is 10 PGT!", "error");
    return;
  }
  if (plinkoBet > balance) {
    triggerToast("Insufficient PGT!", "error");
    return;
  }
  
  plinkoIsPlaying = true;
  activeSlotIndex = null;
  ballTrail = [];
  const btnDrop = document.getElementById('btn-plinko-drop');
  if (btnDrop) btnDrop.disabled = true;
  
  // Deduct bet locally
  appState.update({ balancePgt: balance - plinkoBet });
  updatePlinkoWagerLabels();
  if (window.processBetJackpot) {
    window.processBetJackpot(plinkoBet, 'Neon Plinko');
  }
  
  let serverResult = null;
  let rpcFailed = false;
  
  const targetWallet = (appState.state.walletAddress || appState.state.linkedWalletAddress || appState.getPlayerId() || '').toLowerCase();

  try {
    if (supabase && targetWallet) {
      const res = await supabase.rpc('play_plinko', {
        p_wallet: targetWallet,
        p_bet: plinkoBet
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
  } catch (err) {
    console.error("Plinko execution exception:", err);
    rpcFailed = true;
  }

  if (rpcFailed || !serverResult || serverResult.error) {
    triggerToast(serverResult?.error || "Server validation failed!", "error");
    plinkoIsPlaying = false;
    if (btnDrop) btnDrop.disabled = false;
    // Refund wager locally
    appState.update({ balancePgt: appState.state.balancePgt + plinkoBet });
    updatePlinkoWagerLabels();
    return;
  }

  // Pre-calculate visual path to match server outcome
  const rows = 8;
  const path = [];
  const targetSlot = serverResult.bucket;
  
  // Fill array with 1s (rights) and 0s (lefts) to reach exactly targetSlot
  for (let i = 0; i < targetSlot; i++) path.push(1);
  for (let i = 0; i < rows - targetSlot; i++) path.push(0);
  
  // Shuffle path so visual drop is randomized but lands in correct bucket
  for (let i = path.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [path[i], path[j]] = [path[j], path[i]];
  }

  const colSpacing = 40;
  const rowSpacing = 35;
  const startY = 40;
  const centerX = canvas.width / 2;
  
  // Start position
  ballPos = { x: centerX, y: startY - 20 };
  ballTrail = [];
  
  let currentRow = 0;
  let t = 0; // 0.0 to 1.0 for interpolating between rows
  let lastTime = performance.now();
  
  function animLoop(time) {
    const dt = (time - lastTime) / 1000;
    lastTime = time;
    
    t += dt * 3.8; // ball speed
    
    if (t >= 1.0) {
      t = 0;
      currentRow++;
      sfx.playRoshamboDrum(); // ping sound
    }
    
    if (currentRow >= rows) {
      // Landed in bucket
      activeSlotIndex = targetSlot;
      const m = serverResult.multiplier;
      const payout = serverResult.payout;
      
      appState.update({ balancePgt: appState.state.balancePgt + payout });
      
      recordGameMetrics('Neon Plinko', plinkoBet, payout);
      if (payout > 0) {
        logBetWin('Neon Plinko', plinkoBet, payout, m);
      }
      
      updatePlinkoWagerLabels();
      
      if (m >= 1.0) {
        sfx.playSuccess();
        triggerToast(`Plinko: Won ${payout} PGT! (${m}x)`, "success");
        appState.addActivity('You', `won Neon Plinko (${m}x)`, `+${payout} PGT`);
      } else {
        sfx.playError();
        triggerToast(`Plinko: Returned ${payout} PGT (${m}x)`, "warning");
        appState.addActivity('You', `played Neon Plinko (${m}x)`, `-${plinkoBet - payout} PGT`);
      }
      
      // Keep ball resting inside slot for 1.2s before resetting
      setTimeout(() => {
        ballPos = null;
        ballTrail = [];
        plinkoIsPlaying = false;
        if (btnDrop) btnDrop.disabled = false;
      }, 1200);

      return;
    }
    
    // Interpolate x and y
    const numPegsStart = currentRow + 1;
    const startXGrid = centerX - (numPegsStart - 1) * colSpacing / 2;
    
    let slotSoFar = 0;
    for(let i=0; i<currentRow; i++) slotSoFar += path[i];
    
    let nextSlotSoFar = slotSoFar + path[currentRow];
    
    const startX = startXGrid + slotSoFar * colSpacing;
    const numPegsEnd = currentRow + 2;
    const endXGrid = centerX - (numPegsEnd - 1) * colSpacing / 2;
    const endX = endXGrid + nextSlotSoFar * colSpacing;
    
    const startYPos = startY + currentRow * rowSpacing;
    const endYPos = startY + (currentRow + 1) * rowSpacing;
    
    // Arc logic (bounce up slightly between pegs)
    const arcHeight = 16;
    const yOffset = -Math.sin(t * Math.PI) * arcHeight;
    
    ballPos.x = startX + (endX - startX) * t;
    ballPos.y = startYPos + (endYPos - startYPos) * t + yOffset;

    // Track motion trail (max 5 frames)
    ballTrail.push({ x: ballPos.x, y: ballPos.y });
    if (ballTrail.length > 5) ballTrail.shift();
    
    plinkoReqId = requestAnimationFrame(animLoop);
  }
  
  plinkoReqId = requestAnimationFrame(animLoop);
}

// Hook up button
const btnDrop = document.getElementById('btn-plinko-drop');
if (btnDrop) {
  btnDrop.addEventListener('click', dropPlinkoBall);
}
window.dropPlinkoBall = dropPlinkoBall;
