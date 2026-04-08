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
  });
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

      // Auto redirect to login after successful registration
      router.push('/login');
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
          <h3>Create Account</h3>
          <p className="sub">Set up your SafeDose profile</p>

          <form onSubmit={handleSubmit}>
            <div className="form-row-2">
              <div className="form-grp">
                <label htmlFor="firstName">First Name</label>
                <input id="firstName" name="firstName" type="text"
                  value={form.firstName} onChange={handleChange} required />
              </div>
              <div className="form-grp">
                <label htmlFor="lastName">Last Name</label>
                <input id="lastName" name="lastName" type="text"
                  value={form.lastName} onChange={handleChange} required />
              </div>
            </div>

            <div className="form-grp">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email"
                value={form.email} onChange={handleChange} required />
            </div>

            <div className="form-grp">
              <label htmlFor="password">Password</label>
              <input id="password" name="password" type="password"
                value={form.password} onChange={handleChange} required />
            </div>

            <div className="form-grp">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input id="confirmPassword" name="confirmPassword" type="password"
                value={form.confirmPassword} onChange={handleChange} required />
            </div>

            <div className="form-grp">
              <label htmlFor="role">I am a</label>
              <select id="role" name="role" value={form.role} onChange={handleChange}>
                <option value="patient">Patient</option>
                <option value="caregiver">Caregiver</option>
              </select>
            </div>

            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="btn btn-teal btn-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="auth-switch">
            Already registered? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>

    </div>
  );
}