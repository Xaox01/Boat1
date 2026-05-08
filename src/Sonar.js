import Phaser from 'phaser';
import { STATE } from './Enemy.js';

const SONAR_WORLD_RANGE = 780;   // world-px shown on full sonar radius

export class Sonar {
  constructor(scene, x, y, radius) {
    this.scene = scene;
    this.cx    = x;
    this.cy    = y;
    this.r     = radius;
    this.gfx   = scene.add.graphics().setDepth(20);
    this.sweep = 0;
  }

  update(delta, sub, enemies) {
    const dt = delta / 1000;
    this.sweep = (this.sweep + dt * 0.65) % (Math.PI * 2);

    const g = this.gfx;
    g.clear();

    // ── Background ────────────────────────────────────────────────────────
    g.fillStyle(0x001a0a, 0.90);
    g.fillCircle(this.cx, this.cy, this.r);

    // Grid
    g.lineStyle(0.5, 0x0a3a1a, 0.35);
    for (let i = 1; i <= 3; i++) {
      g.strokeCircle(this.cx, this.cy, (this.r / 3) * i);
    }
    g.strokeLineShape(new Phaser.Geom.Line(this.cx - this.r, this.cy, this.cx + this.r, this.cy));
    g.strokeLineShape(new Phaser.Geom.Line(this.cx, this.cy - this.r, this.cx, this.cy + this.r));

    // ── Sweep ─────────────────────────────────────────────────────────────
    g.lineStyle(1.5, 0x4aff9a, 0.8);
    g.strokeLineShape(new Phaser.Geom.Line(
      this.cx, this.cy,
      this.cx + Math.cos(this.sweep) * this.r,
      this.cy + Math.sin(this.sweep) * this.r
    ));
    for (let i = 0; i < 20; i++) {
      const a = this.sweep - (i / 20) * (Math.PI / 2);
      g.lineStyle(1, 0x4aff9a, (1 - i / 20) * 0.12);
      g.beginPath();
      g.arc(this.cx, this.cy, this.r, a - 0.06, a);
      g.strokePath();
    }

    // ── Enemy contacts ────────────────────────────────────────────────────
    for (const enemy of enemies) {
      const info = enemy.getContactInfo(sub);
      if (info.distance > SONAR_WORLD_RANGE) continue;

      const scaledR = (info.distance / SONAR_WORLD_RANGE) * this.r;
      const ex = this.cx + Math.cos(info.bearing) * scaledR;
      const ey = this.cy + Math.sin(info.bearing) * scaledR;

      const col = info.state === STATE.HUNT   ? 0xff3300
                : info.state === STATE.ALERT  ? 0xffbb00
                : info.state === STATE.SEARCH ? 0xcc8800
                                              : 0x44ff88;

      // Detection threat line (grows toward sub as detection rises)
      if (info.detectionLevel > 0.05) {
        const lineAlpha = info.detectionLevel * 0.55;
        g.lineStyle(1 + info.detectionLevel, col, lineAlpha);
        // Line from contact dot toward sonar center (enemy sees US)
        const tipX = this.cx + Math.cos(info.bearing) * scaledR * (1 - info.detectionLevel * 0.9);
        const tipY = this.cy + Math.sin(info.bearing) * scaledR * (1 - info.detectionLevel * 0.9);
        g.strokeLineShape(new Phaser.Geom.Line(ex, ey, tipX, tipY));
      }

      // Contact dot
      g.fillStyle(col, 0.88);
      g.fillCircle(ex, ey, info.state === STATE.HUNT ? 5 : 3.5);

      // Pulsing ring on hunting contacts
      if (info.state === STATE.HUNT) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.008);
        g.lineStyle(1, col, 0.4 + pulse * 0.4);
        g.strokeCircle(ex, ey, 7 + pulse * 4);
      }
    }

    // ── Danger arc at sub's position (threats from all hunting enemies) ───
    const hunters = enemies.filter(e => e.state === STATE.HUNT);
    if (hunters.length > 0) {
      for (const h of hunters) {
        const info = h.getContactInfo(sub);
        // Red arc segment at center pointing toward threat
        const arcHalf = 0.5;
        g.lineStyle(3, 0xff3300, 0.55);
        g.beginPath();
        g.arc(this.cx, this.cy, 12,
          info.bearing - arcHalf, info.bearing + arcHalf);
        g.strokePath();
      }
    }

    // ── Border + label ────────────────────────────────────────────────────
    g.lineStyle(1, 0x1a5a3a, 0.8);
    g.strokeCircle(this.cx, this.cy, this.r);

    // "SONAR PASYWNY" label
    g.lineStyle(0, 0, 0);
    // (text via Phaser Text object would need a separate setup — skipped for simplicity)

    // ── Own position ──────────────────────────────────────────────────────
    g.fillStyle(0xffffff, 0.95);
    g.fillTriangle(
      this.cx, this.cy - 6,
      this.cx - 3, this.cy + 3,
      this.cx + 3, this.cy + 3
    );
  }
}
