export class Enemy {
  constructor(x, y) {
    this.pos = { x, y };
    this.w = 30;
    this.h = 30;
    this.vel = { x: 60, y: 0 };
    this.alive = true;
    this.patrolRange = 120;
    this.startX = x;
    // AI params
    this.aggroRange = 220;
    this.baseSpeed = 60;
    this.chaseSpeed = 140;
    this.turnDelay = 0.2;
    this.turnTimer = 0;
  }

  getBounds() {
    return { x: this.pos.x, y: this.pos.y, w: this.w, h: this.h };
  }

  update(dt, game) {
    // AI: if player nearby, chase horizontally; else patrol
    const dx = game.player.pos.x - this.pos.x;
    const dist = Math.abs(dx);
    if (dist < this.aggroRange) {
      // chase behavior
      const dir = dx < 0 ? -1 : 1;
      // accelerate towards player with limited turning
      if (this.turnTimer <= 0) {
        this.vel.x = dir * this.chaseSpeed;
        this.turnTimer = this.turnDelay;
      }
      this.turnTimer = Math.max(0, this.turnTimer - dt);
    } else {
      // patrol
      if (this.turnTimer <= 0) {
        this.vel.x = this.baseSpeed * (this.vel.x >= 0 ? 1 : -1);
      } else {
        this.turnTimer = Math.max(0, this.turnTimer - dt);
      }
      this.pos.x += this.vel.x * dt;
      if (this.pos.x > this.startX + this.patrolRange) this.vel.x = -Math.abs(this.baseSpeed);
      if (this.pos.x < this.startX - this.patrolRange) this.vel.x = Math.abs(this.baseSpeed);
    }

    // always move horizontally according to vel
    this.pos.x += this.vel.x * dt;

    // simple gravity to stick to ground
    const groundY = game.height - 60 - this.h;
    if (this.pos.y < groundY) {
      this.vel.y += 1400 * dt;
      this.pos.y += this.vel.y * dt;
      if (this.pos.y > groundY) {
        this.pos.y = groundY;
        this.vel.y = 0;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(this.pos.x, this.pos.y, this.w, this.h);
    ctx.restore();
  }
}
