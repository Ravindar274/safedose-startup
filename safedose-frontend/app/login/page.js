// app/login/page.js

'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed.');
        return;
      }

      // Redirect based on role
      const roleHome = {
        admin:     '/admin/requests',
        patient:   '/patient/dashboard',
        caregiver: '/caregiver/dashboard',
      };
      router.push(roleHome[data.role] || '/');
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

          <h2>Welcome back.</h2>
          <p>Sign in to review your medications, interactions, and adherence dashboard.</p>

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
              Track your medications safely
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
              Get interaction alerts instantly
            </div>

            <div className="trust-item">
              <div className="trust-icon">
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6"  y1="20" x2="6"  y2="14"/>
                </svg>
              </div>
              Personalized dashboard
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="auth-right">
        <div className="auth-form">
          <h3>Sign In</h3>
          <p className="sub">Access your medication dashboard</p>

          <form onSubmit={handleSubmit}>
            <div className="form-grp">
              <label htmlFor="email">Email <span style={{ color: 'red' }}>*</span></label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-grp">
              <label htmlFor="password">Password <span style={{ color: 'red' }}>*</span></label>
              <input
                id="password"
                type="password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="btn btn-teal btn-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="auth-switch">
            No account yet? <Link href="/register">Register</Link>
          </p>
        </div>
      </div>

    </div>
  );
}