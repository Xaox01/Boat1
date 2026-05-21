// System łączności VLF/ELF — przychodzące meldunki ze sztabu podczas patrolu.
// Wiadomości osadzone w realiach zimnej wojny 1983: Morze Norweskie, Flota Północna.

const PRIORITY_COLOR = {
  'FLASH':        '#ff3030',
  'PILNE':        '#ffaa00',
  'OPERACYJNE':   '#e8e0d0',
  'RUTYNOWE':     '#8ab8a0',
  'METEO':        '#6ab0d8',
  'INTEL':        '#b8a0d8',
};

// ── Pula wiadomości ────────────────────────────────────────────────────────
// delay: sekundy od startu patrolu (0 = zależy od eventu)
// trigger: 'time' | 'first_contact' | 'torpedo_hit' | 'merchant_sunk'

const MESSAGES = [

  // ── TIMED ──────────────────────────────────────────────────────────────

  {
    id: 'patrol_start',
    trigger: 'time', delay: 75,
    priority: 'RUTYNOWE',
    from: 'SZTAB SGIW · SIEWIERODWINSK',
    lines: [
      'POTWIERDZENIE WYJŚCIA NA PATROL BOJOWY.',
      'REJON DZIAŁANIA: SEKTOR NA-7712.',
      'MORZE NORWESKIE. GŁĘBOKOŚĆ BEZPIECZNA.',
      '',
      'ZACHOWAĆ CISZĘ RADIOWĄ.',
      'MELDUNKI WYŁĄCZNIE KANAŁEM VLF.',
      'POWODZENIA. ZA OJCZYZNĘ.',
    ],
  },

  {
    id: 'nato_carrier',
    trigger: 'time', delay: 270,
    priority: 'PILNE',
    from: 'WYWIAD GRU · MOSKWA',
    lines: [
      'WYKRYTO GRUPĘ UDERZENIOWĄ NATO.',
      'SKŁAD: LOTNISKOWIEC USS ENTERPRISE (CVN-65),',
      'ESKORT 6 OKRĘTÓW, W TYM 2 FREGATY KLASY PERRY.',
      '',
      'KWADRAT: NA-8814. KURS 127°. PRĘDKOŚĆ 18 W.',
      '',
      'ZADANIE: USTALIĆ ŚLEDZENIE. DYSKRETNE.',
      'OGNIA NIE OTWIERAĆ BEZ ROZKAZU SZTABU.',
    ],
  },

  {
    id: 'kal_context',
    trigger: 'time', delay: 450,
    priority: 'INTEL',
    from: 'GŁÓWNY ZARZĄD POLITYCZNY · MOSKWA',
    lines: [
      'INCYDENT KAL-007: BOEING WYKONYWAŁ MISJĘ',
      'ROZPOZNAWCZĄ CIA NAD TERYTORIUM ZSRR.',
      'NARUSZENIE PRZESTRZENI POWIETRZNEJ — CELOWE.',
      '',
      'GOTOWOŚĆ BOJOWA WMF — PODWYŻSZONA.',
      'PROWOKACJE NATO MOŻLIWE. ZACHOWAĆ CZUJNOŚĆ.',
      'NIE DAĆ SIĘ SPROWOKOWAĆ DO PIERWSZEGO STRZAŁU.',
    ],
  },

  {
    id: 'orion_warning',
    trigger: 'time', delay: 600,
    priority: 'PILNE',
    from: 'DOWÓDZTWO SF · SIEWIEROMORSK',
    lines: [
      'PRZECHWYCONO TRANSMISJE NATO.',
      'SAMOLOT P-3C ORION AKTYWNY W REJONIE.',
      'BOJE SONAROWE — ZRZUT SZACOWANY NA 45 MIN.',
      '',
      'NATYCHMIAST: TRYB PEŁNEJ CISZY.',
      'ZREDUKOWAĆ PRĘDKOŚĆ DO 3 WĘZŁÓW.',
      'ZEJŚĆ POD TERMOKLIN. CZEKAĆ NA ROZKAZY.',
    ],
  },

  {
    id: 'able_archer',
    trigger: 'time', delay: 810,
    priority: 'FLASH',
    from: 'SZTAB GENERALNY · MOSKWA',
    lines: [
      '!! ĆWICZENIA NATO ABLE ARCHER-83 — REJON',
      'OPERACYJNY MAKSYMALNIE ZBLIŻONY DO REALNEGO',
      'SCENARIUSZA PIERWSZEGO UDERZENIA NUKLEARNEGO.',
      '',
      'SY ZSRR — NAJWYŻSZA GOTOWNOŚĆ BOJOWA.',
      'NOŚNIKI SYSTEMÓW JĄDROWYCH — PRZYGOTOWANE.',
      'OCZEKIWAĆ ROZKAZU. NIE PROWOKOWAĆ.',
      '',
      '!! NIE OTWIERAĆ OGNIA BEZ BEZPOŚREDNIEGO',
      'ROZKAZU SZTABU GENERALNEGO.',
    ],
  },

  {
    id: 'weather',
    trigger: 'time', delay: 960,
    priority: 'METEO',
    from: 'HYDROMETEOCENTER WMF',
    lines: [
      'PROGNOZA DLA MORZA NORWESKIEGO:',
      'FRONT ATLANTYCKI — PRZEMIESZCZA SIĘ NA WSCHÓD.',
      'WIATR: PŁN-ZAH-7, FALOWANIE 4–5 STOPNI.',
      '',
      'WARUNKI HYDROAKUSTYKI: POGORSZONE.',
      'SZUMNOŚĆ POWIERZCHNI — PODWYŻSZONA.',
      'WYKORZYSTAĆ JAKO MASKOWANIE AKUSTYCZNE.',
    ],
  },

  {
    id: 'friendly_forces',
    trigger: 'time', delay: 1080,
    priority: 'RUTYNOWE',
    from: 'SZTAB SGIW · GADŻIJEVO',
    lines: [
      'SIŁY PRZYJAZNE W REJONIE OPERACJI:',
      '— K-324 «WIEPRZ» (PR.671RTM) — KW. NA-7800.',
      '  ODLEGŁOŚĆ: ~180 KM NA PŁDN-ZAH.',
      '  ZADANIE: ŚLEDZENIE GRUPY UDERZENIOWEJ.',
      '',
      'NIE NAWIĄZYWAĆ ŁĄCZNOŚCI AKUSTYCZNEJ.',
      'ZACHOWAĆ NIEZALEŻNOŚĆ DZIAŁANIA.',
    ],
  },

  {
    id: 'petrov',
    trigger: 'time', delay: 1260,
    priority: 'FLASH',
    from: 'CENTRUM KONTROLI RAKIETOWEJ · MOSKWA',
    lines: [
      'SYSTEM WCZESNEGO OSTRZEGANIA OKO:',
      'WYKRYTO ŚLADY OBIEKTÓW — WERYFIKACJA TRWA.',
      'MOŻLIWE ZAKŁÓCENIE SATELITARNE.',
      '',
      'STATUS: FAŁSZYWY ALARM — POTWIERDZONO.',
      'ZAGROŻENIE NUKLEARNE — BRAK.',
      '',
      'KONTYNUOWAĆ PATROL. ZACHOWAĆ GOTOWOŚĆ.',
      'PODWYŻSZONY STAN ALARMU — KOLEJNE 6H.',
    ],
  },

  {
    id: 'rtb',
    trigger: 'time', delay: 1440,
    priority: 'RUTYNOWE',
    from: 'DOWÓDCA SF · ADMIRAŁ KAPITANEC',
    lines: [
      'ZADANIE WYKONANE. PODZIĘKOWANIE DLA ZAŁOGI.',
      '',
      'ROZKAZ: ZAKOŃCZYĆ PATROL BOJOWY.',
      'KURS DO BAZY — 270°. TRYB NORMALNY.',
      'ZACHOWAĆ CISZĘ RADIOWĄ DO BAZY.',
      '',
      'CHWAŁA RADZIECKIEJ MARYNARCE WOJENNEJ.',
    ],
  },

  // ── EVENT-TRIGGERED ──────────────────────────────────────────────────────

  {
    id: 'first_contact',
    trigger: 'first_contact',
    priority: 'PILNE',
    from: 'SZTAB SF · SIEWIEROMORSK',
    lines: [
      'KONTAKT SONAROWY POTWIERDZONY.',
      'REGUŁY ZAANGAŻOWANIA BOJOWEGO — AKTYWNE.',
      '',
      'DOZWOLONE: ŚLEDZENIE, KLASYFIKACJA, UNIKANIE.',
      'OTWARCIE OGNIA — WYŁĄCZNIE PRZY BEZPOŚREDNIM',
      'ZAGROŻENIU ZNISZCZENIEM JEDNOSTKI.',
      '',
      'MELDOWAĆ PO WYJŚCIU Z KONTAKTU.',
    ],
  },

  {
    id: 'torpedo_hit',
    trigger: 'torpedo_hit',
    priority: 'FLASH',
    from: 'OD SF · AUTOMATYCZNIE',
    lines: [
      'ZAREJESTROWANO ZDARZENIE AKUSTYCZNE.',
      'KLASYFIKACJA: ATAK TORPEDOWY.',
      '',
      'NATYCHMIAST: MANEWR UNIKANIA.',
      'ZMIANA GŁĘBOKOŚCI I KURSU.',
      'ZASTOSOWANIE WABIKA AKUSTYCZNEGO — DOZWOLONE.',
      'ODPOWIEDŹ OGNIOWA — WEDŁUG OCENY SYTUACJI.',
    ],
  },

  {
    id: 'merchant_sunk',
    trigger: 'merchant_sunk',
    priority: 'OPERACYJNE',
    from: 'SZTAB SF · SIEWIEROMORSK',
    lines: [
      'MELDUNEK PRZYJĘTY. CEL ZNEUTRALIZOWANY.',
      'WYNIK ZALICZONY DO KONTA PATROLU.',
      '',
      'KONTYNUOWAĆ WYKONYWANIE ZADANIA.',
      'ZACHOWAĆ TRYB CISZY AKUSTYCZNEJ.',
    ],
  },

];

// ── Klasa ──────────────────────────────────────────────────────────────────

export class RadioComms {
  constructor(scene) {
    this.scene    = scene;
    this._queue   = [];
    this._showing = false;
    this._elapsed = 0;
    this._sent    = new Set();

    this._typeTimer = 0;
    this._typeIdx   = 0;
    this._fullText  = '';

    this._timed = MESSAGES
      .filter(m => m.trigger === 'time')
      .sort((a, b) => a.delay - b.delay);

    this._overlay    = document.getElementById('radio-overlay');
    this._bodyEl     = document.getElementById('radio-body');
    this._badgeEl    = document.getElementById('radio-badge');
    this._priorityEl = document.getElementById('radio-priority');
    this._fromEl     = document.getElementById('radio-from');
    this._toEl       = document.getElementById('radio-to');
    this._utcEl      = document.getElementById('radio-utc');
    this._hintEl     = document.getElementById('radio-dismiss-hint');
    this._cursorEl   = document.getElementById('radio-cursor');

    this._onKey = this._handleKey.bind(this);
    window.addEventListener('keydown', this._onKey);
    this._overlay?.addEventListener('click', () => this._onDismissClick());
  }

  // Wywołaj z GameScene dla eventów (np. 'first_contact', 'merchant_sunk')
  trigger(id) {
    if (this._sent.has(id)) return;
    const msg = MESSAGES.find(m => m.trigger === id);
    if (!msg) return;
    this._sent.add(id);
    this._queue.push(msg);
  }

  update(dt) {
    this._elapsed += dt;

    // Sprawdź wiadomości czasowe
    for (const msg of this._timed) {
      if (!this._sent.has(msg.id) && this._elapsed >= msg.delay) {
        this._sent.add(msg.id);
        this._queue.push(msg);
      }
    }

    // Pokaż kolejną wiadomość jeśli nic nie wyświetlamy
    if (!this._showing && this._queue.length > 0) {
      this._show(this._queue.shift());
    }

    // Efekt maszyny do pisania
    if (this._showing && this._typeIdx < this._fullText.length) {
      this._typeTimer += dt;
      const target = Math.min(
        Math.floor(this._typeTimer * 22),
        this._fullText.length
      );
      if (target !== this._typeIdx) {
        this._typeIdx = target;
        this._renderBody();
      }
    }
  }

  _show(msg) {
    this._showing   = true;
    this._typeTimer = 0;
    this._typeIdx   = 0;
    this._fullText  = msg.lines.join('\n');

    const col = PRIORITY_COLOR[msg.priority] || '#e8e0d0';
    if (this._priorityEl) {
      this._priorityEl.textContent  = msg.priority;
      this._priorityEl.style.color  = col;
      this._priorityEl.style.borderColor = col + '55';
    }
    if (this._fromEl) this._fromEl.textContent = msg.from;
    if (this._toEl)   this._toEl.textContent   = 'K-244 «NALIM»';
    if (this._utcEl)  this._utcEl.textContent  = this._utcNow();
    if (this._hintEl) this._hintEl.style.opacity = '0.15';
    if (this._cursorEl) this._cursorEl.style.display = 'inline-block';

    this._renderBody();
    this._overlay?.classList.add('active');

    if (this._badgeEl) {
      this._badgeEl.style.display = '';
      this._badgeEl.classList.add('pulsing');
    }

    // Wpis w dzienniku pokładowym
    this.scene._shipLog(
      `[VLF] ${msg.priority} — ${msg.lines.find(l => l.trim()) || ''}`,
      msg.priority === 'FLASH' ? 'danger' : 'warn'
    );
  }

  _renderBody() {
    if (!this._bodyEl) return;
    this._bodyEl.textContent = this._fullText.slice(0, this._typeIdx);
    const done = this._typeIdx >= this._fullText.length;
    if (this._cursorEl) this._cursorEl.style.display = done ? 'none' : 'inline-block';
    if (this._hintEl)   this._hintEl.style.opacity   = done ? '0.55' : '0.15';
  }

  _handleKey(e) {
    if (!this._showing) return;
    if (e.key !== 'r' && e.key !== 'R') return;
    e.preventDefault();
    if (this._typeIdx < this._fullText.length) {
      // Pierwsze R — pomiń efekt pisania
      this._typeIdx = this._fullText.length;
      this._renderBody();
    } else {
      this._dismiss();
    }
  }

  _onDismissClick() {
    if (!this._showing) return;
    if (this._typeIdx < this._fullText.length) {
      this._typeIdx = this._fullText.length;
      this._renderBody();
    } else {
      this._dismiss();
    }
  }

  _dismiss() {
    this._showing = false;
    this._overlay?.classList.remove('active');
    if (this._queue.length === 0 && this._badgeEl) {
      this._badgeEl.style.display = 'none';
      this._badgeEl.classList.remove('pulsing');
    }
  }

  _utcNow() {
    return new Date().toUTCString().slice(17, 25);
  }

  destroy() {
    window.removeEventListener('keydown', this._onKey);
  }
}
