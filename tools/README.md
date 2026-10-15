# Data verification tools

- `usda_lookup.py "query" ["B:branded query"]`: searches USDA FoodData Central (SR Legacy, or Branded with `B:`) and prints kcal/protein/carbs/fat/fiber per 100 g. Uses the shared DEMO_KEY (~30 requests/hour).
- `fnri_parse.py <dir> <out.json>`: parses FNRI PhilFCT food-group listing pages into JSON. First download them:
  `for L in A B C D E F G H J K M N P Q R S T; do curl -sL "https://i.fnri.dost.gov.ph/fct/library/food_content/$L" -o "<dir>/list_$L.html"; done`
  Keep the downloaded pages and JSON out of this public repo.
