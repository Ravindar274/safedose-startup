// src/routes/push.js
// Saves/removes Web Push subscriptions in the role-specific profile collection.

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import Patient          from '../models/Patient.js';
import CaregiverProfile from '../models/CaregiverProfile.js';

const router = Router();
router.use(requireAuth);

// POST /api/push/subscribe — save push subscription for this user
router.post('/subscribe', async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ error: 'No subscription provided.' });

    const { role, userId } = req.user;
    if (role === 'patient') {
      await Patient.findOneAndUpdate({ linkedUserId: userId }, { $set: { pushSubscription: subscription } });
    } else if (role === 'caregiver') {
      await CaregiverProfile.findOneAndUpdate({ userId }, { $set: { pushSubscription: subscription } });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[PUSH SUBSCRIBE]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/push/subscribe — remove push subscription
router.delete('/subscribe', async (req, res) => {
  try {
    const { role, userId } = req.user;
    if (role === 'patient') {
      await Patient.findOneAndUpdate({ linkedUserId: userId }, { $unset: { pushSubscription: '' } });
    } else if (role === 'caregiver') {
      await CaregiverProfile.findOneAndUpdate({ userId }, { $unset: { pushSubscription: '' } });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[PUSH UNSUBSCRIBE]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
