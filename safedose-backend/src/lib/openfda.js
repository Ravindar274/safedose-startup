function normalizeDrugText(value) {
  return String(value || '')
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function cleanDrugText(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasUsableDrugName(drug) {
  const brand = normalizeDrugText(drug.brandName);
  const generic = normalizeDrugText(drug.genericName);
  return (brand && brand !== 'unknown') || !!generic;
}

function escapeRegex(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeOpenFDASearchValue(text) {
  return String(text || '').replace(/"/g, '\\"').trim();
}

function getSeverityFromText(text) {
  const normalized = normalizeDrugText(text);
  if (!normalized) return 'Medium';

  if (
    normalized.includes('contraindicated') ||
    normalized.includes('do not use') ||
    normalized.includes('avoid concomitant') ||
    normalized.includes('serious') ||
    normalized.includes('severe')
  ) {
    return 'High';
  }

  if (
    normalized.includes('monitor') ||
    normalized.includes('caution') ||
    normalized.includes('dose adjustment') ||
    normalized.includes('may increase') ||
    normalized.includes('may decrease')
  ) {
    return 'Medium';
  }

  return 'Low';
}

function getInteractionSnippet(text, term) {
  const source = String(text || '').replace(/\s+/g, ' ').trim();
  const token = String(term || '').toLowerCase();
  if (!source) return '';

  const maxLen = 280;
  const idx = source.toLowerCase().indexOf(token);

  // No match for the token: return a clean intro snippet.
  if (idx < 0) {
    return source.length <= maxLen ? source : `${source.slice(0, maxLen)}...`;
  }

  const tokenEnd = idx + token.length;
  const leftPart = source.slice(0, idx);
  const rightPart = source.slice(tokenEnd);

  // Prefer sentence-like boundaries around the match.
  const leftBoundary = Math.max(
    leftPart.lastIndexOf('. '),
    leftPart.lastIndexOf('! '),
    leftPart.lastIndexOf('? '),
    leftPart.lastIndexOf('; ')
  );
  const rightCandidates = [
    rightPart.indexOf('. '),
    rightPart.indexOf('! '),
    rightPart.indexOf('? '),
    rightPart.indexOf('; '),
  ].filter((v) => v >= 0);

  let start = leftBoundary >= 0 ? leftBoundary + 2 : Math.max(0, idx - 120);
  let end = rightCandidates.length
    ? tokenEnd + Math.min(...rightCandidates) + 1
    : Math.min(source.length, tokenEnd + 160);

  // Keep snippet compact while preserving a whole phrase around the match.
  if (end - start > maxLen) {
    const half = Math.floor(maxLen / 2);
    start = Math.max(0, idx - half);
    end = Math.min(source.length, tokenEnd + half);
  }

  // Avoid chopping words at either boundary.
  while (start > 0 && /[a-z0-9]/i.test(source[start - 1])) start -= 1;
  while (end < source.length && /[a-z0-9]/i.test(source[end])) end += 1;

  const snippet = source.slice(start, end).trim();
  const prefix = start > 0 ? '... ' : '';
  const suffix = end < source.length ? ' ...' : '';
  return `${prefix}${snippet}${suffix}`;
}

async function fetchDrugInteractionLabelBlocks(term, apiKey) {
  const safeTerm = escapeOpenFDASearchValue(term);
  if (!safeTerm) return [];

  let url = 'https://api.fda.gov/drug/label.json?limit=10';
  if (apiKey) url += `&api_key=${encodeURIComponent(apiKey)}`;

  const searchVal = `(openfda.generic_name:"${safeTerm}" OR openfda.brand_name:"${safeTerm}")`;
  url += `&search=${encodeURIComponent(searchVal)}`;

  const response = await fetch(url);
  if (response.status === 404) return [];
  if (!response.ok) {
    throw new Error(`OpenFDA interaction request failed with status ${response.status}`);
  }

  const data = await response.json();
  const blocks = [];

  (data.results || []).forEach((item) => {
    const interactionSections = item.drug_interactions || [];
    interactionSections.forEach((section) => {
      const clean = cleanDrugText(section);
      if (clean) blocks.push(clean);
    });
  });

  return blocks;
}

export async function searchOpenFDADrugs(query = '', skip = 0, limit = 12) {
  const safeSkip = Math.max(0, Number.parseInt(skip, 10) || 0);
  const safeLimit = Math.min(30, Math.max(1, Number.parseInt(limit, 10) || 12));
  const apiKey = process.env.OPENFDA_API_KEY || '';

  const q = String(query || '').trim();

  const buildUrl = (rawSkip, rawLimit) => {
    let url = `https://api.fda.gov/drug/label.json?limit=${rawLimit}&skip=${rawSkip}`;
    if (apiKey) url += `&api_key=${encodeURIComponent(apiKey)}`;
    if (q) {
      // Use wildcards for partial/substring matching
      const searchVal = `(openfda.brand_name:${q}* OR openfda.generic_name:${q}*)`;
      url += `&search=${encodeURIComponent(searchVal)}`;
    }
    return url;
  };

  const batchSize = Math.min(100, Math.max(50, safeLimit * 3));
  const collected = [];
  let rawTotal = 0;
  let rawSkip = 0;
  let validSeen = 0;

  while (collected.length < safeLimit) {
    const response = await fetch(buildUrl(rawSkip, batchSize));
    if (response.status === 404) {
      return { drugs: [], total: 0 };
    }
    if (!response.ok) {
      throw new Error(`OpenFDA request failed with status ${response.status}`);
    }

    const data = await response.json();
    const results = data.results || [];
    rawTotal = data.meta?.results?.total ?? 0;

    if (!results.length) break;

    const validBatch = results
      .map((item) => ({
        id:           item.openfda?.package_ndc?.[0]        ?? '',
        brandName:    cleanDrugText(item.openfda?.brand_name?.[0] ?? 'Unknown'),
        genericName:  cleanDrugText(item.openfda?.generic_name?.[0] ?? ''),
        manufacturer: cleanDrugText(item.openfda?.manufacturer_name?.[0] ?? ''),
        route:        cleanDrugText(item.openfda?.route?.[0] ?? '').toLowerCase(),
        indication:   cleanDrugText(item.indications_and_usage?.[0] ?? '').slice(0, 220),
        rxcui:        item.openfda?.rxcui?.[0] ?? '',
      }))
      .filter(hasUsableDrugName);

    const remainingSkip = Math.max(0, safeSkip - validSeen);
    if (remainingSkip < validBatch.length) {
      collected.push(...validBatch.slice(remainingSkip, remainingSkip + (safeLimit - collected.length)));
    }

    validSeen += validBatch.length;
    rawSkip += results.length;

    if (rawSkip >= rawTotal) break;
  }

  return { drugs: collected, total: rawTotal };
}

export async function validateOpenFDADrugSelection(selectedDrug) {
  if (!selectedDrug || !selectedDrug.brandName) return null;

  const { drugs } = await searchOpenFDADrugs(selectedDrug.brandName, 0, 15);
  const expectedBrand = normalizeDrugText(selectedDrug.brandName);
  const expectedGeneric = normalizeDrugText(selectedDrug.genericName);
  const expectedId = String(selectedDrug.id || '').trim();

  return drugs.find((drug) => {
    const brandMatches = normalizeDrugText(drug.brandName) === expectedBrand;
    const genericMatches = !expectedGeneric || normalizeDrugText(drug.genericName) === expectedGeneric;
    const idMatches = !expectedId || String(drug.id || '').trim() === expectedId;
    return brandMatches && genericMatches && idMatches;
  }) || null;
}

export async function findOpenFDAMedicationInteractions(medications = []) {
  const apiKey = process.env.OPENFDA_API_KEY || '';
  const meds = medications
    .map((med) => {
      const id = String(med?._id || med?.id || '').trim();
      const name = cleanDrugText(med?.name || '');
      const genericName = cleanDrugText(med?.genericName || '');
      return { id, name, genericName };
    })
    .filter((med) => med.id && (med.name || med.genericName));

  if (meds.length < 2) return [];

  // Keep API volume bounded while still useful for typical regimens.
  const cappedMeds = meds.slice(0, 10);

  const interactionBlocksByMedId = new Map();
  for (const med of cappedMeds) {
    const primaryTerm = med.genericName || med.name;
    const secondaryTerm = med.genericName && med.name && med.genericName !== med.name ? med.name : '';

    const primaryBlocks = await fetchDrugInteractionLabelBlocks(primaryTerm, apiKey);
    const secondaryBlocks = secondaryTerm
      ? await fetchDrugInteractionLabelBlocks(secondaryTerm, apiKey)
      : [];

    interactionBlocksByMedId.set(med.id, [...primaryBlocks, ...secondaryBlocks]);
  }

  const found = new Map();

  for (const source of cappedMeds) {
    const blocks = interactionBlocksByMedId.get(source.id) || [];
    if (!blocks.length) continue;

    for (const target of cappedMeds) {
      if (source.id === target.id) continue;

      const terms = [target.genericName, target.name]
        .map((t) => normalizeDrugText(t))
        .filter((t) => t && t !== 'unknown' && t.length >= 3);

      if (!terms.length) continue;

      for (const block of blocks) {
        const normalizedBlock = normalizeDrugText(block);
        if (!normalizedBlock) continue;

        const matchedTerm = terms.find((term) => {
          const regex = new RegExp(`(^|[^a-z0-9])${escapeRegex(term)}([^a-z0-9]|$)`, 'i');
          return regex.test(normalizedBlock);
        });

        if (!matchedTerm) continue;

        const pairKey = [source.id, target.id].sort().join('|');
        if (!found.has(pairKey)) {
          found.set(pairKey, {
            medicationA: {
              id: source.id,
              name: source.name || source.genericName,
              genericName: source.genericName,
            },
            medicationB: {
              id: target.id,
              name: target.name || target.genericName,
              genericName: target.genericName,
            },
            severity: getSeverityFromText(block),
            source: 'OpenFDA label drug_interactions',
            evidence: getInteractionSnippet(block, matchedTerm),
          });
        }
      }
    }
  }

  return [...found.values()];
}