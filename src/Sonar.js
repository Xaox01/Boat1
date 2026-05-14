// Sonar PPI (Plan Position Indicator) — klasyczny obrotowy wyświetlacz.
// Sweep zostawia świecące ślady ("smear") w miejscach kontaktów,
// zanikające przez ~10 sekund do następnego okrążenia.
import Phaser from 'phaser';
import { STATE } from './Enemy.js';

const SONAR_WORLD_RANGE = 820;
const SWEEP_SPEED       = 0.75;   // rad/s — pełna rotacja ~8.4s
const SMEAR_LIFE        = 10.0;   // s — jak długo ślad widoczny

// DEMON waterfall
const DEMON_FREQ_MIN = 8;
const DEMON_FREQ_MAX = 35;
const DEMON_BINS     = 22;
const DEMON_ROWS     = 42;
const DEMON_INTERVAL = 1.4;  // s między wierszami

export class Sonar {
  constructor(scene, x, y, radius) {
    this.scene   = scene;
    this.cx      = x;
    this.cy      = y;
    this.r       = radius;
    this.gfx     = scene.add.graphics().setDepth(20);
    this.sweep   = 0;
    this._prevSweep = 0;

    // Ślady (smear) zostawiane przez sweep przy przejściu obok kontaktu
    this._smears = [];

    // Trend sygnału — szybkie vs wolne EMA do wykrywania CLOSING/OPENING
    this._sigFast = new Map();
    this._sigSlow = new Map();

    // Pool etykiet tekstowych (K-1, K-2 …) na krawędzi sonaru
    this._labels = [];
    for (let i = 0; i < 6; i++) {
      this._labels.push(
        scene.add.text(0, 0, '', {
          fontSize: '9px',
          fontFamily: 'Courier New',
          color: '#66ffdd',
          stroke: '#000000',
          strokeThickness: 2,
        }).setDepth(21).setAlpha(0).setOrigin(0.5)
      );
    }

    // Etykieta tytułowa
    this._titleLabel = scene.add.text(x, y - radius - 9, 'SONAR PAS.', {
      fontSize: '7px', fontFamily: 'Courier New', color: '#55ffaa',
      letterSpacing: 2,
    }).setDepth(21).setOrigin(0.5);

    // DEMON waterfall — canvas HTML w panelu bocznym
    this._demonCanvas  = document.getElementById('demon-display');
    this._demonCtx     = this._demonCanvas?.getContext('2d');
    this._demonTimer   = 0;
    this._demonRows    = [];   // newest at index 0
  }

  update(delta, sub, enemies, playerTorpedoes, playerPings = []) {
    const dt = delta / 1000;
    this._prevSweep = this.sweep;
    this.sweep = (this.sweep + SWEEP_SPEED * dt) % (Math.PI * 2);

    const g = this.gfx;
    g.clear();

    // ── Tło ───────────────────────────────────────────────────────────────────
    g.fillStyle(0x001f0a, 0.96);
    g.fillCircle(this.cx, this.cy, this.r);

    // Siatka
    g.lineStyle(0.7, 0x1a7040, 0.75);
    for (let i = 1; i <= 3; i++) g.strokeCircle(this.cx, this.cy, (this.r / 3) * i);
    g.lineStyle(0.6, 0x1a7040, 0.55);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.strokeLineShape(new Phaser.Geom.Line(
        this.cx + Math.cos(a) * (this.r * 0.12), this.cy + Math.sin(a) * (this.r * 0.12),
        this.cx + Math.cos(a) * this.r,           this.cy + Math.sin(a) * this.r
      ));
    }

    // ── Zbierz dane kontaktów ─────────────────────────────────────────────────
    const sonarBonus = sub.sonarBonus ?? 1.0;
    const contacts   = [];

    for (const enemy of enemies) {
      const info = enemy.getContactInfo(sub);
      const enemyNoise = 0.20 + (enemy.state === STATE.HUNT     ? 0.55
                                : enemy.state === STATE.SEARCH   ? 0.20
                                : enemy.state === STATE.ALERT    ? 0.32
                                : enemy.state === STATE.WITHDRAW ? 0.15 : 0.10);
      const sig = Phaser.Math.Clamp(
        enemyNoise * 780 * sonarBonus / Math.max(info.distance, 80), 0, 1
      );
      if (sig < 0.03) {
        // Poza zasięgiem — klasyfikacja zanika (pamięć hydrofonu blaknie)
        if (enemy.classifyTimer > 0) {
          enemy.classifyTimer = Math.max(0, enemy.classifyTimer - dt * 0.4);
          if (enemy.classifyTimer < 12) enemy.contactClass = 'UNK';
          else if (enemy.classifyTimer < 38) enemy.contactClass = 'SURFACE';
        }
        continue;
      }

      // Klasyfikacja pasywna — akumuluj czas ekspozycji
      // Progi: UNK → SURFACE (12s) → typ końcowy WARSHIP/MERCHANT (38s)
      // Tryb NASŁUCH przyspiesza 2.2×; silny sygnał też pomaga
      const classifyGain = sub.listenMode ? 2.2 : 1.0;
      enemy.classifyTimer = (enemy.classifyTimer || 0) + dt * classifyGain * (sig * 1.5);
      const finalCls = enemy.shipType || 'WARSHIP';
      if      (enemy.classifyTimer > 38) enemy.contactClass = finalCls;
      else if (enemy.classifyTimer > 12) enemy.contactClass = 'SURFACE';
      else                               enemy.contactClass = 'UNK';

      // Trend: CLOSING / OPENING przez dwa EMA (szybkie vs wolne)
      const prevFast = this._sigFast.get(enemy) ?? sig;
      const prevSlow = this._sigSlow.get(enemy) ?? sig;
      const newFast  = prevFast * 0.88 + sig * 0.12;   // ~5s okno
      const newSlow  = prevSlow * 0.96 + sig * 0.04;   // ~18s okno
      this._sigFast.set(enemy, newFast);
      this._sigSlow.set(enemy, newSlow);
      const trendDiff = newFast - newSlow;
      const approach  = trendDiff >  0.009 ? 'ZBLIŻA'
                      : trendDiff < -0.009 ? 'ODDALA' : '';

      const col = enemy.contactClass === 'WARSHIP'
        ? (enemy.state === STATE.HUNT ? 0xff3300 : enemy.state === STATE.ALERT ? 0xffbb00
          : enemy.state === STATE.WITHDRAW ? 0x886622 : 0xdd9900)
        : enemy.contactClass === 'MERCHANT' ? 0x42b8d4   // cyan — potwierdzona jednostka cywilna
        : enemy.contactClass === 'SURFACE'  ? 0xffaa33   // bursztyn — nawodny, typ nieznany
        : 0x44aa77;                                       // zielony — UNK

      contacts.push({ enemy, info, sig, col, bearing: info.bearing, approach });
    }

    // ── Sweep crossing — dodaj smear dla każdego mijanego kontaktu ───────────
    for (const c of contacts) {
      const b    = ((c.bearing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const prev = this._prevSweep;
      const curr = this.sweep;
      const crossed = curr >= prev
        ? (b >= prev && b < curr)
        : (b >= prev || b < curr);

      if (crossed) {
        this._smears.push({
          bearing:  c.bearing,
          age:      0,
          strength: c.sig,
          col:      c.col,
          state:    c.enemy.state,
          dist:     c.info.distance,
          revealed: c.enemy.revealTimer > 0,
        });
      }
    }

    // Starzenie i usuwanie starych smears
    for (const s of this._smears) s.age += dt;
    this._smears = this._smears.filter(s => s.age < SMEAR_LIFE);

    // ── Rysuj smear (ślady sweep) ─────────────────────────────────────────────
    for (const s of this._smears) {
      const fade   = Math.max(0, 1 - s.age / SMEAR_LIFE);
      const bright = Math.pow(fade, 0.65);

      const lineEnd = s.revealed
        ? Math.min(1, s.dist / SONAR_WORLD_RANGE) * this.r
        : this.r * (0.35 + s.strength * 0.45);
      g.lineStyle(0.8 + s.strength * 1.5, s.col, bright * s.strength * 0.75);
      g.strokeLineShape(new Phaser.Geom.Line(
        this.cx, this.cy,
        this.cx + Math.cos(s.bearing) * lineEnd,
        this.cy + Math.sin(s.bearing) * lineEnd
      ));

      const arcW     = 0.08 + s.strength * 0.18;
      const arcAlpha = bright * (0.55 + s.strength * 0.40);
      g.lineStyle(2 + s.strength * 3, s.col, arcAlpha);
      g.beginPath();
      g.arc(this.cx, this.cy, this.r - 3, s.bearing - arcW, s.bearing + arcW);
      g.strokePath();

      if (s.revealed) {
        const scaledR = Math.min(1, s.dist / SONAR_WORLD_RANGE) * this.r;
        const bx = this.cx + Math.cos(s.bearing) * scaledR;
        const by = this.cy + Math.sin(s.bearing) * scaledR;
        g.fillStyle(s.col, bright * 0.90);
        g.fillCircle(bx, by, 3.5 + s.strength * 1.5);
      }
    }

    // ── Sweep line ────────────────────────────────────────────────────────────
    g.lineStyle(2.5, 0x88ffcc, 1.0);
    g.strokeLineShape(new Phaser.Geom.Line(
      this.cx, this.cy,
      this.cx + Math.cos(this.sweep) * this.r,
      this.cy + Math.sin(this.sweep) * this.r
    ));
    for (let i = 0; i < 24; i++) {
      const a = this.sweep - (i / 24) * (Math.PI * 0.55);
      g.lineStyle(1.6, 0x66ffbb, (1 - i / 24) * 0.30);
      g.beginPath();
      g.arc(this.cx, this.cy, this.r, a - 0.04, a);
      g.strokePath();
    }

    // Pierścień nasłuchu — zielona poświata gdy listenMode aktywny
    if (sub.listenMode) {
      const pulse = 0.35 + 0.20 * Math.sin(Date.now() * 0.004);
      g.lineStyle(2.5, 0x00ff88, pulse);
      g.strokeCircle(this.cx, this.cy, this.r + 3);
    }

    // ── Żywe wskaźniki kontaktów ──────────────────────────────────────────────
    for (const c of contacts) {
      const col = c.col;

      const arcH = 0.04 + c.sig * 0.07;
      g.lineStyle(0.8 + c.sig * 1.2, col, c.sig * 0.35);
      g.beginPath();
      g.arc(this.cx, this.cy, this.r - 1, c.bearing - arcH, c.bearing + arcH);
      g.strokePath();

      if (c.info.detectionLevel > 0.05) {
        const arcStart = this.r * 0.95;
        const arcEnd   = this.r * (0.95 - c.info.detectionLevel * 0.80);
        g.lineStyle(1.5 + c.info.detectionLevel * 2, col, c.info.detectionLevel * 0.70);
        g.strokeLineShape(new Phaser.Geom.Line(
          this.cx + Math.cos(c.bearing) * arcEnd,   this.cy + Math.sin(c.bearing) * arcEnd,
          this.cx + Math.cos(c.bearing) * arcStart, this.cy + Math.sin(c.bearing) * arcStart
        ));
      }

      if (c.enemy.state === STATE.HUNT) {
        const pulse = 0.55 + 0.45 * Math.sin(Date.now() * 0.011);
        const ex = this.cx + Math.cos(c.bearing) * (this.r - 7);
        const ey = this.cy + Math.sin(c.bearing) * (this.r - 7);
        g.fillStyle(0xff2200, pulse * 0.90);
        g.fillCircle(ex, ey, 5 + pulse * 2);
        g.lineStyle(1, 0xff6600, pulse * 0.70);
        g.strokeCircle(ex, ey, 8 + pulse * 4);
      }

      if (c.enemy.revealTimer > 0 && c.info.distance <= SONAR_WORLD_RANGE) {
        const scaledR = (c.info.distance / SONAR_WORLD_RANGE) * this.r;
        const bx  = this.cx + Math.cos(c.bearing) * scaledR;
        const by  = this.cy + Math.sin(c.bearing) * scaledR;
        const bA  = Math.min(1, c.enemy.revealTimer / 1.5);
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.009);
        g.fillStyle(col, bA * 0.95);
        g.fillCircle(bx, by, 5);
        g.lineStyle(1.5, col, bA * (0.35 + pulse * 0.50));
        g.strokeCircle(bx, by, 9 + pulse * 5);
        g.lineStyle(1, col, bA * 0.75);
        g.strokeLineShape(new Phaser.Geom.Line(bx - 9, by, bx + 9, by));
        g.strokeLineShape(new Phaser.Geom.Line(bx, by - 9, bx, by + 9));
      }

      const tri = this.scene._triangulated?.get(c.enemy);
      if (tri && tri.age < 28) {
        const tdx  = tri.x - sub.x;
        const tdy  = tri.y - sub.y;
        const tDist = Math.sqrt(tdx * tdx + tdy * tdy);
        if (tDist <= SONAR_WORLD_RANGE) {
          const tB   = Math.atan2(tdy, tdx);
          const tR   = (tDist / SONAR_WORLD_RANGE) * this.r;
          const tx   = this.cx + Math.cos(tB) * tR;
          const ty   = this.cy + Math.sin(tB) * tR;
          const fade = 1 - tri.age / 28;
          const err  = (tri.accurate ? 5 : 11) * fade + 2;
          g.lineStyle(1, 0xffcc44, fade * 0.65);
          g.strokeCircle(tx, ty, err);
          g.lineStyle(1.2, 0xffcc44, fade * 0.80);
          g.strokeLineShape(new Phaser.Geom.Line(tx - 8, ty, tx + 8, ty));
          g.strokeLineShape(new Phaser.Geom.Line(tx, ty - 8, tx, ty + 8));
          g.fillStyle(0xffcc44, fade * 0.45);
          g.fillCircle(tx, ty, 2.5);
        }
      }
    }

    // ── Podświetlenie wybranego kontaktu (z stacji SONAR) ────────────────────
    const _selId = window._sonar?.selectedId;
    if (_selId) {
      const _selIdx = parseInt(_selId.replace('K-', '')) - 1;
      if (_selIdx >= 0 && _selIdx < contacts.length) {
        const sc  = contacts[_selIdx];
        const pls = 0.55 + 0.45 * Math.sin(Date.now() * 0.007);
        // Biały pierścień na krawędzi PPI przy namiarze wybranego kontaktu
        const sx = this.cx + Math.cos(sc.bearing) * (this.r - 5);
        const sy = this.cy + Math.sin(sc.bearing) * (this.r - 5);
        g.lineStyle(1.5, 0xffffff, pls * 0.75);
        g.strokeCircle(sx, sy, 8 + pls * 2);
        // Przerywana linia namiarowa
        g.lineStyle(0.7, 0xffffff, 0.35);
        g.strokeLineShape(new Phaser.Geom.Line(this.cx, this.cy, sx, sy));
      }
    }

    // ── Torpedy ASROC ─────────────────────────────────────────────────────────
    const blink = Math.sin(Date.now() * 0.022) > 0;
    for (const enemy of enemies) {
      for (const ht of enemy.homingTorpedoes || []) {
        if (ht.dead) continue;
        const tdx  = ht.x - sub.x;
        const tdy  = ht.y - sub.y;
        const dist = Math.sqrt(tdx * tdx + tdy * tdy);
        if (dist > SONAR_WORLD_RANGE) continue;
        const sR = (dist / SONAR_WORLD_RANGE) * this.r;
        const b  = Math.atan2(tdy, tdx);
        const tx = this.cx + Math.cos(b) * sR;
        const ty = this.cy + Math.sin(b) * sR;
        if (blink) {
          g.fillStyle(ht.locked ? 0xff1100 : 0xff7700, 0.95);
          g.fillCircle(tx, ty, ht.locked ? 5 : 3);
          if (ht.locked) {
            g.lineStyle(1.2, 0xff4400, 0.70);
            g.strokeCircle(tx, ty, 8);
          }
        }
      }
    }

    // ── Torpedy gracza ────────────────────────────────────────────────────────
    if (playerTorpedoes) {
      for (const t of playerTorpedoes) {
        if (t.exploded) continue;
        const pdx  = t.x - sub.x;
        const pdy  = t.y - sub.y;
        const dist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (dist > SONAR_WORLD_RANGE) continue;
        const sR = (dist / SONAR_WORLD_RANGE) * this.r;
        const b  = Math.atan2(pdy, pdx);
        const tx = this.cx + Math.cos(b) * sR;
        const ty = this.cy + Math.sin(b) * sR;
        const col = t.seekerLocked ? 0x44ff88 : 0x44ffdd;
        g.fillStyle(col, 0.90);
        g.fillCircle(tx, ty, t.seekerLocked ? 3 : 2);
        if (t.seekerLocked) {
          g.lineStyle(1, col, 0.60);
          g.strokeCircle(tx, ty, 6);
        }
      }
    }

    // ── Ping aktywny gracza — pierścień na PPI ───────────────────────────────
    for (const p of playerPings) {
      const scaledR = (p.r / SONAR_WORLD_RANGE) * this.r;
      if (scaledR > this.r + 8) continue;
      const pFrac = p.r / p.maxR;
      const ringA = Math.min(p.alpha * (1 - pFrac * 0.5), 0.65);
      g.lineStyle(1.8 - pFrac * 1.0, 0x44ffdd, ringA);
      g.strokeCircle(this.cx, this.cy, Math.min(scaledR, this.r - 1));

      // Błysk echa na PPI — gdy wróg namierzony
      for (const e of p.echoes) {
        const edx   = e.x - sub.x;
        const edy   = e.y - sub.y;
        const eDist = Math.sqrt(edx * edx + edy * edy);
        if (eDist > SONAR_WORLD_RANGE) continue;
        const eR   = (eDist / SONAR_WORLD_RANGE) * this.r;
        const eB   = Math.atan2(edy, edx);
        const epx  = this.cx + Math.cos(eB) * eR;
        const epy  = this.cy + Math.sin(eB) * eR;
        const fade = 1 - e.age / 1.8;
        g.fillStyle(0xffffff, fade * 0.90);
        g.fillCircle(epx, epy, 3.5);
        g.lineStyle(1.2, 0x44ffdd, fade * 0.70);
        g.strokeCircle(epx, epy, 7 + (1 - fade) * 6);
      }
    }

    // ── Obramowanie ───────────────────────────────────────────────────────────
    g.lineStyle(2.0, 0x44cc77, 1.0);
    g.strokeCircle(this.cx, this.cy, this.r);
    g.lineStyle(0.8, 0x66ff99, 0.45);
    g.strokeCircle(this.cx, this.cy, this.r - 2);

    // ── Trójkąt pozycji własnej ───────────────────────────────────────────────
    g.fillStyle(0xffffff, 0.95);
    g.fillTriangle(this.cx, this.cy - 6, this.cx - 3.5, this.cy + 3, this.cx + 3.5, this.cy + 3);
    g.lineStyle(0.8, 0x44ff9a, 0.55);
    g.strokeTriangle(this.cx, this.cy - 6, this.cx - 3.5, this.cy + 3, this.cx + 3.5, this.cy + 3);

    // ── Etykiety kontaktów — pokazują klasyfikację ────────────────────────────
    for (let i = 0; i < this._labels.length; i++) {
      const label = this._labels[i];
      if (i >= contacts.length) { label.setAlpha(0); continue; }

      const c       = contacts[i];
      const labelR  = this.r + 13;
      const lx      = this.cx + Math.cos(c.bearing) * labelR;
      const ly      = this.cy + Math.sin(c.bearing) * labelR;

      // Symbol stanu + klasyfikacja
      const cls = c.enemy.contactClass;
      const stateSymbol = cls === 'UNK' ? '?'
        : c.enemy.state === STATE.HUNT    ? '◆'
        : c.enemy.state === STATE.ALERT   ? '▲'
        : c.enemy.state === STATE.SEARCH  ? '▲'
        : c.enemy.state === STATE.WITHDRAW ? '↙'
        :                                    '·';

      const colHex = cls === 'UNK'      ? '#44aa77'
                   : cls === 'MERCHANT' ? '#42b8d4'
                   : cls === 'SURFACE'  ? '#ffaa33'
                   : c.enemy.state === STATE.HUNT    ? '#ff4444'
                   : c.enemy.state === STATE.ALERT   ? '#ffbb00'
                   : c.enemy.state === STATE.WITHDRAW ? '#aa8833'
                                                      : '#ffcc44';

      label.setPosition(lx, ly);
      label.setText(`${stateSymbol}K${i + 1}`);
      label.setColor(colHex);
      label.setAlpha(Math.min(1, c.sig * 1.8));
    }

    // ── DEMON waterfall ───────────────────────────────────────────────────────
    this._demonTimer += dt;
    if (this._demonTimer >= DEMON_INTERVAL) {
      this._demonTimer = 0;
      this._addDemonRow(contacts, sub);
    }
    this._drawDemon();

    // Eksportuj dane kontaktów dla GameScene (trend, klasyfikacja)
    this.contacts = contacts;
  }

  _addDemonRow(contacts, sub) {
    const row = new Float32Array(DEMON_BINS).fill(0);

    // Szum tła — losowe fluktuacje (biologics, ambient ocean noise)
    for (let b = 0; b < DEMON_BINS; b++) {
      row[b] = Math.random() * 0.06;
    }

    for (const c of contacts) {
      // Mapuj tonus wroga na bin częstotliwości
      const freq = c.enemy.tonal;
      const binF = (freq - DEMON_FREQ_MIN) / (DEMON_FREQ_MAX - DEMON_FREQ_MIN);
      const bin  = Math.round(binF * (DEMON_BINS - 1));
      if (bin < 0 || bin >= DEMON_BINS) continue;

      // Siła sygnału + bonus za nasłuch; harmoniki na binach ±1
      const strength = c.sig * (sub.listenMode ? 1.5 : 1.0);
      row[bin]                              = Math.max(row[bin], strength);
      if (bin > 0)        row[bin - 1]      = Math.max(row[bin - 1], strength * 0.4);
      if (bin < DEMON_BINS - 1) row[bin + 1] = Math.max(row[bin + 1], strength * 0.4);
    }

    this._demonRows.unshift(row);
    if (this._demonRows.length > DEMON_ROWS) this._demonRows.pop();
  }

  _drawDemon() {
    const ctx = this._demonCtx;
    if (!ctx || this._demonRows.length === 0) return;

    const canvas = this._demonCanvas;
    const W = canvas.width;
    const H = canvas.height;
    const bw = W / DEMON_BINS;
    const rh = H / DEMON_ROWS;

    ctx.fillStyle = '#001f0a';
    ctx.fillRect(0, 0, W, H);

    for (let r = 0; r < this._demonRows.length; r++) {
      const row   = this._demonRows[r];
      const alpha = 1 - r / DEMON_ROWS;
      for (let b = 0; b < DEMON_BINS; b++) {
        const sig = row[b];
        if (sig < 0.03) continue;
        const intensity = Math.min(1, sig * 2.0);
        const gv = Math.round(100 + intensity * 155);
        const rv = Math.round(sig > 0.50 ? (sig - 0.50) * 3.0 * 240 : 0);
        const bv = Math.round(intensity * 70);
        ctx.globalAlpha = alpha * (0.55 + intensity * 0.45);
        ctx.fillStyle   = `rgb(${rv},${gv},${bv})`;
        ctx.fillRect(b * bw, r * rh, bw - 0.5, rh);
      }
    }
    ctx.globalAlpha = 1;

    // Oś częstotliwości — etykiety Hz
    ctx.font        = '7px Courier New';
    ctx.textBaseline = 'bottom';
    const freqStep = (DEMON_FREQ_MAX - DEMON_FREQ_MIN) / 3;
    for (let i = 0; i <= 3; i++) {
      const freq = Math.round(DEMON_FREQ_MIN + freqStep * i);
      const px   = (i / 3) * W;
      ctx.fillStyle = '#118833';
      ctx.fillRect(px, 0, 0.7, H);
      ctx.fillStyle = '#44cc66';
      ctx.fillText(`${freq}`, px + 1, H);
    }
  }
}
