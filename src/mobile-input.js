// Mobile touch input adapter (方案 A)
// 在触摸设备上创建虚拟摇杆与按钮，并把触摸直接写入共享的 `input` 实例（更可靠）
import { input } from './input.js';

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
    bottom: '12px',
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.18)',
    zIndex: 9999,
    touchAction: 'none',
    pointerEvents: 'auto'
  });
  // ensure visible even if CSS has rules
  joystick.style.display = 'block';

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

  function clearDirs() {
    ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].forEach(k => {
      const codeMap = { ArrowLeft:37, ArrowRight:39, ArrowUp:38, ArrowDown:40 };
      synthKey('keyup', k, codeMap[k]);
    });
    // reset knob visual
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
  }

  // Pointer events (preferred) for broader compatibility
  joystick.addEventListener('pointerdown', e => {
    activePointerId = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    joystick.setPointerCapture && joystick.setPointerCapture(activePointerId);
    e.preventDefault();
  });

  joystick.addEventListener('pointermove', e => {
    if (activePointerId === null || e.pointerId !== activePointerId) return;
    const rect = joystick.getBoundingClientRect();
    const cx = rect.left + rect.width/2;
    const cy = rect.top + rect.height/2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const max = rect.width/2 - 10;
    // move knob visually within max radius
    const dist = Math.hypot(dx, dy);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    const limitedDist = Math.min(dist, max);
    if (knob) knob.style.transform = `translate(calc(-50% + ${nx * limitedDist}px), calc(-50% + ${ny * limitedDist}px))`;

    clearDirs();
    const dead = 10; // px
    if (dx < -dead) synthKey('keydown','ArrowLeft',37);
    else if (dx > dead) synthKey('keydown','ArrowRight',39);
    if (dy < -dead) synthKey('keydown','ArrowUp',38);
    else if (dy > dead) synthKey('keydown','ArrowDown',40);
    e.preventDefault();
  });

  joystick.addEventListener('pointerup', e => {
    if (e.pointerId === activePointerId) {
      activePointerId = null;
      clearDirs();
    }
    e.preventDefault();
  });

  // debug logging for touch events (can be removed later)
  joystick.addEventListener('pointerdown', () => console.log('[mobile-input] joystick pointerdown'));
  joystick.addEventListener('pointermove', () => console.log('[mobile-input] joystick pointermove'));
  joystick.addEventListener('pointerup', () => console.log('[mobile-input] joystick pointerup'));

  // touch fallback
  joystick.addEventListener('touchstart', e => {
    const t = e.changedTouches[0];
    activeId = t.identifier;
    startX = t.clientX; startY = t.clientY;
    e.preventDefault();
  }, { passive: false });

  joystick.addEventListener('touchmove', e => {
    if (activeId === null) return;
    const touches = Array.from(e.changedTouches);
    const t = touches.find(x => x.identifier === activeId);
    if (!t) return;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;

    clearDirs();
    const threshold = 12; // 像素阈值
    if (dx < -threshold) synthKey('keydown','ArrowLeft',37);
    else if (dx > threshold) synthKey('keydown','ArrowRight',39);
    if (dy < -threshold) synthKey('keydown','ArrowUp',38);
    else if (dy > threshold) synthKey('keydown','ArrowDown',40);

    e.preventDefault();
  }, { passive: false });

  joystick.addEventListener('touchend', e => {
    const touches = Array.from(e.changedTouches);
    const t = touches.find(x => x.identifier === activeId);
    if (t) {
      activeId = null;
      clearDirs();
    }
    e.preventDefault();
  }, { passive: false });
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
  btn.textContent = '闪避';
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
  const onDown = (e) => { synthKey('keydown','k',75); e && e.preventDefault(); };
  const onUp = (e) => { synthKey('keyup','k',75); e && e.preventDefault(); };
  btn.addEventListener('pointerdown', onDown);
  btn.addEventListener('pointerup', onUp);
  btn.addEventListener('touchstart', onDown, { passive: false });
  btn.addEventListener('touchend', onUp, { passive: false });
  document.body.appendChild(btn);
  console.log('[mobile-input] dodge button created');
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
  createDodgeButton();
  bindTapToEnter();
  showMobileToast();
  console.log('[mobile-input] mobile UI created');
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
    // Synthesize Enter press
    synthKey('keydown','Enter',13);
    synthKey('keyup','Enter',13);
    e && e.preventDefault();
  };
  target.addEventListener('pointerdown', handler);
  // fallback for older touchonly devices
  target.addEventListener('touchstart', handler, { passive: false });
}

export {};
