# CLAUDE.md — maCros

Project notes for Claude Code (and humans). Read this first when picking up the project on a new machine.

## What it is
**maCros** is a zero-token macro *identifier* PWA. You type or say what you're eating, and it returns kcal, protein, carbs, fat and fiber. It's plain HTML/CSS/JS with no build step and no npm. It's live on GitHub Pages at https://extexodus-sketch.github.io/macros/ (repo `extexodus-sketch/macros`, branch `main` = live site).

## Owner's decisions (don't change without asking)
- Name is exactly **maCros**, with no subtitle.
- Weights are **cooked, as eaten**. The parser takes "raw" or "uncooked" for raw weights.
- **Targets come from first-run setup** (`setup.js`): sex, age, height, weight (kg/lb, cm/ft-in), activity, goal (lose / maintain / build muscle / gain) and goal weight → Mifflin-St Jeor × activity ± goal delta, protein per kg, fat 25%, carbs the rest, fiber 14 g/1,000 kcal, plus tailored tips. Everyone sees it once (`settings.setupDone`); Settings → Your goal → Redo setup. No account should start with the owner's numbers.
- **Look:** "Mint fresh" light palette is the default theme (dark only if chosen in Settings). Macro values show as bordered chips in each macro's colour (P red, C amber, F purple, Fib green).
- **What's new (REQUIRED for every change):** the bell at the top left of the header lists every update, newest first, from `updates.js`. **Any session that changes the app adds an entry there in the same commit**, big features (`kind: 'feature'`) and small things (`'improvement'`, `'fix'`) alike, written for users in plain words. `at` ("YYYY-MM-DD HH:MM") must be newer than every existing entry; it drives the order and the unread badge (`settings.updatesSeen` = newest one opened, synced with the account; with no value, only the last 7 days count as unread). Adding the entry and deploying is what notifies everyone.
- **Navigation:** bottom bar is **Dashboard · Progress · Add · Goals · Menu** (Add stays in the middle, under the round button; Dashboard opens first; header = centred logo with a tiny name). Dashboard has two pages, **Today** and **This week** (Mon–Sun, Days counted on the date they started), switched by a tab or a sideways swipe. Add = type/speak box on top + "Browse foods" below (stays visible under the matches, so you can add more foods from it), with Protein / Carbs / Fat / Fiber source filters and collapsed categories. Menu → Tutorial, Settings, Send feedback (Goals and Progress are tabs, with no back arrow). Add starts straight with the search box (its "What are you eating?" label is screen-reader only) and also has a **water glass** (tap = one glass; `day.water`; goal and glass size in Settings, `settings.water`).
- **UI choices:** keep it clean and beginner-friendly. Add has ONE search box (typing shows matches plus "More foods like…"); below it, Recent (your last foods with the amount you had; collapsed until tapped so it doesn't crowd Add) and Browse foods (categories collapsed, Protein / Carbs / Fat / Fiber source filters). No Database/Suggestions/My Eats tabs: recipe estimates sit in the same list with an **Estimate** badge and are still never auto-picked by typing. Source badges (USDA/FNRI/Label) show only on a food's detail sheet. Rarely used actions (Save as recipe, Copy day summary) live behind a ⋯ button. Explanations live behind **Reminder** buttons.
- **Dashboard (Today page):** date under "Day N", every meal listed with **+** (opens Add with that meal picked), water glass, meal notes, the "Start Day N" button, and a gentle "New day?" card when the current Day began on an earlier date (after 4 AM; never automatic). The calorie pill is hidden on the Dashboard (the ring shows it). The summary card has an **Eaten / Left** switch (tapping the ring does the same) that shares `settings.pill` with the top-right pill: Left shows kcal left in the ring and grams left (or "over", in red) for protein, carbs, fat and fiber, so nobody has to do the math. Meal defaults follow the clock (before 10 Breakfast, before 14 Lunch, before 17 Snacks, before 21 Dinner).
- **On-target days:** Dashboard ⋯ → "Count this day as on target" (`day.onTarget`) for holidays and family gatherings. The day's calories and macros count as exactly the targets everywhere (Dashboard, pill, week page, Progress) via `dayTotals()`; logged entries stay listed, and "Use my real numbers" turns it off.
- **After every add** (typed, spoken, Browse foods sheet, meal sheet, Quick add, barcode): `showLogged()` opens the Dashboard and highlights the meal and foods just added. Exception: adjusting one dish from a search list that still holds other foods stays on Add.
- **Centre button** (`#fabBtn`): a round button above the bottom bar, in the middle, on every page (like a wallet app's Scan QR). Tap it for three overlapping circles, Venn style, with the middle one raised: **Quick add** · **Scan** (then Barcode or Nutrition label) · **Voice** (opens Add and starts listening).
- **Voice / typed commands** (`voiceCommand()` → `runCommand()`): "one glass of water", "2 glasses of water", "isang basong tubig" add to `day.water` and open the Dashboard; "132 pounds today", "£132" (speech-to-text for pounds), "my weight is 60 kg", "timbang ko 60 kilos" save a weigh-in via `logWeight()` and open Progress. A bare number needs a weigh word and uses the kg/lb setting. Anything else is food.
- **Edit a logged food:** tap it on the Dashboard (`openEntry()`). Plain foods: change amount/unit and meal, recalculated from the food (entries now store `qty` and `unit`). Quick adds, one-off labels and adjusted dishes: rename, scale (× what you logged) or type the numbers. Save and Delete, both with Undo.
- **Resets:** Dashboard ⋯ → **Clear this day** (foods, water, notes, on-target; keeps the Day number); Settings → **Start over from Day 1** (all Days; foods, recipes, goals and settings stay). Both offer Undo.
- **Scan label:** photo of the Nutrition Facts → read on the device with Tesseract.js (`tesseract.js@5.1.1` from jsDelivr, loaded only when scanning, ~6 MB first time; no API, photo never uploaded) → `parseLabel()` pulls kcal (kJ ÷ 4.184), protein, carbs, fat, fiber, serving size and whether the first column is per 100 g → a check sheet where every number can be fixed, with a warning when P×4 + C×4 + F×9 is more than 20% off the calories → **"Save it to My Foods so it's ready next time?"**: *Yes, add and save* (custom food with `fromLabel: true`, per 100 g + a serving unit) or *No, just this once* (one entry, nothing saved). A later scan whose per-100 g numbers match a saved label food shows "You saved this before" with **Use it**.
- **Maintenance calories** (Goals): calculated from weight, height, age and activity (Mifflin-St Jeor × activity); − / + nudge it by 50 kcal or type your own (`settings.maintKcal`, saved automatically). All calculated phases and the Progress "expected from eating" use it. "Use the calculated number" clears it.
- **Goals:** "Update my stats" (weight, age, activity → recalculates the current phase) is separate from "Change my goal" (setup again).
- Each match has a Cooked/Raw switch when a twin exists.
- **Adjustable meals:** silog meals (`MID_COMBOS`) and estimate dishes with an ingredient list (`MID_DISH_PARTS` in suggestions.js, one serving = the dish's first unit, parts are verified foods by name) open one sheet: each part has **None · Less · Normal · More · Lots** (0 / 50 / 100 / 150 / 200%), plus **Oil / fat: Normal · Oily · Very oily** (+0 / 7 / 14 g cooking oil per serving), and an "Exact grams" option. Silog logs one entry per part; a dish logs one entry named with the changes ("Beef pares · more beef, oily"). A dish's row numbers are the sum of its parts, so keep them in step when editing a list. First batch: 11 silog + 23 dishes; more dishes to follow.
- **Import foods** (Settings → Backup): adds foods from a `{ app: 'macro-id', foods: [...] }` file (or another backup's `custom`) to My Foods, skipping names you already have. Nothing else changes. A custom food's first alias is its search key, so names with amounts in them ("Taho (428g cup)") don't get split by the parser.
- **Calories as an amount:** "532 calories of chicken nuggets" sizes the food by energy (`kcal` unit in engine.js), not grams.
- **Goals:** daily targets auto-balance with locks: change calories and unlocked macros follow; a macro you type is locked; Auto-calculate resets. **Phases** (Bulking, Lean bulk, Maintenance, Cutting, Hyrox / endurance, Custom) each keep their own targets, calculated from the profile; switching loads them everywhere (`settings.phases`, `settings.phaseId`).
- **Progress:** last 7 / 30 / 90 days, one Weight card (trend chart + numbers): days logged vs skipped, averages vs target from finished days only, estimated weight change (intake − TDEE ÷ 7,700) vs actual weigh-ins, projection after 3+ full days. Weigh-ins (`settings.weighIns`, frequency `settings.weighEvery` incl. every day, usual time `settings.weighTime`) with a light-red "Weigh-in time" banner on the Dashboard when due. **Weight trend** chart: scale dots + smoothed trend line (moves 10% per day toward each reading).
- **Tutorial:** Menu → Tutorial has a guided tour that opens each page and spotlights the real element (`TOUR` steps with selectors; coach overlay) and a first-week checklist that ticks itself where it can (`settings.tour`). The Dashboard offers the tour until it's done or dismissed.
- **Days are manual.** The user taps "start Day N+1". Never roll over by clock or midnight.
- **Calculator vs Suggestions:** `foods.js` holds only verified values (USDA FoodData Central `U`, FNRI PhilFCT `F`, label `L`), and only these are auto-matched when typing. `suggestions.js` holds browse-only recipe estimates (`E`) that are never auto-used. New estimates go in `suggestions.js`.
- Unknown foods are added by the user (custom food / recipe builder). No AI or API lookups, so no token costs. **One approved exception (2026-10-16): barcode lookups** on Open Food Facts (free, sends only the barcode number; disclosed in privacy.html).
- **Barcode scanner** (Add → Scan barcode): camera via the built-in BarcodeDetector (Android Chrome) or the ZXing library from jsDelivr (`@zxing/library@0.21.3`, loaded only when scanning). Order: your saved products (`custom[].barcode`) → Open Food Facts → "type the label once". Scanned products are saved as your own foods, so the next scan is instant and offline. Typing the number works when the camera can't.
- **Quick add** (Add → Quick add): type calories and macros yourself; logged as an entry with `fid: 'quick'` (calories auto = P×4 + C×4 + F×9 unless typed).
- **Testers / feedback:** share https://extexodus-sketch.github.io/macros/ (sign in with Google or email; no Claude involved). Menu → Send feedback opens an email to extexodus@gmail.com with the phone, browser-vs-home-screen and app version filled in.
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
| `install.js` | "Add to Home Screen" help (`MacrosInstall`): hint on the sign-in screen and a Dashboard card (`settings.installHide`) when opened in a phone's browser; Menu row while not installed |
| `updates.js` | What's new timeline shown in the bell (add an entry for every change) |
| `foods.js` / `suggestions.js` | Food data, per 100 g. Rows carry reference IDs (FDC / FNRI codes) |
| `firebase-config.js` | Paste the Firebase web config here (`null` = local-only mode) |
| `firestore.rules` | Security rules: each user reads and writes only their own docs |
| `terms.html`, `privacy.html` | Legal pages (version 2026-10-16 added barcode scanning). Bump `TERMS_VERSION` in boot.js when they change |
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
