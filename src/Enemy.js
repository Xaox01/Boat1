import Phaser from 'phaser';
import { ASROC, HomingTorpedo } from './EnemyASROC.js';

export const STATE = { PATROL: 0, ALERT: 1, HUNT: 2, SEARCH: 3, WITHDRAW: 4 };

// Prędkości — celowo powolne, taktyczne
const PATROL_SPEED    = 22;
const ALERT_SPEED     = 38;
const HUNT_SPEED      = 58;
const HUNT_OVERSHOOT  = 180;
const WITHDRAW_SPEED  = 44;   // Wycofywanie — szybciej niż patrol, wolniej niż atak

// Zachowanie po trafieniu
const SHOCK_BASE      = 4.5;  // dłuższa dezorientacja — reward za celność

// Wykrywanie — zbalansowane: wykrycie jest realne, ale gracz ma czas zareagować
const BASE_HYDROPHONE  = 480;   // wyważony zasięg hydrofonu
const THERMO_MASK      = 0.50;
const ALERT_THRESHOLD  = 2.2;   // potrzeba 2.2s w zasięgu — gracz zdąży się schować
const HUNT_THRESHOLD   = 7.0;   // 7s ciągłego kontaktu do pełnego ataku
const SEARCH_DURATION  = 50;    // szuka 50s po utracie — daje szansę na ucieczkę

// Zarzuty głębinowe
const CHARGE_COOLDOWN  = 13.0;  // co 13s — wystarczająco groźne, ale gracz zdąży się poruszyć
const CHARGE_FALL_SPD  = 80;
const CHARGE_BLAST_R   = 90;    // rozsądny promień wybuchu

// ASROC
const ASROC_COOLDOWN   = 70;    // co 70s — poważne zagrożenie, ale nie ciągłe
const ASROC_MIN_DIST   = 400;
const ASROC_MAX_DIST   = 3400;

// Aktywny sonar
const PING_SPEED        = 195;
const PING_BOOST        = 3.5;
const PING_BOOST_THERMO = 0.8;

// Ulepszenia AI v2
const HUNT_DECAY_THERMO = 0.55;   // szybsza utrata kontaktu gdy gracz pod termoklinem
const HUNT_DECAY_BASE   = 0.35;   // normalna utrata w HUNT (było 0.25) — nagradza ciszę
const DR_VX_WEIGHT      = 0.60;   // współczynnik dead-reckoning (predykcja ruchu łodzi)
const REINFORCE_DELAY   = 18;     // sekundy HUNT bez likwidacji → wezwanie posiłków

export class Enemy {
  constructor(scene, x, patrolLeft, patrolRight, label) {
    this.scene = scene;
    this.gfx   = scene.add.graphics().setDepth(3);

    this.x = x;
    this.y = scene.SURFACE_Y;
    this.label = label || '';

    this.patrolLeft  = patrolLeft;
    this.patrolRight = patrolRight;
    this.patrolSpeed = PATROL_SPEED + Math.random() * 12;
    this.dir         = Math.random() < 0.5 ? 1 : -1;

    this.state          = STATE.PATROL;
    this.detectTimer    = 0;
    this.searchTimer    = 0;
    this.detectionLevel = 0;

    this.lastBearingToSub = 0;
    this.lastKnownSubX    = x;
    this.lastKnownSubY    = scene.SURFACE_Y + 100;

    this.overshootX = null;

    // Zarzuty głębinowe
    this.charges  = [];
    this.chargeCD = 0;

    // ASROC
    this.asrocs         = [];
    this.homingTorpedoes = [];
    this.asrocCD        = ASROC_COOLDOWN * (0.6 + Math.random() * 0.6);  // różny rozruch

    this.hull      = 1.0;
    this.destroyed = false;

    // Klasyfikacja pasywna — gracz musi nazbierać czasu nasłuchu
    this.tonal        = 18 + Math.random() * 17;   // 18–35 Hz — szybki wał napędowy okrętu wojennego
    this.shipType     = 'WARSHIP';                 // Ostateczna klasa po pełnej klasyfikacji
    this.contactClass = 'UNK';                     // UNK → SURFACE → WARSHIP
    this.classifyTimer = 0;                        // Akumuluje sekundy ekspozycji sonarem

    // Aktywny sonar
    this.pingTimer   = 4 + Math.random() * 8;
    this.activePings = [];

    // "Sprint and listen"
    this._sprintListenTimer = 0;
    this._listening         = false;

    // Widoczność — pokazywany tylko po trafieniu echem aktywnego sonaru
    this.revealTimer = 0;

    // Ucieczka przed torpedą + środki zaradcze
    this.torpedoEvadeTimer = 0;
    this._evadeDir         = 0;
    this._counterMeasures  = [];   // wizualne chmury bąbelków/dymu

    // Zachowanie po trafieniu
    this._damageShockTimer = 0;  // chwilowe spowolnienie / dezorientacja
    this._withdrawing      = false;  // gdy true → STATE.WITHDRAW nadpisuje inne
    this._oilDrops         = [];    // ślad olejowy na wodzie (pomaga namierzać)

    this.recentExplosions = [];
    this.recentPingHit    = false;
    this.recentASROC      = false;

    // Animacja tonięcia
    this._sinking      = false;
    this._sinkTimer    = 0;
    this._sinkDur      = 14.0;    // 14 sekund od wybuchu do wraku na dnie
    this._sinkSide     = 1;
    this._sinkAngle    = 0;       // akumulowany kąt obrotu [rad]
    this._shipSinkY    = 0;       // bieżąca pozycja Y okrętu
    this._sinkParticles = [];     // bąble + szczątki

    // AI v2 — dead reckoning + koordynacja
    this._contactAge      = 0;      // sekundy od ostatniego świeżego kontaktu sonarowego
    this._lastKnownVX     = 0;      // prędkość x łodzi w momencie ostatniego kontaktu
    this._huntDuration    = 0;      // ile czasu (s) ciągłego HUNT — do wezwania posiłków
    this.needsReinforcement = false; // flaga — GameScene odczytuje i spawna posiłki
    this._flankApproach   = false;  // czy obchodzić z flanki (koordinacja)
  }

  // Inicjuje animację tonięcia — niszczyciel tonie przez ~7.5s zanim destroyed=true
  startSinking() {
    if (this._sinking || this.destroyed) return;
    this._sinking           = true;
    this._sinkTimer         = this._sinkDur;
    this._sinkSide          = Math.random() < 0.5 ? 1 : -1;
    this._sinkAngle         = 0;
    this._shipSinkY         = this.scene.SURFACE_Y;
    this._sinkParticles     = [];
    this.revealTimer        = this._sinkDur + 3;
    this.needsReinforcement  = false;
    this._withdrawing        = true;
    this.state               = STATE.WITHDRAW;
  }

  // Wywoływane z GameScene gdy torpeda lub rakieta trafi
  onHit() {
    // Szok po trafieniu — spowolnienie i chwilowa dezorientacja systemu
    this._damageShockTimer = SHOCK_BASE + (1 - this.hull) * 6;

    // Zgubienie namierzenia (szok zakłóca hydrofonię i radar)
    this.detectTimer = Math.max(0, this.detectTimer - 2.2);

    // Po poważnym trafieniu — przejdź w tryb wycofywania (dopiero przy małym kadłubie)
    if (this.hull < 0.35 && !this._withdrawing) {
      this._withdrawing = true;
      // Zapamiętaj kierunek ucieczki (od okrętu gracza)
      this._withdrawDir = Math.sign(this.x - this.lastKnownSubX) || this.dir;
    }
  }

  update(dt, sub) {
    this.recentExplosions = [];
    this.recentPingHit    = false;
    this.recentASROC      = false;
    if (this._sinking) { this._updateSinking(dt); return; }
    if (this.destroyed) return;

    this.revealTimer      = Math.max(0, this.revealTimer - dt);
    this.torpedoEvadeTimer = Math.max(0, this.torpedoEvadeTimer - dt);

    // Starzenie środków zaradczych
    for (const cm of this._counterMeasures) cm.age += dt;
    this._counterMeasures = this._counterMeasures.filter(cm => cm.age < 3.5);

    this._updateActiveSonar(dt, sub);
    this._updateDetection(dt, sub);
    this._updateMovement(dt);
    this._updateCharges(dt, sub);
    this._updateASROC(dt, sub);
    this._draw();
  }

  // Wywoływane z GameScene gdy torpeda jest blisko — kontrmanewry
  evadeTorpedo(torpX) {
    if (this.torpedoEvadeTimer > 4) return;
    this._evadeDir = Math.sign(this.x - torpX) || 1;

    // Zdrowy okręt — krótki manewr (3s), uszkodzony — pełna panika (7s)
    this.torpedoEvadeTimer = this.hull < 0.5 ? 7 : 3;

    const SURF = this.scene.SURFACE_Y;
    const count = this.hull < 0.5 ? 7 : 3;
    for (let i = 0; i < count; i++) {
      this._counterMeasures.push({
        x: this.x + Phaser.Math.Between(-25, 25),
        y: SURF + Phaser.Math.Between(2, 8),
        r: 4 + Math.random() * 5,
        age: 0,
      });
    }
  }

  // Ping aktywny gracza — okręt słyszy sygnał i namierza kierunek
  receivePing(subX, subY) {
    this.lastKnownSubX    = subX;
    this.lastKnownSubY    = subY;
    this.lastBearingToSub = Math.atan2(subY - this.y, subX - this.x);
    if (this.state === STATE.PATROL) {
      this.detectTimer = Math.max(this.detectTimer, ALERT_THRESHOLD + 0.4);
    } else if (this.state === STATE.ALERT || this.state === STATE.SEARCH) {
      // Już namierzony — ping potwierdza kierunek, przyspiesza atak
      this.detectTimer = Math.max(this.detectTimer, HUNT_THRESHOLD - 0.8);
    }
  }

  // Koordynacja radiowa
  receiveRadioAlert(subX, subY, hunterX = null) {
    if (this.state === STATE.HUNT) return;
    this.lastKnownSubX    = subX;
    this.lastKnownSubY    = subY;
    this.lastBearingToSub = Math.atan2(subY - this.y, subX - this.x);
    this.detectTimer      = Math.max(this.detectTimer, ALERT_THRESHOLD + 1.2);
    this._contactAge      = 0;

    // Flanking coordination — jeśli oba okręty po tej samej stronie łodzi,
    // ten przechodzi na drugą stronę by zamknąć pułapkę
    if (hunterX !== null) {
      const hunterSide = Math.sign(hunterX - subX);
      const thisSide   = Math.sign(this.x   - subX);
      this._flankApproach = (hunterSide === thisSide && hunterSide !== 0);
    }
  }

  // ── Aktywny sonar ──────────────────────────────────────────────────────────

  _updateActiveSonar(dt, sub) {
    const interval = this.state === STATE.PATROL ? 22
                   : this.state === STATE.ALERT  ?  9 : 5;

    this.pingTimer -= dt;
    if (this.pingTimer <= 0) {
      this.activePings.push({ r: 0, alpha: 0.80 });
      this.pingTimer = interval + Math.random() * 3;
    }

    const WORLD_W = this.scene.WORLD_W;
    for (const p of this.activePings) {
      const prevR = p.r;
      p.r    += PING_SPEED * dt;
      p.alpha = Math.max(0, p.alpha - dt * 0.42);

      let dx = sub.x - this.x;
      if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
      const dy   = sub.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (prevR < dist && p.r >= dist) {
        const boost = sub.belowThermocline ? PING_BOOST_THERMO : PING_BOOST;
        this.detectTimer      = Math.min(this.detectTimer + boost, HUNT_THRESHOLD + 1);
        this.lastBearingToSub = Math.atan2(dy, dx);
        this.lastKnownSubX    = sub.x;
        this.lastKnownSubY    = sub.y;
        this._contactAge      = 0;
        this._lastKnownVX     = sub.vx || 0;
        this.recentPingHit    = true;
        // Ping ujawnia okręt gracza — ale też gracz widzi echo = pozycja wroga
        this.revealTimer = Math.max(this.revealTimer, 6.0);
      }
    }
    this.activePings = this.activePings.filter(p => p.alpha > 0);
  }

  // ── Wykrywanie pasywne ─────────────────────────────────────────────────────

  _updateDetection(dt, sub) {
    const WORLD_W = this.scene.WORLD_W;
    let dx = sub.x - this.x;
    if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
    const dy   = sub.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Wabie akustyczne — sprawdź czy głośniejsze od okrętu gracza
    const noisemakers = this.scene.noisemakers || [];
    let bestDecoy = null, bestDecoyStr = 0;
    for (const nm of noisemakers) {
      const ndx   = nm.x - this.x;
      const ndy   = nm.y - this.y;
      const ndist = Math.sqrt(ndx * ndx + ndy * ndy);
      // Siła wabii: pełna moc * zanik z wiekiem * zanik z dystansem
      const str = nm.noise * (1 - nm.age / nm.lifetime)
                * Math.max(0, 1 - ndist / (BASE_HYDROPHONE * 1.4));
      if (str > bestDecoyStr) { bestDecoyStr = str; bestDecoy = nm; }
    }
    // Wabia maskuje okręt — im głośniejsza, tym mniejszy skuteczny zasięg hydrofonu
    const decoyMask = Math.min(0.88, bestDecoyStr * 2.2);

    let range = BASE_HYDROPHONE * sub.noiseEffective * (1 - decoyMask);
    if (sub.belowThermocline) range *= THERMO_MASK;

    if (dist < range) {
      this.detectTimer      = Math.min(this.detectTimer + dt * (1 - decoyMask * 0.6), HUNT_THRESHOLD + 1);
      this.lastBearingToSub = Math.atan2(dy, dx);
      this.lastKnownSubX    = sub.x;
      this.lastKnownSubY    = sub.y;
      this._contactAge      = 0;
      this._lastKnownVX     = sub.vx || 0;
    } else {
      this._contactAge += dt;

      // W HUNT z aktywną wabią → niszczyciel skieruje się na wabię zamiast okrętu
      if (bestDecoy && decoyMask > 0.25 && (this.state === STATE.HUNT || this.state === STATE.ALERT)) {
        this.lastKnownSubX = bestDecoy.x;
        this.lastKnownSubY = this.scene.SURFACE_Y;
      }

      // Zanik: szybszy pod termoklinem (nagroda za krycie się), wolniejszy na otwartej wodzie
      const huntDecay = sub.belowThermocline ? HUNT_DECAY_THERMO : HUNT_DECAY_BASE;
      const decay = this.state === STATE.HUNT ? huntDecay : 0.75;
      this.detectTimer = Math.max(0, this.detectTimer - decay * dt);
    }

    this.detectionLevel = Phaser.Math.Clamp(this.detectTimer / HUNT_THRESHOLD, 0, 1);

    const prev = this.state;
    if      (this.detectTimer >= HUNT_THRESHOLD)  this.state = STATE.HUNT;
    else if (this.detectTimer >= ALERT_THRESHOLD) this.state = STATE.ALERT;
    else if (this.detectTimer >  0)               this.state = STATE.ALERT;
    else if (this.searchTimer >  0) {
      this.state = STATE.SEARCH;
      this.searchTimer -= dt;
    } else {
      this.state = STATE.PATROL;
    }

    // Śledzenie czasu HUNT — do wezwania posiłków
    if (this.state === STATE.HUNT) {
      this._huntDuration += dt;
      if (this._huntDuration >= REINFORCE_DELAY && !this.needsReinforcement) {
        this.needsReinforcement = true;
      }
    } else {
      this._huntDuration = Math.max(0, this._huntDuration - dt * 0.5);
      if (this._huntDuration === 0) this.needsReinforcement = false;
    }

    if (prev === STATE.HUNT && this.state !== STATE.HUNT && this.state !== STATE.WITHDRAW) {
      this.searchTimer  = SEARCH_DURATION;
      this.overshootX   = null;
      this._contactAge  = 0;  // reset DR przy utracie — szuka od ostatniej pozycji
    }

    // Wycofanie nadpisuje inne stany gdy okręt krytycznie uszkodzony
    if (this._withdrawing || this.hull < 0.10) {
      this._withdrawing = true;
      this.state        = STATE.WITHDRAW;
    }
  }

  // ── Ruch ───────────────────────────────────────────────────────────────────

  _updateMovement(dt) {
    const WORLD_W = this.scene.WORLD_W;

    // Szok po trafieniu — spowolnienie proporcjonalne do pozostałego czasu
    this._damageShockTimer = Math.max(0, this._damageShockTimer - dt);
    const shockMult = this._damageShockTimer > 0
      ? Phaser.Math.Linear(0.15, 1.0, 1 - this._damageShockTimer / (SHOCK_BASE + 6))
      : 1.0;

    const dmgMult = (0.45 + this.hull * 0.55) * shockMult;

    // Kontrmanewry torpedowe — zdrowy: delikatny manewr; uszkodzony: panika
    if (this.torpedoEvadeTimer > 0) {
      const evadeSpd = this.hull < 0.5 ? HUNT_SPEED * 1.8 : HUNT_SPEED * 1.1;
      this.x += this._evadeDir * evadeSpd * dmgMult * dt;
      this.x  = Phaser.Math.Clamp(this.x, 0, WORLD_W);
      return;
    }

    // "Sprint and listen" — patrol zatrzymuje się na chwilę żeby usłyszeć ciszej
    if (this.state === STATE.PATROL) {
      this._sprintListenTimer += dt;
      const cycle = 14 + Math.random() * 0.001;  // ~14s cykl
      if (this._sprintListenTimer > cycle) {
        this._listening = !this._listening;
        this._sprintListenTimer = 0;
      }
    } else {
      this._listening = false;
    }

    const speedMult = this._listening ? 0.05 : 1.0;

    switch (this.state) {
      case STATE.PATROL: {
        this.x += this.dir * this.patrolSpeed * dmgMult * speedMult * dt;
        if (this.x > this.patrolRight) { this.x = this.patrolRight; this.dir = -1; }
        if (this.x < this.patrolLeft)  { this.x = this.patrolLeft;  this.dir =  1; }
        break;
      }
      case STATE.ALERT: {
        if (this._flankApproach) {
          // Koordynacja: obejdź z flanki — kieruj się na stronę PRZECIWNĄ do reportującego
          const flankOffset = Math.sign(this.x - this.lastKnownSubX) * 180;
          const flankTarget = this.lastKnownSubX + flankOffset;
          const fd = flankTarget - this.x;
          if (Math.abs(fd) > 20) this.dir = Math.sign(fd);
        } else {
          const txDir = Math.cos(this.lastBearingToSub);
          if (Math.abs(txDir) > 0.15) this.dir = Math.sign(txDir);
        }
        this.x += this.dir * ALERT_SPEED * dmgMult * dt;
        this.x  = Phaser.Math.Clamp(this.x, 0, WORLD_W);
        break;
      }
      case STATE.HUNT: {
        // Dead reckoning — przewiduj gdzie łódź odpłynęła od ostatniego kontaktu
        const drAge   = Math.min(this._contactAge, 9);
        const drTargX = this.lastKnownSubX + this._lastKnownVX * drAge * DR_VX_WEIGHT;
        let   dx      = drTargX - this.x;
        if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;

        // Prędkość: wyższa gdy kontakt świeży (< 3s), normalna gdy stracimy na chwilę
        const huntSpd = this._contactAge < 3 ? HUNT_SPEED * 1.18 : HUNT_SPEED;

        if (this.overshootX === null) {
          if (Math.abs(dx) > 20) this.dir = Math.sign(dx);
          this.x += this.dir * huntSpd * dmgMult * dt;
        } else {
          this.x += this.dir * huntSpd * dmgMult * dt;
          const reached = this.dir > 0
            ? this.x >= this.overshootX
            : this.x <= this.overshootX;
          if (reached) {
            this.overshootX = null;
            this.dir        = -this.dir;
          }
        }
        this.x = Phaser.Math.Clamp(this.x, 0, WORLD_W);
        break;
      }
      case STATE.SEARCH: {
        const elapsed = SEARCH_DURATION - this.searchTimer;
        if (elapsed < 11) {
          // Faza 1: konwergencja — pędź do ostatniej pozycji (zrzuć zarzuty)
          let cdx = this.lastKnownSubX - this.x;
          if (Math.abs(cdx) > WORLD_W / 2) cdx -= Math.sign(cdx) * WORLD_W;
          if (Math.abs(cdx) > 25) this.dir = Math.sign(cdx);
          this.x += this.dir * ALERT_SPEED * dmgMult * dt;
        } else {
          // Faza 2: rozszerzający się sweep od ostatniej pozycji
          const swing = Math.min(80 + (elapsed - 11) * 16, 420);
          const left  = this.lastKnownSubX - swing;
          const right = this.lastKnownSubX + swing;
          this.x += this.dir * ALERT_SPEED * 0.78 * dmgMult * dt;
          if (this.x > right) this.dir = -1;
          if (this.x < left)  this.dir =  1;
        }
        this.x = Phaser.Math.Clamp(this.x, 0, WORLD_W);
        break;
      }
      case STATE.WITHDRAW: {
        // Oddalaj się od ostatniej poznanej pozycji okrętu gracza
        const awayDir = Math.sign(this.x - this.lastKnownSubX);
        if (awayDir !== 0) this.dir = awayDir;

        // Prędkość wycofywania — rośnie z uszkodzeniami (bardziej desperacka ucieczka)
        const wSpd = WITHDRAW_SPEED + (1 - this.hull) * 28;
        this.x += this.dir * wSpd * dmgMult * dt;
        this.x = Phaser.Math.Clamp(this.x, 0, WORLD_W);

        // Ślad olejowy — co 2.5s dodaj kroplę oleju na powierzchni
        if (!this._oilDropTimer) this._oilDropTimer = 0;
        this._oilDropTimer -= dt;
        if (this._oilDropTimer <= 0) {
          this._oilDropTimer = 2.2 + Math.random() * 1.2;
          this._oilDrops.push({ x: this.x, age: 0 });
        }
        break;
      }
    }

    // Starzenie śladów olejowych
    for (const d of this._oilDrops) d.age += dt;
    this._oilDrops = this._oilDrops.filter(d => d.age < 45);
  }

  // ── Zarzuty głębinowe ──────────────────────────────────────────────────────

  _updateCharges(dt, sub) {
    this.chargeCD = Math.max(0, this.chargeCD - dt);

    // Spekulacyjne zarzuty podczas przeszukiwania
    if (this.state === STATE.SEARCH && this.chargeCD <= 0 && Math.random() < 0.007) {
      this._dropPattern(sub);
      this.chargeCD = CHARGE_COOLDOWN * 1.8;
    }

    // Zarzuty gdy w fazie podejścia
    if (this.state === STATE.HUNT && this.overshootX === null) {
      const WORLD_W = this.scene.WORLD_W;
      let dx = this.lastKnownSubX - this.x;
      if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;

      if (Math.abs(dx) < 85 && this.chargeCD <= 0) {
        this._dropPattern(sub);
        this.chargeCD   = CHARGE_COOLDOWN;
        this.overshootX = this.x + this.dir * HUNT_OVERSHOOT;
      }
    }

    for (const c of this.charges) {
      if (c.exploded) { c.explodeTimer -= dt; continue; }
      c.y += c.speed * dt;

      if (c.y >= c.targetY) {
        c.exploded     = true;
        c.explodeTimer = 0.55;

        const WORLD_W = this.scene.WORLD_W;
        let dx = sub.x - c.x;
        if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
        const dy   = sub.y - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CHARGE_BLAST_R) {
          const ratio = 1 - dist / CHARGE_BLAST_R;
          sub.hull -= Phaser.Math.Clamp(ratio * 0.44, 0.04, 0.44);
        }
        this.recentExplosions.push({ x: c.x, y: c.y, dist });
      }
    }

    this.charges = this.charges.filter(c => !c.exploded || c.explodeTimer > 0);
  }

  _dropPattern(sub) {
    const SURF     = this.scene.SURFACE_Y;
    const fallTime = (sub.y - SURF) / CHARGE_FALL_SPD;
    const predY    = Phaser.Math.Clamp(
      sub.y + sub.vy * fallTime * 0.42,
      SURF + 25, this.scene.OCEAN_FLOOR_Y - 25
    );
    const offsets = [0, this.dir * 55, -this.dir * 55];
    for (const xOff of offsets) {
      this.charges.push({
        x: this.x + xOff, y: SURF + 10,
        targetY: predY + Phaser.Math.Between(-22, 22),
        speed: CHARGE_FALL_SPD + Math.random() * 28,
        exploded: false, explodeTimer: 0,
      });
    }
  }

  // ── ASROC ──────────────────────────────────────────────────────────────────

  _updateASROC(dt, sub) {
    this.asrocCD = Math.max(0, this.asrocCD - dt);

    // Warunek odpalenia: HUNT lub SEARCH, dobry dystans, cooldown minął
    const WORLD_W = this.scene.WORLD_W;
    let dx = this.lastKnownSubX - this.x;
    if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
    const dist = Math.abs(dx);

    const canFire = (this.state === STATE.HUNT || this.state === STATE.SEARCH
                    || this.state === STATE.WITHDRAW)  // defensywny strzał podczas ucieczki
                  && this.asrocCD <= 0
                  && dist > ASROC_MIN_DIST
                  && dist < ASROC_MAX_DIST
                  && this.hull > 0.1;   // nie odpala gdy prawie zatopiony

    if (canFire) {
      this.asrocs.push(new ASROC(
        this.scene,
        this.x,
        this.lastKnownSubX + Phaser.Math.Between(-60, 60),  // lekki rozrzut
        this.lastKnownSubY
      ));
      this.asrocCD     = ASROC_COOLDOWN;
      this.recentASROC = true;
    }

    // Aktualizuj aktywne rakiety
    for (const a of this.asrocs) {
      const splash = a.update(dt);
      if (splash) {
        // ASROC trafił w wodę — spawn torpedy samonaprowadzającej
        this.homingTorpedoes.push(new HomingTorpedo(this.scene, splash.x, splash.y));
      }
    }

    // Aktualizuj torpedy samonaprowadzające
    for (const ht of this.homingTorpedoes) {
      ht.update(dt, sub);
    }

    // Sprzątanie
    for (const a of this.asrocs.filter(a => a.dead)) a.destroy();
    this.asrocs = this.asrocs.filter(a => !a.dead);

    for (const ht of this.homingTorpedoes.filter(ht => ht.dead)) ht.destroy();
    this.homingTorpedoes = this.homingTorpedoes.filter(ht => !ht.dead);
  }

  // ── Interfejsy ────────────────────────────────────────────────────────────

  getContactInfo(sub) {
    const WORLD_W = this.scene.WORLD_W;
    let dx = this.x - sub.x;
    if (Math.abs(dx) > WORLD_W / 2) dx -= Math.sign(dx) * WORLD_W;
    const dy = this.y - sub.y;
    return {
      bearing:        Math.atan2(dy, dx),
      distance:       Math.sqrt(dx * dx + dy * dy),
      state:          this.state,
      detectionLevel: this.detectionLevel,
    };
  }

  getVelocity() {
    const spd = this.state === STATE.HUNT     ? HUNT_SPEED
              : this.state === STATE.WITHDRAW ? WITHDRAW_SPEED + (1 - this.hull) * 28
              : this.patrolSpeed;
    return { vx: this.dir * spd, vy: 0 };
  }

  // ── Tonięcie ──────────────────────────────────────────────────────────────

  _updateSinking(dt) {
    const SURF  = this.scene.SURFACE_Y;
    const FLOOR = this.scene.OCEAN_FLOOR_Y;

    this._sinkTimer = Math.max(0, this._sinkTimer - dt);
    const prog = 1 - this._sinkTimer / this._sinkDur;

    // Pozycja Y: SURF → FLOOR-10 przez prog 0.08–0.88
    const sf = prog < 0.08 ? 0 : Phaser.Math.Clamp((prog - 0.08) / 0.80, 0, 1);
    this._shipSinkY = SURF + Math.pow(sf, 1.55) * (FLOOR - SURF - 10);

    // Rotacja — przyspiesza do 0.22, stała, zwalnia przy dnie
    const rotSpd = prog < 0.22 ? (prog / 0.22) * 2.8
                 : prog > 0.88 ? 2.8 * Math.max(0, 1 - (prog - 0.88) / 0.12)
                 : 2.8;
    this._sinkAngle += rotSpd * dt * this._sinkSide;

    const shipY = this._shipSinkY;

    // Bąble — gęste na początku (para od ognia) i przy dnie (powietrze z wraku)
    const bRate = (prog < 0.16 || (prog > 0.85 && prog < 0.97)) ? 18 : 5;
    if (prog < 0.96 && Math.random() < dt * bRate) {
      this._sinkParticles.push({
        type: 'bubble',
        x: this.x + Phaser.Math.Between(-26, 26),
        y: Math.min(shipY + 6, FLOOR - 8),
        vy: -(28 + Math.random() * 28),
        age: 0,
        r: 1.5 + Math.random() * 3,
      });
    }

    // Szczątki — odrywają się w fazie podwodnej
    if (prog > 0.13 && prog < 0.76 && Math.random() < dt * 2.8) {
      const cols = [0x775511, 0x334455, 0x556677, 0x443322, 0x887766];
      this._sinkParticles.push({
        type: 'debris',
        x: this.x + Phaser.Math.Between(-52, 52),
        y: shipY + Phaser.Math.Between(-18, 18),
        vx: (Math.random() - 0.5) * 16,
        vy: -(5 + Math.random() * 14),
        rot: Math.random() * Math.PI * 2,
        rotv: (Math.random() - 0.5) * 3.2,
        age: 0,
        size: 4 + Math.random() * 10,
        col: cols[Math.floor(Math.random() * cols.length)],
      });
    }

    // Update cząsteczek
    for (const p of this._sinkParticles) {
      p.age += dt;
      if (p.type === 'bubble') {
        p.y += p.vy * dt;
      } else {
        p.x   += p.vx * dt;
        p.y   += p.vy * dt;
        p.vy   = p.vy * (1 - dt * 0.45);
        p.vx   = p.vx * (1 - dt * 0.35);
        p.rot += p.rotv * dt;
      }
    }
    this._sinkParticles = this._sinkParticles.filter(p =>
      p.type === 'bubble' ? p.age < 5.2 && p.y > SURF - 35 : p.age < 13 && p.y > SURF
    );

    if (this._sinkTimer <= 0) this.destroyed = true;
    this._drawSinking(prog);
  }

  _drawSinking(prog) {
    const g     = this.gfx;
    const SURF  = this.scene.SURFACE_Y;
    const FLOOR = this.scene.OCEAN_FLOOR_Y;
    const shipY = this._shipSinkY ?? SURF;
    const t     = Date.now() * 0.001;
    g.clear();

    // ── Plama oleju na powierzchni ────────────────────────────────────────
    const oilR = 24 + prog * 185;
    g.fillStyle(0x1a0d00, 0.24 + prog * 0.20);
    g.fillEllipse(this.x, SURF + 4, oilR * 2.9, oilR * 0.48);
    g.fillStyle(0x330e22, 0.08 + prog * 0.09);
    g.fillEllipse(this.x + oilR * 0.22, SURF + 3, oilR * 0.80, oilR * 0.20);

    // ── Dym i ogień na powierzchni (zanim okręt zejdzie pod wodę) ────────
    if (prog < 0.28) {
      const si = 1 - prog / 0.28;
      for (let i = 0; i < 9; i++) {
        const age = (i * 0.111 + t * 0.17) % 1;
        g.fillStyle(0x0a0a0a, (1 - age) * 0.70 * si);
        g.fillCircle(
          this.x + Math.sin(t * 0.7 + i * 0.9) * 28 * age,
          SURF - 10 - age * (52 + si * 44),
          7 + age * (22 + si * 20)
        );
      }
      for (let i = 0; i < 6; i++) {
        const age = (i / 6 + t * 0.55) % 1;
        g.fillStyle(0xff4400, (1 - age) * 0.87 * si);
        g.fillCircle(
          this.x + Math.sin(t * 2.5 + i * 1.3) * 24 * age,
          SURF - 9 - age * (34 + si * 28),
          5 + age * (14 + si * 12)
        );
      }
    }

    // ── Splash przy zanurzaniu ────────────────────────────────────────────
    if (prog > 0.06 && prog < 0.27) {
      const sp = (prog - 0.06) / 0.21;
      g.fillStyle(0x88aacc, (1 - sp) * 0.50);
      g.fillEllipse(this.x, SURF - sp * 20, sp * 170, sp * 48);
      g.lineStyle(2, 0xbbd4ee, (1 - sp) * 0.72);
      g.strokeEllipse(this.x, SURF + 4, (sp * 95 + 35) * 2, sp * 20 + 10);
    }

    // ── Fale rozchodzące się po zanurzeniu ────────────────────────────────
    if (prog > 0.14) {
      const wp = Math.min((prog - 0.14) / 0.62, 1);
      g.lineStyle(1.5, 0x6688aa, (1 - wp) * 0.44);
      g.strokeEllipse(this.x, SURF + 2, wp * 310, wp * 44);
      g.lineStyle(1.0, 0x6688aa, (1 - wp) * 0.24);
      g.strokeEllipse(this.x, SURF + 2, wp * 210, wp * 30);
    }

    // ── Bąble i szczątki ──────────────────────────────────────────────────
    for (const p of this._sinkParticles) {
      const dep = Phaser.Math.Clamp((p.y - SURF) / (FLOOR - SURF), 0, 1);
      if (p.type === 'bubble') {
        const f = Math.max(0, 1 - p.age / 5.2);
        g.fillStyle(0x88bbdd, f * (0.55 - dep * 0.35));
        g.fillCircle(p.x, p.y, p.r + p.age * 0.65);
      } else {
        const f = Math.max(0, 1 - p.age / 13);
        g.save();
        g.translateCanvas(p.x, p.y);
        g.rotateCanvas(p.rot);
        g.fillStyle(p.col, f * (0.72 - dep * 0.42));
        g.fillRect(-p.size / 2, -p.size * 0.30, p.size, p.size * 0.62);
        g.restore();
      }
    }

    // ── Okręt — zanurza się, obraca, ściemnia z głębokością ──────────────
    const depth   = Phaser.Math.Clamp((shipY - SURF) / (FLOOR - SURF), 0, 1);
    const alpha   = prog > 0.90 ? Math.max(0, 1 - (prog - 0.90) / 0.10) : 1.0;
    const visA    = alpha * (1 - depth * 0.62);
    const shipCol = depth < 0.12 ? 0x775511 : depth < 0.45 ? 0x443308 : 0x1e1402;
    const d       = this.dir;

    g.save();
    g.translateCanvas(this.x, shipY);
    g.rotateCanvas(this._sinkAngle);

    g.fillStyle(0x040810, 0.45 * alpha);
    g.fillRect(-28, 0, 56, 7);
    g.fillStyle(shipCol, 0.90 * visA);
    g.fillRect(-28, -10, 56, 10);
    g.fillStyle(shipCol, 0.84 * visA);
    g.fillRect(d * 8, -14, d * 20, 4);
    g.fillStyle(shipCol, 0.88 * visA);
    g.fillTriangle(d * 38, -4, d * 28, -11, d * 28, 1);
    g.fillStyle(shipCol, 0.90 * visA);
    g.fillRect(-8, -20, 18, 10);
    g.fillStyle(0x101e2a, 0.76 * visA);
    g.fillRect(-5, -27, 13, 7);
    g.fillStyle(0x101e2a, 0.80 * visA);
    g.fillRect(-d * 4, -31, 7, 11);
    g.fillStyle(0x445566, 0.38 * visA);
    g.fillRect(-1, -36, 2, 9);

    // Wybuch początkowy + ogień (tylko blisko powierzchni)
    if (depth < 0.28) {
      const fi = 1 - depth / 0.28;
      if (prog < 0.10) {
        const burst = 1 - prog / 0.10;
        g.fillStyle(0xffffff, burst * 0.70 * visA);
        g.fillCircle(0, -14, 5 + burst * 34);
        g.fillStyle(0xff8800, burst * 0.88 * visA);
        g.fillCircle(0, -14, 4 + burst * 25);
      }
      for (let i = 0; i < 5; i++) {
        const age = (i * 0.2 + t * 0.55) % 1;
        g.fillStyle(0xff4400, (1 - age) * 0.80 * fi * visA);
        g.fillCircle(Math.sin(t * 2.5 + i * 1.3) * 20 * age, -(9 + age * 40), 5 + age * 13);
      }
    }

    // Pęknięcia szkieletu
    if (prog > 0.09) {
      const ca = Math.min(1, (prog - 0.09) * 4) * visA;
      g.lineStyle(1.5, 0xff5533, ca);
      g.strokeLineShape(new Phaser.Geom.Line(-22, -8, -7, -2));
      g.strokeLineShape(new Phaser.Geom.Line(10, -9, 24, -2));
      if (prog > 0.38) {
        g.lineStyle(1.2, 0xcc3311, ca * 0.70);
        g.strokeLineShape(new Phaser.Geom.Line(-5, -20, 5, -10));
      }
    }

    g.restore();

    // ── Uderzenie w dno ───────────────────────────────────────────────────
    if (prog > 0.85) {
      const ip = Phaser.Math.Clamp((prog - 0.85) / 0.15, 0, 1);
      const ie = 1 - ip;

      // Chmura mułu
      g.fillStyle(0x7a6a40, ie * 0.44);
      g.fillEllipse(this.x, FLOOR + 4, ip * 260, ip * 34);
      g.fillStyle(0x5c4f2e, ie * 0.28);
      g.fillEllipse(this.x, FLOOR + 1, ip * 440, ip * 20);

      // Wrak osiadający na dnie
      if (ip > 0.28) {
        const wa = Math.min(1, (ip - 0.28) / 0.72);
        // Kadłub wraku
        g.fillStyle(0x221508, wa * 0.88);
        g.fillRect(this.x - 31, FLOOR - 8, 62, 10);
        // Przechylona nadbudówka
        g.save();
        g.translateCanvas(this.x + this._sinkSide * 8, FLOOR - 9);
        g.rotateCanvas(this._sinkSide * 0.50);
        g.fillStyle(0x150e04, wa * 0.72);
        g.fillRect(-9, -10, 18, 10);
        g.restore();
        // Maszt leżący na dnie
        g.fillStyle(0x2a3a3a, wa * 0.52);
        g.fillRect(this.x - this._sinkSide * 30, FLOOR - 2, this._sinkSide * 38, 2);
        // Muł wokół wraku (osiada)
        g.fillStyle(0x5a4a30, wa * ie * 0.28 + wa * 0.08);
        g.fillEllipse(this.x, FLOOR + 3, 110 + wa * 70, 16);
      }
    }
  }

  // ── Renderowanie ─────────────────────────────────────────────────────────

  _draw() {
    const g    = this.gfx;
    const SURF = this.scene.SURFACE_Y;
    g.clear();

    const col = this.state === STATE.WITHDRAW ? 0x886622
              : this.state === STATE.HUNT     ? 0xff3300
              : this.state === STATE.ALERT    ? 0xffbb00
              : this.state === STATE.SEARCH   ? 0xcc8800
                                              : 0x3a7a6a;

    // Ślady olejowe — widoczne na powierzchni wody (pomagają namierzać uciekający okręt)
    for (const d of this._oilDrops) {
      const frac = Math.max(0, 1 - d.age / 45);
      const r    = 6 + (1 - frac) * 14;
      g.fillStyle(0x443300, frac * 0.55);
      g.fillEllipse(d.x, SURF + 3, r * 2.5, r * 0.6);
    }

    // ── Zawsze widoczne — elementy fizyczne w wodzie ───────────────────────

    // Fale aktywnego sonaru (zdradza przybliżoną pozycję)
    for (const p of this.activePings) {
      g.lineStyle(1.2, 0x44ffcc, p.alpha * 0.55);
      g.strokeCircle(this.x, SURF, p.r);
    }

    // Słaby ślad obecności — bardzo mała szansa na odgadnięcie pozycji
    if (this.detectionLevel > 0.08) {
      const ringR = BASE_HYDROPHONE * this.detectionLevel * 0.35;
      g.fillStyle(col, 0.015 + this.detectionLevel * 0.018);
      g.fillCircle(this.x, SURF, ringR);
    }

    // Środki zaradcze (chmury bąbelków po wykryciu torpedy)
    for (const cm of this._counterMeasures) {
      const frac = Math.max(0, 1 - cm.age / 3.5);
      g.fillStyle(0xaaddff, frac * 0.35);
      g.fillCircle(cm.x, cm.y + cm.age * 5, cm.r + cm.age * 4);
    }

    // Zarzuty głębinowe — widoczne fizycznie
    for (const c of this.charges) {
      if (c.exploded) {
        const frac = c.explodeTimer / 0.55;
        const r    = (1 - frac) * CHARGE_BLAST_R * 1.9;
        g.lineStyle(2.5, 0xff8800, frac * 0.9);
        g.strokeCircle(c.x, c.y, r);
        g.fillStyle(0xff4400, frac * 0.5);
        g.fillCircle(c.x, c.y, r * 0.38);
      } else {
        g.fillStyle(0xffcc44, 0.9);
        g.fillEllipse(c.x, c.y, 10, 14);
        g.fillStyle(0xffffff, 0.22);
        g.fillCircle(c.x, c.y - 9, 3);
      }
    }

    // ── Okręt — widoczny tylko po trafieniu echem sonaru ──────────────────
    if (this.revealTimer <= 0) return;

    // Alpha stopniowo zanika w ostatniej sekundzie
    const shipAlpha = Math.min(1, this.revealTimer);

    // Smuga ataku biegowego
    if (this.state === STATE.HUNT) {
      g.lineStyle(2, 0xff3300, 0.35 * shipAlpha);
      g.strokeLineShape(new Phaser.Geom.Line(
        this.x - this.dir * 60, SURF - 4, this.x, SURF - 4
      ));
    }

    // Dym z kominów podczas wycofywania
    if (this.state === STATE.WITHDRAW) {
      const t   = Date.now() * 0.001;
      for (let i = 0; i < 3; i++) {
        const age  = (i * 0.33 + t * 0.4) % 1;
        const dx   = -this.dir * age * 28;
        const dy   = -(12 + age * 22);
        const r    = 4 + age * 9;
        const alph = (1 - age) * 0.35 * shipAlpha;
        g.fillStyle(0x888888, alph);
        g.fillCircle(this.x + 2 + dx, SURF + dy, r);
      }
    }

    // Migotanie przy szoku po trafieniu (krótkie dezorientowanie)
    if (this._damageShockTimer > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.025);
      g.lineStyle(2, 0xffffff, pulse * 0.55 * shipAlpha);
      g.strokeRect(this.x - 31, SURF - 21, 62, 22);
    }

    // Wskaźnik "słucha"
    if (this._listening) {
      const pulse = 0.35 + 0.25 * Math.sin(Date.now() * 0.008);
      g.lineStyle(1.5, 0x44ffcc, pulse * shipAlpha);
      g.strokeCircle(this.x, SURF - 14, 8);
    }

    // Wskaźnik ASROC gotowy
    if (this.asrocCD < 6) {
      const frac = 1 - this.asrocCD / 6;
      g.fillStyle(0xff8800, frac * 0.85 * shipAlpha);
      g.fillCircle(this.x - 8, SURF - 22, 3);
    }

    // Używamy układu lokalnego z centrum na (this.x, SURF)
    g.save();
    g.translateCanvas(this.x, SURF);

    const d = this.dir;   // +1 = płynie w prawo (dziób po prawej)
    const a = shipAlpha;

    // ── Dziób (trójkąt przed kadłubem) ───────────────────────────────────────
    g.fillStyle(col, 0.95 * a);
    g.fillTriangle(d * 38, -4, d * 28, -11, d * 28, 1);

    // ── Cień podwodnej części kadłuba ─────────────────────────────────────────
    g.fillStyle(0x111820, 0.55 * a);
    g.fillRect(-28, 0, 56, 6);

    // ── Główny kadłub (nad i pod linią wody) ──────────────────────────────────
    g.fillStyle(col, 0.92 * a);
    g.fillRect(-28, -10, 56, 10);

    // Jasna linia wodnicowa
    g.lineStyle(1, 0xffffff, 0.18 * a);
    g.strokeLineShape(new Phaser.Geom.Line(-28, 0, 28, 0));

    // ── Pokład forecastle (dziób podniesiony) ─────────────────────────────────
    g.fillStyle(col, 0.88 * a);
    g.fillRect(d * 8, -14, d * 20, 4);

    // ── Wieża artyleryjna na dziobie ──────────────────────────────────────────
    g.fillStyle(0x666677, 0.88 * a);
    g.fillCircle(d * 18, -13, 5);
    // Lufa działa
    g.lineStyle(2, 0x888899, 0.90 * a);
    g.strokeLineShape(new Phaser.Geom.Line(d * 18, -13, d * 30, -14));

    // ── Mostek / nadbudówka (centrum okrętu) ──────────────────────────────────
    // Podstawa nadbudówki
    g.fillStyle(col, 0.95 * a);
    g.fillRect(-8, -20, 18, 10);
    // Piętro mostu
    g.fillStyle(0x445566, 0.88 * a);
    g.fillRect(-5, -27, 13, 7);
    // Okna mostka (3 małe kwadraty)
    g.fillStyle(0x99bbcc, 0.40 * a);
    for (let i = 0; i < 3; i++) g.fillRect(-3 + i * 4, -26, 3, 3);

    // ── Komin (funnel) ────────────────────────────────────────────────────────
    g.fillStyle(0x334455, 0.90 * a);
    g.fillRect(-d * 4, -31, 7, 11);
    // Nasadka komina
    g.fillStyle(0x223344, 0.95 * a);
    g.fillRect(-d * 5, -33, 9, 3);

    // Dym z komina (animowany) — tylko gdy silnik pracuje
    if (this.state !== STATE.PATROL || this._listening === false) {
      const t = Date.now() * 0.001;
      for (let i = 0; i < 4; i++) {
        const age  = (i * 0.25 + t * 0.35) % 1;
        const sx   = -d * 1 + Math.sin(t * 0.8 + i) * 3 * age;
        const sy   = -(33 + age * 28);
        const sr   = 3 + age * 7;
        g.fillStyle(0x888898, (1 - age) * 0.30 * a);
        g.fillCircle(sx, sy, sr);
      }
    }

    // ── Maszt z radarem ───────────────────────────────────────────────────────
    g.fillStyle(0xbbccdd, 0.50 * a);
    g.fillRect(-1, -36, 2, 9);   // maszt
    // Antena radaru (obracający się element)
    const radarAngle = (Date.now() * 0.0018) % (Math.PI * 2);
    g.lineStyle(1.5, 0x88aacc, 0.65 * a);
    const rx1 = Math.cos(radarAngle) * 7, ry1 = Math.sin(radarAngle) * 3;
    g.strokeLineShape(new Phaser.Geom.Line(0, -36, rx1, -36 + ry1));
    g.strokeLineShape(new Phaser.Geom.Line(0, -36, -rx1, -36 - ry1));

    // ── Wyrzutnia ASROC ───────────────────────────────────────────────────────
    g.fillStyle(0x778899, 0.82 * a);
    g.fillRect(d * 10, -15, d * 12, 5);
    g.fillStyle(0x556677, 0.75 * a);
    g.fillRect(d * 11, -18, d * 8, 3);
    // Wskaźnik gotowości ASROC (świeci gdy CD < 6s)
    if (this.asrocCD < 6) {
      const frac = 1 - this.asrocCD / 6;
      g.fillStyle(0xff8800, frac * 0.90 * a);
      g.fillCircle(d * 14, -19, 3);
    }

    // ── Wyrzutniki torped (burta) ─────────────────────────────────────────────
    g.fillStyle(0x556677, 0.70 * a);
    g.fillRect(-d * 20, -9, d * 6, 4);

    // ── Pęknięcia / ogień przy uszkodzeniach ─────────────────────────────────
    if (this.hull < 0.6) {
      const ca = (0.6 - this.hull) * 3.5 * a;
      g.lineStyle(1.2, 0xff5533, ca);
      g.strokeLineShape(new Phaser.Geom.Line(-18, -7, -8, -2));
      g.strokeLineShape(new Phaser.Geom.Line(10, -8, 20, -1));
      if (this.hull < 0.3) {
        // Ogień na pokładzie
        const ft = Date.now() * 0.001;
        g.fillStyle(0xff6600, (0.5 + 0.5 * Math.sin(ft * 8)) * 0.70 * a);
        g.fillCircle(d * 5 + Math.sin(ft * 5) * 3, -13, 5 + Math.sin(ft * 7) * 2);
        g.fillStyle(0xff2200, 0.45 * a);
        g.fillCircle(d * 5, -16, 3);
      }
    }

    g.restore();
  }
}
