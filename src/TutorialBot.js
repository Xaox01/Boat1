// Bot automatycznie testujący wszystkie 5 faz samouczka.
// Uruchomienie: URL ?tutbot  lub komenda DevConsole: tbot start
//
// UWAGA: sub startuje na ~270m. Fazy 0 i 1 mają warunki depth już spełnione.
// Balast musi być kontrolowany — crush depth zaczyna się od 400m.

const PHASE_NAMES    = ['GŁĘBOKOŚĆ I NAPĘD', 'TERMOKLINA', 'TRYB NASŁUCH', 'SONAR AKTYWNY', 'TORPEDA MK.48'];
// Faza 4 ma 12s — bot detonuje po 8s, forceComplete wymusza st.timeout=46 → tutorial przechodzi
const PHASE_TIMEOUTS = [28, 38, 25, 12, 12];   // sekundy per faza

export class TutorialBot {
  constructor(scene) {
    this.scene   = scene;
    this._active = false;
    this._tut    = null;

    this._results     = [];
    this._lastPhase   = -2;
    this._phaseStart  = 0;
    this._phaseT      = 0;
    this._wasAdvancing = false;

    this._pingFired  = false;
    this._fired      = false;
    this._torpedoT   = 0;

    this._pollInterval       = null;
    this._introScheduled     = false;
    this._modalScheduled     = false;
    this._completeScheduled  = false;

    this._buildPanel();
  }

  get active() { return this._active; }

  start() {
    this._tut = this.scene.tutorial;
    if (!this._tut) {
      console.warn('[TutBot] Brak aktywnego samouczka');
      return false;
    }
    this._active = true;
    this._results         = [];
    this._lastPhase       = -2;
    this._phaseStart      = 0;
    this._phaseT          = 0;
    this._wasAdvancing    = false;
    this._pingFired       = false;
    this._fired           = false;
    this._torpedoT        = 0;
    this._introScheduled  = false;
    this._modalScheduled  = false;
    this._completeScheduled = false;

    this._panelEl.style.display = 'block';
    this._setPanel('Oczekiwanie...', -1);
    this._log('START', 'ok');

    this._pollInterval = setInterval(() => this._poll(), 250);
    return true;
  }

  stop() {
    this._active = false;
    if (this._pollInterval) { clearInterval(this._pollInterval); this._pollInterval = null; }
    this._panelEl.style.display = 'none';
    this._log('Zatrzymany', 'warn');
  }

  // ---- Petla update — wywoływana z GameScene.update() ----------------------

  update(dt) {
    if (!this._active || !this._tut) return;
    const tut = this._tut;

    // Tutorial zakończony lub scena zapauzowana przez modal
    if (tut._complete || tut._inIntro) return;

    const phase     = tut._phase;
    const advancing = tut._advancing;

    // Start nowej fazy
    if (phase !== this._lastPhase && phase >= 0 && phase <= 4) {
      this._onPhaseStart(phase);
    }

    // Zakonczenie fazy (advancing przechodzi na true)
    if (advancing && !this._wasAdvancing && phase >= 0) {
      this._onPhaseComplete(phase);
    }
    this._wasAdvancing = advancing;
    this._lastPhase    = phase;

    if (phase < 0 || phase > 4 || advancing) return;

    // Timeout fazy
    this._phaseT += dt;
    if (this._phaseT > PHASE_TIMEOUTS[phase]) {
      this._onPhaseTimeout(phase);
    }

    this._controlSub(phase, dt);
  }

  // ---- Eventy faz ----------------------------------------------------------

  _onPhaseStart(phase) {
    this._phaseT     = 0;
    this._phaseStart = performance.now();
    this._results.push({ phase, name: PHASE_NAMES[phase], status: 'RUNNING', timeMs: 0 });
    this._log(`Faza ${phase + 1}/5 -- ${PHASE_NAMES[phase]}`, 'ok');
    this._setPanel(PHASE_NAMES[phase], phase);
    if (phase === 3) this._pingFired = false;
    if (phase === 4) { this._fired = false; this._torpedoT = 0; }
  }

  _onPhaseComplete(phase) {
    const r = this._results.find(r => r.phase === phase && r.status === 'RUNNING');
    if (!r) return;
    r.status = 'PASS';
    r.timeMs = performance.now() - this._phaseStart;
    this._log(`✓ Faza ${phase + 1} ZALICZONA -- ${(r.timeMs / 1000).toFixed(1)}s`, 'ok');
  }

  _onPhaseTimeout(phase) {
    const r = this._results.find(r => r.phase === phase && r.status === 'RUNNING');
    if (r) {
      r.status = 'TIMEOUT';
      r.timeMs = this._phaseT * 1000;
      this._log(`⚠ Faza ${phase + 1} TIMEOUT (${PHASE_TIMEOUTS[phase]}s)`, 'danger');
    }
    this._phaseT = -9999;   // sentinel -- blokuje ponowne wywolanie w kolejnych klatkach
    this._forceComplete(phase);
  }

  // ---- Sterowanie sub per-faza ---------------------------------------------
  // Sub startuje na ~270m (SURFACE_Y+225). Fazy 0 i 1 mają warunki depth
  // juz spelnione — bot potrzebuje tylko osiagnac predkosc / uruchomic sensory.
  // targetBallast jest aktywnie kontrolowany aby nie przekroczyc 300m.

  _controlSub(phase, dt) {
    const sub   = this.scene.sub;
    const scene = this.scene;
    const tut   = this._tut;
    const depth = sub.depthMetres;

    switch (phase) {
      case 0:
        // Warunek: depth >= 50m -- spelniony (start 270m). Potrzeba speed >= 20 px/s.
        // Utrzymuj glebokos ~270m, nie schodz glebiej.
        sub.targetBallast = depth > 290 ? 0.30 : 0.55;
        sub.enginePower   = Math.min(1.0, sub.enginePower + 0.9 * dt);
        break;

      case 1:
        // Warunek: depth > 200m -- natychmiast spelniony. Faza przejdzie w 1-2 klatkach.
        sub.targetBallast = depth > 290 ? 0.30 : 0.55;
        sub.enginePower   = Math.min(0.3, sub.enginePower + 0.2 * dt);
        break;

      case 2:
        // Zatrzymaj silnik -- tryb nasluch (speed < prog, engine ~= 0).
        // Balast neutralny -- nie schodz glebiej.
        sub.enginePower   = sub.enginePower * Math.pow(0.04, dt);
        sub.targetBallast = depth > 290 ? 0.30 : 0.52;
        break;

      case 3:
        // Ping aktywny [Q] -- utrzymuj glebokos.
        sub.targetBallast = depth > 290 ? 0.30 : 0.52;
        if (!this._pingFired && scene._pingCD <= 0) {
          scene._firePing();
          this._pingFired = true;
          this._log('Ping wysłany', 'ok');
        }
        break;

      case 4: {
        // Wystrzel torpede -> cel treningowy, detonacja po 8s.
        sub.targetBallast = depth > 290 ? 0.30 : 0.52;
        const target = tut._target;
        if (target && !this._fired) {
          const res = sub.fireTorpedo(target.x, target.y);
          if (res) {
            this._fired    = true;
            this._torpedoT = 0;
            this._log('Torpeda wystrzelona', 'ok');
          }
        }
        if (this._fired) {
          this._torpedoT += dt;
          if (this._torpedoT >= 8) {
            const t = sub.torpedoes.find(tp => !tp.exploded && tp.armed);
            if (t) {
              t.cmdDetonate  = true;
              this._torpedoT = -9999;
              this._log('Detonacja zdalna', 'ok');
            }
          }
        }
        break;
      }
    }
  }

  // _forceComplete: modyfikuje tut._state bezposrednio, zeby check() zwrocil
  // true w nastepnej klatce tutorial.update() (ktory odpala sie przed bot.update).
  _forceComplete(phase) {
    const sub   = this.scene.sub;
    const scene = this.scene;
    const tut   = this._tut;
    switch (phase) {
      case 0:
        sub.vx = 26; sub.vy = 0;
        sub.targetBallast = 0.5;
        break;
      case 1:
        sub.targetBallast = 0.5; sub.vy = 0;
        break;
      case 2:
        sub.enginePower   = 0;
        sub.vx = 0; sub.vy = 0;
        sub.targetBallast = 0.5;
        // Wymuś st.t >= 3 -- check: st.t = listenMode ? st.t+dt : 0; return st.t >= 3
        if (tut._state) tut._state.t = 4;
        break;
      case 3:
        if (scene._pingCD <= 0) scene._firePing();
        // Wymuś st.pinged = true -- check: return !!st.pinged
        if (tut._state) tut._state.pinged = true;
        break;
      case 4:
        // Wymuś st.timeout > 45 -- check: return !!(tgt.destroyed || st.timeout >= 45)
        if (tut._state) {
          tut._state.fired   = true;
          tut._state.timeout = 46;
        }
        // Detonuj torpede jesli jest w wodzie
        {
          const t = sub.torpedoes.find(tp => !tp.exploded && tp.armed);
          if (t) t.cmdDetonate = true;
        }
        break;
    }
  }

  // ---- Polling -- dziala niezaleznie od pauzy sceny -----------------------

  _poll() {
    if (!this._active || !this._tut) return;
    const tut = this._tut;

    // Ekran powitalny samouczka
    if (tut._introEl && !this._introScheduled) {
      this._introScheduled = true;
      setTimeout(() => {
        if (this._active && tut._introEl) {
          this._log('Zamykam ekran powitalny', 'ok');
          tut._dismissIntro();
        }
      }, 900);
    }

    // Modal kroku (scena zapauzowana)
    if (tut._inIntro && !this._modalScheduled) {
      this._modalScheduled = true;
      setTimeout(() => {
        if (this._active && tut._inIntro) {
          this._log(`Zamykam modal -- krok ${tut._phase + 1}`, 'ok');
          tut._tsContBtn?.click();
        }
        this._modalScheduled = false;
      }, 700);
    }

    // Ekran zakonczenia samouczka
    if (tut._complete && !this._completeScheduled) {
      this._completeScheduled = true;
      const last = this._results[this._results.length - 1];
      if (last && last.status === 'RUNNING') {
        last.status = 'PASS';
        last.timeMs = performance.now() - this._phaseStart;
      }
      setTimeout(() => {
        if (!this._active) return;
        const btn = document.getElementById('tco-btn');
        if (btn) btn.click();
        this._showReport();
        this.stop();
      }, 1400);
    }
  }

  // ---- Raport konsoli ------------------------------------------------------

  _showReport() {
    console.group('%c▸ TUTORIALBOT -- Raport końcowy', 'color:#00ff88;font-weight:bold;font-size:13px');
    console.table(this._results.map(r => ({
      'Faza':     r.phase + 1,
      'Nazwa':    r.name,
      'Status':   r.status,
      'Czas (s)': (r.timeMs / 1000).toFixed(2),
    })));
    const total = this._results.length;
    const pass  = this._results.filter(r => r.status === 'PASS').length;
    const all   = pass === 5 && total === 5;
    console.log(
      `%c${all ? '✓ WSZYSTKIE FAZY ZALICZONE' : `${pass}/${total} faz zaliczonych`}`,
      `color:${all ? '#00ff88' : '#ffcc00'};font-weight:bold`,
    );
    console.groupEnd();
  }

  // ---- Panel DOM (górny srodek ekranu) ------------------------------------

  _buildPanel() {
    const el = document.createElement('div');
    el.id = 'tbot-panel';
    el.style.cssText = [
      'position:fixed', 'top:8px', 'left:50%', 'transform:translateX(-50%)',
      'background:rgba(0,5,2,0.93)', 'border:1px solid #00cc66',
      'color:#b0ffcc', 'font-family:"Courier New",monospace',
      'font-size:11px', 'padding:5px 14px 6px',
      'z-index:99998', 'display:none', 'min-width:300px',
      'text-align:center', 'pointer-events:none',
    ].join(';');
    el.innerHTML = [
      '<div style="color:#00ff88;letter-spacing:2px;font-size:9px;font-weight:bold;margin-bottom:2px;">▸ TUTORIAL BOT -- AUTO TEST</div>',
      '<div id="tbot-status" style="color:#b0ffcc;font-size:11px;"></div>',
      '<div id="tbot-phase"  style="color:#447755;font-size:10px;margin-top:1px;"></div>',
    ].join('');
    document.body.appendChild(el);
    this._panelEl  = el;
    this._statusEl = el.querySelector('#tbot-status');
    this._phaseEl  = el.querySelector('#tbot-phase');
  }

  _setPanel(status, phaseIdx) {
    if (this._statusEl) this._statusEl.textContent = status;
    if (this._phaseEl)  this._phaseEl.textContent  =
      phaseIdx >= 0 ? `Faza ${phaseIdx + 1}/5 · ${PHASE_NAMES[phaseIdx]}` : '';
  }

  _log(msg, type = 'info') {
    const c = { ok: '#00ff88', warn: '#ffcc00', danger: '#ff4444', info: '#b0ffcc' };
    console.log(`%c[TutBot] ${msg}`, `color:${c[type] ?? c.info}`);
  }
}
