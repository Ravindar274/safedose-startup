// src/routes/admin.js

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import User             from '../models/User.js';
import Patient          from '../models/Patient.js';
import CaregiverProfile from '../models/CaregiverProfile.js';
import Medication       from '../models/Medication.js';
import Assignment       from '../models/Assignment.js';
import DailyAdherence   from '../models/DailyAdherence.js';
import { sendEmail }    from '../lib/sendEmail.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

// ── GET /api/admin/stats ──────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [totalCaregivers, totalPatients, totalUsers, pendingCaregivers] = await Promise.all([
      User.countDocuments({ role: 'caregiver' }),
      Patient.countDocuments({}),
      User.countDocuments({ role: { $ne: 'admin' } }),
      User.countDocuments({ role: 'caregiver', status: 'pending' }),
    ]);
    return res.json({ totalCaregivers, totalPatients, totalUsers, pendingCaregivers });
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
      const [patientCount, profile] = await Promise.all([
        Assignment.countDocuments({ caregiverId: cg._id }),
        CaregiverProfile.findOne({ userId: cg._id }).lean(),
      ]);
      return {
        ...cg,
        patientCount,
        caregiverProfile: profile ? {
          dateOfBirth:    profile.dateOfBirth,
          gender:         profile.gender,
          qualification:  profile.qualification,
          experienceYears: profile.experienceYears,
          specialization: profile.specialization,
          availability:   profile.availability,
          licenseId:      profile.licenseId,
          languagesSpoken: profile.languagesSpoken,
        } : null,
      };
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

    // Notify caregiver of approval or rejection
    const APP_URL = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
    if (status === 'active') {
      sendEmail(user.email, '✅ SafeDose: Your account has been approved!', buildApprovedEmail(user.firstName, APP_URL)).catch(() => {});
    } else if (status === 'rejected') {
      sendEmail(user.email, '❌ SafeDose: Account application update', buildRejectedEmail(user.firstName, APP_URL)).catch(() => {});
    }

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

// ── Email template helpers ────────────────────────────────────

function emailShell(headerSub, bodyHtml, appUrl) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#0d9488;padding:24px 32px;">
        <p style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;">💊 SafeDose</p>
        <p style="margin:4px 0 0;color:#ccfbf1;font-size:13px;">${headerSub}</p>
      </td></tr>
      <tr><td style="padding:32px;">${bodyHtml}</td></tr>
      <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">SafeDose — Medication Safety Assistant &nbsp;|&nbsp; <a href="${appUrl}" style="color:#0d9488;text-decoration:none;">Open Dashboard</a></p>
        <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">Do not reply to this email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function buildApprovedEmail(firstName, appUrl) {
  const body = `
    <p style="margin:0 0 8px;font-size:16px;color:#111827;font-weight:bold;">Great news, ${firstName}!</p>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;">Your SafeDose caregiver account has been <strong style="color:#059669;">approved</strong> by our admin team. You can now log in and start managing your patients.</p>
    <table style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;width:100%;margin:0 0 24px;" cellpadding="14" cellspacing="0">
      <tr><td>
        <p style="margin:0;font-size:14px;color:#065f46;font-weight:bold;">✅ What you can do now:</p>
        <ul style="margin:8px 0 0;padding-left:18px;font-size:13px;color:#065f46;line-height:2;">
          <li>Add and manage your patients</li>
          <li>Track medication adherence</li>
          <li>Accept hire requests from patients</li>
        </ul>
      </td></tr>
    </table>
    <a href="${appUrl}/caregiver/dashboard" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;text-decoration:none;">Go to my dashboard →</a>`;
  return emailShell('Account Approved', body, `${appUrl}/caregiver/dashboard`);
}

function buildRejectedEmail(firstName, appUrl) {
  const body = `
    <p style="margin:0 0 8px;font-size:16px;color:#111827;font-weight:bold;">Hello ${firstName},</p>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;">After reviewing your application, we are unable to approve your SafeDose caregiver account at this time.</p>
    <table style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;width:100%;margin:0 0 20px;" cellpadding="14" cellspacing="0">
      <tr><td>
        <p style="margin:0;font-size:13px;color:#991b1b;">This may be due to incomplete credentials, an unverifiable license ID, or other compliance requirements. If you believe this is an error, please contact our support team.</p>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#6b7280;">You may re-register with updated information or reach out to us for clarification.</p>`;
  return emailShell('Account Application Update', body, appUrl);
}

export default router;
