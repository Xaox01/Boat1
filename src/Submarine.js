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
    this.graphics = scene.add.graphics().setDepth(3);
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

    // Systemy okrętowe — zdrowie 0–1, uszkadzane przy trafieniach
    this.systems = {
      naped:   { health: 1.0, label: 'NAPĘD GÓWNY',     emoji: '⚙' },
      sonarP:  { health: 1.0, label: 'SONAR PASYWNY',   emoji: '◎' },
      sonarA:  { health: 1.0, label: 'SONAR AKTYWNY',   emoji: '◉' },
      torpedy: { health: 1.0, label: 'SYS. TORPEDOWE',  emoji: '▶' },
      rakiety: { health: 1.0, label: 'SYS. RAKIETOWY',  emoji: '↑' },
      balast:  { health: 1.0, label: 'SYS. BALASTU',    emoji: '≈' },
      tlen:    { health: 1.0, label: 'SYS. TLENOWY',    emoji: '○' },
      zasilanie: { health: 1.0, label: 'ZASILANIE',     emoji: '◇' },
    };
    this._damageLog       = [];   // { ts, msg, sev } — zdarzenia awarii
    this._contDmgCooldowns = {};  // { source: remainingSeconds } — rate-limiter ciągłych obrażeń

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

    // Miny morskie
    this.mineCount = 3;
    this.mines     = [];   // aktywne miny w wodzie


    this.infiniteAmmo = false;

    this._prevY    = y;   // for thermocline crossing detection
    this.trail     = [];
    this.botControl = false;

    this._frameIdx = 0;   // pixel art animation clock (14 fps)
    this._frameT   = 0;
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
    const torpH = this.systems.torpedy?.health ?? 1.0;
    if (torpH <= 0) return false;           // sys. torpedowy zniszczony
    if (this._salvoCD > 0) return false;
    // Uszkodzenia blokują kolejne rury (0.7→3, 0.4→2, 0.15→1, 0→0)
    const availCount = torpH > 0.7 ? 4 : torpH > 0.4 ? 3 : torpH > 0.15 ? 2 : 1;
    const tube = this.tubes.slice(0, availCount).find(t => t.loaded);
    if (!tube) return false;
    tube.loaded = false;
    tube.reloadTimer = this.infiniteAmmo ? 2.0 : tube.reloadBase;
    this._torpedosFired++;
    this._salvoCD = 3.0;
    this.torpedoes.push(new Torpedo(this.scene, this.x, this.y, targetX, targetY));
    return tube.id;
  }

  deployMine() {
    if (this.mineCount <= 0 && !this.infiniteAmmo) return false;
    if (!this.infiniteAmmo) this.mineCount--;
    this.mines.push({
      x:       this.x,
      y:       this.scene.SURFACE_Y - 18,  // unosi się tuż pod powierzchnią
      armed:   false,
      armT:    3.0,    // uzbrajanie po 3s (ochrona przed natychmiastowym samozniszczeniem)
      age:     0,
      blastR:  90,
    });
    return true;
  }

  // Rakieta wymaga głębokości ≤ 70m i sprawnego systemu rakietowego
  fireMissile(targetX) {
    if (this.missileCount  <= 0 && !this.infiniteAmmo) return 'brak';
    if (this.missileFireCD >  0)  return 'cd';
    if (this.depthMetres   >  70) return 'za_gleboko';
    if ((this.systems.rakiety?.health ?? 1) <= 0) return 'awaria';
    if (!this.infiniteAmmo) this.missileCount--;
    this.missileFireCD = 2.5;
    this.noiseSurge    = 1.0;
    this.missiles.push(new Missile(this.scene, this.x, this.y, targetX));
    return 'ok';
  }

  // Modifier systemu 0.0→1.0 (0 = zniszczony, 1 = sprawny)
  sysMod(key, minAtZero = 0.0) {
    const h = this.systems[key]?.health ?? 1.0;
    return minAtZero + (1.0 - minAtZero) * h;
  }

  // Uszkodzenie kadłuba + systemy okrętowe ważone według źródła trafienia
  applyDamage(amount, source = '') {
    this.hull = Math.max(0, this.hull - amount);
    const sev = amount > 0.25 ? 'crit' : amount > 0.12 ? 'warn' : 'info';

    // Wagi systemów — różne strefy kadłuba trafiają różne systemy
    const w = { naped:1, sonarP:1, sonarA:1, torpedy:1, rakiety:1, balast:1, tlen:1, zasilanie:1 };
    if      (/ASROC|TORPEDA/.test(source))      { w.torpedy*=3; w.sonarA*=2;  w.rakiety*=2; }
    else if (/HEDGEHOG/.test(source))           { w.naped*=2;  w.torpedy*=2; w.zasilanie*=2; }
    else if (/ZARZUT/.test(source))             { w.balast*=3; w.tlen*=2;    w.zasilanie*=2; }
    else if (/KOLIZJA|TARCIE|DNO/.test(source)) { w.naped*=3;  w.balast*=2; }

    const keys  = Object.keys(w);
    const total = keys.reduce((s, k) => s + w[k], 0);
    const pick  = () => {
      let r = Math.random() * total;
      for (const k of keys) { r -= w[k]; if (r <= 0) return k; }
      return keys[0];
    };

    const hits    = sev === 'crit' ? 2 : (Math.random() < 0.5 ? 1 : 0);
    const damaged = [];
    for (let i = 0; i < hits; i++) {
      const key = pick();
      const sys = this.systems[key];
      if (sys && sys.health > 0) {
        sys.health = Math.max(0, sys.health - (0.12 + Math.random() * 0.22));
        damaged.push(sys.label);
      }
    }

    const t   = new Date();
    const ts  = `${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;
    const txt = damaged.length ? ` ⚠ ${damaged.join(', ')}` : '';
    this._damageLog.unshift({ ts, msg: `${source||'TRAFIENIE'} −${Math.round(amount*100)}% kad.${txt}`, sev });
    if (this._damageLog.length > 20) this._damageLog.pop();
  }

  // Ciągłe obrażenia (tlen, głębokość, tarcie) — rate-limitowane wpisy w dzienniku
  _continuousHullDamage(amount, source, weights = null) {
    this.hull = Math.max(0, this.hull - amount);

    if ((this._contDmgCooldowns[source] ?? 0) > 0) return;
    this._contDmgCooldowns[source] = 8.0;   // max 1 wpis na 8s z tego samego źródła

    const sev = this.hull < 0.3 ? 'crit' : 'warn';
    const w   = weights || { naped:1, sonarP:1, sonarA:1, torpedy:1, rakiety:1, balast:1, tlen:1, zasilanie:1 };
    const keys  = Object.keys(w);
    const total = keys.reduce((s, k) => s + w[k], 0);
    let r = Math.random() * total;
    let pickedKey = keys[0];
    for (const k of keys) { r -= w[k]; if (r <= 0) { pickedKey = k; break; } }

    const sys = this.systems[pickedKey];
    let txt = '';
    if (sys && sys.health > 0) {
      sys.health = Math.max(0, sys.health - (0.07 + Math.random() * 0.10));
      txt = ` ⚠ ${sys.label}`;
    }
    const t  = new Date();
    const ts = `${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;
    this._damageLog.unshift({ ts, msg: `${source}${txt}`, sev });
    if (this._damageLog.length > 20) this._damageLog.pop();
  }

  // Tryb nasłuchu — okręt prawie nieruchomy → pasywny sonar znacznie czulszy
  get listenMode() {
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    return speed < 12 && Math.abs(this.enginePower) < 0.08 && !this.cavitating;
  }

  // Wzmocnienie pasywnego sonaru — tryb nasłuchu × zdrowie sonar-P
  get sonarBonus() {
    const listenBonus = this.listenMode ? 1.6 : 1.0;
    const sonarPMod   = Math.max(0.15, this.systems.sonarP?.health ?? 1.0);
    return listenBonus * sonarPMod;
  }

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
    // pixel art clock — 14 fps
    this._frameT += dt;
    while (this._frameT > 1 / 14) { this._frameT -= 1 / 14; this._frameIdx++; }
    this._draw();
    this._updateTorpedoes(dt);
  }

  _updateTorpedoes(dt) {
    // Uszkodzony system torpedowy → wolniejsze przeładowanie
    const torpH      = this.systems.torpedy?.health ?? 1.0;
    const reloadRate = Math.max(0.12, torpH);   // min 12% prędkości (ok. 8× wolniej)

    this.recentTubeLoaded = null;
    for (const tube of this.tubes) {
      if (!tube.loaded && tube.reloadTimer > 0) {
        tube.reloadTimer -= dt * reloadRate;
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

    // Miny — uzbrajanie
    for (const m of this.mines) {
      m.age += dt;
      if (!m.armed && m.armT > 0) { m.armT -= dt; if (m.armT <= 0) m.armed = true; }
    }
    this.mines = this.mines.filter(m => !m.exploded);
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  _handleInput(dt, cursors, keys) {
    if (this.botControl) return;
    const boost    = keys.shift.isDown ? 2.0 : 1.0;
    const hasJuice = this.battery > 0;

    // Uszkodzony napęd ogranicza max moc silnika
    const napedCap = Math.max(0.22, this.systems.naped?.health ?? 1.0);

    if (hasJuice) {
      if (cursors.left.isDown || keys.a.isDown) {
        this.enginePower = Phaser.Math.Clamp(
          this.enginePower - ENGINE_RAMP * dt * boost, -napedCap, napedCap);
      } else if (cursors.right.isDown || keys.d.isDown) {
        this.enginePower = Phaser.Math.Clamp(
          this.enginePower + ENGINE_RAMP * dt * boost, -napedCap, napedCap);
      } else {
        this.enginePower *= Math.pow(0.18, dt);
      }
    } else {
      this.enginePower *= Math.pow(0.04, dt);
    }
    // Wymuszenie limitu nawet gdy battery właśnie się skończyła
    this.enginePower = Phaser.Math.Clamp(this.enginePower, -napedCap, napedCap);

    if (keys.space.isDown) {
      this.enginePower *= Math.pow(0.03, dt);
    }

    const balastCmdMod = Math.max(0.15, this.systems.balast?.health ?? 1.0);
    if (cursors.up.isDown || keys.w.isDown) {
      this.targetBallast = Math.max(0, this.targetBallast - BALLAST_CMD_RATE * balastCmdMod * dt);
      const spd = Math.sqrt(this.vx ** 2 + this.vy ** 2);
      this.angularVel -= 0.004 * spd * dt;
    }
    if (cursors.down.isDown || keys.s.isDown) {
      this.targetBallast = Math.min(1, this.targetBallast + BALLAST_CMD_RATE * balastCmdMod * dt);
      const spd = Math.sqrt(this.vx ** 2 + this.vy ** 2);
      this.angularVel += 0.004 * spd * dt;
    }
  }

  // ── Ballast fill (slower at depth — pumps fight external pressure) ─────────

  _updateBallast(dt) {
    const depth       = this.depthMetres;
    const balastH     = this.systems.balast?.health ?? 1.0;
    const balastMod   = Math.max(0.06, balastH);  // min 6% prędkości przy awarii
    const depthFactor = 1 / (1 + depth / 300);
    const maxStep     = BALLAST_RATE * balastMod * depthFactor * dt;
    const diff        = this.targetBallast - this.ballast;
    if (Math.abs(diff) <= maxStep) {
      this.ballast = this.targetBallast;
    } else {
      this.ballast += Math.sign(diff) * maxStep;
    }
    // Uszkodzony balast — niekontrolowany wyciek / przeciek sprężonego powietrza
    if (balastH < 0.25 && Math.random() < 0.006 * dt * 60) {
      this.targetBallast = Phaser.Math.Clamp(
        this.targetBallast + (Math.random() - 0.45) * 0.15, 0, 1);
    }
  }

  // ── Physics ────────────────────────────────────────────────────────────────

  _applyPhysics(dt) {
    const THERMO_Y = this.scene.THERMO_Y;

    const napedMod = Math.max(0.20, this.systems.naped?.health ?? 1.0);
    const thrustX = Math.cos(this.angle) * this.enginePower * MAX_ENGINE_FORCE * napedMod;
    const thrustY = Math.sin(this.angle) * this.enginePower * MAX_ENGINE_FORCE * napedMod;

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
        const dmg = Phaser.Math.Clamp((impactVy - 25) / 260, 0.003, 0.22);
        this.applyDamage(dmg, 'KOLIZJA Z DNEM');
      }
      this.y  = FLOOR_Y;
      this.vy = 0;
      this.vx *= 0.55;
      this.angularVel *= 0.25;
      this.onFloor = true;
    }

    // Tarcie o dno przy poziomym ruchu
    if (this.onFloor && Math.abs(this.vx) > 15) {
      const dmg = 0.0008 * (Math.abs(this.vx) / 100);
      this._continuousHullDamage(dmg, 'TARCIE O DNO', { naped: 3, balast: 2, zasilanie: 1 });
    }
  }

  // ── Systems ────────────────────────────────────────────────────────────────

  _updateSystems(dt) {
    const spd   = Math.sqrt(this.vx ** 2 + this.vy ** 2);
    const depth = this.depthMetres;

    // ── Cavitation noise model ─────────────────────────────────────────────
    const napedH      = this.systems.naped?.health ?? 1.0;
    const cavThreshold = CAVITATION_SPEED * (0.45 + 0.55 * napedH); // uszkodzony → cavituje wcześniej
    const engineNoise = Math.abs(this.enginePower) * 0.50;
    let speedNoise;
    if (spd > cavThreshold && Math.abs(this.enginePower) > 0.25) {
      this.cavitating = true;
      const excess    = (spd - cavThreshold) / (290 - cavThreshold);
      speedNoise      = 0.22 + excess * excess * 0.60;
    } else {
      this.cavitating = false;
      speedNoise      = (spd / CAVITATION_SPEED) * 0.22;
    }
    // Uszkodzony napęd generuje dodatkowe wibracje akustyczne
    const napedNoise = (1.0 - napedH) * 0.14;
    this.noiseSurge = Math.max(0, this.noiseSurge - dt * 0.28);
    this.noise = Phaser.Math.Clamp(engineNoise + speedNoise + this.noiseSurge + napedNoise, 0, 1);

    // ── Thermocline noise masking ──────────────────────────────────────────
    // Sound bends around the thermocline (acoustic shadow zone).
    // Enemy hydrophones above thermocline hear 40% less of a deep sub's noise.
    // We show this as the effective noise the player should care about.
    const mask         = this.belowThermocline ? 0.42 : 0;
    this.noiseEffective = Phaser.Math.Clamp(this.noise * (1 - mask), 0, 1);

    // ── Battery ────────────────────────────────────────────────────────────
    const zasH       = this.systems.zasilanie?.health ?? 1.0;
    const hotelMult  = 1 + (1.0 - zasH) * 2.8;    // uszkodzone zasilanie: do 3.8× hotel load
    const engineDrain = Math.abs(this.enginePower) * 0.0022;
    this.battery -= (engineDrain + HOTEL_LOAD * hotelMult) * dt;

    this.snorkeling = depth < SNORKEL_DEPTH_M && this.battery < 1;
    if (this.snorkeling) {
      this.battery += 0.00065 * dt;
    }
    // Uszkodzone zasilanie ogranicza maksymalny poziom baterii
    const maxBattery = Math.max(0.42, zasH);
    this.battery = Phaser.Math.Clamp(this.battery, 0, maxBattery);

    // ── Oxygen ────────────────────────────────────────────────────────────
    const tlenH      = this.systems.tlen?.health ?? 1.0;
    const tlenDrainMult = 1 + (1.0 - tlenH) * 2.8;  // uszkodzony tlen: do 3.8× szybszy spadek
    if (depth < SNORKEL_DEPTH_M) {
      this.oxygen = Math.min(1, this.oxygen + 0.055 * dt);
    } else {
      this.oxygen -= (0.00055 + depth * 0.0000018) * tlenDrainMult * dt;
    }
    this.oxygen = Phaser.Math.Clamp(this.oxygen, 0, 1);
    if (this.oxygen <= 0) {
      this._continuousHullDamage(0.007 * dt, 'BRAK TLENU', { tlen: 3, zasilanie: 2 });
    }

    // ── Crush depth ───────────────────────────────────────────────────────
    if (depth > CRUSH_DEPTH) {
      const dmg = ((depth - CRUSH_DEPTH) / 100) * 0.16 * dt;
      this._continuousHullDamage(dmg, 'PRZECIĄŻENIE CIŚNIENIOWE', { balast: 3, zasilanie: 2, naped: 1 });
    }

    this.hull = Phaser.Math.Clamp(this.hull, 0, 1);

    // ── Cooldowny ciągłych obrażeń ─────────────────────────────────────────
    for (const k of Object.keys(this._contDmgCooldowns)) {
      this._contDmgCooldowns[k] = Math.max(0, this._contDmgCooldowns[k] - dt);
    }
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
      const px = this.x - Math.cos(this.angle) * 78;
      const py = this.y - Math.sin(this.angle) * 78;
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

    // ── Kadłub — pixel art Kilo-class 16-bit (K-244 «NALIM») ─────────────────
    g.save();
    g.translateCanvas(this.x, this.y);
    g.rotateCanvas(this.angle);

    const fi = this._frameIdx;

    // Paleta 16-bit
    const C = {
      hullDark:  0x0a0d14, hullMid:  0x1c2632,
      hullLight: 0x2e3c4a, hullEdge: 0x465668, hullHi: 0x6a7c8e,
      red:       0xe8413a, redDim:   0x8a201a,
      amber:     0xffb347, green:    0x5fcf7a,
      water3:    0x142838,
    };

    // Pixel helpers w układzie lokalnym
    const pxf = (x, y, col) => { g.fillStyle(col, 1.0); g.fillRect(x, y, 1, 1); };
    const rf  = (x, y, w, h, col) => { g.fillStyle(col, 1.0); g.fillRect(x, y, w, h); };

    // Cień pod okrętem (przy małej głębokości)
    if (this.depthMetres < 3) {
      for (let y = 5; y <= 8; y++) {
        const w = Math.round(60 * (1 - (y - 5) / 8));
        for (let x = -w; x <= w; x++) {
          if ((x + y) % 4 !== 0) pxf(x, y, C.water3);
        }
      }
    }

    const deep = this.depthMetres > 80;

    // Profil kadłuba — krzywa cygarowa
    const hullH = (x) => {
      const t = (x + 70) / 140;
      if (t < 0.15) return Math.round(4 + t / 0.15 * 4);
      if (t < 0.85) return 8;
      return Math.round(8 - (t - 0.85) / 0.15 * 6);
    };

    // ── Kadłub główny ─────────────────────────────────────────────────────────
    for (let x = -70; x <= 70; x++) {
      const h = hullH(x);
      if (h <= 0) continue;
      const hi = deep ? C.hullEdge : C.hullHi;
      const hl = deep ? C.hullMid  : C.hullLight;
      rf(x, -h,    1, 1,   hi);
      if (h > 1) rf(x, -h+1, 1, 1, hl);
      if (h > 2) rf(x, -h+2, 1, h-2, C.hullMid);
      rf(x, 0,     1, 1,   C.hullEdge);
      rf(x, 1,     1, h,   C.hullDark);
    }

    // Nity — pionowe linie poszycia
    for (let x = -60; x < 60; x += 14) {
      const h = hullH(x);
      for (let y = -h + 2; y < h - 1; y += 4) pxf(x, y, C.hullDark);
    }
    for (let x = -65; x < 65; x++) pxf(x, 1, C.hullDark);

    // ── Wyrzutnie torped (4 szczeliny przy dziobie) ───────────────────────────
    for (let i = 0; i < 4; i++) rf(64, -3 + i * 2, 3, 1, C.hullDark);
    const tubeReady = this.tubes.some(t => t.loaded);
    pxf(65, -4, tubeReady ? C.green : C.redDim);

    // ── Kiosk / Sail — trapezoidalny ─────────────────────────────────────────
    rf(-4, -18, 22, 10, C.hullDark);
    rf(-3, -19, 20,  1, C.hullMid);
    rf(-2, -20, 18,  1, C.hullLight);
    rf( 0, -19, 16,  1, C.hullMid);
    rf(-3, -18,  1, 10, C.hullEdge);
    rf(17, -18,  1, 10, C.hullEdge);
    rf(2, -16, 3, 1, C.hullDark);
    rf(8, -16, 3, 1, C.hullDark);

    // Światło nawigacyjne — czerwone, mruga co 7 klatek
    const navBlink = (fi % 14) < 7;
    if (navBlink) {
      pxf(7, -14, C.red);
      pxf(6, -14, C.redDim); pxf(8, -14, C.redDim);
      pxf(7, -15, C.redDim); pxf(7, -13, C.redDim);
    } else {
      pxf(7, -14, C.redDim);
    }

    // ── Peryskop i antena (przy głębokości < 40m) ─────────────────────────────
    if (this.depthMetres < 40) {
      for (let y = -20; y > -28; y--) pxf(6, y, C.hullMid);
      rf(5, -29, 3, 2, C.hullDark);
      pxf(5, -28, C.hullLight);
      if (fi % 28 < 14) pxf(7, -28, C.amber);

      for (let y = -20; y > -30; y--) pxf(11, y, C.hullMid);
      rf(10, -30, 5, 1, C.hullMid);
      pxf(14, -30, C.hullLight);

      for (let y = -20; y > -27; y--) pxf(15, y, C.hullMid);
      pxf(15, -21, this.snorkeling ? C.green : 0x3a8a4a);
    }

    // ── Stery głębin (przy kiosku) ────────────────────────────────────────────
    rf(-12, -3, 6, 1, C.hullDark);
    rf(-14, -2, 8, 1, C.hullMid);
    rf(-14, -1, 8, 1, C.hullDark);

    // ── Stery rufowe ───────────────────────────────────────────────────────────
    rf(-78, -2,  8, 1, C.hullMid);
    rf(-80, -1, 10, 1, C.hullDark);
    rf(-80,  0, 10, 1, C.hullMid);
    rf(-78,  1,  8, 1, C.hullDark);
    rf(-72, -14, 1, 6, C.hullMid);
    rf(-71, -16, 1, 8, C.hullMid);
    rf(-70, -10, 1, 4, C.hullDark);
    rf(-73, -10, 1, 4, C.hullDark);
    rf(-72,  8, 1, 6, C.hullMid);
    rf(-71,  8, 1, 8, C.hullMid);

    // ── Śruba — 6-klatkowa animacja fazowa ────────────────────────────────────
    const px0 = -78, py0 = 0;
    rf(px0, py0 - 1, 2, 3, C.hullDark);
    const propFI = this.battery > 0 ? fi : 0;
    const propFrame = propFI % 6;
    const propPhases = [
      [[px0-2, py0-4, 1, 9], [px0-1, py0-5, 1, 11], [px0, py0-5, 1, 11]],
      [[px0-2, py0-3, 1, 7], [px0-1, py0-4, 1, 9],  [px0, py0-4, 1, 9]],
      [[px0-1, py0-2, 2, 5], [px0,   py0-2, 1, 5]],
      [[px0-1, py0,   2, 1]],
      [[px0-1, py0-2, 2, 5], [px0,   py0-2, 1, 5]],
      [[px0-2, py0-3, 1, 7], [px0-1, py0-4, 1, 9],  [px0, py0-4, 1, 9]],
    ];
    const propCol = this.cavitating ? C.hullLight : C.hullMid;
    for (const r of propPhases[propFrame]) rf(r[0], r[1], r[2], r[3], propCol);

    // ── Światła nawigacyjne ───────────────────────────────────────────────────
    pxf(-79, 0, C.red);
    pxf( 70, 0, C.green);

    // ── Drzwi wyrzutni (animowane przy odpaleniu) ─────────────────────────────
    const doorFrac = this.scene._launchFX?.doorOpenFraction ?? 0;
    if (doorFrac > 0) {
      const dAngle = doorFrac * 0.9;
      g.save();
      g.translateCanvas(67, -3);
      g.save(); g.rotateCanvas(-dAngle);
      g.fillStyle(C.red, 0.92); g.fillRect(0, -2, 8, 2);
      g.restore();
      g.save(); g.rotateCanvas(dAngle);
      g.fillStyle(C.red, 0.92); g.fillRect(0, 1, 8, 2);
      g.restore();
      g.restore();
    }

    // ── Uszkodzenia kadłuba ───────────────────────────────────────────────────
    if (this.hull < 0.6) {
      const ca = (0.6 - this.hull) * 3.5;
      g.lineStyle(1, 0xff5533, ca);
      g.strokeLineShape(new Phaser.Geom.Line(-40, 4, -25, -5));
      g.strokeLineShape(new Phaser.Geom.Line(20, -5, 40, 5));
      if (this.hull < 0.3) {
        g.strokeLineShape(new Phaser.Geom.Line(0, -7, 10, 5));
        if (Math.random() < 0.22) pxf(Phaser.Math.Between(-30, 30), Phaser.Math.Between(-4, 4), 0x885522);
      }
    }

    // ── Efekty systemowe ──────────────────────────────────────────────────────
    const napedH = this.systems.naped?.health ?? 1.0;
    if (napedH < 0.65 && Math.random() < 0.85) {
      const intensity = (0.65 - napedH) / 0.65;
      g.fillStyle(0x445544, intensity * 0.38 * (0.5 + Math.random() * 0.5));
      g.fillRect(Phaser.Math.Between(-78, -50), Phaser.Math.Between(-5, 5), 2, 2);
      if (napedH < 0.25 && Math.random() < 0.4) {
        g.fillStyle(0x774422, 0.35);
        g.fillRect(Phaser.Math.Between(-74, -55), Phaser.Math.Between(-4, 4), 2, 2);
      }
    }

    const balastH = this.systems.balast?.health ?? 1.0;
    if (balastH < 0.55 && Math.random() < 0.72) {
      const bInt = (0.55 - balastH) / 0.55;
      g.fillStyle(0x88ccff, bInt * 0.55 + 0.12);
      g.fillCircle(Phaser.Math.Between(-50, 50), Phaser.Math.Between(-8, 2), 2);
    }

    g.restore();
  }
}
