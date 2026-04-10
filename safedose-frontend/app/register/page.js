// app/register/page.js

'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '',
    password: '', confirmPassword: '', role: 'patient',
    dateOfBirth: '', gender: 'Male',
    qualification: '', experienceYears: '', specialization: '', availability: 'full-time', licenseId: '', languagesSpoken: ''
  });
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed.');
        return;
      }

      if (form.role === 'caregiver') {
        setSuccessMsg('Your caregiver registration is complete! Your account is currently pending approval by an administrator. You will be able to log in once it is approved.');
      } else {
        // Auto redirect to login after successful registration for patients
        router.push('/login');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrapper">

      {/* ── Left panel ── */}
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="logo">Safe<span>Dose</span></div>

          <h2>Take control of medication safety.</h2>
          <p>Create an account to manage adherence tracking and safety monitoring across all pages.</p>

          <div className="auth-trust">
            <div className="trust-item">
              <div className="trust-icon">
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              Add medications quickly
            </div>

            <div className="trust-item">
              <div className="trust-icon">
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              Review interaction alerts
            </div>

            <div className="trust-item">
              <div className="trust-icon">
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <polyline points="9 11 12 14 22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
              </div>
              Track daily adherence
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="auth-right">
        <div className="auth-form">
          {successMsg ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" width="48" height="48" style={{ color: 'var(--teal)', margin: '0 auto 16px' }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <h3 style={{ marginBottom: 12 }}>Application Submitted</h3>
              <p style={{ color: 'var(--gray600)', lineHeight: 1.5, marginBottom: 28 }}>{successMsg}</p>
              <Link href="/login" className="btn btn-teal btn-full" style={{ display: 'block', textAlign: 'center' }}>
                Return to Login
              </Link>
            </div>
          ) : (
            <>
              <h3>Create Account</h3>
              <p className="sub">Set up your SafeDose profile</p>

              <form onSubmit={handleSubmit}>
            <div className="form-row-2">
              <div className="form-grp">
                <label htmlFor="firstName">First Name <span style={{ color: 'red' }}>*</span></label>
                <input id="firstName" name="firstName" type="text"
                  value={form.firstName} onChange={handleChange} required />
              </div>
              <div className="form-grp">
                <label htmlFor="lastName">Last Name <span style={{ color: 'red' }}>*</span></label>
                <input id="lastName" name="lastName" type="text"
                  value={form.lastName} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-grp">
              <label htmlFor="email">Email <span style={{ color: 'red' }}>*</span></label>
              <input id="email" name="email" type="email"
                value={form.email} onChange={handleChange} required />
            </div>

            <div className="form-grp">
              <label htmlFor="password">Password <span style={{ color: 'red' }}>*</span></label>
              <input id="password" name="password" type="password"
                value={form.password} onChange={handleChange} required />
            </div>

            <div className="form-grp">
              <label htmlFor="confirmPassword">Confirm Password <span style={{ color: 'red' }}>*</span></label>
              <input id="confirmPassword" name="confirmPassword" type="password"
                value={form.confirmPassword} onChange={handleChange} required />
            </div>

            <div className="form-row-2">
              <div className="form-grp">
                <label htmlFor="dateOfBirth">Date of Birth <span style={{ color: 'red' }}>*</span></label>
                <input id="dateOfBirth" name="dateOfBirth" type="date" max={new Date().toISOString().split('T')[0]}
                  value={form.dateOfBirth} onChange={handleChange} required />
              </div>
              <div className="form-grp">
                <label htmlFor="gender">Gender <span style={{ color: 'red' }}>*</span></label>
                <select id="gender" name="gender" value={form.gender} onChange={handleChange}>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div className="form-grp">
              <label htmlFor="role">I am a <span style={{ color: 'red' }}>*</span></label>
              <select id="role" name="role" value={form.role} onChange={handleChange}>
                <option value="patient">Patient</option>
                <option value="caregiver">Caregiver</option>
              </select>
            </div>

            {form.role === 'caregiver' && (
              <>
                <div className="form-grp">
                  <label htmlFor="qualification">Qualification / Certification <span style={{ color: 'red' }}>*</span></label>
                  <input id="qualification" name="qualification" type="text"
                    value={form.qualification} onChange={handleChange} required />
                </div>
                
                <div className="form-grp">
                  <label htmlFor="experienceYears">Experience (years) <span style={{ color: 'red' }}>*</span></label>
                  <input id="experienceYears" name="experienceYears" type="number" min="0"
                    value={form.experienceYears} onChange={handleChange} required />
                </div>

                <div className="form-grp">
                  <label htmlFor="specialization">Specialization (e.g. elder care) <span style={{ color: 'red' }}>*</span></label>
                  <input id="specialization" name="specialization" type="text"
                    value={form.specialization} onChange={handleChange} required />
                </div>

                <div className="form-grp">
                  <label htmlFor="availability">Availability <span style={{ color: 'red' }}>*</span></label>
                  <select id="availability" name="availability" value={form.availability} onChange={handleChange}>
                    <option value="full-time">Full-Time</option>
                    <option value="part-time">Part-Time</option>
                    <option value="schedule">Schedule</option>
                  </select>
                </div>

                <div className="form-grp">
                  <label htmlFor="licenseId">License ID <span style={{ color: 'red' }}>*</span></label>
                  <input id="licenseId" name="licenseId" type="text"
                    value={form.licenseId} onChange={handleChange} required />
                </div>

                <div className="form-grp">
                  <label htmlFor="languagesSpoken">Languages Spoken <span style={{ color: 'red' }}>*</span></label>
                  <input id="languagesSpoken" name="languagesSpoken" type="text"
                    placeholder="English, Spanish..."
                    value={form.languagesSpoken} onChange={handleChange} required />
                </div>
              </>
            )}

            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="btn btn-teal btn-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="auth-switch">
            Already registered? <Link href="/login">Sign in</Link>
          </p>
            </>
          )}
        </div>
      </div>

    </div>
  );
}