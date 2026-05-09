// Bot taktyczny — symuluje doświadczonego gracza i testuje mechaniki gry.
// Aktywacja: klawisz B podczas gry.
//
// Stany: DIVE → PATROL → LISTEN → STALK → FIRE_TORP → FIRE_MISSILE
//         → EVADE → DEPLOY_DECOY → SURFACE_O2 → RECHARGE

import Phaser from 'phaser';

const THERMO_Y      = 280;
const SURFACE_Y     = 80;
const OCEAN_FLOOR_Y = 580;

// Głębokości taktyczne (px)
const DEEP_Y        = 360;   // patrol poniżej termokliny
const SHALLOW_Y     = 140;   // do rakiety / snorkla
const SNORKEL_Y     = SURFACE_Y + 22;

// Zasięgi broni (px)
const TORP_RANGE    = 900;
const MISSILE_RANGE = 1600;

// Progi decyzji
const LOW_O2        = 0.14;
const CRIT_BATTERY  = 0.08;
const LOW_BATTERY   = 0.22;
const LOW_HULL      = 0.35;

// ── Maszyna stanów ────────────────────────────────────────────────────────────

const STATES = {
  DIVE:           'DIVE',           // zanurzanie na głębokość patrolu
  PATROL:         'PATROL',         // cichy patrol poniżej termokliny
  LISTEN:         'LISTEN',         // nasłuch — stop silnika, szukaj kontaktów
  STALK:          'STALK',          // skradanie się do celu
  FIRE_TORP:      'FIRE_TORP',      // odpalanie torpedy + nurkowanie po strzale
  FIRE_MISSILE:   'FIRE_MISSILE',   // wynurzanie + odpalanie rakiety
  EVADE:          'EVADE',          // manewr unikania
  DEPLOY_DECOY:   'DEPLOY_DECOY',   // wyrzucenie wabii + ucieczka
  SURFACE_O2:     'SURFACE_O2',     // awaryjne wynurzenie po tlen
  RECHARGE:       'RECHARGE',       // snorchel — ładowanie baterii
};

export class TestBot {
  constructor(scene) {
    this.scene  = scene;
    this.active = false;

    this._el     = document.getElementById('bot-log');
    this._status = document.getElementById('bot-status');
    this._panel  = document.getElementById('bot-panel');

    this._state      = STATES.DIVE;
    this._dir        = 1;
    this._stateTimer = 0;

    // Cooldowny decyzji
    this._attackCD    = 0;
    this._decoyCD     = 0;
    this._missileCD   = 0;
    this._listenTimer = 0;   // kiedy następny LISTEN
    this._logCD       = 0;
    this._torpTestCD  = 0;   // czas od ostatniej torpedy

    // Statystyki sesji testowej
    this._stats = {
      torpsfired:   0,
      hits:         0,
      missesFired:  0,
      decoys:       0,
      evades:       0,
      snorkels:     0,
      listenEvents: 0,
    };

    // Poprzedni hull dla detekcji trafień
    this._prevHull = 1;

    // Cel ataku
    this._target = null;
    this._solution = null;   // punkt ołowiu (lead)
  }

  get sub() { return this.scene.sub; }

  start() {
    this.active        = true;
    this.sub.botControl = true;
    this._state        = STATES.DIVE;
    this._stateTimer   = 0;
    this._dir          = 1;
    this._prevHull     = this.sub.hull;
    Object.keys(this._stats).forEach(k => this._stats[k] = 0);

    if (this._el)     this._el.innerHTML = '';
    if (this._panel)  this._panel.classList.add('visible');
    if (this._status) this._status.textContent = 'aktywny';

    this._log('═══ BOT TAKTYCZNY START ═══', 'phase');
    this._log('Tryb: pełna symulacja gracza', 'info');
  }

  stop() {
    this.active          = false;
    this.sub.botControl  = false;
    this.sub.enginePower = 0;
    if (this._status) this._status.textContent = 'zatrzymany';
    this._printStats();
    this._log('═══ BOT ZATRZYMANY ═══', 'phase');
  }

  update(dt) {
    if (!this.active) return;

    this._stateTimer += dt;
    this._attackCD    = Math.max(0, this._attackCD   - dt);
    this._decoyCD     = Math.max(0, this._decoyCD    - dt);
    this._missileCD   = Math.max(0, this._missileCD  - dt);
    this._logCD       = Math.max(0, this._logCD      - dt);
    this._torpTestCD  = Math.max(0, this._torpTestCD - dt);
    this._listenTimer = Math.max(0, this._listenTimer - dt);

    this._detectHullHit();
    this._checkIncomingTorpedo();
    this._priorityCheck();
    this._runState(dt);
    this._observePassive();
    this._updateStatusBar();
  }

  // ── Priorytety globalne (nadpisują stan) ──────────────────────────────────

  _priorityCheck() {
    const sub     = this.sub;
    const hunting = this._anyHunting();

    // 1. Krytyczny tlen
    if (sub.oxygen < LOW_O2 && this._state !== STATES.SURFACE_O2) {
      this._setState(STATES.SURFACE_O2);
      this._log(`O₂ krytyczne (${pct(sub.oxygen)}) — AWARYJNE WYNURZENIE`, 'fail');
      return;
    }

    // 2. Krytyczna bateria (nie podczas wynurzenia)
    if (sub.battery < CRIT_BATTERY
        && this._state !== STATES.RECHARGE
        && this._state !== STATES.SURFACE_O2) {
      this._setState(STATES.RECHARGE);
      this._log(`Bateria krytyczna (${pct(sub.battery)}) — snorchel`, 'fail');
      this._stats.snorkels++;
      return;
    }
  }

  // ── Detekcja torpedy wroga ────────────────────────────────────────────────

  _checkIncomingTorpedo() {
    const sub    = this.sub;
    if (this._decoyCD > 0) return;

    // Szukaj HomingTorpedo z EnemyASROC
    const torpedoes = [];
    for (const e of (this.scene.enemies || [])) {
      for (const ht of (e.homingTorpedoes || [])) {
        if (!ht.dead && !ht.exploded) torpedoes.push(ht);
      }
    }

    const nearest = torpedoes
      .map(t => ({ t, d: Math.hypot(t.x - sub.x, t.y - sub.y) }))
      .filter(o => o.d < 420)
      .sort((a, b) => a.d - b.d)[0];

    if (nearest && this._state !== STATES.DEPLOY_DECOY && this._state !== STATES.EVADE) {
      this._decoyCD = 18;
      this._setState(STATES.DEPLOY_DECOY);
      this._log(`Torpeda wroga! Dystans: ${nearest.d.toFixed(0)}px — wyrzucam wabię`, 'fail');
    }
  }

  // ── Detekcja własnego trafienia ───────────────────────────────────────────

  _detectHullHit() {
    const h = this.sub.hull;
    if (h < this._prevHull - 0.03) {
      const dmg = ((this._prevHull - h) * 100).toFixed(0);
      this._log(`TRAFIENIE! Obrażenia: ${dmg}%  Kadłub: ${pct(h)}`, 'fail');
    }
    this._prevHull = h;
  }

  // ── Główny runner stanów ──────────────────────────────────────────────────

  _runState(dt) {
    switch (this._state) {
      case STATES.DIVE:          this._doDive(dt);        break;
      case STATES.PATROL:        this._doPatrol(dt);      break;
      case STATES.LISTEN:        this._doListen(dt);      break;
      case STATES.STALK:         this._doStalk(dt);       break;
      case STATES.FIRE_TORP:     this._doFireTorp(dt);    break;
      case STATES.FIRE_MISSILE:  this._doFireMissile(dt); break;
      case STATES.EVADE:         this._doEvade(dt);       break;
      case STATES.DEPLOY_DECOY:  this._doDeployDecoy(dt); break;
      case STATES.SURFACE_O2:    this._doSurfaceO2(dt);   break;
      case STATES.RECHARGE:      this._doRecharge(dt);    break;
    }
  }

  // ─── DIVE ────────────────────────────────────────────────────────────────

  _doDive(dt) {
    const sub = this.sub;
    sub.targetBallast = 0.80;
    sub.enginePower   = this._eng(0.30 * this._dir);

    if (sub.y >= DEEP_Y || this._stateTimer > 15) {
      this._setState(STATES.PATROL);
      this._log(`Poniżej termokliny (${sub.depthMetres}m) — start patrolu`, 'ok');
    }
  }

  // ─── PATROL ──────────────────────────────────────────────────────────────

  _doPatrol(dt) {
    const sub = this.sub;

    // Utrzymaj głębokość patrolu
    this._holdDepth(DEEP_Y, dt);
    sub.enginePower = this._eng(0.30 * this._dir);

    // Granica świata
    const margin = 350;
    if (sub.x < margin)                     this._dir =  1;
    if (sub.x > this.scene.WORLD_W - margin) this._dir = -1;

    // Co 20s wejdź w nasłuch
    if (this._stateTimer > 20 && this._listenTimer <= 0) {
      this._setState(STATES.LISTEN);
      return;
    }

    // Mała bateria → niższy silnik
    if (sub.battery < LOW_BATTERY) {
      sub.enginePower = this._eng(0.12 * this._dir);
    }

    // Sprawdź czy warto zaatakować
    this._considerAttack();
  }

  // ─── LISTEN ──────────────────────────────────────────────────────────────

  _doListen(dt) {
    const sub = this.sub;
    // Zatrzymaj silnik — tryb nasłuchu
    sub.enginePower   = this._eng(0);
    sub.targetBallast = 0.72;   // neutralna pływalność

    if (this._stateTimer < 0.1) {
      this._stats.listenEvents++;
      this._log(`NASŁUCH — zatrzymanie silnika (${sub.depthMetres}m)`, 'phase');
    }

    // Ping aktywny po 3s ciszy — gdy wróg nieznany i brak zagrożenia
    if (this._stateTimer > 3 && this._stateTimer < 3.15 && !this._anyHunting()) {
      const scene = this.scene;
      if (scene._pingCD <= 0) {
        scene._firePing();
        this._log('PING aktywny — skanowanie zasięgu', 'phase');
      }
    }

    // Loguj jeśli wykryte kontakty
    const alerted = (this.scene.enemies || []).filter(e => e.detectTimer > 0.2);
    if (alerted.length && this._logCD <= 0) {
      const e = alerted[0];
      const bearing = this._bearingTo(e);
      this._log(`Kontakt: bearing ${bearing}° / ${dist2m(e.x - sub.x)}`, 'info');
      this._logCD = 6;
    }

    // 8s nasłuchu, potem powrót
    if (this._stateTimer > 8) {
      this._listenTimer = 18;
      this._setState(STATES.PATROL);
      this._log('Koniec nasłuchu — wznawiamy patrol', 'ok');
    }

    // Jeśli wykryto wroga blisko → stalk
    this._considerAttack();
  }

  // ─── STALK ───────────────────────────────────────────────────────────────

  _doStalk(dt) {
    const sub    = this.sub;
    const target = this._target;

    if (!target || target.destroyed) {
      this._setState(STATES.PATROL);
      this._log('Cel stracony — wracam do patrolu', 'info');
      return;
    }

    // Skradaj się poniżej termokliny — mała prędkość
    this._holdDepth(DEEP_Y, dt);
    const dx = target.x - sub.x;
    this._dir = Math.sign(dx) || this._dir;
    sub.enginePower = this._eng(0.20 * this._dir);

    // Oblicz punkt ołowiu (lead)
    const travelTime = Math.abs(dx) / 170;   // torpeda ~170px/s
    this._solution = { x: target.x + target.dir * target.patrolSpeed * travelTime * 0.6 };

    // Gdy jesteśmy w zasięgu i mamy rozwiązanie
    const solveDx = this._solution.x - sub.x;
    if (Math.abs(dx) < TORP_RANGE && this._attackCD <= 0 && sub.torpedoCount > 0) {
      this._setState(STATES.FIRE_TORP);
      return;
    }

    // Fallback — rakieta jeśli blisko
    if (Math.abs(dx) < MISSILE_RANGE && sub.missileCount > 0
        && sub.depthMetres > 70 && this._missileCD <= 0) {
      this._setState(STATES.FIRE_MISSILE);
      return;
    }

    if (this._stateTimer > 35) {
      this._setState(STATES.PATROL);
      this._log('Stalk timeout — wróg niedostępny', 'info');
    }
  }

  // ─── FIRE_TORP ───────────────────────────────────────────────────────────

  _doFireTorp(dt) {
    const sub    = this.sub;
    const target = this._target;

    if (!target || target.destroyed) {
      this._setState(STATES.PATROL);
      return;
    }

    if (this._stateTimer < 0.4) {
      // Stabilizuj platformę przed strzałem
      sub.enginePower = this._eng(0.10 * this._dir);
      return;
    }

    // Czekaj na inter-salvo cooldown
    if (sub._salvoCD > 0) {
      if (this._logCD <= 0) {
        this._log(`Salvo cooldown (${sub._salvoCD.toFixed(1)}s) — czekam`, 'info');
        this._logCD = 2;
      }
      return;
    }

    // Brak gotowych rur — czekaj lub rezygnuj
    if (sub.torpedoCount === 0) {
      if (this._stateTimer > 12) {
        this._log(`Brak gotowych rur — powrót do patrolu`, 'fail');
        this._setState(STATES.PATROL);
      }
      return;
    }

    // Wystrzał z punktem ołowiu
    const leadX = this._solution ? this._solution.x : target.x;
    const leadY = SURFACE_Y + 5;
    const result = sub.fireTorpedo(leadX, leadY);

    if (result) {
      this._stats.torpsfired++;
      const range = Math.abs(target.x - sub.x);
      this._log(`Torpeda #${result} → lead ${leadX.toFixed(0)}px (dyst: ${range.toFixed(0)}px)`, 'ok');
      this._attackCD = 8;
      this._torpTestCD = 4;
      this._target = null;
      sub.targetBallast = 0.88;
      this._setState(STATES.EVADE);
      this._log('Po strzale — nurkowanie defensywne', 'phase');
    } else if (this._stateTimer > 3) {
      this._log('Strzał niemożliwy — powrót do patrolu', 'fail');
      this._setState(STATES.PATROL);
    }
  }

  // ─── FIRE_MISSILE ────────────────────────────────────────────────────────

  _doFireMissile(dt) {
    const sub    = this.sub;
    const target = this._target;

    if (!target || target.destroyed) {
      this._setState(STATES.PATROL);
      return;
    }

    // Wynurz do głębokości rakietowej
    this._holdDepth(SHALLOW_Y, dt);
    sub.enginePower = this._eng(0.15 * this._dir);

    if (sub.depthMetres <= 70) {
      const result = sub.fireMissile(target.x);
      if (result === 'ok') {
        this._stats.missesFired++;
        this._log(`Rakieta → ${target.label || 'cel'} (${Math.abs(target.x - sub.x).toFixed(0)}px)`, 'ok');
        this._missileCD = 5;
        this._attackCD  = 4;
        this._target    = null;
        sub.targetBallast = 0.82;
        this._setState(STATES.DIVE);
        return;
      }
      if (result === 'brak') {
        this._log('Brak rakiet — powrót do patrolu', 'info');
        this._setState(STATES.PATROL);
        return;
      }
    }

    if (this._stateTimer > 20) {
      this._log('Rakieta timeout — zanurzenie', 'info');
      this._setState(STATES.DIVE);
    }
  }

  // ─── EVADE ───────────────────────────────────────────────────────────────

  _doEvade(dt) {
    const sub = this.sub;
    this._stats.evades = Math.max(this._stats.evades, 1);   // tylko raz na sesję do statystyk

    if (this._stateTimer < 0.1) {
      this._stats.evades++;
      // Wybierz kierunek ucieczki od ostatniej pozycji wroga
      const e = this._nearestEnemy();
      if (e) this._dir = -Math.sign(e.x - sub.x) || this._dir;
    }

    if (this._stateTimer < 3) {
      // Nagły sprint i zmiana głębokości
      sub.enginePower   = this._eng(0.80 * this._dir);
      sub.targetBallast = sub.y < THERMO_Y ? 0.90 : 0.30;
    } else {
      // Schowaj się poniżej termokliny — cichy bieg
      sub.enginePower   = this._eng(0.18 * this._dir);
      sub.targetBallast = 0.78;
    }

    const hunting = this._anyHunting();
    if (!hunting && this._stateTimer > 6) {
      this._setState(STATES.PATROL);
      this._log('Zagrożenie minęło — wznowienie patrolu', 'ok');
    }
    if (this._stateTimer > 28) this._setState(STATES.PATROL);
  }

  // ─── DEPLOY_DECOY ────────────────────────────────────────────────────────

  _doDeployDecoy(dt) {
    const sub = this.sub;

    if (this._stateTimer < 0.3) {
      const ok = sub.deployNoisemaker();
      if (ok) {
        this._stats.decoys++;
        this._log(`Wabia akustyczna wyrzucona (zostało: ${sub.noisemakerCount})`, 'ok');
      } else {
        this._log('Brak wabii! Manewr bez wabii', 'fail');
      }
    }

    // Po wyrzuceniu wabii — sprint prostopadle do toru torpedy
    if (this._stateTimer < 0.5) {
      this._dir = -this._dir;
    }
    sub.enginePower   = this._eng(0.75 * this._dir);
    sub.targetBallast = 0.80;

    if (this._stateTimer > 5) {
      this._setState(STATES.EVADE);
    }
  }

  // ─── SURFACE_O2 ──────────────────────────────────────────────────────────

  _doSurfaceO2(dt) {
    const sub = this.sub;
    sub.targetBallast = 0.05;
    sub.enginePower   = this._eng(0.22 * this._dir);

    if (sub.oxygen > 0.88 && sub.depthMetres < 15) {
      this._log(`O₂ przywrócony (${pct(sub.oxygen)}) — zanurzenie`, 'ok');
      this._setState(STATES.DIVE);
    }
    if (this._stateTimer > 30) this._setState(STATES.DIVE);
  }

  // ─── RECHARGE ────────────────────────────────────────────────────────────

  _doRecharge(dt) {
    const sub = this.sub;
    // Wynurz do głębokości snorkla
    this._holdDepth(SNORKEL_Y, dt);
    sub.enginePower = this._eng(0.12 * this._dir);

    if (sub.battery > 0.72) {
      this._log(`Bateria naładowana (${pct(sub.battery)}) — zanurzenie`, 'ok');
      this._setState(STATES.DIVE);
    }
    if (this._stateTimer > 45) this._setState(STATES.DIVE);
  }

  // ── Logika ataku ──────────────────────────────────────────────────────────

  _considerAttack() {
    if (this._attackCD > 0) return;
    const sub = this.sub;
    const e   = this._nearestEnemy();
    if (!e) return;

    const dx = e.x - sub.x;
    const d  = Math.abs(dx);

    if (d < TORP_RANGE && sub.torpedoCount > 0 && sub._salvoCD <= 0) {
      this._target = e;
      this._setState(STATES.STALK);
      this._log(`Cel namierzony: ${e.label || 'niszczyciel'} — dystans ${d.toFixed(0)}px`, 'phase');
      return;
    }

    if (d < MISSILE_RANGE && sub.missileCount > 0 && this._missileCD <= 0) {
      this._target = e;
      this._setState(STATES.FIRE_MISSILE);
      return;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _holdDepth(targetY, dt) {
    const sub  = this.sub;
    const diff = sub.y - targetY;
    if (diff < -20) sub.targetBallast = Math.min(1, sub.targetBallast + 0.25 * dt);
    if (diff >  20) sub.targetBallast = Math.max(0, sub.targetBallast - 0.25 * dt);
  }

  _eng(v) {
    const bat = this.sub.battery;
    if (bat <= 0) return 0;
    return Phaser.Math.Clamp(v, -1, 1);
  }

  _nearestEnemy() {
    const sub     = this.sub;
    const enemies = (this.scene.enemies || []).filter(e => !e.destroyed);
    if (!enemies.length) return null;
    return enemies.reduce((best, e) =>
      Math.abs(e.x - sub.x) < Math.abs(best.x - sub.x) ? e : best
    );
  }

  _anyHunting() {
    const { STATE } = this.scene;
    const STATE_HUNT = STATE ? STATE.HUNT : 2;
    return (this.scene.enemies || []).some(e => e.state === STATE_HUNT);
  }

  _bearingTo(e) {
    const dx = e.x - this.sub.x;
    const b  = Math.round(((Math.atan2(0, dx) * 180 / Math.PI) + 360) % 360);
    return dx >= 0 ? 90 : 270;
  }

  _setState(s) {
    if (this._state === s) return;
    this._state      = s;
    this._stateTimer = 0;
  }

  // ── Pasywne obserwacje (testy mechanik) ───────────────────────────────────

  _observePassive() {
    if (this._logCD > 0) return;
    const sub = this.sub;

    // Test termokliny
    if (sub.belowThermocline && sub.noise > 0.05) {
      const mask = ((1 - sub.noiseEffective / sub.noise) * 100).toFixed(0);
      this._log(`Termoklina: maskowanie ${mask}%  (${pct(sub.noise)} → ${pct(sub.noiseEffective)})`, 'info');
      this._logCD = 15;
      return;
    }

    // Kawitacja
    if (sub.cavitating) {
      const spd = Math.hypot(sub.vx, sub.vy).toFixed(0);
      this._log(`Kawitacja! v=${spd}px/s  hałas=${pct(sub.noise)}`, 'fail');
      this._logCD = 7;
      return;
    }

    // Tryb nasłuchu aktywny
    if (sub.listenMode && this._logCD <= 0) {
      this._log(`Nasłuch aktywny — bonus x${sub.sonarBonus.toFixed(1)}`, 'info');
      this._logCD = 12;
      return;
    }

    // Niski tlen
    if (sub.oxygen < 0.30) {
      this._log(`O₂: ${pct(sub.oxygen)} — monitoruj!`, sub.oxygen < 0.20 ? 'fail' : 'info');
      this._logCD = 6;
      return;
    }

    // Kadłub uszkodzony
    if (sub.hull < LOW_HULL) {
      this._log(`Kadłub: ${pct(sub.hull)} — uszkodzenia krytyczne`, sub.hull < 0.20 ? 'fail' : 'info');
      this._logCD = 5;
      return;
    }

    // Aktywne wabie
    if (sub.noisemakers.length > 0) {
      const nm = sub.noisemakers[0];
      const rem = (nm.lifetime - nm.age).toFixed(0);
      this._log(`Wabia aktywna — pozostało ${rem}s`, 'info');
      this._logCD = 8;
      return;
    }

    // Wykrycie przez wroga
    const alerted = (this.scene.enemies || []).filter(e => e.detectTimer > 0);
    if (alerted.length) {
      this._log(`Wykrycie: ${alerted.length} okręt(y) namierzają`, 'fail');
      this._logCD = 4;
      return;
    }

    this._logCD = 5;
  }

  // ── Raport końcowy ────────────────────────────────────────────────────────

  _printStats() {
    const s = this._stats;
    this._log('── Raport sesji ──────────────', 'phase');
    this._log(`Torpedy: ${s.torpsfired}  Rakiety: ${s.missesFired}`, 'info');
    this._log(`Wabie: ${s.decoys}  Manewry: ${s.evades}`, 'info');
    this._log(`Nasłuchy: ${s.listenEvents}  Snorkle: ${s.snorkels}`, 'info');
    this._log(`Kadłub końcowy: ${pct(this.sub.hull)}`, this.sub.hull < 0.5 ? 'fail' : 'ok');
  }

  // ── Status bar ────────────────────────────────────────────────────────────

  _updateStatusBar() {
    if (!this._status) return;
    const labels = {
      [STATES.DIVE]:          'zanurzanie',
      [STATES.PATROL]:        'patrol',
      [STATES.LISTEN]:        'NASŁUCH ◉',
      [STATES.STALK]:         'skradanie',
      [STATES.FIRE_TORP]:     'TORPEDA!',
      [STATES.FIRE_MISSILE]:  'RAKIETA!',
      [STATES.EVADE]:         'ucieczka',
      [STATES.DEPLOY_DECOY]:  'wabia!',
      [STATES.SURFACE_O2]:    'tlen!',
      [STATES.RECHARGE]:      'ładowanie',
    };
    this._status.textContent = labels[this._state] || this._state;
  }

  _log(msg, type = 'info') {
    console.log('[BOT]', msg);
    if (!this._el) return;
    const d = document.createElement('div');
    d.className = `bot-line bot-${type}`;
    d.textContent = msg;
    this._el.prepend(d);
    while (this._el.children.length > 60) this._el.removeChild(this._el.lastChild);
  }
}

// Formatowanie pomocnicze
function pct(v)      { return `${(v * 100).toFixed(0)}%`; }
function dist2m(px)  { const m = Math.abs(px * 1.2); return m > 999 ? `${(m/1000).toFixed(1)}km` : `${m.toFixed(0)}m`; }
