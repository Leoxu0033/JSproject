class Input {
  constructor() {
    this.keys = new Set();
    window.addEventListener('keydown', (e) => this.keys.add(e.key));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key));
  }

  isDown(...names) {
    for (const n of names) if (this.keys.has(n)) return true;
    return false;
  }
}

// Export a shared singleton input manager so all game objects read the same state
export const input = new Input();
