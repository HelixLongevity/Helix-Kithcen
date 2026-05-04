const EDAMAM_API_BASE = 'https://api.edamam.com/api/nutrition-details';

// Format a recipe ingredient object into the string Edamam expects
// e.g. { amount: "500", unit: "g", name: "chicken breast" } → "500 g chicken breast"
function formatIngredient(ing) {
  const amount = String(ing.amount || '').trim();
  // Strip parenthetical mL/g equivalents from units like "tbsp (30mL)" → "tbsp"
  const unit = String(ing.unit || '').replace(/\s*\([^)]*\)/, '').trim();
  const name = String(ing.name || '').trim();
  return [amount, unit, name].filter(Boolean).join(' ').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const appId = process.env.EDAMAM_APP_ID;
  const appKey = process.env.EDAMAM_APP_KEY;

  if (!appId || !appKey) {
    return res.status(500).json({ error: 'Edamam API credentials not configured' });
  }

  const { ingredients, servings = 4, mode, ingredientName } = req.body;

  // ─── Single-ingredient lookup mode ───────────────────────────────────────────
  // Used by the ingredient swap preview to show per-100g nutrition for one item.
  if (mode === 'single') {
    if (!ingredientName || !String(ingredientName).trim()) {
      return res.status(400).json({ error: 'ingredientName is required for single mode' });
    }
    const cleaned = String(ingredientName).trim();
    try {
      const url = `${EDAMAM_API_BASE}?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: cleaned, ingr: [cleaned], yield: 1 }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (!response.ok) {
        console.log(`[EDAMAM-SINGLE] ❌ API error ${response.status} for "${cleaned}"`);
        return res.status(200).json({ found: false, name: cleaned });
      }

      const data = await response.json();
      const n = data.totalNutrients || {};
      const totalCal = data.calories || 0;
      const totalWeight = data.totalWeight || 100;
      const scale = 100 / totalWeight; // convert totals → per 100g

      console.log(`[EDAMAM-SINGLE] ✅ "${cleaned}" → ${totalCal} kcal / ${totalWeight}g total`);
      return res.status(200).json({
        found: true,
        name: cleaned,
        usda_match: cleaned,
        usda_per_100g: {
          calories: Math.round(totalCal * scale),
          protein: Math.round((n.PROCNT?.quantity || 0) * scale * 10) / 10,
          fat: Math.round((n.FAT?.quantity || 0) * scale * 10) / 10,
          carbs: Math.round((n.CHOCDF?.quantity || 0) * scale * 10) / 10,
          fibre: Math.round((n.FIBTG?.quantity || 0) * scale * 10) / 10,
        },
      });
    } catch (err) {
      console.error(`[EDAMAM-SINGLE] Error for "${cleaned}":`, err.message);
      return res.status(200).json({ found: false, name: cleaned });
    }
  }

  // ─── Full recipe nutrition lookup ─────────────────────────────────────────────
  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
    return res.status(400).json({ error: 'ingredients array is required' });
  }

  const numServings = Math.max(1, parseInt(servings) || 4);

  // Filter and format ingredients into Edamam strings
  const ingrStrings = ingredients
    .filter(ing => ing.name && String(ing.name).trim())
    .map(formatIngredient)
    .filter(Boolean);

  if (ingrStrings.length === 0) {
    return res.status(400).json({ error: 'No valid ingredients found' });
  }

  console.log(`[EDAMAM] Analysing ${ingrStrings.length} ingredients for ${numServings} serving(s)`);
  console.log(`[EDAMAM] Ingredients: ${JSON.stringify(ingrStrings)}`);

  try {
    const url = `${EDAMAM_API_BASE}?app_id=${encodeURIComponent(appId)}&app_key=${encodeURIComponent(appKey)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Recipe',
        ingr: ingrStrings,
        yield: numServings,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[EDAMAM] API error ${response.status}:`, errText);
      return res.status(200).json({
        fallback: true,
        error: `Edamam API error: ${response.status}`,
        nutrition_per_serving: null,
        servings: numServings,
        ingredients_matched: 0,
        ingredients_total: ingrStrings.length,
        not_found: [],
        details: [],
      });
    }

    const data = await response.json();
    const n = data.totalNutrients || {};
    const totalCalories = data.calories || 0;

    // Edamam returns totals for the whole recipe — divide by servings for per-serving values
    const perServing = {
      calories:         Math.round(totalCalories / numServings),
      protein_g:        Math.round((n.PROCNT?.quantity || 0) / numServings * 10) / 10,
      total_fat_g:      Math.round((n.FAT?.quantity   || 0) / numServings * 10) / 10,
      saturated_fat_g:  Math.round((n.FASAT?.quantity || 0) / numServings * 10) / 10,
      carbohydrates_g:  Math.round((n.CHOCDF?.quantity || 0) / numServings * 10) / 10,
      fibre_g:          Math.round((n.FIBTG?.quantity  || 0) / numServings * 10) / 10,
      sugar_g:          Math.round((n.SUGAR?.quantity  || 0) / numServings * 10) / 10,
      sodium_mg:        Math.round((n.NA?.quantity     || 0) / numServings),
    };

    // Edamam returns a parsed ingredients array — use it to detect any not-found items
    const parsedIngredients = data.ingredients || [];
    const notFound = parsedIngredients
      .filter(i => i.parsed?.some(p => p.status === 'MISSING'))
      .map(i => i.text);

    const matched = ingrStrings.length - notFound.length;

    console.log(`[EDAMAM] ✅ Recipe analysed: ${totalCalories} kcal total → ${perServing.calories} kcal/serving`);
    console.log(`[EDAMAM]   protein=${perServing.protein_g}g fat=${perServing.total_fat_g}g carbs=${perServing.carbohydrates_g}g fibre=${perServing.fibre_g}g sodium=${perServing.sodium_mg}mg`);
    if (notFound.length > 0) {
      console.log(`[EDAMAM]   ⚠️ Not found: ${notFound.join(', ')}`);
    }

    return res.status(200).json({
      nutrition_per_serving: perServing,
      servings: numServings,
      ingredients_matched: matched,
      ingredients_total: ingrStrings.length,
      not_found: notFound,
      source: 'edamam',
      details: parsedIngredients.map(i => ({
        name: i.text,
        found: !i.parsed?.some(p => p.status === 'MISSING'),
        matchedFood: i.parsed?.[0]?.food || null,
        searchTerm: i.text,
        grams: Math.round(i.parsed?.[0]?.weight || 0) || null,
        nutrients: null, // Edamam only returns recipe-level totals, not per-ingredient breakdown
      })),
    });

  } catch (err) {
    console.error(`[EDAMAM] Fatal error:`, err.message);
    return res.status(200).json({
      fallback: true,
      error: err.message,
      nutrition_per_serving: null,
      servings: numServings,
      ingredients_matched: 0,
      ingredients_total: ingrStrings.length,
      not_found: [],
      details: [],
    });
  }
}
