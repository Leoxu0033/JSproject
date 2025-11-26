// Mobile touch input adapter (方案 A)
// 在触摸设备上创建虚拟摇杆与按钮，并把触摸直接写入共享的 `input` 实例（更可靠）
import { input } from './input.js';
import { levels } from './level.js';

console.log('[mobile-input] module loaded');
const MOBILE_INPUT_DEBUG = false; // set true to enable debug logs

function codeNameFromKeyCode(keyCode) {
  const map = {
    32: 'Space',
    37: 'ArrowLeft',
    38: 'ArrowUp',
    39: 'ArrowRight',
    40: 'ArrowDown',
    88: 'KeyX',
      13: 'Enter',
    65: 'KeyA',
    68: 'KeyD',
    87: 'KeyW',
    83: 'KeyS',
    75: 'KeyK',
    80: 'KeyP',
    82: 'KeyR',
    77: 'KeyM',
    66: 'KeyB',
    89: 'KeyY',
    27: 'Escape'
  };
  return map[keyCode] || String.fromCharCode(keyCode || 0);
}

function synthKey(type, key, keyCode) {
  // 更可靠地直接修改共享 input 的 keys 集合
  const codeName = codeNameFromKeyCode(keyCode);
  if (type === 'keydown') {
    input.keys.add(codeName);
    // also add the readable key (lowercase) for robustness
    if (key) input.keys.add(String(key));
  } else if (type === 'keyup') {
    input.keys.delete(codeName);
    if (key) input.keys.delete(String(key));
  }
  // Also dispatch a KeyboardEvent for any other listeners
  try {
    const ev = new KeyboardEvent(type, { key, code: codeName, keyCode, which: keyCode, bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
  } catch (e) {
    // Some browsers restrict synthetic keyboard events; ignore if failed
  }
}

function createJoystick() {
  const joystick = document.createElement('div');
  joystick.id = 'virtual-joystick';
  joystick.setAttribute('aria-hidden','true');
  Object.assign(joystick.style, {
    position: 'fixed',
    left: '12px',
    top: 'calc(100% - 132px)',
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.18)',
    zIndex: 9999,
    touchAction: 'none',
    pointerEvents: 'auto'
  });
  // ensure visible even if CSS has rules
  joystick.style.display = 'none';

  // add an inner knob for visual feedback
  const knob = document.createElement('div');
  knob.id = 'virtual-joystick-knob';
  Object.assign(knob.style, {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.12)',
    border: '2px solid rgba(255,255,255,0.12)'
  });
  joystick.appendChild(knob);
  document.body.appendChild(joystick);
  console.log('[mobile-input] joystick created');

  let activeId = null;
  let activePointerId = null;
  let startX = 0;
  let startY = 0;
  // The joystick will follow the user's finger, not the player
  joystick._follow = false;
  let centerX = 0;
  let centerY = 0;
  let _currDirs = { left: false, right: false, up: false, down: false };

  function clearDirs() {
    ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].forEach(k => {
      const codeMap = { ArrowLeft:37, ArrowRight:39, ArrowUp:38, ArrowDown:40 };
      synthKey('keyup', k, codeMap[k]);
    });
    // NOTE: do not reset knob visual here — hideJoystick will animate knob back to center
    _currDirs.left = _currDirs.right = _currDirs.up = _currDirs.down = false;
  }

  // We'll show the joystick at the user's finger (activation on left half)
  function showAt(x, y, pointerId) {
    const jw = parseInt(joystick.style.width) || 120;
    const jh = parseInt(joystick.style.height) || jw;
    const left = Math.round(x - jw / 2);
    const top = Math.round(y - jh / 2);
    joystick.style.left = `${left}px`;
    joystick.style.top = `${top}px`;
    joystick.style.display = 'block';
    centerX = x; centerY = y;
    startX = x; startY = y;
    activePointerId = pointerId;
    if (knob) {
      // disable transition while dragging so knob follows immediately
      knob.style.transition = 'none';
      knob.style.transform = 'translate(-50%, -50%)';
    }
  }

  function hideJoystick() {
    // animate knob back to center, then hide
    if (knob) {
      // ensure we have a transition for the rebound
      knob.style.transition = 'transform 180ms cubic-bezier(.2,.9,.3,1)';
      // center the knob (will animate)
      knob.style.transform = 'translate(-50%, -50%)';
      const onEnd = (ev) => {
        if (ev && ev.propertyName !== 'transform') return;
        knob.removeEventListener('transitionend', onEnd);
        try { joystick.style.display = 'none'; } catch(e){}
        activePointerId = null;
        clearDirs();
        // cleanup transition style after animation
        try { knob.style.transition = 'none'; } catch(e){}
      };
      knob.addEventListener('transitionend', onEnd);
      // safety fallback in case transitionend doesn't fire
      setTimeout(() => {
        if (knob) {
          try { knob.removeEventListener('transitionend', onEnd); } catch(e){}
          try { joystick.style.display = 'none'; } catch(e){}
          activePointerId = null;
          clearDirs();
          try { knob.style.transition = 'none'; } catch(e){}
        }
      }, 260);
    } else {
      joystick.style.display = 'none';
      activePointerId = null;
      clearDirs();
    }
  }

  // global pointer handlers so the joystick can follow outside its initial bounds
  document.addEventListener('pointerdown', e => {
    // Only activate on primary button and on left half of screen
    if (e.isPrimary !== undefined && !e.isPrimary) return;
    const target = e.target;
    if (target && target.closest && (target.closest('#mobile-utils') || target.closest('#mobile-pause') || target.closest('#mobile-dodge') || target.closest('#mobile-main-menu') || target.closest('#mobile-level-select'))) return;
    if (activePointerId !== null) return; // already active, ignore extra downs
    if (e.clientX > window.innerWidth * 0.6) return; // prefer left area
    showAt(e.clientX, e.clientY, e.pointerId);
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('pointermove', e => {
    if (activePointerId === null || e.pointerId !== activePointerId) return;
    const jwRect = joystick.getBoundingClientRect();
    // displacement from base center
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const jw = parseInt(joystick.style.width) || jwRect.width || 120;
    const max = (jw / 2) - 10;
    const dist = Math.hypot(dx, dy);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    const limited = Math.min(dist, max);
    // move knob within base
    if (knob) knob.style.transform = `translate(calc(-50% + ${nx * limited}px), calc(-50% + ${ny * limited}px))`;
    // Synthesize directional keys from displacement
    const dead = Math.min(12, max * 0.15);
    const want = { left: dx < -dead, right: dx > dead, up: dy < -dead, down: dy > dead };
    if (want.left && !_currDirs.left) synthKey('keydown','ArrowLeft',37);
    if (!want.left && _currDirs.left) synthKey('keyup','ArrowLeft',37);
    if (want.right && !_currDirs.right) synthKey('keydown','ArrowRight',39);
    if (!want.right && _currDirs.right) synthKey('keyup','ArrowRight',39);
    if (want.up && !_currDirs.up) synthKey('keydown','ArrowUp',38);
    if (!want.up && _currDirs.up) synthKey('keyup','ArrowUp',38);
    if (want.down && !_currDirs.down) synthKey('keydown','ArrowDown',40);
    if (!want.down && _currDirs.down) synthKey('keyup','ArrowDown',40);
    _currDirs = want;
    if (MOBILE_INPUT_DEBUG) console.log('[mobile-input] pointermove dirs:', Array.from(input.keys));
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('pointerup', e => {
    if (e.pointerId === activePointerId) {
      hideJoystick();
    }
  }, { passive: false });

  // touch fallback
  document.addEventListener('touchstart', e => {
    const t = e.changedTouches[0];
    if (!t) return;
    const target = e.target;
    if (target && target.closest && (target.closest('#mobile-utils') || target.closest('#mobile-pause') || target.closest('#mobile-dodge') || target.closest('#mobile-main-menu') || target.closest('#mobile-level-select'))) return;
    if (activePointerId !== null) return; // already active, ignore extra downs
    if (t.clientX > window.innerWidth * 0.6) return;
    showAt(t.clientX, t.clientY, t.identifier);
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchmove', e => {
    if (activePointerId === null) return;
    const touches = Array.from(e.changedTouches);
    const t = touches.find(x => x.identifier === activePointerId);
    if (!t) return;
    const dx = t.clientX - centerX;
    const dy = t.clientY - centerY;
    const jw = parseInt(joystick.style.width) || joystick.getBoundingClientRect().width || 120;
    const max = (jw / 2) - 10;
    const dist = Math.hypot(dx, dy);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    const limited = Math.min(dist, max);
    if (knob) knob.style.transform = `translate(calc(-50% + ${nx * limited}px), calc(-50% + ${ny * limited}px))`;
    const dead = Math.min(12, max * 0.15);
    const want = { left: dx < -dead, right: dx > dead, up: dy < -dead, down: dy > dead };
    if (want.left && !_currDirs.left) synthKey('keydown','ArrowLeft',37);
    if (!want.left && _currDirs.left) synthKey('keyup','ArrowLeft',37);
    if (want.right && !_currDirs.right) synthKey('keydown','ArrowRight',39);
    if (!want.right && _currDirs.right) synthKey('keyup','ArrowRight',39);
    if (want.up && !_currDirs.up) synthKey('keydown','ArrowUp',38);
    if (!want.up && _currDirs.up) synthKey('keyup','ArrowUp',38);
    if (want.down && !_currDirs.down) synthKey('keydown','ArrowDown',40);
    if (!want.down && _currDirs.down) synthKey('keyup','ArrowDown',40);
    _currDirs = want;
    if (MOBILE_INPUT_DEBUG) console.log('[mobile-input] touchmove dirs:', Array.from(input.keys));
    e.preventDefault();
  }, { passive: false });

  document.addEventListener('touchend', e => {
    const touches = Array.from(e.changedTouches);
    const t = touches.find(x => x.identifier === activePointerId);
    if (t) hideJoystick();
  }, { passive: false });

  // expose function to update follow position (synchronous, no smoothing)
  joystick.updateFollow = function() {
    try {
      if (!joystick._follow) return;
      const g = window.game;
      const canvasEl = document.getElementById('gameCanvas');
      if (!g || !g.players || !g.players[0] || !canvasEl) return;
      const p = g.players[0];
      const rect = canvasEl.getBoundingClientRect();
      // player pos in game coords -> screen coords
      const px = rect.left + (p.pos.x / canvasEl.width) * rect.width;
      const py = rect.top + (p.pos.y / canvasEl.height) * rect.height;
      // Anchor joystick near player: left of player by joystick width + 8, vertically centered at player
      const jw = parseInt(joystick.style.width) || rect.width * 0.12 || 120;
      const jh = parseInt(joystick.style.height) || jw;
      let left = Math.round(px - jw - 12);
      let top = Math.round(py - jh/2);
      // keep on-screen
      left = Math.max(8, Math.min(window.innerWidth - jw - 8, left));
      top = Math.max(8, Math.min(window.innerHeight - jh - 8, top));
      joystick.style.left = `${left}px`;
      joystick.style.top = `${top}px`;
    } catch (err) {
      // ignore
    }
  };
}

// On mobile we don't create separate A/B action buttons (they were unused)
function createActionButtons() {
  // no-op: taps are treated as 'Enter' and directions handled by joystick
}

function createQuickControls() {
  const pause = document.createElement('button');
  pause.id = 'mobile-pause';
  pause.textContent = '⏸';
  Object.assign(pause.style, { position:'fixed', right:'12px', top:'12px', zIndex:9999, width:'44px', height:'44px', borderRadius:'8px' });
  const onPause = (e) => { synthKey('keydown','p',80); synthKey('keyup','p',80); e && e.preventDefault(); };
  pause.addEventListener('pointerdown', onPause);
  pause.addEventListener('click', onPause);
  document.body.appendChild(pause);
}

function createUtilityButtons() {
  const container = document.createElement('div');
  container.id = 'mobile-utils';
  Object.assign(container.style, { position:'fixed', left:'12px', top:'12px', zIndex:9999, display:'flex', gap:'8px' });

  const makeBtn = (id, label, keyCode) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.textContent = label;
    Object.assign(btn.style, { width:'44px', height:'44px', borderRadius:'8px', fontSize:'18px' });
    const handler = (e) => { synthKey('keydown',String.fromCharCode(keyCode || 0).toLowerCase(), keyCode); synthKey('keyup',String.fromCharCode(keyCode || 0).toLowerCase(), keyCode); e && e.preventDefault(); };
    btn.addEventListener('pointerdown', handler);
    btn.addEventListener('click', handler);
    container.appendChild(btn);
    return btn;
  };

  // Restart (R), Mute (M), Music (B), Style (Y), Exit (Escape)
  makeBtn('mobile-restart','⟲',82);
  makeBtn('mobile-mute','🔊',77);
  makeBtn('mobile-music','🎵',66);
  makeBtn('mobile-style','🎨',89);
  // Exit should send Escape
  const exitBtn = document.createElement('button');
  exitBtn.id = 'mobile-exit';
  exitBtn.textContent = '🚪';
  Object.assign(exitBtn.style, { width:'44px', height:'44px', borderRadius:'8px', fontSize:'18px' });
  const onExit = (e) => { synthKey('keydown','Escape',27); synthKey('keyup','Escape',27); e && e.preventDefault(); };
  exitBtn.addEventListener('pointerdown', onExit);
  exitBtn.addEventListener('click', onExit);
  container.appendChild(exitBtn);

  document.body.appendChild(container);
}

function createDodgeButton() {
  // Create a dodge button mapped to KeyK (75)
  removeIfExists && removeIfExists('mobile-dodge');
  const btn = document.createElement('button');
  btn.id = 'mobile-dodge';
  btn.textContent = 'DASH';
  Object.assign(btn.style, {
    position: 'fixed',
    right: '24px',
    bottom: '20px',
    zIndex: 10001,
    width: '64px',
    height: '44px',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    fontSize: '14px'
  });
  // add smooth visual feedback for presses
  btn.style.transition = 'transform 140ms cubic-bezier(.2,.9,.3,1), background 140ms ease';
  const onDown = (e) => { synthKey('keydown','k',75); e && e.preventDefault(); };
  const onUp = (e) => { synthKey('keyup','k',75); e && e.preventDefault(); };
  btn.addEventListener('pointerdown', (e) => { try { btn.style.transform = 'scale(0.92)'; btn.style.background = 'rgba(255,255,255,0.14)'; } catch(_){}; onDown(e); });
  btn.addEventListener('pointerup', (e) => { try { btn.style.transform = ''; btn.style.background = 'rgba(255,255,255,0.08)'; } catch(_){}; onUp(e); });
  btn.addEventListener('touchstart', (e) => { try { btn.style.transform = 'scale(0.92)'; btn.style.background = 'rgba(255,255,255,0.14)'; } catch(_){}; onDown(e); }, { passive: false });
  btn.addEventListener('touchend', (e) => { try { btn.style.transform = ''; btn.style.background = 'rgba(255,255,255,0.08)'; } catch(_){}; onUp(e); }, { passive: false });
  // Also support quick tap: fire a short keydown->keyup pulse for reliability
  const onTap = (e) => {
    // visual pulse
    try { btn.style.transform = 'scale(0.88)'; btn.style.background = 'rgba(255,255,255,0.16)'; } catch (_) {}
    synthKey('keydown','k',75);
    setTimeout(() => synthKey('keyup','k',75), 90);
    setTimeout(() => { try { btn.style.transform = ''; btn.style.background = 'rgba(255,255,255,0.08)'; } catch(_){} }, 160);
    e && e.preventDefault();
  };
  btn.addEventListener('click', onTap);
  document.body.appendChild(btn);
  console.log('[mobile-input] dodge button created');
}

// Mobile DOM: main menu overlay (click Start -> show level select)
function createMobileMainMenu() {
  removeIfExists('mobile-main-menu');
  const overlay = document.createElement('div');
  overlay.id = 'mobile-main-menu';
  Object.assign(overlay.style, {
    position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20000,
    background: 'linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0.2))'
  });

  const card = document.createElement('div');
  Object.assign(card.style, { background: 'rgba(15,23,36,0.95)', padding: '18px', borderRadius: '10px', textAlign: 'center', color: '#fff', width: '320px' });
  const title = document.createElement('div');
  title.textContent = 'MINI FLAT HEROES';
  Object.assign(title.style, { fontSize: '22px', fontWeight: 900, marginBottom: '10px', letterSpacing: '1px' });

  // Big Start button (merges 1P/2P)
  const start = document.createElement('button');
  start.id = 'mobile-start';
  start.textContent = 'START';
  Object.assign(start.style, { padding: '14px 18px', fontSize: '18px', borderRadius: '10px', background: '#4ade80', color: '#072', border: 'none', fontWeight: 700, width: '100%', marginBottom: '10px' });
  start.addEventListener('click', (e) => {
    const g = window.game;
    if (g) {
      g.showMainMenu = false;
      g.showLevelSelect = true;
    }
    const lvl = document.getElementById('mobile-level-select');
    if (lvl) lvl.style.display = 'flex';
    overlay.style.display = 'none';
    e && e.preventDefault();
  });

  // Tutorial button
  const tutorial = document.createElement('button');
  tutorial.id = 'mobile-tutorial';
  tutorial.textContent = 'TUTORIAL';
  Object.assign(tutorial.style, { padding: '10px 14px', fontSize: '16px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: '#fff', border: 'none', width: '100%' });
  tutorial.addEventListener('click', (e) => {
    const g = window.game;
    if (g) {
      g.showMainMenu = false;
      g.showLevelSelect = false;
      g.currentLevelIndex = 0;
      g.score = 0;
      g.levelStartScore = 0;
      g.loadLevel(0);
    }
    overlay.style.display = 'none';
    e && e.preventDefault();
  });

  // Instruction and footer
  const hint = document.createElement('div');
  hint.textContent = 'Use touch to select • Start to pick a level';
  Object.assign(hint.style, { fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '10px' });

  const ver = document.createElement('div');
  ver.textContent = 'v1.0 • Mobile';
  Object.assign(ver.style, { fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '8px' });

  card.appendChild(title);
  card.appendChild(start);
  card.appendChild(tutorial);
  card.appendChild(hint);
  card.appendChild(ver);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

// Mobile DOM: level select overlay with buttons for each level
function createMobileLevelSelect() {
  removeIfExists('mobile-level-select');
  const overlay = document.createElement('div');
  overlay.id = 'mobile-level-select';
  Object.assign(overlay.style, {
    position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
    display: 'none', alignItems: 'center', justifyContent: 'center', zIndex: 20000,
    background: 'linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0.2))', overflowY: 'auto', padding: '20px'
  });

  const container = document.createElement('div');
  Object.assign(container.style, { display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '10px', width: '100%', maxWidth: '420px' });

  for (let i = 1; i < levels.length; i++) {
    const btn = document.createElement('button');
    btn.className = 'mobile-level-btn';
    btn.textContent = `Level ${i}: ${levels[i].name || 'Stage'}`;
    Object.assign(btn.style, { padding: '12px', fontSize: '16px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.06)', color: '#fff', textAlign: 'left' });
    btn.addEventListener('click', (e) => {
      const g = window.game;
      if (g) {
        g.currentLevelIndex = i;
        g.score = 0;
        g.levelStartScore = 0;
        g.loadLevel(i);
      }
      overlay.style.display = 'none';
      e && e.preventDefault();
    });
    container.appendChild(btn);
  }

  // Back button
  const back = document.createElement('button');
  back.textContent = 'Back';
  Object.assign(back.style, { marginTop: '12px', padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', color: '#fff', border: 'none' });
  back.addEventListener('click', () => {
    overlay.style.display = 'none';
    const main = document.getElementById('mobile-main-menu');
    if (main) main.style.display = 'flex';
    const g = window.game; if (g) { g.showLevelSelect = false; g.showMainMenu = true; }
  });

  overlay.appendChild(container);
  overlay.appendChild(back);
  document.body.appendChild(overlay);
}

function showMobileToast() {
  const t = document.createElement('div');
  t.id = 'mobile-toast';
  t.textContent = 'You are playing on a mobile';
  Object.assign(t.style, {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    bottom: '18px',
    padding: '10px 16px',
    background: 'rgba(0,0,0,0.7)',
    color: '#fff',
    borderRadius: '999px',
    zIndex: 10000,
    fontSize: '14px',
    opacity: '0',
    transition: 'opacity 300ms ease, transform 300ms ease'
  });
  document.body.appendChild(t);
  // Force reflow then animate in
  requestAnimationFrame(() => {
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(-6px)';
  });
  // Hide after 2200ms
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(0px)';
    setTimeout(() => { t.remove(); }, 350);
  }, 2200);
}

// Robust mobile detection and initialization
function isMobileDevice() {
  try {
    const touch = ('ontouchstart' in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const uaMobile = /Mobi|Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    return touch || coarse || uaMobile;
  } catch (e) {
    return false;
  }
}

function removeIfExists(id) {
  const el = document.getElementById(id);
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function initMobileUI() {
  console.log('[mobile-input] initializing mobile UI');
  ['virtual-joystick','action-btn-a','action-btn-b','mobile-pause','mobile-utils','mobile-toast','mobile-dodge'].forEach(removeIfExists);
  createJoystick();
  createQuickControls();
  createUtilityButtons();
  createMobileMainMenu();
  createMobileLevelSelect();
  bindTapToEnter();
  // showMobileToast();
  // Ensure mobile main menu is visible immediately
  const mm = document.getElementById('mobile-main-menu');
  if (mm) mm.style.display = 'flex';
  const mls = document.getElementById('mobile-level-select');
  if (mls) mls.style.display = 'none';

  // If game exists, force it into main menu state for mobile UI start
  try {
    const g = window.game;
    if (g) {
      g.showMainMenu = true;
      g.showLevelSelect = false;
    }
  } catch (err) {}

  // Fallback: if user taps anywhere and the mobile menus are hidden, show main menu
  const ensureMenuHandler = (e) => {
    try {
      // If joystick is currently visible (user touching), don't show the main menu — avoids flicker
      const vj = document.getElementById('virtual-joystick');
      if (vj && vj.style && vj.style.display === 'block') return;
      const main = document.getElementById('mobile-main-menu');
      const lvl = document.getElementById('mobile-level-select');
      const g = window.game;
      // If game exists and we're currently in gameplay, do not show the menu
      if (g && !g.showMainMenu && !g.showLevelSelect) return;
      if (main && (main.style.display === 'none' || main.style.display === '')) {
        // don't interfere if a UI control was tapped
        const el = e.target;
        if (el && el.closest && (el.closest('#mobile-utils') || el.closest('#mobile-pause') || el.closest('#mobile-level-select'))) return;
        main.style.display = 'flex';
      }
    } catch (err) {}
  };
  window.addEventListener('pointerdown', ensureMenuHandler, { passive: true });

  console.log('[mobile-input] mobile UI created');

  // Watch game state and create/remove dodge button only when gameplay is active
  let _watchInterval = null;
  let _followRaf = null;
  function startFollowRaf() {
    if (_followRaf) return;
    const loop = () => {
      try {
        const js = document.getElementById('virtual-joystick');
        const g = window.game;
        if (js && js.updateFollow && g && !g.showMainMenu && !g.showLevelSelect) js.updateFollow();
      } catch (e) {}
      _followRaf = requestAnimationFrame(loop);
    };
    _followRaf = requestAnimationFrame(loop);
  }
  function stopFollowRaf() {
    if (_followRaf) cancelAnimationFrame(_followRaf);
    _followRaf = null;
  }
  function ensureWatchGame() {
    if (_watchInterval) return;
    _watchInterval = setInterval(() => {
      try {
        const g = window.game;
        const exists = !!g;
        if (!exists) return;
        const inMain = !!g.showMainMenu;
        const inLevelSelect = !!g.showLevelSelect;
        const inGameplay = !g.showMainMenu && !g.showLevelSelect;

        // Overlay visibility: prefer DOM overlays for mobile

        const mainOverlay = document.getElementById('mobile-main-menu');
        const lvlOverlay = document.getElementById('mobile-level-select');
        if (mainOverlay) mainOverlay.style.display = inMain ? 'flex' : 'none';
        if (lvlOverlay) lvlOverlay.style.display = inLevelSelect ? 'flex' : 'none';

        // Hide canvas while mobile overlays are visible so desktop menu isn't visible underneath
        try {
          const canvasEl = document.getElementById('gameCanvas');
          if (canvasEl) {
            if ((mainOverlay && mainOverlay.style.display === 'flex') || (lvlOverlay && lvlOverlay.style.display === 'flex')) {
              canvasEl.style.visibility = 'hidden';
            } else {
              canvasEl.style.visibility = '';
            }
          }
        } catch (err) {}

        // Dodge button only during gameplay
        const hasDodge = !!document.getElementById('mobile-dodge');
        if (inGameplay && !hasDodge) createDodgeButton();
        if (!inGameplay && hasDodge) removeIfExists('mobile-dodge');

        // Joystick follows user's finger now; no per-frame player-follow loop needed
      } catch (e) {
        // ignore
      }
    }, 300);
  }
  ensureWatchGame();
}

if (typeof window !== 'undefined') {
  console.log('[mobile-input] runtime detection ->', { ua: navigator.userAgent, maxTouchPoints: navigator.maxTouchPoints });
  if (isMobileDevice()) {
    if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', initMobileUI);
    else initMobileUI();
  } else {
    console.log('[mobile-input] device not detected as mobile — mobile UI skipped');
  }
}

// 绑定画布或 wrapper 的点击为 Enter（便于从菜单或提示进入游戏）
function bindTapToEnter() {
  const canvas = document.getElementById('gameCanvas');
  const wrapper = document.getElementById('wrapper');
  const target = canvas || wrapper || document.body;
  const handler = (e) => {
    // Ignore taps on UI controls
    const el = e.target;
    if (!el) return;
    if (el.closest && (el.closest('#mobile-utils') || el.closest('#mobile-pause') || el.id === 'mobile-pause')) return;
    // For mobile we use the DOM-based menus; do not interpret canvas touches.
    // Synthesize Enter press to preserve keyboard-based handlers where appropriate.
    synthKey('keydown','Enter',13);
    synthKey('keyup','Enter',13);
    e && e.preventDefault();
  };
  target.addEventListener('pointerdown', handler);
  // fallback for older touchonly devices
  target.addEventListener('touchstart', handler, { passive: false });
}

export {};
