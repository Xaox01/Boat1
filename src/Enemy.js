import Phaser from 'phaser';

// Detection states
export const STATE = { PATROL: 0, ALERT: 1, HUNT: 2, SEARCH: 3 };

const BASE_HYDROPHONE   = 540;   // px detection range at full noiseEffective
const THERMO_MASK       = 0.50;  // thermocline cuts range by 50% from above
const ALERT_THRESHOLD   = 1.8;   // seconds before ALERT
const HUNT_THRESHOLD    = 5.0;   // seconds before HUNT (confirmed contact)
const SEARCH_DURATION   = 18;    // seconds searching before returning to PATROL
const CHARGE_COOLDOWN   = 5.2;   // seconds between depth charge drops
const CHARGE_FALL_SPD   = 88;    // px/s fall speed
const CHARGE_BLAST_R    = 85;    // px blast radius

export class Enemy {
  constructor(scene, x, patrolLeft, patrolRight, label) {
    this.scene = scene;
    this.gfx   = scene.add.graphics();

    this.x = x;
    this.y = scene.SURFACE_Y;
    this.label = label || '';

    this.patrolLeft  = patrolLeft;
    this.patrolRight = patrolRight;
    this.patrolSpeed = 38 + Math.random() * 18;
    this.dir         = Math.random() < 0.5 ? 1 : -1;

    this.state        = STATE.PATROL;
    this.detectTimer  = 0;
    this.searchTimer  = 0;
    this.detectionLevel = 0;   // 0–1, drives sonar display

    this.lastBearingToSub = 0;
    this.lastKnownSubX    = x;

    this.charges  = [];
    this.chargeCD = 0;

    // Reported to GameScene for screen shake / flash
    this.recentExplosions = [];
  }

  update(dt, sub) {
    this._updateDetection(dt, sub);
    this._updateMovement(dt, sub);
    this._updateCharges(dt, sub);
    this._draw(sub);
    this.recentExplosions = [];  // GameScene consumed them
  }

  // ── Detection ──────────────────────────────────────────────────────────────

  _updateDetection(dt, sub) {
    const WORLD_W = this.scene.WORLD_W;

    // Shortest horizontal distance accounting for world wrap
    let dx = sub.x - this.x;
    if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
    const dy   = sub.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Hydrophone range scales with effective noise
    let range = BASE_HYDROPHONE * sub.noiseEffective;

    // Thermocline: ship above, sub below → range halved
    if (sub.belowThermocline) range *= THERMO_MASK;

    const hearing = dist < range;

    if (hearing) {
      this.detectTimer = Math.min(this.detectTimer + dt, HUNT_THRESHOLD + 1);
      this.lastBearingToSub = Math.atan2(dy, dx);
      this.lastKnownSubX    = sub.x;
    } else {
      // Contact decays, but memory fades slower from HUNT
      const decayRate = this.state === STATE.HUNT ? 0.25 : 0.55;
      this.detectTimer = Math.max(0, this.detectTimer - decayRate * dt);
    }

    this.detectionLevel = Phaser.Math.Clamp(this.detectTimer / HUNT_THRESHOLD, 0, 1);

    const prevState = this.state;

    if      (this.detectTimer >= HUNT_THRESHOLD)  this.state = STATE.HUNT;
    else if (this.detectTimer >= ALERT_THRESHOLD) this.state = STATE.ALERT;
    else if (this.detectTimer >  0)               this.state = STATE.ALERT;
    else if (this.searchTimer >  0) {
      this.state = STATE.SEARCH;
      this.searchTimer -= dt;
    } else {
      this.state = STATE.PATROL;
    }

    // Losing HUNT → enter SEARCH
    if (prevState === STATE.HUNT && this.state !== STATE.HUNT) {
      this.searchTimer = SEARCH_DURATION;
    }
  }

  // ── Movement ───────────────────────────────────────────────────────────────

  _updateMovement(dt, sub) {
    switch (this.state) {
      case STATE.PATROL: {
        this.x += this.dir * this.patrolSpeed * dt;
        if (this.x > this.patrolRight) { this.x = this.patrolRight; this.dir = -1; }
        if (this.x < this.patrolLeft)  { this.x = this.patrolLeft;  this.dir =  1; }
        break;
      }
      case STATE.ALERT: {
        // Slow, drift toward bearing
        this.x += this.dir * this.patrolSpeed * 0.45 * dt;
        const tx = this.x + Math.cos(this.lastBearingToSub) * 300;
        if (Math.abs(tx - this.x) > 20) this.dir = Math.sign(tx - this.x);
        break;
      }
      case STATE.HUNT: {
        // Move toward last known sub position quickly
        const dx = this.lastKnownSubX - this.x;
        if (Math.abs(dx) > 15) this.dir = Math.sign(dx);
        this.x += this.dir * this.patrolSpeed * 1.5 * dt;
        break;
      }
      case STATE.SEARCH: {
        // Wide sweep around last known area
        const frac  = this.searchTimer / SEARCH_DURATION;
        const swing = 350 * frac;
        const left  = this.lastKnownSubX - swing;
        const right = this.lastKnownSubX + swing;
        this.x += this.dir * this.patrolSpeed * 0.7 * dt;
        if (this.x > right) this.dir = -1;
        if (this.x < left)  this.dir =  1;
        break;
      }
    }

    this.x = Phaser.Math.Clamp(this.x, 0, this.scene.WORLD_W);
  }

  // ── Depth charges ──────────────────────────────────────────────────────────

  _updateCharges(dt, sub) {
    this.chargeCD = Math.max(0, this.chargeCD - dt);

    // Drop when HUNT and roughly over sub
    if (this.state === STATE.HUNT) {
      const WORLD_W = this.scene.WORLD_W;
      let dx = sub.x - this.x;
      if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
      if (Math.abs(dx) < 110 && this.chargeCD <= 0) {
        this._drop(sub);
        this.chargeCD = CHARGE_COOLDOWN;
      }
    }

    for (const c of this.charges) {
      if (c.exploded) {
        c.explodeTimer -= dt;
        continue;
      }
      c.y += c.speed * dt;

      if (c.y >= c.targetY) {
        c.exploded     = true;
        c.explodeTimer = 0.5;

        // Damage sub
        const WORLD_W = this.scene.WORLD_W;
        let dx = sub.x - c.x;
        if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
        const dy   = sub.y - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CHARGE_BLAST_R) {
          const ratio = 1 - dist / CHARGE_BLAST_R;
          sub.hull -= Phaser.Math.Clamp(ratio * 0.38, 0.04, 0.38);
        }

        this.recentExplosions.push({ x: c.x, y: c.y, dist });
      }
    }

    this.charges = this.charges.filter(c => !c.exploded || c.explodeTimer > 0);
  }

  _drop(sub) {
    this.charges.push({
      x:         this.x,
      y:         this.scene.SURFACE_Y + 12,
      targetY:   sub.y + Phaser.Math.Between(-35, 35),
      speed:     CHARGE_FALL_SPD + Math.random() * 30,
      exploded:  false,
      explodeTimer: 0,
    });
  }

  // ── Contact info for Sonar ─────────────────────────────────────────────────

  getContactInfo(sub) {
    const WORLD_W = this.scene.WORLD_W;
    let dx = this.x - sub.x;
    if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
    const dy   = this.y - sub.y;
    return {
      bearing:        Math.atan2(dy, dx),
      distance:       Math.sqrt(dx * dx + dy * dy),
      state:          this.state,
      detectionLevel: this.detectionLevel,
    };
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _draw(sub) {
    const g = this.gfx;
    g.clear();

    const SURF = this.scene.SURFACE_Y;

    // Colour by state
    const col = this.state === STATE.HUNT   ? 0xff3300
              : this.state === STATE.ALERT  ? 0xffbb00
              : this.state === STATE.SEARCH ? 0xcc8800
                                            : 0x3a7a6a;

    // Hydrophone detection ring (faint, shows coverage)
    if (this.detectionLevel > 0) {
      const ringR = BASE_HYDROPHONE * this.detectionLevel * 0.55;
      g.fillStyle(col, 0.04 + this.detectionLevel * 0.06);
      g.fillCircle(this.x, SURF, ringR);
      g.lineStyle(1, col, 0.12 + this.detectionLevel * 0.3);
      g.strokeCircle(this.x, SURF, ringR);
    }

    // Ship hull
    g.fillStyle(col, 0.92);
    g.fillRect(this.x - 26, SURF - 8, 52, 8);

    // Bridge / superstructure
    g.fillStyle(col, 1);
    g.fillRect(this.x - 4, SURF - 16, 16, 8);
    // Mast
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(this.x + 3, SURF - 22, 2, 6);

    // Bow direction indicator
    g.fillStyle(0xffffff, 0.35);
    g.fillTriangle(
      this.x + this.dir * 26, SURF - 4,
      this.x + this.dir * 18, SURF - 8,
      this.x + this.dir * 18, SURF
    );

    // Depth charges
    for (const c of this.charges) {
      if (c.exploded) {
        const frac = c.explodeTimer / 0.5;
        const r    = (1 - frac) * CHARGE_BLAST_R * 1.8;
        g.lineStyle(2, 0xff8800, frac * 0.9);
        g.strokeCircle(c.x, c.y, r);
        g.fillStyle(0xff4400, frac * 0.5);
        g.fillCircle(c.x, c.y, r * 0.35);
      } else {
        g.fillStyle(0xffcc44, 0.9);
        g.fillEllipse(c.x, c.y, 10, 14);
        // Trail
        g.fillStyle(0xffffff, 0.2);
        g.fillCircle(c.x, c.y - 8, 3);
      }
    }
  }
}
