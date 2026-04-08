// src/lib/gemini.js

import fetch from 'node-fetch';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// ── Lightweight drug name extractor — used for FDA mode ───────────────────
export async function extractDrugNames(text) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];

  const prompt = `List only the drug or medication names mentioned in this text. Return a comma-separated list of names only, with no explanation. If no drugs are mentioned, return the single word "none".\n\nText: "${text}"`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    signal:  AbortSignal.timeout(30000), // 30s timeout
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:      0.1,   // Low = focused, factual responses
        maxOutputTokens:  4096,
        topP:             0.8,
        topK:             20,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err.slice(0, 300)}`);
  }

  const json  = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts || [];
  return parts.map(p => p.text || '').join('').trim()
    || 'I could not find that information.';
}



