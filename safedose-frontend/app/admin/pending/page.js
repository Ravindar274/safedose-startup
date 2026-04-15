// app/admin/pending/page.js

'use client';
import '../admin.css';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

export default function AdminPendingPage() {
  const searchParams = useSearchParams();
  const [caregivers, setCaregivers] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState(searchParams.get('search') || '');
  const [acting,     setActing]     = useState(null); // id being approved/rejected

  useEffect(() => {
    fetch('/api/admin/caregivers', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setCaregivers((d.caregivers || []).filter(c => c.status === 'pending')))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleStatus(id, newStatus) {
    setActing(id);
    try {
      const res = await fetch(`/api/admin/caregivers/${id}/status`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: newStatus }),
        credentials: 'include',
      });
      if (res.ok) {
        setCaregivers(prev => prev.filter(c => c._id !== id));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActing(null);
    }
  }

  const filtered = caregivers.filter(c => {
    const q = search.toLowerCase();
    return !q
      || `${c.firstName} ${c.lastName}`.toLowerCase().includes(q)
      || c.email?.toLowerCase().includes(q);
  });

  return (
    <>
      <div className="app-topbar">
        <div className="topbar-title">
          <h2>Pending Approvals</h2>
          <p>Review caregiver applications before granting platform access</p>
        </div>
        <div className="topbar-right">
          <div className="topbar-avatar" style={{ background: '#7c3aed' }}>A</div>
        </div>
      </div>

      <main className="app-main">
        <div className="card-box" style={{ padding: 24 }}>

          {/* Search + count */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--gray500)' }}>
              {loading ? 'Loading…' : `${filtered.length} pending ${filtered.length === 1 ? 'application' : 'applications'}`}
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
              <svg stroke="currentColor" fill="none" strokeWidth="1.5" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="36" height="36"
                   style={{ color: 'var(--gray300)', marginBottom: 8 }}>
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <p>{search ? 'No results match your search.' : 'No pending approvals. All caregiver accounts are reviewed.'}</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Caregiver</th>
                    <th>Qualification</th>
                    <th>Specialization</th>
                    <th>Experience</th>
                    <th>License ID</th>
                    <th>Languages</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => {
                    const cp  = c.caregiverProfile || {};
                    const busy = acting === c._id;
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
                        <td>{cp.qualification  || '—'}</td>
                        <td>{cp.specialization  || '—'}</td>
                        <td>{cp.experienceYears != null ? `${cp.experienceYears} yr${cp.experienceYears !== 1 ? 's' : ''}` : '—'}</td>
                        <td>{cp.licenseId       || '—'}</td>
                        <td>{cp.languagesSpoken || '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div className="admin-actions">
                            <button
                              className="admin-action-btn"
                              style={{ color: '#059669', fontWeight: 600, background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 6, padding: '4px 12px', opacity: busy ? 0.6 : 1 }}
                              onClick={() => handleStatus(c._id, 'active')}
                              disabled={busy}
                            >
                              {busy ? '…' : 'Approve'}
                            </button>
                            <button
                              className="admin-action-btn"
                              style={{ color: '#dc2626', fontWeight: 600, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: '4px 12px', opacity: busy ? 0.6 : 1 }}
                              onClick={() => handleStatus(c._id, 'rejected')}
                              disabled={busy}
                            >
                              {busy ? '…' : 'Reject'}
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
    </>
  );
}
