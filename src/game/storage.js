// The only module that touches localStorage. Private browsing, a full disk, or
// a corrupt value must never break the game, so every backend call is guarded
// and an in-memory copy keeps the session working regardless.
export function createStorage(getBackend) {
  const memory = {};

  function backend() {
    try {
      return getBackend() || null;
    } catch (e) {
      return null;
    }
  }

  function parse(raw, fallback) {
    if (raw === null || raw === undefined) return fallback;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  return {
    getJSON(key, fallback) {
      if (Object.prototype.hasOwnProperty.call(memory, key)) return parse(memory[key], fallback);
      const b = backend();
      if (!b) return fallback;
      try {
        return parse(b.getItem(key), fallback);
      } catch (e) {
        return fallback;
      }
    },
    setJSON(key, value) {
      const raw = JSON.stringify(value);
      memory[key] = raw;
      const b = backend();
      if (!b) return;
      try {
        b.setItem(key, raw);
      } catch (e) {
        // Quota or security errors: the in-memory copy carries the session.
      }
    },
  };
}
