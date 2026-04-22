import fetch from 'node-fetch';
import { GoogleAuth } from 'google-auth-library';
import path from 'path';
import { fileURLToPath } from 'url';

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
  const token  = await client.getAccessToken();
  return { Authorization: `Bearer ${token.token}` };
}

function vertexUrl(model) {
  return `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${model}:generateContent`;
}

// ── Lightweight drug name extractor — used for FDA mode ───────────────────
export async function extractDrugNames(text) {
  const model  = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const prompt = `List only the drug or medication names mentioned in this text. Return a comma-separated list of names only, with no explanation. If no drugs are mentioned, return the single word "none".\n\nText: "${text}"`;

  try {
    const authHeader = await getAuthHeader();
    const res = await fetch(vertexUrl(model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 100 },
      }),
    });

    if (!res.ok) return [];

    const json   = await res.json();
    const result = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!result || result.toLowerCase() === 'none') return [];
    return result.split(',').map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export async function callGemini(prompt) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature:     0.1,
      maxOutputTokens: 4096,
      topP:            0.8,
      topK:            20,
    },
  });

  const MAX_RETRIES = 3;
  let lastErr;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));

    const authHeader = await getAuthHeader();
    const res = await fetch(vertexUrl(model), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      signal:  AbortSignal.timeout(30000),
      body,
    });

    if (res.status === 503) {
      const err = await res.text();
      lastErr = new Error(`Gemini error 503: ${err.slice(0, 300)}`);
      continue;
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini error ${res.status}: ${err.slice(0, 300)}`);
    }

    const json  = await res.json();
    const parts = json?.candidates?.[0]?.content?.parts || [];
    return parts.map(p => p.text || '').join('').trim()
      || 'I could not find that information.';
  }

  throw lastErr;
}

// ── Web search mode — uses Gemini's built-in Google Search grounding ───────
export async function callGeminiWithSearch(message) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  const prompt = `You are SafeDose AI, a helpful and responsible medication safety assistant.
The user is asking: "${message}"

Search the web for accurate, up-to-date information to answer this question.
Keep your answer focused on medication safety, drug information, or health topics.
Always recommend consulting a doctor or pharmacist for personal medical decisions.
Do not use markdown bold (**) or symbols. Use plain numbered lists where appropriate.
Cite the source of key facts where possible (e.g. "According to Mayo Clinic...").`;

  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature:     0.2,
      maxOutputTokens: 4096,
    },
  });

  const MAX_RETRIES = 3;
  let lastErr;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt));

    const authHeader = await getAuthHeader();
    const res = await fetch(vertexUrl(model), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      signal:  AbortSignal.timeout(30000),
      body,
    });

    if (res.status === 503) {
      const err = await res.text();
      lastErr = new Error(`Gemini error 503: ${err.slice(0, 300)}`);
      continue;
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini error ${res.status}: ${err.slice(0, 300)}`);
    }

    const json  = await res.json();
    const parts = json?.candidates?.[0]?.content?.parts || [];
    return parts.map(p => p.text || '').join('').trim()
      || 'I could not find that information.';
  }

  throw lastErr;
}
