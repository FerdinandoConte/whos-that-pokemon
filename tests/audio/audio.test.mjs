// Checks every cleaned cry independently of the cleanup script: the files are
// decoded and measured again with ffmpeg, and the cleanup report is checked for
// trimming that might have cut part of the cry.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const dir = new URL('../../audio/cries/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.mp3')).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
const report = JSON.parse(readFileSync(new URL('../../tools/audio_report.json', import.meta.url), 'utf8'));
const byId = new Map(report.map((r) => [r.id, r]));

const TARGET_LUFS = -16;

async function measure(path) {
  const probe = await run('ffprobe', ['-v', 'error', '-show_entries',
    'stream=codec_name,sample_rate,channels:format=duration,bit_rate', '-of', 'json', path]);
  const j = JSON.parse(probe.stdout);
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-af',
    'ebur128=peak=true,silencedetect=n=-45dB:d=0.25', '-f', 'null', '-'], { maxBuffer: 1 << 24 });
  const lufs = [...stderr.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
  const peak = [...stderr.matchAll(/Peak:\s+(-?[\d.]+) dBFS/g)].pop();
  const silenceStarts = [...stderr.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Number(m[1]));
  return {
    codec: j.streams[0].codec_name, rate: Number(j.streams[0].sample_rate), channels: j.streams[0].channels,
    duration: Number(j.format.duration), lufs: lufs ? Number(lufs[1]) : null, peak: peak ? Number(peak[1]) : null,
    leadingSilence: silenceStarts.length && silenceStarts[0] <= 0.01,
  };
}

test('there is a report line for every cleaned file and vice versa', () => {
  assert.equal(files.length, report.length);
  for (const f of files) assert.ok(byId.has(parseInt(f, 10)), f);
});

test('cleanup kept the whole cry (≥ 99% of its energy) in every file', () => {
  for (const r of report) assert.ok(r.retained >= 0.99, `${r.id}: retained ${r.retained}`);
});

test('cleanup removed the dead air before the cry', () => {
  for (const r of report) assert.ok(r.out_lead <= 0.3, `${r.id}: ${r.out_lead}s before the cry`);
  const median = report.map((r) => r.out_lead).sort((a, b) => a - b)[Math.floor(report.length / 2)];
  assert.ok(median <= 0.08, `median lead ${median}`);
});

test('cleanup removed the dead air after the cry', () => {
  for (const r of report) assert.ok(r.out_tail <= 1.0, `${r.id}: ${r.out_tail}s after the cry`);
  const median = report.map((r) => r.out_tail).sort((a, b) => a - b)[Math.floor(report.length / 2)];
  assert.ok(median <= 0.3, `median tail ${median}`);
});

test('every file decodes, is mono 44.1 kHz mp3, sized for phones, at a uniform loudness', async () => {
  const problems = [];
  const lufsList = [];
  const queue = files.slice();
  async function worker() {
    while (queue.length) {
      const f = queue.shift();
      const path = new URL(f, dir).pathname;
      const m = await measure(path);
      const size = statSync(path).size;
      if (m.codec !== 'mp3') problems.push(`${f}: codec ${m.codec}`);
      if (m.rate !== 44100) problems.push(`${f}: ${m.rate} Hz`);
      if (m.channels !== 1) problems.push(`${f}: ${m.channels} channels`);
      // Jigglypuff sings its whole lullaby, so allow up to 6 s
      if (!(m.duration >= 0.3 && m.duration <= 6)) problems.push(`${f}: duration ${m.duration}s`);
      if (size > 60000) problems.push(`${f}: ${size} bytes`);
      if (m.lufs === null || Math.abs(m.lufs - TARGET_LUFS) > 1.5) problems.push(`${f}: ${m.lufs} LUFS`);
      if (m.peak === null || m.peak > -0.1) problems.push(`${f}: peak ${m.peak} dBFS (clipping risk)`);
      if (m.leadingSilence) problems.push(`${f}: starts with silence`);
      if (m.lufs !== null) lufsList.push(m.lufs);
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  assert.deepEqual(problems, []);
  const spread = Math.max(...lufsList) - Math.min(...lufsList);
  assert.ok(spread <= 2, `loudness spread across all cries ${spread.toFixed(1)} LU`);
});
