import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'helix-kitchen-fallback-secret';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

/**
 * Extracts and verifies the JWT from the Authorization header.
 * Returns { decoded } on success or { error, status } on failure.
 */
export function authenticate(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return { error: 'Unauthorized', status: 401 };
  }
  try {
    const decoded = verifyToken(header.split(' ')[1]);
    return { decoded };
  } catch {
    return { error: 'Invalid token', status: 401 };
  }
}
