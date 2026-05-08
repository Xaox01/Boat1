// Torpeda z aktywną głowicą akustyczną (stożek 15°) i limitem skrętu.
import Phaser from 'phaser';

const SPEED          = 255;
const MAX_RANGE      = 950;
const ARM_DIST       = 55;
const HIT_RADIUS     = 34;
const BLAST_R        = 80;
const MAX_TURN_RATE  = Math.PI / 5.5;  // ~33°/s — nie może robić U-skrętów
const SEEKER_RANGE   = 195;             // px — zasięg akustyczny głowicy
const SEEKER_HALF    = Math.PI / 12;    // 15° — kąt stożka (w jedną stronę)

export class Torpedo {
  constructor(scene, x, y, targetX, targetY) {
    this.scene = scene;
    this.gfx   = scene.add.graphics();

    this.x = x;
    this.y = y;

    const clampedY   = Math.max(targetY, scene.SURFACE_Y);
    const dx         = targetX - x;
    const dy         = clampedY - y;
    this.heading     = Math.atan2(dy, dx);

    this.distTraveled = 0;
    this.armed        = false;
    this.exploded     = false;
    this.explodeTimer = 0;
    this.dead         = false;

    this.seekerLocked  = false;
    this._seekerDiff   = 0;
    this.cmdDetonate   = false;  // zdalna detonacja (klawisz E)

    this.recentHit       = null;
    this.recentExplosion = null;
    this.trail           = [];
  }

  update(dt, enemies = []) {
    this.recentHit       = null;
    this.recentExplosion = null;

    if (this.exploded) {
      this.explodeTimer -= dt;
      if (this.explodeTimer <= 0) this.dead = true;
      this._draw();
      return;
    }

    // Zdalna detonacja
    if (this.cmdDetonate && this.armed) {
      this._explode();
      this._draw();
      return;
    }

    // Uzbrojona głowica — szuka celów w stożku
    if (this.armed && enemies.length) {
      this._updateSeeker(enemies, dt);
    }

    // Prędkość z kursu (umożliwia skręty głowicy)
    const vx = Math.cos(this.heading) * SPEED;
    const vy = Math.sin(this.heading) * SPEED;

    this.x += vx * dt;
    this.y += vy * dt;
    this.distTraveled += SPEED * dt;
    if (this.distTraveled >= ARM_DIST) this.armed = true;

    const SURF  = this.scene.SURFACE_Y;
    const FLOOR = this.scene.OCEAN_FLOOR_Y;
    if (this.y < SURF || this.y > FLOOR) this._expire();

    this.trail.push({ x: this.x, y: this.y, age: 0 });
    if (this.trail.length > 28) this.trail.shift();
    for (const p of this.trail) p.age += dt;

    if (this.distTraveled >= MAX_RANGE) this._expire();

    this._draw();
  }

  // Stożkowy seeker akustyczny — skręca w kierunku celu wewnątrz stożka
  _updateSeeker(enemies, dt) {
    let bestDiff = Infinity;
    let locked   = false;

    for (const e of enemies) {
      if (e.destroyed) continue;
      const dx   = e.x - this.x;
      const dy   = e.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > SEEKER_RANGE) continue;

      const angleToEnemy = Math.atan2(dy, dx);
      let diff = angleToEnemy - this.heading;
      while (diff >  Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      if (Math.abs(diff) < SEEKER_HALF && Math.abs(diff) < bestDiff) {
        bestDiff        = Math.abs(diff);
        this._seekerDiff = diff;
        locked          = true;
      }
    }

    this.seekerLocked = locked;
    if (locked) {
      const turn = Math.sign(this._seekerDiff)
                 * Math.min(Math.abs(this._seekerDiff), MAX_TURN_RATE * dt);
      this.heading += turn;
    }
  }

  // Sprawdź trafienie — wywoływane z GameScene
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

  destroy() { this.gfx.destroy(); }

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

    // Ślad bąbelkowy
    for (const p of this.trail) {
      const frac = Math.max(0, 1 - p.age / 1.2);
      g.fillStyle(0xaaddff, frac * 0.38);
      g.fillCircle(p.x, p.y, 1.8 + frac * 2.8);
    }

    g.save();
    g.translateCanvas(this.x, this.y);
    g.rotateCanvas(this.heading);

    // Stożek seekera (rysowany przed kadłubem żeby był pod spodem)
    if (this.armed) {
      const coneLen   = 58;
      const coneColor = this.seekerLocked ? 0x44ff88 : 0x226644;
      const coneAlpha = this.seekerLocked ? 0.28    : 0.09;
      g.fillStyle(coneColor, coneAlpha);
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, coneLen, -SEEKER_HALF, SEEKER_HALF, false);
      g.closePath();
      g.fillPath();

      // Krawędź stożka
      g.lineStyle(0.8, coneColor, this.seekerLocked ? 0.70 : 0.22);
      g.strokeLineShape(new Phaser.Geom.Line(0, 0, coneLen * Math.cos(-SEEKER_HALF), coneLen * Math.sin(-SEEKER_HALF)));
      g.strokeLineShape(new Phaser.Geom.Line(0, 0, coneLen * Math.cos( SEEKER_HALF), coneLen * Math.sin( SEEKER_HALF)));
    }

    // Kadłub torpedy
    g.fillStyle(this.armed ? 0xff4400 : 0xffaa00, 1);
    g.fillEllipse(0, 0, 22, 7);
    // Głowica (nos)
    const noseCol = this.seekerLocked ? 0x44ff88 : 0xff2200;
    g.fillStyle(noseCol, 1);
    g.fillCircle(11, 0, 3.5);
    // Stery
    g.fillStyle(0xcc8800, 0.9);
    g.fillRect(-11, -5, 5, 3);
    g.fillRect(-11,  2, 5, 3);

    g.restore();
  }
}
