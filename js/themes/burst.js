import { ICON, DEDICATION, esc, lives, clues, slots, guessForm, sprite, revealPanel, feedback, soundButton, quitButton, photo, nickname } from './parts.js';

export default {
  id: 'burst',
  label: 'TV Burst',
  tagline: 'Spinning rays, straight from the show',
  lifeIcon: ICON.heart,

  home() {
    return `<section class="screen home burst-home" data-screen="home">
      <div class="burst-rays" aria-hidden="true"></div>
      <div class="burst-glow" aria-hidden="true"></div>
      <button class="burst-theme" data-role="theme-open" type="button">${ICON.palette}<span>THEME</span></button>
      <div class="burst-home-body">
        <div class="burst-chip">GEN I–IV · 493 POKÉMON</div>
        <h1 class="burst-title">Who's that<br>Pokémon?</h1>
        <div class="burst-photo">
          <span class="burst-star burst-star--a" aria-hidden="true">${ICON.star}</span>
          <span class="burst-star burst-star--b" aria-hidden="true">${ICON.star}</span>
          <span class="burst-star burst-star--c" aria-hidden="true">${ICON.star}</span>
          <div class="burst-photo-ring">${photo('burst-photo-img')}</div>
          <div class="burst-ribbon">DANIELE</div>
        </div>
        <p class="dedication burst-bubble" lang="it" data-role="dedication">${esc(DEDICATION)}</p>
        ${nickname({ label: 'TRAINER NAME', cls: 'burst-nick' })}
        <button class="burst-play" data-role="play" type="button">PLAY!</button>
        <div class="burst-row">
          <button class="burst-hof" data-role="hof-open" type="button">${ICON.trophy}<span>Hall of Fame</span></button>
          <div class="burst-best"><span>YOUR BEST</span><b data-role="best">0</b></div>
        </div>
      </div>
    </section>`;
  },

  game() {
    return `<section class="screen game burst-game" data-screen="game">
      <div class="burst-hud">
        ${quitButton('burst-icon')}
        ${lives(ICON.heart, 'burst-lives')}
        <div class="burst-score"><span>SCORE</span><b data-role="score">0</b></div>
        ${soundButton('burst-icon')}
      </div>
      <div class="stage burst-stage" data-role="stage">
        <div class="burst-stage-rays" aria-hidden="true"></div>
        <div class="burst-stage-glow" aria-hidden="true"></div>
        <div class="sprite-wrap">${sprite()}</div>
        <div class="burst-tag" aria-hidden="true">Who's that Pokémon?</div>
        <div class="burst-round">#<span data-role="round">1</span> IN THIS RUN</div>
        ${revealPanel()}
      </div>
      <div class="controls burst-controls">
        ${clues('HINT')}
        ${slots()}
        ${guessForm({ placeholder: 'Type the name', button: 'GO!', cls: 'burst-form' })}
        <button class="burst-hint" data-role="hint" type="button">${ICON.bulb}<span>Use a hint · <span data-role="hints-left">3</span> left</span></button>
      </div>
      ${feedback()}
    </section>`;
  },
};
