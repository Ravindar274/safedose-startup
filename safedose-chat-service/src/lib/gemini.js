// src/lib/gemini.js

import fetch from 'node-fetch';

// ── Lightweight drug name extractor — used for FDA mode ───────────────────
export async function extractDrugNames(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const prompt = `List only the drug or medication names mentioned in this text. Return a comma-separated list of names only, with no explanation. If no drugs are mentioned, return the single word "none".\n\nText: "${text}"`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 100 },
      }),
    });

    if (!res.ok) return [];

    const json = await res.json();
    const result = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!result || result.toLowerCase() === 'none') return [];
    return result.split(',').map(s => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured in .env');

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature:     0.1,
      maxOutputTokens: 4096,
      topP:            0.8,
      topK:            20,
    },
  });

  // Retry up to 3 times on 503 (model overloaded) with exponential back-off
  const MAX_RETRIES = 3;
  let lastErr;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 1000 * attempt)); // 1s, 2s
    }

    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  AbortSignal.timeout(30000),
      body,
    });

    if (res.status === 503) {
      const err = await res.text();
      lastErr = new Error(`Gemini error 503: ${err.slice(0, 300)}`);
      continue; // retry
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured in .env');

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

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

    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
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
