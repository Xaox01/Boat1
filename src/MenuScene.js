import Phaser from 'phaser';

const W    = 1024;
const H    = 640;
const SURF = 240;   // linia wody w menu

const DIFFICULTIES = [
  { key: 'easy',   label: 'ŁATWY',   desc: '1 niszczyciel · Rzadki sonar',         color: 0x44ff88, enemies: 1, speedMult: 0.75 },
  { key: 'normal', label: 'NORMALNY', desc: '2 niszczyciele · Standardowe AI',      color: 0xffbb00, enemies: 2, speedMult: 1.00 },
  { key: 'hard',   label: 'TRUDNY',   desc: '3 niszczyciele · Agresywny ASROC',     color: 0xff4444, enemies: 3, speedMult: 1.30 },
];

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    this._t        = 0;
    this._subX     = -100;
    this._diff     = 1;   // 0=easy, 1=normal, 2=hard
    this._sonarR   = 0;
    this._sonarAlpha = 0;

    // Ustawienia gry — definicje i domyślne wartości
    this._settingRows = [
      {
        key: 'merchants', y: 0,
        options: [{ v: 2, label: '2 STATKI' }, { v: 4, label: '4 STATKI' }, { v: 6, label: '6 STATKÓW' }],
        idx: 1,  // domyślnie 4
      },
      {
        key: 'infiniteAmmo', y: 0,
        options: [{ v: false, label: 'STANDARDOWA' }, { v: true, label: 'NIEOGRANICZONA' }],
        idx: 0,
      },
      {
        key: 'enemyDelay', y: 0,
        options: [{ v: 15, label: '15 SEK.' }, { v: 60, label: '1 MINUTA' }, { v: 300, label: '5 MINUT' }],
        idx: 0,
      },
    ];

    document.getElementById('game-ui').classList.remove('active');

    // ── Tło oceanu ────────────────────────────────────────────────────────────
    const bg = this.add.graphics();
    // Niebo / nad wodą
    bg.fillGradientStyle(0x000510, 0x000510, 0x001428, 0x001428, 1);
    bg.fillRect(0, 0, W, SURF);
    // Głębiny
    bg.fillGradientStyle(0x001428, 0x001428, 0x000408, 0x000408, 1);
    bg.fillRect(0, SURF, W, H - SURF);

    // Głębokościowe bandy
    for (let i = 0; i < 10; i++) {
      bg.fillStyle(0x000000, 0.04 * i);
      bg.fillRect(0, SURF + i * ((H - SURF) / 10), W, (H - SURF) / 10 + 1);
    }

    // ── Linie głębokości ──────────────────────────────────────────────────────
    const depthData = [
      [0,   '0 m',                    0x0a2a3a, 0.40],
      [100, '100 m',                  0x0a2a3a, 0.30],
      [200, '200 m  ▸  TERMOKLINA',   0x0a6a5a, 0.70],
      [300, '300 m  ▸  LIMIT',        0x4a2200, 0.50],
      [400, '400 m  ▸  KRYTYCZNA',    0x6a1010, 0.55],
    ];
    for (const [m, label, col, alpha] of depthData) {
      const py = SURF + (m / 600) * (H - SURF);
      const lg = this.add.graphics();
      lg.lineStyle(1, col, alpha);
      lg.strokeLineShape(new Phaser.Geom.Line(0, py, W, py));
      this.add.text(W - 8, py + 2, label, {
        fontSize: '8px', color: m === 200 ? '#0a8a6a' : m >= 300 ? '#6a3a1a' : '#0a2535',
        fontFamily: 'Courier New',
      }).setOrigin(1, 0);
    }

    // ── Tytuł ─────────────────────────────────────────────────────────────────
    this.add.text(W / 2, 44, 'OPERACJA', {
      fontSize: '18px', color: '#2a7a4a', fontFamily: 'Courier New', letterSpacing: 10,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(W / 2, 70, 'PAŹDZIERNIK', {
      fontSize: '52px', color: '#4aff9a', fontFamily: 'Courier New',
      fontStyle: 'bold', stroke: '#001a0a', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(W / 2, 134, '— SYMULATOR OKRĘTU PODWODNEGO —', {
      fontSize: '10px', color: '#1a5a3a', fontFamily: 'Courier New', letterSpacing: 4,
    }).setOrigin(0.5).setDepth(10);

    // ── Linia dekoracyjna ─────────────────────────────────────────────────────
    const deco = this.add.graphics().setDepth(10);
    deco.lineStyle(1, 0x1a4a2a, 0.6);
    deco.strokeLineShape(new Phaser.Geom.Line(W / 2 - 220, 150, W / 2 + 220, 150));

    // ── LEWY PANEL — Rozkazy ──────────────────────────────────────────────────
    const lx = 28, ly = 158, lw = 304, lh = 190;
    const lbox = this.add.graphics().setDepth(10);
    lbox.fillStyle(0x000000, 0.55);
    lbox.fillRect(lx, ly, lw, lh);
    lbox.lineStyle(1, 0x1a4a2a, 0.7);
    lbox.strokeRect(lx, ly, lw, lh);

    this.add.text(lx + 12, ly + 10, 'ROZKAZY OPERACYJNE', {
      fontSize: '8px', color: '#2a8a5a', fontFamily: 'Courier New', letterSpacing: 3,
    }).setDepth(10);

    const briefing = [
      'MISJA: Przerwij linię zaopatrzenia',
      'wrogiej floty nawodnej.',
      '',
      'Twój okręt: K-244 «NALIM» kl. KILO',
      'Rejon operacji: Morze Norweskie',
      'Data: Październik 1984',
      '',
      'ZAGROŻENIA:',
      '  · Niszczyciele z sonarem aktywnym',
      '  · Zarzuty głębinowe — unikaj!',
      '  · Termoklina na 200 m maskuje',
      '    sygnaturę akustyczną',
      'POWODZENIA, Towarzyszu Komandorze.',
    ];

    briefing.forEach((line, i) => {
      const isHeader = line.startsWith('MISJA') || line.startsWith('ZAGROŻENIA') || line.startsWith('POWODZENIA');
      this.add.text(lx + 14, ly + 28 + i * 12.5, line, {
        fontSize: '8.5px',
        color: isHeader ? '#4aff9a' : line === '' ? '#000' : '#2a6a3a',
        fontFamily: 'Courier New',
        fontStyle: isHeader ? 'bold' : 'normal',
      }).setDepth(10);
    });

    // ── PRAWY PANEL — Sterowanie ──────────────────────────────────────────────
    const rx = W - 28 - 304, ry = 158, rw = 304, rh = 190;
    const rbox = this.add.graphics().setDepth(10);
    rbox.fillStyle(0x000000, 0.55);
    rbox.fillRect(rx, ry, rw, rh);
    rbox.lineStyle(1, 0x1a4a2a, 0.7);
    rbox.strokeRect(rx, ry, rw, rh);

    this.add.text(rx + 12, ry + 10, 'STEROWANIE', {
      fontSize: '8px', color: '#2a8a5a', fontFamily: 'Courier New', letterSpacing: 3,
    }).setDepth(10);

    const controls = [
      ['W / S',      'Balast — wynurz / zanurz'],
      ['D / A',      'Silnik naprzód / wstecz'],
      ['Shift',      'Pełna moc silnika'],
      ['Spacja',     'Stop silnika'],
      ['LPM',        'Odpal torpedę → kursor'],
      ['R / PPM',    'Rakieta p/okrętowa (≤70 m)'],
      ['F1–F5',      'Stacje: CONN/SONAR/PERYSKOP…'],
    ];

    controls.forEach(([key, desc], i) => {
      this.add.text(rx + 14, ry + 28 + i * 22, key, {
        fontSize: '9px', color: '#4aff9a', fontFamily: 'Courier New', fontStyle: 'bold',
      }).setDepth(10);
      this.add.text(rx + 14, ry + 40 + i * 22, desc, {
        fontSize: '7.5px', color: '#2a5a3a', fontFamily: 'Courier New',
      }).setDepth(10);
    });

    // ── ŚRODEK — Wybór trudności ──────────────────────────────────────────────
    const diffY = 368;
    this.add.text(W / 2, diffY - 14, 'TRUDNOŚĆ', {
      fontSize: '8px', color: '#2a6a3a', fontFamily: 'Courier New', letterSpacing: 3,
    }).setOrigin(0.5).setDepth(10);

    this._diffBtns = [];
    DIFFICULTIES.forEach((d, i) => {
      const bx = W / 2 - 165 + i * 165;
      const bw = 145, bh = 44;
      const btn = this.add.graphics().setDepth(10);
      const lbl = this.add.text(bx + bw / 2, diffY + 10, d.label, {
        fontSize: '11px', color: '#4aff9a', fontFamily: 'Courier New', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(11);
      const sub = this.add.text(bx + bw / 2, diffY + 27, d.desc, {
        fontSize: '7px', color: '#2a6a3a', fontFamily: 'Courier New',
      }).setOrigin(0.5).setDepth(11);
      this._diffBtns.push({ btn, lbl, sub, bx, bw, bh, d });
    });
    this._redrawDiff();

    // ── USTAWIENIA GRY ───────────────────────────────────────────────────────
    const sy = 430;
    const sbox = this.add.graphics().setDepth(10);
    sbox.fillStyle(0x000000, 0.45);
    sbox.fillRect(28, sy - 8, W - 56, 126);
    sbox.lineStyle(1, 0x1a4a2a, 0.50);
    sbox.strokeRect(28, sy - 8, W - 56, 126);

    // Pionowa linia oddzielająca etykiety od przycisków
    sbox.lineStyle(1, 0x1a3a1a, 0.35);
    sbox.strokeLineShape(new Phaser.Geom.Line(200, sy - 8, 200, sy + 118));

    this.add.text(W / 2, sy, 'USTAWIENIA GRY', {
      fontSize: '8px', color: '#1a5a2a', fontFamily: 'Courier New', letterSpacing: 3,
    }).setOrigin(0.5).setDepth(10);

    const rowLabels   = ['KONWÓJ', 'AMUNICJA', 'DO KONTAKTU'];
    const rowYOffsets = [20, 52, 84];

    this._settingRows.forEach((row, ri) => {
      row.y = sy + rowYOffsets[ri];
      row.txts = [];

      this.add.text(42, row.y + 5, rowLabels[ri], {
        fontSize: '8px', color: '#1a4a2a', fontFamily: 'Courier New', letterSpacing: 2,
      }).setDepth(10);

      let bx = 210;
      row.options.forEach((opt, oi) => {
        const txt = this.add.text(bx, row.y, `[ ${opt.label} ]`, {
          fontSize: '9px', fontFamily: 'Courier New', fontStyle: 'bold', color: '#1a3a2a',
        }).setDepth(11);
        row.txts.push({ txt, bx, by: row.y, bh: 18, oi });
        bx += txt.width + 12;
      });
    });
    this._redrawSettings();

    // ── Obsługa kliku ─────────────────────────────────────────────────────────
    this.input.on('pointerdown', (ptr) => {
      // Ustawienia
      for (const row of this._settingRows) {
        for (const item of row.txts) {
          if (ptr.x >= item.bx && ptr.x <= item.bx + item.txt.width + 4
              && ptr.y >= item.by && ptr.y <= item.by + item.bh) {
            row.idx = item.oi;
            this._redrawSettings();
            return;
          }
        }
      }
      // Trudność
      for (let i = 0; i < this._diffBtns.length; i++) {
        const { bx, bw, bh } = this._diffBtns[i];
        if (ptr.x >= bx && ptr.x <= bx + bw && ptr.y >= diffY && ptr.y <= diffY + bh) {
          this._diff = i;
          this._redrawDiff();
          return;
        }
      }
      // Klik poza wszystkimi przyciskami = start
      this._start();
    });

    // ── START ─────────────────────────────────────────────────────────────────
    this._startTxt = this.add.text(W / 2, H - 24, '[ ENTER — START ]', {
      fontSize: '11px', color: '#4aff9a', fontFamily: 'Courier New', letterSpacing: 3,
    }).setOrigin(0.5).setDepth(10);

    this.input.keyboard.on('keydown-ENTER', () => this._start());
    this.input.keyboard.on('keydown-ONE',   () => { this._diff = 0; this._redrawDiff(); });
    this.input.keyboard.on('keydown-TWO',   () => { this._diff = 1; this._redrawDiff(); });
    this.input.keyboard.on('keydown-THREE', () => { this._diff = 2; this._redrawDiff(); });

    // ── Animowane ─────────────────────────────────────────────────────────────
    this._waveGfx  = this.add.graphics().setDepth(5);
    this._subGfx   = this.add.graphics().setDepth(6);
    this._sonarGfx = this.add.graphics().setDepth(7);

    // ── CRT ───────────────────────────────────────────────────────────────────
    const crt = this.add.graphics().setDepth(100);
    for (let y = 0; y < H; y += 4) { crt.fillStyle(0x000000, 0.05); crt.fillRect(0, y, W, 2); }
    for (let i = 0; i < 18; i++) {
      crt.lineStyle(i * 1.4, 0x000000, (i / 18) * 0.28);
      crt.strokeRect(i, i, W - i * 2, H - i * 2);
    }
  }

  _redrawDiff() {
    const diffY = 368;
    this._diffBtns.forEach(({ btn, lbl, sub, bx, bw, bh, d }, i) => {
      const sel = i === this._diff;
      btn.clear();
      btn.fillStyle(sel ? 0x002a10 : 0x000000, sel ? 0.80 : 0.50);
      btn.fillRect(bx, diffY, bw, bh);
      btn.lineStyle(1.5, sel ? d.color : 0x1a3a2a, sel ? 0.90 : 0.40);
      btn.strokeRect(bx, diffY, bw, bh);
      lbl.setColor(sel ? Phaser.Display.Color.IntegerToColor(d.color).rgba : '#2a5a3a');
      sub.setColor(sel ? '#2a8a4a' : '#1a3a2a');
    });
  }

  _redrawSettings() {
    this._settingRows.forEach(row => {
      row.txts.forEach(({ txt, oi }) => {
        txt.setColor(oi === row.idx ? '#4aff9a' : '#1a3a2a');
      });
    });
  }

  _start() {
    const d = DIFFICULTIES[this._diff];
    this.registry.set('difficulty', d);

    const settings = {};
    for (const row of this._settingRows) {
      settings[row.key] = row.options[row.idx].v;
    }
    this.registry.set('settings', settings);

    this.scene.start('GameScene');
  }

  update(_, delta) {
    this._t    += delta / 1000;
    this._subX += 26 * (delta / 1000);
    if (this._subX > W + 100) this._subX = -100;

    // Sonar ping co 4s
    this._sonarR += 60 * (delta / 1000);
    this._sonarAlpha = Math.max(0, 0.6 - this._sonarR / 320);
    if (this._sonarR > 320) { this._sonarR = 0; this._sonarAlpha = 0.6; }

    this._drawWaves();
    this._drawSub();
    this._drawSonar();
    this._startTxt.alpha = 0.4 + 0.6 * Math.abs(Math.sin(this._t * 1.8));
  }

  _drawWaves() {
    const g = this._waveGfx;
    g.clear();
    // Główna fala
    g.lineStyle(1.5, 0x1a7aaa, 0.70);
    g.beginPath(); g.moveTo(0, SURF);
    for (let x = 0; x <= W; x += 5) {
      g.lineTo(x, SURF + Math.sin(x * 0.016 + this._t * 1.2) * 5
                       + Math.sin(x * 0.032 + this._t * 0.75) * 2.5);
    }
    g.strokePath();
    // Odbłysk
    g.lineStyle(1, 0xaaddff, 0.12);
    g.beginPath(); g.moveTo(0, SURF - 3);
    for (let x = 0; x <= W; x += 5) {
      g.lineTo(x, SURF - 3 + Math.sin(x * 0.016 + this._t * 1.2) * 5
                           + Math.sin(x * 0.032 + this._t * 0.75) * 2.5);
    }
    g.strokePath();
  }

  _drawSub() {
    const g  = this._subGfx;
    const sy = SURF + 70;
    g.clear();

    // Smuga bąbelków
    for (let i = 0; i < 5; i++) {
      g.fillStyle(0x4488aa, 0.15 - i * 0.025);
      g.fillCircle(this._subX - 42 - i * 16,
        sy + Math.sin(this._t * 2.2 + i * 1.1) * 3, 2.5 + i * 2.2);
    }

    g.save();
    g.translateCanvas(this._subX, sy);
    g.fillStyle(0x2a3a4a, 0.95);
    g.fillEllipse(0, 0, 72, 22);
    g.fillStyle(0x1a2a3a, 1);
    g.fillRect(-8, -18, 22, 14);
    g.fillStyle(0x1a2a3a, 1);
    g.fillRect(2, -28, 3, 12);
    // Miga snorkiel
    const blink = Math.sin(this._t * 4) > 0;
    g.fillStyle(blink ? 0x44ff44 : 0x114411, 0.9);
    g.fillCircle(3, -29, 3);
    g.fillStyle(0xff2222, 1); g.fillCircle(-32, 0, 2);
    g.fillStyle(0x22ff22, 1); g.fillCircle(32, 0, 2);
    g.restore();
  }

  _drawSonar() {
    const g  = this._sonarGfx;
    const sx = 80, sy = SURF + 110;
    g.clear();
    if (this._sonarAlpha <= 0) return;
    g.lineStyle(1.2, 0x44ffcc, this._sonarAlpha * 0.5);
    g.strokeCircle(sx, sy, this._sonarR);
    g.lineStyle(0.6, 0x44ffcc, this._sonarAlpha * 0.25);
    g.strokeCircle(sx, sy, this._sonarR * 0.6);
  }
}
