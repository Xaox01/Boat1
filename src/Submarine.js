import Phaser from 'phaser';
import { Torpedo } from './Torpedo.js';
import { Missile } from './Missile.js';

const BALLAST_RATE      = 0.09;   // wolniejsze zmiany balastowe — bardziej realistycznie
const BALLAST_CMD_RATE  = 0.26;
const MAX_ENGINE_FORCE  = 110;    // słabszy napęd — taktyczna prędkość
const ENGINE_RAMP       = 0.60;   // wolniejsza odpowiedź na klawisze
const DRAG_ANGULAR      = 0.82;
const NEUTRAL_BALLAST   = 0.54;
const CRUSH_DEPTH       = 400;
const CAVITATION_SPEED  = 100;    // kawitacja przy niższej prędkości — cicho lub głośno
const HOTEL_LOAD        = 0.00018;
const SNORKEL_DEPTH_M   = 18;

export class Submarine {
  constructor(scene, x, y) {
    this.scene    = scene;
    this.graphics = scene.add.graphics();
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.angle      = 0;
    this.angularVel = 0;

    this.ballast       = 0.45;
    this.targetBallast = 0.45;

    this.hull        = 1.0;
    this.battery     = 1.0;
    this.oxygen      = 1.0;
    this.enginePower = 0;

    // Derived / exported to GameScene
    this.noise            = 0;   // raw acoustic output
    this.noiseEffective   = 0;   // what enemy hydrophones detect (masked by thermocline)
    this.cavitating       = false;
    this.belowThermocline = false;
    this.snorkeling       = false;

    this.impactVelocity = 0;
    this.onFloor        = false;

    this.torpedoes = [];
    // 4 rury torpedowe — każda ładuje się osobno (55–75s)
    this.tubes = Array.from({ length: 4 }, (_, i) => ({
      id:          i + 1,
      loaded:      true,
      reloadTimer: 0,
      reloadBase:  55 + Math.random() * 20,   // 55–75s — wyważony czas przeładowania
    }));
    this._torpedosFired = 0;
    this._salvoCD       = 0;   // 3s CD między kolejnymi wystrzeleniami z różnych rur
    this.recentTubeLoaded = null;   // ID rury która właśnie skończyła ładowanie

    this.missiles      = [];
    this.missileCount  = 3;
    this.missileFireCD = 0;
    this.noiseSurge    = 0;   // chwilowy skok hałasu po odpaleniu rakiety

    // Wabie akustyczne (noisemakers)
    this.noisemakerCount = 5;
    this.noisemakers     = [];   // aktywne wabie w wodzie


    this._prevY    = y;   // for thermocline crossing detection
    this.trail     = [];
    this.botControl = false;
  }

  // Liczba załadowanych rur (do odczytu przez HUD i GameScene)
  get torpedoCount() {
    return this.tubes.filter(t => t.loaded).length;
  }

  // Czas do następnej gotowej rury (0 = możesz strzelać teraz)
  get torpedoFireCD() {
    if (this.tubes.some(t => t.loaded)) return 0;
    return Math.min(...this.tubes.filter(t => !t.loaded).map(t => t.reloadTimer));
  }

  // Procent ukończenia najszybciej ładującej się rury (dla łuku w celowniku)
  get tubeReadyFraction() {
    if (this.tubes.some(t => t.loaded)) return 1;
    const fastest = this.tubes.filter(t => !t.loaded)
      .reduce((a, b) => a.reloadTimer < b.reloadTimer ? a : b);
    return 1 - fastest.reloadTimer / fastest.reloadBase;
  }

  fireTorpedo(targetX, targetY) {
    if (this._salvoCD > 0) return false;   // inter-salvo cooldown
    const tube = this.tubes.find(t => t.loaded);
    if (!tube) return false;
    tube.loaded = false;
    tube.reloadTimer = tube.reloadBase;
    this._torpedosFired++;
    this._salvoCD = 3.0;   // 3s między kolejnymi wystrzeleniami
    this.torpedoes.push(new Torpedo(this.scene, this.x, this.y, targetX, targetY));
    return tube.id;   // truthy — kompatybilne z if(fireTorpedo(...))
  }

  deployNoisemaker() {
    if (this.noisemakerCount <= 0) return false;
    this.noisemakerCount--;
    this.noisemakers.push({
      x:        this.x,
      y:        this.y,
      age:      0,
      lifetime: 45,        // 45s aktywności
      noise:    1.2,       // silny sygnał akustyczny — wabik dla torped
    });
    return true;
  }

  // Rakieta wymaga głębokości ≤ 30m (prawie na powierzchni)
  fireMissile(targetX) {
    if (this.missileCount  <= 0)  return 'brak';
    if (this.missileFireCD >  0)  return 'cd';
    if (this.depthMetres   >  70) return 'za_gleboko';
    this.missileCount--;
    this.missileFireCD = 2.5;
    this.noiseSurge    = 1.0;   // silne zakłócenie akustyczne — zdradza pozycję!
    this.missiles.push(new Missile(this.scene, this.x, this.y, targetX));
    return 'ok';
  }

  // Tryb nasłuchu — okręt prawie nieruchomy → pasywny sonar znacznie czulszy
  get listenMode() {
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    return speed < 12 && Math.abs(this.enginePower) < 0.08 && !this.cavitating;
  }

  // Wzmocnienie pasywnego sonaru (1.0 = normalne, 1.6 = tryb nasłuchu)
  get sonarBonus() { return this.listenMode ? 1.6 : 1.0; }

  get depthMetres() {
    const SURF  = this.scene.SURFACE_Y;
    const FLOOR = this.scene.OCEAN_FLOOR_Y;
    return Math.max(0, Math.round((this.y - SURF) / (FLOOR - SURF) * 600));
  }

  update(delta, cursors, keys) {
    const dt = delta / 1000;
    this._handleInput(dt, cursors, keys);
    this._updateBallast(dt);
    this._applyPhysics(dt);
    this._clampToWorld();
    this._updateSystems(dt);
    this._draw();
    this._updateTorpedoes(dt);
  }

  _updateTorpedoes(dt) {
    // Ładowanie rur torpedowych
    this.recentTubeLoaded = null;
    for (const tube of this.tubes) {
      if (!tube.loaded && tube.reloadTimer > 0) {
        tube.reloadTimer -= dt;
        if (tube.reloadTimer <= 0) {
          tube.reloadTimer = 0;
          tube.loaded      = true;
          this.recentTubeLoaded = tube.id;
        }
      }
    }
    this._salvoCD = Math.max(0, this._salvoCD - dt);

    // Przekaż wrogów do seekera głowicy akustycznej
    const enemies = (this.scene.enemies || []).filter(e => !e.destroyed);
    for (const t of this.torpedoes) t.update(dt, enemies);
    for (const t of this.torpedoes.filter(t => t.dead)) t.destroy();
    this.torpedoes = this.torpedoes.filter(t => !t.dead);

    this.missileFireCD = Math.max(0, this.missileFireCD - dt);
    for (const m of this.missiles.filter(m => m.dead)) m.destroy();
    this.missiles = this.missiles.filter(m => !m.dead);

    // Wabie akustyczne — starzenie i usuwanie
    for (const n of this.noisemakers) n.age += dt;
    this.noisemakers = this.noisemakers.filter(n => n.age < n.lifetime);
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  _handleInput(dt, cursors, keys) {
    if (this.botControl) return;
    const boost    = keys.shift.isDown ? 2.0 : 1.0;
    const hasJuice = this.battery > 0;

    if (hasJuice) {
      if (cursors.left.isDown || keys.a.isDown) {
        this.enginePower = Phaser.Math.Clamp(
          this.enginePower - ENGINE_RAMP * dt * boost, -1, 1);
      } else if (cursors.right.isDown || keys.d.isDown) {
        this.enginePower = Phaser.Math.Clamp(
          this.enginePower + ENGINE_RAMP * dt * boost, -1, 1);
      } else {
        this.enginePower *= Math.pow(0.18, dt);
      }
    } else {
      this.enginePower *= Math.pow(0.04, dt);
    }

    if (keys.space.isDown) {
      this.enginePower *= Math.pow(0.03, dt);
    }

    if (cursors.up.isDown || keys.w.isDown) {
      this.targetBallast = Math.max(0, this.targetBallast - BALLAST_CMD_RATE * dt);
      const spd = Math.sqrt(this.vx ** 2 + this.vy ** 2);
      this.angularVel -= 0.004 * spd * dt;
    }
    if (cursors.down.isDown || keys.s.isDown) {
      this.targetBallast = Math.min(1, this.targetBallast + BALLAST_CMD_RATE * dt);
      const spd = Math.sqrt(this.vx ** 2 + this.vy ** 2);
      this.angularVel += 0.004 * spd * dt;
    }
  }

  // ── Ballast fill (slower at depth — pumps fight external pressure) ─────────

  _updateBallast(dt) {
    const depth       = this.depthMetres;
    const depthFactor = 1 / (1 + depth / 300);   // 1.0 at surface → 0.33 at 600m
    const maxStep     = BALLAST_RATE * depthFactor * dt;
    const diff        = this.targetBallast - this.ballast;
    if (Math.abs(diff) <= maxStep) {
      this.ballast = this.targetBallast;
    } else {
      this.ballast += Math.sign(diff) * maxStep;
    }
  }

  // ── Physics ────────────────────────────────────────────────────────────────

  _applyPhysics(dt) {
    const THERMO_Y = this.scene.THERMO_Y;

    const thrustX = Math.cos(this.angle) * this.enginePower * MAX_ENGINE_FORCE;
    const thrustY = Math.sin(this.angle) * this.enginePower * MAX_ENGINE_FORCE;

    const bOff  = this.ballast - NEUTRAL_BALLAST;
    const buoyY = bOff * 340;

    // ── Thermocline crossing jolt ──────────────────────────────────────────
    // Water below thermocline is denser → extra upward push when descending through it.
    // Water above thermocline is lighter → slight sink when ascending through it.
    if (this._prevY < THERMO_Y && this.y >= THERMO_Y) {
      this.vy -= 28;   // descending into denser water: buoyancy kicks up
    } else if (this._prevY >= THERMO_Y && this.y < THERMO_Y) {
      this.vy += 18;   // ascending into lighter water: momentary sink tendency
    }
    this._prevY = this.y;
    // Histereza ±10px zapobiega togglowaniu na granicy termokliny
    if (!this.belowThermocline && this.y >= THERMO_Y + 10) this.belowThermocline = true;
    if ( this.belowThermocline && this.y <  THERMO_Y - 10) this.belowThermocline = false;

    // Hydrostatic righting (sub levels itself)
    this.angularVel -= Math.sin(this.angle) * 1.8 * dt;

    // Trim pitch from ballast × speed
    const fwdSpeed = this.vx * Math.cos(this.angle) + this.vy * Math.sin(this.angle);
    this.angularVel += bOff * Math.abs(fwdSpeed) * 0.005 * dt;

    this.angularVel *= Math.pow(DRAG_ANGULAR, dt * 60);
    this.angle += this.angularVel * dt;

    const maxPitch = 50 * Math.PI / 180;
    if (Math.abs(this.angle) > maxPitch) {
      this.angle = Math.sign(this.angle) * maxPitch;
      this.angularVel *= -0.1;
    }

    this.vx += thrustX * dt;
    this.vy += (thrustY + buoyY) * dt;

    // Anisotropic drag
    const fX     = Math.cos(this.angle);
    const fY     = Math.sin(this.angle);
    const fwdDot = this.vx * fX + this.vy * fY;
    const latVx  = this.vx - fwdDot * fX;
    const latVy  = this.vy - fwdDot * fY;

    // Slightly higher drag below thermocline (denser water)
    const densityMult = this.belowThermocline ? 0.996 : 1.0;
    const dFwd = Math.pow(0.968 * densityMult, dt * 60);
    const dLat = Math.pow(0.68,                dt * 60);

    this.vx = fwdDot * dFwd * fX + latVx * dLat;
    this.vy = fwdDot * dFwd * fY + latVy * dLat;

    const spd = Math.sqrt(this.vx ** 2 + this.vy ** 2);
    if (spd > 175) { this.vx *= 175 / spd; this.vy *= 175 / spd; }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.trail.push({ x: this.x, y: this.y, age: 0 });
    if (this.trail.length > 55) this.trail.shift();
    for (const p of this.trail) p.age += dt;
  }

  // ── Boundary collisions ────────────────────────────────────────────────────

  _clampToWorld() {
    const WORLD_W  = this.scene.WORLD_W;
    const SURF_Y   = this.scene.SURFACE_Y;
    // Proceduralny teren — użyj scene.floorAt jeśli dostępne
    const FLOOR_Y  = this.scene.floorAt
      ? this.scene.floorAt(this.x)
      : this.scene.OCEAN_FLOOR_Y;

    this.impactVelocity = 0;
    this.onFloor        = false;

    // Ograniczenie poziome — odbij od krawędzi świata
    this.x = Phaser.Math.Clamp(this.x, 40, WORLD_W - 40);
    if (this.x <= 40 || this.x >= WORLD_W - 40) {
      this.vx *= -0.4;
    }

    // Powierzchnia — kadłub nie może wyjść ponad wodę
    if (this.y < SURF_Y) {
      if (this.vy < 0) {
        this.impactVelocity = -this.vy;
        this.vy = 0;
      }
      this.y = SURF_Y;
      this.angularVel -= this.angle * 1.5 * (1 / 60);
    }

    // Dno — kolizja z terenem proceduralnym
    if (this.y > FLOOR_Y) {
      const impactVy = Math.abs(this.vy);
      this.impactVelocity = impactVy;
      if (impactVy > 25) {
        this.hull -= Phaser.Math.Clamp((impactVy - 25) / 260, 0.003, 0.22);
      }
      this.y  = FLOOR_Y;
      this.vy = 0;
      this.vx *= 0.55;
      this.angularVel *= 0.25;
      this.onFloor = true;
    }

    if (this.onFloor && Math.abs(this.vx) > 15) {
      this.hull -= 0.0008 * (Math.abs(this.vx) / 100);
    }
  }

  // ── Systems ────────────────────────────────────────────────────────────────

  _updateSystems(dt) {
    const spd   = Math.sqrt(this.vx ** 2 + this.vy ** 2);
    const depth = this.depthMetres;

    // ── Cavitation noise model ─────────────────────────────────────────────
    // Below CAVITATION_SPEED: noise scales smoothly with speed.
    // Above CAVITATION_SPEED: noise jumps sharply (propeller creates vapor bubbles).
    const engineNoise = Math.abs(this.enginePower) * 0.50;
    let speedNoise;
    if (spd > CAVITATION_SPEED && Math.abs(this.enginePower) > 0.25) {
      this.cavitating = true;
      const excess    = (spd - CAVITATION_SPEED) / (290 - CAVITATION_SPEED); // 0→1
      speedNoise      = 0.22 + excess * excess * 0.60;  // quadratic spike
    } else {
      this.cavitating = false;
      speedNoise      = (spd / CAVITATION_SPEED) * 0.22;
    }
    // Skok hałasu po odpaleniu rakiety — zanika w ~4s
    this.noiseSurge = Math.max(0, this.noiseSurge - dt * 0.28);
    this.noise = Phaser.Math.Clamp(engineNoise + speedNoise + this.noiseSurge, 0, 1);

    // ── Thermocline noise masking ──────────────────────────────────────────
    // Sound bends around the thermocline (acoustic shadow zone).
    // Enemy hydrophones above thermocline hear 40% less of a deep sub's noise.
    // We show this as the effective noise the player should care about.
    const mask         = this.belowThermocline ? 0.42 : 0;
    this.noiseEffective = Phaser.Math.Clamp(this.noise * (1 - mask), 0, 1);

    // ── Battery ────────────────────────────────────────────────────────────
    // Hotel load: systems always draw power even at rest
    const engineDrain = Math.abs(this.enginePower) * 0.0022;
    this.battery -= (engineDrain + HOTEL_LOAD) * dt;

    // Snorkel charging: at very shallow depth with engine off, diesel recharges battery
    this.snorkeling = depth < SNORKEL_DEPTH_M && this.battery < 1;
    if (this.snorkeling) {
      // Net gain only when engine is mostly off (idle); diesel can't beat full engine drain
      this.battery += 0.00065 * dt;
    }
    this.battery = Phaser.Math.Clamp(this.battery, 0, 1);

    // ── Oxygen ────────────────────────────────────────────────────────────
    // Przy głębokości snorchla (<18m) powietrze z zewnątrz — tlen rośnie
    if (depth < SNORKEL_DEPTH_M) {
      this.oxygen = Math.min(1, this.oxygen + 0.055 * dt);
    } else {
      // 0.00055/s bazowo → ~30 min na płytkim; głębiej trochę szybciej
      this.oxygen -= (0.00055 + depth * 0.0000018) * dt;
    }
    this.oxygen = Phaser.Math.Clamp(this.oxygen, 0, 1);
    if (this.oxygen <= 0) this.hull -= 0.007 * dt;

    // ── Crush depth ───────────────────────────────────────────────────────
    if (depth > CRUSH_DEPTH) {
      this.hull -= ((depth - CRUSH_DEPTH) / 100) * 0.16 * dt;
    }

    this.hull = Phaser.Math.Clamp(this.hull, 0, 1);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _draw() {
    const g = this.graphics;
    g.clear();

    // ── Ślad ruchu ────────────────────────────────────────────────────────────
    for (let i = 1; i < this.trail.length; i++) {
      const p    = this.trail[i];
      const frac = Math.max(0, 1 - p.age / 3.0);
      g.fillStyle(0x4488aa, frac * 0.15);
      g.fillCircle(p.x, p.y, 1.2 + frac * 2.2);
    }

    // ── Kawitacja za śrubą ────────────────────────────────────────────────────
    if (this.cavitating) {
      const px = this.x - Math.cos(this.angle) * 44;
      const py = this.y - Math.sin(this.angle) * 44;
      const rx = -Math.sin(this.angle);
      const ry =  Math.cos(this.angle);
      for (let i = 0; i < 7; i++) {
        const sp = Phaser.Math.Between(-9, 9);
        const cx = px + rx * sp + Math.cos(this.angle) * Phaser.Math.Between(-2, 14);
        const cy = py + ry * sp + Math.sin(this.angle) * Phaser.Math.Between(-2, 14);
        g.fillStyle(0xbbddf8, 0.15 + Math.random() * 0.25);
        g.fillCircle(cx, cy, Phaser.Math.Between(2, 7));
      }
    }

    // ── Bąble przy przedmuchu balastów ────────────────────────────────────────
    if (this.ballast < NEUTRAL_BALLAST - 0.05 && Math.random() < 0.6) {
      const bx = this.x + Phaser.Math.Between(-20, 20);
      const by = this.y + Phaser.Math.Between(-6, 4);
      g.fillStyle(0x88ccff, 0.30 + Math.random() * 0.22);
      g.fillCircle(bx, by, Phaser.Math.Between(1, 4));
    }

    // ── Osad przy uderzeniu w dno ─────────────────────────────────────────────
    if (this.onFloor && Math.abs(this.vx) > 10) {
      for (let i = 0; i < 3; i++) {
        g.fillStyle(0x8a6a3a, 0.10 + Math.random() * 0.10);
        g.fillCircle(this.x + Phaser.Math.Between(-35, 35), this.y + Phaser.Math.Between(3, 10), Phaser.Math.Between(5, 12));
      }
    }

    // ── Kadłub (układ lokalny) ────────────────────────────────────────────────
    g.save();
    g.translateCanvas(this.x, this.y);
    g.rotateCanvas(this.angle);

    const hullCol = this.hull > 0.6 ? 0x2c3e50
                  : this.hull > 0.3 ? 0x3d2418 : 0x3a1212;

    // Cień / podwodna smuga (lekka poświata)
    g.fillStyle(0x1a2e3e, 0.22);
    g.fillEllipse(0, 3, 96, 14);

    // Główny kadłub — wielokąt (smuklejszy niż elipsa)
    g.fillStyle(hullCol, 0.97);
    g.beginPath();
    g.moveTo( 48,  0);
    g.lineTo( 38, -10);
    g.lineTo(-30, -10);
    g.lineTo(-44,  -4);
    g.lineTo(-48,   0);
    g.lineTo(-44,   4);
    g.lineTo(-30,  10);
    g.lineTo( 38,  10);
    g.closePath();
    g.fillPath();

    // Ciemniejszy spód kadłuba (cień)
    g.fillStyle(0x1a2838, 0.45);
    g.beginPath();
    g.moveTo( 38,  4);
    g.lineTo(-30,  4);
    g.lineTo(-44,  4);
    g.lineTo(-30, 10);
    g.lineTo( 38, 10);
    g.closePath();
    g.fillPath();

    // Pas wodnicowy — linia między czarnym kadłubem a górną częścią
    g.fillStyle(0x4a6a7a, 0.28);
    g.fillRect(-30, -10, 68, 3);

    // Zaokrąglone podkreślenie linii kadłuba
    g.lineStyle(1, 0x3a5568, 0.40);
    g.strokeLineShape(new Phaser.Geom.Line(-30, -10, 38, -10));

    // ── Kiosk (sail/conning tower) ────────────────────────────────────────────
    // Baza kiosku (przechodzi w kadłub)
    g.fillStyle(0x1e2e3e, 0.95);
    g.beginPath();
    g.moveTo( 15, -10);
    g.lineTo( 15, -24);
    g.lineTo( 11, -29);
    g.lineTo( -1, -29);
    g.lineTo( -6, -24);
    g.lineTo( -6, -10);
    g.closePath();
    g.fillPath();

    // Lewy rant kiosku (podświetlenie)
    g.fillStyle(0x2e4258, 0.55);
    g.fillRect(-5, -28, 4, 18);

    // Górna płyta kiosku
    g.fillStyle(0x182838, 0.9);
    g.fillRect(-2, -29, 12, 3);

    // Płetwy boczne kiosku (fairwater planes)
    g.fillStyle(0x1a2838, 0.88);
    g.fillRect(-9, -16, 4, 3);
    g.fillRect(15, -16, 4, 3);

    // ── Maszty przy małej głębokości ─────────────────────────────────────────
    if (this.depthMetres < 40) {
      // Peryskop
      g.fillStyle(0x152535, 0.95);
      g.fillRect(4, -29, 2, 11);
      // Głowica peryskopu
      g.fillStyle(0x223344, 0.90);
      g.fillRect(3, -34, 7, 3);
      g.fillRect(6, -34, 2, 2);

      // Maszt snorchla (cieńszy, wyższy)
      g.fillStyle(0x152535, 0.85);
      g.fillRect(-3, -29, 2, 13);
      // Wskaźnik snorchla — świeci gdy ładuje baterię
      g.fillStyle(this.snorkeling ? 0x44ff66 : 0x55cc88, this.snorkeling ? 0.90 : 0.55);
      g.fillCircle(-2, -30, 2.5);
    }

    // ── Stery rufowe ──────────────────────────────────────────────────────────
    g.fillStyle(0x152535, 0.80);
    // Górne stery pionowe (2 płetwy)
    g.fillRect(-47, -17, 7, 5);
    g.fillRect(-47,  12, 7, 5);
    // Poziome stery głębokości (crucifix)
    g.fillStyle(0x1c3040, 0.75);
    g.fillRect(-46, -3, 9, 5);

    // ── Śruba napędowa ────────────────────────────────────────────────────────
    // Osłona śruby (nozzle)
    g.lineStyle(1.5, 0x2a3e52, 0.65);
    g.strokeCircle(-48, 0, 6.5);
    g.fillStyle(0x1a2535, 0.55);
    g.fillCircle(-48, 0, 5.5);

    // Łopatki — 4-łopatowa śruba
    const propSpd   = Math.abs(this.enginePower) * (this.battery > 0 ? 1 : 0);
    const propAngle = (Date.now() * 0.005 * (1 + propSpd * 2.2) * (this.cavitating ? 1.9 : 1)) % (Math.PI * 2);
    const propCol   = this.cavitating ? 0x99ddff : 0x4a8aaa;
    g.lineStyle(2, propCol, 0.92);
    for (let i = 0; i < 4; i++) {
      const a = propAngle + (i * Math.PI * 2) / 4;
      g.strokeLineShape(new Phaser.Geom.Line(-48, 0, -48 + Math.cos(a) * 7, Math.sin(a) * 7));
    }

    // ── Światła nawigacyjne ───────────────────────────────────────────────────
    g.fillStyle(0xff2222, 1); g.fillCircle(-40, 0, 2.0);   // rufowe czerwone
    g.fillStyle(0x22dd22, 1); g.fillCircle( 46, 0, 2.0);   // dziobowe zielone

    // ── Uszkodzenia ───────────────────────────────────────────────────────────
    if (this.hull < 0.6) {
      const ca = (0.6 - this.hull) * 3.5;
      g.lineStyle(1.2, 0xff5533, ca);
      g.strokeLineShape(new Phaser.Geom.Line(-22,  4, -12, -4));
      g.strokeLineShape(new Phaser.Geom.Line( 12, -5,  22,  4));
      if (this.hull < 0.3) {
        g.strokeLineShape(new Phaser.Geom.Line(0, -8, 8, 5));
        g.strokeLineShape(new Phaser.Geom.Line(-5, 0, 5, 8));
        // Wyciek ropy
        if (Math.random() < 0.28) {
          g.fillStyle(0x885522, 0.38);
          g.fillCircle(Phaser.Math.Between(-22, 22), Phaser.Math.Between(-7, 7), Phaser.Math.Between(1, 3));
        }
      }
    }

    g.restore();
  }
}
