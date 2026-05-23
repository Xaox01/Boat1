import Phaser from 'phaser';

const STEP = 8;   // px między próbkami terenu
const P    = 2;   // rozmiar bloku pixel-art

// Paleta pixel-art (z pliku design "Dno Oceanu Pixel")
const PAL = {
  sand1:    0x7a6d4a,
  sand2:    0x5a5034,
  sand3:    0x3e3622,
  sand4:    0x2a2418,
  glow:     0x5fcf7a,
  glowDim:  0x2a5a3a,
  plankton: 0x3a6a7a,
  bubble:   0xd4e0e8,
  bubbleD:  0x8aa0b0,
};

export class Ocean {
  constructor(scene) {
    this.scene     = scene;
    this.W         = scene.WORLD_W;
    this.CAM_W     = scene.sys.game.config.width;
    this.SURFACE_Y = scene.SURFACE_Y;
    this.THERMO_Y  = scene.THERMO_Y;
    this.FLOOR_Y   = scene.OCEAN_FLOOR_Y;

    this._samples = this._buildTerrain();
    scene.floorAt = (x) => this._sampleAt(x);

    this.bg          = scene.add.graphics().setDepth(0);
    this.skyOverlay  = scene.add.graphics().setDepth(1);
    this.floorGfx    = scene.add.graphics().setDepth(2);
    this.waveGfx     = scene.add.graphics().setDepth(4);
    this.darkOverlay = scene.add.graphics().setDepth(9);
    this.particles   = this._initParticles();
    this._bubbles    = this._initBubbles();
    this._stars      = this._buildStars();
    this._glowSpots  = this._buildGlowSpots();
    this._rocks      = this._buildRocks();

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

  // Hash deterministyczny do dithering / rozmieszczeń
  _hash(x, y) {
    const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }

  // ── Skały (pre-generowane, rysowane per-klatka tylko widoczne) ────────────

  _buildRocks() {
    const list   = [];
    const THRESH = this.SURFACE_Y + 415;

    // Duże seamounty — co 660–1240 px
    for (let x = 220; x < this.W - 80; x += 660 + Math.abs(Math.sin(x * 0.0031)) * 580) {
      const fy = this._sampleAt(x);
      if (fy < THRESH) {
        const rh = Math.min(70, (THRESH - fy) * 0.78 + 18) | 0;
        list.push({ wx: x, fy, rh, kind: 'mount' });
      }
    }

    // Małe kamienie proceduralne
    for (let i = 0; i < 140; i++) {
      const wx = (this._hash(i, 500) * this.W) | 0;
      const fy = this._sampleAt(wx);
      list.push({
        wx, fy,
        sz:   1 + (this._hash(i, 501) * 5) | 0,
        kind: 'rock',
        seed: i,
      });
    }
    return list;
  }

  // ── Tło statyczne ─────────────────────────────────────────────────────────

  _bakeBg() {
    const g  = this.bg;
    const { W, SURFACE_Y, THERMO_Y, FLOOR_Y } = this;
    const H  = this.scene.scale.height + 30;

    // Niebo
    g.fillStyle(0x001428);
    g.fillRect(0, 0, W, SURFACE_Y);

    // Strefa epipelagiczna
    g.fillGradientStyle(0x00558a, 0x00558a, 0x0072a8, 0x0072a8, 1);
    g.fillRect(0, SURFACE_Y, W, THERMO_Y - SURFACE_Y);

    // Warstwa termokliny
    g.fillStyle(0x2a8898, 0.55);
    g.fillRect(0, THERMO_Y - 3, W, 12);

    // Strefa mezopelelagiczna
    g.fillGradientStyle(0x003566, 0x003566, 0x001e3a, 0x001e3a, 1);
    g.fillRect(0, THERMO_Y, W, H - THERMO_Y);

    // Wielokąt dna — ciemna baza (PAL.sand4)
    g.fillStyle(PAL.sand4);
    g.beginPath();
    g.moveTo(0, H);
    g.lineTo(0, this._sampleAt(0));
    for (let x = STEP; x <= W; x += STEP) g.lineTo(x, this._sampleAt(x));
    g.lineTo(W, H);
    g.closePath();
    g.fillPath();

    // Linijka głębokości
    g.lineStyle(1, 0x359966, 0.75);
    const pxPerM = (FLOOR_Y - SURFACE_Y) / 600;
    for (let m = 0; m <= 600; m += 50) {
      const ry = SURFACE_Y + m * pxPerM;
      g.strokeLineShape(new Phaser.Geom.Line(0, ry, m % 200 === 0 ? 22 : 10, ry));
    }
  }

  // ── Glow spots (bioluminescencja) ─────────────────────────────────────────

  _buildGlowSpots() {
    const list = [];
    for (let i = 0; i < 30; i++) {
      list.push({
        wx:    (this._hash(i, 700) * this.W) | 0,
        phase: this._hash(i, 701) * Math.PI * 2,
        freq:  0.5 + this._hash(i, 702) * 1.2,
      });
    }
    return list;
  }

  // ── Cząsteczki (plankton) ─────────────────────────────────────────────────

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

  // ── Bąble (oddzielna pula, wynurzają się z dna) ───────────────────────────

  _initBubbles() {
    const list = [];
    for (let i = 0; i < 25; i++) {
      const x = Math.random() * this.W;
      list.push({
        x,
        y:     this._sampleAt(x) - 2,
        vy:    -8 - Math.random() * 14,
        vx:    (Math.random() - 0.5) * 0.8,
        alpha: 0.4 + Math.random() * 0.5,
      });
    }
    return list;
  }

  // ── Gwiazdy ───────────────────────────────────────────────────────────────

  _buildStars() {
    return Array.from({ length: 58 }, (_, i) => ({
      x:     ((Math.sin(i * 2.31 + 0.73) + 1) / 2) * this.CAM_W,
      y:     Math.abs(Math.sin(i * 3.14 + 1.22)) * (this.SURFACE_Y - 7),
      r:     0.5 + Math.abs(Math.sin(i * 5.77)) * 1.4,
      phase: Math.sin(i * 7.31),
    }));
  }

  // ── Paleta dnia / nocy ────────────────────────────────────────────────────

  _lerpCol(a, b, t) {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    return ((ar + (br - ar) * t) | 0) << 16
         | ((ag + (bg - ag) * t) | 0) <<  8
         | ((ab + (bb - ab) * t) | 0);
  }

  _getDayPalette(dt) {
    const K = [
      { t: 0.00, top: 0x060e22, bot: 0x0d1e3a, wave: 0x2a4878, dark: 0.12 },
      { t: 0.21, top: 0x08042a, bot: 0x100e38, wave: 0x263868, dark: 0.08 },
      { t: 0.27, top: 0xcc3311, bot: 0xff9933, wave: 0xff8844, dark: 0.00 },
      { t: 0.33, top: 0x2c66dd, bot: 0x88ccff, wave: 0x77ddff, dark: 0.00 },
      { t: 0.50, top: 0x1e66bb, bot: 0x55bbff, wave: 0x66e0ff, dark: 0.00 },
      { t: 0.67, top: 0x2266aa, bot: 0x66bbee, wave: 0x55ddff, dark: 0.00 },
      { t: 0.73, top: 0xcc3311, bot: 0xff9933, wave: 0xffaa55, dark: 0.00 },
      { t: 0.79, top: 0x08042a, bot: 0x100e38, wave: 0x263858, dark: 0.08 },
      { t: 1.00, top: 0x060e22, bot: 0x0d1e3a, wave: 0x2a4878, dark: 0.12 },
    ];
    const n = ((dt % 1) + 1) % 1;
    let k0 = K[0], k1 = K[K.length - 1];
    for (let i = 0; i < K.length - 1; i++) {
      if (n >= K[i].t && n < K[i + 1].t) { k0 = K[i]; k1 = K[i + 1]; break; }
    }
    const raw = k1.t > k0.t ? (n - k0.t) / (k1.t - k0.t) : 0;
    const s   = raw * raw * (3 - 2 * raw);
    return {
      top:  this._lerpCol(k0.top,  k1.top,  s),
      bot:  this._lerpCol(k0.bot,  k1.bot,  s),
      wave: this._lerpCol(k0.wave, k1.wave, s),
      dark: k0.dark + (k1.dark - k0.dark) * s,
      n,
    };
  }

  // ── Niebo (screen-space) ──────────────────────────────────────────────────

  _drawSky(g, pal) {
    const { CAM_W, SURFACE_Y } = this;
    const { top, bot, dark, n } = pal;

    g.fillGradientStyle(top, top, bot, bot, 1.0);
    g.fillRect(0, 0, CAM_W, SURFACE_Y);

    if (dark > 0.06) {
      const starA = Math.min(1, dark * 3.2);
      const ts    = Date.now() * 0.001;
      for (const s of this._stars) {
        const tw = 0.75 + 0.25 * Math.sin(ts * 1.8 + s.phase * 4.5);
        g.fillStyle(0xddeeff, starA * tw * 0.88);
        g.fillCircle(s.x, s.y, s.r);
      }
    }

    const bodyX   = CAM_W * n;
    const bodyArc = Math.sin(n * Math.PI);
    const bodyY   = SURFACE_Y * 0.90 - bodyArc * (SURFACE_Y * 0.82);
    const isDay   = n > 0.265 && n < 0.735;

    if (isDay) {
      const noon  = Math.sin((n - 0.265) / 0.47 * Math.PI);
      const sunR  = 7  + (1 - noon) * 6;
      const haloR = 15 + (1 - noon) * 20;
      const haloA = 0.18 + (1 - noon) * 0.32;
      g.fillStyle(noon > 0.55 ? 0xffff88 : 0xff9933, haloA);
      g.fillCircle(bodyX, bodyY, haloR);
      g.fillStyle(noon > 0.55 ? 0xffffcc : 0xffbb55, 0.92);
      g.fillCircle(bodyX, bodyY, sunR);
    } else {
      g.fillStyle(0xdde8ff, 0.16);
      g.fillCircle(bodyX, bodyY, 12);
      g.fillStyle(0xeeeeff, 0.80);
      g.fillCircle(bodyX, bodyY, 6);
      g.fillStyle(0xaabbdd, 0.06);
      g.fillCircle(bodyX, bodyY, 20);
    }

    g.lineStyle(1.2, top, 0.40);
    g.strokeLineShape(new Phaser.Geom.Line(0, SURFACE_Y - 1, CAM_W, SURFACE_Y - 1));
  }

  // ── Pixel-art dno (per-klatka, world-space) ───────────────────────────────

  _drawFloor(camX, t) {
    const g  = this.floorGfx;
    const CW = this.CAM_W;

    // Warstwy kolorów: co P pikseli w poziomie
    for (let sx = 0; sx <= CW; sx += P) {
      const wx = camX + sx;
      const fy = Math.floor(this._sampleAt(wx));

      // Krawędź — highlight (sand1)
      g.fillStyle(PAL.sand1);
      g.fillRect(wx, fy, P, P);

      // Dither sand1 / sand2
      g.fillStyle(this._hash(wx, fy + 1) > 0.45 ? PAL.sand1 : PAL.sand2);
      g.fillRect(wx, fy + P, P, P);

      // Pas sand2
      g.fillStyle(PAL.sand2);
      g.fillRect(wx, fy + P * 2, P, P * 2);

      // Dither sand2 / sand3
      g.fillStyle(this._hash(wx + 3, fy + 5) > 0.45 ? PAL.sand2 : PAL.sand3);
      g.fillRect(wx, fy + P * 4, P, P);

      // Pas sand3
      g.fillStyle(PAL.sand3);
      g.fillRect(wx, fy + P * 5, P, P * 4);

      // Ripple piasku — jasna linia co ~18 px
      if (Math.sin(wx * 0.35) > 0.82) {
        g.fillStyle(PAL.sand1);
        g.fillRect(wx, fy + P, P, P);
      }
    }

    // Skały (proceduralne) — rysuj tylko widoczne
    for (const r of this._rocks) {
      if (r.wx < camX - 80 || r.wx > camX + CW + 80) continue;
      const fy = Math.floor(r.fy);

      if (r.kind === 'mount') {
        const rh = r.rh;
        for (let h = 0; h <= rh; h++) {
          const w   = Math.round((1 - h / rh) * 30);
          const col = h < rh * 0.3 ? PAL.sand2
                    : h < rh * 0.7 ? PAL.sand3
                    : PAL.sand4;
          g.fillStyle(col);
          g.fillRect(r.wx - w, fy - h, w * 2, P);
        }
        // Highlight szczytu
        g.fillStyle(PAL.sand1);
        g.fillRect(r.wx - 4, fy - rh + 2, 8, P);
      } else {
        // Mały kamień — kopczyk
        const sz = r.sz;
        for (let dy = 0; dy <= sz; dy++) {
          const w   = Math.max(0, sz - dy);
          const col = dy === 0         ? PAL.sand1
                    : dy < sz * 0.5   ? PAL.sand2
                    : PAL.sand3;
          g.fillStyle(col);
          g.fillRect(r.wx - w, fy - dy, w * 2 + 1, P);
        }
      }
    }

    // Bioluminescencja — rzadkie animowane punkty na dnie
    for (const gs of this._glowSpots) {
      if (gs.wx < camX - P || gs.wx > camX + CW + P) continue;
      const pulse = Math.sin(t * gs.freq + gs.phase) * 0.5 + 0.5;
      if (pulse < 0.5) continue;
      const gy = Math.floor(this._sampleAt(gs.wx)) - P;
      g.fillStyle(PAL.glow, pulse * 0.75);
      g.fillRect(gs.wx, gy, P, P);
      if (pulse > 0.8) {
        g.fillStyle(PAL.glowDim, 0.4);
        g.fillRect(gs.wx - P, gy, P, P);
        g.fillRect(gs.wx + P, gy, P, P);
        g.fillRect(gs.wx, gy - P, P, P);
      }
    }
  }

  // ── Aktualizacja (każda klatka) ───────────────────────────────────────────

  update(delta, camX, dayTime = 0) {
    const dt  = delta / 1000;
    const pal = this._getDayPalette(dayTime);
    const g   = this.waveGfx;
    const CW  = this.CAM_W;
    const t   = Date.now() * 0.001;

    // Niebo (screen-space)
    this.skyOverlay.clear();
    this._drawSky(this.skyOverlay, pal);

    // Nocne przyciemnienie (screen-space)
    this.darkOverlay.clear();
    if (pal.dark > 0.01) {
      this.darkOverlay.fillStyle(0x000008, pal.dark);
      this.darkOverlay.fillRect(0, 0, CW, this.scene.scale.height);
    }

    // Pixel-art dno
    this.floorGfx.clear();
    this._drawFloor(camX, t);

    // Fala powierzchniowa
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

    // Plankton
    for (const p of this.particles) {
      p.y += p.vy * dt;
      if (p.y < this.SURFACE_Y || p.y > this._sampleAt(p.x)) {
        p.y = this._sampleAt(p.x) - 10 - Math.random() * 40;
        p.x = Math.random() * this.W;
      }
      if (p.x >= camX - 100 && p.x <= camX + CW + 100) {
        g.fillStyle(PAL.plankton, p.alpha * 1.4);
        g.fillCircle(p.x, p.y, p.size);
      }
    }

    // Bąble wynurzające się z dna
    for (const b of this._bubbles) {
      b.y += b.vy * dt;
      b.x += b.vx * dt;
      if (b.y < this.SURFACE_Y || b.y > this._sampleAt(b.x)) {
        b.y  = this._sampleAt(b.x) - 2;
        b.x  = Math.random() * this.W;
        b.vy = -8 - Math.random() * 14;
      }
      if (b.x >= camX - 4 && b.x <= camX + CW + 4) {
        g.fillStyle(PAL.bubble, b.alpha * 0.65);
        g.fillRect(b.x, b.y, 1, 1);
        g.fillStyle(PAL.bubbleD, b.alpha * 0.35);
        g.fillRect(b.x + 1, b.y, 1, 1);
      }
    }

    // Poświata termokliny
    const thermoCol  = pal.dark < 0.08 ? 0x00bbdd : 0x004a88;
    const thermoAlph = 0.18 + Math.sin(t * 2) * 0.07;
    g.lineStyle(1.5, thermoCol, thermoAlph);
    g.strokeLineShape(
      new Phaser.Geom.Line(camX, this.THERMO_Y + 3, camX + CW, this.THERMO_Y + 3)
    );
  }
}
