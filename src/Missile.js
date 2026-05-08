import Phaser from 'phaser';

const SPEED      = 380;   // px/s
const CRUISE_ALT = 50;    // px ponad taflą podczas lotu
const BLAST_R    = 75;
const MAX_RANGE  = 1800;

export class Missile {
  constructor(scene, x, y, targetX) {
    this.scene   = scene;
    this.gfx     = scene.add.graphics();

    this.x = x;
    this.y = y;
    this.startX  = x;
    this.targetX = targetX;

    const SURF   = scene.SURFACE_Y;
    this.cruiseY = SURF - CRUISE_ALT;

    this.dir = Math.sign(targetX - x) || 1;
    this.vx  = this.dir * SPEED;
    this.vy  = -280;   // silny impuls pionowy przy starcie

    this.phase        = 'boost';
    this.surfaced     = false;
    this.exploded     = false;
    this.explodeTimer = 0;
    this.dead         = false;
    this.recentHit    = null;

    this.smoke = [];
  }

  update(dt, surfaceEnemies) {
    this.recentHit = null;

    if (this.exploded) {
      this.explodeTimer -= dt;
      if (this.explodeTimer <= 0) this.dead = true;
      this._draw();
      return;
    }

    const SURF = this.scene.SURFACE_Y;

    switch (this.phase) {
      case 'boost': {
        // Wspinaj się proporcjonalnie do błędu wysokości
        const err = this.cruiseY - this.y;
        this.vy  += err * 10 * dt;
        this.vy   = Math.max(this.vy, -300);
        if (this.y <= this.cruiseY + 5) {
          this.phase = 'cruise';
          this.vy    = 0;
        }
        break;
      }
      case 'cruise': {
        // Utrzymuj wysokość przelotową
        this.vy += (this.cruiseY - this.y) * 8 * dt;
        this.vy  = Phaser.Math.Clamp(this.vy, -70, 70);
        if (Math.abs(this.targetX - this.x) < 140) this.phase = 'terminal';
        break;
      }
      case 'terminal': {
        // Jeśli minęliśmy cel — samozniszczenie
        const dxToTarget = this.targetX - this.x;
        if (Math.sign(dxToTarget) !== this.dir) {
          this._explode();
          break;
        }
        // Nurkuje stromo na cel przy powierzchni (linia wody - 3px)
        const distH = Math.abs(dxToTarget);
        const tLeft = Math.max(distH / SPEED, 0.01);
        this.vy = (SURF - 3 - this.y) / tLeft;
        this.vy = Phaser.Math.Clamp(this.vy, -60, 600);
        break;
      }
    }

    const prevY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Efekt plask przy przebiciu tafli od dołu
    if (!this.surfaced && prevY >= SURF && this.y < SURF) {
      this.surfaced = true;
      for (let i = 0; i < 8; i++) {
        this.smoke.push({
          x: this.x + Phaser.Math.Between(-15, 15),
          y: SURF,
          age: 0, r: 5 + Math.random() * 4, splash: true,
        });
      }
    }

    // Smuga dymu/ognia (co drugą klatkę dla wydajności)
    if (Math.random() < 0.65)
      this.smoke.push({ x: this.x, y: this.y, age: 0, r: 2 + Math.random() * 1.5 });
    if (this.smoke.length > 55) this.smoke.shift();
    for (const s of this.smoke) s.age += dt;

    // Wykrywanie trafień w okręty nawodne
    for (const enemy of surfaceEnemies) {
      if (enemy.destroyed) continue;
      if (Math.abs(enemy.x - this.x) < 52 && Math.abs(enemy.y - this.y) < 34) {
        this.recentHit = { enemy, damage: 0.50 + Math.random() * 0.22 };
        this._explode();
        this._draw();
        return;
      }
    }

    const traveled = Math.abs(this.x - this.startX);
    if (traveled > MAX_RANGE)                             this._explode();
    if (this.y > SURF + 16 && this.phase !== 'boost')    this._explode();

    this._draw();
  }

  _explode() {
    this.exploded     = true;
    this.explodeTimer = 0.90;
  }

  destroy() {
    this.gfx.destroy();
  }

  _draw() {
    const g = this.gfx;
    g.clear();

    // Smuga dymu
    for (const s of this.smoke) {
      const frac = Math.max(0, 1 - s.age / (s.splash ? 0.7 : 3.0));
      g.fillStyle(s.splash ? 0xaaddff : 0xbbbbbb, frac * (s.splash ? 0.6 : 0.18));
      g.fillCircle(s.x, s.y, s.r + s.age * (s.splash ? 10 : 5));
    }

    if (this.exploded) {
      const frac = this.explodeTimer / 0.90;
      const r    = (1 - frac) * BLAST_R * 2.6;
      g.lineStyle(4, 0xff6600, frac * 0.9);
      g.strokeCircle(this.x, this.y, r);
      g.lineStyle(2, 0xff2200, frac * 0.55);
      g.strokeCircle(this.x, this.y, r * 1.7);
      g.fillStyle(0xffee00, frac * 0.80);
      g.fillCircle(this.x, this.y, r * 0.40);
      for (let i = 0; i < 7; i++) {
        const a  = (i / 7) * Math.PI * 2;
        const dr = r * (0.7 + Math.random() * 0.6);
        g.fillStyle(0xff8800, frac * 0.65);
        g.fillCircle(this.x + Math.cos(a) * dr, this.y + Math.sin(a) * dr, 4);
      }
      return;
    }

    // Faza podwodna — tylko bąbelki
    if (this.y >= this.scene.SURFACE_Y && !this.surfaced) {
      g.fillStyle(0xaaddff, 0.5);
      g.fillCircle(this.x, this.y, 6 + Math.random() * 3);
      return;
    }

    const angle = Math.atan2(this.vy, this.vx);
    g.save();
    g.translateCanvas(this.x, this.y);
    g.rotateCanvas(angle);

    g.fillStyle(0xcccccc, 0.95);
    g.fillEllipse(0, 0, 30, 7);

    g.fillStyle(0xff2200, 1);
    g.fillTriangle(15, 0, 10, -3.5, 10, 3.5);

    g.fillStyle(0x888888, 0.85);
    g.fillRect(-13, -6.5, 5, 3.5);
    g.fillRect(-13,  3.0, 5, 3.5);

    // Dysza silnika
    const t = Date.now() * 0.025;
    const flicker = 0.8 + Math.sin(t * 3.1) * 0.2;
    g.fillStyle(0xff6600, 1);
    g.fillCircle(-15, 0, 6 * flicker);
    g.fillStyle(0xffdd00, 0.95);
    g.fillCircle(-15, 0, 3.5 * flicker);
    g.fillStyle(0xffffff, 0.7 * flicker);
    g.fillCircle(-15, 0, 1.5);

    // Plama ciepła — wydłużona struga ognia
    for (let i = 0; i < 5; i++) {
      const decay = 1 - i / 5;
      g.fillStyle(i < 2 ? 0xff8800 : 0xff4400, decay * 0.22 * flicker);
      g.fillCircle(-15 - i * 7, Math.sin(t * 1.7 + i) * 2, (7 + i * 3) * decay);
    }

    g.restore();
  }
}
