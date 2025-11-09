import { clamp, rectsIntersect } from './utils.js';
import { input } from './input.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { AudioManager } from './audio.js';
import { spawnParticles as createParticles, Particle } from './particles.js';

export default class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

  this.last = 0;
  this.acc = 0;
  this.timestep = 1 / 60; // seconds

    this.entities = [];
    this.player = new Player(100, this.height - 120);
    this.entities.push(this.player);

    // spawn some enemies
    this.enemies = [];
    for (let i = 0; i < 4; i++) {
      const e = new Enemy(400 + i * 90, this.height - 90);
      this.enemies.push(e);
      this.entities.push(e);
    }

    // shared input already initialized in input.js
    this.input = input;
    this.particles = [];
    this.score = 0;
    this.gameOver = false;

    this.audio = new AudioManager();
    this.audio.playMusic();
    // screen effects
    this.shakeTimer = 0;
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.shakeOffset = { x: 0, y: 0 };
    this.flashTimer = 0;
    this.flashColor = null;
  }

  start() {
    this.last = performance.now();
    this._frame = (t) => this._loop(t);
    requestAnimationFrame(this._frame);
  }

  reset() {
    // simple reset
    this.entities = [];
    this.player = new Player(100, this.height - 120);
    this.entities.push(this.player);
    this.enemies = [];
    for (let i = 0; i < 4; i++) {
      const e = new Enemy(400 + i * 90, this.height - 90);
      this.enemies.push(e);
      this.entities.push(e);
    }
    this.score = 0;
    this.gameOver = false;
    this.audio.playMusic();
  }

  _loop(now) {
    const elapsed = (now - this.last) / 1000; // seconds
    this.last = now;
    // clamp elapsed
    const clamped = Math.min(0.25, elapsed);
    this.acc += clamped;

    while (this.acc >= this.timestep) {
      this._update(this.timestep);
      this.acc -= this.timestep;
    }
    this._render();

    requestAnimationFrame(this._frame);
  }

  _update(dt) {
    if (this.gameOver) return;

    // update entities
    for (const e of this.entities) {
      e.update(dt, this);
    }

    // update particles
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter((p) => p.alive);

    // collision: player vs enemies
    for (const en of this.enemies) {
      if (rectsIntersect(this.player.getBounds(), en.getBounds())) {
        // if player is falling and above enemy, stomp
        const playerBottom = this.player.pos.y + this.player.h;
        const enTop = en.pos.y;
        if (this.player.vel.y > 120 && playerBottom - enTop < 20) {
          en.alive = false;
          this.score += 100;
          this.audio.playSfx('stomp');
          // spawn particles
          this.spawnParticles(en.pos.x + en.w / 2, en.pos.y + en.h / 2, '#ff4d4d', 12);
          // bounce player slightly
          this.player.vel.y = -200;
          // small screen shake and flash on stomp
          this.screenShake(6, 0.18);
          this.flash('#ffffff', 0.12);
        } else {
          // non-stomp: damage the player
          if (!this.player.invulnerable) {
            this.player.takeHit(en, this);
            if (this.player.lives <= 0) {
              this.gameOver = true;
              this.audio.stopMusic();
            }
          }
        }
      }
    }

    // remove dead enemies from entity list
    this.entities = this.entities.filter((e) => e.alive !== false);
    this.enemies = this.enemies.filter((e) => e.alive !== false);

    // update HUD
    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.textContent = `Score: ${this.score}`;
    const livesEl = document.getElementById('lives');
    if (livesEl) livesEl.textContent = `Lives: ${this.player.lives}`;
  }

  spawnParticles(x, y, color = '#fff', count = 8) {
    // use spawnBurst helper to create multiple particles at once
    const burst = createParticles(x, y, color, count);
    for (const p of burst) this.particles.push(p);
  }

  // screen shake: intensity in px, duration in seconds
  screenShake(intensity = 8, duration = 0.3) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakeTimer = this.shakeDuration;
  }

  flash(color = '#fff', duration = 0.08) {
    this.flashColor = color;
    this.flashTimer = Math.max(this.flashTimer, duration);
  }

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // update screen shake offsets
    if (this.shakeTimer > 0) {
      const t = this.shakeTimer / this.shakeDuration;
      const mag = this.shakeIntensity * t;
      this.shakeOffset.x = (Math.random() * 2 - 1) * mag;
      this.shakeOffset.y = (Math.random() * 2 - 1) * mag;
      this.shakeTimer = Math.max(0, this.shakeTimer - this.timestep);
    } else {
      this.shakeOffset.x = 0;
      this.shakeOffset.y = 0;
      this.shakeIntensity = 0;
    }

    ctx.save();
    ctx.translate(this.shakeOffset.x, this.shakeOffset.y);

    // background
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, this.width, this.height);

    // simple ground
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, this.height - 60, this.width, 60);

    // draw entities
    for (const e of this.entities) e.draw(ctx);

    // draw particles (on top of entities)
    for (const p of this.particles) p.draw(ctx);

    ctx.restore();

    // flash overlay (drawn without shake)
    if (this.flashTimer > 0) {
      const alpha = Math.max(0, this.flashTimer / 0.12);
      ctx.save();
      ctx.fillStyle = this.flashColor || '#fff';
      ctx.globalAlpha = 0.9 * alpha;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
      this.flashTimer = Math.max(0, this.flashTimer - this.timestep);
    }

    if (this.gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#fff';
      ctx.font = '36px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over — Press R to restart', this.width / 2, this.height / 2);
    }
  }
}
