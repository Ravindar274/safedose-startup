// src/middleware/auth.js

import { verifyToken } from '../lib/jwt.js';

/**
 * Requires a valid safedose_token cookie.
 * Attaches decoded payload to req.user.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.safedose_token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * Restricts access to specific roles.
 * Must be used after requireAuth.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
