// Animacja wybuchu po trafieniu torpedą w okręt.
// Wzorowane na projekcie Czerwony Październik — Wystrzał Torpedy.
// Sekwencja: błysk → fale uderzeniowe → słup wody → odłamki → dym → ogień

import Phaser from 'phaser';

export class ImpactFX {
  constructor(scene) {
    this.scene   = scene;
    this.gfx     = scene.add.graphics().setDepth(8);
    this.fireGfx = scene.add.graphics().setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
    this._hits   = [];   // aktywne eksplozje
  }

  // ── Wywołane przy trafieniu torpedy ───────────────────────────────────────

  trigger(worldX, worldY) {
    const SURF = this.scene.SURFACE_Y;
    const ix   = worldX;
    const iy   = SURF;   // eksplozja zawsze na poziomie wody

    this._hits.push({
      ix, iy,          // pozycja eksplozji (world)
      t:  0,
      debris:     this._spawnDebris(ix, iy),
      fireParts:  [],
      emberParts: [],
      secondary: [
        { delay: 2.4, t: 0, done: false, ox: Phaser.Math.Between(-45, 45) },
        { delay: 5.6, t: 0, done: false, ox: Phaser.Math.Between(-65, 65) },
        { delay: 9.0, t: 0, done: false, ox: Phaser.Math.Between(-30, 30) },
      ],
    });

    // Trzęsienie kamery
    this.scene.cameras.main.shake(820, 0.012);
  }

  _spawnDebris(ix, iy) {
    const pieces = [];
    for (let i = 0; i < 18; i++) {
      const ang   = (Math.random() - 0.5) * Math.PI * 1.6 - Math.PI * 0.5;
      const spd   = 90 + Math.random() * 230;
      const col   = [0x221008, 0x442211, 0xff4400, 0x883300][Math.floor(Math.random() * 4)];
      pieces.push({
        x:    ix, y: iy,
        vx:   Math.cos(ang) * spd,
        vy:   Math.sin(ang) * spd,
        r:    2.5 + Math.random() * 5,
        col,
        angle: Math.random() * Math.PI * 2,
        angV:  (Math.random() - 0.5) * 9,
        life:  2.2 + Math.random() * 1.6,
        age:   0,
        done:  false,
      });
    }
    return pieces;
  }

  // ── Aktualizacja (każda klatka) ───────────────────────────────────────────

  update(dt, camX) {
    const g = this.gfx;
    g.clear();
    this.fireGfx.clear();

    for (let hi = this._hits.length - 1; hi >= 0; hi--) {
      const h = this._hits[hi];
      h.t += dt;
      if (h.t > 32) { this._hits.splice(hi, 1); continue; }

      const t    = h.t;
      const sx   = h.ix - camX;
      const sy   = h.iy;

      this._drawShockwaves(g, sx, sy, t);
      this._drawUnderwaterFlash(g, sx, sy, t);
      this._drawSurfaceBurst(g, sx, sy, t);
      this._drawWaterColumn(g, sx, sy, t);
      this._drawOilSlick(g, sx, sy, t);
      this._drawDebris(g, h, dt, camX, t);
      this._drawSmoke(g, sx, sy, t);
      this._updateImpactFire(h, dt, t, camX);
      this._drawSecondary(g, h, sx, sy, dt, t);
    }
  }

  // ── Fale uderzeniowe ──────────────────────────────────────────────────────

  _drawShockwaves(g, sx, sy, t) {
    const waves = [
      { delay: 0.00, dur: 1.8, maxR: 290, w: 2.5 },
      { delay: 0.12, dur: 2.2, maxR: 360, w: 1.8 },
      { delay: 0.28, dur: 2.8, maxR: 430, w: 1.2 },
    ];
    for (const wv of waves) {
      const wt = t - wv.delay;
      if (wt < 0 || wt > wv.dur) continue;
      const prog = wt / wv.dur;
      const r    = prog * wv.maxR;
      const a    = (1 - prog) * 0.6;
      g.lineStyle(wv.w * (1 - prog * 0.5), 0xaaccdd, a);
      g.strokeCircle(sx, sy, r);
      g.lineStyle(wv.w * 0.5, 0xffffff, a * 0.35);
      g.strokeCircle(sx, sy, r * 0.72);
    }
  }

  // ── Błysk podwodny ────────────────────────────────────────────────────────

  _drawUnderwaterFlash(g, sx, sy, t) {
    if (t >= 0.45) return;
    const prog = t / 0.45;
    const fade = 1 - prog;
    const r    = 14 + prog * 95;

    g.fillStyle(0xffffff, fade * 0.85);
    g.fillCircle(sx, sy + 12, r * 0.35);
    g.fillStyle(0xffee88, fade * 0.65);
    g.fillCircle(sx, sy + 12, r * 0.65);
    g.fillStyle(0xff8800, fade * 0.40);
    g.fillCircle(sx, sy + 12, r);

    // Rozbłysk na powierzchni
    g.fillStyle(0xffffff, fade * 0.50);
    g.fillEllipse(sx, sy, r * 1.6, r * 0.35);
  }

  // ── Wybuch na powierzchni (bryzgi) ────────────────────────────────────────

  _drawSurfaceBurst(g, sx, sy, t) {
    if (t >= 0.75) return;
    const prog = t / 0.75;
    const fade = 1 - prog;

    for (let i = 0; i < 20; i++) {
      const ang   = ((i / 20) * Math.PI) - Math.PI;   // półokrąg w górę
      const spd   = 90 + ((i * 37) % 130);
      const bx    = sx + Math.cos(ang) * spd * t * 1.9;
      const by    = sy + Math.sin(ang) * spd * t * 1.9 - 210 * t * t;
      if (by > sy + 8) continue;
      const r  = 4 + ((i * 17) % 9) * (1 - prog * 0.6);
      g.fillStyle(0xbbddff, fade * 0.72);
      g.fillCircle(bx, by, r);
    }

    // Centralna fontanna
    g.fillStyle(0xddeeff, fade * 0.55);
    g.fillEllipse(sx, sy - 18 * prog, 28 * prog, 40 * prog);
  }

  // ── Słup wody ─────────────────────────────────────────────────────────────

  _drawWaterColumn(g, sx, sy, t) {
    const start = 0.05;
    const end   = 4.6;
    if (t < start || t > end) return;

    const ct      = t - start;
    const RISE    = 0.85;
    const HOLD    = 1.30;
    const FALL    = 2.40;

    let colH, colW, alpha;
    if (ct < RISE) {
      const p = ct / RISE;
      colH  = p * p * 138;
      colW  = 16 + p * 14;
      alpha = Math.min(p * 2.5, 1) * 0.75;
    } else if (ct < RISE + HOLD) {
      const p = (ct - RISE) / HOLD;
      colH  = 138 - p * 28;
      colW  = 30 - p * 6;
      alpha = 0.68 - p * 0.12;
    } else {
      const p = (ct - RISE - HOLD) / FALL;
      colH  = 110 * (1 - p * p);
      colW  = 24 * (1 - p);
      alpha = (1 - p) * 0.48;
    }

    if (colH <= 0 || alpha <= 0) return;

    // Trzon kolumny
    g.fillStyle(0x99bbcc, alpha * 0.75);
    g.fillRect(sx - colW / 2, sy - colH, colW, colH);

    // Głowica
    const headW = colW * 1.8 + Math.sin(ct * 9) * 3;
    g.fillStyle(0xccddee, alpha * 0.60);
    g.fillEllipse(sx, sy - colH, headW, headW * 0.5);

    // Opadające strumienie wody (po fazie wzrostu)
    if (ct > 0.7) {
      const fp = Math.min((ct - 0.7) / 1.5, 1);
      for (let i = 0; i < 7; i++) {
        const side  = (i % 2 === 0 ? 1 : -1);
        const offX  = side * (colW * 0.5 + i * 5);
        const dropY = sy - colH * (0.15 + (i * 0.11)) + fp * 55;
        const dr    = 3 + (i % 3);
        g.fillStyle(0x88aacc, alpha * 0.5 * (1 - fp));
        g.fillEllipse(sx + offX, dropY, dr * 1.4, dr * 2.2);
      }
    }
  }

  // ── Plama oleju ───────────────────────────────────────────────────────────

  _drawOilSlick(g, sx, sy, t) {
    if (t < 0.25) return;
    const age   = Math.min(t - 0.25, 18);
    const slickR = 30 + age * 19;
    const alpha  = Math.min(age * 0.35, 0.65);

    g.fillStyle(0x100602, alpha * 0.80);
    g.fillEllipse(sx, sy + 3, slickR * 2.4, slickR * 0.42);

    // Tęczowe odbicia (olej)
    g.fillStyle(0x334455, alpha * 0.20);
    g.fillEllipse(sx - slickR * 0.2, sy + 3, slickR * 1.1, slickR * 0.22);
    g.fillStyle(0x553344, alpha * 0.14);
    g.fillEllipse(sx + slickR * 0.15, sy + 3, slickR * 0.80, slickR * 0.16);
  }

  // ── Odłamki (debris) ──────────────────────────────────────────────────────

  _drawDebris(g, h, dt, camX, t) {
    for (const d of h.debris) {
      if (d.done) continue;
      d.age += dt;
      if (d.age >= d.life) { d.done = true; continue; }

      d.vy    += 200 * dt;   // grawitacja
      d.x     += d.vx * dt;
      d.y     += d.vy * dt;
      d.angle += d.angV * dt;

      const sy2 = this.scene.SURFACE_Y;
      if (d.y > sy2 + 10) { d.done = true; continue; }

      const frac = 1 - d.age / d.life;
      const dx   = d.x - camX;
      const dy   = d.y;

      g.save();
      g.translateCanvas(dx, dy);
      g.rotateCanvas(d.angle);
      g.fillStyle(d.col, frac * 0.90);
      g.fillRect(-d.r, -d.r * 0.5, d.r * 2, d.r);
      g.restore();
    }
  }

  // ── Kolumna dymu ──────────────────────────────────────────────────────────

  _drawSmoke(g, sx, sy, t) {
    if (t < 0.25) return;
    const smokeT = t - 0.25;
    const count  = Math.min(Math.floor(smokeT / 0.32) + 2, 14);

    for (let i = 0; i < count; i++) {
      const age  = smokeT - i * 0.32;
      if (age < 0) continue;

      const jx  = Math.sin(i * 2.71 + 0.5) * 14;
      const fy  = sy - 38 - age * 30 - i * 16;
      const fr  = 12 + age * 9 + i * 5;
      const fa  = Math.max(0, 0.55 - age * 0.055) * Math.min(age * 2, 1);
      if (fa <= 0) continue;

      const col = i < 3 ? 0x080808 : (i < 7 ? 0x181210 : 0x251d14);
      g.fillStyle(col, fa);
      g.fillCircle(sx + jx, fy, fr);
    }
  }

  // ── Ogień (cząsteczkowy, additive blending) ───────────────────────────────

  _updateImpactFire(h, dt, t, camX) {
    if (t < 0.85) return;
    const fg     = this.fireGfx;
    const fireT  = t - 0.85;
    const slickR = 30 + (t - 0.25) * 19;
    const fade   = Math.max(0, 1 - fireT / 21.0) * Math.min(fireT * 0.75, 1);
    if (fade <= 0) { h.fireParts = []; h.emberParts = []; return; }

    // 3 źródła ognia wzdłuż plamy oleju
    const pools = [
      { ox: -slickR * 0.43, power: 0.90 },
      { ox: 0,              power: 1.25 },
      { ox:  slickR * 0.40, power: 0.80 },
    ];
    for (const pool of pools) {
      const n = Math.round(pool.power * 3 * dt * 60);
      for (let i = 0; i < n && h.fireParts.length < 140; i++) {
        h.fireParts.push({
          x:       h.ix + pool.ox + (Math.random() - 0.5) * 22,
          y:       h.iy - 4 + (Math.random() - 0.5) * 4,
          vx:      (Math.random() - 0.5) * 20,
          vy:      -(50 + Math.random() * 70) * pool.power,
          life:    0,
          maxLife: 0.8 + Math.random() * 1.0,
          size:    6 + Math.random() * 10 * pool.power,
          seed:    Math.random() * 1000,
        });
      }
      if (Math.random() < pool.power * 0.3 * dt && h.emberParts.length < 45) {
        h.emberParts.push({
          x:       h.ix + pool.ox + (Math.random() - 0.5) * 22,
          y:       h.iy - 8,
          vx:      (Math.random() - 0.5) * 52,
          vy:      -(100 + Math.random() * 80),
          life:    0,
          maxLife: 1.2 + Math.random() * 1.2,
          seed:    Math.random() * 1000,
        });
      }
    }

    // Fizyka + rysowanie cząsteczek ognia
    for (let i = h.fireParts.length - 1; i >= 0; i--) {
      const p = h.fireParts[i];
      p.life += dt;
      if (p.life >= p.maxLife) { h.fireParts.splice(i, 1); continue; }
      p.x  += p.vx * dt;
      p.y  += p.vy * dt;
      p.vy -= 60 * dt;
      p.vx += Math.sin(p.life * 7.2 + p.seed) * 15 * dt;
      p.vx *= 1 - dt * 0.10;

      const tk = p.life / p.maxLife;
      let a;
      if      (tk < 0.08) a = (tk / 0.08) * 0.65;
      else if (tk < 0.70) a = 0.65;
      else                a = Math.max(0, 0.65 * (1 - (tk - 0.70) / 0.30));
      a *= fade;
      if (a <= 0.01) continue;
      const sx = p.x - camX;
      const r  = p.size * (1 + tk * 0.45);
      fg.fillStyle(0xde4e1e, a * 0.14); fg.fillCircle(sx, p.y, r * 2.0);
      fg.fillStyle(0xff9838, a * 0.32); fg.fillCircle(sx, p.y, r * 1.3);
      const core = tk < 0.25 ? 0xfffce4 : (tk < 0.55 ? 0xffde82 : (tk < 0.80 ? 0xff9838 : 0xde4e1e));
      fg.fillStyle(core,    a * 0.55); fg.fillCircle(sx, p.y, r * 0.65);
    }

    // Fizyka + rysowanie iskier
    for (let i = h.emberParts.length - 1; i >= 0; i--) {
      const p = h.emberParts[i];
      p.life += dt;
      if (p.life >= p.maxLife) { h.emberParts.splice(i, 1); continue; }
      p.x += p.vx * dt + Math.sin(p.life * 11 + p.seed) * 20 * dt;
      p.y += p.vy * dt;
      p.vy += 45 * dt;
      p.vx *= 1 - dt * 0.50;

      const tk = p.life / p.maxLife;
      const fl = 0.55 + Math.sin(p.life * 22 + p.seed) * 0.45;
      const a  = (1 - tk) * fl * fade;
      if (a <= 0.02) continue;
      fg.fillStyle(tk < 0.5 ? 0xffee44 : 0xff9900, a * 0.88);
      fg.fillCircle(p.x - camX, p.y, 1.4 + fl * 0.9);
    }
  }

  // ── Wtórne eksplozje ──────────────────────────────────────────────────────

  _drawSecondary(g, h, sx, sy, dt, t) {
    for (const sb of h.secondary) {
      if (sb.done || t < sb.delay) continue;
      const st   = t - sb.delay;
      if (st > 0.85) { sb.done = true; continue; }

      const prog = st / 0.85;
      const r    = 8 + prog * 58;
      const bx   = sx + sb.ox;

      // Błysk
      if (prog < 0.25) {
        const ff = (0.25 - prog) / 0.25;
        g.fillStyle(0xffffff, ff * 0.75);
        g.fillCircle(bx, sy, r * 0.3);
      }

      g.fillStyle(0xffaa00, (1 - prog) * 0.65);
      g.fillCircle(bx, sy, r * 0.5);
      g.fillStyle(0xff5500, (1 - prog) * 0.40);
      g.fillCircle(bx, sy, r);
      g.lineStyle(1.5, 0xff8800, (1 - prog) * 0.50);
      g.strokeCircle(bx, sy, r * 1.5);

      // Małe bryzgi
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI - Math.PI * 0.5;
        const bxd = bx + Math.cos(ang) * r * 0.9;
        const byd = sy + Math.sin(ang) * r * 0.9 - 55 * st;
        if (byd > sy) continue;
        g.fillStyle(0xbbddff, (1 - prog) * 0.52);
        g.fillCircle(bxd, byd, 3 + prog * 4);
      }
    }
  }
}
