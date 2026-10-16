/* Macro ID engine — food index, natural-language parser and macro math.
 * Runs fully offline; no dependencies. Exposes window.MacroEngine. */
(function (global) {
  'use strict';

  const SOURCES = { U: 'USDA', F: 'FNRI', L: 'Label', E: 'Estimate', C: 'My food', R: 'My recipe', M: 'Meal combo' };

  // ---------- Units ----------
  const MASS = { g: 1, kg: 1000, oz: 28.35, lb: 453.6, ml: 1, l: 1000 };
  const UNIT_WORDS = {};
  const addUnit = (key, words) => words.split(' ').forEach(w => { UNIT_WORDS[w] = key; });
  addUnit('g', 'g gm gms gr grm grms gram grams gramo gramos');
  addUnit('kg', 'kg kgs kilo kilos kilogram kilograms');
  addUnit('oz', 'oz ounce ounces');
  addUnit('lb', 'lb lbs pound pounds');
  addUnit('ml', 'ml mls milliliter milliliters millilitre millilitres');
  addUnit('l', 'l liter liters litre litres litro');
  addUnit('cup', 'cup cups c tasa tasang cupful');
  addUnit('tbsp', 'tbsp tbsps tbs tablespoon tablespoons kutsara kutsarang');
  addUnit('tsp', 'tsp tsps teaspoon teaspoons kutsarita kutsaritang');
  addUnit('pc', 'pc pcs piece pieces piraso pirasong whole');
  addUnit('slice', 'slice slices hiwa');
  addUnit('can', 'can cans lata tin');
  addUnit('pack', 'pack packs packet packets sachet sachets pouch bar bars');
  addUnit('scoop', 'scoop scoops');
  addUnit('bowl', 'bowl bowls mangkok');
  addUnit('plate', 'plate plates plato order orders');
  addUnit('serving', 'serving servings serve');
  addUnit('stick', 'stick sticks skewer skewers tuhog');
  addUnit('glass', 'glass glasses baso');
  addUnit('bottle', 'bottle bottles bote');
  addUnit('handful', 'handful handfuls dakot');
  addUnit('clove', 'clove cloves');
  addUnit('shot', 'shot shots tagay');
  addUnit('kcal', 'kcal kcals cal cals calorie calories kilocalorie kilocalories');   // "532 calories of nuggets" sizes by energy

  const UNIT_LABEL = {
    g: ['g', 'g'], kg: ['kg', 'kg'], oz: ['oz', 'oz'], lb: ['lb', 'lb'], ml: ['ml', 'ml'], l: ['L', 'L'],
    cup: ['cup', 'cups'], tbsp: ['tbsp', 'tbsp'], tsp: ['tsp', 'tsp'], pc: ['pc', 'pcs'],
    slice: ['slice', 'slices'], can: ['can', 'cans'], pack: ['pack', 'packs'], scoop: ['scoop', 'scoops'],
    bowl: ['bowl', 'bowls'], plate: ['plate', 'plates'], serving: ['serving', 'servings'],
    stick: ['stick', 'sticks'], glass: ['glass', 'glasses'], bottle: ['bottle', 'bottles'],
    handful: ['handful', 'handfuls'], clove: ['clove', 'cloves'], shot: ['shot', 'shots'], kcal: ['kcal', 'kcal'],
  };
  // Used only when a food has no size for the unit you asked for.
  const FALLBACK_G = { cup: 200, tbsp: 15, tsp: 5, pc: 100, slice: 30, can: 155, pack: 50, scoop: 30, bowl: 300,
    plate: 250, serving: 150, stick: 50, glass: 240, bottle: 330, handful: 30, clove: 3, shot: 30 };
  const UNIT_SYNONYMS = { plate: ['serving', 'bowl', 'cup'], bowl: ['serving', 'plate', 'cup'], serving: ['plate', 'bowl', 'pc', 'cup'],
    glass: ['cup', 'bottle'], cup: ['glass'], pc: ['serving', 'slice', 'stick'], slice: ['pc'], stick: ['pc'],
    pack: ['pc', 'serving'], bottle: ['glass', 'can'], can: ['bottle', 'glass'] };

  // ---------- Words ----------
  const NUM_WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
    nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
    isa: 1, isang: 1, dalawa: 2, dalawang: 2, tatlo: 3, tatlong: 3, apat: 4, lima: 5, limang: 5,
    pito: 7, pitong: 7, walo: 8, walong: 8, siyam: 9, sampu: 10, sampung: 10 };
  const STOP = new Set(('i im ive ate had have having eat eating eaten just about around approx approximately roughly ' +
    'like of the some my for today tonight this morning breakfast lunch dinner supper snack snacks merienda meryenda ' +
    'almusal tanghalian hapunan ng na ang ko ako kumain kinain mga yung iyong po lang si also then worth from').split(' '));
  const SIZE = { small: 0.75, maliit: 0.75, medium: 1, large: 1.3, big: 1.3, malaki: 1.3, jumbo: 1.6 };
  const RAW_WORDS = new Set(['raw', 'uncooked', 'hilaw', 'dry']);
  const MEAL_WORDS = [
    [/\b(breakfast|almusal|agahan)\b/, 'Breakfast'], [/\b(lunch|tanghalian)\b/, 'Lunch'],
    [/\b(dinner|supper|hapunan)\b/, 'Dinner'], [/\b(snacks?|merienda|meryenda)\b/, 'Snacks'],
  ];

  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/½/g, ' 1/2').replace(/¼/g, ' 1/4').replace(/¾/g, ' 3/4').replace(/⅓/g, ' 1/3')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\b3\s*-?\s*in\s*-?\s*1\b/g, ' threeinone ')
      .replace(/\b555\b/g, ' fivefivefive ')
      .replace(/\bw\//g, ' with ')
      .replace(/['’`]/g, '')
      .replace(/(\d),(\d{3})\b/g, '$1$2')
      .replace(/\b(\d{2})\s*%/g, ' $1pct ')
      .replace(/\b([5-9]\d)\s*\/\s*\d{1,2}\b/g, ' $1pct ')
      .replace(/[^a-z0-9./|\s]/g, ' ')
      .replace(/(^|[^\d])\.(\d)/g, '$1 0.$2')
      .replace(/\.(?!\d)/g, ' ').replace(/(^|[^\d])\./g, '$1 ')
      .replace(/\/(?!\d)/g, ' ').replace(/(^|[^\d])\//g, '$1 ')
      .replace(/\bwith skin\b/g, 'withskin')
      .replace(/\s+/g, ' ').trim();
  }
  const clean = s => norm(s).split(' ').filter(t => t && !STOP.has(t)).join(' ');
  const isNum = t => /^\d+(\.\d+)?$/.test(t) || /^\d+\/\d+$/.test(t);
  const toNum = t => { if (t.includes('/')) { const [a, b] = t.split('/'); return b > 0 ? a / b : 0; } return parseFloat(t); };
  const numUnit = t => { const m = t.match(/^(\d+(?:\.\d+)?)([a-z]+)$/); return m && UNIT_WORDS[m[2]] ? [parseFloat(m[1]), UNIT_WORDS[m[2]]] : null; };

  // ---------- Food index ----------
  let foods = [], byId = {}, byName = {}, aliasSet = new Set(), customRows = [];
  const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function parseUnits(str) {
    const units = {}; let d = 'g';
    (str || '').split(',').map(x => x.trim()).filter(Boolean).forEach((pair, i) => {
      const [k, v] = pair.split(':'); const g = parseFloat(v);
      if (k && g > 0) { units[k] = g; if (i === 0) d = k; }
    });
    return { units, d };
  }

  function indexAliases(food, list) {
    const seen = new Set();
    food._al = [];
    [food.name, ...list].forEach(a => {
      const c = clean(a); if (!c || seen.has(c)) return; seen.add(c);
      food._al.push(c.split(' ')); aliasSet.add(c);
    });
  }

  function build() {
    foods = []; byId = {}; byName = {}; aliasSet = new Set();
    const addRows = (rows, sugg) => {
      for (const row of rows || []) {
        const [name, aliases, cat, kcal, p, c, f, fib, unitStr, src] = row;
        const { units, d } = parseUnits(unitStr);
        const al = aliases.split('|');
        const food = { id: slug(name), name, key: al[0], cat, kcal, p, c, f, fib, units, d, src, sugg, raw: /\b(raw|uncooked|dry)\b/i.test(name) };
        indexAliases(food, al);
        foods.push(food); byId[food.id] = food; byName[name] = food;
      }
    };
    addRows(global.MID_FOODS, false);
    addRows(global.MID_SUGGESTIONS, true);
    for (const cf of customRows) {
      const src = cf.src === 'R' ? 'R' : 'C';
      const food = { ...cf, cat: src === 'R' ? 'My Recipes' : 'My Foods', src, custom: true, sugg: false, raw: /\b(raw|uncooked|dry)\b/i.test(cf.name) };
      food.key = (cf.aliases && cf.aliases[0]) || food.name;   // names like "Taho (428g cup)" would re-parse as amounts
      indexAliases(food, cf.aliases || []);
      foods.push(food); byId[food.id] = food; byName[food.name] = food;
    }
    for (const [name, aliases, parts] of global.MID_COMBOS || []) {
      const resolved = parts.map(([n, g]) => ({ food: byName[n], grams: g })).filter(x => x.food);
      const al = aliases.split('|');
      const tot = sumMacros(resolved.map(x => macros(x.food, x.grams)));
      const grams = resolved.reduce((a, x) => a + x.grams, 0);
      // a combo built from any estimated part is itself only a suggestion
      const food = { id: slug(name), name, key: al[0], cat: 'Silog Meals', src: 'M', parts: resolved, units: { plate: grams }, d: 'plate', comboTotal: tot, comboGrams: grams,
        sugg: resolved.some(x => x.food.sugg) };
      indexAliases(food, al);
      foods.push(food); byId[food.id] = food; byName[name] = food;
    }
  }

  // ---------- Matching ----------
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = dp[0]; dp[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = dp[j];
        dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return dp[b.length];
  }
  // 1 = exact, 0.95 = plural, 0.75 = prefix while typing, 0.6 = typo
  function tokScore(q, a, prefix) {
    if (q === a) return 1;
    if (q + 's' === a || a + 's' === q || q + 'es' === a || a + 'es' === q) return 0.95;
    if (prefix && q.length >= 2 && a.startsWith(q)) return 0.75;
    if (q.length >= 5 && a.length >= 5 && lev(q, a) <= (q.length >= 8 ? 2 : 1)) return 0.6;
    return 0;
  }
  function scoreAlias(qT, aT, prefix) {
    const last = qT.length - 1;
    let hitA = 0, hitQ = 0, exact = true;
    for (const a of aT) {
      let b = 0; for (let i = 0; i < qT.length; i++) b = Math.max(b, tokScore(qT[i], a, prefix && i === last));
      hitA += b; if (b < 0.95) exact = false;
    }
    if (!hitA) return 0;
    for (let i = 0; i < qT.length; i++) {
      let b = 0; for (const a of aT) b = Math.max(b, tokScore(qT[i], a, prefix && i === last));
      hitQ += b; if (b < 0.95) exact = false;
    }
    const covA = hitA / aT.length, covQ = hitQ / qT.length;
    let s = covA * covQ * 600 + covA * 200 + covQ * 100;
    if (covA >= 0.95) s += 100 + aT.length * 15;
    if (exact && aT.length === qT.length) s += 300;
    return s;
  }

  function search(text, opts = {}) {
    const q = clean(text);
    if (!q) return [];
    const qT = q.split(' ');
    const wantsRaw = qT.some(t => RAW_WORDS.has(t));
    const out = [];
    const scope = opts.scope || 'calc';
    for (const food of foods) {
      if (scope === 'calc' && food.sugg) continue;
      if (scope === 'sugg' && !food.sugg) continue;
      let best = 0;
      for (const aT of food._al) { const s = scoreAlias(qT, aT, opts.prefix); if (s > best) best = s; }
      if (!best) continue;
      if (food.raw) best += wantsRaw ? 300 : -150;
      if (food.custom) best += 40;
      if (best > 0) out.push({ food, score: best });
    }
    out.sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length);
    return out.slice(0, opts.limit || 8);
  }

  // ---------- Amounts & macros ----------
  function amount(food, qty, unit, size = 1) {
    let note = '';
    if (unit && MASS[unit]) return { qty, unit, grams: qty * MASS[unit], note };
    if (!unit) {
      if (qty == null) { qty = food.d === 'g' ? 100 : 1; unit = food.d; note = 'default'; }
      else if (food.units.pc && qty <= 30) unit = 'pc';
      else if (qty <= 10 && food.d !== 'g') unit = food.d;
      else unit = 'g';
    }
    if (unit === 'g') return { qty, unit, grams: qty, note };
    if (unit === 'kcal') {
      const kc = food.parts ? food.comboTotal.kcal / (food.comboGrams || 1) * 100 : food.kcal;
      return { qty, unit, grams: kc > 0 ? qty / kc * 100 : 0, note };
    }
    let per = food.units[unit];
    if (!per) for (const s of UNIT_SYNONYMS[unit] || []) if (food.units[s]) { per = food.units[s]; unit = s; break; }
    if (!per) { per = FALLBACK_G[unit] || 100; note = 'approx'; }
    return { qty, unit, grams: qty * per * size, note };
  }
  function gramsFor(food, qty, unit) { return amount(food, qty, unit).grams; }

  function macros(food, grams) {
    if (food.parts) {
      const k = grams / (food.comboGrams || 1);
      const t = food.comboTotal; return { kcal: t.kcal * k, p: t.p * k, c: t.c * k, f: t.f * k, fib: t.fib * k };
    }
    const k = grams / 100;
    return { kcal: food.kcal * k, p: food.p * k, c: food.c * k, f: food.f * k, fib: food.fib * k };
  }
  function sumMacros(list) {
    return list.reduce((a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f, fib: a.fib + m.fib }),
      { kcal: 0, p: 0, c: 0, f: 0, fib: 0 });
  }
  function unitLabel(unit, qty) { const l = UNIT_LABEL[unit] || [unit, unit + 's']; return qty === 1 ? l[0] : l[1]; }
  function unitsFor(food) {
    const list = Object.keys(food.units).map(k => ({ key: k, grams: food.units[k] }));
    list.push({ key: 'g', grams: 1 });
    if (food.kcal > 0) list.push({ key: 'kcal', grams: 100 / food.kcal });
    return list;
  }

  // ---------- Parser ----------
  function wordsToNumbers(tokens) {
    const out = []; let i = 0; let sawNumber = false;
    while (i < tokens.length) {
      const t = tokens[i], nx = tokens[i + 1];
      if (t === 'half' || t === 'kalahati' || t === 'kalahating') {
        out.push('0.5'); sawNumber = true; i++;
        if (tokens[i] === 'a' || tokens[i] === 'an' || tokens[i] === 'of') i++;
        continue;
      }
      if (t === 'quarter') { out.push('0.25'); sawNumber = true; i++; if (tokens[i] === 'a' || tokens[i] === 'of') i++; continue; }
      if (t === 'couple') { out.push('2'); sawNumber = true; i++; continue; }
      if (t === 'dozen') { out.push('12'); sawNumber = true; i++; continue; }
      const startsNum = t in NUM_WORDS || ((t === 'a' || t === 'an') && (nx === 'hundred' || nx === 'thousand'));
      if (startsNum) {
        let total = 0, cur = 0, lastScale = false;
        while (i < tokens.length) {
          let w = tokens[i];
          if ((w === 'a' || w === 'an') && cur === 0 && total === 0) w = 'one';
          if (w in NUM_WORDS) { cur += NUM_WORDS[w]; lastScale = false; i++; }
          else if (w === 'hundred') { cur = (cur || 1) * 100; lastScale = true; i++; }
          else if (w === 'thousand') { total += (cur || 1) * 1000; cur = 0; lastScale = true; i++; }
          else if (w === 'and' && lastScale && tokens[i + 1] in NUM_WORDS) { i++; }
          else if (w === 'andahalf') { cur += 0.5; i++; }
          else break;
        }
        out.push(String(total + cur)); sawNumber = true;
        continue;
      }
      if ((t === 'a' || t === 'an') && !sawNumber) { out.push('1'); sawNumber = true; i++; continue; }
      if (isNum(t) || numUnit(t)) sawNumber = true;
      out.push(t); i++;
    }
    return out;
  }

  const isFoodTok = t => t !== 'andahalf' && !isNum(t) && !numUnit(t) && !UNIT_WORDS[t] && !STOP.has(t) && !SIZE[t] && !/^x\d/.test(t) && !/^\d+(\.\d+)?x$/.test(t);

  // "100g chicken 1 cup rice" -> ["100g chicken", "1 cup rice"]
  function subSplit(tokens) {
    const out = []; let cur = []; let hasFood = false;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const numeric = (isNum(t) && !/^\d+\/\d+$/.test(t)) || numUnit(t);
      if (numeric && hasFood) { out.push(cur); cur = []; hasFood = false; }
      cur.push(t);
      if (isFoodTok(t)) hasFood = true;
    }
    if (cur.length) out.push(cur);
    return out;
  }

  function parseChunk(tokens) {
    let qty = null, unit = null, mult = 1, size = 1; const food = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]; let m;
      if (t === 'andahalf') { if (qty !== null) qty += 0.5; continue; }
      if ((m = t.match(/^x(\d+(?:\.\d+)?)$/)) || (m = t.match(/^(\d+(?:\.\d+)?)x$/))) { mult *= parseFloat(m[1]); continue; }
      if (t in SIZE) { size = SIZE[t]; continue; }
      const nu = numUnit(t);
      if (qty === null && nu) { [qty, unit] = nu; continue; }
      if (qty === null && isNum(t)) {
        qty = toNum(t);
        if (tokens[i + 1] && /^\d+\/\d+$/.test(tokens[i + 1])) { qty += toNum(tokens[i + 1]); i++; }
        if (tokens[i + 1] === 'andahalf') { qty += 0.5; i++; }
        if (tokens[i + 1] && UNIT_WORDS[tokens[i + 1]]) { unit = UNIT_WORDS[tokens[i + 1]]; i++; }
        continue;
      }
      if (unit === null && !food.length && UNIT_WORDS[t] && t.length > 2 && t !== 'whole' && t !== 'can') {
        unit = UNIT_WORDS[t]; if (qty === null) qty = 1; continue;
      }
      food.push(t);
    }
    const foodText = food.filter(t => !STOP.has(t)).join(' ');
    return { qty, unit, mult, size, foodText, said: food.join(' ') || foodText };
  }

  // just the food words of a phrase: "1 can pork and beans" -> "pork and beans"
  const foodWords = str => clean(str).split(' ').filter(t => isFoodTok(t) && t !== 'a' && t !== 'an' && !(t in NUM_WORDS)).join(' ');

  function resolveChunk(ch) {
    const matches = search(ch.foodText, { limit: 6 });
    const top = matches[0];
    // a much closer hit in Suggestions means the calculator only has a partial match ("chicken adobo" -> chicken breast): ask instead
    const suggTop = search(ch.foodText, { limit: 1, scope: 'sugg' })[0];
    const suggWins = suggTop && suggTop.score >= 900 && (!top || suggTop.score > top.score + 150);
    if (!top || top.score < 350 || suggWins) {
      const fromSugg = search(ch.foodText, { limit: 3, scope: 'sugg' }).filter(m => m.score >= 350).map(m => m.food);
      return [{ kind: 'unknown', query: ch.said, qty: ch.qty, unit: ch.unit, size: ch.size, mult: ch.mult,
        suggestions: matches.filter(m => m.score > 120).slice(0, 3).map(m => m.food), fromSugg }];
    }
    const food = top.food;
    const alts = matches.slice(1).filter(m => m.score > 200).map(m => m.food).filter(f => !f.parts);
    if (food.parts) {
      const n = ch.unit === 'kcal' && food.comboTotal.kcal ? ch.qty / food.comboTotal.kcal : (ch.qty || 1) * ch.mult;
      return food.parts.map(pt => ({ kind: 'food', food: pt.food, qty: Math.round(pt.grams * n), unit: 'g', grams: pt.grams * n,
        note: '', parent: food.name, query: ch.said, alts: [] }));
    }
    const a = amount(food, ch.qty, ch.unit, ch.size);
    let qty = a.qty, grams = a.grams * ch.mult;
    if (ch.mult !== 1) qty = a.qty * ch.mult;
    return [{ kind: 'food', food, qty, unit: a.unit, grams, note: a.note, size: ch.size, query: ch.said, alts }];
  }

  function parse(text) {
    const raw = String(text || '');
    let meal = null;
    const lower = raw.toLowerCase();
    for (const [re, m] of MEAL_WORDS) if (re.test(lower)) { meal = m; break; }

    const s = (' ' + norm(raw.replace(/[,;\n+&]/g, ' | ')) + ' ')
      .replace(/\b(hundred|thousand) and (?=[a-z])/g, '$1 ')
      .replace(/ and a half\b/g, ' andahalf');
    const pieces = s.split(/(\s*\|\s*|\s+(?:and|at|plus|with|tsaka|saka|tapos|pati|then|also)\s+)/);
    // pieces: [text, sep, text, sep, ...]; re-join separators that are part of a food name
    const parts = [];
    for (let i = 0; i < pieces.length; i += 2) {
      const txt = (pieces[i] || '').trim();
      const sep = (pieces[i - 1] || '').trim() || 'and';
      if (parts.length && txt) {
        const prev = parts[parts.length - 1];
        const words = sep === '|' ? ['and'] : [sep, 'and'];
        const merged = words.map(w => prev + ' ' + w + ' ' + txt).find(m => {
          return aliasSet.has(foodWords(m));
        });
        if (merged) { parts[parts.length - 1] = merged; continue; }
      }
      if (txt) parts.push(txt);
    }

    let chunks = [];
    for (const p of parts) {
      const toks = wordsToNumbers(p.split(' ').filter(Boolean));
      for (const sub of subSplit(toks)) chunks.push(parseChunk(sub));
    }
    // Attach amount-only chunks ("chicken breast 100g") to their neighbour
    const merged = [];
    for (let i = 0; i < chunks.length; i++) {
      const ch = chunks[i];
      if (ch.foodText) { merged.push(ch); continue; }
      if (ch.qty == null) continue;
      const prev = merged[merged.length - 1];
      if (prev && prev.qty == null) { Object.assign(prev, { qty: ch.qty, unit: ch.unit, mult: prev.mult * ch.mult }); continue; }
      const next = chunks[i + 1];
      if (next && next.foodText && next.qty == null) { Object.assign(next, { qty: ch.qty, unit: ch.unit }); continue; }
    }
    const items = [];
    for (const ch of merged) items.push(...resolveChunk(ch));
    return { items, meal };
  }

  function amountText(food, qty, unit) {
    const q = Math.round(qty * 100) / 100;
    if (unit === 'g') return `${q}g`;
    if (unit === 'kcal') return `${q} kcal`;
    return `${q} ${unitLabel(unit, q)}`;
  }

  function expandCombo(food, n) {
    return food.parts.map(pt => ({ kind: 'food', food: pt.food, qty: Math.round(pt.grams * n), unit: 'g', grams: pt.grams * n, note: '', parent: food.name, query: food.name, alts: [] }));
  }

  global.MacroEngine = {
    expandCombo,
    SOURCES, MASS, UNIT_LABEL,
    setCustom(rows) { customRows = rows || []; build(); },
    all: () => foods,
    byId: id => byId[id],
    search, parse, amount, gramsFor, macros, sumMacros, unitLabel, unitsFor, amountText, norm, clean,
  };
  build();
})(window);
