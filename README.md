# Mini Flat Heroes — Project (Minimal JS + Canvas)

This repository is a student project reimagining the feel of Flat Heroes using plain JavaScript, HTML5 Canvas and ES6 modules.

Controls
- Move: Arrow keys or A/D
- Jump: Space / W / Arrow Up
- Restart: R
 - M: Toggle mute


Main features
- Canvas rendering with requestAnimationFrame (fixed-step update)
- ES6 classes and modules: `Player`, `Enemy`, `Game`, `AudioManager` etc.
- Simple AI patrol enemies
- Collision detection (AABB) implemented in `src/utils.js`
- Procedural audio (Web Audio API) for background pad and sfx

Audio samples
- `src/audio.js` supports loading external short audio samples (fetch + decode). To use samples, place files under an `assets/` folder (or any public URL) and call `game.audio.loadSamples({ jump: '/assets/jump.wav', stomp: '/assets/stomp.wav', hit: '/assets/hit.wav' })` from `src/main.js` after creating the `Game` instance (and after a user gesture to resume audio). If no samples are provided the code falls back to synthesized SFX.

How to run
1. Open `index.html` in your browser (no build step required). For some browsers the AudioContext requires a user gesture to start audio.

Files of interest
- `src/game.js` — main engine and loop
- `src/player.js` — player logic and rendering
- `src/enemy.js` — enemy AI
- `src/audio.js` — Web Audio helper (music + sfx)
- `src/utils.js` — collision helpers

Notes and next steps
- Add particle effects and screen shake for polish
- Add level transitions, menus, and local multiplayer (Gamepad API)
- Add more polished assets and deploy to GitHub Pages

Tips
- Some browsers require a user interaction before audio will play; click or tap on the page once to unlock sound (the game listens for a pointerdown and resumes the AudioContext).
- Use M to toggle mute while testing or recording.
