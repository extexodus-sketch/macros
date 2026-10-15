# CLAUDE.md — maCros

Project notes for Claude Code (and humans). Read this first when picking up the project on a new machine.

## What it is
**maCros** is a zero-token macro *identifier* PWA. You type or say what you're eating, and it returns kcal, protein, carbs, fat and fiber. It's plain HTML/CSS/JS with no build step and no npm. It's live on GitHub Pages at https://extexodus-sketch.github.io/macros/ (repo `extexodus-sketch/macros`, branch `main` = live site).

## Owner's decisions (don't change without asking)
- Name is exactly **maCros**, with no subtitle.
- Weights are **cooked, as eaten**. The parser takes "raw" or "uncooked" for raw weights.
- **Targets come from first-run setup** (`setup.js`): sex, age, height, weight (kg/lb, cm/ft-in), activity, goal (lose / maintain / build muscle / gain) and goal weight → Mifflin-St Jeor × activity ± goal delta, protein per kg, fat 25%, carbs the rest, fiber 14 g/1,000 kcal, plus tailored tips. Everyone sees it once (`settings.setupDone`); Settings → Your goal → Redo setup. No account should start with the owner's numbers.
- **Look:** "Mint fresh" light palette is the default theme (dark only if chosen in Settings). Macro values show as bordered chips in each macro's colour (P red, C amber, F purple, Fib green).
- **Navigation:** bottom bar is **Dashboard · Add · Menu** (Dashboard opens first; header = centred logo with a tiny name). Dashboard has two pages, **Today** and **This week** (Mon–Sun, Days counted on the date they started), switched by a tab or a sideways swipe. Add = type/speak box on top + "Browse foods" below (hidden while typing), with Protein / Carbs / Fat / Fiber source filters and collapsed categories. Menu → Goals, Progress, Tutorial, Settings. Add also has a **water glass** (tap = one glass; `day.water`; goal and glass size in Settings, `settings.water`).
- **UI choices:** keep it clean. No example suggestions or "How it works" (Recent only); explanatory notes live behind a **Reminder** button at the bottom of a page. Each match has a Cooked/Raw switch when a twin exists. Today says "Current day", the button is just "Start Day N", the top-right pill toggles eaten ⇄ left, meals have notes (`day.notes[meal]`). Silog meals let you edit each part's grams, add +1 piece, and log by plates or grams.
- **Calories as an amount:** "532 calories of chicken nuggets" sizes the food by energy (`kcal` unit in engine.js), not grams.
- **Goals:** daily targets auto-balance with locks: change calories and unlocked macros follow; a macro you type is locked; Auto-calculate resets. **Phases** (Bulking, Lean bulk, Maintenance, Cutting, Hyrox / endurance, Custom) each keep their own targets, calculated from the profile; switching loads them everywhere (`settings.phases`, `settings.phaseId`).
- **Progress:** last 7 / 30 days: days logged vs skipped, averages vs target from finished days only, estimated weight change (intake − TDEE ÷ 7,700) vs actual weigh-ins, projection after 3+ full days. Weigh-ins (`settings.weighIns`, frequency `settings.weighEvery` incl. every day, usual time `settings.weighTime`) with a light-red "Weigh-in time" banner on the Dashboard when due. **Weight trend** chart: scale dots + smoothed trend line (moves 10% per day toward each reading).
- **Tutorial:** Menu → Tutorial has an 8-step tour and a first-week checklist that ticks itself where it can (`settings.tour`). The Dashboard offers the tour until it's done or dismissed.
- **Days are manual.** The user taps "start Day N+1". Never roll over by clock or midnight.
- **Calculator vs Suggestions:** `foods.js` holds only verified values (USDA FoodData Central `U`, FNRI PhilFCT `F`, label `L`), and only these are auto-matched when typing. `suggestions.js` holds browse-only recipe estimates (`E`) that are never auto-used. New estimates go in `suggestions.js`.
- Unknown foods are added by the user (custom food / recipe builder). No AI or API lookups, so no token costs.
- **Accounts (in progress):** Firebase Auth (Google + email/password) + Firestore. 18+ only. Terms & Privacy list "maCros" as operator, with contact extexodus@gmail.com. The Firestore region must be **asia-southeast1 (Singapore)** because privacy.html says so.

## Files
| File | Role |
|---|---|
| `index.html`, `style.css` | Page and design (light/dark) |
| `boot.js` | Start-up: Terms gate, sign-in screens, cloud sync. Local-only mode when there's no Firebase config |
| `cloud.js` | Firebase SDK wrapper (gstatic CDN, v10.12.2): auth, `users/{uid}` profile, `users/{uid}/days/{id}` |
| `app.js` | UI: Identify, My Day, Foods (Database / Suggestions / My Eats), Settings. `MacrosApp.start(ctx)` |
| `setup.js` | First-run setup wizard, target maths and phase types (`MacrosSetup.open / plan / summary / rules / PHASES`) |
| `engine.js` | Parser (English/Tagalog, spoken numbers, units, 90%/80-20), fuzzy search, macro math |
| `foods.js` / `suggestions.js` | Food data, per 100 g. Rows carry reference IDs (FDC / FNRI codes) |
| `firebase-config.js` | Paste the Firebase web config here (`null` = local-only mode) |
| `firestore.rules` | Security rules: each user reads and writes only their own docs |
| `terms.html`, `privacy.html` | Legal pages. Bump `TERMS_VERSION` in boot.js when they change |
| `sw.js` | Offline cache. Bump `CACHE` name when the asset list changes |
| `deploy.sh` | Commit + push `main` + enable Pages (`./deploy.sh "message"`). Needs the `gh` CLI signed in |
| `tools/` | Scripts used to verify food values (USDA FDC API, FNRI listing parser) |

## Run / preview
`python3 -m http.server 8760` in this folder (or `.claude/launch.json` → `macro-id`; on Windows use `python` / `macro-id (Windows)`), then open http://localhost:8760. There are no tests; verify in a browser. Locally the app talks to the real Firebase project; to test without signing in, serve a copy with `firebase-config.js` set to `null`.

On Windows the `gh` CLI may not be on PATH inside Claude sessions: run `PATH="/c/Program Files/GitHub CLI:$PATH" ./deploy.sh "message"`.

## Status / next steps
1. **Accounts are live** (since 2026-10-15). Firebase project `macros-3f060`, Firestore in asia-southeast1, rules from `firestore.rules`. `main` = live site.
2. Known caveat: Google sign-in can be flaky inside an iOS home-screen PWA. Email/password is the fallback.
3. Ideas raised: saved meals, more PH brands/restaurants, weekly averages.

## Data-source notes
- USDA FDC API: `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&query=...`. DEMO_KEY allows about 30 requests per hour.
- FNRI PhilFCT: the search needs a login, but `https://i.fnri.dost.gov.ph/fct/library/food_content/<A–T>` pages include full per-100 g proximates (see `tools/fnri_parse.py`). Don't commit the downloaded FNRI dataset to this public repo.
