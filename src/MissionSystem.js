// System misji — zarządza aktywnymi misjami i ich celami.
import { t as tr, tf } from './i18n.js';

export class MissionSystem {
  constructor(scene) {
    this.scene  = scene;
    this.active = null;

    this._panelEl = document.getElementById('mission-panel');
    this._nameEl  = document.getElementById('mission-name');
    this._objEl   = document.getElementById('mission-objectives');
  }

  // ── Misja 1: Operacja Neptun ──────────────────────────────────────────────

  startMission1(targetEnemy) {
    this._targetEnemy = targetEnemy;

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
        },
      ],
    };

    if (this._panelEl) this._panelEl.style.display = 'block';
    this._updateUI();

    this.scene._shipLog(
      'ROZKAZ OPERACYJNY — OPERACJA NEPTUN: BPK «NIEUSTRASZONY» przechwycony na ŁB-22/N. ' +
      'Cel: zlokalizuj sonarowo i zatop niszczyciel przed wejściem w strefę ochronną. Cisza radiowa.',
      'danger'
    );
    this.scene._logEvent(tr('mis1_start_log'));
  }

  // ── Aktualizacja co klatkę ────────────────────────────────────────────────

  update() {
    if (!this.active || this.active.complete || this.active.failed) return;

    const objDetect = this.active.objectives[0];

    // Cel 1 — klasyfikacja sonarowa: WARSHIP
    if (!objDetect.done && this._targetEnemy) {
      const cls = this._targetEnemy.contactClass;
      if (cls === 'WARSHIP' || cls === 'SURFACE') {
        objDetect.done = true;
        this._updateUI();
        this.scene._logEvent(tr('mis1_detected'));
        this.scene._shipLog(
          'Klasyfikacja sonarowa potwierdzona: BPK «NIEUSTRASZONY» — okręt wojenny. Zatwierdzone otwarcie ognia.',
          'good'
        );
      }
    }

    this._checkComplete();
    this._updateUI();
  }

  // Wywołaj z GameScene gdy wróg zostaje zatopiony
  onEnemyDestroyed(enemy) {
    if (!this.active || this.active.complete) return;
    if (enemy !== this._targetEnemy) return;

    const obj = this.active.objectives.find(o => o.id === 'destroy');
    if (!obj || obj.done) return;

    obj.done = true;
    this.scene._logEvent(tr('mis1_sunk'));
    this.scene._shipLog(
      'BPK «NIEUSTRASZONY» zatopiony. Cel operacyjny wyeliminowany. ORP KONDOR — opuść rejon operacji.',
      'good'
    );

    this._checkComplete();
    this._updateUI();
  }

  // ── Kontrola ukończenia ───────────────────────────────────────────────────

  _checkComplete() {
    if (!this.active || this.active.complete) return;
    if (this.active.objectives.every(o => o.done)) {
      this.active.complete = true;
      this._updateUI();
      this.scene.time.delayedCall(2800, () => {
        if (!this.scene._gameOver) {
          this.scene._showEndScreen(
            tr('mis_complete'),
            tf('mis_end_text', {}),
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
      div.textContent = (obj.done ? '✓ ' : '○ ') + tr(obj.textKey);
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
