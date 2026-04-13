import Anthropic from '@anthropic-ai/sdk';
import { authenticate } from './_utils/auth.js';
import { getSubscriptionInfo, getRecipeCount, incrementRecipeCount } from './_utils/users.js';
import { NUTRITION_MODE_INSTRUCTIONS, SYSTEM_PROMPT } from './_utils/prompts.js';

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = authenticate(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { stripeCustomerId, isAdmin } = auth.decoded;

  // Check subscription and limits (admin bypasses all checks)
  if (!isAdmin) {
    const subInfo = await getSubscriptionInfo(stripeCustomerId);
    if (!subInfo.tier) {
      return res.status(403).json({ error: 'No subscription' });
    }
    if (subInfo.subscriptionStatus !== 'active' && subInfo.subscriptionStatus !== 'trialing') {
      return res.status(403).json({ error: 'Subscription inactive' });
    }
    if (subInfo.tier === 'starter') {
      const count = await getRecipeCount(stripeCustomerId);
      if (count >= 20) {
        return res.status(403).json({ error: 'Monthly recipe limit reached (20/20)' });
      }
    }
  }

  const { ingredients, method, mealType, servings, units, nutritionMode, mealStructure } = req.body;

  if (!ingredients) {
    return res.status(400).json({ error: 'Ingredients are required' });
  }

  const modes = Array.isArray(nutritionMode) ? nutritionMode : [nutritionMode || 'Balanced'];
  const modeKeys = modes.length ? modes : ['Balanced'];
  const modeLines = modeKeys.map(m => `  - ${m}: ${NUTRITION_MODE_INSTRUCTIONS[m] || NUTRITION_MODE_INSTRUCTIONS['Balanced']}`).join('\n');

  const isAllInOne = mealStructure === 'all-in-one';
  const structureInstruction = isAllInOne
    ? `- Meal structure: ALL IN ONE — Create a single integrated dish where all ingredients cook together or are served as one cohesive dish. Use exactly ONE entry in the meal_components array with no "Main:" or "Side:" prefix in the component_name. Do NOT separate into main + sides.`
    : `- Meal structure: MAIN + SIDES — CRITICAL: You MUST return at least 2 SEPARATE objects in the meal_components array. One labelled "Main: ..." and at least one labelled "Side: ...". Each component MUST have its OWN ingredients array and its OWN steps array. Do NOT combine everything into a single component. A response with only 1 meal_component will be REJECTED.`;

  const userMessage = `Create a complete meal with these details:
- Available ingredients: ${ingredients}
- Cooking method: ${method || 'No preference'}
- Meal type: ${mealType || 'weekday'} (${mealType === 'weekend' ? 'show-stopping, impressive' : 'quick, under 30 minutes'})
- Servings: ${servings || 4}
- Units: ${units || 'metric'}
${structureInstruction}
- Nutrition modes (apply ALL of these together):
${modeLines}

Use what I have and feel free to assume I have basic pantry staples (salt, pepper, oil, butter, common spices). Make it delicious!`;

  try {
    const isMainPlusSides = mealStructure === 'main-plus-sides';

    const callApi = async (messages) => {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
      });
      return JSON.parse(message.content[0].text);
    };

    let recipe = await callApi([{ role: 'user', content: userMessage }]);

    if (isMainPlusSides && (!Array.isArray(recipe.meal_components) || recipe.meal_components.length < 2)) {
      console.warn('Main+sides returned only', recipe.meal_components?.length ?? 0, 'component(s). Retrying with stricter prompt.');
      recipe = await callApi([
        { role: 'user', content: userMessage },
        { role: 'assistant', content: JSON.stringify(recipe) },
        { role: 'user', content: 'This is WRONG. The meal structure is "Main + sides" but you returned a single combined recipe. You MUST split the response into at least 2 separate meal_components — one "Main: ..." dish with its own ingredients and steps, and at least one "Side: ..." dish with its own separate ingredients and steps. Return the corrected JSON now.' },
      ]);
    }

    recipe.nutritionMode = modeKeys;
    if (!Array.isArray(recipe.tips)) recipe.tips = [];
    if (!Array.isArray(recipe.allergens)) recipe.allergens = [];

    if (!isAdmin) {
      await incrementRecipeCount(stripeCustomerId);
    }

    res.json(recipe);
  } catch (err) {
    console.error('API Error:', err);
    if (err instanceof SyntaxError) {
      res.status(500).json({ error: 'Chef Marco had trouble formatting the recipe. Please try again.' });
    } else {
      res.status(500).json({ error: 'Failed to generate recipe. Please check your API key and try again.' });
    }
  }
}
