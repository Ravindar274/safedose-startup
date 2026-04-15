// src/routes/chat.js

import express from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { fetchMongoContext } from '../lib/mongoContext.js';
import { fetchFDAContext } from '../lib/fdaContext.js';
import { callGemini, callGeminiWithSearch, extractDrugNames } from '../lib/gemini.js';
import { Medication, Patient, Assignment } from '../lib/models.js';

const router = express.Router();

const ROLE_LABELS = {
  admin:     'Administrator (full system access)',
  caregiver: 'Caregiver',
  patient:   'Patient',
};

// ── Helper: get medication names from DB for FDA lookup ──────────────────
async function getMedicationNames(user) {
  try {
    let meds = [];

    if (user.role === 'patient') {
      const patientRecord = await Patient.findOne({ linkedUserId: user.userId }).select('_id').lean();
      if (patientRecord) {
        meds = await Medication.find({ patientId: patientRecord._id }).select('name genericName').lean();
      }

    } else if (user.role === 'caregiver') {
      const assignments = await Assignment.find({ caregiverId: user.userId }).select('patientId').lean();
      const ids = assignments.map(a => a.patientId);
      meds = await Medication.find({ patientId: { $in: ids } }).select('name genericName').lean();

    } else if (user.role === 'admin') {
      meds = await Medication.find({}).select('name genericName').lean();
    }

    const names = new Set();
    meds.forEach(m => {
      if (m.name)        names.add(m.name.trim());
      if (m.genericName) names.add(m.genericName.trim());
    });

    return [...names];
  } catch {
    return [];
  }
}

// ── POST /api/chat ────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { message, mode } = req.body || {};

  if (!message?.trim()) {
    return res.status(400).json({ error: 'message is required.' });
  }

  try {
    const user  = req.user;
    const today = new Date().toLocaleDateString('en-CA');

    // Web search mode — skip DB context, let Gemini search the web directly
    if (mode === 'web') {
      console.log('[Web mode] Using Gemini Google Search grounding');
      const reply = await callGeminiWithSearch(message);
      return res.json({ reply });
    }

    // Step 1 — get DB medication names (always needed for MongoDB context)
    const medNames = await getMedicationNames(user);

    // Step 2 — fetch contexts based on mode
    //   'mydata' → MongoDB only, no FDA (fast)
    //   'fda'    → MongoDB + AI-extracted drug names → FDA lookup (thorough)
    //   default  → same as fda for backwards compat
    let mongoContext, fdaContext;

    if (mode === 'mydata') {
      mongoContext = await fetchMongoContext(user);
      fdaContext   = '';
    } else if (mode === 'fda') {
      const [mongo, aiDrugNames] = await Promise.all([
        fetchMongoContext(user),
        extractDrugNames(message),
      ]);
      mongoContext = mongo;
      const allNames = [...new Set([...medNames, ...aiDrugNames])].slice(0, 15);
      console.log(`[FDA mode] AI-identified drugs: ${aiDrugNames.join(', ') || 'none'}`);
      fdaContext = await fetchFDAContext(allNames);
    } else {
      [mongoContext, fdaContext] = await Promise.all([
        fetchMongoContext(user),
        fetchFDAContext(medNames),
      ]);
    }

    // Step 3 — build prompt
    const prompt = buildPrompt({ user, today, mongoContext, fdaContext, message });

    // Step 4 — call Gemini
    const reply = await callGemini(prompt);

    return res.json({ reply });

  } catch (err) {
    console.error('[POST /api/chat]', err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── Prompt builder ────────────────────────────────────────────────────────
function buildPrompt({ user, today, mongoContext, fdaContext, message }) {
  return `You are SafeDose AI, a helpful and responsible medication safety assistant.
Today's date: ${today}
Speaking with: ${user.email}
Their role: ${ROLE_LABELS[user.role] || user.role}

STRICT RULES:
- Answer ONLY using the data provided below. Never invent drug names, dosages, or medical advice.
- Always recommend consulting a doctor or pharmacist for medical decisions unless the question not relavent to medication safety.
- Never reveal one patient's data to another user.
- For simple questions give a concise 2-5 sentence response.
- For list requests, provide complete information — never truncate.
- If the answer is not in the data provided, say: "I don't have that information. Please consult your healthcare provider."
- Do not use markdown bold (**) or symbols. Use plain numbered lists.
- When referencing FDA data, always mention it is from the FDA drug label.

PATIENT RECORDS (from SafeDose database):
${mongoContext || 'No records available.'}

FDA DRUG INFORMATION (official FDA drug labels):
${fdaContext || 'No FDA data available for current medications.'}

Question: ${message}`;
}

export default router;