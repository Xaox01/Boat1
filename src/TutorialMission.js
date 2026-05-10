// Samouczek — prowadzi gracza przez 7 faz uczenia się mechanik gry.

const TOTAL_STEPS = 7;

const PHASES = [
  {
    id:          'dive',
    step:        1,
    title:       'ZANURZENIE',
    icon:        '↓',
    keys:        ['S'],
    instruction: 'Zanurz okręt poniżej 60 m',
    detail:      'Przytrzymaj [S] aby napełnić zbiorniki balastowe — łódź zacznie opadać. Obserwuj głębokość w HUD (lewy górny róg).',
    check:       (scene) => scene.sub.depthMetres >= 60,
    progress:    (scene) => {
      const v = Math.min(scene.sub.depthMetres, 60);
      return { cur: Math.round(scene.sub.depthMetres), max: 60, unit: 'm', pct: v / 60 };
    },
  },
  {
    id:          'move',
    step:        2,
    title:       'NAPĘD ELEKTRYCZNY',
    icon:        '→',
    keys:        ['D', 'Shift'],
    instruction: 'Uruchom silnik i rusz naprzód',
    detail:      'Naciśnij [D] aby ruszyć — lub [Shift+D] dla pełnej mocy. Utrzymaj prędkość przez 3 sekundy. Kieruj się na WSCHÓD ku kontaktowi.',
    check(scene, st, dt) {
      const spd = Math.sqrt(scene.sub.vx ** 2 + scene.sub.vy ** 2);
      st.t = spd >= 30 ? (st.t || 0) + dt : Math.max(0, (st.t || 0) - dt);
      return st.t >= 3;
    },
    progress(scene, st) {
      const spd = Math.sqrt(scene.sub.vx ** 2 + scene.sub.vy ** 2);
      const pct = Math.min(spd / 30, 1);
      return { cur: Math.round(spd), max: 30, unit: 'px/s', pct, extra: st.t ? `${Math.min(Math.round(st.t), 3)}/3 s` : '' };
    },
  },
  {
    id:          'listen',
    step:        3,
    title:       'TRYB NASŁUCH',
    icon:        '◉',
    keys:        ['Spacja'],
    instruction: 'Zatrzymaj silnik i słuchaj',
    detail:      'Naciśnij [Spacja] aby wyłączyć silnik. Gdy prędkość spadnie poniżej progu — aktywuje się NASŁUCH: zasięg sonaru rośnie 1.6× i pojawi się pulsujący pierścień na PPI.',
    check(scene, st, dt) {
      st.t = scene.sub.listenMode ? (st.t || 0) + dt : 0;
      return st.t >= 4;
    },
    progress(scene, st) {
      const on = scene.sub.listenMode;
      return { text: on ? `NASŁUCH AKTYWNY — ${Math.round(st.t || 0)}/4 s` : 'Zatrzymaj silnik [Spacja]', pct: on ? Math.min((st.t || 0) / 4, 1) : 0 };
    },
  },
  {
    id:          'ping',
    step:        4,
    title:       'AKTYWNY SONAR',
    icon:        '◎',
    keys:        ['Q'],
    instruction: 'Wyślij ping aktywny',
    detail:      'Naciśnij [Q] — okrąg rozchodzi się od pozycji łodzi. Wróg zobaczy źródło pingu, ale ty ujrzysz echa kontaktów na PPI przez 5 sekund. Używaj oszczędnie!',
    check(scene, st) {
      if (scene._activePings && scene._activePings.length > 0) st.pinged = true;
      return !!st.pinged;
    },
    progress: () => ({ text: 'Naciśnij [Q] aby wysłać ping', pct: 0 }),
  },
  {
    id:          'classify',
    step:        5,
    title:       'IDENTYFIKACJA KONTAKTU',
    icon:        '◈',
    keys:        [],
    instruction: 'Poczekaj na klasyfikację na DEMON waterfalle',
    detail:      'Prawy panel — DEMON waterfall — analizuje widmo akustyczne. Pozioma linia tonalna pojawiająca się w okolicach 11–18 Hz to sygnatura statku handlowego. Kontakt zmieni status z UNK na SURFACE.',
    check:       (scene, st, dt, tgt) => tgt && tgt.contactClass === 'SURFACE',
    progress:    (scene, st, dt, tgt) => {
      const cls = tgt ? tgt.contactClass : 'UNK';
      const done = cls === 'SURFACE';
      return { text: done ? 'KLASYFIKACJA: SURFACE — CEL ZIDENTYFIKOWANY' : `Analizuję... STATUS: ${cls}`, pct: done ? 1 : Math.min((tgt?.classifyTimer || 0) / 54, 0.9) };
    },
  },
  {
    id:          'fire',
    step:        6,
    title:       'TORPEDA MK.48',
    icon:        '◆',
    keys:        ['LPM'],
    instruction: 'Wystrzel torpedę w zidentyfikowany cel',
    detail:      'Najedź kursorem na statek — pojawi się celownik i punkt ołowiu (lead indicator). Kliknij [LPM]. Torpeda sama naprowadza się akustycznie w zasięgu 240px.',
    check:       (scene, st) => { if (scene.sub.torpedoes.length > 0) st.fired = true; return !!st.fired; },
    progress:    () => ({ text: 'Naciśnij LPM na kontakcie aby wystrzelić', pct: 0 }),
  },
  {
    id:          'hit',
    step:        7,
    title:       'TORPEDA W DRODZE',
    icon:        '✦',
    keys:        ['E'],
    instruction: 'Obserwuj PPI — poczekaj na trafienie',
    detail:      'Torpeda namierza się na sygnaturę akustyczną statku. Naciśnij [E] aby zdetonować zdalnie gdy jesteś blisko celu. Śledź torpedę na mapie taktycznej [M].',
    check(scene, st, dt, tgt) {
      st.timeout = (st.timeout || 0) + dt;
      return (tgt && tgt.destroyed) || st.timeout >= 35;
    },
    progress(scene, st, dt, tgt) {
      if (tgt?.destroyed) return { text: 'CEL ZATOPIONY', pct: 1 };
      const t = Math.min(st.timeout || 0, 35);
      return { text: `Torpeda aktywna — ${Math.round(35 - t)}s`, pct: 1 - t / 35 };
    },
  },
];

export class TutorialMission {
  constructor(scene) {
    this.scene    = scene;
    this._phase   = -1;
    this._state   = {};
    this._complete = false;
    this._target  = null;
    this._advancing = false;

    this._introEl    = null;
    this._panelEl    = null;
    this._completeEl = null;

    this._buildCSS();
    this._buildIntro();
    this._buildPanel();
    this._buildComplete();
  }

  start(trainingMerchant) {
    this._target = trainingMerchant;
    this._showIntro();
  }

  update(dt) {
    if (this._complete || this._phase < 0 || this._advancing) return;

    const phase = PHASES[this._phase];
    if (!phase) return;

    const done = phase.check(this.scene, this._state, dt, this._target);
    if (done) {
      this._advancePhase();
    } else {
      this._updateProgress(phase);
    }
  }

  skip() {
    this._hideIntro();
    this._hidePanelEl();
    this._triggerMission();
  }

  // ── Private ───────────────────────────────────────────────────

  _buildCSS() {
    const style = document.createElement('style');
    style.textContent = `
      #tut-intro {
        position: absolute; inset: 0;
        background: rgba(0,5,14,0.94);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        z-index: 48; font-family: 'Courier New', monospace; color: #f3ede0;
        pointer-events: all; opacity: 0; transition: opacity 0.5s;
        text-align: center; gap: 0;
      }
      #tut-intro.vis { opacity: 1; }
      #tut-intro .ti-eyebrow { font-size: 10px; letter-spacing: 5px; color: #44ffaa; margin-bottom: 18px; }
      #tut-intro .ti-title   { font-size: 28px; letter-spacing: 6px; font-weight: bold; color: #f3ede0; margin-bottom: 6px; }
      #tut-intro .ti-sub     { font-size: 11px; letter-spacing: 3px; color: rgba(243,237,224,0.5); margin-bottom: 30px; }
      #tut-intro .ti-list    { list-style: none; text-align: left; display: inline-block; margin-bottom: 32px; }
      #tut-intro .ti-list li { font-size: 12px; letter-spacing: 1px; color: rgba(243,237,224,0.75); padding: 5px 0; }
      #tut-intro .ti-list li::before { content: '▸ '; color: #44ffaa; }
      #tut-intro .ti-btn {
        background: none; border: 1px solid #44ffaa; color: #44ffaa;
        font-family: 'Courier New', monospace; font-size: 12px; letter-spacing: 4px;
        padding: 12px 36px; cursor: pointer; pointer-events: all;
        transition: background 0.15s, color 0.15s;
        animation: tut-blink 1.2s ease-in-out infinite;
      }
      #tut-intro .ti-btn:hover { background: #44ffaa22; }
      #tut-intro .ti-skip {
        margin-top: 14px; background: none; border: none;
        color: rgba(243,237,224,0.3); font-family: 'Courier New', monospace;
        font-size: 9px; letter-spacing: 2px; cursor: pointer; pointer-events: all;
        text-decoration: underline;
      }
      #tut-intro .ti-skip:hover { color: rgba(243,237,224,0.6); }

      #tut-panel {
        position: absolute; bottom: 0; left: 0; right: 0; height: 112px;
        background: rgba(0,8,18,0.93);
        border-top: 2px solid #44ffaa;
        z-index: 30; pointer-events: none;
        display: none; flex-direction: column;
      }
      #tut-panel.vis { display: flex; }
      #tut-panel.done { border-top-color: #44ffaa; animation: tut-flash-border 0.6s ease 3; }

      #tut-header {
        display: flex; align-items: center; gap: 0;
        padding: 5px 14px 4px;
        border-bottom: 1px solid rgba(68,255,170,0.18);
      }
      #tut-step-label {
        font-family: 'Courier New', monospace; font-size: 9px; letter-spacing: 3px;
        color: #44ffaa; flex-shrink: 0;
      }
      #tut-progress-track {
        flex: 1; height: 3px; background: rgba(68,255,170,0.15);
        margin: 0 14px; border-radius: 2px; overflow: hidden;
      }
      #tut-progress-fill {
        height: 100%; background: #44ffaa; border-radius: 2px;
        transition: width 0.3s; width: 0%;
        box-shadow: 0 0 6px rgba(68,255,170,0.8);
      }
      #tut-step-frac {
        font-family: 'Courier New', monospace; font-size: 9px; letter-spacing: 1px;
        color: rgba(68,255,170,0.55); flex-shrink: 0;
      }

      #tut-body { display: flex; align-items: flex-start; padding: 8px 14px 6px; gap: 16px; }
      #tut-icon-col { display: flex; flex-direction: column; align-items: center; gap: 6px; flex-shrink: 0; padding-top: 1px; }
      #tut-phase-icon { font-size: 22px; color: #44ffaa; text-shadow: 0 0 12px rgba(68,255,170,0.7); width: 30px; text-align: center; }
      #tut-keys { display: flex; flex-direction: column; gap: 3px; align-items: center; }
      .tut-key {
        display: inline-block; background: rgba(68,255,170,0.1);
        border: 1px solid rgba(68,255,170,0.4); border-radius: 3px;
        font-family: 'Courier New', monospace; font-size: 9px; letter-spacing: 0.5px;
        color: #44ffaa; padding: 1px 5px; white-space: nowrap;
      }
      #tut-text-col { flex: 1; min-width: 0; }
      #tut-phase-title { font-family: 'Courier New', monospace; font-size: 11px; letter-spacing: 3px; color: #44ffaa; margin-bottom: 3px; font-weight: bold; }
      #tut-instruction { font-family: 'Courier New', monospace; font-size: 13px; letter-spacing: 0.5px; color: #f3ede0; margin-bottom: 3px; }
      #tut-detail { font-family: 'Courier New', monospace; font-size: 9px; letter-spacing: 0.3px; color: rgba(243,237,224,0.5); line-height: 1.5; }
      #tut-cond-col { flex-shrink: 0; width: 190px; display: flex; flex-direction: column; justify-content: center; padding-top: 4px; }
      #tut-cond-text { font-family: 'Courier New', monospace; font-size: 9px; letter-spacing: 1px; color: #44cc88; margin-bottom: 5px; }
      #tut-cond-bar { height: 4px; background: rgba(68,255,170,0.15); border-radius: 2px; overflow: hidden; }
      #tut-cond-fill { height: 100%; background: #44ffaa; border-radius: 2px; transition: width 0.4s; width: 0%; }

      #tut-complete {
        position: absolute; inset: 0;
        background: rgba(0,8,18,0.93);
        display: none; flex-direction: column; align-items: center; justify-content: center;
        z-index: 49; font-family: 'Courier New', monospace; color: #f3ede0;
        pointer-events: all; opacity: 0; transition: opacity 0.5s; gap: 0;
        text-align: center;
      }
      #tut-complete.vis { display: flex; }
      #tut-complete.fade { opacity: 1; }
      .tc-check  { font-size: 48px; color: #44ffaa; margin-bottom: 16px; text-shadow: 0 0 24px rgba(68,255,170,0.8); }
      .tc-title  { font-size: 22px; letter-spacing: 8px; color: #44ffaa; margin-bottom: 8px; }
      .tc-sub    { font-size: 11px; letter-spacing: 3px; color: rgba(243,237,224,0.6); margin-bottom: 28px; }
      .tc-stats  { font-size: 10px; letter-spacing: 2px; color: rgba(243,237,224,0.55); margin-bottom: 32px; line-height: 1.8; }
      .tc-btn {
        background: none; border: 1px solid #44ffaa; color: #44ffaa;
        font-family: 'Courier New', monospace; font-size: 12px; letter-spacing: 4px;
        padding: 13px 40px; cursor: pointer; pointer-events: all;
        transition: background 0.15s; margin-bottom: 10px;
      }
      .tc-btn:hover { background: rgba(68,255,170,0.12); }

      @keyframes tut-blink {
        0%,100% { box-shadow: 0 0 0 rgba(68,255,170,0); }
        50%      { box-shadow: 0 0 12px rgba(68,255,170,0.5); }
      }
      @keyframes tut-flash-border {
        0%,100% { border-top-color: #44ffaa; }
        50%      { border-top-color: #ffffff; }
      }
    `;
    document.getElementById('game-container').appendChild(style);
  }

  _buildIntro() {
    const gc = document.getElementById('game-container');
    const el = document.createElement('div');
    el.id = 'tut-intro';
    el.innerHTML = `
      <div class="ti-eyebrow">★  SZKOLENIE TAKTYCZNE  ★</div>
      <div class="ti-title">ORP ORZEŁ — ĆWICZENIA</div>
      <div class="ti-sub">ATLANTYK PÓŁNOCNY  ·  WRZESIEŃ 1983  ·  STREFA ĆWICZEŃ</div>
      <ul class="ti-list">
        <li>Kontrola głębokości i napędu elektrycznego</li>
        <li>Pasywny sonar i tryb NASŁUCH</li>
        <li>Aktywny ping i identyfikacja kontaktów</li>
        <li>Celowanie i wystrzelenie torpedy Mk.48</li>
      </ul>
      <button class="ti-btn" id="tut-start-btn">▸ ROZPOCZNIJ SZKOLENIE [Enter]</button>
      <button class="ti-skip" id="tut-skip-btn">Pomiń samouczek</button>
    `;
    gc.appendChild(el);
    this._introEl = el;

    el.querySelector('#tut-start-btn').addEventListener('click', () => this._dismissIntro());
    el.querySelector('#tut-skip-btn').addEventListener('click', () => this.skip());
    this._introKeyHandler = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._dismissIntro(); }
      if (e.key === 'Escape') { this.skip(); }
    };
    window.addEventListener('keydown', this._introKeyHandler);
  }

  _buildPanel() {
    const gc = document.getElementById('game-container');
    const el = document.createElement('div');
    el.id = 'tut-panel';
    el.innerHTML = `
      <div id="tut-header">
        <span id="tut-step-label">SZKOLENIE — KROK 1/${TOTAL_STEPS}</span>
        <div id="tut-progress-track"><div id="tut-progress-fill"></div></div>
        <span id="tut-step-frac">1/${TOTAL_STEPS}</span>
      </div>
      <div id="tut-body">
        <div id="tut-icon-col">
          <div id="tut-phase-icon">↓</div>
          <div id="tut-keys"></div>
        </div>
        <div id="tut-text-col">
          <div id="tut-phase-title">ZANURZENIE</div>
          <div id="tut-instruction">Zanurz okręt poniżej 60 m</div>
          <div id="tut-detail">Przytrzymaj [S] aby napełnić zbiorniki balastowe.</div>
        </div>
        <div id="tut-cond-col">
          <div id="tut-cond-text">Czekam...</div>
          <div id="tut-cond-bar"><div id="tut-cond-fill"></div></div>
        </div>
      </div>
    `;
    gc.appendChild(el);
    this._panelEl = el;

    this._pStepLabel  = el.querySelector('#tut-step-label');
    this._pStepFrac   = el.querySelector('#tut-step-frac');
    this._pProgFill   = el.querySelector('#tut-progress-fill');
    this._pIcon       = el.querySelector('#tut-phase-icon');
    this._pKeys       = el.querySelector('#tut-keys');
    this._pTitle      = el.querySelector('#tut-phase-title');
    this._pInstruct   = el.querySelector('#tut-instruction');
    this._pDetail     = el.querySelector('#tut-detail');
    this._pCondText   = el.querySelector('#tut-cond-text');
    this._pCondFill   = el.querySelector('#tut-cond-fill');
  }

  _buildComplete() {
    const gc = document.getElementById('game-container');
    const el = document.createElement('div');
    el.id = 'tut-complete';
    el.innerHTML = `
      <div class="tc-check">✓</div>
      <div class="tc-title">SZKOLENIE ZAKOŃCZONE</div>
      <div class="tc-sub">KWALIFIKACJA TAKTYCZNA — ZALICZONA</div>
      <div class="tc-stats" id="tc-stats">
        Wszystkie procedury bojowe opanowane.<br>
        Gotowość do operacji bojowej: POTWIERDZONA.
      </div>
      <button class="tc-btn" id="tc-mission-btn">▸ ROZPOCZNIJ MISJĘ BOJOWĄ [Enter]</button>
    `;
    gc.appendChild(el);
    this._completeEl = el;

    el.querySelector('#tc-mission-btn').addEventListener('click', () => this._triggerMission());
    this._completeKeyHandler = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._triggerMission(); }
    };
  }

  _showIntro() {
    this._introEl.classList.add('vis');
  }

  _hideIntro() {
    window.removeEventListener('keydown', this._introKeyHandler);
    this._introEl.style.opacity = '0';
    setTimeout(() => this._introEl?.remove(), 550);
    this._introEl = null;
  }

  _dismissIntro() {
    this._hideIntro();
    this._phase = 0;
    this._state = {};
    this._panelEl.classList.add('vis');
    this._renderPhase(0);

    this.scene._shipLog('SZKOLENIE TAKTYCZNE: Wykonuj polecenia wyświetlane w dolnym panelu.', 'info');
    this.scene._logEvent('SZKOLENIE — KROK 1/7: ZANURZENIE');
  }

  _renderPhase(i) {
    const phase = PHASES[i];
    if (!phase) return;

    const overall = (i / TOTAL_STEPS) * 100;
    this._pProgFill.style.width = `${overall}%`;
    this._pStepLabel.textContent = `SZKOLENIE — KROK ${phase.step}/${TOTAL_STEPS}`;
    this._pStepFrac.textContent  = `${phase.step}/${TOTAL_STEPS}`;
    this._pIcon.textContent      = phase.icon;
    this._pTitle.textContent     = phase.title;
    this._pInstruct.textContent  = phase.instruction;
    this._pDetail.textContent    = phase.detail;

    this._pKeys.innerHTML = phase.keys.length
      ? phase.keys.map(k => `<span class="tut-key">${k}</span>`).join('')
      : '';

    this._pCondText.textContent = 'Czekam...';
    this._pCondFill.style.width = '0%';
  }

  _updateProgress(phase) {
    const prog = phase.progress
      ? phase.progress(this.scene, this._state, 0, this._target)
      : null;
    if (!prog) return;

    if (prog.text) {
      this._pCondText.textContent = prog.text;
    } else if (prog.cur !== null && prog.max !== null) {
      const extra = prog.extra ? `  ${prog.extra}` : '';
      this._pCondText.textContent = `${prog.cur} / ${prog.max} ${prog.unit}${extra}`;
    }

    if (prog.pct !== undefined) {
      this._pCondFill.style.width = `${Math.round(prog.pct * 100)}%`;
    }
  }

  _advancePhase() {
    this._advancing = true;
    const phaseName = PHASES[this._phase]?.title || '';

    // Completion flash
    this._panelEl.classList.add('done');
    this._pCondText.textContent = '✓ WYKONANE';
    this._pCondFill.style.width = '100%';
    this.scene._logEvent(`✓ KROK ${this._phase + 1}/${TOTAL_STEPS} — ${phaseName}`);

    setTimeout(() => {
      this._panelEl.classList.remove('done');
      this._phase++;
      this._state = {};
      this._advancing = false;

      if (this._phase >= PHASES.length) {
        this._complete = true;
        this._hidePanelEl();
        this._showCompletion();
      } else {
        this._renderPhase(this._phase);
        this.scene._logEvent(`SZKOLENIE — KROK ${this._phase + 1}/${TOTAL_STEPS}: ${PHASES[this._phase].title}`);
        this.scene._shipLog(`Krok ${this._phase + 1}: ${PHASES[this._phase].instruction}`, 'info');
      }
    }, 1400);
  }

  _hidePanelEl() {
    if (this._panelEl) {
      this._panelEl.style.opacity = '0';
      setTimeout(() => { if (this._panelEl) this._panelEl.style.display = 'none'; }, 350);
    }
  }

  _showCompletion() {
    const el = this._completeEl;
    el.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('fade')));
    window.addEventListener('keydown', this._completeKeyHandler);
    this.scene._shipLog('SZKOLENIE ZAKOŃCZONE — Kwalifikacja taktyczna zaliczona.', 'good');
    this.scene._logEvent('SZKOLENIE: Wszystkie procedury wykonane poprawnie.');
  }

  _triggerMission() {
    window.removeEventListener('keydown', this._completeKeyHandler);
    if (this._completeEl) {
      this._completeEl.style.opacity = '0';
      setTimeout(() => this._completeEl?.remove(), 550);
    }
    this.scene._startMission1Combat();
  }
}
