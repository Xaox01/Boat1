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
    const torpH = this.systems.torpedy?.health ?? 1.0;
    if (torpH <= 0) return false;           // sys. torpedowy zniszczony
    if (this._salvoCD > 0) return false;
    // Uszkodzenia blokują kolejne rury (0.7→3, 0.4→2, 0.15→1, 0→0)
    const availCount = torpH > 0.7 ? 4 : torpH > 0.4 ? 3 : torpH > 0.15 ? 2 : 1;
    const tube = this.tubes.slice(0, availCount).find(t => t.loaded);
    if (!tube) return false;
    tube.loaded = false;
    tube.reloadTimer = tube.reloadBase;
    this._torpedosFired++;
    this._salvoCD = 3.0;
    this.torpedoes.push(new Torpedo(this.scene, this.x, this.y, targetX, targetY));
    return tube.id;
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

  // Rakieta wymaga głębokości ≤ 70m i sprawnego systemu rakietowego
  fireMissile(targetX) {
    if (this.missileCount  <= 0)  return 'brak';
    if (this.missileFireCD >  0)  return 'cd';
    if (this.depthMetres   >  70) return 'za_gleboko';
    if ((this.systems.rakiety?.health ?? 1) <= 0) return 'awaria';
    this.missileCount--;
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

    // Wabie akustyczne — starzenie i usuwanie
    for (const n of this.noisemakers) n.age += dt;
    this.noisemakers = this.noisemakers.filter(n => n.age < n.lifetime);
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
      const px = this.x - Math.cos(this.angle) * 62;
      const py = this.y - Math.sin(this.angle) * 62;
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

    // ── Kadłub — sprite Kilo-class (Projekt 877) ─────────────────────────────
    g.save();
    g.translateCanvas(this.x, this.y);
    g.rotateCanvas(this.angle);

    const s = 0.20;   // skala: design 610px → ~122px w grze

    // Pomocnik: sampleuje cubic Bézier do lineTo (Phaser nie ma bezierCurveTo)
    const cbez = (x0, y0, cp1x, cp1y, cp2x, cp2y, x1, y1, n = 10) => {
      for (let i = 1; i <= n; i++) {
        const t = i / n, mt = 1 - t;
        const x = mt*mt*mt*x0 + 3*mt*mt*t*cp1x + 3*mt*t*t*cp2x + t*t*t*x1;
        const y = mt*mt*mt*y0 + 3*mt*mt*t*cp1y + 3*mt*t*t*cp2y + t*t*t*y1;
        g.lineTo(x, y);
      }
    };

    // Cień pod kadłubem (przy płytkiej głębokości)
    if (this.depthMetres < 5) {
      g.fillStyle(0x000000, 0.30);
      g.fillEllipse(0, 8 * s, 640 * s, 24 * s);
    }

    // ── Kadłub główny — Kilo-class ────────────────────────────────────────────
    const hullBaseCol = this.hull > 0.6 ? 0x070b10
                      : this.hull > 0.3 ? 0x100809 : 0x1e0606;
    g.fillStyle(hullBaseCol, 0.97);
    g.beginPath();
    g.moveTo(-300 * s, 0);
    cbez(-300*s,0, -320*s,-8*s, -310*s,-22*s, -280*s,-28*s);
    g.lineTo(220 * s, -30 * s);
    cbez(220*s,-30*s, 280*s,-30*s, 300*s,-18*s, 310*s,0);
    cbez(310*s,0, 300*s,14*s, 280*s,22*s, 220*s,24*s);
    g.lineTo(-260 * s, 24 * s);
    cbez(-260*s,24*s, -290*s,22*s, -310*s,14*s, -300*s,0);
    g.closePath();
    g.fillPath();

    // Górny highlight — pasmo księżycowe
    g.fillStyle(0x7896af, 0.28);
    g.fillEllipse(-30 * s, -26 * s, 490 * s, 9 * s);

    // Dolny mokry highlight
    g.fillStyle(0x28466a, 0.22);
    g.fillEllipse(-20 * s, 23 * s, 460 * s, 7 * s);

    // Nity / linie poszycia
    g.lineStyle(0.7, 0x324659, 0.35);
    for (let xi = -260; xi < 260; xi += 38) {
      g.strokeLineShape(new Phaser.Geom.Line(xi * s, -23 * s, xi * s, 21 * s));
    }

    // Pozioma linia podziału burty
    g.lineStyle(0.9, 0x1e3246, 0.50);
    g.strokeLineShape(new Phaser.Geom.Line(-280 * s, 2 * s, 290 * s, 2 * s));

    // ── Wyrzutnie torped przy dziobie (4 oczka) ───────────────────────────────
    for (let i = 0; i < 4; i++) {
      const ty = (-16 + i * 11) * s;
      g.fillStyle(0x02050a, 1.0);
      g.fillRect(265 * s, ty, 14 * s, 7 * s);
      g.lineStyle(0.6, 0x506e82, 0.5);
      g.strokeRect(265 * s, ty, 14 * s, 7 * s);
    }
    // Wskaźnik gotowości (zielony = rura załadowana)
    const tubeReady = this.tubes.some(t => t.loaded);
    g.fillStyle(tubeReady ? 0x00cc44 : 0x885500, 0.80);
    g.fillCircle(267 * s, -12 * s, 2);

    // ── Kiosk / Sail ───────────────────────────────────────────────────────────
    g.fillStyle(0x080c12, 1.0);
    g.beginPath();
    g.moveTo(-30 * s, -28 * s);
    cbez(-30*s,-28*s, -30*s,-54*s, -20*s,-72*s, 10*s,-74*s);
    g.lineTo(60 * s, -74 * s);
    cbez(60*s,-74*s, 80*s,-74*s, 88*s,-60*s, 88*s,-28*s);
    g.closePath();
    g.fillPath();

    // Highlight kiosku — lewy brzeg
    g.fillStyle(0x82a0b9, 0.20);
    g.fillEllipse(18 * s, -54 * s, 55 * s, 38 * s);

    // Okienka radarowe kiosku
    g.fillStyle(0x04070c, 1.0);
    g.fillRect(4 * s, -62 * s, 50 * s, 8 * s);

    // Stery głębin kiosku (fairwater planes)
    g.fillStyle(0x06090e, 1.0);
    g.beginPath();
    g.moveTo(-12 * s, -16 * s);
    g.lineTo(-44 * s, -22 * s);
    g.lineTo(-44 * s, -10 * s);
    g.lineTo(-12 * s,  -4 * s);
    g.closePath();
    g.fillPath();

    // ── Maszty przy małej głębokości ──────────────────────────────────────────
    if (this.depthMetres < 40) {
      g.fillStyle(0x06090e, 1.0);
      // Peryskop główny (od wierzchu kiosku -74 w górę o 28)
      g.fillRect(28 * s, -102 * s, 3 * s, 28 * s);
      // Głowica peryskopu
      g.fillCircle(29.5 * s, -106 * s, 4 * s);
      // Soczewka peryskopu — migocze
      const lensFlick = 0.6 + Math.sin(Date.now() * 0.003) * 0.2;
      g.fillStyle(0xfff0c8, lensFlick * 0.60);
      g.fillCircle(31 * s, -106 * s, 1.6 * s);

      // Antena radarowa (od -74 w górę o 36)
      g.fillStyle(0x06090e, 1.0);
      g.fillRect(50 * s, -110 * s, 2.5 * s, 36 * s);
      // Talerz radaru
      g.beginPath();
      g.moveTo(48 * s, -106 * s);
      g.lineTo(60 * s, -110 * s);
      g.lineTo(60 * s, -106 * s);
      g.lineTo(48 * s, -102 * s);
      g.closePath();
      g.fillPath();

      // Maszt snorchla
      g.fillStyle(0x06090e, 1.0);
      g.fillRect(70 * s, -92 * s, 1.6 * s, 18 * s);
      // Wskaźnik ładowania snorchla
      g.fillStyle(this.snorkeling ? 0x44ff66 : 0x55cc88, this.snorkeling ? 0.90 : 0.55);
      g.fillCircle(70.8 * s, -93 * s, 2.5);
    }

    // ── Stery rufowe ───────────────────────────────────────────────────────────
    g.fillStyle(0x06090e, 1.0);
    // Sterołan poziomy
    g.beginPath();
    g.moveTo(-280 * s, -8 * s);
    g.lineTo(-315 * s, -2 * s);
    g.lineTo(-315 * s,  8 * s);
    g.lineTo(-280 * s, 12 * s);
    g.closePath();
    g.fillPath();
    // Sterołan pionowy górny
    g.beginPath();
    g.moveTo(-285 * s, -28 * s);
    g.lineTo(-300 * s, -54 * s);
    g.lineTo(-280 * s, -54 * s);
    g.lineTo(-260 * s, -28 * s);
    g.closePath();
    g.fillPath();
    // Sterołan pionowy dolny
    g.beginPath();
    g.moveTo(-285 * s, 24 * s);
    g.lineTo(-300 * s, 48 * s);
    g.lineTo(-280 * s, 48 * s);
    g.lineTo(-260 * s, 24 * s);
    g.closePath();
    g.fillPath();

    // ── Śruba — 5-łopatowa, widok perspektywiczny z boku ─────────────────────
    const propSpd   = Math.abs(this.enginePower) * (this.battery > 0 ? 1 : 0);
    const propAngle = (Date.now() * 0.003 * (1 + propSpd * 2.2) * (this.cavitating ? 1.9 : 1)) % (Math.PI * 2);
    const propX     = -310 * s;
    // Hub
    g.fillStyle(0x0a0d12, 1.0);
    g.fillCircle(propX, 0, 4 * s);
    // 5 łopat — elipsy perspektywiczne (szerokość zależy od kąta)
    for (let i = 0; i < 5; i++) {
      const ang    = propAngle + (i / 5) * Math.PI * 2;
      const wPersp = (Math.abs(Math.cos(ang)) * 16 + 2) * s;
      const yOff   = Math.sin(ang) * 14 * s;
      const alpha  = 0.4 + Math.abs(Math.cos(ang)) * 0.5;
      g.fillStyle(0x141c24, alpha);
      g.fillEllipse(propX, yOff, 4 * s, wPersp * 2);
    }

    // ── Drzwi wyrzutni (animowane przy odpaleniu) ─────────────────────────────
    const doorFrac = this.scene._launchFX?.doorOpenFraction ?? 0;
    if (doorFrac > 0) {
      const dAngle = doorFrac * 0.9;
      g.save();
      g.translateCanvas(310 * s, -7 * s);
      g.save();
      g.rotateCanvas(-dAngle);
      g.fillStyle(0xe8413a, 0.92);
      g.fillRect(0, -3 * s, 10 * s, 3 * s);
      g.restore();
      g.save();
      g.rotateCanvas(dAngle);
      g.fillStyle(0xe8413a, 0.92);
      g.fillRect(0, 1 * s, 10 * s, 3 * s);
      g.restore();
      g.restore();
    }

    // ── Światła nawigacyjne ───────────────────────────────────────────────────
    g.fillStyle(0xff2222, 1.0); g.fillCircle(-310 * s, 0, 2.0);  // rufowe czerwone
    g.fillStyle(0x22dd22, 1.0); g.fillCircle( 310 * s, 0, 2.0);  // dziobowe zielone

    // Cień kiosku na kadłubie
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(20 * s, -20 * s, 110 * s, 10 * s);

    // ── Uszkodzenia kadłuba ───────────────────────────────────────────────────
    if (this.hull < 0.6) {
      const ca = (0.6 - this.hull) * 3.5;
      g.lineStyle(1.2, 0xff5533, ca);
      g.strokeLineShape(new Phaser.Geom.Line(-100 * s,  8 * s, -60 * s, -16 * s));
      g.strokeLineShape(new Phaser.Geom.Line(  60 * s, -15 * s, 110 * s,  12 * s));
      if (this.hull < 0.3) {
        g.strokeLineShape(new Phaser.Geom.Line(0, -24 * s, 30 * s, 15 * s));
        g.strokeLineShape(new Phaser.Geom.Line(-20 * s, 0, 20 * s, 24 * s));
        if (Math.random() < 0.28) {
          g.fillStyle(0x885522, 0.38);
          g.fillCircle(
            Phaser.Math.Between(-80, 80) * s,
            Phaser.Math.Between(-20, 20) * s,
            Phaser.Math.Between(2, 5)
          );
        }
      }
    }

    // ── Efekty systemowe ──────────────────────────────────────────────────────
    // Uszkodzony napęd — dym z maszynowni (rufa)
    const napedH = this.systems.naped?.health ?? 1.0;
    if (napedH < 0.65 && Math.random() < 0.85) {
      const intensity = (0.65 - napedH) / 0.65;
      g.fillStyle(0x445544, intensity * 0.38 * (0.5 + Math.random() * 0.5));
      g.fillCircle(
        Phaser.Math.Between(-200, -100) * s,
        Phaser.Math.Between(-15, 15) * s,
        Phaser.Math.Between(3, 9)
      );
      if (napedH < 0.25 && Math.random() < 0.4) {
        g.fillStyle(0x774422, 0.35);
        g.fillCircle(
          Phaser.Math.Between(-190, -120) * s,
          Phaser.Math.Between(-12, 12) * s,
          Phaser.Math.Between(2, 5)
        );
      }
    }

    // Uszkodzony balast — bąble z zaworów ciśnieniowych
    const balastH = this.systems.balast?.health ?? 1.0;
    if (balastH < 0.55 && Math.random() < 0.72) {
      const bInt = (0.55 - balastH) / 0.55;
      g.fillStyle(0x88ccff, bInt * 0.55 + 0.12);
      g.fillCircle(
        Phaser.Math.Between(-140, 140) * s,
        Phaser.Math.Between(-24, 6) * s,
        Phaser.Math.Between(1, 4)
      );
    }

    g.restore();
  }
}
