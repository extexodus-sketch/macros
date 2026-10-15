# CLAUDE.md — maCros

Project notes for Claude Code (and humans). Read this first when picking up the project on a new machine.

## What it is
**maCros** is a zero-token macro *identifier* PWA. You type or say what you're eating, and it returns kcal, protein, carbs, fat and fiber. It's plain HTML/CSS/JS with no build step and no npm. It's live on GitHub Pages at https://extexodus-sketch.github.io/macros/ (repo `extexodus-sketch/macros`, branch `main` = live site).

## Owner's decisions (don't change without asking)
- Name is exactly **maCros**, with no subtitle.
- Weights are **cooked, as eaten**. The parser takes "raw" or "uncooked" for raw weights.
- Owner targets (bulking): **2,332 kcal / 129 g protein**. The owner didn't specify fat 65 g, carbs 308 g or fiber 33 g; those were derived.
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
| `engine.js` | Parser (English/Tagalog, spoken numbers, units, 90%/80-20), fuzzy search, macro math |
| `foods.js` / `suggestions.js` | Food data, per 100 g. Rows carry reference IDs (FDC / FNRI codes) |
| `firebase-config.js` | Paste the Firebase web config here (`null` = local-only mode) |
| `firestore.rules` | Security rules: each user reads and writes only their own docs |
| `terms.html`, `privacy.html` | Legal pages. Bump `TERMS_VERSION` in boot.js when they change |
| `sw.js` | Offline cache. Bump `CACHE` name when the asset list changes |
| `deploy.sh` | Commit + push `main` + enable Pages (`./deploy.sh "message"`). Needs the `gh` CLI signed in |
| `tools/` | Scripts used to verify food values (USDA FDC API, FNRI listing parser) |

## Run / preview
`python3 -m http.server 8760` in this folder (or `.claude/launch.json` → `macro-id`), then open http://localhost:8760. There are no tests; verify in a browser.

## Status / next steps
1. **Accounts feature is built but not live yet** (branch `accounts-wip`). It's waiting on the owner to create the Firebase project:
   - Create project `macros` (no Analytics).
   - Authentication: enable Email/Password + Google. Add authorized domain `extexodus-sketch.github.io`.
   - Firestore: asia-southeast1, production mode, then paste `firestore.rules`.
   - Add a Web app. Its `firebaseConfig` goes into `firebase-config.js`.
2. Then merge `accounts-wip` into `main` and run `./deploy.sh`. The owner creates the first account to test it (Claude can't create accounts).
3. Known caveat: Google sign-in can be flaky inside an iOS home-screen PWA. Email/password is the fallback.
4. Ideas raised: saved meals, more PH brands/restaurants, weekly averages.

## Data-source notes
- USDA FDC API: `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&query=...`. DEMO_KEY allows about 30 requests per hour.
- FNRI PhilFCT: the search needs a login, but `https://i.fnri.dost.gov.ph/fct/library/food_content/<A–T>` pages include full per-100 g proximates (see `tools/fnri_parse.py`). Don't commit the downloaded FNRI dataset to this public repo.
