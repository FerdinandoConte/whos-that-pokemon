// localStorage with a memory fallback (private browsing, blocked storage).
const memory = new Map();

function backend() {
  try {
    const k = '__wtp_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => memory.set(key, String(value)),
      removeItem: (key) => memory.delete(key),
    };
  }
}

export const storage = backend();

const KEYS = { theme: 'wtp.theme', nickname: 'wtp.nickname', best: 'wtp.best', sound: 'wtp.sound' };

export const prefs = {
  get theme() { return storage.getItem(KEYS.theme); },
  set theme(v) { safeSet(KEYS.theme, v); },
  get nickname() { return storage.getItem(KEYS.nickname) || ''; },
  set nickname(v) { safeSet(KEYS.nickname, v); },
  get best() { const n = parseInt(storage.getItem(KEYS.best) || '0', 10); return Number.isFinite(n) && n > 0 ? n : 0; },
  set best(v) { safeSet(KEYS.best, String(v)); },
  get sound() { return storage.getItem(KEYS.sound) !== 'off'; },
  set sound(on) { safeSet(KEYS.sound, on ? 'on' : 'off'); },
};

function safeSet(key, value) {
  try { storage.setItem(key, value); } catch { /* quota or blocked: ignore */ }
}
