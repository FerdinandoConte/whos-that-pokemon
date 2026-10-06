import { ICON, DEDICATION, esc, lives, clues, slots, guessForm, sprite, revealPanel, feedback, soundButton, quitButton, photo, nickname } from './parts.js';

const burstPath = 'M50 0 L60 28 L90 14 L74 42 L100 54 L70 62 L82 94 L54 74 L40 100 L36 70 L4 82 L24 56 L0 40 L30 34 L22 6 L44 26 Z';

export default {
  id: 'comic',
  label: 'Comic Pop',
  tagline: 'Halftones, panels and speech bubbles',
  lifeIcon: ICON.heart,

  home() {
    return `<section class="screen home comic-home" data-screen="home">
      <div class="comic-panel comic-title-panel">
        <div class="comic-issue">ISSUE #493</div>
        <button class="comic-theme" data-role="theme-open" type="button">${ICON.palette}<span>THEME</span></button>
        <h1 class="comic-title">Who's that<br>Pokémon?</h1>
      </div>
      <div class="comic-mid">
        <div class="comic-panel comic-photo-panel">
          ${photo('comic-photo')}
          <div class="comic-starring">STARRING…</div>
          <div class="comic-name">DANIELE!</div>
        </div>
        <div class="comic-bubble-wrap">
          <p class="dedication comic-bubble" lang="it" data-role="dedication">${esc(DEDICATION)}</p>
        </div>
      </div>
      <div class="comic-panel comic-start-panel">
        <div class="comic-burst" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="${burstPath}"/></svg><span>3 LIVES!</span></div>
        ${nickname({ label: 'YOUR HERO NAME', cls: 'comic-nick' })}
        <button class="comic-play" data-role="play" type="button">POW! PLAY</button>
        <div class="comic-row">
          <button class="comic-hof" data-role="hof-open" type="button">HALL OF FAME</button>
          <div class="comic-best">BEST <b data-role="best">0</b></div>
        </div>
      </div>
    </section>`;
  },

  game() {
    return `<section class="screen game comic-game" data-screen="game">
      <div class="comic-hud">
        <div class="comic-box comic-box--lives"><span class="comic-box-label">LIVES</span>${lives(ICON.heart, 'comic-lives')}</div>
        <div class="comic-box comic-box--score"><span class="comic-box-label">SCORE</span><b data-role="score">0</b></div>
        <div class="comic-box comic-box--tools">${soundButton('comic-icon')}${quitButton('comic-icon')}</div>
      </div>
      <div class="stage comic-stage" data-role="stage">
        <div class="comic-stage-rays" aria-hidden="true"></div>
        <div class="comic-stage-dots" aria-hidden="true"></div>
        <div class="sprite-wrap">${sprite()}</div>
        <div class="comic-say" aria-hidden="true">Who's that<br>Pokémon?!</div>
        <div class="comic-qq" aria-hidden="true">?!?</div>
        <div class="comic-round">PAGE <span data-role="round">1</span></div>
        ${revealPanel()}
      </div>
      <div class="controls comic-controls">
        ${clues('CLUES:')}
        ${slots()}
        ${guessForm({ placeholder: 'It’s…', button: 'ZAP!', cls: 'comic-form' })}
        <button class="comic-hint" data-role="hint" type="button">NEED A CLUE? (<span data-role="hints-left">3</span> LEFT)</button>
      </div>
      ${feedback()}
    </section>`;
  },
};
