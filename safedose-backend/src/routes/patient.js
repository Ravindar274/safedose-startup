// src/routes/patient.js

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import Patient    from '../models/Patient.js';
import Medication from '../models/Medication.js';

import User       from '../models/User.js';

const router = Router();

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
      name, genericName, dosage, frequency,
      scheduleTimes, isOngoing, startDate, endDate,
    } = req.body;

    if (!name || !genericName || !dosage || !frequency || !scheduleTimes || !scheduleTimes.length) {
      return res.status(400).json({ error: 'All required fields must be filled.' });
    }

    const patient = await getOrCreatePatient(req.user.userId);

    const medication = await Medication.create({
      patientId:    patient._id,
      addedBy:      req.user.userId,
      name,
      genericName,
      dosage,
      frequency,
      scheduleTimes,
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
    const { name, genericName, dosage, frequency, scheduleTimes, isOngoing, startDate, endDate } = req.body;

    const med = await Medication.findOne({ _id: req.params.id, patientId: patient._id });
    if (!med) return res.status(404).json({ error: 'Medication not found.' });

    if (name !== undefined) med.name = name;
    if (genericName !== undefined) med.genericName = genericName;
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

export default router;
