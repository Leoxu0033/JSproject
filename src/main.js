import Game from './game.js';
import { levels } from './level.js';

const canvas = document.getElementById('gameCanvas');
const game = new Game(canvas);

// Start the game loop
game.start();

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
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape') {
      // Return to menu from game over screen
      if (game.gameOver) {
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
