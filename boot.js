/* maCros start-up: Terms gate, sign-in, and syncing each account's data with Firestore.
 * Without a Firebase config (firebase-config.js) the app runs in local-only mode. */
const TERMS_VERSION = '2026-10-16';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gate = $('#gate'), appEl = $('#app');
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
};
// key-order-independent JSON, so cloud copies compare equal to local ones
const stable = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, key) => (o[key] = x[key], o), {}) : x));

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});

function showGate(html) { appEl.hidden = true; gate.innerHTML = html; gate.hidden = false; window.scrollTo(0, 0); }
function hideGate() { gate.hidden = true; gate.innerHTML = ''; appEl.hidden = false; }
const brand = `<div class="gate-brand"><img src="icon.svg" alt="" width="64" height="64"><h1>maCros</h1><p>Type or say what you ate. Get the exact macros.</p></div>`;
const consentBox = id => `<label class="consent"><input type="checkbox" id="${id}"> <span>I'm 18 or older and I agree to the <a href="terms.html" data-legal="terms">Terms &amp; Conditions</a> and <a href="privacy.html" data-legal="privacy">Privacy Policy</a>.</span></label>`;

// Terms and Privacy open in an overlay without leaving the app
gate.addEventListener('click', async e => {
  const a = e.target.closest('[data-legal]'); if (!a) return;
  e.preventDefault();
  const ov = document.createElement('div'); ov.className = 'legal-overlay';
  ov.innerHTML = '<div class="legal-box"><button class="icon-btn legal-close" type="button" aria-label="Close">&times;</button><div class="legal-body">Loading…</div></div>';
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('.legal-close').onclick = close; ov.onclick = ev => { if (ev.target === ov) close(); };
  try {
    const html = await (await fetch(a.getAttribute('href'))).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    ov.querySelector('.legal-body').innerHTML = doc.querySelector('main').innerHTML;
  } catch { ov.querySelector('.legal-body').innerHTML = `<p>Couldn't load it. <a href="${a.getAttribute('href')}" target="_blank" rel="noopener">Open in a new tab</a>.</p>`; }
});

// ---------------------------------------------------------------- local-only mode
function startLocal() {
  const accept = () => { ls.set('macros:terms', { version: TERMS_VERSION, at: Date.now() }); hideGate(); window.MacrosApp.start({ prefix: 'macro-id:' }); };
  if ((ls.get('macros:terms', {}) || {}).version === TERMS_VERSION) return accept();
  showGate(`<div class="gate-card">${brand}
    <p class="muted small">Before you start, please read and accept the terms.</p>
    ${consentBox('lAgree')}
    <button class="btn grow wide" id="lGo" type="button" disabled>Continue</button></div>`);
  $('#lAgree').onchange = e => { $('#lGo').disabled = !e.target.checked; };
  $('#lGo').onclick = accept;
}

// ---------------------------------------------------------------- accounts mode
const AUTH_ERRORS = {
  'auth/email-already-in-use': 'That email already has an account. Switch to “Log in”.',
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/weak-password': 'Use at least 8 characters for your password.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'No account with that email. Switch to “Create account”.',
  'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
  'auth/network-request-failed': 'No internet connection. Connect and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before finishing.',
  'auth/cancelled-popup-request': 'Google sign-in was closed before finishing.',
  'auth/unauthorized-domain': 'This website isn’t authorised for sign-in yet (Firebase → Authentication → Settings → Authorized domains).',
  'auth/operation-not-allowed': 'This sign-in method isn’t switched on yet in Firebase → Authentication → Sign-in method.',
  'auth/requires-recent-login': 'For safety, sign out and sign back in, then try again.',
};
const authMsg = e => AUTH_ERRORS[e && e.code] || (e && e.message) || 'Something went wrong. Try again.';

async function startCloud(config) {
  showGate(`<div class="gate-card">${brand}<p class="muted" style="text-align:center">Loading…</p></div>`);
  let cloud;
  try {
    const { initCloud } = await import('./cloud.js');
    cloud = await initCloud(config);
  } catch (err) {
    console.warn(err);
    showGate(`<div class="gate-card">${brand}<p style="text-align:center">Can't reach the sign-in service. Check your internet connection.</p>
      <button class="btn wide" type="button" onclick="location.reload()">Try again</button></div>`);
    return;
  }
  let consentedNow = false, started = false;
  const redirect = await cloud.redirectResult();
  if (redirect && redirect.error) console.warn(redirect.error);
  if (sessionStorage.getItem('macros:consent') === TERMS_VERSION) consentedNow = true;   // came back from a Google redirect

  cloud.onAuth(async user => {
    if (!user) { if (!started) renderAuth(cloud); else location.reload(); return; }
    if (started) return;
    started = true;
    try { await enterAccount(cloud, user, consentedNow); }
    catch (err) {
      console.warn(err); started = false;
      showGate(`<div class="gate-card">${brand}<p style="text-align:center">Couldn't load your account: ${esc(authMsg(err))}</p>
        <button class="btn wide" type="button" onclick="location.reload()">Try again</button>
        <button class="btn ghost wide" type="button" id="soBtn">Sign out</button></div>`);
      $('#soBtn').onclick = () => cloud.signOut();
    }
  });

  function renderAuth() {
    let mode = 'signup';
    const draw = () => {
      showGate(`<div class="gate-card">${brand}${installHint()}
        <div class="seg two" role="tablist">
          <button type="button" data-mode="signup" class="${mode === 'signup' ? 'on' : ''}">Create account</button>
          <button type="button" data-mode="login" class="${mode === 'login' ? 'on' : ''}">Log in</button></div>
        ${consentBox('aAgree')}
        <button class="btn google wide" id="aGoogle" type="button"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Continue with Google</button>
        <div class="or"><span>or with email</span></div>
        <form id="aForm" novalidate>
          <label class="field">Email<input class="input" name="email" type="email" autocomplete="email" inputmode="email" required></label>
          <label class="field" style="margin-top:10px">Password${mode === 'signup' ? '<span class="hint">At least 8 characters</span>' : ''}
            <input class="input" name="pass" type="password" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" required></label>
          <button class="btn wide" type="submit" style="margin-top:14px">${mode === 'signup' ? 'Create account' : 'Log in'}</button>
          ${mode === 'login' ? '<button class="linkish" type="button" id="aForgot">Forgot password?</button>' : ''}
        </form>
        <p class="gate-msg" id="aMsg" role="alert"></p></div>`);
      if ($('#gInstall')) $('#gInstall').onclick = () => window.MacrosInstall.prompt();
      gate.querySelectorAll('[data-mode]').forEach(b => { b.onclick = () => { mode = b.dataset.mode; draw(); }; });
      const msg = t => { $('#aMsg').textContent = t; };
      const agreed = () => { if ($('#aAgree').checked) return true; msg('Please tick the box to confirm you’re 18+ and agree to the Terms and Privacy Policy.'); return false; };
      $('#aGoogle').onclick = async () => {
        if (!agreed()) return;
        consentedNow = true; sessionStorage.setItem('macros:consent', TERMS_VERSION);
        try { await cloud.google(); } catch (e) { msg(authMsg(e)); }
      };
      $('#aForm').onsubmit = async e => {
        e.preventDefault();
        const fd = new FormData(e.target); const email = String(fd.get('email')).trim(); const pass = String(fd.get('pass'));
        if (!agreed()) return;
        if (!email) return msg('Enter your email.');
        if (mode === 'signup' && pass.length < 8) return msg('Use at least 8 characters for your password.');
        consentedNow = true; msg(mode === 'signup' ? 'Creating your account…' : 'Logging in…');
        try { if (mode === 'signup') await cloud.signUp(email, pass); else await cloud.signIn(email, pass); }
        catch (err) { msg(authMsg(err)); }
      };
      if ($('#aForgot')) $('#aForgot').onclick = async () => {
        const email = String(new FormData($('#aForm')).get('email')).trim();
        if (!email) return msg('Type your email above first, then tap “Forgot password?”.');
        try { await cloud.reset(email); msg(`If ${email} has an account, a reset link is on its way. Check your inbox and spam.`); }
        catch (err) { msg(authMsg(err)); }
      };
    };
    draw();
  }
}

// On a phone's browser: suggest adding maCros to the home screen before signing in (iPhone keeps a separate sign-in there)
function installHint() {
  const MI = window.MacrosInstall;
  if (!MI || !MI.needed()) return '';
  return `<details class="install-hint"><summary><b>On your phone? Add maCros to your Home Screen first</b><span>Then open it from the icon and sign in there. <em class="more">Show me how ›</em></span></summary>
    ${MI.canPrompt() ? '<button class="btn wide" id="gInstall" type="button">Install maCros</button><p class="muted small" style="margin:10px 0">Or do it yourself:</p>' : ''}${MI.steps()}</details>`;
}

async function enterAccount(cloud, user, consentedNow) {
  const uid = user.uid, prefix = `macros:u:${uid}:`;
  showGate(`<div class="gate-card">${brand}<p class="muted" style="text-align:center">Loading your data…</p></div>`);
  let profile = await cloud.loadProfile(uid);

  // Terms: recorded at sign-in; returning users re-accept when the terms change
  if (!(profile && profile.terms && profile.terms.version === TERMS_VERSION)) {
    if (!consentedNow) await askTerms(profile && profile.terms ? 'Our Terms or Privacy Policy changed. Please review and accept to continue.' : 'Please review and accept to continue.', cloud);
    const terms = { version: TERMS_VERSION, acceptedAt: Date.now(), adult: true };
    await cloud.saveProfile(uid, { terms, email: user.email || '', createdAt: (profile && profile.createdAt) || Date.now() });
    profile = Object.assign({}, profile, { terms });
  }
  sessionStorage.removeItem('macros:consent');

  // Seed this device's copy from the cloud
  let days = await cloud.loadDays(uid);
  days.sort((a, b) => a.n - b.n || a.start - b.start);
  for (const k of ['settings', 'custom', 'recent']) if (profile[k] !== undefined) ls.set(prefix + k, profile[k]);
  if (days.length) ls.set(prefix + 'days', days);

  // First sign-in on a device that already has data from before accounts: offer to bring it in
  const legacyDays = ls.get('macro-id:days', []), legacyCustom = ls.get('macro-id:custom', []);
  const legacyHasData = (legacyDays || []).some(d => d.entries && d.entries.length) || (legacyCustom || []).length;
  if (!days.length && !profile.settings && legacyHasData && ls.get('macros:legacyImported', null) !== uid) {
    const n = (legacyDays || []).filter(d => d.entries && d.entries.length).length;
    if (confirm(`This device has data from before you had an account (${n} day${n === 1 ? '' : 's'}, ${(legacyCustom || []).length} own foods/recipes). Move it into your account?`)) {
      for (const k of ['settings', 'custom', 'recent', 'days']) { const v = ls.get('macro-id:' + k, null); if (v != null) ls.set(prefix + k, v); }
    }
    ls.set('macros:legacyImported', uid);
  }

  // Sync: every local save is pushed (Firestore queues it while offline)
  const pushed = new Map(days.map(d => [d.id, stable(d)]));
  let pendingDays = null, daysDirty = false, pendingProfile = {}, tD, tP, warned = false;
  let handle = null, stopWatch = () => {};
  const fail = err => { console.warn(err); if (!warned && handle) { warned = true; handle.toast('Couldn’t sync to your account. Your changes are kept on this device.'); } };
  const flushDays = () => {
    daysDirty = false;
    const ids = new Set();
    for (const d of pendingDays || []) {
      ids.add(d.id); const h = stable(d);
      if (pushed.get(d.id) !== h) { pushed.set(d.id, h); cloud.saveDay(uid, d).catch(fail); }
    }
    for (const id of [...pushed.keys()]) if (!ids.has(id)) { pushed.delete(id); cloud.deleteDay(uid, id).catch(fail); }
  };
  const flushProfile = () => { const data = pendingProfile; pendingProfile = {}; cloud.saveProfile(uid, data).catch(fail); };
  const onSave = (k, v) => {
    if (k === 'days') { pendingDays = v; daysDirty = true; clearTimeout(tD); tD = setTimeout(flushDays, 700); }
    else if (k === 'settings' || k === 'custom' || k === 'recent') { pendingProfile[k] = v; clearTimeout(tP); tP = setTimeout(flushProfile, 700); }
  };
  window.addEventListener('pagehide', () => { if (daysDirty) flushDays(); if (Object.keys(pendingProfile).length) flushProfile(); });

  const account = {
    email: user.email || '', name: user.displayName || '', provider: cloud.provider(),
    signOut: async () => { if (daysDirty) flushDays(); if (Object.keys(pendingProfile).length) flushProfile(); await cloud.signOut(); location.reload(); },
    deleteAccount: async password => {
      try { await cloud.reauth(password); } catch (e) { throw new Error(authMsg(e)); }
      stopWatch();
      try { await cloud.deleteEverything(uid); } catch (e) { throw new Error(authMsg(e)); }
      Object.keys(localStorage).filter(k => k.startsWith(prefix)).forEach(k => localStorage.removeItem(k));
      alert('Your account and all its data have been deleted.');
      location.reload();
    },
  };

  hideGate();
  handle = window.MacrosApp.start({ prefix, onSave, account });

  // Live updates from your other devices
  stopWatch = cloud.watch(uid, prof => {
    let changed = false;
    for (const k of ['settings', 'custom', 'recent']) {
      if (prof[k] === undefined || pendingProfile[k] !== undefined) continue;
      if (stable(prof[k]) !== stable(ls.get(prefix + k, null))) { ls.set(prefix + k, prof[k]); changed = true; }
    }
    if (changed) handle.reload();
  }, list => {
    if (!list.length || daysDirty) return;   // nothing in the cloud yet, or a local change is about to be sent
    list.sort((a, b) => a.n - b.n || a.start - b.start);
    if (stable(list) === stable(ls.get(prefix + 'days', []))) return;
    ls.set(prefix + 'days', list);
    pushed.clear(); list.forEach(d => pushed.set(d.id, stable(d)));
    handle.reload();
  });
}

function askTerms(message, cloud) {
  return new Promise(resolve => {
    showGate(`<div class="gate-card">${brand}<p class="muted small">${esc(message)}</p>${consentBox('tAgree')}
      <button class="btn wide" id="tGo" type="button" disabled>Accept and continue</button>
      <button class="btn ghost wide" id="tOut" type="button">Sign out</button></div>`);
    $('#tAgree').onchange = e => { $('#tGo').disabled = !e.target.checked; };
    $('#tGo').onclick = () => resolve();
    $('#tOut').onclick = () => cloud.signOut();
  });
}

const cfg = window.MACROS_FIREBASE;
if (cfg && cfg.apiKey && cfg.projectId) startCloud(cfg); else startLocal();
