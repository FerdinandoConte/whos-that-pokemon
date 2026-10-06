import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  sanitizeName, validateEntry, rank, LIMITS,
  createLocalBoard, createFirestoreBoard, createLeaderboard,
} from '../../js/leaderboard.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('sanitizeName trims, collapses spaces, strips control chars, caps length', () => {
  assert.equal(sanitizeName('  Ash  Ketchum '), 'Ash Ketchum');
  assert.equal(sanitizeName('a\u0000b\u0007c'), 'abc');
  assert.equal(sanitizeName('x'.repeat(40)).length, 16);
  assert.equal(sanitizeName(null), '');
  assert.equal(sanitizeName('Marco 🔥'), 'Marco 🔥');
  assert.equal(sanitizeName('__admin'), 'admin', 'leading underscores are reserved');
});

test('validateEntry accepts valid entries', () => {
  assert.equal(validateEntry({ name: 'Marco', score: 0, hints: 0 }), null);
  assert.equal(validateEntry({ name: 'M', score: 493, hints: 3, theme: 'arena' }), null);
  assert.equal(validateEntry({ name: 'x'.repeat(16), score: 12, hints: 1 }), null);
});

test('validateEntry rejects what firestore.rules rejects', () => {
  const bad = [
    [null, 'not-an-object'],
    [{ name: '', score: 1, hints: 0 }, 'name-length'],
    [{ name: 'x'.repeat(17), score: 1, hints: 0 }, 'name-length'],
    [{ name: 5, score: 1, hints: 0 }, 'name-type'],
    [{ name: ' Marco', score: 1, hints: 0 }, 'name-format'],
    [{ name: 'Marco', score: -1, hints: 0 }, 'score'],
    [{ name: 'Marco', score: 494, hints: 0 }, 'score'],
    [{ name: 'Marco', score: 1.5, hints: 0 }, 'score'],
    [{ name: 'Marco', score: '3', hints: 0 }, 'score'],
    [{ name: 'Marco', score: 3, hints: 4 }, 'hints'],
    [{ name: 'Marco', score: 3, hints: -1 }, 'hints'],
    [{ name: 'Marco', score: 3, hints: 0, theme: 'x'.repeat(13) }, 'theme'],
    [{ name: 'Marco', score: 3, hints: 0, admin: true }, 'unexpected-field:admin'],
  ];
  for (const [entry, reason] of bad) assert.equal(validateEntry(entry), reason, JSON.stringify(entry));
});

test('firestore.rules and validateEntry use the same limits', () => {
  const rules = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  assert.match(rules, new RegExp(`name\\.size\\(\\) <= ${LIMITS.nameMax}\\b`));
  assert.match(rules, new RegExp(`score <= ${LIMITS.scoreMax}\\b`));
  assert.match(rules, new RegExp(`hints <= ${LIMITS.hintsMax}\\b`));
  assert.match(rules, new RegExp(`theme\\.size\\(\\) <= ${LIMITS.themeMax}\\b`));
  assert.match(rules, new RegExp(`request\\.query\\.limit <= ${LIMITS.listMax}\\b`));
  assert.match(rules, /allow update, delete: if false;/);
  assert.match(rules, /createdAt == request\.time/);
});

test('rank: score desc, then fewer hints, then earlier', () => {
  const r = rank([
    { name: 'a', score: 5, hints: 2, at: 1 },
    { name: 'b', score: 9, hints: 3, at: 5 },
    { name: 'c', score: 5, hints: 0, at: 9 },
    { name: 'd', score: 5, hints: 0, at: 3 },
  ]);
  assert.deepEqual(r.map((e) => e.name), ['b', 'd', 'c', 'a']);
});

test('local board stores, ranks, limits and survives corrupted storage', async () => {
  const st = memoryStorage();
  const b = createLocalBoard(st);
  for (let i = 0; i < 60; i += 1) assert.equal((await b.submit({ name: `p${i}`, score: i, hints: 0 })).ok, true);
  const t = await b.top(20);
  assert.equal(t.entries.length, 20);
  assert.equal(t.entries[0].score, 59);
  assert.equal((await b.submit({ name: '', score: 1, hints: 0 })).ok, false);
  st.setItem('wtp.localBoard.v1', '{not json');
  assert.deepEqual((await b.top()).entries, []);
});

test('firestore board: submit sends the exact REST commit the rules expect', async () => {
  const calls = [];
  const fetchMock = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({}) }; };
  const b = createFirestoreBoard({ projectId: 'demo-proj', apiKey: 'KEY 1' }, fetchMock);
  const r = await b.submit({ name: 'Marco', score: 12, hints: 1, theme: 'arena' });
  assert.equal(r.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://firestore.googleapis.com/v1/projects/demo-proj/databases/(default)/documents:commit?key=KEY%201');
  assert.equal(calls[0].init.method, 'POST');
  const body = JSON.parse(calls[0].init.body);
  const w = body.writes[0];
  assert.match(w.update.name, /^projects\/demo-proj\/databases\/\(default\)\/documents\/scores\/[A-Za-z0-9]{20}$/);
  assert.deepEqual(w.update.fields, {
    name: { stringValue: 'Marco' }, score: { integerValue: '12' }, hints: { integerValue: '1' }, theme: { stringValue: 'arena' },
  });
  assert.deepEqual(w.currentDocument, { exists: false });
  assert.deepEqual(w.updateTransforms, [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }]);
});

test('firestore board: invalid entries never reach the network', async () => {
  let called = false;
  const b = createFirestoreBoard({ projectId: 'p', apiKey: 'k' }, async () => { called = true; return { ok: true }; });
  assert.equal((await b.submit({ name: '', score: 1, hints: 0 })).ok, false);
  assert.equal(called, false);
});

test('firestore board: top parses runQuery rows and ranks them', async () => {
  const rows = [
    { readTime: '2026-10-06T00:00:00Z' },
    { document: { fields: { name: { stringValue: '__rules_test__' }, score: { integerValue: '99' }, hints: { integerValue: '0' } } } },
    { document: { fields: { name: { stringValue: 'A' }, score: { integerValue: '4' }, hints: { integerValue: '0' }, createdAt: { timestampValue: '2026-10-01T10:00:00Z' } } } },
    { document: { fields: { name: { stringValue: 'B' }, score: { integerValue: '9' }, hints: { integerValue: '2' }, createdAt: { timestampValue: '2026-10-02T10:00:00Z' } } } },
    { document: { fields: { name: { stringValue: 'C' }, score: { integerValue: '9' }, hints: { integerValue: '0' }, createdAt: { timestampValue: '2026-10-03T10:00:00Z' } } } },
  ];
  let sent;
  const b = createFirestoreBoard({ projectId: 'p', apiKey: 'k' }, async (url, init) => { sent = { url, body: JSON.parse(init.body) }; return { ok: true, json: async () => rows }; });
  const r = await b.top(2);
  assert.equal(r.ok, true);
  assert.deepEqual(r.entries.map((e) => e.name), ['C', 'B']);
  assert.match(sent.url, /documents:runQuery\?key=k$/);
  assert.ok(sent.body.structuredQuery.limit <= LIMITS.listMax, 'query limit allowed by the rules');
  assert.deepEqual(sent.body.structuredQuery.from, [{ collectionId: 'scores' }]);
});

test('firestore board: HTTP and network errors are reported, not thrown', async () => {
  const http = createFirestoreBoard({ projectId: 'p', apiKey: 'k' }, async () => ({ ok: false, status: 403 }));
  assert.deepEqual(await http.submit({ name: 'A', score: 1, hints: 0 }), { ok: false, error: 'http-403' });
  assert.deepEqual(await http.top(), { ok: false, error: 'http-403' });
  const net = createFirestoreBoard({ projectId: 'p', apiKey: 'k' }, async () => { throw new TypeError('Failed to fetch'); });
  assert.deepEqual(await net.submit({ name: 'A', score: 1, hints: 0 }), { ok: false, error: 'network' });
  assert.deepEqual(await net.top(), { ok: false, error: 'network' });
});

test('createLeaderboard: local only without config', () => {
  assert.equal(createLeaderboard({ projectId: '', apiKey: '' }, memoryStorage()).kind, 'local');
  assert.equal(createLeaderboard(null, memoryStorage()).kind, 'local');
});

test('createLeaderboard: online with device fallback when offline', async () => {
  const st = memoryStorage();
  const b = createLeaderboard({ projectId: 'p', apiKey: 'k' }, st, async () => { throw new Error('offline'); });
  assert.equal(b.kind, 'online');
  const s = await b.submit({ name: 'Marco', score: 7, hints: 1 });
  assert.equal(s.ok, false, 'online submit failed');
  const t = await b.top();
  assert.equal(t.offline, true);
  assert.deepEqual(t.entries.map((e) => [e.name, e.score]), [['Marco', 7]], 'score kept on the device');
});
