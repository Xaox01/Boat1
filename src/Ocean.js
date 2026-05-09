import Phaser from 'phaser';

const STEP = 8;   // px między próbkami terenu

export class Ocean {
  constructor(scene) {
    this.scene     = scene;
    this.W         = scene.WORLD_W;
    this.CAM_W     = scene.sys.game.config.width;
    this.SURFACE_Y = scene.SURFACE_Y;
    this.THERMO_Y  = scene.THERMO_Y;
    this.FLOOR_Y   = scene.OCEAN_FLOOR_Y;

    // Generuj teren i udostępnij przez scene.floorAt(x)
    this._samples = this._buildTerrain();
    scene.floorAt = (x) => this._sampleAt(x);

    this.bg      = scene.add.graphics().setDepth(0);
    this.waveGfx = scene.add.graphics().setDepth(2);
    this.particles = this._initParticles();

    this._bakeBg();
  }

  // ── Proceduralny teren ────────────────────────────────────────────────────

  _buildTerrain() {
    const n    = Math.ceil(this.W / STEP) + 4;
    const arr  = new Float32Array(n);
    const BASE = this.SURFACE_Y + 365;
    for (let i = 0; i < n; i++) {
      const x = i * STEP;
      arr[i] = BASE
        + Math.sin(x * 0.000 + 0.31)  * 0    // placeholder — replaced below
        // 6 oktaw — różne okresy przestrzenne
        + Math.sin(x * 0.00040 + 0.31) * 78   // ~15 700px okres — długie wzniesienia
        + Math.sin(x * 0.00170 + 1.74) * 48   // ~3 700px — grzbiety
        + Math.sin(x * 0.00680 + 4.21) * 24   // ~925px — pagórki
        + Math.sin(x * 0.02100 + 2.11) * 12   // ~300px — drobne nierówności
        + Math.sin(x * 0.06500 + 0.88) *  5   // ~96px — faktury
        + Math.sin(x * 0.19000 + 3.55) *  2;  // ~33px — ziarnistość
      arr[i] -= Math.sin(x * 0.00040 + 0.31) * 0;   // zero out the placeholder
    }
    // Napraw placeholder (sinus był powtórzony — usuń duplikat)
    for (let i = 0; i < n; i++) {
      const x = i * STEP;
      arr[i] = BASE
        + Math.sin(x * 0.00040 + 0.31) * 78
        + Math.sin(x * 0.00170 + 1.74) * 48
        + Math.sin(x * 0.00680 + 4.21) * 24
        + Math.sin(x * 0.02100 + 2.11) * 12
        + Math.sin(x * 0.06500 + 0.88) *  5
        + Math.sin(x * 0.19000 + 3.55) *  2;
    }
    return arr;
  }

  _sampleAt(worldX) {
    const raw = Math.max(0, worldX) / STEP;
    const i0  = Math.min(Math.floor(raw), this._samples.length - 2);
    const t   = raw - i0;
    return this._samples[i0] * (1 - t) + this._samples[i0 + 1] * t;
  }

  // ── Statyczne tło (rysowane raz) ─────────────────────────────────────────

  _bakeBg() {
    const g  = this.bg;
    const { W, SURFACE_Y, THERMO_Y, FLOOR_Y } = this;
    const H  = this.scene.scale.height + 30;

    // Niebo
    g.fillStyle(0x000c1a);
    g.fillRect(0, 0, W, SURFACE_Y);

    // Strefa epipelagiczna (powierzchnia → termoklina) — ciemny niebieski
    g.fillGradientStyle(0x001e3d, 0x001e3d, 0x002a55, 0x002a55, 1);
    g.fillRect(0, SURFACE_Y, W, THERMO_Y - SURFACE_Y);

    // Warstwa termokliny — subtelna granica
    g.fillStyle(0x0a4a60, 0.50);
    g.fillRect(0, THERMO_Y - 3, W, 12);

    // Strefa mezopelelagiczna — coraz ciemniej w głębinach
    g.fillGradientStyle(0x001830, 0x001830, 0x000308, 0x000308, 1);
    g.fillRect(0, THERMO_Y, W, H - THERMO_Y);

    // ── Wielokąt terenu ───────────────────────────────────────────────────
    g.fillStyle(0x1c1008);
    g.beginPath();
    g.moveTo(0, H);
    g.lineTo(0, this._sampleAt(0));
    for (let x = STEP; x <= W; x += STEP) {
      g.lineTo(x, this._sampleAt(x));
    }
    g.lineTo(W, H);
    g.closePath();
    g.fillPath();

    // ── Tekstura powierzchni dna ──────────────────────────────────────────
    for (let x = 0; x <= W; x += 26) {
      const fy = this._sampleAt(x);
      const bh = 4 + Math.sin(x * 0.09) * 3 + Math.sin(x * 0.23) * 2;
      g.fillStyle(0x3c2810, 0.75);
      g.fillRect(x, fy, 17, Math.max(2, bh));
    }

    // ── Skały i seamounty na wzniesienach ─────────────────────────────────
    const ROCK_THRESHOLD = SURFACE_Y + 415;
    for (let x = 220; x < W - 80; x += 660 + Math.abs(Math.sin(x * 0.0031)) * 580) {
      const fy = this._sampleAt(x);
      if (fy < ROCK_THRESHOLD) {
        const rh = Math.min(70, (ROCK_THRESHOLD - fy) * 0.78 + 18);

        // Główna iglica
        g.fillStyle(0x352015, 0.95);
        g.fillTriangle(x - 32, fy + 1, x + 32, fy + 1, x, fy - rh);
        // Rozjaśniona ściana
        g.fillStyle(0x503a25, 0.68);
        g.fillTriangle(x - 10, fy + 1, x + 28, fy + 1, x + 10, fy - rh * 0.70);
        // Mała boczna skała
        if (x + 60 < W) {
          g.fillStyle(0x352015, 0.80);
          g.fillTriangle(x + 30, fy + 1, x + 58, fy + 1, x + 44, fy - rh * 0.44);
        }
        // Osad wokół podstawy
        g.fillStyle(0x3a2208, 0.50);
        g.fillEllipse(x, fy + 3, 80, 10);
      }
    }

    // ── Linijka głębokości (lewa krawędź) ────────────────────────────────
    g.lineStyle(1, 0x246655, 0.70);
    const pxPerM = (FLOOR_Y - SURFACE_Y) / 600;
    for (let m = 0; m <= 600; m += 50) {
      const ry = SURFACE_Y + m * pxPerM;
      g.strokeLineShape(new Phaser.Geom.Line(0, ry, m % 200 === 0 ? 22 : 10, ry));
    }
  }

  // ── Cząsteczki ────────────────────────────────────────────────────────────

  _initParticles() {
    const list = [];
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * this.W;
      list.push({
        x,
        y:     this.SURFACE_Y + Math.random() * (this._sampleAt(x) - this.SURFACE_Y),
        vy:    -5 - Math.random() * 7,
        alpha: 0.04 + Math.random() * 0.14,
        size:  0.5 + Math.random() * 1.5,
      });
    }
    return list;
  }

  // ── Aktualizacja (każda klatka) ───────────────────────────────────────────

  update(delta, camX) {
    const dt  = delta / 1000;
    const g   = this.waveGfx;
    const CW  = this.CAM_W;
    g.clear();

    const t = Date.now() * 0.001;

    // Fala powierzchniowa — tylko widoczny odcinek
    g.lineStyle(1.8, 0x55d8ff, 0.85);
    g.beginPath();
    const ws = camX - 4;
    const we = camX + CW + 8;
    for (let x = ws; x <= we; x += 4) {
      const wy = this.SURFACE_Y
        + Math.sin(x * 0.018 + t) * 4
        + Math.sin(x * 0.040 + t * 1.5) * 2;
      x === ws ? g.moveTo(x, wy) : g.lineTo(x, wy);
    }
    g.strokePath();

    // Cząsteczki — tylko w pobliżu kamery
    for (const p of this.particles) {
      p.y += p.vy * dt;
      if (p.y < this.SURFACE_Y || p.y > this._sampleAt(p.x)) {
        p.y = this._sampleAt(p.x) - 10 - Math.random() * 40;
        p.x = Math.random() * this.W;
      }
      if (p.x >= camX - 100 && p.x <= camX + CW + 100) {
        g.fillStyle(0x88ccee, p.alpha * 1.5);
        g.fillCircle(p.x, p.y, p.size);
      }
    }

    // Poświata termokliny
    g.lineStyle(1.5, 0x00bbdd, 0.18 + Math.sin(t * 2) * 0.07);
    g.strokeLineShape(new Phaser.Geom.Line(camX, this.THERMO_Y + 3, camX + CW, this.THERMO_Y + 3));
  }
}
