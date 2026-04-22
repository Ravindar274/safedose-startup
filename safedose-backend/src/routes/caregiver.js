// src/routes/caregiver.js

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth, requireRole } from '../middleware/auth.js';
import Assignment       from '../models/Assignment.js';
import Patient          from '../models/Patient.js';
import User             from '../models/User.js';
import Medication       from '../models/Medication.js';
import CaregiverRequest from '../models/CaregiverRequest.js';
import { getCaregiverRosterAdherenceSummary, getPatientAdherenceSummary } from '../lib/adherence.js';
import { searchOpenFDADrugs } from '../lib/openfda.js';
import { sendEmail }    from '../lib/sendEmail.js';

const router = Router();

// ─────────────────────────────────────────────────────────────
// GET /api/caregiver/patient-invitation?token=xxx&action=accept|decline
// No auth — token IS the auth.  Called when patient clicks the link in email.
// ─────────────────────────────────────────────────────────────
router.get('/patient-invitation', async (req, res) => {
  const APP_URL = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
  try {
    const { token, action } = req.query;
    if (!token || !['accept', 'decline'].includes(action)) {
      return res.redirect(`${APP_URL}/patient/dashboard`);
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.redirect(`${APP_URL}/patient/dashboard`);
    }

    const { requestId, patientUserId } = payload;
    const request = await CaregiverRequest.findOne({
      _id: requestId,
      patientUserId,
      initiatedBy: 'caregiver',
      status: 'pending',
    });
    if (!request) {
      return res.redirect(`${APP_URL}/patient/dashboard`);
    }

    if (action === 'decline') {
      request.status = 'declined';
      await request.save();
      return res.redirect(`${APP_URL}/patient/dashboard?invitation=declined`);
    }

    // Accept: find/create Patient record and create Assignment
    request.status = 'accepted';
    await request.save();

    let patient = await Patient.findOne({ linkedUserId: patientUserId });
    if (!patient) {
      const patientUser = await User.findById(patientUserId);
      if (patientUser) {
        patient = await Patient.create({
          linkedUserId: patientUserId,
          firstName:    patientUser.firstName,
          lastName:     patientUser.lastName,
          email:        patientUser.email,
        });
      }
    }

    if (patient) {
      const existing = await Assignment.findOne({ caregiverId: request.caregiverId, patientId: patient._id });
      if (!existing) {
        await Assignment.create({ caregiverId: request.caregiverId, patientId: patient._id, role: 'caregiver' });
      }
    }

    return res.redirect(`${APP_URL}/patient/dashboard?invitation=accepted`);
  } catch (err) {
    console.error('[PATIENT INVITATION]', err);
    return res.redirect(`${process.env.CLIENT_ORIGIN || 'http://localhost:3000'}/patient/dashboard`);
  }
});

router.use(requireAuth, requireRole('caregiver'));

// ── Helper: verify caregiver has access to a patient ──────────
// Returns the Assignment doc, or null if no access.
async function getAssignment(caregiverId, patientId) {
  return Assignment.findOne({ caregiverId, patientId });
}

// ── Helper: parse today's taken indices from takenDoses string ──
function parseTakenToday(takenDoses) {
  if (!takenDoses) return new Set();
  const today = new Date().toISOString().slice(0, 10);
  const [datePart, indicesPart] = takenDoses.split(':');
  if (datePart !== today || !indicesPart) return new Set();
  return new Set(indicesPart.split(',').map(Number));
}

// ── Helper: how many doses per day for a given frequency ──────
function doseCount(frequency) {
  const map = {
    'once daily':        1,
    'twice daily':       2,
    'three times daily': 3,
    'four times daily':  4,
  };
  return map[frequency] ?? 1;
}

// ── Helper: compute live stats for a single patient ──────────
// Returns { missedToday, dueNow, upcomingToday, medsToday }
// missedToday   — untaken doses > 30 min past scheduled time
// dueNow        — untaken doses within 15 min before to 30 min after scheduled
// upcomingToday — untaken doses > 15 min before scheduled time
// medsToday     — number of medications active on today's date
async function computePatientStats(patientId) {
  const now      = new Date();
  const today    = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const medications = await Medication.find({
    patientId,
    status:    { $ne: 'stopped' },
    startDate: { $lte: tomorrow },
    $or: [{ isOngoing: true }, { endDate: { $gte: today } }],
  });

  let missed    = 0;
  let dueNow    = 0;
  let upcoming  = 0;
  let medsToday = 0;

  function parseScheduledTime(timeStr) {
    if (!timeStr) return null;
    const [t, period] = timeStr.split(' ');
    let [h, m] = t.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h  = 0;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  for (const med of medications) {
    // Filter out interval-frequency meds not due today
    if (med.startDate) {
      const start    = new Date(med.startDate.getUTCFullYear(), med.startDate.getUTCMonth(), med.startDate.getUTCDate());
      const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
      if (diffDays < 0) continue;
      if (med.frequency === 'once every 2 days' && diffDays % 2 !== 0) continue;
      if (med.frequency === 'once every 3 days' && diffDays % 3 !== 0) continue;
      if (med.frequency === 'once in a week'    && diffDays % 7 !== 0) continue;
    }

    medsToday++;

    const takenSet = parseTakenToday(med.takenDoses);
    const times    = med.scheduleTimes || [];

    times.forEach((timeStr, i) => {
      if (takenSet.has(i) || !timeStr) return;
      const scheduled = parseScheduledTime(timeStr);
      if (!scheduled || now < scheduled) { upcoming++; return; }

      // now >= scheduled — check if next dose time has also passed (same logic as patient detail page)
      const nextScheduled = parseScheduledTime(times[i + 1]);
      if (nextScheduled && now >= nextScheduled) {
        missed++;
      } else {
        dueNow++;
      }
    });
  }

  return { missedToday: missed, dueNow, upcomingToday: upcoming, medsToday };
}

// ─────────────────────────────────────────────────────────────
// GET /api/caregiver/patients
// All patients assigned to this caregiver, with live missedToday.
// ─────────────────────────────────────────────────────────────
router.get('/patients', async (req, res) => {
  try {
    const assignments = await Assignment.find({ caregiverId: req.user.userId })
      .populate('patientId')
      .sort({ createdAt: -1 });

    const patients = await Promise.all(
      assignments
        .filter(a => a.patientId)
        .map(async (a) => {
          const { missedToday, dueNow, upcomingToday, medsToday } = await computePatientStats(a.patientId._id);
          return {
            ...a.patientId.toObject(),
            assignmentRole: a.role,
            missedToday,
            dueNow,
            upcomingToday,
            medsToday,
          };
        })
    );

    return res.json({ patients });
  } catch (err) {
    console.error('[GET PATIENTS ERROR]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/caregiver/patients/:id
// ─────────────────────────────────────────────────────────────
router.get('/patients/:id', async (req, res) => {
  try {
    const assignment = await getAssignment(req.user.userId, req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Patient not found.' });

    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });

    return res.json({ patient: { ...patient.toObject(), assignmentRole: assignment.role } });
  } catch (err) {
    console.error('[GET PATIENT ERROR]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/caregiver/adherence
// Returns adherence overview across the caregiver's roster.
// ─────────────────────────────────────────────────────────────
router.get('/adherence', async (req, res) => {
  try {
    const assignments = await Assignment.find({ caregiverId: req.user.userId }).populate('patientId');
    const validAssignments = assignments.filter((item) => item.patientId);
    const patientIds = validAssignments.map((item) => item.patientId._id);
    const patientMeta = new Map(
      validAssignments.map((item) => [
        String(item.patientId._id),
        `${item.patientId.firstName || ''} ${item.patientId.lastName || ''}`.trim() || 'Unknown patient',
      ])
    );

    const summary = await getCaregiverRosterAdherenceSummary(patientIds, patientMeta, req.query.days);
    return res.json(summary);
  } catch (err) {
    console.error('[GET CAREGIVER ADHERENCE]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/caregiver/patients/:id/adherence
// Returns historical adherence trends for one assigned patient.
// ─────────────────────────────────────────────────────────────
router.get('/patients/:id/adherence', async (req, res) => {
  try {
    const assignment = await getAssignment(req.user.userId, req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Patient not found.' });

    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ error: 'Patient not found.' });

    const summary = await getPatientAdherenceSummary(req.params.id, req.query.days);
    return res.json({
      patient: {
        _id: patient._id,
        firstName: patient.firstName,
        lastName: patient.lastName,
      },
      ...summary,
    });
  } catch (err) {
    console.error('[GET CAREGIVER PATIENT ADHERENCE]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/caregiver/patients/:id/medications/today
// ─────────────────────────────────────────────────────────────
router.get('/patients/:id/medications/today', async (req, res) => {
  try {
    const assignment = await getAssignment(req.user.userId, req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Patient not found.' });

    const today    = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const medications = await Medication.find({
      patientId: req.params.id,
      status:    { $ne: 'stopped' },
      startDate: { $lte: tomorrow },
      $or: [{ isOngoing: true }, { endDate: { $gte: today } }],
    }).sort({ 'scheduleTimes.0': 1 });

    const result = medications.filter(med => {
      if (!med.startDate) return true;
      const start    = new Date(med.startDate.getUTCFullYear(), med.startDate.getUTCMonth(), med.startDate.getUTCDate());
      const diffDays = Math.floor((today.getTime() - start.getTime()) / 86400000);
      if (diffDays < 0) return false;
      if (med.frequency === 'once every 2 days' && diffDays % 2 !== 0) return false;
      if (med.frequency === 'once every 3 days' && diffDays % 3 !== 0) return false;
      if (med.frequency === 'once in a week'    && diffDays % 7 !== 0) return false;
      return true;
    }).map(med => {
      const takenSet   = parseTakenToday(med.takenDoses);
      const count      = doseCount(med.frequency);
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
        takenToday,
        allTaken: takenToday.every(Boolean),
      };
    });

    return res.json({ medications: result });
  } catch (err) {
    console.error('[GET CAREGIVER PATIENT TODAY MEDS]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/caregiver/patients/:id/medications
// All medications for a patient, tagged active / upcoming / past.
// ─────────────────────────────────────────────────────────────
router.get('/patients/:id/medications', async (req, res) => {
  try {
    const assignment = await getAssignment(req.user.userId, req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Patient not found.' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const medications = await Medication.find({ patientId: req.params.id })
      .sort({ startDate: -1 });

    const result = medications.map(med => {
      const start = med.startDate
        ? new Date(med.startDate.getUTCFullYear(), med.startDate.getUTCMonth(), med.startDate.getUTCDate())
        : null;
      const end = med.endDate
        ? new Date(med.endDate.getUTCFullYear(), med.endDate.getUTCMonth(), med.endDate.getUTCDate())
        : null;

      let category;
      if (med.status === 'stopped') {
        category = 'past';
      } else if (start && start > today) {
        category = 'upcoming';
      } else if (!med.isOngoing && end && end < today) {
        category = 'past';
      } else {
        category = 'active';
      }

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
        stoppedAt:    med.stoppedAt,
        category,
      };
    });

    return res.json({ medications: result });
  } catch (err) {
    console.error('[GET ALL MEDS]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/caregiver/patients/:id/medications
// ─────────────────────────────────────────────────────────────
router.post('/patients/:id/medications', async (req, res) => {
  try {
    const assignment = await getAssignment(req.user.userId, req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Patient not found.' });

    const { name, genericName, dosage, frequency, scheduleTimes, isOngoing, startDate, endDate } = req.body;
    if (!name || !genericName || !dosage || !frequency || !scheduleTimes?.length) {
      return res.status(400).json({ error: 'All required fields must be filled.' });
    }

    const medication = await Medication.create({
      patientId:    req.params.id,
      addedBy:      req.user.userId,
      name, genericName, dosage, frequency, scheduleTimes,
      isOngoing:    isOngoing ?? true,
      startDate:    startDate ? new Date(startDate) : new Date(),
      endDate:      (!isOngoing && endDate) ? new Date(endDate) : null,
    });

    await Patient.findByIdAndUpdate(req.params.id, { $inc: { medications: 1 } });
    return res.status(201).json({ medication });
  } catch (err) {
    console.error('[POST CAREGIVER MED]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/caregiver/patients/:id/medications/:medId/taken
// ─────────────────────────────────────────────────────────────
router.patch('/patients/:id/medications/:medId/taken', async (req, res) => {
  try {
    const assignment = await getAssignment(req.user.userId, req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Patient not found.' });

    const med = await Medication.findOne({ _id: req.params.medId, patientId: req.params.id });
    if (!med) return res.status(404).json({ error: 'Medication not found.' });

    const doseIndex = req.body.doseIndex ?? 0;
    const today     = new Date().toISOString().slice(0, 10);
    const takenSet  = parseTakenToday(med.takenDoses);

    takenSet.has(doseIndex) ? takenSet.delete(doseIndex) : takenSet.add(doseIndex);

    med.takenDoses = takenSet.size > 0
      ? `${today}:${[...takenSet].sort().join(',')}`
      : null;
    await med.save();

    const count      = doseCount(med.frequency);
    const takenToday = Array.from({ length: count }, (_, i) => takenSet.has(i));
    return res.json({ takenToday, allTaken: takenToday.every(Boolean) });
  } catch (err) {
    console.error('[PATCH CAREGIVER TAKEN]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/caregiver/patients
// Create a new patient profile OR link a registered patient.
// ─────────────────────────────────────────────────────────────
router.post('/patients', async (req, res) => {
  try {
    const { firstName, lastName, email, dateOfBirth, notes, mode, linkedEmail } = req.body;

    // ── Link mode: invite an existing registered patient ──
    if (mode === 'link') {
      if (!linkedEmail) {
        return res.status(400).json({ error: 'Email is required to invite a patient.' });
      }

      const patientUser = await User.findOne({ email: linkedEmail, role: 'patient' });
      if (!patientUser) {
        return res.status(404).json({ error: 'No registered patient found with that email.' });
      }

      // Block if already in roster
      const existingPatient = await Patient.findOne({ linkedUserId: patientUser._id });
      if (existingPatient) {
        const alreadyAssigned = await Assignment.findOne({ caregiverId: req.user.userId, patientId: existingPatient._id });
        if (alreadyAssigned) {
          return res.status(409).json({ error: 'This patient is already in your roster.' });
        }
      }

      // Upsert: reset to pending if an old accepted/declined request exists,
      // or block if one is already pending
      const existing = await CaregiverRequest.findOne({
        patientUserId: patientUser._id,
        caregiverId:   req.user.userId,
        initiatedBy:   'caregiver',
      });
      if (existing?.status === 'pending') {
        return res.status(409).json({ error: 'An invitation is already pending for this patient.' });
      }

      let request;
      if (existing) {
        // Re-invite after a previous accept/decline — reset to pending
        existing.status = 'pending';
        request = await existing.save();
      } else {
        request = await CaregiverRequest.create({
          patientUserId: patientUser._id,
          caregiverId:   req.user.userId,
          initiatedBy:   'caregiver',
          status:        'pending',
        });
      }

      // Send invitation email to the patient
      const caregiver = await User.findById(req.user.userId).select('firstName lastName').lean();
      await sendCaregiverInviteEmail(request, patientUser, caregiver);

      return res.status(201).json({ invited: true, email: patientUser.email });
    }

    // ── New mode: create a patient profile without an account ──
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First and last name are required.' });
    }

    const normalizedEmail = email?.trim().toLowerCase() || null;

    if (normalizedEmail) {
      const duplicate = await Patient.findOne({ email: normalizedEmail });
      if (duplicate) {
        return res.status(409).json({ error: 'A patient with this email already exists.' });
      }
    }

    const patient = await Patient.create({
      linkedUserId: null,
      firstName,
      lastName,
      email:       normalizedEmail,
      dateOfBirth: dateOfBirth || null,
      notes:       notes       || '',
    });

    await Assignment.create({
      caregiverId: req.user.userId,
      patientId:   patient._id,
      role:        'owner',
    });

    return res.status(201).json({ patient });
  } catch (err) {
    console.error('[POST PATIENT ERROR]', err);
    if (err.code === 11000) {
      if (err.keyPattern?.email) {
        return res.status(409).json({ error: 'A patient with this email already exists.' });
      }
      return res.status(409).json({ error: 'An invitation is already pending for this patient.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /api/caregiver/patients/:id/medications/:medId
// Edit a patient's medication.
// ─────────────────────────────────────────────────────────────
router.put('/patients/:id/medications/:medId', async (req, res) => {
  try {
    const assignment = await getAssignment(req.user.userId, req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Patient not found.' });

    const med = await Medication.findOne({ _id: req.params.medId, patientId: req.params.id });
    if (!med) return res.status(404).json({ error: 'Medication not found.' });

    const { name, genericName, dosage, frequency, scheduleTimes, isOngoing, startDate, endDate } = req.body;

    if (name         !== undefined) med.name         = name;
    if (genericName  !== undefined) med.genericName  = genericName;
    if (dosage       !== undefined) med.dosage        = dosage;
    if (frequency    !== undefined) med.frequency     = frequency;
    if (scheduleTimes !== undefined) med.scheduleTimes = scheduleTimes;
    if (isOngoing    !== undefined) med.isOngoing     = isOngoing;
    if (startDate    !== undefined) med.startDate     = startDate ? new Date(startDate) : new Date();
    if (isOngoing === false && endDate !== undefined) med.endDate = endDate ? new Date(endDate) : null;
    if (isOngoing === true) med.endDate = null;

    await med.save();
    return res.json({ medication: med });
  } catch (err) {
    console.error('[PUT CAREGIVER MED]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/caregiver/patients/:id/medications/:medId/stop
// Discontinue a patient's medication.
// ─────────────────────────────────────────────────────────────
router.patch('/patients/:id/medications/:medId/stop', async (req, res) => {
  try {
    const assignment = await getAssignment(req.user.userId, req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Patient not found.' });

    const med = await Medication.findOne({ _id: req.params.medId, patientId: req.params.id });
    if (!med) return res.status(404).json({ error: 'Medication not found.' });

    med.status    = 'stopped';
    med.stoppedAt = new Date();
    med.isOngoing = false;
    await med.save();

    return res.json({ medication: med });
  } catch (err) {
    console.error('[PATCH STOP CAREGIVER MED]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/caregiver/patients/:id/medications/:medId
// Permanently delete a patient's medication.
// ─────────────────────────────────────────────────────────────
router.delete('/patients/:id/medications/:medId', async (req, res) => {
  try {
    const assignment = await getAssignment(req.user.userId, req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Patient not found.' });

    const med = await Medication.findOneAndDelete({ _id: req.params.medId, patientId: req.params.id });
    if (!med) return res.status(404).json({ error: 'Medication not found.' });

    await Patient.findByIdAndUpdate(req.params.id, { $inc: { medications: -1 } });
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE CAREGIVER MED]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/caregiver/patients/:id
// owner     → delete the Patient document + all its assignments
// caregiver → remove only this caregiver's assignment
// ─────────────────────────────────────────────────────────────
router.delete('/patients/:id', async (req, res) => {
  try {
    const assignment = await Assignment.findOne({
      caregiverId: req.user.userId,
      patientId:   req.params.id,
    });

    if (!assignment) {
      return res.status(404).json({ error: 'Patient not found.' });
    }

    if (assignment.role === 'owner') {
      // Delete the patient and all caregiver assignments for them
      const patient = await Patient.findByIdAndDelete(req.params.id);
      await Medication.deleteMany({ patientId: req.params.id });
      await Assignment.deleteMany({ patientId: req.params.id });
      // Clean up any invite requests so the caregiver can re-invite later
      if (patient?.linkedUserId) {
        await CaregiverRequest.deleteMany({ patientUserId: patient.linkedUserId, caregiverId: req.user.userId });
      }
    } else {
      // Just remove this caregiver's link
      await Assignment.findByIdAndDelete(assignment._id);
      // Clean up the invite request so the caregiver can re-invite later
      const patient = await Patient.findById(req.params.id);
      if (patient?.linkedUserId) {
        await CaregiverRequest.deleteMany({ patientUserId: patient.linkedUserId, caregiverId: req.user.userId });
      }
    }

    return res.json({ message: 'Patient removed.' });
  } catch (err) {
    console.error('[DELETE PATIENT ERROR]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/caregiver/drugs
// Proxies to the OpenFDA drug label API with search + pagination.
// Query params: q (search text), skip (offset), limit (page size)
// ─────────────────────────────────────────────────────────────
router.get('/drugs', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const { drugs, total } = await searchOpenFDADrugs(q, req.query.skip, req.query.limit);
    return res.json({ drugs, total });
  } catch (err) {
    console.error('[GET DRUGS ERROR]', err);
    return res.status(502).json({ error: 'OpenFDA request failed.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/caregiver/requests
// Lists all pending hire requests sent to this caregiver.
// ─────────────────────────────────────────────────────────────
router.get('/requests', async (req, res) => {
  try {
    const requests = await CaregiverRequest.find({
      caregiverId:  req.user.userId,
      initiatedBy:  'patient',
      status:       'pending',
    })
      .populate('patientUserId', 'firstName lastName email dateOfBirth')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ requests });
  } catch (err) {
    console.error('[GET CAREGIVER REQUESTS]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/caregiver/requests/:id/accept
// Caregiver accepts the request from their dashboard.
// Creates a Patient record (if needed) and an Assignment.
// ─────────────────────────────────────────────────────────────
router.patch('/requests/:id/accept', async (req, res) => {
  try {
    const request = await CaregiverRequest.findOne({
      _id: req.params.id,
      caregiverId: req.user.userId,
      status: 'pending',
    });
    if (!request) return res.status(404).json({ error: 'Request not found.' });

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
      const existing = await Assignment.findOne({
        caregiverId: req.user.userId,
        patientId: patient._id,
      });
      if (!existing) {
        await Assignment.create({
          caregiverId: req.user.userId,
          patientId: patient._id,
          role: 'caregiver',
        });
      }
    }

    // Notify the patient their request was accepted
    const patientUser   = await User.findById(request.patientUserId).select('email firstName').lean();
    const caregiverUser = await User.findById(req.user.userId).select('firstName lastName').lean();
    if (patientUser) {
      const APP_URL = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
      const cgName  = caregiverUser ? `${caregiverUser.firstName} ${caregiverUser.lastName}` : 'Your caregiver';
      sendEmail(
        patientUser.email,
        `✅ SafeDose: ${cgName} accepted your request!`,
        buildRequestAcceptedEmail(patientUser.firstName, cgName, APP_URL)
      ).catch(() => {});
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[ACCEPT REQUEST]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /api/caregiver/requests/:id/decline
// Caregiver declines the request from their dashboard.
// ─────────────────────────────────────────────────────────────
router.patch('/requests/:id/decline', async (req, res) => {
  try {
    const request = await CaregiverRequest.findOne({
      _id: req.params.id,
      caregiverId: req.user.userId,
      status: 'pending',
    });
    if (!request) return res.status(404).json({ error: 'Request not found.' });

    request.status = 'declined';
    await request.save();

    // Notify the patient their request was declined
    const patientUser   = await User.findById(request.patientUserId).select('email firstName').lean();
    const caregiverUser = await User.findById(req.user.userId).select('firstName lastName').lean();
    if (patientUser) {
      const APP_URL = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
      const cgName  = caregiverUser ? `${caregiverUser.firstName} ${caregiverUser.lastName}` : 'The caregiver';
      sendEmail(
        patientUser.email,
        `SafeDose: Update on your caregiver request`,
        buildRequestDeclinedEmail(patientUser.firstName, cgName, APP_URL)
      ).catch(() => {});
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[DECLINE REQUEST]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Helper: send caregiver→patient invitation email ───────────
async function sendCaregiverInviteEmail(request, patientUser, caregiver) {
  const APP_URL = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
  const token   = jwt.sign(
    { requestId: request._id.toString(), patientUserId: patientUser._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const acceptUrl  = `${APP_URL}/api/caregiver/patient-invitation?token=${token}&action=accept`;
  const declineUrl = `${APP_URL}/api/caregiver/patient-invitation?token=${token}&action=decline`;
  const cgName     = caregiver ? `${caregiver.firstName} ${caregiver.lastName}` : 'A caregiver';

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <tr><td style="background:#0d9488;padding:24px 32px;">
        <p style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;">💊 SafeDose</p>
        <p style="margin:4px 0 0;color:#ccfbf1;font-size:13px;">Caregiver Invitation</p>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 8px;font-size:16px;color:#111827;font-weight:bold;">Hello ${patientUser.firstName},</p>
        <p style="margin:0 0 16px;font-size:14px;color:#374151;">
          <strong>${cgName}</strong> would like to become your caregiver on SafeDose.
          If you accept, they will be able to view and manage your medications.
        </p>
        <table style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;width:100%;margin:16px 0;" cellpadding="14" cellspacing="0">
          <tr><td>
            <p style="margin:0;font-size:15px;font-weight:bold;color:#065f46;">👤 ${cgName}</p>
            <p style="margin:6px 0 0;font-size:13px;color:#065f46;">Registered caregiver on SafeDose</p>
          </td></tr>
        </table>
        <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
          <tr>
            <td style="background:#0d9488;border-radius:8px;padding-right:12px;">
              <a href="${acceptUrl}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">✓ Accept</a>
            </td>
            <td style="background:#f3f4f6;border:1px solid #d1d5db;border-radius:8px;">
              <a href="${declineUrl}" style="display:inline-block;padding:14px 28px;color:#374151;font-size:15px;font-weight:bold;text-decoration:none;">✕ Decline</a>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:13px;color:#6b7280;">
          This invitation expires in 7 days. You can also manage invitations from your
          <a href="${APP_URL}/patient/dashboard" style="color:#0d9488;text-decoration:none;">patient dashboard</a>.
        </p>
      </td></tr>
      <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">SafeDose — Medication Safety Assistant. Do not reply to this email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  await sendEmail(
    patientUser.email,
    `💊 SafeDose: ${cgName} wants to be your caregiver`,
    html
  ).catch(() => {});
}

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

function buildRequestAcceptedEmail(patientFirstName, caregiverName, appUrl) {
  const body = `
    <p style="margin:0 0 8px;font-size:16px;color:#111827;font-weight:bold;">Great news, ${patientFirstName}!</p>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;"><strong>${caregiverName}</strong> has accepted your hire request and is now your caregiver on SafeDose.</p>
    <table style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;width:100%;margin:0 0 24px;" cellpadding="14" cellspacing="0">
      <tr><td>
        <p style="margin:0;font-size:14px;color:#065f46;font-weight:bold;">✅ ${caregiverName} is now managing your care</p>
        <p style="margin:6px 0 0;font-size:13px;color:#065f46;">They can now view your medications and track your adherence. You can find their contact details in your dashboard.</p>
      </td></tr>
    </table>
    <a href="${appUrl}/patient/dashboard" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;text-decoration:none;">Go to my dashboard →</a>`;
  return emailShell('Caregiver Request Accepted', body, `${appUrl}/patient/dashboard`);
}

function buildRequestDeclinedEmail(patientFirstName, caregiverName, appUrl) {
  const body = `
    <p style="margin:0 0 8px;font-size:16px;color:#111827;font-weight:bold;">Hello ${patientFirstName},</p>
    <p style="margin:0 0 16px;font-size:14px;color:#374151;">Unfortunately, <strong>${caregiverName}</strong> has declined your caregiver hire request at this time.</p>
    <table style="background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;width:100%;margin:0 0 20px;" cellpadding="14" cellspacing="0">
      <tr><td>
        <p style="margin:0;font-size:13px;color:#374151;">Don't worry — there are other caregivers available on SafeDose. Head to your dashboard to browse and send a request to another caregiver.</p>
      </td></tr>
    </table>
    <a href="${appUrl}/patient/dashboard" style="display:inline-block;background:#0d9488;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:bold;text-decoration:none;">Find another caregiver →</a>`;
  return emailShell('Caregiver Request Update', body, `${appUrl}/patient/dashboard`);
}

export default router;
