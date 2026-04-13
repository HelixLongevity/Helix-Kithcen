import Anthropic from '@anthropic-ai/sdk';
import { authenticate } from './_utils/auth.js';
import { MARCO_PERSONA } from './_prompts/marco.js';

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = authenticate(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { ingredient, recipeTitle, allIngredients } = req.body;

  if (!ingredient) {
    return res.status(400).json({ error: 'Ingredient is required' });
  }

  const swapPrompt = `${MARCO_PERSONA}

A home cook is making "${recipeTitle || 'a recipe'}" which uses these ingredients: ${(allIngredients || []).join(', ')}.

They want to substitute "${ingredient}". Suggest 2-3 practical substitutes that would work well in this recipe. Consider flavour, texture, and cooking properties.

Return ONLY valid JSON — no markdown, no code fences:
{
  "substitutes": [
    {"name": "substitute name", "note": "brief explanation of why it works and any adjustment needed"}
  ]
}`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: swapPrompt }],
    });

    const text = message.content[0].text;
    const data = JSON.parse(text);
    res.json(data);
  } catch (err) {
    console.error('Swap API Error:', err);
    res.status(500).json({ error: 'Could not generate substitutes. Please try again.' });
  }
}
