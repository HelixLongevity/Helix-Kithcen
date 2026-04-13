import { authenticate } from './_utils/auth.js';
import { stripe } from './_utils/stripe.js';
import { TIERS } from './_utils/tiers.js';

async function handleCreate(req, res, auth) {
  const { stripeCustomerId, isAdmin } = auth.decoded;

  if (isAdmin) {
    return res.json({ subscriptionId: 'admin_bypass', status: 'active', clientSecret: null });
  }

  const { tier, interval, paymentMethodId } = req.body;

  if (!tier || !TIERS[tier]) {
    return res.status(400).json({ error: 'Invalid tier' });
  }
  if (!['month', 'year'].includes(interval)) {
    return res.status(400).json({ error: 'Invalid interval' });
  }

  try {
    // Attach payment method
    await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
    await stripe.customers.update(stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const tierConfig = TIERS[tier];
    const priceId = interval === 'month' ? tierConfig.monthlyPriceId : tierConfig.yearlyPriceId;

    // Cancel existing subscription if any
    const existingSubs = await stripe.subscriptions.list({ customer: stripeCustomerId, status: 'active', limit: 1 });
    if (existingSubs.data[0]) {
      try {
        await stripe.subscriptions.cancel(existingSubs.data[0].id);
      } catch { /* ignore if already cancelled */ }
    }

    // Create subscription with 7-day trial
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      trial_period_days: 7,
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent'],
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
}

async function handleChange(req, res, auth) {
  const { stripeCustomerId, isAdmin } = auth.decoded;

  if (isAdmin) {
    return res.json({ status: 'active' });
  }

  const { tier, interval } = req.body;

  const tierConfig = TIERS[tier];
  if (!tierConfig) {
    return res.status(400).json({ error: 'Invalid tier' });
  }

  // Find the active subscription
  const subs = await stripe.subscriptions.list({ customer: stripeCustomerId, status: 'all', limit: 1 });
  const sub = subs.data[0];
  if (!sub) {
    return res.status(400).json({ error: 'No active subscription' });
  }

  try {
    const priceId = interval === 'month' ? tierConfig.monthlyPriceId : tierConfig.yearlyPriceId;

    const updated = await stripe.subscriptions.update(sub.id, {
      items: [{ id: sub.items.data[0].id, price: priceId }],
      proration_behavior: 'create_prorations',
    });

    res.json({ status: updated.status });
  } catch (err) {
    console.error('Change subscription error:', err);
    res.status(500).json({ error: err.message || 'Failed to change subscription' });
  }
}

async function handleCancel(req, res, auth) {
  const { stripeCustomerId, isAdmin } = auth.decoded;

  if (isAdmin) {
    return res.status(400).json({ error: 'Admin account cannot be cancelled' });
  }

  // Find the active subscription
  const subs = await stripe.subscriptions.list({ customer: stripeCustomerId, status: 'all', limit: 1 });
  const sub = subs.data[0];
  if (!sub) {
    return res.status(400).json({ error: 'No active subscription' });
  }

  try {
    const updated = await stripe.subscriptions.update(sub.id, {
      cancel_at_period_end: true,
    });

    res.json({
      status: 'canceling',
      cancelAt: updated.cancel_at ? new Date(updated.cancel_at * 1000).toISOString() : null,
    });
  } catch (err) {
    console.error('Cancel error:', err);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = authenticate(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const action = req.query.action || req.body?.action;

  switch (action) {
    case 'create':
      return handleCreate(req, res, auth);
    case 'change':
      return handleChange(req, res, auth);
    case 'cancel':
      return handleCancel(req, res, auth);
    default:
      return res.status(400).json({ error: 'Invalid action. Use action=create, action=change, or action=cancel' });
  }
}
