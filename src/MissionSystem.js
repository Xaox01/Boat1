// System misji — zarządza aktywnymi misjami i ich celami.
import { t as tr, tf } from './i18n.js';

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
      nameKey:  'mis1_name',
      complete: false,
      failed:   false,
      objectives: [
        {
          id:      'detect',
          textKey: 'mis1_obj_detect',
          done:    false,
        },
        {
          id:      'destroy',
          textKey: 'mis1_obj_destroy',
          done:    false,
          count:   0,
          target:  3,
        },
      ],
    };

    if (this._panelEl) this._panelEl.style.display = 'block';
    this._updateUI();

    this.scene._shipLog(
      'ROZKAZ BOJOWY: Konwój sowiecki kurs E–W. Namierzyć i zatopić min. 3 statki handlowe. Zniszczyć zaopatrzenie wroga.',
      'danger'
    );
    this.scene._logEvent(tr('mis1_start_log'));
  }

  // ── Aktualizacja co klatkę ────────────────────────────────────────────────

  update() {
    if (!this.active || this.active.complete || this.active.failed) return;

    const objDetect  = this.active.objectives[0];

    // Cel 1 — klasyfikacja: sprawdź czy jakikolwiek merchant dotarł do SURFACE
    if (!objDetect.done) {
      const classified = this.scene.merchants.some(m => !m.destroyed && m.contactClass === 'SURFACE');
      if (classified) {
        objDetect.done = true;
        this._updateUI();
        this.scene._logEvent(tr('mis1_detected'));
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

    this.scene._logEvent(tf('mis1_sunk', { done: obj.count, total: obj.target }));
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
      const total     = this.active.objectives[1].target;
      this.scene._shipLog(
        `MISJA WYKONANA — konwój zniszczony. Zatopiono ${destroyed} jednostki. Powrót do bazy.`,
        'good'
      );
      this._updateUI();
      // Opóźnienie ekranu sukcesu — daj czas na przeczytanie loga
      this.scene.time.delayedCall(2500, () => {
        if (!this.scene._gameOver) {
          this.scene._showEndScreen(
            tr('mis_complete'),
            tf('mis_end_text', { done: destroyed, total }),
            '#44ffaa'
          );
        }
      });
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  _updateUI() {
    if (!this._nameEl || !this._objEl || !this.active) return;

    this._nameEl.textContent = tr(this.active.nameKey);

    this._objEl.innerHTML = '';
    for (const obj of this.active.objectives) {
      const div = document.createElement('div');
      div.className = 'mission-obj ' + (obj.done ? 'done' : 'pending');

      let label = tr(obj.textKey);
      if (obj.id === 'destroy' && !obj.done) {
        label = tf('mis1_obj_destroy_prog', { n: obj.target, done: obj.count });
      }

      div.textContent = (obj.done ? '✓ ' : '○ ') + label;
      this._objEl.appendChild(div);
    }

    if (this.active.complete) {
      const done = document.createElement('div');
      done.className = 'mission-obj done mission-complete';
      done.textContent = tr('mis_complete_star');
      this._objEl.appendChild(done);
    }
  }
}
