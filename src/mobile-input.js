// Mobile touch input adapter (方案 A)
// 在触摸设备上创建虚拟摇杆与按钮，并通过合成 KeyboardEvent 把触摸映射为键盘事件

function synthKey(type, key, keyCode) {
  const ev = new KeyboardEvent(type, {
    key,
    code: key,
    keyCode,
    which: keyCode,
    bubbles: true,
    cancelable: true
  });
  window.dispatchEvent(ev);
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
    touchAction: 'none'
  });
  document.body.appendChild(joystick);

  let activeId = null;
  let startX = 0;
  let startY = 0;

  function clearDirs() {
    ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].forEach(k => {
      const codeMap = { ArrowLeft:37, ArrowRight:39, ArrowUp:38, ArrowDown:40 };
      synthKey('keyup', k, codeMap[k]);
    });
  }

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

function createActionButtons() {
  const a = document.createElement('button');
  a.id = 'action-btn-a';
  a.className = 'action-btn';
  a.textContent = 'A';
  a.setAttribute('aria-label','Action A');
  Object.assign(a.style, {
    position:'fixed', right:'24px', bottom:'90px', width:'72px', height:'72px',
    borderRadius:'50%', zIndex:9999, fontSize:'20px', opacity:0.95, touchAction:'none'
  });
  document.body.appendChild(a);

  const b = document.createElement('button');
  b.id = 'action-btn-b';
  b.className = 'action-btn';
  b.textContent = 'B';
  b.setAttribute('aria-label','Action B');
  Object.assign(b.style, {
    position:'fixed', right:'110px', bottom:'40px', width:'64px', height:'64px',
    borderRadius:'50%', zIndex:9999, fontSize:'18px', opacity:0.9, touchAction:'none'
  });
  document.body.appendChild(b);

  // 映射：A -> 空格 (32), B -> KeyX (88)
  a.addEventListener('touchstart', e => { synthKey('keydown',' ',32); e.preventDefault(); }, { passive:false });
  a.addEventListener('touchend', e => { synthKey('keyup',' ',32); e.preventDefault(); }, { passive:false });
  b.addEventListener('touchstart', e => { synthKey('keydown','x',88); e.preventDefault(); }, { passive:false });
  b.addEventListener('touchend', e => { synthKey('keyup','x',88); e.preventDefault(); }, { passive:false });
}

function createQuickControls() {
  const pause = document.createElement('button');
  pause.id = 'mobile-pause';
  pause.textContent = '⏸';
  Object.assign(pause.style, { position:'fixed', right:'12px', top:'12px', zIndex:9999, width:'44px', height:'44px', borderRadius:'8px' });
  pause.addEventListener('click', () => { synthKey('keydown','p',80); synthKey('keyup','p',80); });
  document.body.appendChild(pause);
}

// 初始化（仅在触摸设备上）
if (typeof window !== 'undefined') {
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    // 延迟到 DOM ready
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', () => { createJoystick(); createActionButtons(); createQuickControls(); });
    } else {
      createJoystick(); createActionButtons(); createQuickControls();
    }
  }
}

export {};
