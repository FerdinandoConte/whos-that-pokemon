// Keeps the game inside the part of the screen that is actually visible, so
// the on-screen keyboard never covers the silhouette or the text box.
export function watchViewport() {
  const root = document.documentElement;
  const vv = window.visualViewport;
  let fullHeight = window.innerHeight;

  function update() {
    const h = vv ? vv.height : window.innerHeight;
    const top = vv ? vv.offsetTop : 0;
    if (!document.activeElement || document.activeElement.tagName !== 'INPUT') fullHeight = Math.max(h, window.innerHeight);
    root.style.setProperty('--app-h', `${Math.round(h)}px`);
    root.style.setProperty('--app-top', `${Math.round(top)}px`);
    const keyboard = h < fullHeight * 0.78;
    root.classList.toggle('kb-open', keyboard);
    root.classList.toggle('is-short', h < 640);
    if (window.scrollY !== 0 && !keyboard) window.scrollTo(0, 0);
  }

  update();
  if (vv) {
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
  }
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', () => setTimeout(update, 250));
  return update;
}
