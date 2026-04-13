import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import Stripe from 'stripe';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const client = new Anthropic();
const JWT_SECRET = process.env.JWT_SECRET || 'helix-kitchen-fallback-secret';

// --- Users DB (JSON file) ---
const USERS_FILE = resolve(__dirname, 'users.json');

function loadUsers() {
  if (!existsSync(USERS_FILE)) return [];
  try { return JSON.parse(readFileSync(USERS_FILE, 'utf-8')); } catch { return []; }
}

function saveUsers(users) {
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// --- Auth middleware ---
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.userId = decoded.userId;
    req.isAdmin = decoded.isAdmin === true;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function getUser(userId) {
  const users = loadUsers();
  return users.find(u => u.id === userId);
}

function updateUser(userId, updates) {
  const users = loadUsers();
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...updates };
  saveUsers(users);
  return users[idx];
}

// --- Stripe webhook needs raw body ---
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || webhookSecret === 'will_add_later') {
    return res.status(200).json({ received: true });
  }

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const users = loadUsers();
        const user = users.find(u => u.stripeCustomerId === subscription.customer);
        if (user) {
          user.subscriptionStatus = subscription.status;
          if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
            user.tier = null;
          }
          saveUsers(users);
        }
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const users = loadUsers();
        const user = users.find(u => u.stripeCustomerId === invoice.customer);
        if (user) {
          user.subscriptionStatus = 'active';
          saveUsers(users);
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).json({ error: 'Webhook error' });
  }
});

app.use(express.json());

// --- Admin bypass ---
function isAdminLogin(email, password) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  return (
    adminEmail && adminPassword &&
    email && password &&
    email.toLowerCase() === adminEmail.toLowerCase() &&
    password === adminPassword
  );
}

const ADMIN_SUB_OVERRIDE = {
  tier: 'performance',
  subscriptionStatus: 'active',
  stripeSubscriptionId: 'admin_bypass',
  trialEnd: null,
  currentPeriodEnd: null,
  billingInterval: null,
};

// --- Tier config ---
const TIERS = {
  starter: {
    name: 'Starter',
    monthlyPrice: 999, // cents AUD
    yearlyPrice: 9999,
    monthlyPriceId: 'price_1TGWGu9Ng3RHYfRnASXfS3Zp',
    yearlyPriceId: 'price_1TGWOT9Ng3RHYfRnN1dSMKLR',
    features: ['Recipe generation', 'Save favourites', '20 recipes per month'],
    recipeLimit: 20,
  },
  kitchen: {
    name: 'Kitchen',
    monthlyPrice: 1999,
    yearlyPrice: 19999,
    monthlyPriceId: 'price_1TGWN09Ng3RHYfRnAWsD5bXg',
    yearlyPriceId: 'price_1TGWN09Ng3RHYfRnWE73m2WG',
    features: ['Unlimited recipes', 'Meal Planner', 'Shopping list generator'],
    recipeLimit: null,
  },
  performance: {
    name: 'Performance',
    monthlyPrice: 2999,
    yearlyPrice: 29999,
    monthlyPriceId: 'price_1TGWNR9Ng3RHYfRnVfNNy2v1',
    yearlyPriceId: 'price_1TGWO89Ng3RHYfRn9n2OdUNI',
    features: ['Everything in Kitchen', 'Macro Targets feature', 'Dish Request'],
    recipeLimit: null,
  },
};

// ==================== AUTH ROUTES ====================

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const users = loadUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'An account with this email already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    id: Date.now().toString(),
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    createdAt: new Date().toISOString(),
    tier: null,
    subscriptionStatus: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    trialEnd: null,
    currentPeriodEnd: null,
    billingInterval: null,
    recipesGeneratedThisMonth: 0,
    recipesResetDate: new Date().toISOString(),
  };

  users.push(user);
  saveUsers(users);

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  const { password: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Admin bypass — skip Stripe/user lookup entirely
  if (isAdminLogin(email, password)) {
    const users = loadUsers();
    let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    const adminUser = user
      ? { ...user, password: undefined }
      : { id: 'admin', email: email.toLowerCase(), name: 'Admin' };
    Object.assign(adminUser, ADMIN_SUB_OVERRIDE, { recipesGeneratedThisMonth: 0 });
    const token = jwt.sign({ userId: adminUser.id, isAdmin: true }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ token, user: adminUser });
  }

  const users = loadUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  const { password: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

app.get('/api/me', authMiddleware, (req, res) => {
  const user = getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Reset monthly counter if needed
  const resetDate = new Date(user.recipesResetDate || 0);
  const now = new Date();
  if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
    user.recipesGeneratedThisMonth = 0;
    user.recipesResetDate = now.toISOString();
    updateUser(user.id, { recipesGeneratedThisMonth: 0, recipesResetDate: now.toISOString() });
  }

  const { password: _, ...safeUser } = user;
  if (req.isAdmin) {
    Object.assign(safeUser, ADMIN_SUB_OVERRIDE, { recipesGeneratedThisMonth: 0 });
  }
  res.json({ user: safeUser });
});

// ==================== FEEDBACK ROUTE ====================

app.post('/api/me', authMiddleware, async (req, res) => {
  console.log(`[FEEDBACK] POST /api/me hit — body keys:`, Object.keys(req.body || {}));
  if (req.body?.action !== 'feedback') {
    return res.status(400).json({ error: 'Invalid action' });
  }

  const { type, section, feedback } = req.body || {};

  if (!feedback || typeof feedback !== 'string' || feedback.trim().length < 10) {
    return res.status(400).json({ error: 'Feedback must be at least 10 characters' });
  }

  const user = getUser(req.userId);
  const email = user?.email || 'unknown';
  const name = user?.name || '';
  const tier = req.isAdmin ? 'admin' : (user?.tier || user?.subscriptionTier || 'unknown');
  const timestamp = new Date().toISOString();

  const notionKey = process.env.NOTION_API_KEY;
  console.log(`[FEEDBACK] NOTION_API_KEY: ${notionKey ? notionKey.slice(0, 10) + '...' : 'NOT SET'}`);
  if (!notionKey) {
    return res.status(500).json({ error: 'Feedback service not configured' });
  }

  const notionBody = {
    parent: { database_id: 'd10228723d91439bb943b246e724d9b8' },
    properties: {
      Feedback: { title: [{ text: { content: feedback.trim().slice(0, 100) } }] },
      Type: { select: { name: type || 'General Feedback' } },
      'App Section': { select: { name: section || 'General' } },
      'User Email': { email: email },
      'User Name': { rich_text: [{ text: { content: name } }] },
      'Subscription Tier': { select: { name: tier } },
      Status: { status: { name: 'Not started' } },
    },
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: feedback.trim() } }],
        },
      },
    ],
  };
  console.log(`[FEEDBACK] Notion request body:`, JSON.stringify(notionBody, null, 2));

  try {
    const notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(notionBody),
    });
    const notionResBody = await notionRes.text();
    console.log(`[FEEDBACK] Notion API response — status: ${notionRes.status}, body: ${notionResBody}`);
    if (!notionRes.ok) {
      console.error(`[FEEDBACK] Notion API error (${notionRes.status}):`, notionResBody);
      return res.status(502).json({ error: 'Failed to save feedback to Notion' });
    }
  } catch (err) {
    console.error('[FEEDBACK] Notion fetch threw:', err);
    return res.status(500).json({ error: 'Failed to save feedback' });
  }

  // Send n8n webhook (non-blocking — don't fail if webhook is down)
  const webhookUrl = process.env.N8N_FEEDBACK_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: feedback.trim(),
          type: type || 'General Feedback',
          section: section || 'General',
          userName: name,
          userEmail: email,
          subscriptionTier: tier,
          timestamp,
        }),
      });
    } catch (err) {
      console.error('n8n webhook failed:', err);
    }
  }

  return res.status(200).json({ success: true });
});

// ==================== STRIPE SUBSCRIPTION ROUTES ====================

app.post('/api/subscription', authMiddleware, async (req, res) => {
  const action = req.query.action;
  const user = getUser(req.userId);

  if (action === 'create') {
    const { tier, interval, paymentMethodId } = req.body;

    if (!tier || !TIERS[tier]) {
      return res.status(400).json({ error: 'Invalid tier' });
    }
    if (!['month', 'year'].includes(interval)) {
      return res.status(400).json({ error: 'Invalid interval' });
    }

    if (!user) return res.status(404).json({ error: 'User not found' });

    try {
      // Create or retrieve Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { userId: user.id },
        });
        customerId = customer.id;
        updateUser(user.id, { stripeCustomerId: customerId });
      }

      // Attach payment method
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      const tierConfig = TIERS[tier];
      const priceId = interval === 'month' ? tierConfig.monthlyPriceId : tierConfig.yearlyPriceId;

      // Cancel existing subscription if any
      if (user.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(user.stripeSubscriptionId);
        } catch { /* ignore if already cancelled */ }
      }

      // Create subscription with 7-day trial
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        trial_period_days: 7,
        payment_settings: {
          payment_method_types: ['card'],
          save_default_payment_method: 'on_subscription',
        },
        expand: ['latest_invoice.payment_intent'],
      });

      const trialEnd = subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null;
      const currentPeriodEnd = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;

      updateUser(user.id, {
        tier,
        subscriptionStatus: subscription.status,
        stripeSubscriptionId: subscription.id,
        trialEnd,
        currentPeriodEnd,
        billingInterval: interval,
      });

      res.json({
        subscriptionId: subscription.id,
        status: subscription.status,
        clientSecret: subscription.latest_invoice?.payment_intent?.client_secret || null,
      });
    } catch (err) {
      console.error('Subscription error:', err);
      res.status(500).json({ error: err.message || 'Failed to create subscription' });
    }

  } else if (action === 'change') {
    const { tier, interval } = req.body;
    if (!user || !user.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    try {
      const tierConfig = TIERS[tier];
      if (!tierConfig) return res.status(400).json({ error: 'Invalid tier' });

      const priceId = interval === 'month' ? tierConfig.monthlyPriceId : tierConfig.yearlyPriceId;

      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      const updated = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        items: [{ id: subscription.items.data[0].id, price: priceId }],
        proration_behavior: 'create_prorations',
      });

      const currentPeriodEnd = updated.current_period_end ? new Date(updated.current_period_end * 1000).toISOString() : null;
      updateUser(user.id, { tier, billingInterval: interval, currentPeriodEnd });

      res.json({ status: updated.status });
    } catch (err) {
      console.error('Change subscription error:', err);
      res.status(500).json({ error: err.message || 'Failed to change subscription' });
    }

  } else if (action === 'cancel') {
    if (!user || !user.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    try {
      const subscription = await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      updateUser(user.id, {
        subscriptionStatus: 'canceling',
      });

      res.json({ status: 'canceling', cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000).toISOString() : null });
    } catch (err) {
      console.error('Cancel error:', err);
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }

  } else {
    res.status(400).json({ error: 'Invalid action. Use action=create, action=change, or action=cancel' });
  }
});

app.get('/api/subscription-status', authMiddleware, (req, res) => {
  const user = getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (req.isAdmin) {
    return res.json({
      tier: 'performance',
      status: 'active',
      trialEnd: null,
      currentPeriodEnd: null,
      billingInterval: null,
      recipesGeneratedThisMonth: 0,
      recipeLimit: null,
    });
  }

  // Reset monthly counter if needed
  const resetDate = new Date(user.recipesResetDate || 0);
  const now = new Date();
  if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
    updateUser(user.id, { recipesGeneratedThisMonth: 0, recipesResetDate: now.toISOString() });
    user.recipesGeneratedThisMonth = 0;
  }

  res.json({
    tier: user.tier,
    status: user.subscriptionStatus,
    trialEnd: user.trialEnd,
    currentPeriodEnd: user.currentPeriodEnd,
    billingInterval: user.billingInterval,
    recipesGeneratedThisMonth: user.recipesGeneratedThisMonth || 0,
    recipeLimit: user.tier === 'starter' ? 20 : null,
  });
});

app.get('/api/stripe-config', (req, res) => {
  res.json({ publishableKey: process.env.STRIPE_PUBLISHABLE_KEY });
});

// ==================== RECIPE ROUTES ====================

const NUTRITION_MODE_INSTRUCTIONS = {
  'Balanced': 'Aim for a well-balanced macronutrient profile — moderate protein, carbs, and fats.',
  'Low Fat': 'Minimise added fats and oils. Prefer lean proteins, steaming, and grilling. Target under 10g total fat per serving where possible.',
  'High Fibre': 'Maximise dietary fibre — use whole grains, legumes, vegetables, and seeds. Target at least 8g fibre per serving.',
  'Low Sugar': 'Avoid added sugars and minimise naturally sweet ingredients. Target under 5g sugar per serving.',
  'Low Carb': 'Minimise carbohydrates — avoid grains, potatoes, and starchy vegetables. Target under 20g carbs per serving.',
  'High Protein': 'Maximise protein content — use generous portions of meat, fish, eggs, legumes, or dairy. Target at least 40g protein per serving.',
  'Full Flavour': 'No nutritional targets — maximise flavour, richness, and indulgence. Use butter, cream, cheese, and bold seasonings freely.',
};

const SYSTEM_PROMPT = `You are Chef Marco, a Michelin-trained global chef with decades of experience across French, Italian, Japanese, Mexican, and Middle Eastern cuisines. You are warm, confident, and passionate about helping home cooks create restaurant-quality meals.

MEAL STRUCTURE: Follow the meal structure specified in the user message:
- If "ALL IN ONE": Create a single cohesive dish with one entry in meal_components. All ingredients and steps are combined into one integrated recipe.
- If "MAIN + SIDES": You MUST return AT LEAST 2 separate objects in the meal_components array — one main dish and at least one side dish. This is NON-NEGOTIABLE. A single combined recipe is WRONG for this mode. Each component MUST have its own component_name (prefixed "Main: ..." or "Side: ..."), its own separate ingredients array, and its own separate steps array. Do NOT merge everything into one component. The sides should complement the main dish nutritionally and flavour-wise. Include 2 sides for weekend meals, 1-2 for weekday meals.

You MUST return ONLY valid JSON with this exact structure — no markdown, no code fences, no extra text:
{
  "title": "Overall Meal Title",
  "description": "A warm 1-2 sentence description of the complete meal in your voice as Chef Marco",
  "prep_time_minutes": 15,
  "cooking_time_minutes": 25,
  "difficulty": "easy",
  "meal_components": [
    {
      "component_name": "Main: Pan-Seared Chicken Thighs",
      "ingredients": [
        {"amount": "500", "unit": "g", "name": "chicken thighs, bone-in"},
        {"amount": "2", "unit": "tbsp (30mL)", "name": "olive oil"}
      ],
      "steps": [
        {"title": "Short step title", "instruction": "Detailed instruction text", "timer_seconds": 300}
      ]
    },
    {
      "component_name": "Side: Lemon-Herb Roasted Vegetables",
      "ingredients": [
        {"amount": "400", "unit": "g", "name": "mixed vegetables (zucchini, capsicum, red onion)"},
        {"amount": "1", "unit": "tbsp (15mL)", "name": "olive oil"}
      ],
      "steps": [
        {"title": "Short step title", "instruction": "Detailed instruction text", "timer_seconds": 300}
      ]
    }
  ],
  "tips": [
    "Don't move the protein once it hits the pan — let it build a crust before flipping.",
    "Bloom your spices in oil for 30 seconds to unlock their full aroma.",
    "Rest the meat for at least 5 minutes — the juices need time to redistribute."
  ],
  "allergens": ["gluten", "dairy"],
  "notes": "Chef Marco's tips, substitutions, or serving suggestions",
  "nutrition_per_serving": {
    "calories": 450,
    "protein_g": 35,
    "total_fat_g": 22,
    "saturated_fat_g": 6,
    "carbohydrates_g": 30,
    "fibre_g": 4,
    "sugar_g": 5,
    "sodium_mg": 680
  }
}

MANDATORY — "tips" and "allergens" MUST be included in every response. Never omit them.

TIPS: Include a "tips" array with exactly 2-3 short, specific technique callouts from you, Chef Marco. These should be practical cooking wisdom relevant to this specific recipe — things like searing techniques, timing tricks, flavour boosters, or common mistakes to avoid. Keep each tip to 1-2 sentences max.

ALLERGENS: Include an "allergens" array listing any common allergens present in the recipe. Check for: gluten, dairy, eggs, nuts, shellfish, soy, sesame, fish, celery, mustard, sulphites. Use lowercase strings. If no allergens are present, return an empty array [].

CRITICAL MEASUREMENT RULES:
- When units=metric:
  - Weights: always in grams (g) or kilograms (kg)
  - Volumes: use cups with mL in brackets, e.g. "1¼ cups (310mL)". Always use capital L in mL.
  - Spoon measures: "2 tbsp (30mL)" or "1 tsp (5mL)" — always include mL equivalent with capital L
  - IMPORTANT: Tablespoon and teaspoon measurements must ALWAYS show mL in brackets, NEVER grams. 1 tbsp = 15mL, 1 tsp = 5mL. Never use grams (g) for liquid or semi-liquid ingredients measured in spoons. For example: "3 tbsp (45mL)" NOT "3 tbsp (60g)".
  - Temperature: °C
- When units=imperial:
  - Weights: oz, lbs
  - Volumes: cups, tbsp, tsp (NO mL equivalents)
  - Temperature: °F

PORTION SCALING: All ingredient amounts must be correctly scaled for the requested number of servings. This includes ALL measurements — weights, volumes, cup measures, and spoon measures.

MEAL TYPE:
- weekday: Quick meals, 30 minutes or under, minimal prep, practical and satisfying
- weekend: Show-stopping dishes, more complex techniques allowed, impressive presentation

Set timer_seconds to 0 or omit if no timer is needed for a step.

NUTRITION: Always include a "nutrition_per_serving" object with realistic estimates for the COMPLETE MEAL (all meal_components combined), not just one component. Values must reflect all meal components scaled to one serving. Fields: calories (kcal), protein_g, total_fat_g, saturated_fat_g, carbohydrates_g, fibre_g, sugar_g, sodium_mg. Use whole numbers.

TIMING & DIFFICULTY: Always include these three fields at the top level:
- "prep_time_minutes": integer — total hands-on preparation time in minutes (chopping, marinating, mixing, etc.)
- "cooking_time_minutes": integer — total cooking/baking time in minutes (time on heat or in oven — NOT including prep)
- "difficulty": one of "easy", "medium", or "hard"
  - "easy": simple techniques, few ingredients, minimal skill required, under 30 min total
  - "medium": some technique required, moderate ingredient count, 30-60 min total
  - "hard": advanced techniques, many components, precise timing, 60+ min or complex skills
These fields are MANDATORY — never omit them.`;

// Increment recipe count for user
function incrementRecipeCount(userId) {
  const user = getUser(userId);
  if (!user) return;
  const count = (user.recipesGeneratedThisMonth || 0) + 1;
  updateUser(userId, { recipesGeneratedThisMonth: count });
}

// Check recipe limit
function checkRecipeLimit(userId, isAdmin) {
  if (isAdmin) return { allowed: true };
  const user = getUser(userId);
  if (!user || !user.tier) return { allowed: false, reason: 'No subscription' };

  // Check if trial/subscription is valid
  const status = user.subscriptionStatus;
  if (status !== 'active' && status !== 'trialing') {
    return { allowed: false, reason: 'Subscription inactive' };
  }

  if (user.tier === 'starter') {
    const resetDate = new Date(user.recipesResetDate || 0);
    const now = new Date();
    let count = user.recipesGeneratedThisMonth || 0;
    if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
      count = 0;
    }
    if (count >= 20) {
      return { allowed: false, reason: 'Monthly recipe limit reached (20/20)' };
    }
  }

  return { allowed: true };
}

app.post('/api/recipe', authMiddleware, async (req, res) => {
  // Check subscription and limits
  const limitCheck = checkRecipeLimit(req.userId, req.isAdmin);
  if (!limitCheck.allowed) {
    return res.status(403).json({ error: limitCheck.reason });
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

    // Increment recipe count
    incrementRecipeCount(req.userId);

    res.json(recipe);
  } catch (err) {
    console.error('API Error:', err);
    if (err instanceof SyntaxError) {
      res.status(500).json({ error: 'Chef Marco had trouble formatting the recipe. Please try again.' });
    } else {
      res.status(500).json({ error: 'Failed to generate recipe. Please check your API key and try again.' });
    }
  }
});

app.post('/api/swap-ingredient', authMiddleware, async (req, res) => {
  const { ingredient, recipeTitle, allIngredients } = req.body;

  if (!ingredient) {
    return res.status(400).json({ error: 'Ingredient is required' });
  }

  const swapPrompt = `You are Chef Marco. A home cook is making "${recipeTitle || 'a recipe'}" which uses these ingredients: ${(allIngredients || []).join(', ')}.

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
});

// ==================== MACRO RECIPE ROUTE ====================

const MACRO_SYSTEM_PROMPT = `You are Chef Marco, a Michelin-trained global chef who is also an expert in sports nutrition and macro-targeted meal engineering. You are warm, confident, and passionate about creating meals that taste incredible AND hit precise nutritional targets.

Your task is to engineer a recipe that hits the specified macro targets as closely as possible. This is your PRIMARY constraint — flavour and technique are secondary to hitting the numbers, but you should still make it taste great.

UNDERSTANDING TARGET TYPES:
Each macro target has a type — exact, minimum, or maximum. You MUST respect these:
- EXACT targets: hit within 5% above or below the target value
- MINIMUM targets: you MUST hit AT LEAST this amount. Going over is fine and encouraged. Never come in under a minimum target.
- MAXIMUM targets: you must NOT exceed this amount. Going under is fine and preferred.

PRIORITY ORDER (most important first):
1. CALORIES — always hit within 10%. This is the single most important target.
2. PROTEIN — if set as minimum, ALWAYS exceed it. Use high-protein ingredients generously (e.g. 450g chicken breast instead of 240g, add a second protein source, use protein-dense sides like quinoa or lentils).
3. FAT — if set as maximum, stay well under. If set as minimum, exceed it.
4. CARBS — same logic: respect the type (min = exceed, max = stay under, exact = within 5%).
5. FIBRE — if set as minimum, actively add high-fibre ingredients (lentils, beans, chickpeas, vegetables, whole grains).
6. SUGAR — almost always a maximum. Stay well under the limit.

WHEN STRUGGLING TO HIT PROTEIN TARGETS:
- Increase the protein source quantity significantly (e.g. use 450g chicken breast, not 240g)
- Add a SECOND protein source (e.g. chicken + lentils, beef + eggs, salmon + edamame)
- Use protein-dense sides like quinoa, lentils, chickpeas, or Greek yoghurt
- Do NOT sacrifice protein to hit other targets — protein is always higher priority than carbs or fat

SERVING CALCULATION:
The recipe MUST be for the EXACT number of servings specified. Do NOT make a recipe for 4 and divide.
Calculate: per-serving targets × number of servings = total recipe targets. Then build the recipe to hit those totals exactly.
For example: if the user wants 2 servings at 500 kcal each, you must engineer a recipe totalling 1000 kcal, then divide into 2 equal servings.

PRECISION REQUIREMENTS:
- You MUST hit the calorie target within 10%. Protein minimum targets must be MET OR EXCEEDED. Maximum targets must NOT be exceeded. Exact targets within 5%.
- Use USDA-standard nutritional values when planning, NOT rough estimates. Here are key reference values per 100g:
  • Chicken breast: 165 kcal, 31g protein, 3.6g fat
  • Rice (raw): 360 kcal, 7g protein, 80g carbs
  • Olive oil: 884 kcal, 100g fat
  • Butter: 717 kcal, 81g fat
  • Eggs: 155 kcal, 13g protein, 11g fat
  • Salmon: 208 kcal, 20g protein, 13g fat
  • Sweet potato: 86 kcal, 20g carbs
  • Broccoli: 34 kcal, 2.8g protein, 7g carbs
  • Quinoa (dry): 368 kcal, 14g protein, 64g carbs
  • Avocado: 160 kcal, 15g fat, 9g carbs
  • Greek yoghurt: 59 kcal, 10g protein

CALCULATION METHOD:
Before finalising the recipe, you MUST:
1. List each ingredient with its quantity in grams
2. Calculate the expected calories, protein, carbs, and fat for each ingredient based on quantity × (nutrient per 100g / 100)
3. Sum the totals and compare against the targets
4. Adjust quantities up or down to close any gap
5. Only then finalise the recipe

You MUST return ONLY valid JSON with this exact structure — no markdown, no code fences, no extra text:
{
  "title": "Recipe Title",
  "description": "A warm 1-2 sentence description in your voice as Chef Marco",
  "prep_time_minutes": 15,
  "cooking_time_minutes": 25,
  "difficulty": "easy",
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
    "fat": {"target": 15, "actual": 15, "unit": "g"},
    "fibre": {"target": 6, "actual": 6, "unit": "g"},
    "sugar": {"target": 5, "actual": 4, "unit": "g"},
    "sodium": {"target": 600, "actual": 580, "unit": "mg"}
  },
  "macro_notes": "Chef Marco's explanation of any trade-offs made to hit the macro targets"
}

MANDATORY — "tips", "allergens", "macro_match", and "macro_notes" MUST be included in every response.

MACRO MATCH: For each macro target provided by the user, include an entry in macro_match showing target vs actual. Be honest — if you can't hit a target exactly, show the real number.

CRITICAL MEASUREMENT RULES:
- When units=metric: Weights in g/kg, volumes with mL in brackets (capital L), temperatures in °C
- When units=imperial: Weights in oz/lbs, volumes in cups/tbsp/tsp (no mL), temperatures in °F
- Spoon measures in metric MUST include mL: "2 tbsp (30mL)" not "2 tbsp (60g)"

PORTION SCALING: All amounts must be correctly scaled for the requested servings.

Set timer_seconds to 0 or omit if no timer is needed.

TIPS: Include 2-3 practical cooking tips specific to this recipe.
ALLERGENS: List any common allergens. Empty array [] if none.

TIMING & DIFFICULTY: Always include these three fields at the top level:
- "prep_time_minutes": integer — total hands-on preparation time in minutes
- "cooking_time_minutes": integer — total cooking/baking time in minutes
- "difficulty": one of "easy", "medium", or "hard"
These fields are MANDATORY — never omit them.`;

app.post('/api/macro-recipe', authMiddleware, async (req, res) => {
  // Check subscription — must be performance tier (admin bypasses)
  const user = getUser(req.userId);
  if (!req.isAdmin) {
    if (!user || user.tier !== 'performance') {
      return res.status(403).json({ error: 'Macro Targets requires the Performance plan' });
    }
    const status = user.subscriptionStatus;
    if (status !== 'active' && status !== 'trialing') {
      return res.status(403).json({ error: 'Subscription inactive' });
    }
  }

  const {
    calories, protein, proteinMode, carbs, carbsMode, fat, fatMode,
    fibre, fibreMode, sugar, sodium, mealStructure, cookingMethod,
    includeIngredients, excludeIngredients, servings, units,
  } = req.body;

  if (!calories) {
    return res.status(400).json({ error: 'Target calories are required' });
  }

  const isAllInOne = mealStructure === 'all-in-one';
  const structureInstruction = isAllInOne
    ? 'Meal structure: ALL IN ONE — single integrated dish, one entry in meal_components.'
    : 'Meal structure: MAIN + SIDES — return at least 2 separate meal_components (one "Main: ..." and at least one "Side: ...").';

  const srvCount = servings || 1;
  const macroTargets = [];
  macroTargets.push(`- Calories: ${calories} kcal per serving (EXACT — hit within 10%)`);
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

REMEMBER: Respect each target's type (minimum/maximum/exact). For minimum targets, EXCEED them. For maximum targets, stay UNDER. For exact targets, hit within 5%. Calories are always the top priority.`;

  try {
    const callApi = async (messages) => {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: MACRO_SYSTEM_PROMPT,
        messages,
      });
      return JSON.parse(message.content[0].text);
    };

    let recipe = await callApi([{ role: 'user', content: userMessage }]);

    if (!Array.isArray(recipe.tips)) recipe.tips = [];
    if (!Array.isArray(recipe.allergens)) recipe.allergens = [];

    incrementRecipeCount(req.userId);
    res.json(recipe);
  } catch (err) {
    console.error('Macro API Error:', err);
    if (err instanceof SyntaxError) {
      res.status(500).json({ error: 'Chef Marco had trouble formatting the macro recipe. Please try again.' });
    } else {
      res.status(500).json({ error: 'Failed to generate macro recipe. Please try again.' });
    }
  }
});

// ==================== REFINE MACROS ROUTE ====================

const REFINE_SYSTEM_PROMPT = `You are Chef Marco, a Michelin-trained global chef and sports nutrition expert. You are refining a recipe to better hit macro targets.

You will receive:
- The current recipe ingredients with quantities
- The target macros the user requested, each with a TYPE (minimum, maximum, or exact)
- The actual macros from USDA lookup

UNDERSTANDING TARGET TYPES:
- EXACT targets: hit within 5% above or below
- MINIMUM targets: the actual value must be AT LEAST this amount. If under, suggest INCREASES (more chicken, add lentils, etc.)
- MAXIMUM targets: the actual value must NOT exceed this amount. If over, suggest DECREASES or swaps (less oil, swap butter for cooking spray, etc.)

CRITICAL RULES:
- NEVER increase an ingredient to hit a minimum target if it would push a maximum target over its limit
- Calories are the highest priority — always within 10%
- Protein minimum targets are second priority — always meet or exceed them
- When increasing protein: increase protein source quantity significantly, add a second protein source, or use protein-dense sides (quinoa, lentils, chickpeas)
- When reducing fat (maximum): swap cooking fats for spray, reduce oil, use leaner cuts
- When reducing sugar (maximum): swap ingredients, reduce sweet components

Your job is to suggest 2-3 specific, actionable changes to close the gap between actual and target macros. Each suggestion MUST be a structured object with:
- "description": a human-readable change with estimated impact (e.g. "Increase chicken breast from 200g to 300g (+165 kcal, +31g protein)")
- "ingredient": the ingredient name (must match the ingredient name in the recipe)
- "original_quantity_g": the current quantity in grams (number)
- "suggested_quantity_g": the new suggested quantity in grams (number)
- "usda_per_100g": USDA nutritional data per 100g for this ingredient: { "calories": number, "protein": number, "fat": number, "carbs": number, "fibre": number }

For swap suggestions (e.g. swap butter for olive oil), use the NEW ingredient's USDA data and set original_quantity_g to 0.

Use USDA-standard nutritional values per 100g:
  • Chicken breast: 165 kcal, 31g protein, 3.6g fat
  • Rice (raw): 360 kcal, 7g protein, 80g carbs
  • Olive oil: 884 kcal, 100g fat
  • Butter: 717 kcal, 81g fat
  • Eggs: 155 kcal, 13g protein, 11g fat
  • Salmon: 208 kcal, 20g protein, 13g fat
  • Sweet potato: 86 kcal, 20g carbs
  • Broccoli: 34 kcal, 2.8g protein, 7g carbs
  • Quinoa (dry): 368 kcal, 14g protein, 64g carbs
  • Avocado: 160 kcal, 15g fat, 9g carbs
  • Greek yoghurt: 59 kcal, 10g protein

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

app.post('/api/refine-macros', authMiddleware, async (req, res) => {
  // Check subscription — must be performance tier (admin bypasses)
  const user = getUser(req.userId);
  if (!req.isAdmin) {
    if (!user || user.tier !== 'performance') {
      return res.status(403).json({ error: 'Macro Targets requires the Performance plan' });
    }
    const status = user.subscriptionStatus;
    if (status !== 'active' && status !== 'trialing') {
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

  const USDA_KEY_MAP = {
    calories: 'calories', protein: 'protein_g',
    carbohydrates: 'carbohydrates_g', fat: 'total_fat_g',
    fibre: 'fibre_g', sugar: 'sugar_g', sodium: 'sodium_mg',
  };

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
      const usdaKey = USDA_KEY_MAP[key];
      const actual = actualMacros[usdaKey] != null ? Math.round(actualMacros[usdaKey]) : v.actual;
      const diff = v.target > 0 ? (((actual - v.target) / v.target) * 100).toFixed(0) : 0;
      const mode = modeLabels[key] || 'exact';
      let status = '';
      if (mode === 'minimum' && actual < v.target) status = ' ⚠️ UNDER MINIMUM';
      else if (mode === 'maximum' && actual > v.target) status = ' ⚠️ OVER MAXIMUM';
      else if (mode === 'exact' && Math.abs(diff) > 5) status = ' ⚠️ OFF TARGET';
      return `- ${key}: ${actual} ${v.unit} (${diff > 0 ? '+' : ''}${diff}% off target)${status}`;
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

Suggest 2-3 specific changes and provide a complete revised recipe that hits the targets more closely.`;

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: REFINE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const result = JSON.parse(message.content[0].text);

    if (!Array.isArray(result.suggestions)) result.suggestions = [];
    // Normalise suggestions: ensure each is a structured object
    result.suggestions = result.suggestions.map(s => {
      if (typeof s === 'string') {
        return { description: s, ingredient: '', original_quantity_g: 0, suggested_quantity_g: 0, usda_per_100g: { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 } };
      }
      if (!s.usda_per_100g) s.usda_per_100g = { calories: 0, protein: 0, fat: 0, carbs: 0, fibre: 0 };
      return s;
    });
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
});

// ==================== DISH REQUEST ROUTE ====================

const DISH_REQUEST_SYSTEM_PROMPT = `You are Chef Marco, a Michelin-trained global chef with decades of experience across French, Italian, Japanese, Mexican, and Middle Eastern cuisines. You are warm, confident, and passionate about helping home cooks create restaurant-quality meals.

The user will describe a specific dish they want to make. Your job is to create the perfect recipe for that dish, using your expertise to choose the best ingredients, quantities, and techniques. Draw on your knowledge of the cuisine and the dish to create an authentic, delicious result.

If the user specifies a cooking method (e.g. slow cooker, oven), honour that method. If a cooking method is also provided separately as a parameter, the parameter takes precedence over what the user describes in their text.

${SYSTEM_PROMPT.split('MEAL STRUCTURE:').slice(1).join('MEAL STRUCTURE:')}`;

app.post('/api/dish-request', authMiddleware, async (req, res) => {
  // Check subscription — must be performance tier (admin bypasses)
  const user = getUser(req.userId);
  if (!req.isAdmin) {
    if (!user || user.tier !== 'performance') {
      return res.status(403).json({ error: 'Dish Request requires the Performance plan' });
    }
    const status = user.subscriptionStatus;
    if (status !== 'active' && status !== 'trialing') {
      return res.status(403).json({ error: 'Subscription inactive' });
    }
  }

  const { dishDescription, method, mealType, servings, units, nutritionMode, mealStructure } = req.body;

  if (!dishDescription || !dishDescription.trim()) {
    return res.status(400).json({ error: 'Dish description is required' });
  }

  const modes = Array.isArray(nutritionMode) ? nutritionMode : [nutritionMode || 'Balanced'];
  const modeKeys = modes.length ? modes : ['Balanced'];
  const modeLines = modeKeys.map(m => `  - ${m}: ${NUTRITION_MODE_INSTRUCTIONS[m] || NUTRITION_MODE_INSTRUCTIONS['Balanced']}`).join('\n');

  const isAllInOne = mealStructure === 'all-in-one';
  const structureInstruction = isAllInOne
    ? `- Meal structure: ALL IN ONE — Create a single integrated dish where all ingredients cook together or are served as one cohesive dish. Use exactly ONE entry in the meal_components array with no "Main:" or "Side:" prefix in the component_name. Do NOT separate into main + sides.`
    : `- Meal structure: MAIN + SIDES — CRITICAL: You MUST return at least 2 SEPARATE objects in the meal_components array. One labelled "Main: ..." and at least one labelled "Side: ...". Each component MUST have its OWN ingredients array and its OWN steps array. Do NOT combine everything into a single component. A response with only 1 meal_component will be REJECTED.`;

  const userMessage = `The user wants to make: "${dishDescription.trim()}"

Create the perfect recipe for this dish using your expertise to choose the best ingredients and techniques.

Additional settings:
- Cooking method: ${method || 'No preference'}${method && method !== 'No preference' ? ' (this overrides any method mentioned in the dish description)' : ''}
- Meal type: ${mealType || 'weekday'} (${mealType === 'weekend' ? 'show-stopping, impressive' : 'quick, under 30 minutes'})
- Servings: ${servings || 4}
- Units: ${units || 'metric'}
${structureInstruction}
- Nutrition modes (apply ALL of these together):
${modeLines}

Use your expertise to select the best ingredients for this dish. Assume the cook has access to a well-stocked kitchen and can source any ingredients. Make it delicious!`;

  try {
    const isMainPlusSides = mealStructure === 'main-plus-sides';

    const callApi = async (messages) => {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: DISH_REQUEST_SYSTEM_PROMPT,
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

    incrementRecipeCount(req.userId);
    res.json(recipe);
  } catch (err) {
    console.error('Dish Request API Error:', err);
    if (err instanceof SyntaxError) {
      res.status(500).json({ error: 'Chef Marco had trouble formatting the recipe. Please try again.' });
    } else {
      res.status(500).json({ error: 'Failed to generate recipe. Please try again.' });
    }
  }
});

// ==================== NUTRITION LOOKUP ROUTE ====================

const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1/foods/search';

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

const VOLUME_TO_GRAMS = {
  cup: 240, cups: 240, tbsp: 15, tsp: 5, tablespoon: 15, tablespoons: 15,
  teaspoon: 5, teaspoons: 5, ml: 1, mL: 1, l: 1000, L: 1000,
  litre: 1000, litres: 1000, liter: 1000, liters: 1000, 'fl oz': 30, floz: 30,
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

// Pattern-based search term overrides (checked if no exact override matches)
const SEARCH_TERM_PATTERNS = [
  { pattern: /\brice\b/i, replacement: 'rice white raw' },
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

function cleanIngredientName(name) {
  return name
    .replace(/\([^)]*\)/g, '')
    .replace(/\d+\s*(cm|mm|inch|inches|in)\s*(pieces?|lengths?|chunks?|strips?|cubes?|thick|thin)?/gi, '')
    .replace(/\b(diced|chopped|sliced|minced|crushed|grated|shredded|julienned|cubed|halved|quartered|trimmed|peeled|deseeded|deveined|deboned|bone-in|boneless|skinless|skin-on|finely|roughly|thinly|fresh|dried|frozen|canned|cooked|raw|ripe|extra-virgin|virgin|light|dark|unsalted|salted|plain|all-purpose|self-raising|whole|ground|smoked|roasted|toasted|melted|softened|room temperature|to taste|optional|for garnish|for serving|divided)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,\-]+|[\s,\-]+$/g, '')
    .trim();
}

function shouldAppendRaw(cleanedName) {
  const lower = cleanedName.toLowerCase();
  if (NO_RAW_SUFFIX.has(lower)) return false;
  for (const term of NO_RAW_SUFFIX) {
    if (lower === term) return false;
  }
  if (/\b(oil|sauce|stock|broth|wine|vinegar|sugar|flour|spice|herb|powder|paste|syrup|mustard|seeds?)\b/i.test(lower)) {
    return false;
  }
  return true;
}

function buildSearchTerm(ingredientName) {
  const cleaned = cleanIngredientName(ingredientName);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();

  console.log(`[OVERRIDE-DEBUG] Raw: "${ingredientName}" → Cleaned: "${cleaned}" → Lower: "${lower}"`);

  // Special case: any ingredient with both "bell" and "pepper" is a bell pepper, not black pepper
  if (lower.includes('bell') && lower.includes('pepper')) {
    const color = lower.includes('green') ? 'green' : lower.includes('yellow') ? 'yellow' : 'red';
    const term = `peppers sweet ${color} raw`;
    console.log(`[OVERRIDE-DEBUG] ✅ Bell pepper catch-all: "${lower}" → "${term}"`);
    return term;
  }

  // Check if the cleaned ingredient name contains any override key
  // (keys are sorted longest-first so specific overrides match before generic ones)
  let overrideMatched = false;
  for (const [key, value] of Object.entries(SEARCH_TERM_OVERRIDES)) {
    if (lower.includes(key)) {
      console.log(`[OVERRIDE-DEBUG] ✅ MATCHED override key: "${key}" → search term: "${value}"`);
      overrideMatched = true;
      return value;
    }
  }
  if (!overrideMatched) {
    console.log(`[OVERRIDE-DEBUG] ❌ No override matched for "${lower}". Override keys: ${Object.keys(SEARCH_TERM_OVERRIDES).join(', ')}`);
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

function parseAmount(amountStr) {
  if (!amountStr) return 0;
  let str = String(amountStr).trim();
  const fractionMap = { '½': 0.5, '⅓': 1/3, '⅔': 2/3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8, '⅙': 1/6, '⅚': 5/6, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875 };
  let total = 0;
  for (const [char, val] of Object.entries(fractionMap)) {
    if (str.includes(char)) { str = str.replace(char, ''); total += val; }
  }
  const fractionMatch = str.match(/(\d+)\s*\/\s*(\d+)/);
  if (fractionMatch) { total += parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]); str = str.replace(fractionMatch[0], ''); }
  const wholeMatch = str.match(/(\d+(\.\d+)?)/);
  if (wholeMatch) { total += parseFloat(wholeMatch[1]); }
  return total;
}

function toGrams(amount, unit, ingredientName) {
  if (!amount) return 100;
  const numAmount = parseAmount(amount);
  if (!unit) return numAmount;
  const unitLower = unit.toLowerCase().replace(/\s*\([^)]*\)/, '').trim();

  // Weight units
  if (['g', 'grams', 'gram'].includes(unitLower)) return numAmount;
  if (['kg', 'kilogram', 'kilograms'].includes(unitLower)) return numAmount * 1000;
  if (['oz', 'ounce', 'ounces'].includes(unitLower)) return numAmount * 28.35;
  if (['lb', 'lbs', 'pound', 'pounds'].includes(unitLower)) return numAmount * 453.6;

  // Ingredient-specific volume conversions
  if (ingredientName) {
    const ingLower = cleanIngredientName(ingredientName).toLowerCase();
    for (const [ingKey, conversions] of Object.entries(INGREDIENT_VOLUME_GRAMS)) {
      if (ingLower === ingKey || ingLower.includes(ingKey)) {
        const singular = unitLower.replace(/s$/, '');
        const g = conversions[unitLower] || conversions[singular];
        if (g) return numAmount * g;
      }
    }
  }

  // Default volume conversions
  const singular = unitLower.replace(/s$/, '');
  const volumeGrams = VOLUME_TO_GRAMS[unitLower] || VOLUME_TO_GRAMS[singular];
  if (volumeGrams) return numAmount * volumeGrams;

  // Size-based whole items (medium, large, small)
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

  // Special units
  if (['pinch', 'pinches'].includes(unitLower)) return numAmount * 0.5;
  if (['clove', 'cloves'].includes(unitLower)) return numAmount * 3;
  if (['sprig', 'sprigs'].includes(unitLower)) return numAmount * 2;
  if (['bunch', 'bunches'].includes(unitLower)) return numAmount * 30;
  if (['piece', 'pieces', 'slice', 'slices'].includes(unitLower)) return numAmount * 30;

  return numAmount;
}

// Score a USDA result and reject bad matches
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

  // Reward shorter descriptions (more generic = better)
  if (desc.length < 50) score += 5;
  else if (desc.length > 100) score -= 3;

  if (/\b(brand|upc|gtin)\b/i.test(desc)) score -= 10;

  // REJECTION RULES: penalise results that clearly don't match
  // Salt searching → reject anything with "butter" or "salted" that isn't actually salt
  if (ingLower.match(/^(salt|sea salt|kosher salt)$/) && /\b(butter|salted)\b/i.test(desc) && !/\bsalt\b/i.test(desc)) score -= 50;
  // Rice searching → reject crackers, cake, pudding
  if (/\brice\b/i.test(ingLower) && /\b(crackers?|cake|pudding|cereal|noodle|flour)\b/i.test(desc)) score -= 50;
  // Olive oil → reject blends or other oils listed first
  if (/\bolive oil\b/i.test(ingLower) && /\b(corn|peanut|canola|soybean)\b/i.test(desc)) score -= 50;
  // Butter → reject ghee/clarified
  if (ingLower.match(/^butter$/) && /\b(ghee|clarified)\b/i.test(desc)) score -= 50;
  // Chicken breast → reject breaded/processed
  if (/\bchicken breast\b/i.test(ingLower) && /\b(breaded|nugget|patty|strip|tender|frozen|processed)\b/i.test(desc)) score -= 50;
  // Wine → reject dessert wine when searching for table wine
  if (/\b(dry white wine|white wine)\b/i.test(ingLower) && /\bdessert\b/i.test(desc)) score -= 50;

  return score;
}

async function searchUSDA(ingredientName, apiKey) {
  const searchTerm = buildSearchTerm(ingredientName);
  if (!searchTerm) return null;

  const url = `${USDA_API_BASE}?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(searchTerm)}&pageSize=10&dataType=SR%20Legacy,Foundation`;
  const response = await fetch(url);
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

  // DEBUG: Log ALL nutrient IDs from the first USDA result so we can see what's available
  console.log(`[NUTRITION-DEBUG] === Raw USDA data for "${ingredientName}" ===`);
  console.log(`[NUTRITION-DEBUG] Matched food: "${best.description}" (FDC#${best.fdcId})`);
  console.log(`[NUTRITION-DEBUG] Total foodNutrients entries: ${(best.foodNutrients || []).length}`);
  console.log(`[NUTRITION-DEBUG] All nutrient IDs present: ${(best.foodNutrients || []).map(n => `${n.nutrientId}(${n.nutrientName}=${n.value}${n.unitName || ''})`).join(', ')}`);

  // DEBUG: Specifically look for energy/calorie fields
  const energyNutrients = (best.foodNutrients || []).filter(n =>
    n.nutrientName && (n.nutrientName.toLowerCase().includes('energy') || n.nutrientName.toLowerCase().includes('calor'))
  );
  console.log(`[NUTRITION-DEBUG] Energy/calorie nutrients found: ${JSON.stringify(energyNutrients)}`);

  const nutrients = {};
  const energyFallbacks = {};
  for (const nutrient of best.foodNutrients || []) {
    const key = NUTRIENT_IDS[nutrient.nutrientId];
    if (key) {
      nutrients[key] = nutrient.value || 0;
      console.log(`[NUTRITION-DEBUG] Mapped nutrientId ${nutrient.nutrientId} (${nutrient.nutrientName}) → ${key} = ${nutrient.value} ${nutrient.unitName || ''}`);
    }
    // Track alternate energy nutrient IDs as fallbacks
    if (nutrient.nutrientId === 2047 || nutrient.nutrientId === 2048) {
      energyFallbacks[nutrient.nutrientId] = nutrient.value || 0;
    }
  }

  // Some USDA Foundation entries store total fat under 1085 (Total fat NLEA) instead of 1004
  if (!nutrients.total_fat_g) {
    for (const nutrient of best.foodNutrients || []) {
      if (nutrient.nutrientId === 1085 && nutrient.value) {
        nutrients.total_fat_g = nutrient.value;
        console.log(`[NUTRITION-DEBUG] total_fat_g missing from 1004 — using nutrient 1085 (Total fat NLEA): ${nutrient.value}g`);
        break;
      }
    }
  }

  // Similarly, check alternate protein IDs (1003 is standard, 1299 is an alternate)
  if (!nutrients.protein_g) {
    for (const nutrient of best.foodNutrients || []) {
      if (nutrient.nutrientId === 1299 && nutrient.value) {
        nutrients.protein_g = nutrient.value;
        console.log(`[NUTRITION-DEBUG] protein_g missing from 1003 — using nutrient 1299: ${nutrient.value}g`);
        break;
      }
    }
  }

  // If calories (nutrient 1008) is missing or zero, fall back to Atwater energy IDs
  if (!nutrients.calories) {
    const fallbackValue = energyFallbacks[2048] || energyFallbacks[2047] || 0;
    if (fallbackValue) {
      console.log(`[NUTRITION-DEBUG] Nutrient 1008 missing/zero for "${best.description}" — using fallback energy ID (2048/2047): ${fallbackValue} kcal/100g`);
      nutrients.calories = fallbackValue;
    } else {
      // Last resort: calculate from macros
      const macroCalories = (nutrients.protein_g || 0) * 4 + (nutrients.total_fat_g || 0) * 9 + (nutrients.carbohydrates_g || 0) * 4;
      if (macroCalories > 0) {
        console.log(`[NUTRITION-DEBUG] No energy nutrient found for "${best.description}" — using macro-derived estimate: ${macroCalories.toFixed(0)} kcal/100g`);
        nutrients.calories = Math.round(macroCalories);
      } else {
        console.log(`[NUTRITION-DEBUG] No energy nutrient and no macros for "${best.description}"`);
      }
    }
  }

  console.log(`[NUTRITION-DEBUG] Final nutrientsPer100g: ${JSON.stringify(nutrients)}`);

  return { fdcId: best.fdcId, description: best.description, searchTerm, nutrientsPer100g: nutrients };
}

app.post('/api/nutrition-lookup', async (req, res) => {
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

  console.log(`[NUTRITION] === Nutrition lookup: ${validIngredients.length} ingredients, ${servings} servings ===`);

  const numServings = Math.max(1, parseInt(servings) || 4);

  try {
    const results = await Promise.all(
      validIngredients.map(async (ing) => {
        const rawName = String(ing.name).trim();
        const searchTerm = buildSearchTerm(rawName);
        console.log(`[NUTRITION] 🔍 "${rawName}" → search: "${searchTerm}"`);

        if (!searchTerm) {
          console.log(`[NUTRITION] ❌ "${rawName}" → cleaned name is empty, skipping`);
          return { name: rawName, found: false };
        }

        try {
          const usdaResult = await searchUSDA(rawName, apiKey);
          if (!usdaResult || !usdaResult.nutrientsPer100g) {
            console.log(`[NUTRITION] ❌ "${rawName}" → no USDA match found`);
            return { name: rawName, found: false };
          }

          const grams = toGrams(ing.amount, ing.unit, rawName);
          const scale = grams / 100;
          const scaled = {};
          for (const [key, valuePer100g] of Object.entries(usdaResult.nutrientsPer100g)) {
            scaled[key] = valuePer100g * scale;
          }

          console.log(`[NUTRITION] ✅ "${rawName}"`);
          console.log(`  Search term: "${usdaResult.searchTerm}"`);
          console.log(`  USDA match:  "${usdaResult.description}" (FDC#${usdaResult.fdcId})`);
          console.log(`  Quantity:    ${ing.amount || '?'} ${ing.unit || 'g'} → ${Math.round(grams)}g (scale: ${scale.toFixed(2)})`);
          console.log(`[NUTRITION-DEBUG] Scaled nutrients for "${rawName}" (${Math.round(grams)}g): calories=${(scaled.calories || 0).toFixed(1)}, protein=${(scaled.protein_g || 0).toFixed(1)}g, fat=${(scaled.total_fat_g || 0).toFixed(1)}g, carbs=${(scaled.carbohydrates_g || 0).toFixed(1)}g`);
          console.log(`[NUTRITION-DEBUG] Per-100g for "${rawName}": calories=${(usdaResult.nutrientsPer100g.calories || 0)}, protein=${(usdaResult.nutrientsPer100g.protein_g || 0)}g, fat=${(usdaResult.nutrientsPer100g.total_fat_g || 0)}g, carbs=${(usdaResult.nutrientsPer100g.carbohydrates_g || 0)}g`);

          return { name: rawName, found: true, matchedFood: usdaResult.description, searchTerm: usdaResult.searchTerm, grams: Math.round(grams), nutrients: scaled };
        } catch (err) {
          console.log(`[NUTRITION] ❌ "${rawName}" → error: ${err.message}`);
          return { name: rawName, found: false };
        }
      })
    );

    const totals = { calories: 0, protein_g: 0, total_fat_g: 0, saturated_fat_g: 0, carbohydrates_g: 0, fibre_g: 0, sugar_g: 0, sodium_mg: 0 };
    for (const r of results) {
      if (r.found && r.nutrients) {
        for (const key of Object.keys(totals)) {
          totals[key] += r.nutrients[key] || 0;
        }
      }
    }

    const perServing = {};
    for (const [key, val] of Object.entries(totals)) {
      perServing[key] = Math.round(val / numServings);
    }

    console.log(`[NUTRITION-DEBUG] === TOTALS (whole recipe): ${JSON.stringify(totals)}`);
    console.log(`[NUTRITION-DEBUG] === PER SERVING (÷${numServings}): ${JSON.stringify(perServing)}`);
    console.log(`[NUTRITION-DEBUG] Sanity check: protein(${perServing.protein_g})*4 + fat(${perServing.total_fat_g})*9 + carbs(${perServing.carbohydrates_g})*4 = ${(perServing.protein_g || 0) * 4 + (perServing.total_fat_g || 0) * 9 + (perServing.carbohydrates_g || 0) * 4} kcal (reported: ${perServing.calories} kcal)`);

    const notFound = results.filter(r => !r.found).map(r => r.name);
    console.log(`[NUTRITION] === Results: ${results.filter(r => r.found).length}/${results.length} matched, ${notFound.length} not found ===`);
    if (notFound.length > 0) {
      console.log(`[NUTRITION] Not found: ${notFound.join(', ')}`);
    }

    return res.status(200).json({
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
    });
  } catch (err) {
    console.error(`[NUTRITION] Fatal error: ${err.message}`);
    return res.status(500).json({ error: 'Failed to calculate nutrition' });
  }
});

// ==================== FAVOURITES & MEAL PLAN SYNC ====================

// GET /api/favourites — load favourites from server
app.get('/api/favourites', authMiddleware, (req, res) => {
  const user = getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ favourites: user.favourites || [] });
});

// PUT /api/favourites — save favourites to server
app.put('/api/favourites', authMiddleware, (req, res) => {
  const { favourites } = req.body;
  if (!Array.isArray(favourites)) {
    return res.status(400).json({ error: 'favourites must be an array' });
  }
  const updated = updateUser(req.userId, { favourites });
  if (!updated) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true, count: favourites.length });
});

// GET /api/meal-plan — load meal plan from server
app.get('/api/meal-plan', authMiddleware, (req, res) => {
  const user = getUser(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ mealPlan: user.mealPlan || {} });
});

// PUT /api/meal-plan — save meal plan to server
app.put('/api/meal-plan', authMiddleware, (req, res) => {
  const { mealPlan } = req.body;
  if (!mealPlan || typeof mealPlan !== 'object') {
    return res.status(400).json({ error: 'mealPlan must be an object' });
  }
  const updated = updateUser(req.userId, { mealPlan });
  if (!updated) return res.status(404).json({ error: 'User not found' });
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Chef Marco's kitchen is open on port ${PORT}`);
});
