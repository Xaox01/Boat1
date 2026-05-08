import Phaser from 'phaser';
import { ASROC, HomingTorpedo } from './EnemyASROC.js';

export const STATE = { PATROL: 0, ALERT: 1, HUNT: 2, SEARCH: 3 };

// Prędkości
const PATROL_SPEED   = 42;
const ALERT_SPEED    = 68;
const HUNT_SPEED     = 100;
const HUNT_OVERSHOOT = 200;

// Wykrywanie
const BASE_HYDROPHONE  = 520;
const THERMO_MASK      = 0.50;
const ALERT_THRESHOLD  = 1.6;
const HUNT_THRESHOLD   = 4.8;
const SEARCH_DURATION  = 35;

// Zarzuty głębinowe
const CHARGE_COOLDOWN  = 8.0;
const CHARGE_FALL_SPD  = 95;
const CHARGE_BLAST_R   = 88;

// ASROC
const ASROC_COOLDOWN   = 52;    // s między salwami
const ASROC_MIN_DIST   = 350;   // px — za blisko = używaj zarzutów
const ASROC_MAX_DIST   = 3400;  // px — za daleko

// Aktywny sonar
const PING_SPEED        = 195;
const PING_BOOST        = 3.5;
const PING_BOOST_THERMO = 0.8;

export class Enemy {
  constructor(scene, x, patrolLeft, patrolRight, label) {
    this.scene = scene;
    this.gfx   = scene.add.graphics();

    this.x = x;
    this.y = scene.SURFACE_Y;
    this.label = label || '';

    this.patrolLeft  = patrolLeft;
    this.patrolRight = patrolRight;
    this.patrolSpeed = PATROL_SPEED + Math.random() * 12;
    this.dir         = Math.random() < 0.5 ? 1 : -1;

    this.state          = STATE.PATROL;
    this.detectTimer    = 0;
    this.searchTimer    = 0;
    this.detectionLevel = 0;

    this.lastBearingToSub = 0;
    this.lastKnownSubX    = x;
    this.lastKnownSubY    = scene.SURFACE_Y + 100;

    this.overshootX = null;

    // Zarzuty głębinowe
    this.charges  = [];
    this.chargeCD = 0;

    // ASROC
    this.asrocs         = [];
    this.homingTorpedoes = [];
    this.asrocCD        = ASROC_COOLDOWN * (0.6 + Math.random() * 0.6);  // różny rozruch

    this.hull      = 1.0;
    this.destroyed = false;

    // Aktywny sonar
    this.pingTimer   = 4 + Math.random() * 8;
    this.activePings = [];

    // "Sprint and listen" — co jakiś czas zatrzymuje się i słucha
    this._sprintListenTimer = 0;
    this._listening         = false;

    this.recentExplosions = [];
    this.recentPingHit    = false;
    this.recentASROC      = false;
  }

  update(dt, sub) {
    this.recentExplosions = [];
    this.recentPingHit    = false;
    this.recentASROC      = false;
    if (this.destroyed) return;

    this._updateActiveSonar(dt, sub);
    this._updateDetection(dt, sub);
    this._updateMovement(dt);
    this._updateCharges(dt, sub);
    this._updateASROC(dt, sub);
    this._draw();
  }

  // Koordynacja radiowa
  receiveRadioAlert(subX, subY) {
    if (this.state === STATE.HUNT) return;
    this.lastKnownSubX    = subX;
    this.lastKnownSubY    = subY;
    this.lastBearingToSub = Math.atan2(subY - this.y, subX - this.x);
    this.detectTimer      = Math.max(this.detectTimer, ALERT_THRESHOLD + 1.2);
  }

  // ── Aktywny sonar ──────────────────────────────────────────────────────────

  _updateActiveSonar(dt, sub) {
    const interval = this.state === STATE.PATROL ? 22
                   : this.state === STATE.ALERT  ?  9 : 5;

    this.pingTimer -= dt;
    if (this.pingTimer <= 0) {
      this.activePings.push({ r: 0, alpha: 0.80 });
      this.pingTimer = interval + Math.random() * 3;
    }

    const WORLD_W = this.scene.WORLD_W;
    for (const p of this.activePings) {
      const prevR = p.r;
      p.r    += PING_SPEED * dt;
      p.alpha = Math.max(0, p.alpha - dt * 0.42);

      let dx = sub.x - this.x;
      if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
      const dy   = sub.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (prevR < dist && p.r >= dist) {
        const boost = sub.belowThermocline ? PING_BOOST_THERMO : PING_BOOST;
        this.detectTimer      = Math.min(this.detectTimer + boost, HUNT_THRESHOLD + 1);
        this.lastBearingToSub = Math.atan2(dy, dx);
        this.lastKnownSubX    = sub.x;
        this.lastKnownSubY    = sub.y;
        this.recentPingHit    = true;
      }
    }
    this.activePings = this.activePings.filter(p => p.alpha > 0);
  }

  // ── Wykrywanie pasywne ─────────────────────────────────────────────────────

  _updateDetection(dt, sub) {
    const WORLD_W = this.scene.WORLD_W;
    let dx = sub.x - this.x;
    if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
    const dy   = sub.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let range = BASE_HYDROPHONE * sub.noiseEffective;
    if (sub.belowThermocline) range *= THERMO_MASK;

    if (dist < range) {
      this.detectTimer      = Math.min(this.detectTimer + dt, HUNT_THRESHOLD + 1);
      this.lastBearingToSub = Math.atan2(dy, dx);
      this.lastKnownSubX    = sub.x;
      this.lastKnownSubY    = sub.y;
    } else {
      const decay = this.state === STATE.HUNT ? 0.20 : 0.50;
      this.detectTimer = Math.max(0, this.detectTimer - decay * dt);
    }

    this.detectionLevel = Phaser.Math.Clamp(this.detectTimer / HUNT_THRESHOLD, 0, 1);

    const prev = this.state;
    if      (this.detectTimer >= HUNT_THRESHOLD)  this.state = STATE.HUNT;
    else if (this.detectTimer >= ALERT_THRESHOLD) this.state = STATE.ALERT;
    else if (this.detectTimer >  0)               this.state = STATE.ALERT;
    else if (this.searchTimer >  0) {
      this.state = STATE.SEARCH;
      this.searchTimer -= dt;
    } else {
      this.state = STATE.PATROL;
    }

    if (prev === STATE.HUNT && this.state !== STATE.HUNT) {
      this.searchTimer = SEARCH_DURATION;
      this.overshootX  = null;
    }
  }

  // ── Ruch ───────────────────────────────────────────────────────────────────

  _updateMovement(dt) {
    const WORLD_W = this.scene.WORLD_W;
    const dmgMult = 0.45 + this.hull * 0.55;

    // "Sprint and listen" — patrol zatrzymuje się na chwilę żeby usłyszeć ciszej
    if (this.state === STATE.PATROL) {
      this._sprintListenTimer += dt;
      const cycle = 14 + Math.random() * 0.001;  // ~14s cykl
      if (this._sprintListenTimer > cycle) {
        this._listening = !this._listening;
        this._sprintListenTimer = 0;
      }
    } else {
      this._listening = false;
    }

    const speedMult = this._listening ? 0.05 : 1.0;

    switch (this.state) {
      case STATE.PATROL: {
        this.x += this.dir * this.patrolSpeed * dmgMult * speedMult * dt;
        if (this.x > this.patrolRight) { this.x = this.patrolRight; this.dir = -1; }
        if (this.x < this.patrolLeft)  { this.x = this.patrolLeft;  this.dir =  1; }
        break;
      }
      case STATE.ALERT: {
        const txDir = Math.cos(this.lastBearingToSub);
        if (Math.abs(txDir) > 0.15) this.dir = Math.sign(txDir);
        this.x += this.dir * ALERT_SPEED * dmgMult * dt;
        this.x  = Phaser.Math.Clamp(this.x, 0, WORLD_W);
        break;
      }
      case STATE.HUNT: {
        let dx = this.lastKnownSubX - this.x;
        if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;

        if (this.overshootX === null) {
          if (Math.abs(dx) > 20) this.dir = Math.sign(dx);
          this.x += this.dir * HUNT_SPEED * dmgMult * dt;
        } else {
          this.x += this.dir * HUNT_SPEED * dmgMult * dt;
          const reached = this.dir > 0
            ? this.x >= this.overshootX
            : this.x <= this.overshootX;
          if (reached) {
            this.overshootX = null;
            this.dir        = -this.dir;
          }
        }
        this.x = Phaser.Math.Clamp(this.x, 0, WORLD_W);
        break;
      }
      case STATE.SEARCH: {
        const elapsed = SEARCH_DURATION - this.searchTimer;
        const swing   = Math.min(90 + elapsed * 15, 360);
        const left    = this.lastKnownSubX - swing;
        const right   = this.lastKnownSubX + swing;
        this.x += this.dir * ALERT_SPEED * 0.75 * dmgMult * dt;
        if (this.x > right) this.dir = -1;
        if (this.x < left)  this.dir =  1;
        this.x = Phaser.Math.Clamp(this.x, 0, WORLD_W);
        break;
      }
    }
  }

  // ── Zarzuty głębinowe ──────────────────────────────────────────────────────

  _updateCharges(dt, sub) {
    this.chargeCD = Math.max(0, this.chargeCD - dt);

    // Spekulacyjne zarzuty podczas przeszukiwania
    if (this.state === STATE.SEARCH && this.chargeCD <= 0 && Math.random() < 0.007) {
      this._dropPattern(sub);
      this.chargeCD = CHARGE_COOLDOWN * 1.8;
    }

    // Zarzuty gdy w fazie podejścia
    if (this.state === STATE.HUNT && this.overshootX === null) {
      const WORLD_W = this.scene.WORLD_W;
      let dx = this.lastKnownSubX - this.x;
      if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;

      if (Math.abs(dx) < 85 && this.chargeCD <= 0) {
        this._dropPattern(sub);
        this.chargeCD   = CHARGE_COOLDOWN;
        this.overshootX = this.x + this.dir * HUNT_OVERSHOOT;
      }
    }

    for (const c of this.charges) {
      if (c.exploded) { c.explodeTimer -= dt; continue; }
      c.y += c.speed * dt;

      if (c.y >= c.targetY) {
        c.exploded     = true;
        c.explodeTimer = 0.55;

        const WORLD_W = this.scene.WORLD_W;
        let dx = sub.x - c.x;
        if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
        const dy   = sub.y - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CHARGE_BLAST_R) {
          const ratio = 1 - dist / CHARGE_BLAST_R;
          sub.hull -= Phaser.Math.Clamp(ratio * 0.40, 0.04, 0.40);
        }
        this.recentExplosions.push({ x: c.x, y: c.y, dist });
      }
    }

    this.charges = this.charges.filter(c => !c.exploded || c.explodeTimer > 0);
  }

  _dropPattern(sub) {
    const SURF     = this.scene.SURFACE_Y;
    const fallTime = (sub.y - SURF) / CHARGE_FALL_SPD;
    const predY    = Phaser.Math.Clamp(
      sub.y + sub.vy * fallTime * 0.42,
      SURF + 25, this.scene.OCEAN_FLOOR_Y - 25
    );
    const offsets = [0, this.dir * 55, -this.dir * 55];
    for (const xOff of offsets) {
      this.charges.push({
        x: this.x + xOff, y: SURF + 10,
        targetY: predY + Phaser.Math.Between(-22, 22),
        speed: CHARGE_FALL_SPD + Math.random() * 28,
        exploded: false, explodeTimer: 0,
      });
    }
  }

  // ── ASROC ──────────────────────────────────────────────────────────────────

  _updateASROC(dt, sub) {
    this.asrocCD = Math.max(0, this.asrocCD - dt);

    // Warunek odpalenia: HUNT lub SEARCH, dobry dystans, cooldown minął
    const WORLD_W = this.scene.WORLD_W;
    let dx = this.lastKnownSubX - this.x;
    if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
    const dist = Math.abs(dx);

    const canFire = (this.state === STATE.HUNT || this.state === STATE.SEARCH)
                  && this.asrocCD <= 0
                  && dist > ASROC_MIN_DIST
                  && dist < ASROC_MAX_DIST;

    if (canFire) {
      this.asrocs.push(new ASROC(
        this.scene,
        this.x,
        this.lastKnownSubX + Phaser.Math.Between(-60, 60),  // lekki rozrzut
        this.lastKnownSubY
      ));
      this.asrocCD     = ASROC_COOLDOWN;
      this.recentASROC = true;
    }

    // Aktualizuj aktywne rakiety
    for (const a of this.asrocs) {
      const splash = a.update(dt);
      if (splash) {
        // ASROC trafił w wodę — spawn torpedy samonaprowadzającej
        this.homingTorpedoes.push(new HomingTorpedo(this.scene, splash.x, splash.y));
      }
    }

    // Aktualizuj torpedy samonaprowadzające
    for (const ht of this.homingTorpedoes) {
      ht.update(dt, sub);
    }

    // Sprzątanie
    for (const a of this.asrocs.filter(a => a.dead)) a.destroy();
    this.asrocs = this.asrocs.filter(a => !a.dead);

    for (const ht of this.homingTorpedoes.filter(ht => ht.dead)) ht.destroy();
    this.homingTorpedoes = this.homingTorpedoes.filter(ht => !ht.dead);
  }

  // ── Interfejsy ────────────────────────────────────────────────────────────

  getContactInfo(sub) {
    const WORLD_W = this.scene.WORLD_W;
    let dx = this.x - sub.x;
    if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
    const dy = this.y - sub.y;
    return {
      bearing:        Math.atan2(dy, dx),
      distance:       Math.sqrt(dx * dx + dy * dy),
      state:          this.state,
      detectionLevel: this.detectionLevel,
    };
  }

  getVelocity() {
    const spd = this.state === STATE.HUNT ? HUNT_SPEED : this.patrolSpeed;
    return { vx: this.dir * spd, vy: 0 };
  }

  // ── Renderowanie ─────────────────────────────────────────────────────────

  _draw() {
    const g    = this.gfx;
    const SURF = this.scene.SURFACE_Y;
    g.clear();

    const col = this.state === STATE.HUNT   ? 0xff3300
              : this.state === STATE.ALERT  ? 0xffbb00
              : this.state === STATE.SEARCH ? 0xcc8800
                                            : 0x3a7a6a;

    // Fale aktywnego sonaru
    for (const p of this.activePings) {
      g.lineStyle(1.2, 0x44ffcc, p.alpha * 0.55);
      g.strokeCircle(this.x, SURF, p.r);
    }

    // Pierścień zasięgu hydrofonu
    if (this.detectionLevel > 0.05) {
      const ringR = BASE_HYDROPHONE * this.detectionLevel * 0.55;
      g.fillStyle(col, 0.03 + this.detectionLevel * 0.05);
      g.fillCircle(this.x, SURF, ringR);
      g.lineStyle(1, col, 0.10 + this.detectionLevel * 0.28);
      g.strokeCircle(this.x, SURF, ringR);
    }

    // Smuga ataku biegowego
    if (this.state === STATE.HUNT) {
      g.lineStyle(2, 0xff3300, 0.35);
      g.strokeLineShape(new Phaser.Geom.Line(
        this.x - this.dir * 60, SURF - 4,
        this.x, SURF - 4
      ));
    }

    // Wskaźnik "słucha" (zielony puls podczas sprint-and-listen)
    if (this._listening) {
      const pulse = 0.35 + 0.25 * Math.sin(Date.now() * 0.008);
      g.lineStyle(1.5, 0x44ffcc, pulse);
      g.strokeCircle(this.x, SURF - 14, 8);
    }

    // Wskaźnik ASROC cooldown — małe kółko pod masztem
    if (this.asrocCD < 6) {
      const frac = 1 - this.asrocCD / 6;
      g.fillStyle(0xff8800, frac * 0.85);
      g.fillCircle(this.x - 8, SURF - 22, 3);
    }

    // Kadłub okrętu
    g.fillStyle(col, 0.92);
    g.fillRect(this.x - 28, SURF - 9, 56, 9);

    // Mostek / nadbudówka
    g.fillStyle(col, 1);
    g.fillRect(this.x - 5, SURF - 18, 18, 9);

    // Wyrzutnia ASROC (prostokąt na dziobie)
    g.fillStyle(0x888888, 0.80);
    g.fillRect(this.x + this.dir * 12, SURF - 13, this.dir * 10, 5);
    g.fillStyle(0x444444, 0.70);
    g.fillRect(this.x + this.dir * 14, SURF - 15, this.dir * 6, 3);

    // Maszt
    g.fillStyle(0xffffff, 0.45);
    g.fillRect(this.x + 4, SURF - 25, 2, 7);

    // Wskaźnik dziobu
    g.fillStyle(0xffffff, 0.38);
    g.fillTriangle(
      this.x + this.dir * 28, SURF - 4,
      this.x + this.dir * 19, SURF - 9,
      this.x + this.dir * 19, SURF
    );

    // Pęknięcia kadłuba
    if (this.hull < 0.6) {
      const ca = (0.6 - this.hull) * 3.2;
      g.lineStyle(1, 0xff4a4a, ca);
      g.strokeLineShape(new Phaser.Geom.Line(this.x - 18, SURF - 6, this.x - 8, SURF - 2));
      g.strokeLineShape(new Phaser.Geom.Line(this.x + 10, SURF - 7, this.x + 20, SURF - 1));
      if (this.hull < 0.3) {
        g.fillStyle(0xff8800, 0.35);
        g.fillCircle(this.x + Phaser.Math.Between(-15, 15), SURF - 4, 5);
      }
    }

    // Zarzuty głębinowe
    for (const c of this.charges) {
      if (c.exploded) {
        const frac = c.explodeTimer / 0.55;
        const r    = (1 - frac) * CHARGE_BLAST_R * 1.9;
        g.lineStyle(2.5, 0xff8800, frac * 0.9);
        g.strokeCircle(c.x, c.y, r);
        g.fillStyle(0xff4400, frac * 0.5);
        g.fillCircle(c.x, c.y, r * 0.38);
      } else {
        g.fillStyle(0xffcc44, 0.9);
        g.fillEllipse(c.x, c.y, 10, 14);
        g.fillStyle(0xffffff, 0.22);
        g.fillCircle(c.x, c.y - 9, 3);
      }
    }
  }
}
