// src/lib/fdaContext.js
// Fetches drug information from the openFDA API.
// Free — no API key required.
// Docs: https://open.fda.gov/apis/drug/label/

import fetch from 'node-fetch';

// ── Cache ─────────────────────────────────────────────────────────────────
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes — FDA data doesn't change often

// ── Main export ───────────────────────────────────────────────────────────
// Pass an array of medication names extracted from the user's MongoDB context.
// Returns a formatted string of FDA drug info for all of them.
export async function fetchFDAContext(medicationNames) {
  if (!medicationNames || medicationNames.length === 0) return '';

  const results = await Promise.all(
    medicationNames.map(name => fetchSingleDrug(name))
  );

  const valid = results.filter(Boolean);
  return valid.length > 0
    ? `=== FDA Drug Information ===\n${valid.join('\n\n')}`
    : '';
}

// ── Fetch one drug ────────────────────────────────────────────────────────
async function fetchSingleDrug(drugName) {
  const key = drugName.toLowerCase().trim();

  // Check cache
  const cached = cache.get(key);
  if (cached && (Date.now() - cached.time) < CACHE_TTL) {
    console.log(`[FDA] Cache hit — ${drugName}`);
    return cached.data;
  }

  try {
    const encoded = encodeURIComponent(key);

    // Try brand name first, then generic name
    const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encoded}"+openfda.generic_name:"${encoded}"&limit=1`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000), // 8 second timeout
    });

    if (!res.ok) {
      // 404 just means drug not found in FDA database — not an error
      if (res.status === 404) return null;
      console.warn(`[FDA] ${drugName} — HTTP ${res.status}`);
      return null;
    }

    const json = await res.json();
    const result = json?.results?.[0];
    if (!result) return null;

    const text = formatFDAResult(drugName, result);
    cache.set(key, { data: text, time: Date.now() });
    console.log(`[FDA] ✓ Fetched "${drugName}"`);
    return text;

  } catch (err) {
    console.warn(`[FDA] Could not fetch "${drugName}":`, err.message);
    return null;
  }
}

// ── Format FDA result into readable text ──────────────────────────────────
function formatFDAResult(name, result) {
  const lines = [`--- ${name.toUpperCase()} (FDA) ---`];

  // Fields where more content = better answers; give them a higher limit
  const HIGH_LIMIT_FIELDS = new Set(['drug_interactions', 'warnings', 'warnings_and_cautions', 'boxed_warning']);

  const pick = (field) => {
    const val = result[field];
    if (!val || !val.length) return null;
    const limit = HIGH_LIMIT_FIELDS.has(field) ? 2000 : 600;
    return String(val[0]).replace(/\s+/g, ' ').trim().slice(0, limit);
  };

  const brandNames   = result?.openfda?.brand_name?.join(', ');
  const genericNames = result?.openfda?.generic_name?.join(', ');

  if (brandNames)   lines.push(`Brand name: ${brandNames}`);
  if (genericNames) lines.push(`Generic name: ${genericNames}`);

  const fields = [
    { key: 'purpose',                 label: 'Purpose' },
    { key: 'indications_and_usage',   label: 'Indications & Usage' },
    { key: 'dosage_and_administration', label: 'Dosage' },
    { key: 'warnings',                label: 'Warnings' },
    { key: 'drug_interactions',       label: 'Drug Interactions' },
    { key: 'contraindications',       label: 'Contraindications' },
    { key: 'adverse_reactions',       label: 'Adverse Reactions' },
    { key: 'keep_out_of_reach_of_children', label: 'Keep out of reach of children' },
  ];

  for (const { key, label } of fields) {
    const val = pick(key);
    if (val) lines.push(`${label}: ${val}`);
  }

  return lines.join('\n');
}