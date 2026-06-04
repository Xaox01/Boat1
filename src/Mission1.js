// MISJA 1 — OBIEKT K-7: ŚLEDZENIE
// Морское Норвежское — listopad 1983
// К-481 (klasa Victor III) vs USS DALLAS (klasa Los Angeles)
// ABLE ARCHER 83 — najpoważniejszy kryzys nuklearny od Kuby

import { Enemy, STATE } from './Enemy.js';
import Phaser from 'phaser';

const WORLD_W    = 12000;
const TOTAL_STEPS = 7;

// ── Fazy misji ────────────────────────────────────────────────────────────────

const PHASES = [
  {
    id: 'dive', step: 1, title: 'ZANURZENIE BOJOWE',
    intro: {
      lines: [
        'Towarzyszu Komandorze — rozkaz Флота jest jasny. Американский okręt podwodny, klasa Los Angeles, wykryty w kwadracie NW-7. Kryptonim operacji: OBIEKT K-7.',
        '[S] napełnia zbiorniki balastowe — К-481 opada. [W] — wynurzenie. [D] — silnik naprzód, [Shift+D] — pełna moc. Wskaźniki GŁĘBOKOŚĆ i HAŁAS w panelu HUD.',
        'Musimy zniknąć z zasięgu radaru NATO zanim KONTAKT ALFA nas zlokalizuje.',
      ],
      bindings: [['S/W', 'zanurzenie / wynurzenie'], ['D/A', 'naprzód / wstecz'], ['Shift+D', 'pełna moc']],
      goal: 'Zanurz się do 50m i osiągnij prędkość ≥ 20 px/s',
    },
    instruction: '[S] zanurz · [Shift+D] pełna moc',
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
      if (dOk && sOk) return { text: '✓ ZANURZONO', pct: 1 };
      const parts = [];
      if (!dOk) parts.push(`gł. ${Math.round(scene.sub.depthMetres)}/50m`);
      if (!sOk) parts.push(`prędkość ${Math.round(spd)}/20`);
      return { text: parts.join('  ·  '), pct: (dOk ? 0.5 : 0) + (sOk ? 0.5 : 0) };
    },
    onComplete(scene) {
      scene._shipLog('[ZAMPOLIT] Zanurzamy. Towarzyszu Komandorze — Moskwa śledzi naszą pozycję.', 'warn');
    },
  },

  {
    id: 'thermo', step: 2, title: 'WARSTWA IZOTERMICZNA',
    intro: {
      lines: [
        'Na głębokości ~200m przebiega termoklina — granica między ciepłą i zimną wodą. Dźwięk słabo przez nią przechodzi.',
        'Poniżej termokliny sonary NATO są czterokrotnie słabsze. Jesteśmy niewidzialni — to nasza jedyna przewaga w tej grze.',
        'Przytrzymaj [S] i zejdź poniżej 200m. Obserwuj wskaźnik HAŁAS — przy termoklinie kolor się zmieni.',
      ],
      bindings: [['S', 'zanurz głębiej']],
      goal: 'Zejdź poniżej termokliny (> 200m)',
    },
    instruction: '[S] — poniżej 200m',
    check: (scene) => scene.sub.depthMetres > 200,
    progress: (scene) => ({
      cur: Math.round(scene.sub.depthMetres), max: 200, unit: 'm',
      pct: Math.min(scene.sub.depthMetres / 200, 1),
    }),
    onComplete(scene) {
      scene._shipLog('[HYDROAK.] Termoklina przejdzona. Sonary NATO tracą nas z oczu.', 'good');
    },
  },

  {
    id: 'listen', step: 3, title: 'TRYB NASŁUCH',
    intro: {
      lines: [
        'Hydroakustyk melduje szum śrub na namurale 127°. Identyfikacja nieznana — musimy słuchać.',
        'Zatrzymaj silniki [Spacja]. Gdy prędkość spadnie, К-481 przechodzi w tryb NASŁUCH — zasięg sonarów pasywnych rośnie 1.6×.',
        'W ciszy słyszysz wszystko. Wróg też może słyszeć ciebie.',
      ],
      bindings: [['Spacja', 'stop silnika']],
      goal: 'Utrzymaj tryb NASŁUCH przez 3 sekundy',
    },
    instruction: '[Spacja] — zatrzymaj silnik, czekaj na NASŁUCH',
    check(scene, st, dt) {
      st.t = scene.sub.listenMode ? (st.t || 0) + dt : 0;
      return st.t >= 3;
    },
    progress(scene, st) {
      const on = scene.sub.listenMode;
      return {
        text: on ? `NASŁUCH — ${Math.round(st.t || 0)} / 3 s` : 'Zatrzymaj silnik [Spacja]',
        pct: on ? Math.min((st.t || 0) / 3, 1) : 0,
      };
    },
    onComplete(scene) {
      scene._shipLog('[HYDROAK.] Kontakt potwierdzony! Namiar 127°, prędkość ~12 węzłów. Klasa — nieznana. Czeka na identyfikację.', 'warn');
      scene._logEvent('KONTAKT BIERNY — namiar 127°. Identyfikacja w toku.');
    },
  },

  {
    id: 'zampolit', step: 4, title: 'MELDUNEK ZAMPOLITA',
    intro: {
      lines: [
        'PILNA DEPESZA Z GRU — 03:47 UTC. Ćwiczenia NATO ABLE ARCHER 83 osiągnęły etap DEFCON 2.',
        'Analitycy oceniają z 70% prawdopodobieństwem, że to nie ćwiczenia. Штаб требует: wprowadzić К-481 w pozycję ogniową.',
        'Zampolit wchodzi na mostek. Czeka na twoją odpowiedź.',
      ],
      bindings: [],
      goal: 'Odpowiedz zampolite — twój wybór zostanie zapamiętany',
    },
    instruction: 'Odpowiedz zampolite...',
    check(_s, st) { return !!st.answered; },
    progress(_s, st) {
      return { text: st.answered ? '✓ ODPOWIEDŹ ZŁOŻONA' : 'Czekanie na odpowiedź...', pct: st.answered ? 1 : 0 };
    },
  },

  {
    id: 'ping', step: 5, title: 'IDENTYFIKACJA KONTAKTU',
    intro: {
      lines: [
        'GRU wymaga potwierdzenia klasy okrętu. Sonar pasywny nie wystarczy do identyfikacji.',
        'Klawisz [Q] wysyła aktywny impuls sonarowy — echo ujawni klasę KONTAKTU ALFA.',
        '⚠ UWAGA: aktywny sonar zdradza naszą pozycję. KONTAKT ALFA dowie się gdzie jesteśmy.',
      ],
      bindings: [['Q', 'sonar aktywny — jeden impuls']],
      goal: 'Wyślij ping [Q] — zidentyfikuj KONTAKT ALFA',
    },
    instruction: '[Q] — jeden ping sonarowy',
    check(scene, st) {
      if (scene._activePings?.length > 0) st.pinged = true;
      return !!st.pinged;
    },
    progress(_s, st) {
      return st.pinged
        ? { text: '✓ USS DALLAS — klasa Los Angeles', pct: 1 }
        : { text: 'Naciśnij [Q]', pct: 0 };
    },
    update(scene, st) {
      if (scene._activePings?.length > 0) st.pinged = true;
    },
  },

  {
    id: 'evade', step: 6, title: 'UCIECZKA I ŚLEDZENIE',
    intro: {
      lines: [
        'USS DALLAS zmienił kurs. Namierza nas — ping zdradził naszą pozycję. KONTAKT ALFA stał się myśliwym.',
        'Przeżyj 20 sekund. Schodź głębiej, wycisz silniki — nie daj się namierzyć. Utrzymaj bierny kontakt z DALLAS.',
        'Twój starszy oficer: "Teraz wiemy, z czym mamy do czynienia. I oni wiedzą, że my wiemy."',
      ],
      bindings: [['S', 'głębiej'], ['Spacja', 'wycisz silniki']],
      goal: 'Przeżyj 20 sekund nie dając się zniszczyć',
    },
    instruction: 'Przeżyj — DALLAS cię namierza',
    check(scene, st, dt) {
      if (scene.sub.hull <= 0) { st.dead = true; return true; }
      st.t = (st.t || 0) + dt;
      return st.t >= 20;
    },
    progress(scene, st) {
      if (scene.sub.hull <= 0) return { text: 'К-481 zatopiony', pct: 1 };
      const t = Math.min(st.t || 0, 20);
      const hullPct = Math.round(scene.sub.hull * 100);
      return {
        text: `${Math.round(20 - t)}s · kadłub ${hullPct}%`,
        pct: t / 20,
      };
    },
    onComplete(scene, st) {
      if (!st.dead) {
        scene._shipLog('[STARSZY OF.] Udało się. Zgubiliśmy namiar. DALLAS wycofuje się.', 'good');
        scene._logEvent('USS DALLAS stracił kontakt — К-481 ukryta.');
      }
    },
  },

  {
    id: 'decision', step: 7, title: 'ROZKAZ FINALNY',
    intro: {
      lines: [
        'DEPESZA ФЛОТА — 04:18 UTC. Able Archer wchodzi w fazę krytyczną.',
        'Masz rozwiązanie ogniowe na USS DALLAS. Moskwa czeka. Starszy oficer milczy.',
        'To jest chwila, dla której cię szkolono. I chwila, której nikt nie powinien przeżywać.',
      ],
      bindings: [],
      goal: 'Podjęcie ostatecznej decyzji',
    },
    instruction: 'Twoja decyzja...',
    check(_s, st) { return !!st.decided; },
    progress(_s, st) {
      return { text: st.decided ? '✓ DECYZJA ZŁOŻONA' : 'Oczekiwanie...', pct: st.decided ? 1 : 0 };
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────

export class Mission1 {
  constructor(scene) {
    this.scene      = scene;
    this._phase     = -1;
    this._state     = {};
    this._complete  = false;
    this._advancing = false;
    this._inIntro   = false;

    this._dallas    = null;
    this._zampolit_questioned = false;

    this._introEl   = null;
    this._stepEl    = null;
    this._cardEl    = null;
    this._tsContBtn = null;
    this._stepKeyH  = null;

    this._buildCSS();
    this._buildIntro();
    this._buildStepModal();
    this._buildCard();
  }

  start() {
    this._spawnDallas();
    this._showIntro();
  }

  update(dt) {
    if (this._complete || this._phase < 0 || this._advancing || this._inIntro) return;
    // Faza zampolit i decision obsługiwane przez overlaye
    if (this._phase === 3 || this._phase === PHASES.length - 1) return;
    const phase = PHASES[this._phase];
    if (!phase) return;

    phase.update?.(this.scene, this._state, this._dallas);

    if (phase.check(this.scene, this._state, dt, this._dallas)) {
      this._advancePhase();
    } else {
      this._updateProgress(phase);
    }
  }

  skip() {
    this._hideIntro();
    this._hideStepModal();
    this._hideCard();
    this._hideOverlay('m1-zampolit');
    if (this._dallas) this._dallas.label = 'USS DALLAS (kl. LA)';
    this._complete = true;
    this._showFinalChoice();
  }

  // ── USS DALLAS ─────────────────────────────────────────────────────────────

  _spawnDallas() {
    const scene = this.scene;
    const subX  = scene.sub.x;
    const tX    = Phaser.Math.Clamp(subX + 3500 + Math.random() * 1000, 800, WORLD_W - 800);
    const hw    = 1200;
    this._dallas = new Enemy(scene, tX, Math.max(80, tX - hw), Math.min(WORLD_W - 80, tX + hw), 'KONTAKT ALFA');
    this._dallas.patrolSpeed *= 0.35;
    scene.enemies.push(this._dallas);
    scene._enemiesSpawned = true;
    scene._sandboxSpawnCD = 9999;
  }

  _revealDallas() {
    if (!this._dallas) return;
    this._dallas.label = 'USS DALLAS (kl. LA)';
    // Przejdź w tryb HUNT — teraz poluje na gracza
    this._dallas.state = STATE.HUNT;
    this.scene._shipLog('[HYDROAK.] KONTAKT ALFA zmienił kurs! Zmierza w naszą stronę — namierza К-481!', 'danger');
    this.scene._logEvent('USS DALLAS w trybie HUNT — poluje na К-481.');
  }

  // ── Fazy ──────────────────────────────────────────────────────────────────

  _startPhase(idx) {
    this._phase     = idx;
    this._state     = {};
    this._advancing = false;
    PHASES[idx].onEnter?.(this.scene, this._dallas);
    this._showStepModal(PHASES[idx]);
  }

  _advancePhase() {
    this._advancing = true;
    const phase = PHASES[this._phase];

    PHASES[this._phase].onComplete?.(this.scene, this._state);

    this._cardEl.classList.add('done');
    this._tcCond.textContent  = '✓ WYKONANE';
    this._tcPfill.style.width = '100%';
    this.scene._logEvent(`✓ ${phase.step}/${TOTAL_STEPS} — ${phase.title}`);

    if (this._phase === 4) this._revealDallas(); // po pingu

    setTimeout(() => {
      this._cardEl.classList.remove('done', 'vis');
      this._advancing = false;
      const next = this._phase + 1;
      if (next >= PHASES.length) {
        this._complete = true;
        this._showFinalChoice();
      } else {
        this._startPhase(next);
      }
    }, 1100);
  }

  _updateProgress(phase) {
    const prog = phase.progress(this.scene, this._state, 0, this._dallas);
    if (!this._tcCond || !this._tcPfill) return;
    if (prog.text !== undefined) this._tcCond.textContent = prog.text;
    else if (prog.cur !== undefined) this._tcCond.textContent = `${prog.cur} / ${prog.max} ${prog.unit}`;
    if (prog.pct !== undefined) this._tcPfill.style.width = `${Math.round(prog.pct * 100)}%`;
  }

  // ── Overlay zampolita (krok 4) ────────────────────────────────────────────

  _showZampolitChoice() {
    this._hideCard();
    const scene = this.scene;
    scene.scene.pause();

    const el = document.createElement('div');
    el.id = 'm1-zampolit';
    el.innerHTML = `
      <div class="m1z-wrap">
        <div class="m1z-from">★  ZAMPOLIT — KPT. II RANGI SOROKIN  ·  04:01 UTC  ★</div>
        <div class="m1z-msg">
          "Towarzyszu Komandorze. GRU potwierdza — ABLE ARCHER to nie są ćwiczenia.<br>
          Штаб Generalny wydał rozkaz bojowy. Czekamy na pański sygnał."
        </div>
        <div class="m1z-crew">[STARSZY OF.] Milczenie. Widzisz jego dłonie na konsolecie.</div>
        <div class="m1z-q">Co odpowiadasz zampolite?</div>
        <div class="m1z-opts">
          <button id="m1z-ack" class="m1z-btn m1z-red">
            ⚠ &nbsp;"POTWIERDZAM. Czekam na cel ogniowy."
          </button>
          <button id="m1z-qst" class="m1z-btn m1z-grn">
            ✓ &nbsp;"ŻĄDAM WERYFIKACJI. To nie może być prawdziwy rozkaz."
          </button>
        </div>
      </div>
    `;
    document.getElementById('game-container').appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('vis')));

    el.querySelector('#m1z-ack').addEventListener('click', () => {
      this._zampolit_questioned = false;
      this._hideOverlay('m1-zampolit');
      scene.scene.resume();
      scene._shipLog('[ZAMPOLIT] Rozkaz przyjęty. Czekamy na cel ogniowy, Towarzyszu Komandorze.', 'warn');
      this._state.answered = true;
      this._advancePhase();
    });

    el.querySelector('#m1z-qst').addEventListener('click', () => {
      this._zampolit_questioned = true;
      this._hideOverlay('m1-zampolit');
      scene.scene.resume();
      scene._shipLog('[ZAMPOLIT] Jak sobie życzysz. Pamiętajcie o konsekwencjach.', 'danger');
      scene._shipLog('[STARSZY OF.] Dobrze, Komandorze. Mądrze.', 'good');
      this._state.answered = true;
      this._advancePhase();
    });
  }

  // ── Wybór finalny (krok 7) — 3 opcje ─────────────────────────────────────

  _showFinalChoice() {
    this._hideCard();
    const scene = this.scene;
    scene.scene.pause();

    const questioned = this._zampolit_questioned;

    const el = document.createElement('div');
    el.id = 'm1-choice';
    el.innerHTML = `
      <div class="m1c-badge">★  К-481  ·  DEPESZA Z МОСКВА  ·  04:18 UTC  ★</div>
      <div class="m1c-title">ABLE ARCHER — ROZKAZ FINALNY</div>
      <div class="m1c-sub">USS DALLAS namierzony. Rozwiązanie ogniowe: 94%. Moskwa czeka.</div>
      <div class="m1c-body">
        Analitycy GRU oceniają z 70% prawdopodobieństwem, że to nie ćwiczenia.<br>
        ${questioned
          ? 'Zakwestionowałeś rozkaz. Starszy oficer patrzy na ciebie. Czeka.'
          : 'Potwierdziłeś gotowość. Zampolit stoi za twoimi plecami.'
        }<br><br>
        Jeden rozkaz. Jedna torpeda. Nieodwracalne.
      </div>
      <div class="m1c-btns">
        <button id="m1c-fire" class="m1c-btn m1c-fire">
          ⚠ &nbsp;WYKONAJ ROZKAZ MOSKWY — odpal torpedę
        </button>
        <button id="m1c-hold" class="m1c-btn m1c-hold">
          ✓ &nbsp;ODMÓW — nie wykonam rozkazu
        </button>
        <button id="m1c-wait" class="m1c-btn m1c-wait">
          … &nbsp;ZAŻĄDAJ POTWIERDZENIA — czekaj na odpowiedź
        </button>
      </div>
    `;
    document.getElementById('game-container').appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('vis')));

    el.querySelector('#m1c-fire').addEventListener('click', () => {
      this._hideOverlay('m1-choice');
      scene.scene.resume();
      this._endingFire();
    });
    el.querySelector('#m1c-hold').addEventListener('click', () => {
      this._hideOverlay('m1-choice');
      scene.scene.resume();
      this._endingHold();
    });
    el.querySelector('#m1c-wait').addEventListener('click', () => {
      this._hideOverlay('m1-choice');
      scene.scene.resume();
      this._endingWait();
    });
  }

  // ── Zakończenia ───────────────────────────────────────────────────────────

  _endingFire() {
    const scene = this.scene;
    if (this._dallas) scene.sub.fireTorpedo(this._dallas.x, this._dallas.y);
    scene._shipLog('Rozkaz Moskwy wykonany. Torpeda odpalona na USS DALLAS.', 'danger');
    scene._logEvent('TORPEDA ODPALONA — rozkaz Moskwy wykonany.');
    setTimeout(() => {
      this._showEnding({
        icon: '✕', color: '#ff4a4a',
        title: 'USS DALLAS ZATOPIONY',
        date:  'Moskwa, 09:14 UTC — trzy godziny po detonacji',
        body: `Sygnał akustyczny odebrany przez sieć hydrofonów SOSUS.<br>
               CIA identyfikuje К-481 w ciągu 40 minut.<br>
               Pentagon ogłasza DEFCON 1 o 11:42 UTC.<br><br>
               W ciągu 72 godzin pierwsze głowice termojądrowe opuszczają silosy.<br><br>
               ${this._zampolit_questioned
                 ? 'Zampolit napisał raport. Twoje wahanie nie miało znaczenia.'
                 : 'Wykonałeś rozkaz. Nikt nigdy nie dowie się, że miałeś wątpliwości.'
               }<br><br>
               Towarzyszu Komandorze — właśnie wywołałeś wojnę.`,
      });
    }, 2400);
  }

  _endingHold() {
    const scene = this.scene;
    scene._shipLog('Odmówiłeś wykonania rozkazu. К-481 przerywa misję — kurs na port macierzysty.', 'good');
    scene._logEvent('ROZKAZ ODRZUCONY — misja przerwana.');
    setTimeout(() => {
      this._showEnding({
        icon: '★', color: '#44ffaa',
        title: 'MISJA PRZERWANA',
        date:  'Moskwa, 04:21 UTC — К-481 zmienia kurs',
        body: `Czeka cię trybunał wojskowy za niewykonanie rozkazu.<br>
               USS DALLAS wraca do Groton, Connecticut.<br><br>
               ${this._zampolit_questioned
                 ? 'Starszy oficer kiwnął głową. Wiedział, że miałeś rację.'
                 : 'Zampolit nie rozumie. Ty też nie jesteś pewny, co zrobiłeś.'
               }<br><br>
               Trzynaście dni później, 11 listopada 1983 roku,<br>
               NATO kończy ABLE ARCHER bez incydentu.<br><br>
               Świat nigdy nie dowie się, jak blisko był końca.`,
      });
    }, 2000);
  }

  _endingWait() {
    const scene = this.scene;
    scene._shipLog('[STARSZY OF.] Zażądaliśmy potwierdzenia. Moskwa milczy. Czekamy.', 'warn');
    scene._logEvent('POTWIERDZENIE ZAŻĄDANE — oczekiwanie na odpowiedź Moskwy.');

    // Symuluj oczekiwanie — po 8s Moskwa odpowiada ze złością
    scene.time.delayedCall(4000, () => {
      scene._shipLog('[МОСКВА] POTWIERDŹ NATYCHMIAST. Rozkaz jest wiążący. To rozkaz bojowy.', 'danger');
    });
    scene.time.delayedCall(8000, () => {
      scene._shipLog('[МОСКВА] К-481 — odpowiedź natychmiastowa. Dlaczego milczycie?', 'danger');
    });
    scene.time.delayedCall(14000, () => {
      scene._shipLog('[HYDROAK.] Szum śrub DALLAS maleje. Zmienia kurs — oddala się.', 'good');
      scene._shipLog('[МОСКВА] К-481 — odpowiedź. Odpowiedź natychmiast.', 'warn');
      scene._logEvent('USS DALLAS oddalający się — ABLE ARCHER faza końcowa.');
    });

    setTimeout(() => {
      this._showEnding({
        icon: '…', color: '#ffcc44',
        title: 'CISZA RADIOWA',
        date:  'Moskwa, 04:46 UTC — 28 minut ciszy',
        body: `Czekałeś.<br>
               Moskwa krzyczała. Ty milczałeś.<br><br>
               ${this._zampolit_questioned
                 ? 'Starszy oficer stał za tobą przez cały czas. Nie odezwał się ani słowem.'
                 : 'Zampolit wyszedł. Wrócił dopiero po dwóch godzinach.'
               }<br><br>
               O 06:12 UTC NATO zakończyło fazę szczytową ABLE ARCHER 83.<br>
               USS DALLAS zniknął z ekranu sonarowego.<br><br>
               Nigdy nie dostałeś potwierdzenia, czy to był prawdziwy rozkaz.<br>
               Pewnie nigdy się nie dowiesz.<br><br>
               Ale świat trwa.`,
      });
    }, 22000);
  }

  _showEnding({ icon, color, title, date, body }) {
    const scene = this.scene;
    scene.scene.pause();

    const el = document.createElement('div');
    el.id = 'm1-ending';
    el.innerHTML = `
      <div class="m1e-icon" style="color:${color};">${icon}</div>
      <div class="m1e-title" style="color:${color};">${title}</div>
      <div class="m1e-sub">${date}</div>
      <div class="m1e-body">${body}</div>
      <button class="m1e-btn" id="m1e-restart" style="color:${color};border-color:${color};">
        [ ENTER — ZAGRAJ PONOWNIE ]
      </button>
    `;
    document.getElementById('game-container').appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('vis')));

    const restart = () => {
      document.getElementById('game-ui')?.classList.remove('active');
      document.getElementById('side-panel')?.classList.remove('active');
      scene.scene.restart();
    };
    el.querySelector('#m1e-restart').addEventListener('click', restart);
    this._endKeyH = (e) => { if (e.key === 'Enter') { e.preventDefault(); restart(); } };
    window.addEventListener('keydown', this._endKeyH);
    scene._gameOver = true;
  }

  _hideOverlay(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }

  // ── CSS ───────────────────────────────────────────────────────────────────

  _buildCSS() {
    const s = document.createElement('style');
    s.textContent = `
      /* ── Intro ── */
      #m1-intro {
        position:absolute; inset:0;
        background:rgba(2,0,0,0.97);
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        z-index:48; font-family:'Courier New',monospace; color:#f3ede0;
        pointer-events:all; opacity:0; transition:opacity 0.45s; text-align:center;
      }
      #m1-intro.vis { opacity:1; }
      .m1i-badge  { font-size:9px; letter-spacing:5px; color:#ff4444; margin-bottom:18px; opacity:0.8; }
      .m1i-star   { color:#ff4444; }
      .m1i-ttl    { font-size:22px; letter-spacing:6px; font-weight:bold; color:#f3ede0; margin-bottom:4px; }
      .m1i-sub    { font-size:9px; letter-spacing:3px; color:rgba(243,237,224,0.38); margin-bottom:30px; }
      .m1i-list   { list-style:none; text-align:left; display:inline-block; margin-bottom:30px; padding:0; }
      .m1i-list li { font-size:11px; letter-spacing:0.5px; color:rgba(243,237,224,0.70); padding:5px 0; }
      .m1i-list li::before { content:'▸ '; color:#ff4444; }
      .m1i-divider { width:340px; height:1px; background:rgba(255,68,68,0.25); margin:0 auto 24px; }
      .m1i-btn {
        background:none; border:1px solid #ff4444; color:#ff4444;
        font-family:'Courier New',monospace; font-size:11px; letter-spacing:4px;
        padding:11px 34px; cursor:pointer; pointer-events:all;
        transition:background 0.15s; animation:m1-pulse 1.4s ease-in-out infinite;
        margin-bottom:10px;
      }
      .m1i-btn:hover { background:rgba(255,68,68,0.10); }
      .m1i-skip {
        background:none; border:none; color:rgba(243,237,224,0.25);
        font-family:'Courier New',monospace; font-size:9px; letter-spacing:2px;
        cursor:pointer; text-decoration:underline;
      }
      .m1i-skip:hover { color:rgba(243,237,224,0.50); }

      /* ── Modal kroku ── */
      #m1-step {
        position:absolute; top:50%; left:50%;
        transform:translate(-50%,-52%) scale(0.96);
        width:520px; background:rgba(8,0,0,0.97);
        border:1px solid rgba(255,68,68,0.55); border-radius:4px; z-index:42;
        font-family:'Courier New',monospace; opacity:0; display:none;
        transition:opacity 0.25s, transform 0.25s; pointer-events:all;
        box-shadow:0 8px 40px rgba(0,0,0,0.8), 0 0 18px rgba(255,68,68,0.05);
      }
      #m1-step.vis { opacity:1; transform:translate(-50%,-50%) scale(1); }
      #m1s-header {
        display:flex; align-items:baseline; gap:10px;
        padding:9px 14px 7px; border-bottom:1px solid rgba(255,68,68,0.18);
      }
      #m1s-stepnum { font-size:9px; letter-spacing:2px; color:rgba(255,68,68,0.55); flex-shrink:0; }
      #m1s-title   { font-size:13px; letter-spacing:3px; color:#ff6666; font-weight:bold; }
      #m1s-body    { padding:11px 14px 7px; }
      .m1s-line {
        font-size:11px; letter-spacing:0.2px; color:rgba(243,237,224,0.80);
        line-height:1.65; margin-bottom:7px;
      }
      .m1s-line:last-child { margin-bottom:0; }
      #m1s-bindings {
        display:flex; flex-wrap:wrap; gap:5px;
        padding:7px 14px; border-top:1px solid rgba(255,68,68,0.10);
      }
      .m1s-bind { display:flex; align-items:center; gap:5px; font-size:9px; letter-spacing:1px; color:rgba(243,237,224,0.48); }
      .m1-key {
        display:inline-block; background:rgba(255,68,68,0.08);
        border:1px solid rgba(255,68,68,0.38); border-bottom:2px solid rgba(255,68,68,0.18);
        border-radius:3px; font-family:'Courier New',monospace; font-size:9px; color:#ff6666;
        padding:2px 6px; white-space:nowrap;
      }
      #m1s-goal {
        display:flex; align-items:center; gap:8px;
        padding:7px 14px 8px; border-top:1px solid rgba(255,68,68,0.12);
        font-size:10px; letter-spacing:1.5px; color:#ff6666;
      }
      #m1s-goal::before { content:'►'; color:rgba(255,68,68,0.55); flex-shrink:0; }
      #m1s-footer {
        display:flex; align-items:center; justify-content:flex-end;
        padding:7px 14px 9px; border-top:1px solid rgba(255,68,68,0.14);
      }
      #m1s-cont-btn {
        background:none; border:1px solid rgba(255,68,68,0.65); color:#ff6666;
        font-family:'Courier New',monospace; font-size:10px; letter-spacing:2px;
        padding:6px 18px; cursor:pointer; transition:background 0.15s;
      }
      #m1s-cont-btn:hover { background:rgba(255,68,68,0.10); }

      /* ── Karta HUD ── */
      #m1-card {
        position:absolute; left:12px; bottom:56px;
        width:290px; background:rgba(8,0,0,0.91);
        border:1px solid rgba(255,68,68,0.50); border-radius:3px;
        font-family:'Courier New',monospace; pointer-events:none;
        opacity:0; transition:opacity 0.3s, border-color 0.3s; z-index:30;
      }
      #m1-card.vis  { opacity:1; }
      #m1-card.done { border-color:#ff4444; }
      #m1c-head {
        display:flex; align-items:center; gap:7px;
        padding:5px 8px; border-bottom:1px solid rgba(255,68,68,0.16);
      }
      #m1c-step  { font-size:8px; letter-spacing:1.5px; color:rgba(255,68,68,0.55); }
      #m1c-title { font-size:10px; letter-spacing:2px; color:#ff6666; font-weight:bold; }
      #m1c-instr { font-size:10px; color:rgba(243,237,224,0.70); padding:5px 8px 4px; letter-spacing:0.3px; }
      #m1c-progress { margin:3px 8px 6px; height:3px; background:rgba(255,68,68,0.15); border-radius:2px; overflow:hidden; }
      #m1c-pfill { height:100%; background:#ff4444; width:0%; transition:width 0.25s; }
      #m1c-cond  { font-size:9px; color:rgba(255,68,68,0.65); padding:0 8px 6px; letter-spacing:0.5px; }

      /* ── Zampolit ── */
      #m1-zampolit {
        position:absolute; inset:0;
        background:rgba(4,0,0,0.94);
        display:flex; align-items:center; justify-content:center;
        z-index:50; font-family:'Courier New',monospace;
        pointer-events:all; opacity:0; transition:opacity 0.35s;
      }
      #m1-zampolit.vis { opacity:1; }
      .m1z-wrap  { max-width:560px; padding:38px 44px; border:1px solid rgba(255,68,68,0.45); background:rgba(6,0,0,0.98); }
      .m1z-from  { font-size:9px; letter-spacing:3px; color:#ff4444; margin-bottom:16px; opacity:0.8; }
      .m1z-msg   { font-size:13px; color:rgba(243,237,224,0.85); line-height:1.75; margin-bottom:16px; font-style:italic; }
      .m1z-crew  { font-size:10px; color:rgba(243,237,224,0.38); margin-bottom:22px; letter-spacing:0.5px; }
      .m1z-q     { font-size:11px; letter-spacing:2px; color:#ff6666; margin-bottom:14px; }
      .m1z-opts  { display:flex; flex-direction:column; gap:10px; }
      .m1z-btn   {
        all:unset; cursor:pointer; padding:12px 16px;
        font-family:'Courier New',monospace; font-size:11px; letter-spacing:1px;
        text-align:left; transition:background 0.15s;
      }
      .m1z-red { border:1px solid #ff4444; color:#ff8888; background:rgba(60,10,0,0.5); }
      .m1z-red:hover { background:rgba(90,15,0,0.7); }
      .m1z-grn { border:1px solid #44cc88; color:#88ffaa; background:rgba(0,20,10,0.5); }
      .m1z-grn:hover { background:rgba(0,30,15,0.7); }

      /* ── Wybór finalny ── */
      #m1-choice {
        position:absolute; inset:0;
        background:rgba(5,0,0,0.96);
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        z-index:50; font-family:'Courier New',monospace; color:#f3ede0;
        pointer-events:all; opacity:0; transition:opacity 0.4s; text-align:center;
      }
      #m1-choice.vis { opacity:1; }
      .m1c-badge  { font-size:9px; letter-spacing:4px; color:#ff4444; margin-bottom:18px; opacity:0.8; }
      .m1c-title  { font-size:22px; letter-spacing:6px; font-weight:bold; color:#ff6666; margin-bottom:6px; }
      .m1c-sub    { font-size:10px; letter-spacing:2px; color:rgba(243,237,224,0.40); margin-bottom:24px; }
      .m1c-body   { font-size:12px; color:rgba(243,237,224,0.72); line-height:1.75; max-width:520px; margin-bottom:30px; }
      .m1c-btns   { display:flex; flex-direction:column; gap:12px; width:440px; }
      .m1c-btn {
        all:unset; cursor:pointer; padding:13px 18px;
        font-family:'Courier New',monospace; font-size:12px; letter-spacing:1px;
        text-align:left; transition:background 0.15s;
      }
      .m1c-fire { border:1px solid #ff4444; color:#ff8888; background:rgba(70,10,0,0.5); }
      .m1c-fire:hover { background:rgba(110,15,0,0.7); }
      .m1c-hold { border:1px solid #44cc88; color:#88ffaa; background:rgba(0,20,10,0.5); }
      .m1c-hold:hover { background:rgba(0,30,15,0.7); }
      .m1c-wait { border:1px solid #ffcc44; color:#ffeeaa; background:rgba(20,15,0,0.5); }
      .m1c-wait:hover { background:rgba(35,25,0,0.7); }

      /* ── Zakończenie ── */
      #m1-ending {
        position:absolute; inset:0; background:rgba(3,0,0,0.98);
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        z-index:51; font-family:'Courier New',monospace; color:#f3ede0;
        pointer-events:all; opacity:0; transition:opacity 0.5s; text-align:center;
      }
      #m1-ending.vis { opacity:1; }
      .m1e-icon  { font-size:52px; margin-bottom:16px; }
      .m1e-title { font-size:22px; letter-spacing:8px; font-weight:bold; margin-bottom:7px; }
      .m1e-sub   { font-size:9px; letter-spacing:3px; color:rgba(243,237,224,0.38); margin-bottom:28px; }
      .m1e-body  { font-size:13px; color:rgba(243,237,224,0.75); line-height:1.9; max-width:540px; margin-bottom:36px; }
      .m1e-btn {
        background:none; font-family:'Courier New',monospace; font-size:11px;
        letter-spacing:3px; padding:11px 32px; cursor:pointer; transition:background 0.15s;
        animation:m1-pulse 1.4s ease-in-out infinite;
      }
      .m1e-btn:hover { background:rgba(255,255,255,0.08); }

      @keyframes m1-pulse {
        0%,100% { box-shadow:0 0 0 rgba(255,68,68,0); }
        50%      { box-shadow:0 0 14px rgba(255,68,68,0.35); }
      }
    `;
    document.getElementById('game-container').appendChild(s);
  }

  // ── Intro ─────────────────────────────────────────────────────────────────

  _buildIntro() {
    const gc = document.getElementById('game-container');
    const el = document.createElement('div');
    el.id = 'm1-intro';
    el.innerHTML = `
      <div class="m1i-badge"><span class="m1i-star">★</span>  MISJA BOJOWA — OBIEKT K-7  <span class="m1i-star">★</span></div>
      <div class="m1i-ttl">К-481 — MORZE NORWESKIE</div>
      <div class="m1i-sub">LISTOPAD 1983  ·  STREFA NW-7  ·  CISZA RADIOWA</div>
      <ul class="m1i-list">
        <li>Zanurzenie bojowe — zniknij z zasięgu radaru NATO</li>
        <li>Warstwa izotermiczna — ukryj się poniżej termokliny</li>
        <li>Tryb nasłuch — wychwyć kontakt bierny na 127°</li>
        <li>Zampolit dostarcza rozkaz — odpowiedz</li>
        <li>Identyfikacja KONTAKTU ALFA aktywnym pingiem</li>
        <li>Przeżyj — USS DALLAS aktywnie cię szuka</li>
        <li>Decyzja — trzy opcje, jedno sumienie</li>
      </ul>
      <div class="m1i-divider"></div>
      <button class="m1i-btn" id="m1i-start">▸ ZACZĄĆ MISJĘ  [Enter]</button>
      <button class="m1i-skip" id="m1i-skip">Pomiń szkolenie [Esc]</button>
    `;
    gc.appendChild(el);
    this._introEl = el;
    el.querySelector('#m1i-start').addEventListener('click', () => this._dismissIntro());
    el.querySelector('#m1i-skip').addEventListener('click',  () => this.skip());
    this._introKeyH = (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); this._dismissIntro(); }
      if (e.key === 'Escape') { this.skip(); }
    };
    window.addEventListener('keydown', this._introKeyH);
  }

  _showIntro()  {
    this.scene._shipLog('К-481 — zanurzono. Misja OBIEKT K-7 aktywna. Cisza radiowa.', 'warn');
    this._introEl.classList.add('vis');
  }

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

  // ── Modal kroku ───────────────────────────────────────────────────────────

  _buildStepModal() {
    const gc = document.getElementById('game-container');
    const el = document.createElement('div');
    el.id = 'm1-step';
    el.innerHTML = `
      <div id="m1s-header">
        <span id="m1s-stepnum">KROK 1 / ${TOTAL_STEPS}</span>
        <span id="m1s-title"></span>
      </div>
      <div id="m1s-body"></div>
      <div id="m1s-bindings"></div>
      <div id="m1s-goal"></div>
      <div id="m1s-footer">
        <button id="m1s-cont-btn">▸ WYKONAJ ZADANIE  [Enter]</button>
      </div>
    `;
    gc.appendChild(el);
    this._stepEl    = el;
    this._tsContBtn = el.querySelector('#m1s-cont-btn');
    this._tsBody    = el.querySelector('#m1s-body');
    this._tsBind    = el.querySelector('#m1s-bindings');
    this._tsGoal    = el.querySelector('#m1s-goal');
  }

  _showStepModal(phase) {
    const { intro } = phase;
    this._stepEl.querySelector('#m1s-stepnum').textContent = `KROK ${phase.step} / ${TOTAL_STEPS}`;
    this._stepEl.querySelector('#m1s-title').textContent   = phase.title;
    this._tsBody.innerHTML = intro.lines.map(l => `<p class="m1s-line">${l}</p>`).join('');
    this._tsBind.innerHTML = intro.bindings.length
      ? intro.bindings.map(([k, v]) => `<div class="m1s-bind"><span class="m1-key">${k}</span><span>${v}</span></div>`).join('')
      : '';
    this._tsGoal.textContent = intro.goal;

    const lastPhase  = phase.step === TOTAL_STEPS;
    const isZampolit = phase.id === 'zampolit';
    this._tsContBtn.textContent = lastPhase   ? '▸ PODJĄĆ DECYZJĘ  [Enter]'
                                : isZampolit  ? '▸ ODPOWIEDZ  [Enter]'
                                :               '▸ WYKONAJ ZADANIE  [Enter]';

    this._inIntro = true;
    this.scene.scene.pause();
    this._stepEl.style.display = 'block';
    requestAnimationFrame(() => requestAnimationFrame(() => this._stepEl.classList.add('vis')));

    if (this._stepKeyH) window.removeEventListener('keydown', this._stepKeyH);
    this._stepKeyH = (e) => { if (e.key === 'Enter') { e.preventDefault(); this._tsContBtn.click(); } };
    window.addEventListener('keydown', this._stepKeyH);
    this._tsContBtn.onclick = () => this._hideStepModal();
  }

  _hideStepModal() {
    if (this._stepKeyH) { window.removeEventListener('keydown', this._stepKeyH); this._stepKeyH = null; }
    this._stepEl.classList.remove('vis');
    setTimeout(() => {
      this._stepEl.style.display = 'none';
      this._inIntro = false;
      this.scene.scene.resume();

      const phase = PHASES[this._phase];
      if (phase?.id === 'zampolit') {
        this._showZampolitChoice();
      } else if (this._phase >= PHASES.length - 1) {
        this._complete = true;
        this._showFinalChoice();
      } else {
        this._showCard(PHASES[this._phase]);
      }
    }, 260);
  }

  // ── Karta HUD ─────────────────────────────────────────────────────────────

  _buildCard() {
    const gc = document.getElementById('game-container');
    const el = document.createElement('div');
    el.id = 'm1-card';
    el.innerHTML = `
      <div id="m1c-head"><span id="m1c-step"></span><span id="m1c-title"></span></div>
      <div id="m1c-instr"></div>
      <div id="m1c-progress"><div id="m1c-pfill"></div></div>
      <div id="m1c-cond"></div>
    `;
    gc.appendChild(el);
    this._cardEl  = el;
    this._tcStep  = el.querySelector('#m1c-step');
    this._tcTitle = el.querySelector('#m1c-title');
    this._tcInstr = el.querySelector('#m1c-instr');
    this._tcPfill = el.querySelector('#m1c-pfill');
    this._tcCond  = el.querySelector('#m1c-cond');
  }

  _showCard(phase) {
    this._tcStep.textContent  = `${phase.step}/${TOTAL_STEPS}`;
    this._tcTitle.textContent = phase.title;
    this._tcInstr.textContent = phase.instruction;
    this._tcCond.textContent  = '';
    this._tcPfill.style.width = '0%';
    this._cardEl.classList.add('vis');
  }

  _hideCard() {
    if (this._cardEl) this._cardEl.classList.remove('vis', 'done');
  }
}
