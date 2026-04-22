// src/routes/tts.js

import express from 'express';
import fetch from 'node-fetch';
import { GoogleAuth } from 'google-auth-library';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/authMiddleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROJECT_ID = 'safedose-medtracker';
const LOCATION   = 'us-central1';

const auth = new GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS
    || path.resolve(__dirname, '../../config/safedose-medtracker.json'),
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

async function getAuthHeader() {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return { Authorization: `Bearer ${token.token}` };
}

const router = express.Router();

// ── PCM → WAV converter ────────────────────────────────────────────────
function pcmToWav(pcmBuffer, sampleRate = 24000) {
  const numChannels = 1;
  const bitsPerSample = 16;

  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;

  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  pcmBuffer.copy(buffer, 44);

  return buffer;
}

// ── Gemini TTS ─────────────────────────────────────────────────────────
async function generateTTS(text) {
  const payload = {
    contents: [
      {
        parts: [{ text: `Speak clearly and naturally: ${text}` }]
      }
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: "Aoede"
          }
        }
      }
    },
  };

  const authHeader = await getAuthHeader();
  const ttsModel   = 'gemini-2.5-flash-preview-tts';
  const response = await fetch(
    `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${ttsModel}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini TTS failed (${response.status}): ${errText.slice(0, 200)}`);
  }

  const data = await response.json();

  const inlineData =
    data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;

  if (!inlineData) {
    throw new Error('No audio returned from Gemini');
  }

  const pcmBuffer = Buffer.from(inlineData.data, 'base64');

  const match = (inlineData.mimeType || '').match(/rate=(\d+)/);
  const sampleRate = match ? parseInt(match[1]) : 24000;

  return pcmToWav(pcmBuffer, sampleRate);
}

// ── POST /api/tts ──────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text is required.' });

  try {
    const audioBuffer = await generateTTS(text);

    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', audioBuffer.length);
    res.send(audioBuffer);

  } catch (err) {
    console.error('[POST /api/tts]', err);
    if (!res.headersSent) res.status(500).json({ error: 'TTS failed.' });
    else res.end();
  }
});

export default router;