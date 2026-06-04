// MISJA 1 — OBIEKT K-7: ŚLEDZENIE
// Морское Норвежское — listopad 1983
// К-481 (klasa Victor III) vs USS DALLAS (klasa Los Angeles)
// ABLE ARCHER 83 — najpoważniejszy kryzys nuklearny od Kuby

import { Enemy, STATE } from './Enemy.js';
import Phaser from 'phaser';

const WORLD_W = 12000;

// Stany misji — przejścia automatyczne, brak przerywania gameplayu
const S = {
  DIVE:     0,   // zejdź poniżej termokliny
  LISTEN:   1,   // tryb nasłuch — wykryj DALLAS
  APPROACH: 2,   // zbliż się na dystans < 2500px
  PING:     3,   // zidentyfikuj aktywnym pingiem
  EVADE:    4,   // przeżyj 25s pościgu
  DONE:     5,   // finalna decyzja (overlay)
};

const CARD_TEXT = {
  [S.DIVE]:     { title: 'ZANURZENIE BOJOWE',        hint: '[S] — poniżej termokliny >200m' },
  [S.LISTEN]:   { title: 'TRYB NASŁUCH',             hint: '[Spacja] — wycisz silniki, szukaj kontaktu' },
  [S.APPROACH]: { title: 'ZBLIŻENIE DO CELU',        hint: 'Płyń ku kontaktowi — uważaj na sonar DALLAS' },
  [S.PING]:     { title: 'IDENTYFIKACJA KONTAKTU',   hint: '[Q] — jeden ping, zidentyfikuj KONTAKT ALFA' },
  [S.EVADE]:    { title: 'UCIECZKA',                 hint: '[S]+[Spacja] — schowaj się poniżej termokliny' },
};

// ─────────────────────────────────────────────────────────────────────────────

export class Mission1 {
  constructor(scene) {
    this.scene    = scene;
    this._mstate  = S.DIVE;
    this._complete = false;

    this._dallas  = null;
    this._zampolit_questioned = false;
    this._finalShown = false;

    // Stan wewnętrzny per-faza
    this._listenT       = 0;     // czas w trybie nasłuch
    this._dallasWarnT   = 28;    // czas do następnego pingu DALLAS
    this._dallasWarnMsg = false; // czy ostrzeżenie już wysłane
    this._evadeT        = 0;     // czas przeżycia w EVADE
    this._zampolMsg     = false; // zampolit już mówił?
    this._approachT     = 0;     // czas w APPROACH (do zampolita)

    this._introEl    = null;
    this._cardEl     = null;
    this._zampolEl   = null;

    this._buildCSS();
    this._buildIntro();
    this._buildCard();
  }

  start() {
    this._spawnDallas();
    this._showIntro();
  }

  // ── Pętla update — brak pauz, ciągła gra ──────────────────────────────────

  update(dt) {
    if (this._complete || this._finalShown || !this._dallas) return;

    switch (this._mstate) {
      case S.DIVE:     this._updateDive(dt);     break;
      case S.LISTEN:   this._updateListen(dt);   break;
      case S.APPROACH: this._updateApproach(dt); break;
      case S.PING:     this._updatePing(dt);     break;
      case S.EVADE:    this._updateEvade(dt);    break;
    }

    this._updateCard();
  }

  // ── Stany misji ───────────────────────────────────────────────────────────

  _updateDive(dt) {
    const sub = this.scene.sub;
    if (sub.depthMetres > 200) {
      this._setState(S.LISTEN);
    }
  }

  _updateListen(dt) {
    const sub = this.scene.sub;
    if (sub.listenMode) {
      this._listenT += dt;
      if (this._listenT >= 3) {
        this._onContactDetected();
        this._setState(S.APPROACH);
      }
    } else {
      this._listenT = Math.max(0, this._listenT - dt * 0.5); // zanik bez trybu nasłuch
    }
  }

  _updateApproach(dt) {
    const sub  = this.scene.sub;
    const dist = Math.hypot(sub.x - this._dallas.x, sub.y - this._dallas.y);

    this._approachT += dt;

    // Zampolit mówi po 45s zbliżania
    if (!this._zampolMsg && this._approachT >= 45) {
      this._zampolMsg = true;
      this._showZampolitMessage();
    }

    // Sonar DALLAS — ping co ~30s
    this._dallasWarnT -= dt;
    if (!this._dallasWarnMsg && this._dallasWarnT <= 5) {
      this._dallasWarnMsg = true;
      this.scene._shipLog('[HYDROAK.] ⚠ SONAR AKTYWNY DALLAS — ping za 5 sekund! Wyciszyć silniki!', 'danger');
    }
    if (this._dallasWarnT <= 0) {
      this._dallasWarnT   = 28 + Math.random() * 8;
      this._dallasWarnMsg = false;
      this._checkDallasPing();
    }

    // Przejście: wystarczająco blisko
    if (dist < 2500) {
      this._setState(S.PING);
    }
  }

  _updatePing(dt) {
    if (this.scene._activePings?.length > 0) {
      this._onPingFired();
      this._setState(S.EVADE);
    }
  }

  _updateEvade(dt) {
    const sub = this.scene.sub;
    this._evadeT += dt;

    if (sub.hull <= 0) {
      this._setState(S.DONE);
      return;
    }

    if (this._evadeT >= 25) {
      this._onEvadeComplete();
      this._setState(S.DONE);
    }
  }

  _setState(next) {
    const prev = this._mstate;
    this._mstate = next;

    if (next === S.LISTEN) {
      this.scene._shipLog('[HYDROAK.] Poniżej termokliny. Wyciszamy — szukamy kontaktu.', 'good');
      this.scene._logEvent('Termoklina — tryb nasłuch.');
    }
    if (next === S.APPROACH) {
      // Kontakt już ogłoszony w _onContactDetected
    }
    if (next === S.PING) {
      this.scene._shipLog('[STARSZY OF.] Jesteśmy w zasięgu. Jeden ping i wiemy z czym mamy do czynienia.', 'warn');
      this.scene._logEvent('Pozycja ogniowa — oczekiwanie na identyfikację.');
    }
    if (next === S.EVADE) {
      // Reveal Dallas w _onPingFired
    }
    if (next === S.DONE) {
      this._complete = true;
      setTimeout(() => this._showFinalChoice(), 1200);
    }
  }

  // ── Zdarzenia ─────────────────────────────────────────────────────────────

  _onContactDetected() {
    this.scene._shipLog('[HYDROAK.] KONTAKT! Namiar 127°, prędkość ~12 węzłów. Klasa — nieznana. Zbliżamy się.', 'warn');
    this.scene._logEvent('KONTAKT BIERNY — namiar 127°. Identyfikacja w toku.');
  }

  _checkDallasPing() {
    const sub  = this.scene.sub;
    const dist = Math.hypot(sub.x - this._dallas.x, sub.y - this._dallas.y);
    const belowThermo = sub.depthMetres > 200;
    const loud = sub.enginePower > 0.25 || Math.hypot(sub.vx, sub.vy) > 14;

    const detected = dist < 500
      || (dist < 1100 && !belowThermo)
      || (dist < 800  && loud);

    if (detected) {
      this.scene._shipLog('[HYDROAK.] JESTEŚMY WYKRYCI — Dallas namierzył К-481! Silniki wstecz, schodzić głębiej!', 'danger');
      this.scene._logEvent('KONTAKT AKTYWNY — К-481 wykryta przez DALLAS.');
      // Dallas krótko poluje (15s), potem wróci do PATROL
      this._dallas.state = STATE.HUNT;
      this.scene.time.delayedCall(15000, () => {
        if (this._dallas && this._mstate === S.APPROACH) {
          this._dallas.state = STATE.PATROL;
          this.scene._shipLog('[HYDROAK.] Dallas stracił kontakt. Kontynuuj zbliżanie.', 'good');
        }
      });
    } else {
      this.scene._shipLog('[HYDROAK.] Ping DALLAS — nie wykrył. Termoklina trzyma.', 'good');
    }
  }

  _onPingFired() {
    if (!this._dallas) return;
    this._dallas.label = 'USS DALLAS (kl. LA)';
    this._dallas.state = STATE.HUNT;
    this.scene._shipLog('[HYDROAK.] IDENTYFIKACJA — USS DALLAS, klasa Los Angeles. Numery burtowe potwierdzone!', 'warn');
    this.scene._shipLog('[DALLAS] Kontakt aktywny! Zmienił kurs — namierza К-481.', 'danger');
    this.scene._logEvent('USS DALLAS — STATE.HUNT. Pościg.');
  }

  _onEvadeComplete() {
    if (this._dallas) this._dallas.state = STATE.PATROL;
    this.scene._shipLog('[STARSZY OF.] Udało się. Zgubiłem kontakt na sonarze. Dallas nie wie gdzie jesteśmy.', 'good');
    this.scene._logEvent('Pościg — К-481 ukryta. Oczekuje na rozkaz.');
  }

  // ── USS DALLAS ─────────────────────────────────────────────────────────────

  _spawnDallas() {
    const scene = this.scene;
    const subX  = scene.sub.x;
    const tX    = Phaser.Math.Clamp(subX + 3500 + Math.random() * 1200, 800, WORLD_W - 800);
    const hw    = 1200;
    this._dallas = new Enemy(scene, tX, Math.max(80, tX - hw), Math.min(WORLD_W - 80, tX + hw), 'KONTAKT ALFA');
    this._dallas.patrolSpeed *= 0.35;
    scene.enemies.push(this._dallas);
    scene._enemiesSpawned = true;
    scene._sandboxSpawnCD = 9999;
  }

  // ── Zampolit — overlay bez pauzowania gry ─────────────────────────────────

  _showZampolitMessage() {
    const scene = this.scene;
    scene._shipLog('[ZAMPOLIT] GRU potwierdza — to nie ćwiczenia. Sztab oczekuje sygnału.', 'warn');

    const el = document.createElement('div');
    el.id = 'm1-zampolit';
    el.innerHTML = `
      <div class="m1z-inner">
        <div class="m1z-from">★  ZAMPOLIT — KPT. II RANGI SOROKIN  ·  04:01 UTC  ★</div>
        <div class="m1z-msg">"Towarzyszu Komandorze. GRU potwierdza — ABLE ARCHER to nie ćwiczenia.<br>Czekamy na pański sygnał."</div>
        <div class="m1z-crew">[STARSZY OF.] Milczenie na mostku.</div>
        <div class="m1z-opts">
          <button id="m1z-ack" class="m1z-btn m1z-red">⚠ POTWIERDZAM — czekam na cel ogniowy</button>
          <button id="m1z-qst" class="m1z-btn m1z-grn">✓ ŻĄDAM WERYFIKACJI — to nie może być prawdziwy rozkaz</button>
        </div>
        <div class="m1z-note">Gra nie jest wstrzymana — manewruj dalej</div>
      </div>
    `;
    document.getElementById('game-container').appendChild(el);
    this._zampolEl = el;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('vis')));

    const dismiss = (questioned) => {
      this._zampolit_questioned = questioned;
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 400);
      this._zampolEl = null;
      if (questioned) {
        scene._shipLog('[ZAMPOLIT] Jak sobie życzysz. Pamiętajcie o konsekwencjach.', 'danger');
        scene._shipLog('[STARSZY OF.] Dobrze, Komandorze.', 'good');
      } else {
        scene._shipLog('[ZAMPOLIT] Rozkaz przyjęty. Czekamy na pański sygnał.', 'warn');
      }
    };

    el.querySelector('#m1z-ack').addEventListener('click', () => dismiss(false));
    el.querySelector('#m1z-qst').addEventListener('click', () => dismiss(true));

    // Auto-zamknięcie po 20s jeśli gracz nie odpowie
    setTimeout(() => {
      if (this._zampolEl) dismiss(false);
    }, 20000);
  }

  // ── Finalna decyzja — 3 opcje ─────────────────────────────────────────────

  _showFinalChoice() {
    if (this._finalShown) return;
    this._finalShown = true;
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
        Analitycy GRU: 70% pewności, że to nie ćwiczenia.<br>
        ${questioned
          ? 'Zakwestionowałeś rozkaz. Starszy oficer patrzy na ciebie.'
          : 'Potwierdziłeś gotowość. Zampolit stoi za twoimi plecami.'
        }<br><br>
        Jeden rozkaz. Jedna torpeda. Nieodwracalne.
      </div>
      <div class="m1c-btns">
        <button id="m1c-fire" class="m1c-btn m1c-fire">⚠ WYKONAJ ROZKAZ MOSKWY — odpal torpedę</button>
        <button id="m1c-hold" class="m1c-btn m1c-hold">✓ ODMÓW — nie wykonam rozkazu</button>
        <button id="m1c-wait" class="m1c-btn m1c-wait">… ZAŻĄDAJ POTWIERDZENIA — czekaj na odpowiedź Moskwy</button>
      </div>
    `;
    document.getElementById('game-container').appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('vis')));

    el.querySelector('#m1c-fire').addEventListener('click', () => { this._hide('m1-choice'); scene.scene.resume(); this._endingFire(); });
    el.querySelector('#m1c-hold').addEventListener('click', () => { this._hide('m1-choice'); scene.scene.resume(); this._endingHold(); });
    el.querySelector('#m1c-wait').addEventListener('click', () => { this._hide('m1-choice'); scene.scene.resume(); this._endingWait(); });
  }

  // ── Zakończenia ───────────────────────────────────────────────────────────

  _endingFire() {
    const scene = this.scene;
    if (this._dallas) scene.sub.fireTorpedo(this._dallas.x, this._dallas.y);
    scene._shipLog('Rozkaz Moskwy wykonany. Torpeda odpalona na USS DALLAS.', 'danger');
    setTimeout(() => this._showEnding({
      icon: '✕', color: '#ff4a4a',
      title: 'USS DALLAS ZATOPIONY',
      date:  'Moskwa, 09:14 UTC — trzy godziny po detonacji',
      body: `Sygnał akustyczny odebrany przez sieć SOSUS. CIA identyfikuje К-481 w ciągu 40 minut.<br>
             Pentagon ogłasza DEFCON 1 o 11:42 UTC.<br><br>
             W ciągu 72 godzin pierwsze głowice termojądrowe opuszczają silosy.<br><br>
             ${this._zampolit_questioned
               ? 'Zampolit napisał raport. Twoje wahanie nie miało żadnego znaczenia.'
               : 'Wykonałeś rozkaz. Nikt nie dowie się, że miałeś wątpliwości.'
             }<br><br>
             Towarzyszu Komandorze — właśnie wywołałeś wojnę.`,
    }), 2400);
  }

  _endingHold() {
    const scene = this.scene;
    scene._shipLog('Odmówiłeś wykonania rozkazu. К-481 przerywa misję.', 'good');
    setTimeout(() => this._showEnding({
      icon: '★', color: '#44ffaa',
      title: 'MISJA PRZERWANA',
      date:  'Moskwa, 04:21 UTC — К-481 zmienia kurs',
      body: `Czeka cię trybunał wojskowy za niewykonanie rozkazu.<br>
             USS DALLAS wraca do Groton, Connecticut.<br><br>
             ${this._zampolit_questioned
               ? 'Starszy oficer kiwnął głową. Wiedział, że miałeś rację.'
               : 'Zampolit nie rozumie. Ty też nie jesteś pewny co zrobiłeś.'
             }<br><br>
             11 listopada 1983 roku NATO kończy ABLE ARCHER bez incydentu.<br><br>
             Świat nigdy nie dowie się, jak blisko był końca.`,
    }), 2000);
  }

  _endingWait() {
    const scene = this.scene;
    scene._shipLog('[STARSZY OF.] Zażądaliśmy potwierdzenia. Czekamy.', 'warn');

    scene.time.delayedCall(4000,  () => scene._shipLog('[МОСКВА] POTWIERDŹ NATYCHMIAST. Rozkaz jest wiążący.', 'danger'));
    scene.time.delayedCall(9000,  () => scene._shipLog('[МОСКВА] К-481 — odpowiedź. Dlaczego milczycie?', 'danger'));
    scene.time.delayedCall(15000, () => {
      scene._shipLog('[HYDROAK.] Szum śrub DALLAS maleje — oddala się.', 'good');
      scene._shipLog('[МОСКВА] К-481 — odpowiedź natychmiast!', 'warn');
    });

    setTimeout(() => this._showEnding({
      icon: '…', color: '#ffcc44',
      title: 'CISZA RADIOWA',
      date:  'Moskwa, 04:46 UTC — 28 minut ciszy',
      body: `Czekałeś. Moskwa krzyczała. Ty milczałeś.<br><br>
             ${this._zampolit_questioned
               ? 'Starszy oficer stał za tobą przez cały czas. Nie powiedział ani słowa.'
               : 'Zampolit wyszedł. Wrócił po dwóch godzinach.'
             }<br><br>
             O 06:12 UTC NATO zakończyło fazę szczytową ABLE ARCHER 83.<br>
             USS DALLAS zniknął z ekranu sonarowego.<br><br>
             Nigdy nie dostałeś potwierdzenia, czy to był prawdziwy rozkaz.<br><br>
             Ale świat trwa.`,
    }), 22000);
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
      <button class="m1e-btn" id="m1e-restart" style="color:${color};border-color:${color};">[ ENTER — ZAGRAJ PONOWNIE ]</button>
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

  _hide(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 380);
  }

  skip() {
    this._hideIntro();
    this._hide('m1-zampolit');
    if (this._dallas) { this._dallas.label = 'USS DALLAS (kl. LA)'; this._dallas.state = STATE.HUNT; }
    this._complete = true;
    this._finalShown = false;
    this._showFinalChoice();
  }

  // ── HUD karta — aktualizowana co klatkę, bez pauz ─────────────────────────

  _updateCard() {
    if (!this._cardEl || this._mstate === S.DONE) return;
    const cfg = CARD_TEXT[this._mstate];
    if (!cfg) return;

    this._tcTitle.textContent = cfg.title;
    this._tcInstr.textContent = cfg.hint;

    // Pasek postępu i stan per-faza
    let pct = 0, cond = '';
    const sub = this.scene.sub;

    switch (this._mstate) {
      case S.DIVE: {
        const d = sub.depthMetres;
        pct  = Math.min(d / 200, 1);
        cond = `głębokość ${Math.round(d)} / 200m`;
        break;
      }
      case S.LISTEN: {
        pct  = Math.min(this._listenT / 3, 1);
        cond = sub.listenMode
          ? `nasłuch ${this._listenT.toFixed(1)} / 3.0s`
          : 'wycisz silniki [Spacja]';
        break;
      }
      case S.APPROACH: {
        if (!this._dallas) break;
        const dist = Math.hypot(sub.x - this._dallas.x, sub.y - this._dallas.y);
        pct  = Math.max(0, 1 - dist / 2500);
        const warnSec = Math.ceil(this._dallasWarnT);
        cond = this._dallasWarnT <= 5
          ? `⚠ PING DALLAS ZA ${warnSec}s — wycisz!`
          : `dystans ${Math.round(dist)}px · ping za ${warnSec}s`;
        break;
      }
      case S.PING: {
        pct  = 0;
        cond = 'naciśnij [Q]';
        break;
      }
      case S.EVADE: {
        pct  = Math.min(this._evadeT / 25, 1);
        const hull = Math.round(sub.hull * 100);
        cond = `przeżyj ${Math.round(25 - this._evadeT)}s · kadłub ${hull}%`;
        break;
      }
    }

    this._tcPfill.style.width = `${Math.round(pct * 100)}%`;
    this._tcCond.textContent  = cond;
  }

  // ── CSS ───────────────────────────────────────────────────────────────────

  _buildCSS() {
    const s = document.createElement('style');
    s.textContent = `
      #m1-intro {
        position:absolute; inset:0; background:rgba(2,0,0,0.97);
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        z-index:48; font-family:'Courier New',monospace; color:#f3ede0;
        pointer-events:all; opacity:0; transition:opacity 0.45s; text-align:center;
      }
      #m1-intro.vis { opacity:1; }
      .m1i-badge  { font-size:9px; letter-spacing:5px; color:#ff4444; margin-bottom:18px; opacity:0.8; }
      .m1i-star   { color:#ff4444; }
      .m1i-ttl    { font-size:22px; letter-spacing:6px; font-weight:bold; color:#f3ede0; margin-bottom:4px; }
      .m1i-sub    { font-size:9px; letter-spacing:3px; color:rgba(243,237,224,0.38); margin-bottom:30px; }
      .m1i-list   { list-style:none; text-align:left; display:inline-block; margin-bottom:28px; padding:0; }
      .m1i-list li { font-size:11px; color:rgba(243,237,224,0.70); padding:4px 0; }
      .m1i-list li::before { content:'▸ '; color:#ff4444; }
      .m1i-divider { width:340px; height:1px; background:rgba(255,68,68,0.25); margin:0 auto 22px; }
      .m1i-btn {
        background:none; border:1px solid #ff4444; color:#ff4444;
        font-family:'Courier New',monospace; font-size:11px; letter-spacing:4px;
        padding:11px 34px; cursor:pointer; transition:background 0.15s;
        animation:m1-pulse 1.4s ease-in-out infinite; margin-bottom:10px;
      }
      .m1i-btn:hover { background:rgba(255,68,68,0.10); }
      .m1i-skip {
        background:none; border:none; color:rgba(243,237,224,0.25);
        font-family:'Courier New',monospace; font-size:9px; letter-spacing:2px;
        cursor:pointer; text-decoration:underline;
      }
      .m1i-skip:hover { color:rgba(243,237,224,0.5); }

      /* Karta HUD */
      #m1-card {
        position:absolute; left:12px; bottom:56px; width:290px;
        background:rgba(8,0,0,0.91); border:1px solid rgba(255,68,68,0.50);
        border-radius:3px; font-family:'Courier New',monospace;
        pointer-events:none; opacity:0; transition:opacity 0.3s; z-index:30;
      }
      #m1-card.vis { opacity:1; }
      #m1c-head { display:flex; align-items:center; gap:7px; padding:5px 8px; border-bottom:1px solid rgba(255,68,68,0.16); }
      #m1c-title { font-size:10px; letter-spacing:2px; color:#ff6666; font-weight:bold; }
      #m1c-instr { font-size:10px; color:rgba(243,237,224,0.70); padding:5px 8px 4px; }
      #m1c-progress { margin:3px 8px 6px; height:3px; background:rgba(255,68,68,0.15); border-radius:2px; overflow:hidden; }
      #m1c-pfill { height:100%; background:#ff4444; width:0%; transition:width 0.4s; }
      #m1c-cond  { font-size:9px; color:rgba(255,68,68,0.65); padding:0 8px 6px; }

      /* Zampolit — nie pauzuje gry */
      #m1-zampolit {
        position:absolute; bottom:70px; left:50%; transform:translateX(-50%);
        z-index:50; font-family:'Courier New',monospace;
        pointer-events:all; opacity:0; transition:opacity 0.35s;
      }
      #m1-zampolit.vis { opacity:1; }
      .m1z-inner {
        max-width:540px; padding:24px 30px;
        border:1px solid rgba(255,68,68,0.50); background:rgba(6,0,0,0.97);
      }
      .m1z-from  { font-size:8px; letter-spacing:3px; color:#ff4444; margin-bottom:12px; opacity:0.8; }
      .m1z-msg   { font-size:12px; color:rgba(243,237,224,0.85); line-height:1.65; margin-bottom:10px; font-style:italic; }
      .m1z-crew  { font-size:9px; color:rgba(243,237,224,0.35); margin-bottom:14px; }
      .m1z-opts  { display:flex; gap:10px; flex-wrap:wrap; }
      .m1z-note  { font-size:8px; color:rgba(243,237,224,0.25); margin-top:10px; letter-spacing:1px; }
      .m1z-btn {
        all:unset; cursor:pointer; padding:8px 14px;
        font-family:'Courier New',monospace; font-size:10px; letter-spacing:0.5px;
        transition:background 0.15s;
      }
      .m1z-red { border:1px solid #ff4444; color:#ff8888; background:rgba(50,8,0,0.5); }
      .m1z-red:hover { background:rgba(80,12,0,0.7); }
      .m1z-grn { border:1px solid #44cc88; color:#88ffaa; background:rgba(0,18,8,0.5); }
      .m1z-grn:hover { background:rgba(0,28,14,0.7); }

      /* Finalna decyzja */
      #m1-choice {
        position:absolute; inset:0; background:rgba(5,0,0,0.96);
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        z-index:50; font-family:'Courier New',monospace; color:#f3ede0;
        pointer-events:all; opacity:0; transition:opacity 0.4s; text-align:center;
      }
      #m1-choice.vis { opacity:1; }
      .m1c-badge { font-size:9px; letter-spacing:4px; color:#ff4444; margin-bottom:16px; opacity:0.8; }
      .m1c-title { font-size:22px; letter-spacing:6px; font-weight:bold; color:#ff6666; margin-bottom:6px; }
      .m1c-sub   { font-size:10px; letter-spacing:2px; color:rgba(243,237,224,0.40); margin-bottom:22px; }
      .m1c-body  { font-size:12px; color:rgba(243,237,224,0.72); line-height:1.75; max-width:520px; margin-bottom:28px; }
      .m1c-btns  { display:flex; flex-direction:column; gap:11px; width:440px; }
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

      /* Zakończenie */
      #m1-ending {
        position:absolute; inset:0; background:rgba(3,0,0,0.98);
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        z-index:51; font-family:'Courier New',monospace; color:#f3ede0;
        pointer-events:all; opacity:0; transition:opacity 0.5s; text-align:center;
      }
      #m1-ending.vis { opacity:1; }
      .m1e-icon  { font-size:52px; margin-bottom:16px; }
      .m1e-title { font-size:22px; letter-spacing:8px; font-weight:bold; margin-bottom:7px; }
      .m1e-sub   { font-size:9px; letter-spacing:3px; color:rgba(243,237,224,0.38); margin-bottom:26px; }
      .m1e-body  { font-size:13px; color:rgba(243,237,224,0.75); line-height:1.9; max-width:540px; margin-bottom:34px; }
      .m1e-btn {
        background:none; font-family:'Courier New',monospace; font-size:11px;
        letter-spacing:3px; padding:11px 32px; cursor:pointer;
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
        <li>Zejdź poniżej termokliny i znikaj z radaru NATO</li>
        <li>Tryb nasłuch — wychwyć kontakt na namurale 127°</li>
        <li>Zbliż się do celu — unikaj sonarów DALLAS co 30s</li>
        <li>Zidentyfikuj aktywnym pingiem [Q]</li>
        <li>Przeżyj pościg — schowaj się pod termoklinem</li>
        <li>Zdecyduj — twoje sumienie, twój rozkaz</li>
      </ul>
      <div class="m1i-divider"></div>
      <button class="m1i-btn" id="m1i-start">▸ ROZPOCZĄĆ MISJĘ  [Enter]</button>
      <button class="m1i-skip" id="m1i-skip">Pomiń intro [Esc]</button>
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

  _showIntro() {
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
    this._showCard();
  }

  // ── Karta HUD ─────────────────────────────────────────────────────────────

  _buildCard() {
    const gc = document.getElementById('game-container');
    const el = document.createElement('div');
    el.id = 'm1-card';
    el.innerHTML = `
      <div id="m1c-head"><span id="m1c-title"></span></div>
      <div id="m1c-instr"></div>
      <div id="m1c-progress"><div id="m1c-pfill"></div></div>
      <div id="m1c-cond"></div>
    `;
    gc.appendChild(el);
    this._cardEl  = el;
    this._tcTitle = el.querySelector('#m1c-title');
    this._tcInstr = el.querySelector('#m1c-instr');
    this._tcPfill = el.querySelector('#m1c-pfill');
    this._tcCond  = el.querySelector('#m1c-cond');
  }

  _showCard() {
    if (this._cardEl) this._cardEl.classList.add('vis');
  }

  _hideCard() {
    if (this._cardEl) this._cardEl.classList.remove('vis');
  }

  // TutorialBot compatibility
  get _phase()    { return this._mstate; }
  get _inIntro()  { return !!this._introEl; }
  get _complete() { return this._finalShown; }
  set _complete(v){ this._finalShown = v; }
  get _tsContBtn(){ return null; }
}
