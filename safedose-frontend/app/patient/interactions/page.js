'use client';

import '../patient-dashboard.css';
import './safety.css';
import { useEffect, useMemo, useState } from 'react';

function parseTime(timeStr) {
  if (!timeStr) return null;
  const [t, period] = timeStr.split(' ');
  let [h, m] = t.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function getDoseStatus(timeStr, nextTimeStr, taken) {
  if (taken) return 'taken';
  const now = new Date();
  const scheduled = parseTime(timeStr);
  if (!scheduled || now < scheduled) return 'upcoming';
  if (nextTimeStr) {
    const next = parseTime(nextTimeStr);
    if (next && now >= next) return 'missed';
  }
  return 'due';
}

function normalize(str) {
  return (str || '').trim().toLowerCase();
}

export default function PatientSafetyCenterPage() {
  const [allMeds, setAllMeds] = useState([]);
  const [todayMeds, setTodayMeds] = useState([]);
  const [openFdaInteractions, setOpenFdaInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fdaWarning, setFdaWarning] = useState('');

  async function fetchJsonSafe(url) {
    const res = await fetch(url);
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    }

    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      data: null,
      text,
    };
  }

  useEffect(() => {
    async function loadSafetyData() {
      setLoading(true);
      setError('');
      setFdaWarning('');
      try {
        const [allResult, todayResult, fdaResult] = await Promise.all([
          fetchJsonSafe('/api/patient/medications'),
          fetchJsonSafe('/api/patient/medications/today'),
          fetchJsonSafe('/api/patient/interactions/openfda'),
        ]);

        if (!allResult.ok || !todayResult.ok || !allResult.data || !todayResult.data) {
          const allErr = allResult.data?.error;
          const todayErr = todayResult.data?.error;
          setError(allErr || todayErr || 'Failed to load safety data.');
          return;
        }

        setAllMeds(allResult.data.medications || []);
        setTodayMeds(todayResult.data.medications || []);

        if (fdaResult.ok && fdaResult.data) {
          setOpenFdaInteractions(fdaResult.data.interactions || []);
        } else {
          setOpenFdaInteractions([]);
          setFdaWarning('OpenFDA interaction data is temporarily unavailable. Showing local safety checks only.');
        }
      } catch {
        setError('Could not load safety data.');
      } finally {
        setLoading(false);
      }
    }

    loadSafetyData();
  }, []);

  const activeMeds = useMemo(
    () => allMeds.filter((med) => med.status !== 'stopped'),
    [allMeds]
  );

  const interactionFlags = useMemo(
    () => activeMeds.filter((med) => med.status === 'interaction'),
    [activeMeds]
  );

  const duplicateGenericGroups = useMemo(() => {
    const groups = new Map();
    activeMeds.forEach((med) => {
      const key = normalize(med.genericName || med.name);
      if (!key) return;
      const list = groups.get(key) || [];
      list.push(med);
      groups.set(key, list);
    });

    return [...groups.entries()]
      .filter(([, meds]) => meds.length > 1)
      .map(([generic, meds]) => ({
        generic,
        names: meds.map((m) => m.name),
        count: meds.length,
      }));
  }, [activeMeds]);

  const doseRisk = useMemo(() => {
    let missed = 0;
    let due = 0;

    todayMeds.forEach((med) => {
      const times = med.scheduleTimes || [];
      times.forEach((timeStr, idx) => {
        if (med.takenToday?.[idx]) return;
        const status = getDoseStatus(timeStr, times[idx + 1], false);
        if (status === 'missed') missed += 1;
        if (status === 'due') due += 1;
      });
    });

    return { missed, due };
  }, [todayMeds]);

  const highLoad = activeMeds.length >= 8;

  const reviewItems = useMemo(() => {
    const items = [];

    openFdaInteractions.forEach((pair) => {
      const type = pair.severity === 'High' ? 'High' : pair.severity === 'Low' ? 'Low' : 'Medium';
      const medA = pair.medicationA?.name || pair.medicationA?.genericName || 'Medication A';
      const medB = pair.medicationB?.name || pair.medicationB?.genericName || 'Medication B';

      items.push({
        type,
        title: `OpenFDA: possible interaction between ${medA} and ${medB}`,
        detail: pair.evidence || 'OpenFDA label text indicates this pair may interact. Review with your caregiver, pharmacist, or doctor.',
      });
    });

    interactionFlags.forEach((med) => {
      items.push({
        type: 'High',
        title: `${med.name} is flagged for interaction review`,
        detail: 'This medication was marked with interaction status. Review with your caregiver, pharmacist, or doctor.',
      });
    });

    duplicateGenericGroups.forEach((group) => {
      items.push({
        type: 'Medium',
        title: `Duplicate active ingredient: ${group.generic}`,
        detail: `${group.count} active entries found (${group.names.join(', ')}). Confirm no duplicate therapy.`,
      });
    });

    if (doseRisk.missed > 0) {
      items.push({
        type: 'Medium',
        title: `${doseRisk.missed} missed dose${doseRisk.missed > 1 ? 's' : ''} today`,
        detail: 'Use your schedule timeline to reconcile missed doses and update taken status if needed.',
      });
    }

    if (doseRisk.due > 0) {
      items.push({
        type: 'Low',
        title: `${doseRisk.due} dose${doseRisk.due > 1 ? 's are' : ' is'} due now`,
        detail: 'Take due medications as prescribed, then mark them as taken in the dashboard.',
      });
    }

    if (highLoad) {
      items.push({
        type: 'Low',
        title: `High regimen complexity (${activeMeds.length} active medications)`,
        detail: 'Complex schedules increase the chance of mistakes. Consider simplification review with your care team.',
      });
    }

    return items;
  }, [openFdaInteractions, interactionFlags, duplicateGenericGroups, doseRisk, highLoad, activeMeds.length]);

  const safetyScore = useMemo(() => {
    let score = 100;
    const highOpenFda = openFdaInteractions.filter((item) => item.severity === 'High').length;
    const mediumOpenFda = openFdaInteractions.filter((item) => item.severity !== 'High' && item.severity !== 'Low').length;
    const lowOpenFda = openFdaInteractions.filter((item) => item.severity === 'Low').length;

    score -= highOpenFda * 18;
    score -= mediumOpenFda * 10;
    score -= lowOpenFda * 4;
    score -= interactionFlags.length * 25;
    score -= duplicateGenericGroups.length * 15;
    score -= Math.min(doseRisk.missed * 5, 30);
    score -= Math.min(doseRisk.due * 2, 10);
    if (highLoad) score -= 8;
    return Math.max(0, score);
  }, [openFdaInteractions, interactionFlags.length, duplicateGenericGroups.length, doseRisk, highLoad]);

  const interactionAlertCount = openFdaInteractions.length + interactionFlags.length;

  return (
    <>
      <div className="app-topbar">
        <div className="topbar-title">
          <h2>Safety Center</h2>
          <p>Medication safety checks based on your current regimen and today's dose progress</p>
        </div>
      </div>

      <main className="app-main">
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-val">{safetyScore}</div>
            <div className="stat-lbl">Safety score</div>
            <div className="stat-change">{safetyScore >= 85 ? 'stable' : safetyScore >= 65 ? 'needs review' : 'urgent review suggested'}</div>
          </div>

          <div className="stat-card">
            <div className="stat-val">{reviewItems.length}</div>
            <div className="stat-lbl">Review items</div>
            <div className="stat-change">interaction and adherence checks</div>
          </div>

          <div className="stat-card">
            <div className="stat-val">{interactionAlertCount}</div>
            <div className="stat-lbl">Interaction flags</div>
            <div className="stat-change">OpenFDA and medication records</div>
          </div>

          <div className="stat-card">
            <div className="stat-val">{doseRisk.missed}</div>
            <div className="stat-lbl">Missed today</div>
            <div className="stat-change">unmarked after due time</div>
          </div>
        </div>

        <div className="card-box">
          <div className="section-hdr">
            <h3>Safety Review</h3>
          </div>

          {!loading && !error && fdaWarning ? (
            <p className="safety-muted">{fdaWarning}</p>
          ) : null}

          {loading ? (
            <p className="safety-muted">Loading safety checks...</p>
          ) : error ? (
            <p className="form-error">{error}</p>
          ) : reviewItems.length === 0 ? (
            <div className="safety-empty">
              <h4>No active safety issues detected</h4>
              <p>Your current medications and today's dose pattern do not show any review flags.</p>
            </div>
          ) : (
            <div className="safety-list">
              {reviewItems.map((item, idx) => (
                <article key={`${item.title}-${idx}`} className={`safety-item safety-item--${item.type.toLowerCase()}`}>
                  <div className="safety-item-head">
                    <span className={`safety-pill safety-pill--${item.type.toLowerCase()}`}>{item.type}</span>
                    <h4>{item.title}</h4>
                  </div>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="card-box">
          <div className="section-hdr">
            <h3>Active Medications</h3>
          </div>
          {loading ? (
            <p className="safety-muted">Loading medications...</p>
          ) : activeMeds.length === 0 ? (
            <p className="safety-muted">No active medications found.</p>
          ) : (
            <div className="safety-med-grid">
              {activeMeds.map((med) => (
                <div key={med._id} className="safety-med-card">
                  <h4>{med.name}</h4>
                  <p>{med.genericName || 'No generic name'}</p>
                  <div className="safety-med-meta">
                    <span>{med.dosage}</span>
                    <span>{med.frequency}</span>
                    {med.status === 'interaction' && <span className="safety-tag">Interaction</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="safety-disclaimer">
          Safety Center provides informational checks only and does not replace professional medical advice.
        </p>
      </main>
    </>
  );
}
