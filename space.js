// ============================================================
// POLYSPACE: PLANETARY MINING & BASE RAIDS SIMULATION ENGINE
// ============================================================

class PolySpaceEngine {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.animationId = null;
    this.isMiningActive = false;

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

      activeExpedition: null, // { type, name, startTime, endTime }

      pokesToday: 0,
      lastPokeDate: null,
      raidsWon: 0,
      mineralsMinedTotal: 0
    };

    // Active Interactive Manual Expedition State
    this.activeExpedition = null;
    this.expeditionTimer = 0;
    this.asteroids = [];
    this.shipX = 0;
    this.shipTargetX = 0;
    this.laserShots = [];
    this.minedInRun = { iron: 0, titanium: 0, quantum: 0, pgtOre: 0 };

    this.bindEvents();
    
    // Auto-update countdown timer every second
    setInterval(() => this.updateUI(), 1000);
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

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (!this.isMiningActive) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') this.shipTargetX -= 0.08;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.shipTargetX += 0.08;
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') this.fireMiningLaser();
    });

    const btnLeft = document.getElementById('space-btn-left');
    const btnRight = document.getElementById('space-btn-right');
    const btnFire = document.getElementById('space-btn-fire');

    if (btnLeft) {
      btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); this.shipTargetX -= 0.1; });
      btnLeft.addEventListener('mousedown', () => { this.shipTargetX -= 0.1; });
    }
    if (btnRight) {
      btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); this.shipTargetX += 0.1; });
      btnRight.addEventListener('mousedown', () => { this.shipTargetX += 0.1; });
    }
    if (btnFire) {
      btnFire.addEventListener('touchstart', (e) => { e.preventDefault(); this.fireMiningLaser(); });
      btnFire.addEventListener('mousedown', () => { this.fireMiningLaser(); });
    }
  }

  loadSpaceState() {
    if (window.appState && window.appState.state && window.appState.state.spaceState) {
      this.state = { ...this.state, ...window.appState.state.spaceState };
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
      else warpBonus.innerText = `Current: Unlocks Void (8h) (+${(this.state.warpLevel - 3) * 5}% Speed)`;
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
      const laserPct = Math.round((this.state.laserLevel - 1) * 15);
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
      cargoBonus.innerText = `Current: +${cargoPct}% Cargo Capacity`;
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

    // Update Hangar Expedition Status
    const statusContainer = document.getElementById('space-expedition-status-box');
    if (!statusContainer) return;

    if (this.state.activeExpedition) {
      const exp = this.state.activeExpedition;
      const now = Date.now();

      if (now >= exp.endTime) {
        // Expedition Finished - Ready to Claim!
        statusContainer.innerHTML = `
          <div style="background: rgba(0, 255, 102, 0.1); border: 1px solid var(--color-success); border-radius: 8px; padding: 1rem; text-align: center;">
            <h4 style="color: var(--color-success); margin-bottom: 0.5rem;">🎉 Expedition Returned from ${exp.name}!</h4>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">Your mining starship has returned safely with harvested minerals & PGT!</p>
            <button class="btn-primary" onclick="claimExpeditionLoot()" style="background: var(--color-success); color: #000; font-weight: 800; font-size: 1rem; padding: 0.75rem 2rem;">🎁 CLAIM EXPEDITION LOOT</button>
          </div>
        `;
      } else {
        // Expedition In Progress (Offline Timer)
        const totalSecs = Math.ceil((exp.endTime - now) / 1000);
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        const timeStr = `${hrs > 0 ? hrs + 'h ' : ''}${mins}m ${secs < 10 ? '0' : ''}${secs}s`;

        statusContainer.innerHTML = `
          <div style="background: rgba(0, 240, 255, 0.1); border: 1px solid var(--color-accent); border-radius: 8px; padding: 1rem; text-align: center;">
            <h4 style="color: var(--color-accent); margin-bottom: 0.25rem;">🛸 Mining Expedition En Route...</h4>
            <div style="font-size: 1.5rem; font-weight: 900; color: var(--color-warning); margin: 0.5rem 0;">${timeStr}</div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Mining ${exp.name}. You can safely log off, close the browser, and return when the timer completes!</p>
          </div>
        `;
      }
    } else {
      // No Active Expedition - Render Select Buttons
      statusContainer.innerHTML = `
        <h4 style="color: #fff; font-size: 1.2rem; margin-bottom: 0.5rem;">Select Mining Destination</h4>
        <p style="color: var(--text-muted); font-size: 0.85rem; max-width: 500px; margin-bottom: 1.25rem;">Dispatch your mining starship on an automated expedition. You can log off and close the tab while your ship mines!</p>
        
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: center;">
          <button class="btn-primary" onclick="startOfflineExpedition('asteroids')" style="background: var(--color-primary); color: #000; font-weight: 700; padding: 0.65rem 1rem; font-size:0.85rem;">🪨 Asteroids (15 mins)</button>
          <button class="btn-primary" onclick="startOfflineExpedition('nebula')" style="background: var(--color-accent); color: #000; font-weight: 700; padding: 0.65rem 1rem; font-size:0.85rem;">🪐 Nebula (2 hrs)</button>
          <button class="btn-primary" onclick="startOfflineExpedition('void')" style="background: #ff00ff; color: #fff; font-weight: 700; padding: 0.65rem 1rem; font-size:0.85rem;">🌌 Void Exoplanet (8 hrs)</button>
        </div>
      `;
    }
  }

  // --- PASSIVE OFFLINE EXPEDITIONS ---

  startOfflineExpedition(destinationType) {
    if (this.state.activeExpedition) {
      if (window.triggerToast) window.triggerToast("An expedition is already in progress!", "error");
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
    }

    const startTime = Date.now();
    const endTime = startTime + durationMs;

    this.state.activeExpedition = {
      type: destinationType,
      name: name,
      startTime: startTime,
      endTime: endTime
    };

    this.saveSpaceState();
    if (window.triggerToast) window.triggerToast(`Launched Starship to ${name}! You can close the tab!`, "success");
  }

  claimExpeditionLoot() {
    if (!this.state.activeExpedition) return;

    if (Date.now() < this.state.activeExpedition.endTime) {
      if (window.triggerToast) window.triggerToast("Expedition is still in progress!", "error");
      return;
    }

    const exp = this.state.activeExpedition;
    let earnedIron = 0;
    let earnedTit = 0;
    let earnedQuant = 0;
    let earnedPgt = 0;

    const cargoMult = (1 + (this.state.cargoLevel - 1) * 0.25);
    const laserMult = (1 + (this.state.laserLevel - 1) * 0.15);

    if (exp.type === 'asteroids') {
      earnedIron = Math.floor(40 * cargoMult);
      earnedPgt = 15.0 * laserMult;
    } else if (exp.type === 'nebula') {
      earnedIron = Math.floor(120 * cargoMult);
      earnedTit = Math.floor(40 * cargoMult);
      earnedPgt = 50.0 * laserMult;
    } else if (exp.type === 'void') {
      earnedIron = Math.floor(300 * cargoMult);
      earnedTit = Math.floor(100 * cargoMult);
      earnedQuant = Math.floor(25 * cargoMult);
      earnedPgt = 150.0 * laserMult;
    }

    const multis = window.appState ? window.appState.getMultipliers() : null;
    if (multis && multis.nftGameMultiplier) {
      earnedPgt *= (1 + (multis.nftGameMultiplier / 100));
    }
    if (window.appState && window.appState.isVipActive && window.appState.isVipActive()) {
      earnedPgt *= 2;
    }
    earnedPgt = parseFloat(earnedPgt.toFixed(2));

    this.state.iron += earnedIron;
    this.state.titanium += earnedTit;
    this.state.quantum += earnedQuant;
    this.state.activeExpedition = null;

    if (earnedPgt > 0 && window.creditArcadePayout) {
      window.creditArcadePayout(earnedPgt);
    }

    this.saveSpaceState();
    if (window.triggerToast) window.triggerToast(`Expedition Loot Claimed! +${earnedIron} Iron, +${earnedTit} Titanium & +${earnedPgt} PGT!`, "success");
    if (window.sfx && window.sfx.playSuccess) window.sfx.playSuccess();
  }

  // --- RENDERING ---

  renderHangarView() {
    const w = this.width;
    const h = this.height;
    if (!this.ctx) return;

    this.ctx.clearRect(0, 0, w, h);
    this.ctx.fillStyle = '#050a14';
    this.ctx.fillRect(0, 0, w, h);

    const grad = this.ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, 250);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.15)');
    grad.addColorStop(1, 'rgba(5, 10, 20, 0.0)');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);

    const px = w / 2;
    const py = h / 2 - 10;

    this.ctx.save();
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 20;

    this.ctx.beginPath();
    this.ctx.moveTo(px, py - 50);
    this.ctx.lineTo(px - 45, py + 40);
    this.ctx.lineTo(px - 15, py + 25);
    this.ctx.lineTo(px + 15, py + 25);
    this.ctx.lineTo(px + 45, py + 40);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  // --- UPGRADES (Max Level 50 with Exponential Scaling) ---

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
    if (window.appState) {
      window.appState.update({ balancePgt: window.appState.state.balancePgt - costPgt });
    }

    this.state[`${part}Level`]++;
    this.saveSpaceState();

    if (window.triggerToast) window.triggerToast(`${part.toUpperCase()} Upgraded to Level ${this.state[`${part}Level`]}!`, "success");
    if (window.sfx && window.sfx.playPowerUp) window.sfx.playPowerUp();
  }

  // --- FRIENDLY OUTPOST POKE & RIVAL RAIDS (1 Operation Per Day Limit) ---

  async pokeFriendlyBase() {
    const todayStr = new Date().toISOString().split('T')[0];
    if (this.state.lastOpDate === todayStr) {
      if (window.triggerToast) window.triggerToast("Outpost Operation already launched today (1/day limit)! Resets at midnight.", "error");
      return;
    }

    this.state.lastOpDate = todayStr;

    const bonusIron = 20 * this.state.warpLevel;
    const bonusPgt = 20.0; // ~20 PGT average (below main Faucet)

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
      const stolenPgt = parseFloat((16 + Math.random() * 8).toFixed(2)); // 16 to 24 PGT (~20 PGT average)

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
}

// Global instance initialization
window.polySpace = new PolySpaceEngine();

window.initPolySpace = function() {
  window.polySpace.init();
};
window.startOfflineExpedition = function(type) {
  window.polySpace.startOfflineExpedition(type);
};
window.claimExpeditionLoot = function() {
  window.polySpace.claimExpeditionLoot();
};
window.upgradeSpacePart = function(part) {
  window.polySpace.upgrade(part);
};
window.pokeFriendlyBase = function() {
  window.polySpace.pokeFriendlyBase();
};
window.launchSpaceRaid = function() {
  window.polySpace.launchRaid();
};
