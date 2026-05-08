import Phaser from 'phaser';
import { Ocean } from './Ocean.js';
import { Submarine } from './Submarine.js';
import { Enemy, STATE } from './Enemy.js';
import { Sonar } from './Sonar.js';

const WORLD_W       = 4096;
const SURFACE_Y     = 80;
const THERMO_Y      = 280;
const OCEAN_FLOOR_Y = 580;
const CAM_W = 1024;
const CAM_H = 640;

const $  = id => document.getElementById(id);
const hudDepth    = $('hud-depth');
const hudSpeed    = $('hud-speed');
const hudBallast  = $('hud-ballast');
const hudNoise    = $('hud-noise');
const hudHull     = $('hud-hull');
const hudBattery  = $('hud-battery');
const hudOxygen   = $('hud-oxygen');
const barBallast  = $('bar-ballast');
const barNoise    = $('bar-noise');
const barHull     = $('bar-hull');
const barBattery  = $('bar-battery');
const barOxygen   = $('bar-oxygen');
const labelNoise  = $('label-noise');
const labelBatt   = $('label-battery');
const alertBanner = $('alert-banner');
const eventLog    = $('event-log');

// Detection state labels + CSS classes
const ALERT_CFG = {
  hidden:  { text: '',                cls: '' },
  warning: { text: 'NAMIERZONE',      cls: 'visible warning' },
  danger:  { text: '!! WYKRYTO !!',   cls: 'visible danger'  },
};

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.WORLD_W       = WORLD_W;
    this.SURFACE_Y     = SURFACE_Y;
    this.THERMO_Y      = THERMO_Y;
    this.OCEAN_FLOOR_Y = OCEAN_FLOOR_Y;
  }

  preload() {}

  create() {
    this.camX = 0;

    this.ocean = new Ocean(this);
    this.sub   = new Submarine(this, CAM_W / 2, SURFACE_Y + 55);

    // Enemy destroyers — three patrol zones across the world
    this.enemies = [
      new Enemy(this,  900,   200,  1400, 'ORP-1'),
      new Enemy(this, 2100,  1500,  2800, 'ORP-2'),
      new Enemy(this, 3300,  2800,  4000, 'ORP-3'),
    ];

    this._addDepthLabels();
    this.sonar = new Sonar(this, CAM_W - 90, CAM_H - 90, 75);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = {
      w:     this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      s:     this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      a:     this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      d:     this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      shift: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      space: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    };

    this._drawCRT();

    this.add.text(8, THERMO_Y + 4, '— TERMOKLINA (~200m) —', {
      fontSize: '9px', color: '#0a6a5a', alpha: 0.6,
    });

    const warnY  = SURFACE_Y + (300 / 600) * (OCEAN_FLOOR_Y - SURFACE_Y);
    const crushY = SURFACE_Y + (400 / 600) * (OCEAN_FLOOR_Y - SURFACE_Y);

    this.warnLine  = this.add.graphics();
    this.crushLine = this.add.graphics();

    this.warnLine.lineStyle(1, 0xff6600, 0.25);
    this.warnLine.strokeLineShape(new Phaser.Geom.Line(0, warnY, WORLD_W, warnY));
    this.crushLine.lineStyle(1, 0xff2200, 0.35);
    this.crushLine.strokeLineShape(new Phaser.Geom.Line(0, crushY, WORLD_W, crushY));

    this.add.text(8, warnY  + 2, '— LIMIT NURKOWANIA (300m) —',     { fontSize: '9px', color: '#884400', alpha: 0.5 });
    this.add.text(8, crushY + 2, '— GŁĘBOKOŚĆ KRYTYCZNA (400m) —',  { fontSize: '9px', color: '#882200', alpha: 0.6 });

    // State tracking for event log
    this._prevBattery     = 1;
    this._prevOxygen      = 1;
    this._prevHull        = 1;
    this._prevOnFloor     = false;
    this._groundedTimer   = 0;
    this._prevBelowThermo = false;
    this._prevCavitating  = false;
    // Per-enemy state tracking: Map<Enemy, STATE>
    this._prevEnemyState  = new Map(this.enemies.map(e => [e, STATE.PATROL]));
  }

  update(time, delta) {
    const dt = delta / 1000;

    this.sub.update(delta, this.cursors, this.keys);

    // Screen shake on collision
    if (this.sub.impactVelocity > 25) {
      const intensity = Phaser.Math.Clamp(this.sub.impactVelocity / 1400, 0.002, 0.016);
      const duration  = Phaser.Math.Clamp(this.sub.impactVelocity * 1.5, 80, 300);
      this.cameras.main.shake(duration, intensity);
    }

    if (this.sub.onFloor) { this._groundedTimer += dt; }
    else                  { this._groundedTimer  = 0;  }

    // Update enemies + handle depth charge effects
    for (const enemy of this.enemies) {
      enemy.update(dt, this.sub);
      for (const exp of enemy.recentExplosions) {
        const intensity = Phaser.Math.Clamp(1 - exp.dist / 85, 0, 1);
        if (intensity > 0.1) {
          this.cameras.main.shake(200 + intensity * 300, 0.004 + intensity * 0.018);
          if (intensity > 0.6) {
            this.cameras.main.flash(120, 255, 200, 100, false);
          }
          this._logEvent('ZARZUT GŁĘBINOWY!');
        }
      }
    }

    const targetCamX = this.sub.x - CAM_W / 2;
    this.camX = Phaser.Math.Linear(this.camX, targetCamX, 0.08);
    this.camX = Phaser.Math.Clamp(this.camX, 0, WORLD_W - CAM_W);

    this._applyCamera();
    this.ocean.update(delta, this.camX);
    this.sonar.update(delta, this.sub, this.enemies);
    this._updateHUD();
    this._checkEvents();
  }

  _applyCamera() {
    this.sub.graphics.x  = -this.camX;
    this.ocean.bg.x      = -this.camX;
    this.ocean.waveGfx.x = -this.camX;
    this.warnLine.x      = -this.camX;
    this.crushLine.x     = -this.camX;
    for (const e of this.enemies) e.gfx.x = -this.camX;
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  _updateHUD() {
    const sub     = this.sub;
    const speed   = Math.sqrt(sub.vx ** 2 + sub.vy ** 2);
    const knots   = (speed * 0.019).toFixed(1);
    const ballast = Math.round(sub.ballast * 100);
    const hull    = Math.round(sub.hull * 100);
    const battery = Math.round(sub.battery * 100);
    const oxygen  = Math.round(sub.oxygen * 100);
    const noiseEff = Math.round(sub.noiseEffective * 100);

    hudDepth.textContent   = `${sub.depthMetres} m`;
    hudSpeed.textContent   = `${knots} w`;
    hudBallast.textContent = `${ballast}%`;
    hudNoise.textContent   = `${noiseEff}%`;
    hudHull.textContent    = `${hull}%`;
    hudBattery.textContent = `${battery}%`;
    hudOxygen.textContent  = `${oxygen}%`;

    barBallast.style.width = `${ballast}%`;
    barNoise.style.width   = `${noiseEff}%`;
    barHull.style.width    = `${hull}%`;
    barBattery.style.width = `${battery}%`;
    barOxygen.style.width  = `${oxygen}%`;

    barBallast.className = 'hud-bar-fill';

    if (sub.cavitating) {
      barNoise.className = 'hud-bar-fill cavitating';
    } else {
      barNoise.className = 'hud-bar-fill ' + (noiseEff > 65 ? 'danger' : noiseEff > 38 ? 'warning' : '');
    }

    labelNoise.textContent = sub.belowThermocline ? 'Hałas (MASK)' : 'Hałas';
    labelNoise.className   = 'hud-label' + (sub.belowThermocline ? ' masked' : '');

    if (sub.snorkeling) {
      barBattery.className  = 'hud-bar-fill charging';
      labelBatt.textContent = 'Bateria (↑)';
    } else {
      barBattery.className  = 'hud-bar-fill ' + (battery < 20 ? 'danger' : battery < 40 ? 'warning' : '');
      labelBatt.textContent = 'Bateria';
    }

    barHull.className   = 'hud-bar-fill ' + (hull < 30 ? 'danger' : hull < 60 ? 'warning' : '');
    barOxygen.className = 'hud-bar-fill ' + (oxygen < 20 ? 'danger' : oxygen < 40 ? 'warning' : '');

    // Alert banner: driven by enemy detection state (not raw noise)
    const anyHunt  = this.enemies.some(e => e.state === STATE.HUNT);
    const anyAlert = this.enemies.some(e => e.state === STATE.ALERT || e.state === STATE.SEARCH);

    const cfg = anyHunt ? ALERT_CFG.danger : anyAlert ? ALERT_CFG.warning : ALERT_CFG.hidden;
    alertBanner.textContent  = cfg.text;
    alertBanner.className    = cfg.cls;
  }

  // ── Event log ──────────────────────────────────────────────────────────────

  _checkEvents() {
    const sub = this.sub;

    if (this._prevBattery > 0.2  && sub.battery <= 0.2)  this._logEvent('UWAGA: Niski poziom baterii');
    if (this._prevBattery > 0.0  && sub.battery <= 0.0)  this._logEvent('KRYTYCZNE: Bateria wyczerpana');
    if (this._prevOxygen  > 0.25 && sub.oxygen  <= 0.25) this._logEvent('UWAGA: Niski poziom tlenu — wynurzyć!');
    if (this._prevOxygen  > 0.0  && sub.oxygen  <= 0.0)  this._logEvent('KRYTYCZNE: Brak tlenu');
    if (this._prevHull    > 0.6  && sub.hull    <= 0.6)  this._logEvent('UWAGA: Uszkodzenie kadłuba');
    if (this._prevHull    > 0.3  && sub.hull    <= 0.3)  this._logEvent('KRYTYCZNE: Kadłub poważnie uszkodzony');

    if (!this._prevOnFloor && sub.onFloor) {
      this._logEvent(sub.impactVelocity > 60 ? 'UDERZENIE W DNO — uszkodzenie!' : 'Kontakt z dnem');
    }
    if (sub.onFloor && Math.floor(this._groundedTimer) === 4) {
      this._logEvent('Łódź osiadła — wyrzuć balast!');
    }
    this._prevOnFloor = sub.onFloor;

    const depth = sub.depthMetres;
    if (!this._warnedDepth300 && depth > 300) { this._logEvent('UWAGA: Przekroczono limit (300m)'); this._warnedDepth300 = true; }
    if (depth < 280) this._warnedDepth300 = false;
    if (!this._warnedDepth400 && depth > 400) { this._logEvent('KRYTYCZNE: Głębokość krytyczna!'); this._warnedDepth400 = true; }
    if (depth < 380) this._warnedDepth400 = false;

    if (!this._prevBelowThermo && sub.belowThermocline) this._logEvent('Termoklina — hałas maskowany −42%');
    if (this._prevBelowThermo  && !sub.belowThermocline) this._logEvent('Powyżej termokliny — brak maskowania');
    this._prevBelowThermo = sub.belowThermocline;

    if (!this._prevCavitating && sub.cavitating) this._logEvent('KAWITACJA — zwolnij, jesteś głośny!');
    this._prevCavitating = sub.cavitating;

    // Enemy state transitions
    for (const enemy of this.enemies) {
      const prev = this._prevEnemyState.get(enemy);
      const curr = enemy.state;
      if (prev !== curr) {
        if (curr === STATE.ALERT)  this._logEvent(`Niszczyciel namierzył hałas — szuka...`);
        if (curr === STATE.HUNT)   this._logEvent(`NISZCZYCIEL ATAKUJE — zarzuty głębinowe!`);
        if (curr === STATE.SEARCH) this._logEvent(`Niszczyciel przeszukuje obszar...`);
        if (curr === STATE.PATROL && prev !== STATE.PATROL) this._logEvent(`Niszczyciel wrócił na patrol.`);
        this._prevEnemyState.set(enemy, curr);
      }
    }

    this._prevBattery = sub.battery;
    this._prevOxygen  = sub.oxygen;
    this._prevHull    = sub.hull;
  }

  _logEvent(msg) {
    const el = document.createElement('div');
    el.className   = 'event-msg';
    el.textContent = msg;
    eventLog.prepend(el);

    setTimeout(() => {
      el.classList.add('fading');
      setTimeout(() => el.remove(), 600);
    }, 4400);

    while (eventLog.children.length > 4) eventLog.lastChild.remove();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _addDepthLabels() {
    const pxPerM = (OCEAN_FLOOR_Y - SURFACE_Y) / 600;
    for (const m of [0, 50, 100, 150, 200, 300, 400, 500, 600]) {
      this.add.text(4, SURFACE_Y + m * pxPerM + 2, `${m}m`, {
        fontSize: '9px', color: '#1a4a3a', alpha: 0.55,
      });
    }
  }

  _drawCRT() {
    const overlay = this.add.graphics().setDepth(100);
    for (let y = 0; y < CAM_H; y += 4) {
      overlay.fillStyle(0x000000, 0.07);
      overlay.fillRect(0, y, CAM_W, 2);
    }
    for (let i = 0; i < 18; i++) {
      overlay.lineStyle(i * 1.5, 0x000000, (i / 18) * 0.3);
      overlay.strokeRect(i, i, CAM_W - i * 2, CAM_H - i * 2);
    }
  }
}
