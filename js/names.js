// Name handling: what counts as a correct guess, and how a name is shown as
// letter slots. Pure functions, shared by the browser and the Node tests.

/**
 * Reduce a name to the form used for comparison:
 * lower case, accents removed, ♀ → f, ♂ → m, and every character that is not
 * a letter or digit dropped (spaces, dots, dashes, apostrophes of any kind).
 * "Mr. Mime" → "mrmime", "Farfetch’d" → "farfetchd", "Nidoran♀" → "nidoranf".
 */
export function normalizeName(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Every normalized spelling accepted for a Pokémon. The rule is "exact name,
 * ignoring case and symbols". The only extra spellings are for the two Nidoran,
 * whose ♀/♂ symbol can't be typed on most phone keyboards.
 */
export function acceptedAnswers(pokemon) {
  const base = normalizeName(pokemon.name);
  const out = new Set([base]);
  if (pokemon.name === 'Nidoran♀') {
    ['nidoran', 'nidoranfemale', 'nidoranf'].forEach((s) => out.add(s));
  }
  if (pokemon.name === 'Nidoran♂') {
    ['nidoran', 'nidoranmale', 'nidoranm'].forEach((s) => out.add(s));
  }
  return out;
}

export function isCorrectGuess(guess, pokemon) {
  const g = normalizeName(guess);
  if (!g) return false;
  return acceptedAnswers(pokemon).has(g);
}

/**
 * Split a display name into slots. Letters and digits are guessable slots;
 * everything else (space, dot, dash, apostrophe, ♀, ♂) is shown as-is.
 */
export function nameSlots(name) {
  return Array.from(name).map((ch) => {
    const guessable = /[\p{L}\p{N}]/u.test(ch) && ch !== '♀' && ch !== '♂';
    return { ch, guessable };
  });
}

export function guessableIndexes(name) {
  return nameSlots(name)
    .map((s, i) => (s.guessable ? i : -1))
    .filter((i) => i >= 0);
}
