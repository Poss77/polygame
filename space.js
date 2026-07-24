// ============================================================
// POLYSPACE: PLANETARY MINING & BASE RAIDS SIMULATION ENGINE
// ============================================================

class PolySpaceEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.stars = null;

    // Default Player Space State
    this.state = {
      warpLevel: 1,
      laserLevel: 1,
      cargoLevel: 1,
      shieldLevel: 1,
      turretLevel: 1,
      fleetPower: 100,

      iron: 50,
      titanium: 10,
      quantum: 0,
      pgtOre: 0,

      expeditions: [], // Array of up to 3 active expeditions: [{ id, type, name, startTime, endTime }]

      pokesToday: 0,
      lastPokeDate: null,
      lastOpDate: null,
      raidsWon: 0,
      mineralsMinedTotal: 0
    };

    // Auto-update UI
    setInterval(() => {
      this.updateUI();
    }, 1000);

    // Smooth Canvas rendering loop
    this.animationLoop = () => {
      if (this.ctx && this.canvas && this.canvas.offsetParent !== null) {
        this.renderHangarView();
      }
      requestAnimationFrame(this.animationLoop);
    };
    requestAnimationFrame(this.animationLoop);
  }

  init() {
    this.loadSpaceState();
    this.canvas = document.getElementById('space-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = (rect.width || 640) * dpr;
    this.canvas.height = (rect.height || 400) * dpr;
    this.ctx.scale(dpr, dpr);
    this.width = rect.width || 640;
    this.height = rect.height || 400;

    this.renderHangarView();
    this.updateUI();
  }

  loadSpaceState() {
    if (window.appState && window.appState.state && window.appState.state.spaceState) {
      const loaded = window.appState.state.spaceState;
      this.state = { ...this.state, ...loaded };
      
      // Migration: convert single activeExpedition to expeditions array
      if (loaded.activeExpedition && (!this.state.expeditions || this.state.expeditions.length === 0)) {
        this.state.expeditions = [{ id: 'exp_' + Date.now(), ...loaded.activeExpedition }];
        delete this.state.activeExpedition;
      }
      if (!Array.isArray(this.state.expeditions)) {
        this.state.expeditions = [];
      }
    }
    this.calculateFleetPower();
  }

  saveSpaceState() {
    this.calculateFleetPower();
    if (window.appState) {
      window.appState.update({ spaceState: this.state });
    }
    this.updateUI();
  }

  calculateFleetPower() {
    this.state.fleetPower = (this.state.warpLevel * 100) + 
                            (this.state.laserLevel * 80) + 
                            (this.state.cargoLevel * 50) + 
                            (this.state.shieldLevel * 60) + 
                            (this.state.turretLevel * 90);
  }

  updateUI() {
    const ironEl = document.getElementById('space-val-iron');
    const titEl = document.getElementById('space-val-titanium');
    const quantEl = document.getElementById('space-val-quantum');
    const pgtEl = document.getElementById('space-val-pgtore');
    const powerEl = document.getElementById('space-val-power');

    if (ironEl) ironEl.innerText = Math.floor(this.state.iron);
    if (titEl) titEl.innerText = Math.floor(this.state.titanium);
    if (quantEl) quantEl.innerText = Math.floor(this.state.quantum);
    if (pgtEl) pgtEl.innerText = Math.floor(this.state.pgtOre);
    if (powerEl) powerEl.innerText = this.state.fleetPower;
    
    const hangarPowerEl = document.getElementById('space-hangar-power-val');
    if (hangarPowerEl) hangarPowerEl.innerText = this.state.fleetPower.toLocaleString();

    const warpLvl = document.getElementById('space-lvl-warp');
    const laserLvl = document.getElementById('space-lvl-laser');
    const cargoLvl = document.getElementById('space-lvl-cargo');

    if (warpLvl) warpLvl.innerText = `Lvl ${this.state.warpLevel}`;
    if (laserLvl) laserLvl.innerText = `Lvl ${this.state.laserLevel}`;
    if (cargoLvl) cargoLvl.innerText = `Lvl ${this.state.cargoLevel}`;

    const warpBonus = document.getElementById('space-bonus-warp');
    const warpCost = document.getElementById('space-cost-warp');
    const laserBonus = document.getElementById('space-bonus-laser');
    const laserCost = document.getElementById('space-cost-laser');
    const cargoBonus = document.getElementById('space-bonus-cargo');
    const cargoCost = document.getElementById('space-cost-cargo');

    if (warpBonus) {
      if (this.state.warpLevel === 1) warpBonus.innerText = "Current: Unlocks Asteroids (15m)";
      else if (this.state.warpLevel === 2) warpBonus.innerText = "Current: Unlocks Nebula (2h)";
      else if (this.state.warpLevel === 3) warpBonus.innerText = "Current: Unlocks Void (8h)";
      else warpBonus.innerText = `Current: Unlocks Sector 9 (24h) (+${(this.state.warpLevel - 4) * 5}% Speed)`;
    }
    if (warpCost) {
      if (this.state.warpLevel >= 50) {
        warpCost.innerText = "⭐ MAX LEVEL 50 REACHED";
        warpCost.style.color = "var(--color-success)";
      } else {
        const cWarpIron = Math.floor(40 * Math.pow(1.22, this.state.warpLevel - 1));
        const cWarpTit = Math.floor(10 * Math.pow(1.22, this.state.warpLevel - 1));
        const cWarpPgt = Math.floor(50 * Math.pow(1.22, this.state.warpLevel - 1));
        warpCost.innerText = `Next: ${cWarpIron.toLocaleString()} Iron | ${cWarpTit.toLocaleString()} Tit | ${cWarpPgt.toLocaleString()} PGT`;
      }
    }

    if (laserBonus) {
      const laserPct = Math.round((this.state.laserLevel - 1) * 18);
      laserBonus.innerText = `Current: +${laserPct}% PGT Yield & Power`;
    }
    if (laserCost) {
      if (this.state.laserLevel >= 50) {
        laserCost.innerText = "⭐ MAX LEVEL 50 REACHED";
        laserCost.style.color = "var(--color-success)";
      } else {
        const cLaserIron = Math.floor(40 * Math.pow(1.22, this.state.laserLevel - 1));
        const cLaserTit = Math.floor(10 * Math.pow(1.22, this.state.laserLevel - 1));
        const cLaserPgt = Math.floor(50 * Math.pow(1.22, this.state.laserLevel - 1));
        laserCost.innerText = `Next: ${cLaserIron.toLocaleString()} Iron | ${cLaserTit.toLocaleString()} Tit | ${cLaserPgt.toLocaleString()} PGT`;
      }
    }

    if (cargoBonus) {
      const cargoPct = Math.round((this.state.cargoLevel - 1) * 25);
      cargoBonus.innerText = `Current: +${cargoPct}% Ore Boost`;
    }
    if (cargoCost) {
      if (this.state.cargoLevel >= 50) {
        cargoCost.innerText = "⭐ MAX LEVEL 50 REACHED";
        cargoCost.style.color = "var(--color-success)";
      } else {
        const cCargoIron = Math.floor(40 * Math.pow(1.22, this.state.cargoLevel - 1));
        const cCargoTit = Math.floor(10 * Math.pow(1.22, this.state.cargoLevel - 1));
        const cCargoPgt = Math.floor(50 * Math.pow(1.22, this.state.cargoLevel - 1));
        cargoCost.innerText = `Next: ${cCargoIron.toLocaleString()} Iron | ${cCargoTit.toLocaleString()} Tit | ${cCargoPgt.toLocaleString()} PGT`;
      }
    }

    // Render Concurrent Expeditions UI (Up to 3 Slots)
    const statusContainer = document.getElementById('space-expedition-status-box');
    if (!statusContainer) return;

    const activeCount = (this.state.expeditions || []).length;
    // Scale max slots from 3 up to 5 based on Warp Level
    const maxSlots = Math.min(5, 3 + Math.floor((this.state.warpLevel || 1) / 20));

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-bottom: 0.75rem;">
        <h4 style="color: #fff; font-size: 1.1rem; margin:0;">🛸 Fleet Command Center</h4>
        <span style="font-size:0.85rem; font-weight:700; color:var(--color-accent);">Active Expeditions: ${activeCount}/${maxSlots}</span>
      </div>
    `;

    // Render active expedition cards
    if (activeCount > 0) {
      html += `<div style="display:flex; flex-direction:column; gap:0.5rem; width:100%; margin-bottom: 1rem;">`;
      this.state.expeditions.forEach((exp, idx) => {
        const now = Date.now();
        if (now >= exp.endTime) {
          html += `
            <div style="background: rgba(0, 255, 102, 0.12); border: 1px solid var(--color-success); border-radius: 6px; padding: 0.65rem 1rem; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:var(--color-success); font-size:0.85rem;">🎉 ${exp.name} Returned!</strong>
                <div style="font-size:0.75rem; color:var(--text-muted);">Ready to harvest loot</div>
              </div>
              <button class="btn-primary" onclick="claimExpeditionLoot('${exp.id}')" style="background: var(--color-success); color: #000; font-weight: 800; font-size: 0.75rem; padding: 0.4rem 0.8rem;">🎁 CLAIM LOOT</button>
            </div>
          `;
        } else {
          const totalSecs = Math.ceil((exp.endTime - now) / 1000);
          const hrs = Math.floor(totalSecs / 3600);
          const mins = Math.floor((totalSecs % 3600) / 60);
          const secs = totalSecs % 60;
          const timeStr = `${hrs > 0 ? hrs + 'h ' : ''}${mins}m ${secs < 10 ? '0' : ''}${secs}s`;

          html += `
            <div style="background: rgba(0, 240, 255, 0.08); border: 1px solid var(--border-cyan); border-radius: 6px; padding: 0.65rem 1rem; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:var(--color-accent); font-size:0.85rem;">🛸 Mining ${exp.name}...</strong>
                <div style="font-size:0.75rem; color:var(--text-muted);">Tab can be safely closed!</div>
              </div>
              <span style="font-size: 1.1rem; font-weight: 800; color: var(--color-warning);">${timeStr}</span>
            </div>
          `;
        }
      });
      html += `</div>`;
    }

    // If slots available, show destination picker
    if (activeCount < maxSlots) {
      html += `
        <div style="width:100%; border-top:1px solid var(--border-glass); padding-top:0.75rem; margin-top:0.25rem;">
          <p style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 0.75rem;">Launch Starship on an expedition (${maxSlots - activeCount} slot available):</p>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center;">
            <button class="btn-primary" onclick="startOfflineExpedition('asteroids')" style="background: var(--color-primary); color: #000; font-weight: 700; padding: 0.5rem 0.75rem; font-size:0.75rem;">🪨 Asteroids (15m)</button>
            <button class="btn-primary" onclick="startOfflineExpedition('nebula')" style="background: var(--color-accent); color: #000; font-weight: 700; padding: 0.5rem 0.75rem; font-size:0.75rem;">🪐 Nebula (2h)</button>
            <button class="btn-primary" onclick="startOfflineExpedition('void')" style="background: #ff00ff; color: #fff; font-weight: 700; padding: 0.5rem 0.75rem; font-size:0.75rem;">🌌 Void Exoplanet (8h)</button>
            <button class="btn-primary" onclick="startOfflineExpedition('sector9')" style="background: #ffaa00; color: #000; font-weight: 700; padding: 0.5rem 0.75rem; font-size:0.75rem;">🛸 Deep Sector 9 (24h)</button>
          </div>
        </div>
      `;
    }

    statusContainer.innerHTML = html;
  }

  // --- PASSIVE OFFLINE EXPEDITIONS ---

  startOfflineExpedition(destinationType) {
    if (!this.state.expeditions) this.state.expeditions = [];
    
    const maxSlots = Math.min(5, 3 + Math.floor((this.state.warpLevel || 1) / 20));

    if (this.state.expeditions.length >= maxSlots) {
      if (window.triggerToast) window.triggerToast(`All ${maxSlots} Fleet Slots are active! Wait for an expedition to finish.`, "error");
      return;
    }

    let durationMs = 15 * 60 * 1000; // 15 mins
    let name = "Alpha Asteroid Belt";

    if (destinationType === 'nebula') {
      if (this.state.warpLevel < 2) {
        if (window.triggerToast) window.triggerToast("Requires Warp Drive Lvl 2!", "error");
        return;
      }
      durationMs = 2 * 60 * 60 * 1000; // 2 hours
      name = "Neon Nebula";
    } else if (destinationType === 'void') {
      if (this.state.warpLevel < 3) {
        if (window.triggerToast) window.triggerToast("Requires Warp Drive Lvl 3!", "error");
        return;
      }
      durationMs = 8 * 60 * 60 * 1000; // 8 hours
      name = "Deep Void Exoplanet";
    } else if (destinationType === 'sector9') {
      if (this.state.warpLevel < 4) {
        if (window.triggerToast) window.triggerToast("Requires Warp Drive Lvl 4!", "error");
        return;
      }
      durationMs = 24 * 60 * 60 * 1000; // 24 hours (1 Day)
      name = "Deep Space Sector 9";
    }

    const startTime = Date.now();
    const endTime = startTime + durationMs;

    this.state.expeditions.push({
      id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: destinationType,
      name: name,
      startTime: startTime,
      endTime: endTime
    });

    this.saveSpaceState();
    if (window.triggerToast) window.triggerToast(`Launched Starship to ${name}! You can close the tab!`, "success");
  }

  claimExpeditionLoot(expId) {
    if (!this.state.expeditions || this.state.expeditions.length === 0) return;

    const idx = this.state.expeditions.findIndex(e => e.id === expId || (!expId && Date.now() >= e.endTime));
    if (idx === -1) return;

    const exp = this.state.expeditions[idx];
    if (Date.now() < exp.endTime) {
      if (window.triggerToast) window.triggerToast("Expedition is still in progress!", "error");
      return;
    }

    let earnedIron = 0;
    let earnedTit = 0;
    let earnedQuant = 0;
    let earnedPgt = 0;

    const cargoMult = (1 + (this.state.cargoLevel - 1) * 0.25);
    const laserMult = (1 + (this.state.laserLevel - 1) * 0.18);

    if (exp.type === 'asteroids') {
      earnedIron = Math.floor(40 * cargoMult);
      earnedPgt = 0.5 * laserMult;
    } else if (exp.type === 'nebula') {
      earnedIron = Math.floor(120 * cargoMult);
      earnedTit = Math.floor(40 * cargoMult);
      earnedPgt = 2.5 * laserMult;
    } else if (exp.type === 'void') {
      earnedIron = Math.floor(300 * cargoMult);
      earnedTit = Math.floor(100 * cargoMult);
      earnedQuant = Math.floor(25 * cargoMult);
      earnedPgt = 6.0 * laserMult;
    } else if (exp.type === 'sector9') { // 24-Hour Expedition
      earnedIron = Math.floor(850 * cargoMult);
      earnedTit = Math.floor(280 * cargoMult);
      earnedQuant = Math.floor(75 * cargoMult);
      earnedPgt = 12.0 * laserMult;
    }

    const multis = window.appState ? window.appState.getMultipliers() : null;
    if (multis && multis.nftGameMultiplier) {
      earnedPgt *= (1 + (multis.nftGameMultiplier / 100));
    }
    if (window.appState && window.appState.isVipActive && window.appState.isVipActive()) {
      earnedPgt *= 2;
    }
    earnedPgt = parseFloat(earnedPgt.toFixed(2));

    // CRITICAL SUCCESS RNG
    let isCritical = false;
    if (Math.random() < 0.10) {
      isCritical = true;
      earnedIron *= 3;
      earnedTit *= 3;
      earnedQuant *= 3;
      earnedPgt *= 3;
    }

    this.state.iron += earnedIron;
    this.state.titanium += earnedTit;
    this.state.quantum += earnedQuant;

    // Remove claimed expedition from active list
    this.state.expeditions.splice(idx, 1);

    if (earnedPgt > 0 && window.creditArcadePayout) {
      window.creditArcadePayout(earnedPgt);
    }

    // FLOATING LOOT PARTICLES
    if (this.canvas) {
      this.particles = this.particles || [];
      const cx = this.width * 0.22;
      const cy = this.height / 2;
      this.particles.push({ text: `+${earnedIron} Iron`, color: '#aaaaaa', x: cx, y: cy, vy: -1.5 - Math.random(), life: 1.0 });
      if (earnedTit > 0) this.particles.push({ text: `+${earnedTit} Tit`, color: '#38bdf8', x: cx, y: cy + 15, vy: -1.2 - Math.random(), life: 1.0 });
      if (earnedQuant > 0) this.particles.push({ text: `+${earnedQuant} Quant`, color: '#ff00ff', x: cx, y: cy + 30, vy: -1.0 - Math.random(), life: 1.0 });
      if (earnedPgt > 0) this.particles.push({ text: `+${earnedPgt} PGT`, color: '#ffaa00', x: cx, y: cy - 15, vy: -1.8 - Math.random(), life: 1.0 });
      if (isCritical) {
        this.particles.push({ text: 'CRITICAL SUCCESS (3x)!', color: '#ff0055', x: cx, y: cy - 30, vy: -2, life: 1.5 });
      }
    }

    this.saveSpaceState();
    
    const toastMsg = isCritical 
      ? `CRITICAL SUCCESS! 3x Loot Claimed from ${exp.name}! +${earnedIron} Iron, +${earnedTit} Tit & +${earnedPgt} PGT!`
      : `Loot Claimed from ${exp.name}! +${earnedIron} Iron, +${earnedTit} Tit & +${earnedPgt} PGT!`;
    if (window.triggerToast) window.triggerToast(toastMsg, isCritical ? "warning" : "success");
    if (window.sfx && window.sfx.playSuccess) window.sfx.playSuccess();
  }

  // --- SLEEK HIGH-TECH STARSHIP GRAPHICS ---

  renderHangarView() {
    if (!this.ctx || !this.canvas) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const expectedWidth = Math.floor(rect.width * dpr);
    const expectedHeight = Math.floor(rect.height * dpr);
    
    if (this.canvas.width !== expectedWidth || this.canvas.height !== expectedHeight) {
      this.canvas.width = expectedWidth;
      this.canvas.height = expectedHeight;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.width = rect.width;
      this.height = rect.height;
    }
    
    const w = this.width;
    const h = this.height;

    this.ctx.clearRect(0, 0, w, h);
    
    // Deep Space Background
    this.ctx.fillStyle = '#030712';
    this.ctx.fillRect(0, 0, w, h);

    if (!this.stars) {
      this.stars = [];
      for (let i = 0; i < 75; i++) {
        this.stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size: Math.random() * 2,
          alpha: Math.random()
        });
      }
    }

    // Render twinkling stars
    this.stars.forEach(star => {
      this.ctx.fillStyle = `rgba(0, 240, 255, ${0.3 + Math.sin(Date.now() / 500 + star.x) * 0.4})`;
      this.ctx.beginPath();
      this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Radial Core Nebula Glow on left
    const grad = this.ctx.createRadialGradient(w * 0.22, h / 2, 20, w * 0.22, h / 2, 200);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.15)');
    grad.addColorStop(0.5, 'rgba(255, 0, 255, 0.05)');
    grad.addColorStop(1, 'rgba(3, 7, 18, 0.0)');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);

    // --- LEFT HALF: Render Flagship Starship Centered at x = w * 0.22 ---
    const cx = w * 0.22;
    const cy = h / 2 - 5;

    this.ctx.save();

    // Hangar Docking Light Beams
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(cx - 90, 0);
    this.ctx.lineTo(cx - 35, h);
    this.ctx.moveTo(cx + 90, 0);
    this.ctx.lineTo(cx + 35, h);
    this.ctx.stroke();

    // 1. Plasma Thruster Flames
    const flameLen = 30 + Math.sin(Date.now() / 60) * 10;
    const flameGrad = this.ctx.createLinearGradient(cx, cy + 35, cx, cy + 35 + flameLen);
    flameGrad.addColorStop(0, '#00ffff');
    flameGrad.addColorStop(0.4, '#ff00ff');
    flameGrad.addColorStop(1, 'rgba(255, 0, 100, 0)');

    this.ctx.fillStyle = flameGrad;

    // Main Engine Flame
    this.ctx.beginPath();
    this.ctx.moveTo(cx - 10, cy + 35);
    this.ctx.lineTo(cx, cy + 35 + flameLen);
    this.ctx.lineTo(cx + 10, cy + 35);
    this.ctx.closePath();
    this.ctx.fill();

    // 2. Left & Right Wings
    this.ctx.fillStyle = '#00c3ff';

    // Left Wing
    this.ctx.beginPath();
    this.ctx.moveTo(cx - 12, cy - 10);
    this.ctx.lineTo(cx - 80, cy + 25);
    this.ctx.lineTo(cx - 65, cy + 42);
    this.ctx.lineTo(cx - 18, cy + 18);
    this.ctx.closePath();
    this.ctx.fill();

    // Right Wing
    this.ctx.beginPath();
    this.ctx.moveTo(cx + 12, cy - 10);
    this.ctx.lineTo(cx + 80, cy + 25);
    this.ctx.lineTo(cx + 65, cy + 42);
    this.ctx.lineTo(cx + 18, cy + 18);
    this.ctx.closePath();
    this.ctx.fill();

    // UPGRADE LVL 10+: Side Thrusters on Wings
    if (this.state.warpLevel >= 10) {
      this.ctx.fillStyle = '#ff00ff';
      this.ctx.beginPath();
      this.ctx.arc(cx - 68, cy + 42, 4, 0, Math.PI * 2);
      this.ctx.arc(cx + 68, cy + 42, 4, 0, Math.PI * 2);
      this.ctx.fill();
      
      const smallFlameLen = 15 + Math.sin(Date.now() / 40) * 5;
      this.ctx.fillStyle = flameGrad;
      this.ctx.fillRect(cx - 70, cy + 42, 4, smallFlameLen);
      this.ctx.fillRect(cx + 66, cy + 42, 4, smallFlameLen);
    }

    // UPGRADE LVL 30+: Heavy Armor Plating on Wings
    if (this.state.warpLevel >= 30) {
      this.ctx.fillStyle = '#0f274a';
      this.ctx.strokeStyle = '#38bdf8';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(cx - 30, cy + 10);
      this.ctx.lineTo(cx - 70, cy + 28);
      this.ctx.lineTo(cx - 50, cy + 35);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(cx + 30, cy + 10);
      this.ctx.lineTo(cx + 70, cy + 28);
      this.ctx.lineTo(cx + 50, cy + 35);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    }

    // Wing Cannons
    this.ctx.fillStyle = '#ffaa00';
    this.ctx.fillRect(cx - 82, cy + 16, 3, 14);
    this.ctx.fillRect(cx + 79, cy + 16, 3, 14);

    // UPGRADE LVL 40+: Plasma Cannons (Glowing)
    if (this.state.warpLevel >= 40) {
      this.ctx.fillStyle = '#00ffff';
      this.ctx.fillRect(cx - 83, cy + 10, 5, 6);
      this.ctx.fillRect(cx + 78, cy + 10, 5, 6);
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = '#00ffff';
      this.ctx.fillRect(cx - 82, cy - 2, 3, 12);
      this.ctx.fillRect(cx + 79, cy - 2, 3, 12);
      this.ctx.shadowBlur = 0;
    }

    // 3. Metallic Fuselage Hull Body
    const hullGrad = this.ctx.createLinearGradient(cx - 20, cy, cx + 20, cy);
    hullGrad.addColorStop(0, '#0a1931');
    hullGrad.addColorStop(0.5, '#1e3a8a');
    hullGrad.addColorStop(1, '#0a1931');

    this.ctx.fillStyle = hullGrad;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy - 58); // Sharp Nose
    this.ctx.lineTo(cx + 20, cy + 20);
    this.ctx.lineTo(cx + 10, cy + 36);
    this.ctx.lineTo(cx - 10, cy + 36);
    this.ctx.lineTo(cx - 20, cy + 20);
    this.ctx.closePath();
    this.ctx.fill();

    // UPGRADE LVL 20+: Glowing Core Reactor
    if (this.state.warpLevel >= 20) {
      this.ctx.fillStyle = '#ff00ff';
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = '#ff00ff';
      this.ctx.beginPath();
      this.ctx.arc(cx, cy + 10, 8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(cx, cy + 10, 3, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Hull Outline Trim
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // 4. Glowing Cyan Cockpit Canopy
    this.ctx.fillStyle = '#00ffff';
    this.ctx.beginPath();
    this.ctx.ellipse(cx, cy - 20, 6, 15, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Flagship Label under ship
    this.ctx.fillStyle = '#00ffff';
    this.ctx.font = 'bold 10px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('🚀 FLAGSHIP HANGAR', cx, cy + 65);

    this.ctx.restore();

    // --- VERTICAL DIVIDER LINE ---
    const divX = w * 0.43;
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
    this.ctx.lineWidth = 1.5;
    this.ctx.setLineDash([6, 6]);
    this.ctx.beginPath();
    this.ctx.moveTo(divX, 10);
    this.ctx.lineTo(divX, h - 10);
    this.ctx.stroke();
    this.ctx.restore();

    // --- RIGHT HALF: TACTICAL EXPEDITION MAP ---
    // 1. Scattered Ambient Asteroids on Map
    if (!this.mapAsteroids) {
      this.mapAsteroids = [
        { x: w * 0.48, y: h * 0.25, r: 6 },
        { x: w * 0.54, y: h * 0.75, r: 8 },
        { x: w * 0.68, y: h * 0.15, r: 7 },
        { x: w * 0.73, y: h * 0.82, r: 9 },
        { x: w * 0.88, y: h * 0.28, r: 6 },
        { x: w * 0.95, y: h * 0.60, r: 7 }
      ];
    }
    this.mapAsteroids.forEach(ast => {
      this.ctx.fillStyle = 'rgba(100, 120, 150, 0.35)';
      this.ctx.strokeStyle = 'rgba(140, 165, 200, 0.5)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(ast.x, ast.y, ast.r, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    });

    // 2. Base Hub Node (Dispatch Station Node on Right Side)
    const baseX = w * 0.49;
    const baseY = h * 0.50;

    this.ctx.save();
    
    // Pulsing Outer Hub Ring
    const pulseRadius = 22 + Math.sin(Date.now() / 300) * 4;
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.ellipse(baseX, baseY, pulseRadius, pulseRadius / 3, -0.2, 0, Math.PI * 2);
    this.ctx.stroke();

    // Base Node Planet Body
    this.ctx.fillStyle = '#1d4ed8';
    this.ctx.strokeStyle = '#38bdf8';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(baseX, baseY, 15, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    // Orbital Base Ring
    this.ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    this.ctx.beginPath();
    this.ctx.ellipse(baseX, baseY, 22, 7, -0.2, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 9px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('🌍 Outpost Hub', baseX, baseY + 28);
    this.ctx.restore();

    // 3. Destinations
    const destinations = [
      { key: 'asteroids', name: '🪨 Asteroids (15m)', x: w * 0.70, y: h * 0.22, color: '#38bdf8', size: 13 },
      { key: 'nebula', name: '🪐 Nebula (2h)', x: w * 0.83, y: h * 0.50, color: '#a855f7', size: 16 },
      { key: 'void', name: '🌌 Deep Void (8h+)', x: w * 0.90, y: h * 0.80, color: '#f59e0b', size: 19 },
      { key: 'sector9', name: '🛸 Sector 9 (24h)', x: w * 0.95, y: h * 0.25, color: '#ff0055', size: 22 }
    ];

    const activeList = this.state.expeditions || [];

    destinations.forEach(dest => {
      // Find ALL active expeditions matching this target type
      const matchingExps = activeList.filter(e => {
        if (dest.key === 'asteroids' && e.type === 'asteroids') return true;
        if (dest.key === 'nebula' && e.type === 'nebula') return true;
        if ((dest.key === 'void' || dest.key === 'sector9') && (e.type === 'void' || e.type === 'sector9')) return true;
        return false;
      });

      if (matchingExps.length > 0) {
        matchingExps.forEach((activeExp, idx) => {
          this.ctx.save();
          // Add offset if multiple ships are going to the same destination type
          const offsetDist = matchingExps.length > 1 ? 40 : 0;
          const angleOffset = (Math.PI * 2 / matchingExps.length) * idx - (Math.PI / 4);
          const targetX = dest.x + Math.cos(angleOffset) * offsetDist;
          const targetY = dest.y + Math.sin(angleOffset) * offsetDist;

          const now = Date.now();
          const totalDur = activeExp.endTime - activeExp.startTime;
          const elapsed = Math.max(0, now - activeExp.startTime);
          const progress = Math.min(1.0, elapsed / Math.max(1, totalDur));
          const pct = Math.floor(progress * 100);

          // Active Glowing Trajectory Line from Outpost Hub to Target
          this.ctx.strokeStyle = dest.color;
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([5, 4]);
          this.ctx.beginPath();
          this.ctx.moveTo(baseX, baseY);
          this.ctx.lineTo(targetX, targetY);
          this.ctx.stroke();

          // Small Cruising Ship / Probe moving along trajectory
          const shipX = baseX + (targetX - baseX) * progress;
          const shipY = baseY + (targetY - baseY) * progress;
          const angle = Math.atan2(targetY - baseY, targetX - baseX);

          this.ctx.save();
          this.ctx.translate(shipX, shipY);
          this.ctx.rotate(angle);

          // Plasma Thruster Plume on small ship
          const flameLen = 8 + Math.sin(Date.now() / 40) * 4;
          this.ctx.fillStyle = '#ff007f';
          this.ctx.beginPath();
          this.ctx.moveTo(-8, -3);
          this.ctx.lineTo(-8 - flameLen, 0);
          this.ctx.lineTo(-8, 3);
          this.ctx.closePath();
          this.ctx.fill();

          // Small Starship Hull
          this.ctx.fillStyle = '#00ffff';
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.moveTo(10, 0);
          this.ctx.lineTo(-6, -7);
          this.ctx.lineTo(-3, 0);
          this.ctx.lineTo(-6, 7);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.restore();

          // Progress percentage badge floating above small ship
          this.ctx.fillStyle = 'rgba(5, 12, 28, 0.9)';
          this.ctx.strokeStyle = dest.color;
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.roundRect(shipX - 25, shipY - 22, 50, 15, 3);
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = 'bold 9px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText(`🛸 ${pct}%`, shipX, shipY - 14);

          // Active Target Node (Pulsing glowing planet/asteroid)
          this.ctx.fillStyle = dest.color;
          this.ctx.beginPath();
          this.ctx.arc(targetX, targetY, dest.size, 0, Math.PI * 2);
          this.ctx.fill();

          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 2;
          this.ctx.stroke();

          // Glowing Atmosphere Ring
          this.ctx.strokeStyle = dest.color;
          this.ctx.lineWidth = 2.5;
          this.ctx.beginPath();
          this.ctx.arc(targetX, targetY, dest.size + 5, 0, Math.PI * 2);
          this.ctx.stroke();

          // Destination Label
          this.ctx.fillStyle = '#ffffff';
          this.ctx.font = 'bold 9px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.fillText(activeExp.name || dest.name, targetX, targetY + dest.size + 14);
          this.ctx.restore();
        });
      } else {
        const targetX = dest.x;
        const targetY = dest.y;
        this.ctx.save();
        // Idle / Available Sector (Subtle dotted line & dim target node)
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([4, 6]);
        this.ctx.beginPath();
        this.ctx.moveTo(baseX, baseY);
        this.ctx.lineTo(targetX, targetY);
        this.ctx.stroke();

        // Idle Destination Node
        this.ctx.fillStyle = 'rgba(15, 25, 45, 0.7)';
        this.ctx.strokeStyle = dest.color;
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(targetX, targetY, dest.size - 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // Label
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.font = '9px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(dest.name, targetX, targetY + dest.size + 12);
        this.ctx.restore();
      }
    });

    this.ctx.restore();

    // Render Floating Loot Particles
    if (this.particles && this.particles.length > 0) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        let p = this.particles[i];
        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = Math.max(0, p.life);
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(p.text, p.x, p.y);
        p.y += p.vy;
        p.life -= 0.015; // fade out speed
        if (p.life <= 0) this.particles.splice(i, 1);
      }
      this.ctx.globalAlpha = 1.0;
    }
  }

  // --- UPGRADES (Max Level 50) ---

  upgrade(part) {
    const currentLvl = this.state[`${part}Level`];
    if (currentLvl >= 50) {
      if (window.triggerToast) window.triggerToast(`Maximum Level 50 already reached for ${part.toUpperCase()}!`, "error");
      return;
    }

    const costIron = Math.floor(40 * Math.pow(1.22, currentLvl - 1));
    const costTit = Math.floor(10 * Math.pow(1.22, currentLvl - 1));
    const costPgt = Math.floor(50 * Math.pow(1.22, currentLvl - 1));

    if (this.state.iron < costIron || this.state.titanium < costTit || (window.appState && window.appState.state.balancePgt < costPgt)) {
      if (window.triggerToast) window.triggerToast(`Requires ${costIron.toLocaleString()} Iron, ${costTit.toLocaleString()} Titanium & ${costPgt.toLocaleString()} PGT`, "error");
      return;
    }

    this.state.iron -= costIron;
    this.state.titanium -= costTit;
    this.state[`${part}Level`]++;

    if (window.appState) {
      const newBal = Math.max(0, (window.appState.state.balancePgt || 0) - costPgt);
      window.appState.update({ 
        balancePgt: newBal,
        spaceState: this.state
      });
    }

    this.saveSpaceState();

    if (window.triggerToast) window.triggerToast(`${part.toUpperCase()} Upgraded to Level ${this.state[`${part}Level`]}!`, "success");
    if (window.sfx && window.sfx.playPowerUp) window.sfx.playPowerUp();
  }

  // --- FRIENDLY OUTPOST POKE & RIVAL RAIDS ---

  async pokeFriendlyBase() {
    const todayStr = new Date().toISOString().split('T')[0];
    if (this.state.lastOpDate === todayStr) {
      if (window.triggerToast) window.triggerToast("Outpost Operation already launched today (1/day limit)! Resets at midnight.", "error");
      return;
    }

    this.state.lastOpDate = todayStr;

    const bonusIron = 20 * this.state.warpLevel;
    const bonusPgt = 20.0;

    this.state.iron += bonusIron;
    if (window.appState && window.creditArcadePayout) {
      window.creditArcadePayout(bonusPgt);
    }

    this.saveSpaceState();

    if (window.triggerToast) {
      window.triggerToast(`Poked Allied Outpost! Boosted their shield & gained +${bonusIron} Iron & +${bonusPgt} PGT!`, "success");
    }
    if (window.sfx && window.sfx.playSuccess) window.sfx.playSuccess();
  }

  async launchRaid() {
    const todayStr = new Date().toISOString().split('T')[0];
    if (this.state.lastOpDate === todayStr) {
      if (window.triggerToast) window.triggerToast("Outpost Operation already launched today (1/day limit)! Resets at midnight.", "error");
      return;
    }

    if (this.state.iron < 15) {
      if (window.triggerToast) window.triggerToast("Raid requires 15 Iron for Fuel!", "error");
      return;
    }

    this.state.iron -= 15;
    this.state.lastOpDate = todayStr;

    const enemyPower = Math.floor(80 + Math.random() * (this.state.fleetPower * 1.2));
    const win = this.state.fleetPower >= enemyPower;

    if (win) {
      this.state.raidsWon++;
      const stolenIron = Math.floor(25 + Math.random() * 25);
      const stolenTit = Math.floor(5 + Math.random() * 10);
      const stolenPgt = parseFloat((16 + Math.random() * 8).toFixed(2));

      this.state.iron += stolenIron;
      this.state.titanium += stolenTit;
      if (window.creditArcadePayout) {
        window.creditArcadePayout(stolenPgt);
      }

      this.saveSpaceState();
      if (window.triggerToast) window.triggerToast(`Raid Victory! Defeated Outpost (${enemyPower} Power) & Stole +${stolenIron} Iron, +${stolenTit} Titanium & +${stolenPgt} PGT!`, "success");
      if (window.sfx && window.sfx.playSuccess) window.sfx.playSuccess();
    } else {
      this.saveSpaceState();
      if (window.triggerToast) window.triggerToast(`Raid Failed! Enemy Defense Turrets (${enemyPower} Power) repelled your fleet!`, "error");
      if (window.sfx && window.sfx.playError) window.sfx.playError();
    }
  }
  async loadFleetPowerLeaderboard() {
    const listEl = document.getElementById('space-leaderboard-power');
    if (!listEl) return;

    const supabase = window.supabaseClient;
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from('users')
        .select('wallet_address, username, space_state')
        .not('space_state', 'is', null)
        .limit(100);

      if (data && !error) {
        const ranked = data
          .map(u => {
            const power = (u.space_state && typeof u.space_state.fleetPower === 'number') 
                          ? u.space_state.fleetPower 
                          : 100;
            const name = (u.username && u.username.trim().length > 0) 
                         ? u.username 
                         : (u.wallet_address.substring(0, 6) + '...' + u.wallet_address.substring(u.wallet_address.length - 4));
            return { name: name, power: power };
          })
          .sort((a, b) => b.power - a.power)
          .slice(0, 10);

        listEl.innerHTML = '';
        if (ranked.length === 0) {
          listEl.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:1rem;">No registered commanders yet. Upgrade your ship to claim #1!</div>';
          return;
        }

        ranked.forEach((player, idx) => {
          const badge = idx === 0 ? '🥇 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : `#${idx + 1} `;
          const div = document.createElement('div');
          div.style.display = 'flex';
          div.style.justifyContent = 'space-between';
          div.style.padding = '0.5rem';
          div.style.background = 'rgba(255,255,255,0.03)';
          div.style.borderRadius = '4px';
          div.style.fontSize = '0.85rem';

          div.innerHTML = `
            <span>${badge}<strong>${player.name}</strong></span>
            <strong style="color:var(--color-accent);">${player.power.toLocaleString()} Power</strong>
          `;
          listEl.appendChild(div);
        });
      }
    } catch (err) {
      console.error("Fleet leaderboard fetch error:", err);
    }
  }
}

// Global instance initialization
window.polySpace = new PolySpaceEngine();

window.initPolySpace = function() {
  window.polySpace.init();
  window.polySpace.loadFleetPowerLeaderboard();
};
window.startOfflineExpedition = function(type) {
  window.polySpace.startOfflineExpedition(type);
};
window.claimExpeditionLoot = function(id) {
  window.polySpace.claimExpeditionLoot(id);
};
window.upgradeSpacePart = function(part) {
  window.polySpace.upgrade(part);
  window.polySpace.loadFleetPowerLeaderboard();
};
window.pokeFriendlyBase = function() {
  window.polySpace.pokeFriendlyBase();
};
window.launchSpaceRaid = function() {
  window.polySpace.launchRaid();
};
