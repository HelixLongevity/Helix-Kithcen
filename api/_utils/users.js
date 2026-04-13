import { stripe } from './stripe.js';

/**
 * Returns true if the given email matches ADMIN_EMAIL AND the password
 * matches ADMIN_PASSWORD. Used only at login time.
 */
export function isAdminLogin(email, password) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  return (
    adminEmail && adminPassword &&
    email && password &&
    email.toLowerCase() === adminEmail.toLowerCase() &&
    password === adminPassword
  );
}

/**
 * Returns a subscription info object representing a full Performance tier
 * with no expiry, used for admin bypass.
 */
export function adminSubscriptionInfo() {
  return {
    tier: 'performance',
    subscriptionStatus: 'active',
    stripeSubscriptionId: 'admin_bypass',
    trialEnd: null,
    currentPeriodEnd: null,
    billingInterval: null,
  };
}

/**
 * Looks up a Stripe customer by email. Returns the first match or null.
 */
export async function findCustomerByEmail(email) {
  const customers = await stripe.customers.list({ email: email.toLowerCase(), limit: 1 });
  return customers.data[0] || null;
}

/**
 * Gets the active subscription and derives tier/status for a customer.
 * Returns { tier, subscriptionStatus, stripeSubscriptionId, trialEnd, currentPeriodEnd, billingInterval }
 */
export async function getSubscriptionInfo(customerId) {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 1,
    expand: ['data.items.data.price'],
  });

  const sub = subs.data[0];
  if (!sub) {
    return {
      tier: null,
      subscriptionStatus: null,
      stripeSubscriptionId: null,
      trialEnd: null,
      currentPeriodEnd: null,
      billingInterval: null,
    };
  }

  // Determine tier from price ID
  const priceId = sub.items.data[0]?.price?.id;
  let tier = null;
  const { TIERS } = await import('./tiers.js');
  for (const [key, config] of Object.entries(TIERS)) {
    if (priceId === config.monthlyPriceId || priceId === config.yearlyPriceId) {
      tier = key;
      break;
    }
  }

  const interval = sub.items.data[0]?.price?.recurring?.interval || null;

  return {
    tier,
    subscriptionStatus: sub.cancel_at_period_end ? 'canceling' : sub.status,
    stripeSubscriptionId: sub.id,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
    billingInterval: interval,
  };
}

/**
 * Gets recipe count from Stripe customer metadata, resetting if a new month.
 */
export async function getRecipeCount(customerId) {
  const customer = await stripe.customers.retrieve(customerId);
  const meta = customer.metadata || {};
  const resetDate = meta.recipesResetDate ? new Date(meta.recipesResetDate) : new Date(0);
  const now = new Date();

  let count = parseInt(meta.recipesGeneratedThisMonth || '0', 10);

  if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
    count = 0;
    await stripe.customers.update(customerId, {
      metadata: {
        recipesGeneratedThisMonth: '0',
        recipesResetDate: now.toISOString(),
      },
    });
  }

  return count;
}

/**
 * Increments the recipe count in Stripe customer metadata.
 */
export async function incrementRecipeCount(customerId) {
  const customer = await stripe.customers.retrieve(customerId);
  const meta = customer.metadata || {};
  const count = parseInt(meta.recipesGeneratedThisMonth || '0', 10) + 1;
  await stripe.customers.update(customerId, {
    metadata: {
      ...meta,
      recipesGeneratedThisMonth: String(count),
    },
  });
}

/**
 * Builds a safe user object for the client (no password hash).
 */
export function safeUser(customer, subInfo, recipeCount) {
  return {
    id: customer.id,
    name: customer.name || customer.metadata?.name || '',
    email: customer.email,
    createdAt: new Date(customer.created * 1000).toISOString(),
    stripeCustomerId: customer.id,
    ...subInfo,
    recipesGeneratedThisMonth: recipeCount,
    recipesResetDate: customer.metadata?.recipesResetDate || null,
  };
}
