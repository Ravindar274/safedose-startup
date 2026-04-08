// src/routes/auth.js

import { Router } from 'express';
import User from '../models/User.js';
import { signToken } from '../lib/jwt.js';

const router = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days in ms
  secure: process.env.NODE_ENV === 'production',
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword, role } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const allowedRoles = ['admin', 'patient', 'caregiver'];
    const assignedRole = allowedRoles.includes(role?.toLowerCase())
      ? role.toLowerCase()
      : 'patient';

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const user = await User.create({ firstName, lastName, email, password, role: assignedRole });

    return res.status(201).json({ message: 'Account created successfully.', userId: user._id });
  } catch (err) {
    console.error('[REGISTER ERROR]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken({
      userId: user._id.toString(),
      email:  user.email,
      role:   user.role,
    });

    res.cookie('safedose_token', token, COOKIE_OPTS);

    return res.json({
      message: 'Login successful.',
      role: user.role,
      user: {
        id:        user._id,
        firstName: user.firstName,
        lastName:  user.lastName,
        email:     user.email,
        role:      user.role,
      },
    });
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('safedose_token', { path: '/' });
  return res.json({ message: 'Logged out.' });
});

export default router;
