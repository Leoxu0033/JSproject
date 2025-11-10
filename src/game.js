
import { clamp, rectsIntersect } from './utils.js';
import { input } from './input.js';
import { Player } from './player.js';
import { Enemy } from './enemy2.js';
import Level, { levels } from './level.js';
import { AudioManager } from './audio.js';
import { spawnBurst as createParticles } from './particles.js';

export default class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    // Tadpole spawn timer
    this._tadpoleTimer = 0;
    // Batch spawning: support multiple simultaneous batches
    this._tadpoleBatches = []; // Array of active batches: {location: {x,y}, count: 0, size: N, timer: 0}
    this._tadpoleBatchInterval = 0.15; // Time between tadpoles in a batch
    this.last = 0;
    this.acc = 0;
    this.timestep = 1 / 60; // seconds

    // Pause state
    this.paused = false;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP') {
        // Cannot pause when game is over (failed)
        if (this.gameOver && !this.won) {
          return;
        }
        this.paused = !this.paused;
        if (this.paused) {
          this.audio.pauseMusic && this.audio.pauseMusic();
        } else {
          this.audio.playMusic && this.audio.playMusic();
        }
      }
    });

    this.entities = [];
    this.player = new Player(100, this.height - 120);
    this.entities.push(this.player);

    // Level selection menu - don't initialize level until one is selected
    this.showLevelSelect = true; // Start with level select menu
    this.selectedLevelIndex = 0; // Currently selected level in menu
    this.highScores = this.loadHighScores(); // Load high scores from localStorage
    
    // Initialize with empty level data (will be loaded when level is selected)
    this.currentLevel = null;
    this.enemies = [];
    this.objects = [];
    this.walls = [];

    // shared input already initialized in input.js
    this.input = input;
    this.particles = [];
    this.score = 0;
    this.gameOver = false;
    
    // Level progression
    this.currentLevelIndex = 0;
    this.levelScores = []; // Track score for each completed level
    this.levelStartScore = 0; // Score at the start of current level
    this.levelTimer = 0; // Time elapsed in current level
    this.survivalTime = 20; // Seconds to survive to win
    this.won = false;
    this.winAnimationTimer = 0;
    this.winAnimationDuration = 2.0; // Duration of win animation
    this.completedLevels = this.loadCompletedLevels(); // Track which levels have been completed
    
    // Level selection menu
    this.showLevelSelect = true; // Start with level select menu
    this.selectedLevelIndex = 0; // Currently selected level in menu
    this.highScores = this.loadHighScores(); // Load high scores from localStorage
    this.totalScore = this.calculateTotalScore(); // Total score = sum of all level high scores
    
    // Safe haven dynamic spawning
    this.safeHavenTimer = 0;
    this.safeHavenDuration = 0;
    this.safeHavenActive = false;
    this.safeHavenDespawnTimer = 0;
    this.safeHavenDespawnWarning = 1.0; // Warning time before despawn

    this.audio = new AudioManager();
    this.audio.playMusic();
    // screen effects
    this.shakeTimer = 0;
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.shakeOffset = { x: 0, y: 0 };
    this.flashTimer = 0;
    this.flashColor = null;
    // gamepad player tracking: map gamepad.index -> player instance
    this.gamepadPlayers = {};
    // player color palette
    this.playerColors = ['#ffffff', '#ffd166', '#06d6a0', '#ef476f', '#118ab2'];
  }

  start() {
    this.last = performance.now();
    this._frame = (t) => this._loop(t);
    requestAnimationFrame(this._frame);
  }

  loadHighScores() {
    // Load high scores from localStorage
    try {
      const saved = localStorage.getItem('levelHighScores');
      if (saved) {
        const scores = JSON.parse(saved);
        // Ensure array has correct length
        const highScores = new Array(levels.length).fill(0);
        for (let i = 0; i < Math.min(scores.length, levels.length); i++) {
          highScores[i] = scores[i] || 0;
        }
        return highScores;
      }
    } catch (e) {
      console.warn('Failed to load high scores:', e);
    }
    return new Array(levels.length).fill(0);
  }
  
  loadCompletedLevels() {
    // Load completed levels from localStorage
    // A level is considered completed if it has a high score > 0
    const highScores = this.loadHighScores();
    const completed = [];
    for (let i = 0; i < levels.length; i++) {
      completed[i] = highScores[i] > 0;
    }
    return completed;
  }
  
  markLevelCompleted(levelIndex) {
    // Mark a level as completed
    if (levelIndex >= 0 && levelIndex < levels.length) {
      this.completedLevels[levelIndex] = true;
      try {
        localStorage.setItem('completedLevels', JSON.stringify(this.completedLevels));
      } catch (e) {
        console.warn('Failed to save completed levels:', e);
      }
    }
  }
  
  allLevelsCompleted() {
    // Check if all levels have been completed
    return this.completedLevels.every(completed => completed === true);
  }
  
  calculateTotalScore() {
    // Calculate total score as sum of all level high scores
    return this.highScores.reduce((sum, score) => sum + (score || 0), 0);
  }
  
  saveHighScore(levelIndex, score) {
    // Save high score for a level
    if (levelIndex >= 0 && levelIndex < levels.length) {
      if (score > (this.highScores[levelIndex] || 0)) {
        this.highScores[levelIndex] = score;
        try {
          localStorage.setItem('levelHighScores', JSON.stringify(this.highScores));
        } catch (e) {
          console.warn('Failed to save high score:', e);
        }
        // Mark level as completed when a score is saved
        this.markLevelCompleted(levelIndex);
        // Update total score (sum of all high scores)
        this.totalScore = this.calculateTotalScore();
      }
    }
  }
  
  reset() {
    // Reset current level only (don't change level index)
    // Reset player lives to 3
    if (this.player) {
      this.player.lives = 3;
      this.player.invulnerable = false;
      this.player.invulTimer = 0;
    }
    // Reset score for current level
    this.score = 0;
    this.levelStartScore = 0;
    this.loadLevel(this.currentLevelIndex);
    this.gameOver = false;
    this.won = false;
    this.winAnimationTimer = 0;
    this.audio.playMusic();
  }
  
  loadLevel(levelIndex) {
    // Check if coming from level select menu (before hiding it)
    const fromLevelSelect = this.showLevelSelect;
    
    // Hide level select menu when starting a level
    this.showLevelSelect = false;
    
    if (levelIndex >= levels.length) {
      // All levels completed - record score from last level only if won
      if (this.won) {
        const levelScore = this.score - this.levelStartScore;
        this.levelScores.push(levelScore);
        // Save high score for this level
        this.saveHighScore(this.currentLevelIndex, levelScore);
      }
      this.won = true;
      this.gameOver = true;
      return;
    }
    
    // When loading a level from menu, reset score for that level
    const isNewLevel = levelIndex !== this.currentLevelIndex;
    if (isNewLevel) {
      // Starting a new level - reset score to 0 for this level
      this.score = 0;
      this.levelStartScore = 0;
    } else {
      // Retrying same level - record score from previous attempt if won
      if (this.won) {
        const levelScore = this.score - this.levelStartScore;
        this.saveHighScore(this.currentLevelIndex, levelScore);
      }
    }
    
    // Reset level state
    this.currentLevelIndex = levelIndex;
    this.currentLevel = new Level(levels[levelIndex]);
    this.levelStartScore = this.score;
    this.levelTimer = 0;
    this.won = false;
    this.winAnimationTimer = 0;
    // Reset tadpole batch spawning for new level
    this._tadpoleTimer = 0;
    this._tadpoleBatches = []; // Clear all active batches
    
    // Reset safe haven spawning
    this.safeHavenTimer = 0;
    this.safeHavenDuration = 0;
    this.safeHavenActive = false;
    this.safeHavenDespawnTimer = 0;
    // Remove static safe haven from level definition (use dynamic spawning)
    if (this.currentLevel.safeHaven) {
      this.currentLevel.safeHaven = null;
    }
    
    // Clear entities except player
    this.entities = [this.player];
    this.enemies = [];
    
    // Reset player position and state
    this.player.pos.x = 100;
    this.player.pos.y = this.height - 120;
    this.player.vel.x = 0;
    this.player.vel.y = 0;
    // Reset player lives when loading from level select menu or loading a new level
    if (fromLevelSelect || isNewLevel) {
      this.player.lives = 3;
      this.player.invulnerable = false;
      this.player.invulTimer = 0;
    }
    
    // Spawn enemies from level
    this.enemies = this.currentLevel.spawnEnemies((type, x, yOffset) => {
      const baseY = this.height - this.currentLevel.groundY - 30;
      const y = Math.min(baseY, baseY + (yOffset || 0));
      const e = new Enemy(x, y, type);
      if (e.pos.y > baseY) e.pos.y = baseY;
      this.entities.push(e);
      return e;
    });
    
    // Add extra randomized enemies
    const extra = 1 + Math.floor(Math.random() * 3);
    const types = ['walker', 'chaser', 'jumper', 'roamer', 'floater'];
    for (let i = 0; i < extra; i++) {
      const tx = 120 + Math.random() * (this.width - 240);
      const ttype = types[Math.floor(Math.random() * types.length)];
      const ty = this.height - this.currentLevel.groundY - 30 + (Math.random() * 20 - 10);
      const e2 = new Enemy(tx, ty, ttype);
      this.entities.push(e2);
      this.enemies.push(e2);
    }
    
    // Rebuild level objects
    this.objects = [];
    for (const obj of (this.currentLevel.objectDefs || [])) {
      const x = obj.x || 0;
      const w = obj.w || obj.width || 12;
      let h = obj.h;
      let y = obj.y;
      if (typeof h === 'undefined' && typeof obj.height !== 'undefined') h = obj.height;
      if (typeof y === 'undefined' && typeof h === 'number') {
        const lift = obj.lift || 80;
        y = this.height - this.currentLevel.groundY - h - lift;
      }
      const type = obj.type || 'wall';
      
      if (type === 'slope') {
        const height = h || obj.height || 80;
        const dir = obj.dir || 'right';
        const yTop = typeof y === 'number' ? y : this.height - this.currentLevel.groundY - height;
        this.objects.push({ type: 'slope', x, w, h: height, dir, y: yTop });
      } else if (type === 'platform' || type === 'oneway') {
        if (typeof y === 'number' && typeof h === 'number') {
          this.objects.push({ type, x, y, w, h });
        } else if (typeof obj.y === 'number') {
          this.objects.push({ type, x, y: obj.y, w, h: obj.h || 8 });
        }
      } else {
        if (typeof y === 'number' && typeof h === 'number') this.objects.push({ type: 'wall', x, y, w, h });
      }
    }
    
    // Add frame walls
    const edge = 12;
    this.objects.push({ type: 'wall', x: 0, y: 0, w: edge, h: this.height });
    this.objects.push({ type: 'wall', x: Math.max(0, this.width - edge), y: 0, w: edge, h: this.height });
    this.objects.push({ type: 'wall', x: 0, y: 0, w: this.width, h: edge });
    this.objects.push({ type: 'wall', x: 0, y: this.height - this.currentLevel.groundY, w: this.width, h: this.currentLevel.groundY });
    this.walls = this.objects.filter((o) => o.type === 'wall');
  }

  _loop(now) {
    const elapsed = (now - this.last) / 1000; // seconds
    this.last = now;
    // clamp elapsed
    const clamped = Math.min(0.25, elapsed);
    this.acc += clamped;

    while (this.acc >= this.timestep) {
      this._update(this.timestep);
      this.acc -= this.timestep;
    }
    this._render();

    requestAnimationFrame(this._frame);
  }

  _update(dt) {
    if (this.paused) return;
    
    // Handle level selection menu
    if (this.showLevelSelect) {
      // Update particles for visual effects
      for (const p of this.particles) p.update(dt);
      this.particles = this.particles.filter((p) => p.alive);
      return; // Don't update game logic when in menu
    }
    
    // Update particles even during win animation
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter((p) => p.alive);
    
    // Handle win animation
    if (this.won && this.winAnimationTimer > 0) {
      this.winAnimationTimer -= dt;
      if (this.winAnimationTimer <= 0) {
        // Move to next level
        const nextLevelIndex = this.currentLevelIndex + 1;
        if (nextLevelIndex >= levels.length) {
          // Check if all levels have been completed
          if (this.allLevelsCompleted()) {
            // All levels completed - set final state
            this.gameOver = true;
            this.won = true;
            // Record score from last level
            const levelScore = this.score - this.levelStartScore;
            this.levelScores.push(levelScore);
            // Stop music
            this.audio.stopMusic && this.audio.stopMusic();
          } else {
            // Not all levels completed yet - return to level select
            this.showLevelSelect = true;
            this.gameOver = false;
            this.won = false;
          }
        } else {
          // Auto-load next level instead of returning to level select
          this.loadLevel(nextLevelIndex);
        }
      }
      // Still update UI during win animation
      const timerEl = document.getElementById('timer');
      if (timerEl) timerEl.textContent = `Time: 0.0s`;
      return;
    }
    
    // If all levels completed, stop updating game logic (only render completion screen)
    if (this.gameOver && this.won && this.allLevelsCompleted()) {
      // Update UI only - don't update game logic
      const timerEl = document.getElementById('timer');
      if (timerEl) timerEl.textContent = `Time: 0.0s`;
      return;
    }
    
    if (this.gameOver) return;
    
    // Update level timer
    this.levelTimer += dt;
    
    // Dynamic safe haven spawning/despawning
    if (!this.safeHavenActive) {
      // Wait for random time before spawning
      this.safeHavenTimer += dt;
      const spawnInterval = 3 + Math.random() * 4; // 3-7 seconds
      if (this.safeHavenTimer >= spawnInterval) {
        this.safeHavenTimer = 0;
        this.spawnSafeHaven();
      }
    } else {
      // Safe haven is active, count down to despawn
      this.safeHavenDuration += dt;
      const maxDuration = 4 + Math.random() * 3; // 4-7 seconds
      if (this.safeHavenDuration >= maxDuration) {
        this.despawnSafeHaven();
      } else if (this.safeHavenDuration >= maxDuration - this.safeHavenDespawnWarning) {
        // Warning phase - flash the safe haven
        this.safeHavenDespawnTimer = maxDuration - this.safeHavenDuration;
      }
    }
    
    // Check win condition: survive 20 seconds
    if (this.levelTimer >= this.survivalTime && !this.won) {
      this.won = true;
      this.winAnimationTimer = this.winAnimationDuration;
      const levelScore = this.score - this.levelStartScore;
      // Save high score when level is completed
      this.saveHighScore(this.currentLevelIndex, levelScore);
      
      // Bonus for full health completion
      if (this.player.lives >= 3) {
        this.score += 1000;
        // Play win/score sound for full health bonus
        if (this.audio && this.audio.playSfx) {
          this.audio.playSfx('win');
        }
        // Update high score again with bonus
        this.saveHighScore(this.currentLevelIndex, this.score - this.levelStartScore);
        // Extra celebration for perfect run
        this.spawnParticles(this.width / 2, this.height / 2, '#ffd700', 40);
        this.screenShake(10, 0.4);
        this.flash('#ffd700', 0.25);
      } else {
        this.audio.playSfx && this.audio.playSfx('stomp'); // Use available sound effect
        // Spawn celebration particles
        this.spawnParticles(this.width / 2, this.height / 2, '#4ade80', 30);
        this.screenShake(8, 0.3);
        this.flash('#4ade80', 0.2);
      }
    }

    // Tadpole enemy spawner: progressive difficulty with multiple simultaneous batches
    this._tadpoleTimer = (this._tadpoleTimer || 0) + dt;
    
    // Calculate difficulty based on level (1-9)
    const levelIndex = this.currentLevelIndex || 0;
    const levelNum = levelIndex + 1; // 1-9
    
    // Progressive difficulty: more batches and more tadpoles per batch as level increases
    // Level 1: 1 batch, 2-3 tadpoles per batch, interval 3.0s
    // Level 9: 3 batches, 5-7 tadpoles per batch, interval 1.5s
    const baseBatches = 1;
    const maxBatches = 3;
    const numBatches = Math.min(maxBatches, baseBatches + Math.floor((levelNum - 1) / 3)); // 1, 2, 3 batches
    
    const minBatchSize = 2 + Math.floor((levelNum - 1) / 3); // 2, 3, 4, 5...
    const maxBatchSize = 3 + Math.floor((levelNum - 1) / 2); // 3, 4, 5, 6, 7...
    const tadpoleBatchInterval = 3.0 - (levelNum - 1) * 0.15; // 3.0s down to 1.5s
    
    // Start new batches when timer expires
    if (this._tadpoleTimer >= tadpoleBatchInterval) {
      this._tadpoleTimer = 0;
      
      // Spawn multiple batches simultaneously (up to numBatches)
      const batchesToSpawn = Math.min(numBatches, numBatches - this._tadpoleBatches.length);
      
      for (let i = 0; i < batchesToSpawn; i++) {
        // Choose a random spawn location for this batch
        const edge = Math.floor(Math.random() * 4);
        const wallThickness = 12;
        const spawnMargin = 24;
        const tadpoleSize = 16;
        const groundY = this.currentLevel ? this.currentLevel.groundY : 60;
        const minX = wallThickness + spawnMargin;
        const maxX = this.width - wallThickness - spawnMargin - tadpoleSize;
        const minY = wallThickness + spawnMargin;
        const maxY = this.height - groundY - spawnMargin - tadpoleSize;
        
        let baseX, baseY;
        if (edge === 0) { // top
          baseX = Math.random() * (maxX - minX) + minX;
          baseY = minY;
        } else if (edge === 1) { // bottom
          baseX = Math.random() * (maxX - minX) + minX;
          baseY = maxY;
        } else if (edge === 2) { // left
          baseX = minX;
          baseY = Math.random() * (maxY - minY) + minY;
        } else { // right
          baseX = maxX;
          baseY = Math.random() * (maxY - minY) + minY;
        }
        
        // Create new batch
        const batchSize = minBatchSize + Math.floor(Math.random() * (maxBatchSize - minBatchSize + 1));
        this._tadpoleBatches.push({
          location: { x: baseX, y: baseY },
          count: 0,
          size: batchSize,
          timer: 0
        });
      }
    }
    
    // Process all active batches
    for (let i = this._tadpoleBatches.length - 1; i >= 0; i--) {
      const batch = this._tadpoleBatches[i];
      
      if (batch.count < batch.size) {
        batch.timer += dt;
        if (batch.timer >= this._tadpoleBatchInterval) {
          batch.timer = 0;
          
          // Spawn tadpole near the batch location with small random offset
          const offsetRange = 40; // Maximum offset from base location
          const offsetX = (Math.random() - 0.5) * offsetRange;
          const offsetY = (Math.random() - 0.5) * offsetRange;
          
          let x = batch.location.x + offsetX;
          let y = batch.location.y + offsetY;
          
          // Ensure valid spawn position
          const wallThickness = 12;
          const spawnMargin = 24;
          const tadpoleSize = 16;
          const groundY = this.currentLevel ? this.currentLevel.groundY : 60;
          const minX = wallThickness + spawnMargin;
          const maxX = this.width - wallThickness - spawnMargin - tadpoleSize;
          const minY = wallThickness + spawnMargin;
          const maxY = this.height - groundY - spawnMargin - tadpoleSize;
          
          x = Math.max(minX, Math.min(maxX, x));
          y = Math.max(minY, Math.min(maxY, y));
          
          const tadpole = new Enemy(x, y, 'tadpole');
          this.entities.push(tadpole);
          this.enemies.push(tadpole);
          batch.count++;
          
          // Remove batch when complete
          if (batch.count >= batch.size) {
            this._tadpoleBatches.splice(i, 1);
          }
        }
      } else {
        // Remove completed batch
        this._tadpoleBatches.splice(i, 1);
      }
    }

    // poll gamepads and auto-join players
    if (navigator.getGamepads) {
      const gps = navigator.getGamepads();
      for (let i = 0; i < gps.length; i++) {
        const gp = gps[i];
        if (!gp) continue;
        // if this gamepad is not assigned and any button pressed -> join
        if (!this.gamepadPlayers[gp.index]) {
          const anyPressed = gp.buttons && gp.buttons.some((b) => b && b.pressed);
          if (anyPressed) {
            // create a new player for this gamepad
            const n = Object.keys(this.gamepadPlayers).length + 1;
            const spawnX = Math.min(this.width - 100, 80 + n * 80);
            const p = new Player(spawnX, this.height - 120);
            p.gamepadIndex = gp.index;
            // pick a color for this player
            p.color = this.playerColors[(n) % this.playerColors.length];
            this.entities.push(p);
            this.gamepadPlayers[gp.index] = p;
            // give a small particle burst and sound to confirm join
            this.spawnParticles(p.pos.x + p.w / 2, p.pos.y + p.h / 2, '#88ff88', 10);
            this.audio.playSfx('jump');
          }
        }
      }
    }

    // allow dashing via gamepad button edges: check gamepads for dash triggers
    if (navigator.getGamepads) {
      const gps2 = navigator.getGamepads();
      for (let i = 0; i < gps2.length; i++) {
        const gp = gps2[i];
        if (!gp) continue;
        const player = this.gamepadPlayers[gp.index];
        if (player) {
          // button 1 typically maps to 'B' / dash
          const dashPressed = gp.buttons[1] && gp.buttons[1].pressed;
          if (dashPressed && !player._prevDashKey) {
            // dash towards current facing direction (use axis)
            const ax = gp.axes[0] || 0;
            const dir = ax < 0 ? -1 : (ax > 0 ? 1 : (player.vel.x < 0 ? -1 : 1));
            player.tryDash(dir);
          }
          player._prevDashKey = !!dashPressed;
        }
      }
    }

    // update entities
    for (const e of this.entities) {
      e.update(dt, this);
      
      // Prevent enemies from entering safe haven
      if (e !== this.player && this.currentLevel && this.currentLevel.safeHaven) {
        const haven = this.currentLevel.safeHaven;
        const enemyBounds = e.getBounds ? e.getBounds() : { x: e.pos.x, y: e.pos.y, w: e.w, h: e.h };
        
        // Check if enemy is inside safe haven
        if (enemyBounds.x < haven.x + haven.w &&
            enemyBounds.x + enemyBounds.w > haven.x &&
            enemyBounds.y < haven.y + haven.h &&
            enemyBounds.y + enemyBounds.h > haven.y) {
          // Push enemy out of safe haven
          const enemyCenterX = enemyBounds.x + enemyBounds.w / 2;
          const enemyCenterY = enemyBounds.y + enemyBounds.h / 2;
          const havenCenterX = haven.x + haven.w / 2;
          const havenCenterY = haven.y + haven.h / 2;
          
          const dx = enemyCenterX - havenCenterX;
          const dy = enemyCenterY - havenCenterY;
          const dist = Math.hypot(dx, dy) || 1;
          
          // Push enemy away from center of safe haven
          const pushX = (dx / dist) * 5;
          const pushY = (dy / dist) * 5;
          
          e.pos.x += pushX;
          e.pos.y += pushY;
          
          // Reverse velocity to push enemy away
          if (e.vel) {
            e.vel.x = -e.vel.x * 0.5;
            e.vel.y = -e.vel.y * 0.5;
          }
        }
      }
    }

    // Check if player is in safe haven
    let playerInSafeHaven = false;
    if (this.currentLevel && this.currentLevel.safeHaven) {
      const haven = this.currentLevel.safeHaven;
      const playerBounds = this.player.getBounds();
      playerInSafeHaven = 
        playerBounds.x < haven.x + haven.w &&
        playerBounds.x + playerBounds.w > haven.x &&
        playerBounds.y < haven.y + haven.h &&
        playerBounds.y + playerBounds.h > haven.y;
    }
    
    // collision: player vs enemies (only if player is not in safe haven)
    for (const en of this.enemies) {
      if (!playerInSafeHaven && rectsIntersect(this.player.getBounds(), en.getBounds())) {
        if (en.type === 'tadpole') {
          // tadpole always damages player, then dies
          if (!this.player.invulnerable) {
            this.player.takeHit(en, this);
            if (this.player.lives <= 0) {
              this.gameOver = true;
              this.audio.stopMusic();
            }
          }
          en.alive = false;
          this.spawnParticles(en.pos.x + en.w / 2, en.pos.y + en.h / 2, '#00e0ff', 10);
        } else {
          // Non-tadpole enemies: player can kill them by touching (no stomp required)
          en.alive = false;
          this.score += 100;
          this.audio.playSfx('stomp');
          // Play score sound for bonus
          setTimeout(() => {
            if (this.audio && this.audio.playSfx) {
              this.audio.playSfx('score');
            }
          }, 50);
          // spawn particles
          this.spawnParticles(en.pos.x + en.w / 2, en.pos.y + en.h / 2, '#ff4d4d', 18);
          
          // If player was falling, give a small bounce
          if (this.player.vel.y > 0) {
            const bounce = Math.min(300, Math.abs(this.player.vel.y) * 0.3 + 100);
            this.player.vel.y = -bounce;
          }
          
          // small screen shake and flash on kill
          this.screenShake(4, 0.15);
          this.flash('#ffffff', 0.08);
        }
      }
    }

    // remove dead enemies from entity list
    this.entities = this.entities.filter((e) => e.alive !== false);
    this.enemies = this.enemies.filter((e) => e.alive !== false);

    // update HUD
    const scoreEl = document.getElementById('score');
    if (scoreEl) {
      // Display best score for current level instead of current score
      const bestScore = this.highScores[this.currentLevelIndex] || 0;
      scoreEl.textContent = `Best Score: ${bestScore}`;
    }
    const livesEl = document.getElementById('lives');
    if (livesEl) livesEl.textContent = `Lives: ${this.player.lives}`;
    
    // Update level UI (even during win animation)
    const levelEl = document.getElementById('level');
    if (levelEl) {
      levelEl.textContent = `Level ${this.currentLevelIndex + 1}: ${this.currentLevel.name}`;
    }
    const timerEl = document.getElementById('timer');
    if (timerEl) {
      if (this.won) {
        timerEl.textContent = `Time: 0.0s`;
      } else {
        const remaining = Math.max(0, this.survivalTime - this.levelTimer);
        timerEl.textContent = `Time: ${remaining.toFixed(1)}s`;
      }
    }
    const levelScoreEl = document.getElementById('level-score');
    if (levelScoreEl) {
      const levelScore = this.score - this.levelStartScore;
      levelScoreEl.textContent = `Level Score: ${levelScore}`;
    }
  }

  spawnParticles(x, y, color = '#fff', count = 8) {
    // use spawnBurst helper to create multiple particles at once
    const burst = createParticles(x, y, color, count);
    for (const p of burst) this.particles.push(p);
  }
  
  spawnSafeHaven() {
    // Generate random position for safe haven
    const wallThickness = 12;
    const margin = 50;
    const havenWidth = 120;
    const havenHeight = 120;
    const groundY = this.currentLevel ? this.currentLevel.groundY : 60;
    
    const minX = wallThickness + margin;
    const maxX = this.width - wallThickness - margin - havenWidth;
    const minY = wallThickness + margin;
    const maxY = this.height - groundY - margin - havenHeight;
    
    const x = Math.random() * (maxX - minX) + minX;
    const y = Math.random() * (maxY - minY) + minY;
    
    // Set safe haven
    if (!this.currentLevel.safeHaven) {
      this.currentLevel.safeHaven = {};
    }
    this.currentLevel.safeHaven.x = x;
    this.currentLevel.safeHaven.y = y;
    this.currentLevel.safeHaven.w = havenWidth;
    this.currentLevel.safeHaven.h = havenHeight;
    
    this.safeHavenActive = true;
    this.safeHavenDuration = 0;
    this.safeHavenDespawnTimer = 0;
    
    // Visual effect when spawning
    this.spawnParticles(x + havenWidth / 2, y + havenHeight / 2, '#4ade80', 20);
    this.flash('#4ade80', 0.1);
  }
  
  despawnSafeHaven() {
    if (!this.currentLevel || !this.currentLevel.safeHaven) return;
    
    const haven = this.currentLevel.safeHaven;
    const havenCenterX = haven.x + haven.w / 2;
    const havenCenterY = haven.y + haven.h / 2;
    
    // Check if player is inside
    const playerBounds = this.player.getBounds();
    const playerInHaven = 
      playerBounds.x < haven.x + haven.w &&
      playerBounds.x + playerBounds.w > haven.x &&
      playerBounds.y < haven.y + haven.h &&
      playerBounds.y + playerBounds.h > haven.y;
    
    // Explosion effect
    this.spawnParticles(havenCenterX, havenCenterY, '#ff6b6b', 50);
    this.screenShake(12, 0.4);
    this.flash('#ff6b6b', 0.2);
    // Play explosion sound effect
    if (this.audio && this.audio.playSfx) {
      this.audio.playSfx('explosion'); // Use explosion sound effect
    }
    
    // If player is inside, kill nearby enemies
    if (playerInHaven) {
      const explosionRadius = 150;
      for (const enemy of this.enemies) {
        const enemyBounds = enemy.getBounds ? enemy.getBounds() : { x: enemy.pos.x, y: enemy.pos.y, w: enemy.w, h: enemy.h };
        const enemyCenterX = enemyBounds.x + enemyBounds.w / 2;
        const enemyCenterY = enemyBounds.y + enemyBounds.h / 2;
        
        const dx = enemyCenterX - havenCenterX;
        const dy = enemyCenterY - havenCenterY;
        const dist = Math.hypot(dx, dy);
        
        if (dist < explosionRadius) {
          enemy.alive = false;
          this.spawnParticles(enemyCenterX, enemyCenterY, '#ff6b6b', 15);
          this.score += 50; // Bonus score for explosion kill
        }
      }
    }
    
    // Remove safe haven
    this.currentLevel.safeHaven = null;
    this.safeHavenActive = false;
    this.safeHavenTimer = 0;
    this.safeHavenDuration = 0;
  }

  // screen shake: intensity in px, duration in seconds
  screenShake(intensity = 8, duration = 0.3) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakeTimer = this.shakeDuration;
  }

  flash(color = '#fff', duration = 0.08) {
    this.flashColor = color;
    this.flashTimer = Math.max(this.flashTimer, duration);
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Render level selection menu
    if (this.showLevelSelect) {
      this._renderLevelSelect(ctx);
      return;
    }
    
    // Show HUD and OPS elements when playing
    const hudEl = document.getElementById('hud');
    const opsEl = document.getElementById('ops');
    if (hudEl) hudEl.style.display = '';
    if (opsEl) opsEl.style.display = '';

    // update screen shake offsets
    if (this.shakeTimer > 0) {
      const t = this.shakeTimer / this.shakeDuration;
      const mag = this.shakeIntensity * t;
      this.shakeOffset.x = (Math.random() * 2 - 1) * mag;
      this.shakeOffset.y = (Math.random() * 2 - 1) * mag;
      this.shakeTimer = Math.max(0, this.shakeTimer - this.timestep);
    } else {
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
      this.shakeIntensity = 0;
    }

    ctx.save();
    ctx.translate(this.shakeOffset.x, this.shakeOffset.y);

    // background
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, this.width, this.height);

    // simple ground
    if (this.currentLevel) {
      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, this.height - (this.currentLevel.groundY || 60), this.width, this.currentLevel.groundY || 60);
    }

    // draw safe haven (if exists)
    if (this.currentLevel && this.currentLevel.safeHaven && this.safeHavenActive) {
      const haven = this.currentLevel.safeHaven;
      // Check if player is in safe haven
      const playerInHaven = this.player && 
        this.player.pos.x < haven.x + haven.w &&
        this.player.pos.x + this.player.w > haven.x &&
        this.player.pos.y < haven.y + haven.h &&
        this.player.pos.y + this.player.h > haven.y;
      
      // Warning flash effect when about to despawn
      let alpha = 0.15;
      let borderAlpha = 0.4;
      if (this.safeHavenDespawnTimer > 0) {
        // Flash red when about to despawn
        const flashRate = this.safeHavenDespawnTimer * 10;
        const flash = Math.sin(flashRate) > 0 ? 1 : 0.3;
        alpha = flash * 0.3;
        borderAlpha = flash;
        ctx.fillStyle = `rgba(255, 107, 107, ${alpha})`;
      } else if (playerInHaven) {
        // Normal green when player is inside
        const pulse = 0.3 + Math.sin(performance.now() / 200) * 0.1;
        alpha = pulse;
        borderAlpha = 0.8;
        ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`;
      } else {
        ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`;
      }
      
      ctx.fillRect(haven.x, haven.y, haven.w, haven.h);
      
      // Draw border
      if (this.safeHavenDespawnTimer > 0) {
        ctx.strokeStyle = `rgba(255, 107, 107, ${borderAlpha})`;
      } else {
        ctx.strokeStyle = playerInHaven ? 'rgba(74, 222, 128, 0.8)' : 'rgba(74, 222, 128, 0.4)';
      }
      ctx.lineWidth = 2;
      ctx.strokeRect(haven.x, haven.y, haven.w, haven.h);
    }

    // draw entities
    for (const e of this.entities) e.draw(ctx);

    // draw level walls (simple blocks)
    // draw all level objects (walls, platforms, oneway, slopes)
    if (this.objects && this.objects.length) {
      ctx.save();
      for (const o of this.objects) {
        if (o.type === 'wall') {
          ctx.fillStyle = '#3a3a3a';
          ctx.fillRect(o.x, o.y, o.w, o.h);
        } else if (o.type === 'platform') {
          ctx.fillStyle = '#7fb3ff';
          const h = o.h || 8;
          ctx.fillRect(o.x, o.y, o.w, h);
          // small top highlight
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(o.x, o.y, o.w, 2);
        } else if (o.type === 'oneway') {
          ctx.fillStyle = '#a0d2ff';
          const h = o.h || 8;
          ctx.fillRect(o.x, o.y, o.w, h);
          ctx.strokeStyle = 'rgba(0,0,0,0.12)';
          ctx.beginPath();
          ctx.moveTo(o.x, o.y + h);
          ctx.lineTo(o.x + o.w, o.y + h);
          ctx.stroke();
        } else if (o.type === 'slope') {
          // draw a triangle for slope
          ctx.fillStyle = '#5aa0ff';
          const x = o.x, w = o.w, h = o.h || 80;
          if (o.dir === 'right') {
            ctx.beginPath();
            ctx.moveTo(x, o.y + h);
            ctx.lineTo(x + w, o.y + h);
            ctx.lineTo(x + w, o.y + h - h);
            ctx.closePath();
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.moveTo(x, o.y + h);
            ctx.lineTo(x + w, o.y + h - h);
            ctx.lineTo(x + w, o.y + h);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }

    // draw particles (on top of entities)
    for (const p of this.particles) p.draw(ctx);

    ctx.restore();

    // flash overlay (drawn without shake)
    if (this.flashTimer > 0) {
      const alpha = Math.max(0, this.flashTimer / 0.12);
      ctx.save();
      ctx.fillStyle = this.flashColor || '#fff';
      ctx.globalAlpha = 0.9 * alpha;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
      this.flashTimer = Math.max(0, this.flashTimer - this.timestep);
    }

    // Win animation
    if (this.won && this.winAnimationTimer > 0) {
      const progress = 1 - (this.winAnimationTimer / this.winAnimationDuration);
      const alpha = Math.min(1, progress * 1.5);
      
      // Pulsing background
      ctx.fillStyle = `rgba(0, 255, 100, ${alpha * 0.3})`;
      ctx.fillRect(0, 0, this.width, this.height);
      
      // Win text with animation
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const scale = 1 + Math.sin(progress * Math.PI * 4) * 0.1;
      ctx.save();
      ctx.translate(this.width / 2, this.height / 2 - 40);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#4ade80';
      ctx.fillText('LEVEL COMPLETE!', 0, 0);
      ctx.restore();
      
      // Show level score
      ctx.font = '24px sans-serif';
      const levelScore = this.score - this.levelStartScore;
      ctx.fillStyle = '#fff';
      ctx.fillText(`Level Score: ${levelScore}`, this.width / 2, this.height / 2 + 20);
      
      // Show total score
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#ccc';
      ctx.fillText(`Total Score: ${this.score}`, this.width / 2, this.height / 2 + 60);
      
      // Spawn celebration particles
      if (Math.random() < 0.3) {
        const px = this.width / 2 + (Math.random() - 0.5) * 200;
        const py = this.height / 2 + (Math.random() - 0.5) * 100;
        this.spawnParticles(px, py, '#4ade80', 5);
      }
    }
    
    if (this.gameOver && !this.won) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#fff';
      ctx.font = '36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', this.width / 2, this.height / 2 - 30);
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#ccc';
      ctx.fillText('Press R to restart • Press ESC to return to level select', this.width / 2, this.height / 2 + 20);
    } else if (this.gameOver && this.won && this.allLevelsCompleted()) {
      // Hide HUD and OPS elements when showing final completion screen
      const hudEl = document.getElementById('hud');
      const opsEl = document.getElementById('ops');
      if (hudEl) hudEl.style.display = 'none';
      if (opsEl) opsEl.style.display = 'none';
      
      // All levels completed - Enhanced completion screen with animation
      const time = performance.now() / 1000;
      const pulse = Math.sin(time * 2) * 0.1 + 0.9;
      const bgAlpha = 0.9 * pulse;
      
      // Animated background with gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
      gradient.addColorStop(0, `rgba(10, 20, 40, ${bgAlpha})`);
      gradient.addColorStop(1, `rgba(5, 10, 20, ${bgAlpha})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.width, this.height);
      
      // Animated title with rainbow effect
      const titleScale = 1 + Math.sin(time * 3) * 0.08;
      const titleY = this.height / 2 - 200;
      
      ctx.save();
      ctx.translate(this.width / 2, titleY);
      ctx.scale(titleScale, titleScale);
      
      // Rainbow text effect
      const hue = (time * 50) % 360;
      ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎉 CONGRATULATIONS! 🎉', 0, 0);
      
      ctx.restore();
      
      // Subtitle
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 42px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('YOU COMPLETED ALL LEVELS!', this.width / 2, titleY + 80);
      
      // Final score with emphasis (sum of all level high scores)
      const scoreY = this.height / 2 - 60;
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      const scoreText = `Total Score: ${this.totalScore}`;
      // Add glow effect
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 20;
      ctx.fillText(scoreText, this.width / 2, scoreY);
      ctx.shadowBlur = 0;
      
      // Level breakdown section
      const breakdownY = this.height / 2 + 20;
      ctx.font = '28px sans-serif';
      ctx.fillStyle = '#4ade80';
      ctx.fillText('Level Breakdown', this.width / 2, breakdownY);
      
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#ccc';
      let y = breakdownY + 50;
      const startX = this.width / 2 - 220;
      const colWidth = 440;
      const itemsPerCol = Math.ceil(levels.length / 2);
      
      // Display in two columns with high scores (not current session scores)
      for (let i = 0; i < levels.length; i++) {
        const col = i < itemsPerCol ? 0 : 1;
        const row = i < itemsPerCol ? i : i - itemsPerCol;
        const x = startX + col * colWidth;
        const displayY = y + row * 32;
        
        // Alternate color for better readability
        ctx.fillStyle = i % 2 === 0 ? '#fff' : '#e0e0e0';
        const highScore = this.highScores[i] || 0;
        ctx.fillText(`Level ${i + 1}: ${highScore} pts`, x, displayY);
      }
      
      // Total levels completed
      const totalY = breakdownY + 50 + itemsPerCol * 32 + 30;
      ctx.font = '22px sans-serif';
      ctx.fillStyle = '#888';
      ctx.fillText(`Total Levels Completed: ${levels.length}`, this.width / 2, totalY);
      
      // Restart instruction with pulsing effect
      const restartY = totalY + 60;
      const restartPulse = Math.sin(time * 4) * 0.3 + 0.7;
      ctx.font = '24px sans-serif';
      ctx.fillStyle = `rgba(255, 255, 255, ${restartPulse})`;
      ctx.fillText('Press R to Restart from Level 1', this.width / 2, restartY);
      
      // Celebration particles (more frequent)
      if (Math.random() < 0.6) {
        const px = this.width / 2 + (Math.random() - 0.5) * 500;
        const py = this.height / 2 + (Math.random() - 0.5) * 300;
        const colors = ['#4ade80', '#ffd700', '#ff6b6b', '#4ade80', '#ffd700'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        this.spawnParticles(px, py, color, 12);
      }
      
      // Confetti effect
      if (Math.random() < 0.3) {
        for (let i = 0; i < 5; i++) {
          const px = Math.random() * this.width;
          const py = Math.random() * this.height;
          const colors = ['#4ade80', '#ffd700', '#ff6b6b', '#4ade80'];
          const color = colors[Math.floor(Math.random() * colors.length)];
          this.spawnParticles(px, py, color, 6);
        }
      }
    }
  }
  
  _renderLevelSelect(ctx) {
    // Hide HUD and OPS elements when in level select menu
    const hudEl = document.getElementById('hud');
    const opsEl = document.getElementById('ops');
    if (hudEl) hudEl.style.display = 'none';
    if (opsEl) opsEl.style.display = 'none';
    
    // Update total score from high scores (in case it changed)
    this.totalScore = this.calculateTotalScore();
    
    const time = performance.now() / 1000;
    
    // Animated background
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#0b1220');
    gradient.addColorStop(1, '#050510');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Title
    const titlePulse = Math.sin(time * 2) * 0.05 + 0.95;
    ctx.save();
    ctx.translate(this.width / 2, 60);
    ctx.scale(titlePulse, titlePulse);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELECT LEVEL', 0, 0);
    ctx.restore();
    
    // Total Score display (beautified)
    const totalScoreY = 110;
    const totalScoreText = `Total Score: ${this.totalScore}`;
    
    // Draw background with rounded corners effect
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
    ctx.lineWidth = 2;
    const padding = 15;
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    const metrics = ctx.measureText(totalScoreText);
    const textWidth = metrics.width;
    const boxWidth = textWidth + padding * 2;
    const boxHeight = 40;
    const boxX = this.width / 2 - boxWidth / 2;
    const boxY = totalScoreY - boxHeight / 2;
    
    // Draw rounded rectangle background
    const cornerRadius = 8;
    ctx.beginPath();
    ctx.moveTo(boxX + cornerRadius, boxY);
    ctx.lineTo(boxX + boxWidth - cornerRadius, boxY);
    ctx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + cornerRadius);
    ctx.lineTo(boxX + boxWidth, boxY + boxHeight - cornerRadius);
    ctx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - cornerRadius, boxY + boxHeight);
    ctx.lineTo(boxX + cornerRadius, boxY + boxHeight);
    ctx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - cornerRadius);
    ctx.lineTo(boxX, boxY + cornerRadius);
    ctx.quadraticCurveTo(boxX, boxY, boxX + cornerRadius, boxY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Draw text with glow effect
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(totalScoreText, this.width / 2, totalScoreY);
    ctx.shadowBlur = 0; // Reset shadow
    
    // Instructions
    ctx.fillStyle = '#888';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Arrow Keys / WASD to navigate • Enter to select • ESC to return', this.width / 2, 155);
    
    // Level grid (3 columns)
    const cols = 3;
    const rows = Math.ceil(levels.length / cols);
    const cardWidth = 250;
    const cardHeight = 120;
    const cardSpacing = 20;
    const startX = (this.width - (cols * (cardWidth + cardSpacing) - cardSpacing)) / 2;
    const startY = 200;
    
    for (let i = 0; i < levels.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardWidth + cardSpacing);
      const y = startY + row * (cardHeight + cardSpacing);
      
      const isSelected = i === this.selectedLevelIndex;
      const level = levels[i];
      const highScore = this.highScores[i] || 0;
      
      // Card background
      if (isSelected) {
        const glow = Math.sin(time * 4) * 0.2 + 0.8;
        ctx.fillStyle = `rgba(74, 222, 128, ${0.3 * glow})`;
        ctx.strokeStyle = `rgba(74, 222, 128, ${glow})`;
        ctx.lineWidth = 3;
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
      }
      
      ctx.fillRect(x, y, cardWidth, cardHeight);
      ctx.strokeRect(x, y, cardWidth, cardHeight);
      
      // Level number and name
      ctx.fillStyle = isSelected ? '#4ade80' : '#fff';
      ctx.font = isSelected ? 'bold 24px sans-serif' : '20px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Level ${level.id}: ${level.name}`, x + 15, y + 30);
      
      // High score
      ctx.fillStyle = '#ffd700';
      ctx.font = '16px sans-serif';
      ctx.fillText(`Best: ${highScore}`, x + 15, y + 55);
      
      // Survival time
      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Survive: ${this.survivalTime}s`, x + 15, y + 80);
      
      // Selection indicator
      if (isSelected) {
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('►', x + cardWidth - 15, y + cardHeight / 2);
      }
    }
    
    // Celebration particles
    if (Math.random() < 0.3) {
      const px = Math.random() * this.width;
      const py = Math.random() * this.height;
      const colors = ['#4ade80', '#ffd700', '#ff6b6b'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      this.spawnParticles(px, py, color, 5);
    }
  }
}
