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
    this._decoyTarget = null;   // aktywna wabia na którą jest naprowadzona
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

    // ── Podsłuch akustyczny — sprawdź wabie i okręt ─────────────────────────
    const THERMO_Y    = this.scene.THERMO_Y;
    const noisemakers = (this.scene.sub && this.scene.sub.noisemakers) || [];

    // Znajdź najbliższą wabię akustyczną w zasięgu głowicy
    let bestDecoy = null;
    let bestDecoyDist = Infinity;
    for (const nm of noisemakers) {
      const nmDx = nm.x - this.x;
      const nmDy = nm.y - this.y;
      const nmDist = Math.sqrt(nmDx * nmDx + nmDy * nmDy);
      const crossThNm = (this.y < THERMO_Y) !== (nm.y < THERMO_Y);
      const nmSeekR = TORP_SEEKER_R * (crossThNm ? TORP_THERMO_M : 1) * nm.noise;
      if (nmDist < nmSeekR && nmDist < bestDecoyDist) {
        bestDecoy     = nm;
        bestDecoyDist = nmDist;
      }
    }

    // Jeśli poprzednia wabia wygasła — wyczyść referencję
    if (this._decoyTarget && this._decoyTarget.age >= this._decoyTarget.lifetime) {
      this._decoyTarget = null;
      this.phase  = 'search';
      this.locked = false;
    }

    // Jeśli wabia w zasięgu — przełącz naprowadzanie na nią
    if (bestDecoy) {
      this._decoyTarget = bestDecoy;
      if (this.phase !== 'homing') {
        this.phase  = 'homing';
        this.locked = true;
      }
    } else {
      // Brak wabii — sprawdź okręt
      this._decoyTarget = null;
      const dx   = sub.x - this.x;
      const dy   = sub.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const crossThermo = (this.y < THERMO_Y) !== (sub.y < THERMO_Y);
      const seekR = TORP_SEEKER_R * (crossThermo ? TORP_THERMO_M : 1)
                                  * Math.max(0.1, sub.noiseEffective * 4);

      if (dist < seekR && this.phase !== 'homing') {
        this.phase  = 'homing';
        this.locked = true;
      }
      if (dist > seekR * 1.4 && this.phase === 'homing') {
        this.phase  = 'search';
        this.locked = false;
      }
    }

    // Oblicz dx/dy do aktualnego celu (wabia lub okręt)
    const tgt    = this._decoyTarget || sub;
    const dx     = tgt.x - this.x;
    const dy     = tgt.y - this.y;
    const dist   = Math.sqrt(dx * dx + dy * dy);

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
        // Naprowadź na aktualny cel (wabia lub okręt)
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

    // Kolizja z terenem dna
    if (this.scene.floorAt) {
      const floorY = this.scene.floorAt(this.x);
      if (this.y >= floorY) {
        this._explode();
        this._draw();
        return;
      }
    }

    // Kolizja — jeśli śledzi wabię, eksploduje przy wabii (bez szkody dla okrętu)
    if (dist < 28) {
      if (this._decoyTarget) {
        // Wabia pochłonęła torpedę
        this._decoyTarget.age = this._decoyTarget.lifetime;  // zniszcz wabię
        this._explode();
      } else {
        const ratio = 1 - dist / 28;
        this.recentHit = { damage: 0.30 + ratio * 0.25 };
        this._explode();
      }
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

    // ── Ślad bąbelkowy ────────────────────────────────────────────────────────
    for (const p of this.trail) {
      const frac = Math.max(0, 1 - p.age / 1.6);
      g.fillStyle(0x5599bb, frac * 0.20);
      g.fillCircle(p.x, p.y, 1.8 + frac * 2.5);
      g.fillStyle(0xffffff, frac * 0.08);
      g.fillCircle(p.x, p.y, 0.8 + frac * 1.0);
    }

    // ── Wybuch ────────────────────────────────────────────────────────────────
    if (this.exploded) {
      const frac = Math.max(0, this.explodeTimer / 0.65);
      const r    = (1 - frac) * 75;

      // Flash
      if (frac > 0.80) {
        g.fillStyle(0xffffff, (frac - 0.80) / 0.20 * 0.85);
        g.fillCircle(this.x, this.y, r * 0.4 + 8);
      }
      // Kula ognia
      g.fillStyle(0xff8800, frac * 0.72);
      g.fillCircle(this.x, this.y, r * 0.50);
      g.fillStyle(0xffdd44, frac * 0.55);
      g.fillCircle(this.x, this.y, r * 0.28);

      // Fala uderzeniowa
      g.lineStyle(2.5, 0xff7700, frac * 0.82);
      g.strokeCircle(this.x, this.y, r);
      g.lineStyle(1.2, 0xff3300, frac * 0.38);
      g.strokeCircle(this.x, this.y, r * 1.55);

      // Bąble powietrza
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.fillStyle(0x88bbff, frac * 0.42);
        g.fillCircle(this.x + Math.cos(a) * r * 0.65, this.y + Math.sin(a) * r * 0.65, 3 + frac * 2.5);
      }
      return;
    }

    // ── Korpus Mk.44 ─────────────────────────────────────────────────────────
    g.save();
    g.translateCanvas(this.x, this.y);
    g.rotateCanvas(this.heading);

    const locked = this.locked;
    const decoy  = !!this._decoyTarget;

    // Obudowa silnika (tył)
    g.fillStyle(0x886600, 0.88);
    g.fillEllipse(-10, 0, 16, 7);

    // Kadłub główny — żółty/czerwony zależnie od stanu
    const bodyCol = locked ? (decoy ? 0xff6600 : 0xff3300) : 0xddaa00;
    g.fillStyle(bodyCol, 0.96);
    g.fillEllipse(2, 0, 28, 9);

    // Sekcja głowicy (jasniejsza)
    g.fillStyle(locked ? 0xff5500 : 0xeecc00, 0.92);
    g.fillEllipse(11, 0, 12, 9);

    // Głowica sonaru akustycznego (impeller)
    const impCol = locked ? (decoy ? 0xff9900 : 0xff3300) : 0x88ccff;
    g.fillStyle(impCol, 0.95);
    g.fillCircle(16, 0, 4.5);
    // Odblask
    g.fillStyle(0xffffff, 0.40);
    g.fillCircle(17, -1, 1.8);

    // Linia podziału sekcji
    g.lineStyle(0.8, 0x775500, 0.45);
    g.strokeLineShape(new Phaser.Geom.Line(3, -4, 3, 4));

    // Stery krzyżowe
    g.fillStyle(0x996600, 0.82);
    g.fillRect(-15, -7, 6, 3);
    g.fillRect(-15,  4, 6, 3);
    g.fillRect(-18, -2, 4, 5);

    // Pierścień + łopatki śruby
    g.lineStyle(1.2, 0x664400, 0.68);
    g.strokeCircle(-16, 0, 5);
    const pa = (Date.now() * 0.016) % (Math.PI * 2);
    g.lineStyle(1.5, 0x886622, 0.80);
    for (let i = 0; i < 3; i++) {
      const a = pa + (i * Math.PI * 2) / 3;
      g.strokeLineShape(new Phaser.Geom.Line(-16, 0, -16 + Math.cos(a) * 4.5, Math.sin(a) * 4.5));
    }

    g.restore();

    // ── Pierścień zasięgu głowicy ─────────────────────────────────────────────
    if (this.phase === 'search' || this.phase === 'homing') {
      const crossThermo = (this.y < this.scene.THERMO_Y);
      const rVis = Math.min(TORP_SEEKER_R * (crossThermo ? 0.4 : 1), 180);
      const ringCol = decoy ? 0xff9900 : (locked ? 0xff4400 : 0x44ffcc);
      g.lineStyle(0.9, ringCol, locked ? 0.38 : 0.10);
      g.strokeCircle(this.x, this.y, rVis);
    }
  }
}
