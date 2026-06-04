import { SaveSystem } from './SaveSystem.js';
import { t, setLang, applyI18n } from './i18n.js';

const ACCENT = '#e8413a';

const SUB_SVG = `
<svg viewBox="0 0 1400 280" style="width:100%;height:100%;overflow:visible">
  <defs>
    <pattern id="m-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="5" stroke="${ACCENT}" stroke-width="0.5" opacity="0.4"/>
    </pattern>
    <pattern id="m-dot" width="4" height="4" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="0.45" fill="${ACCENT}" opacity="0.5"/>
    </pattern>
  </defs>
  <path d="M 80 140 C 50 140 30 132 38 118 C 60 96 130 80 250 76 L 1180 76 C 1280 78 1340 100 1360 130 C 1366 138 1366 142 1360 150 C 1340 180 1280 202 1180 204 L 250 204 C 130 200 60 184 38 162 C 30 148 50 140 80 140 Z" fill="${ACCENT}" fill-opacity="0.04" stroke="${ACCENT}" stroke-width="1.4"/>
  <path d="M 90 140 L 1330 140" stroke="${ACCENT}" stroke-width="0.5" opacity="0.45" stroke-dasharray="3 4"/>
  <path d="M 1320 110 Q 1352 130 1352 140 Q 1352 150 1320 170" fill="url(#m-dot)" stroke="${ACCENT}" stroke-width="0.7" opacity="0.85"/>
  <path d="M 90 76 L 70 36 L 130 36 L 150 76 Z" fill="url(#m-hatch)" stroke="${ACCENT}" stroke-width="1"/>
  <path d="M 90 204 L 70 244 L 130 244 L 150 204 Z" fill="url(#m-hatch)" stroke="${ACCENT}" stroke-width="1"/>
  <path d="M 60 140 L 18 122 L 18 158 Z" fill="none" stroke="${ACCENT}" stroke-width="0.9" opacity="0.85"/>
  <line x1="38" y1="140" x2="6" y2="140" stroke="${ACCENT}" stroke-width="1"/>
  <g transform="translate(0,140)">
    <ellipse cx="0" cy="0" rx="3" ry="22" fill="none" stroke="${ACCENT}" stroke-width="0.8" opacity="0.5"/>
    <path d="M 0 -22 Q -8 -10 0 0 Q 8 10 0 22 Q -8 10 0 0 Q 8 -10 0 -22 Z" fill="none" stroke="${ACCENT}" stroke-width="0.7" opacity="0.7"/>
    <circle cx="0" cy="0" r="3" fill="${ACCENT}" opacity="0.7"/>
  </g>
  <path d="M 640 76 L 660 24 L 860 24 Q 884 24 884 32 L 884 76 Z" fill="${ACCENT}" fill-opacity="0.07" stroke="${ACCENT}" stroke-width="1.2"/>
  <line x1="660" y1="24" x2="640" y2="76" stroke="${ACCENT}" stroke-width="1.6"/>
  <path d="M 720 50 L 600 46 L 600 60 L 720 60 Z" fill="none" stroke="${ACCENT}" stroke-width="0.9" opacity="0.85"/>
  <line x1="700" y1="24" x2="700" y2="-18" stroke="${ACCENT}" stroke-width="1.2"/>
  <line x1="694" y1="-18" x2="706" y2="-18" stroke="${ACCENT}" stroke-width="1.6"/>
  <line x1="708" y1="-18" x2="716" y2="-22" stroke="${ACCENT}" stroke-width="1"/>
  <line x1="740" y1="24" x2="740" y2="-8" stroke="${ACCENT}" stroke-width="0.9"/>
  <circle cx="740" cy="-10" r="3" fill="none" stroke="${ACCENT}" stroke-width="0.8"/>
  <line x1="780" y1="24" x2="780" y2="0" stroke="${ACCENT}" stroke-width="0.9"/>
  <rect x="776" y="-4" width="8" height="6" fill="none" stroke="${ACCENT}" stroke-width="0.7"/>
  <line x1="820" y1="24" x2="820" y2="-14" stroke="${ACCENT}" stroke-width="0.9"/>
  <path d="M 808 -16 Q 820 -22 832 -16" fill="none" stroke="${ACCENT}" stroke-width="0.8"/>
  <circle cx="430" cy="140" r="14" fill="none" stroke="${ACCENT}" stroke-width="0.7" opacity="0.7"/>
  <circle cx="430" cy="140" r="6" fill="${ACCENT}" fill-opacity="0.18" stroke="${ACCENT}" stroke-width="0.5"/>
  <text x="430" y="143" fill="${ACCENT}" font-size="6" font-family="monospace" text-anchor="middle" opacity="0.85">К-481</text>
  ${[120,134,148,162].map(y=>`<rect x="1240" y="${y-4}" width="76" height="8" fill="none" stroke="${ACCENT}" stroke-width="0.5" opacity="0.6"/><circle cx="1316" cy="${y}" r="3.5" fill="none" stroke="${ACCENT}" stroke-width="0.7"/><circle cx="1316" cy="${y}" r="1.2" fill="${ACCENT}" opacity="0.7"/>`).join('')}
  <line x1="0" y1="262" x2="1400" y2="262" stroke="${ACCENT}" stroke-width="0.4" opacity="0.3" stroke-dasharray="6 4"/>
  <text x="6" y="272" fill="${ACCENT}" font-size="7" font-family="monospace" opacity="0.5">WATERLINE</text>
  <g opacity="0.7">
    <line x1="772" y1="-22" x2="772" y2="-30" stroke="${ACCENT}" stroke-width="0.5"/>
    <line x1="772" y1="-30" x2="900" y2="-30" stroke="${ACCENT}" stroke-width="0.5"/>
    <text x="906" y="-27" fill="${ACCENT}" font-size="8" font-family="monospace" letter-spacing="1.5">KIOSK + MASZTY</text>
  </g>
  <g opacity="0.7">
    <line x1="430" y1="158" x2="430" y2="232" stroke="${ACCENT}" stroke-width="0.5"/>
    <line x1="430" y1="232" x2="316" y2="232" stroke="${ACCENT}" stroke-width="0.5"/>
    <text x="312" y="244" fill="${ACCENT}" font-size="8" font-family="monospace" text-anchor="end" letter-spacing="1.5">REAKTOR PWR · 190 MW</text>
  </g>
  <g opacity="0.7">
    <line x1="1280" y1="172" x2="1280" y2="232" stroke="${ACCENT}" stroke-width="0.5"/>
    <line x1="1280" y1="232" x2="1390" y2="232" stroke="${ACCENT}" stroke-width="0.5"/>
    <text x="1394" y="244" fill="${ACCENT}" font-size="8" font-family="monospace" text-anchor="end" letter-spacing="1.5">4× WYRZUTNIA 533mm</text>
  </g>
  <text x="1394" y="74" fill="${ACCENT}" font-size="9" font-family="monospace" text-anchor="end" letter-spacing="3" opacity="0.85">PR. 671RTM · К-481</text>
</svg>`;

function buildMenuHTML(saveInfo) {
  const hasSave = !!saveInfo;
  const items = [
    { key: 'new',    labelKey: 'menu_new',      code: 'F1', disabled: false    },
    { key: 'cont',   labelKey: 'menu_cont',     code: 'F2', disabled: !hasSave },
    { key: 'briefs', labelKey: 'menu_archive',  code: 'F3', disabled: true     },
    { key: 'fleet',  labelKey: 'menu_fleet',    code: 'F4', disabled: true     },
    { key: 'set',    labelKey: 'menu_settings', code: 'F5', disabled: false    },
  ];

  const itemsHTML = items.map((item, i) => `
    <button
      class="menu-item ${i === 0 ? 'active' : ''} ${item.disabled ? 'disabled' : ''}"
      data-index="${i}"
      data-key="${item.key}"
      ${item.disabled ? 'disabled' : ''}
    >
      <span class="mi-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="mi-arrow">▸</span>
      <span class="mi-label" data-i18n="${item.labelKey}">${t(item.labelKey)}</span>
      <span class="mi-code">${item.code}</span>
    </button>
  `).join('');

  return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500&display=swap');

      #menu-root {
        position: fixed;
        inset: 0;
        background: radial-gradient(ellipse at 30% 40%, #0a2530 0%, #06151b 60%, #02080b 100%);
        color: #f3ede0;
        font-family: system-ui, sans-serif;
        overflow: hidden;
        z-index: 9999;
      }
      #menu-root canvas { display: block; }

      #menu-vignette {
        position: absolute;
        inset: 0;
        background: radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.7) 100%);
        pointer-events: none;
      }
      #menu-scanlines {
        position: absolute;
        inset: 0;
        background-image: repeating-linear-gradient(0deg,
          rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px,
          transparent 1px, transparent 3px
        );
        pointer-events: none;
        mix-blend-mode: multiply;
      }
      #menu-top {
        position: absolute;
        top: 0; left: 0; right: 0;
        padding: 20px 40px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-family: monospace;
        font-size: 11px;
        letter-spacing: 2px;
        color: rgba(243,237,224,0.65);
        border-bottom: 1px solid rgba(243,237,224,0.08);
        z-index: 10;
      }
      #menu-top-left { display: flex; align-items: center; gap: 18px; }
      #menu-pulse {
        width: 14px; height: 14px; border-radius: 50%;
        background: ${ACCENT};
        box-shadow: 0 0 10px ${ACCENT};
        animation: menu-pulse 1.6s ease-in-out infinite;
        flex-shrink: 0;
      }
      #menu-top-right { display: flex; gap: 28px; }
      #menu-top-right .online { color: ${ACCENT}; }
      #menu-center {
        position: absolute;
        inset: 80px 60px 120px 60px;
        display: grid;
        grid-template-columns: 1.55fr 1fr;
        gap: 48px;
        align-items: center;
        z-index: 10;
      }
      #menu-left-col { display: flex; flex-direction: column; justify-content: center; gap: 60px; }
      #menu-sub { height: 200px; margin-top: -20px; }
      #menu-title-eyebrow {
        font-size: 11px; letter-spacing: 14px; opacity: 0.55; margin-bottom: 18px; font-family: monospace;
      }
      #menu-title-main { margin: 0; font-family: 'Bebas Neue', 'Oswald', 'Arial Narrow', sans-serif; font-size: clamp(96px,11vw,138px); line-height: 0.86; letter-spacing: 2px; font-weight: 400; color: #f3ede0; white-space: nowrap; }
      #menu-title-sub  { margin: 0; margin-top: -8px; font-family: 'Bebas Neue', 'Oswald', 'Arial Narrow', sans-serif; font-size: clamp(96px,11vw,138px); line-height: 0.86; letter-spacing: 2px; font-weight: 400; color: ${ACCENT}; white-space: nowrap; }
      #menu-title-ru   { margin-top: 14px; font-size: 13px; letter-spacing: 8px; color: #f3ede0; opacity: 0.55; font-family: monospace; }
      #menu-title-desc { margin-top: 10px; font-size: 11px; letter-spacing: 5px; opacity: 0.55; font-family: monospace; }

      #menu-panel {
        background: rgba(6,21,27,0.55);
        backdrop-filter: blur(2px);
        border: 1px solid rgba(243,237,224,0.1);
        padding: 28px;
        position: relative;
      }
      .menu-corner { position: absolute; width: 18px; height: 18px; }
      .menu-corner.tl { top:-1px; left:-1px; border-top: 2px solid ${ACCENT}; border-left: 2px solid ${ACCENT}; }
      .menu-corner.tr { top:-1px; right:-1px; border-top: 2px solid ${ACCENT}; border-right: 2px solid ${ACCENT}; }
      .menu-corner.bl { bottom:-1px; left:-1px; border-bottom: 2px solid ${ACCENT}; border-left: 2px solid ${ACCENT}; }
      .menu-corner.br { bottom:-1px; right:-1px; border-bottom: 2px solid ${ACCENT}; border-right: 2px solid ${ACCENT}; }

      #menu-panel-header {
        display: flex; justify-content: space-between; align-items: baseline;
        margin-bottom: 22px; padding-bottom: 14px;
        border-bottom: 1px solid rgba(243,237,224,0.1);
        font-family: monospace;
      }
      #menu-panel-title  { font-size: 11px; letter-spacing: 3px; opacity: 0.7; }
      #menu-panel-hint   { font-size: 10px; letter-spacing: 2px; color: ${ACCENT}; opacity: 0.8; }

      .menu-item {
        all: unset;
        cursor: pointer;
        display: grid;
        grid-template-columns: 32px 28px 1fr auto;
        align-items: center;
        gap: 14px;
        padding: 14px 18px 14px 14px;
        border-left: 2px solid rgba(243,237,224,0.12);
        background: transparent;
        opacity: 1;
        transition: background 120ms, border-color 120ms;
        width: 100%;
        box-sizing: border-box;
      }
      .menu-item.active {
        border-left-color: ${ACCENT};
        background: linear-gradient(90deg, ${ACCENT}22 0%, transparent 80%);
      }
      .menu-item.disabled { opacity: 0.35; cursor: not-allowed; }
      .mi-num   { font-family: monospace; font-size: 11px; opacity: 0.5; letter-spacing: 1px; }
      .mi-arrow { font-family: monospace; font-size: 14px; color: transparent; transition: color 120ms; }
      .menu-item.active .mi-arrow { color: ${ACCENT}; }
      .mi-label { font-family: 'Bebas Neue','Oswald','Arial Narrow',sans-serif; font-size: 26px; letter-spacing: 3px; color: rgba(243,237,224,0.78); white-space: nowrap; transition: color 120ms; }
      .menu-item.active .mi-label { color: #f3ede0; }
      .mi-code  { font-family: monospace; font-size: 10px; letter-spacing: 2px; opacity: 0.3; color: #f3ede0; transition: color 120ms, opacity 120ms; }
      .menu-item.active .mi-code  { color: ${ACCENT}; opacity: 0.7; }

      #menu-briefing {
        margin-top: 24px; padding-top: 18px;
        border-top: 1px solid rgba(243,237,224,0.1);
        font-family: monospace; font-size: 11px; line-height: 1.6; opacity: 0.6;
      }
      #menu-briefing-hdr { color: ${ACCENT}; margin-bottom: 6px; letter-spacing: 2px; }

      #menu-bottom {
        position: absolute; bottom: 0; left: 0; right: 0;
        padding: 20px 40px;
        display: flex; justify-content: space-between; align-items: center;
        border-top: 1px solid rgba(243,237,224,0.08);
        background: rgba(2,8,11,0.4);
        z-index: 10;
      }
      #menu-telemetry { display: flex; gap: 36px; color: ${ACCENT}; font-family: monospace; }
      .telem-item { display: flex; flex-direction: column; gap: 2px; min-width: 110px; }
      .telem-label { font-size: 10px; letter-spacing: 2px; opacity: 0.55; }
      .telem-value { font-size: 18px; font-family: 'JetBrains Mono',monospace; font-weight: 500; color: ${ACCENT}; font-variant-numeric: tabular-nums; }
      .telem-unit  { font-size: 11px; opacity: 0.6; margin-left: 3px; }
      #menu-version { display: flex; gap: 20px; font-family: monospace; font-size: 10px; letter-spacing: 2px; opacity: 0.5; }
      #menu-version .v-accent { color: ${ACCENT}; }

      /* ── Settings panel ── */
      #menu-settings {
        padding-top: 6px;
        max-height: calc(100vh - 290px);
        overflow-y: auto;
        padding-right: 8px;
        scrollbar-width: thin;
        scrollbar-color: ${ACCENT}44 transparent;
      }
      #menu-settings::-webkit-scrollbar { width: 3px; }
      #menu-settings::-webkit-scrollbar-track { background: transparent; }
      #menu-settings::-webkit-scrollbar-thumb { background: ${ACCENT}66; border-radius: 2px; }
      .ms-hdr {
        font-family: monospace; font-size: 11px; letter-spacing: 2px;
        color: ${ACCENT}; margin-bottom: 16px;
      }
      .ms-row { margin-bottom: 12px; }
      .ms-row-lbl {
        font-family: monospace; font-size: 9px; letter-spacing: 2.5px;
        opacity: 0.45; margin-bottom: 5px;
      }
      .ms-opts { display: flex; gap: 7px; flex-wrap: wrap; }
      .ms-opt {
        all: unset; cursor: pointer;
        font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.5px;
        padding: 5px 13px;
        border: 1px solid rgba(243,237,224,0.14);
        color: rgba(243,237,224,0.38);
        transition: all 110ms;
      }
      .ms-opt:hover  { border-color: rgba(243,237,224,0.38); color: rgba(243,237,224,0.82); }
      .ms-opt.on     { border-color: ${ACCENT}; color: ${ACCENT}; background: ${ACCENT}22; }
      .ms-sep {
        border: none; border-top: 1px solid rgba(243,237,224,0.08);
        margin: 10px 0;
      }
      .ms-foot {
        display: flex; align-items: center; gap: 18px;
        margin-top: 14px;
      }
      .ms-save-note {
        font-family: monospace; font-size: 9px; letter-spacing: 2px;
        opacity: 0.32;
      }
      .ms-back-btn {
        all: unset; cursor: pointer;
        font-family: monospace; font-size: 9px; letter-spacing: 2px;
        color: rgba(243,237,224,0.55);
        border: 1px solid rgba(243,237,224,0.20);
        padding: 5px 14px;
        transition: color 110ms, border-color 110ms;
      }
      .ms-back-btn:hover { color: ${ACCENT}; border-color: ${ACCENT}; }
      .ms-section-hdr {
        font-family: monospace; font-size: 9px; letter-spacing: 3px;
        color: ${ACCENT}; opacity: 0.65;
        margin-bottom: 14px; margin-top: 6px;
      }
      .ms-section-gap {
        height: 4px; border-top: 1px solid ${ACCENT}22;
        margin-bottom: 12px;
      }

      @keyframes menu-pulse {
        0%,100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.9); }
      }
      @keyframes menu-fade-out {
        from { opacity: 1; }
        to   { opacity: 0; }
      }
    </style>

    <canvas id="menu-sonar-canvas"></canvas>
    <div id="menu-vignette"></div>
    <div id="menu-scanlines"></div>

    <div id="menu-top">
      <div id="menu-top-left">
        <div id="menu-pulse"></div>
        <span>К-481  //  ПОКОИ КОМАНДИРА</span>
      </div>
      <div id="menu-top-right">
        <span id="menu-clock">UTC --:--:--</span>
        <span>POZ. 70°N 18°E · NW-7</span>
        <span class="online">● CISZA RADIOWA</span>
      </div>
    </div>

    <div id="menu-center">
      <div id="menu-left-col">
        <div>
          <div id="menu-title-eyebrow">★  LISTOPAD 1983  ·  MORZE NORWESKIE  ★</div>
          <h1 id="menu-title-main">CZERWONY</h1>
          <h1 id="menu-title-sub">PAŹDZIERNIK</h1>
          <div id="menu-title-ru">КРАСНЫЙ  ОКТЯБРЬ</div>
          <div id="menu-title-desc">SYMULATOR OKRĘTU PODWODNEGO  ·  К-481  ·  OBIEKT K-7</div>
        </div>
        <div id="menu-sub">${SUB_SVG}</div>
      </div>

      <div id="menu-panel">
        <div class="menu-corner tl"></div>
        <div class="menu-corner tr"></div>
        <div class="menu-corner bl"></div>
        <div class="menu-corner br"></div>
        <div id="menu-panel-header">
          <div id="menu-panel-title" data-i18n="menu_main_title">${t('menu_main_title')}</div>
          <div id="menu-panel-hint" data-i18n="menu_nav_hint">${t('menu_nav_hint')}</div>
        </div>
        <div id="menu-list">${itemsHTML}</div>
        <div id="menu-briefing">
          <div id="menu-briefing-hdr">// BRIEFING</div>
          <div id="menu-briefing-body">
            ${hasSave ? `
              Ostatni patrol: <span style="color:#f3ede0">${saveInfo.date}</span><br>
              Głębokość operacyjna: <span style="color:#f3ede0">${saveInfo.wave ? saveInfo.wave * 40 + 180 : 220} m</span><br>
              Integralność kadłuba: <span style="color:${saveInfo.hull < 40 ? '#ff7070' : saveInfo.hull < 70 ? '#ffdd44' : '#f3ede0'}">${saveInfo.hull}%</span><br>
              Status misji: <span style="color:${ACCENT}">AKTYWNA · ABLE ARCHER</span>
            ` : `
              DEPESZA GRU — 03:47 UTC<br>
              Kontakt ALFA: <span style="color:#f3ede0">USS DALLAS · kl. LA</span><br>
              ABLE ARCHER 83: <span style="color:${ACCENT}">STAN GOTOWOŚCI</span><br>
              <span style="opacity:0.55;font-size:10px">Towarzyszu Komandorze — czekamy na twój rozkaz.</span>
            `}
          </div>
        </div>
      </div>
    </div>

    <div id="menu-bottom">
      <div id="menu-telemetry">
        <div class="telem-item">
          <span class="telem-label">GŁĘBOKOŚĆ</span>
          <span class="telem-value" id="telem-depth">243<span class="telem-unit">m</span></span>
        </div>
        <div class="telem-item">
          <span class="telem-label">PRĘDKOŚĆ</span>
          <span class="telem-value" id="telem-speed">6.0<span class="telem-unit">kn</span></span>
        </div>
        <div class="telem-item">
          <span class="telem-label">NAMIAR</span>
          <span class="telem-value" id="telem-heading">127<span class="telem-unit">°</span></span>
        </div>
        <div class="telem-item">
          <span class="telem-label">REAKTOR</span>
          <span class="telem-value" id="telem-reactor">71<span class="telem-unit">%</span></span>
        </div>
      </div>
      <div id="menu-version">
        <span>v0.11.1-alpha</span>
        <span>BUILD 19831101</span>
        <span class="v-accent">ŚCIŚLE TAJNE</span>
      </div>
    </div>
  `;
}

export class Menu {
  constructor() {
    this._el = null;
    this._raf = null;
    this._clockInterval = null;
    this._telemInterval = null;
    this._selected = 0;
    this._items = null;
    this._resolve = null;
    this._onKey = this._handleKey.bind(this);
    this._sweepAngle = 0;
    this._startTime = 0;
    this._telem = { depth: 243, speed: 6, heading: 127, reactor: 71 };
    this._inSettings = false;

    this._settingsDefs = [
      // ── ROZGRYWKA ─────────────────────────────────────────
      {
        section: 'set_sec_gameplay',
        key: 'difficulty', labelKey: 'set_difficulty',
        options: [
          { v: { key:'easy',   label:'ŁATWY',    enemies:1, speedMult:0.75 }, labelKey:'opt_easy'   },
          { v: { key:'normal', label:'NORMALNY', enemies:2, speedMult:1.00 }, labelKey:'opt_normal' },
          { v: { key:'hard',   label:'TRUDNY',   enemies:3, speedMult:1.30 }, labelKey:'opt_hard'   },
        ],
        idx: 1,
      },
      {
        key: 'merchants', labelKey: 'set_convoy',
        options: [
          { v: 2, labelKey: 'opt_ships_2' },
          { v: 4, labelKey: 'opt_ships_4' },
          { v: 6, labelKey: 'opt_ships_6' },
        ],
        idx: 1,
      },
      {
        key: 'infiniteAmmo', labelKey: 'set_ammo',
        options: [
          { v: false, labelKey: 'opt_ammo_std' },
          { v: true,  labelKey: 'opt_ammo_inf' },
        ],
        idx: 0,
      },
      {
        key: 'enemyDelay', labelKey: 'set_delay',
        options: [
          { v: 15,  labelKey: 'opt_15s'  },
          { v: 60,  labelKey: 'opt_1min' },
          { v: 300, labelKey: 'opt_5min' },
        ],
        idx: 0,
      },
      // ── GRAFIKA ───────────────────────────────────────────
      {
        section: 'set_sec_graphics',
        key: 'particles', labelKey: 'set_particles',
        options: [
          { v: 0.35, labelKey: 'opt_low'    },
          { v: 1.00, labelKey: 'opt_medium' },
          { v: 1.70, labelKey: 'opt_high'   },
        ],
        idx: 1,
      },
      {
        key: 'cameraShake', labelKey: 'set_camshake',
        options: [
          { v: true,  labelKey: 'opt_on'  },
          { v: false, labelKey: 'opt_off' },
        ],
        idx: 0,
      },
      {
        key: 'scanlines', labelKey: 'set_scanlines',
        options: [
          { v: true,  labelKey: 'opt_on'  },
          { v: false, labelKey: 'opt_off' },
        ],
        idx: 0,
      },
      // ── JĘZYK ─────────────────────────────────────────────
      {
        section: 'set_sec_lang',
        key: 'language', labelKey: 'set_language',
        options: [
          { v: 'PL', labelKey: 'opt_lang_pl' },
          { v: 'EN', labelKey: 'opt_lang_en' },
        ],
        idx: 0,
      },
    ];
  }

  _buildSettingsHTML() {
    let rowsHTML = '';
    let lastSection = null;
    this._settingsDefs.forEach((def, i) => {
      if (def.section && def.section !== lastSection) {
        if (lastSection !== null) rowsHTML += '<div class="ms-section-gap"></div>';
        rowsHTML += `<div class="ms-section-hdr" data-i18n="${def.section}">${t(def.section)}</div>`;
        lastSection = def.section;
      } else if (i > 0) {
        rowsHTML += '<hr class="ms-sep">';
      }
      const optsHTML = def.options.map((opt, oi) =>
        `<button class="ms-opt ${oi === def.idx ? 'on' : ''}" data-key="${def.key}" data-idx="${oi}" data-i18n="${opt.labelKey}">${t(opt.labelKey)}</button>`
      ).join('');
      rowsHTML += `<div class="ms-row">
        <div class="ms-row-lbl" data-i18n="${def.labelKey}">${t(def.labelKey)}</div>
        <div class="ms-opts">${optsHTML}</div>
      </div>`;
    });

    return `<div id="menu-settings">
      <div class="ms-hdr" data-i18n="menu_set_hdr">${t('menu_set_hdr')}</div>
      ${rowsHTML}
      <div class="ms-foot">
        <span class="ms-save-note" data-i18n="menu_set_save">${t('menu_set_save')}</span>
      </div>
    </div>`;
  }

  _getSettings() {
    const out = {};
    for (const def of this._settingsDefs) {
      out[def.key] = def.options[def.idx].v;
    }
    return out;
  }

  _applyLanguage() {
    const cfg = this._getSettings();
    setLang(cfg.language ?? 'PL');
    applyI18n();
  }

  _applyGraphicsSettings() {
    const cfg = this._getSettings();
    const scanlinesEl = this._el?.querySelector('#menu-scanlines');
    if (scanlinesEl) scanlinesEl.style.display = cfg.scanlines ? '' : 'none';
    document.body.classList.toggle('no-crt', !cfg.scanlines);
  }

  _showSettings() {
    if (!this._el) return;
    const titleEl = this._el.querySelector('#menu-panel-title');
    const hintEl  = this._el.querySelector('#menu-panel-hint');
    const listEl  = this._el.querySelector('#menu-list');
    const briefEl = this._el.querySelector('#menu-briefing');
    const panelEl = this._el.querySelector('#menu-panel');

    titleEl.textContent  = t('menu_set_title');
    titleEl.dataset.i18n = 'menu_set_title';
    hintEl.innerHTML     = `<button class="ms-back-btn" data-i18n="menu_set_back">${t('menu_set_back')}</button><span style="opacity:0.55" data-i18n="menu_set_hint"> · ${t('menu_set_hint')}</span>`;
    hintEl.removeAttribute('data-i18n');
    listEl.style.display  = 'none';
    briefEl.style.display = 'none';

    const settingsEl = document.createElement('div');
    settingsEl.innerHTML = this._buildSettingsHTML();
    panelEl.appendChild(settingsEl.firstElementChild);

    // Klik na opcję
    panelEl.querySelectorAll('.ms-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const idx = parseInt(btn.dataset.idx);
        const def = this._settingsDefs.find(d => d.key === key);
        if (!def) return;
        def.idx = idx;
        // Odśwież przyciski tej grupy
        panelEl.querySelectorAll(`.ms-opt[data-key="${key}"]`).forEach((b, i) => {
          b.classList.toggle('on', i === idx);
        });
        window._gameSettings = this._getSettings();
        this._applyGraphicsSettings();
        if (def.key === 'language') this._applyLanguage();
      });
    });

    hintEl.querySelector('.ms-back-btn')?.addEventListener('click', () => this._hideSettings());

    this._inSettings = true;
    window._gameSettings = this._getSettings();
    this._applyGraphicsSettings();
  }

  _hideSettings() {
    if (!this._el) return;
    const titleEl = this._el.querySelector('#menu-panel-title');
    const hintEl  = this._el.querySelector('#menu-panel-hint');
    const listEl  = this._el.querySelector('#menu-list');
    const briefEl = this._el.querySelector('#menu-briefing');
    const panelEl = this._el.querySelector('#menu-panel');

    titleEl.textContent  = t('menu_main_title');
    titleEl.dataset.i18n = 'menu_main_title';
    hintEl.textContent   = t('menu_nav_hint');
    hintEl.dataset.i18n  = 'menu_nav_hint';
    listEl.style.display  = '';
    briefEl.style.display = '';
    panelEl.querySelector('#menu-settings')?.remove();
    this._inSettings = false;
  }

  show() {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._mount();
    });
  }

  hide() {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    if (this._clockInterval) { clearInterval(this._clockInterval); this._clockInterval = null; }
    if (this._telemInterval) { clearInterval(this._telemInterval); this._telemInterval = null; }
    window.removeEventListener('keydown', this._onKey);
    if (this._el) {
      this._el.style.animation = 'menu-fade-out 0.4s ease forwards';
      setTimeout(() => { this._el?.remove(); this._el = null; }, 420);
    }
  }

  _mount() {
    const saveInfo = SaveSystem.getSaveInfo();
    const el = document.createElement('div');
    el.id = 'menu-root';
    el.innerHTML = buildMenuHTML(saveInfo);
    document.body.appendChild(el);
    this._el = el;

    this._items = Array.from(el.querySelectorAll('.menu-item'));
    this._setSelected(0);

    this._items.forEach((btn, i) => {
      if (!btn.disabled) {
        btn.addEventListener('mouseenter', () => this._setSelected(i));
        btn.addEventListener('click', () => this._activate(i));
      }
    });

    window.addEventListener('keydown', this._onKey);
    this._startClock();
    this._startTelemetry();
    this._startSonar();
  }

  _setSelected(i) {
    if (i < 0 || i >= this._items.length) return;
    this._items[this._selected]?.classList.remove('active');
    this._selected = i;
    this._items[this._selected]?.classList.add('active');
  }

  _activate(i) {
    const key = this._items[i]?.dataset.key;
    if (key === 'new') {
      window._gameSettings = window._gameSettings || this._getSettings();
      SaveSystem.clear();
      this.hide();
      this._resolve?.({ fromSave: false });
    } else if (key === 'cont') {
      window._gameSettings = window._gameSettings || this._getSettings();
      this.hide();
      this._resolve?.({ fromSave: true });
    } else if (key === 'set') {
      this._showSettings();
    }
  }

  _handleKey(e) {
    if (this._inSettings) {
      if (e.key === 'Escape') { e.preventDefault(); this._hideSettings(); }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      let next = this._selected;
      do { next = (next + 1) % this._items.length; }
      while (this._items[next]?.disabled && next !== this._selected);
      this._setSelected(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      let prev = this._selected;
      do { prev = (prev - 1 + this._items.length) % this._items.length; }
      while (this._items[prev]?.disabled && prev !== this._selected);
      this._setSelected(prev);
    } else if (e.key === 'Escape' && this._inSettings) {
      e.preventDefault();
      this._hideSettings();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this._activate(this._selected);
    } else if (e.key === 'F1') {
      e.preventDefault();
      this._setSelected(0); this._activate(0);
    } else if (e.key === 'F2' && !this._items[1]?.disabled) {
      e.preventDefault();
      this._setSelected(1); this._activate(1);
    } else if (e.key === 'F5') {
      e.preventDefault();
      this._setSelected(4); this._showSettings();
    }
  }

  _startClock() {
    const el = this._el?.querySelector('#menu-clock');
    if (!el) return;
    const update = () => {
      el.textContent = 'UTC ' + new Date().toISOString().slice(11, 19);
    };
    update();
    this._clockInterval = setInterval(update, 1000);
  }

  _startTelemetry() {
    const depthEl   = this._el?.querySelector('#telem-depth');
    const speedEl   = this._el?.querySelector('#telem-speed');
    const headingEl = this._el?.querySelector('#telem-heading');
    const reactorEl = this._el?.querySelector('#telem-reactor');

    const update = () => {
      this._telem.depth   = Math.max(120, Math.min(280, this._telem.depth   + (Math.random() - 0.5) * 6));
      this._telem.speed   = Math.max(2,   Math.min(18,  this._telem.speed   + (Math.random() - 0.5) * 0.8));
      this._telem.heading = (this._telem.heading + (Math.random() - 0.5) * 4 + 360) % 360;
      this._telem.reactor = Math.max(40, Math.min(95,  this._telem.reactor  + (Math.random() - 0.5) * 2));

      if (depthEl)   depthEl.innerHTML   = `${Math.round(this._telem.depth)}<span class="telem-unit">m</span>`;
      if (speedEl)   speedEl.innerHTML   = `${this._telem.speed.toFixed(1)}<span class="telem-unit">kn</span>`;
      if (headingEl) headingEl.innerHTML = `${String(Math.round(this._telem.heading)).padStart(3,'0')}<span class="telem-unit">°</span>`;
      if (reactorEl) reactorEl.innerHTML = `${Math.round(this._telem.reactor)}<span class="telem-unit">%</span>`;
    };
    this._telemInterval = setInterval(update, 600);
  }

  _startSonar() {
    const canvas = this._el?.querySelector('#menu-sonar-canvas');
    if (!canvas) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      canvas.style.cssText = `position:absolute;inset:0;width:100%;height:100%;opacity:0.55`;
    };
    resize();

    const ctx = canvas.getContext('2d');
    this._startTime = performance.now();

    const PING_SPEED = 3000; // ms per rotation
    const cx = () => canvas.width  / 2;
    const cy = () => canvas.height / 2;
    const R  = () => Math.min(canvas.width, canvas.height) * 0.38;

    const draw = (now) => {
      if (!this._el) return;
      const t = ((now - this._startTime) % PING_SPEED) / PING_SPEED;
      const sweepRad = t * Math.PI * 2;
      const r = R();
      const x = cx(), y = cy();

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Concentric rings
      ctx.strokeStyle = ACCENT;
      ctx.globalAlpha = 0.22;
      for (const frac of [0.2, 0.4, 0.6, 0.8, 1.0]) {
        ctx.beginPath();
        ctx.arc(x, y, r * frac, 0, Math.PI * 2);
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Crosshairs
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();

      // Diagonal lines
      ctx.globalAlpha = 0.15;
      ctx.beginPath(); ctx.moveTo(x - r*0.7, y - r*0.7); ctx.lineTo(x + r*0.7, y + r*0.7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - r*0.7, y + r*0.7); ctx.lineTo(x + r*0.7, y - r*0.7); ctx.stroke();

      // Bearing ticks
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 36; i++) {
        const a = i * 10 * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.96, y + Math.sin(a) * r * 0.96);
        ctx.lineTo(x + Math.cos(a) * r,         y + Math.sin(a) * r);
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }

      // Expanding ping rings
      for (let k = 0; k < 3; k++) {
        const tK = (t + k / 3) % 1;
        const rK = tK * r;
        if (rK <= 0) continue;
        const alpha = (1 - tK) * (k === 0 ? 0.7 : k === 1 ? 0.45 : 0.25);
        ctx.globalAlpha = alpha;
        ctx.lineWidth = k === 0 ? 1.2 : 0.8;
        ctx.beginPath();
        ctx.arc(x, y, rK, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Sweep arm + trailing glow
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(sweepRad);

      // Circular clip
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.clip();
      // Trailing sector (~100°)
      const trailAngle = Math.PI * 100 / 180;
      const radGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      radGrad.addColorStop(0,   'rgba(232,65,58,0.0)');
      radGrad.addColorStop(0.7, 'rgba(232,65,58,0.04)');
      radGrad.addColorStop(1,   'rgba(232,65,58,0.16)');
      ctx.fillStyle = radGrad;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, -trailAngle, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Arm line
      const armGrad = ctx.createLinearGradient(0, 0, r, 0);
      armGrad.addColorStop(0,   'rgba(232,65,58,0.0)');
      armGrad.addColorStop(1,   'rgba(232,65,58,0.65)');
      ctx.strokeStyle = armGrad;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(r, 0);
      ctx.stroke();
      ctx.restore();

      // Stray contacts
      const contacts = [
        { fx: -0.44, fy: -0.28, phase: 0 },
        { fx:  0.62, fy:  0.16, phase: 1 },
        { fx:  0.12, fy:  0.56, phase: 2 },
      ];
      for (const c of contacts) {
        ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(now / 1000 * 6 + c.phase));
        ctx.fillStyle = ACCENT;
        ctx.beginPath();
        ctx.arc(x + c.fx * r, y + c.fy * r, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      this._raf = requestAnimationFrame(draw);
    };

    this._raf = requestAnimationFrame(draw);
  }
}
