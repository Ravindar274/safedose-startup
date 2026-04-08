// src/routes/caregiver.js

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import Assignment from '../models/Assignment.js';
import Patient    from '../models/Patient.js';
import User       from '../models/User.js';
import Medication from '../models/Medication.js';
import { searchOpenFDADrugs } from '../lib/openfda.js';

const router = Router();

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
// Returns { missedToday, medsToday }
// missedToday — doses whose scheduled time has passed but aren't taken
// medsToday   — number of medications active on today's date
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

  let missed   = 0;
  let medsToday = 0;

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
      const [t, period] = timeStr.split(' ');
      let [h, m] = t.split(':').map(Number);
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h  = 0;
      const scheduled = new Date();
      scheduled.setHours(h, m, 0, 0);
      if (now >= scheduled) missed++;
    });
  }

  return { missedToday: missed, medsToday };
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
          const { missedToday, medsToday } = await computePatientStats(a.patientId._id);
          return {
            ...a.patientId.toObject(),
            assignmentRole: a.role,
            missedToday,
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

    // ── Link mode: connect an existing registered patient ──
    if (mode === 'link') {
      if (!linkedEmail) {
        return res.status(400).json({ error: 'Email is required to link a patient.' });
      }

      const existingUser = await User.findOne({ email: linkedEmail, role: 'patient' });
      if (!existingUser) {
        return res.status(404).json({ error: 'No registered patient found with that email.' });
      }

      // Find or create a Patient profile linked to that user account
      let patient = await Patient.findOne({ linkedUserId: existingUser._id });
      if (!patient) {
        patient = await Patient.create({
          linkedUserId: existingUser._id,
          firstName:    existingUser.firstName,
          lastName:     existingUser.lastName,
          email:        existingUser.email,
        });
      }

      // Check for duplicate assignment
      const existing = await Assignment.findOne({ caregiverId: req.user.userId, patientId: patient._id });
      if (existing) {
        return res.status(409).json({ error: 'This patient is already in your roster.' });
      }

      await Assignment.create({
        caregiverId: req.user.userId,
        patientId:   patient._id,
        role:        'caregiver',
      });

      return res.status(201).json({ patient });
    }

    // ── New mode: create a patient profile without an account ──
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First and last name are required.' });
    }

    const patient = await Patient.create({
      linkedUserId: null,
      firstName,
      lastName,
      email:       email       || '',
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
      await Patient.findByIdAndDelete(req.params.id);
      await Medication.deleteMany({ patientId: req.params.id });
      await Assignment.deleteMany({ patientId: req.params.id });
    } else {
      // Just remove this caregiver's link
      await Assignment.findByIdAndDelete(assignment._id);
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

export default router;
