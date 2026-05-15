// Torpeda z aktywną głowicą akustyczną (stożek 15°) i limitem skrętu.
import Phaser from 'phaser';

const SPEED          = 255;
const MAX_RANGE      = 1100;
const ARM_DIST       = 55;
const HIT_RADIUS     = 34;
const BLAST_R        = 80;
const MAX_TURN_RATE  = Math.PI / 5.5;  // ~33°/s — nie może robić U-skrętów
const SEEKER_RANGE   = 240;             // px — zasięg akustyczny głowicy
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
    const FLOOR = this.scene.floorAt ? this.scene.floorAt(this.x) : this.scene.OCEAN_FLOOR_Y;
    if (this.y < SURF || this.y >= FLOOR) this._expire();

    this.trail.push({ x: this.x, y: this.y, age: 0 });
    if (this.trail.length > 56) this.trail.shift();
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
    this._explodeDur  = 0.65;
    if (!this.recentExplosion) this.recentExplosion = { dist: 9999 };
  }

  _expire() {
    this.exploded        = true;
    this.explodeTimer    = 0.40;
    this._explodeDur     = 0.40;
    this.recentExplosion = { dist: 9999 };
  }

  destroy() { this.gfx.destroy(); }

  _draw() {
    const g = this.gfx;
    g.clear();

    // ── Wybuch ────────────────────────────────────────────────────────────────
    if (this.exploded) {
      const dur  = this._explodeDur || 0.65;
      const frac = Phaser.Math.Clamp(this.explodeTimer / dur, 0, 1);
      const r    = (1 - frac) * BLAST_R * 2.4;

      // Flash centralny (bardzo krótki)
      if (frac > 0.82) {
        g.fillStyle(0xffffff, (frac - 0.82) / 0.18 * 0.9);
        g.fillCircle(this.x, this.y, r * 0.5 + 8);
      }
      // Kula ognia
      g.fillStyle(0xff8800, frac * 0.70);
      g.fillCircle(this.x, this.y, r * 0.45);
      g.fillStyle(0xffdd44, frac * 0.55);
      g.fillCircle(this.x, this.y, r * 0.25);

      // Główna fala uderzeniowa
      g.lineStyle(2.5, 0xff7700, frac * 0.80);
      g.strokeCircle(this.x, this.y, r);

      // Zewnętrzna fala (szybsza)
      g.lineStyle(1.2, 0xff4400, frac * 0.40);
      g.strokeCircle(this.x, this.y, r * 1.55);

      // Bąble powietrza (podwodna eksplozja)
      for (let i = 0; i < 6; i++) {
        const a  = (i / 6) * Math.PI * 2;
        const dr = r * (0.6 + (i % 2) * 0.3);
        g.fillStyle(0xaaddff, frac * 0.45);
        g.fillCircle(this.x + Math.cos(a) * dr, this.y + Math.sin(a) * dr, 3 + frac * 3);
      }
      return;
    }

    // ── Ślad bąbelkowy ────────────────────────────────────────────────────────
    // Cienka oś śladu (przerywana)
    if (this.trail.length > 1) {
      g.lineStyle(0.6, 0xc8d8e0, 0.18);
      g.beginPath();
      for (let i = 0; i < this.trail.length; i++) {
        const p = this.trail[i];
        i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y);
      }
      g.strokePath();
    }
    // Bąble — rosnące koła, unoszą się lekko w górę, zanikają
    const BUBBLE_LIFE = 2.4;
    for (let i = 0; i < this.trail.length; i++) {
      const p    = this.trail[i];
      const frac = Math.max(0, 1 - p.age / BUBBLE_LIFE);
      if (frac <= 0) continue;
      const drift = p.age * 5;               // unoszenie w górę
      const r     = 3 + p.age * 4 + (i % 4);
      const jx    = ((i * 37) % 4) - 2;
      // zewnętrzny kontur bąbla
      g.lineStyle(0.9, 0xc8d8e0, frac * 0.52);
      g.strokeCircle(p.x + jx, p.y - drift, r);
      // co trzeci — mniejszy satel
      if (i % 3 === 0) {
        g.lineStyle(0.7, 0xc8d8e0, frac * 0.38);
        g.strokeCircle(p.x + 4, p.y - drift - 4, r * 0.55);
      }
    }

    g.save();
    g.translateCanvas(this.x, this.y);
    g.rotateCanvas(this.heading);

    // ── Stożek seekera akustycznego ───────────────────────────────────────────
    if (this.armed) {
      const coneLen   = 62;
      const coneColor = this.seekerLocked ? 0x44ff88 : 0x226644;
      const coneAlpha = this.seekerLocked ? 0.25     : 0.08;
      g.fillStyle(coneColor, coneAlpha);
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, coneLen, -SEEKER_HALF, SEEKER_HALF, false);
      g.closePath();
      g.fillPath();
      g.lineStyle(0.8, coneColor, this.seekerLocked ? 0.65 : 0.20);
      g.strokeLineShape(new Phaser.Geom.Line(0, 0, coneLen * Math.cos(-SEEKER_HALF), coneLen * Math.sin(-SEEKER_HALF)));
      g.strokeLineShape(new Phaser.Geom.Line(0, 0, coneLen * Math.cos( SEEKER_HALF), coneLen * Math.sin( SEEKER_HALF)));
    }

    // ── Korpus torpedy ────────────────────────────────────────────────────────
    const bodyCol = this.armed ? 0xcc3300 : 0xdd8800;

    // Obudowa silnika (tył)
    g.fillStyle(0x774400, 0.90);
    g.fillEllipse(-10, 0, 16, 7);

    // Główny kadłub
    g.fillStyle(bodyCol, 0.97);
    g.fillEllipse(2, 0, 26, 8);

    // Sekcja głowicy bojowej (jaśniejsza)
    g.fillStyle(this.armed ? 0xee4400 : 0xeeaa00, 0.95);
    g.fillEllipse(10, 0, 12, 8);

    // Nos / głowica akustyczna
    const noseCol = this.seekerLocked ? 0x44ffaa : (this.armed ? 0xff2200 : 0xffcc00);
    g.fillStyle(noseCol, 1.0);
    g.fillCircle(14, 0, 4.5);
    // Odblask na głowicy
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(15, -1, 1.8);

    // Linia podziału sekcji kadłuba
    g.lineStyle(1, 0x551100, 0.55);
    g.strokeLineShape(new Phaser.Geom.Line(3, -4, 3, 4));

    // ── Stery rufowe (krzyżowe) ───────────────────────────────────────────────
    g.fillStyle(0x883300, 0.88);
    g.fillRect(-16, -7, 7, 3);   // górny
    g.fillRect(-16,  4, 7, 3);   // dolny
    g.fillRect(-19, -2, 4, 5);   // boczny pionowy (uproszczony)

    // ── Pierścień śruby ───────────────────────────────────────────────────────
    g.lineStyle(1.2, 0x664400, 0.70);
    g.strokeCircle(-17, 0, 5);
    // Łopatki śruby
    const tPropA = (Date.now() * 0.018) % (Math.PI * 2);
    g.lineStyle(1.5, 0x996633, 0.80);
    for (let i = 0; i < 3; i++) {
      const a = tPropA + (i * Math.PI * 2) / 3;
      g.strokeLineShape(new Phaser.Geom.Line(-17, 0, -17 + Math.cos(a) * 4.5, Math.sin(a) * 4.5));
    }

    g.restore();
  }
}
