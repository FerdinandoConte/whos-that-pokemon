import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeName, isCorrectGuess, acceptedAnswers, nameSlots, guessableIndexes } from '../../js/names.js';

const dex = JSON.parse(readFileSync(new URL('../../data/pokemon.json', import.meta.url), 'utf8'));
const byName = (n) => dex.find((p) => p.name === n);

test('normalizeName: case, spaces, punctuation, accents, gender symbols', () => {
  assert.equal(normalizeName('Pikachu'), 'pikachu');
  assert.equal(normalizeName('  PIKACHU  '), 'pikachu');
  assert.equal(normalizeName('Mr. Mime'), 'mrmime');
  assert.equal(normalizeName("Farfetch'd"), 'farfetchd');
  assert.equal(normalizeName('Farfetch’d'), 'farfetchd'); // curly apostrophe from iOS keyboards
  assert.equal(normalizeName('Ho-Oh'), 'hooh');
  assert.equal(normalizeName('Porygon-Z'), 'porygonz');
  assert.equal(normalizeName('Nidoran♀'), 'nidoranf');
  assert.equal(normalizeName('Nidoran♂'), 'nidoranm');
  assert.equal(normalizeName('Pokémon'), 'pokemon');
  assert.equal(normalizeName('Porygon2'), 'porygon2');
  assert.equal(normalizeName(''), '');
  assert.equal(normalizeName(null), '');
  assert.equal(normalizeName(undefined), '');
  assert.equal(normalizeName(42), '');
});

test('every Pokémon is accepted by its own exact name', () => {
  for (const p of dex) {
    assert.ok(isCorrectGuess(p.name, p), `${p.id} ${p.name} exact`);
    assert.ok(isCorrectGuess(p.name.toUpperCase(), p), `${p.id} ${p.name} upper case`);
    assert.ok(isCorrectGuess(p.name.toLowerCase(), p), `${p.id} ${p.name} lower case`);
    assert.ok(isCorrectGuess(`  ${p.name}  `, p), `${p.id} ${p.name} padded`);
  }
});

test('every Pokémon rejects every other Pokémon name (except the two Nidoran aliases)', () => {
  for (const p of dex) {
    for (const q of dex) {
      if (p.id === q.id) continue;
      const nidoranPair = p.name.startsWith('Nidoran') && q.name.startsWith('Nidoran');
      if (nidoranPair) continue;
      assert.equal(isCorrectGuess(q.name, p), false, `${q.name} must not match ${p.name}`);
    }
  }
});

test('special names: symbol-free spellings accepted', () => {
  const cases = {
    'Mr. Mime': ['Mr Mime', 'mr.mime', 'MR. MIME', 'mrmime', 'Mr-Mime'],
    "Farfetch'd": ['Farfetchd', 'farfetch d', 'FARFETCH’D'],
    'Ho-Oh': ['Ho Oh', 'hooh', 'HO-OH'],
    'Porygon-Z': ['Porygon Z', 'porygonz'],
    'Porygon2': ['porygon 2', 'PORYGON2'],
    'Mime Jr.': ['Mime Jr', 'mimejr', 'mime jr.'],
  };
  for (const [name, variants] of Object.entries(cases)) {
    const p = byName(name);
    assert.ok(p, `${name} exists in data`);
    for (const v of variants) assert.ok(isCorrectGuess(v, p), `${v} → ${name}`);
  }
});

test('Nidoran: symbol, letter and plain spellings', () => {
  const f = byName('Nidoran♀');
  const m = byName('Nidoran♂');
  for (const v of ['Nidoran♀', 'nidoran f', 'Nidoran F', 'nidoranfemale', 'Nidoran']) assert.ok(isCorrectGuess(v, f), v);
  for (const v of ['Nidoran♂', 'nidoran m', 'Nidoran M', 'nidoranmale', 'Nidoran']) assert.ok(isCorrectGuess(v, m), v);
  assert.equal(isCorrectGuess('nidoran m', f), false);
  assert.equal(isCorrectGuess('nidoran f', m), false);
  assert.equal(isCorrectGuess('Nidorina', f), false);
});

test('typos and partial names are rejected (strict matching)', () => {
  const pika = byName('Pikachu');
  for (const v of ['Pikachuu', 'Pikach', 'Pickachu', 'Pikahu', 'Pika', 'Pikachu2', 'Raichu', '', '   ', '...']) {
    assert.equal(isCorrectGuess(v, pika), false, v);
  }
  const gar = byName('Garchomp');
  for (const v of ['Garchom', 'Garchompp', 'Gar chomp x']) assert.equal(isCorrectGuess(v, gar), false, v);
});

test('normalized names are unique across the Pokédex', () => {
  const seen = new Map();
  for (const p of dex) {
    const n = normalizeName(p.name);
    assert.ok(!seen.has(n), `${p.name} collides with ${seen.get(n)}`);
    seen.set(n, p.name);
  }
});

test('extra accepted spellings exist only for the two Nidoran', () => {
  for (const p of dex) {
    const extra = acceptedAnswers(p).size - 1;
    // "nidoranf" is already the base spelling; extras are "nidoran" and "nidoranfemale"
    if (p.name.startsWith('Nidoran')) assert.equal(extra, 2, p.name);
    else assert.equal(extra, 0, p.name);
  }
});

test('nameSlots: letters and digits are guessable, symbols are fixed', () => {
  const s = nameSlots('Mr. Mime');
  assert.equal(s.length, 8);
  assert.deepEqual(s.filter((x) => !x.guessable).map((x) => x.ch), ['.', ' ']);
  assert.deepEqual(guessableIndexes('Mr. Mime'), [0, 1, 4, 5, 6, 7]);
  assert.deepEqual(guessableIndexes('Nidoran♀'), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(guessableIndexes('Porygon2'), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(guessableIndexes("Farfetch'd"), [0, 1, 2, 3, 4, 5, 6, 7, 9]);
  assert.deepEqual(guessableIndexes('Ho-Oh'), [0, 1, 3, 4]);
  for (const p of dex) assert.ok(guessableIndexes(p.name).length >= 3, `${p.name} has at least 3 letters`);
});
