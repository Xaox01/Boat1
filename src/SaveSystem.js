const SAVE_KEY = 'op_pazdziernik_v1';

let _pendingLoad = false;

export const SaveSystem = {
  // Żądanie wczytania zapisu przy starcie sceny
  requestLoad()         { _pendingLoad = true; },
  consumeLoadRequest()  { const v = _pendingLoad; _pendingLoad = false; return v; },

  hasSave() {
    return !!localStorage.getItem(SAVE_KEY);
  },

  save(scene) {
    const sub = scene.sub;
    const data = {
      version:   1,
      timestamp: Date.now(),
      wave:      scene._wave,
      waveTimer: scene._waveTimer,
      sub: {
        x:              sub.x,
        y:              sub.y,
        vx:             sub.vx,
        vy:             sub.vy,
        hull:           sub.hull,
        battery:        sub.battery,
        oxygen:         sub.oxygen,
        ballast:        sub.ballast,
        targetBallast:  sub.targetBallast,
        missileCount:   sub.missileCount,
        noisemakerCount: sub.noisemakerCount,
        tubes: sub.tubes.map(t => ({
          loaded:      t.loaded,
          reloadTimer: t.reloadTimer,
          reloadBase:  t.reloadBase,
        })),
      },
      mission: scene.mission?.active ? {
        id:       scene.mission.active.id,
        name:     scene.mission.active.name,
        complete: scene.mission.active.complete,
        failed:   scene.mission.active.failed,
        objectives: scene.mission.active.objectives.map(o => ({ ...o })),
      } : null,
      merchants: scene.merchants.map(m => ({
        label:     m.label,
        x:         m.x,
        dir:       m.dir,
        hull:      m.hull,
        destroyed: m.destroyed,
        contactClass:  m.contactClass,
        classifyTimer: m.classifyTimer,
      })),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  },

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  clear() {
    localStorage.removeItem(SAVE_KEY);
  },

  // Zwraca czytelne info o zapisie do wyświetlenia w menu
  getSaveInfo() {
    const d = this.load();
    if (!d) return null;
    const date = new Date(d.timestamp);
    const pad  = n => String(n).padStart(2, '0');
    const dateStr = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    return {
      date:      dateStr,
      wave:      d.wave ?? 1,
      hull:      Math.round((d.sub?.hull ?? 1) * 100),
      missionId: d.mission?.id ?? null,
      kills:     d.mission?.objectives?.find(o => o.id === 'destroy')?.count ?? 0,
    };
  },
};
