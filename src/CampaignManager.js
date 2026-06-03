import Phaser from 'phaser';
import { Enemy } from './Enemy.js';
import { Merchant } from './Merchant.js';

const WORLD_W = 12000;

const MISSION_DEFS = [
  {
    id: 'M1', title: 'MISJA 1 — OPERACJA NEPTUN',
    area: 'Zatoka Gdańska — październik 1989',
    briefing: [
      'BPK «NIEUSTRASZONY» — okręt bojowy Układu Warszawskiego — przekroczył linię neutralną.',
      'Warszawa wydała rozkaz: zlokalizuj sonarowo i zatop jednostkę zanim wejdzie w strefę ochronną.',
      'Cisza radiowa. Nie ma miejsca na błąd, komandorze.',
    ],
    objectives: ['Wykryj i sklasyfikuj BPK sonarowo', 'Zatop BPK «NIEUSTRASZONY»'],
  },
  {
    id: 'M2', title: 'MISJA 2 — NIEZNANY KONTAKT',
    area: 'Cieśnina Bornholmska — godzina 02:17',
    briefing: [
      'Na kursie KONDORA wykryto niezidentyfikowany okręt. Brak transponderów IFF.',
      'Moskwa żąda natychmiastowego ataku. Warszawa: czekaj na identyfikację.',
      'Decyzja należy do ciebie — i zostanie zapamiętana.',
    ],
    objectives: ['Wykryj kontakt sonarowo', 'Podjęcie decyzji operacyjnej'],
  },
  {
    id: 'M3', title: 'MISJA 3 — ESKORTA STOCZNIA-7',
    area: 'Morze Bałtyckie — kotwicowisko neutralne',
    briefing: [
      'Statek handlowy STOCZNIA-7 przewozi materiały strategiczne pod flagą neutralną.',
      'Dwa sowieckie okręty patrolowe blokują szlak morski.',
      'ORP KONDOR ma eskortować konwój do strefy bezpiecznej. Dyskretna operacja.',
    ],
    objectives: ['Eskorta STOCZNIA-7 do strefy x>8000', 'Nie daj jej zatonąć'],
  },
  {
    id: 'M4', title: 'MISJA 4 — POLE MINOWE',
    area: 'Rejon R-27 — wody zaminowane',
    briefing: [
      'Rejon R-27 — sowieckie pole minowe zakładane w tajemnicy od 1986 roku.',
      'Odbiorca paczki czeka w strefie x>8000. Sonar wykryje miny w promieniu 260m.',
      'Pole detonacji: 78m. Po 90 sekundach awaria układu sterowania — uważaj.',
    ],
    objectives: ['Przeżyj pole minowe', 'Dotrzyj do strefy odbioru (x > 8000)'],
  },
  {
    id: 'M5', title: 'MISJA 5 — OSTATNI ROZKAZ',
    area: 'Koordynaty utajnione — finał operacji',
    briefing: [
      'Dotarły dwie wiadomości. Moskwa: odpał głowice na bazę NATO w Rønne.',
      'Warszawa: przerywamy operację — kurs na Gotlandię, tam czeka azyl.',
      'Ten rozkaz wykona tylko twoje sumienie. Co wybrał ORP KONDOR?',
    ],
    objectives: ['Podjęcie ostatecznej decyzji'],
  },
];

export class CampaignManager {
  constructor(scene) {
    this.scene = scene;

    this._missionIdx    = -1;
    this._reputation    = 0;
    this._active        = false;
    this._transitioning = false;

    // M1
    this._m1Target   = null;
    this._m1Detected = false;

    // M2
    this._m2Target      = null;
    this._m2Timer       = 0;
    this._m2ChoiceShown = false;
    this._m2Complete    = false;

    // M3
    this._m3Merchant = null;
    this._m3Failed   = false;
    this._m3Complete = false;

    // M4
    this._mines          = [];
    this._minesGfx       = null;
    this._m4Complete     = false;
    this._m4FailureT     = 0;
    this._m4FailureFired = false;

    // M5
    this._m5ChoiceMade = false;

    this._panelEl = document.getElementById('mission-panel');
    this._nameEl  = document.getElementById('mission-name');
    this._objEl   = document.getElementById('mission-objectives');

    this._overlayEl = null;
    this._buildOverlay();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  start() {
    this._active = true;
    this._showBriefing(0, () => this._setupMission(0));
  }

  update(dt) {
    if (!this._active || this._transitioning) return;
    switch (this._missionIdx) {
      case 0: this._updateM1(dt); break;
      case 1: this._updateM2(dt); break;
      case 2: this._updateM3(dt); break;
      case 3: this._updateM4(dt); break;
      case 4: this._updateM5(dt); break;
    }
  }

  onEnemyDestroyed(enemy) {
    if (this._missionIdx === 0 && enemy === this._m1Target) this._m1OnDestroy();
  }

  onMerchantDestroyed(merchant) {
    if (this._missionIdx === 2 && merchant === this._m3Merchant) this._m3OnLose();
  }

  // ── Misja 1 — Operacja Neptun ──────────────────────────────────────────────

  _setupM1() {
    const scene = this.scene;
    const subX  = scene.sub.x;
    const side  = Math.random() < 0.5 ? 1 : -1;
    const dist  = 2800 + Math.random() * 800;
    const tX    = Phaser.Math.Clamp(subX + side * dist, 400, WORLD_W - 400);
    const hw    = 900 + Math.random() * 600;
    const pL    = Math.max(80, tX - hw);
    const pR    = Math.min(WORLD_W - 80, tX + hw);

    this._m1Target   = new Enemy(scene, tX, pL, pR, 'BPK «NIEUSTRASZONY»');
    this._m1Target.patrolSpeed *= 0.65;
    this._m1Detected = false;
    scene.enemies.push(this._m1Target);
    scene._enemiesSpawned = true;
    scene._sandboxSpawnCD = 45;

    this._setUI('OPERACJA NEPTUN', [
      { text: 'Wykryj i sklasyfikuj BPK sonarowo', done: false },
      { text: 'Zatop BPK «NIEUSTRASZONY»',          done: false },
    ]);

    scene._shipLog(
      'ROZKAZ OPERACYJNY — OPERACJA NEPTUN: BPK «NIEUSTRASZONY» przechwycony na ŁB-22/N. ' +
      'Cel: zlokalizuj sonarowo i zatop niszczyciel przed wejściem w strefę ochronną. Cisza radiowa.',
      'danger'
    );
    scene._logEvent('OPERACJA NEPTUN — BPK w sektorze. Zlokalizuj i zniszcz.');
  }

  _updateM1() {
    if (!this._m1Target || this._m1Detected) return;
    if (this._m1Target.destroyed || this._m1Target._sinking) return;
    const cls = this._m1Target.contactClass;
    if (cls === 'WARSHIP' || cls === 'SURFACE') {
      this._m1Detected = true;
      this._setUI('OPERACJA NEPTUN', [
        { text: 'Wykryj i sklasyfikuj BPK sonarowo', done: true  },
        { text: 'Zatop BPK «NIEUSTRASZONY»',          done: false },
      ]);
      this.scene._shipLog('Klasyfikacja sonarowa: BPK — okręt wojenny. Zatwierdzone otwarcie ognia.', 'good');
      this.scene._logEvent('BPK sklasyfikowany — wolna ręka do ataku.');
    }
  }

  _m1OnDestroy() {
    this.scene._shipLog('BPK «NIEUSTRASZONY» zatopiony. Operacja Neptun zakończona sukcesem.', 'good');
    this.scene._logEvent('Cel wyeliminowany.');
    this._setUI('OPERACJA NEPTUN', [
      { text: 'Wykryj i sklasyfikuj BPK sonarowo', done: true },
      { text: 'Zatop BPK «NIEUSTRASZONY»',          done: true },
    ]);
    this._reputation += 1;
    this._transitionNext();
  }

  // ── Misja 2 — Nieznany Kontakt ─────────────────────────────────────────────

  _setupM2() {
    const scene = this.scene;
    for (const e of scene.enemies) { e.gfx?.destroy(); e.fireGfx?.destroy(); e._sprite?.destroy(); }
    scene.enemies = [];
    for (const m of scene.merchants) m.gfx?.destroy();
    scene.merchants = [];
    scene._enemiesSpawned = true;
    scene._sandboxSpawnCD = 9999;

    const subX = scene.sub.x;
    const tX   = Phaser.Math.Clamp(subX + 3200, 400, WORLD_W - 400);
    this._m2Target = new Enemy(scene, tX, tX - 700, tX + 700, 'KONTAKT ALFA');
    this._m2Target.patrolSpeed *= 0.45;
    scene.enemies.push(this._m2Target);

    this._m2Timer       = 0;
    this._m2ChoiceShown = false;
    this._m2Complete    = false;

    this._setUI('NIEZNANY KONTAKT', [
      { text: 'Wykryj kontakt sonarowo', done: false },
      { text: 'Podjęcie decyzji operacyjnej', done: false },
    ]);
    scene._shipLog(
      'KONTAKT ALFA — niezidentyfikowany okręt. Brak transponderów IFF. ' +
      'Moskwa: atak natychmiastowy. Warszawa: czekaj na identyfikację.',
      'warn'
    );
    scene._logEvent('M2: Niezidentyfikowany kontakt w sektorze.');
  }

  _updateM2(dt) {
    if (this._m2Complete || this._m2ChoiceShown) return;
    if (!this._m2Target) return;
    this._m2Timer += dt;

    const cls      = this._m2Target.contactClass;
    const detected = cls && cls !== 'UNKNOWN';

    if (detected || this._m2Timer >= 60) {
      this._m2ChoiceShown = true;
      this._setUI('NIEZNANY KONTAKT', [
        { text: 'Wykryj kontakt sonarowo', done: true },
        { text: 'Podjęcie decyzji operacyjnej', done: false },
      ]);
      this._showChoice(
        'NIEZNANY KONTAKT — ROZKAZY SPRZECZNE',
        `Kontakt: ${cls || 'niezidentyfikowany'}. Co rozkażesz, komandorze?`,
        'ROZKAZ MOSKWY — otwórz ogień natychmiast',
        'ROZKAZ WARSZAWY — wycofaj się, nie atakuj',
        () => this._m2ChoiceMoscow(),
        () => this._m2ChoiceWarsaw(),
      );
    }
  }

  _m2ChoiceMoscow() {
    this._reputation -= 1;
    if (this._m2Target && !this._m2Target.destroyed) {
      this._m2Target.hull = 0;
      this._m2Target.startSinking();
    }
    this._m2Complete = true;
    this.scene._shipLog('Rozkaz Moskwy wykonany. Torpedo odpalona. Cel zatopiony.', 'warn');
    this.scene._logEvent('M2: Kontakt ALFA wyeliminowany — rozkaz Moskwy.');
    this._setUI('NIEZNANY KONTAKT', [
      { text: 'Wykryj kontakt sonarowo', done: true },
      { text: 'Rozkaz Moskwy — atak wykonany', done: true },
    ]);
    this._transitionNext();
  }

  _m2ChoiceWarsaw() {
    this._reputation += 1;
    if (this._m2Target) {
      this._m2Target.gfx?.destroy();
      this._m2Target.fireGfx?.destroy();
      this._m2Target._sprite?.destroy();
      this.scene.enemies = this.scene.enemies.filter(e => e !== this._m2Target);
      this._m2Target = null;
    }
    this._m2Complete = true;
    this.scene._shipLog('Rozkaz Warszawy wykonany. Kontakt ALFA znika z ekranu sonarowego.', 'good');
    this.scene._logEvent('M2: Wycofano — rozkaz Warszawy.');
    this._setUI('NIEZNANY KONTAKT', [
      { text: 'Wykryj kontakt sonarowo', done: true },
      { text: 'Rozkaz Warszawy — wycofano', done: true },
    ]);
    this._transitionNext();
  }

  // ── Misja 3 — Eskorta STOCZNIA-7 ──────────────────────────────────────────

  _setupM3() {
    const scene = this.scene;
    for (const e of scene.enemies) { e.gfx?.destroy(); e.fireGfx?.destroy(); e._sprite?.destroy(); }
    scene.enemies = [];
    for (const m of scene.merchants) m.gfx?.destroy();
    scene.merchants = [];
    scene._enemiesSpawned = true;
    scene._sandboxSpawnCD = 9999;

    const subX = scene.sub.x;
    this._m3Merchant = new Merchant(scene, subX + 500, 1, 'STOCZNIA-7');
    scene.merchants.push(this._m3Merchant);

    const e1X = Phaser.Math.Clamp(subX + 2800, 400, WORLD_W - 400);
    const e2X = Phaser.Math.Clamp(subX + 5800, 400, WORLD_W - 400);
    const e1  = new Enemy(scene, e1X, e1X - 700, e1X + 700, 'PATROL ALFA');
    const e2  = new Enemy(scene, e2X, e2X - 700, e2X + 700, 'PATROL BRAVO');
    scene.enemies.push(e1, e2);

    this._m3Failed   = false;
    this._m3Complete = false;

    this._setUI('ESKORTA STOCZNIA-7', [
      { text: 'Eskorta STOCZNIA-7 do strefy x>8000', done: false },
      { text: 'Nie daj statku zatonąć',               done: false },
    ]);
    scene._shipLog(
      'STOCZNIA-7 — manifest: sprzęt elektroniczny, flaga neutralna. ' +
      'Sowieckie patrole blokują szlak. Eskorta do strefy bezpiecznej (x > 8000).',
      'info'
    );
    scene._logEvent('M3: Eskorta STOCZNIA-7 — misja startuje.');
  }

  _updateM3() {
    if (this._m3Failed || this._m3Complete || this._transitioning) return;
    const m = this._m3Merchant;
    if (!m || m.destroyed) return;
    if (m.x >= 8000) {
      this._m3Complete = true;
      this._reputation += 1;
      this.scene._shipLog('STOCZNIA-7 dotarła do strefy bezpiecznej. Eskorta zakończona sukcesem.', 'good');
      this.scene._logEvent('M3: Eskorta zakończona pomyślnie.');
      this._setUI('ESKORTA STOCZNIA-7', [
        { text: 'Eskorta STOCZNIA-7 do strefy x>8000', done: true },
        { text: 'Statek dotarł bezpiecznie',            done: true },
      ]);
      this._transitionNext();
    }
  }

  _m3OnLose() {
    if (this._m3Failed) return;
    this._m3Failed = true;
    this._reputation -= 1;
    this.scene._shipLog('STOCZNIA-7 zatopiona. Misja nieudana.', 'danger');
    this.scene._logEvent('M3: Cel handlowy utracony — misja nieudana.');
    this._setUI('ESKORTA STOCZNIA-7', [
      { text: 'Eskorta STOCZNIA-7 do strefy x>8000', done: false },
      { text: 'MISJA NIEUDANA — STOCZNIA-7 zatopiona', done: false },
    ]);
    this.scene.time.delayedCall(3000, () => {
      if (this._active) this._transitionNext();
    });
  }

  // ── Misja 4 — Pole Minowe ─────────────────────────────────────────────────

  _setupM4() {
    const scene = this.scene;
    for (const e of scene.enemies) { e.gfx?.destroy(); e.fireGfx?.destroy(); e._sprite?.destroy(); }
    scene.enemies = [];
    for (const m of scene.merchants) m.gfx?.destroy();
    scene.merchants = [];
    scene._enemiesSpawned = true;
    scene._sandboxSpawnCD = 9999;

    this._m4Complete     = false;
    this._m4FailureT     = 0;
    this._m4FailureFired = false;

    const subX = scene.sub.x;
    const offsets = [1800, 2700, 3400, 4200, 4900, 5700, 6400, 7100];
    const yVariants = [380, 200, 450, 280, 180, 420, 260, 350];
    this._mines = offsets.map((off, i) => ({
      x: subX + off, y: yVariants[i],
      hit: false, blastR: 78, detectR: 260,
    }));

    this._minesGfx = scene.add.graphics().setDepth(13);

    this._setUI('POLE MINOWE', [
      { text: 'Przeżyj pole minowe',             done: false },
      { text: 'Dotrzyj do strefy odbioru x>8000', done: false },
    ]);
    scene._shipLog(
      'Rejon R-27 — sowieckie pole minowe. Sonar pasywny wykrywa miny w promieniu 260m. ' +
      'Eksplozja w 78m. Po 90s awaria układu sterowania — moc ograniczona.',
      'danger'
    );
    scene._logEvent('M4: Wchodzimy w pole minowe.');
  }

  _updateM4(dt) {
    if (this._m4Complete || this._transitioning) return;
    const scene = this.scene;
    const sub   = scene.sub;

    this._m4FailureT += dt;
    if (!this._m4FailureFired && this._m4FailureT >= 90) {
      this._m4FailureFired = true;
      sub.enginePower = Math.min(sub.enginePower, 0.3);
      scene._shipLog('AWARIA UKŁADU STEROWANIA — moc silnika ograniczona do 30%!', 'crit');
      scene._logEvent('Awaria układu sterowania!');
    }

    this._drawMines(scene.camX);

    for (const mine of this._mines) {
      if (mine.hit) continue;
      const dist = Math.hypot(sub.x - mine.x, sub.y - mine.y);
      if (dist <= mine.blastR) {
        mine.hit = true;
        sub.hull -= 0.35;
        sub.onHit?.();
        scene._impactFX.trigger(mine.x, mine.y);
        scene._shake(400, 0.015);
        scene.cameras.main.flash(300, 255, 100, 50, false);
        scene._shipLog(`DETONACJA MINY! Kadłub: ${Math.round(sub.hull * 100)}%.`, 'crit');
        scene._logEvent('MINA! Eksplozja!');
      }
    }

    if (sub.x >= 8000) {
      this._m4Complete = true;
      this._reputation += 1;
      this._minesGfx?.destroy();
      this._minesGfx = null;
      this._setUI('POLE MINOWE', [
        { text: 'Przeżyj pole minowe',             done: true },
        { text: 'Dotarłeś do strefy odbioru x>8000', done: true },
      ]);
      scene._shipLog('Strefa odbioru osiągnięta. Paczka przejęta. Opuszczamy rejon.', 'good');
      scene._logEvent('M4: Cel osiągnięty — wyjście z pola minowego.');
      this._transitionNext();
    }
  }

  _drawMines(camX) {
    const gfx = this._minesGfx;
    if (!gfx) return;
    gfx.clear();
    const sub = this.scene.sub;

    for (const mine of this._mines) {
      if (mine.hit) continue;
      const sx   = mine.x - camX;
      const sy   = mine.y;
      const dist = Math.hypot(sub.x - mine.x, sub.y - mine.y);
      if (dist > mine.detectR) continue;

      const alpha = 1 - dist / mine.detectR;

      gfx.lineStyle(1, 0xffaa00, 0.12 + alpha * 0.18);
      gfx.strokeCircle(sx, sy, mine.detectR);

      gfx.lineStyle(1.5, 0xff4400, 0.35 + alpha * 0.45);
      gfx.strokeCircle(sx, sy, mine.blastR);

      gfx.fillStyle(0xff6600, 0.6 + alpha * 0.4);
      gfx.fillCircle(sx, sy, 5);

      gfx.lineStyle(2, 0xffcc00, 0.85);
      gfx.beginPath();
      gfx.moveTo(sx - 8, sy); gfx.lineTo(sx + 8, sy);
      gfx.moveTo(sx, sy - 8); gfx.lineTo(sx, sy + 8);
      gfx.strokePath();
    }
  }

  // ── Misja 5 — Ostatni Rozkaz ───────────────────────────────────────────────

  _setupM5() {
    const scene = this.scene;
    for (const e of scene.enemies) { e.gfx?.destroy(); e.fireGfx?.destroy(); e._sprite?.destroy(); }
    scene.enemies = [];
    for (const m of scene.merchants) m.gfx?.destroy();
    scene.merchants = [];
    scene._enemiesSpawned = true;
    scene._sandboxSpawnCD = 9999;

    this._m5ChoiceMade = false;

    this._setUI('OSTATNI ROZKAZ', [{ text: 'Oczekiwanie na decyzję kapitana...', done: false }]);
    scene._shipLog(
      'Dwie wiadomości dotarły niemal równocześnie. ' +
      'Moskwa: odpał głowice na bazę NATO w Rønne. ' +
      'Warszawa: anuluj operację — jesteśmy w przededniu przełomu. ' +
      'Komandorze, decyzja należy wyłącznie do ciebie.',
      'crit'
    );
    scene._logEvent('M5: Ostatni rozkaz — czekamy na decyzję kapitana.');

    scene.time.delayedCall(5000, () => {
      if (!this._m5ChoiceMade && this._active) {
        const rep = this._reputation;
        this._showChoice(
          'OSTATNI ROZKAZ',
          `Reputacja: ${rep > 0 ? 'Warszawa' : rep < 0 ? 'Moskwa' : 'neutralna'} (${rep > 0 ? '+' : ''}${rep})`,
          'ROZKAZ MOSKWY — odpał głowice balistyczne',
          'ROZKAZ WARSZAWY — kurs na Gotlandię, azyl',
          () => this._m5Moscow(),
          () => this._m5Warsaw(),
        );
      }
    });
  }

  _updateM5() { /* czeka na decyzję — obsługa w delayedCall */ }

  _m5Moscow() {
    this._m5ChoiceMade = true;
    this._reputation  -= 2;
    this.scene._shipLog('Rozkaz Moskwy wykonany. Głowice odpalono. ORP KONDOR — koniec misji.', 'danger');
    this.scene._logEvent('M5: Głowice odpalono — rozkaz Moskwy.');
    this._showEnding('moscow');
  }

  _m5Warsaw() {
    this._m5ChoiceMade = true;
    this._reputation  += 2;
    this.scene._shipLog('Rozkaz Warszawy. Kurs na Gotlandię — azyl dla załogi.', 'good');
    this.scene._logEvent('M5: Kurs na azyl — rozkaz Warszawy.');
    this._showEnding('warsaw');
  }

  // ── Przejścia między misjami ───────────────────────────────────────────────

  _setupMission(idx) {
    this._missionIdx    = idx;
    this._transitioning = false;
    this.scene.tutorial = null;

    switch (idx) {
      case 0: this._setupM1(); break;
      case 1: this._setupM2(); break;
      case 2: this._setupM3(); break;
      case 3: this._setupM4(); break;
      case 4: this._setupM5(); break;
    }
  }

  _transitionNext() {
    if (this._transitioning) return;
    this._transitioning = true;
    const next = this._missionIdx + 1;
    if (next >= MISSION_DEFS.length) return;
    this._showMissionComplete(this._missionIdx, () => {
      this._showBriefing(next, () => this._setupMission(next));
    });
  }

  // ── Overlay DOM ────────────────────────────────────────────────────────────

  _buildOverlay() {
    const el = document.createElement('div');
    el.id = 'campaign-overlay';
    el.style.cssText = [
      'position:fixed', 'inset:0', 'display:none',
      'background:rgba(0,3,1,0.93)',
      'z-index:9000',
      'align-items:center', 'justify-content:center',
      'font-family:"Courier New",monospace',
    ].join(';');
    document.body.appendChild(el);
    this._overlayEl = el;
  }

  _showBriefing(idx, onContinue) {
    const def = MISSION_DEFS[idx];
    const el  = this._overlayEl;
    el.style.display = 'flex';
    el.innerHTML = `
      <div style="max-width:640px;padding:40px 44px;border:1px solid #00cc66;background:rgba(0,8,3,0.98);">
        <div style="color:#00ff88;font-size:10px;letter-spacing:3px;margin-bottom:6px;">▸ ORP KONDOR — ODPRAWA OPERACYJNA</div>
        <div style="color:#ffffff;font-size:20px;font-weight:bold;margin-bottom:3px;">${def.title}</div>
        <div style="color:#447755;font-size:11px;margin-bottom:22px;">${def.area}</div>
        ${def.briefing.map(l => `<p style="color:#b0ffcc;font-size:13px;line-height:1.65;margin:0 0 10px 0;">${l}</p>`).join('')}
        <div style="margin-top:22px;padding-top:16px;border-top:1px solid rgba(0,200,100,0.18);">
          <div style="color:#557766;font-size:10px;letter-spacing:1px;margin-bottom:8px;">CELE OPERACYJNE:</div>
          ${def.objectives.map(o => `<div style="color:#aaffcc;font-size:12px;margin-bottom:5px;">○ ${o}</div>`).join('')}
        </div>
        <button id="camp-brief-btn" style="margin-top:26px;padding:10px 26px;background:transparent;border:1px solid #00ff88;color:#00ff88;font-family:'Courier New',monospace;font-size:12px;letter-spacing:2px;cursor:pointer;">[ GOTÓW DO AKCJI ]</button>
      </div>
    `;
    document.getElementById('camp-brief-btn').addEventListener('click', () => {
      el.style.display = 'none';
      onContinue();
    });
  }

  _showChoice(title, subtitle, optA, optB, onA, onB) {
    const el = this._overlayEl;
    el.style.display = 'flex';
    el.innerHTML = `
      <div style="max-width:580px;padding:40px 44px;border:1px solid #ffaa00;background:rgba(5,3,0,0.98);">
        <div style="color:#ffcc00;font-size:10px;letter-spacing:3px;margin-bottom:6px;">▸ DECYZJA OPERACYJNA</div>
        <div style="color:#ffffff;font-size:20px;font-weight:bold;margin-bottom:6px;">${title}</div>
        <div style="color:#887744;font-size:12px;margin-bottom:26px;">${subtitle}</div>
        <div style="display:flex;flex-direction:column;gap:14px;">
          <button id="camp-opt-a" style="padding:13px 18px;background:rgba(80,10,0,0.55);border:1px solid #ff4444;color:#ff8888;font-family:'Courier New',monospace;font-size:12px;letter-spacing:1px;cursor:pointer;text-align:left;">⚠ ${optA}</button>
          <button id="camp-opt-b" style="padding:13px 18px;background:rgba(0,25,10,0.55);border:1px solid #00cc66;color:#88ffaa;font-family:'Courier New',monospace;font-size:12px;letter-spacing:1px;cursor:pointer;text-align:left;">✓ ${optB}</button>
        </div>
      </div>
    `;
    document.getElementById('camp-opt-a').addEventListener('click', () => {
      el.style.display = 'none'; onA();
    });
    document.getElementById('camp-opt-b').addEventListener('click', () => {
      el.style.display = 'none'; onB();
    });
  }

  _showMissionComplete(idx, onNext) {
    const def = MISSION_DEFS[idx];
    const el  = this._overlayEl;
    el.style.display = 'flex';
    el.innerHTML = `
      <div style="max-width:480px;padding:40px 44px;border:1px solid #00ff88;background:rgba(0,10,4,0.98);text-align:center;">
        <div style="color:#00ff88;font-size:10px;letter-spacing:3px;margin-bottom:14px;">▸ MISJA ZAKOŃCZONA</div>
        <div style="color:#ffffff;font-size:22px;font-weight:bold;margin-bottom:6px;">${def.title}</div>
        <div style="color:#00ff88;font-size:13px;margin-bottom:22px;">✓ SUKCES</div>
        <div style="color:#557766;font-size:10px;margin-bottom:5px;">REPUTACJA</div>
        <div style="color:${this._reputation >= 0 ? '#00ff88' : '#ff5555'};font-size:15px;margin-bottom:26px;">${this._reputation > 0 ? '+' : ''}${this._reputation} — ${this._reputation >= 0 ? 'WARSZAWA' : 'MOSKWA'}</div>
        <button id="camp-next-btn" style="padding:10px 26px;background:transparent;border:1px solid #00ff88;color:#00ff88;font-family:'Courier New',monospace;font-size:12px;letter-spacing:2px;cursor:pointer;">[ NASTĘPNA MISJA ]</button>
      </div>
    `;
    document.getElementById('camp-next-btn').addEventListener('click', () => {
      el.style.display = 'none';
      onNext();
    });
  }

  _showEnding(type) {
    const scene    = this.scene;
    const el       = this._overlayEl;
    const isWarsaw = type === 'warsaw';
    const repGood  = this._reputation >= 2;

    let title, subtitle, color;
    if (isWarsaw) {
      title    = repGood ? 'ORP KONDOR — BOHATER' : 'ORP KONDOR — AZYL';
      subtitle = repGood
        ? 'Załoga dotarła do Gotlandii. Rok później Polska odzyskała wolność. Decyzja kapitana przeszła do historii.'
        : 'Azyl przyznany. Decyzja kapitana była trudna — historia oceni ją sprawiedliwie.';
      color = '#00ff88';
    } else {
      title    = 'ORP KONDOR — KONIEC';
      subtitle = 'Głowice odpalono. ORP KONDOR zatonął cztery godziny później, rażony własnym sojusznikiem. Październik 1989 był ostatnim miesiącem Układu Warszawskiego.';
      color = '#ff4a4a';
    }

    el.style.display = 'flex';
    el.innerHTML = `
      <div style="max-width:600px;padding:44px;border:1px solid ${color};background:rgba(0,3,1,0.99);text-align:center;">
        <div style="color:${color};font-size:10px;letter-spacing:3px;margin-bottom:14px;">▸ KONIEC KAMPANII</div>
        <div style="color:${color};font-size:26px;font-weight:bold;margin-bottom:18px;">${title}</div>
        <p style="color:#b0ffcc;font-size:13px;line-height:1.75;margin-bottom:26px;">${subtitle}</p>
        <div style="color:#335544;font-size:10px;margin-bottom:5px;">REPUTACJA KOŃCOWA</div>
        <div style="color:${this._reputation >= 0 ? '#00ff88' : '#ff5555'};font-size:14px;margin-bottom:30px;">${this._reputation > 0 ? '+' : ''}${this._reputation} — ${this._reputation >= 0 ? 'WARSZAWA' : 'MOSKWA'}</div>
        <button id="camp-end-btn" style="padding:11px 30px;background:transparent;border:1px solid ${color};color:${color};font-family:'Courier New',monospace;font-size:12px;letter-spacing:2px;cursor:pointer;">[ ENTER — ZAGRAJ PONOWNIE ]</button>
      </div>
    `;

    document.getElementById('camp-end-btn').addEventListener('click', () => {
      el.style.display = 'none';
      document.getElementById('game-ui')?.classList.remove('active');
      document.getElementById('side-panel')?.classList.remove('active');
      scene.scene.restart();
    });

    scene.input.keyboard.once('keydown-ENTER', () => {
      document.getElementById('camp-end-btn')?.click();
    });

    scene._gameOver = true;
  }

  // ── Panel misji ────────────────────────────────────────────────────────────

  _setUI(name, objectives) {
    if (this._panelEl) this._panelEl.style.display = 'block';
    if (this._nameEl)  this._nameEl.textContent = name;
    if (!this._objEl)  return;
    this._objEl.innerHTML = '';
    for (const obj of objectives) {
      const div = document.createElement('div');
      div.className = 'mission-obj ' + (obj.done ? 'done' : 'pending');
      div.textContent = (obj.done ? '✓ ' : '○ ') + obj.text;
      this._objEl.appendChild(div);
    }
  }
}
