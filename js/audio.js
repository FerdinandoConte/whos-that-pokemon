// Sound: Daniele's cries (decoded once and played through Web Audio, which
// works on iPhone even when the cry starts a moment after the tap), official
// cries as a fallback, synthesized sound effects and an original chiptune loop.
import { FALLBACK_CRY_SOURCES } from './config.js';

const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// Original 4-bar loop: C – Am – F – G (lead, bass, arpeggio), eighth notes.
const LEAD = [
  76, 79, 84, 79, 76, null, 74, 76,
  72, 76, 81, 76, 72, null, 71, 72,
  77, 81, 84, 81, 77, 76, 74, 72,
  74, 79, 83, 79, 74, 77, 79, null,
  76, 79, 84, 86, 84, 79, 76, 79,
  72, 76, 81, 84, 81, 76, 72, 76,
  77, 81, 84, 81, 77, 81, 86, 84,
  83, 79, 74, 79, 83, 86, 84, null,
];
const ROOTS = [48, 45, 41, 43, 48, 45, 41, 43];
const CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62], [60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
const BPM = 128;

export function createAudio() {
  let ctx = null;
  let master; let musicGain; let sfxGain; let cryGain;
  let muted = false;
  let musicOn = false;
  let musicTimer = 0;
  let step = 0;
  let nextTime = 0;
  let ducks = 0;
  const raw = new Map(); // id -> Promise<ArrayBuffer>
  const decoded = new Map(); // id -> Promise<AudioBuffer>
  let fallbackEl = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.11; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.32; sfxGain.connect(master);
    cryGain = ctx.createGain(); cryGain.gain.value = 1.0; cryGain.connect(master);
    return ctx;
  }

  /** Call from a tap handler: creates/resumes the audio context (iOS unlock). */
  function unlock() {
    // iOS 17+: play even when the ring/silent switch is on silent
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* unsupported */ }
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    const b = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = b; src.connect(c.destination); src.start(0);
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.02);
    if (fallbackEl) fallbackEl.muted = m;
  }

  // ---- cries ---------------------------------------------------------------
  function fetchRaw(p) {
    if (!p.cry) return null;
    if (!raw.has(p.id)) {
      raw.set(p.id, fetch(`audio/cries/${p.id}.mp3`).then((r) => {
        if (!r.ok) throw new Error(`cry ${p.id}: http ${r.status}`);
        return r.arrayBuffer();
      }));
      raw.get(p.id).catch(() => raw.delete(p.id));
    }
    return raw.get(p.id);
  }

  function decode(p) {
    if (!p.cry || !ensure()) return null;
    if (!decoded.has(p.id)) {
      const pr = fetchRaw(p).then((buf) => new Promise((resolve, reject) => {
        // callback form: older Safari has no promise-based decodeAudioData
        ctx.decodeAudioData(buf.slice(0), resolve, reject);
      }));
      decoded.set(p.id, pr);
      pr.catch(() => decoded.delete(p.id));
    }
    return decoded.get(p.id);
  }

  function preload(list) {
    for (const p of list) { if (ctx) decode(p); else fetchRaw(p); }
  }

  function duck(seconds) {
    if (!ctx || !musicOn) return;
    ducks += 1;
    const t = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setTargetAtTime(0.025, t, 0.04);
    setTimeout(() => {
      ducks -= 1;
      if (ducks === 0 && ctx) musicGain.gain.setTargetAtTime(0.11, ctx.currentTime, 0.25);
    }, seconds * 1000 + 150);
  }

  /**
   * Official cry for Pokémon without a recording. An <audio> element must be
   * started inside the tap on iPhone, so the UI calls this straight from the
   * guess handler (no delay).
   */
  function playFallback(p) {
    const sources = FALLBACK_CRY_SOURCES.map((f) => f(p));
    if (fallbackEl) { try { fallbackEl.pause(); } catch { /* ignore */ } }
    const el = new Audio();
    el.preload = 'auto';
    el.muted = muted;
    let i = 0;
    el.onerror = () => {
      i += 1;
      if (i < sources.length) { el.src = sources[i]; const r = el.play(); if (r && r.catch) r.catch(() => {}); }
    };
    el.src = sources[0];
    fallbackEl = el;
    const pr = el.play();
    if (pr && pr.catch) pr.catch(() => {});
    duck(1.5);
    return 'fallback';
  }

  /**
   * Daniele's cry through Web Audio (can start any time after unlock()).
   * Resolves with 'daniele', or 'none' when it can't be played.
   */
  async function playCry(p) {
    if (!p.cry || !ensure()) return 'none';
    try {
      const buffer = await decode(p);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(cryGain);
      src.start();
      duck(buffer.duration);
      return 'daniele';
    } catch {
      return 'none';
    }
  }

  // ---- sound effects -------------------------------------------------------
  function tone({ freq, type = 'square', start = 0, dur = 0.1, vol = 0.5, slideTo = null }) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + start;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise({ start = 0, dur = 0.3, vol = 0.3, from = 400, to = 4000 }) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime + start;
    const len = Math.floor(ctx.sampleRate * dur);
    const b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = b;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
  }

  const SFX = {
    click: () => tone({ freq: 880, dur: 0.05, vol: 0.25 }),
    correct: () => [72, 76, 79, 84].forEach((n, i) => tone({ freq: midi(n), start: i * 0.07, dur: 0.12, vol: 0.4 })),
    wrong: () => { tone({ freq: 240, type: 'sawtooth', dur: 0.28, vol: 0.35, slideTo: 90 }); tone({ freq: 180, type: 'square', start: 0.02, dur: 0.22, vol: 0.2, slideTo: 70 }); },
    hint: () => [88, 91, 96, 91, 100].forEach((n, i) => tone({ freq: midi(n), type: 'triangle', start: i * 0.05, dur: 0.12, vol: 0.35 })),
    reveal: () => noise({ dur: 0.45, vol: 0.35, from: 300, to: 6000 }),
    gameover: () => [67, 64, 60, 55].forEach((n, i) => tone({ freq: midi(n), type: 'triangle', start: i * 0.2, dur: 0.32, vol: 0.45 })),
    win: () => [60, 64, 67, 72, 67, 72, 76, 79, 84].forEach((n, i) => tone({ freq: midi(n), start: i * 0.09, dur: 0.16, vol: 0.4 })),
    empty: () => tone({ freq: 330, type: 'triangle', dur: 0.08, vol: 0.25 }),
  };
  function sfx(name) { try { SFX[name] && SFX[name](); } catch { /* audio not available */ } }

  // ---- music ---------------------------------------------------------------
  const eighth = 60 / BPM / 2;
  function scheduleStep(i, t) {
    const bar = Math.floor(i / 8) % 8;
    const lead = LEAD[i % LEAD.length];
    const add = (freq, type, dur, vol, at = t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g); g.connect(musicGain); o.start(at); o.stop(at + dur + 0.02);
    };
    if (lead) add(midi(lead), 'square', eighth * 0.9, 0.22);
    add(midi(ROOTS[bar] - 12 + (i % 2 ? 12 : 0)), 'triangle', eighth * 0.95, 0.5);
    const chord = CHORDS[bar];
    add(midi(chord[(i * 2) % 3] + 12), 'triangle', eighth * 0.45, 0.12);
    add(midi(chord[(i * 2 + 1) % 3] + 12), 'triangle', eighth * 0.45, 0.12, t + eighth / 2);
  }
  function pump() {
    if (!ctx || !musicOn) return;
    while (nextTime < ctx.currentTime + 0.25) {
      scheduleStep(step, nextTime);
      step += 1;
      nextTime += eighth;
    }
  }
  function startMusic() {
    if (!ensure() || musicOn) return;
    musicOn = true;
    step = 0;
    nextTime = ctx.currentTime + 0.1;
    musicTimer = setInterval(pump, 60);
    pump();
  }
  function stopMusic() {
    musicOn = false;
    clearInterval(musicTimer);
  }
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  return {
    unlock, setMuted, isMuted: () => muted, preload, playFallback, playCry, sfx,
    startMusic, stopMusic, suspend, resume, musicPlaying: () => musicOn,
    state: () => (ctx ? ctx.state : 'none'),
  };
}
