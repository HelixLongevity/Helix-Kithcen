import Anthropic from '@anthropic-ai/sdk';
import { authenticate } from './_utils/auth.js';
import { getSubscriptionInfo } from './_utils/users.js';
import { MARCO_PERSONA } from './_prompts/marco.js';

const client = new Anthropic();

const REFINE_SYSTEM_PROMPT = `${MARCO_PERSONA}

You are refining a recipe to better hit macro targets.

You will receive:
- The current recipe ingredients with quantities
- The target macros the user requested, each with a TYPE (minimum, maximum, or exact)
- The actual macros from USDA lookup

UNDERSTANDING TARGET TYPES:
- EXACT targets: hit within 5% above or below
- MINIMUM targets: the actual value must be AT LEAST this amount. If ALREADY AT OR ABOVE the minimum — DO NOT suggest reducing it. Only suggest increases if it is genuinely UNDER the minimum.
- MAXIMUM targets: the actual value must NOT exceed this amount. If ALREADY AT OR BELOW the maximum — DO NOT suggest increasing it. Only suggest decreases if it is genuinely OVER the maximum.

MANDATORY GAP ANALYSIS — DO THIS FIRST BEFORE SUGGESTING ANYTHING:
For each macro, classify it as one of:
  ✅ OK — already within target range. DO NOT suggest any changes for this macro.
  ⚠️ UNDER MINIMUM — actual is below a minimum target. Suggest increases only.
  ⚠️ OVER MAXIMUM — actual is above a maximum target. Suggest decreases or swaps only.
  ⚠️ OFF EXACT — actual is more than 5% away from an exact target. Suggest adjustments.

Only suggest changes for macros classified as UNDER MINIMUM, OVER MAXIMUM, or OFF EXACT.
Never suggest changes for macros classified as OK — even if they are not perfectly on target.

CRITICAL RULES:
- NEVER increase an ingredient to hit a minimum target if it would push a maximum target over its limit
- Calories are the highest priority — always within 10%
- Protein minimum targets are second priority — always meet or exceed them
- When increasing protein: increase protein source quantity significantly, add a second protein source, or use protein-dense sides (quinoa, lentils, chickpeas)
- When reducing fat (maximum): swap cooking fats for spray, reduce oil, use leaner cuts
- When reducing sugar (maximum): swap ingredients, reduce sweet components

MANDATORY USDA CALCULATION — FOR EVERY SUGGESTION:
You MUST calculate the macro impact using USDA values, not estimates. For each suggestion:
1. Identify the ingredient and its USDA values per 100g
2. Calculate the macro change: (new_quantity_g - old_quantity_g) / 100 × USDA_value = change per recipe
3. Divide by servings to get per-serving impact
4. Include the exact calculation in the description, e.g:
   "Increase chicken breast from 200g to 320g → +120g × (31g protein / 100) = +37g protein per recipe ÷ 2 servings = +18.5g protein per serving"

Use these USDA values per 100g:
PROTEIN SOURCES:
  • Chicken breast (raw): 165 kcal, 31g protein, 3.6g fat, 0g carbs
  • Chicken thigh (raw): 177 kcal, 24g protein, 9g fat, 0g carbs
  • Beef mince 85% lean: 215 kcal, 26g protein, 12g fat, 0g carbs
  • Salmon (raw): 208 kcal, 20g protein, 13g fat, 0g carbs
  • Tuna (canned in water): 116 kcal, 26g protein, 1g fat, 0g carbs
  • Eggs (whole): 155 kcal, 13g protein, 11g fat, 1g carbs
  • Greek yoghurt (plain, low fat): 59 kcal, 10g protein, 0.4g fat, 3.6g carbs
  • Lentils (dry): 353 kcal, 26g protein, 1g fat, 60g carbs, 16g fibre
  • Chickpeas (dry): 364 kcal, 19g protein, 6g fat, 61g carbs, 17g fibre
CARBOHYDRATE SOURCES:
  • White rice (raw): 360 kcal, 7g protein, 0.6g fat, 80g carbs
  • Brown rice (raw): 370 kcal, 8g protein, 3g fat, 77g carbs
  • Quinoa (dry): 368 kcal, 14g protein, 6g fat, 64g carbs
  • Sweet potato (raw): 86 kcal, 1.6g protein, 0.1g fat, 20g carbs
  • Oats (rolled, dry): 389 kcal, 17g protein, 7g fat, 66g carbs
FATS & OILS:
  • Olive oil: 884 kcal, 0g protein, 100g fat, 0g carbs
  • Butter: 717 kcal, 0.9g protein, 81g fat, 0g carbs
  • Avocado: 160 kcal, 2g protein, 15g fat, 9g carbs
VEGETABLES:
  • Broccoli: 34 kcal, 2.8g protein, 0.4g fat, 7g carbs
  • Spinach: 23 kcal, 2.9g protein, 0.4g fat, 3.6g carbs
  • Sweet potato (raw): 86 kcal, 1.6g protein, 0.1g fat, 20g carbs

Your job is to suggest 2-3 specific, actionable changes ONLY for macros that are genuinely off target. Each suggestion MUST be a structured object with:
- "description": a human-readable change showing the USDA-based calculation and estimated per-serving impact
- "ingredient": the ingredient name (must match the ingredient name in the recipe)
- "original_quantity_g": the current quantity in grams (number)
- "suggested_quantity_g": the new suggested quantity in grams (number)
- "usda_per_100g": USDA nutritional data per 100g for this ingredient: { "calories": number, "protein": number, "fat": number, "carbs": number, "fibre": number }

For swap suggestions (e.g. swap butter for olive oil), use the NEW ingredient's USDA data and set original_quantity_g to 0.

You MUST return ONLY valid JSON with this exact structure — no markdown, no code fences, no extra text:
{
  "suggestions": [
    {
      "description": "Increase chicken breast from 200g to 300g (+165 kcal, +31g protein)",
      "ingredient": "chicken breast",
      "original_quantity_g": 200,
      "suggested_quantity_g": 300,
      "usda_per_100g": { "calories": 165, "protein": 31, "fat": 3.6, "carbs": 0, "fibre": 0 }
    },
    {
      "description": "Reduce rice from 300g to 200g (-120 kcal, -27g carbs)",
      "ingredient": "rice",
      "original_quantity_g": 300,
      "suggested_quantity_g": 200,
      "usda_per_100g": { "calories": 360, "protein": 7, "fat": 0.6, "carbs": 80, "fibre": 1.8 }
    }
  ],
  "revised_recipe": {
    "title": "Recipe Title",
    "description": "A warm 1-2 sentence description in your voice as Chef Marco",
    "meal_components": [
      {
        "component_name": "Component Name",
        "ingredients": [
          {"amount": "500", "unit": "g", "name": "chicken breast"}
        ],
        "steps": [
          {"title": "Step title", "instruction": "Detailed instruction", "timer_seconds": 300}
        ]
      }
    ],
    "tips": ["Tip 1", "Tip 2"],
    "allergens": ["gluten"],
    "notes": "Chef Marco's notes on the recipe",
    "nutrition_per_serving": {
      "calories": 450,
      "protein_g": 45,
      "total_fat_g": 15,
      "saturated_fat_g": 4,
      "carbohydrates_g": 30,
      "fibre_g": 6,
      "sugar_g": 5,
      "sodium_mg": 600
    },
    "macro_match": {
      "calories": {"target": 450, "actual": 448, "unit": "kcal"},
      "protein": {"target": 45, "actual": 44, "unit": "g"},
      "carbohydrates": {"target": 30, "actual": 31, "unit": "g"},
      "fat": {"target": 15, "actual": 15, "unit": "g"}
    },
    "macro_notes": "Explanation of changes made"
  }
}

CRITICAL MEASUREMENT RULES:
- When units=metric: Weights in g/kg, volumes with mL in brackets (capital L), temperatures in °C
- When units=imperial: Weights in oz/lbs, volumes in cups/tbsp/tsp (no mL), temperatures in °F
- Spoon measures in metric MUST include mL: "2 tbsp (30mL)" not "2 tbsp (60g)"

Calculate the expected macros for each ingredient BEFORE finalising. Respect each target's type: minimum targets must be met or exceeded, maximum targets must not be exceeded, exact targets within 5%. Calories within 10%.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = authenticate(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { stripeCustomerId, isAdmin } = auth.decoded;

  if (!isAdmin) {
    const subInfo = await getSubscriptionInfo(stripeCustomerId);
    if (subInfo.tier !== 'performance') {
      return res.status(403).json({ error: 'Macro Targets requires the Performance plan' });
    }
    if (subInfo.subscriptionStatus !== 'active' && subInfo.subscriptionStatus !== 'trialing') {
      return res.status(403).json({ error: 'Subscription inactive' });
    }
  }

  const { ingredients, targetMacros, actualMacros, macroModes, servings, units } = req.body;

  if (!ingredients || !targetMacros || !actualMacros) {
    return res.status(400).json({ error: 'ingredients, targetMacros, and actualMacros are required' });
  }

  const modes = macroModes || {};

  const ingredientList = ingredients.map(ing =>
    `- ${ing.amount || '?'} ${ing.unit || 'g'} ${ing.name}`
  ).join('\n');

  const modeLabels = {
    calories: 'exact',
    protein: modes.protein || 'exact',
    carbohydrates: modes.carbs || 'exact',
    fat: modes.fat || 'exact',
    fibre: modes.fibre || 'exact',
    sugar: 'maximum',
    sodium: 'maximum',
  };

  const targetLines = Object.entries(targetMacros)
    .filter(([, v]) => v.target)
    .map(([key, v]) => {
      const mode = modeLabels[key] || 'exact';
      const hint = mode === 'minimum' ? 'MINIMUM — must meet or exceed'
                 : mode === 'maximum' ? 'MAXIMUM — must not exceed'
                 : 'EXACT — within 5%';
      return `- ${key}: ${v.target} ${v.unit} (${hint})`;
    })
    .join('\n');

  const actualLines = Object.entries(targetMacros)
    .filter(([, v]) => v.target)
    .map(([key, v]) => {
      const usdaKey = {
        calories: 'calories', protein: 'protein_g',
        carbohydrates: 'carbohydrates_g', fat: 'total_fat_g',
        fibre: 'fibre_g', sugar: 'sugar_g', sodium: 'sodium_mg',
      }[key];
      const actual = actualMacros[usdaKey] != null ? Math.round(actualMacros[usdaKey]) : v.actual;
      const diff = v.target > 0 ? (((actual - v.target) / v.target) * 100).toFixed(0) : 0;
      const mode = modeLabels[key] || 'exact';

      let status = '';
      let verdict = '';

      if (mode === 'minimum') {
        if (actual < v.target) {
          status = ' ⚠️ UNDER MINIMUM — needs increasing';
          verdict = 'ACTION REQUIRED';
        } else {
          status = ' ✅ AT OR ABOVE MINIMUM — do not reduce';
          verdict = 'OK';
        }
      } else if (mode === 'maximum') {
        if (actual > v.target) {
          status = ' ⚠️ OVER MAXIMUM — needs reducing';
          verdict = 'ACTION REQUIRED';
        } else {
          status = ' ✅ AT OR BELOW MAXIMUM — do not increase';
          verdict = 'OK';
        }
      } else {
        if (Math.abs(diff) > 10) {
          status = ' ⚠️ OFF TARGET';
          verdict = 'ACTION REQUIRED';
        } else {
          status = ' ✅ WITHIN TARGET RANGE — do not adjust';
          verdict = 'OK';
        }
      }

      return `- ${key}: actual ${actual} ${v.unit} vs target ${v.target} ${v.unit} [${verdict}]${status}`;
    })
    .join('\n');

  const userMessage = `Refine this recipe to better hit the macro targets. Pay close attention to each target's TYPE (minimum/maximum/exact).

Current ingredients (${servings || 1} servings):
${ingredientList}

Target macros (per serving) with types:
${targetLines}

Actual macros from USDA lookup (per serving):
${actualLines}

Units: ${units || 'metric'}
Servings: ${servings || 1}

For MINIMUM targets that are under: suggest INCREASES (more protein source, add lentils, etc.)
For MAXIMUM targets that are over: suggest DECREASES or swaps (less oil, swap butter for cooking spray, etc.)
NEVER increase an ingredient to fix a minimum if it would push a maximum target over its limit.

Suggest 2-3 specific changes addressing the most severe misses first, and provide a complete revised recipe that hits the targets more closely.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: REFINE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const result = JSON.parse(message.content[0].text);

    if (!Array.isArray(result.suggestions)) result.suggestions = [];

    const srv = servings || 1;

    // Normalise suggestions and calculate real macro impact server-side using USDA data
    result.suggestions = result.suggestions
      .map(s => {
        if (typeof s === 'string') return null; // discard plain-text suggestions
        if (!s.usda_per_100g) s.usda_per_100g = { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 };

        const usda = s.usda_per_100g;
        const deltaG = (s.suggested_quantity_g || 0) - (s.original_quantity_g || 0);

        // Calculate real per-serving macro impact from USDA data
        const impact = {
          calories: ((deltaG / 100) * (usda.calories || 0) / srv),
          protein:  ((deltaG / 100) * (usda.protein  || 0) / srv),
          fat:      ((deltaG / 100) * (usda.fat      || 0) / srv),
          carbs:    ((deltaG / 100) * (usda.carbs    || 0) / srv),
          fibre:    ((deltaG / 100) * (usda.fibre    || 0) / srv),
        };

        // Build a server-calculated description, replacing Marco's guess
        const fmt = (n) => (n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
        const parts = [];
        if (Math.abs(impact.calories) > 0.5) parts.push(`${fmt(impact.calories)} kcal`);
        if (Math.abs(impact.protein)  > 0.1) parts.push(`${fmt(impact.protein)}g protein`);
        if (Math.abs(impact.fat)      > 0.1) parts.push(`${fmt(impact.fat)}g fat`);
        if (Math.abs(impact.carbs)    > 0.1) parts.push(`${fmt(impact.carbs)}g carbs`);
        if (Math.abs(impact.fibre)    > 0.1) parts.push(`${fmt(impact.fibre)}g fibre`);

        const direction = deltaG >= 0
          ? `Increase ${s.ingredient} from ${s.original_quantity_g}g to ${s.suggested_quantity_g}g`
          : `Reduce ${s.ingredient} from ${s.original_quantity_g}g to ${s.suggested_quantity_g}g`;

        s.description = parts.length
          ? `${direction} (${parts.join(', ')} per serving) [USDA-calculated]`
          : direction;

        s._impact = impact; // attach for validation below
        return s;
      })
      .filter(Boolean);

    // Validate suggestions against maximum targets — remove any that would push a maximum over its limit
    const valModes = macroModes || {};
    const valModeLabels = {
      calories: 'exact', protein: valModes.protein || 'exact',
      carbohydrates: valModes.carbs || 'exact', fat: valModes.fat || 'exact',
      fibre: valModes.fibre || 'exact', sugar: 'maximum', sodium: 'maximum',
    };

    const macroKeyMap = {
      calories: 'calories', protein: 'protein_g',
      carbohydrates: 'carbohydrates_g', fat: 'total_fat_g',
      fibre: 'fibre_g', sugar: 'sugar_g', sodium: 'sodium_mg',
    };

    const impactKeyMap = {
      calories: 'calories', protein: 'protein', carbohydrates: 'carbs',
      fat: 'fat', fibre: 'fibre',
    };

    // Log what Marco returned before filtering
    console.log('Marco raw suggestions:', JSON.stringify(result.suggestions, null, 2));

    result.suggestions = result.suggestions.filter(s => {
      for (const [macroKey, v] of Object.entries(targetMacros)) {
        if (!v.target) continue;
        const mode = valModeLabels[macroKey] || 'exact';
        if (mode !== 'maximum') continue;
        const usdaKey = macroKeyMap[macroKey];
        const impactKey = impactKeyMap[macroKey];
        if (!impactKey || !s._impact) continue;
        const currentActual = actualMacros[usdaKey] != null ? actualMacros[usdaKey] : (v.actual || 0);
        const projectedActual = currentActual + (s._impact[impactKey] || 0);
        // Allow 5% tolerance over maximum before rejecting
        const hardLimit = v.target * 1.05;
        if (projectedActual > hardLimit) {
          console.warn(`Suggestion for ${s.ingredient} removed — would push ${macroKey} to ${projectedActual.toFixed(1)}, exceeding hard limit of ${hardLimit.toFixed(1)} (max: ${v.target})`);
          return false;
        }
      }
      return true;
    });

    // Clean up internal property before sending to client
    result.suggestions.forEach(s => delete s._impact);

    if (result.revised_recipe) {
      if (!Array.isArray(result.revised_recipe.tips)) result.revised_recipe.tips = [];
      if (!Array.isArray(result.revised_recipe.allergens)) result.revised_recipe.allergens = [];
    }

    res.json(result);
  } catch (err) {
    console.error('Refine Macros API Error:', err);
    if (err instanceof SyntaxError) {
      res.status(500).json({ error: 'Chef Marco had trouble formatting the refined recipe. Please try again.' });
    } else {
      res.status(500).json({ error: 'Failed to refine recipe. Please try again.' });
    }
  }
}
