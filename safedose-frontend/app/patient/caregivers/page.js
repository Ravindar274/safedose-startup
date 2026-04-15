// app/patient/caregivers/page.js

'use client';
import '../patient-dashboard.css';
import { useState, useEffect } from 'react';

// ── Caregiver detail panel ─────────────────────────────────────
function CaregiverDetailPanel({ cg, status, onClose, onRequest, onCancel, onRemove, sending, cancelling, removing }) {
  const profile = cg.caregiverProfile || {};
  const memberSince = cg.createdAt
    ? new Date(cg.createdAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'long' })
    : null;

  const Field = ({ label, value, full }) => value ? (
    <div style={{ gridColumn: full ? '1 / -1' : undefined, marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray400)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--gray800)', lineHeight: 1.45 }}>{value}</div>
    </div>
  ) : null;

  const SectionLabel = ({ children }) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray400)', textTransform: 'uppercase', letterSpacing: '0.06em', gridColumn: '1 / -1', marginBottom: 4, paddingBottom: 6, borderBottom: '1px solid var(--gray200)' }}>
      {children}
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: '20px 0' }}
         onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', width: '100%', maxWidth: 520, padding: 28, position: 'relative', margin: 'auto' }}
           onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--teal-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'var(--teal)', flexShrink: 0 }}>
            {cg.firstName?.[0]}{cg.lastName?.[0]}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--gray900)', marginBottom: 2 }}>{cg.firstName} {cg.lastName}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', marginTop: 4 }}>
              {profile.qualification && <span style={{ fontSize: 11, fontWeight: 600, background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 6 }}>{profile.qualification}</span>}
              {profile.specialization && <span style={{ fontSize: 11, fontWeight: 600, background: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: 6 }}>{profile.specialization}</span>}
              {profile.availability && <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--gray100)', color: 'var(--gray600)', padding: '2px 8px', borderRadius: 6 }}>{profile.availability}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray400)', padding: 4, flexShrink: 0 }}>
            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div style={{ background: 'var(--gray50)', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <SectionLabel>Professional</SectionLabel>
            <Field label="Experience" value={profile.experienceYears != null ? `${profile.experienceYears} year${profile.experienceYears !== 1 ? 's' : ''}` : null} />
            <Field label="Specialization" value={profile.specialization} />
            <Field label="Languages Spoken" value={profile.languagesSpoken} full />
            <Field label="License ID" value={profile.licenseId} />
            <Field label="Availability" value={profile.availability} />
          </div>
        </div>

        <div style={{ background: 'var(--gray50)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <SectionLabel>Contact &amp; Info</SectionLabel>
            <Field label="Email" value={cg.email} full />
            <Field label="Gender" value={profile.gender} />
            <Field label="Member since" value={memberSince} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {status === 'accepted' ? (
            <>
              <span style={{ flex: 1, textAlign: 'center', padding: '10px', fontSize: 13, fontWeight: 600, color: '#0d9488', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                Your caregiver
              </span>
              <button className="btn" style={{ flex: 1, fontSize: 13, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }} onClick={onRemove} disabled={removing}>
                {removing ? 'Removing…' : 'Remove Caregiver'}
              </button>
            </>
          ) : status === 'pending' ? (
            <>
              <span style={{ flex: 1, textAlign: 'center', padding: '10px', fontSize: 13, fontWeight: 600, color: '#92400e', background: '#fef3c7', borderRadius: 8, border: '1px solid #fde68a' }}>
                Request pending
              </span>
              <button className="btn" style={{ flex: 1, fontSize: 13, background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }} onClick={onCancel} disabled={cancelling}>
                {cancelling ? 'Cancelling…' : 'Cancel Request'}
              </button>
            </>
          ) : (
            <>
              <button className="btn" style={{ flex: 1, background: 'var(--gray100)', color: 'var(--gray700)', fontSize: 13 }} onClick={onClose}>Close</button>
              <button className="btn btn-teal" style={{ flex: 1, fontSize: 13 }} onClick={onRequest} disabled={sending}>
                {sending ? 'Sending…' : status === 'declined' ? 'Re-request' : 'Send Request'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PatientCaregiversPage() {
  const [caregivers,   setCaregivers]   = useState([]);
  const [invites,      setInvites]      = useState([]);   // caregiver-initiated pending invites
  const [myRequests,   setMyRequests]   = useState([]);   // patient-initiated requests
  const [loading,      setLoading]      = useState(true);
  const [respondingId, setRespondingId] = useState(null); // invite being accepted/declined
  const [sending,      setSending]      = useState(null);
  const [cancelling,   setCancelling]   = useState(null);
  const [removing,     setRemoving]     = useState(null);
  const [error,        setError]        = useState('');
  const [successMsg,   setSuccessMsg]   = useState('');
  const [detailCg,     setDetailCg]     = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [cgRes, reqRes, invRes] = await Promise.all([
          fetch('/api/patient/caregivers',        { credentials: 'include' }),
          fetch('/api/patient/caregiver-requests', { credentials: 'include' }),
          fetch('/api/patient/caregiver-invites',  { credentials: 'include' }),
        ]);
        const cgData  = await cgRes.json();
        const reqData = await reqRes.json();
        const invData = await invRes.json();
        setCaregivers(cgData.caregivers || []);
        setMyRequests(reqData.requests  || []);
        setInvites(invData.invites       || []);
      } catch {
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function getStatus(cg) {
    // isAssigned covers both patient-initiated and caregiver-initiated accepted invites
    if (cg.isAssigned) return 'accepted';
    const req = myRequests.find(r => (r.caregiverId?._id ?? r.caregiverId) === cg._id);
    return req ? req.status : null;
  }

  async function handleRequest(caregiverId) {
    setSending(caregiverId);
    setError(''); setSuccessMsg('');
    try {
      const res  = await fetch(`/api/patient/caregivers/${caregiverId}/request`, { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to send request.'); return; }
      setMyRequests(prev => {
        const idx = prev.findIndex(r => (r.caregiverId?._id ?? r.caregiverId) === caregiverId);
        const newReq = { ...data.request, caregiverId: { _id: caregiverId } };
        return idx >= 0 ? prev.map((r, i) => i === idx ? newReq : r) : [newReq, ...prev];
      });
      setSuccessMsg('Request sent! The caregiver will receive an email invitation.');
      setDetailCg(null);
    } catch { setError('Something went wrong.'); }
    finally { setSending(null); }
  }

  async function handleCancel(caregiverId) {
    setCancelling(caregiverId);
    setError('');
    try {
      const res = await fetch(`/api/patient/caregivers/${caregiverId}/request`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to cancel.'); return; }
      setMyRequests(prev => prev.filter(r => (r.caregiverId?._id ?? r.caregiverId) !== caregiverId));
      setSuccessMsg('Request cancelled.');
      setDetailCg(null);
    } catch { setError('Something went wrong.'); }
    finally { setCancelling(null); }
  }

  async function handleRemove(caregiverId) {
    setRemoving(caregiverId);
    setError('');
    try {
      const res = await fetch(`/api/patient/caregivers/${caregiverId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to remove.'); return; }
      setMyRequests(prev => prev.filter(r => (r.caregiverId?._id ?? r.caregiverId) !== caregiverId));
      // Mark as unassigned in the caregivers list
      setCaregivers(prev => prev.map(c => c._id === caregiverId ? { ...c, isAssigned: false } : c));
      setSuccessMsg('Caregiver removed.');
      setDetailCg(null);
    } catch { setError('Something went wrong.'); }
    finally { setRemoving(null); }
  }

  async function handleInviteRespond(inviteId, action) {
    setRespondingId(inviteId);
    setError('');
    try {
      const res = await fetch(`/api/patient/caregiver-invites/${inviteId}/${action}`, { method: 'PATCH', credentials: 'include' });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed.'); return; }
      const inv = invites.find(i => i._id === inviteId);
      setInvites(prev => prev.filter(i => i._id !== inviteId));
      if (action === 'accept' && inv?.caregiverId?._id) {
        setCaregivers(prev => prev.map(c => c._id === inv.caregiverId._id ? { ...c, isAssigned: true } : c));
      }
      setSuccessMsg(action === 'accept' ? 'Caregiver added to your care team!' : 'Invitation declined.');
    } catch { setError('Something went wrong.'); }
    finally { setRespondingId(null); }
  }

  return (
    <>
      <div className="app-topbar">
        <div className="topbar-title">
          <h2>Caregivers</h2>
          <p>Manage your care team and find new caregivers</p>
        </div>
      </div>

      <main className="app-main">

        {error && (
          <div style={{ padding: '10px 14px', marginBottom: 16, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#dc2626' }}>
            {error}
          </div>
        )}
        {successMsg && (
          <div style={{ padding: '10px 14px', marginBottom: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 13, color: '#065f46', display: 'flex', justifyContent: 'space-between' }}>
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>✕</button>
          </div>
        )}

        {/* ── Pending Invites from Caregivers ── */}
        {invites.length > 0 && (
          <div className="card-box" style={{ marginBottom: 24 }}>
            <div className="section-hdr">
              <h3>
                Caregiver Invitations
                <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#f59e0b', color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: 11, fontWeight: 700 }}>
                  {invites.length}
                </span>
              </h3>
            </div>
            <p style={{ fontSize: 13, color: 'var(--gray500)', margin: '0 0 14px' }}>
              These caregivers have invited you to join their care team.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {invites.map(inv => {
                const cg = inv.caregiverId || {};
                const profile = cg.caregiverProfile || {};
                const isResponding = respondingId === inv._id;
                return (
                  <div key={inv._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', background: 'var(--gray50)', borderRadius: 10, border: '1px solid var(--gray200)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                      <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--teal-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--teal)', flexShrink: 0 }}>
                        {cg.firstName?.[0]}{cg.lastName?.[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--gray900)' }}>
                          {cg.firstName} {cg.lastName}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--gray500)', marginTop: 2 }}>
                          {profile.specialization && `${profile.specialization} · `}
                          {profile.experienceYears != null && `${profile.experienceYears} yrs exp`}
                          {profile.qualification && ` · ${profile.qualification}`}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        className="btn btn-teal"
                        style={{ fontSize: 12, padding: '7px 16px' }}
                        disabled={isResponding}
                        onClick={() => handleInviteRespond(inv._id, 'accept')}
                      >
                        {isResponding ? '…' : 'Accept'}
                      </button>
                      <button
                        style={{ fontSize: 12, padding: '7px 16px', background: 'var(--gray100)', border: '1px solid var(--gray300)', borderRadius: 8, cursor: 'pointer', fontWeight: 500, color: 'var(--gray700)' }}
                        disabled={isResponding}
                        onClick={() => handleInviteRespond(inv._id, 'decline')}
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

        {/* ── Available Caregivers ── */}
        <div className="card-box">
          <div className="section-hdr">
            <h3>Find a Caregiver</h3>
          </div>
          <p style={{ fontSize: 13, color: 'var(--gray500)', margin: '0 0 16px' }}>
            Browse approved caregivers and click a card to view details or send a request.
          </p>

          {loading ? (
            <p style={{ fontSize: 13, color: 'var(--gray400)', padding: '20px 0' }}>Loading caregivers…</p>
          ) : caregivers.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--gray400)', padding: '20px 0' }}>No approved caregivers available right now.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
              {caregivers.map(cg => {
                const profile = cg.caregiverProfile || {};
                const status  = getStatus(cg);
                return (
                  <div
                    key={cg._id}
                    onClick={() => setDetailCg(cg)}
                    style={{ padding: '16px 14px', borderRadius: 12, border: `1.5px solid ${status === 'accepted' ? '#bbf7d0' : status === 'pending' ? '#fde68a' : 'var(--gray200)'}`, background: status === 'accepted' ? '#f0fdf4' : '#fff', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.1)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--teal-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 700, color: 'var(--teal)', marginBottom: 10 }}>
                      {cg.firstName?.[0]}{cg.lastName?.[0]}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--gray900)', marginBottom: 2 }}>{cg.firstName} {cg.lastName}</div>
                    {profile.specialization && <div style={{ fontSize: 12, color: 'var(--gray500)', marginBottom: 6 }}>{profile.specialization}</div>}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {profile.experienceYears != null && <span style={{ fontSize: 11, background: 'var(--gray100)', color: 'var(--gray600)', padding: '2px 7px', borderRadius: 5 }}>{profile.experienceYears} yrs exp.</span>}
                      {profile.qualification   && <span style={{ fontSize: 11, background: 'var(--gray100)', color: 'var(--gray600)', padding: '2px 7px', borderRadius: 5 }}>{profile.qualification}</span>}
                      {profile.availability    && <span style={{ fontSize: 11, background: 'var(--gray100)', color: 'var(--gray600)', padding: '2px 7px', borderRadius: 5 }}>{profile.availability}</span>}
                    </div>
                    {status === 'accepted' && (
                      <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: '#0d9488' }}>Your caregiver</div>
                    )}
                    {status === 'pending' && (
                      <div style={{ marginTop: 8, fontSize: 11, fontWeight: 600, color: '#92400e' }}>Request pending</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>

      {detailCg && (
        <CaregiverDetailPanel
          cg={detailCg}
          status={getStatus(detailCg)}
          onClose={() => setDetailCg(null)}
          onRequest={() => handleRequest(detailCg._id)}
          onCancel={() => handleCancel(detailCg._id)}
          onRemove={() => handleRemove(detailCg._id)}
          sending={sending === detailCg._id}
          cancelling={cancelling === detailCg._id}
          removing={removing === detailCg._id}
        />
      )}
    </>
  );
}
