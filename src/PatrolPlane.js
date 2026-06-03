import Phaser from 'phaser';

const PLANE_SPEED      = 540;   // px/s
const FLY_Y            = -38;   // offset od SURFACE_Y (leci nad taflą)
const CHARGE_FALL_SPD  = 155;
const CHARGE_BLAST_R   = 85;
const DETECT_NOISE_THR = 0.35;  // próg hałasu do wykrycia przez MAD

export class PatrolPlane {
  constructor(scene, fromLeft) {
    this.scene    = scene;
    this.fromLeft = fromLeft;
    this.dir      = fromLeft ? 1 : -1;

    const SURF = scene.SURFACE_Y;
    const camX = scene.camX;
    const CW   = scene.sys.game.config.width;

    this.x = fromLeft ? (camX - 220) : (camX + CW + 220);
    this.y = SURF + FLY_Y;

    this.gfx     = scene.add.graphics().setDepth(13);
    this.charges = [];
    this._dropped      = false;
    this._warningGiven = false;
    this.destroyed     = false;
    this.recentExplosions = [];
  }

  update(dt, sub) {
    this.recentExplosions = [];

    this.x += this.dir * PLANE_SPEED * dt;

    // Usuń samolot gdy przekroczy granice świata + bufor
    if (this.x < -600 || this.x > this.scene.WORLD_W + 600) {
      this.destroyed = true;
      this.gfx.destroy();
      return;
    }

    // Wykrycie łodzi podwodnej
    if (!this._dropped) {
      const dx    = Math.abs(this.x - sub.x);
      const depth = sub.depthMetres;
      const noise = sub.noise ?? 0;

      let detected = false;
      // Wzrokowe — bardzo płytko
      if (dx < 320 && depth < 40) detected = true;
      // Akustyczne (pław hydrofonowych MAD) — większy zasięg przy hałasie
      if (dx < 520 && depth < 110 && noise > DETECT_NOISE_THR) detected = true;
      // Kawitacja — słyszalna z daleka
      if (dx < 420 && sub.cavitating && depth < 170) detected = true;
      // Aktywny ping gracza — samolot słyszy echo
      if (dx < 800 && sub._lastActivePingAge !== undefined && sub._lastActivePingAge < 6) detected = true;

      if (detected) {
        this._dropCharges(sub);
        this._dropped = true;
      }
    }

    this._updateCharges(dt, sub);
    this._draw();
  }

  _dropCharges(sub) {
    const SURF  = this.scene.SURFACE_Y;
    const FLOOR = this.scene.OCEAN_FLOOR_Y;

    // Szacuj gdzie łódź będzie gdy bomba osiągnie jej głębokość
    const fallTime = (sub.y - SURF) / CHARGE_FALL_SPD;
    const predX    = sub.x + (sub.vx || 0) * fallTime * 0.7;
    const predY    = Phaser.Math.Clamp(
      sub.y + (sub.vy || 0) * fallTime * 0.6,
      SURF + 20, FLOOR - 20
    );

    // 4 bomby w siatce ±X i ±głębokości
    const pattern = [
      { xOff:   0, yOff:   0 },
      { xOff:  70, yOff:  35 },
      { xOff: -70, yOff: -28 },
      { xOff: 130, yOff:  60 },
    ];
    for (const { xOff, yOff } of pattern) {
      const ty = Phaser.Math.Clamp(
        predY + yOff + Phaser.Math.Between(-22, 22),
        SURF + 20, FLOOR - 20
      );
      this.charges.push({
        x:       predX + xOff,
        y:       SURF + 4,
        targetY: ty,
        speed:   CHARGE_FALL_SPD + Math.random() * 28,
        exploded: false,
        explodeTimer: 0,
      });
    }
  }

  _updateCharges(dt, sub) {
    const SURF  = this.scene.SURFACE_Y;
    const FLOOR = this.scene.OCEAN_FLOOR_Y;

    for (const c of this.charges) {
      if (c.exploded) { c.explodeTimer -= dt; continue; }
      c.y += c.speed * dt;

      if (c.y >= c.targetY) {
        c.exploded     = true;
        c.explodeTimer = 0.55;

        const dx   = sub.x - c.x;
        const dy   = sub.y - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CHARGE_BLAST_R) {
          const ratio = 1 - dist / CHARGE_BLAST_R;
          const dmg   = Phaser.Math.Clamp(ratio * 0.30, 0.03, 0.30);
          if (sub.applyDamage) sub.applyDamage(dmg, 'BOMBA LOTNICZA');
          else sub.hull = Math.max(0, sub.hull - dmg);
        }
        this.recentExplosions.push({ x: c.x, y: c.y, dist });
      }
    }
    this.charges = this.charges.filter(c => !c.exploded || c.explodeTimer > 0);
  }

  _draw() {
    const g    = this.gfx;
    const cx   = this.x;
    const cy   = this.y;
    const camX = this.scene.camX;
    const CW   = this.scene.sys.game.config.width;

    g.clear();

    // Bomby rysowane zawsze (mogą być daleko od samolotu)
    this._drawCharges(g, camX, CW);

    // Samolot tylko gdy na ekranie
    if (cx < camX - 70 || cx > camX + CW + 70) return;

    const D = this.dir;  // 1 = leci w prawo

    // Kadłub
    g.fillStyle(0x242e3c);
    g.fillRect(cx - 22, cy - 3, 44, 6);

    // Highlight góry
    g.fillStyle(0x364656);
    g.fillRect(cx - 20, cy - 3, 40, 2);

    // Skrzydło główne
    g.fillStyle(0x1e2830);
    g.fillRect(cx - 30, cy - 1, 60, 3);
    g.fillStyle(0x364656);
    g.fillRect(cx - 28, cy - 1, 56, 1);

    // Statecznik pionowy (ogon po kierunku lotu odwrotnym)
    const tailX = cx - D * 20;
    g.fillStyle(0x1e2830);
    g.fillRect(tailX - 3, cy - 9, 6, 8);

    // Statecznik poziomy (ogon)
    g.fillStyle(0x242e3c);
    g.fillRect(tailX - 14, cy - 2, 28, 3);

    // Nos
    const noseX = cx + D * 22;
    g.fillStyle(0x4a5e70);
    g.fillRect(noseX, cy - 2, D * 5, 4);

    // Gondole silników
    g.fillStyle(0x141c24);
    g.fillRect(cx - 14, cy + 2, 10, 4);
    g.fillRect(cx +  4, cy + 2, 10, 4);

    // Spaliny — mały pixelowy "ogień"
    const exX1 = cx + (D > 0 ? -14 : 14);
    const exX2 = cx + (D > 0 ? -4  : 4);
    g.fillStyle(0x445566, 0.65);
    g.fillRect(exX1 - D * 2, cy + 3, D * -4, 2);
    g.fillRect(exX2 - D * 2, cy + 3, D * -4, 2);
  }

  _drawCharges(g, camX, CW) {
    for (const c of this.charges) {
      // Eksplozja
      if (c.exploded) {
        const pct = c.explodeTimer / 0.55;
        if (pct > 0.4) {
          g.fillStyle(0xff8800, Math.min(1, pct * 1.8));
          g.fillCircle(c.x, c.y, 16 + (1 - pct) * 22);
          g.fillStyle(0xffcc44, pct * 0.7);
          g.fillCircle(c.x, c.y, 8 + (1 - pct) * 10);
        }
        continue;
      }
      if (c.x < camX - 30 || c.x > camX + CW + 30) continue;

      // Spadająca bomba — mały walec
      g.fillStyle(0x2a2018);
      g.fillRect(c.x - 3, c.y - 6, 6, 10);
      g.fillStyle(0x4a3828);
      g.fillRect(c.x - 2, c.y - 6, 4, 2);   // stabilizator
      // Ślad powietrzny
      g.fillStyle(0x334455, 0.35);
      g.fillCircle(c.x, c.y + 8, 2);
    }
  }
}
