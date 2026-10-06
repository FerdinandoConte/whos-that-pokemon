import { ICON, DEDICATION, esc, lives, clues, slots, guessForm, sprite, revealPanel, feedback, soundButton, quitButton, photo, nickname } from './parts.js';

const leaf = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21 C 3 10 10 3 21 3 C 21 14 14 21 3 21 Z"/></svg>';

export default {
  id: 'forest',
  label: 'Wild Forest',
  tagline: 'A field expedition with binoculars',
  lifeIcon: ICON.berry,

  home() {
    return `<section class="screen home forest-home" data-screen="home">
      <div class="forest-hills" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <span class="forest-leaf forest-leaf--a" aria-hidden="true">${leaf}</span>
      <span class="forest-leaf forest-leaf--b" aria-hidden="true">${leaf}</span>
      <span class="forest-leaf forest-leaf--c" aria-hidden="true">${leaf}</span>
      <button class="forest-theme" data-role="theme-open" type="button">${ICON.palette}<span>THEME</span></button>
      <div class="forest-home-body">
        <div class="forest-sign">
          <div class="forest-ropes" aria-hidden="true"><i></i><i></i></div>
          <h1 class="forest-plank">Who's that<br>Pokémon?</h1>
        </div>
        <div class="forest-notebook">
          <div class="forest-rings" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
          <figure class="forest-polaroid">
            <div class="forest-polaroid-pic">${photo('forest-photo')}</div>
            <figcaption>Daniele</figcaption>
            <i class="forest-tape" aria-hidden="true"></i>
          </figure>
          <div class="forest-notes">
            <div class="forest-notes-label">Field notes —</div>
            <p class="dedication" lang="it" data-role="dedication">${esc(DEDICATION)}</p>
          </div>
        </div>
        ${nickname({ label: 'EXPLORER NAME', cls: 'forest-nick' })}
        <button class="forest-play" data-role="play" type="button">${ICON.compass}<span>Start expedition</span></button>
        <div class="forest-row">
          <button class="forest-hof" data-role="hof-open" type="button">Hall of Fame</button>
          <div class="forest-best">Best trail: <b data-role="best">0</b></div>
        </div>
      </div>
    </section>`;
  },

  game() {
    return `<section class="screen game forest-game" data-screen="game">
      <div class="forest-hud">
        ${lives(ICON.berry, 'forest-lives')}
        <div class="forest-score"><span>spotted</span><b data-role="score">0</b></div>
        <div class="forest-tools">${soundButton('forest-icon')}${quitButton('forest-icon')}</div>
      </div>
      <div class="stage forest-stage" data-role="stage">
        <div class="forest-view">
          <div class="forest-sky" aria-hidden="true"></div>
          <div class="forest-hill" aria-hidden="true"></div>
          <div class="sprite-wrap">${sprite()}</div>
          <div class="forest-grass" aria-hidden="true"></div>
        </div>
        <div class="forest-cross" aria-hidden="true"></div>
        <div class="forest-tape-label" aria-hidden="true">Who's that Pokémon?</div>
        <div class="forest-round">sighting #<span data-role="round">1</span></div>
        ${revealPanel()}
      </div>
      <div class="controls forest-controls">
        <div class="forest-card">
          ${clues('Clues:')}
          ${slots()}
        </div>
        ${guessForm({ placeholder: 'Name your sighting', button: 'Got it!', cls: 'forest-form' })}
        <button class="forest-hint" data-role="hint" type="button">${ICON.lens}<span>Check the field guide (<span data-role="hints-left">3</span> left)</span></button>
      </div>
      ${feedback()}
    </section>`;
  },
};
