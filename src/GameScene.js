import Phaser from 'phaser';
import { Ocean } from './Ocean.js';
import { Submarine } from './Submarine.js';
import { Enemy, STATE } from './Enemy.js';
import { Sonar } from './Sonar.js';
import { TestBot } from './TestBot.js';

const WORLD_W       = 12000;
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
const hudTorpedoes  = $('hud-torpedoes');
const hudTorpReload = $('hud-torp-reload');
const hudMissiles   = $('hud-missiles');
const hudWave      = $('hud-wave');
const barBallast  = $('bar-ballast');
const barNoise    = $('bar-noise');
const barHull     = $('bar-hull');
const barBattery  = $('bar-battery');
const barOxygen   = $('bar-oxygen');
const labelNoise  = $('label-noise');
const labelSpeed  = $('label-speed');
const labelBatt   = $('label-battery');
const tpClassif   = $('tp-classif');
const tpTrend     = $('tp-trend');
const alertBanner = $('alert-banner');
const eventLog    = $('event-log');
const tpBearing   = $('tp-bearing');
const tpRange     = $('tp-range');
const tpSolution  = $('tp-solution');
const tpTorpCD    = $('tp-torpcd');
const tpThreat    = $('tp-threat');
const shipLogEl   = $('ship-log-entries');
const shipLogTime = $('ship-log-time');

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

    // Pokaż UI gry, ukryj UI menu
    document.getElementById('game-ui').classList.add('active');
    document.getElementById('side-panel').classList.add('active');

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
      b:     this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B),
      e:     this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      m:     this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M),
    };

    this._bot = new TestBot(this);

    // Sonar pasywny — triangulacja
    this._bearingSamples = new Map();   // enemy → [{subX, subY, bearing}]
    this._triangulated   = new Map();   // enemy → {x, y, age, accurate}
    this._triTimer       = 0;

    // Warstwa linii namiarowych (nad oceanem, pod okrętami)
    this.bearingGfx = this.add.graphics().setDepth(12);

    // LPM = torpeda, PPM = rakieta przeciwokrętowa
    this.input.on('pointerdown', (pointer) => {
      if (this._gameOver) return;
      const worldX = pointer.x + this.camX;
      const worldY = pointer.y;

      if (pointer.leftButtonDown()) {
        const tubeId = this.sub.fireTorpedo(worldX, worldY);
        if (tubeId) {
          this._logEvent('Torpeda odpalona!');
          const tb = this._brg(this.sub.x, this.sub.y, worldX, worldY);
          this._shipLog(`Odpalono: Mk.48 z rury nr ${tubeId}. Nam. ${tb}°, gł. ${this.sub.depthMetres}m. Rury gotowe: ${this.sub.torpedoCount}/4.`, 'info');
        } else {
          const wait = Math.ceil(this.sub.torpedoFireCD);
          this._logEvent(`Wszystkie rury ładują się! (${wait}s)`);
        }
      }

      if (pointer.rightButtonDown()) {
        const result = this.sub.fireMissile(worldX);
        if (result === 'ok') {
          this._logEvent('Rakieta odpalona!');
          const mb = worldX > this.sub.x ? 90 : 270;
          this._shipLog(`Odpalono: rakieta p/okrętowa. Kurs ${mb}°, gł. startowa ${this.sub.depthMetres}m.`, 'info');
        }
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
    this._prevBelowThermo   = false;
    this._lastThermoCrossT  = -99;   // cooldown: min 8s między wpisami o termoklinie
    this._prevCavitating    = false;
    this._gameOver        = false;
    this._wave            = 1;
    this._prevEnemyState  = new Map();

    // Tryb piaskownicy — ciągłe generowanie wrogów
    this._enemySerial     = 0;    // globalny licznik spawniętych okrętów
    this._sandboxSpawnCD  = 0;    // cooldown do następnego spawnu
    this._waveTimer       = 0;    // czas do eskalacji zagrożenia

    // Samouczek — sekwencja podpowiedzi podczas odliczania do spawnu wrogów
    this._tutorialTip  = document.getElementById('tutorial-tip');
    this._tutorialText = document.getElementById('tutorial-text');
    this._tutorialHints = [];
    this._tutorialIdx   = 0;
    this._tutorialTimer = 0;
    this._tutorialHideTimer = 0;

    this._missionTime = 0;   // sekundy od startu misji

    // Mapa taktyczna
    this._mapGfx  = this.add.graphics().setDepth(150);
    this._mapOpen = false;
    this._playerTrail = [];
    this._trailTimer  = 0;

    const ms = (color) => ({ fontSize: '7px', fontFamily: 'Courier New', color });
    this._mapTxt = {
      title: this.add.text(0, 0, '', { fontSize: '9px', fontFamily: 'Courier New', color: '#22aa55', letterSpacing: 2 })
        .setDepth(151).setOrigin(0.5, 0.5).setVisible(false),
      info:  this.add.text(0, 0, '', ms('#1a6a3a')).setDepth(151).setOrigin(1, 0).setVisible(false),
      m0:    this.add.text(0, 0, '0m',              ms('#1a5a3a')).setDepth(151).setVisible(false),
      mT:    this.add.text(0, 0, 'TERMOKLINA',      ms('#007a88')).setDepth(151).setVisible(false),
      mC:    this.add.text(0, 0, 'GL. KRYTYCZNA',   ms('#884400')).setDepth(151).setVisible(false),
      mF:    this.add.text(0, 0, 'DNO ~600m',        ms('#1a3a2a')).setDepth(151).setVisible(false),
      scale: this.add.text(0, 0, '2 km',            ms('#1a5a3a')).setDepth(151).setOrigin(0.5, 0).setVisible(false),
    };
    // Etykiety km na siatce (co ~2400m = 2000px)
    this._mapKmTxt = [];
    for (let x = 0; x <= WORLD_W; x += 2000) {
      const km = (x * 1.2 / 1000).toFixed(1).replace('.0', '');
      this._mapKmTxt.push({
        worldX: x,
        text: this.add.text(0, 0, `${km}km`, ms('#0a3a18')).setDepth(151).setOrigin(0.5, 1).setVisible(false),
      });
    }

    this._logEvent('Zanurz się — wrogie jednostki w pobliżu!');
    this._shipLog('ORP Orzeł — misja bojowa. Zanurzono na pozycję.', 'info');
  }

  update(_time, delta) {
    if (this._gameOver) return;

    const dt = delta / 1000;

    // Opóźnione pojawienie się niszczycieli + samouczek
    if (!this._enemiesSpawned) {
      this._enemySpawnTimer += dt;
      if (this._enemySpawnTimer >= 15) this._spawnEnemies();
      this._updateTutorial(dt);
    } else if (this._tutorialTip.classList.contains('visible')) {
      // Ukryj panel po spawnie wrogów
      this._tutorialTip.classList.remove('visible');
    }

    // B = toggle bota testowego
    if (Phaser.Input.Keyboard.JustDown(this.keys.b)) {
      this._bot.active ? this._bot.stop() : this._bot.start();
    }

    this._bot.update(dt);

    // E = zdalna detonacja najstarszej torpedy
    if (Phaser.Input.Keyboard.JustDown(this.keys.e)) {
      const t = this.sub.torpedoes.find(t => !t.exploded && t.armed);
      if (t) { t.cmdDetonate = true; this._logEvent('Detonacja zdalna!'); }
    }

    // Wykrywanie torpedy przez wrogów — kontrmanewry
    for (const t of this.sub.torpedoes) {
      if (!t.armed || t.exploded) continue;
      for (const enemy of this.enemies) {
        if (enemy.destroyed) continue;
        const dx = enemy.x - t.x, dy = enemy.y - t.y;
        if (Math.sqrt(dx * dx + dy * dy) < 480) enemy.evadeTorpedo(t.x);
      }
    }

    // Triangulacja co 4 sekundy
    this._triTimer += dt;
    if (this._triTimer >= 4) {
      this._triTimer = 0;
      this._recordBearings();
      this._tryTriangulate();
    }
    for (const [, tri] of this._triangulated) tri.age += dt;
    for (const [k, tri] of this._triangulated) { if (tri.age > 30) this._triangulated.delete(k); }

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

    // Powiadomienie o załadowaniu rury torpedowej
    if (this.sub.recentTubeLoaded !== null) {
      this._logEvent(`Rura ${this.sub.recentTubeLoaded} — GOTOWA`);
      this._shipLog(`Rura nr ${this.sub.recentTubeLoaded} załadowana. Mk.48 gotowa do odpalenia.`, 'good');
    }

    // Screen shake on collision
    if (this.sub.impactVelocity > 25) {
      const intensity = Phaser.Math.Clamp(this.sub.impactVelocity / 1400, 0.002, 0.016);
      const duration  = Phaser.Math.Clamp(this.sub.impactVelocity * 1.5, 80, 300);
      this.cameras.main.shake(duration, intensity);
    }

    if (this.sub.onFloor) { this._groundedTimer += dt; }
    else                  { this._groundedTimer  = 0;  }

    // Update enemies + handle depth charge / ASROC effects
    for (const enemy of this.enemies) {
      enemy.update(dt, this.sub);
      if (enemy.recentPingHit) {
        this._logEvent('PING! Aktywny sonar — wykryto echo!');
        const pb = this._brg(this.sub.x, this.sub.y, enemy.x, enemy.y);
        const pr = this._rng(this.sub.x, this.sub.y, enemy.x, enemy.y);
        this._shipLog(`AKTYWNY: echa sonar — ${enemy.label || 'kontakt'}. Nam. ${pb}°, dyst. ${pr}m.`, 'warn');
      }
      if (enemy.recentASROC) {
        this._logEvent('ASROC! Rakieta p/okrętowa odpalona!');
        const ab = this._brg(this.sub.x, this.sub.y, enemy.x, enemy.y);
        this._shipLog(`Wykryto odpalenie ASROC — ${enemy.label || 'niszczyciel'}. Nam. ${ab}°. Procedury unikania!`, 'danger');
      }

      for (const exp of enemy.recentExplosions) {
        const intensity = Phaser.Math.Clamp(1 - exp.dist / 85, 0, 1);
        if (intensity > 0.1) {
          this.cameras.main.shake(200 + intensity * 300, 0.004 + intensity * 0.018);
          if (intensity > 0.6) this.cameras.main.flash(120, 255, 200, 100, false);
          this._logEvent('ZARZUT GŁĘBINOWY!');
        }
      }

      // Torpedy samonaprowadzające z ASROC
      for (const ht of enemy.homingTorpedoes) {
        if (ht.recentHit) {
          this.sub.hull -= ht.recentHit.damage;
          this.sub.hull  = Math.max(0, this.sub.hull);
          this.cameras.main.shake(550, 0.025);
          this.cameras.main.flash(180, 255, 140, 60, false);
          this._logEvent('TRAFIENIE — torpeda naprowadzana ASROC!');
          this._shipLog(`Trafienie torpedą samonaprowadzającą ASROC. Kadłub: ${Math.round(this.sub.hull * 100)}%.`, 'danger');
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
        enemy.onHit();
        this.cameras.main.shake(400, 0.014);
        this.cameras.main.flash(200, 255, 160, 60, false);
        if (enemy.hull <= 0) {
          enemy.destroyed = true;
          this._logEvent(`${enemy.label || 'Niszczyciel'} zatopiony rakietą!`);
          const mb2 = this._brg(this.sub.x, this.sub.y, enemy.x, enemy.y);
          const mr2 = this._rng(this.sub.x, this.sub.y, enemy.x, enemy.y);
          this._shipLog(`Cel zatopiony rakietą — ${enemy.label || 'niszczyciel'}. Nam. ${mb2}°, dyst. ${mr2}m.`, 'good');
        } else {
          this._logEvent(`Rakieta trafiła — ${enemy.label || 'niszczyciel'} uszkodzony!`);
          const mb3 = this._brg(this.sub.x, this.sub.y, enemy.x, enemy.y);
          const withdrawMsg = enemy.hull < 0.5 ? ' Cel wycofuje się.' : '';
          this._shipLog(`Trafienie rakietą — ${enemy.label || 'niszczyciel'}. Nam. ${mb3}°.${withdrawMsg}`, 'warn');
        }
      }
    }

    // Player torpedo hits vs enemies
    for (const t of this.sub.torpedoes) {
      for (const target of this.enemies.filter(e => !e.destroyed)) {
        const dmg = t.checkHit(target);
        if (dmg > 0) {
          target.hull -= dmg;
          target.onHit();
          this.cameras.main.shake(300, 0.008);
          this.cameras.main.flash(120, 200, 255, 120, false);
          if (target.hull <= 0) {
            target.destroyed = true;
            this._logEvent(target.label ? `${target.label} zatopiony!` : 'Wróg zatopiony!');
            const tb2 = this._brg(this.sub.x, this.sub.y, target.x, target.y);
            const tr2 = this._rng(this.sub.x, this.sub.y, target.x, target.y);
            this._shipLog(`Cel zatopiony torpedą Mk.48 — ${target.label || 'niszczyciel'}. Nam. ${tb2}°, dyst. ${tr2}m.`, 'good');
          } else {
            this._logEvent('Trafienie! Wróg uszkodzony.');
            const tb3 = this._brg(this.sub.x, this.sub.y, target.x, target.y);
            const withdrawMsg = target.hull < 0.5 ? ' Cel rozpoczął wycofywanie.' : '';
            this._shipLog(`Trafienie Mk.48 — ${target.label || 'niszczyciel'}. Nam. ${tb3}°.${withdrawMsg}`, 'warn');
          }
        }
      }
    }

    // Remove destroyed enemies
    for (const e of this.enemies.filter(e => e.destroyed)) e.gfx.destroy();
    this.enemies = this.enemies.filter(e => !e.destroyed);

    // Piaskownica — ciągłe uzupełnianie wrogów
    if (!this._gameOver && this._enemiesSpawned) {
      this._sandboxUpdate(dt);
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

    this._missionTime += dt;
    const mm = String(Math.floor(this._missionTime / 60)).padStart(2, '0');
    const ss = String(Math.floor(this._missionTime % 60)).padStart(2, '0');
    this._setText(shipLogTime, `${mm}:${ss}`);

    this._applyCamera();
    this.ocean.update(delta, this.camX);
    this.sonar.update(delta, this.sub, this.enemies, this.sub.torpedoes);
    this._drawBearingLines();
    this._updateHUD();
    this._updateTargetPanel();
    this._checkEvents();
    this._drawAimReticle();

    // Nagrywanie trasy gracza co 2s
    this._trailTimer += dt;
    if (this._trailTimer >= 2) {
      this._trailTimer = 0;
      this._playerTrail.push({ x: this.sub.x, y: this.sub.y });
      if (this._playerTrail.length > 150) this._playerTrail.shift();
    }

    // Mapa taktyczna — klawisz M
    if (Phaser.Input.Keyboard.JustDown(this.keys.m)) {
      this._mapOpen = !this._mapOpen;
      const v = this._mapOpen;
      for (const t of Object.values(this._mapTxt)) t.setVisible(v);
      for (const k of this._mapKmTxt) k.text.setVisible(v);
      if (!v) this._mapGfx.clear();
    }
    if (this._mapOpen) this._drawTacticalMap();
  }

  _applyCamera() {
    this.sub.graphics.x  = -this.camX;
    this.ocean.bg.x      = -this.camX;
    this.ocean.waveGfx.x = -this.camX;
    this.warnLine.x      = -this.camX;
    this.crushLine.x     = -this.camX;
    this.bearingGfx.x = -this.camX;
    for (const e of this.enemies) {
      e.gfx.x = -this.camX;
      for (const a  of e.asrocs)           a.gfx.x  = -this.camX;
      for (const ht of e.homingTorpedoes)  ht.gfx.x = -this.camX;
    }
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
    this._setText(hudTorpedoes, `${sub.torpedoCount}/4`);
    this._setCol(hudTorpedoes,
      sub.torpedoCount === 0 ? '#ff4a4a' : sub.torpedoCount <= 1 ? '#ffaa4a' : '#4aff9a');

    // Wskaźnik ładowania rur — najkrótszy czas do gotowości
    if (hudTorpReload) {
      if (sub.torpedoCount === 4) {
        this._setText(hudTorpReload, '');
      } else {
        const loadingTubes = sub.tubes.filter(t => !t.loaded)
          .sort((a, b) => a.reloadTimer - b.reloadTimer);
        const next = loadingTubes[0];
        const secs = Math.ceil(next.reloadTimer);
        const m    = Math.floor(secs / 60);
        const s    = secs % 60;
        const timeStr = m > 0 ? `${m}m${String(s).padStart(2,'0')}s` : `${s}s`;
        const col = sub.torpedoCount === 0 ? '#ff6600' : '#888888';
        hudTorpReload.textContent = `⟳ ${timeStr}`;
        hudTorpReload.style.color = col;
      }
    }

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

    const inListen  = sub.listenMode;
    this._setText(labelSpeed, inListen ? 'NASŁUCH ◉' : 'Prędkość');
    this._setCls(labelSpeed,  'hud-label' + (inListen ? ' listen' : ''));

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

  // ── Panel namierzania ──────────────────────────────────────────────────────

  _updateTargetPanel() {
    const sub     = this.sub;
    const enemies = this.enemies.filter(e => !e.destroyed);

    // Znajdź najbliższego wroga
    let nearest = null, nearestDist = Infinity;
    for (const e of enemies) {
      const dx = e.x - sub.x, dy = e.y - sub.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < nearestDist) { nearestDist = d; nearest = e; }
    }

    if (!nearest) {
      this._setText(tpBearing,  '---');
      this._setText(tpRange,    '--- m');
      this._setText(tpSolution, '---');
      this._setCls(tpBearing,  'tp-value nodata');
      this._setCls(tpRange,    'tp-value nodata');
      this._setCls(tpSolution, 'tp-value nodata');
      this._setText(tpClassif, '---');
      this._setCls(tpClassif,  'tp-value nodata');
      this._setText(tpTrend,   '---');
      this._setCls(tpTrend,    'tp-value nodata');
    } else {
      const dx      = nearest.x - sub.x;
      const dy      = nearest.y - sub.y;
      const bearRad = Math.atan2(dy, dx);
      const bearDeg = Math.round(((bearRad * 180 / Math.PI) + 360) % 360);
      // Bearing w stylu morskim (0=N, 90=E): przelicz z układu Phaser (0=E)
      const navBear = (bearDeg + 270) % 360;
      const side    = dx >= 0 ? 'P' : 'L';  // Prawoburtowy / Lewoburtowy

      // Zasięg w "metrach" skalibrowanych do gry
      const rangeM  = Math.round(nearestDist * 1.2);

      this._setText(tpBearing, `${String(navBear).padStart(3, '0')}° ${side}`);
      this._setText(tpRange,   `${rangeM} m`);
      this._setCls(tpBearing,  'tp-value');
      this._setCls(tpRange,    nearestDist < 350 ? 'tp-value danger' : nearestDist < 700 ? 'tp-value warning' : 'tp-value');

      // Jakość rozwiązania ogniowego torpedy
      const torpSpeed    = 255;
      const travelT      = nearestDist / torpSpeed;
      const vel          = nearest.getVelocity();
      const interceptX   = nearest.x + vel.vx * travelT * 0.65;
      const interceptY   = nearest.y;
      const ptr          = this.input.mousePointer;
      const aimWorldX    = ptr.x + this.camX;
      const aimWorldY    = ptr.y;
      const aimErr       = Math.sqrt((aimWorldX - interceptX) ** 2 + (aimWorldY - interceptY) ** 2);
      const solutionPct  = Math.round(Math.max(0, 100 - aimErr * 0.25));
      const inRange      = nearestDist < 950;

      if (!inRange) {
        this._setText(tpSolution, 'ZA DALEKO');
        this._setCls(tpSolution, 'tp-value nodata');
      } else {
        this._setText(tpSolution, `${solutionPct}%`);
        this._setCls(tpSolution,
          solutionPct >= 70 ? 'tp-value ready' :
          solutionPct >= 40 ? 'tp-value warning' : 'tp-value danger');
      }

      // Klasyfikacja i trend z danych sonarowych
      const cls = nearest.contactClass || 'UNK';
      this._setText(tpClassif, cls);
      this._setCls(tpClassif,
        cls === 'WARSHIP' ? 'tp-value danger' :
        cls === 'SURFACE' ? 'tp-value warning' : 'tp-value nodata');

      const sc = this.sonar?.contacts?.find(c => c.enemy === nearest);
      const trend = sc?.approach ?? '';
      if (trend === 'ZBLIŻA') {
        this._setText(tpTrend, '↗ ZBLIŻA SIĘ');
        this._setCls(tpTrend, 'tp-value danger');
      } else if (trend === 'ODDALA') {
        this._setText(tpTrend, '↙ ODDALA SIĘ');
        this._setCls(tpTrend, 'tp-value');
      } else {
        this._setText(tpTrend, '---');
        this._setCls(tpTrend, 'tp-value nodata');
      }
    }

    // Status rur torpedowych w panelu namierzania
    if (sub.torpedoCount > 0) {
      this._setText(tpTorpCD, `GOTOWA (${sub.torpedoCount}/4)`);
      this._setCls(tpTorpCD, 'tp-value ready');
    } else {
      const secs = Math.ceil(sub.torpedoFireCD);
      const m    = Math.floor(secs / 60);
      const s    = secs % 60;
      const timeStr = m > 0 ? `${m}m ${String(s).padStart(2,'0')}s` : `${secs}s`;
      this._setText(tpTorpCD, `⟳ ${timeStr}`);
      this._setCls(tpTorpCD, 'tp-value danger');
    }

    // Zagrożenie przychodzące — torpedy naprowadzane z ASROC
    const incomingTorps = this.enemies.flatMap(e => e.homingTorpedoes).filter(ht => ht.locked);
    const incomingASROC = this.enemies.flatMap(e => e.asrocs).filter(a => !a.dead && !a.splashed);
    if (incomingTorps.length > 0) {
      this._setText(tpThreat, `▼ TORPEDA NAPROW. x${incomingTorps.length}`);
    } else if (incomingASROC.length > 0) {
      this._setText(tpThreat, `↑ ASROC W LOCIE x${incomingASROC.length}`);
    } else {
      this._setText(tpThreat, '');
    }
  }

  // ── Event log ──────────────────────────────────────────────────────────────

  _checkEvents() {
    const sub = this.sub;

    if (this._prevBattery > 0.2  && sub.battery <= 0.2)  { this._logEvent('UWAGA: Niski poziom baterii'); this._shipLog('Mel. ładowni: baterie słabe. Zalecane wynurzenie na ładowanie.', 'warn'); }
    if (this._prevBattery > 0.0  && sub.battery <= 0.0)  { this._logEvent('KRYTYCZNE: Bateria wyczerpana'); this._shipLog('Baterie wyczerpane. Okręt bez napędu elektrycznego.', 'danger'); }
    if (this._prevOxygen  > 0.25 && sub.oxygen  <= 0.25) { this._logEvent('UWAGA: Niski poziom tlenu — wynurzyć!'); this._shipLog(`Tlen krytyczny — ${Math.round(sub.oxygen * 100)}%. Zarządzono wynurzenie awaryjne.`, 'warn'); }
    if (this._prevOxygen  > 0.0  && sub.oxygen  <= 0.0)  { this._logEvent('KRYTYCZNE: Brak tlenu'); this._shipLog('Brak tlenu. Załoga w niebezpieczeństwie bezpośrednim.', 'danger'); }
    if (this._prevHull    > 0.6  && sub.hull    <= 0.6)  { this._logEvent('UWAGA: Uszkodzenie kadłuba'); this._shipLog(`Uszkodzenia kadłuba — ${Math.round(sub.hull * 100)}%. Zredukować głębokość roboczą.`, 'warn'); }
    if (this._prevHull    > 0.3  && sub.hull    <= 0.3)  { this._logEvent('KRYTYCZNE: Kadłub poważnie uszkodzony'); this._shipLog(`Poważne uszkodzenia kadłuba — ${Math.round(sub.hull * 100)}%. Ryzyko implozji. Wynurzyć.`, 'danger'); }

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

    if (this._prevBelowThermo !== sub.belowThermocline && this._missionTime - this._lastThermoCrossT > 8) {
      this._lastThermoCrossT = this._missionTime;
      if (sub.belowThermocline) {
        this._logEvent('Termoklina — hałas maskowany −42%');
        this._shipLog(`Termoklina przekroczona. Gł. ${sub.depthMetres}m — maskowanie akustyczne aktywne.`, 'info');
      } else {
        this._logEvent('Powyżej termokliny — brak maskowania');
        this._shipLog(`Powyżej termokliny. Gł. ${sub.depthMetres}m — okręt bez maskowania akustycznego.`, 'warn');
      }
    }
    this._prevBelowThermo = sub.belowThermocline;

    if (!this._prevCavitating && sub.cavitating) this._logEvent('KAWITACJA — zwolnij, jesteś głośny!');
    this._prevCavitating = sub.cavitating;

    // Enemy state transitions — destroyers
    for (const enemy of this.enemies) {
      const prev = this._prevEnemyState.get(enemy);
      const curr = enemy.state;
      if (prev !== curr) {
        const eb = this._brg(this.sub.x, this.sub.y, enemy.x, enemy.y);
        const er = this._rng(this.sub.x, this.sub.y, enemy.x, enemy.y);
        if (curr === STATE.ALERT)    { this._logEvent('Niszczyciel namierzył hałas — szuka...'); this._shipLog(`${enemy.label || 'Niszczyciel'} — ALERT. Wykryto sygnał akustyczny. Nam. ${eb}°, dyst. ${er}m.`, 'warn'); }
        if (curr === STATE.HUNT)     { this._logEvent('NISZCZYCIEL ATAKUJE — zarzuty + ASROC!'); this._shipLog(`${enemy.label || 'Niszczyciel'} — ATAKUJE. Okręt namierzony. Nam. ${eb}°. Procedury unikania!`, 'danger'); }
        if (curr === STATE.SEARCH)   { this._logEvent('Niszczyciel przeszukuje obszar...'); this._shipLog(`${enemy.label || 'Niszczyciel'} — przeszukuje sektor. Nam. ${eb}°. Zachować ciszę.`, 'warn'); }
        if (curr === STATE.WITHDRAW) { this._logEvent('Niszczyciel wycofuje się!'); this._shipLog(`${enemy.label || 'Niszczyciel'} — WYCOFYWANIE. Nam. ${eb}°, dyst. ${er}m. Ślad olejowy na powierzchni.`, 'info'); }
        if (curr === STATE.PATROL && prev !== STATE.PATROL) { this._logEvent('Niszczyciel wrócił na patrol.'); this._shipLog(`${enemy.label || 'Niszczyciel'} — kontakt utracony. Powrót na patrol.`, 'info'); }
        this._prevEnemyState.set(enemy, curr);
      }
    }

    this._prevBattery = sub.battery;
    this._prevOxygen  = sub.oxygen;
    this._prevHull    = sub.hull;
  }

  // ── Sonar pasywny — linie namiarowe w widoku głównym ─────────────────────

  _drawBearingLines() {
    const g   = this.bearingGfx;
    const sub = this.sub;
    g.clear();

    const sx = sub.x;
    const sy = sub.y;

    for (const enemy of this.enemies) {
      const dx   = enemy.x - sx;
      const dy   = enemy.y - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const enemyNoise = 0.18 + (enemy.state === STATE.HUNT   ? 0.50
                                : enemy.state === STATE.ALERT  ? 0.28
                                : enemy.state === STATE.SEARCH ? 0.18 : 0.08);
      const sig = Phaser.Math.Clamp(enemyNoise * 750 / Math.max(dist, 80), 0, 1);
      if (sig < 0.04) continue;

      const bearing = Math.atan2(dy, dx);
      const col     = enemy.state === STATE.HUNT   ? 0xff4444
                    : enemy.state === STATE.ALERT  ? 0xffbb00
                    : enemy.state === STATE.SEARCH ? 0xcc8800
                                                   : 0x44ffcc;

      // Długa linia namiarowa (przez cały świat)
      const lineLen = 2200;
      g.lineStyle(0.7 + sig * 1.4, col, sig * 0.28);
      g.strokeLineShape(new Phaser.Geom.Line(
        sx, sy,
        sx + Math.cos(bearing) * lineLen,
        sy + Math.sin(bearing) * lineLen
      ));

      // Tick-mark 80px od łodzi
      const tickDist = 80;
      const tx    = sx + Math.cos(bearing) * tickDist;
      const ty    = sy + Math.sin(bearing) * tickDist;
      const perp  = bearing + Math.PI / 2;
      const tLen  = 5 + sig * 4;
      g.lineStyle(1.4, col, sig * 0.65);
      g.strokeLineShape(new Phaser.Geom.Line(
        tx + Math.cos(perp) * tLen, ty + Math.sin(perp) * tLen,
        tx - Math.cos(perp) * tLen, ty - Math.sin(perp) * tLen
      ));

      // Triangulowana pozycja w widoku gry
      const tri = this._triangulated.get(enemy);
      if (tri && tri.age < 28) {
        const fade = 1 - tri.age / 28;
        const err  = tri.accurate ? 10 : 22;
        g.lineStyle(1.2, 0xffcc44, fade * 0.65);
        g.strokeCircle(tri.x, tri.y, err);
        g.lineStyle(1.5, 0xffcc44, fade * 0.85);
        g.strokeLineShape(new Phaser.Geom.Line(tri.x - 14, tri.y, tri.x + 14, tri.y));
        g.strokeLineShape(new Phaser.Geom.Line(tri.x, tri.y - 14, tri.x, tri.y + 14));
      }
    }
  }

  // ── Triangulacja ─────────────────────────────────────────────────────────

  _recordBearings() {
    const sub = this.sub;
    for (const enemy of this.enemies) {
      const dx  = enemy.x - sub.x;
      const dy  = enemy.y - sub.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const noise = 0.18 + (enemy.state === STATE.HUNT ? 0.50 : 0.10);
      if (noise * 750 / Math.max(dist, 80) < 0.08) continue;

      const bearing = Math.atan2(dy, dx);
      let samples   = this._bearingSamples.get(enemy) || [];
      samples.push({ subX: sub.x, subY: sub.y, bearing });
      if (samples.length > 5) samples.shift();
      this._bearingSamples.set(enemy, samples);
    }
  }

  _tryTriangulate() {
    for (const [enemy, samples] of this._bearingSamples) {
      if (samples.length < 2) continue;
      const s2 = samples[samples.length - 1];
      for (let i = samples.length - 2; i >= 0; i--) {
        const s1 = samples[i];
        const moved   = Math.sqrt((s2.subX - s1.subX) ** 2 + (s2.subY - s1.subY) ** 2);
        let   bdiff   = Math.abs(s2.bearing - s1.bearing);
        if (bdiff > Math.PI) bdiff = Math.PI * 2 - bdiff;

        if (moved > 70 && bdiff > 0.06) {  // sub poruszył się i namiar się zmienił
          const ix = this._intersectRays(s1, s2);
          if (ix && ix.x > 0 && ix.x < WORLD_W && ix.y > SURFACE_Y && ix.y < OCEAN_FLOOR_Y + 50) {
            const accurate = bdiff > 0.18 && moved > 200;
            const prev = this._triangulated.get(enemy);
            if (!prev || (accurate && !prev.accurate)) {
              const txb = this._brg(this.sub.x, this.sub.y, ix.x, this.SURFACE_Y);
              const txr = this._rng(this.sub.x, this.sub.y, ix.x, this.SURFACE_Y);
              this._shipLog(accurate
                ? `Triangulacja: ${enemy.label || 'kontakt'} — pozycja ustalona. Nam. ${txb}°, est. ${txr}m.`
                : `Triangulacja: ${enemy.label || 'kontakt'} — pozycja przybliżona. Nam. ${txb}°.`,
                accurate ? 'good' : 'info');
            }
            this._triangulated.set(enemy, {
              x: ix.x, y: SURFACE_Y,  // niszczyciele są na powierzchni
              age: 0,
              accurate,
            });
          }
          break;
        }
      }
    }
  }

  _intersectRays(s1, s2) {
    const d1x = Math.cos(s1.bearing), d1y = Math.sin(s1.bearing);
    const d2x = Math.cos(s2.bearing), d2y = Math.sin(s2.bearing);
    const denom = d1x * d2y - d1y * d2x;
    if (Math.abs(denom) < 0.001) return null;
    const t = ((s2.subX - s1.subX) * d2y - (s2.subY - s1.subY) * d2x) / denom;
    if (t < 0) return null;
    return { x: s1.subX + t * d1x, y: s1.subY + t * d1y };
  }

  // ── Dziennik pokładowy ────────────────────────────────────────────────────

  _brg(x1, y1, x2, y2) {
    return Math.round(((Math.atan2(x2 - x1, -(y2 - y1)) * 180 / Math.PI) + 360) % 360);
  }

  _rng(x1, y1, x2, y2) {
    return Math.round(Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) * 1.2);
  }

  _shipLog(msg, type = '') {
    if (!shipLogEl) return;
    const mm  = String(Math.floor((this._missionTime || 0) / 60)).padStart(2, '0');
    const ss  = String(Math.floor((this._missionTime || 0) % 60)).padStart(2, '0');

    const row  = document.createElement('div');
    row.className = 'log-entry';
    const tEl  = document.createElement('span');
    tEl.className = 'log-time';
    tEl.textContent = `${mm}:${ss}`;
    const mEl  = document.createElement('span');
    mEl.className = `log-text ${type}`;
    mEl.textContent = msg;
    row.appendChild(tEl);
    row.appendChild(mEl);
    shipLogEl.prepend(row);

    // Max 18 wpisów
    while (shipLogEl.children.length > 18) shipLogEl.removeChild(shipLogEl.lastChild);
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

    const noAmmo    = this.sub.torpedoCount === 0;  // wszystkie rury ładują się
    const reloading = noAmmo;                        // łuk ładowania gdy brak gotowych rur
    const color     = noAmmo ? 0xff2200 : 0x44ffdd;
    const alpha     = noAmmo ? 0.25     : 0.65;

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

    // Łuk postępu ładowania rury
    if (reloading) {
      const frac = this.sub.tubeReadyFraction;
      g.lineStyle(2, 0xff8800, 0.75);
      g.beginPath();
      g.arc(mx, my, 13, -Math.PI * 0.5, -Math.PI * 0.5 + frac * Math.PI * 2);
      g.strokePath();
    }

    // Znaczniki namierzania przy każdym widocznym niszczycielu
    for (const enemy of this.enemies.filter(e => !e.destroyed)) {
      const ex = enemy.x - this.camX;
      const ey = enemy.y;

      // Rysuj wskaźnik kursu też poza ekranem (strzałka na krawędzi)
      if (ex < -60 || ex > CAM_W + 60) {
        // Strzałka kierunkowa na krawędzi ekranu
        const arrowX = Phaser.Math.Clamp(ex, 12, CAM_W - 12);
        const dir    = ex < 0 ? -1 : 1;
        g.fillStyle(0xff8800, 0.55);
        g.fillTriangle(arrowX, ey - 6, arrowX, ey + 6, arrowX + dir * 10, ey);
        continue;
      }

      const TORP_SPD = 255;
      const edx      = enemy.x - this.sub.x;
      const edy      = enemy.y - this.sub.y;
      const dist     = Math.sqrt(edx * edx + edy * edy);
      const travelT  = dist / TORP_SPD;
      const vel      = enemy.getVelocity ? enemy.getVelocity() : { vx: 0, vy: 0 };

      // Punkt ołowiu (gdzie cel będzie gdy torpeda dotrze)
      const lx = ex + vel.vx * travelT * 0.65;
      const ly = ey;

      const inRange      = dist < 950;
      const diamondColor = inRange ? 0xff8800 : 0x886644;
      const alpha        = inRange ? 0.85 : 0.35;

      // Krzyżyk bezpośrednio na wrogu (bieżąca pozycja)
      g.lineStyle(1, 0xffaa55, 0.45);
      g.strokeCircle(ex, ey, 22);
      g.strokeLineShape(new Phaser.Geom.Line(ex - 28, ey, ex - 24, ey));
      g.strokeLineShape(new Phaser.Geom.Line(ex + 24, ey, ex + 28, ey));


      // Przerywana linia do punktu ołowiu
      if (Math.abs(lx - ex) > 5) {
        g.lineStyle(1, diamondColor, 0.30);
        const segs = 6;
        for (let i = 0; i < segs; i++) {
          if (i % 2 !== 0) continue;
          const t0 = i / segs, t1 = (i + 0.8) / segs;
          g.strokeLineShape(new Phaser.Geom.Line(
            ex + (lx - ex) * t0, ey + (ly - ey) * t0,
            ex + (lx - ex) * t1, ey + (ly - ey) * t1,
          ));
        }
      }

      // Romb ołowiu — większy i wyraźniejszy
      g.lineStyle(1.8, diamondColor, alpha);
      const ds = inRange ? 9 : 6;
      g.strokeLineShape(new Phaser.Geom.Line(lx, ly - ds, lx + ds, ly));
      g.strokeLineShape(new Phaser.Geom.Line(lx + ds, ly, lx, ly + ds));
      g.strokeLineShape(new Phaser.Geom.Line(lx, ly + ds, lx - ds, ly));
      g.strokeLineShape(new Phaser.Geom.Line(lx - ds, ly, lx, ly - ds));
      g.fillStyle(diamondColor, inRange ? 0.55 : 0.15);
      g.fillCircle(lx, ly, 2.5);

      // Zielony wypełniony romb gdy celownik blisko punktu ołowiu
      if (inRange) {
        const aimErr = Math.sqrt((mx - lx) ** 2 + (my - ly) ** 2);
        if (aimErr < 24) {
          g.lineStyle(2, 0x44ff88, 0.90);
          g.strokeLineShape(new Phaser.Geom.Line(lx, ly - ds, lx + ds, ly));
          g.strokeLineShape(new Phaser.Geom.Line(lx + ds, ly, lx, ly + ds));
          g.strokeLineShape(new Phaser.Geom.Line(lx, ly + ds, lx - ds, ly));
          g.strokeLineShape(new Phaser.Geom.Line(lx - ds, ly, lx, ly - ds));
        }
      }

      // Stan AI nad niszczycielem
      const stateColors = { 0: 0x44ff88, 1: 0xffbb00, 2: 0xff3300, 3: 0xcc8800 };
      const sc = stateColors[enemy.state] ?? 0x888888;
      g.fillStyle(sc, 0.70);
      g.fillCircle(ex - 14, ey - 28, 4);
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

  _updateTutorial(dt) {
    this._tutorialTimer += dt;

    // Pokaż następną podpowiedź gdy nadszedł jej czas
    if (this._tutorialIdx < this._tutorialHints.length) {
      const hint = this._tutorialHints[this._tutorialIdx];
      if (this._tutorialTimer >= hint.at) {
        this._tutorialText.textContent = hint.msg;
        this._tutorialTip.classList.add('visible');
        this._tutorialIdx++;
        this._tutorialHideTimer = 3.2; // tyle sekund widoczna
      }
    }

    // Chowaj po czasie
    if (this._tutorialTip.classList.contains('visible')) {
      this._tutorialHideTimer -= dt;
      if (this._tutorialHideTimer <= 0 && this._tutorialIdx >= this._tutorialHints.length) {
        this._tutorialTip.classList.remove('visible');
      }
    }
  }

  _getDifficulty() {
    return this.registry.get('difficulty') || { enemies: 3, speedMult: 1.0 };
  }

  _spawnEnemies() {
    this._enemiesSpawned = true;
    const diff  = this._getDifficulty();
    const count = diff.enemies;
    const segW  = WORLD_W / count;
    this.enemies = [];
    for (let i = 0; i < count; i++) {
      const cx = segW * (i + 0.5);
      const hw = segW * 0.46;
      this._enemySerial++;
      const e  = new Enemy(this, cx, Math.max(80, cx - hw), Math.min(WORLD_W - 80, cx + hw), `BPK-${this._enemySerial}`);
      e.patrolSpeed *= diff.speedMult;
      this.enemies.push(e);
    }
    for (const e of this.enemies) this._prevEnemyState.set(e, STATE.PATROL);
    this._logEvent(`UWAGA: Wykryto ${count} wrogie jednostki ZOP!`);
    this._shipLog(`Sygnał wywiadu: ${count} sowieckie BPK wykryte w rejonie operacji.`, 'danger');
  }

  // ── Tryb piaskownicy — ciągłe uzupełnianie i eskalacja ────────────────────

  _sandboxUpdate(dt) {
    const alive  = this.enemies.filter(e => !e.destroyed).length;
    const target = Math.min(3 + Math.floor(this._wave * 0.6), 9);

    if (alive < target) {
      this._sandboxSpawnCD -= dt;
      if (this._sandboxSpawnCD <= 0) {
        // Krótszy cooldown gdy morze puste — wróg szybko wraca
        this._sandboxSpawnCD = alive === 0 ? 5 : 18;
        this._spawnSandboxEnemy();
      }
    } else {
      this._sandboxSpawnCD = Math.max(this._sandboxSpawnCD, 0);
    }

    // Eskalacja zagrożenia co 2 minuty
    this._waveTimer += dt;
    if (this._waveTimer >= 120) {
      this._waveTimer = 0;
      this._wave++;
      this._logEvent(`Poziom zagrożenia: ${this._wave}`);
      this._shipLog(`Dowództwo: Wzrost aktywności wroga. Zagrożenie: poziom ${this._wave}.`, 'warn');
      this._setText($('hud-wave'), `${this._wave}`);
    }
  }

  _spawnSandboxEnemy() {
    const diff    = this._getDifficulty();
    const subX    = this.sub.x;
    const MIN_DIST = 2400;

    // Szukaj pozycji daleko od gracza
    let cx = WORLD_W / 2;
    for (let attempt = 0; attempt < 16; attempt++) {
      cx = 150 + Math.random() * (WORLD_W - 300);
      if (Math.abs(cx - subX) >= MIN_DIST) break;
    }

    const hw    = 950 + Math.random() * 1600;
    const left  = Math.max(80,           cx - hw);
    const right = Math.min(WORLD_W - 80, cx + hw);

    this._enemySerial++;
    const label = `BPK-${this._enemySerial}`;
    const e     = new Enemy(this, cx, left, right, label);
    e.patrolSpeed *= diff.speedMult * (1 + (this._wave - 1) * 0.09);
    this.enemies.push(e);
    this._prevEnemyState.set(e, STATE.PATROL);

    const distKm = Math.round(Math.abs(cx - subX) * 1.2 / 1000);
    this._shipLog(`Nowy kontakt: ${label} — szac. pozycja ${distKm}km od łodzi.`, 'warn');
  }

  _spawnWave() {
    const diff      = this._getDifficulty();
    const count     = Math.min(diff.enemies + this._wave - 1, 7);
    const segW      = WORLD_W / count;
    const speedMult = diff.speedMult * (1 + (this._wave - 1) * 0.12);

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

    this.add.text(CAM_W / 2, CAM_H / 2 + 52, '[ ENTER — zagraj ponownie ]', {
      fontSize: '10px', color: '#555555', fontFamily: 'Courier New',
    }).setOrigin(0.5).setDepth(201);

    this.input.keyboard.once('keydown-ENTER', () => {
      document.getElementById('game-ui').classList.remove('active');
      document.getElementById('side-panel').classList.remove('active');
      this.scene.restart();
    });
  }

  // ── Mapa taktyczna ────────────────────────────────────────────────────────

  _drawTacticalMap() {
    const g = this._mapGfx;
    g.clear();

    // Layout
    const PX = 24, PY = 136, PW = 976, PH = 368;
    const MX = 32, MY = 164, MW = 960, MH = 330;

    const SURF  = SURFACE_Y;
    const THERM = THERMO_Y;
    const FLOOR = OCEAN_FLOOR_Y;
    const CRUSH_Y_W = SURF + (400 / 600) * (FLOOR - SURF);  // ~413px

    const wx = (worldX) => MX + (worldX / WORLD_W) * MW;
    const wy = (worldY) => MY + (worldY / CAM_H) * MH;

    // ── Panel ──────────────────────────────────────────────────────────────
    g.fillStyle(0x000508, 0.97);
    g.fillRect(PX, PY, PW, PH);
    g.lineStyle(1.5, 0x1a7a3a, 0.90);
    g.strokeRect(PX, PY, PW, PH);

    // Pasek nagłówkowy
    g.fillStyle(0x001208, 0.75);
    g.fillRect(PX + 1, PY + 1, PW - 2, 26);
    g.lineStyle(0.5, 0x1a5a2a, 0.50);
    g.strokeLineShape(new Phaser.Geom.Line(PX, PY + 26, PX + PW, PY + 26));

    // ── Strefy głębokości ─────────────────────────────────────────────────
    // Niebo
    g.fillStyle(0x000000, 0.40);
    g.fillRect(MX, MY, MW, Math.max(0, wy(SURF) - MY));
    // Epipelagik (0–200m)
    g.fillStyle(0x001530, 0.55);
    g.fillRect(MX, wy(SURF), MW, wy(THERM) - wy(SURF));
    // Podświetlenie termokliny
    g.fillStyle(0x003d55, 0.28);
    g.fillRect(MX, wy(THERM) - 1, MW, 4);
    // Mezopelelagik (200–600m)
    g.fillStyle(0x000810, 0.65);
    g.fillRect(MX, wy(THERM), MW, wy(FLOOR) - wy(THERM));

    // ── Teren dna ─────────────────────────────────────────────────────────
    if (this.floorAt) {
      g.fillStyle(0x1a0e06, 0.92);
      g.beginPath();
      g.moveTo(MX, MY + MH);
      g.lineTo(MX, wy(this.floorAt(0)));
      for (let x = 160; x <= WORLD_W; x += 160) {
        g.lineTo(wx(x), wy(this.floorAt(x)));
      }
      g.lineTo(MX + MW, MY + MH);
      g.closePath();
      g.fillPath();
    }

    // ── Siatka ────────────────────────────────────────────────────────────
    g.lineStyle(0.5, 0x0a3018, 0.28);
    for (let x = 0; x <= WORLD_W; x += 2000) {
      g.strokeLineShape(new Phaser.Geom.Line(wx(x), MY, wx(x), MY + MH));
    }
    for (const m of [0, 100, 200, 300, 400, 500, 600]) {
      g.lineStyle(0.4, 0x0a2a14, 0.25);
      const gy = wy(SURF + (m / 600) * (FLOOR - SURF));
      g.strokeLineShape(new Phaser.Geom.Line(MX, gy, MX + MW, gy));
    }

    // ── Linie referencyjne ────────────────────────────────────────────────
    g.lineStyle(1.2, 0x00aacc, 0.50);
    g.strokeLineShape(new Phaser.Geom.Line(MX, wy(THERM), MX + MW, wy(THERM)));
    g.lineStyle(0.8, 0xff4400, 0.38);
    g.strokeLineShape(new Phaser.Geom.Line(MX, wy(CRUSH_Y_W), MX + MW, wy(CRUSH_Y_W)));

    // ── Trasa gracza ──────────────────────────────────────────────────────
    const trail = this._playerTrail;
    for (let i = 1; i < trail.length; i++) {
      const fade = (i / trail.length) * 0.70;
      g.lineStyle(1, 0x22cc55, fade);
      g.strokeLineShape(new Phaser.Geom.Line(
        wx(trail[i - 1].x), wy(trail[i - 1].y),
        wx(trail[i].x),     wy(trail[i].y),
      ));
    }
    for (let i = 0; i < trail.length; i += 6) {
      g.fillStyle(0x22cc55, (i / trail.length) * 0.50);
      g.fillCircle(wx(trail[i].x), wy(trail[i].y), 1.5);
    }

    // ── Linie namiarowe (brak triangulacji) ───────────────────────────────
    const spx = wx(this.sub.x), spy = wy(this.sub.y);
    const contacts = this.sonar?.contacts ?? [];
    for (const c of contacts) {
      if (this._triangulated?.get(c.enemy)?.age < 28) continue;
      const col = c.enemy.contactClass === 'WARSHIP' ? 0xff4444
                : c.enemy.contactClass === 'SURFACE' ? 0xffaa22 : 0x44bb77;
      const bLen = (2000 / WORLD_W) * MW;
      const bx   = Math.cos(c.bearing) * bLen;
      const by   = Math.sin(c.bearing) * bLen;
      g.lineStyle(0.7, col, 0.22);
      g.strokeLineShape(new Phaser.Geom.Line(spx, spy, spx + bx, spy + by));
      g.fillStyle(col, 0.38);
      g.fillCircle(spx + bx, spy + by, 2);
    }

    // ── Namierzone pozycje wrogów ─────────────────────────────────────────
    for (const c of contacts) {
      const tri = this._triangulated?.get(c.enemy);
      if (!tri || tri.age >= 28) continue;

      const ex   = wx(tri.x), ey = wy(SURF);
      const fade = 1 - tri.age / 28;
      const cls  = c.enemy.contactClass;
      const col  = cls === 'WARSHIP'
        ? (c.enemy.state === 2 ? 0xff2200 : 0xff8800)
        : cls === 'SURFACE' ? 0xffaa22 : 0x44bb77;

      // Krąg niepewności
      const errR = ((tri.accurate ? 80 : 220) / WORLD_W) * MW;
      g.lineStyle(0.8, col, fade * 0.28);
      g.strokeCircle(ex, ey, errR);

      // Ikona diamentu (okręt nawodny)
      const ds = 5;
      g.lineStyle(1.8, col, fade * 0.90);
      g.strokeLineShape(new Phaser.Geom.Line(ex,      ey - ds, ex + ds, ey));
      g.strokeLineShape(new Phaser.Geom.Line(ex + ds, ey,      ex,      ey + ds));
      g.strokeLineShape(new Phaser.Geom.Line(ex,      ey + ds, ex - ds, ey));
      g.strokeLineShape(new Phaser.Geom.Line(ex - ds, ey,      ex,      ey - ds));
      g.fillStyle(col, fade * 0.65);
      g.fillCircle(ex, ey, 2.5);

      // Pulsujący krąg ataku
      if (c.enemy.state === 2) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.009);
        g.lineStyle(1.5, 0xff2200, pulse * 0.80);
        g.strokeCircle(ex, ey, 9 + pulse * 4);
      }

      // Strzałka trendu
      const adx = spx - ex, ady = spy - ey;
      const alen = Math.sqrt(adx * adx + ady * ady) || 1;
      if (c.approach === 'ZBLIŻA') {
        const nx = (adx / alen) * 14, ny = (ady / alen) * 14;
        const pa = Math.atan2(ny, nx);
        g.lineStyle(1.5, 0xff4444, fade * 0.80);
        g.strokeLineShape(new Phaser.Geom.Line(ex, ey, ex + nx, ey + ny));
        g.strokeLineShape(new Phaser.Geom.Line(ex + nx, ey + ny, ex + nx - Math.cos(pa - 0.4) * 5, ey + ny - Math.sin(pa - 0.4) * 5));
        g.strokeLineShape(new Phaser.Geom.Line(ex + nx, ey + ny, ex + nx - Math.cos(pa + 0.4) * 5, ey + ny - Math.sin(pa + 0.4) * 5));
      } else if (c.approach === 'ODDALA') {
        const nx = -(adx / alen) * 14, ny = -(ady / alen) * 14;
        g.lineStyle(1.0, 0x4488ff, fade * 0.55);
        g.strokeLineShape(new Phaser.Geom.Line(ex, ey, ex + nx, ey + ny));
      }

      // Linia namiaru od gracza
      g.lineStyle(0.5, col, fade * 0.22);
      g.strokeLineShape(new Phaser.Geom.Line(spx, spy, ex, ey));
    }

    // ── Pierścienie zasięgu ───────────────────────────────────────────────
    g.lineStyle(0.8, 0x22aaff, 0.20);
    g.strokeCircle(spx, spy, (820  / WORLD_W) * MW);  // sonar
    g.lineStyle(0.8, 0xffaa00, 0.18);
    g.strokeCircle(spx, spy, (950  / WORLD_W) * MW);  // torpeda

    // Pionowa linia głębokości gracza
    g.lineStyle(0.7, 0x44ff88, 0.32);
    g.strokeLineShape(new Phaser.Geom.Line(spx, wy(SURF), spx, spy));

    // ── Ikona łodzi podwodnej ─────────────────────────────────────────────
    g.fillStyle(0xffffff, 0.95);
    g.fillTriangle(spx, spy - 7, spx - 4.5, spy + 3.5, spx + 4.5, spy + 3.5);
    g.lineStyle(1.5, 0x44ff88, 0.85);
    g.strokeTriangle(spx, spy - 7, spx - 4.5, spy + 3.5, spx + 4.5, spy + 3.5);

    // ── Skala ─────────────────────────────────────────────────────────────
    const KM     = 2;
    const scaleW = (KM * 1000 / 1.2 / WORLD_W) * MW;
    const sbx = MX + 14, sby = MY + MH - 12;
    g.lineStyle(1.2, 0x1a6a3a, 0.80);
    g.strokeLineShape(new Phaser.Geom.Line(sbx, sby, sbx + scaleW, sby));
    g.strokeLineShape(new Phaser.Geom.Line(sbx,         sby - 4, sbx,         sby + 4));
    g.strokeLineShape(new Phaser.Geom.Line(sbx + scaleW, sby - 4, sbx + scaleW, sby + 4));

    // ── Ramka mapy ────────────────────────────────────────────────────────
    g.lineStyle(1, 0x1a4a2a, 0.60);
    g.strokeRect(MX, MY, MW, MH);

    // ── Pozycjonowanie etykiet tekstowych ─────────────────────────────────
    const t = this._mapTxt;
    t.title.setPosition(PX + PW / 2, PY + 13);
    t.title.setText('MAPA TAKTYCZNA  ·  [M] ZAMKNIJ');

    t.m0.setPosition(MX + 3, wy(SURF) + 2);
    t.mT.setPosition(MX + 3, wy(THERM) + 2);
    t.mC.setPosition(MX + 3, wy(CRUSH_Y_W) + 2);
    t.mF.setPosition(MX + 3, wy(FLOOR) - 10);
    t.scale.setPosition(sbx + scaleW / 2, sby + 4);
    t.scale.setText(`${KM} km`);

    const alive = this.enemies.filter(e => !e.destroyed).length;
    const triN  = [...(this._triangulated?.values() ?? [])].filter(tri => tri.age < 28).length;
    t.info.setPosition(PX + PW - 6, PY + 4);
    t.info.setText(`AKTYWNE: ${alive}  NAMIERZONE: ${triN}  POZIOM: ${this._wave}`);

    // Etykiety km
    for (const k of this._mapKmTxt) {
      k.text.setPosition(wx(k.worldX), MY - 1);
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
