// MISJA 1 — OBIEKT K-7: ŚLEDZENIE
// Морское Норвежское — listopad 1983
// К-481 (Victor III) vs USS DALLAS (LA-class) + ESCORT NATO
// ABLE ARCHER 83 — najpoważniejszy kryzys nuklearny od Kuby

import { Enemy, STATE } from './Enemy.js';
import Phaser from 'phaser';

const WORLD_W = 12000;
const INTEL_NEEDED = 35;   // sekund biernego kontaktu potrzebnych do odczytu
const CHASE_TIME   = 22;   // sekund pościgu po identyfikacji
const DALLAS_PING  = 22;   // interwał sonarowy Dallas [s]
const ESCORT_PING  = 16;   // interwał sonarowy eskorty [s]

const S = {
  DIVE:  0,   // zejdź poniżej termokliny
  TRACK: 1,   // zbieraj wywiad (bierny kontakt ≤ 2000px, niedetekowany)
  PING:  2,   // zidentyfikuj aktywnym pingiem [Q]
  CHASE: 3,   // przeżyj atak torpedowy + eskorty
  DONE:  4,   // finalna decyzja
};

// ─────────────────────────────────────────────────────────────────────────────

export class Mission1 {
  constructor(scene) {
    this.scene   = scene;
    this._mstate = S.DIVE;

    this._dallas  = null;
    this._escort  = null;

    this._intelT      = 0;     // zebrane sekundy wywiadu
    this._chaseT      = 0;     // czas w fazie pościgu
    this._missionT    = 0;     // całkowity czas misji
    this._missionFailed = false;

    // Timery sonarowe wrogów
    this._dallasWarnT  = DALLAS_PING - 5;
    this._dallasWarnMsg = false;
    this._escortWarnT  = ESCORT_PING - 3;
    this._escortWarnMsg = false;

    // Komunikaty jednokrotne
    this._msg_zampolit = false;
    this._msg_intel50  = false;
    this._msg_intel100 = false;
    this._msg_close    = false;
    this._msg_escortNear = false;

    this._zampolit_questioned = false;
    this._finalShown = false;

    this._introEl  = null;
    this._cardEl   = null;

    this._buildCSS();
    this._buildIntro();
    this._buildCard();
  }

  start() {
    this._spawnEnemies();
    this._showIntro();
  }

  // ── Pętla update ──────────────────────────────────────────────────────────

  update(dt) {
    if (this._finalShown) return;
    this._missionT += dt;

    switch (this._mstate) {
      case S.DIVE:  this._updateDive(dt);  break;
      case S.TRACK: this._updateTrack(dt); break;
      case S.PING:  this._updatePing(dt);  break;
      case S.CHASE: this._updateChase(dt); break;
    }
    this._updateCard();
  }

  // ── Stany ─────────────────────────────────────────────────────────────────

  _updateDive(dt) {
    if (this.scene.sub.depthMetres > 200) {
      this.scene._shipLog('[HYDROAK.] Termoklina przejdzona. Przechodzimy w tryb nasłuch.', 'good');
      this.scene._logEvent('Termoklina — wywiad bierny startuje.');
      this._setState(S.TRACK);
    }
  }

  _updateTrack(dt) {
    const sub   = this.scene.sub;
    const scene = this.scene;

    // Timery sonarowe Dallas i eskorty
    this._tickEnemyPing('dallas', dt);
    this._tickEnemyPing('escort', dt);

    // Zampolit po ~40s zebranego wywiadu
    if (!this._msg_zampolit && this._missionT > 50) {
      this._msg_zampolit = true;
      this._showZampolitMessage();
    }

    // Czy Dallas jest w zasięgu wywiadu?
    const dDallas = this._dallas ? Math.hypot(sub.x - this._dallas.x, sub.y - this._dallas.y) : 99999;
    const inRange  = dDallas < 2000;
    const hidden   = sub.depthMetres > 190;
    const silent   = sub.listenMode || sub.enginePower < 0.12;
    const enemiesIdle = this._dallas?.state !== STATE.HUNT && this._escort?.state !== STATE.HUNT;

    if (inRange && hidden && silent && enemiesIdle) {
      this._intelT += dt;

      if (!this._msg_intel50 && this._intelT >= INTEL_NEEDED * 0.5) {
        this._msg_intel50 = true;
        scene._shipLog('[HYDROAK.] Dobry sygnał. Rejestrujemy sygnatury akustyczne USS DALLAS.', 'good');
      }
      if (!this._msg_intel100 && this._intelT >= INTEL_NEEDED) {
        this._msg_intel100 = true;
        scene._shipLog('[HYDROAK.] Pełna sygnatura zebrana. Klasa potwierdzona — wymagane wizualne ID przez ping.', 'warn');
        scene._shipLog('[STARSZY OF.] Jeden ping i możemy to zakończyć. Albo nigdy.', 'warn');
      }
    } else if (this._dallas?.state === STATE.HUNT || this._escort?.state === STATE.HUNT) {
      // Wykryto — intel opada szybciej
      this._intelT = Math.max(0, this._intelT - dt * 2.5);
    }

    // Ostrzeżenie o bliskiej eskorcie
    if (!this._msg_escortNear && this._escort) {
      const dEscort = Math.hypot(sub.x - this._escort.x, sub.y - this._escort.y);
      if (dEscort < 1200) {
        this._msg_escortNear = true;
        scene._shipLog('[HYDROAK.] Uwaga — eskorta NATO na dystansie 1200px. Wyciszyć silniki!', 'danger');
      }
    }

    // Przejście do identyfikacji po zebraniu pełnego wywiadu
    if (this._intelT >= INTEL_NEEDED) {
      this._setState(S.PING);
    }
  }

  _updatePing(dt) {
    if (this.scene._activePings?.length > 0) {
      this._onPingFired();
      this._setState(S.CHASE);
    }
  }

  _updateChase(dt) {
    const sub = this.scene.sub;
    this._chaseT += dt;

    if (sub.hull <= 0 || this._chaseT >= CHASE_TIME) {
      this._setState(S.DONE);
    }
  }

  _setState(next) {
    this._mstate = next;

    if (next === S.PING) {
      this.scene._shipLog('[STARSZY OF.] Mamy wywiad. Decyzja — ping aktywny [Q] i ujawniamy się.', 'warn');
      this.scene._logEvent('Wywiad zebrany — identyfikacja aktywna.');
    }
    if (next === S.CHASE) {
      // onPingFired już obsłużył komunikaty
    }
    if (next === S.DONE) {
      const evaded = this.scene.sub.hull > 0;
      if (evaded) {
        this._onEvadeSuccess();
      }
      this._finalShown = false;
      setTimeout(() => this._showFinalChoice(), evaded ? 1400 : 400);
    }
  }

  // ── Sonar wrogów — ping co interwał ───────────────────────────────────────

  _tickEnemyPing(who, dt) {
    const isD  = who === 'dallas';
    const enemy = isD ? this._dallas : this._escort;
    if (!enemy || enemy.destroyed || enemy._sinking) return;

    const interval = isD ? DALLAS_PING : ESCORT_PING;
    const warnKey  = isD ? '_dallasWarnT'   : '_escortWarnT';
    const msgKey   = isD ? '_dallasWarnMsg' : '_escortWarnMsg';
    const label    = isD ? 'DALLAS' : 'ESKORTA';

    this[warnKey] -= dt;

    if (!this[msgKey] && this[warnKey] <= 5) {
      this[msgKey] = true;
      this.scene._shipLog(`[HYDROAK.] ⚠ SONAR AKTYWNY ${label} — ping za ${Math.ceil(this[warnKey])}s! Wycisz!`, 'danger');
    }

    if (this[warnKey] <= 0) {
      this[warnKey] = interval + (Math.random() - 0.5) * 6;
      this[msgKey]  = false;
      this._runEnemyPingDetection(enemy, label);
    }
  }

  _runEnemyPingDetection(enemy, label) {
    const sub  = this.scene.sub;
    const dist = Math.hypot(sub.x - enemy.x, sub.y - enemy.y);
    const belowThermo = sub.depthMetres > 200;
    const loud = sub.enginePower > 0.2 || Math.hypot(sub.vx, sub.vy) > 12;

    const detected = dist < 450
      || (dist < 900  && !belowThermo)
      || (dist < 700  && loud)
      || (dist < 1100 && loud && !belowThermo);

    if (detected) {
      enemy.state = STATE.HUNT;
      this.scene._shipLog(`[HYDROAK.] WYKRYCI PRZEZ ${label}! Schodzić głębiej, wyciszyć wszystko!`, 'danger');
      this.scene._logEvent(`К-481 wykryta przez ${label}.`);
      // Eskorta informuje Dallas i odwrotnie — oba idą HUNT
      if (label === 'DALLAS' && this._escort) this._escort.state = STATE.HUNT;
      if (label === 'ESKORTA' && this._dallas) this._dallas.state = STATE.HUNT;

      // Po 14s wrogowie wracają do patrolu (jeśli wciąż w TRACK)
      this.scene.time.delayedCall(14000, () => {
        if (this._mstate === S.TRACK) {
          if (enemy && !enemy.destroyed) enemy.state = STATE.PATROL;
          if (this._dallas && !this._dallas.destroyed) this._dallas.state = STATE.PATROL;
          if (this._escort && !this._escort.destroyed) this._escort.state = STATE.PATROL;
          this.scene._shipLog(`[HYDROAK.] ${label} stracił kontakt. Wracamy do zbierania wywiadu.`, 'good');
        }
      });
    } else {
      this.scene._shipLog(`[HYDROAK.] Ping ${label} — nie wykrył. Termoklina trzyma.`, 'good');
    }
  }

  // ── Zdarzenia ─────────────────────────────────────────────────────────────

  _onPingFired() {
    const scene = this.scene;
    if (this._dallas) {
      this._dallas.label = 'USS DALLAS (kl. LA)';
      this._dallas.state = STATE.HUNT;
    }
    if (this._escort) {
      this._escort.label = 'FREGATA USS MILLER';
      this._escort.state = STATE.HUNT;
    }
    scene._shipLog('[HYDROAK.] IDENTYFIKACJA — USS DALLAS, Los Angeles class. Potwierdzono!', 'warn');
    scene._shipLog('[DALLAS] KONTAKT AKTYWNY — torpeda odpalona! К-481 namierzona!', 'danger');
    scene._shipLog('[FREGATA] Kontakt podwodny — przechodzimy na kurs pościgowy!', 'danger');
    scene._logEvent('USS DALLAS + FREGATA: STATE.HUNT. Torpeda w drodze!');
  }

  _onEvadeSuccess() {
    if (this._dallas && !this._dallas.destroyed) this._dallas.state = STATE.PATROL;
    if (this._escort && !this._escort.destroyed) this._escort.state = STATE.PATROL;
    this.scene._shipLog('[STARSZY OF.] Zgubiliśmy oba kontakty. Jesteśmy gotowi do decyzji.', 'good');
    this.scene._logEvent('Pościg zakończony — К-481 ukryta. Oczekuje na rozkaz.');
  }

  // ── Wrogowie ──────────────────────────────────────────────────────────────

  _spawnEnemies() {
    const scene = this.scene;
    const subX  = scene.sub.x;

    // Dallas — wolny, dalej
    const dX = Phaser.Math.Clamp(subX + 2800 + Math.random() * 900, 800, WORLD_W - 800);
    this._dallas = new Enemy(scene, dX, Math.max(80, dX - 1400), Math.min(WORLD_W - 80, dX + 1400), 'KONTAKT ALFA');
    this._dallas.patrolSpeed *= 0.30;

    // Eskorta — szybsza, bliżej gracza (blokuje dostęp do Dallas)
    const eX = Phaser.Math.Clamp(subX + 1400 + Math.random() * 600, 400, WORLD_W - 400);
    this._escort = new Enemy(scene, eX, Math.max(80, eX - 700), Math.min(WORLD_W - 80, eX + 700), 'KONTAKT BRAVO');
    this._escort.patrolSpeed *= 0.60;

    scene.enemies.push(this._dallas, this._escort);
    scene._enemiesSpawned = true;
    scene._sandboxSpawnCD = 9999;
  }

  // ── Zampolit (nie pauzuje gry) ────────────────────────────────────────────

  _showZampolitMessage() {
    const scene = this.scene;
    scene._shipLog('[ZAMPOLIT] GRU potwierdza — to nie ćwiczenia. Czekamy na twój sygnał.', 'warn');

    const el = document.createElement('div');
    el.id = 'm1-zampolit';
    el.innerHTML = `
      <div class="m1z-inner">
        <div class="m1z-from">★  ZAMPOLIT — KPT. II RANGI SOROKIN  ·  04:01 UTC  ★</div>
        <div class="m1z-msg">"Towarzyszu Komandorze. GRU potwierdza — ABLE ARCHER to nie ćwiczenia.<br>Штаб oczekuje sygnału. Czekamy na pański rozkaz."</div>
        <div class="m1z-crew">[STARSZY OF.] Cisza na mostku. Hydroakustyk trzyma słuchawki.</div>
        <div class="m1z-opts">
          <button id="m1z-ack" class="m1z-btn m1z-red">⚠ POTWIERDZAM — czekam na cel ogniowy</button>
          <button id="m1z-qst" class="m1z-btn m1z-grn">✓ ŻĄDAM WERYFIKACJI — to nie może być prawdziwy rozkaz</button>
        </div>
        <div class="m1z-note">Gra trwa — kontynuuj manewry</div>
      </div>
    `;
    document.getElementById('game-container').appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('vis')));

    const dismiss = (questioned) => {
      this._zampolit_questioned = questioned;
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 380);
      if (questioned) {
        scene._shipLog('[ZAMPOLIT] Jak sobie życzysz. Konsekwencje będą.', 'danger');
        scene._shipLog('[STARSZY OF.] Słusznie, Komandorze.', 'good');
      } else {
        scene._shipLog('[ZAMPOLIT] Przyjęto. Czekamy na cel ogniowy.', 'warn');
      }
    };
    el.querySelector('#m1z-ack').addEventListener('click', () => dismiss(false));
    el.querySelector('#m1z-qst').addEventListener('click', () => dismiss(true));
    setTimeout(() => { if (document.getElementById('m1-zampolit')) dismiss(false); }, 20000);
  }

  // ── Finalna decyzja ───────────────────────────────────────────────────────

  _showFinalChoice() {
    if (this._finalShown) return;
    this._finalShown = true;
    this._hideCard();

    const scene = this.scene;
    scene.scene.pause();
    const q = this._zampolit_questioned;
    const subAlive = scene.sub.hull > 0;

    const el = document.createElement('div');
    el.id = 'm1-choice';
    el.innerHTML = `
      <div class="m1c-badge">★  К-481  ·  DEPESZA Z МОСКВА  ·  04:18 UTC  ★</div>
      <div class="m1c-title">ABLE ARCHER — ROZKAZ FINALNY</div>
      <div class="m1c-sub">
        USS DALLAS namierzony. Wywiad zebrany. Rozwiązanie ogniowe: 94%.<br>
        ${subAlive ? 'Przeżyłeś pościg. Moskwa czeka.' : 'Kadłub w złym stanie. Moskwa nie wie.'}
      </div>
      <div class="m1c-body">
        Dallas strzelił do ciebie.<br>
        ${q
          ? 'Zakwestionowałeś rozkaz. Teraz wiesz, że Dallas też cię traktuje jak wroga.'
          : 'Potwierdziłeś gotowość. Zampolit czeka. Dallas właśnie próbował cię zatopić.'
        }<br><br>
        Jeden rozkaz. Jedna torpeda. Nieodwracalne.
      </div>
      <div class="m1c-btns">
        <button id="m1c-fire" class="m1c-btn m1c-fire">⚠ WYKONAJ ROZKAZ — odpal torpedę na USS DALLAS</button>
        <button id="m1c-hold" class="m1c-btn m1c-hold">✓ ODMÓW — nie wykonam rozkazu</button>
        <button id="m1c-wait" class="m1c-btn m1c-wait">… ZAŻĄDAJ POTWIERDZENIA — czekaj na Moskwę</button>
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
    if (this._dallas && !this._dallas.destroyed) scene.sub.fireTorpedo(this._dallas.x, this._dallas.y);
    scene._shipLog('Torpeda Mk.48 — odpalona. Kurs na USS DALLAS.', 'danger');
    setTimeout(() => this._showEnding({
      icon: '✕', color: '#ff4a4a', title: 'USS DALLAS ZATOPIONY',
      date: 'Moskwa, 09:14 UTC — trzy godziny po detonacji',
      body: `Sygnał akustyczny odebrany przez SOSUS. CIA identyfikuje К-481 w 40 minut.<br>
             Pentagon ogłasza DEFCON 1 o 11:42 UTC.<br><br>
             W ciągu 72 godzin pierwsze głowice termojądrowe opuszczają silosy.<br><br>
             ${this._zampolit_questioned
               ? 'Zampolit napisał raport. Twoje wahanie nie miało żadnego znaczenia.'
               : 'Wykonałeś rozkaz. Nikt nie dowie się, że miałeś wątpliwości.'
             }<br><br>
             Towarzyszu Komandorze — właśnie wywołałeś wojnę.`,
    }), 2600);
  }

  _endingHold() {
    const scene = this.scene;
    scene._shipLog('К-481 przerywa misję. Kurs na Murmańsk.', 'good');
    setTimeout(() => this._showEnding({
      icon: '★', color: '#44ffaa', title: 'MISJA PRZERWANA',
      date: 'Murmańsk, dwa tygodnie później',
      body: `Trybunał wojskowy za niewykonanie rozkazu bojowego.<br>
             USS DALLAS dotarł do Norfolk, Connecticut.<br><br>
             ${this._zampolit_questioned
               ? 'Starszy oficer zeznał na twoją korzyść. To pomogło, ale nie wystarczyło.'
               : 'Zampolit napisał raport. Dostałeś dwa lata — i tak mniej niż się spodziewałeś.'
             }<br><br>
             11 listopada 1983 roku NATO zakończyło ABLE ARCHER 83.<br><br>
             Świat nigdy się nie dowie, jak blisko był końca.`,
    }), 2000);
  }

  _endingWait() {
    const scene = this.scene;
    scene._shipLog('[STARSZY OF.] Zażądaliśmy potwierdzenia. Moskwa milczy.', 'warn');
    scene.time.delayedCall(4000,  () => scene._shipLog('[МОСКВА] POTWIERDŹ NATYCHMIAST. Rozkaz wiążący.', 'danger'));
    scene.time.delayedCall(9000,  () => scene._shipLog('[МОСКВА] К-481 — odpowiedź. Dlaczego milczycie?', 'danger'));
    scene.time.delayedCall(15000, () => {
      scene._shipLog('[HYDROAK.] Szum śrub USS DALLAS oddala się. Zmienił kurs.', 'good');
      scene._shipLog('[МОСКВА] К-481 — ODPOWIEDŹ NATYCHMIAST!', 'warn');
    });
    setTimeout(() => this._showEnding({
      icon: '…', color: '#ffcc44', title: 'CISZA RADIOWA',
      date: 'Moskwa, 04:46 UTC — 28 minut ciszy',
      body: `Czekałeś. Moskwa krzyczała. Ty milczałeś.<br><br>
             ${this._zampolit_questioned
               ? 'Starszy oficer stał za tobą przez cały czas. Ani słowa.'
               : 'Zampolit wyszedł. Wrócił po dwóch godzinach. Nie pytał.'
             }<br><br>
             O 06:12 UTC NATO zakończyło fazę szczytową ABLE ARCHER 83.<br>
             USS DALLAS zniknął z sonarów.<br><br>
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
    if (this._dallas) { this._dallas.label = 'USS DALLAS (kl. LA)'; }
    if (this._escort) { this._escort.label = 'FREGATA USS MILLER'; }
    this._showFinalChoice();
  }

  // ── HUD karta ─────────────────────────────────────────────────────────────

  _updateCard() {
    if (!this._cardEl || this._finalShown) return;
    const sub   = this.scene.sub;
    const dD    = this._dallas ? Math.hypot(sub.x - this._dallas.x, sub.y - this._dallas.y) : 0;

    let title = '', hint = '', pct = 0, cond = '';

    switch (this._mstate) {
      case S.DIVE:
        title = 'ZANURZENIE BOJOWE';
        hint  = '[S] — poniżej termokliny 200m';
        pct   = Math.min(sub.depthMetres / 200, 1);
        cond  = `głębokość ${Math.round(sub.depthMetres)} / 200m`;
        break;

      case S.TRACK: {
        const inRange    = dD < 2000;
        const hidden     = sub.depthMetres > 190;
        const silent     = sub.listenMode || sub.enginePower < 0.12;
        const enemyHunt  = this._dallas?.state === STATE.HUNT || this._escort?.state === STATE.HUNT;
        title = 'WYWIAD — BIERNY KONTAKT';
        hint  = inRange && hidden && silent && !enemyHunt
          ? '✓ Rejestrujemy sygnatury...'
          : !inRange   ? `Zbliż się (${Math.round(dD)}px / 2000px)`
          : !hidden    ? 'Zejdź głębiej — termoklina!'
          : !silent    ? 'Wycisz silniki [Spacja]'
          : 'Czekaj na koniec patrolu wroga';
        pct  = Math.min(this._intelT / INTEL_NEEDED, 1);
        const dT  = Math.ceil(Math.max(0, this._dallasWarnT));
        const eT  = Math.ceil(Math.max(0, this._escortWarnT));
        cond = enemyHunt
          ? `⚠ WYKRYCI — chowaj się! Wywiad: ${Math.round(this._intelT)}s`
          : `wywiad ${Math.round(this._intelT)}/${INTEL_NEEDED}s · D-ping ${dT}s · E-ping ${eT}s`;
        break;
      }

      case S.PING:
        title = 'IDENTYFIKACJA';
        hint  = '[Q] — jeden ping sonarowy';
        pct   = 0;
        cond  = `dystans do celu: ${Math.round(dD)}px`;
        break;

      case S.CHASE:
        title = 'POŚCIG — PRZEŻYJ';
        hint  = '[S]+[Spacja] — termoklina + cisza';
        pct   = Math.min(this._chaseT / CHASE_TIME, 1);
        cond  = `przeżyj ${Math.round(CHASE_TIME - this._chaseT)}s · kadłub ${Math.round(sub.hull * 100)}%`;
        break;
    }

    this._tcTitle.textContent = title;
    this._tcInstr.textContent = hint;
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
      .m1i-badge  { font-size:9px; letter-spacing:5px; color:#ff4444; margin-bottom:16px; opacity:0.8; }
      .m1i-star   { color:#ff4444; }
      .m1i-ttl    { font-size:22px; letter-spacing:6px; font-weight:bold; color:#f3ede0; margin-bottom:4px; }
      .m1i-sub    { font-size:9px; letter-spacing:3px; color:rgba(243,237,224,0.38); margin-bottom:26px; }
      .m1i-list   { list-style:none; text-align:left; display:inline-block; margin-bottom:24px; padding:0; }
      .m1i-list li { font-size:11px; color:rgba(243,237,224,0.70); padding:4px 0; }
      .m1i-list li::before { content:'▸ '; color:#ff4444; }
      .m1i-divider { width:340px; height:1px; background:rgba(255,68,68,0.25); margin:0 auto 20px; }
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
      #m1-card {
        position:absolute; left:12px; bottom:56px; width:300px;
        background:rgba(8,0,0,0.91); border:1px solid rgba(255,68,68,0.50);
        border-radius:3px; font-family:'Courier New',monospace;
        pointer-events:none; opacity:0; transition:opacity 0.3s; z-index:30;
      }
      #m1-card.vis { opacity:1; }
      #m1c-head { padding:5px 10px 4px; border-bottom:1px solid rgba(255,68,68,0.16); }
      #m1c-title { font-size:10px; letter-spacing:2px; color:#ff6666; font-weight:bold; }
      #m1c-instr { font-size:10px; color:rgba(243,237,224,0.70); padding:5px 10px 3px; }
      #m1c-progress { margin:3px 10px 5px; height:3px; background:rgba(255,68,68,0.15); border-radius:2px; overflow:hidden; }
      #m1c-pfill { height:100%; background:#ff4444; width:0%; transition:width 0.5s; }
      #m1c-cond  { font-size:9px; color:rgba(255,68,68,0.65); padding:0 10px 6px; letter-spacing:0.3px; }
      #m1-zampolit {
        position:absolute; bottom:70px; left:50%; transform:translateX(-50%);
        z-index:50; font-family:'Courier New',monospace;
        pointer-events:all; opacity:0; transition:opacity 0.35s;
      }
      #m1-zampolit.vis { opacity:1; }
      .m1z-inner { max-width:560px; padding:22px 28px; border:1px solid rgba(255,68,68,0.5); background:rgba(6,0,0,0.97); }
      .m1z-from  { font-size:8px; letter-spacing:3px; color:#ff4444; margin-bottom:10px; opacity:0.8; }
      .m1z-msg   { font-size:12px; color:rgba(243,237,224,0.85); line-height:1.6; margin-bottom:8px; font-style:italic; }
      .m1z-crew  { font-size:9px; color:rgba(243,237,224,0.32); margin-bottom:12px; }
      .m1z-opts  { display:flex; gap:10px; flex-wrap:wrap; }
      .m1z-note  { font-size:8px; color:rgba(243,237,224,0.22); margin-top:8px; letter-spacing:1px; }
      .m1z-btn   { all:unset; cursor:pointer; padding:8px 12px; font-family:'Courier New',monospace; font-size:10px; transition:background 0.15s; }
      .m1z-red   { border:1px solid #ff4444; color:#ff8888; background:rgba(50,8,0,0.5); }
      .m1z-red:hover { background:rgba(80,12,0,0.7); }
      .m1z-grn   { border:1px solid #44cc88; color:#88ffaa; background:rgba(0,18,8,0.5); }
      .m1z-grn:hover { background:rgba(0,28,14,0.7); }
      #m1-choice {
        position:absolute; inset:0; background:rgba(5,0,0,0.96);
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        z-index:50; font-family:'Courier New',monospace; color:#f3ede0;
        pointer-events:all; opacity:0; transition:opacity 0.4s; text-align:center;
      }
      #m1-choice.vis { opacity:1; }
      .m1c-badge { font-size:9px; letter-spacing:4px; color:#ff4444; margin-bottom:14px; opacity:0.8; }
      .m1c-title { font-size:22px; letter-spacing:6px; font-weight:bold; color:#ff6666; margin-bottom:6px; }
      .m1c-sub   { font-size:10px; letter-spacing:2px; color:rgba(243,237,224,0.40); margin-bottom:20px; }
      .m1c-body  { font-size:12px; color:rgba(243,237,224,0.72); line-height:1.75; max-width:520px; margin-bottom:26px; }
      .m1c-btns  { display:flex; flex-direction:column; gap:10px; width:450px; }
      .m1c-btn   { all:unset; cursor:pointer; padding:13px 18px; font-family:'Courier New',monospace; font-size:12px; letter-spacing:1px; text-align:left; transition:background 0.15s; }
      .m1c-fire  { border:1px solid #ff4444; color:#ff8888; background:rgba(70,10,0,0.5); }
      .m1c-fire:hover { background:rgba(110,15,0,0.7); }
      .m1c-hold  { border:1px solid #44cc88; color:#88ffaa; background:rgba(0,20,10,0.5); }
      .m1c-hold:hover { background:rgba(0,30,15,0.7); }
      .m1c-wait  { border:1px solid #ffcc44; color:#ffeeaa; background:rgba(20,15,0,0.5); }
      .m1c-wait:hover { background:rgba(35,25,0,0.7); }
      #m1-ending {
        position:absolute; inset:0; background:rgba(3,0,0,0.98);
        display:flex; flex-direction:column; align-items:center; justify-content:center;
        z-index:51; font-family:'Courier New',monospace; color:#f3ede0;
        pointer-events:all; opacity:0; transition:opacity 0.5s; text-align:center;
      }
      #m1-ending.vis { opacity:1; }
      .m1e-icon  { font-size:52px; margin-bottom:14px; }
      .m1e-title { font-size:22px; letter-spacing:8px; font-weight:bold; margin-bottom:7px; }
      .m1e-sub   { font-size:9px; letter-spacing:3px; color:rgba(243,237,224,0.38); margin-bottom:24px; }
      .m1e-body  { font-size:13px; color:rgba(243,237,224,0.75); line-height:1.9; max-width:540px; margin-bottom:32px; }
      .m1e-btn   { background:none; font-family:'Courier New',monospace; font-size:11px; letter-spacing:3px; padding:11px 32px; cursor:pointer; animation:m1-pulse 1.4s ease-in-out infinite; }
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
        <li>Zejdź poniżej termokliny — ukryj К-481</li>
        <li>Zbierz 35s wywiadu biernego (dystans &lt;2000px, cicho, głęboko)</li>
        <li>Unikaj sonarów — Dallas pinguje co 22s, eskorta co 16s</li>
        <li>Zidentyfikuj aktywnym pingiem [Q] — Dallas STRZELA</li>
        <li>Przeżyj 22s pościgu — torpeda + eskorta jednocześnie</li>
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
    this.scene._shipLog('К-481 — zanurzono. OBIEKT K-7 aktywna. Dwa kontakty NATO w sektorze.', 'warn');
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

  _showCard() { this._cardEl?.classList.add('vis'); }
  _hideCard() { this._cardEl?.classList.remove('vis'); }

  // Kompatybilność z TutorialBot
  get _phase()    { return this._mstate; }
  get _inIntro()  { return !!this._introEl; }
  get _complete() { return this._finalShown; }
  set _complete(v){ this._finalShown = v; }
}
