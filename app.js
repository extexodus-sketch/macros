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
  // Bulking targets: 2,332 kcal / 129 g protein (given); fat 25% of kcal; carbs fill the rest; fiber 14 g per 1,000 kcal.
  const DEFAULTS = { targets: { kcal: 2332, p: 129, c: 308, f: 65, fib: 33 }, voiceLang: 'en-PH', theme: 'auto', lastMeal: 'Breakfast' };
  const OLD_DEFAULT_TARGETS = { kcal: 2000, p: 140, c: 200, f: 65, fib: 30 };
  function readSettings() {
    const st = Object.assign({}, DEFAULTS, store.get('settings', {}));
    if (!st.targets || JSON.stringify(st.targets) === JSON.stringify(OLD_DEFAULT_TARGETS)) st.targets = { ...DEFAULTS.targets };
    st.targets = Object.assign({}, DEFAULTS.targets, st.targets);
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
  const mealSelect = (id, sel) => `<select class="select" id="${id}" aria-label="Meal">${MEALS.map(m => `<option${m === sel ? ' selected' : ''}>${m}</option>`).join('')}</select>`;
  const unitOptions = (food, unit) => E.unitsFor(food).map(u => `<option value="${u.key}"${u.key === unit ? ' selected' : ''}>${u.key === 'g' ? 'grams' : esc(E.unitLabel(u.key, 1)) + ' (' + fmt(u.grams, 0) + ' g)'}</option>`).join('')
    + (unit && !food.units[unit] && unit !== 'g' ? `<option value="${unit}" selected>${esc(E.unitLabel(unit, 1))}</option>` : '');
  const amtLabel = (food, qty, unit, grams) => unit === 'g' ? `${fmt(grams, 0)} g` : `${E.amountText(food, qty, unit)} · ${fmt(grams, 0)} g`;

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
  function undoLog(day, ids) { day.entries = day.entries.filter(e => !ids.includes(e.id)); saveDays(); updatePill(); if (!$('#view-day').hidden) renderDay(); }

  // ---------- Routing ----------
  const TABS = ['identify', 'day', 'foods', 'settings'];
  function route() {
    let tab = location.hash.slice(1); if (tab === 'today') tab = 'day';
    if (!TABS.includes(tab)) tab = 'identify';
    TABS.forEach(t => { $('#view-' + t).hidden = t !== tab; });
    $$('.tabbar a').forEach(a => a.classList.toggle('on', a.dataset.tab === tab));
    if (tab === 'day') { viewIdx = days.length - 1; renderDay(); }
    if (tab === 'foods') renderFoods();
    if (tab === 'settings') renderSettings();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  function updatePill() {
    const d = curDay(); const tot = E.sumMacros(d.entries);
    $('#todayPill').textContent = `Day ${d.n} · ${k0(tot.kcal)} kcal`;
  }

  // ==========================================================
  // IDENTIFY
  // ==========================================================
  const q = $('#q');
  let items = [], parsedMeal = null, typingT;
  const EXAMPLES = [
    '150g lean ground pork, 1 cup rice',
    '1 cup cinnamon toast crunch with 1 cup milk',
    '200g chicken breast, 1 tbsp sriracha, 1 tbsp hoisin',
    '200g 93% lean ground beef and 1.5 cups rice',
    '2 pandesal, 2 eggs, 1 banana',
    'isang tasang kanin at 150g chicken breast',
  ];

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
  const itemMacrosHtml = m => MACROS.map(x => `<span><i class="dot-${x.cls}"></i>${x.label} <b>${fmt(m[x.k])}g</b></span>`).join('');
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
    const alts = it.alts && it.alts.length ? `<select class="select alt" aria-label="Pick a different food"><option value="">Not it? Pick another…</option>${it.alts.map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}<option value="__search">Search all foods…</option></select>` : '';
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
      </div>
      <div class="item-macros" data-k="macros">${itemMacrosHtml(m)}</div>
      ${alts ? `<div class="item-foot"><span>You typed “${esc(it.query)}”</span>${alts}</div>` : ''}
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
      if (nu === 'g') it.qty = Math.round(it.grams); else if (it.unit === 'g') it.qty = 1;
      it.unit = nu; const a = E.amount(it.food, it.qty, nu); it.grams = a.grams; it.note = a.note;
      renderResults();
    }
    if (e.target.matches('.alt')) {
      const id = e.target.value; if (!id) return;
      if (id === '__search') { location.hash = '#foods'; $('#foodSearch').value = it.query; renderFoods(); return; }
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
    if (act === 'example') return setQuery(b.dataset.q);
    if (act === 'recent') { const f = E.byId(b.dataset.id); if (f) appendQuery(`${defaultAmountText(f)} ${f.key}`); return; }
    if (act === 'add') return addCurrent();
    if (act === 'recipe') return openRecipeForm();
    const card = b.closest('[data-i]'); const i = card ? +card.dataset.i : -1; const it = items[i];
    if (act === 'remove') { items.splice(i, 1); if (!items.length) { q.value = ''; autosize(); } renderResults(); }
    if (act === 'pick') {
      const f = E.byId(b.dataset.id); const n = (it.qty || 1) * (it.mult || 1);
      if (f.parts) items.splice(i, 1, ...E.expandCombo(f, n));
      else {
        const a = E.amount(f, it.qty, it.unit, it.size || 1);
        items[i] = { kind: 'food', food: f, qty: a.qty * (it.mult || 1), unit: a.unit, grams: a.grams * (it.mult || 1), note: a.note, query: it.query, alts: [] };
      }
      renderResults();
    }
    if (act === 'custom') openCustomForm({ name: it.query });
  });

  function emptyState() {
    const rec = recent.map(id => E.byId(id)).filter(Boolean).slice(0, 8);
    return `<div class="empty">
      ${rec.length ? `<h3 class="section-title">Recent — tap to add</h3><div class="chips">${rec.map(f => `<button class="chip" type="button" data-act="recent" data-id="${esc(f.id)}">${esc(f.name)}</button>`).join('')}</div>` : ''}
      <h3 class="section-title">Try one of these</h3>
      <div class="chips">${EXAMPLES.map(x => `<button class="chip" type="button" data-act="example" data-q="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <h3 class="section-title">How it works</h3>
      <div class="card"><ol class="steps">
        <li><b class="n">1</b><div><b>Type or tap the mic</b> and say what you ate, with amounts: <span class="muted">“150 grams lean ground pork and one cup of rice”</span>. English, Tagalog or Taglish all work.</div></li>
        <li><b class="n">2</b><div><b>Check the matches.</b> Fix any amount or pick a different food. No amount? It assumes 1 normal serving and tells you.</div></li>
        <li><b class="n">3</b><div><b>Add to your day</b> for a running total. Made your own sauce? Type its ingredients and tap <b>Save as recipe</b>.</div></li>
      </ol></div>
      <p class="muted small" style="margin:14px 4px">Weights are <b>cooked, as eaten</b>; add “raw” for raw weights. Calculations use only USDA, FNRI and label values (${E.all().filter(f => !f.sugg).length} foods). Estimates sit separately in Foods → Suggestions.</p>
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
      <circle cx="60" cy="60" r="${r}" fill="none" stroke="${over ? 'var(--danger)' : 'var(--accent)'}" stroke-width="12" stroke-linecap="round"
        stroke-dasharray="${c * pct} ${c}"/></svg>
      <div class="ring-txt"><div><b>${k0(value)}</b><small>of ${k0(target)} kcal</small></div></div></div>`;
  }
  function renderDay() {
    const day = days[viewIdx]; const isCur = viewIdx === days.length - 1;
    $('#dayTitle').textContent = `Day ${day.n}`;
    $('#daySub').textContent = isCur ? `Current day · started ${when(day.start)}` : `${when(day.start)} – ${when(days[viewIdx + 1].start)}`;
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
    <p class="muted small" style="margin:12px 0 0">${entries.length ? (left >= 0 ? `<b>${k0(left)} kcal</b> left to reach your target.` : `<b>${k0(-left)} kcal</b> over your target.`) + ` Protein to go: <b>${fmt(Math.max(T.p - tot.p, 0), 0)} g</b>.` : `Target: ${k0(T.kcal)} kcal · ${fmt(T.p, 0)} g protein (bulking). Change it in Settings.`}</p></div>`;

    if (!entries.length) {
      html += `<div class="card" style="text-align:center;margin-top:12px"><p style="margin:4px 0 12px">Nothing logged on Day ${day.n} yet.</p>
        ${isCur ? '<a class="btn" href="#identify">Identify a food</a>' : ''}</div>`;
    } else {
      for (const meal of MEALS) {
        const list = entries.filter(e => e.meal === meal); if (!list.length) continue;
        const mt = E.sumMacros(list);
        html += `<div class="meal-head"><h2>${meal}</h2><span>${k0(mt.kcal)} kcal · P ${fmt(mt.p, 0)} · C ${fmt(mt.c, 0)} · F ${fmt(mt.f, 0)}</span></div>
          <div class="card">${list.map(e => `<div class="entry" data-id="${esc(e.id)}">
            <div class="e-main"><div class="e-name">${esc(e.name)}${e.est ? ' <span class="badge E">Estimate</span>' : ''}</div><div class="e-sub">${esc(e.amt)} · P ${fmt(e.p)} · C ${fmt(e.c)} · F ${fmt(e.f)} · Fiber ${fmt(e.fib)}</div></div>
            <div class="e-kcal">${k0(e.kcal)}</div>
            <button class="remove" type="button" data-act="del" aria-label="Delete ${esc(e.name)}">&times;</button></div>`).join('')}</div>`;
      }
    }
    html += `<div class="today-actions">
      ${isCur ? `<button class="btn outline grow" type="button" data-act="newday">Done with Day ${day.n} → start Day ${day.n + 1}</button>` : `<button class="btn ghost small" type="button" data-act="gocur">Go to current day (Day ${curDay().n})</button>`}
      ${entries.length ? '<button class="btn ghost small" type="button" data-act="copy">Copy day summary</button>' : ''}</div>
      ${isCur ? '<p class="muted small" style="margin:10px 4px 0">Days only change when you tap this button, never at midnight.</p>' : ''}`;
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
      if (!confirm(`Finish Day ${cur.n} and start Day ${cur.n + 1}? You can still view and edit past days.`)) return;
      days.push(newDay(cur.n + 1)); settings.lastMeal = 'Breakfast'; saveSettings(); saveDays();
      viewIdx = days.length - 1; updatePill(); renderDay();
      toast(`Day ${cur.n + 1} started`, { label: 'Undo', run: () => { if (curDay().entries.length) return; days.pop(); saveDays(); viewIdx = days.length - 1; updatePill(); renderDay(); } });
    }
    if (b.dataset.act === 'gocur') { viewIdx = days.length - 1; renderDay(); }
    if (b.dataset.act === 'copy') {
      const t = E.sumMacros(day.entries);
      const lines = [`Day ${day.n} (${when(day.start)}): ${k0(t.kcal)} kcal · P ${fmt(t.p, 0)}g · C ${fmt(t.c, 0)}g · F ${fmt(t.f, 0)}g · Fiber ${fmt(t.fib, 0)}g`];
      for (const meal of MEALS) { const l = day.entries.filter(x => x.meal === meal); if (!l.length) continue; lines.push('', meal + ':'); l.forEach(x => lines.push(`- ${x.name}, ${x.amt}: ${k0(x.kcal)} kcal, P ${fmt(x.p)} C ${fmt(x.c)} F ${fmt(x.f)}`)); }
      copyText(lines.join('\n'));
    }
  });
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
  let foodCat = 'All', foodMode = 'db', foodT;
  $('#foodSearch').addEventListener('input', () => { clearTimeout(foodT); foodT = setTimeout(renderFoodList, 120); });
  $('#cats').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; foodCat = b.dataset.cat; renderFoods(); });
  $('#foodModes').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (!b) return; foodMode = b.dataset.mode; foodCat = 'All'; renderFoods(); });
  $('#addCustomBtn').addEventListener('click', () => openCustomForm({}));
  $('#foodList').addEventListener('click', e => {
    const b = e.target.closest('[data-id],[data-eat]'); if (!b) return;
    if (b.dataset.eat) openEat(b.dataset.eat); else openFood(b.dataset.id);
  });
  const inMode = f => (foodMode === 'sugg' ? f.sugg : !f.sugg);

  function renderFoods() {
    $('#foodModes').innerHTML = Object.entries(MODES).map(([k, l]) => `<button type="button" role="tab" aria-selected="${k === foodMode}" class="${k === foodMode ? 'on' : ''}" data-mode="${k}">${l}</button>`).join('');
    const present = new Set(E.all().filter(inMode).map(f => f.cat));
    $('#cats').hidden = foodMode === 'eats';
    $('#cats').innerHTML = CATS.filter(c => c === 'All' || present.has(c)).map(c => `<button class="chip${c === foodCat ? ' on' : ''}" type="button" role="tab" aria-selected="${c === foodCat}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
    $('#foodSearch').placeholder = foodMode === 'eats' ? 'Search what you’ve eaten…' : foodMode === 'sugg' ? 'Search estimates (adobo, sinigang…)' : 'Search foods (chicken, kanin, whey…)';
    $('#modeNote').innerHTML = foodMode === 'sugg' ? 'Recipe-based <b>estimates</b> with no official lab value. They never feed into calculations on their own; tap one to use it on purpose.'
      : foodMode === 'eats' ? 'Everything you’ve logged, most recent first. Tap one to log the same amount again.'
      : 'Verified values (USDA, FNRI, labels), plus your own foods and recipes. Typing matches against these.';
    renderFoodList();
  }
  function foodRow(f) {
    const def = f.parts ? { qty: 1, unit: 'plate', grams: f.comboGrams } : E.amount(f, null, null);
    const m = E.macros(f, def.grams);
    const per = f.parts ? `${f.parts.length} parts · P ${fmt(m.p, 0)} · C ${fmt(m.c, 0)} · F ${fmt(m.f, 0)}` : `per 100 g: ${k0(f.kcal)} kcal · P ${fmt(f.p)} · C ${fmt(f.c)} · F ${fmt(f.f)} · Fib ${fmt(f.fib)}`;
    return `<button class="food-row" type="button" data-id="${esc(f.id)}"><div class="fr-main"><div class="fr-name">${esc(f.name)} ${badge(f)}</div><div class="fr-sub">${per}</div></div>
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
    foods = foods.filter(f => foodCat === 'All' || f.cat === foodCat);
    $('#foodCount').textContent = term ? `${foods.length} match${foods.length === 1 ? '' : 'es'} for “${term}”` : `${foods.length} foods${foodCat === 'All' ? '' : ' in ' + foodCat}`;
    if (!foods.length) {
      list.innerHTML = `<div style="padding:18px;text-align:center"><p style="margin:0 0 12px">No food matches “${esc(term)}”.</p><button class="btn small" type="button" id="addFromSearch">+ Add it as my food</button></div>`;
      $('#addFromSearch').onclick = () => openCustomForm({ name: term });
      return;
    }
    if (!term && foodCat === 'All') {
      const groups = {}; foods.forEach(f => (groups[f.cat] = groups[f.cat] || []).push(f));
      list.innerHTML = CATS.filter(c => groups[c]).map(c => `<div class="cat-head">${esc(c)}</div>${groups[c].map(foodRow).join('')}`).join('');
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
    $('#fdUnit').addEventListener('change', () => { $('#fdQty').value = $('#fdUnit').value === 'g' ? Math.round(E.gramsFor(f, def.qty, def.unit)) : 1; calc(); });
    $('#fdAdd').onclick = () => {
      const { qty, unit, g } = calc(); if (!g) return toast('Enter an amount first.');
      const meal = $('#fdMeal').value; const { added, kc, day } = logToDay([{ food: f, qty, unit, grams: g }], meal); closeSheet();
      toast(`Added to Day ${day.n} · ${meal} · ${k0(kc)} kcal`, { label: 'Undo', run: () => undoLog(day, added) });
    };
    $('#fdUse').onclick = () => { const { qty, unit } = calc(); closeSheet(); location.hash = '#identify'; appendQuery(`${E.amountText(f, qty, unit)} ${f.key}`); };
    if (f.custom) {
      $('#fdEdit').onclick = () => openCustomForm(custom.find(c => c.id === f.id));
      $('#fdDel').onclick = () => {
        if (!confirm(`Delete “${f.name}”? Days you already logged keep their numbers.`)) return;
        custom = custom.filter(c => c.id !== f.id); saveCustom(); closeSheet(); renderFoods(); toast('Deleted');
      };
    }
  }
  function openCombo(f) {
    openSheet(`${sheetHead(esc(f.name) + ' ' + badge(f), 'Silog meal · 1 plate ≈ ' + fmt(f.comboGrams, 0) + ' g' + (f.sugg ? ' · includes estimated parts' : ''))}
      <div class="item-amount"><input class="input qty" id="cbQty" type="number" inputmode="decimal" min="0" step="any" value="1" aria-label="Plates"><span class="muted">plate(s)</span></div>
      <div style="margin-top:14px"><div class="kcal-big" id="cbKcal"></div><div id="cbTiles"></div></div>
      <ul class="parts">${f.parts.map(p => `<li><span>${esc(p.food.name)} ${badge(p.food)}</span><span class="muted">${fmt(p.grams, 0)} g · ${k0(E.macros(p.food, p.grams).kcal)} kcal</span></li>`).join('')}</ul>
      <div class="add-row">${mealSelect('cbMeal', defaultMeal())}<button class="btn grow" type="button" id="cbAdd">Add to Day ${curDay().n}</button></div>
      <div class="row-actions"><button class="btn ghost small" type="button" id="cbUse">Open in Identify to adjust parts</button></div>`);
    const calc = () => { const n = parseFloat($('#cbQty').value) || 0; const m = E.macros(f, f.comboGrams * n); $('#cbKcal').innerHTML = `${k0(m.kcal)}<span>kcal</span>`; $('#cbTiles').innerHTML = macroTiles(m, false); return n; };
    calc(); $('#cbQty').addEventListener('input', calc);
    $('#cbAdd').onclick = () => {
      const n = calc(); if (!n) return; const meal = $('#cbMeal').value;
      const { added, kc, day } = logToDay(E.expandCombo(f, n), meal); closeSheet();
      toast(`Added to Day ${day.n} · ${meal} · ${k0(kc)} kcal`, { label: 'Undo', run: () => undoLog(day, added) });
    };
    $('#cbUse').onclick = () => { const n = calc(); closeSheet(); location.hash = '#identify'; items = E.expandCombo(f, n); q.value = `${n} ${f.key}`; autosize(); renderResults(); };
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
    if (f) $('#eatUse').onclick = () => { closeSheet(); location.hash = '#identify'; appendQuery(`${fmt(e.grams, 0)}g ${f.key}`); };
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
      if (!$('#view-foods').hidden) renderFoods();
      if (!$('#view-identify').hidden) identify();
    });
  }

  // ==========================================================
  // SETTINGS
  // ==========================================================
  function renderSettings() {
    const T = settings.targets;
    $('#settingsBody').innerHTML = `
      ${acct ? `<div class="card settings-card"><h2>Account</h2>
        <p class="muted small" style="margin:0">Signed in as <b>${esc(acct.email)}</b>${acct.provider === 'google.com' ? ' with Google' : ''}. Your days, recipes and foods are saved to your account and sync across your devices.</p>
        <div class="row-actions"><button class="btn ghost small" type="button" id="signOutBtn">Sign out</button></div></div>` : ''}
      <div class="card settings-card"><h2>Daily targets</h2>
        <div class="form-grid">
          ${[['kcal', 'Calories'], ['p', 'Protein (g)'], ['c', 'Carbs (g)'], ['f', 'Fat (g)'], ['fib', 'Fiber (g)']].map(([k, l]) => `<label class="field">${l}<input class="input" type="number" inputmode="numeric" min="0" data-target="${k}" value="${T[k]}"></label>`).join('')}
        </div>
        <p class="muted small" style="margin:10px 0 0">Saved automatically. Protein × 4 + Carbs × 4 + Fat × 9 = <b id="tgtCheck">${k0(T.p * 4 + T.c * 4 + T.f * 9)}</b> kcal.</p>
      </div>
      <div class="card settings-card"><h2>Preferences</h2>
        <div class="form-grid">
          <label class="field">Voice language<span class="hint">What the mic listens for</span><select class="select" id="setVoice">
            ${[['en-PH', 'English (Philippines)'], ['fil-PH', 'Filipino / Tagalog'], ['en-US', 'English (US)']].map(([v, l]) => `<option value="${v}"${v === settings.voiceLang ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          <label class="field">Appearance<span class="hint">Light or dark</span><select class="select" id="setTheme">${[['auto', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => `<option value="${v}"${v === settings.theme ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        </div>
        <p class="muted small" style="margin:10px 0 0">Days are manual: on <b>My Day</b>, tap “start Day ${curDay().n + 1}” whenever your day ends.</p>
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
    $$('[data-target]').forEach(inp => inp.addEventListener('input', () => {
      settings.targets[inp.dataset.target] = Math.max(0, parseFloat(inp.value) || 0); saveSettings();
      $('#tgtCheck').textContent = k0(settings.targets.p * 4 + settings.targets.c * 4 + settings.targets.f * 9);
    }));
    $('#setVoice').onchange = e => { settings.voiceLang = e.target.value; saveSettings(); };
    $('#setTheme').onchange = e => { settings.theme = e.target.value; saveSettings(); applyTheme(); };
    $('#exportBtn').onclick = exportData;
    $('#importFile').onchange = e => { const f = e.target.files[0]; if (f) importData(f); e.target.value = ''; };
    if (!acct) $('#resetBtn').onclick = () => {
      if (!confirm('Erase all your days, recipes, own foods and settings on this device? Download a backup first if you might want them.')) return;
      ['settings', 'custom', 'log', 'days', 'recent'].forEach(k => { try { localStorage.removeItem(PREFIX + k); } catch { /* ignore */ } });
      location.reload();
    };
  }
  function applyTheme() { if (settings.theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = settings.theme; }
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
    settings = readSettings(); custom = store.get('custom', []); recent = store.get('recent', []); days = loadDays();
    E.setCustom(custom); applyTheme();
    viewIdx = Math.min(viewIdx, days.length - 1);
    updatePill();
    if (!$('#view-day').hidden) renderDay();
    else if (!$('#view-foods').hidden) renderFoodList();
    else if (!$('#view-settings').hidden && !$('#view-settings').contains(document.activeElement)) renderSettings();
    else if (!$('#view-identify').hidden && !q.value.trim()) renderResults();
  }

  // ---------- Boot ----------
  updatePill();
  autosize();
  identify();
  route();
  return { reload, toast };
} };
