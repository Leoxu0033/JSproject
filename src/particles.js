// Very small particle helper — returns a particle object with update + draw
// create a single particle
export function createParticle(x, y, color = '#fff') {
  const angle = Math.random() * Math.PI * 2;
  const speed = 60 + Math.random() * 160;
  const life = 0.4 + Math.random() * 0.9;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  return new Particle(x, y, vx, vy, life, color);
}

// spawn a burst of particles and return an array
export function spawnBurst(x, y, color = '#fff', count = 8) {
  const out = [];
  for (let i = 0; i < count; i++) {
    // vary color slightly
    out.push(createParticle(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6, color));
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
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.restore();
  }
}
