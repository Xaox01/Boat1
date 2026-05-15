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
| ✅ | System tlenowy — wyczerpanie pod wodą (~15 min na 270m, regeneracja przez snorchel) |
| ✅ | Proceduralny teren dna — 6 oktaw sinusoidalnych, iglice skalne |
| ✅ | Kolizja z terenem — łódź uderza w zmienne dno, nie płaski prostokąt |
| ✅ | Świat 12 000px (~14.4km) zamiast 4 096px |
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
| ✅ | 4 niezależne rury torpedowe, przeładowanie 55–75s |
| ✅ | Cooldown 3s między kolejnymi wystrzeleniami (inter-salvo) |
| ✅ | Rakieta przeciw-okrętowa — sea-skimming (3 szt.) |
| ✅ | Łuk celownika z punktem ołowiu |
| ✅ | Romb intercepcji (lead indicator) |
| ✅ | Wabia akustyczna [T] — 5 sztuk, 45s, torpedy ASROC naprowadzają się na nią |
| 🔴 | Torpeda samonaprowadzająca na podczerwień — kontrmanewry IR |
| 🔴 | Torpedy z przewodem — sterowanie ręczne po odpaleniu |
| 🔴 | Miny morskie — stawianie i omijanie |
| 🟡 | Termoklinowe uniki torpedy — jeśli torpeda nie zejdzie głębiej |
| 🟡 | Fanowi wyrzut — odpalenie wielu torped jednocześnie (spread) |
| 🟡 | Rakieta balistyczna (SLBM) — cel strategiczny długiego zasięgu |
| ✅ | Torpeda akustyczna wabik (noisemaker) — odciąganie torped |

---

## Sonar i wykrywanie

| Status | Cel |
|--------|-----|
| ✅ | PPI (Plan Position Indicator) — obrotowy sweep |
| ✅ | Smear — zanikające ślady kontaktów (10s) |
| ✅ | Sonar pasywny — linie namiarowe w widoku głównym |
| ✅ | Triangulacja pozycji wroga z 2+ pomiarów |
| ✅ | Tryb NASŁUCH — 1.6× bonus zasięgu przy niskiej prędkości |
| ✅ | Klasyfikacja kontaktów: UNK → SURFACE → WARSHIP lub MERCHANT (4 klasy, różne progi czasowe i tony DEMON) |
| ✅ | DEMON waterfall — analiza widmowa 8–35 Hz |
| ✅ | Dual EMA — trend ZBLIŻA SIĘ / ODDALA SIĘ |
| ✅ | Ping aktywny [Q] — 14s CD, pierścień 1100px, echo na PPI 5s, wrogowie wykrywają źródło |
| ✅ | Stacja SONAR w UI — koło namiarów, wodospad BTR, lista kontaktów, kopia DEMON |
| ✅ | Namiary z minimalnym progiem pionowym — kontakty nawodne rozdzielone na kole, nie skupione w ~090° |
| ✅ | Declutter sonar — fan spread od centroidu klastra (17°/kontakt), schodkowanie radialne, linia łącząca dot z prawdziwym namiarem |
| ✅ | Mapa taktyczna: merchanty widoczne tylko w zasięgu sonaru (pełna ≤820px, cień 820–1640px, ukryci dalej) |
| ✅ | Zniszczony okręt natychmiast usuwany z sonaru, mapy taktycznej i systemu śledzenia |
| 🔴 | Zakłócenia termokliny na sonarze — ślepa strefa poniżej warstwy |
| 🔴 | Biologics — fałszywe kontakty (ławice ryb, wieloryby) na DEMON |
| 🟡 | Historia bearing — wąż namiarowy pokazujący ruch kontaktu w czasie |
| 🟡 | Sonar boczny — holowany hydrofor TASS (wyższy zasięg, brak zwrotu) |
| ✅ | Stacja PERYSKOP — widok optyczny, sylwetki, skala kątowa, stadimetria, zoom ×1.5/×3 (F3) |
| ✅ | Peryskop: natychmiastowa klasyfikacja wizualna WARSHIP/MERCHANT (<1925px, głęb. <12m) |
| ✅ | Peryskop: selekcja V-* → cel, hałas masztu, badge HUD, FOV cone w CONN, sync kursu |
| 🟢 | Peryskop: ESM — lista emisji radarowych wrogich okrętów |
| 🟢 | Grawimetria — wykrywanie okrętów podwodnych po anomaliach pola grawitacyjnego |

---

## AI wrogów

| Status | Cel |
|--------|-----|
| ✅ | Maszyna stanów: PATROL → ALERT → HUNT → SEARCH → WITHDRAW |
| ✅ | Hydrofony ulepszone: zasięg 560px, progi 1.4/5.5 (szybsze wykrywanie) |
| ✅ | Częstsze zarzuty głębinowe (9s CD), większy promień (108px), silniejsze obrażenia |
| ✅ | ASROC co 55s (wcześniej 90s), wróg walczy do hull<0.10 (wcześniej 0.25) |
| ✅ | Zarzuty głębinowe z obrażeniami i screen shake |
| ✅ | ASROC — rakieta z torpedą samonaprowadzającą |
| ✅ | Sprint-and-listen — szybki sprint, potem nasłuch |
| ✅ | Koordynacja radiowa — HUNT alarmuje pobliskie okręty (z przekazaniem pozycji łodzi) |
| ✅ | Flanking — drugi niszczyciel podchodzi z przeciwnej strony (efekt kleszczy) |
| ✅ | Wezwanie posiłków — po 18s HUNT bez likwidacji: nowy BPK z przeciwnego kierunku w ALERT |
| ✅ | Dead reckoning — HUNT przewiduje ruch łodzi na bazie prędkości (do 9s projekcji) |
| ✅ | SEARCH dwufazowy — faza konwergencji (0–11s) + rozszerzający się sweep |
| ✅ | Szybsza utrata kontaktu pod termoklinem (decay 0.55 vs 0.35) — nagroda za ukrycie |
| ✅ | Prędkość HUNT +18% gdy kontakt świeży (< 3s) |
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
| ✅ | Panel namierzania i sterowanie przeniesione do lewego panelu (poza grą) |
| ✅ | Panel namierzania: bearing, dystans, rozwiązanie ogniowe |
| ✅ | Alert banner (NAMIERZONE / WYKRYTO) |
| ✅ | Dziennik pokładowy — terminal fosforowy CRT |
| ✅ | Wskaźnik NASŁUCH w etykiecie prędkości |
| ✅ | Klasyfikacja i trend kontaktu w panelu namierzania |
| ✅ | System fal — numer bieżącej fali w HUD |
| ✅ | CRT scanlines i winietowanie rogów |
| ✅ | Mapa taktyczna [M] — live overlay z terenem, trasą, kontaktami, zasięgami |
| ✅ | Stacja BROŃ (F4) — rury torpedowe, zapasy bojowe, 3 karty uzbrojenia, live sync z HUD |
| 🔴 | Zegar prawdziwy 24h — pora dnia wpływa na widoczność (peryskop) |
| 🔴 | Panel uszkodzeń — lista systemów z ikonami statusu (OK / AWARIA) |
| 🟡 | Wiadomości radiowe — przychodzące meldunki ze sztabu (fabuła) |
| 🟡 | Historia trajektorii łodzi — subtelna linia za okrętem |
| 🟡 | Panel komputera torpedowego TMA (Track Motion Analysis) |
| 🟢 | Peryskop — przełączalny widok z góry przy małej głębokości |
| ✅ | Menu główne — ekran startowy z animowanym sonar PPI i schematem okrętu |
| 🟢 | Menu pauzy z zapisem stanu gry |

---

## Rozgrywka i misje

| Status | Cel |
|--------|-----|
| ✅ | Tryb piaskownicy — ciągłe generowanie wrogów, eskalacja co 2min |
| ✅ | Poziomy trudności (z MenuScene) |
| ✅ | Warunek porażki — zniszczenie kadłuba |
| ✅ | System misji — konkretne cele (namierz + zniszcz) z panelem UI |
| ✅ | Misja 1: Operacja Szlak Handlowy — konwój 4 statków, namierz i zatop 3 |
| ✅ | Szkolenie taktyczne (7 faz) — modal wyjaśniający kroki, pauza gry podczas czytania |
| 🔴 | Misja 2: Śledzenie i identyfikacja nieznanego kontaktu — wymagane użycie peryskopu do potwierdzenia klasy |
| 🔴 | Misja 3: Eskortowanie sojuszniczego okrętu przez strefę zagrożenia |
| 🔴 | System reputacji — ocena taktyczna po misji (bez wykrycia = bonus, trafność sonarowa, czas peryskopowy) |
| 🔴 | Samouczek peryskopu — dedykowana faza w szkoleniu (głębokość, FOV, klasyfikacja wizualna) |
| 🟡 | Mechanika ciszy — bonus za misję ukończoną bez aktywnego sonaru i bez unoszenia masztu w zasięgu wroga |
| 🟡 | Kampania — 6–8 misji z narastającym napięciem zimnej wojny |
| 🟡 | Ukryte rozkazy — dodatkowe cele odkrywane podczas misji (np. sfotografuj okręt przez peryskop) |
| 🟡 | Wydarzenie historyczne — intro tekstowe przed misją |
| 🟡 | Sonar kontekstowy — po triangulacji kontaktu odblokuj opcję „identyfikuj przez peryskop" w panelu namierzania |
| 🟢 | Tryb survival — nieskończone fale, ranking punktowy |
| 🟢 | Tryb sandbox — wolna eksploracja, brak wrogów |

---

## Grafika i efekty wizualne

| Status | Cel |
|--------|-----|
| ✅ | ESC zamyka aktywną stację (sonar, peryskop) i wraca do CONN |
| ✅ | CRT scanlines i winietowanie rogów (CSS) — jaśniejsza paleta kolorów UI |
| ✅ | Screen shake przy eksplozjach i kolizjach |
| ✅ | Animowane fale na powierzchni oceanu |
| ✅ | Ślad olejowy niszczyciela podczas WITHDRAW |
| ✅ | Efekt kawitacji — migający pasek hałasu |
| ✅ | Flash ekranu przy trafieniach (camera flash) |
| ✅ | Dym podczas wycofywania się niszczyciela |
| ✅ | Smear (ślady) na PPI sonarowym |
| ✅ | Pulsujący pierścień NASŁUCH wokół PPI |
| ✅ | Sprite'y okrętów — proceduralne wielokąty z detalami (łódź, niszczyciel, torpedy, rakieta) |
| ✅ | Animacja wybuchu — flash, kula ognia, fala uderzeniowa, bąble, kolumna dymu |
| ✅ | Eksplozja na powierzchni przy trafieniu torpedą — słup wody, odłamki, ogień, dym, plama oleju, wybuchy wtórne |
| ✅ | Podwodna warstwa tła — ciemniejsza z głębokością, gradient |
| 🔴 | Kaustyki — animowane refleksy świetlne na dnie i kadłubie |
| ✅ | Torpeda — widoczny ślad bąbelków (wake trail) za torpedą |
| 🔴 | Peryskop — nakładka z soczewką i krzyżem optycznym |
| ✅ | Cykl dnia i nocy — zmiana koloru oceanu, widoczności |
| 🟡 | Promienie słońca — god rays przebijające się przez powierzchnię (WebGL shader) |
| 🟡 | Bąble powietrza — unoszące się przy wynurzaniu i eksplozjach |
| 🟡 | Deszcz i burza morska — efekt na powierzchni, wpływ na hałas |
| ✅ | Zniszczony niszczyciel — animacja tonięcia 7.5s: przechył 90°, ogień, dym, bąble, plama oleju, fale |
| 🟡 | Ślad torpedy przez wodę — zanikająca linia biały szlak |
| 🟡 | Efekt implozji kadłuba — silna kompresja grafiki przy śmierci |
| 🟢 | Paralaksa tła — warstwy oceanu przesuwające się z różną prędkością |
| 🟢 | Fauna morska — dekoracyjne ryby, meduzy w tle |
| 🟢 | Mgła wojenna (fog of war) — nieodkryte rejony mapy przyciemnione |
| 🟢 | Animowany szum na powierzchni sonaru PPI (analogowy CRT) |

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
| ✅ | Zapis i wczytanie stanu gry (localStorage) — auto-zapis co 30s, KONTYNUUJ w menu |
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

*Ostatnia aktualizacja: 2026-05-14 — peryskop pełna integracja: selekcja V-*, hałas masztu, badge HUD, FOV cone CONN, sync kursu*
