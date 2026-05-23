// Słownik tłumaczeń — interfejs gry PL / EN
// Treść narracyjna (dziennik pokładowy, radio VLF) pozostaje po polsku.

const DICT = {
  PL: {
    // ── Menu ────────────────────────────────────────────────────────────────
    menu_new:        'NOWY PATROL',
    menu_cont:       'KONTYNUUJ',
    menu_archive:    'ARCHIWUM',
    menu_fleet:      'FLOTYLLA',
    menu_settings:   'USTAWIENIA',

    menu_main_title: 'MENU GŁÓWNE',
    menu_set_title:  'USTAWIENIA GRY',
    menu_nav_hint:   '↑ ↓ NAWIGACJA  ·  ⏎ WYBÓR',
    menu_set_hdr:    '// KONFIGURACJA PATROLU',
    menu_set_back:   '← POWRÓĆ',
    menu_set_hint:   '← → ZMIEŃ OPCJĘ',
    menu_set_save:   'ZMIANY ZAPISYWANE AUTOMATYCZNIE',

    // ── Sekcje ustawień ──────────────────────────────────────────────────────
    set_sec_gameplay: '// ROZGRYWKA',
    set_sec_graphics: '// GRAFIKA',
    set_sec_lang:     '// JĘZYK',

    // ── Etykiety ustawień ────────────────────────────────────────────────────
    set_difficulty:  'TRUDNOŚĆ',
    set_convoy:      'KONWÓJ',
    set_ammo:        'AMUNICJA',
    set_delay:       'DO KONTAKTU',
    set_particles:   'CZĄSTECZKI',
    set_camshake:    'WSTRZĄSY KAMERY',
    set_scanlines:   'EFEKT CRT',
    set_language:    'JĘZYK',

    // ── Opcje ────────────────────────────────────────────────────────────────
    opt_easy:        'ŁATWY',
    opt_normal:      'NORMALNY',
    opt_hard:        'TRUDNY',
    opt_ships_2:     '2 STATKI',
    opt_ships_4:     '4 STATKI',
    opt_ships_6:     '6 STATKÓW',
    opt_ammo_std:    'STANDARDOWA',
    opt_ammo_inf:    'NIEOGRANICZONA',
    opt_15s:         '15 SEK.',
    opt_1min:        '1 MINUTA',
    opt_5min:        '5 MINUT',
    opt_low:         'NISKIE',
    opt_medium:      'NORMALNE',
    opt_high:        'WYSOKIE',
    opt_on:          'WŁ.',
    opt_off:         'WYŁ.',
    opt_lang_pl:     'POLSKI',
    opt_lang_en:     'ENGLISH',

    // ── Stacje (top bar) ──────────────────────────────────────────────────────
    station_conn:    'CONN',
    station_sonar:   'SONAR',
    station_peri:    'PERYSKOP',
    station_weapon:  'BROŃ',
    station_slbm:    'SLBM',
    station_damage:  'AWARIE',

    // ── Top bar ───────────────────────────────────────────────────────────────
    tb_class:        'PROJEKT 877 · MISJA BOJOWA',
    tb_patrol:       '● PATROL BOJOWY',

    // ── Panel lewy ───────────────────────────────────────────────────────────
    lp_targeting:    'NAMIERZANIE',
    lp_contact:      'KONTAKT',
    lp_range:        'DYSTANS',
    lp_solution:     'ROZWIĄZ.',
    lp_torp_cd:      'TORP CD',
    lp_class:        'KLASIF',
    lp_trend:        'TREND',
    lp_mission:      'MISJA',

    // ── Sterowanie ───────────────────────────────────────────────────────────
    ctrl_title:      'Sterowanie',
    ctrl_surface:    'Wynurz / Zanurz',
    ctrl_fwd:        'Naprzód / Wstecz',
    ctrl_fullpower:  'Pełna moc',
    ctrl_stop:       'Stop silnika',
    ctrl_torpedo:    'Torpeda Mk.48',
    ctrl_missile:    'Rakieta (max 70m)',
    ctrl_decoy:      'Wabia akustyczna',
    ctrl_detonate:   'Det. torpedy',
    ctrl_ping:       'Ping aktywny (14s CD)',
    ctrl_sonar_hdr:  'Sonar',

    // ── HUD ──────────────────────────────────────────────────────────────────
    hud_depth:       'GŁĘBOKOŚĆ',
    hud_speed:       'PRĘDKOŚĆ',
    hud_ballast:     'BALAST',
    hud_noise:       'HAŁAS',
    hud_hull:        'KADŁUB',
    hud_battery:     'BATERIA',
    hud_oxygen:      'TLEN O₂',
    hud_torpedoes:   'TORPEDY',
    hud_missiles:    'RAKIETY',
    hud_decoy:       'WABIA',

    // ── Radio overlay ─────────────────────────────────────────────────────────
    radio_hdr:       '◈ ◈ ◈  TRANSMISJA VLF / ELF — FLOTA PÓŁNOCNA  ◈ ◈ ◈',
    radio_from_lbl:  'OD:',
    radio_to_lbl:    'DO:',
    radio_utc_lbl:   'UTC:',
    radio_dismiss:   '[R] POTWIERDŹ ODBIÓR · KLIKNIJ ABY KONTYNUOWAĆ',
    radio_badge:     '◈ VLF',

    // ── Stacje — nagłówki ─────────────────────────────────────────────────────
    sonar_bear_hdr:   'NAMIAR · DALEKOSIĘŻNY HYDROFON',
    sonar_listen:     '◉ NASŁUCH',
    sonar_wf_hdr:     'WODOSPAD · KĄTY NAMIERZANIA (BTR)',
    sonar_demon_hdr:  'DEMON · WIDMO 8–35 Hz',
    sonar_contacts_hdr: 'KONTAKTY · KLASYFIKACJA',
    sonar_tracking:   'ŚLEDZ.',
    sonar_no_contacts: 'BRAK KONTAKTÓW SONAROWYCH',
    sonar_pas:        'PAS.',
    sonar_listen_mode: 'NASŁUCH',
    sonar_active_mode: 'AKTYWNY',

    peri_optics_hdr:  'OPTYKA · PERYSKOP OBSERWACYJNY MK.18',
    peri_bearing_sub: 'KURS OBSERWACJI · SCROLL — OBRÓT',
    peri_status_lbl:  'STATUS',
    peri_zoom_lbl:    'POWIĘKSZENIE',
    peri_cv_hdr:      'KONTAKTY · POLE WIDZENIA',
    peri_no_cv:       'BRAK KONTAKTÓW W POLU WIDZENIA',
    peri_tdc_hdr:     'TDC · KOMPUTER DANYCH CELU',
    peri_no_target:   'BRAK CELU',
    peri_tdc_brg:     'NAMIAR (BRG)',
    peri_tdc_spd:     'PRĘDKOŚĆ',
    peri_tdc_aob:     'KĄT NAT. (AOB)',
    peri_tdc_rng:     'ZASIĘG',
    peri_tdc_sol:     'NAMIAR STRZAŁU',
    peri_esm_hdr:     'ESM · EMISJE EM',
    peri_esm_listen:  'NASŁUCH',
    peri_no_esm:      'BRAK EMISJI W ZASIĘGU',
    peri_cv_count:    'W WIDOKU',

    ws_hdr:           'UZBROJENIE · KONTROLA OGNIA',
    ws_safety_off:    '● ZABEZP. ZDJĘTE',
    ws_tubes_hdr:     'RURY TORPEDOWE',
    ws_ammo_hdr:      'ZAPASY BOJOWE',
    ws_fire_hdr:      'STEROWANIE OGNIEM',
    ws_tube_ready:    'GOTOWA',
    ws_inv_torpedoes: 'TORPEDY',
    ws_inv_missiles:  'RAKIETY',
    ws_inv_decoys:    'WABIE',

    ds_title:         'PANEL AWARII — ORP KONDOR',
    ds_status_ok:     '● OPERACYJNY',
    ds_status_dmg:    '▲ USZKODZONY',
    ds_status_deg:    '◆ ZDEGRADOWANY',
    ds_status_crit:   '■ KRYTYCZNE',
    ds_cond_hull:     'KADŁUB',
    ds_cond_battery:  'BATERIA',
    ds_cond_oxygen:   'TLEN',
    ds_no_damage:     'BRAK ZAREJESTROWANYCH AWARII',

    peri_submerged:   'ZANURZONY',
    peri_fc_scan:     'SKAN',
    peri_sinking:     'TONIE',
    peri_too_deep:    'ZBYT GŁĘBOKO',
    peri_no_signal:   'BRAK SYGNAŁU',
    peri_surface_hint:'WYNURZYĆ DO ≤12m',
    peri_inactive:    'PERYSKOP NIEAKTYWNY',
    log_sys_active:   'SYSTEM AKTYWNY',

    bb_asonar:        'A.SONAR',
    bb_wave_lbl:      'FALA',
    bb_peri_lbl:      'PERYSK',
    bb_ready:         'GOTOWY',
    bb_passive:       'PASYWNY',

    // ── Klasyfikacja sonarowa ─────────────────────────────────────────────────
    cls_warship:      'OKRĘT WOJENNY',
    cls_merchant:     'JEDNOSTKA CYW.',
    cls_surface:      'NAWODNY',
    cls_unknown:      'NIEZNANY',
    cls_warship_s:    'OKRĘT WOJ.',
    cls_merchant_s:   'JED. CYW.',
    cls_surface_s:    'NAWODNY',
    cls_unk_s:        'UNK',
    trend_closing:    '↗ ZBLIŻA SIĘ',
    trend_opening:    '↙ ODDALA SIĘ',
    trend_closing_s:  'ZBLIŻA',
    trend_opening_s:  'ODDALA',

    // ── Status kondycji okrętu ────────────────────────────────────────────────
    hull_intact:      'INTEGRALNY',
    hull_damaged:     'USZKODZONY',
    hull_critical:    'KRYTYCZNY',
    hull_imploded:    'IMPLOZJA',
    bat_full:         'PEŁNA',
    bat_normal:       'NORMALNA',
    bat_low:          'SŁABA',
    bat_critical:     'KRYTYCZNA',
    oxy_normal:       'NORMA',
    oxy_low:          'OBNIŻONY',
    oxy_critical:     'KRYTYCZNY',
    oxy_empty:        'BRAK TLENU',

    // ── Misja ─────────────────────────────────────────────────────────────────
    mis1_name:        'OP. NEPTUN',
    mis1_obj_detect:  'Namierz BPK «NIEUSTRASZONY» (klasyfikacja sonarowa)',
    mis1_obj_destroy: 'Zatop BPK «NIEUSTRASZONY»',
    mis1_obj_destroy_prog: 'Zatop BPK «NIEUSTRASZONY»',
    mis1_start_log:   'ROZKAZ: Wyeliminuj BPK «NIEUSTRASZONY»!',
    mis1_detected:    'Cel namierzony — klasyfikacja: okręt wojenny',
    mis1_sunk:        'BPK «NIEUSTRASZONY» ZATOPIONY!',
    mis_complete:     'MISJA WYKONANA',
    mis_complete_star: '★ MISJA WYKONANA',
    mis_end_text:     'BPK «NIEUSTRASZONY» wyeliminowany. ORP KONDOR — powrót do bazy.',

    // ── Event log ─────────────────────────────────────────────────────────────
    log_torp_fired:   'Torpeda odpalona!',
    log_salvo_cd:     'Cooldown salwy! ({s}s)',
    log_tubes_loading: 'Wszystkie rury ładują się! ({s}s)',
    log_tube_ready:   'Rura {n} — GOTOWA',
    log_missile_fired: 'Rakieta odpalona!',
    log_no_missiles:  'Brak rakiet!',
    log_too_deep:     'Za głęboko! Wynurzyć (max 70m).',
    log_missile_fail: 'SYS. RAKIETOWY — AWARIA!',
    log_autosave:     'AUTO-ZAPIS OK',
    log_dive_enemies: 'Zanurz się — wrogie jednostki w pobliżu!',
    log_save_loaded:  'Wczytano zapis — kontynuujesz patrol',
    log_detonate:     'Detonacja zdalna!',
    log_decoy_fired:  'Wabia akustyczna wyrzucona!',
    log_no_decoys:    'Brak wabii akustycznych!',
    log_ping_cd:      'Ping — cooldown ({s}s)',
    log_ping_active:  'PING! Aktywny sonar — jesteśmy namierzeni!',
    log_asroc:        'ASROC! Rakieta p/okrętowa odpalona!',
    log_depth_charge: 'ZARZUT GŁĘBINOWY!',
    log_torp_hit:     'TRAFIENIE — torpeda naprowadzana ASROC!',
    log_reinforcements: 'Wróg wezwał posiłki radiowe!',
    log_sunk_missile: '{lbl} zatopiony rakietą!',
    log_hit_missile:  'Trafiono {lbl} rakietą!',
    log_sunk_torp:    '{lbl} zatopiony!',
    log_hit_torp:     'Trafienie! Wróg uszkodzony.',
    log_enemy_sunk:   'Wróg zatopiony!',
    log_merchant_sunk: '{lbl} — zatopiony!',
    log_merchant_hit: 'Trafiono {lbl}!',
    log_batt_low:     'UWAGA: Niski poziom baterii',
    log_batt_empty:   'KRYTYCZNE: Bateria wyczerpana',
    log_oxy_low:      'UWAGA: Niski poziom tlenu — wynurzyć!',
    log_oxy_empty:    'KRYTYCZNE: Brak tlenu',
    log_hull_60:      'UWAGA: Uszkodzenie kadłuba',
    log_hull_30:      'KRYTYCZNE: Kadłub poważnie uszkodzony',
    log_bottom_hard:  'UDERZENIE W DNO — uszkodzenie!',
    log_bottom_soft:  'Kontakt z dnem',
    log_grounded:     'Łódź osiadła — wyrzuć balast!',
    log_depth_300:    'UWAGA: Przekroczono limit (300m)',
    log_depth_400:    'KRYTYCZNE: Głębokość krytyczna!',
    log_thermo_down:  'Termoklina — hałas maskowany −42%',
    log_thermo_up:    'Powyżej termokliny — brak maskowania',
    log_cavitation:   'KAWITACJA — zwolnij, jesteś głośny!',
    log_dd_alert:     'Niszczyciel namierzył hałas — szuka...',
    log_dd_hunt:      'NISZCZYCIEL ATAKUJE — zarzuty + ASROC!',
    log_dd_search:    'Niszczyciel przeszukuje obszar...',
    log_dd_withdraw:  'Niszczyciel wycofuje się!',
    log_dd_patrol:    'Niszczyciel wrócił na patrol.',

    // ── Game over ─────────────────────────────────────────────────────────────
    go_sunk_title:    'OKRĘT ZATOPIONY',
    go_sunk_sub:      'Kadłub nie wytrzymał. Misja nieudana.',
    alert_detected:   '!! WYKRYTO !!',
    alert_tracked:    'NAMIERZONE',
    asroc_threat:     '↑ ASROC W LOCIE x',
    torp_threat:      '▼ TORPEDA NAPROW. x',
  },

  EN: {
    // ── Menu ────────────────────────────────────────────────────────────────
    menu_new:        'NEW PATROL',
    menu_cont:       'CONTINUE',
    menu_archive:    'ARCHIVE',
    menu_fleet:      'FLEET',
    menu_settings:   'SETTINGS',

    menu_main_title: 'MAIN MENU',
    menu_set_title:  'GAME SETTINGS',
    menu_nav_hint:   '↑ ↓ NAVIGATE  ·  ⏎ SELECT',
    menu_set_hdr:    '// PATROL CONFIGURATION',
    menu_set_back:   '← BACK',
    menu_set_hint:   '← → CHANGE OPTION',
    menu_set_save:   'CHANGES SAVED AUTOMATICALLY',

    // ── Settings sections ────────────────────────────────────────────────────
    set_sec_gameplay: '// GAMEPLAY',
    set_sec_graphics: '// GRAPHICS',
    set_sec_lang:     '// LANGUAGE',

    // ── Settings labels ──────────────────────────────────────────────────────
    set_difficulty:  'DIFFICULTY',
    set_convoy:      'CONVOY',
    set_ammo:        'AMMUNITION',
    set_delay:       'UNTIL CONTACT',
    set_particles:   'PARTICLES',
    set_camshake:    'CAMERA SHAKE',
    set_scanlines:   'CRT EFFECT',
    set_language:    'LANGUAGE',

    // ── Options ──────────────────────────────────────────────────────────────
    opt_easy:        'EASY',
    opt_normal:      'NORMAL',
    opt_hard:        'HARD',
    opt_ships_2:     '2 SHIPS',
    opt_ships_4:     '4 SHIPS',
    opt_ships_6:     '6 SHIPS',
    opt_ammo_std:    'STANDARD',
    opt_ammo_inf:    'UNLIMITED',
    opt_15s:         '15 SEC.',
    opt_1min:        '1 MINUTE',
    opt_5min:        '5 MINUTES',
    opt_low:         'LOW',
    opt_medium:      'NORMAL',
    opt_high:        'HIGH',
    opt_on:          'ON',
    opt_off:         'OFF',
    opt_lang_pl:     'POLSKI',
    opt_lang_en:     'ENGLISH',

    // ── Stations (top bar) ───────────────────────────────────────────────────
    station_conn:    'CONN',
    station_sonar:   'SONAR',
    station_peri:    'PERISCOPE',
    station_weapon:  'WEAPONS',
    station_slbm:    'SLBM',
    station_damage:  'DAMAGE',

    // ── Top bar ───────────────────────────────────────────────────────────────
    tb_class:        'PROJECT 877 · COMBAT MISSION',
    tb_patrol:       '● COMBAT PATROL',

    // ── Left panel ───────────────────────────────────────────────────────────
    lp_targeting:    'TARGETING',
    lp_contact:      'CONTACT',
    lp_range:        'DISTANCE',
    lp_solution:     'SOLUTION',
    lp_torp_cd:      'TORP CD',
    lp_class:        'CLASS',
    lp_trend:        'TREND',
    lp_mission:      'MISSION',

    // ── Controls ─────────────────────────────────────────────────────────────
    ctrl_title:      'Controls',
    ctrl_surface:    'Surface / Dive',
    ctrl_fwd:        'Forward / Reverse',
    ctrl_fullpower:  'Full power',
    ctrl_stop:       'Engine stop',
    ctrl_torpedo:    'Torpedo Mk.48',
    ctrl_missile:    'Missile (max 70m)',
    ctrl_decoy:      'Acoustic decoy',
    ctrl_detonate:   'Det. torpedo',
    ctrl_ping:       'Active ping (14s CD)',
    ctrl_sonar_hdr:  'Sonar',

    // ── HUD ──────────────────────────────────────────────────────────────────
    hud_depth:       'DEPTH',
    hud_speed:       'SPEED',
    hud_ballast:     'BALLAST',
    hud_noise:       'NOISE',
    hud_hull:        'HULL',
    hud_battery:     'BATTERY',
    hud_oxygen:      'OXYGEN O₂',
    hud_torpedoes:   'TORPEDOES',
    hud_missiles:    'MISSILES',
    hud_decoy:       'DECOY',

    // ── Radio overlay ─────────────────────────────────────────────────────────
    radio_hdr:       '◈ ◈ ◈  VLF / ELF TRANSMISSION — NORTHERN FLEET  ◈ ◈ ◈',
    radio_from_lbl:  'FROM:',
    radio_to_lbl:    'TO:',
    radio_utc_lbl:   'UTC:',
    radio_dismiss:   '[R] CONFIRM RECEIPT · CLICK TO CONTINUE',
    radio_badge:     '◈ VLF',

    // ── Stations — headers ────────────────────────────────────────────────────
    sonar_bear_hdr:   'BEARING · LONG-RANGE HYDROPHONE',
    sonar_listen:     '◉ PASSIVE',
    sonar_wf_hdr:     'WATERFALL · BEARING TIME RECORD (BTR)',
    sonar_demon_hdr:  'DEMON · SPECTRUM 8–35 Hz',
    sonar_contacts_hdr: 'CONTACTS · CLASSIFICATION',
    sonar_tracking:   'TRACK.',
    sonar_no_contacts: 'NO SONAR CONTACTS',
    sonar_pas:        'PAS.',
    sonar_listen_mode: 'LISTEN',
    sonar_active_mode: 'ACTIVE',

    peri_optics_hdr:  'OPTICS · OBSERVATION PERISCOPE MK.18',
    peri_bearing_sub: 'OBSERVATION BEARING · SCROLL — ROTATE',
    peri_status_lbl:  'STATUS',
    peri_zoom_lbl:    'ZOOM',
    peri_cv_hdr:      'CONTACTS · VISUAL RANGE',
    peri_no_cv:       'NO CONTACTS IN VISUAL RANGE',
    peri_tdc_hdr:     'TDC · FIRE CONTROL COMPUTER',
    peri_no_target:   'NO TARGET',
    peri_tdc_brg:     'BEARING (BRG)',
    peri_tdc_spd:     'SPEED',
    peri_tdc_aob:     'ANGLE ON BOW (AOB)',
    peri_tdc_rng:     'RANGE',
    peri_tdc_sol:     'FIRING BEARING',
    peri_esm_hdr:     'ESM · EM EMISSIONS',
    peri_esm_listen:  'PASSIVE',
    peri_no_esm:      'NO EMISSIONS IN RANGE',
    peri_cv_count:    'IN VIEW',

    ws_hdr:           'WEAPONS · FIRE CONTROL',
    ws_safety_off:    '● SAFETY OFF',
    ws_tubes_hdr:     'TORPEDO TUBES',
    ws_ammo_hdr:      'COMBAT STORES',
    ws_fire_hdr:      'FIRE CONTROL',
    ws_tube_ready:    'READY',
    ws_inv_torpedoes: 'TORPEDOES',
    ws_inv_missiles:  'MISSILES',
    ws_inv_decoys:    'DECOYS',

    ds_title:         'DAMAGE PANEL — ORP KONDOR',
    ds_status_ok:     '● OPERATIONAL',
    ds_status_dmg:    '▲ DAMAGED',
    ds_status_deg:    '◆ DEGRADED',
    ds_status_crit:   '■ CRITICAL',
    ds_cond_hull:     'HULL',
    ds_cond_battery:  'BATTERY',
    ds_cond_oxygen:   'OXYGEN',
    ds_no_damage:     'NO DAMAGE RECORDED',

    peri_submerged:   'SUBMERGED',
    peri_fc_scan:     'SCAN',
    peri_sinking:     'SINKING',
    peri_too_deep:    'TOO DEEP',
    peri_no_signal:   'NO SIGNAL',
    peri_surface_hint:'SURFACE TO ≤12m',
    peri_inactive:    'PERISCOPE INACTIVE',
    log_sys_active:   'SYSTEM ACTIVE',

    bb_asonar:        'A.SONAR',
    bb_wave_lbl:      'WAVE',
    bb_peri_lbl:      'PERI',
    bb_ready:         'READY',
    bb_passive:       'PASSIVE',

    // ── Sonar classification ──────────────────────────────────────────────────
    cls_warship:      'WARSHIP',
    cls_merchant:     'MERCHANT',
    cls_surface:      'SURFACE',
    cls_unknown:      'UNKNOWN',
    cls_warship_s:    'WARSHIP',
    cls_merchant_s:   'CIV.',
    cls_surface_s:    'SURFACE',
    cls_unk_s:        'UNK',
    trend_closing:    '↗ CLOSING',
    trend_opening:    '↙ OPENING',
    trend_closing_s:  'CLOSING',
    trend_opening_s:  'OPENING',

    // ── Ship condition ────────────────────────────────────────────────────────
    hull_intact:      'INTACT',
    hull_damaged:     'DAMAGED',
    hull_critical:    'CRITICAL',
    hull_imploded:    'IMPLOSION',
    bat_full:         'FULL',
    bat_normal:       'NORMAL',
    bat_low:          'LOW',
    bat_critical:     'CRITICAL',
    oxy_normal:       'NORMAL',
    oxy_low:          'REDUCED',
    oxy_critical:     'CRITICAL',
    oxy_empty:        'NO OXYGEN',

    // ── Mission ───────────────────────────────────────────────────────────────
    mis1_name:        'OP. NEPTUNE',
    mis1_obj_detect:  'Locate BPK «NIEUSTRASZONY» (sonar classification)',
    mis1_obj_destroy: 'Sink BPK «NIEUSTRASZONY»',
    mis1_obj_destroy_prog: 'Sink BPK «NIEUSTRASZONY»',
    mis1_start_log:   'ORDER: Eliminate BPK «NIEUSTRASZONY»!',
    mis1_detected:    'Target located — classified: warship',
    mis1_sunk:        'BPK «NIEUSTRASZONY» SUNK!',
    mis_complete:     'MISSION COMPLETE',
    mis_complete_star: '★ MISSION COMPLETE',
    mis_end_text:     'BPK «NIEUSTRASZONY» eliminated. ORP KONDOR — return to base.',

    // ── Event log ─────────────────────────────────────────────────────────────
    log_torp_fired:   'Torpedo fired!',
    log_salvo_cd:     'Salvo cooldown! ({s}s)',
    log_tubes_loading: 'All tubes reloading! ({s}s)',
    log_tube_ready:   'Tube {n} — READY',
    log_missile_fired: 'Missile fired!',
    log_no_missiles:  'No missiles!',
    log_too_deep:     'Too deep! Surface (max 70m).',
    log_missile_fail: 'MISSILE SYS. — FAILURE!',
    log_autosave:     'AUTO-SAVE OK',
    log_dive_enemies: 'Dive — enemy units nearby!',
    log_save_loaded:  'Save loaded — continuing patrol',
    log_detonate:     'Remote detonation!',
    log_decoy_fired:  'Acoustic decoy deployed!',
    log_no_decoys:    'No acoustic decoys!',
    log_ping_cd:      'Ping — cooldown ({s}s)',
    log_ping_active:  'PING! Active sonar — we are targeted!',
    log_asroc:        'ASROC! Anti-sub missile launched!',
    log_depth_charge: 'DEPTH CHARGE!',
    log_torp_hit:     'HIT — ASROC homing torpedo!',
    log_reinforcements: 'Enemy radioed for reinforcements!',
    log_sunk_missile: '{lbl} sunk by missile!',
    log_hit_missile:  '{lbl} hit by missile!',
    log_sunk_torp:    '{lbl} sunk!',
    log_hit_torp:     'Hit! Enemy damaged.',
    log_enemy_sunk:   'Enemy sunk!',
    log_merchant_sunk: '{lbl} — sunk!',
    log_merchant_hit: '{lbl} hit!',
    log_batt_low:     'WARNING: Low battery',
    log_batt_empty:   'CRITICAL: Battery depleted',
    log_oxy_low:      'WARNING: Low oxygen — surface!',
    log_oxy_empty:    'CRITICAL: No oxygen',
    log_hull_60:      'WARNING: Hull damage',
    log_hull_30:      'CRITICAL: Hull severely damaged',
    log_bottom_hard:  'BOTTOM IMPACT — damage!',
    log_bottom_soft:  'Bottom contact',
    log_grounded:     'Grounded — blow ballast!',
    log_depth_300:    'WARNING: Depth limit exceeded (300m)',
    log_depth_400:    'CRITICAL: Crush depth!',
    log_thermo_down:  'Thermocline — noise masked −42%',
    log_thermo_up:    'Above thermocline — no masking',
    log_cavitation:   'CAVITATION — slow down, you are loud!',
    log_dd_alert:     'Destroyer detected noise — searching...',
    log_dd_hunt:      'DESTROYER ATTACKING — charges + ASROC!',
    log_dd_search:    'Destroyer searching area...',
    log_dd_withdraw:  'Destroyer withdrawing!',
    log_dd_patrol:    'Destroyer returned to patrol.',

    // ── Game over ─────────────────────────────────────────────────────────────
    go_sunk_title:    'SUBMARINE SUNK',
    go_sunk_sub:      'Hull failed. Mission unsuccessful.',
    alert_detected:   '!! DETECTED !!',
    alert_tracked:    'TRACKED',
    asroc_threat:     '↑ ASROC IN FLIGHT x',
    torp_threat:      '▼ INBOUND TORP x',
  },
};

let _lang = 'PL';

export function setLang(code) {
  _lang = code === 'EN' ? 'EN' : 'PL';
  window._currentLang = _lang;
  window._t = t;
}

export function getLang() { return _lang; }

export function t(key) {
  return DICT[_lang]?.[key] ?? DICT.PL[key] ?? key;
}

// Tłumaczenie z podmianą zmiennych: tf('log_sunk_missile', { lbl: 'HMS Ark Royal' })
export function tf(key, vars) {
  let s = t(key);
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

// Ekspozycja dla skryptów inline w index.html (non-module)
window._t  = t;
window._tf = tf;

// Aktualizuje wszystkie elementy DOM z atrybutem data-i18n
export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = t(el.dataset.i18n);
    if (val !== undefined) el.textContent = val;
  });
}
