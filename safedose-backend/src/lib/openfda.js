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