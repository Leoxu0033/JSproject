// Very small particle helper — returns a particle object with update + draw
// create a single particle
export function createParticle(x, y, color = '#fff', opts = {}) {
  const angle = Math.random() * Math.PI * 2;
  const speed = (opts.speed || 60) + Math.random() * (opts.speedVar || 160);
  const life = (opts.life || 0.4) + Math.random() * (opts.lifeVar || 0.9);
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  return new Particle(x, y, vx, vy, life, color);
}

// spawn a burst of particles and return an array
export function spawnBurst(x, y, color = '#fff', count = 8, preset = 'default') {
  const out = [];
  for (let i = 0; i < count; i++) {
    // vary color slightly
    const ox = x + (Math.random() - 0.5) * 8;
    const oy = y + (Math.random() - 0.5) * 8;
    if (preset === 'spark') {
      out.push(createParticle(ox, oy, color, { speed: 40, speedVar: 80, life: 0.25, lifeVar: 0.3 }));
    } else if (preset === 'big') {
      out.push(createParticle(ox, oy, color, { speed: 140, speedVar: 220, life: 0.6, lifeVar: 0.8 }));
    } else {
      out.push(createParticle(ox, oy, color));
    }
  }
  return out;
}

export class Particle {
  constructor(x, y, vx, vy, life, color) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.age = 0;
    this.color = color;
    this.alive = true;
    this.size = 3 + Math.random() * 3;
  }

  update(dt) {
    this.age += dt;
    if (this.age >= this.life) {
      this.alive = false;
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
    // shimmer gradient for nicer look
    const c = this.color || '#fff';
    ctx.fillStyle = c;
    const s = Math.max(1, this.size * (0.6 + t * 0.8));
    
    // Draw circle instead of rect
    ctx.beginPath();
    ctx.arc(this.x, this.y, s / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // Add glow
    ctx.shadowColor = c;
    ctx.shadowBlur = 10;
    ctx.fill();
    
    ctx.restore();
  }
}
