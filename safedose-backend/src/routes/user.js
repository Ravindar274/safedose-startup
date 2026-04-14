// src/routes/user.js
// Unified profile API — returns User + role-specific profile merged together.
// Consumers see one "user" object that includes notifications, dateOfBirth, etc.

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import User             from '../models/User.js';
import Patient          from '../models/Patient.js';
import CaregiverProfile from '../models/CaregiverProfile.js';

const router = Router();
router.use(requireAuth);

// ── Helper: fetch the role-specific profile ───────────────────
async function getProfile(userId, role) {
  if (role === 'patient')   return Patient.findOne({ linkedUserId: userId }).lean();
  if (role === 'caregiver') return CaregiverProfile.findOne({ userId }).lean();
  return null;
}

// ── Helper: build the merged "user" object ────────────────────
// Combines lean User fields with role-specific profile so all
// consumers (including NotificationBell) work with one shape.
function mergeUserWithProfile(user, profile, role) {
  const base = {
    _id:       user._id,
    id:        user._id,
    firstName: user.firstName,
    lastName:  user.lastName,
    email:     user.email,
    role:      user.role,
    status:    user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    notifications: profile?.notifications ?? { email: false, desktop: false },
  };

  if (role === 'patient' && profile) {
    base.profileId   = profile._id;
    base.dateOfBirth = profile.dateOfBirth;
    base.gender      = profile.gender;
    base.notes       = profile.notes;
  }

  if (role === 'caregiver' && profile) {
    base.profileId       = profile._id;
    base.dateOfBirth     = profile.dateOfBirth;
    base.gender          = profile.gender;
    base.caregiverProfile = {
      qualification:   profile.qualification,
      experienceYears: profile.experienceYears,
      specialization:  profile.specialization,
      availability:    profile.availability,
      licenseId:       profile.licenseId,
      languagesSpoken: profile.languagesSpoken,
    };
  }

  return base;
}

// ─────────────────────────────────────────────────────────────
// GET /api/user/profile
// Returns User merged with the role-specific profile.
// ─────────────────────────────────────────────────────────────
router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const profile = await getProfile(req.user.userId, user.role);
    return res.json({ user: mergeUserWithProfile(user, profile, user.role) });
  } catch (err) {
    console.error('[GET PROFILE]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/user/profile
// Updates User identity fields (firstName, lastName, email).
// Also keeps the Patient document in sync for patient users.
// ─────────────────────────────────────────────────────────────
router.put('/profile', async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName)  updateData.lastName  = lastName;
    if (email)     updateData.email     = email;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password').lean();

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Keep Patient document name/email in sync
    if (user.role === 'patient') {
      const syncFields = {};
      if (firstName) syncFields.firstName = firstName;
      if (lastName)  syncFields.lastName  = lastName;
      if (email)     syncFields.email     = email;
      if (Object.keys(syncFields).length) {
        await Patient.findOneAndUpdate({ linkedUserId: req.user.userId }, { $set: syncFields });
      }
    }

    const profile = await getProfile(req.user.userId, user.role);
    return res.json({ user: mergeUserWithProfile(user, profile, user.role) });
  } catch (err) {
    console.error('[PUT PROFILE]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/user/profile/details
// Updates role-specific profile fields:
//   patients  — dateOfBirth, gender, notes
//   caregivers — dateOfBirth, gender, qualification, experienceYears,
//                specialization, availability, licenseId, languagesSpoken
// ─────────────────────────────────────────────────────────────
router.put('/profile/details', async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const {
      dateOfBirth, gender, notes,
      qualification, experienceYears, specialization, availability, licenseId, languagesSpoken,
    } = req.body;

    let profile;

    if (user.role === 'patient') {
      const fields = {};
      if (dateOfBirth !== undefined) fields.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
      if (gender      !== undefined) fields.gender      = gender;
      if (notes       !== undefined) fields.notes       = notes;
      profile = await Patient.findOneAndUpdate(
        { linkedUserId: req.user.userId },
        { $set: fields },
        { new: true, upsert: true }
      ).lean();
    } else if (user.role === 'caregiver') {
      const fields = {};
      if (dateOfBirth     !== undefined) fields.dateOfBirth     = dateOfBirth ? new Date(dateOfBirth) : null;
      if (gender          !== undefined) fields.gender          = gender;
      if (qualification   !== undefined) fields.qualification   = qualification;
      if (experienceYears !== undefined) fields.experienceYears = experienceYears ? Number(experienceYears) : null;
      if (specialization  !== undefined) fields.specialization  = specialization;
      if (availability    !== undefined) fields.availability    = availability;
      if (licenseId       !== undefined) fields.licenseId       = licenseId;
      if (languagesSpoken !== undefined) fields.languagesSpoken = languagesSpoken;
      profile = await CaregiverProfile.findOneAndUpdate(
        { userId: req.user.userId },
        { $set: fields },
        { new: true, upsert: true }
      ).lean();
    }

    return res.json({ user: mergeUserWithProfile(user, profile, user.role) });
  } catch (err) {
    console.error('[PUT PROFILE DETAILS]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/user/notifications
// Saves email/desktop preferences in the role-specific profile.
// ─────────────────────────────────────────────────────────────
router.patch('/notifications', async (req, res) => {
  try {
    const { email, desktop } = req.body;
    const { role, userId } = req.user;
    const update = { $set: { 'notifications.email': !!email, 'notifications.desktop': !!desktop } };

    let profile;
    if (role === 'patient') {
      profile = await Patient.findOneAndUpdate({ linkedUserId: userId }, update, { new: true }).lean();
    } else if (role === 'caregiver') {
      profile = await CaregiverProfile.findOneAndUpdate({ userId }, update, { new: true }).lean();
    }

    return res.json({ notifications: profile?.notifications ?? { email: false, desktop: false } });
  } catch (err) {
    console.error('[PATCH NOTIFICATIONS]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
