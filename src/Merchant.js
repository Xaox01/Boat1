import Phaser from 'phaser';
import { STATE } from './Enemy.js';

const MAX_CLASS_TIMER = 90;   // pozwól dojść do MERCHANT (>38s), ale nie WARSHIP

export class Merchant {
  constructor(scene, x, dir, label) {
    this.scene = scene;
    this.gfx   = scene.add.graphics().setDepth(9);

    this.x     = x;
    this.y     = scene.SURFACE_Y;
    this.dir   = dir;   // 1 = prawo, -1 = lewo
    this.label = label || 'STATEK';

    this.speed = 12 + Math.random() * 5;   // px/s — powolny statek cargo

    // Interfejs sonaru (kompatybilny z Enemy)
    this.state          = STATE.PATROL;
    this.tonal          = 6 + Math.random() * 6;    // 6–12 Hz — powolny wał cywilny (niżej niż wojenny)
    this.shipType       = 'MERCHANT';              // Ostateczna klasa po pełnej klasyfikacji
    this.contactClass   = 'UNK';
    this.classifyTimer  = 0;
    this.revealTimer    = 0;
    this.detectionLevel = 0;

    // Kadłub i stan
    this.hull      = 0.75;
    this.destroyed = false;

    // Kompatybilność z systemami Enemy (nie używane, ale wymagane)
    this.homingTorpedoes = [];
    this.asrocs          = [];
    this.charges         = [];

    // Flagi zdarzeń (reset co klatkę)
    this.recentExplosions = [];
    this.recentPingHit    = false;
    this.recentASROC      = false;

    this._bounceLeft  = 120;
    this._bounceRight = scene.WORLD_W - 120;
  }

  // Kompatybilne z Enemy.getContactInfo()
  getContactInfo(sub) {
    const dx       = this.x - sub.x;
    const dy       = this.y - sub.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const bearing  = Math.atan2(dy, dx);
    return { distance, bearing, detectionLevel: this.detectionLevel };
  }

  getVelocity() {
    return { vx: this.dir * this.speed, vy: 0 };
  }

  // Reaguje na aktywny ping — ujawnienie pozycji na PPI (bez alarmowania)
  receivePing(subX, subY) {
    this.revealTimer = Math.max(this.revealTimer, 5.0);
  }

  // Uproszczony onHit — brak broni, brak reakcji obronnej
  onHit() {}

  update(dt) {
    if (this.destroyed) return;

    this.recentExplosions = [];
    this.recentPingHit    = false;
    this.recentASROC      = false;

    this.revealTimer   = Math.max(0, this.revealTimer - dt);
    // Cap classifyTimer — cargo ship nigdy nie klasyfikuje się jako WARSHIP
    if (this.classifyTimer > MAX_CLASS_TIMER) this.classifyTimer = MAX_CLASS_TIMER;

    // Ruch — zawraca przy granicach świata
    this.x += this.dir * this.speed * dt;
    if (this.x >= this._bounceRight) { this.x = this._bounceRight; this.dir = -1; }
    if (this.x <= this._bounceLeft)  { this.x = this._bounceLeft;  this.dir =  1; }

    this._draw();
  }

  _draw() {
    const g = this.gfx;
    g.clear();

    const x = this.x;
    const y = this.y;
    const d = this.dir;   // 1 = prawa burta z przodu, -1 = lewa
    const hullDmg = this.hull < 0.5;

    // ── Kadłub główny ────────────────────────────────────────────────────────
    const hullCol = hullDmg ? 0x4a2a18 : 0x5a3820;
    g.fillStyle(hullCol, 0.96);
    g.beginPath();
    g.moveTo(x + d * 62,  y);
    g.lineTo(x + d * 48,  y - 10);
    g.lineTo(x - d * 52,  y - 10);
    g.lineTo(x - d * 64,  y - 3);
    g.lineTo(x - d * 64,  y + 8);
    g.lineTo(x - d * 52,  y + 10);
    g.lineTo(x + d * 48,  y + 10);
    g.closePath();
    g.fillPath();

    // Ciemniejszy spód kadłuba (line wodna)
    g.fillStyle(0x2a1808, 0.55);
    g.fillRect(x - d * 52, y + 3, d * 100, 7);

    // ── Ładownie — kontenery ─────────────────────────────────────────────────
    const boxCol = hullDmg ? 0x4a3820 : 0x6a4a28;
    g.fillStyle(boxCol, 0.88);
    g.fillRect(x - d * 35, y - 18, d * 55, 8);   // ładownia 1
    g.fillRect(x - d * 50, y - 18, d * 10, 8);   // ładownia 2

    // Luki ładunkowe (dividers)
    g.lineStyle(1, 0x3a2010, 0.55);
    g.strokeLineShape(new Phaser.Geom.Line(x - d * 12, y - 18, x - d * 12, y - 10));
    g.strokeLineShape(new Phaser.Geom.Line(x - d * 30, y - 18, x - d * 30, y - 10));

    // ── Mostekówka (rufowa) ──────────────────────────────────────────────────
    g.fillStyle(0x2a3a2a, 0.92);
    g.fillRect(x + d * 20, y - 22, d * 22, 12);

    // Szyby mostka
    g.fillStyle(0x3a5a4a, 0.65);
    g.fillRect(x + d * 22, y - 22, d * 4, 5);
    g.fillRect(x + d * 28, y - 22, d * 4, 5);
    g.fillRect(x + d * 34, y - 22, d * 4, 5);

    // ── Komin ────────────────────────────────────────────────────────────────
    g.fillStyle(0x1a1a12, 0.90);
    g.fillRect(x + d * 30, y - 28, d * 6, 10);
    // Dym gdy okręt porusza się (symulacja)
    if (Math.random() < 0.35) {
      g.fillStyle(0x444444, 0.18 + Math.random() * 0.10);
      g.fillCircle(x + d * 33 + Phaser.Math.Between(-4, 4), y - 30 - Phaser.Math.Between(0, 6), Phaser.Math.Between(3, 6));
    }

    // ── Maszt dziobowy ───────────────────────────────────────────────────────
    g.fillStyle(0x2a2a1a, 0.85);
    g.fillRect(x + d * 40, y - 26, d * 2, 14);

    // ── Linia dziobowa ───────────────────────────────────────────────────────
    g.fillStyle(0x4a3010, 0.75);
    g.beginPath();
    g.moveTo(x + d * 62, y);
    g.lineTo(x + d * 50, y - 5);
    g.lineTo(x + d * 48, y);
    g.closePath();
    g.fillPath();

    // ── Sygnalizacja nawigacyjna ─────────────────────────────────────────────
    g.fillStyle(0xff2222, 0.88); g.fillCircle(x - d * 57, y,  2);   // rufowe
    g.fillStyle(0x22dd22, 0.88); g.fillCircle(x + d * 58, y,  2);   // dziobowe

    // ── Uszkodzenia ──────────────────────────────────────────────────────────
    if (hullDmg) {
      const da = (0.5 - this.hull) * 5;
      g.lineStyle(1.5, 0xff4400, da * 0.90);
      g.strokeLineShape(new Phaser.Geom.Line(x - d * 20, y - 10, x - d * 8, y + 2));
      g.strokeLineShape(new Phaser.Geom.Line(x + d * 10, y - 7,  x + d * 22, y + 4));
      // Dym z uszkodzeń
      if (Math.random() < 0.30) {
        g.fillStyle(0x553322, 0.25);
        g.fillCircle(x + Phaser.Math.Between(-20, 20), y - Phaser.Math.Between(5, 14), Phaser.Math.Between(3, 7));
      }
    }
  }
}
