// Bot autonomiczny — gra jak gracz i loguje obserwacje z mechanik gry.
// Aktywacja: klawisz B podczas gry.

const THERMO_Y      = 280;   // Y pikseli — termoklina
const SURFACE_Y     = 80;
const OCEAN_FLOOR_Y = 580;

// Głębokość patrolu w pikselach (poniżej termokliny)
const PATROL_DEPTH_Y  = 340;
const SHALLOW_DEPTH_Y = 140;   // do odpalania rakiet

// Odległość ataku torpedą
const TORPEDO_RANGE = 780;
const MISSILE_RANGE = 1600;

export class TestBot {
  constructor(scene) {
    this.scene  = scene;
    this.active = false;

    this._el     = document.getElementById('bot-log');
    this._status = document.getElementById('bot-status');
    this._panel  = document.getElementById('bot-panel');

    // Stan AI
    this._state    = 'DIVING';   // DIVING | PATROL | EVADE | ATTACK | SURFACE
    this._dir      = 1;          // kierunek ruchu: +1 prawo, -1 lewo
    this._stateTimer = 0;        // czas w bieżącym stanie
    this._evadeTimer  = 0;
    this._attackCD    = 0;       // cooldown decyzji ataku
    this._logCD       = 0;       // cooldown logowania obserwacji
    this._missileCD   = 0;
  }

  get sub() { return this.scene.sub; }

  start() {
    this.active = true;
    this.sub.botControl = true;
    this._state     = 'DIVING';
    this._stateTimer = 0;
    this._dir        = 1;

    if (this._el)     this._el.innerHTML = '';
    if (this._panel)  this._panel.classList.add('visible');
    if (this._status) this._status.textContent = 'aktywny';

    this._log('BOT START — tryb autonomiczny', 'info');
  }

  stop() {
    this.active = false;
    this.sub.botControl = false;
    this.sub.enginePower = 0;
    if (this._status) this._status.textContent = 'zatrzymany';
    this._log('BOT zatrzymany', 'info');
  }

  update(dt) {
    if (!this.active) return;

    this._stateTimer += dt;
    this._attackCD   = Math.max(0, this._attackCD   - dt);
    this._logCD      = Math.max(0, this._logCD      - dt);
    this._missileCD  = Math.max(0, this._missileCD  - dt);

    this._decide(dt);
    this._observePassive(dt);
    this._updateStatusBar();
  }

  // ── Maszyna stanów ────────────────────────────────────────────────────────

  _decide(dt) {
    const sub      = this.sub;
    const enemies  = this.scene.enemies || [];
    const detected = enemies.some(e => e.detectTimer > 0);
    const hunting  = enemies.some(e => e.state === 'HUNT');
    const nearestEnemy = this._nearestEnemy();

    // Priorytety:
    // 1. Mały tlen → wynurz się
    // 2. Wykryto / atak → ucieczka
    // 3. Wróg w zasięgu → atak
    // 4. Normalny patrol

    if (sub.oxygen < 0.18 && this._state !== 'SURFACE') {
      this._setState('SURFACE');
      this._log(`O₂ krytyczne (${(sub.oxygen*100).toFixed(0)}%) — wynurzenie!`, 'fail');
    } else if (hunting && this._state !== 'EVADE' && this._state !== 'SURFACE') {
      this._setState('EVADE');
      this._log('Wróg atakuje — manewr unikania!', 'fail');
    } else if (nearestEnemy && this._attackCD <= 0 && !hunting
               && this._state !== 'EVADE' && this._state !== 'SURFACE') {
      this._tryAttack(nearestEnemy);
    }

    switch (this._state) {
      case 'DIVING':   this._doDiving(dt);  break;
      case 'PATROL':   this._doPatrol(dt);  break;
      case 'EVADE':    this._doEvade(dt);   break;
      case 'ATTACK':   this._doAttack(dt);  break;
      case 'SURFACE':  this._doSurface(dt); break;
    }
  }

  _setState(s) {
    this._state      = s;
    this._stateTimer = 0;
  }

  // ── Stany ─────────────────────────────────────────────────────────────────

  _doDiving(dt) {
    const sub = this.sub;
    // Zanurz poniżej termokliny
    sub.targetBallast = 0.78;
    sub.enginePower   = this._clampEngine(0.35 * this._dir);

    if (sub.y >= PATROL_DEPTH_Y || this._stateTimer > 12) {
      this._setState('PATROL');
      this._log(`Poniżej termokliny (${sub.depthMetres}m) — patrol`, 'ok');
    }
  }

  _doPatrol(dt) {
    const sub = this.sub;

    // Utrzymaj głębokość patrolu
    const targetY = PATROL_DEPTH_Y;
    if (sub.y < targetY - 20) sub.targetBallast = Math.min(1, sub.targetBallast + 0.3 * dt);
    if (sub.y > targetY + 20) sub.targetBallast = Math.max(0, sub.targetBallast - 0.3 * dt);

    sub.enginePower = this._clampEngine(0.40 * this._dir);

    // Zmień kierunek przy granicy świata
    const margin = 300;
    if (sub.x < margin)                    this._dir =  1;
    if (sub.x > this.scene.WORLD_W - margin) this._dir = -1;

    // Co jakiś czas zmień stronę losowo (naturalne zachowanie)
    if (this._stateTimer > 18) {
      this._dir *= -1;
      this._setState('PATROL');
    }
  }

  _doEvade(dt) {
    const sub = this.sub;

    // Zmiana głębokości + kierunek ucieczki
    if (this._stateTimer < 2) {
      // Pierwsza reakcja: pełny silnik i zmiana głębokości
      sub.targetBallast = sub.y < THERMO_Y ? 0.85 : 0.25;
      sub.enginePower   = this._clampEngine(-0.90 * this._dir); // w tył
    } else {
      // Potem schowaj się poniżej termokliny z małym silnikiem
      sub.targetBallast = 0.72;
      sub.enginePower   = this._clampEngine(0.20 * this._dir);
    }

    const hunting = (this.scene.enemies || []).some(e => e.state === 'HUNT');
    if (!hunting && this._stateTimer > 8) {
      this._dir *= -1;
      this._setState('PATROL');
      this._log('Zagrożenie minęło — wznowienie patrolu', 'ok');
    }
    if (this._stateTimer > 22) {
      // Timeout ucieczki
      this._setState('PATROL');
    }
  }

  _doAttack(dt) {
    const sub = this.sub;
    // Utrzymuj kurs i czekaj na strzał (właściwy atak wykonany w _tryAttack)
    sub.enginePower = this._clampEngine(0.45 * this._dir);

    if (this._stateTimer > 3) {
      this._setState('PATROL');
    }
  }

  _doSurface(dt) {
    const sub = this.sub;
    sub.targetBallast = 0.08;
    sub.enginePower   = this._clampEngine(0.20 * this._dir);

    if (sub.oxygen > 0.90 && sub.depthMetres < 12) {
      this._log(`O₂ naładowany (${(sub.oxygen*100).toFixed(0)}%) — zanurzenie`, 'ok');
      this._setState('DIVING');
    }
    if (this._stateTimer > 25) this._setState('DIVING');
  }

  // ── Atak ──────────────────────────────────────────────────────────────────

  _tryAttack(enemy) {
    const sub  = this.sub;
    const dx   = enemy.x - sub.x;
    const dist = Math.abs(dx);

    // Torpeda
    if (dist < TORPEDO_RANGE && sub.torpedoCount > 0 && sub.torpedoFireCD <= 0) {
      const result = sub.fireTorpedo(enemy.x, enemy.y);
      if (result) {
        this._log(`Torpeda → ${enemy.label || 'cel'} (${dist.toFixed(0)}px)`, 'ok');
        this._attackCD = 3.5;
        this._setState('ATTACK');
        return;
      }
    }

    // Rakieta (trzeba być płytko)
    if (dist < MISSILE_RANGE && sub.missileCount > 0 && this._missileCD <= 0) {
      if (sub.depthMetres <= 70) {
        const result = sub.fireMissile(enemy.x);
        if (result === 'ok') {
          this._log(`Rakieta → ${enemy.label || 'cel'} (${dist.toFixed(0)}px)`, 'ok');
          this._missileCD = 4;
          this._attackCD  = 2;
          this._setState('ATTACK');
          return;
        }
      } else if (dist < MISSILE_RANGE && sub.depthMetres > 70) {
        // Wynurz żeby móc strzelić rakietą
        this._setState('SURFACE');
      }
    }
  }

  _nearestEnemy() {
    const sub      = this.sub;
    const enemies  = (this.scene.enemies || []).filter(e => !e.destroyed);
    if (!enemies.length) return null;
    return enemies.reduce((best, e) =>
      Math.abs(e.x - sub.x) < Math.abs(best.x - sub.x) ? e : best
    );
  }

  // ── Obserwacje pasywne (logowanie mechanik) ───────────────────────────────

  _observePassive(dt) {
    if (this._logCD > 0) return;
    const sub = this.sub;

    // Termoklina
    if (sub.belowThermocline && sub.noiseEffective < sub.noise - 0.05) {
      this._log(
        `Termoklina: hałas ${(sub.noise*100).toFixed(0)}% → ${(sub.noiseEffective*100).toFixed(0)}% skuteczny`,
        'info'
      );
      this._logCD = 12;
      return;
    }

    // Kawitacja
    if (sub.cavitating) {
      const spd = Math.sqrt(sub.vx**2 + sub.vy**2);
      this._log(`Kawitacja! prędkość=${spd.toFixed(0)}px/s  hałas=${(sub.noise*100).toFixed(0)}%`, 'fail');
      this._logCD = 8;
      return;
    }

    // Niski poziom baterii
    if (sub.battery < 0.15) {
      this._log(`Bateria niska: ${(sub.battery*100).toFixed(0)}%`, 'fail');
      this._logCD = 10;
      return;
    }

    // Uszkodzenie kadłuba
    if (sub.hull < 0.7) {
      this._log(`Kadłub: ${(sub.hull*100).toFixed(0)}%`, sub.hull < 0.4 ? 'fail' : 'info');
      this._logCD = 6;
      return;
    }

    // Wykrycie przez wroga
    const enemies = this.scene.enemies || [];
    const alerted = enemies.filter(e => e.detectTimer > 0);
    if (alerted.length) {
      this._log(`Wykrycie — ${alerted.length} niszczyciel(e) namierza`, 'fail');
      this._logCD = 5;
      return;
    }

    // Snorkel
    if (sub.snorkeling) {
      this._log(`Snorkel — doładowanie baterii (${(sub.battery*100).toFixed(0)}%)`, 'info');
      this._logCD = 8;
      return;
    }

    this._logCD = 4;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _clampEngine(v) {
    const bat = this.sub.battery;
    if (bat <= 0) return 0;
    return Math.max(-1, Math.min(1, v));
  }

  _updateStatusBar() {
    if (!this._status) return;
    const labels = { DIVING: 'zanurzanie', PATROL: 'patrol', EVADE: 'ucieczka', ATTACK: 'atak', SURFACE: 'wynurzanie' };
    this._status.textContent = labels[this._state] || this._state;
  }

  _log(msg, type = 'info') {
    console.log('[BOT]', msg);
    if (!this._el) return;
    const d = document.createElement('div');
    d.className = `bot-line bot-${type}`;
    d.textContent = msg;
    this._el.prepend(d);
    // Max 40 wpisów
    while (this._el.children.length > 40) this._el.removeChild(this._el.lastChild);
  }
}
