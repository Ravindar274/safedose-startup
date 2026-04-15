// src/routes/patient.js

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth, requireRole } from '../middleware/auth.js';
import Patient          from '../models/Patient.js';
import Medication       from '../models/Medication.js';
import User             from '../models/User.js';
import Assignment       from '../models/Assignment.js';
import CaregiverRequest from '../models/CaregiverRequest.js';
import CaregiverProfile from '../models/CaregiverProfile.js';
import { getPatientAdherenceSummary } from '../lib/adherence.js';
import { searchOpenFDADrugs } from '../lib/openfda.js';
import { sendEmail } from '../lib/sendEmail.js';

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/patient/mark-taken?token=xxx  (no auth — token IS the auth)
// Called when patient clicks "Mark as Taken" in an email.
// Marks the dose, then redirects to the dashboard.
// ─────────────────────────────────────────────────────────────
router.get('/mark-taken', async (req, res) => {
  const APP_URL = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
  try {
    const { token } = req.query;
    if (!token) return res.redirect(`${APP_URL}/patient/dashboard`);

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.redirect(`${APP_URL}/patient/dashboard`);
    }

    const { medicationId, doseIndex, date } = payload;
    const today = new Date().toISOString().slice(0, 10);

    // Only accept tokens for today (prevents replaying yesterday's link)
    if (date !== today) return res.redirect(`${APP_URL}/patient/dashboard`);

    const med = await Medication.findById(medicationId);
    if (!med) return res.redirect(`${APP_URL}/patient/dashboard`);

    const takenSet = parseTakenToday(med.takenDoses);
    if (!takenSet.has(doseIndex)) {
      takenSet.add(doseIndex);
      med.takenDoses = `${today}:${[...takenSet].sort().join(',')}`;
      await med.save();
    }

    return res.redirect(`${APP_URL}/patient/dashboard`);
  } catch (err) {
    console.error('[MARK TAKEN EMAIL]', err);
    return res.redirect(`${APP_URL}/patient/dashboard`);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/patient/caregiver-invitation?token=xxx&action=accept|decline
// No auth required — token IS the auth.
// Called when a caregiver clicks Accept / Decline in the invitation email.
// ─────────────────────────────────────────────────────────────
router.get('/caregiver-invitation', async (req, res) => {
  const APP_URL = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
  try {
    const { token, action } = req.query;
    if (!token || !['accept', 'decline'].includes(action)) {
      return res.redirect(`${APP_URL}/caregiver/dashboard`);
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.redirect(`${APP_URL}/caregiver/dashboard`);
    }

    const { requestId, caregiverId } = payload;
    const request = await CaregiverRequest.findOne({ _id: requestId, caregiverId });
    if (!request || request.status !== 'pending') {
      return res.redirect(`${APP_URL}/caregiver/dashboard`);
    }

    if (action === 'decline') {
      request.status = 'declined';
      await request.save();
      return res.redirect(`${APP_URL}/caregiver/dashboard?invitation=declined`);
    }

    // Accept: find/create Patient record and create Assignment
    request.status = 'accepted';
    await request.save();

    let patient = await Patient.findOne({ linkedUserId: request.patientUserId });
    if (!patient) {
      const patientUser = await User.findById(request.patientUserId);
      if (patientUser) {
        patient = await Patient.create({
          linkedUserId: request.patientUserId,
          firstName:    patientUser.firstName,
          lastName:     patientUser.lastName,
          email:        patientUser.email,
        });
      }
    }

    if (patient) {
      const existing = await Assignment.findOne({ caregiverId, patientId: patient._id });
      if (!existing) {
        await Assignment.create({ caregiverId, patientId: patient._id, role: 'caregiver' });
      }
    }

    return res.redirect(`${APP_URL}/caregiver/dashboard?invitation=accepted`);
  } catch (err) {
    console.error('[CAREGIVER INVITATION]', err);
    return res.redirect(`${process.env.CLIENT_ORIGIN || 'http://localhost:3000'}/caregiver/dashboard`);
  }
});

router.use(requireAuth, requireRole('patient'));

// ── Helper: find or create the Patient record for this user ──
// A registered patient may not have a Patient doc yet (if they
// signed up directly without a caregiver linking them first).
async function getOrCreatePatient(userId) {
  let patient = await Patient.findOne({ linkedUserId: userId });
  if (!patient) {
    const user = await User.findById(userId);
    patient = await Patient.create({
      linkedUserId: userId,
      firstName:    user ? user.firstName : '',
      lastName:     user ? user.lastName  : '',
      email:        user ? user.email     : '',
    });
  }
  return patient;
}

// ── Helper: parse today's taken indices from takenDoses string ──
function parseTakenToday(takenDoses) {
  if (!takenDoses) return new Set();
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const [datePart, indicesPart] = takenDoses.split(':');
  if (datePart !== today || !indicesPart) return new Set();
  return new Set(indicesPart.split(',').map(Number));
}

// ── Helper: how many doses per day for a given frequency ──
function doseCount(frequency) {
  const map = {
    'once daily':        1,
    'twice daily':       2,
    'three times daily': 3,
    'four times daily':  4,
  };
  return map[frequency] ?? 1;
}

// ─────────────────────────────────────────────────────────────
// GET /api/patient/drugs
// Search OpenFDA by brand or generic name for patient add flow.
// ─────────────────────────────────────────────────────────────
router.get('/drugs', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const { drugs, total } = await searchOpenFDADrugs(q, req.query.skip, req.query.limit);
    return res.json({ drugs, total });
  } catch (err) {
    console.error('[GET PATIENT DRUGS]', err);
    return res.status(502).json({ error: 'OpenFDA request failed.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/patient/adherence
// Returns historical adherence trends for the logged-in patient.
// ─────────────────────────────────────────────────────────────
router.get('/adherence', async (req, res) => {
  try {
    const patient = await getOrCreatePatient(req.user.userId);
    const summary = await getPatientAdherenceSummary(patient._id, req.query.days);
    return res.json(summary);
  } catch (err) {
    console.error('[GET PATIENT ADHERENCE]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/patient/medications/today
// Returns all medications active today, each with a `takenToday`
// boolean array (one entry per dose index).
// ─────────────────────────────────────────────────────────────
router.get('/medications/today', async (req, res) => {
  try {
    const patient = await getOrCreatePatient(req.user.userId);

    const today     = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow  = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const medications = await Medication.find({
      patientId: patient._id,
      status:    { $ne: 'stopped' },
      startDate: { $lte: tomorrow },
      $or: [
        { isOngoing: true },
        { endDate: { $gte: today } },
      ],
    }).sort({ 'scheduleTimes.0': 1 });

    const result = medications.filter(med => {
      if (!med.startDate) return true;
      // Database saves YYYY-MM-DD as UTC midnight. Reconstruct as local midnight for correct comparison.
      const start = new Date(med.startDate.getUTCFullYear(), med.startDate.getUTCMonth(), med.startDate.getUTCDate());
      
      const todayMs = today.getTime();
      const startMs = start.getTime();
      
      if (todayMs < startMs) return false;
      
      const diffDays = Math.floor((todayMs - startMs) / (1000 * 60 * 60 * 24));
      if (med.frequency === 'once every 2 days' && diffDays % 2 !== 0) return false;
      if (med.frequency === 'once every 3 days' && diffDays % 3 !== 0) return false;
      if (med.frequency === 'once in a week' && diffDays % 7 !== 0) return false;
      
      return true;
    }).map(med => {
      const takenSet = parseTakenToday(med.takenDoses);
      const count    = doseCount(med.frequency);
      const takenToday = Array.from({ length: count }, (_, i) => takenSet.has(i));

      return {
        _id:          med._id,
        name:         med.name,
        genericName:  med.genericName,
        dosage:       med.dosage,
        frequency:    med.frequency,
        scheduleTimes:med.scheduleTimes,
        status:       med.status,
        isOngoing:    med.isOngoing,
        startDate:    med.startDate,
        endDate:      med.endDate,
        takenToday,           // e.g. [true, false] for twice daily
        allTaken: takenToday.every(Boolean),
      };
    });

    return res.json({ medications: result });
  } catch (err) {
    console.error('[GET TODAY MEDS]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/patient/medications
// Returns all medications for the logged-in patient.
// ─────────────────────────────────────────────────────────────
router.get('/medications', async (req, res) => {
  try {
    const patient = await getOrCreatePatient(req.user.userId);
    const medications = await Medication.find({ patientId: patient._id }).sort({ startDate: -1 });
    return res.json({ medications });
  } catch (err) {
    console.error('[GET ALL MEDS]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/patient/medications
// Add a new medication for the logged-in patient.
// ─────────────────────────────────────────────────────────────
router.post('/medications', async (req, res) => {
  try {
    const {
      selectedDrug, dosage, frequency,
      scheduleTimes, isOngoing, startDate, endDate,
    } = req.body;

    if (!selectedDrug?.brandName || !dosage || !frequency || !scheduleTimes || !scheduleTimes.length) {
      return res.status(400).json({ error: 'All required fields must be filled.' });
    }

    const patient = await getOrCreatePatient(req.user.userId);

    const medication = await Medication.create({
      patientId:    patient._id,
      addedBy:      req.user.userId,
      name:         selectedDrug.brandName,
      genericName:  selectedDrug.genericName || selectedDrug.brandName,
      dosage,
      frequency,
      scheduleTimes,
      rxcui:        selectedDrug.rxcui || '',
      isOngoing:    isOngoing ?? true,
      startDate:    startDate   ? new Date(startDate)  : new Date(),
      endDate:      (!isOngoing && endDate) ? new Date(endDate) : null,
    });

    // Keep patient.medications count in sync
    await Patient.findByIdAndUpdate(patient._id, { $inc: { medications: 1 } });

    return res.status(201).json({ medication });
  } catch (err) {
    console.error('[POST MED]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/patient/medications/:id/taken
// Toggle a specific dose index as taken/untaken for today.
// Body: { doseIndex: 0 }  (defaults to 0 if omitted)
// ─────────────────────────────────────────────────────────────
router.patch('/medications/:id/taken', async (req, res) => {
  try {
    const patient = await getOrCreatePatient(req.user.userId);
    const med = await Medication.findOne({ _id: req.params.id, patientId: patient._id });
    if (!med) return res.status(404).json({ error: 'Medication not found.' });

    const doseIndex = req.body.doseIndex ?? 0;
    const today     = new Date().toISOString().slice(0, 10);
    const takenSet  = parseTakenToday(med.takenDoses);

    if (takenSet.has(doseIndex)) {
      takenSet.delete(doseIndex);
    } else {
      takenSet.add(doseIndex);
    }

    med.takenDoses = takenSet.size > 0
      ? `${today}:${[...takenSet].sort().join(',')}`
      : null;

    await med.save();

    const count      = doseCount(med.frequency);
    const takenToday = Array.from({ length: count }, (_, i) => takenSet.has(i));

    return res.json({
      takenToday,
      allTaken: takenToday.every(Boolean),
    });
  } catch (err) {
    console.error('[PATCH TAKEN]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/patient/medications/:id
// Edit a medication
// ─────────────────────────────────────────────────────────────
router.put('/medications/:id', async (req, res) => {
  try {
    const patient = await getOrCreatePatient(req.user.userId);
    const { dosage, frequency, scheduleTimes, isOngoing, startDate, endDate } = req.body;

    const med = await Medication.findOne({ _id: req.params.id, patientId: patient._id });
    if (!med) return res.status(404).json({ error: 'Medication not found.' });

    if (dosage !== undefined) med.dosage = dosage;
    if (frequency !== undefined) med.frequency = frequency;
    if (scheduleTimes !== undefined) med.scheduleTimes = scheduleTimes;
    if (isOngoing !== undefined) med.isOngoing = isOngoing;
    if (startDate !== undefined) med.startDate = startDate ? new Date(startDate) : new Date();
    if (isOngoing === false && endDate !== undefined) med.endDate = endDate ? new Date(endDate) : null;
    if (isOngoing === true) med.endDate = null;

    await med.save();
    return res.json({ medication: med });
  } catch (err) {
    console.error('[PUT MED]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/patient/medications/:id/stop
// Discontinue a medication
// ─────────────────────────────────────────────────────────────
router.patch('/medications/:id/stop', async (req, res) => {
  try {
    const patient = await getOrCreatePatient(req.user.userId);
    const med = await Medication.findOne({ _id: req.params.id, patientId: patient._id });
    if (!med) return res.status(404).json({ error: 'Medication not found.' });

    med.status = 'stopped';
    med.stoppedAt = new Date();
    med.isOngoing = false;
    
    await med.save();
    return res.json({ medication: med });
  } catch (err) {
    console.error('[PATCH STOP MED]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/patient/medications/:id
// Delete a medication entirely from database
// ─────────────────────────────────────────────────────────────
router.delete('/medications/:id', async (req, res) => {
  try {
    const patient = await getOrCreatePatient(req.user.userId);
    const med = await Medication.findOneAndDelete({ _id: req.params.id, patientId: patient._id });
    if (!med) return res.status(404).json({ error: 'Medication not found.' });

    await Patient.findByIdAndUpdate(patient._id, { $inc: { medications: -1 } });
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE MED]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/patient/caregivers
// Returns all active/approved caregivers with their full profile data.
// ─────────────────────────────────────────────────────────────
router.get('/caregivers', async (req, res) => {
  try {
    const users = await User.find({ role: 'caregiver', status: 'active' })
      .select('firstName lastName email createdAt')
      .lean();

    // Find this patient's record to check assignments
    const patient = await Patient.findOne({ linkedUserId: req.user.userId }).lean();

    const caregivers = await Promise.all(users.map(async u => {
      const profile = await CaregiverProfile.findOne({ userId: u._id }).lean();

      // Check if this caregiver is already assigned to this patient
      const isAssigned = patient
        ? !!(await Assignment.findOne({ caregiverId: u._id, patientId: patient._id }))
        : false;

      return {
        _id:        u._id,
        firstName:  u.firstName,
        lastName:   u.lastName,
        email:      u.email,
        createdAt:  u.createdAt,
        isAssigned,
        caregiverProfile: profile ? {
          specialization:  profile.specialization,
          qualification:   profile.qualification,
          experienceYears: profile.experienceYears,
          availability:    profile.availability,
          languagesSpoken: profile.languagesSpoken,
          licenseId:       profile.licenseId,
          gender:          profile.gender,
        } : {},
      };
    }));

    return res.json({ caregivers });
  } catch (err) {
    console.error('[GET CAREGIVERS]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/patient/caregivers/:id/request
// Patient cancels a pending hire request.
// ─────────────────────────────────────────────────────────────
router.delete('/caregivers/:id/request', async (req, res) => {
  try {
    const request = await CaregiverRequest.findOneAndDelete({
      patientUserId: req.user.userId,
      caregiverId:   req.params.id,
      status:        'pending',
    });
    if (!request) return res.status(404).json({ error: 'No pending request found.' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE CAREGIVER REQUEST]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/patient/caregiver-invites
// Returns pending invites sent TO this patient by caregivers.
// ─────────────────────────────────────────────────────────────
router.get('/caregiver-invites', async (req, res) => {
  try {
    const invites = await CaregiverRequest.find({
      patientUserId: req.user.userId,
      initiatedBy:   'caregiver',
      status:        'pending',
    })
      .populate('caregiverId', 'firstName lastName email caregiverProfile createdAt')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ invites });
  } catch (err) {
    console.error('[GET CAREGIVER INVITES]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/patient/caregiver-invites/:id/accept
// Patient accepts a caregiver-initiated invite in-app.
// ─────────────────────────────────────────────────────────────
router.patch('/caregiver-invites/:id/accept', async (req, res) => {
  try {
    const request = await CaregiverRequest.findOne({
      _id:           req.params.id,
      patientUserId: req.user.userId,
      initiatedBy:   'caregiver',
      status:        'pending',
    });
    if (!request) return res.status(404).json({ error: 'Invite not found.' });

    request.status = 'accepted';
    await request.save();

    let patient = await Patient.findOne({ linkedUserId: req.user.userId });
    if (!patient) {
      const u = await User.findById(req.user.userId);
      if (u) {
        patient = await Patient.create({
          linkedUserId: u._id,
          firstName:    u.firstName,
          lastName:     u.lastName,
          email:        u.email,
        });
      }
    }
    if (patient) {
      const exists = await Assignment.findOne({ caregiverId: request.caregiverId, patientId: patient._id });
      if (!exists) {
        await Assignment.create({ caregiverId: request.caregiverId, patientId: patient._id, role: 'caregiver' });
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[ACCEPT CAREGIVER INVITE]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/patient/caregiver-invites/:id/decline
// Patient declines a caregiver-initiated invite in-app.
// ─────────────────────────────────────────────────────────────
router.patch('/caregiver-invites/:id/decline', async (req, res) => {
  try {
    const request = await CaregiverRequest.findOne({
      _id:           req.params.id,
      patientUserId: req.user.userId,
      initiatedBy:   'caregiver',
      status:        'pending',
    });
    if (!request) return res.status(404).json({ error: 'Invite not found.' });

    request.status = 'declined';
    await request.save();

    return res.json({ success: true });
  } catch (err) {
    console.error('[DECLINE CAREGIVER INVITE]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/patient/caregiver-requests
// Returns all requests this patient has sent (with current status).
// ─────────────────────────────────────────────────────────────
router.get('/caregiver-requests', async (req, res) => {
  try {
    const requests = await CaregiverRequest.find({ patientUserId: req.user.userId, initiatedBy: 'patient' })
      .populate('caregiverId', 'firstName lastName email caregiverProfile')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ requests });
  } catch (err) {
    console.error('[GET CAREGIVER REQUESTS]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/patient/caregivers/:id/request
// Patient sends a hire request to a caregiver.
// Sends an invitation email to the caregiver with accept/decline links.
// ─────────────────────────────────────────────────────────────
router.post('/caregivers/:id/request', async (req, res) => {
  try {
    const caregiverId = req.params.id;
    const patientUserId = req.user.userId;

    const caregiver = await User.findOne({ _id: caregiverId, role: 'caregiver', status: 'active' });
    if (!caregiver) return res.status(404).json({ error: 'Caregiver not found.' });

    // Check for existing request
    const existing = await CaregiverRequest.findOne({ patientUserId, caregiverId });
    if (existing) {
      if (existing.status === 'pending') {
        return res.status(409).json({ error: 'You already have a pending request to this caregiver.' });
      }
      if (existing.status === 'accepted') {
        return res.status(409).json({ error: 'This caregiver is already assigned to you.' });
      }
      // Declined — allow re-requesting
      existing.status = 'pending';
      existing.message = req.body.message || '';
      await existing.save();

      await sendInvitationEmail(existing, patientUserId, caregiver);
      return res.status(201).json({ request: existing });
    }

    const request = await CaregiverRequest.create({
      patientUserId,
      caregiverId,
      message: req.body.message || '',
    });

    await sendInvitationEmail(request, patientUserId, caregiver);
    return res.status(201).json({ request });
  } catch (err) {
    console.error('[POST CAREGIVER REQUEST]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Helper: build + send the caregiver invitation email ───────
async function sendInvitationEmail(request, patientUserId, caregiver) {
  const patientUser = await User.findById(patientUserId).lean();
  if (!patientUser) return;

  const APP_URL = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
  const token = jwt.sign(
    { requestId: request._id.toString(), caregiverId: caregiver._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const acceptUrl  = `${APP_URL}/api/patient/caregiver-invitation?token=${token}&action=accept`;
  const declineUrl = `${APP_URL}/api/patient/caregiver-invitation?token=${token}&action=decline`;

  const patientName = `${patientUser.firstName} ${patientUser.lastName}`;
  const dob = patientUser.dateOfBirth
    ? new Date(patientUser.dateOfBirth).toLocaleDateString('en-CA')
    : 'Not provided';

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#0d9488;padding:24px 32px;">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;">💊 SafeDose</p>
          <p style="margin:4px 0 0;color:#ccfbf1;font-size:13px;">New Patient Invitation</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:16px;color:#111827;font-weight:bold;">Hello ${caregiver.firstName},</p>
          <p style="margin:0 0 16px;font-size:14px;color:#374151;">A patient on SafeDose would like you to be their caregiver. Review their details below and accept or decline the invitation.</p>

          <table style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;width:100%;margin:16px 0;" cellpadding="14" cellspacing="0">
            <tr><td>
              <p style="margin:0 0 6px;font-size:16px;font-weight:bold;color:#065f46;">${patientName}</p>
              <p style="margin:2px 0;font-size:13px;color:#374151;">Email: <strong>${patientUser.email}</strong></p>
              <p style="margin:2px 0;font-size:13px;color:#374151;">Date of birth: <strong>${dob}</strong></p>
              ${request.message ? `<p style="margin:8px 0 0;font-size:13px;color:#374151;font-style:italic;">"${request.message}"</p>` : ''}
            </td></tr>
          </table>

          <!-- Accept / Decline buttons -->
          <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr>
              <td style="background:#0d9488;border-radius:8px;padding-right:12px;">
                <a href="${acceptUrl}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">
                  ✓ Accept
                </a>
              </td>
              <td style="background:#f3f4f6;border:1px solid #d1d5db;border-radius:8px;">
                <a href="${declineUrl}" style="display:inline-block;padding:14px 28px;color:#374151;font-size:15px;font-weight:bold;text-decoration:none;">
                  ✕ Decline
                </a>
              </td>
            </tr>
          </table>

          <p style="margin:0;font-size:13px;color:#6b7280;">
            This invitation expires in 7 days. You can also manage requests from your
            <a href="${APP_URL}/caregiver/dashboard" style="color:#0d9488;text-decoration:none;">caregiver dashboard</a>.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">SafeDose — Medication Safety Assistant. Do not reply to this email.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await sendEmail(
    caregiver.email,
    `💊 SafeDose: ${patientName} wants you as their caregiver`,
    html
  ).catch(() => {});
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/patient/caregivers/:id
// Patient removes an accepted caregiver from their care team.
// Deletes the Assignment and marks the CaregiverRequest as declined.
// ─────────────────────────────────────────────────────────────
router.delete('/caregivers/:id', async (req, res) => {
  try {
    const patient = await getOrCreatePatient(req.user.userId);
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });

    const deleted = await Assignment.findOneAndDelete({
      caregiverId: req.params.id,
      patientId:   patient._id,
    });
    if (!deleted) return res.status(404).json({ error: 'Caregiver not assigned to you.' });

    // Clean up the request record so the patient can re-request later
    await CaregiverRequest.deleteMany({
      patientUserId: req.user.userId,
      caregiverId:   req.params.id,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE CAREGIVER]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
