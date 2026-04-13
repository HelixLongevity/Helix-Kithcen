import { authenticate } from './_utils/auth.js';
import { stripe } from './_utils/stripe.js';
import { getSubscriptionInfo, getRecipeCount, safeUser, adminSubscriptionInfo } from './_utils/users.js';

async function handleFeedback(req, res, auth) {
  const { type, section, feedback } = req.body || {};

  if (!feedback || typeof feedback !== 'string' || feedback.trim().length < 10) {
    return res.status(400).json({ error: 'Feedback must be at least 10 characters' });
  }

  const { email, name, stripeCustomerId, isAdmin } = auth.decoded;

  // Determine subscription tier
  let tier = 'admin';
  if (!isAdmin) {
    try {
      const subInfo = await getSubscriptionInfo(stripeCustomerId);
      tier = subInfo.tier || 'unknown';
    } catch {
      tier = 'unknown';
    }
  }

  const timestamp = new Date().toISOString();

  // Write to Notion
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) {
    return res.status(500).json({ error: 'Feedback service not configured' });
  }

  try {
    await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        parent: { database_id: '451bd79f-58c4-48f4-8449-012012c7efcc' },
        properties: {
          Feedback: { title: [{ text: { content: feedback.trim().slice(0, 100) } }] },
          Type: { select: { name: type || 'General Feedback' } },
          'App Section': { select: { name: section || 'General' } },
          'User Email': { email: email },
          'User Name': { rich_text: [{ text: { content: name || '' } }] },
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
      }),
    });
  } catch (err) {
    console.error('Notion write failed:', err);
    return res.status(500).json({ error: 'Failed to save feedback' });
  }

  // Send n8n webhook (non-blocking)
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
          userName: name || '',
          userEmail: email,
          subscriptionTier: tier,
          timestamp,
        }),
      });
    } catch (err) {
      console.error('n8n webhook failed:', err);
      // Don't block — Notion write already succeeded
    }
  }

  return res.status(200).json({ success: true });
}

export default async function handler(req, res) {
  const auth = authenticate(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  // POST /api/me with action=feedback in body
  if (req.method === 'POST' && (req.body?.action === 'feedback' || req.query?.action === 'feedback')) {
    return handleFeedback(req, res, auth);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { stripeCustomerId, email, name, isAdmin } = auth.decoded;

  if (isAdmin) {
    return res.json({
      user: {
        id: 'admin',
        name: name || 'Admin',
        email,
        createdAt: new Date().toISOString(),
        stripeCustomerId: 'admin',
        ...adminSubscriptionInfo(),
        recipesGeneratedThisMonth: 0,
        recipesResetDate: null,
      },
    });
  }

  try {
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    if (customer.deleted) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subInfo = await getSubscriptionInfo(stripeCustomerId);
    const recipeCount = await getRecipeCount(stripeCustomerId);

    res.json({ user: safeUser(customer, subInfo, recipeCount) });
  } catch {
    return res.status(404).json({ error: 'User not found' });
  }
}
