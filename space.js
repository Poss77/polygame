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

      pokesToday: 0,
      lastPokeDate: null,
      raidsWon: 0,
      mineralsMinedTotal: 0
    };

    // Active Expedition State
    this.activeExpedition = null;
    this.expeditionTimer = 0;
    this.asteroids = [];
    this.shipX = 0;
    this.shipTargetX = 0;
    this.laserShots = [];
    this.minedInRun = { iron: 0, titanium: 0, quantum: 0, pgtOre: 0 };

    this.bindEvents();
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

    // Touch controls for active mining
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

    // Update upgrade level displays
    const warpLvl = document.getElementById('space-lvl-warp');
    const laserLvl = document.getElementById('space-lvl-laser');
    const cargoLvl = document.getElementById('space-lvl-cargo');
    const shieldLvl = document.getElementById('space-lvl-shield');
    const turretLvl = document.getElementById('space-lvl-turret');

    if (warpLvl) warpLvl.innerText = `Lvl ${this.state.warpLevel}`;
    if (laserLvl) laserLvl.innerText = `Lvl ${this.state.laserLevel}`;
    if (cargoLvl) cargoLvl.innerText = `Lvl ${this.state.cargoLevel}`;
    if (shieldLvl) shieldLvl.innerText = `Lvl ${this.state.shieldLevel}`;
    if (turretLvl) turretLvl.innerText = `Lvl ${this.state.turretLevel}`;
  }

  // --- EXPEDITIONS (Stay Logged In Active Interactive Runs) ---

  startExpedition(destinationType) {
    let durationSeconds = 60;
    let name = "Alpha Asteroid Belt";

    if (destinationType === 'nebula') {
      if (this.state.warpLevel < 2) {
        if (window.triggerToast) window.triggerToast("Requires Warp Drive Lvl 2!", "error");
        return;
      }
      durationSeconds = 180; // 3 mins
      name = "Neon Nebula";
    } else if (destinationType === 'void') {
      if (this.state.warpLevel < 3) {
        if (window.triggerToast) window.triggerToast("Requires Warp Drive Lvl 3!", "error");
        return;
      }
      durationSeconds = 300; // 5 mins
      name = "Deep Void Exoplanet";
    }

    this.activeExpedition = {
      type: destinationType,
      name: name,
      duration: durationSeconds,
      timeLeft: durationSeconds
    };

    this.isMiningActive = true;
    this.minedInRun = { iron: 0, titanium: 0, quantum: 0, pgtOre: 0 };
    this.shipX = 0;
    this.shipTargetX = 0;
    this.asteroids = [];
    this.laserShots = [];

    document.getElementById('space-hangar-overlay').style.display = 'none';
    document.getElementById('space-expedition-overlay').style.display = 'flex';
    document.getElementById('space-mining-hud').style.display = 'flex';

    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.loopMining();
  }

  fireMiningLaser() {
    if (!this.isMiningActive) return;
    const px = this.width / 2 + this.shipX * (this.width * 0.4);
    this.laserShots.push({ x: px, y: this.height - 50, speed: 12 });
    if (window.sfx && window.sfx.playLaser) window.sfx.playLaser();
  }

  loopMining() {
    if (!this.isMiningActive) return;

    this.updateMining();
    this.renderMining();

    this.animationId = requestAnimationFrame(() => this.loopMining());
  }

  updateMining() {
    this.activeExpedition.timeLeft -= (1 / 60);

    const timerEl = document.getElementById('space-exp-timer');
    if (timerEl) {
      const mins = Math.floor(Math.max(0, this.activeExpedition.timeLeft) / 60);
      const secs = Math.floor(Math.max(0, this.activeExpedition.timeLeft) % 60);
      timerEl.innerText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    if (this.activeExpedition.timeLeft <= 0) {
      this.completeExpedition();
      return;
    }

    // Move Ship
    this.shipTargetX = Math.max(-0.85, Math.min(0.85, this.shipTargetX));
    this.shipX += (this.shipTargetX - this.shipX) * 0.2;

    // Move Lasers
    for (let i = this.laserShots.length - 1; i >= 0; i--) {
      let shot = this.laserShots[i];
      shot.y -= shot.speed;
      if (shot.y < 0) this.laserShots.splice(i, 1);
    }

    // Spawn Ore Asteroids
    if (Math.random() < 0.04) {
      let oreType = 'iron';
      const rand = Math.random();
      if (this.activeExpedition.type === 'nebula') {
        if (rand < 0.3) oreType = 'titanium';
        else if (rand < 0.5) oreType = 'pgtOre';
      } else if (this.activeExpedition.type === 'void') {
        if (rand < 0.25) oreType = 'quantum';
        else if (rand < 0.5) oreType = 'pgtOre';
        else if (rand < 0.75) oreType = 'titanium';
      } else {
        if (rand < 0.2) oreType = 'pgtOre';
      }

      this.asteroids.push({
        x: (Math.random() - 0.5) * 1.5,
        y: -30,
        speed: 1.5 + Math.random() * 2,
        size: 15 + Math.random() * 15,
        hp: Math.ceil(1 + Math.random() * 2),
        type: oreType
      });
    }

    // Update Asteroids & Laser Collisions
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      let ast = this.asteroids[i];
      ast.y += ast.speed;
      const ax = this.width / 2 + ast.x * (this.width * 0.4);

      // Collision with Lasers
      for (let j = this.laserShots.length - 1; j >= 0; j--) {
        let shot = this.laserShots[j];
        const dist = Math.hypot(shot.x - ax, shot.y - ast.y);
        if (dist < ast.size + 5) {
          ast.hp -= (this.state.laserLevel);
          this.laserShots.splice(j, 1);
          if (ast.hp <= 0) {
            // Mine Harvested!
            const amount = Math.floor((1 + Math.random() * 2) * (this.state.cargoLevel * 0.8));
            this.minedInRun[ast.type] += amount;
            this.asteroids.splice(i, 1);
            if (window.sfx && window.sfx.playCoin) window.sfx.playCoin();
            break;
          }
        }
      }

      if (ast.y > this.height + 40) this.asteroids.splice(i, 1);
    }

    // Update HUD harvested totals
    const hudIron = document.getElementById('space-run-iron');
    const hudTit = document.getElementById('space-run-titanium');
    const hudQuant = document.getElementById('space-run-quantum');
    const hudPgt = document.getElementById('space-run-pgtore');

    if (hudIron) hudIron.innerText = this.minedInRun.iron;
    if (hudTit) hudTit.innerText = this.minedInRun.titanium;
    if (hudQuant) hudQuant.innerText = this.minedInRun.quantum;
    if (hudPgt) hudPgt.innerText = this.minedInRun.pgtOre;
  }

  completeExpedition() {
    this.isMiningActive = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);

    // Apply mined loot to state
    this.state.iron += this.minedInRun.iron;
    this.state.titanium += this.minedInRun.titanium;
    this.state.quantum += this.minedInRun.quantum;
    this.state.pgtOre += this.minedInRun.pgtOre;

    const totalMined = this.minedInRun.iron + this.minedInRun.titanium + this.minedInRun.quantum + (this.minedInRun.pgtOre * 5);
    this.state.mineralsMinedTotal += totalMined;

    // Direct PGT payout (Convert PGT Ore into live PGT balance)
    let pgtPayout = (this.minedInRun.pgtOre * 0.5);
    const multis = window.appState ? window.appState.getMultipliers() : null;
    if (multis && multis.nftGameMultiplier) {
      pgtPayout *= (1 + (multis.nftGameMultiplier / 100));
    }
    if (window.appState && window.appState.isVipActive && window.appState.isVipActive()) {
      pgtPayout *= 2;
    }
    pgtPayout = parseFloat(pgtPayout.toFixed(2));

    if (pgtPayout > 0 && window.creditArcadePayout) {
      window.creditArcadePayout(pgtPayout);
    }

    this.saveSpaceState();

    document.getElementById('space-expedition-overlay').style.display = 'none';
    document.getElementById('space-hangar-overlay').style.display = 'flex';
    document.getElementById('space-mining-hud').style.display = 'none';

    if (window.triggerToast) {
      window.triggerToast(`Expedition Complete! Harvested Ore & +${pgtPayout} PGT!`, "success");
    }

    this.renderHangarView();
  }

  renderMining() {
    const w = this.width;
    const h = this.height;

    this.ctx.clearRect(0, 0, w, h);

    // Background Space Grid
    this.ctx.fillStyle = '#03050c';
    this.ctx.fillRect(0, 0, w, h);

    // Render Lasers
    this.ctx.strokeStyle = '#00f0ff';
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 10;
    this.laserShots.forEach(shot => {
      this.ctx.beginPath();
      this.ctx.moveTo(shot.x, shot.y);
      this.ctx.lineTo(shot.x, shot.y - 15);
      this.ctx.stroke();
    });

    // Render Asteroids
    this.asteroids.forEach(ast => {
      const ax = w / 2 + ast.x * (w * 0.4);
      this.ctx.save();
      let color = '#8a99ad';
      if (ast.type === 'titanium') color = '#ff00ff';
      if (ast.type === 'quantum') color = '#ffaa00';
      if (ast.type === 'pgtOre') color = '#00f0ff';

      this.ctx.fillStyle = color;
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 10;
      this.ctx.beginPath();
      this.ctx.arc(ax, ast.y, ast.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // Render Player Starship
    const px = w / 2 + this.shipX * (w * 0.4);
    const py = h - 40;

    this.ctx.save();
    this.ctx.fillStyle = '#00f0ff';
    this.ctx.shadowColor = '#00f0ff';
    this.ctx.shadowBlur = 15;
    this.ctx.beginPath();
    this.ctx.moveTo(px, py - 20);
    this.ctx.lineTo(px - 20, py + 15);
    this.ctx.lineTo(px + 20, py + 15);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }

  renderHangarView() {
    const w = this.width;
    const h = this.height;
    if (!this.ctx) return;

    this.ctx.clearRect(0, 0, w, h);
    this.ctx.fillStyle = '#050a14';
    this.ctx.fillRect(0, 0, w, h);

    // Hangar Platform Glow
    const grad = this.ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, 250);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.15)');
    grad.addColorStop(1, 'rgba(5, 10, 20, 0.0)');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, w, h);

    // Render Starship Schematic
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

  // --- UPGRADES ---

  upgrade(part) {
    let costIron = 0;
    let costTit = 0;
    let costPgt = 0;

    const currentLvl = this.state[`${part}Level`];
    costIron = currentLvl * 40;
    costTit = currentLvl * 10;
    costPgt = currentLvl * 50;

    if (this.state.iron < costIron || this.state.titanium < costTit || (window.appState && window.appState.state.balancePgt < costPgt)) {
      if (window.triggerToast) window.triggerToast(`Requires ${costIron} Iron, ${costTit} Titanium & ${costPgt} PGT`, "error");
      return;
    }

    // Deduct resources
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

  // --- FRIENDLY OUTPOST POKE & RIVAL RAIDS ---

  async pokeFriendlyBase() {
    const todayStr = new Date().toISOString().split('T')[0];
    if (this.state.lastPokeDate === todayStr && this.state.pokesToday >= 3) {
      if (window.triggerToast) window.triggerToast("Daily friendly pokes maxed (3/3 today)!", "error");
      return;
    }

    this.state.lastPokeDate = todayStr;
    this.state.pokesToday = (this.state.pokesToday || 0) + 1;

    const bonusIron = 20 * this.state.warpLevel;
    const bonusPgt = 25.0;

    this.state.iron += bonusIron;
    if (window.appState) {
      window.appState.update({ balancePgt: window.appState.state.balancePgt + bonusPgt });
    }

    this.saveSpaceState();

    if (window.triggerToast) {
      window.triggerToast(`Poked Allied Outpost! Boosted their shield & gained +${bonusIron} Iron & +${bonusPgt} PGT!`, "success");
    }
    if (window.sfx && window.sfx.playSuccess) window.sfx.playSuccess();
  }

  async launchRaid() {
    if (this.state.iron < 15) {
      if (window.triggerToast) window.triggerToast("Raid requires 15 Iron for Fuel!", "error");
      return;
    }

    this.state.iron -= 15;

    // Simulate Enemy Defense Power
    const enemyPower = Math.floor(80 + Math.random() * (this.state.fleetPower * 1.2));
    const win = this.state.fleetPower >= enemyPower;

    if (win) {
      this.state.raidsWon++;
      const stolenIron = Math.floor(30 + Math.random() * 40);
      const stolenTit = Math.floor(5 + Math.random() * 15);
      const stolenPgt = parseFloat((15 + Math.random() * 35).toFixed(2));

      this.state.iron += stolenIron;
      this.state.titanium += stolenTit;
      if (window.appState) {
        window.appState.update({ balancePgt: window.appState.state.balancePgt + stolenPgt });
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
window.startSpaceExpedition = function(type) {
  window.polySpace.startExpedition(type);
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
