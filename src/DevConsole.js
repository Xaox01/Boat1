// Dev console — klawisz ~ otwiera/zamyka
// Panel HUD + linia komend na dole

const PANEL_BG   = 'rgba(0,6,1,0.91)';
const BORDER_CLR = '#00cc44';
const HDR_CLR    = '#00ff55';
const VAL_CLR    = '#b0ffcc';
const WARN_CLR   = '#ffcc00';
const DANGER_CLR = '#ff4444';
const DIM_CLR    = '#447755';

export class DevConsole {
  constructor(scene) {
    this.scene    = scene;
    this._open    = false;
    this._history = [];
    this._histIdx = -1;
    this._godMode = false;
    this._fps     = 60;
    this._fpsAcc  = 0;
    this._fpsCnt  = 0;

    this._buildDOM();
    this._bindKeys();
  }

  // ── DOM ──────────────────────────────────────────────────────────────────

  _buildDOM() {
    const css = `
      #dev-hud * { box-sizing: border-box; margin: 0; padding: 0; }
      #dev-hud {
        display: none; position: fixed; inset: 0;
        pointer-events: none; z-index: 99999;
        font-family: "Courier New", monospace; font-size: 11px;
        color: ${VAL_CLR}; line-height: 1.55;
        flex-direction: column;
      }
      .dev-panels {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: auto auto;
        gap: 2px; padding: 2px;
      }
      .dev-panel {
        background: ${PANEL_BG};
        border: 1px solid ${BORDER_CLR};
        padding: 4px 7px 5px;
        min-width: 0; overflow: hidden;
      }
      .dev-panel-hdr {
        color: ${HDR_CLR}; letter-spacing: 1.5px;
        font-size: 10px; font-weight: bold;
        border-bottom: 1px solid #004422;
        margin-bottom: 3px; padding-bottom: 2px;
      }
      .dev-row { display: flex; gap: 16px; flex-wrap: wrap; }
      .dev-field { white-space: nowrap; }
      .dev-lbl { color: ${DIM_CLR}; }
      .dev-val { color: ${VAL_CLR}; }
      .dev-warn { color: ${WARN_CLR}; }
      .dev-danger { color: ${DANGER_CLR}; }
      .dev-ok { color: #00ff88; }
      .dev-enemy-row { border-top: 1px solid #003318; padding-top: 2px; margin-top: 2px; }
      #dev-log-wrap {
        pointer-events: auto;
        background: rgba(0,4,0,0.90);
        border-top: 1px solid #004422;
        max-height: 90px; overflow-y: auto;
        padding: 3px 10px;
      }
      #dev-cmd {
        pointer-events: auto;
        display: flex; align-items: center; gap: 7px;
        background: rgba(0,6,1,0.95);
        border-top: 2px solid ${BORDER_CLR};
        padding: 4px 10px;
      }
      #dev-cmd-prompt { color: ${HDR_CLR}; user-select: none; }
      #dev-cmd-input {
        flex: 1; background: transparent; border: none; outline: none;
        color: #00ff88; font-family: inherit; font-size: 12px;
      }
      .dev-spacer { flex: 1; pointer-events: none; }
    `;
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    const hud = document.createElement('div');
    hud.id = 'dev-hud';

    // ── Panele ────────────────────────────────────────────────────────────
    const panels = document.createElement('div');
    panels.className = 'dev-panels';

    this._pSub  = this._panel('ŁÓDŹ PODWODNA', panels);
    this._pEnm  = this._panel('WROGOWIE', panels);
    this._pPrj  = this._panel('POCISKI', panels);
    this._pWld  = this._panel('ŚWIAT / SCENA', panels);

    hud.appendChild(panels);

    // spacer między panelami a konsolą
    const spacer = document.createElement('div');
    spacer.className = 'dev-spacer';
    hud.appendChild(spacer);

    // ── Log komend ────────────────────────────────────────────────────────
    this._logEl = document.createElement('div');
    this._logEl.id = 'dev-log-wrap';
    hud.appendChild(this._logEl);

    // ── Linia komend ──────────────────────────────────────────────────────
    const cmdRow = document.createElement('div');
    cmdRow.id = 'dev-cmd';

    const prompt = document.createElement('span');
    prompt.id = 'dev-cmd-prompt';
    prompt.textContent = '~>';

    const inp = document.createElement('input');
    inp.id = 'dev-cmd-input';
    inp.setAttribute('autocomplete', 'off');
    inp.setAttribute('spellcheck', 'false');
    inp.setAttribute('placeholder', 'wpisz komendę… (help = lista)');
    this._input = inp;

    cmdRow.append(prompt, inp);
    hud.appendChild(cmdRow);

    document.body.appendChild(hud);
    this._hud = hud;
  }

  _panel(title, parent) {
    const wrap = document.createElement('div');
    wrap.className = 'dev-panel';

    const hdr = document.createElement('div');
    hdr.className = 'dev-panel-hdr';
    hdr.textContent = `▸ ${title}`;

    const body = document.createElement('div');
    wrap.append(hdr, body);
    parent.appendChild(wrap);
    return body;
  }

  // ── Klawiatura ────────────────────────────────────────────────────────────

  _bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') { e.preventDefault(); this._toggle(); }
    });

    this._input.addEventListener('keydown', (e) => {
      e.stopPropagation();

      if (e.key === 'Escape')     { this._toggle(); return; }
      if (e.key === 'Enter')      { this._submit(); return; }
      if (e.key === 'ArrowUp')    { e.preventDefault(); this._histNav(1);  return; }
      if (e.key === 'ArrowDown')  { e.preventDefault(); this._histNav(-1); return; }
    });
  }

  _toggle() {
    this._open = !this._open;
    this._hud.style.display = this._open ? 'flex' : 'none';
    if (this._open) {
      this.scene.input.keyboard.enabled = false;
      this._input.focus();
      this._print('▸ DEV HUD aktywny — "help" = lista komend', DIM_CLR);
    } else {
      this.scene.input.keyboard.enabled = true;
      this._input.blur();
    }
  }

  _submit() {
    const cmd = this._input.value.trim();
    if (!cmd) return;
    this._history.unshift(cmd);
    this._histIdx = -1;
    this._input.value = '';
    this._exec(cmd);
  }

  _histNav(dir) {
    this._histIdx = Math.max(-1, Math.min(this._history.length - 1, this._histIdx + dir));
    this._input.value = this._histIdx >= 0 ? this._history[this._histIdx] : '';
  }

  // ── Rysowanie paneli ──────────────────────────────────────────────────────

  update(dt) {
    // FPS
    this._fpsAcc += dt;
    this._fpsCnt++;
    if (this._fpsAcc >= 0.5) {
      this._fps    = Math.round(this._fpsCnt / this._fpsAcc);
      this._fpsAcc = 0;
      this._fpsCnt = 0;
    }

    if (this._godMode && this.scene.sub) this.scene.sub.hull = 1.0;
    if (!this._open) return;

    this._drawSub();
    this._drawEnemies();
    this._drawProjectiles();
    this._drawWorld();
  }

  // ── Panel: ŁÓDŹ PODWODNA ─────────────────────────────────────────────────

  _drawSub() {
    const sub = this.scene.sub;
    const spd = Math.sqrt(sub.vx ** 2 + sub.vy ** 2);
    const hullPct = (sub.hull * 100).toFixed(1);
    const hullCls = sub.hull > 0.6 ? 'dev-ok' : sub.hull > 0.3 ? 'dev-warn' : 'dev-danger';
    const o2Pct   = ((sub.oxygen ?? 1) * 100).toFixed(1);
    const o2Cls   = (sub.oxygen ?? 1) > 0.5 ? 'dev-ok' : 'dev-warn';
    const tBelow  = sub.belowThermocline;

    this._pSub.innerHTML = `
      <div class="dev-row">
        <span class="dev-field"><span class="dev-lbl">X:</span> <span class="dev-val">${Math.round(sub.x)} px</span></span>
        <span class="dev-field"><span class="dev-lbl">Y:</span> <span class="dev-val">${Math.round(sub.y)} px</span></span>
        <span class="dev-field"><span class="dev-lbl">Depth:</span> <span class="dev-val">${sub.depthMetres.toFixed(1)} m</span></span>
      </div>
      <div class="dev-row">
        <span class="dev-field"><span class="dev-lbl">VX:</span> <span class="dev-val">${sub.vx > 0 ? '+' : ''}${sub.vx.toFixed(1)} px/s</span></span>
        <span class="dev-field"><span class="dev-lbl">VY:</span> <span class="dev-val">${sub.vy > 0 ? '+' : ''}${sub.vy.toFixed(1)} px/s</span></span>
        <span class="dev-field"><span class="dev-lbl">SPD:</span> <span class="dev-val">${spd.toFixed(1)} px/s</span></span>
      </div>
      <div class="dev-row">
        <span class="dev-field"><span class="dev-lbl">Hull:</span> <span class="${hullCls}">${hullPct}%</span></span>
        <span class="dev-field"><span class="dev-lbl">O₂:</span> <span class="${o2Cls}">${o2Pct}%</span></span>
        <span class="dev-field"><span class="dev-lbl">Thermo:</span> <span class="${tBelow ? 'dev-ok' : 'dev-warn'}">${tBelow ? 'POD' : 'NAD'}</span></span>
      </div>
      <div class="dev-row">
        <span class="dev-field"><span class="dev-lbl">Torp:</span> <span class="dev-val">${sub.torpedoCount}/4</span></span>
        <span class="dev-field"><span class="dev-lbl">Rakiety:</span> <span class="dev-val">${sub.missileCount ?? 0}/3</span></span>
        <span class="dev-field"><span class="dev-lbl">Wabie:</span> <span class="dev-val">${sub.noisemakerCount ?? 0}/5</span></span>
      </div>
      <div class="dev-row">
        <span class="dev-field"><span class="dev-lbl">SR:</span> <span class="${sub.silentRunning ? 'dev-ok' : 'dev-lbl'}">${sub.silentRunning ? '■ ON' : '□ OFF'}</span></span>
        <span class="dev-field"><span class="dev-lbl">LM:</span> <span class="${sub.listenMode ? 'dev-ok' : 'dev-lbl'}">${sub.listenMode ? '■ ON' : '□ OFF'}</span></span>
        ${this._godMode ? '<span class="dev-danger">■ GOD MODE</span>' : ''}
      </div>
      <div class="dev-row">
        ${sub.tubes.map((t, i) =>
          `<span class="dev-field"><span class="dev-lbl">R${i + 1}:</span> <span class="${t.loaded ? 'dev-ok' : 'dev-warn'}">${t.loaded ? 'LOADED' : `${Math.ceil(t.reloadTimer)}s`}</span></span>`
        ).join('')}
      </div>`;
  }

  // ── Panel: WROGOWIE ───────────────────────────────────────────────────────

  _drawEnemies() {
    const sub     = this.scene.sub;
    const enemies = this.scene.enemies;
    if (!enemies.length) {
      this._pEnm.innerHTML = `<span class="dev-lbl">brak wrogów</span>`;
      return;
    }

    const rows = enemies.map(e => {
      const dist = Math.round(Math.abs(e.x - sub.x));
      const hPct = (e.hull * 100).toFixed(0);
      const hCls = e.hull > 0.6 ? 'dev-ok' : e.hull > 0.3 ? 'dev-warn' : 'dev-danger';

      if (e._sinking) {
        const prog = (1 - e._sinkTimer / e._sinkDur) * 100;
        return `<div class="dev-enemy-row">
          <span class="dev-danger">[TONIE]</span>
          <span class="dev-lbl"> ${e.label ?? '?'}</span>
          <span class="dev-val"> x:${Math.round(e.x)}px  prog:${prog.toFixed(0)}%</span>
        </div>`;
      }

      const stCls = { PATROL:'dev-lbl', ALERT:'dev-warn', HUNT:'dev-danger', SEARCH:'dev-warn', WITHDRAW:'dev-lbl' }[e.state] || 'dev-val';
      const detect = e.detectTimer?.toFixed(1) ?? '0.0';
      return `<div class="dev-enemy-row">
        <div class="dev-row">
          <span class="dev-field"><span class="dev-lbl">[</span><span class="dev-val">${e.label ?? '?'}</span><span class="dev-lbl">]</span></span>
          <span class="dev-field"><span class="${stCls}">${e.state}</span></span>
          <span class="dev-field"><span class="${hCls}">${hPct}%</span></span>
          <span class="dev-field dev-lbl">Δ:${dist}px</span>
        </div>
        <div class="dev-row">
          <span class="dev-field"><span class="dev-lbl">x:</span><span class="dev-val">${Math.round(e.x)}px</span></span>
          <span class="dev-field"><span class="dev-lbl">y:</span><span class="dev-val">${Math.round(e.y)}px</span></span>
          <span class="dev-field"><span class="dev-lbl">det:</span><span class="dev-val">${detect}</span></span>
          ${e.needsReinforcement ? '<span class="dev-danger">WZYWA POSIŁKI</span>' : ''}
          ${e._flankApproach ? '<span class="dev-warn">FLANK</span>' : ''}
        </div>
      </div>`;
    });

    this._pEnm.innerHTML = rows.join('');
  }

  // ── Panel: POCISKI ────────────────────────────────────────────────────────

  _drawProjectiles() {
    const sub  = this.scene.sub;
    const rows = [];

    for (const t of sub.torpedoes) {
      const spd = Math.sqrt((t.vx ?? 0) ** 2 + (t.vy ?? 0) ** 2).toFixed(0);
      rows.push(`<div class="dev-row">
        <span class="dev-danger">[TRP]</span>
        <span class="dev-field"><span class="dev-lbl">x:</span><span class="dev-val">${Math.round(t.x)}px</span></span>
        <span class="dev-field"><span class="dev-lbl">y:</span><span class="dev-val">${Math.round(t.y)}px</span></span>
        <span class="dev-field"><span class="dev-lbl">spd:</span><span class="dev-val">${spd}px/s</span></span>
        <span class="dev-field"><span class="dev-lbl">vx:</span><span class="dev-val">${(t.vx ?? 0) > 0 ? '+' : ''}${(t.vx ?? 0).toFixed(0)}</span></span>
        <span class="dev-field"><span class="dev-lbl">vy:</span><span class="dev-val">${(t.vy ?? 0) > 0 ? '+' : ''}${(t.vy ?? 0).toFixed(0)}</span></span>
        ${t.target ? `<span class="dev-lbl">→ ${t.target.label ?? 'cel'}</span>` : ''}
      </div>`);
    }

    for (const m of sub.missiles) {
      rows.push(`<div class="dev-row">
        <span class="dev-warn">[MSL]</span>
        <span class="dev-field"><span class="dev-lbl">x:</span><span class="dev-val">${Math.round(m.x)}px</span></span>
        <span class="dev-field"><span class="dev-lbl">y:</span><span class="dev-val">${Math.round(m.y)}px</span></span>
        <span class="dev-field"><span class="dev-lbl">vx:</span><span class="dev-val">${(m.vx ?? 0) > 0 ? '+' : ''}${(m.vx ?? 0).toFixed(0)}</span></span>
        <span class="dev-field"><span class="dev-lbl">targetX:</span><span class="dev-val">${Math.round(m.targetX ?? 0)}px</span></span>
      </div>`);
    }

    for (const e of this.scene.enemies) {
      for (const ht of (e.homingTorpedoes || [])) {
        if (ht.dead) continue;
        rows.push(`<div class="dev-row">
          <span class="dev-danger">[ASROC]</span>
          <span class="dev-lbl">od ${e.label ?? '?'}</span>
          <span class="dev-field"><span class="dev-lbl">x:</span><span class="dev-val">${Math.round(ht.x)}px</span></span>
          <span class="dev-field"><span class="dev-lbl">y:</span><span class="dev-val">${Math.round(ht.y)}px</span></span>
          <span class="${ht.locked ? 'dev-danger' : 'dev-warn'}">${ht.locked ? 'LOCKED' : 'SEEKING'}</span>
        </div>`);
      }
    }

    for (const n of sub.noisemakers) {
      const rem = ((n.lifetime - n.age)).toFixed(1);
      rows.push(`<div class="dev-row">
        <span class="dev-lbl">[WABIK]</span>
        <span class="dev-field"><span class="dev-lbl">x:</span><span class="dev-val">${Math.round(n.x)}px</span></span>
        <span class="dev-field"><span class="dev-lbl">y:</span><span class="dev-val">${Math.round(n.y)}px</span></span>
        <span class="dev-lbl">pozostało: ${rem}s</span>
      </div>`);
    }

    this._pPrj.innerHTML = rows.length
      ? rows.join('')
      : `<span class="dev-lbl">brak pocisków / wabów w powietrzu</span>`;
  }

  // ── Panel: ŚWIAT / SCENA ──────────────────────────────────────────────────

  _drawWorld() {
    const s   = this.scene;
    const day = s._dayTime ?? 0;
    const fpsCls = this._fps >= 50 ? 'dev-ok' : this._fps >= 30 ? 'dev-warn' : 'dev-danger';
    const pings  = (s._activePings ?? []).length;
    const alive  = s.enemies.filter(e => !e._sinking && !e.destroyed).length;
    const sinking = s.enemies.filter(e => e._sinking).length;
    const merch  = (s.merchants ?? []).filter(m => !m.destroyed).length;
    const mm = String(Math.floor((s._missionTime ?? 0) / 60)).padStart(2, '0');
    const ss = String(Math.floor((s._missionTime ?? 0) % 60)).padStart(2, '0');
    const ts = s.time?.timeScale ?? 1;

    this._pWld.innerHTML = `
      <div class="dev-row">
        <span class="dev-field"><span class="dev-lbl">Pora:</span> <span class="dev-val">${day.toFixed(3)}</span> <span class="dev-lbl">${this._timeLabel(day)}</span></span>
        <span class="dev-field"><span class="dev-lbl">Fala:</span> <span class="dev-val">${s._wave ?? 1}</span></span>
        <span class="dev-field ${fpsCls}">FPS: ${this._fps}</span>
        ${ts !== 1 ? `<span class="dev-warn">×${ts} speed</span>` : ''}
      </div>
      <div class="dev-row">
        <span class="dev-field"><span class="dev-lbl">CamX:</span> <span class="dev-val">${Math.round(s.camX ?? 0)} px</span></span>
        <span class="dev-field"><span class="dev-lbl">Czas:</span> <span class="dev-val">${mm}:${ss}</span></span>
        <span class="dev-field"><span class="dev-lbl">Pingi:</span> <span class="dev-val">${pings}</span></span>
      </div>
      <div class="dev-row">
        <span class="dev-field"><span class="dev-lbl">Wrogowie:</span> <span class="dev-val">${alive} aktywnych</span></span>
        ${sinking ? `<span class="dev-danger">${sinking} tonie</span>` : ''}
        <span class="dev-field"><span class="dev-lbl">Kupcy:</span> <span class="dev-val">${merch}</span></span>
      </div>
      <div class="dev-row">
        <span class="dev-field"><span class="dev-lbl">Sub X:</span> <span class="dev-val">${Math.round(s.sub?.x ?? 0)} px</span></span>
        <span class="dev-field"><span class="dev-lbl">WORLD_W:</span> <span class="dev-val">${s.WORLD_W ?? 12000} px</span></span>
        <span class="dev-field"><span class="dev-lbl">SURF_Y:</span> <span class="dev-val">${s.SURFACE_Y ?? 80} px</span></span>
        <span class="dev-field"><span class="dev-lbl">FLOOR_Y:</span> <span class="dev-val">${s.OCEAN_FLOOR_Y ?? 580} px</span></span>
      </div>`;
  }

  // ── Log / output komend ───────────────────────────────────────────────────

  _print(msg, color = VAL_CLR) {
    const line = document.createElement('div');
    line.style.color = color;
    line.textContent = msg;
    this._logEl.appendChild(line);
    this._logEl.scrollTop = this._logEl.scrollHeight;
    // max 80 linii w logu
    while (this._logEl.children.length > 80) this._logEl.removeChild(this._logEl.firstChild);
  }

  // ── Parser komend ─────────────────────────────────────────────────────────

  _exec(raw) {
    this._print('> ' + raw, HDR_CLR);
    const parts = raw.trim().split(/\s+/);
    const cmd   = parts[0].toLowerCase();
    const args  = parts.slice(1);
    const s     = this.scene;
    const sub   = s.sub;

    try {
      switch (cmd) {

        case 'help':
          this._print('── Komendy ──────────────────────────────────────────────', DIM_CLR);
          this._print('  time <0-1 | dawn | noon | dusk | midnight>');
          this._print('  hull <0-1>    — kondycja kadłuba');
          this._print('  depth <m>     — głębokość w metrach');
          this._print('  tp <x>        — teleport na X [px]');
          this._print('  spawn [n]     — spawnuj N wrogów');
          this._print('  kill          — zatop wszystkich wrogów');
          this._print('  wave <n>      — ustaw nr fali zagrożenia');
          this._print('  ammo          — uzupełnij całą amunicję');
          this._print('  god           — nieśmiertelność toggle');
          this._print('  speed <n>     — mnożnik czasu (0.1–5)');
          this._print('  clear         — wyczyść log');
          break;

        case 'time': {
          const presets = {
            dawn: 0.27, sunrise: 0.27, noon: 0.50, day: 0.50,
            dusk: 0.73, sunset: 0.73, midnight: 0.00, night: 0.00, evening: 0.83,
          };
          let val = args[0] in presets ? presets[args[0]] : parseFloat(args[0]);
          if (isNaN(val) || val < 0 || val > 1) {
            this._print('Błąd: time <0.0–1.0 | dawn | noon | dusk | midnight>', DANGER_CLR);
            break;
          }
          s._dayTime = val;
          this._print(`Pora dnia → ${val.toFixed(3)}  (${this._timeLabel(val)})`);
          break;
        }

        case 'hull': {
          const v = parseFloat(args[0]);
          if (isNaN(v)) { this._print('Błąd: hull <0.0–1.0>', DANGER_CLR); break; }
          sub.hull = Math.max(0, Math.min(1, v));
          this._print(`Kadłub → ${(sub.hull * 100).toFixed(0)}%`);
          break;
        }

        case 'depth': {
          const m = parseFloat(args[0]);
          if (isNaN(m)) { this._print('Błąd: depth <metry>', DANGER_CLR); break; }
          sub.y  = s.SURFACE_Y + m * ((s.OCEAN_FLOOR_Y - s.SURFACE_Y) / 600);
          sub.vy = 0;
          this._print(`Głębokość → ${m}m  (y=${Math.round(sub.y)}px)`);
          break;
        }

        case 'tp': {
          const x = parseFloat(args[0]);
          if (isNaN(x)) { this._print('Błąd: tp <worldX>', DANGER_CLR); break; }
          sub.x  = Math.max(0, Math.min(s.WORLD_W ?? 12000, x));
          sub.vx = 0;
          this._print(`Teleport → x=${Math.round(sub.x)}px`);
          break;
        }

        case 'spawn': {
          const n = Math.max(1, parseInt(args[0]) || 1);
          const anchor = s.enemies.find(e => !e.destroyed && !e._sinking)
            ?? { x: sub.x + 2500, lastKnownSubX: sub.x, lastKnownSubY: sub.y };
          for (let i = 0; i < n; i++) s._spawnReinforcement(anchor);
          this._print(`Spawniono ${n} wr${n === 1 ? 'oga' : 'ogów'}`);
          break;
        }

        case 'kill': {
          let cnt = 0;
          for (const e of s.enemies) {
            if (!e._sinking && !e.destroyed) { e.startSinking(); cnt++; }
          }
          this._print(cnt ? `Zatopiono ${cnt} wrogów` : 'Brak aktywnych wrogów');
          break;
        }

        case 'wave': {
          const n = parseInt(args[0]);
          if (isNaN(n) || n < 1) { this._print('Błąd: wave <1–20>', DANGER_CLR); break; }
          s._wave = n;
          const el = document.getElementById('hud-wave');
          if (el) el.textContent = String(n);
          this._print(`Fala zagrożenia → ${n}`);
          break;
        }

        case 'ammo':
          sub.tubes.forEach(t => { t.loaded = true; t.reloadTimer = 0; });
          sub.missileCount    = 3;
          sub.noisemakerCount = 5;
          this._print('Amunicja uzupełniona: torpedy ×4  rakiety ×3  wabie ×5');
          break;

        case 'god':
          this._godMode = !this._godMode;
          s._godMode    = this._godMode;
          this._print(this._godMode ? '■ GOD MODE ON' : '□ GOD MODE OFF',
            this._godMode ? WARN_CLR : DIM_CLR);
          break;

        case 'speed': {
          const v = parseFloat(args[0]);
          if (isNaN(v) || v < 0.1 || v > 5) {
            this._print('Błąd: speed <0.1–5>', DANGER_CLR); break;
          }
          s.time.timeScale = v;
          this._print(`Mnożnik czasu → ×${v}`);
          break;
        }

        case 'clear':
          this._logEl.innerHTML = '';
          break;

        default:
          this._print(`Nieznana komenda: "${cmd}"  —  "help" = lista`, DANGER_CLR);
      }
    } catch (err) {
      this._print(`Błąd: ${err.message}`, DANGER_CLR);
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
}
