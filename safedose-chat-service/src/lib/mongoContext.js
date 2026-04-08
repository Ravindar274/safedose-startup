// src/lib/mongoContext.js
//
// Fetches relevant MongoDB data scoped strictly to the caller's role.
// No cross-user data leakage: each branch only queries data the caller owns.
// Cached per user for 5 minutes to avoid hammering the DB on every message.

import { User, Assignment, Patient, Medication } from './models.js';

// ── Cache ─────────────────────────────────────────────────────────────────
const cache    = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(user) {
  if (user.role === 'admin')     return 'admin';
  if (user.role === 'caregiver') return `caregiver:${user.userId}`;
  if (user.role === 'patient')   return `patient:${user.userId}`;
  return `unknown:${user.userId}`;
}

export async function fetchMongoContext(user) {
  const key    = getCacheKey(user);
  const cached = cache.get(key);
  if (cached && (Date.now() - cached.time) < CACHE_TTL) {
    return cached.data;
  }
  const data = await _fetchInternal(user);
  cache.set(key, { data, time: Date.now() });
  return data;
}

export function invalidateCache(user) {
  cache.delete(getCacheKey(user));
}

// ── Internal fetcher — role-scoped ────────────────────────────────────────
async function _fetchInternal(user) {
  const sections = [];

  try {

    if (user.role === 'admin') {
      // Admin sees aggregate stats + all records (passwords excluded)
      const [users, patients, meds] = await Promise.all([
        User.find({}).select('-password').lean(),
        Patient.find({}).lean(),
        Medication.find({ status: { $ne: 'stopped' } }).lean(),
      ]);
      sections.push(formatSection('All Users', users));
      sections.push(formatSection('All Patients', patients));
      sections.push(formatSection('All Active Medications', meds));

    } else if (user.role === 'caregiver') {
      // Find patients via Assignment — never via caregiverId on Patient
      const assignments = await Assignment.find({ caregiverId: user.userId }).lean();

      if (assignments.length === 0) {
        sections.push('You have no patients assigned yet.');
      } else {
        const patientIds = assignments.map(a => a.patientId);
        const patients   = await Patient.find({ _id: { $in: patientIds } }).lean();

        if (patients.length === 0) {
          sections.push('No patient records found for your assignments.');
        } else {
          sections.push(formatSection('Your Patients', patients));

          // Medications per patient — only their patients, never others
          for (const patient of patients) {
            const meds = await Medication.find({
              patientId: patient._id,
              status:    { $ne: 'stopped' },
            }).lean();

            if (meds.length > 0) {
              sections.push(
                formatSection(`Active Medications — ${patient.firstName} ${patient.lastName}`, meds)
              );
            } else {
              sections.push(`${patient.firstName} ${patient.lastName}: No active medications.`);
            }
          }
        }
      }

    } else if (user.role === 'patient') {
      // Patient user → find their Patient record via linkedUserId
      const patientRecord = await Patient.findOne({ linkedUserId: user.userId }).lean();

      if (!patientRecord) {
        sections.push('No patient record linked to your account yet.');
      } else {
        sections.push(formatSection('Your Profile', [patientRecord]));

        const meds = await Medication.find({
          patientId: patientRecord._id,
          status:    { $ne: 'stopped' },
        }).lean();

        if (meds.length > 0) {
          sections.push(formatSection('Your Active Medications', meds));

          // Parse takenDoses string to show today's status
          const today = new Date().toISOString().slice(0, 10);
          const statusLines = meds.map(m => {
            if (!m.takenDoses) return `${m.name}: No dose data for today.`;
            const [datePart, indicesPart] = (m.takenDoses || '').split(':');
            if (datePart !== today) return `${m.name}: Not yet recorded today.`;
            const takenSet = new Set((indicesPart || '').split(',').map(Number));
            const total    = { 'once daily': 1, 'twice daily': 2, 'three times daily': 3, 'four times daily': 4 }[m.frequency] ?? 1;
            const taken    = [...takenSet].filter(i => i < total).length;
            const missed   = total - taken;
            return `${m.name}: ${taken}/${total} doses taken today${missed > 0 ? `, ${missed} missed` : ''}`;
          });
          sections.push('Today\'s dose status:\n' + statusLines.join('\n'));

        } else {
          sections.push('You have no active medications.');
        }
      }
    }

    return sections.join('\n\n') || 'No records found.';

  } catch (err) {
    console.error('[mongoContext]', err.message);
    return 'Could not load your records. Please try again.';
  }
}

// ── Formatter ─────────────────────────────────────────────────────────────
function formatSection(title, records) {
  if (!records || records.length === 0) return `${title}: None found.`;

  const lines = records.map((record, i) => {
    const filtered = Object.entries(record)
      .filter(([k]) => !['_id', '__v', 'password', 'takenDoses'].includes(k))
      .map(([k, v]) => {
        const label = k.replace(/([A-Z])/g, ' $1').toLowerCase();
        const value = v instanceof Date
          ? v.toLocaleDateString()
          : Array.isArray(v)
          ? v.join(', ')
          : String(v ?? '');
        return `  ${label}: ${value}`;
      })
      .join('\n');
    return `[${i + 1}]\n${filtered}`;
  });

  return `=== ${title} ===\n${lines.join('\n\n')}`;
}
