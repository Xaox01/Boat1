import Phaser from 'phaser';
import { STATE } from './Enemy.js';
import { Torpedo } from './Torpedo.js';

const PATROL_DEPTH_MIN = 310;
const PATROL_DEPTH_MAX = 460;
const PATROL_SPEED     = 44;
const HUNT_SPEED       = 82;
const TURN_RATE        = 1.1;   // rad/s — max turn rate (real subs turn slowly)

const HYDROPHONE_RANGE = 380;
const ALERT_THRESHOLD  = 2.0;
const HUNT_THRESHOLD   = 5.5;
const SEARCH_DURATION  = 20;

const TORPEDO_RANGE    = 300;   // px — max firing distance
const TORPEDO_COOLDOWN = 11.0;  // s between shots
const TORP_SPEED       = 230;   // must match Torpedo.js SPEED
const BOW_ARC          = Math.PI * 0.60;  // ±60% of π — bow fire sector

const EVADE_RANGE      = 175;   // px — detect incoming torpedo this close
const EVADE_SPEED      = 55;    // additional vertical px/s when evading

export class EnemySub {
  constructor(scene, x, patrolLeft, patrolRight, label) {
    this.scene = scene;
    this.gfx   = scene.add.graphics().setDepth(3);

    this.x = x;
    this.y = scene.SURFACE_Y + PATROL_DEPTH_MIN +
             Math.random() * (PATROL_DEPTH_MAX - PATROL_DEPTH_MIN);
    this.label = label || '';

    this.patrolLeft  = patrolLeft;
    this.patrolRight = patrolRight;
    this.dir         = Math.random() < 0.5 ? 1 : -1;
    this.angle       = this.dir > 0 ? 0 : Math.PI;
    this.targetAngle = this.angle;
    this.targetDepth = this.y;

    this.state          = STATE.PATROL;
    this.detectTimer    = 0;
    this.searchTimer    = 0;
    this.detectionLevel = 0;

    this.lastKnownSubX  = x;
    this.lastKnownSubY  = this.y;

    this.torpedoCooldown = 0;
    this.torpedoes       = [];

    this.evading    = false;
    this.evadeTimer = 0;
    this.evadeDir   = 1;   // +1 = nurkowanie, -1 = wynurzanie

    this.hull      = 1.0;
    this.destroyed = false;

    this.recentExplosions = [];
  }

  update(dt, sub) {
    this.recentExplosions = [];
    if (this.destroyed) return;

    this._updateDetection(dt, sub);
    this._checkEvasion(dt, sub);
    this._updateMovement(dt);
    this._smoothAngle(dt);
    this._updateTorpedoes(dt, sub);
    this._draw();
  }

  // ── Wykrycie ───────────────────────────────────────────────────────────────

  _updateDetection(dt, sub) {
    const WORLD_W = this.scene.WORLD_W;
    let dx = sub.x - this.x;
    if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
    const dy   = sub.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let range = HYDROPHONE_RANGE * sub.noiseEffective;
    // Termoklina między nami a graczem ogranicza hydrofony
    if (!sub.belowThermocline && this.y > this.scene.THERMO_Y) range *= 0.5;

    const hearing = dist < range;

    if (hearing) {
      this.detectTimer = Math.min(this.detectTimer + dt, HUNT_THRESHOLD + 1);
      this.lastKnownSubX = sub.x;
      this.lastKnownSubY = sub.y;
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
    }
  }

  // ── Unik torpedy gracza ────────────────────────────────────────────────────

  _checkEvasion(dt, sub) {
    if (this.evadeTimer > 0) {
      this.evadeTimer -= dt;
      if (this.evadeTimer <= 0) this.evading = false;
      return;
    }

    for (const t of sub.torpedoes) {
      if (t.exploded || !t.armed) continue;
      const dx = t.x - this.x;
      const dy = t.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Torpeda zbliża się do nas?
      const closing = -(t.vx * dx + t.vy * dy) / Math.max(dist, 1);
      if (dist < EVADE_RANGE && closing > 35) {
        this.evading    = true;
        this.evadeTimer = 5.0;
        // Nurkuj od torpedy jeśli atakuje z góry, wynurzaj jeśli z dołu
        this.evadeDir   = dy < 0 ? 1 : -1;
        // Skręt prostopadle do trajektorii torpedy
        this.targetAngle = this.angle + (Math.random() < 0.5 ? 1 : -1) * Math.PI * 0.5;
        break;
      }
    }
  }

  // ── Ruch ───────────────────────────────────────────────────────────────────

  _updateMovement(dt) {
    const WORLD_W   = this.scene.WORLD_W;
    const SURFACE_Y = this.scene.SURFACE_Y;
    const FLOOR_Y   = this.scene.OCEAN_FLOOR_Y;

    if (this.evading) {
      this.x += Math.cos(this.angle) * HUNT_SPEED * dt;
      const evY = this.evadeDir * EVADE_SPEED * dt;
      this.y = Phaser.Math.Clamp(this.y + evY, SURFACE_Y + 60, FLOOR_Y - 30);
    } else {
      switch (this.state) {
        case STATE.PATROL: {
          if (this.x > this.patrolRight && this.dir > 0) this.dir = -1;
          if (this.x < this.patrolLeft  && this.dir < 0) this.dir =  1;
          const vs = Math.sign(this.targetDepth - this.y) * 14;
          if (Math.abs(this.y - this.targetDepth) < 4) {
            this.targetDepth = SURFACE_Y + PATROL_DEPTH_MIN +
              Math.random() * (PATROL_DEPTH_MAX - PATROL_DEPTH_MIN);
          }
          // Kąt docelowy uwzględnia łagodne nurkowanie/wynurzanie
          this.targetAngle = Math.atan2(vs * 0.3, Math.abs(this.dir * PATROL_SPEED))
                           * Math.sign(this.dir > 0 ? 1 : -1);
          if (this.dir < 0) this.targetAngle = Math.PI + Math.atan2(vs * 0.3, PATROL_SPEED);
          this.x += this.dir * PATROL_SPEED * dt;
          this.y += vs * dt;
          break;
        }
        case STATE.ALERT: {
          let dx = this.lastKnownSubX - this.x;
          if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
          if (Math.abs(dx) > 30) this.dir = Math.sign(dx);
          this.targetAngle = this.dir > 0 ? 0 : Math.PI;
          this.x += this.dir * PATROL_SPEED * 0.55 * dt;
          break;
        }
        case STATE.HUNT: {
          let dx = this.lastKnownSubX - this.x;
          if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
          const dy = this.lastKnownSubY - this.y;
          // Kąt do celu — limituj składową pionową by uniknąć zbyt stromego kąta
          const cappedDy = Phaser.Math.Clamp(dy * 0.38, -55, 55);
          this.targetAngle = Math.atan2(cappedDy, dx);
          this.dir = dx >= 0 ? 1 : -1;
          this.x += Math.cos(this.targetAngle) * HUNT_SPEED * dt;
          this.y += Math.sin(this.targetAngle) * HUNT_SPEED * 0.45 * dt;
          break;
        }
        case STATE.SEARCH: {
          const frac = this.searchTimer / SEARCH_DURATION;
          const swing = 280 * frac;
          if (this.x > this.lastKnownSubX + swing) this.dir = -1;
          if (this.x < this.lastKnownSubX - swing) this.dir =  1;
          this.targetAngle = this.dir > 0 ? 0 : Math.PI;
          this.x += this.dir * PATROL_SPEED * 0.7 * dt;
          break;
        }
      }
    }

    this.x = Phaser.Math.Clamp(this.x, 0, WORLD_W);
    this.y = Phaser.Math.Clamp(this.y, this.scene.SURFACE_Y + 30, this.scene.OCEAN_FLOOR_Y - 20);
  }

  // Płynny obrót ku targetAngle z ograniczoną prędkością skrętu
  _smoothAngle(dt) {
    let diff = this.targetAngle - this.angle;
    while (diff >  Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    this.angle += Math.sign(diff) * Math.min(Math.abs(diff), TURN_RATE * dt);
    // Aktualizuj dir na podstawie aktualnego kąta
    this.dir = Math.cos(this.angle) >= 0 ? 1 : -1;
  }

  // ── Torpedy ────────────────────────────────────────────────────────────────

  _updateTorpedoes(dt, sub) {
    this.torpedoCooldown = Math.max(0, this.torpedoCooldown - dt);

    if (this.state === STATE.HUNT && !this.evading) {
      const WORLD_W = this.scene.WORLD_W;
      let dx = sub.x - this.x;
      if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
      const dy   = sub.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < TORPEDO_RANGE && this.torpedoCooldown <= 0) {
        // Sprawdź czy cel jest w sektorze dziobowym
        const angleToSub = Math.atan2(dy, dx);
        let bowDiff = angleToSub - this.angle;
        while (bowDiff >  Math.PI) bowDiff -= 2 * Math.PI;
        while (bowDiff < -Math.PI) bowDiff += 2 * Math.PI;

        if (Math.abs(bowDiff) < BOW_ARC) {
          // Prowadź cel — oblicz gdzie będzie gdy torpeda dotrze
          const travelSecs = Math.min(dist / TORP_SPEED, 2.5);
          const leadX = sub.x + sub.vx * travelSecs * 0.65;
          const leadY = sub.y + sub.vy * travelSecs * 0.65;
          this._fire(leadX, leadY);
          this.torpedoCooldown = TORPEDO_COOLDOWN;
        }
        // Jeśli cel poza sektorem — czekaj aż się obrócimy (targetAngle już ustawiony w HUNT)
      }
    }

    for (const t of this.torpedoes) {
      t.update(dt);
      const dmg = t.checkHit(sub);
      if (dmg > 0) {
        sub.hull -= dmg;
        this.recentExplosions.push({ x: t.x, y: t.y, dist: t.recentHit.dist });
      } else if (t.recentExplosion && t.recentExplosion.dist === 9999) {
        // Torpeda skończyła zasięg — sprawdź bliski wybuch
        const WORLD_W = this.scene.WORLD_W;
        let ddx = sub.x - t.x;
        if (Math.abs(ddx) > WORLD_W / 2) ddx -= Math.sign(ddx) * WORLD_W;
        const nearDist = Math.sqrt(ddx * ddx + (sub.y - t.y) ** 2);
        if (nearDist < 120) this.recentExplosions.push({ x: t.x, y: t.y, dist: nearDist });
      }
    }

    for (const t of this.torpedoes.filter(t => t.dead)) t.destroy();
    this.torpedoes = this.torpedoes.filter(t => !t.dead);
  }

  _fire(targetX, targetY) {
    // Strzał z dzioba
    const bowX = this.x + Math.cos(this.angle) * 20;
    const bowY = this.y + Math.sin(this.angle) * 5;
    this.torpedoes.push(new Torpedo(this.scene, bowX, bowY, targetX, targetY));
  }

  // ── Interfejs dla Sonar i celownika ────────────────────────────────────────

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
      isSub:          true,
    };
  }

  getVelocity() {
    const spd = this.state === STATE.HUNT ? HUNT_SPEED : PATROL_SPEED;
    return {
      vx: Math.cos(this.angle) * spd,
      vy: Math.sin(this.angle) * spd * 0.35,
    };
  }

  destroy() {
    for (const t of this.torpedoes) t.destroy();
    this.gfx.destroy();
  }

  // ── Renderowanie ──────────────────────────────────────────────────────────

  _draw() {
    const g = this.gfx;
    g.clear();

    const col = this.state === STATE.HUNT   ? 0xff3300
              : this.state === STATE.ALERT  ? 0xffbb00
              : this.state === STATE.SEARCH ? 0xcc8800
                                            : 0x2a6a8a;

    // Pierścień wykrycia
    if (this.detectionLevel > 0.08) {
      const ringR = HYDROPHONE_RANGE * this.detectionLevel * 0.5;
      g.fillStyle(col, 0.03 + this.detectionLevel * 0.05);
      g.fillCircle(this.x, this.y, ringR);
      g.lineStyle(1, col, 0.10 + this.detectionLevel * 0.25);
      g.strokeCircle(this.x, this.y, ringR);
    }

    // Animacja uniku — pulsujący biały pierścień
    if (this.evading) {
      const pulse = 0.4 + 0.4 * Math.sin(Date.now() * 0.012);
      g.lineStyle(1.5, 0xffffff, pulse);
      g.strokeCircle(this.x, this.y, 24);
    }

    g.save();
    g.translateCanvas(this.x, this.y);
    g.rotateCanvas(this.angle);

    // Kadłub
    g.fillStyle(col, 0.88);
    g.fillEllipse(0, 0, 40, 13);

    // Kiosk (conning tower)
    g.fillStyle(col, 1);
    g.fillRect(-2, -13, 10, 9);

    // Dziób + wskaźnik wyrzutni
    g.fillStyle(0xff2200, 0.9);
    g.fillCircle(20, 0, 4);
    g.fillStyle(0xffcc00, 0.7);
    g.fillRect(16, -2, 5, 4);

    // Stery (tylne płetwy)
    g.fillStyle(col, 0.75);
    g.fillRect(-19, -8, 7, 4);
    g.fillRect(-19,  4, 7, 4);

    // Pęknięcia kadłuba
    if (this.hull < 0.6) {
      g.lineStyle(1, 0xff4a4a, (0.6 - this.hull) * 3.5);
      g.strokeLineShape(new Phaser.Geom.Line(-14,  3, -6, -3));
      g.strokeLineShape(new Phaser.Geom.Line(  6, -4, 14,  3));
    }

    g.restore();
  }
}
