// Samouczek taktyczny — 5 kroków: sterowanie → termoklina → nasłuch → sonar → torpeda

const TOTAL_STEPS = 5;

const PHASES = [
  {
    id: 'dive', step: 1, title: 'GŁĘBOKOŚĆ I NAPĘD',
    intro: {
      lines: [
        '[S] napełnia zbiorniki balastowe — ORP KONDOR opada. [W] — wynurzenie. Wskaźnik GŁĘBOKOŚĆ w HUD pokazuje głębokość w metrach.',
        '[D] — naprzód. [A] — wstecz. [Shift+D] — pełna moc elektryczna. Wskaźnik HAŁAS pokazuje akustyczną sygnaturę — im ciszej, tym trudniej cię wykryć.',
        'Zanurz się do 50 metrów i osiągnij prędkość ≥ 20 px/s. Możesz robić to równocześnie.',
      ],
      bindings: [['S/W', 'zanurzenie / wynurzenie'], ['D/A', 'naprzód / wstecz'], ['Shift+D', 'pełna moc']],
      goal: 'Zanurz się do 50m i osiągnij prędkość ≥ 20 px/s',
    },
    keys: ['S', 'D'],
    instruction: '[S] zanurz · [Shift+D] naprzód pełna moc',
    hint: 'Oba warunki jednocześnie — zanurzaj i przyspieszaj.',
    check(scene, st) {
      const spd = Math.hypot(scene.sub.vx, scene.sub.vy);
      if (scene.sub.depthMetres >= 50) st.depth = true;
      if (spd >= 20) st.speed = true;
      return !!(st.depth && st.speed);
    },
    progress(scene, st) {
      const spd = Math.hypot(scene.sub.vx, scene.sub.vy);
      const dOk = scene.sub.depthMetres >= 50;
      const sOk = spd >= 20;
      if (dOk && sOk) return { text: '✓ GOTOWE', pct: 1 };
      const parts = [];
      if (!dOk) parts.push(`głębokość ${Math.round(scene.sub.depthMetres)}/50m`);
      if (!sOk) parts.push(`prędkość ${Math.round(spd)}/20`);
      return { text: parts.join('  ·  '), pct: (dOk ? 0.5 : 0) + (sOk ? 0.5 : 0) };
    },
  },

  {
    id: 'thermo', step: 2, title: 'TERMOKLINA',
    intro: {
      lines: [
        'Na głębokości ~200m przebiega termoklina — warstwa skokowej zmiany temperatury. Dźwięk słabo przez nią przechodzi.',
        'ORP KONDOR ukryta poniżej termokliny jest czterokrotnie trudniejsza do wykrycia sonarami wroga. To twój główny atut taktyczny.',
        'Przytrzymaj [S] — zejdź głębiej. Obserwuj wskaźnik HAŁAS w HUD: po przejściu termokliny kolor się zmieni.',
      ],
      bindings: [['S', 'zanurz głębiej']],
      goal: 'Zejdź poniżej termokliny (> 200m)',
    },
    keys: ['S'],
    instruction: 'Zanurz się poniżej 200m — przez termoklnię',
    hint: 'Obserwuj pasek HAŁAS — przy termoklinie zmienia kolor.',
    check: (scene) => scene.sub.depthMetres > 200,
    progress: (scene) => ({
      cur: Math.round(scene.sub.depthMetres), max: 200, unit: 'm',
      pct: Math.min(scene.sub.depthMetres / 200, 1),
    }),
  },

  {
    id: 'listen', step: 3, title: 'TRYB NASŁUCH',
    intro: {
      lines: [
        '[Spacja] zatrzymuje silnik. Gdy prędkość spadnie blisko zera, ORP KONDOR przechodzi w tryb NASŁUCH — pulsujący pierścień na kole PPI.',
        'W trybie NASŁUCH zasięg sonarów pasywnych rośnie 1.6×. Słyszysz więcej, nie emitujesz żadnego sygnału.',
        'Technika "sprint-and-listen": przyspiesz krótko, potem zatrzymaj i słuchaj. Tak polują prawdziwe okręty podwodne.',
      ],
      bindings: [['Spacja', 'zatrzymaj / uruchom silnik']],
      goal: 'Aktywuj tryb NASŁUCH na 3 sekundy',
    },
    keys: ['Spacja'],
    instruction: '[Spacja] — zatrzymaj silnik, czekaj na NASŁUCH',
    hint: 'Poczekaj aż prędkość opadnie — NASŁUCH aktywuje się.',
    check(scene, st, dt) {
      st.t = scene.sub.listenMode ? (st.t || 0) + dt : 0;
      return st.t >= 3;
    },
    progress(scene, st) {
      const on = scene.sub.listenMode;
      return {
        text: on ? `NASŁUCH AKTYWNY — ${Math.round(st.t || 0)} / 3 s` : 'Zatrzymaj silnik [Spacja]',
        pct: on ? Math.min((st.t || 0) / 3, 1) : 0,
      };
    },
  },

  {
    id: 'ping', step: 4, title: 'SONAR AKTYWNY',
    intro: {
      lines: [
        'Ping aktywny [Q] wysyła impuls dźwiękowy rozchodzący się na 1100px. Echa powracają i przez 5 sekund widoczne są na PPI jako jasne punkty.',
        '⚠ UWAGA: ping aktywny zdradza twoją pozycję. Każdy wróg w zasięgu słyszy impuls i namierza kierunek źródła.',
        'Używaj go gdy nie masz kontaktu pasywnego lub musisz szybko potwierdzić pozycję celu. Teraz jesteś w strefie ćwiczeń — wyślij.',
      ],
      bindings: [['Q', 'ping aktywny — cooldown 14s']],
      goal: 'Wyślij impuls sonarowy [Q]',
    },
    keys: ['Q'],
    instruction: 'Wyślij ping aktywny [Q]',
    hint: 'Obserwuj PPI — pojawi się echo kontaktu na 5 s.',
    check(scene, st) {
      if (scene._activePings?.length > 0) st.pinged = true;
      return !!st.pinged;
    },
    progress: () => ({ text: 'Naciśnij [Q]', pct: 0 }),
  },

  {
    id: 'fire', step: 5, title: 'TORPEDA MK.48',
    intro: {
      lines: [
        'Torpeda Mk.48 to główna broń ORP KONDOR. Kliknij LEWYM PRZYCISKIEM MYSZY na celu — torpeda odpala się automatycznie.',
        'Na ekranie widoczny jest celownik i punkt ołowiu (lead indicator) — wskazuje dokładnie gdzie kliknąć by trafić ruchomy cel.',
        'CEL TRENINGOWY zatrzymał się i czeka. Najedź kursorem i kliknij. [E] detonuje torpedę zdalnie w dowolnym momencie.',
      ],
      bindings: [['LPM', 'wystrzel torpedę Mk.48'], ['E', 'detonacja zdalna']],
      goal: 'Wystrzel torpedę i zatop cel treningowy',
    },
    keys: ['LPM', 'E'],
    instruction: 'Kliknij [LPM] na celu — obserwuj PPI',
    hint: '[E] detonacja zdalna. Torpeda widoczna na PPI.',
    onEnter(scene, tgt) {
      if (tgt) tgt.speed = 0;
      scene._shipLog('CEL TRENINGOWY zatrzymany — wystrzel torpedę Mk.48 klikając LPM na ekranie.', 'info');
    },
    check(scene, st, dt, tgt) {
      if (!st.fired && scene.sub.torpedoes.length > 0) st.fired = true;
      if (st.fired) st.timeout = (st.timeout || 0) + dt;
      return !!(tgt?.destroyed || (st.timeout || 0) >= 45);
    },
    progress(_s, st, _dt, tgt) {
      if (tgt?.destroyed) return { text: '✓ CEL ZATOPIONY', pct: 1 };
      if (!st.fired)      return { text: 'Kliknij LPM na cel', pct: 0 };
      const t = Math.min(st.timeout || 0, 45);
      return { text: `Torpeda aktywna — ${Math.round(45 - t)} s`, pct: 1 - t / 45 };
    },
    update(scene, st) {
      if (!st.fired && scene.sub.torpedoes.length > 0) st.fired = true;
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────

export class TutorialMission {
  constructor(scene) {
    this.scene      = scene;
    this._phase     = -1;
    this._state     = {};
    this._complete  = false;
    this._target    = null;
    this._advancing = false;
    this._inIntro   = false;

    this._introEl    = null;
    this._stepEl     = null;
    this._cardEl     = null;
    this._completeEl = null;

    this._stepKeyHandler = null;

    this._buildCSS();
    this._buildIntro();
    this._buildStepModal();
    this._buildCard();
    this._buildComplete();
  }

  start(trainingMerchant) {
    this._target = trainingMerchant;
    this._showIntro();
  }

  update(dt) {
    if (this._complete || this._phase < 0 || this._advancing || this._inIntro) return;
    const phase = PHASES[this._phase];
    if (!phase) return;

    phase.update?.(this.scene, this._state, this._target);

    if (phase.check(this.scene, this._state, dt, this._target)) {
      this._advancePhase();
    } else {
      this._updateProgress(phase);
    }
  }

  skip() {
    this._hideIntro();
    this._hideStepModal();
    this._hideCard();
    this._triggerMission();
  }

  // ── CSS ──────────────────────────────────────────────────────────────────────

  _buildCSS() {
    const s = document.createElement('style');
    s.textContent = `
      #tut-intro {
        position:absolute; inset:0;
        background:rgba(0,4,12,0.97);
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        z-index:48; font-family:'Courier New',monospace; color:#f3ede0;
        pointer-events:all; opacity:0; transition:opacity 0.45s; text-align:center;
      }
      #tut-intro.vis { opacity:1; }
      .ti-badge { font-size:9px; letter-spacing:5px; color:#44ffaa; margin-bottom:18px; opacity:0.7; }
      .ti-ttl   { font-size:24px; letter-spacing:6px; font-weight:bold; color:#f3ede0; margin-bottom:4px; }
      .ti-sub   { font-size:9px; letter-spacing:3px; color:rgba(243,237,224,0.38); margin-bottom:30px; }
      .ti-list  { list-style:none; text-align:left; display:inline-block; margin-bottom:34px; padding:0; }
      .ti-list li { font-size:11px; letter-spacing:0.5px; color:rgba(243,237,224,0.70); padding:5px 0; }
      .ti-list li::before { content:'▸ '; color:#44ffaa; }
      .ti-btn {
        background:none; border:1px solid #44ffaa; color:#44ffaa;
        font-family:'Courier New',monospace; font-size:11px; letter-spacing:4px;
        padding:11px 34px; cursor:pointer; pointer-events:all;
        transition:background 0.15s; animation:tut-pulse 1.2s ease-in-out infinite;
      }
      .ti-btn:hover { background:rgba(68,255,170,0.10); }
      .ti-skip {
        margin-top:13px; background:none; border:none;
        color:rgba(243,237,224,0.25); font-family:'Courier New',monospace;
        font-size:9px; letter-spacing:2px; cursor:pointer; pointer-events:all;
        text-decoration:underline;
      }
      .ti-skip:hover { color:rgba(243,237,224,0.50); }

      #tut-step {
        position:absolute; top:50%; left:50%;
        transform:translate(-50%,-52%) scale(0.96);
        width:520px;
        background:rgba(0,4,16,0.97);
        border:1px solid rgba(68,255,170,0.65);
        border-radius:4px;
        z-index:42; font-family:'Courier New',monospace;
        opacity:0; display:none;
        transition:opacity 0.25s, transform 0.25s;
        pointer-events:all;
        box-shadow:0 8px 40px rgba(0,0,0,0.8), 0 0 18px rgba(68,255,170,0.06);
      }
      #tut-step.vis { opacity:1; transform:translate(-50%,-50%) scale(1); }
      #ts-header {
        display:flex; align-items:baseline; gap:10px;
        padding:9px 14px 7px;
        border-bottom:1px solid rgba(68,255,170,0.12);
      }
      #ts-stepnum { font-size:9px; letter-spacing:2px; color:rgba(68,255,170,0.48); flex-shrink:0; }
      #ts-title   { font-size:13px; letter-spacing:3px; color:#44ffaa; font-weight:bold; }
      #ts-body    { padding:11px 14px 7px; }
      .ts-line {
        font-size:11px; letter-spacing:0.2px; color:rgba(243,237,224,0.80);
        line-height:1.65; margin-bottom:7px;
      }
      .ts-line:last-child { margin-bottom:0; }
      #ts-bindings {
        display:flex; flex-wrap:wrap; gap:5px;
        padding:7px 14px; border-top:1px solid rgba(68,255,170,0.08);
      }
      .ts-bind { display:flex; align-items:center; gap:5px; font-size:9px; letter-spacing:1px; color:rgba(243,237,224,0.48); }
      .tut-key {
        display:inline-block;
        background:rgba(68,255,170,0.08);
        border:1px solid rgba(68,255,170,0.38);
        border-bottom:2px solid rgba(68,255,170,0.18);
        border-radius:3px;
        font-family:'Courier New',monospace; font-size:9px; color:#44ffaa;
        padding:2px 6px; white-space:nowrap;
      }
      #ts-goal {
        display:flex; align-items:center; gap:8px;
        padding:7px 14px 8px;
        border-top:1px solid rgba(68,255,170,0.10);
        font-size:10px; letter-spacing:1.5px; color:#44ffaa;
      }
      #ts-goal::before { content:'►'; color:rgba(68,255,170,0.55); flex-shrink:0; }
      #ts-footer {
        display:flex; align-items:center; justify-content:flex-end;
        padding:7px 14px 9px;
        border-top:1px solid rgba(68,255,170,0.12);
      }
      #ts-cont-btn {
        background:none; border:1px solid #44ffaa; color:#44ffaa;
        font-family:'Courier New',monospace; font-size:10px; letter-spacing:3px;
        padding:7px 20px; cursor:pointer; pointer-events:all;
        transition:background 0.15s; animation:tut-pulse 1.2s ease-in-out infinite;
      }
      #ts-cont-btn:hover { background:rgba(68,255,170,0.10); }

      #tut-card {
        position:absolute; bottom:12px; left:12px; width:330px;
        background:rgba(0,6,18,0.93);
        border:1px solid rgba(68,255,170,0.55);
        border-radius:4px;
        z-index:35; display:none; font-family:'Courier New',monospace;
        box-shadow:0 4px 22px rgba(0,0,0,0.70), 0 0 12px rgba(68,255,170,0.06);
        transition:opacity 0.28s;
        pointer-events:none;
      }
      #tut-card.vis  { display:block; }
      #tut-card.done { border-color:#fff; animation:tut-flash 0.4s ease 4; }
      #tc-header {
        display:flex; align-items:center; gap:8px;
        padding:5px 8px 4px; border-bottom:1px solid rgba(68,255,170,0.10);
      }
      #tc-dots { display:flex; gap:4px; }
      .tc-dot {
        width:6px; height:6px; border-radius:50%;
        background:rgba(68,255,170,0.12); border:1px solid rgba(68,255,170,0.25);
        transition:background 0.3s;
      }
      .tc-dot.d-done   { background:#44ffaa; box-shadow:0 0 4px rgba(68,255,170,0.5); }
      .tc-dot.d-active { background:rgba(68,255,170,0.42); border-color:#44ffaa; }
      #tc-stepnum  { flex:1; font-size:9px; letter-spacing:2px; color:rgba(68,255,170,0.46); }
      #tc-skip-btn {
        background:none; border:none; padding:0;
        color:rgba(243,237,224,0.18); font-family:'Courier New',monospace;
        font-size:8px; letter-spacing:1px; cursor:pointer; pointer-events:all;
      }
      #tc-skip-btn:hover { color:rgba(243,237,224,0.48); }
      #tc-body { display:flex; align-items:flex-start; gap:8px; padding:8px 10px 4px; }
      #tc-keys { display:flex; flex-direction:column; gap:3px; flex-shrink:0; min-width:40px; }
      #tc-text { flex:1; min-width:0; }
      #tc-title { font-size:9px; letter-spacing:2.5px; color:rgba(68,255,170,0.68); margin-bottom:3px; }
      #tc-instr { font-size:12px; color:#f3ede0; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      #tc-hint  { font-size:8px; color:rgba(243,237,224,0.34); line-height:1.45; }
      #tc-foot  { display:flex; align-items:center; gap:8px; padding:4px 10px 8px; }
      #tc-cond  { font-size:8px; letter-spacing:1px; color:rgba(68,255,170,0.46); flex-shrink:0; min-width:110px; }
      #tc-pbar  { flex:1; height:2px; background:rgba(68,255,170,0.10); border-radius:1px; overflow:hidden; }
      #tc-pfill { height:100%; background:#44ffaa; border-radius:1px; transition:width 0.3s; width:0%; box-shadow:0 0 6px rgba(68,255,170,0.55); }

      #tut-complete {
        position:absolute; inset:0;
        background:rgba(0,6,16,0.96);
        display:none; flex-direction:column; align-items:center; justify-content:center;
        z-index:49; font-family:'Courier New',monospace; color:#f3ede0;
        pointer-events:all; opacity:0; transition:opacity 0.45s; text-align:center;
      }
      #tut-complete.vis  { display:flex; }
      #tut-complete.fade { opacity:1; }
      .tco-check { font-size:48px; color:#44ffaa; margin-bottom:16px; text-shadow:0 0 22px rgba(68,255,170,0.8); }
      .tco-title { font-size:20px; letter-spacing:8px; color:#44ffaa; margin-bottom:7px; }
      .tco-sub   { font-size:10px; letter-spacing:3px; color:rgba(243,237,224,0.46); margin-bottom:30px; }
      .tco-mis   { font-size:9px; letter-spacing:2px; color:rgba(243,237,224,0.30); margin-bottom:28px; max-width:480px; line-height:1.8; }
      .tco-btn {
        background:none; border:1px solid #44ffaa; color:#44ffaa;
        font-family:'Courier New',monospace; font-size:11px; letter-spacing:4px;
        padding:12px 38px; cursor:pointer; pointer-events:all; transition:background 0.15s;
        animation:tut-pulse 1.2s ease-in-out infinite;
      }
      .tco-btn:hover { background:rgba(68,255,170,0.10); }

      @keyframes tut-pulse {
        0%,100% { box-shadow:0 0 0 rgba(68,255,170,0); }
        50%      { box-shadow:0 0 12px rgba(68,255,170,0.4); }
      }
      @keyframes tut-flash {
        0%,100% { border-color:rgba(68,255,170,0.55); }
        50%      { border-color:#fff; }
      }
    `;
    document.getElementById('game-container').appendChild(s);
  }

  // ── Intro ────────────────────────────────────────────────────────────────────

  _buildIntro() {
    const gc = document.getElementById('game-container');
    const el = document.createElement('div');
    el.id = 'tut-intro';
    el.innerHTML = `
      <div class="ti-badge">★  SZKOLENIE TAKTYCZNE  ★</div>
      <div class="ti-ttl">ORP KONDOR — ĆWICZENIA BOJOWE</div>
      <div class="ti-sub">ATLANTYK PÓŁNOCNY  ·  PAŹDZIERNIK 1983  ·  STREFA ĆWICZEŃ C-7</div>
      <ul class="ti-list">
        <li>Sterowanie głębokością, balastem i napędem elektrycznym</li>
        <li>Termoklina — jak wykorzystać warstwę maskowania akustycznego</li>
        <li>Sonar pasywny i tryb NASŁUCH — kontakt bez wykrycia</li>
        <li>Sonar aktywny [Q] — lokalizacja i potwierdzenie pozycji celu</li>
        <li>Wystrzelenie torpedy Mk.48 — procedura bojowa</li>
      </ul>
      <button class="ti-btn" id="ti-start">▸ ROZPOCZNIJ SZKOLENIE  [Enter]</button>
      <button class="ti-skip" id="ti-skip">Pomiń szkolenie [Esc]</button>
    `;
    gc.appendChild(el);
    this._introEl = el;

    el.querySelector('#ti-start').addEventListener('click', () => this._dismissIntro());
    el.querySelector('#ti-skip').addEventListener('click',  () => this.skip());
    this._introKeyH = (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); this._dismissIntro(); }
      if (e.key === 'Escape') { this.skip(); }
    };
    window.addEventListener('keydown', this._introKeyH);
  }

  _showIntro()  { this._introEl.classList.add('vis'); }

  _hideIntro() {
    if (!this._introEl) return;
    window.removeEventListener('keydown', this._introKeyH);
    const el = this._introEl;
    this._introEl = null;
    el.style.pointerEvents = 'none';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 500);
  }

  _dismissIntro() {
    this._hideIntro();
    this._startPhase(0);
  }

  // ── Modal kroku ──────────────────────────────────────────────────────────────

  _buildStepModal() {
    const gc = document.getElementById('game-container');
    const el = document.createElement('div');
    el.id = 'tut-step';
    el.innerHTML = `
      <div id="ts-header">
        <span id="ts-stepnum">KROK 1 / ${TOTAL_STEPS}</span>
        <span id="ts-title"></span>
      </div>
      <div id="ts-body"></div>
      <div id="ts-bindings"></div>
      <div id="ts-goal"></div>
      <div id="ts-footer">
        <button id="ts-cont-btn">▸ WYKONAJ ZADANIE  [Enter]</button>
      </div>
    `;
    gc.appendChild(el);
    this._stepEl    = el;
    this._tsContBtn = el.querySelector('#ts-cont-btn');
    this._tsBody    = el.querySelector('#ts-body');
    this._tsBind    = el.querySelector('#ts-bindings');
    this._tsGoal    = el.querySelector('#ts-goal');
  }

  _showStepModal(phase) {
    this._inIntro = true;
    this.scene.scene.pause();

    const { intro } = phase;
    this._stepEl.querySelector('#ts-stepnum').textContent = `KROK ${phase.step} / ${TOTAL_STEPS}`;
    this._stepEl.querySelector('#ts-title').textContent   = phase.title;
    this._tsBody.innerHTML = intro.lines.map(l => `<p class="ts-line">${l}</p>`).join('');
    this._tsBind.innerHTML = intro.bindings.length
      ? intro.bindings.map(([k, v]) => `<div class="ts-bind"><span class="tut-key">${k}</span><span>${v}</span></div>`).join('')
      : '';
    this._tsBind.style.display = intro.bindings.length ? 'flex' : 'none';
    this._tsGoal.textContent = intro.goal;

    this._stepEl.style.display = 'block';
    requestAnimationFrame(() => requestAnimationFrame(() => this._stepEl.classList.add('vis')));

    this._stepKeyHandler = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._dismissStepModal(phase); }
    };
    window.addEventListener('keydown', this._stepKeyHandler);

    const handler = () => this._dismissStepModal(phase);
    this._tsContBtn.addEventListener('click', handler, { once: true });
    this._tsContBtnCleanup = () => this._tsContBtn.removeEventListener('click', handler);
  }

  _dismissStepModal(phase) {
    if (!this._inIntro) return;
    this._inIntro = false;
    this.scene.scene.resume();

    window.removeEventListener('keydown', this._stepKeyHandler);
    this._tsContBtnCleanup?.();

    this._stepEl.classList.remove('vis');
    setTimeout(() => { this._stepEl.style.display = 'none'; }, 280);

    phase.onEnter?.(this.scene, this._target);
    this._showCard(phase);
  }

  _hideStepModal() {
    window.removeEventListener('keydown', this._stepKeyHandler);
    this._tsContBtnCleanup?.();
    this._inIntro = false;
    this._stepEl.classList.remove('vis');
    setTimeout(() => { this._stepEl.style.display = 'none'; }, 280);
  }

  // ── Karta zadania ────────────────────────────────────────────────────────────

  _buildCard() {
    const gc = document.getElementById('game-container');
    const el = document.createElement('div');
    el.id = 'tut-card';
    el.innerHTML = `
      <div id="tc-header">
        <div id="tc-dots">${Array.from({ length: TOTAL_STEPS }, () => '<div class="tc-dot"></div>').join('')}</div>
        <span id="tc-stepnum">KROK 1 / ${TOTAL_STEPS}</span>
        <button id="tc-skip-btn">ESC pomiń</button>
      </div>
      <div id="tc-body">
        <div id="tc-keys"></div>
        <div id="tc-text">
          <div id="tc-title"></div>
          <div id="tc-instr"></div>
          <div id="tc-hint"></div>
        </div>
      </div>
      <div id="tc-foot">
        <span id="tc-cond">Czekam...</span>
        <div id="tc-pbar"><div id="tc-pfill"></div></div>
      </div>
    `;
    gc.appendChild(el);
    this._cardEl = el;

    el.querySelector('#tc-skip-btn').addEventListener('click', () => this.skip());

    this._tcDots  = Array.from(el.querySelectorAll('.tc-dot'));
    this._tcStep  = el.querySelector('#tc-stepnum');
    this._tcKeys  = el.querySelector('#tc-keys');
    this._tcTitle = el.querySelector('#tc-title');
    this._tcInstr = el.querySelector('#tc-instr');
    this._tcHint  = el.querySelector('#tc-hint');
    this._tcCond  = el.querySelector('#tc-cond');
    this._tcPfill = el.querySelector('#tc-pfill');
  }

  _showCard(phase) {
    this._tcDots.forEach((dot, i) => {
      dot.classList.remove('d-done', 'd-active');
      if (i < this._phase)       dot.classList.add('d-done');
      else if (i === this._phase) dot.classList.add('d-active');
    });
    this._tcStep.textContent  = `KROK ${phase.step} / ${TOTAL_STEPS}`;
    this._tcTitle.textContent = phase.title;
    this._tcInstr.textContent = phase.instruction;
    this._tcHint.textContent  = phase.hint;

    this._tcKeys.innerHTML = phase.keys.length
      ? phase.keys.map(k => `<span class="tut-key">${k}</span>`).join('')
      : '<span style="font-size:8px;color:rgba(68,255,170,0.26)">auto</span>';

    this._tcCond.textContent  = 'Czekam...';
    this._tcPfill.style.width = '0%';
    this._cardEl.classList.add('vis');
  }

  _hideCard() {
    if (this._cardEl) {
      this._cardEl.style.opacity = '0';
      setTimeout(() => { if (this._cardEl) this._cardEl.style.display = 'none'; }, 320);
    }
  }

  // ── Logika faz ───────────────────────────────────────────────────────────────

  _startPhase(i) {
    this._phase = i;
    this._state = {};
    this._cardEl.classList.remove('vis');
    this._showStepModal(PHASES[i]);

    const phase = PHASES[i];
    this.scene._logEvent(`SZKOLENIE — KROK ${phase.step}/${TOTAL_STEPS}: ${phase.title}`);
    this.scene._shipLog(
      i === 0
        ? 'SZKOLENIE TAKTYCZNE: Czytaj instrukcje i wykonuj zadania krok po kroku.'
        : `Krok ${phase.step}: ${phase.instruction}`,
      'info'
    );
  }

  _updateProgress(phase) {
    const prog = phase.progress?.(this.scene, this._state, 0, this._target);
    if (!prog) return;

    if (prog.text) {
      this._tcCond.textContent = prog.text;
    } else if (prog.cur !== undefined) {
      this._tcCond.textContent = `${prog.cur} / ${prog.max} ${prog.unit}`;
    }
    if (prog.pct !== undefined) {
      this._tcPfill.style.width = `${Math.round(prog.pct * 100)}%`;
    }
  }

  _advancePhase() {
    this._advancing = true;
    const name = PHASES[this._phase]?.title ?? '';

    this._cardEl.classList.add('done');
    this._tcCond.textContent  = '✓ WYKONANE';
    this._tcPfill.style.width = '100%';
    this.scene._logEvent(`✓ KROK ${this._phase + 1}/${TOTAL_STEPS} — ${name}`);

    setTimeout(() => {
      this._cardEl.classList.remove('done', 'vis');
      this._advancing = false;

      const next = this._phase + 1;
      if (next >= PHASES.length) {
        this._complete = true;
        this._showCompletion();
      } else {
        this._startPhase(next);
      }
    }, 1100);
  }

  // ── Ekran zakończenia ────────────────────────────────────────────────────────

  _buildComplete() {
    const gc = document.getElementById('game-container');
    const el = document.createElement('div');
    el.id = 'tut-complete';
    el.innerHTML = `
      <div class="tco-check">✓</div>
      <div class="tco-title">SZKOLENIE ZAKOŃCZONE</div>
      <div class="tco-sub">KWALIFIKACJA TAKTYCZNA — ZALICZONA</div>
      <div class="tco-mis">
        ROZKAZ OPERACYJNY — OPERACJA NEPTUN<br>
        Sowiecki niszczyciel BPK «NIEUSTRASZONY» przechwycony na ŁB-22/N.<br>
        Cel: eliminacja przed wejściem w strefę ochronną. Cisza radiowa.
      </div>
      <button class="tco-btn" id="tco-btn">▸ PRZYSTĄP DO MISJI  [Enter]</button>
    `;
    gc.appendChild(el);
    this._completeEl = el;

    el.querySelector('#tco-btn').addEventListener('click', () => this._triggerMission());
    this._completeKeyH = (e) => { if (e.key === 'Enter') { e.preventDefault(); this._triggerMission(); } };
  }

  _showCompletion() {
    const el = this._completeEl;
    el.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('fade')));
    window.addEventListener('keydown', this._completeKeyH);
    this.scene._shipLog('SZKOLENIE ZAKOŃCZONE — Kwalifikacja taktyczna zaliczona. Oczekuj rozkazów bojowych.', 'good');
    this.scene._logEvent('SZKOLENIE: Wszystkie procedury wykonane poprawnie.');
  }

  _triggerMission() {
    window.removeEventListener('keydown', this._completeKeyH);
    if (this._completeEl) {
      const el = this._completeEl;
      this._completeEl = null;
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 500);
    }
    this.scene._startMission1Combat();
  }
}
