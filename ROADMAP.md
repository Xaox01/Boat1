# Roadmap — Operacja Październik

Gra przeglądarkowa symulująca okręt podwodny w realiach zimnej wojny (Phaser 3 + Vite).
Priorytety oznaczone: 🔴 wysoki · 🟡 średni · 🟢 niski · ✅ gotowe

---

## Silnik fizyki

| Status | Cel |
|--------|-----|
| ✅ | Balast, wypornność, pitch dzioba |
| ✅ | Tarcie hydrodynamiczne, bezwładność |
| ✅ | Kawitacja przy > 60% mocy |
| ✅ | Termoklina — warstwa maskowania akustycznego |
| ✅ | Histereza termokliny ±10px (bez spamu UI) |
| ✅ | Śnorchel — ładowanie baterii przy powierzchni |
| ✅ | Hotel load — pasywne zużycie baterii |
| ✅ | System tlenowy — wyczerpanie pod wodą |
| 🔴 | Prądy oceanu — poziome znoszenie w zależności od głębokości |
| 🔴 | Kąt natarcia do torpedy — wpływ prędkości łodzi na trajektorię |
| 🟡 | Zniszczenie systemów — utrata sonaru / napędu od obrażeń |
| 🟡 | Przeciążenie ciśnieniowe przy przekroczeniu głębokości kruszenia |
| 🟢 | Trim — kontrola kąta poprzecznego (obrót wokół osi Z) |
| 🟢 | Silnik Diesla na powierzchni — szybsze ładowanie, większy hałas |

---

## Broń i taktyka

| Status | Cel |
|--------|-----|
| ✅ | Torpeda Mk.48 — szukacz akustyczny, zdalna detonacja |
| ✅ | 4 niezależne rury torpedowe, przeładowanie 55–80s |
| ✅ | Rakieta przeciw-okrętowa — sea-skimming |
| ✅ | Łuk celownika z punktem ołowiu |
| ✅ | Romb intercepcji (lead indicator) |
| 🔴 | Torpeda samonaprowadzająca na podczerwień — kontrmanewry IR |
| 🔴 | Torpedy z przewodem — sterowanie ręczne po odpaleniu |
| 🔴 | Miny morskie — stawianie i omijanie |
| 🟡 | Termoklinowe uniki torpedy — jeśli torpeda nie zejdzie głębiej |
| 🟡 | Fanowi wyrzut — odpalenie wielu torped jednocześnie (spread) |
| 🟡 | Rakieta balistyczna (SLBM) — cel strategiczny długiego zasięgu |
| 🟢 | Torpeda akustyczna wabik (noisemaker) — odciąganie torped |

---

## Sonar i wykrywanie

| Status | Cel |
|--------|-----|
| ✅ | PPI (Plan Position Indicator) — obrotowy sweep |
| ✅ | Smear — zanikające ślady kontaktów (10s) |
| ✅ | Sonar pasywny — linie namiarowe w widoku głównym |
| ✅ | Triangulacja pozycji wroga z 2+ pomiarów |
| ✅ | Tryb NASŁUCH — 1.6× bonus zasięgu przy niskiej prędkości |
| ✅ | Klasyfikacja kontaktów: UNK → SURFACE → WARSHIP |
| ✅ | DEMON waterfall — analiza widmowa 8–35 Hz |
| ✅ | Dual EMA — trend ZBLIŻA SIĘ / ODDALA SIĘ |
| 🔴 | Ping aktywny (ACTIVE SONAR) — wysokie ryzyko wykrycia, precyzyjna pozycja |
| 🔴 | Zakłócenia termokliny na sonarze — ślepa strefa poniżej warstwy |
| 🔴 | Biologics — fałszywe kontakty (ławice ryb, wieloryby) na DEMON |
| 🟡 | Historia bearing — wąż namiarowy pokazujący ruch kontaktu w czasie |
| 🟡 | Sonar boczny — holowany hydrofor TASS (wyższy zasięg, brak zwrotu) |
| 🟡 | Identyfikacja wizualna przez peryskop przy < 10m głębokości |
| 🟢 | Grawimetria — wykrywanie okrętów podwodnych po anomaliach pola grawitacyjnego |

---

## AI wrogów

| Status | Cel |
|--------|-----|
| ✅ | Maszyna stanów: PATROL → ALERT → HUNT → SEARCH → WITHDRAW |
| ✅ | Hydrofony z progiem detekcji zależnym od hałasu i termokliny |
| ✅ | Zarzuty głębinowe z obrażeniami i screen shake |
| ✅ | ASROC — rakieta z torpedą samonaprowadzającą |
| ✅ | Sprint-and-listen — szybki sprint, potem nasłuch |
| ✅ | Koordynacja radiowa — HUNT alarmuje pobliskie okręty |
| ✅ | Szok po trafieniu — spowolnienie 15%→100% przez kilka sekund |
| ✅ | Ślad olejowy — widoczny na powierzchni podczas WITHDRAW |
| ✅ | Manewr unikania torpedy — zdrowy vs uszkodzony |
| 🔴 | Okręt podwodny wroga (EnemySub) — detekcja tylko sonarowa, brak widoczności |
| 🔴 | Helikopter ZOP — szybkie przemieszczanie, spuszczany hydrofor, torpedy |
| 🔴 | Samolot patrolowy P-3 Orion — boje sonarowe, torpedy, szeroki zasięg |
| 🟡 | Formacje — niszczyciele operujące w szyku `V` lub `line-abreast` |
| 🟡 | Wymiana danych taktycznych — okręty dzielą się pozycją kontaktu |
| 🟡 | Dezinformacja — fałszywe manewry wabiące gracza w pułapkę |
| 🟢 | Miny stawiane przez niszczyciele na trasie gracza |

---

## UI i HUD

| Status | Cel |
|--------|-----|
| ✅ | HUD: głębokość, prędkość, balast, hałas, kadłub, bateria, tlen |
| ✅ | Panel namierzania: bearing, dystans, rozwiązanie ogniowe |
| ✅ | Alert banner (NAMIERZONE / WYKRYTO) |
| ✅ | Dziennik pokładowy — terminal fosforowy CRT |
| ✅ | Wskaźnik NASŁUCH w etykiecie prędkości |
| ✅ | Klasyfikacja i trend kontaktu w panelu namierzania |
| ✅ | System fal — numer bieżącej fali w HUD |
| ✅ | CRT scanlines i winietowanie rogów |
| 🔴 | Mapa taktyczna — widok z góry z trasą, pozycjami kontaktów, zasięgami |
| 🔴 | Zegar prawdziwy 24h — pora dnia wpływa na widoczność (peryskop) |
| 🔴 | Panel uszkodzeń — lista systemów z ikonami statusu (OK / AWARIA) |
| 🟡 | Wiadomości radiowe — przychodzące meldunki ze sztabu (fabuła) |
| 🟡 | Historia trajektorii łodzi — subtelna linia za okrętem |
| 🟡 | Panel komputera torpedowego TMA (Track Motion Analysis) |
| 🟢 | Peryskop — przełączalny widok z góry przy małej głębokości |
| 🟢 | Menu pauzy z zapisem stanu gry |

---

## Rozgrywka i misje

| Status | Cel |
|--------|-----|
| ✅ | System fal — kolejne fale z trudniejszymi wrogami |
| ✅ | Poziomy trudności (z MenuScene) |
| ✅ | Warunek porażki — zniszczenie kadłuba |
| 🔴 | System misji — konkretne cele (zniszcz cel X, przepłyń przez strefę Y) |
| 🔴 | Misja 1: Przerwanie patrolu radzieckiego niszczyciela w Zatoce Biskajskiej |
| 🔴 | Misja 2: Śledzenie i identyfikacja nieznanego kontaktu |
| 🔴 | Misja 3: Eskortowanie sojuszniczego okrętu przez strefę zagrożenia |
| 🔴 | System reputacji — ocena taktyczna po misji (bez wykrycia = bonus) |
| 🟡 | Kampania — 6–8 misji z narastającym napięciem zimnej wojny |
| 🟡 | Ukryte rozkazy — dodatkowe cele odkrywane podczas misji |
| 🟡 | Wydarzenie historyczne — intro tekstowe przed misją |
| 🟢 | Tryb survival — nieskończone fale, ranking punktowy |
| 🟢 | Tryb sandox — wolna eksploracja, brak wrogów |

---

## Audio

| Status | Cel |
|--------|-----|
| ❌ | Silnik diesel — niski warkot, głośniejszy przy powierzchni |
| ❌ | Silnik elektryczny — cichy hum narastający z prędkością |
| ❌ | Kawitacja — metaliczny szum bulgotania |
| ❌ | Sonar ping — charakterystyczny ton aktywny |
| ❌ | Plik hydrofonowy — pasywny szum oceanu z tonalnymi kontaktami |
| ❌ | Eksplozje — uderzenia głębinowe z lekkim opóźnieniem (prędkość dźwięku w wodzie) |
| ❌ | Skrzypienie kadłuba pod ciśnieniem przy głębokości > 300m |
| ❌ | Muzyka ambientowa — napięcie narastające wg stanu ALERT/HUNT |
| ❌ | Wiadomości radiowe — synteza mowy lub nagrania aktorskie |

---

## Technologia i silnik

| Status | Cel |
|--------|-----|
| ✅ | Phaser 3 + Vite 4.5 |
| ✅ | Ręczna kamera z lerp (niezależny od FPS) |
| ✅ | CANVAS mode (nie WebGL) |
| ✅ | Hot module replacement przez Vite |
| 🔴 | Zapis i wczytanie stanu gry (localStorage) |
| 🔴 | Optymalizacja — culling obiektów poza ekranem |
| 🟡 | Migracja do WebGL (Phaser WEBGL mode) dla efektów shader |
| 🟡 | Shadery GLSL — podwodne kaustyki, promienie słońca |
| 🟡 | Service Worker — gra dostępna offline |
| 🟢 | Lokalizacja (PL/EN) |
| 🟢 | Responsywność — skalowanie do rozdzielczości ekranu |

---

## Długofalowe

| Status | Cel |
|--------|-----|
| 🟢 | Multiplayer kooperacyjny — dwóch graczy na jednej łodzi (różne stanowiska) |
| 🟢 | Edytor misji — tworzenie scenariuszy w przeglądarce |
| 🟢 | Tryb niszczycielski — gracz jako dowódca okrętu nawodnego |
| 🟢 | Historyczne okręty — K-19, USS Scorpion, ORP Orzeł (model 1939) |

---

*Ostatnia aktualizacja: 2026-05-09*
