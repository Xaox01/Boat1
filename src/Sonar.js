// Sonar PPI (Plan Position Indicator) — klasyczny obrotowy wyświetlacz.
// Sweep zostawia świecące ślady ("smear") w miejscach kontaktów,
// zanikające przez ~10 sekund do następnego okrążenia.
import Phaser from 'phaser';
import { STATE } from './Enemy.js';

const SONAR_WORLD_RANGE = 820;
const SWEEP_SPEED       = 0.75;   // rad/s — pełna rotacja ~8.4s
const SMEAR_LIFE        = 10.0;   // s — jak długo ślad widoczny

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
    this._smears = [];   // { bearing, age, strength, col, dist, revealed }

    // Pool etykiet tekstowych (K-1, K-2 …) na krawędzi sonaru
    this._labels = [];
    for (let i = 0; i < 6; i++) {
      this._labels.push(
        scene.add.text(0, 0, '', {
          fontSize: '7px',
          fontFamily: 'Courier New',
          color: '#44ffcc',
          stroke: '#000000',
          strokeThickness: 2,
        }).setDepth(21).setAlpha(0).setOrigin(0.5)
      );
    }

    // Etykieta tytułowa
    this._titleLabel = scene.add.text(x, y - radius - 9, 'SONAR PAS.', {
      fontSize: '6px', fontFamily: 'Courier New', color: '#1a6a3a',
      letterSpacing: 2,
    }).setDepth(21).setOrigin(0.5);
  }

  update(delta, sub, enemies, playerTorpedoes) {
    const dt = delta / 1000;
    this._prevSweep = this.sweep;
    this.sweep = (this.sweep + SWEEP_SPEED * dt) % (Math.PI * 2);

    const g = this.gfx;
    g.clear();

    // ── Tło ───────────────────────────────────────────────────────────────────
    g.fillStyle(0x000d05, 0.94);
    g.fillCircle(this.cx, this.cy, this.r);

    // Siatka
    g.lineStyle(0.4, 0x0c3a18, 0.40);
    for (let i = 1; i <= 3; i++) g.strokeCircle(this.cx, this.cy, (this.r / 3) * i);
    g.lineStyle(0.4, 0x0c3a18, 0.25);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.strokeLineShape(new Phaser.Geom.Line(
        this.cx + Math.cos(a) * (this.r * 0.12), this.cy + Math.sin(a) * (this.r * 0.12),
        this.cx + Math.cos(a) * this.r,           this.cy + Math.sin(a) * this.r
      ));
    }

    // ── Zbierz dane kontaktów ─────────────────────────────────────────────────
    const contacts = [];
    for (const enemy of enemies) {
      const info = enemy.getContactInfo(sub);
      const enemyNoise = 0.20 + (enemy.state === STATE.HUNT   ? 0.55
                                : enemy.state === STATE.ALERT  ? 0.32
                                : enemy.state === STATE.SEARCH ? 0.20 : 0.10);
      const sig = Phaser.Math.Clamp(enemyNoise * 780 / Math.max(info.distance, 80), 0, 1);
      if (sig < 0.03) continue;

      const col = enemy.state === STATE.HUNT   ? 0xff3300
                : enemy.state === STATE.ALERT  ? 0xffbb00
                : enemy.state === STATE.SEARCH ? 0xdd9900
                                               : 0x44ffcc;
      contacts.push({ enemy, info, sig, col, bearing: info.bearing });
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
      const bright = Math.pow(fade, 0.65);   // nieliniowe — długo jasne, szybko zanika

      // Linia od centrum (zasięg nieznany — połowa radia)
      const lineEnd = s.revealed
        ? Math.min(1, s.dist / SONAR_WORLD_RANGE) * this.r
        : this.r * (0.35 + s.strength * 0.45);
      g.lineStyle(0.8 + s.strength * 1.5, s.col, bright * s.strength * 0.75);
      g.strokeLineShape(new Phaser.Geom.Line(
        this.cx, this.cy,
        this.cx + Math.cos(s.bearing) * lineEnd,
        this.cy + Math.sin(s.bearing) * lineEnd
      ));

      // Łuk na krawędzi tarczy
      const arcW   = 0.08 + s.strength * 0.18;
      const arcAlpha = bright * (0.55 + s.strength * 0.40);
      g.lineStyle(2 + s.strength * 3, s.col, arcAlpha);
      g.beginPath();
      g.arc(this.cx, this.cy, this.r - 3, s.bearing - arcW, s.bearing + arcW);
      g.strokePath();

      // Precyzyjny blip na odległości gdy pozycja znana
      if (s.revealed) {
        const scaledR = Math.min(1, s.dist / SONAR_WORLD_RANGE) * this.r;
        const bx = this.cx + Math.cos(s.bearing) * scaledR;
        const by = this.cy + Math.sin(s.bearing) * scaledR;
        g.fillStyle(s.col, bright * 0.90);
        g.fillCircle(bx, by, 3.5 + s.strength * 1.5);
      }
    }

    // ── Sweep line ────────────────────────────────────────────────────────────
    g.lineStyle(1.8, 0x4aff9a, 0.85);
    g.strokeLineShape(new Phaser.Geom.Line(
      this.cx, this.cy,
      this.cx + Math.cos(this.sweep) * this.r,
      this.cy + Math.sin(this.sweep) * this.r
    ));
    // Ogon świetlny
    for (let i = 0; i < 24; i++) {
      const a = this.sweep - (i / 24) * (Math.PI * 0.55);
      g.lineStyle(1.2, 0x4aff9a, (1 - i / 24) * 0.13);
      g.beginPath();
      g.arc(this.cx, this.cy, this.r, a - 0.04, a);
      g.strokePath();
    }

    // ── Żywe wskaźniki kontaktów (zawsze widoczne między sweepami) ───────────
    for (const c of contacts) {
      const col = c.col;

      // Ciągły łuk na krawędzi (subtelny — siła sygnału)
      const arcH = 0.04 + c.sig * 0.07;
      g.lineStyle(0.8 + c.sig * 1.2, col, c.sig * 0.35);
      g.beginPath();
      g.arc(this.cx, this.cy, this.r - 1, c.bearing - arcH, c.bearing + arcH);
      g.strokePath();

      // Pasek wykrycia (enemy namierza nas) — łuk od krawędzi ku centrum
      if (c.info.detectionLevel > 0.05) {
        const arcStart = this.r * 0.95;
        const arcEnd   = this.r * (0.95 - c.info.detectionLevel * 0.80);
        g.lineStyle(1.5 + c.info.detectionLevel * 2, col, c.info.detectionLevel * 0.70);
        g.strokeLineShape(new Phaser.Geom.Line(
          this.cx + Math.cos(c.bearing) * arcEnd,
          this.cy + Math.sin(c.bearing) * arcEnd,
          this.cx + Math.cos(c.bearing) * arcStart,
          this.cy + Math.sin(c.bearing) * arcStart
        ));
      }

      // HUNT — pulsujące zagrożenie na krawędzi
      if (c.enemy.state === STATE.HUNT) {
        const pulse = 0.55 + 0.45 * Math.sin(Date.now() * 0.011);
        const ex = this.cx + Math.cos(c.bearing) * (this.r - 7);
        const ey = this.cy + Math.sin(c.bearing) * (this.r - 7);
        g.fillStyle(0xff2200, pulse * 0.90);
        g.fillCircle(ex, ey, 5 + pulse * 2);
        g.lineStyle(1, 0xff6600, pulse * 0.70);
        g.strokeCircle(ex, ey, 8 + pulse * 4);
      }

      // Blip na dokładnej pozycji jeśli ujawniony przez ping
      if (c.enemy.revealTimer > 0 && c.info.distance <= SONAR_WORLD_RANGE) {
        const scaledR = (c.info.distance / SONAR_WORLD_RANGE) * this.r;
        const bx = this.cx + Math.cos(c.bearing) * scaledR;
        const by = this.cy + Math.sin(c.bearing) * scaledR;
        const bA = Math.min(1, c.enemy.revealTimer / 1.5);
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.009);

        g.fillStyle(col, bA * 0.95);
        g.fillCircle(bx, by, 5);
        g.lineStyle(1.5, col, bA * (0.35 + pulse * 0.50));
        g.strokeCircle(bx, by, 9 + pulse * 5);

        // Krzyżyk namierzania
        g.lineStyle(1, col, bA * 0.75);
        g.strokeLineShape(new Phaser.Geom.Line(bx - 9, by, bx + 9, by));
        g.strokeLineShape(new Phaser.Geom.Line(bx, by - 9, bx, by + 9));
      }

      // Triangulowana pozycja szacunkowa
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

    // ── Obramowanie ───────────────────────────────────────────────────────────
    g.lineStyle(1.2, 0x1a6a3a, 0.85);
    g.strokeCircle(this.cx, this.cy, this.r);
    // Drugi, jaśniejszy pierścień po wewnętrznej stronie
    g.lineStyle(0.5, 0x2aff6a, 0.15);
    g.strokeCircle(this.cx, this.cy, this.r - 2);

    // ── Trójkąt pozycji własnej ───────────────────────────────────────────────
    g.fillStyle(0xffffff, 0.95);
    g.fillTriangle(this.cx, this.cy - 6, this.cx - 3.5, this.cy + 3, this.cx + 3.5, this.cy + 3);
    g.lineStyle(0.8, 0x44ff9a, 0.55);
    g.strokeTriangle(this.cx, this.cy - 6, this.cx - 3.5, this.cy + 3, this.cx + 3.5, this.cy + 3);

    // ── Etykiety kontaktów ────────────────────────────────────────────────────
    for (let i = 0; i < this._labels.length; i++) {
      const label = this._labels[i];
      if (i >= contacts.length) { label.setAlpha(0); continue; }

      const c      = contacts[i];
      const labelR = this.r + 13;
      const lx     = this.cx + Math.cos(c.bearing) * labelR;
      const ly     = this.cy + Math.sin(c.bearing) * labelR;

      const colHex = c.enemy.state === STATE.HUNT   ? '#ff4444'
                   : c.enemy.state === STATE.ALERT  ? '#ffbb00'
                   : c.enemy.state === STATE.SEARCH ? '#dd9900'
                                                    : '#44ffcc';

      const stateStr = c.enemy.state === STATE.HUNT   ? '◆'
                     : c.enemy.state === STATE.ALERT  ? '▲'
                     : c.enemy.state === STATE.SEARCH ? '?'
                                                      : '·';

      label.setPosition(lx, ly);
      label.setText(`${stateStr}K${i + 1}`);
      label.setColor(colHex);
      label.setAlpha(Math.min(1, c.sig * 1.8));
    }
  }
}
