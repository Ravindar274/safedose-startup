// app/patient/layout.js

'use client';
import '../app.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '../context/AuthContext';
import ChatFab from '../components/ChatFab';

const navItems = [
  {
    href: '/patient/dashboard',
    label: 'Dashboard',
    icon: (
      <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
           strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    href: '/patient/medications',
    label: 'My Medications',
    icon: (
      <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
           strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
        <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
  },
  {
    href: '/patient/adherence',
    label: 'Adherence',
    icon: (
      <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
           strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    href: '/patient/schedule',
    label: 'Schedule',
    icon: (
      <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
           strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: '/patient/interactions',
    label: 'Safety Center',
    icon: (
      <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
           strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
  },
  {
    href: '/patient/profile',
    label: 'Profile',
    icon: (
      <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
           strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

export default function PatientLayout({ children }) {
  const pathname = usePathname();

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
          <div className="sb-avatar">P</div>
          <div>
            <p className="sb-user-name">My Account</p>
            <p className="sb-user-role">patient</p>
          </div>
        </div>

        <nav className="sb-nav">
          <p className="sb-section-lbl">Patient</p>
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`sb-link${pathname === item.href ? ' active' : ''}`}
            >
              <span className="sb-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
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
