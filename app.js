/* maCros — UI. boot.js calls MacrosApp.start() after the Terms gate / sign-in.
 * ctx.prefix namespaces this device's copy per account; ctx.onSave pushes each change to the cloud. */
window.MacrosApp = { start(ctx) {
  'use strict';
  ctx = ctx || {};
  const E = window.MacroEngine;
  const PREFIX = ctx.prefix || 'macro-id:';
  const acct = ctx.account || null;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n, d = 1) => { const v = Math.round((n || 0) * 10 ** d) / 10 ** d; return v.toLocaleString(undefined, { maximumFractionDigits: d }); };
  const k0 = n => Math.round(n || 0).toLocaleString();
  const r1 = n => Math.round((n || 0) * 10) / 10;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------- Storage ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(PREFIX + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) {
      try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch { toast('Could not save — browser storage is full or blocked.'); }
      if (ctx.onSave) ctx.onSave(k, v);
    },
  };
  // Placeholder targets until the person finishes setup (setup.js works out their own).
  const DEFAULTS = { targets: { kcal: 2000, p: 100, c: 250, f: 56, fib: 28 }, voiceLang: 'en-PH', theme: 'light', lastMeal: 'Breakfast', pill: 'eaten' };
  const OLD_DEFAULT_TARGETS = { kcal: 2000, p: 140, c: 200, f: 65, fib: 30 };
  function readSettings() {
    const st = Object.assign({}, DEFAULTS, store.get('settings', {}));
    if (!st.targets || JSON.stringify(st.targets) === JSON.stringify(OLD_DEFAULT_TARGETS)) st.targets = { ...DEFAULTS.targets };
    st.targets = Object.assign({}, DEFAULTS.targets, st.targets);
    if (!st.lightV2) { if (st.theme === 'auto') st.theme = 'light'; st.lightV2 = true; }   // the lighter palette became the default
    delete st.dayStart;
    return st;
  }
  let settings = readSettings();
  let custom = store.get('custom', []);
  let recent = store.get('recent', []);
  let days = loadDays();
  const saveSettings = () => store.set('settings', settings);
  const saveDays = () => store.set('days', days);
  const saveCustom = () => { store.set('custom', custom); E.setCustom(custom); };
  E.setCustom(custom);
  applyTheme();
  saveSettings();

  // Days are switched by hand ("Start Day 2"), never by the clock.
  function newDay(n) { return { id: uid(), n, start: Date.now(), entries: [] }; }
  function daysFromDateLog(old) {
    const out = [];
    Object.keys(old || {}).sort().forEach(k => {
      const entries = old[k] || [];
      if (entries.length) out.push({ id: uid(), n: out.length + 1, start: entries[0].t || Date.parse(k) || Date.now(), entries });
    });
    return out;
  }
  function loadDays() {
    let d = store.get('days', null);
    if (!Array.isArray(d) || !d.length) {
      d = daysFromDateLog(store.get('log', null));   // older versions logged by calendar date
      if (!d.length) d = [newDay(1)];
      store.set('days', d);
    }
    return d;
  }
  const curDay = () => days[days.length - 1];

  const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
  const MACROS = [
    { k: 'p', label: 'Protein', cls: 'p', kcalPerG: 4 },
    { k: 'c', label: 'Carbs', cls: 'c', kcalPerG: 4 },
    { k: 'f', label: 'Fat', cls: 'f', kcalPerG: 9 },
    { k: 'fib', label: 'Fiber', cls: 'fib' },
  ];
  // Meal follows the clock (or the meal you tapped "+ Add" on from the Dashboard)
  let pendingMeal = null;
  const mealByTime = () => { const h = new Date().getHours(); return h < 10 ? 'Breakfast' : h < 14 ? 'Lunch' : h < 17 ? 'Snacks' : h < 21 ? 'Dinner' : 'Snacks'; };
  const defaultMeal = () => pendingMeal || mealByTime();
  const when = ts => new Date(ts).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  // ---------- Toast ----------
  let toastT;
  function toast(msg, action) {
    const t = $('#toast');
    t.innerHTML = esc(msg) + (action ? ` <button type="button">${esc(action.label)}</button>` : '');
    if (action) $('button', t).onclick = () => { action.run(); t.classList.remove('show'); };
    t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), action ? 5000 : 2600);
  }

  // ---------- Shared bits ----------
  const tag = f => f.sugg || f.custom ? badge(f) : '';
  const badge = f => `<span class="badge ${f.sugg ? 'E' : f.src}" title="Source: ${esc(f.sugg ? 'Recipe estimate' : E.SOURCES[f.src])}">${esc(f.sugg ? 'Estimate' : E.SOURCES[f.src])}</span>`;
  function macroTiles(m, showPct) {
    const kc = (m.p * 4 + m.c * 4 + m.f * 9) || 1;
    return `<div class="macro-grid">${MACROS.map(x => `
      <div class="mtile"><div class="lab"><i class="dot-${x.cls}"></i>${x.label}</div>
        <div class="val">${fmt(m[x.k])}<small>g</small></div>
        ${showPct ? `<div class="sub">${x.kcalPerG ? Math.round(m[x.k] * x.kcalPerG / kc * 100) + '% of kcal' : 'counts in carbs'}</div>` : ''}
      </div>`).join('')}</div>`;
  }
  function splitBar(m) {
    const kc = m.p * 4 + m.c * 4 + m.f * 9;
    if (!kc) return '';
    return `<div class="split" aria-hidden="true">
      <span class="dot-p" style="width:${m.p * 4 / kc * 100}%"></span><span class="dot-c" style="width:${m.c * 4 / kc * 100}%"></span><span class="dot-f" style="width:${m.f * 9 / kc * 100}%"></span></div>`;
  }
  // Macro values as small bordered chips in each macro's colour
  const MSHORT = { p: 'P', c: 'C', f: 'F', fib: 'Fib' };
  const mchips = (m, long) => `<span class="mchips">${MACROS.map(x => `<span class="mchip ${x.cls}">${long ? x.label : MSHORT[x.k]} <b>${fmt(m[x.k])}</b>${long ? ' g' : ''}</span>`).join('')}</span>`;

  // "Reminder" link at the bottom of a page; tapping it shows that page's notes
  const reminderBtn = page => `<div class="reminder-row"><button class="reminder-link" type="button" data-reminder="${page}"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 8a1 1 0 0 0-1 1v5a1 1 0 1 0 2 0v-5a1 1 0 0 0-1-1Zm0-4a1.25 1.25 0 1 0 0 2.5A1.25 1.25 0 0 0 12 6Z"/></svg>Reminder</button></div>`;
  function openReminder(page) {
    const verified = E.all().filter(f => !f.sugg).length;
    const body = {
      day: `<ul class="legend-list"><li>Days only change when you tap <b>Start Day ${curDay().n + 1}</b>, never at midnight.</li>
          <li>Tap the calories at the top right to switch between what you’ve eaten and what’s left.</li>
          <li>You can go back to past days with the arrows and still edit them.</li>
          <li>Tap <b>+</b> next to a meal to add food straight to it.</li>
          <li>Your targets come from your setup and current phase. Change them in Menu → Goals.</li>
          <li>Tap the note icon next to a meal to write down how it went.</li>
          <li>Swipe left, or tap <b>This week</b>, to see Monday to Sunday.</li></ul>`,
      add: `<ol class="steps">
          <li><b class="n">1</b><div><b>Type or tap the mic</b> and say what you ate, with amounts: <span class="muted">“150 grams lean ground pork and one cup of rice”</span>, or by calories: <span class="muted">“532 calories of chicken nuggets”</span>. English, Tagalog or Taglish all work.</div></li>
          <li><b class="n">2</b><div><b>Check the matches.</b> Fix any amount, switch between cooked and raw, or pick a different food. No amount? It assumes 1 normal serving and tells you.</div></li>
          <li><b class="n">3</b><div><b>Scan a barcode</b> on packaged food, or use <b>Quick add</b> to type calories and macros yourself.</div></li>
          <li><b class="n">4</b><div><b>Add to your day</b> for a running total. Made your own sauce? Type its ingredients and tap <b>Save as recipe</b>.</div></li>
        </ol>
        <p class="muted small" style="margin:14px 0 0">Weights are <b>cooked, as eaten</b> unless you pick raw. Calculations use only USDA, FNRI and label values (${verified} foods). Recipe estimates are marked <b>Estimate</b> and are only used when you pick one.</p>
        <h3 class="section-title">Browse foods</h3>
        <ul class="legend-list"><li>Tap a category to open it, or <b>Protein</b>, <b>Carbs</b>, <b>Fat</b> or <b>Fiber</b> to see the best sources first.</li>
          <li>Foods marked <b>Estimate</b> are recipe estimates with no lab value. Typing never picks them on its own; tap one to use it on purpose.</li>
          <li>Tap a food to see its details, where it comes from (USDA, FNRI or a label), and to add it.</li></ul>`,
    }[page];
    openSheet(`${sheetHead('Reminder')}${body}`);
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-reminder]'); if (b) openReminder(b.dataset.reminder); });

  const mealSelect = (id, sel) => `<select class="select" id="${id}" aria-label="Meal">${MEALS.map(m => `<option${m === sel ? ' selected' : ''}>${m}</option>`).join('')}</select>`;
  const unitOptions = (food, unit) => E.unitsFor(food).map(u => `<option value="${u.key}"${u.key === unit ? ' selected' : ''}>${u.key === 'g' ? 'grams' : u.key === 'kcal' ? 'calories (kcal)' : esc(E.unitLabel(u.key, 1)) + ' (' + fmt(u.grams, 0) + ' g)'}</option>`).join('')
    + (unit && !food.units[unit] && unit !== 'g' ? `<option value="${unit}" selected>${esc(E.unitLabel(unit, 1))}</option>` : '');
  const amtLabel = (food, qty, unit, grams) => unit === 'g' ? `${fmt(grams, 0)} g` : unit === 'kcal' ? `${fmt(grams, 0)} g (${k0(qty)} kcal)` : `${E.amountText(food, qty, unit)} · ${fmt(grams, 0)} g`;

  // Log foods into the current day. list: [{food, qty, unit, grams}]
  function logToDay(list, meal) {
    const day = curDay(); const added = []; let kc = 0;
    for (const it of list) {
      const m = E.macros(it.food, it.grams); kc += m.kcal;
      const e = { id: uid(), fid: it.food.id, name: it.food.name, amt: amtLabel(it.food, it.qty, it.unit, it.grams), grams: r1(it.grams), meal, t: Date.now(),
        est: !!it.food.sugg, kcal: r1(m.kcal), p: r1(m.p), c: r1(m.c), f: r1(m.f), fib: r1(m.fib) };
      day.entries.push(e); added.push(e.id);
      recent = [it.food.id, ...recent.filter(x => x !== it.food.id)].slice(0, 12);
    }
    settings.lastMeal = meal; saveSettings(); saveDays(); store.set('recent', recent); updatePill();
    return { added, kc, day };
  }
  function undoLog(day, ids) { day.entries = day.entries.filter(e => !ids.includes(e.id)); saveDays(); updatePill(); if (viewOpen('day')) renderDay(); }

  // ---------- Routing ----------
  // Bottom bar: Today · Add · Menu. Goals, Progress and Settings open from Menu.
  const TABS = ['day', 'add', 'menu', 'goals', 'progress', 'tutorial', 'settings'];
  const OLD_TABS = { today: 'day', identify: 'add', foods: 'add' };
  function route() {
    let tab = location.hash.slice(1); tab = OLD_TABS[tab] || tab;
    if (!TABS.includes(tab)) tab = 'day';
    TABS.forEach(t => { $('#view-' + t).hidden = t !== tab; });
    const navTab = ['goals', 'progress', 'tutorial', 'settings'].includes(tab) ? 'menu' : tab;
    $('#todayPill').style.visibility = tab === 'day' ? 'hidden' : '';
    $$('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === navTab));
    if (tab === 'day') { viewIdx = days.length - 1; showDash(dashPage); }
    if (tab === 'add') { renderFoods(); renderWater(); }
    if (tab === 'tutorial') renderTutorial();
    if (tab === 'menu') renderMenu();
    if (tab === 'goals') renderGoals();
    if (tab === 'progress') renderProgress();
    if (tab === 'settings') renderSettings();
    window.scrollTo(0, 0);
  }
  const viewOpen = t => !$('#view-' + t).hidden;
  window.addEventListener('hashchange', route);
  // Top-right pill: tap to switch between calories eaten and calories left
  function updatePill() {
    const d = curDay(); const tot = E.sumMacros(d.entries); const left = settings.targets.kcal - tot.kcal;
    const pill = $('#todayPill');
    pill.textContent = settings.pill === 'left'
      ? `Day ${d.n} · ${left >= 0 ? k0(left) + ' kcal left' : k0(-left) + ' kcal over'}`
      : `Day ${d.n} · ${k0(tot.kcal)} kcal`;
    pill.classList.toggle('left', settings.pill === 'left');
  }
  $('#todayPill').addEventListener('click', () => { settings.pill = settings.pill === 'left' ? 'eaten' : 'left'; saveSettings(); updatePill(); });

  // ==========================================================
  // IDENTIFY
  // ==========================================================
  const q = $('#q');
  let items = [], parsedMeal = null, typingT;

  q.addEventListener('input', () => { autosize(); clearTimeout(typingT); typingT = setTimeout(identify, 160); });
  q.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addCurrent(); } });
  $('#clearQ').addEventListener('click', () => { q.value = ''; autosize(); identify(); q.focus(); });
  function autosize() {
    q.style.height = '';
    if (q.value) q.style.height = Math.max(q.clientHeight, q.scrollHeight) + 'px';
    $('#clearQ').hidden = !q.value;
  }
  function identify() { const res = E.parse(q.value); items = res.items; parsedMeal = res.meal; renderResults(); }
  function setQuery(text) { q.value = text; autosize(); identify(); }
  function appendQuery(text) { const cur = q.value.trim(); setQuery(cur ? `${cur}, ${text}` : text); }
  const defaultAmountText = f => (f.d === 'g' ? '100g' : `1 ${f.d}`);

  function renderResults() {
    const box = $('#results');
    $('#browse').hidden = !!q.value.trim();
    if (!q.value.trim()) { box.innerHTML = emptyState(); return; }
    if (!items.length) { box.innerHTML = '<p class="muted" style="margin:18px 4px">Keep typing — add the food name.</p>'; return; }
    const foods = items.filter(i => i.kind === 'food');
    let html = '';
    if (foods.length) html += `<div class="card total" id="totalCard">${totalInner()}</div>`;
    html += `<h3 class="section-title">${items.length > 1 ? 'Breakdown' : 'Match'} — check these</h3>`;
    html += items.map(itemCard).join('');
    const last = items[items.length - 1]; const shown = new Set(items.filter(i => i.food).map(i => i.food.id));
    const more = last && last.query ? E.search(last.query, { prefix: true, limit: 12, scope: 'all' }).map(r => r.food).filter(f => !shown.has(f.id)).slice(0, 6) : [];
    if (more.length) html += `<h3 class="section-title">More foods like “${esc(last.query)}”</h3><div class="food-list" id="moreFoods">${more.map(foodRow).join('')}</div>`;
    box.innerHTML = html;
  }
  const currentTotal = () => E.sumMacros(items.filter(i => i.kind === 'food').map(i => E.macros(i.food, i.grams)));
  function totalInner() {
    const m = currentTotal(); const n = items.filter(i => i.kind === 'food').length;
    const est = items.some(i => i.kind === 'food' && i.food.sugg);
    return `<div class="total-top">
        <div><div class="eyebrow">Total · ${n} food${n === 1 ? '' : 's'}</div><div class="kcal-big">${k0(m.kcal)}<span>kcal</span></div></div>
        <button class="icon-btn more-btn" type="button" data-act="more" aria-label="More options">&#8943;</button>
      </div>
      ${macroTiles(m, true)}
      ${splitBar(m)}
      ${est ? '<div class="note">Includes a recipe estimate, so this total is approximate.</div>' : ''}
      <div class="add-row">${mealSelect('mealSel', parsedMeal || defaultMeal())}<button class="btn grow" type="button" data-act="add">Add to Day ${curDay().n}</button></div>`;
  }
  const itemMacrosHtml = m => mchips(m, true);

  // Cooked ⇄ raw twins: foods whose names match apart from the raw/uncooked/cooked/dry word
  let twins = null;
  const baseName = n => n.toLowerCase().replace(/\b(raw|uncooked|cooked|dry)\b/g, ' ').replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim();
  function twinOf(f) {
    if (!twins) {
      twins = new Map(); const groups = {};
      E.all().forEach(x => { if (!x.sugg && !x.parts && !x.custom) (groups[baseName(x.name)] = groups[baseName(x.name)] || []).push(x); });
      Object.values(groups).forEach(list => {
        const raw = list.filter(x => x.raw), cooked = list.filter(x => !x.raw);
        if (raw.length === 1 && cooked.length === 1) { twins.set(raw[0].id, cooked[0]); twins.set(cooked[0].id, raw[0]); }
      });
    }
    return twins.get(f.id);
  }
  const stateToggle = f => twinOf(f) ? `<div class="seg mini state" role="group" aria-label="Cooked or raw">
      <button type="button" class="${f.raw ? '' : 'on'}" data-act="state" data-raw="0">Cooked</button><button type="button" class="${f.raw ? 'on' : ''}" data-act="state" data-raw="1">Raw</button></div>` : '';
  function itemCard(it, i) {
    if (it.kind === 'unknown') {
      const sug = it.fromSugg || [];
      return `<div class="card item unknown" data-i="${i}">
        <div class="item-head"><div><div class="item-name">“${esc(it.query)}” isn't in the calculator</div>
          <div class="muted small">${sug.length ? 'There’s a recipe estimate for it. Tap it to use it on purpose.' : 'Not in the database yet.'}</div></div>
          <button class="remove" type="button" data-act="remove" aria-label="Remove">&times;</button></div>
        ${sug.length ? `<div class="suggest"><span class="muted">Estimates</span>${sug.map(f => `<button class="chip est" type="button" data-act="pick" data-id="${esc(f.id)}">${esc(f.name)} · estimate</button>`).join('')}</div>` : ''}
        ${it.suggestions.length ? `<div class="suggest"><span class="muted">Did you mean</span>${it.suggestions.map(f => `<button class="chip" type="button" data-act="pick" data-id="${esc(f.id)}">${esc(f.name)}</button>`).join('')}</div>` : ''}
        <div class="row-actions"><button class="btn small outline" type="button" data-act="custom">+ Add “${esc(it.query)}” as my food</button></div>
      </div>`;
    }
    const m = E.macros(it.food, it.grams);
    const notes = [];
    if (it.note === 'default') notes.push(`No amount given, so it assumed ${E.amountText(it.food, it.qty, it.unit)}. Change it above.`);
    if (it.note === 'approx') notes.push(`There's no standard “${E.unitLabel(it.unit, 1)}” size for this food, so this is estimated. Switch to grams for accuracy.`);
    if (it.food.sugg && !it.parent) notes.push('Recipe estimate (no lab value). It can be off by ±15–20%.');
    const alts = it.alts && it.alts.length ? `<select class="select alt" aria-label="Pick a different food"><option value="">Not it? Pick another…</option>${it.alts.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}<option value="__search">Search all foods…</option></select>` : `<button class="linkish small-link" type="button" data-act="find">Not it? Search all foods</button>`;
    return `<div class="card item" data-i="${i}">
      <div class="item-head">
        <div class="item-name">${esc(it.food.name)} ${tag(it.food)}${it.parent ? `<span class="parent-tag">${esc(it.parent)}</span>` : ''}</div>
        <div style="display:flex;gap:6px;align-items:flex-start"><div class="item-kcal" data-k="kcal">${k0(m.kcal)} <small>kcal</small></div>
        <button class="remove" type="button" data-act="remove" aria-label="Remove ${esc(it.food.name)}">&times;</button></div>
      </div>
      <div class="item-amount">
        <input class="input qty" type="number" inputmode="decimal" min="0" step="any" value="${Math.round(it.qty * 100) / 100}" aria-label="Amount">
        <select class="select unit" aria-label="Unit">${unitOptions(it.food, it.unit)}</select>
        <span class="grams" data-k="grams">${it.unit === 'g' ? '' : '= ' + fmt(it.grams, 0) + ' g'}</span>
        ${stateToggle(it.food)}
      </div>
      <div class="item-macros" data-k="macros">${itemMacrosHtml(m)}</div>
      <div class="item-foot"><span>You typed “${esc(it.query)}”</span>${alts}</div>
      ${notes.map(n => `<div class="note">${esc(n)}</div>`).join('')}
    </div>`;
  }
  function patchItem(i) {
    const it = items[i]; const card = $(`#results [data-i="${i}"]`); if (!card) return;
    const m = E.macros(it.food, it.grams);
    $('[data-k="kcal"]', card).innerHTML = `${k0(m.kcal)} <small>kcal</small>`;
    $('[data-k="grams"]', card).textContent = it.unit === 'g' ? '' : '= ' + fmt(it.grams, 0) + ' g';
    $('[data-k="macros"]', card).innerHTML = itemMacrosHtml(m);
    const tc = $('#totalCard'); if (tc) { const meal = $('#mealSel').value; tc.innerHTML = totalInner(); $('#mealSel').value = meal; }
  }

  $('#results').addEventListener('input', e => {
    if (!e.target.matches('.qty')) return;
    const i = +e.target.closest('[data-i]').dataset.i; const it = items[i];
    const v = parseFloat(e.target.value); if (!(v >= 0)) return;
    it.qty = v; it.grams = E.gramsFor(it.food, v, it.unit); if (it.note === 'default') it.note = '';
    patchItem(i);
  });
  $('#results').addEventListener('change', e => {
    const card = e.target.closest('[data-i]'); if (!card) return;
    const i = +card.dataset.i; const it = items[i];
    if (e.target.matches('.unit')) {
      const nu = e.target.value;
      if (nu === 'g') it.qty = Math.round(it.grams); else if (nu === 'kcal') it.qty = Math.round(E.macros(it.food, it.grams).kcal); else if (it.unit === 'g' || it.unit === 'kcal') it.qty = 1;
      it.unit = nu; const a = E.amount(it.food, it.qty, nu); it.grams = a.grams; it.note = a.note;
      renderResults();
    }
    if (e.target.matches('.alt')) {
      const id = e.target.value; if (!id) return;
      if (id === '__search') { e.target.value = ''; openPicker(i); return; }
      const f = E.byId(id); const keepUnit = it.unit === 'g' || f.units[it.unit] || E.MASS[it.unit];
      const a = keepUnit ? E.amount(f, it.qty, it.unit) : E.amount(f, Math.round(it.grams), 'g');
      const oldAlts = it.alts.filter(x => x !== f); oldAlts.unshift(it.food);
      Object.assign(it, { food: f, qty: a.qty, unit: a.unit, grams: a.grams, note: a.note, alts: oldAlts });
      renderResults();
    }
  });
  $('#results').addEventListener('click', e => {
    const fr = e.target.closest('#moreFoods [data-id]'); if (fr) return openFood(fr.dataset.id);
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'recent') { const f = E.byId(b.dataset.id); if (f) appendQuery(`${b.dataset.g ? b.dataset.g + 'g' : defaultAmountText(f)} ${f.key}`); return; }
    if (act === 'add') return addCurrent();
    if (act === 'recipe') return openRecipeForm();
    if (act === 'more') return openSheet(`${sheetHead('More options')}
      <div class="action-list"><button type="button" class="action-row" id="moreRecipe"><b>Save as my recipe</b><span>Turn these ingredients into one food, like your own sauce</span></button>
        <button type="button" class="action-row" id="moreClear"><b>Clear the list</b><span>Start over</span></button></div>`) && bindMoreAdd();
    const card = b.closest('[data-i]'); const i = card ? +card.dataset.i : -1; const it = items[i];
    if (act === 'remove') { items.splice(i, 1); if (!items.length) { q.value = ''; autosize(); } renderResults(); }
    if (act === 'state') {
      const wantRaw = b.dataset.raw === '1'; if (!!it.food.raw === wantRaw) return;
      const f = twinOf(it.food); if (!f) return;
      // Same weight, other state: you weighed it raw or you weighed it cooked
      const a = it.unit === 'g' || f.units[it.unit] ? E.amount(f, it.qty, it.unit) : E.amount(f, Math.round(it.grams), 'g');
      Object.assign(it, { food: f, qty: a.qty, unit: a.unit, grams: a.grams, note: a.note });
      renderResults();
    }
    if (act === 'pick') {
      const f = E.byId(b.dataset.id);
      const n = it.unit === 'kcal' && f.parts ? it.qty / (f.comboTotal.kcal || 1) : (it.qty || 1) * (it.mult || 1);
      if (f.parts) items.splice(i, 1, ...E.expandCombo(f, n));
      else {
        const a = E.amount(f, it.qty, it.unit, it.size || 1);
        items[i] = { kind: 'food', food: f, qty: a.qty * (it.mult || 1), unit: a.unit, grams: a.grams * (it.mult || 1), note: a.note, query: it.query, alts: [] };
      }
      renderResults();
    }
    if (act === 'custom') openCustomForm({ name: it.query });
    if (act === 'find') openPicker(i);
  });

  function bindMoreAdd() {
    $('#moreRecipe').onclick = () => { closeSheet(); openRecipeForm(); };
    $('#moreClear').onclick = () => { closeSheet(); q.value = ''; autosize(); identify(); };
  }
  function emptyState() {
    const seen = new Set();
    const rec = myEats().filter(x => E.byId(x.last.fid) && !seen.has(x.last.fid) && seen.add(x.last.fid)).slice(0, 10);
    return `<div class="empty">
      ${rec.length ? `<h3 class="section-title">Recent — tap to add the same amount</h3><div class="chips">${rec.map(x => `<button class="chip" type="button" data-act="recent" data-id="${esc(x.last.fid)}" data-g="${Math.round(x.last.grams)}">${esc(x.last.name)} <span class="muted">· ${fmt(x.last.grams, 0)} g</span></button>`).join('')}</div>`
        : '<p class="muted" style="margin:18px 4px">Foods you add will show up here so you can tap them next time.</p>'}
    </div>`;
  }

  function addCurrent() {
    const foods = items.filter(i => i.kind === 'food');
    if (!foods.length) return toast('Nothing to add yet.');
    const meal = $('#mealSel') ? $('#mealSel').value : defaultMeal();
    const { added, kc, day } = logToDay(foods, meal); pendingMeal = null;
    const backup = q.value;
    q.value = ''; autosize(); identify();
    toast(`Added ${foods.length} to Day ${day.n} · ${meal} · ${k0(kc)} kcal`, { label: 'Undo', run: () => { undoLog(day, added); setQuery(backup); } });
  }

  // ---------- Voice ----------
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, listening = false;
  const mic = $('#mic'), vs = $('#voiceStatus');
  if (!SR) mic.title = 'Voice input needs Chrome, Edge or Safari';
  mic.addEventListener('click', () => {
    if (!SR) { vs.textContent = 'Voice isn’t supported in this browser. Use Chrome, Edge or Safari, or your keyboard’s mic button.'; return; }
    if (listening) { rec.stop(); return; }
    rec = new SR();
    rec.lang = settings.voiceLang || 'en-PH'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
    const base = q.value.trim() ? q.value.trim() + ', ' : '';
    rec.onstart = () => { listening = true; mic.classList.add('listening'); vs.classList.add('on'); vs.textContent = 'Listening… say what you ate, then pause.'; };
    rec.onresult = e => {
      let txt = ''; for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      q.value = base + txt; autosize(); identify();
    };
    rec.onerror = e => {
      const msg = { 'not-allowed': 'Microphone blocked. Allow mic access for this page in your browser settings.',
        'service-not-allowed': 'Microphone blocked. Allow mic access for this page in your browser settings.',
        network: 'Voice needs an internet connection (the browser converts speech to text). Typing works offline.',
        'no-speech': 'Didn’t catch anything. Tap the mic and try again.', 'audio-capture': 'No microphone found.' }[e.error];
      vs.textContent = msg || 'Voice stopped: ' + e.error;
    };
    rec.onend = () => { listening = false; mic.classList.remove('listening'); vs.classList.remove('on'); if (vs.textContent.startsWith('Listening')) vs.textContent = ''; };
    try { rec.start(); } catch (err) { vs.textContent = 'Could not start voice input.'; }
  });

  // ==========================================================
  // MY DAY (manual days)
  // ==========================================================
  let viewIdx = days.length - 1;
  $('#dayPrev').addEventListener('click', () => { if (viewIdx > 0) { viewIdx--; renderDay(); } });
  $('#dayNext').addEventListener('click', () => { if (viewIdx < days.length - 1) { viewIdx++; renderDay(); } });

  function ring(value, target) {
    const r = 52, c = 2 * Math.PI * r, pct = target ? Math.min(value / target, 1) : 0;
    const over = target && value > target;
    return `<div class="ring"><svg viewBox="0 0 120 120" width="100%" height="100%">
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="12"/>
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="${over ? 'var(--danger)' : 'var(--accent-bright)'}" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="${c * pct} ${c}"/></svg>
      <div class="ring-txt"><div><b>${k0(value)}</b><small>of ${k0(target)} kcal</small></div></div></div>`;
  }
  function renderDay() {
    const day = days[viewIdx]; const isCur = viewIdx === days.length - 1;
    $('#dayTitle').textContent = `Day ${day.n}`;
    $('#daySub').textContent = isCur ? `Current day · ${shortDate(day.start)}` : `${when(day.start)} – ${when(days[viewIdx + 1].start)}`;
    $('#dayPrev').disabled = viewIdx === 0; $('#dayNext').disabled = isCur;
    const entries = day.entries;
    const tot = E.sumMacros(entries); const T = settings.targets;
    const left = T.kcal - tot.kcal;
    let html = `<div class="card"><div class="ring-row">${ring(tot.kcal, T.kcal)}<div class="bars">
      ${MACROS.map(x => {
        const pct = T[x.k] ? Math.min(tot[x.k] / T[x.k] * 100, 100) : 0;
        return `<div class="bar-row"><div class="bar-lab"><span>${x.label}</span><span><b>${fmt(tot[x.k], 0)}</b> / ${fmt(T[x.k], 0)} g</span></div>
          <div class="bar"><span class="dot-${x.cls}" style="width:${pct}%"></span></div></div>`;
      }).join('')}
    </div></div>
    <p class="muted small" style="margin:12px 0 0">${entries.length ? (left >= 0 ? `<b>${k0(left)} kcal</b> left to reach your target.` : `<b>${k0(-left)} kcal</b> over your target.`) + ` Protein to go: <b>${fmt(Math.max(T.p - tot.p, 0), 0)} g</b>.` : `Target: ${k0(T.kcal)} kcal · ${fmt(T.p, 0)} g protein${activePhase() ? ` (${esc(activePhase().name)})` : ''}.`}</p></div>`;
    if (isCur) html += '<div class="water" id="waterDash" style="margin-top:12px"></div>';
    // Manual days: if the day began on an earlier date, offer to start the next one (never automatic)
    const stale = isCur && entries.length && dayStart(day.start) < dayStart(Date.now()) && new Date().getHours() >= 4 && settings.nudgeSkip !== day.id;
    if (stale) html = `<div class="card nudge-card"><div><b>New day?</b><span>Day ${day.n} started ${shortDate(day.start)}. Start Day ${day.n + 1} when you’re ready.</span></div>
      <div class="row-actions" style="margin-top:10px"><button class="btn small" type="button" data-act="newday">Start Day ${day.n + 1}</button><button class="btn ghost small" type="button" data-act="nudgeskip">Not yet</button></div></div>` + html;
    if (isCur && settings.setupDone && !(settings.tour && settings.tour.hide)) html = `<div class="card tour-card"><div><b>New here?</b><span>Take the 2-minute tour of everything maCros can do.</span></div>
      <div class="row-actions" style="margin-top:10px"><button class="btn small" type="button" data-act="tour">Start the tour</button><button class="btn ghost small" type="button" data-act="tourhide">Not now</button></div></div>` + html;
    if (isCur && weighDue().due) html = `<a class="due-banner" href="#progress"><span><b>Weigh-in time</b> · log your weight to keep your estimate on track</span><span aria-hidden="true">&#8250;</span></a>` + html;

    const notes = day.notes || {};
    if (!entries.length && !isCur) html += `<div class="card" style="text-align:center;margin-top:12px"><p style="margin:4px 0">Nothing logged on Day ${day.n}.</p></div>`;
    {
      for (const meal of MEALS) {
        const list = entries.filter(e => e.meal === meal); if (!list.length && !notes[meal] && !isCur) continue;
        const mt = E.sumMacros(list);
        html += `<div class="meal-head"><h2>${meal}</h2><span>${list.length ? `${k0(mt.kcal)} kcal · P ${fmt(mt.p, 0)} · C ${fmt(mt.c, 0)} · F ${fmt(mt.f, 0)}` : ''}</span>
            <button class="note-btn${notes[meal] ? ' has' : ''}" type="button" data-act="note" data-meal="${meal}" aria-label="${notes[meal] ? 'View' : 'Add'} ${meal.toLowerCase()} note">${NOTE_ICON}</button>
            ${isCur ? `<button class="note-btn add" type="button" data-act="addmeal" data-meal="${meal}" aria-label="Add food to ${meal.toLowerCase()}">+</button>` : ''}</div>
          ${!list.length && isCur ? `<button class="meal-empty" type="button" data-act="addmeal" data-meal="${meal}">+ Add ${meal.toLowerCase()}</button>` : ''}
          ${notes[meal] ? `<button class="meal-note" type="button" data-act="note" data-meal="${meal}">${esc(notes[meal])}</button>` : ''}
          ${list.length ? `<div class="card">${list.map(e => `<div class="entry" data-id="${esc(e.id)}">
            <div class="e-main"><div class="e-name">${esc(e.name)}${e.est ? ' <span class="badge E">Estimate</span>' : ''}</div><div class="e-sub">${esc(e.amt)}</div>${mchips(e, false)}</div>
            <div class="e-kcal">${k0(e.kcal)}</div>
            <button class="remove" type="button" data-act="del" aria-label="Delete ${esc(e.name)}">&times;</button></div>`).join('')}</div>` : ''}`;
      }
    }
    html += `<div class="today-actions">
      ${isCur ? `<button class="btn outline grow" type="button" data-act="newday">Start Day ${day.n + 1}</button>` : `<button class="btn ghost small" type="button" data-act="gocur">Go to current day (Day ${curDay().n})</button>`}
      ${entries.length ? '<button class="icon-btn more-btn" type="button" data-act="daymore" aria-label="More options">&#8943;</button>' : ''}</div>
      ${reminderBtn('day')}`;
    $('#dayBody').innerHTML = html;
    if (isCur) renderWater($('#waterDash'));
  }
  $('#dayBody').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const day = days[viewIdx];
    if (b.dataset.act === 'del') {
      const id = b.closest('[data-id]').dataset.id;
      const idx = day.entries.findIndex(x => x.id === id); if (idx < 0) return;
      const [gone] = day.entries.splice(idx, 1); saveDays(); updatePill(); renderDay();
      toast(`Removed ${gone.name}`, { label: 'Undo', run: () => { day.entries.splice(idx, 0, gone); saveDays(); updatePill(); renderDay(); } });
    }
    if (b.dataset.act === 'newday') {
      const cur = curDay();
      if (!confirm(`Start Day ${cur.n + 1}? Day ${cur.n} is saved, and you can still view and edit it.`)) return;
      days.push(newDay(cur.n + 1)); settings.lastMeal = 'Breakfast'; saveSettings(); saveDays();
      viewIdx = days.length - 1; updatePill(); renderDay();
      toast(`Day ${cur.n + 1} started`, { label: 'Undo', run: () => { if (curDay().entries.length) return; days.pop(); saveDays(); viewIdx = days.length - 1; updatePill(); renderDay(); } });
    }
    if (b.dataset.act === 'gocur') { viewIdx = days.length - 1; renderDay(); }
    if (b.dataset.act === 'note') openNote(day, b.dataset.meal);
    if (b.dataset.act === 'tour') openTour(0);
    if (b.dataset.act === 'tourhide') { settings.tour = Object.assign({}, settings.tour, { hide: true }); saveSettings(); renderDay(); toast('You can find the tour in Menu → Tutorial'); }
    if (b.dataset.act === 'addmeal') { pendingMeal = b.dataset.meal; location.hash = '#add'; setTimeout(() => q.focus(), 60); }
    if (b.dataset.act === 'nudgeskip') { settings.nudgeSkip = day.id; saveSettings(); renderDay(); }
    if (b.dataset.act === 'daymore') {
      openSheet(`${sheetHead('More options', `Day ${day.n}`)}<div class="action-list"><button type="button" class="action-row" id="copyDayBtn"><b>Copy day summary</b><span>Paste it into a chat or your notes</span></button></div>`);
      $('#copyDayBtn').onclick = () => { closeSheet(); copyDay(day); };
    }
  });
  function copyDay(day) {
    {
      const t = E.sumMacros(day.entries);
      const lines = [`Day ${day.n} (${when(day.start)}): ${k0(t.kcal)} kcal · P ${fmt(t.p, 0)}g · C ${fmt(t.c, 0)}g · F ${fmt(t.f, 0)}g · Fiber ${fmt(t.fib, 0)}g`];
      for (const meal of MEALS) {
        const l = day.entries.filter(x => x.meal === meal); const note = (day.notes || {})[meal]; if (!l.length && !note) continue;
        lines.push('', meal + ':'); l.forEach(x => lines.push(`- ${x.name}, ${x.amt}: ${k0(x.kcal)} kcal, P ${fmt(x.p)} C ${fmt(x.c)} F ${fmt(x.f)}`));
        if (note) lines.push(`Note: ${note}`);
      }
      copyText(lines.join('\n'));
    }
  }
  // Meal notes: how a meal went, what you felt, where you ate
  const NOTE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6 3h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 1.5V9h4.5L14 4.5ZM8 12a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8Zm0 4a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2H8Z"/></svg>';
  function openNote(day, meal) {
    const cur = (day.notes || {})[meal] || '';
    openSheet(`${sheetHead(`${meal} note`, `Day ${day.n}`)}
      <textarea class="input note-text" id="noteText" rows="5" placeholder="How was it? Where did you eat, how did you feel, anything to remember…">${esc(cur)}</textarea>
      <div class="add-row"><button class="btn grow" type="button" id="noteSave">Save note</button>${cur ? '<button class="btn danger" type="button" id="noteDel">Delete</button>' : ''}</div>`);
    const save = txt => {
      day.notes = Object.assign({}, day.notes); if (txt) day.notes[meal] = txt; else delete day.notes[meal];
      saveDays(); closeSheet(); renderDay();
    };
    $('#noteSave').onclick = () => save($('#noteText').value.trim());
    if (cur) $('#noteDel').onclick = () => { if (confirm(`Delete the ${meal.toLowerCase()} note?`)) save(''); };
  }

  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(() => toast('Copied to clipboard'), () => fallbackCopy(t));
    else fallbackCopy(t);
  }
  function fallbackCopy(t) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Copied to clipboard'); } catch { toast('Copy failed'); } ta.remove(); }

  // ==========================================================
  // FOODS: Database · Suggestions · My Eats
  // ==========================================================
  const CATS = ['All', 'My Recipes', 'My Foods', 'Silog Meals', 'Filipino Dishes', 'Rice & Grains', 'Bread & Bakery', 'Noodles & Pasta', 'Chicken', 'Pork', 'Beef', 'Fish & Seafood',
    'Eggs & Tofu', 'Soups', 'Vegetables', 'Root Crops & Beans', 'Fruits', 'Nuts & Spreads', 'Dairy', 'Drinks', 'Snacks & Street Food',
    'Desserts & Kakanin', 'Fast Food', 'Condiments & Fats', 'Supplements'];
  let foodSrc = 'all';
  // "Sources": foods where that macro carries most of the calories (fiber: at least 3 g per 100 g)
  const SRC = [['all', 'All'], ['p', 'Protein'], ['c', 'Carbs'], ['f', 'Fat'], ['fib', 'Fiber']];
  const isSource = (f, k) => !f.parts && f.kcal > 0 && (k === 'p' ? f.p * 4 / f.kcal >= 0.35 && f.p >= 8
    : k === 'c' ? f.c * 4 / f.kcal >= 0.6 && f.c >= 15 : k === 'f' ? f.f * 9 / f.kcal >= 0.6 && f.f >= 10 : f.fib >= 3);
  const openCats = new Set();   // categories opened in the "All" list (all start closed)
  $('#cats').addEventListener('click', e => { const b = e.target.closest('[data-src]'); if (!b) return; foodSrc = b.dataset.src; renderFoods(); });
  $('#addCustomBtn').addEventListener('click', () => openCustomForm({}));
  $('#foodList').addEventListener('click', e => {
    const h = e.target.closest('[data-toggle-cat]');
    if (h) {
      const c = h.dataset.toggleCat; const open = !openCats.has(c);
      if (open) openCats.add(c); else openCats.delete(c);
      h.setAttribute('aria-expanded', open); h.nextElementSibling.hidden = !open;
      return;
    }
    const b = e.target.closest('[data-id]'); if (b) openFood(b.dataset.id);
  });

  function renderFoods() {
    $('#cats').innerHTML = SRC.map(([k, l]) => `<button class="chip src-${k}${k === foodSrc ? ' on' : ''}" type="button" role="tab" aria-selected="${k === foodSrc}" data-src="${k}">${l}</button>`).join('');
    $('#foodsFoot').innerHTML = reminderBtn('add');
    renderFoodList();
  }
  function foodRow(f) {
    const def = f.parts ? { qty: 1, unit: 'plate', grams: f.comboGrams } : E.amount(f, null, null);
    const m = E.macros(f, def.grams);
    const per = f.parts ? `${f.parts.length} parts · per plate` : `per 100 g · ${k0(f.kcal)} kcal`;
    return `<button class="food-row" type="button" data-id="${esc(f.id)}"><div class="fr-main"><div class="fr-name">${esc(f.name)} ${tag(f)}</div><div class="fr-sub">${per}</div>${mchips(f.parts ? m : f, false)}</div>
      <div class="fr-kcal">${k0(m.kcal)}<small>${f.parts ? '1 plate' : esc(E.amountText(f, def.qty, def.unit))}</small></div></button>`;
  }
  // My Eats: every distinct food + amount you've logged, newest first
  function myEats() {
    const map = new Map();
    days.forEach(d => d.entries.forEach(e => {
      const key = `${e.fid}|${Math.round(e.grams)}`;
      const x = map.get(key);
      if (x) { x.count++; if (e.t > x.last.t) x.last = e; } else map.set(key, { key, count: 1, last: e });
    }));
    return [...map.values()].sort((a, b) => b.last.t - a.last.t);
  }
  function renderFoodList() {
    const list = $('#foodList');
    let foods = E.all();
    const srcLabel = foodSrc === 'all' ? '' : SRC.find(x => x[0] === foodSrc)[1].toLowerCase();
    if (foodSrc !== 'all') foods = foods.filter(f => isSource(f, foodSrc)).sort((a, b) => b[foodSrc] - a[foodSrc]);
    $('#foodCount').textContent = srcLabel ? `Best ${srcLabel} sources first (per 100 g)` : '';
    $('#foodCount').hidden = !srcLabel;
    if (foodSrc === 'all') {
      const groups = {}; foods.forEach(f => (groups[f.cat] = groups[f.cat] || []).push(f));
      list.innerHTML = CATS.filter(c => groups[c]).map(c => `<button class="cat-head" type="button" data-toggle-cat="${esc(c)}" aria-expanded="${openCats.has(c)}">
          <span>${esc(c)}</span><span class="cat-count">${groups[c].length}<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M6.3 9.3a1 1 0 0 1 1.4 0L12 13.6l4.3-4.3a1 1 0 1 1 1.4 1.4l-5 5a1 1 0 0 1-1.4 0l-5-5a1 1 0 0 1 0-1.4Z"/></svg></span></button>
        <div class="cat-body"${openCats.has(c) ? '' : ' hidden'}>${groups[c].map(foodRow).join('')}</div>`).join('');
    } else list.innerHTML = foods.map(foodRow).join('');
  }

  // ---------- Sheet ----------
  let lastFocus = null;
  function openSheet(html) {
    lastFocus = document.activeElement;
    const s = $('#sheet'); s.innerHTML = html; s.hidden = false; $('#sheetBackdrop').hidden = false;
    document.body.style.overflow = 'hidden';
    const first = s.querySelector('input, select, button'); if (first) setTimeout(() => first.focus(), 30);
    s.querySelector('[data-close]').onclick = closeSheet;
    return s;
  }
  function closeSheet() { $('#sheet').hidden = true; $('#sheetBackdrop').hidden = true; document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); }
  $('#sheetBackdrop').addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
  const sheetHead = (title, sub) => `<div class="sheet-head"><div><h2 id="sheetTitle">${title}</h2>${sub ? `<p class="muted small">${sub}</p>` : ''}</div><button class="icon-btn" type="button" data-close aria-label="Close">&times;</button></div>`;

  function openFood(id) {
    const f = E.byId(id); if (!f) return;
    if (f.parts) return openCombo(f);
    const def = E.amount(f, null, null);
    const sub = esc(f.cat) + (f.sugg ? ' · estimate, not lab-verified (±15–20%)' : f.src === 'F' ? ' · FNRI Philippine Food Composition Tables' : f.src === 'U' ? ' · USDA FoodData Central' : '');
    const recipe = f.recipe && f.recipe.ingredients ? `<div class="eyebrow" style="margin-top:16px">Ingredients · makes ${fmt(f.recipe.totalG, 0)} g</div><ul class="parts">${f.recipe.ingredients.map(x => `<li><span>${esc(x.name)}</span><span class="muted">${fmt(x.grams, 0)} g</span></li>`).join('')}</ul>` : '';
    openSheet(`${sheetHead(esc(f.name) + ' ' + badge(f), sub)}
      <div class="item-amount"><input class="input qty" id="fdQty" type="number" inputmode="decimal" min="0" step="any" value="${def.qty}" aria-label="Amount">
        <select class="select" id="fdUnit" aria-label="Unit">${unitOptions(f, def.unit)}</select><span class="grams" id="fdGrams"></span></div>
      <div style="margin-top:14px"><div class="eyebrow">For this amount</div><div class="kcal-big" id="fdKcal" style="margin-top:4px"></div><div id="fdTiles"></div></div>
      <table class="per100"><tr><td class="muted" colspan="2" style="text-align:left"><b>Per 100 g</b></td></tr>
        <tr><td>Calories</td><td>${fmt(f.kcal)} kcal</td></tr><tr><td>Protein</td><td>${fmt(f.p)} g</td></tr>
        <tr><td>Carbs (total)</td><td>${fmt(f.c)} g</td></tr><tr><td>Fat</td><td>${fmt(f.f)} g</td></tr><tr><td>Fiber</td><td>${fmt(f.fib)} g</td></tr></table>
      ${recipe}
      <div class="add-row">${mealSelect('fdMeal', defaultMeal())}<button class="btn grow" type="button" id="fdAdd">Add to Day ${curDay().n}</button></div>
      <div class="row-actions"><button class="btn ghost small" type="button" id="fdUse">Add to my list</button>
        ${f.custom ? `<button class="btn ghost small" type="button" id="fdEdit">Edit</button><button class="btn danger small" type="button" id="fdDel">Delete</button>` : ''}</div>`);
    const calc = () => {
      const qty = parseFloat($('#fdQty').value) || 0; const unit = $('#fdUnit').value;
      const g = E.gramsFor(f, qty, unit); const m = E.macros(f, g);
      $('#fdGrams').textContent = unit === 'g' ? '' : '= ' + fmt(g, 0) + ' g';
      $('#fdKcal').innerHTML = `${k0(m.kcal)}<span>kcal</span>`; $('#fdTiles').innerHTML = macroTiles(m, false);
      return { qty, unit, g };
    };
    calc();
    $('#fdQty').addEventListener('input', calc);
    $('#fdUnit').addEventListener('change', () => { const u = $('#fdUnit').value, g0 = E.gramsFor(f, def.qty, def.unit); $('#fdQty').value = u === 'g' ? Math.round(g0) : u === 'kcal' ? Math.round(E.macros(f, g0).kcal) : 1; calc(); });
    $('#fdAdd').onclick = () => {
      const { qty, unit, g } = calc(); if (!g) return toast('Enter an amount first.');
      const meal = $('#fdMeal').value; const { added, kc, day } = logToDay([{ food: f, qty, unit, grams: g }], meal); closeSheet();
      toast(`Added to Day ${day.n} · ${meal} · ${k0(kc)} kcal`, { label: 'Undo', run: () => undoLog(day, added) });
    };
    $('#fdUse').onclick = () => { const { qty, unit } = calc(); closeSheet(); location.hash = '#add'; appendQuery(`${E.amountText(f, qty, unit)} ${f.key}`); };
    if (f.custom) {
      $('#fdEdit').onclick = () => openCustomForm(custom.find(c => c.id === f.id));
      $('#fdDel').onclick = () => {
        if (!confirm(`Delete “${f.name}”? Days you already logged keep their numbers.`)) return;
        custom = custom.filter(c => c.id !== f.id); saveCustom(); closeSheet(); renderFoods(); toast('Deleted');
      };
    }
  }
  // Silog meals: change each part's grams, add extras (e.g. one more hotdog), and log by plates or by grams
  function openCombo(f) {
    const parts = f.parts.map(pt => ({ food: pt.food, base: pt.grams, grams: pt.grams }));
    const plateG = () => parts.reduce((a, pt) => a + pt.grams, 0);
    let mode = 'plate';
    const pieceUnit = food => ['pc', 'piece', 'slice', 'stick'].find(k => food.units[k]);
    const pcs = pt => { const u = pieceUnit(pt.food); return u ? ` · ${fmt(pt.grams / pt.food.units[u], 1)} ${E.unitLabel(u, pt.grams / pt.food.units[u])}` : ''; };
    const extra = pt => { const u = pieceUnit(pt.food); return u ? { g: pt.food.units[u], label: `+1 ${E.unitLabel(u, 1)}` } : { g: pt.base, label: '+ extra' }; };
    openSheet(`${sheetHead(esc(f.name) + ' ' + badge(f), 'Silog meal · change any part, or add an extra' + (f.sugg ? ' · includes estimated parts' : ''))}
      <div class="item-amount"><input class="input qty" id="cbQty" type="number" inputmode="decimal" min="0" step="any" value="1" aria-label="Amount">
        <select class="select" id="cbMode" aria-label="Unit"><option value="plate">plate(s)</option><option value="g">grams (whole plate)</option></select>
        <span class="grams" id="cbInfo"></span></div>
      <div style="margin-top:14px"><div class="kcal-big" id="cbKcal"></div><div id="cbTiles"></div></div>
      <div class="eyebrow" style="margin-top:16px">What's on 1 plate</div>
      <ul class="parts combo-parts" id="cbParts"></ul>
      <div class="add-row">${mealSelect('cbMeal', defaultMeal())}<button class="btn grow" type="button" id="cbAdd">Add to Day ${curDay().n}</button></div>
      <div class="row-actions"><button class="btn ghost small" type="button" id="cbUse">Add to my list to adjust</button></div>`);
    const plates = () => { const v = parseFloat($('#cbQty').value) || 0; return mode === 'g' ? (plateG() ? v / plateG() : 0) : v; };
    const renderParts = () => {
      $('#cbParts').innerHTML = parts.map((pt, i) => `<li data-pi="${i}"><div class="cp-name">${esc(pt.food.name)} ${tag(pt.food)}<small class="muted">${k0(E.macros(pt.food, pt.grams).kcal)} kcal${pcs(pt)}</small></div>
        <div class="cp-amt"><input class="input" type="number" inputmode="decimal" min="0" step="any" value="${Math.round(pt.grams)}" aria-label="Grams of ${esc(pt.food.name)}" data-pg><span class="muted">g</span>
          <button class="btn ghost small" type="button" data-extra title="Add ${fmt(extra(pt).g, 0)} g more ${esc(pt.food.name)}">${esc(extra(pt).label)}</button></div></li>`).join('');
    };
    const calc = () => {
      const n = plates(); const m = E.sumMacros(parts.map(pt => E.macros(pt.food, pt.grams * n)));
      $('#cbKcal').innerHTML = `${k0(m.kcal)}<span>kcal</span>`; $('#cbTiles').innerHTML = macroTiles(m, false);
      $('#cbInfo').textContent = mode === 'g' ? `≈ ${fmt(n, 2)} plate${n === 1 ? '' : 's'}` : `= ${fmt(plateG() * n, 0)} g`;
      parts.forEach((pt, i) => { const li = $(`#cbParts [data-pi="${i}"] small`); if (li) li.textContent = `${k0(E.macros(pt.food, pt.grams).kcal)} kcal${pcs(pt)}`; });
      return n;
    };
    renderParts(); calc();
    $('#cbQty').addEventListener('input', calc);
    $('#cbMode').addEventListener('change', e => { const n = plates(); mode = e.target.value; $('#cbQty').value = mode === 'g' ? Math.round(plateG() * n) : r1(n) || 1; calc(); });
    $('#cbParts').addEventListener('input', e => {
      if (!e.target.matches('[data-pg]')) return;
      const n = plates(); parts[+e.target.closest('[data-pi]').dataset.pi].grams = Math.max(0, parseFloat(e.target.value) || 0);
      if (mode === 'g') $('#cbQty').value = Math.round(plateG() * n);
      calc();
    });
    $('#cbParts').addEventListener('click', e => {
      if (!e.target.closest('[data-extra]')) return;
      const n = plates(); const pt = parts[+e.target.closest('[data-pi]').dataset.pi];
      pt.grams += extra(pt).g; if (mode === 'g') $('#cbQty').value = Math.round(plateG() * n);
      renderParts(); calc();
    });
    const asItems = n => parts.filter(pt => pt.grams > 0).map(pt => ({ kind: 'food', food: pt.food, qty: Math.round(pt.grams * n), unit: 'g', grams: pt.grams * n, note: '', parent: f.name, query: f.name, alts: [] }));
    $('#cbAdd').onclick = () => {
      const n = calc(); if (!n || !plateG()) return toast('Enter an amount first.'); const meal = $('#cbMeal').value;
      const { added, kc, day } = logToDay(asItems(n), meal); closeSheet();
      toast(`Added to Day ${day.n} · ${meal} · ${k0(kc)} kcal`, { label: 'Undo', run: () => undoLog(day, added) });
    };
    $('#cbUse').onclick = () => { const n = calc(); closeSheet(); location.hash = '#add'; items = asItems(n); q.value = `${fmt(n, 2)} ${f.key}`; autosize(); renderResults(); };
  }
  // Swap one matched item for any food, keeping its weight
  function openPicker(i) {
    const it = items[i]; if (!it) return;
    openSheet(`${sheetHead('Pick a food', `Replaces “${esc(it.query)}” and keeps the amount`)}
      <div class="search-box" style="margin-top:0"><input id="pkSearch" type="search" placeholder="Search all foods" autocomplete="off" value="${esc(it.query)}"></div>
      <div class="food-list" id="pkList" style="margin-top:10px"></div>`);
    const list = () => {
      const term = $('#pkSearch').value.trim();
      const found = term ? E.search(term, { prefix: true, limit: 30, scope: 'calc' }).map(r => r.food).filter(f => !f.parts) : [];
      $('#pkList').innerHTML = found.length ? found.map(foodRow).join('') : `<p class="muted" style="padding:14px;margin:0">${term ? 'No matches.' : 'Type a food name.'}</p>`;
    };
    list();
    $('#pkSearch').addEventListener('input', list);
    $('#pkList').addEventListener('click', e => {
      const b = e.target.closest('[data-id]'); if (!b) return;
      const f = E.byId(b.dataset.id); const grams = it.kind === 'food' ? it.grams : null;
      const a = grams ? E.amount(f, Math.round(grams), 'g') : E.amount(f, it.qty, it.unit, it.size || 1);
      items[i] = { kind: 'food', food: f, qty: a.qty, unit: a.unit, grams: a.grams, note: a.note, query: it.query, alts: [] };
      closeSheet(); renderResults();
    });
  }

  // ---------- Quick add: type your own calories and macros ----------
  $('#quickBtn').addEventListener('click', () => openQuickAdd());
  function openQuickAdd() {
    const day = curDay();
    openSheet(`${sheetHead('Quick add', 'Type the numbers yourself, e.g. from a menu or a label.')}
      <form id="qaForm" novalidate>
        <label class="field">Name <span class="hint">Optional</span><input class="input" name="name" placeholder="e.g. Office lunch"></label>
        <div class="form-grid" style="margin-top:12px">
          ${MACROS.map(x => `<label class="field qa-${x.cls}"><span><i class="dot-${x.cls}"></i> ${x.label} (g)</span><input class="input" name="${x.k}" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></label>`).join('')}
          <label class="field">Calories<span class="hint">Worked out for you; change it if your label says otherwise</span><input class="input" name="kcal" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></label>
        </div>
        <p class="muted small" id="qaMsg" role="alert" style="min-height:1.2em"></p>
        <div class="add-row">${mealSelect('qaMeal', defaultMeal())}<button class="btn grow" type="submit">Add to Day ${day.n}</button></div>
      </form>`);
    const f = $('#qaForm'); let kcalTyped = false;
    const n = k => Math.max(0, parseFloat(f.elements[k].value) || 0);
    const auto = () => { if (!kcalTyped) f.elements.kcal.value = Math.round(n('p') * 4 + n('c') * 4 + n('f') * 9) || ''; };
    ['p', 'c', 'f'].forEach(k => f.elements[k].addEventListener('input', auto));
    f.elements.kcal.addEventListener('input', () => { kcalTyped = !!f.elements.kcal.value; if (!kcalTyped) auto(); });
    f.addEventListener('submit', ev => {
      ev.preventDefault();
      const kcal = n('kcal') || n('p') * 4 + n('c') * 4 + n('f') * 9;
      if (!kcal && !n('fib')) { $('#qaMsg').textContent = 'Enter at least one number.'; return; }
      const meal = $('#qaMeal').value; const name = String(f.elements.name.value).trim() || 'Quick add';
      const e = { id: uid(), fid: 'quick', name, amt: 'Quick add', grams: 0, meal, t: Date.now(), quick: true, est: false,
        kcal: r1(kcal), p: r1(n('p')), c: r1(n('c')), f: r1(n('f')), fib: r1(n('fib')) };
      day.entries.push(e); settings.lastMeal = meal; pendingMeal = null; saveSettings(); saveDays(); updatePill(); closeSheet();
      toast(`Added ${name} to Day ${day.n} · ${meal} · ${k0(kcal)} kcal`, { label: 'Undo', run: () => undoLog(day, [e.id]) });
    });
  }

  // ---------- Barcode: scan → your saved products → Open Food Facts → type the label once ----------
  $('#scanBtn').addEventListener('click', () => openScanner());
  let scanStop = null;
  const ZXING = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  const loadScript = src => new Promise((ok, fail) => { const el = document.createElement('script'); el.src = src; el.onload = ok; el.onerror = fail; document.head.appendChild(el); });
  function openScanner() {
    openSheet(`${sheetHead('Scan a barcode', 'Point your camera at the barcode on the pack.')}
      <div class="scan-box"><video id="scanVideo" playsinline muted autoplay></video><div class="scan-frame" aria-hidden="true"></div></div>
      <p class="muted small" id="scanMsg" aria-live="polite" style="margin:10px 2px 0">Starting the camera…</p>
      <form id="scanType" class="add-row" novalidate><input class="input" name="code" inputmode="numeric" pattern="[0-9]*" placeholder="Or type the barcode number" style="flex:1" aria-label="Barcode number"><button class="btn" type="submit">Look up</button></form>`);
    const msg = t => { const m = $('#scanMsg'); if (m) m.textContent = t; };
    $('#scanType').addEventListener('submit', ev => { ev.preventDefault(); const c = String(ev.target.code.value).replace(/\D/g, ''); if (c.length >= 6) found(c); else msg('Type the full number under the barcode.'); });
    // Stop the camera whenever the sheet closes
    const watch = new MutationObserver(() => { if ($('#sheet').hidden || !$('#scanVideo')) stopScan(); });
    watch.observe($('#sheet'), { attributes: true, attributeFilter: ['hidden'], childList: true });
    let done = false;
    const found = code => { if (done) return; done = true; watch.disconnect(); stopScan(); lookupBarcode(code); };
    startCamera($('#scanVideo'), found).then(ok => { if (ok) msg('Hold steady. It scans by itself.'); })
      .catch(err => msg(err && err.name === 'NotAllowedError' ? 'Camera blocked. Allow camera access for this site, or type the number below.' : 'Couldn’t start the camera here. Type the number below instead.'));
  }
  function stopScan() { if (scanStop) { const s0 = scanStop; scanStop = null; try { s0(); } catch { /* already stopped */ } } }
  async function startCamera(video, onCode) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nocam');
    const formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
    // Phones with a built-in barcode reader (Android Chrome) use it; others (iPhone) load a small scanner library
    if ('BarcodeDetector' in window && (await window.BarcodeDetector.getSupportedFormats()).includes('ean_13')) {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      video.srcObject = stream; await video.play();
      const det = new window.BarcodeDetector({ formats }); let on = true;
      scanStop = () => { on = false; stream.getTracks().forEach(t => t.stop()); };
      const tick = async () => {
        if (!on) return;
        try { const r = await det.detect(video); if (r.length) return onCode(r[0].rawValue); } catch { /* frame not ready */ }
        setTimeout(tick, 200);
      };
      tick(); return true;
    }
    if (!window.ZXing) await loadScript(ZXING);
    const Z = window.ZXing;
    const hints = new Map([[Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]]]);
    const reader = new Z.BrowserMultiFormatReader(hints);
    scanStop = () => reader.reset();
    await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, res => { if (res) onCode(res.getText()); });
    return true;
  }
  // "Product · Brand", without repeating a brand that's already in the name
  const productName = p => { const n = String(p.product_name || '').trim(), b = String(p.brands || '').split(',')[0].trim();
    return (b && !n.toLowerCase().includes(b.toLowerCase()) ? [n, b].filter(Boolean).join(' · ') : n || b).slice(0, 80); };
  async function lookupBarcode(code) {
    // 1. A product you've saved before
    const mine = custom.find(c => c.barcode === code);
    if (mine) { toast(`Found ${mine.name}`); return openFood(mine.id); }
    openSheet(`${sheetHead('Looking it up…', `Barcode ${esc(code)}`)}<p class="muted">Checking Open Food Facts.</p>`);
    // 2. Open Food Facts (only the barcode number is sent)
    let p = null;
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,nutriments,serving_quantity`);
      const d = await r.json(); if (d && d.status === 1 && d.product) p = d.product;
    } catch { /* offline or blocked */ }
    const nm = p && p.nutriments || {};
    const num = v => { const x = parseFloat(v); return x >= 0 ? Math.round(x * 10) / 10 : ''; };
    const kcal = num(nm['energy-kcal_100g']) || (nm.energy_100g ? num(nm.energy_100g / 4.184) : '');
    const has = p && (kcal !== '' || num(nm.proteins_100g) !== '');
    const sq = p && parseFloat(p.serving_quantity) > 0 ? Math.round(parseFloat(p.serving_quantity)) : 0;
    const pre = { barcode: code, name: p ? productName(p) : '',
      p: has ? num(nm.proteins_100g) : '', c: has ? num(nm.carbohydrates_100g) : '', f: has ? num(nm.fat_100g) : '', fib: has ? num(nm.fiber_100g) : '', kcal: has ? kcal : '' };
    if (sq) { pre.units = { serving: sq }; pre.d = 'serving'; }
    // 3. Save it (check or type the label); next scan finds it instantly
    openCustomForm(pre, {
      title: has ? 'Check and save' : 'Type the label once',
      sub: `Barcode ${esc(code)}`,
      note: has ? 'Found on Open Food Facts. These numbers are added by volunteers, so check them against the label (per 100 g). Once saved, scanning this barcode fills it in instantly.'
        : p ? 'Found the product but not its nutrition facts. Copy them from the label once; maCros remembers this barcode.'
        : 'Not found. Copy the nutrition facts from the label once; maCros remembers this barcode for next time.',
      onSaved: row => { toast(`Saved ${row.name}. Choose how much you had.`); openFood(row.id); },
    });
  }

  // ---------- Recipe builder (your own sauces, marinades, dishes) ----------
  function openRecipeForm() {
    const foods = items.filter(i => i.kind === 'food');
    if (!foods.length) return toast('Type the ingredients first.');
    const sumG = foods.reduce((a, i) => a + i.grams, 0);
    openSheet(`${sheetHead('Save as my recipe', `${foods.length} ingredients · ${fmt(sumG, 0)} g total. Saved once, then just type its name, e.g. “2 tbsp garlic sriracha sauce”.`)}
      <form id="rcForm" novalidate>
        <div class="form-grid" style="grid-template-columns:1fr">
          <label class="field">Recipe name *<input class="input" name="name" required placeholder="e.g. Garlic sriracha sauce"></label>
        </div>
        <div class="form-grid" style="margin-top:12px">
          <label class="field">Makes how many servings?<input class="input" name="servings" type="number" inputmode="decimal" min="0.1" step="any" value="1"></label>
          <label class="field">Final cooked weight (g)<span class="hint">Optional. Weigh it if it reduced while cooking; blank uses ${fmt(sumG, 0)} g</span><input class="input" name="final" type="number" inputmode="decimal" min="0" step="any" placeholder="${fmt(sumG, 0)}"></label>
        </div>
        <label class="field" style="flex-direction:row;align-items:center;gap:8px;margin-top:12px;font-weight:500"><input type="checkbox" name="spoon" checked> Allow tbsp / tsp amounts (for sauces and dressings)</label>
        <ul class="parts">${foods.map(i => `<li><span>${esc(i.food.name)}</span><span class="muted">${fmt(i.grams, 0)} g · ${k0(E.macros(i.food, i.grams).kcal)} kcal</span></li>`).join('')}</ul>
        <p class="muted small" id="rcMsg" style="min-height:1.2em"></p>
        <div class="add-row"><button class="btn grow" type="submit">Save recipe</button></div>
      </form>`);
    $('#rcForm').addEventListener('submit', ev => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const name = String(fd.get('name')).trim(); if (!name) { $('#rcMsg').textContent = 'Give it a name.'; return; }
      const servings = parseFloat(fd.get('servings')) || 1;
      const totalG = parseFloat(fd.get('final')) || sumG;
      const t = E.sumMacros(foods.map(i => E.macros(i.food, i.grams)));
      const k = 100 / totalG;
      const units = { serving: r1(totalG / servings) };
      if (fd.get('spoon')) { units.tbsp = 15; units.tsp = 5; }
      const row = { id: 'rc-' + uid(), src: 'R', name, aliases: [], kcal: r1(t.kcal * k), p: +(t.p * k).toFixed(2), c: +(t.c * k).toFixed(2), f: +(t.f * k).toFixed(2), fib: +(t.fib * k).toFixed(2),
        units, d: 'serving', recipe: { totalG: r1(totalG), servings, ingredients: foods.map(i => ({ name: i.food.name, grams: r1(i.grams) })) } };
      custom.push(row); saveCustom(); closeSheet();
      toast(`Saved “${name}”: ${k0(t.kcal / servings)} kcal per serving`);
    });
  }

  // ---------- Custom food form ----------
  function openCustomForm(pre, opts) {
    pre = pre || {}; opts = opts || {};
    const editing = !!pre.id;
    const servUnit = pre.d && pre.d !== 'g' ? pre.d : '';
    const servG = servUnit && pre.units ? pre.units[servUnit] : '';
    openSheet(`${sheetHead(opts.title || (editing ? 'Edit ' + esc(pre.name) : 'Add my own food'), opts.sub || 'Copy the numbers from a nutrition label or a trusted source.')}
      ${opts.note ? `<div class="note" style="margin:0 0 12px">${opts.note}</div>` : ''}
      <form id="cfForm" novalidate>
        <div class="form-grid" style="grid-template-columns:1fr">
          <label class="field">Food name *<input class="input" name="name" required value="${esc(pre.name || '')}" placeholder="e.g. Mang Tomas lechon sauce"></label>
          <label class="field">Other names <span class="hint">Optional, comma-separated, so search finds it: “mang tomas, lechon sauce”</span>
            <input class="input" name="aliases" value="${esc((pre.aliases || []).join(', '))}"></label>
        </div>
        <div class="form-grid" style="margin-top:12px">
          <label class="field">Numbers are per<select class="select" name="basis"><option value="100">100 g</option><option value="serving">1 serving</option></select></label>
          <label class="field">Serving name<span class="hint">e.g. pc, cup, pack, tbsp</span><input class="input" name="sunit" value="${esc(servUnit)}" placeholder="pc"></label>
          <label class="field">Serving weight (g)<input class="input" name="sgrams" type="number" inputmode="decimal" min="0" step="any" value="${servG || ''}" placeholder="e.g. 45"></label>
        </div>
        <div class="form-grid" style="margin-top:12px">
          <label class="field">Protein (g)<input class="input" name="p" type="number" inputmode="decimal" min="0" step="any" value="${pre.p ?? ''}"></label>
          <label class="field">Carbs (g)<input class="input" name="c" type="number" inputmode="decimal" min="0" step="any" value="${pre.c ?? ''}"></label>
          <label class="field">Fat (g)<input class="input" name="f" type="number" inputmode="decimal" min="0" step="any" value="${pre.f ?? ''}"></label>
          <label class="field">Fiber (g)<input class="input" name="fib" type="number" inputmode="decimal" min="0" step="any" value="${pre.fib ?? ''}"></label>
          <label class="field">Calories<span class="hint">Leave blank to calculate</span><input class="input" name="kcal" type="number" inputmode="decimal" min="0" step="any" value="${pre.kcal ?? ''}"></label>
        </div>
        <p class="muted small" id="cfMsg" style="min-height:1.2em"></p>
        <div class="add-row"><button class="btn grow" type="submit">${editing ? 'Save changes' : 'Save food'}</button></div>
      </form>`);
    $('#cfForm').addEventListener('submit', e => {
      e.preventDefault();
      const fd = new FormData(e.target); const v = k => fd.get(k).toString().trim(); const n = k => parseFloat(v(k)) || 0;
      const name = v('name'); if (!name) { $('#cfMsg').textContent = 'Please enter a name.'; return; }
      const basis = v('basis'); const sg = n('sgrams');
      const sunitRaw = E.norm(v('sunit')).split(' ')[0] || '';
      const sunit = sunitRaw ? (({ pcs: 'pc', piece: 'pc', pieces: 'pc', cups: 'cup', packs: 'pack', sachet: 'pack', tablespoon: 'tbsp', slices: 'slice', scoops: 'scoop' })[sunitRaw] || sunitRaw) : 'serving';
      if (basis === 'serving' && !sg) { $('#cfMsg').textContent = 'Enter the serving weight in grams so it can work out per-100 g values.'; return; }
      const k = basis === 'serving' ? 100 / sg : 1;
      let kcal = n('kcal'); if (!v('kcal')) kcal = n('p') * 4 + n('c') * 4 + n('f') * 9;
      const units = editing && pre.units ? { ...pre.units } : {}; let d = editing ? pre.d : 'g';
      if (sg) { if (servUnit && servUnit !== sunit) delete units[servUnit]; units[sunit] = sg; d = sunit; }
      const row = Object.assign({}, pre, { id: pre.id || 'my-' + uid(), name, aliases: v('aliases').split(',').map(x => x.trim()).filter(Boolean),
        kcal: +(kcal * k).toFixed(1), p: +(n('p') * k).toFixed(2), c: +(n('c') * k).toFixed(2), f: +(n('f') * k).toFixed(2), fib: +(n('fib') * k).toFixed(2), units, d });
      if (editing) custom = custom.map(c => c.id === row.id ? row : c); else custom.push(row);
      saveCustom(); closeSheet();
      if (opts.onSaved) return opts.onSaved(row);
      toast(editing ? 'Saved' : `“${name}” added to My Foods`);
      if (viewOpen('add')) { renderFoods(); identify(); }
    });
  }

  // ==========================================================
  // SETTINGS
  // ==========================================================
  function renderSettings() {
    $('#settingsBody').innerHTML = `
      ${acct ? `<div class="card settings-card"><h2>Account</h2>
        <p class="muted small" style="margin:0">Signed in as <b>${esc(acct.email)}</b>${acct.provider === 'google.com' ? ' with Google' : ''}. Your days, recipes and foods are saved to your account and sync across your devices.</p>
        <div class="row-actions"><button class="btn ghost small" type="button" id="signOutBtn">Sign out</button></div></div>` : ''}
      <div class="card settings-card"><h2>Preferences</h2>
        <div class="form-grid">
          <label class="field">Voice language<span class="hint">What the mic listens for</span><select class="select" id="setVoice">
            ${[['en-PH', 'English (Philippines)'], ['fil-PH', 'Filipino / Tagalog'], ['en-US', 'English (US)']].map(([v, l]) => `<option value="${v}"${v === settings.voiceLang ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field">Water goal<span class="hint">Glasses a day</span><input class="input" id="setWaterGoal" type="number" inputmode="numeric" min="1" max="30" value="${waterCfg().goal}"></label>
          <label class="field">Glass size<span class="hint">ml per glass</span><input class="input" id="setWaterMl" type="number" inputmode="numeric" min="50" max="1000" step="10" value="${waterCfg().ml}"></label>
          <label class="field">Appearance<span class="hint">Light or dark</span><select class="select" id="setTheme">${[['auto', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<option value="${v}"${v === settings.theme ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
        <p class="muted small" style="margin:10px 0 0">Days are manual: on <b>Today</b>, tap “Start Day ${curDay().n + 1}” whenever your day ends.</p>
      </div>
      <div class="card settings-card"><h2>${acct ? 'Backup' : 'Backup &amp; move to another device'}</h2>
        <p class="muted small" style="margin:0">${acct ? 'Everything is already saved to your account. You can still download a copy for yourself, or restore one (this replaces your current data).' : 'Your days, recipes and own foods live in this browser only, and your phone and PC each keep their own. Download a backup file and open it on the other device with <b>Restore</b>.'}</p>
        <div class="row-actions"><button class="btn small" type="button" id="exportBtn">Download backup</button>
          <label class="btn small outline" style="cursor:pointer">Restore backup<input type="file" id="importFile" accept="application/json,.json" hidden></label></div>
        <p class="muted small" style="margin:12px 0 0"><b>Import foods</b> adds the foods from a file (or another backup) to My Foods. Nothing else changes, and foods you already have are skipped.</p>
        <div class="row-actions"><label class="btn small outline" style="cursor:pointer">Import foods<input type="file" id="importFoodsFile" accept="application/json,.json" hidden></label></div>
      </div>
      <div class="card settings-card"><h2>About the numbers</h2>
        <ul class="legend-list">
          <li><span class="badge U">USDA</span> USDA FoodData Central lab values.</li>
          <li><span class="badge F">FNRI</span> FNRI Philippine Food Composition Tables (PhilFCT), measured from Philippine foods.</li>
          <li><span class="badge L">Label</span> Manufacturer label (USDA Branded Foods). Check your exact pack.</li>
          <li><span class="badge E">Estimate</span> Recipe estimates with no lab value. Typing never picks them on its own; they’re used only when you choose one.</li>
          <li><span class="badge R">My recipe</span> <span class="badge C">My food</span> Things you saved yourself.</li>
          <li>All weights are <b>cooked, as eaten</b> unless the name says raw, dry or uncooked. Carbs are total carbs, which include fiber.</li>
        </ul>
        <p class="muted small" style="margin:12px 0 0">${E.all().filter(f => !f.sugg).length} verified foods · ${E.all().filter(f => f.sugg).length} suggestions · ${custom.length} of your own · ${days.length} day${days.length === 1 ? '' : 's'} logged</p>
      </div>
      <div class="card settings-card"><h2>Legal</h2>
        <div class="row-actions" style="margin-top:0"><a class="btn ghost small" href="terms.html" target="_blank" rel="noopener">Terms &amp; Conditions</a><a class="btn ghost small" href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a></div>
        <p class="muted small" style="margin:10px 0 0">maCros gives estimates for information only. It isn't medical or dietary advice.</p>
      </div>
      <div class="card settings-card"><h2>Danger zone</h2>
        <div class="row-actions" style="margin-top:0">${acct ? '<button class="btn danger small" type="button" id="deleteAcctBtn">Delete my account</button>' : '<button class="btn danger small" type="button" id="resetBtn">Erase all my data</button>'}</div>
      </div>`;
    if (acct) {
      $('#signOutBtn').onclick = () => { if (confirm('Sign out of maCros on this device?')) acct.signOut(); };
      $('#deleteAcctBtn').onclick = openDeleteAccount;
    }
    $('#setVoice').onchange = e => { settings.voiceLang = e.target.value; saveSettings(); };
    $('#setWaterGoal').onchange = e => { const v = Math.round(+e.target.value); if (v >= 1 && v <= 30) { settings.water = Object.assign(waterCfg(), { goal: v }); saveSettings(); toast(`Water goal: ${v} glasses`); } };
    $('#setWaterMl').onchange = e => { const v = Math.round(+e.target.value); if (v >= 50 && v <= 1000) { settings.water = Object.assign(waterCfg(), { ml: v }); saveSettings(); toast(`Glass size: ${v} ml`); } };
    $('#setTheme').onchange = e => { settings.theme = e.target.value; saveSettings(); applyTheme(); };
    $('#exportBtn').onclick = exportData;
    $('#importFile').onchange = e => { const f = e.target.files[0]; if (f) importData(f); e.target.value = ''; };
    $('#importFoodsFile').onchange = e => { const f = e.target.files[0]; if (f) importFoods(f); e.target.value = ''; };
    if (!acct) $('#resetBtn').onclick = () => {
      if (!confirm('Erase all your days, recipes, own foods and settings on this device? Download a backup first if you might want them.')) return;
      ['settings', 'custom', 'log', 'days', 'recent'].forEach(k => { try { localStorage.removeItem(PREFIX + k); } catch { /* ignore */ } });
      location.reload();
    };
  }
  function applyTheme() { document.documentElement.dataset.theme = settings.theme || 'light'; }
  function exportData() {
    const data = { app: 'macro-id', version: 2, exportedAt: new Date().toISOString(), settings, custom, days, recent };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `macros-backup-day${curDay().n}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup downloaded');
  }
  function importData(file) {
    const r = new FileReader();
    r.onload = () => {
      let d; try { d = JSON.parse(r.result); } catch { return toast('That file isn’t a valid backup.'); }
      if (!d || d.app !== 'macro-id') return toast('That file isn’t a maCros backup.');
      if (!confirm(`Restore this backup from ${new Date(d.exportedAt).toLocaleString()}? It replaces the data on this device.`)) return;
      settings = Object.assign({}, DEFAULTS, d.settings || {}); settings.targets = Object.assign({}, DEFAULTS.targets, settings.targets || {}); delete settings.dayStart;
      custom = Array.isArray(d.custom) ? d.custom : [];
      days = Array.isArray(d.days) && d.days.length ? d.days : daysFromDateLog(d.log);
      if (!days.length) days = [newDay(1)];
      recent = Array.isArray(d.recent) ? d.recent : [];
      viewIdx = days.length - 1;
      saveSettings(); saveCustom(); saveDays(); store.set('recent', recent); applyTheme(); updatePill(); renderSettings();
      toast('Backup restored');
    };
    r.readAsText(file);
  }
  // Adds foods to My Foods without touching anything else. Takes { app, foods: [...] } or a full backup's custom list.
  function importFoods(file) {
    const r = new FileReader();
    r.onerror = () => toast('Couldn’t read that file. Try picking it again.');
    r.onload = () => { try { importFoodsFrom(r.result); } catch (err) { console.error(err); toast('Couldn’t import those foods: ' + (err && err.message || err)); } };
    r.readAsText(file);
  }
  function importFoodsFrom(text) {
    let d; try { d = JSON.parse(text); } catch { return toast('That file isn’t a valid foods file.'); }
    const rows = d && d.app === 'macro-id' ? (Array.isArray(d.foods) ? d.foods : Array.isArray(d.custom) ? d.custom : null) : null;
    if (!rows) return toast('That file isn’t a maCros foods file.');
    const num = v => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0);
    if (!Array.isArray(custom)) custom = [];
    const have = new Set(custom.map(c => String(c && c.name || '').trim().toLowerCase()));
    const add = [];
    rows.forEach(x => {
      const name = x && typeof x.name === 'string' ? x.name.trim() : '';
      if (!name || have.has(name.toLowerCase())) return;
      const units = {}; Object.entries(x.units || {}).forEach(([u, g]) => { if (typeof g === 'number' && g > 0) units[u] = g; });
      const row = { id: (x.src === 'R' ? 'rc-' : 'my-') + uid(), name, aliases: Array.isArray(x.aliases) ? x.aliases.filter(a => typeof a === 'string') : [],
        kcal: num(x.kcal), p: num(x.p), c: num(x.c), f: num(x.f), fib: num(x.fib), units, d: units[x.d] ? x.d : 'g' };
      if (x.src === 'R') row.src = 'R';
      if (x.recipe) row.recipe = x.recipe;
      if (x.barcode) row.barcode = String(x.barcode);
      have.add(name.toLowerCase()); add.push(row);
    });
    const skipped = rows.length - add.length;
    if (!add.length) return toast(skipped ? 'You already have all of these foods.' : 'No foods found in that file.');
    // An in-app sheet, not confirm(): a browser that blocks this site's dialogs would silently answer "no"
    openSheet(`${sheetHead(`Add ${add.length} food${add.length === 1 ? '' : 's'} to My Foods?`, skipped ? `${skipped} you already have will be skipped.` : 'Nothing else changes.')}
      <ul class="parts">${add.map(x => `<li><span>${esc(x.name)}</span></li>`).join('')}</ul>
      <div class="add-row"><button class="btn grow" type="button" id="ifAdd">Add ${add.length} food${add.length === 1 ? '' : 's'}</button></div>`);
    $('#ifAdd').onclick = () => {
      custom = custom.concat(add); saveCustom(); closeSheet(); renderSettings(); renderFoods();
      toast(`Added ${add.length} to My Foods`);
    };
  }

  function openDeleteAccount() {
    const pw = acct.provider === 'password';
    openSheet(`${sheetHead('Delete my account', 'This permanently deletes your maCros account and all your days, recipes and own foods. It can’t be undone.')}
      <div class="row-actions" style="margin-top:0"><button class="btn ghost small" type="button" id="delBackup">Download a backup first</button></div>
      <form id="delForm" novalidate>
        ${pw ? '<label class="field" style="margin-top:14px">Confirm your password<input class="input" name="pw" type="password" autocomplete="current-password"></label>' : '<p class="muted small" style="margin:14px 0 0">You’ll be asked to confirm with Google.</p>'}
        <label class="field" style="margin-top:12px">Type DELETE to confirm<input class="input" name="confirm" autocomplete="off" autocapitalize="characters"></label>
        <p class="muted small" id="delMsg" role="alert" style="min-height:1.2em"></p>
        <div class="add-row"><button class="btn danger grow" type="submit">Delete my account forever</button></div>
      </form>`);
    $('#delBackup').onclick = exportData;
    $('#delForm').addEventListener('submit', async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      if (String(fd.get('confirm') || '').trim().toUpperCase() !== 'DELETE') { $('#delMsg').textContent = 'Type DELETE to confirm.'; return; }
      $('#delMsg').textContent = 'Deleting…';
      try { await acct.deleteAccount(fd.get('pw')); } catch (err) { $('#delMsg').textContent = err.message || 'Couldn’t delete. Try again.'; }
    });
  }

  // Called by boot.js when another device changed your data
  function reload() {
    settings = readSettings(); ensurePhases(); custom = store.get('custom', []); recent = store.get('recent', []); days = loadDays();
    E.setCustom(custom); applyTheme();
    viewIdx = Math.min(viewIdx, days.length - 1);
    updatePill();
    if (viewOpen('day')) showDash(dashPage);
    else if (viewOpen('add')) { renderFoodList(); renderWater(); if (!q.value.trim()) renderResults(); }
    else if (viewOpen('menu')) renderMenu();
    else if (viewOpen('goals') && !$('#view-goals').contains(document.activeElement)) renderGoals();
    else if (viewOpen('progress') && !$('#view-progress').contains(document.activeElement)) renderProgress();
    else if (viewOpen('settings') && !$('#view-settings').contains(document.activeElement)) renderSettings();
  }

  // ==========================================================
  // MENU · GOALS (phases + targets) · PROGRESS (reports + weigh-ins)
  // ==========================================================
  const S = window.MacrosSetup;
  const DAY_MS = 864e5, LB = 0.45359237;
  const dayStart = ts => new Date(ts).setHours(0, 0, 0, 0);
  const shortDate = ts => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const wUnit = () => (settings.profile && settings.profile.wUnit) || 'kg';
  const wShow = kg => wUnit() === 'lb' ? `${fmt(kg / LB, 1)} lb` : `${fmt(kg, 1)} kg`;
  const wDelta = kg => `${kg >= 0 ? '+' : '−'}${wShow(Math.abs(kg))}`;
  const currentKg = () => { const w = settings.weighIns || []; return w.length ? w[w.length - 1].kg : (settings.profile && settings.profile.kg) || 0; };

  // ---------- Phases (bulking, cutting, Hyrox…): each keeps its own targets ----------
  const phaseType = k => S.PHASES.find(x => x.k === k) || S.PHASES[S.PHASES.length - 1];
  const activePhase = () => (settings.phases || []).find(p => p.id === settings.phaseId) || null;
  function ensurePhases() {
    if (!Array.isArray(settings.phases)) settings.phases = [];
    if (!settings.locks) settings.locks = {};
    if (!settings.phases.length && settings.setupDone) {
      const type = settings.profile ? S.phaseForGoal(settings.profile.goal) : 'custom';
      settings.phases.push({ id: uid(), type, name: phaseType(type).label, targets: { ...settings.targets }, locks: { ...settings.locks } });
      settings.phaseId = settings.phases[0].id; saveSettings();   // first phase for accounts set up before phases existed
    }
    if (settings.phases.length && !activePhase()) { settings.phaseId = settings.phases[0].id; saveSettings(); }
  }
  // settings.targets are the ones in use; keep the active phase's copy in step
  function syncPhase() { const ph = activePhase(); if (ph) { ph.targets = { ...settings.targets }; ph.locks = { ...settings.locks }; } }
  function phaseTargets(type) {
    const t = phaseType(type);
    if (!t.goal || !settings.profile || !settings.profile.kg) return { ...settings.targets };
    return S.plan({ ...settings.profile, kg: currentKg(), goal: t.goal }, { tdee: settings.maintKcal }).targets;
  }
  function switchPhase(id) {
    syncPhase(); const ph = settings.phases.find(p => p.id === id); if (!ph || ph.id === settings.phaseId) return;
    settings.phaseId = id; settings.targets = { ...ph.targets }; settings.locks = { ...(ph.locks || {}) };
    saveSettings(); updatePill(); toast(`Switched to ${ph.name}: ${k0(ph.targets.kcal)} kcal`);
  }

  // ---------- Maintenance calories: estimated from your stats, or your own number ----------
  const estMaintenance = () => settings.profile && settings.profile.kg ? S.plan({ ...settings.profile, kg: currentKg() }).tdee : 0;
  const maintenance = () => settings.maintKcal ? { kcal: settings.maintKcal, own: true } : { kcal: estMaintenance(), own: false };
  // Phases are built on maintenance, so recalculate the calculated ones when it changes
  function recalcPhases() {
    syncPhase();
    (settings.phases || []).forEach(ph => { if (phaseType(ph.type).goal) { ph.targets = phaseTargets(ph.type); ph.locks = {}; } });
    const ph = activePhase(); if (ph) { settings.targets = { ...ph.targets }; settings.locks = { ...ph.locks }; }
  }

  // ---------- Targets: change calories and the unlocked macros follow ----------
  const KC = { p: 4, c: 4, f: 9 };
  function macroDefaults(kcal) {
    const ph = activePhase(), prof = settings.profile;
    const r = S.rules((ph && phaseType(ph.type).goal) || (prof && prof.goal) || 'maintain');
    const p = prof && prof.kg ? Math.round(r.prot * S.refKg({ ...prof, kg: currentKg() })) : Math.round(kcal * 0.25 / 4);
    return { p, f: Math.round(kcal * r.fatPct / 9), fib: Math.round(kcal / 1000 * 14) };
  }
  // A macro you type gets locked; the free ones fill the gap so P×4 + C×4 + F×9 = calories
  function rebalance(changed) {
    const T = settings.targets, L = settings.locks;
    if (changed === 'kcal') {
      const d = macroDefaults(T.kcal);
      if (!L.p) T.p = d.p;
      if (!L.fib) T.fib = d.fib;
      if (!L.f && !L.c) T.f = d.f;
    } else L[changed] = true;
    if (changed === 'fib') return;
    const fill = changed === 'kcal' ? ['c', 'f', 'p'].find(k => !L[k]) : ['c', 'f', 'p'].find(k => k !== changed && !L[k]);
    if (fill) {
      const rest = T.kcal - ['p', 'c', 'f'].filter(k => k !== fill).reduce((a, k) => a + T[k] * KC[k], 0);
      T[fill] = Math.max(0, Math.round(rest / KC[fill]));
    } else if (changed !== 'kcal') T.kcal = T.p * 4 + T.c * 4 + T.f * 9;
  }

  const LOCK = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 2a5 5 0 0 1 5 5v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v3h6V7a3 3 0 0 0-3-3Z"/></svg>';
  const UNLOCK = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 2a5 5 0 0 1 4.9 4 1 1 0 0 1-2 .4A3 3 0 0 0 9 7v3h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5Z"/></svg>';
  const ROW_ARROW = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M9.3 6.3a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4l4.3-4.3-4.3-4.3a1 1 0 0 1 0-1.4Z"/></svg>';

  function renderMenu() {
    ensurePhases();
    const ph = activePhase(), st = periodStats(7), due = weighDue();
    const row = (href, title, sub, extra) => `<a class="menu-row" href="${href}"><span><b>${title}</b><small>${sub}</small></span>${extra || ''}${ROW_ARROW}</a>`;
    $('#menuBody').innerHTML = `<div class="menu-list">
      ${row('#goals', 'Goals', ph ? `${esc(ph.name)} · ${k0(settings.targets.kcal)} kcal · ${fmt(settings.targets.p, 0)} g protein` : 'Targets, phases and your setup')}
      ${row('#progress', 'Progress', `Logged ${st.loggedDays} of the last ${st.span} day${st.span === 1 ? '' : 's'}`, due.due ? '<span class="pill-due">Weigh-in due</span>' : '')}
      ${row('#tutorial', 'Tutorial', `How to use maCros · ${tourProgress().done} of ${tourProgress().total} steps done`)}
      ${row('#settings', 'Settings', 'Account, appearance, water goal, backup')}
    </div>`;
  }

  function renderGoals() {
    ensurePhases();
    const T = settings.targets, L = settings.locks, prof = settings.profile, maint = maintenance();
    const lockBtn = k => `<button type="button" class="lock${L[k] ? ' on' : ''}" data-lock="${k}" aria-pressed="${!!L[k]}" aria-label="${L[k] ? 'Unlock' : 'Lock'} ${k}" title="${L[k] ? 'Locked: stays as you set it' : 'Auto: follows calories'}">${L[k] ? LOCK : UNLOCK}</button>`;
    $('#goalsBody').innerHTML = `
      <div class="card settings-card"><h2>Current goal</h2>
        <p class="muted small" style="margin:0">${prof ? esc(S.summary({ ...prof, kg: currentKg() })) : 'Not set up yet.'}</p>
        <div class="row-actions"><button class="btn small" type="button" id="statsBtn">Update my stats</button><button class="btn small outline" type="button" id="redoSetupBtn">Change my goal</button></div>
        <p class="muted small" style="margin:10px 0 0">Update your stats when your weight or activity changes. Change your goal to answer the setup questions again.</p></div>
      ${prof ? `<div class="card settings-card"><div class="card-head"><h2>Maintenance calories</h2><span class="${maint.own ? 'own-tag' : 'muted small'}">${maint.own ? 'Your number' : 'Estimated'}</span></div>
        <p class="muted small" style="margin:0 0 10px">What you burn in a normal day, worked out from your weight, height, age and activity. Phases build on it: lean bulk +250, bulk +500, cut −500.</p>
        <div class="stepper"><button class="icon-btn" type="button" data-maint="-50" aria-label="50 kcal less">&minus;</button>
          <label class="stepper-val"><input class="input" id="maintVal" type="number" inputmode="numeric" min="1000" max="6000" step="10" value="${maint.kcal}" aria-label="Maintenance calories"><span>kcal</span></label>
          <button class="icon-btn" type="button" data-maint="50" aria-label="50 kcal more">+</button></div>
        <p class="muted small" style="margin:10px 0 0">${maint.own ? `Calculated from your stats: ${k0(estMaintenance())} kcal. <button class="linkish small-link" type="button" id="maintReset">Use the calculated number</button>` : 'Tap − or + to go down or up by 50, or type your own number.'}</p></div>` : ''}
      <div class="card settings-card"><div class="card-head"><h2>Phases</h2><button class="btn small ghost" type="button" id="addPhaseBtn">+ Add phase</button></div>
        <div class="phase-list">${settings.phases.map(p => `<div class="phase-row${p.id === settings.phaseId ? ' on' : ''}">
            <button type="button" class="phase-main" data-phase="${p.id}" aria-pressed="${p.id === settings.phaseId}"><span class="radio" aria-hidden="true"></span>
              <span><b>${esc(p.name)}</b><small>${p.name !== phaseType(p.type).label ? esc(phaseType(p.type).label) + ' · ' : ''}${k0(p.targets.kcal)} kcal · P ${fmt(p.targets.p, 0)} g</small></span></button>
            <button type="button" class="icon-btn" data-edit-phase="${p.id}" aria-label="Edit ${esc(p.name)}">&#8943;</button></div>`).join('') || '<p class="muted small" style="margin:0">Finish setup to create your first phase.</p>'}</div>
        <p class="muted small" style="margin:10px 0 0">Tap a phase to switch. Its targets load everywhere in the app.</p></div>
      <div class="card settings-card"><div class="card-head"><h2>Daily targets</h2><button class="btn small ghost" type="button" id="autoBtn">Auto-calculate</button></div>
        <label class="field">Calories<input class="input" type="number" inputmode="numeric" min="0" data-target="kcal" value="${T.kcal}"></label>
        <div class="tgt-grid">${MACROS.map(x => `<div class="field tgt"><span class="tgt-lab"><span><i class="dot-${x.cls}"></i>${x.label} (g)</span>${lockBtn(x.k)}</span>
          <input class="input" type="number" inputmode="numeric" min="0" data-target="${x.k}" value="${T[x.k]}" aria-label="${x.label} grams"></div>`).join('')}</div>
        <p class="muted small" id="tgtNote" style="margin:12px 0 0"></p></div>`;
    tgtNote();
    $('#redoSetupBtn').onclick = () => openSetup(true);
    $('#statsBtn').onclick = openStats;
    if (prof) {
      // − / + nudge by 50 and save after a short pause; typing saves when you leave the box
      let maintT;
      const applyMaint = () => {
        const v = Math.round(parseFloat($('#maintVal').value));
        if (!(v >= 1000 && v <= 6000)) return toast('Enter maintenance calories between 1,000 and 6,000.');
        if (v === maintenance().kcal && settings.maintKcal) return;
        settings.maintKcal = v; recalcPhases(); saveSettings(); updatePill(); renderGoals();
        toast(`Maintenance ${k0(v)} kcal · your target is now ${k0(settings.targets.kcal)} kcal`);
      };
      $$('[data-maint]', $('#goalsBody')).forEach(b => b.onclick = () => {
        const inp = $('#maintVal'); inp.value = Math.min(6000, Math.max(1000, (Math.round(parseFloat(inp.value)) || maintenance().kcal) + +b.dataset.maint));
        clearTimeout(maintT); maintT = setTimeout(applyMaint, 700);
      });
      $('#maintVal').addEventListener('change', () => { clearTimeout(maintT); applyMaint(); });
      if ($('#maintReset')) $('#maintReset').onclick = () => {
        delete settings.maintKcal; recalcPhases(); saveSettings(); updatePill(); renderGoals();
        toast(`Back to the estimate: ${k0(maintenance().kcal)} kcal`);
      };
    }
    $('#addPhaseBtn').onclick = () => openPhaseForm(null);
    $('#autoBtn').onclick = () => {
      settings.locks = {}; rebalance('kcal'); syncPhase(); saveSettings(); updatePill(); renderGoals();
      toast('Macros recalculated from your calories');
    };
    $$('[data-phase]', $('#goalsBody')).forEach(b => b.onclick = () => { switchPhase(b.dataset.phase); renderGoals(); });
    $$('[data-edit-phase]', $('#goalsBody')).forEach(b => b.onclick = () => openPhaseForm(settings.phases.find(p => p.id === b.dataset.editPhase)));
    $$('[data-lock]', $('#goalsBody')).forEach(b => b.onclick = () => {
      const k = b.dataset.lock; settings.locks[k] = !settings.locks[k];
      if (!settings.locks[k]) rebalance('kcal');   // unlocked: let it follow calories again
      syncPhase(); saveSettings(); renderGoals();
    });
    $$('[data-target]', $('#goalsBody')).forEach(inp => inp.addEventListener('input', () => {
      const k = inp.dataset.target; const v = parseFloat(inp.value); if (!(v >= 0)) return;
      settings.targets[k] = Math.round(v); rebalance(k); syncPhase(); saveSettings(); updatePill();
      $$('[data-target]', $('#goalsBody')).forEach(o => { if (o !== inp) o.value = settings.targets[o.dataset.target]; });
      $$('[data-lock]', $('#goalsBody')).forEach(b => { const on = !!settings.locks[b.dataset.lock]; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); b.innerHTML = on ? LOCK : UNLOCK; });
      tgtNote();
    }));
  }
  function tgtNote() {
    const T = settings.targets; const sum = T.p * 4 + T.c * 4 + T.f * 9; const off = Math.abs(sum - T.kcal) > 25;
    $('#tgtNote').innerHTML = `Change calories and the unlocked macros follow. A macro you type gets locked ${LOCK}; tap the lock to free it.
      Protein × 4 + Carbs × 4 + Fat × 9 = <b${off ? ' style="color:var(--danger)"' : ''}>${k0(sum)}</b> kcal${off ? ' (doesn’t match your calories; unlock a macro or tap Auto-calculate)' : ''}.`;
  }

  // Quick update of weight / age / activity; recalculates the current phase's targets
  function openStats() {
    const p = settings.profile; if (!p) return openSetup(true);
    const ACT = [['sed', 'Mostly sitting'], ['light', 'Lightly active (1–3 days a week)'], ['mod', 'Moderately active (3–5 days)'], ['very', 'Very active (6–7 days)'], ['extra', 'Extremely active (physical job + training)']];
    openSheet(`${sheetHead('Update my stats', 'Your targets are recalculated for your current phase.')}
      <div class="form-grid">
        <label class="field">Weight (${wUnit()})<input class="input" id="stKg" type="number" inputmode="decimal" step="0.1" value="${wShow(currentKg()).split(' ')[0]}"></label>
        <label class="field">Age<input class="input" id="stAge" type="number" inputmode="numeric" min="18" max="100" value="${p.age}"></label>
      </div>
      <label class="field" style="margin-top:12px">How active are you?<select class="select" id="stAct">${ACT.map(([k, l]) => `<option value="${k}"${k === p.activity ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <p class="muted small" id="stMsg" role="alert" style="min-height:1.2em"></p>
      <div class="add-row"><button class="btn grow" type="button" id="stSave">Save and update targets</button></div>`);
    $('#stSave').onclick = () => {
      const v = parseFloat($('#stKg').value), age = Math.round(parseFloat($('#stAge').value));
      const kg = wUnit() === 'lb' ? v * LB : v;
      if (!(kg >= 30 && kg <= 300)) return ($('#stMsg').textContent = 'Check your weight.');
      if (!(age >= 18 && age <= 100)) return ($('#stMsg').textContent = 'Enter an age from 18 to 100.');
      p.age = age; p.activity = $('#stAct').value;
      if (Math.abs(kg - currentKg()) >= 0.05) {
        settings.weighIns = (settings.weighIns || []).filter(x => dayStart(x.t) !== dayStart(Date.now())).concat({ t: Date.now(), kg: Math.round(kg * 10) / 10 });
        p.kg = Math.round(kg * 10) / 10;
      }
      const ph = activePhase();
      if (ph && phaseType(ph.type).goal) { settings.targets = phaseTargets(ph.type); settings.locks = {}; syncPhase(); }
      saveSettings(); updatePill(); closeSheet(); renderGoals();
      toast(`Updated: ${k0(settings.targets.kcal)} kcal · ${settings.targets.p} g protein`);
    };
  }

  function openPhaseForm(ph) {
    const editing = !!ph; let type = ph ? ph.type : 'maintain';
    const preview = () => { const t = editing && type === ph.type ? ph.targets : phaseTargets(type); return `${k0(t.kcal)} kcal · P ${fmt(t.p, 0)} · C ${fmt(t.c, 0)} · F ${fmt(t.f, 0)} g`; };
    openSheet(`${sheetHead(editing ? 'Edit phase' : 'Add a phase', 'Switch phases any time; each keeps its own targets.')}
      <label class="field">Name<input class="input" id="phName" value="${esc(ph ? ph.name : phaseType(type).label)}" placeholder="e.g. Summer cut"></label>
      <div class="field" style="margin-top:12px">Type<div class="chips" id="phTypes">${S.PHASES.map(t => `<button type="button" class="chip${t.k === type ? ' on' : ''}" data-type="${t.k}">${esc(t.label)}</button>`).join('')}</div></div>
      <div class="note" id="phPreview"></div>
      <div class="add-row"><button class="btn grow" type="button" id="phSave">${editing ? 'Save' : 'Add and switch to it'}</button>${editing && settings.phases.length > 1 ? '<button class="btn danger" type="button" id="phDel">Delete</button>' : ''}</div>`);
    const showPreview = () => { $('#phPreview').textContent = phaseType(type).goal ? `Targets: ${preview()}` : `Custom: starts with your current targets (${preview()}). Set your own in Daily targets.`; };
    showPreview();
    $('#phTypes').addEventListener('click', e => {
      const b = e.target.closest('[data-type]'); if (!b) return;
      const nameEl = $('#phName'); const wasDefault = S.PHASES.some(t => t.label === nameEl.value.trim());
      type = b.dataset.type; if (wasDefault || !nameEl.value.trim()) nameEl.value = phaseType(type).label;
      $$('#phTypes .chip').forEach(c => c.classList.toggle('on', c.dataset.type === type)); showPreview();
    });
    $('#phSave').onclick = () => {
      const name = $('#phName').value.trim() || phaseType(type).label;
      if (editing) {
        const changedType = type !== ph.type; ph.name = name;
        if (changedType) { ph.type = type; ph.targets = phaseTargets(type); ph.locks = {}; }
        if (ph.id === settings.phaseId && changedType) { settings.targets = { ...ph.targets }; settings.locks = {}; }
        saveSettings(); updatePill(); closeSheet(); renderGoals(); toast('Phase saved');
      } else {
        syncPhase();
        const np = { id: uid(), type, name, targets: phaseTargets(type), locks: {} };
        settings.phases.push(np); saveSettings(); closeSheet(); switchPhase(np.id); renderGoals();
      }
    };
    if (editing && $('#phDel')) $('#phDel').onclick = () => {
      if (!confirm(`Delete the “${ph.name}” phase?`)) return;
      settings.phases = settings.phases.filter(p => p.id !== ph.id);
      if (settings.phaseId === ph.id) { const first = settings.phases[0]; settings.phaseId = first.id; settings.targets = { ...first.targets }; settings.locks = { ...(first.locks || {}) }; }
      saveSettings(); updatePill(); closeSheet(); renderGoals(); toast('Phase deleted');
    };
  }

  // ---------- Progress: last 7 / 30 days, estimated vs actual weight, weigh-ins ----------
  let progRange = 7;
  // Due at the usual weigh-in time, `weighEvery` days after the last weigh-in
  const weighTime = () => settings.weighTime || '07:00';
  function weighDue() {
    if (!settings.profile) return { due: false };
    const w = settings.weighIns || []; const every = settings.weighEvery || 7;
    if (!w.length) return { due: true, next: Date.now() };
    const [hh, mm] = weighTime().split(':').map(Number);
    const next = new Date(dayStart(w[w.length - 1].t) + every * DAY_MS).setHours(hh || 0, mm || 0, 0, 0);
    return { due: Date.now() >= next, next };
  }
  const timeLabel = ts => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  // Weight trend: a smoothed line through noisy scale readings (moves 10% per day toward each new reading)
  function weightTrend() {
    const w = [...(settings.weighIns || [])].sort((a, b) => a.t - b.t); let tr = null, prev = null;
    return w.map(x => {
      if (tr == null) tr = x.kg;
      else { const gap = Math.max((x.t - prev) / DAY_MS, 0.5); tr += (1 - Math.pow(0.9, gap)) * (x.kg - tr); }
      prev = x.t; return { t: x.t, kg: x.kg, trend: tr };
    });
  }
  function trendChart(pts, from) {
    const W = 320, H = 150, L = 36, R = 10, T = 12, B = 22;
    const now = Date.now(), x0 = Math.min(from, pts[0].t), span = Math.max(now - x0, DAY_MS);
    const vals = pts.flatMap(p => [p.kg, p.trend]); let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < 1) { const mid = (hi + lo) / 2; lo = mid - 0.5; hi = mid + 0.5; }
    const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
    const show = kg => wUnit() === 'lb' ? kg / LB : kg;
    const X = t => L + (t - x0) / span * (W - L - R), Y = kg => T + (hi - kg) / (hi - lo) * (H - T - B);
    const ticks = [lo + pad, (lo + hi) / 2, hi - pad];
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.trend).toFixed(1)}`).join(' ');
    const last = pts[pts.length - 1];
    const md = ts => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `<svg class="trend-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend: ${wShow(last.trend)} now">
      ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="grid"/><text x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" class="axis" text-anchor="end">${fmt(show(v), 1)}</text>`).join('')}
      <text x="${L}" y="${H - 5}" class="axis">${md(x0)}</text><text x="${W - R}" y="${H - 5}" class="axis" text-anchor="end">Today</text>
      ${pts.map(p => `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.kg).toFixed(1)}" r="4" class="scale-dot"><title>${shortDate(p.t)}: ${wShow(p.kg)} on the scale, trend ${wShow(p.trend)}</title></circle>`).join('')}
      ${pts.length > 1 ? `<path d="${line}" class="trend-line"/>` : ''}
      <circle cx="${X(last.t).toFixed(1)}" cy="${Y(last.trend).toFixed(1)}" r="5" class="trend-end"><title>Trend now: ${wShow(last.trend)}</title></circle>
    </svg>`;
  }
  function periodStats(n) {
    const today = dayStart(Date.now());
    const first = Math.min(...days.flatMap(d => d.entries.map(e => e.t)), Date.now());
    const from = Math.max(today - (n - 1) * DAY_MS, dayStart(first));   // don't count days before you started
    const span = Math.round((today - from) / DAY_MS) + 1;
    const dates = new Set(); days.forEach(d => d.entries.forEach(e => { if (e.t >= from) dates.add(dayStart(e.t)); }));
    // Averages use finished days only; the current day is still being eaten
    const logged = days.filter(d => d !== curDay() && d.entries.length && d.start >= from).map(d => E.sumMacros(d.entries));
    const T = settings.targets; const avg = k => logged.length ? logged.reduce((a, t) => a + t[k], 0) / logged.length : 0;
    const tdee = settings.profile && settings.profile.kg ? maintenance().kcal : 0;
    return {
      from, span, dates, loggedDays: dates.size, count: logged.length, avgKcal: avg('kcal'), avgP: avg('p'),
      onTarget: logged.filter(t => Math.abs(t.kcal - T.kcal) <= T.kcal * 0.1).length, protHit: logged.filter(t => t.p >= T.p * 0.9).length,
      tdee, estChange: tdee ? logged.reduce((a, t) => a + t.kcal - tdee, 0) / 7700 : null,
      weekly: tdee && logged.length ? (avg('kcal') - tdee) * 7 / 7700 : null,
    };
  }
  function renderProgress() {
    if (finishedDays() >= 3 && !(settings.tour && settings.tour.progressSeen)) { settings.tour = Object.assign({}, settings.tour, { progressSeen: true }); saveSettings(); }
    const st = periodStats(progRange), T = settings.targets, prof = settings.profile;
    const w = settings.weighIns || [], every = settings.weighEvery || 7, due = weighDue();
    const wFrom = dayStart(Date.now()) - (progRange - 1) * DAY_MS;
    const inWin = w.filter(x => x.t >= wFrom);
    const before = [...w].reverse().find(x => x.t < wFrom);
    const base = before || inWin[0]; const latest = w[w.length - 1];
    const actual = base && latest && latest !== base ? latest.kg - base.kg : null;
    const dots = Array.from({ length: progRange }, (_, i) => dayStart(Date.now()) - (progRange - 1 - i) * DAY_MS)
      .map(d => `<i class="${d < st.from ? 'off' : st.dates.has(d) ? 'on' : ''}" title="${shortDate(d)}"></i>`).join('');
    const cur = currentKg(); const tgt = prof && prof.targetKg;
    const proj = st.weekly != null && cur && st.count >= 3 ? [4, 12].map(wk => `${wk} weeks: <b>${wShow(cur + st.weekly * wk)}</b>`).join(' · ') : '';
    const eta = st.count >= 3 && st.weekly && tgt && Math.sign(tgt - cur) === Math.sign(st.weekly) && Math.abs(st.weekly) > 0.02 ? Math.ceil((tgt - cur) / st.weekly) : 0;
    const freq = [[1, 'Every day'], [7, 'Every week'], [14, 'Every 2 weeks'], [30, 'Every month']];
    const chartFrom = dayStart(Date.now()) - (progRange - 1) * DAY_MS;   // weigh-ins can predate your first food log
    const trendAll = weightTrend(); const trendPts = trendAll.filter(p => p.t >= chartFrom);
    const trendNow = trendAll.length ? trendAll[trendAll.length - 1].trend : 0;
    const trendBase = [...trendAll].reverse().find(p => p.t < chartFrom) || trendPts[0];
    const trendChange = trendPts.length && trendBase && trendBase !== trendPts[trendPts.length - 1] ? trendNow - trendBase.trend : null;
    $('#progressBody').innerHTML = `
      <div class="seg three" id="progSeg" style="margin:0 0 12px">${[[7, '7 days'], [30, '30 days'], [90, '90 days']].map(([k, l]) => `<button type="button" class="${k === progRange ? 'on' : ''}" data-range="${k}">${l}</button>`).join('')}</div>
      <div class="card settings-card"><h2>Logging</h2>
        <div class="streak${progRange > 30 ? ' tiny' : progRange > 7 ? ' wide' : ''}" aria-hidden="true">${dots}</div>
        <p class="muted small" style="margin:10px 0 0">${st.loggedDays === st.span ? `<b>No skipped days.</b> You logged all ${st.span} day${st.span === 1 ? '' : 's'}.` : `Logged <b>${st.loggedDays} of ${st.span}</b> days. ${st.span - st.loggedDays} skipped.`}</p></div>
      <div class="card settings-card"><h2>Eating vs target</h2>
        ${st.count ? `<div class="stat-grid">
          <div><small>Avg calories</small><b>${k0(st.avgKcal)}</b><span>of ${k0(T.kcal)} target</span></div>
          <div><small>Avg protein</small><b>${fmt(st.avgP, 0)} g</b><span>of ${fmt(T.p, 0)} g target</span></div>
          <div><small>Calories on target</small><b>${st.onTarget} of ${st.count}</b><span>days within 10%</span></div>
          <div><small>Protein hit</small><b>${st.protHit} of ${st.count}</b><span>days at 90%+</span></div></div>`
        : `<p class="muted small" style="margin:0">${days.some(d => d.entries.length) ? 'Averages show once you finish a day (tap Start the next day on the Dashboard).' : 'No days logged in this period yet.'}</p>`}</div>
      <div class="card settings-card"><div class="card-head"><h2>Weight</h2>${prof && trendPts.length ? `<span class="trend-val" title="Trend weight">${wShow(trendNow)}</span>` : ''}</div>
        ${!prof ? '<p class="muted small" style="margin:0">Finish setup to see your weight trend.</p>' : `
        ${trendPts.length ? `${trendChart(trendPts, chartFrom)}
          <div class="chart-legend"><span><i class="lg-dot"></i>Scale weight</span><span><i class="lg-line"></i>Trend</span></div>` : '<p class="muted small" style="margin:0 0 12px">Log a weigh-in below to start your trend line.</p>'}
        <div class="stat-grid" style="margin-top:12px">
          <div><small>Last weigh-in</small><b>${wShow(cur)}</b><span>${latest ? shortDate(latest.t) : 'from setup'}</span></div>
          <div><small>Trend change</small><b>${trendChange != null ? wDelta(trendChange) : '—'}</b><span>in this period</span></div>
          <div><small>Expected from eating</small><b>${st.estChange != null && st.count ? wDelta(st.estChange) : '—'}</b><span>vs burning ${k0(st.tdee)} kcal/day</span></div>
          ${tgt ? `<div><small>Goal</small><b>${wShow(tgt)}</b><span>${eta ? `about ${eta} week${eta === 1 ? '' : 's'} at this pace` : st.count >= 3 ? 'not moving toward it yet' : 'needs 3 full days'}</span></div>` : ''}</div>
        <p class="muted small" style="margin:12px 0 0">The scale jumps around with water, salt and food, so watch the trend line, not single readings. ${proj ? `If you keep eating like this, you'd weigh about ${proj}.` : 'Log at least 3 full days to see where your weight is heading.'}</p>`}</div>
      ${prof ? `<div class="card settings-card"><h2>Weigh-in</h2>
        ${due.due ? '<p class="due-text">Time for your weigh-in.</p>' : `<p class="muted small" style="margin:0 0 10px">Next weigh-in: <b>${shortDate(due.next)}, ${timeLabel(due.next)}</b></p>`}
        <div class="add-row" style="margin-top:6px"><input class="input" id="wiVal" type="number" inputmode="decimal" min="20" step="0.1" placeholder="${wShow(cur).split(' ')[0]}" aria-label="Your weight in ${wUnit()}" style="flex:1"><span class="muted" style="align-self:center">${wUnit()}</span><button class="btn" type="button" id="wiSave">Save</button></div>
        <label class="field" style="margin-top:14px">How often do you want to weigh in?
          <select class="select" id="wiEvery">${freq.map(([d, l]) => `<option value="${d}"${d === every ? ' selected' : ''}>${l}</option>`).join('')}<option value="custom"${freq.some(f => f[0] === every) ? '' : ' selected'}>Every … days</option></select></label>
        <label class="field" id="wiCustomWrap" style="margin-top:10px"${freq.some(f => f[0] === every) ? ' hidden' : ''}>Days between weigh-ins<input class="input" id="wiCustom" type="number" inputmode="numeric" min="1" max="90" value="${every}"></label>
        <label class="field" style="margin-top:10px">Usual weigh-in time<span class="hint">Best right after waking up, before eating or drinking</span><input class="input" id="wiTime" type="time" value="${weighTime()}"></label>
        ${w.length ? `<ul class="parts weigh-list">${[...w].reverse().slice(0, 8).map((x, i, arr) => `<li><span>${shortDate(x.t)}</span><span><b>${wShow(x.kg)}</b>${arr[i + 1] ? ` <small class="muted">${wDelta(x.kg - arr[i + 1].kg)}</small>` : ''}
            <button class="remove" type="button" data-wi="${x.t}" aria-label="Delete weigh-in">&times;</button></span></li>`).join('')}</ul>` : ''}</div>` : ''}`;
    $$('#progSeg [data-range]').forEach(b => b.onclick = () => { progRange = +b.dataset.range; renderProgress(); });
    if (!prof) return;
    $('#wiSave').onclick = () => {
      let v = parseFloat($('#wiVal').value); if (!(v > 0)) return toast('Enter your weight first.');
      const kg = wUnit() === 'lb' ? v * LB : v; if (kg < 20 || kg > 300) return toast('That weight looks off. Check the number.');
      logWeight(kg);
    };
    $('#wiEvery').onchange = e => {
      const custom = e.target.value === 'custom'; $('#wiCustomWrap').hidden = !custom;
      if (!custom) { settings.weighEvery = +e.target.value; saveSettings(); renderProgress(); }
    };
    $('#wiTime').onchange = e => { if (e.target.value) { settings.weighTime = e.target.value; saveSettings(); renderProgress(); } };
    $('#wiCustom').onchange = e => { const d = Math.round(parseFloat(e.target.value)); if (d >= 1 && d <= 90) { settings.weighEvery = d; saveSettings(); renderProgress(); } };
    $$('[data-wi]', $('#progressBody')).forEach(b => b.onclick = () => {
      if (!confirm('Delete this weigh-in?')) return;
      settings.weighIns = (settings.weighIns || []).filter(x => String(x.t) !== b.dataset.wi); saveSettings(); renderProgress();
    });
  }
  function logWeight(kg) {
    const w = (settings.weighIns || []).filter(x => dayStart(x.t) !== dayStart(Date.now()));   // one weigh-in per day
    w.push({ t: Date.now(), kg: Math.round(kg * 10) / 10 }); settings.weighIns = w;
    if (settings.profile) settings.profile.kg = Math.round(kg * 10) / 10;
    saveSettings(); renderProgress();
    const ph = activePhase();
    const canUpdate = ph && phaseType(ph.type).goal;
    toast(`Saved ${wShow(kg)}`, canUpdate ? { label: 'Update targets', run: () => {
      settings.targets = phaseTargets(ph.type); settings.locks = {}; syncPhase(); saveSettings(); updatePill();
      toast(`New target: ${k0(settings.targets.kcal)} kcal · ${settings.targets.p} g protein`);
    } } : null);
  }

  // ==========================================================
  // WATER · DASHBOARD WEEK · TUTORIAL
  // ==========================================================
  // Water: tap the glass to log one; the glass fills toward your daily goal
  const waterCfg = () => Object.assign({ goal: 8, ml: 250 }, settings.water);
  const GLASS_PATH = 'M7 4h26l-3.2 38.4A3 3 0 0 1 26.8 45H13.2a3 3 0 0 1-3-2.6L7 4Z';
  const glassSvg = (fill, id) => `<svg viewBox="0 0 40 48" width="44" height="52" aria-hidden="true"><defs><clipPath id="${id}"><path d="${GLASS_PATH}"/></clipPath></defs>
    <rect x="0" y="${(4 + 41 * (1 - fill)).toFixed(1)}" width="40" height="48" class="glass-water" clip-path="url(#${id})"/><path d="${GLASS_PATH}" class="glass-edge"/></svg>`;
  function renderWater(el) {
    el = el || $('#water'); if (!el) return;
    const d = curDay(), c = waterCfg(), n = d.water || 0;
    el.innerHTML = `<button class="glass-btn" type="button" data-water="add" aria-label="Log one glass of water (${c.ml} ml)">${glassSvg(Math.min(n / c.goal, 1), 'clip-' + el.id)}</button>
      <div class="water-txt"><b>${n} of ${c.goal} glasses</b><small>${k0(n * c.ml)} ml water today · tap the glass after each one</small></div>
      ${n ? '<button class="icon-btn" type="button" data-water="undo" aria-label="Remove one glass">&minus;</button>' : ''}`;
    $('[data-water="add"]', el).onclick = () => {
      d.water = n + 1; saveDays(); renderWater(el); $('[data-water="add"]', el).classList.add('pop');
      if (d.water === c.goal) toast('Water goal reached. Nice!');
    };
    if (n) $('[data-water="undo"]', el).onclick = () => { d.water = Math.max(0, n - 1); saveDays(); renderWater(el); };
  }

  // Dashboard: "Today" and "This week" pages; tap the switch or swipe sideways
  let dashPage = 'day', weekOffset = 0;
  function showDash(page) {
    dashPage = page; $('#pageDay').hidden = page !== 'day'; $('#pageWeek').hidden = page !== 'week';
    $$('#dashSeg button').forEach(b => { const on = b.dataset.page === page; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    if (page === 'week') renderWeek(); else renderDay();
  }
  $('#dashSeg').addEventListener('click', e => { const b = e.target.closest('[data-page]'); if (b) { if (b.dataset.page === 'week') weekOffset = 0; showDash(b.dataset.page); } });
  let swX = null, swY = null;
  $('#view-day').addEventListener('touchstart', e => { const t = e.touches[0]; swX = t.clientX; swY = t.clientY; }, { passive: true });
  $('#view-day').addEventListener('touchend', e => {
    if (swX == null) return; const t = e.changedTouches[0]; const dx = t.clientX - swX, dy = t.clientY - swY; swX = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5 || e.target.closest('input, textarea, select')) return;
    if (dx < 0 && dashPage === 'day') { weekOffset = 0; showDash('week'); } else if (dx > 0 && dashPage === 'week') showDash('day');
  });

  // Monday-to-Sunday week; each Day counts on the date it started
  function weekData(offset) {
    const mon = new Date(); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - (mon.getDay() + 6) % 7 + offset * 7);
    const per = Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(mon); dt.setDate(dt.getDate() + i); const d = dt.getTime();
      const list = days.filter(x => dayStart(x.start) === d);
      return { d, t: E.sumMacros(list.flatMap(x => x.entries)), logged: list.some(x => x.entries.length), idx: list.length ? days.indexOf(list[list.length - 1]) : -1,
        water: list.reduce((a, x) => a + (x.water || 0), 0), future: d > Date.now() };
    });
    return { mon: mon.getTime(), per };
  }
  function weekBars(per, target) {
    const W = 320, H = 150, L = 4, R = 4, T = 18, B = 22;
    const max = Math.max(target * 1.15, ...per.map(p => p.t.kcal)) || 1;
    const slot = (W - L - R) / 7, bw = slot * 0.56, Y = v => T + (1 - v / max) * (H - T - B), base = H - B;
    const today = dayStart(Date.now());
    const bar = (x, y) => { const r = Math.min(4, base - y); return `M${x},${base} V${(y + r).toFixed(1)} Q${x},${y.toFixed(1)} ${x + r},${y.toFixed(1)} H${(x + bw - r).toFixed(1)} Q${(x + bw).toFixed(1)},${y.toFixed(1)} ${(x + bw).toFixed(1)},${(y + r).toFixed(1)} V${base} Z`; };
    const best = per.reduce((a, p, i) => p.t.kcal > per[a].t.kcal ? i : a, 0);
    return `<svg class="week-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calories per day this week">
      <line x1="${L}" x2="${W - R}" y1="${base}" y2="${base}" class="grid"/>
      <line x1="${L}" x2="${W - R}" y1="${Y(target).toFixed(1)}" y2="${Y(target).toFixed(1)}" class="target-line"/>
      <text x="${W - R}" y="${(Y(target) - 5).toFixed(1)}" class="axis" text-anchor="end">target ${k0(target)}</text>
      ${per.map((p, i) => {
        const x = L + i * slot + (slot - bw) / 2; const label = new Date(p.d).toLocaleDateString(undefined, { weekday: 'narrow' });
        const tip = `${new Date(p.d).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}: ${p.logged ? k0(p.t.kcal) + ' kcal' : 'not logged'}`;
        return `<g${p.idx >= 0 ? ` data-goday="${p.idx}" class="bar-hit"` : ''}><title>${tip}</title><rect x="${L + i * slot}" y="${T}" width="${slot}" height="${H - T}" fill="transparent"/>
          ${p.t.kcal > 0 ? `<path d="${bar(x, Y(p.t.kcal))}" class="kcal-bar${p.d === today ? ' today' : ''}"/>` : ''}
          ${p.t.kcal > 0 && i === best ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(Y(p.t.kcal) - 5).toFixed(1)}" class="axis val" text-anchor="middle">${k0(p.t.kcal)}</text>` : ''}
          <text x="${(x + bw / 2).toFixed(1)}" y="${H - 6}" class="axis${p.d === today ? ' strong' : ''}" text-anchor="middle">${label}</text></g>`;
      }).join('')}
    </svg>`;
  }
  function renderWeek() {
    const { mon, per } = weekData(weekOffset), T = settings.targets;
    const md = ts => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const logged = per.filter(p => p.logged); const tot = E.sumMacros(logged.map(p => p.t)); const n = logged.length || 1;
    const water = per.reduce((a, p) => a + p.water, 0);
    $('#pageWeek').innerHTML = `
      <div class="day-nav">
        <button class="icon-btn" type="button" data-wk="-1" aria-label="Previous week">&#8249;</button>
        <div class="day-title"><h1>${weekOffset === 0 ? 'This week' : weekOffset === -1 ? 'Last week' : 'Week of ' + md(mon)}</h1><small>${md(mon)} – ${md(mon + 6 * DAY_MS)}</small></div>
        <button class="icon-btn" type="button" data-wk="1" aria-label="Next week"${weekOffset >= 0 ? ' disabled' : ''}>&#8250;</button>
      </div>
      <div class="card">
        <div class="eyebrow">Calories this week</div>
        <div class="kcal-big" style="margin-top:4px">${k0(tot.kcal)}<span>kcal</span></div>
        <p class="muted small" style="margin:6px 0 0">${logged.length ? `Average <b>${k0(tot.kcal / n)}</b> a day over ${logged.length} logged day${logged.length === 1 ? '' : 's'} · target ${k0(T.kcal)} a day` : 'Nothing logged this week yet.'}</p>
        ${weekBars(per, T.kcal)}
      </div>
      <div class="card" style="margin-top:12px"><div class="eyebrow">Macros this week</div>
        <div class="macro-grid">${MACROS.map(x => `<div class="mtile"><div class="lab"><i class="dot-${x.cls}"></i>${x.label}</div>
          <div class="val">${fmt(tot[x.k], 0)}<small>g</small></div><div class="sub">${logged.length ? `${fmt(tot[x.k] / n, 0)} g a day · target ${fmt(T[x.k], 0)}` : `target ${fmt(T[x.k], 0)} g a day`}</div></div>`).join('')}</div>
        <p class="muted small" style="margin:12px 0 0">Water: <b>${water}</b> glasses this week (${k0(water * waterCfg().ml)} ml).</p>
      </div>
      <h3 class="section-title">Day by day</h3>
      <div class="card week-days">${per.map(p => `<${p.idx >= 0 ? `button type="button" data-goday="${p.idx}"` : 'div'} class="wk-row${p.logged ? '' : ' empty'}">
          <span class="wk-date"><b>${new Date(p.d).toLocaleDateString(undefined, { weekday: 'short' })}</b><small>${md(p.d)}</small></span>
          <span class="wk-main">${p.logged ? mchips(p.t, false) : `<small class="muted">${p.future ? 'Coming up' : 'Not logged'}</small>`}</span>
          <span class="wk-kcal">${p.logged ? k0(p.t.kcal) : ''}</span></${p.idx >= 0 ? 'button' : 'div'}>`).join('')}</div>
      ${reminderBtn('day')}`;
    $$('[data-wk]', $('#pageWeek')).forEach(b => b.onclick = () => { weekOffset = Math.min(0, weekOffset + +b.dataset.wk); renderWeek(); });
    $$('[data-goday]', $('#pageWeek')).forEach(b => b.addEventListener('click', () => { viewIdx = +b.dataset.goday; showDash('day'); window.scrollTo(0, 0); }));
  }

  // Tutorial: a guided tour plus a first-week checklist (ticks itself where it can tell)
  // Each step opens the page and spotlights the real thing on screen
  const TOUR = [
    { go: '#day', page: 'day', sel: '#dayBody .ring-row', t: 'Your day at a glance', b: 'The ring is calories eaten against your target. The bars are protein, carbs, fat and fiber.' },
    { go: '#day', page: 'day', sel: '#dashSeg', t: 'Today and This week', b: 'Tap <b>This week</b>, or swipe sideways, to see Monday to Sunday with your weekly totals.' },
    { go: '#day', page: 'day', sel: '#dayBody .meal-head', t: 'Add food to a meal', b: 'Tap <b>+</b> next to a meal to add what you ate. The note icon beside it lets you write how the meal went.' },
    { go: '#day', page: 'day', sel: '#waterDash', t: 'Drink water', b: 'Tap the glass after every glass of water. It fills up toward your daily goal.' },
    { go: '#day', page: 'day', sel: '#dayBody [data-act="newday"]', t: 'Start a new day', b: 'When your day ends, tap <b>Start Day</b>. Days never change by themselves at midnight.' },
    { go: '#add', sel: '#askBox', t: 'Type or say what you ate', b: '<i>“2 eggs and 1 cup rice”</i>, <i>“150 g chicken breast”</i>, or by calories: <i>“300 kcal nuggets”</i>. Tap the mic to speak instead.' },
    { go: '#add', sel: '#view-add .quick-row', t: 'Scan or quick add', b: '<b>Scan barcode</b> on packaged food from the grocery or 7-Eleven. <b>Quick add</b> lets you type calories and macros yourself.' },
    { go: '#add', sel: '#cats', t: 'Browse foods', b: 'Tap <b>Protein</b>, <b>Carbs</b>, <b>Fat</b> or <b>Fiber</b> to see the best sources, or open a category below. Foods marked <b>Estimate</b> are recipe estimates.' },
    { go: '#menu', sel: '#menuBody .menu-list', t: 'The Menu', b: '<b>Goals</b> for your targets and phases, <b>Progress</b> for your results, <b>Tutorial</b> for this tour and your checklist, and <b>Settings</b>.' },
    { go: '#goals', sel: '#maintVal', t: 'Maintenance calories', b: 'What you burn in a normal day. Type your own number any time; your phases are built on it.' },
    { go: '#goals', sel: '#goalsBody .phase-list', t: 'Phases', b: 'Bulking, cutting, Hyrox… tap a phase to switch. Its targets load everywhere in the app.' },
    { go: '#goals', sel: '#goalsBody .tgt-grid', t: 'Daily targets', b: 'Change calories and the macros follow. Type a macro yourself and it locks, so the others adjust around it.' },
    { go: '#progress', sel: '#progressBody .trend-chart, #progressBody .stat-grid', t: 'Progress', b: 'Days logged, your averages and your weight trend. Watch the line, not single readings.' },
    { go: '#progress', sel: '#wiVal', t: 'Weigh in', b: 'Log your weight here at your usual time. Choose how often in this card.' },
    { go: '#day', page: 'day', sel: '#dayBody .reminder-link', t: 'Need help later?', b: 'Every page has a <b>Reminder</b> button with a quick explanation. Replay this tour any time from Menu → Tutorial.' },
  ];
  const finishedDays = () => days.filter(d => d !== curDay() && d.entries.length).length;
  const CHECKS = [
    { when: 'Day 1 · get started', items: [
      { k: 'setup', t: 'Answer the setup questions', auto: () => !!settings.setupDone },
      { k: 'food', t: 'Log your first meal', go: '#add', auto: () => days.some(d => d.entries.length) },
      { k: 'water', t: 'Tap the water glass', go: '#add', auto: () => days.some(d => d.water) },
      { k: 'tour', t: 'Take the tour', auto: () => !!(settings.tour && settings.tour.seen) },
    ] },
    { when: 'End of day 1', items: [
      { k: 'day2', t: 'Tap Start Day 2 on the Dashboard', go: '#day', auto: () => days.length > 1 },
    ] },
    { when: 'Days 2–3', items: [
      { k: 'note', t: 'Add a note to a meal', go: '#day', auto: () => days.some(d => d.notes && Object.keys(d.notes).length) },
      { k: 'kcal', t: 'Log a food by calories (“300 kcal rice”)', go: '#add', auto: () => days.some(d => d.entries.some(e => / kcal\)/.test(e.amt || ''))) },
      { k: 'sources', t: 'Find a protein source in Browse foods', go: '#add' },
    ] },
    { when: 'After 3 full days', items: [
      { k: 'progress', t: 'Check your averages in Progress', go: '#progress', auto: () => finishedDays() >= 3 && !!(settings.tour && settings.tour.progressSeen) },
      { k: 'targets', t: 'Fine-tune your targets in Goals if needed', go: '#goals' },
    ] },
    { when: 'End of week 1', items: [
      { k: 'weigh', t: 'Do your first weekly weigh-in', go: '#progress', auto: () => (settings.weighIns || []).length >= 2 },
      { k: 'week', t: 'Look at This week on the Dashboard', go: '#day' },
      { k: 'phase', t: 'Optional: add a phase (Bulking, Cutting, Hyrox…)', go: '#goals', auto: () => (settings.phases || []).length > 1 },
    ] },
  ];
  const isDone = it => !!((settings.tour && settings.tour.done && settings.tour.done[it.k]) || (it.auto && it.auto()));
  function tourProgress() { const all = CHECKS.flatMap(g => g.items); return { done: all.filter(isDone).length, total: all.length }; }
  function renderTutorial() {
    const pr = tourProgress();
    $('#tutorialBody').innerHTML = `
      <div class="card settings-card"><h2>Quick tour</h2>
        <p class="muted small" style="margin:0">${TOUR.length} short steps. It takes you to each part of the app and highlights it on screen. About 2 minutes.</p>
        <div class="row-actions"><button class="btn" type="button" id="tourStart">Start the tour</button></div></div>
      <div class="card settings-card"><div class="card-head"><h2>Your first week</h2><span class="muted small">${pr.done} of ${pr.total} done</span></div>
        <div class="bar" style="margin:0 0 6px"><span style="width:${pr.done / pr.total * 100}%;background:var(--accent-bright)"></span></div>
        ${CHECKS.map(g => `<div class="tl-group"><div class="tl-when">${g.when}</div>${g.items.map(it => {
          const done = isDone(it);
          return `<div class="tl-item${done ? ' done' : ''}"><button type="button" class="tl-check" data-check="${it.k}" aria-pressed="${done}" aria-label="Mark “${esc(it.t)}” ${done ? 'not done' : 'done'}"${it.auto && it.auto() ? ' disabled' : ''}></button>
            <span>${esc(it.t)}</span>${it.go && !done ? `<a class="tl-go" href="${it.go}">Go</a>` : ''}</div>`;
        }).join('')}</div>`).join('')}
      </div>
      <div class="card settings-card"><h2>Every week after that</h2>
        <ul class="legend-list"><li>Weigh in at your usual time and watch the <b>trend line</b>, not single readings.</li>
          <li>Check <b>This week</b> on the Dashboard: are calories and protein close to target most days?</li>
          <li>When maCros offers <b>Update targets</b> after a weigh-in, take it so your numbers follow your new weight.</li>
          <li>Plan changing? Switch your <b>phase</b> in Goals.</li></ul></div>`;
    $('#tourStart').onclick = () => openTour(0);
    $$('[data-check]', $('#tutorialBody')).forEach(b => b.onclick = () => {
      const tour = Object.assign({ done: {} }, settings.tour); tour.done = Object.assign({}, tour.done);
      tour.done[b.dataset.check] = !tour.done[b.dataset.check]; settings.tour = tour; saveSettings(); renderTutorial();
    });
  }
  let coach = null;
  function openTour(i) {
    if (!$('#sheet').hidden) closeSheet();
    const st = TOUR[i];
    if (location.hash !== st.go) location.hash = st.go; else route();
    if (st.page) { viewIdx = days.length - 1; showDash(st.page); }
    setTimeout(() => {
      const el = st.sel.split(',').map(x => document.querySelector(x.trim())).find(e => e && e.getClientRects().length);
      if (el) el.scrollIntoView({ block: 'center' });
      setTimeout(() => drawCoach(i, el), 260);
    }, 140);
  }
  function drawCoach(i, el) {
    const st = TOUR[i], last = i === TOUR.length - 1;
    if (!coach) {
      coach = document.createElement('div'); coach.className = 'coach'; document.body.appendChild(coach);
      window.addEventListener('resize', placeCoach); window.addEventListener('scroll', placeCoach, { passive: true });
    }
    coach.innerHTML = `<div class="coach-hole"></div>
      <div class="coach-card" role="dialog" aria-modal="true" aria-labelledby="coachTitle">
        <div class="tour-dots" aria-hidden="true">${TOUR.map((_, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</div>
        <div class="eyebrow">Step ${i + 1} of ${TOUR.length}</div>
        <h2 id="coachTitle">${st.t}</h2>
        <p class="tour-body">${st.b}</p>
        <div class="add-row"><button class="btn ghost" type="button" data-c="skip">${last ? 'Close' : 'Skip'}</button>
          ${i > 0 ? '<button class="btn ghost" type="button" data-c="back">Back</button>' : ''}
          <button class="btn grow" type="button" data-c="next">${last ? 'Finish' : 'Next'}</button></div>
      </div>`;
    coach.classList.toggle('nohole', !el);
    coach._el = el; placeCoach();
    coach.onclick = e => {
      const b = e.target.closest('[data-c]'); if (!b) return;
      if (b.dataset.c === 'next') return last ? endTour(true) : openTour(i + 1);
      if (b.dataset.c === 'back') return openTour(i - 1);
      endTour(false);
    };
    setTimeout(() => { const n = coach && coach.querySelector('[data-c="next"]'); if (n) n.focus(); }, 30);
  }
  function placeCoach() {
    if (!coach) return;
    const el = coach._el, hole = coach.querySelector('.coach-hole'), card = coach.querySelector('.coach-card');
    const vh = window.innerHeight, ch = card.offsetHeight;
    if (!el || !el.isConnected) { hole.style.display = 'none'; card.style.top = Math.max(12, (vh - ch) / 2) + 'px'; return; }
    const r = el.getBoundingClientRect(), pad = 6;
    Object.assign(hole.style, { display: 'block', left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const below = vh - r.bottom - pad;
    card.style.top = (below > ch + 20 ? r.bottom + pad + 12 : r.top - pad > ch + 20 ? r.top - pad - 12 - ch : Math.max(12, vh - ch - 12)) + 'px';
  }
  function endTour(finished) {
    if (coach) { coach.remove(); coach = null; window.removeEventListener('resize', placeCoach); window.removeEventListener('scroll', placeCoach); }
    settings.tour = Object.assign({}, settings.tour, { hide: true }, finished ? { seen: true } : {}); saveSettings();
    toast(finished ? 'Tour done. Your first-week checklist is in Menu → Tutorial.' : 'You can replay the tour from Menu → Tutorial.');
    route();
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && coach) endTour(false); });

  // ---------- Setup (body stats + goal → targets) ----------
  function openSetup(canCancel) {
    const appEl = $('#app'), box = $('#setup');
    const close = () => { box.hidden = true; box.innerHTML = ''; appEl.hidden = false; window.scrollTo(0, 0); };
    appEl.hidden = true; box.hidden = false;
    window.MacrosSetup.open(box, {
      profile: settings.profile, tdee: settings.maintKcal,
      onCancel: canCancel ? close : null,
      onDone: (profile, targets) => {
        settings.profile = profile; settings.targets = { ...targets }; settings.locks = {}; settings.setupDone = true;
        // Put the result in the phase that matches the goal (creating it the first time)
        ensurePhases();
        const type = S.phaseForGoal(profile.goal);
        let ph = settings.phases.find(p => p.type === type);
        if (!ph) { ph = { id: uid(), type, name: phaseType(type).label }; settings.phases.push(ph); }
        settings.phaseId = ph.id; syncPhase();
        settings.weighIns = (settings.weighIns || []).filter(x => dayStart(x.t) !== dayStart(Date.now())).concat({ t: Date.now(), kg: profile.kg });
        saveSettings();
        close(); updatePill();
        route();
        toast(`Your target: ${k0(targets.kcal)} kcal · ${targets.p} g protein a day`);
      },
    });
  }

  // ---------- Boot ----------
  ensurePhases();
  updatePill();
  autosize();
  identify();
  route();
  if (!settings.setupDone) openSetup(false);
  return { reload, toast };
} };
