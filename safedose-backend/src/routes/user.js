import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import User from '../models/User.js';

const router = Router();

router.use(requireAuth);

// GET /api/user/profile
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user });
  } catch (error) {
    console.error('[GET PROFILE]', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/user/profile
router.put('/profile', async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({ user });
  } catch (error) {
    console.error('[PUT PROFILE]', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/user/notifications
router.patch('/notifications', async (req, res) => {
  try {
    const { email, desktop } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { 'notifications.email': !!email, 'notifications.desktop': !!desktop } },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ notifications: user.notifications });
  } catch (error) {
    console.error('[PATCH NOTIFICATIONS]', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
