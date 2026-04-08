'use client';
// app/components/NotificationBell.js

import { useState, useEffect, useRef, useCallback } from 'react';

export default function NotificationBell() {
  const [open,    setOpen]    = useState(false);
  const [prefs,   setPrefs]   = useState({ email: false, desktop: false });
  const [saving,  setSaving]  = useState(false);
  const dropRef = useRef(null);

  // ── Load preferences on mount ─────────────────────────────
  useEffect(() => {
    fetch('/api/user/profile', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user?.notifications) {
          setPrefs(data.user.notifications);
        }
      })
      .catch(() => {});
  }, []);

  // ── Close dropdown on outside click ──────────────────────
  useEffect(() => {
    function handler(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Desktop notification checker (fires every 60 s) ──────
  const checkDosesDue = useCallback(() => {
    if (!prefs.desktop) return;
    if (typeof window === 'undefined' || Notification.permission !== 'granted') return;

    fetch('/api/patient/medications/today', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const meds = data?.medications || [];
        const now  = new Date();

        meds.forEach(med => {
          const times = med.scheduleTimes || (med.scheduleTime ? [med.scheduleTime] : []);
          times.forEach((timeStr, i) => {
            if (med.takenToday?.[i]) return;
            const scheduled = parseTime12(timeStr);
            if (!scheduled) return;
            const diff = scheduled.getTime() - now.getTime();
            // Fire for doses due within the next 5 minutes or already due
            if (diff <= 5 * 60 * 1000 && diff > -30 * 60 * 1000) {
              new Notification('SafeDose — Dose Reminder', {
                body: `Time to take ${med.name} (${med.dosage}) — Dose ${i + 1} at ${timeStr}`,
                icon: '/favicon.ico',
              });
            }
          });
        });
      })
      .catch(() => {});
  }, [prefs.desktop]);

  useEffect(() => {
    if (!prefs.desktop) return;
    checkDosesDue();
    const id = setInterval(checkDosesDue, 60_000);
    return () => clearInterval(id);
  }, [prefs.desktop, checkDosesDue]);

  // ── Toggle handler ────────────────────────────────────────
  async function handleToggle(key) {
    const newPrefs = { ...prefs, [key]: !prefs[key] };

    if (key === 'desktop' && newPrefs.desktop) {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        newPrefs.desktop = false;
        alert('Desktop notifications were blocked by your browser. Please allow them in your browser settings.');
      }
    }

    setPrefs(newPrefs);
    setSaving(true);
    try {
      await fetch('/api/user/notifications', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:    JSON.stringify(newPrefs),
      });
    } catch {}
    setSaving(false);
  }

  const hasAny = prefs.email || prefs.desktop;

  return (
    <div style={{ position: 'relative' }} ref={dropRef}>
      <button
        className="notif-btn"
        onClick={() => setOpen(o => !o)}
        title="Notification settings"
        style={{ color: hasAny ? 'var(--teal)' : 'var(--gray600)' }}
      >
        {/* Bell icon */}
        <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
             strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {hasAny && (
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--teal)', border: '1.5px solid #fff',
          }} />
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span>Notifications</span>
            {saving && <span style={{ fontSize: 11, color: 'var(--gray400)' }}>Saving…</span>}
          </div>

          <label className="notif-row">
            <div className="notif-row-info">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <div>
                <p className="notif-row-title">Email notifications</p>
                <p className="notif-row-sub">Daily missed-dose summary</p>
              </div>
            </div>
            <div className={`notif-toggle${prefs.email ? ' on' : ''}`}
                 onClick={() => handleToggle('email')}>
              <div className="notif-toggle-thumb" />
            </div>
          </label>

          <label className="notif-row">
            <div className="notif-row-info">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              <div>
                <p className="notif-row-title">Desktop notifications</p>
                <p className="notif-row-sub">Dose reminders while browsing</p>
              </div>
            </div>
            <div className={`notif-toggle${prefs.desktop ? ' on' : ''}`}
                 onClick={() => handleToggle('desktop')}>
              <div className="notif-toggle-thumb" />
            </div>
          </label>
        </div>
      )}
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────
function parseTime12(timeStr) {
  if (!timeStr) return null;
  const [t, period] = timeStr.split(' ');
  let [h, m] = t.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h  = 0;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}
