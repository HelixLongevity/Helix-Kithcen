import { authenticate } from './_utils/auth.js';
import { getSubscriptionInfo, getRecipeCount } from './_utils/users.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = authenticate(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const { stripeCustomerId, isAdmin } = auth.decoded;

  if (isAdmin) {
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

  const subInfo = await getSubscriptionInfo(stripeCustomerId);
  const recipeCount = await getRecipeCount(stripeCustomerId);

  res.json({
    tier: subInfo.tier,
    status: subInfo.subscriptionStatus,
    trialEnd: subInfo.trialEnd,
    currentPeriodEnd: subInfo.currentPeriodEnd,
    billingInterval: subInfo.billingInterval,
    recipesGeneratedThisMonth: recipeCount,
    recipeLimit: subInfo.tier === 'starter' ? 20 : null,
  });
}
