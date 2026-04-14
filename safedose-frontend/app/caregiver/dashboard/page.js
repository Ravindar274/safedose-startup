// app/caregiver/dashboard/page.js

'use client';
import '../caregiver-dashboard.css';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
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
  const [mode, setMode]         = useState('new'); // 'new' | 'link'
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [invitedEmail, setInvitedEmail] = useState(''); // set after invite sent

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

      if (data.invited) {
        // Invitation sent — show confirmation, don't add to roster yet
        setInvitedEmail(data.email);
      } else {
        onSaved(data.patient);
        onClose();
      }
    } catch {
      setError('Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  // ── Invitation sent confirmation ──
  if (invitedEmail) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-box" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg stroke="#059669" fill="none" strokeWidth="2.5" viewBox="0 0 24 24"
                 strokeLinecap="round" strokeLinejoin="round" width="26" height="26">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h3 style={{ margin: '0 0 8px', fontSize: 17, color: 'var(--gray900)', fontWeight: 700 }}>Invitation sent!</h3>
          <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--gray600)' }}>
            An email has been sent to
          </p>
          <p style={{ margin: '0 0 24px', fontSize: 14, fontWeight: 600, color: 'var(--gray800)' }}>
            {invitedEmail}
          </p>
          <p style={{ margin: '0 0 28px', fontSize: 13, color: 'var(--gray500)' }}>
            The patient will be added to your roster once they accept the invitation from their email.
          </p>
          <button className="btn btn-teal" style={{ minWidth: 120 }} onClick={onClose}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Add patient</h3>
            <p className="modal-sub">Create a profile for someone without an account, or invite an existing registered patient.</p>
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
            onClick={() => { setMode('new'); setError(''); }}
            type="button"
          >New patient</button>
          <button
            className={`modal-tab${mode === 'link' ? ' active' : ''}`}
            onClick={() => { setMode('link'); setError(''); }}
            type="button"
          >Invite registered patient</button>
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
                <input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} />
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
                The patient must have a SafeDose account. They will receive an email to accept or decline.
              </p>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn-teal btn-full" disabled={loading}>
            {loading
              ? (mode === 'link' ? 'Sending invite…' : 'Saving…')
              : (mode === 'link' ? 'Send Invitation' : 'Create patient')}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────
export default function CaregiverDashboard() {
  const [patients,  setPatients]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [requests,  setRequests]  = useState([]);
  const [respondingId, setRespondingId] = useState(null);
  const [banner,    setBanner]    = useState(''); // invitation accepted/declined banner
  const searchParams = useSearchParams();

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

  const fetchRequests = useCallback(async () => {
    try {
      const res  = await fetch('/api/caregiver/requests');
      const data = await res.json();
      setRequests(data.requests || []);
    } catch {
      setRequests([]);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
    fetchRequests();
  }, [fetchPatients, fetchRequests]);

  // Show banner when redirected back from email token link
  useEffect(() => {
    const inv = searchParams.get('invitation');
    if (inv === 'accepted') setBanner('You accepted the patient invitation. They have been added to your roster.');
    if (inv === 'declined') setBanner('You declined the patient invitation.');
  }, [searchParams]);

  async function handleRespond(requestId, action) {
    setRespondingId(requestId);
    try {
      const res = await fetch(`/api/caregiver/requests/${requestId}/${action}`, { method: 'PATCH' });
      if (!res.ok) return;
      setRequests(prev => prev.filter(r => r._id !== requestId));
      if (action === 'accept') fetchPatients(); // refresh roster
    } finally {
      setRespondingId(null);
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
  // medsToday: active medications for today (from backend live computation)
  // missedToday: doses overdue and not taken (from backend live computation)
  const total        = patients.length;
  const onTrack      = patients.filter(p => p.medsToday > 0 && p.missedToday === 0).length;
  const missed       = patients.filter(p => p.missedToday > 0).length;
  const noMeds       = patients.filter(p => p.medsToday === 0).length;
  const adherencePct = total > 0 ? Math.round((onTrack / total) * 100) : 0;

  const missedPatients  = patients.filter(p => p.missedToday > 0);
  const onTrackPatients = patients.filter(p => p.missedToday === 0);

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

        {/* ── Invitation banner (from email token redirect) ── */}
        {banner && (
          <div style={{ padding: '12px 16px', marginBottom: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ fontSize: 13, color: '#065f46' }}>{banner}</span>
            <button onClick={() => setBanner('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 16 }}>✕</button>
          </div>
        )}

        {/* ── Pending hire requests ── */}
        {requests.length > 0 && (
          <div className="card-box" style={{ marginBottom: 24 }}>
            <div className="section-hdr">
              <h3>
                Hire Requests
                <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#0d9488', color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: 11, fontWeight: 700 }}>
                  {requests.length}
                </span>
              </h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {requests.map(req => {
                const p = req.patientUserId || {};
                const dob = p.dateOfBirth
                  ? new Date(p.dateOfBirth).toLocaleDateString('en-CA')
                  : null;
                return (
                  <div key={req._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', background: 'var(--gray50)', borderRadius: 10, border: '1px solid var(--gray200)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--gray900)' }}>
                        {p.firstName} {p.lastName}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--gray500)', marginTop: 2 }}>
                        {p.email}{dob ? ` · DOB: ${dob}` : ''}
                      </div>
                      {req.message && (
                        <div style={{ fontSize: 12, color: 'var(--gray500)', fontStyle: 'italic', marginTop: 4 }}>
                          &ldquo;{req.message}&rdquo;
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        className="btn btn-teal"
                        style={{ fontSize: 12, padding: '6px 14px' }}
                        disabled={respondingId === req._id}
                        onClick={() => handleRespond(req._id, 'accept')}
                      >
                        {respondingId === req._id ? '…' : 'Accept'}
                      </button>
                      <button
                        style={{ fontSize: 12, padding: '6px 14px', background: 'var(--gray100)', border: '1px solid var(--gray300)', borderRadius: 8, cursor: 'pointer', fontWeight: 500, color: 'var(--gray700)' }}
                        disabled={respondingId === req._id}
                        onClick={() => handleRespond(req._id, 'decline')}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
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
          ) : patients.length === 0 ? (
            <p style={{ color: 'var(--gray400)', fontSize: 13, padding: '20px 0' }}>No patients yet. Click &quot;Add patient&quot; to get started.</p>
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