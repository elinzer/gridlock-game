import { RECENT_SIZE } from '../config.js';

const KEY = 'lowerwacker.recent.v1';

export function createPicker(pool, storage, random) {
  function loadRecent(difficulty, size) {
    const raw = storage.getJSON(KEY, null);
    const list = raw && typeof raw === 'object' && Array.isArray(raw[difficulty]) ? raw[difficulty] : [];
    return list.filter((n) => Number.isInteger(n) && n >= 0 && n < size);
  }

  function saveRecent(difficulty, list) {
    const raw = storage.getJSON(KEY, null);
    const all = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    all[difficulty] = list;
    storage.setJSON(KEY, all);
  }

  return {
    next(difficulty) {
      const list = pool[difficulty];
      const recent = loadRecent(difficulty, list.length);
      const blocked = new Set(recent.slice(-RECENT_SIZE));
      const fresh = [];
      for (let n = 0; n < list.length; n++) if (!blocked.has(n)) fresh.push(n);
      const index = fresh.length ? fresh[Math.floor(random() * fresh.length)] : recent[0];
      const updated = recent.filter((n) => n !== index);
      updated.push(index);
      saveRecent(difficulty, updated.slice(-RECENT_SIZE));
      return list[index];
    },
  };
}
