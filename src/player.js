import { clamp } from './utils.js';
import { input } from './input.js';

export class Player {
  constructor(x, y, keyMap = null) {
    this.pos = { x, y };
    this.w = 34;
    this.h = 34;
    this.vel = { x: 0, y: 0 };
    this.speed = 380; // px/s (increased for faster feel)
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
    // lives are managed by Game class now (shared)
    this.invulnerable = false;
    this.invulTimer = 0;
    this.invulDuration = 1.0; // seconds
    // optional gamepad index for this player (null => keyboard)
    this.gamepadIndex = null;
    // custom key mapping for 2P mode
    this.keyMap = keyMap;
    // color for drawing (default white)
    this.color = '#ffffff';
    // previous gamepad button state for edge detection
    this._prevGpJump = false;
  this._prevOnWall = false;
    // dash mechanics
    this.isDashing = false;
    this.dashSpeed = 720; // px/s
    this.dashDuration = 0.14; // seconds
    this.dashTimer = 0;
    this.dashCooldown = 0.45; // seconds between dashes
    this.dashCdTimer = 0;
    this._prevDashKey = false;

    // visual squash/stretch and trail
    this.scaleX = 1;
    this.scaleY = 1;
    this.squashTimer = 0;
    this.trailTimer = 0;

    // CPU Control for Menu/Attract Mode
    this.isCpu = false;
    this.cpuInput = { left: false, right: false, jump: false, up: false, dash: false };

  // motion trail (store recent positions for a fading trail)
  this._trail = [];
  this._trailMax = 16; // number of samples
  this._trailAcc = 0;

  // wall-climb / wall-slide
  this.onWall = false;
  this.wallDir = 0; // -1 left, 1 right
  this.wallSlideSpeed = 220; // max falling speed when sliding on wall
  this.wallClimbSpeed = 140; // vertical speed when climbing up
  this.wallStickTimer = 0;
  this.wallStickDuration = 0.12; // short stick to allow wall-jump timing
  }

  getBounds() {
    return { x: this.pos.x, y: this.pos.y, w: this.w, h: this.h };
  }

  update(dt, game) {
    // input: keyboard or gamepad
    let left = false;
    let right = false;
    let jumpPressed = false;
    let upHeld = false;

    if (this.isCpu) {
      left = this.cpuInput.left;
      right = this.cpuInput.right;
      jumpPressed = this.cpuInput.jump;
      upHeld = this.cpuInput.up;
    } else if (this.gamepadIndex !== null) {
      const gps = navigator.getGamepads && navigator.getGamepads();
      const gp = gps ? gps[this.gamepadIndex] : null;
      if (gp) {
        const ax = gp.axes[0] || 0;
        left = ax < -0.3;
        right = ax > 0.3;
        // edge-trigger jump detection: trigger when button goes from false->true
        const curJump = !!(gp.buttons[0] && gp.buttons[0].pressed);
        if (curJump && !this._prevGpJump) {
          // treat as a jump press (buffered)
          jumpPressed = true;
        }
        this._prevGpJump = curJump;
        const ay = gp.axes[1] || 0;
        upHeld = ay < -0.5;
      }
    } else if (this.keyMap) {
      // Custom key controls (for 2P mode)
      left = this.input.isDown(...this.keyMap.left);
      right = this.input.isDown(...this.keyMap.right);
      jumpPressed = this.input.isDown(...this.keyMap.jump);
      upHeld = this.input.isDown(...this.keyMap.up);
    } else {
      // Default controls (Single Player)
      // Use physical keys (Codes) only to avoid sticky keys when modifiers (Shift) change
      left = this.input.isDown('ArrowLeft', 'KeyA');
      right = this.input.isDown('ArrowRight', 'KeyD');
      jumpPressed = this.input.isDown('Space', 'KeyW', 'ArrowUp');
      upHeld = this.input.isDown('ArrowUp', 'KeyW');
    }

    // Check if player is in safe haven (docking/hovering)
    let inSafeHaven = false;
    if (game.currentLevel && game.currentLevel.safeHaven) {
      const haven = game.currentLevel.safeHaven;
      const playerBounds = this.getBounds();
      inSafeHaven = 
        playerBounds.x < haven.x + haven.w &&
        playerBounds.x + playerBounds.w > haven.x &&
        playerBounds.y < haven.y + haven.h &&
        playerBounds.y + playerBounds.h > haven.y;
    }
    
    // Store inSafeHaven state for gravity check
    this.inSafeHaven = inSafeHaven;

    // --- DASH MECHANIC ---
    // Update dash timers
    if (this.dashCdTimer > 0) this.dashCdTimer -= dt;
    if (this.isDashing) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.vel.x = 0; // Stop dash momentum
        this.vel.y = 0;
      } else {
        // Continue dash movement (ignore other inputs)
        // Dash direction is determined at start of dash
        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;
        
        // Boundary checks during dash
        // Respect the 12px frame walls
        const border = 12;
        const groundHeight = (game.currentLevel && game.currentLevel.groundY) || 60;
        const maxY = game.height - groundHeight - this.h;
        
        // Clamp X
        if (this.pos.x < border) {
          this.pos.x = border;
          this.vel.x = 0;
        } else if (this.pos.x > game.width - border - this.w) {
          this.pos.x = game.width - border - this.w;
          this.vel.x = 0;
        }
        
        // Clamp Y (Top and Bottom)
        if (this.pos.y < border) {
          this.pos.y = border;
          this.vel.y = 0;
        } else if (this.pos.y > maxY) {
          this.pos.y = maxY;
          this.vel.y = 0;
        }
        
        // Spawn dash particles
        if (game && game.spawnParticles && Math.random() < 0.5) {
           game.spawnParticles(this.pos.x + this.w/2, this.pos.y + this.h/2, this.color, 2);
        }
        
        // Update input state to prevent sticky keys/re-triggers
        // We need to check dash input here because we return early
        let dPressed = false;
        if (this.isCpu) dPressed = this.cpuInput.dash;
        else if (this.gamepadIndex !== null) {
           const gps = navigator.getGamepads && navigator.getGamepads();
           const gp = gps ? gps[this.gamepadIndex] : null;
           if (gp && gp.buttons[2] && gp.buttons[2].pressed) dPressed = true;
        } else if (this.keyMap) {
           dPressed = this.input.isDown(...this.keyMap.dash || []);
        } else {
           dPressed = this.input.isDown('ShiftLeft', 'ShiftRight', 'KeyK');
        }
        this._prevDashKey = dPressed;

        // Skip rest of update (gravity, normal movement)
        return;
      }
    }

    // Check for dash input
    // Default dash keys: Shift, K, Slash (for P2)
    let dashPressed = false;
    if (this.isCpu) {
      dashPressed = this.cpuInput.dash;
    } else if (this.gamepadIndex !== null) {
       const gps = navigator.getGamepads && navigator.getGamepads();
       const gp = gps ? gps[this.gamepadIndex] : null;
       if (gp && gp.buttons[2] && gp.buttons[2].pressed) dashPressed = true; // Button X/Square
    } else if (this.keyMap) {
       dashPressed = this.input.isDown(...this.keyMap.dash || []);
    } else {
       dashPressed = this.input.isDown('ShiftLeft', 'ShiftRight', 'KeyK');
    }

    // Trigger dash
    if (dashPressed && !this._prevDashKey && !this.isDashing && this.dashCdTimer <= 0) {
      // Determine dash direction based on current input or facing
      let dx = 0;
      let dy = 0;
      
      if (left) dx = -1;
      else if (right) dx = 1;
      
      if (upHeld) dy = -1;
      else if (this.input.isDown('ArrowDown', 'KeyS')) dy = 1;
      
      // If no direction pressed, dash in facing direction (default right)
      if (dx === 0 && dy === 0) {
         dx = this.lastDir || 1; 
      }
      
      // Normalize
      const len = Math.hypot(dx, dy);
      if (len > 0) {
        dx /= len;
        dy /= len;
      }
      
      this.isDashing = true;
      this.dashTimer = this.dashDuration;
      this.dashCdTimer = this.dashCooldown;
      this.vel.x = dx * this.dashSpeed;
      this.vel.y = dy * this.dashSpeed;
      
      if (game && game.audio) game.audio.playSfx('dash');
      
      // Initial burst
      if (game && game.spawnParticles) {
         game.spawnParticles(this.pos.x + this.w/2, this.pos.y + this.h/2, '#fff', 6);
      }
      
      // Update prevDashKey to prevent immediate re-trigger
      // We need to check dash input here because we return early
      let dPressed = false;
      if (this.isCpu) dPressed = this.cpuInput.dash;
      else if (this.gamepadIndex !== null) {
         const gps = navigator.getGamepads && navigator.getGamepads();
         const gp = gps ? gps[this.gamepadIndex] : null;
         if (gp && gp.buttons[2] && gp.buttons[2].pressed) dPressed = true;
      } else if (this.keyMap) {
         dPressed = this.input.isDown(...this.keyMap.dash || []);
      } else {
         dPressed = this.input.isDown('ShiftLeft', 'ShiftRight', 'KeyK');
      }
      this._prevDashKey = dPressed;

      return; // Skip rest of frame
    }
    this._prevDashKey = dashPressed;
    
    // Store last horizontal direction for dash
    if (left) this.lastDir = -1;
    else if (right) this.lastDir = 1;

    // Apply docking effect: reduce speed when in safe haven, but allow free movement
    const effectiveSpeed = inSafeHaven ? this.speed * 0.6 : this.speed; // 60% speed when docked
    
    // Reset velocity if no input (fix for stuck movement after dash)
    if (!left && !right) {
        this.vel.x = 0;
    } else if (left) {
        this.vel.x = -effectiveSpeed;
    } else if (right) {
        this.vel.x = effectiveSpeed;
    }
    
    // Vertical movement in safe haven (hovering)
    if (inSafeHaven) {
      if (upHeld) {
        this.vel.y = -this.speed * 0.6; // Move up
      } else if (this.input && this.input.isDown && this.input.isDown('ArrowDown', 'KeyS', 's', 'S')) {
        this.vel.y = this.speed * 0.6; // Move down
      } else {
        // Float in place (reduce vertical velocity)
        this.vel.y *= 0.9;
      }
    }

    // jump buffering & coyote time
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

    // gravity (skip if in safe haven - hovering)
    if (!inSafeHaven) {
      // advanced gravity: stronger when falling for snappier platforming
      const GRAVITY = 1400;
      const FALL_MULT = 1.6;
      if (this.vel.y > 0) this.vel.y += GRAVITY * FALL_MULT * dt;
      else this.vel.y += GRAVITY * dt;

      // terminal velocity
      const TERM = 1200;
      if (this.vel.y > TERM) this.vel.y = TERM;
    }

  // integrate (store previous for collision resolution)
  const prev = { x: this.pos.x, y: this.pos.y };
  this.pos.x += this.vel.x * dt;
  this.pos.y += this.vel.y * dt;

    // simple ground collision
    const groundY = game.height - 60 - this.h;
    if (this.pos.y >= groundY) {
      this.pos.y = groundY;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // Solid object collision resolution & platform/one-way/slope handling
    if (game.objects && game.objects.length) {
      const px = this.pos.x, py = this.pos.y, pw = this.w, ph = this.h;
      const prevBottom = prev.y + ph;
      const curBottom = py + ph;
      for (const obj of game.objects) {
        const ox = obj.x, ow = obj.w, oy = obj.y, oh = obj.h;
        const objLeft = ox, objRight = ox + ow;

        if (obj.type === 'slope') {
          // compute slope surface y at player's center x
          const cx = this.pos.x + pw / 2;
          const localX = Math.max(0, Math.min(obj.w, cx - obj.x));
          const t = localX / obj.w;
          const hAtX = obj.dir === 'right' ? (t * obj.h) : ((1 - t) * obj.h);
          const slopeTop = obj.y + (obj.h - hAtX);
          const objTop = oy, objBottom = oy + oh;
          
          // Check if player is on slope surface (from above)
          let onSlopeSurface = false;
          // Check if player is horizontally overlapping with slope
          if (this.pos.x + pw > objLeft && this.pos.x < objRight) {
            const foot = this.pos.y + ph;
            // Check if player is landing on slope surface
            // More lenient: if player was above and now is at or below surface
            if (prevBottom <= slopeTop + 5 && foot >= slopeTop - 5) {
              // Land on slope surface
              this.pos.y = slopeTop - ph;
              this.vel.y = 0;
              this.onGround = true;
              onSlopeSurface = true;
            } else if (foot >= slopeTop - 8 && foot <= slopeTop + 8 && this.vel.y >= 0) {
              // Player is already on slope surface (within tolerance)
              // Also snap to surface if close enough
              if (Math.abs(foot - slopeTop) < 5) {
                this.pos.y = slopeTop - ph;
                this.vel.y = 0;
              }
              this.onGround = true;
              onSlopeSurface = true;
            }
          }
          
          // Check for ceiling collision (hitting bottom of slope from below)
          if (this.vel.y < 0) {
             const objBottom = obj.y + obj.h;
             // Check if player head is crossing the bottom line
             // Use a small tolerance
             if (this.pos.y < objBottom && prev.y >= objBottom - 5) {
                 // Check horizontal overlap
                 if (this.pos.x + pw > objLeft && this.pos.x < objRight) {
                     this.pos.y = objBottom;
                     this.vel.y = 0;
                 }
             }
          }
          
          // Only handle horizontal collision if player is NOT on the slope surface
          // and is actually colliding from the side (not from above or below)
          if (!onSlopeSurface) {
            const prevRight = prev.x + pw;
            const curRight = this.pos.x + pw;
            const prevLeft = prev.x;
            const curLeft = this.pos.x;
            const curTop = this.pos.y;
            const curBottom = py + ph;
            
            // Check if player is colliding from the side (not from top or bottom)
            // Make sure player is clearly NOT on slope surface and NOT above it
            const footY = curBottom;
            const isOnSlope = (footY >= slopeTop - 10 && footY <= slopeTop + 10) && 
                              (curRight > objLeft && curLeft < objRight);
            
            // Only trigger horizontal collision if:
            // 1. Player is clearly NOT on slope surface (with larger tolerance)
            // 2. Player is NOT above slope surface (preparing to land)
            // 3. Player is actually colliding from the side
            const isAboveSlope = curBottom < slopeTop - 10; // Player is above slope, preparing to land
            const isSideCollision = !isOnSlope && !isAboveSlope &&
                                    (curRight > objLeft && curLeft < objRight) && 
                                    (curBottom > objTop + 2 && curTop < objBottom - 2) &&
                                    (curBottom < slopeTop - 10 || curTop > objBottom + 2); // Clearly not on slope surface and not above
            
            if (isSideCollision) {
              // compute overlaps
              const overlapLeft = curRight - objLeft;
              const overlapRight = objRight - curLeft;
              if (overlapLeft < overlapRight) {
                // push left
                this.pos.x = objLeft - pw;
                this.vel.x = 0;
                this.onWall = true;
                this.wallDir = -1;
              } else {
                this.pos.x = objRight;
                this.vel.x = 0;
                this.onWall = true;
                this.wallDir = 1;
              }
            }
          }
          continue;
        }

        // platform / oneway: treat as solid (like wall) - handle all collisions
        if (obj.type === 'platform' || obj.type === 'oneway') {
          const top = oy;
          const bottom = oy + oh;
          const prevRight = prev.x + pw;
          const curRight = this.pos.x + pw;
          const prevLeft = prev.x;
          const curLeft = this.pos.x;
          const prevTop = prev.y;
          const curTop = this.pos.y;
          const curBottom = py + ph;
          
          // Vertical landing on top
          if (prevBottom <= top && curBottom >= top && this.pos.x + pw > objLeft + 2 && this.pos.x < objRight - 2) {
            this.pos.y = top - ph;
            this.vel.y = 0;
            this.onGround = true;
            continue; // On platform top, skip horizontal collision
          }
          
          // Ceiling / head bump: prevent passing upward through platform
          if (prevTop >= bottom && curTop <= bottom && this.pos.x + pw > objLeft + 2 && this.pos.x < objRight - 2) {
            this.pos.y = bottom;
            this.vel.y = 0;
            continue; // Hit ceiling, skip horizontal collision
          }
          
          // Horizontal collision resolution - only if NOT on top or bottom
          // Check if player is colliding from the side (not from top or bottom)
          const isSideCollision = (curRight > objLeft && curLeft < objRight) && 
                                  (curBottom > top + 2 && curTop < bottom - 2) &&
                                  (curBottom < top - 2 || curTop > bottom + 2); // Not on top or bottom
          
          if (isSideCollision) {
            // compute overlaps
            const overlapLeft = curRight - objLeft;
            const overlapRight = objRight - curLeft;
            if (overlapLeft < overlapRight) {
              // push left
              this.pos.x = objLeft - pw;
              this.vel.x = 0;
              this.onWall = true;
              this.wallDir = -1;
            } else {
              this.pos.x = objRight;
              this.vel.x = 0;
              this.onWall = true;
              this.wallDir = 1;
            }
          }
          continue;
        }

        // default: solid wall block
        if (typeof oy !== 'number' || typeof oh !== 'number') continue;
        const objTop = oy, objBottom = oy + oh;
        const prevRight = prev.x + pw;
        const curRight = this.pos.x + pw;
        const prevLeft = prev.x;
        const curLeft = this.pos.x;
        const prevTop = prev.y;
        const curTop = this.pos.y;

        // vertical landing on top
        let landedOnTop = false;
        if (prevBottom <= objTop && curBottom >= objTop && curRight > objLeft + 2 && curLeft < objRight - 2) {
          this.pos.y = objTop - ph;
          this.vel.y = 0;
          this.onGround = true;
          landedOnTop = true;
        }

        // ceiling / head bump: prevent passing upward through solid blocks
        let hitCeiling = false;
        if (prevTop >= objBottom && curTop <= objBottom && curRight > objLeft + 2 && curLeft < objRight - 2) {
          // collided from below
          this.pos.y = objBottom;
          this.vel.y = 0;
          hitCeiling = true;
        }

        // horizontal collision resolution - only if NOT on top or bottom
        // Skip horizontal collision if player just landed on top or hit ceiling
        if (!landedOnTop && !hitCeiling) {
          if (curRight > objLeft && curLeft < objRight && curBottom > objTop + 2 && this.pos.y < objBottom - 2) {
            // compute overlaps
            const overlapLeft = curRight - objLeft;
            const overlapRight = objRight - curLeft;
            if (overlapLeft < overlapRight) {
              // push left
              this.pos.x = objLeft - pw;
              this.vel.x = 0;
              this.onWall = true;
              this.wallDir = -1;
            } else {
              this.pos.x = objRight;
              this.vel.x = 0;
              this.onWall = true;
              this.wallDir = 1;
            }
          }
        }
      }
    }

  // WALL DETECTION: check level walls (if provided by game.currentLevel)
  // Note: preserve any onWall state set during object collision resolution above
  // so edge-cases where horizontal collision set onWall aren't lost.
  this.wallDir = this.wallDir || 0;
    if (!this.onGround && !this.isDashing && game.walls && game.walls.length) {
      const pb = this.getBounds();
      for (const wall of game.walls) {
        // vertical overlap check
        const wallTop = wall.y;
        const wallBottom = wall.y + wall.h;
        const playerTop = this.pos.y;
        const playerBottom = this.pos.y + this.h;
        if (playerBottom > wallTop + 6 && playerTop < wallBottom - 6) {
          const playerLeft = this.pos.x;
          const playerRight = this.pos.x + this.w;
            // touching left side of wall (allow a small horizontal tolerance and vertical tolerance
            // so the player can catch the edge and start climbing)
            const horizGapLeft = playerRight - wall.x;
            if (playerRight >= wall.x && playerLeft < wall.x && horizGapLeft < 18) {
              // also allow if player's feet are slightly above the wall top (edge grab)
              const wallTop = wall.y;
              const feetDelta = (this.pos.y + this.h) - wallTop;
              if (feetDelta >= -8) {
                this.onWall = true;
                this.wallDir = -1;
                // nudge player to stick to the wall edge but don't teleport inside
                this.pos.x = Math.min(this.pos.x, wall.x - this.w + 0.5);
                break;
              }
            }
          // touching right side of wall
          const horizGapRight = (wall.x + wall.w) - playerLeft;
          if (playerLeft <= wall.x + wall.w && playerRight > wall.x + wall.w && horizGapRight < 18) {
            const wallTop = wall.y;
            const feetDelta = (this.pos.y + this.h) - wallTop;
            if (feetDelta >= -8) {
              this.onWall = true;
              this.wallDir = 1;
              this.pos.x = Math.max(this.pos.x, wall.x + wall.w - 0.5);
              break;
            }
          }
        }
      }
    }

    // wall stick timer decay / refresh
    if (this.onWall) {
      this.wallStickTimer = Math.max(this.wallStickTimer, this.wallStickDuration);
    } else {
      this.wallStickTimer = Math.max(0, this.wallStickTimer - dt);
    }

    // if just started walling, spawn a small particle and sound
    if (this.onWall && !this._prevOnWall && game) {
      if (game.spawnParticles) game.spawnParticles(this.pos.x + (this.wallDir === -1 ? 2 : this.w - 2), this.pos.y + this.h / 2, '#88ccff', 8);
      if (game.audio) game.audio.playSfx('jump');
    }

    // behavior while on wall
    if (this.onWall) {
      // wall climb when holding up + toward the wall
      const pressingToward = (this.wallDir === -1 && left) || (this.wallDir === 1 && right);
      if (pressingToward && upHeld) {
        this.vel.y = -this.wallClimbSpeed;
      } else {
        // slow sliding down the wall
        if (this.vel.y > this.wallSlideSpeed) this.vel.y = this.wallSlideSpeed;
      }

      // wall jump: if jump buffered, jump away
      if (this.jumpBufferTimer > 0 || jumpPressed) {
        this.vel.y = this.jumpSpeed;
        // push off the wall horizontally
        this.vel.x = -this.wallDir * Math.max(this.speed * 1.2, 380);
        this.onWall = false;
        this.jumpBufferTimer = 0;
        if (game && game.audio) game.audio.playSfx('jump');
      }
    }

    // finally keep inside horizontal bounds (clamp again to be safe)
    this.pos.x = clamp(this.pos.x, 0, game.width - this.w);

    // update trail buffer: sample more when moving faster
    this._trailAcc += dt * (1 + Math.abs(this.vel.x) / this.speed * 2);
    if (this._trailAcc > 0.035) {
      this._trailAcc = 0;
      this._trail.unshift({ x: this.pos.x + this.w / 2, y: this.pos.y + this.h / 2, a: 1.0 });
      if (this._trail.length > this._trailMax) this._trail.length = this._trailMax;
    }

    // store previous wall state for transition detection
    this._prevOnWall = this.onWall;

    // invulnerability timer
    if (this.invulnerable) {
      this.invulTimer -= dt;
      if (this.invulTimer <= 0) {
        this.invulnerable = false;
        this.invulTimer = 0;
      }
    }

    // dash cooldown timer
    if (this.dashCdTimer > 0) this.dashCdTimer = Math.max(0, this.dashCdTimer - dt);

    // dash timer handling
    if (this.isDashing) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
      // spawn small trail particles while dashing
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.04;
        if (game) game.spawnParticles(this.pos.x + this.w / 2, this.pos.y + this.h / 2, this.color, 2);
      }
    }

    // squash/stretch animation
    if (this.squashTimer > 0) {
      this.squashTimer = Math.max(0, this.squashTimer - dt);
      const t = 1 - this.squashTimer / 0.12;
      // ease back to normal
      this.scaleX = 1 + 0.2 * (1 - t);
      this.scaleY = 1 - 0.15 * (1 - t);
    } else {
      // natural scale damping
      this.scaleX += (1 - this.scaleX) * Math.min(1, dt * 10);
      this.scaleY += (1 - this.scaleY) * Math.min(1, dt * 10);
    }
  }

  draw(ctx) {
    // minimal flat-hero-like square
    ctx.save();
    
    // draw motion trail
    if (this._trail && this._trail.length) {
      for (let i = 0; i < this._trail.length; i++) {
        const t = this._trail[i];
        const alpha = (1 - i / this._trail.length) * 0.45;
        ctx.fillStyle = this._trailColor || (this.color || '#ffffff');
        ctx.globalAlpha = alpha * 0.9;
        const size = (this.w * (0.9 - i / (this._trail.length * 1.8)));
        
        // Rounded trail
        const r = 4;
        ctx.beginPath();
        ctx.roundRect(t.x - size / 2, t.y - size / 2, size, size, r);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
    }
    
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(this.pos.x + this.w/2, this.pos.y + this.h + 2, this.w/2 - 2, 3, 0, 0, Math.PI*2);
    ctx.fill();

    // flash while invulnerable
    if (this.invulnerable) {
      const t = Math.floor(this.invulTimer * 20) % 2;
      ctx.globalAlpha = t ? 0.35 : 1.0;
    }
    
    ctx.translate(this.pos.x + this.w / 2, this.pos.y + this.h / 2);
    ctx.scale(this.scaleX, this.scaleY);
    
    // Main body with rounded corners (softer)
    ctx.fillStyle = this.color || '#ffffff';
    const r = 10; // More rounded
    ctx.beginPath();
    ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, r);
    ctx.fill();
    
    // Cute Face
    const lookDir = Math.sign(this.vel.x) || 1;
    const eyeOffset = lookDir * 2;
    
    // Eyes
    ctx.fillStyle = '#333';
    const eyeX = this.w * 0.22;
    const eyeY = -this.h * 0.05;
    const eyeSize = this.w * 0.12;
    
    // Left Eye
    ctx.beginPath();
    ctx.arc(-eyeX + eyeOffset, eyeY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Right Eye
    ctx.beginPath();
    ctx.arc(eyeX + eyeOffset, eyeY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Blush
    ctx.fillStyle = 'rgba(255, 100, 100, 0.2)';
    const blushX = this.w * 0.32;
    const blushY = this.h * 0.15;
    const blushSize = this.w * 0.15;
    
    ctx.beginPath();
    ctx.arc(-blushX + eyeOffset, blushY, blushSize, 0, Math.PI * 2);
    ctx.arc(blushX + eyeOffset, blushY, blushSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1.0;
    ctx.restore();
  }

  // trigger dash in a direction (-1 left, 1 right)
  tryDash(dir) {
    if (this.dashCdTimer > 0 || this.isDashing) return false;
    this.isDashing = true;
    this.dashTimer = this.dashDuration;
    this.dashCdTimer = this.dashCooldown;
    this.vel.x = dir * this.dashSpeed;
    this.vel.y = 0; // neutralize vertical velocity slightly
    this.squashTimer = 0.12; // small visual cue
    // Play dash sound
    if (game && game.audio) game.audio.playSfx('dash');
    return true;
  }

  takeHit(enemy, game) {
    if (this.invulnerable || !this.alive) return;
    
    // Shared lives managed by Game
    if (game.lives > 0) {
      game.lives--;
      this.invulnerable = true;
      this.invulTimer = this.invulDuration;
      
      // Screen shake and flash
      game.screenShake(12, 0.4);
      game.flash('#ff0000', 0.1);
      
      // Sound
      game.audio.playSfx('hit');
      
      // Particles
      game.spawnParticles(this.pos.x + this.w/2, this.pos.y + this.h/2, '#ff0000', 15);
      
      // Knockback
      const centerE = enemy.pos.x + enemy.w/2;
      const centerP = this.pos.x + this.w/2;
      const dir = centerP < centerE ? -1 : 1;
      this.vel.x = dir * 400;
      this.vel.y = -300;
    }
  }
}
