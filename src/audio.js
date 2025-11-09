// Minimal AudioManager using Web Audio API to generate simple sfx and background tone
export class AudioManager {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this._masterVolume = 0.12;
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
      o.frequency.setValueAtTime(640, now);
      g.gain.setValueAtTime(0.06, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    } else if (type === 'stomp') {
      o.frequency.setValueAtTime(200, now);
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    } else if (type === 'hit') {
      o.frequency.setValueAtTime(120, now);
      g.gain.setValueAtTime(0.18, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    } else {
      o.frequency.setValueAtTime(440, now);
      g.gain.setValueAtTime(0.05, now);
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
    // simple ambient pad using two oscillators
    if (this.musicOsc) return; // already playing
    const now = this.ctx.currentTime;
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o1.type = 'sine';
    o2.type = 'sine';
    o1.frequency.setValueAtTime(220, now);
    o2.frequency.setValueAtTime(330, now);
    g.gain.value = 0.02;
    o1.connect(g);
    o2.connect(g);
    g.connect(this.master);
    o1.start(now);
    o2.start(now);
    this.musicOsc = { o1, o2, g };
  }

  stopMusic() {
    if (!this.musicOsc) return;
    const now = this.ctx.currentTime;
    const { o1, o2, g } = this.musicOsc;
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    o1.stop(now + 0.6);
    o2.stop(now + 0.6);
    this.musicOsc = null;
  }
}
