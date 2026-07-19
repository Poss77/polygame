import { appState } from '../core/state.js';
import { sfx } from '../core/audio.js';
import { supabase } from '../core/config.js';
import { triggerToast } from '../core/ui.js';
import { recordGameMetrics } from '../core/db-sync.js';

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

  // Pre-calculate path
  const rows = 8;
  const path = [];
  let currentSlot = 0; // conceptually starts at 0 relative to left edge of current row
  
  for (let r = 0; r < rows; r++) {
    const dir = Math.random() < 0.5 ? 0 : 1; // 0 = left, 1 = right
    path.push(dir);
    currentSlot += dir;
  }
  
  // currentSlot is now [0..8], representing the final bucket

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
      const m = MULTIPLIERS[currentSlot];
      let payout = Math.floor(plinkoBet * m);
      if (appState.isVipActive() && payout > plinkoBet) {
        payout = plinkoBet + ((payout - plinkoBet) * 2);
      }
      
      appState.update({ balancePgt: appState.state.balancePgt + payout });
      
      recordGameMetrics('Neon Plinko', plinkoBet, payout);
      
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
