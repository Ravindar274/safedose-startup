// app/caregiver/dashboard/page.js

'use client';
import '../caregiver-dashboard.css';
import { useState, useEffect, useCallback } from 'react';
import NotificationBell from '../../components/NotificationBell';

// ── Helpers ──────────────────────────────────────────────
function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

function statusOf(patient) {
  if (patient.missedToday > 0)  return 'warning';
  if (patient.medsToday === 0)  return 'no-meds';
  return 'on-track';
}

// ── Add Patient Modal ─────────────────────────────────────
function AddPatientModal({ onClose, onSaved }) {
  const [mode, setMode]       = useState('new'); // 'new' | 'link'
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // New patient fields
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', dateOfBirth: '', notes: '',
  });

  // Link patient field
  const [linkedEmail, setLinkedEmail] = useState('');

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = mode === 'link'
        ? { mode: 'link', linkedEmail }
        : { mode: 'new', ...form };

      const res  = await fetch('/api/caregiver/patients', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to add patient.'); return; }
      onSaved(data.patient);
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

        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Add patient</h3>
            <p className="modal-sub">Create a profile for someone without an account, or link an existing registered patient.</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                 strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Mode toggle */}
        <div className="modal-tabs">
          <button
            className={`modal-tab${mode === 'new' ? ' active' : ''}`}
            onClick={() => setMode('new')}
            type="button"
          >New patient</button>
          <button
            className={`modal-tab${mode === 'link' ? ' active' : ''}`}
            onClick={() => setMode('link')}
            type="button"
          >Link registered patient</button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'new' ? (
            <>
              <div className="form-row-2">
                <div className="form-grp">
                  <label>First name *</label>
                  <input name="firstName" placeholder="Jane" value={form.firstName} onChange={handleChange} required />
                </div>
                <div className="form-grp">
                  <label>Last name *</label>
                  <input name="lastName" placeholder="Smith" value={form.lastName} onChange={handleChange} required />
                </div>
              </div>
              <div className="form-grp">
                <label>Email (optional — used for account claim later)</label>
                <input name="email" type="email" placeholder="jane@example.com" value={form.email} onChange={handleChange} />
              </div>
              <div className="form-grp">
                <label>Date of birth (optional)</label>
                <input name="dateOfBirth" type="date" max={new Date().toISOString().split('T')[0]} value={form.dateOfBirth} onChange={handleChange} />
              </div>
              <div className="form-grp">
                <label>Notes (optional)</label>
                <textarea name="notes" placeholder="Allergies, conditions, special instructions..." value={form.notes} onChange={handleChange} rows={3} />
              </div>
            </>
          ) : (
            <div className="form-grp">
              <label>Registered patient email *</label>
              <input type="email" placeholder="patient@example.com" value={linkedEmail}
                     onChange={e => setLinkedEmail(e.target.value)} required />
              <p style={{ fontSize: 12, color: 'var(--gray400)', marginTop: 6 }}>
                The patient must already have a SafeDose account with role &quot;patient&quot;.
              </p>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-teal btn-full" disabled={loading}>
            {loading ? 'Saving…' : mode === 'link' ? 'Link patient' : 'Create patient'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function CaregiverDashboard() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/caregiver/patients');
      const data = await res.json();
      setPatients(data.patients || []);
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  async function handleRequest(id, action) {
    try {
      const res = await fetch(`/api/caregiver/patients/${id}/${action}`, { method: 'PATCH' });
      if (res.ok) fetchPatients();
    } catch(err) {
      console.error(err);
    }
  }

  async function deletePatient(id) {
    if (!confirm('Remove this patient from your roster?')) return;
    await fetch(`/api/caregiver/patients/${id}`, { method: 'DELETE' });
    setPatients(prev => prev.filter(p => p._id !== id));
  }

  function onPatientSaved(newPatient) {
    setPatients(prev => [newPatient, ...prev]);
  }

  // ── Derived stats ──
  const pendingRequests = patients.filter(p => p.assignmentStatus === 'pending');
  const activePatients  = patients.filter(p => p.assignmentStatus !== 'pending');

  const total        = activePatients.length;
  const onTrack      = activePatients.filter(p => p.medsToday > 0 && p.missedToday === 0).length;
  const missed       = activePatients.filter(p => p.missedToday > 0).length;
  const noMeds       = activePatients.filter(p => p.medsToday === 0).length;
  const adherencePct = total > 0 ? Math.round((onTrack / total) * 100) : 0;

  const missedPatients  = activePatients.filter(p => p.missedToday > 0);
  const onTrackPatients = activePatients.filter(p => p.missedToday === 0);

  return (
    <>
      {/* ── Topbar ── */}
      <div className="app-topbar">
        <div className="topbar-title">
          <h2>My Patients</h2>
          <p>Monitor and manage all assigned patients</p>
        </div>
        <div className="topbar-right">
          <NotificationBell />
          <div className="topbar-avatar">RC</div>
        </div>
      </div>

      <main className="app-main">

        {/* ── Stat cards ── */}
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div className="stat-val">{total}</div>
            <div className="stat-lbl">Total patients</div>
            <div className="stat-change">under your care</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <div className="stat-val">{onTrack}</div>
            <div className="stat-lbl">On track today</div>
            <div className="stat-change">all doses taken</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--warn-soft)' }}>
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="18" height="18" style={{ color: 'var(--warn)' }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="stat-val">{missed}</div>
            <div className="stat-lbl">Missed doses</div>
            <div className="stat-change">need follow-up</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--teal-soft)' }}>
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="18" height="18" style={{ color: 'var(--teal)' }}>
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div className="stat-val">{adherencePct}<span className="stat-val-unit">%</span></div>
            <div className="stat-lbl">Adherence rate</div>
            <div className="stat-progress">
              <div className="stat-progress-bar" style={{ width: `${adherencePct}%` }} />
            </div>
            <div className="stat-change">
              {noMeds > 0 ? `${noMeds} patient${noMeds !== 1 ? 's' : ''} not yet scheduled` : 'across all patients today'}
            </div>
          </div>
        </div>

        {/* ── Pending Requests ── */}
        {pendingRequests.length > 0 && (
          <div className="card-box" style={{ marginBottom: 24, padding: 24, border: '1px solid #ffedd5' }}>
            <div className="section-hdr" style={{ marginBottom: 16 }}>
              <h3 style={{ color: '#ea580c', display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.9 1.3 1.5 1.5 2.5"/>
                  <path d="M9 18h6"/>
                  <path d="M10 22h4"/>
                </svg>
                New Patient Requests
              </h3>
            </div>
            {pendingRequests.map(p => (
              <div key={p._id} className="patient-row" style={{ background: '#fff9f2', borderRadius: 12, padding: 16, border: '1px solid #ffedd5' }}>
                <div className="patient-avatar" style={{ background: '#ffedd5', color: '#ea580c' }}>
                  {initials(p.firstName, p.lastName)}
                </div>
                <div className="patient-info">
                  <span className="patient-name">{p.firstName} {p.lastName}</span>
                  <span className="patient-no-account" style={{ background: '#ea580c', color: '#fff', marginLeft: 8 }}>requested you as caregiver</span>
                </div>
                <div className="patient-actions" style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" style={{ background: 'var(--warn-soft)', color: 'var(--warn)', padding: '6px 16px' }} onClick={() => handleRequest(p._id, 'reject')}>Decline</button>
                  <button className="btn btn-teal" style={{ padding: '6px 16px' }} onClick={() => handleRequest(p._id, 'accept')}>Accept</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Patient roster ── */}
        <div className="card-box">
          <div className="section-hdr">
            <h3>Patient roster</h3>
            <button className="btn btn-teal" onClick={() => setShowModal(true)}>
              <svg stroke="currentColor" fill="none" strokeWidth="2.5" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add patient
            </button>
          </div>

          {loading ? (
            <p style={{ color: 'var(--gray400)', fontSize: 13, padding: '20px 0' }}>Loading patients…</p>
          ) : activePatients.length === 0 ? (
            <p style={{ color: 'var(--gray400)', fontSize: 13, padding: '20px 0' }}>No active patients yet. Click &quot;Add patient&quot; to get started.</p>
          ) : (
            <>
              {/* Missed doses section */}
              {missedPatients.length > 0 && (
                <>
                  <p className="roster-section-lbl">Missed Doses</p>
                  {missedPatients.map(p => (
                    <PatientRow key={p._id} patient={p} onDelete={deletePatient} />
                  ))}
                </>
              )}

              {/* On track section */}
              {onTrackPatients.length > 0 && (
                <>
                  <p className="roster-section-lbl">On Track</p>
                  {onTrackPatients.map(p => (
                    <PatientRow key={p._id} patient={p} onDelete={deletePatient} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* ── Modal ── */}
      {showModal && (
        <AddPatientModal
          onClose={() => setShowModal(false)}
          onSaved={onPatientSaved}
        />
      )}
    </>
  );
}

import { useRouter } from 'next/navigation';

// ── Patient Row Component ─────────────────────────────────
function PatientRow({ patient, onDelete }) {
  const router = useRouter();
  const status = statusOf(patient);
  const hasAccount = !!patient.linkedUserId;

  return (
    <div className="patient-row" onClick={() => router.push(`/caregiver/dashboard/${patient._id}`)} style={{ cursor: 'pointer' }}>
      <div className="patient-avatar">
        {initials(patient.firstName, patient.lastName)}
      </div>
      <div className="patient-info">
        <span className="patient-name">
          {patient.firstName} {patient.lastName}
        </span>
        {!hasAccount && <span className="patient-no-account">no account</span>}
        <span className="patient-meta">
          {patient.medsToday > 0
            ? `${patient.medsToday} medication${patient.medsToday !== 1 ? 's' : ''} today`
            : 'none scheduled today'}
          {patient.missedToday > 0 && ` · ${patient.missedToday} dose${patient.missedToday !== 1 ? 's' : ''} missed`}
        </span>
      </div>
      <div className="patient-actions">
        <span className={`status-badge ${
          status === 'warning'  ? 'status-missed' :
          status === 'no-meds' ? 'status-upcoming' :
          'status-taken'
        }`}>
          {status === 'warning' ? 'Missed doses' : status === 'no-meds' ? 'Not scheduled' : 'On track'}
        </span>
        <button className="icon-btn icon-btn-del" onClick={(e) => { e.stopPropagation(); onDelete(patient._id); }} title="Remove patient">
          <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
               strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}