class Input {
  constructor() {
    this.keys = new Set();
    // Track both code (physical) and key (character) to be robust
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      this.keys.add(e.key);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.keys.delete(e.key);
    });
    // Clear keys when window loses focus to prevent sticky keys
    window.addEventListener('blur', () => this.keys.clear());
  }

  isDown(...names) {
    for (const n of names) if (this.keys.has(n)) return true;
    return false;
  }
}

// Export a shared singleton input manager so all game objects read the same state
export const input = new Input();
