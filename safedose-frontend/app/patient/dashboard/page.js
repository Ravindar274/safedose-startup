// app/patient/dashboard/page.js

'use client';
import '../patient-dashboard.css';
import { useState, useEffect, useCallback, useRef } from 'react';
import NotificationBell from '../../components/NotificationBell';
import Link from 'next/link';

const FREQUENCIES = [
  'once daily',
  'twice daily',
  'three times daily',
  'four times daily',
  'once every 2 days',
  'once every 3 days',
  'once in a week'
];

const FREQUENCY_COUNTS = {
  'once daily': 1,
  'twice daily': 2,
  'three times daily': 3,
  'four times daily': 4,
  'once every 2 days': 1,
  'once every 3 days': 1,
  'once in a week': 1,
};

// ── Parse "08:00 AM" → Date with today's date ────────────────
function parseTime(timeStr) {
  if (!timeStr) return null;
  const [t, period] = timeStr.split(' ');
  let [h, m] = t.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h  = 0;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

// ── Status for a single dose ──────────────────────────────────
// 'taken'    — already marked taken
// 'missed'   — this dose's time has passed AND the next dose time has also arrived
// 'due'      — this dose's time has passed but it's still within the window (no next dose yet)
// 'upcoming' — this dose's time hasn't arrived yet
function getDoseStatus(timeStr, nextTimeStr, taken) {
  if (taken) return 'taken';
  const now       = new Date();
  const scheduled = parseTime(timeStr);
  if (!scheduled || now < scheduled) return 'upcoming';
  // Scheduled time has passed — check whether the next dose time has arrived
  if (nextTimeStr) {
    const next = parseTime(nextTimeStr);
    if (next && now >= next) return 'missed';
  }
  return 'due';
}

// ── Row-level status (worst untaken dose wins) ────────────────
function getMedStatus(med) {
  if (med.allTaken) return 'taken';
  const times = med.scheduleTimes || (med.scheduleTime ? [med.scheduleTime] : []);
  let hasMissed = false, hasDue = false;
  times.forEach((timeStr, i) => {
    if (med.takenToday?.[i]) return;
    const ds = getDoseStatus(timeStr, times[i + 1], false);
    if (ds === 'missed') hasMissed = true;
    else if (ds === 'due') hasDue = true;
  });
  if (hasMissed) return 'missed';
  if (hasDue)    return 'due';
  return 'upcoming';
}

// ── Add Medication Modal ──────────────────────────────────────
function AddMedicationModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    selectedDrug: null,
    dosage:       '',
    frequency:    'once daily',
    scheduleTimes: ['08:00 AM'],
    isOngoing:    true,
    startDate:    new Date().toISOString().slice(0, 10),
    endDate:      '',
  });
  const [brandQuery, setBrandQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const lookupRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!lookupRef.current?.contains(event.target)) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const query = brandQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const params = new URLSearchParams({ q: query, limit: '8', skip: '0' });
        const res = await fetch(`/api/patient/drugs?${params}`, { signal: controller.signal });
        const data = await res.json();
        if (!res.ok) {
          setSearchResults([]);
          return;
        }
        setSearchResults(data.drugs || []);
      } catch (fetchError) {
        if (fetchError.name !== 'AbortError') setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [brandQuery]);

  function generateTimes(firstTimeStr, count) {
    if (count <= 1) return [firstTimeStr || '08:00 AM'];
    const times = [firstTimeStr];
    let [t, p] = firstTimeStr.split(' ');
    let [h, m] = t.split(':').map(Number);
    if (p === 'PM' && h !== 12) h += 12;
    if (p === 'AM' && h === 12) h = 0;
    
    let interval = 24 / count;
    if (count === 2) interval = 8;
    else if (count === 3) interval = 6;
    else if (count === 4) interval = 4;

    for (let i = 1; i < count; i++) {
      let nextH = (h + interval * i) % 24;
      const period = nextH >= 12 ? 'PM' : 'AM';
      const h12 = nextH % 12 || 12;
      times.push(`${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${period}`);
    }
    return times;
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    if (name === 'frequency') {
      const count = FREQUENCY_COUNTS[value] || 1;
      setForm(prev => {
        const newTimes = generateTimes(prev.scheduleTimes[0] || '08:00 AM', count);
        return { ...prev, frequency: value, scheduleTimes: newTimes };
      });
    } else {
      setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  }

  function handleTimeChange(index, newTimeStr) {
    if (!newTimeStr) return;
    const [h24, m] = newTimeStr.split(':').map(Number);
    const period = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 || 12;
    const formatted = `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${period}`;
    setForm(prev => {
      if (index === 0) {
        const count = FREQUENCY_COUNTS[prev.frequency] || 1;
        const newTimes = generateTimes(formatted, count);
        return { ...prev, scheduleTimes: newTimes };
      } else {
        const newTimes = [...prev.scheduleTimes];
        newTimes[index] = formatted;
        return { ...prev, scheduleTimes: newTimes };
      }
    });
  }

  function getTimeForInput(timeStr) {
    if (!timeStr) return '08:00';
    if (timeStr.includes(':') && !timeStr.includes(' ')) return timeStr;
    const [t, p] = timeStr.split(' ');
    let [h, m] = t.split(':').map(Number);
    if (p === 'PM' && h !== 12) h += 12;
    if (p === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  function handleBrandInput(value) {
    setBrandQuery(value);
    setShowResults(true);
    setError('');
    setForm(prev => ({
      ...prev,
      selectedDrug:
        prev.selectedDrug && prev.selectedDrug.brandName.toLowerCase() === value.trim().toLowerCase()
          ? prev.selectedDrug
          : null,
    }));
  }

  function handleDrugSelect(drug) {
    setBrandQuery(drug.brandName);
    setShowResults(false);
    setError('');
    setForm(prev => ({ ...prev, selectedDrug: drug }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.selectedDrug || form.selectedDrug.brandName.toLowerCase() !== brandQuery.trim().toLowerCase()) {
      setError('Select a medication from the brand name search results.');
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch('/api/patient/medications', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          selectedDrug: form.selectedDrug,
          dosage: form.dosage,
          frequency: form.frequency,
          scheduleTimes: form.scheduleTimes,
          isOngoing: form.isOngoing,
          startDate: form.startDate,
          endDate: form.endDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to add medication.'); return; }
      onSaved(data.medication);
      onClose();
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div>
            <h3 className="modal-title">Add medication</h3>
            <p className="modal-sub">Add a medication to your daily schedule.</p>
          </div>
          <button className="modal-close" onClick={onClose} type="button">
            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                 strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-row-2">
            <div className="form-grp" ref={lookupRef}>
              <label>Brand name *</label>
              <input
                name="brandName"
                placeholder="Search brand name, e.g. Tylenol"
                value={brandQuery}
                onChange={e => handleBrandInput(e.target.value)}
                onFocus={() => setShowResults(true)}
                autoComplete="off"
                required
              />
              <p className="form-hint">Choose a medication from the FDA results below.</p>
              {showResults && brandQuery.trim() && (
                <div className="drug-lookup-results">
                  {searchLoading ? (
                    <div className="drug-lookup-row drug-lookup-row--muted">Searching FDA results…</div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map(drug => (
                      <button
                        key={`${drug.id}-${drug.brandName}-${drug.genericName}`}
                        type="button"
                        className="drug-lookup-row"
                        onClick={() => handleDrugSelect(drug)}
                      >
                        <span className="drug-lookup-title">{drug.brandName}</span>
                        <span className="drug-lookup-sub">
                          {drug.genericName || 'Generic name unavailable'}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="drug-lookup-row drug-lookup-row--muted">No FDA matches found.</div>
                  )}
                </div>
              )}
            </div>
            <div className="form-grp">
              <label>Generic name *</label>
              <input
                value={form.selectedDrug?.genericName || ''}
                placeholder="Selected automatically from FDA"
                readOnly
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-grp">
              <label>Dosage *</label>
              <input name="dosage" placeholder="e.g. 500mg" value={form.dosage}
                     onChange={handleChange} required />
            </div>
            <div className="form-grp">
              <label>Frequency *</label>
              <select name="frequency" value={form.frequency} onChange={handleChange}>
                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-grp" style={{ gridColumn: '1 / -1' }}>
              <label>Schedule times *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
                {form.scheduleTimes.map((time, idx) => (
                  <input key={idx} type="time" value={getTimeForInput(time)} onChange={e => handleTimeChange(idx, e.target.value)} required />
                ))}
              </div>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-grp">
              <label>Start date</label>
              <input name="startDate" type="date" value={form.startDate}
                     onChange={handleChange} />
            </div>
            {!form.isOngoing && (
              <div className="form-grp">
                <label>End date</label>
                <input name="endDate" type="date" value={form.endDate} min={form.startDate}
                       onChange={handleChange} required={!form.isOngoing} />
              </div>
            )}
          </div>

          <div className="form-grp form-grp-check">
            <input id="isOngoing" name="isOngoing" type="checkbox"
                   checked={form.isOngoing} onChange={handleChange} />
            <label htmlFor="isOngoing">Ongoing medication (no end date)</label>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-teal btn-full" disabled={loading}>
            {loading ? 'Saving…' : 'Add medication'}
          </button>
        </form>

      </div>
    </div>
  );
}

// ── Med Row ───────────────────────────────────────────────────
function MedRow({ med, onToggleTaken }) {
  const [busyIndex, setBusyIndex] = useState(null);
  const status = getMedStatus(med);

  async function handleTaken(doseIndex) {
    setBusyIndex(doseIndex);
    await onToggleTaken(med._id, doseIndex);
    setBusyIndex(null);
  }

  function isTooEarly(timeStr) {
    const scheduled = parseTime(timeStr);
    if (!scheduled) return false;
    return (scheduled.getTime() - Date.now()) > 3600000;
  }

  return (
    <div className="med-row">
      <div className={`med-icon${med.allTaken ? ' med-icon--done' : ''}`}>
        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
             strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
          <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
      </div>

      <div className="med-info">
        <div className="med-name">{med.name}
          <span className="med-generic"> ({med.genericName})</span>
        </div>
        <div className="med-dose">{med.dosage} · {med.frequency}</div>
      </div>

      <span className={`status-badge status-${status}`}>
        {status === 'taken' ? 'Taken' : status === 'missed' ? 'Missed' : status === 'due' ? 'Due now' : 'Upcoming'}
      </span>

      <div className="med-actions">
        {med.takenToday.map((taken, i) => {
          const times    = med.scheduleTimes || (med.scheduleTime ? [med.scheduleTime] : []);
          const timeStr  = times[i];
          const ds       = getDoseStatus(timeStr, times[i + 1], taken);
          const early    = !taken && isTooEarly(timeStr);
          const btnClass = taken    ? ' mark-taken-btn--done'
                         : ds === 'missed' ? ' mark-taken-btn--missed'
                         : ds === 'due'    ? ' mark-taken-btn--due'
                         : '';
          const label    = taken ? 'Taken' : timeStr || `Dose ${i + 1}`;
          const titleTxt = early   ? 'Too early to take'
                         : taken   ? `Unmark dose ${i + 1}`
                         : ds === 'missed' ? `Missed — mark dose ${i + 1} as taken`
                         : `Mark dose ${i + 1} taken`;
          return (
            <button
              key={i}
              className={`mark-taken-btn${btnClass}`}
              onClick={() => handleTaken(i)}
              disabled={busyIndex !== null || early}
              title={titleTxt}
              style={early ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
            >
              {taken ? (
                <svg stroke="currentColor" fill="none" strokeWidth="2.5" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : ds === 'missed' ? (
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              ) : early ? (
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              ) : (
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              )}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function PatientDashboard() {
  const [medications, setMedications] = useState([]);
  const [allMedications, setAllMedications] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);

  const fetchToday = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/patient/medications/today');
      const data = await res.json();
      setMedications(data.medications || []);
    } catch {
      setMedications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  useEffect(() => {
    async function fetchAllMeds() {
      try {
        const res = await fetch('/api/patient/medications');
        const data = await res.json();
        if (!res.ok) return;
        setAllMedications(data.medications || []);
      } catch {
        setAllMedications([]);
      }
    }
    fetchAllMeds();
  }, []);

  async function handleToggleTaken(medId, doseIndex) {
    const res  = await fetch(`/api/patient/medications/${medId}/taken`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ doseIndex }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setMedications(prev =>
      prev.map(m => m._id === medId
        ? { ...m, takenToday: data.takenToday, allTaken: data.allTaken }
        : m
      )
    );
  }

  function onMedSaved() {
    fetchToday(); // refetch so the new med appears with correct status
    (async () => {
      try {
        const res = await fetch('/api/patient/medications');
        const data = await res.json();
        if (!res.ok) return;
        setAllMedications(data.medications || []);
      } catch {
        setAllMedications([]);
      }
    })();
  }

  // ── Derived stats (dose-level counts, not medication-level) ──
  const totalMeds  = medications.length;
  const totalDoses = medications.reduce((sum, m) => sum + m.takenToday.length, 0);
  const takenDoses = medications.reduce((sum, m) => sum + m.takenToday.filter(Boolean).length, 0);

  let missedDoses = 0, dueDoses = 0, upcomingDoses = 0;
  medications.forEach(med => {
    const times = med.scheduleTimes || (med.scheduleTime ? [med.scheduleTime] : []);
    times.forEach((timeStr, i) => {
      if (med.takenToday?.[i]) return;
      const ds = getDoseStatus(timeStr, times[i + 1], false);
      if      (ds === 'missed')   missedDoses++;
      else if (ds === 'due')      dueDoses++;
      else                        upcomingDoses++;
    });
  });

  const adherencePct = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 0;
  const interactionFlags = allMedications.filter(m => m.status === 'interaction').length;
  const activeMeds = allMedications.filter(m => m.status !== 'stopped');
  const duplicateGenerics = (() => {
    const counts = new Map();
    activeMeds.forEach((m) => {
      const key = (m.genericName || m.name || '').trim().toLowerCase();
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.values()].filter(v => v > 1).length;
  })();

  return (
    <>
      {/* ── Topbar ── */}
      <div className="app-topbar">
        <div className="topbar-title">
          <h2>My Dashboard</h2>
          <p>Today&apos;s medication overview</p>
        </div>
        <div className="topbar-right">
          <NotificationBell />
          <div className="topbar-avatar">P</div>
        </div>
      </div>

      <main className="app-main">

        {/* ── Stat cards ── */}
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <div className="stat-val">{totalMeds}</div>
            <div className="stat-lbl">Medications today</div>
            <div className="stat-change">in your schedule</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <div className="stat-val">{takenDoses}<span className="stat-val-total">/{totalDoses}</span></div>
            <div className="stat-lbl">Taken</div>
            <div className="stat-progress">
              <div className="stat-progress-bar" style={{ width: `${adherencePct}%` }} />
            </div>
            <div className="stat-change">{adherencePct}% adherence today</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--danger-soft)' }}>
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="18" height="18"
                   style={{ color: 'var(--danger)' }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="stat-val">{missedDoses}</div>
            <div className="stat-lbl">Missed</div>
            <div className="stat-change">
              {missedDoses > 0 ? 'mark taken if still taken' : 'none missed today'}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--warn-soft)' }}>
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="18" height="18"
                   style={{ color: 'var(--warn)' }}>
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div className="stat-val">{dueDoses}</div>
            <div className="stat-lbl">Due now</div>
            <div className="stat-change">needs attention</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--gray100)' }}>
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="18" height="18"
                   style={{ color: 'var(--gray600)' }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            <div className="stat-val">{upcomingDoses}</div>
            <div className="stat-lbl">Upcoming</div>
            <div className="stat-change">doses later today</div>
          </div>
        </div>

        {/* ── Today's schedule ── */}
        <div className="card-box">
          <div className="section-hdr">
            <h3>Today&apos;s Schedule</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--gray400)' }}>
                {new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
              <button className="btn btn-teal" onClick={() => setShowModal(true)}>
                <svg stroke="currentColor" fill="none" strokeWidth="2.5" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add medication
              </button>
            </div>
          </div>

          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--gray400)', padding: '20px 0' }}>
              Loading medications…
            </p>
          ) : medications.length === 0 ? (
            <div className="empty-meds">
              <svg stroke="currentColor" fill="none" strokeWidth="1.5" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="36" height="36">
                <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              <p>No medications scheduled for today.</p>
              <button className="btn btn-teal" onClick={() => setShowModal(true)}>
                Add your first medication
              </button>
            </div>
          ) : (
            medications.map(med => (
              <MedRow key={med._id} med={med} onToggleTaken={handleToggleTaken} />
            ))
          )}
        </div>

        {/* ── Safety Center ── */}
        <div className="card-box">
          <div className="section-hdr">
            <h3>Safety Center</h3>
            <Link className="btn" style={{ background: 'var(--gray100)', color: 'var(--gray800)' }} href="/patient/interactions">
              Open Safety Center
            </Link>
          </div>
          <p style={{ fontSize: 13, color: 'var(--gray400)', margin: 0 }}>
            {interactionFlags > 0 || duplicateGenerics > 0
              ? `${interactionFlags} interaction flag${interactionFlags === 1 ? '' : 's'} and ${duplicateGenerics} duplicate ingredient group${duplicateGenerics === 1 ? '' : 's'} detected. Review recommended.`
              : 'No active interaction or duplicate ingredient alerts detected. Tap Open Safety Center for full checks.'}
          </p>
        </div>

      </main>

      {showModal && (
        <AddMedicationModal
          onClose={() => setShowModal(false)}
          onSaved={onMedSaved}
        />
      )}
    </>
  );
}
