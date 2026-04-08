// src/index.js

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { connectDB } from './lib/mongodb.js';
import chatRouter from './routes/chat.js';
import ttsRouter from './routes/tts.js';

dotenv.config();

// ── Suppress noisy PDF parser warnings ───────────────────────────────────
const _warn = console.warn;
console.warn = (...args) => {
  const s = String(args[0]);
  if (s.includes('glyf') || s.includes('TT:') || s.includes('punycode')) return;
  _warn.apply(console, args);
};

// ── Express app ───────────────────────────────────────────────────────────
const app = express();

app.use(cors({
  origin:      process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true, // allows cookies to be sent from the web app
}));

app.use(express.json());
app.use('/api/tts', ttsRouter);

// ── Routes ────────────────────────────────────────────────────────────────
app.use('/api/chat', chatRouter);

// ── Health check — useful for deployment monitoring ───────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'safedose-chat' }));

// ── Start ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5002;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[SafeDose Chat Service] Running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('[Startup] Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });