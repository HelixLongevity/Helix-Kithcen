import bcrypt from 'bcryptjs';
import { stripe } from './_utils/stripe.js';
import { signToken } from './_utils/auth.js';
import { getSubscriptionInfo, getRecipeCount, isAdminLogin, adminSubscriptionInfo } from './_utils/users.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Admin check first — skip Stripe entirely for admin logins
  if (isAdminLogin(email, password)) {
    const token = signToken({
      stripeCustomerId: 'admin',
      email: email.toLowerCase(),
      name: 'Admin',
      isAdmin: true,
    });
    return res.json({
      token,
      user: {
        id: 'admin',
        name: 'Admin',
        email: email.toLowerCase(),
        createdAt: new Date().toISOString(),
        stripeCustomerId: 'admin',
        ...adminSubscriptionInfo(),
        recipesGeneratedThisMonth: 0,
      },
    });
  }

  const customers = await stripe.customers.list({ email: email.toLowerCase(), limit: 1 });
  const customer = customers.data[0];
  if (!customer) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const hashedPassword = customer.metadata?.hashedPassword;
  if (!hashedPassword) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, hashedPassword);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken({
    stripeCustomerId: customer.id,
    email: customer.email,
    name: customer.name || '',
  });
  const subInfo = await getSubscriptionInfo(customer.id);
  const recipeCount = await getRecipeCount(customer.id);

  res.json({
    token,
    user: {
      id: customer.id,
      name: customer.name || '',
      email: customer.email,
      createdAt: new Date(customer.created * 1000).toISOString(),
      stripeCustomerId: customer.id,
      ...subInfo,
      recipesGeneratedThisMonth: recipeCount,
    },
  });
}
