// app/admin/layout.js

'use client';
import '../app.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { AuthProvider } from '../context/AuthContext';
import ChatFab from '../components/ChatFab';

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch('/api/admin/stats', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.pendingCaregivers) setPendingCount(data.pendingCaregivers); })
      .catch(() => {});
  }, [pathname]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <AuthProvider>
    <div className="app-layout">

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sb-logo">
          <div className="logo">Safe<span>Dose</span></div>
        </div>

        <div className="sb-user">
          <div className="sb-avatar" style={{ background: '#7c3aed' }}>A</div>
          <div>
            <p className="sb-user-name">Administrator</p>
            <p className="sb-user-role">admin</p>
          </div>
        </div>

        <nav className="sb-nav">
          <p className="sb-section-lbl">Admin</p>

          {/* Pending Approvals */}
          <Link
            href="/admin/pending"
            className={`sb-link${pathname === '/admin/pending' ? ' active' : ''}`}
            style={{ justifyContent: 'space-between' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="sb-icon">
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </span>
              Pending Approvals
            </span>
            {pendingCount > 0 && (
              <span style={{
                background: '#f59e0b',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 10,
                padding: '1px 6px',
                minWidth: 18,
                textAlign: 'center',
              }}>
                {pendingCount}
              </span>
            )}
          </Link>

          {/* Patients */}
          <Link
            href="/admin/patients"
            className={`sb-link${pathname === '/admin/patients' ? ' active' : ''}`}
          >
            <span className="sb-icon">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </span>
            Patients
          </Link>

          {/* Caregivers */}
          <Link
            href="/admin/caregivers"
            className={`sb-link${pathname === '/admin/caregivers' ? ' active' : ''}`}
          >
            <span className="sb-icon">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </span>
            Caregivers
          </Link>
        </nav>

        <div className="sb-bottom">
          <button
            className="sb-link"
            style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={handleLogout}
          >
            <span className="sb-icon">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </span>
            Logout
          </button>
        </div>
      </aside>

      <div className="app-content">
        {children}
      </div>

    </div>
    <ChatFab />
    </AuthProvider>
  );
}
