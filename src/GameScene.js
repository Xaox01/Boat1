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
const hudOxygen    = $('hud-oxygen');
const hudTorpedoes = $('hud-torpedoes');
const hudMissiles  = $('hud-missiles');
const hudWave      = $('hud-wave');
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

    // Niszczyciele pojawią się po opóźnieniu — gracz ma czas na zanurzenie
    this.enemies          = [];
    this._enemiesSpawned  = false;
    this._enemySpawnTimer = 0;

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
      r:     this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
    };

    // LPM = torpeda, PPM = rakieta przeciwokrętowa
    this.input.on('pointerdown', (pointer) => {
      if (this._gameOver) return;
      const worldX = pointer.x + this.camX;
      const worldY = pointer.y;

      if (pointer.leftButtonDown()) {
        if (this.sub.fireTorpedo(worldX, worldY)) {
          this._logEvent('Torpeda odpalona!');
        } else if (this.sub.torpedoCount <= 0) {
          this._logEvent('Brak torped!');
        }
      }

      if (pointer.rightButtonDown()) {
        const result = this.sub.fireMissile(worldX);
        if      (result === 'ok')         this._logEvent('Rakieta odpalona!');
        else if (result === 'brak')       this._logEvent('Brak rakiet!');
        else if (result === 'za_gleboko') this._logEvent('Za głęboko! Wynurzyć (max 70m).');
      }
    });

    this.aimGfx = this.add.graphics().setDepth(18);

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
    this._gameOver        = false;
    this._wave            = 1;
    this._waveTransition  = false;
    this._prevEnemyState  = new Map();

    this._logEvent('Zanurz się — wrogie jednostki w pobliżu!');
  }

  update(time, delta) {
    if (this._gameOver) return;

    const dt = delta / 1000;

    // Opóźnione pojawienie się niszczycieli — gracz ma czas na zanurzenie
    if (!this._enemiesSpawned) {
      this._enemySpawnTimer += dt;
      if (this._enemySpawnTimer >= 10) this._spawnEnemies();
    }

    // R = rakieta w kierunku kursora (alternatywa dla PPM na laptopie)
    if (Phaser.Input.Keyboard.JustDown(this.keys.r)) {
      const ptr    = this.input.mousePointer;
      const worldX = ptr.x + this.camX;
      const result = this.sub.fireMissile(worldX);
      if      (result === 'ok')         this._logEvent('Rakieta odpalona!');
      else if (result === 'brak')       this._logEvent('Brak rakiet!');
      else if (result === 'za_gleboko') this._logEvent('Za głęboko! Wynurzyć (max 70m).');
    }

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
      if (enemy.recentPingHit) this._logEvent('PING! Aktywny sonar — wykryto echo!');
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

    // Koordynacja radiowa — atakujący niszczyciel alarmuje pobliskich
    for (const hunter of this.enemies) {
      if (hunter.state !== STATE.HUNT) continue;
      for (const other of this.enemies) {
        if (other === hunter) continue;
        if (Math.abs(other.x - hunter.x) < 2200)
          other.receiveRadioAlert(hunter.lastKnownSubX, hunter.lastKnownSubY);
      }
    }

    // Tykanie i trafienia rakiet gracza
    for (const m of this.sub.missiles) {
      m.update(dt, this.enemies.filter(e => !e.destroyed));
      if (m.recentHit) {
        const { enemy, damage } = m.recentHit;
        enemy.hull -= damage;
        this.cameras.main.shake(400, 0.014);
        this.cameras.main.flash(200, 255, 160, 60, false);
        if (enemy.hull <= 0) {
          enemy.destroyed = true;
          this._logEvent(`${enemy.label || 'Niszczyciel'} zatopiony rakietą!`);
        } else {
          this._logEvent(`Rakieta trafiła — ${enemy.label || 'niszczyciel'} uszkodzony!`);
        }
      }
    }

    // Player torpedo hits vs enemies
    for (const t of this.sub.torpedoes) {
      for (const target of this.enemies.filter(e => !e.destroyed)) {
        const dmg = t.checkHit(target);
        if (dmg > 0) {
          target.hull -= dmg;
          this.cameras.main.shake(300, 0.008);
          this.cameras.main.flash(120, 200, 255, 120, false);
          if (target.hull <= 0) {
            target.destroyed = true;
            this._logEvent(target.label
              ? `${target.label} zatopiony!`
              : 'Wróg zatopiony!');
          } else {
            this._logEvent('Trafienie! Wróg uszkodzony.');
          }
        }
      }
    }

    // Remove destroyed enemies
    for (const e of this.enemies.filter(e => e.destroyed)) e.gfx.destroy();
    this.enemies = this.enemies.filter(e => !e.destroyed);

    // Fala zakończona — spawn kolejnej
    if (!this._gameOver && this._enemiesSpawned && this.enemies.length === 0 && !this._waveTransition) {
      this._waveTransition = true;
      this._logEvent(`Fala ${this._wave} oczyszczona! Przybywają posiłki...`);
      this.time.delayedCall(4500, () => {
        this._wave++;
        this._spawnWave();
        this._waveTransition = false;
      });
    }

    // Lose condition
    if (!this._gameOver && this.sub.hull <= 0) {
      this._gameOver = true;
      this._showEndScreen('OKRĘT ZATOPIONY', 'Kadłub nie wytrzymał. Misja nieudana.', '#ff4a4a');
    }

    const targetCamX = this.sub.x - CAM_W / 2;
    // Lerp niezależny od FPS: ten sam efekt wizualny przy każdej częstotliwości klatek
    const lerpT = 1 - Math.pow(0.92, dt * 60);
    this.camX = Phaser.Math.Linear(this.camX, targetCamX, lerpT);
    this.camX = Phaser.Math.Clamp(this.camX, 0, WORLD_W - CAM_W);

    this._applyCamera();
    this.ocean.update(delta, this.camX);
    this.sonar.update(delta, this.sub, this.enemies, this.sub.torpedoes);
    this._updateHUD();
    this._checkEvents();
    this._drawAimReticle();
  }

  _applyCamera() {
    this.sub.graphics.x  = -this.camX;
    this.ocean.bg.x      = -this.camX;
    this.ocean.waveGfx.x = -this.camX;
    this.warnLine.x      = -this.camX;
    this.crushLine.x     = -this.camX;
    for (const e of this.enemies)       e.gfx.x = -this.camX;
    for (const t of this.sub.torpedoes) t.gfx.x = -this.camX;
    for (const m of this.sub.missiles)  m.gfx.x = -this.camX;
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  // Pomocniki — zapis do DOM tylko gdy wartość się zmieniła
  _setText(el, v) { if (el.textContent !== v) el.textContent = v; }
  _setCls(el, v)  { if (el.className   !== v) el.className   = v; }
  _setW(el, pct)  { const s = `${pct}%`; if (el.style.width !== s) el.style.width = s; }
  _setCol(el, v)  { if (el.style.color !== v) el.style.color = v; }

  _updateHUD() {
    const sub     = this.sub;
    const speed   = Math.sqrt(sub.vx ** 2 + sub.vy ** 2);
    const knots   = (speed * 0.019).toFixed(1);
    const ballast = Math.round(sub.ballast * 100);
    const hull    = Math.round(sub.hull * 100);
    const battery = Math.round(sub.battery * 100);
    const oxygen  = Math.round(sub.oxygen * 100);
    const noiseEff = Math.round(sub.noiseEffective * 100);

    this._setText(hudDepth,    `${sub.depthMetres} m`);
    this._setText(hudSpeed,    `${knots} w`);
    this._setText(hudBallast,  `${ballast}%`);
    this._setText(hudNoise,    `${noiseEff}%`);
    this._setText(hudHull,     `${hull}%`);
    this._setText(hudBattery,  `${battery}%`);
    this._setText(hudOxygen,   `${oxygen}%`);
    this._setText(hudTorpedoes, `${sub.torpedoCount}`);
    this._setCol(hudTorpedoes,
      sub.torpedoCount === 0 ? '#ff4a4a' : sub.torpedoCount <= 1 ? '#ffaa4a' : '#4aff9a');

    const canFire = sub.depthMetres <= 70;
    this._setText(hudMissiles, `${sub.missileCount}`);
    this._setCol(hudMissiles,
      sub.missileCount === 0 ? '#ff4a4a' : !canFire ? '#886600' : '#ffaa00');

    this._setText(hudWave, `${this._wave}`);

    this._setW(barBallast, ballast);
    this._setW(barNoise,   noiseEff);
    this._setW(barHull,    hull);
    this._setW(barBattery, battery);
    this._setW(barOxygen,  oxygen);

    this._setCls(barBallast, 'hud-bar-fill');

    const noiseCls = sub.cavitating ? 'hud-bar-fill cavitating'
                   : 'hud-bar-fill ' + (noiseEff > 65 ? 'danger' : noiseEff > 38 ? 'warning' : '');
    this._setCls(barNoise, noiseCls);

    const noiseLabel = sub.belowThermocline ? 'Hałas (MASK)' : 'Hałas';
    const noiseLCls  = 'hud-label' + (sub.belowThermocline ? ' masked' : '');
    this._setText(labelNoise, noiseLabel);
    this._setCls(labelNoise, noiseLCls);

    const battCls = sub.snorkeling ? 'hud-bar-fill charging'
                  : 'hud-bar-fill ' + (battery < 20 ? 'danger' : battery < 40 ? 'warning' : '');
    this._setCls(barBattery, battCls);
    this._setText(labelBatt, sub.snorkeling ? 'Bateria (↑)' : 'Bateria');

    this._setCls(barHull,   'hud-bar-fill ' + (hull   < 30 ? 'danger' : hull   < 60 ? 'warning' : ''));
    this._setCls(barOxygen, 'hud-bar-fill ' + (oxygen < 20 ? 'danger' : oxygen < 40 ? 'warning' : ''));

    // Alert banner — aktualizuj tylko gdy stan się zmienił
    const anyHunt  = this.enemies.some(e => e.state === STATE.HUNT);
    const anyAlert = this.enemies.some(e => e.state === STATE.ALERT || e.state === STATE.SEARCH);
    const cfg = anyHunt ? ALERT_CFG.danger : anyAlert ? ALERT_CFG.warning : ALERT_CFG.hidden;
    this._setText(alertBanner, cfg.text);
    this._setCls(alertBanner, cfg.cls);
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

    // Enemy state transitions — destroyers
    for (const enemy of this.enemies) {
      const prev = this._prevEnemyState.get(enemy);
      const curr = enemy.state;
      if (prev !== curr) {
        if (curr === STATE.ALERT)  this._logEvent('Niszczyciel namierzył hałas — szuka...');
        if (curr === STATE.HUNT)   this._logEvent('NISZCZYCIEL ATAKUJE — zarzuty głębinowe!');
        if (curr === STATE.SEARCH) this._logEvent('Niszczyciel przeszukuje obszar...');
        if (curr === STATE.PATROL && prev !== STATE.PATROL) this._logEvent('Niszczyciel wrócił na patrol.');
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

  // ── Celownik torpedy ───────────────────────────────────────────────────────

  _drawAimReticle() {
    const g = this.aimGfx;
    g.clear();

    const ptr = this.input.mousePointer;
    const mx  = ptr.x;
    const my  = ptr.y;
    const sx  = this.sub.x - this.camX;   // pozycja łodzi na ekranie
    const sy  = this.sub.y;

    const noAmmo    = this.sub.torpedoCount <= 0;
    const reloading = this.sub.torpedoFireCD > 0;
    const color     = noAmmo    ? 0xff2200
                    : reloading ? 0xff8800 : 0x44ffdd;
    const alpha     = noAmmo    ? 0.25     : 0.65;

    // Przerywana linia trajektorii od łodzi do kursora
    const dx      = mx - sx;
    const dy      = my - sy;
    const lineDst = Math.sqrt(dx * dx + dy * dy);
    const segs    = Math.floor(lineDst / 16);
    for (let i = 0; i < segs; i++) {
      if (i % 2 !== 0) continue;
      const t0 = i / segs;
      const t1 = Math.min((i + 0.5) / segs, 1);
      g.lineStyle(1, color, alpha * 0.45);
      g.strokeLineShape(new Phaser.Geom.Line(
        sx + dx * t0, sy + dy * t0,
        sx + dx * t1, sy + dy * t1
      ));
    }

    // Krzyżyk celowniczy
    g.lineStyle(1.5, color, alpha);
    g.strokeCircle(mx, my, 10);
    const c = 15;
    g.strokeLineShape(new Phaser.Geom.Line(mx - c, my, mx - 12, my));
    g.strokeLineShape(new Phaser.Geom.Line(mx + 12, my, mx + c, my));
    g.strokeLineShape(new Phaser.Geom.Line(mx, my - c, mx, my - 12));
    g.strokeLineShape(new Phaser.Geom.Line(mx, my + 12, mx, my + c));

    // Łuk ładowania (cooldown)
    if (reloading) {
      const frac = 1 - this.sub.torpedoFireCD / 1.8;
      g.lineStyle(2, 0xff8800, 0.75);
      g.beginPath();
      g.arc(mx, my, 13, -Math.PI * 0.5, -Math.PI * 0.5 + frac * Math.PI * 2);
      g.strokePath();
    }

    // Znaczniki ołowiu przy widocznych niszczycielach (pomarańczowy romb, PPM = rakieta)
    for (const { e: enemy, isSurface } of this.enemies.filter(e => !e.destroyed).map(e => ({ e, isSurface: true }))) {
      const ex = enemy.x - this.camX;
      const ey = enemy.y;
      if (ex < -30 || ex > CAM_W + 30) continue;

      const torpSpeed = isSurface ? 340 : 230;
      const edx  = enemy.x - this.sub.x;
      const edy  = enemy.y - this.sub.y;
      const dist = Math.sqrt(edx * edx + edy * edy);
      const travelT = dist / torpSpeed;

      const vel = enemy.getVelocity ? enemy.getVelocity() : { vx: 0, vy: 0 };
      const lx  = ex + vel.vx * travelT * 0.65;
      const ly  = ey + (vel.vy || 0) * travelT * 0.65;

      const diamondColor = isSurface ? 0xff8800 : 0xffcc00;
      g.lineStyle(1.5, diamondColor, 0.7);
      const ds = 7;
      g.strokeLineShape(new Phaser.Geom.Line(lx, ly - ds, lx + ds, ly));
      g.strokeLineShape(new Phaser.Geom.Line(lx + ds, ly, lx, ly + ds));
      g.strokeLineShape(new Phaser.Geom.Line(lx, ly + ds, lx - ds, ly));
      g.strokeLineShape(new Phaser.Geom.Line(lx - ds, ly, lx, ly - ds));
      g.fillStyle(diamondColor, 0.5);
      g.fillCircle(lx, ly, 2);

      // Etykieta broni przy rombie
      if (isSurface) {
        g.lineStyle(0.5, 0xff8800, 0.4);
        g.strokeLineShape(new Phaser.Geom.Line(ex, ey, lx, ly));
      }
    }
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

  _spawnEnemies() {
    this._enemiesSpawned = true;
    this.enemies = [
      new Enemy(this,  900,   200,  1400, 'ORP-1'),
      new Enemy(this, 2100,  1500,  2800, 'ORP-2'),
      new Enemy(this, 3300,  2800,  4000, 'ORP-3'),
    ];
    for (const e of this.enemies) this._prevEnemyState.set(e, STATE.PATROL);
    this._logEvent('UWAGA: Wykryto wrogie niszczyciele!');
  }

  _spawnWave() {
    // Każda fala: +1 niszczyciel, szybsze reakcje
    const count   = Math.min(2 + this._wave, 7);
    const segW    = WORLD_W / count;
    const speedMult = 1 + (this._wave - 1) * 0.12;

    this.enemies = [];
    for (let i = 0; i < count; i++) {
      const cx = segW * (i + 0.5);
      const hw = segW * 0.44;
      const e  = new Enemy(this, cx, cx - hw, cx + hw, `W${this._wave}-${i + 1}`);
      e.patrolSpeed *= speedMult;
      this.enemies.push(e);
    }
    for (const e of this.enemies) this._prevEnemyState.set(e, STATE.PATROL);
    this._logEvent(`FALA ${this._wave}: ${count} niszczyciele! Szybsze reakcje.`);
  }

  _showEndScreen(title, subtitle, color) {
    const overlay = this.add.graphics().setDepth(200);
    overlay.fillStyle(0x000000, 0.72);
    overlay.fillRect(0, 0, CAM_W, CAM_H);

    this.add.text(CAM_W / 2, CAM_H / 2 - 30, title, {
      fontSize: '32px', color, fontFamily: 'Courier New',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(201);

    this.add.text(CAM_W / 2, CAM_H / 2 + 14, subtitle, {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'Courier New',
    }).setOrigin(0.5).setDepth(201);

    this.add.text(CAM_W / 2, CAM_H / 2 + 50, '[ Naciśnij F5 aby zagrać ponownie ]', {
      fontSize: '10px', color: '#555555', fontFamily: 'Courier New',
    }).setOrigin(0.5).setDepth(201);

    // Zatrzymaj wejście
    this.input.keyboard.shutdown();
    this.input.mouse.disableContextMenu = false;
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
