'use client';

import { useState, useEffect } from 'react';
import './profile.css';

export default function PatientProfile() {
  const [user,      setUser]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Identity fields (User collection)
  const [identityForm, setIdentityForm] = useState({
    firstName: '', lastName: '', email: '',
  });

  // Profile fields (Patient collection)
  const [detailsForm, setDetailsForm] = useState({
    dateOfBirth: '', gender: '', notes: '',
  });

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
          const data = await res.json();
          const u = data.user;
          setUser(u);
          setIdentityForm({
            firstName: u.firstName || '',
            lastName:  u.lastName  || '',
            email:     u.email     || '',
          });
          setDetailsForm({
            dateOfBirth: u.dateOfBirth ? new Date(u.dateOfBirth).toISOString().slice(0, 10) : '',
            gender:      u.gender || '',
            notes:       u.notes  || '',
          });
        }
      } catch (err) {
        console.error('Failed to fetch profile', err);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // 1. Update identity fields (User collection)
      const idRes = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(identityForm),
      });
      if (!idRes.ok) {
        const d = await idRes.json();
        setError(d.error || 'Failed to update profile.');
        return;
      }

      // 2. Update patient-specific details (Patient collection)
      const dtRes = await fetch('/api/user/profile/details', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(detailsForm),
      });
      const dtData = await dtRes.json();
      if (!dtRes.ok) {
        setError(dtData.error || 'Failed to update profile details.');
        return;
      }

      setUser(dtData.user);
      setSuccess('Profile updated successfully.');
      setIsEditing(false);
    } catch {
      setError('An error occurred while updating.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setIsEditing(false);
    setError('');
    setSuccess('');
    if (user) {
      setIdentityForm({ firstName: user.firstName || '', lastName: user.lastName || '', email: user.email || '' });
      setDetailsForm({
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().slice(0, 10) : '',
        gender:      user.gender || '',
        notes:       user.notes  || '',
      });
    }
  }

  if (loading) {
    return <main className="app-main"><p style={{ color: 'var(--gray500)' }}>Loading profile…</p></main>;
  }

  return (
    <>
      <div className="app-topbar">
        <div className="topbar-title">
          <h2>My Profile</h2>
          <p>View and manage your account details</p>
        </div>
      </div>

      <main className="app-main">
        <div className="profile-container">
          <div className="profile-card">

            {/* Avatar + name */}
            <div className="profile-header">
              <div className="profile-avatar">
                {identityForm.firstName ? identityForm.firstName.charAt(0).toUpperCase() : 'P'}
              </div>
              <div className="profile-title">
                <h3>{user?.firstName} {user?.lastName}</h3>
                <p>Patient Account</p>
              </div>
            </div>

            {error   && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}
            {success && <div style={{ color: '#059669', fontSize: 13, marginBottom: 16, background: '#d1fae5', padding: '10px 14px', borderRadius: 8 }}>{success}</div>}

            <form className="profile-form" onSubmit={handleSubmit}>

              {/* ── Account Info (User collection) ── */}
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Account Info</p>
              <div className="form-row-2">
                <div className="form-grp">
                  <label>First Name</label>
                  <input required value={identityForm.firstName}
                    onChange={e => setIdentityForm(p => ({ ...p, firstName: e.target.value }))}
                    disabled={!isEditing} />
                </div>
                <div className="form-grp">
                  <label>Last Name</label>
                  <input required value={identityForm.lastName}
                    onChange={e => setIdentityForm(p => ({ ...p, lastName: e.target.value }))}
                    disabled={!isEditing} />
                </div>
              </div>
              <div className="form-grp">
                <label>Email Address</label>
                <input type="email" required value={identityForm.email}
                  onChange={e => setIdentityForm(p => ({ ...p, email: e.target.value }))}
                  disabled={!isEditing} />
              </div>

              {/* ── Personal Details (Patient collection) ── */}
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray500)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '20px 0 12px' }}>Personal Details</p>
              <div className="form-row-2">
                <div className="form-grp">
                  <label>Date of Birth</label>
                  <input type="date" value={detailsForm.dateOfBirth}
                    onChange={e => setDetailsForm(p => ({ ...p, dateOfBirth: e.target.value }))}
                    disabled={!isEditing} />
                </div>
                <div className="form-grp">
                  <label>Gender</label>
                  <select value={detailsForm.gender}
                    onChange={e => setDetailsForm(p => ({ ...p, gender: e.target.value }))}
                    disabled={!isEditing}>
                    <option value="">Select…</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>
              <div className="form-grp">
                <label>Notes (visible to your caregivers)</label>
                <textarea value={detailsForm.notes} rows={3}
                  onChange={e => setDetailsForm(p => ({ ...p, notes: e.target.value }))}
                  disabled={!isEditing}
                  style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--gray200)', width: '100%', boxSizing: 'border-box' }}
                  placeholder="Allergies, medical history, emergency contact…" />
              </div>

              {/* ── Actions ── */}
              <div className="profile-actions">
                {isEditing ? (
                  <>
                    <button type="button" className="btn"
                      style={{ background: 'var(--gray100)', color: 'var(--gray800)' }}
                      onClick={handleCancel}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-teal" disabled={saving}>
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-edit"
                    onClick={() => { setIsEditing(true); setSuccess(''); }}>
                    <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                         strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                      <path d="M12 20h9"/>
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                    Edit Profile
                  </button>
                )}
              </div>
            </form>

          </div>
        </div>
      </main>
    </>
  );
}
