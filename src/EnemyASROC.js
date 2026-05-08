// RUR-5A ASROC — rakieta przeciw-okrętowa niszczycieli (od 1961).
// Lot paraboliczny → zrzut torpedy Mk.44 z naprowadzaniem akustycznym.
import Phaser from 'phaser';

const ASROC_SPEED     = 520;   // px/s prędkość pozioma rakiety
const ASROC_ARC_H     = 160;   // px — szczyt łuku
const TORP_SPEED      = 175;   // px/s — torpeda naprowadzana
const TORP_SEEKER_R   = 240;   // px — zasięg głowicy akustycznej
const TORP_THERMO_M   = 0.38;  // zasięg przez termoklnię (38% normalnego)
const TORP_LIFE       = 50;    // s — maksymalny czas działania
const TORP_SEARCH_Y   = 300;   // px Y — głębokość przeszukiwania
const TORP_DESCENT_Y  = 400;   // px Y — głębokość zanurz jesli nie wykryto

export class ASROC {
  constructor(scene, fromX, targetX, targetY) {
    this.scene   = scene;
    this.gfx     = scene.add.graphics();

    this.fromX   = fromX;
    this.fromY   = scene.SURFACE_Y - 8;
    this.targetX = targetX;
    this.targetY = Phaser.Math.Clamp(targetY, scene.SURFACE_Y, scene.OCEAN_FLOOR_Y - 20);

    this.t       = 0;      // 0→1 parametr lotu
    const dx     = Math.abs(targetX - fromX);
    this.dur     = Math.max(0.8, dx / ASROC_SPEED);   // czas lotu

    this.x       = fromX;
    this.y       = this.fromY;
    this.dir     = Math.sign(targetX - fromX) || 1;

    this.dead        = false;
    this.splashed    = false;
    this.smoke       = [];
    this.splashTimer = 0;
  }

  update(dt) {
    if (this.dead) return null;

    if (this.splashed) {
      this.splashTimer -= dt;
      if (this.splashTimer <= 0) this.dead = true;
      this._draw();
      return null;
    }

    this.t += dt / this.dur;

    // Pozycja paraboliczna
    const lerp = this.t;
    this.x = this.fromX + (this.targetX - this.fromX) * lerp;
    this.y = this.fromY
           - ASROC_ARC_H * Math.sin(Math.PI * lerp)
           + (this.targetY - this.fromY) * lerp;

    // Smuga
    if (Math.random() < 0.7)
      this.smoke.push({ x: this.x, y: this.y, age: 0 });
    if (this.smoke.length > 40) this.smoke.shift();
    for (const s of this.smoke) s.age += dt;

    this._draw();

    if (this.t >= 1) {
      this.splashed    = true;
      this.splashTimer = 0.35;
      // Zwróć pozycję do spawnu torpedy
      return { x: this.targetX, y: this.scene.SURFACE_Y };
    }
    return null;
  }

  destroy() { this.gfx.destroy(); }

  _draw() {
    const g = this.gfx;
    g.clear();

    // Smuga dymu
    for (const s of this.smoke) {
      const frac = Math.max(0, 1 - s.age / 1.8);
      g.fillStyle(0xbbbbbb, frac * 0.20);
      g.fillCircle(s.x, s.y, 3 + s.age * 4);
    }

    if (this.splashed) {
      // Fala uderzenia w wodę
      const frac = this.splashTimer / 0.35;
      g.fillStyle(0xaaddff, frac * 0.50);
      g.fillCircle(this.targetX, this.scene.SURFACE_Y, (1 - frac) * 30 + 5);
      g.lineStyle(2, 0x88ccff, frac * 0.70);
      g.strokeCircle(this.targetX, this.scene.SURFACE_Y, (1 - frac) * 45);
      return;
    }

    // Oblicz kąt lotu
    const nextT   = Math.min(this.t + 0.02, 1);
    const nx = this.fromX + (this.targetX - this.fromX) * nextT;
    const ny = this.fromY - ASROC_ARC_H * Math.sin(Math.PI * nextT) + (this.targetY - this.fromY) * nextT;
    const angle = Math.atan2(ny - this.y, nx - this.x);

    g.save();
    g.translateCanvas(this.x, this.y);
    g.rotateCanvas(angle);

    // Kadłub rakiety
    g.fillStyle(0xd4d4d4, 0.95);
    g.fillEllipse(0, 0, 28, 7);
    // Głowica
    g.fillStyle(0x6688aa, 1);
    g.fillTriangle(14, 0, 9, -3.5, 9, 3.5);
    // Skrzydełka
    g.fillStyle(0xaaaaaa, 0.85);
    g.fillTriangle(-10, 0, -14, -7, -6, 0);
    g.fillTriangle(-10, 0, -14,  7, -6, 0);

    // Dysza
    const fl = 0.8 + Math.sin(Date.now() * 0.04) * 0.2;
    g.fillStyle(0xff6600, 1);
    g.fillCircle(-14, 0, 5.5 * fl);
    g.fillStyle(0xffee00, 0.9);
    g.fillCircle(-14, 0, 3 * fl);

    g.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Mk.44 — torpeda samonaprowadzająca zrzucana z ASROC
// ─────────────────────────────────────────────────────────────────────────────

const SEARCH_TURN_RATE = 0.9;   // rad/s — agresywność skrętów

export class HomingTorpedo {
  constructor(scene, x, y) {
    this.scene = scene;
    this.gfx   = scene.add.graphics();

    this.x = x;
    this.y = y;

    this.vx       = 0;
    this.vy       = TORP_SPEED * 0.6;  // wchodzi do wody pionowo
    this.heading  = Math.PI / 2;       // patrzy w dół

    this.phase    = 'descent';   // descent | search | homing
    this.life     = TORP_LIFE;
    this.dead     = false;
    this.locked   = false;

    this._searchAngle  = 0;   // kąt spirali szukania
    this._searchRadius = 80;
    this._searchCenter = { x, y: TORP_SEARCH_Y };

    this.recentHit = null;
    this.trail     = [];
    this.exploded  = false;
    this.explodeTimer = 0;
  }

  update(dt, sub) {
    this.recentHit = null;

    if (this.exploded) {
      this.explodeTimer -= dt;
      if (this.explodeTimer <= 0) this.dead = true;
      this._draw();
      return;
    }

    this.life -= dt;
    if (this.life <= 0) {
      this._explode();
      return;
    }

    const SURF  = this.scene.SURFACE_Y;
    const FLOOR = this.scene.OCEAN_FLOOR_Y;

    // ── Podsłuch akustyczny ──────────────────────────────────────────────────
    const dx   = sub.x - this.x;
    const dy   = sub.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Termoklina tłumi sygnał gdy głowica powyżej a cel poniżej (lub odwrotnie)
    const THERMO_Y  = this.scene.THERMO_Y;
    const crossThermo = (this.y < THERMO_Y) !== (sub.y < THERMO_Y);
    const seekR = TORP_SEEKER_R * (crossThermo ? TORP_THERMO_M : 1)
                                * Math.max(0.1, sub.noiseEffective * 4);

    if (dist < seekR && this.phase !== 'homing') {
      this.phase  = 'homing';
      this.locked = true;
    }
    // Jeśli łódź wyjdzie poza zasięg — wróć do szukania
    if (dist > seekR * 1.4 && this.phase === 'homing') {
      this.phase  = 'search';
      this.locked = false;
    }

    // ── Sterowanie ───────────────────────────────────────────────────────────
    switch (this.phase) {
      case 'descent': {
        // Pionowe zanurzenie do głębokości szukania
        this.vx = 0;
        this.vy = TORP_SPEED * 0.7;
        if (this.y >= TORP_SEARCH_Y || this.y >= FLOOR - 30) {
          this.phase = 'search';
          this._searchCenter = { x: this.x, y: this.y };
        }
        break;
      }
      case 'search': {
        // Spirala szukania rozszerzająca się od punktu wejścia
        this._searchAngle  += dt * 1.1;
        this._searchRadius  = Math.min(80 + (TORP_LIFE - this.life) * 8, 320);

        const tx = this._searchCenter.x + Math.cos(this._searchAngle) * this._searchRadius;
        const ty = this._searchCenter.y + Math.sin(this._searchAngle) * this._searchRadius * 0.4;

        const wdx    = tx - this.x;
        const wdy    = ty - this.y;
        const wAngle = Math.atan2(wdy, wdx);
        this._steerTo(wAngle, dt);
        this._applyThrust();
        break;
      }
      case 'homing': {
        // Naprowadź na łódź podwodną
        const targetAngle = Math.atan2(dy, dx);
        this._steerTo(targetAngle, dt * 2.2);
        this._applyThrust();
        break;
      }
    }

    // Ograniczenia świata
    if (this.y < SURF + 5) { this.y = SURF + 5; this.vy = Math.abs(this.vy); }
    if (this.y > FLOOR - 5) { this.y = FLOOR - 5; this.vy = -Math.abs(this.vy); }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Ślad
    this.trail.push({ x: this.x, y: this.y, age: 0 });
    if (this.trail.length > 30) this.trail.shift();
    for (const p of this.trail) p.age += dt;

    // Kolizja z łodzią
    if (dist < 28) {
      const ratio = 1 - dist / 28;
      this.recentHit = { damage: 0.30 + ratio * 0.25 };
      this._explode();
    }

    this._draw();
  }

  _steerTo(targetAngle, dt) {
    let err = targetAngle - this.heading;
    while (err >  Math.PI) err -= Math.PI * 2;
    while (err < -Math.PI) err += Math.PI * 2;
    this.heading += Math.sign(err) * Math.min(Math.abs(err), SEARCH_TURN_RATE * dt);
  }

  _applyThrust() {
    const spd = TORP_SPEED * (this.phase === 'homing' ? 1.15 : 0.85);
    this.vx = Math.cos(this.heading) * spd;
    this.vy = Math.sin(this.heading) * spd;
  }

  _explode() {
    this.exploded     = true;
    this.explodeTimer = 0.65;
  }

  destroy() { this.gfx.destroy(); }

  _draw() {
    const g = this.gfx;
    g.clear();

    // Ślad bąbelków
    for (const p of this.trail) {
      const frac = Math.max(0, 1 - p.age / 1.5);
      g.fillStyle(0x4488aa, frac * 0.22);
      g.fillCircle(p.x, p.y, 1.5 + frac * 2);
    }

    if (this.exploded) {
      const frac = this.explodeTimer / 0.65;
      const r    = (1 - frac) * 70;
      g.lineStyle(3, 0xff8800, frac * 0.9);
      g.strokeCircle(this.x, this.y, r);
      g.fillStyle(0xffcc44, frac * 0.8);
      g.fillCircle(this.x, this.y, r * 0.4);
      g.lineStyle(1.5, 0xffffff, frac * 0.4);
      g.strokeCircle(this.x, this.y, r * 1.5);
      return;
    }

    // Torpeda podwodna
    g.save();
    g.translateCanvas(this.x, this.y);
    g.rotateCanvas(this.heading);

    // Ślad propelera (pęcherzyki)
    if (Math.random() < 0.4) {
      g.fillStyle(0x88ccff, 0.35);
      g.fillCircle(-16 + Phaser.Math.Between(-3, 3), Phaser.Math.Between(-3, 3), 2);
    }

    // Kadłub — żółty jak Mk.44
    const col = this.locked ? 0xff4400 : 0xddaa22;
    g.fillStyle(col, 0.95);
    g.fillEllipse(0, 0, 28, 8);
    g.fillStyle(0xccaa00, 0.85);
    g.fillTriangle(14, 0, 10, -3.5, 10, 3.5);

    // Impeller (głowica sonaru z przodu — małe kółko)
    g.fillStyle(0x88ccff, 0.8);
    g.fillCircle(14, 0, 3);

    g.restore();

    // Pierścień zasięgu głowicy (gdy szuka)
    if (this.phase === 'search' || this.phase === 'homing') {
      const THERMO_Y    = this.scene.THERMO_Y;
      const crossThermo = (this.y < THERMO_Y);
      const rVis = Math.min(TORP_SEEKER_R * (crossThermo ? 0.4 : 1), 180);
      g.lineStyle(0.8, this.locked ? 0xff4400 : 0x44ffcc, this.locked ? 0.4 : 0.12);
      g.strokeCircle(this.x, this.y, rVis);
    }
  }
}
