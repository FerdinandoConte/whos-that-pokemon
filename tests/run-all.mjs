// Runs every test group and writes a readable report:
//   test-results/REPORT.md      summary + every test with result and time + failure details
//   test-results/*.junit.xml    machine-readable results per group
//   test-results/*.log          full console output per group
// Usage: node tests/run-all.mjs [unit|audio|e2e ...]
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import os from 'node:os';

const ROOT = new URL('../', import.meta.url).pathname;
const OUT = `${ROOT}test-results/`;
const GROUPS = {
  unit: { title: 'Logic, data and Hall of Fame rules', dir: 'tests/unit', concurrency: 4 },
  audio: { title: 'Cleaned cries (ffmpeg measurements)', dir: 'tests/audio', concurrency: 1 },
  e2e: { title: 'Browser, phone emulation (all 5 themes)', dir: 'tests/e2e', concurrency: 1 },
};
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(GROUPS);

function run(name) {
  const g = GROUPS[name];
  const files = readdirSync(`${ROOT}${g.dir}`).filter((f) => f.endsWith('.test.mjs')).map((f) => `${g.dir}/${f}`);
  const args = ['--test', `--test-concurrency=${g.concurrency}`,
    '--test-reporter=spec', '--test-reporter-destination=stdout',
    '--test-reporter=junit', `--test-reporter-destination=${OUT}${name}.junit.xml`, ...files];
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, args, { cwd: ROOT });
    let log = '';
    child.stdout.on('data', (d) => { log += d; process.stdout.write(d); });
    child.stderr.on('data', (d) => { log += d; process.stderr.write(d); });
    child.on('close', async (code) => {
      await writeFile(`${OUT}${name}.log`, log);
      resolve({ name, code, ms: Date.now() - started });
    });
  });
}

const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&amp;/g, '&');

function parseJunit(xml) {
  const cases = [];
  const re = /<testcase\s+([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  let m;
  while ((m = re.exec(xml))) {
    const attrs = Object.fromEntries([...m[1].matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], unescape(a[2])]));
    const body = m[3] || '';
    const failure = body.match(/<failure[^>]*?(?:message="([^"]*)")?[^>]*>([\s\S]*?)<\/failure>/);
    const skipped = /<skipped/.test(body);
    cases.push({
      suite: attrs.classname || '', name: attrs.name, time: Number(attrs.time || 0),
      status: failure ? 'fail' : skipped ? 'skip' : 'pass',
      message: failure ? unescape(failure[1] || '') : '',
      detail: failure ? unescape(failure[2]).replace(/\u001b\[[0-9;]*m/g, '').trim().split('\n').slice(0, 25).join('\n') : '',
    });
  }
  return cases;
}

await mkdir(OUT, { recursive: true });
const results = [];
for (const name of wanted) results.push(await run(name));

let md = '# Test report: Who\'s That Pokémon?\n\n';
md += `Run on ${new Date().toISOString()} · Node ${process.version} · ${os.type()} ${os.release()}\n\n`;
let total = 0; let failed = 0;
const sections = [];
for (const r of results) {
  const xml = await readFile(`${OUT}${r.name}.junit.xml`, 'utf8').catch(() => '');
  const cases = parseJunit(xml);
  const f = cases.filter((c) => c.status === 'fail');
  total += cases.length; failed += f.length;
  let s = `## ${GROUPS[r.name].title} (\`${r.name}\`)\n\n`;
  s += `${cases.length - f.length}/${cases.length} passed · ${(r.ms / 1000).toFixed(1)} s · exit code ${r.code}\n\n`;
  s += '| | Test | Group | Time |\n|---|---|---|---|\n';
  for (const c of cases) {
    const icon = c.status === 'pass' ? '✅' : c.status === 'skip' ? '⏭️' : '❌';
    s += `| ${icon} | ${c.name.replace(/\|/g, '\\|')} | ${c.suite.replace(/\|/g, '\\|')} | ${c.time.toFixed(2)} s |\n`;
  }
  if (f.length) {
    s += '\n### Failures\n\n';
    for (const c of f) s += `**${c.suite} › ${c.name}**\n\n\`\`\`\n${c.message}\n${c.detail}\n\`\`\`\n\n`;
  }
  sections.push(s);
}
md += failed === 0 ? `**All ${total} tests passed.**\n\n` : `**${failed} of ${total} tests failed.** Details below.\n\n`;
md += 'Full output of each group: `test-results/<group>.log`. Machine-readable: `test-results/<group>.junit.xml`.\n\n';
md += sections.join('\n');
await writeFile(`${OUT}REPORT.md`, md);
console.log(`\nReport written to test-results/REPORT.md (${total - failed}/${total} passed)`);
process.exit(failed ? 1 : 0);
