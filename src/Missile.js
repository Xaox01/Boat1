// Rakieta przeciwokrętowa gracza (styl Harpoon/Exocet).
// Fazy: boost (pionowy start) → cruise (sea-skimming ~8px nad wodą, aktywne radar-śledzenie)
//        → terminal (stromy lot na cel).
import Phaser from 'phaser';

const SPEED        = 400;   // px/s prędkość przelotowa
const SEA_SKIM_ALT = 8;     // px ponad taflą — prawdziwy sea-skimming
const BLAST_R      = 78;
const MAX_RANGE    = 2000;
const SEEKER_RANGE = 650;   // px — zasięg radaru aktywnego

export class Missile {
  constructor(scene, x, y, targetX) {
    this.scene   = scene;
    this.gfx     = scene.add.graphics();

    this.x       = x;
    this.y       = y;
    this.startX  = x;
    this.targetX = targetX;

    const SURF   = scene.SURFACE_Y;
    this.cruiseY = SURF - SEA_SKIM_ALT;

    this.dir = Math.sign(targetX - x) || 1;
    this.vx  = this.dir * SPEED * 0.5;
    this.vy  = -340;    // silny pionowy impuls startowy

    this.phase        = 'boost';
    this.surfaced     = false;
    this.exploded     = false;
    this.explodeTimer = 0;
    this.dead         = false;
    this.recentHit    = null;

    this._lockedTarget = null;   // aktualnie śledzona jednostka
    this.smoke         = [];
  }

  update(dt, surfaceEnemies) {
    this.recentHit = null;

    if (this.exploded) {
      this.explodeTimer -= dt;
      if (this.explodeTimer <= 0) this.dead = true;
      this._drawSmoke();
      this._drawExplosion();
      return;
    }

    const SURF = this.scene.SURFACE_Y;

    // ── Seeker radarowy — blokuje na najbliższy cel przed nami ──────────────
    if (this.phase === 'cruise' || this.phase === 'terminal') {
      this._updateSeeker(surfaceEnemies);
    }

    switch (this.phase) {
      case 'boost': {
        // Pionowy climb do wysokości sea-skim
        const err = this.cruiseY - this.y;
        this.vy  += err * 14 * dt;
        this.vx   = Phaser.Math.Linear(this.vx, this.dir * SPEED, dt * 2.5);
        this.vy   = Math.max(this.vy, -360);
        if (this.y <= this.cruiseY + 4) {
          this.phase = 'cruise';
          this.vy    = 0;
        }
        break;
      }
      case 'cruise': {
        // Sea-skimming — płynie tuż nad wodą, koryguje kurs na cel
        this.vy += (this.cruiseY - this.y) * 22 * dt;
        this.vy  = Phaser.Math.Clamp(this.vy, -55, 55);
        this.vx  = Phaser.Math.Linear(this.vx, this.dir * SPEED, dt * 3);

        const distToTarget = Math.abs(this.targetX - this.x);
        if (distToTarget < 120) this.phase = 'terminal';
        break;
      }
      case 'terminal': {
        // Nurkuje stromo na linię wody — precyzyjna faza uderzenia
        const dxToTarget = this.targetX - this.x;
        if (Math.sign(dxToTarget) !== this.dir) {
          this._explode(); break;
        }
        const dist = Math.abs(dxToTarget);
        const tLeft = Math.max(dist / SPEED, 0.01);
        this.vy  = (SURF - 2 - this.y) / tLeft;
        this.vy  = Phaser.Math.Clamp(this.vy, -55, 700);
        this.vx  = this.dir * SPEED;
        break;
      }
    }

    const prevY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Efekt wyłonienia się z wody
    if (!this.surfaced && prevY >= SURF && this.y < SURF) {
      this.surfaced = true;
      for (let i = 0; i < 10; i++) {
        this.smoke.push({
          x: this.x + Phaser.Math.Between(-18, 18),
          y: SURF + Phaser.Math.Between(-4, 4),
          age: 0, r: 6 + Math.random() * 4, splash: true,
        });
      }
    }

    // Smuga — gęstsza przy sea-skimmingu
    if (Math.random() < 0.70)
      this.smoke.push({ x: this.x, y: this.y, age: 0, r: 2 + Math.random() * 1.8 });
    if (this.smoke.length > 65) this.smoke.shift();
    for (const s of this.smoke) s.age += dt;

    // Trafienie w okręt nawodny
    for (const enemy of surfaceEnemies) {
      if (enemy.destroyed) continue;
      if (Math.abs(enemy.x - this.x) < 54 && Math.abs(enemy.y - this.y) < 36) {
        this.recentHit = { enemy, damage: 0.48 + Math.random() * 0.24 };
        this._explode();
        this._draw(); return;
      }
    }

    const traveled = Math.abs(this.x - this.startX);
    if (traveled > MAX_RANGE)                          this._explode();
    if (this.y > SURF + 18 && this.phase !== 'boost') this._explode();

    this._draw();
  }

  // Seeker śledzi najbliszego wroga przed rakietą (w kierunku lotu)
  _updateSeeker(enemies) {
    let best = null, bestDist = SEEKER_RANGE;
    for (const e of enemies) {
      if (e.destroyed) continue;
      const dx = e.x - this.x;
      // Tylko cele przed nami
      if (Math.sign(dx) !== this.dir) continue;
      const dist = Math.abs(dx);
      if (dist < bestDist) { bestDist = dist; best = e; }
    }
    this._lockedTarget = best;
    if (best) this.targetX = best.x;
  }

  _explode() {
    this.exploded     = true;
    this.explodeTimer = 1.1;
  }

  destroy() { this.gfx.destroy(); }

  _draw() {
    this._drawSmoke();
    if (this.exploded) { this._drawExplosion(); return; }

    // Pod wodą — bąbelki startu
    if (this.y >= this.scene.SURFACE_Y && !this.surfaced) {
      const g = this.gfx;
      g.fillStyle(0xaaddff, 0.5);
      g.fillCircle(this.x, this.y, 7 + Math.random() * 3);
      return;
    }

    const angle = Math.atan2(this.vy, this.vx);
    const g = this.gfx;
    g.save();
    g.translateCanvas(this.x, this.y);
    g.rotateCanvas(angle);

    // Kadłub
    g.fillStyle(0xcccccc, 0.95);
    g.fillEllipse(0, 0, 32, 7);
    // Głowica
    g.fillStyle(0xff2200, 1);
    g.fillTriangle(16, 0, 11, -3.5, 11, 3.5);
    // Skrzydełka
    g.fillStyle(0x888888, 0.85);
    g.fillRect(-14, -7.5, 6, 3.5);
    g.fillRect(-14,  4.0, 6, 3.5);

    // Dysza
    const t       = Date.now() * 0.025;
    const flicker = 0.8 + Math.sin(t * 3.1) * 0.2;
    g.fillStyle(0xff6600, 1);
    g.fillCircle(-16, 0, 6.5 * flicker);
    g.fillStyle(0xffdd00, 0.9);
    g.fillCircle(-16, 0, 3.8 * flicker);
    g.fillStyle(0xffffff, 0.7 * flicker);
    g.fillCircle(-16, 0, 1.6);

    // Pióropusz ognia
    for (let i = 0; i < 6; i++) {
      const decay = 1 - i / 6;
      g.fillStyle(i < 2 ? 0xff8800 : 0xff4400, decay * 0.24 * flicker);
      g.fillCircle(-16 - i * 8, Math.sin(t * 1.7 + i) * 2.5, (8 + i * 3.5) * decay);
    }

    // Wskaźnik locka seekera (zielona obwódka z przodu)
    if (this._lockedTarget) {
      g.lineStyle(1, 0x44ff88, 0.70);
      g.strokeCircle(16, 0, 6);
    }

    g.restore();
  }

  _drawSmoke() {
    const g = this.gfx;
    for (const s of this.smoke) {
      const frac = Math.max(0, 1 - s.age / (s.splash ? 0.75 : 3.5));
      g.fillStyle(s.splash ? 0xaaddff : 0xbbbbbb, frac * (s.splash ? 0.55 : 0.16));
      g.fillCircle(s.x, s.y, s.r + s.age * (s.splash ? 12 : 5));
    }
  }

  _drawExplosion() {
    if (!this.exploded) return;
    const g    = this.gfx;
    const frac = this.explodeTimer / 1.1;
    const r    = (1 - frac) * BLAST_R * 2.8;

    g.lineStyle(4, 0xff6600, frac * 0.9);
    g.strokeCircle(this.x, this.y, r);
    g.lineStyle(2, 0xff2200, frac * 0.5);
    g.strokeCircle(this.x, this.y, r * 1.8);
    g.fillStyle(0xffee00, frac * 0.85);
    g.fillCircle(this.x, this.y, r * 0.42);

    for (let i = 0; i < 9; i++) {
      const a  = (i / 9) * Math.PI * 2;
      const dr = r * (0.65 + Math.random() * 0.7);
      g.fillStyle(0xff8800, frac * 0.60);
      g.fillCircle(this.x + Math.cos(a) * dr, this.y + Math.sin(a) * dr, 4.5);
    }
    // Kolumna dymu nad eksplozją
    g.fillStyle(0x888888, frac * 0.30);
    g.fillCircle(this.x, this.y - r * 0.7, r * 0.55);
    g.fillStyle(0x666666, frac * 0.20);
    g.fillCircle(this.x, this.y - r * 1.3, r * 0.38);
  }
}
