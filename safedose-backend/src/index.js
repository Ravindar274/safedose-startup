// src/index.js

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import webpush from 'web-push';
import jwt from 'jsonwebtoken';
import { sendEmail } from './lib/sendEmail.js';

import { connectDB } from './db.js';
import authRoutes from './routes/auth.js';
import caregiverRoutes from './routes/caregiver.js';
import patientRoutes from './routes/patient.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import pushRoutes from './routes/push.js';
import { captureAllPatientsDailyAdherence } from './lib/captureAdherence.js';
import User      from './models/User.js';
import Patient   from './models/Patient.js';
import Medication from './models/Medication.js';

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true, // required for cookies to be sent cross-origin
}));
app.use(express.json());
app.use(cookieParser());

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/caregiver', caregiverRoutes);
app.use('/api/patient',   patientRoutes);
app.use('/api/user',      userRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/push',      pushRoutes);

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── root path ─────────────────────────────────────────────
app.get('/', (_req, res) => res.json({ status: 'ok' }));

// ── Web Push setup ───────────────────────────────────────────
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_MAILTO}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ── Push notification helpers ────────────────────────────────
function parseTakenToday(takenDoses) {
  if (!takenDoses) return new Set();
  const today = new Date().toISOString().slice(0, 10);
  const [datePart, indicesPart] = takenDoses.split(':');
  if (datePart !== today || !indicesPart) return new Set();
  return new Set(indicesPart.split(',').map(Number));
}

function parseTime12(timeStr) {
  if (!timeStr) return null;
  const [t, period] = timeStr.split(' ');
  let [h, m] = t.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// ── Email helpers ────────────────────────────────────────────
function parseEmailsSent(emailsSent) {
  // Returns Map<doseIdx, bits> where bit 0 = email1 sent, bit 1 = email2 sent
  if (!emailsSent) return new Map();
  const today = new Date().toISOString().slice(0, 10);
  const [datePart, rest] = emailsSent.split(':');
  if (datePart !== today || !rest) return new Map();
  const map = new Map();
  rest.split(',').forEach(entry => {
    const [idx, bits] = entry.split('=').map(Number);
    if (!isNaN(idx) && !isNaN(bits)) map.set(idx, bits);
  });
  return map;
}

function encodeEmailsSent(map) {
  const today   = new Date().toISOString().slice(0, 10);
  const entries = [...map.entries()].map(([i, b]) => `${i}=${b}`).join(',');
  return `${today}:${entries}`;
}

function buildMarkTakenToken(medicationId, doseIndex) {
  const date = new Date().toISOString().slice(0, 10);
  return jwt.sign({ medicationId, doseIndex, date }, process.env.JWT_SECRET, { expiresIn: '25h' });
}

function buildEmailHtml({ medName, dosage, timeStr, doseNum, markTakenUrl, appUrl }) {
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:#0d9488;padding:24px 32px;">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;">💊 SafeDose</p>
          <p style="margin:4px 0 0;color:#ccfbf1;font-size:13px;">Medication Reminder</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:16px;color:#111827;font-weight:bold;">Time to take your medication</p>
          <table style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;width:100%;margin:16px 0;" cellpadding="12" cellspacing="0">
            <tr><td>
              <p style="margin:0;font-size:18px;font-weight:bold;color:#065f46;">${medName}</p>
              <p style="margin:4px 0 0;font-size:14px;color:#374151;">${dosage} &nbsp;·&nbsp; Dose ${doseNum} at ${timeStr}</p>
            </td></tr>
          </table>

          <!-- Mark as Taken button -->
          <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td style="background:#0d9488;border-radius:8px;">
              <a href="${markTakenUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;">
                ✓ Mark as Taken
              </a>
            </td></tr>
          </table>

          <p style="margin:0;font-size:13px;color:#6b7280;">
            Or <a href="${appUrl}" style="color:#0d9488;text-decoration:none;">open the app</a> to manage your medications.
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
}

// ── Combined push + email reminder scheduler ─────────────────
// Queries Patient collection directly for notification preferences
// (notifications and pushSubscription now live in Patient, not User).
async function sendReminders() {
  try {
    const patients = await Patient.find({
      linkedUserId: { $ne: null },
      $or: [
        { pushSubscription: { $ne: null }, 'notifications.desktop': true },
        { 'notifications.email': true },
      ],
    });
    if (!patients.length) return;

    const now      = new Date();
    const today    = new Date(now); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const APP_URL  = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

    for (const patient of patients) {
      // Fetch the linked User just for the email address
      const user = await User.findById(patient.linkedUserId).select('email').lean();
      if (!user) continue;

      const meds = await Medication.find({
        patientId: patient._id,
        status:    { $ne: 'stopped' },
        startDate: { $lte: tomorrow },
        $or: [{ isOngoing: true }, { endDate: { $gte: today } }],
      });

      // ── Push notification — collect all doses due right now ──
      const pushDue = [];

      for (const med of meds) {
        const takenSet    = parseTakenToday(med.takenDoses);
        const emailsMap   = parseEmailsSent(med.emailsSent);
        let emailsUpdated = false;

        (med.scheduleTimes || []).forEach((timeStr, i) => {
          const scheduled = parseTime12(timeStr);
          if (!scheduled) return;
          const diff = scheduled.getTime() - now.getTime();

          // ── Push: due within next 5 min or just passed (within 1 min) ──
          if (patient.pushSubscription && patient.notifications?.desktop) {
            if (!takenSet.has(i) && diff <= 5 * 60 * 1000 && diff > -60 * 1000) {
              pushDue.push({ name: med.name, dosage: med.dosage, timeStr });
            }
          }

          // ── Email 1: fires at scheduled time (within 5 min window) ──
          if (patient.notifications?.email) {
            const bits = emailsMap.get(i) || 0;
            if (!(bits & 1) && diff <= 0 && diff > -5 * 60 * 1000) {
              const token        = buildMarkTakenToken(med._id, i);
              const markTakenUrl = `${APP_URL}/api/patient/mark-taken?token=${token}`;
              sendEmail(
                user.email,
                `💊 SafeDose: Time to take ${med.name}`,
                buildEmailHtml({ medName: med.name, dosage: med.dosage, timeStr, doseNum: i + 1, markTakenUrl, appUrl: `${APP_URL}/patient/dashboard` })
              ).catch(() => {});
              emailsMap.set(i, bits | 1);
              emailsUpdated = true;
            }

            // ── Email 2: 30 min after scheduled time, only if not taken ──
            if (!(bits & 2) && !takenSet.has(i) && diff <= -30 * 60 * 1000 && diff > -35 * 60 * 1000) {
              const token        = buildMarkTakenToken(med._id, i);
              const markTakenUrl = `${APP_URL}/api/patient/mark-taken?token=${token}`;
              sendEmail(
                user.email,
                `⚠️ SafeDose: Reminder — ${med.name} not yet taken`,
                buildEmailHtml({ medName: med.name, dosage: med.dosage, timeStr, doseNum: i + 1, markTakenUrl, appUrl: `${APP_URL}/patient/dashboard` })
              ).catch(() => {});
              emailsMap.set(i, bits | 2);
              emailsUpdated = true;
            }
          }
        });

        if (emailsUpdated) {
          await Medication.findByIdAndUpdate(med._id, { $set: { emailsSent: encodeEmailsSent(emailsMap) } });
        }
      }

      // Send push if any doses are due
      if (pushDue.length && patient.pushSubscription) {
        const body = pushDue.length === 1
          ? `Time to take ${pushDue[0].name} (${pushDue[0].dosage}) at ${pushDue[0].timeStr}`
          : `${pushDue.length} doses due: ${pushDue.map(d => d.name).join(', ')}`;
        try {
          await webpush.sendNotification(
            patient.pushSubscription,
            JSON.stringify({ title: 'SafeDose — Dose Reminder', body, tag: `safedose-${Date.now()}` })
          );
        } catch (err) {
          if (err.statusCode === 410) {
            // Stale subscription — clear it from Patient
            await Patient.findByIdAndUpdate(patient._id, { $unset: { pushSubscription: '' } });
          }
        }
      }
    }
  } catch (err) {
    console.error('[REMINDER SCHEDULER]', err);
  }
}

// ── Daily adherence scheduler ─────────────────────────────────
// Fires every day at 23:59 to snapshot each patient's taken/missed doses.
// Uses recursive setTimeout so no external cron package is needed.
function scheduleDailyCapture() {
  const now     = new Date();
  const target  = new Date(now);
  target.setHours(23, 59, 0, 0);
  if (now >= target) target.setDate(target.getDate() + 1); // already past 23:59 → tomorrow

  const msUntil = target.getTime() - now.getTime();
  console.log(`[Adherence] Next capture in ${Math.round(msUntil / 60000)} min`);

  setTimeout(async () => {
    const dateStr = new Date().toISOString().slice(0, 10);
    await captureAllPatientsDailyAdherence(dateStr);
    scheduleDailyCapture(); // schedule the next day's run
  }, msUntil);
}

// ── Start ────────────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
  scheduleDailyCapture();
  setInterval(sendReminders, 5 * 60 * 1000); // reminders every 5 min
  sendReminders();                             // run once on startup
});
