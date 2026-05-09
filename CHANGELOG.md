# Changelog — Operacja Październik

Wszystkie zmiany w projekcie. Format oparty na [Keep a Changelog](https://keepachangelog.com/pl/1.0.0/).

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
