import { appState } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { supabase } from '../core/config.js';
import { triggerToast } from '../core/ui.js';
import { recordGameMetrics, logBetWin } from '../core/db-sync.js';

let plinkoIsPlaying = false;
let plinkoBet = 0;
let ballPos = null;
let plinkoReqId = null;

const MULTIPLIERS = [26.6, 4.0, 1.2, 0.4, 0.2, 0.4, 1.2, 4.0, 26.6];

const canvas = document.getElementById('plinko-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

export function updatePlinkoWagerLabels() {
  const label = document.getElementById('plinko-wallet-balance-label');
  if (label) {
    label.innerText = `${appState.state.balancePgt.toFixed(2)} PGT`;
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

function drawPlinkoCanvas() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const rows = 8;
  const colSpacing = 40;
  const rowSpacing = 35;
  const startY = 40;
  const centerX = canvas.width / 2;

  // Draw pegs
  ctx.fillStyle = 'rgba(0, 240, 255, 0.5)';
  for (let r = 0; r < rows; r++) {
    const numPegs = r + 1;
    const startX = centerX - (numPegs - 1) * colSpacing / 2;
    for (let c = 0; c < numPegs; c++) {
      const x = startX + c * colSpacing;
      const y = startY + r * rowSpacing;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw slots
  const slotsY = startY + rows * rowSpacing + 20;
  ctx.font = '12px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const numSlots = 9;
  const slotsStartX = centerX - (numSlots - 1) * colSpacing / 2;
  
  for (let i = 0; i < numSlots; i++) {
    const x = slotsStartX + i * colSpacing;
    
    // Slot box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(x - 18, slotsY - 15, 36, 30);
    
    // Multiplier text
    const m = MULTIPLIERS[i];
    if (m >= 10) ctx.fillStyle = '#ff00ff';
    else if (m > 1) ctx.fillStyle = '#00f0ff';
    else ctx.fillStyle = '#ff3366';
    
    ctx.fillText(m + 'x', x, slotsY);
  }

  // Draw ball
  if (ballPos) {
    ctx.fillStyle = '#ff00ff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff00ff';
    ctx.beginPath();
    ctx.arc(ballPos.x, ballPos.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// Initial draw
drawPlinkoCanvas();

export async function dropPlinkoBall() {
  if (plinkoIsPlaying) return;
  
  const input = document.getElementById('plinko-bet-input');
  if (!input) return;
  
  plinkoBet = Math.floor(parseFloat(input.value)) || 0;
  const balance = appState.state.balancePgt;
  
  if (plinkoBet < 10) {
    triggerToast("Minimum wager is 10 PGT!", "error");
    return;
  }
  if (plinkoBet > balance) {
    triggerToast("Insufficient PGT!", "error");
    return;
  }
  
  plinkoIsPlaying = true;
  document.getElementById('btn-plinko-drop').disabled = true;
  
  // Deduct bet
  appState.update({ balancePgt: balance - plinkoBet });
  updatePlinkoWagerLabels();
    // Increment jackpot
    if (supabase) {
      supabase.rpc('increment_jackpot', { p_amount: plinkoBet * 0.01 }).then(res => {
        if (res.error) console.error(res.error);
      });
    }
    
    let serverResult = null;
    let rpcFailed = false;
    
    if (supabase) {
      const res = await supabase.rpc('play_plinko', {
        p_wallet: appState.state.walletAddress.toLowerCase(),
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

    if (rpcFailed || !serverResult || serverResult.error) {
      triggerToast(serverResult?.error || "Server validation failed!", "error");
      plinkoIsPlaying = false;
      document.getElementById('btn-plinko-drop').disabled = false;
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
    
    // Shuffle the path so the visual drop is randomized but ends at the correct bucket
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
  
  let currentRow = 0;
  let t = 0; // 0.0 to 1.0 for interpolating between rows
  
  let lastTime = performance.now();
  
  function loop(time) {
    const dt = (time - lastTime) / 1000;
    lastTime = time;
    
    t += dt * 3.5; // ball speed
    
    if (t >= 1.0) {
      t = 0;
      currentRow++;
      sfx.playRoshamboDrum(); // ping sound
    }
    
    if (currentRow >= rows) {
      // Landed
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
      
      plinkoIsPlaying = false;
      document.getElementById('btn-plinko-drop').disabled = false;
      return;
    }
    
    // Interpolate x and y
    const numPegsStart = currentRow + 1;
    const startXGrid = centerX - (numPegsStart - 1) * colSpacing / 2;
    
    // Find current conceptual slot up to this row
    let slotSoFar = 0;
    for(let i=0; i<currentRow; i++) slotSoFar += path[i];
    
    let nextSlotSoFar = slotSoFar + path[currentRow];
    
    const startX = startXGrid + slotSoFar * colSpacing;
    const numPegsEnd = currentRow + 2;
    const endXGrid = centerX - (numPegsEnd - 1) * colSpacing / 2;
    const endX = endXGrid + nextSlotSoFar * colSpacing;
    
    const startYPos = startY + currentRow * rowSpacing;
    const endYPos = startY + (currentRow + 1) * rowSpacing;
    
    // Arc logic (bounce up slightly)
    const arcHeight = 15;
    const yOffset = -Math.sin(t * Math.PI) * arcHeight;
    
    ballPos.x = startX + (endX - startX) * t;
    ballPos.y = startYPos + (endYPos - startYPos) * t + yOffset;
    
    drawPlinkoCanvas();
    plinkoReqId = requestAnimationFrame(loop);
  }
  
  plinkoReqId = requestAnimationFrame(loop);
}

// Hook up button
const btnDrop = document.getElementById('btn-plinko-drop');
if (btnDrop) {
  btnDrop.addEventListener('click', dropPlinkoBall);
}
window.dropPlinkoBall = dropPlinkoBall;
