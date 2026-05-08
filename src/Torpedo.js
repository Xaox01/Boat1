import Phaser from 'phaser';

const SPEED      = 255;
const MAX_RANGE  = 950;
const ARM_DIST   = 55;
const HIT_RADIUS = 34;
const BLAST_R    = 80;

export class Torpedo {
  constructor(scene, x, y, targetX, targetY) {
    this.scene = scene;
    this.gfx   = scene.add.graphics();

    this.x = x;
    this.y = y;

    // Torpeda działa tylko pod wodą — cel nie może być ponad taflą
    const clampedY = Math.max(targetY, scene.SURFACE_Y);
    const dx   = targetX - x;
    const dy   = clampedY - y;
    this.angle = Math.atan2(dy, dx);
    this.vx    = Math.cos(this.angle) * SPEED;
    this.vy    = Math.sin(this.angle) * SPEED;

    this.distTraveled = 0;
    this.armed        = false;
    this.exploded     = false;
    this.explodeTimer = 0;
    this.dead         = false;

    this.recentHit       = null;
    this.recentExplosion = null;
    this.trail           = [];
  }

  update(dt) {
    this.recentHit       = null;
    this.recentExplosion = null;

    if (this.exploded) {
      this.explodeTimer -= dt;
      if (this.explodeTimer <= 0) this.dead = true;
      this._draw();
      return;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.distTraveled += SPEED * dt;
    if (this.distTraveled >= ARM_DIST) this.armed = true;

    // ── Ograniczenia wodne ─────────────────────────────────────────────────
    // Torpeda działa tylko pod wodą — nie może wyjść ponad taflę
    const SURF  = this.scene.SURFACE_Y;
    const FLOOR = this.scene.OCEAN_FLOOR_Y;

    if (this.y < SURF) {
      // Odbicie od tafli od spodu — torpeda wraca w dół
      this.y  = SURF + 1;
      this.vy = Math.abs(this.vy) * 0.25;
      this.angle = Math.atan2(this.vy, this.vx);
    }

    if (this.y > FLOOR) {
      // Uderzenie w dno — eksplozja
      this._expire();
    }

    this.trail.push({ x: this.x, y: this.y, age: 0 });
    if (this.trail.length > 28) this.trail.shift();
    for (const p of this.trail) p.age += dt;

    if (this.distTraveled >= MAX_RANGE) this._expire();

    this._draw();
  }

  // Sprawdź trafienie w obiekt {x, y}. Zwraca obrażenia (0 = pudło).
  checkHit(target) {
    if (!this.armed || this.exploded) return 0;

    const WORLD_W = this.scene.WORLD_W;
    let dx = target.x - this.x;
    if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
    const dy   = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < HIT_RADIUS) {
      const dmg = Phaser.Math.Clamp(0.45 + (1 - dist / HIT_RADIUS) * 0.35, 0.45, 0.80);
      this.recentHit       = { dist };
      this.recentExplosion = { dist };
      this._explode();
      this._draw();
      return dmg;
    }
    return 0;
  }

  _explode() {
    this.exploded     = true;
    this.explodeTimer = 0.65;
    if (!this.recentExplosion) this.recentExplosion = { dist: 9999 };
  }

  _expire() {
    this.exploded        = true;
    this.explodeTimer    = 0.40;
    this.recentExplosion = { dist: 9999 };
  }

  destroy() {
    this.gfx.destroy();
  }

  _draw() {
    const g = this.gfx;
    g.clear();

    if (this.exploded) {
      const frac = this.explodeTimer / 0.65;
      const r    = (1 - frac) * BLAST_R * 2.2;
      g.lineStyle(3, 0xff8800, frac * 0.85);
      g.strokeCircle(this.x, this.y, r);
      g.lineStyle(1.5, 0xff4400, frac * 0.5);
      g.strokeCircle(this.x, this.y, r * 1.5);
      g.fillStyle(0xffdd00, frac * 0.55);
      g.fillCircle(this.x, this.y, r * 0.38);
      return;
    }

    for (let i = 0; i < this.trail.length; i++) {
      const p    = this.trail[i];
      const frac = Math.max(0, 1 - p.age / 1.2);
      g.fillStyle(0xaaddff, frac * 0.38);
      g.fillCircle(p.x, p.y, 1.8 + frac * 2.8);
    }

    g.save();
    g.translateCanvas(this.x, this.y);
    g.rotateCanvas(this.angle);

    g.fillStyle(this.armed ? 0xff4400 : 0xffaa00, 1);
    g.fillEllipse(0, 0, 22, 7);
    g.fillStyle(0xff2200, 1);
    g.fillCircle(11, 0, 3.5);
    g.fillStyle(0xcc8800, 0.9);
    g.fillRect(-11, -5, 5, 3);
    g.fillRect(-11,  2, 5, 3);

    g.restore();
  }
}
