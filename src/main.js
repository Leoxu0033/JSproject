import Game from './game.js';

const canvas = document.getElementById('gameCanvas');
const game = new Game(canvas);

// Start the game loop
game.start();

// Hotkeys
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
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
