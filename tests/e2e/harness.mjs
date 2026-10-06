// Test harness: tiny static server for the game folder + Playwright launcher.
// External requests (artwork, fallback cries, fonts, Firebase) are intercepted
// so the tests are deterministic and work offline.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

function loadPlaywright() {
  const paths = ['playwright', '/opt/node22/lib/node_modules/playwright', '/opt/npm-tools/node_modules/playwright'];
  for (const p of paths) { try { return require(p); } catch { /* try next */ } }
  throw new Error('Playwright not found');
}
export const { chromium, devices } = loadPlaywright();

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.mp3': 'audio/mpeg',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
};

export function startServer(port = 0) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
      if (path.endsWith('/')) path += 'index.html';
      const file = join(ROOT, path);
      if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      await stat(file);
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404); res.end('not found');
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}

// Original placeholder "creature" so silhouettes and reveals can be checked.
export function placeholderSvg(id) {
  const hue = (id * 47) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" width="475" height="475">
<path d="M58 182 C 22 170 14 126 38 98 C 26 66 40 30 72 34 L 80 6 L 98 38 C 112 30 128 30 140 38 L 162 10 L 166 46 C 196 62 210 104 192 140 C 202 170 180 196 150 190 C 130 206 84 204 58 182 Z" fill="hsl(${hue} 70% 55%)" stroke="#222" stroke-width="4"/>
<circle cx="90" cy="100" r="9" fill="#222"/><circle cx="140" cy="100" r="9" fill="#222"/>
<text x="110" y="160" font-size="34" text-anchor="middle" font-family="sans-serif" fill="#222">${id}</text></svg>`;
}

/**
 * Routes for external hosts. options.artwork: 'ok' | 'fail-first' | 'fail-all'
 * options.firestore: handler(route, request) or undefined (→ 404).
 */
export async function installRoutes(context, options = {}) {
  const log = { artwork: [], cries: [], fonts: 0, firestore: [] };
  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === '127.0.0.1') return route.continue();
    if (u.hostname === 'raw.githubusercontent.com' && u.pathname.includes('/sprites/')) {
      log.artwork.push(u.href);
      if (options.artwork === 'fail-first' || options.artwork === 'fail-all') return route.fulfill({ status: 404, body: '' });
      const id = Number(u.pathname.match(/(\d+)\.png$/)[1]);
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: placeholderSvg(id) });
    }
    if (u.hostname === 'cdn.jsdelivr.net') {
      log.artwork.push(u.href);
      if (options.artwork === 'fail-all') return route.fulfill({ status: 404, body: '' });
      const id = Number(u.pathname.match(/(\d+)\.png$/)[1]);
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: placeholderSvg(id) });
    }
    if (u.hostname === 'play.pokemonshowdown.com' || (u.hostname === 'raw.githubusercontent.com' && u.pathname.includes('/cries/'))) {
      log.cries.push(u.href);
      const mp3 = await readFile(join(ROOT, 'audio/cries/100.mp3'));
      return route.fulfill({ status: 200, contentType: 'audio/mpeg', body: mp3 });
    }
    if (u.hostname.endsWith('googleapis.com') && u.hostname.startsWith('fonts') || u.hostname === 'fonts.gstatic.com') {
      log.fonts += 1;
      return route.fulfill({ status: 200, contentType: 'text/css', body: '' });
    }
    if (u.hostname === 'firestore.googleapis.com') {
      log.firestore.push({ url: u.href, body: route.request().postData() });
      if (options.firestore) return options.firestore(route, route.request());
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  return log;
}

export async function newPhone(browser, { device = 'iPhone 13', storage = {}, ...opts } = {}) {
  const d = devices[device] || devices['iPhone 13'];
  const context = await browser.newContext({
    ...d,
    // Chromium can't emulate WebKit: keep the phone viewport/touch but use Chromium's engine
    defaultBrowserType: undefined,
    locale: 'it-IT',
    ...opts,
  });
  if (Object.keys(storage).length) {
    await context.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
  }
  return context;
}
