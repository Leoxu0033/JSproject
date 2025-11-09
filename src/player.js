import { clamp } from './utils.js';
import { input } from './input.js';

export class Player {
  constructor(x, y) {
    this.pos = { x, y };
    this.w = 34;
    this.h = 34;
    this.vel = { x: 0, y: 0 };
    this.speed = 260; // px/s
    this.jumpSpeed = -520;
    this.onGround = false;
    this.alive = true;
    // use shared input instance
    this.input = input;
    // small coyote time & jump buffer
    this.coyote = 0.08; // seconds
    this.coyoteTimer = 0;
    this.jumpBuffer = 0.08;
    this.jumpBufferTimer = 0;
    // health / damage
    this.lives = 3;
    this.invulnerable = false;
    this.invulTimer = 0;
    this.invulDuration = 1.0; // seconds
  }

  getBounds() {
    return { x: this.pos.x, y: this.pos.y, w: this.w, h: this.h };
  }

  update(dt, game) {
    // horizontal movement
    const left = this.input.isDown('ArrowLeft', 'a', 'A');
    const right = this.input.isDown('ArrowRight', 'd', 'D');

    if (left) this.vel.x = -this.speed;
    else if (right) this.vel.x = this.speed;
    else this.vel.x = 0;

    // jump buffering & coyote time
    const jumpPressed = this.input.isDown(' ', 'Space', 'w', 'W', 'ArrowUp');
    if (jumpPressed) this.jumpBufferTimer = this.jumpBuffer;
    else this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    if (this.onGround) this.coyoteTimer = this.coyote;
    else this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.vel.y = this.jumpSpeed;
      this.onGround = false;
      this.jumpBufferTimer = 0;
      if (game && game.audio) game.audio.playSfx('jump');
    }

    // gravity
    this.vel.y += 1400 * dt; // gravity px/s^2

  // integrate
  this.pos.x += this.vel.x * dt;
  this.pos.y += this.vel.y * dt;

    // ground collision simple
    const groundY = game.height - 60 - this.h;
    if (this.pos.y >= groundY) {
      this.pos.y = groundY;
      this.vel.y = 0;
      this.onGround = true;
    }

    // keep inside bounds
    this.pos.x = clamp(this.pos.x, 0, game.width - this.w);

    // invulnerability timer
    if (this.invulnerable) {
      this.invulTimer -= dt;
      if (this.invulTimer <= 0) {
        this.invulnerable = false;
        this.invulTimer = 0;
      }
    }
  }

  draw(ctx) {
    // minimal flat-hero-like square
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(this.pos.x + 4, this.pos.y + this.h + 4, this.w - 8, 6);
    // flash while invulnerable
    if (this.invulnerable) {
      const t = Math.floor(this.invulTimer * 20) % 2;
      ctx.globalAlpha = t ? 0.35 : 1.0;
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(this.pos.x, this.pos.y, this.w, this.h);
    ctx.globalAlpha = 1.0;
    ctx.restore();
  }

  takeHit(source, game) {
    if (this.invulnerable) return;
    this.lives -= 1;
    this.invulnerable = true;
    this.invulTimer = this.invulDuration;
    // knockback away from source
    const dir = this.pos.x < source.pos.x ? -1 : 1;
    this.vel.x = -dir * 220;
    this.vel.y = -260;
    if (game) {
      game.audio.playSfx('hit');
      game.spawnParticles(this.pos.x + this.w / 2, this.pos.y + this.h / 2, '#ffffff', 10);
    }
  }
}
