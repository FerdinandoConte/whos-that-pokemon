// Debug overlay, only loaded with ?debug=1 in the address.
// Shows the answer and the internal state live, to investigate problems on a
// real phone. Tap the panel to collapse it.
export function mountDebug({ state, audio, board }) {
  const el = document.createElement('div');
  el.id = 'wtp-debug';
  el.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:999;max-width:260px;padding:6px 8px;'
    + 'background:rgba(0,0,0,.82);color:#7CFC9A;font:11px/1.35 ui-monospace,Menlo,monospace;border-radius:8px;'
    + 'white-space:pre-wrap;pointer-events:auto;';
  document.body.appendChild(el);
  let collapsed = false;
  el.addEventListener('click', () => { collapsed = !collapsed; });
  const errors = [];
  window.addEventListener('error', (e) => errors.push(e.message));
  window.addEventListener('unhandledrejection', (e) => errors.push(String(e.reason)));

  function render() {
    if (collapsed) { el.textContent = 'debug ▸'; return; }
    const g = state.game;
    const s = g ? g.snapshot() : null;
    const vv = window.visualViewport;
    const lines = [
      `screen: ${state.screen}  theme: ${state.theme}`,
      s ? `answer: #${s.pokemon.id} ${s.pokemon.name} (${s.pokemon.types.join('/')}, gen ${s.pokemon.gen})` : 'answer: –',
      s ? `cry: ${s.pokemon.cry ? 'Daniele' : 'official fallback'}` : '',
      s ? `status: ${s.status}  round ${s.round}/${s.total}` : '',
      s ? `lives ${s.lives}  hints ${s.hintsLeft} (used ${s.hintsUsed})  score ${s.score}` : '',
      `audio: ${audio.state()}  muted: ${audio.isMuted()}  music: ${audio.musicPlaying()}`,
      `board: ${board.kind}`,
      `viewport: ${innerWidth}×${innerHeight}  visual: ${vv ? `${Math.round(vv.width)}×${Math.round(vv.height)}` : '–'}`,
      `kb-open: ${document.documentElement.classList.contains('kb-open')}`,
      g ? `last: ${g.log().slice(-4).map((x) => `${x.ok ? '✓' : '✗'}${x.guess}`).join(' ')}` : '',
      errors.length ? `errors: ${errors.slice(-3).join(' | ')}` : 'errors: none',
    ].filter(Boolean);
    el.textContent = lines.join('\n');
  }
  render();
  setInterval(render, 400);
}
