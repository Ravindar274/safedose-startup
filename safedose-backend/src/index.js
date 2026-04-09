// src/index.js

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { connectDB } from './db.js';
import authRoutes from './routes/auth.js';
import caregiverRoutes from './routes/caregiver.js';
import patientRoutes from './routes/patient.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import { captureAllPatientsDailyAdherence } from './lib/captureAdherence.js';

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

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── root path ─────────────────────────────────────────────
app.get('/', (_req, res) => res.json({ status: 'ok' }));

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
});
