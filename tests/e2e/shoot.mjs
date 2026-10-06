// Screenshot tour of every theme (home, game, hint, reveal, keyboard-open,
// game over, sheets). Usage: node tests/e2e/shoot.mjs <outDir> [theme ...]
import { mkdir } from 'node:fs/promises';
import { chromium, startServer, installRoutes, newPhone } from './harness.mjs';

const out = process.argv[2] || 'shots';
const themes = process.argv.slice(3).length ? process.argv.slice(3) : ['arena', 'burst', 'comic', 'forest', 'arcade'];
await mkdir(out, { recursive: true });
const { server, url } = await startServer();
const browser = await chromium.launch();

for (const theme of themes) {
  const ctx = await newPhone(browser, { storage: { 'wtp.theme': theme, 'wtp.nickname': 'Marco', 'wtp.sound': 'off' } });
  await installRoutes(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${theme}] pageerror`, e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[${theme}] console`, m.text()); });
  await page.goto(`${url}?test=1`);
  await page.waitForFunction(() => window.__wtp && window.__wtp.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${theme}-1-home.png` });
  await page.screenshot({ path: `${out}/${theme}-1b-home-full.png`, fullPage: true });
  await page.click('[data-role="play"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${theme}-2-game.png` });
  await page.click('[data-role="hint"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${theme}-3-hint.png` });
  await page.fill('[data-role="guess-input"]', 'Wrongemon');
  await page.click('[data-role="guess-submit"]');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/${theme}-4-wrong.png` });
  const name = await page.evaluate(() => window.__wtp.state.game.current().name);
  await page.fill('[data-role="guess-input"]', name);
  await page.click('[data-role="guess-submit"]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${theme}-5-reveal-mid.png` });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${theme}-6-reveal.png` });
  await page.click('[data-role="next"]');
  await page.waitForTimeout(400);
  // simulate the on-screen keyboard: visible height ~ 470px
  await page.setViewportSize({ width: 390, height: 470 });
  await page.focus('[data-role="guess-input"]');
  await page.evaluate(() => document.documentElement.classList.add('kb-open'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${theme}-7-keyboard.png` });
  await page.evaluate(() => document.documentElement.classList.remove('kb-open'));
  await page.setViewportSize({ width: 390, height: 844 });
  // lose all lives
  for (let i = 0; i < 2; i += 1) {
    await page.fill('[data-role="guess-input"]', `wrong${i}`);
    await page.click('[data-role="guess-submit"]');
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${out}/${theme}-8-gameover.png` });
  await page.click('[data-act="home"]');
  await page.waitForTimeout(400);
  await page.click('[data-role="theme-open"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${theme}-9-themes.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.click('[data-role="hof-open"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${theme}-10-hof.png` });
  await ctx.close();
  console.log('done', theme);
}
await browser.close();
server.close();
