// Animacja wybuchu — dwa tryby: surface (przy tafli) i underwater (pod wodą/dno)
// Additive blending (fireGfx) dla bloom/glow; normalny (gfx) dla wody i dymu.

import Phaser from 'phaser';

function rand(a, b) { return a + Math.random() * (b - a); }
function ranSign()  { return Math.random() < 0.5 ? -1 : 1; }
const G    = 460;
const WIND = -14;

function fireColor(t) {
  if (t < 0.10) return [255, 252, 228];
  if (t < 0.26) return [255, 222, 130];
  if (t < 0.48) return [255, 148,  52];
  if (t < 0.72) return [222,  74,  28];
  if (t < 0.90) return [120,  30,  18];
  return [40, 12, 8];
}
function fireAlpha(t) {
  if (t < 0.07) return (t / 0.07) * 0.88;
  if (t < 0.70) return 0.88;
  return Math.max(0, 0.88 * (1 - (t - 0.70) / 0.30));
}

export class ImpactFX {
  constructor(scene) {
    this.scene   = scene;
    this.gfx     = scene.add.graphics().setDepth(8);
    this.fireGfx = scene.add.graphics().setDepth(9).setBlendMode(Phaser.BlendModes.ADD);
    this._hits   = [];
  }

  trigger(worldX, worldY) {
    const SURF       = this.scene.SURFACE_Y;
    const iy         = (worldY !== undefined) ? worldY : SURF;
    const depth      = Math.max(0, iy - SURF);
    const underwater = depth > 30;
    // surfDelay: czas [s] aż bąble i fala dotrą do tafli
    const surfDelay  = underwater ? Math.min(depth / 130, 3.0) : 0;

    this._hits.push({
      ix: worldX, iy, surfY: SURF,
      depth, underwater, surfDelay,
      t: 0,
      fire:        [],
      surfaceFire: [],
      water:       [],
      smoke:       [],
      steam:       [],
      embers:      [],
      seaSparks:   [],
      oilFires:    [],
      bubbles:     [],   // podwodne bąble gazowe
      sediment:    [],   // osad denny
      debris:      this._spawnDebris(worldX, iy, underwater),
      secondary: underwater ? [
        { delay: surfDelay + 0.5, done: false, ox: Phaser.Math.Between(-40, 40) },
        { delay: surfDelay + 2.2, done: false, ox: Phaser.Math.Between(-60, 60) },
      ] : [
        { delay: 2.4, done: false, ox: Phaser.Math.Between(-45, 45) },
        { delay: 5.6, done: false, ox: Phaser.Math.Between(-65, 65) },
        { delay: 9.0, done: false, ox: Phaser.Math.Between(-30, 30) },
      ],
    });
    this.scene.cameras.main.shake(820, underwater ? 0.018 : 0.012);
  }

  // Trafienie rakietą przeciw-okrętową: większy ogień, mniej wody, więcej pożarów wtórnych
  triggerMissile(worldX, worldY) {
    const SURF = this.scene.SURFACE_Y;
    const iy   = worldY ?? SURF;
    this._hits.push({
      ix: worldX, iy, surfY: SURF,
      depth: 0, underwater: false, surfDelay: 0,
      missile: true,
      t: 0,
      fire: [], surfaceFire: [], water: [], smoke: [], steam: [],
      embers: [], seaSparks: [], oilFires: [], bubbles: [], sediment: [],
      debris: this._spawnDebris(worldX, iy, false),
      secondary: [
        { delay: 0.9,  done: false, ox: Phaser.Math.Between(-35, 35) },
        { delay: 2.8,  done: false, ox: Phaser.Math.Between(-60, 60) },
        { delay: 5.2,  done: false, ox: Phaser.Math.Between(-45, 45) },
        { delay: 8.0,  done: false, ox: Phaser.Math.Between(-28, 28) },
      ],
    });
    this.scene.cameras.main.shake(580, 0.020);
  }

  _spawnDebris(ix, iy, underwater) {
    const count = underwater ? 14 : 22;
    const pieces = [];
    for (let i = 0; i < count; i++) {
      const ang   = rand(-Math.PI * 0.93, -Math.PI * 0.07);
      const speed = underwater ? rand(160, 400) : rand(280, 680);
      pieces.push({
        x: ix, y: iy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        rot: Math.random() * Math.PI * 2,
        vrot: rand(-11, 11),
        life: 0, maxLife: rand(2.2, 4.2),
        size: rand(3, 10),
        shape: Math.floor(Math.random() * 5),
        hot: !underwater && Math.random() < 0.38,
        hotLife: 0, landed: false,
      });
      const last = pieces[pieces.length - 1];
      last.hotLife = last.hot ? rand(0.4, 1.2) : 0;
    }
    return pieces;
  }

  // ── Główna pętla ──────────────────────────────────────────────────────────

  update(dt, camX) {
    const g  = this.gfx;
    const fg = this.fireGfx;
    g.clear();
    fg.clear();

    for (let hi = this._hits.length - 1; hi >= 0; hi--) {
      const h = this._hits[hi];
      h.t += dt;
      if (h.t > 34) { this._hits.splice(hi, 1); continue; }

      const t   = h.t;
      const sx  = h.ix - camX;   // X ekran (punkt wybuchu)
      const sy  = h.iy;           // Y punkt wybuchu
      const ssy = h.surfY;        // Y tafli wody

      this._spawn(h, dt, t);
      this._physics(h, dt);

      if (h.underwater) {
        this._drawUnderwaterPressureWave(fg, sx, sy, t);
        this._drawSediment(g, h, camX);
        this._drawBubbles(fg, g, h, camX, ssy);
        // Efekty na tafli — opóźnione o surfDelay
        const td = t - h.surfDelay;
        if (td > 0) {
          this._drawWaterShockwaves(fg, sx, ssy, td);
          this._drawOilSlick(g, sx, ssy, td);
          this._drawSmoke(g, h, camX);
          this._drawSurfaceFire(fg, h, camX);
          this._drawSeaSparks(fg, h, camX, ssy);
        }
      } else {
        this._drawWaterShockwaves(fg, sx, sy, t);
        this._drawAirShockwaves(g, sx, sy, t);
        this._drawUnderwaterGlow(fg, sx, sy, t);
        this._drawOilSlick(g, sx, sy, t);
        this._drawSmoke(g, h, camX);
        this._drawSteam(g, h, camX);
        this._drawWater(g, h, camX, sy);
        this._drawFire(fg, h, camX);
        this._drawSurfaceFire(fg, h, camX);
        this._drawOilFires(fg, g, h, camX, sy, t);
        this._drawEmbers(fg, h, camX);
        this._drawSeaSparks(fg, h, camX, sy);
        this._drawScreenFlash(fg, sx, sy, t);
      }

      // Odłamki i wybuchy wtórne — zawsze, lądują na tafli
      this._drawDebris(g, fg, h, camX, ssy);
      this._drawSecondary(g, fg, h, sx, ssy, dt, t);
    }
  }

  // ── Spawn ─────────────────────────────────────────────────────────────────

  _spawn(h, dt, t) {
    if (h.underwater) this._spawnUnderwater(h, dt, t);
    else              this._spawnSurface(h, dt, t);
  }

  _spawnSurface(h, dt, t) {
    const ix = h.ix, iy = h.iy, surfY = h.surfY;

    // Fireball — rakieta: większy, intensywniejszy
    const fxMax = h.missile ? 320 : 220;
    const fxMul = h.missile ? 1.65 : 1.0;
    if (t < 2.0 && h.fire.length < fxMax) {
      const rateF = t < 0.05 ? 380 : t < 0.3 ? 150 : t < 0.7 ? 55 : t < 1.2 ? 22 : 8;
      const n = Math.ceil(rateF * fxMul * dt);
      for (let i = 0; i < n && h.fire.length < fxMax; i++) {
        const ang   = rand(-Math.PI * 0.95, -Math.PI * 0.05);
        const base  = t < 0.1 ? rand(200, h.missile ? 580 : 500) : t < 0.5 ? rand(110, h.missile ? 300 : 260) : rand(38, h.missile ? 150 : 130);
        const spike = Math.random() < 0.08 && t < 0.3;
        h.fire.push({
          x: ix + (Math.random() - 0.5) * (h.missile ? 26 : 18), y: iy - rand(0, h.missile ? 30 : 22),
          vx: Math.cos(ang) * (spike ? base * 2.2 : base) + (Math.random() - 0.5) * (h.missile ? 70 : 55),
          vy: Math.sin(ang) * (spike ? base * 2.2 : base) - rand(h.missile ? 22 : 18, h.missile ? 88 : 70),
          life: 0, maxLife: spike ? rand(0.3, 0.6) : rand(h.missile ? 0.80 : 0.65, h.missile ? 1.85 : 1.5),
          size: t < 0.1 ? rand(h.missile ? 34 : 28, h.missile ? 82 : 66) : rand(h.missile ? 20 : 16, h.missile ? 54 : 42),
          seed: Math.random() * 1000,
        });
      }
    }

    // Słup wody — rakieta: mniej (trafia w kadłub, nie w wodę)
    if (t > 0.10 && t < 2.5 && h.water.length < 180) {
      const rise = t < 1.4;
      const wxm  = h.missile ? 0.45 : 1.0;
      const rate = rise ? (t < 0.5 ? 110 : 60) : 18;
      const n    = Math.ceil(rate * wxm * dt);
      for (let i = 0; i < n && h.water.length < 180; i++) {
        if (rise) {
          const isCrown = t > 0.5 && Math.random() < 0.3;
          h.water.push({
            x: ix + (Math.random() - 0.5) * 55, y: iy - rand(0, 18),
            vx: (Math.random() - 0.5) * (36 + (1 - Math.min(1, t / 1.4)) * 70),
            vy: -rand(350, 680) * (1 - t * 0.28),
            life: 0, maxLife: rand(1.1, 2.2),
            size: isCrown ? rand(16, 32) : rand(7, 20), seed: Math.random() * 1000,
            foam: Math.random() < 0.38, crown: isCrown, landed: false,
          });
          if (Math.random() < 0.22) {
            h.steam.push({
              x: ix + (Math.random() - 0.5) * 28, y: iy - rand(18, 70),
              vx: WIND + (Math.random() - 0.5) * 16, vy: -rand(55, 125),
              life: 0, maxLife: rand(1.4, 3.0), size: rand(12, 24),
              sizeGrow: rand(38, 75), seed: Math.random() * 1000,
            });
          }
        } else {
          const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
          const spd = rand(150, 400);
          h.water.push({
            x: ix + (Math.random() - 0.5) * 110, y: iy - rand(360, 550),
            vx: Math.cos(ang) * spd + WIND * 2, vy: Math.sin(ang) * spd,
            life: 0, maxLife: rand(0.9, 1.7), size: rand(5, 13), seed: Math.random() * 1000,
            foam: Math.random() < 0.5, crown: false, landed: false,
          });
        }
      }
      if (t < 1.2 && h.seaSparks.length < 60) {
        const rn = Math.ceil(rand(2, 5) * dt * 60);
        for (let i = 0; i < rn && h.seaSparks.length < 60; i++) {
          const side = ranSign();
          h.seaSparks.push({
            x: ix + side * rand(35, 165 + t * 180), y: iy + rand(-4, 5),
            vx: side * rand(18, 72), vy: -rand(55, 185),
            life: 0, maxLife: rand(0.45, 1.0), size: rand(2.5, 7),
          });
        }
      }
    }

    // Dym — rakieta: więcej czarnego dymu (paliwo rakietowe)
    const smMax = h.missile ? 130 : 90;
    if (t > 0.2 && h.smoke.length < smMax) {
      const rateS = t < 1.0 ? 14 : t < 3.0 ? 8 : t < 6.0 ? 4 : 1;
      const n     = Math.ceil(rateS * (h.missile ? 1.55 : 1.0) * dt);
      for (let i = 0; i < n && h.smoke.length < smMax; i++) {
        const oily = Math.random() < (h.missile ? 0.80 : 0.55);
        h.smoke.push({
          x: ix + (Math.random() - 0.5) * 90, y: iy - rand(55, 180),
          vx: (Math.random() - 0.5) * 14 + WIND * 1.2, vy: -rand(45, 100),
          life: 0, maxLife: rand(5.5, 10), size: rand(24, 46),
          sizeGrow: rand(70, 145), seed: Math.random() * 1000,
          oily, dark: oily ? rand(0.7, 0.94) : rand(0.38, 0.68),
        });
      }
    }

    // Iskry
    if (t > 0.05 && t < 3.0 && h.embers.length < 100) {
      const rate = t < 0.5 ? 55 : t < 1.5 ? 20 : 6;
      const n    = Math.ceil(rate * dt);
      for (let i = 0; i < n && h.embers.length < 100; i++) {
        const ang = rand(-Math.PI * 0.95, -Math.PI * 0.05);
        const spd = rand(200, 500);
        h.embers.push({
          x: ix + (Math.random() - 0.5) * 28, y: iy - 9,
          vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
          life: 0, maxLife: rand(1.3, 2.8), seed: Math.random() * 1000,
        });
      }
    }

    // Ogniska paliwa — rakieta: więcej, szerszy rozkład (paliwo rozlewa się po pokładzie)
    if (t >= 1.4 && h.oilFires.length === 0) {
      const oilN = h.missile ? 18 : 10;
      const oilR = h.missile ? 460 : 340;
      for (let i = 0; i < oilN; i++) {
        const side = ranSign();
        h.oilFires.push({
          x: ix + side * rand(55, oilR), y: iy + rand(-2, 7),
          size: rand(h.missile ? 9 : 7, h.missile ? 22 : 16),
          delay: rand(h.missile ? 1.2 : 1.5, 3.5), seed: Math.random() * 1000,
        });
      }
    }

    // Ogień przy tafli — rakieta: większy rozkład, więcej płomieni
    const sfMax = h.missile ? 280 : 200;
    if (t > 0.28 && t < 3.5 && h.surfaceFire.length < sfMax) {
      const sfBase = t < 0.6 ? 110 : t < 1.2 ? 75 : t < 2.2 ? 45 : 20;
      const n      = Math.ceil(sfBase * (h.missile ? 1.35 : 1.0) * dt);
      const spread = (h.missile ? 32 : 22) + Math.min(t * (h.missile ? 38 : 28), h.missile ? 130 : 90);
      for (let i = 0; i < n && h.surfaceFire.length < 200; i++) {
        h.surfaceFire.push({
          x: ix + (Math.random() - 0.5) * spread * 2, y: surfY + rand(-4, 3),
          vx: (Math.random() - 0.5) * 20, vy: -(42 + Math.random() * 72),
          life: 0, maxLife: 0.65 + Math.random() * 0.85,
          size: 3 + Math.random() * 10, seed: Math.random() * 1000,
        });
      }
    }
  }

  _spawnUnderwater(h, dt, t) {
    const ix = h.ix, iy = h.iy, surfY = h.surfY;
    const td = t - h.surfDelay;

    // 1. Bąble gazowe — unoszą się z punktu wybuchu ku tafli
    if (t < 1.2 && h.bubbles.length < 80) {
      const rate = t < 0.06 ? 260 : t < 0.3 ? 85 : t < 0.7 ? 38 : 14;
      const n    = Math.ceil(rate * dt);
      for (let i = 0; i < n && h.bubbles.length < 80; i++) {
        const riseV = 110 + Math.random() * 55;
        h.bubbles.push({
          x: ix + (Math.random() - 0.5) * 55, y: iy + rand(-8, 8),
          vx: (Math.random() - 0.5) * 26, vy: -riseV,
          life: 0,
          maxLife: (iy - surfY) / riseV + rand(-0.1, 0.22),
          size: t < 0.1 ? rand(18, 52) : rand(5, 26),
          seed: Math.random() * 1000,
          hot: t < 0.15 && Math.random() < 0.45,
        });
      }
    }

    // 2. Osad/gruz przy dnie — rozchodzi się poziomo
    if (t < 0.6 && h.sediment.length < 100) {
      const rate = t < 0.08 ? 200 : t < 0.25 ? 75 : 28;
      const n    = Math.ceil(rate * dt);
      for (let i = 0; i < n && h.sediment.length < 100; i++) {
        const side = ranSign();
        h.sediment.push({
          x: ix + (Math.random() - 0.5) * 22, y: iy + rand(-5, 10),
          vx: side * rand(55, 270), vy: -rand(12, 50),
          life: 0, maxLife: rand(2.5, 5.0),
          size: rand(8, 24), seed: Math.random() * 1000,
        });
      }
    }

    // 3. Efekty na tafli (opóźnione o surfDelay)
    if (td > 0) {
      // Dym (mniejszy)
      if (td < 4.0 && h.smoke.length < 55) {
        const rate = td < 0.5 ? 9 : td < 2.0 ? 5 : 2;
        const n    = Math.ceil(rate * dt);
        for (let i = 0; i < n && h.smoke.length < 55; i++) {
          h.smoke.push({
            x: ix + (Math.random() - 0.5) * 65, y: surfY - rand(8, 55),
            vx: (Math.random() - 0.5) * 11 + WIND, vy: -rand(32, 75),
            life: 0, maxLife: rand(4.0, 8.0), size: rand(14, 30),
            sizeGrow: rand(45, 100), seed: Math.random() * 1000,
            oily: Math.random() < 0.4, dark: rand(0.38, 0.72),
          });
        }
      }

      // Iskry wody na tafli
      if (td < 0.8 && h.seaSparks.length < 50) {
        const rn = Math.ceil(rand(3, 7) * dt * 60);
        for (let i = 0; i < rn && h.seaSparks.length < 50; i++) {
          const side = ranSign();
          h.seaSparks.push({
            x: ix + side * rand(12, 75 + td * 100), y: surfY + rand(-3, 4),
            vx: side * rand(10, 50), vy: -rand(38, 130),
            life: 0, maxLife: rand(0.3, 0.8), size: rand(1.8, 5.0),
          });
        }
      }

      // Ogień paliwowy przy tafli (mniejszy — bez tlenu poniżej, pali się tylko na powierzchni)
      if (td > 0.1 && td < 2.5 && h.surfaceFire.length < 100) {
        const rate   = td < 0.5 ? 55 : td < 1.2 ? 35 : 14;
        const n      = Math.ceil(rate * dt);
        const spread = 10 + Math.min(td * 18, 50);
        for (let i = 0; i < n && h.surfaceFire.length < 100; i++) {
          h.surfaceFire.push({
            x: ix + (Math.random() - 0.5) * spread * 2, y: surfY + rand(-3, 3),
            vx: (Math.random() - 0.5) * 14, vy: -(28 + Math.random() * 48),
            life: 0, maxLife: 0.45 + Math.random() * 0.65,
            size: 2 + Math.random() * 6, seed: Math.random() * 1000,
          });
        }
      }
    }
  }

  // ── Fizyka ────────────────────────────────────────────────────────────────

  _physics(h, dt) {
    const surfY = h.surfY;

    for (let i = h.fire.length - 1; i >= 0; i--) {
      const p = h.fire[i];
      p.life += dt; if (p.life >= p.maxLife) { h.fire.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy -= 95 * dt;
      const sp = Math.hypot(p.vx, p.vy), drag = 0.8 + sp * 0.0015;
      p.vx *= 1 - drag * dt * 0.4; p.vy *= 1 - drag * dt * 0.22;
      p.vx += Math.sin(p.life * 9 + p.seed) * 28 * dt;
      p.vy += Math.cos(p.life * 7 + p.seed) * 18 * dt;
    }
    for (let i = h.surfaceFire.length - 1; i >= 0; i--) {
      const p = h.surfaceFire[i];
      p.life += dt; if (p.life >= p.maxLife) { h.surfaceFire.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy -= 58 * dt;
      p.vx += Math.sin(p.life * 7.2 + p.seed) * 14 * dt;
      p.vx *= 1 - dt * 0.12;
    }
    // Bąble podwodne — unoszą się, lekka turbulencja
    for (let i = h.bubbles.length - 1; i >= 0; i--) {
      const p = h.bubbles[i];
      p.life += dt;
      if (p.life >= p.maxLife || p.y <= surfY) { h.bubbles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy -= 20 * dt;  // gaz przyspiesza ku górze
      p.vx += Math.sin(p.life * 5.5 + p.seed) * 12 * dt;
      p.vx *= 1 - dt * 0.08;
    }
    // Osad denny — rozlewa się poziomo, opada z powrotem
    for (let i = h.sediment.length - 1; i >= 0; i--) {
      const p = h.sediment[i];
      p.life += dt; if (p.life >= p.maxLife) { h.sediment.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += G * 0.32 * dt;
      p.vx *= 1 - dt * 0.42;
    }
    for (let i = h.water.length - 1; i >= 0; i--) {
      const p = h.water[i];
      p.life += dt; if (p.life >= p.maxLife) { h.water.splice(i, 1); continue; }
      if (p.landed) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += G * dt * (p.crown ? 0.6 : 1);
      p.vx *= 1 - dt * 0.18;
      if (p.y > surfY + 3 && p.vy > 0) {
        p.landed = true;
        if (Math.random() < 0.35 && h.seaSparks.length < 80) {
          h.seaSparks.push({
            x: p.x, y: surfY - 2,
            vx: (Math.random() - 0.5) * 28, vy: -rand(28, 85),
            life: 0, maxLife: rand(0.28, 0.65), size: rand(1.8, 4.5),
          });
        }
      }
    }
    for (let i = h.smoke.length - 1; i >= 0; i--) {
      const p = h.smoke[i];
      p.life += dt; if (p.life >= p.maxLife) { h.smoke.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy -= 7 * dt; p.vx += WIND * dt * 0.5; p.vx *= 1 - dt * 0.14;
    }
    for (let i = h.steam.length - 1; i >= 0; i--) {
      const p = h.steam[i];
      p.life += dt; if (p.life >= p.maxLife) { h.steam.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy -= 13 * dt; p.vx += WIND * dt * 0.7;
    }
    for (let i = h.debris.length - 1; i >= 0; i--) {
      const p = h.debris[i];
      p.life += dt; if (p.life >= p.maxLife) { h.debris.splice(i, 1); continue; }
      if (p.landed) continue;
      p.x += p.vx * dt; p.y += p.vy * dt;
      // Pod wodą: mniejsza grawitacja efektywna (wypornność spowalnia opadanie)
      p.vy += (h.underwater ? G * 0.52 : G) * dt;
      p.rot += p.vrot * dt;
      if (p.y > surfY - 2 && p.vy > 0) {
        p.landed = true;
        for (let j = 0; j < 3 && h.seaSparks.length < 80; j++) {
          h.seaSparks.push({
            x: p.x + (Math.random() - 0.5) * 6, y: surfY - 2,
            vx: (Math.random() - 0.5) * 55, vy: -rand(55, 150),
            life: 0, maxLife: rand(0.35, 0.85), size: rand(2.5, 6.5),
          });
        }
      }
    }
    for (let i = h.embers.length - 1; i >= 0; i--) {
      const p = h.embers[i];
      p.life += dt; if (p.life >= p.maxLife) { h.embers.splice(i, 1); continue; }
      p.x += p.vx * dt + Math.sin(p.life * 12 + p.seed) * 28 * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt; p.vx *= 1 - dt * 0.55;
      if (p.y > surfY) p.life = p.maxLife;
    }
    for (let i = h.seaSparks.length - 1; i >= 0; i--) {
      const p = h.seaSparks[i];
      p.life += dt; if (p.life >= p.maxLife) { h.seaSparks.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += G * 1.4 * dt;
      if (p.y > surfY) p.life = p.maxLife;
    }
  }

  // ── Rysowanie ─────────────────────────────────────────────────────────────

  // Podwodna fala ciśnienia — niebieskie pierścienie z punktu wybuchu
  _drawUnderwaterPressureWave(fg, sx, sy, t) {
    const waves = [
      { delay: 0,    speed: 520, life: 1.1, w: 3.2 },
      { delay: 0.05, speed: 330, life: 1.4, w: 2.2 },
      { delay: 0.14, speed: 190, life: 1.8, w: 1.5 },
    ];
    for (const wv of waves) {
      const tt = t - wv.delay;
      if (tt < 0 || tt > wv.life) continue;
      const r  = tt * wv.speed;
      const op = Math.pow(1 - tt / wv.life, 1.4) * 0.65;
      fg.lineStyle(wv.w, 0x58c0ff, op);
      fg.strokeCircle(sx, sy, r);
      fg.lineStyle(wv.w * 0.4, 0xb0e4ff, op * 0.28);
      fg.strokeCircle(sx, sy, r * 0.76);
    }
    // Glow w centrum (krótki — energia wybuchu)
    if (t < 0.44) {
      const gp = t < 0.06 ? t / 0.06 : Math.max(0, 1 - (t - 0.06) / 0.38);
      if (gp > 0.01) {
        const gr = 28 + t * 430;
        fg.fillStyle(0xfff080, gp * 0.82); fg.fillCircle(sx, sy, gr * 0.20);
        fg.fillStyle(0xff8830, gp * 0.50); fg.fillCircle(sx, sy, gr * 0.52);
        fg.fillStyle(0x4888cc, gp * 0.20); fg.fillCircle(sx, sy, gr);
      }
    }
  }

  // Bąble gazu unoszące się ku tafli
  _drawBubbles(fg, g, h, camX, surfY) {
    for (const p of h.bubbles) {
      const lt = p.life / p.maxLife;
      const a  = Math.min(1, p.life / 0.08) * Math.max(0, 1 - lt * 0.35);
      if (a <= 0.01) continue;
      const sx = p.x - camX;
      const r  = p.size * (1 + lt * 0.38);
      if (p.hot) {
        fg.fillStyle(0xffcc44, a * 0.65); fg.fillCircle(sx, p.y, r);
        fg.fillStyle(0xffffff, a * 0.38); fg.fillCircle(sx, p.y, r * 0.42);
      } else {
        fg.fillStyle(0xc8e8ff, a * 0.22); fg.fillCircle(sx, p.y, r);
        fg.fillStyle(0xffffff, a * 0.12); fg.fillCircle(sx, p.y, r * 0.52);
        g.lineStyle(0.8, 0x88bedd, a * 0.32); g.strokeCircle(sx, p.y, r);
      }
    }
  }

  // Osad denny — brunatne chmury przy dnie
  _drawSediment(g, h, camX) {
    for (const p of h.sediment) {
      const lt = p.life / p.maxLife;
      const a  = Math.sin(lt * Math.PI) * 0.58;
      if (a <= 0.01) continue;
      const sx = p.x - camX;
      const r  = p.size * (1 + lt * 1.9);
      // Ciepły brąz — muł, piasek
      const grey = Math.floor(38 + (1 - lt) * 28);
      const warm = Math.floor(grey * 1.22);
      const col  = (warm << 16) | (grey << 8) | Math.floor(grey * 0.58);
      g.fillStyle(col, a * 0.70);
      g.fillEllipse(sx, p.y, r * 2.4, r * 0.65);
    }
  }

  _drawAirShockwaves(g, sx, sy, t) {
    const waves = [
      { delay: 0.00, dur: 1.8, maxR: 280, w: 2.5 },
      { delay: 0.14, dur: 2.2, maxR: 350, w: 1.8 },
      { delay: 0.30, dur: 2.8, maxR: 420, w: 1.2 },
    ];
    for (const wv of waves) {
      const wt = t - wv.delay;
      if (wt < 0 || wt > wv.dur) continue;
      const prog = wt / wv.dur;
      const r    = prog * wv.maxR;
      const a    = (1 - prog) * 0.52;
      g.lineStyle(wv.w * (1 - prog * 0.5), 0xaaccdd, a);
      g.strokeCircle(sx, sy, r);
      g.lineStyle(wv.w * 0.45, 0xffffff, a * 0.32);
      g.strokeCircle(sx, sy, r * 0.74);
    }
  }

  _drawWaterShockwaves(fg, sx, sy, t) {
    if (t > 3.5) return;
    const waves = [
      { delay: 0,    speed: 360, life: 2.5, w: 3.5 },
      { delay: 0.15, speed: 240, life: 2.8, w: 2.8 },
      { delay: 0.36, speed: 165, life: 3.0, w: 2.0 },
      { delay: 0.66, speed: 100, life: 3.2, w: 1.4 },
    ];
    for (const wv of waves) {
      const tt = t - wv.delay;
      if (tt < 0 || tt > wv.life) continue;
      const r  = tt * wv.speed;
      const op = Math.pow(1 - tt / wv.life, 1.3) * 0.55;
      fg.lineStyle(wv.w, 0xffe6b4, op);
      fg.strokeEllipse(sx, sy + 2, r * 2, r * 0.64);
      fg.lineStyle(wv.w * 0.45, 0xffdca0, op * 0.38);
      fg.strokeEllipse(sx, sy + 2, r * 2 * 0.94, r * 0.60);
    }
  }

  _drawUnderwaterGlow(fg, sx, sy, t) {
    if (t > 0.5) return;
    const op = t < 0.05 ? t / 0.05 : Math.max(0, 1 - (t - 0.05) / 0.45);
    if (op <= 0.01) return;
    const r = 80 + t * 750;
    fg.fillStyle(0xffe680, op * 0.88); fg.fillCircle(sx, sy + 28, r * 0.28);
    fg.fillStyle(0xff8c32, op * 0.55); fg.fillCircle(sx, sy + 28, r * 0.60);
    fg.fillStyle(0xff501e, op * 0.22); fg.fillCircle(sx, sy + 28, r);
  }

  _drawScreenFlash(fg, sx, sy, t) {
    if (t > 0.35) return;
    let op;
    if (t < 0.04) op = (t / 0.04) * 0.65;
    else          op = Math.max(0, 0.65 * (1 - (t - 0.04) / 0.31));
    if (op <= 0.01) return;
    const W = this.scene.scale.width, H = this.scene.scale.height;
    fg.fillStyle(0xfff5dc, op);
    fg.fillRect(0, 0, W, H);
  }

  _drawOilSlick(g, sx, sy, t) {
    if (t < 0.25) return;
    const age    = Math.min(t - 0.25, 18);
    const slickR = 30 + age * 19;
    const alpha  = Math.min(age * 0.35, 0.62);
    g.fillStyle(0x100602, alpha * 0.78);
    g.fillEllipse(sx, sy + 3, slickR * 2.4, slickR * 0.42);
    g.fillStyle(0x334455, alpha * 0.20);
    g.fillEllipse(sx - slickR * 0.2, sy + 3, slickR * 1.1, slickR * 0.22);
    g.fillStyle(0x553344, alpha * 0.13);
    g.fillEllipse(sx + slickR * 0.15, sy + 3, slickR * 0.80, slickR * 0.16);
  }

  _drawSmoke(g, h, camX) {
    for (const p of h.smoke) {
      const lt    = p.life / p.maxLife;
      const r     = p.size + lt * p.sizeGrow;
      const alpha = Math.sin(lt * Math.PI) * 0.36 * p.dark;
      if (alpha <= 0.01) continue;
      const grey = p.oily ? Math.floor(16 + (1 - lt) * 14) : Math.floor(26 + (1 - lt) * 22);
      const warm = p.oily ? Math.floor(grey * 0.7) : grey;
      g.fillStyle((grey << 16) | (warm << 8) | warm, alpha);
      g.fillCircle(p.x - camX, p.y, r);
    }
  }

  _drawSteam(g, h, camX) {
    for (const p of h.steam) {
      const lt    = p.life / p.maxLife;
      const r     = p.size + lt * p.sizeGrow;
      const alpha = Math.sin(lt * Math.PI) * 0.28;
      if (alpha <= 0.01) continue;
      g.fillStyle(0xd4e2ea, alpha); g.fillCircle(p.x - camX, p.y, r);
      g.fillStyle(0xa8bec8, alpha * 0.42); g.fillCircle(p.x - camX, p.y, r * 0.58);
    }
  }

  _drawWater(g, h, camX, surfY) {
    for (const p of h.water) {
      if (p.landed) continue;
      const lt     = p.life / p.maxLife;
      const fadeIn = Math.min(1, p.life / 0.05);
      let alpha = lt < 0.7 ? 0.82 * fadeIn : 0.82 * (1 - (lt - 0.7) / 0.30) * fadeIn;
      if (alpha <= 0.01) continue;
      const r = p.size, sx = p.x - camX;
      if (p.foam) {
        g.fillStyle(0xdff0fc, alpha); g.fillCircle(sx, p.y, r);
        g.fillStyle(0xb0d0e0, alpha * 0.65); g.fillCircle(sx, p.y, r * 0.58);
      } else {
        g.fillStyle(0x7090a5, alpha); g.fillCircle(sx, p.y, r);
        g.fillStyle(0x4a6878, alpha * 0.55); g.fillCircle(sx, p.y, r * 0.58);
      }
      if (Math.abs(p.vy) > 180) {
        g.lineStyle(Math.max(1, r * 0.38), p.foam ? 0xdff0fc : 0x7090a5, alpha * 0.40);
        g.strokeLineShape(new Phaser.Geom.Line(sx - p.vx * 0.024, p.y - p.vy * 0.024, sx, p.y));
      }
    }
  }

  _drawFire(fg, h, camX) {
    for (const p of h.fire) {
      const lt  = p.life / p.maxLife;
      const [rv, gv, bv] = fireColor(lt);
      const a   = fireAlpha(lt);
      if (a <= 0.01) continue;
      const rad  = p.size * (1 + lt * 0.55);
      const sx   = p.x - camX;
      const sway = Math.sin(p.life * 3.5 + p.seed) * rad * 0.20;
      const col  = (rv << 16) | (gv << 8) | bv;
      fg.fillStyle(col, a * 0.08); fg.fillEllipse(sx + sway,        p.y + rad * 0.18, rad * 2.8, rad * 1.3);
      fg.fillStyle(col, a * 0.17); fg.fillEllipse(sx + sway * 0.65, p.y,              rad * 1.8, rad * 1.9);
      fg.fillStyle(col, a * 0.30); fg.fillEllipse(sx + sway * 0.35, p.y - rad * 0.14, rad * 1.0, rad * 1.65);
      fg.fillStyle(col, a * 0.48); fg.fillEllipse(sx + sway * 0.15, p.y - rad * 0.28, rad * 0.50, rad * 1.10);
      fg.fillStyle(col, a * 0.68); fg.fillEllipse(sx,               p.y - rad * 0.40, rad * 0.20, rad * 0.58);
    }
  }

  _drawSurfaceFire(fg, h, camX) {
    for (const p of h.surfaceFire) {
      const t = p.life / p.maxLife;
      let a;
      if      (t < 0.08) a = (t / 0.08) * 0.58;
      else if (t < 0.62) a = 0.58;
      else               a = Math.max(0, 0.58 * (1 - (t - 0.62) / 0.38));
      if (a <= 0.01) continue;
      const r    = p.size * (1 + t * 0.5);
      const sx   = p.x - camX;
      const sway = Math.sin(p.life * 3.8 + p.seed) * r * 0.22;
      const col  = t < 0.22 ? 0xfffce4 : (t < 0.52 ? 0xffb040 : (t < 0.78 ? 0xff6018 : 0xcc2a08));
      const hot  = t < 0.22 ? 0xffee88 : 0xff8830;
      fg.fillStyle(col, a * 0.18); fg.fillEllipse(sx + sway * 0.6, p.y - r * 0.05, r * 1.1, r * 1.8);
      fg.fillStyle(col, a * 0.38); fg.fillEllipse(sx + sway * 0.3, p.y - r * 0.22, r * 0.65, r * 1.45);
      fg.fillStyle(hot, a * 0.62); fg.fillEllipse(sx,              p.y - r * 0.36, r * 0.28, r * 0.80);
    }
  }

  _drawOilFires(fg, g, h, camX, surfY, t) {
    for (const f of h.oilFires) {
      if (t < f.delay) continue;
      const age   = t - f.delay;
      const op    = Math.min(1, age / 0.4) * Math.max(0, 1 - (age - 8) / 5);
      if (op <= 0.01) continue;
      const flick = 0.82 + Math.sin(age * 4.2 + f.seed) * 0.18;
      const sz    = f.size * flick;
      const sx    = f.x - camX, sy = f.y;
      const sway  = Math.sin(age * 3.1 + f.seed + 1.2) * sz * 0.18;
      fg.fillStyle(0xff7020, op * 0.18); fg.fillEllipse(sx, sy - sz * 0.2, sz * 3.8, sz * 1.2);
      fg.fillStyle(0x6e1a0e, op * 0.82); fg.fillEllipse(sx + sway,        sy - sz * 0.55, sz * 1.5, sz * 2.4);
      fg.fillStyle(0xcc3c18, op * 0.88); fg.fillEllipse(sx + sway * 0.65, sy - sz * 0.70, sz * 1.05, sz * 2.0);
      fg.fillStyle(0xff7830, op * 0.95); fg.fillEllipse(sx + sway * 0.35, sy - sz * 0.84, sz * 0.62, sz * 1.50);
      fg.fillStyle(0xffb848, op);        fg.fillEllipse(sx + sway * 0.15, sy - sz * 0.96, sz * 0.32, sz * 0.95);
      fg.fillStyle(0xffee88, op * 0.90); fg.fillEllipse(sx,               sy - sz * 1.05, sz * 0.14, sz * 0.42);
      fg.fillStyle(0xff8030, op * 0.28); fg.fillEllipse(sx, sy + sz * 0.35, sz * 3.2, sz * 0.55);
    }
  }

  _drawDebris(g, fg, h, camX, surfY) {
    for (const p of h.debris) {
      if (p.landed && p.life > p.maxLife * 0.3) continue;
      const lt = p.life / p.maxLife;
      const op = p.landed ? Math.max(0, 1 - (lt - 0.3) / 0.7) : 1;
      if (op <= 0) continue;
      const sx = p.x - camX;
      if (p.hot && p.life < p.hotLife) {
        const hf = (1 - p.life / p.hotLife) * 0.82;
        fg.fillStyle(0xffdc78, hf * op); fg.fillCircle(sx, p.y, p.size * 2.2);
        fg.fillStyle(0xff7828, hf * op * 0.55); fg.fillCircle(sx, p.y, p.size * 4.0);
      }
      const col = (p.hot && p.life < p.hotLife * 0.5) ? 0xcc3333 : 0x0a0d12;
      g.fillStyle(col, op * 0.92);
      g.save(); g.translateCanvas(sx, p.y); g.rotateCanvas(p.rot);
      switch (p.shape) {
        case 0: g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.5); break;
        case 1: g.fillTriangle(0, -p.size * 0.8, p.size * 0.6, p.size * 0.5, -p.size * 0.6, p.size * 0.5); break;
        case 2: g.fillRect(-p.size, -1, p.size * 2, 2); break;
        case 3: g.fillCircle(0, 0, p.size * 0.44); break;
        case 4: g.fillTriangle(-p.size, 0, p.size * 1.2, 0, 0, -p.size * 0.5); break;
      }
      g.restore();
    }
  }

  _drawEmbers(fg, h, camX) {
    for (const p of h.embers) {
      const lt  = p.life / p.maxLife;
      const fl  = 0.72 + Math.sin(p.life * 7.2 + p.seed) * 0.28;
      const a   = (1 - lt) * fl * 0.90;
      if (a <= 0.02) continue;
      const yel = Math.floor(220 - lt * 120);
      const orn = Math.floor(120 - lt * 80);
      const col = (255 << 16) | (yel << 8) | orn;
      const sx  = p.x - camX;
      const sz  = 1.3 + fl * 0.7;
      fg.fillStyle(col, a); fg.fillCircle(sx, p.y, sz);
      fg.lineStyle(sz * 0.5, col, a * 0.32);
      fg.strokeLineShape(new Phaser.Geom.Line(sx - p.vx * 0.022, p.y - p.vy * 0.022, sx, p.y));
    }
  }

  _drawSeaSparks(fg, h, camX, surfY) {
    for (const p of h.seaSparks) {
      const lt = p.life / p.maxLife;
      const a  = Math.max(0, 1 - lt) * 0.88;
      if (a <= 0.02) continue;
      fg.fillStyle(0xe8f8fc, a);
      fg.fillCircle(p.x - camX, p.y, p.size);
    }
  }

  _drawSecondary(g, fg, h, sx, sy, dt, t) {
    for (const sb of h.secondary) {
      if (sb.done || t < sb.delay) continue;
      const st = t - sb.delay;
      if (st > 1.0) { sb.done = true; continue; }
      const prog = st / 1.0, fade = 1 - prog;
      const r    = 10 + prog * 62;
      const bx   = sx + sb.ox;
      const sway = Math.sin(st * 4.5 + sb.ox) * r * 0.10;
      if (prog < 0.18) {
        const ff = (0.18 - prog) / 0.18;
        fg.fillStyle(0xfffbe0, ff * 0.65); fg.fillEllipse(bx, sy, r * 0.80, r * 0.50);
      }
      fg.fillStyle(0xff6600, fade * 0.55); fg.fillEllipse(bx + sway,       sy - r * 0.12, r * 1.3, r * 1.1);
      fg.fillStyle(0xff9900, fade * 0.75); fg.fillEllipse(bx + sway * 0.5, sy - r * 0.22, r * 0.75, r * 0.90);
      fg.fillStyle(0xffcc44, fade * 0.55); fg.fillEllipse(bx,              sy - r * 0.32, r * 0.32, r * 0.50);
      if (prog < 0.75) {
        const rp = prog / 0.75;
        fg.lineStyle(1.6 * (1 - rp), 0xffbb66, (1 - rp) * 0.40);
        fg.strokeEllipse(bx, sy, r * 2.4, r * 1.0);
      }
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI - Math.PI * 0.5 + (sb.ox * 0.01);
        const bxd = bx + Math.cos(ang) * r * 0.85;
        const byd = sy + Math.sin(ang) * r * 0.55 - 44 * st;
        if (byd > sy) continue;
        g.fillStyle(0xaaccdd, fade * 0.45);
        g.fillCircle(bxd, byd, 2.0 + prog * 4.0);
      }
    }
  }
}
