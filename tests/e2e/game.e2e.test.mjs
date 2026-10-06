// End-to-end tests in a real (headless Chromium) browser with phone
// emulation. Every gameplay test runs once per theme, because each theme has
// its own layout but must behave identically.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium, startServer, installRoutes, newPhone } from './harness.mjs';

const dex = JSON.parse(readFileSync(new URL('../../data/pokemon.json', import.meta.url), 'utf8'));
const byId = (id) => dex[id - 1];
const THEMES = ['arena', 'burst', 'comic', 'forest', 'arcade'];
const REQUIRED = {
  home: ['theme-open', 'nickname', 'play', 'hof-open', 'best', 'photo', 'dedication'],
  game: ['lives', 'score', 'hints-left', 'round', 'stage', 'sprite', 'slots', 'guess-form', 'guess-input',
    'guess-submit', 'hint', 'sound-toggle', 'quit'],
};
const DEDICATION = "Daniele ha una passione sfegatata per i Pokémon, noi l'abbiamo trasformata in un gioco!";

let server; let base; let browser;
before(async () => { ({ server, url: base } = await startServer()); browser = await chromium.launch(); });
after(async () => { await browser.close(); server.close(); });

/** Opens the game on a phone. Collects page errors so every test can assert none happened. */
async function open({ theme = 'arena', order = null, fb = null, nickname = 'Marco', best = null, artwork = 'ok',
  device = 'iPhone 13', viewport = null, firestore = null, clearStorage = false, missingCries = [] } = {}) {
  const storage = clearStorage ? {} : { 'wtp.theme': theme, 'wtp.sound': 'off' };
  if (!clearStorage && nickname !== null) storage['wtp.nickname'] = nickname;
  if (best !== null) storage['wtp.best'] = String(best);
  const ctx = await newPhone(browser, { device, storage, ...(viewport ? { viewport } : {}) });
  const routes = await installRoutes(ctx, { artwork, firestore, missingCries });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  const q = new URLSearchParams({ test: '1' });
  if (order) q.set('order', order.join(','));
  if (fb) q.set('fb', fb);
  await page.goto(`${base}?${q}`);
  await page.waitForFunction(() => window.__wtp && window.__wtp.ready);
  return { ctx, page, errors, routes };
}

const role = (r) => `[data-role="${r}"]`;
async function startRun(page) {
  await page.click(role('play'));
  await page.waitForSelector(`${role('guess-input')}:not([disabled])`);
  await page.waitForFunction(() => {
    const img = document.querySelector('[data-role="sprite"]');
    return img && !img.classList.contains('is-loading');
  });
}
async function guess(page, text) {
  await page.fill(role('guess-input'), text);
  await page.click(role('guess-submit'));
}
const current = (page) => page.evaluate(() => window.__wtp.state.game.current());
const snap = (page) => page.evaluate(() => window.__wtp.state.game.snapshot());
async function waitReveal(page) { await page.waitForSelector(`${role('reveal')}:not([hidden])`); }

for (const theme of THEMES) {
  describe(`theme: ${theme}`, () => {
    test('home: every element is there, photo and dedication shown, no errors', async () => {
      const { ctx, page, errors } = await open({ theme, best: 12 });
      assert.equal(await page.getAttribute('html', 'data-theme'), theme);
      for (const r of REQUIRED.home) assert.ok(await page.$(role(r)), `missing ${r}`);
      assert.equal((await page.textContent(role('dedication'))).trim(), DEDICATION);
      assert.equal(await page.getAttribute(role('dedication'), 'lang'), 'it');
      const photoOk = await page.$eval(role('photo'), (img) => img.complete && img.naturalWidth > 100);
      assert.ok(photoOk, 'photo of Daniele loaded');
      assert.match(await page.textContent('h1'), /Who's that\s*Pokémon\?/);
      const bests = await page.$$eval(role('best'), (els) => els.map((e) => e.textContent));
      assert.ok(bests.length >= 1 && bests.every((b) => b === '12'), `best shown: ${bests}`);
      assert.equal(await page.inputValue(role('nickname')), 'Marco', 'nickname remembered');
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    test('home: the theme button is visible without scrolling, play reachable', async () => {
      const { ctx, page } = await open({ theme });
      const box = await page.locator(role('theme-open')).boundingBox();
      const vp = page.viewportSize();
      assert.ok(box && box.y >= 0 && box.y + box.height <= vp.height, `theme button on screen: ${JSON.stringify(box)}`);
      assert.ok(box.width >= 44 && box.height >= 44, 'theme button big enough to tap');
      await page.locator(role('play')).scrollIntoViewIfNeeded();
      assert.ok(await page.locator(role('play')).isVisible());
      await ctx.close();
    });

    test('home: name is required, then remembered', async () => {
      const { ctx, page, errors } = await open({ theme, nickname: '' });
      await page.click(role('play'));
      assert.match(await page.textContent(role('nickname-error')), /Enter your name/);
      assert.equal(await page.$(role('guess-input')), null, 'game did not start');
      await page.fill(role('nickname'), '  Ash   Ketchum  ');
      await startRun(page);
      assert.equal(await page.evaluate(() => localStorage.getItem('wtp.nickname')), 'Ash Ketchum');
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    test('game: layout has every control, nothing overflows, targets are tappable', async () => {
      const { ctx, page, errors } = await open({ theme, order: [25, 1, 4] });
      await startRun(page);
      for (const r of REQUIRED.game) assert.ok(await page.$(role(r)), `missing ${r}`);
      const overflow = await page.evaluate(() => {
        const app = document.getElementById('app').getBoundingClientRect();
        const bad = [];
        document.querySelectorAll('#app [data-role], #app button, #app input').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width === 0) return;
          if (r.left < app.left - 1 || r.right > app.right + 1 || r.bottom > app.bottom + 1 || r.top < app.top - 1) {
            bad.push(`${el.dataset.role || el.className} ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}`);
          }
        });
        return bad;
      });
      assert.deepEqual(overflow, [], 'controls inside the screen');
      for (const r of ['guess-submit', 'hint', 'quit', 'sound-toggle']) {
        const b = await page.locator(role(r)).boundingBox();
        assert.ok(b.width >= 40 && b.height >= 36, `${r} tappable: ${b.width}x${b.height}`);
      }
      const inputFont = await page.$eval(role('guess-input'), (el) => parseFloat(getComputedStyle(el).fontSize));
      assert.ok(inputFont >= 16, 'text box font ≥16px so iPhone does not zoom');
      const stage = await page.locator(role('stage')).boundingBox();
      assert.ok(stage.height >= 200, `silhouette area tall enough: ${stage.height}`);
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    test('game: silhouette is black and does not leak the name', async () => {
      const { ctx, page } = await open({ theme, order: [25] });
      await startRun(page);
      const info = await page.$eval(role('sprite'), (img) => ({
        hidden: img.classList.contains('is-hidden'), filter: getComputedStyle(img).filter, alt: img.alt,
        src: img.src, events: getComputedStyle(img).pointerEvents,
      }));
      assert.equal(info.hidden, true);
      assert.match(info.filter, /brightness\(0\)/);
      assert.equal(info.alt, 'Mystery Pokémon');
      assert.ok(!/pikachu/i.test(info.src), 'image URL uses the number, not the name');
      assert.equal(info.events, 'none', 'no long-press save of the image');
      const slots = await page.$$eval(`${role('slots')} .slot`, (els) => els.map((e) => e.textContent));
      assert.deepEqual(slots, ['', '', '', '', '', '', ''], 'name length shown, letters hidden');
      await ctx.close();
    });

    test('game: wrong guesses cost a life with the right message; empty guess is free', async () => {
      const { ctx, page, errors } = await open({ theme, order: [25] });
      await startRun(page);
      await page.click(role('guess-submit'));
      assert.equal((await snap(page)).lives, 3, 'empty guess free');
      await guess(page, 'Raichu');
      await page.waitForTimeout(80);
      assert.equal((await snap(page)).lives, 2);
      assert.match(await page.textContent(role('feedback')), /Not quite/);
      assert.equal(await page.getAttribute(role('lives'), 'aria-label'), '2 lives left');
      assert.equal(await page.$$eval(`${role('lives')} .life.is-lost`, (e) => e.length), 1);
      await guess(page, 'Pikachoo');
      await page.waitForTimeout(80);
      assert.match(await page.textContent(role('feedback')), /No Pokémon has that name/);
      assert.equal((await snap(page)).lives, 1);
      assert.equal(await page.isEnabled(role('guess-input')), true, 'can keep guessing');
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    test('game: a hint shows generation, types and one letter; counters update', async () => {
      const { ctx, page, errors } = await open({ theme, order: [6] }); // Charizard: Fire/Flying, Gen I
      await startRun(page);
      await page.click(role('hint'));
      await page.waitForSelector(`${role('clues')}:not([hidden])`);
      assert.match(await page.textContent(role('clue-gen')), /GEN I\b.*Kanto/);
      const types = await page.$$eval(`${role('clue-types')} .chip`, (els) => els.map((e) => e.textContent));
      assert.deepEqual(types, ['FIRE', 'FLYING']);
      const open1 = await page.$$eval(`${role('slots')} .slot.is-open`, (els) => els.map((e) => [Number(e.dataset.slot), e.textContent]));
      assert.equal(open1.length, 1);
      assert.equal(open1[0][1], 'CHARIZARD'[open1[0][0]]);
      const counts = await page.$$eval(role('hints-left'), (els) => els.map((e) => e.textContent));
      assert.ok(counts.every((c) => c === '2'), `hints left: ${counts}`);
      await page.click(role('hint'));
      await page.click(role('hint'));
      assert.equal(await page.$$eval(`${role('slots')} .slot.is-open`, (e) => e.length), 3);
      // still tappable (aria-disabled only), and it explains why nothing happens
      await page.click(role('hint'), { force: true });
      assert.match(await page.textContent(role('feedback')), /No hints left/);
      assert.equal(await page.getAttribute(role('hint'), 'aria-disabled'), 'true');
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    test('game: correct guess reveals, plays Daniele’s cry, throws confetti, then Next', async () => {
      // Bulbasaur's recording is made to fail loading, to check the official-cry fallback
      const { ctx, page, errors } = await open({ theme, order: [100, 1], missingCries: [1] });
      await startRun(page);
      await page.evaluate(() => {
        window.__cries = [];
        const a = window.__wtp.audio;
        const pc = a.playCry; const pf = a.playFallback;
        a.playCry = (p) => { window.__cries.push(['daniele', p.id]); return pc(p); };
        a.playFallback = (p) => { window.__cries.push(['fallback', p.id]); return pf(p); };
      });
      await guess(page, '  vOLTORB ');
      await page.waitForTimeout(250);
      assert.equal(await page.$eval(role('sprite'), (i) => i.classList.contains('is-revealed')), false, 'pulse first, no instant reveal');
      await waitReveal(page);
      assert.equal(await page.textContent(role('reveal-name')), 'Voltorb');
      assert.equal(await page.$eval(role('sprite'), (i) => i.classList.contains('is-revealed') && i.alt), 'Voltorb');
      assert.ok(await page.evaluate(() => window.__wtp.confetti.active() > 0), 'confetti flying');
      assert.equal((await snap(page)).score, 1);
      const scores = await page.$$eval(role('score'), (els) => els.map((e) => e.textContent));
      assert.ok(scores.every((s) => s === '1'));
      const slots = await page.$$eval(`${role('slots')} .slot`, (els) => els.map((e) => e.textContent).join(''));
      assert.equal(slots, 'VOLTORB');
      await page.waitForFunction(() => window.__cries.length > 0);
      assert.deepEqual(await page.evaluate(() => window.__cries), [['daniele', 100]]);
      await page.waitForFunction(() => window.__wtp.revealDone >= 1);
      const t0 = Date.now();
      await page.click(role('next'));
      await page.waitForFunction(() => window.__wtp.state.game.current().id === 1);
      assert.ok(Date.now() - t0 < 1500);
      assert.equal(await page.isHidden(role('reveal')), true);
      assert.equal(await page.inputValue(role('guess-input')), '');
      assert.equal(await page.$eval(role('sprite'), (i) => i.classList.contains('is-hidden')), true);
      await guess(page, 'Bulbasaur');
      await waitReveal(page);
      await page.waitForFunction(() => window.__cries.length >= 3);
      assert.deepEqual((await page.evaluate(() => window.__cries)).slice(1), [['daniele', 1], ['fallback', 1]],
        'official cry when the recording cannot be loaded');
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    test('game: three wrong guesses end the run; score saved; play again resets', async () => {
      const { ctx, page, errors } = await open({ theme, order: [7, 25, 39], best: 0 });
      await startRun(page);
      await guess(page, 'Squirtle');
      await waitReveal(page);
      await page.waitForFunction(() => window.__wtp.revealDone >= 1);
      await page.click(role('next'));
      await page.waitForFunction(() => window.__wtp.state.game.current().id === 25);
      for (const g of ['Raichu', 'Pichu', 'Mew']) { await guess(page, g); await page.waitForTimeout(60); }
      await waitReveal(page);
      assert.match(await page.textContent(role('reveal-kicker')), /It was/);
      assert.equal(await page.textContent(role('reveal-name')), 'Pikachu');
      assert.equal(await page.isHidden(role('next')), true, 'no Next after game over');
      await page.waitForSelector('.sheet--gameover');
      assert.match(await page.textContent('.sheet--gameover'), /Game over/);
      assert.match(await page.textContent('.sheet--gameover'), /It was Pikachu/);
      assert.equal(await page.textContent('[data-role="go-score"]'), '1');
      await page.waitForFunction(() => document.querySelector('[data-role="go-save"]').dataset.ok === 'true');
      assert.match(await page.textContent('[data-role="go-save"]'), /Saved on this phone/);
      const stored = await page.evaluate(() => ({ best: localStorage.getItem('wtp.best'), board: JSON.parse(localStorage.getItem('wtp.localBoard.v1')) }));
      assert.equal(stored.best, '1');
      assert.deepEqual(stored.board.map((e) => [e.name, e.score, e.hints, e.theme]), [['Marco', 1, 0, theme]]);
      await page.click('[data-act="again"]');
      await page.waitForSelector('.sheet--gameover', { state: 'detached' });
      const s = await snap(page);
      assert.deepEqual([s.lives, s.hintsLeft, s.score, s.round, s.status], [3, 3, 0, 1, 'playing']);
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    test('game: quitting asks first, then ends the run', async () => {
      const { ctx, page, errors } = await open({ theme, order: [1, 4] });
      await startRun(page);
      await page.click(role('quit'));
      await page.waitForSelector('.sheet-backdrop.is-open');
      await page.click('[data-act="keep"]');
      await page.waitForSelector('.sheet-backdrop', { state: 'detached' });
      assert.equal((await snap(page)).status, 'playing');
      await page.click(role('quit'));
      await page.click('[data-act="end"]');
      await page.waitForSelector('.sheet--quit');
      assert.match(await page.textContent('.sheet--quit'), /Run ended/);
      await page.click('[data-act="home"]');
      await page.waitForSelector(role('play'));
      assert.deepEqual(errors, []);
      await ctx.close();
    });

    test('game: works with the keyboard open (small visible area)', async () => {
      const { ctx, page } = await open({ theme, order: [445] });
      await startRun(page);
      await page.setViewportSize({ width: 390, height: 420 });
      await page.evaluate(() => document.documentElement.classList.add('kb-open'));
      await page.focus(role('guess-input'));
      await page.waitForTimeout(150);
      for (const r of ['guess-input', 'guess-submit', 'stage', 'slots']) {
        const b = await page.locator(role(r)).boundingBox();
        assert.ok(b && b.y >= 0 && b.y + b.height <= 421, `${r} visible above the keyboard: ${JSON.stringify(b)}`);
      }
      const stage = await page.locator(role('stage')).boundingBox();
      assert.ok(stage.height >= 100, `silhouette still visible: ${stage.height}px`);
      await ctx.close();
    });
  });
}

describe('across themes', () => {
  test('theme picker: 5 themes, Night Arena default, choice saved and applied', async () => {
    const { ctx, page, errors } = await open({ clearStorage: true });
    assert.equal(await page.getAttribute('html', 'data-theme'), 'arena', 'default theme');
    await page.click(role('theme-open'));
    await page.waitForSelector('.tp-item');
    const items = await page.$$eval('.tp-item', (els) => els.map((e) => [e.dataset.themeId, e.getAttribute('aria-pressed')]));
    assert.deepEqual(items, [['arena', 'true'], ['burst', 'false'], ['comic', 'false'], ['forest', 'false'], ['arcade', 'false']]);
    assert.match(await page.textContent('.tp-item[data-theme-id="arena"]'), /DEFAULT/);
    for (const t of ['forest', 'arcade', 'comic', 'burst']) {
      await page.click(`.tp-item[data-theme-id="${t}"]`);
      assert.equal(await page.getAttribute('html', 'data-theme'), t);
      assert.equal(await page.getAttribute(`.tp-item[data-theme-id="${t}"]`, 'aria-pressed'), 'true');
      assert.ok(await page.$(`.${t}-home`), `home redrawn in ${t}`);
    }
    await page.keyboard.press('Escape');
    await page.waitForSelector('.sheet-backdrop', { state: 'detached' });
    await page.reload();
    await page.waitForFunction(() => window.__wtp && window.__wtp.ready);
    assert.equal(await page.getAttribute('html', 'data-theme'), 'burst', 'kept after reload');
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  test('theme picker is not reachable during a run', async () => {
    const { ctx, page } = await open({ order: [1] });
    await startRun(page);
    assert.equal(await page.$(role('theme-open')), null);
    await ctx.close();
  });

  test('unknown saved theme falls back to Night Arena', async () => {
    const { ctx, page, errors } = await open({ theme: 'doesnotexist' });
    assert.equal(await page.getAttribute('html', 'data-theme'), 'arena');
    assert.ok(await page.$('.arena-home'));
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  test('sound toggle: switches and is remembered', async () => {
    const { ctx, page } = await open({ order: [1] });
    await page.evaluate(() => localStorage.setItem('wtp.sound', 'on'));
    await startRun(page);
    assert.equal(await page.getAttribute(role('sound-toggle'), 'aria-pressed'), 'true');
    await page.click(role('sound-toggle'));
    assert.equal(await page.getAttribute(role('sound-toggle'), 'aria-pressed'), 'false');
    assert.equal(await page.evaluate(() => localStorage.getItem('wtp.sound')), 'off');
    assert.equal(await page.evaluate(() => window.__wtp.audio.isMuted()), true);
    await ctx.close();
  });

  test('music starts with the run and the audio engine is unlocked by the tap', async () => {
    const { ctx, page } = await open({ order: [1] });
    await startRun(page);
    assert.equal(await page.evaluate(() => window.__wtp.audio.musicPlaying()), true);
    assert.notEqual(await page.evaluate(() => window.__wtp.audio.state()), 'none');
    await ctx.close();
  });

  test('every Pokémon in a run is new: 12 rounds in a row', async () => {
    const order = [150, 151, 25, 122, 83, 250, 439, 474, 29, 32, 233, 493];
    const { ctx, page, errors } = await open({ theme: 'arena', order });
    await startRun(page);
    for (let i = 0; i < order.length; i += 1) {
      const p = await current(page);
      assert.equal(p.id, order[i]);
      const typed = { 29: 'nidoran f', 32: 'Nidoran M', 122: 'mr mime', 83: 'Farfetchd', 250: 'ho oh', 439: 'MIME JR', 474: 'porygon z', 233: 'Porygon 2' }[p.id] || p.name;
      await guess(page, typed);
      await waitReveal(page);
      await page.waitForFunction((n) => window.__wtp.revealDone >= n, i + 1);
      if (i < order.length - 1) {
        await page.click(role('next'));
        await page.waitForFunction((id) => window.__wtp.state.game.current().id === id, order[i + 1]);
      }
    }
    assert.equal((await snap(page)).score, 12);
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  test('guessing the last Pokémon wins the game', async () => {
    const { ctx, page } = await open({ order: [1, 4] });
    await startRun(page);
    await guess(page, 'Bulbasaur');
    await waitReveal(page);
    await page.waitForFunction(() => window.__wtp.revealDone >= 1);
    await page.click(role('next'));
    await guess(page, 'Charmander');
    await waitReveal(page);
    await page.waitForFunction(() => window.__wtp.revealDone >= 2);
    await page.click(role('next'));
    await page.waitForSelector('.sheet--won');
    assert.match(await page.textContent('.sheet--won'), /You caught them all/);
    await ctx.close();
  });

  test('artwork: falls back to the mirror, and still playable when both fail', async () => {
    const a = await open({ order: [25], artwork: 'fail-first' });
    await startRun(a.page);
    assert.ok(await a.page.$eval(role('sprite'), (i) => i.src.includes('cdn.jsdelivr.net') && i.naturalWidth > 0));
    await a.ctx.close();
    const b = await open({ order: [25], artwork: 'fail-all' });
    await b.page.click(role('play'));
    await b.page.waitForSelector(`${role('stage')}.is-missing`);
    await guess(b.page, 'Pikachu');
    await waitReveal(b.page);
    assert.equal(await b.page.textContent(role('reveal-name')), 'Pikachu');
    await b.ctx.close();
  });

  test('preloads only the next Pokémon (no waste of mobile data)', async () => {
    const { ctx, page, routes } = await open({ order: [25, 1, 4, 7, 10] });
    await startRun(page);
    await page.waitForTimeout(400);
    const ids = new Set(routes.artwork.map((u) => Number(u.match(/(\d+)\.png/)[1])));
    assert.deepEqual([...ids].sort((x, y) => x - y), [1, 4, 25]);
    await ctx.close();
  });

  test('online Hall of Fame: sends a valid score and shows the ranking', async () => {
    const rows = [
      { document: { fields: { name: { stringValue: 'Giulia' }, score: { integerValue: '41' }, hints: { integerValue: '1' } } } },
      { document: { fields: { name: { stringValue: 'Marco' }, score: { integerValue: '7' }, hints: { integerValue: '0' } } } },
    ];
    const firestore = async (route, req) => {
      if (req.url().includes(':runQuery')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
      if (req.url().includes(':commit')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      return route.fulfill({ status: 404, body: '' });
    };
    const { ctx, page, routes, errors } = await open({ fb: 'demo-wtp', order: [1, 4], firestore });
    await page.waitForFunction(() => /GIULIA 41/.test(document.querySelector('[data-role="top-score"]').textContent));
    await startRun(page);
    await page.click(role('hint'));
    await guess(page, 'Bulbasaur');
    await waitReveal(page);
    await page.waitForFunction(() => window.__wtp.revealDone >= 1);
    await page.click(role('next'));
    for (const g of ['a', 'b', 'c']) { await guess(page, g); await page.waitForTimeout(60); }
    await page.waitForFunction(() => document.querySelector('[data-role="go-save"]')?.dataset.ok === 'true', null, { timeout: 8000 });
    assert.match(await page.textContent('[data-role="go-save"]'), /Saved to the Hall of Fame/);
    const commit = routes.firestore.find((r) => r.url.includes(':commit'));
    assert.ok(commit, 'score sent');
    assert.match(commit.url, /projects\/demo-wtp\/databases\/\(default\)\/documents:commit\?key=test-key/);
    const w = JSON.parse(commit.body).writes[0];
    assert.deepEqual(w.update.fields, { name: { stringValue: 'Marco' }, score: { integerValue: '1' }, hints: { integerValue: '1' }, theme: { stringValue: 'arena' } });
    await page.click('[data-act="hof"]');
    await page.waitForSelector('.hof-row');
    const list = await page.$$eval('.hof-row', (els) => els.map((e) => [e.querySelector('.hof-name').textContent, e.querySelector('.hof-score').textContent, e.classList.contains('is-me')]));
    assert.deepEqual(list, [['Giulia', '41', false], ['Marco', '7', true]]);
    assert.match(await page.textContent('[data-role="hof-status"]'), /Top 20/);
    assert.deepEqual(errors, []);
    await ctx.close();
  });

  test('online Hall of Fame down: score kept on the phone, clear message', async () => {
    const firestore = (route) => route.fulfill({ status: 503, body: '' });
    const { ctx, page } = await open({ fb: 'demo-wtp', order: [1], firestore });
    await startRun(page);
    for (const g of ['a', 'b', 'c']) { await guess(page, g); await page.waitForTimeout(60); }
    await page.waitForFunction(() => document.querySelector('[data-role="go-save"]')?.dataset.ok === 'false', null, { timeout: 8000 });
    assert.match(await page.textContent('[data-role="go-save"]'), /Saved on this phone \(online Hall of Fame unreachable\)/);
    await page.click('[data-act="hof"]');
    await page.waitForSelector('[data-role="hof-status"]');
    await page.waitForFunction(() => /Offline/.test(document.querySelector('[data-role="hof-status"]').textContent));
    await ctx.close();
  });

  test('share: copies a message when the share sheet is not available', async () => {
    const { ctx, page } = await open({ order: [1] });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(() => { try { delete Navigator.prototype.share; } catch (e) { /* ignore */ } navigator.share = undefined; });
    await startRun(page);
    for (const g of ['a', 'b', 'c']) { await guess(page, g); await page.waitForTimeout(60); }
    await page.waitForSelector('.sheet--gameover');
    await page.click('[data-act="share"]');
    await page.waitForSelector('.toast');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(clip, /^I guessed 0 Pokémon in a row in Who's That Pokémon\? Can you beat me\? http/);
    await ctx.close();
  });

  test('small phone (iPhone SE 1st gen, 320×568): game fits, home scrolls to Play', async () => {
    for (const theme of THEMES) {
      const { ctx, page } = await open({ theme, order: [445], viewport: { width: 320, height: 568 } });
      const sw = await page.evaluate(() => document.getElementById('app').scrollWidth);
      assert.ok(sw <= 320, `${theme}: no horizontal scroll on home (${sw})`);
      await page.locator(role('play')).scrollIntoViewIfNeeded();
      await startRun(page);
      for (const r of ['guess-input', 'guess-submit', 'hint', 'stage']) {
        const b = await page.locator(role(r)).boundingBox();
        assert.ok(b.x >= 0 && b.x + b.width <= 321 && b.y + b.height <= 569, `${theme} ${r}: ${JSON.stringify(b)}`);
      }
      await ctx.close();
    }
  });

  test('large phone (Pixel 7) and desktop: layout stays a phone-width column', async () => {
    const a = await open({ device: 'Pixel 7', order: [1] });
    await startRun(a.page);
    assert.ok(await a.page.locator(role('guess-submit')).isVisible());
    await a.ctx.close();
    const b = await open({ device: 'Desktop Chrome', order: [1] });
    const w = await b.page.evaluate(() => document.getElementById('app').getBoundingClientRect().width);
    assert.ok(w <= 480, `column width ${w}`);
    await b.ctx.close();
  });

  test('accessibility basics: names on buttons, labels on inputs, alt on images', async () => {
    for (const theme of THEMES) {
      const { ctx, page } = await open({ theme, order: [1] });
      const check = () => page.evaluate(() => {
        const bad = [];
        document.querySelectorAll('button').forEach((b) => {
          const name = (b.getAttribute('aria-label') || b.textContent || '').trim();
          if (!name) bad.push(`button without name: ${b.outerHTML.slice(0, 80)}`);
        });
        document.querySelectorAll('input').forEach((i) => { if (!document.querySelector(`label[for="${i.id}"]`)) bad.push(`input without label #${i.id}`); });
        document.querySelectorAll('img').forEach((i) => { if (!i.hasAttribute('alt')) bad.push(`img without alt ${i.src}`); });
        return bad;
      });
      assert.deepEqual(await check(), [], `${theme} home`);
      await startRun(page);
      assert.deepEqual(await check(), [], `${theme} game`);
      await ctx.close();
    }
  });

  test('normal players get no test hooks; ?debug=1 shows the debug panel', async () => {
    const ctx = await newPhone(browser, {});
    await installRoutes(ctx);
    const page = await ctx.newPage();
    await page.goto(base);
    await page.waitForSelector('[data-role="play"]');
    assert.equal(await page.evaluate(() => typeof window.__wtp), 'undefined');
    await page.goto(`${base}?debug=1`);
    await page.waitForSelector('#wtp-debug');
    await page.fill(role('nickname'), 'Dbg');
    await page.click(role('play'));
    await page.waitForFunction(() => /answer: #\d+ /.test(document.getElementById('wtp-debug').textContent));
    await ctx.close();
  });

  test('first load is light: under 1 MB before fonts', async () => {
    const ctx = await newPhone(browser, {});
    await installRoutes(ctx);
    const page = await ctx.newPage();
    let bytes = 0;
    page.on('response', async (r) => {
      if (r.url().startsWith(base)) { try { bytes += (await r.body()).length; } catch { /* ignore */ } }
    });
    await page.goto(`${base}?test=1`);
    await page.waitForFunction(() => window.__wtp && window.__wtp.ready);
    await page.waitForTimeout(300);
    assert.ok(bytes < 1_000_000, `${bytes} bytes`);
    await ctx.close();
  });
});
