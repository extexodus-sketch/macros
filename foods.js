/* Macro ID — CALCULATOR database. Only verified values live here; these are what typing auto-matches.
 *
 * Every row is PER 100 g OF THE FOOD AS EATEN (cooked), unless the name says raw / dry / uncooked.
 * Columns: [name, aliases ("|"-separated, first one is the short key), category,
 *           kcal, protein, carbs (total, incl. fiber), fat, fiber, units, source]
 * units:   "unit:grams,..." — the first unit is the default serving when no amount is given.
 * source:  U = USDA FoodData Central   F = FNRI Philippine Food Composition Tables (PhilFCT)
 *          L = product label (USDA Branded Foods)
 * The trailing // comment is the reference ID used to check the value.
 *
 * Unverified recipe estimates are NOT here; they live in suggestions.js (browse-only).
 * Write "90pct" for "90%" in aliases; the parser turns "90%" and "90/10" into that.
 */
window.MID_FOODS = (() => {
  const G = 'Rice & Grains', B = 'Bread & Bakery', N = 'Noodles & Pasta', CH = 'Chicken', PK = 'Pork', BF = 'Beef', FS = 'Fish & Seafood', EG = 'Eggs & Tofu', UL = 'Filipino Dishes', SP = 'Soups', VG = 'Vegetables', RL = 'Root Crops & Beans', FR = 'Fruits', NT = 'Nuts & Spreads', DY = 'Dairy', DR = 'Drinks', SN = 'Snacks & Street Food', DS = 'Desserts & Kakanin', FF = 'Fast Food', CO = 'Condiments & Fats', SU = 'Supplements';
  return [
    ["White rice, cooked", "rice|kanin|white rice|steamed rice|plain rice|cooked rice|jasmine rice|dinorado|sinaing|puting kanin|plain kanin", G, 130, 2.7, 28.2, 0.3, 0.4, "cup:158,tbsp:12", "U"],
    ["White rice, uncooked (raw)", "raw rice|uncooked rice|dry rice|bigas|rice raw|uncooked white rice", G, 365, 7.1, 80, 0.7, 1.3, "cup:185,tbsp:12", "U"],
    ["Brown rice, cooked", "brown rice|pinawa|cooked brown rice", G, 123, 2.7, 25.6, 1, 1.6, "cup:195", "U"],
    ["Garlic fried rice (sinangag)", "sinangag|garlic rice|garlic fried rice|fried garlic rice|sinangang", G, 187, 2.6, 35.2, 4, 0.5, "cup:170", "F"], // FNRI A021
    ["Rice porridge, plain (lugaw)", "lugaw|congee|rice porridge|porridge|plain lugaw", G, 71, 1.4, 13.9, 1.1, 0.1, "bowl:300,cup:240", "F"], // FNRI A183
    ["Champorado", "champorado|chocolate rice porridge|tsamporado", G, 97, 1.7, 22, 0.2, 0.7, "bowl:250,cup:240", "F"], // FNRI R012
    ["Oats, rolled (dry)", "oats|rolled oats|quaker oats|instant oats|oats dry|dry oats|raw oats|oatmeal dry", G, 379, 13.2, 67.7, 6.5, 10.1, "cup:81,tbsp:5", "U"],
    ["Oatmeal, cooked with water", "oatmeal|cooked oatmeal|oatmeal cooked|cooked oats|overnight oats", G, 71, 2.5, 12, 1.5, 1.7, "cup:234,bowl:300", "U"],
    ["Quinoa, cooked", "quinoa|cooked quinoa", G, 120, 4.4, 21.3, 1.9, 2.8, "cup:185", "U"],
    ["Corn flakes cereal", "corn flakes|cornflakes|cereal|kelloggs|breakfast cereal", G, 357, 7.5, 84, 0.4, 3.3, "cup:28", "U"],
    ["Granola", "granola", G, 471, 10, 64, 20, 5.3, "cup:122,tbsp:8", "U"],
    ["Pandesal", "pandesal|pan de sal|pandesal bread|pan", B, 330, 10.1, 62.9, 4.2, 2.5, "pc:30", "F"], // FNRI A042
    ["White bread (loaf)", "white bread|bread|tasty|loaf bread|gardenia|sliced bread|tinapay|toast|loaf", B, 265, 9, 49, 3.2, 2.7, "slice:27", "U"],
    ["Whole wheat bread", "wheat bread|whole wheat bread|whole wheat|brown bread|gardenia wheat", B, 252, 12.4, 43, 3.5, 6, "slice:28", "U"],
    ["Ensaymada", "ensaymada|ensaimada", B, 326, 8.6, 61.6, 5, 1.3, "pc:70", "F"], // FNRI A045
    ["Spanish bread", "spanish bread", B, 371, 9.3, 55.5, 12.4, 1, "pc:45", "F"], // FNRI A030
    ["Monay", "monay|putok|star bread", B, 318, 10.6, 61.3, 3.4, 2.4, "pc:50", "F"], // FNRI A041
    ["Pan de coco", "pan de coco", B, 349, 9.2, 60.9, 7.6, 6.6, "pc:60", "F"], // FNRI A038
    ["Hopia (mongo)", "hopia|hopia mongo|hopia ube|hopia baboy", B, 383, 6.5, 62.3, 12, 1.2, "pc:45", "F"], // FNRI A129
    ["Flour tortilla / wrap", "tortilla|wrap|flour tortilla|tortilla wrap", B, 306, 8.2, 50, 8, 3.5, "pc:45", "U"],
    ["Crackers (Skyflakes type)", "skyflakes|crackers|saltine|soda crackers|fita|biskwit|biscuit|biscuits|sky flakes", B, 480, 9.6, 65.5, 19.9, 2.9, "pack:25,pc:6", "F"], // FNRI A114
    ["Pasta, cooked (plain)", "pasta|spaghetti noodles|macaroni|penne|plain pasta|cooked pasta|noodles|fettuccine", N, 158, 5.8, 30.9, 0.9, 1.8, "cup:140", "U"],
    ["Instant pancit canton (dry, as packed)", "lucky me|lucky me pancit canton|instant pancit canton|instant canton|pancit canton instant|lucky me canton", N, 487, 12.8, 56.8, 23.2, 3.6, "pack:60", "F"], // FNRI A140
    ["Instant noodle soup (dry, as packed)", "instant noodles|instant mami|cup noodles|instant ramen|lucky me mami|nissin|payless|noodle soup instant|lucky me beef|lucky me chicken", N, 433, 10.4, 57.1, 18.1, 2.9, "pack:55", "F"], // FNRI A142
    ["Chicken breast, cooked (skinless)", "chicken breast|chicken|grilled chicken breast|grilled chicken|boiled chicken breast|baked chicken breast|dibdib ng manok|pechuga|chicken breast cooked|chicken fillet|manok|air fried chicken breast", CH, 165, 31, 0, 3.6, 0, "pc:120", "U"],
    ["Chicken breast, raw (skinless)", "raw chicken breast|chicken breast raw|uncooked chicken breast|raw chicken", CH, 120, 22.5, 0, 2.6, 0, "pc:170", "U"],
    ["Chicken thigh, cooked (skinless)", "chicken thigh|thigh fillet|skinless thigh|boneless thigh|hita ng manok|chicken thigh skinless|thigh", CH, 179, 24.8, 0, 8.2, 0, "pc:80", "U"],
    ["Chicken thigh, cooked (with skin)", "chicken thigh with skin|thigh with skin|skin on thigh", CH, 229, 23.3, 0, 14.7, 0, "pc:90", "U"],
    ["Chicken thigh, raw (skinless)", "raw chicken thigh|chicken thigh raw|raw thigh|uncooked chicken thigh", CH, 121, 19.7, 0, 4.1, 0, "pc:110", "U"],
    ["Chicken drumstick, cooked (with skin)", "drumstick|chicken leg|chicken drumstick|paa ng manok|drumsticks", CH, 216, 27, 0, 11.2, 0, "pc:75", "U"],
    ["Chicken wings, cooked (with skin)", "chicken wings|wings|chicken wing|pakpak|buffalo wings", CH, 290, 27, 0, 19.5, 0, "pc:32", "U"],
    ["Rotisserie chicken (lechon manok)", "lechon manok|rotisserie chicken|roast chicken|andoks|baliwag|roasted chicken", CH, 226, 24.8, 4.7, 12, 0, "serving:150", "F"], // FNRI F265
    ["Chicken nuggets", "nuggets|chicken nuggets|chicken nugget|nugget", CH, 296, 15, 16, 19, 1, "pc:16", "U"],
    ["Ground chicken, cooked", "ground chicken|giniling na manok|chicken mince|minced chicken", CH, 189, 23.3, 0, 10.9, 0, "cup:135", "U"],
    ["Chicken liver, cooked", "chicken liver|atay ng manok|atay", CH, 167, 24.5, 0.9, 6.5, 0, "pc:20", "U"],
    ["Pork chop, cooked", "pork chop|porkchop|pork|baboy|pork loin chop|grilled pork chop|pork loin", PK, 231, 25.5, 0, 14, 0, "pc:100", "U"],
    ["Pork tenderloin, cooked", "pork tenderloin|tenderloin|lean pork|pork lean", PK, 143, 26, 0, 3.5, 0, "serving:100", "U"],
    ["Ground pork, cooked", "ground pork|giniling|giniling na baboy|pork mince|minced pork|regular ground pork", PK, 297, 25.7, 0, 20.8, 0, "cup:135", "U"],
    ["Pork belly, grilled (liempo)", "liempo|grilled liempo|inihaw na liempo|pork belly|samgyupsal|samgyup|grilled pork belly|bbq liempo|inihaw na baboy", PK, 213, 14, 0, 17.4, 0, "serving:100,slice:30", "F"], // FNRI F148
    ["Pork belly, fried (lechon kawali)", "lechon kawali|crispy pork belly|crispy liempo|bagnet", PK, 245, 12.3, 0, 21.8, 0, "serving:100", "F"], // FNRI F149
    ["Lechon / roasted pork belly", "lechon|roast pig|lechon baboy|litson|roast pork", PK, 385, 21, 4.1, 31.6, 0, "serving:100", "F"], // FNRI F269
    ["Hotdog (Filipino red)", "hotdog|hot dog|tender juicy|hotdogs|frankfurter|jumbo hotdog|hot dogs", PK, 226, 13.4, 4.8, 17, 0.5, "pc:45", "F"], // FNRI F253
    ["Luncheon meat (Spam type)", "spam|luncheon meat|maling|ma ling|chinese luncheon meat", PK, 315, 13, 4.6, 26.6, 0, "slice:56,can:340", "U"],
    ["Vienna sausage (canned)", "vienna sausage|vienna|vienna sausages", PK, 230, 10.5, 2.6, 19.4, 0, "pc:16,can:130", "U"],
    ["Bacon, cooked", "bacon|crispy bacon", PK, 541, 37, 1.4, 42, 0, "slice:8", "U"],
    ["Beef steak, sirloin (cooked)", "beef steak|steak|sirloin|beef sirloin|grilled beef|beef|baka|sirloin steak", BF, 206, 29, 0, 9.4, 0, "serving:150", "U"],
    ["Ribeye steak, cooked", "ribeye|rib eye|ribeye steak|rib eye steak", BF, 291, 24, 0, 21.8, 0, "serving:200", "U"],
    ["Ground beef, 80% lean (cooked)", "ground beef|80pct ground beef|80pct lean ground beef|ground beef 80pct|giniling na baka|beef mince|minced beef|hamburger meat|regular ground beef", BF, 272, 27, 0, 17.4, 0, "cup:135", "U"], // USDA FDC 171799
    ["Ground beef, 90% lean (cooked)", "lean ground beef|90pct lean ground beef|90pct ground beef|ground beef 90pct|lean beef mince|lean giniling na baka", BF, 230, 28.4, 0, 12, 0, "cup:135", "U"], // USDA FDC 171794
    ["Beef burger patty, cooked", "burger patty|beef patty|hamburger patty|patty|beef burger patty", BF, 254, 25.8, 0, 16.1, 0, "pc:85", "U"],
    ["Beef, braised / stewed (chuck)", "beef stew meat|stewed beef|braised beef|beef chuck|beef brisket|beef cubes|nilagang baka meat|brisket", BF, 250, 30, 0, 14, 0, "cup:140,serving:100", "U"],
    ["Corned beef (canned)", "corned beef|carne norte|argentina corned beef|purefoods corned beef|ginisang corned beef", BF, 168, 17.9, 0, 10.7, 0, "can:150,tbsp:17", "F"], // FNRI F226
    ["Milkfish (bangus), grilled", "bangus|milkfish|grilled bangus|inihaw na bangus|steamed bangus|paksiw na bangus|rellenong bangus", FS, 137, 23.4, 0, 4.8, 0, "serving:150", "F"], // FNRI G075
    ["Daing na bangus (fried)", "daing na bangus|fried bangus|boneless bangus|pritong bangus|bangus belly|fried milkfish", FS, 188, 23.6, 0, 10.4, 0, "serving:150", "F"], // FNRI G076
    ["Tilapia, cooked", "tilapia|grilled tilapia|steamed tilapia|inihaw na tilapia|fish|isda|cooked fish", FS, 128, 26.2, 0, 2.7, 0, "pc:150", "U"],
    ["Salmon, cooked", "salmon|grilled salmon|baked salmon|salmon fillet|salmon belly", FS, 206, 22.1, 0, 12.4, 0, "serving:150", "U"],
    ["Tuna, canned in water (drained)", "tuna in water|canned tuna|tuna|tuna flakes in water|tuna water", FS, 116, 25.5, 0, 0.8, 0, "can:110,tbsp:15", "U"],
    ["Tuna flakes in oil (drained)", "tuna in oil|century tuna|tuna flakes in oil|tuna flakes|century tuna flakes|tuna oil", FS, 198, 29, 0, 8.2, 0, "can:120,tbsp:15", "U"],
    ["Sardines in tomato sauce (canned)", "sardines|sardinas|ligo|fivefivefive sardines|sardines in tomato sauce|mega sardines|ligo sardines|sardine", FS, 88, 9.7, 2.7, 4.3, 0.4, "can:155", "F"], // FNRI G203
    ["Shrimp, cooked", "shrimp|hipon|prawns|prawn|boiled shrimp|grilled shrimp|steamed shrimp|nilasing na hipon", FS, 99, 24, 0.2, 0.3, 0, "pc:8,cup:145", "U"],
    ["Squid, fried (calamares)", "calamares|fried squid|fried calamari|calamari", FS, 175, 18, 7.8, 7.5, 0, "serving:100", "U"],
    ["Squid (pusit), boiled", "pusit|squid|grilled squid|inihaw na pusit|adobong pusit", FS, 80, 17.4, 0, 1.2, 0, "serving:150", "F"], // FNRI G132
    ["Tinapa (smoked fish)", "tinapa|smoked fish|smoked galunggong|smoked bangus", FS, 158, 31.6, 0, 3.5, 0, "pc:60", "F"], // FNRI G208
    ["Crab, cooked", "crab|alimango|alimasag|talangka|crabs", FS, 97, 19.4, 0, 1.5, 0, "serving:100", "U"],
    ["Mussels, cooked (tahong)", "tahong|mussels|mussel|baked tahong|steamed tahong", FS, 172, 23.8, 7.4, 4.5, 0, "pc:8,cup:150", "U"],
    ["Egg, boiled (whole)", "egg|eggs|boiled egg|hard boiled egg|itlog|nilagang itlog|soft boiled egg|whole egg|poached egg|boiled eggs|hardboiled egg|raw egg", EG, 155, 12.6, 1.1, 10.6, 0, "pc:50", "U"],
    ["Egg, fried", "fried egg|sunny side up|pritong itlog|fried eggs|egg fried|over easy", EG, 196, 13.6, 0.8, 15, 0, "pc:46", "U"],
    ["Scrambled eggs", "scrambled egg|scrambled eggs|omelette|omelet|torta|tortang itlog|scrambled", EG, 148, 10, 1.6, 11, 0, "pc:61,cup:220", "U"],
    ["Egg white", "egg white|egg whites|puti ng itlog|liquid egg white|liquid egg whites", EG, 52, 10.9, 0.7, 0.2, 0, "pc:33,cup:243", "U"],
    ["Balut", "balut|penoy", EG, 172, 12.8, 2.2, 12.4, 0, "pc:65", "F"], // FNRI H016
    ["Quail eggs, boiled", "quail egg|quail eggs|itlog ng pugo|pugo", EG, 158, 13, 0.4, 11, 0, "pc:9", "U"],
    ["Tokwa (firm tofu)", "tofu|tokwa|firm tofu|tokua|bean curd", EG, 123, 12.9, 2, 7, 0.5, "pc:120,cup:252,slice:85", "F"], // FNRI C064
    ["Tofu, fried (pritong tokwa)", "fried tofu|pritong tokwa|fried tokwa|tofu fried|tokwa fried", EG, 271, 17.3, 10.5, 20.2, 3.9, "pc:60", "U"],
    ["Arroz caldo", "arroz caldo|aroskaldo|chicken lugaw|lugaw with chicken|chicken congee|chicken porridge", SP, 63, 2, 12.8, 0.4, 0.5, "bowl:350,cup:240", "F"], // FNRI R011
    ["Goto", "goto|lugaw with tripe|tripe congee|goto lugaw", SP, 53, 2, 8.3, 1.3, 0.1, "bowl:350,cup:240", "F"], // FNRI R013
    ["Broccoli, boiled", "broccoli|steamed broccoli|boiled broccoli|brocolli", VG, 35, 2.4, 7.2, 0.4, 3.3, "cup:156", "U"],
    ["Kangkong, boiled", "kangkong|water spinach|swamp cabbage|steamed kangkong|boiled kangkong", VG, 20, 2.1, 3.1, 0.2, 1.9, "cup:98", "U"],
    ["Pechay, boiled", "pechay|bok choy|pak choi|petsay|pechay tagalog|bokchoy", VG, 21, 1.7, 2.4, 0.5, 1.1, "cup:170", "F"], // FNRI D161
    ["Malunggay leaves", "malunggay|moringa|moringa leaves|malunggay leaves|dahon ng malunggay", VG, 108, 9.7, 12.7, 2, 6.7, "cup:21,tbsp:2", "F"], // FNRI D094
    ["Ampalaya, boiled", "ampalaya|bitter melon|bitter gourd|amargoso", VG, 19, 0.8, 4.3, 0.2, 2, "cup:124", "U"],
    ["Sitaw (string beans), boiled", "sitaw|string beans|yardlong beans|long beans", VG, 47, 2.5, 9.2, 0.1, 1.9, "cup:104", "U"],
    ["Green beans (Baguio beans), boiled", "baguio beans|green beans|habichuelas|french beans|habitsuelas", VG, 35, 1.9, 7.9, 0.3, 3.2, "cup:125", "U"],
    ["Eggplant (talong), cooked", "talong|eggplant|aubergine|grilled eggplant|inihaw na talong|boiled eggplant", VG, 35, 0.8, 8.7, 0.2, 2.5, "pc:150,cup:99", "U"],
    ["Okra, boiled", "okra|lady finger|ladys finger", VG, 22, 1.9, 4.5, 0.2, 2.5, "cup:160,pc:12", "U"],
    ["Squash (kalabasa), boiled", "kalabasa|squash|pumpkin|boiled squash", VG, 47, 0.4, 10.8, 0.2, 1.1, "cup:200", "F"], // FNRI D226
    ["Chayote (sayote), boiled", "sayote|chayote|boiled sayote", VG, 24, 0.6, 5.1, 0.5, 2.8, "cup:160", "U"],
    ["Cabbage (repolyo), boiled", "repolyo|cabbage|boiled cabbage", VG, 23, 1.3, 5.5, 0.1, 1.9, "cup:150", "U"],
    ["Carrots, boiled", "carrots|carrot|boiled carrots|steamed carrots", VG, 35, 0.8, 8.2, 0.2, 3, "cup:156,pc:46", "U"],
    ["Carrots, raw", "raw carrots|raw carrot|carrot sticks|carrots raw|baby carrots", VG, 41, 0.9, 9.6, 0.2, 2.8, "pc:61,cup:128", "U"],
    ["Tomato, raw", "tomato|tomatoes|kamatis", VG, 18, 0.9, 3.9, 0.2, 1.2, "pc:120,cup:180", "U"],
    ["Cucumber, raw", "cucumber|pipino|cucumbers", VG, 15, 0.7, 3.6, 0.1, 0.5, "cup:104,pc:300", "U"],
    ["Lettuce (romaine), raw", "lettuce|romaine|salad greens|salad|green salad|letsugas|garden salad", VG, 17, 1.2, 3.3, 0.3, 2.1, "cup:47", "U"],
    ["Spinach, raw", "spinach|baby spinach", VG, 23, 2.9, 3.6, 0.4, 2.2, "cup:30", "U"],
    ["Onion, raw", "onion|sibuyas|onions|red onion|white onion", VG, 40, 1.1, 9.3, 0.1, 1.7, "pc:110,tbsp:10", "U"],
    ["Spring onion, raw", "spring onion|spring onions|scallion|scallions|green onion|dahon ng sibuyas|sibuyas dahon", VG, 32, 1.8, 7.3, 0.2, 2.6, "tbsp:6,pc:15", "U"], // USDA FDC 170005
    ["Garlic, raw", "garlic|bawang|garlic clove", VG, 149, 6.4, 33, 0.5, 2.1, "clove:3,tbsp:8.5", "U"],
    ["Mushrooms, cooked", "mushrooms|mushroom|button mushroom|kabute|shiitake|button mushrooms", VG, 28, 3.6, 4, 0.3, 1.8, "cup:108", "U"],
    ["Bean sprouts (togue), boiled", "togue|toge|bean sprouts|mung bean sprouts|sprouts", VG, 21, 2, 4.2, 0.1, 0.8, "cup:124", "U"],
    ["Corn on the cob, boiled", "corn|sweet corn|corn on the cob|boiled corn|corn kernels|sweetcorn", VG, 96, 3.4, 21, 1.5, 2.4, "pc:100,cup:150", "U"],
    ["Kamote (white), boiled", "kamote|sweet potato|camote|boiled kamote|nilagang kamote|boiled sweet potato|sweet potatoes", RL, 126, 0.4, 29.3, 0.8, 3.9, "pc:130,cup:200", "F"], // FNRI B012
    ["Sweet potato, baked", "baked sweet potato|roasted sweet potato|baked kamote|roasted kamote|inihaw na kamote", RL, 90, 2, 20.7, 0.2, 3.3, "pc:114,cup:200", "U"],
    ["Potato, boiled", "potato|potatoes|patatas|boiled potato|boiled potatoes", RL, 87, 1.9, 20, 0.1, 1.8, "pc:150,cup:156", "U"],
    ["Mashed potato", "mashed potato|mashed potatoes|mash", RL, 113, 1.9, 16.9, 4.2, 1.5, "cup:210", "U"],
    ["Cassava (kamoteng kahoy), boiled", "cassava|kamoteng kahoy|balinghoy|yuca|boiled cassava", RL, 111, 0.4, 27.1, 0.1, 1.3, "pc:100,cup:150", "F"], // FNRI B002
    ["Taro (gabi), boiled", "gabi|taro|boiled gabi", RL, 105, 1.5, 24.4, 0.1, 3.7, "cup:132", "F"], // FNRI B016
    ["Ube (purple yam), boiled", "ube|purple yam|ubi|boiled ube", RL, 77, 0.7, 18.2, 0.1, 2.6, "cup:136", "F"], // FNRI B021
    ["Saba banana, boiled", "saba|nilagang saging|boiled saba|boiled banana|saging na saba|plantain|nilagang saba", RL, 159, 1.2, 38.6, 0, 4.2, "pc:80", "F"], // FNRI E015
    ["Mung beans, boiled", "mung beans|boiled monggo|monggo beans|green gram|boiled mung beans", RL, 105, 7, 19.2, 0.4, 7.6, "cup:202", "U"],
    ["Chickpeas (garbanzos), boiled", "chickpeas|garbanzos|garbanzo|chick peas|garbanzo beans", RL, 164, 8.9, 27.4, 2.6, 7.6, "cup:164", "U"],
    ["Black beans, boiled", "black beans|black bean", RL, 132, 8.9, 23.7, 0.5, 8.7, "cup:172", "U"],
    ["Lentils, boiled", "lentils|lentil", RL, 116, 9, 20.1, 0.4, 7.9, "cup:198", "U"],
    ["Pork and beans (canned)", "pork and beans|pork n beans|baked beans|pork beans", RL, 105, 4.7, 17.6, 1.8, 5.3, "can:230,cup:250,tbsp:16", "F"], // FNRI R086
    ["Banana (Cavendish)", "banana|bananas|saging|cavendish|ripe banana|del monte banana", FR, 89, 1.1, 22.8, 0.3, 2.6, "pc:118", "U"],
    ["Banana, latundan", "latundan|senorita banana|latundan banana", FR, 105, 1.2, 24.4, 0.3, 2.8, "pc:80", "F"], // FNRI E012
    ["Mango, ripe (carabao)", "mango|mangga|ripe mango|carabao mango|hinog na mangga|manggang hinog|mangoes", FR, 70, 0.6, 16.4, 0.2, 1.7, "pc:200,cup:165,slice:100", "F"], // FNRI E051
    ["Mango, green (unripe)", "green mango|manggang hilaw|unripe mango|hilaw na mangga|indian mango", FR, 63, 0.5, 14.9, 0.2, 1.5, "pc:200,cup:165", "F"], // FNRI E052
    ["Papaya", "papaya|papaya ripe|hinog na papaya|papaw", FR, 43, 0.5, 10.8, 0.3, 1.7, "cup:145,slice:150", "U"],
    ["Pineapple", "pineapple|pinya|pinyapol|pineapples", FR, 50, 0.5, 13.1, 0.1, 1.4, "cup:165,slice:84", "U"],
    ["Watermelon", "watermelon|pakwan", FR, 30, 0.6, 7.6, 0.2, 0.4, "slice:280,cup:152", "U"],
    ["Melon (cantaloupe)", "melon|cantaloupe|muskmelon|milon", FR, 34, 0.8, 8.2, 0.2, 0.9, "slice:70,cup:160", "U"],
    ["Apple", "apple|apples|mansanas", FR, 52, 0.3, 13.8, 0.2, 2.4, "pc:182", "U"],
    ["Orange", "orange|oranges|dalandan|kahel|ponkan|mandarin|dalanghita", FR, 47, 0.9, 11.8, 0.1, 2.4, "pc:130", "U"],
    ["Pomelo (suha)", "pomelo|suha|lukban", FR, 38, 0.8, 9.6, 0, 1, "cup:190", "U"],
    ["Guava (bayabas)", "guava|bayabas", FR, 68, 2.6, 14.3, 1, 5.4, "pc:55", "U"],
    ["Chico (sapodilla)", "chico|tsiko|sapodilla", FR, 83, 0.4, 20, 1.1, 5.3, "pc:170", "U"],
    ["Jackfruit (langka)", "langka|jackfruit|ripe langka", FR, 111, 1.4, 25.4, 0.4, 1.6, "cup:165", "F"], // FNRI E033
    ["Atis (sugar apple)", "atis|sugar apple|sweetsop", FR, 94, 2.1, 23.6, 0.3, 4.4, "pc:100", "U"],
    ["Rambutan", "rambutan", FR, 87, 1.2, 18.6, 0.9, 0.9, "pc:9", "F"], // FNRI E076
    ["Lanzones", "lanzones|lansones|langsat", FR, 64, 1, 14.2, 0.3, 2.7, "pc:12", "F"], // FNRI E039
    ["Mangosteen", "mangosteen|manggostan", FR, 84, 0.7, 18.6, 0.8, 1.8, "pc:30", "F"], // FNRI E058
    ["Durian", "durian", FR, 147, 1.5, 27.1, 5.3, 3.8, "serving:100,cup:243", "U"],
    ["Dragon fruit", "dragon fruit|pitaya|dragonfruit", FR, 66, 1, 13.2, 1, 2, "pc:350,cup:220", "F"], // FNRI E117
    ["Grapes", "grapes|ubas|grape", FR, 69, 0.7, 18.1, 0.2, 0.9, "cup:151,pc:5", "U"],
    ["Strawberries", "strawberries|strawberry", FR, 32, 0.7, 7.7, 0.3, 2, "cup:152,pc:12", "U"],
    ["Avocado", "avocado|abokado|avocados", FR, 160, 2, 8.5, 14.7, 6.7, "pc:150,cup:150", "U"],
    ["Calamansi", "calamansi|kalamansi|calamondin", FR, 44, 0.4, 8.3, 1, 2.4, "pc:12", "F"], // FNRI E023
    ["Young coconut meat (buko)", "buko|buko meat|young coconut meat|young coconut|malauhog", FR, 102, 1.4, 12.1, 5.3, 1.2, "cup:80", "F"], // FNRI C008
    ["Peanuts, roasted", "peanuts|peanut|mani|roasted peanuts|adobong mani|fried peanuts", NT, 585, 24.4, 21.3, 49.7, 8.4, "handful:28,tbsp:9,cup:146", "U"],
    ["Peanuts, boiled", "boiled peanuts|nilagang mani", NT, 318, 13.5, 21.3, 22, 8.8, "cup:63,handful:40", "U"],
    ["Peanut butter", "peanut butter|pb|lilys|skippy|lilys peanut butter", NT, 588, 25, 20, 50, 6, "tbsp:16,tsp:5", "U"],
    ["Almonds", "almonds|almond", NT, 579, 21.2, 21.6, 49.9, 12.5, "handful:28,pc:1.2,cup:143", "U"],
    ["Cashews", "cashews|cashew|kasoy|cashew nuts", NT, 553, 18.2, 30.2, 43.9, 3.3, "handful:28,cup:137", "U"],
    ["Chia seeds", "chia seeds|chia", NT, 486, 16.5, 42.1, 30.7, 34.4, "tbsp:12", "U"],
    ["Chocolate hazelnut spread", "nutella|chocolate spread|choco spread|hazelnut spread", NT, 539, 6.3, 57.5, 30.9, 3.4, "tbsp:19", "U"],
    ["Coconut meat, mature (niyog)", "niyog|coconut meat|grated coconut|kinayod na niyog|mature coconut", NT, 354, 3.3, 15.2, 33.5, 9, "cup:80", "U"],
    ["Milk, whole (fresh)", "milk|whole milk|fresh milk|full cream milk|gatas|full cream", DY, 61, 3.2, 4.8, 3.3, 0, "cup:244,glass:244,tbsp:15", "U"],
    ["Milk, low fat", "low fat milk|lowfat milk|reduced fat milk|semi skimmed milk|light milk", DY, 50, 3.3, 4.8, 2, 0, "cup:244,glass:244", "U"],
    ["Milk, skim / non-fat", "skim milk|nonfat milk|non fat milk|skimmed milk|fat free milk", DY, 34, 3.4, 5, 0.1, 0, "cup:245,glass:245", "U"],
    ["Evaporated milk", "evaporated milk|evap|alaska evap|evaporada|evaporated", DY, 134, 6.8, 10, 7.6, 0, "tbsp:15,can:370,cup:252", "U"],
    ["Condensed milk (sweetened)", "condensed milk|condensada|kondensada|sweetened condensed milk|condensed", DY, 321, 7.9, 54.4, 8.7, 0, "tbsp:19,can:300", "U"],
    ["Powdered milk (full cream)", "powdered milk|milk powder|bear brand|birch tree|nido|alaska powdered milk|powdered", DY, 496, 26.3, 38.4, 26.7, 0, "tbsp:8,cup:128", "U"],
    ["Greek yogurt, plain non-fat", "greek yogurt|greek yoghurt|nonfat greek yogurt|non fat greek yogurt", DY, 59, 10.2, 3.6, 0.4, 0, "cup:245,tbsp:15", "U"],
    ["Yogurt, plain (whole milk)", "yogurt|yoghurt|plain yogurt|natural yogurt", DY, 61, 3.5, 4.7, 3.3, 0, "cup:245,tbsp:15", "U"],
    ["Cottage cheese", "cottage cheese", DY, 98, 11.1, 3.4, 4.3, 0, "cup:226,tbsp:14", "U"],
    ["Filled cheese (Eden type)", "cheese|eden|eden cheese|processed cheese|quickmelt|kraft cheese|cheese slice|quick melt", DY, 297, 16.2, 5.5, 23.4, 0, "slice:20,tbsp:10", "F"], // FNRI J003
    ["Cheddar cheese", "cheddar|cheddar cheese", DY, 403, 24.9, 1.3, 33.1, 0, "slice:21,tbsp:7", "U"],
    ["Mozzarella cheese", "mozzarella|mozzarella cheese|mozza", DY, 300, 22.2, 2.2, 22.4, 0, "slice:28,cup:113", "U"],
    ["Kesong puti", "kesong puti|white cheese|carabao cheese|kesong", DY, 299, 13.2, 5.3, 25, 0, "slice:30", "F"], // FNRI J004
    ["All-purpose cream", "all purpose cream|nestle cream|cream|table cream", DY, 241, 2.3, 4.2, 23.9, 0, "tbsp:15", "F"], // FNRI J007
    ["Water", "water|tubig|plain water", DR, 0, 0, 0, 0, 0, "glass:240,bottle:500,cup:240", "U"],
    ["Coffee, black", "coffee|black coffee|americano|kape|brewed coffee|espresso|barako|kapeng barako", DR, 1, 0.1, 0, 0, 0, "cup:240,glass:240", "U"],
    ["3-in-1 coffee mix (sachet)", "threeinone|threeinone coffee|coffee mix|nescafe original|kopiko|great taste|instant coffee mix|coffee sachet|nescafe", DR, 392, 3.6, 92.5, 0.8, 0, "pack:20", "F"], // FNRI Q011
    ["Soft drink, regular", "coke|coca cola|cola|softdrinks|soft drink|soda|pepsi|royal|sprite|7up|sevenup|mountain dew|rc cola|sarsi|softdrink", DR, 42, 0, 10.6, 0, 0, "can:330,glass:240,bottle:500", "U"],
    ["Soft drink, zero / diet", "coke zero|diet coke|zero sugar|pepsi max|coke light|sprite zero|diet soda|zero coke", DR, 0.4, 0, 0.1, 0, 0, "can:330,bottle:500", "U"],
    ["Orange juice", "orange juice|oj|juice|fresh orange juice", DR, 45, 0.7, 10.4, 0.2, 0.2, "glass:248,cup:248", "U"],
    ["Coconut water (buko juice)", "buko juice|coconut water|buko water|sabaw ng buko", DR, 19, 0.7, 3.7, 0.2, 1.1, "glass:240,cup:240,pc:300", "U"],
    ["Sports drink", "gatorade|pocari|pocari sweat|powerade|sports drink", DR, 24, 0, 6, 0, 0, "bottle:500", "U"],
    ["Beer (pale lager)", "beer|san miguel|san mig|pale pilsen|serbesa|lager|san miguel beer|cerveza", DR, 43, 0.5, 3.6, 0, 0, "bottle:320,can:330,glass:240", "U"],
    ["Liquor (gin, rum, brandy)", "gin|rum|brandy|whiskey|vodka|tanduay|emperador|ginebra|lambanog|alfonso|tequila|liquor|alak", DR, 231, 0, 0, 0, 0, "shot:30,glass:60", "U"],
    ["Wine", "wine|red wine|white wine|alak na wine", DR, 85, 0.1, 2.6, 0, 0, "glass:150", "U"],
    ["Fish ball, fried", "fishball|fish ball|fish balls|fishballs|squid ball|squidball|squid balls", SN, 266, 10.3, 33.3, 10.2, 0, "pc:8,stick:40", "F"], // FNRI G162
    ["Isaw, chicken (grilled)", "isaw|isaw manok|chicken isaw|isaw baboy", SN, 210, 28.2, 3, 9.6, 0, "stick:30", "F"], // FNRI F101
    ["Siomai (pork, steamed)", "siomai|shumai|pork siomai|siomai steamed|fried siomai", SN, 298, 10.5, 26.4, 16.7, 0.6, "pc:25", "F"], // FNRI R108
    ["Siopao (pork)", "siopao|siopao asado|siopao bola bola|pork bun|asado siopao", SN, 294, 9.2, 39, 11.2, 1.5, "pc:120", "F"], // FNRI R005
    ["Empanada", "empanada|empanadas", SN, 435, 11.9, 41.1, 24.8, 2.5, "pc:90", "F"], // FNRI R009
    ["Turon", "turon|banana lumpia|turon saging", SN, 259, 2.4, 48, 6.4, 1.6, "pc:70", "F"], // FNRI E102
    ["Banana cue", "banana cue|bananacue|banana q|banana que|bananaque", SN, 183, 2, 37.8, 2.6, 1.6, "stick:150,pc:75", "F"], // FNRI E101
    ["Camote cue", "camote cue|kamote cue|camotecue|kamote q|kamotecue", SN, 239, 1.1, 43.1, 6.9, 4.3, "stick:120", "F"], // FNRI B037
    ["Chicharon (pork rinds)", "chicharon|chicharron|pork rinds|tsitsaron|chicharon baboy|chicharon bulaklak", SN, 591, 65.6, 0, 36.5, 0, "serving:15,pack:60", "F"], // FNRI F242
    ["Potato chips", "chips|potato chips|piattos|pringles|lays|crisps|potato crisps", SN, 536, 7, 53, 35, 4.4, "pack:40,handful:28", "U"],
    ["Corn chips (Chippy type)", "chippy|corn chips|nachos|tortilla chips|nova|clover chips|boy bawang|cornick|corn snack", SN, 527, 5.9, 60.3, 29.1, 4, "pack:30,handful:28", "F"], // FNRI A069
    ["Banana chips", "banana chips", SN, 519, 2.3, 58.4, 33.6, 7.7, "handful:28,cup:72", "U"],
    ["Popcorn (salted)", "popcorn|buttered popcorn|microwave popcorn", SN, 471, 6.7, 69.2, 18.6, 9.9, "cup:11", "F"], // FNRI A156
    ["Burger (fast food, regular)", "burger|hamburger|cheeseburger|yumburger|burger mcdo|mcdo burger|cheese burger|regular burger", FF, 265, 14, 30.1, 9.9, 1.5, "pc:110", "F"], // FNRI R008
    ["French fries", "fries|french fries|potato fries|mcdo fries|jolly crispy fries", FF, 312, 3.4, 41, 15, 3.8, "serving:110", "U"],
    ["Pizza (cheese / regular)", "pizza|cheese pizza|pepperoni pizza|hawaiian pizza|pizza slice", FF, 266, 11.4, 33, 10, 2.3, "slice:107", "U"],
    ["Leche flan", "leche flan|flan|creme caramel|leche", DS, 228, 5.9, 41.4, 4.3, 0, "slice:70", "F"], // FNRI M016
    ["Halo-halo", "halo halo|halohalo", DS, 82, 1, 18.7, 0.3, 1, "glass:350,cup:240", "F"], // FNRI R019
    ["Taho", "taho", DS, 62, 2.2, 13.1, 0.1, 0.1, "cup:250,glass:250", "F"], // FNRI C066
    ["Puto", "puto|rice cake|puto cheese|puto bumbong", DS, 214, 2.8, 49.9, 0.3, 1.5, "pc:35", "F"], // FNRI A177
    ["Bibingka", "bibingka", DS, 234, 3.6, 52.9, 0.9, 0.8, "pc:120", "F"], // FNRI A173
    ["Suman", "suman|suman sa ibos|suman malagkit|budbud|suman moron", DS, 171, 3.1, 38, 0.7, 2.2, "pc:80", "F"], // FNRI A191
    ["Kutsinta", "kutsinta|cutchinta|kuchinta", DS, 166, 1.4, 38.4, 0.8, 0.7, "pc:30", "F"], // FNRI A179
    ["Biko", "biko|bico|sinukmani|kalamay", DS, 252, 2.2, 58.7, 0.9, 2, "slice:70", "F"], // FNRI A168
    ["Maja blanca", "maja blanca|maja", DS, 149, 1.3, 33.4, 1.1, 1.9, "slice:80", "F"], // FNRI A104
    ["Ube halaya", "ube halaya|halayang ube|ube jam|halaya", DS, 296, 7.1, 66.1, 0.4, 1.2, "tbsp:20,serving:60", "F"], // FNRI M027
    ["Cassava cake", "cassava cake|cassava bibingka", DS, 181, 0.4, 44.1, 0.3, 1.6, "slice:80", "F"], // FNRI B026
    ["Buko pie", "buko pie", DS, 266, 4.4, 45.9, 7.2, 2, "slice:100", "F"], // FNRI R016
    ["Polvoron", "polvoron", DS, 469, 6.8, 73.6, 16.4, 1.2, "pc:20", "F"], // FNRI M040
    ["Ice cream (vanilla)", "ice cream|vanilla ice cream|selecta|icecream", DS, 207, 3.5, 23.6, 11, 0.7, "scoop:66,cup:132", "U"],
    ["Chocolate cake (frosted)", "cake|chocolate cake|birthday cake|cake slice|red ribbon cake|goldilocks cake|chocolate moist cake", DS, 370, 4.5, 52, 17, 2, "slice:90", "U"],
    ["Donut (glazed)", "donut|doughnut|glazed donut|krispy kreme|dunkin|donuts", DS, 421, 6.4, 51, 22.9, 1.5, "pc:60", "U"],
    ["Cookies (chocolate chip)", "cookie|cookies|chocolate chip cookie|choco chip cookie", DS, 488, 5.4, 64, 24, 2.4, "pc:16", "U"],
    ["Milk chocolate", "chocolate|milk chocolate|chocolate bar|cadbury|hershey|hersheys|goya", DS, 535, 7.7, 59.4, 29.7, 3.4, "pack:40", "U"],
    ["Cooking oil", "oil|cooking oil|vegetable oil|canola oil|palm oil|coconut oil|olive oil|mantika|sesame oil", CO, 884, 0, 0, 100, 0, "tbsp:13.6,tsp:4.5", "U"],
    ["Butter / margarine", "butter|mantikilya|margarine|dairy creme|star margarine|buttercup", CO, 717, 0.9, 0.1, 81, 0, "tbsp:14,tsp:4.7", "U"],
    ["Mayonnaise", "mayonnaise|mayo|ladys choice|best foods", CO, 680, 1, 0.6, 75, 0, "tbsp:14,tsp:5", "U"],
    ["Sugar, white", "sugar|white sugar|asukal|refined sugar", CO, 387, 0, 100, 0, 0, "tsp:4,tbsp:12.5", "U"],
    ["Brown sugar", "brown sugar|muscovado|asukal na pula|washed sugar", CO, 380, 0.1, 98, 0, 0, "tsp:4,tbsp:13", "U"],
    ["Honey", "honey|pulot|pulot pukyutan", CO, 304, 0.3, 82.4, 0, 0.2, "tbsp:21,tsp:7", "U"],
    ["Soy sauce (toyo)", "soy sauce|toyo|silver swan", CO, 75, 3.5, 15, 0.1, 1, "tbsp:16,tsp:5", "F"], // FNRI N023
    ["Vinegar (suka)", "vinegar|suka|sukang maasim|datu puti|spiced vinegar|sinamak", CO, 7, 0, 1.4, 0.1, 0, "tbsp:15", "F"], // FNRI N027
    ["Fish sauce (patis)", "patis|fish sauce", CO, 49, 10.6, 0.9, 0.3, 0, "tbsp:18,tsp:6", "F"], // FNRI N011
    ["Banana ketchup", "banana ketchup|ketchup|catsup|ufc|jufran|tomato ketchup", CO, 221, 0.7, 54, 0.2, 0.6, "tbsp:17,tsp:6", "F"], // FNRI N004
    ["Bagoong alamang (shrimp paste)", "bagoong|bagoong alamang|shrimp paste|alamang|ginisang bagoong", CO, 61, 12.4, 0.6, 1, 1.3, "tbsp:16,tsp:5", "F"], // FNRI N021
    ["Oyster sauce", "oyster sauce", CO, 51, 1.4, 10.9, 0.3, 0.3, "tbsp:18", "U"],
    ["Coconut milk (gata)", "coconut milk|canned coconut milk|coconut cream|gata|gata ng niyog", CO, 230, 2.3, 5.5, 23.8, 2.2, "cup:240,tbsp:15", "U"],
    ["Whey protein powder", "whey|whey protein|protein powder|protein shake|isolate|whey isolate|optimum nutrition|gold standard|rule one|myprotein|protein", SU, 400, 78, 8, 6, 1, "scoop:31", "L"],
    ["Creatine", "creatine|creatine monohydrate", SU, 0, 0, 0, 0, 0, "scoop:5,tsp:5", "L"],
    ["Cinnamon Toast Crunch cereal", "cinnamon toast crunch|ctc|cinnamon toast|cinnamon crunch|cinnamon cereal", G, 415, 4.9, 80.5, 9.8, 7.3, "cup:41,handful:20", "L"], // USDA Branded FDC 2777402
    ["Ground pork, 96% lean (cooked)", "lean ground pork|96pct lean ground pork|extra lean ground pork|ground pork lean|lean giniling|lean pork mince|lean giniling na baboy", PK, 187, 30.6, 0, 7.2, 0, "cup:135", "U"], // USDA FDC 169193
    ["Ground beef, 93% lean (cooked)", "93pct lean ground beef|93pct ground beef|ground beef 93pct|extra lean ground beef|extra lean beef mince", BF, 209, 28.9, 0, 9.5, 0, "cup:135", "U"], // USDA FDC 174755
    ["Banana, lakatan", "lakatan|lakatan banana|saging na lakatan", FR, 126, 1.4, 29.6, 0.2, 3.3, "pc:100", "F"], // FNRI E011
    ["Kamote (purple), boiled", "purple kamote|purple sweet potato|kamote murado|kamoteng ube", RL, 122, 0.6, 29.5, 0.2, 4, "pc:130,cup:200", "F"], // FNRI B010
    ["Corn on the cob, native (boiled)", "mais|nilagang mais|native corn|yellow corn|white corn|boiled native corn", VG, 167, 3.3, 35.7, 1.2, 3.7, "pc:100", "F"], // FNRI A005
    ["Rice noodles (bihon), boiled", "boiled bihon|plain bihon|bihon noodles|rice vermicelli", N, 115, 0.5, 26.9, 0.6, 1.1, "cup:120", "F"], // FNRI A138
    ["Glass noodles (sotanghon), boiled", "boiled sotanghon|plain sotanghon|sotanghon noodles|mung bean noodles", N, 78, 0, 19.3, 0.1, 0.1, "cup:140", "F"], // FNRI A135
    ["Longganisa, pork (uncooked)", "raw longganisa|uncooked longganisa|longganisa uncooked|longganisa raw", PK, 315, 11.8, 15.8, 22.7, 0.9, "pc:40", "F"], // FNRI F257
    ["Longganisa, chicken (uncooked)", "chicken longganisa|longganisang manok|chicken longanisa", CH, 185, 10.7, 11.3, 10.8, 1.4, "pc:40", "F"], // FNRI F223
    ["Tocino, pork (uncooked)", "raw tocino|uncooked tocino|tocino uncooked|tocino raw", PK, 206, 11.2, 25.9, 6.4, 0, "serving:80", "F"], // FNRI F245
    ["Tofu, soft", "soft tofu|silken tofu|tahu", EG, 89, 8.1, 2, 5.4, 0.4, "cup:250", "F"], // FNRI C063
    ["Sorbetes (street ice cream)", "sorbetes|dirty ice cream|street ice cream", DS, 157, 4.2, 13.7, 9.5, 0.5, "scoop:60,cup:132", "F"], // FNRI J008
    ["Kornik (fried corn)", "kornik|cornick|boy bawang|fried corn snack", SN, 483, 8.5, 63.2, 21.8, 2.1, "pack:30,handful:28", "F"], // FNRI A108
    ["Kakang gata (fresh coconut milk)", "kakang gata|fresh gata|fresh coconut milk|kinayod gata", CO, 343, 5.5, 1.9, 34.8, 2.1, "cup:240,tbsp:15", "F"], // FNRI K002
    ["Tomato sauce", "tomato sauce|tomato sauce pouch|del monte tomato sauce", CO, 45, 0.9, 10, 0.2, 2.1, "cup:245,tbsp:15", "F"], // FNRI N025
    ["Siling labuyo (chili)", "siling labuyo|sili|chili|bird eye chili|labuyo|chili pepper", VG, 75, 4.8, 9, 2.2, 3.5, "pc:2,tbsp:6", "F"], // FNRI D164
    ["Sriracha", "sriracha|sriracha sauce|hot chili sauce", CO, 93, 1.9, 19.2, 0.9, 2.2, "tsp:6,tbsp:17", "U"], // USDA FDC 171186
    ["Hoisin sauce", "hoisin|hoisin sauce", CO, 220, 3.3, 44.1, 3.4, 2.8, "tbsp:16,tsp:5", "U"], // USDA FDC 172886
    ["Barbecue sauce", "barbecue sauce|bbq sauce", CO, 172, 0.8, 40.8, 0.6, 0.9, "tbsp:17,tsp:6", "U"], // USDA FDC 174523
    ["Mustard, yellow", "mustard|yellow mustard|prepared mustard", CO, 60, 3.7, 5.8, 3.3, 4, "tsp:5,tbsp:15", "U"], // USDA FDC 172234
    ["Worcestershire sauce", "worcestershire|worcestershire sauce|lea and perrins", CO, 77, 0, 19.2, 0, 0, "tbsp:17,tsp:6", "U"], // USDA FDC 171610
    ["Cornstarch", "cornstarch|corn starch|cornflour|gawgaw", CO, 381, 0.3, 91.3, 0.1, 0.9, "tbsp:8,tsp:2.7", "U"], // USDA FDC 169698
    ["Tomato paste", "tomato paste", CO, 82, 4.3, 18.9, 0.5, 4.1, "tbsp:16,tsp:5", "U"], // USDA SR Legacy
    ["Ginger, raw (luya)", "ginger|luya|fresh ginger", VG, 80, 1.8, 17.8, 0.8, 2, "tbsp:6,tsp:2", "U"], // USDA SR Legacy
    ["Lemon juice", "lemon juice|lemon|lime juice", CO, 22, 0.4, 6.9, 0.2, 0.3, "tbsp:15,tsp:5", "U"], // USDA SR Legacy
    ["Sesame seeds", "sesame seeds|sesame|linga", NT, 573, 17.7, 23.4, 49.7, 11.8, "tbsp:9,tsp:3", "U"], // USDA SR Legacy
    ["Black pepper", "black pepper|pepper|paminta|ground pepper", CO, 251, 10.4, 64, 3.3, 25.3, "tsp:2.3,tbsp:7", "U"], // USDA SR Legacy
    ["Salt", "salt|asin|rock salt|sea salt", CO, 0, 0, 0, 0, 0, "tsp:6,tbsp:18", "U"], // USDA SR Legacy
  ];
})();

window.MID_COMBOS = [
  ['Tapsilog', 'tapsilog|tapa silog|tapsi', [['Beef tapa (cooked)', 100], ['Garlic fried rice (sinangag)', 170], ['Egg, fried', 46]]],
  ['Tocilog', 'tocilog|tosilog|tocino silog', [['Tocino (cooked)', 80], ['Garlic fried rice (sinangag)', 170], ['Egg, fried', 46]]],
  ['Longsilog', 'longsilog|longganisa silog|longsi', [['Longganisa, sweet (cooked)', 105], ['Garlic fried rice (sinangag)', 170], ['Egg, fried', 46]]],
  ['Hotsilog', 'hotsilog|hotdog silog', [['Hotdog (Filipino red)', 90], ['Garlic fried rice (sinangag)', 170], ['Egg, fried', 46]]],
  ['Cornsilog', 'cornsilog|corned beef silog|cornbeef silog', [['Corned beef (canned)', 100], ['Garlic fried rice (sinangag)', 170], ['Egg, fried', 46]]],
  ['Bangsilog', 'bangsilog|bangus silog|bangsi', [['Daing na bangus (fried)', 150], ['Garlic fried rice (sinangag)', 170], ['Egg, fried', 46]]],
  ['Chicksilog', 'chicksilog|chicken silog|chixsilog', [['Fried chicken, breaded', 130], ['Garlic fried rice (sinangag)', 170], ['Egg, fried', 46]]],
  ['Spamsilog', 'spamsilog|spam silog|luncheon silog', [['Luncheon meat (Spam type)', 112], ['Garlic fried rice (sinangag)', 170], ['Egg, fried', 46]]],
  ['Porksilog', 'porksilog|pork chop silog|porkchop silog', [['Fried pork chop (Filipino style)', 100], ['Garlic fried rice (sinangag)', 170], ['Egg, fried', 46]]],
  ['Sisilog', 'sisilog|sisig silog', [['Sisig (pork)', 150], ['Garlic fried rice (sinangag)', 170], ['Egg, fried', 46]]],
  ['Liemposilog', 'liemposilog|liempo silog', [['Pork belly, grilled (liempo)', 120], ['Garlic fried rice (sinangag)', 170], ['Egg, fried', 46]]],
];
