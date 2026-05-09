# Raport stanu projektu — Operacja Październik
*Wygenerowany: 2026-05-09 | Wersja kodu: 0.10.1*

---

## 1. Co zostało zrobione

### Silnik fizyki okrętu podwodnego
Pełna symulacja fizyczna: balast (targetBallast z lerpem), wypornność,
bezwładność, tarcie hydrodynamiczne, pitch dzioba od prędkości.
Kawitacja wchodzi przy >60% mocy i drastycznie zwiększa hałas akustyczny.
Termoklina (Y=280px) działa jako warstwa maskowania — hałas okrętu redukowany
o 50% dla hydrofonów wroga gdy jest poniżej. Histereza ±10px eliminuje spam UI
przy oscylacji na granicy.

Bateria zużywa się od silnika + hotel load (oświetlenie, elektronika).
Śnorchel ładuje baterię gdy głębokość < 18m. Tlen zużywa się pod wodą i
wraca przy powierzchni. System tlenowy z progami ostrzegawczymi w HUD.

Proceduralny teren dna: 6 oktaw sinusoidalnych (okresy 33px–15700px),
iglice skalne na wzniesieniach, kolizja z rzeczywistym profilem terenu przez
`scene.floorAt(x)`. Świat 12 000px (~14.4km).

### Uzbrojenie gracza
- **Torpeda Mk.48** — szukacz akustyczny, samonaprowadzanie na ciepłe cele,
  zdalna detonacja [E]. 4 rury, reload 90–120s (każda rura osobno), cooldown
  6s między kolejnymi wystrzeleniami (inter-salvo). Celownik z punktem ołowiu
  (lead indicator) i rombem intercepcji.
- **Rakieta p/okrętowa** — 2 sztuki, sea-skimming, wymaga głębokości ≤70m.
  Odpalana prawym przyciskiem myszy lub [R].
- **Wabia akustyczna [T]** — 3 sztuki, 45s aktywności, sygnał noise=1.2.
  Torpedy Mk.44 z ASROC namierzają się na wabię zamiast na okręt. Wizualizacja:
  pulsujące pierścienie akustyczne + pasek czasu życia.

### Sonar pasywny i wykrywanie
- **PPI sonar** (prawy dolny róg) — obrotowy sweep 360°, zanikające ślady
  kontaktów (smear 10s), pulsujący pierścień trybu NASŁUCH.
- **Linie namiarowe** w widoku głównym — pokazują kierunek do kontaktu.
- **Triangulacja** z 2+ pomiarów po 4s — oblicza przybliżoną pozycję wroga.
- **Tryb NASŁUCH** — prędkość < 12px/s i silnik < 8% → bonus 1.6× zasięgu sonaru.
- **Klasyfikacja kontaktów**: UNK → SURFACE → WARSHIP (akumulacja czasu ekspozycji).
- **DEMON waterfall** w dzienniku bocznym — 22 biny 8–35 Hz, 42 wiersze
  historii, dual EMA trend (ZBLIŻA SIĘ / ODDALA SIĘ).

### AI wrogów (niszczyciel)
Maszyna stanów: PATROL → ALERT → HUNT → SEARCH → WITHDRAW.

Hydrofony 560px zasięgu, próg ALERT=1.4s, HUNT=5.5s. Sprint-and-listen:
niszczyciel zatrzymuje się co ~14s żeby słuchać w ciszy. Aktywny sonar co 5s
w trybie HUNT — każdy ping boost +3.5 do detection timer.

Zarzuty głębinowe co 9s, promień 108px, obrażenia do 58% kadłuba na strzał.
ASROC co 55s — lot paraboliczny → zrzut Mk.44 z naprowadzaniem akustycznym
(spiral search → homing). Wróg walczy do hull < 0.10, nie ucieka przy 50%.

Koordynacja radiowa: okręt w HUNT wysyła pozycję gracza do wszystkich wrogów.
Manewr unikania torpedy: krótki sprint (zdrowy) lub pełna panika (uszkodzony).
Szok po trafieniu: 3s dezorientacji, spowolnienie 15%→100%. Ślad olejowy
podczas WITHDRAW.

### UI i HUD
- **HUD** (pasek górny): głębokość, prędkość/NASŁUCH, balast, hałas,
  kadłub, bateria, tlen, torpedy (x/4 + czas reload), rakiety, wabie, numer fali.
- **Lewy panel** (195px, poza oknem gry): namierzanie (bearing, dystans,
  rozwiązanie, torpCD, klasyfikacja, trend) + sterowanie z klawiszami.
- **Prawy panel** (252px): dziennik pokładowy CRT z scanlines, DEMON waterfall,
  czas misji, status systemu.
- **Alert banner**: NAMIERZONE (żółty) / WYKRYTO!! (czerwony pulsujący).
- **Mapa taktyczna [M]**: live overlay — teren dna, trasa gracza, kontakty,
  zasięgi hydrofonu, siatka km, głębokości referencyjne.
- **Bot testowy [B]**: 10-stanowa AI testująca wszystkie mechaniki, panel
  z logiem decyzji i raportem końcowym sesji.

---

## 2. Znane błędy i problemy

### Krytyczne (wpływają na rozgrywkę)
| # | Problem | Plik | Status |
|---|---------|------|--------|
| ~~B1~~ | ~~`torpedoFireCD` nie blokuje strzału podczas `_salvoCD`~~ | GameScene.js | ✅ **NAPRAWIONO** v0.10.2 — HUD pokazuje „SALWA ⟳ Xs" |
| B2 | Bot ignoruje `_salvoCD` w `_considerAttack` | TestBot.js:245 | Sprawdza `sub._salvoCD <= 0` ale wywołuje `fireTorpedo` z wewnątrz `STALK` — może próbować strzelać zbyt wcześnie. |
| ~~B3~~ | ~~`HomingTorpedo._decoyTarget` nie jest kasowany przy zmianie fazy~~ | EnemyASROC.js | ✅ **NAPRAWIONO** v0.10.2 — walidacja age/lifetime + reset do search |
| ~~B4~~ | ~~Teren dna nie jest brany pod uwagę przez ASROC~~ | EnemyASROC.js | ✅ **NAPRAWIONO** v0.10.2 — kolizja z `scene.floorAt(x)` |
| B5 | `EnemySub.js` istnieje w kodzie ale nie jest używany | GameScene.js | Klasa okrętu podwodnego wroga zdefiniowana, ale nie spawni się w grze. |

### Średniej wagi (psują feeling gry)
| # | Problem | Plik | Opis |
|---|---------|------|------|
| B6 | Radar wroga „widzi przez teren" | Enemy.js:211 | Obliczenie zasięgu hydrofonu nie uwzględnia przeszkód terenowych — wróg słyszy okręt przez góry dna. |
| B7 | Torpeda gracza nie unika terenu | Torpedo.js | Mk.48 przelatuje przez skały i teren dna bez kolizji. |
| B8 | Wróg nie respawnuje po zniszczeniu | GameScene.js | W trybie piaskownicy nowi wrogowie pojawiają się co 2min, ale zniszczony slot nie jest wypełniany szybciej. |
| B9 | Romb intercepcji (lead indicator) zakłada stałą prędkość wroga | GameScene.js:988 | Jeśli wróg zmienia prędkość (ALERT vs PATROL), lead jest niepoprawny. |
| B10 | Panel `#left-panel` nie ma własnego `overflow-y: auto` | index.html | Przy małym ekranie dolna część panelu sterowania może być ucięta. |

### Kosmetyczne
| # | Problem | Opis |
|---|---------|------|
| B11 | Ślad olejowy niszczyciela (`_oilDrops`) rysowany w pętli bez culling | Wróg poza ekranem rysuje krople oleju niewidoczne ale kosztowne. |
| B12 | Bot w stanie `STALK` idzie powoli nawet gdy wróg się oddala | Powinien przyspieszyć gdy dystans > 1.2× TORP_RANGE. |
| B13 | `ROADMAP.md` ma zduplikowaną linię „Torpeda akustyczna wabik" | Raz jako ✅ (noisemaker), raz już usunięte z listy. |

---

## 3. Co wymaga poprawy — priorytety

### Pilne (natychmiast psują grywalność)

~~**P1 — Fix: HUD torpedoCD vs. salvoCD**~~ ✅ **NAPRAWIONO** v0.10.2

~~**P2 — Fix: HomingTorpedo po wygaśnięciu wabii**~~ ✅ **NAPRAWIONO** v0.10.2

~~**P3 — Fix: Kolizja torpedy Mk.44 z terenem**~~ ✅ **NAPRAWIONO** v0.10.2

### Ważne (duże poprawki rozgrywki)

**P4 — EnemySub w grze**
`EnemySub.js` jest napisany ale nie spawni się. Dodać do systemu spawnu
jako rzadki, groźny kontakt (widoczny tylko na DEMON, niewidoczny wzrokowo).

**P5 — Aktywny sonar gracza [Q lub Ping]**
Gracz powinien móc wysłać ping — natychmiastowa pozycja wszystkich celów
w zasięgu, ale +30s do detectTimer wroga. Klasyczny trade-off.

**P6 — Audio (cokolwiek)**
Gra jest całkowicie niema. Nawet prosty hum silnika i dźwięk eksplozji
zrobiłyby ogromną różnicę w atmosferze.

**P7 — Sprite'y zamiast prymitywów**
Okręt gracza, niszczyciel i torpedy są rysowane jako `fillEllipse`/`fillRect`.
Wymiana na prawdziwe sprite'y (nawet proste grafiki 2D) dramatycznie
podniesie jakość wizualną.

**P8 — Zapis stanu gry (localStorage)**
Gracz nie może pauzować i wróćić. Brak zapisu to poważna bariera.

### Warte rozważenia (kolejne sesje)

**P9 — System misji**
Tryb piaskownicy jest dobry do testów, ale brak narracji i celu czyni grę
płytką. Choćby jedna liniowa misja (np. śledź i zatop radziecki niszczyciel
X zanim dotrze do strefy Y) da powód żeby grać.

**P10 — Biologics na DEMON**
Fałszywe kontakty (ławice ryb: 8–12 Hz, wieloryby: stały ton ~20 Hz)
utrudniają klasyfikację i dodają realizm.

**P11 — Historia bearing (bearing wąż)**
Zamiast jednej linii namiarowej — pokazuj ostatnie 20s historii bearingów
jako zanikający wąż. Gracze mogą wtedy ręcznie odczytać ruch celu.

**P12 — Culling obiektów poza ekranem**
Zarzuty głębinowe, pierścienie sonarowe i ślady olejowe poza `camX..camX+1024`
nie powinny być rysowane. GameScene ma ~15 pętli rysujących bez sprawdzenia
widoczności.

---

## 4. Stan plików źródłowych

| Plik | Wiersze | Opis |
|------|---------|------|
| GameScene.js | 1467 | Centralny hub — za duży, warto wydzielić `_updateHUD`, `_drawBearings`, `_updateSandbox` do osobnych plików |
| TestBot.js | 666 | Nowy — 10 stanów, dobry |
| Enemy.js | 650 | Dobry stan |
| Submarine.js | 511 | Dobry stan |
| Sonar.js | 448 | Dobry stan |
| EnemyASROC.js | 373 | Bug B3, B4 do naprawy |
| EnemySub.js | 366 | Napisany, nieużywany (P4) |
| MenuScene.js | 303 | Faktycznie nie używana — gra startuje bezpośrednio |
| Missile.js | 246 | Dobry stan |
| Torpedo.js | 212 | Bug B7 — brak kolizji z terenem |
| Ocean.js | 198 | Dobry stan |
| main.js | 20 | Minimalny |

**Łącznie: ~5 460 wierszy kodu źródłowego**

---

## 5. Priorytety na następną sesję

```
1. [FIX]  B3 — HomingTorpedo wraca do szukania po wygaśnięciu wabii
2. [FIX]  B4 — kolizja Mk.44 z terenem dna
3. [FIX]  B1 — HUD tp-torpcd pokazuje prawdziwy cooldown
4. [ADD]  P4 — EnemySub spawning (chociaż 1 na sesję)
5. [ADD]  P5 — Aktywny sonar gracza [Q]
6. [ADD]  P6 — Audio: hum silnika + eksplozja (WebAudioAPI lub Howler.js)
7. [ADD]  P9 — Misja 1: prosty cel z intro tekstowym
8. [OPT]  P12 — Culling niewidocznych obiektów
```

---

*Raport wygenerowany na podstawie analizy kodu źródłowego i historii zmian.*
*Następna wersja: 0.11.0*
