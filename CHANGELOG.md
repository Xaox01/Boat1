# Changelog — Operacja Październik

Wszystkie zmiany w projekcie. Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.0.0/).

---

## [0.12.1] — 2026-05-26

### Zmieniono — Mission1: rozbudowa psychologiczna (7 faz, 3 zakończenia)

**Nowe fazy (było 5, jest 7):**
- Faza 4 — MELDUNEK ZAMPOLITA: overlay z zampolitem, wybór odpowiedzi (potwierdź/zakwestionuj) wpływa na treść zakończenia
- Faza 6 — UCIECZKA I ŚLEDZENIE: po pingu USS DALLAS przechodzi w STATE.HUNT i aktywnie poluje na gracza przez 20 sekund

**Rozszerzone mechaniki:**
- USS DALLAS po identyfikacji (ping) ustawia state = STATE.HUNT — realny pościg
- Głosy załogi przez shipLog: [HYDROAK.], [ZAMPOLIT], [STARSZY OF.] w kluczowych momentach
- `_zampolit_questioned` flag — odpowiedź zampolita zmienia linię tekstu w każdym z zakończeń

**Trzy zakończenia zamiast dwóch:**
- ODPAL TORPEDĘ → "właśnie wywołałeś wojnę" — różny tekst zależnie od wyboru zampolita
- ODMÓW → trybunał + kontekst historyczny (ABLE ARCHER kończy się 11.11.1983)
- ZAŻĄDAJ POTWIERDZENIA → Moskwa krzyczy, gracz milczy 22s, Dallas odchodzi — moralne zwycięstwo przez bezczynność

**Intro:** zaktualizowana lista faz (7 kroków)

---

## [0.12.0] — 2026-05-26

### Dodano — Misja 1: OBIEKT K-7 (К-481, Morze Norweskie, 1983)

**Mission1.js — nowy plik, zastępuje TutorialMission jako domyślny start:**
- Tematyka: radziecki okręt podwodny К-481 (klasa Victor III), listopad 1983, Morze Norweskie
- Intro: ekran briefingu z czerwoną paletą (sowiecka estetyka), zamiast zielonej ORP KONDOR
- Faza 1 — ZANURZENIE BOJOWE: zejdź do 50m + prędkość ≥ 20px/s
- Faza 2 — WARSTWA IZOTERMICZNA: zejdź poniżej termokliny (>200m)
- Faza 3 — TRYB NASŁUCH: wycisz silniki, utrzymaj listenMode przez 3s
- Faza 4 — IDENTYFIKACJA: ping [Q] ujawnia "USS DALLAS (kl. LA)"
- Faza 5 — DEPESZA Z MOSKWY: dialog decyzji (ABLE ARCHER 83):
  - "WYKONAJ ROZKAZ — ODPAL TORPEDĘ" → zakończenie wojenne
  - "ODMÓW — PRZERWIJ MISJĘ" → zakończenie pokojowe z kontekstem historycznym
- USS DALLAS spawniętyjako Enemy "KONTAKT ALFA", odkrywany po pingu sonarowym
- Fix: faza 5 nie blokuje się na karcie — po kliknięciu "PODJĄĆ DECYZJĘ" pojawia się dialog
- GameScene: `_startTutorial()` używa teraz Mission1 zamiast TutorialMission

### Zmieniono — Menu główne: klimat К-481 i ABLE ARCHER

- Podnapis: `LISTOPAD 1983 · MORZE NORWESKIE · OBIEKT K-7`
- Nagłówek: `К-481 // ПОКОИ КОМАНДИРА`, POZ. `70°N 18°E · NW-7`
- Status: `● CISZA RADIOWA` zamiast `● ONLINE`
- SVG okrętu: `PR. 671RTM · К-481` zamiast K-244
- Briefing bez zapisu: DEPESZA GRU — KONTAKT ALFA, ABLE ARCHER STAN GOTOWOŚCI
- Telemetria: głębokość 243m, namiar 127° (kurs na KONTAKT ALFA), reaktor 71%
- Etykieta "KURS" → "NAMIAR", BUILD `19831101`, klasyfikacja `ŚCIŚLE TAJNE`

---

## [0.11.1] — 2026-05-26

### Dodano — Testowanie misji: URL ?mission=N i komenda DevConsole `mis N`

- `?mission=N` (N=1–5) — startuje grę bezpośrednio od wybranej misji, pomija tutorial
- DevConsole `mis N` — skacze do misji N w trakcie gry (cleanup enemies/merchants, nowy CampaignManager)
- `CampaignManager.startAtMission(idx)` — publiczna metoda do startu od dowolnej misji
- `GameScene._startCampaignAt(idx)` — helper wywoływany przez URL i DevConsole
- `mis <1–5>` dodane do listy komend `help`

---

## [0.11.0] — 2026-05-26

### Dodano — Kampania: 5 misji narracyjnych (CampaignManager)

**CampaignManager.js — nowy moduł:**
- 5 misji sekwencyjnych z ekranami odpraw, wyboru i zakończenia
- System reputacji (`_reputation`): +Warszawa / -Moskwa — wpływa na finałowe zakończenie M5
- Briefing overlay DOM: tytuł misji, rejon, kontekst narracyjny, cele operacyjne
- Ekran wyboru (2 opcje) dla M2 i M5
- Ekran ukończenia misji z aktualną reputacją i przejściem do następnej
- Dwa zakończenia M5: BOHATER (Warszawa, wysoka reputacja) / AZYL / KONIEC (Moskwa)

**Misje:**
- **M1 — Operacja Neptun**: wykryj sonarowo i zatop BPK «NIEUSTRASZONY»
- **M2 — Nieznany Kontakt**: klasyfikuj okręt bez IFF → wybór Moskwa/Warszawa (reputacja ±1)
- **M3 — Eskorta STOCZNIA-7**: eskortuj statek handlowy do x>8000 przed 2 patrolami (reputacja ±1)
- **M4 — Pole Minowe**: 8 min z aktywną grafiką min (blastR 78px, detectR 260px), awaria silnika po 90s
- **M5 — Ostatni Rozkaz**: wybór finalny Moskwa/Warszawa (reputacja ±2), 2 zakończenia

**GameScene.js — zmiany:**
- Import `CampaignManager`; `this.campaign = null` w `create()`
- `_startMission1Combat()` zastąpiony inicjacją `new CampaignManager(this).start()`
- `campaign?.update(dt)` w pętli update
- `campaign?.onEnemyDestroyed()` i `campaign?.onMerchantDestroyed()` podpięte przy zniszczeniu celów
- Sandbox (`_sandboxUpdate`) blokowany gdy `campaign._active` — brak nieplanowanych spawnów

---

## [0.10.77] — 2026-05-24

### Dodano — TutorialBot (automatyczny tester samouczka)

**TutorialBot.js — nowy moduł:**
- Bot autonomicznie przechodzi przez wszystkie 5 faz samouczka bez udziału gracza
- Uruchomienie: URL `?tutbot` lub komenda DevConsole `tbot` / `tbot stop`
- Panel DOM na górze ekranu pokazuje aktualną fazę (znika po zakończeniu)
- Dismissal modali i ekranu powitalnego przez osobny polling (250ms), niezależny od pauzy sceny
- Per-faza sterowanie:
  - Faza 0: `targetBallast = 0.85`, napęd do 100% — zanurza do 55m + speed ≥22 px/s
  - Faza 1: `targetBallast = 0.95` + napęd 45% — schodzi poniżej 215m
  - Faza 2: gaśnie silnik (`enginePower × 0.04^dt`) — czeka na tryb nasłuch
  - Faza 3: wywołuje `scene._firePing()` gdy `_pingCD ≤ 0`
  - Faza 4: `sub.fireTorpedo(target.x, target.y)`, detonacja po 8s
- Timeout per-faza: [28, 38, 25, 12, 45]s — fallback wymuszający warunki zaliczenia
- Raport `console.table()` ze statusem (PASS/TIMEOUT) i czasem każdej fazy
- `tbot` dodany do listy komend `help` w DevConsole

---

## [0.10.76] — 2026-05-23

### Dodano — Głębokość kruszenia + samolot patrolowy ("kleszcze")

**Głębokość kruszenia (GameScene.js):**
- Powyżej 400m widoczna linia krytyczna — teraz działa mechanicznie
- Poniżej 400m narastające uszkodzenia ciśnieniowe: `excess² × 0.014 / s`
- Przy 500m ≈ 0.0035 HP/s; przy 600m ≈ 0.014 HP/s — bardzo szybkie niszczenie
- Trzaski kadłuba: co malejący interwał (9s → 1.2s) shake + flash czerwony >440m
- Log "Kadłub skrzypi" przy excess > 0.6 (powyżej ~520m)

**PatrolPlane.js — nowy moduł:**
- Samolot patrolowy przelatuje przez sektor co 85–140s (po spawnie wrogów)
- Prędkość 540 px/s, leci nad powierzchnią (SURFACE_Y − 38)
- Pixel-art sylwetka: kadłub + skrzydła + stateczniki + gondole silników z "odrzutem"
- Trzy tryby wykrycia łodzi:
  - Wzrokowe: dx < 320px i głębokość < 40m
  - MAD/hydrofonowe: dx < 520px, głębokość < 110m, noise > 0.35
  - Kawitacja: dx < 420px, głębokość < 170m i sub.cavitating
- 4 bomby głębinowe z predykcją prędkości łodzi (velocity lead)
- Bomby: blast radius 85px, max dmg 30% HP; wzorowane na Enemy.charges
- Eksplozja: orange/yellow flash + shake + log "Bomba głębinowa z powietrza!"
- `_applyCamera()` obsługuje gfx.x dla każdego aktywnego samolotu

---

## [0.10.75] — 2026-05-23

### Zmieniono — Pixel-art dno oceanu (Ocean.js)

**Wizualizacja dna — całkowita wymiana na styl pixel-art (z pliku design "Dno Oceanu Pixel"):**
- Paleta PAL: sand1–sand4 (piasek), glow/glowDim (bioluminescencja), plankton, bubble/bubbleD
- Wielokąt dna bakowany w ciemnej bazie (PAL.sand4), bez starych brązowych pasków tekstury
- Nowa warstwa `floorGfx` (depth 2) rysowana per-klatka w world-space:
  - 4 warstwy kolorów: sand1 highlight → dither → sand2 → dither → sand3
  - Dithering deterministyczny (`_hash(wx, fy)`) na granicach warstw
  - Ripple piasku: jasna linia co ~18px (sin(wx*0.35) > 0.82)
- Skały proceduralne per-klatka (tylko widoczne w camX+CW):
  - Duże seamounty — bryła z pętli fillRect, gradient sand2→sand3→sand4 + highlight szczytu
  - 140 małych kamieni rozmieszczonych deterministycznie (hash)
- Bioluminescencja — 30 punktów glow, animowane pulsem (sin), tylko gdy pulse > 0.5
- Nowa pula bąbli (`_initBubbles`, 25 szt.) — wynurzają się z dna, reset po dotarciu do powierzchni
- Plankton zaktualizowany do PAL.plankton (0x3a6a7a) zamiast starego koloru fali
- Usunięto stary brązowy polygon tekstury (26px strip loop) i stare skały z `_bakeBg()`

---

## [0.10.74] — 2026-05-23

### Zmieniono — Samouczek od nowa (5 faz) + Misja 1: Operacja Neptun + zmiana nazwy okrętu

**Okręt gracza: ORP KONDOR (Projekt 641)**
- Zmiana nazwy z "ORP ORZEŁ" na "ORP KONDOR" we wszystkich plikach
- index.html: top-bar, log-panel, ds-header, opis torpedy, klasa Projekt 641
- i18n.js: `ds_title` PL i EN, klucze misji PL i EN

**TutorialMission.js — przepisany od nowa (5 faz zamiast 7):**
- Faza 1: GŁĘBOKOŚĆ I NAPĘD — zanurz do 50m I osiągnij ≥20px/s (jedno zadanie połączone)
- Faza 2: TERMOKLINA — zejdź poniżej 200m, wyjaśnienie maskowania akustycznego
- Faza 3: TRYB NASŁUCH — aktywuj przez 3 sekundy, wyjaśnienie sprint-and-listen
- Faza 4: SONAR AKTYWNY — wyślij ping [Q], wyjaśnienie ryzyka wykrycia
- Faza 5: TORPEDA MK.48 — odpal i poczekaj na trafienie (łączenie kroków 6+7)
- Ekran zakończenia wyświetla brief Operacji Neptun przed startem misji
- Nowe intro: "ORP KONDOR — ĆWICZENIA BOJOWE · STREFA ĆWICZEŃ C-7"

**MissionSystem.js — nowa Misja 1: Operacja Neptun:**
- `startMission1(targetEnemy)` — przyjmuje konkretny obiekt wroga jako cel
- Cel 1: namierz BPK «NIEUSTRASZONY» (klasyfikacja sonarowa WARSHIP/SURFACE)
- Cel 2: zatop BPK «NIEUSTRASZONY»
- `onEnemyDestroyed(enemy)` — reaguje tylko na cel misji
- Usunięto `onMerchantDestroyed` — nie ma już konwoju cywilnego w Misji 1

**GameScene.js:**
- `_startMission1Combat()` — spawni BPK «NIEUSTRASZONY» 2800-3600px od gracza (losowa strona)
  zamiast konwoju 6 statków handlowych; wolniejszy patrol (×0.65) dla czasu na polowanie
- Escort pojawia się po 35s (opóźniony spawn)
- `mission?.onEnemyDestroyed(target)` podpięty do trafień torpedą i rakietą
- `_shipLog` z nową nazwą: "ORP KONDOR — gotowość bojowa"

---

## [0.10.73] — 2026-05-22

### Zmieniono — Przywrócono i zoptymalizowano samouczek gracza

**src/GameScene.js:**
- Przywrócono `_startTutorial()` jako domyślny punkt startowy (bez zapisu — uruchamia tutorial)
- Usunięto komentarz TYMCZASOWO i wywołanie `_spawnTestEnemies()` na ścieżce normalnego startu

**src/TutorialMission.js:**
- Krok 5 (IDENTYFIKACJA CELU): dodano `onEnter` ustawiający head-start `classifyTimer=6` — klasyfikacja nie wymaga już ~20s czekania od zera
- Krok 5: zaktualizowano opis — wyjaśniono że [Spacja]/NASŁUCH przyspiesza klasyfikację 2×; dodano binding
- Krok 5: `check` akceptuje teraz zarówno `SURFACE` jak i `MERCHANT` (wcześniej zatrzymywał się przy `SURFACE` nawet jeśli cel już awansował)
- Krok 6 (TORPEDA MK.48): przepisano intro — usunięto redundancję, dodano wzmiankę o [E] i [PPM]
- Krok 7 (TORPEDA W DRODZE): usunięto martwe referencje do `[M]` (mapa taktyczna usunięta w 0.10.x); zastąpiono PPI i pingiem [Q] jako metodą śledzenia torpedy
- Krok 7: usunięto `M` z listy klawiszy karty zadania

---

## [0.10.72] — 2026-05-22

### Zmieniono — AI wrogów v3: role grupowe, velocity lead, sektory SEARCH

**src/Enemy.js:**
- `_assignEnemyRoles()` przeniesione z GameScene — metoda przydziału ról taktycznych
- HUNT movement — BLOCKER blokuje przewidywaną trasę ucieczki (4s dead-reckoning subVX)
- HUNT movement — LISTENER utrzymuje optymalny dystans sensoryczny 400–900px
- HUNT movement — DRIVER/SOLO: dwufazowy sprint (×1.18 < 3s kontaktu, ×0.52 > 6s)
- SEARCH case — sektorowy sweep oparty na `_searchSide` ('left'/'center'/'right'), max swing 240–400px
- `_updateASROC()` — velocity lead: `leadX = lastKnownSubX + _lastKnownVX * flightTime * 0.72`, `leadY` z `_lastKnownVY * 0.55`
- `_dropPattern()` — blend `_lastKnownVY` z bieżącym `sub.vy` do predykcji głębokości zarzutów (blend 55/45)

**src/GameScene.js:**
- `_assignEnemyRoles()` — co 1.5s przydziela role: DRIVER (najbliższy), BLOCKER (drugi, blokuje ucieczkę), LISTENER (pozostałe)
- Podział sektorów SEARCH między okręty w trybie SEARCH (left/center/right sortowane po X)
- `_roleTimer` — throttle 1.5s między przeliczenimi ról

---

## [0.10.71] — 2026-05-22

### Dodano — Pełne tłumaczenie gry (PL/EN)

**src/MissionSystem.js:**
- Import `t as tr`, `tf` z `./i18n.js`
- Zmiana struktury `active`: `name` → `nameKey`, `text` → `textKey` na celach
- Wszystkie hardkodowane stringi misji zastąpione kluczami i18n: `mis1_name`, `mis1_obj_detect/destroy/destroy_prog`, `mis1_start_log`, `mis1_detected`, `mis1_sunk`, `mis_complete`, `mis_complete_star`, `mis_end_text`
- `_updateUI()` używa `tr(obj.textKey)` i `tf()` do wyświetlania nazwy i celów
- `_showEndScreen()` — tytuł i opis tłumaczone w czasie rzeczywistym

**src/GameScene.js:**
- `tr('bb_ready')` zamiast `'GOTOWY'` dla pingu HUD

**src/i18n.js:**
- Nowe klucze: `ds_status_dmg/deg/crit`, `peri_submerged`, `peri_fc_scan`, `peri_sinking`, `peri_too_deep/no_signal/surface_hint/inactive`, `log_sys_active`, `ws_fire_hdr`

**index.html — skrypty inline:**
- `_ssUpdateContactList()` — klasyfikacja (`cls_warship/merchant/surface/unknown`), trend (`trend_closing_s/opening_s`), liczba śledz. (`sonar_tracking`), brak kontaktów (`sonar_no_contacts`)
- `_ssUpdateDemonMode()` — tryby sonaru (`sonar_listen_mode/active_mode/pas`)
- `_ssUpdateBadges()` — liczba kontaktów
- `_dsUpdateHeader()` — status panelu awarii (`ds_status_crit/dmg/deg/ok`)
- `_dsUpdateCondition()` — kadłub/bateria/tlen (wszystkie klucze hull_*/bat_*/oxy_*)
- `_dsUpdateLog()` — brak awarii (`ds_no_damage`)
- `_psUpdateContactList()` — typy w polu widzenia, brak kontaktów, tonie (`peri_sinking`)
- `_psUpdateTDC()` — brak celu (`peri_no_target`)
- `_psUpdateESM()` — brak emisji (`peri_no_esm`)
- Peryskop: status zanurzony/aktywny, badge PERYSK
- Canvas peryskopu: tekst na ciemnym ekranie (`peri_too_deep/no_signal/surface_hint/inactive`)
- FC radar ESM: `sonar_active_mode`/`peri_fc_scan`

**index.html — statyczne atrybuty data-i18n:**
- Sonar: nagłówki wodospadu, kontaktów; badge nasłuchu
- Peryskop: nagłówki optyki/kontaktów/TDC/ESM; etykiety TDC (BRG/SPD/AOB/RNG/SOL); kurs obserwacji; STATUS/POWIĘKSZENIE
- Stacja broni: nagłówek, zabezp. zdjęte, rury torpedowe, status GOTOWA (4×), zapasy, TORPEDY/RAKIETY/WABIE, sterowanie ogniem
- Stacja awarii: tytuł panelu, status operacyjny, etykiety kondycji (KADŁUB/BATERIA/TLEN), podpisy stanu (INTEGRALNY/PEŁNA/NORMA), brak awarii
- Dolny pasek: A.SONAR, FALA, PERYSK (jako spany z data-i18n), GOTOWY na pingu
- System aktywny w logu bocznym

---

## [0.10.70] — 2026-05-22

### Dodano — System i18n (wybór języka PL/ANG)

**src/i18n.js** (nowy):
- Słownik ~75 kluczy × 2 języki (PL/EN)
- `t(key)` — tłumaczenie z fallbackiem do PL
- `setLang(code)` — ustawia aktywny język, zapisuje do `window._currentLang`
- `applyI18n()` — aktualizuje wszystkie `[data-i18n]` elementy DOM

**src/Menu.js:**
- Import `t`, `setLang`, `applyI18n` z `./i18n.js`
- `_settingsDefs` refaktoryzacja: `label` → `labelKey`, `section` → klucz i18n
- Nowa sekcja `// JĘZYK` z opcjami `POLSKI` / `ENGLISH`
- `_buildSettingsHTML()` — generuje `data-i18n` atrybuty na każdym elemencie
- `buildMenuHTML()` — menu items z `data-i18n` na etykietach
- `_showSettings()` / `_hideSettings()` — używają `t()` i `dataset.i18n`
- Nowa metoda `_applyLanguage()` — wywołuje `setLang()` + `applyI18n()`
- Zmiana języka w ustawieniach natychmiast aktualizuje cały DOM

**index.html:**
- `data-i18n` dodane do: stacje (CONN/SONAR/PERYSKOP/BROŃ/SLBM/AWARIE), top bar (`tb_class`, `tb_patrol`), panel lewy (NAMIERZANIE, 6 etykiet, MISJA), sterowanie (10 opisów + 2 nagłówki), HUD dolny (9 etykiet: GŁĘBOKOŚĆ/PRĘDKOŚĆ/BALAST/HAŁAS/KADŁUB/BATERIA/TLEN/TORPEDY/RAKIETY/WABIA), radio overlay (nagłówek, OD/DO/UTC labels, dismiss hint)

**src/GameScene.js:**
- Import `applyI18n`; wywołanie w `create()` — stosuje język przy starcie gry

---

## [0.10.69] — 2026-05-22

### Usunięto — mapa taktyczna [M]

**src/GameScene.js:**
- Usunięto inicjalizację `_mapGfx`, `_mapTxt`, `_mapKmTxt`, `_mapOpen`, `_playerTrail`, `_trailTimer`
- Usunięto binding klawisza `M` z `this.keys`
- Usunięto nagrywanie trasy gracza co 2s
- Usunięto toggle M + wywołanie `_drawTacticalMap()` z pętli update
- Usunięto metodę `_drawTacticalMap()` (230 linii)

**index.html:**
- Usunięto CSS `#eam-map-cv`
- Usunięto wiersz `M — Mapa taktyczna` z listy sterowania

---

## [0.10.68] — 2026-05-21

### Dodano — System łączności radiowej VLF/ELF
rrier (USS Enterprise CVN-65), kal_context, orion_warning (P-3C), able_archer (FLASH!), weather, friendly_forces (K-324), petrov (incydent Pietrowa), rtb
  - Event-triggered (3): first_contact (pierwsze HUNT wroga), torpedo_hit (trafienie ASROC), merchant_sunk
- Efekt maszyny do pisania (22 znaki/s); `R` pomija/potwierdza; kliknięcie = to samo
- Wiadomości kolejkowane — pokazują się jedna po drugiej
- Po odebraniu: wpis w dzienniku pokładowym z tagiem `[VLF]`

**src/RadioComms.js** (nowy plik):
- Pula 12 wiadomości osadzonych w realiach zimnej wojny 1983:
  - Timed (8): patrol_start, nato_ca
**index.html:**
- `#radio-overlay` — terminalowy overlay VLF w stylu fosforowym (zielony na czarnym), aktywny przez CSS `.active`; z-index 160 (nad stacjami)
- `#radio-badge` (`◈ VLF`) — migający wskaźnik w top barze przy nadchodzącej transmisji
- CSS: scanlines na terminalu, glowy, animacja kursora, efekt fade-in wskazówki potwierdzenia

**src/GameScene.js:**
- Import i inicjalizacja `RadioComms` w `create()`
- `_radio.update(dt)` w głównej pętli
- Triggery eventów: HUNT → `first_contact`, trafienie ASROC → `torpedo_hit`, zatopienie merchanty → `merchant_sunk`

---

## [0.10.67] — 2026-05-21

### Naprawiono — przycisk ← POWRÓĆ w ustawieniach

**src/Menu.js:**
- Przycisk `← POWRÓĆ` przeniesiony ze stopki do nagłówka panelu (`#menu-panel-hint`) — stopka była przykryta przez `#menu-bottom` (z-index: 10), co blokowało kliknięcia
- Przycisk w nagłówku zawsze widoczny i klikalny niezależnie od długości listy ustawień

---

## [0.10.66] — 2026-05-21

### Usunięto — przycisk "WYNURZ" z menu głównego

**src/Menu.js:**
- Usunięto pozycję `{ key: 'exit', label: 'WYNURZ', code: 'ESC' }` — niepotrzebna w grze przeglądarkowej

---

## [0.10.65] — 2026-05-21

### Dodano — Ustawienia grafiki

**src/Menu.js:**
- Nowa sekcja `GRAFIKA` w panelu ustawień (F5) z nagłówkami sekcji `// ROZGRYWKA` i `// GRAFIKA`
- **Cząsteczki** — trzy poziomy: Niskie (×0.35) / Normalne (×1.0) / Wysokie (×1.70)
- **Wstrząsy kamery** — Wł. / Wył. (eliminuje tresączkę przy explozjach)
- **Efekt CRT** — Wł. / Wył. (ukrywa scanlines na canvas i w menu)
- `_buildSettingsHTML()`: przepisany — obsługuje właściwość `section` jako nagłówki grupujące
- `_applyGraphicsSettings()`: nowa metoda — synchronizuje `#menu-scanlines` + klasę `.no-crt` na `<body>`
- CSS: dodano `.ms-section-hdr` i `.ms-section-gap`

**src/ImpactFX.js:**
- `_spawnSurface()`: `fxMax` i `smMax` skalowane przez `window._gameSettings?.particles ?? 1.0`
- `trigger()` / `triggerMissile()`: wstrząs kamery chroniony przez `window._gameSettings?.cameraShake !== false`

**src/GameScene.js:**
- `_shake(duration, intensity)`: nowy helper — respektuje `cameraShake === false`; wszystkie 10 wywołań `cameras.main.shake()` zastąpione
- Naprawiono rekurencję w `_getCfg()` — zmieniono `this._getCfg()` na `this.registry.get('settings')`

**index.html:**
- CSS: `.no-crt #game-shell::before { display: none; }` — wyłącza scanlines na grze gdy efekt CRT jest wyłączony

---

## [0.10.64] — 2026-05-21

### Dodano — Menu główne: panel ustawień gry

**src/MenuScene.js:**
- Nowy panel `USTAWIENIA GRY` poniżej wyboru trudności
- **Konwój** — wybór liczby kupców: 2 / 4 / 6 statków (domyślnie 4)
- **Amunicja** — Standardowa / Nieograniczona (torpedy ładują się w 2s, rakiety i wabie bez limitu)
- **Do kontaktu** — opóźnienie pojawienia się niszczycieli: 15 sek. / 1 minuta / 5 minut
- Kliknięty przycisk podświetla się na zielono, pozostałe są wygaszone
- Ustawienia przekazywane przez `registry.set('settings', {...})` do GameScene
- Poprawiono briefing: okręt K-244 «NALIM» klasy Kilo, rok 1984, Morze Norweskie
- Dodano F1–F5 do listy sterowania
- Lekko zmniejszono panele L/P żeby zmieścić ustawienia bez przepełnienia

**src/GameScene.js:**
- Czyta `settings.merchants` → dynamiczna lista CONVOY_ALL (2/4/6 kupców; nowe: IRKUTSK, VLADIVOSTOK)
- Czyta `settings.enemyDelay` → dynamiczny próg spawnu niszczycieli
- Czyta `settings.infiniteAmmo` → ustawia `sub.infiniteAmmo`

**src/Submarine.js:**
- Nowe pole `infiniteAmmo = false`
- `fireTorpedo()`: przy `infiniteAmmo` przeładowanie rury = 2s zamiast 55–75s
- `deployNoisemaker()` + `fireMissile()`: przy `infiniteAmmo` skip decrementu liczników

---

## [0.10.63] — 2026-05-21

### Dodano/Zmieniono — Peryskop: TDC, ESM, sylwetki, nocny tryb, winieta

**src/GameScene.js:**
- `visualContacts` uzupełniony o pola `dir` i `spd` (kierunek ruchu i prędkość z `patrolSpeed`)

**index.html — CSS:**
- Nowe style: `#ps-tdc-panel`, `.ps-tdc-grid`, `.ps-tdc-cell`, `.ps-tdc-val`, `#ps-tdc-sol-row`
- Nowe style: `.ps-esm-row`, `.ps-esm-id/sig/bar/dst`
- Nowy przycisk `#ps-night-btn` z efektem hover/active

**index.html — HTML:**
- Przycisk NOC w nagłówku peryskopowym (obok głębokości)
- **TDC panel** — Komputer Danych Celu: namiar (BRG), prędkość, kąt natarcia (AOB), zasięg, namiar strzału
- **ESM panel** — funkcjonalny (zastąpił "PROTOTYP"): emisje X-pasmo (nawigacja) i I/J-pasmo (radar ognia) dla okrętów wojennych, słupki siły sygnału, odległość

**index.html — JS:**
- Nowe zmienne stanu: `_pNightMode`, `_pBrgHistory`, `_pBrgHistTick`, `_psTDC`, `_psEsmList`, `_psNightBtn`
- Klawisz N — przełącznik trybu nocnego (CSS filter: sepia+hue-rotate = zielony fosfor)
- `_psDrawShip()` — nowa szczegółowa sylwetka okrętu: kadłub trapezoidalny z dziobem/rufą, nadbudówki, komin z animowanym dymem, wieże działowe z lufami, obracający się radar, ślad za rufą (wake); merchant: dźwigi, mostek, wolniejszy radar nawigacyjny
- `_psDrawOptic()` przepisany: winieta soczewkowa, nocny filtr CSS, rangefinder-brackets na wybranym kontakcie (złote narożniki), linia stadiametrii 500m/1km/2km/3.5km, wywołanie `_psDrawShip()` per kontakt
- `_psUpdateTDC()` — AOB z kierunku celu, prędkość w węzłach, namiar strzałowy z kątem wyprzedzenia torpedy
- `_psUpdateESM()` — słupki siły sygnału, dynamiczne oznaczenie FC (aktywny/skan), wywołane z `periscopeLoop`

---

## [0.10.62] — 2026-05-21

### Zmieniono — Rakieta p/okrętowa: ImpactFX również przy chybieniu

**src/Missile.js:**
- Dodano flagę `recentExplosion` (reset do `false` każdą klatkę, ustawiany w `_explode()`)
- Guard w `_explode()` — wyklucza podwójne wywołanie
- Usunięto `_drawExplosion()` (prymitywne kółka) — ImpactFX przejmuje całą wizualizację
- Usunięto `_drawExplosion()` z `_draw()` — rakieta po eksplozji rysuje tylko zanikającą smugę dymu

**src/GameScene.js:**
- Przy `mis.recentExplosion && !mis.recentHit` → `_impactFX.triggerMissile(mis.x, mis.y)` + shake
- Zarówno trafienie jak i chybienie/wyczerpanie zasięgu używają tej samej animacji ImpactFX

---

## [0.10.61] — 2026-05-21

### Dodano — Wybuch rakiety p/okrętowej: ImpactFX dostosowany do ASM

**src/ImpactFX.js — nowa metoda `triggerMissile()`:**

- Wymuszony tryb `surface` (nie underwater) — rakieta trafia w kadłub nad wodą
- Fireball ×1,65 więcej cząsteczek, większy rozmiar (r 34–82px vs 28–66px), dłuższa żywotność (do 1,85s)
- Słup wody ×0,45 mniej — rakieta trafia w stalowy kadłub, nie w otwartą wodę
- Dym ×1,55 więcej, 80% oleisty czarny (vs 55%) — paliwo rakietowe i olej napędowy
- Pożary wtórne: 18 ognisk zamiast 10, rozkład do 460px (vs 340px), większe rozmiary (9–22px)
- Ogień przy tafli ×1,35, rozkład do 130px (vs 90px)
- 4 wybuchy wtórne zamiast 3 (0,9s / 2,8s / 5,2s / 8,0s) — sekwencyjne eksplozje pomieszczeń okrętu
- Shake 0,020 (vs 0,018 torpedy) — cięższy uderzenie nawodne

**src/GameScene.js:**

- Trafienie rakietą wywołuje `_impactFX.triggerMissile(target.x, target.y)` zamiast samego shake/flash
- Flash zmieniony na pomarańczowo-biały `(255, 180, 50)` (vs niebieskawy torpedy)

---

## [0.10.60] — 2026-05-21

### Dodano — EAM: animacja namierzenia celu od Dowódstwa przed SLBM

**index.html — nakładka `#slbm-eam-overlay`:**

- **Przycisk "◈ ODBIERZ ROZKAZ CELOWANIA"** w prawym panelu SLBM — inicjuje sekwencję EAM (Emergency Action Message)
- **5 faz automatycznych** z wizualizacją czasu rzeczywistego i wskaźnikami postępu (5 kropek):
  1. **ODBIÓR ELF/VLF** — animowany szum sygnału → czysty sygnał, typewriter linii statusu szyfrantu, SNR rosnące do 89%
  2. **DESZYFROWANIE** — zaszyfrowane bloki (`NK22-ALFA-LIMA-74RR`...) → typewriter pełnego rozkazu bojowego (`ROZKAZ BOJOWY NR 071-A · OPERACJA: PAŹDZIERNIK · PKTU-7/26-ALFA...`)
  3. **UWIERZYTELNIENIE** — porównanie kodu EAM z kartą pieczętną PKP, weryfikacja PAŁ, komunikat `CHEGET: POŁĄCZENIE AKTYWNE`, zielone `██ ZGODNOŚĆ ██`
  4. **PAKIET CELÓW** — mapa świata (Canvas 2D): kontury kontynentów, pozycja K-244, cel `CEL-α` z przerywanymi łukiem trajektorii 9840km, belka z parametrami `PKTU-7/26-ALFA · h=1200km · CEP: 38m · 10×MIRV 500kT`
  5. **POTWIERDZENIE BOJOWE** — dwa niezależne przyciski `DOWÓDCA (KDT)` + `POL.ŚR. (XO)` — oba wymagane; po kliknięciu zmień kolor na zielony
- **Blokada operacyjna** — silosy nieaktywne, ARM/FIRE zablokowane do czasu `EAM.done`; `refreshBtns()` i `selTube()` sprawdzają flagę
- **Integracja z logiem** — każda faza generuje wpisy w dzienniku SLBM
- Po potwierdzeniu: nakładka znika (fade 1,4s), przycisk zmienia się na `◈ ROZKAZ POTWIERDZONY`, silosy odblokowane

---

## [0.10.59] — 2026-05-21

### Zmieniono — Ulepszony system wystrzeliwania SLBM

**index.html — nowy IIFE SLBM v2:**

- **Multi-select silosów** — możliwość zaznaczenia wielu silosów naraz (kliknięcie toggle); zaznaczone wyświetlane z czerwoną elipsą na canvasie
- **Salwa wielu silosów** — UZBRÓJ zbroi wszystkie zaznaczone; ODPAL kolejkuje starty z przerwą 1,8s; pasek misji wyświetla `T+1.2 · SALWA 2/4`
- **Integracja z grą** — `spawnMissile()` wywołuje `window._slbmLaunch()` → rakieta pojawia się w widoku CONN; wstrząs kamery i flash przy przebijaniu powierzchni
- **Lepsza animacja** — `rings[]` (rozszerzające się elipsy przy tafli), `steam[]` (kolumna białej pary), 100 cząsteczek rozbryzgu wody
- **Fix literówki** `slvo.queue` → `salvo.queue` w `doAbort()`

**src/GameScene.js — nowe metody:**

- `_spawnSLBMMissile()` — tworzy obiekt rakiety (fazy: eject → underwater → breach → boost → gone), wstrząs kamery 280ms
- `_updateSLBMMissiles(dt)` — symulacja fizyki i renderowania rakiety na canvasie gry przez `_slbmGfx`
- `window._slbmLaunch` — bridge HTML→Phaser

---

## [0.10.58] — 2026-05-21

### Dodano — Stacja SLBM (F5) — Panel wystrzeliwania rakiet balistycznych

**index.html — nowa stacja F5:**

- **Zakładka F5 SLBM** w górnym pasku stacji (zamiana placeholdera NAWIGACJA)
- **Canvas wizualizacja** (lewa strona): okręt klasy Typhoon na głębokości ~50m, nocna scena, 20 silosów RSM-52 na grzbiecie, animacja światła nawigacyjnego, śruba 5-łopatowa
- **20 silosów RSM-52 «Woiewoda»** w siatce 5×4 — 16 załadowanych, 4 puste (dziobowe); klikalne z LED statusu (zielony/bursztyn/czerwony)
- **Dwa klucze bojowe** — DOWÓDCA + POL.ŚR. — oba muszą być przekręcone aby uzbroić
- **Ograniczenia realistyczne** — odpalenie dostępne tylko przy głęb. ≤ 55m i prędkości ≤ 6kn (live z `window._sonar`)
- **Sekwencja odpalenia**: UZBRÓJ → T−10 odliczanie z logami (otwarcie pokryw, giroskopy, akumulatory, trym, ciąg) → ODPALENIE → misja
- **Animacja rakiety** canvas 2D: faza silosowa (gaz startowy, bąble) → podwodna (ślad bąbli) → przebicie powierzchni (splash 90 cząsteczek) → boost (ogień silnika additive, dym wielowarstwowy) → poza horyzont
- **Pasek ostrzegawczy** — czerwona belka gdy warunki głębokość/prędkość nie są spełnione
- **Dziennik log** z timestampami T±MM:SS
- **Parametry okrętu live** — głębokość i prędkość aktualizowane na bieżąco ze stanu gry

---

## [0.10.57] — 2026-05-21

### Zmieniono — Sprite gracza: pixel art Kilo-class K-244 «NALIM» (16-bit)

**Submarine.js — zamiana sprite'u Béziera na pixel art:**

- **Kadłub pixel art** renderowany kolumna po kolumnie przez `fillRect(x,y,1,1)` — profil cygarowy Kilo-class z funkcją `hullH(x)` zamiast krzywych
- **Paleta 16-bit** (6 odcieni stali: hullDark / hullMid / hullLight / hullEdge / hullHi; red / redDim / amber / green)
- **Animacja 14 fps** — zegar `_frameIdx` / `_frameT` w `update()` napędza efekty czasowe
- **Kiosk trapezoidalny** z portholami, pionowymi krawędziami i blokiem kominkowym
- **Peryskop + antena radarowa + maszt snorchla** (widoczne < 40m głębokości); mrugająca soczewka ambra (co 28 klatek)
- **Światło nawigacyjne czerwone** na kiosku mruga co 14 klatek (7 on / 7 off)
- **Śruba 6-fazowa** animowana jako tablice `fillRect`; kolor jasny przy kawitacji
- **Drzwi wyrzutni** otwierają się animacyjnie przy odpaleniu torpedy (`doorOpenFraction`)
- **Wskaźnik gotowości wyrzutni** — zielony piksel przy dziobie gdy rura załadowana
- **Uszkodzenia kadłuba** — rysy i migające piksele przy hull < 0.6 / 0.3
- **Efekty systemów** — dym silnika przy naped.health < 0.65, bąble balatsu przy balast.health < 0.55
- **Cień przy powierzchni** — piskselowy cień pod łodzią gdy depthMetres < 3
- **Zmiana kolorystyki przy głębokości** — paleta ciemniejsza gdy depth > 80m

---

## [0.10.56] — 2026-05-21

### Zmieniono — Sprite gracza: okręt klasy Kilo (Projekt 877) — Bézier (zastąpione przez 0.10.57)

**Submarine.js — kompletna wymiana sprite'u kadłuba:**

- **Kadłub Kilo-class** narysowany krzywymi Béziera (Phaser `bezierCurveTo`) zamiast uproszczonego wielokąta
- Dziób zaokrąglony z asymetrycznym profilem (x -300 → +310, skala 0.20 → ~122px)
- Górny i dolny highlight gradient aproksymowany elipsami (efekt księżycowego światła na stali)
- Nity/linie poszycia — 14 pionowych kresek co 38px wzdłuż kadłuba
- **Kiosk (sail)** z krzywymi Béziera, highlight boczny, okienko radarowe
- **Stery głębin kiosku** (fairwater planes) — trapezoidalne, po lewej stronie kiosku
- **Maszty przy małej głębokości** (<40m): peryskop z migającą soczewką, antena radarowa z talerzem, maszt snorchla ze wskaźnikiem ładowania
- **Stery rufowe**: poziomy sterołan + dwa pionowe (górny i dolny) — trójkątne płetwy
- **Śruba 5-łopatowa** z perspektywą z boku: łopaty jako elipsy o zmiennej szerokości (abs(cos(ang))), 5 faz obrotu
- Pozycja kawitacji zaktualizowana do nowej długości kadłuba (62px od środka)

---

## [0.10.55] — 2026-05-20

### Zmieniono — Podwodna fizyka wybuchu (dwa tryby ImpactFX)

**ImpactFX.js — kompletny rewrite logiki dwutryboowej:**

**Tryb `surface`** (wybuch przy tafli, bez zmian wizualnych):
- Fireball, słup wody, dym, para, iskry, oil fires, ogień przy tafli

**Tryb `underwater`** (wybuch pod wodą lub przy dnie — nowa logika):
- **Brak kuli ognia** — pod wodą nie ma tlenu do spalania
- **Fala ciśnienia** (`_drawUnderwaterPressureWave`): niebieskie pierścienie rozchodzące się od punktu wybuchu przez wodę (prędkość 520/330/190 px/s)
- **Bąble gazowe** (`bubbles`): 80 cząsteczek unoszących się z dna ku tafli; gorące tuż po wybuchu (żółte, additive), potem przezroczyste niebiesko-białe z konturem
- **Osad denny** (`sediment`): 100 cząsteczek brunatno-szarego mułu rozchodzących się poziomo przy dnie (grzybek eksplozji)
- **Opóźnienie tafli** (`surfDelay = depth/130s`): efekty na powierzchni (fale eliptyczne, ogień paliwowy, dym, iskry) pojawiają się dopiero gdy bąble dobijają do tafli
- **Mniejszy ogień na tafli** — paliwowy, nie wybuchowy; brak oil fires przy eksplozjach podwodnych
- **Odłamki** z mniejszą grawitacją efektywną (wypornność wody spowalnia opadanie)
- Mocniejszy screen shake (`0.018` vs `0.012`) — podwodny wybuch jest głuchszy ale mocniejszy

---

## [0.10.54] — 2026-05-20

### Zmieniono — ImpactFX przy chybieniu torpedy (tafla / dno)

**GameScene.js:**
- Po każdej klatce sprawdzana flaga `torpedo.recentExplosion && !torpedo.recentHit` — gdy torpeda uderza w taflę wody lub dno (chybienie), wyzwalane jest `impactFX.trigger(t.x, t.y)` z lekkim screen shake 180ms
- Dotyczy wszystkich przypadków wygaśnięcia torpedy: uderzenie w powierzchnię, w dno, przekroczenie zasięgu MAX_RANGE

**Torpedo.js:**
- Usunięto własny blok rysowania wybuchu w `_draw()` (proste kółka i fale) — ImpactFX całkowicie zastępuje animację
- Podczas `exploded === true` torpeda od razu zwraca bez rysowania czegokolwiek

---

## [0.10.53] — 2026-05-20

### Dodano — Ogień przy tafli wody po wybuchu torpedy

**ImpactFX.js — `surfaceFire` pool:**
- Po 0.28s od wybuchu pojawia się persystentny ogień przy tafli wody — pali się przez 3.5s
- Cząsteczki startują przy `surfY`, renderowane identycznie jak ogień na okrętach (3-warstwowe elipsy z sway)
- Zasięg ognia rozszerza się z czasem: `spread = 22 + min(t*28, 90)` — coraz szersza plama paliwa
- Fisica: unoszenie `vy -= 58*dt`, turbulencja `sin(life*7.2+seed)*14` — organiczny ruch
- `trigger(worldX, worldY)` używa teraz `worldY` — eksplozja przy dnie działa od właściwej głębokości, ogień i tak pojawia się przy tafli (palące się paliwo wypływa)

---

## [0.10.52] — 2026-05-20

### Zmieniono — Organiczny kształt ognia + redukcja migania

**Enemy.js — ogień na okrętach:**
- 3× więcej cząsteczek (spawn rate `*5` → `*18`), mniejszy rozmiar (`7+11` → `3+8`) — gęstsza masa bez widocznych pojedynczych kółek
- `_drawFireAdditive`: 3 kółka → 4 warstwy elips (szeroka podstawa → wąski czubek), sway `sin(life*3.8)` dla kołysania
- Iskry: sin-flicker zredukowany z 22 Hz do 6.5 Hz — brak szybkiego migania
- Ambient pulse: `Date.now()*0.0028` → `*0.0011` (wolniejsze, spokojniejsze tętnienie)

**ImpactFX.js — wybuch torpedy:**
- `_drawFire`: 3 kółka → 5 warstw elips z kształtem języka ognia i sway `sin(life*3.5+seed)`
- `_drawEmbers`: sin 24 Hz → 7.2 Hz, smuga nieznacznie krótsza
- `_drawOilFires`: sin 11 Hz → 4.2 Hz; kółka glow → elipsy; 4 → 5 warstw elips dla płomienia
- `_drawSecondary`: kule ognia → elipsy z falą uderzeniową `strokeEllipse`, czas trwania 0.85→1.0s

---

## [0.10.51] — 2026-05-20

### Zmieniono — Pełny restart ImpactFX: cząsteczkowy system wybuchu torpedy

**ImpactFX.js — kompletny rewrite wg `torpedo-explosion.js`:**

- **7 typów cząsteczek** na jedną eksplozję: ognista kula (fireball), słup wody + krople, dym, para, odłamki (22szt, 5 kształtów), iskry (embers), morskie iskry wody (seaSparks), płonące plamy oleju (oilFires — 10 szt., po T+1.4s)
- **Fizyka cząsteczek**: wypornność `vy -= 95*dt`, turbulencja `sin(life*9+seed)*28`, opór powietrza, grawitacja `G=460`, wiatr `WIND=-14`
- **Additive blending** (`fireGfx`, depth 9) dla ognistej kuli i iskier; normalny canvas (`gfx`, depth 8) dla wody i dymu
- **`fireColor(t)` / `fireAlpha(t)`** — temperatura wg wieku cząsteczki: biały-żółty → żółty → pomarańczowy → czerwony → ciemnoczerwony
- **Eliptyczne fale wodne** (4 pierścienie) na powierzchni morza z additive blending (`strokeEllipse`)
- **Podwodny glow** T+0..0.5s — 3-kołowe narastanie i zanikanie jasności
- **Flash ekranu** T+0..0.35s — jasna biała nakładka zanikająca
- **Odłamki** (22 szt.): 5 kształtów (line, tri, box, L, T), obrót, gorący glow na fireGfx gdy `hot===true`
- **Odbicie ognia oleju na wodzie** — elipsa pod każdą plamą oleju
- **Wybuchy wtórne** (`secondary`) — 3 opóźnione eksplozje w losowych pozycjach
- Czyste zarządzanie obiektem: jedno `hit` na `trigger()`, automatyczny czas życia 12s

**ROADMAP — zaktualizowane wiersze:**
- `Eksplozja na powierzchni` → rozszerzono opis o olej i wybuchy wtórne

---

## [0.10.50] — 2026-05-20

### Zmieniono — Jaśniejsza plansza + zegar w HUD

**Ocean.js — jaśniejsze kolory:**
- Strefa epipelagiczna (powierzchnia→termoklina): `#001e3d→#002a55` → `#00386e→#00528e` (+60% jasności)
- Termoklina: `#0a4a60` → `#1a6a80`
- Strefa mezopelelagiczna: `#001830→#000308` → `#002244→#000e1c` (jaśniejsza, nadal głęboka)
- Dno morskie: `#1c1008` → `#2c1c0c`
- Linijka głębokości: `#246655` → `#359966` (wyraźniejsza)

**Ocean.js — mniejsza ciemność nocna:**
- `dark` przy północy: 0.32 → 0.20 (o 37% mniej czarne nakładanie)
- `dark` przy późnej nocy: 0.26 → 0.16
- `dark` przy zmierzchu/świcie: 0.04 → 0.02
- Ciemność dzienna (południe/dzień) bez zmian: 0.00

**GameScene.js — start o godzinie 10:00:**
- `_dayTime` zmieniony z `0.0` (północ) na `0.42` (~10:00 rano)
- Gracz startuje przy pełnym świetle dziennym

**HUD — zegar:**
- Nowy element `hud-clock` w panelu bocznym (pod "Fala")
- Format `HH:MM` (tabular-nums, letter-spacing)
- Odzwierciedla `_dayTime * 24h` — żywy czas in-game
- Komenda `time` w DevConsole synchronizuje się z wyświetlanym czasem

---

## [0.10.49] — 2026-05-20

### Dodano — Ambient glow ognia + komenda `firetest`

**Enemy.js — ambient glow:**
- Ogień oświetla teraz otoczenie: duży pomarańczowy glow wokół kadłuba (240×80px)
- Intensywny glow przy każdym aktywnym ognisku (dziób/rufa/mostek) — skaluje się z `src.power`
- Dwa poziomy odbicia na wodzie: 400×16px i 560×9px — ciepła poświata na powierzchni
- Wszystko na additive `fireGfx` → naturalne sumowanie jasności z innymi efektami
- Glow pulsuje z czasem (`sin(Date.now() * 0.0028)`)

**DevConsole — `firetest [n]`:**
- Czyści wszystkich wrogów, spawuje N palących się okrętów (domyślnie 1, max 4)
- Każdy okręt: hull=8% (pełne inferno — aktywne wszystkie 3 strefy ognia)
- Wąski patrol (cx ±20px) — stationary, nie odpływają
- Sub tuż pod powierzchnią, god mode auto-on
- Wskazówki: `speed 0.3`, `boom 3 200`, `fire off`, `fire 0.4`

**Bugfix — wyciek pamięci przy niszczeniu Enemy:**
- `GameScene`: dodano `e.fireGfx?.destroy()` przy usuwaniu zniszczonych jednostek
- `DevConsole` `testmap` i `firetest`: również czyszczą `fireGfx`

---

## [0.10.48] — 2026-05-20

### Dodano — DevConsole: komendy OGIEŃ i BOOM

**`fire [0.4|0.3|0.1|off]`** — kontrola pożaru na wszystkich żywych wrogach:
- `fire 0.4` → hull 40% — lekki ogień (tylko dziób)
- `fire 0.3` → hull 30% — ciężki (dziób + rufa)
- `fire 0.1` → hull 10% — pełne inferno (dziób + rufa + mostek) *(domyślne)*
- `fire off` → hull 100%, czyści cząsteczki — gasi wszystkie pożary

**`boom [n] [spread]`** — wyzwala eksplozje ImpactFX w centrum sceny:
- `boom` → 1 wybuch centralnie
- `boom 5` → 5 wybuchów (spread ±180px)
- `boom 3 400` → 3 wybuchy z własnym spread ±400px

Sekcja `── EFEKTY WIZUALNE ──` dodana do `help`.

---

## [0.10.47] — 2026-05-20

### Zmieniono — Animacja ognia: cząsteczkowy system z additive blending

Wzorowane na standalone animacji `Płonący Okręt.html` (ship-burning.js):

**Architektura:**
- Oddzielny `fireGfx` (`setBlendMode(Phaser.BlendModes.ADD)`) — additive blending
  tworzy bloom/glow przez nakładanie się cząsteczek (jasność sumuje się)
- `_fireParts[]` + `_emberParts[]` — prawdziwy system cząsteczkowy (nie deterministyczny)

**Enemy.js — ogień palącego się niszczyciela:**
- `_getFireSources()` — aktywne źródła ognia zależne od hull (dziób <0.50, rufa <0.35, mostek <0.20)
- `_updateFireParts(dt)` — spawn w world-space + fizyka: `vy -= 65·dt` (unoszenie), turbulencja `sin(t·7.4)`, drag
- `_drawFireAdditive()` — 3 koncentryczne kółka per cząsteczka (glow dark-red → mid orange → core white/yellow)
  kolor rdzenia zależny od wieku (t<0.25 biały, t<0.55 żółty, t<0.80 pomarańczowy, potem czerwony)
- Iskry: migotanie `sin(life·22)`, żółte → pomarańczowe z wiekiem
- `GameScene.js`: `e.fireGfx.x = -camX` (ręczna kamera)

**ImpactFX.js — ogień po trafieniu torpedy:**
- `_updateImpactFire(h, dt, t, camX)` — łączy spawn, fizykę i rysowanie w jednej metodzie
- Cząsteczki przechowywane per-hit: `h.fireParts[]`, `h.emberParts[]` (world-space)
- 3 pule źródłowe wzdłuż plamy oleju (power: 0.90/1.25/0.80)
- Render w screen-space: `sx = p.x - camX` (bez osobnego gfx.x offsetu)
- Usunięto stare `_drawFlamePool()` i `_drawFire()` oparte na elipsach

---

## [0.10.46] — 2026-05-17

### Zmieniono — Animacja ognia i płomieni

**Enemy.js — ogień przy uszkodzeniach:**
- Zastąpiono proste kółka nowym helperem `_drawFlame(g, cx, cy, ht, intensity, t, phase, alpha)`
- Płomień składa się z 4 warstw elips: żółty rdzeń → pomarańczowy środek → ciemnoczerwona podstawa → żółty czubek
- Każda warstwa ma niezależne kołysanie (`sw`) i migotanie (dwa sinus o różnych fazach)
- Iskry z mostka: 6 zamiast 4, dwa kolory (żółty/pomarańczowy), trajektoria wyższa (+30px)
- Poświat przy krytycznych uszkodzeniach: silniejszy (0.10, elipsa 90×35 zamiast 70×30)

**ImpactFX.js — ogień po wybuchu torpedy:**
- Nowy helper `_drawFlamePool()` — identyczna architektura 4-warstwowa jak w Enemy
- 3 niezależne pule ognia wzdłuż plamy oleju (lewo/środek/prawo), różne fazy i intensywności (0.90/1.25/0.80)
- Deterministyczny system iskier: 14 cząsteczek generowanych z czasu (bez stanu), `sin(prog·π)` fade-in/fade-out
- Iskry różnokolorowe: żółte / pomarańczowe / czerwono-pomarańczowe (3 kategorie `i%4/i%3`)
- Czas życia ognia wydłużony: 20s → 21s, płynniejszy fade-in (`fireT * 0.75` zamiast `0.5`)

---

## [0.10.45] — 2026-05-16

### Dodano — Mapa testowa w DevConsole (`testmap`)

Komenda `testmap` w konsoli deweloperskiej (`~`) ładuje dedykowane środowisko testowe:

**Setup:**
- Okręt gracza teleportuje się na x=2000, głęb. ~240m (tuż pod termoklinem)
- Pełna regeneracja: hull/battery/oxygen=100%, wszystkie systemy naprawione, max ammo
- God mode włączony automatycznie, wave=1
- Wszyscy wrogowie zawsze widoczni (revealTimer=∞)

**5 stref taktycznych z nazwanymi wrogami:**
| Etykieta | Dystans | Stan AI | Cel testu |
|---|---|---|---|
| HEDGE-ZONE | +230px | 🔴 HUNT | hedgehog / RBU-6000 |
| DC-ZONE | +600px | 🔴 HUNT | zarzuty głębinowe |
| SONAR-MID | +1400px | 🟡 ALERT | sonar pasywny / triangulacja |
| ASROC-ZONE | +2900px | 🟢 PATROL | ASROC, śledzenie, nasłuch |
| LEFT-FLANK | −350px | 🟢 PATROL | flanka lewa, sonar, torpedy |

Każdy wróg ma wąski patrol (±280px) — nie odpływa podczas sesji testowej.

**Wizualne:**
- Pomarańczowy pasek na górze ekranu: „TRYB TESTOWY | god mode | wszyscy wrogowie widoczni"

**Dodatkowe komendy:**
- `resetmap` — wyłącza tryb testowy (god mode OFF, banner ukryty)
- Wszystkie komendy AWARIE (sys/attack/dmg/repair/sim) działają w testmap

---

## [0.10.44] — 2026-05-16

### Dodano — Hedgehog / RBU-6000: historyczna broń przeciw-okrętowa

Niszczyciel otrzymał wyrzutnik rakietowo-bombowy (Hedgehog Mk.10 / RBU-6000) — odmienną
taktycznie broń od zarzutów głębinowych:

**Mechanika:**
- Strzela **przed** okrętem (nie nad celem), gdy cel jest w zasięgu 90–340px i okręt się zbliża
- 10 pocisków w salwie, rozłożonych eliptycznie (±68px X, ±46px Y) wokół ostatniej pozycji
- **Kontaktowy zapalnik** — eksploduje tylko przy bezpośrednim trafieniu (r=20px), nie jest obszarowy
- Uszkadza: napęd × 2, torpedy × 2, zasilanie × 2 (trafienie śródokrętowe, inne niż ASROC)
- Cooldown: 24s (niezależny od zarzutów głębinowych i ASROC)
- Gracz nie musi się obawiać tylko gdy okręt jest bezpośrednio nad nim

**Wizualne:**
- Błysk odpalenia przy dziobie okrętu
- Smugi ognia w powietrzu podczas lotu (airborne)
- Blady żółty ślad pod wodą
- Mały błysk kontaktowy przy trafieniu

**DevConsole:** `attack hedgehog [%]` — symuluje trafienie hedgehogiem

---

## [0.10.43] — 2026-05-16

### Ulepszone — AI wrogów: akustyka, koordynacja, zarzuty

**Strefa ciszy akustycznej (shadow zone):**
Bezpośrednio pod niszczycielem (|dx| < 80px, dy > 30px) detekcja pasywna spada do 18% —
własna śruba zagłusza dziobowy hydrofor. Gracz może wykorzystać manewr „pod keel".

**Hałas własny prędkości:**
- HUNT (pełna prędkość): zasięg hydrofonu ×0.62 (-38%)
- ALERT (zbliżanie): zasięg ×0.83 (-17%)
- Nasłuch (sprint-and-listen): zasięg ×1.12 (+12%)
Manewr sprint-and-listen jest teraz znaczący w obie strony — gracz może uciec kiedy wróg pędzi.

**Natychmiastowe radiowanie kontaktu:**
Wejście w HUNT = natychmiastowy broadcast `receiveRadioAlert` do wszystkich sąsiednich okrętów.
Wcześniej koordynacja wymagała 18s — teraz jest błyskawiczna, wróg nie czeka.

**Ulepszony wzorzec zarzutów głębinowych:**
5 zamiast 3 zarzutów, w brackecie głębokości ±42px wokół predykowanej pozycji:
centrum, 2× flanka (głębiej/płycej), 2× blisko (głębiej/płycej).
Predykcja głębokości: `sub.vy × fallTime × 0.65` (było 0.42) — trafniejsza przy nurkujących łodziach.

**Agresywniejszy SEARCH:**
Spekulatywne zarzuty w fazie SEARCH: co klatkę prawdopodobieństwo 0.014 (było 0.007) — wróg
jest mniej pasywny w trakcie przeszukiwania rejonu.

---

## [0.10.42] — 2026-05-15

### Dodano — Komendy AWARIE w DevConsole

Pięć nowych komend w panelu deweloperskim (`~`):

- `sys` — wyświetla status wszystkich 8 systemów z paskiem█ i % zdrowia
- `attack <asroc|dc|floor|crush|tlen> [%]` — wywołuje `applyDamage()` z odpowiednim źródłem (domyślnie 25%)
- `dmg <system> [0-1]` — ustawia zdrowie konkretnego systemu (np. `dmg naped 0.3`)
- `repair [system|all]` — przywraca zdrowie systemu lub wszystkich do 100%
- `sim <scenariusz>` — pięć gotowych scenariuszy testowych:
  - `asroc` — 3 trafienia torpedą ASROC co 1.5s
  - `depth` — 8 zarzutów głębinowych co 0.6s
  - `barrage` — mieszany: 6 DC + 2 ASROC przez ~8s (naprzemienne typy)
  - `stress` — wszystkie systemy spadają do 20–40%, kadłub −35%
  - `critical` — losowy system zniszczony do 0%, trafienie ASROC

---

## [0.10.41] — 2026-05-16

### Naprawiono — 100% pokrycia źródeł obrażeń w sekcji AWARIE

Wszystkie 6 źródeł obrażeń teraz trafia do dziennika AWARII i uszkadza odpowiednie systemy:

- `applyDamage('KOLIZJA Z DNEM')` — uderzenie w dno (było: bezpośrednie `this.hull -=`)
- `_continuousHullDamage('TARCIE O DNO', naped/balast)` — tarcie przy poziomym ruchu po dnie (rate-limit: 8s)
- `_continuousHullDamage('BRAK TLENU', tlen/zasilanie)` — obrażenia przy wyczerpaniu O₂ (rate-limit: 8s)
- `_continuousHullDamage('PRZECIĄŻENIE CIŚNIENIOWE', balast/zasilanie/naped)` — głębokość kruszenia (rate-limit: 8s)
- `applyDamage('TORPEDA ASROC')` i `applyDamage('ZARZUT GŁĘBINOWY')` — już pokryte

Dodano `_continuousHullDamage(amount, source, weights)` — odpowiednik `applyDamage` dla źródeł ciągłych:
rate-limiter `_contDmgCooldowns` zapobiega spamowaniu dziennika (max 1 wpis / 8s / źródło).
Każdy wpis loguje uszkodzony system z wagami specyficznymi dla źródła.

Naprawiono błąd kodowania w regex `applyDamage` (GŁĘBINOWY → /ZARZUT/).

---

## [0.10.40] — 2026-05-15

### Dodano — Pełna integracja systemu awarii z rozgrywką

**Submarine.js — każdy system faktycznie wpływa na grę:**
- `sysMod(key, minAtZero)` — pomocnik zamieniający zdrowie systemu na modifier (0→minAtZero, 1→1.0)
- **NAPĘD**: `enginePower` ograniczony do `max(0.22, health)` w `_handleInput()`; siła ciągu skalowana w `_applyPhysics()`; niższy próg kawitacji przy uszkodzeniu; dodatkowy hałas akustyczny proporcjonalny do uszkodzeń; dym/olej z maszynowni (efekt wizualny)
- **BALAST**: szybkość zmiany balastu skalowana przez `max(0.06, health)` w `_updateBallast()`; niekontrolowany dryft przy `health < 0.25`; komendy balastowe słabną; nieregularne bąble z zaworów (efekt wizualny)
- **SONAR PASYWNY**: `sonarBonus` getter uwzględnia `sonarP.health` — zakres detekcji wroga spada do 15% przy awarii
- **SONAR AKTYWNY**: `_firePing()` zablokowany gdy `sonarA.health < 0.1` — komunikat AWARIA w dzienniku
- **TORPEDY**: dostępna liczba rur zależna od zdrowia (4/3/2/1/0); prędkość przeładowania skalowana przez `max(0.12, health)` — do 8× wolniej
- **RAKIETY**: odpalenie niemożliwe gdy `rakiety.health ≤ 0` — nowy kod zwrotny `'awaria'`
- **TLEN**: zużycie tlenu × `(1 + (1-health) × 2.8)` — do 3.8× szybsze
- **ZASILANIE**: hotel load × `(1 + (1-health) × 2.8)` — do 3.8× szybszy drain; max poziom baterii ograniczony do `max(0.42, health)`
- `applyDamage()` przepisany: ważone uszkodzenia systemów według źródła (`ASROC→torpedy/sonarA`, `ZARZUT→balast/tlen`, `KOLIZJA→naped/balast`); mniej drastyczne obrażenia (0.12–0.34 zamiast 0.4–0.9)

**GameScene.js:**
- Obsługa `result === 'awaria'` przy obu ścieżkach odpalenia rakiet (klik + klawisz R)

**index.html:**
- `_dsFlashHUD()` — miganie wskaźników HUD przy krytycznych uszkodzeniach systemów: prędkość→NAPĘD, balast→BALAST, bateria→ZASILANIE, tlen→TLEN, ping→SONAR-A, torpedy→TORPEDY, rakiety→RAKIETY

---

## [0.10.39] — 2026-05-15

### Zmieniono — Panel AWARIE: schemat SVG okrętu z kolorowymi strefami

**index.html:**
- Zastąpiono listę systemów pełnym widokiem bocznym okrętu (SVG, 128px)
- 8 stref kadłuba odpowiadających systemom: NAPĘD, ZASIL., TLEN, SON-P, BALAST, SON-A, RAK., TORP.
- Strefy przycinane clipPath do kształtu kadłuba ciśnieniowego
- Kolorowanie stref: transparent (OK) → amber (zdegr.) → czerwony (krit.) → mocna czerwień + blink (awaria)
- Kółka statusu pod etykietami stref — zielone/amber/czerwone/migające
- Elementy dekoracyjne: płetwy rufowe, śruba, kiosk z masztami, rury torpedowe, żebra kadłuba, kopuła sonaru, znacznik reaktora VM-A, linia wodna
- Dolna sekcja: kondycja (kadłub/bateria/tlen) w kolumnie po lewej + dziennik awarii po prawej
- `_dsUpdateZones(systems)` zastępuje `_dsRebuildSystems()`

---

## [0.10.38] — 2026-05-15

### Dodano — Panel AWARIE (stanowisko F6)

**Submarine.js:**
- Dodano `this.systems` — 8 śledzonych systemów okrętowych (napęd, sonar pasywny/aktywny, torpedy, rakiety, balast, tlen, zasilanie)
- Każdy system: `{ health: 1.0, label, emoji }`
- `applyDamage(amount, source)` — centralna metoda obrażeń: redukuje kadłub, uszkadza 1–2 losowe systemy, loguje zdarzenie do `_damageLog`

**GameScene.js:**
- Eksport do `window._sonar`: `hull`, `battery`, `oxygen`, `noise`, `systems`, `damageLog`
- Trafienie torpedą ASROC przechodzi przez `sub.applyDamage()` zamiast bezpośredniej redukcji `sub.hull`

**Enemy.js:**
- Obrażenia od zarzutów głębinowych kierowane przez `sub.applyDamage('ZARZUT GŁĘBINOWY')`

**index.html:**
- Nowa zakładka `AWARIE` (F6) — siatka 2-kolumnowa, czerwone tło
- Sekcja nagłówka: badge ogólnego statusu (OPERACYJNY / ZDEGRADOWANY / USZKODZONY / KRYTYCZNE)
- Wiersz kondycji: kadłub%, bateria%, tlen% z progami kolorów
- Lista systemów: ikona + nazwa + pasek postępu + badge (ok/deg/crit/fail z animacją blink)
- Dziennik awarii: ostatnie 20 zdarzeń z poziomami info/warn/crit
- `damageLoop()` — pętla 5Hz aktualizująca cały panel

---

## [0.10.37] — 2026-05-15

### Zmieniono — proceduralny model niszczyciela (Enemy.js)

Całkowita przebudowa grafiki okrętu z uproszczonych prostokątów na szczegółowy model:

**Kadłub:**
- Kształt wielokątowy (beginPath polygon): ostry dziób, schodkowy pokład, spłaszczona rufa
- Kopuła sonaru dziobowego (bulbous bow) pod linią wody
- Antyfouling (ciemny pas przy linii wodnej) + jasna linia wodnicowa
- Deski pokładowe forecastle i pokładu głównego z liniami planking

**Uzbrojenie i nadbudówki:**
- Wieżyczka dziobowa 127mm Mk.45 — barbeta + kadłub + podwójna lufa
- Wieżyczka rufowa 76mm — mniejsza, osobna sylwetka
- Mostek trójpoziomowy: podstawa nadbudówki, piętro, wieża DCT/CIC, okna
- Dwa kominy z żółtym paskiem identyfikacyjnym, osobny dym z każdego
- Wyrzutnie torpedowe poczwórne (4 rury z konturem)
- VLS ASROC ośmiokomórkowy z podświetlonym wskaźnikiem gotowości
- CIWS (działko Phalanx/AK-630) na śródo kręciu

**Maszty i wyposażenie:**
- Maszt trójnogowy z platformą obserwacyjną, obrotową anteną radarową i reją IFF
- Maszt rufowy z reją i reflektorem
- Zrzutniki głębinowe na rufie (4 tuby)
- Kotwica dziobowa z łańcuchem
- Relingi wzdłuż forecastle i rufy ze słupkami
- Windą kotwiczną (capstan)
- Lampki nawigacyjne: rufowa (czerwona), dziobowa (zielona), wierzchołkowa (biała)

**Efekty uszkodzeń (Enemy.js + Merchant.js):**
- hull < 0.75: czarna kolumna dymu bojowego (world space, animowany sin)
- hull < 0.50: płomień dziobowy 3-warstwowy + flicker
- hull < 0.35: drugi ogień rufowy
- hull < 0.20: ogień na mostku + iskry lecące + pomarańczowy poświat

**Merchant.js:**
- Analogiczne 4-fazowe efekty ognia/dymu (ładownia + dziób + iskry)
- Dym bojowy animowany (zastąpił losowy Math.random)

---

## [0.10.35] — 2026-05-15

### Dodano — animacja wybuchu przy trafieniu torpedą (ImpactFX)

**src/ImpactFX.js** (nowy plik):
- **Fale uderzeniowe**: 3 koncentryczne pierścienie (290/360/430px) z opóźnieniami 0/0.12/0.28s; czas trwania 1.8–2.8s; biały rdzeń + niebieskawa zewnętrzna obwódka
- **Błysk podwodny**: biały → żółty → pomarańczowy gradient, 0.45s; rozbłysk eliptyczny na powierzchni
- **Fontanna bryzgów**: 20 kropelek wachlarzowo w górę, siła odrzutu + grawitacja, 0.75s
- **Słup wody**: wznosi się do 138px (0.85s) → trzyma (1.30s) → opada (2.40s); opadające strumienie boczne po fazie wzrostu
- **Plama oleju**: elipsa 2.4:1 rosnąca od r=30px; tęczowe odbicia na powierzchni; trwa 18s
- **Odłamki**: 18 kawałków z grawitacją (200px/s²), losową rotacją, kolorami od czarnego do pomarańczowego; znikają po wpadnięciu w wodę
- **Dym**: kolumna 14 kłębów rosnących co 0.32s, wznoszą się 30px/s, ciemne → coraz jaśniejsze
- **Ogień**: 6 płomieni nad plamą oleju z migotaniem (sin), 20s max; trójwarstwowy gradient
- **Eksplozje wtórne**: 3 mini-wybuchy w t=2.4s, 5.6s, 9.0s — bryzgi + pierścień ognia

**src/GameScene.js:**
- Zaimportowano i zainicjalizowano `ImpactFX`
- `_impactFX.trigger()` wywoływane przy każdym trafieniu torpedy (wróg + merchant)
- `_impactFX.update(dt, camX)` w głównej pętli gry
- Trzęsienie kamery 820ms/0.012 (niezależne od `cameras.main.shake` trafienia)

---

## [0.10.34] — 2026-05-15

### Dodano — animacja wystrzelenia torpedy (TorpedoLaunchFX)

**src/TorpedoLaunchFX.js** (nowy plik):
- **Celownik (reticle)**: krzyż + koło + narożniki nad wrogiem pod kursorem; animowany pasek progresu 0→LOCK w 1.2s; etykieta `○ ARM %` → `● LOCK` (żółty→czerwony)
- **Linia namiaru (firing solution)**: przerywana linia z dzioba do celu z etykietą DYST/NAM; znaczniki co 1/4 dystansu; zanika po strzale
- **Burst sprężonego powietrza**: rozszerzające się pierścienie + 12 bąbli na obwodzie + czerwony błysk wewnętrzny w pierwszej fazie; 0.7s animacja
- **Drzwi wyrzutni**: `doorOpenFraction` getter (0→1→0) czytany przez Submarine.js

**src/Submarine.js:**
- Widoczne kanały torpedowe na dziobie (4 szczeliny ciemne, zielona kontrolka aktywnej rury)
- Animowane klapki wyrzutni: górna obraca się w górę, dolna w dół przy odpaleniu (kolor czerwony)

**src/Torpedo.js:**
- Ślad bąbelkowy przeprojektowany: puste koła rosnące z wiekiem (3→23px), unoszą się 5px/s w górę, zanikają przez 2.4s; co trzeci bąbel ma satelitę; cienka przerywana oś śladu
- Bufor śladu zwiększony z 28 do 56 próbek

---

## [0.10.33] — 2026-05-15

### Dodano — konsola deweloperska (klawisz ~)

**src/DevConsole.js** (nowy plik):
- Otwieranie / zamykanie klawiszem `~` (backtick) lub `Escape`
- DOM overlay przyklejony do dołu ekranu, zIndex 99999, pełna szerokość
- Historia komend: strzałki ↑↓ przewijają poprzednie wpisy
- Wejście klawiatury odcinane od Phasera gdy konsola otwarta (`keyboard.enabled = false`)
- Komendy: `time`, `hull`, `depth`, `tp`, `spawn`, `kill`, `wave`, `ammo`, `god`, `speed`, `clear`, `help`
- `god` mode: `update()` co klatkę zeruje obrażenia (hull = 1.0)
- `time` obsługuje liczby 0–1 oraz nazwy: dawn / noon / dusk / midnight / night / sunset / sunrise / evening
- `spawn [n]` używa `_spawnReinforcement()` — wróg od razu wchodzi w tryb ALERT

**src/GameScene.js:**
- Import `DevConsole`, inicjalizacja jako `this._devConsole` w `create()`
- `this._devConsole.update()` wywoływane każdą klatką

---

## [0.10.32] — 2026-05-15

### Dodano — cykl dnia i nocy (8-minutowy, proceduralny)

**src/Ocean.js:**
- Nowe grafiki screen-space: `skyOverlay` (depth 1) i `darkOverlay` (depth 9) — nie przesuwane z kamerą
- `_buildStars()` — 58 gwiazd o deterministycznych pozycjach z mruganiem (`sin(t*1.8 + phase*4.5)`)
- `_lerpCol(a, b, t)` — interpolacja kolorów hex bit-per-channel
- `_getDayPalette(dt)` — 9 klatek kluczowych (północ→świt→dzień→zmierzch→północ) ze smoothstep
- `_drawSky(g, pal)` — gradient nieba, gwiazdy w nocy, słońce z halo (w dzień) lub księżyc z poświatą (w nocy), linia horyzontu
- `update()` przyjmuje teraz `dayTime` (0–1); kolor fal i poświaty termokliny zależą od pory dnia

**src/GameScene.js:**
- `this._dayTime = 0.0` — licznik czasu dnia (inicjalizacja w `create()`)
- `this._dayTime = (this._dayTime + dt / 480) % 1` — pełny cykl co 8 minut rzeczywistych
- `window._sonar.dayTime` — eksport do UI (overlay HTML może wyświetlać porę dnia)

---

## [0.10.31] — 2026-05-15

### Poprawiono — animacja tonięcia v2: opad na dno, wrak, szczątki, muł

**src/Enemy.js:**
- Czas animacji wydłużony z 7.5s do **14s**
- Okręt opada od `SURFACE_Y=80` do `OCEAN_FLOOR_Y=580` (500px w dół)
- Rotacja akumulowana: przyspiesza do prog=0.22 (2.8 rad/s), zwalnia przy dnie
- Kolor kadłuba ściemnia się z głębokością: `0x775511 → 0x443308 → 0x1e1402`
- **Szczątki** (`type:'debris'`): prostokąty odrywające się w fazie podwodnej, unoszą się i obracają; żyją do 13s
- **Bąble**: gęstsze na początku (para od ognia) i przy dnie (powietrze wydobywające się z wraku)
- **Splash**: woda wyrzucona przy zanurzaniu, elipsa 170px zanikająca w 0.21s
- Fale rozchodzą się do 310px po powierzchni
- Plama oleju rośnie do 370px z tęczowym refleksem
- **Uderzenie w dno** (prog > 0.85): chmura mułu 440px, wrak osiada — kadłub + przechylona nadbudówka + maszt leżący na dnie
- `_sinkBubbles` → `_sinkParticles` (unified array z `type` field)
- Nowe pola konstruktora: `_sinkAngle`, `_shipSinkY`, `_sinkParticles`

---

## [0.10.30] — 2026-05-15

### Dodano — animacja tonięcia niszczyciela (7.5s)

**src/Enemy.js:**
- `startSinking()` — inicjuje animację; blokuje dalszy atak, zeruje needsReinforcement, revealTimer = 9.5s
- `_updateSinking(dt)` — tick animacji: bąble powietrza (co ~0.11s), finalnie `destroyed = true`
- `_drawSinking(prog)` — pełna animacja proceduralna:
  - Plama oleju — rośnie od 36px do 280px, tęczowy reflex
  - Bąble powietrza — unoszą się 38px/s, zanikają przez 3.8s
  - Fale na powierzchni — elipsa rozchodząca się od prog=0.55
  - Okręt pochyla się do 90° (`rotateCanvas`) i zanurza 95px w dół
  - Wybuch początkowy — biała kula (prog < 0.20)
  - Ogień — 4–9 cząsteczek, intensywność rośnie z progresem
  - Dym — 5–13 cząsteczek, gęstnieje i ciemnieje
  - Pęknięcia kadłuba pojawiają się od prog=0.15
  - Alpha fade na finałowych 17% animacji
- Sinking branch w `update()` — pomija całą logikę bojową i AI
- Torpedo/rakieta: torpedy gracza nie mogą trafić już tonącego (`!e._sinking` filter)
- State transitions log: pomija tonące okręty

**src/GameScene.js:**
- Trafienie torpedą Mk.48: `target.startSinking()` zamiast `target.destroyed = true`
- Trafienie rakietą vs wrogie: `target.startSinking()` zamiast `target.destroyed = true`
- Filter torpedy gracza: `!e.destroyed && !e._sinking`
- Loop state transitions: `filter(e => !e._sinking)`

## [0.10.29] — 2026-05-14

### Zmieniono — AI wrogów v2: dead reckoning, posiłki, flanking, lepszy SEARCH

**src/Enemy.js:**
- **Dead reckoning (DR)** — w stanie HUNT wróg przewiduje ruch łodzi na podstawie ostatnio zarejestrowanej prędkości (`sub.vx`); im dłużej bez kontaktu, tym dalej koryguje cel (waga 0.60, max 9s projekcji)
- **Prędkość HUNT** — gdy kontakt świeży (< 3s), niszczyciel przyspiesza o 18% (`HUNT_SPEED × 1.18`)
- **Szybsza utrata kontaktu w HUNT** — decay 0.35 (było 0.25); pod termoklinem: 0.55 — realne nagradzanie ukrycia się
- **Wezwanie posiłków** — po 18s ciągłego HUNT bez likwidacji łodzi ustawiana flaga `needsReinforcement`
- **Koordynacja flankowania** — `receiveRadioAlert(subX, subY, hunterX)` — gdy oba okręty po tej samej stronie łodzi, drugi przechodzi na przeciwną (kleszczy)
- **ALERT z flankowaniem** — nowy branch `_flankApproach` kieruje okręt 180px za łódź, nie bezpośrednio na nią
- **SEARCH faza 1 (0–11s)** — konwergencja do `lastKnownSubX` (atakuje ostatnią pozycję); **faza 2** — rozszerzający się sweep (swing +16px/s) zamiast statycznych 90px
- **`_contactAge` i `_lastKnownVX`** — śledzone przy każdym świeżym kontakcie sonarowym i pingowym

**src/GameScene.js:**
- **Obsługa posiłków** — gdy `hunter.needsReinforcement`, spawna `_spawnReinforcement(hunter)` z cooldownem 85s i limitem 6 okrętów
- **`_spawnReinforcement(hunter)`** — nowa metoda: posiłki przybywają z PRZECIWNEJ strony niż łowca (efekt kleszczy), od razu w stanie ALERT ze znajomością ostatniej pozycji łodzi
- **Radio z flankowaniem** — `receiveRadioAlert` przekazuje teraz `hunter.x` jako trzeci argument

## [0.10.28] — 2026-05-14

### Dodano — Stacja BROŃ (F4) z kartami uzbrojenia i live updates

**index.html — CSS:**
- Nowa stacja `#weapon-station` z tłem radialnym w odcieniu ciemnego bursztynu (`#120a03`)
- Klasy `.ws-tube`, `.ws-tube-status`, `.ws-tube-cd` — siatka rur torpedowych z kolorami: ready (green), reloading (amber), empty (faint)
- Klasy `.ws-inv-grid`, `.ws-inv-item`, `.ws-inv-val` — zapasy bojowe w siatce 3-kolumnowej (28px cyfry)
- Klasy `.ws-card-body`, `.ws-spec-grid`, `.ws-spec-lbl`, `.ws-spec-val`, `.ws-card-desc`, `.ws-card-name`, `.ws-weapon-type-badge` — karty uzbrojenia z tabelą specyfikacji

**index.html — HTML:**
- Lewa kolumna: nagłówek z etykietą zabezpieczenia, panel 4 rur torpedowych (TRP-1..4), panel zapasów bojowych (torpedy/rakiety/wabie), panel sterowania ogniem z listą klawiszy
- Prawa kolumna (scrollowana): 3 karty uzbrojenia — Mk.48 ADCAP, P-15 Termit, ВГС-Н Noisemaker — każda z odznaka typu, tabelą specyfikacji i opisem taktycznym

**index.html — JavaScript:**
- `_wsActive` — nowa flaga stanu stacji BROŃ
- `_switchStation`: obsługa `id === 'weapon'`, deaktywacja `weaponStation` przy przełączaniu
- Skrót `F4` / `4` → otwiera stację BROŃ; `ESC` gdy `_wsActive` → wraca do CONN
- Tab BROŃ: zmiana `data-station="conn"` → `data-station="weapon"`
- `weaponLoop()` — RAF loop synchronizujący zapasy z ukrytego HUD (`hud-torpedoes`, `hud-missiles`, `hud-noisemakers`), aktualizujący liczniki nagłówków i kolor wg stanu, odczytujący `window._sonar.tubes` do wyświetlenia cooldownu rur

**src/GameScene.js — `_exportSonarState`:**
- `window._sonar.tubes` — eksport stanu 4 rur torpedowych: `{ ready: bool, cd: number }` na potrzeby weaponLoop

---

## [0.10.27] — 2026-05-14

### Dodano — Integracja peryskopowa: selekcja, hałas, badge, FOV w CONN

**src/GameScene.js — `_exportSonarState`:**
- Selekcja V-* kontaktów: kliknięcie wizualnego kontaktu (V-N) w stacji PERYSKOP poprawnie ustawia `_selectedEnemy` — pełna integracja z panelem namierzania i systemem ogniowym
- Hałas peryskopowy: gdy peryskop aktywny + głębokość <12m → `noiseSurge = max(surge, 0.08)` — maszt powyżej wody podnosi sygnaturę akustyczną
- Dziennik pokładowy: wpis `PERYSKOP: PODNIESIONY / OPUSZCZONY` przy każdej zmianie stanu

**src/GameScene.js — `_drawBearingLines`:**
- Wskaźnik FOV peryskopowy: gdy stacja aktywna, na ekranie CONN rysowany zielony stożek (~200px) w kierunku obserwacji — półprzezroczyste wypełnienie + krawędzie + kółko osi celowania

**index.html:**
- Badge `PERYSK` w dolnym pasku HUD: pokazuje aktualny namiar obserwacji i zmienia kolor na zielony gdy stacja aktywna; klik otwiera stację
- Sync kursu przy otwarciu: F3/3 lub kliknięcie zakładki PERYSKOP ustawia `_pBearing` na aktualny kurs łodzi (`window._sonar.heading`)

---

## [0.10.26] — 2026-05-14

### Dodano — Pełna integracja peryskopowej stacji z rozgrywką

**src/GameScene.js — `_exportSonarState`:**
- `window._sonar.visualContacts` — wszystkie wrogie/handlowe jednostki w promieniu 3500px z bearing, distFrac względem zasięgu wzrokowego, klasą i shipType; K-N ID gdy pokrywa się z kontaktem sonarowym
- Klasyfikacja wizualna: gdy peryskop aktywny + głębokość <12m + kontakt w polu widzenia i dystansie <1925px → `contactClass = shipType`, `classifyTimer = 60` — natychmiastowa identyfikacja bez czekania 38s

**index.html — periscope JS:**
- Sylwetki statków przepisane: WARSHIP = smukły kadłub, wysoka nadbudówka, antena radarowa; MERCHANT = szeroki kadłub, dźwigi ładunkowe — wizualnie odróżnialne
- Fala morza ze smugami odblasków (6 animowanych linii)
- Flash klasyfikacji: nowo zidentyfikowany kontakt przez 1.8s świeci zielono z etykietą klasy i ✓; lista kontaktów podświetla rząd
- Zasięg wizualny poprawiony: `distFrac` liczony od 3500px (nie sonar 820px), widoczność do 62% zasięgu (~2.2km)
- Stadimetria zaktualizowana: 1km/2km/3.5km (odpowiada skali 3500px)
- Klik na kontakt w liście → `window._sonar.selectedId` (synchronizacja z targeting)
- Export stanu: `periscopeActive`, `periscopeBearing`, `periscopeFov` do `window._sonar` co klatkę
- Gdy stacja nieaktywna: `periscopeActive = false` → GameScene nie klasyfikuje

---

## [0.10.25] — 2026-05-14

### Dodano — Stacja PERYSKOP (prototyp, F3)

**index.html:**
- Nowa stacja `#periscope-station` w tym samym design systemie co SONAR
- **Widok optyczny** — canvas z kołowym obiektywem: niebo/morze, fala horyzontu, linie stadimetryczne (500m/1km/2km), skala kątowa wzdłuż górnego łuku, celownik krzyżykowy z punktami dystansu
- **Sylwetki statków** — kadłub + nadbudówka + maszt; rozmiar proporcjonalny do odległości; kolor wg klasyfikacji (bursztyn=WARSHIP, cyan=MERCHANT); etykieta ID nad mastem
- **Overlay głębokości** — „ZBYT GŁĘBOKO" gdy peryskop pod wodą (>12m), blokuje widok
- **Panel kursu obserwacji** — duży wyświetlacz `000°`, status głębokości, powiększenie ×1.5/×3.0
- **Lista kontaktów w polu widzenia** — ID, klasyfikacja, kąt odchylenia od osi, dystans
- **Panel ESM** — placeholder; klucze sterowania
- Sterowanie: SCROLL — obrót, ← → — korekta 2°/klawisz, Z — przełącz zoom, F3/3 — wejście, ESC — powrót do CONN
- Refaktor `_switchStation` — obsługuje 'conn'/'sonar'/'periscope'; `_pActive` zamiast rozgałęziania; kliki tabów automatyczne przez `tab.dataset.station`

---

## [0.10.24] — 2026-05-14

### Poprawiono — Zniszczony okręt znika z sonaru i systemu śledzenia

**src/GameScene.js:**
- Po zniszczeniu wroga/merchanty: czyszczone są `_selectedEnemy`, `window._sonar.selectedId`, `_prevSonarSelId` — zaznaczenie w stacji SONAR znika natychmiast
- Triangulacja (`_triangulated`) usuwana dla zniszczonego celu — ikona pozycji na mapie taktycznej znika razem z okrętem
- Dotyczy zarówno okrętów wojennych (`this.enemies`) jak i jednostek cywilnych (`this.merchants`)

---

## [0.10.23] — 2026-05-14

### Dodano — Realistyczny 4-poziomowy system klasyfikacji sonarowej

**Nowe klasy kontaktów:** `UNK` → `SURFACE` → `WARSHIP` lub `MERCHANT`

**src/Enemy.js:**
- `shipType = 'WARSHIP'` — docelowa klasa po pełnej klasyfikacji
- Tonal okrętu wojennego przesunięty do 18–35 Hz (szybki wał napędowy)

**src/Merchant.js:**
- `shipType = 'MERCHANT'` — docelowa klasa po pełnej klasyfikacji
- Tonal cywilny: 6–12 Hz (wolny wał cargo, wyraźnie odróżnialny na DEMON)
- `MAX_CLASS_TIMER` zmieniony z 54 na 90 — pozwala osiągnąć klasę MERCHANT

**src/Sonar.js:**
- Nowe progi: UNK (0–12s) → SURFACE (12–38s) → typ końcowy wg `shipType` (38s+)
- Tryb NASŁUCH 2.2× szybsza klasyfikacja; silny sygnał dodatkowo przyspiesza
- Zanik przy utracie kontaktu: `>38s`→SURFACE przy `classifyTimer<38`, SURFACE→UNK przy `<12`
- Kolory: WARSHIP=pomarańcz, MERCHANT=cyan, SURFACE=bursztyn, UNK=zielony

**src/GameScene.js:**
- `tp-classif`: wyświetla `OKRĘT WOJ.` / `JED. CYW.` / `NAWODNY` / `UNK`
- `JED. CYW.` kolorowana jako `tp-value ready` (zielony) — nie jest celem
- Linie namiarowe i triangulacja: cyan dla MERCHANT, bursztyn dla SURFACE

**index.html:**
- Lista kontaktów: `JEDNOSTKA CYW.` jako nowa etykieta klasy
- Koło namiarów: 4 kolory (czerwony/bursztyn/żółty/zielony/cyan) wg klasyfikacji
- Wodospad BTR: kolory kontaktów wg klasy (SURFACE=żółty, MERCHANT=cyan)

---

## [0.10.22] — 2026-05-14

### Dodano — ESC zamyka aktywną podsekcję i wraca do CONN

**index.html — obsługa `keydown`:**
- ESC gdy aktywna jest dowolna stacja i jest zaznaczony kontakt → odznacza kontakt (dotychczasowe zachowanie)
- ESC gdy stacja aktywna, brak zaznaczenia → `_switchStation('conn')`, powrót do widoku głównego
- Wzorzec działa dla wszystkich przyszłych podsekcji korzystających z `_ssActive` / `_switchStation`

---

## [0.10.21] — 2026-05-14

### Poprawiono — Zaawansowany declutter kontaktów sonarowych

**index.html — `_ssDrawWheelFull`:**
- **Klaster-based fan spread**: kontakty w oknie 24° grupowane w klaster; wyświetlane namirary rozłożone symetrycznie od centroidu kołowego klastra co 17°
- **Schodkowanie radialne**: w klastrze parzyste indeksy bliżej centrum, nieparzyste dalej — podwójna separacja (kątowa + radialna) eliminuje nachodzenie nawet przy 4 kontaktach w 5° oknie
- **Linia łącząca**: gdy dot jest przesunięty od prawdziwego namiaru, rysowana cienka przerywana linia (2-6px, alpha 0.28) z dota do rzeczywistego punktu na pierścieniu namiarowym
- Prawdziwe namirary zachowane bez zmian na: linii przerywanej ze środka, łuku na pierścieniu, alertcie HUNT

---

## [0.10.20] — 2026-05-14

### Poprawiono — Realistyczna gospodarka tlenowa

**src/Submarine.js — `_updateSystems`:**
- **Wolniejsze zużycie tlenu**: bazowe 0.004→0.00055/s; czas do wyczerpania: płytko ~30 min, 270m ~15 min, 400m ~12 min (poprzednio 3-4 minuty)
- **Snorchel ładuje tlen**: regeneracja aktywna przy `depth < SNORKEL_DEPTH_M (18m)` — wcześniej tlen uciekał nawet przy podniesionym snorchlu; wskaźnik głębokości powierzchni 8m → 18m
- **Łagodniejsze obrażenia od niedotlenienia**: 0.022→0.007/s po wyczerpaniu — daje czas na reakcję zamiast błyskawicznej śmierci
- Skalowanie głębokościowe: 0.000005→0.0000018 (głębokość ma znaczenie, ale nie dominuje)

---

## [0.10.19] — 2026-05-14

### Poprawiono — Mapa taktyczna + declutter kontaktów na kole sonarowym

**src/GameScene.js — `_drawTacticalMap`:**
- **Mapa taktyczna: filtry zasięgu dla merchantów** — handlowcy ukryci poza `2×SONAR_RANGE` (1640px); w strefie 820–1640px widoczni z alpha 0.30 (ledwo zarysowani); w zasięgu sonaru pełna widoczność 0.85
- Wcześniej merchanty były rysowane bezwarunkowo niezależnie od wykrycia — teraz mapa taktyczna odzwierciedla faktyczną wiedzę sonaru

**index.html — `_ssDrawWheelFull`:**
- **Declutter kątowy na kole namiarów** — sortowanie kontaktów wg namiaru, wymuszanie min. 11° separacji między wyświetlanymi pozycjami (dot + etykieta)
- Prawdziwy namiar zachowany dla: przerywanej linii namiarowej, łuku na pierścieniu zewnętrznym, pulsującego alertu HUNT
- Tylko pozycja kropki i etykiety ID przesuwa się by uniknąć nakładania

---

## [0.10.18] — 2026-05-14

### Zaimplementowano — Pełna integracja stacji SONAR z resztą gry

**index.html — stacja SONAR:**
- **Klikalny canvas koła namiarów** — kliknięcie w pobliżu kontaktu na kole wybiera go (`_ssSelContact`); podwójne kliknięcie tego samego = odznaczenie
- **Synchronizacja wybranego kontaktu do `window._sonar.selectedId`** — zapis w każdym ticku RAFu (`_ssUpdateBadges`) i po kliknięciu (canvas + lista)
- **Zasięg w liście kontaktów** — dodana kolumna `ss-rng` (np. `3.2nm`) obliczana z `distFrac × 10`
- **Klawisze F1/F2** — pełna obsługa obok istniejących `1`/`2`; ESC odznacza kontakt gdy stacja SONAR aktywna
- **Usunięto martwą funkcję `_ssDrawWheel_DELETED`** — ~180 linii dead code wyciętych
- CSS: `cursor: crosshair` na kole namiarów; nowe kolumny grid listy kontaktów (6 kolumn)

**src/GameScene.js — `_exportSonarState`:**
- **Heading** — eksport na podstawie `sub.vx`: prawo = 090°, lewo = 270°; wskaźnik kursu na kole namiarów wskazuje teraz rzeczywisty kierunek
- **Sync wyboru do systemu celowania** — gdy gracz kliknie K-2 w stacji SONAR, `this._selectedEnemy` aktualizuje się automatycznie → lewy panel NAMIERZANIE pokazuje dane tego celu

**src/Sonar.js:**
- **Podświetlenie wybranego kontaktu na mini-PPI** — biały pulsujący pierścień + przerywana linia namiarowa rysowane w pętli update, synchronizowane przez `window._sonar.selectedId`

---

## [0.10.17] — 2026-05-10

### Naprawiono — Pauza samouczka i fix namiarów SONAR

**src/TutorialMission.js:**
- `_showStepModal()`: dodano `this.scene.scene.pause()` — gra pauzuje przy każdym modalu wyjaśnienia kroku
- `_dismissStepModal()`: dodano `this.scene.scene.resume()` — gra wznawia po kliknięciu „Kontynuuj"
- Podczas modalu wrogi, torpedy i mechanika gry stoją; overlay z treścią i przyciski pozostają aktywne

**src/GameScene.js — `_exportSonarState` → `toBD()`:**
- Poprzedni problem: przy małej głębokości własnej (np. peryskopowej) składnik pionowy `dy` był pomijalnie mały, przez co namiary na wszystkie cele nawodne skupiały się w okolicach 090° — niemożliwe do odróżnienia na kole namiarów
- Wprowadzono minimalny pionowy próg referencyjny `REF = THERMO_Y − SURFACE_Y` (~200 px ≈ głębokość termokliny)
- `dyEff = sign(dy) × max(|dy|, REF)` — kontakty rozdzielają się teraz na przestrzeni ~050°–076° (prawo) i ~284°–310° (lewo) zamiast ≈090°

---

## [0.10.16] — 2026-05-10

### Ulepszono — Pełna integracja stacji SONAR z mechanikami gry

**src/GameScene.js — `_exportSonarState`:**
- Eksport torpedy gracza (bearing, distFrac, seekerLocked)
- Eksport torped ASROC wrogów (bearing, distFrac, locked)
- Eksport wabii akustycznych (bearing, distFrac, age/lifetime dla zanikania)
- Eksport aktywnych pingów (rFrac, alpha) + echa pingów z pozycjami
- Eksport triangulowanych pozycji (bearing, distFrac, age, accurate)
- Eksport trybu ciszy (silentRunning) i głębokości

**index.html — stacja SONAR:**
- Przeniesiono `#sonar-station` do wnętrza `#game-container` (z-index 12)
- Podniesiono z-index overlayów gry (alert, event-log, bot, tutorial-tip) do 55 — widoczne ponad stacją SONAR
- **Koło namiarów — nowe elementy:**
  - Aktywny ping: rozszerzający się pierścień + białe błyski ech
  - Triangulowane pozycje: żółty krzyż z kółkiem (zanika przez 28s)
  - Wabie: pulsujące bursztynowe kółka (zanikają wraz z cyklem życia)
  - Torpedy gracza: cyjanowe trójkąty, większe gdy seeker zablokowany
  - ASROC wrogów: migające czerwone romby, kółko gdy naprowadzone
  - Kontakty HUNT: pulsujące kółko na krawędzi pierścienia
  - Tryb nasłuchu: niebieski pierścień zewnętrzny
  - Tryb ciszy: zielony przerywany pierścień
- **DEMON waterfall:** kopiowany z panelu bocznego (`#demon-display`) do `#ss-demon` przez drawImage
- **Skróty klawiszowe:** `2` → stacja SONAR, `1` → CONN

---

## [0.10.15] — 2026-05-10

### Dodano — Stacja SONAR (HTML overlay)

**index.html + src/GameScene.js:**
- Zakładka SONAR w top-barze jest teraz klikalna — otwiera pełny overlay stacji
- **Koło namiarów** (canvas, animowany sweep): pierścienie, podziałka 0–360°, wskaźnik kursu, linie namiarów kontaktów, marker własnej pozycji (OWN), pulsujący pierścień nasłuchu
- **Wodospad BTR** (bearing-time recorder, canvas): oś Y = namiar 0–360°, czas scrolluje w lewo, gauss blob dla każdego kontaktu, kolor wg klasyfikacji (czerwony=zagrożenie, żółty=okręt wojenny, niebieski=nawodny)
- **Lista kontaktów**: ID, klasyfikacja (OKRĘT WOJENNY/NAWODNY/NIEZNANY), namiar, trend (ZBLIŻA/ODDALA), paski siły sygnału
- Dane eksportowane z GameScene.js przez `window._sonar` (bearing kompasowy, sig, approach, cls, threat)
- Dedykowana pętla RAF (`sonarLoop`) nie koliduje z istniejącym `mirror` loopem

---

## [0.10.14] — 2026-05-10

### Przeprojektowano — Nowe UI gry (design Czerwony Październik)

**index.html:**
- Nowa paleta kolorów: `#e8413a` (czerwony akcent), `#02080b` (tło), `#f3ede0` (tekst)
- Czcionki: Bebas Neue (wyświetlacz), JetBrains Mono (mono) — ładowane z Google Fonts
- Siatka CSS `52px 640px 76px`: top-bar + main-area + bottom-bar
- **Top bar:** pulsujący punkt statusu, nazwa okrętu (ORP ORZEŁ), zakładki stacji (CONN/SONAR/PERYSKOP/BROŃ/NAWIGACJA/AWARIE), zegar UTC
- **Left panel (200px):** info o celu, panel misji, zarządzanie rurami torpedowymi
- **Game container (1024px):** canvas Phaser + nakładki HUD
- **Side panel:** dziennik okrętowy + canvas DEMON
- **Bottom bar:** główne wartości HUD (głębokość/prędkość/kurs/balast/hałas/kadłub) w czcionce Bebas Neue, liczniki torped, przyciski trybu
- Ukryty `#hud` zachowuje oryginalne ID dla kompatybilności z GameScene.js
- Skrypt RAF synchronizujący wartości z ukrytego HUD do widocznego bottom-bar
- Efekty CRT: scanlines + winietowanie przez `::before`/`::after` na `#game-shell`
- Narożne uchwyty przez technikę CSS gradient (8 gradientów = 4 kształty L)

---

## [0.10.13] — 2026-05-10

### Zmieniono — Samouczek zamyka etap tylko po wykonaniu zadania

**src/TutorialMission.js:**
- Usunięto auto-timer (7s) z ekranu wyjaśnienia — gracz zamyka go ręcznie klikając "WYKONAJ ZADANIE" lub [Enter]
- Usunięto pasek odliczający i etykietę "auto za Xs"
- Karta zadania nadal zamyka się wyłącznie po spełnieniu warunku fazy (jak wcześniej)
- Uproszczono `_showStepModal`, `_dismissStepModal`, `_hideStepModal` — usunięto `clearTimeout`/`clearInterval`

## [0.10.12] — 2026-05-10

### Przeprojektowano — Samouczek krok-po-kroku z wyjaśnieniami

**src/TutorialMission.js — pełny redesign architektury:**
- Każda z 7 faz ma teraz dwa etapy: (1) ekran wyjaśnienia mechaniki → (2) zadanie do wykonania
- Nowy element `#tut-step` — modal 530px wycentrowany na canvas z opisem 2-3 zdania + klawisze + cel
- Modal auto-znika po 7 sekundach z animowanym paskiem odliczającym i licznikiem "auto za Xs"
- Przycisk "▸ WYKONAJ ZADANIE [Enter]" skraca oczekiwanie — gracz może przejść dalej od razu
- Po zamknięciu modalu pojawia się karta zadania (340px, lewy dolny róg) z instrukcją i paskiem postępu
- Faza 6 (torpeda): intro wyjaśnia celownik i lead indicator; po wejściu cel zatrzymuje się automatycznie
- Usunięto stary `_renderPhase()` — zastąpiony przez `_startPhase(i)` → `_showStepModal()` → `_dismissStepModal()` → `_showCard()`
- Naprawiono bug z `setInterval` counter czyszczonym przez `clearInterval` przy pominięciu

## [0.10.11] — 2026-05-10

### Naprawiono — Samouczek blokował kursor i torpedy

**src/TutorialMission.js — bugfix krytyczny:**
- `#tut-intro` (overlay pełnoekranowy z `pointer-events: all; inset: 0`) nigdy nie był usuwany z DOM — `this._introEl = null` następowało przed timeoutem, więc `this._introEl?.remove()` znajdowało null i nie robiło nic; element pozostawał niewidoczny ale blokował wszystkie kliknięcia na canvas
- Naprawiono przez zapis referencji do zmiennej lokalnej `const el = this._introEl` przed wyzerowaniem pola klasy, a następnie `el.remove()` w timeoucie
- Dodano `el.style.pointerEvents = 'none'` natychmiast po wywołaniu hide — odblokowanie kliknięć bez czekania na usuniecie DOM (550ms fade)
- Ten sam wzorzec naprawiony w `_triggerMission()` dla `#tut-complete`

## [0.10.10] — 2026-05-10

### Naprawiono i przeprojektowano — Samouczek i czarne tło

**src/TutorialMission.js — pełny redesign UX:**
- Karta samouczka przeniesiona do lewego dolnego rogu (340px × ~130px) — nie zasłania łodzi, sonaru, DEMON waterfalla ani celu
- Cel treningowy przybliżony z x=1800 do x=900, prędkość z 8 do 1 px/s — zawsze widoczny na ekranie gracza
- W fazie 6 (TORPEDA) cel zatrzymuje się automatycznie (`speed=0`) przez `onEnter` callback — gracz może spokojnie celować
- Dodano pole `hint` — krótkie wyjaśnienie "dlaczego" pod instrukcją (szary tekst)
- Dodano `update()` callback na fazę — faza 6 wykrywa wystrzelenie torpedy bez polegania tylko na `check()`
- Nagłówek: 7 kropek postępu + numer kroku + przycisk ESC
- Kropki aktywna/ukończona/oczekująca z kolorowymi stanami

**src/GameScene.js — bugfix:**
- Dodano `?.` (optional chaining) przy `this.mission.update()`, `this.mission.onMerchantDestroyed()` — `this.mission` jest null podczas samouczka, co powodowało TypeError i czarne tło canvasa

## [0.10.9] — 2026-05-10

### Dodano — Profesjonalny samouczek jako pierwsza misja

**src/TutorialMission.js — nowy plik:**
- 7-fazowy samouczek prowadzący gracza "za rączkę" przez wszystkie kluczowe mechaniki
- Faza 1: ZANURZENIE — zejść poniżej 60m (pasek postępu głębokości)
- Faza 2: NAPĘD — uruchomić silnik elektryczny, utrzymać prędkość 3s (pasek prędkości)
- Faza 3: NASŁUCH — wyłączyć silnik, wejść w tryb nasłuchu 4s (pasek aktywności)
- Faza 4: AKTYWNY SONAR — wysłać ping [Q] (wykrycie faktu naciśnięcia)
- Faza 5: KLASYFIKACJA — poczekać na SURFACE na DEMON waterfalle (pasek classifyTimer)
- Faza 6: TORPEDA — wystrzelić torpedę LPM w zidentyfikowany cel
- Faza 7: TRAFIENIE — czekać na zniszczenie lub timeout 35s
- Ekran intro z opisem szkolenia, przycisk "Pomiń samouczek"
- Panel tutorial: 112px przy dolnej krawędzi canvas z ikoną, tytułem, instrukcją, klawiaturą, paskiem warunku
- Zielony flash + wpis w logu pokładowym po każdej fazie
- Ekran zakończenia "SZKOLENIE ZAKOŃCZONE" z przyciskiem do misji bojowej

**src/GameScene.js:**
- `_startTutorial()`: 1 cel treningowy (CEL TRENINGOWY, x=1800, dir=-1, speed=8px/s)
- `_startMission1Combat()`: po tutorialu → usuwa cel treningowy, spawniuje konwój 4 statków + wrogów
- Stary `_updateTutorial()` i pola `_tutorialHints` usunięte
- Wrogowie nie spawnią się podczas tutorialu (`_enemiesSpawned=true`)
- Wczytanie zapisu pomija tutorial (gracze, którzy już grali)

---

## [0.10.8] — 2026-05-10

### Dodano — System zapisu (localStorage)

**src/SaveSystem.js — nowy plik:**
- `save(scene)` — serializuje pełny stan gry do `localStorage` (klucz `op_pazdziernik_v1`)
- `load()` — odczytuje i parsuje zapis, zwraca null jeśli brak/błąd
- `hasSave()` / `clear()` — sprawdzenie i usunięcie zapisu
- `getSaveInfo()` — czytelne info dla menu (data, fala, kadłub%, zatopione)

**Co jest zapisywane:**
- Okręt: x/y, vx/vy, hull, battery, oxygen, ballast, missileCount, noisemakerCount, 4 rury torpedowe (loaded + reloadTimer)
- Fala: `_wave` + `_waveTimer`
- Konwój: pozycja, kierunek, kadłub, destroyed, classifyTimer każdego statku
- Misja: postęp celów (detect done, destroy count)

**src/GameScene.js:**
- Auto-zapis co 30s (`time.addEvent`) z wpisem "AUTO-ZAPIS OK" w logu
- `_restoreFromSave(save)` — przywraca cały stan bez resetu (pozycja, zasoby, fala, konwój, misja)
- NOWY PATROL czyści stary zapis przed startem

**src/Menu.js:**
- KONTYNUUJ odblokowane gdy `SaveSystem.hasSave()` → true
- Sekcja BRIEFING pokazuje datę zapisu, falę, kadłub%, zatopione statki
- Nawigacja klawiaturą pomija zablokowane pozycje
- F2 uruchamia KONTYNUUJ (gdy dostępne)

**src/main.js:**
- Przekazuje `{ fromSave: true/false }` z menu do SaveSystem przed startem Phaser

---

## [0.10.7] — 2026-05-10

### Dodano — Menu główne z ekranem startowym

**src/Menu.js — nowy plik:**
- Pełnoekranowe menu startowe z animowanym tłem (sonar PPI, canvas 2D)
- Obracające się ramię sweepujące z 100° smugą poświaty i gradientem radialnym
- 3 rozszerzające się pierścienie ping z zanikającą przezroczystością
- Schemat techniczny okrętu podwodnego (SVG, PR. 671RTM · K-244) z opisami
- Panel menu: NOWY PATROL / KONTYNUUJ / ARCHIWUM / FLOTYLLA / USTAWIENIA / WYNURZ
- Nawigacja klawiaturą (↑↓ + Enter + F1) i myszą
- Pasek telemetrii: głębokość/prędkość/kurs/reaktor — animowane fluktuacje co 600ms
- Zegar UTC odświeżany co 1s
- Tytuł "CZERWONY / PAŹDZIERNIK" czcionką Bebas Neue (Google Fonts CDN)
- Efekt winietowania, scanlines CRT, szum proceduralny
- Menu znika z animacją fade-out (0.4s) po wyborze NOWY PATROL
- Pełne sprzątanie: cancelAnimationFrame, clearInterval, removeEventListener

**src/main.js:**
- Phaser.Game startuje dopiero po zamknięciu menu (promise chain)
- Gra nie startuje w tle podczas menu

**Inne:**
- KONTYNUUJ / ARCHIWUM / FLOTYLLA / USTAWIENIA / WYNURZ — widoczne, zablokowane (stub)

---

## [0.10.6] — 2026-05-10

### Dodano — System misji + Misja 1: Operacja Szlak Handlowy

**src/Merchant.js — nowy plik:**
- Statek cargo: kadłub 75%, prędkość 12–17 px/s, konwój 4 jednostek
- Interfejs sonaru identyczny z Enemy (getContactInfo, getVelocity, revealTimer, classifyTimer)
- Tonal 11–19 Hz (niższe od niszczyciela — odróżnienie na DEMON)
- Klasyfikacja: UNK → SURFACE (zablokowany na SURFACE, nigdy WARSHIP)
- Reaguje na aktywny ping — echo na PPI, ujawnienie pozycji na 5s
- Rysowanie: proc. sprite statku handlowego (ładownie, mostekówka, komin)
- Bursztynowe linie namiarowe w widoku głównym (odróżnienie od niszczycieli)

**src/MissionSystem.js — nowy plik:**
- MissionSystem zarządza aktywnymi misjami i aktualizuje panel UI
- Misja 1 "OP. SZLAK HANDLOWY":
  - Cel 1: Namierz konwój — sklasyfikuj dowolny statek do poziomu SURFACE
  - Cel 2: Zatop 3 z 4 statków handlowych
- Wpisy do dziennika pokładowego na każdym etapie misji
- Ekran sukcesu po zatopeniu 3 statków (2.5s opóźnienie po ostatnim wpisie)

**src/GameScene.js:**
- Import Merchant i MissionSystem
- 4 merchanty: LENSKY/KALININ/TBLISI/NOVOROSSIYSK na pozycjach 2200–8400px
- Torpedy i rakiety celują w merchantów (wykrywanie trafień)
- Merchanty widoczne na PPI, mapie taktycznej (bursztynowe romby)
- Ping [Q] echuje od merchantów i ujawnia ich pozycję
- Panel namierzania (NAMIERZANIE) wyświetla merchantów jako cel

**index.html:**
- Panel MISJA w lewym panelu z nazwą i celami
- Style CSS: pending (szary), done (cyjan), mission-complete (złoty)

---

## [0.10.5] — 2026-05-09

### Zmieniono — Balans rozgrywki

**Enemy.js — trudność:**
- `BASE_HYDROPHONE` 600 → 480 px (wróg słyszy na krótszą odległość)
- `ALERT_THRESHOLD` 1.4 → 2.2 s (dłuższy czas do alarmu)
- `HUNT_THRESHOLD` 5.0 → 7.0 s (dłuższy czas do ataku)
- `CHARGE_COOLDOWN` 9.0 → 13.0 s (rzadsze szarże)
- `ASROC_COOLDOWN` 45 → 70 s (rzadszy ASROC)
- `SEARCH_DURATION` 35 → 50 s (dłuższe poszukiwania przed wycofaniem)
- Obrażenia: ratio × 0.58 → × 0.44 (słabsze trafienia)
- Wycofanie: hull < 0.25 → < 0.35 (wróg wycofuje się wcześniej)

**Submarine.js — siła gracza:**
- Przeładowanie torpedy: 90–120 s → 55–75 s
- `_salvoCD` między wystrzeleniami: 6.0 → 3.0 s
- Liczba rakiet: 2 → 3
- Liczba wabiów (noisemaker): 3 → 5

**Torpedo.js — skuteczność Mk.48:**
- Zasięg maksymalny: 950 → 1100 px
- Zasięg sonaru głowicy: 195 → 240 px

---

## [0.10.4] — 2026-05-09

### Dodano — Aktywny sonar [Q]

**src/GameScene.js:**
- Klawisz `Q` — emituje ping aktywny z pozycji łodzi
- Cooldown 14s między pingami (wskaźnik HUD `A.Sonar`)
- `_firePing()`: tworzy obiekt pingu `{ subX, subY, r, maxR, alpha, echoes }`, alertuje wrogów w zasięgu 1100px
- `_updatePings(dt)`: rozszerza pierścień 680px/s, wykrywa moment gdy front fali mija wroga
- `_drawPings()`: rozszerzający się cyjanowy pierścień (2px → cieńszy), echo = biały błysk + dwa pierścienie w miejscu kontaktu
- Przy wykryciu echa: `enemy.revealTimer = 5s` → precyzyjna pozycja na PPI przez 5s
- Log dziennika: nam. i dyst. kontaktu przy każdym echu
- HUD `#hud-ping`: "GOTOWY" (cyjan) lub "⟳ Xs" (pomarańczowy/czerwony)
- `_pingGfx` dodany do `_applyCamera()` (poprawna pozycja przy scrollu kamery)

**src/Enemy.js — `receivePing(subX, subY)`:**
- PATROL → detectTimer ≥ ALERT_THRESHOLD+0.4 (słyszy kierunek pingu)
- ALERT/SEARCH → detectTimer ≥ HUNT_THRESHOLD-0.8 (ping potwierdza pozycję, przyspiesza atak)
- Zawsze aktualizuje `lastKnownSubX/Y` i `lastBearingToSub`

**src/Sonar.js:**
- `update()` przyjmuje 5. param `playerPings`
- Pierścień pingu skalowany na PPI (`r / SONAR_WORLD_RANGE * this.r`)
- Echo blip na PPI: biały punkt + rozszerzający się pierścień przy namierzonym celu

**index.html:**
- Q dodany do listy sterowania (z adnotacją "14s CD")
- Nowy element HUD `#hud-ping` (A.Sonar) po Wabia

**Ryzyko taktyczne:**
- Wszystkie okręty nawodne w zasięgu 1100px słyszą ping i przechodzą co najmniej w ALERT
- W ALERT + ping → prawie natychmiastowy HUNT → nie używać blisko wrogów

---

## [0.10.3] — 2026-05-09

### Zmieniono — Nowe sprite'y wszystkich jednostek + animacje wybuchów i napędów

**src/Submarine.js — nowy kształt łodzi podwodnej:**
- Wielokątny kadłub (8-bok): `moveTo(48,0)→lineTo(38,-10)→...` — sylwetka jak prawdziwa łódź
- Cień hydrodynamiczny pod kadłubem (ciemna elipsa)
- Podświetlenie pokładu (gradient-stripe wzdłuż grzbietu)
- Kiosk (sail): trapezoidalny wielokąt z farowodami i antenami peryskopowymi
- Płetwy boczne przy kiosku (fairwater planes)
- Płetwy rufowe: pionowe (góra/dół) + poziome steru głębokości
- Pierścień dyszy + 4-łopatkowe śmigło z animacją prędkości
- Światła nawigacyjne: czerwone rufowe, zielone dziobowe
- Wycieki olejowe przy `hull < 0.3` (animowane smugi)

**src/Enemy.js — nowy kształt niszczyciela:**
- Dziobowy trójkąt (rampa wodna), podwodny cień
- Prostokąt kadłuba z linią wody
- Podwyższony dziób (forecastle), wieżyczka armatnia z lufą
- Wielopoziomowy mostek (bridge) w 3 warstwach
- Komin z animowanym dymem (4 kłęby z 3 kolorami, niezależne rotacje)
- Obrotowy radar (animacja ciągła)
- Wyrzutnia ASROC ze wskaźnikiem gotowości (zielony/żółty/czerwony)
- Rury torpedowe (2 prostokąty na rufie)
- Efekt pożaru przy `hull < 0.3` (migające płomienie)

**src/Torpedo.js — Mk.48 realistyczny korpus:**
- Silnik (elipsa tył), kadłub główny, sekcja głowicy, nos (koło)
- Pierścień śruby (okrąg kontur) + 3 animowane łopatki przy osi
- Stery rufowe: górny prostokąt, dolny prostokąt, boczny pionowy
- Podwójny ślad bąbelkowy (duże półprzejrzyste + małe białe)
- Wielopierścieniowy wybuch: błysk → kula ognia (2 warstwy) → fala główna → fala zewnętrzna → 6 bąbli powietrza

**src/Missile.js — Harpoon / Exocet styl:**
- Sekcja silnika (ciemna), kadłub główny, sekcja bojowa, głowica (trójkąt + odblask)
- Skrzydła delta (trójkąty zamiast prostokątów): góra i dół
- Stateczniki ogonowe (2 prostokąty)
- Dysza silnika: pierścień + rdzeń biały + żółty + pomarańczowy
- Pióropusz ognia: 7 kłębów z wobble-animacją (Math.sin) i decay
- Rozprysk wody podczas sea-skimmingu przy `y > SURF-14`
- Spray narzutowy dla wskaźnika lock (zielone kółko przy naprowadzeniu)
- 3-pierścieniowy wybuch + 8 odłamków na spirali + 3-poziomowa kolumna dymu

**src/EnemyASROC.js (HomingTorpedo) — Mk.44 sylwetka:**
- Sekcja silnika, kadłub, głowica bojowa, impeler (koło dziobowe)
- Kolor dynamiczny: czerwony (lock sub), pomarańczowy (lock decoy), żółty (search)
- Pierścień śruby + 3 łopatki z animacją
- Stery krzyżowe: górny, dolny, boczny
- Stożek akustycznego seekera: kolorowanie wg stanu (lock/decoy/search)
- Wielopierścieniowy wybuch jak Mk.48 + specyficzne bąble podwodne

---

## [0.10.2] — 2026-05-09

### Naprawiono — 3 błędy krytyczne (P1/P2/P3 z RAPORT.md)

**src/GameScene.js — P1: HUD torpedoCD vs. salvoCD:**
- Panel namierzania `tp-torpcd` teraz poprawnie pokazuje inter-salvo cooldown
- Nowy stan `SALWA ⟳ Xs` (kolor warning) gdy `_salvoCD > 0`, nawet jeśli rury są załadowane
- Komunikat kliknięcia LPM: „Cooldown salwy! (Xs)" zamiast „Wszystkie rury ładują się"

**src/EnemyASROC.js — P2: HomingTorpedo po wygaśnięciu wabii:**
- Dodano walidację: gdy `_decoyTarget.age >= _decoyTarget.lifetime` → `_decoyTarget = null`, `phase = 'search'`, `locked = false`
- Torpeda Mk.44 poprawnie wraca do spiralnego szukania po wygaśnięciu wabii akustycznej

**src/EnemyASROC.js — P3: Kolizja Mk.44 z terenem dna:**
- W `HomingTorpedo.update()` dodano sprawdzenie `scene.floorAt(this.x)`
- Jeśli `this.y >= floorY` → torpeda eksploduje natychmiast (bez obrażeń)
- Unika sytuacji gdy torpeda „przelatuje przez skały" bez efektu

---

## [0.10.1] — 2026-05-09

### Dodano — Bot taktyczny (pełna symulacja gracza)

**src/TestBot.js — pełny przepis:**
- 10 stanów AI: `DIVE → PATROL → LISTEN → STALK → FIRE_TORP → FIRE_MISSILE → EVADE → DEPLOY_DECOY → SURFACE_O2 → RECHARGE`
- Tryb NASŁUCH — zatrzymuje silnik na 8s, loguje kontakty z bearingiem i dystansem
- Atakuje torpedami z punktem ołowiu (lead shot) uwzględniającym prędkość celu
- Wynurza się na SHALLOW_Y do rakiet, natychmiast zanurza po strzale
- Wykrywa przychodzące torpedy (HomingTorpedo z ASROC) i wyrzuca wabię
- Po wyrzuceniu wabii — sprint prostopadle i przejście do EVADE
- Zarządzanie baterią: niski próg → RECHARGE (snorchel), krytyczny → natychmiast
- Zarządzanie tlenem: O₂ < 14% → SURFACE_O2 (priorytet absolutny)
- Raport końcowy z sesji: torpedy, rakiety, wabie, manewry, nasłuchy
- `scene.STATE` udostępnione w GameScene dla bota i innych modułów

---

## [0.10.0] — 2026-05-09

### Dodano — Lewy panel UI + wabie akustyczne + wyższy poziom trudności

**index.html — nowy układ paneli:**
- Nowy `#left-panel` (195px, ciemny terminal, lewa krawędź gry) zawierający:
  - Panel „Namierzanie" (`#target-panel`) jako sekcja
  - Separator `.lp-divider`
  - Panel „Sterowanie" (`#controls-panel`) jako sekcja
- Panele przeniesione poza `#game-container` (wcześniej nakładały się na grę)
- Dodany klawisz `T` — wabia akustyczna — do listy sterowania
- Nowy element HUD `#hud-noisemakers` pokazujący liczbę pozostałych wabii
- CSS: scanlines i vignette dla `#left-panel`, klasy `.lp-section-title`, `.lp-divider`

**src/Enemy.js — trudniejszy AI:**
- `BASE_HYDROPHONE`: 420 → 560 (lepsze hydrofony wroga)
- `ALERT_THRESHOLD`: 2.2 → 1.4 (szybciej przechodzi w ALERT)
- `HUNT_THRESHOLD`: 8.0 → 5.5 (szybciej przechodzi w HUNT)
- `SEARCH_DURATION`: 55 → 70s (dłużej szuka po utracie kontaktu)
- `CHARGE_COOLDOWN`: 14.0 → 9.0s (częstsze zrzuty głębinowe)
- `CHARGE_BLAST_R`: 88 → 108px (większy promień wybuchu)
- `ASROC_COOLDOWN`: 90 → 55s (częstsze rakiety ASROC)
- `SHOCK_BASE`: 5.0 → 3.0s (szybsza reakcja po trafieniu)
- Próg wycofania: `hull < 0.5` → `hull < 0.25` (walczy dłużej)
- Próg stanu WITHDRAW: `hull < 0.25` → `hull < 0.10` (walczy do końca)
- Obrażenia od zarzutów: `ratio * 0.40` → `ratio * 0.58`

**src/Submarine.js — realistyczne czasy reakcji:**
- Czas przeładowania rur: 55–80s → **90–120s**
- Nowy cooldown między wystrzeleniami: 6s (inter-salvo)
- Dodano `noisemakerCount = 3` i `noisemakers = []`
- Nowa metoda `deployNoisemaker()` — wyrzuca wabię akustyczną

**src/EnemyASROC.js — torpeda naprowadza na wabie:**
- `HomingTorpedo` sprawdza `scene.sub.noisemakers` przed szukaniem łodzi
- Jeśli wabia w zasięgu głowicy → torpeda przełącza cel na wabię
- Kolizja z wabią: niszczy wabię bez obrażeń dla okrętu
- Nowe pole `_decoyTarget` śledzi aktualny cel (null = okręt)

**src/GameScene.js — integracja:**
- Dodano klawisz `T` (deploy noisemaker)
- `scene.noisemakers` jako alias dla `sub.noisemakers` (dla EnemyASROC)
- `_drawNoisemakers()` — pulsujące pierścienie i pasek czasu życia
- HUD `hudNoisemakers` — kolor zmienia się: niebieski→żółty→czerwony
- `#left-panel` aktywowany przy starcie gry (`.classList.add('active')`)

---

## [0.9.1] — 2026-05-09

### Zmieniono — Czytelność UI + realistyczny gradient oceanu

**index.html (CSS):**
- Ocean wrócił do ciemnej palety (głębiej = ciemniej)
- Fonty paneli powiększone: ctrl-title 8→9px, ctrl-desc 8→9px, kbd 8→9px
- Panel namierzania: tp-label 8→9px, tp-value 12→13px, tp-threat 8→9px
- Dziennik: log-entry 9.5→10px, log-time 8→8.5px
- Scanlines bocznego panelu: opacity 0.14 → 0.07, co 3px zamiast 2px (mniej zasłania tekst)
- Winietowanie bocznego panelu: 0.55 → 0.30 (krawędzie mniej przyciemnione)
- Naprawiono inline-style: hud-torp-reload (#888 → #aaffcc), hud-wave (#aaaaaa → #ccddff), hud-missiles (#ffaa00 → #ffcc44)
- Etykiety kontaktów na sonarze: 7→9px, kolor #44ffcc → #66ffdd

**src/Ocean.js — gradient głębokości:**
- Niebo: #002244 → #000c1a (ciemniejszy)
- Epipelagik: gradient #001e3d → #002a55 (ciemny, realistyczny niebieski)
- Mezopelelagik: gradient #001830 → #000308 (coraz ciemniej w głąb)
- Fala: 2.0px #88ffff → 1.8px #55d8ff (mniej krzykliwa)
- Cząsteczki: mniejsze i mniej liczne

---

## [0.9.0] — 2026-05-09

### Zmieniono — Jaśniejszy wygląd UI i świata

**index.html (CSS):**
- HUD: etykiety opacity 0.6 → 0.85, kolor `#5aff9a`, mocniejszy text-shadow
- Paski HUD: ciemniejsze tło i ramka zastąpione jaśniejszymi (`#0d2818`, `#226040`)
- Paski HUD: domyślny fill jaśniejszy (`#55ffaa`), warn/danger/charging — większy kontrast
- Panel sterowania: ciemniejsze tło → `rgba(0,14,6,0.82)`, ramka `#1a5535`, kbd jaśniejsze
- Panel namierzania: tp-label `#46aa70`, tp-value `#55ffaa`, jaśniejsze stany ready/warning/danger
- Panel boczny: tło `#011408`, lewa ramka `#008a35`, nagłówek `#001408`
- Dziennik: log-panel-title `#00ee55`, czas `#22ff77`, vessel `#008a32`
- Separatory `#006030`, wpisy `#00d855`, czas wpisu `#009040`
- Typy wpisów: warn `#ffcc44`, danger `#ff5050`, good `#22ffaa`, info `#66ccff`
- Kursor `#22ff77` z mocniejszym glow

**src/Ocean.js:**
- Niebo: `#000814` → `#001428`
- Epipelagik: `#001f3d`→`#003060`, gradient do `#005090` (widoczny błękit)
- Termoklina: `#0a4060` → `#0a6080` at 0.45 (wyraźniejsza warstwa)
- Mezopelelagik: gradient `#003060` → `#001025` (ciemniejszy głębiej, ale wyraźny u góry)
- Teren dna: `#1a0e06` → `#28180a`, tekstura `#3c2810`
- Skały: igłice `#352015`, ściana `#503a25` — widoczniejsze
- Linijka głębokości: `#1a4a3a` → `#246655` at 0.70
- Fala: `1.5px 0x4af0ff` → `1.8px 0x66f8ff at 0.80`
- Cząsteczki: `0x88ddff` → `0xaaeeff`, alpha ×1.3
- Poświata termokliny: `0x00aacc` → `0x00ccee`, grubość 1.5px, wyraźniejszy puls

**src/Sonar.js:**
- Tło sonaru: `0x000d05` → `0x001408` — wyraźniejszy zielony odcień
- Siatka: `0x0c3a18` at 0.40 → `0x10522a` at 0.55
- Sweep line: 1.8px → 2.2px, kolor `0x55ffaa`, poświata ogona 0.13→0.20
- Obramowanie: `0x1a6a3a` → `0x22884a`, wewnętrzna `0x44ff88` at 0.25
- Etykieta SONAR PAS.: `#1a6a3a` → `#33aa66`
- DEMON waterfall: tło `#001408`, jasniejszy zielony kanał (80+175), czerwony wcześniej (0.55)
- DEMON etykiety Hz: `#1a6a2a` → `#22882a`

**src/GameScene.js:**
- Etykieta TERMOKLINA: `#0a6a5a` → `#0e9a80` at 0.8
- Linia 300m: `0xff6600` at 0.25 → `0xff8800` at 0.42
- Linia 400m: `0xff2200` at 0.35 → `0xff3300` at 0.55
- Etykiety limitów: ciemne → `#cc7700` / `#cc3300` at 0.75–0.85
- Etykiety głębokości: `#1a4a3a` at 0.55 → `#2a7060` at 0.80
- Mapa taktyczna: tytuł `#33cc66`, info `#2a9a5a`, etykiety głębokości jaśniejsze

---

## [0.8.0] — 2026-05-09

### Dodano — Mapa taktyczna [M]

**GameScene.js:**
- Klawisz `M` — toggle live overlay 976×368px rysowany na depth 150
- Nagrywanie trasy gracza co 2s (do 150 próbek = ~5 minut historii)
- `_drawTacticalMap()`:
  - Proceduralny teren dna widoczny na mapie (próbkowanie co 160px)
  - Strefy głębokości kolorami (epipelagik / mezopelelagik)
  - Linia termokliny (cyan) i głębokości krytycznej (pomarańczowa)
  - Siatka: pionowe co 2000px (~2.4km), poziome co 100m głębokości
  - Zielona trasa z zanikaniem historii + kropki co 6 próbek
  - Linie namiarowe (bearing lines z sonaru) gdy brak triangulacji
  - Diamentowe ikony kontaktów przy triangulowanych pozycjach
  - Strzałki trendu: ↗ ZBLIŻA SIĘ (czerwona), ↙ ODDALA SIĘ (niebieska)
  - Pulsujący krąg przy kontaktach w STATE.HUNT
  - Kręgi zasięgu: sonar (820px, niebieski) i torpeda (950px, żółty)
  - Etykiety km na siatce, głębokości, skala 2km, liczniki aktywne/namierzone/poziom
- 7 obiektów tekstowych + pool etykiet km

**index.html:** M dodany do panelu sterowania

---

## [0.7.0] — 2026-05-09

### Dodano — Tryb piaskownicy, proceduralny teren, świat ×3

**Ocean.js** — kompletne przepisanie:
- Proceduralny teren dna: 6 oktaw sinusoidalnych (75+48+24+12+5+2px amplitudy), próbkowanie co 8px
- Teren rysowany jako wielokąt zamiast płaskiego prostokąta
- Skały i seamounty na wzniesieniach (prog y < SURFACE_Y+415) — iglica + boczna skała + osad
- `scene.floorAt(x)` — interpolowana głębokość dna w dowolnym punkcie X
- Optymalizacja: fala i cząsteczki rysowane tylko w widocznym obszarze kamery
- 90 cząsteczek (było 60) — uwzględniają teren przy resetowaniu pozycji

**Submarine.js:**
- `_clampToWorld()`: kolizja z proceduralnym terenem przez `scene.floorAt(this.x)`
- Granica pozioma: wrap → clamp + odbicie od ściany (prędkość ×-0.4)

**GameScene.js:**
- `WORLD_W`: 4 096 → 12 000px (~14.4km, ×3 większy świat)
- Czas do pierwszego spawnu wrogów: 30s → 15s
- System fal zastąpiony trybem piaskownicy:
  - `_sandboxUpdate(dt)` — utrzymuje 3–9 aktywnych okrętów zależnie od poziomu zagrożenia
  - `_spawnSandboxEnemy()` — nowy wróg min. 2400px od gracza, losowy korytarz patrolu 950–2550px
  - Cooldown spawnu: 5s gdy morze puste, 18s gdy żyją już jakieś okręty
  - Eskalacja: poziom zagrożenia rośnie co 120s (wpis w dzienniku)
- Etykiety wrogów: `ORP-N` → `BPK-N` (Bolshoy Protivolodochnyy Korabl — historycznie poprawne)

---

## [0.6.0] — 2026-05-09

### Dodano — Zimnowojennie polowanie (DEMON / NASŁUCH / Klasyfikacja)

**Sonar.js** — kompletne przepisanie:
- DEMON waterfall na HTML canvas — wodospad częstotliwości 8–35 Hz, 22 biny, 42 wiersze, odświeżany co 1.4s; każdy niszczyciel ma losowy tonus charakterystyczny
- Klasyfikacja pasywna kontaktów: `UNK` → `SURFACE` (po 18s nasłuchu) → `WARSHIP` (po 55s); klasyfikacja przyspieszona 2.2× w trybie NASŁUCH
- Dual EMA (okno 5s / 18s) do wykrywania trendu zbliżania: `ZBLIŻA SIĘ` / `ODDALA SIĘ`
- Etykiety kontaktów na PPI: `?K1` (UNK), `·K1` (SURFACE), `◆K1` (WARSHIP), `↙K1` (WITHDRAW)
- Pierścień nasłuchu — zielona pulsująca poświata wokół PPI gdy tryb NASŁUCH aktywny
- Eksport `sonar.contacts` do GameScene z polami: `approach`, `contactClass`, `sig`

**Submarine.js:**
- Getter `listenMode` — true gdy prędkość < 12 px/s i moc silnika < 0.08 i brak kawitacji
- Getter `sonarBonus` — 1.6× mnożnik zasięgu sonarowego w trybie NASŁUCH

**Enemy.js:**
- Pole `tonal` — losowa częstotliwość charakterystyczna 8–35 Hz (różna dla każdego okrętu)
- Pole `contactClass` — aktualna klasyfikacja: `UNK` / `SURFACE` / `WARSHIP`
- Pole `classifyTimer` — akumulator czasu ekspozycji

**GameScene.js:**
- HUD: etykieta `Prędkość` → `NASŁUCH ◉` (zielona) gdy tryb nasłuchu aktywny
- Panel namierzania: wiersze `KLASIF` i `TREND` z danych sonar.contacts

**index.html:**
- `<canvas id="demon-display">` 232×78px w panelu bocznym między separatorem a dziennikiem
- Wiersze `KLASIF` i `TREND` w panelu namierzania
- CSS klasa `.hud-label.listen` dla indikatora NASŁUCH

---

## [0.5.0] — 2026-05-09

### Dodano — System rur torpedowych

**Submarine.js:**
- 4 niezależne rury torpedowe, każda z losowym czasem przeładowania 55–80s
- Getter `torpedoCount` — ile rur gotowych (backward compat)
- Getter `torpedoFireCD` — czas do pierwszej gotowej rury (backward compat)
- Getter `tubeReadyFraction` — ułamek postępu ładowania najszybszej rury (dla łuku celownika)
- `fireTorpedo()` zwraca `tube.id` (truthy) lub `false`
- `recentTubeLoaded` — id rury załadowanej w ostatniej klatce (dla powiadomień)

**GameScene.js:**
- HUD torpedy: wyświetla `2/4` + `⟳ 47s` (czas do następnej gotowej)
- Panel namierzania: `GOTOWA (2/4)` lub `⟳ 1m 08s`
- Powiadomienie o załadowaniu rury + wpis w dzienniku
- Łuk celownika pokazuje postęp ładowania gdy wszystkie rury ładują się

---

## [0.4.0] — 2026-05-08

### Dodano — Realistyczne zachowanie wroga po trafieniu

**Enemy.js:**
- Stan `STATE.WITHDRAW = 4` — wycofywanie po poważnym trafieniu
- Stała `SHOCK_BASE = 4.5s` — czas szoku; prędkość 15%→100% przez SHOCK_BASE sekund
- Metoda `onHit()` — ustawia timer szoku, redukuje `detectTimer`, wyzwala WITHDRAW gdy kadłub < 50%
- `evadeTorpedo()` — zdrowy: manewr 3s×1.1×; uszkodzony: 7s×1.8×
- Ślad olejowy — ciemne elipsy na powierzchni gdy okręt się wycofuje (zanikają po 45s)
- Animacja szoku — biały migający prostokąt przez czas trwania szoku
- Dym podczas WITHDRAW — szare kłęby nad okrętem
- Defensywny ASROC podczas WITHDRAW (gdy kadłub > 10%)

**GameScene.js:**
- `enemy.onHit()` i `target.onHit()` wywoływane w handlerach trafień
- Wpis w dzienniku przy przejściu do WITHDRAW ze śladem olejowym

### Naprawiono
- Spam termokliny i zamrożenie UI przy oscylacji na granicy termokliny:
  - Submarine.js: histereza ±10px (`THERMO_Y + 10` / `THERMO_Y - 10`)
  - GameScene.js: cooldown 8s między wpisami o przekroczeniu termokliny

---

## [0.3.0] — 2026-05-08

### Dodano — Panel boczny: dziennik pokładowy (terminal fosforowy)

**index.html:**
- `#game-wrapper` — flex kontener owijający `#game-container` i `#side-panel`
- `#side-panel` 252×640px — terminal CRT z efektami:
  - Scanlines (`repeating-linear-gradient`)
  - Winietowanie rogów (`radial-gradient`)
  - Animacja pulsowania kropki statusu
  - Zegar misji `#ship-log-time`
  - Wpisy dziennika z kolorami: `warn`, `danger`, `good`, `info`
  - Migający kursor `▮` na dole
- `#hud-torp-reload` — nowy span w HUD torpedy

**GameScene.js:**
- Dziennik aktywowany przez `classList.add('active')` przy starcie gry
- Wszystkie wpisy `_shipLog()` przepisane na taktyczny styl marynarki wojennej:
  - Namiery w stopniach (`brg()`), dystanse w metrach (`rng()`)
  - Skrótowy język meldunków bojowych
- Pomocniki `_brg(x1,y1,x2,y2)` i `_rng(x1,y1,x2,y2)` dla namiarów morskich

---

## [0.2.0] — 2026-05-08

### Dodano — Sonar PPI, sonar pasywny i triangulacja

**Sonar.js:**
- PPI (Plan Position Indicator) — obrotowy sweep ~8.4s/obrót
- Smear (ślady zanikające 10s) z kodowaniem kolorem wg stanu AI
- Etykiety kontaktów K-1, K-2… na krawędzi tarczy
- Torpedy ASROC i torpedy gracza widoczne na PPI

**GameScene.js:**
- Sonar pasywny — linie namiarowe z tick-markami w widoku głównym
- Triangulacja co 4s z co najmniej 2 próbek namiarów
- Triangulowane pozycje widoczne jako krzyżyki na PPI i w widoku gry
- Wpisy triangulacji w dzienniku (dokładna / przybliżona)

---

## [0.1.2] — 2026-05-08

### Dodano — ASROC, bot testowy, sea-skimming rakiety

**EnemyASROC.js** — nowy plik:
- Rakieta przeciw-okrętowa wystrzelona z niszczyciela
- Lot balistyczny do punktu uderzenia + nurkowanie
- Torpeda samonaprowadzająca po nurkowniku

**Missile.js** — nowy plik:
- Rakieta gracza (`R` / PPM) — sea-skimming (ślizg tuż nad wodą)
- Wykrywanie trafień w niszczyciele z obrażeniami

**TestBot.js** — nowy plik:
- Autonomiczny bot testujący sterowanie łodzią (`B` = toggle)
- Fazy: zanurzanie, sprint, torpedy, uniki

**Enemy.js:**
- Sprint-and-listen taktyka AI — szybki sprint, potem cisza i nasłuch
- Praca z ASROC podczas stanu HUNT

---

## [0.1.1] — 2026-05-08

### Dodano — Lepsze AI, system fal

**Enemy.js:**
- Stan `STATE.SEARCH` — przeszukiwanie obszaru po utracie kontaktu
- Koordynacja radiowa — niszczyciel w HUNT alarmuje pobliskie okręty
- `getContactInfo()` — zwraca bearing i odległość dla sonaru

**GameScene.js:**
- System fal — po zniszczeniu wszystkich wrogów za 20s pojawia się kolejna fala (szybsza)
- Wskaźnik fali w HUD

---

## [0.1.0] — 2026-05-08

### Dodano — Przepisanie broni i AI

**Torpedo.js** — nowy plik (wydzielony z Submarine):
- Torpeda Mk.48 z szukaczem akustycznym
- Zdalna detonacja (`E`)
- Sprawdzanie trafień + obrażenia

**Enemy.js** — przepisanie:
- Maszyna stanów: `PATROL(0)`, `ALERT(1)`, `HUNT(2)`
- Hydrofony z zasięgiem i kawitacją wpływającą na detekcję
- Zarzuty głębinowe z eksplozjami i obrażeniami
- `evadeTorpedo()` — manewr unikania

**Submarine.js:**
- Rakieta przeciw-okrętowa (wydzielona do Missile.js)
- `noiseEffective` — hałas z uwzględnieniem termokliny

---

## [0.0.1] — 2026-05-08 — Prototyp

### Dodano — Bazowy silnik gry

- **Phaser 3 + Vite 4.5** — setup projektu
- **Ocean.js** — tło oceanu, animowane fale na powierzchni
- **Submarine.js** — fizyka łodzi:
  - Balast i wypornność (tryb nurk/wynurz)
  - Pitch (kąt dzioba), tarcie hydrodynamiczne
  - Kawitacja przy > 60% mocy
  - Termoklina (y=280) — redukcja hałasu akustycznego o 42%
  - Śnorchel — ładowanie baterii przy < 5m głębokości
  - Hotel load — zużycie baterii przez systemy okrętowe
  - Tlen — zużycie pod wodą, ładowanie na powierzchni
  - Detekcja kolizji z dnem i powierzchnią
- **Enemy.js** — 3 niszczyciele z hydrofonami, zarzuty głębinowe
- **GameScene.js** — ręczna kamera (lerp), sterowanie klawiaturą/myszą
- **HUD** — głębokość, prędkość, balast, hałas, kadłub, bateria, tlen
- **Efekty CRT** — scanlines, winietowanie, screen shake przy eksplozjach
