/* maCros — "Add to Home Screen" help. Shown on the sign-in screen and the Dashboard when maCros
 * is open in a phone's browser instead of from its home-screen icon. */
(function () {
  'use strict';
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  let promptEvt = null;
  // Android Chrome offers its own install dialog; keep it for the Install button
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); promptEvt = e; });
  window.addEventListener('appinstalled', () => { promptEvt = null; });

  const SHARE = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style="vertical-align:-3px"><path fill="currentColor" d="M12 2.6 7.3 7.3a1 1 0 0 0 1.4 1.4L11 6.4V15a1 1 0 1 0 2 0V6.4l2.3 2.3a1 1 0 0 0 1.4-1.4L12 2.6ZM6 10a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1a1 1 0 1 0 0 2h1v8H6v-8h1a1 1 0 1 0 0-2H6Z"/></svg>';
  const list = items => `<ol class="steps">${items.map((t, i) => `<li><b class="n">${i + 1}</b><span>${t}</span></li>`).join('')}</ol>`;

  window.MacrosInstall = {
    // true when opened in a phone's browser rather than from the home-screen icon
    needed() {
      const standalone = navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
      return !standalone && (ios || android);
    },
    canPrompt: () => !!promptEvt,
    async prompt() {
      if (!promptEvt) return false;
      const e = promptEvt; promptEvt = null;
      e.prompt();
      const r = await e.userChoice.catch(() => null);
      return !!(r && r.outcome === 'accepted');
    },
    steps() {
      if (ios && /CriOS|FxiOS|EdgiOS/.test(ua)) return list(['Open this page in <b>Safari</b> (copy the link and paste it there).', `Tap the <b>Share</b> button ${SHARE} at the bottom.`, 'Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.', 'Open maCros from the new icon on your home screen.']);
      if (ios) return list([`Tap the <b>Share</b> button ${SHARE} (at the bottom of Safari, or next to the address bar).`, 'Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.', 'Open maCros from the new icon on your home screen.']);
      return list(['Tap the <b>⋮</b> menu at the top right of Chrome.', 'Tap <b>Add to Home screen</b> (or <b>Install app</b>), then <b>Install</b> or <b>Add</b>.', 'Open maCros from the new icon on your home screen.']);
    },
    // iPhone home-screen apps keep their own sign-in, separate from Safari
    note: () => (ios ? 'On iPhone, the home-screen app asks you to sign in once more. Your data is already saved to your account.' : ''),
  };
})();
