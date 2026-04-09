// src/routes/admin.js

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import User          from '../models/User.js';
import Patient       from '../models/Patient.js';
import Medication    from '../models/Medication.js';
import Assignment    from '../models/Assignment.js';
import DailyAdherence from '../models/DailyAdherence.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// ── GET /api/admin/stats ──────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [totalCaregivers, totalPatients, totalUsers] = await Promise.all([
      User.countDocuments({ role: 'caregiver' }),
      Patient.countDocuments({}),
      User.countDocuments({ role: { $ne: 'admin' } }),
    ]);
    return res.json({ totalCaregivers, totalPatients, totalUsers });
  } catch (err) {
    console.error('[ADMIN STATS]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/admin/caregivers ─────────────────────────────────
router.get('/caregivers', async (req, res) => {
  try {
    const caregivers = await User.find({ role: 'caregiver' }).select('-password').lean();

    const result = await Promise.all(caregivers.map(async cg => {
      const patientCount = await Assignment.countDocuments({ caregiverId: cg._id });
      return { ...cg, patientCount };
    }));

    return res.json({ caregivers: result });
  } catch (err) {
    console.error('[ADMIN GET CAREGIVERS]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── PUT /api/admin/caregivers/:id ─────────────────────────────
router.put('/caregivers/:id', async (req, res) => {
  try {
    const { firstName, lastName, email } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: { firstName, lastName, email } },
      { new: true, runValidators: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user });
  } catch (err) {
    console.error('[ADMIN PUT CAREGIVER]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── PUT /api/admin/caregivers/:id/status ──────────────────────
router.put('/caregivers/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'pending', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json({ user });
  } catch (err) {
    console.error('[ADMIN PUT CAREGIVER STATUS]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── DELETE /api/admin/caregivers/:id ──────────────────────────
router.delete('/caregivers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Assignment.deleteMany({ caregiverId: id });
    await User.findByIdAndDelete(id);
    return res.json({ message: 'Caregiver deleted.' });
  } catch (err) {
    console.error('[ADMIN DELETE CAREGIVER]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/admin/patients ───────────────────────────────────
router.get('/patients', async (req, res) => {
  try {
    const patients = await Patient.find({}).lean();

    const result = await Promise.all(patients.map(async p => {
      const [medCount, caregiverCount, linkedUser] = await Promise.all([
        Medication.countDocuments({ patientId: p._id, status: { $ne: 'stopped' } }),
        Assignment.countDocuments({ patientId: p._id }),
        p.linkedUserId ? User.findById(p.linkedUserId).select('email').lean() : null,
      ]);
      return {
        ...p,
        medCount,
        caregiverCount,
        linkedEmail: linkedUser?.email || null,
      };
    }));

    return res.json({ patients: result });
  } catch (err) {
    console.error('[ADMIN GET PATIENTS]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── PUT /api/admin/patients/:id ───────────────────────────────
router.put('/patients/:id', async (req, res) => {
  try {
    const { firstName, lastName, email, dateOfBirth, notes } = req.body;
    const patient = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: { firstName, lastName, email, dateOfBirth, notes } },
      { new: true, runValidators: false }
    );
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });
    return res.json({ patient });
  } catch (err) {
    console.error('[ADMIN PUT PATIENT]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── DELETE /api/admin/patients/:id ───────────────────────────
router.delete('/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Promise.all([
      Medication.deleteMany({ patientId: id }),
      Assignment.deleteMany({ patientId: id }),
      DailyAdherence.deleteMany({ patientId: id }),
    ]);
    await Patient.findByIdAndDelete(id);
    return res.json({ message: 'Patient deleted.' });
  } catch (err) {
    console.error('[ADMIN DELETE PATIENT]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
