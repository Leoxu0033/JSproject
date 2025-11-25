// Tadpole enemy: small, fast, always seeks player

import { rectsIntersect } from './utils.js';

export class Enemy {
  constructor(x, y, type = 'walker') {
    this.pos = { x, y };
    if (type === 'tadpole') {
      this.w = 16;
      this.h = 16;
    } else {
      this.w = 30;
      this.h = 30;
    }
    this.vel = { x: 60, y: 0 };
    this.alive = true;
    this.patrolRange = 120;
    this.startX = x;

    // default AI params
    this.type = type;
    this.state = 'patrol';
    this.aggroRange = 220;
  // tuned defaults for snappier chase
  this.baseSpeed = 90;
  this.chaseSpeed = 220;
    this.turnDelay = 0.2;
    this.turnTimer = 0;
    this.jumpTimer = 0;
    this.seenPlayer = false;

    this.initType(this.type);
    // anti-stuck helpers
    this.stuckTimer = 0;
    this.stuckThreshold = 0.35; // seconds before attempting escape
    // lifetime and free-movement
    this.lifeTimer = 0;
    if (type === 'tadpole') {
      this.lifeLimit = 3.5 + Math.random() * 2.5;
      this.freeMove = true;
    } else {
      // Non-tadpole enemies don't have auto-death timer
      this.lifeLimit = Infinity;
      this.freeMove = true;
    }
  }

  getBounds() {
    return { x: this.pos.x, y: this.pos.y, w: this.w, h: this.h };
  }

  initType(t) {
    this.type = t || 'walker';
    // randomize some base parameters for variety
    const r = Math.random() * 0.4 + 0.8; // 0.8..1.2
    this.patrolRange = this.patrolRange * (0.7 + Math.random() * 1.4);
    if (this.type === 'tadpole') {
      this.baseSpeed = 180 + Math.random() * 60; // Reduced from 320-400 to 180-240
      this.chaseSpeed = 250 + Math.random() * 80; // Reduced from 420-540 to 250-330
    } else {
      this.baseSpeed = (this.baseSpeed || 60) * r;
      this.chaseSpeed = (this.chaseSpeed || 140) * (0.9 + Math.random() * 0.4);
    }

    if (this.type === 'tadpole') {
      // always freeMove, no aggro range, always chase
      this.freeMove = true;
    } else if (this.type === 'chaser') {
      this.aggroRange = 260 + Math.floor(Math.random() * 80);
      this.chaseSpeed = this.chaseSpeed * (1.0 + Math.random() * 0.3);
      this.freeMove = true; // chasers will pursue in 2D
    } else if (this.type === 'jumper') {
      this.jumpTimer = 0.6 + Math.random() * 0.8;
      this.baseSpeed = 0;
    } else if (this.type === 'roamer') {
      // roamers pick random targets inside a range
      this.baseSpeed = 40 + Math.random() * 100;
      this.patrolRange = 80 + Math.random() * 240;
      this._roamTarget = this.startX + (Math.random() * 2 - 1) * this.patrolRange;
      this.freeMove = true;
    } else if (this.type === 'floater') {
      // floaters hover and move slowly, with vertical bob
      this.baseSpeed = 30 + Math.random() * 60;
      this._floatPhase = Math.random() * Math.PI * 2;
      this._floatAmp = 18 + Math.random() * 28;
      this.freeMove = true;
    }
  }

  update(dt, game) {
    // Find nearest alive player
    let player = null;
    let minD2 = Infinity;
    
    // Robustly gather candidates: use game.players if available, else game.player
    const targets = (game.players && game.players.length > 0) ? game.players : (game.player ? [game.player] : []);
    
    // Find nearest target
    for (const p of targets) {
      if (!p) continue;
      // If player has an alive flag and it's false, skip them
      if (typeof p.alive !== 'undefined' && !p.alive) continue;

      const pCx = p.pos.x + p.w / 2;
      const pCy = p.pos.y + p.h / 2;
      const myCx = this.pos.x + this.w / 2;
      const myCy = this.pos.y + this.h / 2;

      const dx = pCx - myCx;
      const dy = pCy - myCy;
      const d2 = dx*dx + dy*dy;
      
      if (d2 < minD2) {
        minD2 = d2;
        player = p;
      }
    }

    if (!player) return;
    const dx = (player.pos.x + player.w / 2) - (this.pos.x + this.w / 2);
    const dist = Math.abs(dx);

    // simple state machine
    if (this.type === 'tadpole') {
      // tadpole always chases player
      this.state = 'chase';
      this.seenPlayer = true;
    } else if (this.type === 'chaser' && dist < this.aggroRange) {
      this.state = 'chase';
      this.seenPlayer = true;
    } else if (this.type === 'jumper') {
      this.state = 'jumper';
    } else {
      if (!this.seenPlayer) this.state = 'patrol';
    }

    // behaviour per state
    if (this.state === 'chase') {
      // chase in full 2D: move toward player's center
      const py = player.pos.y + player.h / 2;
      const px = player.pos.x + player.w / 2;
      const vx = px - (this.pos.x + this.w / 2);
      const vy = py - (this.pos.y + this.h / 2);
      const mag = Math.hypot(vx, vy) || 1;
      const nx = vx / mag;
      const ny = vy / mag;
      if (this.type === 'tadpole') {
        // tadpoles always chase at high speed, no dodge
        this.vel.x = nx * this.chaseSpeed;
        this.vel.y = ny * this.chaseSpeed;
      } else {
        this.vel.x = nx * this.chaseSpeed;
        this.vel.y = ny * this.chaseSpeed * 0.9;
        if (dist < 48) {
          this.vel.x = -nx * this.chaseSpeed * 0.6;
          this.vel.y = -Math.sign(ny) * Math.abs(this.chaseSpeed) * 0.2;
        }
      }
    } else if (this.state === 'jumper') {
      this.vel.x = 0;
      this.jumpTimer -= dt;
      if (this.jumpTimer <= 0) {
        this.jumpTimer = 0.8 + Math.random() * 1.2;
        this.vel.y = -420;
      }
    } else if (this.state === 'roamer') {
      // move toward roam target and occasionally pick a new one
      // roam in 2D: ensure roam target has x/y
      if (!this._roamTargetX || !this._roamTargetY) {
        this._roamTargetX = this.startX + (Math.random() * 2 - 1) * this.patrolRange;
        this._roamTargetY = this.pos.y + (Math.random() * 2 - 1) * (this.patrolRange * 0.6);
      }
      const tx = this._roamTargetX;
      const ty = this._roamTargetY;
      const rvx = tx - (this.pos.x + this.w / 2);
      const rvy = ty - (this.pos.y + this.h / 2);
      const rmag = Math.hypot(rvx, rvy) || 1;
      this.vel.x = (rvx / rmag) * Math.abs(this.baseSpeed);
      this.vel.y = (rvy / rmag) * Math.abs(this.baseSpeed);
      if (Math.hypot(rvx, rvy) < 12) {
        this._roamTargetX = this.startX + (Math.random() * 2 - 1) * this.patrolRange;
        this._roamTargetY = this.pos.y + (Math.random() * 2 - 1) * (this.patrolRange * 0.6);
      }
    } else if (this.state === 'floater') {
      // gentle horizontal patrol and vertical bob
      this.vel.x = Math.sin(performance.now() / 600 + (this._floatPhase || 0)) * (this.baseSpeed * 0.8);
      // set vertical position around a loose baseline
      this.pos.y += Math.sin((performance.now() / 400) + (this._floatPhase || 0)) * (this._floatAmp || 24) * dt;
    } else {
      // patrol behavior (legacy): gentle horizontal motion when nothing else
      if (this.turnTimer <= 0) {
        this.vel.x = this.baseSpeed * (this.vel.x >= 0 ? 1 : -1);
      } else {
        this.turnTimer = Math.max(0, this.turnTimer - dt);
      }
    }

    // vertical following for free movers (chaser/roamer/floater/tadpole)
    if (this.freeMove && player) {
      const py = player.pos.y + player.h / 2;
      const my = this.pos.y + this.h / 2;
      const dy = py - my;
      const vyTarget = Math.max(-260, Math.min(260, dy * 0.6));
      this.vel.y += (vyTarget - this.vel.y) * Math.min(1, 6 * dt);
      // Apply vertical movement for non-tadpole free movers
      if (this.type !== 'tadpole') {
        this.pos.y += this.vel.y * dt;
      }
    }

    // wall-ahead check (look slightly ahead of current position)
    const lookDir = this.vel.x === 0 ? (dx < 0 ? -1 : 1) : (this.vel.x < 0 ? -1 : 1);
    let obstacleAhead = null;
    if (game.walls && game.walls.length) {
      const aheadRect = {
        x: this.pos.x + (lookDir > 0 ? this.w + 1 : -6),
        y: this.pos.y,
        w: 6,
        h: this.h
      };
      for (const wall of game.walls) {
        if (rectsIntersect(aheadRect, wall)) {
          obstacleAhead = wall;
          break;
        }
      }
    }

    // if chasing and obstacle ahead while on ground, attempt to jump over it (if capable)
    if (obstacleAhead && this.pos.y >= game.height - (game.currentLevel ? game.currentLevel.groundY : 60) - this.h - 1) {
      const wallHeight = obstacleAhead.h || 0;
      // simple heuristic: chaser/jumper try to jump small walls; walker will reverse
      if ((this.type === 'chaser' || this.type === 'jumper') && wallHeight < 200) {
        this.vel.y = -420;
        // keep horizontal momentum towards the player
        this.vel.x = lookDir * (this.type === 'chaser' ? this.chaseSpeed : Math.abs(this.baseSpeed) || 120);
      } else if (this.type === 'walker') {
        // reverse direction proactively
        this.vel.x = -this.vel.x;
        this.baseSpeed = -this.baseSpeed;
      }
    }

    // integrate horizontal
  const prevX = this.pos.x;
  const prevY = this.pos.y;
  
  // Normal horizontal movement for all enemies including tadpole
  this.pos.x += this.vel.x * dt;

    // gravity / ground for non-free movers
    if (!this.freeMove) {
      const groundOffset = game.currentLevel && typeof game.currentLevel.groundY === 'number' ? game.currentLevel.groundY : 60;
      const groundY = game.height - groundOffset - this.h;
      if (this.pos.y < groundY) {
        this.vel.y += 1400 * dt;
        this.pos.y += this.vel.y * dt;
        if (this.pos.y > groundY) {
          this.pos.y = groundY;
          this.vel.y = 0;
        }
      }
    }
    
    // Normal vertical movement for tadpole (freeMove)
    if (this.type === 'tadpole') {
      this.pos.y += this.vel.y * dt;
    }

    // compute enemy bounds for collision checks
    const eLeft = this.pos.x;
    const eRight = this.pos.x + this.w;
    const eTop = this.pos.y;
    const eBottom = this.pos.y + this.h;

    // enemy-wall collision: collision with any solid `wall` kills the enemy.
    // For tadpole: collision with ANY object (wall, platform, oneway, slope) kills it
    if (game.objects && game.objects.length) {
      for (const obj of game.objects) {
        if (obj.type === 'slope') {
          // Special handling for slope: only collide if enemy touches the slope surface
          // Compute slope surface y at enemy's center x
          const eCenterX = this.pos.x + this.w / 2;
          const localX = Math.max(0, Math.min(obj.w, eCenterX - obj.x));
          const t = localX / obj.w;
          const hAtX = obj.dir === 'right' ? (t * obj.h) : ((1 - t) * obj.h);
          const slopeTop = obj.y + (obj.h - hAtX);
          
          // Check if enemy is horizontally overlapping with slope
          if (eRight > obj.x && eLeft < obj.x + obj.w) {
            // Only collide if enemy's bottom touches or is below the slope surface
            // Allow some tolerance for enemies landing on slope
            // Make sure enemy is NOT above the slope surface
            const isAboveSlope = eBottom < slopeTop - 5; // Enemy is clearly above slope
            if (!isAboveSlope && eBottom >= slopeTop - 2 && eTop <= slopeTop + 5) {
              // Enemy touched slope surface -> die
              this.alive = false;
              if (game && game.spawnParticles) game.spawnParticles(this.pos.x + this.w / 2, this.pos.y + this.h / 2, '#ffcc66', 10);
              return;
            }
          }
          // Skip slope for regular collision check
          continue;
        }
        
        if (this.type === 'tadpole') {
          // Tadpole dies on contact with any object (except slope, handled above)
          if (eRight > obj.x && eLeft < obj.x + obj.w && eBottom > obj.y && eTop < obj.y + obj.h) {
            // collided with any object -> die
            this.alive = false;
            if (game && game.spawnParticles) game.spawnParticles(this.pos.x + this.w / 2, this.pos.y + this.h / 2, '#ffcc66', 10);
            return;
          }
        } else {
          // Other enemies: die on walls, platforms (slope handled separately above)
          if (eRight > obj.x && eLeft < obj.x + obj.w && eBottom > obj.y && eTop < obj.y + obj.h) {
            // collided with any solid object -> die
            this.alive = false;
            if (game && game.spawnParticles) game.spawnParticles(this.pos.x + this.w / 2, this.pos.y + this.h / 2, '#ffcc66', 10);
            return;
          }
        }
      }
    }

    // prevent passing upward through horizontal platforms (block from below)
    if (game.objects && game.objects.length) {
      for (const obj of game.objects) {
        if (obj.type !== 'platform' && obj.type !== 'oneway') continue;
        const platformTop = obj.y;
        const platformBottom = obj.y + (obj.h || 8);
        const prevTop = prevY;
        const curTop = this.pos.y;
        // horizontal overlap check
        if (eRight > obj.x + 2 && eLeft < obj.x + obj.w - 2) {
          // if enemy was below and moved up into the platform from underneath, block it
          if (prevTop >= platformBottom && curTop <= platformBottom) {
            this.pos.y = platformBottom;
            this.vel.y = 0;
          }
        }
      }
    }

    // unstick logic (still helpful for non-wall overlaps)
    // detect if overlapping with any solid object and nearly still, then try to escape
    if (game.objects && game.objects.length) {
      let overlappingSolid = false;
      for (const obj of game.objects) {
        if (eRight > obj.x && eLeft < obj.x + obj.w && eBottom > obj.y && eTop < obj.y + obj.h) {
          overlappingSolid = true;
          break;
        }
      }
      const nearlyStill = Math.abs(this.vel.x) < 10 && Math.abs(this.vel.y) < 80;
      if (overlappingSolid && nearlyStill) this.stuckTimer += dt; else this.stuckTimer = 0;
      if (this.stuckTimer > this.stuckThreshold) {
        // attempt escape
        if (this.type === 'chaser' || this.type === 'jumper') {
          this.vel.y = -420;
          if (player) {
            const dirToPlayer = (player.pos.x + player.w / 2) < (this.pos.x + this.w / 2) ? -1 : 1;
            this.vel.x = dirToPlayer * (this.type === 'chaser' ? this.chaseSpeed : Math.abs(this.baseSpeed) || 120);
          }
        } else {
          this.vel.x = -this.vel.x || -this.baseSpeed || 60;
          this.baseSpeed = -this.baseSpeed;
          this.pos.x += (this.vel.x > 0 ? 4 : -4);
        }
        this.pos.y -= 2;
        this.vel.y = Math.min(this.vel.y, -120);
        this.stuckTimer = 0;
      }
    }

    // lifetime increment & auto-death (only for tadpole)
    if (this.type === 'tadpole') {
      this.lifeTimer += dt;
      if (this.lifeTimer >= this.lifeLimit) {
        this.alive = false;
        if (game && game.spawnParticles) game.spawnParticles(this.pos.x + this.w / 2, this.pos.y + this.h / 2, '#ff6666', 12);
        return;
      }
    }
  }

  draw(ctx) {
    ctx.save();
    
    const cx = this.pos.x + this.w / 2;
    const cy = this.pos.y + this.h / 2;
    
    // Pulse effect
    const pulse = 1 + Math.sin(performance.now() / 150) * 0.05;
    ctx.translate(cx, cy);
    ctx.scale(pulse, pulse);
    
    // color by type
    if (this.type === 'tadpole') {
      ctx.fillStyle = '#4fc3f7'; // Softer blue
      // Rotate towards velocity
      const angle = Math.atan2(this.vel.y, this.vel.x);
      ctx.rotate(angle);
      
      // Head
      ctx.beginPath();
      ctx.arc(0, 0, this.w/2, 0, Math.PI*2);
      ctx.fill();
      
      // Cute Eyes (White sclera + dark pupil)
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(this.w/4, -this.h/4, this.w/5, 0, Math.PI*2);
      ctx.arc(this.w/4, this.h/4, this.w/5, 0, Math.PI*2);
      ctx.fill();
      
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(this.w/4 + 1, -this.h/4, this.w/10, 0, Math.PI*2);
      ctx.arc(this.w/4 + 1, this.h/4, this.w/10, 0, Math.PI*2);
      ctx.fill();
      
      // Tail
      ctx.strokeStyle = '#4fc3f7';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-this.w/2, 0);
      // Wiggle tail
      const wiggle = Math.sin(performance.now() / 50) * 5;
      ctx.quadraticCurveTo(-this.w, wiggle, -this.w * 1.8, 0);
      ctx.stroke();
      
    } else if (this.type === 'chaser') {
      // Triangle pointing at player
      ctx.fillStyle = '#ffab91'; // Softer orange
      // Rotate towards velocity if moving fast enough, else up
      const angle = (Math.abs(this.vel.x) > 10 || Math.abs(this.vel.y) > 10) 
        ? Math.atan2(this.vel.y, this.vel.x) 
        : -Math.PI/2;
      ctx.rotate(angle);
      
      // Rounded Triangle
      ctx.beginPath();
      const r = 4;
      ctx.moveTo(this.w/2 - r, 0);
      ctx.arcTo(this.w/2, 0, -this.w/2, -this.h/2, r);
      ctx.arcTo(-this.w/2, -this.h/2, -this.w/2, this.h/2, r);
      ctx.arcTo(-this.w/2, this.h/2, this.w/2, 0, r);
      ctx.closePath();
      ctx.fill();
      
      // Big Single Eye (Cyclops cute)
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(0, 0, this.w/3.5, 0, Math.PI*2);
      ctx.fill();
      
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(2, 0, this.w/7, 0, Math.PI*2);
      ctx.fill();
      
    } else if (this.type === 'jumper') {
      // Circle
      ctx.fillStyle = '#ffe082'; // Softer yellow
      ctx.beginPath();
      ctx.arc(0, 0, this.w/2, 0, Math.PI*2);
      ctx.fill();
      
      // Wide set eyes
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(-this.w/4, -this.h/6, this.w/8, 0, Math.PI*2);
      ctx.arc(this.w/4, -this.h/6, this.w/8, 0, Math.PI*2);
      ctx.fill();
      
      // Blush
      ctx.fillStyle = 'rgba(255, 100, 100, 0.2)';
      ctx.beginPath();
      ctx.arc(-this.w/3, 0, this.w/6, 0, Math.PI*2);
      ctx.arc(this.w/3, 0, this.w/6, 0, Math.PI*2);
      ctx.fill();
      
    } else if (this.type === 'roamer') {
      // Diamond
      ctx.fillStyle = '#b39ddb'; // Softer purple
      ctx.beginPath();
      const r = 4;
      ctx.moveTo(0, -this.h/2);
      ctx.lineTo(this.w/2, 0);
      ctx.lineTo(0, this.h/2);
      ctx.lineTo(-this.w/2, 0);
      ctx.closePath();
      // Round joins would be nice but simple path is ok for now
      ctx.fill();
      
      // Sleepy eyes (lines)
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-this.w/4, -this.h/6);
      ctx.lineTo(-this.w/8, -this.h/6);
      ctx.moveTo(this.w/8, -this.h/6);
      ctx.lineTo(this.w/4, -this.h/6);
      ctx.stroke();

    } else if (this.type === 'floater') {
      // Hexagon
      ctx.fillStyle = '#81c784'; // Softer green
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        const x = Math.cos(angle) * this.w/2;
        const y = Math.sin(angle) * this.h/2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      
      // Happy face
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(-this.w/4, -this.h/6, this.w/10, 0, Math.PI*2);
      ctx.arc(this.w/4, -this.h/6, this.w/10, 0, Math.PI*2);
      ctx.fill();
      
      // Smile
      ctx.beginPath();
      ctx.arc(0, 0, this.w/4, 0.2, Math.PI - 0.2);
      ctx.stroke();

    } else {
      // Walker (Default) - Rounded Square
      ctx.fillStyle = '#ef5350'; // Softer red
      const r = 8; // More rounded
      ctx.beginPath();
      ctx.roundRect(-this.w/2, -this.h/2, this.w, this.h, r);
      ctx.fill();
      
      // Eyes
      ctx.fillStyle = 'white';
      const look = Math.sign(this.vel.x) || 1;
      const off = look * 3;
      
      ctx.beginPath();
      ctx.arc(-this.w/4 + off, -this.h/6, this.w/6, 0, Math.PI*2);
      ctx.arc(this.w/4 + off, -this.h/6, this.w/6, 0, Math.PI*2);
      ctx.fill();
      
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(-this.w/4 + off + look, -this.h/6, this.w/12, 0, Math.PI*2);
      ctx.arc(this.w/4 + off + look, -this.h/6, this.w/12, 0, Math.PI*2);
      ctx.fill();
    }
    
    ctx.restore();
  }
}
