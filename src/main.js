import Game from './game.js';
import { levels } from './level.js';

const canvas = document.getElementById('gameCanvas');
const game = new Game(canvas);

// Start the game loop
game.start();

// --- Main menu DOM wiring (polished, accessible) ---
const mainMenu = document.getElementById('mainMenu');
const startBtn = document.getElementById('start-btn');
const levelSelectBtn = document.getElementById('levelselect-btn');
const showcaseBtn = document.getElementById('showcase-btn');
const backMainBtn = document.getElementById('back-main-btn');

// Helper to show/hide the Back button used on Level Select. We move it
// to document.body while visible so it's not hidden when the game hides
// the #ops container during level select rendering.
function showBackButton(visible) {
  if (!backMainBtn) return;
  try {
    if (visible) {
      // ensure it's attached to body to avoid being hidden by #ops
      if (backMainBtn.parentElement !== document.body) document.body.appendChild(backMainBtn);
      backMainBtn.style.display = '';
    } else {
      // hide and restore into #ops if available
      backMainBtn.style.display = 'none';
      const ops = document.getElementById('ops');
      if (ops && backMainBtn.parentElement !== ops) ops.appendChild(backMainBtn);
    }
  } catch (e) {
    // silent
  }
}

function hideMainMenu() {
  if (mainMenu) mainMenu.classList.add('hidden');
  try {
    if (canvas && typeof canvas.tabIndex !== 'number') canvas.tabIndex = -1;
    canvas && canvas.focus && canvas.focus();
  } catch (e) {}
}

function showMainMenu() {
  if (mainMenu) mainMenu.classList.remove('hidden');
  // hide level-select back button when returning to main menu
  showBackButton(false);
}

if (startBtn) {
  startBtn.addEventListener('click', () => {
    if (game && game.audio && game.audio.playSfx) game.audio.playSfx('select');
    hideMainMenu();
    // Ensure normal (non-demo) mode when starting a play session
    if (game) {
      if (typeof game.exitDemoMode === 'function') game.exitDemoMode();
      else game.demoMode = false;
      const di = document.getElementById('demo-indicator');
      if (di) di.style.display = 'none';
    }
    game.loadLevel(0);
    // ensure level-select back button hidden when starting play
    showBackButton(false);
  });
  // initial focus for keyboard users
  startBtn.focus && startBtn.focus();
}

if (levelSelectBtn) {
  levelSelectBtn.addEventListener('click', () => {
    if (game && game.audio && game.audio.playSfx) game.audio.playSfx('select');
    hideMainMenu();
    // Level select is a normal (non-demo) flow
    if (game) {
      if (typeof game.exitDemoMode === 'function') game.exitDemoMode();
      else game.demoMode = false;
      const di2 = document.getElementById('demo-indicator');
      if (di2) di2.style.display = 'none';
    }
    game.showLevelSelect = true;
    game.selectedLevelIndex = 0;
    // show the in-level-select Back button so player can return to main menu
    showBackButton(true);
  });
}

if (showcaseBtn) {
  showcaseBtn.addEventListener('click', () => {
    if (game && game.audio && game.audio.playSfx) game.audio.playSfx('select');
    hideMainMenu();
    // Showcase/demo mode: do not persist high scores or completed levels
    if (game) {
      if (typeof game.enterDemoMode === 'function') game.enterDemoMode();
      else game.demoMode = true;
      const di3 = document.getElementById('demo-indicator');
      if (di3) di3.style.display = '';
    }
    game.loadLevel(0);
    // hide level-select back button in showcase/play
    showBackButton(false);
  });
}

// Hotkeys
window.addEventListener('keydown', (e) => {
  // Level selection menu controls
  if (game.showLevelSelect) {
    // Block space key in level select menu
    if (e.key === ' ' || e.key === 'Space') {
      e.preventDefault();
      return;
    }
    
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      game.selectedLevelIndex = Math.max(0, game.selectedLevelIndex - 3);
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      game.selectedLevelIndex = Math.min(levels.length - 1, game.selectedLevelIndex + 3);
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      game.selectedLevelIndex = Math.max(0, game.selectedLevelIndex - 1);
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      game.selectedLevelIndex = Math.min(levels.length - 1, game.selectedLevelIndex + 1);
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      // Start selected level
      if (game.audio) game.audio.playSfx('select');
      game.currentLevelIndex = game.selectedLevelIndex;
      game.score = 0;
      game.levelStartScore = 0;
      game.loadLevel(game.selectedLevelIndex);
      // hide back button when a level is started
      showBackButton(false);
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape') {
      // Return to main menu from level select (or to level select from game over)
      if (!game.gameOver) {
        // If we're currently in level select, go back to main menu
        if (game.showLevelSelect) {
          showMainMenu();
          game.showLevelSelect = false;
        }
      } else {
        // Return to level select from game over screen
        game.showLevelSelect = true;
        game.gameOver = false;
        game.won = false;
      }
      e.preventDefault();
      return;
    }
  }
  
  // ESC to return to level select (from gameplay or game over)
  if (e.key === 'Escape' && !game.showLevelSelect) {
    game.showLevelSelect = true;
    game.paused = false;
    game.gameOver = false;
    game.won = false;
    // when user enters level select via ESC ensure Back button is visible
    showBackButton(true);
    e.preventDefault();
    return;
  }
  
  if (e.key === 'r' || e.key === 'R') {
    // Check if all levels are completed (final completion screen)
    if (game.won && game.gameOver && game.allLevelsCompleted && game.allLevelsCompleted()) {
      // All levels completed - return to level select
      game.showLevelSelect = true;
      game.gameOver = false;
      game.won = false;
      return;
    }
    // Cannot reset when single level is completed (won but not all levels)
    if (game.won && !game.gameOver) {
      return; // Don't allow reset during win animation
    }
    if (game.won && game.gameOver && game.currentLevelIndex < 9) {
      // Return to level select after single level completion
      game.showLevelSelect = true;
      game.gameOver = false;
      game.won = false;
      return;
    }
    // Allow reset when game is over (failed) or during normal gameplay
    game.reset();
  }
  if (e.key === 'm' || e.key === 'M') {
    if (game && game.audio) {
      game.audio.toggleMute();
      const status = game.audio.muted ? 'Muted' : 'Unmuted';
      const muteEl = document.getElementById('mute');
      if (muteEl) muteEl.textContent = game.audio.muted ? 'Sound: Off (M)' : 'Sound: On (M)';
      console.log(status);
    }
  }
});

// dash via keyboard: Shift (edge-detected)
let _globalPrevDash = false;
window.addEventListener('keydown', (e) => {
  if (e.key === 'Shift') _globalPrevDash = true;
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'Shift') _globalPrevDash = false;
});

// Unlock audio on first user gesture (browsers often require this)
function handleFirstInteraction() {
  if (game && game.audio) {
    game.audio.resume().then(() => {
      // optionally start music only after gesture
      // game.audio.playMusic();
    });
  }
  window.removeEventListener('pointerdown', handleFirstInteraction);
}

// Back to main menu button handler
if (backMainBtn) {
  backMainBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    // Show the main menu and hide level select
    showMainMenu();
    if (game) game.showLevelSelect = false;
  });
}

// If the game starts on Level Select, ensure the Back button is visible
if (game && game.showLevelSelect) {
  showBackButton(true);
}
window.addEventListener('pointerdown', handleFirstInteraction);

// Retry button wiring
const retryBtn = document.getElementById('retry-btn');
if (retryBtn) {
  retryBtn.addEventListener('click', () => {
    game.reset();
    const ov = document.getElementById('overlay');
    if (ov) ov.style.display = 'none';
  });
}

// Quick test key: press T to trigger test effects (particles, sfx, shake)
window.addEventListener('keydown', (e) => {
  if (e.key === 't' || e.key === 'T') {
    // spawn sample particles
    game.spawnParticles(game.width / 2, game.height / 2, '#ffcc00', 24);
    game.screenShake(12, 0.4);
    game.flash('#ffcc00', 0.12);
    if (game.audio) game.audio.playSfx('stomp');
  }
});
