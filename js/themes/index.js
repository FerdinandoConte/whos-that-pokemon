import arena from './arena.js';
import burst from './burst.js';
import comic from './comic.js';
import forest from './forest.js';
import arcade from './arcade.js';

// Order shown in the theme picker; the first one is the default.
export const THEMES = [arena, burst, comic, forest, arcade];
export const DEFAULT_THEME = 'arena';
export const themeById = (id) => THEMES.find((t) => t.id === id) || THEMES.find((t) => t.id === DEFAULT_THEME);

// Roles every theme must provide so that gameplay is identical everywhere.
export const REQUIRED_ROLES = {
  home: ['theme-open', 'nickname', 'nickname-error', 'play', 'hof-open', 'best', 'photo', 'dedication'],
  game: ['lives', 'score', 'hints-left', 'round', 'stage', 'sprite', 'clues', 'clue-gen', 'clue-types', 'slots',
    'guess-form', 'guess-input', 'guess-submit', 'hint', 'reveal', 'reveal-name', 'reveal-types', 'reveal-kicker',
    'next', 'feedback', 'sound-toggle', 'quit'],
};
