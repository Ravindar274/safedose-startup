// lib/jwt-edge.js
// Uses `jose` which is Edge runtime compatible.
// Import THIS file in middleware.js, NOT lib/jwt.js

import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

/**
 * Verify a JWT token in Edge runtime (middleware).
 * Returns the decoded payload or null if invalid.
 */
export async function verifyTokenEdge(token) {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}