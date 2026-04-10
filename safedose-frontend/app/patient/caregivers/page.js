// app/patient/caregivers/page.js

'use client';
import { useState, useEffect } from 'react';
import NotificationBell from '../../components/NotificationBell';
import { useAuth } from '../../context/AuthContext';

function initials(first, last) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

export default function PatientCaregiversPage() {
  const { user } = useAuth();
  const userInitial = user?.firstName?.charAt(0).toUpperCase() || 'P';

  const [caregivers, setCaregivers] = useState([]);
  const [hasCaregiver, setHasCaregiver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [linkingId, setLinkingId] = useState(null);

  async function loadCaregivers() {
    setLoading(true);
    try {
      const res = await fetch('/api/patient/caregivers', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCaregivers(data.caregivers || []);
      setHasCaregiver(data.hasCaregiver || false);
    } catch(err) {
      setError('Could not load caregivers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCaregivers(); }, []);

  async function handleUnassign() {
    if (!confirm('Are you sure you want to remove your assigned caregiver?')) return;
    try {
      const res = await fetch('/api/patient/caregivers/unassign', { 
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        await loadCaregivers();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to remove caregiver.');
      }
    } catch(err) {
      console.error(err);
      alert('An error occurred.');
    }
  }

  async function handleAddCaregiver(id) {
    setLinkingId(id);
    try {
      const res = await fetch(`/api/patient/caregivers/${id}/link`, {
        method: 'POST',
        credentials: 'include'
      });
      if (res.ok) {
        await loadCaregivers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to assign caregiver.');
      }
    } catch(err) {
      console.error(err);
      alert('An error occurred.');
    } finally {
      setLinkingId(null);
    }
  }

  return (
    <>
      <div className="app-topbar">
        <div className="topbar-title">
          <h2>Caregivers</h2>
          <p>Find and manage your professional caregivers</p>
        </div>
        <div className="topbar-right">
          <NotificationBell />
          <div className="topbar-avatar">{userInitial}</div>
        </div>
      </div>

      <main className="app-main">
        <div style={{ background: '#fff', border: '1px solid var(--gray200)', borderRadius: 16, padding: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--gray500)', padding: 40 }}>Loading caregivers...</div>
          ) : error ? (
            <div style={{ textAlign: 'center', color: 'var(--danger)', padding: 40 }}>{error}</div>
          ) : caregivers.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--gray500)', padding: 40 }}>No active caregivers available in the system yet.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {caregivers.map(c => (
                <div key={c._id} style={{ border: '1px solid var(--gray200)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--teal-soft)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 16 }}>
                      {initials(c.firstName, c.lastName)}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 16, color: 'var(--gray900)' }}>{c.firstName} {c.lastName}</h4>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--gray500)' }}>{c.profile?.specialization || 'General Care'}</p>
                    </div>
                  </div>
                  
                  <div style={{ fontSize: 13, color: 'var(--gray600)', display: 'grid', gap: 6 }}>
                    <div><strong>Experience:</strong> {c.profile?.experienceYears ? `${c.profile.experienceYears} years` : 'Not specified'}</div>
                    <div><strong>Languages:</strong> {c.profile?.languagesSpoken || 'Not specified'}</div>
                    <div><strong>Qualification:</strong> {c.profile?.qualification || 'Not specified'}</div>
                  </div>

                  <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                    {c.isAssigned ? (
                      c.assignmentStatus === 'pending' ? (
                        <>
                          <button className="btn" disabled style={{ width: '100%', background: '#ffedd5', color: '#ea580c', fontWeight: 600, marginBottom: 8 }}>
                            Pending Approval
                          </button>
                          <button className="btn" style={{ width: '100%', border: '1px solid var(--danger)', color: 'var(--danger)', background: 'none' }} onClick={handleUnassign}>
                            Cancel Request
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn" disabled style={{ width: '100%', background: 'var(--teal-soft)', color: 'var(--teal)', fontWeight: 600, marginBottom: 8 }}>
                            <svg stroke="currentColor" fill="none" strokeWidth="3" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" style={{ marginRight: 6 }}>
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                            Current Caregiver
                          </button>
                          <button className="btn" style={{ width: '100%', border: '1px solid var(--danger)', color: 'var(--danger)', background: 'none' }} onClick={handleUnassign}>
                            Remove Caregiver
                          </button>
                        </>
                      )
                    ) : (
                      <button 
                        className="btn btn-teal btn-full" 
                        onClick={() => handleAddCaregiver(c._id)}
                        disabled={linkingId === c._id || hasCaregiver}
                        style={{ opacity: hasCaregiver ? 0.6 : 1 }}
                      >
                        {linkingId === c._id ? 'Assigning...' : (hasCaregiver ? 'Limit Reached' : 'Add Caregiver')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
