// app/admin/caregivers/page.js

'use client';
import '../admin.css';
import { useState, useEffect, useMemo } from 'react';

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
        credentials: 'include',
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

// ── Status Badge ──────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === 'active')   return <span className="admin-badge caregiver">Active</span>;
  if (status === 'pending')  return <span className="admin-badge" style={{ background: '#f59e0b', color: '#fff', border: 'none' }}>Pending</span>;
  if (status === 'rejected') return <span className="admin-badge" style={{ background: '#ef4444', color: '#fff', border: 'none' }}>Rejected</span>;
  return null;
}

// ── Main Page ─────────────────────────────────────────────────
export default function AdminCaregiversPage() {
  const [caregivers,    setCaregivers]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [editCaregiver, setEditCaregiver] = useState(null);
  const [deleteTarget,  setDeleteTarget]  = useState(null);

  useEffect(() => {
    fetch('/api/admin/caregivers', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setCaregivers(d.caregivers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return caregivers;
    return caregivers.filter(c =>
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  }, [caregivers, search]);

  async function handleStatus(id, newStatus) {
    const res = await fetch(`/api/admin/caregivers/${id}/status`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: newStatus }),
      credentials: 'include',
    });
    if (res.ok) {
      setCaregivers(prev => prev.map(c => c._id === id ? { ...c, status: newStatus } : c));
    }
  }

  async function handleDelete(id) {
    const res = await fetch(`/api/admin/caregivers/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) setCaregivers(prev => prev.filter(c => c._id !== id));
    setDeleteTarget(null);
  }

  return (
    <>
      <div className="app-topbar">
        <div className="topbar-title">
          <h2>Caregivers</h2>
          <p>Manage all caregiver accounts and their platform status</p>
        </div>
        <div className="topbar-right">
          <div className="topbar-avatar" style={{ background: '#7c3aed' }}>A</div>
        </div>
      </div>

      <main className="app-main">
        <div className="card-box" style={{ padding: 24 }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--gray500)' }}>
              {loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'caregiver' : 'caregivers'}`}
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
              {search ? 'No results match your search.' : 'No caregiver accounts found.'}
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Caregiver</th>
                    <th>Status</th>
                    <th>Qualification</th>
                    <th>Specialization</th>
                    <th>Patients</th>
                    <th>Member since</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const cp = c.caregiverProfile || {};
                    return (
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
                        <td><StatusBadge status={c.status} /></td>
                        <td>{cp.qualification  || '—'}</td>
                        <td>{cp.specialization  || '—'}</td>
                        <td>{c.patientCount ?? 0}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div className="admin-actions">
                            {c.status === 'pending' && (
                              <>
                                <button
                                  className="admin-action-btn"
                                  style={{ color: '#059669', fontWeight: 600, background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 6, padding: '4px 10px' }}
                                  onClick={() => handleStatus(c._id, 'active')}
                                >
                                  Approve
                                </button>
                                <button
                                  className="admin-action-btn"
                                  style={{ color: '#dc2626', fontWeight: 600, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: '4px 10px' }}
                                  onClick={() => handleStatus(c._id, 'rejected')}
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {c.status === 'rejected' && (
                              <button
                                className="admin-action-btn"
                                style={{ color: '#059669', fontWeight: 600 }}
                                onClick={() => handleStatus(c._id, 'active')}
                              >
                                Re-approve
                              </button>
                            )}
                            <button className="admin-action-btn edit" onClick={() => setEditCaregiver(c)}>
                              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                                   strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                                <path d="M12 20h9"/>
                                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                              </svg>
                              Edit
                            </button>
                            <button className="admin-action-btn delete" onClick={() => setDeleteTarget(c)}>
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

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
          name={`${deleteTarget.firstName} ${deleteTarget.lastName}`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget._id)}
        />
      )}
    </>
  );
}
