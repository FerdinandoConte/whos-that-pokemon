// Game rules, independent from the screen. The UI only calls these methods and
// draws what they return, so every rule can be tested in Node.
import { isCorrectGuess, guessableIndexes } from './names.js';

export const START_LIVES = 3;
export const START_HINTS = 3;

/** Uniform random float in [0, 1) from the Web Crypto API. */
export function cryptoRandom() {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle(items, random = cryptoRandom) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Status values:
 *  'playing'  waiting for a guess on the current Pokémon
 *  'correct'  current Pokémon guessed, waiting for next()
 *  'lost'     last life gone: game over (current Pokémon is revealed)
 *  'won'      every Pokémon guessed
 */
export function createGame(pokedex, opts = {}) {
  if (!Array.isArray(pokedex) || pokedex.length === 0) {
    throw new Error('createGame needs a non-empty list of Pokémon');
  }
  const random = opts.random || cryptoRandom;
  // opts.order (list of ids) fixes the sequence: used only by the automated tests
  const order = Array.isArray(opts.order) && opts.order.length
    ? opts.order.map((id) => pokedex.find((p) => p.id === id)).filter(Boolean)
    : shuffle(pokedex, random);
  if (order.length === 0) throw new Error('createGame: empty order');
  const s = {
    index: 0,
    lives: opts.lives ?? START_LIVES,
    hintsLeft: opts.hints ?? START_HINTS,
    hintsUsed: 0,
    score: 0,
    status: 'playing',
    revealed: new Set(),
    hintShown: false,
    wrongThisRound: 0,
    log: [],
  };

  const current = () => order[s.index];

  function guess(text) {
    if (s.status !== 'playing') return { type: 'ignored', status: s.status };
    const trimmed = String(text ?? '').trim();
    if (!trimmed) return { type: 'empty' };
    const p = current();
    if (isCorrectGuess(trimmed, p)) {
      s.score += 1;
      s.status = 'correct';
      s.log.push({ id: p.id, guess: trimmed, ok: true });
      return { type: 'correct', pokemon: p, score: s.score };
    }
    s.lives -= 1;
    s.wrongThisRound += 1;
    s.log.push({ id: p.id, guess: trimmed, ok: false });
    if (s.lives <= 0) {
      s.lives = 0;
      s.status = 'lost';
      return { type: 'wrong', livesLeft: 0, gameOver: true, pokemon: p, score: s.score };
    }
    return { type: 'wrong', livesLeft: s.lives, gameOver: false };
  }

  function useHint() {
    if (s.status !== 'playing') return { ok: false, reason: 'not-playing' };
    if (s.hintsLeft <= 0) return { ok: false, reason: 'no-hints' };
    const p = current();
    const hidden = guessableIndexes(p.name).filter((i) => !s.revealed.has(i));
    // never give away the whole name: at least one letter stays hidden
    if (hidden.length <= 1) return { ok: false, reason: 'no-letters' };
    const index = hidden[Math.floor(random() * hidden.length)];
    s.revealed.add(index);
    s.hintsLeft -= 1;
    s.hintsUsed += 1;
    s.hintShown = true;
    return {
      ok: true, index, letter: Array.from(p.name)[index],
      gen: p.gen, types: p.types.slice(), hintsLeft: s.hintsLeft,
    };
  }

  function next() {
    if (s.status !== 'correct') return { type: 'ignored', status: s.status };
    s.index += 1;
    s.revealed = new Set();
    s.hintShown = false;
    s.wrongThisRound = 0;
    if (s.index >= order.length) {
      s.index = order.length - 1;
      s.status = 'won';
      return { type: 'won', score: s.score };
    }
    s.status = 'playing';
    return { type: 'next', pokemon: current() };
  }

  /** Pokémon after the current one, for preloading images and cries. */
  function upcoming(n = 2) {
    return order.slice(s.index + 1, s.index + 1 + n);
  }

  function snapshot() {
    return {
      status: s.status,
      round: s.index + 1,
      total: order.length,
      lives: s.lives,
      hintsLeft: s.hintsLeft,
      hintsUsed: s.hintsUsed,
      score: s.score,
      revealed: Array.from(s.revealed).sort((a, b) => a - b),
      hintShown: s.hintShown,
      pokemon: current(),
    };
  }

  return { current, guess, useHint, next, upcoming, snapshot, order: () => order.slice(), log: () => s.log.slice() };
}
