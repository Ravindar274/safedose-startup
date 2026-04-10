// src/routes/patient.js

import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import Patient    from '../models/Patient.js';
import Medication from '../models/Medication.js';
import Assignment from '../models/Assignment.js';

import User       from '../models/User.js';
import { getPatientAdherenceSummary } from '../lib/adherence.js';
import { searchOpenFDADrugs, validateOpenFDADrugSelection } from '../lib/openfda.js';

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

    const matchedDrug = await validateOpenFDADrugSelection(selectedDrug);
    if (!matchedDrug) {
      return res.status(400).json({ error: 'Please choose a medication from the FDA search results.' });
    }

    const patient = await getOrCreatePatient(req.user.userId);

    const medication = await Medication.create({
      patientId:    patient._id,
      addedBy:      req.user.userId,
      name:         matchedDrug.brandName,
      genericName:  matchedDrug.genericName || matchedDrug.brandName,
      dosage,
      frequency,
      scheduleTimes,
      rxcui:        matchedDrug.rxcui || '',
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
// List all active caregivers, mapping their assignment status
// ─────────────────────────────────────────────────────────────
router.get('/caregivers', async (req, res) => {
  try {
    const patient = await getOrCreatePatient(req.user.userId);
    
    // Get all active caregivers (including older ones with no status)
    const allCaregivers = await User.find({ 
      role: 'caregiver', 
      $or: [{ status: 'active' }, { status: null }, { status: { $exists: false } }]
    }, '-password');
    
    // Get my assignments
    const assignments = await Assignment.find({ patientId: patient._id });
    const assignedMap = new Map(assignments.map(a => [a.caregiverId.toString(), a.status]));
    
    const currentAssignment = assignments.find(a => a.status === 'active' || a.status === 'pending' || !a.status);
    const hasCaregiver = !!currentAssignment;
    
    const result = [];
    for (const c of allCaregivers) {
      const assignmentStatus = assignedMap.get(c._id.toString());
      if (assignmentStatus === 'declined') continue;
      
      result.push({
        _id: c._id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        profile: c.caregiverProfile || {},
        isAssigned: !!assignmentStatus,
        assignmentStatus
      });
    }
    
    return res.json({ caregivers: result, hasCaregiver });
  } catch (err) {
    console.error('[GET PATIENT CAREGIVERS]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/patient/caregivers/:id/link
// Assign a caregiver to the patient
// ─────────────────────────────────────────────────────────────
router.post('/caregivers/:id/link', async (req, res) => {
  try {
    const patient = await getOrCreatePatient(req.user.userId);
    const caregiverId = req.params.id;
    
    const cg = await User.findOne({ _id: caregiverId, role: 'caregiver', status: 'active' });
    if (!cg) return res.status(404).json({ error: 'Caregiver not active or not found.' });

    const existing = await Assignment.findOne({ caregiverId, patientId: patient._id });
    if (existing) return res.status(400).json({ error: 'Caregiver is already assigned or requested.' });

    const currentAssigned = await Assignment.findOne({ 
      patientId: patient._id, 
      $or: [{ status: { $in: ['active', 'pending'] } }, { status: null }, { status: { $exists: false } }]
    });
    if (currentAssigned) return res.status(400).json({ error: 'You already have an assigned caregiver. Please unassign them first.' });

    await Assignment.create({ caregiverId, patientId: patient._id, role: 'caregiver', status: 'pending' });
    
    return res.json({ success: true, message: 'Request sent successfully.' });
  } catch (err) {
    console.error('[POST CAREGIVER LINK]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /api/patient/caregivers/unassign
// Revokes the current assignment so the patient can pick a new caregiver
// ─────────────────────────────────────────────────────────────
router.delete('/caregivers/unassign', async (req, res) => {
  try {
    const patient = await getOrCreatePatient(req.user.userId);
    await Assignment.deleteMany({ 
      patientId: patient._id, 
      $or: [{ status: { $in: ['active', 'pending'] } }, { status: null }, { status: { $exists: false } }]
    });
    return res.json({ success: true, message: 'Caregiver unassigned.' });
  } catch (err) {
    console.error('[DELETE UNASSIGN]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
