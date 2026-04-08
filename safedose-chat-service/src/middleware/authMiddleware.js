// src/middleware/authMiddleware.js

import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  // Support both:
  //   Web app   → JWT in cookie (sent automatically by browser)
  //   Mobile app → JWT in Authorization: Bearer <token> header
  let token = null;

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Fallback: parse cookie manually (express doesn't parse cookies by default)
  if (!token && req.headers.cookie) {
    const cookies = Object.fromEntries(
      req.headers.cookie.split(';').map(c => {
        const [k, ...v] = c.trim().split('=');
        return [k.trim(), v.join('=')];
      })
    );
    token = cookies['safedose_token'] || null;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, email, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}