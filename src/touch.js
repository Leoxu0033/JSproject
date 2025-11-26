import { input } from './input.js';

export function initTouchControls(game) {
  // Joystick Logic
  const joystickArea = document.getElementById('joystick-area');
  const joystickStick = document.getElementById('joystick-stick');
  const joystickBase = document.getElementById('joystick-base');
  
  let touchId = null;
  const maxRadius = 35; // Max distance stick can move

  if (joystickArea && joystickStick && joystickBase) {
    const handleTouch = (touch) => {
      const rect = joystickBase.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      let dx = touch.clientX - centerX;
      let dy = touch.clientY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Clamp distance
      if (distance > maxRadius) {
        const ratio = maxRadius / distance;
        dx *= ratio;
        dy *= ratio;
      }
      
      // Move stick visual
      joystickStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      
      // Update Input
      const normX = dx / maxRadius;
      const normY = dy / maxRadius;
      
      input.joystick.x = normX;
      input.joystick.y = normY;
      
      // Simulate Keys with threshold
      const threshold = 0.3;
      input.setButton('ArrowLeft', normX < -threshold);
      input.setButton('ArrowRight', normX > threshold);
      input.setButton('ArrowUp', normY < -threshold);
      input.setButton('ArrowDown', normY > threshold);
    };

    joystickArea.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (touchId === null) {
        const touch = e.changedTouches[0];
        touchId = touch.identifier;
        handleTouch(touch);
      }
    }, { passive: false });

    joystickArea.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          handleTouch(e.changedTouches[i]);
          break;
        }
      }
    }, { passive: false });

    const endTouch = (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchId) {
          touchId = null;
          joystickStick.style.transform = `translate(-50%, -50%)`;
          input.joystick.x = 0;
          input.joystick.y = 0;
          input.setButton('ArrowLeft', false);
          input.setButton('ArrowRight', false);
          input.setButton('ArrowUp', false);
          input.setButton('ArrowDown', false);
          break;
        }
      }
    };

    joystickArea.addEventListener('touchend', endTouch);
    joystickArea.addEventListener('touchcancel', endTouch);
  }

  // Action Buttons
  const btnJump = document.getElementById('btn-jump');
  const btnDash = document.getElementById('btn-dash');

  if (btnJump) {
    btnJump.addEventListener('touchstart', (e) => {
      e.preventDefault();
      input.setButton('Space', true);
      input.setButton(' ', true);
      // Also trigger Enter for menus
      input.setButton('Enter', true);
      btnJump.style.background = 'rgba(255, 255, 255, 0.4)';
    }, { passive: false });
    
    btnJump.addEventListener('touchend', (e) => {
      e.preventDefault();
      input.setButton('Space', false);
      input.setButton(' ', false);
      input.setButton('Enter', false);
      btnJump.style.background = '';
    });
  }

  if (btnDash) {
    btnDash.addEventListener('touchstart', (e) => {
      e.preventDefault();
      input.setButton('ShiftLeft', true);
      input.setButton('Shift', true);
      btnDash.style.background = 'rgba(255, 255, 255, 0.4)';
    }, { passive: false });
    
    btnDash.addEventListener('touchend', (e) => {
      e.preventDefault();
      input.setButton('ShiftLeft', false);
      input.setButton('Shift', false);
      btnDash.style.background = '';
    });
  }

  // Mobile Ops Buttons
  const mPause = document.getElementById('m-pause');
  const mRestart = document.getElementById('m-restart');
  const mStyle = document.getElementById('m-style');
  const mMute = document.getElementById('m-mute');
  const mMusic = document.getElementById('m-music');
  const mExit = document.getElementById('m-exit');

  if (mPause) {
    mPause.addEventListener('touchstart', (e) => {
       e.preventDefault();
       // Toggle Pause / Menu
       if (!game.showLevelSelect && !game.showMainMenu) {
         game.showLevelSelect = true;
         game.paused = false;
         game.gameOver = false;
         game.won = false;
       }
    });
  }

  if (mRestart) {
    mRestart.addEventListener('touchstart', (e) => {
        e.preventDefault();
        game.reset();
    });
  }

  if (mStyle) {
    mStyle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        game.bgStyle = (game.bgStyle + 1) % game.bgStyles.length;
        if (game.audio) game.audio.playSfx('select');
    });
  }

  if (mMute) {
    mMute.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (game.audio) {
        game.audio.toggleMute();
        mMute.textContent = game.audio.muted ? '🔇' : '🔊';
      }
    });
  }

  if (mMusic) {
    mMusic.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (game.audio) {
        game.audio.toggleMusic();
        mMusic.textContent = game.audio.musicEnabled ? '🎵' : '🔇';
      }
    });
  }

  if (mExit) {
    mExit.addEventListener('touchstart', (e) => {
       e.preventDefault();
       if (game.showLevelSelect) {
         game.showLevelSelect = false;
         game.showMainMenu = true;
       } else {
         // If in game, go to level select first
         game.showLevelSelect = true;
         game.paused = false;
         game.gameOver = false;
         game.won = false;
       }
    });
  }
}
