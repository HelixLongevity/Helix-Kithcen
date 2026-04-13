import bcrypt from 'bcryptjs';
import { stripe } from './_utils/stripe.js';
import { signToken } from './_utils/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  // Check if a customer with this email already exists
  const existing = await stripe.customers.list({ email: email.toLowerCase(), limit: 1 });
  if (existing.data.length > 0) {
    return res.status(400).json({ error: 'An account with this email already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Create Stripe customer — store hashed password and name in metadata
  const customer = await stripe.customers.create({
    email: email.toLowerCase(),
    name,
    metadata: {
      hashedPassword,
      recipesGeneratedThisMonth: '0',
      recipesResetDate: new Date().toISOString(),
    },
  });

  const token = signToken({ stripeCustomerId: customer.id, email: customer.email, name });

  res.json({
    token,
    user: {
      id: customer.id,
      name,
      email: customer.email,
      createdAt: new Date(customer.created * 1000).toISOString(),
      tier: null,
      subscriptionStatus: null,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: null,
      trialEnd: null,
      currentPeriodEnd: null,
      billingInterval: null,
      recipesGeneratedThisMonth: 0,
      recipesResetDate: new Date().toISOString(),
    },
  });
}
