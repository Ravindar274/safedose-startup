// app/admin/layout.js

'use client';
import '../app.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthProvider } from '../context/AuthContext';
import ChatFab from '../components/ChatFab';

const navItems = [
  {
    href: '/admin/dashboard',
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
];

export default function AdminLayout({ children }) {
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
          <div className="sb-avatar" style={{ background: '#7c3aed' }}>A</div>
          <div>
            <p className="sb-user-name">Administrator</p>
            <p className="sb-user-role">admin</p>
          </div>
        </div>

        <nav className="sb-nav">
          <p className="sb-section-lbl">Admin</p>
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
