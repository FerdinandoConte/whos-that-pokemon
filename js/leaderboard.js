// Hall of Fame. Online board through the Firestore REST API (no SDK, nothing to
// install), with a per-device board used when no online project is configured
// or the network fails. validateEntry() mirrors firestore.rules exactly, so the
// browser never sends something the server would refuse.

export const LIMITS = { nameMax: 16, scoreMax: 493, hintsMax: 3, themeMax: 12, listMax: 100 };
const LOCAL_KEY = 'wtp.localBoard.v1';

export function sanitizeName(raw) {
  return String(raw ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^_+/, '') // leading "__" is reserved for rule checks
    .trim()
    .slice(0, LIMITS.nameMax);
}

/** Same checks as firestore.rules → returns null if valid, or a reason. */
export function validateEntry(e) {
  if (!e || typeof e !== 'object') return 'not-an-object';
  const allowed = ['name', 'score', 'hints', 'theme'];
  for (const k of Object.keys(e)) if (!allowed.includes(k)) return `unexpected-field:${k}`;
  if (typeof e.name !== 'string') return 'name-type';
  if (e.name.length < 1 || e.name.length > LIMITS.nameMax) return 'name-length';
  if (e.name !== sanitizeName(e.name)) return 'name-format';
  if (!Number.isInteger(e.score) || e.score < 0 || e.score > LIMITS.scoreMax) return 'score';
  if (!Number.isInteger(e.hints) || e.hints < 0 || e.hints > LIMITS.hintsMax) return 'hints';
  if (e.theme !== undefined && (typeof e.theme !== 'string' || e.theme.length > LIMITS.themeMax)) return 'theme';
  return null;
}

/** Ranking: higher score first, then fewer hints, then earlier. */
export function rank(entries) {
  return entries.slice().sort((a, b) =>
    (b.score - a.score) || (a.hints - b.hints) || ((a.at || 0) - (b.at || 0)));
}

function randomId() {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const buf = new Uint8Array(20);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (b) => abc[b % abc.length]).join('');
}

export function createLocalBoard(storage) {
  const read = () => {
    try { return JSON.parse(storage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
  };
  return {
    kind: 'local',
    async submit(entry) {
      const bad = validateEntry(entry);
      if (bad) return { ok: false, error: bad };
      const list = rank([...read(), { ...entry, at: Date.now() }]).slice(0, 50);
      try { storage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
      return { ok: true };
    },
    async top(limit = 20) { return { ok: true, entries: rank(read()).slice(0, limit) }; },
  };
}

export function createFirestoreBoard(config, fetchImpl = globalThis.fetch) {
  const base = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents`;
  const key = `key=${encodeURIComponent(config.apiKey)}`;
  return {
    kind: 'online',
    async submit(entry) {
      const bad = validateEntry(entry);
      if (bad) return { ok: false, error: bad };
      const fields = {
        name: { stringValue: entry.name },
        score: { integerValue: String(entry.score) },
        hints: { integerValue: String(entry.hints) },
      };
      if (entry.theme !== undefined) fields.theme = { stringValue: entry.theme };
      const body = {
        writes: [{
          update: { name: `projects/${config.projectId}/databases/(default)/documents/scores/${randomId()}`, fields },
          currentDocument: { exists: false },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
        }],
      };
      try {
        const r = await fetchImpl(`${base}:commit?${key}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        if (!r.ok) return { ok: false, error: `http-${r.status}` };
        return { ok: true };
      } catch (err) {
        return { ok: false, error: 'network' };
      }
    },
    async top(limit = 20) {
      const body = {
        structuredQuery: {
          from: [{ collectionId: 'scores' }],
          orderBy: [{ field: { fieldPath: 'score' }, direction: 'DESCENDING' }],
          limit: 60,
        },
      };
      try {
        const r = await fetchImpl(`${base}:runQuery?${key}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        });
        if (!r.ok) return { ok: false, error: `http-${r.status}` };
        const rows = await r.json();
        const entries = (Array.isArray(rows) ? rows : [])
          .filter((row) => row && row.document && row.document.fields)
          // names starting with "__" are reserved for checks of the live rules
          .filter((row) => !String(row.document.fields.name?.stringValue ?? '').startsWith('__'))
          .map(({ document: { fields: f } }) => ({
            name: f.name?.stringValue ?? '?',
            score: Number(f.score?.integerValue ?? 0),
            hints: Number(f.hints?.integerValue ?? 0),
            at: f.createdAt?.timestampValue ? Date.parse(f.createdAt.timestampValue) : 0,
          }));
        return { ok: true, entries: rank(entries).slice(0, limit) };
      } catch (err) {
        return { ok: false, error: 'network' };
      }
    },
  };
}

/**
 * Online board when configured, mirrored to the device board, so the Hall of
 * Fame still shows something when offline.
 */
export function createLeaderboard(config, storage, fetchImpl) {
  const local = createLocalBoard(storage);
  if (!config || !config.projectId || !config.apiKey) return local;
  const online = createFirestoreBoard(config, fetchImpl);
  return {
    kind: 'online',
    async submit(entry) {
      await local.submit(entry);
      return online.submit(entry);
    },
    async top(limit = 20) {
      const r = await online.top(limit);
      if (r.ok) return r;
      const l = await local.top(limit);
      return { ...l, offline: true, error: r.error };
    },
  };
}
