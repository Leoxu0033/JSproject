// Particle system with a small object pool to reduce per-frame allocations
const POOL = [];
const MAX_POOL = 400; // maximum pooled particles

export function createParticle(x, y, color = '#fff', opts = {}) {
  const angle = Math.random() * Math.PI * 2;
  const speed = (opts.speed || 60) + Math.random() * (opts.speedVar || 160);
  const life = (opts.life || 0.4) + Math.random() * (opts.lifeVar || 0.9);
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  return obtainParticle(x, y, vx, vy, life, color);
}

// spawn a burst of particles and return an array
export function spawnBurst(x, y, color = '#fff', count = 8, preset = 'default') {
  const out = [];
  for (let i = 0; i < count; i++) {
    // vary color slightly and position
    const ox = x + (Math.random() - 0.5) * 8;
    const oy = y + (Math.random() - 0.5) * 8;
    if (preset === 'spark') {
      out.push(obtainParticleFromOpts(ox, oy, color, { speed: 40, speedVar: 80, life: 0.25, lifeVar: 0.3 }));
    } else if (preset === 'big') {
      out.push(obtainParticleFromOpts(ox, oy, color, { speed: 140, speedVar: 220, life: 0.6, lifeVar: 0.8 }));
    } else {
      out.push(obtainParticleFromOpts(ox, oy, color, {}));
    }
  }
  return out;
}

function obtainParticleFromOpts(x, y, color, opts) {
  const angle = Math.random() * Math.PI * 2;
  const speed = (opts.speed || 60) + Math.random() * (opts.speedVar || 160);
  const life = (opts.life || 0.4) + Math.random() * (opts.lifeVar || 0.9);
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  return obtainParticle(x, y, vx, vy, life, color);
}

function obtainParticle(x, y, vx, vy, life, color) {
  let p = null;
  if (POOL.length > 0) {
    p = POOL.pop();
    p.reset(x, y, vx, vy, life, color);
  } else {
    p = new Particle(x, y, vx, vy, life, color);
  }
  return p;
}

export class Particle {
  constructor(x, y, vx, vy, life, color) {
    this.reset(x, y, vx, vy, life, color);
    this._initSize = 3 + Math.random() * 3;
  }

  reset(x, y, vx, vy, life, color) {
    this.x = x || 0;
    this.y = y || 0;
    this.vx = vx || 0;
    this.vy = vy || 0;
    this.life = life || 0.5;
    this.age = 0;
    this.color = color || '#fff';
    this.alive = true;
    this.size = this._initSize || (3 + Math.random() * 3);
  }

  update(dt) {
    this.age += dt;
    if (this.age >= this.life) {
      this.alive = false;
      // return to pool if there's room
      if (POOL.length < MAX_POOL) POOL.push(this);
      return;
    }
    // simple physics
    this.vy += 800 * dt; // gravity
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  draw(ctx) {
    const t = 1 - this.age / this.life;
    ctx.save();
    ctx.globalAlpha = t;
    const c = this.color || '#fff';
    ctx.fillStyle = c;
    const s = Math.max(1, this.size * (0.6 + t * 0.8));
    ctx.fillRect(this.x - s / 2, this.y - s / 2, s, s);
    ctx.restore();
  }
}
