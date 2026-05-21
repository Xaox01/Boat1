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
    // ~ i Escape działają zawsze na poziomie document — niezależnie od focusa
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') { e.preventDefault(); this._toggle(); return; }
      if (e.key === 'Escape' && this._open) { e.preventDefault(); this._toggle(); return; }
    });

    // Input: stopPropagation gdy użytkownik pisze, żeby klawisze nie szły do gry
    this._input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter')     { this._submit();             return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); this._histNav(1);  return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); this._histNav(-1); return; }
    });
  }

  _toggle() {
    this._open = !this._open;
    this._hud.style.display = this._open ? 'flex' : 'none';
    if (this._open) {
      // NIE blokujemy keyboard.enabled — gra działa normalnie z otwartą konsolą.
      // Klawisze idą do gry, chyba że input ma focus (wtedy stopPropagation na inpucie).
      this._print('▸ DEV HUD aktywny — kliknij pole poniżej by wpisać komendę', DIM_CLR);
    } else {
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

  async _exec(raw) {
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
          this._print('  spawn [n]     — spawnuj N wrogów (alert, z dystansu)');
          this._print('  ship [n] [dx] — spawnuj N okrętów tuż obok (widoczne, PATROL)');
          this._print('  reveal        — ujawnij wszystkich wrogów na ekranie');
          this._print('  kill          — zatop wszystkich wrogów');
          this._print('  wave <n>      — ustaw nr fali zagrożenia');
          this._print('  ammo          — uzupełnij całą amunicję');
          this._print('  god           — nieśmiertelność toggle');
          this._print('  speed <n>     — mnożnik czasu (0.1–5)');
          this._print('  clear         — wyczyść log');
          this._print('── MAPA TESTOWA ─────────────────────────────────────────', DIM_CLR);
          this._print('  testmap       — załaduj mapę testową (5 stref, god mode)');
          this._print('  resetmap      — wyjdź z trybu testowego');
          this._print('── AWARIE ───────────────────────────────────────────────', DIM_CLR);
          this._print('  sys                          — status wszystkich systemów');
          this._print('  attack <asroc|dc|hedgehog|floor|crush|tlen> [%] — symuluj trafienie');
          this._print('  dmg <system> [0-1]           — ustaw zdrowie systemu');
          this._print('  repair [system|all]          — napraw system(y)');
          this._print('  sim <asroc|barrage|depth|stress|critical> — scenariusz ataku');
          this._print('── EFEKTY WIZUALNE ──────────────────────────────────────', DIM_CLR);
          this._print('  firetest [n]                 — spawnuj N palących się okrętów do obserwacji');
          this._print('  fire [0.4|0.3|0.1|off]       — ustaw poziom pożaru (hull wroga)');
          this._print('    0.4 = dziób  0.3 = dziób+rufa  0.1 = pełny inferno  off = gasi');
          this._print('  boom [n] [spread] [surf|deep|floor] — wyzwól N eksplozji');
          this._print('    boom          = 1 przy tafli');
          this._print('    boom 3 200 deep  = 3 pod wodą, spread 200px');
          this._print('    boom 1 0 floor   = 1 przy dnie (sediment+bąble)');
          this._print('  testfx               — sekwencyjny test WSZYSTKICH efektów FX');
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

        case 'ship': {
          // Spawnuje okręty blisko gracza — pełna widoczność, spokojny patrol
          const n  = Math.max(1, Math.min(8, parseInt(args[0]) || 1));
          const dx = parseFloat(args[1]) || 350;   // domyślnie 350px od gracza
          const WORLD_W = s.WORLD_W ?? 12000;
          const { Enemy: EnemyCls } = await import('./Enemy.js');
          for (let i = 0; i < n; i++) {
            const offset = dx + i * 200;
            const cx = Math.max(200, Math.min(WORLD_W - 200, sub.x + offset));
            const e  = new EnemyCls(s, cx, Math.max(80, cx - 800), Math.min(WORLD_W - 80, cx + 800), `TEST-${i + 1}`);
            e.revealTimer = 9999;   // zawsze widoczny
            s.enemies.push(e);
            this._print(`  TEST-${i + 1}  x=${Math.round(cx)}px`, VAL_CLR);
          }
          this._print(`Spawniono ${n} okr${n === 1 ? 'ęt' : 'ęty/ętów'} (widoczne)`);
          break;
        }

        case 'reveal': {
          // Ujawnij wszystkich aktualnych wrogów na 60 sekund
          let cnt = 0;
          for (const e of s.enemies) {
            if (!e.destroyed) { e.revealTimer = Math.max(e.revealTimer, 60); cnt++; }
          }
          for (const m of s.merchants ?? []) {
            m.revealTimer = Math.max(m.revealTimer, 60); cnt++;
          }
          this._print(cnt ? `Ujawniono ${cnt} jednostek na 60s` : 'Brak jednostek');
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

        // ── MAPA TESTOWA ─────────────────────────────────────────────────────

        case 'testmap': {
          // Zniszcz wszystkie obecne jednostki
          for (const e of s.enemies) {
            if (e.gfx)     e.gfx.destroy();
            if (e.fireGfx) e.fireGfx.destroy();
            if (e._sprite) e._sprite.destroy();
          }
          for (const m of (s.merchants ?? [])) { if (m.gfx) m.gfx.destroy(); }
          s.enemies   = [];
          s.merchants = [];

          // Pozycja startowa — tuż pod termoklinem (~240m)
          const BASE_X   = 2000;
          const THERMO_Y = s.SURFACE_Y + Math.round((s.OCEAN_FLOOR_Y - s.SURFACE_Y) * 0.33);
          sub.x = BASE_X;
          sub.y = THERMO_Y + 35;
          sub.vx = sub.vy = 0;

          // Pełna regeneracja okrętu
          sub.hull            = 1.0;
          sub.battery         = 1.0;
          sub.oxygen          = 1.0;
          sub.missileCount    = 3;
          sub.noisemakerCount = 5;
          sub.tubes.forEach(t => { t.loaded = true; t.reloadTimer = 0; });
          for (const sys of Object.values(sub.systems)) sys.health = 1.0;

          // God mode + reset wave
          this._godMode = s._godMode = true;
          s._wave             = 1;
          s._enemiesSpawned   = true;
          s._waveTimer        = 0;
          s.camX = Math.max(0, BASE_X - 320);

          // Progowo z Enemy.js (hardkodowane — muszą zgadzać się z HUNT_THRESHOLD/ALERT_THRESHOLD)
          const HUNT_T  = 7.5;
          const ALERT_T = 2.7;

          const { Enemy: EnemyCls } = await import('./Enemy.js');
          const WW = s.WORLD_W ?? 12000;

          // 5 stref taktycznych z różnymi dystansami i stanami AI
          const ZONES = [
            { dx:  230, state: 'HUNT',   label: 'HEDGE-ZONE ', info: 'zasięg hedgehog/RBU     (+230px)' },
            { dx:  600, state: 'HUNT',   label: 'DC-ZONE    ', info: 'zasięg zarzutów DC      (+600px)' },
            { dx: 1400, state: 'ALERT',  label: 'SONAR-MID  ', info: 'mid-range sonaru pas.  (+1400px)' },
            { dx: 2900, state: 'PATROL', label: 'ASROC-ZONE ', info: 'optymalny zasięg ASROC (+2900px)' },
            { dx: -350, state: 'PATROL', label: 'LEFT-FLANK ', info: 'flanka lewa             (-350px)' },
          ];

          s._prevEnemyState = new Map();
          for (const z of ZONES) {
            const cx   = Math.max(250, Math.min(WW - 250, BASE_X + z.dx));
            const half = 280;                             // wąski patrol — nie odpływa
            const e    = new EnemyCls(
              s, cx,
              Math.max(80, cx - half),
              Math.min(WW - 80, cx + half),
              z.label.trim()
            );
            e.revealTimer   = 999999;                     // zawsze widoczny
            e.lastKnownSubX = sub.x;
            e.lastKnownSubY = sub.y;
            e.detectTimer   = z.state === 'HUNT'  ? HUNT_T
                            : z.state === 'ALERT' ? ALERT_T
                            : 0;
            s.enemies.push(e);
            s._prevEnemyState.set(e, 0);                 // STATE.PATROL
          }

          // Banner HTML — pasek na górze ekranu
          this._showTestBanner(true);

          this._print('═══════════════════════════════════════════════════════', WARN_CLR);
          this._print(' MAPA TESTOWA  —  sub @ x=2000, ~240m (pod termoklinem)', WARN_CLR);
          this._print('───────────────────────────────────────────────────────', DIM_CLR);
          for (const z of ZONES) {
            const st = z.state === 'HUNT' ? '🔴 HUNT  ' : z.state === 'ALERT' ? '🟡 ALERT ' : '🟢 PATROL';
            this._print(`  ${z.label}  [${st}]  ${z.info}`, VAL_CLR);
          }
          this._print('───────────────────────────────────────────────────────', DIM_CLR);
          this._print('  god mode ON · pełna ammo · wszyscy widoczni · wave=1', DIM_CLR);
          this._print('  → resetmap   aby wyjść z trybu testowego', DIM_CLR);
          this._print('═══════════════════════════════════════════════════════', WARN_CLR);
          break;
        }

        case 'resetmap': {
          this._godMode = s._godMode = false;
          this._showTestBanner(false);
          this._print('Tryb testowy wyłączony — god mode OFF', DIM_CLR);
          break;
        }

        // ── AWARIE ──────────────────────────────────────────────────────────

        case 'sys': {
          const SYS_LABELS = {
            naped: 'Napęd     ', sonarP: 'Sonar-P   ', sonarA: 'Sonar-A   ',
            torpedy: 'Torpedy   ', rakiety: 'Rakiety   ', balast: 'Balast    ',
            tlen: 'Tlen      ', zasilanie: 'Zasilanie ',
          };
          this._print('─── Status systemów ────────────────────────────────────', DIM_CLR);
          for (const [key, sys] of Object.entries(sub.systems)) {
            const h   = sys.health ?? 1;
            const pct = (h * 100).toFixed(0).padStart(3);
            const filled = Math.round(h * 12);
            const bar = '█'.repeat(filled) + '░'.repeat(12 - filled);
            const clr = h > 0.65 ? '#00ff88' : h > 0.30 ? WARN_CLR : DANGER_CLR;
            this._print(`  ${SYS_LABELS[key] ?? key.padEnd(10)} [${bar}] ${pct}%`, clr);
          }
          break;
        }

        case 'attack': {
          const SRC_MAP = {
            asroc:    'TORPEDA ASROC',
            dc:       'ZARZUT GŁĘBINOWY',
            hedgehog: 'HEDGEHOG',
            floor:    'KOLIZJA Z DNEM',
            crush:    'PRZECIĄŻENIE CIŚNIENIOWE',
            tlen:     'BRAK TLENU',
          };
          const type = (args[0] ?? '').toLowerCase();
          const src  = SRC_MAP[type];
          if (!src) {
            this._print('Błąd: attack <asroc|dc|floor|crush|tlen> [%]', DANGER_CLR);
            break;
          }
          const pct = parseFloat(args[1]);
          const dmg = isNaN(pct) ? 0.25 : Math.max(0.01, Math.min(1, pct / 100));
          sub.applyDamage(dmg, src);
          this._print(`Atak: ${src}  obrażenia=${(dmg * 100).toFixed(0)}%  kadłub→${(sub.hull * 100).toFixed(1)}%`, WARN_CLR);
          break;
        }

        case 'dmg': {
          const KEY_ALIASES = {
            naped: 'naped', napęd: 'naped',
            sonarp: 'sonarP', 'sonar-p': 'sonarP', sonarp: 'sonarP',
            sonara: 'sonarA', 'sonar-a': 'sonarA',
            torpedy: 'torpedy', rakiety: 'rakiety',
            balast: 'balast', tlen: 'tlen',
            zasilanie: 'zasilanie', power: 'zasilanie',
          };
          const raw = (args[0] ?? '').toLowerCase();
          const key = KEY_ALIASES[raw];
          if (!key || !sub.systems[key]) {
            this._print('Błąd: dmg <naped|sonarp|sonara|torpedy|rakiety|balast|tlen|zasilanie> [0-1]', DANGER_CLR);
            break;
          }
          const v = parseFloat(args[1]);
          const h = isNaN(v) ? 0 : Math.max(0, Math.min(1, v));
          sub.systems[key].health = h;
          const clr = h > 0.65 ? '#00ff88' : h > 0.30 ? WARN_CLR : DANGER_CLR;
          this._print(`${key} zdrowie → ${(h * 100).toFixed(0)}%`, clr);
          break;
        }

        case 'repair': {
          const raw = (args[0] ?? 'all').toLowerCase();
          if (raw === 'all') {
            for (const sys of Object.values(sub.systems)) sys.health = 1.0;
            this._print('Wszystkie systemy naprawione (100%)', '#00ff88');
          } else {
            const KEY_ALIASES = {
              naped: 'naped', napęd: 'naped',
              sonarp: 'sonarP', 'sonar-p': 'sonarP',
              sonara: 'sonarA', 'sonar-a': 'sonarA',
              torpedy: 'torpedy', rakiety: 'rakiety',
              balast: 'balast', tlen: 'tlen',
              zasilanie: 'zasilanie', power: 'zasilanie',
            };
            const key = KEY_ALIASES[raw];
            if (!key || !sub.systems[key]) {
              this._print('Błąd: repair [system|all]', DANGER_CLR); break;
            }
            sub.systems[key].health = 1.0;
            this._print(`${key} naprawiony`, '#00ff88');
          }
          break;
        }

        case 'sim': {
          const scenario = (args[0] ?? '').toLowerCase();
          const delay = (ms, fn) => new Promise(r => setTimeout(() => { fn(); r(); }, ms));

          if (scenario === 'asroc') {
            this._print('▶ Scenariusz: 3 trafienia ASROC (4.5s)', WARN_CLR);
            (async () => {
              for (let i = 0; i < 3; i++) {
                await delay(1500, () => {
                  sub.applyDamage(0.22, 'TORPEDA ASROC');
                  this._print(`  [${i + 1}/3] ASROC → kadłub ${(sub.hull * 100).toFixed(1)}%`, DANGER_CLR);
                });
              }
              this._print('▶ ASROC zakończony', DIM_CLR);
            })();
          } else if (scenario === 'barrage') {
            this._print('▶ Scenariusz: barrage — 6 DC + 2 ASROC (8s)', WARN_CLR);
            (async () => {
              const seq = [
                [700,  'ZARZUT GŁĘBINOWY', 0.14],
                [800,  'ZARZUT GŁĘBINOWY', 0.18],
                [1000, 'ZARZUT GŁĘBINOWY', 0.12],
                [1000, 'TORPEDA ASROC',    0.25],
                [700,  'ZARZUT GŁĘBINOWY', 0.10],
                [900,  'ZARZUT GŁĘBINOWY', 0.16],
                [1100, 'TORPEDA ASROC',    0.20],
                [1300, 'ZARZUT GŁĘBINOWY', 0.13],
              ];
              for (const [ms, src, dmg] of seq) {
                await delay(ms, () => {
                  sub.applyDamage(dmg, src);
                  this._print(`  ${src} → kadłub ${(sub.hull * 100).toFixed(1)}%`, DANGER_CLR);
                });
              }
              this._print('▶ Barrage zakończony', DIM_CLR);
            })();
          } else if (scenario === 'depth') {
            this._print('▶ Scenariusz: 8 zarzutów głębinowych (4.8s)', WARN_CLR);
            (async () => {
              for (let i = 0; i < 8; i++) {
                await delay(600, () => {
                  sub.applyDamage(0.13, 'ZARZUT GŁĘBINOWY');
                  this._print(`  [${i + 1}/8] DC → kadłub ${(sub.hull * 100).toFixed(1)}%`, DANGER_CLR);
                });
              }
              this._print('▶ Depth zakończony', DIM_CLR);
            })();
          } else if (scenario === 'stress') {
            this._print('▶ Scenariusz: stress — wszystkie systemy 20–40%', WARN_CLR);
            for (const [key, sys] of Object.entries(sub.systems)) {
              sys.health = 0.20 + Math.random() * 0.20;
              this._print(`  ${key} → ${(sys.health * 100).toFixed(0)}%`, WARN_CLR);
            }
            sub.hull = Math.max(0.15, sub.hull - 0.35);
            this._print(`  kadłub → ${(sub.hull * 100).toFixed(1)}%`, DANGER_CLR);
          } else if (scenario === 'critical') {
            this._print('▶ Scenariusz: critical — losowy system zniszczony', WARN_CLR);
            const keys = Object.keys(sub.systems);
            const key  = keys[Math.floor(Math.random() * keys.length)];
            sub.systems[key].health = 0;
            sub.applyDamage(0.18, 'TORPEDA ASROC');
            this._print(`  ZNISZCZONO: ${key}  kadłub → ${(sub.hull * 100).toFixed(1)}%`, DANGER_CLR);
          } else {
            this._print('Błąd: sim <asroc|barrage|depth|stress|critical>', DANGER_CLR);
          }
          break;
        }

        case 'firetest': {
          const n       = Math.max(1, Math.min(4, parseInt(args[0]) || 1));
          const WORLD_W = s.WORLD_W ?? 12000;
          const { Enemy: EnemyCls } = await import('./Enemy.js');

          // Wyczyść wszystkich aktualnych wrogów
          for (const e of s.enemies) {
            if (e.gfx)     e.gfx.destroy();
            if (e.fireGfx) e.fireGfx.destroy();
            if (e._sprite) e._sprite.destroy();
          }
          s.enemies = [];

          // Sub tuż pod powierzchnią — widok z peryskopu, widać okręty
          sub.y  = s.SURFACE_Y - 3;
          sub.vx = 0; sub.vy = 0;

          const baseX = Math.max(500, Math.min(WORLD_W - 1400, sub.x));
          if (!s._prevEnemyState) s._prevEnemyState = new Map();

          for (let i = 0; i < n; i++) {
            const cx = Math.max(200, Math.min(WORLD_W - 200, baseX + 360 + i * 320));
            const e  = new EnemyCls(s, cx, cx - 20, cx + 20, `BURN-${i + 1}`);
            e.hull        = 0.08;     // pełne inferno (wszystkie 3 strefy ognia)
            e.revealTimer = 999999;
            e.dir         = -1;       // skierowany w stronę gracza
            s.enemies.push(e);
            s._prevEnemyState.set(e, 0);
            this._print(`  BURN-${i + 1}  x=${Math.round(cx)}px  hull=8%  🔥🔥🔥`, WARN_CLR);
          }

          if (!this._godMode) {
            this._godMode = s._godMode = true;
            this._print('  God mode włączony', DIM_CLR);
          }

          this._print('─── FIRETEST ───────────────────────────────────────────', HDR_CLR);
          this._print(`  ${n} okrętów w pełnym inferno — obserwuj bez walki`, VAL_CLR);
          this._print('  speed 0.3   — zwolnij czas do obserwacji', DIM_CLR);
          this._print('  boom 3 200  — eksplozje w pobliżu', DIM_CLR);
          this._print('  fire off    — zgaś pożary', DIM_CLR);
          this._print('  fire 0.4    — tylko ogień dziobowy', DIM_CLR);
          break;
        }

        case 'fire': {
          const arg = (args[0] ?? '0.1').toLowerCase();
          const alive = s.enemies.filter(e => !e.destroyed && !e._sinking);
          if (!alive.length) {
            this._print('Brak żywych wrogów — użyj "ship" żeby spawnować', WARN_CLR);
            break;
          }
          if (arg === 'off') {
            for (const e of alive) {
              e.hull = 1.0;
              e._fireParts  = [];
              e._emberParts = [];
            }
            this._print(`Pożar ugaszony — ${alive.length} okrętów przywrócono do hull 100%`, VAL_CLR);
            break;
          }
          const hullVal = parseFloat(arg);
          if (isNaN(hullVal) || hullVal < 0 || hullVal > 1) {
            this._print('Błąd: fire <0.0–1.0 | off>', DANGER_CLR);
            break;
          }
          const lvl = hullVal <= 0.20 ? '🔥🔥🔥 INFERNO (dziób+rufa+mostek)'
                    : hullVal <= 0.35 ? '🔥🔥 CIĘŻKI (dziób+rufa)'
                    : hullVal <= 0.50 ? '🔥 LEKKI (dziób)'
                    :                   '— brak (hull > 50%)';
          for (const e of alive) e.hull = hullVal;
          this._print(`Ogień: hull=${(hullVal*100).toFixed(0)}%  ${lvl}  [${alive.length} okrętów]`, WARN_CLR);
          break;
        }

        case 'boom': {
          // boom [n] [spread] [surf|deep|floor] [depth_px]
          const n      = Math.max(1, Math.min(20, parseInt(args[0]) || 1));
          const spread = Math.max(0, parseFloat(args[1]) || 180);
          const mode   = (args[2] ?? 'surf').toLowerCase();
          const centerX = s.camX + (s.scale?.width ?? 1200) / 2;
          const SURF    = s.SURFACE_Y;
          const FLOOR   = s.OCEAN_FLOOR_Y;
          const depthPx = mode === 'deep'  ? SURF + (FLOOR - SURF) * 0.55
                        : mode === 'floor' ? FLOOR - 5
                        :                   SURF;
          for (let i = 0; i < n; i++) {
            const ox = n === 1 ? 0 : (Math.random() - 0.5) * spread * 2;
            s._impactFX.trigger(centerX + ox, depthPx);
          }
          const modeLabel = { surf: 'SURFACE', deep: 'UNDERWATER (~55% głębokości)', floor: 'SEAFLOOR' }[mode] ?? mode;
          const label = n === 1 ? 'Eksplozja' : `${n} eksplozji`;
          const spreadLabel = spread > 0 && n > 1 ? ` (spread ±${spread}px)` : '';
          this._print(`${label} [${modeLabel}]${spreadLabel}`, WARN_CLR);
          break;
        }

        case 'testfx': {
          // Sekwencyjny test wszystkich efektów wizualnych
          const centerX = s.camX + (s.scale?.width ?? 1200) / 2;
          const SURF    = s.SURFACE_Y;
          const FLOOR   = s.OCEAN_FLOOR_Y;
          const delay   = (ms) => new Promise(r => setTimeout(r, ms));
          this._print('═══ TESTFX ═══════════════════════════════════════════', HDR_CLR);

          // Ustaw peryskop / blisko powierzchni żeby wszystko było widoczne
          if (s.sub.depthMetres > 30) {
            s.sub.y  = SURF + 15;
            s.sub.vy = 0;
            this._print('  Sub przesunięty blisko powierzchni', DIM_CLR);
          }
          if (!this._godMode) { this._godMode = s._godMode = true; }

          (async () => {
            this._print('  [1/5] Wybuch przy tafli (surface mode)…', VAL_CLR);
            s._impactFX.trigger(centerX - 100, SURF);
            s.cameras.main.shake(180, 0.010);
            await delay(1800);

            this._print('  [2/5] Wybuch podwodny ~55% głębokości (underwater mode)…', VAL_CLR);
            s._impactFX.trigger(centerX + 80, SURF + (FLOOR - SURF) * 0.55);
            s.cameras.main.shake(220, 0.018);
            await delay(2200);

            this._print('  [3/5] Wybuch przy dnie (underwater+sediment)…', VAL_CLR);
            s._impactFX.trigger(centerX, FLOOR - 5);
            s.cameras.main.shake(220, 0.018);
            await delay(2500);

            this._print('  [4/5] Salwa 3 wybuchów przy tafli…', VAL_CLR);
            for (let i = 0; i < 3; i++) {
              s._impactFX.trigger(centerX + (i - 1) * 200, SURF);
              s.cameras.main.shake(120, 0.008);
              await delay(450);
            }
            await delay(1500);

            this._print('  [5/5] Okręt wroga w ogniu (hull=8%)…', VAL_CLR);
            const { Enemy: EnemyCls } = await import('./Enemy.js');
            const cx = Math.max(200, Math.min((s.WORLD_W ?? 12000) - 200, centerX + 250));
            const e  = new EnemyCls(s, cx, cx - 20, cx + 20, 'TESTFX-SHIP');
            e.hull = 0.08; e.revealTimer = 9999;
            if (!s._prevEnemyState) s._prevEnemyState = new Map();
            s.enemies.push(e); s._prevEnemyState.set(e, 0);
            await delay(3000);

            this._print('═══ TESTFX ZAKOŃCZONY ════════════════════════════════', HDR_CLR);
            this._print('  ship spawnowany (hull 8% = pełne inferno)', DIM_CLR);
            this._print('  kill — aby zatopić  |  fire off — aby zgasić', DIM_CLR);
          })();
          break;
        }

        default:
          this._print(`Nieznana komenda: "${cmd}"  —  "help" = lista`, DANGER_CLR);
      }
    } catch (err) {
      this._print(`Błąd: ${err.message}`, DANGER_CLR);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _showTestBanner(visible) {
    if (visible) {
      if (!this._testBanner) {
        const b = document.createElement('div');
        b.id = 'dev-test-banner';
        b.style.cssText = [
          'position:fixed', 'top:0', 'left:0', 'right:0',
          'background:rgba(255,140,0,0.13)',
          'border-bottom:1px solid rgba(255,140,0,0.55)',
          'color:#ff9900',
          'font-family:"Courier New",monospace',
          'font-size:10px',
          'letter-spacing:2px',
          'text-align:center',
          'padding:3px 0',
          'z-index:88888',
          'pointer-events:none',
        ].join(';');
        b.innerHTML = '▸ TRYB TESTOWY &nbsp;|&nbsp; god mode &nbsp;|&nbsp; wszyscy wrogowie widoczni &nbsp;|&nbsp; <span style="opacity:.7">resetmap — wyjście</span>';
        document.body.appendChild(b);
        this._testBanner = b;
      } else {
        this._testBanner.style.display = '';
      }
    } else if (this._testBanner) {
      this._testBanner.style.display = 'none';
    }
  }

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
