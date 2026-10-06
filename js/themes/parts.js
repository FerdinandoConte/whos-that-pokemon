// Shared bits of markup used by every theme. Each theme lays them out its own
// way, but the data-role hooks are always the same, so gameplay is identical.

export const DEDICATION = "Daniele ha una passione sfegatata per i Pokémon, noi l'abbiamo trasformata in un gioco!";
export const PHOTO = 'img/daniele.jpg';

export const TYPE_COLORS = {
  Normal: '#A8A77A', Fire: '#EE8130', Water: '#6390F0', Electric: '#F7D02C', Grass: '#7AC74C', Ice: '#96D9D6',
  Fighting: '#C22E28', Poison: '#A33EA1', Ground: '#E2BF65', Flying: '#A98FF3', Psychic: '#F95587', Bug: '#A6B91A',
  Rock: '#B6A136', Ghost: '#735797', Dragon: '#6F35FC', Dark: '#705746', Steel: '#B7B7CE', Fairy: '#D685AD',
};
// readable text colour on each type colour (WCAG contrast picked by hand)
export const TYPE_INK = {
  Normal: '#1d1d12', Fire: '#1f0e00', Water: '#06122e', Electric: '#2a2100', Grass: '#0f2205', Ice: '#062a29',
  Fighting: '#ffffff', Poison: '#ffffff', Ground: '#2a1f00', Flying: '#140a33', Psychic: '#2b0010', Bug: '#1a1f00',
  Rock: '#1f1a00', Ghost: '#ffffff', Dragon: '#ffffff', Dark: '#ffffff', Steel: '#16162a', Fairy: '#2a0c1c',
};

export const GEN_REGION = { 1: 'Kanto', 2: 'Johto', 3: 'Hoenn', 4: 'Sinnoh' };
export const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };

const s = (d, extra = '') => `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" ${extra}>${d}</svg>`;

export const ICON = {
  palette: s('<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1 .2-2.2 1.3-2.2H17a4 4 0 0 0 4-4c0-5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>'),
  trophy: s('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
  bulb: s('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
  lens: s('<circle cx="10" cy="10" r="6.5"/><path d="M15 15l6 6"/>'),
  sound: s('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: s('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  close: s('<path d="M6 6l12 12M18 6L6 18"/>'),
  play: s('<path d="M7 4l13 8-13 8z" fill="currentColor"/>'),
  check: s('<path d="M5 12l5 5L19 7"/>'),
  share: s('<path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>'),
  home: s('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  again: s('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>'),
  exit: s('<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 16l-4-4 4-4M6 12h10"/>'),
  compass: s('<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>'),
  star: '<svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false"><path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" fill="currentColor"/></svg>',
  heart: '<svg viewBox="0 0 24 22" width="1em" height="1em" aria-hidden="true" focusable="false"><path class="life-fill" d="M12 21 C 5 15 1 11.5 1 7 A 5.5 5.5 0 0 1 12 4.5 A 5.5 5.5 0 0 1 23 7 C 23 11.5 19 15 12 21 Z"/></svg>',
  berry: '<svg viewBox="0 0 26 28" width="1em" height="1.08em" aria-hidden="true" focusable="false"><path class="life-leaf" d="M13 6 C 16 0 22 1 22 4 C 18 4 15 5 13 8 Z"/><circle class="life-fill" cx="13" cy="17" r="10"/><circle class="life-shine" cx="9.5" cy="13.5" r="2.5"/></svg>',
};

/** Escape text for HTML. */
export function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Lives: 3 elements with data-life, styled per theme. */
export function lives(icon, cls = '') {
  return `<div class="lives ${cls}" data-role="lives" role="img" aria-label="3 lives left">
    ${[0, 1, 2].map((i) => `<span class="life" data-life="${i}">${icon}</span>`).join('')}
  </div>`;
}

/** Clues area, filled when a hint is used. */
export function clues(label = 'Hint') {
  return `<div class="clues" data-role="clues" hidden>
    <span class="clues-label">${esc(label)}</span>
    <span class="clue-gen" data-role="clue-gen"></span>
    <span class="clue-types" data-role="clue-types"></span>
  </div>`;
}

export function slots() {
  return '<div class="slots" data-role="slots" aria-live="polite"></div>';
}

export function guessForm({ placeholder = 'Type the name', button = 'GO!', buttonAria = 'Guess', cls = '', extra = '' } = {}) {
  return `<form class="guess-form ${cls}" data-role="guess-form" autocomplete="off" novalidate>
    <label class="sr-only" for="guess-input">Pokémon name</label>
    <input id="guess-input" class="guess-input" data-role="guess-input" type="text" inputmode="text"
      autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"
      maxlength="24" placeholder="${esc(placeholder)}">
    <button class="guess-submit" data-role="guess-submit" type="submit" aria-label="${esc(buttonAria)}">${button}</button>
    ${extra}
  </form>`;
}

/** The silhouette image; src is set by the game controller. */
export function sprite(cls = '') {
  return `<img class="sprite is-hidden ${cls}" data-role="sprite" alt="Mystery Pokémon" draggable="false" decoding="async">`;
}

/** Reveal banner + Next button shown over the stage once the round ends. */
export function revealPanel() {
  return `<div class="reveal" data-role="reveal" hidden>
    <div class="reveal-kicker" data-role="reveal-kicker">It's</div>
    <div class="reveal-name" data-role="reveal-name"></div>
    <div class="reveal-types" data-role="reveal-types"></div>
    <button class="reveal-next" data-role="next" type="button">Next ${ICON.play}</button>
  </div>`;
}

export function feedback() {
  return '<div class="feedback" data-role="feedback" role="status" aria-live="assertive"></div>';
}

export function soundButton(cls = '') {
  return `<button class="icon-btn sound-btn ${cls}" data-role="sound-toggle" type="button" aria-label="Sound on" aria-pressed="true">
    <span class="when-on">${ICON.sound}</span><span class="when-off">${ICON.mute}</span></button>`;
}

export function quitButton(cls = '', label = '') {
  return `<button class="icon-btn quit-btn ${cls}" data-role="quit" type="button" aria-label="End this run">${ICON.exit}${label ? `<span>${esc(label)}</span>` : ''}</button>`;
}

export function photo(cls = '') {
  return `<img class="photo ${cls}" data-role="photo" src="${PHOTO}" alt="Daniele" draggable="false">`;
}

export function nickname({ label = 'Trainer name', placeholder = 'Marco', cls = '' } = {}) {
  return `<div class="nick ${cls}">
    <label class="nick-label" for="nick-input">${esc(label)}</label>
    <input id="nick-input" class="nick-input" data-role="nickname" type="text" maxlength="16"
      autocomplete="nickname" autocapitalize="words" spellcheck="false" enterkeyhint="go" placeholder="${esc(placeholder)}">
    <div class="nick-error" data-role="nickname-error" role="alert"></div>
  </div>`;
}
