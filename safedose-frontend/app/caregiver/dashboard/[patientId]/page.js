// app/caregiver/dashboard/[patientId]/page.js

'use client';
import '../../../patient/patient-dashboard.css';
import '../../../patient/medications/medications.css';
import '../../caregiver-dashboard.css';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

const FREQUENCIES = [
  'once daily',
  'twice daily',
  'three times daily',
  'four times daily',
  'once every 2 days',
  'once every 3 days',
  'once in a week'
];

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

function getDoseStatus(timeStr, nextTimeStr, taken) {
  if (taken) return 'taken';
  const now       = new Date();
  const scheduled = parseTime(timeStr);
  if (!scheduled || now < scheduled) return 'upcoming';
  if (nextTimeStr) {
    const next = parseTime(nextTimeStr);
    if (next && now >= next) return 'missed';
  }
  return 'due';
}

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

function AddMedicationModal({ patientId, onClose, onSaved }) {
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
      const counts = { 'once daily': 1, 'twice daily': 2, 'three times daily': 3, 'four times daily': 4 };
      const count = counts[value] || 1;
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
        const counts = { 'once daily': 1, 'twice daily': 2, 'three times daily': 3, 'four times daily': 4 };
        const count = counts[prev.frequency] || 1;
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
      const res  = await fetch(`/api/caregiver/patients/${patientId}/medications`, {
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
            <p className="modal-sub">Add a medication to the patient&apos;s daily schedule.</p>
          </div>
          <button className="modal-close" onClick={onClose} type="button">
            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                 strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grp form-grp--lookup" ref={lookupRef} style={{ gridColumn: '1 / -1' }}>
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
            {showResults && brandQuery.trim() && (
              <div className="drug-lookup-results">
                <div className="drug-lookup-header">Choose a medication from the FDA results below.</div>
                {searchLoading ? (
                  <div className="drug-lookup-row drug-lookup-row--muted">Searching FDA results…</div>
                ) : searchResults.filter(drug => drug.brandName && drug.genericName).length > 0 ? (
                  searchResults
                    .filter(drug => drug.brandName && drug.genericName)
                    .map(drug => (
                      <button
                        key={`${drug.id}-${drug.brandName}-${drug.genericName}`}
                        type="button"
                        className="drug-lookup-row"
                        onClick={() => handleDrugSelect(drug)}
                      >
                        <span className="drug-lookup-title">{drug.brandName}</span>
                        <span className="drug-lookup-sub">
                          {drug.genericName}
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
      <div className={`med-icon${med.allTaken ? ' med-icon--done' : status === 'missed' ? ' med-icon--missed' : ''}`}>
        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
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
          const btnClass = taken           ? ' mark-taken-btn--done'
                         : ds === 'missed' ? ' mark-taken-btn--missed'
                         : ds === 'due'    ? ' mark-taken-btn--due'
                         : '';
          const label    = taken ? 'Taken' : timeStr || `Dose ${i + 1}`;
          const titleTxt = early           ? 'Too early to take'
                         : taken           ? `Unmark dose ${i + 1}`
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
                <svg stroke="currentColor" fill="none" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : ds === 'missed' ? (
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              ) : early ? (
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              ) : (
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
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

// ── helpers ───────────────────────────────────────────────────
function getPastYear(med) {
  if (med.stoppedAt)               return new Date(med.stoppedAt).getFullYear();
  if (!med.isOngoing && med.endDate) return new Date(med.endDate).getFullYear();
  return new Date().getFullYear();
}

// ── Edit medication modal (caregiver) ─────────────────────────
function EditMedicationModal({ med, patientId, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:          med.name         || '',
    genericName:   med.genericName  || '',
    dosage:        med.dosage       || '',
    frequency:     med.frequency    || 'once daily',
    scheduleTimes: med.scheduleTimes || ['08:00 AM'],
    isOngoing:     med.isOngoing    ?? true,
    startDate:     med.startDate ? new Date(med.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    endDate:       med.endDate   ? new Date(med.endDate).toISOString().slice(0, 10)   : '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  function generateTimes(firstTimeStr, count) {
    if (count <= 1) return [firstTimeStr || '08:00 AM'];
    let [time, period] = (firstTimeStr || '08:00 AM').split(' ');
    let [h, m] = time.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h  = 0;
    const interval = Math.floor(24 / count);
    return Array.from({ length: count }, (_, i) => {
      const curH = (h + i * interval) % 24;
      const ampm = curH >= 12 ? 'PM' : 'AM';
      const dispH = curH % 12 || 12;
      return `${String(dispH).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;
    });
  }

  function handleFreqChange(e) {
    const freq  = e.target.value;
    const count = { 'once daily': 1, 'twice daily': 2, 'three times daily': 3, 'four times daily': 4 }[freq] || 1;
    setForm(prev => ({ ...prev, frequency: freq, scheduleTimes: generateTimes(prev.scheduleTimes[0], count) }));
  }

  function toInputTime(t) {
    if (!t) return '08:00';
    if (t.includes(':') && !t.includes(' ')) return t;
    const [tp, p] = t.split(' ');
    let [h, m] = tp.split(':').map(Number);
    if (p === 'PM' && h !== 12) h += 12;
    if (p === 'AM' && h === 12) h  = 0;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  function fromInputTime(val, idx) {
    if (!val) return;
    let [h, m] = val.split(':').map(Number);
    const p    = h >= 12 ? 'PM' : 'AM';
    const dh   = h % 12 || 12;
    const formatted = `${String(dh).padStart(2,'0')}:${String(m).padStart(2,'0')} ${p}`;
    setForm(prev => {
      if (idx === 0 && prev.scheduleTimes.length > 1) {
        const count = { 'once daily': 1, 'twice daily': 2, 'three times daily': 3, 'four times daily': 4 }[prev.frequency] || 1;
        return { ...prev, scheduleTimes: generateTimes(formatted, count) };
      }
      const newTimes = [...prev.scheduleTimes];
      newTimes[idx] = formatted;
      return { ...prev, scheduleTimes: newTimes };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res  = await fetch(`/api/caregiver/patients/${patientId}/medications/${med._id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to update.'); return; }
      onSaved(data.medication);
    } catch { setError('Something went wrong.'); }
    finally  { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Edit medication</h3>
            <p className="modal-sub">Update details for {med.name}.</p>
          </div>
          <button className="modal-close" onClick={onClose} type="button">
            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                 strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          <div className="form-row-2">
            <div className="form-grp"><label>Brand name</label>
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div className="form-grp"><label>Generic name</label>
              <input required value={form.genericName} onChange={e => setForm({...form, genericName: e.target.value})} /></div>
          </div>
          <div className="form-row-2">
            <div className="form-grp"><label>Dosage</label>
              <input required value={form.dosage} onChange={e => setForm({...form, dosage: e.target.value})} /></div>
            <div className="form-grp"><label>Frequency</label>
              <select value={form.frequency} onChange={handleFreqChange}>
                {['once daily','twice daily','three times daily','four times daily','once every 2 days','once every 3 days','once in a week']
                  .map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div className="form-grp" style={{ gridColumn: '1/-1' }}>
            <label>Schedule times</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px,1fr))', gap: 10 }}>
              {form.scheduleTimes.map((t, i) => (
                <input key={i} type="time" value={toInputTime(t)}
                       onChange={e => fromInputTime(e.target.value, i)} required />
              ))}
            </div>
          </div>
          <div className="form-row-2" style={{ marginTop: 14 }}>
            <div className="form-grp"><label>Start date</label>
              <input type="date" required value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} /></div>
          </div>
          <div className="form-grp form-grp-check">
            <input type="checkbox" id="editOngoing" checked={form.isOngoing}
                   onChange={e => setForm({...form, isOngoing: e.target.checked})} />
            <label htmlFor="editOngoing">Ongoing medication (no end date)</label>
          </div>
          {!form.isOngoing && (
            <div className="form-grp" style={{ marginTop: 14 }}>
              <label>End date</label>
              <input type="date" required value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} />
            </div>
          )}
          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <button type="button" className="btn" style={{ flex: 1, background: 'var(--gray100)', color: 'var(--gray800)' }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-teal" style={{ flex: 1 }} disabled={loading}>{loading ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PatientDetailDashboard() {
  const { patientId } = useParams();
  const router = useRouter();

  const [activeTab, setActiveTab]           = useState('schedule'); // 'schedule' | 'medications'
  const [patient,    setPatient]            = useState(null);
  const [medications, setMedications]       = useState([]);
  const [allMeds,    setAllMeds]            = useState([]);
  const [allMedsLoading, setAllMedsLoading] = useState(false);
  const [loading,    setLoading]            = useState(true);
  const [showModal,  setShowModal]          = useState(false);

  // All-medications tab state
  const [medsTab,       setMedsTab]       = useState('active');
  const [medsSearch,    setMedsSearch]    = useState('');
  const [editingMed,    setEditingMed]    = useState(null);
  const [confirmStop,   setConfirmStop]   = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchPatientDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/caregiver/patients/${patientId}`);
      if (res.ok) {
        const data = await res.json();
        setPatient(data.patient);
      }
    } catch (err) {
      console.error(err);
    }
  }, [patientId]);

  const fetchToday = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/caregiver/patients/${patientId}/medications/today`);
      const data = await res.json();
      setMedications(data.medications || []);
    } catch {
      setMedications([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { 
    if (patientId) {
      fetchPatientDetails();
      fetchToday(); 
    }
  }, [patientId, fetchPatientDetails, fetchToday]);

  async function handleToggleTaken(medId, doseIndex) {
    const res  = await fetch(`/api/caregiver/patients/${patientId}/medications/${medId}/taken`, {
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

  const fetchAllMeds = useCallback(async () => {
    setAllMedsLoading(true);
    try {
      const res  = await fetch(`/api/caregiver/patients/${patientId}/medications`);
      const data = await res.json();
      setAllMeds(data.medications || []);
    } catch {
      setAllMeds([]);
    } finally {
      setAllMedsLoading(false);
    }
  }, [patientId]);

  function handleTabChange(tab) {
    setActiveTab(tab);
    if (tab === 'medications' && allMeds.length === 0) fetchAllMeds();
  }

  function onMedSaved() {
    fetchToday();
    if (activeTab === 'medications') fetchAllMeds();
  }

  // ── All-medications tab helpers ──
  const filteredAllMeds = useMemo(() => {
    const q = medsSearch.toLowerCase();
    return allMeds.filter(med => {
      const matchSearch = !q ||
        med.name.toLowerCase().includes(q) ||
        med.genericName.toLowerCase().includes(q);
      return matchSearch && med.category === medsTab;
    });
  }, [allMeds, medsTab, medsSearch]);

  function handleEditSaved(updated) {
    setAllMeds(prev => prev.map(m => m._id === updated._id ? { ...updated, category: m.category } : m));
    setEditingMed(null);
  }

  async function executeStop(medId) {
    const res = await fetch(`/api/caregiver/patients/${patientId}/medications/${medId}/stop`, { method: 'PATCH' });
    if (res.ok) {
      setAllMeds(prev => prev.map(m => m._id === medId ? { ...m, status: 'stopped', category: 'past' } : m));
    }
    setConfirmStop(null);
  }

  async function executeDelete(medId) {
    const res = await fetch(`/api/caregiver/patients/${patientId}/medications/${medId}`, { method: 'DELETE' });
    if (res.ok) setAllMeds(prev => prev.filter(m => m._id !== medId));
    setConfirmDelete(null);
  }

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

  return (
    <>
      <div className="app-topbar" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
        <button
          onClick={() => router.push('/caregiver/dashboard')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--teal)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}
        >
          <svg stroke="currentColor" fill="none" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Back to patients
        </button>

        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div className="topbar-title" style={{ marginBottom: 0 }}>
            <h2>{patient ? `${patient.firstName} ${patient.lastName}` : 'Loading…'}</h2>
            <p>Patient medication overview</p>
          </div>

          {/* Tab bar */}
          <div className="patient-tabs">
            <button
              className={`patient-tab${activeTab === 'schedule' ? ' active' : ''}`}
              onClick={() => handleTabChange('schedule')}
            >
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Today&apos;s Schedule
            </button>
            <button
              className={`patient-tab${activeTab === 'medications' ? ' active' : ''}`}
              onClick={() => handleTabChange('medications')}
            >
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              All Medications
            </button>
          </div>
        </div>
      </div>

      <main className="app-main">

        {/* ── All Medications tab ── */}
        {activeTab === 'medications' && (
          <div className="card-box" style={{ padding: 24 }}>
            <div className="meds-header">
              <div className="meds-tabs">
                {['active','upcoming','past'].map(t => (
                  <button key={t}
                    className={`meds-tab${medsTab === t ? ' active' : ''}`}
                    onClick={() => setMedsTab(t)}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div className="search-box">
                  <svg className="search-icon" stroke="currentColor" fill="none" strokeWidth="2"
                       viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input type="text" placeholder="Search medications…"
                         value={medsSearch} onChange={e => setMedsSearch(e.target.value)} />
                </div>
                <button className="btn btn-teal" onClick={() => setShowModal(true)}>
                  <svg stroke="currentColor" fill="none" strokeWidth="2.5" viewBox="0 0 24 24"
                       strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add
                </button>
              </div>
            </div>

            {allMedsLoading ? (
              <div className="empty-state">Loading medications…</div>
            ) : filteredAllMeds.length > 0 ? (
              <div className="med-list">
                {filteredAllMeds.map(med => (
                  <div key={med._id} className="med-card">
                    <div className={`med-card-icon ${medsTab}`}>
                      <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                           strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                        <rect x="3" y="10" width="18" height="10" rx="2" ry="2"/>
                        <path d="M7 10V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4"/>
                      </svg>
                    </div>

                    <div className="med-card-info">
                      <h3 className="med-card-title">{med.name}</h3>
                      <p className="med-card-generic">{med.genericName} · {med.dosage}</p>
                      <div className="med-card-details">
                        <div className="med-card-detail">
                          <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                               strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                          </svg>
                          {med.frequency}
                        </div>
                        {med.scheduleTimes?.length > 0 && (
                          <div className="med-card-detail">
                            {med.scheduleTimes.join(', ')}
                          </div>
                        )}
                        {medsTab === 'past' && (
                          <div className="med-card-detail" style={{ color: 'var(--gray500)' }}>
                            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                                 strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                              <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            Completed in {getPastYear(med)}
                          </div>
                        )}
                        {medsTab === 'upcoming' && (
                          <div className="med-card-detail" style={{ color: 'var(--teal)' }}>
                            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                                 strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                              <line x1="3" y1="10" x2="21" y2="10"/>
                            </svg>
                            Starts {new Date(med.startDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="med-card-actions">
                      {medsTab !== 'past' && (
                        <button className="med-action-btn edit" onClick={() => setEditingMed(med)}>
                          <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                               strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                          </svg>
                          Edit
                        </button>
                      )}
                      {medsTab === 'active' && (
                        <button className="med-action-btn stop" onClick={() => setConfirmStop(med)}>
                          <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                               strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          </svg>
                          Stop
                        </button>
                      )}
                      <button className="med-action-btn delete" onClick={() => setConfirmDelete(med)}>
                        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                             strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                No {medsTab} medications{medsSearch ? ' matching your search' : ''}.
              </div>
            )}
          </div>
        )}

        {/* ── Today's Schedule tab ── */}
        {activeTab === 'schedule' && (
        <><div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <div className="stat-val">{totalMeds}</div>
            <div className="stat-lbl">Medications today</div>
            <div className="stat-change">in schedule</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
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
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" style={{ color: 'var(--danger)' }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="stat-val">{missedDoses}</div>
            <div className="stat-lbl">Missed</div>
            <div className="stat-change">
              {missedDoses > 0 ? 'follow up required' : 'none missed today'}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--warn-soft)' }}>
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" style={{ color: 'var(--warn)' }}>
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
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="18" height="18" style={{ color: 'var(--gray600)' }}>
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

        <div className="card-box">
          <div className="section-hdr">
            <h3>Today&apos;s Schedule</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--gray400)' }}>
                {new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
              <button className="btn btn-teal" onClick={() => setShowModal(true)}>
                <svg stroke="currentColor" fill="none" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add medication
              </button>
            </div>
          </div>

          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--gray400)', padding: '20px 0' }}>Loading medications…</p>
          ) : medications.length === 0 ? (
            <div className="empty-meds">
              <svg stroke="currentColor" fill="none" strokeWidth="1.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="36" height="36">
                <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
              <p>No medications scheduled for today.</p>
              <button className="btn btn-teal" onClick={() => setShowModal(true)}>
                Add first medication
              </button>
            </div>
          ) : (
            medications.map(med => (
              <MedRow key={med._id} med={med} onToggleTaken={handleToggleTaken} />
            ))
          )}
        </div>
        </> /* end schedule tab */
        )}
      </main>

      {showModal && (
        <AddMedicationModal
          patientId={patientId}
          onClose={() => setShowModal(false)}
          onSaved={onMedSaved}
        />
      )}

      {editingMed && (
        <EditMedicationModal
          med={editingMed}
          patientId={patientId}
          onClose={() => setEditingMed(null)}
          onSaved={handleEditSaved}
        />
      )}

      {confirmStop && (
        <div className="modal-overlay" onClick={() => setConfirmStop(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">Stop medication?</h3>
              <button className="modal-close" onClick={() => setConfirmStop(null)} type="button">
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--gray600)', margin: '16px 0 24px' }}>
              Stop <strong>{confirmStop.name}</strong> for this patient? It will be moved to past medications and can no longer be edited.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn" style={{ flex: 1, background: 'var(--gray100)', color: 'var(--gray800)' }}
                      onClick={() => setConfirmStop(null)}>Cancel</button>
              <button className="btn" style={{ flex: 1, background: 'var(--warn)', color: '#fff' }}
                      onClick={() => executeStop(confirmStop._id)}>Stop medication</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">Delete medication?</h3>
              <button className="modal-close" onClick={() => setConfirmDelete(null)} type="button">
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p style={{ fontSize: 14, color: 'var(--gray600)', margin: '16px 0 24px' }}>
              Permanently delete <strong>{confirmDelete.name}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn" style={{ flex: 1, background: 'var(--gray100)', color: 'var(--gray800)' }}
                      onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn" style={{ flex: 1, background: 'var(--danger)', color: '#fff' }}
                      onClick={() => executeDelete(confirmDelete._id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
