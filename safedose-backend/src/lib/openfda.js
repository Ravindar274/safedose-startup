function normalizeDrugText(value) {
  return String(value || '')
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export async function searchOpenFDADrugs(query = '', skip = 0, limit = 12) {
  const safeSkip = Math.max(0, Number.parseInt(skip, 10) || 0);
  const safeLimit = Math.min(24, Math.max(1, Number.parseInt(limit, 10) || 12));
  const apiKey = process.env.OPENFDA_API_KEY || '';

  let url = `https://api.fda.gov/drug/label.json?limit=${safeLimit}&skip=${safeSkip}`;
  if (apiKey) url += `&api_key=${encodeURIComponent(apiKey)}`;

  const q = String(query || '').trim();
  if (q) {
    // Use wildcards for partial/substring matching
    const searchVal = `(openfda.brand_name:${q}* OR openfda.generic_name:${q}*)`;
    url += `&search=${encodeURIComponent(searchVal)}`;
  }

  const response = await fetch(url);
  if (response.status === 404) {
    return { drugs: [], total: 0 };
  }
  if (!response.ok) {
    throw new Error(`OpenFDA request failed with status ${response.status}`);
  }

  const data = await response.json();
  const total = data.meta?.results?.total ?? 0;
  const drugs = (data.results || []).map((item) => ({
    id:           item.openfda?.package_ndc?.[0]        ?? '',
    brandName:    (item.openfda?.brand_name?.[0]        ?? 'Unknown').replace(/_/g, ' '),
    genericName:  (item.openfda?.generic_name?.[0]      ?? '').replace(/_/g, ' '),
    manufacturer:  item.openfda?.manufacturer_name?.[0] ?? '',
    route:        (item.openfda?.route?.[0]             ?? '').toLowerCase(),
    indication:   (item.indications_and_usage?.[0]      ?? '').slice(0, 220),
    rxcui:         item.openfda?.rxcui?.[0]             ?? '',
  }));

  return { drugs, total };
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