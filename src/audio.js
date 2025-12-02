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
    // Music flag: set true to enable background music
    this.musicEnabled = true;
    this.bgMusicBuffer = null;
    this.bgMusicSource = null;
    this.loadBgMusic();
  }

  async loadBgMusic() {
    try {
      const res = await fetch('assets/audio/bg.mp3');
      if (!res.ok) throw new Error('Failed to fetch assets/audio/bg.mp3');
      const arr = await res.arrayBuffer();
      this.bgMusicBuffer = await this.ctx.decodeAudioData(arr);
      if (this.musicEnabled && !this.bgMusicSource) {
        this.playMusic();
      }
    } catch (err) {
      console.warn('Background music load failed', err);
    }
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
    
    // Helper to create oscillator with envelope
    const createOsc = (type, freqStart, freqEnd, dur, volStart, volEnd) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freqStart, now);
      if (freqEnd !== null) o.frequency.exponentialRampToValueAtTime(freqEnd, now + dur);
      g.gain.setValueAtTime(volStart, now);
      g.gain.exponentialRampToValueAtTime(volEnd || 0.001, now + dur);
      o.connect(g);
      g.connect(this.master);
      o.start(now);
      o.stop(now + dur + 0.1);
      return { o, g };
    };

    if (type === 'jump') {
      // Jump: Quick rising sine
      createOsc('sine', 300, 600, 0.15, 0.3, 0.01);
    } else if (type === 'stomp') {
      // Stomp: Punchy kick (sine drop) + Noise burst
      createOsc('sine', 200, 50, 0.15, 0.5, 0.01);
      createOsc('square', 100, 50, 0.1, 0.1, 0.01); // Add some grit
    } else if (type === 'hit') {
      // Hit: Dissonant saw drop
      createOsc('sawtooth', 200, 100, 0.2, 0.3, 0.01);
      createOsc('sawtooth', 250, 120, 0.2, 0.3, 0.01);
    } else if (type === 'dash') {
      // Dash: White noise swoosh (simulated with high freq saw)
      createOsc('sawtooth', 800, 400, 0.15, 0.15, 0.01);
    } else if (type === 'land') {
      // Land: Soft thud
      createOsc('sine', 150, 80, 0.1, 0.2, 0.01);
    } else if (type === 'collect' || type === 'score') {
      // Collect: High ping
      createOsc('sine', 1200, 1200, 0.1, 0.15, 0.01);
      setTimeout(() => createOsc('sine', 1800, 1800, 0.1, 0.1, 0.01), 50);
    } else if (type === 'win') {
      // Win: Major chord arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C Major
      notes.forEach((freq, i) => {
        setTimeout(() => createOsc('triangle', freq, freq, 0.4, 0.2, 0.01), i * 80);
      });
    } else if (type === 'explosion') {
      // Explosion: Low rumble + noise
      createOsc('sawtooth', 100, 20, 0.4, 0.5, 0.01);
      createOsc('square', 50, 10, 0.5, 0.4, 0.01);
    } else if (type === 'select') {
      // Select: Crisp blip
      createOsc('sine', 800, 800, 0.05, 0.2, 0.01);
    } else {
      // Default click
      createOsc('triangle', 400, 400, 0.05, 0.2, 0.01);
    }
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
    // Create and play a silent buffer to unlock iOS audio
    try {
      const buffer = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);
    } catch (e) {
      // ignore
    }

    if (this.ctx.state === 'suspended') {
      return this.ctx.resume();
    }
    return Promise.resolve();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.master.gain.setValueAtTime(this.muted ? 0 : this._masterVolume, this.ctx.currentTime);
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicEnabled) {
      this.playMusic();
    } else {
      this.stopMusic();
    }
  }

  playMusic() {
    if (!this.musicEnabled) return; // disabled globally
    if (this.bgMusicSource) return; // already playing
    if (!this.bgMusicBuffer) return; // not loaded yet

    const src = this.ctx.createBufferSource();
    src.buffer = this.bgMusicBuffer;
    src.loop = true;
    
    const gain = this.ctx.createGain();
    gain.gain.value = 0.5; // Adjust volume for background music
    
    src.connect(gain);
    gain.connect(this.master);
    src.start(this.ctx.currentTime);
    
    this.bgMusicSource = src;
  }

  stopMusic() {
    if (this.bgMusicSource) {
      try {
        this.bgMusicSource.stop();
      } catch (e) {
        // ignore if already stopped
      }
      this.bgMusicSource = null;
    }
  }
  
  pauseMusic() {
    // Alias for stopMusic
    this.stopMusic();
  }
}
