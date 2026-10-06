// App controller: screens, sheets, and wiring between the rules (game.js),
// the theme templates and sound. Every theme exposes the same data-role hooks.
import { createGame, START_LIVES } from './game.js';
import { nameSlots, normalizeName } from './names.js';
import { createLeaderboard, sanitizeName } from './leaderboard.js';
import { FIREBASE, ARTWORK_SOURCES, SITE_URL } from './config.js';
import { THEMES, DEFAULT_THEME, themeById } from './themes/index.js';
import { ICON, TYPE_COLORS, TYPE_INK, ROMAN, GEN_REGION, esc } from './themes/parts.js';
import { prefs, storage } from './storage.js';
import { createAudio } from './audio.js';
import { createConfetti } from './confetti.js';
import { watchViewport } from './viewport.js';

const params = new URLSearchParams(location.search);
const TEST_MODE = params.has('test');
const REVEAL = { pulse: 420, flash: 520, name: 640, next: 900 };
// test-only hooks: fixed Pokémon order and a fake online project
const TEST_ORDER = TEST_MODE && params.get('order') ? params.get('order').split(',').map(Number) : null;
const BOARD_CONFIG = TEST_MODE && params.get('fb') ? { projectId: params.get('fb'), apiKey: 'test-key' } : FIREBASE;

const app = document.getElementById('app');
const sheetRoot = document.getElementById('sheets');
const audio = createAudio();
const confetti = createConfetti(document.getElementById('confetti'));
const board = createLeaderboard(BOARD_CONFIG, storage);

const state = {
  dex: [],
  allNames: new Set(),
  theme: themeById(prefs.theme || DEFAULT_THEME).id,
  screen: 'home',
  game: null,
  busy: false,
  timers: [],
  ended: false,
};

const $ = (role, root = app) => root.querySelector(`[data-role="${role}"]`);
const $$ = (role, root = app) => Array.from(root.querySelectorAll(`[data-role="${role}"]`));
const wait = (ms) => new Promise((r) => { const t = setTimeout(r, ms); state.timers.push(t); });
const clearTimers = () => { state.timers.forEach(clearTimeout); state.timers = []; };

// ---------------------------------------------------------------- theme ----
function applyTheme(id) {
  state.theme = themeById(id).id;
  document.documentElement.dataset.theme = state.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim() || '#140C34';
}

// ---------------------------------------------------------------- home -----
function renderHome() {
  clearTimers();
  state.screen = 'home';
  state.game = null;
  app.innerHTML = themeById(state.theme).home();
  app.dataset.screen = 'home';
  $$('best').forEach((el) => { el.textContent = String(prefs.best); });
  const nick = $('nickname');
  nick.value = prefs.nickname;
  nick.addEventListener('input', () => { $('nickname-error').textContent = ''; nick.removeAttribute('aria-invalid'); });
  nick.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); startGame(); } });
  $('play').addEventListener('click', startGame);
  $('hof-open').addEventListener('click', () => { audio.sfx('click'); openHallOfFame(); });
  $('theme-open').addEventListener('click', () => { audio.sfx('click'); openThemePicker(); });
  fillTopScore();
}

async function fillTopScore() {
  const slot = $('top-score');
  if (!slot) return;
  const r = await board.top(1);
  if (r.ok && r.entries.length && slot.isConnected) {
    const e = r.entries[0];
    slot.textContent = `TOP SCORE: ${e.name.toUpperCase()} ${e.score}`;
  }
}

// ---------------------------------------------------------------- game -----
function startGame() {
  const nickEl = $('nickname');
  const nick = sanitizeName(nickEl ? nickEl.value : prefs.nickname);
  if (!nick) {
    const err = $('nickname-error');
    if (err) err.textContent = 'Enter your name to play';
    if (nickEl) { nickEl.setAttribute('aria-invalid', 'true'); nickEl.focus(); }
    audio.sfx('empty');
    return;
  }
  prefs.nickname = nick;
  audio.unlock();
  audio.setMuted(!prefs.sound);
  audio.sfx('click');
  audio.startMusic();
  state.game = createGame(state.dex, TEST_ORDER ? { order: TEST_ORDER } : {});
  state.ended = false;
  state.busy = false;
  renderGame();
  newRound();
}

function renderGame() {
  clearTimers();
  state.screen = 'game';
  app.innerHTML = themeById(state.theme).game();
  app.dataset.screen = 'game';
  $('guess-form').addEventListener('submit', onGuess);
  $('hint').addEventListener('click', onHint);
  $('next').addEventListener('click', onNext);
  $('quit').addEventListener('click', confirmQuit);
  const sound = $('sound-toggle');
  syncSoundButton(sound);
  sound.addEventListener('click', () => {
    prefs.sound = !prefs.sound;
    audio.setMuted(!prefs.sound);
    syncSoundButton(sound);
  });
  $('guess-input').addEventListener('input', () => setFeedback(''));
}

function syncSoundButton(btn) {
  const on = prefs.sound;
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
  btn.classList.toggle('is-off', !on);
}

function updateHud() {
  const s = state.game.snapshot();
  $$('score').forEach((el) => { el.textContent = String(s.score); });
  $$('round').forEach((el) => { el.textContent = String(s.round); });
  $$('hints-left').forEach((el) => { el.textContent = String(s.hintsLeft); });
  const lives = $('lives');
  lives.querySelectorAll('[data-life]').forEach((el) => {
    el.classList.toggle('is-lost', Number(el.dataset.life) >= s.lives);
  });
  lives.setAttribute('aria-label', `${s.lives} ${s.lives === 1 ? 'life' : 'lives'} left`);
  const hint = $('hint');
  hint.classList.toggle('is-empty', s.hintsLeft === 0);
  hint.setAttribute('aria-disabled', String(s.hintsLeft === 0 || s.status !== 'playing'));
}

function renderSlots(reveal = 'some') {
  const s = state.game.snapshot();
  const shown = new Set(s.revealed);
  const container = $('slots');
  container.innerHTML = nameSlots(s.pokemon.name).map((slot, i) => {
    if (!slot.guessable) return `<span class="slot is-fixed" aria-hidden="true">${slot.ch === ' ' ? '&nbsp;' : esc(slot.ch)}</span>`;
    const open = reveal === 'all' || shown.has(i);
    return `<span class="slot${open ? ' is-open' : ''}" data-slot="${i}">${open ? esc(slot.ch.toUpperCase()) : ''}</span>`;
  }).join('');
  const letters = nameSlots(s.pokemon.name).filter((x) => x.guessable).length;
  container.setAttribute('aria-label', `${letters} letters`);
  container.classList.toggle('is-long', letters > 9);
}

function renderClues(p) {
  const box = $('clues');
  $('clue-gen').innerHTML = `<span class="chip chip-gen">GEN ${ROMAN[p.gen]}<span class="chip-region">&nbsp;·&nbsp;${GEN_REGION[p.gen]}</span></span>`;
  $('clue-types').innerHTML = p.types.map(typeChip).join('');
  box.hidden = false;
}

function typeChip(t) {
  return `<span class="chip chip-type" data-type="${t}" style="--tc:${TYPE_COLORS[t]};--ti:${TYPE_INK[t]}">${t.toUpperCase()}</span>`;
}

function artworkUrl(id, i = 0) { return ARTWORK_SOURCES[i](id); }

function loadSprite(p) {
  const img = $('sprite');
  const stage = $('stage');
  img.classList.add('is-hidden', 'is-loading');
  img.classList.remove('is-revealed', 'is-missing');
  img.alt = 'Mystery Pokémon';
  stage.classList.remove('is-missing');
  let source = 0;
  img.onload = () => { img.classList.remove('is-loading'); };
  img.onerror = () => {
    source += 1;
    if (source < ARTWORK_SOURCES.length) img.src = artworkUrl(p.id, source);
    else { img.classList.remove('is-loading'); img.classList.add('is-missing'); stage.classList.add('is-missing'); }
  };
  img.src = artworkUrl(p.id, 0);
}

function preloadUpcoming() {
  const next = state.game.upcoming(2);
  for (const p of next) { const im = new Image(); im.decoding = 'async'; im.src = artworkUrl(p.id, 0); }
  audio.preload([state.game.current(), ...next]);
}

function newRound() {
  const s = state.game.snapshot();
  state.busy = false;
  const stage = $('stage');
  stage.classList.remove('is-revealing', 'is-revealed', 'is-flash', 'is-lost');
  $('reveal').hidden = true;
  $('clues').hidden = true;
  $('clue-gen').innerHTML = '';
  $('clue-types').innerHTML = '';
  loadSprite(s.pokemon);
  renderSlots();
  updateHud();
  const input = $('guess-input');
  input.value = '';
  input.disabled = false;
  $('guess-submit').disabled = false;
  setFeedback('');
  input.focus({ preventScroll: true });
  preloadUpcoming();
  if (TEST_MODE) window.__wtp.round = s;
}

let feedbackTimer = 0;
function setFeedback(text, tone = '', ms = 1800) {
  const fb = $('feedback');
  if (!fb) return;
  clearTimeout(feedbackTimer);
  fb.textContent = text;
  fb.dataset.tone = tone;
  fb.classList.toggle('is-visible', Boolean(text));
  // messages fade on their own so they never cover the silhouette for long
  if (text && ms) feedbackTimer = setTimeout(() => fb.classList.remove('is-visible'), ms);
}

function shake(el) {
  el.classList.remove('is-shaking');
  void el.offsetWidth; // restart the animation
  el.classList.add('is-shaking');
}

function onGuess(e) {
  e.preventDefault();
  if (state.busy || !state.game) return;
  const input = $('guess-input');
  const text = input.value;
  const p = state.game.current();
  const r = state.game.guess(text);
  if (r.type === 'empty') {
    audio.sfx('empty');
    setFeedback('Type a name first', 'info');
    shake($('guess-form'));
    return;
  }
  if (r.type === 'ignored') return;
  if (r.type === 'correct') {
    state.busy = true;
    input.blur();
    if (!p.cry) audio.playFallback(p); // must start inside the tap on iPhone
    reveal(p, 'correct');
    return;
  }
  // wrong
  audio.sfx('wrong');
  const lost = $('lives').querySelector(`[data-life="${r.livesLeft}"]`);
  if (lost) { lost.classList.add('is-popping'); setTimeout(() => lost.classList.remove('is-popping'), 600); }
  updateHud();
  shake($('guess-form'));
  if (r.gameOver) {
    state.busy = true;
    input.blur();
    if (!p.cry) audio.playFallback(p);
    reveal(p, 'lost');
    return;
  }
  const exists = state.allNames.has(normalizeName(text));
  setFeedback(exists ? 'Not quite! −1 life' : 'No Pokémon has that name! −1 life', 'bad');
  input.select();
}

async function reveal(p, mode) {
  const stage = $('stage');
  const img = $('sprite');
  const input = $('guess-input');
  input.disabled = true;
  $('guess-submit').disabled = true;
  updateHud();
  if (mode === 'correct') { audio.sfx('correct'); setFeedback(''); }
  stage.classList.add('is-revealing');
  await wait(REVEAL.pulse);
  if (!stage.isConnected) return;
  stage.classList.add('is-flash');
  audio.sfx('reveal');
  await wait(REVEAL.flash - REVEAL.pulse);
  img.classList.remove('is-hidden');
  img.classList.add('is-revealed');
  img.alt = p.name;
  renderSlots('all');
  await wait(REVEAL.name - REVEAL.flash);
  if (!stage.isConnected) return;
  stage.classList.add('is-revealed');
  if (mode === 'lost') stage.classList.add('is-lost');
  $('reveal-kicker').textContent = mode === 'correct' ? "It's" : 'It was';
  $('reveal-name').textContent = p.name;
  $('reveal-types').innerHTML = p.types.map(typeChip).join('');
  const nextBtn = $('next');
  nextBtn.hidden = mode !== 'correct';
  $('reveal').hidden = false;
  if (p.cry) audio.playCry(p);
  if (mode === 'correct') {
    const rect = stage.getBoundingClientRect();
    const colors = [...p.types.map((t) => TYPE_COLORS[t]), '#ffffff', '#FFD23F'];
    confetti.burst({ x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.55, colors });
    await wait(REVEAL.next - REVEAL.name);
    if (nextBtn.isConnected) nextBtn.focus({ preventScroll: true });
    if (TEST_MODE) window.__wtp.revealDone = (window.__wtp.revealDone || 0) + 1;
  } else {
    setFeedback('Out of lives!', 'bad');
    audio.sfx('gameover');
    await wait(1700);
    if (stage.isConnected) finish('lost');
  }
}

function onHint() {
  if (!state.game || state.busy) return;
  const r = state.game.useHint();
  if (!r.ok) {
    audio.sfx('empty');
    const msg = { 'no-hints': 'No hints left in this run', 'no-letters': 'Only one letter left: you can do it!', 'not-playing': '' }[r.reason];
    if (msg) setFeedback(msg, 'info');
    return;
  }
  audio.sfx('hint');
  renderClues(state.game.current());
  renderSlots();
  const slot = $('slots').querySelector(`[data-slot="${r.index}"]`);
  if (slot) slot.classList.add('is-popping');
  updateHud();
  setFeedback(`Hint used · ${r.hintsLeft} left`, 'info');
  $('guess-input').focus({ preventScroll: true });
}

function onNext() {
  if (!state.game) return;
  audio.sfx('click');
  const r = state.game.next();
  if (r.type === 'won') { finish('won'); return; }
  if (r.type === 'next') newRound();
}

function confirmQuit() {
  audio.sfx('click');
  openSheet(`<h2 class="sheet-title">End this run?</h2>
    <p class="sheet-text">Your score of <b>${state.game.snapshot().score}</b> will be saved to the Hall of Fame.</p>
    <div class="sheet-actions">
      <button class="sheet-btn sheet-btn--primary" data-act="end" type="button">End run</button>
      <button class="sheet-btn" data-act="keep" type="button">Keep playing</button>
    </div>`, {
    label: 'End this run',
    onAction: (act, close) => { close(); if (act === 'end') finish('quit'); },
  });
}

// ------------------------------------------------------------- game over ---
async function finish(reason) {
  if (state.ended || !state.game) return;
  state.ended = true;
  clearTimers();
  const s = state.game.snapshot();
  const prevBest = prefs.best;
  const isBest = s.score > prevBest;
  if (isBest) prefs.best = s.score;
  if (reason === 'won') { audio.sfx('win'); confetti.burst({ x: innerWidth / 2, y: innerHeight * 0.4, colors: Object.values(TYPE_COLORS), count: 260 }); }
  const title = { lost: 'Game over', won: 'You caught them all!', quit: 'Run ended' }[reason];
  const shown = s.pokemon;
  const html = `<div class="go-head">
      <h2 class="sheet-title go-title">${title}</h2>
      ${reason === 'lost' ? `<p class="go-was">It was <b>${esc(shown.name)}</b></p>` : ''}
    </div>
    <div class="go-score"><span class="go-score-num" data-role="go-score">${s.score}</span><span class="go-score-label">Pokémon guessed</span></div>
    <div class="go-meta">
      <span>${isBest ? '<b class="go-new">New personal best!</b>' : `Your best: <b>${Math.max(prevBest, s.score)}</b>`}</span>
      <span>Hints used: <b>${s.hintsUsed}</b>/3</span>
    </div>
    <p class="go-save" data-role="go-save">Saving to the Hall of Fame…</p>
    <div class="sheet-actions sheet-actions--grid">
      <button class="sheet-btn sheet-btn--primary" data-act="again" type="button">${ICON.again}<span>Play again</span></button>
      <button class="sheet-btn" data-act="share" type="button">${ICON.share}<span>Share</span></button>
      <button class="sheet-btn" data-act="hof" type="button">${ICON.trophy}<span>Hall of Fame</span></button>
      <button class="sheet-btn" data-act="home" type="button">${ICON.home}<span>Home</span></button>
    </div>`;
  const sheet = openSheet(html, {
    label: title,
    dismissable: false,
    cls: `sheet--gameover sheet--${reason}`,
    onAction: async (act, close) => {
      audio.sfx('click');
      if (act === 'again') { close(); state.game = null; startGame(); }
      if (act === 'home') { close(); audio.stopMusic(); renderHome(); }
      if (act === 'hof') openHallOfFame();
      if (act === 'share') share(s.score);
    },
  });
  const saveEl = sheet.querySelector('[data-role="go-save"]');
  const res = await board.submit({ name: prefs.nickname, score: s.score, hints: s.hintsUsed, theme: state.theme });
  if (!saveEl.isConnected) return;
  if (res.ok) saveEl.textContent = board.kind === 'online' ? 'Saved to the Hall of Fame' : 'Saved on this phone';
  else saveEl.textContent = 'Saved on this phone (online Hall of Fame unreachable)';
  saveEl.dataset.ok = String(res.ok);
  if (TEST_MODE) window.__wtp.lastSubmit = res;
}

async function share(score) {
  const url = SITE_URL || location.href.split('?')[0].split('#')[0];
  const text = `I guessed ${score} Pokémon in a row in Who's That Pokémon? Can you beat me?`;
  try {
    if (navigator.share) { await navigator.share({ title: "Who's That Pokémon?", text, url }); return; }
  } catch (err) { if (err && err.name === 'AbortError') return; }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast('Copied! Paste it in your chat');
  } catch {
    toast(`${text} ${url}`);
  }
}

function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('is-in'), 10);
  setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 300); }, 2600);
}

// ---------------------------------------------------------------- sheets ---
function openSheet(inner, { label = '', dismissable = true, cls = '', onAction = null, onClose = null } = {}) {
  const prevFocus = document.activeElement;
  const wrap = document.createElement('div');
  wrap.className = 'sheet-backdrop';
  wrap.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(label)}" tabindex="-1">
    <div class="sheet-grip" aria-hidden="true"></div>
    ${dismissable ? `<button class="sheet-close" type="button" data-act="close" aria-label="Close">${ICON.close}</button>` : ''}
    ${inner}</div>`;
  sheetRoot.appendChild(wrap);
  app.setAttribute('aria-hidden', 'true');
  const sheet = wrap.querySelector('.sheet');
  requestAnimationFrame(() => wrap.classList.add('is-open'));
  function close() {
    if (wrap.dataset.closing) return;
    wrap.dataset.closing = '1';
    wrap.classList.remove('is-open');
    setTimeout(() => wrap.remove(), 220);
    if (!sheetRoot.querySelector('.sheet-backdrop:not([data-closing])')) app.removeAttribute('aria-hidden');
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
    if (prevFocus && prevFocus.isConnected && prevFocus.tagName !== 'INPUT') prevFocus.focus({ preventScroll: true });
  }
  function onKey(e) { if (e.key === 'Escape' && dismissable && sheetRoot.lastElementChild === wrap) close(); }
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap && dismissable) { close(); return; }
    const btn = e.target.closest('[data-act]');
    if (!btn || !wrap.contains(btn)) return;
    if (btn.dataset.act === 'close') { close(); return; }
    if (onAction) onAction(btn.dataset.act, close, btn);
  });
  setTimeout(() => sheet.focus({ preventScroll: true }), 30);
  return sheet;
}

function themePreview(id) {
  return `<span class="tp-preview tp-preview--${id}" aria-hidden="true"><i></i><i></i><i></i></span>`;
}

function openThemePicker() {
  const items = () => THEMES.map((t) => `<button class="tp-item${t.id === state.theme ? ' is-current' : ''}" type="button"
      data-act="pick" data-theme-id="${t.id}" aria-pressed="${t.id === state.theme}">
      ${themePreview(t.id)}
      <span class="tp-text"><span class="tp-name tp-name--${t.id}">${esc(t.label)}${t.id === DEFAULT_THEME ? '<span class="tp-default">DEFAULT</span>' : ''}</span>
      <span class="tp-tag">${esc(t.tagline)}</span></span>
      <span class="tp-check" aria-hidden="true">${ICON.check}</span></button>`).join('');
  const sheet = openSheet(`<h2 class="sheet-title">Choose your theme</h2>
    <div class="tp-list" data-role="tp-list">${items()}</div>
    <p class="sheet-note">Your choice is saved on this phone. Gameplay never changes.</p>`, {
    label: 'Choose your theme',
    cls: 'sheet--themes',
    onAction: (act, close, btn) => {
      if (act !== 'pick') return;
      audio.sfx('click');
      applyTheme(btn.dataset.themeId);
      prefs.theme = state.theme;
      renderHome();
      sheet.querySelector('[data-role="tp-list"]').innerHTML = items();
    },
  });
}

async function openHallOfFame() {
  const sheet = openSheet(`<h2 class="sheet-title">${ICON.trophy} Hall of Fame</h2>
    <p class="sheet-note" data-role="hof-status">Loading…</p>
    <ol class="hof-list" data-role="hof-list"></ol>`, { label: 'Hall of Fame', cls: 'sheet--hof' });
  const r = await board.top(20);
  if (!sheet.isConnected) return;
  const status = sheet.querySelector('[data-role="hof-status"]');
  const list = sheet.querySelector('[data-role="hof-list"]');
  const entries = r.entries || [];
  if (!entries.length) {
    status.textContent = 'No scores yet: be the first!';
  } else if (board.kind === 'online' && !r.offline) {
    status.textContent = 'Top 20 trainers';
  } else {
    status.textContent = r.offline ? 'Offline: showing scores from this phone' : 'Scores played on this phone';
  }
  const me = prefs.nickname.toLowerCase();
  list.innerHTML = entries.map((e, i) => `<li class="hof-row${e.name.toLowerCase() === me ? ' is-me' : ''}">
      <span class="hof-rank">${i + 1}</span><span class="hof-name">${esc(e.name)}</span>
      <span class="hof-hints" title="Hints used">${e.hints ? `${ICON.bulb}${e.hints}` : ''}</span>
      <span class="hof-score">${e.score}</span></li>`).join('');
}

// ---------------------------------------------------------------- boot -----
async function boot() {
  applyTheme(state.theme);
  watchViewport();
  try {
    const r = await fetch('data/pokemon.json');
    state.dex = await r.json();
  } catch {
    app.innerHTML = '<p class="fatal">Could not load the game. Check your connection and reload.</p>';
    return;
  }
  state.allNames = new Set(state.dex.map((p) => normalizeName(p.name)));
  ['nidoran'].forEach((n) => state.allNames.add(n));
  renderHome();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) audio.suspend(); else audio.resume();
  });
  if (TEST_MODE) {
    window.__wtp = { state, audio, board, prefs, START_LIVES, finish, confetti, ready: true };
  }
  if (params.has('debug')) {
    import('./debug.js').then((m) => m.mountDebug({ state, audio, board })).catch(() => {});
  }
}

boot();
