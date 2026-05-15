// Efekty wizualne wystrzelenia torpedy:
// - Celownik (reticle) z LOCK/ARM nad wrogiem
// - Linia namiaru (firing solution)
// - Burst sprężonego powietrza przy odpaleniu
// - Animacja drzwi wyrzutni na dziobie

import Phaser from 'phaser';

const RED    = 0xe8413a;
const AMBER  = 0xffcc44;
const INK    = 0xc8d8e0;
const DIM    = 0x4a7788;

export class TorpedoLaunchFX {
  constructor(scene) {
    this.scene = scene;

    // Grafika nad ocenem, pod HUD-em
    this.gfx = scene.add.graphics().setDepth(16);

    // Aktywne bursts [{ x, y, t, maxT }]
    this._bursts = [];

    // Stan celownika
    this._aimEnemy   = null;   // Enemy pod celownikiem
    this._lockTimer  = 0;      // 0→LOCK_TIME = lock
    this._locked     = false;
    this._solFade    = 0;      // 0→1 zanik linii namiaru po strzale

    // Stan drzwi wyrzutni (używa Submarine.js przez referencję)
    this._doorTimer  = 0;      // >0 = otwarte/animowane
    this._DOOR_DUR   = 1.8;    // sekundy

    this.LOCK_TIME   = 1.2;    // sekundy do lock
  }

  // ── Wywołane gdy torpeda odpalona ─────────────────────────────────────────

  onFire(tubeX, tubeY) {
    // Burst sprężonego powietrza
    this._bursts.push({ x: tubeX, y: tubeY, t: 0, maxT: 0.7 });

    // Drzwi wyrzutni otwarte przez DOOR_DUR sekund
    this._doorTimer = this._DOOR_DUR;

    // Linia namiaru znika
    this._solFade = 1.0;
  }

  // Czytelny getter dla Submarine.js: ile razy otwarte drzwi (0=zamknięte, 1=pełny luz)
  get doorOpenFraction() {
    if (this._doorTimer <= 0) return 0;
    const t = this._doorTimer / this._DOOR_DUR;
    if (t > 0.85) return (1 - t) / 0.15;   // otwieranie
    if (t < 0.15) return t / 0.15;          // zamykanie
    return 1;
  }

  // ── Główna aktualizacja (każda klatka) ────────────────────────────────────

  update(dt, camX) {
    const g   = this.gfx;
    const sub = this.scene.sub;
    g.clear();

    // Timery
    if (this._doorTimer  > 0) this._doorTimer  = Math.max(0, this._doorTimer  - dt);
    if (this._solFade    > 0) this._solFade    = Math.max(0, this._solFade    - dt * 1.4);

    // Aktualizuj celownik
    this._updateAim(dt, camX);

    // Rysuj
    this._drawReticle(camX);
    this._drawSolutionLine(camX);
    this._drawBursts(dt, camX);
  }

  // ── Wykrywanie celu pod myszą ─────────────────────────────────────────────

  _updateAim(dt, camX) {
    const ptr    = this.scene.input.mousePointer;
    const mouseX = ptr.x + camX;
    const mouseY = ptr.y;
    const sub    = this.scene.sub;

    // Znajdź najbliższego wroga do kursora w promieniu 220px
    let best = null, bestD = 220;
    for (const e of this.scene.enemies) {
      if (e._sinking || e.destroyed) continue;
      const d = Math.hypot(e.x - mouseX, e.y - mouseY);
      if (d < bestD) { best = e; bestD = d; }
    }

    if (best !== this._aimEnemy) {
      this._aimEnemy  = best;
      this._lockTimer = 0;
      this._locked    = false;
    }

    if (this._aimEnemy) {
      this._lockTimer = Math.min(this._lockTimer + dt, this.LOCK_TIME);
      this._locked    = this._lockTimer >= this.LOCK_TIME;
    }
  }

  // ── Celownik (reticle) ────────────────────────────────────────────────────

  _drawReticle(camX) {
    if (!this._aimEnemy) return;
    const e      = this._aimEnemy;
    const t      = Date.now() * 0.001;
    const sx     = e.x - camX;
    const sy     = e.y;
    const locked = this._locked;
    const prog   = this._lockTimer / this.LOCK_TIME;

    const pulse  = Math.sin(t * 6) * 0.5 + 0.5;
    const col    = locked ? RED : Phaser.Display.Color.GetColor(255, 180 + pulse * 50, 0);
    const r      = 28 + (locked ? 0 : pulse * 7);
    const fade   = Math.min(prog * 3, 1);

    const g = this.gfx;
    g.lineStyle(1.4, col, fade * (locked ? 0.9 : 0.65));

    // Koło
    g.strokeCircle(sx, sy, r);

    // Krzyż — 4 odcinki z przerwą na środku
    const gap = r * 0.35;
    const ext = 10;
    g.lineStyle(1.6, col, fade);
    g.strokeLineShape(new Phaser.Geom.Line(sx - r - ext, sy, sx - r + gap, sy));
    g.strokeLineShape(new Phaser.Geom.Line(sx + r - gap, sy, sx + r + ext, sy));
    g.strokeLineShape(new Phaser.Geom.Line(sx, sy - r - ext, sx, sy - r + gap));
    g.strokeLineShape(new Phaser.Geom.Line(sx, sy + r - gap, sx, sy + r + ext));

    // Narożniki (corner brackets)
    const bk = r * 0.82, blen = 9;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    g.lineStyle(1.8, col, fade);
    for (const [cx, cy] of corners) {
      const bx = sx + cx * bk, by = sy + cy * bk;
      g.strokeLineShape(new Phaser.Geom.Line(bx, by, bx - cx * blen, by));
      g.strokeLineShape(new Phaser.Geom.Line(bx, by, bx, by - cy * blen));
    }

    // Pasek progresu (arc wokół koła — wypełnia się do lock)
    if (!locked) {
      const arcLen  = prog * Math.PI * 2;
      const segs    = 32;
      g.lineStyle(2, col, 0.6);
      g.beginPath();
      for (let i = 0; i <= segs; i++) {
        const a  = -Math.PI / 2 + (arcLen * i / segs);
        const px = sx + Math.cos(a) * (r + 4);
        const py = sy + Math.sin(a) * (r + 4);
        i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
      }
      g.strokePath();
    }

    // Etykieta statusu
    const label = locked ? '● LOCK' : `○ ARM ${Math.round(prog * 100)}%`;
    const lc    = Phaser.Display.Color.IntegerToColor(col);
    const css   = `rgba(${lc.red},${lc.green},${lc.blue},${fade})`;
    // rysujemy małymi pionowymi kreskami jako "tekst" w Phaser Graphics...
    // zamiast tego: billboard przez istniejącą warstwę scene.add.text (tworzony raz)
    if (!this._labelText) {
      this._labelText = this.scene.add.text(0, 0, '', {
        fontFamily: '"Courier New", monospace',
        fontSize: '11px',
        color: '#e8413a',
        stroke: '#000000',
        strokeThickness: 3,
        letterSpacing: 2,
      }).setDepth(17);
    }
    this._labelText
      .setPosition(sx + r + 12 - camX, sy + 3)
      .setText(label)
      .setAlpha(fade)
      .setColor(locked ? '#e8413a' : '#ffcc44');
  }

  // ── Linia namiaru (firing solution) ──────────────────────────────────────

  _drawSolutionLine(camX) {
    const sub = this.scene.sub;
    if (!this._aimEnemy && this._solFade <= 0) {
      // nic do rysowania
      return;
    }

    const target = this._aimEnemy;
    const prog   = this._aimEnemy ? (this._lockTimer / this.LOCK_TIME) : 0;
    const alpha  = this._aimEnemy
      ? Math.min(prog * 2, 0.65)
      : this._solFade * 0.5;   // zanik po strzale

    if (alpha <= 0.02) return;

    // Punkt wyjścia torpedy (dziób łódki)
    const txS  = sub.x + 48 - camX;
    const tyS  = sub.y;
    const txE  = (target ?? { x: sub.x + 500, y: sub.y }).x - camX;
    const tyE  = (target ?? { x: sub.x + 500, y: sub.y }).y;

    const dx   = txE - txS;
    const dy   = tyE - tyS;
    const dist = Math.hypot(dx, dy);
    const col  = this._locked ? RED : AMBER;

    const g = this.gfx;
    g.lineStyle(0.9, col, alpha);

    // Przerywana linia — ręczny dashing co 9px
    const segs = Math.floor(dist / 9);
    for (let i = 0; i < segs; i += 2) {
      const a0 = i / segs, a1 = Math.min((i + 1) / segs, 1);
      g.strokeLineShape(new Phaser.Geom.Line(
        txS + dx * a0, tyS + dy * a0,
        txS + dx * a1, tyS + dy * a1,
      ));
    }

    // Znaczniki 1/4 dystansu
    for (const k of [0.25, 0.5, 0.75]) {
      const mx  = txS + dx * k, my = tyS + dy * k;
      const nx  = -dy / dist * 5, ny = dx / dist * 5;
      g.lineStyle(1, col, alpha * 0.8);
      g.strokeLineShape(new Phaser.Geom.Line(mx - nx, my - ny, mx + nx, my + ny));
    }

    // Etykieta środkowa: DYST · NAM
    if (!this._solLabel) {
      this._solLabel = this.scene.add.text(0, 0, '', {
        fontFamily: '"Courier New", monospace',
        fontSize: '10px',
        color: '#ffcc44',
        backgroundColor: '#000000cc',
        padding: { x: 5, y: 2 },
        stroke: '#000000',
        strokeThickness: 2,
      }).setDepth(17);
    }
    const mid  = { x: txS + dx * 0.5, y: tyS + dy * 0.5 };
    const bear = ((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360;
    const km   = (dist / 100).toFixed(1);   // 100px ≈ 1km w grze
    this._solLabel
      .setPosition(mid.x - camX + 8, mid.y - 22)
      .setText(`DYST ${km}km  NAM ${bear.toFixed(0)}°`)
      .setAlpha(alpha * 1.5)
      .setColor(this._locked ? '#e8413a' : '#ffcc44');
  }

  // ── Bursts (sprężone powietrze) ────────────────────────────────────────────

  _drawBursts(dt, camX) {
    const g = this.gfx;
    for (let i = this._bursts.length - 1; i >= 0; i--) {
      const b = this._bursts[i];
      b.t += dt;
      if (b.t >= b.maxT) { this._bursts.splice(i, 1); continue; }

      const prog  = b.t / b.maxT;
      const fade  = 1 - prog;
      const r     = 5 + prog * 95;
      const sx    = b.x - camX, sy = b.y;

      // Pierścień zewnętrzny
      g.lineStyle(2.2, INK, fade * 0.85);
      g.strokeCircle(sx, sy, r);

      // Pierścień wewnętrzny
      g.lineStyle(1.4, INK, fade * 0.6);
      g.strokeCircle(sx, sy, r * 0.55);

      // Bąble na obwodzie
      for (let j = 0; j < 12; j++) {
        const ang  = (j / 12) * Math.PI * 2;
        const jitter = 0.35 + ((j * 73) % 100) / 200;
        const bx   = sx + Math.cos(ang) * r * jitter;
        const by   = sy + Math.sin(ang) * r * jitter * 0.85;
        const br   = 2.5 + ((j * 37) % 6);
        g.lineStyle(0.9, INK, fade * 0.55);
        g.strokeCircle(bx, by, br);
      }

      // Błysk wewnętrzny (tylko pierwsza faza)
      if (prog < 0.25) {
        const flashFade = (0.25 - prog) / 0.25;
        g.fillStyle(RED, flashFade * 0.7);
        g.fillCircle(sx, sy, 8 + prog * 28);
      }
    }
  }

  // ── Czyszczenie ───────────────────────────────────────────────────────────

  destroy() {
    this.gfx.destroy();
    this._labelText?.destroy();
    this._solLabel?.destroy();
  }
}
