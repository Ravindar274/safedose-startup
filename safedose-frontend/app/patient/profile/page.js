'use client';

import { useState, useEffect } from 'react';
import './profile.css';

export default function PatientProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });

  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setForm({
            firstName: data.user.firstName || '',
            lastName: data.user.lastName || '',
            email: data.user.email || '',
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
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to update profile.');
        return;
      }
      
      setUser(data.user);
      setSuccess('Profile updated successfully.');
      setIsEditing(false);
    } catch (err) {
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
      setForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
      });
    }
  }

  if (loading) {
    return (
      <main className="app-main">
        <p style={{ color: 'var(--gray500)' }}>Loading profile...</p>
      </main>
    );
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
            <div className="profile-header">
              <div className="profile-avatar">
                {form.firstName ? form.firstName.charAt(0).toUpperCase() : 'P'}
              </div>
              <div className="profile-title">
                <h3>{user?.firstName} {user?.lastName}</h3>
                <p>{user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)} Account</p>
              </div>
            </div>

            {error && <div className="form-error" style={{ marginBottom: 16 }}>{error}</div>}
            {success && <div style={{ color: '#059669', fontSize: 13, marginBottom: 16, background: '#d1fae5', padding: '10px 14px', borderRadius: 8 }}>{success}</div>}

            <form className="profile-form" onSubmit={handleSubmit}>
              <div className="form-row-2">
                <div className="form-grp">
                  <label>First Name</label>
                  <input 
                    required 
                    value={form.firstName} 
                    onChange={e => setForm({...form, firstName: e.target.value})} 
                    disabled={!isEditing}
                  />
                </div>
                <div className="form-grp">
                  <label>Last Name</label>
                  <input 
                    required 
                    value={form.lastName} 
                    onChange={e => setForm({...form, lastName: e.target.value})} 
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-grp" style={{ gridColumn: '1 / -1' }}>
                  <label>Email Address</label>
                  <input 
                    type="email"
                    required 
                    value={form.email} 
                    onChange={e => setForm({...form, email: e.target.value})} 
                    disabled={!isEditing}
                  />
                </div>
              </div>

              <div className="profile-actions">
                {isEditing ? (
                  <>
                    <button type="button" className="btn" style={{ background: 'var(--gray100)', color: 'var(--gray800)' }} onClick={handleCancel}>Cancel</button>
                    <button type="submit" className="btn btn-teal" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-edit" onClick={() => { setIsEditing(true); setSuccess(''); }}>
                    <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                      <path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
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
