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
  document.body.appendChild(joystick);

  let activeId = null;
  let activePointerId = null;
  let startX = 0;
  let startY = 0;

  function clearDirs() {
    ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].forEach(k => {
      const codeMap = { ArrowLeft:37, ArrowRight:39, ArrowUp:38, ArrowDown:40 };
      synthKey('keyup', k, codeMap[k]);
    });
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
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    clearDirs();
    const threshold = 12; // 像素阈值
    if (dx < -threshold) synthKey('keydown','ArrowLeft',37);
    else if (dx > threshold) synthKey('keydown','ArrowRight',39);
    if (dy < -threshold) synthKey('keydown','ArrowUp',38);
    else if (dy > threshold) synthKey('keydown','ArrowDown',40);
    e.preventDefault();
  });

  joystick.addEventListener('pointerup', e => {
    if (e.pointerId === activePointerId) {
      activePointerId = null;
      clearDirs();
    }
    e.preventDefault();
  });

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

// 初始化（仅在触摸设备上）
if (typeof window !== 'undefined') {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    // 延迟到 DOM ready
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', () => { createJoystick(); /*createActionButtons();*/ createQuickControls(); createUtilityButtons(); bindTapToEnter(); showMobileToast(); });
    } else {
      createJoystick(); /*createActionButtons();*/ createQuickControls(); createUtilityButtons(); bindTapToEnter(); showMobileToast();
    }
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
