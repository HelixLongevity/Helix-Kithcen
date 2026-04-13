import Anthropic from '@anthropic-ai/sdk';
import { authenticate } from './_utils/auth.js';
import { getSubscriptionInfo, incrementRecipeCount } from './_utils/users.js';
import { MACRO_SYSTEM_PROMPT } from './_utils/prompts.js';

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = authenticate(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { stripeCustomerId, isAdmin } = auth.decoded;

  // Must be performance tier (admin bypasses all checks)
  if (!isAdmin) {
    const subInfo = await getSubscriptionInfo(stripeCustomerId);
    if (subInfo.tier !== 'performance') {
      return res.status(403).json({ error: 'Macro Targets requires the Performance plan' });
    }
    if (subInfo.subscriptionStatus !== 'active' && subInfo.subscriptionStatus !== 'trialing') {
      return res.status(403).json({ error: 'Subscription inactive' });
    }
  }

  const {
    calories, protein, proteinMode, carbs, carbsMode, fat, fatMode,
    fibre, fibreMode, sugar, sodium, mealStructure, cookingMethod,
    includeIngredients, excludeIngredients, servings, units,
  } = req.body;


  const isAllInOne = mealStructure === 'all-in-one';
  const structureInstruction = isAllInOne
    ? 'Meal structure: ALL IN ONE — single integrated dish, one entry in meal_components.'
    : 'Meal structure: MAIN + SIDES — return at least 2 separate meal_components (one "Main: ..." and at least one "Side: ...").';

  const srvCount = servings || 1;
  const macroTargets = [];
  if (calories) macroTargets.push(`- Calories: ${calories} kcal per serving (EXACT — hit within 10%)`);
  if (protein) {
    const mode = proteinMode || 'exact';
    const hint = mode === 'minimum' ? 'MINIMUM — you MUST hit at least this, going over is great'
               : mode === 'maximum' ? 'MAXIMUM — do NOT exceed this'
               : 'EXACT — hit within 5%';
    macroTargets.push(`- Protein: ${protein}g per serving (${hint})`);
  }
  if (carbs) {
    const mode = carbsMode || 'exact';
    const hint = mode === 'minimum' ? 'MINIMUM — hit at least this, going over is fine'
               : mode === 'maximum' ? 'MAXIMUM — do NOT exceed this'
               : 'EXACT — hit within 5%';
    macroTargets.push(`- Carbohydrates: ${carbs}g per serving (${hint})`);
  }
  if (fat) {
    const mode = fatMode || 'exact';
    const hint = mode === 'minimum' ? 'MINIMUM — hit at least this, going over is fine'
               : mode === 'maximum' ? 'MAXIMUM — do NOT exceed this'
               : 'EXACT — hit within 5%';
    macroTargets.push(`- Fat: ${fat}g per serving (${hint})`);
  }
  if (fibre) {
    const mode = fibreMode || 'exact';
    const hint = mode === 'minimum' ? 'MINIMUM — hit at least this, add high-fibre ingredients (lentils, beans, vegetables)'
               : mode === 'maximum' ? 'MAXIMUM — do NOT exceed this'
               : 'EXACT — hit within 5%';
    macroTargets.push(`- Fibre: ${fibre}g per serving (${hint})`);
  }
  if (sugar) macroTargets.push(`- Sugar: ${sugar}g per serving (MAXIMUM — stay well under this limit)`);
  if (sodium) macroTargets.push(`- Sodium: ${sodium}mg per serving (MAXIMUM — stay well under this limit)`);

  const userMessage = `Engineer a meal for exactly ${srvCount} serving${srvCount > 1 ? 's' : ''} to hit these macro targets PER SERVING:
${macroTargets.join('\n')}

Total recipe targets (${srvCount} servings): multiply each per-serving target by ${srvCount} and build the recipe to hit those totals.

Additional details:
- ${structureInstruction}
- Cooking method: ${cookingMethod || 'No preference'}
- Servings: ${srvCount}
- Units: ${units || 'metric'}
${includeIngredients ? `- Must include these ingredients: ${includeIngredients}` : ''}
${excludeIngredients ? `- Must EXCLUDE these ingredients: ${excludeIngredients}` : ''}

REMEMBER: Respect each target's type (minimum/maximum/exact). For minimum targets, EXCEED them. For maximum targets, stay UNDER. For exact targets, hit within 5%. Calories are always the top priority.

CRITICAL: Your response MUST be valid JSON only. No preamble, no explanation, no markdown. Start your response with { and end with }. Nothing before or after.`;

  try {
    const callApi = async (messages) => {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: MACRO_SYSTEM_PROMPT,
        messages,
      });
      return JSON.parse(message.content[0].text);
    };

    let recipe = await callApi([{ role: 'user', content: userMessage }]);

    if (!Array.isArray(recipe.tips)) recipe.tips = [];
    if (!Array.isArray(recipe.allergens)) recipe.allergens = [];

    if (!isAdmin) {
      await incrementRecipeCount(stripeCustomerId);
    }
    res.json(recipe);
  } catch (err) {
    console.error('Macro API Error:', err);
    if (err instanceof SyntaxError) {
      res.status(500).json({ error: 'Chef Marco had trouble formatting the macro recipe. Please try again.' });
    } else {
      res.status(500).json({ error: 'Failed to generate macro recipe. Please try again.' });
    }
  }
}
