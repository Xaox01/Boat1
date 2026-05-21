import Phaser from 'phaser';
import { Ocean } from './Ocean.js';
import { Submarine } from './Submarine.js';
import { Enemy, STATE } from './Enemy.js';
import { Sonar } from './Sonar.js';
import { TestBot } from './TestBot.js';
import { Merchant } from './Merchant.js';
import { MissionSystem } from './MissionSystem.js';
import { SaveSystem } from './SaveSystem.js';
import { TutorialMission } from './TutorialMission.js';
import { DevConsole } from './DevConsole.js';
import { TorpedoLaunchFX } from './TorpedoLaunchFX.js';
import { ImpactFX } from './ImpactFX.js';
import { RadioComms } from './RadioComms.js';

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
const hudTorpedoes    = $('hud-torpedoes');
const hudTorpReload   = $('hud-torp-reload');
const hudMissiles     = $('hud-missiles');
const hudNoisemakers  = $('hud-noisemakers');
const hudPing         = $('hud-ping');
const hudWave         = $('hud-wave');
const hudClock        = $('hud-clock');
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

  preload() {
    this.load.image('warship', 'assets/warship.png');
  }

  create() {
    this.camX = 0;

    this.STATE = STATE;   // udostępnij dla bota i innych modułów

    // Pokaż UI gry, ukryj UI menu
    document.getElementById('game-ui').classList.add('active');
    document.getElementById('side-panel').classList.add('active');
    document.getElementById('left-panel').classList.add('active');

    this.ocean = new Ocean(this);
    this.sub   = new Submarine(this, CAM_W / 2, SURFACE_Y + 225); // ~270m — poniżej termokliny (test sonaru)
    this.sub.infiniteAmmo = (this._getCfg() || {}).infiniteAmmo ?? false;
    // Alias dla EnemyASROC — torpedy sprawdzają ten array
    Object.defineProperty(this, 'noisemakers', { get: () => this.sub.noisemakers });

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
      t:     this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.T),
      q:     this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
    };

    this._bot        = new TestBot(this);
    this._devConsole = new DevConsole(this);
    this._launchFX   = new TorpedoLaunchFX(this);
    this._impactFX   = new ImpactFX(this);
    this._radio      = new RadioComms(this);

    // SLBM — rakiety balistyczne z panelu F5
    this._slbmMissiles = [];
    this._slbmGfx = this.add.graphics().setDepth(19);

    // Bridge: panel HTML → gra
    window._slbmLaunch = () => this._spawnSLBMMissile();

    // API testowe dla Playwright / skryptów zewnętrznych
    window.__gameTest = {
      exec:    (cmd) => this._devConsole._exec(cmd),
      ready:   () => true,
      impactFX: (x, y) => this._impactFX.trigger(x, y),
      subPos:  () => ({ x: this.sub.x, y: this.sub.y }),
      camX:    () => this.camX,
    };

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
          this._launchFX.onFire(this.sub.x + 48, this.sub.y);
          this._logEvent('Torpeda odpalona!');
          const tb = this._brg(this.sub.x, this.sub.y, worldX, worldY);
          this._shipLog(`Odpalono: Mk.48 z rury nr ${tubeId}. Nam. ${tb}°, gł. ${this.sub.depthMetres}m. Rury gotowe: ${this.sub.torpedoCount}/4.`, 'info');
        } else {
          const salvo = this.sub._salvoCD || 0;
          if (salvo > 0) {
            this._logEvent(`Cooldown salwy! (${Math.ceil(salvo)}s)`);
          } else {
            const wait = Math.ceil(this.sub.torpedoFireCD);
            this._logEvent(`Wszystkie rury ładują się! (${wait}s)`);
          }
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
        else if (result === 'awaria')     { this._logEvent('SYS. RAKIETOWY — AWARIA!'); this._shipLog('Układ rakietowy zniszczony — start niemożliwy.', 'crit'); }
      }
    });

    this.aimGfx = this.add.graphics().setDepth(18);

    this._drawCRT();

    this.add.text(8, THERMO_Y + 4, '— TERMOKLINA (~200m) —', {
      fontSize: '10px', color: '#22ddbb',
    });

    const warnY  = SURFACE_Y + (300 / 600) * (OCEAN_FLOOR_Y - SURFACE_Y);
    const crushY = SURFACE_Y + (400 / 600) * (OCEAN_FLOOR_Y - SURFACE_Y);

    this.warnLine  = this.add.graphics();
    this.crushLine = this.add.graphics();

    this.warnLine.lineStyle(1.5, 0xff9900, 0.60);
    this.warnLine.strokeLineShape(new Phaser.Geom.Line(0, warnY, WORLD_W, warnY));
    this.crushLine.lineStyle(1.5, 0xff4400, 0.75);
    this.crushLine.strokeLineShape(new Phaser.Geom.Line(0, crushY, WORLD_W, crushY));

    this.add.text(8, warnY  + 2, '— LIMIT NURKOWANIA (300m) —',     { fontSize: '10px', color: '#ffaa00' });
    this.add.text(8, crushY + 2, '— GŁĘBOKOŚĆ KRYTYCZNA (400m) —',  { fontSize: '10px', color: '#ff5500' });

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
    this._dayTime         = 0.42;  // ~10:00 rano — jasny dzień od początku

    // Tryb piaskownicy — ciągłe generowanie wrogów
    this._enemySerial     = 0;    // globalny licznik spawniętych okrętów
    this._sandboxSpawnCD  = 0;    // cooldown do następnego spawnu
    this._waveTimer       = 0;    // czas do eskalacji zagrożenia

    this._missionTime = 0;   // sekundy od startu misji

    // Mapa taktyczna
    this._mapGfx  = this.add.graphics().setDepth(150);
    this._mapOpen = false;
    this._playerTrail = [];
    this._trailTimer  = 0;

    const ms = (color) => ({ fontSize: '8px', fontFamily: 'Courier New', color });
    this._mapTxt = {
      title: this.add.text(0, 0, '', { fontSize: '10px', fontFamily: 'Courier New', color: '#55ffaa', letterSpacing: 2 })
        .setDepth(151).setOrigin(0.5, 0.5).setVisible(false),
      info:  this.add.text(0, 0, '', ms('#44cc88')).setDepth(151).setOrigin(1, 0).setVisible(false),
      m0:    this.add.text(0, 0, '0m',              ms('#44cc88')).setDepth(151).setVisible(false),
      mT:    this.add.text(0, 0, 'TERMOKLINA',      ms('#44ddff')).setDepth(151).setVisible(false),
      mC:    this.add.text(0, 0, 'GL. KRYTYCZNA',   ms('#ff9900')).setDepth(151).setVisible(false),
      mF:    this.add.text(0, 0, 'DNO ~600m',        ms('#44aa77')).setDepth(151).setVisible(false),
      scale: this.add.text(0, 0, '2 km',            ms('#44cc88')).setDepth(151).setOrigin(0.5, 0).setVisible(false),
    };
    // Etykiety km na siatce (co ~2400m = 2000px)
    this._mapKmTxt = [];
    for (let x = 0; x <= WORLD_W; x += 2000) {
      const km = (x * 1.2 / 1000).toFixed(1).replace('.0', '');
      this._mapKmTxt.push({
        worldX: x,
        text: this.add.text(0, 0, `${km}km`, ms('#2a8855')).setDepth(151).setOrigin(0.5, 1).setVisible(false),
      });
    }

    // Aktywny sonar gracza [Q]
    this._pingGfx     = this.add.graphics().setDepth(16);
    this._activePings = [];   // { subX, subY, r, maxR, alpha, echoedEnemies, echoes }
    this._pingCD      = 0;

    // ── Merchants i misja — inicjowane przez tutorial lub wczytanie ──────
    this.merchants = [];
    this.mission   = null;
    this.tutorial  = null;

    // ── Zapis / wczytanie ──────────────────────────────────────────────────
    const fromSave = SaveSystem.consumeLoadRequest();
    // TYMCZASOWO: samouczek wyłączony do testów — przywrócić _startTutorial()
    if (fromSave) {
      const save = SaveSystem.load();
      if (save) {
        this._restoreFromSave(save);
      } else {
        this._spawnTestEnemies();
      }
    } else {
      this._spawnTestEnemies();
    }

    // Auto-zapis co 30s
    this.time.addEvent({
      delay: 30000,
      loop:  true,
      callback: () => {
        if (!this._gameOver) {
          SaveSystem.save(this);
          this._logEvent('AUTO-ZAPIS OK');
        }
      },
    });

    this._logEvent('Zanurz się — wrogie jednostki w pobliżu!');
    this._shipLog('ORP Orzeł — misja bojowa. Zanurzono na pozycję.', 'info');
  }

  _restoreFromSave(save) {
    // Podmiot
    const s = save.sub;
    this.sub.x              = s.x;
    this.sub.y              = s.y;
    this.sub.vx             = s.vx ?? 0;
    this.sub.vy             = s.vy ?? 0;
    this.sub.hull           = s.hull;
    this.sub.battery        = s.battery;
    this.sub.oxygen         = s.oxygen;
    this.sub.ballast        = s.ballast;
    this.sub.targetBallast  = s.targetBallast ?? s.ballast;
    this.sub.missileCount   = s.missileCount;
    this.sub.noisemakerCount = s.noisemakerCount;
    if (s.tubes) {
      s.tubes.forEach((t, i) => {
        if (this.sub.tubes[i]) Object.assign(this.sub.tubes[i], t);
      });
    }

    // Fala
    this._wave      = save.wave ?? 1;
    this._waveTimer = save.waveTimer ?? 0;

    // Konwój — odtwórz z zapisu
    const CONVOY_ALL = [
      { x: 2200,  dir:  1, label: 'LENSKY' },
      { x: 4000,  dir: -1, label: 'KALININ' },
      { x: 6200,  dir:  1, label: 'TBLISI' },
      { x: 8400,  dir: -1, label: 'NOVOROSSIYSK' },
      { x: 10600, dir:  1, label: 'IRKUTSK' },
      { x: 12800, dir: -1, label: 'VLADIVOSTOK' },
    ];
    const _merchantCount = (this._getCfg() || {}).merchants ?? 4;
    const CONVOY = CONVOY_ALL.slice(0, _merchantCount);
    for (const c of CONVOY) this.merchants.push(new Merchant(this, c.x, c.dir, c.label));

    const sms = save.merchants ?? [];
    for (let i = 0; i < this.merchants.length; i++) {
      const sm = sms[i];
      if (!sm) continue;
      const m = this.merchants[i];
      m.x         = sm.x;
      m.dir       = sm.dir;
      m.hull      = sm.hull;
      m.destroyed = sm.destroyed;
      if (sm.contactClass)  m.contactClass  = sm.contactClass;
      if (sm.classifyTimer) m.classifyTimer = sm.classifyTimer;
    }

    // Misja
    this.mission = new MissionSystem(this);
    this.mission.startMission1();
    if (save.mission) {
      this.mission.active.complete = save.mission.complete;
      this.mission.active.failed   = save.mission.failed;
      save.mission.objectives.forEach((so, i) => {
        if (this.mission.active.objectives[i]) {
          Object.assign(this.mission.active.objectives[i], so);
        }
      });
      this.mission._updateUI();
    }

    this._logEvent('Wczytano zapis — kontynuujesz patrol');
    this._shipLog('System: dane pokładowe przywrócone z ostatniego zapisu.', 'info');
  }

  update(_time, delta) {
    if (this._gameOver) return;

    const dt = delta / 1000;

    // Tutorial aktualizacja
    if (this.tutorial) this.tutorial.update(dt);

    // Opóźnione pojawienie się niszczycieli (tylko po tutorialu)
    if (!this._enemiesSpawned && !this.tutorial) {
      this._enemySpawnTimer += dt;
      const spawnDelay = (this._getCfg() || {}).enemyDelay ?? 15;
      if (this._enemySpawnTimer >= spawnDelay) this._spawnEnemies();
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

    // T = wyrzuć wabię akustyczną
    if (Phaser.Input.Keyboard.JustDown(this.keys.t)) {
      if (this.sub.deployNoisemaker()) {
        this._logEvent('Wabia akustyczna wyrzucona!');
        this._shipLog(`Wyrzucono wabię akustyczną. Pozostało: ${this.sub.noisemakerCount}.`, 'good');
      } else {
        this._logEvent('Brak wabii akustycznych!');
      }
    }

    // Q = aktywny ping sonaru
    if (Phaser.Input.Keyboard.JustDown(this.keys.q)) {
      if (this._pingCD <= 0) {
        this._firePing();
      } else {
        this._logEvent(`Ping — cooldown (${Math.ceil(this._pingCD)}s)`);
      }
    }
    this._pingCD = Math.max(0, this._pingCD - dt);

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
      else if (result === 'awaria')     { this._logEvent('SYS. RAKIETOWY — AWARIA!'); this._shipLog('Układ rakietowy zniszczony.', 'crit'); }
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
      this._shake(duration, intensity);
    }

    if (this.sub.onFloor) { this._groundedTimer += dt; }
    else                  { this._groundedTimer  = 0;  }

    // Update enemies + handle depth charge / ASROC effects
    for (const enemy of this.enemies) {
      enemy.update(dt, this.sub);
      if (enemy.recentPingHit) {
        this._logEvent('PING! Aktywny sonar — jesteśmy namierzeni!');
        const pb = this._brg(this.sub.x, this.sub.y, enemy.x, enemy.y);
        const pr = this._rng(this.sub.x, this.sub.y, enemy.x, enemy.y);
        this._shipLog(`PING aktywny z ${enemy.label || 'niszczyciela'}. Nam. ${pb}°, dyst. ${pr}m. Pozycja ujawniona.`, 'danger');
        // Sonarne uderzenie — krótki błysk niebieski + lekki wstrząs
        this._shake(90, 0.0045);
        this.cameras.main.flash(55, 0, 180, 255, false);
      }
      if (enemy.recentASROC) {
        this._logEvent('ASROC! Rakieta p/okrętowa odpalona!');
        const ab = this._brg(this.sub.x, this.sub.y, enemy.x, enemy.y);
        this._shipLog(`Wykryto odpalenie ASROC — ${enemy.label || 'niszczyciel'}. Nam. ${ab}°. Procedury unikania!`, 'danger');
      }

      for (const exp of enemy.recentExplosions) {
        const intensity = Phaser.Math.Clamp(1 - exp.dist / 85, 0, 1);
        if (intensity > 0.1) {
          this._shake(200 + intensity * 300, 0.004 + intensity * 0.018);
          if (intensity > 0.6) this.cameras.main.flash(120, 255, 200, 100, false);
          this._logEvent('ZARZUT GŁĘBINOWY!');
        }
      }

      // Torpedy samonaprowadzające z ASROC
      for (const ht of enemy.homingTorpedoes) {
        if (ht.recentHit) {
          this.sub.applyDamage(ht.recentHit.damage, 'TORPEDA ASROC');
          this._shake(550, 0.025);
          this.cameras.main.flash(180, 255, 140, 60, false);
          this._logEvent('TRAFIENIE — torpeda naprowadzana ASROC!');
          this._shipLog(`Trafienie torpedą samonaprowadzającą ASROC. Kadłub: ${Math.round(this.sub.hull * 100)}%.`, 'danger');
          this._radio.trigger('torpedo_hit');
        }
      }
    }

    // Koordynacja radiowa — atakujący niszczyciel alarmuje pobliskich (z flankowaniem)
    for (const hunter of this.enemies) {
      if (hunter.state !== STATE.HUNT) continue;
      for (const other of this.enemies) {
        if (other === hunter) continue;
        if (Math.abs(other.x - hunter.x) < 2200)
          other.receiveRadioAlert(hunter.lastKnownSubX, hunter.lastKnownSubY, hunter.x);
      }
    }

    // Posiłki — gdy niszczyciel ściga zbyt długo i nie likwiduje łodzi
    this._reinforceCooldown = (this._reinforceCooldown || 0) - dt;
    for (const hunter of this.enemies.filter(e => !e.destroyed)) {
      if (!hunter.needsReinforcement) continue;
      if (this._reinforceCooldown > 0) { hunter.needsReinforcement = false; continue; }
      const alive = this.enemies.filter(e => !e.destroyed).length;
      if (alive >= 6) { hunter.needsReinforcement = false; continue; }
      hunter.needsReinforcement  = false;
      this._reinforceCooldown    = 85;
      this._shipLog(`SYGNAŁ RADIOWY — ${hunter.label || 'BPK'} wzywa posiłki! Nowy kontakt w rejonie.`, 'danger');
      this._logEvent('Wróg wezwał posiłki radiowe!');
      this._spawnReinforcement(hunter);
      break;
    }

    // Tykanie i trafienia rakiet gracza
    const allMissileTargets = [
      ...this.enemies.filter(e => !e.destroyed),
      ...this.merchants.filter(m => !m.destroyed),
    ];
    for (const mis of this.sub.missiles) {
      mis.update(dt, allMissileTargets);
      if (mis.recentExplosion && !mis.recentHit) {
        this._impactFX.triggerMissile(mis.x, mis.y);
        this._shake(220, 0.010);
      }
      if (mis.recentHit) {
        const { enemy: target, damage } = mis.recentHit;
        const isMerchant = this.merchants.includes(target);
        target.hull -= damage;
        target.onHit();
        this._impactFX.triggerMissile(target.x, target.y);
        this.cameras.main.flash(220, 255, 180, 50, false);
        if (target.hull <= 0) {
          if (isMerchant) target.destroyed = true;
          else target.startSinking();
          const mb2 = this._brg(this.sub.x, this.sub.y, target.x, target.y);
          const mr2 = this._rng(this.sub.x, this.sub.y, target.x, target.y);
          if (isMerchant) {
            this._logEvent(`${target.label} zatopiony rakietą!`);
            this._shipLog(`Cel handlowy zatopiony rakietą — ${target.label}. Nam. ${mb2}°, dyst. ${mr2}m.`, 'good');
            this.mission?.onMerchantDestroyed(target);
          } else {
            this._logEvent(`${target.label || 'Niszczyciel'} zatopiony rakietą!`);
            this._shipLog(`Cel zatopiony rakietą — ${target.label || 'niszczyciel'}. Nam. ${mb2}°, dyst. ${mr2}m.`, 'good');
          }
        } else {
          const mb3 = this._brg(this.sub.x, this.sub.y, target.x, target.y);
          if (isMerchant) {
            this._logEvent(`Trafiono ${target.label} rakietą!`);
            this._shipLog(`Trafienie rakietą — ${target.label}. Kadłub: ${Math.round(target.hull * 100)}%. Nam. ${mb3}°.`, 'warn');
          } else {
            this._logEvent(`Rakieta trafiła — ${target.label || 'niszczyciel'} uszkodzony!`);
            const withdrawMsg = target.hull < 0.5 ? ' Cel wycofuje się.' : '';
            this._shipLog(`Trafienie rakietą — ${target.label || 'niszczyciel'}. Nam. ${mb3}°.${withdrawMsg}`, 'warn');
          }
        }
      }
    }

    // Player torpedo hits vs enemies
    for (const t of this.sub.torpedoes) {
      for (const target of this.enemies.filter(e => !e.destroyed && !e._sinking)) {
        const dmg = t.checkHit(target);
        if (dmg > 0) {
          target.hull -= dmg;
          target.onHit();
          this._impactFX.trigger(target.x, target.y);
          this._shake(300, 0.008);
          this.cameras.main.flash(120, 200, 255, 120, false);
          if (target.hull <= 0) {
            target.startSinking();
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

    // Remove destroyed enemies — wyczyść też zaznaczenie i triangulację
    for (const e of this.enemies.filter(e => e.destroyed)) {
      e.gfx.destroy();
      e.fireGfx?.destroy();
      e._sprite?.destroy();
      this._triangulated?.delete(e);
      if (this._selectedEnemy === e) {
        this._selectedEnemy = null;
        if (window._sonar) { window._sonar.selectedId = null; this._prevSonarSelId = null; }
      }
    }
    this.enemies = this.enemies.filter(e => !e.destroyed);

    // ── Konwój — aktualizacja i trafienia ────────────────────────────────────
    for (const m of this.merchants) {
      m.update(delta / 1000);
    }

    // Torpedy vs merchanty
    for (const t of this.sub.torpedoes) {
      for (const m of this.merchants.filter(m => !m.destroyed)) {
        const dmg = t.checkHit(m);
        if (dmg > 0) {
          m.hull -= dmg;
          m.onHit();
          this._impactFX.trigger(m.x, m.y);
          this._shake(200, 0.006);
          this.cameras.main.flash(100, 255, 200, 80, false);
          if (m.hull <= 0) {
            m.destroyed = true;
            this._logEvent(`${m.label} — zatopiony!`);
            const mb = this._brg(this.sub.x, this.sub.y, m.x, m.y);
            const mr = this._rng(this.sub.x, this.sub.y, m.x, m.y);
            this._shipLog(`Cel handlowy zatopiony torpedą — ${m.label}. Nam. ${mb}°, dyst. ${mr}m.`, 'good');
            this._radio.trigger('merchant_sunk');
            this.mission?.onMerchantDestroyed(m);
          } else {
            const mb = this._brg(this.sub.x, this.sub.y, m.x, m.y);
            this._logEvent(`Trafiono ${m.label}!`);
            this._shipLog(`Trafienie — ${m.label}. Kadłub: ${Math.round(m.hull * 100)}%. Nam. ${mb}°.`, 'warn');
          }
        }
      }
    }

    // Torpedy chybione — eksplozja przy uderzeniu w taflę lub dno
    for (const t of this.sub.torpedoes) {
      if (t.recentExplosion && !t.recentHit) {
        this._impactFX.trigger(t.x, t.y);
        this._shake(180, 0.005);
      }
    }

    // Usuń zatopione merchanty — wyczyść też zaznaczenie i triangulację
    for (const m of this.merchants.filter(m => m.destroyed)) {
      m.gfx.destroy();
      this._triangulated?.delete(m);
      if (this._selectedEnemy === m) {
        this._selectedEnemy = null;
        if (window._sonar) { window._sonar.selectedId = null; this._prevSonarSelId = null; }
      }
    }
    this.merchants = this.merchants.filter(m => !m.destroyed);

    // Aktualizacja misji
    this.mission?.update();

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
    this._dayTime = (this._dayTime + dt / 480) % 1;   // pełny cykl co 8 minut
    this.ocean.update(delta, this.camX, this._dayTime);
    this._devConsole.update(dt);
    this._launchFX.update(dt, this.camX);
    this._impactFX.update(dt, this.camX);
    this._radio.update(dt);
    this._updateSLBMMissiles(dt);
    this._updatePings(dt);
    this.sonar.update(delta, this.sub, [...this.enemies.filter(e => !e._sinking), ...this.merchants], this.sub.torpedoes, this._activePings);
    this._exportSonarState();
    this._drawBearingLines();
    this._drawPings();
    this._updateHUD();
    this._updateTargetPanel();
    this._checkEvents();
    this._drawAimReticle();
    this._drawNoisemakers();

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
    this.bearingGfx.x  = -this.camX;
    this._pingGfx.x    = -this.camX;
    this._slbmGfx.x    = -this.camX;
    for (const e of this.enemies) {
      e.gfx.x     = -this.camX;
      e.fireGfx.x = -this.camX;
      for (const a  of e.asrocs)           a.gfx.x  = -this.camX;
      for (const ht of e.homingTorpedoes)  ht.gfx.x = -this.camX;
    }
    for (const t of this.sub.torpedoes) t.gfx.x = -this.camX;
    for (const m of this.sub.missiles)  m.gfx.x = -this.camX;
    for (const m of this.merchants)     m.gfx.x = -this.camX;
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  // Pomocniki — zapis do DOM tylko gdy wartość się zmieniła
  _setText(el, v) { if (el.textContent !== v) el.textContent = v; }
  _setCls(el, v)  { if (el.className   !== v) el.className   = v; }
  _setW(el, pct)  { const s = `${pct}%`; if (el.style.width !== s) el.style.width = s; }
  _setCol(el, v)  { if (el.style.color !== v) el.style.color = v; }

  _exportSonarState() {
    if (!window._sonar) window._sonar = { contacts: [], heading: 0, listenMode: false, tick: 0 };
    const sub = this.sub;
    const SONAR_RANGE = 820;

    const toBD = (wx, wy) => {
      const dx = wx - sub.x, dy = wy - sub.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Minimalny pionowy składnik = głębokość termokliny, żeby namiary na cele
      // nawodne nie zbijały się do ~090° przy małej głębokości własnej.
      const REF = THERMO_Y - SURFACE_Y;                          // ~200 px
      const dyEff = Math.sign(dy || -1) * Math.max(Math.abs(dy), REF);
      const brg   = (Math.atan2(dx, -dyEff) * 180 / Math.PI + 360) % 360;
      return { bearing: brg, dist, distFrac: Math.min(1, dist / SONAR_RANGE) };
    };

    // Heading: oparty na poziomej prędkości (sub porusza się lewo/prawo)
    if (Math.abs(sub.vx) > 1) {
      window._sonar.heading = sub.vx > 0 ? 90 : 270;
    }
    window._sonar.listenMode    = sub.listenMode;
    window._sonar.silentRunning = sub.silentRunning;
    window._sonar.depth         = sub.depthMetres;
    window._sonar.dayTime       = this._dayTime;
    window._sonar.hull          = sub.hull;
    window._sonar.battery       = sub.battery;
    window._sonar.oxygen        = sub.oxygen;
    window._sonar.noise         = sub.noise;
    window._sonar.systems       = sub.systems;
    window._sonar.damageLog     = sub._damageLog;
    window._sonar.tick++;

    // Synchronizuj wybór z stacji SONAR/PERYSKOP do systemu celowania
    const selId = window._sonar.selectedId;
    if (selId && selId !== this._prevSonarSelId) {
      this._prevSonarSelId = selId;
      if (selId.startsWith('K-')) {
        const idx = parseInt(selId.replace('K-', '')) - 1;
        const ct  = this.sonar.contacts?.[idx];
        if (ct) this._selectedEnemy = ct.enemy;
      }
      // V-* obsługiwane poniżej, po zbudowaniu allUnits
    } else if (!selId && this._prevSonarSelId) {
      this._prevSonarSelId = null;
    }

    // Kontakty z silnika sonaru
    window._sonar.contacts = (this.sonar.contacts || []).map((c, i) => ({
      id: `K-${i + 1}`,
      ...toBD(c.enemy.x, c.enemy.y),
      sig:      c.sig,
      approach: c.approach,
      cls:      c.enemy.contactClass,
      threat:   c.enemy.state === STATE.HUNT,
    }));

    // Torpedy gracza
    window._sonar.torpedoes = (sub.torpedoes || [])
      .filter(t => !t.exploded)
      .map(t => ({ ...toBD(t.x, t.y), seekerLocked: t.seekerLocked }));

    // Stan rur torpedowych
    window._sonar.tubes = (sub.tubes || []).map(t => ({
      ready: (t.cd || 0) <= 0,
      cd: t.cd || 0,
    }));

    // Torpedy ASROC wrogów
    window._sonar.asroc = this.enemies.flatMap(e =>
      (e.homingTorpedoes || []).filter(ht => !ht.dead)
        .map(ht => ({ ...toBD(ht.x, ht.y), locked: ht.locked }))
    );

    // Wabie akustyczne
    window._sonar.noisemakers = (sub.noisemakers || [])
      .map(n => ({ ...toBD(n.x, n.y), age: n.age, lifetime: n.lifetime }));

    // Aktywne pingi
    window._sonar.pings = (this._activePings || []).map(p => ({
      rFrac:  Math.min(1, p.r / SONAR_RANGE),
      alpha:  p.alpha,
      echoes: (p.echoes || []).map(e => ({ ...toBD(e.x, e.y), age: e.age })),
    }));

    // Triangulowane pozycje
    window._sonar.triangulated = [];
    if (this._triangulated) {
      this._triangulated.forEach((tri, _enemy) => {
        if (tri.age >= 28) return;
        window._sonar.triangulated.push({
          ...toBD(tri.x, tri.y), age: tri.age, accurate: tri.accurate,
        });
      });
    }

    // ── Peryskop — kontakty wizualne + klasyfikacja ───────────────────────────
    const VISUAL_RANGE = 3500;
    const sonarIdMap   = new Map((this.sonar.contacts || []).map((c, i) => [c.enemy, `K-${i + 1}`]));
    const allUnits     = [...this.enemies.filter(e => !e.destroyed), ...this.merchants.filter(m => !m.destroyed)];

    window._sonar.visualContacts = allUnits
      .map((e, vIdx) => {
        const { bearing, dist } = toBD(e.x, e.y);
        if (dist > VISUAL_RANGE) return null;
        return {
          vIdx,
          id:       sonarIdMap.get(e) ?? `V-${vIdx + 1}`,
          bearing,
          dist,
          distFrac: Math.min(1, dist / VISUAL_RANGE),
          cls:      e.contactClass,
          shipType: e.shipType,
          dir:      e.dir ?? 1,
          spd:      Math.abs(e.patrolSpeed ?? 60),
          hull:     e.hull ?? 1,
          sinking:  e._sinking ?? false,
          onFire:   (e._fireParts?.length ?? 0) > 3,
        };
      })
      .filter(Boolean);

    // V-* selection sync — kontakty wizualne spoza zasięgu sonaru
    if (selId && selId.startsWith('V-') && selId === this._prevSonarSelId) {
      const vIdx = parseInt(selId.replace('V-', '')) - 1;
      if (allUnits[vIdx]) this._selectedEnemy = allUnits[vIdx];
    }

    // Klasyfikacja wizualna: kontakty w polu widzenia peryskopowego → natychmiastowa identyfikacja
    const pActive = window._sonar.periscopeActive;
    const pBrg    = window._sonar.periscopeBearing ?? 0;
    const pFov    = window._sonar.periscopeFov    ?? 40;
    if (pActive && sub.depthMetres < 12) {
      for (const e of allUnits) {
        const { bearing, dist } = toBD(e.x, e.y);
        if (dist > VISUAL_RANGE * 0.55) continue;
        const angDiff = Math.abs(((bearing - pBrg + 540) % 360) - 180);
        if (angDiff < pFov / 2 && (e.contactClass === 'UNK' || e.contactClass === 'SURFACE')) {
          e.contactClass  = e.shipType || 'WARSHIP';
          e.classifyTimer = 60;
        }
      }
      // Hałas peryskopowy — maszt powyżej wody niszczy ciszę akustyczną
      sub.noiseSurge = Math.max(sub.noiseSurge || 0, 0.08);
    }

    // Dziennik: peryskop podniesiony/opuszczony
    const pActiveNow = pActive === true;
    if (this._prevPActive !== undefined && pActiveNow !== this._prevPActive) {
      this._shipLog(pActiveNow ? 'PERYSKOP: PODNIESIONY' : 'PERYSKOP: OPUSZCZONY', 'info');
    }
    this._prevPActive = pActiveNow;
  }

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

    if (hudClock) {
      const totalH = this._dayTime * 24;
      const hh = Math.floor(totalH) % 24;
      const mm = Math.floor((totalH % 1) * 60);
      this._setText(hudClock, `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`);
    }

    const nm = this.sub.noisemakerCount;
    this._setText(hudNoisemakers, `${nm}`);
    this._setCol(hudNoisemakers, nm === 0 ? '#ff4a4a' : nm === 1 ? '#ffcc44' : '#88ddff');

    if (hudPing) {
      const pc = this._pingCD || 0;
      if (pc > 0) {
        this._setText(hudPing, `⟳ ${Math.ceil(pc)}s`);
        this._setCol(hudPing, pc > 8 ? '#ff6644' : '#ffaa44');
      } else {
        this._setText(hudPing, 'GOTOWY');
        this._setCol(hudPing, '#44ffdd');
      }
    }

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
    const allTargets = [
      ...this.enemies.filter(e => !e.destroyed),
      ...this.merchants.filter(m => !m.destroyed),
    ];

    // Znajdź najbliższy cel
    let nearest = null, nearestDist = Infinity;
    for (const e of allTargets) {
      const dx = e.x - sub.x, dy = e.y - sub.y;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < nearestDist) { nearestDist = d; nearest = e; }
    }
    const enemies = allTargets;

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
      const clsText = cls === 'WARSHIP'  ? 'OKRĘT WOJ.' :
                      cls === 'MERCHANT' ? 'JED. CYW.'  :
                      cls === 'SURFACE'  ? 'NAWODNY'    : 'UNK';
      this._setText(tpClassif, clsText);
      this._setCls(tpClassif,
        cls === 'WARSHIP'  ? 'tp-value danger'   :
        cls === 'MERCHANT' ? 'tp-value ready'    :
        cls === 'SURFACE'  ? 'tp-value warning'  : 'tp-value nodata');

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
    const salvoCD = sub._salvoCD || 0;
    if (salvoCD > 0) {
      // Inter-salvo cooldown — rura może być gotowa, ale nie możemy strzelać
      this._setText(tpTorpCD, `SALWA ⟳ ${Math.ceil(salvoCD)}s`);
      this._setCls(tpTorpCD, 'tp-value warning');
    } else if (sub.torpedoCount > 0) {
      this._setText(tpTorpCD, `GOTOWA (${sub.torpedoCount}/4)`);
      this._setCls(tpTorpCD, 'tp-value ready');
    } else {
      const secs    = Math.ceil(sub.torpedoFireCD);
      const m       = Math.floor(secs / 60);
      const s       = secs % 60;
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
    for (const enemy of this.enemies.filter(e => !e._sinking)) {
      const prev = this._prevEnemyState.get(enemy);
      const curr = enemy.state;
      if (prev !== curr) {
        const eb = this._brg(this.sub.x, this.sub.y, enemy.x, enemy.y);
        const er = this._rng(this.sub.x, this.sub.y, enemy.x, enemy.y);
        if (curr === STATE.ALERT)    { this._logEvent('Niszczyciel namierzył hałas — szuka...'); this._shipLog(`${enemy.label || 'Niszczyciel'} — ALERT. Wykryto sygnał akustyczny. Nam. ${eb}°, dyst. ${er}m.`, 'warn'); }
        if (curr === STATE.HUNT)     { this._logEvent('NISZCZYCIEL ATAKUJE — zarzuty + ASROC!'); this._shipLog(`${enemy.label || 'Niszczyciel'} — ATAKUJE. Okręt namierzony. Nam. ${eb}°. Procedury unikania!`, 'danger'); this._radio.trigger('first_contact'); }
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

    // Linie namiarowe od merchantów — ciepły bursztynowy kolor (odróżnia od niszczycieli)
    for (const m of this.merchants) {
      const dx   = m.x - sx;
      const dy   = m.y - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const sig  = Phaser.Math.Clamp(0.28 * 780 / Math.max(dist, 80), 0, 1);
      if (sig < 0.04) continue;
      const bearing = Math.atan2(dy, dx);
      const col = 0xddaa44;   // bursztynowy — rozróżnienie od niszczycieli
      g.lineStyle(0.6 + sig * 1.0, col, sig * 0.20);
      g.strokeLineShape(new Phaser.Geom.Line(sx, sy, sx + Math.cos(bearing) * 2200, sy + Math.sin(bearing) * 2200));
      const tickDist = 80;
      const tx = sx + Math.cos(bearing) * tickDist;
      const ty = sy + Math.sin(bearing) * tickDist;
      const perp = bearing + Math.PI / 2;
      const tLen = 4 + sig * 3;
      g.lineStyle(1.2, col, sig * 0.55);
      g.strokeLineShape(new Phaser.Geom.Line(
        tx + Math.cos(perp) * tLen, ty + Math.sin(perp) * tLen,
        tx - Math.cos(perp) * tLen, ty - Math.sin(perp) * tLen
      ));
    }

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
      const tri = this._triangulated?.get(enemy);
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

    // ── Wskaźnik FOV peryskopowego w widoku CONN ─────────────────────────────
    const periActive = window._sonar?.periscopeActive;
    const periBrg    = window._sonar?.periscopeBearing;
    const periFov    = window._sonar?.periscopeFov ?? 40;
    if (periActive && periBrg != null) {
      const pAng    = (periBrg - 90) * Math.PI / 180;
      const halfFov = (periFov / 2) * Math.PI / 180;
      const coneLen = 200;
      g.fillStyle(0x5fffb0, 0.07);
      g.beginPath();
      g.moveTo(sx, sy);
      g.arc(sx, sy, coneLen, pAng - halfFov, pAng + halfFov, false);
      g.closePath();
      g.fillPath();
      g.lineStyle(0.8, 0x5fffb0, 0.40);
      g.strokeLineShape(new Phaser.Geom.Line(
        sx, sy,
        sx + Math.cos(pAng - halfFov) * coneLen,
        sy + Math.sin(pAng - halfFov) * coneLen
      ));
      g.strokeLineShape(new Phaser.Geom.Line(
        sx, sy,
        sx + Math.cos(pAng + halfFov) * coneLen,
        sy + Math.sin(pAng + halfFov) * coneLen
      ));
      g.lineStyle(1.2, 0x5fffb0, 0.55);
      g.strokeCircle(
        sx + Math.cos(pAng) * 16,
        sy + Math.sin(pAng) * 16,
        4
      );
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

    // Znaczniki namierzania przy każdym widocznym celu (niszczyciel + merchant)
    for (const enemy of [...this.enemies, ...this.merchants].filter(e => !e.destroyed)) {
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

  // ── Aktywny sonar gracza ──────────────────────────────────────────────────

  _firePing() {
    const sub = this.sub;
    // Sonar aktywny zablokowany przy zniszczonym systemie
    if ((sub.systems?.sonarA?.health ?? 1) < 0.1) {
      this._logEvent('SONAR-A AWARIA — ping zablokowany!');
      this._shipLog('Sonar aktywny zniszczony. Ping niemożliwy.', 'crit');
      return;
    }
    const PING_MAX_R    = 1100;
    const PING_ALERT_R  = 1100;

    this._activePings.push({
      subX: sub.x, subY: sub.y,
      r: 0, maxR: PING_MAX_R, alpha: 0.88,
      echoedEnemies: new Set(),
      echoes: [],   // { x, y, age }
    });
    this._pingCD = 14;

    this._logEvent('PING — aktywny sonar!');
    this._shipLog(`Aktywny ping sonaru. Gł. ${sub.depthMetres}m. Uwaga: pozycja ujawniona wrogom.`, 'warn');

    // Wrogowie słyszą ping → alarmowani
    for (const enemy of this.enemies) {
      if (enemy.destroyed) continue;
      const dx   = enemy.x - sub.x;
      const dy   = enemy.y - sub.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < PING_ALERT_R) enemy.receivePing(sub.x, sub.y);
    }
    // Merchanty — ping ujawnia pozycję na PPI
    for (const m of this.merchants) {
      const dx   = m.x - sub.x;
      const dy   = m.y - sub.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < PING_ALERT_R) m.receivePing(sub.x, sub.y);
    }
  }

  _updatePings(dt) {
    const PING_SPEED = 680;  // px/s

    for (const p of this._activePings) {
      const prevR = p.r;
      p.r    += PING_SPEED * dt;
      p.alpha = Math.max(0, p.alpha - dt * 0.28);

      // Sprawdź echo od każdego niszczyciela i merchantów
      for (const target of [...this.enemies, ...this.merchants]) {
        if (target.destroyed || p.echoedEnemies.has(target)) continue;
        const dx   = target.x - p.subX;
        const dy   = target.y - p.subY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (prevR < dist && p.r >= dist && dist <= p.maxR) {
          p.echoedEnemies.add(target);
          p.echoes.push({ x: target.x, y: target.y, age: 0 });

          target.revealTimer = Math.max(target.revealTimer, 5.0);

          const eb = this._brg(this.sub.x, this.sub.y, target.x, target.y);
          const er = this._rng(this.sub.x, this.sub.y, target.x, target.y);
          this._logEvent(`ECHO nam. ${eb}°`);
          this._shipLog(`ECHO — ${target.label || 'kontakt'}: nam. ${eb}°, dyst. ${er}m. Namierzono precyzyjnie.`, 'warn');
        }
      }

      for (const e of p.echoes) e.age += dt;
      p.echoes = p.echoes.filter(e => e.age < 1.8);
    }

    // Usuń wygasłe pingi
    this._activePings = this._activePings.filter(p => p.alpha > 0 && p.r < p.maxR + 80);
  }

  _drawPings() {
    const g = this._pingGfx;
    g.clear();

    for (const p of this._activePings) {
      const pFrac = p.r / p.maxR;

      // Główny pierścień pingu — cieniejący i blaknący w miarę rozchodzenia
      const ringA = p.alpha * (1 - pFrac * 0.55);
      g.lineStyle(2.2 - pFrac * 1.4, 0x44ffdd, ringA);
      g.strokeCircle(p.subX, p.subY, p.r);

      // Wewnętrzny pierścień z opóźnieniem — głębszy odcień
      if (p.r > 55) {
        g.lineStyle(0.8, 0x22aacc, p.alpha * 0.28);
        g.strokeCircle(p.subX, p.subY, p.r - 40);
      }

      // Echo — błysk w miejscu wykrytego celu
      for (const e of p.echoes) {
        const ef = e.age / 1.8;
        const ea = 1 - ef;
        // Biały błysk
        g.fillStyle(0xffffff, ea * 0.85);
        g.fillCircle(e.x, e.y, 4 + ef * 10);
        // Rozszerzający się pierścień echa
        g.lineStyle(1.5, 0x44ffdd, ea * 0.70);
        g.strokeCircle(e.x, e.y, 14 + ef * 22);
        g.lineStyle(0.8, 0x88ffee, ea * 0.35);
        g.strokeCircle(e.x, e.y, 24 + ef * 36);
      }
    }
  }

  // ── Wabie akustyczne — rysowanie ──────────────────────────────────────────

  _drawNoisemakers() {
    if (!this._nmGfx) {
      this._nmGfx = this.add.graphics().setDepth(14);
    }
    const g = this._nmGfx;
    g.clear();

    const t   = Date.now() * 0.001;
    const cam = this.camX;

    for (const nm of this.sub.noisemakers) {
      const sx  = nm.x - cam;
      const sy  = nm.y;
      const frac = nm.age / nm.lifetime;
      const alpha = 1 - frac * 0.6;

      // Pierścień pulsujący — sygnał akustyczny
      const pulse = 0.5 + 0.5 * Math.sin(t * 6);
      g.lineStyle(1.5, 0x44aaff, alpha * 0.35 * pulse);
      g.strokeCircle(sx, sy, 28 + pulse * 12);

      // Bąbelki / ikona wabii
      g.fillStyle(0x88ddff, alpha * 0.80);
      g.fillCircle(sx, sy, 5);
      g.fillStyle(0x0055aa, alpha * 0.55);
      g.fillCircle(sx, sy, 3);

      // Mały tekst czas życia (pasek postępu pod wabią)
      const barW = 20;
      const filled = (1 - frac) * barW;
      g.fillStyle(0x003366, 0.50);
      g.fillRect(sx - barW / 2, sy + 8, barW, 3);
      g.fillStyle(0x44aaff, alpha * 0.80);
      g.fillRect(sx - barW / 2, sy + 8, filled, 3);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _addDepthLabels() {
    const pxPerM = (OCEAN_FLOOR_Y - SURFACE_Y) / 600;
    for (const m of [0, 50, 100, 150, 200, 300, 400, 500, 600]) {
      this.add.text(4, SURFACE_Y + m * pxPerM + 2, `${m}m`, {
        fontSize: '10px', color: '#44ccaa',
      });
    }
  }

  _getCfg() {
    return window._gameSettings || this.registry.get('settings') || {};
  }

  _getDifficulty() {
    const cfg = this._getCfg();
    return cfg.difficulty || this.registry.get('difficulty') || { enemies: 2, speedMult: 1.0 };
  }

  _shake(duration, intensity) {
    if (this._getCfg().cameraShake === false) return;
    this.cameras.main.shake(duration, intensity);
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

  // ── Tutorial ──────────────────────────────────────────────────────────────

  _spawnTestEnemies() {
    // Tryb testowy: wrogie jednostki daleko poza zasięgiem sonaru (>820px)
    // i hydrofonu wroga (<240px przy termoklinie). Gracz musi je NAJPIERW namierzyć.
    this._enemiesSpawned = true;
    const subX = CAM_W / 2;
    const offsets = [1800, 2800, 4000]; // dalej niż sonar range 820px
    for (const off of offsets) {
      this.enemies.push(new Enemy(this, subX + off + Phaser.Math.Between(-150, 150), 80));
    }
    // Konwój jeszcze dalej — cel do ewentualnego ataku
    this.merchants.push(new Merchant(this, subX + 5500, 1, 'KONWÓJ TESTOWY'));
  }

  _startTutorial() {
    // Cel treningowy — jeden statek, bliżej gracza, wolno dryfujący
    const trainingTarget = new Merchant(this, 900, 1, 'CEL TRENINGOWY');
    trainingTarget.speed = 1;   // prawie nieruchomy — zawsze widoczny na ekranie
    this.merchants.push(trainingTarget);

    this._enemiesSpawned = true;   // blokuj auto-spawn wrogów podczas tutorialu
    this._enemySpawnTimer = 0;

    this.tutorial = new TutorialMission(this);
    this.tutorial.start(trainingTarget);
  }

  _startMission1Combat() {
    // Usuń cel treningowy (zniszczony lub nie)
    for (const m of this.merchants) {
      if (m.gfx) m.gfx.destroy();
    }
    this.merchants = [];

    // Dodaj konwój
    const CONVOY_FULL = [
      { x: 2200,  dir:  1, label: 'LENSKY' },
      { x: 4000,  dir: -1, label: 'KALININ' },
      { x: 6200,  dir:  1, label: 'TBLISI' },
      { x: 8400,  dir: -1, label: 'NOVOROSSIYSK' },
      { x: 10600, dir:  1, label: 'IRKUTSK' },
      { x: 12800, dir: -1, label: 'VLADIVOSTOK' },
    ];
    const _mCnt = (this._getCfg() || {}).merchants ?? 4;
    for (const c of CONVOY_FULL.slice(0, _mCnt)) this.merchants.push(new Merchant(this, c.x, c.dir, c.label));

    // Start misji
    this.mission = new MissionSystem(this);
    this.mission.startMission1();

    // Zresetuj i spawniaj wrogów
    this.tutorial          = null;
    this._enemiesSpawned   = false;
    this._enemySpawnTimer  = 14;   // spawn przy następnej klatce

    this._logEvent('ROZKAZ: Konwój sowiecki wykryty — przystąp do ataku!');
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

  _spawnReinforcement(hunter) {
    const subX = this.sub.x;
    // Posiłki przybywają z PRZECIWNEJ strony niż łowca (efekt kleszczy)
    const preferSide = -Math.sign(hunter.x - subX) || 1;
    const minDist    = 1400;
    const maxDist    = 3200;
    let   cx         = subX + preferSide * (minDist + Math.random() * (maxDist - minDist));
    cx = Phaser.Math.Clamp(cx, 150, WORLD_W - 150);

    const hw    = 1100 + Math.random() * 1200;
    const left  = Math.max(80,           cx - hw);
    const right = Math.min(WORLD_W - 80, cx + hw);

    this._enemySerial++;
    const label = `BPK-${this._enemySerial}`;
    const e     = new Enemy(this, cx, left, right, label);
    e.patrolSpeed *= this._getDifficulty().speedMult;
    // Posiłki już wiedzą gdzie zgłoszono łódź — przechodzą od razu w ALERT
    e.receiveRadioAlert(hunter.lastKnownSubX, hunter.lastKnownSubY, hunter.x);
    this.enemies.push(e);
    this._prevEnemyState.set(e, STATE.ALERT);

    const distKm = Math.round(Math.abs(cx - subX) / 1000);
    this._shipLog(`${label} — posiłki na kursie, dystans ~${distKm}km. Zawrócić!`, 'danger');
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
      const col = c.enemy.contactClass === 'WARSHIP'  ? 0xff4444
                : c.enemy.contactClass === 'MERCHANT' ? 0x42b8d4
                : c.enemy.contactClass === 'SURFACE'  ? 0xffaa22 : 0x44bb77;
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
        : cls === 'MERCHANT' ? 0x42b8d4
        : cls === 'SURFACE'  ? 0xffaa22 : 0x44bb77;

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

    // ── Merchanty — bursztynowe romby — widoczne tylko w zasięgu sonaru ──
    const SONAR_RANGE_MAP = 820;
    for (const m of this.merchants) {
      const mdx = m.x - this.sub.x, mdy = m.y - this.sub.y;
      const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (mdist > SONAR_RANGE_MAP * 2) continue;
      const mAlpha = mdist <= SONAR_RANGE_MAP ? 0.85 : 0.30;
      const mx2 = wx(m.x), my2 = wy(SURF);
      const ms = 5;
      g.lineStyle(1.5, 0xddaa44, mAlpha);
      g.strokeLineShape(new Phaser.Geom.Line(mx2,      my2 - ms, mx2 + ms, my2));
      g.strokeLineShape(new Phaser.Geom.Line(mx2 + ms, my2,      mx2,      my2 + ms));
      g.strokeLineShape(new Phaser.Geom.Line(mx2,      my2 + ms, mx2 - ms, my2));
      g.strokeLineShape(new Phaser.Geom.Line(mx2 - ms, my2,      mx2,      my2 - ms));
      g.fillStyle(0xddaa44, mAlpha * 0.5);
      g.fillCircle(mx2, my2, 2);
    }

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

  // ── SLBM — rakiety balistyczne ────────────────────────────────────────────

  _spawnSLBMMissile() {
    this._slbmMissiles.push({
      x: this.sub.x,
      y: this.sub.y,
      vy: -120,   // powolne wyrzucenie sprężonym powietrzem
      vx: 0,
      phase: 'eject',
      t: 0,
      surfaced: false,
      bubbles: [],
      exhaust: [],
    });
    this._shake(280, 0.005);
  }

  _updateSLBMMissiles(dt) {
    const g   = this._slbmGfx;
    const SURF = this.SURFACE_Y;
    g.clear();

    for (let i = this._slbmMissiles.length - 1; i >= 0; i--) {
      const m = this._slbmMissiles[i];
      m.t += dt;

      if (m.phase === 'eject') {
        m.vy -= 200 * dt;
        m.y  += m.vy * dt;
        for (let j = 0; j < 5; j++) m.bubbles.push({
          x: m.x + (Math.random() - 0.5) * 14,
          y: m.y + Math.random() * 12,
          vy: -(30 + Math.random() * 60),
          r: 2 + Math.random() * 4,
          life: 0, maxLife: 1.5 + Math.random(),
        });
        if (m.vy < -320) m.phase = 'underwater';
      }
      else if (m.phase === 'underwater') {
        m.vy -= 380 * dt;
        m.y  += m.vy * dt;
        for (let j = 0; j < 10; j++) m.bubbles.push({
          x: m.x + (Math.random() - 0.5) * 18,
          y: m.y + 10 + Math.random() * 10,
          vy: -(20 + Math.random() * 70),
          r: 1.5 + Math.random() * 4,
          life: 0, maxLife: 1.2 + Math.random() * 1.2,
        });
        if (m.y <= SURF) {
          m.phase = 'breach';
          m.surfaced = true;
          m.y = SURF;
          this._impactFX.trigger(m.x, SURF);
          this._shake(500, 0.016);
          this.cameras.main.flash(160, 255, 245, 210, false);
        }
      }
      else if (m.phase === 'breach') {
        m.vy -= 500 * dt;
        m.y  += m.vy * dt;
        if (m.t > 0.4) m.phase = 'boost';
      }
      else if (m.phase === 'boost') {
        m.vy  -= 1100 * dt;
        m.vx  += (m.vx < 0 ? 1 : -1) * 6 * dt;  // lekkie pochylenie
        m.y   += m.vy * dt;
        m.x   += m.vx * dt;
        for (let j = 0; j < 6; j++) m.exhaust.push({
          x: m.x + (Math.random() - 0.5) * 8,
          y: m.y + 28 + Math.random() * 6,
          vy: 160 + Math.random() * 220,
          vx: (Math.random() - 0.5) * 30,
          r: 5 + Math.random() * 12,
          life: 0, maxLife: 0.2 + Math.random() * 0.45,
        });
      }

      // Bąble — ruch i sprzątanie
      for (let j = m.bubbles.length - 1; j >= 0; j--) {
        const b = m.bubbles[j];
        b.life += dt; b.y += b.vy * dt;
        if (b.life >= b.maxLife || b.y < SURF) { m.bubbles.splice(j, 1); continue; }
        const a = (1 - b.life / b.maxLife) * 0.75;
        g.fillStyle(0x88ccff, a * 0.38);
        g.fillCircle(b.x, b.y, b.r);
        g.fillStyle(0xddf0ff, a * 0.7);
        g.fillCircle(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3);
      }

      // Ogień silnika — efekt additive nie dostępny w Phaser Graphics,
      // rysujemy jako przejście kolorów białe→pomarańczowe→czerwone
      for (let j = m.exhaust.length - 1; j >= 0; j--) {
        const e = m.exhaust[j];
        e.life += dt; e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.life >= e.maxLife) { m.exhaust.splice(j, 1); continue; }
        const lt = e.life / e.maxLife;
        const a  = (1 - lt) * 0.85;
        const col = lt < 0.25 ? 0xfffce0 : lt < 0.55 ? 0xffaa30 : lt < 0.8 ? 0xff6010 : 0xcc2800;
        g.fillStyle(col, a);
        g.fillCircle(e.x, e.y, e.r * (1 + lt * 0.6));
      }

      // Ciało rakiety
      const sub = m.y > SURF;
      const bCol = sub ? 0x1c2b3a : 0xd4cca8;
      g.fillStyle(bCol, 1);
      g.fillTriangle(m.x, m.y - 26, m.x - 5, m.y - 14, m.x + 5, m.y - 14);
      g.fillRect(m.x - 5, m.y - 14, 10, 40);
      if (!sub) {
        g.fillStyle(0xcc1810, 1);
        g.fillRect(m.x - 5, m.y - 6, 10, 4);
      }
      g.fillStyle(sub ? 0x0d1820 : 0x9a9282, 1);
      g.fillTriangle(m.x - 5, m.y + 22, m.x - 12, m.y + 30, m.x - 5, m.y + 30);
      g.fillTriangle(m.x + 5, m.y + 22, m.x + 12, m.y + 30, m.x + 5, m.y + 30);

      if (m.y < SURF - 1200 || m.t > 14) this._slbmMissiles.splice(i, 1);
    }
  }

  _drawCRT() {
    const overlay = this.add.graphics().setDepth(100);
    for (let y = 0; y < CAM_H; y += 4) {
      overlay.fillStyle(0x000000, 0.04);
      overlay.fillRect(0, y, CAM_W, 2);
    }
    for (let i = 0; i < 18; i++) {
      overlay.lineStyle(i * 1.5, 0x000000, (i / 18) * 0.18);
      overlay.strokeRect(i, i, CAM_W - i * 2, CAM_H - i * 2);
    }
  }
}
