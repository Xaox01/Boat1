// Pamięć wzorców gracza w bieżącej sesji — singleton odczytywany przez Enemy.js
// Resetowany przy każdym starcie gry.

export const mem = {
  // ── Wzorzec 1: Termoklina ─────────────────────────────────────────────────
  thermoHides:    0,       // ile razy gracz uciekł pod termoklinem
  thermoAdaptive: false,   // po 3 ucieczkach AI zacznie atakować głębiej

  // ── Wzorzec 2: Kierunek ucieczki ─────────────────────────────────────────
  escapeSamples:  [],      // ostatnie 12 próbek (±1)
  escapeDir:      0,       // dominujący: -1 lewo, 0 brak, +1 prawo

  // ── Logi jednorazowe ─────────────────────────────────────────────────────
  _logThermo:  false,
  _logEscape:  false,

  reset() {
    this.thermoHides    = 0;  this.thermoAdaptive = false;
    this.escapeSamples  = []; this.escapeDir      = 0;
    this._logThermo     = false; this._logEscape   = false;
  },

  // Wróg stracił kontakt — gracz był pod termoklinem
  onThermoHide(scene) {
    this.thermoHides++;
    if (this.thermoHides >= 3 && !this.thermoAdaptive) {
      this.thermoAdaptive = true;
      if (!this._logThermo) {
        this._logThermo = true;
        scene?._shipLog(
          '[HYDROAK.] Wróg dostosowuje głębokość ataku — zna nasze wzorce ukrycia pod termoklinem.',
          'danger'
        );
        scene?._logEvent('AI ADAPTACJA: ataki poniżej termokliny.');
      }
    }
  },

  // Wróg stracił kontakt — rejestruj kierunek ruchu gracza
  onEscape(vx, scene) {
    if (Math.abs(vx) < 2) return;
    this.escapeSamples.push(Math.sign(vx));
    if (this.escapeSamples.length > 12) this.escapeSamples.shift();
    const sum  = this.escapeSamples.reduce((a, b) => a + b, 0);
    const prev = this.escapeDir;
    this.escapeDir = sum >= 4 ? 1 : sum <= -4 ? -1 : 0;
    if (this.escapeDir !== 0 && this.escapeDir !== prev && !this._logEscape) {
      this._logEscape = true;
      const dir = this.escapeDir > 0 ? 'PRAWĄ' : 'LEWĄ';
      scene?._shipLog(
        `[STARSZY OF.] Wróg przewiduje ucieczkę w ${dir} stronę — bloker zmienia pozycję.`,
        'warn'
      );
      scene?._logEvent('AI ADAPTACJA: kierunek blokowania zaktualizowany.');
    }
  },
};
