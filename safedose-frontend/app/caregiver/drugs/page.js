// app/caregiver/drugs/page.js

'use client';
import './drugs.css';
import '../../patient/patient-dashboard.css';
import '../../patient/medications/medications.css';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';

const PAGE_SIZE = 30;

const FREQUENCIES = [
  'once daily',
  'twice daily',
  'three times daily',
  'four times daily',
  'once every 2 days',
  'once every 3 days',
  'once in a week',
];

const FREQ_COUNT = {
  'once daily':        1,
  'twice daily':       2,
  'three times daily': 3,
  'four times daily':  4,
  'once every 2 days': 1,
  'once every 3 days': 1,
  'once in a week':    1,
};

function cleanDrugText(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDrugDisplayName(drug) {
  const brandName = cleanDrugText(drug?.brandName);
  const genericName = cleanDrugText(drug?.genericName);

  if (brandName && brandName.toLowerCase() !== 'unknown') {
    return brandName;
  }

  return genericName;
}

function hasDrugDisplayName(drug) {
  return !!getDrugDisplayName(drug);
}

// ── Time helpers ──────────────────────────────────────────────
function toInputTime(timeStr) {
  if (!timeStr) return '08:00';
  if (timeStr.includes(':') && !timeStr.includes(' ')) return timeStr;
  const [t, p] = timeStr.split(' ');
  let [h, m]   = t.split(':').map(Number);
  if (p === 'PM' && h !== 12) h += 12;
  if (p === 'AM' && h === 12) h  = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function fromInputTime(val) {
  if (!val) return '08:00 AM';
  let [h, m] = val.split(':').map(Number);
  const p    = h >= 12 ? 'PM' : 'AM';
  const dh   = h % 12 || 12;
  return `${String(dh).padStart(2, '0')}:${String(m).padStart(2, '0')} ${p}`;
}

function generateTimes(firstTime, count) {
  const [t, p] = (firstTime || '08:00 AM').split(' ');
  let [h, m]   = t.split(':').map(Number);
  if (p === 'PM' && h !== 12) h += 12;
  if (p === 'AM' && h === 12) h  = 0;
  const interval = Math.floor(24 / count);
  return Array.from({ length: count }, (_, i) => {
    const curH = (h + i * interval) % 24;
    const ampm = curH >= 12 ? 'PM' : 'AM';
    const dispH = curH % 12 || 12;
    return `${String(dispH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  });
}

// ── Add Medication Modal ──────────────────────────────────────
function AddMedModal({ drug, patients, onClose, onSaved }) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      patientId:     patients[0]?._id ?? '',
      dosage:        '',
      frequency:     'once daily',
      scheduleTimes: ['08:00 AM'],
      isOngoing:     true,
      startDate:     new Date().toISOString().slice(0, 10),
      endDate:       '',
    },
  });

  const [apiError, setApiError] = useState('');

  const frequency     = watch('frequency');
  const isOngoing     = watch('isOngoing');
  const scheduleTimes = watch('scheduleTimes');

  // Regenerate schedule times when frequency changes
  const prevFreqRef = useRef(frequency);
  useEffect(() => {
    if (prevFreqRef.current === frequency) return;
    prevFreqRef.current = frequency;
    const count     = FREQ_COUNT[frequency] || 1;
    const firstTime = getValues('scheduleTimes')?.[0] || '08:00 AM';
    setValue('scheduleTimes', generateTimes(firstTime, count));
  }, [frequency, getValues, setValue]);

  function handleTimeChange(idx, inputVal) {
    if (!inputVal) return;
    const formatted = fromInputTime(inputVal);
    const count     = FREQ_COUNT[frequency] || 1;
    if (idx === 0 && count > 1) {
      setValue('scheduleTimes', generateTimes(formatted, count));
    } else {
      const current    = getValues('scheduleTimes');
      const newTimes   = [...current];
      newTimes[idx]    = formatted;
      setValue('scheduleTimes', newTimes);
    }
  }

  async function onSubmit(formData) {
    setApiError('');
    try {
      const displayName = getDrugDisplayName(drug);
      const genericName = cleanDrugText(drug.genericName) || displayName;
      const payload = {
        name:          displayName,
        genericName,
        dosage:        formData.dosage,
        frequency:     formData.frequency,
        scheduleTimes: formData.scheduleTimes,
        isOngoing:     formData.isOngoing,
        startDate:     formData.startDate,
        endDate:       !formData.isOngoing ? formData.endDate : undefined,
      };

      const res  = await fetch(`/api/caregiver/patients/${formData.patientId}/medications`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        setApiError(json.error || 'Failed to add medication.');
        return;
      }

      onSaved?.();
      onClose();
    } catch {
      setApiError('Something went wrong.');
    }
  }

  const displayName = getDrugDisplayName(drug);
  const genericName = cleanDrugText(drug.genericName);
  const brandName = cleanDrugText(drug.brandName);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>

        <div className="modal-header">
          <div>
            <h3 className="modal-title">Add to patient</h3>
            <p className="modal-sub">
              <strong style={{ textTransform: 'capitalize' }}>{displayName.toLowerCase()}</strong>
              {genericName && brandName.toLowerCase() !== 'unknown' && (
                <span style={{ color: 'var(--gray400)' }}> · {genericName.toLowerCase()}</span>
              )}
            </p>
          </div>
          <button className="modal-close" type="button" onClick={onClose}>
            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                 strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>

          {/* Patient */}
          <div className="form-grp">
            <label>Patient *</label>
            <select {...register('patientId', { required: true })}>
              {patients.map(p => (
                <option key={p._id} value={p._id}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
            </select>
            {errors.patientId && <span className="form-error">Please select a patient.</span>}
          </div>

          {/* Dosage + Frequency */}
          <div className="form-row-2">
            <div className="form-grp">
              <label>Dosage *</label>
              <input
                placeholder="e.g. 500mg"
                {...register('dosage', { required: 'Dosage is required.' })}
              />
              {errors.dosage && <span className="form-error">{errors.dosage.message}</span>}
            </div>
            <div className="form-grp">
              <label>Frequency *</label>
              <select {...register('frequency')}>
                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          {/* Schedule times */}
          <div className="form-grp">
            <label>Schedule times *</label>
            <div className="drug-times-grid">
              {(scheduleTimes || ['08:00 AM']).map((time, idx) => (
                <input
                  key={idx}
                  type="time"
                  value={toInputTime(time)}
                  onChange={e => handleTimeChange(idx, e.target.value)}
                />
              ))}
            </div>
          </div>

          {/* Start + End date */}
          <div className="form-row-2">
            <div className="form-grp">
              <label>Start date</label>
              <input type="date" {...register('startDate')} />
            </div>
            {!isOngoing && (
              <div className="form-grp">
                <label>End date</label>
                <input
                  type="date"
                  {...register('endDate', {
                    validate: v => isOngoing || !!v || 'End date is required.',
                  })}
                />
                {errors.endDate && <span className="form-error">{errors.endDate.message}</span>}
              </div>
            )}
          </div>

          {/* Ongoing checkbox */}
          <div className="form-grp form-grp-check">
            <input id="mod-ongoing" type="checkbox" {...register('isOngoing')} />
            <label htmlFor="mod-ongoing">Ongoing medication (no end date)</label>
          </div>

          {apiError && <p className="form-error">{apiError}</p>}

          <button type="submit" className="btn btn-teal btn-full" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Add medication'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Drug Card ─────────────────────────────────────────────────
function DrugCard({ drug, onAdd }) {
  const displayName = getDrugDisplayName(drug);
  const genericName = cleanDrugText(drug.genericName);
  const brandName = cleanDrugText(drug.brandName);

  return (
    <div className="drug-card">
      <div className="drug-card-top">
        <div className="drug-card-icon">
          <svg stroke="currentColor" fill="none" strokeWidth="1.8" viewBox="0 0 24 24"
               strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
        </div>
        <div className="drug-card-head">
          <h4 className="drug-card-name">{displayName.toLowerCase()}</h4>
          {genericName && brandName.toLowerCase() !== 'unknown' && (
            <p className="drug-card-generic">{genericName.toLowerCase()}</p>
          )}
        </div>
      </div>

      {(drug.route || drug.manufacturer) && (
        <div className="drug-card-meta">
          {drug.route && <span className="drug-chip">{drug.route}</span>}
          {drug.manufacturer && (
            <span className="drug-chip drug-chip--muted" title={drug.manufacturer}>
              {drug.manufacturer}
            </span>
          )}
        </div>
      )}

      {drug.indication && (
        <p className="drug-card-indication">{drug.indication}</p>
      )}

      <button className="btn btn-teal drug-card-add" type="button" onClick={() => onAdd(drug)}>
        <svg stroke="currentColor" fill="none" strokeWidth="2.5" viewBox="0 0 24 24"
             strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add to patient
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function DrugDirectory() {
  const [query,           setQuery]           = useState('');
  const [debouncedQuery,  setDebouncedQuery]  = useState('');
  const [drugs,           setDrugs]           = useState([]);
  const [total,           setTotal]           = useState(0);
  const [skip,            setSkip]            = useState(0);
  const [loading,         setLoading]         = useState(false);
  const [fetchError,      setFetchError]      = useState('');
  const [patients,        setPatients]        = useState([]);
  const [modal,           setModal]           = useState(null);
  const [successMsg,      setSuccessMsg]      = useState('');
  const [noPatientError,  setNoPatientError]  = useState(false);

  // Fetch caregiver's patient roster once
  useEffect(() => {
    fetch('/api/caregiver/patients')
      .then(r => r.json())
      .then(data => setPatients(data.patients || []))
      .catch(() => {});
  }, []);

  // Debounce search query (350 ms); reset skip when query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setSkip(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch drugs whenever debouncedQuery or skip changes
  const fetchDrugs = useCallback(async (q, s) => {
    setLoading(true);
    setFetchError('');
    try {
      const params = new URLSearchParams({ skip: String(s), limit: String(PAGE_SIZE) });
      if (q) params.set('q', q);
      const res  = await fetch(`/api/caregiver/drugs?${params}`);
      const data = await res.json();
      if (!res.ok) { setFetchError(data.error || 'Failed to load drugs.'); return; }
      setDrugs(data.drugs  || []);
      setTotal(data.total  || 0);
    } catch {
      setFetchError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrugs(debouncedQuery, skip);
  }, [debouncedQuery, skip, fetchDrugs]);

  const visibleDrugs = drugs.filter(hasDrugDisplayName);

  const page     = Math.floor(skip / PAGE_SIZE) + 1;
  const maxPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleAdd(drug) {
    if (!patients.length) {
      setNoPatientError(true);
      setTimeout(() => setNoPatientError(false), 4000);
      return;
    }
    setModal(drug);
  }

  function handleSaved() {
    setSuccessMsg('Medication added successfully!');
    setTimeout(() => setSuccessMsg(''), 3500);
  }

  return (
    <>
      {/* ── Topbar ── */}
      <div className="app-topbar">
        <div className="topbar-title">
          <h2>Drug Directory</h2>
          <p>Browse FDA-registered medications and add them to a patient</p>
        </div>
      </div>

      <main className="app-main">

        {/* ── Search bar ── */}
        <div className="drug-search-bar">
          <div className="search-box" style={{ flex: 1, maxWidth: 500 }}>
            <span className="search-icon">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by brand name or generic name…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          {!loading && total > 0 && (
            <span className="drug-total-lbl">{total.toLocaleString()} results</span>
          )}
        </div>

        {/* ── Success banner ── */}
        {successMsg && (
          <div className="drug-success-banner">
            <svg stroke="currentColor" fill="none" strokeWidth="2.5" viewBox="0 0 24 24"
                 strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {successMsg}
          </div>
        )}

        {/* ── No-patient warning ── */}
        {noPatientError && (
          <div className="drug-success-banner" style={{ background: '#fef3c7', color: '#92400e', borderColor: '#fbbf24' }}>
            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                 strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            You have no patients yet. Add a patient from the dashboard first.
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="drug-loading">Loading medications…</div>
        )}

        {/* ── Error ── */}
        {!loading && fetchError && (
          <p className="form-error" style={{ marginBottom: 16 }}>{fetchError}</p>
        )}

        {/* ── Empty state ── */}
        {!loading && !fetchError && visibleDrugs.length === 0 && (
          <div className="drug-empty">
            <div className="drug-empty-icon">
              <svg stroke="currentColor" fill="none" strokeWidth="1.5" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="24" height="24">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
              </svg>
            </div>
            <p>
              {debouncedQuery
                ? `No drugs found for "${debouncedQuery}".`
                : 'No drugs to display.'}
            </p>
          </div>
        )}

        {/* ── Cards grid ── */}
        {!loading && visibleDrugs.length > 0 && (
          <>
            <div className="drug-grid">
              {visibleDrugs.map((drug, idx) => (
                <DrugCard
                  key={drug.id && drug.brandName && drug.genericName ? drug.id + drug.brandName + drug.genericName : `${skip}-${idx}`}
                  drug={drug}
                  onAdd={handleAdd}
                />
              ))}
            </div>

            {/* ── Pagination ── */}
            <div className="drug-pagination">
              <button
                className="btn btn-ghost"
                onClick={() => setSkip(s => Math.max(0, s - PAGE_SIZE))}
                disabled={skip <= 0}
              >
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Prev
              </button>

              <span className="drug-page-lbl">Page {page} of {maxPages}</span>

              <button
                className="btn btn-ghost"
                onClick={() => setSkip(s => s + PAGE_SIZE)}
                disabled={skip + PAGE_SIZE >= total}
              >
                Next
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          </>
        )}

      </main>

      {/* ── Add medication modal ── */}
      {modal && (
        <AddMedModal
          drug={modal}
          patients={patients}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}