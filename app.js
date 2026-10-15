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
  const defaultMeal = () => (MEALS.includes(settings.lastMeal) ? settings.lastMeal : 'Breakfast');
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
  const badge = f => `<span class="badge ${f.sugg ? 'E' : f.src}" title="Source: ${esc(f.sugg ? 'Estimate (Suggestions)' : E.SOURCES[f.src])}">${esc(f.sugg ? 'Estimate' : E.SOURCES[f.src])}</span>`;
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
          <li>Your targets come from your setup and current phase. Change them in Menu → Goals.</li>
          <li>Tap the note icon next to a meal to write down how it went.</li>
          <li>Swipe left, or tap <b>This week</b>, to see Monday to Sunday.</li></ul>`,
      add: `<ol class="steps">
          <li><b class="n">1</b><div><b>Type or tap the mic</b> and say what you ate, with amounts: <span class="muted">“150 grams lean ground pork and one cup of rice”</span>, or by calories: <span class="muted">“532 calories of chicken nuggets”</span>. English, Tagalog or Taglish all work.</div></li>
          <li><b class="n">2</b><div><b>Check the matches.</b> Fix any amount, switch between cooked and raw, or pick a different food. No amount? It assumes 1 normal serving and tells you.</div></li>
          <li><b class="n">3</b><div><b>Add to your day</b> for a running total. Made your own sauce? Type its ingredients and tap <b>Save as recipe</b>.</div></li>
        </ol>
        <p class="muted small" style="margin:14px 0 0">Weights are <b>cooked, as eaten</b> unless you pick raw. Calculations use only USDA, FNRI and label values (${verified} foods). Estimates sit separately in Suggestions.</p>
        <h3 class="section-title">Browse foods</h3>
        <ul class="legend-list">          <li><b>Database:</b> verified values (USDA, FNRI, labels), plus your own foods and recipes. Typing matches against these.</li>
          <li><b>Suggestions:</b> recipe-based estimates with no official lab value. They’re never used on their own; tap one to use it on purpose.</li>
          <li><b>My Eats:</b> everything you’ve logged, most recent first. Tap one to log the same amount again.</li>
          <li>Tap a category name to open or close it. Tap <b>Protein</b>, <b>Carbs</b>, <b>Fat</b> or <b>Fiber</b> to see the best sources of each.</li></ul>`,
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
    box.innerHTML = html;
  }
  const currentTotal = () => E.sumMacros(items.filter(i => i.kind === 'food').map(i => E.macros(i.food, i.grams)));
  function totalInner() {
    const m = currentTotal(); const n = items.filter(i => i.kind === 'food').length;
    const est = items.some(i => i.kind === 'food' && i.food.sugg);
    return `<div class="total-top">
        <div><div class="eyebrow">Total · ${n} food${n === 1 ? '' : 's'}</div><div class="kcal-big">${k0(m.kcal)}<span>kcal</span></div></div>
        <button class="btn ghost small" type="button" data-act="recipe" title="Save these ingredients as one food, e.g. your own sauce">Save as recipe</button>
      </div>
      ${macroTiles(m, true)}
      ${splitBar(m)}
      ${est ? '<div class="note">Includes an estimate from Suggestions, so this total is approximate.</div>' : ''}
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
          <div class="muted small">${sug.length ? 'There is an estimate in Suggestions. Tap it to use it on purpose.' : 'Not in the database yet.'}</div></div>
          <button class="remove" type="button" data-act="remove" aria-label="Remove">&times;</button></div>
        ${sug.length ? `<div class="suggest"><span class="muted">Suggestions</span>${sug.map(f => `<button class="chip est" type="button" data-act="pick" data-id="${esc(f.id)}">${esc(f.name)} · estimate</button>`).join('')}</div>` : ''}
        ${it.suggestions.length ? `<div class="suggest"><span class="muted">Did you mean</span>${it.suggestions.map(f => `<button class="chip" type="button" data-act="pick" data-id="${esc(f.id)}">${esc(f.name)}</button>`).join('')}</div>` : ''}
        <div class="row-actions"><button class="btn small outline" type="button" data-act="custom">+ Add “${esc(it.query)}” as my food</button></div>
      </div>`;
    }
    const m = E.macros(it.food, it.grams);
    const notes = [];
    if (it.note === 'default') notes.push(`No amount given, so it assumed ${E.amountText(it.food, it.qty, it.unit)}. Change it above.`);
    if (it.note === 'approx') notes.push(`There's no standard “${E.unitLabel(it.unit, 1)}” size for this food, so this is estimated. Switch to grams for accuracy.`);
    if (it.food.sugg && !it.parent) notes.push('Estimate from Suggestions (no lab value). It can be off by ±15–20%.');
    const alts = it.alts && it.alts.length ? `<select class="select alt" aria-label="Pick a different food"><option value="">Not it? Pick another…</option>${it.alts.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}<option value="__search">Search all foods…</option></select>` : `<button class="linkish small-link" type="button" data-act="find">Not it? Search all foods</button>`;
    return `<div class="card item" data-i="${i}">
      <div class="item-head">
        <div class="item-name">${esc(it.food.name)} ${badge(it.food)}${it.parent ? `<span class="parent-tag">${esc(it.parent)}</span>` : ''}</div>
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
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'recent') { const f = E.byId(b.dataset.id); if (f) appendQuery(`${defaultAmountText(f)} ${f.key}`); return; }
    if (act === 'add') return addCurrent();
    if (act === 'recipe') return openRecipeForm();
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

  function emptyState() {
    const rec = recent.map(id => E.byId(id)).filter(Boolean).slice(0, 8);
    return `<div class="empty">
      ${rec.length ? `<h3 class="section-title">Recent — tap to add</h3><div class="chips">${rec.map(f => `<button class="chip" type="button" data-act="recent" data-id="${esc(f.id)}">${esc(f.name)}</button>`).join('')}</div>`
        : '<p class="muted" style="margin:18px 4px">Foods you add will show up here so you can tap them next time.</p>'}
    </div>`;
  }

  function addCurrent() {
    const foods = items.filter(i => i.kind === 'food');
    if (!foods.length) return toast('Nothing to add yet.');
    const meal = $('#mealSel') ? $('#mealSel').value : defaultMeal();
    const { added, kc, day } = logToDay(foods, meal);
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
    $('#daySub').textContent = isCur ? 'Current day' : `${when(day.start)} – ${when(days[viewIdx + 1].start)}`;
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
    <p class="muted small" style="margin:12px 0 0">${entries.length ? (left >= 0 ? `<b>${k0(left)} kcal</b> left to reach your target.` : `<b>${k0(-left)} kcal</b> over your target.`) + ` Protein to go: <b>${fmt(Math.max(T.p - tot.p, 0), 0)} g</b>.` : `Target: ${k0(T.kcal)} kcal · ${fmt(T.p, 0)} g protein${activePhase() ? ` (${esc(activePhase().name)})` : ''}. Change it in Menu → Goals.`}</p></div>`;
    if (isCur) { const wc = waterCfg(); html = html.replace('</p></div>', `</p><a class="water-line" href="#add">Water: <b>${day.water || 0} of ${wc.goal}</b> glasses · tap to add</a></div>`); }
    if (isCur && settings.setupDone && !(settings.tour && settings.tour.hide)) html = `<div class="card tour-card"><div><b>New here?</b><span>Take the 2-minute tour of everything maCros can do.</span></div>
      <div class="row-actions" style="margin-top:10px"><button class="btn small" type="button" data-act="tour">Start the tour</button><button class="btn ghost small" type="button" data-act="tourhide">Not now</button></div></div>` + html;
    if (isCur && weighDue().due) html = `<a class="due-banner" href="#progress"><span><b>Weigh-in time</b> · log your weight to keep your estimate on track</span><span aria-hidden="true">&#8250;</span></a>` + html;

    const notes = day.notes || {};
    if (!entries.length) {
      html += `<div class="card" style="text-align:center;margin-top:12px"><p style="margin:4px 0 12px">Nothing logged on Day ${day.n} yet.</p>
        ${isCur ? '<a class="btn" href="#add">Add food</a>' : ''}</div>`;
    }
    {
      for (const meal of MEALS) {
        const list = entries.filter(e => e.meal === meal); if (!list.length && !notes[meal]) continue;
        const mt = E.sumMacros(list);
        html += `<div class="meal-head"><h2>${meal}</h2><span>${list.length ? `${k0(mt.kcal)} kcal · P ${fmt(mt.p, 0)} · C ${fmt(mt.c, 0)} · F ${fmt(mt.f, 0)}` : ''}</span>
            <button class="note-btn${notes[meal] ? ' has' : ''}" type="button" data-act="note" data-meal="${meal}" aria-label="${notes[meal] ? 'View' : 'Add'} ${meal.toLowerCase()} note">${NOTE_ICON}</button></div>
          ${notes[meal] ? `<button class="meal-note" type="button" data-act="note" data-meal="${meal}">${esc(notes[meal])}</button>` : ''}
          ${list.length ? `<div class="card">${list.map(e => `<div class="entry" data-id="${esc(e.id)}">
            <div class="e-main"><div class="e-name">${esc(e.name)}${e.est ? ' <span class="badge E">Estimate</span>' : ''}</div><div class="e-sub">${esc(e.amt)}</div>${mchips(e, false)}</div>
            <div class="e-kcal">${k0(e.kcal)}</div>
            <button class="remove" type="button" data-act="del" aria-label="Delete ${esc(e.name)}">&times;</button></div>`).join('')}</div>` : ''}`;
      }
    }
    html += `<div class="today-actions">
      ${isCur ? `<button class="btn outline grow" type="button" data-act="newday">Start Day ${day.n + 1}</button>` : `<button class="btn ghost small" type="button" data-act="gocur">Go to current day (Day ${curDay().n})</button>`}
      ${entries.length ? '<button class="btn ghost small" type="button" data-act="copy">Copy day summary</button>' : ''}</div>
      ${reminderBtn('day')}`;
    $('#dayBody').innerHTML = html;
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
    if (b.dataset.act === 'copy') {
      const t = E.sumMacros(day.entries);
      const lines = [`Day ${day.n} (${when(day.start)}): ${k0(t.kcal)} kcal · P ${fmt(t.p, 0)}g · C ${fmt(t.c, 0)}g · F ${fmt(t.f, 0)}g · Fiber ${fmt(t.fib, 0)}g`];
      for (const meal of MEALS) {
        const l = day.entries.filter(x => x.meal === meal); const note = (day.notes || {})[meal]; if (!l.length && !note) continue;
        lines.push('', meal + ':'); l.forEach(x => lines.push(`- ${x.name}, ${x.amt}: ${k0(x.kcal)} kcal, P ${fmt(x.p)} C ${fmt(x.c)} F ${fmt(x.f)}`));
        if (note) lines.push(`Note: ${note}`);
      }
      copyText(lines.join('\n'));
    }
  });
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
  const MODES = { db: 'Database', sugg: 'Suggestions', eats: 'My Eats' };
  let foodSrc = 'all', foodMode = 'db', foodT;
  // "Sources": foods where that macro carries most of the calories (fiber: at least 3 g per 100 g)
  const SRC = [['all', 'All'], ['p', 'Protein'], ['c', 'Carbs'], ['f', 'Fat'], ['fib', 'Fiber']];
  const isSource = (f, k) => !f.parts && f.kcal > 0 && (k === 'p' ? f.p * 4 / f.kcal >= 0.35 && f.p >= 8
    : k === 'c' ? f.c * 4 / f.kcal >= 0.6 && f.c >= 15 : k === 'f' ? f.f * 9 / f.kcal >= 0.6 && f.f >= 10 : f.fib >= 3);
  const openCats = new Set();   // categories opened in the "All" list (all start closed)
  $('#foodSearch').addEventListener('input', () => { clearTimeout(foodT); foodT = setTimeout(renderFoodList, 120); });
  $('#cats').addEventListener('click', e => { const b = e.target.closest('[data-src]'); if (!b) return; foodSrc = b.dataset.src; renderFoods(); });
  $('#foodModes').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (!b) return; foodMode = b.dataset.mode; foodSrc = 'all'; renderFoods(); });
  $('#addCustomBtn').addEventListener('click', () => openCustomForm({}));
  $('#foodList').addEventListener('click', e => {
    const h = e.target.closest('[data-toggle-cat]');
    if (h) {
      const c = h.dataset.toggleCat; const open = !openCats.has(c);
      if (open) openCats.add(c); else openCats.delete(c);
      h.setAttribute('aria-expanded', open); h.nextElementSibling.hidden = !open;
      return;
    }
    const b = e.target.closest('[data-id],[data-eat]'); if (!b) return;
    if (b.dataset.eat) openEat(b.dataset.eat); else openFood(b.dataset.id);
  });
  const inMode = f => (foodMode === 'sugg' ? f.sugg : !f.sugg);

  function renderFoods() {
    $('#foodModes').innerHTML = Object.entries(MODES).map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === foodMode}" class="${k === foodMode ? 'on' : ''}" data-mode="${k}">${l}</button>`).join('');
    $('#cats').hidden = foodMode === 'eats';
    $('#cats').innerHTML = SRC.map(([k, l]) => `<button class="chip src-${k}${k === foodSrc ? ' on' : ''}" type="button" role="tab" aria-selected="${k === foodSrc}" data-src="${k}">${l}</button>`).join('');
    $('#foodSearch').placeholder = foodMode === 'eats' ? 'Search what you’ve eaten…' : foodMode === 'sugg' ? 'Search estimates (adobo, sinigang…)' : 'Search the list (chicken, kanin, whey…)';
    $('#foodsFoot').innerHTML = reminderBtn('add');
    renderFoodList();
  }
  function foodRow(f) {
    const def = f.parts ? { qty: 1, unit: 'plate', grams: f.comboGrams } : E.amount(f, null, null);
    const m = E.macros(f, def.grams);
    const per = f.parts ? `${f.parts.length} parts · per plate` : `per 100 g · ${k0(f.kcal)} kcal`;
    return `<button class="food-row" type="button" data-id="${esc(f.id)}"><div class="fr-main"><div class="fr-name">${esc(f.name)} ${badge(f)}</div><div class="fr-sub">${per}</div>${mchips(f.parts ? m : f, false)}</div>
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
    const term = $('#foodSearch').value.trim();
    const list = $('#foodList');
    if (foodMode === 'eats') {
      let eats = myEats();
      if (term) { const t = term.toLowerCase(); eats = eats.filter(x => x.last.name.toLowerCase().includes(t)); }
      $('#foodCount').textContent = eats.length ? `${eats.length} item${eats.length === 1 ? '' : 's'}` : '';
      list.innerHTML = eats.length ? eats.map(x => `<button class="food-row" type="button" data-eat="${esc(x.key)}"><div class="fr-main"><div class="fr-name">${esc(x.last.name)}${x.last.est ? ' <span class="badge E">Estimate</span>' : ''}</div>
          <div class="fr-sub">${esc(x.last.amt)} · eaten ${x.count}× · last ${esc(when(x.last.t))}</div></div><div class="fr-kcal">${k0(x.last.kcal)}<small>P ${fmt(x.last.p, 0)} g</small></div></button>`).join('')
        : `<div style="padding:18px;text-align:center"><p class="muted" style="margin:0">${term ? 'Nothing you’ve logged matches that.' : 'Foods you add to your day will show up here.'}</p></div>`;
      return;
    }
    let foods;
    if (term) foods = E.search(term, { prefix: true, limit: 60, scope: foodMode === 'sugg' ? 'sugg' : 'calc' }).map(r => r.food);
    else foods = E.all().filter(inMode);
    const srcLabel = foodSrc === 'all' ? '' : SRC.find(x => x[0] === foodSrc)[1].toLowerCase();
    if (foodSrc !== 'all') foods = foods.filter(f => isSource(f, foodSrc)).sort((a, b) => b[foodSrc] - a[foodSrc]);
    $('#foodCount').textContent = (term ? `${foods.length} match${foods.length === 1 ? '' : 'es'} for “${term}”` : `${foods.length} foods`)
      + (srcLabel ? ` · best ${srcLabel} sources first (per 100 g)` : '');
    if (!foods.length) {
      list.innerHTML = `<div style="padding:18px;text-align:center"><p style="margin:0 0 12px">No food matches${term ? ` “${esc(term)}”` : ''}.</p><button class="btn small" type="button" id="addFromSearch">+ Add it as my food</button></div>`;
      $('#addFromSearch').onclick = () => openCustomForm({ name: term });
      return;
    }
    if (!term && foodSrc === 'all') {
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
      <div class="row-actions"><button class="btn ghost small" type="button" id="fdUse">Add to Identify list</button>
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
      <div class="row-actions"><button class="btn ghost small" type="button" id="cbUse">Open in Identify</button></div>`);
    const plates = () => { const v = parseFloat($('#cbQty').value) || 0; return mode === 'g' ? (plateG() ? v / plateG() : 0) : v; };
    const renderParts = () => {
      $('#cbParts').innerHTML = parts.map((pt, i) => `<li data-pi="${i}"><div class="cp-name">${esc(pt.food.name)} ${badge(pt.food)}<small class="muted">${k0(E.macros(pt.food, pt.grams).kcal)} kcal${pcs(pt)}</small></div>
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
  function openEat(key) {
    const x = myEats().find(e => e.key === key); if (!x) return;
    const e = x.last; const f = E.byId(e.fid);
    openSheet(`${sheetHead(esc(e.name), `${esc(e.amt)} · eaten ${x.count}× · last ${esc(when(e.t))}`)}
      <div class="kcal-big">${k0(e.kcal)}<span>kcal</span></div>${macroTiles(e, false)}
      ${f ? '' : '<div class="note">This food is no longer in the database (it may have been a deleted custom food). Logging again reuses the saved numbers.</div>'}
      <div class="add-row">${mealSelect('eatMeal', defaultMeal())}<button class="btn grow" type="button" id="eatAdd">Log again to Day ${curDay().n}</button></div>
      ${f ? '<div class="row-actions"><button class="btn ghost small" type="button" id="eatUse">Add to Identify list (to change the amount)</button></div>' : ''}`);
    $('#eatAdd').onclick = () => {
      const meal = $('#eatMeal').value; const day = curDay();
      const copy = { ...e, id: uid(), meal, t: Date.now() };
      day.entries.push(copy); settings.lastMeal = meal; saveSettings(); saveDays(); updatePill(); closeSheet();
      toast(`Logged ${e.name} to Day ${day.n} · ${k0(e.kcal)} kcal`, { label: 'Undo', run: () => undoLog(day, [copy.id]) });
    };
    if (f) $('#eatUse').onclick = () => { closeSheet(); location.hash = '#add'; appendQuery(`${fmt(e.grams, 0)}g ${f.key}`); };
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
  function openCustomForm(pre) {
    pre = pre || {};
    const editing = !!pre.id;
    const servUnit = pre.d && pre.d !== 'g' ? pre.d : '';
    const servG = servUnit && pre.units ? pre.units[servUnit] : '';
    openSheet(`${sheetHead(editing ? 'Edit ' + esc(pre.name) : 'Add my own food', 'Copy the numbers from a nutrition label or a trusted source. It\'s saved on this device.')}
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
      </div>
      <div class="card settings-card"><h2>About the numbers</h2>
        <ul class="legend-list">
          <li><span class="badge U">USDA</span> USDA FoodData Central lab values.</li>
          <li><span class="badge F">FNRI</span> FNRI Philippine Food Composition Tables (PhilFCT), measured from Philippine foods.</li>
          <li><span class="badge L">Label</span> Manufacturer label (USDA Branded Foods). Check your exact pack.</li>
          <li><span class="badge E">Estimate</span> Recipe estimates with no lab value. These live only in <b>Suggestions</b> and are used only when you pick one.</li>
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
    return S.plan({ ...settings.profile, kg: currentKg(), goal: t.goal }).targets;
  }
  function switchPhase(id) {
    syncPhase(); const ph = settings.phases.find(p => p.id === id); if (!ph || ph.id === settings.phaseId) return;
    settings.phaseId = id; settings.targets = { ...ph.targets }; settings.locks = { ...(ph.locks || {}) };
    saveSettings(); updatePill(); toast(`Switched to ${ph.name}: ${k0(ph.targets.kcal)} kcal`);
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
    const T = settings.targets, L = settings.locks, prof = settings.profile;
    const lockBtn = k => `<button type="button" class="lock${L[k] ? ' on' : ''}" data-lock="${k}" aria-pressed="${!!L[k]}" aria-label="${L[k] ? 'Unlock' : 'Lock'} ${k}" title="${L[k] ? 'Locked: stays as you set it' : 'Auto: follows calories'}">${L[k] ? LOCK : UNLOCK}</button>`;
    $('#goalsBody').innerHTML = `
      <div class="card settings-card"><h2>Current goal</h2>
        <p class="muted small" style="margin:0">${prof ? esc(S.summary({ ...prof, kg: currentKg() })) : 'Not set up yet.'}</p>
        <div class="row-actions"><button class="btn small outline" type="button" id="redoSetupBtn">Redo setup</button></div></div>
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
    const tdee = settings.profile && settings.profile.kg ? S.plan({ ...settings.profile, kg: currentKg() }).tdee : 0;
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
        : `<p class="muted small" style="margin:0">${days.some(d => d.entries.length) ? 'Averages show once you finish a day (Start the next day on Today).' : 'No days logged in this period yet.'}</p>`}</div>
      ${prof ? `<div class="card settings-card"><div class="card-head"><h2>Weight trend</h2>${trendPts.length ? `<span class="trend-val">${wShow(trendNow)}</span>` : ''}</div>
        ${trendPts.length ? `${trendChart(trendPts, chartFrom)}
          <div class="chart-legend"><span><i class="lg-dot"></i>Scale weight</span><span><i class="lg-line"></i>Trend</span></div>
          <p class="muted small" style="margin:8px 0 0">Scale weight jumps around with water, salt and food in your stomach. The trend line smooths that out, so watch the line, not single readings.${trendChange != null ? ` Trend change in this period: <b>${wDelta(trendChange)}</b>.` : ''}</p>`
        : '<p class="muted small" style="margin:0">Log a weigh-in below to start your trend line.</p>'}</div>` : ''}
      <div class="card settings-card"><h2>Weight</h2>
        ${prof ? `<div class="stat-grid">
          <div><small>Current</small><b>${wShow(cur)}</b><span>${latest ? 'weighed ' + shortDate(latest.t) : 'from setup'}</span></div>
          <div><small>Estimated from eating</small><b>${st.estChange != null && st.count ? wDelta(st.estChange) : '—'}</b><span>vs burning ${k0(st.tdee)} kcal/day</span></div>
          ${actual != null ? `<div><small>Actual (weigh-ins)</small><b>${wDelta(actual)}</b><span>since ${shortDate(base.t)}</span></div>` : ''}
          ${tgt ? `<div><small>Goal</small><b>${wShow(tgt)}</b><span>${eta ? `about ${eta} week${eta === 1 ? '' : 's'} at this pace` : st.count >= 3 ? 'not moving toward it yet' : ''}</span></div>` : ''}</div>
          <p class="muted small" style="margin:12px 0 0">${proj ? `If you keep eating like this, you'd weigh about ${proj}. Weigh in regularly so this stays accurate.` : 'Log at least 3 full days to see where your weight is heading.'}</p>`
        : '<p class="muted small" style="margin:0">Finish setup to see weight estimates.</p>'}</div>
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
  const glassSvg = fill => `<svg viewBox="0 0 40 48" width="44" height="52" aria-hidden="true"><defs><clipPath id="glassClip"><path d="${GLASS_PATH}"/></clipPath></defs>
    <rect x="0" y="${(4 + 41 * (1 - fill)).toFixed(1)}" width="40" height="48" class="glass-water" clip-path="url(#glassClip)"/><path d="${GLASS_PATH}" class="glass-edge"/></svg>`;
  function renderWater() {
    const d = curDay(), c = waterCfg(), n = d.water || 0;
    $('#water').innerHTML = `<button class="glass-btn" type="button" id="waterAdd" aria-label="Log one glass of water (${c.ml} ml)">${glassSvg(Math.min(n / c.goal, 1))}</button>
      <div class="water-txt"><b>${n} of ${c.goal} glasses</b><small>${k0(n * c.ml)} ml today · tap the glass after each one</small></div>
      ${n ? '<button class="icon-btn" type="button" id="waterUndo" aria-label="Remove one glass">&minus;</button>' : ''}`;
    $('#waterAdd').onclick = () => {
      d.water = n + 1; saveDays(); renderWater(); $('#waterAdd').classList.add('pop');
      if (d.water === c.goal) toast('Water goal reached. Nice!');
    };
    if (n) $('#waterUndo').onclick = () => { d.water = Math.max(0, n - 1); saveDays(); renderWater(); };
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
  const TOUR = [
    { t: 'Your Dashboard', go: '#day', b: 'The ring shows calories eaten against your target, and the bars show protein, carbs, fat and fiber. Tap the calories at the top right to see what’s <b>left</b>. Swipe left (or tap <b>This week</b>) for Monday to Sunday.' },
    { t: 'Add what you eat', go: '#add', b: 'Type or tap the mic: <i>“2 eggs and 1 cup rice”</i>, <i>“150 g chicken breast”</i>, or by calories: <i>“300 kcal nuggets”</i>. Check each match, switch <b>Cooked / Raw</b> if needed, then tap <b>Add to Day</b>.' },
    { t: 'Browse foods', go: '#add', b: 'Below the box you can browse every food. Tap <b>Protein</b>, <b>Carbs</b>, <b>Fat</b> or <b>Fiber</b> to see the best sources. Silog meals let you change each part, like adding an extra hotdog.' },
    { t: 'Drink water', go: '#add', b: 'Tap the glass on the Add page after every glass of water. Set your daily goal and glass size in Menu → Settings.' },
    { t: 'Notes and new days', go: '#day', b: 'Tap the note icon next to a meal to write how it went. When your day ends, tap <b>Start Day 2</b>. Days never change by themselves at midnight.' },
    { t: 'Goals and phases', go: '#goals', b: 'Menu → Goals holds your targets. Change calories and the macros follow; type a macro to lock it. Add phases like Bulking, Cutting or Hyrox and switch whenever your plan changes.' },
    { t: 'Progress and weigh-ins', go: '#progress', b: 'Menu → Progress shows days logged, your averages and your weight trend. Weigh in at the same time each time; the trend line smooths out daily ups and downs.' },
    { t: 'Stuck? Look for Reminder', go: '#day', b: 'Every page has a <b>Reminder</b> button at the bottom with a quick explanation. You can replay this tour any time from Menu → Tutorial.' },
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
        <p class="muted small" style="margin:0">Eight short steps that show every part of maCros. About 2 minutes.</p>
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
  function openTour(i) {
    const st = TOUR[i];
    openSheet(`${sheetHead(`${i + 1}. ${st.t}`, `Step ${i + 1} of ${TOUR.length}`)}
      <div class="tour-dots" aria-hidden="true">${TOUR.map((_, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</div>
      <p class="tour-body">${st.b}</p>
      <div class="add-row">${i > 0 ? '<button class="btn ghost" type="button" id="tourBack">Back</button>' : ''}
        <button class="btn grow" type="button" id="tourNext">${i < TOUR.length - 1 ? 'Next' : 'Finish'}</button></div>
      <div class="row-actions"><button class="btn ghost small" type="button" id="tourShow">Show me this page</button></div>`);
    if (i > 0) $('#tourBack').onclick = () => openTour(i - 1);
    $('#tourNext').onclick = () => {
      if (i < TOUR.length - 1) return openTour(i + 1);
      settings.tour = Object.assign({}, settings.tour, { seen: true, hide: true }); saveSettings(); closeSheet();
      toast('Tour done. Your first-week checklist is in Menu → Tutorial.'); route();
    };
    $('#tourShow').onclick = () => { closeSheet(); if (location.hash === st.go) route(); else location.hash = st.go; };
  }

  // ---------- Setup (body stats + goal → targets) ----------
  function openSetup(canCancel) {
    const appEl = $('#app'), box = $('#setup');
    const close = () => { box.hidden = true; box.innerHTML = ''; appEl.hidden = false; window.scrollTo(0, 0); };
    appEl.hidden = true; box.hidden = false;
    window.MacrosSetup.open(box, {
      profile: settings.profile,
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
