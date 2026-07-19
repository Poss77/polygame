/**
 * Astro-Dodge Mini-Game Engine (HTML5 Canvas)
 * A retro-neon arcade game where players guide a neon ship,
 * collect energy shards, and dodge obstacle mine gates to earn PGT.
 */

class NeonAstroDodge {
  constructor(canvasId, overlayId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.overlay = document.getElementById(overlayId);
    
    // Canvas dimensions
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    // Game state variables
    this.isPlaying = false;
    this.score = 0;
    this.shardsCollected = 0;
    this.difficulty = 1;
    this.gameTime = 0;
    
    // Key binds state
    this.keys = {
      w: false, s: false, a: false, d: false,
      ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
    };

    // Game Entities
    this.player = null;
    this.obstacles = [];
    this.collectibles = [];
    this.particles = [];
    this.powerups = [];

    this.initEvents();
  }

  initEvents() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      if (this.keys.hasOwnProperty(e.key)) {
        this.keys[e.key] = true;
        // Prevent scrolling with arrows/space
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key) && this.isPlaying) {
          e.preventDefault();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.keys.hasOwnProperty(e.key)) {
        this.keys[e.key] = false;
      }
    });

    // Touch inputs (for mobile support)
    let touchStartY = 0;
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (!this.isPlaying || e.touches.length === 0) return;
      e.preventDefault();
      
      const touchY = e.touches[0].clientY;
      const diffY = touchY - touchStartY;
      
      // Move player ship relative to drag speed
      if (this.player) {
        this.player.y += diffY * 0.8;
        // Keep in bounds
        if (this.player.y < this.player.radius) this.player.y = this.player.radius;
        if (this.player.y > this.height - this.player.radius) this.player.y = this.height - this.player.radius;
      }
      
      touchStartY = touchY;
    }, { passive: false });

    // Click handler to launch game
    const startBtn = document.getElementById('btn-start-game');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startGame());
    }
  }

  startGame() {
    sfx.init();
    
    // Reset state
    this.isPlaying = true;
    this.score = 0;
    this.shardsCollected = 0;
    this.difficulty = 1;
    this.gameTime = 0;
    this.obstacles = [];
    this.collectibles = [];
    this.particles = [];
    this.powerups = [];

    // Initialize Neon Ship
    this.player = {
      x: 80,
      y: this.height / 2,
      radius: 12,
      speed: 5.5,
      shield: false,
      shieldTime: 0,
      glowPulse: 0
    };

    // Hide UI Overlay
    this.overlay.classList.add('hidden');
    
    // Draw initial feedback
    document.getElementById('game-live-score').innerText = '0';
    document.getElementById('game-live-shards').innerText = '0';
    document.getElementById('game-live-earned').innerText = '0.00';

    // Hook multiplier display
    const multis = appState.getMultipliers();
    const multiplier = 1 + (multis.nftGameMultiplier / 100);
    document.getElementById('game-nft-boost-label').innerText = `${multiplier.toFixed(1)}x`;

    // Trigger game loop
    this.loop();
  }

  gameOver() {
    this.isPlaying = false;
    
    sfx.playExplosion();
    
    // Calculate rewards
    // Base score reward: 1 PGT per 200 points
    // Shards reward: 2 PGT per shard
    const multis = appState.getMultipliers();
    const multiplier = 1 + (multis.nftGameMultiplier / 100);
    
    const rawPgt = (this.score / 200) + (this.shardsCollected * 2);
    let finalPgt = rawPgt * multiplier;
    if (appState.isVipActive()) finalPgt *= 2;

    // Save state
    const currentHigh = appState.state.gameHighScore;
    const isNewHigh = this.score > currentHigh;
    if (isNewHigh) {
      appState.update({ gameHighScore: this.score });
      setupLeaderboardUI(); // Update leaderboard view
    }

    // Award PGT directly to the onsite balance
    appState.update({
      balancePgt: appState.state.balancePgt + finalPgt
    });
    window.recordGameMetrics('AstroDodge', 0, finalPgt);

    // Write to Activity Feed
    appState.addActivity('You', `scored ${this.score} on Astro-Dodge`, `+${finalPgt.toFixed(2)} PGT`);

    // Render Overlay text
    const title = document.getElementById('game-overlay-title');
    const desc = document.getElementById('game-overlay-desc');
    const playBtn = document.getElementById('btn-start-game');

    title.innerText = "STARSHIP CRASHED";
    title.style.color = "var(--color-danger)";
    
    desc.innerHTML = `
      ${isNewHigh ? '<strong style="color:var(--color-warning);">🏆 NEW HIGH SCORE!</strong><br>' : ''}
      Score: <strong style="color:var(--color-primary);">${this.score}</strong> | 
      Shards: <strong style="color:var(--color-accent);">${this.shardsCollected}</strong><br>
      Onsite Payout Credited: <strong style="color:var(--color-accent);">+${finalPgt.toFixed(2)} PGT</strong> 
      <span style="font-size:0.8rem; color:var(--text-dim);">(incl. ${multis.nftGameMultiplier}% NFT multiplier)</span>
    `;

    playBtn.innerText = "Relaunch Capsule";
    this.overlay.classList.remove('hidden');
  }

  // --- Core Game Loop ---
  loop() {
    if (!this.isPlaying) return;

    this.update();
    this.draw();

    requestAnimationFrame(() => this.loop());
  }

  // --- Entity Updates ---
  update() {
    this.gameTime++;
    
    // Scale difficulty slowly (every 5 seconds)
    if (this.gameTime % 300 === 0) {
      this.difficulty += 0.25;
    }

    // Update live PGT earned display
    const multis = appState.getMultipliers();
    const multiplier = 1 + (multis.nftGameMultiplier / 100);
    const liveRawPgt = (this.score / 200) + (this.shardsCollected * 2);
    let liveFinalPgt = liveRawPgt * multiplier;
    if (appState.isVipActive()) liveFinalPgt *= 2;
    document.getElementById('game-live-earned').innerText = liveFinalPgt.toFixed(2);

    // 1. Move Player
    const dy = (this.keys.w || this.keys.ArrowUp ? -1 : 0) + (this.keys.s || this.keys.ArrowDown ? 1 : 0);
    const dx = (this.keys.a || this.keys.ArrowLeft ? -1 : 0) + (this.keys.d || this.keys.ArrowRight ? 1 : 0);
    
    if (this.player) {
      this.player.y += dy * this.player.speed;
      this.player.x += dx * this.player.speed;

      // Keep player inside canvas boundary
      const pad = this.player.radius + 5;
      if (this.player.y < pad) this.player.y = pad;
      if (this.player.y > this.height - pad) this.player.y = this.height - pad;
      if (this.player.x < pad) this.player.x = pad;
      if (this.player.x > this.width / 2) this.player.x = this.width / 2; // Keep in left half

      // Decay shield timer
      if (this.player.shield) {
        this.player.shieldTime--;
        if (this.player.shieldTime <= 0) {
          this.player.shield = false;
          triggerToast("Shield deactivated!", "error");
        }
      }

      // Pulse glows
      this.player.glowPulse = Math.sin(this.gameTime * 0.1) * 3;

      // Spawn thrust exhaust particles
      if (this.gameTime % 2 === 0) {
        this.particles.push({
          x: this.player.x - 12,
          y: this.player.y + (Math.random() * 6 - 3),
          vx: -(1.5 + Math.random() * 2),
          vy: Math.random() * 1 - 0.5,
          color: Math.random() > 0.5 ? 'var(--color-primary)' : 'var(--color-secondary)',
          alpha: 0.8,
          size: 2 + Math.random() * 3
        });
      }
    }

    // 2. Spawn Obstacles (glowing gate beams)
    // Rate: decreases as difficulty scales up (faster spawn)
    const spawnRate = Math.max(70 - Math.floor(this.difficulty * 8), 35);
    if (this.gameTime % spawnRate === 0) {
      const obstacleWidth = 15;
      const speed = (2.5 + Math.random() * 1.5) * this.difficulty;
      
      // Determine barrier configurations (either top bar, bottom bar, or middle bar)
      const obstacleType = Math.random();
      let obstacleHeight = 100 + Math.random() * 120;
      let obstacleY = 0;

      if (obstacleType < 0.33) {
        // Top gate
        obstacleY = 0;
      } else if (obstacleType < 0.66) {
        // Bottom gate
        obstacleY = this.height - obstacleHeight;
      } else {
        // Middle block
        obstacleHeight = 80 + Math.random() * 60;
        obstacleY = (this.height - obstacleHeight) / 2 + (Math.random() * 80 - 40);
      }

      this.obstacles.push({
        x: this.width + 20,
        y: obstacleY,
        w: obstacleWidth,
        h: obstacleHeight,
        vx: -speed,
        glowPulse: 0
      });
    }

    // 3. Spawn Collectibles (PGT Energy Shards)
    if (this.gameTime % 90 === 0) {
      this.collectibles.push({
        x: this.width + 20,
        y: 30 + Math.random() * (this.height - 60),
        radius: 10, // Made shards larger
        vx: -2.0 - Math.random() * 1.0,
        glowPulse: 0
      });
    }

    // 4. Spawn Shield Power-ups (rarely)
    if (this.gameTime % 650 === 0 && !this.player.shield) {
      this.powerups.push({
        x: this.width + 20,
        y: 40 + Math.random() * (this.height - 80),
        radius: 8,
        vx: -2.5
      });
    }

    // 5. Update Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x += obs.vx;
      obs.glowPulse = Math.sin(this.gameTime * 0.15 + i) * 4;

      // Collide with Player
      if (this.player && this.checkCollision(this.player, obs)) {
        if (this.player.shield) {
          // Break shield
          this.player.shield = false;
          sfx.playError();
          this.obstacles.splice(i, 1);
          triggerToast("Shield Absorbed Crash!", "success");
          
          // Generate collision sparks
          this.createExplosionSparks(obs.x, this.player.y, 'var(--color-warning)', 15);
          continue;
        } else {
          // Crash Game Over
          this.createExplosionSparks(this.player.x, this.player.y, 'var(--color-danger)', 40);
          this.gameOver();
          return;
        }
      }

      // Out of bounds cleanup
      if (obs.x + obs.w < -20) {
        this.obstacles.splice(i, 1);
        this.score += 25; // Passive survival score
        document.getElementById('game-live-score').innerText = this.score;
      }
    }

    // 6. Update Collectibles
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const col = this.collectibles[i];
      col.x += col.vx;
      col.glowPulse = Math.sin(this.gameTime * 0.2 + i) * 3;

      // Check collision
      if (this.player && this.checkCircleCollision(this.player, col)) {
        sfx.playCoin();
        this.shardsCollected++;
        this.score += 100; // Big score boost
        
        document.getElementById('game-live-score').innerText = this.score;
        document.getElementById('game-live-shards').innerText = this.shardsCollected;
        
        // Spawn sparks
        this.createExplosionSparks(col.x, col.y, 'var(--color-accent)', 12);

        this.collectibles.splice(i, 1);
        continue;
      }

      // Out of bounds cleanup
      if (col.x < -20) {
        this.collectibles.splice(i, 1);
      }
    }

    // 7. Update Power-ups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pup = this.powerups[i];
      pup.x += pup.vx;

      // Check collision
      if (this.player && this.checkCircleCollision(this.player, pup)) {
        sfx.playPowerUp();
        this.player.shield = true;
        this.player.shieldTime = 420; // 7 seconds
        
        triggerToast("Shield Active (7s)!", "success");
        this.createExplosionSparks(pup.x, pup.y, 'var(--color-warning)', 15);
        
        this.powerups.splice(i, 1);
        continue;
      }

      if (pup.x < -20) {
        this.powerups.splice(i, 1);
      }
    }

    // 8. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.02;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  // --- Collision Detection Helpers ---
  checkCollision(player, rect) {
    // Find the closest point on the rectangle to the circle's center
    const closestX = Math.max(rect.x, Math.min(player.x, rect.x + rect.w));
    const closestY = Math.max(rect.y, Math.min(player.y, rect.y + rect.h));

    // Calculate distance between closest point and circle center
    const distanceX = player.x - closestX;
    const distanceY = player.y - closestY;
    
    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    return distanceSquared < (player.radius * player.radius);
  }

  checkCircleCollision(c1, c2) {
    const dx = c1.x - c2.x;
    const dy = c1.y - c2.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    return dist < (c1.radius + c2.radius);
  }

  createExplosionSparks(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4.0;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color,
        alpha: 1.0,
        size: 2 + Math.random() * 3
      });
    }
  }

  // --- Canvas Rendering Draw Loop ---
  draw() {
    // Clear canvas
    this.ctx.fillStyle = '#020308';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 1. Draw Star grid lines (moving grid illusion)
    this.ctx.strokeStyle = '#0a0d20';
    this.ctx.lineWidth = 1;
    const gridSpacing = 40;
    const offsetX = -(this.gameTime * 1.5) % gridSpacing;
    for (let x = offsetX; x < this.width; x += gridSpacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }

    // 2. Draw Particles
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });

    // 3. Draw Collectibles (Cyan Diamonds)
    this.collectibles.forEach(col => {
      this.ctx.save();
      this.ctx.shadowBlur = 15 + col.glowPulse;
      this.ctx.shadowColor = 'var(--color-accent)';
      this.ctx.fillStyle = '#00ffff'; // Brighter cyan fill
      this.ctx.strokeStyle = '#ffffff'; // White outline
      this.ctx.lineWidth = 1.5;
      
      // Draw diamond shape
      this.ctx.beginPath();
      this.ctx.moveTo(col.x, col.y - col.radius);
      this.ctx.lineTo(col.x + col.radius, col.y);
      this.ctx.lineTo(col.x, col.y + col.radius);
      this.ctx.lineTo(col.x - col.radius, col.y);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.restore();
    });

    // 4. Draw Powerups (Yellow Orbs)
    this.powerups.forEach(pup => {
      this.ctx.save();
      this.ctx.shadowBlur = 15;
      this.ctx.shadowColor = 'var(--color-warning)';
      this.ctx.fillStyle = 'var(--color-warning)';
      
      this.ctx.beginPath();
      this.ctx.arc(pup.x, pup.y, pup.radius, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Inner star detail
      this.ctx.fillStyle = '#fff';
      this.ctx.font = '9px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('S', pup.x, pup.y);
      
      this.ctx.restore();
    });

    // 5. Draw Obstacles (Magenta Mine Gates)
    this.obstacles.forEach(obs => {
      this.ctx.save();
      this.ctx.shadowBlur = 10 + obs.glowPulse;
      this.ctx.shadowColor = 'var(--color-danger)';
      this.ctx.fillStyle = 'var(--color-danger)';
      
      // Draw glowing rectangle
      this.ctx.beginPath();
      this.ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 4);
      this.ctx.fill();

      // Inner electric line glow details
      this.ctx.strokeStyle = '#ffccd5';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(obs.x + obs.w/2, obs.y + 4);
      this.ctx.lineTo(obs.x + obs.w/2, obs.y + obs.h - 4);
      this.ctx.stroke();

      this.ctx.restore();
    });

    // 6. Draw Player Ship (Improved shape)
    if (this.player) {
      this.ctx.save();
      this.ctx.shadowBlur = 12 + this.player.glowPulse;
      this.ctx.shadowColor = this.player.shield ? 'var(--color-warning)' : 'var(--color-primary)';
      this.ctx.fillStyle = 'var(--color-primary)';

      // Draw a more distinct spaceship body
      this.ctx.beginPath();
      this.ctx.moveTo(this.player.x + 18, this.player.y); // Nose cone
      this.ctx.lineTo(this.player.x - 8, this.player.y - 12); // Top wing tip
      this.ctx.lineTo(this.player.x - 4, this.player.y - 4); // Top inner wing
      this.ctx.lineTo(this.player.x - 12, this.player.y); // Engine back
      this.ctx.lineTo(this.player.x - 4, this.player.y + 4); // Bottom inner wing
      this.ctx.lineTo(this.player.x - 8, this.player.y + 12); // Bottom wing tip
      this.ctx.closePath();
      this.ctx.fill();

      // Cockpit window
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.ellipse(this.player.x + 4, this.player.y, 6, 3, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Engine thruster flame
      this.ctx.fillStyle = '#ff0055';
      this.ctx.beginPath();
      this.ctx.moveTo(this.player.x - 12, this.player.y - 3);
      this.ctx.lineTo(this.player.x - 20 - (Math.random() * 8), this.player.y);
      this.ctx.lineTo(this.player.x - 12, this.player.y + 3);
      this.ctx.closePath();
      this.ctx.fill();

      // Draw bubble shield if active
      if (this.player.shield) {
        this.ctx.strokeStyle = 'var(--color-warning)';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = 'var(--color-warning)';
        this.ctx.shadowBlur = 18;
        this.ctx.beginPath();
        this.ctx.arc(this.player.x + 2, this.player.y, this.player.radius * 2, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.restore();
    }
  }
}

// Instantiate game context
let dodgeGame = null;
window.addEventListener('DOMContentLoaded', () => {
  dodgeGame = new NeonAstroDodge('game-canvas', 'game-ui-overlay');
});
