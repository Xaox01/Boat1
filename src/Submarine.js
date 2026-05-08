import Phaser from 'phaser';

const BALLAST_RATE      = 0.16;   // fraction/s at surface — slower at depth
const BALLAST_CMD_RATE  = 0.45;
const MAX_ENGINE_FORCE  = 200;
const ENGINE_RAMP       = 1.1;
const DRAG_ANGULAR      = 0.82;
const NEUTRAL_BALLAST   = 0.54;
const CRUSH_DEPTH       = 400;
const CAVITATION_SPEED  = 155;    // px/s above which propeller cavitates (~3 kn in scale)
const HOTEL_LOAD        = 0.00022; // base battery drain/s from systems alone
const SNORKEL_DEPTH_M   = 18;     // metres — must be above this to snorkel-charge

export class Submarine {
  constructor(scene, x, y) {
    this.scene    = scene;
    this.graphics = scene.add.graphics();
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle      = 0;
    this.angularVel = 0;

    this.ballast       = 0.45;
    this.targetBallast = 0.45;

    this.hull        = 1.0;
    this.battery     = 1.0;
    this.oxygen      = 1.0;
    this.enginePower = 0;

    // Derived / exported to GameScene
    this.noise            = 0;   // raw acoustic output
    this.noiseEffective   = 0;   // what enemy hydrophones detect (masked by thermocline)
    this.cavitating       = false;
    this.belowThermocline = false;
    this.snorkeling       = false;

    this.impactVelocity = 0;
    this.onFloor        = false;

    this._prevY = y;   // for thermocline crossing detection
    this.trail  = [];
  }

  get depthMetres() {
    const SURF  = this.scene.SURFACE_Y;
    const FLOOR = this.scene.OCEAN_FLOOR_Y;
    return Math.max(0, Math.round((this.y - SURF) / (FLOOR - SURF) * 600));
  }

  update(delta, cursors, keys) {
    const dt = delta / 1000;
    this._handleInput(dt, cursors, keys);
    this._updateBallast(dt);
    this._applyPhysics(dt);
    this._clampToWorld();
    this._updateSystems(dt);
    this._draw();
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  _handleInput(dt, cursors, keys) {
    const boost    = keys.shift.isDown ? 2.0 : 1.0;
    const hasJuice = this.battery > 0;

    if (hasJuice) {
      if (cursors.left.isDown || keys.a.isDown) {
        this.enginePower = Phaser.Math.Clamp(
          this.enginePower - ENGINE_RAMP * dt * boost, -1, 1);
      } else if (cursors.right.isDown || keys.d.isDown) {
        this.enginePower = Phaser.Math.Clamp(
          this.enginePower + ENGINE_RAMP * dt * boost, -1, 1);
      } else {
        this.enginePower *= Math.pow(0.18, dt);
      }
    } else {
      this.enginePower *= Math.pow(0.04, dt);
    }

    if (keys.space.isDown) {
      this.enginePower *= Math.pow(0.03, dt);
    }

    if (cursors.up.isDown || keys.w.isDown) {
      this.targetBallast = Math.max(0, this.targetBallast - BALLAST_CMD_RATE * dt);
      const spd = Math.sqrt(this.vx ** 2 + this.vy ** 2);
      this.angularVel -= 0.004 * spd * dt;
    }
    if (cursors.down.isDown || keys.s.isDown) {
      this.targetBallast = Math.min(1, this.targetBallast + BALLAST_CMD_RATE * dt);
      const spd = Math.sqrt(this.vx ** 2 + this.vy ** 2);
      this.angularVel += 0.004 * spd * dt;
    }
  }

  // ── Ballast fill (slower at depth — pumps fight external pressure) ─────────

  _updateBallast(dt) {
    const depth       = this.depthMetres;
    const depthFactor = 1 / (1 + depth / 300);   // 1.0 at surface → 0.33 at 600m
    const maxStep     = BALLAST_RATE * depthFactor * dt;
    const diff        = this.targetBallast - this.ballast;
    if (Math.abs(diff) <= maxStep) {
      this.ballast = this.targetBallast;
    } else {
      this.ballast += Math.sign(diff) * maxStep;
    }
  }

  // ── Physics ────────────────────────────────────────────────────────────────

  _applyPhysics(dt) {
    const THERMO_Y = this.scene.THERMO_Y;

    const thrustX = Math.cos(this.angle) * this.enginePower * MAX_ENGINE_FORCE;
    const thrustY = Math.sin(this.angle) * this.enginePower * MAX_ENGINE_FORCE;

    const bOff  = this.ballast - NEUTRAL_BALLAST;
    const buoyY = bOff * 340;

    // ── Thermocline crossing jolt ──────────────────────────────────────────
    // Water below thermocline is denser → extra upward push when descending through it.
    // Water above thermocline is lighter → slight sink when ascending through it.
    if (this._prevY < THERMO_Y && this.y >= THERMO_Y) {
      this.vy -= 28;   // descending into denser water: buoyancy kicks up
    } else if (this._prevY >= THERMO_Y && this.y < THERMO_Y) {
      this.vy += 18;   // ascending into lighter water: momentary sink tendency
    }
    this._prevY           = this.y;
    this.belowThermocline = this.y >= THERMO_Y;

    // Hydrostatic righting (sub levels itself)
    this.angularVel -= Math.sin(this.angle) * 1.8 * dt;

    // Trim pitch from ballast × speed
    const fwdSpeed = this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle);
    this.angularVel += bOff * Math.abs(fwdSpeed) * 0.005 * dt;

    this.angularVel *= Math.pow(DRAG_ANGULAR, dt * 60);
    this.angle += this.angularVel * dt;

    const maxPitch = 50 * Math.PI / 180;
    if (Math.abs(this.angle) > maxPitch) {
      this.angle = Math.sign(this.angle) * maxPitch;
      this.angularVel *= -0.1;
    }

    this.vx += thrustX * dt;
    this.vy += (thrustY + buoyY) * dt;

    // Anisotropic drag
    const fX     = Math.cos(this.angle);
    const fY     = Math.sin(this.angle);
    const fwdDot = this.vx * fX + this.vy * fY;
    const latVx  = this.vx - fwdDot * fX;
    const latVy  = this.vy - fwdDot * fY;

    // Slightly higher drag below thermocline (denser water)
    const densityMult = this.belowThermocline ? 0.996 : 1.0;
    const dFwd = Math.pow(0.968 * densityMult, dt * 60);
    const dLat = Math.pow(0.68,                dt * 60);

    this.vx = fwdDot * dFwd * fX + latVx * dLat;
    this.vy = fwdDot * dFwd * fY + latVy * dLat;

    const spd = Math.sqrt(this.vx ** 2 + this.vy ** 2);
    if (spd > 290) { this.vx *= 290 / spd; this.vy *= 290 / spd; }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.trail.push({ x: this.x, y: this.y, age: 0 });
    if (this.trail.length > 55) this.trail.shift();
    for (const p of this.trail) p.age += dt;
  }

  // ── Boundary collisions ────────────────────────────────────────────────────

  _clampToWorld() {
    const WORLD_W = this.scene.WORLD_W;
    const FLOOR_Y = this.scene.OCEAN_FLOOR_Y;
    const SURF_Y  = this.scene.SURFACE_Y;

    this.impactVelocity = 0;
    this.onFloor        = false;

    if (this.x < 0)       this.x += WORLD_W;
    if (this.x > WORLD_W) this.x -= WORLD_W;

    if (this.y < SURF_Y) {
      if (this.vy < 0) {
        this.impactVelocity = -this.vy;
        this.vy = 0;
      }
      this.y = SURF_Y;
      this.angularVel -= this.angle * 1.5 * (1 / 60);
    }

    if (this.y > FLOOR_Y) {
      const impactVy = Math.abs(this.vy);
      this.impactVelocity = impactVy;
      if (impactVy > 25) {
        this.hull -= Phaser.Math.Clamp((impactVy - 25) / 260, 0.003, 0.22);
      }
      this.y  = FLOOR_Y;
      this.vy = 0;
      this.vx *= 0.55;
      this.angularVel *= 0.25;
      this.onFloor = true;
    }

    if (this.onFloor && Math.abs(this.vx) > 15) {
      this.hull -= 0.0008 * (Math.abs(this.vx) / 100);
    }
  }

  // ── Systems ────────────────────────────────────────────────────────────────

  _updateSystems(dt) {
    const spd   = Math.sqrt(this.vx ** 2 + this.vy ** 2);
    const depth = this.depthMetres;

    // ── Cavitation noise model ─────────────────────────────────────────────
    // Below CAVITATION_SPEED: noise scales smoothly with speed.
    // Above CAVITATION_SPEED: noise jumps sharply (propeller creates vapor bubbles).
    const engineNoise = Math.abs(this.enginePower) * 0.50;
    let speedNoise;
    if (spd > CAVITATION_SPEED && Math.abs(this.enginePower) > 0.25) {
      this.cavitating = true;
      const excess    = (spd - CAVITATION_SPEED) / (290 - CAVITATION_SPEED); // 0→1
      speedNoise      = 0.22 + excess * excess * 0.60;  // quadratic spike
    } else {
      this.cavitating = false;
      speedNoise      = (spd / CAVITATION_SPEED) * 0.22;
    }
    this.noise = Phaser.Math.Clamp(engineNoise + speedNoise, 0, 1);

    // ── Thermocline noise masking ──────────────────────────────────────────
    // Sound bends around the thermocline (acoustic shadow zone).
    // Enemy hydrophones above thermocline hear 40% less of a deep sub's noise.
    // We show this as the effective noise the player should care about.
    const mask         = this.belowThermocline ? 0.42 : 0;
    this.noiseEffective = Phaser.Math.Clamp(this.noise * (1 - mask), 0, 1);

    // ── Battery ────────────────────────────────────────────────────────────
    // Hotel load: systems always draw power even at rest
    const engineDrain = Math.abs(this.enginePower) * 0.0022;
    this.battery -= (engineDrain + HOTEL_LOAD) * dt;

    // Snorkel charging: at very shallow depth with engine off, diesel recharges battery
    this.snorkeling = depth < SNORKEL_DEPTH_M && this.battery < 1;
    if (this.snorkeling) {
      // Net gain only when engine is mostly off (idle); diesel can't beat full engine drain
      this.battery += 0.00065 * dt;
    }
    this.battery = Phaser.Math.Clamp(this.battery, 0, 1);

    // ── Oxygen ────────────────────────────────────────────────────────────
    if (depth < 8) {
      this.oxygen = Math.min(1, this.oxygen + 0.12 * dt);
    } else {
      this.oxygen -= (0.004 + depth * 0.000005) * dt;
    }
    this.oxygen = Phaser.Math.Clamp(this.oxygen, 0, 1);
    if (this.oxygen <= 0) this.hull -= 0.022 * dt;

    // ── Crush depth ───────────────────────────────────────────────────────
    if (depth > CRUSH_DEPTH) {
      this.hull -= ((depth - CRUSH_DEPTH) / 100) * 0.16 * dt;
    }

    this.hull = Phaser.Math.Clamp(this.hull, 0, 1);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _draw() {
    const g = this.graphics;
    g.clear();

    // Wake trail
    for (let i = 1; i < this.trail.length; i++) {
      const p    = this.trail[i];
      const frac = Math.max(0, 1 - p.age / 3.0);
      g.fillStyle(0x4488aa, frac * 0.18);
      g.fillCircle(p.x, p.y, 1.5 + frac * 2.5);
    }

    // Cavitation cloud behind propeller (world coords, before hull transform)
    if (this.cavitating) {
      const px = this.x - Math.cos(this.angle) * 38;
      const py = this.y - Math.sin(this.angle) * 38;
      const rx = -Math.sin(this.angle);   // perpendicular to heading
      const ry =  Math.cos(this.angle);
      for (let i = 0; i < 4; i++) {
        const spread = Phaser.Math.Between(-7, 7);
        const cx = px + rx * spread + Math.cos(this.angle) * Phaser.Math.Between(-2, 8);
        const cy = py + ry * spread + Math.sin(this.angle) * Phaser.Math.Between(-2, 8);
        g.fillStyle(0xcceeff, 0.18 + Math.random() * 0.22);
        g.fillCircle(cx, cy, Phaser.Math.Between(2, 5));
      }
    }

    // Bubble stream when blowing ballast
    if (this.ballast < NEUTRAL_BALLAST - 0.05 && Math.random() < 0.55) {
      const bx = this.x - Math.cos(this.angle) * 24 + Phaser.Math.Between(-6, 6);
      const by = this.y - Math.sin(this.angle) * 4  + Phaser.Math.Between(-3, 3);
      g.fillStyle(0x88ccff, 0.35 + Math.random() * 0.2);
      g.fillCircle(bx, by, Phaser.Math.Between(1, 3));
    }

    // Sediment cloud on floor
    if (this.onFloor && Math.abs(this.vx) > 10) {
      for (let i = 0; i < 2; i++) {
        g.fillStyle(0x8a6a3a, 0.12 + Math.random() * 0.1);
        g.fillCircle(
          this.x + Phaser.Math.Between(-30, 30),
          this.y + Phaser.Math.Between(2, 8),
          Phaser.Math.Between(4, 10)
        );
      }
    }

    // ── Rotated hull ──────────────────────────────────────────────────────
    g.save();
    g.translateCanvas(this.x, this.y);
    g.rotateCanvas(this.angle);

    const hullColor = this.hull > 0.6 ? 0x2a3a4a
                    : this.hull > 0.3 ? 0x3a2a1a : 0x3a1a1a;
    g.fillStyle(hullColor);
    g.fillEllipse(0, 0, 72, 22);

    g.fillStyle(0x1a2a3a);
    g.fillRect(-8, -18, 22, 14);

    // Periscope / snorkel mast at shallow depth
    if (this.depthMetres < 40) {
      g.fillStyle(0x1a2a3a);
      g.fillRect(2, -28, 3, 12);
      // Snorkel indicator: glows when charging battery
      g.fillStyle(this.snorkeling ? 0x44ff44 : 0x4aff9a, 0.75);
      g.fillCircle(3, -29, 3);
    }

    // Damage cracks
    if (this.hull < 0.6) {
      const ca = (0.6 - this.hull) * 2.8;
      g.lineStyle(1, 0xff4a4a, ca);
      g.strokeLineShape(new Phaser.Geom.Line(-22, 4, -12, -4));
      g.strokeLineShape(new Phaser.Geom.Line(10, -5, 20, 4));
      if (this.hull < 0.3) {
        g.strokeLineShape(new Phaser.Geom.Line(0, -8, 8, 5));
        g.strokeLineShape(new Phaser.Geom.Line(-5, 0, 5, 8));
      }
    }

    // Propeller — spins faster when cavitating, stops when battery dead
    const propSpeed = Math.abs(this.enginePower) * (this.battery > 0 ? 1 : 0);
    const propAngle = (Date.now() * 0.006 * propSpeed * (this.cavitating ? 1.6 : 1)) % (Math.PI * 2);
    g.lineStyle(2, this.cavitating ? 0x88ccff : 0x4a7a9a, 0.85);
    for (let i = 0; i < 3; i++) {
      const a = propAngle + (i * Math.PI * 2) / 3;
      g.strokeLineShape(new Phaser.Geom.Line(
        -36, 0, -36 + Math.cos(a) * 9, Math.sin(a) * 9
      ));
    }

    g.fillStyle(0xff2222, 1); g.fillCircle(-32, 0, 2);
    g.fillStyle(0x22ff22, 1); g.fillCircle( 32, 0, 2);

    g.restore();
  }
}
