/* maCros — first-run setup: body stats + activity + goal → daily targets and a short plan.
 * Calories use Mifflin-St Jeor × activity factor, then the goal's daily surplus/deficit.
 * Protein is per kg of body weight; fat is 25% of calories; carbs fill the rest; fiber is 14 g per 1,000 kcal. */
window.MacrosSetup = (() => {
  'use strict';
  const ACTIVITY = [
    { k: 'sed', f: 1.2, label: 'Mostly sitting', sub: 'Desk job, little or no exercise' },
    { k: 'light', f: 1.375, label: 'Lightly active', sub: 'Exercise 1–3 days a week' },
    { k: 'mod', f: 1.55, label: 'Moderately active', sub: 'Exercise 3–5 days a week' },
    { k: 'very', f: 1.725, label: 'Very active', sub: 'Hard exercise 6–7 days a week' },
    { k: 'extra', f: 1.9, label: 'Extremely active', sub: 'Physical job plus daily training' },
  ];
  const GOALS = [
    { k: 'lose', label: 'Lose weight', sub: 'Burn fat, keep muscle', delta: -500, prot: 2.0 },
    { k: 'maintain', label: 'Maintain', sub: 'Stay at my current weight', delta: 0, prot: 1.6 },
    { k: 'muscle', label: 'Build muscle', sub: 'Lean gain, little extra fat', delta: 250, prot: 2.0 },
    { k: 'gain', label: 'Gain weight', sub: 'Bulk up faster', delta: 500, prot: 1.8 },
    // Phase-only goal (not offered in the wizard): maintenance calories with more carbs for training volume
    { k: 'hyrox', label: 'Hyrox / endurance', sub: 'Fuel hard training', delta: 0, prot: 1.8, fatPct: 0.22, phaseOnly: true },
  ];
  // Phases a person can switch between; each maps to a goal above (custom keeps whatever numbers you set)
  const PHASES = [
    { k: 'bulk', label: 'Bulking', goal: 'gain' },
    { k: 'lean', label: 'Lean bulk', goal: 'muscle' },
    { k: 'maintain', label: 'Maintenance', goal: 'maintain' },
    { k: 'cut', label: 'Cutting', goal: 'lose' },
    { k: 'hyrox', label: 'Hyrox / endurance', goal: 'hyrox' },
    { k: 'custom', label: 'Custom', goal: null },
  ];
  const phaseForGoal = g => (PHASES.find(x => x.goal === g) || PHASES[2]).k;
  const LB = 0.45359237, IN = 2.54;
  const r = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const activity = k => ACTIVITY.find(a => a.k === k) || ACTIVITY[0];
  const goal = k => GOALS.find(g => g.k === k) || GOALS[1];

  // p: { sex: 'm'|'f', age, cm, kg, activity, goal, targetKg }
  function plan(p) {
    const bmr = 10 * p.kg + 6.25 * p.cm - 5 * p.age + (p.sex === 'm' ? 5 : -161);
    const tdee = bmr * activity(p.activity).f;
    const g = goal(p.goal);
    const floor = p.sex === 'm' ? 1500 : 1200;
    const kcal = Math.round(Math.max(floor, tdee + g.delta) / 10) * 10;
    const prot = Math.round(g.prot * refKg(p));
    const fat = Math.round(kcal * (g.fatPct || 0.25) / 9);
    const carbs = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
    const fib = Math.round(kcal / 1000 * 14);
    const weekly = (kcal - tdee) * 7 / 7700;   // kg per week
    const diff = p.targetKg ? p.targetKg - p.kg : 0;
    const weeks = diff && Math.abs(weekly) > 0.05 && Math.sign(diff) === Math.sign(weekly) ? Math.ceil(Math.abs(diff / weekly)) : 0;
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), targets: { kcal, p: prot, c: carbs, f: fat, fib }, weekly, weeks, floored: tdee + g.delta < floor };
  }

  // Very heavy bodies: base protein on the weight at BMI 27 so the number stays realistic
  function refKg(p) { return Math.min(p.kg, 27 * (p.cm / 100) ** 2); }
  // Protein per kg and fat share for a goal (used when targets are re-balanced by hand)
  function rules(goalKey) { const g = goal(goalKey); return { prot: g.prot, fatPct: g.fatPct || 0.25 }; }

  function tips(p, res) {
    const t = res.targets, out = [];
    const perMeal = Math.round(t.p / 4 / 5) * 5;
    if (p.goal === 'lose') {
      out.push(`Eat about ${res.targets.kcal.toLocaleString()} kcal a day. That's roughly 500 below what you burn, about ${r(Math.abs(res.weekly), 1)} kg lost a week.`);
      out.push(`Keep protein high (${t.p} g a day, about ${perMeal} g a meal) so the weight you lose is fat, not muscle.`);
      out.push('Fill half your plate with vegetables, and pick grilled, boiled or steamed over fried.');
      out.push('Lift weights 2–3 times a week to hold on to muscle.');
    } else if (p.goal === 'maintain') {
      out.push(`Eat about ${res.targets.kcal.toLocaleString()} kcal a day to stay where you are.`);
      out.push(`Aim for ${t.p} g of protein a day, about ${perMeal} g a meal.`);
      out.push('Weigh yourself once a week. If it creeps up or down by 1 kg, adjust calories by about 150.');
    } else if (p.goal === 'muscle') {
      out.push(`Eat about ${res.targets.kcal.toLocaleString()} kcal a day, a small surplus of about 250, so most of the gain is muscle.`);
      out.push(`Hit ${t.p} g of protein a day, about ${perMeal} g a meal, spread over 3–4 meals.`);
      out.push('Train each muscle 2 times a week and add a little weight or reps over time.');
      out.push('Sleep 7–9 hours. Muscle is built while you recover.');
    } else if (p.goal === 'hyrox') {
      out.push(`Eat about ${res.targets.kcal.toLocaleString()} kcal a day to match your training.`);
      out.push(`Carbs are your main fuel (${t.c} g a day). Eat some 2–3 hours before hard sessions.`);
      out.push(`Get ${t.p} g of protein a day to recover between sessions.`);
    } else {
      out.push(`Eat about ${res.targets.kcal.toLocaleString()} kcal a day, about 500 above what you burn, around ${r(res.weekly, 1)} kg gained a week.`);
      out.push('Eat 4–5 times a day. Rice, eggs, peanut butter, milk and banana make calories easier to reach.');
      out.push(`Get ${t.p} g of protein a day, and lift weights so the extra weight includes muscle.`);
    }
    if (p.activity === 'sed') out.push('A daily walk (7,000–8,000 steps) is an easy way to move more.');
    if (res.weeks) out.push(`At this pace you'd reach ${p.targetKg} kg in about ${res.weeks} week${res.weeks === 1 ? '' : 's'}. Check your weight weekly and redo setup when it changes.`);
    if (res.floored) out.push(`Your calories are set to the safe minimum (${res.targets.kcal.toLocaleString()} kcal), so progress may be slower.`);
    return out;
  }

  // Shows the wizard inside `root`. opts: { profile, onDone(profile, targets), onCancel? }
  function open(root, opts) {
    const pre = opts.profile || {};
    const st = {
      step: 0,
      sex: pre.sex || '', age: pre.age || '',
      wUnit: pre.wUnit || 'kg', hUnit: pre.hUnit || 'cm',
      kg: pre.kg || '', cm: pre.cm || '',
      activity: pre.activity || '', goal: pre.goal || '', targetKg: pre.targetKg || '',
    };
    const STEPS = 4;
    const $ = s => root.querySelector(s);
    const showW = kg => kg ? (st.wUnit === 'lb' ? r(kg / LB, 1) : r(kg, 1)) : '';
    const toKg = v => st.wUnit === 'lb' ? v * LB : v;
    const profile = () => ({ sex: st.sex, age: +st.age, cm: +st.cm, kg: +st.kg, activity: st.activity, goal: st.goal,
      targetKg: st.goal === 'maintain' ? 0 : +st.targetKg, wUnit: st.wUnit, hUnit: st.hUnit });

    function frame(title, sub, body, nextLabel) {
      root.innerHTML = `<div class="setup-card">
        <div class="setup-top">${st.step > 0 ? '<button class="icon-btn" type="button" data-back aria-label="Back">&#8249;</button>' : opts.onCancel ? '<button class="icon-btn" type="button" data-cancel aria-label="Close">&times;</button>' : '<span></span>'}
          <div class="setup-dots" aria-hidden="true">${Array.from({ length: STEPS }, (_, i) => `<i class="${i <= st.step ? 'on' : ''}"></i>`).join('')}</div><span class="muted small">${st.step + 1} of ${STEPS}</span></div>
        <h1>${title}</h1>${sub ? `<p class="muted" style="margin:-6px 0 16px">${sub}</p>` : ''}
        <div class="setup-body">${body}</div>
        <p class="setup-msg" role="alert"></p>
        <button class="btn wide" type="button" data-next>${nextLabel || 'Continue'}</button>
      </div>`;
      window.scrollTo(0, 0);
      const back = $('[data-back]'); if (back) back.onclick = () => { st.step--; render(); };
      const cancel = $('[data-cancel]'); if (cancel) cancel.onclick = opts.onCancel;
    }
    const err = m => { $('.setup-msg').textContent = m; };
    const choice = (name, list, cur) => `<div class="opts">${list.map(o => `<button type="button" class="opt${o.k === cur ? ' on' : ''}" data-${name}="${o.k}"><b>${esc(o.label)}</b><span>${esc(o.sub)}</span></button>`).join('')}</div>`;
    const unitSeg = (name, list, cur) => `<div class="seg mini">${list.map(([k, l]) => `<button type="button" class="${k === cur ? 'on' : ''}" data-${name}="${k}">${l}</button>`).join('')}</div>`;

    function stepAbout() {
      const ft = st.cm ? Math.floor(st.cm / IN / 12) : '', inch = st.cm ? r(st.cm / IN - Math.floor(st.cm / IN / 12) * 12, 0) : '';
      frame('About you', 'This sets your daily calories and macros.', `
        <div class="field">Sex<div class="seg two">${[['m', 'Male'], ['f', 'Female']].map(([k, l]) => `<button type="button" class="${st.sex === k ? 'on' : ''}" data-sex="${k}">${l}</button>`).join('')}</div></div>
        <label class="field">Age<input class="input" id="suAge" type="number" inputmode="numeric" min="18" max="100" value="${st.age}" placeholder="25"></label>
        <div class="field"><div class="field-row">Height ${unitSeg('hu', [['cm', 'cm'], ['ft', 'ft / in']], st.hUnit)}</div>
          ${st.hUnit === 'cm' ? `<input class="input" id="suCm" type="number" inputmode="decimal" min="120" max="230" value="${st.cm ? r(st.cm, 0) : ''}" placeholder="170" aria-label="Height in cm">`
            : `<div class="two-in"><input class="input" id="suFt" type="number" inputmode="numeric" min="4" max="7" value="${ft}" placeholder="5" aria-label="Feet"><span class="muted">ft</span><input class="input" id="suIn" type="number" inputmode="decimal" min="0" max="11" value="${inch}" placeholder="7" aria-label="Inches"><span class="muted">in</span></div>`}</div>
        <div class="field"><div class="field-row">Weight ${unitSeg('wu', [['kg', 'kg'], ['lb', 'lb']], st.wUnit)}</div>
          <input class="input" id="suKg" type="number" inputmode="decimal" min="30" max="660" value="${showW(st.kg)}" placeholder="${st.wUnit === 'lb' ? '150' : '68'}" aria-label="Weight in ${st.wUnit}"></div>`);
      const keep = () => { readAbout(); };
      root.querySelectorAll('[data-sex]').forEach(b => b.onclick = () => { keep(); st.sex = b.dataset.sex; stepAbout(); });
      root.querySelectorAll('[data-hu]').forEach(b => b.onclick = () => { keep(); st.hUnit = b.dataset.hu; stepAbout(); });
      root.querySelectorAll('[data-wu]').forEach(b => b.onclick = () => { keep(); st.wUnit = b.dataset.wu; stepAbout(); });
      $('[data-next]').onclick = () => {
        readAbout();
        if (!st.sex) return err('Choose male or female.');
        if (!(st.age >= 18 && st.age <= 100)) return err('Enter an age from 18 to 100.');
        if (!(st.cm >= 120 && st.cm <= 230)) return err('Enter a height between 120 and 230 cm (3 ft 11 in to 7 ft 6 in).');
        if (!(st.kg >= 30 && st.kg <= 300)) return err('Enter a weight between 30 and 300 kg (66 to 660 lb).');
        st.step++; render();
      };
    }
    function readAbout() {
      const n = id => { const el = $(id); return el ? parseFloat(el.value) : NaN; };
      const age = n('#suAge'); st.age = age > 0 ? Math.round(age) : '';
      if (st.hUnit === 'cm') { const cm = n('#suCm'); st.cm = cm > 0 ? cm : ''; }
      else { const ft = n('#suFt') || 0, inch = n('#suIn') || 0; st.cm = ft || inch ? (ft * 12 + inch) * IN : ''; }
      const w = n('#suKg'); st.kg = w > 0 ? toKg(w) : '';
    }
    function stepActivity() {
      frame('How active are you?', 'Count exercise and your job. Pick the closest one.', choice('act', ACTIVITY, st.activity));
      root.querySelectorAll('[data-act]').forEach(b => b.onclick = () => { st.activity = b.dataset.act; stepActivity(); });
      $('[data-next]').onclick = () => { if (!st.activity) return err('Pick one.'); st.step++; render(); };
    }
    function stepGoal() {
      const needT = st.goal && st.goal !== 'maintain';
      frame('What’s your goal?', '', `${choice('goal', GOALS.filter(g => !g.phaseOnly), st.goal)}
        ${needT ? `<label class="field" style="margin-top:14px">Goal weight (${st.wUnit})<span class="hint">You weigh ${showW(st.kg)} ${st.wUnit} now</span>
          <input class="input" id="suTarget" type="number" inputmode="decimal" min="30" max="660" value="${showW(st.targetKg)}" placeholder="${showW(st.goal === 'lose' ? st.kg - 5 : st.kg + 5)}"></label>` : ''}`, 'See my plan');
      const readT = () => { const el = $('#suTarget'); if (el) { const v = parseFloat(el.value); st.targetKg = v > 0 ? toKg(v) : ''; } };
      root.querySelectorAll('[data-goal]').forEach(b => b.onclick = () => { readT(); st.goal = b.dataset.goal; stepGoal(); });
      $('[data-next]').onclick = () => {
        readT();
        if (!st.goal) return err('Pick a goal.');
        if (st.goal !== 'maintain') {
          if (!(st.targetKg >= 30 && st.targetKg <= 300)) return err('Enter your goal weight.');
          if (st.goal === 'lose' && !(st.targetKg < st.kg)) return err('For losing weight, the goal weight should be below your current weight.');
          if ((st.goal === 'gain' || st.goal === 'muscle') && !(st.targetKg > st.kg)) return err('For gaining, the goal weight should be above your current weight.');
          const bmi = st.targetKg / (st.cm / 100) ** 2;
          if (bmi < 17) return err('That goal weight is very low for your height. Pick a higher one, or talk to a doctor first.');
        }
        st.step++; render();
      };
    }
    function stepPlan() {
      const p = profile(), res = plan(p), t = res.targets;
      frame('Your plan', `${goal(p.goal).label} · ${activity(p.activity).label.toLowerCase()}`, `
        <div class="card plan-card">
          <div class="eyebrow">Daily target</div>
          <div class="kcal-big" style="margin-top:4px">${t.kcal.toLocaleString()}<span>kcal</span></div>
          <div class="macro-grid">${[['p', 'Protein'], ['c', 'Carbs'], ['f', 'Fat'], ['fib', 'Fiber']].map(([k, l]) => `<div class="mtile ${k}"><div class="lab"><i class="dot-${k}"></i>${l}</div><div class="val">${t[k]}<small>g</small></div></div>`).join('')}</div>
          <p class="muted small" style="margin:12px 0 0">You burn about ${res.tdee.toLocaleString()} kcal a day (resting ${res.bmr.toLocaleString()} kcal).</p>
        </div>
        <h3 class="section-title">What to do</h3>
        <ul class="plan-tips">${tips(p, res).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <p class="muted small" style="margin:12px 4px 0">These are estimates for healthy adults, not medical advice. You can change any number later in Settings.</p>`, 'Start using maCros');
      $('[data-next]').onclick = () => opts.onDone(p, t);
    }
    function render() { [stepAbout, stepActivity, stepGoal, stepPlan][st.step](); }
    render();
  }

  function summary(p) {
    if (!p || !p.kg) return '';
    const w = kg => p.wUnit === 'lb' ? `${r(kg / LB, 0)} lb` : `${r(kg, 1)} kg`;
    const h = p.hUnit === 'ft' ? `${Math.floor(p.cm / IN / 12)} ft ${r(p.cm / IN % 12, 0)} in` : `${r(p.cm, 0)} cm`;
    return `${p.sex === 'm' ? 'Male' : 'Female'} · ${p.age} y · ${h} · ${w(p.kg)} · ${activity(p.activity).label} · ${goal(p.goal).label}${p.targetKg ? ' → ' + w(p.targetKg) : ''}`;
  }

  return { open, plan, summary, rules, refKg, PHASES, phaseForGoal, goalLabel: k => goal(k).label };
})();
