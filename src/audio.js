// Minimal AudioManager using Web Audio API to generate simple sfx and background tone
export class AudioManager {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this._masterVolume = 0.4; // Increased from 0.12 to 0.4
    this.master.gain.value = this._masterVolume;
    this.master.connect(this.ctx.destination);
    this.muted = false;
    this.musicOsc = null;
    this.buffers = {}; // map of loaded AudioBuffer samples
  }

  playSfx(type = 'click') {
    // prefer sample playback if available
    const buf = this.buffers[type];
    if (buf) {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g2 = this.ctx.createGain();
      g2.gain.value = 1.0;
      src.connect(g2);
      g2.connect(this.master);
      src.start(this.ctx.currentTime);
      return;
    }
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    if (type === 'jump') {
      // Jump sound - higher pitch, quick
      o.frequency.setValueAtTime(800, now);
      o.frequency.exponentialRampToValueAtTime(400, now + 0.15);
      g.gain.setValueAtTime(0.25, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    } else if (type === 'stomp') {
      // Stomp/kill enemy - punchy low sound
      o.frequency.setValueAtTime(150, now);
      o.frequency.exponentialRampToValueAtTime(80, now + 0.1);
      g.gain.setValueAtTime(0.35, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    } else if (type === 'hit') {
      // Player hit - harsh sound
      o.frequency.setValueAtTime(100, now);
      o.frequency.exponentialRampToValueAtTime(60, now + 0.2);
      g.gain.setValueAtTime(0.4, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    } else if (type === 'dash') {
      // Dash sound - quick whoosh
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(600, now);
      o.frequency.exponentialRampToValueAtTime(200, now + 0.1);
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    } else if (type === 'land') {
      // Landing sound - soft thud
      o.frequency.setValueAtTime(180, now);
      o.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      g.gain.setValueAtTime(0.15, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    } else if (type === 'collect' || type === 'score') {
      // Score/collect - pleasant chime
      o.type = 'sine';
      o.frequency.setValueAtTime(880, now);
      o.frequency.exponentialRampToValueAtTime(1320, now + 0.1);
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    } else if (type === 'win') {
      // Win sound - ascending melody
      o.type = 'sine';
      o.frequency.setValueAtTime(440, now);
      o.frequency.setValueAtTime(554, now + 0.1);
      o.frequency.setValueAtTime(659, now + 0.2);
      g.gain.setValueAtTime(0.3, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    } else if (type === 'explosion') {
      // Explosion - noise-like, louder
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(80, now);
      o.frequency.exponentialRampToValueAtTime(40, now + 0.3);
      g.gain.setValueAtTime(0.7, now); // Increased from 0.4 to 0.7
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    } else if (type === 'select') {
      // Menu select - click
      o.frequency.setValueAtTime(600, now);
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    } else {
      // Default click
      o.frequency.setValueAtTime(440, now);
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    }
    o.connect(g);
    g.connect(this.master);
    o.start(now);
    o.stop(now + 0.5);
  }

  // Load a map of samples {key: url}
  async loadSamples(map) {
    const keys = Object.keys(map || {});
    const promises = keys.map(async (k) => {
      try {
        const res = await fetch(map[k]);
        if (!res.ok) throw new Error('Failed to fetch ' + map[k]);
        const arr = await res.arrayBuffer();
        const buf = await this.ctx.decodeAudioData(arr.slice(0));
        this.buffers[k] = buf;
      } catch (err) {
        console.warn('Audio load failed for', k, map[k], err);
      }
    });
    await Promise.all(promises);
  }

  // resume audio context after user gesture
  resume() {
    if (this.ctx.state === 'suspended') {
      return this.ctx.resume();
    }
    return Promise.resolve();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.master.gain.setValueAtTime(this.muted ? 0 : this._masterVolume, this.ctx.currentTime);
  }

  playMusic() {
    // Richer ambient pad using multiple oscillators
    if (this.musicOsc) return; // already playing
    const now = this.ctx.currentTime;
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const o3 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    
    // Base tone (A3)
    o1.type = 'sine';
    o1.frequency.setValueAtTime(220, now);
    
    // Fifth (E4)
    o2.type = 'sine';
    o2.frequency.setValueAtTime(330, now);
    
    // Octave (A4) - adds richness
    o3.type = 'triangle';
    o3.frequency.setValueAtTime(440, now);
    
    // Increased music volume
    g.gain.value = 0.08; // Increased from 0.02 to 0.08
    
    o1.connect(g);
    o2.connect(g);
    o3.connect(g);
    g.connect(this.master);
    o1.start(now);
    o2.start(now);
    o3.start(now);
    this.musicOsc = { o1, o2, o3, g };
  }

  stopMusic() {
    if (!this.musicOsc) return;
    const now = this.ctx.currentTime;
    const { o1, o2, o3, g } = this.musicOsc;
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    o1.stop(now + 0.6);
    o2.stop(now + 0.6);
    o3.stop(now + 0.6);
    this.musicOsc = null;
  }
  
  pauseMusic() {
    // Alias for stopMusic
    this.stopMusic();
  }
}
