import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dex = JSON.parse(readFileSync(new URL('../../data/pokemon.json', import.meta.url), 'utf8'));
const TYPES = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground',
  'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];

test('493 Pokémon, ids 1..493 in order', () => {
  assert.equal(dex.length, 493);
  dex.forEach((p, i) => assert.equal(p.id, i + 1));
});

test('every entry has exactly the expected fields', () => {
  for (const p of dex) assert.deepEqual(Object.keys(p).sort(), ['cry', 'gen', 'id', 'name', 'sd', 'types']);
});

test('names: non-empty, trimmed, unique', () => {
  const names = new Set();
  for (const p of dex) {
    assert.equal(typeof p.name, 'string');
    assert.ok(p.name.length >= 3, p.name);
    assert.equal(p.name, p.name.trim());
    assert.ok(!names.has(p.name), `duplicate ${p.name}`);
    names.add(p.name);
  }
});

test('well-known names are spelled the official way', () => {
  const expect = { 1: 'Bulbasaur', 25: 'Pikachu', 29: 'Nidoran♀', 32: 'Nidoran♂', 83: "Farfetch'd", 122: 'Mr. Mime',
    150: 'Mewtwo', 151: 'Mew', 233: 'Porygon2', 250: 'Ho-Oh', 251: 'Celebi', 386: 'Deoxys', 439: 'Mime Jr.',
    474: 'Porygon-Z', 487: 'Giratina', 493: 'Arceus' };
  for (const [id, name] of Object.entries(expect)) assert.equal(dex[id - 1].name, name);
});

test('types: 1 or 2 distinct valid types', () => {
  for (const p of dex) {
    assert.ok(p.types.length === 1 || p.types.length === 2, `${p.name}`);
    assert.equal(new Set(p.types).size, p.types.length, `${p.name} repeats a type`);
    for (const t of p.types) assert.ok(TYPES.includes(t), `${p.name}: ${t}`);
  }
});

test('types use the current games (Fairy introduced in Gen 6)', () => {
  const pick = (id) => dex[id - 1].types.join('/');
  assert.equal(pick(35), 'Fairy'); // Clefairy
  assert.equal(pick(39), 'Normal/Fairy'); // Jigglypuff
  assert.equal(pick(122), 'Psychic/Fairy'); // Mr. Mime
  assert.equal(pick(81), 'Electric/Steel'); // Magnemite
  assert.equal(pick(479), 'Electric/Ghost'); // Rotom
  assert.equal(pick(283), 'Bug/Water'); // Surskit
  assert.equal(pick(400), 'Normal/Water'); // Bibarel
});

test('every type appears, counts match the PokéAPI cross-check', () => {
  const count = Object.fromEntries(TYPES.map((t) => [t, 0]));
  for (const p of dex) for (const t of p.types) count[t] += 1;
  // counts verified against pokeapi.co type lists (ids ≤ 493) on 2026-10-06
  const expected = { Fairy: 20, Steel: 25, Dark: 23, Ghost: 18, Dragon: 19, Ice: 22, Fire: 33, Electric: 28,
    Fighting: 25, Poison: 50, Ground: 47, Rock: 37, Psychic: 53, Bug: 45, Flying: 64, Grass: 55, Water: 92, Normal: 72 };
  assert.deepEqual(count, expected);
});

test('generation matches the Pokédex number', () => {
  for (const p of dex) {
    const want = p.id <= 151 ? 1 : p.id <= 251 ? 2 : p.id <= 386 ? 3 : 4;
    assert.equal(p.gen, want, p.name);
  }
});

test('fallback cry ids are unique, lowercase alphanumeric', () => {
  const ids = new Set();
  for (const p of dex) {
    assert.match(p.sd, /^[a-z0-9]+$/, p.name);
    assert.ok(!ids.has(p.sd), p.sd);
    ids.add(p.sd);
  }
  assert.equal(dex[28].sd, 'nidoranf');
  assert.equal(dex[121].sd, 'mrmime');
});

test('cry flag matches the files in audio/cries, and no stray files', () => {
  const files = readdirSync(new URL('../../audio/cries/', import.meta.url));
  for (const f of files) assert.match(f, /^\d+\.mp3$/, `unexpected file ${f}`);
  const have = new Set(files.map((f) => Number(f.slice(0, -4))));
  for (const p of dex) assert.equal(p.cry, have.has(p.id), `${p.id} ${p.name}`);
  for (const id of have) assert.ok(id >= 1 && id <= 493, `cry ${id} outside the game`);
});
