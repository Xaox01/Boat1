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

    this.bg          = scene.add.graphics().setDepth(0);
    this.skyOverlay  = scene.add.graphics().setDepth(1);   // dynamiczne niebo
    this.waveGfx     = scene.add.graphics().setDepth(4);
    this.darkOverlay = scene.add.graphics().setDepth(9);   // nocne przyciemnienie
    this.particles   = this._initParticles();
    this._stars      = this._buildStars();

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

    // Niebo (nadpisane przez skyOverlay każdą klatkę — brak koloru stałego)
    g.fillStyle(0x000c1a);
    g.fillRect(0, 0, W, SURFACE_Y);

    // Strefa epipelagiczna (powierzchnia → termoklina)
    g.fillGradientStyle(0x001e3d, 0x001e3d, 0x002a55, 0x002a55, 1);
    g.fillRect(0, SURFACE_Y, W, THERMO_Y - SURFACE_Y);

    // Warstwa termokliny
    g.fillStyle(0x0a4a60, 0.50);
    g.fillRect(0, THERMO_Y - 3, W, 12);

    // Strefa mezopelelagiczna
    g.fillGradientStyle(0x001830, 0x001830, 0x000308, 0x000308, 1);
    g.fillRect(0, THERMO_Y, W, H - THERMO_Y);

    // Wielokąt terenu
    g.fillStyle(0x1c1008);
    g.beginPath();
    g.moveTo(0, H);
    g.lineTo(0, this._sampleAt(0));
    for (let x = STEP; x <= W; x += STEP) g.lineTo(x, this._sampleAt(x));
    g.lineTo(W, H);
    g.closePath();
    g.fillPath();

    // Tekstura powierzchni dna
    for (let x = 0; x <= W; x += 26) {
      const fy = this._sampleAt(x);
      const bh = 4 + Math.sin(x * 0.09) * 3 + Math.sin(x * 0.23) * 2;
      g.fillStyle(0x3c2810, 0.75);
      g.fillRect(x, fy, 17, Math.max(2, bh));
    }

    // Skały i seamounty
    const ROCK_THRESHOLD = SURFACE_Y + 415;
    for (let x = 220; x < W - 80; x += 660 + Math.abs(Math.sin(x * 0.0031)) * 580) {
      const fy = this._sampleAt(x);
      if (fy < ROCK_THRESHOLD) {
        const rh = Math.min(70, (ROCK_THRESHOLD - fy) * 0.78 + 18);
        g.fillStyle(0x352015, 0.95);
        g.fillTriangle(x - 32, fy + 1, x + 32, fy + 1, x, fy - rh);
        g.fillStyle(0x503a25, 0.68);
        g.fillTriangle(x - 10, fy + 1, x + 28, fy + 1, x + 10, fy - rh * 0.70);
        if (x + 60 < W) {
          g.fillStyle(0x352015, 0.80);
          g.fillTriangle(x + 30, fy + 1, x + 58, fy + 1, x + 44, fy - rh * 0.44);
        }
        g.fillStyle(0x3a2208, 0.50);
        g.fillEllipse(x, fy + 3, 80, 10);
      }
    }

    // Linijka głębokości
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

  // ── Gwiazdy (predefiniowane — brak random każdą klatkę) ──────────────────

  _buildStars() {
    return Array.from({ length: 58 }, (_, i) => ({
      x:     ((Math.sin(i * 2.31 + 0.73) + 1) / 2) * this.CAM_W,
      y:     Math.abs(Math.sin(i * 3.14 + 1.22)) * (this.SURFACE_Y - 7),
      r:     0.5 + Math.abs(Math.sin(i * 5.77)) * 1.4,
      phase: Math.sin(i * 7.31),
    }));
  }

  // ── Cykl dnia i nocy — paleta kolorów ────────────────────────────────────

  _lerpCol(a, b, t) {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    return ((ar + (br - ar) * t) | 0) << 16
         | ((ag + (bg - ag) * t) | 0) <<  8
         | ((ab + (bb - ab) * t) | 0);
  }

  _getDayPalette(dt) {
    // Klatki kluczowe: [pora, kolor_nieba_góra, kolor_nieba_dół, kolor_fal, ciemność]
    const K = [
      { t: 0.00, top: 0x000206, bot: 0x000c1a, wave: 0x193058, dark: 0.32 },
      { t: 0.21, top: 0x040118, bot: 0x0a0828, wave: 0x1a2a55, dark: 0.26 },
      { t: 0.27, top: 0xcc3311, bot: 0xff9933, wave: 0xff8844, dark: 0.04 },
      { t: 0.33, top: 0x2255cc, bot: 0x77bbff, wave: 0x66ccff, dark: 0.00 },
      { t: 0.50, top: 0x1155aa, bot: 0x44aaff, wave: 0x55d8ff, dark: 0.00 },
      { t: 0.67, top: 0x1a5599, bot: 0x55aaee, wave: 0x44ccff, dark: 0.00 },
      { t: 0.73, top: 0xcc3311, bot: 0xff9933, wave: 0xffaa55, dark: 0.04 },
      { t: 0.79, top: 0x040118, bot: 0x0a0820, wave: 0x1a2a4a, dark: 0.26 },
      { t: 1.00, top: 0x000206, bot: 0x000c1a, wave: 0x193058, dark: 0.32 },
    ];

    const n = ((dt % 1) + 1) % 1;
    let k0 = K[0], k1 = K[K.length - 1];
    for (let i = 0; i < K.length - 1; i++) {
      if (n >= K[i].t && n < K[i + 1].t) { k0 = K[i]; k1 = K[i + 1]; break; }
    }
    const raw = k1.t > k0.t ? (n - k0.t) / (k1.t - k0.t) : 0;
    const s   = raw * raw * (3 - 2 * raw);   // smoothstep
    return {
      top:  this._lerpCol(k0.top,  k1.top,  s),
      bot:  this._lerpCol(k0.bot,  k1.bot,  s),
      wave: this._lerpCol(k0.wave, k1.wave, s),
      dark: k0.dark + (k1.dark - k0.dark) * s,
      n,
    };
  }

  // ── Rysowanie nieba (screen-space) ────────────────────────────────────────

  _drawSky(g, pal) {
    const { CAM_W, SURFACE_Y } = this;
    const { top, bot, dark, n } = pal;

    // Gradient nieba
    g.fillGradientStyle(top, top, bot, bot, 1.0);
    g.fillRect(0, 0, CAM_W, SURFACE_Y);

    // Gwiazdy (widoczne w nocy)
    if (dark > 0.06) {
      const starA = Math.min(1, dark * 3.2);
      const ts    = Date.now() * 0.001;
      for (const s of this._stars) {
        const tw = 0.75 + 0.25 * Math.sin(ts * 1.8 + s.phase * 4.5);
        g.fillStyle(0xddeeff, starA * tw * 0.88);
        g.fillCircle(s.x, s.y, s.r);
      }
    }

    // Słońce / księżyc — ten sam arc przez cały dzień (n=0→1)
    const bodyX   = CAM_W * n;
    const bodyArc = Math.sin(n * Math.PI);               // 0 na horyzontach, 1 w zenicie
    const bodyY   = SURFACE_Y * 0.90 - bodyArc * (SURFACE_Y * 0.82);
    const isDay   = n > 0.265 && n < 0.735;

    if (isDay) {
      const noon  = Math.sin((n - 0.265) / 0.47 * Math.PI);   // 0 horyzonty, 1 południe
      const sunR  = 7  + (1 - noon) * 6;
      const haloR = 15 + (1 - noon) * 20;
      const haloA = 0.18 + (1 - noon) * 0.32;
      g.fillStyle(noon > 0.55 ? 0xffff88 : 0xff9933, haloA);
      g.fillCircle(bodyX, bodyY, haloR);
      g.fillStyle(noon > 0.55 ? 0xffffcc : 0xffbb55, 0.92);
      g.fillCircle(bodyX, bodyY, sunR);
    } else {
      // Księżyc
      g.fillStyle(0xdde8ff, 0.16);
      g.fillCircle(bodyX, bodyY, 12);
      g.fillStyle(0xeeeeff, 0.80);
      g.fillCircle(bodyX, bodyY, 6);
      // Delikatna poświata wokół księżyca
      g.fillStyle(0xaabbdd, 0.06);
      g.fillCircle(bodyX, bodyY, 20);
    }

    // Linia horyzontu (świetlny kontur między niebem a wodą)
    g.lineStyle(1.2, top, 0.40);
    g.strokeLineShape(new Phaser.Geom.Line(0, SURFACE_Y - 1, CAM_W, SURFACE_Y - 1));
  }

  // ── Aktualizacja (każda klatka) ───────────────────────────────────────────

  update(delta, camX, dayTime = 0) {
    const dt  = delta / 1000;
    const pal = this._getDayPalette(dayTime);
    const g   = this.waveGfx;
    const CW  = this.CAM_W;
    const t   = Date.now() * 0.001;

    // ── Niebo (screen-space — nie przesuwane z kamerą) ────────────────────
    this.skyOverlay.clear();
    this._drawSky(this.skyOverlay, pal);

    // ── Nocne przyciemnienie (screen-space) ───────────────────────────────
    this.darkOverlay.clear();
    if (pal.dark > 0.01) {
      this.darkOverlay.fillStyle(0x000008, pal.dark);
      this.darkOverlay.fillRect(0, 0, CW, this.scene.scale.height);
    }

    // ── Fala powierzchniowa ───────────────────────────────────────────────
    g.clear();
    g.lineStyle(1.8, pal.wave, 0.82);
    g.beginPath();
    const ws = camX - 4, we = camX + CW + 8;
    for (let x = ws; x <= we; x += 4) {
      const wy = this.SURFACE_Y
        + Math.sin(x * 0.018 + t) * 4
        + Math.sin(x * 0.040 + t * 1.5) * 2;
      x === ws ? g.moveTo(x, wy) : g.lineTo(x, wy);
    }
    g.strokePath();

    // ── Cząsteczki ────────────────────────────────────────────────────────
    for (const p of this.particles) {
      p.y += p.vy * dt;
      if (p.y < this.SURFACE_Y || p.y > this._sampleAt(p.x)) {
        p.y = this._sampleAt(p.x) - 10 - Math.random() * 40;
        p.x = Math.random() * this.W;
      }
      if (p.x >= camX - 100 && p.x <= camX + CW + 100) {
        g.fillStyle(pal.wave, p.alpha * 1.4);
        g.fillCircle(p.x, p.y, p.size);
      }
    }

    // ── Poświata termokliny ───────────────────────────────────────────────
    const thermoCol  = pal.dark < 0.08 ? 0x00bbdd : 0x004a88;
    const thermoAlph = 0.18 + Math.sin(t * 2) * 0.07;
    g.lineStyle(1.5, thermoCol, thermoAlph);
    g.strokeLineShape(
      new Phaser.Geom.Line(camX, this.THERMO_Y + 3, camX + CW, this.THERMO_Y + 3)
    );
  }
}
