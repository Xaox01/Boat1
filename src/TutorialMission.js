// Samouczek — 7 kroków. Każdy krok: ekran wyjaśnienia → zadanie (zamknięcie tylko po wykonaniu).

const TOTAL_STEPS = 7;

const PHASES = [
  {
    id: 'dive', step: 1, title: 'ZANURZENIE',
    intro: {
      lines: [
        'Okręt podwodny zanurza się napełniając zbiorniki balastowe wodą morską — ciężar wzrasta i łódź opada.',
        'Klawisz [S] napełnia zbiorniki (zanurzenie). Klawisz [W] wypompowuje wodę (wynurzenie).',
        'Wskaźnik GŁĘBOKOŚĆ w górnym pasku HUD pokazuje aktualną głębokość w metrach.',
      ],
      bindings: [['S', 'zanurz'], ['W', 'wynurz']],
      goal: 'Zanurz się poniżej 60 metrów',
    },
    keys: ['S'],
    instruction: 'Przytrzymaj [S] — zanurz poniżej 60 m',
    hint: 'Obserwuj wskaźnik GŁĘBOKOŚĆ w górnym pasku.',
    check: (scene) => scene.sub.depthMetres >= 60,
    progress: (scene) => ({
      cur: Math.round(scene.sub.depthMetres), max: 60, unit: 'm',
      pct: Math.min(scene.sub.depthMetres / 60, 1),
    }),
  },
  {
    id: 'move', step: 2, title: 'NAPĘD ELEKTRYCZNY',
    intro: {
      lines: [
        'ORP ORZEŁ napędzany jest cichymi silnikami elektrycznymi zasilanymi bateriami. Cichy napęd to kluczowa przewaga — hałas zdradza pozycję sonarom wroga.',
        '[D] — naprzód powoli.  [Shift+D] — pełna moc, ale więcej hałasu i szybsze zużycie baterii.',
        'Wskaźnik HAŁAS w HUD pokazuje twoją akustyczną sygnaturę. Im ciszej, tym trudniej cię wykryć.',
      ],
      bindings: [['D', 'naprzód'], ['A', 'wstecz'], ['Shift', 'pełna moc']],
      goal: 'Utrzymaj prędkość ≥ 30 px/s przez 3 sekundy',
    },
    keys: ['D', 'Shift'],
    instruction: 'Rusz naprzód — utrzymaj prędkość przez 3 s',
    hint: '[Shift+D] dla pełnej mocy. Kieruj się na WSCHÓD.',
    check(scene, st, dt) {
      const spd = Math.hypot(scene.sub.vx, scene.sub.vy);
      st.t = spd >= 30 ? (st.t || 0) + dt : Math.max(0, (st.t || 0) - dt * 0.5);
      return st.t >= 3;
    },
    progress(scene, st) {
      const spd = Math.hypot(scene.sub.vx, scene.sub.vy);
      const extra = (st.t || 0) > 0.2 ? `  ${Math.min(Math.round(st.t), 3)}/3 s` : '';
      return { cur: Math.round(spd), max: 30, unit: 'px/s', pct: Math.min(spd / 30, 1), extra };
    },
  },
  {
    id: 'listen', step: 3, title: 'TRYB NASŁUCH',
    intro: {
      lines: [
        'Tryb NASŁUCH aktywuje się gdy okręt prawie stoi. Zasięg sonarów pasywnych rośnie 1,6×. Na PPI pojawia się pulsujący pierścień.',
        'W trybie NASŁUCH możesz precyzyjnie namierzać kontakty bez emitowania żadnego sygnału — niezauważony i czujny.',
        '[Spacja] zatrzymuje silnik. Poczekaj kilka sekund aż prędkość spadnie i NASŁUCH aktywuje się sam.',
      ],
      bindings: [['Spacja', 'zatrzymaj / uruchom silnik']],
      goal: 'Pozostań w trybie NASŁUCH przez 4 sekundy',
    },
    keys: ['Spacja'],
    instruction: 'Naciśnij [Spacja] i czekaj na NASŁUCH',
    hint: 'Poczekaj aż prędkość spadnie — NASŁUCH aktywuje się.',
    check(scene, st, dt) {
      st.t = scene.sub.listenMode ? (st.t || 0) + dt : 0;
      return st.t >= 4;
    },
    progress(scene, st) {
      const on = scene.sub.listenMode;
      return {
        text: on ? `NASŁUCH AKTYWNY — ${Math.round(st.t || 0)} / 4 s` : 'Zatrzymaj silnik [Spacja]',
        pct: on ? Math.min((st.t || 0) / 4, 1) : 0,
      };
    },
  },
  {
    id: 'ping', step: 4, title: 'AKTYWNY SONAR',
    intro: {
      lines: [
        'Aktywny sonar [Q] wysyła impuls dźwiękowy rozchodzący się na 1100 px. Echa powracają i przez 5 sekund widać je na PPI jako jasne punkty.',
        '⚠  UWAGA: ping aktywny zdradza twoją pozycję. Każdy wróg w zasięgu natychmiast wie gdzie jesteś.',
        'Teraz jesteśmy w bezpiecznej strefie ćwiczeń — wyślij ping aby zobaczyć jak działa PPI.',
      ],
      bindings: [['Q', 'ping aktywny — cooldown 14 s']],
      goal: 'Naciśnij [Q] aby wysłać impuls sonarowy',
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
    id: 'classify', step: 5, title: 'IDENTYFIKACJA CELU',
    intro: {
      lines: [
        'DEMON waterfall (prawy panel) analizuje widmo akustyczne wody. Każdy okręt emituje unikalne linie tonalne — swoją "akustyczną sygnaturę".',
        'Statek handlowy ma charakterystyczne linie w okolicach 6–12 Hz. Gdy DEMON je rozpozna, status kontaktu zmienia się: UNK → SURFACE → MERCHANT.',
        'Tryb NASŁUCH [Spacja] przyspiesza klasyfikację 2×. Status widoczny w lewym panelu (KLASIF) i na kole PPI jako kolor plamki.',
      ],
      bindings: [['Spacja', 'NASŁUCH — 2× szybsza klasyfikacja']],
      goal: 'Poczekaj na zmianę statusu kontaktu: UNK → SURFACE',
    },
    keys: ['Spacja'],
    instruction: 'Obserwuj KLASIF — cel zostanie zidentyfikowany',
    hint: '[Spacja] dla trybu NASŁUCH — klasyfikacja szybsza 2×.',
    onEnter(_s, tgt) {
      // Daj head-start aby klasyfikacja nie trwała zbyt długo
      if (tgt) tgt.classifyTimer = Math.max(tgt.classifyTimer || 0, 6);
    },
    check: (_s, _st, _dt, tgt) => tgt?.contactClass === 'SURFACE' || tgt?.contactClass === 'MERCHANT',
    progress: (_s, _st, _dt, tgt) => {
      const done = tgt?.contactClass === 'SURFACE' || tgt?.contactClass === 'MERCHANT';
      return {
        text: done ? `✓ KLASYFIKACJA: ${tgt.contactClass}` : `Analizuję... ${tgt?.contactClass ?? 'UNK'}`,
        pct: done ? 1 : Math.min((tgt?.classifyTimer || 0) / 12, 0.95),
      };
    },
  },
  {
    id: 'fire', step: 6, title: 'TORPEDA MK.48',
    intro: {
      lines: [
        'Torpeda Mk.48 to główna broń ORP ORZEŁ. Najedź kursorem na cel i kliknij LEWYM PRZYCISKIEM MYSZY — torpeda poleci w tym kierunku.',
        'Na ekranie widać celownik i punkt ołowiu (lead indicator) — pokazuje gdzie kliknąć aby trafić ruchomy cel. CEL TRENINGOWY zatrzymał się i czeka.',
        '[E] detonuje torpedę zdalnie w dowolnym momencie. [PPM] odpala rakietę p/okrętową (do celów nawodnych).',
      ],
      bindings: [['LPM', 'wystrzel torpedę Mk.48'], ['E', 'detonacja zdalna'], ['PPM', 'rakieta p/okrętowa']],
      goal: 'Wystrzel torpedę Mk.48 klikając na cel',
    },
    keys: ['LPM'],
    instruction: 'Kliknij [LPM] na celu treningowym',
    hint: 'Cel czeka nieruchomo — najedź kursorem i kliknij.',
    onEnter(scene, tgt) {
      if (tgt) tgt.speed = 0;
      scene._shipLog('CEL TRENINGOWY zatrzymany — wystrzel torpedę Mk.48 klikając LPM.', 'info');
    },
    check: (_s, st) => !!st.fired,
    progress: () => ({ text: 'Kliknij LPM na cel', pct: 0 }),
    update(scene, st) {
      if (!st.fired && scene.sub.torpedoes.length > 0) st.fired = true;
    },
  },
  {
    id: 'hit', step: 7, title: 'TORPEDA W DRODZE',
    intro: {
      lines: [
        'Torpeda jest w drodze! Naprowadza się akustycznie na sygnaturę celu gdy znajdzie się w zasięgu 240 px.',
        '[E] detonuje torpedę zdalnie — gdy mija cel lub chcesz kontrolować moment wybuchu.',
        'Śledź torpedę na kole PPI (sonar) — widać ją jako szybko poruszający się punkt. Ćwiczenie kończy się po trafieniu lub 45 s.',
      ],
      bindings: [['E', 'detonacja zdalna torpedy'], ['Q', 'ping aktywny — torpeda na PPI']],
      goal: 'Poczekaj aż torpeda trafi w cel',
    },
    keys: ['E'],
    instruction: 'Obserwuj PPI — torpeda szuka celu',
    hint: '[E] detonacja zdalna. Torpeda widoczna na kole PPI.',
    check(scene, st, dt, tgt) {
      st.timeout = (st.timeout || 0) + dt;
      return tgt?.destroyed || st.timeout >= 45;
    },
    progress(_s, st, _dt, tgt) {
      if (tgt?.destroyed) return { text: '✓ CEL ZATOPIONY', pct: 1 };
      const t = Math.min(st.timeout || 0, 45);
      return { text: `Torpeda aktywna — ${Math.round(45 - t)} s`, pct: 1 - t / 45 };
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
    this._inIntro   = false;  // true = wyświetlamy ekran wyjaśnienia, nie sprawdzamy warunku

    this._introEl     = null;  // pełnoekranowe intro startowe
    this._stepEl      = null;  // modal wyjaśnienia kroku
    this._cardEl      = null;  // karta zadania (lewy dolny róg)
    this._completeEl  = null;  // ekran zakończenia

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

  // ── Budowanie elementów DOM ──────────────────────────────────────────────

  _buildCSS() {
    const s = document.createElement('style');
    s.textContent = `
      /* ── Startowe intro ── */
      #tut-intro {
        position:absolute; inset:0;
        background:rgba(0,5,14,0.96);
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        z-index:48; font-family:'Courier New',monospace; color:#f3ede0;
        pointer-events:all; opacity:0; transition:opacity 0.5s; text-align:center;
      }
      #tut-intro.vis { opacity:1; }
      .ti-eye  { font-size:10px; letter-spacing:5px; color:#44ffaa; margin-bottom:20px; }
      .ti-ttl  { font-size:26px; letter-spacing:6px; font-weight:bold; color:#f3ede0; margin-bottom:6px; }
      .ti-sub  { font-size:10px; letter-spacing:3px; color:rgba(243,237,224,0.42); margin-bottom:32px; }
      .ti-list { list-style:none; text-align:left; display:inline-block; margin-bottom:36px; padding:0; }
      .ti-list li { font-size:12px; letter-spacing:1px; color:rgba(243,237,224,0.75); padding:5px 0; }
      .ti-list li::before { content:'▸ '; color:#44ffaa; }
      .ti-btn {
        background:none; border:1px solid #44ffaa; color:#44ffaa;
        font-family:'Courier New',monospace; font-size:12px; letter-spacing:4px;
        padding:12px 36px; cursor:pointer; pointer-events:all;
        transition:background 0.15s; animation:tut-pulse 1.2s ease-in-out infinite;
      }
      .ti-btn:hover { background:rgba(68,255,170,0.1); }
      .ti-skip {
        margin-top:14px; background:none; border:none;
        color:rgba(243,237,224,0.28); font-family:'Courier New',monospace;
        font-size:9px; letter-spacing:2px; cursor:pointer; pointer-events:all; text-decoration:underline;
      }
      .ti-skip:hover { color:rgba(243,237,224,0.55); }

      /* ── Modal wyjaśnienia kroku ── */
      #tut-step {
        position:absolute; top:50%; left:50%;
        transform:translate(-50%,-52%) scale(0.96);
        width:530px;
        background:rgba(0,5,16,0.97);
        border:1px solid rgba(68,255,170,0.7);
        border-radius:4px;
        z-index:42; font-family:'Courier New',monospace;
        opacity:0; display:none;
        transition:opacity 0.28s, transform 0.28s;
        pointer-events:all;
        box-shadow:0 8px 40px rgba(0,0,0,0.8), 0 0 20px rgba(68,255,170,0.07);
      }
      #tut-step.vis {
        opacity:1;
        transform:translate(-50%,-50%) scale(1);
      }
      #ts-header {
        display:flex; align-items:baseline; gap:10px;
        padding:10px 14px 8px;
        border-bottom:1px solid rgba(68,255,170,0.12);
      }
      #ts-stepnum { font-size:9px; letter-spacing:2px; color:rgba(68,255,170,0.5); flex-shrink:0; }
      #ts-title   { font-size:13px; letter-spacing:3px; color:#44ffaa; font-weight:bold; }

      #ts-body { padding:12px 14px 8px; }
      .ts-line {
        font-size:11px; letter-spacing:0.3px; color:rgba(243,237,224,0.82);
        line-height:1.6; margin-bottom:7px;
      }
      .ts-line:last-child { margin-bottom:0; }

      #ts-bindings {
        display:flex; flex-wrap:wrap; gap:6px;
        padding:8px 14px; border-top:1px solid rgba(68,255,170,0.08);
      }
      .ts-bind {
        display:flex; align-items:center; gap:5px;
        font-size:9px; letter-spacing:1px; color:rgba(243,237,224,0.5);
      }
      .tut-key {
        display:inline-block;
        background:rgba(68,255,170,0.08);
        border:1px solid rgba(68,255,170,0.4);
        border-bottom:2px solid rgba(68,255,170,0.2);
        border-radius:3px;
        font-family:'Courier New',monospace; font-size:9px; color:#44ffaa;
        padding:2px 6px; white-space:nowrap;
      }

      #ts-goal {
        display:flex; align-items:center; gap:8px;
        padding:8px 14px 9px;
        border-top:1px solid rgba(68,255,170,0.1);
        font-size:10px; letter-spacing:1.5px; color:#44ffaa;
      }
      #ts-goal::before { content:'►'; color:rgba(68,255,170,0.6); flex-shrink:0; }

      #ts-footer {
        display:flex; align-items:center; justify-content:flex-end;
        padding:8px 14px 10px;
        border-top:1px solid rgba(68,255,170,0.12);
      }
      #ts-cont-btn {
        background:none; border:1px solid #44ffaa; color:#44ffaa;
        font-family:'Courier New',monospace; font-size:10px; letter-spacing:3px;
        padding:7px 20px; cursor:pointer; pointer-events:all;
        transition:background 0.15s; animation:tut-pulse 1.2s ease-in-out infinite;
      }
      #ts-cont-btn:hover { background:rgba(68,255,170,0.1); }

      /* ── Karta zadania (lewy dolny róg) ── */
      #tut-card {
        position:absolute; bottom:12px; left:12px; width:340px;
        background:rgba(0,8,20,0.92);
        border:1px solid rgba(68,255,170,0.6);
        border-radius:4px;
        z-index:35; display:none; font-family:'Courier New',monospace;
        box-shadow:0 4px 24px rgba(0,0,0,0.7), 0 0 14px rgba(68,255,170,0.07);
        transition:opacity 0.3s;
        pointer-events:none;
      }
      #tut-card.vis  { display:block; }
      #tut-card.done { border-color:#fff; animation:tut-flash 0.4s ease 4; }

      #tc-header {
        display:flex; align-items:center; gap:8px;
        padding:6px 8px 5px; border-bottom:1px solid rgba(68,255,170,0.12);
      }
      #tc-dots { display:flex; gap:4px; }
      .tc-dot {
        width:6px; height:6px; border-radius:50%;
        background:rgba(68,255,170,0.13); border:1px solid rgba(68,255,170,0.27);
        transition:background 0.3s;
      }
      .tc-dot.d-done   { background:#44ffaa; box-shadow:0 0 4px rgba(68,255,170,0.5); }
      .tc-dot.d-active { background:rgba(68,255,170,0.45); border-color:#44ffaa; }
      #tc-stepnum  { flex:1; font-size:9px; letter-spacing:2px; color:rgba(68,255,170,0.48); }
      #tc-skip-btn {
        background:none; border:none; padding:0;
        color:rgba(243,237,224,0.2); font-family:'Courier New',monospace;
        font-size:8px; letter-spacing:1px; cursor:pointer; pointer-events:all;
      }
      #tc-skip-btn:hover { color:rgba(243,237,224,0.5); }

      #tc-body { display:flex; align-items:flex-start; gap:8px; padding:8px 10px 4px; }
      #tc-keys { display:flex; flex-direction:column; gap:3px; flex-shrink:0; min-width:40px; }
      #tc-text { flex:1; min-width:0; }
      #tc-title { font-size:9px; letter-spacing:2.5px; color:rgba(68,255,170,0.7); margin-bottom:3px; }
      #tc-instr { font-size:12px; color:#f3ede0; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      #tc-hint  { font-size:8px; color:rgba(243,237,224,0.36); line-height:1.45; }

      #tc-foot { display:flex; align-items:center; gap:8px; padding:4px 10px 8px; }
      #tc-cond  { font-size:8px; letter-spacing:1px; color:rgba(68,255,170,0.48); flex-shrink:0; min-width:110px; }
      #tc-pbar  { flex:1; height:2px; background:rgba(68,255,170,0.1); border-radius:1px; overflow:hidden; }
      #tc-pfill { height:100%; background:#44ffaa; border-radius:1px; transition:width 0.3s; width:0%; box-shadow:0 0 6px rgba(68,255,170,0.6); }

      /* ── Ekran zakończenia ── */
      #tut-complete {
        position:absolute; inset:0;
        background:rgba(0,8,18,0.95);
        display:none; flex-direction:column; align-items:center; justify-content:center;
        z-index:49; font-family:'Courier New',monospace; color:#f3ede0;
        pointer-events:all; opacity:0; transition:opacity 0.5s; text-align:center;
      }
      #tut-complete.vis  { display:flex; }
      #tut-complete.fade { opacity:1; }
      .tco-check { font-size:52px; color:#44ffaa; margin-bottom:18px; text-shadow:0 0 24px rgba(68,255,170,0.8); }
      .tco-title { font-size:22px; letter-spacing:8px; color:#44ffaa; margin-bottom:8px; }
      .tco-sub   { font-size:10px; letter-spacing:3px; color:rgba(243,237,224,0.5); margin-bottom:32px; }
      .tco-btn {
        background:none; border:1px solid #44ffaa; color:#44ffaa;
        font-family:'Courier New',monospace; font-size:12px; letter-spacing:4px;
        padding:13px 40px; cursor:pointer; pointer-events:all; transition:background 0.15s;
      }
      .tco-btn:hover { background:rgba(68,255,170,0.1); }

      @keyframes tut-pulse {
        0%,100% { box-shadow:0 0 0 rgba(68,255,170,0); }
        50%      { box-shadow:0 0 12px rgba(68,255,170,0.4); }
      }
      @keyframes tut-flash {
        0%,100% { border-color:rgba(68,255,170,0.6); }
        50%      { border-color:#fff; }
      }
    `;
    document.getElementById('game-container').appendChild(s);
  }

  _buildIntro() {
    const gc = document.getElementById('game-container');
    const el = document.createElement('div');
    el.id = 'tut-intro';
    el.innerHTML = `
      <div class="ti-eye">★  SZKOLENIE TAKTYCZNE  ★</div>
      <div class="ti-ttl">ORP ORZEŁ — ĆWICZENIA BOJOWE</div>
      <div class="ti-sub">ATLANTYK PÓŁNOCNY  ·  WRZESIEŃ 1983  ·  STREFA ĆWICZEŃ</div>
      <ul class="ti-list">
        <li>Kontrola głębokości i napędu elektrycznego</li>
        <li>Pasywny sonar i tryb NASŁUCH</li>
        <li>Aktywny ping i identyfikacja celów na DEMON</li>
        <li>Wystrzelenie torpedy Mk.48</li>
      </ul>
      <button class="ti-btn" id="ti-start">▸ ROZPOCZNIJ SZKOLENIE  [Enter]</button>
      <button class="ti-skip" id="ti-skip">Pomiń samouczek [Esc]</button>
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

  _buildStepModal() {
    const gc = document.getElementById('game-container');
    const el = document.createElement('div');
    el.id = 'tut-step';
    el.innerHTML = `
      <div id="ts-header">
        <span id="ts-stepnum">KROK 1 / 7</span>
        <span id="ts-title">ZANURZENIE</span>
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

  _buildComplete() {
    const gc = document.getElementById('game-container');
    const el = document.createElement('div');
    el.id = 'tut-complete';
    el.innerHTML = `
      <div class="tco-check">✓</div>
      <div class="tco-title">SZKOLENIE ZAKOŃCZONE</div>
      <div class="tco-sub">KWALIFIKACJA TAKTYCZNA — ZALICZONA</div>
      <button class="tco-btn" id="tco-btn">▸ ROZPOCZNIJ MISJĘ BOJOWĄ  [Enter]</button>
    `;
    gc.appendChild(el);
    this._completeEl = el;

    el.querySelector('#tco-btn').addEventListener('click', () => this._triggerMission());
    this._completeKeyH = (e) => { if (e.key === 'Enter') { e.preventDefault(); this._triggerMission(); } };
  }

  // ── Startowe intro ───────────────────────────────────────────────────────

  _showIntro() { this._introEl.classList.add('vis'); }

  _hideIntro() {
    if (!this._introEl) return;
    window.removeEventListener('keydown', this._introKeyH);
    const el = this._introEl;
    this._introEl = null;
    el.style.pointerEvents = 'none';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 550);
  }

  _dismissIntro() {
    this._hideIntro();
    this._startPhase(0);
  }

  // ── Modal wyjaśnienia kroku ──────────────────────────────────────────────

  _showStepModal(phase) {
    this._inIntro = true;
    this.scene.scene.pause();

    // Wypełnij treść
    const { intro } = phase;
    this._stepEl.querySelector('#ts-stepnum').textContent = `KROK ${phase.step} / ${TOTAL_STEPS}`;
    this._stepEl.querySelector('#ts-title').textContent   = phase.title;
    this._tsBody.innerHTML = intro.lines.map(l => `<p class="ts-line">${l}</p>`).join('');
    this._tsBind.innerHTML = intro.bindings.length
      ? intro.bindings.map(([k, v]) => `<div class="ts-bind"><span class="tut-key">${k}</span><span>${v}</span></div>`).join('')
      : '';
    this._tsBind.style.display = intro.bindings.length ? 'flex' : 'none';
    this._tsGoal.textContent = intro.goal;

    // Pokaż modal
    this._stepEl.style.display = 'block';
    requestAnimationFrame(() => requestAnimationFrame(() => this._stepEl.classList.add('vis')));

    // Enter/Space lub kliknięcie przycisku — tylko gracz zamyka
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
    setTimeout(() => { this._stepEl.style.display = 'none'; }, 300);

    phase.onEnter?.(this.scene, this._target);
    this._showCard(phase);
  }

  _hideStepModal() {
    window.removeEventListener('keydown', this._stepKeyHandler);
    this._tsContBtnCleanup?.();
    this._inIntro = false;
    this._stepEl.classList.remove('vis');
    setTimeout(() => { this._stepEl.style.display = 'none'; }, 300);
  }

  // ── Karta zadania ────────────────────────────────────────────────────────

  _showCard(phase) {
    this._tcDots.forEach((dot, i) => {
      dot.classList.remove('d-done', 'd-active');
      if (i < this._phase)      dot.classList.add('d-done');
      else if (i === this._phase) dot.classList.add('d-active');
    });
    this._tcStep.textContent  = `KROK ${phase.step} / ${TOTAL_STEPS}`;
    this._tcTitle.textContent = phase.title;
    this._tcInstr.textContent = phase.instruction;
    this._tcHint.textContent  = phase.hint;

    this._tcKeys.innerHTML = phase.keys.length
      ? phase.keys.map(k => `<span class="tut-key">${k}</span>`).join('')
      : '<span style="font-size:8px;color:rgba(68,255,170,0.28)">auto</span>';

    this._tcCond.textContent  = 'Czekam...';
    this._tcPfill.style.width = '0%';

    this._cardEl.classList.add('vis');
  }

  _hideCard() {
    if (this._cardEl) {
      this._cardEl.style.opacity = '0';
      setTimeout(() => { if (this._cardEl) this._cardEl.style.display = 'none'; }, 350);
    }
  }

  // ── Logika faz ───────────────────────────────────────────────────────────

  _startPhase(i) {
    this._phase = i;
    this._state = {};
    // Najpierw ukryj kartę (może być widoczna z poprzedniej fazy)
    this._cardEl.classList.remove('vis');
    // Pokaż modal wyjaśnienia
    this._showStepModal(PHASES[i]);

    const phase = PHASES[i];
    this.scene._logEvent(`SZKOLENIE — KROK ${phase.step}/${TOTAL_STEPS}: ${phase.title}`);
    if (i > 0) {
      this.scene._shipLog(`Krok ${phase.step}: ${phase.instruction}`, 'info');
    } else {
      this.scene._shipLog('SZKOLENIE TAKTYCZNE: Czytaj instrukcje i wykonuj zadania krok po kroku.', 'info');
    }
  }

  _updateProgress(phase) {
    const prog = phase.progress?.(this.scene, this._state, 0, this._target);
    if (!prog) return;

    if (prog.text) {
      this._tcCond.textContent = prog.text;
    } else if (prog.cur !== undefined) {
      const extra = prog.extra ? `  ${prog.extra}` : '';
      this._tcCond.textContent = `${prog.cur} / ${prog.max} ${prog.unit}${extra}`;
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
      this._cardEl.classList.remove('done');
      this._cardEl.classList.remove('vis');
      this._advancing = false;

      const next = this._phase + 1;
      if (next >= PHASES.length) {
        this._complete = true;
        this._showCompletion();
      } else {
        this._startPhase(next);
      }
    }, 1200);
  }

  // ── Ekran zakończenia ────────────────────────────────────────────────────

  _showCompletion() {
    const el = this._completeEl;
    el.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('fade')));
    window.addEventListener('keydown', this._completeKeyH);
    this.scene._shipLog('SZKOLENIE ZAKOŃCZONE — Kwalifikacja taktyczna zaliczona.', 'good');
    this.scene._logEvent('SZKOLENIE: Wszystkie procedury wykonane poprawnie.');
  }

  _triggerMission() {
    window.removeEventListener('keydown', this._completeKeyH);
    if (this._completeEl) {
      const el = this._completeEl;
      this._completeEl = null;
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 550);
    }
    this.scene._startMission1Combat();
  }
}
