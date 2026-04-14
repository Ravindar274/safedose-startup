// app/admin/patients/page.js

'use client';
import '../admin.css';
import { useState, useEffect, useMemo } from 'react';

function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
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
        credentials: 'include',
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
            <input type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} />
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

// ── Main Page ─────────────────────────────────────────────────
export default function AdminPatientsPage() {
  const [patients,     setPatients]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [editPatient,  setEditPatient]  = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    fetch('/api/admin/patients', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setPatients(d.patients || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return patients;
    return patients.filter(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    );
  }, [patients, search]);

  async function handleDelete(id) {
    const res = await fetch(`/api/admin/patients/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) setPatients(prev => prev.filter(p => p._id !== id));
    setDeleteTarget(null);
  }

  return (
    <>
      <div className="app-topbar">
        <div className="topbar-title">
          <h2>Patients</h2>
          <p>View and manage all patient records on the platform</p>
        </div>
        <div className="topbar-right">
          <div className="topbar-avatar" style={{ background: '#7c3aed' }}>A</div>
        </div>
      </div>

      <main className="app-main">
        <div className="card-box" style={{ padding: 24 }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--gray500)' }}>
              {loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'patient' : 'patients'}`}
            </p>
            <div className="admin-search">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                placeholder="Search by name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="admin-empty">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="admin-empty">
              {search ? 'No results match your search.' : 'No patient records found.'}
            </div>
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
                  {filtered.map(p => (
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
                          <button className="admin-action-btn delete" onClick={() => setDeleteTarget(p)}>
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
          )}
        </div>
      </main>

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

      {deleteTarget && (
        <DeleteConfirmModal
          name={`${deleteTarget.firstName} ${deleteTarget.lastName}`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget._id)}
        />
      )}
    </>
  );
}
