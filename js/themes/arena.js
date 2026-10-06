import { ICON, DEDICATION, esc, lives, clues, slots, guessForm, sprite, revealPanel, feedback, soundButton, quitButton, photo, nickname } from './parts.js';

const hintBtn = `<button class="arena-hint" data-role="hint" type="button" aria-label="Use a hint">
  ${ICON.bulb}<span>HINT</span><span class="arena-hint-count" data-role="hints-left">3</span></button>`;

const ledLife = '<i class="led" aria-hidden="true"></i>';

export default {
  id: 'arena',
  label: 'Night Arena',
  tagline: 'Spotlights and a scoreboard',
  lifeIcon: ledLife,

  home() {
    const tick = `★ TONIGHT: 493 POKÉMON · 3 LIVES · 3 HINTS ★ <span data-role="top-score">HALL OF FAME OPEN</span> ★ YOUR BEST: <span data-role="best">0</span> ★`;
    return `<section class="screen home arena-home" data-screen="home">
      <div class="arena-beam arena-beam--l" aria-hidden="true"></div>
      <div class="arena-beam arena-beam--r" aria-hidden="true"></div>
      <div class="arena-crowd" aria-hidden="true"></div>
      <div class="arena-ticker"><div class="arena-ticker-track">
        <span>${tick}</span><span aria-hidden="true">${tick}</span></div></div>
      <div class="arena-home-body">
        <h1 class="arena-title">Who's that<br>Pokémon?</h1>
        <figure class="arena-poster">
          <div class="arena-poster-frame">${photo('arena-photo')}</div>
          <figcaption class="arena-ribbon">THE VOICE: DANIELE</figcaption>
        </figure>
        <p class="dedication arena-dedication" lang="it" data-role="dedication">${esc(DEDICATION)}</p>
        ${nickname({ label: 'CHALLENGER NAME', cls: 'arena-nick' })}
        <button class="arena-play" data-role="play" type="button">ENTER THE ARENA</button>
        <div class="arena-row">
          <button class="arena-sec" data-role="hof-open" type="button">${ICON.trophy}<span>HALL OF FAME</span></button>
          <button class="arena-sec" data-role="theme-open" type="button">${ICON.palette}<span>THEME</span></button>
        </div>
      </div>
    </section>`;
  },

  game() {
    return `<section class="screen game arena-game" data-screen="game">
      <div class="arena-topbar">
        ${quitButton('arena-icon')}
        <span class="arena-round">ROUND <span data-role="round">1</span></span>
        ${soundButton('arena-icon')}
      </div>
      <div class="arena-board">
        <div class="arena-cell"><div class="arena-cell-label">LIVES</div>${lives(ledLife, 'arena-lives')}</div>
        <div class="arena-cell arena-cell--mid"><div class="arena-cell-label">SCORE</div><div class="arena-score" data-role="score">0</div></div>
        <div class="arena-cell arena-cell--end"><div class="arena-cell-label">HINTS</div><div class="arena-hints"><span data-role="hints-left">3</span>/3</div></div>
      </div>
      <div class="stage arena-stage" data-role="stage">
        <div class="arena-spot" aria-hidden="true"></div>
        <div class="arena-platform" aria-hidden="true"></div>
        <div class="arena-glow" aria-hidden="true"></div>
        <div class="sprite-wrap">${sprite()}</div>
        <div class="arena-tag" aria-hidden="true">Who's that<br>Pokémon?</div>
        ${revealPanel()}
      </div>
      <div class="controls arena-controls">
        ${clues('HINT')}
        ${slots()}
        ${guessForm({ placeholder: 'Name your guess', button: 'LOCK IT IN', cls: 'arena-form', extra: hintBtn })}
      </div>
      ${feedback()}
    </section>`;
  },
};
