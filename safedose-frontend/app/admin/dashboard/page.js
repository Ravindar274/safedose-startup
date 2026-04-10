// app/admin/dashboard/page.js

'use client';
import '../admin.css';
import { useState, useEffect, useMemo } from 'react';

// ── Helpers ───────────────────────────────────────────────────
function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

// ── Edit Caregiver Modal ──────────────────────────────────────
function EditCaregiverModal({ user, onClose, onSaved }) {
  const [form, setForm] = useState({
    firstName: user.firstName || '',
    lastName:  user.lastName  || '',
    email:     user.email     || '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res  = await fetch(`/api/admin/caregivers/${user._id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to update.'); return; }
      onSaved(data.user);
    } catch { setError('Something went wrong.'); }
    finally  { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Edit caregiver</h3>
            <p className="modal-sub">Update account details for {user.firstName} {user.lastName}.</p>
          </div>
          <button className="modal-close" onClick={onClose} type="button">
            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                 strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          <div className="form-row-2">
            <div className="form-grp">
              <label>First name</label>
              <input required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div className="form-grp">
              <label>Last name</label>
              <input required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div className="form-grp">
            <label>Email</label>
            <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button type="button" className="btn" style={{ flex: 1, background: 'var(--gray100)', color: 'var(--gray800)' }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-teal" style={{ flex: 1 }} disabled={loading}>{loading ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Patient Modal ────────────────────────────────────────
function EditPatientModal({ patient, onClose, onSaved }) {
  const [form, setForm] = useState({
    firstName:   patient.firstName   || '',
    lastName:    patient.lastName    || '',
    email:       patient.email       || '',
    dateOfBirth: patient.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().slice(0, 10) : '',
    notes:       patient.notes       || '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res  = await fetch(`/api/admin/patients/${patient._id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to update.'); return; }
      onSaved(data.patient);
    } catch { setError('Something went wrong.'); }
    finally  { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Edit patient</h3>
            <p className="modal-sub">Update record for {patient.firstName} {patient.lastName}.</p>
          </div>
          <button className="modal-close" onClick={onClose} type="button">
            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                 strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        {error && <p className="form-error" style={{ marginTop: 12 }}>{error}</p>}
        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          <div className="form-row-2">
            <div className="form-grp">
              <label>First name</label>
              <input required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div className="form-grp">
              <label>Last name</label>
              <input required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div className="form-grp">
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-grp">
            <label>Date of birth</label>
            <input type="date" max={new Date().toISOString().split('T')[0]} value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} />
          </div>
          <div className="form-grp">
            <label>Notes</label>
            <textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                      style={{ resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button type="button" className="btn" style={{ flex: 1, background: 'var(--gray100)', color: 'var(--gray800)' }} onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-teal" style={{ flex: 1 }} disabled={loading}>{loading ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────
function DeleteConfirmModal({ name, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false);
  async function handle() {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3 className="modal-title">Delete {name}?</h3>
          <button className="modal-close" onClick={onClose} type="button">
            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                 strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <p style={{ fontSize: 14, color: 'var(--gray600)', margin: '16px 0 24px' }}>
          This will permanently delete <strong>{name}</strong> and all associated data. This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn" style={{ flex: 1, background: 'var(--gray100)', color: 'var(--gray800)' }} onClick={onClose}>Cancel</button>
          <button className="btn" style={{ flex: 1, background: 'var(--danger)', color: '#fff' }} onClick={handle} disabled={loading}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Caregiver Details Modal ───────────────────────────────────
function CaregiverDetailsModal({ caregiver, onClose }) {
  const profile = caregiver.caregiverProfile || {};

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title">Caregiver Application Details</h3>
            <p className="modal-sub">{caregiver.firstName} {caregiver.lastName}</p>
          </div>
          <button className="modal-close" onClick={onClose} type="button">
            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div style={{ marginTop: 20, display: 'grid', gap: 12, fontSize: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><strong style={{ display: 'block', color: 'var(--gray500)', fontSize: 12, marginBottom: 4 }}>Email</strong> {caregiver.email}</div>
            <div><strong style={{ display: 'block', color: 'var(--gray500)', fontSize: 12, marginBottom: 4 }}>Gender</strong> {caregiver.gender || 'N/A'}</div>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--gray200)', margin: '8px 0' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><strong style={{ display: 'block', color: 'var(--gray500)', fontSize: 12, marginBottom: 4 }}>Qualification</strong> {profile.qualification || 'N/A'}</div>
            <div><strong style={{ display: 'block', color: 'var(--gray500)', fontSize: 12, marginBottom: 4 }}>Specialization</strong> {profile.specialization || 'N/A'}</div>
            <div><strong style={{ display: 'block', color: 'var(--gray500)', fontSize: 12, marginBottom: 4 }}>Experience</strong> {profile.experienceYears ? `${profile.experienceYears} years` : 'N/A'}</div>
            <div><strong style={{ display: 'block', color: 'var(--gray500)', fontSize: 12, marginBottom: 4 }}>License ID</strong> {profile.licenseId || 'N/A'}</div>
          </div>
          <div><strong style={{ display: 'block', color: 'var(--gray500)', fontSize: 12, marginBottom: 4 }}>Languages</strong> {profile.languagesSpoken || 'N/A'}</div>
          <div><strong style={{ display: 'block', color: 'var(--gray500)', fontSize: 12, marginBottom: 4 }}>Availability</strong> {profile.availability || 'N/A'}</div>
        </div>
        <div style={{ marginTop: 24 }}>
          <button type="button" className="btn btn-teal btn-full" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function AdminDashboard() {
  const [tab,        setTab]        = useState('patients'); // 'patients' | 'caregivers'
  const [patients,   setPatients]   = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');

  const [editPatient,   setEditPatient]   = useState(null);
  const [editCaregiver, setEditCaregiver] = useState(null);
  const [viewCaregiver, setViewCaregiver] = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null); // { type, item }

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [statsRes, pRes, cgRes] = await Promise.all([
          fetch('/api/admin/stats',      { credentials: 'include' }),
          fetch('/api/admin/patients',   { credentials: 'include' }),
          fetch('/api/admin/caregivers', { credentials: 'include' }),
        ]);
        const [statsData, pData, cgData] = await Promise.all([statsRes.json(), pRes.json(), cgRes.json()]);
        setStats(statsData);
        setPatients(pData.patients  || []);
        setCaregivers(cgData.caregivers || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Filtered lists ──
  const filteredPatients = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return patients;
    return patients.filter(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    );
  }, [patients, search]);

  const activeCaregivers = useMemo(() => {
    return caregivers.filter(c => !c.status || c.status === 'active');
  }, [caregivers]);

  const filteredCaregivers = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return activeCaregivers;
    return activeCaregivers.filter(c =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [caregivers, search]);

  // ── Delete handlers ──
  async function handleDeletePatient(id) {
    const res = await fetch(`/api/admin/patients/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      setPatients(prev => prev.filter(p => p._id !== id));
      setStats(prev => prev ? { ...prev, totalPatients: prev.totalPatients - 1 } : prev);
    }
    setDeleteTarget(null);
  }

  async function handleDeleteCaregiver(id) {
    const res = await fetch(`/api/admin/caregivers/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      setCaregivers(prev => prev.filter(c => c._id !== id));
      setStats(prev => prev ? { ...prev, totalCaregivers: prev.totalCaregivers - 1, totalUsers: prev.totalUsers - 1 } : prev);
    }
    setDeleteTarget(null);
  }

  async function handleUpdateStatus(id, newStatus) {
    try {
      const res = await fetch(`/api/admin/caregivers/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include'
      });
      if (res.ok) {
        setCaregivers(prev => prev.map(c => c._id === id ? { ...c, status: newStatus } : c));
      }
    } catch(err) { console.error(err); }
  }

  return (
    <>
      {/* ── Topbar ── */}
      <div className="app-topbar">
        <div className="topbar-title">
          <h2>Admin Dashboard</h2>
          <p>Manage patients and caregivers across the platform</p>
        </div>
        <div className="topbar-right">
          <div className="topbar-avatar" style={{ background: '#7c3aed' }}>A</div>
        </div>
      </div>

      <main className="app-main">

        {/* ── Stat cards ── */}
        <div className="stat-grid" style={{ marginBottom: 28 }}>
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
            <div className="stat-val">{stats?.totalUsers ?? '—'}</div>
            <div className="stat-lbl">Total users</div>
            <div className="stat-change">all accounts</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#ede9fe' }}>
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="18" height="18" style={{ color: '#7c3aed' }}>
                <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <div className="stat-val">{stats?.totalPatients ?? '—'}</div>
            <div className="stat-lbl">Patients</div>
            <div className="stat-change">registered records</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'var(--teal-soft)' }}>
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="18" height="18" style={{ color: 'var(--teal)' }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div className="stat-val">{stats?.totalCaregivers ?? '—'}</div>
            <div className="stat-lbl">Caregivers</div>
            <div className="stat-change">active accounts</div>
          </div>
        </div>

        {/* ── Tabs + search ── */}
        <div className="card-box" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div className="admin-tabs" style={{ margin: 0 }}>
              <button
                className={`admin-tab${tab === 'patients' ? ' active' : ''}`}
                onClick={() => { setTab('patients'); setSearch(''); }}
              >
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
                Patients
                <span className="admin-tab-count">{patients.length}</span>
              </button>
              <button
                className={`admin-tab${tab === 'caregivers' ? ' active' : ''}`}
                onClick={() => { setTab('caregivers'); setSearch(''); }}
              >
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Caregivers
                <span className="admin-tab-count">{activeCaregivers.length}</span>
              </button>
            </div>

            <div className="admin-search">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                placeholder={`Search ${tab}…`}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="admin-empty">Loading…</div>
          ) : tab === 'patients' ? (
            filteredPatients.length === 0 ? (
              <div className="admin-empty">No patients found.</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Date of birth</th>
                      <th>Account</th>
                      <th>Medications</th>
                      <th>Caregivers</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatients.map(p => (
                      <tr key={p._id}>
                        <td>
                          <div className="admin-user-cell">
                            <div className="admin-avatar patient">{initials(p.firstName, p.lastName)}</div>
                            <div>
                              <div className="admin-user-name">{p.firstName} {p.lastName}</div>
                              <div className="admin-user-email">{p.email || p.linkedEmail || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td>{p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString() : '—'}</td>
                        <td>
                          {p.linkedUserId
                            ? <span className="admin-badge linked">Linked</span>
                            : <span className="admin-badge unlinked">No account</span>
                          }
                        </td>
                        <td>{p.medCount ?? 0}</td>
                        <td>{p.caregiverCount ?? 0}</td>
                        <td>
                          <div className="admin-actions">
                            <button className="admin-action-btn edit" onClick={() => setEditPatient(p)}>
                              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                                   strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                <path d="M12 20h9"/>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                              </svg>
                              Edit
                            </button>
                            <button className="admin-action-btn delete" onClick={() => setDeleteTarget({ type: 'patient', item: p })}>
                              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                                   strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            filteredCaregivers.length === 0 ? (
              <div className="admin-empty">No caregivers found.</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Caregiver</th>
                      <th>Status</th>
                      <th>Patients assigned</th>
                      <th>Member since</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCaregivers.map(c => (
                      <tr key={c._id}>
                        <td>
                          <div className="admin-user-cell">
                            <div className="admin-avatar caregiver">{initials(c.firstName, c.lastName)}</div>
                            <div>
                              <div className="admin-user-name">{c.firstName} {c.lastName}</div>
                              <div className="admin-user-email">{c.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          {c.status === 'pending' ? <span className="admin-badge" style={{background: '#f59e0b', color: '#fff', border: 'none'}}>Pending</span> :
                           c.status === 'rejected' ? <span className="admin-badge" style={{background: '#ef4444', color: '#fff', border: 'none'}}>Rejected</span> :
                           <span className="admin-badge caregiver">Active</span>}
                        </td>
                        <td>{c.patientCount ?? 0}</td>
                        <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div className="admin-actions">
                            {c.status === 'pending' && (
                              <>
                                <button className="admin-action-btn" style={{color: '#10b981', fontWeight: 600}} onClick={() => handleUpdateStatus(c._id, 'active')}>
                                  Approve
                                </button>
                                <button className="admin-action-btn" style={{color: '#ef4444', fontWeight: 600}} onClick={() => handleUpdateStatus(c._id, 'rejected')}>
                                  Reject
                                </button>
                              </>
                            )}
                            <button className="admin-action-btn edit" onClick={() => setViewCaregiver(c)}>
                              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                                   strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                              </svg>
                              Details
                            </button>
                            <button className="admin-action-btn edit" onClick={() => setEditCaregiver(c)}>
                              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                                   strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                <path d="M12 20h9"/>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                              </svg>
                              Edit
                            </button>
                            <button className="admin-action-btn delete" onClick={() => setDeleteTarget({ type: 'caregiver', item: c })}>
                              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                                   strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                              </svg>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </main>

      {/* ── Modals ── */}
      {editPatient && (
        <EditPatientModal
          patient={editPatient}
          onClose={() => setEditPatient(null)}
          onSaved={updated => {
            setPatients(prev => prev.map(p => p._id === updated._id ? { ...p, ...updated } : p));
            setEditPatient(null);
          }}
        />
      )}

      {editCaregiver && (
        <EditCaregiverModal
          user={editCaregiver}
          onClose={() => setEditCaregiver(null)}
          onSaved={updated => {
            setCaregivers(prev => prev.map(c => c._id === updated._id ? { ...c, ...updated } : c));
            setEditCaregiver(null);
          }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          name={`${deleteTarget.item.firstName} ${deleteTarget.item.lastName}`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() =>
            deleteTarget.type === 'patient'
              ? handleDeletePatient(deleteTarget.item._id)
              : handleDeleteCaregiver(deleteTarget.item._id)
          }
        />
      )}

      {viewCaregiver && (
        <CaregiverDetailsModal
          caregiver={viewCaregiver}
          onClose={() => setViewCaregiver(null)}
        />
      )}
    </>
  );
}
