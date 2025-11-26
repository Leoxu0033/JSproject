import Game from './game.js';
import { levels } from './level.js';
import { input } from './input.js';

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
    if (e.key === 'y' || e.key === 'Y') {
      // Toggle Background Style
      game.bgStyle = (game.bgStyle + 1) % game.bgStyles.length;
      if (game.audio) game.audio.playSfx('select');
      
      // Update DOM element if it exists (though we are in canvas menu)
      const styleEl = document.getElementById('style-toggle');
      if (styleEl) {
        styleEl.textContent = `🎨 Style: ${game.bgStyles[game.bgStyle]} (Y)`;
      }
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

// Helper to get correct game coordinates handling object-fit: contain
function getGameCoordinates(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const r = canvas.width / canvas.height;
  const rr = rect.width / rect.height;
  
  let drawnWidth, drawnHeight, offsetX, offsetY;
  
  if (rr > r) {
    // Pillarbox (bars on sides)
    drawnHeight = rect.height;
    drawnWidth = drawnHeight * r;
    offsetX = (rect.width - drawnWidth) / 2;
    offsetY = 0;
  } else {
    // Letterbox (bars on top/bottom)
    drawnWidth = rect.width;
    drawnHeight = drawnWidth / r;
    offsetX = 0;
    offsetY = (rect.height - drawnHeight) / 2;
  }
  
  const x = (clientX - rect.left - offsetX) * (canvas.width / drawnWidth);
  const y = (clientY - rect.top - offsetY) * (canvas.height / drawnHeight);
  
  return { x, y };
}

// Mouse interaction for Main Menu & Level Select
canvas.addEventListener('mousemove', (e) => {
  const { x, y } = getGameCoordinates(canvas, e.clientX, e.clientY);

  if (game.showMainMenu) {
    const hovering = game.handleMenuMouseMove(x, y);
    canvas.style.cursor = hovering ? 'pointer' : 'default';
  } else if (game.showLevelSelect) {
    const hovering = game.handleLevelSelectMouseMove(x, y);
    canvas.style.cursor = hovering ? 'pointer' : 'default';
  } else if (game.gameOver) {
    const hovering = game.handleGameMouseMove(x, y);
    canvas.style.cursor = hovering ? 'pointer' : 'default';
  } else {
    canvas.style.cursor = 'default';
  }
});

canvas.addEventListener('click', (e) => {
  const { x, y } = getGameCoordinates(canvas, e.clientX, e.clientY);

  if (game.showMainMenu) {
    game.handleMenuClick(x, y);
  } else if (game.showLevelSelect) {
    game.handleLevelSelectClick(x, y);
  } else if (game.gameOver) {
    game.handleGameClick(x, y);
  }
});

// Back button wiring
const backBtn = document.getElementById('back-btn');
if (backBtn) {
  backBtn.addEventListener('click', () => {
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
    if (game.audio) game.audio.playSfx('select');
    
    // Hide button immediately (will be handled by game loop anyway)
    backBtn.style.display = 'none';
  });
}

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
  window.removeEventListener('touchstart', handleFirstInteraction);
  window.removeEventListener('keydown', handleFirstInteraction);
}
window.addEventListener('pointerdown', handleFirstInteraction);
window.addEventListener('touchstart', handleFirstInteraction);
window.addEventListener('keydown', handleFirstInteraction);

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

// Mobile Controls Wiring
function bindMobileControl(btnId, keyCodes) {
  const btn = document.getElementById(btnId);
  if (!btn) return;

  const setKeys = (active) => {
    keyCodes.forEach(code => input.setKey(code, active));
  };

  // Touch events
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent scrolling/selection
    setKeys(true);
    btn.classList.add('active');
  }, { passive: false });

  btn.addEventListener('touchend', (e) => {
    e.preventDefault();
    setKeys(false);
    btn.classList.remove('active');
  });

  // Mouse events (for testing on desktop)
  btn.addEventListener('mousedown', (e) => {
    setKeys(true);
    btn.classList.add('active');
  });
  
  btn.addEventListener('mouseup', () => {
    setKeys(false);
    btn.classList.remove('active');
  });
  
  btn.addEventListener('mouseleave', () => {
    setKeys(false);
    btn.classList.remove('active');
  });
}

// Bind controls
bindMobileControl('btn-dash', ['ShiftLeft', 'KeyK']);

// Joystick Logic
const joystickArea = document.getElementById('joystick-area');
const joystickStick = document.getElementById('joystick-stick');
const joystickBase = document.getElementById('joystick-base');

if (joystickArea && joystickStick) {
  let startX = 0;
  let startY = 0;
  let moveX = 0;
  let moveY = 0;
  let joystickTouchId = null; // Track specific touch ID
  const maxDist = 25; // Max stick movement radius

  const handleJoystick = (active) => {
    // Reset keys first
    input.setKey('ArrowLeft', false);
    input.setKey('ArrowRight', false);
    input.setKey('ArrowUp', false);
    input.setKey('ArrowDown', false);

    if (!active) {
      joystickStick.style.transform = `translate(0px, 0px)`;
      return;
    }

    // Update visual stick
    joystickStick.style.transform = `translate(${moveX}px, ${moveY}px)`;

    // Threshold for activation (deadzone)
    const threshold = 10;

    if (moveX < -threshold) input.setKey('ArrowLeft', true);
    if (moveX > threshold) input.setKey('ArrowRight', true);
    if (moveY < -threshold) input.setKey('ArrowUp', true); // Up is negative Y
    if (moveY > threshold) input.setKey('ArrowDown', true);
  };

  joystickArea.addEventListener('touchstart', (e) => {
    e.preventDefault();
    // If already tracking a touch, ignore new ones
    if (joystickTouchId !== null) return;

    const touch = e.changedTouches[0];
    joystickTouchId = touch.identifier;
    
    // Set start position to touch position (Dynamic Origin)
    startX = touch.clientX;
    startY = touch.clientY;
    
    // Move base to touch position
    if (joystickBase) {
      joystickBase.style.left = `${startX}px`;
      joystickBase.style.top = `${startY}px`;
      joystickBase.classList.add('visible');
    }
    
    moveX = 0;
    moveY = 0;
    handleJoystick(true);
    
    if (navigator.vibrate) navigator.vibrate(10);
  }, { passive: false });

  joystickArea.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (joystickTouchId === null) return;

    // Find the specific touch we are tracking
    let touch = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId) {
        touch = e.changedTouches[i];
        break;
      }
    }
    if (!touch) return; // Not our touch
    
    // Calculate delta from start position
    let dx = touch.clientX - startX;
    let dy = touch.clientY - startY;

    // Clamp
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > maxDist) {
      const ratio = maxDist / dist;
      dx *= ratio;
      dy *= ratio;
    }

    moveX = dx;
    moveY = dy;
    handleJoystick(true);
  }, { passive: false });

  const endJoystick = (e) => {
    e.preventDefault();
    if (joystickTouchId === null) return;

    // Check if our touch ended
    let touchFound = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId) {
        touchFound = true;
        break;
      }
    }
    if (!touchFound) return;

    joystickTouchId = null;
    moveX = 0;
    moveY = 0;
    handleJoystick(false);
    if (joystickBase) {
      joystickBase.classList.remove('visible');
    }
  };

  joystickArea.addEventListener('touchend', endJoystick);
  joystickArea.addEventListener('touchcancel', endJoystick);
}

// Mobile Tools Logic
const mtRestart = document.getElementById('mt-restart');
const mtPause = document.getElementById('mt-pause');
const mtStyle = document.getElementById('mt-style');
const mtMute = document.getElementById('mt-mute');
const mtExit = document.getElementById('mt-exit');

// Generic touch feedback for all buttons
document.querySelectorAll('button').forEach(btn => {
  btn.addEventListener('touchstart', () => {
    btn.classList.add('active');
  }, { passive: true });
  
  btn.addEventListener('touchend', () => {
    setTimeout(() => btn.classList.remove('active'), 150);
  });
});

if (mtRestart) {
  mtRestart.addEventListener('click', () => {
    if (game.won && !game.gameOver) return; // Don't reset during win anim
    game.reset();
    if (navigator.vibrate) navigator.vibrate(10);
  });
}

if (mtPause) {
  mtPause.addEventListener('click', () => {
    game.paused = !game.paused;
    mtPause.textContent = game.paused ? '▶️' : '⏸️';
    if (navigator.vibrate) navigator.vibrate(10);
  });
}

if (mtStyle) {
  mtStyle.addEventListener('click', () => {
    game.toggleStyle();
    if (navigator.vibrate) navigator.vibrate(10);
  });
}

if (mtMute) {
  mtMute.addEventListener('click', () => {
    if (game.audio) {
      game.audio.toggleMute();
      mtMute.textContent = game.audio.muted ? '🔇' : '🔊';
      if (navigator.vibrate) navigator.vibrate(10);
    }
  });
}

if (mtExit) {
  mtExit.addEventListener('click', () => {
    // If in Tutorial (Level 0), go back to Main Menu
    if (game.currentLevelIndex === 0) {
      game.showLevelSelect = false;
      game.showMainMenu = true;
    } else {
      // Otherwise go to Level Select
      game.showLevelSelect = true;
      game.showMainMenu = false;
    }
    game.paused = false;
    game.gameOver = false;
    game.won = false;
    if (navigator.vibrate) navigator.vibrate(10);
  });
}

// UI Update Loop for Mobile
function updateMobileUI() {
  const mobileControls = document.getElementById('mobile-controls');
  const mobileTools = document.getElementById('mobile-tools');
  
  // Only show controls during gameplay (not in menus, not in game over)
  const isGameplay = !game.showMainMenu && !game.showLevelSelect && !game.gameOver;
  
  if (mobileControls) {
    mobileControls.style.display = isGameplay ? 'flex' : 'none';
  }
  
  if (mobileTools) {
    mobileTools.style.display = isGameplay ? 'flex' : 'none';
  }

  // Ensure HUD is visible on mobile
  const hud = document.getElementById('hud');
  if (hud) {
    // Hide HUD in main menu and level select
    const hideHud = game.showMainMenu || game.showLevelSelect;
    hud.style.display = hideHud ? 'none' : 'flex';
  }
  
  requestAnimationFrame(updateMobileUI);
}

// Start UI loop
updateMobileUI();

// Add haptic feedback to dash button
const btnDash = document.getElementById('btn-dash');
if (btnDash) {
  btnDash.addEventListener('touchstart', () => {
    if (navigator.vibrate) navigator.vibrate(20);
  });
}

// Prevent default touch actions on canvas to stop scrolling/zooming while playing
canvas.addEventListener('touchstart', (e) => {
  if (e.target === canvas) {
    e.preventDefault();
    // Also handle touch clicks for menu
    const touch = e.changedTouches[0];
    const { x, y } = getGameCoordinates(canvas, touch.clientX, touch.clientY);
    
    if (game.showMainMenu) {
      game.handleMenuClick(x, y);
    } else if (game.showLevelSelect) {
      game.handleLevelSelectClick(x, y);
    } else if (game.gameOver) {
      game.handleGameClick(x, y);
    }
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (e.target === canvas) {
    e.preventDefault();
  }
}, { passive: false });
