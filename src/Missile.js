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
    this.gfx     = scene.add.graphics().setDepth(3);

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
    this.exploded        = false;
    this.explodeTimer    = 0;
    this.dead            = false;
    this.recentHit       = null;
    this.recentExplosion = false;

    this._lockedTarget = null;   // aktualnie śledzona jednostka
    this.smoke         = [];
  }

  update(dt, surfaceEnemies) {
    this.recentHit       = null;
    this.recentExplosion = false;

    if (this.exploded) {
      this.explodeTimer -= dt;
      if (this.explodeTimer <= 0) this.dead = true;
      this._drawSmoke();
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
    if (this.exploded) return;
    this.exploded        = true;
    this.explodeTimer    = 1.1;
    this.recentExplosion = true;
  }

  destroy() { this.gfx.destroy(); }

  _draw() {
    this._drawSmoke();
    if (this.exploded) return;

    // Pod wodą — bąbelki startu
    if (this.y >= this.scene.SURFACE_Y && !this.surfaced) {
      const g = this.gfx;
      g.fillStyle(0xaaddff, 0.5);
      g.fillCircle(this.x, this.y, 7 + Math.random() * 3);
      return;
    }

    // Rozprysk wody przy sea-skimmingu (gdy bardzo blisko powierzchni)
    const SURF = this.scene.SURFACE_Y;
    if (this.phase === 'cruise' && this.y > SURF - 14) {
      const g = this.gfx;
      if (Math.random() < 0.45) {
        const sx = this.x - this.dir * Phaser.Math.Between(4, 14);
        g.fillStyle(0xaaddee, 0.30 + Math.random() * 0.20);
        g.fillCircle(sx, SURF + Phaser.Math.Between(-2, 2), Phaser.Math.Between(2, 5));
      }
    }

    const angle = Math.atan2(this.vy, this.vx);
    const g = this.gfx;
    g.save();
    g.translateCanvas(this.x, this.y);
    g.rotateCanvas(angle);

    // ── Kadłub rakiety ────────────────────────────────────────────────────────
    // Tył — sekcja silnika (ciemniejsza)
    g.fillStyle(0x999999, 0.90);
    g.fillEllipse(-8, 0, 18, 7);

    // Środkowy kadłub
    g.fillStyle(0xdddddd, 0.95);
    g.fillEllipse(4, 0, 28, 8);

    // Sekcja bojowa (przednia)
    g.fillStyle(0xcccccc, 0.92);
    g.fillEllipse(12, 0, 16, 8);

    // ── Głowica ───────────────────────────────────────────────────────────────
    g.fillStyle(0xcc2200, 1);
    g.fillTriangle(20, 0, 14, -4, 14, 4);
    // Odblask na głowicy
    g.fillStyle(0xff5533, 0.55);
    g.fillTriangle(20, 0, 14, -4, 18, -1);

    // Linia podziału kadłuba
    g.lineStyle(1, 0x888888, 0.35);
    g.strokeLineShape(new Phaser.Geom.Line(0, -4, 0, 4));

    // ── Skrzydełka delta ──────────────────────────────────────────────────────
    g.fillStyle(0x777788, 0.88);
    g.fillTriangle(-16, -4, -6, -4, -16, -10);   // górne
    g.fillTriangle(-16,  4, -6,  4, -16,  10);   // dolne

    // ── Stateczniki ogonowe ───────────────────────────────────────────────────
    g.fillStyle(0x666677, 0.82);
    g.fillRect(-20, -7, 6, 3);
    g.fillRect(-20,  4, 6, 3);

    // ── Dysza — animowany ogień ───────────────────────────────────────────────
    const t       = Date.now() * 0.022;
    const flicker = 0.82 + Math.sin(t * 3.4) * 0.18;

    // Pierścień dyszy
    g.fillStyle(0x664400, 0.85);
    g.fillCircle(-18, 0, 5);

    // Rdzeń ognia
    g.fillStyle(0xffffff, 0.85 * flicker);
    g.fillCircle(-19, 0, 2.2 * flicker);
    g.fillStyle(0xffee44, 0.90 * flicker);
    g.fillCircle(-20, 0, 3.5 * flicker);
    g.fillStyle(0xff8800, 1.0);
    g.fillCircle(-21, 0, 5.5 * flicker);

    // Pióropusz ognia (6 warstw)
    for (let i = 0; i < 7; i++) {
      const decay  = 1 - i / 7;
      const wobble = Math.sin(t * 1.8 + i * 1.1) * 2.5;
      g.fillStyle(i < 2 ? 0xff9900 : 0xff4400, decay * 0.22 * flicker);
      g.fillCircle(-21 - i * 7, wobble, (7 + i * 3.5) * decay);
    }

    // Wskaźnik locka (zielona obwódka)
    if (this._lockedTarget) {
      g.lineStyle(1.2, 0x44ff88, 0.75);
      g.strokeCircle(18, 0, 6);
    }

    g.restore();
  }

  _drawSmoke() {
    const g = this.gfx;
    for (const s of this.smoke) {
      const frac = Math.max(0, 1 - s.age / (s.splash ? 0.65 : 3.8));
      const col  = s.splash ? 0xaaddff : (s.age < 0.5 ? 0xddddcc : 0x888888);
      g.fillStyle(col, frac * (s.splash ? 0.55 : 0.14));
      g.fillCircle(s.x, s.y, s.r + s.age * (s.splash ? 14 : 5));
    }
  }

  _drawExplosion() {
    if (!this.exploded) return;
    const g    = this.gfx;
    const frac = this.explodeTimer / 1.1;
    const r    = (1 - frac) * BLAST_R * 3.0;
    const cx   = this.x;
    const cy   = this.y;

    // Flash centralny (błysk przy trafieniu)
    if (frac > 0.88) {
      const ff = (frac - 0.88) / 0.12;
      g.fillStyle(0xffffff, ff * 0.95);
      g.fillCircle(cx, cy, r * 0.35 + 12);
    }

    // Kula ognia — 3 warstwy
    g.fillStyle(0xff9900, frac * 0.80);
    g.fillCircle(cx, cy, r * 0.55);
    g.fillStyle(0xff5500, frac * 0.65);
    g.fillCircle(cx, cy, r * 0.38);
    g.fillStyle(0xffee44, frac * 0.60);
    g.fillCircle(cx, cy, r * 0.20);

    // Fala uderzeniowa główna
    g.lineStyle(3.5, 0xff7700, frac * 0.85);
    g.strokeCircle(cx, cy, r);

    // Zewnętrzna fala (szybsza, cieńsza)
    g.lineStyle(1.5, 0xff4400, frac * 0.45);
    g.strokeCircle(cx, cy, r * 1.6);

    // Trzecia fala (najsłabsza, najdalsza)
    if (frac < 0.7) {
      g.lineStyle(1, 0xdd2200, (0.7 - frac) / 0.7 * 0.25);
      g.strokeCircle(cx, cy, r * 2.3);
    }

    // Odłamki (8 punktów wylatujących po spirali)
    for (let i = 0; i < 8; i++) {
      const a  = (i / 8) * Math.PI * 2 + (1 - frac) * 0.8;
      const dr = r * (0.7 + (i % 3) * 0.22);
      g.fillStyle(0xff8800, frac * 0.65);
      g.fillCircle(cx + Math.cos(a) * dr, cy + Math.sin(a) * dr, 4 + (i % 2) * 2);
    }

    // Kolumna dymu / ognia nad eksplozją
    const smokeH = r * 1.2;
    g.fillStyle(0x886644, frac * 0.40);
    g.fillCircle(cx, cy - smokeH * 0.5, r * 0.60);
    g.fillStyle(0x665533, frac * 0.30);
    g.fillCircle(cx, cy - smokeH * 1.0, r * 0.44);
    g.fillStyle(0x554433, frac * 0.20);
    g.fillCircle(cx, cy - smokeH * 1.5, r * 0.30);
  }
}
