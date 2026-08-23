// --- POLYGAME: FULL-SCREEN CYBER CONFETTI & QUANTUM RELIC CELEBRATION ENGINE ---

/**
 * Returns the highest active stacking container (handles HTML5 Fullscreen API & mobile fullscreen modals)
 */
function getActiveTopLayerContainer() {
  const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
  if (fsEl) return fsEl;

  const gameWindow = document.getElementById('game-window-container');
  if (gameWindow && (gameWindow.classList.contains('fullscreen-active') || document.body.classList.contains('game-fullscreen-open'))) {
    return gameWindow;
  }
  return document.body;
}

/**
 * Pauses all active arcade engines when a celebratory popup appears
 */
export function pauseActiveArcadeGames() {
  try {
    if (window.dodgeGame && window.dodgeGame.isPlaying) window.dodgeGame.isPaused = true;
    if (window.invadersGame && window.invadersGame.isPlaying) window.invadersGame.isPaused = true;
    if (window.cyberDrift && window.cyberDrift.isRunning) window.cyberDrift.isPaused = true;
    if (window.cyberStacker && window.cyberStacker.isPlaying) window.cyberStacker.isPaused = true;
  } catch (e) {
    console.warn("[Relic Celebration] Pause games error:", e);
  }
}

/**
 * Resumes all active arcade engines seamlessly upon modal dismissal
 */
export function resumeActiveArcadeGames() {
  try {
    if (window.dodgeGame && window.dodgeGame.isPlaying) {
      window.dodgeGame.isPaused = false;
      window.dodgeGame.lastTime = performance.now();
    }
    if (window.invadersGame && window.invadersGame.isPlaying) {
      window.invadersGame.isPaused = false;
      window.invadersGame.lastFrameTimestamp = performance.now();
    }
    if (window.cyberDrift && window.cyberDrift.isRunning) {
      window.cyberDrift.isPaused = false;
    }
    if (window.cyberStacker && window.cyberStacker.isPlaying) {
      window.cyberStacker.isPaused = false;
    }
  } catch (e) {
    console.warn("[Relic Celebration] Resume games error:", e);
  }
}

/**
 * High-performance full-screen neon confetti blast
 */
export function triggerConfetti(options = {}) {
  if (typeof window === 'undefined') return;

  const count = options.count || 120;
  const colors = options.colors || ['#00f0ff', '#bd00ff', '#ffd700', '#ff007f', '#00ff66', '#ffffff'];
  const targetParent = getActiveTopLayerContainer();
  
  let canvas = document.getElementById('polygame-confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'polygame-confetti-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '2147483646';
    targetParent.appendChild(canvas);
  } else if (canvas.parentElement !== targetParent) {
    targetParent.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');
  const width = (canvas.width = window.innerWidth);
  const height = (canvas.height = window.innerHeight);

  const particles = [];
  const startX = options.x !== undefined ? options.x : width / 2;
  const startY = options.y !== undefined ? options.y : height * 0.45;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 6 + Math.random() * 14;
    const size = 6 + Math.random() * 8;
    const isDiamond = Math.random() > 0.4;
    const isStar = Math.random() > 0.8;

    particles.push({
      x: startX + (Math.random() - 0.5) * 80,
      y: startY + (Math.random() - 0.5) * 40,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (speed * 0.45), // upward bias
      size,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      scaleX: 1,
      scaleSpeed: 0.05 + Math.random() * 0.08,
      gravity: 0.28 + Math.random() * 0.18,
      friction: 0.982,
      opacity: 1.0,
      fadeRate: 0.005 + Math.random() * 0.007,
      shape: isStar ? 'star' : (isDiamond ? 'diamond' : 'square')
    });
  }

  const startTime = Date.now();
  const maxDuration = 3800; // 3.8s total duration

  function drawStar(c, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    c.beginPath();
    c.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      c.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      c.lineTo(x, y);
      rot += step;
    }
    c.lineTo(cx, cy - outerRadius);
    c.closePath();
    c.fill();
  }

  function render() {
    const elapsed = Date.now() - startTime;
    if (elapsed > maxDuration || particles.length === 0) {
      if (canvas && canvas.parentElement) {
        ctx.clearRect(0, 0, width, height);
      }
      return;
    }

    ctx.clearRect(0, 0, width, height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];

      p.vx *= p.friction;
      p.vy *= p.friction;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;

      p.rotation += p.rotSpeed;
      p.scaleX = Math.cos(elapsed * p.scaleSpeed);
      p.opacity -= p.fadeRate;

      if (p.opacity <= 0 || p.y > height + 50) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.scale(p.scaleX, 1);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;

      if (p.shape === 'star') {
        drawStar(ctx, 0, 0, 5, p.size, p.size * 0.45);
      } else if (p.shape === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size * 0.7, 0);
        ctx.lineTo(0, p.size);
        ctx.lineTo(-p.size * 0.7, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }

      ctx.restore();
    }

    requestAnimationFrame(render);
  }

  render();
}

/**
 * Triggers a celebratory discovery sequence when an in-game Quantum Relic is harvested
 */
export function triggerRelicCelebration(relicMeta) {
  if (!relicMeta) return;

  // 1. Automatically Pause Active Arcade Games
  pauseActiveArcadeGames();

  const rarityColors = {
    rare: { border: '#00f0ff', glow: 'rgba(0,240,255,0.7)', bg: 'rgba(0,240,255,0.15)', text: '#00f0ff' },
    epic: { border: '#bd00ff', glow: 'rgba(189,0,255,0.7)', bg: 'rgba(189,0,255,0.15)', text: '#bd00ff' },
    legendary: { border: '#ffd700', glow: 'rgba(255,215,0,0.8)', bg: 'rgba(255,215,0,0.15)', text: '#ffd700' },
    mythic: { border: '#ff0055', glow: 'rgba(255,0,85,0.85)', bg: 'rgba(255,0,85,0.2)', text: '#ff0055' }
  };
  const rarity = (relicMeta.rarity || 'rare').toLowerCase();
  const rc = rarityColors[rarity] || rarityColors.rare;

  // Ensure spin animation style exists
  if (!document.getElementById('relic-celebration-keyframes')) {
    const style = document.createElement('style');
    style.id = 'relic-celebration-keyframes';
    style.textContent = `
      @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      @keyframes pulse-glow { 0%, 100% { filter: drop-shadow(0 0 10px rgba(0,240,255,0.6)); } 50% { filter: drop-shadow(0 0 25px rgba(255,215,0,0.9)); } }
    `;
    document.head.appendChild(style);
  }

  // 2. Play Triumphant Fanfare Sound
  if (window.sfx && typeof window.sfx.playRelicFanfare === 'function') {
    window.sfx.playRelicFanfare();
  } else if (window.sfx && typeof window.sfx.playWin === 'function') {
    window.sfx.playWin();
  }

  // 3. Universal State & Supabase Persistence
  if (relicMeta.id && window.appState && window.appState.state) {
    const currentRelics = { ...(window.appState.state.relics || {}) };
    const prev = currentRelics[relicMeta.id] || { unminted: 0, onchain: 0, total: 0, token_ids: [] };
    currentRelics[relicMeta.id] = {
      ...prev,
      unminted: (prev.unminted || 0) + 1,
      onchain: prev.onchain || 0,
      total: (prev.unminted || 0) + 1 + (prev.onchain || 0),
      token_ids: prev.token_ids || []
    };
    window.appState.update({ relics: currentRelics });
    if (typeof window.renderRelicsVault === 'function') {
      window.renderRelicsVault();
    }
  }

  const sbClient = window.supabaseClient || (window.supabase && typeof window.supabase.rpc === 'function' ? window.supabase : null);
  if (sbClient && window.appState && window.appState.state && relicMeta.id) {
    const pId = window.appState.state.playerId || window.appState.state.walletAddress;
    if (pId) {
      sbClient.rpc('grant_relic_drop', {
        p_player_id: pId,
        p_relic_id: relicMeta.id,
        p_amount: 1
      }).then(res => {
        if (res && res.data && window.appState) {
          window.appState.update({ relics: res.data });
          if (typeof window.renderRelicsVault === 'function') window.renderRelicsVault();
        }
      }).catch(err => console.warn("[triggerRelicCelebration] grant_relic_drop error:", err));
    }
  }

  // 4. Launch Cyber Confetti Stream
  triggerConfetti({
    count: 140,
    colors: [rc.border, '#ffd700', '#00f0ff', '#ffffff', '#ff007f']
  });

  // 5. Render Floating Quantum Relic Discovery Hologram Modal attached to Top Layer
  const targetParent = getActiveTopLayerContainer();

  let existingOverlay = document.getElementById('quantum-relic-discovery-overlay');
  if (existingOverlay) existingOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'quantum-relic-discovery-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.zIndex = '2147483647';
  overlay.style.background = 'rgba(0, 0, 0, 0.65)';
  overlay.style.backdropFilter = 'blur(8px)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '1rem';
  overlay.style.boxSizing = 'border-box';
  overlay.style.pointerEvents = 'auto';
  overlay.style.cursor = 'pointer';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 0.3s ease';

  const modal = document.createElement('div');
  modal.id = 'quantum-relic-discovery-modal';
  modal.style.background = 'linear-gradient(135deg, rgba(10, 14, 23, 0.98) 0%, rgba(20, 10, 35, 0.98) 100%)';
  modal.style.border = `2px solid ${rc.border}`;
  modal.style.boxShadow = `0 0 35px ${rc.glow}, inset 0 0 20px ${rc.bg}`;
  modal.style.borderRadius = '16px';
  modal.style.padding = '1.25rem 1.5rem';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.alignItems = 'center';
  modal.style.textAlign = 'center';
  modal.style.maxWidth = '92vw';
  modal.style.width = '360px';
  modal.style.boxSizing = 'border-box';
  modal.style.transform = 'scale(0.85)';
  modal.style.transition = 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

  const relicImage = relicMeta.image || `metadata/images/relics/${relicMeta.id}.jpg`;

  modal.innerHTML = `
    <div style="font-size: 0.78rem; font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; color: #ffd700; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 6px;">
      <span>🏺</span> QUANTUM RELIC DISCOVERED! <span>✨</span>
    </div>

    <!-- Relic Artwork with Glowing Rotating Ring -->
    <div style="position: relative; width: 100px; height: 100px; margin: 0.4rem 0 0.65rem 0; display: flex; justify-content: center; align-items: center;">
      <div style="position: absolute; inset: -5px; border-radius: 12px; border: 2px dashed ${rc.border}; animation: spin-slow 12s linear infinite; opacity: 0.7;"></div>
      <img src="${relicImage}" alt="${relicMeta.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 10px; border: 1px solid ${rc.border}; box-shadow: 0 0 15px ${rc.glow};" onerror="this.onerror=null; this.src='metadata/images/relics/relic_locked_unknown.jpg';" />
      <span style="position: absolute; bottom: -6px; font-size: 0.65rem; font-weight: 900; text-transform: uppercase; background: ${rc.border}; color: #000; padding: 2px 8px; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.6);">
        ${rarity}
      </span>
    </div>

    <h3 style="font-size: 1.15rem; font-weight: 900; color: #fff; margin: 0 0 2px 0; text-shadow: 0 0 10px ${rc.glow};">
      ${relicMeta.name}
    </h3>
    <div style="font-size: 0.72rem; font-weight: 700; color: ${rc.text}; text-transform: uppercase; margin-bottom: 6px;">
      ${relicMeta.gameName || 'Apex Relic'}
    </div>
    <p style="font-size: 0.76rem; color: var(--text-muted); line-height: 1.3; margin: 0 0 10px 0;">
      ${relicMeta.description || 'Added to your permanent Quantum Relics Vault. Collect all 17 for the 1.5x Apex Multiplier!'}
    </p>

    <div style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 4px 10px; font-size: 0.7rem; color: #00f0ff; font-weight: 800; margin-bottom: 8px;">
      ✨ Added to Stash (+1 In-Game)
    </div>

    <button id="btn-relic-resume-game" style="width: 100%; padding: 0.55rem 1rem; font-weight: 800; font-size: 0.82rem; background: linear-gradient(135deg, #00f0ff, #bd00ff); color: #fff; border: none; border-radius: 6px; cursor: pointer; box-shadow: 0 0 15px rgba(0,240,255,0.3); text-transform: uppercase; letter-spacing: 0.5px;">
      ▶ Continue Game
    </button>
  `;

  overlay.appendChild(modal);
  targetParent.appendChild(overlay);

  // Trigger smooth fade & scale
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    modal.style.transform = 'scale(1)';
  });

  let isDismissed = false;
  const dismiss = () => {
    if (isDismissed) return;
    isDismissed = true;

    overlay.style.opacity = '0';
    modal.style.transform = 'scale(0.85)';

    setTimeout(() => {
      if (overlay.parentElement) overlay.remove();
      resumeActiveArcadeGames();
    }, 300);
  };

  overlay.addEventListener('click', dismiss);
  const btnResume = modal.querySelector('#btn-relic-resume-game');
  if (btnResume) btnResume.addEventListener('click', (e) => {
    e.stopPropagation();
    dismiss();
  });
}

// Make accessible globally
if (typeof window !== 'undefined') {
  window.triggerConfetti = triggerConfetti;
  window.triggerRelicCelebration = triggerRelicCelebration;
  window.pauseActiveArcadeGames = pauseActiveArcadeGames;
  window.resumeActiveArcadeGames = resumeActiveArcadeGames;
}
