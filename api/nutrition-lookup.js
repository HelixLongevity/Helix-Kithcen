const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1/foods/search';

// Nutrient IDs we care about
const NUTRIENT_IDS = {
  1008: 'calories',
  1003: 'protein_g',
  1004: 'total_fat_g',
  1258: 'saturated_fat_g',
  1005: 'carbohydrates_g',
  1079: 'fibre_g',
  2000: 'sugar_g',
  1093: 'sodium_mg',
};

// Ingredient-specific volume-to-gram conversions
const INGREDIENT_VOLUME_GRAMS = {
  butter: { tbsp: 14, tablespoon: 14, cup: 227 },
  'olive oil': { tbsp: 13.5, tablespoon: 13.5, cup: 216, tsp: 4.5, teaspoon: 4.5 },
  'vegetable oil': { tbsp: 13.5, tablespoon: 13.5, cup: 216, tsp: 4.5, teaspoon: 4.5 },
  'coconut oil': { tbsp: 13.5, tablespoon: 13.5, cup: 216, tsp: 4.5, teaspoon: 4.5 },
  'sesame oil': { tbsp: 13.5, tablespoon: 13.5, cup: 216, tsp: 4.5, teaspoon: 4.5 },
  oil: { tbsp: 13.5, tablespoon: 13.5, cup: 216, tsp: 4.5, teaspoon: 4.5 },
  rice: { cup: 185 },
  flour: { cup: 125 },
  sugar: { cup: 200, tbsp: 12.5, tablespoon: 12.5, tsp: 4.2, teaspoon: 4.2 },
  salt: { tsp: 6, teaspoon: 6, tbsp: 18, tablespoon: 18 },
  pepper: { tsp: 2.3, teaspoon: 2.3, tbsp: 6.9, tablespoon: 6.9 },
  'black pepper': { tsp: 2.3, teaspoon: 2.3, tbsp: 6.9, tablespoon: 6.9 },
  honey: { tbsp: 21, tablespoon: 21, cup: 340, tsp: 7, teaspoon: 7 },
  'soy sauce': { tbsp: 18, tablespoon: 18, tsp: 6, teaspoon: 6 },
  'fish sauce': { tbsp: 18, tablespoon: 18, tsp: 6, teaspoon: 6 },
  vinegar: { tbsp: 15, tablespoon: 15, cup: 240, tsp: 5, teaspoon: 5 },
  milk: { cup: 244, tbsp: 15, tablespoon: 15 },
  cream: { cup: 240, tbsp: 15, tablespoon: 15 },
};

// Default volume-to-gram conversions (water-based approximation)
const VOLUME_TO_GRAMS = {
  cup: 240,
  cups: 240,
  tbsp: 15,
  tsp: 5,
  tablespoon: 15,
  tablespoons: 15,
  teaspoon: 5,
  teaspoons: 5,
  ml: 1,
  mL: 1,
  l: 1000,
  L: 1000,
  litre: 1000,
  litres: 1000,
  liter: 1000,
  liters: 1000,
  'fl oz': 30,
  floz: 30,
};

// Whole-item weights with size variants
const WHOLE_ITEM_GRAMS = {
  onion:            { small: 100, medium: 150, large: 200 },
  'red onion':      { small: 100, medium: 150, large: 200 },
  'brown onion':    { small: 100, medium: 150, large: 200 },
  'white onion':    { small: 100, medium: 150, large: 200 },
  'yellow onion':   { small: 100, medium: 150, large: 200 },
  potato:           { small: 130, medium: 180, large: 250 },
  apple:            { small: 80,  medium: 120, large: 180 },
  banana:           { small: 80,  medium: 115, large: 150 },
  garlic:           { small: 3,   medium: 3,   large: 5 },
  carrot:           { small: 50,  medium: 70,  large: 90 },
  tomato:           { small: 90,  medium: 125, large: 170 },
  lemon:            { small: 45,  medium: 60,  large: 80 },
  lime:             { small: 30,  medium: 45,  large: 60 },
  orange:           { small: 100, medium: 130, large: 170 },
  egg:              { small: 40,  medium: 50,  large: 60 },
  eggs:             { small: 40,  medium: 50,  large: 60 },
  'chicken breast': { small: 130, medium: 175, large: 230 },
  'chicken thigh':  { small: 80,  medium: 120, large: 160 },
  capsicum:         { small: 110, medium: 150, large: 190 },
  'bell pepper':    { small: 110, medium: 150, large: 190 },
  zucchini:         { small: 130, medium: 200, large: 270 },
  avocado:          { small: 100, medium: 150, large: 200 },
  cucumber:         { small: 140, medium: 200, large: 260 },
};

// Search term overrides for ingredients that get bad USDA matches
// IMPORTANT: Entries are sorted by key length descending so that more specific
// keys (e.g. 'red bell pepper') match before generic ones (e.g. 'pepper').
const SEARCH_TERM_OVERRIDES_UNSORTED = {
  'red bell pepper': 'peppers sweet red raw',
  'green bell pepper': 'peppers sweet green raw',
  'yellow bell pepper': 'peppers sweet yellow raw',
  'bell pepper': 'peppers sweet red raw',
  'bell peppers': 'peppers sweet red raw',
  'capsicum': 'peppers sweet red raw',
  'red pepper': 'peppers sweet red raw',
  'red pepper diced': 'peppers sweet red raw',
  'pepper diced': 'peppers sweet red raw',
  'chicken stock': 'soup stock chicken broth',
  'beef stock': 'soup stock beef broth',
  'vegetable stock': 'soup stock vegetable broth',
  'parmesan cheese': 'cheese parmesan hard',
  'parmesan': 'cheese parmesan hard',
  'black pepper': 'spices pepper black',
  'pepper': 'spices pepper black',
  'salt': 'salt table',
  'sea salt': 'salt table',
  'kosher salt': 'salt table',
  'butter': 'butter salted',
  'unsalted butter': 'butter unsalted',
  'olive oil': 'oil olive',
  'extra-virgin olive oil': 'oil olive',
  'chicken breast': 'chicken breast meat raw',
  'dry white wine': 'wine white table',
  'white wine': 'wine white table',
  'red wine': 'wine red table',
  'greek yoghurt': 'yogurt greek plain',
  'greek yogurt': 'yogurt greek plain',
  'yoghurt': 'yogurt plain',
  'yogurt': 'yogurt plain',
  'protein powder': 'protein supplement whey powder',
  'crushed tomatoes': 'tomatoes canned crushed',
  'tomato paste': 'tomato paste canned',
  'fresh parsley': 'parsley fresh',
  'dried oregano': 'spices oregano dried',
  'ground cumin': 'spices cumin seed ground',
  'smoked paprika': 'spices paprika',
};
// Sort by key length descending so longer/more specific keys are checked first
const SEARCH_TERM_OVERRIDES = Object.fromEntries(
  Object.entries(SEARCH_TERM_OVERRIDES_UNSORTED).sort((a, b) => b[0].length - a[0].length)
);

// Pattern-based search term overrides
const SEARCH_TERM_PATTERNS = [
  { pattern: /\brice\b/i, replacement: 'rice white raw', exclude: /\brice (wine|vinegar|noodle|paper)\b/i },
  { pattern: /\bbutter\b/i, replacement: 'butter salted', exclude: /\bpeanut butter\b/i },
  { pattern: /\bolive oil\b/i, replacement: 'oil olive' },
  { pattern: /\bchicken breast\b/i, replacement: 'chicken breast meat raw' },
];

// Ingredients that should NOT get "raw" appended
const NO_RAW_SUFFIX = new Set([
  'butter', 'oil', 'olive oil', 'vegetable oil', 'coconut oil', 'sesame oil',
  'canola oil', 'sunflower oil', 'avocado oil', 'peanut oil',
  'cheese', 'parmesan', 'parmesan cheese', 'cheddar', 'mozzarella', 'feta',
  'cream cheese', 'ricotta', 'gouda', 'brie', 'gruyere',
  'stock', 'broth', 'chicken stock', 'beef stock', 'vegetable stock',
  'chicken broth', 'beef broth', 'vegetable broth',
  'wine', 'red wine', 'white wine', 'rice wine', 'mirin',
  'salt', 'pepper', 'black pepper', 'white pepper',
  'sugar', 'brown sugar', 'caster sugar', 'icing sugar', 'powdered sugar',
  'flour', 'plain flour', 'self-raising flour', 'all-purpose flour', 'cornflour', 'cornstarch',
  'soy sauce', 'fish sauce', 'oyster sauce', 'worcestershire sauce', 'hot sauce',
  'vinegar', 'balsamic vinegar', 'red wine vinegar', 'white wine vinegar', 'apple cider vinegar',
  'honey', 'maple syrup', 'golden syrup', 'treacle',
  'milk', 'cream', 'sour cream', 'yoghurt', 'yogurt',
  'coconut milk', 'coconut cream',
  'tomato paste', 'tomato sauce', 'passata',
  'mustard', 'dijon mustard', 'wholegrain mustard',
  'mayonnaise', 'ketchup',
  'bread', 'breadcrumbs', 'panko',
  'pasta', 'spaghetti', 'penne', 'fettuccine', 'noodles',
  'cumin', 'paprika', 'turmeric', 'cinnamon', 'nutmeg', 'oregano',
  'thyme', 'rosemary', 'basil', 'parsley', 'coriander', 'cilantro',
  'bay leaf', 'bay leaves', 'chilli flakes', 'chili flakes', 'chilli powder', 'chili powder',
  'garam masala', 'curry powder', 'smoked paprika', 'cayenne',
  'baking powder', 'baking soda', 'bicarbonate of soda', 'yeast',
  'cocoa', 'cocoa powder', 'chocolate', 'dark chocolate',
  'peanut butter', 'tahini', 'sesame seeds',
  'walnuts', 'almonds', 'cashews', 'pine nuts', 'pecans',
]);

// Words to strip from ingredient names (cooking instructions/descriptors)
const STRIP_WORDS_PATTERN = new RegExp(
  '\\b(' +
  [
    'diced', 'sliced', 'chopped', 'minced', 'grated', 'shredded',
    'julienned', 'cubed', 'halved', 'quartered', 'trimmed', 'peeled',
    'deseeded', 'deveined', 'deboned', 'crushed', 'torn', 'snapped',
    'finely', 'roughly', 'thinly', 'coarsely',
    'cut', 'pieces', 'piece', 'chunks', 'chunk',
    'into', 'about',
    'woody ends', 'ends',
    'to taste', 'for garnish', 'for serving', 'as needed', 'optional',
    'bone-in', 'boneless', 'skinless', 'skin-on',
    'fresh', 'dried', 'frozen', 'canned',
    'room temperature', 'softened', 'melted', 'warm', 'cold', 'hot', 'chilled', 'cooled',
    'extra-virgin', 'virgin', 'light', 'dark',
    'unsalted', 'salted', 'plain',
  ].join('|') +
  ')\\b',
  'gi'
);

// Strip cooking instructions and qualifiers from ingredient names
function cleanIngredientName(name) {
  let cleaned = name
    // Remove parenthetical notes like "(about 2 cups)" or "(30mL)"
    .replace(/\([^)]*\)/g, '')
    // Remove measurement phrases like "2cm pieces", "3cm lengths"
    .replace(/\d+\s*(cm|mm|inch|inches|in)\s*(pieces?|lengths?|chunks?|strips?|cubes?|thick|thin)?/gi, '')
    // Remove cooking instructions/descriptors
    .replace(STRIP_WORDS_PATTERN, '')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    // Remove leading/trailing commas, spaces, hyphens
    .replace(/^[\s,\-]+|[\s,\-]+$/g, '')
    .trim();

  return cleaned;
}

// Determine if "raw" should be appended to the search term
function shouldAppendRaw(cleanedName) {
  const lower = cleanedName.toLowerCase();
  // Check exact match and partial matches against the no-raw set
  if (NO_RAW_SUFFIX.has(lower)) return false;
  // Check if any no-raw term is contained in the name
  for (const term of NO_RAW_SUFFIX) {
    if (lower === term) return false;
  }
  // Check broad categories
  if (/\b(oil|sauce|stock|broth|wine|vinegar|sugar|flour|spice|herb|powder|paste|syrup|mustard|seeds?)\b/i.test(lower)) {
    return false;
  }
  return true;
}

// Build the search term for USDA
function buildSearchTerm(ingredientName) {
  const cleaned = cleanIngredientName(ingredientName);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();

  // Special case: any ingredient with both "bell" and "pepper" is a bell pepper, not black pepper
  if (lower.includes('bell') && lower.includes('pepper')) {
    const color = lower.includes('green') ? 'green' : lower.includes('yellow') ? 'yellow' : 'red';
    const term = `peppers sweet ${color} raw`;
    console.log(`[OVERRIDE-DEBUG] ✅ Bell pepper catch-all: "${lower}" → "${term}"`);
    return term;
  }

  // Check if the cleaned ingredient name contains any override key
  // (keys are sorted longest-first so specific overrides match before generic ones)
  for (const [key, value] of Object.entries(SEARCH_TERM_OVERRIDES)) {
    if (lower.includes(key)) {
      return value;
    }
  }

  // Check pattern-based overrides
  for (const { pattern, replacement, exclude } of SEARCH_TERM_PATTERNS) {
    if (exclude && exclude.test(lower)) continue;
    if (pattern.test(lower)) return replacement;
  }

  if (shouldAppendRaw(cleaned)) {
    return cleaned + ' raw';
  }
  return cleaned;
}

// Parse amount string to a number (handles fractions like "1½" or "1/2")
function parseAmount(amountStr) {
  if (!amountStr) return 0;
  let str = String(amountStr).trim();

  // Unicode fraction characters
  const fractionMap = { '½': 0.5, '⅓': 1/3, '⅔': 2/3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 1/6, '⅚': 5/6, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };

  let total = 0;
  for (const [char, val] of Object.entries(fractionMap)) {
    if (str.includes(char)) {
      str = str.replace(char, '');
      total += val;
    }
  }

  // Handle "1/2" style fractions
  const fractionMatch = str.match(/(\d+)\s*\/\s*(\d+)/);
  if (fractionMatch) {
    total += parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
    str = str.replace(fractionMatch[0], '');
  }

  // Remaining whole number
  const wholeMatch = str.match(/(\d+(\.\d+)?)/);
  if (wholeMatch) {
    total += parseFloat(wholeMatch[1]);
  }

  return total;
}

// Convert an ingredient's amount + unit to grams
function toGrams(amount, unit, ingredientName) {
  if (!amount) return 100; // default assumption if no amount given

  const numAmount = parseAmount(amount);
  if (!unit) return numAmount; // assume grams if no unit

  const unitLower = unit.toLowerCase()
    // Strip parenthetical mL equivalents like "tbsp (15mL)"
    .replace(/\s*\([^)]*\)/, '')
    .trim();

  // Already in grams/g
  if (unitLower === 'g' || unitLower === 'grams' || unitLower === 'gram') {
    return numAmount;
  }
  if (unitLower === 'kg' || unitLower === 'kilogram' || unitLower === 'kilograms') {
    return numAmount * 1000;
  }
  // Imperial weight
  if (unitLower === 'oz' || unitLower === 'ounce' || unitLower === 'ounces') {
    return numAmount * 28.35;
  }
  if (unitLower === 'lb' || unitLower === 'lbs' || unitLower === 'pound' || unitLower === 'pounds') {
    return numAmount * 453.6;
  }

  // Check ingredient-specific volume conversions first
  if (ingredientName) {
    const ingLower = cleanIngredientName(ingredientName).toLowerCase();
    // Try exact match, then check if ingredient name contains any key
    for (const [ingKey, conversions] of Object.entries(INGREDIENT_VOLUME_GRAMS)) {
      if (ingLower === ingKey || ingLower.includes(ingKey)) {
        const singular = unitLower.replace(/s$/, '');
        const g = conversions[unitLower] || conversions[singular];
        if (g) return numAmount * g;
      }
    }
  }

  // Volume conversions (default/water-based)
  const singular = unitLower.replace(/s$/, '');
  const volumeGrams = VOLUME_TO_GRAMS[unitLower] || VOLUME_TO_GRAMS[singular];
  if (volumeGrams) {
    return numAmount * volumeGrams;
  }

  // Whole items (medium, large, small, or just a count)
  if (['medium', 'large', 'small', 'whole', 'head'].includes(unitLower) || !unit) {
    if (ingredientName) {
      const ingLower = cleanIngredientName(ingredientName).toLowerCase();
      for (const [itemKey, weights] of Object.entries(WHOLE_ITEM_GRAMS)) {
        if (ingLower === itemKey || ingLower.includes(itemKey)) {
          const size = ['small', 'medium', 'large'].includes(unitLower) ? unitLower : 'medium';
          return numAmount * weights[size];
        }
      }
    }
  }

  // "piece", "clove", "sprig", "pinch" etc
  if (['pinch', 'pinches'].includes(unitLower)) return numAmount * 0.5;
  if (['clove', 'cloves'].includes(unitLower)) return numAmount * 3;
  if (['sprig', 'sprigs'].includes(unitLower)) return numAmount * 2;
  if (['bunch', 'bunches'].includes(unitLower)) return numAmount * 30;
  if (['piece', 'pieces', 'slice', 'slices'].includes(unitLower)) return numAmount * 30;

  // Fallback: assume the number is grams
  return numAmount;
}

// Score a USDA result for relevance to the search term
function scoreResult(food, searchTerm, originalIngredient) {
  const desc = (food.description || '').toLowerCase();
  const search = searchTerm.toLowerCase();
  const searchWords = search.replace(/\braw\b/, '').replace(/\btable\b/, '').trim().split(/\s+/).filter(Boolean);
  const ingLower = (originalIngredient || '').toLowerCase();

  let score = 0;

  // Prefer Foundation and SR Legacy data types
  if (food.dataType === 'Foundation') score += 20;
  if (food.dataType === 'SR Legacy') score += 15;
  if (food.dataType === 'Branded') score -= 30;
  if (food.dataType === 'Survey (FNDDS)') score -= 10;

  // Reward raw/uncooked
  if (/\braw\b/i.test(desc)) score += 10;
  if (/\b(cooked|baked|fried|roasted|grilled|boiled|steamed|sauteed|braised|breaded)\b/i.test(desc)) score -= 5;

  // Reward matching all search words
  let matchedWords = 0;
  for (const word of searchWords) {
    if (desc.includes(word)) matchedWords++;
  }
  score += (matchedWords / searchWords.length) * 15;

  // Bonus if description starts with first search word
  if (searchWords.length > 0 && desc.startsWith(searchWords[0])) score += 10;

  // Reward shorter descriptions (more generic)
  if (desc.length < 50) score += 5;
  else if (desc.length > 100) score -= 3;

  if (/\b(brand|upc|gtin)\b/i.test(desc)) score -= 10;

  // REJECTION RULES: penalise results that clearly don't match
  if (ingLower.match(/^(salt|sea salt|kosher salt)$/) && /\b(butter|salted)\b/i.test(desc) && !/\bsalt\b/i.test(desc)) score -= 50;
  if (/\brice\b/i.test(ingLower) && /\b(crackers?|cake|pudding|cereal|noodle|flour)\b/i.test(desc)) score -= 50;
  if (/\bolive oil\b/i.test(ingLower) && /\b(corn|peanut|canola|soybean)\b/i.test(desc)) score -= 50;
  if (ingLower.match(/^butter$/) && /\b(ghee|clarified)\b/i.test(desc)) score -= 50;
  if (/\bchicken breast\b/i.test(ingLower) && /\b(breaded|nugget|patty|strip|tender|frozen|processed)\b/i.test(desc)) score -= 50;
  if (/\b(dry white wine|white wine)\b/i.test(ingLower) && /\bdessert\b/i.test(desc)) score -= 50;

  return score;
}

// Fetch with a timeout — rejects if the request takes longer than `ms` milliseconds
function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Search USDA for a single ingredient and return nutrients per 100g
async function searchUSDA(ingredientName, apiKey) {
  const searchTerm = buildSearchTerm(ingredientName);
  if (!searchTerm) return null;

  // Request more results so we can pick the best match
  const url = `${USDA_API_BASE}?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(searchTerm)}&pageSize=10&dataType=Foundation,SR%20Legacy`;

  const response = await fetchWithTimeout(url, 5000);
  if (!response.ok) return null;

  const data = await response.json();
  if (!data.foods || data.foods.length === 0) return null;

  // Score and sort results, rejecting bad matches
  const scored = data.foods.map(food => ({
    food,
    score: scoreResult(food, searchTerm, ingredientName),
  }));
  scored.sort((a, b) => b.score - a.score);

  // Reject if best match still has a very low score
  if (scored[0].score < -20) return null;

  const best = scored[0].food;
  const nutrients = {};
  const energyFallbacks = {};

  // Log ALL nutrient IDs returned by USDA for debugging
  const allNutrientIds = (best.foodNutrients || []).map(n => ({
    id: n.nutrientId,
    number: n.nutrientNumber,
    name: n.nutrientName,
    unit: n.unitName,
    value: n.value,
  }));
  const energyRelated = allNutrientIds.filter(n =>
    n.id === 1008 || n.id === 2047 || n.id === 2048 || n.id === 1062 ||
    (n.name && n.name.toLowerCase().includes('energy'))
  );
  console.log(`[NUTRITION] 🔍 "${best.description}" — energy-related nutrients: ${JSON.stringify(energyRelated)}`);

  for (const nutrient of best.foodNutrients || []) {
    const key = NUTRIENT_IDS[nutrient.nutrientId];
    if (key) {
      nutrients[key] = nutrient.value || 0;
    }
    // Track alternate energy nutrient IDs as fallbacks
    if (nutrient.nutrientId === 2048 || nutrient.nutrientId === 2047) {
      energyFallbacks[nutrient.nutrientId] = nutrient.value || 0;
    }
  }

  // Some USDA Foundation entries store total fat under 1085 (Total fat NLEA) instead of 1004
  if (!nutrients.total_fat_g) {
    for (const nutrient of best.foodNutrients || []) {
      if (nutrient.nutrientId === 1085 && nutrient.value) {
        nutrients.total_fat_g = nutrient.value;
        console.log(`[NUTRITION] ⚠️ total_fat_g missing from 1004 — using nutrient 1085 (Total fat NLEA): ${nutrient.value}g`);
        break;
      }
    }
  }

  // Similarly, check alternate protein IDs (1003 is standard, 1299 is an alternate)
  if (!nutrients.protein_g) {
    for (const nutrient of best.foodNutrients || []) {
      if (nutrient.nutrientId === 1299 && nutrient.value) {
        nutrients.protein_g = nutrient.value;
        console.log(`[NUTRITION] ⚠️ protein_g missing from 1003 — using nutrient 1299: ${nutrient.value}g`);
        break;
      }
    }
  }

  // If calories (nutrient 1008) is missing or zero, fall back to Atwater energy IDs
  if (!nutrients.calories) {
    const fallbackValue = energyFallbacks[2048] || energyFallbacks[2047] || 0;
    if (fallbackValue) {
      console.log(`[NUTRITION] ⚠️ Nutrient 1008 missing/zero for "${best.description}" — using fallback energy ID (2048/2047): ${fallbackValue} kcal/100g`);
      nutrients.calories = fallbackValue;
    } else {
      // Last resort: calculate from macros
      const macroCalories = (nutrients.protein_g || 0) * 4 + (nutrients.total_fat_g || 0) * 9 + (nutrients.carbohydrates_g || 0) * 4;
      if (macroCalories > 0) {
        console.log(`[NUTRITION] ⚠️ No energy nutrient found for "${best.description}" — using macro-derived estimate: ${macroCalories.toFixed(0)} kcal/100g`);
        nutrients.calories = Math.round(macroCalories);
      } else {
        console.log(`[NUTRITION] ❌ No energy nutrient and no macros for "${best.description}" — IDs checked: 1008, 2048, 2047`);
      }
    }
  }

  // Cross-validate: compare USDA calories to macro-derived estimate
  const macroCalories = (nutrients.protein_g || 0) * 4 + (nutrients.total_fat_g || 0) * 9 + (nutrients.carbohydrates_g || 0) * 4;
  if (nutrients.calories && macroCalories > 0 && Math.abs(nutrients.calories - macroCalories) > macroCalories * 0.3) {
    console.log(`[NUTRITION] ⚠️ Calorie vs macro mismatch for "${best.description}": USDA cal=${nutrients.calories}, macro-derived=${macroCalories.toFixed(0)} (protein*4 + fat*9 + carbs*4)`);
  }

  return {
    fdcId: best.fdcId,
    description: best.description,
    dataType: best.dataType,
    searchTerm,
    nutrientsPer100g: nutrients,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'USDA API key not configured' });
  }

  const { ingredients, servings = 4, mode, ingredientName } = req.body;

  // Single-ingredient lookup mode: returns USDA per-100g data for one ingredient
  if (mode === 'single') {
    if (!ingredientName || !String(ingredientName).trim()) {
      return res.status(400).json({ error: 'ingredientName is required for single mode' });
    }
    try {
      const cleaned = ingredientName.trim();
      const searchTerm = buildSearchTerm(cleaned);
      console.log(`[NUTRITION-SINGLE] Input: "${cleaned}" → Search term: "${searchTerm}"`);
      const result = await searchUSDA(cleaned, apiKey);
      if (!result || !result.nutrientsPer100g) {
        console.log(`[NUTRITION-SINGLE] ❌ No USDA match for "${cleaned}"`);
        return res.status(200).json({ found: false, name: cleaned });
      }
      const per100 = result.nutrientsPer100g;
      console.log(`[NUTRITION-SINGLE] ✅ "${cleaned}" → USDA match: "${result.description}" (FDC#${result.fdcId})`);
      console.log(`[NUTRITION-SINGLE]   Per 100g: cal=${per100.calories || 0} pro=${per100.protein_g || 0}g fat=${per100.total_fat_g || 0}g carbs=${per100.carbohydrates_g || 0}g fibre=${per100.fibre_g || 0}g`);
      return res.status(200).json({
        found: true,
        name: cleaned,
        usda_match: result.description,
        usda_per_100g: {
          calories: per100.calories || 0,
          protein: per100.protein_g || 0,
          fat: per100.total_fat_g || 0,
          carbs: per100.carbohydrates_g || 0,
          fibre: per100.fibre_g || 0,
        },
      });
    } catch (err) {
      console.error(`[NUTRITION-SINGLE] Error for "${ingredientName}":`, err.message);
      return res.status(200).json({ found: false, name: ingredientName.trim() });
    }
  }

  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ error: 'ingredients array is required' });
  }

  const numServings = Math.max(1, parseInt(servings) || 4);

  // Filter out empty names and deduplicate by cleaned name
  const seen = new Set();
  const validIngredients = [];
  for (const ing of ingredients) {
    if (!ing.name || !String(ing.name).trim()) continue;
    const key = cleanIngredientName(String(ing.name).trim()).toLowerCase();
    if (seen.has(key)) {
      console.log(`[NUTRITION] ⚠️  Skipping duplicate: "${ing.name}"`);
      continue;
    }
    seen.add(key);
    validIngredients.push(ing);
  }

  try {
    // 10-second overall timeout for the entire nutrition calculation
    const overallTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Overall nutrition lookup timed out after 10s')), 10000)
    );

    const nutritionCalc = (async () => {
      // Look up all ingredients in parallel (each call has its own 5s timeout)
      const results = await Promise.all(
        validIngredients.map(async (ing) => {
          try {
            const usdaResult = await searchUSDA(ing.name, apiKey);
            if (!usdaResult || !usdaResult.nutrientsPer100g) {
              console.log(`[NUTRITION] ❌ ${ing.name} → no USDA match found`);
              return { name: ing.name, found: false };
            }

            const grams = toGrams(ing.amount, ing.unit, ing.name);
            const scale = grams / 100;

            const scaled = {};
            for (const [key, valuePer100g] of Object.entries(usdaResult.nutrientsPer100g)) {
              scaled[key] = valuePer100g * scale;
            }

            console.log(`[NUTRITION] ✅ ${ing.name}`);
            console.log(`  Search term: "${usdaResult.searchTerm}"`);
            console.log(`  USDA match:  "${usdaResult.description}" (${usdaResult.dataType}, FDC#${usdaResult.fdcId})`);
            console.log(`  Calories per 100g from USDA: ${usdaResult.nutrientsPer100g.calories ?? 'MISSING'} kcal`);
            console.log(`  All nutrients per 100g: ${JSON.stringify(usdaResult.nutrientsPer100g)}`);
            console.log(`  Quantity:    ${ing.amount || '?'} ${ing.unit || 'g'} → ${Math.round(grams)}g (scale: ${scale.toFixed(2)})`);
            console.log(`  Calculated calories for this ingredient: ${usdaResult.nutrientsPer100g.calories ?? 0} × ${scale.toFixed(2)} = ${scaled.calories?.toFixed(1) || 0} kcal`);
            console.log(`  Contribution: cal=${scaled.calories?.toFixed(1) || 0} pro=${scaled.protein_g?.toFixed(1) || 0}g fat=${scaled.total_fat_g?.toFixed(1) || 0}g carb=${scaled.carbohydrates_g?.toFixed(1) || 0}g`);

            return {
              name: ing.name,
              found: true,
              matchedFood: usdaResult.description,
              searchTerm: usdaResult.searchTerm,
              grams: Math.round(grams),
              nutrients: scaled,
            };
          } catch (err) {
            console.log(`[NUTRITION] ❌ ${ing.name} → error: ${err.message}`);
            return { name: ing.name, found: false };
          }
        })
      );

      // Sum nutrients across all found ingredients (whole recipe total)
      const totals = {
        calories: 0,
        protein_g: 0,
        total_fat_g: 0,
        saturated_fat_g: 0,
        carbohydrates_g: 0,
        fibre_g: 0,
        sugar_g: 0,
        sodium_mg: 0,
      };

      for (const r of results) {
        if (r.found && r.nutrients) {
          for (const key of Object.keys(totals)) {
            totals[key] += r.nutrients[key] || 0;
          }
        }
      }

      // Cross-check: expected calories from macro totals
      const expectedTotalCal = (totals.protein_g * 4) + (totals.total_fat_g * 9) + (totals.carbohydrates_g * 4);
      console.log(`[NUTRITION] === RECIPE TOTALS (before dividing by servings) ===`);
      console.log(`[NUTRITION]   Calories: ${totals.calories.toFixed(1)} kcal`);
      console.log(`[NUTRITION]   Protein:  ${totals.protein_g.toFixed(1)}g | Fat: ${totals.total_fat_g.toFixed(1)}g | Carbs: ${totals.carbohydrates_g.toFixed(1)}g`);
      console.log(`[NUTRITION]   Expected calories from macros (P×4 + F×9 + C×4): ${expectedTotalCal.toFixed(0)} kcal`);
      if (Math.abs(totals.calories - expectedTotalCal) > expectedTotalCal * 0.25) {
        console.log(`[NUTRITION]   ⚠️ MISMATCH: USDA total calories (${totals.calories.toFixed(0)}) vs macro-derived (${expectedTotalCal.toFixed(0)}) differ by ${Math.abs(totals.calories - expectedTotalCal).toFixed(0)} kcal`);
      }
      console.log(`[NUTRITION] Dividing by ${numServings} servings`);

      // Per serving — round to 1 decimal for precision
      const perServing = {};
      for (const [key, val] of Object.entries(totals)) {
        perServing[key] = Math.round((val / numServings) * 10) / 10;
      }

      console.log(`[NUTRITION] === PER SERVING (after dividing by ${numServings}) ===`);
      console.log(`[NUTRITION]   ${JSON.stringify(perServing)}`);

      const notFound = results.filter(r => !r.found).map(r => r.name);

      return {
        nutrition_per_serving: perServing,
        servings: numServings,
        ingredients_matched: results.filter(r => r.found).length,
        ingredients_total: results.length,
        not_found: notFound,
        details: results.map(r => ({
          name: r.name,
          found: r.found,
          matchedFood: r.matchedFood || null,
          searchTerm: r.searchTerm || null,
          grams: r.grams || null,
          nutrients: r.found && r.nutrients ? {
            calories: Math.round((r.nutrients.calories || 0) * 10) / 10,
            protein_g: Math.round((r.nutrients.protein_g || 0) * 10) / 10,
            total_fat_g: Math.round((r.nutrients.total_fat_g || 0) * 10) / 10,
            carbohydrates_g: Math.round((r.nutrients.carbohydrates_g || 0) * 10) / 10,
            fibre_g: Math.round((r.nutrients.fibre_g || 0) * 10) / 10,
          } : null,
        })),
      };
    })();

    const result = await Promise.race([nutritionCalc, overallTimeout]);
    return res.status(200).json(result);
  } catch (err) {
    console.error(`[NUTRITION] Fatal error: ${err.message}`);
    // Return a fallback-friendly response so the frontend keeps Marco's estimates
    return res.status(200).json({
      fallback: true,
      error: err.message,
      nutrition_per_serving: null,
      servings: numServings,
      ingredients_matched: 0,
      ingredients_total: ingredients.length,
      not_found: ingredients.map(i => i.name),
      details: [],
    });
  }
}
