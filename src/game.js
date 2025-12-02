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
    // Special enemy spawn timer
    this._specialEnemyTimer = 0;
    // Batch spawning: support multiple simultaneous batches
    this._tadpoleBatches = []; // Array of active batches: {location: {x,y}, count: 0, size: N, timer: 0}
    this._tadpoleBatchInterval = 0.15; // Time between tadpoles in a batch
    this.last = 0;
    this.acc = 0;
    this.timestep = 1 / 60; // seconds

    // Game Mode
    this.twoPlayerMode = false;
    this.lives = 3; // Shared lives

    // Pause state
    this.paused = false;
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP') {
        // Cannot pause when game is over (failed)
        if (this.gameOver && !this.won) {
          return;
        }
        this.paused = !this.paused;
        // Music continues playing in background
      } else if (e.code === 'KeyY') {
        this.toggleStyle();
      }
    });

    this.entities = [];
    this.player = new Player(100, this.height - 120);
    this.entities.push(this.player);
    this.players = [this.player];

    // Menu Players (for visual effect)
    this.menuPlayers = [];
    this._initMenuPlayers();

    // Main Menu
    this.showMainMenu = true;
    this.mainMenuSelection = 0; // 0: Start

    // Level selection menu - don't initialize level until one is selected
    this.showLevelSelect = false; // Start with main menu, not level select
    this.selectedLevelIndex = 1; // Currently selected level in menu (Start from 1)
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
    this.levelIntroTimer = 0;
    this.levelIntroDuration = 3.0; // Duration of level intro animation
    this.completedLevels = this.loadCompletedLevels(); // Track which levels have been completed
    
    // Level selection menu
    this.showLevelSelect = true; // Start with level select menu
    this.selectedLevelIndex = 1; // Currently selected level in menu (Start from 1)
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
    
    // Background Style
    this.bgStyle = 5; // 0: Neon, 1: Cyber-Nature, 2: Nature, 3: Underwater, 4: Space, 5: Random
    this.bgStyles = ['Neon', 'Cyber', 'Nature', 'Underwater', 'Space', 'Random'];
    this.currentLevelStyle = this.bgStyle; // The actual style used for the current level
    
    // Background Scenery
    this.scenery = [];
    this._initScenery();
    
    // Main Menu Scenery (Fusion of 4 styles)
    this.mainMenuScenery = [];
    this._initMainMenuScenery();
  }

  start() {
    this.last = performance.now();
    this._frame = (t) => this._loop(t);
    requestAnimationFrame(this._frame);
  }

  startSinglePlayer() {
    this.twoPlayerMode = false;
    this.selectedLevelIndex = 0;
    this.loadLevel(0);
  }

  startTwoPlayer() {
    this.twoPlayerMode = true;
    this.selectedLevelIndex = 0;
    this.loadLevel(0);
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
    try {
      const saved = localStorage.getItem('completedLevels');
      if (saved) {
        const completed = JSON.parse(saved);
        // Ensure array has correct length
        const result = new Array(levels.length).fill(false);
        for (let i = 0; i < Math.min(completed.length, levels.length); i++) {
          result[i] = completed[i];
        }
        // Also check high scores as fallback (if high score > 0, it must be completed)
        const highScores = this.loadHighScores();
        for (let i = 0; i < levels.length; i++) {
          if (highScores[i] > 0) result[i] = true;
        }
        return result;
      }
    } catch (e) {
      console.warn('Failed to load completed levels:', e);
    }

    // Fallback: A level is considered completed if it has a high score > 0
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
    // Check if all levels (except tutorial) have been completed
    // Skip index 0 (Tutorial)
    for (let i = 1; i < this.completedLevels.length; i++) {
      if (!this.completedLevels[i]) return false;
    }
    return true;
  }
  
  calculateTotalScore() {
    // Calculate total score as sum of all level high scores (excluding tutorial)
    // Skip index 0 (Tutorial)
    let total = 0;
    for (let i = 1; i < this.highScores.length; i++) {
      total += (this.highScores[i] || 0);
    }
    return total;
  }
  
  saveHighScore(levelIndex, score) {
    // Save high score for a level
    if (levelIndex >= 0 && levelIndex < levels.length) {
      // Always mark level as completed when finished, regardless of score
      this.markLevelCompleted(levelIndex);
      
      if (score > (this.highScores[levelIndex] || 0)) {
        this.highScores[levelIndex] = score;
        try {
          localStorage.setItem('levelHighScores', JSON.stringify(this.highScores));
        } catch (e) {
          console.warn('Failed to save high score:', e);
        }
        // Update total score (sum of all high scores)
        this.totalScore = this.calculateTotalScore();
        return true; // New record!
      }
    }
    return false;
  }

  toggleStyle() {
    this.bgStyle = (this.bgStyle + 1) % this.bgStyles.length;
    
    // Update current level style immediately
    if (this.bgStyle === 5) { // Random
       this.currentLevelStyle = Math.floor(Math.random() * 5);
    } else {
       this.currentLevelStyle = this.bgStyle;
    }
    
    // Re-initialize scenery for the new style
    this._initScenery();
    
    // Visual feedback
    this.flash('#ffffff', 0.1);
    if (this.audio) this.audio.playSfx('select');
    
    // Update UI label
    const styleEl = document.getElementById('style-toggle');
    if (styleEl) {
      styleEl.textContent = `🎨 Style: ${this.bgStyles[this.bgStyle]} (Y)`;
    }
  }
  
  reset() {
    // Reset current level only (don't change level index)
    // Reset shared lives
    this.lives = this.twoPlayerMode ? 5 : 3;
    
    if (this.player) {
      // this.player.lives is deprecated, but reset for safety
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
    
    // Determine style for this level
    if (this.currentLevelIndex === 0) {
      this.currentLevelStyle = 0; // Force Neon for Tutorial
    } else {
      if (this.bgStyle === 5) { // Random
         // Pick random from 0-4
         this.currentLevelStyle = Math.floor(Math.random() * 5);
      } else {
         this.currentLevelStyle = this.bgStyle;
      }
    }

    this.currentLevel = new Level(levels[levelIndex]);
    this.levelStartScore = this.score;
    this.levelTimer = 0;
    this.won = false;
    this.perfectClear = false; // Reset perfect clear flag
    this.newRecord = false; // Reset new record flag
    this.winAnimationTimer = 0;
    this.levelIntroTimer = this.levelIntroDuration;
    // Reset tadpole batch spawning for new level
    this._tadpoleTimer = 0;
    this._tadpoleBatches = []; // Clear all active batches
    
    // Initialize scenery for this level
    this._initScenery();
    
    // Reset safe haven spawning
    this.safeHavenTimer = 0;
    this.safeHavenDuration = 0;
    this.safeHavenActive = false;
    this.safeHavenDespawnTimer = 0;
    // Remove static safe haven from level definition (use dynamic spawning)
    if (this.currentLevel.safeHaven) {
      this.currentLevel.safeHaven = null;
    }
    
    // Clear entities
    this.entities = [];
    this.enemies = [];
    
    // Setup players based on mode
    if (this.twoPlayerMode) {
      // Player 1 (WASD)
      const p1 = new Player(80, this.height - 120, {
        left: ['KeyA'],
        right: ['KeyD'],
        jump: ['KeyW', 'Space'],
        up: ['KeyW'],
        dash: ['ShiftLeft', 'KeyK']
      });
      p1.color = '#ffffff'; // White
      this.entities.push(p1);
      
      // Player 2 (Arrows)
      const p2 = new Player(160, this.height - 120, {
        left: ['ArrowLeft'],
        right: ['ArrowRight'],
        jump: ['ArrowUp', 'Enter'],
        up: ['ArrowUp'],
        dash: ['ShiftRight', 'Slash']
      });
      p2.color = '#ffd166'; // Yellow
      this.entities.push(p2);
      
      this.players = [p1, p2];
      this.player = p1; // Main ref
      
      // Reset shared lives
      if (fromLevelSelect || isNewLevel) {
        this.lives = 5;
      }
    } else {
      // Single Player
      this.player = new Player(100, this.height - 120);
      this.entities.push(this.player);
      this.players = [this.player];
      
      // Reset lives
      if (fromLevelSelect || isNewLevel) {
        this.lives = 3;
      }
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
    
    // Initialize scenery
    this._initScenery();
  }

  _initScenery() {
    this.scenery = [];
    const bottom = this.height;
    
    if (this.currentLevelStyle === 0) {
      // Neon Style: No scenery, just grid
      return;
    } else if (this.currentLevelStyle === 1) {
      // Cyber-Nature Style
      // Mountains (Background)
      const numMountains = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < numMountains; i++) {
        const w = 300 + Math.random() * 400;
        const h = 150 + Math.random() * 200;
        const x = Math.random() * this.width;
        this.scenery.push({
          type: 'mountain',
          x,
          y: bottom,
          w,
          h,
          color: '#1e293b', // Dark blue-grey
          peakColor: '#e2e8f0' // Snow
        });
      }

      // Towers (Midground)
      const numTowers = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < numTowers; i++) {
        const w = 40 + Math.random() * 60;
        const h = 100 + Math.random() * 250;
        const x = Math.random() * this.width;
        this.scenery.push({
          type: 'tower',
          x,
          y: bottom,
          w,
          h,
          color: '#0f172a', // Darker
          windowColor: Math.random() > 0.5 ? '#0ea5e9' : '#f43f5e' // Neon Blue or Pink
        });
      }

      // Plants (Foreground)
      const numPlants = 20 + Math.floor(Math.random() * 20);
      for (let i = 0; i < numPlants; i++) {
        const h = 15 + Math.random() * 25;
        const x = Math.random() * this.width;
        this.scenery.push({
          type: 'plant',
          x,
          y: bottom,
          h,
          color: Math.random() > 0.5 ? '#4ade80' : '#f472b6' // Green or Pink
        });
      }
    } else if (this.currentLevelStyle === 2) {
      // Nature Style
      // Distant Mountains (Green/Blue)
      const numMountains = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < numMountains; i++) {
        const w = 400 + Math.random() * 500;
        const h = 200 + Math.random() * 300;
        const x = Math.random() * this.width;
        this.scenery.push({
          type: 'mountain',
          x,
          y: bottom,
          w,
          h,
          color: '#2d6a4f', // Deep Green
          peakColor: '#d8f3dc' // Light Green/Snow
        });
      }

      // Trees (Pine/Deciduous)
      const numTrees = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < numTrees; i++) {
        const w = 30 + Math.random() * 40;
        const h = 80 + Math.random() * 120;
        const x = Math.random() * this.width;
        this.scenery.push({
          type: 'tree',
          x,
          y: bottom,
          w,
          h,
          color: '#1b4332', // Dark Green Trunk/Leaves base
          leafColor: '#40916c' // Lighter Green Leaves
        });
      }

      // Flowers/Grass (Foreground)
      const numPlants = 30 + Math.floor(Math.random() * 20);
      for (let i = 0; i < numPlants; i++) {
        const h = 10 + Math.random() * 20;
        const x = Math.random() * this.width;
        this.scenery.push({
          type: 'plant',
          x,
          y: bottom,
          h,
          color: Math.random() > 0.5 ? '#52b788' : '#ffadad' // Green or Pink Flower
        });
      }
    } else if (this.currentLevelStyle === 3) {
      // Underwater Style
      // Seaweed (Tall wavy plants)
      const numSeaweed = 15 + Math.floor(Math.random() * 10);
      for (let i = 0; i < numSeaweed; i++) {
        const h = 60 + Math.random() * 100;
        const x = Math.random() * this.width;
        this.scenery.push({
          type: 'seaweed',
          x,
          y: bottom,
          w: 10,
          h,
          color: Math.random() > 0.5 ? '#00b894' : '#55efc4' // Teal/Mint
        });
      }

      // Bubbles (Floating up)
      const numBubbles = 20 + Math.floor(Math.random() * 15);
      for (let i = 0; i < numBubbles; i++) {
        const r = 2 + Math.random() * 6;
        const x = Math.random() * this.width;
        const y = Math.random() * this.height;
        this.scenery.push({
          type: 'bubble',
          x,
          y,
          r,
          speed: 10 + Math.random() * 20,
          color: 'rgba(255, 255, 255, 0.3)'
        });
      }

      // Coral (Rocky shapes)
      const numCoral = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < numCoral; i++) {
        const w = 40 + Math.random() * 60;
        const h = 30 + Math.random() * 50;
        const x = Math.random() * this.width;
        this.scenery.push({
          type: 'coral',
          x,
          y: bottom,
          w,
          h,
          color: Math.random() > 0.5 ? '#ff7675' : '#fab1a0' // Pink/Peach
        });
      }
    } else if (this.currentLevelStyle === 4) {
      // Space Style
      // Distant Stars
      const numStars = 50 + Math.floor(Math.random() * 50);
      for (let i = 0; i < numStars; i++) {
        this.scenery.push({
          type: 'star',
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          size: Math.random() * 2 + 1,
          alpha: Math.random()
        });
      }
      
      // Planets
      const numPlanets = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < numPlanets; i++) {
        this.scenery.push({
          type: 'planet',
          x: Math.random() * this.width,
          y: Math.random() * (this.height - 100), // Keep above ground mostly
          r: 20 + Math.random() * 40,
          color: ['#ff6b6b', '#4ecdc4', '#ffe66d', '#ff9ff3'][Math.floor(Math.random() * 4)],
          hasRing: Math.random() > 0.5
        });
      }
      
      // Asteroids
      const numAsteroids = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < numAsteroids; i++) {
        const asteroid = {
          type: 'asteroid',
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          size: 10 + Math.random() * 20,
          speed: (Math.random() - 0.5) * 10,
          vertices: [] // Generate vertices for polygon
        };
        
        // Generate vertices for asteroid
        const sides = 5 + Math.floor(Math.random() * 3);
        for (let j = 0; j < sides; j++) {
            const angle = (j / sides) * Math.PI * 2;
            const r = asteroid.size * (0.8 + Math.random() * 0.4);
            asteroid.vertices.push({
                x: Math.cos(angle) * r,
                y: Math.sin(angle) * r
            });
        }
        this.scenery.push(asteroid);
      }
    }
    
    // Sort by type/depth
    this.scenery.sort((a, b) => {
      const order = { mountain: 0, tower: 1, tree: 1, seaweed: 1, coral: 2, plant: 2, bubble: 3, star: 0, planet: 1, asteroid: 2 };
      return (order[a.type] || 0) - (order[b.type] || 0);
    });
  }

  _renderScenery(ctx) {
    this.scenery.forEach(obj => {
      if (obj.type === 'mountain') {
        if (obj.points) {
            // Polygon mountain (Custom shape)
            ctx.fillStyle = obj.color;
            ctx.beginPath();
            ctx.moveTo(obj.points[0].x, obj.points[0].y);
            for (let i = 1; i < obj.points.length; i++) {
                ctx.lineTo(obj.points[i].x, obj.points[i].y);
            }
            ctx.closePath();
            ctx.fill();
        } else {
            // Standard Triangle Mountain
            // Mountain Body
            ctx.fillStyle = obj.color;
            ctx.beginPath();
            ctx.moveTo(obj.x - obj.w / 2, obj.y);
            ctx.lineTo(obj.x, obj.y - obj.h);
            ctx.lineTo(obj.x + obj.w / 2, obj.y);
            ctx.fill();
            
            // Mountain Peak (Snow/Light)
            ctx.fillStyle = obj.peakColor;
            ctx.beginPath();
            ctx.moveTo(obj.x - obj.w * 0.15, obj.y - obj.h * 0.7);
            ctx.lineTo(obj.x, obj.y - obj.h);
            ctx.lineTo(obj.x + obj.w * 0.15, obj.y - obj.h * 0.7);
            // Zigzag bottom of snow
            ctx.lineTo(obj.x + obj.w * 0.05, obj.y - obj.h * 0.75);
            ctx.lineTo(obj.x, obj.y - obj.h * 0.7);
            ctx.lineTo(obj.x - obj.w * 0.05, obj.y - obj.h * 0.75);
            ctx.fill();
        }
      } else if (obj.type === 'tower') {
        ctx.fillStyle = obj.color || '#1e293b';
        
        if (obj.inverted) {
            // Inverted Tower (Top-Down)
            ctx.fillRect(obj.x - obj.w / 2, obj.y, obj.w, obj.h);
            
            // Windows
            ctx.fillStyle = obj.windowColor || '#facc15';
            if (obj.windows) {
                obj.windows.forEach(win => {
                    if (win.on) {
                        ctx.fillRect(
                            obj.x - obj.w / 2 + win.x,
                            obj.y + win.y, 
                            win.w, win.h
                        );
                    }
                });
            }
            
            // Antenna (Bottom)
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(obj.x, obj.y + obj.h);
            ctx.lineTo(obj.x, obj.y + obj.h + 30);
            ctx.stroke();
            // Red light on bottom
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(obj.x, obj.y + obj.h + 30, 2, 0, Math.PI * 2);
            ctx.fill();
            
        } else {
            // Standard Tower (Bottom-Up)
            ctx.fillRect(obj.x - obj.w / 2, obj.y - obj.h, obj.w, obj.h);
            
            // Windows
            ctx.fillStyle = obj.windowColor || '#facc15';
            
            if (obj.windows && obj.windows.length > 0) {
                // Use pre-generated windows (stable)
                obj.windows.forEach(win => {
                    if (win.on) {
                        // win.y is negative offset from bottom
                        ctx.fillRect(
                            obj.x - obj.w / 2 + win.x,
                            obj.y + win.y, 
                            win.w, win.h
                        );
                    }
                });
            } else {
                // Procedural windows (fallback)
                ctx.globalAlpha = 0.6;
                const rows = Math.floor(obj.h / 20);
                const cols = Math.floor(obj.w / 15);
                for (let r = 0; r < rows; r++) {
                  for (let c = 0; c < cols; c++) {
                    // Use a pseudo-random check based on position to avoid flickering
                    const seed = (obj.x * r + c * 100);
                    const isLit = Math.sin(seed) > 0.3;
                    
                    if (isLit) {
                        ctx.fillRect(
                          obj.x - obj.w / 2 + 5 + c * 12,
                          obj.y - obj.h + 10 + r * 20,
                          6, 10
                        );
                    }
                  }
                }
                ctx.globalAlpha = 1.0;
            }
            
            // Antenna
            ctx.strokeStyle = '#64748b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(obj.x, obj.y - obj.h);
            ctx.lineTo(obj.x, obj.y - obj.h - 30);
            ctx.stroke();
            // Red light on top
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(obj.x, obj.y - obj.h - 30, 2, 0, Math.PI * 2);
            ctx.fill();
        }
      } else if (obj.type === 'cloud') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.w * 0.5, 0, Math.PI * 2);
        ctx.arc(obj.x + obj.w * 0.4, obj.y - obj.w * 0.2, obj.w * 0.4, 0, Math.PI * 2);
        ctx.arc(obj.x - obj.w * 0.4, obj.y - obj.w * 0.2, obj.w * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        // Move cloud
        obj.x += obj.speed * 0.016;
        if (obj.x > this.width + 100) obj.x = -100;
      } else if (obj.type === 'tree') {
        // Trunk
        ctx.fillStyle = '#4a3b32'; // Brown
        ctx.fillRect(obj.x - 5, obj.y - obj.h * 0.3, 10, obj.h * 0.3);
        
        // Leaves (Triangle layers)
        ctx.fillStyle = obj.leafColor;
        const layers = 3;
        const layerHeight = (obj.h * 0.8) / layers;
        for (let i = 0; i < layers; i++) {
          const w = obj.w * (1 - i * 0.2);
          const y = obj.y - obj.h * 0.3 - i * layerHeight * 0.8;
          ctx.beginPath();
          ctx.moveTo(obj.x - w / 2, y);
          ctx.lineTo(obj.x, y - layerHeight * 1.2);
          ctx.lineTo(obj.x + w / 2, y);
          ctx.fill();
        }
      } else if (obj.type === 'plant') {
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obj.x, obj.y);
        // Curve
        const tipX = obj.x + (Math.random() * 10 - 5);
        ctx.quadraticCurveTo(
          obj.x, 
          obj.y - obj.h / 2, 
          tipX, 
          obj.y - obj.h
        );
        ctx.stroke();
        
        // Flower head
        if (obj.color !== '#52b788') { // If not just grass
          ctx.fillStyle = obj.color;
          ctx.beginPath();
          ctx.arc(tipX, obj.y - obj.h, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (obj.type === 'seaweed') {
        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.moveTo(obj.x, obj.y);
        const segments = 5;
        const segHeight = obj.h / segments;
        const sway = Math.sin(performance.now() / 1000 + obj.x) * 10;
        
        for (let i = 1; i <= segments; i++) {
          const y = obj.y - i * segHeight;
          const xOffset = Math.sin(i * 0.5 + performance.now() / 800) * (i * 2);
          ctx.lineTo(obj.x + xOffset, y);
        }
        // Width at top
        ctx.lineTo(obj.x + sway + 5, obj.y - obj.h);
        
        // Down other side
        for (let i = segments; i >= 1; i--) {
          const y = obj.y - i * segHeight;
          const xOffset = Math.sin(i * 0.5 + performance.now() / 800) * (i * 2);
          ctx.lineTo(obj.x + xOffset + 8, y);
        }
        ctx.lineTo(obj.x + 10, obj.y);
        ctx.fill();
      } else if (obj.type === 'coral') {
        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.moveTo(obj.x, obj.y);
        // Random jagged shape
        ctx.lineTo(obj.x - obj.w/2, obj.y);
        ctx.lineTo(obj.x - obj.w/2 + 5, obj.y - obj.h * 0.6);
        ctx.lineTo(obj.x - obj.w/2 - 5, obj.y - obj.h * 0.8);
        ctx.lineTo(obj.x, obj.y - obj.h);
        ctx.lineTo(obj.x + obj.w/2 + 5, obj.y - obj.h * 0.7);
        ctx.lineTo(obj.x + obj.w/2, obj.y);
        ctx.fill();
      } else if (obj.type === 'bubble') {
        // Update bubble position (float up)
        obj.y -= obj.speed * 0.016; // approximate dt
        if (obj.y < -20) obj.y = this.height + 20;
        
        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.r, 0, Math.PI * 2);
        ctx.fill();
        // Shine
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(obj.x - obj.r * 0.3, obj.y - obj.r * 0.3, obj.r * 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (obj.type === 'star') {
        ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(performance.now() / 500 + obj.x) * 0.5})`;
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (obj.type === 'planet') {
        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.r, 0, Math.PI * 2);
        ctx.fill();
        // Shadow (Crescent)
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.r, 0, Math.PI * 2);
        ctx.fill();
        
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.arc(obj.x - obj.r*0.3, obj.y - obj.r*0.3, obj.r*0.4, 0, Math.PI * 2);
        ctx.fill();
        
        if (obj.hasRing) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(obj.x, obj.y, obj.r * 1.8, obj.r * 0.5, Math.PI / 6, 0, Math.PI * 2);
            ctx.stroke();
        }
      } else if (obj.type === 'asteroid') {
        // Move asteroid
        obj.x += obj.speed * 0.016;
        if (obj.x > this.width + 50) obj.x = -50;
        if (obj.x < -50) obj.x = this.width + 50;
        
        ctx.fillStyle = '#636e72';
        ctx.beginPath();
        ctx.save();
        ctx.translate(obj.x, obj.y);
        // Rotate slowly
        ctx.rotate(performance.now() / 1000 * 0.5);
        if (obj.vertices.length > 0) {
            ctx.moveTo(obj.vertices[0].x, obj.vertices[0].y);
            for (let i = 1; i < obj.vertices.length; i++) {
                ctx.lineTo(obj.vertices[i].x, obj.vertices[i].y);
            }
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    });
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
    
    // Handle main menu
    if (this.showMainMenu) {
      this._updateMainMenu(dt);
      return;
    }
    
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
    
    // Update level intro timer
    if (this.levelIntroTimer > 0) {
      this.levelIntroTimer -= dt;
      // Freeze game logic during intro
      return;
    }
    
    // Handle win animation
    if (this.won && this.winAnimationTimer > 0) {
      this.winAnimationTimer -= dt;
      if (this.winAnimationTimer <= 0) {
        // Special case for Tutorial Level (Index 0)
        if (this.currentLevelIndex === 0) {
          // Return to Main Menu after tutorial
          this.showMainMenu = true;
          this.showLevelSelect = false;
          this.gameOver = false;
          this.won = false;
          this.score = 0;
          this.levelStartScore = 0;
          return;
        }

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
            // Music continues
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
      
      // Bonus for full health completion
      const maxLives = this.twoPlayerMode ? 5 : 3;
      if (this.lives >= maxLives) {
        this.perfectClear = true;
        this.score += 1000;
        // Play win/score sound for full health bonus
        if (this.audio && this.audio.playSfx) {
          this.audio.playSfx('win');
        }
        // Extra celebration for perfect run
        this.spawnParticles(this.width / 2, this.height / 2, '#ffd700', 60);
        this.screenShake(15, 0.6);
        this.flash('#ffd700', 0.4);
      } else {
        this.audio.playSfx && this.audio.playSfx('stomp'); // Use available sound effect
        // Spawn celebration particles
        this.spawnParticles(this.width / 2, this.height / 2, '#4ade80', 30);
        this.screenShake(8, 0.3);
        this.flash('#4ade80', 0.2);
      }

      const levelScore = this.score - this.levelStartScore;
      // Save high score when level is completed
      if (this.saveHighScore(this.currentLevelIndex, levelScore)) {
        this.newRecord = true;
        if (this.audio && this.audio.playSfx) {
          this.audio.playSfx('score');
        }
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

    // Special Enemy Spawner (Continuous)
    this._specialEnemyTimer += dt;
    // Spawn every 5-10 seconds, decreasing with level
    const specialInterval = Math.max(2.0, 8.0 - (levelNum * 0.5));
    
    if (this._specialEnemyTimer >= specialInterval) {
      this._specialEnemyTimer = 0;
      
      // Pick a random type (excluding tadpole)
      // Weighted random: higher levels unlock harder enemies
      let availableTypes = ['walker'];
      if (levelNum >= 2) availableTypes.push('roamer');
      if (levelNum >= 3) availableTypes.push('jumper');
      if (levelNum >= 4) availableTypes.push('floater');
      if (levelNum >= 5) availableTypes.push('chaser');
      
      const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
      
      // Spawn at random edge
      const edge = Math.floor(Math.random() * 4);
      const wallThickness = 12;
      const spawnMargin = 40;
      const groundY = this.currentLevel ? this.currentLevel.groundY : 60;
      
      let x, y;
      if (edge === 0) { // top
        x = Math.random() * (this.width - 100) + 50;
        y = wallThickness + spawnMargin;
      } else if (edge === 1) { // bottom (ground)
        x = Math.random() * (this.width - 100) + 50;
        y = this.height - groundY - 40;
      } else if (edge === 2) { // left
        x = wallThickness + spawnMargin;
        y = Math.random() * (this.height - groundY - 100) + 50;
      } else { // right
        x = this.width - wallThickness - spawnMargin - 40;
        y = Math.random() * (this.height - groundY - 100) + 50;
      }
      
      const enemy = new Enemy(x, y, type);
      this.entities.push(enemy);
      this.enemies.push(enemy);
      
      // Spawn effect
      this.spawnParticles(x + enemy.w/2, y + enemy.h/2, '#ffcc00', 10);
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
      if (!(e instanceof Player) && this.currentLevel && this.currentLevel.safeHaven) {
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

    // Check safe haven and collision for each player
    for (const p of this.players) {
      if (!p.alive) continue;

      let pInSafeHaven = false;
      if (this.currentLevel && this.currentLevel.safeHaven) {
        const haven = this.currentLevel.safeHaven;
        const pb = p.getBounds();
        pInSafeHaven = 
          pb.x < haven.x + haven.w &&
          pb.x + pb.w > haven.x &&
          pb.y < haven.y + haven.h &&
          pb.y + pb.h > haven.y;
      }

      // collision: player vs enemies (only if player is not in safe haven)
      for (const en of this.enemies) {
        if (!en.alive) continue;
        if (!pInSafeHaven && rectsIntersect(p.getBounds(), en.getBounds())) {
          if (en.type === 'tadpole') {
            // tadpole always damages player, then dies
            if (!p.invulnerable) {
              p.takeHit(en, this);
              if (this.lives <= 0) {
                this.gameOver = true;
                // Music continues
              }
            }
            en.alive = false;
            this.spawnParticles(en.pos.x + en.w / 2, en.pos.y + en.h / 2, '#00e0ff', 10);
          } else {
            // Non-tadpole enemies: player can kill them by touching (no stomp required)
            en.alive = false;
            this.audio.playSfx('stomp');
            
            // Different effects based on enemy type
            let scoreBonus = 100;
            let particleColor = '#ff4d4d';
            let effectText = '';
            
            if (en.type === 'walker') {
                scoreBonus = 100;
                particleColor = '#ef5350';
            } else if (en.type === 'chaser') {
                scoreBonus = 200;
                particleColor = '#ffab91';
                effectText = 'SPEED UP!';
                // Speed boost
                p.speedBoostTimer = 5.0;
            } else if (en.type === 'jumper') {
                scoreBonus = 150;
                particleColor = '#ffe082';
                effectText = 'HIGH JUMP!';
                // Jump boost
                p.jumpBoostTimer = 5.0;
            } else if (en.type === 'roamer') {
                scoreBonus = 150;
                particleColor = '#b39ddb';
                effectText = 'HEAL +1';
                // Heal
                const maxLives = this.twoPlayerMode ? 5 : 3;
                if (this.lives < maxLives) {
                    this.lives++;
                    const livesEl = document.getElementById('lives');
                    if (livesEl) livesEl.innerHTML = `<span class="hud-icon">❤️</span> <span class="hud-value">${this.lives}</span>`;
                }
            } else if (en.type === 'floater') {
                scoreBonus = 300;
                particleColor = '#81c784';
                effectText = 'SHIELD!';
                // Invulnerability
                p.invulnerable = true;
                p.invulTimer = 3.0;
            }
            
            this.score += scoreBonus;
            
            // Show effect text (using flash color as hint)
            if (effectText) {
                this.flash(particleColor, 0.15);
            } else {
                this.flash('#ffffff', 0.08);
            }

            // Play score sound for bonus
            setTimeout(() => {
              if (this.audio && this.audio.playSfx) {
                this.audio.playSfx('score');
              }
            }, 50);
            
            // spawn particles
            this.spawnParticles(en.pos.x + en.w / 2, en.pos.y + en.h / 2, particleColor, 18);
            
            // If player was falling, give a small bounce
            if (p.vel.y > 0) {
              const bounce = Math.min(300, Math.abs(p.vel.y) * 0.3 + 100);
              p.vel.y = -bounce;
            }
            
            // small screen shake
            this.screenShake(4, 0.15);
          }
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
      scoreEl.innerHTML = `<span class="hud-icon">🏆</span> <span class="hud-value">${bestScore}</span>`;
    }
    const livesEl = document.getElementById('lives');
    if (livesEl) livesEl.innerHTML = `<span class="hud-icon">❤️</span> <span class="hud-value">${this.lives}</span>`;
    
    // Update level UI (even during win animation)
    const levelEl = document.getElementById('level');
    if (levelEl) {
      levelEl.textContent = `🚩 Level ${this.currentLevelIndex}: ${this.currentLevel.name}`;
    }
    const timerEl = document.getElementById('timer');
    if (timerEl) {
      if (this.won) {
        timerEl.innerHTML = `<span class="hud-icon">⏱️</span> <span class="hud-value">0.0s</span>`;
      } else {
        const remaining = Math.max(0, this.survivalTime - this.levelTimer);
        timerEl.innerHTML = `<span class="hud-icon">⏱️</span> <span class="hud-value">${remaining.toFixed(1)}s</span>`;
      }
    }
    const levelScoreEl = document.getElementById('level-score');
    if (levelScoreEl) {
      const levelScore = this.score - this.levelStartScore;
      levelScoreEl.innerHTML = `<span class="hud-icon">⭐</span> <span class="hud-value">${levelScore}</span>`;
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

    // Render main menu
    if (this.showMainMenu) {
      this._renderMainMenu(ctx);
      return;
    }

    // Render level selection menu
    if (this.showLevelSelect) {
      this._renderLevelSelect(ctx);
      return;
    }
    
    // Show HUD and OPS elements when playing
    const hudEl = document.getElementById('hud');
    const opsEl = document.getElementById('ops');
    const levelContainerEl = document.getElementById('level-container');
    const backBtn = document.getElementById('back-btn');
    if (hudEl) hudEl.style.display = '';
    if (opsEl) opsEl.style.display = '';
    if (levelContainerEl) levelContainerEl.style.display = '';
    if (backBtn) backBtn.style.display = '';

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

    // --- Background ---
    let bgGradient;
    
    if (this.currentLevelStyle === 0) {
      // Neon Style
      bgGradient = ctx.createRadialGradient(
        this.width / 2, this.height / 2, 0,
        this.width / 2, this.height / 2, this.width * 0.8
      );
      bgGradient.addColorStop(0, '#1e293b'); // Lighter center
      bgGradient.addColorStop(1, '#0f172a'); // Darker corners
    } else if (this.currentLevelStyle === 1) {
      // Cyber-Nature Style
      bgGradient = ctx.createRadialGradient(
        this.width / 2, this.height / 2, 0,
        this.width / 2, this.height / 2, this.width * 0.8
      );
      bgGradient.addColorStop(0, '#1e293b'); // Lighter center
      bgGradient.addColorStop(1, '#0f172a'); // Darker corners
    } else if (this.currentLevelStyle === 2) {
      // Nature Style (Qingshan Lushui)
      bgGradient = ctx.createLinearGradient(0, 0, 0, this.height);
      bgGradient.addColorStop(0, '#87CEEB'); // Sky Blue
      bgGradient.addColorStop(0.6, '#E0F7FA'); // Light Cyan (Horizon)
      bgGradient.addColorStop(1, '#4FC3F7'); // Water reflection hint
    } else if (this.currentLevelStyle === 3) {
      // Underwater Style
      bgGradient = ctx.createLinearGradient(0, 0, 0, this.height);
      bgGradient.addColorStop(0, '#0984e3'); // Deep Blue Surface
      bgGradient.addColorStop(1, '#2d3436'); // Dark Depths
    } else if (this.currentLevelStyle === 4) {
      // Space Style
      bgGradient = ctx.createRadialGradient(
        this.width / 2, this.height / 2, 0,
        this.width / 2, this.height / 2, this.width
      );
      bgGradient.addColorStop(0, '#2d3436');
      bgGradient.addColorStop(1, '#000000');
    }
    
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Draw Scenery (if any)
    this._renderScenery(ctx);
    
    // Grid effect with drift
    ctx.save();
    if (this.currentLevelStyle === 2) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; // Subtle white for Nature
    } else if (this.currentLevelStyle === 3) {
      ctx.strokeStyle = 'rgba(129, 236, 236, 0.1)'; // Faint Cyan for Underwater
    } else if (this.currentLevelStyle === 4) {
      ctx.strokeStyle = 'rgba(162, 155, 254, 0.1)'; // Faint Purple for Space
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'; // Faint for Neon/Cyber
    }
    ctx.lineWidth = 1;
    const gridSize = 50;
    const time = performance.now() / 1000;
    const driftX = (time * 15) % gridSize;
    const driftY = (time * 10) % gridSize;
    
    ctx.beginPath();
    for (let x = -gridSize + driftX; x <= this.width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let y = -gridSize + driftY; y <= this.height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();
    ctx.restore();

    // Tutorial Text
    if (this.currentLevelIndex === 0 && !this.showMainMenu && !this.showLevelSelect) {
      ctx.save();
      ctx.font = 'bold 20px sans-serif';
      
      if (this.twoPlayerMode) {
        // P1 Controls (Left side)

        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff'; // P1 Color
        ctx.fillText('P1 (White):', 100, 320);
        ctx.fillText('A / D to Move', 100, 350);
        ctx.fillText('W / Space to Jump', 100, 380);
        ctx.fillText('L-Shift / K to Dash', 100, 410);

        // P2 Controls (Right side)
        ctx.fillStyle = '#ffd166'; // P2 Color
        ctx.fillText('P2 (Yellow):', 650, 320);
        ctx.fillText('Arrows to Move', 650, 350);
        ctx.fillText('Up / Enter to Jump', 650, 380);
        ctx.fillText('R-Shift / / to Dash', 650, 410);
        
        // Common
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        // ctx.fillText('Hold Jump for higher jump', 400, 460);
        
        // Wall Jump (Vertical)
        ctx.save();
        ctx.translate(685, 160);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Jump against walls', 0, -12);
        ctx.fillText('to Wall Climb', 0, 12);
        ctx.restore();
      } else {
        // Single Player Controls
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        
        // Movement
        ctx.fillText('← → / A D to Move', 150, 400);
        
        // Jump
        ctx.fillText('SPACE / W to Jump', 400, 350);
        // ctx.fillText('Hold for higher jump', 400, 380);
        
        // Wall Jump (Vertical)
        ctx.save();
        ctx.translate(685, 160);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Jump against walls', 0, -12);
        ctx.fillText('to Wall Climb', 0, 12);
        ctx.restore();
        
        // Dash
        ctx.fillText('SHIFT / K to Dash', 150, 450);
      }
      
      // Win Condition
      ctx.save();
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GOAL: SURVIVE 20 SECONDS!', this.width / 2, 60);
      
      // Scoring Info
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#4ade80';
      ctx.fillText('⚔️ Kill Enemies: +100Points/Enemy', this.width / 2, 95);
      ctx.fillStyle = '#60a5fa';
      ctx.fillText('✨ Perfect Clear (Full HP): +1000 Bonus', this.width / 2, 125);
      ctx.restore();

      // HUD Explanations (Pointing to the right)
      ctx.save();
      ctx.textAlign = 'right';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      
      const rightX = this.width - 20;
      // Approximate positions to match external HUD
      ctx.fillText('Survival Time ⏱️ ➜', rightX, 30);
      ctx.fillText('Total Score 🏆 ➜', rightX, 95);
      ctx.fillText('Level Score ⭐ ➜', rightX, 160);
      ctx.fillText('Lives ❤️ ➜', rightX, 225);
      
      ctx.restore();
      
      // Safe Haven (Dynamic)
      if (this.currentLevel && this.currentLevel.safeHaven && this.safeHavenActive) {
        const haven = this.currentLevel.safeHaven;
        ctx.fillStyle = '#4ade80';
        ctx.textAlign = 'center';
        ctx.fillText('Safe Haven: Hover here!', haven.x + haven.w / 2, haven.y - 20);
      }
      
      ctx.restore();
    }

    // simple ground
    if (this.currentLevel) {
      const groundH = this.currentLevel.groundY || 60;
      const groundY = this.height - groundH;
      
      // Ground Gradient
      const gGrad = ctx.createLinearGradient(0, groundY, 0, this.height);
      gGrad.addColorStop(0, '#1e293b');
      gGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = gGrad;
      ctx.fillRect(0, groundY, this.width, groundH);
      
      // Top Neon Line
      ctx.shadowColor = '#4ade80';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(0, groundY, this.width, 2);
      ctx.shadowBlur = 0;
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
          // Wall Gradient
          const wGrad = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
          wGrad.addColorStop(0, '#334155');
          wGrad.addColorStop(1, '#1e293b');
          ctx.fillStyle = wGrad;
          
          // Rounded rect for walls
          const r = 4;
          ctx.beginPath();
          ctx.roundRect(o.x, o.y, o.w, o.h, r);
          ctx.fill();
          
          // Neon Border
          ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)'; // Greenish glow
          ctx.lineWidth = 2;
          ctx.stroke();
          
        } else if (o.type === 'platform') {
          // Glowing Platform
          ctx.shadowColor = '#3b82f6';
          ctx.shadowBlur = 8;
          ctx.fillStyle = '#3b82f6';
          const h = o.h || 8;
          
          ctx.beginPath();
          ctx.roundRect(o.x, o.y, o.w, h, 4);
          ctx.fill();
          ctx.shadowBlur = 0;
          
          // Top highlight
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.fillRect(o.x + 2, o.y, o.w - 4, 2);
          
        } else if (o.type === 'oneway') {
          ctx.fillStyle = 'rgba(160, 210, 255, 0.3)';
          const h = o.h || 8;
          ctx.fillRect(o.x, o.y, o.w, h);
          
          // Dotted line top
          ctx.strokeStyle = '#a0d2ff';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(o.x, o.y);
          ctx.lineTo(o.x + o.w, o.y);
          ctx.stroke();
          ctx.setLineDash([]);
          
        } else if (o.type === 'slope') {
          // Slope Gradient
          const sGrad = ctx.createLinearGradient(o.x, o.y, o.x, o.y + (o.h || 80));
          sGrad.addColorStop(0, '#334155');
          sGrad.addColorStop(1, '#1e293b');
          ctx.fillStyle = sGrad;
          
          const x = o.x, w = o.w, h = o.h || 80;
          ctx.beginPath();
          if (o.dir === 'right') {
            ctx.moveTo(x, o.y + h);
            ctx.lineTo(x + w, o.y + h);
            ctx.lineTo(x + w, o.y + h - h);
          } else {
            ctx.moveTo(x, o.y + h);
            ctx.lineTo(x + w, o.y + h - h);
            ctx.lineTo(x + w, o.y + h);
          }
          ctx.closePath();
          ctx.fill();
          
          // Slope Border
          ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)';
          ctx.lineWidth = 2;
          ctx.stroke();
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

    // Level Intro Animation
    if (this.levelIntroTimer > 0 && !this.gameOver && !this.won) {
      const t = this.levelIntroTimer;
      const duration = this.levelIntroDuration;
      const progress = 1 - (t / duration); // 0 to 1
      
      ctx.save();
      
      // 1. Level Name (First part)
      if (progress < 0.65) {
        // Fade in/out
        let alpha = 1;
        if (progress < 0.1) alpha = progress * 10;
        else if (progress > 0.55) alpha = (0.65 - progress) * 10;
        
        ctx.globalAlpha = alpha;
        
        // Background strip
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, this.height / 2 - 70, this.width, 140);
        
        // Decorative lines
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, this.height / 2 - 70);
        ctx.lineTo(this.width, this.height / 2 - 70);
        ctx.moveTo(0, this.height / 2 + 70);
        ctx.lineTo(this.width, this.height / 2 + 70);
        ctx.stroke();
        
        // Level Number
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#4ade80';
        ctx.shadowBlur = 10;
        ctx.fillText(`LEVEL ${this.currentLevelIndex}`, this.width / 2, this.height / 2 - 25);
        ctx.shadowBlur = 0;
        
        // Level Name
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 56px sans-serif';
        const levelName = (this.currentLevel && this.currentLevel.name) ? this.currentLevel.name : 'UNKNOWN SECTOR';
        ctx.fillText(levelName.toUpperCase(), this.width / 2, this.height / 2 + 35);
      }
      
      // 2. "READY"
      else if (progress < 0.85) {
         const subProgress = (progress - 0.65) / 0.2; // 0 to 1
         let alpha = 1;
         if (subProgress < 0.2) alpha = subProgress * 5;
         if (subProgress > 0.8) alpha = (1 - subProgress) * 5;
         
         ctx.globalAlpha = alpha;
         ctx.fillStyle = '#ffd700';
         ctx.font = '900 72px "Arial Black", sans-serif';
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         ctx.shadowColor = '#ffd700';
         ctx.shadowBlur = 20;
         ctx.fillText('READY?', this.width / 2, this.height / 2);
      }
      
      // 3. "GO!"
      else {
         const subProgress = (progress - 0.85) / 0.15; // 0 to 1
         // Scale effect
         const scale = 1 + subProgress * 1.5; 
         const alpha = 1 - subProgress; // Fade out
         
         ctx.translate(this.width / 2, this.height / 2);
         ctx.scale(scale, scale);
         
         ctx.globalAlpha = alpha;
         ctx.fillStyle = '#4ade80';
         ctx.font = '900 100px "Arial Black", sans-serif';
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         ctx.shadowColor = '#4ade80';
         ctx.shadowBlur = 30;
         ctx.fillText('GO!', 0, 0);
      }
      
      ctx.restore();
    }
    
    if (this.gameOver && !this.won) {
      // Dark Overlay
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, this.width, this.height);
      
      // Game Over Text
      ctx.save();
      ctx.shadowColor = '#ff4d4d';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#ff4d4d';
      ctx.font = '900 64px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 80);
      ctx.restore();

      // Buttons
      const btnW = 200;
      const btnH = 50;
      const btnX = this.width / 2 - btnW / 2;
      
      // RESTART Button
      const restartY = this.height / 2 + 10;
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.roundRect(btnX, restartY, btnW, btnH, 10);
      ctx.fill();
      
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('RESTART (R)', this.width / 2, restartY + btnH / 2);
      
      // BACK Button
      const backY = restartY + btnH + 20;
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.roundRect(btnX, backY, btnW, btnH, 10);
      ctx.fill();
      
      ctx.fillStyle = '#0f172a';
      ctx.fillText('BACK (ESC)', this.width / 2, backY + btnH / 2);
    } else if (this.gameOver && this.won && this.allLevelsCompleted()) {
      // Hide HUD and OPS elements when showing final completion screen
      const hudEl = document.getElementById('hud');
      const opsEl = document.getElementById('ops');
      const levelContainerEl = document.getElementById('level-container');
      if (hudEl) hudEl.style.display = 'none';
      if (opsEl) opsEl.style.display = 'none';
      if (levelContainerEl) levelContainerEl.style.display = 'none';
      
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
      ctx.fillStyle = '#e2e8f0';
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
      ctx.fillStyle = '#cbd5e1';
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
  
  resetScores() {
    // Reset all scores
    this.highScores = new Array(levels.length).fill(0);
    this.completedLevels = new Array(levels.length).fill(false);
    this.totalScore = 0;
    
    // Clear localStorage
    try {
      localStorage.removeItem('levelHighScores');
      localStorage.removeItem('completedLevels');
    } catch (e) {
      console.warn('Failed to clear local storage:', e);
    }
    

    
    // Visual feedback
    this.flash('#ff6b6b', 0.2);
    this.screenShake(10, 0.3);
    if (this.audio) this.audio.playSfx('explosion');
  }
  
  _renderLevelSelect(ctx) {
    // Hide HUD and OPS elements when in level select menu
    const hudEl = document.getElementById('hud');
    const opsEl = document.getElementById('ops');
    const levelContainerEl = document.getElementById('level-container');
    const backBtn = document.getElementById('back-btn');
    if (hudEl) hudEl.style.display = 'none';
    if (opsEl) opsEl.style.display = 'none';
    if (levelContainerEl) levelContainerEl.style.display = 'none';
    if (backBtn) backBtn.style.display = 'none';

    const time = performance.now() / 1000;

    // 1. Dynamic Background based on Style
    let bgGrad;
    if (this.bgStyle === 0) { // Neon
        bgGrad = ctx.createRadialGradient(this.width/2, this.height/2, 0, this.width/2, this.height/2, this.width);
        bgGrad.addColorStop(0, '#2d1b4e');
        bgGrad.addColorStop(1, '#0f0518');
    } else if (this.bgStyle === 1) { // Cyber
        bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
        bgGrad.addColorStop(0, '#0f172a');
        bgGrad.addColorStop(1, '#1e293b');
    } else if (this.bgStyle === 2) { // Nature
        bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
        bgGrad.addColorStop(0, '#87CEEB');
        bgGrad.addColorStop(1, '#E0F7FA');
    } else if (this.bgStyle === 3) {
        // Underwater
        bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
        bgGrad.addColorStop(0, '#0984e3');
        bgGrad.addColorStop(1, '#000000');
    } else if (this.bgStyle === 4) { // Space
        bgGrad = ctx.createRadialGradient(this.width/2, this.height/2, 0, this.width/2, this.height/2, this.width);
        bgGrad.addColorStop(0, '#1e293b');
        bgGrad.addColorStop(1, '#020617');
    } else { // Random
        // Shifting gradient
        const hue = (time * 20) % 360;
        bgGrad = ctx.createLinearGradient(0, 0, this.width, this.height);
        bgGrad.addColorStop(0, `hsl(${hue}, 40%, 20%)`);
        bgGrad.addColorStop(1, `hsl(${(hue + 60) % 360}, 40%, 10%)`);
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.width, this.height);
    
    // Nebula Effects (Only for Space/Neon/Cyber)
    if (this.bgStyle !== 2) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        // Nebula 1 (Purple/Blue)
        const neb1X = this.width * 0.3 + Math.sin(time * 0.2) * 100;
        const neb1Y = this.height * 0.4 + Math.cos(time * 0.3) * 50;
        const neb1Grad = ctx.createRadialGradient(neb1X, neb1Y, 0, neb1X, neb1Y, 400);
        neb1Grad.addColorStop(0, 'rgba(76, 29, 149, 0.2)'); // Purple
        neb1Grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = neb1Grad;
        ctx.fillRect(0, 0, this.width, this.height);

        // Nebula 2 (Teal/Green)
        const neb2X = this.width * 0.7 + Math.cos(time * 0.25) * 100;
        const neb2Y = this.height * 0.6 + Math.sin(time * 0.35) * 50;
        const neb2Grad = ctx.createRadialGradient(neb2X, neb2Y, 0, neb2X, neb2Y, 350);
        neb2Grad.addColorStop(0, 'rgba(16, 185, 129, 0.15)'); // Emerald
        neb2Grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = neb2Grad;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.restore();
    }

    // Animated Grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const gridSize = 50;
    ctx.beginPath();
    for (let x = 0; x <= this.width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let y = 0; y <= this.height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();
    ctx.restore();
    
    // Floating particles (background decoration)
    for(let i=0; i<40; i++) {
        // Drifting upwards
        const speed = (i % 5 + 1) * 20;
        const yOffset = (time * speed) % this.height;
        
        const px = (Math.sin(i * 132.1) * 0.5 + 0.5) * this.width;
        let py = (Math.cos(i * 45.3) * 0.5 + 0.5) * this.height - yOffset;
        if (py < 0) py += this.height; // Wrap around
        
        const size = (Math.sin(i + time * 2) + 2) * 1.5;
        const alpha = 0.1 + Math.sin(i * 10 + time) * 0.05;
        
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI*2);
        ctx.fill();
    }

    // Shooting Stars
    const starTime = time * 0.7; 
    const starCycle = Math.floor(starTime);
    const starProgress = starTime - starCycle; // 0 to 1
    
    if (starProgress < 0.15) { // Visible for first 15% of cycle
         // Pseudo-random pos based on cycle
         const seed = starCycle * 123.45;
         const sx = (Math.sin(seed) * 0.5 + 0.5) * this.width;
         const sy = (Math.cos(seed) * 0.5 + 0.5) * this.height * 0.6; 
         const len = 150;
         
         ctx.save();
         const fade = 1 - (starProgress / 0.15);
         const grad = ctx.createLinearGradient(sx, sy, sx - len, sy + len);
         grad.addColorStop(0, `rgba(255, 255, 255, ${fade})`);
         grad.addColorStop(1, `rgba(255, 255, 255, 0)`);
         
         ctx.strokeStyle = grad;
         ctx.lineWidth = 2;
         ctx.beginPath();
         ctx.moveTo(sx, sy);
         ctx.lineTo(sx - len, sy + len); // Diagonal down-left
         ctx.stroke();
         ctx.restore();
    }

    // 2. Header Section
    const titleY = 40;
    
    // Title Glow
    ctx.save();
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#fff';
    ctx.font = '900 48px "Arial Black", sans-serif'; // Thicker, more impactful font
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SELECT LEVEL', this.width / 2, titleY);
    ctx.shadowBlur = 0;
    
    // Style Indicator (Below Title)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`🎨 Style: ${this.bgStyles[this.bgStyle]} (Y)`, this.width / 2, titleY + 40);
    ctx.restore();
    
    // Total Score Pill (Top Right)
    const scoreText = `Total Score: ${this.totalScore}`;
    ctx.font = 'bold 16px sans-serif';
    const scoreWidth = ctx.measureText(scoreText).width + 50;
    const scoreH = 36;
    const scoreX = this.width - scoreWidth - 20;
    const scoreY = 20;
    
    // Glass pill
    ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(scoreX, scoreY, scoreWidth, scoreH, 18);
    ctx.fill();
    ctx.stroke();
    
    // Trophy Icon & Text
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆 ' + scoreText, scoreX + 15, scoreY + scoreH/2);

    // 3. Mode Toggle (1P / 2P)
    const modeY = 100;
    const modeW = 300;
    const modeH = 36;
    const modeX = this.width / 2 - modeW / 2;
    
    // Toggle Container
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(modeX, modeY, modeW, modeH, 18);
    ctx.fill();
    ctx.stroke();
    
    // Active Selection Pill
    const activeX = this.twoPlayerMode ? modeX + modeW/2 : modeX;
    ctx.fillStyle = this.twoPlayerMode ? '#f59e0b' : '#10b981'; // Amber or Emerald
    ctx.shadowColor = this.twoPlayerMode ? '#f59e0b' : '#10b981';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.roundRect(activeX + 4, modeY + 4, modeW/2 - 8, modeH - 8, 14);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Text Labels
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.fillStyle = !this.twoPlayerMode ? '#fff' : '#cbd5e1';
    ctx.fillText('1 PLAYER', modeX + sliderW/2, modeY + modeH/2);
    
    ctx.fillStyle = this.twoPlayerMode ? '#fff' : '#cbd5e1';
    ctx.fillText('2 PLAYERS', modeX + sliderW * 1.5, modeY + modeH/2);
    
    // Instructions
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px sans-serif';
    ctx.fillText('Arrows/WASD: Move • Enter: Select • TAB: Toggle Mode', this.width / 2, modeY + modeH + 20);
    
    // Back Button (Top Left)
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('⬅ BACK', 20, 20);
    ctx.restore();

    // 4. Level Grid
    const cols = 3;
    const displayLevels = levels.length - 1; // Skip tutorial
    const cardW = 260;
    const cardH = 120;
    const gap = 20;
    
    const gridW = cols * cardW + (cols - 1) * gap;
    const startX = (this.width - gridW) / 2;
    const startY = 180;

    for (let i = 1; i < levels.length; i++) {
      const gridIndex = i - 1;
      const col = gridIndex % cols;
      const row = Math.floor(gridIndex / cols);
      
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);
      
      const isSelected = (i === this.selectedLevelIndex);
      const isCompleted = this.completedLevels[i];
      const highScore = this.highScores[i] || 0;
      const level = levels[i];
      
      // Card Animation
      let scale = 1;
      let lift = 0;
      if (isSelected) {
        // Pulse effect
        const pulse = Math.sin(time * 5) * 0.02;
        scale = 1.05 + pulse;
        lift = -5 + pulse * 10;
      }
      
      const cx = x + cardW/2;
      const cy = y + cardH/2;
      
      ctx.save();
      ctx.translate(cx, cy + lift);
      ctx.scale(scale, scale);
      
      // Card Background
      // Gradient based on completion or selection
      const cardGrad = ctx.createLinearGradient(0, -cardH/2, 0, cardH/2);
      if (isSelected) {
        cardGrad.addColorStop(0, '#1e293b');
        cardGrad.addColorStop(1, '#0f172a');
        
        // Pulsing border
        const alpha = 0.6 + Math.sin(time * 5) * 0.4;
        ctx.strokeStyle = `rgba(74, 222, 128, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = '#4ade80';
        ctx.shadowBlur = 15 + Math.sin(time * 5) * 5;
      } else {
        cardGrad.addColorStop(0, 'rgba(30, 41, 59, 0.6)');
        cardGrad.addColorStop(1, 'rgba(15, 23, 36, 0.6)');
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
      }
      
      ctx.fillStyle = cardGrad;
      ctx.beginPath();
      ctx.roundRect(-cardW/2, -cardH/2, cardW, cardH, 12);
      ctx.fill();
      ctx.stroke();
      
      // Level Number Badge
      ctx.beginPath();
      ctx.arc(-cardW/2 + 30, -cardH/2 + 30, 18, 0, Math.PI*2);
      ctx.fillStyle = isCompleted ? '#4ade80' : (isSelected ? '#fff' : '#334155');
      ctx.fill();
      
      ctx.fillStyle = isCompleted ? '#0f172a' : (isSelected ? '#0f172a' : '#94a3b8');
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(i.toString(), -cardW/2 + 30, -cardH/2 + 30);
      
      // Level Name
      ctx.textAlign = 'left';
      ctx.fillStyle = isSelected ? '#fff' : '#cbd5e1';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(level.name || `Level ${i}`, -cardW/2 + 60, -cardH/2 + 25);
      
      // High Score Display
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText('Best Score', -cardW/2 + 20, 5);
      
      ctx.fillStyle = highScore > 0 ? '#ffd700' : '#64748b';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(highScore.toString(), -cardW/2 + 20, 28);
      
      // Star Rating
      if (highScore > 0) {
          let stars = 1;
          if (highScore >= 1000) stars = 3;
          else if (highScore >= 400) stars = 2;
          
          ctx.fillStyle = '#ffd700';
          ctx.font = '16px sans-serif';
          let starStr = '⭐'.repeat(stars);
          ctx.textAlign = 'right';
          ctx.fillText(starStr, cardW/2 - 15, 28);
      }
      
      // Completed Checkmark (Big background watermark)
      if (isCompleted) {
        ctx.save();
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✓', cardW/2 - 40, 0);
        ctx.restore();
      }
      
      ctx.restore();
    }
  }
  
  _initMenuPlayers() {
    this.menuPlayers = [];
    
    // Calculate positions for the toggle button platform
    const modeY = this.height / 2 + 130;
    const modeW = 260;
    const modeX = this.width / 2 - modeW / 2;
    const sliderW = modeW / 2;
    
    // Create 2 players standing on the toggle buttons
    // P1 on "1 PLAYER" side (Left)
    const p1 = new Player(modeX + sliderW/2 - 10, modeY - 20);
    p1.color = '#4ade80'; // Green
    p1.isCpu = true;
    p1.cpuTimer = 0;
    p1.cpuActionDuration = 0;
    p1.startDelay = 1.0; // Wait 1s before moving
    
    // P2 on "2 PLAYERS" side (Right)
    const p2 = new Player(modeX + sliderW * 1.5 - 10, modeY - 20);
    p2.color = '#ffd166'; // Yellow
    p2.isCpu = true;
    p2.cpuTimer = 0;
    p2.cpuActionDuration = 0;
    p2.startDelay = 1.0; // Wait 1s before moving
    
    this.menuPlayers.push(p1, p2);
  }
  
  _updateMainMenu(dt) {
    // Input handling moved to main.js to use event listener
    
    // Update menu players
    this.menuPlayers.forEach(p => {
      // Handle start delay
      if (p.startDelay > 0) {
        p.startDelay -= dt;
        p.cpuInput.left = false;
        p.cpuInput.right = false;
        p.cpuInput.jump = false;
        p.cpuInput.dash = false;
        
        // Still update physics so they fall/stand
        p.update(dt, this);
        
        // Keep them on the platform during delay
        const modeY = this.height / 2 + 130;
        const modeW = 260;
        const modeX = this.width / 2 - modeW / 2;
        
        if (p.pos.y + p.h >= modeY && p.pos.y + p.h <= modeY + 15 &&
            p.pos.x + p.w > modeX && p.pos.x < modeX + modeW) {
            p.pos.y = modeY - p.h;
            p.vel.y = 0;
            p.onGround = true;
        }
        return;
      }

      // Simple AI
      p.cpuTimer -= dt;
      if (p.cpuTimer <= 0) {
        // Pick new action
        p.cpuActionDuration = 0.5 + Math.random() * 1.5;
        p.cpuTimer = p.cpuActionDuration;
        
        // Random direction
        const dir = Math.random();
        p.cpuInput.left = dir < 0.4;
        p.cpuInput.right = dir > 0.6;
        
        // Random jump
        p.cpuInput.jump = Math.random() < 0.3;
        
        // Random dash
        p.cpuInput.dash = Math.random() < 0.1;
      } else {
          p.cpuInput.dash = false; 
      }
      
      p.update(dt, this);
      
      // Keep them in bounds (simple wrap or bounce)
      // Player.update clamps to 12px border, so we check against that with a small tolerance
      const border = 12;
      if (p.pos.x <= border + 2) { 
          p.cpuInput.left = false; 
          p.cpuInput.right = true; 
      }
      if (p.pos.x >= this.width - border - p.w - 2) { 
          p.cpuInput.right = false; 
          p.cpuInput.left = true; 
      }
      
      // Floor collision (since no level loaded)
      const groundY = this.height - 60;
      if (p.pos.y + p.h > groundY) {
        p.pos.y = groundY - p.h;
        p.vel.y = 0;
        p.onGround = true;
      }

      // Hidden Platform (Mode Toggle Button)
      // Allow menu players to stand on the 1P/2P toggle
      const modeY = this.height / 2 + 130;
      const modeW = 260;
      const modeX = this.width / 2 - modeW / 2;
      
      // Simple platform collision (one-way from top)
      if (p.vel.y >= 0 && // Falling
          p.pos.y + p.h >= modeY && // Feet below top
          p.pos.y + p.h <= modeY + 15 && // Feet within snap range
          p.pos.x + p.w > modeX && // Horizontal overlap
          p.pos.x < modeX + modeW) {
            
          p.pos.y = modeY - p.h;
          p.vel.y = 0;
          p.onGround = true;
      }
    });
  }
  
  handleMenuMouseMove(x, y) {
    if (!this.showMainMenu) return false;

    let hovering = false;

    // Check Menu Options
    const options = ['START GAME', 'TUTORIAL'];
    const startY = this.height / 2 + 10;
    const gap = 50;
    
    for (let i = 0; i < options.length; i++) {
      const optY = startY + i * gap;
      // Approximate text bounds (centered)
      const halfW = 120; // 240px wide
      const halfH = 20;  // 40px high
      
      if (x >= this.width / 2 - halfW && x <= this.width / 2 + halfW &&
          y >= optY - halfH && y <= optY + halfH) {
        this.mainMenuSelection = i;
        hovering = true;
      }
    }

    // Check Mode Toggle
    const modeY = this.height / 2 + 130;
    const modeW = 260;
    const modeH = 36;
    const modeX = this.width / 2 - modeW / 2;

    if (x >= modeX && x <= modeX + modeW &&
        y >= modeY && y <= modeY + modeH) {
      hovering = true;
    }

    return hovering;
  }

  handleMenuClick(x, y) {
    if (!this.showMainMenu) return;

    // Check Menu Options
    const options = ['START GAME', 'TUTORIAL'];
    const startY = this.height / 2 + 10;
    const gap = 50;
    
    for (let i = 0; i < options.length; i++) {
      const optY = startY + i * gap;
      const halfW = 120;
      const halfH = 20;
      
      if (x >= this.width / 2 - halfW && x <= this.width / 2 + halfW &&
          y >= optY - halfH && y <= optY + halfH) {
        // Execute selection
        if (i === 0) { // START GAME
           this.showMainMenu = false;
           this.showLevelSelect = true;
           if (this.audio) this.audio.playSfx('select');
        } else if (i === 1) { // TUTORIAL
           this.showMainMenu = false;
           this.loadLevel(0);
           if (this.audio) this.audio.playSfx('select');
        }
        return;
      }
    }

    // Check Mode Toggle
    const modeY = this.height / 2 + 130;
    const modeW = 260;
    const modeH = 36;
    const modeX = this.width / 2 - modeW / 2;

    if (x >= modeX && x <= modeX + modeW &&
        y >= modeY && y <= modeY + modeH) {
      this.twoPlayerMode = !this.twoPlayerMode;
      if (this.audio) this.audio.playSfx('select');
    }
  }
  
  handleLevelSelectMouseMove(x, y) {
    if (!this.showLevelSelect) return false;
    
    let hovering = false;

    // 1. Check Back Button (Top Left)
    // Approx bounds: x: 20-100, y: 20-45
    // Expanded for mobile touch
    if (x >= 0 && x <= 150 && y >= 0 && y <= 80) {
      hovering = true;
    }

    // 2. Check Style Toggle (Center, below title)
    // Approx bounds: x: width/2 - 100, width/2 + 100, y: 65-95 (titleY=40 + 40 offset approx)
    const titleY = 40;
    const styleY = titleY + 40;
    if (x >= this.width/2 - 100 && x <= this.width/2 + 100 && y >= styleY - 15 && y <= styleY + 15) {
      hovering = true;
    }

    // 3. Check Mode Toggle
    const modeY = 100;
    const modeW = 300;
    const modeH = 36;
    const modeX = this.width / 2 - modeW / 2;
    
    if (x >= modeX && x <= modeX + modeW &&
        y >= modeY && y <= modeY + modeH) {
      hovering = true;
    }

    // 4. Check Level Cards
    const cols = 3;
    const cardW = 260;
    const cardH = 120;
    const gap = 20;
    const gridW = cols * cardW + (cols - 1) * gap;
    const startX = (this.width - gridW) / 2;
    const startY = 180;

    for (let i = 1; i < levels.length; i++) {
      const gridIndex = i - 1;
      const col = gridIndex % cols;
      const row = Math.floor(gridIndex / cols);
      
      const cx = startX + col * (cardW + gap);
      const cy = startY + row * (cardH + gap);
      
      if (x >= cx && x <= cx + cardW &&
          y >= cy && y <= cy + cardH) {
        this.selectedLevelIndex = i;
        hovering = true;
      }
    }

    return hovering;
  }

  handleLevelSelectClick(x, y) {
    if (!this.showLevelSelect) return;

    // 1. Check Back Button
    // Expanded for mobile touch
    if (x >= 0 && x <= 150 && y >= 0 && y <= 80) {
      this.showLevelSelect = false;
      this.showMainMenu = true;
      if (this.audio) this.audio.playSfx('select');
      return;
    }

    // 2. Check Style Toggle
    const titleY = 40;
    const styleY = titleY + 40;
    if (x >= this.width/2 - 100 && x <= this.width/2 + 100 && y >= styleY - 15 && y <= styleY + 15) {
      this.bgStyle = (this.bgStyle + 1) % this.bgStyles.length;
      this._initScenery();
      if (this.audio) this.audio.playSfx('select');
      return;
    }

    // 3. Check Mode Toggle
    const modeY = 100;
    const modeW = 300;
    const modeH = 36;
    const modeX = this.width / 2 - modeW / 2;
    
    if (x >= modeX && x <= modeX + modeW &&
        y >= modeY && y <= modeY + modeH) {
      this.twoPlayerMode = !this.twoPlayerMode;
      if (this.audio) this.audio.playSfx('select');
      return;
    }

    // 4. Check Level Cards
    const cols = 3;
    const cardW = 260;
    const cardH = 120;
    const gap = 20;
    const gridW = cols * cardW + (cols - 1) * gap;
    const startX = (this.width - gridW) / 2;
    const startY = 180;

    for (let i = 1; i < levels.length; i++) {
      const gridIndex = i - 1;
      const col = gridIndex % cols;
      const row = Math.floor(gridIndex / cols);
      
      const cx = startX + col * (cardW + gap);
      const cy = startY + row * (cardH + gap);
      
      if (x >= cx && x <= cx + cardW &&
          y >= cy && y <= cy + cardH) {
        // Start Level
        if (this.audio) {
            this.audio.resume();
            this.audio.playSfx('select');
        }
        this.currentLevelIndex = i;
        this.score = 0;
        this.levelStartScore = 0;
        this.loadLevel(i);
        return;
      }
    }
  }

  handleGameClick(x, y) {
    if (this.showMainMenu || this.showLevelSelect) return;

    // Game Over Screen Buttons
    if (this.gameOver && !this.won) {
      const btnW = 200;
      const btnH = 50;
      const btnX = this.width / 2 - btnW / 2;
      
      // Restart (R)
      const restartY = this.height / 2 + 10;
      if (x >= btnX && x <= btnX + btnW && y >= restartY && y <= restartY + btnH) {
        this.reset();
        if (this.audio) this.audio.playSfx('select');
        return;
      }
      
      // Back (ESC)
      const backY = this.height / 2 + 80;
      if (x >= btnX && x <= btnX + btnW && y >= backY && y <= backY + btnH) {
        if (this.currentLevelIndex === 0) {
          this.showLevelSelect = false;
          this.showMainMenu = true;
        } else {
          this.showLevelSelect = true;
        }
        this.paused = false;
        this.gameOver = false;
        this.won = false;
        if (this.audio) this.audio.playSfx('select');
        return;
      }
    }
  }

  handleGameMouseMove(x, y) {
    if (this.showMainMenu || this.showLevelSelect) return false;

    if (this.gameOver && !this.won) {
      const btnW = 200;
      const btnH = 50;
      const btnX = this.width / 2 - btnW / 2;
      
      // Restart
      const restartY = this.height / 2 + 10;
      if (x >= btnX && x <= btnX + btnW && y >= restartY && y <= restartY + btnH) {
        return true;
      }
      
      // Back
      const backY = this.height / 2 + 80;
      if (x >= btnX && x <= btnX + btnW && y >= backY && y <= backY + btnH) {
        return true;
      }
    }
    return false;
  }
  
  _renderMainMenu(ctx) {
    // Hide HUD and OPS elements
    const hudEl = document.getElementById('hud');
    const opsEl = document.getElementById('ops');
    const levelContainerEl = document.getElementById('level-container');
    const backBtn = document.getElementById('back-btn');
    if (hudEl) hudEl.style.display = 'none';
    if (opsEl) opsEl.style.display = 'none';
    if (levelContainerEl) levelContainerEl.style.display = 'none';
    if (backBtn) backBtn.style.display = 'none';

    const time = performance.now() / 1000;

    // Fusion Background (Horizontal Split)
    // Left to Right: Nature -> Underwater -> Cyber -> Space
    const grad = ctx.createLinearGradient(0, 0, this.width, 0);
    grad.addColorStop(0, '#87CEEB');    // Nature (Sky Blue)
    grad.addColorStop(0.25, '#0984e3'); // Underwater (Deep Blue)
    grad.addColorStop(0.5, '#0f172a');  // Cyber (Dark Slate)
    grad.addColorStop(0.85, '#000000'); // Space (Black)
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Draw Fusion Scenery
    const originalScenery = this.scenery;
    this.scenery = this.mainMenuScenery;
    this._renderScenery(ctx);
    this.scenery = originalScenery;

    // Grid effect (overlay for texture)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    ctx.beginPath();
    for (let x = 0; x <= this.width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let y = 0; y <= this.height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();
    ctx.restore();

    // Floating decorative shapes (Central)
    ctx.save();
    ctx.translate(this.width / 2, this.height / 2);
    
    // Big rotating circle behind title
    ctx.rotate(time * 0.1);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, 200, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.rotate(time * -0.15);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(0, 0, 160, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();

    // Draw Menu Players
    this.menuPlayers.forEach(p => p.draw(ctx));

    // Title
    const titlePulse = Math.sin(time * 2) * 0.05 + 0.95;
    ctx.save();
    ctx.translate(this.width / 2, this.height / 2 - 120);
    ctx.scale(titlePulse, titlePulse);

    // Title Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.font = 'bold 80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MINI FLAT HEROES', 6, 6);

    // Title Main
    ctx.fillStyle = '#ffffff';
    ctx.fillText('MINI FLAT HEROES', 0, 0);
    ctx.restore();

    // Menu Options
    const options = ['START GAME', 'TUTORIAL'];
    const startY = this.height / 2 + 10;
    const gap = 50;

    options.forEach((opt, i) => {
      const isSelected = this.mainMenuSelection === i;
      const y = startY + i * gap;
      
      if (isSelected) {
        // Selected style
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 32px sans-serif';
        // Arrow
        ctx.fillText('▶', this.width / 2 - 140, y);
        ctx.fillText('◀', this.width / 2 + 140, y);
      } else {
        // Normal style
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = 'bold 24px sans-serif';
      }
      
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(opt, this.width / 2, y);
    });

    // Mode Indicator (Cute Toggle Look) - Synced with Level Select
    const modeY = this.height / 2 + 130;
    const modeW = 260;
    const modeH = 36;
    const modeX = this.width / 2 - modeW / 2;
    
    // Toggle Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.roundRect(modeX, modeY, modeW, modeH, 18);
    ctx.fill();
    
    // Active Slider
    const sliderW = modeW / 2;
    const sliderX = this.twoPlayerMode ? modeX + sliderW : modeX;
    ctx.fillStyle = this.twoPlayerMode ? '#ffd166' : '#4ade80';
    ctx.beginPath();
    ctx.roundRect(sliderX, modeY, sliderW, modeH, 18);
    ctx.fill();
    
    // Text
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 1P Text
    ctx.fillStyle = !this.twoPlayerMode ? '#1e293b' : '#cbd5e1';
    ctx.fillText('1 PLAYER', modeX + sliderW/2, modeY + modeH/2);
    
    // 2P Text
    ctx.fillStyle = this.twoPlayerMode ? '#1e293b' : '#cbd5e1';
    ctx.fillText('2 PLAYERS', modeX + sliderW * 1.5, modeY + modeH/2);
    
    // Toggle Hint
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px sans-serif';
    ctx.fillText('Press TAB to toggle mode', this.width / 2, modeY + modeH + 20);

    // Instructions
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px sans-serif';
    ctx.fillText('Use UP/DOWN to select • ENTER to confirm', this.width / 2, this.height - 60);

    // Version/Credits
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '14px sans-serif';
    ctx.fillText('v1.0 • MinorJS Project', this.width / 2, this.height - 30);
  }

  showNewRecordAnimation(score) {
    const recordEl = document.getElementById('new-record');
    const valueEl = document.getElementById('record-value');
    if (recordEl && valueEl) {
      valueEl.textContent = score;
      recordEl.style.display = 'flex';
      
      // Play sound
      if (this.audio && this.audio.playSfx) {
        this.audio.playSfx('score'); 
      }
      
      // Hide after 2 seconds
      setTimeout(() => {
        recordEl.style.display = 'none';
      }, 2000);
    }
  }

  _initMainMenuScenery() {
    this.mainMenuScenery = [];
    
    // Horizontal Split: Nature -> Underwater -> Cyber -> Space
    const w = this.width;
    const h = this.height;
    
    // 1. Nature Zone (0 - 25%)
    // Background: Sky Blue
    // Snow Mountains (Standard Triangle Type for Snow Rendering)
    this.mainMenuScenery.push({
      type: 'mountain',
      x: w * 0.05,
      y: h,
      w: 200,
      h: 180,
      color: '#2d6a4f',
      peakColor: '#ffffff' // Bright Snow
    });
    this.mainMenuScenery.push({
      type: 'mountain',
      x: w * 0.18,
      y: h,
      w: 250,
      h: 220,
      color: '#1b4332',
      peakColor: '#e2e8f0' // Slightly shaded snow
    });
    
    // Trees
    for (let i = 0; i < 3; i++) {
      this.mainMenuScenery.push({
        type: 'tree',
        x: Math.random() * (w * 0.2),
        y: h,
        w: 30 + Math.random() * 20,
        h: 80 + Math.random() * 40,
        color: '#1b4332',
        leafColor: '#40916c'
      });
    }
    // Clouds
    for (let i = 0; i < 2; i++) {
      this.mainMenuScenery.push({
        type: 'cloud',
        x: Math.random() * (w * 0.25),
        y: Math.random() * (h * 0.4),
        w: 50 + Math.random() * 30,
        speed: 5 + Math.random() * 5
      });
    }
    
    // 2. Underwater Zone (25% - 50%)
    // Background: Deep Blue
    // Seaweed
    for (let i = 0; i < 5; i++) {
      this.mainMenuScenery.push({
        type: 'seaweed',
        x: w * 0.25 + Math.random() * (w * 0.25),
        y: h,
        w: 10,
        h: 80 + Math.random() * 60,
        color: Math.random() > 0.5 ? '#00b894' : '#55efc4'
      });
    }
    // Bubbles
    for (let i = 0; i < 10; i++) {
      this.mainMenuScenery.push({
        type: 'bubble',
        x: w * 0.25 + Math.random() * (w * 0.25),
        y: h * 0.5 + Math.random() * (h * 0.5),
        r: 2 + Math.random() * 4,
        speed: 10 + Math.random() * 20,
        color: 'rgba(255, 255, 255, 0.3)'
      });
    }
    
    // 3. Cyber Zone (50% - 75%)
    // Background: Dark Slate
    // Towers (Inverted - Hanging from top)
    for (let i = 0; i < 3; i++) {
      const towerW = 40 + Math.random() * 30;
      const towerH = 150 + Math.random() * 100;
      const tower = {
        type: 'tower',
        x: w * 0.5 + Math.random() * (w * 0.2),
        y: 0, // Top of screen
        w: towerW,
        h: towerH,
        color: '#0f172a',
        windowColor: '#0ea5e9',
        inverted: true, // New property
        windows: []
      };
      
      // Add windows
      const rows = Math.floor(towerH / 15);
      const cols = Math.floor(towerW / 10);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() > 0.4) {
            tower.windows.push({
              x: c * 10 + 2,
              y: r * 15 + 12, // Positive for top-down
              w: 6,
              h: 10,
              on: true
            });
          }
        }
      }
      this.mainMenuScenery.push(tower);
    }
    
    // 4. Space Zone (75% - 100%)
    // Background: Black
    // Stars
    for (let i = 0; i < 20; i++) {
      this.mainMenuScenery.push({
        type: 'star',
        x: w * 0.75 + Math.random() * (w * 0.25),
        y: Math.random() * h,
        size: Math.random() * 2 + 0.5,
        alpha: Math.random()
      });
    }
    // Planet
    this.mainMenuScenery.push({
      type: 'planet',
      x: w * 0.85,
      y: h * 0.3,
      r: 30,
      color: '#e17055',
      hasRing: true
    });
    // Asteroid
    this.mainMenuScenery.push({
      type: 'asteroid',
      x: w * 0.9,
      y: h * 0.6,
      size: 15,
      speed: 2,
      vertices: [
        {x: 10, y: 0}, {x: 5, y: 10}, {x: -5, y: 8}, {x: -10, y: -5}, {x: 5, y: -10}
      ]
    });
    
    // Sort by depth
    this.mainMenuScenery.sort((a, b) => {
      const order = { 
        star: 0, planet: 1, asteroid: 2,
        mountain: 3, 
        tower: 4, 
        cloud: 5, 
        seaweed: 6, 
        bubble: 7 
      };
      return (order[a.type] || 0) - (order[b.type] || 0);
    });
  }
}
