import { ICON, DEDICATION, esc, lives, clues, slots, guessForm, sprite, revealPanel, feedback, soundButton, quitButton, photo, nickname } from './parts.js';

const pixel = '<i class="px" aria-hidden="true"></i>';
const hintBtn = `<div class="arcade-btn-wrap">
  <button class="arcade-hint" data-role="hint" type="button" aria-label="Use a hint">${ICON.bulb}</button>
  <span class="arcade-btn-label">HINT ×<span data-role="hints-left">3</span></span></div>`;

export default {
  id: 'arcade',
  label: 'Ember Arcade',
  tagline: 'A neon cabinet at sunset',
  lifeIcon: pixel,

  home() {
    return `<section class="screen home arcade-home" data-screen="home">
      <div class="arcade-side arcade-side--l" aria-hidden="true"></div>
      <div class="arcade-side arcade-side--r" aria-hidden="true"></div>
      <div class="arcade-cabinet">
        <div class="arcade-marquee">
          <h1 class="arcade-title">Who's that<br>Pokémon?</h1>
          <button class="arcade-theme" data-role="theme-open" type="button">${ICON.palette}<span>THEME</span></button>
        </div>
        <div class="arcade-bezel">
          <div class="arcade-screen">
            <div class="arcade-sun" aria-hidden="true"></div>
            <div class="arcade-grid" aria-hidden="true"></div>
            <div class="arcade-photo-ring">${photo('arcade-photo')}</div>
            <div class="arcade-player">PLAYER 1 · <span>DANIELE</span></div>
            <p class="dedication arcade-dedication" lang="it" data-role="dedication">${esc(DEDICATION)}</p>
            <div class="arcade-scan" aria-hidden="true"></div>
          </div>
        </div>
        <div class="arcade-panel">
          ${nickname({ label: 'ENTER YOUR NAME', placeholder: 'MARCO', cls: 'arcade-nick' })}
          <div class="arcade-buttons">
            <div class="arcade-stick" aria-hidden="true"><i></i><i></i><i></i></div>
            <div class="arcade-btn-wrap">
              <button class="arcade-play" data-role="play" type="button">PLAY</button>
              <span class="arcade-btn-label arcade-blink">PRESS PLAY</span>
            </div>
            <div class="arcade-btn-wrap">
              <button class="arcade-hof" data-role="hof-open" type="button" aria-label="Hall of Fame">${ICON.trophy}</button>
              <span class="arcade-btn-label">HI-SCORES</span>
            </div>
          </div>
          <div class="arcade-best">YOUR BEST <b data-role="best">0</b></div>
        </div>
      </div>
    </section>`;
  },

  game() {
    return `<section class="screen game arcade-game" data-screen="game">
      <div class="arcade-side arcade-side--l" aria-hidden="true"></div>
      <div class="arcade-side arcade-side--r" aria-hidden="true"></div>
      <div class="arcade-cabinet arcade-cabinet--game">
        <div class="arcade-bezel arcade-bezel--game">
          <div class="arcade-screen stage" data-role="stage">
            <div class="arcade-sun" aria-hidden="true"></div>
            <div class="arcade-grid" aria-hidden="true"></div>
            <div class="arcade-hud">
              <div><span class="arcade-hud-label">LIVES</span>${lives(pixel, 'arcade-lives')}</div>
              <div class="arcade-hud-mid"><span class="arcade-hud-label">1UP</span><b data-role="score">0</b></div>
              <div class="arcade-hud-end"><span class="arcade-hud-label">STAGE</span><b data-role="round">1</b></div>
            </div>
            <div class="arcade-tag" aria-hidden="true">Who's that Pokémon?</div>
            <div class="sprite-wrap">${sprite()}</div>
            <div class="arcade-scan" aria-hidden="true"></div>
            ${revealPanel()}
          </div>
        </div>
        <div class="arcade-panel arcade-panel--game">
          <div class="arcade-panel-tools">${quitButton('arcade-icon')}${soundButton('arcade-icon')}</div>
          ${clues('HINT')}
          ${slots()}
          ${guessForm({ placeholder: 'TYPE THE NAME', button: 'GO!', cls: 'arcade-form', extra: hintBtn })}
        </div>
      </div>
      ${feedback()}
    </section>`;
  },
};
