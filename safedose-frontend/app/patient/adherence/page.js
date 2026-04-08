'use client';

import '../../adherence.css';
import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

const RANGE_OPTIONS = [14, 30, 60];

function formatShortDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
  });
}

function StatCard({ label, value, sub }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  );
}

function ChartEmpty({ message }) {
  return <div className="empty-chart">{message}</div>;
}

export default function PatientAdherencePage() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchAdherence() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/patient/adherence?days=${days}`);
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || 'Failed to load adherence data.');
          return;
        }
        setData(json);
      } catch {
        setError('Could not load adherence data.');
      } finally {
        setLoading(false);
      }
    }

    fetchAdherence();
  }, [days]);

  const stats = data?.stats || {};
  const series = data?.series || [];
  const medicationMisses = data?.medicationMisses || [];

  const headline = useMemo(() => {
    if (!series.length) return 'No adherence history yet';
    const last = series[series.length - 1];
    return `${last.adherencePct}% on ${formatShortDate(last.date)}`;
  }, [series]);

  return (
    <>
      <div className="app-topbar">
        <div className="topbar-title">
          <h2>Adherence</h2>
          <p>Review your medication follow-through over time</p>
        </div>
      </div>

      <main className="app-main">
        <div className="adherence-shell">
          <div className="adherence-toolbar">
            <div>
              <div className="adherence-inline-meta">
                <span className="adherence-badge">Historical snapshots</span>
                <span className="adherence-toolbar-note">Data is captured nightly, so charts currently run through yesterday.</span>
              </div>
            </div>
            <div className="range-group">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`range-chip${days === option ? ' active' : ''}`}
                  onClick={() => setDays(option)}
                >
                  {option}d
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="adherence-loading">Loading adherence trends…</div>
          ) : error ? (
            <p className="form-error">{error}</p>
          ) : (
            <>
              <div className="metric-grid-wide">
                <StatCard label="Overall adherence" value={`${stats.overallAdherence || 0}%`} sub={`Across the last ${data?.rangeDays || days} days`} />
                <StatCard label="Average day" value={`${stats.averageAdherence || 0}%`} sub={headline} />
                <StatCard label="Missed doses" value={stats.totalMissed || 0} sub="Uncompleted scheduled doses" />
                <StatCard label="Tracked days" value={stats.trackedDays || 0} sub="Days with scheduled medication activity" />
              </div>

              <div className="charts-grid">
                <section className="chart-card chart-card--full">
                  <div className="chart-head">
                    <div>
                      <h3 className="chart-title">Daily adherence trend</h3>
                      <p className="chart-sub">Percentage of scheduled doses marked as taken each day.</p>
                    </div>
                  </div>
                  {series.length ? (
                    <div className="chart-body">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                        <LineChart data={series}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="#94a3b8" fontSize={12} />
                          <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={12} />
                          <Tooltip labelFormatter={formatShortDate} formatter={(value) => [`${value}%`, 'Adherence']} />
                          <Line type="monotone" dataKey="adherencePct" stroke="#0abfb8" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <ChartEmpty message="Adherence history will appear after daily snapshots are captured." />
                  )}
                </section>

                <section className="chart-card">
                  <div className="chart-head">
                    <div>
                      <h3 className="chart-title">Taken vs missed</h3>
                      <p className="chart-sub">Dose totals per day for the selected period.</p>
                    </div>
                  </div>
                  {series.length ? (
                    <div className="chart-body">
                      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={260}>
                        <BarChart data={series}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="date" tickFormatter={formatShortDate} stroke="#94a3b8" fontSize={12} />
                          <YAxis stroke="#94a3b8" fontSize={12} />
                          <Tooltip labelFormatter={formatShortDate} />
                          <Legend />
                          <Bar dataKey="takenDoses" name="Taken" fill="#10b981" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="missedDoses" name="Missed" fill="#e84545" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <ChartEmpty message="No chart data yet." />
                  )}
                </section>

                <section className="chart-card">
                  <div className="chart-head">
                    <div>
                      <h3 className="chart-title">Most missed medications</h3>
                      <p className="chart-sub">Drill-down based on the stored daily medication breakdown.</p>
                    </div>
                  </div>
                  {medicationMisses.length ? (
                    <div className="insight-list">
                      {medicationMisses.map((item) => (
                        <div key={item.name} className="insight-row">
                          <div>
                            <div className="insight-title">{item.name}</div>
                            <div className="insight-sub">{item.totalDoses} total scheduled doses in range</div>
                          </div>
                          <span className="insight-pill">{item.missedDoses} missed</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ChartEmpty message="No missed-medication detail is available for this period." />
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}