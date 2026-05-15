// Dev console — otwierany tyldą (~), zamykany tyldą lub Escape

export class DevConsole {
  constructor(scene) {
    this.scene    = scene;
    this._open    = false;
    this._history = [];
    this._histIdx = -1;
    this._godMode = false;

    this._buildDOM();
    this._bindKeys();
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM() {
    const wrap = document.createElement('div');
    wrap.id = 'dev-console';
    Object.assign(wrap.style, {
      display:       'none',
      position:      'fixed',
      bottom:        '0',
      left:          '0',
      width:         '100%',
      maxHeight:     '260px',
      background:    'rgba(0,4,0,0.92)',
      fontFamily:    '"Courier New", Courier, monospace',
      fontSize:      '13px',
      color:         '#00ff88',
      zIndex:        '99999',
      boxSizing:     'border-box',
      borderTop:     '2px solid #00ff55',
      flexDirection: 'column',
    });

    const log = document.createElement('div');
    Object.assign(log.style, {
      flex:         '1',
      overflowY:    'auto',
      maxHeight:    '210px',
      padding:      '5px 10px 2px',
      borderBottom: '1px solid #004422',
    });
    this._log = log;

    const row = document.createElement('div');
    Object.assign(row.style, {
      display:    'flex',
      alignItems: 'center',
      padding:    '4px 10px',
      gap:        '6px',
    });

    const prompt = document.createElement('span');
    prompt.textContent = '~>';
    prompt.style.color = '#00ff55';
    prompt.style.userSelect = 'none';

    const input = document.createElement('input');
    Object.assign(input.style, {
      flex:       '1',
      background: 'transparent',
      border:     'none',
      outline:    'none',
      color:      '#00ff88',
      fontFamily: 'inherit',
      fontSize:   '13px',
    });
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck',   'false');
    this._input = input;

    row.append(prompt, input);
    wrap.append(log, row);
    document.body.appendChild(wrap);
    this._wrap = wrap;
  }

  // ── Klawiatura ────────────────────────────────────────────────────────────

  _bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') {     // ~ / `
        e.preventDefault();
        this._toggle();
        return;
      }
      if (!this._open) return;

      if (e.key === 'Escape') { this._toggle(); return; }

      if (e.key === 'Enter') {
        const cmd = this._input.value.trim();
        if (cmd) {
          this._history.unshift(cmd);
          this._histIdx = -1;
          this._input.value = '';
          this._exec(cmd);
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this._histIdx < this._history.length - 1) {
          this._histIdx++;
          this._input.value = this._history[this._histIdx];
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this._histIdx > 0) {
          this._histIdx--;
          this._input.value = this._history[this._histIdx];
        } else {
          this._histIdx = -1;
          this._input.value = '';
        }
        return;
      }
    });

    // Zatrzymaj propagację do Phasera gdy konsola otwarta
    this._input.addEventListener('keydown', (e) => e.stopPropagation());
  }

  // ── Otwieranie / zamykanie ────────────────────────────────────────────────

  _toggle() {
    this._open = !this._open;
    this._wrap.style.display = this._open ? 'flex' : 'none';
    if (this._open) {
      this.scene.input.keyboard.enabled = false;
      this._input.focus();
      this._print('━━ DEV CONSOLE ━━  wpisz "help"', '#00ff55');
    } else {
      this.scene.input.keyboard.enabled = true;
      this._input.blur();
    }
  }

  // ── Output ────────────────────────────────────────────────────────────────

  _print(msg, color = '#00ff88') {
    const line = document.createElement('div');
    line.style.color = color;
    line.textContent = msg;
    this._log.appendChild(line);
    this._log.scrollTop = this._log.scrollHeight;
  }

  // ── Parser komend ─────────────────────────────────────────────────────────

  _exec(raw) {
    this._print('> ' + raw, '#55ffaa');
    const parts = raw.trim().split(/\s+/);
    const cmd   = parts[0].toLowerCase();
    const args  = parts.slice(1);
    const s     = this.scene;
    const sub   = s.sub;

    try {
      switch (cmd) {

        case 'help':
          this._print('Dostępne komendy:');
          this._print('  time <0-1 | dawn | noon | dusk | midnight | night>');
          this._print('  hull <0-1>    — kondycja kadłuba (1.0 = cały)');
          this._print('  depth <m>     — ustaw głębokość w metrach');
          this._print('  tp <x>        — teleport do pozycji X w świecie');
          this._print('  spawn [n]     — spawnuj N wrogów (domyślnie 1)');
          this._print('  kill          — zatop wszystkich wrogów');
          this._print('  wave <n>      — ustaw nr fali zagrożenia');
          this._print('  ammo          — uzupełnij całą amunicję');
          this._print('  god           — nieśmiertelność toggle');
          this._print('  speed <n>     — mnożnik czasu gry (0.1–5)');
          this._print('  clear         — wyczyść log');
          break;

        // ── Pora dnia ──────────────────────────────────────────────────────
        case 'time': {
          const presets = {
            dawn: 0.27, sunrise: 0.27,
            noon: 0.50, day: 0.50,
            dusk: 0.73, sunset: 0.73,
            midnight: 0.00, night: 0.00, evening: 0.83,
          };
          let val;
          if (args[0] in presets) val = presets[args[0]];
          else val = parseFloat(args[0]);
          if (isNaN(val) || val < 0 || val > 1) {
            this._print('Błąd: time <0.0–1.0 | dawn | noon | dusk | midnight>', '#ff4444');
            break;
          }
          s._dayTime = val;
          this._print(`Pora dnia → ${val.toFixed(3)}  (${this._timeLabel(val)})`);
          break;
        }

        // ── Hull ───────────────────────────────────────────────────────────
        case 'hull': {
          const v = parseFloat(args[0]);
          if (isNaN(v)) { this._print('Błąd: hull <0.0–1.0>', '#ff4444'); break; }
          sub.hull = Math.max(0, Math.min(1, v));
          this._print(`Kadłub → ${(sub.hull * 100).toFixed(0)}%`);
          break;
        }

        // ── Głębokość ─────────────────────────────────────────────────────
        case 'depth': {
          const m = parseFloat(args[0]);
          if (isNaN(m)) { this._print('Błąd: depth <metry>', '#ff4444'); break; }
          const pxPerM = (s.OCEAN_FLOOR_Y - s.SURFACE_Y) / 600;
          sub.y  = s.SURFACE_Y + m * pxPerM;
          sub.vy = 0;
          this._print(`Głębokość → ${m}m`);
          break;
        }

        // ── Teleport ──────────────────────────────────────────────────────
        case 'tp': {
          const x = parseFloat(args[0]);
          if (isNaN(x)) { this._print('Błąd: tp <worldX>', '#ff4444'); break; }
          sub.x  = Math.max(0, Math.min(s.WORLD_W ?? 12000, x));
          sub.vx = 0;
          this._print(`Teleport → x=${Math.round(sub.x)}`);
          break;
        }

        // ── Spawn wroga ───────────────────────────────────────────────────
        case 'spawn': {
          const n = Math.max(1, parseInt(args[0]) || 1);
          const mockHunter = {
            x:              sub.x + 2500,
            lastKnownSubX:  sub.x,
            lastKnownSubY:  sub.y,
          };
          const hunter = s.enemies.find(e => !e.destroyed && !e._sinking) || mockHunter;
          for (let i = 0; i < n; i++) s._spawnReinforcement(hunter);
          this._print(`Spawniono ${n} wr${n === 1 ? 'oga' : 'ogów'}`);
          break;
        }

        // ── Zatop wszystkich ──────────────────────────────────────────────
        case 'kill': {
          let cnt = 0;
          for (const e of s.enemies) {
            if (!e._sinking && !e.destroyed) { e.startSinking(); cnt++; }
          }
          this._print(cnt ? `Zatopiono ${cnt} wrogów` : 'Brak aktywnych wrogów');
          break;
        }

        // ── Fala ──────────────────────────────────────────────────────────
        case 'wave': {
          const n = parseInt(args[0]);
          if (isNaN(n) || n < 1) { this._print('Błąd: wave <1–20>', '#ff4444'); break; }
          s._wave = n;
          const el = document.getElementById('hud-wave');
          if (el) el.textContent = String(n);
          this._print(`Fala zagrożenia → ${n}`);
          break;
        }

        // ── Uzupełnij amunicję ────────────────────────────────────────────
        case 'ammo': {
          sub.tubes.forEach(t => { t.loaded = true; t.reloadTimer = 0; });
          sub.missileCount    = 3;
          sub.noisemakerCount = 5;
          this._print('Amunicja uzupełniona (torpedy ×4, rakiety ×3, wabie ×5)');
          break;
        }

        // ── Nieśmiertelność ───────────────────────────────────────────────
        case 'god': {
          this._godMode = !this._godMode;
          s._godMode    = this._godMode;   // flaga dla GameScene
          if (this._godMode) {
            this._print('GOD MODE ON  — kadłub zablokowany', '#ffff00');
          } else {
            this._print('GOD MODE OFF', '#ffaa00');
          }
          break;
        }

        // ── Mnożnik czasu ─────────────────────────────────────────────────
        case 'speed': {
          const v = parseFloat(args[0]);
          if (isNaN(v) || v < 0.1 || v > 5) {
            this._print('Błąd: speed <0.1–5>', '#ff4444');
            break;
          }
          s.time.timeScale = v;
          this._print(`Mnożnik czasu → ×${v}`);
          break;
        }

        // ── Wyczyść log ───────────────────────────────────────────────────
        case 'clear':
          this._log.innerHTML = '';
          break;

        default:
          this._print(`Nieznana komenda: "${cmd}"  —  wpisz "help"`, '#ff4444');
      }
    } catch (err) {
      this._print(`Błąd wykonania: ${err.message}`, '#ff4444');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _timeLabel(n) {
    if (n < 0.23 || n > 0.88) return 'noc';
    if (n < 0.30) return 'przedświt';
    if (n < 0.35) return 'świt';
    if (n < 0.65) return 'dzień';
    if (n < 0.72) return 'popołudnie';
    if (n < 0.76) return 'zmierzch';
    return 'wieczór';
  }

  // ── Integracja z game loop (god mode) ────────────────────────────────────

  update() {
    if (this._godMode && this.scene.sub) {
      this.scene.sub.hull = 1.0;
    }
  }
}
