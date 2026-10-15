# maCros

A standalone macro identifier. You type or say what you're eating ("150g lean ground pork and 1 cup rice", "1 cup cinnamon toast crunch with milk", "isang tasang kanin at dalawang itlog") and it shows calories, protein, carbs, fat and fiber per food plus a total. It has manual day tracking, a recipe builder for your own sauces, and supports Filipino foods.

There's no account, no AI calls, and no token cost. Typing works fully offline.

## Open it

| Where | What to do |
|---|---|
| Phone (any) | Open the GitHub Pages link (see **Publish** below). In Safari or Chrome, use **Share → Add to Home Screen** so it opens like an app. |
| Mac | Double-click **`Start maCros.command`** (the first time, right-click → Open). |
| Windows | Double-click **`Start maCros (Windows).bat`**. This needs Python from python.org. |

## Publish / update the phone link

The app is hosted free on GitHub Pages. After any change to the files:

```bash
./deploy.sh "what changed"
```

The first run creates the public repo `macros` on your GitHub account and turns on Pages. Later runs just upload changes. Only the app's code is public; your food log never leaves your device.

## Your data

- **Days are manual.** On **My Day**, tap "Done with Day N → start Day N+1" when your day ends. The clock never changes it.
- Your phone and your PC each keep their own data. To move it, go to **Settings → Download backup** on one device, then **Restore backup** on the other.
- Copying the folder to a new PC copies the app. Use a backup to bring your data along.

## The food lists (Foods tab)

| List | What's in it | Used in calculations? |
|---|---|---|
| **Database** | USDA FoodData Central values, FNRI Philippine Food Composition Table values, product labels, plus your own foods and recipes | Yes, typing matches these |
| **Suggestions** | Recipe-based estimates (adobo, sinigang, pancit, silog plates with estimated parts…) with no official lab value | Only when you tap one on purpose |
| **My Eats** | Everything you've logged, newest first | Tap to log the same amount again |

When you type something that only exists in Suggestions (e.g. "chicken adobo"), it won't guess. It shows the estimate as a chip so you choose.

## Your own sauces (recipe builder)

1. In **Identify**, type the ingredients: `3 tbsp soy sauce, 2 tbsp honey, 1 tbsp sriracha, 2 cloves garlic`.
2. Tap **Save as recipe**, name it, and set the number of servings. Optionally enter the final cooked weight if it reduced.
3. From then on, just type `2 tbsp garlic sriracha sauce`.

## How to type foods

- Use amounts with units: `150g`, `1 cup`, `2 pcs`, `1 bowl`, `1 scoop`, `1 tbsp`, `1 can`, `oz`.
- Lean percentages work: `200g 93% lean ground beef`, `80/20 ground beef`, `lean ground pork`.
- Spoken numbers work: "one hundred fifty grams", "two and a half cups". So does Tagalog: `isang tasa`, `kalahati`, `at`.
- Weights are **cooked, as eaten**. Add `raw` or `uncooked` for raw weights.
- `for breakfast` / `lunch` / `dinner` / `snack` picks the meal automatically.

## Where the numbers come from

- **USDA**: USDA FoodData Central (SR Legacy). Ground meats, Cinnamon Toast Crunch and the sauce ingredients were checked directly against the FDC API.
- **FNRI**: Philippine Food Composition Tables (PhilFCT, i.fnri.dost.gov.ph), measured from Philippine samples. These replaced my earlier estimates where FNRI had the same food, and they replace USDA values for local varieties (carabao mango, lakatan, saba, kamote, toyo, patis…).
- **Label**: manufacturer data via USDA Branded Foods. Your local pack may differ slightly.
- **Estimate**: lives only in Suggestions.

## Files

```
index.html, style.css, app.js   the app
engine.js        parser, fuzzy search, unit math
foods.js         CALCULATOR database (verified values only, each row has its reference ID)
suggestions.js   browse-only estimates
sw.js, manifest  offline + install support
deploy.sh        publish to GitHub Pages
```
