import Link from 'next/link';
import './globals.css';

export const metadata = {
  title: 'SafeDose',
  description: 'Medication safety dashboard for tracking, adherence, and interaction review',
};

export default function Home() {
  return (
    <div className="page-wrap" id="landing">

      {/* ── Navbar ── */}
      <header className="land-nav">
        <div className="logo">Safe<span>Dose</span></div>
        <div className="land-nav-right">
          <Link className="btn btn-ghost" href="/login">Login</Link>
          <Link className="btn btn-teal"  href="/register">Get Started</Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="land-hero">
        <div>
          <div className="land-tag">FDA-Inspired Safety Checks</div>
          <h1>Your Medications,<br /><em>Safer Together.</em></h1>
          <p>SafeDose helps you manage medications, stay on schedule, and review interaction warnings in one streamlined experience.</p>
          <div className="hero-btns">
            <Link className="btn btn-teal"    href="/register">Create Account</Link>
            <Link className="btn btn-outline" href="/dashboard">Explore Dashboard</Link>
          </div>
        </div>

        {/* Med schedule card */}
        <div className="land-card">
          <div className="land-card-title">Today&apos;s Medication Schedule</div>

          {/* Metformin */}
          <div className="ld-drug">
            <div className="ld-drug-left">
              <div className="ld-drug-icon">
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em">
                  <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <div>
                <div className="ld-drug-name">Metformin</div>
                <div className="ld-drug-dose">500mg · Morning</div>
              </div>
            </div>
            <div className="ld-drug-time">8:00 AM</div>
          </div>

          {/* Lisinopril */}
          <div className="ld-drug">
            <div className="ld-drug-left">
              <div className="ld-drug-icon">
                <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                     strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <div>
                <div className="ld-drug-name">Lisinopril</div>
                <div className="ld-drug-dose">10mg · Afternoon</div>
              </div>
            </div>
            <div className="ld-drug-time">2:00 PM</div>
          </div>

          {/* Alert */}
          <div className="land-alert">
            <div className="land-alert-icon">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div className="land-alert-text">
              <strong>Interaction Alert</strong>
              One active interaction requires review in the Safety Center.
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="land-features">
        {[
          {
            title: 'Interaction Checker',
            desc: 'Instantly detect dangerous drug combinations before they become a problem.',
          },
          {
            title: 'Dose Adherence Tracking',
            desc: 'Stay on schedule with reminders and a full log of taken and missed doses.',
          },
          {
            title: 'FDA-Inspired Safety Checks',
            desc: 'Every medication is screened against FDA guidelines to flag potential risks.',
          },
          {
            title: 'Medication Timeline',
            desc: 'View your full prescription history in a clear, chronological timeline.',
          },
          {
            title: 'Refill Reminders',
            desc: 'Get notified before you run out so you never miss a day of treatment.',
          },
          {
            title: 'Secure Health Records',
            desc: 'Your medication data is encrypted and accessible only to you and your care team.',
          },
        ].map((feat) => (
          <article className="land-feat" key={feat.title}>
            <div className="feat-icon">
              <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24"
                   strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
            <h4>{feat.title}</h4>
            <p>{feat.desc}</p>
          </article>
        ))}
      </section>

      {/* ── CTA ── */}
      <section className="land-cta">
        <h2>Start Managing Medications Safely</h2>
        <p>Sign in or create an account to access your dashboard.</p>
        <Link className="btn btn-teal" href="/register">Get Started</Link>
      </section>

    </div>
  );
}