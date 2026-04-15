// app/caregiver/requests/page.js

'use client';

import { useState, useEffect } from 'react';
import '../caregiver-dashboard.css';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function PatientCard({ request, onAccept, onDecline, acting }) {
  const p = request.patientUserId || {};
  const initials = `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase() || 'P';

  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--gray200)',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 16,
    }}>
      {/* Avatar */}
      <div style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: 'var(--teal100, #ccfbf1)',
        color: 'var(--teal700, #0f766e)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 16,
        flexShrink: 0,
      }}>
        {initials}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--gray900)' }}>
            {p.firstName} {p.lastName}
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 500,
            background: '#fef3c7',
            color: '#92400e',
            padding: '2px 8px',
            borderRadius: 20,
          }}>Pending</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px 20px', marginTop: 8 }}>
          <div>
            <span style={{ fontSize: 11, color: 'var(--gray500)', fontWeight: 500 }}>Email</span>
            <p style={{ fontSize: 13, color: 'var(--gray800)', margin: '2px 0 0' }}>{p.email || '—'}</p>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'var(--gray500)', fontWeight: 500 }}>Date of Birth</span>
            <p style={{ fontSize: 13, color: 'var(--gray800)', margin: '2px 0 0' }}>
              {p.dateOfBirth ? formatDate(p.dateOfBirth) : '—'}
            </p>
          </div>
          <div>
            <span style={{ fontSize: 11, color: 'var(--gray500)', fontWeight: 500 }}>Requested On</span>
            <p style={{ fontSize: 13, color: 'var(--gray800)', margin: '2px 0 0' }}>{formatDate(request.createdAt)}</p>
          </div>
        </div>

        {request.message && (
          <div style={{
            marginTop: 10,
            padding: '8px 12px',
            background: 'var(--gray50)',
            borderRadius: 8,
            borderLeft: '3px solid var(--gray200)',
          }}>
            <span style={{ fontSize: 11, color: 'var(--gray500)', fontWeight: 500 }}>Message</span>
            <p style={{ fontSize: 13, color: 'var(--gray700)', margin: '2px 0 0' }}>{request.message}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => onAccept(request._id)}
          disabled={acting === request._id}
          style={{
            padding: '8px 18px',
            background: 'var(--teal600, #0d9488)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 13,
            cursor: acting === request._id ? 'not-allowed' : 'pointer',
            opacity: acting === request._id ? 0.7 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {acting === request._id ? 'Accepting…' : 'Accept'}
        </button>
        <button
          onClick={() => onDecline(request._id)}
          disabled={acting === request._id}
          style={{
            padding: '8px 18px',
            background: '#fff',
            color: 'var(--gray700)',
            border: '1px solid var(--gray200)',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 13,
            cursor: acting === request._id ? 'not-allowed' : 'pointer',
            opacity: acting === request._id ? 0.7 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          Decline
        </button>
      </div>
    </div>
  );
}

export default function CaregiverRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [acting,   setActing]   = useState(null); // request._id currently being acted on

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    setLoading(true);
    try {
      const res  = await fetch('/api/caregiver/requests');
      const data = await res.json();
      if (res.ok) setRequests(data.requests || []);
      else setError(data.error || 'Failed to load requests.');
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(id) {
    setActing(id);
    setError('');
    try {
      const res  = await fetch(`/api/caregiver/requests/${id}/accept`, { method: 'PATCH' });
      const data = await res.json();
      if (res.ok) {
        setRequests(prev => prev.filter(r => r._id !== id));
      } else {
        setError(data.error || 'Failed to accept request.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setActing(null);
    }
  }

  async function handleDecline(id) {
    setActing(id);
    setError('');
    try {
      const res  = await fetch(`/api/caregiver/requests/${id}/decline`, { method: 'PATCH' });
      const data = await res.json();
      if (res.ok) {
        setRequests(prev => prev.filter(r => r._id !== id));
      } else {
        setError(data.error || 'Failed to decline request.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setActing(null);
    }
  }

  return (
    <>
      <div className="app-topbar">
        <div className="topbar-title">
          <h2>Patient Requests</h2>
          <p>Review and respond to incoming hire requests from patients</p>
        </div>
      </div>

      <main className="app-main">
        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#991b1b',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--gray500)', fontSize: 14 }}>Loading requests…</p>
        ) : requests.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            color: 'var(--gray400)',
            gap: 12,
          }}>
            <svg stroke="currentColor" fill="none" strokeWidth="1.5" viewBox="0 0 24 24"
                 strokeLinecap="round" strokeLinejoin="round" width="40" height="40">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p style={{ fontWeight: 500, fontSize: 15, color: 'var(--gray600)' }}>No pending requests</p>
            <p style={{ fontSize: 13 }}>When patients send you hire requests, they will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--gray500)', margin: '0 0 4px' }}>
              {requests.length} pending {requests.length === 1 ? 'request' : 'requests'}
            </p>
            {requests.map(req => (
              <PatientCard
                key={req._id}
                request={req}
                onAccept={handleAccept}
                onDecline={handleDecline}
                acting={acting}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
