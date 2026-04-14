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

function buildEmailHtml({ medName, dosage, timeStr, doseNum, markTakenUrl, appUrl, type = 'now' }) {
  const headings = {
    before: { title: 'Upcoming dose in 5 minutes',         sub: 'Medication Reminder' },
    now:    { title: 'Time to take your medication',       sub: 'Medication Reminder' },
    missed: { title: 'Reminder — dose not yet taken',      sub: 'Missed Dose Alert'  },
  };
  const { title, sub } = headings[type] || headings.now;
  const headerBg = type === 'missed' ? '#b45309' : '#0d9488';
  const headerSub = type === 'missed' ? '#fde68a' : '#ccfbf1';

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr><td style="background:${headerBg};padding:24px 32px;">
          <p style="margin:0;color:#ffffff;font-size:22px;font-weight:bold;">💊 SafeDose</p>
          <p style="margin:4px 0 0;color:${headerSub};font-size:13px;">${sub}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:16px;color:#111827;font-weight:bold;">${title}</p>
          <table style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;width:100%;margin:16px 0;" cellpadding="12" cellspacing="0">
            <tr><td>
              <p style="margin:0;font-size:18px;font-weight:bold;color:#065f46;">${medName}</p>
              <p style="margin:4px 0 0;font-size:14px;color:#374151;">${dosage} &nbsp;·&nbsp; Dose ${doseNum} at ${timeStr}</p>
            </td></tr>
          </table>
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
        <tr><td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">SafeDose — Medication Safety Assistant. Do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Bitmask key for notifSent (stored in emailsSent field) ────
// Bit 1  (1):  email  — 5 min before
// Bit 2  (2):  email  — at scheduled time
// Bit 4  (4):  email  — 30 min after (if not taken)
// Bit 8  (8):  push   — 5 min before
// Bit 16 (16): push   — at scheduled time
// Bit 32 (32): push   — 30 min after (if not taken)
//
// The emailsSent field resets automatically each day (date prefix check
// in parseEmailsSent), so dedup only covers the current day.

async function sendPush(patient, payload) {
  if (!patient.pushSubscription) return;
  try {
    await webpush.sendNotification(patient.pushSubscription, JSON.stringify(payload));
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      await Patient.findByIdAndUpdate(patient._id, { $unset: { pushSubscription: '' } });
    }
  }
}

// ── Combined push + email reminder scheduler ─────────────────
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
    const wantsPush  = p => p.pushSubscription && p.notifications?.desktop;
    const wantsEmail = p => p.notifications?.email;

    for (const patient of patients) {
      const user = await User.findById(patient.linkedUserId).select('email').lean();
      if (!user) continue;

      const meds = await Medication.find({
        patientId: patient._id,
        status:    { $ne: 'stopped' },
        startDate: { $lte: tomorrow },
        $or: [{ isOngoing: true }, { endDate: { $gte: today } }],
      });

      for (const med of meds) {
        const takenSet  = parseTakenToday(med.takenDoses);
        const notifMap  = parseEmailsSent(med.emailsSent); // reuse same field
        let   updated   = false;

        for (let i = 0; i < (med.scheduleTimes || []).length; i++) {
          const timeStr   = med.scheduleTimes[i];
          const scheduled = parseTime12(timeStr);
          if (!scheduled) continue;

          // diff > 0 → dose is in the future; diff < 0 → dose is in the past
          const diff  = scheduled.getTime() - now.getTime();
          const taken = takenSet.has(i);
          let   bits  = notifMap.get(i) || 0;

          const markTakenUrl = () => {
            const token = buildMarkTakenToken(med._id, i);
            return `${APP_URL}/api/patient/mark-taken?token=${token}`;
          };
          const emailArgs = (type) => ({
            medName: med.name, dosage: med.dosage, timeStr,
            doseNum: i + 1, markTakenUrl: markTakenUrl(),
            appUrl: `${APP_URL}/patient/dashboard`, type,
          });

          // ─────────────────────────────────────────────────────
          // Window A: 5 minutes BEFORE the scheduled time
          //   diff in (0, 5 min]
          // ─────────────────────────────────────────────────────
          if (diff > 0 && diff <= 5 * 60 * 1000) {
            // Push (bit 8)
            if (wantsPush(patient) && !(bits & 8)) {
              await sendPush(patient, {
                title: 'SafeDose — Upcoming Dose',
                body:  `${med.name} (${med.dosage}) is due in 5 minutes at ${timeStr}`,
                tag:   `sd-before-${med._id}-${i}`,
              });
              notifMap.set(i, bits | 8); bits = notifMap.get(i); updated = true;
            }
            // Email (bit 1)
            if (wantsEmail(patient) && !(bits & 1)) {
              sendEmail(user.email, `💊 SafeDose: ${med.name} due in 5 minutes`, buildEmailHtml(emailArgs('before'))).catch(() => {});
              notifMap.set(i, bits | 1); bits = notifMap.get(i); updated = true;
            }
          }

          // ─────────────────────────────────────────────────────
          // Window B: AT the scheduled time (within 5 min after)
          //   diff in (-5 min, 0]
          // ─────────────────────────────────────────────────────
          if (diff <= 0 && diff > -5 * 60 * 1000) {
            // Push (bit 16)
            if (wantsPush(patient) && !(bits & 16)) {
              await sendPush(patient, {
                title: 'SafeDose — Time to Take Your Dose',
                body:  `Time to take ${med.name} (${med.dosage}) — Dose ${i + 1} at ${timeStr}`,
                tag:   `sd-now-${med._id}-${i}`,
              });
              notifMap.set(i, bits | 16); bits = notifMap.get(i); updated = true;
            }
            // Email (bit 2)
            if (wantsEmail(patient) && !(bits & 2)) {
              sendEmail(user.email, `💊 SafeDose: Time to take ${med.name}`, buildEmailHtml(emailArgs('now'))).catch(() => {});
              notifMap.set(i, bits | 2); bits = notifMap.get(i); updated = true;
            }
          }

          // ─────────────────────────────────────────────────────
          // Window C: 30 minutes AFTER scheduled time, not taken
          //   diff in (-35 min, -30 min]
          // ─────────────────────────────────────────────────────
          if (!taken && diff <= -30 * 60 * 1000 && diff > -35 * 60 * 1000) {
            // Push (bit 32)
            if (wantsPush(patient) && !(bits & 32)) {
              await sendPush(patient, {
                title: 'SafeDose — Missed Dose Reminder',
                body:  `You haven't taken ${med.name} (${med.dosage}) yet — due at ${timeStr}`,
                tag:   `sd-missed-${med._id}-${i}`,
              });
              notifMap.set(i, bits | 32); bits = notifMap.get(i); updated = true;
            }
            // Email (bit 4)
            if (wantsEmail(patient) && !(bits & 4)) {
              sendEmail(user.email, `⚠️ SafeDose: ${med.name} not yet taken`, buildEmailHtml(emailArgs('missed'))).catch(() => {});
              notifMap.set(i, bits | 4); updated = true;
            }
          }
        }

        if (updated) {
          await Medication.findByIdAndUpdate(med._id, { $set: { emailsSent: encodeEmailsSent(notifMap) } });
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
