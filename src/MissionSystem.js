// System misji — zarządza aktywnymi misjami i ich celami.
export class MissionSystem {
  constructor(scene) {
    this.scene  = scene;
    this.active = null;   // aktywna misja lub null

    this._panelEl = document.getElementById('mission-panel');
    this._nameEl  = document.getElementById('mission-name');
    this._objEl   = document.getElementById('mission-objectives');
  }

  // ── Misja 1 ───────────────────────────────────────────────────────────────

  startMission1() {
    this.active = {
      id:       1,
      name:     'OP. SZLAK HANDLOWY',
      complete: false,
      failed:   false,
      objectives: [
        {
          id:   'detect',
          text: 'Namierz konwój (sklasyfikuj statek)',
          done: false,
        },
        {
          id:     'destroy',
          text:   'Zatop 3 statki handlowe',
          done:   false,
          count:  0,
          target: 3,
        },
      ],
    };

    if (this._panelEl) this._panelEl.style.display = 'block';
    this._updateUI();

    this.scene._shipLog(
      'ROZKAZ BOJOWY: Konwój sowiecki kurs E–W. Namierzyć i zatopić min. 3 statki handlowe. Zniszczyć zaopatrzenie wroga.',
      'danger'
    );
    this.scene._logEvent('MISJA: Zniszcz konwój wroga!');
  }

  // ── Aktualizacja co klatkę ────────────────────────────────────────────────

  update() {
    if (!this.active || this.active.complete || this.active.failed) return;

    const objDetect  = this.active.objectives[0];
    const objDestroy = this.active.objectives[1];

    // Cel 1 — klasyfikacja: sprawdź czy jakikolwiek merchant dotarł do SURFACE
    if (!objDetect.done) {
      const classified = this.scene.merchants.some(m => !m.destroyed && m.contactClass === 'SURFACE');
      if (classified) {
        objDetect.done = true;
        this._updateUI();
        this.scene._logEvent('Konwój namierzony — klasyfikacja: statek handlowy');
        this.scene._shipLog(
          'Klasyfikacja akustyczna: kontakt oznaczony jako statek handlowy. Zatwierdzono otwarcie ognia.',
          'good'
        );
      }
    }

    this._checkComplete();
    this._updateUI();
  }

  // Wywołaj z GameScene gdy merchant zostaje zatopiony
  onMerchantDestroyed(merchant) {
    if (!this.active || this.active.complete) return;

    const obj = this.active.objectives.find(o => o.id === 'destroy');
    if (!obj || obj.done) return;

    obj.count++;
    const remaining = obj.target - obj.count;

    this.scene._logEvent(`Statek handlowy zatopiony! (${obj.count}/${obj.target})`);
    this.scene._shipLog(
      `Cel zatopiony: ${merchant.label}. Postęp misji: ${obj.count}/${obj.target}. ` +
      (remaining > 0 ? `Pozostało ${remaining}.` : 'Cel osiągnięty!'),
      'good'
    );

    if (obj.count >= obj.target) obj.done = true;
    this._checkComplete();
    this._updateUI();
  }

  // ── Kontrola ukończenia ───────────────────────────────────────────────────

  _checkComplete() {
    if (!this.active || this.active.complete) return;
    if (this.active.objectives.every(o => o.done)) {
      this.active.complete = true;
      const destroyed = this.active.objectives[1].count;
      this.scene._shipLog(
        `MISJA WYKONANA — konwój zniszczony. Zatopiono ${destroyed} jednostki. Powrót do bazy.`,
        'good'
      );
      this._updateUI();
      // Opóźnienie ekranu sukcesu — daj czas na przeczytanie loga
      this.scene.time.delayedCall(2500, () => {
        if (!this.scene._gameOver) {
          this.scene._showEndScreen(
            'MISJA WYKONANA',
            `Konwój zniszczony — ${destroyed}/${this.active.objectives[1].target} statki.`,
            '#44ffaa'
          );
        }
      });
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  _updateUI() {
    if (!this._nameEl || !this._objEl || !this.active) return;

    this._nameEl.textContent = this.active.name;

    this._objEl.innerHTML = '';
    for (const obj of this.active.objectives) {
      const div = document.createElement('div');
      div.className = 'mission-obj ' + (obj.done ? 'done' : 'pending');

      let label = obj.text;
      if (obj.id === 'destroy' && !obj.done) {
        label = `Zatop 3 statki (${obj.count}/3)`;
      }

      div.textContent = (obj.done ? '✓ ' : '○ ') + label;
      this._objEl.appendChild(div);
    }

    if (this.active.complete) {
      const done = document.createElement('div');
      done.className = 'mission-obj done mission-complete';
      done.textContent = '★ MISJA WYKONANA';
      this._objEl.appendChild(done);
    }
  }
}
