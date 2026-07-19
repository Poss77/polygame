/**
 * Cyber Invaders Mini-Game Engine (HTML5 Canvas)
 * A retro space shooter where players steer a defense ship, shoot laser cannons,
 * and destroy falling block invaders to earn pending PGT rewards.
 */

class CyberInvaders {
  constructor(canvasId, overlayId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.overlay = document.getElementById(overlayId);

    this.width = this.canvas.width;
    this.height = this.canvas.height;

    this.isPlaying = false;
    this.score = 0;
    this.lives = 1;
    this.level = 1;
    this.gameTime = 0;

    // Control keys
    this.keys = {
      a: false, d: false, ArrowLeft: false, ArrowRight: false, " ": false
    };

    // Entities
    this.player = null;
    this.bullets = [];
    this.invaders = [];
    this.particles = [];
    this.lastShotTime = 0;

    this.initEvents();
  }

  initEvents() {
    window.addEventListener('keydown', (e) => {
      if (this.keys.hasOwnProperty(e.key)) {
        this.keys[e.key] = true;
        if (e.key === " " && this.isPlaying) e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.keys.hasOwnProperty(e.key)) {
        this.keys[e.key] = false;
      }
    });

    const startBtn = document.getElementById('btn-start-invaders');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startGame());
    }
  }

  startGame() {
    sfx.init();

    this.isPlaying = true;
    this.score = 0;
    this.lives = 1;
    this.level = 1;
    this.gameTime = 0;
    this.bullets = [];
    this.particles = [];
    this.invaders = [];

    // Hide menu overlay
    this.overlay.style.display = 'none';

    // Player Ship config
    this.player = {
      x: this.width / 2 - 15,
      y: this.height - 35,
      w: 30,
      h: 15,
      speed: 6.0
    };

    // Spawn initial grid of invaders (8 cols, 3 rows)
    this.spawnInvadersGrid();

    // Reset scores
    this.score = 0;
    this.lives = 1;
    document.getElementById('invaders-live-score').innerText = '0';
    document.getElementById('invaders-live-lives').innerText = '1';
    document.getElementById('invaders-live-earned').innerText = '0.00';

    // Hook NFT multiplier boost
    const multis = appState.getMultipliers();
    const multiplier = 1 + (multis.nftGameMultiplier / 100);
    document.getElementById('invaders-nft-boost-label').innerText = `${multiplier.toFixed(1)}x`;

    this.loop();
  }

  spawnInvadersGrid() {
    const cols = 8;
    const rows = 3;
    const invWidth = 30;
    const invHeight = 15;
    const spacingX = 20;
    const spacingY = 15;
    const startX = (this.width - (cols * (invWidth + spacingX) - spacingX)) / 2;
    const startY = 30;
    
    // Base speed + 0.5 per level
    const speedX = 1.0 + ((this.level - 1) * 0.5);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.invaders.push({
          x: startX + c * (invWidth + spacingX),
          y: startY + r * (invHeight + spacingY),
          w: invWidth,
          h: invHeight,
          vx: speedX,
          color: r === 0 ? '#ff0055' : (r === 1 ? '#bd00ff' : '#00f0ff')
        });
      }
    }
  }

  gameOver() {
    this.isPlaying = false;
    sfx.playExplosion();

    const multis = appState.getMultipliers();
    const multiplier = 1 + (multis.nftGameMultiplier / 100);
    const rawPgt = this.score * 5.0; // 5 PGT per alien hit
    const finalPgt = rawPgt * multiplier;

    const stateUpdates = {
      balancePgt: appState.state.balancePgt + finalPgt
    };

    let newHighScoreStr = "";
    if (this.score > (appState.state.invadersHighScore || 0)) {
      stateUpdates.invadersHighScore = this.score;
      newHighScoreStr = `<br><strong style="color:var(--color-warning);">NEW HIGH SCORE!</strong>`;
    }

    // Add directly to onsite balance
    appState.update(stateUpdates);

    appState.addActivity('You', `blasted ${this.score} Cyber Invaders`, `+${finalPgt.toFixed(2)} PGT`);

    const title = document.getElementById('invaders-overlay-title');
    const desc = document.getElementById('invaders-overlay-desc');
    const playBtn = document.getElementById('btn-start-invaders');

    title.innerText = "DEFENSE SHIELD FAILURE";
    title.style.color = "var(--color-danger)";

    desc.innerHTML = `
      Aliens Blasted: <strong style="color:var(--color-primary);">${this.score}</strong>${newHighScoreStr}<br>
      Onsite Payout Credited: <strong style="color:var(--color-accent);">+${finalPgt.toFixed(2)} PGT</strong>
      <span style="font-size:0.8rem; color:var(--text-dim);">(incl. ${multis.nftGameMultiplier}% NFT multiplier)</span>
    `;

    playBtn.innerText = "Reboot Cannons";
    this.overlay.style.display = 'flex';
  }

  loop() {
    if (!this.isPlaying) return;

    this.update();
    this.draw();

    requestAnimationFrame(() => this.loop());
  }

  update() {
    this.gameTime++;

    // 1. Move Player
    const dx = (this.keys.a || this.keys.ArrowLeft ? -1 : 0) + (this.keys.d || this.keys.ArrowRight ? 1 : 0);
    if (this.player) {
      this.player.x += dx * this.player.speed;
      // Boundaries
      if (this.player.x < 10) this.player.x = 10;
      if (this.player.x > this.width - this.player.w - 10) this.player.x = this.width - this.player.w - 10;
    }

    // 2. Fire Laser Bullet
    if (this.keys[" "] && this.gameTime - this.lastShotTime > 25) {
      this.bullets.push({
        x: this.player.x + this.player.w / 2 - 2,
        y: this.player.y - 10,
        w: 4,
        h: 10,
        vy: -7.0
      });
      this.lastShotTime = this.gameTime;
      sfx.playRoshamboDrum(); // quick bass tick for shoot
    }

    // 3. Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.y += b.vy;
      if (b.y < 0) {
        this.bullets.splice(i, 1);
      }
    }

    // 4. Update Invaders Grid
    let shiftDown = false;
    let invDirection = 0;

    for (const inv of this.invaders) {
      inv.x += inv.vx;
      // Check wall bounce
      if (inv.x < 10 || inv.x > this.width - inv.w - 10) {
        shiftDown = true;
        invDirection = -inv.vx;
      }
    }

    if (shiftDown) {
      for (const inv of this.invaders) {
        inv.y += 12; // shift down
        inv.vx = invDirection; // reverse speed
        // If invaders reach ship height -> game over!
        if (inv.y > this.player.y - 10) {
          this.lives = 0;
        }
      }
    }

    // Spawn new waves if all destroyed
    if (this.invaders.length === 0) {
      this.level++;
      this.spawnInvadersGrid();
    }

    // 5. Collisions (Bullet vs Invader)
    for (let bIdx = this.bullets.length - 1; bIdx >= 0; bIdx--) {
      const b = this.bullets[bIdx];
      for (let invIdx = this.invaders.length - 1; invIdx >= 0; invIdx--) {
        const inv = this.invaders[invIdx];

        if (
          b.x < inv.x + inv.w &&
          b.x + b.w > inv.x &&
          b.y < inv.y + inv.h &&
          b.y + b.h > inv.y
        ) {
          // Explode particles
          this.spawnExplosionParticles(inv.x + inv.w / 2, inv.y + inv.h / 2, inv.color);
          
          this.invaders.splice(invIdx, 1);
          this.bullets.splice(bIdx, 1);
          
          this.score++;
          document.getElementById('invaders-live-score').innerText = this.score;

          // Update live PGT earned
          const multis = appState.getMultipliers();
          const multiplier = 1 + (multis.nftGameMultiplier / 100);
          const livePgt = this.score * 5.0 * multiplier;
          document.getElementById('invaders-live-earned').innerText = livePgt.toFixed(2);
          
          break;
        }
      }
    }

    // 6. Update Particles
    for (let pIdx = this.particles.length - 1; pIdx >= 0; pIdx--) {
      const p = this.particles[pIdx];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.04;
      if (p.alpha <= 0) {
        this.particles.splice(pIdx, 1);
      }
    }

    // 7. Check Game Over
    if (this.lives <= 0) {
      this.gameOver();
    }
  }

  spawnExplosionParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 2.0;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color,
        alpha: 1.0
      });
    }
  }

  draw() {
    // Clear canvas
    this.ctx.fillStyle = '#06080c';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Grid details
    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.02)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }

    // Draw Ship (Player)
    if (this.player) {
      this.ctx.fillStyle = 'var(--color-primary)';
      this.ctx.shadowColor = 'var(--color-primary)';
      this.ctx.shadowBlur = 10;
      this.ctx.fillRect(this.player.x, this.player.y, this.player.w, this.player.h);

      // Ship turret details
      this.ctx.fillRect(this.player.x + this.player.w / 2 - 3, this.player.y - 6, 6, 6);
    }

    // Draw Bullets
    this.ctx.fillStyle = 'var(--color-accent)';
    this.ctx.shadowColor = 'var(--color-accent)';
    this.ctx.shadowBlur = 8;
    for (const b of this.bullets) {
      this.ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    // Draw Invaders
    for (const inv of this.invaders) {
      this.ctx.fillStyle = inv.color;
      this.ctx.shadowColor = inv.color;
      this.ctx.shadowBlur = 8;
      this.ctx.fillRect(inv.x, inv.y, inv.w, inv.h);

      // Neon core highlight
      this.ctx.fillStyle = '#fff';
      this.ctx.fillRect(inv.x + 4, inv.y + 4, inv.w - 8, inv.h - 8);
    }

    // Draw Particles
    this.ctx.shadowBlur = 4;
    for (const p of this.particles) {
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillRect(p.x, p.y, 3, 3);
    }
    this.ctx.globalAlpha = 1.0; // Reset
    this.ctx.shadowBlur = 0; // Reset
  }
}

// Global hook instantiator
let invadersEngine = null;
window.startInvadersGame = function() {
  if (!invadersEngine) {
    invadersEngine = new CyberInvaders('invaders-canvas', 'invaders-ui-overlay');
  }
  invadersEngine.startGame();
};
window.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('btn-start-invaders');
  if (startBtn) {
    startBtn.addEventListener('click', startInvadersGame);
  }
});
