import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGame, shuffle, cryptoRandom, START_LIVES, START_HINTS } from '../../js/game.js';
import { guessableIndexes } from '../../js/names.js';

const dex = JSON.parse(readFileSync(new URL('../../data/pokemon.json', import.meta.url), 'utf8'));

// small deterministic PRNG (mulberry32) so failures can be reproduced
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('cryptoRandom returns floats in [0,1)', () => {
  for (let i = 0; i < 10000; i += 1) {
    const r = cryptoRandom();
    assert.ok(r >= 0 && r < 1);
  }
});

test('shuffle returns a permutation and does not mutate the input', () => {
  const input = dex.map((p) => p.id);
  const copy = input.slice();
  const out = shuffle(input, seeded(1));
  assert.deepEqual(input, copy);
  assert.equal(out.length, input.length);
  assert.deepEqual(out.slice().sort((a, b) => a - b), copy.slice().sort((a, b) => a - b));
  assert.notDeepEqual(out, copy);
});

test('every new game has a different sequence (crypto RNG, 300 games)', () => {
  const seqs = new Set();
  for (let i = 0; i < 300; i += 1) seqs.add(createGame(dex).order().slice(0, 10).map((p) => p.id).join(','));
  assert.equal(seqs.size, 300);
});

test('first Pokémon is spread across the whole Pokédex (no bias to a region)', () => {
  const gens = [0, 0, 0, 0, 0];
  const N = 4000;
  for (let i = 0; i < N; i += 1) gens[createGame(dex).current().gen] += 1;
  const expected = { 1: 151, 2: 100, 3: 135, 4: 107 };
  for (const g of [1, 2, 3, 4]) {
    const share = gens[g] / N;
    const want = expected[g] / 493;
    assert.ok(Math.abs(share - want) < 0.035, `gen ${g}: ${share.toFixed(3)} vs ${want.toFixed(3)}`);
  }
});

test('initial state', () => {
  const g = createGame(dex, { random: seeded(7) });
  const s = g.snapshot();
  assert.equal(s.status, 'playing');
  assert.equal(s.lives, START_LIVES);
  assert.equal(START_LIVES, 3);
  assert.equal(s.hintsLeft, START_HINTS);
  assert.equal(START_HINTS, 3);
  assert.equal(s.score, 0);
  assert.equal(s.round, 1);
  assert.equal(s.total, 493);
  assert.deepEqual(s.revealed, []);
  assert.equal(s.hintShown, false);
});

test('correct guess → +1 point, then next Pokémon', () => {
  const g = createGame(dex, { random: seeded(2) });
  const first = g.current();
  const r = g.guess(first.name.toLowerCase());
  assert.equal(r.type, 'correct');
  assert.equal(r.score, 1);
  assert.equal(g.snapshot().status, 'correct');
  assert.equal(g.guess('anything').type, 'ignored', 'no guessing while revealed');
  assert.equal(g.useHint().ok, false, 'no hint while revealed');
  const n = g.next();
  assert.equal(n.type, 'next');
  assert.notEqual(g.current().id, first.id);
  assert.equal(g.snapshot().round, 2);
  assert.equal(g.snapshot().lives, 3, 'lives untouched');
});

test('wrong guesses cost a life, including names that do not exist', () => {
  const g = createGame(dex, { random: seeded(3) });
  const p = g.current();
  const other = dex.find((q) => q.id !== p.id);
  let r = g.guess(other.name);
  assert.deepEqual([r.type, r.livesLeft, r.gameOver], ['wrong', 2, false]);
  r = g.guess('Notapokemon');
  assert.deepEqual([r.type, r.livesLeft, r.gameOver], ['wrong', 1, false]);
  assert.equal(g.snapshot().status, 'playing', 'still the same Pokémon');
  assert.equal(g.current().id, p.id);
  r = g.guess('xyz');
  assert.deepEqual([r.type, r.livesLeft, r.gameOver], ['wrong', 0, true]);
  assert.equal(r.pokemon.id, p.id, 'game over reveals the Pokémon');
  assert.equal(g.snapshot().status, 'lost');
  assert.equal(g.guess(p.name).type, 'ignored', 'no guesses after game over');
  assert.equal(g.next().type, 'ignored');
  assert.equal(g.snapshot().lives, 0);
});

test('lives carry over between Pokémon (3 for the whole game)', () => {
  const g = createGame(dex, { random: seeded(4) });
  g.guess('wrong one');
  g.guess(g.current().name);
  g.next();
  assert.equal(g.snapshot().lives, 2);
  g.guess('wrong two');
  g.guess(g.current().name);
  g.next();
  const r = g.guess('wrong three');
  assert.equal(r.gameOver, true);
  assert.equal(g.snapshot().score, 2);
});

test('empty or blank guesses do nothing', () => {
  const g = createGame(dex, { random: seeded(5) });
  for (const v of ['', '   ', null, undefined]) assert.equal(g.guess(v).type, 'empty');
  assert.equal(g.snapshot().lives, 3);
});

test('a hint reveals one hidden letter plus generation and types', () => {
  const g = createGame(dex, { random: seeded(6) });
  const p = g.current();
  const h = g.useHint();
  assert.equal(h.ok, true);
  assert.ok(guessableIndexes(p.name).includes(h.index));
  assert.equal(h.letter, Array.from(p.name)[h.index]);
  assert.equal(h.gen, p.gen);
  assert.deepEqual(h.types, p.types);
  assert.equal(h.hintsLeft, 2);
  const s = g.snapshot();
  assert.deepEqual(s.revealed, [h.index]);
  assert.equal(s.hintShown, true);
  assert.equal(s.hintsUsed, 1);
});

test('hints: 3 per game in total, each reveals a different letter', () => {
  const long = dex.find((p) => p.name === 'Crawdaunt');
  const g = createGame([long], { random: seeded(8) });
  const idx = [g.useHint(), g.useHint(), g.useHint()].map((h) => h.index);
  assert.equal(new Set(idx).size, 3);
  const r = g.useHint();
  assert.deepEqual([r.ok, r.reason], [false, 'no-hints']);
});

test('hints never reveal the whole name (short names)', () => {
  const mew = dex.find((p) => p.name === 'Mew');
  const g = createGame([mew], { random: seeded(9) });
  assert.equal(g.useHint().ok, true);
  assert.equal(g.useHint().ok, true);
  const r = g.useHint();
  assert.deepEqual([r.ok, r.reason], [false, 'no-letters']);
  assert.equal(g.snapshot().hintsLeft, 1, 'a refused hint is not consumed');
});

test('hints left carry over, revealed letters reset on the next Pokémon', () => {
  const g = createGame(dex, { random: seeded(10) });
  g.useHint();
  g.guess(g.current().name);
  g.next();
  const s = g.snapshot();
  assert.equal(s.hintsLeft, 2);
  assert.deepEqual(s.revealed, []);
  assert.equal(s.hintShown, false);
});

test('a Pokémon guessed with a hint still scores a full point', () => {
  const g = createGame(dex, { random: seeded(11) });
  g.useHint();
  assert.equal(g.guess(g.current().name).score, 1);
});

test('guessing every Pokémon wins the game', () => {
  const small = dex.slice(0, 5);
  const g = createGame(small, { random: seeded(12) });
  for (let i = 0; i < 4; i += 1) {
    g.guess(g.current().name);
    assert.equal(g.next().type, 'next');
  }
  g.guess(g.current().name);
  const r = g.next();
  assert.deepEqual([r.type, r.score], ['won', 5]);
  assert.equal(g.snapshot().status, 'won');
  assert.equal(g.guess('x').type, 'ignored');
});

test('a whole run through all 493 Pokémon never repeats one', () => {
  const g = createGame(dex);
  const seen = new Set();
  for (let i = 0; i < 493; i += 1) {
    const p = g.current();
    assert.ok(!seen.has(p.id), `repeat ${p.id}`);
    seen.add(p.id);
    assert.equal(g.guess(p.name).type, 'correct');
    g.next();
  }
  assert.equal(seen.size, 493);
  assert.equal(g.snapshot().status, 'won');
});

test('upcoming() lists the next Pokémon for preloading', () => {
  const g = createGame(dex, { random: seeded(13) });
  const order = g.order();
  assert.deepEqual(g.upcoming(2).map((p) => p.id), order.slice(1, 3).map((p) => p.id));
  g.guess(g.current().name);
  g.next();
  assert.deepEqual(g.upcoming(2).map((p) => p.id), order.slice(2, 4).map((p) => p.id));
});

test('test hook: a fixed order is followed exactly, unknown ids are skipped', () => {
  const g = createGame(dex, { order: [25, 999, 1] });
  assert.deepEqual(g.order().map((p) => p.id), [25, 1]);
  assert.throws(() => createGame(dex, { order: [999] }));
});

test('createGame refuses an empty Pokédex', () => {
  assert.throws(() => createGame([]));
  assert.throws(() => createGame(null));
});
