import Game from './game.js';
import { levels } from './level.js';

const canvas = document.getElementById('gameCanvas');
const game = new Game(canvas);

// Start the game loop
game.start();

// Main menu buttons
const btnSingle = document.getElementById('start-single');
const btnTwo = document.getElementById('start-two');
const mainMenuEl = document.getElementById('mainMenu');

if (btnSingle) {
  btnSingle.addEventListener('click', () => {
    game.startSinglePlayer();
    if (mainMenuEl) mainMenuEl.style.display = 'none';
    game.selectedLevelIndex = 1; // Start from Level 1
  });
}
if (btnTwo) {
  btnTwo.addEventListener('click', () => {
    game.startTwoPlayer();
    if (mainMenuEl) mainMenuEl.style.display = 'none';
    game.selectedLevelIndex = 1; // Start from Level 1
  });
}

// Hotkeys
window.addEventListener('keydown', (e) => {
  // Main Menu controls
  if (game.showMainMenu) {
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      game.mainMenuSelection = Math.max(0, game.mainMenuSelection - 1);
      if (game.audio) game.audio.playSfx('select');
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      game.mainMenuSelection = Math.min(1, game.mainMenuSelection + 1);
      if (game.audio) game.audio.playSfx('select');
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter') {
      if (game.audio) game.audio.resume();
      if (game.audio) game.audio.playSfx('select');
      
      if (game.mainMenuSelection === 0) {
        // Start Game -> Level Select
        game.showMainMenu = false;
        game.showLevelSelect = true;
        // Ensure we start selecting from Level 1
        if (game.selectedLevelIndex < 1) game.selectedLevelIndex = 1;
      } else {
        // Tutorial -> Start Tutorial Level (Index 0)
        game.showMainMenu = false;
        game.showLevelSelect = false;
        
        // Set initial lives for tutorial
        game.lives = game.twoPlayerMode ? 5 : 3;
        
        game.currentLevelIndex = 0;
        game.score = 0;
        game.levelStartScore = 0;
        game.loadLevel(0);
      }
      e.preventDefault();
      return;
    }
    if (e.key === 'Tab') {
      // Toggle 1P/2P mode
      game.twoPlayerMode = !game.twoPlayerMode;
      if (game.audio) game.audio.playSfx('select');
      e.preventDefault();
      return;
    }
    // Ignore other keys in main menu
    return;
  }

  // Level selection menu controls
  if (game.showLevelSelect) {
    // Block space key in level select menu
    if (e.key === ' ' || e.key === 'Space') {
      e.preventDefault();
      return;
    }
    
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      game.selectedLevelIndex = Math.max(1, game.selectedLevelIndex - 3);
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      game.selectedLevelIndex = Math.min(levels.length - 1, game.selectedLevelIndex + 3);
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      game.selectedLevelIndex = Math.max(1, game.selectedLevelIndex - 1);
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
      if (game.audio) {
        game.audio.resume();
        game.audio.playSfx('select');
      }
      game.currentLevelIndex = game.selectedLevelIndex;
      game.score = 0;
      game.levelStartScore = 0;
      game.loadLevel(game.selectedLevelIndex);
      e.preventDefault();
      return;
    }
    if (e.key === 'Tab') {
      // Toggle 1P/2P mode
      game.twoPlayerMode = !game.twoPlayerMode;
      if (game.audio) game.audio.playSfx('select');
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape') {
      // Return to Main Menu
      game.showLevelSelect = false;
      game.showMainMenu = true;
      if (game.audio) game.audio.playSfx('select');
      e.preventDefault();
      return;
    }
  }
  
  // ESC to return to level select (from gameplay or game over)
  if (e.key === 'Escape' && !game.showLevelSelect && !game.showMainMenu) {
    // If in Tutorial (Level 0), go back to Main Menu
    if (game.currentLevelIndex === 0) {
      game.showLevelSelect = false;
      game.showMainMenu = true;
    } else {
      // Otherwise go to Level Select
      game.showLevelSelect = true;
    }
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
      if (muteEl) muteEl.textContent = game.audio.muted ? '🔇 Sound: Off (M)' : '🔊 Sound: On (M)';
      console.log(status);
    }
  }
  if (e.key === 'b' || e.key === 'B') {
    if (game && game.audio) {
      game.audio.toggleMusic();
      const musicEl = document.getElementById('music-toggle');
      if (musicEl) musicEl.textContent = game.audio.musicEnabled ? '🎵 Music: On (B)' : '🔇 Music: Off (B)';
    }
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    // Reset scores
    if (confirm('Are you sure you want to reset all progress and high scores?')) {
      game.resetScores();
    }
    e.preventDefault();
    return;
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
