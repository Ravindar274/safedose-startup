// src/lib/captureAdherence.js
//
// Called once per day at 23:59 (scheduled in index.js).
// Walks every patient's active medications, computes taken / missed
// doses for `dateStr`, then upserts a DailyAdherence record.

import Patient        from '../models/Patient.js';
import Medication     from '../models/Medication.js';
import DailyAdherence from '../models/DailyAdherence.js';
import Assignment     from '../models/Assignment.js';
import User          from '../models/User.js';
import { sendEmail } from './sendEmail.js';

// ── helpers ──────────────────────────────────────────────────
function parseTaken(takenDoses, dateStr) {
  if (!takenDoses) return new Set();
  const [datePart, indicesPart] = takenDoses.split(':');
  if (datePart !== dateStr || !indicesPart) return new Set();
  return new Set(indicesPart.split(',').map(Number));
}

function doseCount(frequency) {
  return { 'once daily': 1, 'twice daily': 2, 'three times daily': 3, 'four times daily': 4 }[frequency] ?? 1;
}

function isScheduledOnDate(med, dateStr) {
  const today    = new Date(dateStr);
  today.setHours(0, 0, 0, 0);

  if (!med.startDate) return true;
  const start = new Date(
    med.startDate.getUTCFullYear(),
    med.startDate.getUTCMonth(),
    med.startDate.getUTCDate(),
  );
  const diffDays = Math.floor((today - start) / 86400000);
  if (diffDays < 0) return false;
  if (med.frequency === 'once every 2 days' && diffDays % 2 !== 0) return false;
  if (med.frequency === 'once every 3 days' && diffDays % 3 !== 0) return false;
  if (med.frequency === 'once in a week'    && diffDays % 7 !== 0) return false;
  return true;
}

// ── email helpers ─────────────────────────────────────────────
function missedSummaryHtml(patientName, missedList, dateStr) {
  const rows = missedList.map(m =>
    `<tr>
       <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${m.name}</td>
       <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;color:#e53e3e">${m.missed} missed / ${m.total} doses</td>
     </tr>`
  ).join('');
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
      <div style="background:#0abfb8;padding:20px 28px;border-radius:12px 12px 0 0">
        <h2 style="margin:0;color:#fff;font-size:20px">SafeDose — Daily Report</h2>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px">${dateStr}</p>
      </div>
      <div style="background:#fff;padding:24px 28px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px">
        <p style="margin:0 0 16px">Missed doses for <strong>${patientName}</strong> today:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="background:#f8fafc">
              <th style="padding:8px 12px;text-align:left;font-weight:600">Medication</th>
              <th style="padding:8px 12px;text-align:left;font-weight:600">Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin:20px 0 0;font-size:12px;color:#94a3b8">
          Log in to SafeDose to view the full schedule.
        </p>
      </div>
    </div>`;
}

async function sendAdherenceEmails(patients, dateStr) {
  for (const patient of patients) {
    // get adherence record
    const record = await DailyAdherence.findOne({ patientId: patient._id, date: dateStr });
    if (!record || record.missedDoses === 0) continue;

    const missedList = record.details
      .filter(d => d.missedIndices.length > 0)
      .map(d => ({ name: d.name, missed: d.missedIndices.length, total: d.totalDoses }));
    if (missedList.length === 0) continue;

    const patientName = `${patient.firstName} ${patient.lastName}`;
    const subject     = `SafeDose — Missed doses for ${patientName} on ${dateStr}`;
    const html        = missedSummaryHtml(patientName, missedList, dateStr);

    // Notify the patient's linked user account
    if (patient.linkedUserId) {
      const linkedUser = await User.findById(patient.linkedUserId);
      if (linkedUser?.notifications?.email) {
        await sendEmail(linkedUser.email, subject, html);
      }
    }

    // Notify all caregivers assigned to this patient
    const assignments = await Assignment.find({ patientId: patient._id });
    for (const asgn of assignments) {
      const caregiver = await User.findById(asgn.caregiverId);
      if (caregiver?.notifications?.email) {
        await sendEmail(caregiver.email, subject, html);
      }
    }
  }
}

// ── main export ───────────────────────────────────────────────
export async function captureAllPatientsDailyAdherence(dateStr) {
  console.log(`[Adherence] Capturing daily adherence for ${dateStr}…`);

  const today    = new Date(dateStr);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const patients = await Patient.find({});
  let captured = 0;

  for (const patient of patients) {
    const medications = await Medication.find({
      patientId: patient._id,
      status:    { $ne: 'stopped' },
      startDate: { $lte: tomorrow },
      $or: [{ isOngoing: true }, { endDate: { $gte: today } }],
    });

    let totalDoses = 0;
    let takenDoses = 0;
    const details  = [];

    for (const med of medications) {
      if (!isScheduledOnDate(med, dateStr)) continue;

      const count    = doseCount(med.frequency);
      const takenSet = parseTaken(med.takenDoses, dateStr);
      const taken    = Array.from({ length: count }, (_, i) => takenSet.has(i));
      const missed   = taken.reduce((acc, t, i) => { if (!t) acc.push(i); return acc; }, []);

      totalDoses += count;
      takenDoses += taken.filter(Boolean).length;

      details.push({
        medicationId:  med._id,
        name:          med.name,
        totalDoses:    count,
        takenDoses:    taken.filter(Boolean).length,
        missedIndices: missed,
      });
    }

    const missedDoses = totalDoses - takenDoses;

    try {
      await DailyAdherence.findOneAndUpdate(
        { patientId: patient._id, date: dateStr },
        { totalDoses, takenDoses, missedDoses, details },
        { upsert: true, new: true },
      );
      captured++;
    } catch (err) {
      console.error(`[Adherence] Failed for patient ${patient._id}:`, err.message);
    }
  }

  console.log(`[Adherence] Done — ${captured}/${patients.length} records saved for ${dateStr}`);

  // ── Send email notifications ───────────────────────────────
  await sendAdherenceEmails(patients, dateStr);
}
